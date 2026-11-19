---
name: wireframe-viewport-check
description: >
  Render wireframe candidates at a web viewport (1280x800) and a mobile
  viewport (390x844), and record, per candidate and viewport, a pass or fail
  entry with a note for each mechanical criterion: renders, no-overflow,
  no-placeholder. Writes a screenshot per viewport beside the report. The
  mechanical step (step 3) of wireframe-design-review; a fail sends the
  candidate back to that skill's step 2.
input: schemas/skills/wireframe-viewport-check/input.schema.json
output: schemas/skills/wireframe-viewport-check/output.schema.json
uses-methodology:
  - wiregen
---

# Wireframe viewport check

Step 3 of [`wireframe-design-review`](wireframe-design-review.md): what can be judged without judgement. The review decides what to draw and which drawing wins; this step says only whether each drawing renders properly at both sizes. Method: [`wiregen`](../../../methodologies/wiregen.md), which records pass or fail per criterion and never a score.

## Input and output

The contract is [`input.schema.json`](../../../schemas/skills/wireframe-viewport-check/input.schema.json) and [`output.schema.json`](../../../schemas/skills/wireframe-viewport-check/output.schema.json).

- **In:** the `candidates`, which are HTML files with a web AND a mobile layout each, and `out`, where the screenshots and report go: the asset directory's `checks/`.
- **Out:** the `report` path, and per candidate its `source`, `screenshots.web` and `screenshots.mobile`, and its `entries`, with `by: script`.

## Criteria

At each viewport:

| criterion | pass when |
|---|---|
| renders | the page loads and draws, with no script error |
| no-overflow | nothing runs past the viewport's width |
| no-placeholder | no lorem ipsum or placeholder text: candidates show real content |

Any `fail` sends the candidate back to drawing. A candidate with only one layout fails at the viewport it does not serve.

## Tool

`wireframe-check` is the Tool for this skill. Its install, invocation and ports are in its Tool node, `tools/wireframe-check/wireframe-check.json`; ask the tools graph rather than copying a command from here.
