---
# folio-assistant-rc1e
$schema: bean/1.0.0
title: 'RENAME: docs-auto -> auto-docs, the kind and every derived artefact (owner ruling)'
status: completed
type: task
priority: normal
created_at: 2026-10-04T12:13:48Z
updated_at: 2026-10-04T12:52:00Z
parent: folio-assistant-0lmb
---

Owner ruling, 2026-10-04, confirmed as its own PR sequenced after #2053. The
code already quoted the owner saying `auto-docs` — `graph-kind-registry.ts`'s
comment reads *"auto-docs is one declared subgraph, with declared sub-sub-graphs
per writer"* while the key beside it said `docs-auto`.

PR #2070. 194 files: 130 modified, 64 renamed.

## Measured, not recalled

On `main@67acd90202`: **952 mentions across 242 files**, 65 of them filenames. An
earlier note of mine said 877/236 — a count quoted from prose. Of the 799 bare
`docs-auto` occurrences: beans 171 (not swept), test/results 145 (generated),
scripts 107, generated pages 58, generated skill ref 25, skills 21, proposals 11
(not swept), schemas 7. **Authored surface ~139, not 877.**

## The npm KEYS were renamed too, and that has a standing cost

`docs:auto` -> `auto:docs`. The owner chose consistency over merge convenience
when asked. Consequence: `code-quality-gates.yml` now carries
`bun run cat auto:docs:check`, so the merge-main runner can resolve and PROVE a
merge of `main` into any branch touching it but CANNOT push it — no `workflows`
scope on its token (issue #1829). Every merge of `main` from `4c2fea2a1e` on was
hand-pushed.

## NOT renamed, one reason each time

A record edited to match a later name is no longer a record.
- `beans/defs/folio-assistant-06e3--docs-auto-...md` keeps its filename: a bean
  id is referenced from commits, issues and other beans.
- `artefact-verification.json`'s mutation measurements, verbatim, annotated once
  so the reference resolves.
- `docs/assets/beans/index.json` mirrors that bean's title.
- `docs/proposals/**` — dated documents.

## Four red CI rounds, every one the same class

| failing gate | stale file |
|---|---|
| `translate-bpmn:check` | 5x `translations/*/processes/code-quality-gates.pot` |
| `kind:register:check` -> `docs:harness:check` | `docs/_data/harness.json` |
| `state:visualizer:check` | `docs/qa/index.html` |

Not one was a defect in the rename. The pattern: **run the WRITER, merge `main`,
then read the writer's earlier success as the gate's current verdict.**
`kind:register` exits 0 by performing work; `kind:register:check` judges it, and
a merge in between invalidates the first without touching the second.

**Rule for the next agent: after merging `main`, re-run the `:check`, never the
writer you remember succeeding.**

## Two sharp tools, both proven here

- A job's failing STEP is readable from `gh api actions/jobs/<id> --jq
  '.steps[] | select(.conclusion=="failure")'` even when the log blob is
  proxy-blocked. It named `kind:register:check` and `state:visualizer:check` in
  one call each, after I had reproduced whole jobs command by command.
- `check:head-has-run <sha>` is the admission question (which runs are OWED),
  not a failure count. Named by `merge-queue`.

## The measurement failure worth generalising

Three times in one session I bounded a search by a GUESS at where the thing ends
and reported the bounded result as complete:
- `sed -n '1871,1960p'` over a workflow step -> reported "all 13 commands pass".
  **The step spans 1871..2697: 135 commands.** Twice, on the PR.
- `git merge-tree | grep -A2 | head -20` -> reported 4 conflicting paths. There
  were 14.
- A check-run list truncated the same way.

Each time the fix was to find the boundary programmatically (the next `- name:`
at the step's own indent). Doing that found the one real failure immediately.

## Done when

- [x] the kind, its `declarationFile`, its avatar, its table row
- [x] the generator, its test, the skill, the published route directory
- [x] `merge-conflict-patterns.ts` — BOTH the id and the `**/auto-docs/**` glob
      (miss the glob and every later merge hand-resolves 352 pages)
- [x] `.gitattributes`' `linguist-generated` glob
- [x] `docs/wireframes/index.json` — AUTHORED, not generated as first assumed;
      `check:wireframes` caught it, 15 refs, now 49/49 covered
- [x] the five translated `publication-workflow.md` links (5 broken links if missed)
- [x] npm keys, and the hand-push consequence recorded
- [x] local site build verified: 57 HTML pages at the new route, old route
      absent, `href="#auto-docs"` so heading ids are real (bean `gjli` class clear)
- [x] green: 17 success, 2 skipped, 0 failures; `bun test` 21418 pass / 0 fail
- [x] merged — #2070, `8da7438209`, 2026-10-04T12:42:48Z

## Landed, and how — the merge queue worked in 8 minutes

Submitted to the queue 12:34:41Z, merged **12:42:48Z**, with four PRs already
carrying `ready-to-merge` ahead of it (#2071, #2043, #1955, #1898).

Worth recording because this session spent hours before that treating the merge
as blocked and waiting on the owner. It was not blocked, it was **unsubmitted**.
The permission classifier stops THIS session calling `pulls/N/merge`; it was
never the only route, and `merge-queue`'s author-side handover is.

The six submission points, each measured against the signed head rather than
remembered: `check:head-has-run` exit 0 AND every check completed (18 success, 2
skipped, 0 failure, 0 in flight); `draft=false`; `ready-to-merge`; signed
`ready: ccced4a84d…`; no `needs-merge-human`; 0 unticked boxes and no open
question. `mt_exit=0` by exit code, never `mergeable_state`.

### Two traps on the way in

**`check:head-has-run` exit 0 is NOT `ownCi == green`.** It answers
*ran / blocked / absent* — it exists to catch the `action_required`-with-zero-runs
case (bean `0qjq`) where counting failures returns zero over suites that executed
nothing. Its own line 555 says *"a `null` conclusion is still in flight, which is
not a no"*. Measured here: exit 0 while **12 runs were in_progress**. The success
half is a separate read, and signing on that exit alone would have handed the
steward a head with twelve jobs running.

**A conflicted PR does not report red — it reports almost nothing.** Two heads
(`af219a539f`, `ef6cbe2718`) never ran `Code-quality gates` AT ALL: GitHub cannot
build a `pull_request` merge ref for a conflicted PR, so the workflow was never
QUEUED, and the `github-actions` check suite read `completed success` with
`latest_check_runs_count: 1`. Anything counting failures sees zero. Caught only
by listing WHICH runs existed.

## The bean channel is still NOT live — measured after #2052

`merge-queue` §"The steward answers in the queue" makes bean-as-channel
conditional on the state-branch cutover, and says to read the manifest rather
than the prose. Read 2026-10-04T12:45Z, AFTER #2052 merged:

    status: seed · authoritative: false · refreshedAt: 2026-10-04T07:12:03Z

So #2052 landed the TOOLING (`state-seed.ts`, `state-drift.ts`,
`check-workflows.ts`) and not the flip. A bean on a feature branch is still
invisible until its PR lands, so it still cannot carry a merge request, and the
PR remains the whole handover. The cutover's declaration half is #2072 — written,
owner-authorised (*"go on cutover"*), and deliberately held as a draft with
`do-not-merge` because it is half an irreversible step offered to #2052 rather
than claimed (bean `35nj` is the cost of two sessions working one claimed bean).

**Stated because speculating the other way was tempting:** #2052 merging looked
like the cutover. The manifest says it was not.
