---
# folio-assistant-gp2f
$schema: bean/1.0.0
title: 'PAGE WEIGHT: move per-page nav, harness bar, icons, scripts and IG chrome CSS into shared cached assets (#1885)'
status: completed
type: task
priority: normal
created_at: 2026-10-02T16:39:55Z
updated_at: 2026-10-29T11:05:00Z
parent: folio-assistant-rwmf
---

Issue #1885.

Owner rulings, 2026-10-02:
- "~230KB per IG page mostly navigation/styling overhead... can we condense into common styling/libraries? so page size is small?"
- "1 do all."
- "first document workplan and /coordinate in case active work on pages happening"
- "(in genreal update agent-agent coorindation/hadover skills - if you are working on a refactor of the platform, review active agents/beans for impact and coordiante)"

## Measured
Deployed `smart-trust/menu/Home.html` is 225 KB, of which 4 KB is page content.

| part | size |
|---|---|
| nav (455 links, inlined per page) | 71 KB |
| harness bar / footer (desktop and mobile copies) | 2 × 25 KB |
| inline svg | 30 KB |
| inline script | 15 KB |
| inline style | 6.6 KB |

There are about 4,700 HTML pages, and each preview is a full copy of the site (#1868).

## Standing rules this follows (#1881)
- One materialized page per IRI on gh-pages.
- No 404 routing and no query strings.
- Pages are thin shells that load shared, published assets.

## Collision review (coordinate, 2026-10-02)
- **Navbar session** (session_01Cw8JgZEDT5VqQ5ergjdMjB, "UI issues: navbar, hamburger menu, avatar"; bean ob3m, stream 10uc). PRs #1804, #1805, #1808 and #1819 edit `docs-ui.css`, `docs-ui.js`, `_includes/generated/navbar-footer.html`, `harness_details.html` and `head_custom.html`. Overlaps phases B, C, D and E.
- **fhir-ast session** (session_01PricYFhYhFA5DuMJaWo3CE, bean wnhh). #1816 edits `fhir-harness/scripts/gen-ig-pages.ts`. Overlaps phase A.
- **#1766 session** (session_01DnFZtVpff4o7puqWazGvKN, smart-trust IG site). Edits the gen-ig-pages area. Overlaps phase A.
- #1875 and #1801 edit `docs-site.yml` (the build). Several more PRs touch only generated library and navbar files, which regeneration resolves.

## Workplan
Each phase is its own PR, with a before/after size table and a Chromium check at 1280 px and 390 px.

- [x] **0. Coordinate.** Post intent and asks to the three sessions above and agree the order.
- [x] **A. IG chrome CSS.** `gen-ig-pages` emits one shared `ig-chrome.css` per chrome and references it, instead of inlining about 6.6 KB per IG page. Lands after #1816 and #1766, or is rebased onto them.
- [ ] **B. Icons.** One shared SVG sprite, referenced via `<use href>`. Saves about 30 KB per page.
- [ ] **C. Harness bar and footer.** Emitted once and made responsive with CSS. Saves about 25 KB per page. Inside the navbar session's area, so this phase is offered to that session or lands after its series.
- [ ] **D. Site navigation.** One shared, cached nav JSON rendered client-side. Every link is a real page, with a noscript fallback. Saves about 70 KB per page. Last, because it overlaps most with ob3m and p5wm.
- [ ] **E. Inline scripts.** Moved into shared, cached JS. Saves about 15 KB per page.
- [x] **F. Skills** (the coordination rule; done in 2814ee1). The site-page skill text lands with phases B–E.
  - The site-page skills say shared assets are never inlined per page.
  - The coordinate, bean-coordination and handover skills gain the owner's rule: a platform refactor first reviews active agents, PRs and beans for impact, and coordinates.

## Done when
- [ ] A sampled IG page is at most 20 KB, and the whole-site total is reported before and after.
- [ ] a11y (axe) and e2e pass, and the Chromium checks pass at both widths.
- [x] The sibling sessions have acknowledged the order, or their overlapping PRs have landed before each overlapping phase.

## Coordination outcome, 2026-10-02
- **A:** #1766 already writes `assets/ig-chrome.css` and `assets/ig-pages.css` once per instance and links them (52 % less page CSS). Not rebuilt here. After #1766 merges, only the sharing across instances is added, reading the chrome through `chromeFileFor`. #1816 does not conflict, but use a distinct filename in `assets/` and relative links.
- **C:** owned here, at the navbar session's request. It waits for #1804, #1805, #1808 and #1819, and must respect `mountSidebarRail`, the avatar-only toggle, the strip hidden on first open, the e2e specs and `check:nav-names`. The theme emits `nav_footer_custom` in both `components/sidebar.html` and `components/footer.html`, so the fix is to override those two includes.
- **D:** keep a no-JS fallback. `mountSidebarRail` and the theme's DOMContentLoaded current-page highlight must run after the JSON nav is in the DOM, or the nav data loads synchronously. `check:nav-names` and `check:viewer-nav` read the nav JSON.

## Baseline (local `preview:site` of main `22ac68dc`; #1886 comment)
- 220.7 KB per IG page.
- Nav: 67.4 KB.
- Harness bar: 38.5 KB, emitted twice.
- Inline svg: about 31 KB.
- Inline script: about 14.5 KB.
- Whole site: 595 MiB, 89 % of it HTML.


## 2026-10-09: phase A verified landed; where the rest of the weight is (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL)
**A is done:** `gen-ig-pages.ts:195` (`CHROME_CSS = "assets/ig-chrome.css"`) and `stage-ig-sites.ts:179` reference one shared `assets/ig-chrome.css`; litlfred/smart-trust gh-pages (63303eb) serves it and its artefact pages link it.
**Measured on that gh-pages, 250 pages sampled (200 artifact/ + 50 root):** median page **193 KB** (target ≤ 20 KB). Median parts: inline `<svg>` 46.6 KB (→ B), inline `<script>` 8.6 KB (→ E), `<nav>` 5.7 KB, inline `<style>` 3.3 KB. On a sample artefact page (ActorDefinition-Holder-testing, 194 KB): the just-the-docs sidebar `header.side-bar` ≈ 46 KB (→ D); the harness footer/bar is emitted **twice**, `site-footer d-md-block` and `d-md-none`, ≈ 41 KB each (`fa-nav-bottom` ≈ 40 KB inside) (→ C: emitting it once, responsive, saves ~41 KB, more than this workplan's 25 KB estimate).
Not acted on: C and D are in the navbar session's area per the 2026-10-02 coordination outcome.

## IG artefact pages: thin shells instead (owner, 2026-10-11, option A)
The owner chose option A: *"tiny html w/ dynamic load from json(ld) KG"*. For IG **artefact** pages, this goes around phases B–E rather than through them. The page drops the just-the-docs chrome and becomes a thin shell over a per-artefact JSON-LD node.
- **fhir-harness#41.** `gen-ig-pages --thin` writes the shells through `scripts/thin-page.ts` (imported, not copied). `ig-artifact-jsonld.ts` writes the WHO-free nodes and their QA.
- **cat-harness-tools#127.** It adds the optional `canonical` the thin page needs, because the page is a file at the Publisher's address.
- **litlfred/ihris switch PR.** It moves the iHRIS 5 IG to the thin path. Measured over its 182 artefact pages: **168.2 KB → 5.5 KB** mean with the linked rail. That meets the "sampled IG page ≤ 20 KB" criterion for artefact pages of an IG that opts in.
- **Still open:**
  - the IG's own narrative pages and the artifacts/toc pages, which keep the full chrome;
  - ~~smart-trust and smart-immunizations, which have not opted in yet;~~ done: thin became the default (2026-10-12), see 2026-10-23 below;
  - phases B–E for every other page.

## 2026-10-23 — smart-trust and smart-immunizations are on thin artefact pages (thread "smart IG harnessing", https://claude.ai/code/session_01AW61nue34oLGoENwjCNcSA)
No opt-in is needed any more: `gen-ig-pages` writes thin pages by default since 2026-10-12 (`--full-pages` is the opt-out), and both IGs publish through the fhir-harness IG route. Measured from the gh-pages trees (2026-10-22 publishes):

| IG | artefact pages | mean | max | root .html mean | `en/` .html mean |
|---|---|---|---|---|---|
| smart-trust (ba8613e) | 1,404 | 4.9 KB | 13.2 KB | 40.2 KB (50 pages) | 69.8 KB (264) |
| smart-immunizations (b72436f) | 1,955 | 6.5 KB | 13.8 KB | 16.1 KB (57 pages) | 69.8 KB (266) |

Artefact pages meet "sampled IG page ≤ 20 KB". Still heavy: the narrative/root pages and the platform's `en/`, `cat-harness/` and `folio-assistant-core/` pages, which are phases B–E.

## 2026-10-23 — remaining phases re-measured; tiles and navbar row shared (thread "Page weight", https://claude.ai/code/session_01Uvn1s3VyR7rQ8fmLkLH2AN)
Measured on folio-assistant gh-pages `1ad53fa` (STAGING excluded): 351 MiB, 4,606 HTML pages, 107 MiB of HTML.
- **C and D are already done by other work.** No sampled page carries `site-footer` twice or an inlined `side-bar`; pages carry a small `#fa-rail` block and load the shared `assets/navbar/rail-<hash>.js`.
- **What is left on a platform page** (`en/cat-harness/qa/cat-harness/`, 42 KB): `<meta name="fa-tiles">` 12.5 KB, `#fa-navbar-row` 2.5 KB, the mermaid loader 2.5 KB (on every page), the theme's icon sprite ~3.8 KB, page content ~10 KB.
- **IG narrative pages** (`smart-trust/*.html`, 50 pages): median 20.2 KB. The IG menu is in each page twice: the `data-fa-visualiser-nav` block (2.9 KB) and the rail's `documentIndex` (3.7 KB); `#fa-navbar-row` is inlined (2.5 KB).
- **Done on branch** cat-harness `claude/gp2f-shared-head-data` (8f3a9a4): one Liquid-rendered `assets/js/harness-data.js` fills the empty tiles meta and navbar-row island (the `data-fa-row-src` contract); the mermaid loader is emitted only when the content holds `language-mermaid`. Local build: 60.1 → 43.9 KB per page; Chromium at 1280/390 draws the same 30 tiles and 7 row icons. Estimated saving ~21 MiB of HTML.
- **Split agreed with the "Preview storage" thread (bean g196):** g196 owns the `?v=` content-hash filter and moving `rail-<hash>.js`/`row-<hash>.js` to constant paths; this bean owns moving per-page data out.
- **Still open:** the IG menu duplicate; the icon sprite (B, needs theme template overrides); `shareNavbarRow` on all railed pages once g196 gives the row file a constant path.

## 2026-10-23 (later) — PRs open; icon sprite deferred
- **litlfred/cat-harness#434:** the tiles list and navbar row move to a shared `harness-data.js`, and mermaid is loaded only on pages with a diagram. It saves about 16 KB per Jekyll page.
- **litlfred/cat-harness-tools#602:** `injectRailOnce` (new `lib/rail-once.ts`) drops the `data-fa-visualiser-nav` block once the rail has read it. It saves about 2.9 KB per IG narrative page, which brings the smart-trust median from about 20.2 KB to about 17 KB.
  - Lesson, now in the module's doc comment: `lib/navbar.ts` and `lib/harness-rail.ts` are bundled into cat-harness's committed `navbar.js`. Any edit to them changes the minified names, so `navbar-assets.test.ts` fails unless cat-harness is regenerated in step. Keep server-only rail behaviour out of those two files. Check with `gen-navbar-assets.ts --check` under the pinned Bun (`cat-harness/.bun-version`).
- **B (icon sprite):** owner's pick, 2026-10-23, "Skip it for now". The net saving is about 3 KB per page, because each `<use>` reference grows. It needs either overrides of the theme's default layout, icons include and search header, or a post-build pass. Not planned.
- **Still to do after deploy:** re-measure the site total and a sampled IG page against the `1ad53fa` baseline.

## 2026-10-23 (evening) — measured after deploy; IG menu shared (thread "Page weight", https://claude.ai/code/session_01Uvn1s3VyR7rQ8fmLkLH2AN)
#602 and #434 are deployed: cat-harness `bda1867` is pinned through folio-assistant#2668 (main `63c89b1`), gh-pages `d5a9825`. Compared with the `1ad53fa` baseline, STAGING excluded:

| | before (`1ad53fa`) | after (`d5a9825`) |
|---|---|---|
| site total | 350.9 MiB, 13,432 files | 333.7 MiB, 14,215 files |
| all HTML | 107.1 MiB, 4,606 pages | 94.8 MiB, 5,240 pages |
| the same 4,575 pages | 104.8 MiB | 81.3 MiB (−22%) |
| `en/` median (same 411 pages) | 40.9 KB | 25.1 KB |
| `reference/` median (same 407 pages) | 49.0 KB | 32.3 KB |
| `smart-trust/` median (2,194 pages) | 15.7 KB | 12.9 KB |
| smart-trust narrative median | 20.2 KB | 16.9 KB |

- The tiles meta is now `content=""` with `data-fa-src="harness-data"`; `harness-data.js` fills it.
- **Done criterion "sampled IG page ≤ 20 KB": met** (smart-trust narrative median 16.9 KB, artefact pages ~5 KB).
- **Option A (owner's pick, 2026-10-23): the IG menu moves into the shared rail file.** litlfred/cat-harness#468 (regenerated `navbar.js`, which reads `page.documentIndex ?? shared.documentIndex`) merges first; litlfred/cat-harness-tools#644 then stops writing a declared menu into each page's `#fa-rail`. That is about 4 KB more off every IG narrative page. #644's one red check (`navbar-assets.test.ts`) clears once #468 is on main.
- **Still open:** merging #468 then #644 (waiting on the owner's OK, since the merge window ended); `shareNavbarRow` on all railed pages once g196 gives the row file a constant path; g196 drops `?v` from the `harness-data.js` tag.



## 2026-10-09: phase A verified landed; where the rest of the weight is (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL)
**A is done:** `gen-ig-pages.ts:195` (`CHROME_CSS = "assets/ig-chrome.css"`) and `stage-ig-sites.ts:179` reference one shared `assets/ig-chrome.css`; litlfred/smart-trust gh-pages (63303eb) serves it and its artefact pages link it.
**Measured on that gh-pages, 250 pages sampled (200 artifact/ + 50 root):** median page **193 KB** (target ≤ 20 KB). Median parts: inline `<svg>` 46.6 KB (→ B), inline `<script>` 8.6 KB (→ E), `<nav>` 5.7 KB, inline `<style>` 3.3 KB. On a sample artefact page (ActorDefinition-Holder-testing, 194 KB): the just-the-docs sidebar `header.side-bar` ≈ 46 KB (→ D); the harness footer/bar is emitted **twice**, `site-footer d-md-block` and `d-md-none`, ≈ 41 KB each (`fa-nav-bottom` ≈ 40 KB inside) (→ C: emitting it once, responsive, saves ~41 KB, more than this workplan's 25 KB estimate).
Not acted on: C and D are in the navbar session's area per the 2026-10-02 coordination outcome.

## IG artefact pages: thin shells instead (owner, 2026-10-11, option A)
The owner chose option A: *"tiny html w/ dynamic load from json(ld) KG"*. For IG **artefact** pages, this goes around phases B–E rather than through them. The page drops the just-the-docs chrome and becomes a thin shell over a per-artefact JSON-LD node.
- **fhir-harness#41.** `gen-ig-pages --thin` writes the shells through `scripts/thin-page.ts` (imported, not copied). `ig-artifact-jsonld.ts` writes the WHO-free nodes and their QA.
- **cat-harness-tools#127.** It adds the optional `canonical` the thin page needs, because the page is a file at the Publisher's address.
- **litlfred/ihris switch PR.** It moves the iHRIS 5 IG to the thin path. Measured over its 182 artefact pages: **168.2 KB → 5.5 KB** mean with the linked rail. That meets the "sampled IG page ≤ 20 KB" criterion for artefact pages of an IG that opts in.
- **Still open:**
  - the IG's own narrative pages and the artifacts/toc pages, which keep the full chrome;
  - ~~smart-trust and smart-immunizations, which have not opted in yet;~~ done: thin became the default (2026-10-12), see 2026-10-23 below;
  - phases B–E for every other page.

## 2026-10-23 — smart-trust and smart-immunizations are on thin artefact pages (thread "smart IG harnessing", https://claude.ai/code/session_01AW61nue34oLGoENwjCNcSA)
No opt-in is needed any more: `gen-ig-pages` writes thin pages by default since 2026-10-12 (`--full-pages` is the opt-out), and both IGs publish through the fhir-harness IG route. Measured from the gh-pages trees (2026-10-22 publishes):

| IG | artefact pages | mean | max | root .html mean | `en/` .html mean |
|---|---|---|---|---|---|
| smart-trust (ba8613e) | 1,404 | 4.9 KB | 13.2 KB | 40.2 KB (50 pages) | 69.8 KB (264) |
| smart-immunizations (b72436f) | 1,955 | 6.5 KB | 13.8 KB | 16.1 KB (57 pages) | 69.8 KB (266) |

Artefact pages meet "sampled IG page ≤ 20 KB". Still heavy: the narrative/root pages and the platform's `en/`, `cat-harness/` and `folio-assistant-core/` pages, which are phases B–E.

## 2026-10-23 — remaining phases re-measured; tiles and navbar row shared (thread "Page weight", https://claude.ai/code/session_01Uvn1s3VyR7rQ8fmLkLH2AN)
Measured on folio-assistant gh-pages `1ad53fa` (STAGING excluded): 351 MiB, 4,606 HTML pages, 107 MiB of HTML.
- **C and D are already done by other work.** No sampled page carries `site-footer` twice or an inlined `side-bar`; pages carry a small `#fa-rail` block and load the shared `assets/navbar/rail-<hash>.js`.
- **What is left on a platform page** (`en/cat-harness/qa/cat-harness/`, 42 KB): `<meta name="fa-tiles">` 12.5 KB, `#fa-navbar-row` 2.5 KB, the mermaid loader 2.5 KB (on every page), the theme's icon sprite ~3.8 KB, page content ~10 KB.
- **IG narrative pages** (`smart-trust/*.html`, 50 pages): median 20.2 KB. The IG menu is in each page twice: the `data-fa-visualiser-nav` block (2.9 KB) and the rail's `documentIndex` (3.7 KB); `#fa-navbar-row` is inlined (2.5 KB).
- **Done on branch** cat-harness `claude/gp2f-shared-head-data` (8f3a9a4): one Liquid-rendered `assets/js/harness-data.js` fills the empty tiles meta and navbar-row island (the `data-fa-row-src` contract); the mermaid loader is emitted only when the content holds `language-mermaid`. Local build: 60.1 → 43.9 KB per page; Chromium at 1280/390 draws the same 30 tiles and 7 row icons. Estimated saving ~21 MiB of HTML.
- **Split agreed with the "Preview storage" thread (bean g196):** g196 owns the `?v=` content-hash filter and moving `rail-<hash>.js`/`row-<hash>.js` to constant paths; this bean owns moving per-page data out.
- **Still open:** the IG menu duplicate; the icon sprite (B, needs theme template overrides); `shareNavbarRow` on all railed pages once g196 gives the row file a constant path.

## 2026-10-23 (later) — PRs open; icon sprite deferred
- **litlfred/cat-harness#434:** the tiles list and navbar row move to a shared `harness-data.js`, and mermaid is loaded only on pages with a diagram. It saves about 16 KB per Jekyll page.
- **litlfred/cat-harness-tools#602:** `injectRailOnce` (new `lib/rail-once.ts`) drops the `data-fa-visualiser-nav` block once the rail has read it. It saves about 2.9 KB per IG narrative page, which brings the smart-trust median from about 20.2 KB to about 17 KB.
  - Lesson, now in the module's doc comment: `lib/navbar.ts` and `lib/harness-rail.ts` are bundled into cat-harness's committed `navbar.js`. Any edit to them changes the minified names, so `navbar-assets.test.ts` fails unless cat-harness is regenerated in step. Keep server-only rail behaviour out of those two files. Check with `gen-navbar-assets.ts --check` under the pinned Bun (`cat-harness/.bun-version`).
- **B (icon sprite):** owner's pick, 2026-10-23, "Skip it for now". The net saving is about 3 KB per page, because each `<use>` reference grows. It needs either overrides of the theme's default layout, icons include and search header, or a post-build pass. Not planned.
- **Still to do after deploy:** re-measure the site total and a sampled IG page against the `1ad53fa` baseline.

## 2026-10-23 (evening) — measured after deploy; IG menu shared (thread "Page weight", https://claude.ai/code/session_01Uvn1s3VyR7rQ8fmLkLH2AN)
#602 and #434 are deployed: cat-harness `bda1867` is pinned through folio-assistant#2668 (main `63c89b1`), gh-pages `d5a9825`. Compared with the `1ad53fa` baseline, STAGING excluded:

| | before (`1ad53fa`) | after (`d5a9825`) |
|---|---|---|
| site total | 350.9 MiB, 13,432 files | 333.7 MiB, 14,215 files |
| all HTML | 107.1 MiB, 4,606 pages | 94.8 MiB, 5,240 pages |
| the same 4,575 pages | 104.8 MiB | 81.3 MiB (−22%) |
| `en/` median (same 411 pages) | 40.9 KB | 25.1 KB |
| `reference/` median (same 407 pages) | 49.0 KB | 32.3 KB |
| `smart-trust/` median (2,194 pages) | 15.7 KB | 12.9 KB |
| smart-trust narrative median | 20.2 KB | 16.9 KB |

- The tiles meta is now `content=""` with `data-fa-src="harness-data"`; `harness-data.js` fills it.
- **Done criterion "sampled IG page ≤ 20 KB": met** (smart-trust narrative median 16.9 KB, artefact pages ~5 KB).
- **Option A (owner's pick, 2026-10-23): the IG menu moves into the shared rail file.** litlfred/cat-harness#468 (regenerated `navbar.js`, which reads `page.documentIndex ?? shared.documentIndex`) merges first; litlfred/cat-harness-tools#644 then stops writing a declared menu into each page's `#fa-rail`. That is about 4 KB more off every IG narrative page. #644's one red check (`navbar-assets.test.ts`) clears once #468 is on main.
- **Still open:** ~~merging #468 then #644~~ (both merged: `litlfred/cat-harness#468` @ `c3330bae`, `litlfred/cat-harness-tools#644` @ `f0460409`); `shareNavbarRow` on all railed pages once g196 gives the row file a constant path; g196 drops `?v` from the `harness-data.js` tag.

---

*2026-10-29T11:05Z* — **Done: measured on the build that published at 10:36Z. Lane D, session https://claude.ai/code/session_01Qmmkt62KVMxDU9gjVV1mm2.**

Phases B to E were not done as separate PRs from this workplan. The rail work (`fa-rail`, a JSON island the rail script renders) and the IG chrome work removed the same weight. Measured on the local full build of folio-assistant b4cd6f9, which is byte-identical on the sampled page to gh-pages 51c51bc (`smart-trust/artifact/ActorDefinition-Holder-testing.html`: 9,486 bytes local, 9,572 live; it was 194 KB on 2026-10-09):

| | 2026-10-02 baseline | 2026-10-29 |
|---|---|---|
| median page, 200 sampled of 9,338 | 220.7 KB | **9.3 KB** |
| median smart-trust artefact page, 200 of 2,160 | 193 KB | **9.3 KB** |
| inline `<svg>` (B) | ~31 KB | 0 |
| harness bar / footer (C) | 38.5 KB × 2 | 0.5 KB |
| nav (D) | 67.4 KB | client-rendered from one JSON island |
| inline `<script>` (E) | ~14.5 KB | 3.3 KB |
| whole site | 595 MiB, about 4,700 pages | 552 MiB, 9,338 pages (207 MiB of it HTML) |

p90 is 57 KB and p99 117 KB. The heaviest pages are long index pages (bibliography 2.1 MB, auto-docs index 1.8 MB, BPMN glossary 836 KB), and their size is content, not chrome.

Checks: axe (wcag2a and wcag2aa) is clean on the sampled artefact page, `smart-trust/index.html` and `cat-harness/index.html`, at both 1280 px and 390 px. Chromium at both widths: no page errors and no horizontal scroll. The e2e suite was not run in this session; the publish pipeline's own checks passed. Observation, not filed: at 390 px the rail opens 248 px wide over the content on first load, on IG and Jekyll pages alike. That may be the intended first-visit drawer.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] **A. IG chrome CSS.** `gen-ig-pages` emits one shared `ig-chrome.css` per chrome and references it, instead of inlining about 6.6 KB per IG page. Lands after #1816 and #1766, or is rebased onto them.
- [x] **B. Icons.** One shared SVG sprite, referenced via `<use href>`. Saves about 30 KB per page.
- [x] **C. Harness bar and footer.** Emitted once and made responsive with CSS. Saves about 25 KB per page. Inside the navbar session's area, so this phase is offered to that session or lands after its series.
- [x] **D. Site navigation.** One shared, cached nav JSON rendered client-side. Every link is a real page, with a noscript fallback. Saves about 70 KB per page. Last, because it overlaps most with ob3m and p5wm.
- [x] **E. Inline scripts.** Moved into shared, cached JS. Saves about 15 KB per page.
```

Where: (three-way hunk)

```text
- [x] A sampled IG page is at most 20 KB, and the whole-site total is reported before and after.
- [x] a11y (axe) and e2e pass, and the Chromium checks pass at both widths.
- [x] The sibling sessions have acknowledged the order, or their overlapping PRs have landed before each overlapping phase.
```
