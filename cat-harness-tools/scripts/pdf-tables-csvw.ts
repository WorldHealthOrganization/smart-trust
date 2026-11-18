#!/usr/bin/env bun
/**
 * The TABLE arm of a paged ingest: `pdf-tables.py` over the source PDF,
 * written as the CSVW record a paged entry's tables live in —
 * `tabular.csvw.json` + `tables/table-N.csv`, the shape `readEntryTables`
 * (scripts/lib/library-document.ts) and `gen-library-jsonld`'s table blocks
 * read.
 *
 * `ingest-document.ts` named `pdf-tables.py` as a rung and never ran it, so a
 * paged entry's tables existed only where somebody transcribed them by hand
 * (owner, 2026-11-14: "not sure all have biblio, glossary, table, figure ...
 * fully extracted").
 *
 * ## Guarded: a failure records, it never stops the ingest
 *
 * Every outcome is recorded in the entry's `extraction.json` under `tables`
 * (`scripts/entry-extraction.ts`), and the arm exits 0:
 *
 * | pdf-tables.py says | recorded |
 * |---|---|
 * | `ok`, N tables | `found N`, the drafts written |
 * | `ok`, `tables: []` | `none` — the backend looked and found none |
 * | exit 2, no text layer | `not-extracted` — the tables are pixels, so nobody saw them |
 * | exit 5, no backend; any other failure | `not-extracted`, with the reason |
 *
 * ## A transcription is never overwritten
 *
 * When the DESTINATION entry already holds a `tabular.csvw.json` (tables a
 * person or an agent transcribed and checked against the page), this writes
 * nothing: promotion copies staging over the entry, and a machine draft
 * replacing a checked transcription is the loss this guards against. The kept
 * record is what `tables` then reports.
 *
 * The drafts say what they are: each table carries `fac:extracted` (tool,
 * version, backend, date) rather than `fac:transcribed`, and every column's
 * datatype is `undetermined`. The narrative is `not-authored`.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/pdf-tables-csvw.ts --staging <entry> [--library <library root>] FILE.pdf
 *
 * @module scripts/pdf-tables-csvw
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TABULAR_CSVW_FILENAME,
  TABULAR_CSVW_SCHEMA_ID,
  TABULAR_TABLES_DIR,
  TabularCsvwSchema,
} from "../schemas/library/tabular-csvw.ts";
import { STRUCTURE_FILENAME } from "../schemas/content/document-structure.ts";
import { counted, recordExtraction, scriptVersion, today } from "./entry-extraction.ts";

const PDF_TABLES = join(dirname(fileURLToPath(import.meta.url)), "pdf-tables.py");
const TOOL = "pdf-tables.py";

/** One table as `pdf-tables/v1` reports it — the fields read here. */
export interface PdfTable {
  id: string;
  pages: number[];
  rows: string[][];
  n_rows?: number;
  n_cols?: number;
  caption?: string | null;
  confidence?: number | null;
}

/** The `pdf-tables/v1` artefact — the fields read here. */
export interface PdfTablesArtefact {
  status: string;
  tables: PdfTable[] | null;
  source?: { file?: string; sha256?: string; bytes?: number };
  producer?: { backend?: string | null; backend_version?: string | null };
  diagnostics?: { reason?: string };
}

/** RFC 4180: quote a field holding a comma, quote or line break. */
export function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map((c) => csvField(c ?? "")).join(",")).join("\n") + "\n";
}

/** A column name: the header slugged, else `col-N`; unique within the table. */
export function columnNames(headers: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    const base =
      (h ?? "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || `col-${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** `Table 3`, `Tableau 2.1`, … from a caption's opening words, else `undefined`. */
export function captionLabel(caption: string | null | undefined): string | undefined {
  const m = (caption ?? "").match(/^\s*((?:tableau|tabela|tabla|table|таблица|表|جدول)\s*(?:[A-Z]?\d+(?:[.\-]\d+)*|[IVXLC]+(?![\p{L}])))/iu);
  return m ? m[1]!.replace(/\s+/g, " ") : undefined;
}

/**
 * A table worth a draft: at least two columns and a row under the header.
 *
 * Measured on a 62-page handbook (2026-11-14): pdfplumber's text strategy
 * returned 64 "tables", 13 of them one column wide — a paragraph read as a
 * grid — and some with a header and no body. Neither is a table a reader
 * would recognise, and a draft of one is noise the narrative queue then
 * offers for description. Dropped, and counted in the record's note.
 */
export function isGrid(t: PdfTable): boolean {
  return Array.isArray(t.rows) && t.rows.length >= 2 && (t.rows[0]?.length ?? 0) >= 2;
}

/**
 * How often a cell boundary cuts a word: of the side-by-side pairs of
 * non-empty cells, the share where the left cell ends in a lower-case
 * letter and the right one opens with one ("relat" | "ionship"). A table's
 * cells hold whole words; a column split laid over running prose cuts them.
 */
export function wordSplitShare(rows: readonly (readonly (string | null)[])[]): { share: number; pairs: number } {
  let pairs = 0;
  let cut = 0;
  for (const r of rows) {
    for (let j = 0; j + 1 < r.length; j++) {
      const a = r[j] ?? "";
      const b = r[j + 1] ?? "";
      if (!a.trim() || !b.trim()) continue;
      pairs++;
      if (/\p{Ll}$/u.test(a) && /^\p{Ll}/u.test(b)) cut++;
    }
  }
  return { share: pairs ? cut / pairs : 0, pairs };
}

/**
 * Prose cut into columns, not a table: a word is cut at a quarter or more of
 * at least five cell boundaries. Measured on a content layer's re-ingest pilot
 * (2026-11-14, two WHO handbooks, 109 candidates): every grid a reader would
 * call a table scored 0.12 or less, every page of prose read as one 0.42 or
 * more, so the line sits in an empty stretch and moving it within it changes
 * nothing there. Below five boundaries there is too little to judge, and the
 * table is kept.
 */
export function isProseCut(t: PdfTable): boolean {
  const { share, pairs } = wordSplitShare(Array.isArray(t.rows) ? t.rows : []);
  return pairs >= 5 && share >= 0.25;
}

/**
 * The CSVW record and the CSV files for `pdf-tables/v1` tables. Pure: the
 * caller writes the files. `source` is the entry's own source block (the
 * structure's), so the record names the same bytes the entry does.
 */
export function csvwFromPdfTables(
  docId: string,
  artefact: PdfTablesArtefact,
  source: Record<string, unknown>,
  at: string,
  version: string | undefined,
): { record: Record<string, unknown>; files: Array<{ path: string; content: string }> } {
  const files: Array<{ path: string; content: string }> = [];
  const tables = (artefact.tables ?? [])
    .filter((t) => isGrid(t) && !isProseCut(t))
    .map((t, i) => {
      const url = `${TABULAR_TABLES_DIR}/table-${i + 1}.csv`;
      const [head, ...body] = t.rows;
      const headers = head!.map((c) => (c ?? "").replace(/\s+/g, " ").trim());
      files.push({ path: url, content: toCsv(t.rows) });
      const names = columnNames(headers);
      const caption = typeof t.caption === "string" && t.caption.trim() ? t.caption.trim() : undefined;
      return {
        url,
        tableSchema: {
          columns: headers.map((h, j) => ({ name: names[j]!, titles: h, datatype: "any", datatypeSource: "undetermined" })),
        },
        "fac:anchor": null,
        "fac:headerRow": 1,
        "fac:extent": { rows: body.length, columns: headers.length, source: "measured" },
        "fac:label": captionLabel(caption) ?? `Table ${i + 1}`,
        ...(caption ? { "fac:caption": caption } : {}),
        "fac:pages": [...t.pages].sort((a, b) => a - b),
        "fac:extracted": {
          tool: TOOL,
          ...(version ? { version } : {}),
          backend: artefact.producer?.backend ?? null,
          backendVersion: artefact.producer?.backend_version ?? null,
          confidence: t.confidence ?? null,
          id: t.id,
          at,
        },
      };
    });
  const record = {
    $schema: TABULAR_CSVW_SCHEMA_ID,
    doc_id: docId,
    source: {
      ...(artefact.source ?? {}),
      ...source,
      note: "tables extracted from the PDF pages by pdf-tables.py — drafts, not checked against the page",
    },
    narrative: { text: null, state: "not-authored" },
    tables,
  };
  return { record, files };
}

/** Run the arm. Returns what it recorded, for tests and the log line. */
export function runTableArm(staging: string, pdf: string, library?: string): { state: string; detail: string } {
  const at = today();
  const version = scriptVersion(PDF_TABLES);
  const v = version ? { version } : {};
  const slug = basename(staging);
  const kept = library ? join(library, slug, TABULAR_CSVW_FILENAME) : undefined;
  if (kept && existsSync(kept)) {
    let n = 0;
    try {
      const t = (JSON.parse(readFileSync(kept, "utf-8")) as { tables?: unknown[] }).tables;
      n = Array.isArray(t) ? t.length : 0;
    } catch {
      /* counted as 0; the kept record's own check reports it */
    }
    const step = counted(n, TABULAR_CSVW_FILENAME, at, { note: "the entry's existing transcription was kept; pdf-tables.py not run over it" });
    recordExtraction(staging, "tables", step);
    return { state: step.state, detail: `kept the existing ${TABULAR_CSVW_FILENAME} (${n} table(s))` };
  }

  const r = Bun.spawnSync(["python3", PDF_TABLES, pdf, "-o", staging, "--json"], { stdout: "pipe", stderr: "pipe" });
  const err = new TextDecoder().decode(r.stderr).trim().split("\n").slice(-1)[0] ?? "";
  let artefact: PdfTablesArtefact | undefined;
  try {
    artefact = JSON.parse(new TextDecoder().decode(r.stdout)) as PdfTablesArtefact;
  } catch {
    artefact = undefined;
  }
  const notExtracted = (reason: string) => {
    recordExtraction(staging, "tables", { state: "not-extracted", tool: TOOL, ...v, at, note: reason });
    return { state: "not-extracted", detail: reason };
  };
  if (r.exitCode === 2) {
    const reason = artefact?.diagnostics?.reason ?? "no text layer — the tables here are pixels";
    // The step ran and could not look: the tables are pixels. `not-extracted`
    // with the reason, never `none` — nobody saw whether there were tables.
    recordExtraction(staging, "tables", { state: "not-extracted", tool: TOOL, ...v, at, note: reason });
    return { state: "not-extracted", detail: reason };
  }
  if (r.exitCode !== 0 || !artefact) {
    return notExtracted(artefact?.diagnostics?.reason ?? `pdf-tables.py exited ${r.exitCode}${err ? `: ${err}` : ""}`);
  }
  if (artefact.status !== "ok" || artefact.tables === null) {
    return notExtracted(artefact.diagnostics?.reason ?? `pdf-tables.py status ${artefact.status}`);
  }
  const structure = (() => {
    try {
      return JSON.parse(readFileSync(join(staging, STRUCTURE_FILENAME), "utf-8")) as { doc_id?: string; source?: Record<string, unknown> };
    } catch {
      return undefined;
    }
  })();
  const { record, files } = csvwFromPdfTables(structure?.doc_id ?? slug, artefact, structure?.source ?? {}, at, version);
  const n = (record.tables as unknown[]).length;
  const backend = artefact.producer?.backend ? `${artefact.producer.backend} ${artefact.producer.backend_version ?? ""}`.trim() : undefined;
  const candidates = artefact.tables ?? [];
  const prose = candidates.filter((t) => isGrid(t) && isProseCut(t)).length;
  const dropped = candidates.length - n - prose;
  const extra = [
    backend ? `backend ${backend}` : "",
    dropped > 0 ? `${dropped} candidate(s) dropped: under two columns or no row under the header` : "",
    prose > 0 ? `${prose} dropped as prose cut into columns (a word cut at a quarter or more of the cell boundaries)` : "",
  ]
    .filter(Boolean)
    .join("; ");
  if (n === 0) {
    recordExtraction(staging, "tables", { state: "none", count: 0, tool: TOOL, ...v, at, ...(extra ? { note: extra } : {}) });
    return { state: "none", detail: "the backend looked and found no table" };
  }
  const valid = TabularCsvwSchema.safeParse(record);
  if (!valid.success) return notExtracted(`the extracted tables do not make a valid CSVW record: ${valid.error.issues[0]?.message ?? "invalid"}`);
  for (const f of files) {
    mkdirSync(dirname(join(staging, f.path)), { recursive: true });
    writeFileSync(join(staging, f.path), f.content);
  }
  writeFileSync(join(staging, TABULAR_CSVW_FILENAME), `${JSON.stringify(record, null, 2)}\n`);
  recordExtraction(staging, "tables", { state: "found", count: n, tool: TOOL, ...v, at, note: `drafts${extra ? `; ${extra}` : ""}` });
  return { state: "found", detail: `${n} table(s) written as drafts` };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const staging = arg("--staging");
  const library = arg("--library");
  const pdf = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--staging" && argv[i - 1] !== "--library").pop();
  if (!staging || !pdf || !existsSync(staging)) {
    console.error("usage: pdf-tables-csvw.ts --staging <entry> [--library <library root>] FILE.pdf");
    process.exit(1);
  }
  try {
    const out = runTableArm(staging, pdf, library);
    console.log(`  tables: ${out.state} — ${out.detail}`);
  } catch (e) {
    // Guarded to the last: the arm must not stop the ingest. The record may
    // not have been written, which `extraction.json` then shows as
    // `not-extracted` for tables — the true state.
    console.error(`  tables: not extracted — ${e instanceof Error ? e.message : String(e)}`);
  }
  process.exit(0);
}
