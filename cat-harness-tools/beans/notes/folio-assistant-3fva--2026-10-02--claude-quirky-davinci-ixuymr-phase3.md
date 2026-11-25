---
# note on folio-assistant-3fva from claude/quirky-davinci-ixuymr-phase3
$schema: folio-bean-note/v1
bean: folio-assistant-3fva
branch: "claude/quirky-davinci-ixuymr-phase3"
created: "2026-10-02"
---
## handover: QA-reports arc (3fva) 2026-10-02

## Handover report: QA-reports arc lead (arc 3fva)

- **Session:** https://claude.ai/code/session_01LKpuPotV3Ve5Za75DQ3AQR
- **Written:** 2026-10-02 ~20:50 UTC; updated ~21:20 UTC (#1801 green) and ~22:10 UTC (zlq9 done, `ready:` posted, rename handed off). The owner asked for "Prepare for Handover" (skill from PR #1912), to be sent to the Merge Manager.
- **Role and mandate:** lead for arc `3fva`: derived QA leaves `main` for the orphan `qa-reports` branch, and the test-plan/test-report process. Owner rulings:
  - **MERGE POLICY (verbatim):** "Do NOT merge to main yourself. When your PR is green on every CI job, mark it 'Ready for review', add the label `ready-to-merge`, and comment 'ready: <head sha>'."
  - **Main:** "Only nothing into main".
  - **#1764 drift:** "Leave to Steward" (2026-10-02).
  - **Sweep scope (3hk4):** "Full sweep" (2026-10-02).
  - **Proposal rulings:** D1 (a) orphan branch; D2 (a) attestations stay on main; D4 "right away" (5hox once readers are migrated and `main/<sha>` verifies).

### Where I'm going (current arc)
Derived QA verdicts move off `main` onto `qa-reports`, keyed by commit; judgements stay in `test/attestations/`. "Done" means:
- #1764 and #1801 are merged;
- `main/<sha>` is published, and `qa:verify-moved` reports it IDENTICAL;
- the held 5hox deletion has landed;
- every gate is green on `main` with no QA files committed.

### Done so far
- **#1764** (arc; head `8df0a71bd`): mechanism (16ei), judge modes (bo44), test schemas (ygzh), live defects (de9k, r7v6), subdirectory descriptions (yhjr). It was green and `ready:` posted at several heads. Its last green head with `ready:` is `d36fce044`; the steward has merged `main` in since.
- **#1801** (phase 3, stacked on #1764; head `06ec92cba`):
  - attestation splits: 2gst, 8wj1;
  - readers: oq1j, id4s, 0dav, c8uq, tfqf, cxcn, 8iqt;
  - regen coverage: i1q7, 0utt;
  - skills and processes: d6bw;
  - test process: 3o5b;
  - 5hox preparation: inventory `cat-harness/docs/proposals/5hox-removal-inventory.md`, `qa:verify-moved`, storage declarations;
  - 3hk4: `qa:refresh` and `qa:publish --completeness`;
  - oqe3: last stale-compare gates now judge;
  - 4l4d: badge placeholders and JSON assets;
  - f3bh: subgraph-readmes skips stored directories.

### Next in queue
1. **Done:** #1801 green at `edf28c4c3` (fixes and the regen lesson are in the git history of this note).
2. **Done (22:05 UTC): bean `zlq9`.** The owner changed the scheme to `cat/<harness>/<name>` (note on `fs43`, bean `tlk2`), so `qa-store.ts` resolves THREE names, in this order: `cat/cat-harness/qa-reports`, then `cat-qa-reports`, then `qa-reports`. A declaration naming any of them looks for all three; writers create the new path only when none exists. The 10 declarations name the new path, and the raw-push guard in `check-workflows.ts` matches all three. #1801 is green at `0f26313a7`.
3. **Done (22:06 UTC):** "zlq9: dual-name pushed and green" posted on #1928, the rename handoff; the merge steward was stood down by the owner. No pushes to #1764/#1801 until 22:36 UTC. #1801 is marked ready, labelled `ready-to-merge`, and has `ready: 0f26313a7`.
4. **Watch:** #1764's own `qa-store.ts` knows only `qa-reports`. If #1764 runs CI after the rename and before #1801 merges, its publish job (not a gate) can recreate a stray `qa-reports` branch. If that happens, report it to the owner; deleting the branch needs their confirmation.
5. After #1764 merges: wait for `main/<sha>` on the QA branch (whichever name exists), then run `bun run cat qa:verify-moved --key main/<sha>`. If IDENTICAL, re-measure the inventory (10 instances) and show the owner the numbers. Only then push the 5hox deletion.

### In flight
| item | kind | state | next action | owner |
|---|---|---|---|---|
| #1764 `claude/quirky-davinci-ixuymr` @ `8df0a71bd` | PR → main | `ready-to-merge`; main brought in by the steward | steward merges | merge steward |
| #1801 `claude/quirky-davinci-ixuymr-phase3` @ `0f26313a7` | PR (stacked on #1764) | green; ready, `ready-to-merge`, `ready:` posted | merges after #1764 | merge manager |
| `zlq9` | bean | completed | none | done |
| QA branch rename | handoff on #1928 | go-ahead posted 22:06 UTC; at 22:38 UTC NOT yet run: `ls-remote` shows only `qa-reports` @ `7ddc0af4`, and #1928 has no report for it | owner's local agent runs `rename-special-branch.sh`; it is safe at any time, since #1801 reads all three names and the script deletes under a lease | owner |
| `5hox` | bean | prep merged; deletion held, NOT pushed | Next in queue, step 4 | this arc, owner go |
| `zaui` (certification attestation family), `4iey` (per-plan DMN) | beans | todo | none needed yet | this arc |

### Blockers and dependencies
| blocker | waits on | since | expires / re-check |
|---|---|---|---|
| 5hox: 8 gates red with the files absent | a `main/<sha>` entry on qa-reports, which exists only after #1764 merges | 2026-10-02 | re-check when #1764 merges |
| the `qa-reports` → `cat/cat-harness/qa-reports` rename | the owner's local agent | 2026-10-02 22:06 | not run at 22:38 UTC; nothing in this arc waits on it |

### Decisions pending (owner)
- None open. Before the 5hox deletion is pushed, the owner sees the re-measured inventory (count, bytes, oldest age).

### Unpushed or at-risk state
- **`420ab8180`**, the 5hox deletion. It exists only on local branches `qa-5hox` and `qa-5hox-deletion`, and is not pushed by design. This session may push only to its two designated branches, and the commit must not reach #1801 before verification. It can be rebuilt: `git rm -r --cached` over the paths from `bun run cat qa:verify-moved --inventory`, plus the `.gitignore` already on #1801. Rebuild it, rather than reuse it, after `main/<sha>` verifies.
- Scratch measurement branches, local only and rebuildable: `qa-4l4d-f3bh-scratch` `613805edd`, `scratch-3hk4-absent` `b04865e45`, `gurh-probe-1769` `0eaecdeca`.
- Superseded, safe to drop:
  - `worktree-agent-a8ba4c80e273d619d`, the first 8wj1 attempt (redone and merged);
  - the uncommitted files in worktree `agent-a0f4469f78fb1ddb2`, the rate-limited first cxcn attempt (redone and merged).
- Nothing else is unpushed. The scratchpad was lost in a container restart; nothing in it was needed.

### How to resume
1. Read #1801's CI on its current head; it was green at `edf28c4c3`. Before any push, run `bun run cat gates`. A subset is not the gate set: two pushes here went red that way.
2. zlq9 is done. The rename handoff and its reports live on #1928; the steward `01ToWZR4…` was stood down.
3. On every merge of #1764 into #1801, take `ours` only for generated paths matched by folder or extension, never by substring. A "glossary" substring once swallowed `glossary-page.ts`. Run regen, then check every staged deletion is absent on MERGE_HEAD.
