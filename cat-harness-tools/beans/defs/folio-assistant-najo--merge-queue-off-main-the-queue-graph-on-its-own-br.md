---
# folio-assistant-najo
$schema: bean/1.0.0
title: 'MERGE QUEUE OFF MAIN: the queue graph on its own branch store, so a steward can record a decision without opening a PR'
status: completed
type: task
priority: normal
created_at: 2026-10-04T08:20:32Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-hfag
---

## Brief

**What and why.** `beans/queue/` holds no entries — only its README — and the reason is
structural. `main` is authoritative for `beans/`, so an entry reaches it only through a PR,
and the owner has ruled that the merge steward does no development work: it must not open
PRs of its own, because that has it setting its own priority in the queue it manages,
spending the CI the queue is starved of, and judging its own head. So the one actor whose
decisions the graph records is the one actor that cannot write to it. The owner's answer is
two-part: the edited-in-place status comment on each PR is the record for now (already
live), and the queue graph moves to a branch store. This bean is the second part.

**What I know, with provenance.** The branch-store mechanism is built and live on `main`:
`scripts/branch-store.ts` (`mountTip`, `pendingMountChanges`, `pushMount`, splice writes
carrying `expect`), `state:mount` / `state:push` fanning out over every declared tip-keyed
graph, `graph-read.ts`'s four read states and `resolveBeanDefs`'s `unreachable`. The
precedent is arc `fs43` (beans/todos onto `cat/cat-harness/{beans,todos}`); `9ofm` row D is
the state this must not collapse — a checkout that cannot reach the graph reporting "no
decisions recorded, all clear" and exiting 0 (`dh4f`). The queue is `state` by
`content-context-and-state-graphs`'s one question, and the `merge-queue` kind already
declares `holds: "state"`. The entry schema exists (`schemas/merge-queue.ts`) and is not
redesigned here. Nesting is declared FROM WITHIN (STRICT, owner 2026-09-22), so the
declaration stays the `queue` entry in `beans/beans.json` and gains `"subgraph": true`
(bean `cmsl`) plus its `source` — an instance-level entry at `beans/queue/` would be a
declaration reaching down a path, which that ruling forbids.

**How, and what would falsify it.** Seed `cat/cat-harness/merge-queue` from the current
directory, declare the source and remove the tracked copy in ONE change (`tipPresence`:
"land both, or neither"), then a reader with the four states and a steward writer that
splices to the branch. The falsifier is CI: `check:declared-dirs` reports `unmounted` for a
cut-over graph nothing mounted, and CI mounts nothing today — that gate row is open work on
#2052. If the gate cannot be made honest without duplicating #2052's answer, the move is
blocked on #2052 rather than on this bean, and saying so is the result.

**Not doing.** Not redesigning the entry schema. Not writing a fabricated queue entry to
make the graph look used (the reason bean `30jr` left its tile box open). Not cutting
`beans/` itself over — that is `9ofm` / `p3ny`.

## Done when
- [x] `cat/cat-harness/merge-queue` seeded with a `state-manifest/v1` manifest, declared in `special-branches.json`
- [x] the `queue` entry declares its branch source, and the tracked copy leaves `main` in the same change
- [x] a reader that keeps `absent` / `declared-but-absent` / `unreachable` / `read` apart and THROWS rather than returning an empty queue
- [x] a steward write path that records a decision with no PR to `main`
- [x] `bun run cat gates` green, or the blocker named with its measurement

## Closed 2026-10-10 on landed evidence

Landed on main across PR #2065 (code & CLI tooling), PR #2091 (decision capture), and PR #2140 / commit `8f55441e5a83` (which cut over `beans/` containing `queue/` to branch mounts off `main`). Child cutover bean `ugxd` is completed.

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [ ] `cat/cat-harness/merge-queue` seeded with a `state-manifest/v1` manifest, declared in `special-branches.json`
- [ ] the `queue` entry declares its branch source, and the tracked copy leaves `main` in the same change
- [ ] a reader that keeps `absent` / `declared-but-absent` / `unreachable` / `read` apart and THROWS rather than returning an empty queue
- [ ] a steward write path that records a decision with no PR to `main`
- [ ] `bun run cat gates` green, or the blocker named with its measurement

_2026-10-16T06:30:00Z_ — Store reconciliation: status `in-progress` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: in-progress, cat-harness-tools: in-progress). Evidence: closed in the folio-assistant store copy (2026-10-10); commit 8f55441e is on folio-assistant main. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
```
