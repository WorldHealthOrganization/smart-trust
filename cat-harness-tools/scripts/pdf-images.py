#!/usr/bin/env python3
"""Extract placed images from a PDF, and say which of them are FIGURES.

Bean `d5f1`. Stage A of the image path: this writes facts, and
`pipeline/gen-library-jsonld.ts` turns them into nodes. The same split
`pdf-structure.py` / `pdf-tables.py` already use.

Why the classification is here rather than left to a consumer
------------------------------------------------------------
`d5f1` asks for a narrative description of every image. Measured on this corpus
2026-09-20, doing that literally would be wrong six times in seven: of 164
placed images, 140 are PAGE SCANS -- one near-full-bleed image per page, which
is the page itself and not a figure on it -- against 24 candidate figures.

    WHO_PUB_TPS_93.1        121 pages  121 images  coverage 0.998, one per page
    milnorlink               20 pages   20 images  19 full-bleed
    9789241548960_eng       179 pages    2 images  coverage ~0.50
    WPR-RDO-2020-003-eng     33 pages   21 images  median coverage 0.013

The two clusters do not overlap -- nothing in the corpus sits between 0.50 and
0.99 -- so no content heuristic is needed, and none is used. The rule is
stated once, in `schemas/document-image.ts` (`roleFor`); this script computes
the same thing from the same numbers and `scripts/tests/pdf-images.test.py`
pins the two against shared cases.

The CAPTURE RUNG -- bean `r8br`, issue #722
-------------------------------------------
Geometry alone gives one bit, and a browser print needs two. A four-page print
of a docs site places 104 images, every one of them a navigation icon or a
copy button, and the rule above calls all 104 `figure` by construction: there
is no verdict between "this image IS the page" and "this image is a figure".
Only a figure gets a narrative slot, and that slot is what `image-descriptions`
gates on, so nav chrome blocked seven documents from promotion.

A PDF says who made it. Measured 2026-09-21 over all 18 PDFs here, `Producer`
and `Creator` partition the corpus with no overlap in either direction:

    Skia/PDF m152   + Mozilla/5.0 (Macintosh...)   11   browser prints
    pikepdf 8.15.1  + arXiv GenPDF (tex2pdf...)     3   typeset papers
    (none) x2, Atypon Systems, Pixel Translations   4   other

So a capture is DETECTED rather than assumed, from evidence that travels with
the file, and `chrome` is assigned only inside that rung. Outside it nothing
changes -- a typeset PDF classifies today exactly as it did before.

Coverage is measured on the PLACED RECTANGLE (`page.get_image_rects`), not on
the image's own pixel dimensions. A 4000px scan placed into a thumbnail box is
a thumbnail to a reader, and it is the reader's view this bean is about.

Never claims absence it did not establish
-----------------------------------------
No backend, or a page whose geometry cannot be read, yields `images: null` with
a reason -- NOT an empty list. An empty list is the determined finding that the
document places no images. Filing an unread image as a page scan would drop it
silently from every later description pass, which is the expensive direction.

    python3 scripts/pdf-images.py -o library uploads/paper.pdf
    python3 scripts/pdf-images.py -o library --dry-run uploads/paper.pdf
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from _pdf_doc_id import derive_doc_id_from_pdf as _doc_id  # noqa: E402

# Kept in step with PAGE_COVERAGE_THRESHOLD in schemas/document-image.ts by
# scripts/tests/pdf-images.test.py, which reads both rather than restating either.
PAGE_COVERAGE_THRESHOLD = 0.8

# Likewise CAPTURE_CHROME_THRESHOLD. Below this fraction of the page, an image
# in a CAPTURE RUNG is the browser's own furniture rather than content. The
# derivation is in document-image.ts and is not restated here: measured over
# all 219 placed images in the six browser prints under uploads/, nav chrome
# tops out at 0.005804 and the smallest real figure is 0.139632, a 24.1x gap
# with nothing in it. Set low on purpose -- filing a real figure as chrome
# would drop it silently from every description pass.
CAPTURE_CHROME_THRESHOLD = 0.02

SCHEMA = "folio-document-images/v1"


def is_capture_print(producer: str | None, creator: str | None) -> bool:
    """Is this a captured web page? Mirrors `isCapturePrint` in document-image.ts.

    BOTH signals, never either. Skia is Chromium's graphics library and reaches
    past printing -- Android and Flutter emit it too -- so it alone says "a
    Chromium-family renderer", not "a browser printed a web page". The
    user-agent in Creator says the second thing. Requiring both also fails
    SAFE: a capture missing one field is not a rung, so its images stay
    `figure` and keep blocking exactly as they do today, rather than being
    reclassified on half the evidence.
    """
    return "Skia/PDF" in (producer or "") and (creator or "").startswith("Mozilla/")


def role_for(
    coverage: float, images_on_page: int, capture: bool = False, role_threshold: float | None = None
) -> str:
    """The role a computable basis implies. Mirrors `roleFor` in document-image.ts.

    `page-scan` is tried FIRST, in both rungs: a browser print can still place a
    full-bleed image alone on a page, and that image is the page. The capture
    being a web page does not change what full-bleed means.

    `role_threshold` is the CALLER's optional cutoff -- bean `ay3x`, owner
    2026-10-03: "an optional one can be set, default none". `None`, the
    default, thresholds nothing. When given, an image that would otherwise be a
    `figure` and covers less than it is filed `furniture`, and the caller
    records a `threshold` basis naming the value. It is tried LAST, so it never
    overrides a page scan or a capture's chrome, which have their own evidence.
    """
    if coverage >= PAGE_COVERAGE_THRESHOLD and images_on_page == 1:
        return "page-scan"
    if capture and coverage < CAPTURE_CHROME_THRESHOLD:
        return "chrome"
    if role_threshold is not None and coverage < role_threshold:
        return "furniture"
    return "figure"


def extract(pdf: Path, outdir: Path, dry_run: bool, role_threshold: float | None = None) -> dict:
    """The sidecar body. Returns `images: None` rather than lying about absence."""
    try:
        import pymupdf
    except ImportError:
        return {
            "$schema": SCHEMA,
            "doc_id": _doc_id(str(pdf)),
            "images": None,
            "undetermined_reason": (
                "pymupdf is not installed, so no page geometry could be read. "
                "This is NOT 'the document has no images': install it "
                "(pip install -r cat-harness-tools/python/requirements.txt) and re-run."
            ),
        }

    doc_id = _doc_id(str(pdf))
    try:
        doc = pymupdf.open(pdf)
    except Exception as exc:  # noqa: BLE001 -- any open failure is undetermined
        return {
            "$schema": SCHEMA,
            "doc_id": doc_id,
            "images": None,
            "undetermined_reason": f"could not open {pdf.name}: {exc}",
        }

    # The capture's own provenance, read once. `doc.metadata` is already in
    # hand from the open above, so detecting the rung costs nothing and needs
    # no plumbing from the ingest layer -- the evidence travels with the file.
    meta = doc.metadata or {}
    producer = (meta.get("producer") or "").strip()
    creator = (meta.get("creator") or "").strip()
    capture = is_capture_print(producer, creator)

    images: list[dict] = []
    # ONE ENTRY PER DISTINCT IMAGE, not per placement -- bean `j820`, issue
    # #1234. An image used many times was becoming many images: 383 placements
    # of arXiv:2510.21603v1 are 51 image objects, and its page 3's 335 are 22,
    # each placed about fifteen times. Measured 2026-09-24 across every
    # `images.json` in the tree; `9789241509510-eng` is 162 -> 103,
    # `9789241511766-eng` 99 -> 44, `arxiv-2312.07755v1` 84 -> 28.
    #
    # THE KEY IS THE PDF'S OWN `xref`, not a hash of the pixels. Two placements
    # of one image object ARE one image by the document's own account, and a
    # hash would be this script's opinion about that rather than the file's.
    # Checked against a content hash before choosing: on the five affected
    # documents the two agree, except that arXiv:2510.21603v1 holds 51 objects
    # whose decoded bytes are 37 distinct -- so hashing would merge images the
    # PDF itself keeps apart, which is a claim this script has no business
    # making.
    #
    # Ordered by first placement, so ids stay `img-p003-5` and a reader who
    # knew the old layout still recognises them.
    by_xref: dict[int, dict] = {}
    for index in range(doc.page_count):
        page = doc[index]
        page_area = abs(page.rect.width * page.rect.height)
        if page_area <= 0:
            # A zero-area page cannot yield a coverage, so it cannot yield a
            # role. Recorded as undetermined rather than skipped: a skipped
            # image is absent, and absence is a claim this cannot make.
            for ordinal, info in enumerate(page.get_images(full=True), start=1):
                images.append({
                    "id": f"img-p{index + 1:03d}-{ordinal}",
                    "file": f"images/img-p{index + 1:03d}-{ordinal}.png",
                    "role": "undetermined",
                })
            continue

        placed: list[tuple[int, float]] = []
        for info in page.get_images(full=True):
            xref = info[0]
            try:
                rects = page.get_image_rects(xref)
            except Exception:  # noqa: BLE001
                rects = []
            for rect in rects:
                placed.append((xref, abs(rect.width * rect.height) / page_area))

        for ordinal, (xref, coverage) in enumerate(placed, start=1):
            placement = {
                "page": index + 1,
                "coverage": round(coverage, 6),
                "imagesOnPage": len(placed),
            }
            # SECOND AND LATER PLACEMENTS append and stop. Everything below --
            # the id, the role, the basis, the written pixels -- describes the
            # FIRST placement, which is what `basis` has always meant and what
            # `PlacementSchema`'s refinement now holds it to.
            if xref in by_xref:
                by_xref[xref]["placements"].append(placement)
                continue
            image_id = f"img-p{index + 1:03d}-{ordinal}"
            rel = f"images/{image_id}.png"
            # In a capture rung EVERY image carries the capture basis, not just
            # the chrome. The producer is why the verdict came out as it did --
            # including for the figures that survived the bound -- so recording
            # it only on the reclassified ones would leave a reader unable to
            # tell "a figure in a browser print" from "a figure in a typeset
            # PDF". Both are checkable; only one has a rung.
            basis = (
                {
                    "method": "capture",
                    "producer": producer,
                    "creator": creator,
                    "coverage": round(coverage, 6),
                    "imagesOnPage": len(placed),
                    "page": index + 1,
                }
                if capture
                else {
                    # Geometry, explicitly. A role assigned by LOOKING carries
                    # `method: "inspection"` and names who looked -- see
                    # schemas/document-image.ts. This script never looks.
                    "method": "geometry",
                    "coverage": round(coverage, 6),
                    "imagesOnPage": len(placed),
                    "page": index + 1,
                }
            )
            role = role_for(coverage, len(placed), capture, role_threshold)
            if role == "furniture":
                # The cutoff decided this one, so the cutoff is the basis: the
                # value and that the CALLER supplied it. Never geometry, and
                # never inspection -- a thresholded call must not pass for
                # either (`library-ingestion`, bean `ay3x`).
                basis = {
                    "method": "threshold",
                    "value": role_threshold,
                    "suppliedBy": "caller",
                    "coverage": round(coverage, 6),
                    "imagesOnPage": len(placed),
                    "page": index + 1,
                }
            entry = {
                "id": image_id,
                "file": rel,
                "role": role,
                "basis": basis,
            }
            # Only a figure gets a narrative slot. The 140 scans get none --
            # that is the measurement, enforced in the schema and applied here.
            if entry["role"] == "figure":
                entry["narrative"] = {"text": None, "state": "not-authored"}
            entry["placements"] = [placement]
            by_xref[xref] = entry
            images.append(entry)

            # Only a FIGURE gets its pixels written. `chrome` earns none for the
            # same reason a scan does not: nothing downstream reads a copy of
            # the browser's search glyph, and the two Antigravity prints alone
            # would have written 208 of them.
            #
            # A page scan IS the page:
            # its content already reaches the library through the page tree
            # that `pdf-pages.py` / `pdf-ocr.py` build, so a copy under
            # `images/` is duplication a clone pays for forever. Measured
            # 2026-09-20 on WHO_PUB_TPS_93.1: ~6 MB for its 121 page scans --
            # not ruinous, which is why this is a design choice rather than an
            # emergency, but nothing in `d5f1` reads those bytes.
            #
            # The ENTRY is still recorded for every image, scan included. The
            # classification is the finding; suppressing the entry would make
            # "not a figure" indistinguishable from "not seen".
            if not dry_run and entry["role"] == "figure":
                target = outdir / doc_id / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                try:
                    pix = pymupdf.Pixmap(doc, xref)
                    # PNG takes only DeviceGray and DeviceRGB. CMYK, and a
                    # one-channel DeviceN or Separation ink (MuPDF calls it
                    # gray, but the PNG writer refuses it: "pixmap must be
                    # grayscale or rgb"), are converted to RGB first. Measured
                    # 2026-11-11 on WHO IRIS 10665-44118-rus, where ten
                    # DeviceN(Black) photographs were written as empty files.
                    if pix.colorspace and pix.colorspace.name not in (
                            pymupdf.csGRAY.name, pymupdf.csRGB.name):
                        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                    # A PDF image's transparency lives in a SEPARATE soft-mask
                    # object, which `Pixmap(doc, xref)` does not apply. Without
                    # it, a glyph drawn as colour-plus-mask comes out as a solid
                    # square: arXiv:2312.07755 wrote 64 all-black 512x512 PNGs
                    # for the icons in its Table 2 (issue #1023). Re-attach the
                    # mask so the PNG carries the alpha the page renders with.
                    smask = doc.extract_image(xref).get("smask", 0)
                    if smask:
                        # DROP ANY ALPHA THE BASE ALREADY HAS FIRST. MuPDF
                        # refuses the combine otherwise -- "color pixmap must
                        # not have an alpha channel" (FzErrorArgument) -- and
                        # the `except` below then swallowed it, leaving
                        # `images.json` naming a file that was never written.
                        # An image can carry BOTH an alpha channel and a
                        # separate soft mask; measured 2026-09-29 on
                        # `2509.06388v1.pdf`, where three of eight images did
                        # (xrefs 52, 124, 155, each n=4 with alpha=1 AND an
                        # smask). Every one of the three was a figure the
                        # chapter demonstrably contains, and the gate went on
                        # demanding a narrative for a PNG no inspector could
                        # open -- the expensive direction, because a missing
                        # file reads as an unfinished description rather than
                        # as a broken extraction.
                        if pix.alpha:
                            pix = pymupdf.Pixmap(pix, 0)
                        mask = pymupdf.Pixmap(doc, smask)
                        # A soft mask may be drawn at another resolution than
                        # its image (10665-44118-rus p214: a 145x64 logo with a
                        # 434x192 mask). MuPDF wants them the same size, so the
                        # mask is scaled to the image.
                        if (mask.width, mask.height) != (pix.width, pix.height):
                            mask = pymupdf.Pixmap(mask, pix.width, pix.height, None)
                        pix = pymupdf.Pixmap(pix, mask)
                    pix.save(target)
                except Exception as exc:  # noqa: BLE001
                    # The ENTRY stands; only the file is missing. Reporting the
                    # image as absent because its bytes would not decode would
                    # lose a figure the document demonstrably contains.
                    print(f"  ! {image_id}: could not write {rel}: {exc}", file=sys.stderr)

    # A SINGLY-PLACED IMAGE CARRIES NO `placements`. The array exists to say
    # "this appears in more than one place"; writing a one-element copy of
    # `basis` on every entry would add a field to ~90% of the corpus that
    # states what `basis` already states, and `PlacementSchema` says absent is
    # the normal case.
    for entry in images:
        if len(entry.get("placements", [])) < 2:
            entry.pop("placements", None)

    return {"$schema": SCHEMA, "doc_id": doc_id, "images": images}


def summarise(sidecar: dict) -> str:
    images = sidecar.get("images")
    if images is None:
        return f"UNDETERMINED — {sidecar.get('undetermined_reason', 'no reason given')}"
    if not images:
        return "0 placed images (determined: this document places none)"
    counts: dict[str, int] = {}
    for i in images:
        counts[i["role"]] = counts.get(i["role"], 0) + 1
    parts = ", ".join(f"{n} {role}" for role, n in sorted(counts.items()))
    # DISTINCT images and total PLACEMENTS are two numbers and this prints
    # both, because the gap between them is the finding (bean `j820`): it read
    # "383 placed image(s)" for a document holding 51. An entry with no
    # `placements` is placed once.
    placements = sum(len(i.get("placements", [None])) for i in images)
    extra = f", {placements} placement(s)" if placements != len(images) else ""
    return f"{len(images)} distinct image(s){extra}: {parts}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pdf", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=Path("library"),
                    help="library root; the sidecar lands in <out>/<doc-id>/")
    ap.add_argument("--dry-run", action="store_true",
                    help="classify and report, writing nothing")
    ap.add_argument("--json", action="store_true",
                    help="emit the sidecar to stdout, for a consumer to validate")
    # NO DEFAULT, and none may be added -- owner 2026-10-03, "an optional one
    # can be set, default none". The evidence against any particular number is
    # in bean `m4xy`; a value chosen after seeing a corpus fits that corpus.
    ap.add_argument("--role-threshold", type=float, default=None, metavar="COVERAGE",
                    help="OPTIONAL caller-supplied coverage cutoff: an image that would be a "
                         "figure and covers less of its page than this is filed `furniture`, "
                         "with a basis recording the value. Unset by default, and no value "
                         "is recommended")
    args = ap.parse_args()
    if args.role_threshold is not None and args.role_threshold <= 0:
        print("--role-threshold must be positive", file=sys.stderr)
        return 1

    if not args.pdf.exists():
        print(f"{args.pdf}: no such file", file=sys.stderr)
        return 1

    sidecar = extract(args.pdf, args.out, args.dry_run, args.role_threshold)
    # The human line goes to stderr when `--json` is on, so stdout carries the
    # payload and nothing else. Mixing the two is how a deprecation warning
    # from `fitz` once broke `ingest-document.ts`'s probe (bean 68dt): a tool
    # that prints prose onto its own data stream cannot be parsed safely.
    print(f"{args.pdf.name}: {summarise(sidecar)}", file=sys.stderr if args.json else sys.stdout)
    if args.json:
        print(json.dumps(sidecar, ensure_ascii=False))

    if args.dry_run:
        return 0 if sidecar["images"] is not None else 2

    target = args.out / sidecar["doc_id"] / "images.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"  wrote {target}")
    # An undetermined run is not a successful one. Exiting 0 here would let a
    # pipeline record "images: none" and carry on.
    return 0 if sidecar["images"] is not None else 2


if __name__ == "__main__":
    sys.exit(main())
