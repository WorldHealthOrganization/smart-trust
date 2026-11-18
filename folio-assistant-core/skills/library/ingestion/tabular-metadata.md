---
name: tabular-metadata
description: >
  Extract tabular metadata from a CSV or spreadsheet as CSVW — tables, rows,
  headers, columns, datatypes and location on sheet — recording every field as
  determined or explicitly undetermined. Read before touching a tabular
  ingest arm, adding a format, or deciding what a sheet is in the graph.
allowed-tools: Read Grep Glob Bash
---

# Tabular metadata — CSVW, annotated, and honest about what it could not read

**The model is CSVW and nothing custom.** This graph already speaks doco, deo,
cito, oa, prov, skos, dcterms and fhir — published vocabularies, no folio
inventions. `folio-tabular-records/v1` is the one exception and is being
retired.

CSVW is a W3C Recommendation, it is already JSON-LD, and it models
**table → column → datatype** and nothing else. CSVW cannot express a formula,
a merged cell or a fill colour, so nobody can add one by accident.

## The one thing CSVW cannot say, and the only place we extend it

**Where the table is.** In CSVW the table *is* the file, so a CSVW document has
no way to say *"this table starts at B7 of sheet 3"*. A real workbook breaks
that assumption three ways:

- a table that does not start at A1,
- a header row that is not row 1,
- several tables on one sheet.

So three `fac:` terms, and **only** these three: `fac:anchor` (sheet, cell, row,
column), `fac:headerRow`, `fac:extent`.

> **The record is JSON; the CSVW is derived from it.** The annotations live in
> `tabular.csvw.json` — plain JSON, deliberately not `.jsonld` — and
> `toCsvw()` in cat-harness-tools `schemas/library/tabular-csvw.ts` produces
> the genuine CSVW metadata document from it: the CSVW `@context`, CSVW's own
> keys, nothing of ours at any level. A standard reader is handed that
> document and gets a correct table description. This is **tested**: the
> export is walked key by key against `CSVW_KEYS`.

Adding a fourth `fac:` term is the moment to stop and ask whether CSVW really
cannot express it. Usually it can.

### Why JSON and not JSON-LD

A record carrying the `fac:` keys cannot itself be valid CSVW: CSVW metadata
documents may put only `@language` and `@base` in a local context, so a CSVW
parser rejects any context of ours, and without one a JSON-LD processor reads
the `fac:` keys as IRIs in a URI scheme called `fac` — see
[`kg-export`](../../../../cat-harness/skills/kg/kg-core/kg-export.md) §"A prefix is the stub".

| | the record | the cost |
|---|---|---|
| **chosen** | JSON; CSVW DERIVED by `toCsvw()` | the annotations are not linked data |
| full-IRI terms | real CSVW, annotations as ~12 flattened IRI terms, each defined in the vocabulary | JSON-LD drops `null`, so a DETERMINED null — a CSV has no sheet — becomes indistinguishable from "never recorded" |
| our own context | JSON-LD with a context binding our prefix | a CSVW reader still rejects it |

**Nothing reads the annotations as linked data** — the graph projection reads
`anchor.sheet` from the JSON — and
[`directory-conventions`](../../../../cat-harness/skills/kg/kg-core/directory-conventions.md) says to generate as many
renderings as have a consumer, and no more. And **the three-state rule below
needs `null` to mean something**, which RDF cannot keep. If a consumer ever
needs placement as linked data, revisit the full-IRI answer.

**The `fac:` in the key names is a JSON name, not a prefix.** It marks our
fields apart from CSVW's in the file. It is safe only because the file is not
JSON-LD — rename the file to `.jsonld` and it dangles, which
`check:context-emission` would catch.

## "As best as can" means three states, never two

Every field is **determined**, or **explicitly undetermined with a reason**.
Nothing defaults.

| field | determined when | undetermined looks like |
|---|---|---|
| `datatype` | the column's values classify | `"any"` + `datatypeSource: "undetermined"` |
| `fac:extent` | rows AND columns are both known | both `null` + `source: "undetermined"` |
| `fac:anchor.sheet` | the format has sheets | `null` — a CSV has none, and that is DETERMINED |
| `fac:anchor.cell` | the format has A1 refs | `null` for a CSV |

**A CSV's `sheet: null` is a determined answer** — a CSV has no sheet, and
writing `"Sheet1"` would invent one. An `undetermined` extent is the opposite:
we looked and could not tell. The schema enforces the difference; `source` is
what tells them apart, and a half-known extent is refused outright because it
reads as a measurement.

**Never guess a datatype to avoid an `undetermined`.** A column of `1, 2, 3,
N/A` is not an integer column. `any` with a recorded reason is a better answer
than `integer` with a silent coercion, which is indistinguishable from a
correct reading.

## Generic workflow, format-specific tools

The *process* does not change between formats; *reading the bytes* does.

```
sniff → route → extract → annotate → validate
```

One workflow. One tool per format — `tabular-csv`, `tabular-xlsx` — each
declared in `tools/index.ts` and naming this skill in `satisfies`. A CSV has one
table and no cells outside it; a workbook has sheets, possibly several tables
per sheet, and a table that may start anywhere. That difference lives in the
tool, never in the workflow and never in the schema.

Routing a CSV is **not** a sniff: a CSV has no magic bytes, and it must not
become an extension guess either. The only question is about content — do the
first rows split into the same number of fields, more than one?

## What a sheet IS in the graph — model reality, do not force conformance

The shape follows the SOURCE:

| source | graph |
|---|---|
| multi-sheet workbook | `manifest.contains → sheet → table block(s)` |
| single-sheet CSV | `manifest.contains → table block` |

Wrapping a CSV in a sheet node invents a sheet, just as `"Sheet1"` would;
flattening a workbook discards a real one. A graph that cannot express *sheet
contains tables* contradicts `fac:anchor`, which already says a table may not
start at A1 and a sheet may hold more than one.

**Special-casing common scenarios is fine.** Two legible branches beat one
clever abstraction (a `depth` parameter, a container that is sometimes elided,
a walker that handles N levels); a third source type gets a third branch.
The limit: **a special case must still be a special case of something TRUE.**
Flattening a workbook because single-sheet is the common case is forced
conformance, not special-casing. One shape for everything is a wrong answer
applied evenly — for instance, demanding `structure.json`, `sections/` and
`images.json` of a CSV in `check:l1-complete`.

## The extractors, and stubs for formats not yet built

`scripts/tabular-xlsx.ts` reads a workbook with no new dependency: a ZIP read
with `node:zlib`, and SpreadsheetML read with `fast-xml-parser`. Each sheet is
split into rectangular blocks, on empty rows and then on empty columns, and
each block is one table anchored at its real top-left cell. A numeric cell
whose number format is a date format is read as a date, not as its serial. A
malformed part is refused rather than half-read.

`scripts/tabular-csv.ts` routes on content (the first
rows agree on a field count of two or more under exactly one width, or the
file is refused), classifies columns through `scripts/tabular-columns.ts`,
and records `fac:anchor` as sheet `null`, cell `null`, row 1, column 1.
When every column is text, nothing separates a header from a first data row,
and it takes CSVW's declared default, `header: true` (CSVW Dialect §5.9). That
is a stated convention, not a measurement.

A tool for any other format that has not been built records `fac:stub` with
the tool's name, a reason, and a **date** — undated, a stub cannot be told
from abandoned work. Three rules:

1. **A stub is never `met`.** It is `not-derivable`, naming the tool. A stub
   that reports success is worse than no tool at all.
2. **A half-stub is refused.** `fac:stub` alongside non-empty `columns` fails
   schema validation, because a thin-but-present extraction (sheet names
   right, headers empty) reads as a working one.
3. **A stub expires.** When the real tool lands, `fac:stub` must go. `bun run
   check:tabular-stubs` fails CI when a record carries both a stub and real
   columns, and reports every outstanding stub on every run.

**A declared exception must carry something a test can re-derive.**

## What this skill does not cover

- **The narrative** — what a dataset is *about*. That needs an author;
  assembling one from the headers would be fabrication.
- **Migrating `folio-tabular-records/v1`.**
- **Emitting the manifest.** `pipeline/tabular-nodes.ts` builds the nodes and
  `gen-library-jsonld.ts` calls it from `buildEntryNodes`.
