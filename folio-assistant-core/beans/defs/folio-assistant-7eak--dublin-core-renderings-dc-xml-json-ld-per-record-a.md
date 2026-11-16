---
# folio-assistant-7eak
$schema: bean/1.0.0
title: 'Dublin Core renderings: DC XML + JSON(-LD) per record, as a skill and tool in the rendering pipeline, published to gh-pages; who-iris links to both'
status: completed
type: task
priority: normal
created_at: 2026-09-30T08:54:51Z
updated_at: 2026-10-09T19:30:00Z
parent: folio-assistant-7deg
---

## The ask, owner 2026-09-30 (verbatim)

> do we render the proper xml for dublin core?  it should be in rendering ppiple as skill and tool.   i tihnk.  and then pushed to gh-pages
> that is in cat-harness... bean up for now
> (and who-iris should link to json and xml renderings)

## What is true today (measured 2026-09-30, not yet investigated in depth)

- Dublin Core terms are used as JSON-LD predicates (`dcterms:*` — e.g. `dcterms:isReplacedBy`, `dcterms:requires`, `dcterms:source` in the glossary export). No step renders a record as **Dublin Core XML** (the `oai_dc` / `dc:` XML form a catalogue harvester reads), and nothing publishes one to gh-pages.
- Bean `7deg` (parent) introduces Dublin Core in folio-assistant-core; it does not cover rendering or publication.

## Done when

- [x] A skill in cat-harness says which records get a DC rendering, which DC XML form (oai_dc vs qualified DC), and how each field maps from the node's own data (never composed).
- [x] A Tool node + script renders DC XML and the JSON(-LD) form for each such record, deterministically, with a `--check`.
- [x] The docs-site pipeline publishes both beside the record's page on gh-pages.
- [x] who-iris's pages link each record to its JSON and XML renderings.
- [x] A gate fails when a record that should have a rendering lacks one, or a rendering is stale.

## Not now

Owner: keep the primary focus on the bootstrap / bootstrap-tools staging separation (bean `xsqm`). This is queued, not started.

## Claim

Claimed by claude/dublin-core-renderings (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH). Issue #1840.

## Closed 2026-10-09 — verified on evidence

Closed on **evidence, not authorship** (`bean-coordination` §"Closing a bean whose work has already landed"). Landed in PR #1840 (`b3da180e7161`, merged into `main` via `8213c3e7c3d5` and carried into `folio-assistant-core`).

### Verification Details

1. **Dublin Core rendering script and gate:**
   - Command: `bun run folio-assistant-core/scripts/dc-render.ts --check who-iris`
   - Exit code: 0
   - Output: `dc-render --check: 3 record(s), 6 rendering(s) current, no orphans.`
   - Code-quality gate `dc:render:check` in `.github/workflows/code-quality-gates.yml` enforces that all records have up-to-date renderings without orphans.

2. **Dublin Core unit and rendering test suites:**
   - Command: `bun test folio-assistant-core/schemas/dublin-core.test.ts folio-assistant-core/schemas/dublin-core-render.test.ts`
   - Exit code: 0 (48 pass, 0 fail, 370 expect() assertions across 2 test files)
   - Verifies JSON-LD context expansion with DCMI Terms, qualified DC XML serialization with xsi:type encoding schemes, deterministic generation, escaping, and round-tripping.

3. **Skills and Tools:**
   - Skills exist at `folio-assistant-core/skills/library/catalogue/dublin-core-renderings.md` and `folio-assistant-core/skills/library/cataloguing/filing-dublin-core.md`.
   - Tool `dublin-core-render` registered in `folio-assistant-core/tools/index.ts` with skill satisfaction `dublin-core-renderings`.

4. **Publication and Linking:**
   - Renderings generated in `who-iris/site/dublin-core/` (`*.dc.xml` and `*.dc.jsonld`).
   - `who-iris` item pages link to Dublin Core XML and JSON-LD across all 6 locales (en, ru, zh, ar, fr, es).



## Closed 2026-10-09 on landed evidence (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL; evidence, not authorship)
Every Done-when item is in the repositories today:
1. Skill: `folio-assistant-core/skills/library/catalogue/dublin-core-renderings.md` (folio-assistant-core after the split, not cat-harness).
2. Tool + script with `--check`: Tool node `dublin-core-render` in `folio-assistant-core/tools/index.ts`; `folio-assistant-core/scripts/dc-render.ts` (qualified DC XML + DCMI-Terms JSON-LD, deterministic).
3. Published: litlfred/who-iris `site/dublin-core/<stem>.dc.xml|.dc.jsonld`, beside the item pages, which the mount copies whole.
4. who-iris links both: item pages carry `href="dublin-core/<stem>.dc.xml"` and `.dc.jsonld` (e.g. item-item-63e14c27… → 9789241548960-eng).
5. Gate: `bun run cat dc:render:check` in folio-assistant's code-quality-gates.yml.
The 2026-09-30 claim (branch claude/dublin-core-renderings, still on the remote) was not released by its holder; the work it announced has landed, so the claim is moot.


## Completed 2026-10-09 — each done-when checked on evidence, not on a PR landing (session https://claude.ai/code/session_017fFnGmbJcfqqrHXz9oqxdG)

The claim above (`claude/dublin-core-renderings`) was last touched 2026-10-02 and the work it names is on main in both repositories; this closes it on what is true today, item by item:

- [x] **skill** — `folio-assistant-core/skills/.../dublin-core-renderings.md`: which records get a rendering (exactly those an item names through `metadataRef`), which XML form and why, the field mapping from the record's own data, and the gate.
- [x] **Tool node + script, deterministic, with `--check`** — `dublin-core-render` in `folio-assistant-core/tools/index.ts`; `scripts/dc-render.ts`.
- [x] **published beside the record's page** — measured on a local build of who-iris's own site (the publish Routine's steps 3–7): `/who-iris/dublin-core/<stem>.dc.xml` and `.dc.jsonld` for all 3 records.
- [x] **who-iris links each record to both** — every item page carries `href="dublin-core/<stem>.dc.xml"` and `.dc.jsonld` (6 links over 3 pages); a whole-site link check finds 0 unresolved hrefs.
- [x] **a gate fails on a missing or stale rendering** — watched: with `who-pub-tps-931.dc.xml` removed, `bun run dc:render:check` in who-iris exits 1 ("1 problem(s)"); restored, it reports "3 record(s), 6 rendering(s) current, no orphans". In the separated who-iris the gate runs as step 3 of the publish Routine (no GitHub Actions, owner's rule), not in `code-quality-gates.yml` as the skill's table still says — that row is monorepo-era.
