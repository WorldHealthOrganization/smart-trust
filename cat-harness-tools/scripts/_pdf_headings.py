"""
_pdf_headings — table-of-contents inference from the PDF's LAYOUT, for the
documents that carry no embedded outline. Issue #2302, bean `cp3v`.

`pdf-structure.py`'s original fallback, `infer_headings`, reads plain page
text with regular expressions. Plain text has thrown away the one signal a
reader uses to see a heading — it is set larger, or bolder, than the body —
so that fallback can only find headings that are NUMBERED or carry one of a
dozen stock names. This module reads the text WITH its font metrics and
offers two methods, measured against held-out PDF outlines by
`toc-benchmark.py` (see `docs/research-and-analysis/toc-extraction.md` for the numbers):

* `font_headings` — the rule-based tree constructor every open pipeline
  starts from (pdfminer / PyMuPDF layout blocks): find the body type, keep
  whole lines set in a more prominent style, drop running furniture, and
  rank the surviving styles into levels, with section numbering overriding
  the rank where present.
* `contents_headings` — parse a printed contents page (dotted leaders or a
  trailing page number), then map each printed page label to a physical page
  by finding the entry's title in the body (Wu, Mitra & Giles, ICDAR 2013).

* `consensus_headings` — both as EVIDENCE rather than alternatives: a
  contents entry confirmed by the body and by a heading style, a style-found
  heading confirmed by its numbering; each entry carries a confidence and the
  evidence that agreed. This is what `pdf-structure.py` uses.

All work on a list of `Line`s, which either backend can produce:
`lines_pymupdf` (preferred, AGPL — see the licence note in pdf-structure.py)
or `lines_pdfminer` (MIT). The methods themselves import nothing.

Results are plain `Heading` tuples so this module does not depend on
pdf-structure.py; the caller converts.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Iterable, NamedTuple


# ---------------------------------------------------------------- data


@dataclass
class Line:
    """One horizontal text line with the style that dominates it."""

    page: int            # 1-based physical page
    text: str
    size: float          # dominant font size (char-weighted), rounded to 0.5
    bold: bool           # dominant span is bold
    italic: bool         # dominant span is italic
    caps: bool           # letters are upper case (capitals or small capitals)
    font: str            # dominant font name, subset prefix removed
    uniform: float       # share of the line's characters in the dominant style
    x0: float
    y0: float
    x1: float
    y1: float
    page_height: float
    page_width: float

    @property
    def style(self) -> tuple[float, bool, bool, bool]:
        return (self.size, self.bold, self.caps, self.italic)


class Heading(NamedTuple):
    level: int
    title: str
    page: int | None
    number: str | None


# ---------------------------------------------------------------- backends

RE_HAS_WORD = re.compile(r"[^\W\d_]{2,}")

RE_BOLD_FONT = re.compile(
    r"bold|black|heavy|semibold|demi|extrabold|(?:^|[-,+])b(?:d|old)?$|cmbx|cmssbx|sfbx|"
    r"\.b$|-b$|medi",
    re.I,
)


RE_ITALIC_FONT = re.compile(r"ital|oblique|(?:^|[-,+])it$|cmti|cmsl|slant", re.I)


def _is_bold(font: str, flags: int = 0) -> bool:
    return bool(flags & 16) or bool(RE_BOLD_FONT.search(font))


def _is_italic(font: str, flags: int = 0) -> bool:
    return bool(flags & 2) or bool(RE_ITALIC_FONT.search(font))


def _caps(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    return len(letters) >= 3 and sum(c.isupper() for c in letters) >= 0.9 * len(letters)


def _strip_subset(font: str) -> str:
    return re.sub(r"^[A-Z]{6}\+", "", font or "")


def _round(size: float) -> float:
    return round(size * 2) / 2


def _dominant(spans: list[tuple[str, float, bool, bool, str]]) -> tuple[float, bool, bool, str, float]:
    """Char-weighted dominant (size, bold, italic, font) of a line, and its
    share of the line's characters.

    Small capitals are set as full capitals at two sizes, so a small-caps
    heading would split its weight between them. Sizes within 25% of each
    other inside an all-capitals run are therefore counted at the larger."""
    weight: Counter = Counter()
    fonts: dict[tuple, Counter] = defaultdict(Counter)
    total = 0
    caps = _caps("".join(s[0] for s in spans))
    top = max((s[1] for s in spans if s[0].strip()), default=0.0)
    for text, size, bold, italic, font in spans:
        n = sum(1 for c in text if not c.isspace())
        if not n:
            continue
        if caps and size >= 0.75 * top:
            size = top
        key = (_round(size), bold, italic)
        weight[key] += n
        fonts[key][font] += n
        total += n
    if not total:
        return 0.0, False, False, "", 0.0
    key, n = weight.most_common(1)[0]
    return key[0], key[1], key[2], fonts[key].most_common(1)[0][0], n / total


def lines_pymupdf(path: str) -> list[Line]:
    import pymupdf  # lazy; AGPL, optional

    out: list[Line] = []
    with pymupdf.open(path) as doc:
        for pno, page in enumerate(doc, start=1):
            try:
                d = page.get_text("dict")
            except Exception:
                continue
            h, w = page.rect.height, page.rect.width
            for b in d.get("blocks", []):
                for ln in b.get("lines", []):
                    dx, _ = ln.get("dir", (1.0, 0.0))
                    if abs(dx) < 0.99:
                        continue
                    spans = [
                        (s.get("text", ""), float(s.get("size", 0)),
                         _is_bold(s.get("font", ""), int(s.get("flags", 0))),
                         _is_italic(s.get("font", ""), int(s.get("flags", 0))),
                         _strip_subset(s.get("font", "")))
                        for s in ln.get("spans", [])
                    ]
                    text = re.sub(r"\s+", " ", "".join(s[0] for s in spans)).strip()
                    if not text:
                        continue
                    size, bold, italic, font, share = _dominant(spans)
                    x0, y0, x1, y1 = ln["bbox"]
                    out.append(Line(pno, text, size, bold, italic, _caps(text), font, share,
                                    x0, y0, x1, y1, h, w))
    return _join_same_baseline(out)


def lines_pdfminer(path: str) -> list[Line]:
    from pdfminer.high_level import extract_pages  # lazy; MIT
    from pdfminer.layout import LTChar, LTTextContainer, LTTextLine

    out: list[Line] = []
    for pno, layout in enumerate(extract_pages(path), start=1):
        h, w = layout.height, layout.width

        def walk(obj):
            if isinstance(obj, LTTextLine):
                yield obj
            elif isinstance(obj, LTTextContainer) or hasattr(obj, "__iter__"):
                try:
                    for child in obj:
                        yield from walk(child)
                except TypeError:
                    return

        for ln in walk(layout):
            spans = [
                (c.get_text(), float(c.size), _is_bold(_strip_subset(c.fontname)),
                 _is_italic(_strip_subset(c.fontname)), _strip_subset(c.fontname))
                for c in ln if isinstance(c, LTChar)
            ]
            text = re.sub(r"\s+", " ", ln.get_text()).strip()
            if not text or not spans:
                continue
            size, bold, italic, font, share = _dominant(spans)
            # pdfminer's y grows upwards; flip so y0 is the top, like PyMuPDF.
            out.append(Line(pno, text, size, bold, italic, _caps(text), font, share,
                            ln.x0, h - ln.y1, ln.x1, h - ln.y0, h, w))
    return _join_same_baseline(out)


RE_BARE_NUMBER = re.compile(r"^(?:\d{1,2}(?:\.\d{1,2}){0,4}|[IVX]{1,5}|[A-Z])\.?$")


def _join_same_baseline(lines: list[Line]) -> list[Line]:
    """Backend order, with a bare section number re-joined to its title.

    Backends often emit "2.1" and "Autonomous Agent" as two lines when the
    number is set in its own box. Left apart, the number is lost and with it
    the depth it states. Only a BARE NUMBER on the left is joined, and only
    across a small gap on the same baseline, so two text columns never are.
    The joined line takes the title's style: the number's own type is often
    different and is not what marks the heading.
    """
    # The backend's own order is kept: PyMuPDF and pdfminer both emit text
    # column by column, while a sort on y would interleave two columns.
    ordered = list(lines)
    out: list[Line] = []
    i = 0
    while i < len(ordered):
        l = ordered[i]
        if RE_BARE_NUMBER.match(l.text) and i + 1 < len(ordered):
            n = ordered[i + 1]
            if (n.page == l.page and abs(n.y0 - l.y0) < 0.4 * max(n.size, 1, l.size)
                    and 0 <= n.x0 - l.x1 < 4 * max(n.size, 1) and RE_HAS_WORD.search(n.text)):
                out.append(Line(n.page, f"{l.text} {n.text}", n.size, n.bold, n.italic, n.caps, n.font,
                                n.uniform, l.x0, min(l.y0, n.y0), n.x1, max(l.y1, n.y1),
                                n.page_height, n.page_width))
                i += 2
                continue
        out.append(l)
        i += 1
    return out


def extract_lines(path: str, backend: str = "auto") -> list[Line]:
    if backend in ("auto", "pymupdf"):
        try:
            return lines_pymupdf(path)
        except ImportError:
            if backend == "pymupdf":
                raise
    return lines_pdfminer(path)


# ---------------------------------------------------------------- helpers

RE_NUM = re.compile(
    r"^(?:(?P<prefix>chapter|section|part|component|annex|appendix)\s+)?"
    r"(?P<num>\d{1,2}(?:\.\d{1,2}){0,4}|[IVX]{1,5}|[A-Z](?:\.\d{1,2}){0,3})"
    r"(?:[.:)]|\s)\s*(?P<title>\S.*)$",
    re.I,
)
# A caption's label: never a section, at any size.
RE_CAPTION = re.compile(
    r"^(?:fig(?:ure)?\.?|table|tab\.|algorithm|listing|box|panel|chart|exhibit)\s*[\dA-Z][\d.]*\s*[:.\-–—]",
    re.I,
)
# Lines that are set like headings but are not sections.
RE_NOT_SECTION = re.compile(
    r"^(?:fig(?:ure)?\.?|table|tab\.|algorithm|listing|box|panel|source|note|notes|"
    r"proof|theorem|lemma|proposition|corollary|definition|remark|example|exercise|"
    r"conjecture|claim|step|case|equation|keywords?|index terms|e-?mail|https?:)\b"
    r"(?:\s*[\dA-Z.:]*\s*$|\s*\d)",
    re.I,
)


def norm_title(s: str) -> str:
    """Comparison form: lower-case, accents and numbering stripped."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"^\s*(?:(?:chapter|section|part|component|annex|appendix)\s+)?"
               r"(?:\d+(?:\.\d+)*|[ivx]+|[a-z](?:\.\d+)*)[.:)]?\s+", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return s.strip()


def split_number(text: str) -> tuple[str | None, str]:
    m = RE_NUM.match(text)
    if not m:
        return None, text
    num, title = m.group("num"), m.group("title").strip()
    # A single capital letter is a section number only when what follows reads
    # as a title ("A Proof of ..."), never an ordinary word run ("I think").
    if re.fullmatch(r"[A-Za-z]", num) and not re.search(r"appendix|annex", text[:12], re.I):
        if not title[:1].isupper() or num.lower() in ("a", "i") and not re.match(r"^[A-Z][.:]", text):
            return None, text
    if re.fullmatch(r"[IVX]+", num, re.I) and not re.match(r"^[IVX]+[.:)]", text, re.I):
        return None, text
    # An annex or appendix is a numbering series of its own. Dropping the word
    # made "Annex 1" and chapter "1" the same number, so annexes collided with
    # chapters (folio-assistant#2302, measured on LNOB and DDCC:VS). The word is
    # kept, capitalised, for those two only: "Chapter 1" and "Section 1" are
    # the main series and stay "1".
    prefix = (m.group("prefix") or "").lower()
    if prefix in ("annex", "appendix"):
        num = f"{prefix.capitalize()} {num}"
    return num, title


def _depth(num: str | None) -> int | None:
    """Depth a section number states. A Roman numeral is a top-level
    section; a lone letter is ambiguous (appendix "A", or subsection "A"
    under "II") so it states nothing and the style decides."""
    if not num:
        return None
    # "Annex 2" and "Appendix B.1" state their depth after the word.
    num = re.sub(r"^(?:annex|appendix)\s+", "", num, flags=re.I)
    if re.fullmatch(r"[IVX]+", num, re.I):
        return 1
    if re.fullmatch(r"[A-Z]", num, re.I):
        return None
    return num.count(".") + 1                  # "2.1" and "A.1" alike


def body_size(lines: Iterable[Line]) -> float:
    c: Counter = Counter()
    for l in lines:
        c[l.size] += len(l.text)
    return c.most_common(1)[0][0] if c else 0.0


def furniture_keys(lines: list[Line], n_pages: int) -> set[str]:
    """Text that recurs on many pages — running heads, footers, stamps."""
    if n_pages < 4:
        return set()
    pages_of: dict[str, set[int]] = defaultdict(set)
    for l in lines:
        k = re.sub(r"\d+", "#", l.text.lower()).strip()
        pages_of[k].add(l.page)
    limit = max(3, 0.2 * n_pages)
    return {k for k, ps in pages_of.items() if len(ps) >= limit}


def _furniture_key(l: Line) -> str:
    return re.sub(r"\d+", "#", l.text.lower()).strip()


# ---------------------------------------------------------------- method 1: font


def font_headings(lines: list[Line], max_levels: int = 4, styles_out: list | None = None) -> list[Heading]:
    """Headings set in a heading style. If `styles_out` is a list, the style
    of each returned heading is appended to it, in order."""
    if not lines:
        return []
    n_pages = max(l.page for l in lines)
    body = body_size(lines)
    furniture = furniture_keys(lines, n_pages)
    # A printed contents page is a list of every heading, set in heading
    # styles; read as headings it would put the whole document on that page.
    by_page: dict[int, list[Line]] = defaultdict(list)
    for l in lines:
        by_page[l.page].append(l)
    skip_pages = set(contents_pages(by_page, max_scan=n_pages, every_run=True))

    # Page 1's front matter (title, byline, affiliations) is set prominently
    # and is not a section. Skip it up to the first line that opens one.
    first_opening = None
    for l in lines:
        if l.page > 1:
            break
        t = l.text.strip().lower()
        # "Abstract" opens a paragraph ("Abstract—Existing work ..."); the
        # others must be the whole line, or a title that merely begins
        # "Table of Contents Recognition ..." would end the front matter.
        if (re.match(r"^abstract\b", t)
                or re.match(r"^(?:summary|contents|table of contents|introduction|"
                            r"(?:1|i)\.?\s+introduction)\s*$", t)
                or re.match(r"^(?:1\.?|i\.)\s+[a-z]", t) and len(t) < 60):
            first_opening = (l.y0, l.x0)
            break

    # No section opens on page 1 of a longer document: page 1 is a cover —
    # title, logos, publisher — and none of it is a section.
    cover = first_opening is None and n_pages > 4

    cands: list[Line] = []
    for l in lines:
        t = l.text.strip()
        if l.uniform < 0.85 or not RE_HAS_WORD.search(t) or not (2 <= len(t) <= 160):
            continue
        if _furniture_key(l) in furniture or l.page in skip_pages:
            continue
        # Margins: running heads and folios live in the outer 6% of the page.
        if l.y1 < 0.06 * l.page_height or l.y0 > 0.94 * l.page_height:
            continue
        prominent = l.size >= body + 0.9 or (l.bold and l.size >= body - 0.6)
        # A NUMBERED line set apart from the body some other way — capitals
        # or small capitals ("I. INTRODUCTION"), or italic ("A. Search
        # strategy"), the IEEE and ACM conventions — is a heading even at
        # body size and weight.
        if not prominent and l.size >= body - 0.6 and (l.caps or l.italic) and len(t) <= 100:
            num, _ = split_number(t)
            prominent = num is not None
        if not prominent:
            continue
        # Figure captions, theorem labels and proof steps are set in BOLD BODY
        # type; type set clearly larger than the body is a heading whatever
        # its first word ("Step 1: Create the module" heads a section of a
        # manual). Measured on the iHRIS handbook: applying this list to
        # large type lost 264 real headings.
        if RE_CAPTION.match(t) or l.size < body + 0.9 and RE_NOT_SECTION.match(t):
            continue
        if l.page == 1 and (cover or first_opening and (l.y0, l.x0) < first_opening):
            continue
        cands.append(l)

    # Continue a heading onto the lines that carry on its title: same page
    # and style, directly below, not numbered themselves. The continuation
    # need not have qualified as a heading on its own — a numbered italic
    # heading's second line carries no number, so the numbered-line rule
    # never admits it. Measured on 2506.20759v1 (IEEE): five "A. RQ1. What
    # agile management approaches have been / proposed for developing …?"
    # headings were cut at the line break, each a miss AND an extra.
    pos = {id(l): i for i, l in enumerate(lines)}
    grown: list[Line] = []
    absorbed: set[int] = set()
    for l in cands:
        if id(l) in absorbed:
            grown.append(l)
            continue
        i = pos[id(l)]
        cur = l
        while i + 1 < len(lines) and len(cur.text) < 200:
            n = lines[i + 1]
            # A wrapped title continues in lower case ("proposed for …") or
            # after a hyphen or comma; a line opening with a capital in the
            # same style is the NEXT heading. Without this test the rule
            # joined adjacent headings and cost 0.07 title F1 overall.
            wraps = n.text.lstrip()[:1].islower() or cur.text.rstrip().endswith(("-", ","))
            if (not wraps or n.page != cur.page or n.style != cur.style
                    or not (cur.y0 < n.y0 and -0.5 * n.size <= n.y0 - cur.y1 < 0.8 * n.size)
                    or split_number(n.text)[0] is not None):
                break
            text = (cur.text[:-1] + n.text.lstrip()) if cur.text.endswith("-") and n.text[:1].islower() \
                else f"{cur.text} {n.text}"
            cur = Line(cur.page, text, cur.size, cur.bold, cur.italic, cur.caps, cur.font, cur.uniform,
                       min(cur.x0, n.x0), cur.y0, max(cur.x1, n.x1), n.y1, cur.page_height, cur.page_width)
            absorbed.add(id(n))            # the line appended, by identity
            i += 1
        grown.append(cur)
    # A continuation that was also a candidate in its own right is now part
    # of the heading above it, and is not a heading of its own.
    cands = [g for g, c in zip(grown, cands) if id(c) not in absorbed]

    # Merge a heading set over two lines: same page and style, close below,
    # and the continuation does not start a new number.
    merged: list[Line] = []
    for l in cands:
        p = merged[-1] if merged else None
        if (p and p.page == l.page and p.style == l.style
                and p.y0 < l.y0 and -0.5 * l.size <= l.y0 - p.y1 < 0.8 * l.size
                and split_number(l.text)[0] is None
                and not p.text.rstrip().endswith(".")):
            merged[-1] = Line(p.page, f"{p.text} {l.text}", p.size, p.bold, p.italic, p.caps, p.font, p.uniform,
                              min(p.x0, l.x0), p.y0, max(p.x1, l.x1), l.y1, p.page_height, p.page_width)
        else:
            merged.append(l)

    # A heading reads as a heading, not a sentence or a table cell.
    def heading_like(l: Line) -> bool:
        t = l.text.strip()
        num, title = split_number(t)
        if len(title) > 140 or title.endswith((".", ",", ";")) and not num:
            return False
        if sum(c.isdigit() for c in title) > len(title) / 3:
            return False
        # A number followed by a lower-case word is a sentence that happens to
        # open a line ("3.1 describes the modelling approach ..."), not a
        # numbered heading. Unnumbered lower-case titles stay possible: a
        # manual heads entries with identifiers ("nextOfKin").
        if num and title[:1].islower():
            return False
        small = l.size < body + 0.9
        # Markup or code in body type is a code fragment; in large type it is
        # a reference manual's entry heading ("<configuration>").
        if small and re.match(r"^[<>{}\[\]=#/\\|$@]", title):
            return False
        # A bold body-size line ending in a colon is a label ("Prompt:")
        # introducing what follows, not a section title.
        if small and not num and title.endswith(":"):
            return False
        # Body-size bold is also emphasis — and a numbered pseudocode line
        # ("7 end") — so it must open like a title. Type
        # set clearly larger than the body needs no such test: reference
        # manuals head entries with lower-case identifiers ("nextOfKin").
        if l.size < body + 0.9 and not re.match(r"^[\W\d]*[A-Z0-9(\"'“]", title):
            return False
        return True

    merged = [l for l in merged if heading_like(l)]

    # A style that fires many times per page is emphasis or a table header,
    # not a section style. Real heading styles are sparse.
    per_style_pages: dict[tuple, set[int]] = defaultdict(set)
    per_style_count: Counter = Counter()
    for l in merged:
        per_style_pages[l.style].add(l.page)
        per_style_count[l.style] += 1
    dense = {s for s, n in per_style_count.items() if n / max(1, len(per_style_pages[s])) > 4}
    merged = [l for l in merged if l.style not in dense]
    if not merged:
        return []

    # Rank styles: larger first, bold before regular at the same size.
    styles = sorted({l.style for l in merged}, key=lambda s: (-s[0], not s[1], not s[2], s[3]))
    rank = {s: i + 1 for i, s in enumerate(styles)}

    # Where styles carry section numbers, the numbering depth is the truth;
    # learn which depth each style mostly carries and use it for the
    # style's unnumbered headings too.
    style_depth: dict[tuple, Counter] = defaultdict(Counter)
    for l in merged:
        d = _depth(split_number(l.text)[0])
        if d:
            style_depth[l.style][d] += 1
    learned = {s: c.most_common(1)[0][0] for s, c in style_depth.items()}

    out: list[Heading] = []
    out_styles: list[tuple] = []
    for l in merged:
        num, title = split_number(l.text.strip())
        level = _depth(num) or learned.get(l.style) or rank[l.style]
        out.append(Heading(min(level, max_levels + 2), title.strip(), l.page, num))
        out_styles.append(l.style)
    out = tree_levels(out)
    # Drop a heading that repeats on the same or the next page (a chapter
    # title restated at the top of its first page, say). The same title
    # further on is a different section: a manual opens "Configuration
    # Settings" in chapter after chapter.
    last: dict[str, int] = {}
    uniq = []
    for h, st in zip(out, out_styles):
        k = f"{h.number}|{norm_title(h.title)}"
        if k in last and h.page is not None and h.page - last[k] <= 1:
            continue
        last[k] = h.page if h.page is not None else last.get(k, 0)
        uniq.append(h)
        if styles_out is not None:
            styles_out.append(st)
    return uniq


def tree_levels(heads: list[Heading]) -> list[Heading]:
    """Re-level as depth in the tree each heading implies.

    The rank of a style is not a depth: a rare style ranked between two
    common ones (a code fragment, a callout) leaves the real levels at 1, 3
    and 5. The repair of Bentabet et al. (2019) — the parent is the nearest
    earlier heading at a strictly shallower rank — gives the depth those
    ranks actually describe, and a document whose largest styles were front
    matter starts at 1 rather than 3.
    """
    out: list[Heading] = []
    stack: list[tuple[int, int]] = []          # (rank, depth)
    for h in heads:
        while stack and stack[-1][0] >= h.level:
            stack.pop()
        depth = stack[-1][1] + 1 if stack else 1
        stack.append((h.level, depth))
        out.append(h._replace(level=depth))
    return out


# ---------------------------------------------------------------- method 2: contents page

RE_LEADER = re.compile(r"^(?P<title>.*?\S)\s*(?:[.…·_]\s*){3,}\s*(?P<page>\d{1,4}|[ivxlc]{1,6})\s*$", re.I)
RE_TRAIL = re.compile(r"^(?P<title>.*?[^\d\s.])\s{1,}(?P<page>\d{1,4}|[ivxl]{1,5})\s*$")
RE_CONTENTS_TITLE = re.compile(r"^\s*(?:table of )?contents\s*$|^\s*sommaire\s*$|^\s*índice\s*$", re.I)
RE_MONTH_YEAR = re.compile(
    r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\s+(?:19|20)\d\d\s*$",
    re.I,
)
_ROMAN_VALS = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100}


def _roman_to_int(s: str) -> int | None:
    s = s.strip().lower()
    if not s or not re.fullmatch(r"c{0,3}(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})", s):
        return None
    total = prev = 0
    for ch in reversed(s):
        v = _ROMAN_VALS[ch]
        total += -v if v < prev else v
        prev = v
    return total if total > 0 else None


def _rows(page_lines: list[Line]) -> list[Line]:
    """Join lines that share a baseline: a contents entry's title, leader and
    page number are often three separate text lines."""
    rows: list[list[Line]] = []
    for l in sorted(page_lines, key=lambda l: (l.y0, l.x0)):
        if rows and abs(rows[-1][0].y0 - l.y0) < 0.5 * max(l.size, 1) and abs(rows[-1][0].y1 - l.y1) < 0.6 * max(l.size, 1):
            rows[-1].append(l)
        else:
            rows.append([l])
    out = []
    for r in rows:
        r.sort(key=lambda l: l.x0)
        f = r[0]
        out.append(Line(f.page, " ".join(x.text for x in r), f.size, f.bold, f.italic, f.caps, f.font, f.uniform,
                        f.x0, f.y0, max(x.x1 for x in r), max(x.y1 for x in r), f.page_height, f.page_width))
    return out


def _parse_entry(t: str) -> tuple[str, str] | None:
    t = re.sub(r"[\x00-\x08\x0b-\x1f]", " ", t)          # stray control characters
    leader = RE_LEADER.match(t)
    m = leader or RE_TRAIL.match(t)
    if not m:
        return None
    # A line without leaders ending in "<Month> <YYYY>" ("... 27 August 2021")
    # is a date in a running header or cover line, not a title on page 2021.
    if not leader and RE_MONTH_YEAR.search(t):
        return None
    title = m.group("title").strip(" .")
    if not RE_HAS_WORD.search(title):
        return None
    return title, m.group("page")


def contents_pages(by_page: dict[int, list[Line]], max_scan: int = 20,
                   every_run: bool = False) -> list[int]:
    """Pages that are mostly entries ending in a page number.

    By default the first contiguous run within the first `max_scan` pages —
    the document's contents (Wu et al. 2013 search min(20, N/5)). With
    `every_run`, every such page anywhere: the font method must skip an
    appendix's own contents page too."""
    found: list[int] = []
    for p in sorted(by_page)[:max_scan]:
        rows = _rows(by_page[p])
        if not rows:
            continue
        entries = sum(1 for r in rows if _parse_entry(r.text))
        has_title = any(RE_CONTENTS_TITLE.match(r.text) for r in rows)
        if entries >= 5 and (entries >= 0.4 * len(rows) or has_title and entries >= 0.25 * len(rows)):
            found.append(p)
        elif found and not every_run:
            break                     # contents pages are contiguous
    return found


def contents_headings(lines: list[Line], with_labels: bool = False) -> list:
    """Entries of a printed contents page, page labels moved to physical
    pages. With `with_labels`, (Heading, printed label) pairs instead."""
    by_page: dict[int, list[Line]] = defaultdict(list)
    for l in lines:
        by_page[l.page].append(l)
    pages = contents_pages(by_page)
    if not pages:
        return []

    n_pages = max(by_page)
    furniture = furniture_keys(lines, n_pages)
    raw: list[tuple[str, str, float, Line]] = []    # title, label, x0, row
    for p in pages:
        pending: Line | None = None
        page_lines = [
            l for l in by_page[p]
            if not (l.y1 < 0.06 * l.page_height or l.y0 > 0.94 * l.page_height)
        ]
        for r in _rows(page_lines):
            if RE_CONTENTS_TITLE.match(r.text) or _furniture_key(r) in furniture:
                continue
            parsed = _parse_entry(r.text)
            if parsed:
                title, label = parsed
                x0 = r.x0
                # A wrapped title continues in the same font style; a larger
                # bold group heading ("Part 1. Overview ...") above a body-size
                # entry ("Background . . . 2") is a separate heading, not the
                # first line of that entry.
                if (pending is not None and r.style == pending.style
                        and r.y0 - pending.y1 < 0.8 * r.size and not split_number(title)[0]):
                    title, x0 = f"{pending.text} {title}", pending.x0
                raw.append((title, label, x0, r))
                pending = None
            else:
                pending = r if RE_HAS_WORD.search(r.text) and len(r.text) < 140 else None
    if len(raw) < 3:
        return []

    # Levels: numbering depth where present; otherwise the depth of the
    # indentation column (clustered within 6pt so 1pt jitter does not split
    # a column), learned from its numbered entries and normalized with tree_levels.
    clusters: list[float] = []
    for x in sorted({x for _, _, x, _ in raw}):
        if not clusters or x - clusters[-1] > 6.0:
            clusters.append(x)

    def _cluster(x: float) -> int:
        return min(range(len(clusters)), key=lambda i: abs(clusters[i] - x))

    col_depths: dict[int, Counter] = defaultdict(Counter)
    for title, _, x0, _ in raw:
        d = _depth(split_number(title)[0])
        if d:
            col_depths[_cluster(x0)][d] += 1
    learned_col = {
        c: (1 if 1 in cnt else cnt.most_common(1)[0][0])
        for c, cnt in col_depths.items()
    }

    # Printed page label -> physical page: the most common offset at which an
    # entry's title is found as a line in the body (learned separately for
    # Arabic and Roman page numerals).
    body = [l for l in lines if l.page not in pages]
    index: dict[str, list[int]] = defaultdict(list)
    for l in body:
        index[norm_title(l.text)].append(l.page)
    offsets: Counter = Counter()
    roman_offsets: Counter = Counter()
    for title, label, _, _ in raw:
        key = norm_title(title)
        if label.isdigit():
            for phys in index.get(key, []):
                offsets[phys - int(label)] += 1
        else:
            r_val = _roman_to_int(label)
            if r_val is not None:
                for phys in index.get(key, []):
                    if phys >= r_val:
                        roman_offsets[phys - r_val] += 1
    offset = offsets.most_common(1)[0][0] if offsets else 0
    roman_offset = roman_offsets.most_common(1)[0][0] if roman_offsets else 0

    heads: list[Heading] = []
    labels: list[str] = []
    for title, label, x0, r in raw:
        num, t = split_number(title)
        col = _cluster(x0)
        level = _depth(num) or learned_col.get(col) or (col + 1)
        if label.isdigit():
            page = int(label) + offset
        elif _roman_to_int(label) is not None:
            page = _roman_to_int(label) + roman_offset
        else:
            page = None
        if page is not None and not (1 <= page <= n_pages):
            page = None
        heads.append(Heading(level, t, page, num))
        labels.append(label)
    heads = tree_levels(heads)
    return list(zip(heads, labels)) if with_labels else heads


# ---------------------------------------------------------------- method 3: hybrid


def layout_headings(lines: list[Line]) -> tuple[list[Heading], str]:
    """The printed contents when the document has one, else font metrics.

    Returns the headings and which method produced them.
    """
    toc = contents_headings(lines)
    if len(toc) >= 5:
        return toc, "contents"
    return font_headings(lines), "font"


# ---------------------------------------------------------------- labelled steps

# A step label set apart from its heading: "STEP 1" in a box beside the
# heading, as the WHO digital transformation handbooks print every step.
RE_STEP_LABEL = re.compile(r"^\s*step\s+(\d{1,2})\s*[.:]?\s*$", re.I)
# A heading is set in type this much larger than the body.
STEP_HEADING_SCALE = 1.6


def _runs(page_lines: list[Line], min_size: float) -> list[tuple[float, float, float, str]]:
    """Consecutive large lines of one size joined into one title:
    (y0, y1, size, text). A heading broken over two lines is one heading."""
    out: list[list] = []
    for l in page_lines:
        if l.size < min_size or not RE_HAS_WORD.search(l.text):
            continue
        last = out[-1] if out else None
        if last and last[2] == l.size and -0.5 * l.size <= l.y0 - last[1] <= 0.8 * l.size:
            last[1] = l.y1
            last[3] = f"{last[3]} {l.text.strip()}"
        else:
            out.append([l.y0, l.y1, l.size, l.text.strip()])
    return [tuple(r) for r in out]


def step_headings(lines: list[Line]) -> list[Heading]:
    """Steps a document labels as such: a "STEP n" label next to a large heading.

    The printed contents of a WHO digital transformation handbook may list its
    chapters only, while each chapter is a run of labelled steps (measured on
    9789240116191-eng: 14 contents entries, 18 steps, all hand-added to the
    who-iris entry). The label is the evidence, not the style alone: a generic
    style-found subsection is still not added beneath a contents page.

    The heading is the large run nearest the label on its page, above or below,
    within six lines. Returned as "Step n. <heading>", at level 2 (relative: the
    caller places it under the contents entry it falls in). Fewer than two
    labels is not a step structure, so nothing is returned.
    """
    bsize = body_size(lines)
    if not bsize:
        return []
    by_page: dict[int, list[Line]] = defaultdict(list)
    for l in lines:
        by_page[l.page].append(l)
    out: list[tuple[int, float, Heading]] = []
    seen: set[tuple[int, str]] = set()
    for page, page_lines in sorted(by_page.items()):
        runs = None
        for l in page_lines:
            m = RE_STEP_LABEL.match(l.text)
            if not m:
                continue
            if runs is None:
                runs = _runs(page_lines, STEP_HEADING_SCALE * bsize)
            # The nearest run either side: the handbooks set the label just
            # above the heading, other layouts beside or below it.
            dist = [(r[0] - l.y1 if r[0] >= l.y1 - 2 else l.y0 - r[1], r) for r in runs]
            dist = [(d, r) for d, r in dist if d >= -2 and d <= 6 * max(l.size, bsize)]
            if not dist:
                continue
            run = min(dist, key=lambda x: x[0])[1]
            title = re.sub(r"\s+", " ", run[3]).strip()
            key = (page, norm_title(title))
            if key in seen:
                continue
            seen.add(key)
            out.append((page, run[0], Heading(2, f"Step {int(m.group(1))}. {title}", page, None)))
    # In the order the page prints them, which the text stream need not follow.
    out.sort(key=lambda t: (t[0], t[1]))
    return [h for *_, h in out] if len(out) >= 2 else []


# ---------------------------------------------------------------- method 4: consensus

# Section names a document leaves unnumbered even when it numbers the rest.
STOCK_SECTIONS = re.compile(
    r"^(?:abstract|summary|executive summary|introduction|preface|foreword|acknowledge?ments?|"
    r"references|bibliography|appendi(?:x|ces)\b.*|annex(?:es)?\b.*|glossary|abbreviations|"
    r"conclusions?|discussion|limitations|related work|contents|index)$",
    re.I,
)


class ScoredHeading(NamedTuple):
    heading: Heading
    confidence: float          # 0..1
    sources: tuple[str, ...]   # which evidence agreed


def _found_near(title: str, page: int | None, index: dict[str, list[int]], slack: int = 1) -> bool:
    """Is `title` a line of the body, on or near `page`?"""
    hits = _hits(title, index)
    if not hits:
        return False
    return page is None or any(abs(p - page) <= slack for p in hits)


def _hits(title: str, index: dict[str, list[int]]) -> list[int]:
    """Pages where a body line carries `title` — exactly, as the first
    line of a title that wraps (either is a prefix of the other, and the
    shorter is substantial), or with minor wording inflection."""
    key = norm_title(title)
    if not key:
        return []
    hits = list(index.get(key, []))
    hits += [p for k, ps in index.items() if k != key and min(len(k), len(key)) >= 12
             and (key.startswith(k) or k.startswith(key) or similar(key, k) >= 0.84) for p in ps]
    return hits


def _match(a: Heading, pool: list[Heading]) -> Heading | None:
    ka = norm_title(a.title)
    for b in pool:
        if similar(ka, norm_title(b.title)) >= 0.85 and (a.page is None or b.page is None or abs(a.page - b.page) <= 1):
            return b
    return None


def consensus_headings(lines: list[Line], others: dict[str, list[Heading]] | None = None,
                       min_confidence: float = 0.5) -> list[ScoredHeading]:
    """The highest-confidence TOC the evidence supports, each entry scored.

    Independent evidence for an entry:
      * a printed CONTENTS page lists it;
      * the BODY carries it as a line on or near the page it points to — the
        cross-check: a contents entry never found in the body is suspect;
      * a heading STYLE marks it (`font_headings`);
      * a section NUMBER is set with it;
      * another extractor agrees (`others`, e.g. Grobid's TEI headings).

    With a contents page, its entries are the spine and the evidence sets
    each one's confidence: confirmed in the body and marked by a heading
    style is near certain, listed only on the contents page is kept but
    flagged. Nothing is added beneath it. Without one, the
    style-found headings are the spine; in a document that numbers its
    sections, an unnumbered heading in a style no numbered heading uses — a
    box title, a run-in label — is dropped unless it is a stock section name
    or another extractor confirms it.
    """
    others = others or {}
    styles: list = []
    font = font_headings(lines, styles_out=styles)
    contents = contents_headings(lines)
    by_page: dict[int, list[Line]] = defaultdict(list)
    for l in lines:
        by_page[l.page].append(l)
    toc_pages = set(contents_pages(by_page))
    index: dict[str, list[int]] = defaultdict(list)
    for l in lines:
        if l.page not in toc_pages:
            index[norm_title(l.text)].append(l.page)
    for fh in font:
        if fh.page and fh.page not in toc_pages:
            index[norm_title(fh.title)].append(fh.page)

    def agree(h: Heading) -> list[str]:
        return [name for name, hs in others.items() if _match(h, hs)]

    out: list[ScoredHeading] = []
    if len(contents) >= 5:
        for h in contents:
            src = ["contents"]
            if _found_near(h.title, h.page, index):
                src.append("body")
            if _match(h, font):
                src.append("style")
            if h.number:
                src.append("number")
            src += agree(h)
            # The printed contents is the author's own list, so it alone keeps
            # an entry (0.5); the body and style checks raise confidence. An
            # entry the body never confirms stays, flagged low: measured on
            # 9789240093362-eng, dropping the 4 unconfirmed entries removed
            # real sections whose body wording differs from the contents line.
            conf = min(1.0, 0.5 + 0.25 * ("body" in src) + 0.15 * ("style" in src)
                       + 0.05 * ("number" in src) + 0.05 * (len(src) > 4))
            out.append(ScoredHeading(h, conf, tuple(src)))
        # No style-found subsections are added beneath a contents page: the
        # printed contents is a deliberate choice of depth. Measured on
        # 9789241548960_eng, adding the 35 subsections whose numbers extend a
        # contents entry cost 0.06 title F1 against the document's outline.
        # Labelled steps are the exception (`step_headings`): the label says
        # the document divides there, which a style alone does not. A step
        # the contents already lists is not added twice.
        listed = [h for h, *_ in out]
        for st in step_headings(lines):
            bare = re.sub(r"^Step \d+\.\s*", "", st.title)
            if any(similar(bare, h.title) >= 0.85 or similar(st.title, h.title) >= 0.85 for h in listed):
                continue
            parent = max((h for h in listed if (h.page or 0) <= (st.page or 0)),
                         key=lambda h: h.page or 0, default=None)
            level = (parent.level + 1) if parent else 2
            out.append(ScoredHeading(st._replace(level=level), 0.85, ("step-label", "style")))
        out.sort(key=lambda s: (s.heading.page or 0))
    else:
        numbered_styles = {st for h, st in zip(font, styles) if h.number}
        # "Numbers its sections" means MOST of its headings carry a number: a
        # manual with a few numbered steps among unnumbered entries does not,
        # and dropping its unnumbered headings lost 96% of the iHRIS handbook.
        n_num = sum(1 for h in font if h.number)
        doc_numbered = n_num >= 3 and n_num >= 0.5 * len(font)
        for h, st in zip(font, styles):
            src = ["style"]
            if h.number:
                src.append("number")
            if st in numbered_styles:
                src.append("numbered-style")
            if STOCK_SECTIONS.match(h.title.strip()):
                src.append("stock-name")
            src += agree(h)
            confirmed = len(src) > 1
            if doc_numbered and not confirmed:
                continue                      # an unconfirmed stray style
            # In a document that does not number its sections the style is the
            # only evidence there can be, so it alone clears the bar; in one
            # that does, a heading must also be numbered or otherwise confirmed.
            base = 0.45 if doc_numbered else 0.6
            conf = min(1.0, base + 0.2 * ("number" in src) + 0.1 * ("numbered-style" in src)
                       + 0.1 * ("stock-name" in src) + 0.25 * bool(agree(h)))
            out.append(ScoredHeading(h, conf, tuple(src)))
    kept = [s for s in out if s.confidence >= min_confidence]
    relevelled = tree_levels([s.heading for s in kept])
    return [s._replace(heading=h) for s, h in zip(kept, relevelled)]


# ---------------------------------------------------------------- the author's LaTeX


def _key(text: str) -> str:
    """Comparison form of a title. Mathematics keeps the letters and digits a
    PDF prints for it (`$\\mathcal N=2$` -> "N 2", as "N=2" reads)."""
    text = re.sub(r"\$([^$]*)\$", lambda m: re.sub(r"\\[A-Za-z]+", " ", m.group(1)), text)
    text = re.sub(r"^\s*§\s*", "", text)
    return norm_title(text)


def latex_headings(lines: list[Line], tex: list) -> list[ScoredHeading]:
    """The headings of the paper's own LaTeX (`_latex_headings.TexHeading`),
    each found on its PDF page.

    The source is the spine, as a printed contents page is in
    `consensus_headings`: its entries are the author's, in order, at their
    real depth, so none is invented and none is re-levelled. The PDF supplies
    only the PAGE. Each heading is looked for in reading order after the one
    before it, as its whole title, as the first line of a title that wraps, or
    as a run-in heading ("1.2. Motivation. In a recent talk ...") whose line
    goes on into the paragraph. A line set smaller than the body (journal
    classes print section titles in 9pt capitals) counts only when it starts
    with a section number, so body text is never taken. A heading found is near certain
    (`latex`, `body`); one never found keeps the page of the heading before it
    and is flagged (`latex` alone, 0.5), so the section split stays in order.
    """
    if not tex or not lines:
        return []
    floor = body_size(lines) - 0.5
    by_page: dict[int, list[Line]] = defaultdict(list)
    for l in lines:
        by_page[l.page].append(l)
    # A printed contents page lists every title before its section begins.
    toc_pages = set(contents_pages(by_page))
    cands = []
    for l in lines:
        if l.page in toc_pages:
            continue
        number, rest = split_number(l.text.strip())
        if l.size >= floor or l.bold or number:
            cands.append((l.page, _key(rest), number))
    out: list[ScoredHeading] = []
    pos, page = 0, None
    for h in tex:
        want = _key(h.title)
        if not want:
            continue
        hit = None
        for j in range(pos, len(cands)):
            k, number = cands[j][1], cands[j][2]
            if not k:
                continue
            if (similar(k, want) >= 0.85 or (len(k) >= 12 and want.startswith(k))
                    # run-in: the numbered line carries the title, then the text
                    or (number and len(want) >= 4 and k.startswith(want + " "))):
                hit = j
                break
        if hit is not None:
            pos, page = hit + 1, cands[hit][0]
            src, conf = ("latex", "body"), 1.0
        else:
            src, conf = ("latex",), 0.5
        out.append(ScoredHeading(Heading(h.level, h.title, page, h.number), conf, src))
    first = next((s.heading.page for s in out if s.heading.page is not None), 1)
    return [s if s.heading.page is not None else s._replace(heading=s.heading._replace(page=first))
            for s in out]


def latex_found_share(scored: list[ScoredHeading]) -> float:
    """The share of the source's headings the PDF body confirmed."""
    return sum("body" in s.sources for s in scored) / len(scored) if scored else 0.0


# ---------------------------------------------------------------- contents vs body


def contents_alignment(lines: list[Line], limit: int = 50) -> dict | None:
    """Where a printed contents page and the body disagree — drafts drift.

    None when there is no contents page. Otherwise three lists, each capped
    at `limit` with the full count beside it:

    * `listed_not_found` — a contents entry no body line carries: renamed,
      moved or deleted since the contents was set;
    * `found_not_listed` — a NUMBERED body heading, no deeper than the
      contents goes, that the contents omits: added since;
    * `page_mismatch` — found in the body, but more than one page from where
      the contents says, as "title: listed p<n>, found p<m>".

    It reports and never corrects: which side is right is the author's call.
    """
    contents = contents_headings(lines)
    if len(contents) < 5:
        return None
    by_page: dict[int, list[Line]] = defaultdict(list)
    for l in lines:
        by_page[l.page].append(l)
    toc_pages = set(contents_pages(by_page))
    body_heads = font_headings(lines)
    index: dict[str, list[int]] = defaultdict(list)
    for l in lines:
        if l.page not in toc_pages:
            index[norm_title(l.text)].append(l.page)
    for fh in body_heads:
        if fh.page and fh.page not in toc_pages:
            index[norm_title(fh.title)].append(fh.page)

    listed_not_found, page_mismatch = [], []
    for h in contents:
        if not _found_near(h.title, None, index):
            listed_not_found.append(h.title)
        elif h.page is not None and not _found_near(h.title, h.page, index):
            pages = _hits(h.title, index)
            near = min(pages, key=lambda p: abs(p - h.page)) if pages else None
            page_mismatch.append(f"{h.title}: listed p{h.page}" + (f", found p{near}" if near else ""))

    depth = max((h.number.count(".") + 1 for h in contents if h.number), default=0)
    found_not_listed = []
    if depth:
        # A number that recurs is a local enumeration restarting in each
        # block ("1 What it is", "2 Why it matters" under every component
        # of an appendix), not the document's section numbering.
        recurs = Counter(h.number for h in body_heads if h.number)
        for h in body_heads:
            if recurs[h.number] >= 3:
                continue
            # Numeric section numbers only: a lettered line is a list item.
            if not (h.number and re.fullmatch(r"\d+(?:\.\d+)*", h.number)):
                continue
            k = norm_title(h.title)
            wrapped = any(len(k) >= 12 and norm_title(c.title).startswith(k) for c in contents)
            if (h.number.count(".") + 1 <= depth and h.page not in toc_pages and not wrapped
                    and not _match(h._replace(page=None), contents)):
                found_not_listed.append(f"{h.number} {h.title}")

    def capped(xs: list[str]) -> dict:
        return {"count": len(xs), "items": xs[:limit]}

    return {
        "listed_not_found": capped(listed_not_found),
        "found_not_listed": capped(found_not_listed),
        "page_mismatch": capped(page_mismatch),
    }


# ---------------------------------------------------------------- scoring


def similar(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # Length alone bounds the ratio; skip the quadratic comparison when it
    # cannot reach any threshold worth asking about.
    la, lb = len(a), len(b)
    if 2 * min(la, lb) / (la + lb) < 0.7:
        return 0.0
    sm = SequenceMatcher(None, a, b, autojunk=False)
    if sm.quick_ratio() < 0.7:
        return 0.0
    return sm.ratio()
