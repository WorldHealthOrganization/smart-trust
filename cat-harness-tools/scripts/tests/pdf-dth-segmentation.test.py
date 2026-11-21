"""Splitting a WHO digital transformation handbook the same way every time.

Bean `6chd`, issue #1219. Every DTH L1 in litlfred/who-iris was re-split by
hand, because `pdf-structure.py` got three things wrong on them:

1. The printed contents of the product catalogue handbook (9789240116191-eng)
   lists its chapters only, and every chapter is a run of steps, each a large
   heading with a "STEP n" label beside it. The 18 steps were missing. A
   labelled step is now added beneath its contents chapter; a generic
   style-found subsection still is not.
2. The primary health care handbook's outline (9789240093362-eng) is flat and
   lists each chapter's sections last to first, with line breaks in titles.
   It is now put in page order, ties in the order the page prints them, and
   a nested outline is left alone.
3. Section text kept the running heads, footers, folios and side tabs at
   every page break. They are now stripped: margin lines that are a bare
   folio, or body-sized text at the same height on three or more pages.
   A folio is matched on its exact text, so "20" does not take a step's "1".

Scored against the hand-made keys (`fixtures/dth-toc-gold.json`, via
`toc-benchmark.py --gold`): title F1 0.65 -> 0.93 and TEDS 0.41 -> 0.89 over
the PC and PHC handbooks, with no change on the other 10 who-iris PDFs.

Synthetic `Line`s carry every case, so nothing here needs a PDF library.
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, SCRIPTS)

import _pdf_headings as H  # noqa: E402


def load(name: str):
    spec = importlib.util.spec_from_file_location(
        "_t_" + name.replace("-", "_").replace(".py", ""), os.path.join(SCRIPTS, name)
    )
    assert spec and spec.loader, name
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


PAGE_H, PAGE_W = 840.0, 595.0


def ln(page, y, text, size=9.0, bold=False, x0=65.0):
    return H.Line(page, text, size, bold, False, H._caps(text), "Source", 1.0,
                  x0, y, x0 + 5 * len(text), y + size * 1.2, PAGE_H, PAGE_W)


def body(page, y0, n=8):
    return [ln(page, y0 + 12 * i, "ordinary running text of the handbook goes on here and there") for i in range(n)]


def handbook() -> list:
    """A contents page listing two chapters, each a run of labelled steps."""
    lines = [ln(1, 300, "Digital transformation handbook", size=36)]
    lines += [ln(2, 60, "Contents", size=20),
              ln(2, 100, "Introduction 1", size=10),
              ln(2, 120, "01. Establishing regulatory policies 3", size=10),
              ln(2, 140, "02. Instituting data governance 6", size=10),
              ln(2, 160, "References 9", size=10),
              ln(2, 180, "Annexes 10", size=10)]
    lines += [ln(3, 100, "Introduction", size=40)] + body(3, 200)
    # Chapter 1 opens on page 5 (printed 3); its steps follow.
    lines += [ln(5, 120, "Establishing regulatory policies", size=40)] + body(5, 300)
    lines += [ln(6, 51, "STEP 1", bold=True), ln(6, 70, "Identify necessary regulatory", size=20),
              ln(6, 94, "policies and legislations", size=20)] + body(6, 140)
    lines += [ln(7, 51, "STEP 2", bold=True), ln(7, 70, "Develop the identified policies", size=20)] + body(7, 120)
    lines += [ln(7, 519, "STEP 3", bold=True), ln(7, 538, "Coordinate reviews and approvals", size=20)] + body(7, 580, 4)
    lines += [ln(8, 120, "Instituting data governance", size=40)] + body(8, 300)
    lines += [ln(9, 51, "STEP 1", bold=True), ln(9, 70, "Define master data procedures", size=20)] + body(9, 120)
    lines += [ln(10, 51, "STEP 2", bold=True), ln(10, 70, "Define the coding scheme", size=20)] + body(10, 120)
    lines += [ln(11, 100, "References", size=40)] + body(11, 200)
    lines += [ln(12, 100, "Annexes", size=40)] + body(12, 200)
    # Printed folios: page 3 is printed 1.
    lines += [ln(p, 800, str(p - 2), size=8) for p in range(3, 13)]
    return lines


def test_labelled_steps_under_their_contents_chapter():
    got = [(s.heading.level, s.heading.title, s.heading.page) for s in H.consensus_headings(handbook())]
    steps = [g for g in got if g[1].startswith("Step ")]
    assert steps == [
        (2, "Step 1. Identify necessary regulatory policies and legislations", 6),
        (2, "Step 2. Develop the identified policies", 7),
        (2, "Step 3. Coordinate reviews and approvals", 7),
        (2, "Step 1. Define master data procedures", 9),
        (2, "Step 2. Define the coding scheme", 10),
    ], steps
    titles = [g[1] for g in got]
    # Each step sits after its own chapter and before the next.
    assert titles.index("Establishing regulatory policies") < titles.index(steps[0][1])
    assert titles.index(steps[2][1]) < titles.index("Instituting data governance") < titles.index(steps[3][1])


def test_label_above_or_below_picks_the_nearest_heading():
    # STEP 3 sits above its heading at the foot of page 7, far below step 2's
    # heading: the nearest run wins, not the first above.
    heads = H.step_headings(handbook())
    assert [h.title for h in heads if h.page == 7] == [
        "Step 2. Develop the identified policies", "Step 3. Coordinate reviews and approvals"]


def test_one_label_is_not_a_step_structure():
    lines = [ln(1, 51, "STEP 1", bold=True), ln(1, 70, "A lone heading", size=20)] + body(1, 120)
    assert H.step_headings(lines) == []


def test_a_step_the_contents_lists_is_not_added_twice():
    lines = handbook()
    lines.insert(9, ln(2, 130, "Step 1. Identify necessary regulatory policies and legislations 4", size=10))
    got = [s.heading.title for s in H.consensus_headings(lines)]
    n = sum(1 for t in got if "Identify necessary regulatory" in t)
    assert n == 1, got


def test_generic_subsections_still_stay_out():
    # A large heading with no step label is not added beneath the contents.
    lines = handbook() + [ln(7, 300, "A boxed case study heading", size=20)]
    got = [s.heading.title for s in H.consensus_headings(lines)]
    assert "A boxed case study heading" not in got, got


def test_running_heads_footers_and_folios_are_stripped():
    ps = load("pdf-structure.py")
    lines, pages = [], []
    for p in range(1, 6):
        lines += [ln(p, 24, "ARCHITECTURE", size=7), ln(p, 24, "STRATEGY", size=7, x0=200),
                  ln(p, 805, "Establishing regulatory policies", size=8), ln(p, 805, str(10 + p), size=8, x0=500)]
        lines += body(p, 100, 3) + [ln(p, 400, "1", size=11, bold=True)]
        pages.append("\n".join(["ARCHITECTURE", "STRATEGY", "Establishing regulatory policies", str(10 + p),
                                "ordinary running text", "1", "Step", "more text"]))
    out, n = ps.strip_furniture(pages, lines)
    assert n == 20, n
    for text in out:
        assert text.split("\n") == ["ordinary running text", "1", "Step", "more text"], text


def test_callouts_and_chapter_labels_in_the_margin_stay():
    ps = load("pdf-structure.py")
    lines, pages = [], []
    for p in range(1, 6):
        # A bold TIP box reaching the margin at a different height each page,
        # and a chapter label set larger than the body: neither is furniture.
        lines += [ln(p, 780 + 9 * p, "TIP", bold=True), ln(p, 30, "CHAPTER 3", size=12)] + body(p, 100, 3)
        pages.append("CHAPTER 3\nordinary running text\nTIP")
    out, n = ps.strip_furniture(pages, lines)
    assert n == 0 and out == pages, (n, out)


def test_flat_outline_against_its_pages_is_put_in_page_order():
    ps = load("pdf-structure.py")
    raw = [(1, "Introduction", 3), (1, "How this handbook was developed", 7), (1, "SMART Guidelines", 6),
           (1, "Person-centred point of service systems", 4), (1, "How to use \nthis handbook", 8),
           (1, "Targeted users", 9), (1, "Targeted scenarios of digital readiness", 9), (1, "References", 12)]
    pages = [""] * 12
    pages[8] = "Targeted scenarios of digital readiness\ntext\nTargeted users\ntext"
    out, moved = ps.repair_outline(ps._toc_entries(raw), pages)
    assert moved
    assert [e.title for e in out] == [
        "Introduction", "Person-centred point of service systems", "SMART Guidelines",
        "How this handbook was developed", "How to use this handbook",
        "Targeted scenarios of digital readiness", "Targeted users", "References"], [e.title for e in out]


def test_nested_or_ordered_outline_is_left_as_it_is():
    ps = load("pdf-structure.py")
    nested = ps._toc_entries([(1, "Part A", 5), (2, "Background", 3), (1, "Part B", 9), (2, "Detail", 8)])
    out, moved = ps.repair_outline(nested)
    assert not moved and [e.title for e in out] == ["Part A", "Background", "Part B", "Detail"]
    flat = ps._toc_entries([(1, "One", 1), (1, "Two\nlines", 2), (1, "Three", 4)])
    out, moved = ps.repair_outline(flat)
    assert not moved and [e.title for e in out] == ["One", "Two lines", "Three"]


def test_step_title_is_located_without_its_label():
    ps = load("pdf-structure.py")
    pages = ["", "Running head\nINPUTS\nSTEPS\nCoordinate reviews and approvals\nSTEP 3\nbody"]
    e = ps.TocEntry(2, "Step 3. Coordinate reviews and approvals", 2, "inferred")
    assert ps.locate_heading(pages, e) == (1, 3)


def test_benchmark_reads_a_hand_made_key():
    tb = load("toc-benchmark.py")
    with open(os.path.join(HERE, "fixtures", "dth-toc-gold.json")) as f:
        keys = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    pc = tb.gold_key("/anywhere/9789240116191-eng.pdf", keys)
    assert pc and len(pc) == 33 and pc[5].title.startswith("Step 1.") and pc[5].level == 2, pc[:6]
    assert tb.gold_key("/anywhere/other.pdf", keys) is None
    assert "pipeline" in tb.METHODS and "pipeline" in tb.NOT_DEFAULT


def main() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
    print(f"{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
