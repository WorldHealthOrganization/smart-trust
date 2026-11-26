---
name: recommendation-scenarios
description: >
  Join each L1 recommendation to who acts on it and during which business
  process: one smart-kg L2 user-scenario candidate per recommendation, from the
  agent's mapping, reusing the target guide's personas and processes first,
  then smart-base's generic personas, and never inventing a process. Step 2 of
  recommendation-extraction; the `l1-recommendation-scenarios` Tool satisfies
  it.
input: L1/schemas/skills/recommendation-scenarios/input.schema.json
output: L1/schemas/skills/recommendation-scenarios/output.schema.json
uses-methodology:
  - terminology-coding
---

# recommendation-scenarios

Step 2 of [`recommendation-extraction`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/recommendation-extraction.md): the
mechanical step that applies that skill's Part 2 (the shape of a scenario,
and the reuse-first persona, business-process and domain coding of the
[`terminology-coding`](../../../methodologies/terminology-coding.md)
methodology and [`classify-and-code-content`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/classify-and-code-content.md)).

## Input and output

- Input: [`input.schema.json`](../../schemas/skills/recommendation-scenarios/input.schema.json)
- Output: [`output.schema.json`](../../schemas/skills/recommendation-scenarios/output.schema.json)

**In:** the L1 graph from [`recommendation-candidates`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/recommendation-candidates.md)
(or an authored L1 YAML), the target guide's vocabulary, optionally the generic
personas, and the agent's mapping.
**Out:** `scenario-candidates.l2.json`, one candidate per recommendation, with
warnings for what could not be determined. Every candidate stays `candidate`
until a person reviews it.

## Tool

`l1-recommendation-scenarios` (`smart-base/L2/tools/l1-recommendation-scenarios/l1-recommendation-scenarios.ts`):

```sh
bun run smart-base/scripts/l1-recommendation-scenarios.ts --l1 <l1.json|yaml> --vocabulary <guide.json> [--generic <generic.json>] --mapping <mapping.yaml> --out <dir> [--check]
```
