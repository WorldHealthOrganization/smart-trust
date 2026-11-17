---
# folio-assistant-9x9r
$schema: bean/1.0.0
title: check:head-has-run passes on ANY run naming the sha — two unrelated push runs satisfy it while the gate workflow never fired
status: completed
type: bug
priority: high
created_at: 2026-09-24T19:38:43Z
updated_at: 2026-09-25T18:14:49Z
parent: folio-assistant-1xhc
---

Measured 2026-09-24, on PR #1309's head. The script printed a ✓, and the gate
set had never fired.

## The pass condition is strictly weaker than the defect it detects

`runsForHead` asks the Actions API for every run whose `head_sha` is this
commit, and line 191 decides:

```ts
return runs.length > 0 ? { state: "has-run", runs } : { state: "no-run" };
```

Any run. Any workflow, any event. The header says so in as many words —
*"at least one workflow run names this exact `head_sha`"* — so the ✓ is
honest about what it measured. It is the **question** that is wrong.

The operator running this script is asking *"did my PR's gates fire?"*. On
the measured head, two push-triggered runs of unrelated workflows named the
sha, and `Code-quality gates` — a `pull_request` workflow — had not fired at
all. That is `3pqn`, the exact condition this script exists to detect, and
the script reported it as clean.

## Why this is 1xhc and not a cosmetic gap

`sddf` fixed this script's *advice* (it recommended a dispatch that `yv4z`
had measured as unsafe). This is one level earlier: the **verdict** is wrong
before the advice is reached. A gate that does not fire is indistinguishable
from one that passed — and here a script written against that very sentence
reproduces it, because a run from a *different* workflow is admitted as
evidence for *this* one.

## A second, worse case — found while implementing

PR #1222's head `28f929a`, same day. Its **only** run was `Code-quality
gates` fired by **`workflow_dispatch`**. The old check printed a ✓.

That is worse than #1309's, because a dispatch resolves
`refs/heads/<branch>` rather than `refs/pull/N/merge` — so the green was
about a tree that is not what would land (`yv4z`, `sddf`). The script whose
own no-run branch carries that warning endorsed it from the other branch.

So the defect is not "any run counts" alone; it is that neither the
workflow nor the event was ever asked about.

## Settled

Owner ruled **option 1** on 2026-09-24: derive the owed workflows from
`.github/workflows/`. Implemented in `src/core/workflow-events.ts`
(`scanTriggers` / `triggerFor`) and consumed by `check-head-has-run`.

Three states, because a sha carries neither a diff nor a ref:

| | |
|---|---|
| `required` | declares the event with no filters — absence is a **finding** |
| `conditional` | declares it behind `paths`/`types`/`branches` — **not judged**, and printed rather than dropped |
| `not-declared` | owes nothing |

In this repository four workflows declare `pull_request` and exactly one —
`Code-quality gates` — does so unfiltered. **That count is not asserted
anywhere**: the test pins the *property* that at least one is required
(an empty required set passes vacuously on every commit), because a count
in a test is the same defect as a count in prose.

Job-level `if:` is deliberately ignored — a triggered workflow produces a
run even when every job skips, which #1309 demonstrates, so treating it as
a filter would have moved a genuinely required workflow into the
unjudgeable column for nothing.

## Done when

- [x] the verdict names the workflow and the event, not just the commit
- [x] required / conditional / not-declared stay three states
- [x] could-not-ask still outranks both (an unreadable workflow file exits 2)
- [x] tests on synthetic trees; the one real-tree test asserts a property, not a count

The two candidates as they stood before the ruling, and their costs, are in
[issue #1324](https://github.com/litlfred/folio-assistant/issues/1324).
Option 2 (match per-event only) is a strict subset of what shipped: it would
have caught #1309's push-run case and **missed** #1222's dispatch case, and
would still pass if the gate workflow were renamed or deleted.

---

## Evidence — re-derived 2026-09-25, closing

Closed on **evidence, not authorship** (`bean-coordination` §"Closing a bean
whose work has already landed"). Every box re-run here, from a checkout
identical to `origin/main` at `d8c450b9a2` with a clean tree — not read off the
notes above.

| box | how it was re-derived |
|---|---|
| verdict names the workflow and the event | `bun run cat-harness/scripts/check-head-has-run.ts` printed `Code-quality gates  push  in_progress`, `JSON-LD generated-file drift  push  success`, `Docs site (GitHub Pages)  push  in_progress` — workflow, event, conclusion |
| required / conditional / not-declared stay three states | same tool on a PR head earlier the same day: `✗ Code-quality gates  required` beside `? Atomic-mass generated-file drift  conditional (paths) — not judged` |
| could-not-ask outranks both | `head-has-run.test.ts`, 22 pass — `cannot-ask` asserted for no remote, a 404 (*"not being ALLOWED to look is not an absence"*) and a 403; `workflow-events.test.ts` adds *"unreadable files are carried through to the caller, not swallowed"* |
| synthetic trees, one real-tree test asserting a PROPERTY | `workflow-events.test.ts`, 20 pass. The real-tree test is *"at least one workflow is REQUIRED on pull_request"* — a property, as the box asks, not a count |

Also observed on the clean checkout: with no open PR for the sha the tool says
*"WHICH workflows should have run cannot be determined … nothing about them has
been judged"* — the third state working, rather than a silent pass.

Not mid-flight: landed 2026-09-25 via #1325, no branch on the remote names this bean.
No box needs a person.
