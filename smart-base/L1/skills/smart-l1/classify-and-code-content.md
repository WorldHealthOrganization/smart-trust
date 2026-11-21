---
name: classify-and-code-content
description: >
  Classify and code L1 narrative content (recommendations, implementation
  practices, remarks, and proposed coverage exclusions) and L2 DAK slots
  (personas, business processes, guideline domains, conditions, interventions,
  medicines, and GRADE ratings) using the `terminology-coding` methodology and
  the `terminology-lookup` Tool. Covers the authoring-agent's four-rung
  reuse-first lookup, the `l1-extraction-reviewer` lane that reads and signs
  proposed L1 coverage exclusions against the printed page, and the
  `terminologist` / ontologist lane that adjudicates candidate codings and
  local glossary candidates.
uses-methodology:
  - terminology-coding
input: L1/schemas/skills/classify-and-code-content/input.schema.json
output: L1/schemas/skills/classify-and-code-content/output.schema.json
---

# classify-and-code-content

> Skill id: `classify-and-code-content` · Package: `authoring-who-smart-guidelines` ·
> Methodology: [`terminology-coding`](../../../methodologies/terminology-coding.md) ·
> Process: [`classify-and-code-content.bpmn`](../../processes/classify-and-code-content.bpmn) (`Process_ClassifyAndCodeContent`) ·
> Tool: [`terminology-lookup`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/tools/terminology-lookup/terminology-lookup.ts)

**An agent proposes classifications, codes and coverage exclusions; a person in
the named reviewer lane judges and signs them.** The process has three lanes:

1. **`authoring-agent`** codes slots and stages candidates (Step 1).
2. **`l1-extraction-reviewer`** (a person) signs or rejects proposed L1
   exclusions against the printed page (Step 2).
3. **`terminologist`** (a person, the terminologist / ontologist reviewer)
   judges candidate codings, SKOS mapping predicates and glossary candidates
   (Step 3).

## Input and output

- Input contract: [`input.schema.json`](../../schemas/skills/classify-and-code-content/input.schema.json)
- Output contract: [`output.schema.json`](../../schemas/skills/classify-and-code-content/output.schema.json)

## Step 1 — Agent: classify and code slots with `terminology-lookup`

For each slot in an L1 extraction or L2 component, run the Tool, record
provenance (`declared`, `context`, `inferred`) and `status: "candidate"`, and
stage the codings and any proposed exclusions for review:

```sh
bun run smart-base/scripts/terminology-lookup.ts \
  --slot <condition|intervention|persona|medicine|domain|business-process|recommendation-strength|recommendation-direction|evidence-certainty> \
  --query <term-or-code> \
  [--vocabulary <guide-vocabulary.json>] \
  [--generic <smart-base-generic-personas.json>] \
  [--scheme <scheme-id>] \
  [--out <result.json>]
```

Stop at the first rung that matches
([`terminology-coding`](../../../methodologies/terminology-coding.md) §2):

1. **Rung 1 (`rung-1-target-guide`):** the target guide's own persona or
   business process from `l1-scenario-vocabulary/v1`, when its scope covers
   the statement.
2. **Rung 2 (`rung-2-smart-base`):** `smart-base` generic personas
   (`DAK.Persona.*`), GRADE `code-lists/*.json`, or the `guideline-domain` SKOS
   scheme (`clinical`, `public-health`, `health-system-strengthening`).
3. **Rung 3 (`rung-3-external-standard`):** the slot's external standard (`ICD-11`, `ICHI` / `CDHIv2`, `ISCO-08`,
   `ATC`), distinguishing `skos:exactMatch` from `skos:closeMatch` per
   [`ontologist`](../../../../folio-assistant-core/skills/library/cataloguing/ontologist.md).
4. **Rung 4 (`rung-4-local-candidate`):**
   - Unmatched persona or domain concept: record a local glossary
     candidate (`status: "candidate"`, `source: "extracted"`) per
     [`glossary-terms`](../../../../folio-assistant-core/skills/library/cataloguing/glossary-terms.md)
     and emit `WARNING <slot>-glossary-candidate`.
   - Unmatched business process: **never invent a process**; record
     `could-not-determine` and emit `WARNING process-not-determined`.

## Step 2 — `l1-extraction-reviewer`: read proposed exclusions against the page and sign

When [`recommendation-candidates`](recommendation-candidates.md) writes
`exclusions.proposed.json`, every entry carries:

```json
{
  "signerRole": { "role": "l1-extraction-reviewer" }
}
```

and no `signedOffBy`. Until a reviewer signs it, `l1-coverage` counts the
sentence as **unaccounted** and coverage stays below 100 %. In
`Lane_ExtractionReviewer`:

1. **Open the printed page beside the work list.** Locate `location`
   (`p<page>:s<n>`) in `library/<doc_id>/sections/page-<NNN>.md` (and the
   rendered page image when layout is ambiguous).
2. **Read the sentence in place,** with its paragraph, heading and table
   context — never judge an exclusion from the isolated sentence.
3. **Check the proposed `reason` against the five closed reasons:**
   - `background-fact` — epidemiology, disease burden, history, or biological
     fact with no normative action for a guideline user;
   - `manufacturer-statement` — a product insert or manufacturer specification
     quoted as context rather than a WHO recommendation;
   - `editorial` — licence text, imprint, how-to-read-this-document prose,
     chapter navigation checkpoints, or glossary definitions;
   - `research-question` — a gap or priority for future research, not a current
     practice or recommendation;
   - `duplicate-of:<id>` — a verbatim or near-verbatim repetition of a
     statement already captured under `<id>`, verified against `<id>`'s
     statement text.
4. **Sign or reject:**
   - **Sign** if the sentence is non-normative for the stated reason: record
     `signedOffBy` (the reviewer's handle) and timestamp in the curation /
     exclusions file, and re-run `l1-recommendation-candidates` so coverage
     updates.
   - **Reject** if it states a recommendation, implementation practice or
     remark that belongs in L1, with a reason, so the `authoring-agent`
     re-curates the location as a node.

## Step 3 — `terminologist`: review candidate codings and glossary candidates

In `Lane_Terminologist`, the `terminologist` (equipped with
[`ontologist`](../../../../folio-assistant-core/skills/library/cataloguing/ontologist.md),
[`glossary-terms`](../../../../folio-assistant-core/skills/library/cataloguing/glossary-terms.md),
and [`terminology-management`](../../../../fhir-harness/skills/content/fhir-ig-authoring/terminology-management.md))
judges each staged coding:

1. **Scheme and rung:** the slot was coded against the scheme named in
   [`terminology-coding`](../../../methodologies/terminology-coding.md) §1, and
   no higher rung held an applicable concept.
2. **Precision:** no narrower or broader concept is asserted as `exactMatch`
   (use `closeMatch`).
3. **Glossary candidates:** for each Rung 4 candidate, promote it to `status: "authored"` (checking
   definition quality and `skos:broader` / `skos:closeMatch` links), replace it
   with an existing code from Rungs 1–3, or reject it.
4. **Verdict:** record (`approve`,
   `request-changes`, or `reject`) in the mapping (`review: {by, at}`) or
   component `QaReview`.
