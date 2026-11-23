#!/usr/bin/env python3
"""
pdf-line-map — read a line-numbered review PDF into a page/line map, and
align a `docx-structure/v1` extraction against it. Bean `v26p`, issue #197.

Why
---
A public review sends out a FROZEN, line-numbered PDF, and comments come back
as "section 3.4.5, page 22, lines 618–624". Word computes page and line at
layout time and stores neither in the .docx, so the only place those numbers
exist is the PDF the reviewers read. This script recovers them:

1. **Map.** Every page's text through `pdftotext -layout`. A line that begins
   with a gutter number is a NUMBERED line (body text). Everything else on
   the page (tables, figures, call-out boxes, footnotes, running heads) is
   kept as UNNUMBERED text, because a comment on a table cites its number
   and page instead of a line, and the page is still needed.
2. **Align.** Each item of the .docx extraction is found in the PDF's
   numbered-line stream, in document order, by its letters only (digits and
   punctuation differ between the two: footnote markers, smart quotes,
   list bullets). An item gets `page`, `lineStart`, `lineEnd` and, when it
   crosses a page, `pageEnd`. Tables, images and call-outs carry no line
   numbers in the PDF, so they get a `page` from the unnumbered text, or from
   the item before them, and say which (`method`).

Nothing is dropped. An item that cannot be placed is reported as
`unaligned`, so the map's coverage is a measured number rather than an
assumption (`stats` in the output).

Line numbering in Word restarts per section, page or document. Whichever it
is, (page, line) identifies one line, and that is the key used here.

Output (`pdf-line-map/v1`):
    { "$schema": "pdf-line-map/v1",
      "source": {"file", "sha256", "pages"},
      "pages": { "20": {"printed": "9", "lines": {"31": "services. Since then…"}, "unnumbered": ["…"]} },
      "alignment": [ {"seq": 37, "page": 19, "lineStart": 11, "lineEnd": 12, "method": "numbered"} ],
      "stats": {...} }

Usage:
    python3 pdf-line-map.py <review.pdf> [--docx-structure s.json] [--out map.json]
"""
from __future__ import annotations

import argparse
import bisect
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

SCHEMA = "pdf-line-map/v1"
NUMBERED = re.compile(r"^\s{0,8}(\d{1,4})(?:\s{2,}(\S.*?))?\s*$")
ANCHOR = 48  # letters used to find an item's start and end in the stream


def letters(s: str) -> str:
    return re.sub(r"[^a-z]", "", s.lower())


def page_count(pdf: Path) -> int:
    out = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True, check=True).stdout
    return int(re.search(r"^Pages:\s+(\d+)", out, re.M).group(1))


def read_pages(pdf: Path) -> dict[int, dict]:
    text = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True, check=True).stdout
    pages: dict[int, dict] = {}
    for i, chunk in enumerate(text.split("\f"), start=1):
        lines: dict[int, str] = {}
        unnumbered: list[str] = []
        raw = chunk.split("\n")
        # The last non-empty line of a page is usually the folio (page number);
        # it is not body text.
        non_empty = [k for k, l in enumerate(raw) if l.strip()]
        folio_idx = non_empty[-1] if non_empty and raw[non_empty[-1]].strip().isdigit() else None
        last_no = 0
        for k, l in enumerate(raw):
            if k == folio_idx or not l.strip():
                continue
            m = NUMBERED.match(l)
            if m:
                n = int(m.group(1))
                body = (m.group(2) or "").strip()
                # A bare number is a gutter number whose text sits on another
                # visual row (e.g. beside a box), or a footnote marker. Accept a
                # gutter number only when it continues the page's sequence.
                plausible = last_no == 0 or 0 < n - last_no <= 3
                if plausible and (body or n == last_no + 1):
                    lines[n] = re.sub(r"\s{2,}", " ", body)
                    last_no = n
                    continue
            unnumbered.append(re.sub(r"\s{2,}", " ", l.strip()))
        folio = raw[folio_idx].strip() if folio_idx is not None else None
        pages[i] = {"lines": lines, "unnumbered": unnumbered, "printed": folio}
    return pages


def build_stream(pages: dict[int, dict]):
    """Letters of every numbered line, concatenated, with (page, line) per offset."""
    buf: list[str] = []
    starts: list[int] = []
    keys: list[tuple[int, int]] = []
    pos = 0
    for p in sorted(pages):
        for n in sorted(pages[p]["lines"]):
            l = letters(pages[p]["lines"][n])
            if not l:
                continue
            starts.append(pos)
            keys.append((p, n))
            buf.append(l)
            pos += len(l)
    return "".join(buf), starts, keys


def at(starts: list[int], keys: list[tuple[int, int]], off: int) -> tuple[int, int]:
    return keys[max(0, bisect.bisect_right(starts, off) - 1)]


def find_page_unnumbered(pages: dict[int, dict], probe: str, near: int) -> int | None:
    """The page whose unnumbered text holds `probe`, searching outward from `near`."""
    if len(probe) < 12:
        return None
    for d in range(0, 6):
        for p in (near + d, near - d) if d else (near,):
            if p in pages and probe in letters(" ".join(pages[p]["unnumbered"])):
                return p
    return None


MARKER = 4  # letters a list marker may put before the text on its line: "a)", "iv.", "I."


def find_at_line_start(stream: str, starts: list[int], needle: str, lo: int, hi: int) -> int:
    """First occurrence of `needle` in stream[lo:hi] that begins a numbered line.

    Every paragraph, heading and list starts a new line in the PDF, so a match
    in the middle of a line is a phrase that merely recurs (a heading such as
    "References" is also a word in a hundred sentences). Requiring a line start
    is what keeps short items from being captured downstream.
    """
    i = stream.find(needle, lo, hi)
    while i >= 0:
        ls = starts[max(0, bisect.bisect_right(starts, i) - 1)]
        if i - ls <= MARKER:
            return i
        i = stream.find(needle, i + 1, hi)
    return -1


def align(structure: dict, pages: dict[int, dict]) -> tuple[list[dict], dict]:
    stream, starts, keys = build_stream(pages)
    cursor = 0
    last_page = min(pages) if pages else 1
    out: list[dict] = []
    stats = {"numbered": 0, "numbered-start": 0, "unnumbered-page": 0, "inherited-page": 0, "unaligned": 0}
    for it in structure["items"]:
        seq = it["seq"]
        txt = letters(it.get("text", ""))
        rec: dict = {"seq": seq}
        placed = False
        if txt and len(txt) >= 3:
            head = txt[:ANCHOR]
            # Short items are searched over a few pages only; long ones may be
            # further away (a run of unnumbered tables or figures between).
            span = 12_000 if len(txt) < 40 else 400_000
            i = find_at_line_start(stream, starts, head, cursor, cursor + span)
            if i >= 0:
                tail = txt[-ANCHOR:]
                k = stream.find(tail, i + max(0, len(txt) - len(tail) - 400), i + len(txt) + 4000) if len(txt) > ANCHOR else i
                p0, l0 = at(starts, keys, i)
                if k >= 0:
                    end = (k + len(tail) - 1) if len(txt) > ANCHOR else (i + len(txt) - 1)
                    p1, l1 = at(starts, keys, min(end, len(stream) - 1))
                    rec.update({"page": p0, "lineStart": l0, "lineEnd": l1, "method": "numbered", "_off": (i, end)})
                    if p1 != p0:
                        rec["pageEnd"] = p1
                    cursor = end + 1
                    last_page = p1
                    stats["numbered"] += 1
                else:
                    # The start is certain, the end is not (a table read
                    # column-wise, an item with unnumbered parts): say so.
                    rec.update({"page": p0, "lineStart": l0, "method": "numbered-start"})
                    cursor = i + len(head)
                    last_page = p0
                    stats["numbered-start"] += 1
                placed = True
        if not placed and txt:
            p = find_page_unnumbered(pages, txt[:40], last_page)
            if p is not None:
                rec.update({"page": p, "method": "unnumbered-page"})
                last_page = p
                stats["unnumbered-page"] += 1
                placed = True
        if not placed:
            if not txt:
                rec.update({"page": last_page, "method": "inherited-page"})
                stats["inherited-page"] += 1
            else:
                rec.update({"page": last_page, "method": "unaligned"})
                stats["unaligned"] += 1
        out.append(rec)
    # Pass 2. Word lets text boxes and anchored tables float, so in places the
    # PDF's reading order is not the .docx's (measured on the DPI-H draft:
    # Appendix C's component sheets). An item pass 1 missed is searched for
    # again between the offsets of its aligned neighbours, out of order. It
    # does not move the cursor, and is marked so a reader can tell.
    texts = {it["seq"]: letters(it.get("text", "")) for it in structure["items"]}
    offs = [(r["seq"], r["_off"]) for r in out if "_off" in r]
    seqs = [q for q, _ in offs]
    for r in out:
        if r["method"] not in ("unaligned", "unnumbered-page") or len(texts[r["seq"]]) < 3:
            continue
        txt = texts[r["seq"]]
        k = bisect.bisect_left(seqs, r["seq"])
        near = offs[max(0, k - 25) : k + 25]
        if not near:
            continue
        lo = max(0, min(o[0] for _, o in near) - 3000)
        hi = max(o[1] for _, o in near) + 3000
        i = find_at_line_start(stream, starts, txt[:ANCHOR], lo, hi)
        if i < 0:
            continue
        end = i + len(txt) - 1
        if len(txt) > ANCHOR:
            k2 = stream.find(txt[-ANCHOR:], i, i + len(txt) + 4000)
            if k2 < 0:
                continue
            end = k2 + ANCHOR - 1
        p0, l0 = at(starts, keys, i)
        p1, l1 = at(starts, keys, min(end, len(stream) - 1))
        stats[r["method"]] -= 1
        seq = r["seq"]
        r.clear()
        r.update({"seq": seq})
        r.update({"page": p0, "lineStart": l0, "lineEnd": l1, "method": "numbered-reordered"})
        if p1 != p0:
            r["pageEnd"] = p1
        stats["numbered-reordered"] = stats.get("numbered-reordered", 0) + 1
    # Pass 3. A table is read row by row in the .docx but often column by column
    # in the PDF, so its whole text rarely matches. Its FIRST CELL usually does,
    # and a table is cited by number and page, so the page is what matters.
    by_seq = {it["seq"]: it for it in structure["items"]}
    for r in out:
        it = by_seq[r["seq"]]
        if r["method"] != "unaligned" or it["type"] != "table":
            continue
        cells = [letters(re.sub(r"<[^>]+>|[*_\\]", " ", c)) for row in it.get("rows", []) for c in row]
        probe = next((c for c in cells if len(c) >= 8), "")
        k = bisect.bisect_left(seqs, r["seq"])
        near = offs[max(0, k - 25) : k + 25]
        if probe and near:
            lo = max(0, min(o[0] for _, o in near) - 3000)
            hi = max(o[1] for _, o in near) + 3000
            i = find_at_line_start(stream, starts, probe[:ANCHOR], lo, hi)
            if i >= 0:
                p0, l0 = at(starts, keys, i)
                stats["unaligned"] -= 1
                r.update({"page": p0, "lineStart": l0, "method": "numbered-start"})
                stats["numbered-start"] += 1
                continue
            pg = find_page_unnumbered(pages, probe[:40], r["page"])
            if pg is not None:
                stats["unaligned"] -= 1
                r.update({"page": pg, "method": "unnumbered-page"})
                stats["unnumbered-page"] += 1
                continue
        stats["unaligned"] -= 1
        r["method"] = "inherited-page"
        stats["inherited-page"] += 1
    for r in out:
        r.pop("_off", None)
    stats["items"] = len(out)
    return out, stats


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--docx-structure", type=Path)
    ap.add_argument("--out", type=Path)
    a = ap.parse_args()
    pages = read_pages(a.pdf)
    data: dict = {
        "$schema": SCHEMA,
        "source": {"file": a.pdf.name, "sha256": hashlib.sha256(a.pdf.read_bytes()).hexdigest(), "pages": page_count(a.pdf)},
        # `printed` is the page number printed in the footer, which is what a
        # reviewer reading the PDF is likely to cite; the key is the PDF's own
        # 1-based page index. They differ by the unnumbered front matter.
        "pages": {str(k): {"printed": v["printed"], "lines": {str(n): t for n, t in v["lines"].items()}, "unnumbered": v["unnumbered"]} for k, v in pages.items()},
    }
    if a.docx_structure:
        structure = json.loads(a.docx_structure.read_text(encoding="utf-8"))
        data["alignment"], data["stats"] = align(structure, pages)
        if structure.get("source"):
            data["structureSource"] = structure["source"]
    js = json.dumps(data, ensure_ascii=False, indent=1)
    if a.out:
        a.out.write_text(js + "\n", encoding="utf-8")
        print(f"✓ {a.pdf.name}: {len(pages)} pages, {sum(len(p['lines']) for p in pages.values())} numbered lines"
              + (f"; alignment {data['stats']}" if "stats" in data else ""), file=sys.stderr)
    else:
        print(js)
    return 0


if __name__ == "__main__":
    sys.exit(main())
