---
# folio-assistant-v9ah
$schema: bean/1.0.0
title: 'SELF-DECLARED-DONE NAMES ONLY MID-FLIGHT BEANS: every finding the check produces is one no session may act on, which is thux''s o5qj shape unfixed on the second axis'
status: completed
type: bug
priority: normal
created_at: 2026-09-25T17:34:43Z
updated_at: 2026-09-30T22:21:08Z
parent: folio-assistant-1xhc
---

`bean-store`'s `bean-self-declared-done` finding names a claimed bean whose every
`## Done when` box is ticked, and its implied action is that somebody closes it.
`0pes` settled who may: **a bean closes on EVIDENCE, not on authorship** — with
three obligations, the third of which is that **mid-flight is off limits**, where
mid-flight means a claim naming a branch, an open PR, *or a recent note*.

Those two rules interact, and nobody checked what comes out.

## Measured — re-derived from `origin/main` at `01d309202ae`, 2026-09-25 17:34Z

Every bean the check named, with the mid-flight signal beside it:

| bean | status | `updated_at` age | children | open children | mine to close? |
|---|---|---|---|---|---|
| `edx7` | **completed** | 29 h | 0 | 0 | already closed by someone |
| `0ytk` | in-progress | 46 h | 0 | 0 | no — recent note |
| `10uc` | in-progress | **71 h** | 0 | 0 | no — recent note |
| `ajx9` | in-progress | 45 h | 0 | 0 | no — recent note |
| `5a3l` | in-progress | 68 h | 26 | **16** | no — recent note AND 16 open children |

**Every one is within the 72-hour window**, which `bean-coordination` §"A quiet
claim" defines as the note being recent. So every finding the check produced
named something no session was permitted to act on.

**`edx7` moving to `completed` is why this was re-derived rather than quoted.**
An earlier pass in this session measured five in-progress beans; between then and
now a sibling closed one. A count in prose is a claim with a timestamp attached,
and this table's is in its heading.

## This is `o5qj`'s shape, and `thux` already fixed it on the other axis

`o5qj`: **a finding whose remedy is either unavailable or forbidden.** `thux`
found exactly that in `bean-quiet-claims` — an epic worked *through its children*
is quiet on its own file by design, so it accrued hours for doing what an epic is
for, and the only way to make the number go down was to edit the file for no
reason. The fix was to excuse a claim whose child moved recently, and to report
the excusal rather than subtract it silently.

`bean-self-declared-done` has the same defect on a different axis and no such
guard: it reports "all boxes ticked" without asking whether the bean is
mid-flight, so it cannot tell **finished and closable** from **finished and
somebody else's**. Two checks, one lesson, applied once.

## Two things that make it sharper than a duplicate of `thux`

**1. The unactionability is TEMPORARY, and the clock alone lifts it.** `10uc` sits
at 71 hours. Nobody need do anything for it to become closable — it crosses 72 h
within the hour and the mid-flight signal simply expires. So this is not a finding
that is permanently forbidden; it is one whose verdict depends on when you read
it, which is worse for a reader than a stable refusal.

**2. `5a3l` would still not be closable at any age.** It is an epic with **16 open
children of 26**, and an epic whose own boxes are ticked while sixteen children
are open is a defect *in the bean* rather than a bean ready to close. PR #1040
reached the same conclusion independently ("5a3l's 12 open children reviewed —
none closes"; it is 16 now). So the guard needs both halves: recency, and
`thux`'s parenthood relation pointing the other way.

## Options, not a decision

1. **Cross-reference mid-flight before reporting**, exactly as `thux` does for
   parenthood: excuse an all-ticked claim whose file moved inside
   `BEAN_QUIET_HOURS`, and **report the excusal** rather than dropping it —
   "nothing is self-declared done" and "they were all mid-flight" must not read
   identically (`dh4f`).
2. **Excuse an epic with open children outright**, on the `5a3l` case: its boxes
   are about the epic's own criteria and its children are the work.
3. **Leave the check alone and fix the ACTION text**, which is the cheaper half —
   say that an all-ticked claim within the window is somebody's live work, so a
   reader knows the finding is a heads-up rather than a task.

1 and 3 are not alternatives; 3 is worth doing whichever way 1 goes.

## What this bean is NOT

Not a licence to close those four. They stay exactly as they are: this bean
records that **the check cannot tell which of its findings are actionable**, and
nothing here re-statuses a bean.

## Done when

- [x] `bean-self-declared-done` distinguishes an all-ticked claim that is
      mid-flight from one that is closable
- [x] Whatever it excuses is REPORTED, not silently subtracted
- [x] The finding's action text says what a reader may actually do
- [x] The epic-with-open-children case is ruled on, either in the check or in the
      threshold's `basis`



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open working branch touches it; the sessions that held theme B (CI reliability, QA instruments, process) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

_2026-09-30T22:21:08Z_ — Claimed by claude/magical-archimedes-4qkfxp-v9ah — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Done — 2026-09-30 (session https://claude.ai/code/session_01SiFEMuTciyB681XP5WfcbB)

Options 1 and 3 together, as the bean said they should be, plus a ruling on the epic case in the check itself.
- A ticked claim touched inside `BEAN_QUIET_HOURS` (the same clock as `bean-quiet-claims`) is **mid-flight**. It is counted as `bean-self-declared-done-mid-flight`, not raised as a finding.
- A ticked parent with an **open** child is counted as `bean-self-declared-done-open-children`, not raised as a finding. It is keyed on the `parent` relation, as `thux` is.
- Only the rest are findings. Their summary says "untouched for over 72 h and with no open child", and the action now opens with "you MAY act on it", then re-derive before closing.
- The threshold's `basis` records the ruling.

**Measured on the real store**, main at 2026-09-30 22:3xZ: 11 claimed beans have every box ticked. **4** are findings (qj9a, lvk9, 10uc, sff8), **5** are mid-flight and **2** have open children. Before this change all 11 were findings, and most were ones no session was allowed to act on.

Tests: 3 new ones in `checks.test.ts` (mid-flight counted; an open child excuses at any age; closed children and past the window IS a finding). 76 pass.
