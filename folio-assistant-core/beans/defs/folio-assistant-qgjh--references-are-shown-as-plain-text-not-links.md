---
# folio-assistant-qgjh
$schema: bean/1.0.0
title: References are shown as plain text, not links
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
    - cross-cutting
created_at: 2026-09-23T10:36:13Z
updated_at: 2026-09-30T17:43:41Z
parent: folio-assistant-4ccr
---

Slugs, file names, skills and related nodes are printed as code or plain text although the target exists, so the relationship a page exists to show cannot be followed. Emit links wherever the target resolves.

Observed on: `catalogue`, `external-schemas`, `folio`, `glossary`, `library`, `methodologies`, `processes`, `tools`, `voices` (see each `cat-harness/docs/wireframes/<kind>/intent.md`). Per-page detail is in each visualiser's task under the epic.

_2026-09-30T00:40:20Z_ — Claimed by claude/charming-curie-n04agq — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 9 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — References shown as plain text, not links — catalogue: 3 tables (state 3 rows, gate 5, every-node 13 rows) contain 0 <a>. Node titles, catalogue paths and 'held as' library ids are plain text or <code> (34 unlinked codes). (links.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — external-schemas: The dependents are now 'user|declared by' tables with 0 links. Paths such as folio-assistant-core/schemas/dublin-core.ts are <code> and not links. The 22-row term tables have 0 links. Only the spec table has links (34, to in-page anchors). (links.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — folio: The node table (id|summary|anchor|theme|declared in|links|prose, 5 rows) and the directory table contain 0 <a>. 'links' and 'declared in' are text or code (16 unlinked codes). (links.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — glossary: Each term name links to GitHub (48/48). The description cells contain 0 links, and 9 descriptions name other roles or permissions in literal backticks, e.g. 'Inherits `reviewer`… the `adjudication` permission'. (links.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — library: The listing table (3 rows) and the uploads table contain 0 <a>, and so does /cat-harness/library/cat-harness/ (11 rows). Slug, title and cover are not links. (links.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — methodologies: 14 'library/…' ingested-source references are <code> (e.g. library/arxiv-2508.05192v2, library/dusengumuremyi-2026-ai-mediated-raci). None is inside <a>, and every library href on the page belongs to nav chrome. (links.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — processes: The 'skill|run by' table has 99 rows and 0 links, with .bpmn names as <code>. The 'lane|in' table (105 rows) also has 0 links. Only the process table links (74/74). (links.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — tools: The main table 'tool|what it does|invoked|satisfies|i/o' has 104 rows and 0 <a>. satisfies/skill ids are <code> (296 unlinked codes on the page). (links.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — voices: 0 content links on /cat-harness/voices/ (102 span.cite) and on /cat-harness/voices/who-style-guide/ (25 span.cite, e.g. 'who-pub-tps-931#page-014, p14'). (links.mjs)
## Slice 1 — processes and tools (2026-09-30)

One shared answer for "does this skill have a page": `cat-harness/scripts/lib/skill-pages.ts` (`skillPagesOf`, `skillPageHref`). It reads the directory `gen-skill-docs.ts` writes and never composes a page from an id, so a skill without a page stays code instead of becoming a 404.

| page | before | after | unresolved |
|---|---|---|---|
| processes: skill → run by | 0 links in 99 rows | **322** links (94 of 99 skills plus every diagram) | 0 |
| tools: satisfies | 0 links in 105 rows | **131** of 135 skill references | 0 |

The skills left as code are bootstrap's own (`bootstrap-kg-navigation`, `confirm-harness`, `discussion`, `log-message`, `root-readme`, `bootstrap-graph-emission`, `bootstrap-graph-publication`), which publish no instruction page. Remaining pages: catalogue, external-schemas, folio, glossary, library, methodologies, voices.

## Owner ruling on library references — 2026-09-30

Library items have no pages of their own: the library viewer renders entries in JavaScript and opens one from `#<key>`. For the 102 voice citations, the 14 methodology `library/…` references and the library listing, the owner chose ALL THREE targets ("1 2 3 (2 should be like bootstrap readmes...)"):

1. the viewer deep link, `library/<instance>/#<slug>`, with each key checked against the library index at generation time;
2. a static page per library item, written the way bootstrap's generated READMEs are;
3. a link to the item's source (upstream URL, or its file on GitHub).

## Progress — 2026-09-30 (slices 1–7, on the branch after #1512)

| page | before | after |
|---|---|---|
| processes: skill → run by | 0 links | 322 (94 of 99 skills; every diagram) |
| tools: satisfies | 0 | 131 of 135 skill references |
| voices: citations | 0 of 102 | **102 of 102**: 63 library (viewer, item page, 12 with a source), 39 KG-node (the file, 3 with a skill page) |
| methodologies: ingested sources | 0 of 15 | **15 of 15** (viewer, item page, source) |
| folio: node links | 0 | 14 (checked in a browser) |
| external-schemas: dependents | 0 | 32 |
| catalogue: every-node table | 0 | 5 replica pages (all collections and items) + 3 held-as |
| library listing | entries could not be opened | title → item page (37 of 37), source where recorded; viewer deep links select the item |
| library items | no page | 37 generated READMEs, like bootstrap's |

Shared answers: `scripts/lib/skill-pages.ts`, `scripts/lib/library-links.ts`, and the item READMEs from `scripts/library-readmes.ts`.

**Left, each for a stated reason:**
- processes' lane → in table: a lane has no page to link to (no role pages, and the swimlane glossary carries no term anchors).
- glossary: 9 descriptions name roles or permissions in backticks. The terms carry anchors, so these can link within the page. Not done yet.
- Skills that publish no instruction page (bootstrap's own) stay code on purpose.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 2 still present, 7 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **FIXED** — References shown as plain text, not links — catalogue: Changed since 2026-09-29. The every-node table has 11 links. 5 of 13 node titles (both collections and all 3 items) link to replica pages under /library/who-iris/, and the 3 'held as' ids link to the library viewer and the item page. All 6 local targets return 200. What is left: the 8 community rows are text, and the state and gate tables (states and verdicts, not references) have 0 links. — #1592 (qgjh.mjs, cat3.mjs, linkcheck.mjs)
- **FIXED** — References shown as plain text, not links — external-schemas: Changed since 2026-09-29. The 17 dependents tables ('user | declared by', 41 rows) link 29 of 41 user cells to the file on GitHub (46 links in tables). The 12 unlinked cells are globs or node sets with no single target, e.g. 'cat-harness/processes/*.bpmn (70)'. The term tables (112 rows) still have 0 links. — #1592 (qgjh.mjs, xs5.mjs)
- **FIXED** — References shown as plain text, not links — folio: Changed since 2026-09-29. The node table's 'links' column has 14 <a> in 3 of 5 rows (the other two read 'none'), and all 9 local targets return 200. The 'declared in' values and the directory table are still code. — #1592 (qgjh.mjs, rv-folio.mjs, linkcheck.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — glossary: Narrowed since 2026-09-29. The literal backticks are gone. The 9 affected descriptions render 30 <code>, and 11 of those link to in-page term anchors across 6 rows, all resolving. 19 code references are still plain: permissions (adjudication, claim, note, resolve), skills (todo-manager, content-change-review, doc-researcher) and paths (role-model.md, folio-assistant-core/processes/deep-document-research.bpmn). The term names still link to GitHub (48/48). — #1594 (gl2.mjs, qgjh.mjs)
- **FIXED** — References shown as plain text, not links — library: Changed since 2026-09-29. /cat-harness/library/who-iris/: 3 of 3 titles link to the item README on GitHub. /cat-harness/library/cat-harness/: 11 of 11 titles, plus 7 'source' links (arxiv.org). The slug and cover cells and the uploads table still have 0 links. — #1592 (qgjh.mjs, C_lib.mjs)
- **FIXED** — References shown as plain text, not links — methodologies: Changed since 2026-09-29. 15 of 17 <code>library/…</code> references are inside an <a> (library-viewer deep link, plus 'item page' and 'source'). All 31 local hrefs resolve. The 2 unlinked ones are inside Origin prose. — #1592 (qgjh.mjs, m6.mjs, linkcheck.mjs)
- **STILL-PRESENT** — References shown as plain text, not links — processes: Narrowed since 2026-09-29. 'skill | run by' (103 rows) now has 335 links: 98 of 103 skill cells and 103 of 103 run-by cells, and all 173 local targets return 200. The 'lane | in' table (106 rows) still has 0 links. The bean records that as deliberate (a lane has no page). — #1592 (qgjh.mjs, D/p_idx.js, linkcheck.mjs)
- **FIXED** — References shown as plain text, not links — tools: Changed since 2026-09-29. In the main table (107 rows), 'satisfies' links in 105 of 107 rows (136 links, all 61 targets return 200). The 2 unlinked are bootstrap skills with no page. The tool-id column is still code (0 of 107); that part is tracked under qbfm. — #1592 (qgjh.mjs, D/p_tools.js, linkcheck.mjs)
- **FIXED** — References shown as plain text, not links — voices: Changed since 2026-09-29. /cat-harness/voices/: 102 of 102 span.cite contain an <a> (library viewer / item page / source, or the KG node's file). /cat-harness/voices/who-style-guide/: 25 of 25. The local targets resolve. — #1592 (qgjh.mjs, D/p_vo3.js, linkcheck.mjs)

## Landed
- #1592: catalogue, external-schemas, folio, library, methodologies, processes (run by), tools, voices link their references.
- #1594: glossary role names link to their rows.
- #1651 (merged bbba1ea6): glossary skills link to instruction pages and repository paths to their source.
Left as code on purpose: permissions with no page (claim, note, resolve), and the processes 'lane | in' table (a lane has no page), both recorded above.
