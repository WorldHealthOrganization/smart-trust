#!/usr/bin/env python3
"""
Soft hyphens (U+00AD) are joined out of page text by both PDF rungs (bean `3spu`).

The WHO guideline Handbook's text layer carried 742 of them, so its sections
read "recommenda­\ntions" — one word as two fragments to every reader.
Real hyphens (U+002D, U+2010) must survive untouched.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _pdf_text import join_soft_hyphens  # noqa: E402

CASES = [
    ("strong recommenda­\ntions", "strong recommendations"),
    ("organi­zation", "organization"),
    ("guide­ \n  lines and more", "guidelines and more"),
    ("well-known and co‐author", "well-known and co‐author"),
    ("", ""),
    ("no soft hyphen here", "no soft hyphen here"),
]

failed = 0
for given, want in CASES:
    got = join_soft_hyphens(given)
    if got != want:
        failed += 1
        print(f"FAIL {given!r}: got {got!r}, want {want!r}")

# Both rungs import the SAME function, so they cannot disagree about a word.
root = Path(__file__).resolve().parent.parent
for rung in ("pdf-structure.py", "pdf-pages.py"):
    src = (root / rung).read_text(encoding="utf-8")
    if "from _pdf_text import join_soft_hyphens" not in src or "join_soft_hyphens(" not in src.split("from _pdf_text import join_soft_hyphens", 1)[1]:
        failed += 1
        print(f"FAIL {rung} does not apply join_soft_hyphens")

print(f"{len(CASES) + 2 - failed}/{len(CASES) + 2} passed")
sys.exit(1 if failed else 0)
