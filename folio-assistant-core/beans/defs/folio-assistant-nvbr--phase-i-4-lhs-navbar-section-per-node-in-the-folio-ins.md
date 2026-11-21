---
# folio-assistant-nvbr
$schema: bean/1.0.0
title: Phase I.4 — LHS navbar section per node in the folio instance (#223)
status: completed
type: task
priority: normal
created_at: 2026-09-18T15:00:27Z
updated_at: 2026-10-01T06:20:32Z
parent: folio-assistant-yj32
---

From [issue #223 comment](https://github.com/litlfred/folio-assistant/issues/223#issuecomment-5726628913):
"the lhs navbar should have sections for each node in the folio instance".

**A block was recorded here against bean `fsch`** — without a folio holding
0..n content instances there is only ever one node to render. **NOT blocked
on `fsch`:**
it was scrapped 2026-09-20 and the block is void — see §"The blocker is VOID"
below, which this line is corrected to agree with. A reader meets this
paragraph first, so leaving it asserting a live block is the exact harm that
section describes.

Gate: a two-instance folio shows two sections; a zero-instance folio renders
without error.

---

## The blocker is VOID — `fsch` was scrapped, 2026-09-20

This bean records *"Blocked on bean `fsch` — without a folio holding 0..n
content instances there is only ever one node to render."* **`fsch` is
`scrapped`**, and its own closing note says why: Phase 0.3 is already built and
what shipped explicitly rejects that bean's framing.

So this is not waiting on anything. **A block whose blocker was scrapped is
worse than no block**, because the next agent reads "blocked", does not open
the blocker, and leaves the work where it is — which is exactly what
`bean-blocking` says a block with no expiry cannot be told apart from:
abandoned work.

**What the gate should say instead.** *"A two-instance folio shows two
sections"* was written against the rejected 0..n-content-instances model. The
model that shipped is one section per **instance** — the LHS navbar as one
themed section per harness instance, in dependency order — which is `603s`, and
`b5f0` states it directly: *"instantiating a harness means that you get a slot
in the LHS navbar"*. Four instances declare `harness.json` in this repository
today, so the two-section case is already available to test against and needs
no new folio model at all.

**This bean is therefore a duplicate of `603s` in substance**, arrived at from
issue #223 rather than from the landing work. Not scrapped, because it carries
#223's framing and the link back to that comment, and `x0hj` adds the half
neither of them had — that the same act also buys a URL prefix. Left `todo`
with the blocker withdrawn; whoever takes `603s` should read this and then
scrap or fold it deliberately rather than by accident.


_2026-09-29_ — **Re-parented `vke6` → `yj32`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). An LHS navbar section per folio node is yj32's rendering subject; #223 is where it was asked, not what it is.

## Summary of Changes — closed 2026-10-01 on evidence

The owner chose to "check & close" this bean (2026-10-01). Re-stated for the
model that shipped, the gate is **one section per instantiated harness**
(`603s`, `b5f0`). Both halves now hold and are pinned by tests rather than
asserted in prose:

- **N instances → N sections.** The committed include
  (`cat-harness/docs/_includes/generated/navbar-footer.html`) carries one
  section per instantiated harness: 6 of the 17 declared in
  `docs/_data/harness.json`, each with its own `data-fa-harness-config`
  control. New test: two instantiated + one declared-only → exactly two
  sections, in both deploy variants.
- **Zero instances renders without error, with no empty group.** New test on
  `render([])`; mutation-checked: removing the `shown.length > 0` guard fails
  it.

`gen-navbar-include.ts` now exports `render` and guards `main()` with
`import.meta.main`, so a test can import it without rewriting the committed
include; `navbar:include:check` is unchanged.

#223's framing and the `x0hj` URL-prefix half stay recorded above for whoever
reads the issue; nothing in them is open here.

_2026-10-01T06:20:28Z_ — Claimed by claude/tbdl-jekyll-doc-index — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
