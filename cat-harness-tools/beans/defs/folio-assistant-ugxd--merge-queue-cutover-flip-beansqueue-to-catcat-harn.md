---
# folio-assistant-ugxd
$schema: bean/1.0.0
title: 'MERGE QUEUE CUTOVER: flip beans/queue to cat/cat-harness/merge-queue and move the main entries, as its own small PR'
status: completed
type: task
created_at: 2026-10-05T11:46:51Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-hfag
---

Split out of #2065 (bean folio-assistant-najo) by owner ruling 2026-10-05 ("Land code now, switch later", relayed by the merge manager). #2065 lands the code only: merge-queue-store.ts, merge-queue-cli.ts + tests, the checker ownId/unmountable fixes, steward read-back, merge:queue:* scripts. The queue stays on main until this lands.

## What this PR does
- [ ] Steward PAUSES queue writes on main for the duration: any entry committed to main between the copy and the land is lost or conflicts.
- [ ] Copy every beans/queue/*.json on main (42 at 2026-10-05, last bc31c114d '#1918 landed') onto the tip of cat/cat-harness/merge-queue (seeded 8d652ac1, manifest authoritative:true, 0 entries) via branch-store's splice; verify byte-identical.
- [ ] In ONE commit: beans/beans.json queue entry gains subgraph:true + source {kind: branch, branch: cat/cat-harness/merge-queue, keyedBy: tip}; .gitignore /beans/queue/; special-branches.json merge-queue row; AGENTS.md state-table row; merge-queue.md and merge-queue-store.ts docblocks say cut over; git rm beans/queue/** — the owner's go on that deletion is required, given directly to the executing session. #2065's head carried all of these and its history has them to cherry-pick.
- [ ] state:mount mounts queue; check:declared-dirs 0 findings; check:kind-validators:require-all green mounted.
- [ ] Steward switches to bun run cat merge:queue:record.

## Done when
The PR lands, main tracks no beans/queue/*.json, and merge:queue:read lists every entry from the branch mount.

## Fails if
The entry count on the branch is lower than on main at flip time, or any entry differs byte-wise.

## Completed on landed evidence
Landed on main in PR #2065 (merge queue off main: the queue graph on its own branch store (najo)).
