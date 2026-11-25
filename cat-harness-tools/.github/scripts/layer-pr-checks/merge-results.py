#!/usr/bin/env python3
"""Union the result stores the shards carried out, into the one the next run restores.

Usage: merge-results.py <out-dir> <in-dir>...

cat-harness-tools#1503 (`scripts/result-store.ts`). Each `<in-dir>` is a
`build/result-store`: `<gate>/<sha256>.json`, one file per green result, named
by the digest of its content. The union of two such directories IS their merge:
a file name present in both names the same entry. This copies every entry into
`<out-dir>`, then keeps the newest MAX_PER_GATE per gate by `recordedAt`, the
same bound `putResult` keeps, so the cache does not grow without end.

It checks nothing about an entry beyond that it parses: `ci-cone.ts` re-derives
every file's digest when it reads the store and offers no entry whose name is
not its content's digest. A missing `<in-dir>` is skipped: a shard that carried
no store recorded nothing, and a gate with no stored result is a gate that
runs.
"""
import json
import os
import shutil
import sys

MAX_PER_GATE = 16  # result-store.ts MAX_PER_GATE


def recorded_at(path):
    try:
        with open(path) as f:
            v = json.load(f).get("recordedAt", "")
        return v if isinstance(v, str) else ""
    except (OSError, ValueError, AttributeError):
        return None


def merge(out_dir, in_dirs):
    """(gates, entries kept, entries dropped)."""
    for d in in_dirs:
        if not os.path.isdir(d):
            print(f"result store: {d} is absent; its shard carried none")
            continue
        for gate in sorted(os.listdir(d)):
            src = os.path.join(d, gate)
            if not os.path.isdir(src):
                continue
            dst = os.path.join(out_dir, gate)
            os.makedirs(dst, exist_ok=True)
            for name in sorted(os.listdir(src)):
                if name.endswith(".json") and not os.path.exists(os.path.join(dst, name)):
                    shutil.copyfile(os.path.join(src, name), os.path.join(dst, name))
    gates = kept = dropped = 0
    if not os.path.isdir(out_dir):
        return gates, kept, dropped
    for gate in sorted(os.listdir(out_dir)):
        g = os.path.join(out_dir, gate)
        if not os.path.isdir(g):
            continue
        gates += 1
        entries = []
        for name in os.listdir(g):
            p = os.path.join(g, name)
            at = recorded_at(p) if name.endswith(".json") else None
            if at is None:
                os.remove(p)  # unreadable: never a match, so never worth keeping
                dropped += 1
            else:
                entries.append((at, name))
        entries.sort(reverse=True)
        for _, name in entries[MAX_PER_GATE:]:
            os.remove(os.path.join(g, name))
            dropped += 1
        kept += min(len(entries), MAX_PER_GATE)
    return gates, kept, dropped


def main():
    if len(sys.argv) < 3:
        print("usage: merge-results.py <out-dir> <in-dir>...", file=sys.stderr)
        sys.exit(2)
    out_dir, in_dirs = sys.argv[1], sys.argv[2:]
    gates, kept, dropped = merge(out_dir, in_dirs)
    print(f"result store: {kept} result(s) of {gates} gate(s) kept, {dropped} dropped (at most {MAX_PER_GATE} per gate)")


if __name__ == "__main__":
    main()
