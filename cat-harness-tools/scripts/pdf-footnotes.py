#!/usr/bin/env python3
"""A PDF's footnotes and the marks that call them, as `footnotes.json` beside the entry.

Owner, 2026-11-11 (who-iris, after card Q-ODD-1 = A): "add to L1 doc schema
errata" and "also foot notes/marks". A footnote was so far only text: the
mark "3" ran into the word it follows ("countries3") and the note itself sat
at the foot of the page section, between two paragraphs of body text. The
Russian eHealth toolkit (10665/75211-rus) keeps 29 such marks, and some of
its notes were left in Spanish (`source-oddities.md`, sum-00): nobody could
point at them.

This arm reads the page LAYOUT (PyMuPDF spans: size, position, the superscript
flag) and writes, per footnote, its mark, its text, the page, the block that
holds the page, and every place in the body that calls it. It does not change
the section text: the blocks stay the source's words, in the order printed.

How a note is found, measured on 10665/75211-rus, 10665/311941 and 10665/331525:

- **Body size** is the span size that carries the most characters.
- **A mark in the text** is a span flagged superscript, or one under
  MARK_SIZE_RATIO of its line's largest size and raised above that line's
  baseline, whose text is 1-3 digits, a letter, or * † ‡ §.
- **A note** is a line in the lower FOOT_ZONE of the page, in a font smaller
  than the body, that begins with a mark (superscript, or a leading token
  followed by a space, full stop or bracket). The lines after it in the same
  small font continue it.
- **Linking**: a mark calls the note with the same mark on the same page, else
  on the next page (a note can be set over). Only a called note is a
  footnote: a small-font line opening with a number is as often a table row,
  a diagram label or a running footer. Uncalled notes and marks with no note
  are both kept and listed (`uncalled_notes`, `unlinked_marks`), never dropped.

An OCR'd page has no fonts, so nothing is read from it and the sidecar says so
(`status: "undetermined"` for those pages). A PDF with no notes writes
`footnotes: []`, a determined answer.

usage: pdf-footnotes.py <entry dir> <pdf>
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter

SCHEMA = "folio-document-footnotes/v1"
FILENAME = "footnotes.json"
MARK = re.compile(r"^\s*(\d{1,3}|[a-z]|[*†‡§]{1,3})\s*$")
LEADING_MARK = re.compile(r"^\s*(\d{1,3}|[*†‡§]{1,3})(?:[\s.)\]]\s*|(?=[^\W\d_]))(\S.*)$")
MARK_SIZE_RATIO = 0.8
FOOT_ZONE = 0.4  # the lower 40% of the page
NOTE_SIZE_RATIO = 0.95


def _lines(page) -> list[dict]:
    out = []
    for b in page.get_text("dict").get("blocks", []):
        for l in b.get("lines", []):
            spans = [s for s in l.get("spans", []) if s.get("text", "").strip()]
            if spans:
                out.append({"spans": spans, "y0": l["bbox"][1], "y1": l["bbox"][3],
                            "size": max(s["size"] for s in spans),
                            "text": "".join(s["text"] for s in l["spans"])})
    out.sort(key=lambda l: (round(l["y0"]), l["spans"][0]["bbox"][0]))
    return out


def body_size(doc) -> float:
    sizes: Counter = Counter()
    for page in doc:
        for l in _lines(page):
            for s in l["spans"]:
                sizes[round(s["size"], 1)] += len(s["text"])
    return sizes.most_common(1)[0][0] if sizes else 0.0


def is_mark_span(span: dict, line: dict) -> bool:
    """A footnote mark: superscript, or small and raised, with a mark's text. Pure."""
    if not MARK.match(span["text"]):
        return False
    if span.get("flags", 0) & 1:
        return True
    small = span["size"] < MARK_SIZE_RATIO * line["size"]
    raised = span["bbox"][3] < line["y1"] - 0.15 * line["size"]
    return small and raised


def note_start(line: dict, body: float) -> tuple[str, str] | None:
    """`(mark, text)` when a foot-zone line opens a note, else None. Pure."""
    if line["size"] >= NOTE_SIZE_RATIO * body:
        return None
    first = line["spans"][0]
    marked = is_mark_span(first, line) or first["size"] < line["size"]
    if MARK.match(first["text"]) and len(line["spans"]) > 1 and marked:
        rest = "".join(s["text"] for s in line["spans"][1:]).strip()
        return (first["text"].strip(), rest) if rest else None
    m = LEADING_MARK.match(line["text"])
    if m and not re.match(r"^\d{1,3}\s*$", line["text"].strip()):
        return m.group(1), m.group(2).strip()
    return None


def page_notes(page, body: float) -> tuple[list[dict], float]:
    """The notes at the foot of one page, and the y where the note zone starts."""
    h = page.rect.height
    lines = _lines(page)
    notes: list[dict] = []
    zone_top = h
    current = None
    for l in lines:
        if l["y0"] < (1 - FOOT_ZONE) * h:
            continue
        start = note_start(l, body)
        if start:
            current = {"mark": start[0], "text": start[1]}
            notes.append(current)
            zone_top = min(zone_top, l["y0"])
        elif current is not None and l["size"] < NOTE_SIZE_RATIO * body and not re.fullmatch(r"\s*\d{1,4}\s*", l["text"]):
            current["text"] = (current["text"] + " " + l["text"].strip()).strip()
        else:
            current = None
    return notes, zone_top


def page_marks(page, zone_top: float) -> list[dict]:
    """The marks in the body of one page, above its note zone, with the words before each."""
    out = []
    for l in _lines(page):
        if l["y0"] >= zone_top:
            break
        before = ""
        for i, s in enumerate(l["spans"]):
            last = before.rstrip()[-1:]
            if i > 0 and last and is_mark_span(s, l) and (last.isalnum() or last in ".,;:)»\"'"):
                out.append({"mark": s["text"].strip(), "context": before.strip()[-60:]})
            before += s["text"]
    return out


def block_for_page(entry: str, page: int) -> str | None:
    """The prose block whose section holds `page`, from the entry's structure.json."""
    try:
        s = json.load(open(os.path.join(entry, "structure.json"), encoding="utf-8"))
    except (OSError, ValueError):
        return None
    slug = os.path.basename(os.path.normpath(entry))
    for sec in s.get("sections", []):
        a, b = sec.get("page_start"), sec.get("page_end")
        if a and b and a <= page <= b:
            sid = sec["id"]
            m = re.match(r"^(sec-\d{3}|page-\d{3})", sid)
            name = f"prose-{m.group(1) if m else sid}"
            if os.path.exists(os.path.join(entry, "blocks", f"{name}.jsonld")):
                return f"library/{slug}/blocks/{name}"
            return None
    return None


def extract(entry: str, pdf: str) -> dict:
    import pymupdf
    doc = pymupdf.open(pdf)
    body = body_size(doc)
    ocr_pages: list[int] = []
    try:
        s = json.load(open(os.path.join(entry, "structure.json"), encoding="utf-8"))
        if s.get("source", {}).get("text_source") == "ocr":
            ocr_pages = list(range(1, len(doc) + 1))
        ocr_pages += [o["page"] for o in s.get("source", {}).get("ocr_pages", [])]
    except (OSError, ValueError):
        pass
    notes: list[dict] = []
    marks: list[dict] = []
    for i, page in enumerate(doc, 1):
        if i in ocr_pages:
            continue
        pn, zone_top = page_notes(page, body)
        for k, n in enumerate(pn):
            notes.append({"id": f"fn-p{i:03d}-{k + 1}", "page": i, "mark": n["mark"], "text": n["text"], "marks": []})
        for m in page_marks(page, zone_top):
            marks.append({"page": i, **m})
    unlinked = []
    for m in marks:
        hit = next((n for n in notes if n["page"] == m["page"] and n["mark"] == m["mark"]), None) \
            or next((n for n in notes if n["page"] == m["page"] + 1 and n["mark"] == m["mark"]), None)
        if hit:
            hit["marks"].append({"page": m["page"], "context": m["context"]})
        else:
            unlinked.append(m)
    for n in notes:
        b = block_for_page(entry, n["page"])
        if b:
            n["block"] = b
    # A small-font line opening with a number is also a table row, a diagram
    # label or a running footer ("2 | Global hepatitis report 2026"): on
    # 10665/311941 159 such lines, none called from the text. So a note is a
    # FOOTNOTE when the text calls it; the rest are kept as candidates.
    called = [n for n in notes if n["marks"]]
    candidates = [{k: v for k, v in n.items() if k != "marks"} for n in notes if not n["marks"]]
    return {
        "$schema": SCHEMA,
        "entry": os.path.basename(os.path.normpath(entry)),
        "status": "undetermined" if ocr_pages and len(ocr_pages) >= len(doc) else "determined",
        **({"pages_unread": sorted(set(ocr_pages))} if ocr_pages else {}),
        "body_size": body,
        "footnotes": called,
        "uncalled_notes": candidates,
        "unlinked_marks": unlinked,
    }


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    entry, pdf = sys.argv[1], sys.argv[2]
    try:
        out = extract(entry, pdf)
    except ImportError:
        print("pdf-footnotes: needs PyMuPDF (pip install pymupdf); no footnotes.json written", file=sys.stderr)
        return 0
    with open(os.path.join(entry, FILENAME), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"  footnotes: {len(out['footnotes'])} called from the text, "
          f"{len(out['uncalled_notes'])} foot-of-page line(s) no mark calls, "
          f"{len(out['unlinked_marks'])} mark(s) with no note found")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
