---
# folio-assistant-5gqn
$schema: bean/1.0.0
title: 'MERGE FRICTION: beans index.json should join oxka -merge set; harness.json must NOT'
status: completed
type: task
created_at: 2026-09-27T06:16:21Z
updated_at: 2026-10-07T04:37:00Z
parent: folio-assistant-1swy
---

Measured 2026-09-27 while driving #1439: **three** merges of `origin/main` in
about forty minutes, and `docs/assets/beans/index.json` conflicted on the third
one. `oxka` fixed this for three files and marked them
`linguist-generated=true -diff -merge` in `.gitattributes`. This file is a fourth
with the same shape and is not marked.

| file | conflicts paid today | marked `-merge`? |
|---|---|---|
| `cat-harness/test/results/audit-coverage.qa-results.json` | 3 | yes (`oxka`) |
| `cat-harness/docs/assets/beans/index.json` | 2 | **no** |
| `cat-harness/docs/_data/harness.json` | 1 | no — **and must stay unmarked**, see below |

## `beans/index.json` qualifies — checked, not assumed

`oxka`'s test is not *"is it generated"* but **"does its producer carry anything
forward from the existing file?"** — which is why 840 generated files under
`test/results/` are deliberately left unmarked, since `kg-audit` reads its own
sidecars back and `-merge` on one would discard a human's attestation silently.

`gen-docs-pages.ts` writes `BEANS_ASSET` (line ~1404) after `mkdirSync`, and
reads it back nowhere. Fresh document every run. It qualifies, and it is gated
by `docs:pages:check`, so a resolution taking the wrong side reddens rather than
ships.

## `docs/_data/harness.json` does NOT qualify, and this is the correction

`sync-docs-harness.ts:173-185` **carries the previous answer forward**: when
`detectRepoUrl` cannot read the git remote `origin`, it reads the committed
`harness.json` and keeps the repository URL already there, warning as it does
so. Its own docblock states the reason — *"Absent and unknown are different,
and the previous answer is the better of the two things to do with unknown."*

So marking it `-merge` would discard a carried-forward repository URL with
nothing said, in exactly the case where nothing else can supply one. That is the
hazard `oxka` reserved the `kg-qa` sidecars from, one file over.

**This corrects a claim I pushed in the merge commit for `c80a6950a09`**, which
said *"the other two conflict for the same reason and pass the same test that
bean states"*. One of the two does. `harness.json` does not, and the mistake was
reasoning from "it is generated" rather than applying `oxka`'s actual test — the
very substitution that bean was written to prevent.

## Done when

- [x] `.gitattributes` adds `cat-harness/docs/assets/beans/index.json` with
  `linguist-generated=true -diff -merge`, and NOT `harness.json`
- [x] the test `oxka` added (asserting the marked files' gates are still in the
  workflow) covers the new entry, so an unmarked-but-ungated file cannot be added
- [x] a comment at the `harness.json` entry's absence, or in that test, recording
  WHY it is excluded — otherwise the next author sees three generated JSON files
  with two marked and reads the third as an oversight

## Evidence

- Added `cat-harness/docs/assets/beans/index.json linguist-generated=true -diff -merge` to `.gitattributes` alongside comment explaining why `harness.json` is excluded.
- Updated `test/gitattributes.test.ts` to assert `cat-harness/docs/assets/beans/index.json` is marked `-merge`, assert `docs:pages:check` is present in `.github/workflows/code-quality-gates.yml`, and assert `cat-harness/docs/_data/harness.json` is NOT marked `-merge` with comment explaining that `sync-docs-harness.ts` carries forward repo URL state when origin is unknown.
- Ran `bun test test/gitattributes.test.ts` (7 pass, 0 fail).
- Ran `bun test test/bean-store-hygiene.test.ts` (3 pass, 0 fail).

_2026-10-07T04:36:10Z_ — Claimed by claude/5gqn-beans-index-gitattributes — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
