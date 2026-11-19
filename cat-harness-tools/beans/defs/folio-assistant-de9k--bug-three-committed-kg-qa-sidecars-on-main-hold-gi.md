---
# folio-assistant-de9k
$schema: bean/1.0.0
title: 'BUG: three committed kg-qa sidecars on main hold git conflict markers, and every reader treats them as empty'
status: completed
type: bug
priority: critical
created_at: 2026-10-01T08:47:14Z
updated_at: 2026-10-06T06:10:00Z
parent: folio-assistant-3fva
---

Arc `3fva`, found by reader audit `gxvk` (`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md` §4.1, **C1**). **Live on `main` today, and not blocked on `16ei`.**

## The defect, measured
Three committed `kg-qa/v1` sidecars on `origin/main` (`cdb0a018`) hold git conflict markers (`<<<<<<<< HEAD:` … `>>>>>>>> pr1-content-up:`):
- `cat-harness/test/results/bootstrap/kg-qa/skills/initialization-steps.kg-qa.json`
- `cat-harness/test/results/bootstrap/kg-qa/skills/human-agent-discussion.kg-qa.json`
- `cat-harness/test/results/bootstrap-tools/kg-qa/skills/render-kg-to-github-pages.kg-qa.json`

Command: `git grep -c '^<<<<<<<' origin/main -- cat-harness/test/results/bootstrap/kg-qa/skills/ cat-harness/test/results/bootstrap-tools/kg-qa/skills/`. They were introduced by `48aab0bd` ("Merge placement PR1 … onto main", 2026-10-01). Each hunk pairs one bootstrap sidecar with an unrelated `folio-paper-adapter` sidecar, which is a rename collision.

## Why nothing caught it
- `prose-code-pairs.ts:173` and `skill-voice-review.ts:131` catch the parse error and return `[]`. The next `kg:audit` write re-baselines these subjects and drops whatever they held.
- `readQaGraph` counts them as "3 unreadable" in `docs:pages` output, and nothing fails on that count.
- `cat-harness/schemas/kg-qa.test.ts:128` validates only `test/results/kg-qa/**`. These three live in the HOSTED homes.

## Readers
- `cat-harness/scripts/prose-code-pairs.ts:173-181`
- `cat-harness/scripts/skill-voice-review.ts:131-139`
- `cat-harness/content/pipeline/qa-graph-index.ts:172`
- `cat-harness/schemas/kg-qa.test.ts:128`

## Done when
- [x] the three files parse, and both sides of the conflict were checked for a `pair_attestations` entry that must be kept. They were restored, not regenerated: their subjects are gone, so `kg:audit` cannot regenerate them (see Summary)
- [x] a gate fails on an unparseable file anywhere under a declared `qa` directory, hosted homes included, with a planted conflict marker as the falsifier
- [x] `readAttestations` and `readVoiceReviews` report a corrupt sidecar as `unknown`; they do not return `[]`. **Not done here.** `prose-code-pairs.ts` and `skill-voice-review.ts` belong to F1's file set (audit §5, after `16ei`), so editing them now would collide with F1. The guard above already fails on the corrupt-file case these readers would swallow. — **verified 2026-10-06: F1 landed it. `AttestationsRead` (`cat-harness/scripts/prose-code-pairs.ts:202`) and `VoiceReviewsRead` (`skill-voice-review.ts`) carry `{ state: "corrupt" | "unknown"; reason }` with no list, and `evaluatePairsFrom` turns that into `unknown` and writes nothing back.**

## Summary of Changes

Done 2026-10-01 by a subagent of session 01LKpuPo, on worktree branch `worktree-agent-a7c4d332e2561cf85`. Not pushed.

- **`95514b1f`: restore.** The conflict was confined to the `totals` block. Rename detection paired each bootstrap sidecar with an unrelated `folio-paper-adapter` sidecar on main's side. Each file was restored to its main-side pre-merge parent `548fa5c3`. That parent's criteria body is byte-identical to the merged body, and its totals agree with `tally(criteria)` at 4/1/2. All three validate against `KgQaReportSchema`.
- **Attestations: 0 at risk, 0 lost.** Neither parent of any of the three files held `pair_attestations`. The other side of the collision was the three `folio-paper-adapter` sidecars (`critical-path-analysis`, `lean-environment-setup`, `content-block-review`). Each holds one `baseline` co-located attestation, and all three survived the merge under `folio-assistant-sci/test/results/kg-qa/skills/content/folio-paper-adapter/` with their paths moved.
- **They are now dead sidecars, reported and not deleted.** `kg:audit:check --instance bootstrap` / `bootstrap-tools` used to say SUBJECT UNREADABLE. They now say SUBJECT GONE: the submodules no longer carry `initialization-steps`, `human-agent-discussion` or `render-kg-to-github-pages`. Removing the sidecars is the owner's call under `deletion-requires-confirmation`.
- **`db346408`: guard.** `cat-harness/content/pipeline/qa-graph-integrity.ts` sweeps every instance's declared `qa` directories, which covers the hosted homes. It fails on a start or end conflict marker of any width (48aab0bd wrote 8-wide markers) and on unparseable `.json`. Its test plants the exact 48aab0bd shape. `kg-qa.test.ts` also gains a schema walk over every instance's `kgQaHomeFor` home. Both were falsified: putting the conflicted file back turns each test red.
- **Coordination:** PR #1769 does not touch these files. A comment there names them, the risk, and this fix.


## Owner ruling 2026-10-01 — the 3 SUBJECT-GONE sidecars are DELETED
Asked with options; the owner chose delete. Before deletion: each was about 1.06 KB, held 0 `pair_attestations` (checked against both parents of `48aab0bd` by the de9k agent), and described a skill that left the submodules during placement. Removed with `git rm` on branch `claude/quirky-davinci-ixuymr`.

## Closed 2026-10-06 on re-measured evidence

The last box was done by F1 after this bean was written; see the inline evidence. Closed by the 3fva QA-readers pass (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze), on evidence, not authorship.
