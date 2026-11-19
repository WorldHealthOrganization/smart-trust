#!/usr/bin/env python3
"""Export an INSPECTED vector figure as SVG, from the PDF's own vector layer. Bean `70zt`, under `ay3x`.

`pdf-vector-figures.py` renders each assembled region to a PNG so somebody
can look at it. A PNG is a picture of a drawing: it cannot be scaled, and every
page that reproduces the figure would need its own copy. The owner asked for
one rendering of DIIG Fig. 1.1.1 that the three Digital Transformation
Handbooks can all point at (2026-10-03, issue #1984): *"use one DIIG seven
phase figure as source. need SVG rendering"*. This arm writes that SVG.

It is drawn by the PDF, never by hand. The page's own vector layer is
exported (`get_svg_image`), and the crop is a `viewBox` set to the entry's
recorded `region`, the same frame the PNG was rendered in. So the PNG and the
SVG cannot disagree about what the figure is.

Two refusals:

  1. ONLY AN INSPECTED FIGURE. An entry whose `role` is not `figure`, or whose
     basis is not `inspection`, is refused. Whether a region is a figure is the
     call `pdf-vector-figures.py` refuses to make by machine, and exporting an
     uninspected region as "the figure" would make that call by the back door.
  2. NOTHING IS REDRAWN. If the region needs fixing, fix it in
     `vector-figures.json` through an inspection verdict; this script has no
     option to adjust the crop.

Provenance is carried in the SVG's own `<metadata>` (the files declare what
they are): the source PDF's sha256, the page, the region, the generator and
its backend version, and `contentSha256`, a hash of the drawing itself.

`--check` has two modes, because the source PDF is not in every checkout
(CI never sees `fsh-guts/uploads/`):

  * PDF PRESENT: regenerate in memory and require a byte-identical file.
  * PDF ABSENT: verify what can be verified without it. The recorded page and
    region must match `vector-figures.json`, and `contentSha256` must match the
    drawing, so a hand edit or a stale crop still fails. It says, in words,
    that regeneration was not possible; that is never reported as a full pass.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

GENERATOR = "cat-harness/scripts/pdf-vector-svg.py"
META_RE = re.compile(r'<metadata id="provenance">(.*?)</metadata>\n', re.S)


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_entry(entry_dir: Path, fig_id: str) -> dict:
    sidecar = entry_dir / "vector-figures.json"
    if not sidecar.exists():
        sys.exit(f"✗ {sidecar} does not exist — run pdf-vector-figures.py first")
    for e in json.loads(sidecar.read_text())["figures"]:
        if e.get("id") == fig_id:
            return e
    sys.exit(f"✗ {fig_id} is not an entry in {sidecar}")


def refuse_uninspected(e: dict) -> None:
    basis = e.get("basis", {})
    if e.get("role") != "figure" or basis.get("method") != "inspection":
        sys.exit(
            f"✗ {e['id']} has role {e.get('role')!r} on a {basis.get('method')!r} basis. "
            "Only a region INSPECTED as a figure is exported; record a verdict through apply-image-verdicts.ts first."
        )


def strip_meta(svg: str) -> str:
    return META_RE.sub("", svg, count=1)


def content_sha(svg: str) -> str:
    return hashlib.sha256(strip_meta(svg).encode()).hexdigest()


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render(pdf: Path, e: dict, title: str) -> str:
    import pymupdf

    doc = pymupdf.open(pdf)
    page = doc[e["page"] - 1]
    svg = page.get_svg_image(text_as_path=True)
    x0, y0, x1, y1 = e["region"]
    w, h = round(x1 - x0, 2), round(y1 - y0, 2)
    head = re.search(r"<svg[^>]*>", svg)
    if head is None:
        sys.exit("✗ the backend returned no <svg> root")
    root = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'version="1.1" width="{w}pt" height="{h}pt" viewBox="{x0} {y0} {w} {h}" '
        'role="img" aria-labelledby="title desc">\n'
        f'<title id="title">{esc(title)}</title>\n'
        f'<desc id="desc">{esc(e.get("basis", {}).get("saw", title))}</desc>\n'
    )
    body = svg[: head.start()] + root + svg[head.end():].lstrip("\n")
    meta = {
        "$schema": "folio-vector-svg-provenance/v1",
        "figure": e["id"],
        "captionLabels": e.get("captionLabels", []),
        "source": {"file": pdf.name, "sha256": sha256_file(pdf), "page": e["page"]},
        "region": e["region"],
        "rotation": e.get("rotation", 0),
        "generator": GENERATOR,
        "backend": f"pymupdf {pymupdf.VersionBind}",
        "contentSha256": content_sha(body),
    }
    block = f'<metadata id="provenance">{esc(json.dumps(meta, sort_keys=True))}</metadata>\n'
    i = body.index("</desc>\n") + len("</desc>\n")
    return body[:i] + block + body[i:]


def read_meta(svg: str) -> dict | None:
    m = META_RE.search(svg)
    if not m:
        return None
    raw = m.group(1).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return json.loads(raw)


def check(pdf: Path | None, e: dict, target: Path, title: str) -> int:
    if not target.exists():
        print(f"✗ {target} does not exist — run without --check to write it")
        return 1
    svg = target.read_text()
    meta = read_meta(svg)
    if meta is None:
        print(f"✗ {target} carries no provenance <metadata> — it was not written by {GENERATOR}")
        return 1
    problems = []
    if meta.get("source", {}).get("page") != e["page"]:
        problems.append(f"page {meta.get('source', {}).get('page')} ≠ vector-figures.json's {e['page']}")
    if meta.get("region") != e["region"]:
        problems.append(f"region {meta.get('region')} ≠ vector-figures.json's {e['region']}")
    if meta.get("contentSha256") != content_sha(svg):
        problems.append("contentSha256 does not match the drawing — the SVG was edited after it was generated")
    import importlib.util

    have_pdf = pdf is not None and pdf.exists()
    have_backend = importlib.util.find_spec("pymupdf") is not None
    if have_pdf:
        if sha256_file(pdf) != meta.get("source", {}).get("sha256"):
            problems.append("the source PDF's sha256 differs from the one recorded — a different edition")
        elif have_backend and render(pdf, e, title) != svg:
            import pymupdf

            now = f"pymupdf {pymupdf.VersionBind}"
            why = "" if meta.get("backend") == now else f" (written with {meta.get('backend')}, regenerated with {now})"
            problems.append(f"regenerating from the PDF does not reproduce the file byte for byte{why}")
    for p in problems:
        print(f"✗ {target}: {p}")
    if problems:
        return 1
    if have_pdf and have_backend:
        print(f"✓ {target}: regenerated from {pdf.name} p.{e['page']} byte for byte")
        return 0
    # Two degraded modes, each said in words; neither is reported as a full pass.
    why = (
        "the source PDF is not in this checkout"
        if not have_pdf
        else "pymupdf is not installed (the PDF is present and its sha256 matches the record)"
    )
    print(
        f"✓ {target}: provenance consistent with vector-figures.json and the drawing is unedited. "
        f"NOT regenerated: {why}, so byte-identity was not checked."
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("entry", type=Path, help="the library entry directory holding vector-figures.json")
    ap.add_argument("figure", help="the entry id, e.g. vfig-p017")
    ap.add_argument("--pdf", type=Path, help="the source PDF (optional for --check)")
    ap.add_argument("--title", required=True, help="the figure's title, written as the SVG's accessible <title>")
    ap.add_argument("--check", action="store_true", help="verify the committed SVG instead of writing it")
    a = ap.parse_args()

    e = load_entry(a.entry, a.figure)
    refuse_uninspected(e)
    target = a.entry / "figures" / f"{a.figure}.svg"
    if a.check:
        return check(a.pdf, e, target, a.title)
    if a.pdf is None or not a.pdf.exists():
        sys.exit("✗ writing needs --pdf: the SVG is drawn from the PDF's own vector layer, never redrawn")
    target.write_text(render(a.pdf, e, a.title))
    print(f"wrote {target} from {a.pdf.name} p.{e['page']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
