---
# folio-assistant-vihx
$schema: bean/1.0.0
title: 'merge-guard has no mergeability check: a stale green head with a valid ready marker passes while it conflicts with main (#1898)'
status: completed
type: bug
priority: normal
created_at: 2026-10-05T07:39:03Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-hfag
---

Reported by the merge manager 2026-10-05 (session_01VfkKocGaQW7Msro2t5S66U).

## The gap
None of merge-guard's seven checks (cat-harness/scripts/merge-guard.ts: base, ready-for-review, ready-marker, labels, ci, checklist, open-question) asks whether the head still merges cleanly into main. Check 5 judges the head's own `pull_request` runs, which tested the head merged with main AS IT WAS WHEN THE HEAD WAS PUSHED. Once main moves, a green head with a valid `ready: <sha>` marker keeps passing every check even when it now conflicts. #1898 did exactly this.

Related, not the same: the bean "A CONFLICTED PR CREATES NO pull_request RUN" is about a run never appearing; here the runs exist, are green, and are stale.

## Candidate check (not implemented: a gate change, owner decision)
An eighth check, `mergeable`:
- **Option A, PR API `mergeable` / `mergeable_state`.** Cheap, one field. But `mergeable: null` means "not computed yet", so it needs a third state ("could not determine", exit 2, never pass), which the sweep bean about UNKNOWN already measured.
- **Option B, `merge-tree --write-tree origin/main <head>` in the guard job.** Exact and local, with no GitHub computation lag. Needs a fetch of both refs, and the rc read directly, not through a command substitution (see the merge-verification bean on merge-tree's rc).
- Either way: conflicts give refuse (not-ready, "merge main into the head"), clean gives pass, and unknown never passes.

## Done when
The owner picks A or B (or both, with B authoritative); the check is added with a test built from #1898's conflicting state; and merge-queue.md lists it.

_2026-10-05T11:13:43Z_ — Claimed by claude/zealous-gates-3o9ma2-guard-mergeable — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Taken up 2026-10-05 (session_01VfkKocGaQW7Msro2t5S66U)

The owner said "fix issues" in chat, approving the fix. **Option A** was chosen: check 8 `mergeable` reads the PR API's `mergeable` / `mergeable_state` fields. `false` or `dirty` refuses not-ready. `null` is re-asked for up to 14 s, then reported `unknown` (never a pass). `true` passes, including `unstable`, `blocked` and `behind`. Option B (merge-tree in the guard job) has not been built. It stays available if A's computation lag proves a problem. The tests rebuild #1898's conflicting state (`mergeable: false`, `dirty`). Issue #2175. Branch claude/zealous-gates-3o9ma2-guard-mergeable.

## Completed on landed evidence
Landed on main in PR #1898 (Placement PR6 (apcg): library/ingestion split — merge-guard mergeability check against main).
