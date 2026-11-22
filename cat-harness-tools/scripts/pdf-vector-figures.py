#!/usr/bin/env python3
"""Assemble and RENDER the vector figures on a PDF's caption pages. Bean `ay3x`, under `m4xy`.

`pdf-vector-labels.py` (bean `a8wy`) records every positioned text line on a
page that declares a figure, and stops there on purpose: it does not group.
This arm is the step above it, which the owner ruled on 2026-10-03 -- *"Yes,
build it."* It does two things and one refusal:

  1. ASSEMBLY. The page's drawing primitives are grouped into connected
     components, the labels are placed in the component and the closed shape
     that contain them, and every open stroke is related to the labelled
     shapes its two ends land in. Recorded as structure, not as prose.

  2. RENDER. The union of the label-bearing components is rendered to a PNG
     beside `images.json`, so a person or agent can LOOK at it -- `a8wy`
     demonstrated on Annif's Figure 2 that a labels-only reading gets every
     noun right and every relation wrong, so the render is the part that makes
     an account possible rather than an inventory.

  3. THE REFUSAL: THIS SCRIPT NEVER ASSIGNS A ROLE. Every entry is written with
     `role: "undetermined"` and a basis naming THIS SCRIPT as what looked
     (`method: "assembly"`). Whether a region is a figure or furniture is the
     call `m4xy` refuses to make with a number -- *"a threshold chosen after
     seeing this corpus is a number chosen to fit the answer"* -- and `j820`
     measured that no geometric rule separates the classes across 29
     documents. So the call is made by looking, and it arrives through
     `apply-image-verdicts.ts` as an `inspection` basis naming who looked. A
     silently placed image is the `d5f1` defect; an image placed with a role
     nobody assigned is the same defect with better manners.

Every rule below is STRUCTURAL -- a fact about the drawing, never a tuned
number:

  * Two primitives belong to one component when their rectangles touch or
    overlap (closed intervals, so a zero-height rule touching a box counts).
    No gap tolerance: a tolerance would be a number fitted to this corpus.
  * A drawing whose rectangle covers the whole page is a page background and
    joins nothing; otherwise it would merge every component on the page.
  * A label belongs to the SMALLEST component, and the smallest closed shape,
    whose rectangle contains the label's centre. A label inside none is kept
    as `between` -- `a8wy` found 30 real figure labels on DIIG page 25 sitting
    in the white space between drawn boxes, so dropping them is not an option.
  * An open stroke's end attaches to a labelled shape when it lies inside that
    shape's rectangle grown by the stroke's OWN half-width -- the one length
    the drawing itself supplies. An end inside none is recorded as `null`, not
    snapped to the nearest shape: nearest-always-wins asserts a relation the
    drawing did not draw.

The region rendered is a stated convention, not a verdict: the bounding box of
every component holding at least one label. It may include page furniture (a
footer band with the page number inside it is a labelled component), and it
may EXCLUDE figure text that sits in white space beyond every drawing --
`9789240010567-eng` page 25 titles its three architectures above the boxes.
Both directions are the figure-vs-furniture call this arm refuses, so the crop
is never widened or narrowed by a guess: `assembly.outside` counts the lines
it leaves out, and the inspector, who is shown the page, says what is missing.

Never claims absence it did not establish: no backend, or a document that will
not open, yields `figures: null` with a reason -- NOT an empty list.

    python3 scripts/pdf-vector-figures.py -o library uploads/handbook.pdf
    python3 scripts/pdf-vector-figures.py -o library --dry-run uploads/handbook.pdf
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from _pdf_doc_id import derive_doc_id_from_pdf as _doc_id  # noqa: E402

# The page qualification, line text and table-of-contents guard are the
# labels arm's, imported rather than restated: two copies of "which page
# declares a figure" would agree by maintenance, and the two sidecars join on
# the page number, so a disagreement would be a page one arm has and the other
# does not.
_spec = importlib.util.spec_from_file_location("pdf_vector_labels", os.path.join(HERE, "pdf-vector-labels.py"))
_labels = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_labels)  # type: ignore[union-attr]
line_text = _labels.line_text
caption_candidates = _labels.caption_candidates

SCHEMA = "folio-vector-figures/v1"
SCRIPT_ID = "cat-harness/scripts/pdf-vector-figures.py"

# The figure number in a caption candidate. A candidate may be a
# cross-reference, so these are CANDIDATES for what the page shows and are
# never asserted to be it -- the inspector's verdict says which, in `shows`.
# `Fig.?`: the same optional dot as `CAPTION` in pdf-vector-labels.py.
LABEL = re.compile(r"^[ \t]*(?:Fig\.?|Figure)[ \t]*(\d+(?:\.\d+)*)")

# Rendering resolution. Not a threshold: it decides how many pixels a reader
# gets and no verdict depends on it. 2x the PDF's 72 dpi user space.
RENDER_DPI = 144


def touches(a: tuple, b: tuple) -> bool:
    """Closed-interval rectangle overlap. `Rect.intersects` is False for an EMPTY
    rectangle, and a horizontal rule is exactly that -- zero height -- so the
    library call would leave every rule in a component of its own."""
    return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]


def contains(r: tuple, x: float, y: float, grow: float = 0.0) -> bool:
    return r[0] - grow <= x <= r[2] + grow and r[1] - grow <= y <= r[3] + grow


def area(r: tuple) -> float:
    return max(0.0, r[2] - r[0]) * max(0.0, r[3] - r[1])


def union(rs: list[tuple]) -> tuple:
    return (min(r[0] for r in rs), min(r[1] for r in rs), max(r[2] for r in rs), max(r[3] for r in rs))


def components(rects: list[tuple]) -> list[list[int]]:
    """Connected components under `touches`, by union-find. Ordered by first member."""
    parent = list(range(len(rects)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(rects)):
        for j in range(i + 1, len(rects)):
            if touches(rects[i], rects[j]):
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[max(ri, rj)] = min(ri, rj)
    groups: dict[int, list[int]] = {}
    for i in range(len(rects)):
        groups.setdefault(find(i), []).append(i)
    return [groups[k] for k in sorted(groups)]


def is_closed(d: dict) -> bool:
    """A shape that can CONTAIN a label: filled, explicitly closed, or a rect/quad."""
    kinds = {item[0] for item in d.get("items", [])}
    return "f" in (d.get("type") or "") or bool(d.get("closePath")) or bool(kinds & {"re", "qu"})


def endpoints(d: dict) -> tuple | None:
    """The first and last point of an open path, or None if it has none."""
    items = d.get("items", [])
    if not items or items[0][0] not in ("l", "c") or items[-1][0] not in ("l", "c"):
        return None
    a, b = items[0][1], items[-1][-1]
    return (a.x, a.y), (b.x, b.y)


def visible(r: tuple, page) -> list[float]:
    """A rectangle in the frame a reader sees -- same convention as `vector-labels.json`."""
    import pymupdf
    return [round(v, 2) for v in tuple(pymupdf.Rect(r) * page.rotation_matrix)]


def assemble(page) -> dict | None:
    """The structure of one qualifying page, or None if it does not qualify.

    Computed in the UNROTATED frame, where MuPDF reports both layers, and
    converted to the visible frame on the way out.
    """
    blocks = [b for b in page.get_text("dict")["blocks"] if b.get("type") == 0]
    captions = caption_candidates(blocks)
    drawings = page.get_drawings()
    if not captions or not drawings:
        return None

    # The page rectangle in the UNROTATED frame the drawings are reported in.
    pr = tuple((page.rect * page.derotation_matrix).normalize())
    page_area = area(pr)
    lines = []
    for b in blocks:
        for line in b.get("lines", []):
            text = line_text(line)
            if text:
                x0, y0, x1, y1 = line["bbox"]
                lines.append({"text": text, "bbox": (x0, y0, x1, y1), "c": ((x0 + x1) / 2, (y0 + y1) / 2)})

    # A page background joins nothing. "Covers the whole page" is a fact about
    # the rectangle, not a fraction somebody picked.
    background = [i for i, d in enumerate(drawings) if area(tuple(d["rect"])) >= page_area]
    live = [i for i in range(len(drawings)) if i not in set(background)]
    rects = [tuple(drawings[i]["rect"]) for i in live]
    comps = [[live[k] for k in comp] for comp in components(rects)]
    comp_rect = [union([tuple(drawings[i]["rect"]) for i in comp]) for comp in comps]

    # Labels to the SMALLEST containing component, so a component that sits
    # inside another's bounding box (a ring of arrows round a box) keeps its own.
    label_comp: list[int | None] = []
    for lab in lines:
        hits = [k for k, r in enumerate(comp_rect) if contains(r, *lab["c"])]
        label_comp.append(min(hits, key=lambda k: area(comp_rect[k])) if hits else None)

    labelled = sorted({k for k in label_comp if k is not None})

    # A component on the page's TRIM EDGE is left out of the crop when anything
    # else is labelled. `9789240093362-eng` runs a column of chapter tabs down
    # the page edge -- `Introduction`, `Scale-up`, `Annexes`, each a labelled
    # box at x = 0 -- and with them in the union every one of its fifteen
    # renders was the whole page. Touching the boundary is a fact about the
    # rectangle, like the dot leader the labels arm uses, not a distance
    # somebody picked. The cost is stated: a figure that bleeds off the page
    # beside a tab would be cropped out, and `outside` would count its labels.
    # When EVERY labelled component is on the edge, all of them are kept --
    # better a whole page than no render.
    # Compared at the 2-decimal precision every coordinate is RECORDED in: the
    # right-hand tabs end at 595.2759 on a page 595.2760 wide, a float-rounding
    # gap, not a margin. Rounding to the sidecar's own precision is a fact
    # about the record, not a tolerance fitted to the corpus.
    def at_edge(r: tuple) -> bool:
        a, p = [round(v, 2) for v in r], [round(v, 2) for v in pr]
        return a[0] <= p[0] or a[1] <= p[1] or a[2] >= p[2] or a[3] >= p[3]

    inner = [k for k in labelled if not at_edge(comp_rect[k])]
    cropped = inner or labelled
    region = union([comp_rect[k] for k in cropped]) if cropped else None

    # Closed shapes holding at least one label. Unlabelled closed shapes
    # (arrowheads, bullets, swatches) are counted, not listed: they relate
    # nothing a reader can name, and listing them is noise the size of the page.
    closed = [i for i in live if is_closed(drawings[i])]
    label_box: list[int | None] = []
    for lab in lines:
        hits = [i for i in closed if contains(tuple(drawings[i]["rect"]), *lab["c"])]
        label_box.append(min(hits, key=lambda i: area(tuple(drawings[i]["rect"]))) if hits else None)
    box_ids = sorted({i for i in label_box if i is not None})
    box_index = {i: n for n, i in enumerate(box_ids)}

    boxes = []
    for i in box_ids:
        r = tuple(drawings[i]["rect"])
        # Parent: the smallest OTHER labelled shape whose rectangle holds this
        # one's -- nesting as the drawing states it, by containment.
        parents = [
            j for j in box_ids
            if j != i and area(tuple(drawings[j]["rect"])) > area(r)
            and contains(tuple(drawings[j]["rect"]), r[0], r[1]) and contains(tuple(drawings[j]["rect"]), r[2], r[3])
        ]
        parent = min(parents, key=lambda j: area(tuple(drawings[j]["rect"]))) if parents else None
        boxes.append({
            "id": f"b{box_index[i]}",
            "bbox": visible(r, page),
            "parent": None if parent is None else f"b{box_index[parent]}",
            "labels": [lab["text"] for lab, bx in zip(lines, label_box) if bx == i],
        })

    def attach(x: float, y: float, grow: float) -> str | None:
        hits = [i for i in box_ids if contains(tuple(drawings[i]["rect"]), x, y, grow)]
        if not hits:
            return None
        return f"b{box_index[min(hits, key=lambda i: area(tuple(drawings[i]['rect'])))]}"

    connectors = []
    for i in live:
        d = drawings[i]
        if is_closed(d):
            continue
        ends = endpoints(d)
        if ends is None:
            continue
        grow = (d.get("width") or 0.0) / 2
        a, b = attach(*ends[0], grow), attach(*ends[1], grow)
        # A stroke wholly inside one box is that box's border or a rule in it,
        # not a relation between two things.
        if a is not None and a == b:
            continue
        connectors.append({"from": a, "to": b, "bbox": visible(tuple(d["rect"]), page)})

    groups = []
    for k in labelled:
        groups.append({
            "bbox": visible(comp_rect[k], page),
            "drawings": len(comps[k]),
            "pageEdge": at_edge(comp_rect[k]),
            "rendered": k in cropped,
            "labels": [lab["text"] for lab, c in zip(lines, label_comp) if c == k],
        })

    between = [
        lab["text"] for lab, c in zip(lines, label_comp)
        if c is None and region is not None and contains(region, *lab["c"])
    ]
    # Labels OUTSIDE the rendered region. Counted, because they are the crop's
    # known limit: `9789240010567-eng` page 25 titles its three architectures
    # (`SILOED`, `INTEGRATED`, ...) in white space ABOVE the drawn boxes, so
    # they sit in no component and outside the crop -- alongside the running
    # head and caption, which belong outside. Telling those apart is the
    # figure-vs-furniture call this arm refuses, so the number is reported and
    # the inspector, who sees the page, says what is missing.
    outside = 0 if region is None else sum(1 for lab in lines if not contains(region, *lab["c"]))
    seen_labels: list[str] = []
    for c in captions:
        m = LABEL.match(c)
        if m and m.group(1) not in seen_labels:
            seen_labels.append(m.group(1))

    return {
        "region": region,
        "entry": {
            "page": page.number + 1,
            "rotation": page.rotation,
            "captionLabels": seen_labels,
            "region": None if region is None else visible(region, page),
            "assembly": {
                "drawings": len(drawings),
                "background": len(background),
                "groups": groups,
                "boxes": boxes,
                "unlabelledClosedShapes": len([i for i in closed if i not in box_index]),
                "connectors": connectors,
                "between": between,
                "outside": outside,
            },
        },
    }


def undetermined(doc_id: str, reason: str) -> dict:
    return {"$schema": SCHEMA, "doc_id": doc_id, "figures": None, "undetermined_reason": reason}


def extract(pdf: Path, outdir: Path, dry_run: bool) -> dict:
    """The sidecar body. Returns `figures: None` rather than lying about absence."""
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

    figures: list[dict] = []
    characters = 0
    for index in range(doc.page_count):
        page = doc[index]
        try:
            characters += len(page.get_text("text").strip())
            found = assemble(page)
        except Exception as exc:  # noqa: BLE001
            # One unreadable page makes the run partial, and a partial run that
            # reported itself complete would hide exactly the page it skipped.
            return undetermined(doc_id, f"page {index + 1} of {pdf.name} could not be assembled: {exc}")
        if found is None:
            continue
        entry = found["entry"]
        fid = f"vfig-p{index + 1:03d}"
        rel = f"figures/{fid}.png" if found["region"] is not None else None
        out = {
            "id": fid,
            "file": rel,
            # NEVER a role from here -- see the module docstring. `undetermined`
            # with a basis that names this script: who looked, and that it
            # assigned nothing.
            "role": "undetermined",
            "basis": {
                "method": "assembly",
                "by": {"kind": "script", "id": SCRIPT_ID},
                "page": index + 1,
            },
            **entry,
        }
        if rel is None:
            out["unrendered_reason"] = (
                "no drawing component on this page contains a text line, so there is no "
                "labelled region to render -- the caption candidates are recorded and nothing "
                "is claimed about what the page draws"
            )
        figures.append(out)
        if rel is not None and not dry_run:
            target = outdir / doc_id / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            # `get_pixmap`'s clip is in the VISIBLE frame (`page.rect`), while
            # the region was computed in the unrotated one. Passing the
            # unrotated rectangle cropped every landscape page of
            # `9789240010567-eng` to the wrong quarter -- checked by eye on
            # page 25, not assumed.
            clip = pymupdf.Rect(entry["region"])
            try:
                page.get_pixmap(clip=clip, dpi=RENDER_DPI).save(target)
            except Exception as exc:  # noqa: BLE001
                # The ENTRY stands and says so; a render that failed is not a
                # page with no figure.
                out["file"] = None
                out["unrendered_reason"] = f"render failed: {exc}"

    if not figures and characters == 0:
        return undetermined(
            doc_id,
            f"{pdf.name} carries no extractable text on any of its {doc.page_count} page(s), so no "
            "caption could be read. This is NOT 'the document draws no figures': it is a scan.",
        )
    return {"$schema": SCHEMA, "doc_id": doc_id, "figures": figures}


def summarise(sidecar: dict) -> str:
    figs = sidecar.get("figures")
    if figs is None:
        return f"UNDETERMINED — {sidecar.get('undetermined_reason', 'no reason given')}"
    if not figs:
        return "0 caption pages over a vector layer (determined)"
    rendered = sum(1 for f in figs if f["file"])
    conn = sum(len(f["assembly"]["connectors"]) for f in figs)
    joined = sum(1 for f in figs for c in f["assembly"]["connectors"] if c["from"] and c["to"])
    # Rendered and related are reported; no role is, because none was assigned.
    return (
        f"{len(figs)} caption page(s), {rendered} rendered, {conn} open stroke(s) "
        f"of which {joined} join two labelled shapes; every role undetermined until inspected"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pdf", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=Path("library"),
                    help="library root; the sidecar lands in <out>/<doc-id>/")
    ap.add_argument("--dry-run", action="store_true", help="assemble and report, writing nothing")
    ap.add_argument("--json", action="store_true", help="emit the sidecar to stdout")
    args = ap.parse_args()

    if not args.pdf.exists():
        print(f"{args.pdf}: no such file", file=sys.stderr)
        return 1

    sidecar = extract(args.pdf, args.out, args.dry_run)
    print(f"{args.pdf.name}: {summarise(sidecar)}", file=sys.stderr if args.json else sys.stdout)
    if args.json:
        print(json.dumps(sidecar, ensure_ascii=False))
    if args.dry_run:
        return 0 if sidecar["figures"] is not None else 2

    target = args.out / sidecar["doc_id"] / "vector-figures.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"  wrote {target}")
    return 0 if sidecar["figures"] is not None else 2


if __name__ == "__main__":
    sys.exit(main())
