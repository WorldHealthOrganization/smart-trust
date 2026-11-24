#!/usr/bin/env python3
"""The branch-kept graphs a side mounts, as one digest.

    state-digest.py <pin/state.json> [<pin/state-live.json>]

Prints a sha256 of the tips `state-pin.sh` serves: the pinned tips, filled in
from the live read for a branch (or repository) the pin does not name, and a
beans branch (`cat/<instance>/beans`) at its live tip when that differs.
`state-pin.sh` serves a moved beans tip only when it descends from the
pinned one; the digest takes it either way, so it can only see MORE change
than was mounted, never less: a spurious difference costs a recomputed main,
a missed one charges the PR with what moved on a state branch.

## Why

Main's answer was keyed by the pin file alone. A branch the pin did not name
(seeded or copied after main's record), or a beans branch that moved since,
is served from the live read, so two runs with the same pin file mounted
different graphs and shared one answer. On WHO dth-pc#3 (run 44489690657)
the beans branch copied in with a content-change-review instance was read by
the PR side and not by main's stored answer, and `check:prov-qaqc` charged
the PR with the instance's PROV outputs. The digest keys main's answer and
is kept in `from.json`, where `stored-pins.py` compares it.

An unreadable or missing pin file prints `none`: nothing pinned, as
`state-pin.sh` reads it.
"""
import hashlib
import json
import re
import sys

BEANS = re.compile(r"cat/[^/]+/beans")


def load(path: str) -> dict:
    try:
        d = json.load(open(path))
    except (OSError, ValueError):
        return {}
    return d if isinstance(d, dict) else {}


def effective(pins: dict, live: dict) -> dict:
    out = {repo: dict(tips) for repo, tips in pins.items() if isinstance(tips, dict)}
    for repo, tips in live.items():
        if not isinstance(tips, dict):
            continue
        mine = out.setdefault(repo, {})
        for branch, sha in tips.items():
            if branch not in mine or (BEANS.fullmatch(branch) and mine[branch] != sha):
                mine[branch] = sha
    return out


def digest(pins_path: str, live_path: str = "") -> str:
    pins = load(pins_path)
    if not pins and not live_path:
        return "none"
    eff = effective(pins, load(live_path) if live_path else {})
    if not eff:
        return "none"
    return hashlib.sha256(json.dumps(eff, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def main(argv: list[str]) -> int:
    if len(argv) not in (2, 3):
        print(__doc__.strip().splitlines()[2].strip(), file=sys.stderr)
        return 2
    print(digest(argv[1], argv[2] if len(argv) == 3 else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
