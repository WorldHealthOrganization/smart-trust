/**
 * A tabular source becomes graph nodes — bean `p67i`, shape decided by `jg8s`.
 *
 * ## The rule, and it is the owner's
 *
 * > "both, sheet in grouping and single sheet. should model reality. not force
 * > conformance"
 *
 * | source | graph |
 * |---|---|
 * | multi-sheet workbook | `manifest.contains → sheet → table block(s)` |
 * | single-sheet CSV | `manifest.contains → table block` |
 *
 * **A sheet node appears iff the SOURCE has sheets.** Not iff there are two or
 * more: a one-sheet workbook still has a sheet, and a CSV has none however
 * many rows it holds. `schemas/library/tabular-csvw.ts` already decided this one level
 * down, setting `fac:anchor.sheet` to `null` for a CSV because *"a CSV
 * genuinely has no sheet, and writing `Sheet1` would invent one"*.
 *
 * Wrapping a CSV in a sheet node invents that sheet; flattening a workbook
 * discards a real one. Both uniform answers were a choice of which lie to tell
 * consistently.
 *
 * ## Two readers, deliberately — "special case of common scenarios ok"
 *
 * The owner's licence, same turn. There are two tabular records in this
 * repository and they are NOT merged behind a clever abstraction:
 *
 * - `folio-tabular-records/v1` (`tabular.jsonld`) — what `tabular-records.py`
 *   wrote until bean `urat` retired its writer (5c-ii); folios' committed
 *   records are still read;
 * - `folio-tabular-csvw/v1` (`tabular.csvw.json` — JSON, not JSON-LD; bean `792y`) — CSVW, from `eief`,
 *   which core's extractors now write through the `tabular-csvw` slot.
 *
 * {@link tabularShapeOf} reduces either to the little that a manifest needs.
 * Reading only CSVW would make this emitter unable to fire — the vacuity this
 * repository has spent a day removing — and reading only the old one would
 * strand it when the extractors land. Two named branches, each legible; when
 * `folio-tabular-records/v1` retires, one of them goes.
 *
 * @module pipeline/tabular-nodes
 */
import { documentContext } from "../schemas/content/content-context.ts";
import { termCurie } from "../schemas/kg/namespaces.ts";

/** All a manifest needs to know, from either record. */
export interface TabularShape {
  /**
   * Does the SOURCE have sheets? A CSV does not — and that is a determined
   * `false`, not a missing answer.
   */
  hasSheets: boolean;
  sheets: { name: string; headers: readonly string[] }[];
  /**
   * What to call the document, when the record says. `undefined` means the
   * record carries no name — the caller falls back to the entry id rather
   * than this inventing one.
   */
  title?: string;
}

/** Formats that genuinely have sheets. A CSV is the one that does not. */
export const SHEETED_FORMATS: readonly string[] = ["xlsx", "ods"];

/**
 * Reduce either tabular record to {@link TabularShape}.
 *
 * Returns `undefined` for anything it does not recognise, which the caller
 * reports rather than treating as an empty document — an unreadable record and
 * a document with no sheets are different facts.
 */
export function tabularShapeOf(doc: unknown): TabularShape | undefined {
  if (typeof doc !== "object" || doc === null) return undefined;
  const d = doc as Record<string, unknown>;

  // ── folio-tabular-records/v1 — what runs today ──────────────────────────
  if (d.$schema === "folio-tabular-records/v1" && Array.isArray(d.sheets)) {
    const format = typeof d.format === "string" ? d.format : "";
    const src = d.source as { file?: unknown } | undefined;
    return {
      hasSheets: SHEETED_FORMATS.includes(format),
      title: typeof src?.file === "string" && src.file ? src.file : undefined,
      sheets: d.sheets.map((s) => {
        const sh = s as Record<string, unknown>;
        return {
          name: typeof sh.name === "string" ? sh.name : "",
          headers: Array.isArray(sh.headers) ? (sh.headers as string[]) : [],
        };
      }),
    };
  }

  // ── folio-tabular-csvw/v1 — CSVW, once an extractor writes one ──────────
  if (d.$schema === "folio-tabular-csvw/v1" && Array.isArray(d.tables)) {
    const tables = d.tables as Record<string, unknown>[];
    // CSVW itself cannot say whether the source had sheets; `fac:anchor` was
    // added for exactly this, and its `sheet` is a determined null for a CSV.
    const hasSheets = tables.some((t) => {
      const a = t["fac:anchor"] as { sheet?: unknown } | null | undefined;
      return typeof a?.sheet === "string" && a.sheet.length > 0;
    });
    return {
      hasSheets,
      sheets: tables.map((t) => {
        const a = t["fac:anchor"] as { sheet?: unknown } | null | undefined;
        const schema = t.tableSchema as { columns?: unknown } | undefined;
        const cols = Array.isArray(schema?.columns) ? (schema.columns as Record<string, unknown>[]) : [];
        return {
          name: typeof a?.sheet === "string" && a.sheet ? a.sheet : String(t.url ?? ""),
          headers: cols.map((c) => (typeof c.titles === "string" ? c.titles : String(c.name ?? ""))),
        };
      }),
    };
  }

  return undefined;
}

/** `sheet-1`, `table-1` — stable, and derived from position rather than name. */
export function sheetKey(i: number): string {
  return `sheet-${String(i + 1).padStart(3, "0")}`;
}
export function tableBlockId(i: number): string {
  return `table-${String(i + 1).padStart(3, "0")}`;
}

export interface TabularNodeOpts {
  title?: string;
  /** `docIri(docId, rest)` from the caller, so IRI minting stays in one place. */
  iri: (rest: string) => string;
  meta?: Record<string, unknown>;
  /**
   * Properties of the manifest node itself, outside `meta` — the ones a graph
   * reader must be able to see, such as the licence (`licence-naming`,
   * finding D4). Written as given, before `meta`.
   */
  properties?: Record<string, unknown>;
}

/**
 * The nodes for one tabular entry.
 *
 * Emits `manifest.jsonld` plus a `table` block per sheet, and — only when the
 * source has sheets — a grouping node per sheet between them.
 */
export function buildTabularNodes(
  shape: TabularShape,
  opts: TabularNodeOpts,
): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];
  const containedByManifest: string[] = [];

  shape.sheets.forEach((sheet, i) => {
    const bId = tableBlockId(i);
    const bIri = opts.iri(`blocks/${bId}`);
    out.push({
      path: `blocks/${bId}.jsonld`,
      content: node({
        "@id": bIri,
        "@type": [termCurie("Block"), "doco:Table"],
        kind: "table",
        label: sheet.name || bId,
        // The header vocabulary IS the findable surface — `p67i`: "a grep for
        // a column header finds the dataset that has it".
        headers: [...sheet.headers],
        derivedFrom: opts.iri("manifest"),
        sourceDocument: opts.iri("manifest"),
        // "ingested": the table is the source's own content, which is what
        // LIBRARY_BLOCK_ORIGIN.table === "extracted" means. This read
        // `LIBRARY_BLOCK_ORIGIN.table ?? "ingested"` — an ORIGIN category used
        // as a PROVENANCE value — and was right only while `table` was
        // unclassified; classifying it (bean uyp8) wrote "extracted", which
        // check-l1-complete's narrative-provenance correctly refused.
        provenance: "ingested",
      }),
    });

    if (!shape.hasSheets) {
      // A CSV: the table hangs off the document directly. No sheet is
      // invented, because the source has none.
      containedByManifest.push(bIri);
      return;
    }

    const sKey = sheetKey(i);
    const sIri = opts.iri(`sheets/${sKey}`);
    out.push({
      path: `sheets/${sKey}.jsonld`,
      content: node({
        "@id": sIri,
        "@type": ["doco:Section"],
        title: sheet.name || sKey,
        // Ordered, and a list even at length one: a sheet may hold several
        // tables, which is why `fac:anchor` exists at all.
        contains: [bIri],
        derivedFrom: opts.iri("manifest"),
        sourceDocument: opts.iri("manifest"),
        provenance: "ingested",
      }),
    });
    containedByManifest.push(sIri);
  });

  out.push({
    path: "manifest.jsonld",
    content: node({
      "@id": opts.iri("manifest"),
      "@type": [termCurie("SourceDocument")],
      title: opts.title,
      contains: containedByManifest,
      provenance: "ingested",
      ...opts.properties,
      meta: {
        ...opts.meta,
        // Recorded so a consumer need not infer the depth from the shape it
        // happens to receive. A consumer that guesses is one that breaks on
        // the first source of the other kind.
        tabular_depth: shape.hasSheets ? "sheet" : "table",
      },
    }),
  });

  return out;
}

/**
 * Serialise, dropping undefined so output is byte-stable.
 *
 * The `@context` goes FIRST and is not optional: every other node under
 * `library/` carries its {@link documentContext}, and a node without it is one
 * a JSON-LD loader cannot type — `kind`, `contains` and `headers` would stay
 * bare strings. This was missing while nothing called the emitter, which is
 * precisely the class of defect an unreached function hides.
 */
function node(doc: Record<string, unknown>): string {
  const clean: Record<string, unknown> = { "@context": documentContext((doc["@type"] as string[] | undefined) ?? []) };
  for (const [k, v] of Object.entries(doc)) {
    if (v === undefined) continue;
    clean[k] = v;
  }
  return JSON.stringify(clean, null, 2) + "\n";
}
