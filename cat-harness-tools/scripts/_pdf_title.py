"""A document's title, from the sources that can vouch for it — or none.

Bean `w6fu`, owner's ruling 2026-10-02 on issue #1838: improve the title the
ingest path extracts, using the PDF's own ``Title`` metadata, the first page's
largest-font heading and the document's outline BEFORE the raw text walk, and
**never guess** — when no source is trustworthy, keep the raw title and mark it
unverified.

## Why corroboration, and not a ranking

Every source is wrong some of the time. Measured over this repository's own
library on 2026-10-02 (60 entries, 46 with a source PDF to read):

- ``Title`` metadata is often right ("PROV-O: The PROV Ontology", where the
  text walk ran on into "This version: … Editors:") and often not: a
  production label ("Microsoft Word - gurel_emet.doc", "GRC Handbook - second
  edition"), an arXiv stamp, a file name ("How AI-Mediated RACI Matrix.pdf"),
  or a web page's title with the site appended ("… | RFC Editor").
- The largest type on page 1 is usually the title, and sometimes the arXiv
  stamp in the margin, a journal banner, or a run of title-and-authors set at
  one size.
- An outline's first entry is the title for a document printed from HTML, and
  "Abstract" or "Introduction" for a paper.
- The text walk stops in the wrong place in both directions.

A ranking would take the first source that SAYS something, which is a guess
with an order. So a candidate is taken only when an INDEPENDENT source agrees
with it. The highest-priority corroborated candidate wins. When none is
corroborated, the raw title stands with ``verified: false``, and every
candidate is recorded so an editor can decide from the evidence instead of
extracting it again.

## Three rules the measurement forced

1. **The page attests only the metadata title, and only when a browser did
   not print the PDF.** The heading and outline are read off the page, so the
   page would attest them trivially. A browser prints the HTML ``<title>`` in
   its page header, so for a browser print "printed on page 1" says nothing
   about the metadata title either.
2. **A metadata title is cut back to what the page prints.** When the
   metadata title contains the page's heading and the page does not print the
   longer string, the extra words are unattested. They are always a site name
   ("| Gemini CLI", "\\ Anthropic") or a venue ('… in: Wiley Encyclopedia').
   The title kept is the metadata's own spelling of the printed part, because
   the heading's letters are often glued together ("KeywordsforuseinRFCs").
3. **Agreement ignores spacing.** Text layers drop inter-word spaces and insert
   zero-width ones, so the same title read twice can differ only in its
   spaces.

Pure functions over an evidence dict, so the rule is testable without a PDF.
``evidence_from_pdf`` is the only part that needs PyMuPDF.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any

#: Order of preference among CORROBORATED candidates. The metadata title is the
#: document's own declaration; the heading is what it prints largest; the
#: outline is what it lists first.
SOURCES = ("metadata", "heading", "outline")

#: Words that head a page or a section but never name a document.
GENERIC = {
    "abstract", "introduction", "contents", "table of contents", "front matter",
    "preface", "foreword", "cover", "title page", "untitled", "comment",
    "research", "article", "original article", "research article", "review",
    "editorial", "page 1", "summary", "executive summary", "acknowledgements",
    "acknowledgments", "copyright", "references", "index", "handbook",
}

#: What a production tool writes into ``Title`` instead of a title, and the
#: arXiv margin stamp ("arXiv:0909.4061v2 [math.NA] 14 Dec 2010").
_PRODUCTION = re.compile(
    r"^(microsoft (word|powerpoint|excel)\b|untitled\b|document\d*$|slide \d+$|"
    r"powerpoint presentation$|title$|pdf$|arxiv:\s*\d)"
    r"|\.(pdf|docx?|pptx?|indd|tex|dvi|qxp|odt|rtf|html?)\b",
    re.I,
)

#: A PDF a web browser printed: its header repeats the HTML <title>.
BROWSER_RE = re.compile(r"Chrome|Mozilla|Safari|Firefox|Skia/PDF|wkhtmltopdf|Prince", re.I)

_ZERO_WIDTH = dict.fromkeys(map(ord, "​‌‍⁠﻿­"), None)


def norm(s: str | None) -> str:
    """Lower-cased words only, with a line-broken hyphen rejoined.

    "AUTOFOR- MALIZATION" and "Autoformalization" must compare equal: the first
    is the text walk's reading of a hyphen at a line end, not a different word.
    """
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s).translate(_ZERO_WIDTH)
    s = re.sub(r"(\w)-\s+(\w)", r"\1\2", s)
    s = re.sub(r"[^\w]+", " ", s.lower(), flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip()


def _ns(s: str | None) -> str:
    """{@link norm} with the spaces gone too — see rule 3."""
    return norm(s).replace(" ", "")


def clean(s: str | None) -> str:
    """The candidate as a reader should see it: one line, no padding."""
    if not s:
        return ""
    s = unicodedata.normalize("NFC", s).translate(_ZERO_WIDTH)
    s = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", s)
    return re.sub(r"\s+", " ", s).strip(" \t\r\n.,;:")


def plausible(cand: str | None, slug: str = "") -> bool:
    """Could this string be a title at all? Rejects, never accepts on its own."""
    n = norm(cand)
    if len(n) < 3 or not re.search(r"[^\W\d_]{3,}", n):
        return False
    if n in GENERIC or (slug and _ns(cand) == _ns(slug)):
        return False
    if _PRODUCTION.search(clean(cand).lstrip("([{\"' ")):
        return False
    if len(n) > 200:
        return False
    return True


def _substantial(n_short: str) -> bool:
    """Long enough that containing it is agreement, not shared vocabulary."""
    return len(n_short.split()) >= 2 or len(n_short.replace(" ", "")) >= 12


def contains(longer: str | None, shorter: str | None) -> bool:
    """Does ``longer`` contain ``shorter``, spacing ignored?"""
    nl, ns_ = _ns(longer), _ns(shorter)
    return bool(nl and ns_) and ns_ in nl


def agree(a: str | None, b: str | None) -> bool:
    """Do two sources name the same title?

    Equal once spacing and case are set aside, or one CONTAINS the other where
    the shorter is substantial (two words, or twelve letters when its spaces
    were lost). Containment, because the sources stop in different places: the
    text walk ran "PROV-O: The PROV Ontology" on into the status block, and cut
    "Introduction to the Analysis of Probabilistic" short of "Decision-Making
    Algorithms". Substantial, because one shared word ("Handbook") is a
    coincidence of vocabulary, not agreement about a title.
    """
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return False
    if _ns(a) == _ns(b):
        return True
    short, long_ = (a, b) if len(_ns(a)) <= len(_ns(b)) else (b, a)
    return _substantial(norm(short)) and contains(long_, short)


def _span(container: str, target: str) -> str | None:
    """The part of ``container`` that spells ``target``, spacing ignored.

    Used to keep the metadata title's own spelling of the words the page
    prints, rather than the heading's, whose spaces are often gone.
    """
    want = _ns(target)
    if not want:
        return None
    # Map each kept (alphanumeric) character of the cleaned container back to
    # its index, then find the run and cut on the original string.
    c = clean(container)
    keep: list[int] = []
    flat = ""
    for i, ch in enumerate(c):
        n = _ns(ch)
        if n:
            keep.extend([i] * len(n))
            flat += n
    at = flat.find(want)
    if at < 0:
        return None
    start, end = keep[at], keep[at + len(want) - 1] + 1
    return c[start:end].strip(" .,;:|\\-—–\"'")


def resolve(evidence: dict[str, Any], raw: str | None, slug: str = "") -> dict[str, Any]:
    """Choose a title from ``evidence``, or keep ``raw`` and say it is unverified.

    ``evidence`` carries any of ``metadata``, ``heading``, ``outline`` (strings
    or None), ``page_text`` (the first pages' text) and ``browser`` (true when
    a web browser printed the PDF). ``raw`` is the text walk's title, or None
    when the rung has none.

    Returns ``title``, ``source`` (one of SOURCES, ``"text"`` or
    ``"filename"``), ``verified``, ``corroborated_by`` and ``candidates``.
    """
    cands = {k: clean(evidence.get(k)) or None for k in SOURCES}
    raw_c = clean(raw) or None
    page = evidence.get("page_text") or ""
    page_ok = bool(page) and not evidence.get("browser")
    record = {**cands, "text": raw_c}

    def witnesses(src: str) -> list[str]:
        mine = cands[src]
        # A WITNESS is not checked against the slug. The slug rule stops a
        # file name being taken for a title; a browser's "Save as PDF" names
        # the file after the page's <title>, so the metadata title of every
        # browser print equals its slug -- and is still a source independent
        # of the heading printed on the page. Measured 2026-10-02: two entries
        # whose heading the metadata corroborates were left unverified by it.
        out = [k for k in SOURCES if k != src and plausible(cands[k]) and agree(mine, cands[k])]
        if raw_c and plausible(raw_c) and agree(mine, raw_c):
            out.append("text")
        if src == "metadata" and page_ok and _substantial(norm(mine)) and contains(page, mine):
            out.append("page")
        return out

    for src in SOURCES:
        c = cands[src]
        if not plausible(c, slug):
            continue
        w = witnesses(src)
        if not w:
            continue
        title = c
        # Rule 2: the metadata title runs past what the page prints.
        if src == "metadata" and "page" not in w:
            printed = [cands[k] for k in ("heading", "outline") if k in w and cands[k]]
            shorter = [p for p in printed if len(_ns(p)) < len(_ns(c)) and contains(c, p)]
            if shorter:
                title = _span(c, max(shorter, key=lambda p: len(_ns(p)))) or title
        # Rule 3, the other way round: a heading or outline chosen on its own
        # merit keeps the spelling of a witness that carries its spaces. The
        # metadata title is TYPED text, not read off a layout, so its spelling
        # of the same letters always wins ("Skill a ut h or i n g be st" is how
        # one heading's letter-spaced type comes out). The text walk's is a
        # layout reading too, so it wins only where it restores lost spaces.
        if src != "metadata":
            meta = cands.get("metadata")
            if meta and contains(meta, c) and _span(meta, c):
                title = _span(meta, c) or title
            elif raw_c and contains(raw_c, c) and len(norm(c).split()) < len(norm(_span(raw_c, c) or "").split()):
                title = _span(raw_c, c) or title
        return {"title": title, "source": src, "verified": True, "corroborated_by": w,
                "candidates": record}

    return {
        "title": raw_c or slug or None,
        "source": "text" if raw_c else "filename",
        "verified": False,
        "corroborated_by": [],
        "candidates": record,
    }


# ── Evidence, from the PDF itself ────────────────────────────────────────────

def _heading(page: Any) -> str | None:
    """The first page's largest HORIZONTAL type, in reading order.

    Every line whose largest span is within 10% of the page's largest size, so
    a title set over three lines is read as one. Horizontal only: the arXiv
    stamp runs up the margin in the biggest type on the page. A line must carry
    a word, so a giant page number or an ornament cannot win.
    """
    try:
        d = page.get_text("dict")
    except Exception:
        return None
    lines: list[tuple[float, float, float, str]] = []
    for b in d.get("blocks", []):
        for ln in b.get("lines", []):
            direction = ln.get("dir", (1.0, 0.0))
            if abs(direction[0]) < 0.99:
                continue
            spans = [s for s in ln.get("spans", []) if s.get("text", "").strip()]
            if not spans:
                continue
            text = " ".join(s["text"].strip() for s in spans).strip()
            if not re.search(r"[^\W\d_]{2,}", text):
                continue
            size = max(float(s.get("size", 0)) for s in spans)
            lines.append((size, ln["bbox"][1], ln["bbox"][0], text))
    if not lines:
        return None
    top = max(l[0] for l in lines)
    picked = sorted((l for l in lines if l[0] >= top * 0.9), key=lambda l: (l[1], l[2]))
    out = ""
    for _, _, _, t in picked:
        if out.endswith("-") and t[:1].islower():
            out = out[:-1] + t
        else:
            out = (out + " " + t).strip()
    return out[:300] or None


def _outline_first(doc: Any) -> str | None:
    try:
        toc = doc.get_toc(simple=True)
    except Exception:
        return None
    for level, title, _page in toc:
        if level == 1 and str(title).strip():
            return str(title).strip()
    return None


def evidence_from_pdf(path: str, pages: int = 2) -> dict[str, Any]:
    """Read the three sources and the first pages' text out of a PDF."""
    # `pymupdf`, the name the sibling scripts import and the declaration
    # (`python-deps`) lists; the legacy `fitz` alias is not declared.
    import pymupdf

    doc = pymupdf.open(path)
    try:
        md = doc.metadata or {}
        first = doc[0] if doc.page_count else None
        text = "\n".join(doc[i].get_text() for i in range(min(pages, doc.page_count)))
        return {
            "metadata": (md.get("title") or "").strip() or None,
            "heading": _heading(first) if first is not None else None,
            "outline": _outline_first(doc),
            "page_text": text,
            "docinfo": _docinfo(md),
            "browser": bool(BROWSER_RE.search(f"{md.get('creator') or ''} {md.get('producer') or ''}")),
        }
    finally:
        doc.close()


def summary(result: dict[str, Any], evidence: dict[str, Any]) -> dict[str, Any]:
    """The fields a rung writes into ``structure.json``'s ``metadata``."""
    return {
        "title_source": result["source"],
        "title_verified": result["verified"],
        "title_evidence": {
            **{k: v for k, v in result["candidates"].items() if v},
            "corroborated_by": result["corroborated_by"],
            "browser_print": bool(evidence.get("browser")),
        },
    }


def apply(metadata: dict[str, Any] | None, evidence: dict[str, Any], slug: str) -> dict[str, Any]:
    """``structure.json``'s ``metadata``, with the title resolved.

    Idempotent. The text walk's title is kept as ``title_raw`` the first time
    and read back from there afterwards, so a second run resolves from the
    same raw title rather than from its own previous answer. ``title`` is the
    resolved title when one is corroborated and the raw title otherwise —
    which is None for a page-granularity entry, whose rung has no text walk,
    and the manifest then falls back to the entry id exactly as before.

    Never touches ``title_correction``: that is an editor's record, not an
    extraction, and it outranks everything here (bean `w6fu`, step b).
    """
    md = dict(metadata or {})
    raw = md["title_raw"] if "title_raw" in md else md.get("title")
    res = resolve(evidence, raw, slug)
    md["title"] = res["title"] if res["verified"] else (clean(raw) or None)
    md["title_raw"] = raw
    if not isinstance(md.get("docinfo"), dict):
        md["docinfo"] = evidence.get("docinfo") or {}
    md.update(summary(res, evidence))
    return md


def _docinfo(md: dict[str, Any]) -> dict[str, str]:
    """PyMuPDF's metadata under the DocInfo key names pdf-structure.py writes."""
    keys = {"title": "Title", "author": "Author", "producer": "Producer",
            "creator": "Creator", "creationDate": "CreationDate"}
    return {out: str(md[k]) for k, out in keys.items() if md.get(k)}


def refresh(structure_path: str, pdf: str | None) -> dict[str, Any]:
    """Re-resolve one entry's title in place; ``pdf`` may be None.

    Without the source PDF the evidence is what the entry already recorded —
    its ``docinfo`` Title and its outline — so an entry whose upload is gone
    still benefits wherever those two corroborate its raw title. The file's
    indent is read off it, never chosen: the two rungs write different ones,
    and a title refresh is not a licence to reformat a file it did not write.
    """
    import json

    with open(structure_path, encoding="utf-8") as fh:
        text = fh.read()
    ind = next((len(l) - len(l.lstrip(" ")) for l in text.split("\n")[1:] if l.startswith(" ")), 2)
    doc = json.loads(text)
    before = (doc.get("metadata") or {}).get("title")
    if pdf:
        ev = evidence_from_pdf(pdf)
    else:
        info = (doc.get("metadata") or {}).get("docinfo") or {}
        toc = doc.get("toc") or []
        first = next((t.get("title") for t in toc if isinstance(t, dict) and t.get("level") == 1), None)
        # A heading read from the PDF on an earlier run is kept: it was read
        # off the document, and losing it because the upload has since gone
        # would make a refresh without the PDF undo one made with it.
        seen = (doc.get("metadata") or {}).get("title_evidence") or {}
        ev = {"metadata": info.get("Title"), "outline": first, "heading": seen.get("heading"),
              "browser": bool(BROWSER_RE.search(f"{info.get('Creator') or ''} {info.get('Producer') or ''}"))}
    doc["metadata"] = apply(doc.get("metadata"), ev, doc.get("doc_id") or "")
    with open(structure_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(doc, indent=ind, ensure_ascii=False) + ("\n" if text.endswith("\n") else ""))
    m = doc["metadata"]
    return {"doc_id": doc.get("doc_id"), "before": before, "after": m.get("title"),
            "source": m.get("title_source"), "verified": m.get("title_verified"), "pdf": bool(pdf)}


if __name__ == "__main__":
    import json
    import sys

    args = sys.argv[1:]
    if args and args[0] == "--refresh":
        print(json.dumps(refresh(args[1], args[2] if len(args) > 2 and args[2] else None), ensure_ascii=False))
        sys.exit(0)
    path = args[0]
    raw = args[1] if len(args) > 1 and args[1] else None
    slug = args[2] if len(args) > 2 else ""
    ev = evidence_from_pdf(path)
    res = resolve(ev, raw, slug)
    print(json.dumps({"title": res["title"], **summary(res, ev)}, ensure_ascii=False))
