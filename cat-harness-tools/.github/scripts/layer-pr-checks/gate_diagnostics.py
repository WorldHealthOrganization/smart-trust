"""The errors a gate printed, as keys that survive a re-run: one module for both runners.

`run-root-gates.py` (the index's own gates) and `run-gates.py` (every declared
gate) record `diagnostics` beside each gate's exit code, and
`compare-gates.py` fails a PR on a diagnostic head holds more times than base.
That is what lets a gate already red on main still judge a PR: without it a
gate red on both sides is "failing on main too" whatever the PR added
(folio-assistant-core#630 added a wrong-direction reference to
`check:reference-direction:check`, red on main, and passed).

Each key leaves out line numbers, columns and counts, so an error that only
moved, or a count that went down, is not new. Five shapes are read:

- `tsc`: `file(line,col): error TSnnnn: message`, and the file-less `error TSnnnn: message`;
- ESLint's stylish report: a file line, then `  line:col  error  message  rule`;
- the harness's qa-results baseline (`scripts/qa-results.ts`), printed by every
  `--against <ref>` gate: `new in <family>:` then `  + {json}` per new finding;
- a harness `✗ <finding>` line, unless it opens with a count (`✗ 6 finding(s):`,
  `✗ 1 kind JSON Schema finding(s) —`), keyed by its text;
- the indented items under a counted `✗ N ...:` heading, keyed by the item
  (`libraries:check`).

In the last two every number (`3`, `1.5`, `1.4.4`) reads as `#` (cat-harness-tools#1457), so a count
inside a finding that only went down (`3 contract(s)` to `2`) is not new, and
every commit id reads as `<commit>`, so a re-pin that leaves a lock mismatch
main already has is not new either (who-iris#239).
Repeats are kept, so two findings that differ only in a number count as two.
`run-gates.py`'s `findings()` is this function.

A gate that printed none of them is judged by its exit code alone, as before.
"""
import json
import os
import re
from functools import lru_cache

# `path(line,col): error TS1234: message`, and tsc's file-less `error TS5083: ...`.
TSC = re.compile(r"^(?P<file>\S.*?)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+): (?P<msg>.*)$")
TSC_GLOBAL = re.compile(r"^error (?P<code>TS\d+): (?P<msg>.*)$")
# ESLint stylish: a file line, then `  90:31  error  message  rule` under it. A
# parse error carries no rule.
ESLINT_FILE = re.compile(r"^(?P<file>/\S.*)$")
ESLINT_ERROR = re.compile(r"^\s+(?P<line>\d+):(?P<col>\d+)\s+error\s+(?P<msg>.+?)(?:\s{2,}(?P<rule>\S+))?\s*$")
# qa-results.ts: `    new in <family>:` then `      + {json}`.
QA_FAMILY = re.compile(r"^\s+new in (?P<family>.+):$")
QA_ADDED = re.compile(r"^\s+\+ (?P<entry>\{.*)$")
# A harness finding: `✗ <text>`. One that opens with a count is a count, and
# a heading when it ends in `:`.
CROSS = re.compile(r"^\s*✗\s*(?P<text>.+?)\s*$")
COUNTED = re.compile(r"^\d+\b")
NUMBER = re.compile(r"\d+(?:\.\d+)*")  # 3, 1.5 and 1.4.4 alike
# A commit id, abbreviated or whole: hex with at least one digit and one letter
# (an all-digit one is a NUMBER). A re-pin changes the commits a finding names
# (`check:lock-consistency`: "the index pins 1c36aef5ab70, cat-harness's own
# lock pins 823e7921d9c7"), not the finding, so it reads as `<commit>`.
COMMIT = re.compile(r"\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b")
ANSI = re.compile(r"\x1b\[[0-9;]*m")


def rel(path, root):
    """`path` relative to `root` when it lies under it, so both sides' keys agree."""
    if root is None:
        return path
    root = os.path.abspath(root)
    if os.path.isabs(path) and (path == root or path.startswith(root + os.sep)):
        return os.path.relpath(path, root)
    return path


# What differs between two runs of the same finding: a temporary directory's
# random name (a duration's number reads as `#` like any other).
TMP = re.compile(r"(/tmp|/var/folders)/[^/\s'\"]+")


def unroot(text, root):
    """`text` with the absolute root (when given) and temporary directories made
    run-independent, so two checkouts' keys agree."""
    if root is not None:
        root = os.path.abspath(root)
        text = text.replace(root + os.sep, "").replace(root, ".")
    return TMP.sub(r"\1/<tmp>", text)


def finding_key(text, root):
    """A `✗` finding's key: run-independent, every commit id read as `<commit>` and every number as `#`."""
    return NUMBER.sub("#", COMMIT.sub("<commit>", unroot(text, root)))


def diagnostics(text, root=None):
    """Every error `text` reports, as line-free keys, in the order printed (repeats kept)."""
    out = []
    eslint_file = family = None
    listing = False
    for raw in text.splitlines():
        line = ANSI.sub("", raw).rstrip()
        if not line.strip():
            eslint_file = family = None
            listing = False
            continue
        m = TSC.match(line)
        if m:
            out.append(f"{rel(m['file'], root)}: {m['code']}: {m['msg'].strip()}")
            continue
        m = TSC_GLOBAL.match(line)
        if m:
            out.append(f"-: {m['code']}: {m['msg'].strip()}")
            continue
        m = ESLINT_FILE.match(line)
        if m:
            eslint_file = rel(m["file"], root)
            continue
        m = ESLINT_ERROR.match(line)
        if m and eslint_file:
            out.append(f"{eslint_file}: {m['rule'] or 'parse'}: {m['msg'].strip()}")
            continue
        m = QA_FAMILY.match(line)
        if m:
            family = m["family"].strip()
            continue
        m = QA_ADDED.match(line)
        if m and family:
            out.append(f"new in {family}: {unroot(m['entry'], root)}")
            continue
        m = CROSS.match(line)
        if m:
            # `✗ 6 finding(s):` heads a list; a bare count is no finding.
            counted = bool(COUNTED.match(m["text"]))
            listing = counted and m["text"].endswith(":")
            if not counted:
                out.append(finding_key(m["text"], root))
            continue
        if listing and line[:1] in (" ", "\t"):
            out.append(finding_key(line.strip(), root))
            continue
        listing = False
    return out


@lru_cache(maxsize=None)
def _pins(root):
    """harness -> pinned ref, from the root's `index.lock.json`; {} without one."""
    try:
        with open(os.path.join(root or ".", "index.lock.json")) as f:
            lock = json.load(f)
    except (OSError, ValueError):
        return {}
    return {m["harness"]: m["ref"] for m in lock.get("mounts", []) if isinstance(m, dict) and m.get("harness") and m.get("ref")}


def producer(root, name):
    """The pin of the harness a gate is named for (`<harness>:<script>`), or None.

    `compare-gates.py` matches a red gate's diagnostics by text only when both
    sides ran the same code. A re-pin that changes the gate's own code can
    reword every finding it prints (a downstream re-pin: cat-harness-tools#1953
    reworded 146 `check:subgraph-coverage` findings and none was new), so
    each side records which pin produced them. None for the root's own
    gates, which the lock does not pin: those keep the text match.
    """
    return _pins(root).get(name.split(":", 1)[0])
