---
name: l3-readiness
description: >
  The check between stages 5 and 6 of smart-guideline-end-to-end
  (Gateway_L3Ready): may the agent write L3 assets yet? Yes only when every
  source of the use case has its L1 extraction, every L2 asset names the L1
  node it rests on, every L3 artefact about to be written names the L2 asset
  it implements, and the review of each extraction and L2 asset has been
  requested. Returns the answer, every finding with the stage that fixes it,
  and what was checked. Read before writing any FSH, CQL or other L3 file for
  a guideline or an adaptation.
input: L3/schemas/skills/l3-readiness/input.schema.json
output: L3/schemas/skills/l3-readiness/output.schema.json
---

# l3-readiness

> Skill id: `l3-readiness` · Package: `authoring-who-smart-guidelines` ·
> The check before `Gateway_L3Ready` of
> [`smart-guideline-end-to-end`](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md), task
> `Task_L3Ready` of
> `smart-guideline-end-to-end.bpmn` (opt-in `smart-base.collab`).
> Run by the authoring agent; it records no verdict on any asset.

The [order rule](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md#the-order-is-a-rule-l1-then-l2-then-l3)
as a check with its own contract. It is not a stage: it produces no asset,
only the answer the gateway takes.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/l3-readiness/input.schema.json) and [`output.schema.json`](../../schemas/skills/l3-readiness/output.schema.json).

- **In:** the `l1Kg` (stage 2), the `l2Assets` (every stage-4 [`l2-dak-authoring`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/skills/smart-l2/l2-dak-authoring.md) pass's `artifacts`), the `reviews` requested so far, one per extraction or L2 asset, and `l3Planned`, the L3 artefacts stage 6 is about to write, each with its `sourceModel`.
- **Out:** `ready`, which is the gateway's outcome; `findings`, each naming the asset, the problem and the stage that fixes it; `checked`, every asset looked at, so that no findings is a determined empty and not a skipped check.

## Steps

1. **L1.** Every source the use case includes has an `l1Kg` extraction, at
   `library/<bib>/l1-extraction/` (or `l1-extractions/<bib>/` when the entry
   lives in another layer's library). A source without one is
   `no-l1-extraction`, fixed by stage 2.
2. **L2 on L1.** Every L2 asset names at least one L1 node in
   `wasDerivedFrom`. One that names none is `no-l1-upstream`, fixed by
   stage 4.
3. **L3 on L2.** Every `l3Planned` entry's `sourceModel` is an `l2Assets`
   path. One that is not is `no-l2-upstream`, fixed by stage 4. Source
   documents (a schedule poster, a slide deck) are stage-2 input, never a
   `sourceModel`.
4. **Review requested.** Every extraction and every L2 asset has a
   `reviews` entry: its review item opened and staged. One without is
   `review-not-requested`, fixed by the stage that made it. The verdict is
   not awaited.
5. **Answer.** `ready` is true exactly when `findings` is empty. The
   gateway then takes «yes» to stage 6, or «no» back to stage 4 (which
   fills a missing extraction from stage 2).

A green build and passing tests do not clear a finding.
