#!/usr/bin/env python3
"""
pdf-structure — turn an opaque upload into greppable, structured text.

Reads a PDF and emits a domain-neutral structure artefact:

    uploads/<doc-id>/
      structure.json          pdf-structure/v1 — metadata + TOC + section index
      sections/NN-slug.md     one file per section, YAML front-matter + text

The `sections/` tree is the point. Agents in this project find things by
grepping (`AGENTS.md` §"Before declaring open ... corpus-grep checklist"),
and `uploads/` is the one part of the corpus that grep cannot see, because
it is 339 PDFs. Extracting sections to plain Markdown makes uploads a
first-class grep path, with the front-matter naming the document and page
so a hit is immediately citable.

This script is deliberately **domain-neutral**: no math logic, no WHO
logic. It produces structure. Class-specific extractors (formalization
candidates, L1 recommendation blocks) consume `structure.json` and are
separate — see docs/proposals/rag-document-ingestion.md §7.

Metadata is derived from the *text*, not from the PDF DocInfo dictionary:
measured over the qou corpus only 126 of 339 documents (37%) carry a
plausible `/Title`, while the arXiv stamp is reliably present in page-1
text for arXiv papers, both new-style (`arXiv:0706.2213v3 [math.GT]`) and
old-style (`arXiv:hep-th/0001202v2`). DocInfo is recorded as a
cross-check, never as the source of truth.

THE TITLE IS THE EXCEPTION (issue #1794, owner's ruling 2026-10-01).
`metadata.title`, the page-1 front-matter guess, is NEVER a library entry's
title. It guessed "Abies" for the WHO editorial style manual. The manifest
title is taken from the catalogue record, then `referenced.json`, then this
artefact's `metadata.docinfo.Title` (junk-filtered), then the slug. See
`pipeline/library-title.ts`. The guess is still written, for search
and for the section files' `doc_title`. Keep writing `docinfo`: for a title
it outranks the guess.

Table of contents comes from the PDF outline when there is one (194 of
339, 57%). Otherwise it is inferred from the LAYOUT (`_pdf_headings`): a
printed contents page if the document has one, else lines set in a heading
style (size, weight, capitals, numbering). The text-pattern heuristic
`infer_headings` is the last resort, for OCR'd text, which has no fonts.
Which route was used is recorded per entry (`source`) and, for an inferred
TOC, in `diagnostics.toc_inferred_method`, so a consumer can weight it.

Usage:
    pdf-structure.py <pdf> [<pdf>...] [-o OUTDIR] [--no-sections] [--json]
    pdf-structure.py --corpus uploads/ -o uploads/
    pdf-structure.py <pdf> --backend pymupdf     # force a backend

Backends: the reader is swappable (see the "backends" section). PyMuPDF is
preferred when installed because its text layer is cleaner on math PDFs and,
more importantly, it exposes the embedded bookmarks directly (`get_toc()`) —
real section boundaries instead of the text-heuristic guess in
`infer_headings`. pypdf is the fallback, so this runs wherever either library
is present; the extractor used is recorded in `source.extractor`.

Dependencies (either one suffices; both optional at import time):
    pypdf    (BSD-3-Clause)  — pip install pypdf
    PyMuPDF  (AGPL-3.0)      — pip install pymupdf   (preferred; see licence note
                                                       in the backends section)
"""

from __future__ import annotations

import argparse
import contextlib
import glob
import hashlib
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict
import sys
import warnings
from dataclasses import dataclass, field, asdict, replace
from typing import Any

warnings.filterwarnings("ignore")

# The PDF reader is chosen at runtime -- see the "backends" section. Both
# PyMuPDF (preferred) and pypdf are imported lazily inside their backends, so
# this module loads wherever *either* is installed, and a broken or absent
# pypdf no longer blocks the PyMuPDF path (the failure that first motivated
# this abstraction). `import_pypdf` carries the cryptography-panic workaround
# documented in scripts/_pypdf_compat.py; the "no backend at all" check lives
# in `open_backend`.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pypdf_compat import import_pypdf  # noqa: E402

# `slugify`, the doc-id and where a document's OCR cache lives. Shared rather
# than defined here because `pdf-ocr.py` must spell all three identically —
# bean `rlp5`, where `-o` meant two different things and the OCR step did not
# compose with this one.
from _pdf_text import join_soft_hyphens  # noqa: E402
from _text_quality import page_problem  # noqa: E402
from _pdf_doc_id import (  # noqa: E402
    derive_doc_id,
    find_ocr_cache,
    slugify,
)
# The title, from the sources that can vouch for it (bean `w6fu`). Shared with
# `pdf-pages.py` and `ingest-document.ts --refresh-title`, so the three agree
# about what a title is.
from _pdf_title import BROWSER_RE, apply as resolve_title, evidence_from_pdf  # noqa: E402
# Which software made OCR'd text: the `folio-run-context/v1` `pdf-ocr.py` wrote
# beside it, cited by digest (bean `turh`).
import _run_context  # noqa: E402

# The layout-based fallback (issue #2302): headings read from font metrics,
# or from a printed contents page. Measured against held-out outlines by
# `toc-benchmark.py`; see docs/research-and-analysis/toc-extraction.md.
import _pdf_headings  # noqa: E402
import _latex_headings  # noqa: E402
import _pdf_figures  # noqa: E402
import _pdf_page_labels  # noqa: E402

SCHEMA = "pdf-structure/v1"

# ---------------------------------------------------------------- patterns

# arXiv stamp printed down the left margin of page 1 by arXiv itself.
# Two eras: 0706.2213v3 (2007-04 onward) and hep-th/0001202v2 (before).
RE_ARXIV_NEW = re.compile(
    r"ar\s*X\s*iv\s*[:.]?\s*(?P<id>\d{4}\.\d{4,5})\s*(?P<ver>v\d+)?"
    r"(?:\s*\[(?P<cls>[a-zA-Z\-]+(?:\.[A-Za-z\-]{2,})?)\])?",
    re.I,
)
RE_ARXIV_OLD = re.compile(
    r"ar\s*X\s*iv\s*[:.]?\s*(?P<id>[a-zA-Z\-]+(?:\.[A-Z]{2})?/\d{7})\s*(?P<ver>v\d+)?",
    re.I,
)
RE_DOI = re.compile(r"\b(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+?)(?=[\s,;)\]]|$)")
RE_DATE = re.compile(
    r"\b(\d{1,2}\s+"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b"
)

# A heading, for the 43% of documents with no PDF outline.
RE_NUMBERED = re.compile(r"^\s{0,6}(\d{1,2}(?:\.\d{1,2}){0,3})\.?\s+(\S.{1,86})$")
RE_ROMAN = re.compile(r"^\s{0,6}([IVXLC]{1,6})\.\s+([A-Z]\S.{1,86})$")
NAMED = (
    "abstract", "introduction", "preliminaries", "background", "notation",
    "conclusion", "conclusions", "discussion", "references", "bibliography",
    "acknowledgements", "acknowledgments", "appendix",
)
RE_NAMED = re.compile(
    r"^\s{0,6}((?:appendix\s+[a-z0-9]{1,3}[.:]?\s*)?(?:" + "|".join(NAMED) + r"))\s*$",
    re.I,
)
MONTHS = (
    "January|February|March|April|May|June|July|August|September|October|"
    "November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec"
)
# Lines that look like headings but are not.
RE_NOT_HEADING = re.compile(
    r"(?:"
    r"\.\s*$"            # ends in a full stop — a sentence
    r"|^\s*\(\d+\)"      # numbered equation
    r"|^\s*\[\d+\]"      # bibliography entry
    r"|\bet\s+al\b"
    r"|\d{4}\)\s*$"      # trailing citation year
    r"|\b(?:" + MONTHS + r")\b\s*\d{0,4}\s*$"   # a date line
    r"|\b(?:19|20)\d{2}\b"                       # any year — dates, citations
    r"|^\s*\S+\s*\(\d+\)\s*$"                    # "1 (9)" equation reference
    r")",
    re.I,
)
# An author line: "A. Smith, B. Jones and C. Lee" / "SMITH, JONES, AND LEE".
# Periods must be allowed — initials are near-universal — so a sentence is
# excluded by looking for ". " followed by a lower-case word instead.
RE_AUTHORS = re.compile(r"^[A-ZÀ-ʯ](?![^\n]*[.!?]\s+[a-z])[^!?]{2,120}$")

# Marks that only a byline carries: an initial ("D. J."), an affiliation
# superscript ("Kreimer 2)", "Lv*1"), or a dagger/asterisk footnote. A title
# continuation has none of these, so their presence outranks the abstract test.
RE_BYLINE_MARKER = re.compile(
    r"(?:\b[A-ZÀ-ʯ]\.(?:\s|$)"          # an initial with its period
    r"|\d\s*\)"                          # "1)" affiliation marker
    r"|[∗*†‡§]"                           # footnote marks
    r"|\b[A-ZÀ-ʯ][a-zà-ʯ]+\s*\*?\d)"     # "Lv*1", "Zhou 2"
)

# Punctuation that betrays a list of names: a comma between them, or a
# conjunction. Necessary but far from sufficient — see `looks_like_byline`,
# which uses it as one of two routes and vetoes both with the abstract test.
RE_AUTHOR_HINT = re.compile(r"(,\s|\band\b|\&)", re.I)
# Words that join names in a byline, and carry no evidence either way.
BYLINE_CONNECTORS = {"and", "&", "und", "et", "e", "y"}
# Nobiliary particles and name prefixes, which are lower-case yet name-like.
NAME_PARTICLES = {
    "van", "von", "de", "der", "den", "del", "della", "di", "da", "das", "dos",
    "du", "la", "le", "ten", "ter", "bin", "ibn", "al", "mac", "mc", "st",
}
# Function words a *title* uses and a byline does not. Their presence is the
# cheapest proof that a line is title text rather than a list of names.
TITLE_FUNCTION_WORDS = {
    "a", "an", "the", "of", "for", "in", "on", "with", "to", "from", "via",
    "at", "as", "into", "over", "under", "between", "through", "without",
    "upon", "its", "their", "some", "new", "toward", "towards", "about",
    "against", "among", "beyond", "near", "per", "than", "that", "which",
    "when", "where", "why", "how", "is", "are", "be", "do", "does",
}
# Lines that end the title even though they are neither a byline nor the
# abstract marker: a numbered section heading, or the start of a table of
# contents. Without this the title runs on into the body — a bound book
# chapter with no byline took its whole first paragraph as its title.
RE_TITLE_STOP = re.compile(
    r"^\s*(?:\d+(?:\.\d+)*\.?\s+[A-ZÀ-ʯ]"
    r"|contents\b|table of contents\b|introduction\b|keywords?\b|key words\b)",
    re.I,
)
# Report numbers / preprint stamps that precede the title.
RE_REPORT_NO = re.compile(
    r"^\s*(?:[A-Z]{2,}[-–—/]{1,2}[\w\-–/.]*\d|[a-z\-]+(?:\.[A-Z]{2})?/\d{7}"
    r"|preprint\b|submitted\b|\d{1,2}\s+(?:" + MONTHS + r")\s+\d{4}"
    # Journal front matter, in the order a published paper prints it:
    # a publisher mark ("msp"), the masthead ("ALGEBRA AND NUMBER THEORY
    # 14:7 (2020)"), then the DOI. Without these three a split journal
    # paper takes the publisher mark as its title — all ten papers of a
    # bound issue came out titled "msp".
    r"|\S{1,4}\s*$"
    # A journal name then "vol (year)" or "vol:issue". Commas and colons
    # have to be allowed inside the name or the pattern cannot cross them
    # — "Symmetry, Integrability and Geometry: Methods and Applications
    # SIGMA 7 (2011), 115" went unrecognised and became a paper's title.
    r"|[A-Za-z][A-Za-z\s&.,:\-]{5,}\s+\d{1,4}\s*[:(]\s*\d"
    r"|Vol(?:ume)?\.?\s*\d+\s*[,.(]"
    # An ISSN banner and a publication-date line, both printed above the
    # title on society offprints. Neither was recognised, and once the
    # start index stopped at the first non-furniture line rather than the
    # last furniture line, an unrecognised banner became the title itself.
    #
    #   0| ISSN 1472-2739 (on-line) 1472-2747 (printed) 537
    #   1| Algebraic & Geometric Topology
    #   3| Volume 3 (2003) 537-556
    #   4| Published: 16 June 2003
    #   5| Skein-theoretical derivation          <- the title starts here
    r"|ISSN\b|e-ISSN\b"
    r"|(?:Published|Received|Accepted|Revised)\s*:?\s*\d{1,2}\s+\w+\s+\d{4}"
    # Publisher furniture that prints ABOVE the title and was being taken
    # as the title: a submission banner, a download stamp, an
    # article-listing masthead, and the society banner that opens an AMS
    # or Springer offprint.
    r"|prepared\s+for\s+submission\b|downloaded\s+from\b"
    r"|contents\s+lists\s+available\b|journal\s+homepage\b"
    r"|(?:transactions|proceedings|communications|annals|bulletin|journal)\s+"
    r"(?:of|in)\b[^\n]{0,60}$"
    r"|https?://|doi\s*:|\bdoi\.org\b)",
    re.I,
)

# PDF text extraction damages words in two systematic ways. Both corrupt
# every downstream consumer at once — the title, the index brief, and the
# section text that corpus-grep runs over — so they are repaired here at
# the producer rather than in each reader.
LIGATURES = str.maketrans({
    "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi",
    "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st",
})
# A floating accent emitted before its letter: "Gr¨ obner" -> "Gröbner",
# "J ´ER ˆOME" -> "JÉRÔME".
ACCENTS = {"¨": "̈", "´": "́", "`": "̀", "ˆ": "̂", "˜": "̃"}
RE_FLOAT_ACCENT = re.compile("([" + "".join(ACCENTS) + r"])\s*([A-Za-z])")
# A capital separated from the rest of its word by kerning: "V olume".
RE_SPLIT_CAP = re.compile(r"\b([A-Z])\s+([a-z]{2,})\b")


# Two adjacent all-caps runs, Unicode-aware. `[A-Z]` is ASCII-only in
# Python's re, which left "GR ÖBNER" and "J ÉR ÔME" split precisely for
# the accented names the accent repair had just fixed.
RE_CAPS_PAIR = re.compile(r"(?<![^\W\d_])([^\W\d_]+)\s+([^\W\d_]+)(?![^\W\d_])")


def repair_text(s: str) -> str:
    """Deterministic half: ligatures and floating accents only.

    Safe to apply anywhere — neither needs to know the document, and both
    are unambiguous. Anything that has to guess belongs in `rejoin_caps`,
    which can consult the document's own vocabulary.
    """
    if not s:
        return s
    s = s.translate(LIGATURES)
    s = unicodedata.normalize(
        "NFC", RE_FLOAT_ACCENT.sub(lambda m: m.group(2) + ACCENTS[m.group(1)], s))
    return re.sub(r"\s{2,}", " ", s)


def rejoin_caps(s: str, vocab) -> str:
    """Vocabulary-gated half: undo arbitrary splits in all-caps runs.

    All-caps words get broken at arbitrary points by kerning — "STA VROS
    GAROUF ALIDIS" — and nothing about the *shape* of two capitalised
    fragments says whether they are one word or two. The document's own
    text decides.

    `vocab` is a Counter of lower-cased tokens, and the counts are load
    bearing: mere presence is not enough in either direction, because a
    document that carries this damage attests its own artefacts. "BASES
    FOR" was welded into one token because "basesfor" appeared elsewhere,
    and "NON-CRYST ALLOGRAPHIC" was left broken because the same damaged
    header repeats on every page, so "cryst" and "allographic" are both
    "words" too.

    Frequency separates them. A real word beats the fragments it was
    broken into (`crystallographic` 30 vs `cryst` 5), while a damage
    artefact loses to the real words it welded (`basesfor` 1 vs `for` 200).
    """
    if not vocab:
        return s

    def freq(w):
        return vocab.get(re.sub(r"[^\w]", "", w).lower(), 0)

    # A capital kerned away from the rest of its word: "V olume". Gated on
    # attestation, because the same shape is also a symbol followed by an
    # ordinary word — ungated, this turned the French "Soit K un corps"
    # into "Soit Kun corps".
    #
    # Attestation of the JOIN is not enough on its own, because the join can
    # be a real word while the split was never damage. Seidel's title, "A long
    # exact sequence for symplectic Floer cohomology", became "Along exact
    # sequence": `along` is attested on nearly every page of a symplectic
    # paper, so the join passed — and the paper this repo most wanted became
    # unfindable by its own name.
    #
    # A genuine kerning split leaves a fragment, not a word: "olume", "ector",
    # "opology". So the tail must be unattested as well. Erring this way is
    # the safe direction — a missed join leaves text readable, a wrong join
    # destroys a title.
    s = RE_SPLIT_CAP.sub(
        lambda m: m.group(1) + m.group(2)
        if freq(m.group(1) + m.group(2)) and not freq(m.group(2))
        else m.group(0), s)

    # Whole runs, longest first. A name can be broken more than once —
    # "J ÉR ÔME" — and joining pairwise never fires there, because the
    # intermediate "JÉR" is not a word and so is not attested. Only the
    # full run is.
    toks = re.split(r"(\s+)", s)
    out: list[str] = []
    i = 0
    while i < len(toks):
        run = []
        j = i
        while j < len(toks) and toks[j].strip() and toks[j].isupper():
            run.append(toks[j])
            j += 2                      # skip the separator between tokens
        joined = None
        for k in range(len(run), 1, -1):
            cand = "".join(run[:k])
            words = [(m.start(), m.end(), m.group(0))
                     for m in re.finditer(r"[^\W\d_]+", cand)]
            seams, ok = [], True
            for f in run[:k - 1]:
                seams.append((seams[-1] if seams else 0) + len(f))
            for idx, seam in enumerate(seams):
                # The word formed AT THE SEAM, not the whole concatenation:
                # "GR" + "ÖBNER-SHIRSHOV" makes "GRÖBNER", and asking
                # whether "gröbnershirshov" is a word answers a question
                # nobody posed. Every seam is checked, because checking
                # only the first once swallowed a whole title into one
                # token on a run whose first seam was a real join.
                w = next((t for a, b, t in words if a < seam <= b), "")
                if len(w) < 4 or not freq(w):
                    ok = False
                    break
                left = re.findall(r"[^\W\d_]+", run[idx])
                right = re.findall(r"[^\W\d_]+", run[idx + 1])
                # The join has to actually make a word. When a fragment
                # ends in a non-letter the seam word is just that fragment
                # unchanged — "HYPERBOLIC" + "3-MANIFOLDS" seams on
                # "HYPERBOLIC" — and every frequency test then compares the
                # word with itself and passes, welding two real words.
                if not left or not right or w in (left[-1], right[0]):
                    ok = False
                    break
                if freq(w) < min(freq(left[-1]), freq(right[0])):
                    ok = False
                    break
            if ok:
                joined, i = cand, i + 2 * k - 1
                break
        if joined:
            out.append(joined)
        else:
            out.append(toks[i])
            i += 1
    return "".join(out)


# ---------------------------------------------------------------- structures

@dataclass
class TocEntry:
    level: int
    title: str
    page: int | None
    source: str            # "outline" | "inferred"
    number: str | None = None
    # For an inferred entry only: how sure the inference is (0..1) and which
    # independent evidence agreed — "contents", "body", "style", "number", ...
    # (`_pdf_headings.consensus_headings`). None for an outline entry, which is
    # the document's own answer and is not scored.
    confidence: float | None = None
    evidence: list[str] | None = None
    # The printed label of `page` ("iv", "23") where one is known — what a
    # reader cites. `page` stays the physical index.
    page_label: str | None = None


@dataclass
class Section:
    id: str
    number: str | None
    title: str
    level: int
    page_start: int | None
    page_end: int | None
    n_chars: int
    n_words: int
    text: str = field(repr=False, default="")
    # Printed labels of page_start / page_end, where known.
    label_start: str | None = None
    label_end: str | None = None


def _tech_meta(path: str) -> dict:
    """`scripts/_tech_meta.py`'s `tech_meta`, loaded by path (hyphenless import)."""
    import importlib.util as _u
    spec = _u.spec_from_file_location("_tech_meta", os.path.join(os.path.dirname(__file__), "_tech_meta.py"))
    mod = _u.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.tech_meta(path)


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()




# ---------------------------------------------------------------- extraction
#
# Page text and the raw outline now come from a backend (see the "backends"
# section); the shared `_toc_entries` there turns a backend's raw TOC into
# `TocEntry` values. `infer_headings` is the fallback used only when a
# document carries no embedded outline.

# The fraction at which "most of them" stops being a coincidence and becomes a
# finding. Used by BOTH table-of-contents judgements — the per-page pre-filter
# inside `infer_headings` and the post-hoc `inferred_toc_verdict` below — because
# they are the same judgement asked at two scopes, and two spellings of one
# threshold is two numbers to keep in agreement. Bean `6xaz`.
TOC_MAJORITY = 0.6

# Below this, concentration is not evidence: two of three entries on one page is
# 67% and says nothing about the document. At five, a majority means at least
# three entries agreeing.
TOC_MIN_ENTRIES_FOR_VERDICT = 5

# How many source pages an inferred table of contents may concentrate on before
# it stops being a document's structure. Two, not one, because a contents
# section routinely runs to a second page — which is exactly the shape
# `WHO_PUB_TPS_93.1` failed in.
TOC_MAX_CONCENTRATED_PAGES = 2


def toc_concentration(toc: list["TocEntry"]) -> tuple[float, list[int]]:
    """
    What fraction of entries claim to start on the {TOC_MAX_CONCENTRATED_PAGES}
    commonest source pages, and which pages those are.

    A real document's headings are spread through its body. A list SCRAPED FROM
    a page — a contents page, or a sample table reproduced as an example — has
    every entry stamped with the page the list was found on, because that is
    where the text was.
    """
    pages = [e.page for e in toc if e.page is not None]
    if not pages:
        return 0.0, []
    counts = Counter(pages)
    top = counts.most_common(TOC_MAX_CONCENTRATED_PAGES)
    return sum(n for _, n in top) / len(pages), sorted(p for p, _ in top)


def inferred_toc_verdict(toc: list["TocEntry"], n_pages: int) -> str | None:
    """
    `None` when an inferred table of contents may be trusted; otherwise the
    reason it may not, for the record — bean `6xaz`.

    **This is only ever asked of an INFERRED table of contents.** One read from
    a PDF's embedded outline is the document's own answer and is never second-
    guessed here; `9789241548960_eng.pdf`'s 250 outline-derived sections must
    come out identical whatever this function does.

    The two failures that motivated it share a root cause and no symptom, which
    is why the measure is concentration rather than spread:

    - `WPR-RDO-2020-003-eng.pdf` — 11 of 13 entries read off **a sample table**
      the style guide reproduces as a design example, every one stamped page 22.
      The other two were real, so the page SPREAD was 3 and a spread test would
      have passed it.
    - `WHO_PUB_TPS_93.1.pdf` — titles correct, but every page number taken from
      the contents page it was found on, so 42 sections claimed pages 2 and 4.
      26 of them came out under 500 characters while 37,923 landed in one.

    Emitting either is worse than emitting nothing: a misnamed section is
    greppable, sits in `library/`, and answers a question wrongly with
    authority. `split_sections` on an empty TOC yields one `sec-000-document`
    holding the whole text — a determined division, and still greppable.
    """
    if len(toc) < TOC_MIN_ENTRIES_FOR_VERDICT:
        return None
    # A document with no more pages than the window cannot fail this test: its
    # entries have nowhere else to be, so concentration carries no information.
    if n_pages <= TOC_MAX_CONCENTRATED_PAGES:
        return None
    frac, pages = toc_concentration(toc)
    if frac >= TOC_MAJORITY:
        return (
            f"{len(toc)} inferred entries, {frac:.0%} of them starting on "
            f"page(s) {', '.join(str(p) for p in pages)} of {n_pages} — a list "
            f"found ON a page, not the document's structure"
        )
    return None


# The second test an inferred table of contents must pass: the mean of its
# entries' confidence (`consensus_headings`). Owner's decision on issue #2302,
# 2026-10-07: "Use the inferred contents when it passes the cross-check" — the
# `6xaz` concentration verdict above AND a mean confidence of at least this —
# "otherwise fall back to page granularity".
#
# What the number means, measured on the 40 corpus PDFs of 2026-10-07: an entry
# scores 0.6 when its heading STYLE alone found it in an unnumbered document,
# and more when a contents page, a numbering run or another method agrees. So a
# mean of exactly 0.6 is a list nothing corroborated, which this floor lets
# through (as decided); an entry with no confidence at all — the regex
# fallback's — counts as 0, so a regex-only list never passes.
TOC_MIN_MEAN_CONFIDENCE = 0.6


# The third test (owner, issue #2302, 2026-10-07: "Add a third test"): a tree
# whose sections come out EMPTY is headings without bodies — logo lettering, a
# sample table's column heads, a cover's address block — not chapters. Refused
# when more than this share of its sections hold fewer than
# TOC_EMPTY_SECTION_CHARS characters, front matter not counted.
#
# Measured 2026-10-07 on 72 corpus PDFs (35 with an outline, hidden and used as
# the answer key): every inferred tree with title F1 >= 0.7 had at most 20% of
# its sections under 50 characters (the highest, 2608.08453v1 at 0.20, F1 1.0).
# Above 25% sat WPR-RDO-2020-003-eng (43%: 18 empty sections of logo text and
# table heads, mean confidence 0.602, which the first two tests passed) and
# three documents those tests already refuse. So at 25% the WPR style guide is
# the one document newly refused, and no good tree is. Known miss: a poor tree
# at 22.5% (strauch-carbno, F1 0.36) sits too near the good ones to separate.
TOC_MAX_EMPTY_SHARE = 0.25
TOC_EMPTY_SECTION_CHARS = 50

# The fourth test (bean `inkl`, issue #2302): a tree whose entries largely fail
# to locate in the body collapses its structure into the few sections that did
# match. Measured on 9789240099456-eng (WHO immunizations DAK, 100pp): 21
# inferred entries (mean confidence 0.70, spread across pages 12..96) cut only
# 7 body sections (+ front matter = 8) because 14 of the 21 entries — including
# all eight "Component N." divisions — produced no section, and the remaining 7
# non-empty sections passed the first three tests. Refused when more than this
# share of inferred entries fail to produce a section.
TOC_MAX_COLLAPSED_SHARE = 0.25


def toc_empty_share(sections: list["Section"]) -> tuple[float, int]:
    """(share of sections under TOC_EMPTY_SECTION_CHARS, how many were judged),
    front matter excluded — it is the text before the first heading, not one."""
    body = [x for x in sections if x.id != "sec-front-matter"]
    if not body:
        return 0.0, 0
    return sum(1 for x in body if x.n_chars < TOC_EMPTY_SECTION_CHARS) / len(body), len(body)


def toc_mean_confidence(toc: list["TocEntry"]) -> float:
    """Mean confidence of an inferred TOC; an entry without one counts as 0."""
    if not toc:
        return 0.0
    return sum(e.confidence or 0.0 for e in toc) / len(toc)


def inferred_toc_trust(toc: list["TocEntry"], pages: list[str],
                       from_source: bool = False) -> tuple[str | None, float | None, float | None]:
    """(reason it may not be used or None, mean confidence, empty-section
    share) for an inferred TOC over the document's page texts.

    The four tests in order: the `6xaz` concentration verdict, the mean
    confidence floor, the share of empty sections the tree would cut, then the
    share of inferred entries that fail to produce a section (judged from
    TOC_MIN_ENTRIES_FOR_VERDICT up, as concentration is). The first reason
    found is the one recorded. All `None` for an empty list — there is nothing
    to trust or distrust, and nothing to report.

    `from_source` is a TOC taken from the paper's LaTeX: its entries are the
    author's and not a list found on a page, so the concentration verdict,
    which exists to catch exactly that, does not apply. The confidence,
    empty-section and collapse tests still do.
    """
    if not toc:
        return None, None, None
    mean = round(toc_mean_confidence(toc), 3)
    share, judged = toc_empty_share(split_sections(pages, toc))
    share = round(share, 3)
    collapsed = (len(toc) - judged) / len(toc)
    reason = None if from_source else inferred_toc_verdict(toc, len(pages))
    if reason is None and mean < TOC_MIN_MEAN_CONFIDENCE:
        reason = (f"{len(toc)} inferred entries with mean confidence {mean:.2f}, "
                  f"below the {TOC_MIN_MEAN_CONFIDENCE} floor — too little evidence agreed")
    if reason is None and judged >= TOC_MIN_ENTRIES_FOR_VERDICT and share > TOC_MAX_EMPTY_SHARE:
        reason = (f"{share:.0%} of the {judged} sections it would cut hold under "
                  f"{TOC_EMPTY_SECTION_CHARS} characters (more than {TOC_MAX_EMPTY_SHARE:.0%}) — "
                  f"headings without bodies, not chapters")
    if reason is None and len(toc) >= TOC_MIN_ENTRIES_FOR_VERDICT and collapsed > TOC_MAX_COLLAPSED_SHARE:
        reason = (f"{len(toc)} inferred entries cut only {judged} section(s) "
                  f"({collapsed:.0%} of entries produced no section, more than "
                  f"{TOC_MAX_COLLAPSED_SHARE:.0%}) — contents collapse in the body")
    return reason, mean, share


# A line in the top or bottom margin of its page: this share of the height.
FURNITURE_MARGIN = 0.05
# Body-sized: running heads are set at or a little above the body size (PHC
# 10 pt over 9 pt body); a chapter label in the margin ("CHAPTER 3", 12 pt) is not.
FURNITURE_MAX_SCALE = 1.15
# Repeated in the margin of at least this many pages.
FURNITURE_MIN_PAGES = 3
RE_FOLIO = re.compile(r"^[\W_]*(?:\d{1,4}|[ivxlc]{1,7})[\W_]*$", re.I)


def _printed(text: str) -> str:
    """A line as printed: control characters dropped, spaces collapsed."""
    return re.sub(r"\s+", " ", "".join(c for c in text if c.isprintable())).strip()


def _furniture_key(text: str) -> str:
    """The line's form with its numbers ignored, so "page 11" and "page 12"
    count as one running footer."""
    return re.sub(r"\d+", "#", _printed(text).lower())


def page_furniture(lines: list | None) -> dict[int, list[str]]:
    """The running heads, footers, folios and side tabs on each page.

    Page text keeps them, so a section's text carried its chapter title and page
    number at every page break (9789240116191-eng repeats the chapter title and
    folio at the foot of every page; 9789240101197-eng its side navigation tabs;
    9789240093362-eng the handbook title). Each DTH L1 was cleaned by hand.

    A line is furniture when it sits in the top or bottom margin and is either a
    bare folio, or body-sized text whose form (digits ignored) recurs in the
    margin of three or more pages at the same height. A short chapter's running head recurs on
    only a few pages, so the bar is a page count, not the share of the document
    that `_pdf_headings.furniture_keys` uses for headings.
    """
    if not lines:
        return {}
    bsize = _pdf_headings.body_size(lines)
    margin = []
    for l in lines:
        h = l.page_height or 0
        if h and (l.y0 < FURNITURE_MARGIN * h or l.y1 > (1 - FURNITURE_MARGIN) * h):
            margin.append(l)
    # A running head is printed at the same height on every page it is on; a
    # callout ("TIP") that happens to reach the margin is not.
    def place(l) -> tuple[str, int]:
        return (_furniture_key(l.text), round(l.y0 / 4))
    pages_of: dict[tuple[str, int], set[int]] = defaultdict(set)
    for l in margin:
        pages_of[place(l)].add(l.page)
    out: dict[int, list[str]] = defaultdict(list)
    for l in margin:
        text = l.text.strip()
        if not text:
            continue
        folio = bool(RE_FOLIO.match(text))
        repeated = (l.size <= FURNITURE_MAX_SCALE * bsize
                    and len(pages_of[place(l)]) >= FURNITURE_MIN_PAGES)
        if folio or repeated:
            out[l.page].append(text)
    return dict(out)


def strip_furniture(pages: list[str], lines: list | None) -> tuple[list[str], int]:
    """`pages` with each page's furniture lines removed, and how many went.

    One page-text line is removed per furniture line found on that page, matched
    on its printable text, so body text that happens to repeat a running head
    elsewhere on the page stays.
    """
    furniture = page_furniture(lines)
    if not furniture:
        return pages, 0
    out: list[str] = []
    removed = 0
    for i, text in enumerate(pages, start=1):
        # Matched on the exact printed text: the folio "20" must not take the
        # step number "1" with it.
        todo = [_printed(t) for t in furniture.get(i, [])]
        if not todo:
            out.append(text)
            continue
        kept: list[str] = []
        for line in text.split("\n"):
            k = _printed(line)
            if k and k in todo:
                todo.remove(k)
                removed += 1
                continue
            kept.append(line)
        out.append("\n".join(kept))
    return out, removed


# A flat outline is reordered when more than this share of its neighbours run
# backwards in page.
OUTLINE_DISORDER = 0.1


def repair_outline(entries: list[TocEntry], pages: list[str] | None = None) -> tuple[list[TocEntry], bool]:
    """Line breaks in titles joined, and a flat outline put in page order.

    An outline is the document's own answer and its entries are kept (bean
    `6xaz`). Two things about it are layout accidents, not answers: a title
    broken over lines ("How to use \\nthis handbook"), and the order of a flat
    outline whose entries run against their pages. 9789240093362-eng lists each
    chapter's sections last to first (pages 21, 20, 18), so its sections came out
    in the wrong order and were re-split by hand. A nested outline is left as
    it is: its order carries the tree.
    """
    fixed = [replace(e, title=re.sub(r"\s+", " ", e.title).strip()) for e in entries]
    if len(fixed) < 3 or len({e.level for e in fixed}) > 1:
        return fixed, False
    paged = [e.page for e in fixed if e.page is not None]
    back = sum(1 for a, b in zip(paged, paged[1:]) if b < a)
    if not paged or back <= OUTLINE_DISORDER * (len(paged) - 1):
        return fixed, False
    # Entries on one page go in the order the page prints them ("Targeted
    # scenarios" above "Targeted users", both on page 23, listed the other way
    # round); one the page text does not show keeps its outline place.
    def where(i: int) -> tuple[int, int, int]:
        e = fixed[i]
        found = locate_heading(pages, e) if pages and e.page is not None else None
        line = found[1] if found and found[0] == e.page - 1 else 10**9
        return (e.page if e.page is not None else 10**9, line, i)
    order = sorted(range(len(fixed)), key=where)
    return [fixed[i] for i in order], True


def split_pages(pages: list[str]) -> list[Section]:
    """One section per physical page — the division that cannot be wrong.

    The shape `pdf-pages.py` writes (`page-001`, "Page 1", a blank page kept
    as a determined blank), so an entry routed here by `pdf-structure` and one
    built by that rung are indistinguishable to every reader of `library/`.
    """
    out: list[Section] = []
    for i, text in enumerate(pages, start=1):
        body = text.strip() or "_(no text on this page)_"
        out.append(Section(f"page-{i:03d}", None, f"Page {i}", 1, i, i, len(body), len(body.split()), body))
    return out


def _heading_key(e: TocEntry) -> str:
    return f"{e.number or ''}|{e.title.lower()}"


def listing_pages(per_page: list[list[TocEntry]]) -> set[int]:
    """
    Pages that LIST headings the document states later — a contents page —
    rather than open them. Bean `6xaz`, shape two.

    `infer_headings` keeps a heading's FIRST occurrence, which is right for a
    running header and wrong for a contents page: the listing comes first, so
    it shadows every chapter it names. Measured on `WHO_PUB_TPS_93.1.pdf`
    (OCR'd, no outline): 16 chapter headings sit on contents pages 2-4 and
    again, once each and in order, in the body (Spelling p8, Punctuation p16,
    ... Technical reports p78). Every boundary landed on pages 2-4, and 26 of
    42 sections came out under 500 characters. The contents-page skip above
    never fired because the OCR moved the page numbers into a column of their
    own, so no line carried a trailing number.

    The test is a property of the page, not a calibrated threshold: at least
    two of its NUMBERED headings recur later, their next occurrences fall on
    DIFFERENT pages, and in the same order. A running header cannot satisfy
    it — two headers repeated on the next page recur on ONE page — and neither
    can a page that opens one chapter.
    """
    where: dict[str, list[int]] = {}
    for pageno, es in enumerate(per_page, start=1):
        for e in es:
            if e.number:
                where.setdefault(_heading_key(e), []).append(pageno)
    out: set[int] = set()
    for pageno, es in enumerate(per_page, start=1):
        nxt = []
        for e in es:
            if not e.number:
                continue
            later = [p for p in where.get(_heading_key(e), []) if p > pageno]
            if later:
                nxt.append(later[0])
        if len(nxt) >= 2 and len(set(nxt)) >= 2 and nxt == sorted(nxt):
            out.add(pageno)
    return out


def infer_headings(pages: list[str]) -> list[TocEntry]:
    """Heading detection for documents with no outline (43% of the corpus)."""
    per_page: list[list[TocEntry]] = []

    for pageno, text in enumerate(pages, start=1):
        found: list[TocEntry] = []
        per_page.append(found)
        # A table-of-contents page is itself a dense list of heading-shaped
        # lines, each ending in the page number it points at. Scraping it
        # yields a whole document's headings all claiming to start on the
        # TOC page — 3 corpus documents had over half their sections on one
        # page for this reason. Detect and skip the page, not the document:
        # its real headings are still found in the body.
        lines_ = text.splitlines()
        heading_ish = [l for l in lines_ if RE_NUMBERED.match(l) or RE_NAMED.match(l)]
        if len(heading_ish) >= 8:
            trailing_page_no = sum(
                1 for l in heading_ish if re.search(r"(?:\.\s*){2,}\d{1,4}\s*$|\s\d{1,4}\s*$", l)
            )
            if trailing_page_no >= TOC_MAJORITY * len(heading_ish):
                continue

        for line in lines_:
            line = line.rstrip()
            if not (3 <= len(line.strip()) <= 92) or RE_NOT_HEADING.search(line):
                continue

            num, title, level = None, None, 1

            m = RE_NUMBERED.match(line)
            if m and not re.match(r"^\d{4}$", m.group(1)):
                num, title = m.group(1), m.group(2).strip()
                level = num.count(".") + 1
                # Section numbers are small; "28 January 2000" is not §28.
                if int(num.split(".")[0]) > 30:
                    continue
                # A real heading starts with a capital and is not mostly digits.
                if not re.match(r"^[A-Z(]", title) or sum(c.isdigit() for c in title) > len(title) / 3:
                    continue
            if title is None:
                m = RE_ROMAN.match(line)
                if m:
                    num, title, level = m.group(1), m.group(2).strip(), 1
            if title is None:
                m = RE_NAMED.match(line)
                if m:
                    title, level = m.group(1).strip().title(), 1
            if title is None:
                continue

            title = re.sub(r"\s{2,}", " ", title).strip(" .")
            found.append(TocEntry(level, title, pageno, "inferred", num))

    listed = listing_pages(per_page)
    entries: list[TocEntry] = []
    seen: set[str] = set()
    for pageno, found in enumerate(per_page, start=1):
        if pageno in listed:
            continue
        for e in found:
            key = _heading_key(e)
            if key in seen:
                continue
            seen.add(key)
            entries.append(e)
    return entries


def layout_lines(path: str, ocr_used: bool) -> list | None:
    """Text lines with their font metrics, or None when there is no layout."""
    if ocr_used:
        return None
    try:
        return _pdf_headings.extract_lines(path) or None
    except Exception:                           # no layout-capable backend
        return None


def infer_page_labels(path: str, lines: list | None, n_pages: int,
                      ocr_pages: list[str] | None = None) -> tuple[list[dict[str, Any]], dict]:
    """The printed label of every physical page, and where sources disagree.

    A scan has no layout, so `lines` is None; its OCR text (`ocr_pages`) still
    carries the folio as a page's first or last line, and those stand in for
    the margins (`_pdf_page_labels.text_margin_lines`, bean `turh`).
    """
    try:
        pdf = _pdf_page_labels.pdf_labels(path)
    except Exception:                           # pypdf only: no /PageLabels read
        pdf = {}
    contents = True
    if not lines and ocr_pages:
        lines = _pdf_page_labels.text_margin_lines(ocr_pages) or None
        contents = False
    if not lines and not pdf:
        return [{"physical": p, "label": None, "source": None, "confidence": 0.0, "evidence": []}
                for p in range(1, n_pages + 1)], {"count": 0, "items": []}
    labels = _pdf_page_labels.page_labels(lines or [], n_pages, pdf=pdf, contents=contents)
    rows = [pl._asdict() | {"evidence": list(pl.evidence)} for pl in labels]
    return rows, _pdf_page_labels.label_conflicts(lines or [], n_pages, pdf, contents=contents)


def infer_figures(path: str, lines: list | None) -> tuple[list[dict[str, Any]], list[str]]:
    """The list of figures and tables, and the gaps in its numbering.

    Read from the layout like the TOC; with no layout there is nothing to
    say, and the answer is an empty list rather than a guess.
    """
    if not lines:
        return [], []
    try:
        graphics = _pdf_figures.graphics_pymupdf(path)
    except Exception:                           # pdfminer only: no graphic evidence
        graphics = {}
    entries = _pdf_figures.figure_list(lines, graphics)
    return [e._asdict() | {"evidence": list(e.evidence)} for e in entries], _pdf_figures.sequence_gaps(entries)


# The share of the LaTeX source's headings the PDF body must confirm before the
# source is taken as this PDF's contents.
LATEX_FOUND_SHARE = 0.5


def infer_toc(lines: list | None, pages: list[str],
              tex: list | None = None) -> tuple[list[TocEntry], str | None]:
    """A table of contents for a document with no outline, and the method.

    The paper's own LaTeX comes first when its source is at hand (`tex`, from
    `_latex_headings`): the author's sectioning commands are the spine and the
    layout supplies only their pages (`_pdf_headings.latex_headings`). It is
    used when the body confirms at least half of them; otherwise the source
    does not describe this PDF (another version, a different file) and the
    layout is read as if there were none. Measured on 60 qou PDFs that carry
    both an outline and their arXiv source, outline hidden as the answer key
    (`toc-benchmark.py`, layout via pymupdf): title F1 0.80 from the source,
    0.49 from the layout alone, 0.82 with this fallback.

    Layout first, text patterns last: the printed contents page cross-checked
    against the body, else heading styles confirmed by numbering, each entry
    carrying its confidence and evidence (`consensus_headings`). Measured over
    the 13 corpus PDFs that carry an outline, with the outline hidden and used
    as the answer key (`toc-benchmark.py`, issue #2302): title F1 0.83 on 20
    held-out PDFs (0.92 on the 13 it was developed on), against 0.26 for
    `infer_headings` alone. The text heuristic stays for
    OCR'd text, which carries no font metrics, and for a document where the
    layout finds nothing.
    """
    if lines and tex:
        scored = _pdf_headings.latex_headings(lines, tex)
        if scored and _pdf_headings.latex_found_share(scored) >= LATEX_FOUND_SHARE:
            return [TocEntry(s.heading.level, s.heading.title, s.heading.page, "inferred",
                             s.heading.number, round(s.confidence, 2), list(s.sources))
                    for s in scored], "latex"
    if lines:
        scored = _pdf_headings.consensus_headings(lines)
        if scored:
            method = "contents" if any("contents" in s.sources for s in scored) else "font"
            return [TocEntry(s.heading.level, s.heading.title, s.heading.page, "inferred",
                             s.heading.number, round(s.confidence, 2), list(s.sources))
                    for s in scored], method
    found = infer_headings(pages)
    return found, ("regex" if found else None)


def looks_like_byline(line: str, abstract_words: set[str]) -> bool:
    """Is `line` a list of author names rather than more of the title?

    This replaces a punctuation test — a line counted as the byline only if it
    held a comma, "and", or "&" — which failed in both directions. Every
    **single-author** byline slipped through and was appended to the title
    (`"FLOER COHOMOLOGY AND PENCILS OF QUADRICS IVAN SMITH"`), and a title
    continuation that happened to contain "and" was taken *as* the byline,
    truncating the title and losing the real authors
    (`"...IN THE MIRROR OF THE PROJECTIVE"` / `"PLANE AND A BINODAL CUBIC
    CURVE"`). Measured on nine documents ingested 2026-08-24, one title in
    nine came out correct.

    Two signals, because neither is sufficient alone.

    **Shape.** A byline is names: capitalised words, initials, and nobiliary
    particles, joined by connectors. One `TITLE_FUNCTION_WORDS` member settles
    it — no byline says "of" or "the". This alone kills the *"PLANE AND A
    BINODAL CUBIC CURVE"* case on its bare article "A".

    **The abstract.** Shape cannot separate `"TOM BRIDGELAND"` from
    `"TORUS KNOT"`; both are two capitalised words. But an author is rarely
    named in their own abstract, while the nouns of a title are almost always
    restated in it. So a line whose name-like words are mostly *already in the
    abstract* is title text. Majority rather than any single hit, so a paper
    whose author shares a surname with its subject — Roth, on Roth's theorem —
    is not derailed by one coincidence.

    Document frequency was tried first and rejected: running heads repeat the
    author surname on every even page, so a name is not rarer than a title
    word in the text as a whole. The abstract is the part of the document that
    discriminates.

    `line` must already be repaired (`repair_text` + `rejoin_caps`).
    Letter-spacing damage splits "IVAN" into "IV AN", and "AN" is a function
    word — so testing the raw line rejects exactly the bylines this exists to
    catch.
    """
    toks = [t.strip(".,;:()[]") for t in re.split(r"[\s,;]+", line) if t.strip(".,;:()[]")]
    content = [t for t in toks if t.lower() not in BYLINE_CONNECTORS]
    if not content:
        return False

    # The abstract test: a line whose capitalised words are mostly already in
    # the abstract is title text, because an author is rarely named in their
    # own abstract while the nouns of a title are almost always restated.
    words = [t.lower() for t in content if len(t) >= 3 and t[:1].isupper()]
    hits = sum(1 for w in words if w in abstract_words) if abstract_words else 0
    # A STRICT majority, and never on the strength of one word.
    #
    # `>= half` collapses to "any single hit" on a two-name byline: filtering
    # initials and digits leaves `['broadhurst', 'kreimer']`, and one match
    # satisfies `1 * 2 >= 2`. The old docstring defended "majority rather than
    # any single hit" — true of a long byline, false of exactly the short one
    # this test is usually asked about.
    in_abstract = bool(words and hits >= 2 and hits * 2 > len(words))

    # …and the veto does not apply at all to a line carrying INITIALS or
    # affiliation markers. Those are positive byline evidence that a title
    # continuation does not have, and they outrank the abstract heuristic,
    # whose premise — "an author is rarely named in their own abstract" — is
    # simply false in physics: `hep-th/0001202`'s abstract names both
    # Broadhurst and Kreimer, and that is ordinary self-reference.
    if RE_BYLINE_MARKER.search(line):
        in_abstract = False

    # Route 1, inherited: punctuation. A comma, "and" or "&" between names.
    # Kept because it is what catches the messy real-world byline — emails,
    # affiliations and daggers inline — which no name-shape test survives:
    # "Nori Jacoby (nori jacoby@hotmail.com) and Ruth Lawrence (...)". Dropping
    # it for the shape rule alone ran 104 titles on into their affiliations.
    #
    # The abstract veto is applied to this route ONLY when the sole signal is a
    # bare "and"/"&" with no comma. That is precisely the title-continuation
    # case — "...IN THE MIRROR OF THE PROJECTIVE" / "PLANE AND A BINODAL CUBIC
    # CURVE" — while a genuine multi-author byline separates with commas.
    # Vetoing the comma case as well cost 40 titles their stopping point, the
    # byline no longer being detected at all: "Modern Theory of Nuclear Forces
    # E. Epelbaum∗" ran on into "Forschungszentrum Jülich, Institut für ...".
    if RE_AUTHOR_HINT.search(line):
        if in_abstract and "," not in line:
            return False
        return True

    if in_abstract:
        return False

    # Route 2, new: name shape, for the single-author byline that carries no
    # punctuation at all and so was invisible to route 1.
    #
    # The token cap belongs to THIS route only. A real byline is often long and
    # messy — "Ma¨ ıté Dupuis1,∗ and Florian Girelli 2, 1,†" is nine tokens of
    # kerning damage, superscripts and affiliation markers — and route 1
    # already recognises it by its punctuation. Applying the cap to both routes
    # rejected those and let the title run on into the affiliation.
    if len(content) > 8:
        return False
    all_caps = line == line.upper()
    names: list[str] = []
    initials = 0
    for tok in content:
        low = tok.lower()
        # Particles are tested before the short-token rule, or "DE LA FACULTÉ"
        # banks two "initials" and passes as a byline.
        if low in NAME_PARTICLES:
            continue
        if len(tok) == 1 and tok.isalpha() and low not in ("a", "i"):
            initials += 1
            continue
        # In an ALL-CAPS line case carries no information and kerning damage is
        # the norm, so a one- or two-letter token is a fragment, not a word.
        # "IVAN SMITH" extracts as "IV AN SMITH" and the damage repeats in the
        # running heads, so "ivan" is never attested and `rejoin_caps` cannot
        # repair it; reading "AN" as the article rejects the byline outright.
        if all_caps and len(tok) <= 2 and tok.isalpha():
            initials += 1
            continue
        if low in TITLE_FUNCTION_WORDS:
            return False
        if not tok[:1].isupper():
            return False
        if len(tok) >= 3:
            names.append(low)

    if not names:
        return False
    # A lone capitalised word is a title continuation far more often than a
    # byline — "...FOR NUMBER" / "FIELDS" cost 23 titles their tail. Demand a
    # second name, or an initial beside it ("E. Epelbaum").
    return len(names) >= 2 or initials >= 1


def parse_front_matter(pages: list[str]) -> dict[str, Any]:
    """Title, authors, abstract, arXiv id, DOI — from page-1 text."""
    p1 = pages[0] if pages else ""
    head = "\n".join(("\n".join(pages[:2])).splitlines()[:120])
    meta: dict[str, Any] = {}

    arxiv = None
    for rx in (RE_ARXIV_NEW, RE_ARXIV_OLD):
        m = rx.search(p1)
        if m:
            arxiv = {
                "id": m.group("id"),
                "version": (m.groupdict().get("ver") or "").lstrip("v") or None,
                "primary_class": m.groupdict().get("cls"),
            }
            d = RE_DATE.search(p1[m.end(): m.end() + 90])
            arxiv["stamp_date"] = d.group(1) if d else None
            break
    meta["arxiv"] = arxiv

    m = RE_DOI.search(head)
    meta["doi"] = m.group(1).rstrip(".") if m else None

    # Title and authors sit between the arXiv stamp / report numbers and the
    # abstract. Walk down, skipping stamp lines, collecting title lines until
    # something that reads like an author list or the abstract marker.
    lines = [l.strip() for l in p1.splitlines()]
    # Skip the CONTIGUOUS run of furniture at the top, and stop at the
    # first line that is not furniture. Taking the last furniture line
    # anywhere in the window instead — which this did — walks straight past
    # the title whenever any furniture is printed *below* it, and plenty
    # is: a DOI URL under the byline, a "Received ... Published online"
    # line, or an arXiv margin stamp that pypdf emits last because it is
    # rotated. Both cost the title outright.
    #
    #   0| arXiv:1105.1998v3 [math.CA] 16 Dec 2011
    #   1| ... SIGMA 7 (2011), 115, 11 pages          <- furniture
    #   2| A Connection Formula                       <- the title
    #   ...
    #   9| http://dx.doi.org/10.3842/SIGMA.2011.115   <- furniture, below it
    #
    # The old rule started at line 10.
    def furniture(l: str) -> bool:
        # "Chapter 5" / "Part II" / "Appendix A" head a book division and are
        # not the title. Left in, a bound chapter took "Chapter 5" as its
        # title and pushed its real one ("ROTH'S LEMMA") into the byline.
        if re.match(r"^(?:chapter|section|part|appendix)\s+[\dIVXLC]+\.?$", l, re.I):
            return True
        return bool(re.search(r"ar\s*X\s*iv", l, re.I) or RE_REPORT_NO.match(l))

    start = 0
    skipped = False
    for i, l in enumerate(lines[:16]):
        if not l:
            start = i + 1
            continue
        if furniture(l):
            start, skipped = i + 1, True
            continue
        # A bare journal name carries no volume or year to match on, so it
        # is unrecognisable on its own — but it sits INSIDE the furniture
        # run, with more furniture under it:
        #
        #   ISSN 1472-2739 (on-line) ...      furniture
        #   Algebraic & Geometric Topology    <- this line
        #   ATG                               furniture
        #   Volume 3 (2003) 537-556           furniture
        #   Published: 16 June 2003           furniture
        #   Skein-theoretical derivation      the title
        #
        # Only once something above it was already skipped, so a title
        # sitting on line 0 above a date line is never mistaken for one.
        #
        # The furniture run has to genuinely CONTINUE — both of the next two
        # non-empty lines — not merely have some furniture near it. Asking
        # for *any* furniture within two lines, which this did, matches the
        # commonest front matter there is and eats the title and the byline
        # together:
        #
        #   0| arXiv:hep-th/9310164v2  22 Jul 1998   furniture
        #   1| SPHERICAL CA TEGORIES                 <- the title
        #   2| John W. Barrett & Bruce W. Westbury   <- the byline
        #   3| 10 August 1993; revised 22 July 1998  furniture (a date)
        #
        # Line 3 is furniture, so line 1 was skipped for it, then line 2 for
        # the same line, and `start` landed on the abstract: no title, no
        # authors, nothing to fall back on. A byline is not furniture, so
        # requiring the run to continue tells the two layouts apart.
        nxt = [x for x in lines[i + 1:i + 6] if x][:2]
        if skipped and len(nxt) == 2 and all(furniture(x) for x in nxt):
            start = i + 1
            continue
        break

    # The document's own token set, used to decide whether an all-caps
    # split is real, and built from *repaired* text so an accented name
    # can attest its own join.
    #
    # Drawn from the whole document, not from `head`. Front matter is
    # exactly where the damage is — it is the part set in caps and
    # letter-spaced — so a two-page sample often fails to attest the very
    # names it needs. An author surname reappears unbroken in the running
    # heads and the bibliography, which is what makes the join decidable.
    vocab = Counter(w.lower() for w in
                    re.findall(r"[^\W\d_]{3,}", repair_text("\n".join(pages))))

    fix = lambda s: rejoin_caps(repair_text(s), vocab).strip(" .,")

    # The abstract's vocabulary, needed *before* the title/byline walk because
    # `looks_like_byline` uses it to tell a name from a title noun. Read
    # straight from page-1 text rather than from `meta["abstract"]`, which is
    # assembled further down and would make the two mutually dependent.
    abstract_words: set[str] = set()
    _am = re.search(r"\babstract\b\s*[.:—–-]?\s*", p1, re.I)
    if _am:
        _tail = p1[_am.end(): _am.end() + 2600]
        # Cut at the first section heading — the SAME cut `meta["abstract"]`
        # uses below, so the two cannot disagree about what the abstract is.
        #
        # A raw window overruns the abstract into the body, the author
        # addresses and the bibliography, and then "named in the abstract"
        # becomes "named anywhere on page 1" — which every author is.
        # `arxiv-math-0304010v1` lost its byline to exactly this: all four of
        # Vladimir/Ivanov/Grigori/Olshanski were found, so the veto fired at
        # full strength on a line that is nothing but names.
        _cut = re.search(
            r"\n\s*(?:1\s*\.?\s+Introduction\b|Introduction\b|Contents\b"
            r"|Keywords?\b|Key words\b|MSC\b|AMS\b|\d{4}\s+Mathematics)",
            _tail, re.I,
        )
        if _cut:
            _tail = _tail[: _cut.start()]
        abstract_words = {w.lower() for w in re.findall(r"[^\W\d_]{3,}", _tail)}

    title_lines: list[str] = []
    author_lines: list[str] = []
    for l in lines[start:start + 20]:
        if re.match(r"^abstract\b", l, re.I):
            break
        if not l or len(l) < 3 or re.match(r"^\d+$", l) or RE_REPORT_NO.match(l):
            if title_lines and not l:
                # blank line after a title usually precedes the authors
                continue
            continue
        # A numbered section heading or a table of contents ends the title,
        # even where the document carries no byline at all to stop it.
        if title_lines and RE_TITLE_STOP.match(l):
            break
        # An author line: capitalised, name-shaped, no trailing colon, and we
        # already have some title text. `looks_like_byline` is given the
        # *repaired* line — letter-spacing damage splits "IVAN" into "IV AN",
        # and "AN" reads as a function word, so the raw line rejects the very
        # bylines this is here to catch.
        if title_lines and RE_AUTHORS.match(l) and not l.endswith(":") \
                and len(l) < 120 \
                and looks_like_byline(fix(l), abstract_words):
            author_lines.append(l)
            break
        title_lines.append(l)
        if len(" ".join(title_lines)) > 180:
            break

    title = fix(" ".join(title_lines))
    meta["title"] = title or None
    authors = fix(" ".join(author_lines))
    meta["authors_raw"] = authors or None
    # The lines the title was assembled from, kept separately.
    #
    # Joining them destroys the one boundary that reliably separates a
    # title from its byline: the line break. `looks_like_byline` now makes
    # that test in-place, so the byline no longer silently lands in the
    # title — but the lines stay exported anyway. The case that motivated
    # them is real and unsolved by shape alone ("THEORY TOM BRIDGELAND" is
    # indistinguishable from "TORUS KNOT"); the byline test settles it with
    # the abstract's vocabulary, which is evidence, not proof. A consumer
    # that disagrees can still re-split on the original boundary.
    meta["title_lines"] = [fix(l) for l in title_lines] or None

    # Abstract: everything after the marker, cut at the first section heading.
    meta["abstract"] = None
    m = re.search(r"\babstract\b\s*[.:—–-]?\s*", p1, re.I)
    if m:
        tail = p1[m.end(): m.end() + 2600]
        cut = re.search(
            r"\n\s*(?:1\s*\.?\s+Introduction\b|Introduction\b|Contents\b"
            r"|Keywords?\b|Key words\b|MSC\b|AMS\b|\d{4}\s+Mathematics)",
            tail, re.I,
        )
        if cut:
            tail = tail[: cut.start()]
        tail = re.sub(r"\s+", " ", tail).strip()
        if len(tail) >= 40:
            meta["abstract"] = tail[:2000]
    return meta


# Spacing accents a TeX text layer emits BESIDE the letter rather than on it:
# pdftotext and PyMuPDF both give "L\u00a8ubeck" for an outline's "L\u00fcbeck".
_SPACING_ACCENTS = dict.fromkeys(map(ord, "\u00a8\u00b4\u0060\u02c6\u02dc\u00b8\u02d8\u02d9\u02da\u02db\u02dd\u02c7\u00af"))


def _match_key(text: str) -> str:
    """`text` lower-cased with accents dropped, combining or spacing, so an
    outline title and the page line that prints it compare equal.

    Measured on arxiv-2504.18825v2 (2026-10-11): the outline's "7. Application
    II: L\u00fcbeck\u2013Prasad\u2013\u2026" is printed "L\u00a8ubeck" on page 34, the
    needle never matched, and section 7 was dropped silently into section 6
    (pp. 25\u201343).
    """
    t = unicodedata.normalize("NFKD", text.translate(_SPACING_ACCENTS))
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t).strip().lower()


def _adjust_banner_mark(lines: list[str], pi: int, li: int, span: int = 1) -> tuple[int, int]:
    """When a page-opening display banner is emitted at the end of a page's PDF
    content stream (after the page's own body text, as InDesign writes the
    Component 1..8 banners on pages 26..88 of 9789240099456-eng), only short
    banner labels ("Component", a section digit) follow it on that page. Cut at
    line 0 so the page's body stays inside the section it opens."""
    if len(lines) >= 15 and li >= len(lines) - 5:
        tail = [x.strip() for x in lines[li + span :] if x.strip()]
        if all(len(x) <= 12 for x in tail):
            return (pi, 0)
    return (pi, li)


def _banner(on: bool, lines: list[str], pi: int, li: int, span: int = 1) -> tuple[int, int]:
    """`_adjust_banner_mark` when `on`, else the heading's own line."""
    return _adjust_banner_mark(lines, pi, li, span) if on else (pi, li)


RE_STEP_TITLE = re.compile(r"^Step \d+\.\s+(.+)$")


def locate_heading(pages: list[str], e: TocEntry, banner: bool = True) -> tuple[int, int] | None:
    """`(page_idx, line_idx)` of the line that prints outline entry `e`, or None.

    Searched within two pages either side of the entry's own page. Factored out
    of `split_sections` so `heading-match-dryrun.py` asks the same question the
    splitter does, rather than a second spelling of it.
    """
    # A labelled step ("Step 3. Coordinate reviews ...", `_pdf_headings.
    # step_headings`) prints its label apart from its heading, so the heading
    # is looked for without it.
    step = RE_STEP_TITLE.match(e.title)
    if step:
        found = locate_heading(pages, replace(e, title=step.group(1)), banner)
        if found:
            return found
    needle = _match_key(e.title)[:44]
    if not needle:
        return None
    run_in = _run_in_keys(e)
    lo = max(0, (e.page or 1) - 2)
    hi = min(len(pages), (e.page or 1) + 2)
    order = list(range(lo, hi))
    if e.page and lo <= e.page - 1 < hi:
        order = [e.page - 1] + [p for p in order if p != e.page - 1]
    for pi in order:
        lines = pages[pi].splitlines()
        for li, line in enumerate(lines):
            cand = _match_key(line)
            # A label alone on its line ("A", "B.1", "3C1.") is the
            # heading's number; PyMuPDF puts it above the title, so the
            # outline's "A Properties of ..." matches only the two joined.
            if li + 1 < len(lines) and re.fullmatch(r"[A-Z0-9]{1,3}(\.[A-Z0-9]{1,3})*\.?", line.strip()):
                cand = _match_key(line + " " + lines[li + 1])
            if needle in cand and len(cand) < 120:
                return _banner(banner, lines, pi, li, 1)
            if run_in and _starts_run_in(cand, run_in):
                return _banner(banner, lines, pi, li, 1)
        # Multi-line wrapped display headings ("National Trust / Architecture for /
        # the DDCC:VS" on DDCC p. 63; "Generic business processes / and workflows"
        # on DAK p. 36) on the same page before moving to neighbouring pages.
        for span in (2, 3):
            for li in range(len(lines) - span + 1):
                if not all(0 < len(lines[li + k].strip()) < 90 for k in range(span)):
                    continue
                cand = _match_key(" ".join(lines[li : li + span]))
                if needle in cand and len(cand) < 160:
                    return _banner(banner, lines, pi, li, span)
    # Minor wording inflections between the contents page and the body heading
    # ("Tally sheets..." vs "Tally sheet... - example 1" on LNOB p. 41;
    # "Links..." vs "Linkages..." on DAK p. 23; "Health interventions and
    # recommendations" vs "Health interventions and recommended interventions"
    # on DAK p. 26).
    key = _pdf_headings.norm_title(e.title)
    if len(key) >= 12:
        for pi in order:
            lines = pages[pi].splitlines()
            for span in (1, 2, 3):
                for li in range(len(lines) - span + 1):
                    if not all(0 < len(lines[li + k].strip()) < 100 for k in range(span)):
                        continue
                    ck = _pdf_headings.norm_title(" ".join(lines[li : li + span]))
                    if 12 <= len(ck) < 140 and (
                        _pdf_headings.similar(key, ck) >= 0.84
                        or _pdf_headings.similar(key[:40], ck[:40]) >= 0.88
                    ):
                        return _banner(banner, lines, pi, li, span)
    return None


# A heading label that can open a run-in heading: it carries a digit ("3C1.",
# "2.1", "B.2") or ends in a full stop ("A."). A bare capital is refused
# because it is indistinguishable from the article in "A note on ...".
_RUN_IN_LABEL = re.compile(r"(?=[A-Z0-9.]*\d|[A-Z0-9.]*\.$)[A-Z0-9]{1,4}(?:\.[A-Z0-9]{1,3})*\.?")


def _run_in_keys(e: TocEntry) -> list[str]:
    """Whitespace-free match keys for `e` printed as label + title, or [] when
    the entry has no label (then only the ordinary needle rule applies).

    Measured on `ant-v14-n7-s` (2026-10-12): the outline's "3C1. Lie type in
    cross-characteristic for p=3" is printed "3C1. Lie type in cross-
    characteristic for p = 3. In this section, ..." — the heading runs into its
    paragraph, and the math is spaced. The needle rule misses it twice over:
    "p=" is not in "p = 3", and a run-in line is routinely past the 120-char
    guard. Comparing with whitespace removed, anchored at line start and closed
    by a boundary, catches it without letting a mid-sentence mention through.
    """
    title = _match_key(e.title)
    if e.number:
        n = _match_key(e.number).rstrip(".")
        return [re.sub(r"\s+", "", f"{n} {title}"), re.sub(r"\s+", "", f"{n}. {title}")]
    first = e.title.strip().split(maxsplit=1)
    if len(first) == 2 and _RUN_IN_LABEL.fullmatch(first[0]):
        return [re.sub(r"\s+", "", title)]
    return []


def _starts_run_in(cand: str, keys: list[str]) -> bool:
    """True when `cand` (a `_match_key`ed line) BEGINS with one of `keys`,
    whitespace ignored, and the heading ends at a boundary: end of line,
    whitespace, or `.:;,` / a dash followed by whitespace or end of line.
    Length is not limited — a run-in heading carries its paragraph with it."""
    for key in keys:
        i = k = 0
        while i < len(cand) and k < len(key):
            if cand[i].isspace():
                i += 1
                continue
            if cand[i] != key[k]:
                break
            i += 1
            k += 1
        if k < len(key) or len(key) < 4:
            continue
        rest = cand[i:]
        if not rest or rest[0].isspace() or re.match(r"[.:;,\u2013\u2014-](\s|$)", rest):
            return True
    return False


# ------------------------------------------- outlines that are not contents
#
# Owner, 2026-11-11 (who-iris, card Q-ODD-1 = A): "split single blocks that
# hold a whole book". Six IRIS PDFs came out as ONE section of 10,000 to
# 101,000 words, every one of them because an outline was present, was taken
# as the document's answer (bean `6xaz`), and located no heading on any page,
# so `split_sections` kept the whole text. Measured 2026-11-11:
#
# - 10665/353150 (fr) and 353151 (es): 101 entries, all Word bookmark names
#   ("_tyjcwt", "_4d34og8").
# - 10665/385385: one entry, "Blank Page". 10665/259268: one, "_TOC_250000".
# - 10665/44118: three, the names of the files merged into the PDF
#   ("9789241547727_eng_Chapter1-4").
# - 10665/331525, Russian edition: 20 real entries, in English ("Chapter 1.
#   Introduction and approach"), over Russian pages.
#
# A machine bookmark is not a heading, and an outline whose titles the pages do
# not print cannot place one. Either way the outline is set aside and the
# contents are inferred, as for a PDF with no outline; the inference must still
# pass its own trust tests, else the document is split by page.

# Bookmark names that word processors and PDF tools write, never a heading.
MACHINE_BOOKMARK = re.compile(
    r"^(_[A-Za-z0-9_.]+|Blank Page|Bookmark\s*\d*|Page\s*\d+|\d{9,13}[_-][A-Za-z]{3}([_-].*)?)$")
# Below this share of entries located on their pages, an outline is not used.
MIN_OUTLINE_LOCATED = 0.5


def machine_bookmark(title: str) -> bool:
    """A title a tool wrote, not a heading: `_GoBack`, `_Hlk62546849`, "Blank Page". Pure."""
    return bool(MACHINE_BOOKMARK.match(title.strip()))


def trusted_outline(outline: list[TocEntry], pages: list[str]) -> tuple[list[TocEntry], str | None]:
    """The outline with machine bookmarks dropped, or `[]` and why it was not used.

    10665/341997 mixes its 11 real chapters with 19 bookmark names
    ("_Hlk62546849", "_GoBack"): the bookmarks are dropped and the chapters
    kept. When nothing is left, or under half of what is left names a line
    the pages print, the outline is set aside (see the block above).
    """
    if not outline:
        return outline, None
    kept = [e for e in outline if not machine_bookmark(e.title)]
    if not kept:
        return [], (f"all {len(outline)} outline entries are machine bookmark names "
                    f"(\"{outline[0].title}\"), not headings")
    located = sum(1 for e in kept if locate_heading(pages, e))
    if located < MIN_OUTLINE_LOCATED * len(kept):
        return [], (f"{located} of {len(kept)} outline entries name a heading the pages print "
                    f"(< {int(MIN_OUTLINE_LOCATED * 100)}%), e.g. \"{kept[0].title}\"")
    return kept, None


# A section is too long to be one block when it holds more than half of a
# document of at least OVERSIZED_MIN_PAGES pages and more than
# OVERSIZED_HALF_WORDS words, or more than OVERSIZED_WORDS words wherever it is.
# The smallest measured case, 10665/259268, is 36 pages and 10,725 words in one
# section; a long proof in a 40-page paper is usually under 8,000.
OVERSIZED_MIN_PAGES = 20
OVERSIZED_HALF_WORDS = 8000
OVERSIZED_WORDS = 20000


def oversized_section(s: "Section", n_pages: int) -> bool:
    """Too long to be one block (see OVERSIZED_*). Pure."""
    span = s.page_end - s.page_start + 1
    if span < 2:
        return False
    return (n_pages >= OVERSIZED_MIN_PAGES and span > n_pages / 2 and s.n_words > OVERSIZED_HALF_WORDS) \
        or s.n_words > OVERSIZED_WORDS


def by_page(s: "Section", pages: list[str]) -> list["Section"]:
    """`s` as one section per page, titled by page; "Page N" for a whole document. Pure."""
    whole = s.title == "Document" and s.number is None
    return [replace(p, title=p.title if whole else f"{s.title} (page {p.page_start})",
                    level=s.level if whole else s.level + 1)
            for p in split_pages(pages)[s.page_start - 1:s.page_end]]


# A running head printed on at least this share of an oversized section's pages
# names the volume or part, not a chapter: a page that prints only it stays
# with the chapter before, unless the part itself changes there.
RUNNING_HEAD_SHARED = 0.4
RE_PAGE_FOLIO = re.compile(r"^\s*page\s+[ivxlc\d]+\s*$", re.I)
RE_HEAD_FOLIO = re.compile(r"\s*(?:[»›|•·:–-]\s*)?page\s+[ivxlc\d]+\s*$", re.I)


def running_heads(lines: list | None, start: int, end: int) -> dict[int, str]:
    """The chapter each page of `start`..`end` names in its running heads.

    10665-75211 is three volumes bound in one PDF; its contents page lists Part 1
    only, so Annex G ran from page 104 to the end and was cut into 120 sections
    all titled "Definitions of terms used in the Toolkit (page N)". Every page
    prints its part at the top and its chapter at the foot ("Chapter 3. Manage
    the process » page 6"). Of the margin lines on a page, the one whose
    form (digits ignored) recurs on the fewest pages of the range is the most
    specific, and names the page's chapter; a head shared by many pages names
    only the part (RUNNING_HEAD_SHARED). Pages with no head are left out.
    """
    if not lines:
        return {}
    bsize = _pdf_headings.body_size(lines)
    top: dict[int, list[str]] = defaultdict(list)
    for l in lines:
        h = l.page_height or 0
        text = _printed(l.text)
        in_margin = l.y0 < FURNITURE_MARGIN * h or l.y1 > (1 - FURNITURE_MARGIN) * h if h else False
        if (not h or not (start <= l.page <= end) or not in_margin
                or l.size > FURNITURE_MAX_SCALE * bsize or not text
                or RE_FOLIO.match(text) or RE_PAGE_FOLIO.match(text)):
            continue
        top[l.page].append(text)
    pages_of: dict[str, set[int]] = defaultdict(set)
    for page, texts in top.items():
        for t in texts:
            pages_of[_furniture_key(t)].add(page)
    # A margin line printed once is body text that reached the margin, unless
    # it carries its own folio ("Introduction » page 1").
    for page in list(top):
        top[page] = [t for t in top[page]
                     if len(pages_of[_furniture_key(t)]) >= 2 or RE_HEAD_FOLIO.search(t)]
    span = end - start + 1
    heads: dict[int, str] = {}
    prev_shared = None
    for page in range(start, end + 1):
        texts = top.get(page) or []
        if not texts:
            continue
        # Fewest pages first; on a tie, the head that carries its own folio
        # ("Annex G. Definitions » page 88") names the chapter.
        best = min(texts, key=lambda t: (len(pages_of[_furniture_key(t)]), not RE_HEAD_FOLIO.search(t)))
        shared = len(pages_of[_furniture_key(best)]) >= RUNNING_HEAD_SHARED * span
        title = RE_HEAD_FOLIO.sub("", best).strip(" »›|•·:–-")
        if not title:
            continue
        if shared:
            # Only the part's head is printed here: it starts a section only
            # where the part changes (a new volume's cover and front matter).
            if _furniture_key(best) == prev_shared:
                continue
            prev_shared = _furniture_key(best)
        heads[page] = title
    return heads


def by_running_head(s: "Section", pages: list[str], lines: list | None) -> list["Section"]:
    """`s` cut where the chapter named in its pages' running heads changes. Pure.

    Fewer than two parts, or a head on under half the pages, gives [] so the
    caller falls back to one section per page.
    """
    heads = running_heads(lines, s.page_start, s.page_end)
    span = s.page_end - s.page_start + 1
    if len(heads) < span / 2:
        return []
    per_page = split_pages(pages)[s.page_start - 1:s.page_end]
    groups: list[tuple[str, list[Section]]] = []
    for p in per_page:
        head = heads.get(p.page_start)
        if head is None or (groups and _match_key(head) == _match_key(groups[-1][0])):
            if groups:
                groups[-1][1].append(p)
            else:
                groups.append((s.title, [p]))
        else:
            groups.append((head, [p]))
    if len(groups) < 2:
        return []
    out = []
    for i, (title, ps) in enumerate(groups):
        text = "\n\n".join(x.text for x in ps)
        first = i == 0 and title == s.title
        out.append(Section("", s.number if first else None, title, s.level if first else s.level + 1,
                           ps[0].page_start, ps[-1].page_end, len(text), len(text.split()), text))
    return out


def split_oversized(sections: list["Section"], pages: list[str],
                    candidates: list[TocEntry], lines: list | None = None) -> tuple[list["Section"], list[dict[str, Any]]]:
    """Each oversized section cut at the headings inferred inside it, else at its
    running heads (`by_running_head`), else by page.

    10665/75211 (National eHealth strategy toolkit) infers 71 headings, and
    the last, "G. Definitions of terms", runs from page 104 to 223 (36,800
    words) because the headings of Parts 2 and 3 were not inferred. A section
    that size is cut at the candidate headings that fall inside its pages, or,
    when fewer than two do, one section per page. Ids are renumbered in order.
    """
    out: list[Section] = []
    report: list[dict[str, Any]] = []
    for s in sections:
        if not oversized_section(s, len(pages)):
            out.append(s)
            continue
        inside = [e for e in candidates
                  if e.page is not None and s.page_start < e.page <= s.page_end
                  and _match_key(e.title) != _match_key(s.title)]
        sub: list[Section] = []
        if len(inside) >= 2:
            # The pages before the section blanked and those after it cut, so
            # every part ends inside the section.
            span = [pages[i] if i >= s.page_start - 1 else "" for i in range(s.page_end)]
            parts = split_sections(span, inside)
            # The text before the first inside heading stays with the section's own title.
            for p in parts:
                if p.id == "sec-front-matter":
                    p = replace(p, id="", number=s.number, title=s.title, level=s.level, page_start=s.page_start)
                # A part still too long is cut by page.
                sub.extend(by_page(p, pages) if oversized_section(p, len(pages)) else [p])
            by = "headings"
        if len(sub) < 2:
            sub = by_running_head(s, pages, lines)
            by = "running heads"
        if len(sub) < 2:
            sub = by_page(s, pages)
            by = "pages"
        report.append({"title": s.title, "page_start": s.page_start, "page_end": s.page_end,
                       "words": s.n_words, "by": by, "into": len(sub)})
        out.extend(sub)
    if not report:
        return sections, []
    renumbered = []
    i = 0
    for s in out:
        if s.id == "sec-front-matter":
            renumbered.append(s)
            continue
        renumbered.append(replace(s, id=f"sec-{i:03d}-" + slugify(f"{s.number + ' ' if s.number else ''}{s.title}")))
        i += 1
    return renumbered, report


def replace_failing_pages(pages: list[str], ocr: list[str], langs: list[str]) -> tuple[list[str], list[dict[str, Any]]]:
    """Each page whose text layer fails `_text_quality.page_problem`, read from OCR instead.

    Owner, 2026-11-11 (who-iris, card Q-ODD-1 = A): "force OCR when a page's
    text layer fails a quality check". A document is routed to OCR whole only
    when its text layer as a whole is unusable; one with a few broken pages
    (an Arabic abstract in a French article, a page of fake-bold headings)
    keeps its own text everywhere else. Needs the OCR cache, one page per PDF
    page (`pdf-ocr.py` first); without it nothing is replaced.
    """
    if len(ocr) != len(pages):
        return pages, []
    out = list(pages)
    replaced: list[dict[str, Any]] = []
    for i, text in enumerate(pages):
        why = page_problem(text or "", langs)
        if why and (ocr[i] or "").strip():
            out[i] = ocr[i]
            replaced.append({"page": i + 1, "reason": why})
    return out, replaced


# An inferred heading is a heading only if it reads as one. Measured on the
# IRIS pilot (owner, 2026-11-11, card Q-ODD-1 = A, "shifted section boundaries
# and titles"):
# - 10665/354399 (Spanish) sets "3.4 / Acceso a los centros de salud ... /
#   telemedicina entre el paciente y / el prestador" over four lines in two
#   fonts, and only the last lines were taken: sections titled "sanitaria
#   universal", "paciente y el prestador". Such a title is rejoined with the
#   lines above it, up to the bare number that opens it.
# - 10665/264857 (French, 1982) took body words set apart by a font change as
#   headings: "un", "comme", "On", "bonne". A title that opens in lower case
#   and has no number above it, or is one word of three letters or fewer, is
#   not a heading.
# - 10665/329296 (French) read the labels of an annex flowchart as headings:
#   runs of three or more sections on one page, of a few words each (a heading
#   with no words of its own, a parent of the next, is not a label). Two are
#   not enough: 10665/259268 sets a part heading and its first chapter heading
#   one above the other with a word between them.
RE_BARE_NUMBER = re.compile(r"^\s*(\d+(?:\.\d+)*)\.?\s*$")
# The number and the first words of a title on one line ("4.1 \t Identifier et
# sélectionner les interventions", 10665/353150).
RE_NUMBERED_LINE = re.compile(r"^\s*(\d+(?:\.\d+)+|\d+\.)\s+(\S.*)$")
LABEL_RUN = 3
LABEL_WORDS = 30


def _opens_lower(title: str) -> bool:
    first = next((c for c in title if c.isalpha()), "")
    return bool(first) and first.islower() and first != first.upper()


def rejoin_wrapped(e: TocEntry, pages: list[str]) -> TocEntry | None:
    """`e` with the lines of its title above it, up to its number; None if there is no number. Pure."""
    if not e.page or not (1 <= e.page <= len(pages)):
        return None
    lines = [l.strip() for l in pages[e.page - 1].splitlines()]
    key = _match_key(e.title)
    for i, l in enumerate(lines):
        lk = _match_key(l)
        # The line that opens the title, or that ends with it ("cobertura
        # sanitaria universal" for the title "sanitaria universal").
        if not key or len(lk) < 3:
            continue
        if not (key.startswith(lk) or key in lk
                or any(lk.endswith(key[:n]) for n in range(min(len(key), len(lk)), 7, -1))):
            continue
        above: list[str] = []
        for j in range(i - 1, max(-1, i - 6), -1):
            m = RE_BARE_NUMBER.match(lines[j])
            n = None if m else RE_NUMBERED_LINE.match(lines[j])
            if n and len(lines[j]) <= 90:
                above.append(n.group(2))
                m = n
            if m:
                tail = [lines[i]]
                k = i + 1
                while k < len(lines) and key not in _match_key(" ".join(tail)) and len(tail) < 4:
                    tail.append(lines[k])
                    k += 1
                title = " ".join(reversed(above)) + " " + " ".join(tail)
                return replace(e, title=re.sub(r"\s+", " ", title).strip(), number=e.number or m.group(1).rstrip("."))
            if not lines[j] or len(lines[j]) > 90 or lines[j].endswith((".", ";")):
                break
            above.append(lines[j])
        # No number above this line: the title may be printed again further down.
    return None


# A contents page that also lists the figures, tables and boxes gives each
# caption a heading of its own. 10665-353150 (DIIG, French) then titled the
# chapter's opening text "Schéma 5.1" and the figure's text "Tableau 5.2": the
# caption sits under or beside its figure, not where the text it would head
# begins, so every title was one block off. Captions are figures' labels
# (`figures` in structure.json), not sections.
RE_CAPTION_ENTRY = re.compile(
    r"^(?:figure|fig\.|table|box|panel|tableau|encadré|schéma|graphique|cuadro|recuadro|gráfico|figura|"
    r"diagrama|esquema|рисунок|рис\.|таблица|вставка|схема|图|表|框|الشكل|شكل|الجدول|جدول|الإطار|إطار)"
    r"\s*[\dA-Z][\d.\-–A-Z]*\b", re.I)


def tidy_inferred(toc: list[TocEntry], pages: list[str]) -> tuple[list[TocEntry], list[dict[str, Any]]]:
    """Inferred headings that do not read as headings rejoined or dropped (see above). Pure.

    Entries from the document's own outline pass unchanged.
    """
    out: list[TocEntry] = []
    report: list[dict[str, Any]] = []
    for e in toc:
        if e.source != "inferred":
            out.append(e)
            continue
        t = e.title.strip()
        if _opens_lower(t):
            fixed = rejoin_wrapped(e, pages)
            report.append({"title": t, "page": e.page, "action": "rejoined" if fixed else "dropped",
                           **({"as": fixed.title} if fixed else {}), "why": "opens in lower case"})
            if fixed:
                out.append(fixed)
            continue
        words = t.split()
        if not e.number and len(words) == 1 and len(t) <= 3:
            report.append({"title": t, "page": e.page, "action": "dropped", "why": "a single short word"})
            continue
        if RE_CAPTION_ENTRY.match(t):
            report.append({"title": t, "page": e.page, "action": "dropped", "why": "a figure, table or box caption"})
            continue
        if t.endswith(","):
            # "YOUNG," — the first author of a reference, set in capitals.
            report.append({"title": t, "page": e.page, "action": "dropped", "why": "ends with a comma"})
            continue
        out.append(e)
    return out, report


def label_runs(sections: list[Section]) -> set[tuple[str, int]]:
    """(title, page) of sections in a run of LABEL_RUN+ one-page sections under LABEL_WORDS words. Pure."""
    found: set[tuple[str, int]] = set()
    run: list[Section] = []

    def close() -> None:
        if len(run) >= LABEL_RUN:
            found.update((s.title, s.page_start) for s in run)

    for s in sections:
        short = s.id != "sec-front-matter" and s.page_start is not None and 0 < s.n_words < LABEL_WORDS
        if short and run and s.page_start in (run[-1].page_start, run[-1].page_end):
            run.append(s)
            continue
        close()
        run = [s] if short else []
    close()
    return found


# A page whose text stream runs against its print order. 10665/342236 (CFE
# annual report 2020) prints "2020 OVERVIEW / About the WHO Contingency Fund"
# at the top of page 8, but the PDF draws a side panel and the body first and
# the headings last, so the outline's first heading on the page landed after
# its whole text and every section below it took the wrong words. When the
# first outline heading of a page sits in the later half of its text, and the
# page read in print order (top to bottom, left to right) puts it near the
# top, the page is read in print order.
LATE_HEADING = 0.5
EARLY_HEADING = 0.2
LATE_HEADING_INFERRED = 0.3


def _heading_offset(page: str, e: TocEntry) -> float | None:
    """Where on `page` the line printing `e` starts, as a share of its lines. Pure."""
    found = locate_heading([page], replace(e, page=1))
    if not found or found[0] != 0:
        return None
    n = max(1, len(page.splitlines()))
    return found[1] / n


def print_order_pages(pages: list[str], outline: list[TocEntry], sorted_page,
                      late: float = LATE_HEADING) -> tuple[list[str], list[int]]:
    """`pages` with each page whose first outline heading is printed late re-read by `sorted_page(i)`.

    `sorted_page` returns the text of 0-based page i in print order, or None.
    Returns the pages and the 1-based numbers of those re-read.
    """
    first: dict[int, TocEntry] = {}
    for e in outline:
        if e.page and 1 <= e.page <= len(pages) and e.page not in first:
            first[e.page] = e
    out = list(pages)
    redone: list[int] = []
    for pno, e in sorted(first.items()):
        at = _heading_offset(pages[pno - 1], e)
        if at is None or at < late:
            continue
        alt = sorted_page(pno - 1)
        if not alt:
            continue
        at2 = _heading_offset(alt, e)
        if at2 is not None and at2 <= EARLY_HEADING:
            out[pno - 1] = alt
            redone.append(pno)
    return out, redone


def print_order_inferred(pages: list[str], toc: list[TocEntry], lines, sorted_page) -> tuple[list[str], list[int]]:
    """`print_order_pages` for an inferred contents, with the furniture of each re-read page stripped.

    10665-329296 (French, two columns, no outline) stores page 17's right
    column, references 15-27, before the left column's "RÉFÉRENCES
    BIBLIOGRAPHIQUES" heading, so references 15-27 landed in the section
    before, "Membres du personnel de l'OMS". The outline case re-reads such a
    page in print order before the furniture is stripped; here the furniture
    is already gone from the other pages, so only the re-read ones are
    stripped again. The heading there sits 49.5% down the stored text, under
    LATE_HEADING, so an inferred contents re-reads from LATE_HEADING_INFERRED;
    the re-read is still kept only when it puts the heading near the top.
    """
    alt, redone = print_order_pages(pages, toc, sorted_page, late=LATE_HEADING_INFERRED)
    if not redone:
        return pages, []
    clean, _ = strip_furniture(alt, lines)
    return [clean[i] if i + 1 in redone else pages[i] for i in range(len(pages))], redone


def _pymupdf_sorted(path: str):
    try:
        import pymupdf  # noqa: F401
    except ImportError:
        return lambda i: None
    doc = pymupdf.open(path)
    return lambda i: join_soft_hyphens(print_order_text(doc[i]))


# GRADE quality-of-evidence marks drawn as vector circles, not text.
# 10665-94830 page 28 prints "(strong recommendation, ⊕⊖⊖⊖ evidence)" with
# the four marks as filled drawings 7pt across, so the text reads
# "(strong recommendation,  evidence)" and the evidence quality is lost.
GRADE_MARK_SIZE = (4.0, 12.0)  # points, width and height of one mark
GRADE_MARK_GAP = 4.0           # points between marks of one run
GRADE_SLOT_GAP = 12.0          # points from a run to the words either side of it
GRADE_INK_DISTANCE = 150       # summed RGB distance from the background that counts as ink


def grade_runs(boxes: list[tuple[float, float, float, float]]) -> list[list[int]]:
    """Indices of `boxes` grouped into runs of 2-4 same-size marks on one line. Pure.

    A box is (x0, y0, x1, y1). Marks of a run share their top within 1pt and
    follow each other within GRADE_MARK_GAP.
    """
    lo, hi = GRADE_MARK_SIZE
    marks = sorted((i for i, b in enumerate(boxes)
                    if lo <= b[2] - b[0] <= hi and lo <= b[3] - b[1] <= hi
                    and abs((b[2] - b[0]) - (b[3] - b[1])) <= 1.0),
                   key=lambda i: (round(boxes[i][1]), boxes[i][0]))
    runs: list[list[int]] = []
    for i in marks:
        last = runs[-1][-1] if runs else None
        if last is not None and abs(boxes[i][1] - boxes[last][1]) <= 1.0 \
                and 0 <= boxes[i][0] - boxes[last][2] <= GRADE_MARK_GAP:
            runs[-1].append(i)
        else:
            runs.append([i])
    return [r for r in runs if 2 <= len(r) <= 4]


def grade_run_slot(words: list[tuple], x0: float, x1: float, yc: float) -> int | None:
    """Index of the word a run of marks from `x0` to `x1` on the line through `yc` comes before. Pure.

    `words` are (x0, y0, x1, y1, text, ...) in content order. The slot is the
    word that starts within GRADE_SLOT_GAP right of the run; a run that ends
    its line (or its column) comes after the nearest word on its left, so
    before whatever follows that word in content order. None when the run
    has no word on either side.
    """
    on_line = [k for k, w in enumerate(words) if w[1] <= yc <= w[3]]
    right = [k for k in on_line if 0 <= words[k][0] - x1 + 1.0 <= GRADE_SLOT_GAP]
    if right:
        k = min(right, key=lambda k: words[k][0])
    else:
        left = [k for k in on_line if 0 <= x0 - words[k][2] + 1.0 <= GRADE_SLOT_GAP]
        if not left:
            return None
        k = max(left, key=lambda k: words[k][2]) + 1
    return k if 0 < k < len(words) else None


def _put_between(text: str, left: str, right: str, marks: str, start: int) -> tuple[str, int] | None:
    """`text` with `marks` put between the first `left` `right` pair at or after `start`. Pure.

    Searches from `start` first, so runs of one page are placed in order,
    then from the top. Returns the text and the offset after the marks.
    """
    pat = re.compile(re.escape(left) + r"\s+" + re.escape(right))
    m = pat.search(text, start) or pat.search(text)
    if m is None:
        return None
    put = m.start() + len(left)
    new = text[:put] + " " + marks + " " + text[m.end() - len(right):]
    return new, put + len(marks) + 2


def add_grade_marks(path: str, pages: list[str]) -> tuple[list[str], int]:
    """`pages` with each run of GRADE marks written as ⊕/⊖ before the text that follows it.

    Each mark is read from its rendering (`grade_mark_shape`); a run with any
    drawing that is not a ringed plus or minus is left alone. The run is put between the words either side of it, so the page text reads
    "(strong recommendation, ⊕⊖⊖⊖ evidence)". Returns the pages and the
    number of runs written.
    """
    try:
        import pymupdf
    except ImportError:
        return pages, 0
    try:
        doc = pymupdf.open(path)
    except Exception:
        return pages, 0
    out = list(pages)
    written = 0
    for pno in range(min(len(doc), len(pages))):
        page = doc[pno]
        drawings = [d for d in page.get_drawings() if d.get("fill") is not None]
        boxes = [tuple(d["rect"]) for d in drawings]
        runs = grade_runs(boxes)
        if not runs:
            continue
        words = page.get_text("words")  # content order: block, line, word
        cursor = 0
        for run in runs:
            x1 = boxes[run[-1]][2]
            yc = (boxes[run[0]][1] + boxes[run[0]][3]) / 2
            k = grade_run_slot(words, boxes[run[0]][0], x1, yc)
            if k is None:
                continue
            read = [_grade_mark(page, boxes[i], pymupdf) for i in run]
            if None in read:
                continue
            marks = "".join(read)
            at = _put_between(out[pno], words[k - 1][4], words[k][4], marks, cursor)
            if at is None:
                continue
            out[pno], cursor = at
            written += 1
    return out, written


def _grade_mark(page, box, pymupdf) -> str | None:
    """⊕ or ⊖ for the mark drawn in `box`, None when the drawing is not one.

    Rendered at 600 dpi, a GRADE mark is a ring with a bar through its
    centre: the corners are background, the ring's left and right edges and
    the centre are inked, and the space inside the ring off the bars is
    background. A plus also has ink half way between the centre and the top.
    Ink is any colour well away from the corners' colour, so a coloured mark
    on a tinted page reads the same as a black one on white.
    """
    x0, y0, x1, y1 = box
    pix = page.get_pixmap(clip=pymupdf.Rect(x0, y0, x1, y1), dpi=600)
    w, h = pix.width, pix.height
    if w < 20 or h < 20:
        return None
    return grade_mark_shape(lambda fx, fy: pix.pixel(min(w - 1, int(fx * w)), min(h - 1, int(fy * h)))[:3])


def grade_mark_shape(at) -> str | None:
    """⊕, ⊖ or None from `at(fx, fy)`, the colour at a fraction of the mark's box. Pure."""
    corners = [at(fx, fy) for fx in (0.02, 0.98) for fy in (0.02, 0.98)]
    bg = tuple(sum(c[i] for c in corners) / 4 for i in range(3))
    ink = lambda c: sum(abs(c[i] - bg[i]) for i in range(3)) > GRADE_INK_DISTANCE
    if any(ink(c) for c in corners):
        return None
    ring = ink(at(0.06, 0.5)) and ink(at(0.94, 0.5))
    hollow = not any(ink(at(fx, fy)) for fx in (0.3, 0.7) for fy in (0.3, 0.7))
    if not (ring and hollow and ink(at(0.5, 0.5))):
        return None
    return "⊕" if ink(at(0.5, 0.3)) else "⊖"


def print_order_text(page) -> str:
    """A page's text blocks in print order: top to bottom, a band of columns left column first.

    A block wider than WIDE_BLOCK of the page (a heading, a full-width figure
    caption), or one that starts below every block of the band, closes the
    band of columns above it. Blocks keep their own lines,
    so two columns are never interleaved line by line.
    """
    width = page.rect.width
    mid = page.rect.x0 + width / 2
    blocks = sorted((b for b in page.get_text("blocks") if b[6] == 0 and b[4].strip()),
                    key=lambda b: (round(b[1]), b[0]))
    out: list[str] = []
    band: list = []

    def flush() -> None:
        band.sort(key=lambda b: (0 if (b[0] + b[2]) / 2 < mid else 1, b[1], b[0]))
        out.extend(b[4].rstrip("\n") for b in band)
        band.clear()

    for b in blocks:
        if b[2] - b[0] > WIDE_BLOCK * width:
            flush()
            out.append(b[4].rstrip("\n"))
            continue
        # A block that starts a clear gap below everything in the band starts
        # a new band: 10665-353150 page 72 prints two columns, then "4.5
        # Contrôle des progrès" 33pt under both, and sorting it into the left
        # column put the heading above the right column's text. Touching
        # blocks stay in the band: 10665-342236 page 11's table rows start
        # where the right column's heading ends.
        if band and b[1] >= max(x[3] for x in band) + BAND_GAP:
            flush()
        band.append(b)
    flush()
    return "\n".join(out) + "\n"


WIDE_BLOCK = 0.6
# Points of empty space above a block that close the band of columns over it.
BAND_GAP = 12.0


def split_sections(pages: list[str], toc: list[TocEntry]) -> list[Section]:
    """Slice the document text at heading boundaries."""
    marks: list[tuple[int, int, TocEntry]] = []  # (page_idx, line_idx, entry)
    used: set[tuple[int, int]] = set()

    for e in toc:
        found = locate_heading(pages, e)
        if found and found in used and found[1] == 0:
            # The banner rule moved a heading at a page's foot to line 0, which
            # another heading already opens. 10665-342236 page 8, read in
            # print order, ends with "Key figures in 2020" over a chart: it
            # really is the last heading there, so it keeps its own line.
            found = locate_heading(pages, e, banner=False)
        if found and found not in used:
            used.add(found)
            marks.append((found[0], found[1], e))

    marks.sort(key=lambda t: (t[0], t[1]))
    if not marks:
        whole = "\n".join(pages).strip()
        return [Section("sec-000-document", None, "Document", 1, 1, len(pages),
                        len(whole), len(whole.split()), whole)]

    page_lines = [p.splitlines() for p in pages]
    sections: list[Section] = []

    # Everything before the first located mark. Without this the text above
    # `marks[0]` is never emitted by the loop below and is silently lost --
    # and the shape is perverse, because the `if not marks` branch above
    # keeps the WHOLE document, so a file with zero headings is safe while
    # one with a single late heading loses everything before it.
    #
    # Measured over the 623-document qou library (fraction of raw page text
    # surviving sectioning): median 0.977, so this is not a systemic loss --
    # but 18 documents keep under 50% and 44 under 90%. Worst cases:
    # `arxiv-1304.4737v1` locates only 1 of its 6 correct TOC headings, and
    # that one is "Acknowledgements" on page 14 of 18, so the entire paper
    # is dropped (28.9% kept); DeTurck-Gluck `0406276v1` infers one heading,
    # "References" on page 38 of 40, and keeps 8.4%.
    #
    # The id is deliberately NON-NUMERIC. Numbering this `sec-000` would
    # shift every following section id, and section ids are cited outside
    # this repo (docs/audits/* in litlfred/qou reference `sec-NNN-...`).
    fpi, fli, _ = marks[0]
    if fpi > 0 or fli > 0:
        head_buf: list[str] = []
        for p_i in range(0, fpi + 1):
            src = page_lines[p_i]
            head_buf.extend(src[:fli] if p_i == fpi else src)
        head = re.sub(r"\n{3,}", "\n\n", "\n".join(head_buf)).strip()
        if head:
            sections.append(Section(
                "sec-front-matter", None, "Front matter", 1, 1, fpi + 1,
                len(head), len(head.split()), head))

    for i, (pi, li, e) in enumerate(marks):
        if i + 1 < len(marks):
            epi, eli, _ = marks[i + 1]
        else:
            epi, eli = len(pages) - 1, len(page_lines[-1])

        buf: list[str] = []
        for p in range(pi, min(epi + 1, len(pages))):
            src = page_lines[p]
            s = li + 1 if p == pi else 0
            t = eli if p == epi else len(src)
            buf.extend(src[s:t])
        body = re.sub(r"\n{3,}", "\n\n", "\n".join(buf)).strip()

        num = e.number
        sid = f"sec-{i:03d}-" + slugify(f"{num + ' ' if num else ''}{e.title}")
        sections.append(Section(sid, num, e.title, e.level, pi + 1, epi + 1,
                                len(body), len(body.split()), body))
    return sections


# ------------------------------------------------- doc id, and the OCR cache
#
# `derive_doc_id` and `find_ocr_cache` are imported from `_pdf_doc_id` — see the
# block near the top for why they are not defined here.


def ocr_run_context_ref(path: str, outdir: str | None, ocr_used: bool) -> dict[str, Any]:
    """`{"runContext": {sha256}}` for OCR'd text whose run recorded one, else `{}`."""
    if not ocr_used:
        return {}
    d, _legacy = find_ocr_cache(outdir or os.path.dirname(os.path.abspath(path)), path)
    r = _run_context.read_ref(d) if d else None
    return {"runContext": r} if r else {}


def ocr_pages(path: str, outdir: str | None) -> list[str]:
    """Cached OCR text for this PDF, if `pdf-ocr.py` has been run on it.

    Read rather than generated: OCR costs seconds per page and needs
    binaries this script deliberately does not depend on, so producing it
    is a separate, explicit step.
    """
    root = outdir or os.path.dirname(os.path.abspath(path))
    # By the SHARED helper, not a second spelling of the doc-id. This function
    # used to look in `root/<slugify(basename)>/ocr` — the FALLBACK spelling —
    # while the writer used `derive_doc_id`, so for an arXiv document the two
    # disagreed and the cache was never found. Bean `rlp5`.
    d, legacy = find_ocr_cache(root, path)
    if d is None:
        return []
    if legacy:
        print(f"note  OCR cache found at the old flat location {d} — "
              f"re-run pdf-ocr.py -o {root} to move it under the document's "
              f"own directory, where a second document cannot overwrite it.",
              file=sys.stderr)
    files = sorted(glob.glob(os.path.join(d, "page-*.txt")))
    return [open(f, encoding="utf-8", errors="replace").read() for f in files]


def text_is_unusable(pages: list[str]) -> bool:
    """No text layer, or one that decoded through the wrong codec.

    The second case is why a length test is not enough: a JIS-encoded
    Japanese scan yields ~1,100 characters per page of
    `Fs=E2=7k$SL\\$Ncolored Jones`, which passes every "did we get text"
    check and is worth less than nothing downstream.
    """
    if not pages:
        return True
    mean = sum(len(p or "") for p in pages) / len(pages)
    if mean < 120:
        return True
    head = " ".join((p or "") for p in pages[:3])
    letters = sum(c.isalpha() for c in head)
    return bool(head) and letters < 0.55 * len(head)


# ---------------------------------------------------------------- backends
#
# The extractor is swappable. A backend exposes exactly the three things this
# producer consumes -- page texts, a raw table of contents, and the DocInfo
# dictionary -- and nothing more, so a new one is cheap to add and the rest of
# the script never learns which library read the PDF.
#
# PyMuPDF (import name `pymupdf`, historically `fitz`) is preferred when
# installed, for two reasons measured on this corpus:
#   * its text layer is cleaner on math PDFs than pypdf's, and
#   * `get_toc()` returns the REAL embedded bookmarks, so on the 57% of the
#     corpus that carries an outline the section split is driven by the
#     author's own headings instead of the text heuristic in `infer_headings`.
# pypdf stays as the fallback so the script runs wherever either library is
# present -- including an environment whose pypdf is broken, which is what
# first motivated this abstraction.
#
# LICENCE NOTE. PyMuPDF is AGPL-3.0 (or a commercial licence), whereas pypdf is
# BSD-3-Clause. This module therefore never *requires* PyMuPDF: it is imported
# lazily and used only when already installed, exactly like the optional
# camelot backend in `pdf-tables.py`. The Dockerfile installs pypdf, not
# PyMuPDF, so the shipped image stays BSD-licensed; an operator who wants the
# better outlines opts in with `pip install pymupdf`. Keep it that way unless
# the maintainer decides to take on the AGPL dependency deliberately.


def _toc_entries(raw: list[tuple[int, str, int | None]]) -> list[TocEntry]:
    """Turn a backend's raw `(level, title, page)` rows into `TocEntry`s.

    Shared by every backend so the leading-number parse ("2.1 Foo" -> number
    "2.1", title "Foo") and the `source="outline"` tag are written in one
    place regardless of which library produced the bookmarks.
    """
    entries: list[TocEntry] = []
    for level, title, page in raw:
        title = str(title).strip()
        if not title:
            continue
        num = None
        m = re.match(r"^\s*(\d+(?:\.\d+)*)\.?\s+(.*)$", title)
        if m:
            num, title = m.group(1), m.group(2).strip()
            if not title:                       # a bare "2.1" with no words
                title, num = num, None
        entries.append(TocEntry(max(1, int(level)), title, page, "outline", num))
    return entries


class _Backend:
    """Interface: page texts, a raw TOC, DocInfo. Subclasses import lazily."""

    name = "?"

    def page_texts(self) -> list[str]:
        raise NotImplementedError

    def raw_toc(self) -> list[tuple[int, str, int | None]]:
        """`(level, title, page)` rows; page is 1-based or None."""
        raise NotImplementedError

    def docinfo(self) -> dict[str, str]:
        raise NotImplementedError


class PyMuPDFBackend(_Backend):
    name = "pymupdf"

    def __init__(self, path: str) -> None:
        import pymupdf  # lazy; AGPL, optional (see licence note above)
        self._doc = pymupdf.open(path)

    def page_texts(self) -> list[str]:
        out: list[str] = []
        for page in self._doc:
            try:
                out.append(page.get_text() or "")
            except Exception:
                out.append("")
        return out

    def raw_toc(self) -> list[tuple[int, str, int | None]]:
        try:
            toc = self._doc.get_toc(simple=True)
        except Exception:
            return []
        rows: list[tuple[int, str, int | None]] = []
        for entry in toc:
            # get_toc yields [level, title, page]; page is 1-based, or <= 0
            # when the bookmark has no resolvable destination.
            try:
                level, title, page = entry[0], entry[1], entry[2]
            except (IndexError, TypeError):
                continue
            rows.append((level, title, page if isinstance(page, int) and page > 0 else None))
        return rows

    def docinfo(self) -> dict[str, str]:
        try:
            md = self._doc.metadata or {}
        except Exception:
            return {}
        # Map PyMuPDF's lower-cased keys onto the same DocInfo key names the
        # pypdf path emits, so the artefact shape is backend-independent.
        keys = {"title": "Title", "author": "Author", "producer": "Producer",
                "creator": "Creator", "creationDate": "CreationDate"}
        return {out: str(md[k]) for k, out in keys.items() if md.get(k)}


class PyPDFBackend(_Backend):
    name = "pypdf"

    def __init__(self, path: str) -> None:
        PdfReader = import_pypdf("PdfReader")  # lazy; carries the crypto workaround
        self._reader = PdfReader(path)

    def page_texts(self) -> list[str]:
        out: list[str] = []
        for p in self._reader.pages:
            try:
                out.append(p.extract_text() or "")
            except Exception:
                out.append("")
        return out

    def raw_toc(self) -> list[tuple[int, str, int | None]]:
        reader = self._reader
        try:
            raw = reader.outline
        except Exception:
            return []
        if not raw:
            return []
        rows: list[tuple[int, str, int | None]] = []

        def page_of(item: Any) -> int | None:
            try:
                return reader.get_destination_page_number(item) + 1
            except Exception:
                return None

        def walk(node: Any, level: int) -> None:
            for item in node:
                if isinstance(item, list):
                    walk(item, level + 1)
                    continue
                try:
                    title = str(item.get("/Title", "")).strip()
                except Exception:
                    continue
                if not title:
                    continue
                rows.append((level, title, page_of(item)))

        walk(raw, 1)
        return rows

    def docinfo(self) -> dict[str, str]:
        try:
            info = self._reader.metadata or {}
            return {k.lstrip("/"): str(v) for k, v in info.items()
                    if k in ("/Title", "/Author", "/Producer", "/Creator", "/CreationDate")}
        except Exception:
            return {}


_BACKENDS = {"pymupdf": PyMuPDFBackend, "pypdf": PyPDFBackend}
# `--backend auto` preference order: PyMuPDF first (cleaner text + real
# outlines), pypdf as the fallback.
_AUTO_ORDER = ("pymupdf", "pypdf")


def open_backend(path: str, prefer: str = "auto") -> _Backend:
    """Construct a reader for `path`.

    `auto` walks the preference order and falls back to the next backend on
    any failure -- an absent library, a broken one, or a file the library
    cannot open. An explicit backend name is strict: it is tried alone, so a
    forced choice (for comparison or debugging) is honoured rather than
    silently swapped. `SystemExit` is caught because `import_pypdf` exits when
    pypdf is simply absent, which in a fallback chain just means "try the next
    one".
    """
    order = _AUTO_ORDER if prefer == "auto" else (prefer,)
    errors: list[str] = []
    for name in order:
        try:
            return _BACKENDS[name](path)
        except (Exception, SystemExit) as exc:  # noqa: BLE001
            errors.append(f"{name}: {type(exc).__name__}: {exc}".strip())
    raise RuntimeError(
        "no usable PDF backend for " + os.path.basename(path)
        + " -- " + "; ".join(errors)
        + " (install one: pip install pymupdf  OR  pip install pypdf)"
    )


@contextlib.contextmanager
def library_noise_to_stderr():
    """
    A PDF backend's warnings belong on stderr, not in the artefact — bean `ccqg`.

    PyMuPDF writes its warnings to **`sys.stdout`**, so on a PDF with an
    unreadable embedded font `--json` output began:

        MuPDF error: library error: FT_New_Memory_Face(RUYKIO+...): unknown file format
        {"_schema": "pdf-structure/v1", ...

    and `json.load()` raised `Expecting value: line 1 column 1`. `--help`
    promises `--json` prints the artefact and writes nothing else, and it did
    not keep that.

    **The warning is moved, never silenced.** An unreadable embedded font is a
    real fact about the document; dropping it would trade a parse failure for a
    lost diagnostic, the worse of the two.

    A file-descriptor `dup2` was written first, on the assumption that MuPDF
    wrote from its C layer past `sys.stdout` — **measured 2026-09-20, it does
    not**: a `redirect_stdout` around `pymupdf.open(...)` plus `get_text()`
    captured the warning in full and nothing leaked. The descriptor machinery
    was doing nothing this does not, and `pdf-structure.py` spawns no
    subprocess, so there is no child writing to fd 1 either. Kept simple
    because the evidence says simple is enough.
    """
    with contextlib.redirect_stdout(sys.stderr):
        yield


def process(path: str, outdir: str | None = None, use_ocr: bool = False,
            backend: str = "auto", latex_source: str | None = None,
            title: str | None = None, langs: list[str] | None = None) -> tuple[dict[str, Any], list[Section]]:
    # Everything that touches a PDF backend runs under the redirect. `process`
    # writes nothing to stdout itself — it RETURNS the artefact and its caller
    # prints it — so nothing legitimate is caught by this.
    with library_noise_to_stderr():
        return _process(path, outdir, use_ocr, backend, latex_source, title, langs)


def latex_source_for(path: str, given: str | None) -> str | None:
    """The LaTeX source to read headings from: the one named, else the entry's
    own `source/` beside the PDF (where `arxiv-source.py` puts it), else none.
    `""` names none, so a caller can switch the lookup off."""
    if given is not None:
        return given or None
    beside = os.path.join(os.path.dirname(os.path.abspath(path)), "source")
    return beside if os.path.exists(beside) else None


def _process(path: str, outdir: str | None = None, use_ocr: bool = False,
             backend: str = "auto", latex_source: str | None = None,
             title: str | None = None, langs: list[str] | None = None) -> tuple[dict[str, Any], list[Section]]:
    reader = open_backend(path, backend)
    pages = reader.page_texts()
    ocr_used = False
    replaced: list[dict[str, Any]] = []
    if use_ocr and text_is_unusable(pages):
        cached = ocr_pages(path, outdir)
        if cached:
            pages, ocr_used = cached, True
    elif use_ocr:
        pages, replaced = replace_failing_pages(pages, ocr_pages(path, outdir), langs or [])
    # Soft hyphens joined before anything splits the text into sections, so
    # every downstream reader sees whole words (bean `3spu`).
    pages = [join_soft_hyphens(p) for p in pages]
    if not ocr_used:
        pages, grade_marks = add_grade_marks(path, pages)
    else:
        grade_marks = 0

    outline, outline_reordered = repair_outline(_toc_entries(reader.raw_toc()), pages)
    outline, outline_rejected = trusted_outline(outline, pages)
    resorted: list[int] = []
    if outline and not ocr_used:
        pages, resorted = print_order_pages(pages, outline, _pymupdf_sorted(path))
    # An inferred table of contents is asked to justify itself; an outline is
    # the document's own answer and is not second-guessed (bean `6xaz`).
    # The page layout, read once for the TOC, the figures and the contents
    # check. None when there is none to read: OCR'd text has no fonts, and a
    # pypdf-only install has no layout-capable backend.
    lines = layout_lines(path, ocr_used)
    # Running heads, footers, folios and side tabs out of the text before it is
    # split, so no section carries them (bean `6chd`).
    pages, furniture_stripped = strip_furniture(pages, lines)
    inferred: list[TocEntry] = []
    inferred_method: str | None = None
    tex_source = latex_source_for(path, latex_source)
    tex = _latex_headings.source_headings(tex_source)[0] if tex_source and not outline else None
    if not outline:
        inferred, inferred_method = infer_toc(lines, pages, tex)
    n_inferred = len(inferred)
    toc_undetermined, mean_confidence, empty_share = inferred_toc_trust(
        inferred, pages, from_source=inferred_method == "latex")
    if toc_undetermined:
        inferred = []
    toc = outline or inferred
    meta = parse_front_matter(pages)
    # No outline and no trusted inference: one section per page rather than one
    # section holding everything (owner, issue #2302, 2026-10-07). A page is
    # worse to read than a chapter and better than a chapter that is fiction —
    # and, unlike the single whole-document section, it can still be cited.
    paged = not toc and bool(pages)
    tidied: list[dict[str, Any]] = []
    if not paged and inferred:
        toc, tidied = tidy_inferred(toc, pages)
        if not ocr_used:
            pages, resorted = print_order_inferred(pages, toc, lines, _pymupdf_sorted(path))
    sections = split_pages(pages) if paged else split_sections(pages, toc)
    if not paged and inferred:
        labels = label_runs(sections)
        if labels:
            tidied += [{"title": t, "page": p, "action": "dropped", "why": "a label in a run of short sections"}
                       for t, p in sorted(labels, key=lambda x: x[1])]
            toc = [e for e in toc if (e.title, e.page) not in labels]
            sections = split_sections(pages, toc)
    oversized: list[dict[str, Any]] = []
    if not paged:
        candidates = inferred
        if outline and lines is not None and any(oversized_section(s, len(pages)) for s in sections):
            candidates = [e for e in infer_toc(lines, pages)[0] if (e.confidence or 0) >= 0.6]
        sections, oversized = split_oversized(sections, pages, candidates, lines)
    figures, figure_gaps = infer_figures(path, lines)
    page_rows, label_conflicts = infer_page_labels(path, lines, len(pages),
                                                   pages if ocr_used else None)
    label_of = {r["physical"]: r["label"] for r in page_rows if r["label"]}
    for e in toc:
        e.page_label = label_of.get(e.page) if e.page else None
    for f in figures:
        f["page_label"] = label_of.get(f["page"])
    for s in sections:
        s.label_start = label_of.get(s.page_start) if s.page_start else None
        s.label_end = label_of.get(s.page_end) if s.page_end else None
    # A printed contents page and the body can disagree — drafts drift. Asked
    # whether or not the PDF has an outline, since the printed contents is
    # what a reader sees either way. Reported, never corrected.
    toc_alignment = _pdf_headings.contents_alignment(lines) if lines else None

    docinfo = reader.docinfo()

    empty = sum(1 for p in pages if len(p.strip()) < 20)
    doc_id = derive_doc_id(path, meta)

    # The title is resolved AFTER the doc id, which is derived from the text
    # walk's metadata and must not move because a better title was found.
    # PyMuPDF reads the heading; the pypdf backend has no font sizes, so it
    # offers the metadata title, the outline and the page text only.
    if reader.name == "pymupdf":
        evidence = evidence_from_pdf(path)
    else:
        evidence = {
            "metadata": docinfo.get("Title"),
            "outline": next((e.title for e in outline if e.level == 1), None),
            "page_text": "\n".join(pages[:2]),
            "browser": bool(BROWSER_RE.search(f"{docinfo.get('Creator', '')} {docinfo.get('Producer', '')}")),
        }
    # A KNOWN title, passed through (`--title`, which `cat ingest` fills from
    # the catalogue's Dublin Core `dc.title`; bean `turh`): it takes the slot of
    # the page-1 guess as the raw title, exactly as `pdf-pages.py --title` does,
    # so the resolver still records whether the PDF corroborates it and the
    # section files' `doc_title` carry it instead of a scan's misreading.
    if title:
        meta = {**meta, "title": title}
    meta = resolve_title(meta | {"docinfo": docinfo}, evidence, doc_id)

    artefact: dict[str, Any] = {
        "_schema": SCHEMA,
        "doc_id": doc_id,
        "source": {
            "file": os.path.basename(path),
            "sha256": sha256_of(path),
            "bytes": os.path.getsize(path),
            "pages": len(pages),
            # Whether this artefact was built from OCR rather than from the
            # PDF's own text. A consumer that ranks or cites this document
            # should know the text is a transcription.
            "text_source": "ocr" if ocr_used else "embedded",
            # Which reader library produced this artefact ("pymupdf" | "pypdf").
            # Additive provenance: it lets a consumer tell an outline read by
            # PyMuPDF's get_toc() from one walked out of pypdf's outline object.
            "extractor": reader.name,
            # `mtime` and the SNIFFED mimetype (bean `nso8`). Merged from the
            # shared module rather than restated so this rung and `pdf-pages`
            # cannot disagree about what the fields mean; `sha256`, `bytes` and
            # `file` are recomputed identically there and simply agree.
            #
            # The mimetype is read from the leading bytes and is **None** when
            # they are unrecognised — never the extension. A `.pdf` that is
            # really a saved error page extracts to nothing, and every verdict
            # about it is then about the wrong document; a guess that agrees
            # with the filename could not tell you that.
            **{k: v for k, v in _tech_meta(path).items()
               if k in ("mtime", "mimetype_sniffed", "mimetype_source")},
            # Which software made OCR'd text (bean `turh`): the reference to
            # the run context `pdf-ocr.py` wrote beside the pages. Absent for
            # an embedded text layer, and for an OCR cache older than it.
            **ocr_run_context_ref(path, outdir, ocr_used),
            # Pages whose text layer failed the page check and were read from
            # the OCR cache instead (`replace_failing_pages`).
            **({"ocr_pages": replaced} if replaced else {}),
            **({"languages": list(langs)} if langs else {}),
        },
        "metadata": meta,
        "toc": [asdict(e) for e in toc],
        # FOUR states, not three. `none` is a DETERMINED "this document has no
        # discoverable table of contents"; `undetermined` is "one was inferred
        # and could not be trusted", and they point at different fixes. Folding
        # the second into the first is the failure `6xaz` records.
        "toc_source": (
            "outline" if outline
            else "inferred" if toc
            else "undetermined" if toc_undetermined
            else "none"
        ),
        # Why, in a sentence a person can check, rather than a bare flag. Absent
        # when the TOC was trusted.
        "toc_undetermined_reason": toc_undetermined,
        # Page granularity, and why, when no contents could be used — the
        # same two fields `pdf-pages.py` writes for an entry it built.
        **({"granularity": "page",
            "structure_note": (
                "No outline, and no inferred contents could be trusted"
                + (f" ({toc_undetermined})" if toc_undetermined else "")
                + ": one section per page.")} if paged else {}),
        # The list of figures and tables, each caption scored by the evidence
        # that agreed: cited in the text, in its numbering run, a graphic on
        # its page, a printed list naming it (`_pdf_figures`, issue #2302).
        "figures": figures,
        # Every physical page with the label a reader sees on it, and which
        # sources agreed: the PDF's /PageLabels, the number printed in its
        # header or footer, a run's interpolation, a contents page.
        "pages": page_rows,
        "sections": [
            {k: v for k, v in asdict(s).items() if k != "text"} for s in sections
        ],
        "diagnostics": {
            "pages_without_text": empty,
            "likely_scanned": empty > len(pages) * 0.5,
            "toc_entries": len(toc),
            # What the verdict was computed FROM, so the threshold can be
            # re-derived from the artefact rather than taken on trust. Reported
            # for every inferred TOC, trusted or not — a number that only
            # appears on failures cannot show you a near miss.
            "toc_inferred_entries": n_inferred,
            # The second test's input, beside the first's, for the same reason.
            **({"toc_inferred_mean_confidence": mean_confidence} if mean_confidence is not None else {}),
            # And the third's: the share of empty sections the tree would cut.
            **({"toc_inferred_empty_share": empty_share} if empty_share is not None else {}),
            # Which inference produced it: "contents" (a printed contents
            # page), "font" (heading styles), "latex" (the paper's own LaTeX
            # source, placed on its pages) or "regex" (text patterns, the last
            # resort). Absent when the outline was used.
            **({"toc_inferred_method": inferred_method} if inferred_method else {}),
            "figure_entries": len(figures),
            # Numbers missing from a caption run ("table 2.1" when there is a
            # Table 2.2): a finding about the DOCUMENT — usually a draft's.
            "figure_sequence_gaps": figure_gaps,
            # Pages where the sources give different labels — e.g. /PageLabels
            # says "3" where the page prints "iii".
            "page_label_conflicts": label_conflicts,
            **({"toc_alignment": toc_alignment} if toc_alignment else {}),
            "sections": len(sections),
            "chars_total": sum(s.n_chars for s in sections),
            # Running heads, footers, folios and side tabs taken out of the
            # page text before the split (`strip_furniture`).
            "furniture_lines_stripped": furniture_stripped,
            # The outline was flat and ran against its own pages, so it was put
            # in page order (`repair_outline`). Absent when it was not.
            **({"outline_reordered": True} if outline_reordered else {}),
            # The outline was found and not used, and why (`trusted_outline`).
            **({"outline_rejected": outline_rejected} if outline_rejected else {}),
            # Sections too long for one block, and how each was cut (`split_oversized`).
            **({"oversized_split": oversized} if oversized else {}),
            **({"headings_tidied": tidied} if tidied else {}),
            **({"pages_read_in_print_order": resorted} if resorted else {}),
            # Runs of GRADE quality-of-evidence marks drawn as vectors and written back as ⊕/⊖.
            **({"grade_marks_written": grade_marks} if grade_marks else {}),
        },
    }
    return artefact, sections


def write_sections(outdir: str, artefact: dict[str, Any], sections: list[Section]) -> None:
    sdir = os.path.join(outdir, "sections")
    os.makedirs(sdir, exist_ok=True)
    for old in os.listdir(sdir):
        if old.endswith(".md"):
            os.remove(os.path.join(sdir, old))

    doc_id = artefact["doc_id"]
    title = (artefact["metadata"].get("title") or "").replace('"', "'")
    for s in sections:
        fm = [
            "---",
            f"doc_id: {doc_id}",
            f'doc_title: "{title[:180]}"',
            f"section_id: {s.id}",
            f'section_title: "{s.title.replace(chr(34), chr(39))[:180]}"',
            f"section_number: {s.number or 'null'}",
            f"pages: {s.page_start}-{s.page_end}",
            f"source_pdf: {artefact['source']['file']}",
            f"source_sha256: {artefact['source']['sha256'][:16]}",
            # Bean `6xaz`: a consumer reading `sections/` could not tell an
            # inferred tree from an outline-derived one without going back to
            # `structure.json`, and the two are not comparable in
            # trustworthiness. Restated here because this file is what gets
            # read, quoted and cited.
            f"toc_source: {artefact['toc_source']}",
            "---",
            "",
        ]
        with open(os.path.join(sdir, f"{s.id}.md"), "w") as fh:
            fh.write("\n".join(fm) + s.text + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description="PDF → metadata + TOC + greppable sections")
    ap.add_argument("pdfs", nargs="*")
    ap.add_argument("--corpus", help="directory of PDFs to process")
    ap.add_argument("-o", "--outdir", default=None,
                    help="root for <doc-id>/ output dirs (default: alongside the PDF)")
    ap.add_argument("--no-sections", action="store_true", help="structure.json only")
    ap.add_argument("--json", action="store_true", help="print artefact to stdout, write nothing")
    ap.add_argument("--ocr", action="store_true",
                    help="for a PDF whose text layer is absent or mojibake, use the "
                         "cached OCR text written by pdf-ocr.py (which must be run first)")
    ap.add_argument("--lang-hint", default="",
                    help="the document's languages as ISO 639 codes, e.g. fr,en (from dc.language.iso): "
                         "with --ocr, the page check (_text_quality.py) judges each page against them")
    ap.add_argument("--latex-source", default=None,
                    help="LaTeX source (directory or e-print) whose \\section commands give the "
                         "headings when the PDF has no outline. Default: the entry's own source/ "
                         "beside the PDF, if there is one. Pass '' to read none.")
    ap.add_argument("--title", default=None,
                    help="a title already known for the document (a catalogue record's dc.title): "
                         "used as the raw title instead of the page-1 parse, and in the sections' doc_title")
    ap.add_argument("--backend", choices=("auto", "pymupdf", "pypdf"), default="auto",
                    help="PDF reader backend. auto (default) prefers PyMuPDF when "
                         "installed (cleaner text + real embedded outlines) and falls "
                         "back to pypdf; naming one forces it (strict, no fallback).")
    args = ap.parse_args()

    targets = list(args.pdfs)
    if args.corpus:
        targets += sorted(
            os.path.join(args.corpus, f)
            for f in os.listdir(args.corpus) if f.lower().endswith(".pdf")
        )
    if not targets:
        ap.error("no PDFs given")

    ok = failed = 0
    for path in targets:
        try:
            artefact, sections = process(path, args.outdir, args.ocr, args.backend, args.latex_source, args.title,
                                         [h for h in args.lang_hint.split(",") if h.strip()])
        except Exception as exc:
            failed += 1
            print(f"FAIL  {os.path.basename(path)}: {type(exc).__name__}: {exc}",
                  file=sys.stderr)
            continue

        if args.json:
            print(json.dumps(artefact, indent=2))
        else:
            root = args.outdir or os.path.dirname(os.path.abspath(path))
            # `-o` is the ROOT that `<doc-id>/` hangs off — the same meaning
            # `pdf-ocr.py -o` now carries. The id is the one already computed by
            # the shared `derive_doc_id` above; recomputing it here would be a
            # second chance to disagree, which is the whole defect of `rlp5`.
            outdir = os.path.join(root, artefact["doc_id"])
            os.makedirs(outdir, exist_ok=True)
            # An editor's title correction is not extraction output, so a
            # re-ingest carries it over rather than erasing it (bean `w6fu`).
            previous = os.path.join(outdir, "structure.json")
            if os.path.exists(previous):
                with contextlib.suppress(ValueError, OSError):
                    with open(previous) as fh:
                        kept = (json.load(fh).get("metadata") or {}).get("title_correction")
                    if kept:
                        artefact["metadata"]["title_correction"] = kept
            with open(os.path.join(outdir, "structure.json"), "w") as fh:
                json.dump(artefact, fh, indent=1)
            if not args.no_sections:
                write_sections(outdir, artefact, sections)
            d = artefact["diagnostics"]
            flag = " SCANNED?" if d["likely_scanned"] else ""
            print(f"ok  {artefact['doc_id']:<34} "
                  f"{artefact['source']['pages']:>4}pp  "
                  f"[{artefact['source']['extractor'][:3]}]  "
                  f"toc={d['toc_entries']:<3}({artefact['toc_source'][:3]})  "
                  f"sec={d['sections']:<3}  {d['chars_total']//1000:>4}kc{flag}")
        ok += 1

    if not args.json:
        print(f"\n{ok} ok, {failed} failed", file=sys.stderr)
    return 1 if failed and not ok else 0


if __name__ == "__main__":
    sys.exit(main())
