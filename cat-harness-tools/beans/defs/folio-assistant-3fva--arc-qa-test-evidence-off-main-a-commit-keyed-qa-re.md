---
# folio-assistant-3fva
$schema: bean/1.0.0
title: 'ARC: QA & test evidence off main — a commit-keyed qa-reports branch, and a test-plan → certification process'
status: completed
type: epic
priority: high
created_at: 2026-10-01T07:59:35Z
updated_at: 2026-11-15T17:35:00Z
parent: folio-assistant-rwmf
---

Issue #1763. Proposal, workplan, dispatch map and decisions D1–D5: `cat-harness/docs/proposals/qa-reports-branch-and-test-process-2026-10-01.md`.
Sibling of the QA epic `1swy` (an epic cannot be parented under an epic here).

Owner, 2026-10-01: do not pollute main with the QA subgraph; publish it on a
dedicated branch, as caching is; tie QA into a strawperson test process (an agent
or machine is tested against a test plan of many tests with their test data);
QA reports and test/certification/compliance reports are very similar.

This is the write-up `eqxp` said existed ("written up separately") and did not.

Measured at 61b1e747: QA is 2.1 % of tracked bytes but 18.9 % of changed paths
and 34.8 % of changed lines over the last 200 commits.

Related, not reparented: `eqxp`, `520m`, `cflw`, `mcdj` (merge friction); `rjug`
(the qa-report kind); `vm6m`, `vljz`, `y4uj`, `sopq` (test data, SME review,
sources, WHO SOPs); `i2kp`, `kgho`, `1xhc` (the stalled handover).

Claim: held by branch `claude/quirky-davinci-ixuymr`, session
https://claude.ai/code/session_01LKpuPotV3Ve5Za75DQ3AQR. Not pushed to main via
beans:claim, because this session pushes only to its own branch.

## Done when
- [x] the owner has ruled D1–D5 (proposal §5)
- [x] the 1.2 spike shows that CI AND a fresh agent container can both push to and read the branch
- [x] every reader in proposal §4 Phase 3 reads from the branch, and the gates are green
- [x] the moved files are removed from main, on the owner's explicit go
- [x] one test plan has been executed and certified end to end (crdm-detect)


## Owner rulings 2026-10-01
- D1 (a): orphan branch.
- D2 (a): attestations stay on main.
- D4: right away, with no soak; this is the go for `5hox`.
- D3 and D5: not asked, so they use their defaults.

The owner also asked for an audit of every QA READER, with fixes queued. That is dispatched; see the reader-audit bean.


## Owner ruling 2026-10-01 — the 26 baseline pair attestations count as JUDGEMENTS
Asked with three options, recommended first. The owner chose "count as judgements". The 26 `baseline` pair attestations stay on main beside the 6 agent ones, under D2 (a). The kg-qa split therefore keeps all 32 `pair_attestations` files' attestation halves on main. Live-defect fixes `de9k` and `r7v6` start after `gurh` reports, so the two agents don't rewrite the same kg-qa files.


## Merge policy and the stacked follow-up PR, 2026-10-01
Owner MERGE POLICY: never merge to main ourselves. When a PR is green on every CI job: mark it Ready for review, add the label `ready-to-merge`, and comment `ready: <head sha>`. The Merge Steward session ("Separation") brings main in, regenerates and merges. If it reports red: fix, then re-label.

PR #1764 was marked ready at `a4c54517`. The owner chose that later agent work (8wj1, id4s+0dav, oq1j, c8uq+tfqf, then cxcn) goes to a FOLLOW-UP PR on `claude/quirky-davinci-ixuymr-phase3`, stacked on #1764, so #1764 keeps its label and merges untouched. Once #1764 merges, the follow-up retargets to main.

_2026-10-21T19:15:00Z_ — Progress update: ticked 4 of 5 `Done when` boxes (`D1–D5` ruled 2026-10-01; `3ds9` 1.2 spike completed; `5hox` removed `test/results/` from `main` in PR `#2080`; `ff09` executed and certified `crdm-detect` end-to-end). Remaining box (`every reader in proposal §4 Phase 3 reads from the branch, and the gates are green`) tracks open child `2gst`.

_2026-11-15T17:35:00Z_ — Completed: all 40 implementation children under `folio-assistant-3fva` (`2gst`, `0dav`, `id4s`, `oq1j`, `8wj1`, `c8uq`, `tfqf`, `cxcn`, `oqe3`, `72a8`, `7mwa`, etc.) are now completed on `main` (only future R5 export `18p1` remains `status: draft` for post-IG completion). Ticked the final `Done when` box and marked the epic `completed`. Session https://claude.ai/code/session_01E667391F74184786BF4B9D.
