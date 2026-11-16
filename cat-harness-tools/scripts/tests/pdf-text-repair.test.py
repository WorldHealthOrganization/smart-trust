#!/usr/bin/env python3
"""
Regression test for `pdf-structure.py`'s text repair.

PDF text extraction damages words in ways that look cosmetic and are not:
the damaged form is what lands in `structure.json`'s title, in the library
index brief, and in the section text that corpus-grep runs over. A search
for "Garoufalidis" does not match "GAROUF ALIDIS".

Every case below is real damage taken from the qou library, and each one
broke a *previous* version of the repair — which is the reason this file
exists rather than a one-off check:

  * pairwise joining could not fix "J ÉR ÔME", because the intermediate
    "JÉR" is not a word and so is never attested;
  * whole-concatenation lookup could not fix "GR ÖBNER-SHIRSHOV", because
    the word formed at the seam is "GRÖBNER", not "GRÖBNERSHIRSHOV";
  * first-seam-only lookup swallowed an entire title into one token, on a
    run whose first seam happened to be a real join.

Known limitation, with the measurement that closes it: when the damage sits
in a *running head* it repeats once per page, so the fragments outnumber the
word they came from and the frequency gate rejects a correct join. Four
titles in the qou library are affected ("TURAEV-VIRO INV ARIANTS" x3,
"A SUR VEY OF TWISTED ALEXANDER POLYNOMIALS").

Discounting occurrences *inside* the pair — comparing against how often each
fragment stands alone — repairs all four, and cannot be adopted, because the
two shapes are numerically identical and want opposite answers:

    arxiv-1004.1533v3   "inv ariants" 54   "invariants" 18   -> welded is right
    aif-2009-59-1-347-0 "institut fourier" 63  "institutfourier" 18
                                                          -> spaced is right

Same majority-spaced / minority-welded shape, opposite correct answers, so no
statistic over these counts separates them. What does separate them is that
"fourier" is a word and "ariants" is not — which needs either a dictionary or
a cross-document vocabulary, and this producer takes one PDF and consults
only that PDF. The four titles are therefore corrected downstream in
`docs/audits/library-title-overrides.json` (qou), where a human verdict is
the recorded mechanism, rather than guessed at here.

Run: python3 scripts/tests/pdf-text-repair.test.py

Standalone by design — it loads the two functions out of the script's
source rather than importing it, so it runs in environments where pypdf
is unavailable.
"""

from __future__ import annotations

import os
import re
import sys
import unicodedata
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(HERE), "pdf-structure.py")


def load():
    src = open(SCRIPT, encoding="utf-8").read()
    start = src.index("LIGATURES = str.maketrans")
    end = src.index("# ------------------------------------------------"
                    "---------------- structures")
    ns: dict = {"re": re, "unicodedata": unicodedata, "Counter": Counter}
    exec(src[start:end], ns)
    return ns["repair_text"], ns["rejoin_caps"]


# Stands in for the document body the real code harvests its vocabulary
# from. The gate is attestation *in this document*, so a join is only
# made when the joined form genuinely occurs elsewhere in the same paper.
BODY = """
stavros garoufalidis rinat kashaev volume mathematical transactions coxeter
non-crystallographic groups gröbner shirshov jérôme dubois vu huynh yoshikazu
yamaguchi invariant refined categorified three manifolds physics topology
algebras bases for non abelian reidemeister torsion twist knots
basesfor institutfourier
institut fourier institut fourier institut fourier corps valué hauteur soit
bases for bases for bases for bases for the bases for
crystallographic crystallographic crystallographic crystallographic
cryst allographic
hyperbolic hyperbolic hyperbolic manifolds manifolds manifolds bloch group
"""
# The repeated words above are deliberate, and so are the odd ones.
# `basesfor`, `institutfourier` and the lone `cryst allographic` are damage
# artefacts the real documents carried in their own bodies — mere presence
# therefore attests them, which is why the gate counts occurrences instead.
# A real word outnumbers the fragments it was broken into
# (`crystallographic` 4 vs `cryst` 1); an artefact is outnumbered by the
# real words it welded (`basesfor` 1 vs `for` 5).

CASES = [
    # (damaged, expected, what it exercises)
    ("STA VROS GAROUF ALIDIS AND RINAT KASHAEV",
     "STAVROS GAROUFALIDIS AND RINAT KASHAEV",
     "all-caps kerning split, two independent joins in one line"),
    ("V olume 00, Number 0",
     "Volume 00, Number 0",
     "single capital split from a lower-case remainder"),
    ("Volume Conjecture: Reﬁned and Categoriﬁed",
     "Volume Conjecture: Refined and Categorified",
     "fi ligature"),
    ("Gr¨ obner-Shirshov bases for categories",
     "Gröbner-Shirshov bases for categories",
     "floating umlaut before its letter"),
    ("J ´ER ˆOME DUBOIS, VU HUYNH, AND YOSHIKAZU Y AMAGUCHI",
     "JÉRÔME DUBOIS, VU HUYNH, AND YOSHIKAZU YAMAGUCHI",
     "three-fragment name; no intermediate fragment is a word"),
    ("GR ¨OBNER-SHIRSHOV BASES FOR NON-CRYST ALLOGRAPHIC COXETER GROUPS",
     "GRÖBNER-SHIRSHOV BASES FOR NON-CRYSTALLOGRAPHIC COXETER GROUPS",
     "joins across a hyphen; word at the seam, not the concatenation"),
    # Negatives — these must be left exactly alone.
    ("NON–ABELIAN REIDEMEISTER TORSION FOR TWIST KNOTS",
     "NON–ABELIAN REIDEMEISTER TORSION FOR TWIST KNOTS",
     "an undamaged all-caps title survives untouched"),
    ("ON THE NUMBER OF THREE MANIFOLDS",
     "ON THE NUMBER OF THREE MANIFOLDS",
     "adjacent real words are not welded together"),
    ("MATHEMATICAL PHYSICS AND TOPOLOGY",
     "MATHEMATICAL PHYSICS AND TOPOLOGY",
     "long real words are not welded together"),
    ("COXETER GROUPS AND ALGEBRAS",
     "COXETER GROUPS AND ALGEBRAS",
     "every token attested individually, none jointly"),
    ("mixed Case Text unaffected",
     "mixed Case Text unaffected",
     "mixed-case text is out of scope for the caps rejoin"),
    ("GRÖBNER-SHIRSHOV BASES FOR NON-CRYSTALLOGRAPHIC COXETER GROUPS",
     "GRÖBNER-SHIRSHOV BASES FOR NON-CRYSTALLOGRAPHIC COXETER GROUPS",
     "two real words are not welded even when the document attests the "
     "welded form as its own damage artefact"),
    ("L\u2019INSTITUT FOURIER",
     "L\u2019INSTITUT FOURIER",
     "an apostrophe must not hide a real word from the seam guard: "
     "\"L\u2019INSTITUT\" is not a word but \"INSTITUT\" is"),
    ("Soit K un corps val\u00e9 de hauteur",
     "Soit K un corps val\u00e9 de hauteur",
     "a lone symbol before a word is not a kerning split: ungated, the "
     "split-capital rule turned \"K un\" into \"Kun\""),
    ("HYPERBOLIC 3-MANIFOLDS, THE BLOCH GROUP",
     "HYPERBOLIC 3-MANIFOLDS, THE BLOCH GROUP",
     "a join must create a word: a fragment ending in a non-letter seams "
     "on itself, so every frequency test compares a word with itself and "
     "passes - which welded HYPERBOLIC to 3-MANIFOLDS"),
    ("NON-CRYST ALLOGRAPHIC COXETER GROUPS AND BASES",
     "NON-CRYSTALLOGRAPHIC COXETER GROUPS AND BASES",
     "a real word still wins when the document attests BOTH fragments too: "
     "the same damaged header repeats on every page, so presence alone "
     "cannot separate them and frequency has to"),
]


def main() -> int:
    repair_text, rejoin_caps = load()
    vocab = Counter(w.lower() for w in re.findall(r"[^\W\d_]{3,}", repair_text(BODY)))
    failed = 0
    for damaged, expected, what in CASES:
        got = rejoin_caps(repair_text(damaged), vocab)
        if got == expected:
            print(f"  ok   {what}")
        else:
            failed += 1
            print(f"  FAIL {what}")
            print(f"         in:   {damaged}")
            print(f"         got:  {got}")
            print(f"         want: {expected}")
    print(f"\n  {len(CASES) - failed}/{len(CASES)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
