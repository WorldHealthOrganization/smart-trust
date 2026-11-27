---
name: ui-accessibility
description: >
  Every user interface this project produces must be operable by keyboard,
  legible at measured contrast, and comfortable to hit. How to build to that,
  how to check it, why an automated pass is not the standard, and what a
  rendering built client-side owes a reader — there is no no-JavaScript floor
  here, and the two gates that look like one are narrower than their names.
consulted: true
---

# All UI must follow accessibility guidelines

This is a **rule**, and it binds every surface this project produces: the knowledge-graph viewer, the docs site, the action-icon
tiles, anything future.

## Why it is load-bearing here, and not boilerplate

**This layer's declared interaction profile is low-dexterity.**
`cat-harness/memory/interaction.json` records it, and it already shapes the form of every
question the harness asks — numbered options, four or fewer, a stated default.

A UI that needs precise pointing, or that cannot be driven from the keyboard,
is unusable by the person it is being built for, so target size and keyboard
reachability are the point, and the conformance floor is a floor rather than a
target.

## The standard, concretely

- **WCAG 2.2 level A and AA.** Not AAA; do not claim it.
- **Every interactive thing is reachable AND activatable by keyboard.** Tab
  reaches it, Enter activates it, Space activates it if it is a button.
- **Targets are at least 24x24 CSS px** (SC 2.5.8), and aim higher: 32px for
  rows in a list, 28px for an inline control. Density is cheaper than a missed
  tap.
- **Contrast is computed, not eyeballed** — 4.5:1 for text, in **both**
  schemes, with the number written next to the token.
- **Focus is visibly indicated** by the page, not left to the user agent's
  default, and checked against every background a focused control can sit on.
- **A change that does not move focus is announced** — a live region, or focus
  management, or both.

## There is no no-JavaScript floor here — and exactly two gates that look like one

**This project's accessibility standard does not require a surface to work
with JavaScript disabled.** WCAG 2.2 A/AA imposes no such rule, and
neither does this skill. A rendering MAY fetch and build its content
client-side.

Two `javaScriptEnabled: false` gates make it *look* otherwise, and both are
narrower than their names suggest:

| gate | what it actually requires | what it does NOT reach |
|---|---|---|
| `test/linear-floor.e2e.ts` | the **todo listing** (`#fa-todo-listing`) is in the served bytes, in document order, with its count equal to its own cardinality | anything else on the page |
| `test/first-paint-scheme.e2e.ts` | eight generated dashboards **first-paint dark from CSS alone**, in a light-preferring browser | the page's *content* — this is a colour assertion |

The first is the **board's** linear floor and nothing wider (see
[`board-windows`](board-windows.md) §"The floor, which is not negotiable"). The
second is about the first frame, not about whether a reader can read the page.
Do not read either gate as wider than it is written, in either direction.

**The docs site's own navbar requires JavaScript**: `mountNavIconRow`,
`mountDocumentIndex` and `mountInstanceGraphs` build three of its regions in
the DOM at load (`test/navbar-row.e2e.ts`), so an argument that the docs site
owes a no-JavaScript rendering has to explain that first.

## A rendering built client-side owes two things the static one gave for free

These are **requirements**, and they apply to every surface — the board, the
docs site, a viewer, a dashboard. They are stated in this skill because a
design record is not instruction and nobody looks for a rule there.

- **Print and PDF SHALL wait for load and render before printing** (assuming
  the assets can load). A `window.print()` that fires before the fetch
  resolves produces a blank or partial page, and **a PDF is not re-checkable
  after the fact the way a web page is** — a reader who got a blank page has no
  way to tell it from a page that was blank. Playwright's
  `waitUntil: "load"` is not sufficient on a page that fetches after load.
- **A load that FAILS SHALL say so** rather than render as empty. "Could not
  load" and "there is nothing here" are different facts, and a client-side
  fetch is the easiest place in this repository to lose the distinction —
  `could-not-determine-is-a-third-state-everywhere` applied to the one surface
  where the failure is invisible to every gate. **A `console.warn` is not
  saying so**: it reaches a developer with the console open and no reader ever.

Client-side rendering does **not** relax the rest: movement stays
keyboard-operable, and drag stays an accelerator rather than the only way in,
because the declared interaction profile is low-dexterity.

## An automated pass is not the standard

Run axe. Also read the markup. **They find different things, and the overlap is
small.**

| found by | what |
|---|---|
| **axe** | insufficient contrast; undersized targets; `nested-interactive` (a `role="img"` SVG, which is a leaf, wrapped around focusable children) |
| **reading** | a diagram with no keyboard path; no live region; a placeholder-only field label; no skip link; unstyled focus |

axe cannot see a shape with a click handler (a bare `<circle>`, no role, no
`tabindex`): there is no *control* for it to find a fault with. A diagram
stops being a picture the moment it becomes a set of controls, and turning one
into controls is exactly where reading misses what axe catches. Neither half
replaces the other. Run both.

## Traps

**A colour written for one scheme and never rechecked in the other.** White on
a dark accent can pass in light mode and fail in dark, where the accent is
light. Text on an accent is a token per scheme (`--on-accent`), never a
literal. Compute both.

**A placeholder used as a label.** It is the accessible name only until
somebody types, and then the field has none. axe passes it. A user does not.
Use a real `<label>`, visually hidden if the design wants no visible text.

**`opacity` to dim text on a coloured background.** It blends toward the
background and quietly drops the ratio below the floor. Use a second token with
its own measured value.

**A panel rewritten in place.** The user activates a control, the content
changes, and their cursor has not moved. Nothing was said. `aria-live="polite"`
on the region, and a count announced when a filter changes the list.

## How to check it

`test/content/a11y.e2e.ts` is the worked example and the gate. It runs in CI as the
`End-to-end + accessibility, shard i/3` jobs (one required check per shard).

```sh
bun run cat test:e2e cat-harness-tools/test/content/a11y.e2e.ts
```

Two halves, deliberately:

- **axe-core** over the page in **both colour schemes at two viewports**,
  asserting zero WCAG A/AA violations. The failure names the rules, so a red
  run says *what* rather than *how many*.
- **Assertions axe cannot make** — focus lands on the control, Enter and Space
  both act, the accessible name says where an edge goes, no target is under
  24px, the skip link takes the first Tab, the field keeps its name after
  typing, the live regions exist, focus is visibly outlined.

If you add UI and do not add a check that runs in CI, you have written a habit
rather than a rule.

## When you cannot check something, say so

Contrast, names, roles, keyboard paths and target sizes are all checkable here.
Some things are not, from this environment: whether a screen reader actually
announces what the markup implies, whether an animation triggers vestibular
discomfort, whether a colour pair is distinguishable to a particular form of
colour blindness beyond what a ratio captures.

Report those as unverified rather than implying the gate covers them. A gate
that is believed to cover more than it does is worse than a narrower one.
