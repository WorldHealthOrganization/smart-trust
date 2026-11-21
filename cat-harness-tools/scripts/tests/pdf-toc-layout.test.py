"""A table of contents inferred from the LAYOUT, not from plain text. Issue #2302.

`pdf-structure.py` used to infer a missing outline with regular expressions over
plain page text, which has thrown away what makes a heading visible: it is set
larger, bolder, in capitals or in italics. `_pdf_headings.py` reads the text
WITH its font metrics. Over the 13 corpus PDFs that carry an outline, hidden and
used as the answer key (`toc-benchmark.py`), title F1 went from 0.30 to 0.92 (0.26 to 0.83 on 20 held-out PDFs).

## What these tests hold

1. Prominent type is a heading; body text, running heads, captions and
   inline bold emphasis are not.
2. The IEEE convention — "I. INTRODUCTION" in small capitals and "A. Search
   strategy" in italics, both at body size and weight — is found, at two levels.
3. Levels are depths in a tree, so a rare style ranked between two common ones
   does not leave gaps (1, 3, 5).
4. A section number set in its own box is re-joined to its title, and not to a
   neighbouring column.
5. A printed contents page is parsed, and its printed page labels are moved to
   physical pages by finding the titles in the body.
6. A title that merely BEGINS "Table of Contents ..." does not end the front
   matter (measured on ICDAR2013-ToC.pdf, whose title and byline came out as
   sections).
7. The benchmark's metric: an identical TOC scores 1, and an outline that omits
   the chapter level is the same hierarchy (constant shift), not a zero.
8. End to end: `pdf-structure.py` on a PDF with no outline records
   `toc_inferred_method: "font"` and the headings. Skipped without PyMuPDF.
9. The benchmark reads Grobid's TEI-XML (depth from `n`, page from `coords`)
   and Nougat's Markdown (depth from `#`).
11. The list of figures: a caption opens its line with label, number and
    punctuation ("Fig. 2 outlines" is a reference); evidence is a citation in
    the text, its numbering run, a graphic on its page; gaps are reported.
12. Contents vs body: a draft's contents may list a section it no longer has,
    omit one it does, or point at the wrong page — all three are reported.
13. Page labels: printed folios fitted into roman and arabic runs, a stray
    number rejected, an unnumbered page interpolated, and a /PageLabels value
    that disagrees with the print reported as a conflict.
10. The consensus TOC: a contents entry the body confirms is near certain, one
    it never finds is kept but flagged; in a numbered document a stray
    unnumbered style is dropped.

Synthetic `Line`s carry every case but the last, so nothing here needs a PDF
library or a corpus file.
"""
import importlib.util
import os
import sys
import tempfile

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


PAGE_H, PAGE_W = 800.0, 600.0


def ln(page, y, text, size=10.0, bold=False, italic=False, x0=72.0, uniform=1.0):
    return H.Line(page, text, size, bold, italic, H._caps(text), "Times", uniform,
                  x0, y, x0 + 6 * len(text), y + size, PAGE_H, PAGE_W)


def body(page, y0, n=6):
    return [ln(page, y0 + 14 * i, "the body of the text runs on in ordinary type here and there") for i in range(n)]


def titles(heads):
    return [(h.level, h.title) for h in heads]


def test_prominent_type_is_a_heading_and_noise_is_not():
    lines = []
    for p in range(1, 7):
        lines.append(ln(p, 20, "Journal of Examples, vol. 3", size=8))       # running head (margin, repeats)
        lines += body(p, 120)
    lines[1:1] = [ln(1, 60, "Abstract")]
    lines.insert(3, ln(1, 100, "1 Introduction", size=14, bold=True))
    lines += [ln(3, 100, "2 Method", size=14, bold=True),
              ln(3, 300, "2.1 Data", size=12, bold=True),
              ln(4, 300, "Figure 3: a picture of the method", size=12, bold=True),
              ln(4, 400, "important point in bold", bold=True),
              ln(5, 100, "3 Results", size=14, bold=True)]
    lines.sort(key=lambda l: (l.page, l.y0))
    got = titles(H.font_headings(lines))
    assert got == [(1, "Introduction"), (1, "Method"), (2, "Data"), (1, "Results")], got


def test_ieee_small_caps_and_italic_headings():
    lines = [ln(1, 60, "Abstract—we study things.", size=9, bold=True, uniform=1.0)]
    lines += [ln(1, 100, "I. INTRODUCTION")] + body(1, 120)
    lines += [ln(2, 100, "II. METHOD")] + body(2, 120)
    lines += [ln(2, 300, "A. Search strategy", italic=True)] + body(2, 320)
    lines += [ln(3, 100, "III. RESULTS")] + body(3, 120)
    got = titles(H.font_headings(lines))
    assert got == [(1, "INTRODUCTION"), (1, "METHOD"), (2, "Search strategy"), (1, "RESULTS")], got


def test_wrapped_heading_continues_but_next_heading_does_not_merge():
    lines = [ln(1, 60, "Abstract—we study things.", size=9, bold=True)]
    lines += [ln(1, 100, "I. RESULTS")] + body(1, 120)
    lines += [ln(2, 100, "A. RQ1. What agile approaches have been", italic=True),
              ln(2, 112, "proposed for ML-enabled systems?", italic=True)] + body(2, 130)
    lines += [ln(2, 300, "B. Search strategy", italic=True),
              ln(2, 312, "Data sources", italic=True)] + body(2, 330)
    got = [h.title for h in H.font_headings(lines)]
    assert "RQ1. What agile approaches have been proposed for ML-enabled systems?" in got, got
    # "Data sources" opens with a capital: a separate line, not part of "Search strategy".
    assert "Search strategy" in got, got


def test_levels_are_tree_depths():
    raw = [H.Heading(1, "A", 1, None), H.Heading(3, "B", 1, None), H.Heading(5, "C", 2, None),
           H.Heading(3, "D", 3, None), H.Heading(1, "E", 4, None)]
    assert [h.level for h in H.tree_levels(raw)] == [1, 2, 3, 2, 1]


def test_bare_number_rejoined_to_its_title_only():
    num = ln(1, 100, "2.1", size=12, bold=True, x0=72)
    title = ln(1, 100, "Autonomous Agent", size=12, bold=True, x0=100)
    far = ln(1, 200, "3", size=10, x0=72)
    other_col = ln(1, 200, "Next column text", size=10, x0=330)
    out = H._join_same_baseline([num, title, far, other_col])
    assert [l.text for l in out] == ["2.1 Autonomous Agent", "3", "Next column text"], [l.text for l in out]


def test_contents_page_parsed_and_linked_to_physical_pages():
    # Physical page 2 is the contents; printed page 1 is physical page 4.
    contents = [ln(2, 60, "Contents", size=14, bold=True)]
    entries = [("1 Introduction", 1, 72), ("1.1 Scope", 2, 90), ("2 Methods", 3, 72),
               ("2.1 Data", 3, 90), ("3 Results", 5, 72), ("References", 7, 72)]
    for i, (t, pg, x) in enumerate(entries):
        contents.append(ln(2, 100 + 20 * i, f"{t} {'.' * 20} {pg}", x0=x))
    lines = [ln(1, 100, "A Report", size=20)] + contents
    for i, (t, pg, _) in enumerate(entries):
        lines += [ln(pg + 3, 80 + i, t, size=14, bold=True)] + body(pg + 3, 120, 3)
    heads = H.contents_headings(lines)
    got = [(h.level, h.title, h.page) for h in heads]
    assert got == [(1, "Introduction", 4), (2, "Scope", 5), (1, "Methods", 6),
                   (2, "Data", 6), (1, "Results", 8), (1, "References", 10)], got
    assert H.layout_headings(lines)[1] == "contents"


def test_title_beginning_table_of_contents_is_front_matter():
    lines = [ln(1, 80, "Table of Contents Recognition and Extraction", size=22),
             ln(1, 120, "Zhaohui Wu, Prasenjit Mitra", size=11),
             ln(1, 160, "Abstract—Existing work on book contents.", size=9, bold=True)]
    lines += body(1, 200) + [ln(1, 400, "I. INTRODUCTION")] + body(1, 420)
    lines += [ln(2, 100, "II. RELATED WORK")] + body(2, 120)
    got = [h.title for h in H.font_headings(lines)]
    assert got == ["INTRODUCTION", "RELATED WORK"], got


def test_metric_identity_and_constant_level_shift():
    tb = load("toc-benchmark.py")
    gold = [H.Heading(1, "Introduction", 1, None), H.Heading(2, "Scope", 1, None),
            H.Heading(1, "Methods", 2, None)]
    s = tb.score(gold, gold)
    assert s["title_f1"] == 1 and s["level_f1"] == 1 and s["teds"] == 1, s
    shifted = [h._replace(level=h.level + 1) for h in gold]
    s = tb.score(gold, shifted)
    assert s["level_f1"] == 1, s
    s = tb.score(gold, [])
    assert s["title_f1"] == 0, s


def test_grobid_tei_heads_read_with_depth_and_page():
    tb = load("toc-benchmark.py")
    tei = """<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
      <div><head n="1" coords="1,72,90,200,12">Introduction</head><p>x</p></div>
      <div><head n="2.1" coords="3,72,90,200,12">Data   sets</head></div>
      <div><head>Acknowledgements</head></div>
    </body><back><div><head>Not a body head</head></div></back></text></TEI>"""
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "x.tei.xml")
        with open(path, "w") as f:
            f.write(tei)
        got = [(h.level, h.title, h.page, h.number) for h in tb._tei_headings(path)]
    assert got == [(1, "Introduction", 1, "1"), (2, "Data sets", 3, "2.1"),
                   (1, "Acknowledgements", None, None)], got


def test_nougat_markdown_heads_read_as_a_tree():
    tb = load("toc-benchmark.py")
    mmd = "# A Title\n\ntext\n\n## 1 Introduction\n\n```\n# not a heading\n```\n#### 1.1 Scope\n## 2 Methods\n"
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "x.mmd")
        with open(path, "w") as f:
            f.write(mmd)
        got = [(h.level, h.title, h.number) for h in tb._mmd_headings(path)]
    assert got == [(1, "A Title", None), (2, "Introduction", "1"), (3, "Scope", "1.1"),
                   (2, "Methods", "2")], got


def test_consensus_scores_contents_entries_by_body_evidence():
    # Same fixture as the contents test, minus the body line for "Results".
    contents = [ln(2, 60, "Contents", size=14, bold=True)]
    entries = [("1 Introduction", 1, 72), ("1.1 Scope", 2, 90), ("2 Methods", 3, 72),
               ("2.1 Data", 3, 90), ("3 Results", 5, 72), ("References", 7, 72)]
    for i, (t, pg, x) in enumerate(entries):
        contents.append(ln(2, 100 + 20 * i, f"{t} {'.' * 20} {pg}", x0=x))
    lines = [ln(1, 100, "A Report", size=20)] + contents
    for i, (t, pg, _) in enumerate(entries):
        if t != "3 Results":
            lines += [ln(pg + 3, 80 + i, t, size=14, bold=True)]
        lines += body(pg + 3, 120, 3)
    got = {s.heading.title: s for s in H.consensus_headings(lines)}
    assert set(got) == {"Introduction", "Scope", "Methods", "Data", "Results", "References"}, got
    assert "body" in got["Methods"].sources and got["Methods"].confidence >= 0.9, got["Methods"]
    # Listed on the contents page, never found in the body: kept, flagged low.
    assert "body" not in got["Results"].sources and got["Results"].confidence < 0.6, got["Results"]


def test_consensus_drops_an_unconfirmed_style_in_a_numbered_document():
    lines = [ln(1, 60, "Abstract")]
    for p, t in ((1, "1 Introduction"), (2, "2 Method"), (3, "3 Results"), (4, "4 Discussion")):
        lines += [ln(p, 100, t, size=14, bold=True)] + body(p, 120)
    lines += [ln(3, 400, "Prompt Template", size=12, italic=True, bold=True)] + body(3, 420, 2)
    got = [s.heading.title for s in H.consensus_headings(lines)]
    assert got == ["Introduction", "Method", "Results", "Discussion"], got


def test_figure_list_cross_checks_captions():
    import _pdf_figures as F
    lines = []
    lines += [ln(1, 100, "As Figure 1 shows, and Table 1 lists, the method works.")]
    lines += [ln(2, 300, "Figure 1: The pipeline of the method", size=9)]
    lines += [ln(2, 400, "Fig. 2 outlines the second stage of the work.")]   # a reference, not a caption
    lines += [ln(3, 300, "Figure 3. A later stage", size=9)]
    lines += [ln(3, 500, "Table 1.", size=9), ln(3, 500, "Scores by method", size=9, x0=140)]
    got = {(e.kind, e.number): e for e in F.figure_list(lines, graphics={2: 4})}
    assert set(got) == {("figure", "1"), ("figure", "3"), ("table", "1")}, got
    assert got[("figure", "1")].evidence == ("referenced", "in-sequence", "graphic"), got[("figure", "1")]
    assert got[("table", "1")].title == "Scores by method", got[("table", "1")]
    # Figure 3 is kept (a well-formed caption) but not in sequence: Figure 2
    # was only ever referenced, never captioned — and the gap is reported.
    assert "in-sequence" not in got[("figure", "3")].evidence
    assert F.sequence_gaps(list(got.values())) == ["figure 2"], F.sequence_gaps(list(got.values()))


def test_contents_alignment_reports_draft_drift():
    # A draft: the contents still lists "Old Section" (since renamed), omits
    # the new "4 Added Section", and says Methods is on p3 when it moved to p6.
    contents = [ln(2, 60, "Contents", size=14, bold=True)]
    entries = [("1 Introduction", 1), ("2 Methods", 3), ("3 Results", 5), ("Old Section", 6),
               ("References", 7)]
    for i, (t, pg) in enumerate(entries):
        contents.append(ln(2, 100 + 20 * i, f"{t} {'.' * 20} {pg}"))
    lines = [ln(1, 100, "A Draft Report", size=20)] + contents
    body_at = {"1 Introduction": 4, "2 Methods": 9, "3 Results": 8, "References": 10}
    for t, phys in sorted(body_at.items(), key=lambda kv: kv[1]):
        lines += [ln(phys, 80, t, size=14, bold=True)] + body(phys, 120, 3)
    lines += [ln(9, 400, "4 Added Section", size=14, bold=True)] + body(9, 420, 2)
    lines.sort(key=lambda l: (l.page, l.y0))
    a = H.contents_alignment(lines)
    assert a["listed_not_found"]["items"] == ["Old Section"], a
    assert a["found_not_listed"]["items"] == ["4 Added Section"], a
    assert a["page_mismatch"]["items"] == ["Methods: listed p6, found p9"], a


def test_page_labels_from_printed_folios_and_conflicts():
    import _pdf_page_labels as P
    assert P.roman_to_int("xiv") == 14 and P.int_to_roman(14) == "xiv" and P.roman_to_int("vx") is None
    assert P.clean_label("<FEFF0065>213") == "e213"
    lines = []
    # Physical 1: cover, no folio. 2-4: roman ii-iv in the footer. 5-12:
    # arabic 1-8, except 8 (a full-page figure) prints nothing, and page 6
    # also carries a stray "2024" in its footer.
    for p in range(1, 13):
        lines += body(p, 200, 2)
        if 2 <= p <= 4:
            lines.append(ln(p, 760, P.int_to_roman(p)))
        elif p >= 5 and p != 8:
            lines.append(ln(p, 760, str(p - 4)))
        if p == 6:
            lines.append(ln(p, 775, "2024"))
    got = {pl.physical: pl for pl in P.page_labels(lines, 12)}
    assert got[1].label is None
    assert [got[p].label for p in (2, 3, 4)] == ["ii", "iii", "iv"], got
    assert [got[p].label for p in range(5, 13)] == [str(n) for n in range(1, 9)], got
    assert got[8].source == "interpolated" and got[6].source == "printed"
    # The PDF's own labels disagree on page 3 ("3" against a printed "iii"):
    # the printed label wins, and the conflict is reported.
    pdf = {p: str(p) for p in range(1, 13)}
    assert {pl.physical: pl for pl in P.page_labels(lines, 12, pdf=pdf)}[3].label == "iii"
    assert "p3: pdf-labels 3, printed iii" in P.label_conflicts(lines, 12, pdf)["items"]


def test_pdf_structure_records_the_layout_method():
    try:
        import pymupdf
    except ImportError:
        print("  SKIP end-to-end: pymupdf not installed")
        return
    ps = load("pdf-structure.py")
    filler = "Ordinary body text continues for a while on this page. " * 3
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "no-outline.pdf")
        doc = pymupdf.open()
        for title in ("Introduction", "Background", "Results", "Discussion"):
            page = doc.new_page()
            page.insert_text((72, 100), title, fontsize=16, fontname="hebo")
            for i in range(12):
                page.insert_text((72, 140 + 16 * i), filler[:90], fontsize=10, fontname="helv")
        doc.save(path)
        artefact, _ = ps.process(path, backend="pymupdf")
    assert artefact["toc_source"] == "inferred", artefact["toc_source"]
    assert artefact["diagnostics"]["toc_inferred_method"] == "font", artefact["diagnostics"]
    got = [(e["title"], e["page"]) for e in artefact["toc"]]
    assert got == [("Introduction", 1), ("Background", 2), ("Results", 3), ("Discussion", 4)], got


def test_annex_numbers_keep_their_series():
    # folio-assistant#2302: "Annex 1" and chapter "1" were both number "1".
    assert H.split_number("Annex 1. Tally sheets for routine childhood vaccinations") == (
        "Annex 1", "Tally sheets for routine childhood vaccinations")
    assert H.split_number("Appendix B.2 Proofs") == ("Appendix B.2", "Proofs")
    assert H.split_number("Section 1. Introduction") == ("1", "Introduction")
    assert H.split_number("Chapter 3 Results") == ("3", "Results")
    assert H._depth("Annex 2.1") == 2 and H._depth("Annex 1") == 1
    contents = [ln(2, 60, "Contents", size=14, bold=True)]
    entries = [("1 Introduction", 1), ("2 Methods", 3), ("3 Results", 4), ("Annex 1. Tally sheets", 5), ("Annex 2. Worksheets", 7)]
    for i, (t, pg) in enumerate(entries):
        contents.append(ln(2, 100 + 20 * i, f"{t} {'.' * 20} {pg}"))
    toc = [ln(1, 100, "A Report", size=20)] + contents
    for i, (t, pg) in enumerate(entries):
        toc += [ln(pg + 3, 80 + i, t, size=14, bold=True)] + body(pg + 3, 120, 3)
    nums = [h.number for h in H.contents_headings(toc)]
    assert nums == ["1", "2", "3", "Annex 1", "Annex 2"], nums


def test_contents_levels_consistent_with_nesting():
    # Defect 2 (bean inkl, folio-assistant#2302):
    # - In LNOB, "Section 1" is at x0=65.2, "Annex 1" at x0=76.2 (both depth 1),
    #   and "Introduction" + "1.1..1.2" at x0=87.1 (depth 2). "Introduction"
    #   must be level 2 under Section 1, not level 3.
    lnob = [
        ln(1, 100, "LNOB Guidance", size=20),
        ln(2, 60, "Contents", size=14, bold=True, x0=65.2),
        ln(2, 90, "Acknowledgements ............ iv", bold=True, x0=65.2),
        ln(2, 110, "Section 1. Principles ............ 1", size=11, bold=True, x0=65.2),
        ln(2, 130, "Introduction ............ 1", x0=87.1),
        ln(2, 150, "1.1 Policy ............ 2", x0=87.1),
        ln(2, 170, "1.2 Supplies ............ 3", x0=87.1),
        ln(2, 190, "References ............ 4", size=11, bold=True, x0=65.2),
        ln(2, 210, "Annex 1. Schedules ............ 5", x0=76.2),
    ]
    lnob += [ln(6, 80, "Acknowledgements", size=14, bold=True)] + body(6, 120, 2)
    for pg, title in [(11, "Section 1. Principles"), (11, "Introduction"), (12, "1.1 Policy"),
                      (13, "1.2 Supplies"), (14, "References"), (15, "Annex 1. Schedules")]:
        lnob += [ln(pg, 80, title, size=14, bold=True)] + body(pg, 120, 2)
    got_lnob = [(h.level, h.number, h.title, h.page) for h in H.contents_headings(lnob)]
    assert got_lnob == [
        (1, None, "Acknowledgements", 6),
        (1, "1", "Principles", 11),
        (2, None, "Introduction", 11),
        (2, "1.1", "Policy", 12),
        (2, "1.2", "Supplies", 13),
        (1, None, "References", 14),
        (1, "Annex 1", "Schedules", 15),
    ], got_lnob

    # - In DDCC, "Executive Summary" and "Annexes" sit at x0=110.4 while
    #   "SECTION 1", "1.1", "References" and "Annex 1" sit at x0=111.4 (1pt jitter).
    #   Neither "Annexes" nor "References" may be pushed to level 2 or 3.
    ddcc = [
        ln(1, 100, "DDCC Guidance", size=20),
        ln(2, 60, "Contents", size=14, bold=True, x0=111.4),
        ln(2, 90, "Executive Summary     xi", size=12, bold=True, x0=110.6),
        ln(2, 110, "SECTION 1 Introduction     1", size=12, bold=True, x0=111.4),
        ln(2, 130, "1.1 Purpose     1", size=11, x0=111.4),
        ln(2, 150, "References     2", size=11, x0=111.4),
        ln(2, 170, "Annexes     3", size=12, bold=True, x0=110.4),
        ln(2, 190, "Annex 1: Example     4", size=11, x0=111.4),
    ]
    ddcc += [ln(13, 80, "Executive Summary", size=14, bold=True)] + body(13, 120, 2)
    for pg, title in [(18, "SECTION 1 Introduction"), (18, "1.1 Purpose"),
                      (19, "References"), (20, "Annexes"), (21, "Annex 1: Example")]:
        ddcc += [ln(pg, 80, title, size=14, bold=True)] + body(pg, 120, 2)
    got_ddcc = [(h.level, h.number, h.title, h.page) for h in H.contents_headings(ddcc)]
    assert got_ddcc == [
        (1, None, "Executive Summary", 13),
        (1, "1", "Introduction", 18),
        (2, "1.1", "Purpose", 18),
        (1, None, "References", 19),
        (1, None, "Annexes", 20),
        (1, "Annex 1", "Example", 21),
    ], got_ddcc


def test_running_header_not_parsed_as_contents_entry():
    # Defect 3 (bean inkl, folio-assistant#2302): DDCC's running header
    # "Page" + "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021"
    # ended in "2021" and became a bogus contents entry on page 2021.
    assert H._parse_entry("DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021") is None
    lines = [ln(1, 100, "DDCC:VS Guidance", size=20)]
    for p in range(2, 9):
        lines.append(ln(p, 22, "Page", size=8, x0=552.9))
        lines.append(ln(p, 27, "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021", size=8, x0=34.0))
        if p > 2:
            lines += body(p, 120, 3)
    entries = [("SECTION 1 Introduction", 1), ("1.1 Purpose", 1), ("1.2 Scope", 2),
               ("SECTION 2 Ethics", 3), ("References", 4), ("Annex 1: Example", 5)]
    for i, (t, pg) in enumerate(entries):
        lines.append(ln(2, 100 + 24 * i, f"{t}     {pg}", size=11, x0=111.4))
        lines.append(ln(pg + 3, 80 + i, t, size=14, bold=True))
    heads = H.contents_headings(lines)
    assert all("27 August" not in h.title for h in heads), heads
    assert len(heads) == 6, heads


def test_contents_entries_located_across_wraps_inflections_and_roman_labels():
    # Defect 4 (bean inkl, folio-assistant#2302):
    # - LNOB p. 41 prints "Annex 5. Tally sheet for routine childhood vaccinations – example 1"
    #   for the contents entry "Annex 5. Tally sheets for routine childhood vaccinations".
    # - DDCC p. 63 wraps "National Trust / Architecture for / the DDCC:VS" across 3 lines.
    ps = load("pdf-structure.py")
    pages = [
        "Cover",
        "Annex 5. Tally sheet for routine childhood vaccinations – example 1\n" + ("Body text. " * 10),
        "SECTION\nNational Trust\nArchitecture for\nthe DDCC:VS\n6\n" + ("Body text. " * 10),
    ]
    toc = [
        ps.TocEntry(1, "Tally sheets for routine childhood vaccinations", 2, "inferred", "Annex 5", 0.95),
        ps.TocEntry(1, "National Trust Architecture", 3, "inferred", "6", 0.8),
    ]
    secs = [s for s in ps.split_sections(pages, toc) if s.id != "sec-front-matter"]
    assert [s.title for s in secs] == [
        "Tally sheets for routine childhood vaccinations",
        "National Trust Architecture",
    ], secs


def test_dak_components_and_part_divider_do_not_collapse():
    # Defect 5 (bean inkl, folio-assistant#2302):
    # - "Part 1. Overview of SMART guideline digital adaptation kits" (16pt bold,
    #   unpaginated) above "Background . . . 2" (9pt regular) must not merge into
    #   "Overview ... Background".
    # - "Component 1. Health interventions and recommendations" splits as number "1"
    #   at level 1, matches "Health interventions and / recommended interventions"
    #   even when InDesign writes the banner at the end of the page stream, and
    #   cuts at line 0 so Component 1 keeps both §1.1 and §1.2.
    ps = load("pdf-structure.py")
    contents = [
        ln(2, 60, "Contents", size=14, bold=True, x0=36.0),
        ln(2, 108, "Part 1. Overview of SMART guideline digital adaptation kits", size=16, bold=True, x0=36.0),
        ln(2, 132, "Background . . . . . . 1", size=9, bold=False, x0=36.0),
        ln(2, 150, "Objectives . . . . . . 2", size=9, bold=False, x0=36.0),
        ln(2, 168, "Links to the broader digital health ecosystem . . . . . . 3", size=9, bold=False, x0=36.0),
        ln(2, 231, "Part 2. Digital adaptation kit content for immunizations", size=16, bold=True, x0=36.0),
        ln(2, 262, "Component 1. Health interventions and recommendations . . . . . . 4", size=9, bold=True, x0=40.3),
        ln(2, 280, "Component 2. Generic personas . . . . . . 6", size=9, bold=True, x0=40.3),
    ]
    lines = [ln(1, 100, "DAK", size=20)] + contents
    lines += [ln(4, 80, "Background", size=16, bold=True)] + body(4, 120, 3)
    lines += [ln(5, 80, "Objectives", size=16, bold=True)] + body(5, 120, 3)
    lines += [ln(6, 80, "Linkages to the broader digital health ecosystem", size=16, bold=True)] + body(6, 120, 3)
    # Tight-leaded 30pt banner lines (y1=111.5 > next y0=100.8).
    lines += [
        H.Line(7, "Health interventions and", 30.0, True, False, False, "Times", 1.0, 340.0, 68.8, 500.0, 111.5, PAGE_H, PAGE_W),
        H.Line(7, "recommended interventions", 30.0, True, False, False, "Times", 1.0, 340.0, 100.8, 500.0, 143.5, PAGE_H, PAGE_W),
    ] + body(7, 180, 3)
    lines += [ln(9, 84, "Generic personas", size=30, bold=True)] + body(9, 180, 3)
    scored = H.consensus_headings(lines)
    got = [(s.heading.level, s.heading.number, s.heading.title, s.heading.page, s.confidence >= 0.9) for s in scored]
    assert got == [
        (1, None, "Background", 4, True),
        (1, None, "Objectives", 5, True),
        (1, None, "Links to the broader digital health ecosystem", 6, True),
        (1, "1", "Health interventions and recommendations", 7, True),
        (1, "2", "Generic personas", 9, True),
    ], got

    # Stream-end banner on page 7 (Component 1) and page 9 (Component 2):
    p7 = "\n".join([f"header {i}" for i in range(10)] + ["1.1 List of interventions", "Vaccine A", "1", "Health interventions and", "recommended interventions", "Component"])
    p8 = "1.2 WHO guidelines, recommendations and guidance\nLeave no one behind (31)"
    p9 = "\n".join([f"header {i}" for i in range(10)] + ["2.1 Targeted generic personas", "Nurse persona", "2", "Generic personas", "Component"])
    pages = ["Cover", "Contents", "Blank", "Background\nBody", "Objectives\nBody",
             "Linkages to the broader digital health ecosystem\nBody", p7, p8, p9]
    toc = [ps.TocEntry(s.heading.level, s.heading.title, s.heading.page, "inferred", s.heading.number, s.confidence) for s in scored]
    secs = {s.title: s for s in ps.split_sections(pages, toc) if s.id != "sec-front-matter"}
    assert len(secs) == 5, list(secs)
    c1 = secs["Health interventions and recommendations"]
    assert "1.1 List of interventions" in c1.text and "1.2 WHO guidelines" in c1.text, c1.text
    assert "2.1 Targeted generic personas" not in c1.text, c1.text


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
