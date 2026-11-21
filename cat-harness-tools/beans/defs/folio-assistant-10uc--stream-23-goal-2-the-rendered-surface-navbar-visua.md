---
# folio-assistant-10uc
$schema: bean/1.0.0
title: 'RENDERED SURFACE: navbar, visualisers, stickies — GOAL 2''s stream, moved under GOAL 4 at GOAL 2''s sign-off'
status: completed
type: task
priority: high
created_at: 2026-09-22T18:09:11Z
updated_at: 2026-10-30T12:00:00Z
parent: folio-assistant-rwmf
---

## What this is

Stream 2 of 3 in the 2026-09-22 consolidation (see the sibling claims under
`vuip` and `yg29` for the stall measurement that prompted it). It owns **GOAL 2
(`p5wm`) — 39 open beans**, the largest single group in the store.

This is the stream where the artefact a reader judges actually appears: the LHS
navbar, the visualisers, the stickies, avatars and themes.

## What this stream owns

**Beans** — `p5wm` (39 open), including the `6lb8` folio-board epic and the
`o3xy` UI & accessibility epic nested under it.

### The path as this claim was written — SUPERSEDED 2026-09-22

This claim was created quoting `p5wm`'s eight-step path. Re-verified against the
store on 2026-09-22 as the claim's own first instruction required, and **four of
its steps were already finished**: `2krx`, `ivfw`, `5y4b` and `pb04` — plus
`1hvo`, the declaration layer, and `gjli`, which is a standing rule rather than a
step. `p5wm` now carries the repair and the withdrawal reasons.

**The live path is `b5f0` → `603s` → `6lb8` → `supn`.** Four steps — five when
this was written, and `hfkl` closed the same day.

Two notes this claim carried, both now corrected:

- **`b5f0` is not a UI bean** — still true, and better than stated. It holds the
  ruling that settles `603s`'s first open question, which file marks an instance,
  and **that ruling exists and has already landed in code**. It was ruled
  REPLACE on 2026-09-20 and then **REVERSED** on 2026-09-21: the standing answer
  is the PAIR, `<name>.json` (declaration) + `<name>.config.json` (config),
  resolved by `findDeclarationFile` rather than a fixed filename. `hfkl`'s
  trailer still says REPLACE and is the most findable — and wrong — statement of
  it. What is left is prose: `603s`'s recorded answer still names `harness.json`,
  a file that no longer exists.
- **`hfkl` is the cheapest real win** — cheaper than that: it was **already
  done**, and closed 2026-09-22 on evidence re-derived from `origin/main`. The
  reason given for it was void anyway. *"It unblocks `2krx`, which otherwise
  fires 19 findings on day one"* — `2krx` has been `completed` since
  2026-09-20, and it shipped *with* bootstrap's exemption as declared data, so
  those findings cannot fire.

**Pull requests on this surface:**

| PR | state | note |
|---|---|---|
| #955 | clean, **draft** | `624f` round 1 — sticky square in the dock is built and verified; requirement 2 (the art scrolls with the words) is **measured and deliberately not built**, with its spec removed rather than left as a vacuous `test.skip`. Decide whether round 1 ships alone. |
| #229 | stale since 09-18 | staging translation preview |

## First three moves

1. **Re-verify the critical path before acting on it.** Bean `k59d` records that
   `p5wm` specifically advertises blockers that are already complete. Do this
   before picking a bean off the path.
2. **`b5f0` then `hfkl`** — the ruling, then the cheapest unblock.
3. **#955: ship round 1 or hold it.** Its own body argues requirement 2 needs a
   mechanism change (the card does not scroll at all: `clientHeight ===
   scrollHeight === 318` on a 320 card, and the `overflow: hidden` above it is
   load-bearing). Shipping round 1 alone is defensible; say which and why.

## Blocked on the owner — do not guess these

`p5wm` records six: `yj32` (*"i wanted bootsrap/ harness/ etc as todos, not
landing page info"*, and what the writable store is), `6lb8` (the board's
persistence — a position is state, and `todos/` is committed, so two sessions
moving one note is a merge conflict in a generated file), `v1hw` and `jbx2`
(which write path), `h32d`, `g196`. Plus three that need somebody to **look at a
deployed page**: `alox`, `rptk`, and `o3xy` as a class.

A rendered page cannot be assessed from a description of it. Where this stream
needs eyes, it publishes a preview and asks — it does not substitute its own
reading.

## Not this stream

GOAL 1 / the KG (stream 1) and who-iris (stream 3). Note `yg29` **depends on this
stream**: who-iris is shown *through* a navbar section at
`<baseurl>/who-iris/...`, so `o7eq`'s URL rule is stream 3's delivery mechanism.
Coordinate on `o7eq` rather than deciding it unilaterally.

## Done when

- [x] `p5wm`'s critical path re-verified against the store, stale blockers
      withdrawn with their reasons — 2026-09-22. `check:stale-paths` reports the
      `p5wm:chain` baseline entry as no longer matching; removed from
      `stale-paths-baseline.json`, which is how that file shrinks rather than
      fossilises
- [x] `b5f0` ruling recorded and `603s`'s first open question closed —
      2026-09-22. The ruling was ruled, **reversed**, and had already landed;
      the standing answer is the pair `<name>.json` + `<name>.config.json`,
      resolved by `findDeclarationFile` rather than any fixed filename. `603s`
      carried a *superseded* recorded answer AND a supersession note that was
      itself stale by one ruling; both corrected
- [x] `hfkl` landed, `2krx`'s 19 day-one findings not fired — `hfkl` was
      already complete and closed 2026-09-22 on re-derived evidence; `2krx`
      shipped 2026-09-20 *with* the exemption, so the findings were never
      going to fire
- [x] #955 shipped or held with a stated reason — **merged 2026-09-22 on the
      owner's instruction, and the reason first given for it was WRONG.**

      It was marked ready for review at ~18:34Z with the argument that round 1
      is requirement 2's prerequisite rather than half of it. **The round-1 CSS
      had been withdrawn from that branch at 15:23Z**, three hours earlier
      (`bd7df18`, *"Defer to main's 624f: a sibling shipped it better, so mine
      comes out"*). The PR was assessed from its **body**, which still
      described round 1 as built, rather than from its diff. The file totals
      quoted as evidence — *"2 files, +51/−3"* — were real and misattributed:
      they were the two bean files, `4d22` (+47) and `7ofc` (+4/−3).

      That is `b5f0`'s own method rule — *read the artefact, not its name* —
      broken while citing measurements, which is the failure mode this stream
      spent the day finding in other people's beans.

      The withdrawal was verified rather than trusted: `624f` is `completed` on
      `main` and `aspect-ratio: 1` is live at `docs-ui.css:4549`. So what
      merged is two records, not code. The owner was told before it merged,
      and a correction is posted on the PR.
- [ ] The six owner-blocked beans asked as questions the owner can answer by
      selecting, with a preview URL where one is needed — **the six are two
      and a half**: `h32d`, `g196`, and half of `yj32`. Four were already
      answered elsewhere (`6lb8` via `db7g`; `jbx2`, `rptk` `completed`;
      `v1hw` + `yj32`'s write-path inside `yj32` itself). **One asked and
      answered 2026-09-22** — a declared graph with no viewer is SHOWN, inert
      and labelled; recorded on `603s` and `yj32`. Six decisions remain queued,
      each to be put in full when it is next, per `interaction-modality`
      §"More than one decision pending".

---

## Re-checked 2026-09-25 — stays open, and the health sweep's reading of it is wrong

This bean is reported by `bun run cat health` as *"`in-progress` with all 4 of its
Done-when boxes ticked"*. It is not.

**One box is `[~]`, not `[x]`:**

> - [~] The six owner-blocked beans asked as questions the owner can answer by

So the sweep counts `[~]` as ticked. That is a small defect in the sweep rather
than a fact about this bean, and it is worth knowing because it inflates the
"finished but open" population the sweep asks a person to act on.

**And that box is not an agent's to discharge.** `bean-coordination` obligation
2: *"A Done-when only a person can satisfy is not yours to discharge."* Six
owner-blocked beans waiting on owner answers is precisely that.

**Expiry** — required of any verified-done-but-not-closable exception, same
shape `bean-blocking` requires: re-check when the six owner-blocked beans have
answers, or on **2026-10-25**, whichever is first. If the six have been
answered or withdrawn by then, the box resolves and this closes on the next
sweep.


## Re-verified 2026-10-01 — session_01Cw8JgZEDT5VqQ5ergjdMjB (took over from the 2026-09-30 handover, #1260)

Every id below re-read from the store on `main` d1a5d6ea, not carried forward (`k59d`).

**Under p5wm:** 116 completed, 37 todo, 12 in-progress, 8 scrapped.

**#955 is no longer a decision** — merged 2026-09-23 (round 1 shipped alone); `624f` completed.

**The critical path, `b5f0 → 603s → 6lb8 → supn`, today:**

| bean | status | where it actually is |
|---|---|---|
| `b5f0` | todo | Done-when 1 (REPLACE vs pair) ticked on evidence today. 7u3g is SCRAPPED, not fixed — left for the owner. Owner questions 2 and 5 still open. |
| `603s` | in-progress | Its last box — the local/remote subgraph tab — is built in draft PR #1775 (owner's `owt6` ruling: on the page a tab opens). Closes when #1775 merges. |
| `6lb8` | in-progress | Waits only on `q2wm`. |
| `q2wm` | in-progress | XSS render hint built in draft PR #1777 on the owner's instruction. Lazy window fetch still has NO subject — no window fetches per card. So `q2wm` cannot honestly close, and with it `6lb8`. |
| `supn` | todo | Not started; behind `6lb8`. |

**Also from this session, in draft PRs:** `ob3m` findings 2, 4/5 (owner chose summary + 'also written' list), 8 and 9 fixed, 12 already on main (#1762); the viewer-rail header, per-visualiser sections and QA flags (#1757 → #1762). Still open on `ob3m`: 1, 3 (sticky half, left as authored), 6, 7, 11.

**Every one of these PRs is red only where `main` is** — placement-PR1 fallout (#1772): fix-up #1773 and the `Process_L2Dak` move. Nothing on this stream can go green before those land.

**Close this bean last**, as the handover said: when `603s`, `6lb8` (via `q2wm`) and `ob3m` close.

## 2026-10-06 — re-checked for closing: not yet

Checked on main f44d88fd9 by session https://claude.ai/code/session_01FrpbCpM7BWxGCPsu618MLr. This bean says to close it last, when `603s`, `6lb8` (via `q2wm`) and `ob3m` close. Today: `603s` completed; `6lb8`, `q2wm` and `ob3m` all in-progress; `supn` todo. Left open.

_2026-10-16T10:30:00Z_ — Renamed from 'STREAM 2/3: GOAL 2 — the rendered surface…': GOAL 2 (p5wm) was signed off 2026-10-05 and this stream moved under GOAL 4 (rwmf), so the old title named the wrong goal (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

_2026-10-21T18:13:00Z_ — Re-checked on `main` `3d586f5794`: `h32d`, `alox` (archived), `o3xy`, `ob3m`, and `603s` are all `completed`; only `g196`, `yj32`, `b5f0`, `6lb8` (waiting only on `q2wm`'s lazy-fetch box), and `supn` remain open. Changed `- [~]` on box 5 to `- [ ]` so `bun run cat health` (`DONE_WHEN_BOX`) counts 4/5 rather than falsely reporting 4/4 all-ticked.

_2026-10-21T19:52:00Z_ — Box 5 dropped its last clause, "`alox`/`o3xy` still need a PAGE link, not the site root": both are `completed` (see the 18:13Z note), and the 18:13Z un-tick left an unchecked clause naming `alox` as a precondition, which `check:stale-paths` refuses index-wide (`✗ 10uc [done-when]: its path routes through alox`). The box stays open for what remains: `g196`, `yj32`, `b5f0`, `6lb8`, `supn`.


_2026-10-16T10:30:00Z_ — Renamed from 'STREAM 2/3: GOAL 2 — the rendered surface…': GOAL 2 (p5wm) was signed off 2026-10-05 and this stream moved under GOAL 4 (rwmf), so the old title named the wrong goal (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

_2026-10-21T18:13:00Z_ — Re-checked on `main` `3d586f5794`: `h32d`, `alox` (archived), `o3xy`, `ob3m`, and `603s` are all `completed`; only `g196`, `yj32`, `b5f0`, `6lb8` (waiting only on `q2wm`'s lazy-fetch box), and `supn` remain open. Changed `- [~]` on box 5 to `- [ ]` so `bun run cat health` (`DONE_WHEN_BOX`) counts 4/5 rather than falsely reporting 4/4 all-ticked.

_2026-10-21T19:52:00Z_ — Box 5 dropped its last clause, "`alox`/`o3xy` still need a PAGE link, not the site root": both are `completed` (see the 18:13Z note), and the 18:13Z un-tick left an unchecked clause naming `alox` as a precondition, which `check:stale-paths` refuses index-wide (`✗ 10uc [done-when]: its path routes through alox`). The box stays open for what remains: `g196`, `yj32`, `b5f0`, `6lb8`, `supn`.

_2026-10-29T08:50:00Z_ — Re-checked (Lane B drain thread): `6lb8` is now completed (its last child `q2wm` closed today). Box 5 waits on `g196` (todo, the page-weight lane), `yj32` (todo), `b5f0` and `supn` (in progress, owner-held boxes). Left open.

_2026-10-30T12:00Z_ — Coordination stream bean. Every box except 5 is ticked. Box 5's remaining work is tracked on its own beans (g196, yj32, b5f0, supn), and 6lb8, 603s, ob3m and q2wm are completed. Nothing is owned by 10uc alone. (https://claude.ai/code/session_01Qmmkt7iaCtGYwZbW9x7eYe)


_2026-10-16T10:30:00Z_ — Renamed from 'STREAM 2/3: GOAL 2 — the rendered surface…': GOAL 2 (p5wm) was signed off 2026-10-05 and this stream moved under GOAL 4 (rwmf), so the old title named the wrong goal (owner choice, https://claude.ai/code/session_01NUrhvvMEwU5MmPW4L2w9jP).

_2026-10-29T08:50:00Z_ — Re-checked (Lane B drain thread): `6lb8` is now completed (its last child `q2wm` closed today). Box 5 waits on `g196` (todo, the page-weight lane), `yj32` (todo), `b5f0` and `supn` (in progress, owner-held boxes). Left open.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
$schema: bean/1.0.0
title: 'RENDERED SURFACE: navbar, visualisers, stickies — GOAL 2''s stream, moved under GOAL 4 at GOAL 2''s sign-off'
status: completed
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
title: 'RENDERED SURFACE: navbar, visualisers, stickies — GOAL 2''s stream, moved under GOAL 4 at GOAL 2''s sign-off'
```
