---
# folio-assistant-gdni
$schema: bean/1.0.0
title: merge:guard check 2 attributes a ready flip to the steward by time proximity
status: completed
type: bug
priority: normal
created_at: 2026-10-04T19:57:42Z
updated_at: 2026-10-07T11:50:40Z
parent: folio-assistant-d33q
---

Measured 2026-10-04: `merge:guard` check 2 refused the Merge Manager (session 019gRX6w) on **#2107** (ready flip 18:22:19Z) and **#1918** (ready flip 16:42:20Z) with "[defect] marked ready … beside a comment signed by the MERGING session". In both cases the PR's own session flipped it ready; the Merge Manager's comment near that time was an ACK / queue / hand-back note, not the flip. The owner's token is shared by all sessions, so the actor is always `litlfred`, and "beside" is a time-proximity heuristic.

Cost: each refusal routes the landing to another session, which in turn needs the owner's direct confirmation — a round trip per PR under a standing release.

## Done when
- [x] Check 2 attributes a ready flip only to a session whose signed comment *claims* the flip (e.g. a `marked ready` line) or is the PR's author/takeover session from the body's session line — never by time proximity to an ACK; or the steward's ACK/hand-back comments carry a marker that check 2 excludes. A test covers an ACK posted within seconds of another session's flip.

## Evidence
- Implemented `isStewardAckComment` and `claimsReadyFlip` in `cat-harness/scripts/merge-guard.ts` to recognize steward queue notes/ACKs (e.g. `**Merge queue ACK**`, `[ACK]`, `<!-- steward:ack -->`) and ready flip claims.
- Updated `checkReadyForReview` in `cat-harness/scripts/merge-guard.ts` to exclude steward ACK comments from attributing ready flips and avoid false positive separation refusals when a steward posts an ACK beside a flip.
- Added tests in `cat-harness/scripts/tests/merge-guard.test.ts` covering:
  - Steward ACK posted within seconds (+2s) of another session's flip (+4s) does not steal attribution or trip merging session refusal.
  - Steward ACK with HTML comment marker `<!-- steward:ack -->` within seconds passes.
  - Steward ACK alone without an owning session comment does not attribute the flip (refuses as not-ready, not defect).
  - Unit tests for `isStewardAckComment` and `claimsReadyFlip`.
- Verified with `bun test cat-harness/scripts/tests/merge-guard.test.ts` (78 tests pass).
- Verified `bun run typecheck`, `bun run cat lint`, and `bun run cat check:retired-front-matter` all pass cleanly.

_2026-10-06T22:35:23Z_ — Claimed by claude/gdni-check2-ack-attribution — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
