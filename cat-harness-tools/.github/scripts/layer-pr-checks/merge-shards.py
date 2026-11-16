#!/usr/bin/env python3
"""Merge one side's gate shards into the one report the compare step reads.

Usage: merge-shards.py <results-dir> <side> <shards> <out-dir>

`layer-pr-checks.yml` runs each side's gates as <shards> jobs (bean `lpcs`,
step 3), each uploading `results-<side>-<i>` with `gates.json`,
`gates-shard.json` and `junit.xml`. This writes `<out-dir>/gates.json` (the
union of the shards' results) and `<out-dir>/junit.xml` (their test suites
under one root), the shapes `compare-gates.py` and `compare-test-failures.py`
already read.

A missing shard is never a pass. It exits 2 ("could not determine") when:
  - a shard's artefact, or any of its three files, is absent or unreadable;
  - a shard says it is another shard, or of another N;
  - the shards disagree on the size of the whole gate set;
  - two shards ran the same gate, or together they ran fewer gates than the set;
  - a gate a shard says it ran has no exit code in its `gates.json`;
  - a gate a shard says the CI cone skipped as unchanged (`unchanged` in
    `gates-shard.json`, cat-harness-tools#398) has no `unchanged` record sha.
A cone-skipped gate counts toward covering the set: it was asked, and its
answer is "SKIPPED, inputs unchanged since <sha>", never a pass.
Each of those would let a gate the PR breaks go unjudged, which the compare
step would then read as green. Writes the ten slowest gates of the side to
$GITHUB_STEP_SUMMARY when set (bean `lpcs`: the times feed a balanced split).
"""
import json
import os
import sys
import xml.etree.ElementTree as ET


class Undetermined(Exception):
    pass


def load_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        raise Undetermined(f"{path} is absent or unreadable ({e.__class__.__name__})")


def merge(results_dir, side, shards):
    """(gates, junit root) for one side, or raise Undetermined."""
    gates, owner, total, suites, tests = {}, {}, None, [], 0
    for i in range(1, shards + 1):
        d = os.path.join(results_dir, f"results-{side}-{i}")
        if not os.path.isdir(d):
            raise Undetermined(f"the artefact results-{side}-{i} is missing: shard {i}/{shards} of the {side} side did not report")
        meta = load_json(os.path.join(d, "gates-shard.json"))
        if meta.get("shard") != i or meta.get("of") != shards:
            raise Undetermined(f"results-{side}-{i} says it is shard {meta.get('shard')}/{meta.get('of')}, not {i}/{shards}")
        if total is None:
            total = meta.get("total")
        elif meta.get("total") != total:
            raise Undetermined(f"the {side} shards disagree on the gate set: {total} gates, and shard {i} says {meta.get('total')}")
        got = load_json(os.path.join(d, "gates.json"))
        if not isinstance(got, dict):
            raise Undetermined(f"results-{side}-{i}/gates.json is not an object")
        for name in meta.get("ran", []):
            if name in owner:
                raise Undetermined(f"gate {name} ran in shards {owner[name]} and {i} of the {side} side: the slices overlap")
            if "exit" not in got.get(name, {}):
                raise Undetermined(f"shard {i} of the {side} side says it ran {name}, and its gates.json has no exit for it")
            owner[name] = i
        for name in meta.get("unchanged", []):
            if name in owner:
                raise Undetermined(f"gate {name} is claimed by shards {owner[name]} and {i} of the {side} side: the slices overlap")
            if not got.get(name, {}).get("unchanged") or "exit" in got.get(name, {}):
                raise Undetermined(f"shard {i} of the {side} side says the cone skipped {name}, and its gates.json has no unchanged record for it")
            owner[name] = i
        for name, entry in got.items():
            if name in gates:
                raise Undetermined(f"{name} is reported by two {side} shards")
            gates[name] = entry
        path = os.path.join(d, "junit.xml")
        try:
            root = ET.parse(path).getroot()
        except (OSError, ET.ParseError) as e:
            raise Undetermined(f"{path} is absent or unreadable ({e.__class__.__name__})")
        tests += int(root.get("tests", 0) or 0)
        suites.extend(list(root) if root.tag == "testsuites" else [root])
    if not isinstance(total, int) or len(owner) != total:
        raise Undetermined(f"the {side} shards ran or skipped as unchanged {len(owner)} gate(s) of a set of {total}")
    junit = ET.Element("testsuites", {"tests": str(tests)})
    junit.extend(suites)
    return gates, junit


def slowest(gates, n=10):
    timed = [(e["seconds"], k) for k, e in gates.items() if isinstance(e.get("seconds"), (int, float))]
    return sorted(timed, reverse=True)[:n]


def main():
    results_dir, side, shards, out_dir = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    try:
        gates, junit = merge(results_dir, side, shards)
    except Undetermined as e:
        msg = f"{side}: could not determine — {e}. A missing shard is never a pass."
        print(f"::error::{msg}")
        if summary:
            with open(summary, "a") as f:
                f.write(f"**{msg}**\n\n")
        sys.exit(2)
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "gates.json"), "w") as f:
        json.dump(gates, f, indent=1)
    ET.ElementTree(junit).write(os.path.join(out_dir, "junit.xml"), encoding="utf-8", xml_declaration=True)
    rows = slowest(gates)
    lines = [f"### {side}: {shards} shard(s), {len(gates)} result(s); slowest gates", "", "| gate | seconds |", "|---|---|"]
    lines += [f"| `{k}` | {s} |" for s, k in rows]
    text = "\n".join(lines) + "\n"
    print(text)
    if summary:
        with open(summary, "a") as f:
            f.write(text + "\n")


if __name__ == "__main__":
    main()
