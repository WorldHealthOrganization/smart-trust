---
# cat-tools-bbnd
$schema: bean/1.0.0
title: 'Translation info drawer: open more translation detail from every translation warning — blocks, pages, (sub)graphs, locales'
status: completed
type: feature
tags:
    - rehomed-from-core
created_at: 2026-10-10T17:26:18Z
updated_at: 2026-10-20T17:20:00Z
---

Owner, 2026-10-10: *"i want to see in the translations warning somewhere the ability to open panel w/ more translation info. needs to be integrated in a few places … see it on content blocks, on a harnessed (sub)graph, etc."* Analysed the same day (folio-assistant-core lane C session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco).

## Owner rulings, 2026-10-10
- **Form: an inline drawer.** A `<details>`-style drawer under the warning, reusing the existing QA panel (`qaBuildPanel`/`qaToggle`, cat-harness `docs/assets/js/docs-ui.js:11198-11290`), so one component serves every scope.
- **JS-rendered.** *"trying to have slim html"*: the warning and its panel are mounted by JavaScript from data the page already carries, not server-rendered.
- **Officiality: recorded in both places, and checked to agree.** The PO header `X-Folio-Official` and `translations/<locale>/status.json` (`official`, `signedOffBy/At`), with a check that fails when they disagree. Official means human sign-off (issue #206).

## Where warnings render today
- **Page badge** "🌐 n/N languages": `docs-ui.js:10620-10700` (`mountTranslationBadges`), reading `#fa-translation-meta`, which `head_custom.html:252-290` writes.
- **Sweep badge**: `docs-ui.js:10708-10741`. Its detail is only in a `title` tooltip.
- **"Unverified translation" notice**: a JS `<details>` at `docs-ui.js:10743-10850`.
- **Per-block and per-page TR QA badges**: `gen-docs-pages.ts:543`, ~595-660 and ~686-711. They are painted from `qa-index.json` and open `qaBuildPanel`.
- **Navbar locale switcher**: `docs-ui.js:430-600`. It stamps `data-fa-translation-status`, which nothing visible uses.
- **KG viewer boundary sentence**: `kg-viewer.ts:591-605`, from the PO header `X-Folio-Official`.
- **who-iris interface notice**: `gen-iris-pages.ts:822`.
- **Translation-status visualiser**: `gen-translation-status.ts:361-560`. It has its own head and no panel.
- **folio-assistant-core's builders**: `build-document-site.ts`, `build-library-site.ts` and `build-folio-site.ts` emit **no** translation status.

## Data per scope
- **Block**: the `translation-qa/v1` sidecar: criteria, witnesses, `source_hashes` for staleness, the PO.
- **Page**: the roll-up `page.translation.json`, `translation_status` and `translation_source`, and the heading drift from `translation-drift.ts:313`.
- **Locale**: `translations/<locale>/status.json` (only `cat-harness/translations/fr` has one) and the PO headers.
- **(Sub)graph**: `localeStatuses(translationsDir)` in `gen-translation-status.ts:223`. No per-graph JSON projection exists yet; `folio-translation-status/v1` is declared at line 77.
- **Catalogue round trip**: new as of who-iris PR #35, `test/results/translation-roundtrip/*.qa-results.json`.

## Integration points
| place | panel shows | data | change |
|---|---|---|---|
| content block (TR icon) | officiality, translator, stale or current, criteria and witnesses, PO link | block sidecar + status.json | `gen-docs-pages.ts` `qaIcons`; `qaBuildPanel` header |
| document page header | per-locale official / agent / missing / stale, drift | meta + roll-up + status.json | `docs-ui.js:10743` |
| folio document and library pages | the same page panel | PO headers + sidecars | core `build-document-site.ts`, `build-library-site.ts` emit `fa-translation-meta` |
| harness / (sub)graph landing | locale coverage, officiality per catalogue, link to the status page | a new per-graph JSON from `localeStatuses` | `gen-translation-status.ts` emits it; the landing generator reads it |
| translation-status visualiser | per-row drawer: catalogues, officiality, missing `.pot`, round-trip results | the same | `gen-translation-status.ts:361` |
| navbar locale control | per-locale state and its reason | `data-fa-translation-status` + status.json | `docs-ui.js:430-600` |
| KG viewer, who-iris | a link into the same panel | `X-Folio-Official`, round-trip report | `kg-viewer.ts:600`, `gen-iris-pages.ts:822` |

## Done when
- [ ] one drawer component serves block, page, (sub)graph and locale scopes, mounted by JS from data attributes, with no new server-rendered markup beyond a data hook
- [ ] it is integrated on content blocks, document pages, the harness/(sub)graph landing and the translation-status visualiser at least
- [ ] officiality is read from both PO header and status.json, and a check fails when they disagree
- [ ] a stale translation (source hash moved) says so in the drawer
- [ ] e2e: opening the drawer on a block and on a graph page shows its facts in both colour schemes

## Owner decision
(1) **Recommended:** a (sub)graph-scope drawer per harness instance, one per instance landing. (2) One per declared sub-graph directory. (3) Per locale only.
**Default if no answer:** option 1.

## Owner ruling 2026-10-11: one drawer per harness instance

Chosen directly by the owner (lane C session): **option 1**. The
(sub)graph-scope drawer sits on each harness instance's landing page and
summarises everything that instance translates: per-locale coverage,
officiality per catalogue, round-trip results, and a link to the
translation-status page. Sub-graph pages show no drawer of their own. A
per-sub-graph drawer (option 2) can be added later without undoing this.

## Progress 2026-10-11 (lane C)

- [x] **Officiality agreement check**, part 1 of the drawer (PR #102):
  `check:translation-officiality` compares each catalogue's `X-Folio-Official`
  with `translations/<locale>/status.json` and reports disagreements,
  "official with nobody named", and unreadable files (exit 2). It found 0
  findings over 5 locales and 83 catalogues; everything is consistently
  unofficial today.
- [ ] **The drawer itself** is not started. It needs new data in the page head
  (`head_custom.html` and the generators) and a built site to verify in both
  colour schemes, and the lane C container cannot build the composed site.


## Progress 2026-10-20 (lane C, on the owner's "do translation drawer")

Three PRs:
- **cat-harness-tools#466:** the projection gains per-locale `officiality`
  from both records, computed by the officiality gate's reader. It also names
  its own `page`. The status table gains a signed-off column and
  `data-fa-tr-locale` rows.
- **cat-harness#377:** the drawer.
  - **Page scope:** a `Translation details` button in the badge row opens a
    `fa-qa-panel` drawer. It shows this page's facts and this site's per-locale
    strings, fuzzy count and signed-off state, with a link to the status page.
    The unverified-translation warning opens the same drawer.
  - **Block scope:** every `TR` panel gains, per locale, whether its verdict is
    stale or current, and the locale's signed-off state.
  - **Loading:** `head_custom.html` publishes `statusSrc`, a path only. A 404
    reads "publishes no translation status"; any other failure reads "could
    not load".
- **cat-harness-tools#467:** `translation-drawer.e2e.ts`, 12 tests across both
  colour schemes. All pass against the drawer and fail against main.

Done-when:
- [x] One drawer component serves the block and page scopes. The (sub)graph
  scope is per instance, ruled 2026-10-11: every page of an instance, its
  landing included, opens the same instance-wide site section. The locale
  scope is the site table's rows. All of it is mounted by JS from a data
  hook.
- [x] Integrated on content blocks, document pages, the instance landing and
  the translation-status visualiser. Each row has a Details drawer listing its
  catalogues with counts and `X-Folio-Official`, from the projection's new
  per-locale `files`.
- [x] Officiality is read from both the PO headers and `status.json`, and
  `check:translation-officiality` fails when they disagree (#102).
- [x] A stale translation says so in the drawer: the block scope, from witness
  freshness, and the page state `stale`.
- [x] e2e: opening the drawer on a block and on a page shows its facts in both
  colour schemes.

**Folio pages, measured on core main.**
- `build-document-site.ts` writes themed pages (`layout: default`), so the
  theme's `head_custom.html` already emits `fa-translation-meta` and
  `docs-ui.js`. Folio document pages get the drawer with no core change. Their
  site section reads "publishes no translation status" until the folio runs
  `gen-translation-status`.
- `build-library-site.ts` writes standalone HTML with no theme, no badge row
  and no `docs-ui.js`. A drawer there needs those pages themed first. That is
  a change to how the library site is rendered, tracked on
  `folio-core-shsz`, not a data hook.

## Completed 2026-10-20 (lane C)

All five done-whens are ticked, and every PR that delivered them has merged:
cat-harness#377 (the drawer), cat-harness-tools#466 (the officiality projection)
and #467 (the e2e).

**Library pages are out of scope by construction, not left open.**
`build-library-site.ts` writes its pages under `en/` only. A library entry is a
frozen source document, and nothing translates it, so a library page carries no
translation and no translation warning for a drawer to open from. Theming those
pages would give the drawer nothing to show. If the library is ever translated,
that becomes its own bean, and the page would pick up the drawer through the
theme the way document pages already do. `folio-core-shsz` closes with this.
