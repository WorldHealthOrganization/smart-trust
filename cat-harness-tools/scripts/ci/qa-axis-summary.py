#!/usr/bin/env python3
"""Summarise one QA axis's failing criteria, reading `qa-sweep --json` on stdin.

Extracted from `.github/workflows/qa-sweep.yml`, where it lived as a
multi-line `python3 -c "…"` argument inside a YAML block scalar inside a shell
double-quoted string. Its lines sat at column 0, which is *less* than the block
scalar's base indentation, so YAML ended the scalar there and the workflow file
stopped parsing. GitHub cannot read the `on:` triggers of a file it cannot
parse, so it registered a startup failure against every push instead — a run
with zero jobs, named after the file path rather than the workflow's `name:`.

Three layers of quoting over indentation-significant code is not worth the
saving. A file has no base indentation to conflict with, runs outside CI, and
fails at the point of the mistake.
"""

import collections
import json
import sys

# The shape is OWNED by `pipeline/qa-sweep.ts` (its `if (args.json)` block):
# `criteria` is the list of criteria the sweep ran, and `results[].details[]`
# carries one `{criterion, outcome}` per criterion per block. This script
# follows it and owns nothing (bean `cat-tools-5jij`).
#
# It read `want_criteria` and `blocks`, which are `qa-staleness.ts`'s keys,
# through `.get(..., [])` defaults. The sweep emits neither, so every axis
# printed "criteria run: 0" and "(no failing criteria)" while the same run's
# full sweep reported a critical finding. A missing key is therefore an
# error here, never a default that reads as zero.


class ShapeError(Exception):
    """The input is JSON but not the shape `qa-sweep --json` emits."""


def _list(obj: object, key: str, where: str) -> list:
    if not isinstance(obj, dict) or key not in obj:
        raise ShapeError(f"{where} has no `{key}` key")
    value = obj[key]
    if not isinstance(value, list):
        raise ShapeError(f"{where}.{key} is {type(value).__name__}, not a list")
    return value


def summarise(data: object) -> tuple[int, collections.Counter]:
    """The number of criteria run, and failing blocks per criterion."""
    criteria = _list(data, "criteria", "the sweep JSON")
    counts: collections.Counter = collections.Counter()
    for i, result in enumerate(_list(data, "results", "the sweep JSON")):
        for j, detail in enumerate(_list(result, "details", f"results[{i}]")):
            if not isinstance(detail, dict) or "criterion" not in detail or "outcome" not in detail:
                raise ShapeError(f"results[{i}].details[{j}] lacks `criterion` or `outcome`")
            if detail["outcome"] == "fail":
                counts[detail["criterion"]] += 1
    return len(criteria), counts


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        # The sweep is invoked with `2>/dev/null`, so a crash upstream arrives
        # here as empty stdin. Say which it was rather than dying on a
        # traceback that reads like a bug in this script.
        print(f"no parseable sweep JSON on stdin ({exc})", file=sys.stderr)
        return 1
    try:
        n_criteria, counts = summarise(data)
    except ShapeError as exc:
        print(f"not the shape `qa-sweep --json` emits: {exc}", file=sys.stderr)
        return 1

    print(f"criteria run: {n_criteria}")
    if not counts:
        print("  (no failing criteria)")
    for criterion, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"  {n:4d} {criterion}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
