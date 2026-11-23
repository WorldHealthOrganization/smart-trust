---
# folio-assistant-i1q7
$schema: bean/1.0.0
title: 'REGEN BLIND SPOT: regen-after-merge ''repairs'' translate-bpmn:bootstrap:check with a writer that does nothing without --extract'
status: completed
type: bug
priority: normal
created_at: 2026-10-01T12:46:50Z
updated_at: 2026-10-01T18:34:23Z
parent: folio-assistant-3fva
---

Found 2026-10-01 while merging `yhjr` into PR #1764.

`bun run cat regen` reported `translate-bpmn:bootstrap:check STILL fails after bun run cat translate-bpmn:bootstrap — a real defect, not staleness`. It was staleness: `translate-bpmn:bootstrap` (`translate-bpmn.ts --instance ./bootstrap`) prints *"Nothing to do. Pass --extract, --check, or --inject"* and writes nothing. Running `translate-bpmn.ts --instance ./bootstrap --extract` by hand regenerated the 10 stale `.pot` files, and the check went to exit 0.

This is the `uju6` spelling class: the declared writer for a gate is not a writer. The same family as `bo44`'s sweep, in the opposite direction (a check whose writer cannot write).

Also found: `regen` does not cover the `kg-export*.qa-results.json` sidecars that `check:published-instance-exports` now compares (`r7v6` C2). They had to be rebuilt by hand with `kg:export` and `kg-export.ts --instance ./bootstrap`. Same root cause as bean `0utt`.

## Done when
- [x] `translate-bpmn:bootstrap` (and `translate-bpmn`) write when run bare, or regen's writer map names `--extract`
- [x] regen's writer map covers the kg-export sidecars, or `0utt` gives them a CI producer
- [x] a test asserts that every writer regen invokes changes its check from red to green on a staled fixture

## Summary of Changes

- `translate-bpmn:bootstrap` now carries `--extract`, so the X / X:check convention pairs a real writer. The root `translate-bpmn:check` did NOT have the defect under regen: `WRITER_OVERRIDES` already maps it to `translate-bpmn:extract` (bean `eowd`). The check's remedy line now names its own `--instance`.
- New script `kg:export:bootstrap`; `WRITER_OVERRIDES["check:published-instance-exports"] = "kg:export:bootstrap"`. Producer in CI is bean `0utt`.
- regen: a writer that exits non-zero is now `writer-failed` (a verdict about the pairing), not "a real defect, not staleness".
- regen asks the WHOLE gate set by default (`--fast` keeps the old scope). Outside the fast set there were only `render:bpmn:check` (3.7 s) and `bat:sync:check` (0.1 s, needs no browser). Without Chromium a browser-job failure is reported `no-browser`, never green.
- Tests: `regen-writers.test.ts` stales a bootstrap .pot, a root .pot, the bootstrap kg-export sidecar, a .bat and a workflow SVG, and asserts red, then regen's pass runs the paired writer, then green. Falsified with the old bare writer, which gives `writer-failed`. Unit tests in `regen-after-merge.test.ts`.
- Verified 2026-10-01: staled discussion.pot, kg-export.bootstrap sidecar, kg-export host sidecar and discussion.svg to older commits. Gates before: bootstrap .pot check 1, published-instance-exports 1, render:bpmn:check 1. `bun run cat regen` alone took 2 passes and gave "91 current, 4 regenerated, 0 unrepaired", exit 0. All gates 0 afterwards.

Not covered: the HOST `kg-export.qa-results.json` reds no gate when stale. `kg:export:check` and `check:version-bump` report it as advisory by design (id4s). So regen, which asks gates, does not refresh it. That applies to every self-sidecar whose staleness is advisory.
