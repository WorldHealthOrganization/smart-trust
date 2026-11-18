#!/usr/bin/env python3
"""The test files of OTHER instances that read a layer: run on that layer's PR.

Usage: reader-tests.py <root> <instance> [<max>]

A layer PR ran only its own tests (`bun test ./<instance>`). A test another
layer keeps about it ran first in the index, at re-pin, and failed there:
folio-assistant-core#630 changed `typologies/glossary.json`, which
cat-harness-tools' `schemas/standalone-fixture.test.ts` holds a byte-equal copy
of; who-iris#175 added a graph, which `test/coordinator/navbar-checkout.test.ts`
lists. Each needed a fix PR, a merge, a re-pin and another index run.

A reader is a `*.test.ts` / `*.test.tsx` / `*.test.js` file under another
instance's directory, or under the root's own `test/`, whose text names the
instance as a quoted string or the start of a path into it: `"who-iris"`,
`'who-iris/...`, `` `folio-assistant-core/... ``. A static match, so it can
over-select (a test that only names the layer) and never under-selects a test
that reads the layer by its directory name. Prints the files, one per line, as
`./<path>` (a path, never a filter, to `bun test`), sorted.

More than <max> (default 150) readers is a layer most of the index reads
(cat-harness: ~390 files, the whole tools suite): then nothing is printed, and
a notice on stderr says so, since running the index's suite on every PR is
the index's job. Exit 0 either way; exit 2 when <root>/<instance> is missing.
"""
import os
import re
import sys

SUFFIXES = (".test.ts", ".test.tsx", ".test.js")
SKIP_DIRS = {"node_modules", "build", "dist", "_site"}


def is_instance(root, entry):
    return os.path.isfile(os.path.join(root, entry, f"{entry}.json"))


def candidates(root, instance):
    """Directories to scan: every other instance's, and the root's own `test/`."""
    dirs = [e for e in sorted(os.listdir(root))
            if not e.startswith(".") and e != instance and os.path.isdir(os.path.join(root, e)) and is_instance(root, e)]
    if os.path.isdir(os.path.join(root, "test")):
        dirs.append("test")
    return dirs


def readers(root, instance):
    names = re.compile(r"""["'`]""" + re.escape(instance) + r"""(?:["'`]|/)""")
    out = []
    for top in candidates(root, instance):
        for d, subdirs, files in os.walk(os.path.join(root, top)):
            subdirs[:] = [s for s in subdirs if s not in SKIP_DIRS and not s.startswith(".")]
            for f in files:
                if not f.endswith(SUFFIXES):
                    continue
                p = os.path.join(d, f)
                try:
                    with open(p, encoding="utf-8", errors="replace") as fh:
                        if names.search(fh.read()):
                            out.append("./" + os.path.relpath(p, root))
                except OSError:
                    continue
    return sorted(out)


def main():
    if len(sys.argv) not in (3, 4):
        print(__doc__.split("\n\n")[1], file=sys.stderr)
        sys.exit(2)
    root, instance = sys.argv[1], sys.argv[2]
    cap = int(sys.argv[3]) if len(sys.argv) == 4 else 150
    if not os.path.isdir(os.path.join(root, instance)):
        print(f"::error::{root}/{instance} is missing: no readers can be found", file=sys.stderr)
        sys.exit(2)
    found = readers(root, instance)
    if len(found) > cap:
        print(f"::notice::{len(found)} test files of other instances name {instance}, more than {cap}: "
              f"none is run here (the index's own run runs them)", file=sys.stderr)
        return
    print(f"{len(found)} test file(s) of other instances name {instance}", file=sys.stderr)
    for p in found:
        print(p)


if __name__ == "__main__":
    main()
