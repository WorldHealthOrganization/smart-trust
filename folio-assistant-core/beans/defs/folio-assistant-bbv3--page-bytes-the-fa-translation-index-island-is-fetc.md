---
# folio-assistant-bbv3
$schema: bean/1.0.0
title: 'Page bytes: the fa-translation-index island is fetched once, not inlined 2356 times (22.34 MB); kg-render.js carries R4''s two client-side obligations'
status: completed
type: task
parent: folio-assistant-o3xy
priority: normal
created_at: 2026-10-02T17:50:36Z
updated_at: 2026-10-07T20:30:00Z
---

## What and why

`#fa-translation-index` was a `<script type="application/json">` island in the `<head>`
of every page. **Measured on a local build of this repo's docs site, 2026-10-02: 2356
pages carried it, 9482 B each, 22.34 MB in total, ONE distinct payload** (sha1 over the
payloads). It is now published once at `assets/harness/site.json` and fetched.

`folio-board-requirements.md` §R4 forbade this while it required a rendering be
"reachable without JavaScript"; the owner relaxed that to "reachable without XSS" on
2026-10-02. The obligations that came with the relaxation live in
`skills/ui/ui-core/ui-accessibility.md` §"A rendering built client-side owes two things
the static one gave for free" — print/PDF must wait, and a load that FAILS must say so —
and `assets/js/kg-render.js` is where this instance satisfies them.

## The measurement that changed the design twice

1. **The island was 22.34 MB, not 14.26 MB.** The plan measured 1571 pages on a sibling's
   preview; this repo's own build has 2356 pages carrying it.
2. **Rationale comments in `head_custom.html` are not free.** They are HTML comments, not
   Liquid ones, so every byte ships on every page. The first draft of the explanatory
   comments added 5845 B and **gave back 62 % of the saving** — a change arguing against
   inlining one payload per page, by inlining an essay per page. The rule and the worked
   example are now in `assets/harness/site.json`'s front matter, which is never served.

## Deliberately NOT done

- **`fa-site-links` (0.42 MB) and `fa-declared-kinds` (0.57 MB).** Read SYNCHRONOUSLY by
  `mountActionTiles`, inside an `init()` sequence docs-ui.js documents as order-bound, and
  four `ready-to-merge` PRs (#1804/#1805/#1808/#1819) were open inside those same
  functions. Condition for moving them is recorded in `site.json`'s front matter.
- **`fa-site-scheme` (0.12 MB).** Read by the first-paint snippet, a synchronous `<head>`
  script. A fetch cannot be awaited there; moving it reintroduces the white flash the
  owner reported 2026-09-24. `first-paint-scheme.e2e.ts:148` pins the ordering.
- **The `fa-todo-listing` linear floor (19.5 MB).** `linear-floor.e2e.ts` has five
  `javaScriptEnabled: false` assertions over `#fa-todo-listing` that bean `0jtj` bought,
  and converting it makes them assert a weaker floor. That is the owner's call, not an
  agent's. Put to them on the PR.

## Parent: `o3xy` (UI & ACCESSIBILITY), not `1xhc` (CI RELIABILITY)

Recorded because it was a judgement rather than an obvious fit, and the
alternative had a real argument. `g196` — *"every preview stores a full copy of
the site because per-preview facts are baked into every page"* — and `xxku`
both sit under `1xhc`, and this bean **closes `g196`'s numbered cause 3**
verbatim, so following its siblings would have been consistent.

`o3xy` wins because the bytes were the easy half. What this change actually had
to get right is reader-facing: a print that fires mid-fetch, a PDF that
captures a shell, a failed load that renders as an empty one. Those are
`o3xy`'s subject — *"the rendered site is the artefact a reader judges"* — and
they are the half that needed new discipline rather than a new fetch.

## Completed on landed evidence

- Implementation landed on `main` in commits `0413a5a91d62` and `bdf544b2c91b` (PR #1767): `fa-translation-index` single client-side publication cuts HTML payload bytes and satisfies R4 requirements.
- Verified on `origin/main`.
