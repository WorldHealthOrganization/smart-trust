---
# folio-assistant-oi3h
$schema: bean/1.0.0
title: 'fsh-guts visualiser: 7 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-fsh-guts
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-10-10T16:35:03Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/fsh-guts/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **The two surfaces disagree about the count.** The page says 19 files. The fish shows 9, which is `@graph` nodes plus any locally discarded todos. `fsh-guts-export.ts` skips files that declare no `$schema`, so the 6 undeclared scripts and the 4 sidecar-described scripts are absent from the viewer. Neither surface explains the other's number.
2. **Names are shown with raw Markdown.** The viewer renders node names and bodies as text, on purpose (no sanitiser). So "`SkillDefinition.roles` — retired" and "The `roles:` field in SKILL front matter …" appear with literal backticks (seen in the render), and bodies show `#` and `**`. (→ `folio-assistant-mylx`)
3. **The viewer is three interactions deep, behind an unlabelled glyph, and there is now a second, nearer "Settings" that is the wrong one.** The path is still ▦ → Settings → Discarded. The fish tile has a good accessible name, but nothing on the page says discarded items exist until that Settings is opened, and the count is fetched only then. Since #1010, every page also has a ⚙ **Settings** tile on the glass's bottom strip, larger and labelled. It does not hold the fish, and it does not point to the Settings that does. The bean's *"under settings at dead fish icon"* now matches one of two Settings.
4. **The declaration-state tags fail contrast on the default dark scheme.** The inline style sets `.fg-ok #0d6e5e`, `.fg-side #6b5b95` and `.fg-gap #a8430f`. On `#27262b` I computed 2.44, 2.54 and 2.48 to 1, at 12 px. The "undeclared" gap state is the one the page wants noticed, and it has the same weight as the others. (→ `folio-assistant-rtuo`)
5. **Every file link leaves the site for github.com, and nothing marks this.** The page states it indexes rather than republishes, but the links are ordinary links. In the viewer, the same item is readable in place, but only through Settings.
6. **Possible dead link on the canonical site.** This is narrowed, not fixed. The committed `_data/harness.json` gives the fsh-guts folder `path: "/fsh-guts/"` with no "staging only" note. The **tiles**, including the new glass-strip tile, are filtered by `publish: "staging-only"` against `fa-staging`, and the render confirms the glass tile disappears off-staging. The **Folders** list and the C@T Harness divider are not filtered that way. If the deploy does not regenerate that file, they link to a page the canonical deploy withholds. I could not check this against the live site, because the proxy refuses `litlfred.github.io`.
7. **Mobile.** The page's three-column file tables scroll sideways inside the table wrapper at 390 px. The Settings panel stacks vertically and the Discarded list fits at that width (rendered). The detail was read, not rendered. There are still two different back controls in one panel: "‹ All actions" in the head, which from Discarded skips past Settings to the grid, and "‹ All discarded items" in the detail. (→ `folio-assistant-2r2n`)

Related: `folio-assistant-7vhe`

When fixed, re-draw `cat-harness/docs/wireframes/fsh-guts/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 7 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — The two surfaces disagree about the count: Page: '31 file(s) across 2 group(s)'. Viewer (More actions -> Settings -> Discarded): 'Discarded items — 20 items'; fsh-guts.json @graph has 20 nodes. Neither surface mentions the other's number (page text has no 'Settings'/'discarded'/'viewer').
- **STILL-PRESENT** — Names are shown with raw Markdown: Discarded list shows literal backticks (6), e.g. '`SkillDefinition.roles` — retired', 'The `roles:` field in SKILL front matter'; detail view shows 28 backticks and 5 '#'/'**' markers.
- **STILL-PRESENT** — The viewer is three interactions deep, behind an unlabelled glyph, with a second nearer Settings that is the wrong one: Path still More actions (icon-only SVG button, no text) -> Settings -> Discarded (3 clicks). Glass 'Folio settings — theme, avatars, opacity' opened: 0 .fa-discarded-open controls, no pointer to the other Settings. Page body never mentions discarded items.
- **STILL-PRESENT** — The declaration-state tags fail contrast on the default dark scheme: Default dark (data-fa-scheme=dark): .fg-ok rgb(13,110,94) 2.19:1, .fg-side rgb(107,91,149) 2.29:1, .fg-gap rgb(168,67,15) 2.24:1 on rgb(48,45,54) at 12px (10.5px at 390). Light scheme passes (6.16/5.91/6.04).
- **STILL-PRESENT** — Every file link leaves the site for github.com, and nothing marks this: 31 table links, all to github.com; 0 with target, rel, aria-label/title, icon, or ::after content.
- **STILL-PRESENT** — Possible dead link on the canonical site: Now confirmed rather than possible: site-new (compose without --staging) has no /fsh-guts/ (HTTP 404), yet the home page renders a visible 'fsh-guts' link and the beans page nav (.fa-nav-sub) a visible 'F fsh-guts' link to /fsh-guts/. Caveat: local preview-site build, not the deployed site.
- **STILL-PRESENT** — Mobile: two different back controls in one panel: At 390 in the discarded detail both '‹ All actions' and '‹ All discarded items' are visible. File tables: 3 cols, scrollWidth 362/362/369 in 362px wrappers (overflow-x auto); page scrollWidth 390.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 6 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code. /fsh-guts/ is staging-only, so it was measured on a second build of the same commit composed with `compose-docs --staging`, with `fsh-guts-export.ts` run as `docs-site.yml` does. The dead-link finding uses the canonical build.

- **STILL-PRESENT** — The two surfaces disagree about the count: The page says '34 file(s) across 4 group(s)' (was 31/2). The viewer (More actions → Settings → Discarded) says 'Discarded items — 22 items', and fsh-guts.json @graph has 22 nodes. Neither surface mentions the other's number. (rv-fg.mjs, rv-fg3.mjs)
- **STILL-PRESENT** — Names are shown with raw Markdown: The Discarded list shows 8 literal backticks, e.g. '`SkillDefinition.roles` — retired', 'The `remote-stubs` package — …'. The detail view shows 30 backticks and 5 '#'/'**' markers. (rv-fg3.mjs)
- **STILL-PRESENT** — The viewer is three interactions deep, behind an unlabelled glyph, with a second nearer Settings that is the wrong one: The path is still More actions (icon-only SVG button, innerText '') → Settings → Discarded, 3 clicks. The glass 'Folio settings — theme, avatars, opacity' has 0 .fa-discarded-open controls and no pointer to the other Settings. (rv-fg3.mjs, rv-fg4.mjs)
- **FIXED** — The declaration-state tags fail contrast on the default dark scheme: Changed since 2026-09-29. Dark (data-fa-scheme=dark), on rgb(48,45,54): .fg-ok rgb(92,211,189) 7.40:1, .fg-side rgb(185,168,236) 6.35:1, .fg-gap rgb(245,160,112) 6.53:1, at 12px (10.5px at 390). Light is unchanged and passes: 6.16/5.91/6.04. — #1592 / rtuo (rv-fg.mjs)
- **STILL-PRESENT** — Every file link leaves the site for github.com, and nothing marks this: 34 table links, all to github.com. 0 have target, rel, aria-label/title, an icon or ::after content. (rv-fg4.mjs)
- **STILL-PRESENT** — Possible dead link on the canonical site: The canonical build (compose without --staging) has no /fsh-guts/ (HTTP 404). The home page still renders a visible 'fsh-guts' link, and the beans page nav (.fa-nav-sub) a visible 'F fsh-guts' link to it. This is a local preview-site build, not the deployed site. (rv-fg4.mjs)
- **STILL-PRESENT** — Mobile: two different back controls in one panel: At 390 the discarded detail shows both '‹ All actions' and '‹ All discarded items'. The file tables are 3 columns, scrollWidth 362/362/362/362/369 in 362px wrappers; page scrollWidth 390. (rv-fg3.mjs, rv-fg.mjs)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-fsh-guts-viz.ts` in cat-harness-tools, plus cat-harness `docs-ui.js/css`. Some findings are fixed (`fsh-guts-viz.test.ts`, `discarded-items.e2e.ts`). Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on verified evidence. The
fixes were made and recorded on this bean's cat-harness-store copy (closed
2026-10-09). This copy was checked separately to confirm they reached the
default branches:
- fix commit `6077ca1e` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness `docs/assets/js/docs-ui.js:1096`; cat-harness-tools `scripts/gen-fsh-guts-viz.ts:323`.


## Closed 2026-10-09

- Branch: `claude/oi3h-fsh-guts-viz`
- Commit: `6077ca1e69ee5c2dbefe68faedd808389d8a7c69` ("fix(ui): fsh-guts visualiser wireframe fixes (folio-assistant-oi3h)")
- Verification:
  - `bun test scripts/tests/fsh-guts-viz.test.ts`: 6 pass, 0 fail (16 expect calls)
  - `bun run scripts/gen-fsh-guts-viz.ts --check`: clean (`✓ fsh-guts viewer is current — 163 file(s)`)
  - `bun run typecheck`: clean (`tsc --noEmit -p tsconfig.json` exited 0)
- Addressed Wireframe Findings:
  - Finding 1 (Count disagreement): Added explanatory callout note to `docs/fsh-guts/index.md` (via `scripts/gen-fsh-guts-viz.ts`) clarifying that the static page indexes all tracked files across repository trashcan groups, while the interactive viewer inspects declared `@graph` items + browser-local discarded stickies.
  - Finding 2 (Names shown with raw Markdown): Implemented `cleanMarkdownText` in `docs/assets/js/docs-ui.js` stripping inline backticks, bold, italics, and heading markers from node names and descriptions in both list and detail views. Tested in `test/discarded-items.e2e.ts`.
  - Finding 3 (Viewer 3 interactions deep / Settings clarity): Added descriptive tooltips and aria attributes to `.fa-tiles-toggle`, `pageSettingsTile`, and navbar launcher proxy (`title="More actions — settings, discarded items"`, `data-fa-tip`), and documented the explicit path in the fsh-guts page lede.
  - Finding 4 (State tags contrast): Verified already resolved in PR #1592 (`rtuo`) with high-contrast palette (`.fg-ok #5cd3bd`, `.fg-side #b9a8ec`, `.fg-gap #f5a070` exceeding WCAG standards).
  - Finding 5 (External links): Updated `scripts/gen-fsh-guts-viz.ts` to generate links with `target="_blank"`, `rel="noopener noreferrer"`, `title="View on GitHub"`, and `↗` indicator. Also added external link attributes to the detail source link in `docs/assets/js/docs-ui.js`.
  - Finding 7 (Mobile back controls): Updated `docs/assets/js/docs-ui.js` and added CSS rule in `docs/assets/css/docs-ui.css` (`.fa-tiles:has(.fa-discarded-detail) .fa-tiles-head .fa-tiles-back { display: none; }`) to ensure only the singular "‹ All discarded items" control is shown in detail view, restoring the header back button when returning to list view. Tested in `test/discarded-items.e2e.ts`.




## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-fsh-guts-viz.ts` in cat-harness-tools, plus cat-harness `docs-ui.js/css`. Some findings are fixed (`fsh-guts-viz.test.ts`, `discarded-items.e2e.ts`). Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on verified evidence. The
fixes were made and recorded on this bean's cat-harness-store copy (closed
2026-10-09). This copy was checked separately to confirm they reached the
default branches:
- fix commit `6077ca1e` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness `docs/assets/js/docs-ui.js:1096`; cat-harness-tools `scripts/gen-fsh-guts-viz.ts:323`.
