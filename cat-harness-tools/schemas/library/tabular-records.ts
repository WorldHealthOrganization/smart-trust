/**
 * What makes a dataset findable.
 *
 * A CSV or spreadsheet in `uploads/` is stored but not findable: a grep for a
 * column header finds nothing. `tabular.jsonld` records sheet names, headers
 * and shape, so the header vocabulary joins the L1 source graph.
 *
 * ## The narrative is a state machine, and starts empty
 *
 * `narrative` (what the data is about) is a {@link module:schemas/narrative}
 * record, which starts `not-authored` with no text, moves to `draft` when an
 * agent writes one, and reaches `confirmed` only when a HUMAN accepts it.
 *
 * ## A null shape is not an empty sheet
 *
 * `rows`/`columns` are nullable and `shape_source` says which case it is. A
 * sheet whose `<dimension>` is absent or unparseable has an UNKNOWN shape;
 * `0 × 0` would say it is empty.
 *
 * ## Only `fixed-width` is still written as v1
 *
 * Delimited text and workbooks are read as CSVW (`folio-tabular-csvw/v1`) by
 * core's extractors through the `tabular-csvw` slot. This schema still accepts
 * csv, xlsx and ods so already-committed records keep validating; the one
 * format still written as v1 is `fixed-width`.
 *
 * @module schemas/tabular-records
 * @graphNode schema
 */
import { z } from "zod";

import { ContentContextSchema } from "../kg/jsonld";

import { NarrativeSlotSchema } from "../content/narrative";

/** Sniffed/declared types that route to the tabular rung. */
export const TABULAR_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
] as const;

export const SHAPE_SOURCES = ["dimension", "counted", "undetermined"] as const;

export const TabularSheetSchema = z.object({
  name: z.string().min(1),
  /** Row 1, in column order. Empty when the sheet has no readable header row. */
  headers: z.array(z.string()),
  rows: z.number().int().nonnegative().nullable(),
  columns: z.number().int().positive().nullable(),
  shape_source: z.enum(SHAPE_SOURCES),
  delimiter: z.string().nullable().optional(),
  delimiter_source: z.enum(["sniffed", "undetermined"]).optional(),
});
export type TabularSheet = z.infer<typeof TabularSheetSchema>;

export const TABULAR_RECORDS_SCHEMA_ID = "folio-tabular-records/v1";

export const TabularRecordsSchema = z
  .object({
    /**
     * The published content context — bean `yh6u`. OPTIONAL because folio
     * repositories hold records written before the arm emitted it; when
     * present it must be that context (bare, or with `@base` beside it —
     * bean `bh4q`), since any other would bind these keys to terms nobody
     * declared.
     */
    "@context": ContentContextSchema.optional(),
    $schema: z.literal(TABULAR_RECORDS_SCHEMA_ID),
    "@id": z.string().min(1),
    source: z.record(z.string(), z.unknown()),
    // `fixed-width`: a published text table such as NIST's CODATA allascii,
    // parsed by `codata-ingest` (bean uyp8). Named for what it is rather than
    // passed off as CSV, which it is not. `xlsx`, `ods` and `csv` are legacy:
    // read for committed records, no longer written (bean `urat`, 5c-ii).
    format: z.enum(["xlsx", "ods", "csv", "fixed-width"]),
    sheets: z.array(TabularSheetSchema),
    n_sheets: z.number().int().nonnegative(),
    /** Every distinct header across every sheet — what a grep lands in. */
    header_vocabulary: z.array(z.string()),
    // Bean `ju0u`: one object with its own state machine, replacing the
    // `narrative: string|null` + `narrative_state` pair. Two loose fields
    // needed a cross-field refinement here to stop them contradicting each
    // other, and had nowhere to record WHO drafted or confirmed the text —
    // which is the whole substance of the owner's choice.
    narrative: NarrativeSlotSchema,
  })
  .refine((d) => d.n_sheets === d.sheets.length, {
    message: "`n_sheets` disagrees with `sheets.length` — one of them is wrong",
    path: ["n_sheets"],
  })
  ;

export type TabularRecords = z.infer<typeof TabularRecordsSchema>;

export function isTabularMimetype(m: unknown): boolean {
  return typeof m === "string" && (TABULAR_MIMETYPES as readonly string[]).includes(m);
}
