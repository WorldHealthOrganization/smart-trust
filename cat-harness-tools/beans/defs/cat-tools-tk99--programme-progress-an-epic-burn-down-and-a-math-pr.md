---
# cat-tools-tk99
$schema: bean/1.0.0
title: 'PROGRAMME PROGRESS: an epic burn-down and a math-progress heat map as a board feed'
status: completed
type: feature
priority: normal
tags:
    - rehomed-from-core
created_at: 2026-10-10T16:33:42Z
updated_at: 2026-10-30T14:23:00Z
parent: folio-assistant-6lb8
---

**Rehomed 2026-10-10 from `litlfred/folio-assistant-core` bean `folio-assistant-hf2q`** by the owner's ruling (the code this bean changes lives in cat-harness-tools; the core copy stays as a pointer). Body copied verbatim below; history and rulings recorded there remain authoritative up to this date.


Recorded from the qou work-plan analysis, 2026-10-04 (session https://claude.ai/code/session_01NdDGeP1SyShmoUssLuRZ91). Not started: recorded so the gap has an owner. milestone-status.ts rolls up milestones; nothing draws an epic over time or chapter x {proved, sorry, axiom, conjecture open, active bean, verdict}. Depends on WORK TRACEABILITY and CONJECTURE REGISTER. Must follow board-diagram-interchange (folio -> board, never back) and say 'no data is not zero'.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The burn-down and heat-map feed belong to `scripts/milestone-status.ts` and the board generators in cat-harness-tools. It also depends on `ckej`. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Owner decision above — resolved

The rehome question (option 1) was settled by the owner's ruling of 2026-10-10: this bean IS the rehomed copy, so the question above is closed and must not be re-asked. Kept for history.

## Re-measured 2026-10-20 — blocked on beans outside this store

The body names two prerequisites, WORK TRACEABILITY and CONJECTURE REGISTER
(`ckej`). Neither has a bean in this store (`beans/defs` at `3420b76`), so the
dependency cannot be expressed as `blocked_by` here. Left `todo`; not
claimable until those land in whichever store holds them.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).


*2026-10-22T17:10:00Z* — Slice 1 (lane A, session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr; assigned by the coordinator, who asked that it not wait on ckej). PR litlfred/cat-harness-tools#559 adds `bun run cat epic:burndown -- <epic> [--ref] [--path] [--days] [--json]`. It reads the store's git history, one snapshot per UTC day, and counts the closure beneath an epic the way milestone-rollup does (archive included). A day the epic is absent reads as no data, never zero. History is used rather than `updated_at` because edits outside the CLI do not bump it (the index store's 1l13 closed on 10-22 and reads 10-10).

**Still open, and why each waits:**
- **Heat map** (chapter × {proved, sorry, axiom, conjecture open, active bean, verdict}): needs the conjecture register (ckej) and work traceability. Unchanged.
- **Board feed:** the board renders a committed projection (gen-docs-pages writes `milestones` into `assets/beans/index.json`). A burn-down there needs the store's history at publish time, and publish checkouts are shallow, and a state-branch store may be fetched at depth 1. Options to put to the owner before building:
  1. **(Recommended)** A per-day series appended by the state-push path. Each push adds today's counts to a small committed series, so publish needs no history. Cost: one writer, plus a file that grows by one row a day.
  2. Deepen the publish fetch of the store branch and compute at publish. Cost: a full-history fetch on every publish.
  3. Terminal and JSON only. No board feed.

*2026-10-24T14:25:00Z* — Copy sync (cat-harness-tools drain lane, session https://claude.ai/code/session_01RzLVMhhApyXYiw4bb9RwG8). The live record of this work is `folio-assistant-hf2q` on the folio-assistant bean branch, held by the "Drain KG tools beans" thread. Its 2026-10-24 notes say slice 1 is merged (#559, `d7cf0807b7`). The heat map's last blocker, CONJECTURE REGISTER `ckej`, closed at 2026-10-24T11:26Z (litlfred/folio-assistant-sci#66). The board-feed history question is now with the owner, and the recommended option is a daily job that appends one row to a committed series. That is because drains edit beans with plain commits, so a writer on `state:push` would miss most edits. Work on this goes through hf2q, not this copy.

## Completed slices (synced from `folio-assistant-hf2q`, 2026-10-30)

- [x] Slice 1 (`cat-harness-tools#559`, merged `d7cf0807b7` 2026-10-23): `bun run cat epic:burndown -- <epic-id> [--ref <ref>] [--path <defs-dir>] [--days <n>] [--json]` — computes day-by-day open/closed/other bean counts beneath an epic from the store's git history (`git cat-file --batch`), preserving "no data is not zero" (5 tests in `epic-burndown.test.ts`).
- [x] Slice 2 (`cat-harness-tools#755`, merged `10771f3e99` 2026-10-24T15:52:42Z): Chapter × `{proved, sorry, axiom, conjecture open, active bean, verdict}` math-progress heat map (`bun run cat math:heat`).
- [x] Slice 3 (`cat-harness-tools#768`, merged `af98510434` 2026-10-24T16:15:34Z, and `folio-assistant#2686`, merged `277511f` 2026-10-24): board feed history export (`gen-docs-pages.ts --burndown-history`, writing `assets/beans/burndown.json` with one series per open milestone and epic, plus the `docs-site.yml` flag).
- [x] Slice 4 (`cat-harness#665`, merged `c35d6bc` 2026-10-29): the board draws each goal's burn-down line from `assets/beans/burndown.json`.

_2026-10-24T14:45:00Z_ — Slice 2 (the heat map, box 2) is up as draft litlfred/cat-harness-tools#755: `bun run cat math:heat`. The board feed, slice 3, waits on the owner's answer to the history question. Session https://claude.ai/code/session_01RzLVMhhApyXYiw4bb9RwG8.

_2026-10-24T15:25:00Z_ — The owner chose option C: the board's history is read at publish from the bean store's git history. Slice 3 is up as draft litlfred/cat-harness-tools#768. It adds `gen-docs-pages.ts --burndown-history`, which writes `assets/beans/burndown.json` with one series per open milestone and epic. Still to do: a one-line folio-assistant `docs-site.yml` change to pass the flag, and slice 4, the board drawing the series. Session https://claude.ai/code/session_01RzLVMhhApyXYiw4bb9RwG8.

## 2026-10-24 19:21Z

The docs-site flag landed: folio-assistant#2686 (277511f). It takes effect once cat-harness-tools is repinned past af98510 (#768). Next: slice 4, where the board draws the series.

_2026-10-26T10:32:00Z_ — Verified merges: `litlfred/cat-harness-tools#755` (`10771f3e99`, 2026-10-24T15:52:42Z) and `litlfred/cat-harness-tools#768` (`af98510434`, 2026-10-24T16:15:34Z). Remaining: slice 4 (board drawing the series).

_2026-10-29T07:38:35Z_ — Completed: slice 4, the board draws each goal's burn-down line from assets/beans/burndown.json, merged as cat-harness#665 (c35d6bc). It shows on the live site once folio-assistant re-pins cat-harness past c35d6bc. Session https://claude.ai/code/session_01Qmmkt62KVMxDU9gjVV1mm2

_2026-10-30T14:23:00Z_ — Synced slices 1–4 completion evidence and `status: completed` from `folio-assistant-hf2q` (retired from `cat/cat-harness/beans` in `d7e9d84405` / `cat-harness-tools#459`, which had not matched `cat-tools-tk99` across the rehome id change).
