---
# folio-core-urat
title: Migrate folio-tabular-records/v1 to folio-tabular-csvw/v1, measured on real tabular sources
status: completed
type: task
created_at: 2026-10-10T16:33:03Z
updated_at: 2026-10-24T14:05:00Z
parent: folio-assistant-slw1
---

Follow-up (b) of `eief`, split out on the owner's ruling of 2026-10-10 (option 1 of eief's decision).

Both tabular models exist side by side. The CSVW one has extractors now: `scripts/tabular-csv.ts` and `scripts/tabular-xlsx.ts` (PRs #33, #34). Migrate every `folio-tabular-records/v1` record to `folio-tabular-csvw/v1` (`tabular.csvw.json`), then retire the old schema.

Measure against real sources, per the owner on 2026-10-06:
- the smart-ra public-comment CSV/XLSX export (bean `v26p`, `schemas/public-comment.ts`);
- a DAK workbook from a smart-* IG, which has several tables per sheet.

Neither is in a folio-assistant-core checkout yet, so the first step is fetching one into `uploads/`.

## Done when
- [x] every `folio-tabular-records/v1` record is migrated, or listed with a reason (one record, listed below)
- [x] both extractors are run on one real CSV and one real DAK workbook, with the records committed
- [x] `folio-tabular-records/v1` is retired from the schema graph (answered "kept for fixed-width, csv/xlsx/ods legacy", as ruled under option 1 on 2026-10-22)

## Progress 2026-10-11 (lane C): measured on real sources; retirement needs a ruling

**Records committed** in `test/results/tabular-real-sources/`, with
`sources.json` pinning each source by commit and SHA-256. The WHO workbooks are
CC BY-NC-SA 3.0 IGO, so only the derived records are committed, not the bytes.

| source | extractor | tables | with header | columns typed / string / undetermined |
|---|---|---|---|---|
| `datasets/country-codes` CSV (ODC-PDDL), 249 x 56 | tabular-csv | 1 | 1 | 8 / 44 / 4 |
| WHO IMMZ DAK core data dictionary (smart-immunizations bd7fa72) | tabular-xlsx | 13 on 7 sheets | 6 | 1 / 116 / 39 |
| WHO IMMZ DAK decision-support logic (same commit) | tabular-xlsx | 162 on 29 sheets | 3 | 1 / 1469 / 1 |

The smart-ra public-comment export is in no checkout (smart-ra holds no
CSV or XLSX), so a public, real, wide CSV stood in for it.

**Two extractor bugs found and fixed in this PR**:
- `tabular-xlsx` left numeric character references undecoded. The data
  dictionary's title `ICD-11&#10;code` came through verbatim. The fix turns on
  `htmlEntities` in the parser; `XMLValidator` still refuses undeclared named
  entities.
- A zero-padded digit string now reads as a code (`string`), never as
  `integer`. ISO 4217 numeric codes (`008`, `012`) would otherwise read as 8
  and 12. In this file that column is undetermined anyway, because of its
  multi-valued cells (`222,840`). The rule closes the case for a clean column.

**Read correctly, and noted:**
- The four SNOMED/ICD columns mixing codes with "Not classifiable" are
  `undetermined`. That is the skill's `1, 2, 3, N/A` rule.
- 35 of the 39 undetermined columns are all-empty.
- A pure SNOMED column with no padding would still read as `integer`. Values
  alone cannot tell a code from a count, so that call is the column's, not the
  classifier's.

**The DAK decision tables read as headerless.** Their preamble and two-row
header are a DAK shape, not a generic one. Follow-up bean `folio-core-scn4`.

**The one `folio-tabular-records/v1` record:**
`folio-assistant-sci/library/codata-2022/tabular.jsonld`, CODATA 2022 (NIST
`allascii.txt`). It is **fixed-width**, which neither CSVW extractor reads.
CSVW's dialect has no fixed-width layout, so the record cannot migrate as is.

## Owner decision

Retiring `folio-tabular-records/v1` (Done-when 3) is blocked by that one
fixed-width record. The retirement itself is cat-harness and tools work:
`schemas/tabular-records.ts`, `scripts/tabular-records.py` and
`content/pipeline/tabular-nodes.ts`.

1. **(Recommended) Keep v1 for fixed-width sources only.** Mark it retired for
   delimited files and workbooks, which are now CSVW. One record keeps it
   alive, and nothing new is written to it except a fixed-width source.
2. Add a `fac:` fixed-width dialect (column offsets) to `folio-tabular-csvw/v1`,
   write a third extractor, migrate CODATA, then retire v1 entirely.
3. Re-derive CODATA as a CSV from its existing `values.json`, then extract it
   with `tabular-csv`. The record then describes a derivative, not the
   source NIST publishes.
4. Retire v1 now and drop CODATA's tabular record. The entry keeps
   `values.json`.

**Default if no answer: 1.**


## 2026-10-20 (lane C): the ruling is option 1, and retiring v1 for delimited sources is not a schema edit

The owner ruled option 1 (keep v1 for fixed-width only). What that leaves,
measured on tools main `8408cbc` and core main:

- **v1 is still the live writer for every CSV and workbook.** tools
  `scripts/ingest-document.ts:790,816` runs `scripts/tabular-records.py`, which
  writes `folio-tabular-records/v1` with `format: csv|xlsx|ods`.
  `check-l1-complete.ts:869` asks for exactly that file.
- **The CSVW extractors that replace it are core's** (`scripts/tabular-csv.ts`,
  `scripts/tabular-xlsx.ts`, `scripts/tabular-dak.ts`). tools may not import
  core, because core sits above tools (C1, epic `7x5n`). So tools' ingest cannot
  simply call them.

Either way it is a cross-layer move, not a leaf. The schema half (refusing
`format: csv|xlsx|ods` in v1) has to wait for the move, or it would refuse
what ingest writes today.

## Owner decision (2026-10-20): where the CSVW tabular rung lives

1. **(Recommended) Move the tabular rung of ingest up into core.** Core's
   ingest step writes `folio-tabular-csvw/v1` with the extractors already
   there. `check:l1-complete` then accepts csvw for delimited and workbook
   files, and v1 only for fixed-width. This fits "core owns content
   vocabulary": what a table holds is content.
2. **Move the CSVW extractors down into tools**, beside `tabular-records.py`.
   Ingest stays in tools, and core loses three scripts it owns today.
3. **Leave both writers.** v1 stays live for delimited sources too, and v1 is
   never retired. This is option 1 of the earlier ruling, frozen as it is now.

**Default if no answer: 1.**

## Owner ruling 2026-10-20: option 1

The owner, verbatim: *"(Recommended) Move that ingest step up into core, next to
the newer extractors."* Next steps:
- [ ] Core's ingest writes `folio-tabular-csvw/v1` for delimited and workbook
  sources, using `tabular-csv.ts`, `tabular-xlsx.ts` and `tabular-dak.ts`.
- [ ] tools `ingest-document.ts` stops running `tabular-records.py` for those
  files. It keeps the fixed-width path, which is the only one left for v1.
- [ ] `check:l1-complete` accepts csvw for delimited and workbook MIME types, and
  v1 only for fixed-width.
- [ ] `folio-tabular-records/v1` refuses `format: csv|xlsx|ods` in new records.
  Records already committed are listed or migrated.

Queued behind cat-tools-bbnd (the translation drawer), which the owner asked
for in the same session.

## Design 2026-10-20 (lane C): "up into core" through a pipeline-plugin slot

tools may neither import core nor name it by path (`check:reference-direction`).
So "core's ingest step" cannot be tools calling core's script. The legal
mechanism already exists: **a pipeline-plugin slot** (`pipeline/pipeline-plugins.ts`),
which a higher layer fills and generic code calls at run time.

1. **tools** declares a `tabular-csvw` slot: given a source file, return a
   `folio-tabular-csvw/v1` record, or `null` when the file is not tabular.
2. **core** fills it with `tabular-csv.ts` and `tabular-xlsx.ts`, plus
   `tabular-dak.ts`, which routes by content. It does this through its own
   `pipeline-plugins` graph node.
3. **tools `ingest-document.ts`**: the tabular rung's step runs a tools-side
   runner that calls `pipelinePlugin("tabular-csvw")` and writes
   `tabular.csvw.jsonld`. When nothing fills the slot it refuses with the slot
   error, which names what is missing. It never falls back to v1. Fixed-width
   stays on `tabular-records.py` / `codata-ingest`.
4. **`check:l1-complete`** accepts csvw for delimited and workbook MIME types,
   and v1 only for `format: fixed-width`.
5. **`folio-tabular-records/v1`** refuses `format: csv|xlsx|ods` in new records.
   The committed records (`test/results/tabular-real-sources/`) are re-emitted
   as csvw.

Order: 1 and 3 in tools, 2 in core, then a repin, then 4 and 5.

## Progress 2026-10-20 (lane C): steps 1 and 2 are up; step 3 needs a ruling

- Step 1: cat-harness-tools#468 declares the `tabular-csvw` slot. It is required, with no v1 fallback.
- Step 2: folio-assistant-core#160 fills it with `extractCsv` and `extractXlsx`. ODS returns `null` because core has no CSVW reader for it.

**What stops step 3, measured on tools main.** The v1 record carries two things the
CSVW record does not:
- **`source`**: the technical-metadata block every sidecar carries (`file`, `sha256`,
  `mimetype_sniffed`, publisher).
- **`narrative`**: the `ju0u` state machine.

Three consumers read them:
- `check-l1-complete` reads `source` through `sourceBlockOf`, for the
  technical-metadata and mimetype-scoped requirements.
- `check-library-qa` reads `source.file` and `source.publisher` for its
  bibliographic fields.
- `narratives.ts` reads `narrative`, for its review queue.

`TabularCsvwSchema` is `{ $schema, doc_id, tables }` and nothing else. So a csvw-only entry
would fail L1 for want of `source`, and its narrative would drop out of the review queue.
That is a schema question, and the schema is cat-harness's, so it is not mine to settle in passing.

## Owner decision (2026-10-20): where a CSVW entry's provenance lives

1. **(Recommended) Add `source` and `narrative` to `folio-tabular-csvw/v1`**, as the same
   blocks v1 carries: `source: record`, `narrative: NarrativeSchema`.
   - They are optional in the schema until the committed records are re-emitted, then required.
   - The record stays plain JSON (bean `792y`). `toCsvw` already emits only CSVW keys, so the
     derived CSVW document is unchanged.
   - The runner fills `source` from `_tech_meta`, the same call every rung makes.
   - `KIND_SIDECAR` gains `tabular.csvw.json`, and `sourceBlockOf` then finds it with no other change.
   - Cost: one cat-harness schema PR, then tools steps 3 and 4 in one PR.
2. **A separate `source.json` sidecar**, written beside whatever record a rung writes.
   - It is cleaner in principle, but it touches every rung and `sourceBlockOf`, not just the
     tabular one, so it is much wider than this bean.
3. **Write both**: csvw for the tables, and v1 `tabular.jsonld` kept for `source` and `narrative`.
   - It is the smallest diff, but it contradicts the ruling ("never falls back to v1"), and
     there would be two records of one table that can drift.

**Default if no answer: option 1.** It keeps one record per table, matches how every other rung
carries `source`, and leaves the CSVW export untouched.

## Owner ruling 2026-10-20: option 1

*"(Recommended) Add source and narrative to the CSVW record."*

- cat-harness#378 carries the schema change.
- Steps 3 and 4 follow as one tools PR:
  - the runner fills `source` through `_tech_meta`, and `narrative` as `not-authored`;
  - `KIND_SIDECAR` and `tabular-records` accept `tabular.csvw.json`.

## Progress 2026-10-20 (lane C): steps 3–4 up; step 5 measured

- Step 3 and 4 are up as cat-harness-tools#474, stacked on #468. Both wait on
  folio-assistant#2611 re-pinning cat-harness and core.
- **Step 5 is smaller than planned.** I searched the whole mounted checkout
  (all 11 layers) for committed tabular records. The only v1 `tabular.jsonld`
  is `folio-assistant-sci/library/codata-2022/`, which is `format: fixed-width`
  and stays on v1 by the ruling. core's `test/results/tabular-real-sources/`
  records are already CSVW. So **nothing needs re-emitting**.
- Step 5 is therefore two edits, after #474 lands:
  - v1 `TabularRecordsSchema` refuses `csv | xlsx`, and `tabular-records.py`
    refuses them too, keeping `ods` and `fixed-width`;
  - the csvw `source` and `narrative` fields become required. This needs the
    three `tabular-real-sources` csvw fixtures to gain a `source`, or to be
    marked as fixtures.

## Progress 2026-10-21 (lane C): step 5 split in three, in merge order

Steps 3–4 (tools#474) and the slot (tools#468) are on tools main. Step 5 needs
a third, tables-only type first, because the extractors never see the file's
technical metadata and so cannot return a record that requires `source`.

| step | PR | what | merges |
|---|---|---|---|
| 5a | cat-harness#399 (merged, d345b97) | `TabularCsvwTablesSchema` = the record without `source`/`narrative`; `stubsIn`, `toCsvw` take it | done |
| 5b | tools#524 | the `tabular-csvw` slot returns `TabularCsvwTables` | any time |
| 5b | core#170 | `extractCsv`/`extractXlsx` typed against it | any time |
| 5c prep | tools#525 | `tabular-csvw.test.ts`: helpers on the tables schema, stub fixtures carry provenance | any time |
| 5c-i | cat-harness#401 | `source` and `narrative` **required** on the record | after #525 and #170 |
| 5c-ii | not yet opened | v1 refuses `csv | xlsx`; `tabular-records.py` stops writing them | after 5c-i |

Measured with both fields required in the composed index: every tools suite
that builds a CSVW record passes once #525 lands, and no `tabular.csvw.json`
is committed anywhere in the 11 layers.

**5c-ii is wider than "two edits".** Readers still carry `csv`/`xlsx` v1 code
paths and fixtures: `pipeline/tabular-nodes.ts` (`SHEETED_FORMATS`),
`gen-library-jsonld`, `narratives`, `check-l1-complete`, and
`tabular-records.py`'s own tests. Refusing those formats in the schema means
moving those fixtures to `fixed-width`/`ods` and retiring the dead
`csv`/`xlsx` reader paths, so it is its own PR.

## Progress 2026-10-21 (lane C): 5a, 5b and 5c-i are merged; 5c-ii measured

Merged: cat-harness#399 (5a), tools#524 and core#170 (5b), tools#525 and
tools#533 (test prep), cat-harness#401 (5c-i: `source` and `narrative`
required on `folio-tabular-csvw/v1`).

**5c-ii, measured on tools main d2b17cc:**
- `tabular-records.py` writes only `xlsx` or `csv`. It has no ODS or
  fixed-width path; CODATA's fixed-width record is written by
  folio-assistant-sci's `codata-ingest.ts`.
- Ingest no longer calls it for CSV or xlsx (tools#474). It calls it only
  for **ODS**, and on ODS it writes nothing: `records()` raises `sniffed
  application/vnd.oasis.opendocument.spreadsheet — not a CSV or spreadsheet`
  and exits 1 (reproduced on a minimal ODS). So the ODS route has never
  produced a record; ODS is in practice unread already.
- So v1 has no working writer left. Retiring the writer means deleting its
  xlsx/csv parser and most of `tests/tabular-records.test.ts` (366 lines,
  bean `p67i`'s fixtures), and routing ODS through the `tabular-csvw` slot,
  where core returns `null` and ingest SKIPs honestly.
- **What could not be measured:** whether any folio outside this index
  commits a v1 `tabular.jsonld` with `format: csv|xlsx`. The test file itself
  says "folio repositories hold those". folio-test and smart-ra hold none;
  other folios are not visible from here. A schema-level refusal would turn
  such a folio's gates red.

## Owner decision (2026-10-21): how far 5c-ii goes

1. **(Recommended) Retire the writer; keep the schema reading old records.**
   `tabular-records.py` refuses `csv`/`xlsx` (pointing at the CSVW rung), its
   dead parser and writer tests go, and ODS routes through the
   `tabular-csvw` slot. `folio-tabular-records/v1` keeps accepting
   `csv|xlsx` so a folio's committed records still validate, and its
   description marks those formats legacy. Nothing new can be written as
   v1 except fixed-width. One tools PR; no folio can break.
2. **Option 1, plus the schema refuses `csv|xlsx|ods`.** The full ruling as
   written. It needs each folio checked for committed v1 `csv`/`xlsx`
   records, and those migrated, first.
3. **Fix ODS only.** Route ODS through the CSVW slot so the route stops
   failing, and leave the v1 writer and schema as they are.

**Default if no answer: 1.**

## Progress 2026-10-22 (lane C): 5c-ii, option 1, ruled by the owner

The owner ruled option 1 on 2026-10-22 ("Retire writer, keep reading"), in
session https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco and in the
coordinator's session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6.
Both PRs are merged.

- cat-harness-tools#550 (merged, 788f345): `tabular-records.py` keeps `is_tabular_text` and
  stops writing v1 (the command refuses and names `tabular-csvw.ts`); ODS goes
  through the `tabular-csvw` slot, where core answers `null`, the step exits 2,
  and `tableNotTaken()` lets ingest stage the entry with its tabular record
  unmet instead of stopping. Tests that built v1 records now use one as the
  writer last wrote it.
- cat-harness#412 (merged, ea3b1b6): the v1 schema says `csv`/`xlsx`/`ods` are legacy (comments
  only; the enum is unchanged, so committed records keep validating).

Left: the index re-pin, folio-assistant#2626 (tools 0eb0564, cat-harness
ea3b1b6). Then the third done-when box
("v1 retired from the schema graph") is option 2's, not 1's — under option 1
the schema stays, and that box is answered "kept, as ruled".

## Claim 2026-10-24 (Drain folio-assistant-core beans thread)

Claimed by Claude, session https://claude.ai/code/session_01MK9nZ3Gmon4cDBRLSURizU, to close on evidence.

## Completed 2026-10-24

The last step, the index re-pin folio-assistant#2626 (tools 0eb0564, cat-harness
ea3b1b6), merged on 2026-10-23 07:36Z. Every step of the owner's rulings is on main:

- the `tabular-csvw` slot and its runner (tools#468, #474, #524, #525, #533);
- core fills the slot (core#160, #170);
- `source` and `narrative` required on `folio-tabular-csvw/v1` (cat-harness#399, #401);
- v1 has no writer left, and its schema keeps reading committed records (tools#550, cat-harness#412).

The third done-when box is answered as ruled: under option 1 the v1 schema stays
for fixed-width sources, with `csv`/`xlsx`/`ods` marked legacy. Full retirement
was option 2, which the owner did not choose.
