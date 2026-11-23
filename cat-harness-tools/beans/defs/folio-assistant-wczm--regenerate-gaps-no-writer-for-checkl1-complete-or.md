---
# folio-assistant-wczm
$schema: bean/1.0.0
title: 'Regenerate gaps: no writer for check:l1-complete or smart-kg-l1 --entry; merge-base takes main''s side on a fast-forwardable gitlink; merge-main bot doesn''t clear needs-merge-human'
status: completed
type: bug
priority: normal
created_at: 2026-10-02T17:19:31Z
updated_at: 2026-10-04T07:12:57Z
parent: folio-assistant-hfag
---

Owner, 2026-10-02, via the merge-pipeline coordinator: one bean under the merge-pipeline epic `hfag` for these regenerate and merge-bot gaps.

## Overlap with `u7be` (read this first)

`u7be` ("MERGE GATE (e): four merge-steward gaps"), filed on PR #1887's branch and NOT on `main` when this bean was created, lists items (1), (2) and (4) below as its own (1), (2) and (4). Checked with `beans list` on `main` before creating this one; no bean on `main` covered them. When #1887 lands, the two must be reconciled. Keep ONE and mark the other `scrapped`, with a pointer; delete neither. Recommendation: keep this one, because it carries the evidence and sits under the pipeline epic, and scrap `u7be`'s copies of (1), (2) and (4), keeping its item (3) (no-CI heads in trains), which this bean does not cover.

## The gaps, with the evidence from 2026-10-02

1. **No regen writer for `check:l1-complete`, nor for `smart-base:smart-kg-l1 --entry`.** In merge trains 2 (#1876) and 3 (#1883), both were stale after `bun run cat regen` and needed `--write` / `--entry` by hand. Both run in `code-quality-gates.yml`, so regen reports "current" and CI then goes red.
2. **`merge-base.ts` takes main's side on a fast-forwardable gitlink.** In train 1 (#1869), #1764's submodule pins were regressed: the branch's pin fast-forwarded main's, and the resolution reverted it silently.
3. **The merge-main bot does not clear `needs-merge-human`.** The label stayed on PRs after the bot's later successful merge.

## Done when

- [x] (1) regen has a writer for each of the two checks, or a declared reason why it cannot; a test asserts regen-vs-CI parity for both
- [x] (2) a gitlink conflict takes the descendant pin when one side fast-forwards the other, and refuses when the pins diverge; tested both ways
- [x] (3) a successful merge-main run removes `needs-merge-human`
- [x] reconciled with `u7be` once #1887 lands (one scrapped with a pointer, neither deleted)

## Progress 2026-10-04
- [x] (3) DONE on this branch: `composeComment` returns `clearNeedsHuman` (true after a merged-and-pushed or already-up-to-date run, false after a refusal, unproved merge, blocked or failed push, or error), and `merge-main.yml` removes `needs-merge-human` when it is set AND the label is present. Tested in `merge-main-workflow.test.ts`; mutation-checked.
- [x] reconciled with `u7be`: its (1), (2), (4) point here; it keeps its own (3), no-CI heads in trains. Neither deleted.
- [x] (1) DONE: `check:l1-complete -- --check` was not a bare script, so regen never saw it — the gate now runs the named `check:l1-complete:check`, whose writer is `l1-complete:write` (`--write`; not `check:`-prefixed, or the registry counts it as an unrun check). `extract-smart-kg-l1.ts` gains `--all`, rewriting every entry `--check` examines, as `smart-base:smart-kg-l1:all`. Both declared in `WRITER_OVERRIDES`; `regen-after-merge.test.ts` asserts each reaches regen from the real workflow with a writer that exists.
- [x] (2) DONE on this branch: `merge-base.ts` resolves a conflicted gitlink (mode 160000) by ANCESTRY before the path patterns run — the descendant pin wins either way, diverged pins are refused, a pin the submodule lacks is could-not-determine. Found while testing: git resolves a fast-forward pin itself when it can see the history, so the conflict only arises in a SHALLOW submodule (`--depth 1`, as this repository's and CI's are), where `--is-ancestor` fails both ways; the resolver deepens (`--unshallow`) before deciding, else every fast-forward would read as "diverged". Tested on a real shallow submodule fixture both ways plus diverged; mutation-checked.

## Summary of Changes
All three gaps closed on PR #2051 and reconciled with `u7be` (which keeps only its own item 3). (1) regen now has a declared writer for both gates trains 2 and 3 could not repair; (2) a conflicted submodule pin is resolved by ancestry, deepening a shallow submodule first; (3) merge-main clears `needs-merge-human` after a clean run.



**Item 3 superseded (2026-10-04).** The owner ruled on 2026-10-03 to stop using `needs-merge-human` (commit 1732878, "Excise needs-merge-human"), so a clean run has no label left to clear. The `clearNeedsHuman` signal is dropped from this bean's PR when main is merged in. Items 1 and 2 stand.
