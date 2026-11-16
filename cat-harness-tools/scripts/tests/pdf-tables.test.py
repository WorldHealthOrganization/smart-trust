#!/usr/bin/env python3
"""
Regression test for `pdf-tables.py`'s judgement layer.

The extraction itself belongs to pdfplumber or camelot and is not retested
here. What *is* this repo's is everything decided after a backend hands back
cells: whether two page-split fragments are one table, which line is a
caption, how a cell matrix becomes a GFM table that
`pipeline/render-latex.ts` can turn into a `tabular`. Those are the
decisions that can be silently wrong, and a wrong one is expensive in a
specific way — **a bad stitch welds two unrelated tables into a single
plausible-looking one**, and nothing downstream can detect that the rows
under a header did not come from under that header.

So the cases below are the refusals as much as the successes. Every guard in
`stitch()` has a case that would pass without it:

  * consecutive pages only        -> `stitch refuses a one-page gap`
  * column geometry must match    -> `stitch refuses different column counts`
                                     and `... edges beyond tolerance`
  * a differently-numbered caption
    means a new table             -> `stitch refuses across a caption change`

`reading order is not bbox[1]` is the one that guards a bug already made
once: pdfplumber reports top-down coordinates and camelot bottom-up, so
ordering fragments on the raw bbox reads a camelot page upwards and stitches
the last table on a page onto the first of the next.

Standalone by design — it execs the script's pure section rather than
importing it, so it runs with neither backend installed, which is the state
CI runs in (`code-quality-gates.yml`, "Python tests").

Run: python3 scripts/tests/pdf-tables.test.py
"""

from __future__ import annotations

import os
import re
import sys
from typing import Any, Iterable

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(HERE), "pdf-tables.py")


def load() -> dict:
    src = open(SCRIPT, encoding="utf-8").read()
    start = src.index("MIN_CHARS_PER_PAGE = ")
    end = src.index("# ---------------------------------------------------------------- backends")
    ns: dict = {"re": re, "Any": Any, "Iterable": Iterable, "annotations": None}
    exec(compile(src[start:end], SCRIPT, "exec"), ns)
    return ns


M = load()

FAILED: list[str] = []
RAN = 0


def check(what: str, got: Any, want: Any) -> None:
    global RAN
    RAN += 1
    if got == want:
        print(f"  ok   {what}")
    else:
        FAILED.append(what)
        print(f"  FAIL {what}")
        print(f"         got:  {got!r}")
        print(f"         want: {want!r}")


def table(tid: str, page: int, rows: list[list[str]], edges: list[float],
          caption: str | None = None, sort_y: float = 100.0,
          bbox: list[float] | None = None) -> dict:
    """A backend's output for one table.

    `bbox` defaults to a top-down box agreeing with `sort_y`, which is the
    pdfplumber shape. The reading-order case passes a bottom-up `bbox` that
    *disagrees* with `sort_y` — that disagreement is the entire camelot
    hazard, and a fixture where the two agree cannot detect it.
    """
    return {"id": tid, "pages": [page],
            "bbox": bbox if bbox is not None else [60.0, sort_y, 552.0, sort_y + 80],
            "col_edges": edges, "rows": rows, "n_rows": len(rows),
            "n_cols": len(rows[0]) if rows else 0, "caption": caption,
            "caption_source": "below" if caption else "none", "_sort_y": sort_y}


HDR = ["Date", "Description", "Debit", "Credit"]
P1 = [HDR, ["2026-01-01", "Payment 1", "10.00", "0.00"]]
P2 = [HDR, ["2026-02-01", "Transfer 1", "0.00", "7.00"]]
EDGES = [60.0, 200.0, 330.0, 450.0]


# ------------------------------------------------------------------ cleaning

# `None` is what every backend returns for a cell it could not read, and a
# wrapped cell carries the newline that wrapped it. Both reach the Markdown,
# where a raw newline ends the pipe row early and silently reshapes the table.
check("normalize_rows fills None and flattens wrapped cells",
      M["normalize_rows"]([["a", None], ["multi\nline", "b  c"]]),
      [["a", ""], ["multi line", "b c"]])

check("normalize_rows drops an all-empty trailing column",
      M["normalize_rows"]([["a", "b", ""], ["c", "d", ""]]),
      [["a", "b"], ["c", "d"]])

check("normalize_rows drops leading and trailing blank rows",
      M["normalize_rows"]([["", ""], ["a", "b"], [None, None]]),
      [["a", "b"]])

check("normalize_rows pads a ragged row rather than dropping its cells",
      M["normalize_rows"]([["a", "b", "c"], ["d"]]),
      [["a", "b", "c"], ["d", "", ""]])

# A cell containing a pipe is not exotic — units and ranges use them — and an
# unescaped one adds a column to that row only, so the table renders skewed
# rather than failing.
check("to_gfm escapes a pipe inside a cell",
      M["to_gfm"]([["a|b", "c"], ["d", "e"]]).splitlines()[0],
      "| a\\|b | c |")

check("to_gfm emits the header separator GFM requires",
      M["to_gfm"]([["a", "b"], ["c", "d"]]).splitlines()[1],
      "|---|---|")

check("to_gfm on no rows is empty, not a header of nothing",
      M["to_gfm"]([]), "")


# ------------------------------------------------------------------ captions

LINES = [
    ("Some body text that refers to Table 3 in passing.", 10.0, 20.0),
    ("Table 1: Account activity.", 190.0, 200.0),
    ("Figure 2. A chart of the above.", 400.0, 410.0),
]
BBOX = (60.0, 90.0, 552.0, 180.0)   # x0, top, x1, bottom

check("caption is found below the table",
      M["detect_caption"](LINES, BBOX), ("Table 1: Account activity.", "below"))

# The prose line sits above the table and contains "Table 3". Matching it
# would caption this table with a reference to a different one.
check("a body line merely mentioning a table is not its caption",
      M["detect_caption"]([LINES[0]], BBOX), (None, "none"))

check("caption above is used when there is none below",
      M["detect_caption"]([("Table 4: Above it.", 40.0, 50.0)], BBOX),
      ("Table 4: Above it.", "above"))

check("a caption beyond the band is not claimed",
      M["detect_caption"]([("Table 9: Far below.", 400.0, 410.0)], BBOX),
      (None, "none"))

check("caption_number reads the numeral", M["caption_number"]("Table 12: x"), "12")
check("caption_number on an uncaptioned table is None", M["caption_number"](None), None)


# ------------------------------------------------------------------ geometry

check("columns_compatible accepts sub-tolerance drift",
      M["columns_compatible"]([60.0, 200.0], [61.0, 199.5], 2.0), True)
check("columns_compatible rejects drift beyond tolerance",
      M["columns_compatible"]([60.0, 200.0], [66.0, 200.0], 2.0), False)
check("columns_compatible rejects a different column count",
      M["columns_compatible"]([60.0, 200.0], [60.0, 200.0, 330.0], 2.0), False)
check("columns_compatible rejects an empty edge list",
      M["columns_compatible"]([], [], 2.0), False)


# ------------------------------------------------------------------ stitching

st = M["stitch"]([table("t1", 1, P1, EDGES, "Table 1: Account activity."),
                  table("t2", 2, P2, EDGES)])
check("stitch joins a table continued on the next page", len(st), 1)
check("stitch drops the header repeated on the continuation",
      st[0]["rows"], [HDR, P1[1], P2[1]])
check("stitch records both pages", st[0]["pages"], [1, 2])
check("stitch records what it merged", st[0]["stitched_from"], ["t1", "t2"])
check("stitch keeps n_rows consistent with the merged rows", st[0]["n_rows"], 3)

check("stitch refuses a one-page gap",
      len(M["stitch"]([table("t1", 1, P1, EDGES), table("t2", 3, P2, EDGES)])), 2)

check("stitch refuses different column counts",
      len(M["stitch"]([table("t1", 1, P1, EDGES),
                       table("t2", 2, [["a", "b"]], [60.0, 200.0])])), 2)

check("stitch refuses column edges beyond tolerance",
      len(M["stitch"]([table("t1", 1, P1, EDGES),
                       table("t2", 2, P2, [90.0, 230.0, 360.0, 480.0])])), 2)

# Identical geometry, but the continuation announces itself as Table 2.
check("stitch refuses across a caption change",
      len(M["stitch"]([table("t1", 1, P1, EDGES, "Table 1: First."),
                       table("t2", 2, P2, EDGES, "Table 2: A different table.")])), 2)

# A continuation whose first row is real data, not a repeated header, keeps it.
st2 = M["stitch"]([table("t1", 1, P1, EDGES),
                   table("t2", 2, [["2026-02-01", "Transfer 1", "0.00", "7.00"]], EDGES)])
check("stitch keeps a continuation's first row when it is data",
      st2[0]["rows"], [HDR, P1[1], ["2026-02-01", "Transfer 1", "0.00", "7.00"]])

# The bug this guards: camelot reports bottom-up coordinates, so its `_sort_y`
# is `-y1`. Two tables on page 1 — `upper` with one column layout, `lower`
# (which runs off the bottom of the page) with another — and a continuation on
# page 2 carrying `lower`'s layout.
#
# Only the *last* table on a page can continue onto the next, because nothing
# can follow it there. So `stitch` compares a fragment against the last table
# it emitted, and the whole question is which of `upper`/`lower` that is.
# Ordered correctly, it is `lower`, and the stitch happens. Ordered on the raw
# bbox, a bottom-up backend reads the page upwards, `upper` lands last, its
# columns do not match, and the continuation is stranded as a third table.
# Bottom-up bboxes, as camelot reports them: y0 grows *upward*, so the table
# high on the page has the LARGER bbox[1]. `_sort_y` is -y1, which restores
# reading order. The two disagree, which is what makes this case discriminate.
upper = table("upper", 1, [["x", "y", "z", "w"]], [10.0, 20.0, 30.0, 40.0],
              sort_y=-780.0, bbox=[60.0, 700.0, 552.0, 780.0])
lower = table("lower", 1, P1, EDGES,
              sort_y=-280.0, bbox=[60.0, 200.0, 552.0, 280.0])
cont = table("cont", 2, P2, EDGES,
             sort_y=-780.0, bbox=[60.0, 700.0, 552.0, 780.0])
stitched = M["stitch"]([lower, cont, upper])
check("reading order is not bbox[1] — a bottom-up backend still stitches right",
      (len(stitched), [t["id"] for t in stitched], stitched[-1].get("stitched_from")),
      (2, ["upper", "lower"], ["lower", "cont"]))

check("stitch on nothing returns nothing", M["stitch"]([]), [])

check("looks_like_repeated_header ignores case and padding",
      M["looks_like_repeated_header"](["Date ", "DEBIT"], ["date", "Debit"]), True)
check("looks_like_repeated_header rejects a different width",
      M["looks_like_repeated_header"](["Date"], ["Date", "Debit"]), False)


# ------------------------------------------------------------------ clusters

# Two separated blobs of drawing primitives are two figure candidates, not one
# bbox spanning the whitespace between them.
boxes = [(10, 10, 20, 20), (18, 18, 30, 30),        # blob A (touching)
         (400, 400, 410, 410), (405, 405, 420, 420)]  # blob B
clusters = M["cluster_boxes"](boxes, 6.0)
check("cluster_boxes separates two blobs", len(clusters), 2)
check("cluster_boxes merges the bbox of a blob", clusters[0][0], (10, 10, 30, 30))
check("cluster_boxes counts the primitives it merged", clusters[0][1], 2)
check("cluster_boxes on nothing returns nothing", M["cluster_boxes"]([], 6.0), [])


# ---------------------------------------------------------------- attribution

SECTIONS = [{"id": "sec-001-intro", "page_start": 1, "page_end": 3},
            {"id": "sec-002-method", "page_start": 4, "page_end": 9},
            {"id": "sec-003-last", "page_start": 10, "page_end": None}]
check("a table is attributed to the section containing its page",
      M["section_for_page"](SECTIONS, 5), "sec-002-method")
check("a section with no page_end still claims its start page",
      M["section_for_page"](SECTIONS, 10), "sec-003-last")
check("a page past every section is attributed to none, not to the last",
      M["section_for_page"]([SECTIONS[0]], 99), None)


if __name__ == "__main__":
    print(f"\n  {RAN - len(FAILED)}/{RAN} passed")
    sys.exit(1 if FAILED else 0)
