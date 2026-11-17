---
name: recommendation-candidates
description: >
  Turn one ingested L1 source into L1 3.0 recommendation nodes: list every
  normative sentence as a candidate, let the agent decide each in a curation
  file, then refuse a non-verbatim statement or unknown location and write the
  graph, coverage and proposed exclusions. Step 1 of recommendation-extraction,
  run once per included source; the `l1-recommendation-candidates` Tool
  satisfies it.
input: L1/schemas/skills/recommendation-candidates/input.schema.json
output: L1/schemas/skills/recommendation-candidates/output.schema.json
---

# recommendation-candidates

Step 1 of [`recommendation-extraction`](recommendation-extraction.md), for
one source at a time: the mechanical step around that skill's judgement (its
Part 1: what counts as a recommendation, and implementation guidance that
prints practices instead).

## Input and output

- Input: [`input.schema.json`](../../schemas/skills/recommendation-candidates/input.schema.json)
- Output: [`output.schema.json`](../../schemas/skills/recommendation-candidates/output.schema.json)

**In:** an ingested `library/<id>/` entry and, on the second pass, the agent's
`l1-recommendation-curation/v1`.
**Out:** the candidate work list; once curated, the L1 3.0 graph (`l1.json`,
every node `inferred`), the proposed exclusions and the warnings.

## Steps

1. Run the Tool with no curation: it writes the work list, every normative
   sentence with its hints, nothing decided.
2. The agent writes `curation.yaml`, one decision per location, following
   recommendation-extraction Part 1.
3. Run the Tool again with the curation: it applies the gates and writes the
   graph. A refusal (a statement that is not verbatim, an unknown location)
   goes back to step 2.

## Tool

`l1-recommendation-candidates` (`smart-base/L1/tools/l1-recommendation-candidates/l1-recommendation-candidates.ts`):

```sh
bun run smart-base/L1/scripts/l1-recommendation-candidates.ts --entry <library entry> [--curation <curation.yaml>] --out <dir> [--check]
```
