---
name: transcription-verbatim
description: >
  Check L1 authored from pictures (a schedule poster, a slide deck: a source
  with no usable text layer) against the image narratives and transcriptions
  it names: every statement verbatim in one of them, every transcription word
  corroborated by the entry's text layer unless listed under inspectionOnly,
  and unique keys. A step of recommendation-extraction, in place of
  recommendation-candidates when that step found no normative sentence; the
  `l1-transcription-verbatim` Tool satisfies it.
input: L1/schemas/skills/transcription-verbatim/input.schema.json
output: L1/schemas/skills/transcription-verbatim/output.schema.json
---

# transcription-verbatim

A step of [`recommendation-extraction`](recommendation-extraction.md) for a
source whose recommendations are printed only as images. When
[`recommendation-candidates`](recommendation-candidates.md) finds no
normative sentence in the entry's text layer, the L1 is authored by hand
(`*.l1.yaml`, the measles pattern) from the inspected image narratives and
transcriptions of the rendered page; this step is the mechanical gate on
that authoring (judgement: recommendation-extraction's *An authored L1 from
pictures*).

## Input and output

- Input: [`input.schema.json`](../../schemas/skills/transcription-verbatim/input.schema.json)
- Output: [`output.schema.json`](../../schemas/skills/transcription-verbatim/output.schema.json)

**In:** the directory of authored `*.l1.yaml`, each naming its library entry
in `graph.source.entry`.
**Out:** a report: one summary line per file, one `FINDING` line per
failure. Exit 0 clean, 1 findings, 2 nothing to check (which is not a pass).

## Steps

1. Author the `*.l1.yaml` from the entry's `images.json` narratives and its
   `transcription` blocks; never from the picture read by eye with no
   transcription recorded.
2. Run the Tool. A finding (a statement not verbatim, a transcription word
   the text layer does not corroborate and `inspectionOnly` does not list, a
   duplicate key) goes back to step 1.
3. Hand the result to [`recommendation-scenarios`](https://github.com/litlfred/smart-base/blob/main/smart-base/L1/skills/smart-l1/recommendation-scenarios.md),
   which reads an authored L1 YAML as its `l1`.

That the transcription reads the picture correctly is the reviewer's call
(`bun run cat narratives`), not this check's.

## Tool

`l1-transcription-verbatim` (`smart-base/L1/tools/l1-transcription-verbatim/l1-transcription-verbatim.ts`):

```sh
bun run smart-base/L1/scripts/l1-transcription-verbatim.ts --dir <dir of *.l1.yaml> [--root <repo>]
```
