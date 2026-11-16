---
# folio-assistant-f3bh
$schema: bean/1.0.0
title: SUBGRAPH-READMES skips stored directories (5hox follow-up)
status: completed
type: task
priority: normal
created_at: 2026-10-02T13:58:10Z
updated_at: 2026-10-02T17:56:38Z
parent: folio-assistant-3fva
blocking:
    - folio-assistant-5hox
---

Found by the 5hox prep (2026-10-02). subgraph-readmes (in bootstrap-tools) lists results/ when a working copy is present and omits it when absent, so after 5hox a contributor who ran qa:fetch gets a different cat-harness/test/README.md from CI. The generator should skip any directory whose declaration carries storage (16ei).

## Done when
- [x] the generated README is identical with and without a fetched working copy

## Done on local branch qa-4l4d-f3bh, 2026-10-02 (NOT pushed)

Commit 41c552a94. The generator's caller is in this repo (`cat-harness/scripts/subgraph-readmes.ts`), so the skip is in the wrapper and the submodule is unchanged.

- `harnessInstances` drops every directory declaration carrying `storage` before planning. A stored directory gets no README and no findings from this run. Before the change, the twelve qa directories added twelve READMEs and twelve no-title findings when a working copy was present (108 READMEs) and none when absent (96).
- The parent's row (`results/` in `cat-harness/test/README.md`) already did not vary once 5hox lands, because the writer lists only what git would commit and every working copy is in `.gitignore`. `directory-storage.test.ts` keeps that list equal to the declarations.
- `qa-refresh` no longer claims `*/test/results/README.md` for readme:subgraphs.
- Fixture test (`subgraph-readmes.test.ts`): a git work tree with an ignored stored dir plans byte-identical READMEs and identical findings with and without its working copy.

Verification:

- verified: on a scratch branch with the 5hox deletion applied, `readme:subgraphs` plans 96 READMEs with 0 stale both with every working copy moved aside and with `qa:fetch --ref pr/1801` materialised, and `git status` stays clean after a write run.
- not yet (optional, needs a bootstrap-tools PR): outside a git work tree the writer's `filesIn` falls back to a directory walk that would still list a stored subdirectory in its parent's table. Closing that needs `SubgraphInput.stored` in `bootstrap-tools/scripts/subgraph-readmes.ts`, with `plan()` filtering files under any stored sibling.
