---
# folio-assistant-m5gx
$schema: bean/1.0.0
title: One red test at step 5 makes 149 gate commands unreachable in CI — the typescript job stops and 45 of its 50 steps never run
status: scrapped
type: task
priority: normal
created_at: 2026-09-26T10:20:26Z
updated_at: 2026-09-26T13:39:46Z
parent: folio-assistant-1xhc
---

Found 2026-09-26 while wiring bean `1s5s` (the published package's Python half)
into `check:published-packages`. Noticed because the new gate **could not be
verified on a runner** — not because it failed, but because it never ran.

## The measurement

`.github/workflows/code-quality-gates.yml`, job `typescript`, parsed rather
than eyeballed:

- `bun test` is **step 5 of 50**, with no `continue-on-error`;
- `check:published-packages` is inside step **44**;
- GitHub Actions stops a job at its first failing step.

So while `bun test` is red, **45 of the job's 50 steps never execute**, and
inside them are **149 distinct `bun run` gate commands** — among them
`audit:coverage:require-all`, `audit:coverage:strict`, `check:agents-xref`,
`agent-memory:check`, `bootstrap:schemas:check` and the rest of the registered
set. Counted by walking the parsed YAML, not by grepping prose.

## Why this matters more than it looks

`main` has been red at exactly that step since #1384 reverted #1364 — **by the
owner's decision**, so the drift can be closed with real `.po` catalogues rather
than UNCATALOGED records (beans `ngxj`, `tbdg`). That decision is sound. Its
side effect was not decided by anyone: for as long as it holds, the TypeScript
job reports on five steps and is silent about the other forty-five.

This is the `5rfy` / `1xhc` shape one level up. A gate that cannot fire is
indistinguishable from a gate that passed, and here **149 of them** are in that
state at once — on every PR, not just on `main`. A regression in any of them
lands green today and surfaces whenever the drift is finally fixed, at which
point it will look like the drift fix caused it.

It also means the usual control — "is this failure mine, or main's?" — silently
stops working past step 5: a PR cannot demonstrate that it did NOT break
anything in steps 6–50, because those produce no evidence either way.

## Done when

[ ] A decision is recorded on whether a hard failure at `bun test` should stop
    the remaining 45 steps. The two shapes are not equivalent and both have
    real costs:
    - split the registered-gate steps into their own JOB, so `bun test` and
      the gate set fail independently (more runner minutes, clearer signal);
    - or keep one job and let the early steps continue-on-error with an
      aggregate verdict at the end (one job, but a reader must then read the
      summary rather than the first red X).
[ ] Whichever is chosen, verified by BREAKING it — make `bun test` fail
    deliberately and confirm a later gate STILL reports its own verdict.
    Without that, the fix is indistinguishable from the current state, which
    is the whole defect.
[ ] The count is re-derived at that time, not quoted from this bean.

## Not claimed here

That any of the 149 is currently broken. Nobody knows, and that is the finding —
not a prediction that something is wrong, but that the question is unanswerable
from CI right now.

_2026-09-26T12:15:44Z_ — Claimed by claude/sleepy-rubin-mr6kdu — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## SCRAPPED 2026-09-26 — duplicate of `om30`, which merged while this was being built

Not abandoned and not wrong: `om30` did the same split, on the owner's choice,
and landed as `a44e7faefbd` (PR #1390) while PR #1401 implemented this one. Main
carries a `gates:` job. #1401 conflicted with it across 18 files and was closed.

Scrapped rather than deleted, because a scrapped bean stops the next agent
re-entering a dead end while a deleted one cannot be told from an accident.

## Why the claim did not prevent it

`bun run cat beans:claim m5gx` succeeded and wrote its holder note to the default
branch. The sibling was working **`om30`** — a different id for the same
subject. Before creating `m5gx` the store WAS grepped (`masks`, `masking`,
`step 5`, `fail-fast`, `continue-on-error`) and returned nothing, because
`om30` is worded differently.

**A claim guards a bean ID; it does not guard a SUBJECT.** That is `6ptx`'s
finding, and it caught a session that had filed coordination beans the same
day. `check before you create` cannot work when two agents name one problem
differently and the store matches on words.

## What was salvaged

`om30`'s split widened the hardcode **by hand** — `FAST_JOBS = new
Set(["typescript", "gates"])`. Correct, and its own docblock says *"Chromium …
is the only question this set actually asks"*: a predicate, written out, beside
a literal list of the jobs that happened to satisfy it.

Measured in a clean worktree of `main`: the fast set is **157**, and
`check:dependency-advisories` is absent — a browser-free `bun` gate that
`bun run cat gates` had never run locally at all.

So one piece survives as its own PR: `installsBrowser()`, keyed on
`playwright install`. 157 → 158, the literal is gone, and a future split needs
no hand-widening. The accompanying test assertion — which pinned
`new Set(["typescript", "gates"])`, the same drift one layer out — now asserts
the PROPERTY (bulk jobs present, browser job absent, total well above the 6 the
regression produced), so growth passes and shrinkage still fails. Verified by
simulating the shrink: 158 → 1, four tests red including that guard.

## What this bean established that `om30` did not have to

Before `om30` merged, this branch's own `gates` job caught five rounds of real
staleness that a red `bun test` had been hiding — 4 glossary artefacts, a KG QA
sidecar, 5 `.pot` templates, 2 generated pages, a test pinning a job name, 6
detangle measurements and a skill page, **all from adding one BPMN task**. That
is independent evidence for `om30`'s premise from a second implementation, and
it is the reason this bean is scrapped rather than regretted.

It also corroborated `biz4` from both sides: `om30`'s commits record *"the
pinned value flipped back UP — 229 → 1443"* and *"the pinned number
OSCILLATES"*, and this session committed a polluted value on a confident wrong
argument. Two sessions, same contamination, recorded on `biz4`.
