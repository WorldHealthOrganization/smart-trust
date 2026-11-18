---
# folio-assistant-turh
$schema: bean/1.0.0
title: 'Library asset viewer: TOC, pages with labels, figures/tables, section extracts — for any ingested library/ entry (#2302)'
status: completed
type: feature
created_at: 2026-10-06T20:27:04Z
updated_at: 2026-10-20T11:30:00Z
parent: folio-assistant-slw1
---

Owner, #2302 session 2026-10-06: re-ingest the who-iris library with the updated method, and give ingested documents a viewer — browse page by page (with printed labels), an overview of figures/tables, the TOC linking to sections, and extracted summaries of each section. Not who-iris-specific: the viewer belongs to the ingestion SCHEMA (pdf-structure/v1 structure.json + sections/), so every library/ asset of every instance gets it; who-iris is the first consumer.

- [x] extend the existing library viewer (cat-harness/scripts/gen-library-viz.ts) with a document view built from structure.json: TOC (with confidence), pages (label, sections, figures), figures/tables, sections (summary or extract), diagnostics (alignment, gaps, label conflicts)
- [x] re-ingest who-iris library entries with the updated pdf-structure (litlfred/who-iris#44)
- [x] check it rendered (screenshots)
- [x] tests / gates

_2026-10-12_ — **The two gaps the who-iris re-ingest (who-iris#44) exposed are closed at ingest, by reusing the existing "which software ran" record rather than adding one.** Owner steer: *"look for existing beans related to testing and which software ran. should be similar solution"*; then *"reuse schemas"* and *"…and processes"*.

- **Pattern reused: `folio-run-context/v1`** (cat-harness `schemas/run-context.ts`, bean `3sbm`, `docs/proposals/tool-releases-2026-10-07.md` §"Scope widened"). It is the owner's single answer to *"what version of the Tool was used for audit purpose"* for test runs and QA reports: `releases[]` as `name@version` + sha256 of the bytes, `invoker` with `script_hash`, `inputs[]` as `HashBasis`, `platform` + `mounts`. Records cite it by `runContext: { sha256 }` (owner ruling C1 = a). No new schema, no parallel field set.
- **OCR engine/version (gap 2).** `pdf-ocr.py` writes `<entry>/ocr/run-context.json` after every run that actually OCR'd: `tesseract@<v>`, `pdftoppm@<v>` and each `tessdata-<lang>@<pkg version>` used (incl. `osd` when the language was detected), each with the sha256 of the file that ran. A stale context is removed before a re-OCR. `pdf-pages.py --from-ocr` and `pdf-structure.py --ocr` copy its reference into `structure.json` `source.runContext`, so a `sections/` built from OCR names the OCR that made its text. Python writer `scripts/_run_context.py` (stdlib only), digest held equal to `runContextRef` by a test.
- **Title pass-through (gap 1).** `bun run cat ingest … --title "<t>"`, else the catalogue's `dc.title` (same `catalogueRecordFor` the manifest resolver reads), is handed to `pdf-structure.py` / `pdf-pages.py` as `--title`; `pdf-structure.py` gained `--title` with `pdf-pages.py`'s existing semantics (raw title in place of the page-1 parse; the resolver still records corroboration). No more hand rebuild for `who-pub-tps-931`.
- **Schema:** cat-harness `PdfSourceSchema` gains only `runContext: RunContextRefSchema.optional()` — the reference C1 already gives every run record.
- **Process:** no BPMN covered recording which software ran (run-context existed only as schema + proposal). Minimal edit to the existing ingest process, `processes/library/ingest-extract-structure.bpmn`: `Task_Ocr` and `Task_Structure` now say they record/cite the run context and pass a known title through. `.pot` templates for that diagram regenerated.
- **Not done, on purpose:** the who-iris library was NOT re-OCR'd or re-ingested — its committed OCR stays. Existing entries carry no `runContext` (absent = ingested before it existed).
- **Open:** OCR `--dpi` is not representable in a run context (no parameter slot); the structure rung records no run context of its own; a passed-through title lands as `title_source: "text"` (the enum has no "given"). Framed for the owner in the PR.

_2026-10-20T11:30:00Z_ — Completed (owner "1", 2026-10-20 09:36Z, https://claude.ai/code/session_01Ln5dzJ3LfmeMEC86FUNsg3). Re-ingest: wpr-rdo and the handbook already carried `pages[]`; the scanned `who-pub-tps-931` did not, because OCR text has no margins to read a folio from. cat-harness-tools#446 reads it from the page's first and last lines, and who-iris#68 re-ingested the entry with `pdf-structure.py --ocr` (physical 15–121 → printed 10–116). Tests: `scripts/tests/library-document.test.ts` (the document view) and `scripts/tests/pdf-ocr-page-labels.test.py`; gate `library:readmes:check` caught the stale README in #68.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] tests / gates

_2026-10-12 (from `folio-assistant-core` store reconciliation)_ — **The two gaps the who-iris re-ingest (who-iris#44) exposed are closed at ingest, by reusing the existing "which software ran" record rather than adding one.** Owner steer: *"look for existing beans related to testing and which software ran. should be similar solution"*; then *"reuse schemas"* and *"…and processes"*.

- **Pattern reused: `folio-run-context/v1`** (cat-harness `schemas/run-context.ts`, bean `3sbm`, `docs/proposals/tool-releases-2026-10-07.md` §"Scope widened"). It is the owner's single answer to *"what version of the Tool was used for audit purpose"* for test runs and QA reports: `releases[]` as `name@version` + sha256 of the bytes, `invoker` with `script_hash`, `inputs[]` as `HashBasis`, `platform` + `mounts`. Records cite it by `runContext: { sha256 }` (owner ruling C1 = a). No new schema, no parallel field set.
- **OCR engine/version (gap 2).** `pdf-ocr.py` writes `<entry>/ocr/run-context.json` after every run that actually OCR'd: `tesseract@<v>`, `pdftoppm@<v>` and each `tessdata-<lang>@<pkg version>` used (incl. `osd` when the language was detected), each with the sha256 of the file that ran. A stale context is removed before a re-OCR. `pdf-pages.py --from-ocr` and `pdf-structure.py --ocr` copy its reference into `structure.json` `source.runContext`, so a `sections/` built from OCR names the OCR that made its text. Python writer `scripts/_run_context.py` (stdlib only), digest held equal to `runContextRef` by a test.
- **Title pass-through (gap 1).** `bun run cat ingest … --title "<t>"`, else the catalogue's `dc.title` (same `catalogueRecordFor` the manifest resolver reads), is handed to `pdf-structure.py` / `pdf-pages.py` as `--title`; `pdf-structure.py` gained `--title` with `pdf-pages.py`'s existing semantics (raw title in place of the page-1 parse; the resolver still records corroboration). No more hand rebuild for `who-pub-tps-931`.
- **Schema:** cat-harness `PdfSourceSchema` gains only `runContext: RunContextRefSchema.optional()` — the reference C1 already gives every run record.
- **Process:** no BPMN covered recording which software ran (run-context existed only as schema + proposal). Minimal edit to the existing ingest process, `processes/library/ingest-extract-structure.bpmn`: `Task_Ocr` and `Task_Structure` now say they record/cite the run context and pass a known title through. `.pot` templates for that diagram regenerated.
- **Not done, on purpose:** the who-iris library was NOT re-OCR'd or re-ingested — its committed OCR stays. Existing entries carry no `runContext` (absent = ingested before it existed).
- **Open:** OCR `--dpi` is not representable in a run context (no parameter slot); the structure rung records no run context of its own; a passed-through title lands as `title_source: "text"` (the enum has no "given"). Framed for the owner in the PR.

_2026-10-20T11:30:00Z_ — Completed (owner "1", 2026-10-20 09:36Z, https://claude.ai/code/session_01Ln5dzJ3LfmeMEC86FUNsg3). Re-ingest: wpr-rdo and the handbook already carried `pages[]`; the scanned `who-pub-tps-931` did not, because OCR text has no margins to read a folio from. cat-harness-tools#446 reads it from the page's first and last lines, and who-iris#68 re-ingested the entry with `pdf-structure.py --ocr` (physical 15–121 → printed 10–116). Tests: `scripts/tests/library-document.test.ts` (the document view) and `scripts/tests/pdf-ocr-page-labels.test.py`; gate `library:readmes:check` caught the stale README in #68.
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] tests / gates

_2026-10-12 (from `folio-assistant-core` store reconciliation)_ — **The two gaps the who-iris re-ingest (who-iris#44) exposed are closed at ingest, by reusing the existing "which software ran" record rather than adding one.** Owner steer: *"look for existing beans related to testing and which software ran. should be similar solution"*; then *"reuse schemas"* and *"…and processes"*.

- **Pattern reused: `folio-run-context/v1`** (cat-harness `schemas/run-context.ts`, bean `3sbm`, `docs/proposals/tool-releases-2026-10-07.md` §"Scope widened"). It is the owner's single answer to *"what version of the Tool was used for audit purpose"* for test runs and QA reports: `releases[]` as `name@version` + sha256 of the bytes, `invoker` with `script_hash`, `inputs[]` as `HashBasis`, `platform` + `mounts`. Records cite it by `runContext: { sha256 }` (owner ruling C1 = a). No new schema, no parallel field set.
- **OCR engine/version (gap 2).** `pdf-ocr.py` writes `<entry>/ocr/run-context.json` after every run that actually OCR'd: `tesseract@<v>`, `pdftoppm@<v>` and each `tessdata-<lang>@<pkg version>` used (incl. `osd` when the language was detected), each with the sha256 of the file that ran. A stale context is removed before a re-OCR. `pdf-pages.py --from-ocr` and `pdf-structure.py --ocr` copy its reference into `structure.json` `source.runContext`, so a `sections/` built from OCR names the OCR that made its text. Python writer `scripts/_run_context.py` (stdlib only), digest held equal to `runContextRef` by a test.
- **Title pass-through (gap 1).** `bun run cat ingest … --title "<t>"`, else the catalogue's `dc.title` (same `catalogueRecordFor` the manifest resolver reads), is handed to `pdf-structure.py` / `pdf-pages.py` as `--title`; `pdf-structure.py` gained `--title` with `pdf-pages.py`'s existing semantics (raw title in place of the page-1 parse; the resolver still records corroboration). No more hand rebuild for `who-pub-tps-931`.
- **Schema:** cat-harness `PdfSourceSchema` gains only `runContext: RunContextRefSchema.optional()` — the reference C1 already gives every run record.
- **Process:** no BPMN covered recording which software ran (run-context existed only as schema + proposal). Minimal edit to the existing ingest process, `processes/library/ingest-extract-structure.bpmn`: `Task_Ocr` and `Task_Structure` now say they record/cite the run context and pass a known title through. `.pot` templates for that diagram regenerated.
- **Not done, on purpose:** the who-iris library was NOT re-OCR'd or re-ingested — its committed OCR stays. Existing entries carry no `runContext` (absent = ingested before it existed).
- **Open:** OCR `--dpi` is not representable in a run context (no parameter slot); the structure rung records no run context of its own; a passed-through title lands as `title_source: "text"` (the enum has no "given"). Framed for the owner in the PR.

_2026-10-20T11:30:00Z_ — Completed (owner "1", 2026-10-20 09:36Z, https://claude.ai/code/session_01Ln5dzJ3LfmeMEC86FUNsg3). Re-ingest: wpr-rdo and the handbook already carried `pages[]`; the scanned `who-pub-tps-931` did not, because OCR text has no margins to read a folio from. cat-harness-tools#446 reads it from the page's first and last lines, and who-iris#68 re-ingested the entry with `pdf-structure.py --ocr` (physical 15–121 → printed 10–116). Tests: `scripts/tests/library-document.test.ts` (the document view) and `scripts/tests/pdf-ocr-page-labels.test.py`; gate `library:readmes:check` caught the stale README in #68.
```
