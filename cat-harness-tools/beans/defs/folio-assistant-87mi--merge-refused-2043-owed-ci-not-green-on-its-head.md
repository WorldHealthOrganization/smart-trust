---
# folio-assistant-87mi
$schema: bean/1.0.0
title: 'Merge refused: #2043 owed CI not green on its head'
status: completed
type: bug
created_at: 2026-10-04T14:30:41Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-1xhc
---

PR #2043, handed back by the Merge Manager on 2026-10-04 (BACKFILLED at 14:50Z: the hand-back was made as a PR comment and a queue entry only, without this bean. Owner: "Backfill + enforce").

## Refused
- `merge:steward` at 14:30Z: Rule_HeadNotGreen: conflict declared, own CI red.
- Queue entry (`beans/queue/litlfred--folio-assistant--2043.json`, status `waiting-on-author`): STATUS UNKNOWN on the 13:40Z all-PR review (open, not in the queue), triaged as: CI red on its head; conflicts with main again (declared paths).


## Roles
- Fix: whoever holds #2043: its author or a takeover session that names itself in the PR body.
- Land: the Merge Manager, through `merge:guard --merge` with the owner's yes.

## Brief
Takeover plan (measured state, ordered steps, owner questions): https://github.com/litlfred/folio-assistant/pull/2043#issuecomment-5980841341

## Report to
A comment on PR #2043, plus a message to the Merge Manager role.

## Done when
- [x] #2043 merges main cleanly (merge commit; `git submodule update --init` before staging; no dropped `*/test/results/*` files)
- [x] the owed `pull_request` CI is green on that head
- [x] the body names the owning session; `ready-to-merge` label; signed `ready: <head sha>`
- [x] `bun run cat merge:guard 2043` passes all 7 checks, and it lands (or the owner closes it)

_2026-10-07T02:38:14Z_ — Claimed by claude/87mi-close-on-evidence — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence

Closed on evidence of landed work:
- PR #2043 was merged into `main` via train #2113 in commit `c858234ad5f8` on 2026-10-04T17:42:26Z.
- Re-derived independently on 2026-10-07: PR #2043 state is `MERGED` with commit `c858234ad5f8` present in `main` history.


_2026-10-07T16:55:00Z_ — Closed on owner confirmation and verified evidence of landed work on `main`.

_2026-10-15T16:49Z_ — Block on `1xhc` lifted: this bean is completed (#2043 merged 2026-10-04). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


_2026-10-15T16:49Z_ — Block on `1xhc` lifted: this bean is completed (#2043 merged 2026-10-04). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-16T06:30:00Z_ — The note above is mirrored from the folio-assistant store (commit 0b8d249), where this edge was lifted on 2026-10-15; lifted here too (Owner ruling 2026-10-16, item 9). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
