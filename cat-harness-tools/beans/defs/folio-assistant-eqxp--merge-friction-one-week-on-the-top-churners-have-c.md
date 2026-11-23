---
# folio-assistant-eqxp
$schema: bean/1.0.0
title: 'MERGE FRICTION, one week on: the top churners have changed and four more pass 1swy''s test'
status: completed
type: task
priority: normal
created_at: 2026-09-30T23:35:24Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-1swy
---

Follow-on to `1swy` / `oxka`, which added the first `.gitattributes` and, more
importantly, the TEST for what may go in it. Nothing here revises that test —
it applies it to a corpus that has moved.

## Why re-measure at all

`oxka` measured over three days ending 2026-09-24 and marked the three files it
found. Measured again 2026-09-30 over `origin/main`'s last 200 commits, **the
top of the table is no longer those three**:

| commits | path | marked by `oxka`? |
|---|---|---|
| 29 | `cat-harness/test/results/lsi/cat-harness/skills.lsi.json` | no |
| 26 | `cat-harness/test/results/skill-register.qa-results.json` | no |
| 21 | `beans/README.md` | no |
| 17 | `cat-harness/docs/glossary/index.md` | **yes** |
| 17 | `cat-harness/docs/_data/harness.json` | no |
| 15 | `cat-harness/docs/lsi/index.md` | no |
| 11 | `cat-harness/test/results/audit-coverage.qa-results.json` | **yes** |
| 10 | `cat-harness/test/results/tool-runs/lsi-index/cat-harness/skills.tool-run.json` | no |
| 10 | `cat-harness/test/results/subgraph-readmes.qa-results.json` | no |

**50 of the 60 most-churned paths are generated**, and the ten that are not
include four generated-with-markers READMEs the classifier's five-line window
missed. So the entry is not stale in the sense of being wrong — it is stale in
the sense of having been sized to a distribution that moved.

## The measured cost, on one branch

PR #1633, 2026-09-30: **22 merge cycles**. Conflicts across three consecutive
cycles, hand-recorded:

- cycle 20 — 12 conflicts, **11 generated**, 1 hand-authored (`WRITER_OVERRIDES`)
- cycle 21 — 7 conflicts, **7 generated**, 0 hand-authored
- cycle 22 — 6 conflicts, **6 generated**, 0 hand-authored

25 conflicts, 24 of them on files regenerated from the whole corpus anyway. The
single real one needed judgement (both sides had added distinct map entries and
the resolution was a union). That ratio is the argument: the mechanical
conflicts are not merely cheap to resolve, they are **crowding out attention**
from the one that was not.

## Candidates, each against `1swy`'s actual test

The test is NOT "is it generated" but **"does its producer carry anything
forward from the existing file"**. Checked by reading the producer, not by
pattern:

- **`cat-harness/test/results/skill-register.qa-results.json`** — written through
  `writeQaResult` (`scripts/qa-results.ts`). It DOES `readFileSync` the prior
  document, which looks disqualifying, and is not: the prior is used only as
  `key(prior) === key(result)` to skip a pointless write, and nothing from it
  reaches the output. Same category as `audit-coverage.qa-results.json`, already
  marked. **Passes.** Gated by `skill:register:check`.
- **`cat-harness/test/results/subgraph-readmes.qa-results.json`** — same writer.
  Passes if the same reading holds; VERIFY the producer individually rather than
  by family, which is the mistake this bean exists to avoid.
- **`cat-harness/test/results/lsi/.../skills.lsi.json`** — **now cleared, and
  the first reading was wrong.** The `readFileSync` at `lsi.ts:347` is inside
  `graphVerdict`, which is the *auditor* judging freshness, not the producer.
  The producer is `index()` (line 225): it composes the sidecar wholly from
  `unitsOf(...)`, the computed index, and `opts` — a PARAMETER defaulting to
  `DEFAULT_OPTS` — and never opens the existing file. **Passes.**
  One caveat to carry into the entry rather than omit: `options` is recorded
  FROM the invocation, so if a graph were ever indexed with non-default options
  and only the sidecar recorded that, a resolution taking the wrong side would
  switch them silently. The gate rewrite repairs it, as for every other entry,
  but the gate must be named before marking.
- **`cat-harness/test/results/tool-runs/lsi-index/.../skills.tool-run.json`** —
  `writeToolRun` (`schemas/tool-run.ts:106`) composes the body from its
  argument and reads the existing file only as
  `readFileSync(p) === body` to skip a pointless write. Nothing carried
  forward. **Passes.**

That the first pass got `skills.lsi.json` wrong is the point of the test, not a
digression: a grep for `readFileSync` in the producing MODULE answers a
different question from "does the producer carry anything forward", and the
two come apart exactly where a file has both a writer and an auditor in one
file.
- **`beans/README.md`**, **`cat-harness/docs/_data/harness.json`**,
  **`docs/lsi/index.md`**, the subgraph READMEs — unexamined here.

## Done when

Each path proposed for `.gitattributes` has its producer READ and the
carry-forward question answered in writing, a CI gate named that would redden a
wrong resolution, and a case added to `scripts/tests/gitattributes.test.ts`.
A path that cannot clear all three stays out. **No glob over
`cat-harness/test/results/**`** — `kg-qa` sidecars carry attestations, and that
exclusion is the whole discipline of `1swy`.

## What this bean is NOT

Not a merge driver. `oxka` rejected `merge.*.driver` because it is per-checkout:
it would work in one clone and nowhere else, CI included. Unchanged.

Not the landing-race fix for #1633 either. A conflicted PR creates no
`pull_request` run at all (bean `52cz`), so fewer conflicts shortens each cycle
but does not by itself win the race against a base moving 10-25 commits per
cycle. The owner chose to keep cycling rather than enable a merge queue; this
reduces the cost of each cycle, not their number.

## A churn amplifier the table does not show

The L1 verdict sidecars under `test/results/library-qa/` do not appear in the
200-commit table above, and they went stale **three times in one evening**
(2026-09-30, PR #1633 cycles 21-23). Each sidecar records a `script_hash` of
its producer, so **every edit to `check-l1-complete.ts` invalidates every
sidecar it has ever written**, corpus-wide, whatever the corpus did:

    30689f8902dd  ->  9129552c7b5d  ->  70c41a3630ab

That is the field working as designed — a verdict produced by a different
script version genuinely is a different verdict — but it means producer churn
multiplies into artefact churn by the size of the library, not by the size of
the change.

**And `regen` cannot repair it, by construction rather than by omission.**
The repair is `check:l1-complete -- --write`: the writer is the SAME script
under a flag, while `WRITER_OVERRIDES` maps a gate name to a writer's *script
name*. There is no spelling of `-- --write` in that map. So `regen` reports a
clean fixed point over a stale gate — the exact failure `uju6` was opened for,
reached by a different route. `check:l1-complete -- --check` IS in the gate
set (observed in a 194-gate local run), so this reddens CI.

Two candidate directions, neither chosen here: teach `regen` flag-bearing
writers, or drop `script_hash` in favour of what `y7b3` did for `updated_at`
(#1714 removed the timestamp from qa-results for precisely this
collision reason). The second is not obviously right — the hash carries
information the timestamp did not.

## A candidate the churn table recommends and the TEST refuses

`beans/README.md` is the third-most-churned path (21 of 200 commits), and it
conflicted in merge cycles 20, 21, 22, 23 and 27 of PR #1633 — more often than
any other single file. On 2026-10-01 it closed a merge window **by itself**:
CI was 13 checks green with nothing red, and `git merge-tree` reported exactly
one conflicting path, this one.

So it looks like the strongest candidate in the table. **It fails.**

It is written by `scripts/subgraph-readmes.ts` BETWEEN
`<!-- kg:subgraph:begin -->` and `<!-- kg:subgraph:end -->`. A marker-scoped
generator carries forward everything outside its markers by construction —
that is what the markers are FOR. `-merge` on such a file discards one side
whole, so any prose a person had written below the marker would go with no
diff to notice and no gate to catch it, since the gate
(`readme:subgraphs:check`) only ever looks between the markers.

Today `beans/README.md` happens to hold nothing outside them: 14 lines,
markers at 1 and 14. That is not a reason to mark it. **`.gitattributes` is a
standing declaration and the test is about the PRODUCER's contract, not the
file's current contents** — the entry would be a trap armed for whoever first
adds a paragraph.

The same disqualifies every other marker-scoped README, which is most of the
"authored-looking" rows in the table above: `cat-harness/test/README.md`,
`scripts/README.md`, `skills/README.md`, `uml/README.md`,
`test/results/README.md`.

This is also, in retrospect, why `oxka` chose the three it did. All three are
WHOLE-FILE generators — `docs-auto/**`, `glossary/index.md`, and
`audit-coverage.qa-results.json`, whose producer reads the committed copy only
to compare. The distinction `1swy` drew is not "generated vs authored" and not
even "does the producer read its output", but **does the producer carry
anything forward** — and a marker is a carry-forward mechanism wearing the
costume of a generated file.

**Consequence for this bean's own proposal:** of the candidates listed above,
the marker-scoped ones are struck. What survives is the whole-file set —
`skill-register.qa-results.json`, `skills.lsi.json`,
`skills.tool-run.json` — each already cleared by reading its producer. The
remaining churn from marker-scoped READMEs needs a different answer, and this
bean does not have one.

## CORRECTION, 2026-10-01 — two claims in this bean were wrong

Both were found by measuring what the bean had only reasoned about. They are
left above as written and corrected here, because a bean that quietly edits its
own history teaches the next agent nothing.

### 1. `-merge` does not reduce the NUMBER of conflicts

This bean claimed that with the proposed entries, merge cycle 26 "would have
carried two conflicts rather than five". **That is false.**

Measured in a scratch repository: with `gen.json -merge`, a merge in which both
sides changed that file exits **1** with the path **unresolved**. Git declares
a conflict and leaves OURS as the tentative result. That is what the attribute
is specified to do, and what `oxka` actually claimed — *"The conflict is then
ONE clean conflict to resolve by regenerating, rather than markers buried
inside a megabyte"*.

So the benefit is real but narrower than stated: a clean whole-file conflict
instead of inline markers in generated output, and a collapsed diff in review.
**Removing these conflicts, rather than tidying them, requires the files not to
be on `main` at all.**

### 2. Two of the three "cleared" candidates FAIL, on the half this bean skipped

`oxka`'s entry is safe on **three** counts, not one: the producer carries
nothing forward, a CI gate reddens a wrong resolution, and a case holds the
line in `gitattributes.test.ts`. This bean checked only the first and called
the paths cleared. Checking the second, by corrupting each committed file and
running its gate:

| path | carries forward | gate reddens | verdict |
|---|---|---|---|
| `tool-runs/lsi-index/.../skills.tool-run.json` | no | **yes** — `lsi:skills:check` 0 → 1 on a bad `inputFingerprint` | **marked** |
| `skill-register.qa-results.json` | no | **no** — `skill:register:check` exits 0; 66 unit tests pass | refused |
| `lsi/.../skills.lsi.json` | no | **no** — `lsi:skills:check` exits 0 | refused |

`skills.lsi.json` is the instructive one. `lsi:skills:check` *looks* like its
gate and is not: it validates the RUN RECORD's `inputFingerprint` — corrupting
which does exit 1 — and never reads the sidecar's own contents. The two files
sit two directories apart and only one of them is guarded.

Both refusals are now asserted in `gitattributes.test.ts`, with the
measurements, so the next agent reaching for them has to overturn evidence
rather than an opinion.

### What this leaves

One entry added. The churn this bean set out to reduce is **not** reduced by
`.gitattributes` in any case, per correction 1 — which makes the owner's
proposal of moving QA reports off `main` to a content-addressed orphan branch
the only route on the table that removes these conflicts rather than tidying
them. That is written up separately; this bean's remaining value is the
measurements and the three negative results (`beans/README.md` and these two).


_2026-10-01_ — Now feeds arc `3fva` (issue #1763, `cat-harness/docs/proposals/qa-reports-branch-and-test-process-2026-10-01.md`).

## Closed 2026-10-09

Work completed and merged in PR #1746 (commit `9965be8b39c4b2b36efe18361c034aa88024466f`, merge commit `512730477118`):
- Added entry for `skills.tool-run.json` to `.gitattributes`.
- Refused `skill-register.qa-results.json` and `skills.lsi.json` with recorded test evidence.
- Tested: `bun test cat-harness-tools/test/coordinator/gitattributes.test.ts` (7 pass, 0 fail, 25 assertions).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Reasons for Scrapping

Obsolete after the separation (lane B drain, 2026-10-10). The bean re-measured churn in the **monorepo's** `origin/main`, and that distribution no longer exists in any one repository:

- The top churners were `cat-harness/test/results/**` (LSI, skill-register, audit-coverage, tool-runs, subgraph-readmes). Derived results left main entirely: they are gitignored and published to `qa-reports` (`5hox`, arc `3fva`), so they cannot conflict.
- `beans/README.md`: beans now live on `cat/<harness>/beans` state branches, not on main.
- `cat-harness/docs/**` (glossary, `_data/harness.json`, lsi): those paths are in litlfred/cat-harness, and whether its generated docs stay on main is `34cm`'s open decision in that store.

If merge friction recurs, it should be re-measured per repository against that repository's own `.gitattributes`, with 1swy's three-part test applied unchanged. That would be a new bean in the store of whichever repository it is.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: PR #1746 merged 2026-10-01 (the .gitattributes entry and two refusals); both outcomes are closed, completed is what the evidence shows. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


## Closed 2026-10-09

Work completed and merged in PR #1746 (commit `9965be8b39c4b2b36efe18361c034aa88024466f`, merge commit `512730477118`):
- Added entry for `skills.tool-run.json` to `.gitattributes`.
- Refused `skill-register.qa-results.json` and `skills.lsi.json` with recorded test evidence.
- Tested: `bun test cat-harness-tools/test/coordinator/gitattributes.test.ts` (7 pass, 0 fail, 25 assertions).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Obsolete after the separation (lane B drain, 2026-10-10). The bean re-measured churn in the **monorepo's** `origin/main`, and that distribution no longer exists in any one repository:

- The top churners were `cat-harness/test/results/**` (LSI, skill-register, audit-coverage, tool-runs, subgraph-readmes). Derived results left main entirely: they are gitignored and published to `qa-reports` (`5hox`, arc `3fva`), so they cannot conflict.
- `beans/README.md`: beans now live on `cat/<harness>/beans` state branches, not on main.
- `cat-harness/docs/**` (glossary, `_data/harness.json`, lsi): those paths are in litlfred/cat-harness, and whether its generated docs stay on main is `34cm`'s open decision in that store.

If merge friction recurs, it should be re-measured per repository against that repository's own `.gitattributes`, with 1swy's three-part test applied unchanged. That would be a new bean in the store of whichever repository it is.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: PR #1746 merged 2026-10-01 (the .gitattributes entry and two refusals); both outcomes are closed, completed is what the evidence shows. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.



## Reasons for Scrapping

Obsolete after the separation (lane B drain, 2026-10-10). The bean re-measured churn in the **monorepo's** `origin/main`, and that distribution no longer exists in any one repository:

- The top churners were `cat-harness/test/results/**` (LSI, skill-register, audit-coverage, tool-runs, subgraph-readmes). Derived results left main entirely: they are gitignored and published to `qa-reports` (`5hox`, arc `3fva`), so they cannot conflict.
- `beans/README.md`: beans now live on `cat/<harness>/beans` state branches, not on main.
- `cat-harness/docs/**` (glossary, `_data/harness.json`, lsi): those paths are in litlfred/cat-harness, and whether its generated docs stay on main is `34cm`'s open decision in that store.

If merge friction recurs, it should be re-measured per repository against that repository's own `.gitattributes`, with 1swy's three-part test applied unchanged. That would be a new bean in the store of whichever repository it is.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: PR #1746 merged 2026-10-01 (the .gitattributes entry and two refusals); both outcomes are closed, completed is what the evidence shows. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
