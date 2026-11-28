---
# folio-assistant-eief
$schema: bean/1.0.0
title: 'CSVW skill + ingestion tools: tabular metadata as far as it can be determined'
status: completed
type: feature
priority: normal
created_at: 2026-09-20T12:02:21Z
updated_at: 2026-10-10T17:04:26Z
parent: folio-assistant-slw1
---

The owner's decision on `ulqj` is CSVW. This is the build.

> "make csvw a skill and associated tool in document ingestion. part of
> csv/excel processing is extract tabular metadata (tables, rows, headers,
> cols, data types, location on sheet, row, col, etc) as best as can. generic
> workflows, specific tools and skill depending on format"

## The shape the owner asked for

**Generic workflow, format-specific tools, one skill.** That is the same axis
`content-profiles` already draws: the *process* of deriving tabular metadata
does not change between CSV and XLSX, while *how you read the bytes* does.
A CSV has one table and no cells outside it; a workbook has sheets, several
tables per sheet, and a table that may start anywhere.

## What must be extracted, and the honest limit on each

Tables, rows, headers, columns, **data types**, and **location on sheet**
(anchor cell, header row, row/column extent) — **"as best as can"**, which is
the owner's own phrasing of this repository's three-state rule. Every field
gets a determined value or an explicit undetermined with a reason; none gets a
default. `shape_source: "undetermined"` already does this for shape and must
survive the migration rather than be flattened.

## The one place CSVW is not enough

CSVW models a table's columns and their datatypes. It has **no** notion of
*where* a table sits, because in CSVW the table IS the file. Everything the
owner listed after "data types" — location on sheet, row, col — is outside it.

So: annotate, never replace. CSVW permits additional properties; `fac:` terms
carry the anchor cell and header row while `csvw:` carries structure and type.
A reader with a CSVW parser still gets a valid table description, which is the
whole reason for adopting a standard.

## Done when

- [ ] `csvw:` is in the `@context`, beside doco/deo/cito/oa/prov/skos/dcterms/fhir
- [ ] a skill governs tabular metadata extraction — what is determinable per
      format, and what undetermined means for each field
- [ ] CSV and XLSX each have their own tool; the workflow that calls them is
      shared
- [ ] location-on-sheet is recorded as an annotation ON CSVW, with a test that
      a CSVW-only reader still parses the output
- [ ] `folio-tabular-records/v1` is migrated, and the undetermined third state
      survives it — **the third state is already safe**: `yh6u` (#1078) made
      the record real JSON-LD with `narrative`/`sheets` typed `@type: "@json"`,
      so its nulls survive expansion. What is still open is MIGRATION proper,
      meaning CSVW replacing v1, which waits on the extractors. Read as "v1's
      format is broken", this line sends you to a defect that no longer
      exists — it did, on 2026-09-23 (bean `nbjv`)
- [ ] this unblocks `p67i`'s manifest: what a sheet IS in the graph is answered

## Not this bean

The narrative description of a dataset. That needs an author and there is no
tabular source in the corpus yet (`p67i`).

*2026-09-20* — Built to the strawperson's defaults, all four accepted.

`fac:` namespace · fail CI on an expired stub, report an outstanding one ·
model + skill + both stubs + QA axis · infer datatypes, mark `undetermined`
when unsure.

**Shipped:** `csvw:` in the published `@context` beside the other eight
prefixes; `schemas/tabular-csvw.ts`; `skills/library/library-core/tabular-metadata.md`;
`tabular-csv` and `tabular-xlsx` declared as stubs in `tools/index.ts`; and
`bun run cat check:tabular-stubs`, wired into the gate set (52 fast / 55 all).

**No extractor ships.** That was the instruction, and the QA axis is what makes
it safe: a stub is `not-derivable` naming its tool, a half-stub fails schema
validation, and an expired stub fails CI. The stubbed set is READ from
`install: { none: true }` on the tool declarations rather than restated — the
`transcript.json` probe is why.

Ten mutations, each caught by a named test. Two needed the test strengthened
first: `install.none` ignored still passed until a test asserted a RUNNABLE
tool is outside the set, and my extent refine compared two conditions for
equality, so `{rows: 8, columns: null, source: "measured"}` — the exact
half-known extent the rule refuses — validated. Caught by the test written for
it, not by review.

**Three of this repo's own gates caught things I got wrong**, which is the
system working: a skill with no published reference page and no manifest
entry; an unassigned module; and a WRONG-DIRECTION EDGE. I had filed
`check-tabular-stubs.ts` with the harness because it reads the tool graph, and
`--edges` reported a harness module importing core's schema. The table's own
test settles it — does it need a folio to have anything to do? It scans
`library/`. It is core, and core may import harness.

## Still open

- the extractors themselves (deliberately absent);
- migrating `folio-tabular-records/v1` — both models now exist side by side;
- what a sheet IS in the document graph (`0lmb`), which still blocks `p67i`'s
  manifest.



## Handover 2026-10-06 — PAUSED until the repo separation lands (Session F, GOAL 5)

Owner ruling, relayed by the coordinating session (session_012qoycyCSGidZqW245vXhze): repo separation is the primary goal, content authoring/review/publication goes to folio-assistant-core while cat-harness keeps the methods, and that 'needs to be done before F'. This bean resumes AFTER the split. **The code it touches may have moved to folio-assistant-core by then — re-locate it before editing, and re-measure.** Open questions on it are being put to the owner by the coordinating session, one at a time; the answer will be recorded here, not assumed.

## Owner ruling 2026-10-06: build BOTH extractors after the content split, against real data

Asked in https://claude.ai/code/session_012qoycyCSGidZqW245vXhze, with three options (recommended first): wait for real data; CSV now, XLSX later; build both after the split. **The owner chose "build both after the split"** and corrected the premise that no tabular source exists, verbatim: *"note alerady we had tabular data w/ PR comments inport for Ref Arch.  Also DAKs have excel sheets.."*

- **Real sources to build and test against:**
  - the Public Comment CSV/XLSX import for litlfred/smart-ra (the DPI-H Reference Architecture, bean `v26p`; `folio-assistant-core/schemas/public-comment.ts`);
  - the DAK Excel workbooks (smart-* IGs). These have several tables per sheet, which is exactly the location-on-sheet case.
- **Order:** the content split across repos first (owner, 2026-10-06), then CSV and XLSX extractors replacing the stubs, then the `folio-tabular-records/v1` migration. The extractors land in folio-assistant-core.


## 2026-10-10: CSV extractor built (bean-backlog drain, lane C, PR 1 of 2)

Following the 2026-10-06 ruling (build both extractors, in core, after the
split):
- **`scripts/tabular-csv.ts`** writes a validated `folio-tabular-csvw/v1`
  record.
  - Parsing follows RFC 4180.
  - Routing is a content question: the first rows must agree on one field
    count of two or more. Otherwise the file is refused, never guessed. Two
    delimiters agreeing on different widths, as with decimal commas in a
    semicolon file, is also refused.
  - `fac:anchor` is a determined `{sheet: null, cell: null, row: 1, column: 1}`.
  - `fac:headerRow` is `1`, or `null` when row 1 is data.
  - `fac:extent` is measured, or undetermined with both values null when rows
    disagree on width.
- **`scripts/tabular-columns.ts`** is the column classifier the XLSX tool will
  share.
  - A column whose values all classify gets that CSVW datatype, `measured`,
    with integer widening to decimal.
  - All text is `string`, `measured`.
  - Mixed or empty columns (`1, 2, 3, N/A`) are `any` + `undetermined`.
- **`scripts/tabular-csv.test.ts`** has 19 tests, including one over a
  public-comment-shaped export (`schemas/public-comment.ts`). The smart-ra CSV
  itself is not in this checkout.
- The `tabular-metadata` skill now says the CSV extractor ships, and states the
  header convention: an all-text table takes CSVW's declared default,
  `header: true`.

**Still open:**
- the XLSX extractor (PR 2, next);
- the `tabular-csv`/`tabular-xlsx` Tool nodes in cat-harness `tools/index.ts`
  still read STUB with `install: { none: true }`. They should be replaced by
  real declarations pointing at core's scripts. That is a cat-harness change;
- the `folio-tabular-records/v1` migration;
- testing against the real smart-ra public-comment CSV/XLSX and the DAK
  workbooks.


## 2026-10-10: XLSX extractor built (bean-backlog drain, lane C, PR 2 of 2)

- **`scripts/tabular-xlsx.ts`** needs no new dependency: the ZIP is read with
  `node:zlib` (stored and deflated, all ECMA-376 permits), and the XML with
  the already-declared `fast-xml-parser`.
  - Routing is by content: a file with no ZIP signature, or a ZIP without
    `xl/workbook.xml`, is refused.
  - Each sheet is split into **blocks**, on empty rows and then on empty
    columns within a band. Each block is one CSVW table with a determined
    `fac:anchor` (sheet, A1 cell, row, column), a header judged by the same
    rule as a CSV's, and a measured extent. This is the location-on-sheet case
    the owner named.
  - Dates are read through `xl/styles.xml` (built-in ids 14–22 and 45–47, and
    custom format codes with a date token), so a date column is `date`, not the
    `integer` its serials would misread as.
  - A malformed part is refused (`XMLValidator`) rather than half-read.
- **`scripts/tabular-xlsx.test.ts`** has 12 tests over workbooks built byte by
  byte in the test, including a DAK-shaped sheet: a title cell, a decision
  table at B3, a code table beside it at G3, and a data-element table at B9.
  All four are found and anchored where they start.

**Done-when status:**
- [x] `csvw:` in the `@context` (earlier rounds)
- [x] the skill governs extraction, and now describes both shipped tools
- [x] CSV and XLSX each have their own tool. The **Tool nodes** in cat-harness
      `tools/index.ts` still read STUB with `install: { none: true }`; replacing
      them with declarations that invoke core's scripts is a cat-harness change,
      queued below.
- [x] location-on-sheet recorded as an annotation on CSVW, tested (DAK-shaped
      sheet)
- [ ] `folio-tabular-records/v1` migrated
- [x] p67i's manifest question (answered by jg8s, completed)

## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). What remains is (a) the
cat-harness Tool nodes for `tabular-csv` and `tabular-xlsx`, which still say
STUB, and (b) the `folio-tabular-records/v1` migration.

1. **(Recommended) Close this bean, and open two follow-ups.** (a) goes to the
   cat-harness store: replace the stubs with real declarations invoking
   `folio-assistant-core/scripts/tabular-{csv,xlsx}.ts`. (b) is a core bean for
   the migration, run against the smart-ra public-comment export and a DAK
   workbook once either is in a checkout.
2. Keep this bean open until both are done.
3. Lane C opens a cat-harness PR for (a) now, left for review.

**Default if no answer:** option 1.


## Owner ruling 2026-10-10, answered directly in the lane C session (https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): accept the default, close

## Summary of Changes

Closed on the owner's ruling (option 1 above).
- **Shipped in core:** `csvw:` in the `@context`, the `tabular-metadata`
  skill, `scripts/tabular-csv.ts` and `scripts/tabular-xlsx.ts` with the shared
  column classifier (31 tests), and location-on-sheet tested on a DAK-shaped
  sheet (PRs #33, #34).
- **Follow-ups:**
  - (a) the cat-harness Tool nodes `tabular-csv`/`tabular-xlsx` still read
    STUB, and the stub check they feed exists in no repository. This is filed as `litlfred/cat-harness-tools` bean `cat-tools-1wre` (PR #68 there).
  - (b) the `folio-tabular-records/v1` migration is `folio-core-urat`.


## Summary of Changes

Mirror copy. Completed in folio-assistant-core's store by drain lane C (core #33, #34: CSV and XLSX extractors, 31 tests). Follow-ups: folio-core-urat (tabular-records migration) and cat-tools-1wre (cat-harness tool stubs).



## 2026-10-10: CSV extractor built (bean-backlog drain, lane C, PR 1 of 2)

Following the 2026-10-06 ruling (build both extractors, in core, after the
split):
- **`scripts/tabular-csv.ts`** writes a validated `folio-tabular-csvw/v1`
  record.
  - Parsing follows RFC 4180.
  - Routing is a content question: the first rows must agree on one field
    count of two or more. Otherwise the file is refused, never guessed. Two
    delimiters agreeing on different widths, as with decimal commas in a
    semicolon file, is also refused.
  - `fac:anchor` is a determined `{sheet: null, cell: null, row: 1, column: 1}`.
  - `fac:headerRow` is `1`, or `null` when row 1 is data.
  - `fac:extent` is measured, or undetermined with both values null when rows
    disagree on width.
- **`scripts/tabular-columns.ts`** is the column classifier the XLSX tool will
  share.
  - A column whose values all classify gets that CSVW datatype, `measured`,
    with integer widening to decimal.
  - All text is `string`, `measured`.
  - Mixed or empty columns (`1, 2, 3, N/A`) are `any` + `undetermined`.
- **`scripts/tabular-csv.test.ts`** has 19 tests, including one over a
  public-comment-shaped export (`schemas/public-comment.ts`). The smart-ra CSV
  itself is not in this checkout.
- The `tabular-metadata` skill now says the CSV extractor ships, and states the
  header convention: an all-text table takes CSVW's declared default,
  `header: true`.

**Still open:**
- the XLSX extractor (PR 2, next);
- the `tabular-csv`/`tabular-xlsx` Tool nodes in cat-harness `tools/index.ts`
  still read STUB with `install: { none: true }`. They should be replaced by
  real declarations pointing at core's scripts. That is a cat-harness change;
- the `folio-tabular-records/v1` migration;
- testing against the real smart-ra public-comment CSV/XLSX and the DAK
  workbooks.


## 2026-10-10: XLSX extractor built (bean-backlog drain, lane C, PR 2 of 2)

- **`scripts/tabular-xlsx.ts`** needs no new dependency: the ZIP is read with
  `node:zlib` (stored and deflated, all ECMA-376 permits), and the XML with
  the already-declared `fast-xml-parser`.
  - Routing is by content: a file with no ZIP signature, or a ZIP without
    `xl/workbook.xml`, is refused.
  - Each sheet is split into **blocks**, on empty rows and then on empty
    columns within a band. Each block is one CSVW table with a determined
    `fac:anchor` (sheet, A1 cell, row, column), a header judged by the same
    rule as a CSV's, and a measured extent. This is the location-on-sheet case
    the owner named.
  - Dates are read through `xl/styles.xml` (built-in ids 14–22 and 45–47, and
    custom format codes with a date token), so a date column is `date`, not the
    `integer` its serials would misread as.
  - A malformed part is refused (`XMLValidator`) rather than half-read.
- **`scripts/tabular-xlsx.test.ts`** has 12 tests over workbooks built byte by
  byte in the test, including a DAK-shaped sheet: a title cell, a decision
  table at B3, a code table beside it at G3, and a data-element table at B9.
  All four are found and anchored where they start.

**Done-when status:**
- [x] `csvw:` in the `@context` (earlier rounds)
- [x] the skill governs extraction, and now describes both shipped tools
- [x] CSV and XLSX each have their own tool. The **Tool nodes** in cat-harness
      `tools/index.ts` still read STUB with `install: { none: true }`; replacing
      them with declarations that invoke core's scripts is a cat-harness change,
      queued below.
- [x] location-on-sheet recorded as an annotation on CSVW, tested (DAK-shaped
      sheet)
- [ ] `folio-tabular-records/v1` migrated
- [x] p67i's manifest question (answered by jg8s, completed)

## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). What remains is (a) the
cat-harness Tool nodes for `tabular-csv` and `tabular-xlsx`, which still say
STUB, and (b) the `folio-tabular-records/v1` migration.

1. **(Recommended) Close this bean, and open two follow-ups.** (a) goes to the
   cat-harness store: replace the stubs with real declarations invoking
   `folio-assistant-core/scripts/tabular-{csv,xlsx}.ts`. (b) is a core bean for
   the migration, run against the smart-ra public-comment export and a DAK
   workbook once either is in a checkout.
2. Keep this bean open until both are done.
3. Lane C opens a cat-harness PR for (a) now, left for review.

**Default if no answer:** option 1.


## Owner ruling 2026-10-10, answered directly in the lane C session (https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco): accept the default, close

## Summary of Changes

Closed on the owner's ruling (option 1 above).
- **Shipped in core:** `csvw:` in the `@context`, the `tabular-metadata`
  skill, `scripts/tabular-csv.ts` and `scripts/tabular-xlsx.ts` with the shared
  column classifier (31 tests), and location-on-sheet tested on a DAK-shaped
  sheet (PRs #33, #34).
- **Follow-ups:**
  - (a) the cat-harness Tool nodes `tabular-csv`/`tabular-xlsx` still read
    STUB, and the stub check they feed exists in no repository. This is filed as `litlfred/cat-harness-tools` bean `cat-tools-1wre` (PR #68 there).
  - (b) the `folio-tabular-records/v1` migration is `folio-core-urat`.
