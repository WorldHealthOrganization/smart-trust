---
name: indicator-extraction
description: >
  Extract the indicators an L1 source prints (indicator reference or metadata
  sheets: name, numerator, denominator, disaggregation, definition, data
  sources) as L1 `indicator` nodes with every printed field, then draft one
  L2 program indicator per indicator, derived from its L1 node. Read before
  adding a WHO handbook's or guideline's indicators to a DAK or a DTH, and
  whenever an L2 indicator has to trace to its source. Part of L1 → L2
  extraction for every DAK and DTH, beside recommendation-extraction.
input: L1/schemas/skills/indicator-extraction/input.schema.json
output: L1/schemas/skills/indicator-extraction/output.schema.json
---

# indicator-extraction

> Skill id: `indicator-extraction` · Package: `authoring-who-smart-guidelines` ·
> Follows [`dak-l1-library`](dak-l1-library.md), which ingests the source.
> Sibling of [`recommendation-extraction`](recommendation-extraction.md): that
> one takes a source's recommendations, this one its indicators.

It is a step of L1 → L2 extraction for a DAK or DTH, bound to
`Task_Indicators` in [`l2-dak-authoring`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/collab/processes/l2-dak-authoring.bpmn)
and `Call_Data` in [`dth-authoring`](https://github.com/litlfred/smart-base/blob/main/smart-base/L2/collab/processes/dth-authoring.bpmn).

## Two layers, kept apart

| layer | what | kind / model | written by |
|---|---|---|---|
| L1 | the indicator **as the source prints it**, verbatim | `indicator` block (folio type `smart-base:Indicator`; KG L1 `indicator`, `L1/schemas/l1.ts`) | `L1/scripts/l1-indicator-sheets.py` → `candidates.json` → `gen-library-jsonld` |
| L2 | the DAK's or DTH's **own** operational measure, a draft that points back | `program-indicator` (sgkg-l2), logical model `ProgramIndicator` | `scripts/l2-program-indicators.py` |

sgkg-l2 keeps them apart: merging them would merge a WHO definition with a
country's implementation of it. The L2 record is a draft with `derivedFrom`
its L1 node, and the L2 author adopts, edits or drops it.

## Rules

- **Ids come from the source.** `number` / `indicatorId` is the printed
  indicator number ("1-01", "4-01.3"). A sheet whose header prints none is
  reported and skipped, never numbered by an agent. The L2 id is
  `<prefix>.<number>` ("NHWA.1-01"); the prefix only namespaces it.
- **Verbatim.** Every field is the printed text: lines joined, letter-spacing
  artefacts closed up, nothing reworded. A printed list (glossary terms, data
  sources) is one string joined with "; ".
- **Every printed field**, not only name, numerator and denominator. The L1
  node's `meta` holds `indicatorId`, `module`, `abbreviatedName`, `name`,
  `numerator`, `denominator`, `disaggregation`, `definition`, `glossary`,
  `reportingFrequency`, `reportingFrameworks`, `dataSources`,
  `furtherInformation` and `dimension` where printed; a sub-indicator adds
  `parentIndicator` and `guidingQuestions`. These are the keys the
  structured-block cards read.
- **No gap is filled.** `ProgramIndicator` makes `definition`, `numerator`,
  `denominator` and `disaggregation` 1..1. Where the source prints none (a
  composite or self-assessed indicator), the L2 draft lists it in `gaps` and
  the L2 author decides. Nothing is copied from another source to fill it.
- **A composite indicator** keeps its sub-indicators as their own L1 nodes;
  in L2 they are the parent's `components`, not program indicators of their
  own.
- **Read the page layout, not the section text,** when the source prints
  sheets as a label column and a value column: Stage A's text reads side bars
  and columns out of order.

## Steps

1. The source is in the library (`dak-l1-library`), with its PDF in
   `uploads/<doc-id>/`.
2. **L1 candidates.** From the library repository root:

   ```sh
   python3 smart-base/L1/scripts/l1-indicator-sheets.py --entry library/<doc-id> \
     --pdf uploads/<doc-id>/<doc-id>.pdf --pages <first>-<last> --json   # look first
   python3 smart-base/L1/scripts/l1-indicator-sheets.py --entry library/<doc-id> \
     --pdf uploads/<doc-id>/<doc-id>.pdf --pages <first>-<last> --write
   ```

   `--write` merges into `candidates.json` as the `indicators` aspect,
   replacing an `indicator` candidate with the same number (re-runs are
   idempotent). Check the count against the source's own list of
   indicators (NHWA: the synthesis table, 29 indicators).
3. **L1 nodes.** `bun cat-harness-tools/pipeline/gen-library-jsonld.ts --entry library/<doc-id>`
   writes `blocks/indicator-<section>-NN.{jsonld,md}`, each `derivedFrom` its
   section, `provenance: ingested`, with the fields in `meta`. Existing
   indicator IRIs do not change when the first candidate of a section stays
   the same indicator.
4. **L2 drafts.**

   ```sh
   python3 smart-base/scripts/l2-program-indicators.py --entry library/<doc-id> \
     --prefix <PREFIX> --out <where the L2 author will review them>
   ```

5. **Into the DAK or DTH.** The L2 author takes the drafts into the guide's
   indicators component (DAK component 8; a DTH's data elements, indicators
   and requirements), through the guide's own review
   (`l2-component-edit-review`) and, for a DTH, a change set.

## Validated against

- NHWA handbook, 2nd edition (who-iris `9789240081291-eng`): 29 indicators,
  33 sub-indicators, PDF pages 51-91.

Not yet run on a guideline whose indicator sheets use a different layout
(HIV SI 2022's reference sheets: "What it measures", "Rationale", "Method of
measurement"). Those labels are in the script's label list, but the header
number pattern may need a per-source `ID_PATTERN`.
