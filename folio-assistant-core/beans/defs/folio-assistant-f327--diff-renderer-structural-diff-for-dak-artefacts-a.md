---
# folio-assistant-f327
$schema: bean/1.0.0
title: 'DIFF RENDERER: structural diff for DAK artefacts — a decision-table row, data element, indicator or FHIR profile element compared as fields, not text'
status: completed
type: task
priority: normal
created_at: 2026-09-23T10:00:13Z
updated_at: 2026-10-16T09:55:00Z
parent: folio-assistant-q4jm
---

Child of d903 (renderer 4 of the five it listed). A text diff of a decision table is unreadable, which is the case that proved a single 'the diff' wrong.

Needs, before it can be built:
- the structured shape of each DAK artefact on BOTH sides. The ChangeSet reads manifests as text and never executes them; a field diff needs the parsed artefact (FHIR JSON, a DMN table, a data dictionary row);
- a registry entry in cat-harness/schemas/diff-renderers.ts with a new `needs` input (say `structure`), and defaults for the DAK block kinds, once those kinds exist in BLOCK_KINDS (today there are none).

## Done when
- [x] the DAK artefact kinds it applies to are real block kinds
- [x] the structured sides are published beside changeset-text.json
- [x] a field-level renderer is registered and tested in the browser


2026-10-09: item 1 verified landed — litlfred/smart-base main carries 21 `folio-block-kind/v1` nodes under `smart-base/block-kinds/`, among them the four this bean names: `decision-table`, `data-element`, `indicator`, `profile` (plus business-process, persona, plan-definition, measure, …). Items 2–3 (structured sides beside changeset-text.json; a browser-tested field renderer in cat-harness's diff-renderers registry) remain. (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL)

_2026-10-16T09:55:00Z_ — Completed; owner 2026-10-16 09:46Z: "do so". Each box has evidence: persona and functional-requirement are contributed block kinds that `changeset.ts` reads as structured (`snapshot`, `fields`); `stage-local` publishes `changeset-structure.json` beside `changeset-text.json`; the `structure` renderer is in `cat-harness/schemas/diff-renderers.ts` (needs `structure`), and its "Fields, before and after" view was checked in Chromium on litlfred/dth-hrh#35 (persona `title`, requirement `meta.priority`). The orphaned-comment bug found there is fixed by litlfred/folio-assistant-core#132. Session https://claude.ai/code/session_013hWB2emNRv744CRMvP9Wud.

## Built 2026-10-15 (session_0147GQWs8akum21vSh5XYURR)

Worked from this pointer, on the owner's choice to build it now.

- **The DAK kinds were real, but the ChangeSet could not see them.** `snapshot` walked without the contributed builders, so a `persona({ … })` was not a block at all: dth-hrh's personas, scenarios and requirements were missing from every ChangeSet, and an edit to one read as nothing changed. `snapshot(root, builders)` and the CLI now load them as `gen-block-jsonld` does (dth-hrh: 270 → 321 blocks).
- **The structured sides are published** as `changeset-structure.json` (`--structure-out`): a contributed kind's manifest fields on each side, read from the TEXT of its builder literal (`manifest-fields.ts`; nothing executed; a value it cannot read is kept as source).
- **The renderer** `fields` (input `structure`, default `@structured`) is registered in cat-harness `diff-renderers.ts`; the review page draws it and stage-local publishes the file.
- **Checked in Chromium** on dth-hrh's review page with a persona edit (title and personaType): the block opens on "Fields, before and after", two rows named "changed", five unchanged folded.

All three Done-when boxes are met.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the DAK artefact kinds it applies to are real block kinds
- [x] the structured sides are published beside changeset-text.json
- [x] a field-level renderer is registered and tested in the browser


2026-10-09: item 1 verified landed — litlfred/smart-base main carries 21 `folio-block-kind/v1` nodes under `smart-base/block-kinds/`, among them the four this bean names: `decision-table`, `data-element`, `indicator`, `profile` (plus business-process, persona, plan-definition, measure, …). Items 2–3 (structured sides beside changeset-text.json; a browser-tested field renderer in cat-harness's diff-renderers registry) remain. (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL)

_2026-10-16T09:55:00Z_ — Completed; owner 2026-10-16 09:46Z: "do so". Each box has evidence: persona and functional-requirement are contributed block kinds that `changeset.ts` reads as structured (`snapshot`, `fields`); `stage-local` publishes `changeset-structure.json` beside `changeset-text.json`; the `structure` renderer is in `cat-harness/schemas/diff-renderers.ts` (needs `structure`), and its "Fields, before and after" view was checked in Chromium on litlfred/dth-hrh#35 (persona `title`, requirement `meta.priority`). The orphaned-comment bug found there is fixed by litlfred/folio-assistant-core#132. Session https://claude.ai/code/session_013hWB2emNRv744CRMvP9Wud.

## Built 2026-10-15 (session_0147GQWs8akum21vSh5XYURR, from `folio-assistant-core` store reconciliation)

Worked from this pointer, on the owner's choice to build it now.

- **The DAK kinds were real, but the ChangeSet could not see them.** `snapshot` walked without the contributed builders, so a `persona({ … })` was not a block at all: dth-hrh's personas, scenarios and requirements were missing from every ChangeSet, and an edit to one read as nothing changed. `snapshot(root, builders)` and the CLI now load them as `gen-block-jsonld` does (dth-hrh: 270 → 321 blocks).
- **The structured sides are published** as `changeset-structure.json` (`--structure-out`): a contributed kind's manifest fields on each side, read from the TEXT of its builder literal (`manifest-fields.ts`; nothing executed; a value it cannot read is kept as source).
- **The renderer** `fields` (input `structure`, default `@structured`) is registered in cat-harness `diff-renderers.ts`; the review page draws it and stage-local publishes the file.
- **Checked in Chromium** on dth-hrh's review page with a persona edit (title and personaType): the block opens on "Fields, before and after", two rows named "changed", five unchanged folded.

All three Done-when boxes are met.
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the DAK artefact kinds it applies to are real block kinds
- [x] the structured sides are published beside changeset-text.json
- [x] a field-level renderer is registered and tested in the browser

_2026-10-16T09:55:00Z_ — Completed; owner 2026-10-16 09:46Z: "do so". Each box has evidence: persona and functional-requirement are contributed block kinds that `changeset.ts` reads as structured (`snapshot`, `fields`); `stage-local` publishes `changeset-structure.json` beside `changeset-text.json`; the `structure` renderer is in `cat-harness/schemas/diff-renderers.ts` (needs `structure`), and its "Fields, before and after" view was checked in Chromium on litlfred/dth-hrh#35 (persona `title`, requirement `meta.priority`). The orphaned-comment bug found there is fixed by litlfred/folio-assistant-core#132. Session https://claude.ai/code/session_013hWB2emNRv744CRMvP9Wud.
```
