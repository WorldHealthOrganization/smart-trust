#!/usr/bin/env python3
"""Ingest a PDF to library/ at PAGE granularity — one section per page.

WHY THIS EXISTS, and when to reach for it instead of `pdf-structure.py`.

`pdf-structure.py` is the right tool whenever a PDF carries an embedded
outline: the structure is then READ rather than guessed, and the sections it
writes are the document's own chapters. Measured on
`uploads/9789241548960_eng.pdf` (WHO handbook for guideline development, 2nd
ed): 258 outline entries, 250 sections, real titles, real page ranges.

Without an outline it INFERS, and an inferred TOC can be confidently wrong in a
way the output does not show. Two measured failures, 2026-09-19, both in
`bean 6xaz`:

  * `uploads/WPR-RDO-2020-003-eng.pdf` — 11 of 13 inferred sections were named
    after a DIFFERENT publication, because page 22 is a sample table the style
    guide reproduces as a design example.
  * `uploads/WHO_PUB_TPS_93.1.pdf` — the inferred entries took their page
    numbers from the CONTENTS pages, so 26 of 42 sections came out under 500
    characters while 37 923 characters landed in one section misnamed
    `18-usetul-reference-books`.

In both, the text was present and the structure was fiction. This script is the
third state made usable: it does not claim to know the chapters, so it emits the
one division that cannot be wrong — the page. `section_title: "Page N"` is a
determined answer, `pages: N-N` is exact, and a rule derived from the document
can cite a node that really contains it.

It is NOT a replacement for sectioning. A page tree is worse to read and worse
to cite than a chapter tree; it is better than a chapter tree that lies. Once
`6xaz` is fixed, re-ingest with `pdf-structure.py` and delete the page tree.

  python3 scripts/pdf-pages.py -o library uploads/FILE.pdf
  python3 scripts/pdf-pages.py -o library --from-ocr uploads/FILE.pdf
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path


# `slugify` and the OCR cache location, from the module that owns both.
#
# This used to load `slugify` out of `pdf-structure.py` BY FILE PATH — 26 lines
# of `importlib` with a comment explaining that the filename's hyphen made it
# unimportable, and another explaining that the module had to be registered in
# `sys.modules` before exec or `dataclasses` died resolving `__module__`. The
# instinct was right and the mechanism was not: bean `rlp5` gave the three
# spellings a single importable home, so this is now an import.
#
# The reason it was never a copy, kept because it is the argument in one line of
# output: the first draft of this file DID reimplement `slugify` and produced
# `who-pub-tps-93-1` against `pdf-structure.py`'s `who-pub-tps-931`.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _pdf_text import join_soft_hyphens  # noqa: E402
from _pdf_doc_id import (  # noqa: E402
    derive_doc_id_from_pdf as _doc_id,
    ocr_cache_dir,
    slugify as _slugify,
)
from _pdf_title import apply as resolve_title, evidence_from_pdf  # noqa: E402
import _run_context  # noqa: E402


def slug(text: str) -> str:
    """`pdf-structure.py`'s own `slugify`, so the two scripts cannot disagree."""
    return _slugify(text)


def _load_tech_meta():
    """`scripts/_tech_meta.py`'s `tech_meta`, loaded by path.

    Same mechanism this file already uses for its siblings: a module whose name
    carries a hyphen cannot be imported, and the underscore-prefixed helpers sit
    beside it rather than on `sys.path`.
    """
    import importlib.util as _u
    spec = _u.spec_from_file_location("_tech_meta", str(Path(__file__).with_name("_tech_meta.py")))
    mod = _u.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.tech_meta


tech_meta = _load_tech_meta()


def outline_state(pdf: Path) -> str:
    """What the PDF's own outline offers this rung: `none` or `outline-unusable`.

    Bean `8shg`. This rung is reached when nothing usable could be READ, and
    writing `none` for that was a lie of omission whenever an outline existed
    and was junk. `milnorlink.pdf` carries 35 entries — 19 bare page labels,
    16 with no destination, thirteen naming other articles from the same JSTOR
    issue — and calling that "no outline" is what opened `8shg` against content
    that was correct.

    The rule is the same one `usableOutlineEntries` applies in
    `ingest-document.ts`. It is stated twice, in two languages, and that is the
    one duplicate here worth its cost: the router decides which rung to take
    before this script runs, and this script must be able to say what it saw
    without depending on having been routed. `scripts/tests/pdf-pages-outline.test.py`
    pins the two against the same cases so they cannot drift.

    Never raises: a rung that cannot read the outline says `none-undetermined`
    rather than claiming absence, because absence is a finding and this is not.
    """
    try:
        import pymupdf
    except ImportError:
        return "none-undetermined"
    try:
        toc = pymupdf.open(pdf).get_toc()
    except Exception:
        return "none-undetermined"
    if not toc:
        return "none"
    usable = [
        t for t in toc
        if t[2] is not None and t[2] >= 1
        and not re.fullmatch(r"pp?\.?\s*\d+", str(t[1]).strip(), re.I)
    ]
    return "outline" if usable else "outline-unusable"


def pdf_docinfo(pdf: Path) -> dict[str, str]:
    """The PDF Info dictionary, in the key names `pdf-structure.py` writes.

    Issue #1794. This rung wrote no `metadata` at all, so for 20 page-granular
    entries the PDF's own `/Title` was never on disk. The ruling of 2026-10-01
    makes `/Title` the third authority for a library entry's title (after the
    catalogue's Dublin Core record and `referenced.json`), so its absence
    pushed every one of them to the slug. Some of those PDFs carry a real
    `/Title` ("RFC 2119: Key words for use in RFCs ...", "Link Groups").

    Recorded verbatim, junk included ("Microsoft Word - gurel_emet.doc"). The
    junk filter belongs to the reader (`pipeline/library-title.ts`),
    because a filter applied here would hide the evidence it judged.
    """
    keys = (("title", "Title"), ("author", "Author"), ("producer", "Producer"),
            ("creator", "Creator"), ("creationDate", "CreationDate"))
    try:
        import pymupdf
        md = pymupdf.open(pdf).metadata or {}
        return {out: str(md[k]) for k, out in keys if md.get(k)}
    except ImportError:
        pass
    from _pypdf_compat import import_pypdf
    reader = import_pypdf("PdfReader")(str(pdf))
    info = reader.metadata or {}
    return {k.lstrip("/"): str(v) for k, v in info.items()
            if k in ("/Title", "/Author", "/Producer", "/Creator", "/CreationDate") and str(v)}


def merge_docinfo(existing: dict, docinfo: dict[str, str]) -> None:
    """Put `docinfo` under `metadata`, creating it in the `pdf-structure/v1` shape.

    `title` is the page-1 front-matter slot. This rung parses no front matter,
    so it is `None` here, and is never invented.
    """
    md = existing.setdefault("metadata", {})
    md.setdefault("title", None)
    md["docinfo"] = docinfo


def docinfo_only(pdf: Path, entry: Path) -> int:
    """Backfill `metadata.docinfo` into an EXISTING entry. Writes nothing else.

    Refuses unless the entry's recorded `source.sha256` is this PDF's. A file
    that merely shares a name is a different document, and its `/Title` would
    become another entry's title.
    """
    manifest = entry / "structure.json"
    if not manifest.exists():
        print(f"FAIL  {entry}: no structure.json to backfill", file=sys.stderr)
        return 1
    raw = manifest.read_text(encoding="utf-8")
    existing = json.loads(raw)
    want = (existing.get("source") or {}).get("sha256")
    got = hashlib.sha256(pdf.read_bytes()).hexdigest()
    if want != got:
        print(f"FAIL  {entry.name}: {pdf.name} sha256 {got[:12]} is not the recorded {str(want)[:12]}",
              file=sys.stderr)
        return 1
    merge_docinfo(existing, pdf_docinfo(pdf))
    # Keep the file's own escaping: one written with raw UTF-8 stays raw, so the
    # diff is the metadata and nothing else.
    keep_raw = any(ord(c) > 127 for c in raw)
    manifest.write_text(json.dumps(existing, indent=2, ensure_ascii=not keep_raw) + "\n", encoding="utf-8")
    print(f"ok  {entry.name:34s} docinfo /Title={existing['metadata']['docinfo'].get('Title')!r}")
    return 0


def page_texts(pdf: Path, from_ocr: bool, outroot: Path) -> tuple[list[str], str]:
    """Page text, and where it came from: `"embedded"` (the PDF's own text layer) or
    `"ocr"`, the vocabulary `pdf-structure.py` writes to `source.text_source`
    (issue #1121; this rung used to say `"text-layer"`). Never silently empty —
    see pdf-extract.py."""
    if from_ocr:
        # The shared helper, not `outroot / slug(stem) / "ocr"` spelled again —
        # it takes the PDF because the cache is keyed on the DOCUMENT.
        ocr_dir = Path(ocr_cache_dir(str(outroot), str(pdf)))
        files = sorted(ocr_dir.glob("page-*.txt"))
        if not files:
            sys.exit(
                f"{pdf.name}: --from-ocr but no cached OCR at {ocr_dir}. "
                f"Run scripts/pdf-ocr.py first."
            )
        return [f.read_text(encoding="utf-8", errors="replace") for f in files], "ocr"
    try:
        import pymupdf
    except ImportError:
        sys.exit("pymupdf is not installed: pip install pymupdf")
    doc = pymupdf.open(pdf)
    texts = [doc[i].get_text() for i in range(doc.page_count)]
    if sum(len(t.strip()) for t in texts) == 0:
        sys.exit(
            f"{pdf.name}: zero extractable characters on {doc.page_count} pages "
            f"— this is a scan. Run scripts/pdf-ocr.py, then pass --from-ocr."
        )
    return texts, "embedded"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdfs", nargs="*", type=Path)
    ap.add_argument("-o", "--outdir", type=Path, default=Path("."),
                    help="root that <doc-id>/ hangs off — the same meaning as pdf-structure.py -o")
    ap.add_argument("--from-ocr", action="store_true",
                    help="read the cached OCR written by pdf-ocr.py instead of the text layer")
    ap.add_argument("--title", default=None, help="document title for the front matter")
    ap.add_argument("--first-page-label", type=int, default=None, metavar="N",
                    help="printed page number of the FIRST page that carries one, so sections are "
                         "labelled as the source document numbers them (a scanned journal article "
                         "is cited by its journal pages, not by its PDF pages)")
    ap.add_argument("--label-starts-at", type=int, default=1, metavar="K",
                    help="PDF page where --first-page-label applies; earlier pages keep PDF numbering "
                         "(default 1). A JSTOR cover sheet is page 1, so the article's p. 177 is K=2.")
    ap.add_argument("--docinfo-into", type=Path, default=None, metavar="ENTRY",
                    help="backfill ONLY metadata.docinfo (the PDF Info dictionary) into the existing "
                         "ENTRY/structure.json, after checking its recorded sha256 is this PDF's. "
                         "Takes exactly one PDF; writes nothing else (issue #1794)")
    a = ap.parse_args()
    if not a.pdfs:
        ap.error("no PDFs given")
    if a.docinfo_into is not None:
        if len(a.pdfs) != 1:
            ap.error("--docinfo-into takes exactly one PDF")
        return docinfo_only(a.pdfs[0], a.docinfo_into)

    for pdf in a.pdfs:
        # THE DOC ID, which is not a section id, and the two differ in
        # ways that both bit on 2026-09-20. `slug()` below is
        # `slugify(text)` with its SECTION default of 48 characters, while a
        # doc-id is `DOC_ID_MAXLEN` = 60 and may be an arXiv stamp rather than
        # a filename at all. Using it here staged
        # `Skill-authoring-best-practices-Claude-Platform-Docs.pdf` as
        # `...---claude-platform` (48) while every reader computed
        # `...---claude-platform-docs` (60), and staged three arXiv papers
        # under their basenames while `pdf-structure.py` used `arxiv-<id>v<n>`.
        #
        # Neither failed: `--promote` looked for a staging directory that was
        # not there and reported SEVEN unmet requirements, with `blocks` among
        # them, over an entry that had all of them. A wrong-directory error
        # wearing the clothes of an incomplete ingestion.
        doc_id = _doc_id(str(pdf))
        texts, source = page_texts(pdf, a.from_ocr, a.outdir)
        # Soft hyphens joined here too — the same function as pdf-structure,
        # so the two rungs cannot disagree about a word (bean `3spu`).
        texts = [join_soft_hyphens(x) for x in texts]
        sha = hashlib.sha256(pdf.read_bytes()).hexdigest()[:16]
        secdir = a.outdir / doc_id / "sections"
        secdir.mkdir(parents=True, exist_ok=True)
        written = 0
        ids: list[tuple[str, str, int, int, int]] = []
        for i, text in enumerate(texts, start=1):
            # The printed page number, where the caller gave one. A scholarly
            # source is cited by the page the READER sees, and for a scanned
            # journal article that is never the PDF page — "Link Groups" is
            # pp. 177-195 of Annals of Mathematics 59(2) behind a JSTOR cover
            # sheet, so its PDF page 2 is p. 177. A citation to "page 2" would
            # not resolve for anyone holding the journal.
            if a.first_page_label is not None and i >= a.label_starts_at:
                label = str(a.first_page_label + (i - a.label_starts_at))
                title = f"p. {label}"
                section_id = f"page-{label}"
            else:
                label = str(i)
                title = f"Page {i}"
                section_id = f"page-{i:03d}"
            body = text.strip()
            if not body:
                # A blank page is a determined blank, and is recorded as one
                # rather than skipped: a gap in the numbering would read as a
                # missing page, which is a different fact.
                body = "_(no text on this page)_"
            fm = "\n".join([
                "---",
                f"doc_id: {doc_id}",
                f'doc_title: "{a.title or pdf.stem}"',
                f"section_id: {section_id}",
                f'section_title: "{title}"',
                f"pages: {label}-{label}",
                f"pdf_page: {i}",
                f"source_pdf: {pdf.name}",
                f"source_sha256: {sha}",
                f"text_source: {source}",
                "granularity: page",
                "---",
            ])
            (secdir / f"{section_id}.md").write_text(f"{fm}\n{body}\n", encoding="utf-8")
            ids.append((section_id, title, int(label), len(body), len(body.split())))
            written += 1
        manifest = a.outdir / doc_id / "structure.json"
        existing = json.loads(manifest.read_text()) if manifest.exists() else {}
        # Technical metadata, if nothing has written it yet (bean `nso8`).
        #
        # This rung used to write NONE, and it merges into whatever
        # `pdf-structure.py` left behind — so a document that rung never
        # touched ended up with no `source` at all. Measured 2026-09-19:
        # `library/milnorlink/` was exactly that, while the other two
        # page-granularity entries had `source` only because `pdf-structure`
        # ran on them first. The no-outline path was second-class by accident.
        #
        # `setdefault`, not `update`: where `pdf-structure` has already written
        # `source` it knows strictly more than this rung does — `pages` and the
        # `extractor` it used — and overwriting that with a subset would lose
        # provenance to fix an absence.
        existing.setdefault("source", tech_meta(str(pdf)))
        # The page count, which this rung KNOWS (one section per page) and
        # `tech_meta` does not record. Without it a document that only this
        # rung touched — a scan, through pdf-ocr — published no `meta.pages`:
        # who-iris's `who-pub-tps-931` lost its "121 pages" on re-ingest
        # (bean `turh`) while its pdf-structure siblings kept theirs.
        # `setdefault`, for the same reason as `source` above.
        existing["source"].setdefault("pages", len(texts))
        # Where the section text came from, in ONE field with ONE vocabulary
        # (issue #1121): `source.text_source`, `embedded | ocr`, as
        # `pdf-structure.py` writes it. Set, not setdefault: these page sections
        # are made from THIS rung's text, so its answer is the true one even
        # where `pdf-structure` wrote `source` first. The old top-level
        # `text_source` (`text-layer | ocr`) is removed, not kept beside it.
        existing["source"]["text_source"] = source
        existing.pop("text_source", None)
        # Which software made OCR'd text (bean `turh`): the reference to the
        # `folio-run-context/v1` `pdf-ocr.py` wrote beside the pages. Set or
        # removed, never kept from an earlier run: it describes THIS text.
        ctx = (_run_context.read_ref(ocr_cache_dir(str(a.outdir), str(pdf)))
               if source == "ocr" else None)
        if ctx:
            existing["source"]["runContext"] = ctx
        else:
            existing["source"].pop("runContext", None)
        # The PDF's own Info dictionary, which this rung once dropped (#1794).
        merge_docinfo(existing, pdf_docinfo(pdf))
        existing.update({
            "_schema": existing.get("_schema", "pdf-structure/v1"),
            "doc_id": doc_id,
            "toc_source": outline_state(pdf),
            "granularity": "page",
            # EXACTLY the section shape `pdf-structure.py` writes, field for
            # field. `pipeline/gen-library-jsonld.ts` reads `sec.id`,
            # `page_start` and `page_end`, and an invented `section_id` crashed
            # it with `undefined is not an object (evaluating 'sectionId.match')`
            # — the same "two spellings of one concept" defect this file's own
            # `_load_slugify` comment is about, made one field further along.
            # A consumer of `library/` reads one shape; there is no version of
            # this script that gets to have its own.
            "sections": [
                {
                    "id": sid,
                    "number": None,
                    "title": t,
                    "level": 1,
                    "page_start": pstart,
                    "page_end": pstart,
                    "n_chars": nchars,
                    "n_words": nwords,
                }
                for sid, t, pstart, nchars, nwords in ids
            ],
            "structure_note": (
                "Ingested at PAGE granularity by scripts/pdf-pages.py. This PDF carries no "
                "embedded outline and its inferred chapter structure was measurably wrong "
                "(bean 6xaz), so no chapter tree is claimed. A page is a determined division; "
                "an inferred chapter was not."
            ),
        })
        # The title (bean `w6fu`). This rung has no text walk, so the only raw
        # title is the one the caller passed with --title, or none -- and with
        # none the manifest falls back to the doc id, as it always did. The
        # resolver replaces it only with a title another source CORROBORATES,
        # marks it unverified otherwise, and never touches an editor's
        # `title_correction`.
        prior = existing.get("metadata") or {}
        if a.title and "title_raw" not in prior:
            prior = {**prior, "title": a.title}
        existing["metadata"] = resolve_title(prior, evidence_from_pdf(str(pdf)), doc_id)
        manifest.write_text(json.dumps(existing, indent=2) + "\n", encoding="utf-8")
        print(f"ok  {doc_id:34s} {written:3d} pages  [{source}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
