---
name: l1-coverage
description: >
  Check that an L1 extraction accounted for every normative sentence in its
  source publication — captured as a node, or excluded for a fixed-list
  reason a person signed off. Per-page counts, captured %, accounted-for %,
  and a non-zero exit below 100 % accounted-for. Generic: three input files,
  nothing folio-specific. Implements the methodology l1-coverage, the report contract.
graph-typologies:
  - library
---

# L1 coverage — nothing normative goes missing silently

Any L1 extraction SHALL produce a coverage QA report: every normative
sentence in the source is captured, or excluded for a reason from a fixed
list; the target is 100 % accounted for. The report's fields and what its
numbers mean are fixed by the methodology
[`l1-coverage`](../../../methodologies/l1-coverage.md), the report contract;
this is its implementation.

## Why

An extraction — by hand or by a tool — fails silently: a recommendation that
never became a node leaves no trace in the graph. For example, a label-based
extractor finds **0** recommendations in a WHO position paper (WER 92(17),
measles, 2017) because position papers print no "Recommendation N" labels.
Only a check that reads the **source** catches that.

## Run it

```sh
bun run cat l1:coverage --text pages.json --captured captured.json \
  [--exclusions exclusions.json] [--out report.json]
```

| input | shape |
|---|---|
| `--text` | the BODY text, page-tagged: `{"pages":[{"page":3,"text":"…"}]}`, or plain text with a form feed between pages (what `pdftotext` writes). Strip references, running headers and the table of contents first — the script cannot tell a header from a sentence. |
| `--captured` | `[{"id":"rec-1","text":"…"}]` — every captured statement, verbatim |
| `--exclusions` | `[{"location":"p3:s7","reason":"background-fact","signedOffBy":"…","signedOffAt":"…"}]`, or `text` in place of `location` |

Exit 0 only at 100 % accounted-for (or when nothing in the source is
normative — the percentages are then `null`, never 100); 1 below target or on
an exclusion with an unknown reason; 2 on unusable input. The per-page table
goes to stderr, the report to `--out` or stdout.

## Reading the numbers

- **Accounted-for is the target, captured is beside it.** A publication
  legitimately holds normative-looking sentences that are not
  recommendations ("all regions should have eliminated measles by 2020" is
  history). A 100 % accounted-for made mostly of exclusions is visible as a
  low captured %.
- **A proposed exclusion is not an exclusion.** Without `signedOffBy` the
  sentence stays unaccounted. An agent may PROPOSE an exclusion; only a
  person signs it off (`req:agent-workflow` → `judgement-stays-human`).
- **The reasons are fixed**: `background-fact`, `manufacturer-statement`,
  `editorial`, `research-question`, `duplicate-of:<captured id>`. A sentence
  that fits none is either a missing capture or a missing reason, and both go
  to a person — never to a sixth string.
- **Matching is normalised substring** (case, quotes, dashes, whitespace). A
  paraphrased capture reads as unaccounted on purpose: a near match is a
  judgement, and the report does not make it for you.
- **The marker list is closed and English** (contract §1): `should`,
  `shall`, `must`, `recommend*`, `should not`, `is not a reason`, `are not a
  contraindication`, and `may be` + given/administered/offered/considered/
  used/co-administered/implemented. Bare `may` does not count.

## Where `--captured` comes from in a DAK or DTH

From the entry's own `candidates.json`. The `requirements` aspect proposes
every sentence carrying one of the markers above
([`l1-document-ingestion`](l1-document-ingestion.md#requirements-and-normative-statements--every-dak-and-dth-source)),
verbatim, so `jq '[.candidates[] | {id: (.number // .section_file), text: .statement}]'`
over it is a `--captured` file. A sentence the aspect proposed matches. One it
missed (split across a page or a table cell) shows as unaccounted, and goes to
a person.

## Where it sits

After [`l1-document-ingestion`](l1-document-ingestion.md) has produced the
entry and an extraction has produced the captured statements; before the
extraction is reviewed or promoted. `check:l1-complete` asks whether an L1
entry is structurally complete; this asks whether its **normative content**
was all accounted for. They are different questions and neither implies the
other.

Once the extraction is reviewed, its statements are published with links to
their sources by [`publish-extracted-statements`](publish-extracted-statements.md):
coverage says everything was captured, publication makes what was captured
readable and traceable.
