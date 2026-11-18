---
# folio-assistant-uknu
$schema: bean/1.0.0
title: 'DUPLICATE id ON EVERY DOCS PAGE: just-the-docs renders nav_footer_custom twice, so both copies carry id="fa-nav-open"'
status: completed
type: bug
priority: normal
created_at: 2026-09-22T19:18:10Z
updated_at: 2026-09-23T21:59:49Z
parent: folio-assistant-o3xy
---

## What

Every generated docs page carries **two elements with `id="fa-nav-open"`**. A
duplicate `id` is invalid HTML, and `document.getElementById` plus every
`<label for=…>` resolve to the **first** one only.

## How it was found

Measured 2026-09-22 on the **rendered** page, not on the source — the staging
preview for PR #957, read out of the `gh-pages` publish ref rather than over
HTTP (the agent's egress proxy blocks `litlfred.github.io`, which is bean
`7s52`'s point: the publish ref is a git branch and can be read directly).

```
STAGING/claude-exciting-bardeen-csx7ay/reference/skill-instructions/coordinate.html
  671:  <input type="checkbox" class="fa-nav-open" id="fa-nav-open">
  2260: <input type="checkbox" class="fa-nav-open" id="fa-nav-open">
```

**The source is not duplicated.** `docs/_includes/nav_footer_custom.html:59`
declares the input exactly once. just-the-docs renders that include **twice per
page by design** — the theme's responsive pattern — and the two copies land in
different wrappers:

| line | wrapper | shown at |
|---|---|---|
| 671 | `.d-md-block.d-none.site-footer` | **md and up** (hidden below) |
| 2260 | `.d-md-none.mt-4.fs-2` | **below md** (hidden at md and up) |

Two labels bind to it, both in the same include:

```
:60  <label class="fa-nav-close"  for="fa-nav-open" …>
:84  <label class="fa-nav-toggle" for="fa-nav-open" …>
```

So at phone widths the **visible** labels resolve to the checkbox in the
**hidden** desktop copy.

## Why this is a finding and not a nit

`gjli` is a standing accessibility gate on every step of `p5wm`. A duplicate
`id` fails validation outright, and a `<label for>` pointing at a control that
is `display:none` is not operable by keyboard or by assistive technology — the
two mechanisms a mouse user never notices are missing.

It is invisible in the HTML *source*, which is correct throughout, and invisible
to `gates` — the same shape as the `gjli` defect itself, where 22 headings
shared one anchor and `gates --all` was green across it. **Only a build showed
it.**

## What is NOT established

**Whether the mobile toggle is actually dead at runtime.** That depends on
whether the stylesheet drives the nav through `:checked ~ sibling` selectors
scoped within each copy, or globally. Determining it needs a browser against a
built site, and the agent that filed this could not open one — egress to the
Pages host is blocked. **Do not close this bean on the duplicate `id` alone
without checking the behaviour**, and do not assume it is broken either.

## Two candidate fixes, neither chosen here

1. **Unique ids per copy** — suffix the id and both `for=` attributes per
   render (e.g. from `{{ include.variant }}`). Keeps the theme's two-copy
   pattern.
2. **Render the control once** and have both wrappers reference it.

Which is right depends on the runtime finding above, so it is left open rather
than guessed. Filed by the #956 consolidation session, which owns neither
`o3xy` nor `p5wm` — this is stream 2's surface.

## Done when

- [x] The runtime behaviour at phone width is measured in a browser, and this
      bean says whether the mobile toggle was operable
- [x] No generated page carries a duplicate `id`
- [x] A check can fail on a duplicate `id` in a built page, so this class does
      not recur silently

---

## Summary of Changes — 2026-09-23

Owner's pick ("uknu duplicate id"). Every item was measured on a local build
(`bun run cat preview:site`), not read off the source.

| Done-when item | Evidence |
|---|---|
| runtime behaviour at phone width, measured in a browser | Playwright at 390×844 and 1280×900. **Before:** the toggle opened the sidebar; the duplicate id worked by accident, because both copies' labels resolved to the first input, which sits inside `.side-bar`. **The first fix (`fa-nav-open-2`) broke it**: the second copy sits OUTSIDE `.side-bar`, and the stylesheet reads `.side-bar:has(.fa-nav-open:checked)`, so its toggle checked a box nothing reads. **Final:** the input is rendered once and every copy renders only the labels, `for="fa-nav-open"`. Clicking either copy's toggle opens the sidebar at both widths. |
| no generated page carries a duplicate `id` | `check:duplicate-ids` on the built site: **429 of 1,283** pages before, **0** after. |
| a check can fail on a duplicate `id` in a built page | `cat-harness/scripts/check-duplicate-ids.ts` (`bun run cat check:duplicate-ids <site>`). It counts ids in real tags only, which removes the 2 first-run false hits from code samples. It runs in `feature-staging.yml` after the Jekyll build and the instance mount. 6 tests pin it, including the include's one-input rule. |

**Caveat, stated rather than hidden.** The local build uses the installed
just-the-docs GEM, not the pinned remote theme CI uses, so page chrome can
differ (`preview-site.sh` says so). In this build both copies render at both
widths. The fix does not depend on which copy is visible: either copy's
labels operate the one checkbox the stylesheet reads.
