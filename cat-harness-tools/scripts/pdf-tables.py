#!/usr/bin/env python3
"""
pdf-tables — the deterministic table and figure rung.

WHY THIS EXISTS.  `pdf-structure/v1`'s `Section` carries `id`, `number`,
`title`, `level`, `page_start`, `page_end`, `n_chars`, `n_words`, `text` — and
nothing else.  No tables, no figures, no bounding boxes.
`docs/proposals/rag-document-ingestion.md` §12 opens by naming that as the
schema's central defect, and it is not cosmetic: a GRADE evidence table or a
boxed WHO recommendation is a *layout* fact, and a text extractor flattens it
into a run of prose that reads exactly like prose.  Once flattened, no
downstream consumer can tell that the numbers it is reading were a 4x7 grid.

WHY NOT DOCLING, WHICH IS THE BETTER PARSER.  This does not replace it.
Docling's layout, TableFormer and formula weights are fetched from HuggingFace
on first use, and both `huggingface.co` and `cdn-lfs.huggingface.co` answer

    curl: (56) CONNECT tunnel failed, response 403

here — re-measured 2026-08-26, eleven days after §2a first recorded it, with
`pypi.org` answering 200 in the same sweep.  `pip install docling` therefore
succeeds and the *first parse* is what fails.  That makes Docling a
workstation/CI stage whose artefacts get committed (§10 Stage 3), and makes
this the rung that runs in the sandboxed sessions where most agent work
happens.  Both backends below are pure-Python-plus-wheels: no weights, no
egress at all after the install.

THE AMBIGUITY THIS EXISTS TO KILL.  An empty `tables[]` has three completely
different meanings — "this document has no tables", "no backend was
installed", and "this is a scan, so its tables are pixels" — and §5's contract
is *absent tool => n/a, never a false pass*.  So they are three different exit
codes, and in the artefact they are three different **shapes**:

    "tables": []      the backend looked and found none      status "ok"
    "tables": null    nothing looked                         status "n/a-*"

`null` is not `[]`.  A consumer that forgets to check `status` still cannot
read an unparsed document as an empty one, which is the whole point.

TWO BACKENDS, BOTH DELIBERATE.

  * **pdfplumber** (MIT) — the default.  Small, and it is already the tool
    `smart-base/skills/content/authoring-who-smart-guidelines/smart-base-tools.md` depends on, so
    it is not a new dependency for this platform so much as a second use of an
    existing one.
  * **camelot-py** (MIT) — preferred when installed.  Camelot **2.0** dropped
    Ghostscript to an optional extra (`camelot-py[ghostscript]`); the base
    install is numpy/pandas/opencv-headless/pypdfium2/playa-pdf and nothing
    else, verified importing and extracting offline here on 2026-08-26.  Its
    advantage over pdfplumber is not accuracy on a ruled grid — measured on the
    two-page fixture in `scripts/tests/pdf-tables.test.py` both return
    identical cells and identical column edges — but that it reports a
    per-table `parsing_report.accuracy`.  That number lands in `confidence`,
    and a consumer can weight by it.  pdfplumber offers no equivalent, so
    `confidence` is `null` there rather than invented.

STITCHING IS OURS, NOT THE BACKEND'S.  A table continuing across a page break
is extracted by every tool as two tables, because that is what is on the two
pages.  Rejoining them is a judgement about column geometry, and it is made
here — over `col_edges`, which both backends report identically — so it works
the same whichever backend ran.  Three guards, because a wrong stitch welds two
unrelated tables into one and is worse than not stitching:

  1. consecutive pages only;
  2. same column count, every edge within `--col-tol` points;
  3. a continuation that carries its own `Table N` caption with a *different*
     N is a new table, and is never stitched however well its columns line up.

A repeated header row on the continuation is dropped, and `stitched_from`
records what was merged so the decision is auditable rather than invisible.

WHAT IT DOES NOT DO.  It does not caption vector art it cannot name: a cluster
of drawing primitives is emitted as `kind: "vector-cluster"` with a primitive
count, explicitly a *candidate*, because deciding that fourteen curves are one
figure is exactly the judgement Docling's layout model exists to make.  It does
not read a scan.  It does not classify figures.  Those are Stage 3's, and the
capability probe in `cat-harness/scenarios/capabilities/docling.json` is what lets a
consumer see that Stage 3 has not run instead of guessing.

Usage:
    pdf-tables.py FILE.pdf -o uploads/<doc-id>/
    pdf-tables.py FILE.pdf --backend camelot     # force a backend
    pdf-tables.py FILE.pdf --no-stitch           # keep page-split tables apart
    pdf-tables.py --check                        # which backends are present

Exit codes:
    0  artefact written (`tables` may legitimately be `[]`)
    2  no text layer -- the tables here are pixels; use OCR or Docling
    3  a backend was present and failed
    4  bad usage / unreadable file
    5  no backend installed -- artefact written as n/a, `tables` is null
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from typing import Any, Iterable

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pypdf_compat import import_pdfplumber  # noqa: E402

SCHEMA = "pdf-tables/v1"

# A page yielding fewer characters than this is treated as having no text
# layer. Same rationale as pdf-extract.py's floor: scanned pages emit a
# handful of stray characters from page furniture, and counting those as text
# is how a pipeline "reads" an empty document.
MIN_CHARS_PER_PAGE = 40

# How far above/below a table or figure to look for its caption, in points.
CAPTION_BAND_PT = 72.0

# Default tolerance when comparing column edges across a page break, in points.
# Ruled grids reproduce edges exactly; 2pt absorbs rounding without being loose
# enough to match two genuinely different layouts.
COL_TOL_PT = 2.0

CAPTION_RE = re.compile(
    r"^\s*(?P<kind>table|tab\.|figure|fig\.?|chart|exhibit)\s*"
    r"(?P<num>[0-9]+(?:\.[0-9]+)*|[IVXLC]+|[A-Z](?:\.[0-9]+)?)?\s*[.:)—-]?\s*(?P<rest>.*)$",
    re.IGNORECASE,
)


# ------------------------------------------------------------------ pure bits
# Everything below this line takes plain data and returns plain data, so
# scripts/tests/pdf-tables.test.py can exercise it with neither backend
# installed -- which is the state CI runs in.


def normalize_rows(rows: Iterable[Iterable[Any]]) -> list[list[str]]:
    """Cell matrix -> rectangular matrix of clean strings.

    Backends return `None` for a cell an extraction missed and embed the
    newlines of a wrapped cell verbatim. Both reach the artefact and then the
    Markdown, where a raw newline silently breaks the pipe table.
    """
    out: list[list[str]] = []
    for row in rows:
        out.append([re.sub(r"\s+", " ", (c or "")).strip() for c in row])
    while out and not any(out[-1]):
        out.pop()
    while out and not any(out[0]):
        out.pop(0)
    if not out:
        return []
    width = max(len(r) for r in out)
    for r in out:
        r.extend([""] * (width - len(r)))
    # Drop trailing columns that are empty in every row.
    while width > 1 and all(not r[width - 1] for r in out):
        for r in out:
            r.pop()
        width -= 1
    return out


def to_gfm(rows: list[list[str]]) -> str:
    """Render a cell matrix as a GFM pipe table.

    GFM specifically, and not CSV, because `pipeline/render-latex.ts`
    already converts a GFM table node to `\\begin{tabular}` with booktabs. So a
    table extracted here can be pasted into a content block and rendered by
    machinery that exists, with no new converter in between.
    """
    if not rows:
        return ""
    esc = lambda c: c.replace("\\", "\\\\").replace("|", "\\|")  # noqa: E731
    head, *body = rows
    lines = ["| " + " | ".join(esc(c) for c in head) + " |",
             "|" + "|".join("---" for _ in head) + "|"]
    for r in body:
        lines.append("| " + " | ".join(esc(c) for c in r) + " |")
    return "\n".join(lines)


def detect_caption(
    lines: list[tuple[str, float, float]],
    bbox: tuple[float, float, float, float],
    band: float = CAPTION_BAND_PT,
) -> tuple[str | None, str]:
    """Find the caption for a region.

    `lines` is `(text, top, bottom)` in PDF-viewer coordinates (top-down, as
    pdfplumber reports them). `bbox` is `(x0, top, x1, bottom)`.

    Below is checked before above, because that is where table and figure
    captions overwhelmingly sit in the journal and guideline PDFs this corpus
    is made of. A line only counts as a caption if it *starts* with a caption
    word -- a body-text line that happens to mention "Table 3" is a reference
    to a table, not the caption of this one.
    """
    x0, top, x1, bottom = bbox
    below = [(t, tp) for (t, tp, bt) in lines if bottom <= tp <= bottom + band]
    above = [(t, tp) for (t, tp, bt) in lines if top - band <= bt <= top]
    for cand, where in ((sorted(below, key=lambda p: p[1]), "below"),
                        (sorted(above, key=lambda p: -p[1]), "above")):
        for text, _ in cand:
            if CAPTION_RE.match(text) and text.strip():
                return text.strip(), where
    return None, "none"


def caption_number(caption: str | None) -> str | None:
    """The `N` of `Table N` — used to refuse a stitch across a caption change."""
    if not caption:
        return None
    m = CAPTION_RE.match(caption)
    if not m:
        return None
    num = m.group("num")
    return num.upper() if num else None


def columns_compatible(a: list[float], b: list[float], tol: float = COL_TOL_PT) -> bool:
    """Do two tables share a column layout?"""
    if not a or not b or len(a) != len(b):
        return False
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def looks_like_repeated_header(first: list[str], header: list[str]) -> bool:
    """Is this continuation's first row a repeat of the header above it?"""
    if not first or not header or len(first) != len(header):
        return False
    norm = lambda r: [c.strip().casefold() for c in r]  # noqa: E731
    return norm(first) == norm(header)


def stitch(tables: list[dict[str, Any]], tol: float = COL_TOL_PT) -> list[dict[str, Any]]:
    """Rejoin tables split by a page break. See the module docstring's three guards."""
    if not tables:
        return []
    # `_sort_y` and not `bbox[1]`: pdfplumber reports top-down coordinates and
    # camelot bottom-up, so ordering on the raw bbox would read one of the two
    # backends' pages upwards -- and a mis-ordered page is a mis-stitched table.
    ordered = sorted(tables, key=lambda t: (min(t["pages"]), t.get("_sort_y", t["bbox"][1])))
    out: list[dict[str, Any]] = []
    # Each fragment is compared against the last table emitted, and that is
    # sufficient rather than lazy: only the *last* table on a page can continue
    # onto the next, because anything below it on that page would be after the
    # continuation. So the sort above is what makes this correct, and getting
    # the sort wrong is what makes it silently wrong.
    for t in ordered:
        prev = out[-1] if out else None
        if (
            prev is not None
            and max(prev["pages"]) + 1 == min(t["pages"])
            and columns_compatible(prev.get("col_edges") or [], t.get("col_edges") or [], tol)
            # Guard 3: a continuation naming a different table is a new table.
            and not (
                caption_number(t.get("caption"))
                and caption_number(prev.get("caption"))
                and caption_number(t.get("caption")) != caption_number(prev.get("caption"))
            )
        ):
            rows = list(t["rows"])
            if rows and looks_like_repeated_header(rows[0], prev["rows"][0] if prev["rows"] else []):
                rows = rows[1:]
            prev["rows"] = prev["rows"] + rows
            prev["pages"] = sorted(set(prev["pages"]) | set(t["pages"]))
            prev["stitched_from"] = prev.get("stitched_from", [prev["id"]]) + [t["id"]]
            prev["n_rows"] = len(prev["rows"])
            if not prev.get("caption") and t.get("caption"):
                prev["caption"], prev["caption_source"] = t["caption"], t["caption_source"]
            continue
        out.append(dict(t))
    return out


def cluster_boxes(
    boxes: list[tuple[float, float, float, float]], pad: float = 6.0
) -> list[tuple[tuple[float, float, float, float], int]]:
    """Group overlapping (or near-touching) boxes into connected components.

    Returns `(merged_bbox, n_primitives)` per component. Union-find over
    `pad`-expanded boxes: two drawing primitives belong to the same figure when
    their ink is adjacent, which is a weaker claim than "these form a chart"
    and is exactly why the output is labelled a candidate.
    """
    n = len(boxes)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[rj] = ri

    def touches(a: tuple[float, ...], b: tuple[float, ...]) -> bool:
        return not (
            a[2] + pad < b[0] or b[2] + pad < a[0] or a[3] + pad < b[1] or b[3] + pad < a[1]
        )

    for i in range(n):
        for j in range(i + 1, n):
            if touches(boxes[i], boxes[j]):
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)

    out = []
    for members in groups.values():
        xs0 = min(boxes[i][0] for i in members)
        ts = min(boxes[i][1] for i in members)
        xs1 = max(boxes[i][2] for i in members)
        bs = max(boxes[i][3] for i in members)
        out.append(((xs0, ts, xs1, bs), len(members)))
    return sorted(out, key=lambda g: (g[0][1], g[0][0]))


def section_for_page(sections: list[dict[str, Any]], page: int) -> str | None:
    """Which `structure.json` section contains this page."""
    for s in sections:
        ps, pe = s.get("page_start"), s.get("page_end")
        if ps is None:
            continue
        if ps <= page <= (pe if pe is not None else ps):
            return s.get("id")
    return None


# ---------------------------------------------------------------- backends


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def import_camelot():
    """Return the camelot module, or None. Never fatal — it is the optional rung."""
    try:
        import camelot
        return camelot
    except BaseException:
        # camelot drags numpy/opencv; a broken native wheel there raises things
        # that are not ImportError, and this rung is optional either way.
        return None


def available_backends() -> dict[str, str | None]:
    pp = import_pdfplumber()
    cm = import_camelot()
    return {
        "pdfplumber": getattr(pp, "__version__", "present") if pp else None,
        "camelot": getattr(cm, "__version__", "present") if cm else None,
    }


def extract_pdfplumber(
    pdfplumber, path: str
) -> tuple[list[dict], list[dict], dict, dict[int, dict]]:
    """pdfplumber backend: ruled grids first, then alignment for borderless ones.

    Returns the per-page line geometry as a fourth value. That is not for this
    backend's own use -- it already has it -- but for the camelot path, which
    models cells and never looks at page text, and so cannot caption anything
    without borrowing this.
    """
    tables: list[dict] = []
    figures: list[dict] = []
    stats = {"pages": 0, "text_chars": 0, "pages_with_text": 0}
    geometry: dict[int, dict] = {}

    with pdfplumber.open(path) as pdf:
        stats["pages"] = len(pdf.pages)
        for pn, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            stats["text_chars"] += len(text)
            if len(text.strip()) >= MIN_CHARS_PER_PAGE:
                stats["pages_with_text"] += 1

            lines = [
                (ln["text"], float(ln["top"]), float(ln["bottom"]))
                for ln in page.extract_text_lines()
            ] if hasattr(page, "extract_text_lines") else []
            geometry[pn] = {"lines": lines, "height": float(page.height)}

            found: list[Any] = []
            for strategy, settings in (
                ("lines", {"vertical_strategy": "lines", "horizontal_strategy": "lines"}),
                ("text", {"vertical_strategy": "text", "horizontal_strategy": "text"}),
            ):
                try:
                    ts = page.find_tables(settings)
                except Exception:
                    ts = []
                for t in ts:
                    # A `text`-strategy hit covering the same ground as a
                    # `lines` hit is the same table found twice, and the ruled
                    # reading is the better one. Keep the first.
                    if any(_overlaps(t.bbox, o.bbox) for o in found):
                        continue
                    found.append(t)
                    rows = normalize_rows(t.extract() or [])
                    if not rows:
                        continue
                    bbox = tuple(float(v) for v in t.bbox)
                    caption, csrc = detect_caption(lines, bbox)
                    tables.append({
                        "id": f"tab-p{pn:03d}-{len(tables) + 1:03d}",
                        "pages": [pn],
                        "bbox": [round(v, 1) for v in bbox],
                        "bbox_origin": "top-left",
                        "col_edges": sorted({round(float(c[0]), 1) for c in t.cells}),
                        "n_rows": len(rows),
                        "n_cols": len(rows[0]),
                        "strategy": strategy,
                        "confidence": None,   # pdfplumber reports none; see docstring
                        "rows": rows,
                        "caption": caption,
                        "caption_source": csrc,
                        "_sort_y": round(bbox[1], 1),
                    })

            for im in page.images:
                bbox = (float(im["x0"]), float(im["top"]), float(im["x1"]), float(im["bottom"]))
                caption, csrc = detect_caption(lines, bbox)
                figures.append({
                    "id": f"fig-p{pn:03d}-{len(figures) + 1:03d}",
                    "page": pn, "bbox": [round(v, 1) for v in bbox],
                    "bbox_origin": "top-left", "kind": "raster", "n_primitives": 1,
                    "caption": caption, "caption_source": csrc,
                })

            prims = [
                (float(o["x0"]), float(o["top"]), float(o["x1"]), float(o["bottom"]))
                for o in (page.curves + page.rects)
            ]
            # Rules that belong to a table are not figure ink.
            prims = [p for p in prims if not any(_overlaps(p, tuple(t["bbox"])) for t in tables
                                                 if t["pages"] == [pn])]
            for bbox, count in cluster_boxes(prims):
                if count < 4 or (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) < 2000:
                    continue
                caption, csrc = detect_caption(lines, bbox)
                figures.append({
                    "id": f"fig-p{pn:03d}-{len(figures) + 1:03d}",
                    "page": pn, "bbox": [round(v, 1) for v in bbox],
                    "bbox_origin": "top-left", "kind": "vector-cluster", "n_primitives": count,
                    "caption": caption, "caption_source": csrc,
                })
    return tables, figures, stats, geometry


def extract_camelot(camelot, path: str) -> tuple[list[dict], dict]:
    """camelot backend: lattice, then stream for borderless. Carries `accuracy`."""
    tables: list[dict] = []
    seen: list[tuple[int, tuple]] = []
    for flavor, strategy in (("lattice", "lines"), ("stream", "text")):
        try:
            found = camelot.read_pdf(path, pages="all", flavor=flavor)
        except Exception:
            continue
        for t in found:
            page = int(t.page)
            # camelot bbox is (x0, y0, x1, y1) bottom-up; convert to top-down.
            x0, y0, x1, y1 = (float(v) for v in t._bbox)
            bbox_bt = (x0, y0, x1, y1)
            if any(p == page and _overlaps(bbox_bt, b) for p, b in seen):
                continue
            seen.append((page, bbox_bt))
            rows = normalize_rows(t.df.values.tolist())
            if not rows:
                continue
            tables.append({
                "id": f"tab-p{page:03d}-{len(tables) + 1:03d}",
                "pages": [page],
                # Recorded bottom-up, as camelot reports it, and labelled so.
                "bbox": [round(v, 1) for v in bbox_bt],
                "bbox_origin": "bottom-left",
                "col_edges": sorted({round(float(c[0]), 1) for c in t.cols}),
                "n_rows": len(rows), "n_cols": len(rows[0]),
                "strategy": strategy,
                "confidence": round(float(t.parsing_report.get("accuracy", 0.0)), 1),
                "rows": rows, "caption": None, "caption_source": "none",
                "_sort_y": round(-y1, 1),
            })
    # camelot never walks pages it found no table on, so it cannot report page
    # counts. `None` and not `0`: a zero here would read as a measured fact.
    return tables, {"pages": None, "text_chars": None, "pages_with_text": None}


def caption_camelot_tables(tables: list[dict], geometry: dict[int, dict]) -> None:
    """Caption bottom-up camelot bboxes using pdfplumber's top-down line geometry.

    The flip is `top = height - y1`, and getting it backwards does not error --
    it silently searches the mirror-image band on the other end of the page and
    reports "no caption", which is why the fixture asserts a caption is found.
    """
    for t in tables:
        if t.get("bbox_origin") != "bottom-left":
            continue
        geo = geometry.get(min(t["pages"]))
        if not geo:
            continue
        x0, y0, x1, y1 = t["bbox"]
        h = geo["height"]
        caption, csrc = detect_caption(geo["lines"], (x0, h - y1, x1, h - y0))
        if caption:
            t["caption"], t["caption_source"] = caption, csrc


def _overlaps(a: tuple[float, ...], b: tuple[float, ...]) -> bool:
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


# -------------------------------------------------------------------- main


def load_structure(outdir: str) -> tuple[str | None, list[dict]]:
    """Read a sibling `structure.json` so tables can name the section they sit in."""
    p = os.path.join(outdir, "structure.json")
    if not os.path.exists(p):
        return None, []
    try:
        with open(p) as fh:
            art = json.load(fh)
        return art.get("doc_id"), art.get("sections") or []
    except Exception:
        return None, []


def build(path: str, outdir: str, backend: str, do_stitch: bool, col_tol: float) -> tuple[dict, int]:
    avail = available_backends()
    doc_id, sections = load_structure(outdir)
    base: dict[str, Any] = {
        "_schema": SCHEMA,
        "doc_id": doc_id or os.path.splitext(os.path.basename(path))[0],
        "source": {
            "file": os.path.basename(path),
            "sha256": sha256_of(path),
            "bytes": os.path.getsize(path),
        },
        "producer": {"backend": None, "backend_version": None,
                     "backends_available": {k: v for k, v in avail.items() if v}},
    }

    chosen = backend
    if chosen == "auto":
        chosen = "camelot" if avail["camelot"] else ("pdfplumber" if avail["pdfplumber"] else "none")
    if chosen != "none" and not avail.get(chosen):
        base["status"] = "n/a-no-backend"
        base["tables"], base["figures"] = None, None
        base["diagnostics"] = {"looked": False,
                               "reason": f"backend '{chosen}' requested but not installed"}
        return base, 5
    if chosen == "none":
        base["status"] = "n/a-no-backend"
        base["tables"], base["figures"] = None, None
        base["diagnostics"] = {
            "looked": False,
            "reason": "no table backend installed",
            "install": "pip install pdfplumber   # or: pip install camelot-py",
        }
        return base, 5

    base["producer"]["backend"] = chosen
    base["producer"]["backend_version"] = avail[chosen]

    if chosen == "pdfplumber":
        pp = import_pdfplumber()
        tables, figures, stats, _ = extract_pdfplumber(pp, path)
    else:
        cm = import_camelot()
        tables, stats = extract_camelot(cm, path)
        figures = []
        # camelot models cells, not page ink. Figures and captions both need
        # the pdfplumber pass; without it camelot's tables stay uncaptioned,
        # which is recorded rather than papered over.
        if avail["pdfplumber"]:
            _, figures, stats, geometry = extract_pdfplumber(import_pdfplumber(), path)
            caption_camelot_tables(tables, geometry)

    # Unknown page counts (camelot with no pdfplumber alongside) cannot support
    # a scan verdict, so none is made -- rather than defaulting to "not a scan".
    known = stats["pages"] is not None and stats["pages_with_text"] is not None
    scanned = bool(known and stats["pages"] > 0
                   and stats["pages_with_text"] < stats["pages"] * 0.5)
    if scanned and not tables:
        base["status"] = "n/a-no-text-layer"
        base["tables"], base["figures"] = None, None
        base["diagnostics"] = {
            "looked": True, "reason": "no text layer -- the tables here are pixels",
            "pages": stats["pages"], "pages_with_text": stats["pages_with_text"],
            "next": "scripts/pdf-ocr.py, or Docling where egress allows",
        }
        return base, 2

    if do_stitch:
        tables = stitch(tables, col_tol)

    for t in tables:
        t["section_id"] = section_for_page(sections, min(t["pages"])) if sections else None
        t["markdown"] = to_gfm(t["rows"])
        t.pop("_sort_y", None)
    for f in figures:
        f["section_id"] = section_for_page(sections, f["page"]) if sections else None

    base["status"] = "ok"
    base["tables"] = tables
    base["figures"] = figures
    base["diagnostics"] = {
        "looked": True,
        "pages": stats["pages"],
        "pages_with_text": stats["pages_with_text"],
        "likely_scanned": scanned if known else None,
        "tables": len(tables),
        "tables_stitched": sum(1 for t in tables if len(t.get("stitched_from", [])) > 1),
        "tables_multipage": sum(1 for t in tables if len(t["pages"]) > 1),
        "figures": len(figures),
        "captioned_tables": sum(1 for t in tables if t.get("caption")),
        "sections_source": "structure.json" if sections else "absent",
    }
    return base, 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="pdf-tables.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf", nargs="?", help="the PDF to read")
    ap.add_argument("-o", "--outdir", default=None,
                    help="where tables.json goes (default: beside the PDF)")
    ap.add_argument("--backend", choices=["auto", "pdfplumber", "camelot"], default="auto")
    ap.add_argument("--no-stitch", action="store_true",
                    help="keep page-split tables as separate tables")
    ap.add_argument("--col-tol", type=float, default=COL_TOL_PT,
                    help=f"column-edge tolerance in points when stitching (default {COL_TOL_PT})")
    ap.add_argument("--json", action="store_true", help="artefact to stdout instead of a file")
    ap.add_argument("--check", action="store_true", help="report which backends are present")
    args = ap.parse_args()

    if args.check:
        avail = available_backends()
        for name, ver in avail.items():
            print(f"{name:12} {'present ' + str(ver) if ver else 'ABSENT'}")
        if not any(avail.values()):
            print("\nNo table backend. Install either:")
            print("  pip install pdfplumber      # smaller; the default")
            print("  pip install camelot-py      # adds a per-table accuracy score")
            return 5
        return 0

    if not args.pdf:
        ap.error("a PDF is required (or --check)")
    if not os.path.isfile(args.pdf):
        print(f"pdf-tables.py: not a file: {args.pdf}", file=sys.stderr)
        return 4

    outdir = args.outdir or os.path.dirname(os.path.abspath(args.pdf))
    try:
        artefact, rc = build(args.pdf, outdir, args.backend, not args.no_stitch, args.col_tol)
    except Exception as exc:  # a present backend that fell over
        print(f"pdf-tables.py: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 3

    if args.json:
        print(json.dumps(artefact, indent=2))
    else:
        os.makedirs(outdir, exist_ok=True)
        dest = os.path.join(outdir, "tables.json")
        with open(dest, "w") as fh:
            json.dump(artefact, fh, indent=2)
        d = artefact["diagnostics"]
        print(f"{dest}  status={artefact['status']}", file=sys.stderr)
        if artefact["status"] == "ok":
            print(f"  tables={d['tables']} (multipage {d['tables_multipage']}, "
                  f"captioned {d['captioned_tables']})  figures={d['figures']}", file=sys.stderr)
        else:
            print(f"  {d['reason']}", file=sys.stderr)
    return rc


if __name__ == "__main__":
    sys.exit(main())
