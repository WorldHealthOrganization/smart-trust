---
# folio-assistant-7fu5
$schema: bean/1.0.0
title: 'CI: fold the four one-second jobs into one — fewer runner requests per run'
status: completed
type: task
priority: normal
created_at: 2026-10-03T16:14:26Z
updated_at: 2026-10-04T05:33:46Z
parent: folio-assistant-hfag
---

Measured on main run 37133247484 (2026-10-03, #2010 merge): 21.7 min wall for a run whose longest job executes 174 s. Runner WAIT dominates: first job queued 4.5 min; the two 1-s aggregator jobs waited 9.6 and 3.8 min. Each run asks for 18 runners. Four jobs do ~1 s of work after a ~13 s checkout: lean-bare-import, python-imports, rust-wildcard, dependency-advisories.

Owner chose option 1 (2026-10-03): fold them. Into ONE new job, not into gates: om30 keeps gates' steps from masking each other, and Task_* nodes are one-per-job.

## Done when
- [ ] one job `hygiene` runs all four; every gate step after the first is `if: ${{ !cancelled() }}`, so a red one masks none (om30); the Rust continue-on-error step is last
- [ ] code-quality-gates.bpmn: four tasks become Task_Hygiene, which the job claims; SVG regenerated
- [ ] bun run cat gates green; CI green; PR ready
- [ ] measured: runner requests per run 18 → 15

## Summary of Changes — closed 2026-10-04, landed

Merged to main as litlfred/folio-assistant#2021 (head ca301f9, every CI job green on it, mergeable by merge-tree at 09f6f25).

- [x] one job `hygiene` runs the Lean, Python, advisories and Rust steps; every gate step after the first is `if: ${{ !cancelled() }}`; the continue-on-error Rust report is last
- [x] code-quality-gates.bpmn: four tasks became Task_Hygiene, claimed by the job (check:workflow-coverage: jobs match); SVG regenerated; Task_SkillChain wired into fork and join
- [x] gates and CI green; PR ready and merged
- [x] runner requests per code-quality run: 18 -> 15 (four jobs -> one). The first PR run on the new shape took 13 min start to finish vs 21.7 on the measured main run; queue load differs, so that is an observation, not a measured saving.

Not done, owner's call (paused 2026-10-03): removing the two 1-s aggregator jobs (`typescript`, `e2e`), which waited 9.6 and 3.8 min for runners; needs a branch-protection change.
