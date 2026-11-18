"""An inferred table of contents has to justify itself. Bean `6xaz`.

`scripts/pdf-structure.py` reads a table of contents from the PDF's embedded
outline when there is one and otherwise INFERS it from heading-shaped lines.
Both used to be emitted with the same authority, and `sections/` recorded
neither, so a consumer could not tell them apart without re-reading
`structure.json`.

**Measured 2026-09-19 on `uploads/WPR-RDO-2020-003-eng.pdf`** (WHO WPRO style
guide, 33pp, no outline): 11 of 13 inferred sections were named after A
DIFFERENT PUBLICATION — 'FACILITY LEVEL: Improving hospital planning and
management', '2.1 Goal - Hospitals as a path to UHC' — scraped off page 22,
which is a SAMPLE TABLE the guide reproduces as a design example. Every one was
stamped `page: 22`, so the collision was visible in the output and nothing
acted on it.

That is worse than shipping nothing. `docs/source/guides-document-ingestion/` argues
an un-ingested source is worse than an absent one "because it produces false
confidence rather than a gap"; a misnamed section is that failure one level in,
because it is greppable, it sits in `library/`, and it answers a question
wrongly with authority.

## What these tests hold

1. The detector fires on a list scraped off one or two pages.
2. **It never touches an outline.** A PDF's own outline is the document's
   answer; `9789241548960_eng.pdf`'s 250 sections must survive untouched. This
   is the falsifier the work was done against, and it is the arm most worth
   keeping.
3. A short document is not condemned for having nowhere else to put its
   headings.
4. End to end over a built PDF whose second page is a sample table: the sample
   does not become the document's structure.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
ROOT = os.path.dirname(SCRIPTS)
sys.path.insert(0, SCRIPTS)


def load(name: str):
    """A hyphenated script as a module — not importable by name, loaded by path."""
    spec = importlib.util.spec_from_file_location(
        "_t_" + name.replace("-", "_").replace(".py", ""), os.path.join(SCRIPTS, name)
    )
    assert spec and spec.loader, name
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def build_sample_table_pdf(path: str) -> bool:
    """
    A three-page PDF: body, then a page reproducing another publication's
    contents as a worked example, then more body.

    Built with reportlab if present and otherwise by hand — the repository
    declares no PDF WRITER, and a fixture that needs an undeclared dependency
    is one CI cannot build.
    """
    pages = [
        "INTRODUCTION\n\nThis guide explains house style for publications.\n"
        + ("Body text about style and usage. " * 40),
        # The sample table: a whole other publication's contents, on one page.
        "OVERVIEW OF ACTION AREAS AND DOMAINS\n"
        "FACILITY LEVEL: Improving hospital planning\n"
        "1.1 Accountability\n"
        "1.2 Efficiency\n"
        "1.3 Quality\n"
        "2.1 Goal As A Path To Uhc\n"
        "2.2 Governance Of Services\n"
        "3.1 Workforce Planning\n"
        "3.2 Financing Arrangements\n",
        "PAGINATION\n\n" + ("More body text about page numbering. " * 40),
    ]
    try:
        return _write_pdf(path, pages)
    except Exception as exc:                                    # pragma: no cover
        print(f"  NOTE could not build the fixture PDF ({exc}) — arm 4 did not run")
        return False


def _write_pdf(path: str, pages: list[str], outline: list[tuple[str, int]] | None = None) -> bool:
    """
    A minimal text-only PDF, one content stream per page, no dependencies.

    `outline` writes a real `/Outlines` tree — `(title, 1-based page)` — which
    is what lets a test build the case the corpus does not contain: a document
    whose OWN outline is concentrated on one page. Without it, "an outline is
    never second-guessed" can only be checked against a document whose outline
    happens to be spread, and a mutation that second-guesses outlines survives.
    """
    objs: list[bytes] = []

    def add(b: bytes) -> int:
        objs.append(b)
        return len(objs)

    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    kids, contents = [], []
    for text in pages:
        lines = []
        y = 760
        for raw in text.splitlines():
            # Wrap so long paragraphs become several show-text operations
            # rather than one line running off the page.
            for i in range(0, max(len(raw), 1), 95):
                chunk = raw[i:i + 95].replace("\\", "").replace("(", "").replace(")", "")
                lines.append(f"BT /F1 11 Tf 1 0 0 1 56 {y} Tm ({chunk}) Tj ET")
                y -= 14
                if y < 50:
                    break
            if y < 50:
                break
        stream = "\n".join(lines).encode("latin-1", "replace")
        contents.append(add(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)))
    pages_obj = len(objs) + len(pages) + 1
    for c in contents:
        kids.append(add(
            b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>"
            % (pages_obj, font, c)
        ))
    tree = add(b"<< /Type /Pages /Kids [%s] /Count %d >>"
               % (b" ".join(b"%d 0 R" % k for k in kids), len(kids)))
    assert tree == pages_obj, (tree, pages_obj)
    if outline:
        # Reserve the /Outlines object so items can name it as /Parent.
        outlines_obj = len(objs) + len(outline) + 1
        items = []
        for title, pageno in outline:
            t = title.replace("\\", "").replace("(", "").replace(")", "")
            items.append(add(
                b"<< /Title (%s) /Parent %d 0 R /Dest [%d 0 R /Fit] >>"
                % (t.encode("latin-1", "replace"), outlines_obj,
                   kids[min(pageno, len(kids)) - 1])
            ))
        for i, obj in enumerate(items):
            extra = b""
            if i:
                extra += b" /Prev %d 0 R" % items[i - 1]
            if i + 1 < len(items):
                extra += b" /Next %d 0 R" % items[i + 1]
            objs[obj - 1] = objs[obj - 1][:-3] + extra + b" >>"
        got = add(b"<< /Type /Outlines /First %d 0 R /Last %d 0 R /Count %d >>"
                  % (items[0], items[-1], len(items)))
        assert got == outlines_obj, (got, outlines_obj)
        root = add(b"<< /Type /Catalog /Pages %d 0 R /Outlines %d 0 R >>" % (tree, outlines_obj))
    else:
        root = add(b"<< /Type /Catalog /Pages %d 0 R >>" % tree)

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets[1:]:
        out += b"%010d 00000 n \n" % off
    out += (b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n"
            % (len(objs) + 1, root, xref))
    with open(path, "wb") as fh:
        fh.write(bytes(out))
    return True


def main() -> int:
    rc = 0

    def check(label: str, cond: bool) -> None:
        nonlocal rc
        print(f"  {'ok  ' if cond else 'FAIL'} {label}")
        if not cond:
            rc = 1

    pdf = load("pdf-structure.py")
    E = pdf.TocEntry

    def entries(pages: list[int]) -> list:
        return [E(1, f"Heading {i}", p, "inferred", None) for i, p in enumerate(pages)]

    print("\n1. the detector fires on a list scraped off a page or two")
    # The shape measured on WPR-RDO-2020-003-eng: almost every entry claiming
    # the page the sample table sits on.
    scraped = entries([22] * 11 + [3, 29])
    frac, pgs = pdf.toc_concentration(scraped)
    check(f"concentration is measured, not guessed (got {frac:.0%} on {pgs})",
          frac >= 0.8 and 22 in pgs)
    verdict = pdf.inferred_toc_verdict(scraped, 33)
    check("a scraped list is UNDETERMINED", verdict is not None)
    check("and the verdict says why, in numbers a reader can re-derive",
          verdict is not None and "13" in verdict and "%" in verdict and "22" in verdict)

    print("\n2. a real document's headings are spread through its body")
    spread = entries([3, 9, 14, 21, 28, 35, 44, 51, 60])
    check("a spread TOC is trusted", pdf.inferred_toc_verdict(spread, 64) is None)

    print("\n3. the guards")
    check("under five entries, concentration carries no information",
          pdf.inferred_toc_verdict(entries([7, 7, 7, 7]), 40) is None)
    check("a document with nowhere else to put its headings is not condemned",
          pdf.inferred_toc_verdict(entries([1, 1, 1, 2, 2, 2]), 2) is None)
    check("one threshold, not two spellings of it",
          pdf.TOC_MAJORITY == 0.6 and pdf.TOC_MAX_CONCENTRATED_PAGES == 2)

    print("\n4. end to end: a sample table does not become the structure")
    tmp = os.path.join(ROOT, "scripts", "tests", ".toc-verdict-fixture.pdf")
    built = build_sample_table_pdf(tmp)
    if built:
        try:
            artefact, sections = pdf.process(tmp, backend="auto")
            titles = " | ".join(s.title for s in sections)
            check(f"toc_source is 'undetermined', not 'inferred' (got {artefact['toc_source']!r})",
                  artefact["toc_source"] == "undetermined")
            check("the sample table's headings are NOT the document's sections",
                  "Accountability" not in titles and "Uhc" not in titles)
            check("the reason is recorded for a person to check",
                  bool(artefact.get("toc_undetermined_reason")))
            check("how many entries were inferred is reported either way",
                  artefact["diagnostics"].get("toc_inferred_entries", 0) >= 5)
            check("the text is still there — refusing a TREE is not discarding the DOCUMENT",
                  artefact["diagnostics"]["chars_total"] > 500)
            # Issue #2302, owner 2026-10-07: refused, it falls back to PAGES —
            # not to one section holding the whole document.
            check(f"refused, it is split one section per page (got {len(sections)} for "
                  f"{artefact['source']['pages']} pages)",
                  artefact.get("granularity") == "page"
                  and len(sections) == artefact["source"]["pages"]
                  and sections[0].id == "page-001" and sections[0].title == "Page 1")
            check("and says why, beside the granularity",
                  "one section per page" in (artefact.get("structure_note") or ""))
        except ImportError as exc:
            # ONLY a missing backend is an environment fact. Catching `Exception`
            # here reported an AttributeError in this very file as "no usable
            # backend" — a defect wearing a skip's clothing, which is the exact
            # confusion this bean is about.
            print(f"  NOTE no usable PDF backend here ({exc}) — arm 4 proved nothing")
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass

    print("\n5. sections/ carries its OWN toc_source")
    # The second half of the bean, and the half that serves BOTH failure shapes:
    # a consumer reading `sections/*.md` could not tell an inferred tree from an
    # outline-derived one without going back to `structure.json`, and the two are
    # not comparable in trustworthiness. `sections/` is what gets read, quoted
    # and cited, so the provenance has to be on it.
    import tempfile
    for src in ("outline", "inferred", "undetermined"):
        with tempfile.TemporaryDirectory() as d:
            artefact = {
                "doc_id": "d", "metadata": {"title": "T"}, "toc_source": src,
                "source": {"file": "d.pdf", "sha256": "0" * 64},
            }
            sec = pdf.Section("sec-001-a", None, "A", 1, 1, 2, 3, 1, "body")
            pdf.write_sections(d, artefact, [sec])
            body = open(os.path.join(d, "sections", "sec-001-a.md")).read()
            check(f"a section written from a {src!r} TOC says so",
                  f"toc_source: {src}" in body)

    print("\n9. the second test: mean confidence (issue #2302, owner 2026-10-07)")
    def scored(confs: list) -> list:
        return [E(1, f"Heading {i}", 3 + 7 * i, "inferred", None, c) for i, c in enumerate(confs)]

    def doc(n: int, bodies: list[str] | None = None) -> list[str]:
        """Heading i opening page 3+7i with a body under it, in at least 64 pages."""
        pages = [""] * max(64, 7 * n + 3)
        for i in range(n):
            body = (bodies or [])[i] if bodies else "Body text of this chapter. " * 8
            pages[2 + 7 * i] = f"Heading {i}\n{body}"
        return pages

    check("the floor is the owner's 0.6", pdf.TOC_MIN_MEAN_CONFIDENCE == 0.6)
    reason, mean, share = pdf.inferred_toc_trust(scored([0.9, 0.8, 0.7, 0.9, 0.8]), doc(5))
    check(f"spread, corroborated, with bodies: used (mean {mean}, empty {share})",
          reason is None and mean == 0.82 and share == 0.0)
    reason, mean, _ = pdf.inferred_toc_trust(scored([0.6] * 6), doc(6))
    check("a mean of exactly 0.6 — style alone, nothing corroborating — passes, as decided",
          reason is None and mean == 0.6)
    reason, mean, _ = pdf.inferred_toc_trust(scored([0.55, 0.5, 0.6, 0.5, 0.55]), doc(5))
    check(f"below the floor: refused, with the number (got {reason!r})",
          reason is not None and "0.54" in reason and "0.6" in reason)
    reason, mean, _ = pdf.inferred_toc_trust(scored([None] * 6), doc(6))
    check("an entry with no confidence counts as 0 — a regex-only list never passes",
          reason is not None and mean == 0.0)
    reason, _, _ = pdf.inferred_toc_trust(entries([22] * 11 + [3, 29]), [""] * 33)
    check("concentration is still asked first, and its reason is the one recorded",
          reason is not None and "%" in reason)
    check("nothing inferred: nothing to judge and nothing to report",
          pdf.inferred_toc_trust([], [""] * 10) == (None, None, None))

    print("\n10. the third test: headings without bodies (issue #2302, owner 2026-10-07)")
    check("the cut is the measured 25% of sections under 50 characters",
          pdf.TOC_MAX_EMPTY_SHARE == 0.25 and pdf.TOC_EMPTY_SECTION_CHARS == 50)
    full = "Body text of this chapter. " * 8
    # 3 of 8 empty = 37.5%: the WPR style guide's shape (43%).
    reason, mean, share = pdf.inferred_toc_trust(
        scored([0.7] * 8), doc(8, [full, "", full, "", full, "", full, full]))
    check(f"over 25% empty: refused, saying why (got {share}, {reason!r})",
          reason is not None and share == 0.375 and "headings without bodies" in reason)
    # 2 of 10 = 20%: the highest share any good tree in the corpus showed.
    reason, _, share = pdf.inferred_toc_trust(
        scored([0.7] * 8 + [0.7, 0.7]), doc(10, [full] * 8 + ["", ""]))
    check(f"at 20% — the best real tree's share — it is used (got {share})",
          reason is None and share == 0.2)
    reason, _, share = pdf.inferred_toc_trust(scored([0.7] * 4), doc(4, [full, "", "", full]))
    check(f"under five sections there is too little to judge (got {share}, used anyway)",
          reason is None and share == 0.5)
    reason, _, _ = pdf.inferred_toc_trust(scored([0.5] * 8), doc(8, [""] * 8))
    check("the earlier test's reason wins when both fail — one reason, the first",
          reason is not None and "confidence" in reason)
    paged = pdf.split_pages(["Alpha text", "  ", "Gamma"])
    check("page sections take pdf-pages.py's shape: ids, titles, page ranges",
          [s.id for s in paged] == ["page-001", "page-002", "page-003"]
          and [s.title for s in paged] == ["Page 1", "Page 2", "Page 3"]
          and [(s.page_start, s.page_end) for s in paged] == [(1, 1), (2, 2), (3, 3)])
    check("a blank page is a determined blank, not a gap",
          paged[1].text == "_(no text on this page)_")

    print("\n11. the fourth test: contents collapse — entries that cut no section (bean inkl, issue #2302)")
    check("the cut is 25% of inferred entries producing no section",
          getattr(pdf, "TOC_MAX_COLLAPSED_SHARE", None) == 0.25)
    # Measured on 9789240099456-eng (immunizations DAK): 21 inferred entries,
    # mean confidence 0.70, spread across pages 12..96, but only 7 matched a
    # body line (the 8 "Component N." entries, "Part 1 ... Background" and two
    # unnumbered headings all missed), collapsing 21 entries to 7 body sections
    # (+ front matter = 8) with 0% empty. The first three tests all passed.
    dak_collapsed_toc = scored([0.7] * 21)
    dak_collapsed_pages = [""] * max(100, 7 * 21 + 3)
    for i in (0, 1, 2, 3, 4, 19, 20):
        dak_collapsed_pages[2 + 7 * i] = f"Heading {i}\n{full}"
    reason, mean, share = pdf.inferred_toc_trust(dak_collapsed_toc, dak_collapsed_pages)
    check(f"21 entries collapsing to 7 body sections (67% unlocated) is refused (got {reason!r})",
          reason is not None and "21" in reason and "7" in reason and "collapse" in reason)
    # 1 of 5 unlocated = 20% <= 25%: tolerated.
    one_miss_pages = doc(5)
    one_miss_pages[2 + 7 * 2] = full  # Heading 2 absent in body
    reason, _, _ = pdf.inferred_toc_trust(scored([0.8] * 5), one_miss_pages)
    check(f"at 20% unlocated (1 of 5) the tree is still used (got {reason!r})",
          reason is None)

    print("\n6. an outline is never second-guessed, even a CONCENTRATED one")
    # The property, not one document. The handbook's outline is spread over 179
    # pages, so a mutation that ran the verdict against outlines too would leave
    # it passing — measured, and the mutation survived until this arm existed.
    # The corpus contains no concentrated outline, so the test builds one.
    tmp2 = os.path.join(ROOT, "scripts", "tests", ".toc-verdict-outline.pdf")
    # Page 2 prints the nine headings: an outline its pages do not print at all
    # is set aside by `trusted_outline` (10665/331525-rus carries its English
    # edition's outline), which is a different question from concentration.
    body = ["Chapter text. " * 60,
            "".join(f"Entry {i}\n" + "Glossary entries. " * 7 + "\n" for i in range(9)),
            "Index. " * 60]
    concentrated = [(f"Entry {i}", 2) for i in range(9)]
    if _write_pdf(tmp2, body, outline=concentrated):
        try:
            art, _ = pdf.process(tmp2, backend="auto")
            check(f"a 9-entry outline all on page 2 is still 'outline' "
                  f"(got {art['toc_source']!r}, {len(art['toc'])} entries)",
                  art["toc_source"] == "outline")
            check("and no verdict is recorded against it",
                  art.get("toc_undetermined_reason") is None)
        except ImportError as exc:
            print(f"  NOTE no usable PDF backend here ({exc}) — arm 6 proved nothing")
        finally:
            try:
                os.remove(tmp2)
            except OSError:
                pass

    print("\n8. a contents page does not shadow the chapters it lists — shape two")
    # Measured on WHO_PUB_TPS_93.1.pdf: the OCR put the contents page's page
    # numbers in a column of their own, so the trailing-number skip never
    # fired, the listing came first, and first-occurrence dedupe kept it — so
    # every chapter boundary landed on pages 2-4.
    body = "Body text of the chapter. " * 8
    doc = [
        "WHO Style\n",
        "Contents\n1. Introduction\n2. Spelling\n3. Punctuation\n4. Italics\n\n4\n9\n13\n",
        "Preface prose that is not a heading.\n" + body,
        "1. Introduction\n" + body,
        "2. Spelling\n" + body,
        body,
        "3. Punctuation\n" + body,
        "4. Italics\n" + body,
    ]
    pages_of = {e.title: e.page for e in pdf.infer_headings(doc)}
    check(f"chapters start where the BODY states them (got {pages_of})",
          pages_of == {"Introduction": 4, "Spelling": 5, "Punctuation": 7, "Italics": 8})
    check("the contents page is identified as a listing", pdf.listing_pages(
        [[pdf.TocEntry(1, t, p, "inferred", n) for (n, t, p) in rows] for rows in [
            [("1", "Introduction", 1), ("2", "Spelling", 1)],
            [("1", "Introduction", 2)],
            [("2", "Spelling", 3)],
        ]]) == {1})

    # The negatives the rule must not fire on. A running header recurs on the
    # NEXT page, so two headers recur on ONE page; a single heading proves
    # nothing; a page that opens one chapter keeps it.
    running = [
        "1. Introduction\n2. Scope\n" + body,
        "1. Introduction\n2. Scope\n" + body,
        "3. Methods\n" + body,
    ]
    got = {e.title: e.page for e in pdf.infer_headings(running)}
    check(f"running headers on the next page are not a listing (got {got})",
          got.get("Introduction") == 1 and got.get("Scope") == 1)
    single = ["2. Spelling\n" + body, "2. Spelling\n" + body, "3. Punctuation\n" + body]
    got = {e.title: e.page for e in pdf.infer_headings(single)}
    check(f"one recurring heading is not a listing (got {got})", got.get("Spelling") == 1)
    out_of_order = [
        "1. Alpha\n2. Beta\n" + body, "2. Beta\n" + body, "1. Alpha\n" + body,
    ]
    got = {e.title: e.page for e in pdf.infer_headings(out_of_order)}
    check(f"recurrences in a DIFFERENT order are not a listing of them (got {got})",
          got.get("Alpha") == 1 and got.get("Beta") == 1)

    print("\n7. and the real handbook, end to end — the falsifier this was built against")
    # The upload moved to who-iris's own queue (one directory per document),
    # and this arm then reported "absent" on every run while still exiting 0 —
    # the falsifier stopped running and nothing said so louder than a NOTE.
    # Measured 2026-10-06 (bean `6xaz`). Every place it has lived is tried.
    candidates = [
        os.path.join(str(__import__("_harness_root").HARNESS_ROOT), "uploads", "9789241548960_eng.pdf"),
        os.path.join(os.path.dirname(str(__import__("_harness_root").HARNESS_ROOT)), "who-iris", "uploads", "9789241548960-eng", "9789241548960_eng.pdf"),
    ]
    handbook = next((c for c in candidates if os.path.exists(c)), candidates[0])
    if os.path.exists(handbook):
        artefact, sections = pdf.process(handbook, backend="auto")
        check(f"the handbook still reports 'outline' (got {artefact['toc_source']!r})",
              artefact["toc_source"] == "outline")
        check(f"and still yields its 250+ sections (got {len(sections)})", len(sections) >= 250)
        check("no verdict is recorded against an outline",
              artefact.get("toc_undetermined_reason") is None)
    else:
        # Never silently. An absent fixture is an untested claim, not a pass.
        print("  NOTE uploads/9789241548960_eng.pdf absent — the falsifier arm did not run")

    print()
    print("  all checks passed" if rc == 0 else "  FAILURES above")
    return rc


if __name__ == "__main__":
    sys.exit(main())
