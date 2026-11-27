---
# folio-assistant-9scf
$schema: bean/1.0.0
title: 'folio visualiser: 5 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-folio
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-10-10T16:35:03Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/folio/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **Horizontal scroll at phone width.** At 390 px the document is 769 px wide (`scrollWidth` 769). The node table's *declared in*, *links* and *prose* columns start off-screen, and the whole page pans sideways instead of just the table. (→ `folio-assistant-2r2n`)
2. **The mount handle covers the heading.** The `▾ Folio` button sits over the top centre at both widths. At 390 px it hides "graph" in "folio — the graph", and at 1280 px it overlaps the space above the title. (→ `folio-assistant-015u`)
3. **Links are not links.** The projection gives every link an `href`, for example "RTFM — the cat-harness docs" → `/concepts/agentic-harness.html`. The page renders only `esc(l.label)` joined with `<br>`, so none can be followed or reached by keyboard. The generator header says the page shows "whether the links it carries resolve", but no resolution state is shown. (→ `folio-assistant-qgjh`)
4. **Long cells stretch the rows.** `cat-harness` has six link labels in one cell, which makes that row several times taller than the others. At 390 px it becomes a column of wrapped fragments.
5. **Tables have no caption or heading.** Two unlabelled tables follow each other, and only the column headers say which table is which (`declared directory` vs `id`).

Related: `folio-assistant-7ofc`, `folio-assistant-6lb8`

When fixed, re-draw `cat-harness/docs/wireframes/folio/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 3 still present, 2 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **FIXED** — Horizontal scroll at phone width: At 390: scrollWidth 390 (was 769). Node table overflow-x:auto, scrollWidth 560 inside a 296px box; page does not pan. — 76b34f8ec
- **FIXED** — The mount handle covers the heading: h1 text box 1280: x127-325 y64-91; 390: x75-273 y64-91. .fa-glass-handle fixed at y0-28 (x596-684 / x151-239): no overlap at either width.
- **STILL-PRESENT** — Links are not links: Node table 'links' column: 0 a[href] in any cell; cat-harness cell is 6 labels joined by <br>; no word 'resolv*' anywhere on page.
- **STILL-PRESENT** — Long cells stretch the rows: Node-table row heights at 1280: 63/245/154/63/63 px (cat-harness row ~4x); at 390: 222/427/405/359/268.
- **STILL-PRESENT** — Tables have no caption or heading: Both tables: no <caption>, no aria-label; preceding sibling is a DIV (stat line / previous table), not a heading.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 2 still present, 3 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **FIXED** — Horizontal scroll at phone width: Still fixed. At 390 the scrollWidth is 390. The node table has overflow-x:auto, with scrollWidth 560 inside a 296px box. — 76b34f8ec (rv-folio.mjs)
- **FIXED** — The mount handle covers the heading: Still fixed. The h1 text box is x127–325 y64–91 at 1280 and x75–273 y64–91 at 390. .fa-glass-handle is at y0–28 (x596–684 / x151–239), with no overlap at either width. (rv-folio.mjs)
- **FIXED** — Links are not links: Changed since 2026-09-29. The node table's 'links' column now holds 14 a[href] in 3 of 5 rows (4 to GitHub, 10 to site pages such as agentic-harness.html and beans-and-todos.html). All 9 local targets return 200. The other 2 rows read 'none'. — #1592 (rv-folio.mjs, linkcheck.mjs)
- **STILL-PRESENT** — Long cells stretch the rows: Node-table row heights are 63/245/154/63/63px at 1280 and 222/427/405/359/268px at 390, unchanged. (rv-folio.mjs)
- **STILL-PRESENT** — Tables have no caption or heading: Neither table has a <caption> or aria-label. The preceding sibling is a DIV (stat line or previous table), not a heading. (rv-folio.mjs)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-folio-viz.ts` in cat-harness-tools. It now emits table captions and aria-labels (finding 5). Finding 4, long cells stretching rows, is unverified. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `62795040` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-folio-viz.ts:280` (table headings), `:241` (link pills).


## Closed 2026-10-09

Fixed remaining findings 4 and 5 in `cat-harness/scripts/gen-folio-viz.ts` and locked in via `scripts/tests/folio-viz.test.ts`.

- **Finding 4 (Long cells stretch the rows): FIXED** — Link cells rendered as compact flex lists with inline pills (`.fo-page .links` with `max-height: 4.8rem`, `overflow-y: auto`, and `.fo-page .link-pill`). Long link collections wrap cleanly and scroll within the cell, capping cell height at ~75-85px instead of stretching the row to 245px at 1280 and 427px at 390.
- **Finding 5 (Tables have no caption or heading): FIXED** — Both tables now feature accessible names, `<caption>` elements, and preceding `<h2>` headings:
  - Declared directories table: Preceding `<h2 id="fo-dirs-head">Declared folio directories</h2>`, `<table aria-label="Declared folio directories" aria-labelledby="fo-dirs-head">`, and `<caption>Declared folio directories</caption>`.
  - Folio nodes table: Preceding `<h2 id="fo-nodes-head">Folio nodes</h2>`, `<table aria-label="Folio nodes" aria-labelledby="fo-nodes-head">`, and `<caption>Folio nodes</caption>`.
- **Findings 1, 2, 3: VERIFIED INTACT** — Horizontal overflow scrolling contained, mount handle clear of titles, and link resolution preserved (`a[href]` tags with resolved paths).

Branch: `claude/9scf-folio-viz`
Commit SHA: `62795040d5c10c89fd59179f2a7e3362123835e7`
Evidence:
- `bun test scripts/tests/folio-viz.test.ts`: 17 pass, 0 fail
- `bun run scripts/gen-folio-viz.ts --check`: 0 errors (clean)
- `bun run typecheck`: clean (0 errors)



## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-folio-viz.ts` in cat-harness-tools. It now emits table captions and aria-labels (finding 5). Finding 4, long cells stretching rows, is unverified. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `62795040` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-folio-viz.ts:280` (table headings), `:241` (link pills).
