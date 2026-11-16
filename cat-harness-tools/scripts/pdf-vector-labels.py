#!/usr/bin/env python3
"""Recover the positioned TEXT on a page that declares a figure. Bean `a8wy`, under `m4xy`.

`pdf-images.py` recovers the RASTER layer. WHO's conceptual figures --
frameworks, maturity models, taxonomies, process flows -- are drawn in path
operators and text, so there is no image object and that arm places nothing:
`9789240120747-eng` declares six captioned figures and places zero images, and
`check-l1-complete` reported "0 image(s), 0 describable and all described" over
it. This reads the other layer and writes `vector-labels.json` beside it.

The contract and every measurement behind it are in `schemas/vector-labels.ts`,
which this mirrors and does not restate. Four decisions drive the code below,
and a reader of the script would reasonably change them without these:

  * THE UNIT IS A LINE, not a block. MuPDF's block segmentation merges labels
    that are nowhere near each other: on `9789240010567-eng` page 25 one block
    holds six circled numerals spread over 200pt, and another holds
    `HEALTH USE CASE` and `HEALTH PROGRAMME` -- the titles of two DIFFERENT
    architectures. Lines do not merge that way, and a line's spans concatenate
    into readable text.

  * `intersectsDrawing` IS RECORDED AND NEVER FILTERED ON. On the handbook's
    page 34 it separates perfectly -- 149 labels on the drawing, and the 4 that
    are not are the running head, the page number, the caption and the source
    line. On `9789240010567-eng` page 25 it is false for 30 labels that are
    plainly figure content (`SILOED`, `MUD`, `INTEGRATED`, `EXCHANGED`, their
    glosses, and both axis labels), because those sit in the white space
    BETWEEN the drawn boxes.

  * THE PAGE QUALIFIES ON THE CAPTION, LOOSELY, AND THE ERROR IS DELIBERATE.
    Any line-start `Fig.`/`Figure` + number, on a page with a vector layer,
    minus table-of-contents entries. That admits pages whose only match is a
    cross-reference (`Fig. 4.5.1 highlights the major considerations`), and the
    over-inclusion is chosen: a false positive costs a page of prose in the
    sidecar, a false negative loses a figure's labels entirely, which is the
    whole point of the arm. Same asymmetry `document-image.ts` argues for
    `chrome`.

  * WHAT IS EXCLUDED IS EXCLUDED STRUCTURALLY, not by a tuned number. A
    table-of-contents entry carries a DOT LEADER; nothing else here does.
    `m4xy` refuses a coverage threshold because one chosen after seeing this
    corpus is chosen to fit the answer -- a leader is a typographic fact, not a
    percentile.

Never claims absence it did not establish: no backend, or a document that will
not open, yields `pages: null` with a reason -- NOT an empty list. An empty
list is the determined finding that no page declares a figure over a vector
layer.

    python3 scripts/pdf-vector-labels.py -o library uploads/handbook.pdf
    python3 scripts/pdf-vector-labels.py -o library --dry-run uploads/handbook.pdf
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from _pdf_doc_id import derive_doc_id_from_pdf as _doc_id  # noqa: E402

SCHEMA = "folio-vector-labels/v1"

# Line-start only, the same reason `declaredFigureCaptions` in
# `check-l1-complete.ts` is: a cross-reference runs mid-sentence. Looser than
# that one on purpose -- it does not require the period+space separator,
# because `9789240093362-eng` captions read `Fig. 13\t Example decision-support
# logic matrix` with a TAB and no period, and requiring the period dropped 14
# of its 15 figure pages.
#
# The dot after `Fig` is optional too: `9789240101197-eng` (the supply chain
# handbook) captions read `Fig 1. Public health supply chain partners ...`, and
# requiring `Fig.` silently dropped nine of its figure pages (Figs. 1-4, 6-9,
# 12), so the folio built from it had no blocks for them. `Fig` must still be
# followed by a number, so `Figure`, `Figs` and words like `Fight` never match
# through this branch.
CAPTION = re.compile(r"^[ \t]*(?:Fig\.?|Figure)[ \t]*\d+(?:\.\d+)*\b")

# A dot leader: two periods separated by nothing but space. This is the whole
# table-of-contents guard and it needs no page-level rule -- checked against
# every candidate in the six WHO PDFs, it excludes both of
# `9789240010567-eng`'s figure-list pages (42 entries) and no real caption.
# Deliberately NOT "ends in a number": `Figure 2.13. m4RH monitoring data ...
# August 2010 to April 2012` ends in a year.
DOT_LEADER = re.compile(r"\.[ \t]*\.")


def line_text(line: dict) -> str:
    """One line's text: its spans concatenated, NOT joined with a space.

    A span is a run of one style, so MuPDF splits `Monolithic Un-architected`
    into `M` / `onolithic ` / `U` / `n-architected` where the capitals are
    bold. Joining those with a space produced `M onolithic  U n-architected`.
    Whatever spacing the line has is already in the span text.
    """
    return "".join(span["text"] for span in line.get("spans", [])).strip()


def block_text(block: dict) -> str:
    """One block's text, for caption matching only -- lines joined with spaces."""
    return " ".join(line_text(line) for line in block.get("lines", [])).strip()


def caption_candidates(blocks: list[dict]) -> list[str]:
    """Line-start figure references on the page, table-of-contents entries removed."""
    out = []
    for b in blocks:
        t = block_text(b)
        if CAPTION.match(t) and not DOT_LEADER.search(t):
            out.append(t)
    return out


def undetermined(doc_id: str, reason: str) -> dict:
    return {"$schema": SCHEMA, "doc_id": doc_id, "pages": None, "undetermined_reason": reason}


def extract(pdf: Path) -> dict:
    """The sidecar body. Returns `pages: None` rather than lying about absence."""
    doc_id = _doc_id(str(pdf))
    try:
        import pymupdf
    except ImportError:
        return undetermined(
            doc_id,
            "pymupdf is not installed, so no page geometry could be read. This is NOT "
            "'the document draws no figures': install it (pip install -r cat-harness-tools/python/requirements.txt) "
            "and re-run.",
        )

    try:
        doc = pymupdf.open(pdf)
    except Exception as exc:  # noqa: BLE001 -- any open failure is undetermined
        return undetermined(doc_id, f"could not open {pdf.name}: {exc}")

    pages: list[dict] = []
    # A page's worth of text is what makes an empty result MEANINGFUL. A scanned
    # PDF with no text layer would otherwise return `pages: []` -- the
    # determined finding that the document declares no figures -- over a
    # document nothing has read. That is bean `dh4f` exactly, and it is the one
    # place this arm can produce it, because every other empty is a real
    # measurement over real text.
    characters = 0
    for index in range(doc.page_count):
        page = doc[index]
        try:
            blocks = [b for b in page.get_text("dict")["blocks"] if b.get("type") == 0]
            rects = [pymupdf.Rect(d["rect"]) for d in page.get_drawings()]
        except Exception:  # noqa: BLE001
            # One unreadable page is not an unreadable document, and it is not
            # an empty one either. Skipping it silently would leave this page
            # indistinguishable from a page that genuinely qualifies for nothing.
            return undetermined(
                doc_id, f"page {index + 1} of {pdf.name} could not be read, so the run is partial"
            )

        characters += sum(len(line_text(line)) for b in blocks for line in b.get("lines", []))

        captions = caption_candidates(blocks)
        if not captions or not rects:
            continue

        labels = []
        for b in blocks:
            for line in b.get("lines", []):
                text = line_text(line)
                if not text:
                    continue
                r = pymupdf.Rect(line["bbox"])
                spans = line.get("spans", [])
                labels.append({
                    "text": text,
                    # Stored in the VISIBLE frame. `get_text` and `get_drawings`
                    # both report the unrotated page -- checked, not assumed:
                    # on `9789240010567-eng` page 25 both unions run past 790 in
                    # y, which only the 841-tall unrotated box admits. So the
                    # intersection below is computed there and is correct, while
                    # a reader locating a label on the rendered page needs the
                    # rotated one, and every figure page of that document is
                    # landscape by 90-degree rotation. `rotation_matrix` is the
                    # identity when the page is upright.
                    "bbox": [round(v, 2) for v in tuple(r * page.rotation_matrix)],
                    "intersectsDrawing": any(dr.intersects(r) for dr in rects),
                    "fonts": sorted({sp["font"] for sp in spans}),
                    "sizes": sorted({round(sp["size"], 2) for sp in spans}),
                })

        # Top edge then left edge, in the VISIBLE frame. A stated, deterministic
        # convention so a re-run diffs cleanly -- NOT a claim about reading
        # order, which a diagram does not have and this arm does not infer.
        labels.sort(key=lambda lab: (lab["bbox"][1], lab["bbox"][0]))

        pages.append({
            "page": index + 1,
            "rotation": page.rotation,
            "drawings": len(rects),
            "rasterImagesOnPage": len(page.get_images(full=True)),
            "captionCandidates": captions,
            "labels": labels,
        })

    if not pages and characters == 0:
        return undetermined(
            doc_id,
            f"{pdf.name} carries no extractable text on any of its {doc.page_count} page(s), so "
            "no caption could be read. This is NOT 'the document declares no figures': it is a "
            "scan, and its text has to come from OCR before this arm can say anything.",
        )

    return {"$schema": SCHEMA, "doc_id": doc_id, "pages": pages}


def summarise(sidecar: dict) -> str:
    pages = sidecar.get("pages")
    if pages is None:
        return f"UNDETERMINED — {sidecar.get('undetermined_reason', 'no reason given')}"
    if not pages:
        return "0 pages declare a figure over a vector layer (determined)"
    labels = sum(len(p["labels"]) for p in pages)
    on = sum(1 for p in pages for lab in p["labels"] if lab["intersectsDrawing"])
    # BOTH numbers, and the second is not a subset to be graded: see the module
    # docstring for the page where the intersection test is false for 30 real
    # figure labels.
    return f"{len(pages)} page(s), {labels} label(s) recovered, {on} of them on a drawing"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pdf", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=Path("library"),
                    help="library root; the sidecar lands in <out>/<doc-id>/")
    ap.add_argument("--dry-run", action="store_true", help="report, writing nothing")
    ap.add_argument("--json", action="store_true", help="emit the sidecar to stdout")
    args = ap.parse_args()

    if not args.pdf.exists():
        print(f"{args.pdf}: no such file", file=sys.stderr)
        return 1

    sidecar = extract(args.pdf)
    # Same stream discipline as `pdf-images.py`: with `--json` the human line
    # goes to stderr so stdout carries the payload and nothing else.
    print(f"{args.pdf.name}: {summarise(sidecar)}", file=sys.stderr if args.json else sys.stdout)
    if args.json:
        print(json.dumps(sidecar, ensure_ascii=False))

    if args.dry_run:
        return 0 if sidecar["pages"] is not None else 2

    target = args.out / sidecar["doc_id"] / "vector-labels.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"  wrote {target}")
    # An undetermined run is not a successful one.
    return 0 if sidecar["pages"] is not None else 2


if __name__ == "__main__":
    sys.exit(main())
