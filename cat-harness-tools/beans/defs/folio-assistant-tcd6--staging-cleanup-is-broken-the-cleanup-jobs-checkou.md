---
# folio-assistant-tcd6
$schema: bean/1.0.0
title: 'STAGING CLEANUP IS BROKEN: the cleanup job''s checkout omits submodules, so rm -rf runs and the push never does — 6 consecutive failures, 80 previews, 47 for closed PRs'
status: completed
type: bug
priority: high
parent: folio-assistant-1xhc
created_at: 2026-10-02T07:01:24Z
updated_at: 2026-10-07T05:10:00Z
---

Found 2026-10-02 while trying to remove staging previews by hand, and the
root cause turned out to be why they could not be removed at all.

## The failure

`feature-staging.yml`'s `cleanup` job checks out the platform with no
`submodules`. `cat-harness/schemas/graph-kind-registry.ts` imports
`../../bootstrap-tools/schemas/graph`, and `bootstrap-tools` is a SUBMODULE,
so every platform script the job runs dies:

```
error: Cannot find module '../../bootstrap-tools/schemas/graph'
  from '.../source/cat-harness/schemas/graph-kind-registry.ts'
```

**The order of the step is what makes this worse than a missing cleanup.**

1. retire the record — `staging-record.ts` dies, but is guarded with
   `|| echo "::error..."`, so the step continues;
2. `rm -rf "pages/STAGING/$SLUG"` — **runs**;
3. `render-log.ts` — dies, and under `bash -e` this aborts the step;
4. the commit and the push **never happen**.

So the preview is deleted in the runner's working copy and left untouched on
`gh-pages`. A cleanup that reports failure having changed nothing, which from
outside the job looks like a cleanup that ran.

## The measurement

| | |
|---|---|
| consecutive failed `pull_request_target` runs | **6**, 2026-10-01 19:34Z → 2026-10-02 06:26Z |
| previews on `gh-pages` | **80** |
| total size | **19,966 MB** |
| with **no open PR** (reclaimable) | **47**, 10,497 MB |
| with an open PR (must keep) | 33, 9,470 MB |

`qj9a` measured the published tree at **2.67 GB on 2026-09-25**. Seven days
later `STAGING/` alone is 19.5 GB. That growth is this defect: nothing has
been successfully removed in between.

**Reclaiming all 47 does not fix the budget** — 9.5 GB would remain, against
GitHub's 1 GB Pages limit, because the per-preview size is now ~250 MB. The
size question is `qj9a`'s, and it stays open; this bean is only about why
removal stopped working.

## What I could NOT determine

Whether Pages is still publishing. The Pages API returns nothing for this
token and `github.io` is blocked by this container's proxy, so I could not
observe the served site. Not reported as either healthy or broken.

## Summary of Changes

- `feature-staging.yml`: `submodules: true` on both platform checkouts —
  `cleanup` (the verified failure) and `cleanup-dispatch` (same shape).
- `folio-staging.yml`: the same on its three `litlfred/folio-assistant`
  checkouts, which run 14 platform scripts between them. Same class, found by
  the gate below rather than by a failing run.
- **`scripts/check-workflow-submodules.ts`** — a job that RUNS a platform
  script must have CHECKED OUT the submodules. It discovers the pairs from the
  YAML, so a new job is covered the day it is written; a hardcoded list would
  be the `check-declared-assets` defect a third time.
- Verified by reproducing: with the fix reverted the gate names
  `feature-staging.yml › cleanup (line 1452)`, the exact job that failed six
  times; with the fix it is green.
- 15 tests. Registered in `package.json`, wired into `code-quality-gates.yml`
  beside `check:ci-invocations`, classified harness in
  `partition/instance-rules.ts`.

### The rule is conservative on purpose

A first draft paired each script to the checkout it came from and left **18 of
them undetermined** — the paths are written `source/x.ts`, `../source/x.ts` and
`"$PLATFORM_DIR/x.ts"` in three jobs of one repository, and both halves of the
job with the actual defect fell into the undetermined bucket. A rule whose
answer is mostly *"cannot tell"* protects nothing. So the rule became: if a job
runs any platform script, **every** non-publish checkout in it must carry
submodules. It can over-report; the remedy is one harmless line, and the
alternative is a silently broken cleanup.

A checkout of a publish branch (`gh-pages`, `inputs.publish_branch`) is exempt
— built output, never the platform's source.

### Resolution

- [x] Code defect resolved: `submodules: true` added to cleanup checkouts in `feature-staging.yml` and `folio-staging.yml`. Tested and verified in PR #1844 (`c7cb4ab0913cb8b0e39dc170d526df47aff3e042`).
- [x] Enforced by CI gate `check:workflow-submodules` (`cat-harness-tools/scripts/check-workflow-submodules.ts`), ensuring any workflow job that runs platform scripts checks out submodules. 15 unit tests pass in `workflow-submodules.test.ts`.
- Operational deletion of historical preview directories on `gh-pages` is an owner action governed by `deletion-requires-confirmation.md` and tracked in `qj9a`.

Related: `qj9a` (staging size and what `critical` asserts), `oz5w` (cleanup vs
branch reuse), `plj1` (the reporting tool that acted), `6pfo` (the retired
record this job writes).

_2026-10-07T05:02:47Z_ — Claimed by claude/tcd6-close-on-evidence — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence

Closed on evidence per AGENTS.md bean discipline:
1. Landed on `main` in PR #1844 (commit `c7cb4ab0913cb8b0e39dc170d526df47aff3e042`: *"Staging cleanup could not run, and retirement did not stick — fix both, and gate the first (#1844)"*).
2. `feature-staging.yml` and `folio-staging.yml` updated with `submodules: true` on platform checkouts.
3. Created `cat-harness-tools/scripts/check-workflow-submodules.ts` and 15 tests in `cat-harness-tools/scripts/tests/workflow-submodules.test.ts` (all 15 pass).
4. `bun run cat check:workflow-submodules` passes cleanly across all 36 workflow files.
5. Bean hygiene tests pass.
