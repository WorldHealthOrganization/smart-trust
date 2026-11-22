---
# folio-assistant-7mog
$schema: bean/1.0.0
title: The navbar stylesheets share 3 rules and 0 drift — a guard, not a merge (this bean's first premise was WRONG)
status: completed
type: task
priority: normal
created_at: 2026-09-24T17:39:39Z
updated_at: 2026-09-29T20:52:40Z
parent: folio-assistant-o3xy
---

The owner chose "1 2" on 2026-09-24: land the low-risk version first, then single-source the CSS. This is the 2.

## What shipped as 1 (PR #1264)

`nav_footer_custom.html` is a single `{% include %}` and composes no markup.
The sidebar's navbar is RENDERED by `lib/navbar.ts`. To keep the look
byte-for-byte, `docs-ui.css` gained the renderer's class names as ADDITIONAL
SELECTORS on rules it already had — one set of declarations, two vocabularies:

    .fa-harness-tab__label,
    .side-bar .fa-nav-label { ... }

Twelve rules, plus `.site-footer:has(.fa-nav-in)` beside `:has(.fa-nav-home)`.

## Why that is not the end state

**`navbarCss()` already declares all of it**, scoped under `.fa-nav`, and the
rail uses that. So the same visual facts are stated twice: once in 111 lines of
`navbarCss()` and once in the 185 sidebar lines of `docs-ui.css`. They were
hand-aligned, which is why the switch rendered identically — but hand-aligned
is exactly the state `sjic` says is not "one navbar".

The aliasing makes the duplication VISIBLE (each pair is now one rule with two
selectors) rather than removing it. That was the point of doing it first: it is
a smaller, verifiable step, and it leaves the old rules removable in one go.

## The shape of the fix

`navbarCss()` takes a declared SCOPE — `.fa-nav` for the rail, `.side-bar` for
the sidebar — and a generator writes the sidebar-scoped copy to a stylesheet
the site loads. Then the 185 lines go. The container rule
(`position:fixed;width:...`) is the exception: the theme owns `.side-bar`'s
geometry, so that rule is excluded rather than re-scoped, which is a THIRD
declared difference beside `hrefs`, `graphs` and `openControl`.

## What makes this risky, stated before anyone starts

1,283 pages. And `preview:site` applies no site-wide default layout where CI
does, so a local render UNDER-REPRESENTS the published one — a CSS migration
verified only locally is verified against a weaker rendering. Verify on the
staging preview, not just the local build.

## Original scope — WITHDRAWN by the 2026-09-24 measurement below

Kept as plain bullets, not boxes, so there is one checklist in this bean
(`shadow-checklist`); the live `## Done when` is at the end.

- `navbarCss()` takes a declared scope; the rail's output is byte-unchanged
- the sidebar-scoped stylesheet is generated and gated by a `--check`
- the 12 aliases and the 185 hand-written sidebar lines are gone
- before/after RENDERS match on the staging preview, not only locally
- `bun run cat gates` green

## MEASURED 2026-09-24, and it refutes the scope above — issue #1294

Everything above this line was written before anything was measured. **It is
wrong**, and it is kept rather than edited away because a scrapped premise
stops the next agent re-entering the dead end, while a quietly corrected one
leaves them wondering why the work is smaller than the title.

Both stylesheets parsed into selector → normalised-declaration maps and
compared:

| | |
|---|---|
| rules in `navbarCss()` | **37** |
| rules in `docs-ui.css` | **732** |
| same selector, **same** body — genuine duplication | **3** |
| same selector, **different** body — drift | **0** |
| `fa-nav*` selectors the site declares and the rail does not | **50** |

The three are `.fa-nav-open`, `.fa-nav-close`, `.fa-nav-close:hover`, and
`navbarCss()` already names one in its own comment: *"Same rule as
`.fa-nav-open` in docs-ui.css."*

### The 185 lines are not a restatement of the rail

The 50 site-only selectors are the sidebar's OWN behaviour and have no
counterpart in `navbarCss()`: `.fa-nav-middle`, `.fa-nav-icons`,
`.fa-nav-bottom__stack`, the persisted `:root[data-fa-nav="closed"]` preference
state machine, the `.fa-nav-js` scripted-enhancement class, and responsive
floors keyed to the theme's own column. The sidebar is a **superset with a
different container**, not a copy.

### And the 12 aliases are not duplication either

#1264 added the renderer's names as ADDITIONAL SELECTORS on rules that already
existed — one set of declarations carrying two vocabularies. That was the point
of doing it that way, and this bean then described it as the thing to remove.

So "delete the 185 lines" would have removed working behaviour to satisfy a
sentence in this file.

## What is actually worth doing, and is

**Zero drift today is not the same as cannot drift.** Three rules live in two
files with nothing checking they agree — the exact shape of the failure `sjic`
exists to stop, and how the open/close control came apart before #928
realigned it BY HAND. A hand-alignment drifts again.

`scripts/tests/navbar-css-single-source.test.ts` asserts the narrow durable
property: **where both files declare the same selector, they declare the same
thing.** Mutation-tested, two injected drifts, both caught.

It deliberately does NOT assert the two files are alike — that would fail on
the sidebar doing its job.

### The trade, recorded so it can be re-made rather than inherited

Generating the shared rules into a stylesheet the site loads is the truer
single-sourcing, and it stays available. For **three** rules it costs a new
generated asset, a link in the head include, a gate and verification across
1,283 pages. The guard pins the shared set as a literal, so the day that set
grows is a test failure and a decision — not something somebody notices.

## Done when

- [x] a gate fails if any selector is declared in both stylesheets with differing declarations
- [x] the guard names the shared set, so its size is observable rather than remembered
- [x] this bean carries the measurement and the corrected scope
- [x] `bun run cat gates` green


_2026-09-29_ — **Re-parented `p5wm` → `o3xy`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). Navbar stylesheet guard: a UI/accessibility subject; o3xy already sits under GOAL 2.

Claimed by claude/goal2-navbar-resume — 2026-09-29, session https://claude.ai/code/session_014nDNCRPYSuF4DiJUP7wMDq (GOAL 2 resume after the 09-25 usage-limit stall).

## Summary of Changes — closed 2026-09-29 on evidence

Every box in `## Done when` was already ticked; the bean had simply not been
closed. Re-verified on `main` at `f2d58d67b`, not taken from the ticks:

- `cat-harness/scripts/tests/navbar-css-single-source.test.ts` exists
  (landed in `7bc8e1dd1`) and passes: `bun test` → 3 pass, 0 fail.
- The withdrawn first list is kept as prose above so its reasoning is not lost.

The generated sidebar stylesheet stays available as a future trade (see
§"The trade"), not as open work here.
