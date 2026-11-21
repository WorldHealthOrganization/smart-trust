#!/usr/bin/env python3
"""Join one side's CI cone records into the one file the next run restores.

Usage: merge-cone.py <results-dir> <side> <shards> <out-file> <sha>

cat-harness-tools#398, bean `4rbc`. On a push to the caller's main, every
shard of the base side runs `run-gates.py` with `GATE_CONE=record`, and writes
`cone-records.json` beside its `gates.json`: the ci-cone.ts records of the
gates in ITS slice (the ones it traced, and the ones whose record still
matched). This writes their union as ci-cone.ts's `records.json` shape,
`{version, recipe, sha, checks}`, with `sha` the main commit of this run.

A missing or unreadable shard file is left out with a warning. That is safe:
a gate with no record is a gate that runs (fail-closed), so a partial file can
only skip less. Exits 2, writing nothing, when the shards disagree on the
tracer or recipe version, or two shards hold a record for the same script:
one of them would then be a record its own run did not make.
"""
import json
import os
import sys


class Undetermined(Exception):
    pass


def merge(results_dir, side, shards):
    version = recipe = None
    checks, owner = {}, {}
    for i in range(1, shards + 1):
        path = os.path.join(results_dir, f"results-{side}-{i}", "cone-records.json")
        try:
            with open(path) as f:
                got = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"::warning::{path} is absent or unreadable ({e.__class__.__name__}): shard {i}'s gates have no record, so they run")
            continue
        if not isinstance(got, dict) or not isinstance(got.get("checks"), dict):
            print(f"::warning::{path} holds no records: shard {i}'s gates have no record, so they run")
            continue
        if not got["checks"]:
            continue
        if version is None:
            version, recipe = got.get("version"), got.get("recipe")
        elif (got.get("version"), got.get("recipe")) != (version, recipe):
            raise Undetermined(f"shard {i} recorded with tracer {got.get('version')} / recipe {got.get('recipe')}, another with {version} / {recipe}")
        for script, rec in got["checks"].items():
            if script in owner:
                raise Undetermined(f"{script} is recorded by shards {owner[script]} and {i}")
            owner[script] = i
            checks[script] = rec
    return version, recipe, checks


def main():
    results_dir, side, shards, out, sha = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
    try:
        version, recipe, checks = merge(results_dir, side, shards)
    except Undetermined as e:
        print(f"::error::cone records: {e}; nothing is kept, so the next run decides nothing from them")
        sys.exit(2)
    if version is None:
        print("cone records: no shard recorded anything; nothing is kept")
        return
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w") as f:
        json.dump({"version": version, "recipe": recipe, "sha": sha, "checks": checks}, f, indent=1)
        f.write("\n")
    print(f"cone records: {len(checks)} gate(s) recorded or carried at {sha}")


if __name__ == "__main__":
    main()
