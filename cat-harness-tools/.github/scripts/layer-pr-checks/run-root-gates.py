#!/usr/bin/env python3
"""Run the index's own gates over a composed root and record each result.

Usage: run-root-gates.py <root> <root-gates.json> <out.json> [<serial-gates.json>...]

The gap this closes (owner, 2026-10-23, item 2): a layer's PR was judged on
its own gates, and on the `check:*` gates of its dependency harness, in the
index with the PR swapped in, but never on the gates the INDEX itself runs over
that same tree. The index lints every mounted instance with one config and
typechecks every instance that carries a tsconfig.json, so a PR could pass all
of its own checks and still turn the index red the day it was pinned
(cat-harness-tools#385: an unused `m` in scripts/lib/scheme-css.ts, which the
index's lint rejected once the PR was pinned).

Which gates run is DATA, `<root-gates.json>`'s `gates`, a map of gate name to
the root script that runs it (`bun run cat <script>` from <root>), so this file
names no instance and no repository. Every one runs at once; each is written to
<out.json> as `{command, exit, tail, seconds, diagnostics}`, the shape
`run-gates.py --record` merges and `compare-gates.py` judges.

`diagnostics` is what makes a gate already red on main still judge the PR: the
errors the gate printed, each as `<file>: <code or rule>: <message>` with the
line and column left out, so an error that only moved is not new.
`compare-gates.py` fails the PR on a diagnostic head holds more times than
base. Two shapes are read, which between them cover the two gates the data
names today: ESLint's default (stylish) report and `tsc`'s
`file(line,col): error TSnnnn: message`. A gate that printed neither is judged
by its exit code alone, as before.

Each further data file names gates that run ONE AT A TIME, after the pooled
ones: `index-gates.json`, the index's generated-file `--check`s and
`check:reference-direction:check`. Several of those run their writer and hash
the tree around it (`publish-check.ts`), so beside a neighbour that writes
they would blame it on themselves. They keep their `<instance>:<script>` names,
the names `run-gates.py` gives them as declared gates.

The diagnostics parser is `gate_diagnostics.py`, shared with `run-gates.py`.

Exits 0 whatever the gates did: the compare step judges head against base.
A missing or unreadable <root-gates.json> exits 2, since running nothing
would read as a pass.
"""
import json
import os
import shlex
import subprocess
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

# Beside this file, found by its path: the tests and `python3 -I` put no
# script directory on sys.path.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# No __pycache__/ beside the module: this directory is often a MOUNTED layer,
# whose bytes a mount digest pins, and a caller passing `-I` cannot be asked
# for PYTHONDONTWRITEBYTECODE (bean cat-tools-sm8r item 4).
sys.dont_write_bytecode = True
from gate_diagnostics import diagnostics, producer  # noqa: E402

TIMEOUT_S = 1200


def run(root, name, script):
    # An argument list, not a shell string: the script name comes from a
    # package.json in the tree under test (security audit V5).
    command = ["bun", "run", "cat", *shlex.split(script)]
    start = time.monotonic()
    try:
        p = subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=TIMEOUT_S)
        code, text = p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired as e:
        out = e.stdout.decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
        code, text = 2, out + f"\ntimed out after {TIMEOUT_S} s: could not determine"
    seconds = round(time.monotonic() - start, 1)
    return name, {"command": shlex.join(command), "exit": code, "tail": text[-1500:], "seconds": seconds,
                  "diagnostics": diagnostics(text, root), "producer": producer(root, name)}, text


def read_gates(data):
    """The `gates` map of one data file; exit 2 when it names none, since running nothing would read as a pass."""
    try:
        gates = json.load(open(data))["gates"]
        assert isinstance(gates, dict) and gates and all(isinstance(v, str) for v in gates.values())
    except (OSError, ValueError, KeyError, TypeError, AssertionError) as e:
        print(f"::error::{data} names no gates ({e.__class__.__name__}): nothing would be judged")
        sys.exit(2)
    return gates


def main():
    if len(sys.argv) < 4:
        print(__doc__.split("\n\n")[1], file=sys.stderr)
        sys.exit(2)
    root, data, out_path, *serial_data = sys.argv[1:]
    gates = read_gates(data)
    serial = {}
    for extra in serial_data:
        serial.update(read_gates(extra))
    with ThreadPoolExecutor(max_workers=len(gates)) as pool:
        outcomes = list(pool.map(lambda kv: run(root, *kv), gates.items()))
    outcomes += [run(root, *kv) for kv in serial.items()]
    results = {}
    for name, entry, text in outcomes:
        n = Counter(entry["diagnostics"])
        print(f"::group::{name}: exit {entry['exit']} in {entry['seconds']} s, {sum(n.values())} error(s) — {entry['command']}", flush=True)
        print(text[-4000:], flush=True)
        print("::endgroup::", flush=True)
        results[name] = entry
    with open(out_path, "w") as f:
        json.dump(results, f, indent=1)


if __name__ == "__main__":
    main()
