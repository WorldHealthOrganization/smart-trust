---
# folio-assistant-yhjr
$schema: bean/1.0.0
title: 'bootstrap-tools SubgraphInput.subdirs: supply subdirectory descriptions from the harness (~49 READMEs)'
status: completed
type: task
priority: normal
created_at: 2026-10-01T08:00:46Z
updated_at: 2026-10-01T09:39:44Z
parent: folio-assistant-3fva
---

Arc `3fva`, proposal §4 item 0.4. This is item 3 of the 2026-10-01 handover.

bootstrap-tools #2 (`9c00c534966`) accepts `SubgraphInput.subdirs`, but nothing supplies it, so no README has changed.

To do: resolve the subdirectory descriptions in `harnessInstances` in `cat-harness/scripts/subgraph-readmes.ts`, using `registry.get(kind)?.declarationFile`. `subgraph: true` already separates promoted directories from table rows, and the two partition. Then bump the submodule.

Risk carried over: 19 bootstrap-tools tests and `check:concepts` could not run without a sibling `bootstrap/` checkout. Run them with the pair checked out.

## Done when
- [x] the subdirectory rows render from declarations in every affected README
- [x] the bootstrap-tools tests run with the sibling checkout, and the result is recorded
- [x] `readme:subgraphs:check` is green

## Result (2026-10-01)

**The pin did not include `9c00c534966`.** `bootstrap-tools` was at `920c772`, an ancestor of it. Bumped to `9c00c53` (its `origin/main`). That commit also adds the generated-by banner to every README region, and bootstrap-tools `9c00c53` **fails 2 of its own tests against `bootstrap` `f70a56c`** (232 tests: 230 pass, 2 fail), so `bootstrap` was bumped with it to `ebfa406` (its `origin/main`, "generated-by notices"). With the old `bootstrap` pin, the writer also rewrites 5 READMEs inside `bootstrap/`.

**Harness half:** `subdirDescriptions()` in `cat-harness/scripts/subgraph-readmes.ts` reads the directory's own `registry.get(kind)?.declarationFile`. It takes only entries without `subgraph: true` (`directories[]`, plus `skills.json`'s `topics[]`, which declare a path and a description in the same way). It takes only single-segment paths, so `defs/archive` is not a row. Undeclared or description-less rows keep the file count. A `concern-groups/v1` file declares only codes, so it supplies nothing. Fixture tests are in `cat-harness/scripts/tests/subgraph-readmes.test.ts`.

**How many READMEs gained descriptions: 6, not ~49** (16 rows): `beans/` (3), `todos/` (2), `cat-harness/docs/` (2), `cat-harness/skills/` (7), `folio-assistant-core/skills/` (1), `agent-skills/skills/voices/` (1). About 59 READMEs still show a count on at least one row, because no declaration file describes those subdirectories. Most of those directories have no declaration file at all, so absent stays absent. 96 READMEs changed in total, almost all because of the banner the bump brings.

**bootstrap-tools tests, with the sibling `bootstrap/` present (`ebfa406`):** `bun test .` gives 232 pass and 0 fail, with no skips. `check:concepts` passes ("no outside concept is named"). The 19 tests the previous session could not run now run.

**Fallout from the bump, regenerated here:** `render:bpmn` (3 new SVGs), `processes:viz`, `glossary:export:bootstrap`, and `gen-uml-overview` (bootstrap-tools now has processes and scenarios). `cat-harness/content/pipeline/readme-sections.ts` now emits the same generated-by banner as bootstrap-tools' writer for the `kg:*` sections it borrows. Without it, the two writers disagree on `bootstrap/README.md`.

**Left (upstream):** `readme:sync:all:check` is red on `bootstrap-tools/README.md` (`kg:processes`, `kg:roles`). bootstrap-tools' own committed README is stale against its own generator. `scripts/readme-sections.ts --root <absolute>` reports it stale. Run with `--root .`, it passes, because `bootstrapTermTargets(dirname("."), …)` finds no `bootstrap/` and links no terms. The fix is a bootstrap-tools commit (regenerate with an absolute root, or resolve `root` first). It cannot be fixed from this repo.

**Baseline comparison** (same commands, pre-change tree vs post-change): typecheck 0 errors on both, and eslint is clean on the touched files. `readme:subgraphs:check` had 3 stale on the baseline and is green after. Full `bun test` after the change had 39 failures across 28 files. I re-ran those 28 files on the baseline and after all the regeneration, and no failure is new; six baseline failures pass afterwards, which is probably timing. In the 23 gates red or unfinished in `bun run cat gates`, the only newly red gate is `readme:sync:all:check`, for the upstream reason above.
