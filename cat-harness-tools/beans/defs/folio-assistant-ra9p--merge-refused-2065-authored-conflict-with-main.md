---
# folio-assistant-ra9p
$schema: bean/1.0.0
title: 'Merge refused: #2065 authored conflict with main'
status: completed
type: bug
created_at: 2026-10-04T14:30:41Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-hfag
---

PR #2065, handed back by the Merge Manager on 2026-10-04 (BACKFILLED at 14:50Z: the hand-back was made as a PR comment and a queue entry only, without this bean. Owner: "Backfill + enforce").

## Refused
- `merge:steward` at 14:30Z: Rule_Refused: conflict refused, own CI missing-required.
- Queue entry (`beans/queue/litlfred--folio-assistant--2065.json`, status `waiting-on-author`): STATUS UNKNOWN on the 13:40Z all-PR review (open, not in the queue), triaged as: authored conflicts in check-declared-dirs.ts and subgraph-readmes.ts, quoted on the PR. No push for 4h. The decision-record draft (zmdo) builds on it.


## Roles
- Fix: whoever holds #2065: its author or a takeover session that names itself in the PR body.
- Land: the Merge Manager, through `merge:guard --merge` with the owner's yes.

## Brief
No takeover plan was written; the PR comments carry its state.

## Report to
A comment on PR #2065, plus a message to the Merge Manager role.

## Done when
- [x] #2065 merges main cleanly (merge commit; `git submodule update --init` before staging; no dropped `*/test/results/*` files)
- [x] the owed `pull_request` CI is green on that head
- [x] the body names the owning session; `ready-to-merge` label; signed `ready: <head sha>`
- [x] `bun run cat merge:guard 2065` passes all 7 checks, and it lands (or the owner closes it)

_2026-10-07T02:36:48Z_ — Claimed by claude/ra9p-close-on-evidence — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence

Closed on evidence of landed work:
- PR #2065 was resolved, approved, and merged into `main` by `litlfred` in commit `a46f8791571232b326f1df8230ed8086860ca391` on 2026-10-05T15:40:04Z.
- Re-derived independently on 2026-10-07: PR #2065 state is `MERGED` with commit `a46f87915712` present in `main` history.


_2026-10-07T16:55:00Z_ — Closed on owner confirmation and verified evidence of landed work on `main`.

_2026-10-15T16:49Z_ — Block on `30jr` lifted: this bean is completed (#2065 merged 2026-10-05). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


_2026-10-15T16:49Z_ — Block on `30jr` lifted: this bean is completed (#2065 merged 2026-10-05). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-16T06:30:00Z_ — The note above is mirrored from the folio-assistant store (commit 0b8d249), where this edge was lifted on 2026-10-15; lifted here too (Owner ruling 2026-10-16, item 9). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
