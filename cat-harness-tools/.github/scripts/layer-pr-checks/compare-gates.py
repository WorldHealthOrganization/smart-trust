#!/usr/bin/env python3
"""Compare two run-gates.py reports and fail on a gate the PR newly breaks.

Usage: compare-gates.py <base.json> <head.json>

A gate fails the PR when it exits non-zero on head and exited 0 on base, or
when head has a gate base did not run and it fails. A gate red on both is
listed, not counted: it is main's to fix, and failing every PR on it would
teach `|| true`. Exit 2 from a gate is "could not determine" in this
harness's convention; it is reported, and it counts as a failure only when
base determined (0 or 1) and head did not. Exit 78 is "not applicable in
this root" (`scripts/lib/not-applicable.ts`): on head it is listed and never
counted, whatever base exited (#1701). Either one, on a gate base did
not run at all, is listed and never counted: there is no base answer for head
to have lost (smart-immunizations-uganda#15, where `check:unlinked-beans`
exited 78 and `folio:shim:check` 2 on gates main had not yet run, and both
read as NEW FAILURE). A gate run-gates.py skipped
(a `skipped` reason, no `exit`) is listed as skipped and never counted; on
base it reads as not run. Writes a Markdown summary to
$GITHUB_STEP_SUMMARY when set.

ALWAYS GREEN (owner, 2026-11-13: "the json(ld) that is the actual KG need to
be a part of the merge to main commits. ALWAYS need json(ld) up to date -
gate"): a gate whose script is in ALWAYS_GREEN fails the PR whenever it is
red or undetermined on head, even when main is red too. The knowledge
graph's JSON-LD is committed, and a merge to main never lands it stale.
Not applicable (78) is still never counted.

A gate the CI cone skipped (`unchanged: <sha>` beside `skipped`,
cat-harness-tools#398, bean `4rbc`) was not run because every input that its
green traced run on main `<sha>` read is unchanged. It is listed as
"SKIPPED — inputs unchanged since <sha>", never as a pass. On head it is never
counted. On base it stands for that recorded green run: a head failure
against it is NEW, exactly as against a base that exited 0, because base's
inputs were that green run's.

A gate that carries `diagnostics` on both sides (`run-root-gates.py`: the
errors and findings it printed, line numbers and counts left out, by
`gate_diagnostics.py`, which `run-gates.py` uses too) is judged finer when it is red on
both: a diagnostic head holds more times than base is NEW, so a gate already
red on main still fails the PR that adds an error to it. Without them on both
sides, red on both stays "failing on main too".

When both sides also carry a `producer` (`gate_diagnostics.producer`: the pin
of the harness the gate is named for) and the pins differ, the gate's own
code changed between main and the PR, and its findings may be reworded
rather than new (a downstream re-pin, 2026-11-12: cat-harness-tools#1953 reworded 146
`check:subgraph-coverage` findings; head had 479 against main's 566). Text
cannot be matched across that change, so the findings are counted instead:
head holding more than base is NEW; as many or fewer is "failing on main
too", with both counts shown.
"""
import json
import os

# Exit 2: the gate could not determine. Exit 78: it does not apply in this root.
UNDETERMINED = {2: "could not determine", 78: "not applicable here"}
import sys
from collections import Counter

# Scripts (the part of a gate name after `<instance>:`) that must be green on
# every PR, whatever main exited: the committed knowledge graph (owner,
# 2026-11-13). `gen:jsonld:check` regenerates every layer's block, library
# and site JSON-LD and its context; a folio's publish `pre` gates name the
# same writers per instance.
# The diagram SVGs are NOT here: "bpmn and svg dont need to render to merge.
# that QA report" (same day; run-gates.py QA_REPORT_SCRIPTS).
ALWAYS_GREEN = {"gen:jsonld:check", "check:kg-blocks", "check:library-kg", "jsonld:site:check"}


def always_green(name):
    """Is `name` (`<instance>:<script>`, or a bare script) an always-green gate?"""
    return name in ALWAYS_GREEN or any(name.endswith(":" + s) for s in ALWAYS_GREEN)


def new_diagnostics(base_entry, head_entry):
    """The diagnostics head holds more times than base, or [] when either side has none recorded."""
    if not isinstance(base_entry, dict) or "diagnostics" not in base_entry or "diagnostics" not in head_entry:
        return []
    extra = Counter(head_entry["diagnostics"]) - Counter(base_entry["diagnostics"])
    return sorted(extra.elements())


def producer_changed(base_entry, head_entry):
    """Both sides name the pin that produced their diagnostics, and the pins differ."""
    if not isinstance(base_entry, dict):
        return False
    b, h = base_entry.get("producer"), head_entry.get("producer")
    return bool(b and h and b != h)


def side_cell(entry):
    """One side's cell in the table: its exit, `—` when absent, or the cone's skip."""
    if entry is None:
        return "—"
    if entry.get("unchanged"):
        return f"unchanged since {str(entry['unchanged'])[:12]}"
    return entry.get("exit") if entry.get("exit") is not None else "—"


def base_exit(entry):
    """Base's exit for judging head: a cone skip stands for its recorded green run, 0."""
    if entry is None:
        return None
    if entry.get("unchanged"):
        return 0
    return entry.get("exit")


def main():
    base = json.load(open(sys.argv[1]))
    head = json.load(open(sys.argv[2]))
    rows, new, added = [], [], {}
    for name in sorted(head):
        if head[name].get("unchanged"):
            # Not run on head: its recorded read set is unchanged (the CI cone).
            rows.append(f"| `{name}` | {side_cell(base.get(name))} | {side_cell(head[name])} | SKIPPED — {head[name]['skipped']} |")
            continue
        if "skipped" in head[name]:
            # Not run on head: it could determine nothing here (run-gates.py).
            # Listed so it is not silently absent; never a verdict either way.
            rows.append(f"| `{name}` | {side_cell(base.get(name))} | — | skipped ({head[name]['skipped']}) |")
            continue
        h = head[name]["exit"]
        b = base_exit(base.get(name))
        if h == 0:
            verdict = "pass"
        elif h == 78:
            # Not applicable in this root (`scripts/lib/not-applicable.ts`):
            # neither a pass nor a failure, and main-verdict.py already never
            # counts it red. A gate that main answered and that now declines
            # here (a re-pin onto a gate that learned it does not apply to an
            # instance, cat-harness-tools#1701; dth-phc#7, where
            # check:qa-reviewer-permission went 0 -> 78) is listed, so the
            # lost answer shows, and not counted.
            verdict = (
                "not applicable here; main did not run it, so not counted"
                if b is None
                else f"not applicable here; not counted (main exited {b})"
            )
        elif always_green(name):
            verdict = (
                "RED — always-green: the knowledge graph's JSON-LD must be current in every merge to main"
                + ("" if b != 0 else " (main passed)")
                + (f"; main exited {b}" if b not in (None, 0) else "")
            )
            new.append(name)
        elif b is None and h in UNDETERMINED:
            verdict = f"{UNDETERMINED[h]}; main did not run it, so not counted"
        elif h == 2 and b in (0, 1):
            # Before the generic branch, so 2 against a base that passed is
            # labelled for what it is: head lost an answer base had. Counted
            # exactly as before.
            verdict = "NEW: could not determine"
            new.append(name)
        elif b == 0 or b is None:
            verdict = "NEW FAILURE"
            new.append(name)
        elif producer_changed(base.get(name), head[name]) and "diagnostics" in base[name] and "diagnostics" in head[name]:
            nb, nh = len(base[name]["diagnostics"]), len(head[name]["diagnostics"])
            moved = f"its code moved {str(base[name]['producer'])[:12]} -> {str(head[name]['producer'])[:12]}, so its findings are counted, not matched"
            if nh > nb:
                added[name] = new_diagnostics(base.get(name), head[name])
                verdict = f"failing on main too, and NEW: {nh} finding(s) against main's {nb} ({moved})"
                new.append(name)
            else:
                verdict = f"failing on main too: {nh} finding(s) against main's {nb} ({moved})"
        elif new_diagnostics(base.get(name), head[name]):
            added[name] = new_diagnostics(base.get(name), head[name])
            verdict = f"failing on main too, and NEW: {len(added[name])} error(s) main does not have"
            new.append(name)
        else:
            verdict = "failing on main too"
        rows.append(f"| `{name}` | {side_cell(base.get(name))} | {h} | {verdict} |")
    lines = ["## Gates: head against main", "", "| gate | main | PR | verdict |", "|---|---|---|---|", *rows, ""]
    if new:
        lines.append(f"**{len(new)} gate(s) newly failing.** Their output tails:")
        for name in new:
            # The errors themselves when the gate listed them, else its output's tail.
            body = "\n".join(added.get(name) or head[name].get("diagnostics") or []) or head[name]["tail"]
            lines += ["", f"### `{name}`", "", "```", body, "```"]
    summary = "\n".join(lines)
    print(summary)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a") as f:
            f.write(summary + "\n")
    sys.exit(1 if new else 0)


if __name__ == "__main__":
    main()
