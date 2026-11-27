---
# folio-assistant-db80
$schema: bean/1.0.0
title: 'methodologies visualiser: 8 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-methodologies
created_at: 2026-09-23T10:36:15Z
updated_at: 2026-10-10T16:35:03Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/methodologies/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **DIIG contradicts itself.** Its **Origin** says "Ingested at `smart-base/library/9789240010567-eng/`; every citation below resolves to a section there" (that directory exists), but its badge is "cited, not ingested" and its section ends "No ingested source … nothing in this checkout holds it". `smart-base/methodologies/diig.md` has no `evidence:` front-matter field, so the page's three-state rule reports the source as absent while the prose beside it says it is held.
2. **The column the page says to read first is cut on every row.** All ten `applies when` cells are truncated at 150 characters, often mid-word ("…the budget and the moni…", "…Contextu…", "…who answers for this, wh…"). The full text is several screens down in "Where each one came from".
3. **The MADR cell renders a stray backtick.** The cut falls inside inline code — "Not for the decision METHOD (see \`kepner-tregoe…" — leaving an unclosed backtick, which kramdown prints literally. (→ `folio-assistant-mylx`)
4. **Ingested sources are code text, not links.** `library/arxiv-2508.05192v2`, `library/dusengumuremyi-2026-ai-mediated-raci`, the two SWOT slugs and `library/arxiv-2312.07755v1` name library entries, but the reader cannot open them from here. "Source held" means "you can open it from this checkout", yet not from this page. (→ `folio-assistant-qgjh`)
5. **Section anchors sit below their headings.** The table's links go to `<a id>` elements placed after each `### title`, so a jump lands with the heading just above the viewport.
6. **Badges fail contrast on the default dark scheme.** The inline `<style>` fixes `.mv-ingested #0d6e5e`, `.mv-cited #8a6100`, `.mv-dangling #a8200f` on `#27262b`: 2.44, 2.71 and 2.06 to 1 at .72 rem. The words carry the state, but are hard to read. (→ `folio-assistant-rtuo`)
7. **Mobile: the "Choosing one" table is four columns in a 358 px column.** "origin held?" and "declared by", the evidence state the page is about, start off-screen, and nothing says the table scrolls.
8. **WireGen's origin points at nothing on this page.** It ends "Section numbers below are the paper's", written for the methodology file's own body; on this page nothing follows it but the sources list.

When fixed, re-draw `cat-harness/docs/wireframes/methodologies/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 7 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — DIIG contradicts itself (Origin says ingested; badge cited, not ingested): The DIIG section reads 'diig — declared by smart-base — cited, not ingested' / Origin '... Ingested at smart-base/library/9789240010567-eng/; every citation below resolves to a section there.' / 'No ingested source. The origin above names one; nothing in this checkout holds it.' The table badge is .mv-cited.
- **STILL-PRESENT** — 'applies when' column cut at 150 characters on every row: table:first td[applies when] lengths 146,150,149,146,145,150,131,146,144,1,146,146,150; each ends in '…' (e.g. '...the budget and the moni…', '...Contextu…', '...who answers for this, wh…'). Now 13 rows, and one row is just '…'.
- **FIXED** — MADR cell renders a stray backtick: The MADR applies-when cell now reads '... Not for the decision METHOD (see…'. Backticks in the applies-when cells: 0 of 13. — c50675273
- **STILL-PRESENT** — Ingested sources are code text, not links: There are 14 <code>library/...</code> mentions (incl. library/arxiv-2508.05192v2, dusengumuremyi-2026-ai-mediated-raci, both SWOT slugs, arxiv-2312.07755v1). All 14 have inLink false, and no <a> href contains 'library'.
- **STILL-PRESENT** — Section anchors sit below their headings; jump hides heading: <p><a id='diig'></a></p> comes after h3#diig--digital-implementation-investment-guide. After clicking the table link on a fresh page, the h3 rect is top -27/bottom -5 at 1280 (diig, madr, raci) and -21/-3 at 390 (diig, madr, wiregen). The heading is just above the viewport. Only wiregen at 1280 is visible, because i…
- **STILL-PRESENT** — Badges fail contrast on the default dark scheme: Dark (default): .mv-ingested rgb(13,110,94) is 2.44:1 on #27262b and 2.19:1 on row bg rgb(48,45,54); .mv-cited rgb(138,97,0) is 2.71:1 and 2.44:1; font 11.52 px (10.08 px at 390). Light: 6.16 and 5.54 (pass). .mv-dangling does not occur on the page now.
- **STILL-PRESENT** — Mobile: 'Choosing one' table four columns in 358 px; later columns off-screen, no scroll cue: 390x844: .table-wrapper 362 px (14..376), overflow-x auto, mask none; table scrollWidth 499. 'origin held?' at 261-404 is cut; 'declared by' at 406-511 is fully off-screen. There is no scroll hint element.
- **STILL-PRESENT** — WireGen origin ('Section numbers below are the paper's') points at nothing: The text '... Section numbers below are the paper’s.' is followed directly by 'Ingested sources: library/arxiv-2312.07755v1' and the next section.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 5 still present, 3 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — DIIG contradicts itself (Origin says ingested; badge cited, not ingested): The DIIG section still reads 'diig — declared by smart-base — cited, not ingested', then 'Origin. … Ingested at smart-base/library/9789240010567-eng/; every citation below resolves to a section there.', then 'No ingested source. The origin above names one; nothing in this checkout holds it.' (C_meth2.mjs)
- **STILL-PRESENT** — 'applies when' column cut at 150 characters on every row: The table now has 16 rows. The applies-when lengths are 146,146,146,150,149,146,145,150,131,117,146,144,1,146,146,150, and all 16 end in '…'. One row is still just '…'. (C_meth.mjs)
- **FIXED** — MADR cell renders a stray backtick: Still fixed: 0 of 16 applies-when cells contain a backtick. — c50675273 (C_meth.mjs)
- **FIXED** — Ingested sources are code text, not links: Changed since 2026-09-29. 15 of the 17 <code>library/…</code> mentions are now inside an <a>: the viewer deep link (e.g. ../cat-harness/library/folio-assistant-sci/#folio-assistant-sci%2Farxiv-2602.16554v1), plus 'item page' and 'source' links (30 library links in main). All local targets return 200. The 2 unlinked mentions are inside Origin prose (Doc-Researcher, RASCI), not the 'Ingested sources' lists. — #1592 (C_meth.mjs, m6.mjs, linkcheck.mjs)
- **STILL-PRESENT** — Section anchors sit below their headings; jump hides heading: <p><a id='diig'></a></p> still follows h3#diig--…. After clicking the table link on a fresh page, the heading rect is top −27/bottom −5 at 1280 for diig, madr and raci (wiregen visible at 130), and −21/−3 at 390 for diig, madr, wiregen and raci. (C_meth4.mjs)
- **FIXED** — Badges fail contrast on the default dark scheme: Changed since 2026-09-29. Dark: .mv-ingested rgb(92,211,189) is 7.40:1 on the row bg rgb(48,45,54) and 8.23:1 on the page bg. .mv-cited rgb(230,189,82) is 7.57:1 and 8.41:1. That is at 11.52px (10.08px at 390). Light is unchanged and passes: 6.16 and 5.54. — #1592 / rtuo (C_meth.mjs, contrast.mjs)
- **STILL-PRESENT** — Mobile: 'Choosing one' table four columns in 358 px; later columns off-screen, no scroll cue: 390×844: .table-wrapper is 362px (14–376), overflow-x auto, mask none, with only a box-shadow. Table scrollWidth is 499. 'origin held?' at 261–404 is cut, and 'declared by' at 406–511 is off-screen. There is no scroll hint element. (C_meth5.mjs)
- **STILL-PRESENT** — WireGen origin ('Section numbers below are the paper's') points at nothing: '… Section numbers below are the paper’s.' is followed directly by 'Ingested sources: library/arxiv-2312.07755v1 · item page · source' and the next section. No section numbers follow. (C_meth.mjs)


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-methodologies-viz.ts` in cat-harness-tools. Nothing there cites a fix yet. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `815d55ee` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-methodologies-viz.ts:205` (scroll hint).


## Closed 2026-10-09

Fixed in `cat-harness` commit `815d55ee24b4d120436a921d05c8a40a20c2db1a` on branch `claude/db80-methodologies-viz`:
- **Finding 1 (DIIG)**: Upstream `main` resolved the contradiction (`smart-base/methodologies/diig.md` has `evidence: [library/9789240010567-eng]`, renders as `.mv-ingested` "source held", links to viewer, and contains no "No ingested source" text).
- **Finding 2 ('applies when' truncated)**: Render full `cell(r.appliesWhen)` in the "Choosing one" table; improve `short()` with word-boundary truncation and balanced formatting delimiters.
- **Finding 5 (Section anchors below headings)**: Render heading with inline anchor attribute `### ${cell(r.title)} {#${r.name}}` instead of detached `<p><a id="..."></a></p>` anchor, ensuring section navigation does not place the heading above the viewport.
- **Finding 7 (Mobile scroll cue)**: Added `.mv-scroll-hint` indicator for mobile viewports and `.table-wrapper` horizontal scroll fade mask with CSS animation driven by inline scroll offset.
- **Finding 8 (WireGen origin)**: Moved "Section numbers below are the paper's." from front-matter `origin:` to body under `## What the method says (rendered faithfully)` in `methodologies/wiregen.md`; generator also defensively strips this note from Origin text.
- Also fixed worktree path resolution in `scripts/gen-methodologies-viz.ts` using `readDeclaration(instanceRoot)?.name` so worktree names do not leak into `renders:` front-matter or `instanceOf()` output.

Verification evidence:
- `bun test scripts/tests/methodologies-viz.test.ts`: 11 pass, 0 fail (16 expect calls)
- `bun run scripts/gen-methodologies-viz.ts --check`: `✓ methodologies viewer is current — 22 methodolog(ies)`
- `bun run typecheck`: clean exit 0 (`tsc --noEmit -p tsconfig.json`)



## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The page generator is `scripts/gen-methodologies-viz.ts` in cat-harness-tools. Nothing there cites a fix yet. Re-verifying a visualiser means rebuilding and re-measuring the page, and that happens where the generator is. None of it lives in
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
- fix commit `815d55ee` is an ancestor of cat-harness `main` (`b675555e`);
- the change is present on current `main`, where the generator now lives:
  cat-harness-tools `scripts/gen-methodologies-viz.ts:205` (scroll hint).
