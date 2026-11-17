#!/usr/bin/env python3
"""
Regression test for `pdf-structure.py`'s page-1 front-matter parse.

`parse_front_matter` decides where a document's title starts, and it had no
test at all — which is how a rule meant for one layout came to eat the title
of the commonest layout there is.

The hard part is not finding the title, it is knowing where the publisher's
furniture stops. Furniture appears *above* the title (an arXiv stamp, a
journal banner), *below* it (a DOI URL under the byline, a rotated margin
stamp pypdf emits last), and interleaved with it. So the scan skips a
contiguous run and stops at the first line that is not furniture — with one
exception, for a bare journal name that carries no volume or year and is
unrecognisable on its own, sitting *inside* a run.

That exception is the delicate part, and both failure directions are here:
too narrow and a journal name is taken as the title, too wide and the real
title is skipped for a date printed two lines under it.

Run: python3 scripts/tests/pdf-front-matter.test.py

Standalone by design, like `pdf-text-repair.test.py`: it execs the relevant
slice of the script rather than importing it, because the script exits when
pypdf is missing and these functions do not need pypdf.
"""

from __future__ import annotations

import os
import re
import sys
import types
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(HERE), "pdf-structure.py")


def load():
    src = open(SCRIPT, encoding="utf-8").read()
    start = src.index("# ------------------------------------------------"
                      "---------------- patterns")
    end = src.index("def split_sections(")
    name = "pdf_structure_slice"
    ns: dict[str, Any] = {
        "__name__": name, "re": re, "unicodedata": unicodedata,
        "Counter": Counter, "Any": Any, "os": os, "sys": sys,
        "dataclass": dataclass, "field": field,
    }
    # `@dataclass` resolves its module through sys.modules, so the slice
    # needs a module object to live in or the decorator raises.
    mod = types.ModuleType(name)
    mod.__dict__.update(ns)
    sys.modules[name] = mod
    exec(compile(src[start:end], SCRIPT, "exec"), mod.__dict__)
    return mod.parse_front_matter


# Each page is real page-1 text from the qou library, trimmed to the lines
# that decide the outcome.
CASES = [
    (
        "arXiv stamp, then title, byline and a date under it",
        # The bug: line 3 is furniture, so the look-ahead skipped line 1 for
        # it, then line 2 for the same line, and `start` landed on the
        # abstract. Title and authors were both lost — arxiv-hep-th-9310164v2.
        """arXiv:hep-th/9310164v2  22 Jul 1998
SPHERICAL CA TEGORIES
John W. Barrett & Bruce W. Westbury
10 August 1993; revised 22 July 1998
Abstract. This paper is a study of monoidal categories with duals.
spherical categories spherical categories spherical categories""",
        "SPHERICAL CATEGORIES",
        "John W. Barrett & Bruce W. Westbury",
    ),
    (
        "a bare journal name INSIDE a furniture run is still skipped",
        # The case the look-ahead exists for: "Algebraic & Geometric
        # Topology" carries no volume or year, so it is unrecognisable
        # alone — but the run continues under it. agt-v3-n1-p17-p.
        """ISSN 1472-2739 (on-line) 1472-2747 (printed)
Algebraic & Geometric Topology
ATG
Volume 3 (2003) 537-556
Published: 16 June 2003
Skein-theoretical derivation of some formulas of Habiro
Abstract. We use skein theory.""",
        "Skein-theoretical derivation of some formulas of Habiro",
        None,
    ),
    (
        "a journal banner carrying its own volume is furniture on its own",
        # arxiv-1206.6004v2. The banner names the journal AND the volume, so
        # it is recognisable without the look-ahead; the title spans two
        # lines and the byline ends the run.
        """Symmetry, Integrability and Geometry: Methods and Applications SIGMA 8 (2012), 065, 20 pages
Bring’s Curve: its Period Matrix
and the Vector of Riemann Constants ⋆
Harry W. BRADEN and Timothy P. NORTHOVER
School of Mathematics, Edinburgh University, Edinburgh, Scotland, UK""",
        "Bring’s Curve: its Period Matrix and the Vector of Riemann Constants ⋆",
        "Harry W. BRADEN and Timothy P. NORTHOVER",
    ),
    (
        "a title on line 0 is never skipped for furniture below it",
        # `skipped` guards this: nothing above the title was furniture, so
        # the exception cannot fire and a date underneath is harmless.
        """On the geometry of certain moduli spaces
Jane Q. Author and John R. Author
15 March 2011
Abstract. We study moduli.""",
        "On the geometry of certain moduli spaces",
        "Jane Q. Author and John R. Author",
    ),
]


def main() -> int:
    parse = load()
    failed = 0
    for what, page, want_title, want_authors in CASES:
        meta = parse([page])
        got_t, got_a = meta.get("title"), meta.get("authors_raw")
        ok = got_t == want_title and (want_authors is None or got_a == want_authors)
        if ok:
            print(f"  ok   {what}")
        else:
            failed += 1
            print(f"  FAIL {what}")
            print(f"         title  got {got_t!r}")
            print(f"                want {want_title!r}")
            if want_authors is not None:
                print(f"         authors got {got_a!r}")
                print(f"                 want {want_authors!r}")
    print(f"\n  {len(CASES) - failed}/{len(CASES)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
