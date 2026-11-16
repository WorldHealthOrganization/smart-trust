---
# folio-assistant-vq2g
$schema: bean/1.0.0
title: Two bean FILES share one id, and no gate catches it
status: completed
type: bug
priority: normal
created_at: 2026-10-03T02:40:59Z
updated_at: 2026-10-07T11:50:40Z
parent: folio-assistant-1xhc
---

Found 2026-10-03 by the first run of `milestone-rollup.ts`, not by looking for
it: the module reported `openTotal - orphanOpen = 149` while the sum of the
per-milestone bars was 148, and the board was about to render both.

## The measurement

```
beans: 675 files · distinct ids: 674 · duplicated ids: 1
  folio-assistant-t3n8 -> beans/defs/folio-assistant-t3n8--harness-display-names-every-instance-declares-a-hu.md
                       |  beans/defs/folio-assistant-t3n8--the-archive-rung-stages-but-can-never-promote-and.md
```

Two unrelated subjects — harness display names, and the archive rung — under
one id.

## Why this is worse than an ordinary duplicate

`AGENTS.md` already records that `beans create` is not idempotent and dedupes
on nothing, and the bean case is called the strictest instance of
`deletion-requires-confirmation` **because a bean id is referenced from
commits, issues and other beans**. So an id held by two files makes every such
reference ambiguous, and nothing in the store says which was meant.

It also silently corrupts any count taken over files rather than ids, which is
how it was found. `milestone-rollup.ts` now counts over distinct ids and
reports `duplicateIds` rather than absorbing it — that is a guard on one
reader, not a fix.

## No gate catches it

All three bean gates are GREEN on this store, measured the same day:
`check:bean-front-matter`, `check:bean-parents`, `check:bean-bodies`. Each
reads a bean's own fields; none asks whether two beans answer to one name.
That is this epic's subject from the other side — not a gate that fired and
was ignored, but a question no gate asks, which is equally invisible from a
green run.

## Done when

- [x] A gate refuses a bean id held by more than one file, with both paths named
- [x] The gate is in the fast gate set, so `bun run cat gates` covers it
- [x] `folio-assistant-t3n8`'s two files are resolved by their owner (see below)

## NOT done here, on purpose

Which of the two files keeps `t3n8` is a judgement about somebody's work, and
no bean is ever deleted or renamed in this repository on an agent's initiative
(`deletion-requires-confirmation`). Both files are left exactly as they are.
The remedy needs the owner, and re-identifying one of them also means fixing
every reference to it — which is the cost the gate exists to stop recurring.

_2026-10-06T19:44:02Z_ — Claimed by claude/vq2g-duplicate-bean-files — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence
- Resolved by bean `folio-assistant-4vg7`:
  - `cat-harness-tools/scripts/check-bean-front-matter.ts` groups beans in `defs/` and `archive/` by `# <id>` and flags any id declared across multiple files with the `duplicate-id` defect kind, naming all colliding files.
  - Included in the fast gate set via `check:bean-front-matter` in `.github/workflows/code-quality-gates.yml`.
  - `folio-assistant-t3n8` collision resolved: the archive-rung file was renamed to `folio-assistant-ke1w` by its owner with references updated; the display-names file retained `t3n8`.
- Re-derived and verified:
  - `bun test cat-harness-tools/scripts/tests/bean-front-matter.test.ts` (28/28 tests passing, including tests covering cross-file duplicate ID reporting and defs vs archive collision).
  - `bun run cat check:bean-front-matter` (exit code 0; 0 duplicate ID defects across 1589 beans).
  - Independent scan over `beans/defs` confirms 0 duplicate IDs among all bean files.
