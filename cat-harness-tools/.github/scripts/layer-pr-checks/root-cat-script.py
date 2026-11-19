#!/usr/bin/env python3
"""Give the root under test the `cat` script the harness's commands assume.

Usage: root-cat-script.py <root>

The harness's scripts spawn `bun run cat <name>` from the checkout root
(qa-working-copy.ts's `qa:refresh`, gen-uml-overview.ts's `kg:detangle`,
derive-at-publish.ts, regen, ...): run-script.ts says "the root keeps this one
entry, `cat`". A root without it (smart-ra, an IG index over smart-base) turns
each into `/usr/bin/cat <name>`, which prints "No such file or directory" and
exits 1 (smart-ra#65, run 38640286019: `uml:overview:check` ended
"/usr/bin/cat: 'qa:refresh': No such file or directory"). This adds the entry
to the CI working copy's package.json, pointing at whichever layer holds the
runner, the same on base and head; a root that has one keeps it. Nothing is
committed: the checkout is the workflow's.

Exits 0 having added or kept the entry, 2 when no layer holds run-script.ts.
"""
import json
import os
import sys

# Where the runner lives: cat-harness-tools since bean 70lx, cat-harness before.
RUNNERS = ("cat-harness-tools/scripts/run-script.ts", "cat-harness/scripts/run-script.ts")


def cat_command(root):
    for rel in RUNNERS:
        if os.path.isfile(os.path.join(root, rel)):
            return f"bun {rel}"
    return None


def ensure(root):
    """(state, command): 'kept' when the root has `cat`, 'added', or 'missing' (no runner)."""
    path = os.path.join(root, "package.json")
    try:
        with open(path) as f:
            pkg = json.load(f)
    except FileNotFoundError:
        pkg = {}
    scripts = pkg.setdefault("scripts", {})
    if "cat" in scripts:
        return "kept", scripts["cat"]
    command = cat_command(root)
    if command is None:
        return "missing", None
    scripts["cat"] = command
    with open(path, "w") as f:
        json.dump(pkg, f, indent=2)
        f.write("\n")
    return "added", command


def main():
    state, command = ensure(sys.argv[1])
    if state == "missing":
        print(f"::error::no run-script.ts under {sys.argv[1]} ({', '.join(RUNNERS)}): `bun run cat` cannot resolve")
        sys.exit(2)
    if state == "added":
        print(f"::notice::the root declares no `cat` script; added \"cat\": \"{command}\" to the CI working copy's package.json")
    else:
        print(f"the root's own `cat` script: {command}")


if __name__ == "__main__":
    main()
