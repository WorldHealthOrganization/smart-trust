---
# folio-assistant-7how
$schema: bean/1.0.0
title: 'REGEN READS A STALE QA TREE: generators that read gitignored */test/results write wrong pages unless qa:working-copy ran first'
status: completed
type: bug
priority: high
created_at: 2026-10-06T09:15:31Z
updated_at: 2026-10-07T17:47:00Z
parent: folio-assistant-1xhc
---

Measured 2026-10-06 on #2267 (coordinator) and reported independently by session A, from #2268.

**What happens.** Since #2080 (5hox), the QA results tree is computed and not committed. Some generators read it from disk, at least `uml:overview` and `readme:subgraphs`. A container's local copy can be partial or stale. On #2267 only `kg-qa` was present, so `bun run cat regen` rewrote the QA overview without the `block-qa/v1` and `folio-test-run/v1` shapes. Locally it was green; CI, which runs `qa:working-copy` first, went red on `uml:overview:check` (10 files).

## Done when
- [ ] `bun run cat regen` either builds the QA working copy first, or refuses with a named remedy when it is absent or stale for HEAD. It never writes generated pages from a partial tree.
- [ ] A test with a partial results tree asserts that regen does not report the overview current.
- [ ] prepare-merge says it, if a manual step remains.



## Measured 2026-10-06 (coordinator, #2272): qa:refresh reverts UNCOMMITTED source edits

`qa:refresh` ends with *"restored N committed file(s) a writer rewrote"*. On #2272 it also reverted an uncommitted edit to `cat-harness/schemas/translation-tools.ts` that was a fix, not a writer's output. The working tree came back to HEAD's version mid-run, and the fix was lost silently until a grep caught it.

- [ ] `qa:refresh` restores only paths that a writer in THIS run wrote. Or it refuses to start on a dirty tree, naming the dirty paths. It must never revert a change it did not make.
- Until then: commit source changes BEFORE `qa:working-copy`.

_2026-10-06T19:05:28Z_ — Claimed by claude/speed-merge-loop — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## 2026-10-06 — in progress on claude/speed-merge-loop (issue #2319)

Dispatched for SPEED of the merge loop. The 6-step PR recipe (state:mount → regen → qa:working-copy → kg:detangle → regen, commit first) exists because of this bean, so fixing it collapses the recipe to one regen.

- [x] qa:working-copy stamps the copy (build/regen-cache/qa-working-copy.json): tracked-tree digest + QA-tree content digest. workingCopyState → current / stale / undetermined; only current skips a build. A failed step removes the stamp.
- [x] regen: beforePass hook rebuilds the copy before any pass whose tree moved; the QA paths it changed join the narrowed fixpoint's change set (and override a --changed decline in pass 1). A failed build exits 2.
- [x] gates: rebuilds when NOT CURRENT, not only when absent.
- [x] tests: cat-harness/scripts/tests/qa-working-copy.test.ts (13), incl. the falsifier that without the hook a regen settles on a page built from the old copy.
- [ ] measured before/after on a fresh merge of main
- [x] qa:refresh restore window narrowed to ONE writer's run, every restored path named with its writer (runRestoring). Narrowed, not removed: still commit before qa:working-copy.
- [x] prepare-merge says regen owns the QA copy.
- [x] uml:overview and readme:subgraphs make the copy current themselves (skill:register rendered from an absent copy, measured).
- [x] tree digest is of content (blob ids): a commit no longer stales the stamp.


_2026-10-06T20:40Z_ — OPEN FINDING, cause not identified: an uncommitted one-line edit to package.json, made in fa-work at 20:22:1x while `regen --changed` (QA build, then pass 1) was running, was gone when the run ended. The file's mtime was 20:22:19, so it was written right after the edit. It is NOT in qa:refresh's restored list (that list names 8 paths, all docs:pages / qa-sweep side effects). It looks like a lost update (something read package.json before the edit and wrote it after), but grep finds no writer of package.json outside tests. Rule until explained: commit before running regen, exactly as before.

*2026-10-07* — the restore-window hazard this bean narrowed was reproduced and fixed in litlfred/folio-assistant#2431: a sentinel edit to a clean cat-harness/scripts/agent-memory.ts was checked out from HEAD mid-run (git wrapper log, 14:13:56); four real uncommitted edits had been lost the same way that day. qa:refresh now restores only paths a writer declares in `rewrites` (measured from restore logs), leaves and names anything else, and backs up every restore under build/qa-refresh-restored/.

## Completed on landed evidence
Landed on main in commit e3ef4e916b9b / PR #2431 (Stale QA tree regen fix and restore hazard prevention).
