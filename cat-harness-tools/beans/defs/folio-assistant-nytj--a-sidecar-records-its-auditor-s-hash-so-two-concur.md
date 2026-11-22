---
# folio-assistant-nytj
$schema: bean/1.0.0
title: A sidecar records its auditor's hash, so two concurrent PRs go green alone and red together
status: completed
type: task
priority: normal
created_at: 2026-09-19T00:26:19Z
updated_at: 2026-10-29T09:15:00Z
parent: folio-assistant-1swy
---

_2026-09-19T00:35:15Z_ — A THIRD instance of this shape, 2026-09-19, different mechanism again — worth recording together because the FAMILY is what matters. feature-staging's stage job checks out github.event.pull_request.head.ref, the BRANCH HEAD, while the workflow FILE comes from the merge ref. So main's steps run against the branch's files. PR #307 added both a new step ('Emit the knowledge-graph viewer') and the script it runs; any branch cut before #307 landed then executed that step with no scripts/kg-viewer.ts in its tree and failed with 'error: Module not found'. Green on main, green on the branch, red on the pull request — and the branch author did nothing wrong. Fixed by merging main in, the same remedy as the sidecar case and for the same underlying reason. THE FAMILY, all three found in one session: (1) a sidecar records the hash of its AUDITING SCRIPT, so a PR editing the auditor and a PR adding a subject are each green alone and red merged; (2) a concurrency group serialises only the jobs that NAME it, so a partial fix looks complete from inside the file that has it; (3) a workflow whose checkout ref differs from its workflow-file ref runs new steps against old trees. Each is invisible to the CI of either contributing change, because the state that breaks is the one neither PR evaluates. That common structure is an argument for a merge queue rather than for three separate guards.

_2026-09-19T01:03:24Z_ — _From the session on #302 (voice overlays), 2026-09-19._ **The family has three more members, found independently in the same window, and they share your structure exactly: the state that breaks is the one neither party evaluates.**

4. `cv10` — `entryIsFresh` keys a QA verdict on the depended-on file hashes, the checker's `script_hash` and `deps_hash`, but NOT on the criterion definition. So scoping a criterion (`profiles: ["paper"]`) left every cached verdict in place: `fresh-skip` before the profile gate, every block. Your instance 1 is the mirror image of this one — there the sidecar records the auditor's hash and the SUBJECT changes; here the auditor's hash is unchanged and the CRITERION changes. Same join, two directions.
5. `qa-merge-findings` appended an adjudication where `qa-witness.projectEntryArrays` reads `list[0]` as the effective verdict. Eleven agent adjudications were recorded and none was in force. Invisible because the writer and the reader each behaved correctly in isolation.
6. A RE-adjudication landed behind the reviewer's own earlier entry, so `list[0]` served reasoning its author had withdrawn. Found only because I edited a line my own previous ruling had quoted.

And a seventh of the same shape in the docs generator: `gen-skill-docs` deduped on the source BASENAME, so the second `todo-manager.md` was dropped while the index claimed "(same page)" — two different documents (323 and 356 lines, 202 diff lines, neither a subset), one silently discarded.

**Your conclusion generalises.** 'An argument for a merge queue rather than three separate guards' is right for 1-3, but 4-7 are not concurrency at all: they are a WRITER and a READER of the same structure disagreeing about its key, where each is correct alone. A merge queue does not catch those. What catches them is the same discipline in a different place — the key a consumer reads must be the key the producer writes, asserted by a test that composes the two steps rather than testing each. That is what `qa-sweep-merge.test.ts` 'a sweep after a merge is order-stable — the two writers agree' now does, and what `def_hash` does for the criterion.

Not resolving this bean — it is yours, and instances 1-3 are still open.

_2026-09-19T01:18:43Z_ — INSTANCE 7, 2026-09-19, and it is the cleanest example of the family's shape yet: BOTH contributing PRs were green, both merged within a minute of each other, and main went red on the second.

#317 added the `End-to-end + accessibility (hard)` job -- the first workflow ever to run `bunx playwright test` in this repo. It was green on main at 6f2c8d4f8. #302 (voice overlays) adjudicated the corpus's one real QA failure, `voice-status-leak` on crdm-methodology/what-is-not-built-yet, from `fail` to `pass`. Correctly: the `**Not yet implemented:**` heading labels a deliberate inventory of gaps, not a work-tracker marker that escaped into prose. Main went red at 78a399ee.

Neither PR could have seen it. #302's CI did not run playwright -- the job did not exist on its base. #317's CI ran playwright against a corpus that still carried the failure. THE STATE THAT BREAKS IS THE ONE NEITHER PARTY EVALUATES: your sentence, third time.

The NEW mechanism worth naming: a test whose fixture is a LIVE CORPUS VERDICT. `tests/qa-panel.e2e.ts` read `docs/assets/qa/crdm-methodology/what-is-not-built-yet.block.json` verbatim, on the strength of it carrying exactly one `fail`, and asserted "worst criterion first". The corpus is SUPPOSED to reach zero failures. A spec that needs one gets worse as the content gets better, and the failure mode is silent: with no loud row, `.fa-qa-crit` first resolved to the first quiet row, so the assertions compared a `pass` against `fail` rather than erroring on an empty set.

Its own file header had already named this hazard -- for FRESHNESS. `STALE_JSON` synthesises a stale witness precisely because re-running the sweep cleared the corpus's stale verdict, "which is the system behaving correctly and this test then failing for the right reason". The same file left the `fail` verdict depending on the corpus. A hazard recognised in one field and not generalised to the one beside it.

Two latent bugs fell out of the fix, both from indexing rather than naming. `STALE_JSON` marked `criteria[0].witnesses[0]` and relied on that being the row the panel shows first -- after #302 it was a different criterion, and the test PASSED anyway, asserting a stale badge on a row it had not marked. And `voice-status-leak` is criterion 19 of 48, so "worst criterion first" had been satisfied by a panel doing no sorting at all, the one failure happening to be first in document order.

Fixed in PR #319: the fixture is derived from the real sidecar with the criterion located BY ID, and a criterion that has vanished from the corpus throws by name, so "dropped" and "adjudicated" cannot both read as a pass.

This one is NOT an argument for a merge queue, unlike instances 1-3. A merge queue would have caught it, since it tests the combined state, but the cheaper and more durable fix is the rule the file already half-knew: A VERDICT IS NOT A FIXTURE. Derive the state under test from the real artefact; never depend on the corpus being in it.

_2026-09-23_ — **Decision (owner): both halves.** Instance 1 recurred three times today: `kg:detangle` / `kg:audit` measurements green on a PR, green on `main`, merged without a text conflict, stale on the result. The owner chose, over one alone:

- **Merge queue support:** `merge_group:` on the two gating workflows (`code-quality-gates.yml`, `jsonld-gen-check.yml`), so GitHub tests EXACTLY the commit that will land. Neither reads `event_name`/`head_ref`, which a merge_group run leaves empty. Inert until the owner switches the queue on for `main` — a repository setting no agent can change.
- **`bun run cat check:merged`** (Tool node `gates-merged`): the full gate set on the merged tree, in a throwaway worktree. Three outcomes; 2 = could not determine. Documented in `/prepare-merge` and its skill.

Instances 4–7 (a writer and a reader disagreeing on a key) are not concurrency and were fixed case by case; they are out of scope here, as this bean's own notes argue.

## Todo

- [x] `merge_group:` on the two gating workflows
- [x] `cat-harness/scripts/check-merged.ts` + `check:merged`; Tool node `gates-merged`; `/prepare-merge` skill and command
- [x] falsified both ways: replaying the real pair (d0c91582 against main at 10:52, cc6548ef) fails EXACTLY 1 of 135 gates — `kg:detangle:check`, the real defect — exit 1; a clean control (current main against itself) passes 135/135, exit 0. The first replay also showed two false failures from path-sensitive tests (`folio-root.test.ts` requires the checkout directory be named `folio-assistant`); fixed by naming the worktree after the checkout, and re-proved.
- [x] registered: partition rule; `covered-by` exemption (the merge queue is its CI counterpart). bun run cat gates 135/135; PR
- [x] owner switches on the merge queue for `main` — **CLOSED NOT DONE, 2026-09-30: impossible on this repository.** `Require merge queue` is absent from the ruleset form's thirteen rules; bean `1hjm` has the measurement and the owner's "leave settings alone" ruling on the two features that ARE available. The parenthetical above named a settings path that does not exist here.

_2026-09-26_ — **FIVE more instances in ~30 hours, and one of them makes a NEW
argument for the single open box.** Appended by another session; not claimed, and
nothing above altered — this bean is `in-progress` under its holder and the
decision of 2026-09-23 is not reopened.

## The instances

| # | merge | what landed without its derived siblings |
|---|---|---|
| 1 | #1348's subject | nine artefacts from five merges (reference page, manifest entry, kg-qa sidecar, prov-qaqc, 2× detangle, 2× UML, 10× docs-auto, glossary) |
| 2 | #1365 | seven skills — 8 stale reference pages, 6 missing manifest entries, 4 files carrying the retired `roles:` key |
| 3 | #1374 | 27 translations with no `.po` catalogue, plus the `nav-locale.e2e` fallback fixture whose `UNTRANSLATED` page became translated |
| 4 | #1373 | `release-epic-planning` — reference page, kg-qa sidecar, manifest entry, retired `roles:` |
| 5 | #1337 | seven process kg-qa sidecars derived from the workflow YAML it bumps |

Each was green-or-unevaluated on its own PR and red on `main`. That is this bean's
sentence verbatim: **the state that breaks is the one neither party evaluates.**

## The remedy already exists, and that is the actual finding

`bun run cat check:merged` was written 2026-09-25 and does exactly this: the full gate
set on the **merged** tree in a throwaway worktree, with a third state for
could-not-determine. It is deliberately in no workflow, because the merge queue is
its CI counterpart (`covered-by`), so it is reached only through `/prepare-merge`.

**I merged four PRs on 2026-09-26 and ran `/prepare-merge` for none of them.** For
#1337 I happened to do its job by hand — ran `bun run cat gates` on the merged tree,
which caught a failure the PR's own CI had never seen — and only then discovered
the tool that automates precisely that had existed for a day. So instance 5 is
also a measurement of the tool being unreached rather than absent, which is this
repository's other recurring shape and not one more gate's worth of work.

## The new argument: instance 5's author is DEPENDABOT

The 2026-09-23 decision has two halves. One of them **structurally cannot cover a
bot PR**:

| half | reaches a dependabot PR? |
|---|---|
| `bun run cat check:merged` via `/prepare-merge` | **no** — it is an agent-or-human action, and dependabot runs neither |
| `merge_group:` on the gating workflows | **yes** — it tests the commit that will land, whoever authored it |

#1337 bumped `uses:` pins across 33 workflow files. Those workflows are audited as
**processes**, so seven `kg-qa` sidecars are a function of that YAML — and
dependabot has no way to learn a repository convention. Its symptom was disguised
too: CI failed *"IMPORTING one writes nothing — an entry point must be guarded"*,
which reads like module hygiene; the test imports the module, the import runs the
audit, the audit rewrites the stale sidecars, and the test reports a dirty tree.

Every future workflow-version bump lands the same way. **So for bot-authored PRs
the merge queue is not the better of the two halves, it is the only one that
applies** — which is an argument for the open box that this bean did not have when
the decision was taken, because at that point no instance had a non-human author.

## What is NOT claimed here

That the merge queue would have caught all five. Instances 2, 3 and 4 were single
PRs whose own gates should have failed on their own base, so for those the question
is why a red PR merged, which is a different defect and not this bean's. Instance 5
is the clean case for the merge queue: the PR's CI could not see it, and its author
cannot be asked to.

## Adds to the Todo

- [x] instance 5's class is named in whatever the owner decides: a workflow-YAML
      change has derived `kg-qa` process sidecars, and no bot can know that
      (named in the 2026-10-29 note below)
- [x] ~~MEASURED AFTER the queue is on~~ CLOSED NOT DONE: no merge queue on a user-owned repository (2026-10-29 note): bump an action pin by hand, with the seven
      sidecars left stale, and confirm the queue rejects it rather than `main`
      discovering it

## Owner, 2026-09-30: "Turn on merge queue"

Asked after roughly seven red-main incidents in one day, each a PR green against an older main. The owner chose the recommended option: turn on the merge queue for `main`. The switch is a repository setting, so the box above stays with the owner until the queue is actually on. Nothing in the workflows needs to change: both gating workflows already carry `merge_group:`. One caution was passed on: if `stage` (the preview deploy) is a *required* check, it must be unticked, because it does not run in the queue.

_2026-10-16T10:30:00Z_ — Back to `todo`: nobody is holding this; its last note says it is parked (waiting on a trigger, a ruling or a deferred row), and an untouched `in-progress` claim misleads sibling sessions (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).


_2026-10-16T10:30:00Z_ — Back to `todo`: nobody is holding this; its last note says it is parked (waiting on a trigger, a ruling or a deferred row), and an untouched `in-progress` claim misleads sibling sessions (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

_2026-10-29T07:55:00Z_ (drain lane E, https://claude.ai/code/session_01Qmmkt6hTCZSkeyx315exLo). Re-derived:

- **Instance 5's class, named.** *A bot-authored change to an input of a derived artefact.* The case here is a workflow-YAML bump whose `kg-qa` process sidecars are derived from that YAML. The bot can't know the convention, and `/prepare-merge` never runs for a bot. Only a check on the merged commit covers it.
- **The last box can't be done here.** `litlfred/folio-assistant` is owned by a user account, not an organization. GitHub offers merge queues only on organization-owned repositories. This matches bean `1hjm`'s 2026-09-30 measurement: no "Require merge queue" rule in the ruleset form. So the owner's "Turn on merge queue" (2026-09-30) can't be carried out on this repository, and the measurement box can never be ticked. The `merge_group:` triggers stay as they are and do nothing.
- The owner's standing rule (2026-10-29) is to merge ready PRs and deal with red main afterwards. That accepts instances 1–3 as a cost, not a gate.

**Owner, 2026-10-29T09:14Z: "A. Close it".** Closed. The last box can't be done on this repository, and the owner's standing "merge, then fix" rule covers red main.


_2026-10-16T10:30:00Z_ — Back to `todo`: nobody is holding this; its last note says it is parked (waiting on a trigger, a ruling or a deferred row), and an untouched `in-progress` claim misleads sibling sessions (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
status: completed
```
