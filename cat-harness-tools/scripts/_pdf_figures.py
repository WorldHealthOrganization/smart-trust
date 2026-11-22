"""
_pdf_figures — a list of figures and tables, cross-checked. Issue #2302.

The companion of `_pdf_headings.consensus_headings` for captions. A caption is
found the way a heading is — a line that OPENS with a label and a number set
off by punctuation ("Figure 3:", "Fig 5.", "Table 2 —") — and then confirmed
by evidence independent of how it was found:

* `referenced` — the body cites it elsewhere ("see Figure 3", "Fig. 5
  outlines"). The rule the owner put for headings, applied to figures: a
  real caption is one the text points at.
* `in-sequence` — its number fits the run of its kind (1, 2, 3 …). A gap or
  a second "Figure 3" is visible, and the later duplicate is usually a
  sentence that happens to open a line.
* `graphic` — for a figure, the page carries an image or vector drawing.
  Tables are text and are not asked this.
* `listed` — a printed "List of figures / tables" names it. None of the
  repository's 31 PDFs had one on 2026-10-06; the check is here for the
  documents that do.

"Fig. 5 outlines the phases" opens a line with a label and number but no
separator: that is a REFERENCE, not a caption, and counts as `referenced`
evidence for Figure 5.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import NamedTuple

from _pdf_headings import Line, RE_HAS_WORD, norm_title  # noqa: F401  (Line re-exported for callers)

KINDS = {
    "figure": r"fig(?:ure)?s?\.?",
    "table": r"tables?|tab\.",
    "box": r"box(?:es)?",
    "chart": r"charts?",
    "algorithm": r"algorithms?",
    "listing": r"listings?",
}
_KIND_ALT = "|".join(f"(?P<{k}>{v})" for k, v in KINDS.items())
_NUM = r"(?P<num>[A-Z]?\d{1,3}(?:[.\-]\d{1,3})?[a-z]?)"
# A caption opens its line: label, number, then punctuation.
# The separator may not be followed by a digit, or "Table 4.1 provides" would
# read as Table 4 with the caption "1 provides". The title may be empty: WHO
# sets the label alone ("Table 4.1.") with the caption on the next line.
RE_CAPTION_LINE = re.compile(rf"^\s*(?:{_KIND_ALT})\s*{_NUM}\s*(?:[:.|](?!\d)|\s[-–—])\s*(?P<title>.*)$", re.I)
# A mention anywhere in running text.
RE_MENTION = re.compile(rf"\b(?:{_KIND_ALT})\s*{_NUM}\b", re.I)
RE_LIST_TITLE = re.compile(r"^\s*(?:list of )?(figures|tables|boxes|illustrations)\s*$", re.I)
RE_LIST_ENTRY = re.compile(
    rf"^\s*(?:{_KIND_ALT})\s*{_NUM}\s*[:.\-–—]?\s*(?P<title>.*?\S)\s*(?:[.…·_]\s*){{2,}}\s*(?P<page>\d{{1,4}})\s*$", re.I)


class FigureEntry(NamedTuple):
    kind: str
    number: str
    title: str
    page: int
    confidence: float
    evidence: tuple[str, ...]


def _kind(m: re.Match) -> str:
    return next(k for k in KINDS if m.group(k))


def graphics_pymupdf(path: str) -> dict[int, int]:
    """How many images and vector drawings each page carries (1-based)."""
    import pymupdf  # lazy; AGPL, optional
    out: dict[int, int] = {}
    with pymupdf.open(path) as doc:
        for pno, page in enumerate(doc, start=1):
            try:
                n = len(page.get_images(full=False))
                n += len(page.get_drawings())
            except Exception:
                n = 0
            out[pno] = n
    return out


def _sort_key(num: str) -> tuple:
    parts = re.findall(r"\d+|[A-Za-z]+", num)
    return tuple(int(p) if p.isdigit() else ord(p[0].lower()) - 200 for p in parts)


def _caption_text(i: int, lines: list[Line], first: str) -> str:
    """The caption's title: the rest of its first line plus the lines that
    continue it — same page and size, directly below — up to 300 chars.

    A label set alone ("Table 4.1.") takes the next line as its title even on
    the same row: WHO sets the label in a column of its own beside the text.
    """
    text = first.strip()
    head = lines[i]
    for nxt in lines[i + 1:i + 6]:
        beside = not text and nxt.page == head.page and abs(nxt.y0 - head.y0) < head.size
        below = nxt.page == head.page and 0 <= nxt.y0 - head.y1 < 1.6 * head.size
        if (not (beside or below) or abs(nxt.size - head.size) > 0.6
                or RE_CAPTION_LINE.match(nxt.text) or len(text) > 300):
            break
        part = nxt.text.strip()
        # Rejoin a word hyphenated across the line break ("meth- ods").
        if text.endswith("-") and part[:1].islower():
            text = text[:-1] + part
        else:
            text = f"{text} {part}".strip()
        head = nxt
        if text.endswith("."):
            break
    text = re.sub(r"(\w)- (\w)", lambda m: m.group(1) + m.group(2) if m.group(2).islower() else m.group(0), text)
    return re.sub(r"\s+", " ", text)[:300].strip(" .")


def printed_lists(lines: list[Line], max_scan: int = 25) -> list[tuple[str, str, str, int]]:
    """(kind, number, title, printed page) rows from printed lists of figures."""
    by_page: dict[int, list[Line]] = defaultdict(list)
    for l in lines:
        if l.page <= max_scan:
            by_page[l.page].append(l)
    rows: list[tuple[str, str, str, int]] = []
    for p in sorted(by_page):
        texts = [l.text for l in sorted(by_page[p], key=lambda l: (l.y0, l.x0))]
        if not any(RE_LIST_TITLE.match(t) for t in texts):
            continue
        for t in texts:
            m = RE_LIST_ENTRY.match(t)
            if m:
                rows.append((_kind(m), m.group("num"), m.group("title"), int(m.group("page"))))
    return rows


def figure_list(lines: list[Line], graphics: dict[int, int] | None = None,
                min_confidence: float = 0.5) -> list[FigureEntry]:
    """Captions in reading order, each scored by the evidence that agrees."""
    graphics = graphics or {}
    listed = printed_lists(lines)
    list_pages = {l.page for l in lines if RE_LIST_TITLE.match(l.text)}

    # 1. Caption candidates, and every mention, by (kind, number).
    cands: list[tuple[str, str, str, int, int]] = []    # kind, num, title, page, line index
    mentions: dict[tuple[str, str], list[tuple[int, int]]] = defaultdict(list)   # -> (page, line idx)
    for i, l in enumerate(lines):
        if l.page in list_pages:
            continue
        m = RE_CAPTION_LINE.match(l.text)
        if m and (not m.group("title").strip() or RE_HAS_WORD.search(m.group("title"))):
            cands.append((_kind(m), m.group("num"), m.group("title"), l.page, i))
        for mm in RE_MENTION.finditer(l.text):
            mentions[(_kind(mm), mm.group("num").lower())].append((l.page, i))

    # 2. One caption per (kind, number): the first candidate. A later line
    #    opening "Figure 3." is a sentence, or a running repeat.
    seen: dict[tuple[str, str], tuple] = {}
    for c in cands:
        key = (c[0], c[1].lower())
        if key not in seen:
            seen[key] = c

    # 3. Sequence: a number is in sequence when every smaller number of its
    #    run is also present — 1, 2, 3 … for plain numbering, and 2.1, 2.2 …
    #    within chapter 2 for chapter-prefixed numbering.
    runs: dict[tuple[str, str], set[int]] = defaultdict(set)    # (kind, prefix) -> numbers
    parsed: dict[tuple[str, str], tuple[str, int]] = {}
    for kind, num in seen:
        mm = re.match(r"^(?:([A-Z]?\d+)[.\-])?(\d+)$", num, re.I)
        if mm:
            prefix, n = (mm.group(1) or "").lower(), int(mm.group(2))
            runs[(kind, prefix)].add(n)
            parsed[(kind, num)] = (prefix, n)
    in_seq = {key for key, (prefix, n) in parsed.items()
              if all(k in runs[(key[0], prefix)] for k in range(1, n))}

    listed_keys = {(k, n.lower()) for k, n, _, _ in listed}

    out: list[FigureEntry] = []
    for key, (kind, num, title, page, idx) in seen.items():
        ev: list[str] = []
        refs = [(p, i) for p, i in mentions.get(key, []) if i != idx]
        if refs:
            ev.append("referenced")
        if key in in_seq:
            ev.append("in-sequence")
        if kind in ("figure", "chart") and graphics.get(page, 0) > 0:
            ev.append("graphic")
        if key in listed_keys:
            ev.append("listed")
        # A well-formed caption line is itself evidence (0.5): the checks
        # raise confidence and never remove one. Measured on the DPI-H draft:
        # Tables 2.2, 2.4 and 3.5 failed every check because the draft itself
        # skips 2.1, 2.3 and 3.4 — real captions, in a document whose
        # numbering has gaps. The gap is reported (`sequence_gaps`), not hidden.
        conf = min(1.0, 0.5 + 0.2 * ("referenced" in ev) + 0.1 * ("in-sequence" in ev)
                   + 0.1 * ("graphic" in ev) + 0.3 * ("listed" in ev))
        if conf < min_confidence:
            continue
        out.append(FigureEntry(kind, num, _caption_text(idx, lines, title), page, round(conf, 2), tuple(ev)))
    out.sort(key=lambda e: (e.page, list(KINDS).index(e.kind), _sort_key(e.number)))
    return out


def sequence_gaps(entries: list[FigureEntry]) -> list[str]:
    """Numbers missing from a kind's run — "table 2.1" when the document has
    Table 2.2 but no 2.1. A finding about the document, often a draft's."""
    runs: dict[tuple[str, str], set[int]] = defaultdict(set)
    for e in entries:
        mm = re.match(r"^(?:([A-Z]?\d+)[.\-])?(\d+)$", e.number, re.I)
        if mm:
            runs[(e.kind, mm.group(1) or "")].add(int(mm.group(2)))
    gaps = []
    for (kind, prefix), ns in sorted(runs.items()):
        for k in range(1, max(ns)):
            if k not in ns:
                gaps.append(f"{kind} {prefix + '.' if prefix else ''}{k}")
    return gaps

