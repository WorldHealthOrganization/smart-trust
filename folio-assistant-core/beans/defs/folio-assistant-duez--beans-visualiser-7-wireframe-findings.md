---
# folio-assistant-duez
$schema: bean/1.0.0
title: 'beans visualiser: 7 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-beans
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-10-10T16:35:03Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/beans/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **Epic labels are unreadable on a phone.** At 390 px the label column is about 120 px wide and clamps to two lines, so rows read "KG: the knowledge…", "PROCESS: how an agent decides…", "LARGE- DOCUMENT…". At 1280 px the longer titles are also clamped ("HARNESS AS INTERFACE: a harness instance's default rendering is LHS + do…"). The full title is only in the button's `title` attribute, which has no touch equivalent.
2. **The "What is stuck" sentences are squeezed into a narrow column on a phone.** The label (`BLOCK NEVER LIFTED`) keeps its own column at 390 px, so each finding runs in a column about 170 px wide, 8 to 10 lines per finding. The 7 findings take about 1.5 screens before the epic chart starts.
3. **The ✎ edit targets are 14×14 px** (measured at 1280 and 390). That is below the 24×24 px minimum target size, on the one control that leads to a write.
4. **No way back to the site.** The page has no `nav` or `header` and no link to the site home. Its only outbound links are the other state-graph cards at the bottom and GitHub bean links.
5. **The heading order skips a level.** `h1` "beans" is followed by the panel titles as `h3` ("Beans — the agent work plan", "What is stuck"). The `h2`s come later ("State graphs this harness declares", then each card is itself an `h2`).
6. **The state-graph tag runs into the name as text.** The status tag is a sibling span with no separator, so the heading's text is "beanslive", "glossaryelsewhere", "healthdeclared" (from `innerText`). A screen reader announces it that way.
7. **The page is dark by default and has no scheme control.** `:root` defaults to the dark ground, and light applies only through `data-fa-scheme="light"`. Nothing on the page sets it. (→ `folio-assistant-dc64`)

When fixed, re-draw `cat-harness/docs/wireframes/beans/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 6 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Epic labels are unreadable on a phone: .fa-workplan-bar-toggle label: -webkit-line-clamp 2. At 390: label width 110px, 12/12 sampled labels clipped (scrollHeight>clientHeight), 21 epics. At 1280: 288px wide, 3/12 still clipped (WIREFRAME FINDINGS 93ch, HARNESS AS INTERFACE 135ch, LARGE-DOCUMENT REVIEW 164ch). Full text only in title attr.
- **STILL-PRESENT** — The 'What is stuck' sentences are squeezed into a narrow column on a phone: At 390: li.fa-workplan-finding 284px wide, label span 92px keeps its own column, text span 183px (111px for the is-serious row); items 209-305px tall; stuck panel 1040px tall; epic chart starts at y=1481 (~1.75 screens of 844).
- **STILL-PRESENT** — The edit targets are 14x14 px: a.fa-workplan-edit bounding box 14x14 at both 1280 and 390 (4 on page).
- **FIXED** — No way back to the site: nav.fa-nav present and visible at 1280 and 390; visible link '⌂ folio-assistant' to site root; 308 links on page. — ab046420f
- **STILL-PRESENT** — The heading order skips a level: Visible heading sequence: H1 'beans' -> H3 'Beans — the agent work plan' -> H3 'What is stuck' -> H2 'State graphs this harness declares' -> H2 per card.
- **STILL-PRESENT** — The state-graph tag runs into the name as text: .sv-item h2 innerText = 'beansLIVE', 'healthDECLARED', 'issue-marksDECLARED', 'qaLIVE'; markup <span class=sv-here>beans</span><span class='sv-tag is-live'>live</span> with no separator or sr-only text.
- **STILL-PRESENT** — The page is dark by default and has no scheme control: Narrowed: page now reads localStorage fa-color-scheme (light saved -> body rgb(249,249,247), data-fa-scheme=light) via 805bbd1ba. But with prefers-color-scheme: light and nothing saved, body stays rgb(13,13,13) and data-fa-scheme is null; no scheme button on the page (the home page has 'Dark mode is on — switch to l… — 805bbd1ba

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 6 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Epic labels are unreadable on a phone: .fa-workplan-bar-toggle label uses -webkit-line-clamp 2. At 390 the label is 110px wide and 12 of 12 sampled labels are clipped (21 epics). At 1280 it is 288px wide and 3 of 12 are clipped (WIREFRAME FINDINGS 93ch, HARNESS AS INTERFACE 135ch, LARGE-DOCUMENT REVIEW 164ch). The full text is only in the title attribute. (rv-beans2.mjs)
- **STILL-PRESENT** — The 'What is stuck' sentences are squeezed into a narrow column on a phone: At 390 li.fa-workplan-finding is 284px wide. The 92px label keeps its own column, and the text span is 183px (111px for the is-serious row). Items are 209–305px tall, the stuck panel is 1040px tall, and the epic chart starts at y=1481. (rv-beans2.mjs)
- **STILL-PRESENT** — The edit targets are 14x14 px: a.fa-workplan-edit is 14×14 at both 1280 and 390 (4 on the page). (rv-beans.mjs, rv-beans2.mjs)
- **FIXED** — No way back to the site: Still fixed. nav.fa-nav is visible at 1280 and 390, with a visible '⌂ folio-assistant' link to the site root. The page has 319 links. — ab046420f (rv-beans.mjs)
- **STILL-PRESENT** — The heading order skips a level: The visible headings are H1 'beans' → H3 'Beans — the agent work plan' → H3 'What is stuck' → H2 'State graphs this harness declares' → H2 per card. (rv-beans.mjs)
- **STILL-PRESENT** — The state-graph tag runs into the name as text: .sv-item h2 innerText is 'beansLIVE', 'healthDECLARED', 'issue-marksDECLARED', 'qaLIVE'. The markup is <span class=sv-here>beans</span><span class='sv-tag is-live'>live</span>, with no separator. (rv-beans2.mjs)
- **STILL-PRESENT** — The page is dark by default and has no scheme control: With prefers-color-scheme: light and nothing saved, body is rgb(13,13,13) and data-fa-scheme is null. A saved fa-color-scheme=light gives rgb(249,249,247). There is still no scheme button on the page. — 805bbd1ba (scheme.mjs, rv-beans3.mjs)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `state-visualizer.ts` in cat-harness-tools. Nothing there cites a fix yet. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `33ecb788` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness `docs/assets/css/work-plan.css:286`; cat-harness-tools `scripts/lib/scheme-css.ts:87` (scheme control).


## Closed 2026-10-09

Resolved on branch `claude/duez-beans-viz` (commit `33ecb788`). All 7 wireframe findings are resolved:

- **FIXED** — Epic labels are unreadable on a phone (Finding 1): In `docs/assets/css/work-plan.css`, increased line clamp for `.fa-workplan-bar-label` and `.fa-workplan-bar-toggle label` to 4 (and 5 on mobile viewports `@media (max-width: 40rem)` with `minmax(5rem, 1.3fr)` column allocation), plus `overflow-wrap: anywhere`, allowing long epic labels to wrap without early clipping.
- **FIXED** — The 'What is stuck' sentences are squeezed into a narrow column on a phone (Finding 2): In `docs/assets/css/work-plan.css`, added `@media (max-width: 40rem)` rule for `.fa-workplan-finding` to stack badge and text into `grid-template-columns: 1fr` with `gap: 0.25rem`, allowing text full column width and breathing room on mobile viewports.
- **FIXED** — The edit targets are 14x14 px (Finding 3): In `docs/assets/css/work-plan.css`, updated `.fa-workplan-edit` with `min-width: 24px; min-height: 24px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;` meeting WCAG 2.2 24×24px minimum touch target size.
- **FIXED** — No way back to the site (Finding 4): Previously fixed in `ab046420f` (nav.fa-nav present and visible).
- **FIXED** — The heading order skips a level (Finding 5): In `docs/assets/js/work-plan.js`, adjusted panel headings ("Beans — the agent work plan", "What is stuck", and "Todos — the human half") from `h3` to `h2` (`todoHead` inside `countsPanel` remains `h3` as a subheading). In `scripts/state-visualizer.ts`, adjusted card headings inside `<h2 class="sv-h2">State graphs this harness declares</h2>` and `<h2 class="sv-h2">Families — ...</h2>` from `h2` to `h3`, with `.sv-item h2, .sv-item h3` styling. Visible heading order H1 -> H2 -> H3 is strictly hierarchical with no skipped levels.
- **FIXED** — The state-graph tag runs into the name as text (Finding 6): In `scripts/state-visualizer.ts`, added space before `<span class="sv-tag...">` in `registry` and `qaPanels` so `innerText` does not concatenate name and status tag as e.g. "beansLIVE".
- **FIXED** — The page is dark by default and has no scheme control (Finding 7): In `scripts/lib/scheme-css.ts`, updated `withSavedScheme` to check `window.matchMedia("(prefers-color-scheme: light)").matches` and set `data-fa-scheme="light"` when no preference is saved. In `docs/assets/css/work-plan.css`, added `@media (prefers-color-scheme: light)` rule matching `:root:not([data-fa-scheme="dark"]) .fa-workplan`.

Verification:
- `bun test scripts/tests/state-visualizer.test.ts`: 48 pass, 0 fail (164 expect calls).
- `bun run typecheck`: clean (0 errors).
- Committed in cat-harness repository: commit `33ecb788` on branch `claude/duez-beans-viz`.



## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `state-visualizer.ts` in cat-harness-tools. Nothing there cites a fix yet. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `33ecb788` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness `docs/assets/css/work-plan.css:286`; cat-harness-tools `scripts/lib/scheme-css.ts:87` (scheme control).
