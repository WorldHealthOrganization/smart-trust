#!/usr/bin/env python3
"""Judge a PR's standalone run against main's and the committed baseline.

Usage: compare-standalone.py <standalone-baseline.json> <layer> <base.json> <head.json>

base.json and head.json are what `check-standalone.ts --layer <layer>
--measured-out` wrote on main and on the PR. Both runs stand on the same moving
cat-harness main, so a test that fails on both is not the PR's; neither is one
the baseline lists. Exit 1 when head fails a test that is in neither, or when
head's unnamed failures grew past both; exit 2 when head could not be measured;
exit 0 otherwise. A failing test whose file only moved directory keeps its
old key's standing (pair_moves). Head's failures that main and the baseline both lack are
listed; listed tests that now pass on head are printed with the command that
lowers the baseline. Writes a Markdown summary to $GITHUB_STEP_SUMMARY when set.
"""
import json
import os
import sys


def layer_relative(key, layer):
    if not key.startswith("/"):
        return key
    path = key.split(" > ")[0]
    at = path.rfind(f"/{layer}/")
    return key if at < 0 else key[at + len(layer) + 2:]


LOAD_ERROR_MARK = "(load-time error)"


def file_and_test(key):
    """A failure key split as (file name without its directory, test path).

    A file that fails at module evaluation records only its first top-level
    exception (`<file> > (load-time error) <msg>`). When a PR fixes an earlier
    import error and unmasks a later top-level throw in a file that ALREADY
    failed to load on main (bean `cat-tools-g7ls`), both sides still fail to
    load that file; keying load-time errors by `(file, LOAD_ERROR_MARK)` pairs
    them without excusing a load error in a file that loaded on main.
    """
    file, _, rest = key.partition(" > ")
    if rest == LOAD_ERROR_MARK or rest.startswith(LOAD_ERROR_MARK + " "):
        rest = LOAD_ERROR_MARK
    return os.path.basename(file), rest


def pair_moves(appeared, gone):
    """A failing test whose file only MOVED directory is the same test.

    Pairs each key in `appeared` with the one key in `gone` that has the same
    file name and test path, when exactly one key on each side has it (bean
    8fq9 moves tests into `scripts/tests/<group>/`; owner ruling 2026-10-24).
    Anything ambiguous stays unpaired and is judged as before.
    """
    def by_name(keys):
        out = {}
        for k in keys:
            out.setdefault(file_and_test(k), []).append(k)
        return out
    a, g = by_name(appeared), by_name(gone)
    return {ks[0]: g[n][0] for n, ks in a.items() if len(ks) == 1 and len(g.get(n, [])) == 1}


baseline_path, layer, base_path, head_path = sys.argv[1:5]
entry = json.load(open(baseline_path)).get("layers", {}).get(layer)
base = json.load(open(base_path))
head = json.load(open(head_path))

lines = [f"## {layer} standalone: PR vs main vs baseline", ""]
if head.get("state") != "measured":
    lines.append(f"Could not measure the PR: {head.get('note')}")
    print("\n".join(lines))
    sys.exit(2)
if entry is None:
    lines.append(f"No baseline entry for {layer} in {baseline_path}.")
    print("\n".join(lines))
    sys.exit(2)

listed = {layer_relative(k, layer) for k in entry["failing"]}
on_main = set(base.get("findings", [])) if base.get("state") == "measured" else set()
head_set = set(head["findings"])
known = listed | on_main
moved = pair_moves(head_set - known, known - head_set)
new = sorted(head_set - known - set(moved))
upstream = sorted(((head_set & on_main) - listed) | {k for k, old in moved.items() if old not in listed})
fixed = sorted(listed - head_set - set(moved.values()))

unnamed = lambda d, names: d["count"] - len(names)
head_unnamed = unnamed(head, head_set)
allowed_unnamed = max(entry["failed"] - len(entry["failing"]),
                      unnamed(base, on_main) if base.get("state") == "measured" else 0)

exit_code = 0
if new:
    exit_code = 1
    lines.append(f"**{len(new)} test(s) fail standalone on this PR that neither main nor the baseline fails:**")
    lines += [f"- {n}" for n in new]
if head_unnamed > allowed_unnamed:
    exit_code = 1
    lines.append(f"**Unnamed failures grew:** {head_unnamed} on this PR, at most {allowed_unnamed} allowed.")
if upstream:
    lines.append(f"{len(upstream)} unlisted test(s) fail on main too (not this PR's; the moving cat-harness main):")
    lines += [f"- {n}" for n in upstream]
if base.get("state") != "measured":
    lines.append(f"Main could not be measured ({base.get('note')}); judged against the baseline alone.")
if fixed:
    lines.append(f"{len(fixed)} listed test(s) now pass standalone; "
                 f"`bun run cat-harness-tools/scripts/check-standalone.ts --layer {layer} --update` lowers the list:")
    lines += [f"- {n}" for n in fixed]
lines.append("")
lines.append(f"held: {head['count']} failing, none new" if exit_code == 0 else "grew")

text = "\n".join(lines)
print(text)
summary = os.environ.get("GITHUB_STEP_SUMMARY")
if summary:
    with open(summary, "a") as f:
        f.write(text + "\n")
sys.exit(exit_code)
