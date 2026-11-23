"""
_pdf_page_labels — the page number a reader SEES, for every physical page.
Issue #2302.

A PDF page has a physical index (1, 2, 3 … in the file) and, usually, a
printed label ("iv", "23", "A-3"). They differ whenever there is a cover,
front matter in roman numerals, an unnumbered plate, or a journal article
that starts at p. 177. A citation, a contents page and an index all use the
label; everything this repository writes used to record only the physical
index. Four sources, each evidence for a page's label:

* `pdf-labels` — the PDF's own /PageLabels (PyMuPDF `page.get_label()`).
  The producer's answer when present (19 of 77 corpus PDFs on 2026-10-06),
  but not always clean: one stores `<FEFF0065>213` for "e213", one restarts
  at 1 on its last page.
* `printed` — the number printed in the page's header or footer. Read per
  page, then fitted into runs of constant offset (physical − printed), so a
  roman run and an arabic run each hold. The "legal page number" test of
  Wu, Mitra & Giles (ICDAR 2013): a number is accepted only when it fits a
  run, so a stray "2024" or a figure label does not become a page.
* `interpolated` — a page inside a run that prints no number (a chapter
  opener, a full-page figure) takes the run's value.
* `contents` — a contents entry found in the body pairs a printed label with
  a physical page.

`page_labels` combines them per page and records which agreed; where two
sources disagree the page is reported as a conflict, never silently resolved.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import NamedTuple

from _pdf_headings import Line

ROMAN = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}
RE_ROMAN = re.compile(r"^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$", re.I)


def roman_to_int(s: str) -> int | None:
    if not s or not RE_ROMAN.match(s):
        return None
    s = s.lower()
    total = 0
    for a, b in zip(s, s[1:] + " "):
        v = ROMAN[a]
        total += -v if b != " " and ROMAN.get(b, 0) > v else v
    return total


def int_to_roman(n: int, upper: bool = False) -> str:
    vals = [(1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"), (90, "xc"),
            (50, "l"), (40, "xl"), (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s
            n -= v
    return out.upper() if upper else out


class PageLabel(NamedTuple):
    physical: int
    label: str | None
    source: str | None          # the source the label was taken from
    confidence: float
    evidence: tuple[str, ...]   # every source that agreed with it


# ---------------------------------------------------------------- source 1: /PageLabels

RE_HEXCHUNK = re.compile(r"<FEFF((?:[0-9A-F]{4})+)>", re.I)


def clean_label(raw: str | None) -> str | None:
    """Decode a /PageLabels string. Some producers write the prefix as a hex
    UTF-16 literal that reaches us undecoded: `<FEFF0065>213` is "e213"."""
    if not raw:
        return None
    s = RE_HEXCHUNK.sub(lambda m: bytes.fromhex(m.group(1)).decode("utf-16-be", "replace"), raw)
    s = s.strip()
    return s or None


def pdf_labels(path: str) -> dict[int, str]:
    import pymupdf  # lazy; AGPL, optional
    out: dict[int, str] = {}
    with pymupdf.open(path) as doc:
        for pno, page in enumerate(doc, start=1):
            try:
                lab = clean_label(page.get_label())
            except Exception:
                lab = None
            if lab:
                out[pno] = lab
    return out


# ---------------------------------------------------------------- source 2: printed numbers

# A page-number token, alone on its line or at either end of a running head:
# "12", "- 12 -", "Page 12", "p. 12", "12 of 40", "xii", "Chapter 3 | 41".
RE_FOLIO_ALONE = re.compile(
    r"^[\s\-–—|•·]*(?:page\s+|p\.\s*)?(?P<n>\d{1,4}|[ivxlcdm]{1,8})(?:\s+of\s+\d{1,4})?[\s\-–—|•·]*$", re.I)
RE_FOLIO_EDGE = re.compile(r"^(?P<a>\d{1,4})\s*[|•·]\s+\S|\S\s+[|•·]\s*(?P<b>\d{1,4})$")
# Top/bottom share of the page searched for folios. 9% missed arXiv/LaTeX
# folios set at 9.1% from the edge (2508.21620v2, 2607.20636v1).
MARGIN = 0.12


def _candidates(page_lines: list[Line]) -> list[tuple[str, int]]:
    """(kind, value) folio candidates on one page: 'arabic' or 'roman'."""
    out: list[tuple[str, int]] = []
    for l in page_lines:
        h = l.page_height or 1
        if not (l.y1 < MARGIN * h or l.y0 > (1 - MARGIN) * h):
            continue
        t = l.text.strip()
        m = RE_FOLIO_ALONE.match(t)
        if m:
            n = m.group("n")
            if n.isdigit():
                out.append(("arabic", int(n)))
            else:
                r = roman_to_int(n)
                if r is not None:
                    out.append(("roman", r))
            continue
        m = RE_FOLIO_EDGE.search(t)
        if m:
            out.append(("arabic", int(m.group("a") or m.group("b"))))
    return out


# A scanned page has no layout: its OCR text keeps the line order but not where
# a line sat. The first and last lines of the text are where a running head and
# a folio print, so they stand in for the margins. The run fit below is what
# keeps this honest: a number counts only when it fits a run of three or more
# pages, so a short last line of body text ("12 countries") does not become a
# page label. Measured on who-iris `who-pub-tps-931` (121 scanned pages): the
# last line of page 20 is "15", of page 50 "45", of page 100 "95".
OCR_EDGE_LINES = 2


def text_margin_lines(pages: list[str], edge: int = OCR_EDGE_LINES) -> list[Line]:
    """Margin stand-ins for pages read as plain text (OCR): the first and last
    `edge` non-empty lines of each page, placed at its top and bottom edge."""
    out: list[Line] = []
    for i, text in enumerate(pages, start=1):
        rows = [t.strip() for t in (text or "").splitlines() if t.strip()]
        if not rows:
            continue
        head = rows[:edge]
        tail = rows[-edge:] if len(rows) > edge else []
        for t, y in [(t, 0.0) for t in head] + [(t, 1.0) for t in tail]:
            out.append(Line(page=i, text=t, size=0.0, bold=False, italic=False, caps=False,
                            font="", uniform=1.0, x0=0.0, y0=y, x1=1.0, y1=y,
                            page_height=1.0, page_width=1.0))
    return out


class Run(NamedTuple):
    kind: str
    offset: int        # physical - printed
    first: int         # first physical page the run covers
    last: int
    support: int       # pages with a printed number fitting it


def fit_runs(cands: dict[int, list[tuple[str, int]]], n_pages: int, min_support: int = 3) -> list[Run]:
    """Runs of constant offset, strongest first, claiming pages greedily.

    A run's extent is from its first to its last supporting page; a page is
    claimed by the strongest run whose extent contains it. A candidate fits a
    run only when its value equals physical − offset, which is what makes a
    "2024" in a footer or a "3" from a figure fail: it fits no run with
    support.
    """
    support: dict[tuple[str, int], list[int]] = defaultdict(list)
    for p, cs in cands.items():
        for kind, v in set(cs):
            support[(kind, p - v)].append(p)
    runs: list[Run] = []
    claimed: set[int] = set()
    for (kind, off), ps in sorted(support.items(), key=lambda kv: -len(kv[1])):
        ps = sorted(p for p in ps if p not in claimed)
        if len(ps) < min_support:
            continue
        first, last = ps[0], ps[-1]
        # A run claims its span but not pages another run already holds.
        span = [p for p in range(first, last + 1) if p not in claimed]
        if len(ps) < 0.3 * len(span):         # too sparse to trust the span
            continue
        runs.append(Run(kind, off, first, last, len(ps)))
        claimed.update(span)
    return sorted(runs, key=lambda r: r.first)


def printed_labels(lines: list[Line]) -> tuple[dict[int, str], dict[int, str]]:
    """(direct, interpolated): labels read off a page, and labels a page
    without a printed number takes from the run around it."""
    by_page: dict[int, list[Line]] = defaultdict(list)
    for l in lines:
        by_page[l.page].append(l)
    n_pages = max(by_page) if by_page else 0
    cands = {p: _candidates(ls) for p, ls in by_page.items()}
    runs = fit_runs(cands, n_pages)
    direct: dict[int, str] = {}
    interp: dict[int, str] = {}
    for r in runs:
        for p in range(r.first, r.last + 1):
            v = p - r.offset
            if v < 1:
                continue
            lab = int_to_roman(v) if r.kind == "roman" else str(v)
            if (r.kind, v) in set(cands.get(p, [])):
                direct[p] = lab
            elif p not in direct:
                interp[p] = lab
    return direct, interp


# ---------------------------------------------------------------- source 3: contents page


def contents_labels(lines: list[Line]) -> dict[int, str]:
    """physical -> printed label, from contents entries the body confirms."""
    from _pdf_headings import contents_headings, contents_pages, norm_title, _hits
    entries = contents_headings(lines, with_labels=True)
    if not entries:
        return {}
    by_page: dict[int, list[Line]] = defaultdict(list)
    for l in lines:
        by_page[l.page].append(l)
    toc_pages = set(contents_pages(by_page))
    index: dict[str, list[int]] = defaultdict(list)
    for l in lines:
        if l.page not in toc_pages:
            index[norm_title(l.text)].append(l.page)
    out: dict[int, str] = {}
    for h, label in entries:
        if not label or h.page is None:
            continue
        if any(abs(p - h.page) <= 0 for p in _hits(h.title, index)):
            out[h.page] = label
    return out


# ---------------------------------------------------------------- combination


def _norm(lab: str | None) -> str | None:
    """Comparison form: "p. 177", "Page 177" and "177" are one label."""
    if not lab:
        return None
    return re.sub(r"^(?:p\.|pp\.|page)\s*", "", lab.strip(), flags=re.I).lower() or None


def page_labels(lines: list[Line], n_pages: int, pdf: dict[int, str] | None = None,
                contents: bool = True) -> list[PageLabel]:
    """One `PageLabel` per physical page, from every source available.

    `contents=False` when `lines` are margin stand-ins (`text_margin_lines`):
    they hold no contents page to read."""
    direct, interp = printed_labels(lines)
    toc = contents_labels(lines) if contents else {}
    pdf = pdf or {}
    out: list[PageLabel] = []
    for p in range(1, n_pages + 1):
        votes = {"pdf-labels": pdf.get(p), "printed": direct.get(p),
                 "interpolated": interp.get(p), "contents": toc.get(p)}
        votes = {k: v for k, v in votes.items() if v}
        if not votes:
            out.append(PageLabel(p, None, None, 0.0, ()))
            continue
        # Preference when sources disagree: the number printed ON the page —
        # what a reader sees and cites — then the PDF's /PageLabels, then the
        # contents, then a run's guess. A printed number counts only once it
        # fits a run of at least three pages, so a stray one cannot win.
        # Measured on 9789241548960_eng: /PageLabels says "3" where the page
        # prints "iii", nine pages running; the conflict is still reported.
        order = ["printed", "pdf-labels", "contents", "interpolated"]
        source = next(k for k in order if k in votes)
        label = votes[source]
        agree = tuple(k for k in order if k in votes and _norm(votes[k]) == _norm(label))
        base = {"pdf-labels": 0.7, "printed": 0.7, "contents": 0.6, "interpolated": 0.5}[source]
        conf = min(1.0, base + 0.15 * (len(agree) - 1))
        out.append(PageLabel(p, label, source, round(conf, 2), agree))
    return out


def label_conflicts(lines: list[Line], n_pages: int, pdf: dict[int, str] | None, limit: int = 50,
                    contents: bool = True) -> dict:
    """Pages where two sources give different labels — a printed folio that
    disagrees with /PageLabels is the common draft defect."""
    direct, _ = printed_labels(lines)
    toc = contents_labels(lines) if contents else {}
    pdf = pdf or {}
    items = []
    for p in range(1, n_pages + 1):
        seen = {k: v for k, v in (("pdf-labels", pdf.get(p)), ("printed", direct.get(p)),
                                  ("contents", toc.get(p))) if v}
        if len({_norm(v) for v in seen.values()}) > 1:
            items.append(f"p{p}: " + ", ".join(f"{k} {v}" for k, v in seen.items()))
    return {"count": len(items), "items": items[:limit]}
