---
# folio-assistant-8v0y
$schema: bean/1.0.0
title: A bean that RESTATES a live skill's contract is unchecked — kn0t drifted in four places and one turned a measurement into an impression
status: completed
type: feature
priority: normal
created_at: 2026-09-23T21:07:00Z
updated_at: 2026-09-24T05:54:13Z
parent: folio-assistant-1xhc
---

Issue [#1190](https://github.com/litlfred/folio-assistant/issues/1190).

A bean that carries a **skill's contract** instead of pointing at it. `AGENTS.md`'s
banner already states the rule — *where a skill and a copy disagree, the skill wins
and the copy is wrong* — and nothing could read it.

## The defect, already paid for

`kn0t` held a second copy of
[`fhir-harness/skills/fhir-ig-base/ig-publisher-reduction.md`](../../../fhir-harness/skills/fhir-ig-base/ig-publisher-reduction.md).
It had drifted in four places; the P1 exit criterion turned *"the derived navigation
is **diffed**, and the difference is empty or explained entry by entry"* into
*"navigation matches the Publisher's"*. **"Matches" is an impression; a diff that is
empty or explained entry by entry is a measurement.** Approving the weaker wording
would have let a phase be declared done on an impression — the first entry in that
skill's own **Do not** list. Repaired in PR #1185 by removing the restatement.

## The dead end, recorded so nobody re-enters it

Text similarity was tried first and it failed. Handed over as measured:

| attempt | result |
|---|---|
| beans naming a skill + carrying a table | 327 hits — skill names here include `diff`, `patterns`, `conventions`, so it counted ordinary English |
| beans sharing a 10-word run with a skill | 254 beans. Real copied prose, but a bean that CREATED a skill shares prose legitimately |
| near-match sentence pairs, Jaccard 0.55–0.95 | 134 "candidates", almost all normaliser artefacts |

**Decisive:** `kn0t`'s three real drifts score Jaccard **0.25, 0.54, 0.33** — all
below the floor. The detector would have caught none of the defect it was built for.
Structural, not a threshold: semantic drift is a *rewrite*.

## What was measured here, 2026-09-23 — 888 beans, 254 open

The specification named four criterion shapes. **Three do not survive measurement:**

| candidate shape | measured | verdict |
|---|---|---|
| heading `## Proposed phases` | **0** occurrences | generalised from `kn0t`'s one instance |
| heading `## Rules` | **0** occurrences | same |
| the word `invariant` | 34 beans (7 open), every open one ordinary prose | pure false positive |
| a line matching `exit criterion` | 2 beans — **one is `kn0t` AFTER its repair**, five times | fails on its own negative fixture |

A bare criterion-column rule flags 8 beans and **none is a restatement**: four are
exit-**code** tables (`3pqn`, `6f1x`, `35nj`, `zzar` — this repo documents 0/1/2 exit
status in a table, so `| exit |` is the house idiom), four name QA criteria as
identifiers in code the bean is building (`3kbd`, `m4zg`, `py74`, `5xfr`).

**What `kn0t` had and none of them does** is a first column enumerating *named units
of a plan*, each row carrying that unit's own exit condition:
`| phase | does | exit criterion |` over rows `P0`…`P4`. That is the rule.

| | |
|---|---|
| flagged over the whole store | **0 of 888** |
| flagged on `kn0t` before PR #1185 | **1 of 1** |
| flagged on `kn0t` after PR #1185 | **0** |

## The conjunction in the specification is FALSIFIED

It said *"a bean that **references a skill by path** should not also carry a criterion
block"*. **The pre-repair `kn0t` references no skill by path at all**, and the skill
existed at that commit (`git cat-file -e f8ed0c1a^:…` — it did). Requiring the pointer
as a *condition* reproduces the Jaccard failure exactly. So the pointer is reported as
context and changes the **remedy**, not the verdict: names a skill → delete the copy,
keep the link; names none → the contract has no home yet, and that is the worse case.

## False-positive rate, against the candidate set

The ≥25-shared-10-word-run set was **re-derived rather than taken at 38**: over 254
open beans against 280 skill files it is **23**, and stable at 23 across five
derivations (with/without the generated `skill-instructions` mirror, with/without the
archive, with/without front matter). It moves only by widening to closed beans
(77) or to closed + the mirror (95), which is the likeliest source of the 38.

**The structural rule flags 0 of the 23.** Hand-read of the highest-overlap
candidates — `xies` (207), `hajp` (117), `lqo9` (100), `jut3` (44, `kn0t`'s nearest
relative) — finds every one a legitimate outcome record: owner quotes, shipped-round
notes, measurement tables with provenance. `jut3`'s tables are counts, not contracts.
No false negative surfaced. **FP rate 0/23 and 0/888, so it is wired as a hard gate
rather than `kind: "report"`** — and a `report` registration would be wrong for a
second reason: that kind exists for *"CI cannot obtain its input"*, and this check's
input is the committed bean store, always present.

## Reconciled against the sibling hand-check (PR #1188, bean `ekp9`) — 2026-09-23

`ekp9` works a deliberate **superset**: `beans/defs/**` including `archive/`, every
status except `scrapped`. It reports 51 at the `>=25` threshold; that recipe run with
this session's tokeniser gives **94**, so the two tokenisers differ — which `ekp9` had
already found against the session before it, and is the argument it makes for
classifying by reading rather than by score.

**The structure reconciles cleanly even though the counts do not:**

| | |
|---|---|
| my 23 is a strict subset of the superset | **yes** |
| beans in the superset but not mine | **71** |
| …of which `completed` | **53** |
| …of which `completed` + archived | **18** |
| …of which `todo` / `in-progress` / `draft` | **0** |

**There is no disagreement about any live bean.** The whole difference is closed
beans, which this check ignores deliberately — `check:bean-parents` and
`check:bean-bodies` ignore them for the same reason: a finished bean is history, and
back-filling it changes no plan.

**The open reconciliation is a false-NEGATIVE one, and it is not closable yet.** This
rule flags 0 over all 888 beans, closed included. So if `ekp9`'s reading finds a
restatement anywhere in its 94, this rule missed it and the rule is what gets fixed.
`ekp9`'s classification lands in later commits and is not published yet.

## Not built, and why

**No `## Done when` detector.** 607 of 888 beans carry one (180 of 254 open); it is
the house shape for a work plan and `opening-brief.md` asks for it. Flagging one that
"restates the skill's criteria rather than naming the work outstanding" is a judgement
about MEANING — the dead end above wearing a different hat.

**No artefact-verification declaration.** `deriveArtefactChecks` selects scripts whose
command contains `--check`; this one writes no artefact and carries no such flag, so it
is not a generated-artefact check. `bun run cat check:artefact-verification` passes
unchanged. An entry would be a declaration about a file that does not exist.

**It repairs nothing.** Same rule as `check:bean-bodies` and `bun run cat health`: the
finding names something the bean's OWNER does.

## Done when

- [x] `cat-harness/scripts/check-bean-restates-skill.ts`, wired as `check:bean-restates-skill`
- [x] the rule verified against BOTH states of `kn0t` — flags before #1185, clean after
- [x] false-positive rate measured before wiring it hard (0/23 candidates, 0/888 store)
- [x] tests over synthetic trees only — nothing walks `beans/`, after a prior session's
      real-tree tests pushed a sibling past its 5 s timeout
- [x] registered in `.github/workflows/code-quality-gates.yml`, so `gates.ts` derives it
- [x] the sibling hand-check reconciled — **DONE 2026-09-24, and it went against this
      rule.** `ekp9` read 50 candidates and found **3 live restatements this rule does
      not flag and cannot**: `xies` (prose + a `| stage | here |` status table), `tfo1`
      (a bulleted constraint list and the refuse-vs-warn split), `lqo9` (the SKOS
      mapping and a measurement block). None is a phase table with a per-row exit
      condition, so no tightening reaches them; reaching them means reading MEANING,
      which is the Jaccard dead end. **Recorded in the module docs and reflected in the
      clean line**, which says *"no open bean carries a phase-contract table"* and
      deliberately not *"no bean restates a skill"* — a green that reads wider than
      what was measured is the `dh4f` defect
- [x] `ekp9` point 4 applied — **the report now names a disagreement, never a
      direction.** It measured 5 drifted pairs and found the **skill** wrong in 3
      (`hajp`, `g196`, `06e3`), so *"Delete the copy"* would have sent somebody to edit
      the correct text. Two tests pin it
- [x] `ekp9`'s calibration finding recorded: `kn0t` pre-repair shares only **22**
      ten-word runs with its skill, below the `>=25` threshold — so the candidate set
      never contained the calibration case. *The more dangerous a restatement is, the
      fewer shingles it shares*, because drift is what destroys the overlap. The
      false-positive figure that survives is the unconditional 0 of 888
- [x] owner's call on whether the gate's narrowness is right — **SETTLED 2026-09-24:
      ship as is.** Asked as a five-column comparison of four options (ship as is /
      widen to a bulleted phase list / downgrade to `kind: "report"` / defer to the
      sibling's reading), recommendation marked, default stated. Owner chose **ship as
      is**. So the gate stays ONE shape with one worked example, and widening later is
      additive — one predicate plus tests. The option deliberately argued against was
      widening now: a bulleted-phase-list detector has **zero** live instances, which is
      the same evidence-free surface three of the brief's four shapes were rejected for

## Summary of Changes

Shipped in PR #1191, merged `e5cf533d`.

`cat-harness/scripts/check-bean-restates-skill.ts`, wired as
`check:bean-restates-skill` and registered in
`.github/workflows/code-quality-gates.yml` so `gates.ts` derives it — a hard
gate, not `kind: "report"`, because the false-positive rate measured 0.

**The rule is structural, and that was forced by measurement rather than
chosen.** A phase-contract table: a criterion column that is not an exit-**code**
column, over rows enumerating named units of a plan. 0 of 888 beans in the
store, 1 of 1 on `kn0t` before PR #1185, 0 after. Three of the four criterion
shapes in the original brief were rejected against the corpus — `## Proposed
phases` and `## Rules` occur zero times, `invariant` is ordinary prose in every
open hit, and a line matching `exit criterion` flags `kn0t` AFTER its repair.
The brief's conjunction was falsified too: pre-repair `kn0t` names no skill by
path at all, so requiring the pointer as a condition would have caught none of
the defect the gate exists for.

22 tests over synthetic trees and literal strings; nothing walks `beans/`.

**What it does not reach, named rather than passed over.** `ekp9`'s hand-check
found 3 live restatements this rule cannot flag — `xies`, `tfo1`, `lqo9` — none
of them a phase table. The clean line therefore claims only *"no open bean
carries a phase-contract table"*. Their point 4 also corrected a real defect
here: the report no longer says "delete the copy", because they measured the
SKILL wrong in 3 of 5 drifted pairs.

**Follow-up worth its own bean, not opened here:** `ekp9` §"AGREEMENT IS NOT
CORRECTNESS" names a class no bean-vs-skill rule reaches — `lqo9` and
`swimlane-glossary` both say *"157 task-containing lanes"* where
`check:lane-documentation` measures **182**; `s8mo` and `session-context` both
say *"the six fields"* where `SessionContextSchema` has **8**. A check
comparing a prose count against a command's output would catch these. That is a
different check, and the owner chooses whether it is wanted.
