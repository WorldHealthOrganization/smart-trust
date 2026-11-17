---
# folio-assistant-9gkj
$schema: bean/1.0.0
title: 'Merge refused: #2094 owed CI not green on its head'
status: completed
type: bug
created_at: 2026-10-04T14:30:43Z
updated_at: 2026-10-07T14:55:47Z
parent: folio-assistant-1xhc
blocking:
    - folio-assistant-wekz
---

PR #2094, handed back by the Merge Manager on 2026-10-04 (BACKFILLED at 14:50Z: the hand-back was made as a PR comment and a queue entry only, without this bean. Owner: "Backfill + enforce").

## Refused
- `merge:steward` at 14:30Z: Rule_HeadNotGreen: conflict declared, own CI missing-required.
- Queue entry (`beans/queue/litlfred--folio-assistant--2094.json`, status `active`): ACK: Owner-approved 2026-10-04 ~14:00Z ("Approve all 6"). Lands once its owed CI is green and it merges cleanly with main.

## Roles
- Fix: whoever holds #2094: its author or a takeover session that names itself in the PR body.
- Land: the Merge Manager, through `merge:guard --merge` with the owner's yes.

## Brief
Takeover plan (measured state, ordered steps, owner questions): https://github.com/litlfred/folio-assistant/pull/2094#issuecomment-5980851089

## Report to
A comment on PR #2094, plus a message to the Merge Manager role.

## Done when
- [x] #2094 merges main cleanly (merge commit; `git submodule update --init` before staging; no dropped `*/test/results/*` files)
- [x] the owed `pull_request` CI is green on that head
- [x] the body names the owning session; `ready-to-merge` label; signed `ready: <head sha>`
- [x] `bun run cat merge:guard 2094` passes all 7 checks, and it lands (or the owner closes it)

_2026-10-07T02:40:30Z_ — Claimed by claude/9gkj-close-on-evidence — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence

Closed on evidence of landed work:
- PR #2094 was resolved and merged into `main` by `litlfred` in commit `167a180704c5` on 2026-10-04T20:48:40Z.
- Re-derived independently on 2026-10-07: PR #2094 state is `MERGED` with commit `167a180704c5` present in `main` history.


_2026-10-07T16:55:00Z_ — Closed on owner confirmation and verified evidence of landed work on `main`.
