---
# folio-assistant-foaq
$schema: bean/1.0.0
title: fsh-guts:viz renders untracked local mount files, so a regen from a dirty mount stales CI
status: completed
type: bug
priority: normal
created_at: 2026-10-04T18:00:42Z
updated_at: 2026-10-07T11:50:40Z
parent: folio-assistant-d33q
---

Measured 2026-10-04 on #2103 (e33c7280eb): `merge:main`'s regen ran `fsh-guts:viz` against the LOCAL fsh-guts mount, which held workflow-engine logs written "capture undetermined, so local only" (`fsh-guts/logs/*.json` from `workflow_complete`). The viewer page `cat-harness/docs/fsh-guts/index.md` gained 43 lines for those files; CI's clean mount (147 files) saw it as stale and `fsh-guts:viz:check` went red. Restored main's page by hand.

## Done when
- `gen-fsh-guts-viz` lists only files the state branch tracks (ask git, not the disk — the same rule as `git-corpus.ts`), or the workflow engine stops writing untracked logs into the mount; and a test covers a stray untracked file in the mount not changing the page.

_2026-10-06T19:05:07Z_ — Claimed by claude/foaq-fsh-guts-viz-tracked — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence
- `cat-harness/scripts/gen-fsh-guts-viz.ts`: implemented `trackedRels(dir, repo)` reading `readMarker(repo, KIND).files` when `dir` matches the mount marker into path, excluding untracked local files (e.g. `fsh-guts/logs/*.json` or local scratch), and falling back to `walk(dir)` when not a mount.
- `test/fsh-guts-viz-checkout.test.ts`: added test `"a stray untracked file in the mount does not change the page"` verifying that creating an untracked file under `fsh-guts/logs/` does not alter `gutsFiles(dir)` nor `page(...)`.
- Tests passing: `bun test cat-harness/scripts/tests/fsh-guts-viz.test.ts` (4/4 pass), `bun test test/fsh-guts-viz-checkout.test.ts` (2/2 pass), `bun run cat fsh-guts:viz:check` (151 files clean).
