#!/usr/bin/env python3
"""Was main's STORED answer mounted at the pins this run mounts?

    stored-pins.py <from.json> <lower> <index>

`<lower>` is this run's lower layers as `name=sha` words (the `lower` part of
main's answer key), `<index>` the folio-assistant commit this run mounts
(empty in index mode). Prints `same=true` or `same=false` and a `why=` line,
for `$GITHUB_OUTPUT`. Exit 0 either way; 2 on bad usage.

## Why

A PR's first attempt pins the index and the lower layers to main's newest CI
cone record (the workflow header's "Pinned to main's record"), and is judged
against the answer a run on main stored for the PR's own base commit (its
"main's STORED answer"). The two are found separately, and nothing made them
the same main. On a layer's PR on 2026-11-17 (run 44082781993) the PR
side pinned to the 06:19Z record, cat-harness-tools at 1b18760f, while the
stored answer was the 11:29Z push's, cat-harness-tools at 87cf0f35: its record
was saved at 12:49Z, after the PR had pinned at 12:24Z. Two gates red at
1b18760f and green at 87cf0f35 were charged to a PR that changed two workflow
files (`check:foreign-paths` before cat-harness-tools#2386, and
`navbar:assets:check` before cat-harness-tools#2367 reached the tools).

So a stored answer is used only when it names the same lower layers and the
same index as this run. Anything else, or an answer that does not say, is
`same=false`, and main's side is computed by this run against the pins the PR
side mounts: a slower run, never a wrong verdict.
"""
import json
import sys


def pins(lower: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for word in lower.split():
        name, _, sha = word.partition("=")
        if name and sha:
            out[name] = sha
    return out


def short(p: dict[str, str]) -> str:
    return " ".join(f"{k}@{v[:12]}" for k, v in sorted(p.items())) or "none"


def decide(stored: dict, lower: str, index: str) -> tuple[bool, str]:
    if "lower" not in stored:
        return False, "main's stored answer does not record which lower layers it mounted"
    had, now = pins(str(stored.get("lower") or "")), pins(lower)
    if had != now:
        return False, f"main's stored answer mounted the lower layers {short(had)}; this run mounts {short(now)}"
    had_index, now_index = str(stored.get("index") or ""), index.strip()
    if had_index != now_index:
        return False, f"main's stored answer mounted the index at {had_index[:12] or 'the caller'}; this run mounts {now_index[:12] or 'the caller'}"
    return True, f"main's stored answer mounted the same lower layers ({short(now)}) and index as this run"


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print(__doc__.strip().splitlines()[2].strip(), file=sys.stderr)
        return 2
    path, lower, index = argv[1:4]
    try:
        stored = json.load(open(path))
        if not isinstance(stored, dict):
            stored = {}
    except (OSError, ValueError):
        stored = {}
    same, why = decide(stored, lower, index) if stored else (False, "main's stored answer has no readable provenance")
    print(f"same={'true' if same else 'false'}")
    print(f"why={why}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
