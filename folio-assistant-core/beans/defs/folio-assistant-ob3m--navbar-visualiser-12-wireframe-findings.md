---
# folio-assistant-ob3m
$schema: bean/1.0.0
title: 'navbar visualiser: 12 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-navbar
created_at: 2026-09-23T10:36:15Z
updated_at: 2026-10-06T05:55:41Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/navbar/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **At rest the strip is marks with no labels.** Changed by #1022: the four divider initials are gone, so the harnesses are **not reachable from the strip at all** until the sidebar is opened and "Harnesses" unfolded. That is two actions, and on a touch tablet at 800 px or wider it is ☰ first. What remains is five unlabelled glyphs (▤ ◍ ⇶ ⌘ ▦) and ⌂. Their accessible names exist, but a sighted mouse reader has to hover each one.
2. **Two dividers open the same page.** Folio Assistant and C@T Harness both have `href: "/"`, which is the landing page the reader is already on. The difference only shows as two sections further down that page.
3. **The harness descriptions leak authoring notes and formatting into the landing page.**
4. Folio Assistant's description is a naming rationale: *"NAMED `folio-assistant-checkout` rather than `folio-assistant`…"*, with literal backticks. (→ `folio-assistant-mylx`)
5. C@T Harness's description is five newline-separated alternative spellings ("caaat-harness ca&at-harness .c&at-harness c@t-harness"), which run together as one line.
6. **Each harness's navigation now appears in four places.** The graph kinds appear as the divider's links in the sidebar, as "Folders (25)" for cat-harness, as "visualisations you can open" on the landing, and now as the glass's bottom strip (23 tiles, which is the declared-tile list rather than the divider list). They are generated from one declaration, so they agree. But the strip's captions are the tile titles ("Skills — cat-harness", "folio-assist-core-schemas"), and the sidebar's are the kind names ("skills", "schemas"), so the same destination carries two names.
7. **The open sidebar is long even with its caps.** This is eased, not fixed. With every group folded on arrival, the open sidebar is short until the reader unfolds something. Unfolded, it is "On this page" (11), the 27-page nav, and five dividers with up to 25 graph links each. The CSS comment records that the middle region can shrink to an 8rem floor, and the theme's page list is still the region that gets squeezed.
8. **Mobile: the sidebar's own × / ☰ labels are unstyled below 800 px.** This is read off `docs-ui.css`: every `.fa-nav-toggle` / `.fa-nav-close` rule, and every `:has(.fa-nav-open:checked)` rule, is inside `@media (min-width: 50rem)`, and neither #1010 nor #1022 touched them. Only print hides them. I have not seen a just-the-docs render, so whether the theme's own mobile CSS hides the sidebar footer they sit in is unconfirmed.
9. **The "▾ Folio" handle is fixed at top centre on every page** (`z-index: 91`, 52 px tall in the render). At 390 px it sits over the middle of the theme's top bar, where the title is. New and observed: **it also covers the glass's own content.** The sheet's top padding is 3 rem (48 px), less than the handle, and the sheet scrolls under it. At 390 with Settings scrolled, the handle hides the "Glass" and "High contrast" radio labels. The glyph also stays "▾" when the glass is down. Only the accessible name changes, to "Put your folio away". (→ `folio-assistant-015u`) (→ `folio-assistant-rtuo`)
10. **New: the bottom strip hides most of its tiles, and says nothing about it.** 25 tiles in one row: 11 visible at 1280, 2½ at 390. The rest scroll sideways inside the strip, with no arrow, count or edge fade. On a phone, only Todos, Settings and agent-skills-library are on screen, and library, processes and tools are off it. (→ `folio-assistant-2r2n`)
11. **New: most declared tiles on the strip wear the same glyph.** In the render, 21 of the 23 declared tiles draw the same generic outline SVG. Only beans and uploads differ. Tiles are told apart by caption only, and several captions wrap to three lines at 88 px ("folio-assistant-sci-library").
12. **New: there are two unrelated "Settings".** ⚙ Settings on the glass sets the glass: theme, avatars, opacity and blur. ▦ Actions → Settings sets the page: scheme, reading preferences, the Discarded fish and Declared kinds. They share a name and a gear, and neither points to the other. A reader who wants the Discarded items and opens the glass Settings, the one now on screen at the bottom of every page, will not find them.

Related: `folio-assistant-603s`, `folio-assistant-1le7`, `folio-assistant-z1ug`

When fixed, re-draw `cat-harness/docs/wireframes/navbar/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

**New notes on this bean go in [`beans/notes/`](../notes/), not here** (bean `m61r`, issue #1853): `bun run cat beans:note folio-assistant-ob3m --title "…"` writes one file per pull request, so sibling pull requests stop conflicting on this file. The dated sections below were appended before that convention and stay where they are.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 11 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — 1. At rest the strip is marks with no labels; harnesses not reachable from the strip: 1280x800, .side-bar is 56px at rest. Hit-test down x=12/28/44: .fa-nav-icon links Todos/Beans/Processes/Knowledge graph, button 'More actions' and the scheme button all have innerText '' (name only via aria-label). Harness dividers sit inside details.fa-nav-group (summary '▦ Harnesses', open=false); the harness link…
- **STILL-PRESENT** — 2. Two dividers open the same page (Folio Assistant and C@T Harness both href '/'): .fa-nav-bottom .fa-nav-row > a: 'Folio Assistant' href=/folio-assistant/ and 'C@T Harness' href=/folio-assistant/. Both point at the landing page. The other dividers now have their own pages (/smart-trust/, /who-iris/, /bootstrap/README.html).
- **STILL-PRESENT** — 3. Harness descriptions leak authoring notes and formatting into the landing page: p.fa-harness-section__description on the landing still carries both texts described in findings 4 and 5. The same texts also appear in .fa-landing-sticky__body (Stickies panel).
- **STILL-PRESENT** — 4. Folio Assistant description is a naming rationale with literal backticks: The .fa-harness-section__description innerText starts 'The repository itself, acting as an initialized instance. NAMED `folio-assistant-checkout` rather than `folio-assistant`…' and has 10 literal backtick characters.
- **STILL-PRESENT** — 5. C@T Harness description is newline-separated alternative spellings that run together as one line: The .fa-harness-section__description computes white-space:normal and renders as 1 line: 'computable adjudication and agentic test harness caaat-harness ca&at-harness .c&at-harness c@t-harness'. In the Stickies copy each spelling is now its own <p>, but it is still the same authoring text.
- **STILL-PRESENT** — 6. Each harness's navigation appears in four places, and the same destination has two names: The same set still appears in 4 places: the sidebar divider kids, 'Folders 29' (.fa-nav-folders), 6 'visualisations you can open' blocks on the landing, and the glass 'More' panel (20 .fa-tile). The names still differ: the glass tile says 'Skills — cat-harness' / 'Docs — cat-harness' / 'folio-assist-core-schemas' wh…
- **STILL-PRESENT** — 7. The open sidebar is long even with its caps: 1280x800, sidebar opened (264px) and every details unfolded: 506 links in .side-bar. nav.site-nav is 2228px tall inside div.fa-nav-middle, which is 128px high with scrollHeight 3244 (overflow auto). The page list is still the squeezed region. On arrival all 4 groups are folded (open=false).
- **STILL-PRESENT** — 8. Mobile: the sidebar's own ×/☰ labels are unstyled below 800px: 390x844: the class is now .fa-nav-head, not .fa-nav-toggle. The copy inside the theme footer (div.d-md-none) is display:inline, 9.6px, with transparent background and no border, at y≈6982. It renders as plain text '☰C@T Harness / ▶ ▦Harnesses / ⌂C@T Harness' under the build stamp (screenshot rv/nav-390-footer.png).
- **STILL-PRESENT** — 9. '▾ Folio' handle fixed top centre over the top bar and the glass's own content; glyph stays ▾ when down: .fa-glass-handle: z-index 91, position fixed. It is now 28px tall at 1280 and 25px at 390 (was 52px). At 390 its rect [154,0,82,25] is over a.site-title. With the glass open the text is still '▾ Folio' and only aria-label changes ('Put your folio away'). With glass ⚙ Settings open and scrolled, the labels passing un…
- **FIXED** — 10. Bottom strip hides most of its tiles with no arrow, count or fade: With the glass open, .fa-glass-tiles holds 4 tiles (Todos, Filter, Settings, ⋯More). scrollWidth equals clientWidth (1280/1280 and 390/390) and none is off-screen at either width. The 20 declared tiles moved behind a labelled 'More — every visualisation this folio declares' tile. Caveat: at 1280 the More panel is 95… — dbbc2b6ef
- **STILL-PRESENT** — 11. Most declared tiles wear the same glyph: Glass → More: 18 of the 20 .fa-glass-more-item .fa-tile draw the identical outline SVG path ('M12 4.5 5 9.5…'). Only beans and uploads differ. The tiles are now in the More panel rather than the strip.
- **STILL-PRESENT** — 12. Two unrelated 'Settings': The glass ⚙ Settings panel (aria 'Folio settings — theme, avatars, opacity') holds Theme/Avatars/Opacity/Blur/Harnesses/Tidy and no text matches /discard|fish/ or points to the page settings. ▦ More actions → 'Settings' holds scheme, Larger text, Higher contrast, Underline links, Reduce motion and the Discarded item…


---

## 2026-09-30 — findings 11 and 12 root-caused; 11's declaration half now gated

Worked from `claude/cool-fermi-htir5p`, on the owner's request for a QA check
that *"each harness LHS navbar header and menus are themed appropriately and has
consitent layout/icon/navgation"*.

### Finding 11 has TWO causes, and only one was where the finding looked

The render says *18 of 20 tiles draw the identical outline path*. Reading the
client, `docs/assets/js/docs-ui.js`:

- **`ROW_GLYPHS`** (the navbar row, 5 slots) already carries **five distinct
  drawings**, and its own comment insists on it: *"a row where four slots are
  indistinguishable is a row that says nothing."* The row is not the defect.
- **`TILE_GLYPHS`** (the glass tile panel) carries **two** entries, `beans` and
  `uploads` — which is exactly the finding's *"Only beans and uploads differ."*

But the registry is not short of drawings. The declaration side is:
**2 of 11 declared tiles name a glyph at all**; the other 9 call
`glyphFor(undefined)` and take the fallback. Per instance: `cat-harness` 7 of 9,
`smart-trust` 1 of 1, `who-iris` 1 of 1.

**The two denominators are not the same number and must not be quoted as one.**
The render's 20 includes tiles derived from pages rather than from
`directories[].tile`; this 11 is the declaration-side half. A static check
cannot see the rendered panel, so the rendered count still needs an e2e
assertion — NOT done here, and named as outstanding below.

### What is gated now — `bun run cat check:navbar-consistency`

New: `cat-harness/scripts/check-navbar-consistency.ts`, wired into
`code-quality-gates.yml` as `check:navbar-consistency:check` (`:check` and not
`:strict`, deliberately — see below). 13 unit tests in
`cat-harness/scripts/tests/navbar-consistency.test.ts`.

| family | blocking | today |
|---|---|---|
| `unregistered-tile-icon` — a declared name absent from `TILE_GLYPHS` | yes | 0 |
| `registry-disagreement` — one id, two registries, two glyphs | yes | 0 (overlap 1) |
| `tile-without-icon` — declared tiles sharing the fallback | no | 9 of 11 |
| `art-declared-no-icon` — images shipped, none named as `icon` | no | 1 (`who-iris`) |

Every family was falsified before it shipped: plant the defect, watch it fire,
restore, watch it pass. Renaming either registry literal exits **2**, not 0 —
could-not-determine is never green (`dh4f`), and a registry read as empty would
satisfy every family above.

**Advisory rather than blocking for the two coverage families**, on the line
`check:theme-art` already drew: whether an artefact deserves its own drawing is
editorial, and `glyphFor`'s fallback is deliberately defended in its docblock.
What was missing was never the fallback — it was the COUNT. This finding had to
be taken by hand off a render.

### One correction to the record

A first draft of the check treated the instance-level `icon` as a glyph-registry
name and would have reported `cat-harness`'s navbar mark as falling back to the
net. **It does not.** `sync-docs-harness.ts` resolves it with
`decl.images?.find((i) => i.id === decl.icon)`, so `icon: "mark"` ends at
`/assets/img/icons/cat-mark.svg` and works. Two unrelated namespaces:

- instance `icon` -> an id in that instance's `images` -> an SVG file
- `directories[].tile.icon` -> a name in `TILE_GLYPHS` -> an inline glyph

The script now carries a test per namespace so a later change cannot re-collapse
them.

A second draft had a `dangling-instance-icon` family. It was **dead code**:
`readDeclaration` already throws on an `icon` naming no declared image, and
names every valid id while doing it. The planted-defect test found it by getting
the schema's error instead of the finding — reading the code did not show it.
The script now refuses (exit 2) on an unloadable declaration rather than
duplicating a verdict the schema owns.

### Still open on this bean

- **Finding 11, rendered half** — an e2e assertion counting distinct
  `.fa-tile svg` in the rendered panel. The static check cannot reach it.
- **Finding 12** — two unrelated "Settings", both wearing a gear, neither
  pointing at the other. Untouched: it is a navigation-structure defect, not an
  icon-resolution one, and the repair (rename, or cross-link) is an editorial
  call rather than a check's.
- The remaining ten findings on this bean.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 11 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — 1. At rest the strip is marks with no labels; harnesses not reachable from the strip: 1280×800 hit-test down x=12/28/44: the .fa-nav-icon links Todos/Beans/Processes/Knowledge graph, the 'More actions' button and the scheme button all have innerText '' (name only via aria-label). The harness dividers are still inside details '▦ Harnesses' (open=false). (nav8.mjs)
- **STILL-PRESENT** — 2. Two dividers open the same page (Folio Assistant and C@T Harness both href '/'): 'Folio Assistant' → /folio-assistant/ and 'C@T Harness' → /folio-assistant/. Side note: the Bootstrap divider now goes to /folio-assistant/processes/ (it was /bootstrap/README.html, which 404s in this build). (nav10.mjs)
- **STILL-PRESENT** — 3. Harness descriptions leak authoring notes and formatting into the landing page: p.fa-harness-section__description still carries both texts from findings 4 and 5. The same texts appear in 2 .fa-landing-sticky__body elements. (desc.mjs, nav10.mjs)
- **STILL-PRESENT** — 4. Folio Assistant description is a naming rationale with literal backticks: Narrowed since 2026-09-29: the description now has 0 literal backticks (the spans render as code). It still reads 'The repository itself, acting as an initialized instance. NAMED folio-assistant-checkout rather than folio-assistant, which …', which is a naming rationale, over 3 lines. (desc.mjs)
- **STILL-PRESENT** — 5. C@T Harness description is newline-separated alternative spellings that run together as one line: white-space:normal, 1 line: 'computable adjudication and agentic test harness caaat-harness ca&at-harness .c&at-harness  c@t-harness'. (desc.mjs)
- **STILL-PRESENT** — 6. Each harness's navigation appears in four places, and the same destination has two names: The same set is still in 4 places: the sidebar divider kids, 'Folders' (.fa-nav-folders, 20 links), 6 'visualisations you can open' blocks on the landing, and the glass 'More' panel (27 .fa-tile). The names still differ, e.g. 'Skills — cat-harness' / 'Docs — cat-harness'. (nav6.mjs, nav4.mjs, nav10.mjs)
- **STILL-PRESENT** — 7. The open sidebar is long even with its caps: 1280×800 with the sidebar opened (264px) and every details unfolded: 524 links in .side-bar (was 506). nav.site-nav is 2260px tall inside div.fa-nav-middle, which is 128px high with scrollHeight 3276. On arrival all 4 groups are folded. (nav8.mjs)
- **STILL-PRESENT** — 8. Mobile: the sidebar's own ×/☰ labels are unstyled below 800px: 390×844: the .fa-nav-head copy inside the theme footer (div.d-md-none) is display:inline, 9.625px, transparent background, no border, at y≈6968. It renders as plain text under the build stamp. (nav6.mjs, nav7.mjs)
- **STILL-PRESENT** — 9. '▾ Folio' handle fixed top centre over the top bar and the glass's own content; glyph stays ▾ when down: .fa-glass-handle is z-index 91, position fixed, 93×28 at 1280 and 82×25 at 390. At 390 its rect [154,0,82,25] is over a.site-title 'C@T Harness'. With the glass open the text is still '▾ Folio', and only the aria-label changes ('Put your folio away'). (nav2.mjs)
- **FIXED** — 10. Bottom strip hides most of its tiles with no arrow, count or fade: Still fixed. With the glass open, .fa-glass-tiles holds 4 tiles, scrollWidth equals clientWidth (1280/1280 and 390/390), and none is off-screen. — dbbc2b6ef (nav4.mjs)
- **STILL-PRESENT** — 11. Most declared tiles wear the same glyph: Glass → More: 25 of the 27 .fa-glass-more-item .fa-tile draw the identical outline SVG path ('M12 4.5 5 9.5…'). Only beans and uploads differ. The tile captions are clamped to 6 lines at 91–104px. (nav4.mjs)
- **STILL-PRESENT** — 12. Two unrelated 'Settings': The glass ⚙ Settings panel ('Folio settings — theme, avatars, opacity') holds Theme/Avatars/Opacity/Blur/Harnesses/Tidy, and no text matches /discard|fish/ or points to the page settings. ▦ More actions → 'Settings' is still a separate panel. (nav9.mjs, nav8.mjs)


_2026-09-30T23:0Xz_ — **Holder recorded, retroactively, by the session that already held it.** `bun run cat beans:claim folio-assistant-ob3m` REFUSED this bean: *"already in-progress on the default branch, and NOBODY RECORDED A HOLDER — so this cannot tell a sibling working it right now from a claim somebody abandoned."* That is bean `c3d7`, and the unrecorded holder was **this session**: the declaration half of finding 11 and `check:navbar-consistency` landed from `claude/cool-fermi-htir5p` in PR #1687, which set the status without writing a holder note.

Checked before writing, as the refusal instructs: 14 open PRs, none claims this bean. #1709 matches on "navbar" but is about the Folio handle's scroll band, and #1633 matches "glyph" incidentally. So it was free, and it was free because *I* left it looking taken.

Continuing here on **finding 11's rendered half** — an e2e assertion counting DISTINCT glyph drawings among the rendered `.fa-tile svg`, which the static check structurally cannot reach. Session: https://claude.ai/code/session_01MSKrDXE3bhaMth9NuG63z8


## 2026-09-30 — finding 11's RENDERED half is now asserted, and three denominators are not one number

The declaration half was gated by `check:navbar-consistency` in #1687. The
rendered half is now a Playwright assertion in
`cat-harness/test/action-tiles.e2e.ts`, which is where it belongs: that spec
already loads the real `docs-ui.js` and `docs-ui.css` from the site dir, so it
renders the launcher without a site build.

### The measurement, today, computed rather than quoted

`harness.json` carries **30** declared tiles, all visible. **2 of 30 name an
icon** — `beans` and `uploads`, exactly the two `TILE_GLYPHS` holds — so
**28 fall back to one drawing**, and the rendered panel shows **36 tiles with
9 distinct drawings**.

**None of those is this bean's earlier number, and that is the point it already
made.** The render said *"18 of 20"*; the declaration half said *"2 of 11"*;
today it is 2 of 30 declared and 28 of 36 rendered. So the test hardcodes
**no** figure from this prose: every number in its failure message is computed
from the fixture at run time, and the single literal is the ratchet.

### Why a ratchet and not an equality

`glyphFor` falls back to `NET_GLYPH` for every unregistered name, so sameness
is this panel's DEFAULT rather than an accident. An equality would go red the
first time somebody DREW a glyph — it would fail on the improvement it exists
to encourage. A ceiling fails only when sameness gets worse, and silently
permits every step toward fixing it. `FALLBACK_CEILING = 28`, to be LOWERED
when a glyph is drawn and never raised.

### Two things the fixture had to be taught, and one assertion that was vacuous

**The fixture rendered the wrong population twice before it rendered the right
one.** A first probe passed `harness.json` raw where the spec wants an id→path
map, and got 3 tiles. Corrected, it got 6 — and reported all 6 distinct,
because those are the BUILT-IN controls (Settings, Language, QR code, Knowledge
graph, JSON-LD, Source), each carrying a hardcoded drawing and none going
through `glyphFor` at all. The declared tiles arrive by a different route
entirely: `<meta name="fa-tiles">`, filled at
`_includes/head_custom.html:403` from `site.data.harness.tiles`. Until the
fixture supplied that, every assertion about glyph sameness was measuring
something else and passing.

Supplied as an OPTIONAL third parameter defaulting to `null`, so all 22
existing tests in that file are unchanged in behaviour: the caption assertions
there name their tiles exactly (`["Search", "Settings", "Language", "QR
code"]`), and putting the meta into the shared fixture would have rewritten six
unrelated tests to accommodate one new one.

**And one of my own assertions was vacuous** — `expect(groups.size)
.toBeGreaterThan(1)`, meant to check that naming an icon buys something. It
counts distinct drawings over the WHOLE panel, and the nine built-in ones are
always distinct, so it passed with every declared tile on the fallback: the
exact state it was written to reject. `dh4f`, caught by trying to falsify it
rather than by reading it. It now identifies the fallback as the DOMINANT
drawing and asserts each named tile differs from it.

### Falsified, each assertion independently

| planted | fired with |
|---|---|
| ceiling 28 → 27 | *"28 tiles draw the SAME glyph, out of 36 rendered (2 of 30 declared tiles name one, and 9 distinct drawings appear)"* |
| `beans` un-registered from `TILE_GLYPHS` | 29 identical, 8 distinct — and the message's second branch names the cause: a glyph name stopped resolving while the declaration still claims it |
| both names aliased TO the fallback | fired on the ceiling at 30, so the named-glyph assertion was **not** exercised — re-run with the ceiling raised to 99 to isolate it, and it fired: *"tile \"beans\" declares icon \"beans\" but draws the FALLBACK … the declaration buys nothing"* |

The third row is the one worth keeping: a guard that fires for the wrong reason
has not been falsified, and the only way to know was to disable the assertion
in front of it.

All 23 tests in the spec pass; `docs-ui.js` has no diff after the falsifications.

### Still open on this bean

- **Finding 12** — two unrelated "Settings", both wearing a gear. Untouched: the
  repair is editorial (rename, or cross-link), not a check's.
- The remaining ten findings, 11 of which were still present at the last
  re-measure on `main` 3779d5d27.


## RULED 2026-10-01 — finding 12: rename the GLASS one

The owner chose, from three options: **rename the glass/board control, leave the
launcher's `Settings` alone.**

Located both, so the repair names lines rather than descriptions:

| site | call | scope |
|---|---|---|
| `docs-ui.js:2060` | `tileButton(GEAR_GLYPH, "Settings", "settings")` | the LAUNCHER — site chrome: theme, language, QR |
| `docs-ui.js:6053` | `chromeTile("glass-settings", "Settings", "⚙", "Folio settings — theme, avatars, opacity", buildSettings)` | the GLASS BOARD — folio state |

Two different things, both named `Settings`, one drawing `GEAR_GLYPH` and the
other the `⚙` character, neither pointing at the other — exactly as the finding
recorded it.

**The glass one is renamed because its own description already says what it is**
— *"Folio settings — theme, avatars, opacity"*. So the rename RECOVERS
information the code already holds rather than inventing a distinction, which is
the cheapest kind of editorial fix and the hardest to get wrong.

**Cross-linking was rejected** and is worth recording as rejected: it would
imply a relationship between site chrome and board state that does not exist.
Giving them different glyphs was also rejected — two controls called the same
thing is the defect, and a different gear does not fix a duplicate name for a
screen reader.


## 2026-10-01 — re-measured on a local build of claude/quirky-hypatia-k3aoh4 (PR #1762)

Built with preview-site.sh, served at /folio-assistant/, 1280×800 and 390×844. Session https://claude.ai/code/session_01Cw8JgZEDT5VqQ5ergjdMjB.

- **8 — FIXED by #1762.** The Jekyll include renders no `.fa-nav-head` (☰) and no `.fa-nav-close` ([x]): zero of either on the built page at both widths. The owner asked for both to go (#1757) because the avatar already toggles the bar. The mobile footer copy still shows '▦Harnesses / ⌂C@T Harness' as a block, which is the harness list rather than a stray control.
- **2 — FIXED in #1762.** A harness whose folio is the site root now links to its own section on the landing: Folio Assistant → `/#harness-folio-assistant`, C@T Harness → `/#harness-cat-harness` (`harness-tiles.ts`; the ids come from `_includes/harness_details.html`). Two rows no longer open one page.
- **12 — FIXED on main** (the glass tile is 'Folio settings', docs-ui.js:6070).
- **1, 3, 4, 5, 9 — STILL PRESENT** as last recorded: resting-strip icons carry aria-label only; the landing descriptions still carry the naming rationale (4) and the run-together spellings (5); the '▾ Folio' handle is still [154,0,82,25] over the site title at 390.
- 6, 7, 11 not re-measured this round.


## 2026-10-01 — findings 4 and 5: a reader's summary, spellings as a list (owner's choice)

Owner chose, from three options: keep the C@T spellings visible, as a list. So the declaration gains two optional fields (`summary`, `alsoWritten`; `CatHarnessDeclarationSchema`), and the landing's harness section (`_includes/harness_details.html`) prints `summary` when declared, else `description` as before, plus an 'Also written:' line. Measured on a local build:

- Folio Assistant: 'This repository as a working instance: the platform and the folios it hosts.' (the naming rationale stays in `description`, where it is for authors)
- C@T Harness: 'Computable adjudication and agentic test harness.' then 'Also written: caaat-harness, ca&at-harness, .c&at-harness, c@t-harness'

**Not changed:** the two landing STICKIES (`cat-harness/folio/*.json`) are folio content; the C@T card's spellings are the acronym's derivation chain and `landing-sticky.test.ts` pins them on purpose. Finding 3's sticky half is therefore left as authored.


## 2026-10-01 — finding 9: FIXED in #1762

- The handle's mark follows the state: ▾ closed, ▴ open (it stayed ▾ with the glass down; only the aria-label changed). Measured: ▾ → ▴ on open → ▾ on Escape, at 1280 and 390.
- Below 50rem the site title is held left of the handle (`max-width: calc(50vw - 3rem)`, ellipsis, no right padding, auto right margin so the header's icon buttons stay right). Measured on a local build: at 390 the title box ends at 153 and the handle starts at 154, 'C@T Harness' is not truncated, a 32-character title is ellipsised, and 0 header controls sit under the handle at 360, 390 and 700. At 360 'C@T Harness' itself ellipsises — the honest cost at that width.


## 2026-10-01 — finding 11 fixed, rendered half measured

Owner: "keep going". On `claude/quirky-hypatia-k3aoh4` (PR #1762).

- **Declared half**: `TILE_GLYPHS` gains seven drawings (tools, schemas, skills, methodologies, index, docs, library; `processes` now shares the row's PROCESS_GLYPH). Every declared tile names one: `check:navbar-consistency` reports **14 of 14** (was 2 of 14), and the corpus no longer emits `tile-without-icon`.
- **Rendered half**: most tiles are DERIVED from a dependency's directory, not declared, so a declared-only fix left 20 of 29 on the net. `graph-tiles.ts` now falls back to the directory's graph KIND (`KIND_TILE_ICONS`, `kindTileIcon`); a declared icon still wins. `check:navbar-consistency` fails a kind mapped to an undrawn name (falsified: planted `librar`, exit 1).
- **Measured on a local build, Glass → More at 1280×800: 29 tiles, 11 distinct drawings** (was 2). Six tiles still take the net because their kinds have no drawing: folio, fsh-guts, root-docs, swimlane-glossary, todos, translation-sources.

Still open here: 1, 3 (sticky half), 6, 7, 12 (needs an editorial call: rename or cross-link the two Settings).


## Finding 6: owner's ruling and implementation (2026-10-01)

**Ruling.** On 2026-10-01 the owner chose option 1 of 4, **"One name everywhere"**. Each destination gets ONE label, used identically on every surface: the viewer rail, the Jekyll sidebar and FOLDERS, the landing's "visualisations you can open", the glass tiles and More panel, and the Stickies "Visualisations" row. Where the harness matters, a surface appends it as a qualifier ("Skills · C@T Harness") and never uses a different base name.

**Implemented** in PR #1804, which is stacked on #1762:

- `cat-harness/scripts/lib/nav-label.ts` is the one label source:
  - a kind's display name comes from the new `GraphKindDef.title`;
  - a harness is named by its declared `title`;
  - a tile uses its declared title with any harness suffix stripped, and never the directory id.
- The suffixed tile titles were removed from the declarations.
- Bootstrap's row now opens its own landing section instead of `/processes/`.
- The IRIS sticky link says "WHO IRIS".
- New gate: `check:nav-names:check`, with a committed sidecar.

**After, measured** with Playwright on a preview build, served on a dedicated port, over the same six surfaces:

| | destinations | on two or more surfaces | with two names, exact | with two names, case and plural folded |
|---|---|---|---|---|
| before (644d04b) | 56 | 39 | 9 | 7 |
| after | 58 | 40 | **0** | **0** |

The gate reads 76 destinations statically, across 61 railed pages, the include, `harness.json` and the stickies. On the 644d04b tree it fails with 36 multi-named destinations; on this branch it passes.

_2026-10-01_ — **Finding 12: owner's ruling implemented, in PR #1810 (stacked on #1762).** Owner, choosing option 2 of 4: *"Rename: 'Glass settings' and 'Page settings', each with a link to the other."*

- The glass ⚙ panel is now **Glass settings**: its caption and heading read "Glass settings — theme, avatars, opacity, blur" (the heading used to be "Theme, avatars, opacity"). The ▦ Actions panel is now **Page settings**, in its caption and view heading. Both names come from `SETTINGS_NAMES` in docs-ui.js, declared once.
- Each panel's first control links to the other: "Page settings (scheme, reading, Discarded) →" and "Glass settings (theme, avatars, opacity, blur) →". Each link OPENS its target: it closes the panel it came from (the glass covers the sidebar), never toggles an already-open target shut, and focuses the target's heading. On a page with no launcher (replica, harness page) the glass draws no Page settings link.
- **After state, measured on a local build** at 1280×800 and at 390×844: page→glass gives glass open with the glass-settings panel visible, and glass→page gives the launcher open with the "Page settings" heading visible and in the viewport.
- Tests: `test/settings-crosslinks.e2e.ts` (10/10 pass; 9/10 fail on #1762's head) and `scripts/tests/settings-labels-distinct.test.ts` (6/6 pass; 5/6 fail on the head). Skill: `board-windows` §"Two settings panels, two names, each points to the other".
- Found, not fixed (also on the head): at 1280×800 the glass panel opens at y≈591, and most of its body sits under the bottom tile strip until the glass is scrolled.

## Finding 3: ruling and after state (2026-10-01, PR #1807, stacked on #1762)

**Ruling.** The owner picked option 1 of 4: *"Stickies show the same text as the landing page"*. A harness's sticky shows the declaration's `summary` and its `alsoWritten` spellings under "Also written", and never authoring notes.

**After.** Sticky contributions declare `bodyFrom: "summary"`. The card text comes from `readerText` in `schemas/sticky-contribution.ts`: the `summary` (else the description), then "Also written: …". This is the same rule `harness_details.html` uses, so both surfaces read the same two fields.
- folio-assistant card: was "The repository itself… NAMED `folio-assistant-checkout`…". Now "This repository as a working instance: the platform and the folios it hosts."
- cat-harness card: was five loose lines of spellings. Now "Computable adjudication and agentic test harness." followed by "Also written:" and the four spellings. Its `bodyAppend` (the cat introduction and the scope line) is kept.
- smart-trust and who-iris: unchanged. They declare no summary, so they fall back to the description, which the landing shows too.
- bootstrap: unchanged. It is a pinned submodule still on `bodyFrom: "description"`, and it declares no summary.

`landing:sticky:check` (CI) now fails when a card built from its declaration does not open with that text. It fails when run against the #1762 head files.

## 2026-10-01 — finding 1: the owner's ruling, implemented (PR #1805, stacked on #1762)

**Ruling (option 1 of 4):** "Make ▦ Harnesses visible on the landing page too, and show each icon's name as a tooltip on hover or keyboard focus." The rail stays narrow, 56px at rest. Always-visible captions (option 2) were not chosen.

**After, measured on a local build, compared with #1762's head 644d04b9959 (`preview-site.sh`, Playwright, light and dark):**

| | before | after |
|---|---|---|
| landing 1280: ▦ at rest | hidden (opacity 0, max-height 0) | visible in the 56px strip, at x 12–44 |
| landing 1280: actions to a harness | 2 (hover, then click) | **1** (click ▦; 6 harness links reachable) |
| viewer pages (todos, cat-harness/schemas) 1280 and 390 | 1 | 1 (unchanged) |
| landing 390 (theme menu) | menu tap + ▦ tap | unchanged (the strip rules apply only at 50rem and up) |
| landing icons named on hover | no (hover widened the strip and moved the icon out from under the pointer) | tooltip = aria-label, at left 64px, strip still 56px; all 6 icons |
| landing icons named on Tab focus | no | tooltip beside the open strip (left 272px), level with the row |
| strip width at rest | 56 | 56 |

**How:**
- The bottom disclosure's summary is exempt from the at-rest lists; only its word and caret wait for the strip to open.
- `[data-fa-tip]::after` is a fixed-position tooltip with alt text `""`, so the accessible name stays the aria-label.
- Arriving on the icon column holds the strip shut (`.fa-nav-tip-hold`, set from the column's at-rest box) so the icon stays under the pointer. Arriving anywhere else still peeks.
- New QA flags `rail-tips` and `harnesses-at-rest` in `check-viewer-nav.ts`: `layoutFlags` for viewer pages and `stripFlags` for the docs site's script-built strip.

**Scoped deliberately:** a rail row that has a visible `.fa-nav-label` gets no tooltip. Hover and keyboard focus open the rail, and that label then reads beside its mark.

## Re-verified 2026-10-01 on PR #1762 head 644d04b9959

Re-measured the four findings still open: 1, 3, 6 and 7. Built with `preview-site.sh` from `claude/quirky-hypatia-k3aoh4` at 644d04b9959, which includes main as of today plus the new viewer rail. Served at `/folio-assistant/` and driven by Playwright at 1280×800 and 390×844. Pages: the landing, `/cat-harness/schemas/` and `/todos/`. Every verdict comes from the built page, not from reading code. "Visible" means hit-tested with `elementFromPoint`, because the closed strip clips labels that are still in the DOM. The screenshots are local only (`.screens/ob3m-v-*.png`, git-excluded).

The PR #1762 sections on this bean (2, 4, 5, 8, 9 and 11 fixed) live on that branch. This note sits on main and does not repeat them.

| # | verdict | evidence |
|---|---|---|
| 1 | **CHANGED** | Two surfaces now behave differently. **Landing (theme sidebar), 1280:** the strip is 56 px and shows 6 icon controls (Todos, Beans, Processes, Knowledge graph, More actions, scheme). All have innerText `''`, with the name only in aria-label. `▦ Harnesses` is at **opacity 0** at rest, so no harness is visible on the strip. A hover widens it to 264 px and one click on ▦ shows the harness links, so it takes 2 actions. **Viewer rail (schemas/, todos/), 1280 and 390:** at rest it is 56 px and shows avatar, `§`, `▤`, `▦` and `⌂`. `▦` is opaque but unlabelled. One tap opens the rail (264 px / 248 px) with the 6 harnesses listed (F Folio Assistant, S smart-trust, S SMART Base, W WHO IRIS, C@T Harness, B Bootstrap). So harnesses are now reachable from the rail in 1 tap plus the link, but at rest it is still marks with no labels. **Landing at 390:** the theme's inline menu shows labelled `ON THIS PAGE 19 / FOLDERS 23 / PAGES 66 / ▦ HARNESSES`, and one tap shows 14 harness links. |
| 3 | **CHANGED, landing half fixed, sticky half still present** | `p.fa-harness-section__description` now reads 'This repository as a working instance: the platform and the folios it hosts.' and 'Computable adjudication and agentic test harness.', followed by `.fa-harness-section__also` 'Also written: caaat-harness, ca&at-harness, .c&at-harness, c@t-harness'. The **Stickies** reader (`.fa-landing-sticky__body`, opened by clicking the card) still shows, at both widths, 'The repository itself, acting as an initialized instance. NAMED `folio-assistant-checkout` rather than `folio-assistant`, which `cat-harness/harness.json` already uses: two declarations sharing a name makes `declaredBy` … ambiguous …' (1 `<p>`, code spans). The C@T sticky still opens 'computable adjudication and agentic test harness caaat-harness ca&at-harness .c&at-harness c@t-harness' (7 `<p>`). That half was left as authored on purpose (see the 4–5 note on #1762). |
| 6 | **STILL-PRESENT, widened from 4 places to 6** | Harness graph kinds now appear in: (A) the sidebar divider kids, 59 links; (B) `FOLDERS`, 23 rows / 17 hrefs; (C) landing 'visualisations you can open', 35 links; (D) **new**, a 'Visualisations' tile row inside the landing Stickies panel; (E) glass `⋯ More`, 15 tiles; (F) **new**, the viewer rail's `▤ Graphs` and `▦ Harnesses`, 27 links on schemas/. 10 destinations appear in all 6, and 6 more in 4. Of the 34 destinations in two or more places, **7 carry more than one name**, ignoring case and plural: `docs/docs/` 'docs' (A,B,C,F) vs 'Docs — cat-harness' (D,E); `skills/skills/` 'skills' vs 'Skills — cat-harness'; `root-docs/` 'docs' (A,C) vs 'root-docs' (D,E); `methodologies/` 'methodology' vs 'Methodologies'; `schemas/cat-harness/` reached as both 'cat-harness' and 'schemas'; `processes/` also as 'Bootstrap' on the rail; `who-iris/` 'The IRIS replica' vs 'WHO IRIS'. The plural fold also hides `external-schemas/` 'external-schema' vs 'External schemas'. Harness names differ too: the sidebar says 'C@T Harness' and the rail's kind descriptions say 'cat-harness'. |
| 7 | **STILL-PRESENT on theme pages; CHANGED on the viewer rail** | Landing at 1280, sidebar open (264 px), all 4 groups unfolded: **531 links** in `.side-bar` (524 on 2026-09-30). `.fa-nav-middle` is at its **128 px floor** (`min-height: 128px`) with scrollHeight **3682**, or 17634 with every theme subtree forced open. `nav.site-nav` is 2852 px tall with 430 links, and **0 of them are visible** in the middle region without scrolling, because `FOLDERS` (789 px) sits above it in the same region. `.side-bar` also scrolls (2108 / 800), so there are two nested scroll regions. The theme page list is still the squeezed region. **Viewer rail:** 28 links (schemas/) and 27 (todos/), with one scroller, `.fa-nav-graphs` (418 of 1872 px at 1280, 462 of 1872 at 390), and no theme page list. |

Session: https://claude.ai/code/session_01Cw8JgZEDT5VqQ5ergjdMjB

## RULED 2026-10-01: findings 7 and 8, the theme sidebar takes the viewer rail's layout (PR #1808, stacked on #1762)

**Finding 7.** The owner chose option 1 of 4: *"Use the viewer-rail layout on Jekyll pages."* `mountSidebarRail` (docs-ui.js) now moves three things into the one `.fa-nav-middle` scroller, in this order:

1. "On this page", folded.
2. The page list, the only group open on arrival.
3. A new **Graphs** disclosure, folded, holding FOLDERS and the harness group moved out of the footer. Each keeps its own fold.

Home stays pinned in the footer. The folded Graphs heading is sticky to the scroller's bottom edge, so it is always one row away.

**Finding 8.** The owner chose option 1 of 4: remove the sidebar's own ☰/×, as #1762 did on the rail. #1762 had already dropped the markup from the generated include (0 in the built page before this change). This change removes the rules and handlers that were left behind:
- every `.fa-nav-toggle`, `.fa-nav-close` and `.fa-nav-head` rule in docs-ui.css;
- the `[x]` row move and the ☰/× handlers in docs-ui.js.

The avatar is the one control. It opens and closes the bar, and it sets and lifts stay-closed, by pointer and by keyboard (Enter).

**Measured on local builds** with `preview-site.sh`, served at `/folio-assistant/`, using Playwright with hit-tested visibility. Base is 644d04b9959; after is this branch.

| landing, 1280×800, sidebar pinned open | before | after |
|---|---|---|
| scroll regions on arrival | 1 (`fa-nav-middle` 549/2936) | 1 (`fa-nav-middle` 627/2977) |
| scroll regions, every group open | **2** (`fa-nav-middle` 128/3682, `details.fa-nav-group` 328/1716) | **1** (`fa-nav-middle` 627/6747) |
| `.side-bar` clipping, every group open | **800/2108** | none |
| page links visible on arrival | 14 | 15 |
| page links visible, every group open, scrolled to top | **0** (on the guide 4 of 3228 px) | 0 on the landing (19 open index rows fill the first screen), 6 on the guide. Nothing is clipped, and one scroll reaches the list. |
| Graphs/FOLDERS on arrival | FOLDERS folded, above the page list | Graphs folded, heading in view at the scroller's bottom |
| ☰ / × controls, 1280 and 390 | 0 / 0 (markup gone in #1762, CSS left) | 0 / 0, and no rule names them |

At 390×844 there is no fixed scroller, so the phone menu is unchanged in kind. The order is now On this page, Pages, Graphs, and Graphs sits at the end of the menu (it is not sticky on a phone).

**Check:** `cat-harness/test/sidebar-rail.e2e.ts` uses the real generated footer include. It fails on:
- more than one scroll region, or any clipping inside the sidebar or its regions;
- Graphs open on arrival, or FOLDERS/harnesses outside it;
- zero visible page links;
- a ☰/× by class or by glyph at 1280 or 390.

**Falsified:** 4 of the 5 finding-7 tests fail on 644d04b9959's CSS/JS. The finding-8 tests fail when a ☰ label is injected into the include. `sidebar-strip.test.ts` fails on 644d04b9959's CSS.

## 2026-10-01 — finding 10: owner ruling implemented (option 1 of 4, "Pinned tiles first, plus +N more")

Branch `claude/quirky-hypatia-k3aoh4-strip-pinned`, which is stacked on #1762. Session https://claude.ai/code/session_01Cw8JgZEDT5VqQ5ergjdMjB.

- **Declared, not hard-coded.** The instance declaration gains `glassStrip` (`GlassStripSchema`: `{chrome}` or `{kind}` pins, inherited along `needs` like `navbarIcons`). `cat-harness.json` pins Todos, Settings, library, processes, tools and skills. `sync-docs-harness.ts` resolves each kind to one tile (`resolveGlassStrip`; one slot per kind, and the others stay in More). The page reads the pins from `<meta name="fa-glass-strip">`, or from `assets/harness/glass-strip.json` on replica pages.
- **Fit, not scroll.** The strip never scrolls. It shows as many pins as fit and refits on resize. Its last tile reads "+N more" (accessible name "N more tiles"), where N is exact. Pins that do not fit wait first in More.
- **Measured on a local build.** Before (#1762 head): the strip held Todos, Filter, Settings and More. 15 tiles sat behind More with no count, and none of library/processes/tools/skills was on the strip. After: at 1280×800, the 6 pins plus "+12 more", with scrollWidth equal to clientWidth (1280/1280). At 390×844, Todos, Folio settings, library and processes plus "+14 more" (390/390). Shown + N = 18 = total at both widths.
- **Test.** `glass-strip-fit.e2e.ts`: 10 specs pass. Against #1762 head 8 fail, for real reasons: shown+N was 3 against 25, scrollWidth was 408 against a 390 limit, the pin order did not match, and the strip used overflow-x auto. The 2 keyboard specs pass on both, because More was already a button.



- **Scope addition (owner, 2026-10-01): "have folio bottom strip tiles default to hidden away when folio first opened".** With no stored choice, the strip now starts slid away. Its tab reads "Show tiles (N)", carries `aria-expanded`, and toggles both ways (`l4zi`). The choice is remembered in this browser as `1`/`0`, and storage that cannot be read falls back to hidden. Test: `glass-strip-default-hidden.e2e.ts`, 7 specs at 1280×800 and 390×844. All 7 fail against #1762 head.

_2026-10-02_ — **Merge of main (#1810) into the strip branch.** The strip pins the chrome tile by id `glass-settings`, so it now shows #1810's caption **Glass settings**. "Folio settings" in the 390×844 measurement above is the caption at the time of that measurement.

## Summary of Changes — closed on evidence, 2026-10-06
All 12 findings have a ruling implemented on main (#1762, #1804, #1805, #1807, #1808, #1819; see the dated sections and notes). Re-measured on gh-pages sha f4f5910 rendered in Chromium at 1280x800 and 390x844, session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92:
- 1: the row at rest shows Todos 3, Beans 540, fsh-guts 82 with count badges, and ▦ Harnesses is a disclosure in the strip.
- 7: one scroll region in the theme sidebar (.fa-nav-middle is the only overflowing scroller).
- 9: the handle reads ▴ when the glass is up.
- 10: the strip is hidden until asked ('Show tiles (18)'), and at 390 shows Todos, Glass settings, Library 42, Processes and '+14 more'.
- 11: the strip tiles have distinct glyphs.
- 12: 'Page settings' and 'Glass settings — theme, avatars, opacity, blur' are now two distinct names.
- 3: the sticky half was left as authored on purpose (see the 4–5 note).
`check:wireframes`: 50/50. `wireframe:check` on navbar/as-is.html: all pass.
The one remaining step, re-drawing the wireframe (its intent.md still describes the pre-#1762 navbar), is split out as  rather than left as a reason to keep this bean open.
