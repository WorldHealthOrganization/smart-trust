---
# folio-assistant-0utt
$schema: bean/1.0.0
title: 'PRODUCER: kg-export.bootstrap.qa-results.json is read by check:published-instance-exports but produced by no workflow'
status: completed
type: task
priority: normal
created_at: 2026-10-01T09:30:19Z
updated_at: 2026-10-01T18:34:24Z
parent: folio-assistant-3fva
---

Found by the r7v6 agent (C2 fix, 2026-10-01). The C2 gate now actually compares the committed `cat-harness/test/results/kg-export.bootstrap.qa-results.json` with a fresh re-export. On its first run it found the file stale (different producer hash, untagged modules 0→3), and the file was refreshed by hand in `ba1908fa`.

**Owner ruling 2026-10-01:** keep the file and add a producer. Do not delete it.

Note that `bo44` changes `kg-export.ts`, which changes the producer hash, so this file must be regenerated when bo44 lands. Under arc 3fva the file moves to the qa-reports branch, so the producer is the CI publish step (`16ei`). Until then it is the workflow step that runs the export.

## Done when
- [x] a workflow step (or the 16ei publish job) regenerates it on every main push
- [x] `check:published-instance-exports` names that producer, and no longer reports 'no workflow producer'
- [x] regenerated after bo44's kg-export.ts change

## Summary of Changes

- `code-quality-gates.yml` `qa-publish` job: a new step runs `kg-export.ts --instance ./bootstrap --out "$RUNNER_TEMP/…"` before `qa:publish`, so the published sidecar is regenerated on every main push (and same-repo PR).
- `check:published-instance-exports` reads that line as the producer. Its report shows `code-quality-gates.yml: ./bootstrap … QA sidecar current` and no longer says "no workflow producer".
- A latent reader bug surfaced: export-graph rows read the kg-export row's sidecar from the shared temp dir and printed "QA sidecar current" for a comparison they never made. The fresh sidecar is now read for kg-export rows only.
- `gates.test.ts` names the producer as the second allowed line in the publisher job. Two tests are added to `check-published-instance-exports.test.ts`.
- bo44's `kg-export.ts` change is already on this branch, and the committed sidecar compares `current` against it.
- regen repairs it locally through `kg:export:bootstrap` (bean `i1q7`).
