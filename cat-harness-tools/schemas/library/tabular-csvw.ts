/**
 * @graphNode schema
 *
 * A tabular source as CSVW, annotated with what CSVW cannot say.
 *
 * CSVW is a W3C Recommendation that is already JSON-LD, so a tabular source
 * reuses a published vocabulary rather than a folio invention. It models
 * table → column → datatype and **nothing else**: no formulas, no merged
 * cells, no styling.
 *
 * **What CSVW cannot express is WHERE a table is**, because in CSVW the table
 * IS the file. A real workbook breaks that three ways: tables that do not
 * start at A1, headers that are not row 1, and several tables on one sheet.
 *
 * So {@link SheetAnchorSchema} and friends are annotations on the CSVW
 * shape, carried in a record that is **plain JSON** — `tabular.csvw.json`,
 * not `.jsonld` — and {@link toCsvw} derives the genuine CSVW metadata
 * document from it. A CSVW reader is handed that, and only that.
 *
 * ## Why the record is JSON and not JSON-LD
 *
 * CSVW metadata documents may put only `@language` and `@base` in a local
 * context, so a prefix of ours can never be bound there. Nothing reads these
 * annotations as linked data — the graph projection
 * (`pipeline/tabular-nodes.ts`) reads `anchor.sheet` from the JSON — and
 * JSON-LD DROPS `null`, while the three-state rule below depends on a
 * DETERMINED null (a CSV's sheet is `null` because a CSV has none). The
 * `fac:` spelling of the keys is a plain JSON name marking our fields apart
 * from CSVW's, not a compact IRI.
 *
 * ## "As best as can" is the three-state rule
 *
 * Every field is determined, or explicitly undetermined WITH A REASON.
 * Nothing defaults. A column that will not classify gets `datatype: "any"`
 * and `fac:datatypeSource: "undetermined"` — never a guess that reads as a
 * measurement.
 *
 * ## No extractor ships with this
 *
 * The tools are declared and STUBBED, and {@link TabularStubSchema} is what
 * makes a stub impossible to mistake for a result. A stub is never `met`; it
 * is `not-derivable` naming the tool that would fill it.
 */
import { z } from "zod";

import { nodeKind } from "../kg/node-kind.js";

import { NarrativeSlotSchema } from "../content/narrative";

/** How a value was arrived at. `undetermined` is a finding, never a default. */
export const DETERMINATION = ["measured", "declared", "undetermined"] as const;
export type Determination = (typeof DETERMINATION)[number];

/**
 * Where a table sits — the part CSVW has no vocabulary for.
 *
 * `sheet` is null for a CSV, which has exactly one table and no sheets. That
 * is a DETERMINED null rather than a missing field: a CSV genuinely has no
 * sheet name, and writing `"Sheet1"` would invent one.
 */
export const SheetAnchorSchema = z.object({
  sheet: z.string().min(1).nullable(),
  /** A1-style reference, when the format has one. */
  cell: z.string().regex(/^[A-Z]+[1-9]\d*$/).nullable(),
  row: z.number().int().positive(),
  column: z.number().int().positive(),
});
export type SheetAnchor = z.infer<typeof SheetAnchorSchema>;

/** Rows and columns the table occupies, or an honest unknown. */
export const ExtentSchema = z
  .object({
    rows: z.number().int().nonnegative().nullable(),
    columns: z.number().int().positive().nullable(),
    source: z.enum(DETERMINATION),
  })
  .refine(
    (e) =>
      e.source === "undetermined"
        ? e.rows === null && e.columns === null
        : e.rows !== null && e.columns !== null,
    {
      message:
        "`undetermined` means BOTH rows and columns are null, and a determined " +
        "extent must give BOTH — a half-known extent reads as a measurement",
      path: ["source"],
    },
  );
// The first version of that refine compared the two conditions for equality,
// which is true whenever both are false: `{rows: 8, columns: null, source:
// "measured"}` passed. Exactly the half-known extent the rule exists to
// refuse, and caught by the test written for it rather than by review.

/** One CSVW column, plus how confident we are about its datatype. */
export const CsvwColumnSchema = z.object({
  name: z.string().min(1),
  titles: z.string(),
  /** A CSVW datatype name. `any` is CSVW's own top type. */
  datatype: z.string().min(1),
  datatypeSource: z.enum(DETERMINATION),
  /**
   * The upper row of a two-row header: the label spanning this column, e.g. a
   * decision table's `Inputs` or `Output`. Absent for a one-row header.
   * CSVW has no column groups, so `toCsvw` drops it (bean folio-core-scn4).
   */
  "fac:group": z.string().min(1).optional(),
}).refine((c) => c.datatypeSource !== "undetermined" || c.datatype === "any", {
  message: '`undetermined` datatype must be recorded as CSVW `any`, not guessed',
  path: ["datatype"],
});

/**
 * A tool that has not been built, recorded so its absence cannot read as a
 * result.
 *
 * `since` is required for the same reason a blocked bean needs one: an
 * undated stub cannot be told from abandoned work.
 */
export const TabularStubSchema = z.object({
  tool: z.string().min(1),
  reason: z.string().min(1),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type TabularStub = z.infer<typeof TabularStubSchema>;

export const TABULAR_CSVW_SCHEMA_ID = "folio-tabular-csvw/v1";

/**
 * The record's filename. `.json`, deliberately — see "Why the record is JSON
 * and not JSON-LD" above. One constant, because the reader, the rung table
 * and the stub check each named it separately and a rename touched all three.
 */
export const TABULAR_CSVW_FILENAME = "tabular.csvw.json";

/** Where the CSV files of tables transcribed from a paged source (a PDF) live, as `tables/<slug>.csv`; each record's `url` points there. */
export const TABULAR_TABLES_DIR = "tables";

/** The context every CSVW metadata document carries (W3C CSVW Metadata §5.2). */
export const CSVW_CONTEXT = "http://www.w3.org/ns/csvw";

/**
 * One table. CSVW keys are unprefixed as CSVW itself writes them; ours carry
 * `fac:` so the boundary is visible in the file, not only in this module.
 */
export const CsvwTableSchema = z
  .object({
    url: z.string().min(1),
    tableSchema: z.object({ columns: z.array(CsvwColumnSchema) }),
    "fac:anchor": SheetAnchorSchema.nullable(),
    "fac:headerRow": z.number().int().positive().nullable(),
    "fac:extent": ExtentSchema,
    /** Present iff no extractor produced this. */
    "fac:stub": TabularStubSchema.optional(),
    /**
     * Key/value rows ABOVE the header that describe the table rather than
     * belong to it, in sheet order: a DAK decision table's `Decision ID`,
     * `Business rule`, `Trigger`. Not CSVW `notes`, whose objects are JSON-LD
     * annotations a standard reader interprets; these are the source's own
     * labels, verbatim (bean folio-core-scn4).
     */
    "fac:preamble": z.array(z.object({ key: z.string().min(1), value: z.string() })).optional(),
    /**
     * The cell values meaning "any value matches" — a decision table's
     * don't-care. A list: the WHO IMMZ workbook writes `–` and `-`, and 18 of
     * its 86 decision tables use both. A wildcard is a rule, not data: it is
     * not evidence for a column's datatype, and it is not CSVW `null`
     * (absent), which would read a don't-care as a missing value.
     */
    "fac:wildcard": z.array(z.string().min(1)).min(1).optional(),
    /** Merged cell ranges inside the table, A1 notation, e.g. `K8:K25`. */
    "fac:merged": z.array(z.string().regex(/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/)).optional(),
  })
  .refine((t) => !t["fac:stub"] || t.tableSchema.columns.length === 0, {
    message:
      "a stubbed table must have NO columns. A half-stub is the worst state " +
      "there is: it reads as a working extraction that happens to be thin",
    path: ["fac:stub"],
  });

/** The fields of a CSVW sidecar: the {@link TabularCsvwKind}'s own, and the schema's. */
const tabularCsvwFields = {
  $schema: z.literal(TABULAR_CSVW_SCHEMA_ID),
  doc_id: z.string().min(1),
  /** One per sheet. A CSV has exactly one; a workbook is a `csvw:TableGroup`. */
  tables: z.array(CsvwTableSchema),
  /**
   * The technical-metadata block every ingest sidecar carries (`file`,
   * `sha256`, `mimetype_sniffed`, ...), the same record
   * `folio-tabular-records/v1` holds as `source` — bean `urat`. It is how
   * `check-l1-complete` (`sourceBlockOf`) and `check-library-qa` learn what
   * the entry was made from. Required (urat step 5): no committed record
   * predates it, and an extractor's output, which has none, is
   * {@link TabularCsvwTablesSchema}. Not a CSVW key: {@link toCsvw} never
   * emits it.
   */
  source: z.record(z.string(), z.unknown()),
  /**
   * What the data is about, under bean `ju0u`'s state machine, the same
   * record v1 carries. Required on the same terms as `source`.
   */
  narrative: NarrativeSlotSchema,
};

export const TabularCsvwSchema = z.object(tabularCsvwFields);
export type TabularCsvw = z.infer<typeof TabularCsvwSchema>;

/**
 * `folio-tabular-csvw/v1` as a node kind, the validator of the library kind's
 * family of that name (`validators/library-tabular-csvw.json`). It judges a
 * file exactly as {@link TabularCsvwSchema} does: not strict, as the schema is not.
 */
export const TabularCsvwKind = nodeKind(TABULAR_CSVW_SCHEMA_ID, [], tabularCsvwFields, {
  term: "Tabular CSVW",
  summary: "One spreadsheet or CSV source read as CSVW, one table per sheet, with the technical metadata and narrative every ingest sidecar carries.",
});

/**
 * What an extractor returns: the tables, before the ingest runner adds
 * `source` and `narrative` (bean `urat`, step 5). The extractors live in a
 * content layer and never see the source file's technical metadata, so their
 * type must not promise it once the record requires it.
 */
export const TabularCsvwTablesSchema = TabularCsvwSchema.omit({ source: true, narrative: true });
export type TabularCsvwTables = z.infer<typeof TabularCsvwTablesSchema>;

/** Is this record waiting on a tool nobody has written? */
export function stubsIn(doc: TabularCsvwTables): TabularStub[] {
  return doc.tables.flatMap((t) => (t["fac:stub"] ? [t["fac:stub"]] : []));
}

/**
 * The keys {@link toCsvw} may emit — CSVW's own vocabulary and nothing else.
 *
 * Exported so the test can hold the export to it at EVERY level. A key outside
 * this set is either ours leaking into a document a standard reader parses, or
 * a CSVW term used here without being added to the list on purpose.
 */
export const CSVW_KEYS: ReadonlySet<string> = new Set([
  "@context",
  "tables",
  "url",
  "tableSchema",
  "columns",
  "name",
  "titles",
  "datatype",
]);

/**
 * One table, as CSVW: every annotation of ours dropped, at every level —
 * `datatypeSource` on a column included, which the helper this replaced
 * (`csvwOnly`) left in.
 */
export function csvwTable(table: z.infer<typeof CsvwTableSchema>): Record<string, unknown> {
  return {
    url: table.url,
    tableSchema: {
      columns: table.tableSchema.columns.map((c) => ({ name: c.name, titles: c.titles, datatype: c.datatype })),
    },
  };
}

/**
 * The CSVW metadata document for a record — a `TableGroup` with the CSVW
 * `@context`, which is what makes it CSVW at all, and no key of ours.
 *
 * What it cannot carry, by construction, is WHERE each table sits — the
 * annotations exist because CSVW has no vocabulary for that. A reader that
 * needs placement reads the JSON record; a reader that needs a standard table
 * description reads this. Neither is handed the other's document.
 */
export function toCsvw(doc: TabularCsvwTables): Record<string, unknown> {
  return { "@context": CSVW_CONTEXT, tables: doc.tables.map(csvwTable) };
}
