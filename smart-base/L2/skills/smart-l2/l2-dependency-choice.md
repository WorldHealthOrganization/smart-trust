---
name: l2-dependency-choice
description: >
  Stage 3 of smart-guideline-end-to-end: choose which existing DAKs (WHO's, or
  a jurisdiction's adaptation) the guideline builds on. From the L1 knowledge
  graph and any known candidates, one decision row per candidate DAK —
  reuse, adapt, extend or reject, with evidence and a reason — laid out as a
  decision-comparison table and put to the adjudicators as a DecisionRequest.
  Also defines the dependency decision row that stage 5
  (l3-dependency-choice) uses at L3. Read before choosing, or recording, a
  DAK dependency.
input: L2/schemas/skills/l2-dependency-choice/input.schema.json
output: L2/schemas/skills/l2-dependency-choice/output.schema.json
---

# l2-dependency-choice

> Skill id: `l2-dependency-choice` · Package: `authoring-who-smart-guidelines` ·
> Stage 3 of [`smart-guideline-end-to-end`](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md),
> task `Task_DepsL2` of
> `smart-guideline-end-to-end.bpmn` (opt-in `smart-base.collab`).
> Adjudicated by the programme manager and the business analyst.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/l2-dependency-choice/input.schema.json) and [`output.schema.json`](../../schemas/skills/l2-dependency-choice/output.schema.json).

- **In:** stage 2's `l1Kg` ([`recommendation-extraction`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/recommendation-extraction.md)'s output), and the candidate DAKs already known (`candidates`: `packageId`, `version`, `uri`, `publisher`).
- **Out:** `l2Dependencies`: one `dependencyRow` per candidate, rejected ones included, the `gaps`, the `comparison` table and the `decisionRequest`. Stage 4 ([`l2-dak-authoring`](l2-dak-authoring.md)) takes it as its `l2Dependencies`.

## The decision row

| field | from | meaning |
|---|---|---|
| `packageId`, `version`, `uri` | cat-harness `DependsOnRecord` (`cat-harness-tools/schemas/kg/depends-on.ts`), the same three fields as FHIR `ImplementationGuide.dependsOn` | the candidate DAK (or, at stage 5, IG). A candidate missing one of the three is a `DependsOnGap`, listed in `gaps`, not a row |
| `publisher`, `upstream` | — | WHO, or the adapting jurisdiction; for an adaptation, the WHO original it adapts |
| `evidence` | smart-base KG `evidence` (`smart-base/L1/schemas/graph.ts`) | the L1 KG nodes (and, at L3, the L2 assets) that point at it |
| `decision` | this skill | `reuse` (unchanged) · `adapt` (fork and change) · `extend` (depend and add) · `reject` |
| `reason` | this skill | one sentence; required for `reject` |
| `components` | — | what is taken, piece by piece: DAK components here, profiles, value sets and libraries at L3 |
| `toolchain` | this skill | on each component reused, adapted or extended: how the candidate produces it — a Tool id from `bun run cat check:tools`, or a script in the candidate's own repository (its source spreadsheet, converter, CQL refresh, test format), found by the search in [`smart-base-tools`](../../../skills/content/authoring-who-smart-guidelines/smart-base-tools.md) §*Adapting a DAK*. Stages 4 and 6 produce the component with that toolchain. `none` only after that search came back empty, naming where it looked; the new tool is then a Tool node, never a script in the adaptation repository |

Only `decision`, `reason` and `toolchain` are new. Once adjudicated, a
`reuse`, `adapt` or `extend` row becomes an ordinary dependency: the DAK's
own reference at L2, a `dependencies:` entry in `sushi-config.yaml` at L3.

## Steps

1. **Find the candidates.** Start from `candidates`, and add each DAK whose
   Component 1 the L1 KG's `implementedBy` / `realises` edges reach.
   For each, find how it produces each component it would give
   ([`smart-base-tools`](../../../skills/content/authoring-who-smart-guidelines/smart-base-tools.md) §*Adapting a DAK*): that is
   the component's `toolchain`, which stage 4 uses.
2. **Reuse first** (`recommendation-extraction`'s precedence): reuse an
   existing asset, then adapt one, and create only when neither fits, with
   a `WARNING` saying none fitted. The same holds for the **tooling** that
   makes an asset: an adapted decision table is an edited copy of the
   upstream's source spreadsheet run through the upstream's converter, not
   a table re-typed in a new format with a new converter. Prefer the
   jurisdiction's adaptation over the WHO original for the same scope, since
   it already holds the local decisions, and record the WHO original as
   that row's `upstream`.
3. **Lay the rows out** as a `decision-comparison` table and ask through a
   `DecisionRequest` (`cat-harness-tools/schemas/process/decision-request.ts`:
   two to four options, a recommendation, and what happens if nobody
   answers).
4. **Go on.** Under the QA rule the agent proceeds with its recommendation;
   the adjudicator's answer is the stage's review decision.
