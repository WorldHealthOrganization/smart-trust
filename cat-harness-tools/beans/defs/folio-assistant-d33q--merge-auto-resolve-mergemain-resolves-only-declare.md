---
# folio-assistant-d33q
$schema: bean/1.0.0
title: 'MERGE AUTO-RESOLVE: merge:main resolves only DECLARED conflict patterns, proves the result with the gate set, and is the merge-base.bpmn sub-process'
status: completed
type: feature
priority: normal
created_at: 2026-10-01T06:57:14Z
updated_at: 2026-10-08T05:42:00Z
parent: folio-assistant-hfag
---

Issue #1707 (bean y7b3 measured it). Owner 2026-10-01: '1 + new skills/tools for each common churn/conflict pattern' and 'put in merge process bpmn'. Settles 520m's open question (may a resolver cover every generated artefact?) as: yes, one declared pattern at a time.

## Measured (y7b3)
300 main-into-branch merges: 235 conflicted, 147 (63%) only on generated files.

## Built
- cat-harness/scripts/merge-conflict-patterns.ts: ordered registry, each with globs, strategy (take-base / generated-regions / qa-sidecar / refuse) and why. Undeclared paths refuse.
- cat-harness/scripts/merge-base.ts + 'bun run cat merge:main': classify all first; any refusal aborts and restores the tree; resolve; 'regen' (workflow-derived gate set) must report nothing unrepaired; commit.
- processes/merge-base.bpmn, called from Task_PrepareMerge in code-change-review.bpmn.
- skill merge-conflict-patterns: one section per pattern.

## Done when
- [x] registry + command + tests (refusals tested beside each resolution)
- [x] BPMN sub-process, called from the merge step
- [x] gates green, PR merged (merged in PR #1754)
- [x] PR B: workflow that runs merge:main on conflicted open PRs when main moves (merged in PR #1820 / #1834)

## Verified 2026-10-01
- Replayed 40 real historical merges (dry-run): 39 agreed with an independent generated-vs-authored classification; the 1 disagreement refused safely (kg-qa.manifest.json, now a declared pattern).
- Full run on real merge 6b8e62d (16 conflicts): all resolved by declared pattern, regen 63 current / 0 unrepaired, merge committed.

## Handover (owner away a week)
- Merged without waiting for CI on the owner's instruction; check CI on the merge commit first.
- Next: PR B, a workflow that runs `bun run cat merge:main` on conflicted open PRs when main moves (bot push; same diagram).

## Part B — design (written 2026-10-01, S2 of epic 7x5n; NOT implemented)

**What.** When `main` moves, CI regenerates on each open PR's merge result and
pushes a fix-up commit, so an agent does not spend a round on a merge that is
mechanical by declaration. Same diagram: `merge-base.bpmn`, executed by the same
`bun run cat merge:main`; the workflow is a second caller, never a second resolver.

**Why it is worth building — measured on #1754 today (4-core container, load 6–8
from sibling sessions):**

| round | main | conflicts | result | merge start → verdict |
|---|---|---|---|---|
| 1 | cdb0a018c (red) | 42 | aborted: 6 unrepaired, all main's own red | 39 min |
| 3 | c7505917 | 45 | refused in <1 min: 3 undeclared (now declared) | <1 min |
| 4 | c7505917 | 45 | aborted: 2 unrepaired — submodules not checked out at merged pins (fixed) | 46 min |
| 5 | c7505917 | 45 | merged, 75 current / 8 regenerated / 0 unrepaired | 37.5 min |
| 6 | 48e9f383 | 4 | merged, 7 regenerated | 19 min |
| 7 | after #1774 | 12 | merged, 80 current / 3 regenerated | 20 min |

Plus `bun run cat gates` on the result: 29–32 min, red only on 5 s test timeouts
under load (all pass at `--timeout 60000`) and, the first time, three
merged-tree gates the branch alone could not see. Round 7 merge start (15:11)
→ local gates done (16:01) → push (16:03): **52 min**. So merge → proved is
~50–80 min of agent wall-clock, while `main` moves
every ~3 min: by the time a branch is proved, it is ~20 commits behind again.
Doing it in CI moves that cost off the agent and onto a runner that is not
shared with sibling sessions.

**Shape.**
1. Trigger: `push` to `main`, debounced — `concurrency: merge-main-${pr}` with
   `cancel-in-progress: true`, so a burst of pushes yields one run per PR.
2. Select: open PRs whose `mergeable_state` is `dirty` (conflicted) or whose
   base is more than N commits behind, AND which opt in by label
   (`auto-merge-main`). Never a fork; never a PR whose head moved during the run.
3. Run `bun run cat merge:main` on a checkout of the PR head with submodules.
   - exit 0 → push the merge commit to the PR branch (bot identity), comment
     once with the per-pattern counts, and let the PR's own CI judge it.
   - exit 1 (refused) → push nothing; comment the ✗ list once (edit in place
     on the next run, like the health issue), and label `needs-merge-human`.
   - exit 1 (unrepaired) → push nothing; if the same checks fail on `main`,
     say so (that is main's red, not the PR's) rather than labelling the PR.
4. The push uses a token that DOES trigger the PR's workflows (a GITHUB_TOKEN
   push does not), so the fix-up is proved by the real CI, not trusted.

**What would falsify it.** (a) If most conflicts are authored rather than
generated, the bot only comments — measure the refusal rate over the first
week before widening the label. (b) If the regen half alone exceeds the
runner budget (~40 min here, under load), split: CI pushes the resolved merge
WITHOUT regen and lets the PR's own gates' writers fix up — but that pushes an
unproved commit, which rule 2 of the skill forbids, so the answer would be a
faster regen, not a weaker proof.

**Not doing.** No new patterns from CI (a pattern is declared by a person, with
its `why`); no merging to `main`; no running on PRs that have not opted in —
a bot commit on somebody's in-flight branch is a coordination event.


## 2026-10-01 late — part B approved

Owner approved CI merge:main (this bean's part B) as speed-up 3 of 4 for the merge treadmill (session_01ToWZR4RgTRCWeSsgxsSQfT). Siblings created alongside it under `0mf0`: input-hash skip, parallel checks, CI sharding + BPMN cache + shallow checkout.

Re-parented 2026-10-02 from `1xhc` to the merge-pipeline epic `hfag` on the owner's ruling (the merge pipeline is its own epic, blocking `7x5n`).

## Field case for the qa-sidecar pattern (measured 2026-10-03)

A HAND resolution deleted a generated QA sidecar that BOTH sides had, and the
breakage surfaced as a hard-gate red with an unrelated-looking name.

PR #1819 head `c975c7da7b9` ("Merge remote-tracking branch origin/main into
claude/quirky-hypatia-k3aoh4-strip-pinned", 2026-10-03T00:03:36Z):

- parent1 `bdc09cbec75` (branch side) HAS `cat-harness/test/results/viewer-nav/viewer-nav.qa.json`
- parent2 `5187a4df361` (main side)   HAS the same path
- merge result `c975c7da7b9`          does NOT (`git ls-tree` empty)

Consequence: `bun run cat check:viewer-nav` exits 1 with
`viewer-nav.qa.json is missing - run bun run cat viewer:nav:audit`, failing the
hard job "Repository gates (hard)" / step "viewer pages keep the navbar they
had" (run 37080417880). The same run reports `0 railed page(s) fail a layout
flag` - so the gate name reads like a navbar regression while the actual cause
is a dropped sidecar. #1808 and #1804 both still carry main blob
`32529aedc17` at that path, so #1819 is the only one affected.

Two things this is evidence for:

1. `merge:main` would have classified the path under the declared `qa-sidecar`
   strategy rather than dropping it; a delete-on-conflict is not a strategy the
   registry can express, which is the point.
2. "Resolve only the generated conflicts" is not self-evidently safe advice when
   carried out by hand - deleting a generated file IS a resolution of its
   conflict, and it passes a reviewer skim because the path looks like noise.
   Worth a line in the merge-conflict-patterns skill: a generated path is
   REGENERATED or taken, never removed.

## Completed on landed evidence
Landed on main in PR #1754 (merge commit `c172a9ae90a6`, commit `0dc00fda1743`: "merge:main — auto-resolve only declared conflict patterns, proved by the gate set; merge-base.bpmn") and Part B in PR #1820 (merge commit `87431534f530`, commit `76c85c2db3d1`) / PR #1834 (merge commit `4d3eca5fd7e8`, commit `76918b124f05`: "merge-main.yml: fire on conflicted PRs, run main's tool, fail loudly").
- Implemented declared conflict pattern registry, `merge:main`, and `merge-base.bpmn`.
- Implemented `merge-main.yml` CI workflow to run `merge:main` on conflicted open PRs when main moves.
