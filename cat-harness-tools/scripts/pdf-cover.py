#!/usr/bin/env python3
"""Render a PDF page to a PNG — the thumbnail a repository listing shows.

Generic on purpose: a page raster is a PDF fact, not a WHO one, and it sits
beside `pdf-images.py`, `pdf-pages.py` and `pdf-structure.py` rather than in an
instance. The instance decides WHICH documents get a cover and where the file
lands; this decides nothing.

It renders the FIRST PAGE and calls it the cover. That is a choice worth
stating, because it is the same choice `pdf-pages.py` makes about sections and
for the same reason: page 1 is a determined answer, and "the cover" is not.
Measured on the three WHO IRIS items, page 1 is the cover in all three and it
looks different in each — a portrait designed cover (2:3), a landscape designed
cover (0.705:1) and a scanned title page. A heuristic that tried to find "the
cover" would have had to be right about all three to beat taking page 1, and
would have had no way to say when it was unsure.

WHAT THIS PRODUCES IS DERIVED, AND IT IS NOT THE PUBLISHER'S THUMBNAIL. A
repository like DSpace generates its own THUMBNAIL bundle; this renders our
own from bytes we hold. A catalogue recording one of these as if it came from
upstream would assert something false about what it holds, so the caller is
expected to record the derivation. `--json` exists to make that cheap: it
prints the source, the page, the geometry and the digest, which is everything a
provenance record needs and nothing it has to guess.

Deterministic: MuPDF's rasteriser and PNG writer produce identical bytes from
identical input, verified across repeated renders (1.28.2), which is what lets
a caller run this under `--check` and compare bytes rather than re-deciding.

    python3 cat-harness/scripts/pdf-cover.py uploads/FILE.pdf -o cover.png
    python3 cat-harness/scripts/pdf-cover.py uploads/FILE.pdf -o cover.png --width 300 --json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


# Mid grey, and deliberately NOT the surrounding page colour.
#
# A mask filled to match its background is invisible, and an invisible mask is
# a claim nobody can check: the rendering then looks like a publication that
# never carried the thing that was removed. Grey reads as "something was taken
# out here" on both the white covers and the blue one, which is the honest
# answer and the one a reader can question.
MASK_FILL = (128, 128, 128)


def render(pdf: Path, page: int, width: int, masks: list[tuple[int, int, int, int]] = []) -> tuple[bytes, dict]:
    """PNG bytes for one page, plus the facts a provenance record needs.

    Raises rather than returning a placeholder. A missing backend and a
    zero-page PDF are different findings and neither is "here is a blank
    image": an image that renders is indistinguishable from one that worked,
    and a caller that got a blank would commit it.
    """
    try:
        import pymupdf
    except ImportError:  # pragma: no cover - environment-dependent
        sys.exit("pymupdf is not installed: pip install pymupdf")

    # Bounds the caller could otherwise turn into a silently useless file.
    # `--width 0` scales to nothing and writes a 0x0 PNG, which is a file that
    # exists, commits, and renders as a broken image at the far end; `--page 0`
    # would index `doc[-1]`, quietly returning the LAST page for a request that
    # meant the first. Both are refusals rather than clamps: a clamp answers a
    # question the caller did not ask.
    if width < 1:
        sys.exit(f"--width must be at least 1 pixel, got {width}")
    if page < 1:
        sys.exit(f"--page is 1-based; got {page}")

    doc = pymupdf.open(pdf)
    if doc.page_count < page:
        sys.exit(f"{pdf.name}: asked for page {page} of a {doc.page_count}-page document")

    pg = doc[page - 1]
    rect = pg.rect
    if rect.width <= 0 or rect.height <= 0:
        sys.exit(f"{pdf.name}: page {page} has no geometry ({rect.width}x{rect.height})")

    # Scaled on WIDTH, so a landscape cover and a portrait one occupy the same
    # column in a listing. Height follows the page's own aspect and is never
    # forced -- a cropped or letterboxed cover is a cover that misrepresents
    # the document, and the WPRO style guide (0.705:1) would have been the one
    # it misrepresented.
    scale = width / rect.width
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)

    # MASKS ARE APPLIED BEFORE THE DIGESTS, never after.
    #
    # `sha256` and `bytes` below describe the bytes this script WRITES, and a
    # consumer checks a committed file against them. Masking after the fact --
    # in a second pass, or in the caller -- would leave provenance describing a
    # rendering nobody has, and `gen-covers --check` would fail on every run
    # while the file was correct. So the mask belongs inside the render.
    #
    # Refused rather than clamped when a region falls outside the raster: a
    # clamp silently covers less than asked, which is the one failure mode that
    # matters here -- a mask exists to hide something, and a mask that hides
    # part of it looks exactly like one that worked.
    for m in masks:
        x0, y0, x1, y1 = m
        if x1 <= x0 or y1 <= y0:
            sys.exit(f"--mask must have positive area; got {x0},{y0},{x1},{y1}")
        if x1 > pix.width or y1 > pix.height:
            sys.exit(
                f"--mask {x0},{y0},{x1},{y1} falls outside the {pix.width}x{pix.height} rendering. "
                f"Regions are in OUTPUT pixels; a region measured at a different --width will not fit."
            )
        pix.set_rect(pymupdf.IRect(x0, y0, x1, y1), MASK_FILL)

    png = pix.tobytes("png")

    return png, {
        "source": str(pdf),
        "sourceSha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
        "page": page,
        "pageCount": doc.page_count,
        "pageWidthPt": round(rect.width, 2),
        "pageHeightPt": round(rect.height, 2),
        "pixelWidth": pix.width,
        "pixelHeight": pix.height,
        "bytes": len(png),
        "sha256": hashlib.sha256(png).hexdigest(),
        "mediaType": "image/png",
        "renderer": f"pymupdf {pymupdf.version[0]}",
        # Reported even when empty, so a consumer can tell "this rendering
        # masked nothing" from "this renderer does not know about masking".
        "maskedRegions": [{"x0": m[0], "y0": m[1], "x1": m[2], "y1": m[3]} for m in masks],
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("pdf", type=Path)
    ap.add_argument("-o", "--out", type=Path, required=True, help="PNG to write")
    ap.add_argument("--page", type=int, default=1, help="1-based page to render (default 1)")
    ap.add_argument("--width", type=int, default=300, help="output width in pixels (default 300)")
    ap.add_argument(
        "--mask",
        action="append",
        default=[],
        metavar="x0,y0,x1,y1",
        help="blank this rectangle, in OUTPUT pixels, origin top-left, x1/y1 exclusive. "
        "Repeatable. Refused if it falls outside the rendering.",
    )
    ap.add_argument(
        "--json",
        action="store_true",
        help="print the provenance facts to stdout — source, page, geometry, digests",
    )
    ap.add_argument(
        "--check",
        action="store_true",
        help="do not write; exit non-zero if --out differs from what would be written",
    )
    a = ap.parse_args()

    masks = []
    for raw in a.mask:
        parts = raw.split(",")
        if len(parts) != 4:
            sys.exit(f"--mask wants x0,y0,x1,y1 (four integers); got {raw!r}")
        try:
            masks.append(tuple(int(p) for p in parts))
        except ValueError:
            sys.exit(f"--mask wants four integers; got {raw!r}")

    png, facts = render(a.pdf, a.page, a.width, masks)

    if a.check:
        prev = a.out.read_bytes() if a.out.exists() else None
        if prev == png:
            if a.json:
                print(json.dumps(facts, indent=2))
            return 0
        print(
            f"stale or missing: {a.out}" if prev is None else f"stale: {a.out}",
            file=sys.stderr,
        )
        return 1

    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_bytes(png)
    if a.json:
        print(json.dumps(facts, indent=2))
    else:
        print(f"ok  {a.out}  {facts['pixelWidth']}x{facts['pixelHeight']}  {facts['bytes']} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
