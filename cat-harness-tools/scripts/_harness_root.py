"""The cat-harness root this layer serves — the Python twin of
scripts/lib/roots.ts `HARNESS_ROOT` (bean 70lx).

A script that moved here from cat-harness computed "the harness" as
`Path(__file__).resolve().parent.parent`, which now means cat-harness-tools;
it imports `HARNESS_ROOT` from here instead.

Order, as roots.ts: $CAT_HARNESS_ROOT, then the sibling ../cat-harness of this
layer. Either must hold a cat-harness.json naming "cat-harness". Nothing found
raises: a wrong root reads as an empty corpus, never as an error.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

TOOLS_ROOT = Path(__file__).resolve().parent.parent


def _is_harness(d: Path) -> bool:
    try:
        return json.loads((d / "cat-harness.json").read_text(encoding="utf-8")).get("name") == "cat-harness"
    except (OSError, ValueError):
        return False


def harness_root() -> Path:
    env = os.environ.get("CAT_HARNESS_ROOT")
    if env:
        p = Path(env).resolve()
        if _is_harness(p):
            return p
        raise RuntimeError(f"$CAT_HARNESS_ROOT={env} holds no cat-harness.json naming cat-harness")
    sibling = TOOLS_ROOT.parent / "cat-harness"
    if _is_harness(sibling):
        return sibling.resolve()
    raise RuntimeError(f"no cat-harness found: set CAT_HARNESS_ROOT, or place cat-harness beside {TOOLS_ROOT}")


HARNESS_ROOT: Path = harness_root()
