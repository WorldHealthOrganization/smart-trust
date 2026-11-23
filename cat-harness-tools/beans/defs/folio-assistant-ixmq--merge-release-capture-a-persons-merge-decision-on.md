---
# folio-assistant-ixmq
$schema: bean/1.0.0
title: 'MERGE RELEASE: capture a person''s merge decision on the queue entry, bound to the SHA, and read it back at landing'
status: completed
type: feature
created_at: 2026-10-04T13:21:37Z
updated_at: 2026-10-07T17:37:00Z
parent: folio-assistant-hfag
blocked_by:
    - folio-assistant-najo
---

The PR's own agent records a PERSON's merge decision on the PR's queue entry, bound to the commit it was given for, and the merge path reads it back.

Requested by the owner 2026-10-04 (session https://claude.ai/code/session_01Ga3HjmX3ag9vTgZWDSmsFi): *"fill in gaps in merge process and send to Merge Manager. Agent working on PR should be able to capture human merge decision and associate it to merge queue bean"* — and, on where it goes: *"its a bean? put on special bean branch"*. The Merge Manager (session_019gRX6w8kzAX6wpHbgdyu3s) adopted the spec and asked this session to draft A+B+C against `najo`'s branch.

## The gaps (measured on main + #2065 head 8236dc6)

1. `Task_Release` (merge-train.bpmn) requires explicit confirmation or a verbatim, dated standing ruling — no schema holds it.
2. No "do not merge" verdict outside a train ejection.
3. Nothing binds an approval to the commit approved. Measured by the Merge Manager the same day: #2059, #2070, #2075 changed head between its green check and its merge.
4. The PR's agent cannot write it: `merge:queue:record` takes placement only.
5. Nothing reads it back at landing.
6. `TrainMemberEvidence` (outcome `merged`) does not name the release it executed.

## Done when

- [ ] A — `release` on the queue entry: verdict, decidedBy (human), decidedAt, authority (explicit | standing-ruling, verbatim + source), releasedSha, capturedBy.
- [ ] B — `bun run cat merge:queue:decide` writes it onto the entry on `cat/cat-harness/merge-queue`, linking `--beans`.
- [ ] C — read back: `merge:steward` shows release state per PR; `releaseCovers(entry, head)` is what `merge:guard` (#2000, `uoob`) calls before landing.
- [ ] D — `Task_Release` and `merge-queue.md` name the record and the command.
- [ ] E — `TrainMemberEvidence` links the release it executed (with `30jr`).

## Completed on landed evidence
Landed on main in PR #2091 (Merge release: capture a person merge decision on the queue).
