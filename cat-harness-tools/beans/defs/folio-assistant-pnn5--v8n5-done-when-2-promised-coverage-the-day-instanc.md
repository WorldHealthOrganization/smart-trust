---
# folio-assistant-pnn5
$schema: bean/1.0.0
title: 'v8n5 Done-when #2 promised coverage ''the day instance #2 declares a theme'' — that day came and nothing compares'
status: completed
type: task
priority: normal
created_at: 2026-09-30T21:24:19Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-1xhc
---

Found 2026-09-30 by becoming instance #2. Bean `7h3u` declared
`smart-trust/themes/`, which took the themes set from 1 to 2 — and that is the
condition `check-navbar-consistency.ts` said would close a gap.

## What the check promises at set size ≤ 1

```
NOTE: `v8n5`'s Done-when #2 — a surface must not fall back to the
      platform default for an instance that declares its own theme —
      is read over this set. At a set size of 1 there is nothing to
      COMPARE, so this reports the denominator and issues no verdict.
      The set is iterated rather than hardcoded, so instance #2 is
      COVERED THE DAY IT DECLARES ONE.
```

## What actually happens now that instance #2 exists

```
declaring a themes graph    2 of 17  (smart-trust, who-iris)
exit 0
```

The denominator generalised correctly — that part of the promise is kept, and
the set really is iterated rather than hardcoded. But past the
`themed.length <= 1` branch the script carries **a comment and no comparison**.
Nothing is read over the set. So the NOTE stopped printing and **no verdict
took its place**.

**A NOTE disappearing is not coverage arriving.** Before today the gap was
visible, in the check's own output, every run. Now it is invisible: the output
looks like an ordinary reported denominator, and a reader has no way to tell
that Done-when #2 is still unimplemented. That is `1xhc` exactly — the excuse
was the only thing making the absence legible.

## How it surfaced, which is the part worth keeping

`navbar-consistency.test.ts` asserted `out` contains *"issues no verdict"*, so
it went **red on the real corpus** the moment the set reached 2. The test was
RIGHT to fail: its name said *"at a set size of 1"* and that premise expired.
Had it been written to pass at any size, the transition would have been silent.

## NOT fixed here, and this is a reservation rather than laziness

Implementing the comparison means deciding **which theme may style which
surface**, and the code says three lines later that PR #1584 held exactly that
for the owner:

> And deliberately NO assertion about which theme may style a given surface.
> PR #1584 left exactly that open for the owner … Picking one here would answer
> a question the owner held, which is not a check's to answer.

So an agent implementing it now would answer the reserved question by the back
door. The gap is pinned by a test instead — `the size-1 NOTE is gone, and its
PROMISE is NOT yet kept` — which asserts the NOTE's absence so the state cannot
be mistaken for closed, and deliberately does not fail.

## Done when

- [ ] the owner rules what Done-when #2 should compare, given that a board
      styles a card only from `sticky`-kind themes and both declaring instances
      own non-sticky ones (`who-iris`: webpage + publication; `smart-trust`:
      webpage)
- [ ] the comparison is implemented over the ITERATED set, and FALSIFIED — an
      instance deliberately falling back to the platform default must make it
      fail, or it is a gate that cannot fire
- [ ] the pinning test above is replaced by the real one, rather than both
      existing

## Not established

Whether any surface currently DOES fall back to the platform default for an
instance that declares its own theme. Nobody has measured it — which is the
whole point of the missing check, and why this bean does not assert a defect
in the rendering, only in the coverage.

## Summary of Changes

Done by drain lane B on the owner's ruling (kind for kind): cat-harness-tools#115 — webpage held to _data/instance-themes.json (a miss blocks); sticky and publication have no instance-scoped surface (advisory); an unloadable themes.ts reads unknown. Note: who-iris and smart-base themes.ts do not load at folio-assistant main's pins (moved-path imports), so the check reads unknown until #2529's re-pin.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Owner decision

(Lane B drain, 2026-10-10: put in pick-one form so it is answerable without reading the whole bean.) What should `check-navbar-consistency.ts` compare for an instance that declares its own theme?

1. **(Recommended)** **Kind for kind:** a surface of kind K on that instance's pages must use the instance's own K-kind theme whenever it declares one (webpage → webpage, publication → publication). Boards and cards fall back only because no `sticky` theme is declared. Falsified by an instance with a webpage theme rendering a page in the platform default.
2. **Webpage only:** compare just the `webpage` surface, the one kind both declaring instances (who-iris, smart-trust) have.
3. **Any declared theme may style any surface:** fall back to the platform default only when the instance declares none at all.
4. **Retire v8n5 Done-when #2,** and remove the pinning test with a reason.

**Default if no answer:** no change. The pinning test (`the size-1 NOTE is gone, and its PROMISE is NOT yet kept`) stays, and nothing is compared.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1, kind for kind:** a surface of kind K on an instance's pages uses that instance's K-kind theme when it declares one, and falls back to the platform default only for kinds it doesn't declare.


## Summary of Changes

Done by drain lane B on the owner's ruling (kind for kind): cat-harness-tools#115 — webpage held to _data/instance-themes.json (a miss blocks); sticky and publication have no instance-scoped surface (advisory); an unloadable themes.ts reads unknown. Note: who-iris and smart-base themes.ts do not load at folio-assistant main's pins (moved-path imports), so the check reads unknown until #2529's re-pin.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Owner decision

(Lane B drain, 2026-10-10: put in pick-one form so it is answerable without reading the whole bean.) What should `check-navbar-consistency.ts` compare for an instance that declares its own theme?

1. **(Recommended)** **Kind for kind:** a surface of kind K on that instance's pages must use the instance's own K-kind theme whenever it declares one (webpage → webpage, publication → publication). Boards and cards fall back only because no `sticky` theme is declared. Falsified by an instance with a webpage theme rendering a page in the platform default.
2. **Webpage only:** compare just the `webpage` surface, the one kind both declaring instances (who-iris, smart-trust) have.
3. **Any declared theme may style any surface:** fall back to the platform default only when the instance declares none at all.
4. **Retire v8n5 Done-when #2,** and remove the pinning test with a reason.

**Default if no answer:** no change. The pinning test (`the size-1 NOTE is gone, and its PROMISE is NOT yet kept`) stays, and nothing is compared.

### Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1, kind for kind:** a surface of kind K on an instance's pages uses that instance's K-kind theme when it declares one, and falls back to the platform default only for kinds it doesn't declare.



## Owner decision

(Lane B drain, 2026-10-10: put in pick-one form so it is answerable without reading the whole bean.) What should `check-navbar-consistency.ts` compare for an instance that declares its own theme?

1. **(Recommended)** **Kind for kind:** a surface of kind K on that instance's pages must use the instance's own K-kind theme whenever it declares one (webpage → webpage, publication → publication). Boards and cards fall back only because no `sticky` theme is declared. Falsified by an instance with a webpage theme rendering a page in the platform default.
2. **Webpage only:** compare just the `webpage` surface, the one kind both declaring instances (who-iris, smart-trust) have.
3. **Any declared theme may style any surface:** fall back to the platform default only when the instance declares none at all.
4. **Retire v8n5 Done-when #2,** and remove the pinning test with a reason.

**Default if no answer:** no change. The pinning test (`the size-1 NOTE is gone, and its PROMISE is NOT yet kept`) stays, and nothing is compared.



## Owner ruling 2026-10-11 (relayed by lane A, answered in their session)

**Option 1, kind for kind:** a surface of kind K on an instance's pages uses that instance's K-kind theme when it declares one, and falls back to the platform default only for kinds it doesn't declare.



## Summary of Changes

Built to the owner's option 1 (kind for kind) in cat-harness-tools#115 (merged 2026-10-11).
- `check-navbar-consistency.ts` judges every (themed instance, declared kind) pair through the exported `judgeThemeKinds`.
  - **webpage:** held to `_data/instance-themes.json` and to `head_custom.html` reading it. A miss is a blocking `theme-fallback`.
  - **sticky and publication:** no surface selects these by instance, so the instance falls back by construction. Reported as advisory `theme-kind-unconsumed`.
  - **an unloadable themes.ts:** unknown. `--check` exits 2 when nothing else fails.
- Falsification tests replace the pinning test.
- **Known:** at the current index.lock pins, who-iris and smart-base themes.ts don't load (imports of moved cat-harness files). So the real corpus reads 0 judged and 2 unknown until a re-pin. I sent lane A the re-pin request.
- **Follow-up, not filed here:** a platform surface that selects an instance's sticky or publication theme.
