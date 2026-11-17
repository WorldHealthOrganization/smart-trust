---
# folio-assistant-dzzn
$schema: bean/1.0.0
title: merge-main declares subgraph indexes and content-addressed payloads
status: completed
type: task
priority: normal
created_at: 2026-10-05T11:15:17Z
updated_at: 2026-10-06T05:23:38Z
parent: folio-assistant-hfag
---

Issue #2176. `merge:main` refuses on `cat-harness/docs/subgraph/**` and `docs/payload/sha256/**` (no declared pattern). Payloads conflict as rename/rename with conflict-marked stage blobs, so plain take-base would `git rm` the branch's added payload (refused by `droppedInMerge`) and write marked bytes under a content-addressed name.

## Todo
- [x] owned-tree strategy: take MERGE_HEAD's blob, else HEAD's, else rm
- [x] patterns subgraph-index + subgraph-payload
- [x] fixture tests in merge-base.test.ts (rename/rename, both sides)
- [x] skill section + skill:register + subgraph:jsonld
- [x] validate, PR, ready-to-merge

## Done when
merge:main resolves a fixture where both sides changed a subgraph index and a payload, droppedInMerge passes at both checkpoints, and the PR is green.


## Summary of Changes

Landed in #2178: `merge:main` declares `docs/subgraph/**` and `docs/payload/sha256/**` as owned trees, so a base merge takes main's copy and regenerates.
