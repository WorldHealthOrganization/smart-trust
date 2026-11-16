#!/usr/bin/env python3
"""Dry run of `pdf-structure.py`'s outline-heading matcher over a library.

For every `<library>/<doc-id>/` with a PDF whose embedded outline is non-empty,
re-read the PDF exactly as `pdf-structure.py` does (same backend, same soft-
hyphen join, same `_toc_entries` parse) and ask `locate_heading` — the function
`split_sections` itself calls — where each outline entry is printed. An entry
it cannot place is DROPPED: its text is silently folded into the preceding
section.

Writes nothing to the library. Output is one JSON report (stdout or `-o`).

Each dropped entry is classified by what a looser search finds, first hit wins:

* `split-label`     the title only appears when a short label line is joined
                    to the next line (the #134 case; should now be rare)
* `run-in-long`     the line STARTS with the title and is >= 120 chars — a
                    run-in heading the length guard rejects
* `accent-ligature` found only after dropping every non-ASCII-alphanumeric
                    character, and the title or line carries non-ASCII text
* other:
  * `spacing-punct`  found only after dropping whitespace/punctuation, all ASCII
                     ("p=3" in the outline, "p = 3" on the page)
  * `long-midline`   the title is inside a >= 120-char line but not at its start
  * `wrapped-title`  the title spans two consecutive lines
  * `duplicate-line` placed on a line an earlier entry already took
  * `outside-window` found, but not within two pages of the outline's page
  * `not-found`      none of the above

Usage:  heading-match-dryrun.py LIBRARY_DIR [-o report.json] [--only DOC_ID ...]
"""
from __future__ import annotations

import argparse
import glob
import importlib.util
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
_spec = importlib.util.spec_from_file_location("_pdf_structure", os.path.join(HERE, "pdf-structure.py"))
ps = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = ps
_spec.loader.exec_module(ps)  # type: ignore[union-attr]

LABEL_LINE = re.compile(r"[A-Z0-9]{1,3}(\.[A-Z0-9]{1,3})*\.?")


def squash(s: str) -> str:
    """`_match_key` with every non-alphanumeric character removed."""
    return re.sub(r"[\W_]+", "", ps._match_key(s))


def ascii_squash(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", ps._match_key(s))


def classify(pages: list[str], e, used: set) -> tuple[str, dict]:
    needle = ps._match_key(e.title)[:44]
    lo = max(0, (e.page or 1) - 2)
    hi = min(len(pages), (e.page or 1) + 2)
    hit = ps.locate_heading(pages, e)
    if hit is not None and hit in used:
        return "duplicate-line", {"page": hit[0] + 1, "line": pages[hit[0]].splitlines()[hit[1]][:200]}

    sq = squash(e.title)[:40]
    asq = ascii_squash(e.title)[:40]
    window = [(pi, li, line, pages[pi].splitlines())
              for pi in range(lo, hi) for li, line in enumerate(pages[pi].splitlines())]

    def ev(pi, line):
        return {"page": pi + 1, "line": line[:200], "line_len": len(ps._match_key(line))}

    for pi, li, line, lines in window:
        if li + 1 < len(lines) and LABEL_LINE.fullmatch(line.strip()):
            j = ps._match_key(line + " " + lines[li + 1])
            if needle in j:
                return "split-label", ev(pi, line + " | " + lines[li + 1])
    for pi, li, line, lines in window:
        cand = ps._match_key(line)
        if needle in cand and len(cand) >= 120:
            if cand.startswith(needle) or cand.find(needle) <= 6:
                return "run-in-long", ev(pi, line)
    for pi, li, line, lines in window:
        cand = ps._match_key(line)
        if needle in cand and len(cand) >= 120:
            return "long-midline", ev(pi, line)
    if sq:
        for pi, li, line, lines in window:
            if sq in squash(line):
                return "spacing-punct", ev(pi, line)
    if asq and len(asq) >= 4:
        for pi, li, line, lines in window:
            if asq in ascii_squash(line) and (not e.title.isascii() or not line.isascii()):
                return "accent-ligature", ev(pi, line)
    for pi, li, line, lines in window:
        if li + 1 < len(lines):
            j = squash(line + " " + lines[li + 1])
            if sq and sq in j:
                return "wrapped-title", ev(pi, line + " | " + lines[li + 1])
    if needle:
        for pi, p in enumerate(pages):
            if lo <= pi < hi:
                continue
            for line in p.splitlines():
                c = ps._match_key(line)
                if needle in c and len(c) < 120:
                    return "outside-window", ev(pi, line)
    return "not-found", {}


def run_doc(d: str) -> dict | None:
    pdfs = sorted(glob.glob(os.path.join(d, "*.pdf")))
    if not pdfs:
        return None
    path = pdfs[0]
    with ps.library_noise_to_stderr():
        reader = ps.open_backend(path, "auto")
        pages = [ps.join_soft_hyphens(p) for p in reader.page_texts()]
        outline = ps._toc_entries(reader.raw_toc())
    if not outline:
        return {"doc_id": os.path.basename(d), "outline_entries": 0}
    used: set = set()
    dropped = []
    for e in outline:
        hit = ps.locate_heading(pages, e)
        if hit and hit not in used:
            used.add(hit)
            continue
        if not ps._match_key(e.title)[:44]:
            cause, ev = "empty-title", {}
        else:
            cause, ev = classify(pages, e, used)
        dropped.append({"title": e.title, "number": e.number, "level": e.level,
                        "page": e.page, "cause": cause, "evidence": ev})
    return {"doc_id": os.path.basename(d), "outline_entries": len(outline),
            "dropped": dropped}


GROUP = {"split-label": "split-label", "run-in-long": "run-in-long",
         "accent-ligature": "accent-ligature"}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("library")
    ap.add_argument("-o", "--out")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--label", default="", help="free-text label recorded in the report")
    a = ap.parse_args()
    dirs = sorted(x for x in glob.glob(os.path.join(a.library, "*")) if os.path.isdir(x))
    if a.only:
        dirs = [x for x in dirs if os.path.basename(x) in a.only]
    docs, errors = [], []
    t0 = time.time()
    for i, d in enumerate(dirs):
        try:
            r = run_doc(d)
        except Exception as exc:  # a broken PDF is reported, not fatal
            errors.append({"doc_id": os.path.basename(d), "error": f"{type(exc).__name__}: {exc}"})
            continue
        if r is not None:
            docs.append(r)
        if (i + 1) % 25 == 0:
            print(f"[{i+1}/{len(dirs)}] {time.time()-t0:.0f}s", file=sys.stderr, flush=True)
    with_outline = [r for r in docs if r["outline_entries"]]
    dropping = [r for r in with_outline if r["dropped"]]
    causes: dict[str, int] = {}
    groups: dict[str, int] = {}
    for r in dropping:
        for x in r["dropped"]:
            causes[x["cause"]] = causes.get(x["cause"], 0) + 1
            g = GROUP.get(x["cause"], "other")
            groups[g] = groups.get(g, 0) + 1
    report = {
        "_schema": "heading-match-dryrun/v1",
        "label": a.label,
        "library": os.path.abspath(a.library),
        "summary": {
            "directories": len(dirs),
            "with_pdf": len(docs),
            "with_outline": len(with_outline),
            "outline_entries": sum(r["outline_entries"] for r in with_outline),
            "docs_dropping": len(dropping),
            "entries_dropped": sum(len(r["dropped"]) for r in dropping),
            "by_group": dict(sorted(groups.items())),
            "by_cause": dict(sorted(causes.items())),
            "errors": len(errors),
        },
        "documents": sorted(dropping, key=lambda r: -len(r["dropped"])),
        "errors": errors,
    }
    out = json.dumps(report, indent=1, ensure_ascii=False)
    if a.out:
        with open(a.out, "w") as fh:
            fh.write(out + "\n")
    else:
        print(out)
    print(json.dumps(report["summary"], indent=1), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
