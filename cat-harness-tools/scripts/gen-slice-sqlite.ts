#!/usr/bin/env bun
/**
 * Build a KG slice as ONE SQLite file a browser opens without parsing it,
 * using the official SQLite WASM build with an OPFS VFS.
 *
 * The contract is `skills/kg/kg-core/kg-export.md` §"Per-slice SQLite — a
 * named subgraph as one file a browser mounts". The browser half is
 * `docs/assets/js/slice-sqlite.js`, and the one search page is
 * `docs/slices/search.html?slice=<name>`. The procedure is the BPMN process
 * `processes/kg/slice-sqlite-publish.bpmn`, and the Tool node is
 * `slice-sqlite` in `tools/index.ts`.
 *
 * ## One builder, one definition per slice
 *
 * Every slice is a {@link SliceDef} in {@link SLICES}: its DDL, its stored
 * tables with the order their rows go in, its one FTS5 index, where its
 * payloads live, how the search page shows a result, and a `load` that turns
 * the source into rows. The engine — build, `VACUUM INTO`, digest, manifest,
 * `--check` — knows nothing about any slice. Adding a slice is adding a
 * definition.
 *
 * | slice | source | heavy field → payload |
 * |---|---|---|
 * | `beans` | `beans/defs/` via `readBeans` | the bean file, written at deploy |
 * | `todos` | `docs/assets/todos/index.json` | the todo's source file, written at deploy |
 * | `library` | `docs/assets/library/index.json` + `entries/<id>.json` | the published entry JSON, written at deploy |
 * | `kg` | the whole-repo KG export (`buildExport`) | the KG's own committed payloads (`docs/payload/`) |
 *
 * ## What it writes
 *
 * - `<out>/<slice>.<sha256>.sqlite3`: the skeleton — rows, edges, a
 *   contentless FTS5 — at a CONTENT-ADDRESSED name.
 * - `<out>/<slice>.sqlite3.json`: the manifest (`folio-slice-sqlite/v1`), at a
 *   FIXED name. Its `file` names the database; it carries the file's `sha256`
 *   and `bytes`, which the client verifies the download against and keys its
 *   OPFS copy by; per-table row counts; the schema and SQLite versions; a
 *   `contentDigest` over the ROWS; and the `search` block the generic page
 *   reads.
 * - `<out>/index.json`: the list of slices in `<out>`, for the search page.
 * - With `--payload-out <dir>`: every deploy-written payload of the slices
 *   built, at `<dir>/<hex>` plus its `<hex>.json` sidecar, written by
 *   `gen-subgraph-jsonld`'s own `renderPayloadFiles`.
 *
 * ## The database is content-addressed; the manifest is not
 *
 * Behind a CDN, a fixed database name lets a client get a fresh manifest and
 * a stale database. Named by its sha256, a manifest always names bytes that
 * hash to what it promises, or a 404 the client reports.
 *
 * The scheme is `assets/slices/<slice>.<full sha256 hex>.sqlite3`, not
 * `payload/sha256/<hex>`: a slice database is derived, SQLite-version
 * dependent and linked from no node, so the payload orphan audit
 * (`auditPayloadTree`) would reject it. `file` stays a SIBLING name resolved
 * against the manifest's URL, and the FULL hex lets a reader check the name
 * against `sha256`. Like a payload it is **immutable, not kept forever**.
 *
 * **The manifest stays at the fixed `<slice>.sqlite3.json`**, so the page
 * finds it by slice name. It must be served with a SHORT TTL. The client
 * fetches it with `no-store`, which bypasses the BROWSER cache only; a CDN
 * keeps it for the host's TTL, which bounds availability, not correctness.
 *
 * **Rotation.** A build writes ONLY the current file, and removes any other
 * `<slice>.<hex>.sqlite3` (and the legacy `<slice>.sqlite3`) of the SAME slice
 * from `--out` — {@link rotateSliceFiles}. `--out` is a build directory this
 * tool owns (`_site/assets/slices/` at deploy; a gitignored one locally).
 *
 * ## Bodies are payloads, not columns
 *
 * Every slice's FTS5 is CONTENTLESS (`content=''`), which keeps the file a
 * fraction of the size: it indexes the text without storing it, and keeps
 * full detail, because positions are what make a phrase query work. A row
 * carries `payload_sha256`; the client fetches `<site>/payload/sha256/<hex>`
 * when a result is opened.
 *
 * ## Deterministic, proved rather than claimed
 *
 * Rows go in in each table's declared order, the page size is fixed, nothing
 * time-varying is written, and the published file is `VACUUM INTO` a fresh
 * path. `--check` builds twice and fails unless the two files have one sha256.
 * The file's sha256 is stable only for one SQLite version, so the manifest also
 * carries `contentDigest`, a sha256 over the canonical row dump, which stays
 * equal across a Bun upgrade.
 *
 * ## Neither the binaries nor their deploy payloads are committed
 *
 * Their sources change on most merges, so a committed binary would go stale.
 * The deploy (`docs-site.yml`, `feature-staging.yml`) builds every slice from
 * the tree it publishes, straight into `_site/`.
 *
 * What `--check` gates, per slice:
 *
 *   1. the builder runs, and two builds give one sha256;
 *   2. the `contentDigest` read back from the DATABASE equals the digest
 *      computed from the source rows without SQLite — a dropped, truncated or
 *      mis-keyed row fails (`kg-export` §"A partial graph must never pass for
 *      a whole one");
 *   3. FTS5 answers a phrase query for a known row;
 *   4. the payloads pass `auditPayloadTree`: deploy payloads as written, and
 *      the `kg` slice's pointers against the committed payload tree.
 *
 * @module cat-harness/scripts/gen-slice-sqlite
 * @covers bean-defs
 */
import { Database } from "bun:sqlite";
import { mintsFragments, subjectBase, subjectPathOf } from "./lib/subject-iri.ts";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { readDeclaration, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { LibraryEntrySchema, LibraryIndexSchema } from "../schemas/ui/site-indexes.ts";
import { PAYLOAD_MEDIA_TYPES, PAYLOAD_PATH, type PayloadLink } from "../schemas/kg/subgraph-manifest.ts";
import { TodoIndexSchema } from "../schemas/sdlc/todo-index.ts";
import { declaredBlockEdges, readBeans, resolveBeanDefs, type BeanNode } from "./beans.ts";
import { auditPayloadTree, payloadOutDir, planPayloads, renderPayloadFiles, type PayloadEntry, type PayloadPlan } from "./gen-subgraph-jsonld.ts";
import { overlayDirs, overlayPath, readPathAt, writePathAt } from "./lib/layer-output.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { nodeKind } from "../schemas/kg/node-kind.ts";
import { z } from "zod";
import { StoreAbsentError } from "./lib/bean-store-absent.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
/** Where a LOCAL build lands — gitignored. The deploy writes into `_site/` instead. */
export const SLICES_DIR = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT), "assets", "slices");
export const MANIFEST_SCHEMA = "folio-slice-sqlite/v1";
export const SLICE_INDEX_SCHEMA = "folio-slice-index/v1";
/** Bumped whenever a table, column or index changes. Also `PRAGMA user_version`. */
export const SCHEMA_VERSION = 2;
/** Fixed, so two builds cannot differ by a default. 4096 is SQLite's default. */
export const PAGE_SIZE = 4096;
/**
 * The size above which a slice is not shipped without a decision (bean `q8ar`,
 * coordinator 2026-10-03: "above about 5 MB, stop that slice and report").
 * REPORTED by a build, not gated: the beans slice grows with every session,
 * and a gate would turn every open PR red the day it crossed the line, for a
 * change nobody made. The measurement in the manifest is what a person reads.
 * Raised from 5 MB to 10 MB by the owner on 2026-10-24 ("Raise to 10 MB"),
 * when the whole-repo KG slice reached 8.3 MB (issue #733). Shrinking that
 * slice is bean `0exf`, and once 0exf shrank it the owner set 6 MB on
 * 2026-10-29 (card option "B. 6 MB").
 */
export const SIZE_BUDGET_BYTES = 6 * 1024 * 1024;

/** The repository root a source `file` is relative to. */
export const REPO_ROOT = repoRootFor(INSTANCE_ROOT);

// ── The engine's types ─────────────────────────────────────────────────────

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

/** A stored table: its columns in SELECT order, and the order its rows are dumped in. */
export interface SliceTable {
  readonly name: string;
  readonly columns: readonly string[];
  /** `rowid` for a rowid table, else the primary key's columns. */
  readonly orderBy: string;
}

/**
 * How the generic search page shows this slice. Carried in the manifest, so
 * the page has no per-slice code. Every query is built from these pieces and
 * run against a file the manifest's sha256 already vouched for.
 */
export interface SliceSearch {
  /** The noun a result is: "bean", "todo", "block", "node". */
  readonly noun: string;
  readonly title: string;
  readonly placeholder: string;
  /**
   * `SELECT … FROM <table> <alias>` returning `key`, `title`, `meta`,
   * `payload`, and optionally `part` (where in the payload the result is) and
   * `snippet` (stored text shown inline).
   */
  readonly select: string;
  readonly alias: string;
  /** The column a typed query degrades to a `LIKE` over when FTS5 syntax fails. */
  readonly like: string;
  /**
   * What the payload is, so the page knows how to show it:
   * `markdown` (front matter stripped), or `library-entry` (a
   * `folio-library-entry/v1` document; the block whose id is `part`).
   */
  readonly body: "markdown" | "library-entry";
}

/** What `load` turns a source into. Every row list is already in its table's `orderBy` order. */
export interface SliceData {
  readonly rows: Readonly<Record<string, Row[]>>;
  /** One entry per row of `fts.rowsOf`, by position: the text of each FTS column. */
  readonly fts: readonly SqlValue[][];
  /** Every payload the slice's rows point at, and each pointer. */
  readonly payloads: PayloadPlan;
  /** Defects in the SOURCE, reported in the manifest rather than hidden. */
  readonly findings: readonly string[];
  /** A row a phrase query must find, for `--check`. */
  readonly probe?: { readonly phrase: string; readonly column: string; readonly value: string };
  /** Extra `meta` rows (no timestamp, no commit — either would make two builds differ). */
  readonly meta?: Readonly<Record<string, string>>;
}

export interface SliceDef {
  readonly slice: string;
  readonly source: { readonly graph: string; readonly path: string };
  readonly ddl: readonly string[];
  readonly tables: readonly SliceTable[];
  readonly fts: { readonly table: string; readonly rowsOf: string; readonly columns: readonly string[] };
  /** Tables and views whose row counts go in the manifest. */
  readonly counts: readonly string[];
  /** A query returning `id` for every key more than one row declares, or absent. */
  readonly duplicateIdsSql?: string;
  /**
   * Where the payloads come from. `deploy`: written by `--payload-out` beside
   * the slice, never committed. `published`: already in the committed payload
   * tree, which `--check` audits the pointers against.
   */
  readonly payloads: "deploy" | "published";
  readonly search: SliceSearch;
  /** `null` is could-not-determine (no source), never an empty slice. */
  load(root: string): Promise<SliceData | null>;
  /**
   * A work-plan store (beans, todos) that was REACHED and holds no entries
   * yet: a new folio's plan. Such a slice is not applicable, like an absent
   * store, rather than a refusal: nothing is built and nothing is credited
   * as clean. A content slice (library, kg) leaves this unset, so an empty
   * one still refuses.
   */
  readonly emptyStoreNotApplicable?: true;
}

/**
 * Why this slice is not applicable because its store was reached and is
 * empty, or `null` when it has rows or is not a store slice. Only a loaded
 * source reaches here: an unmounted store has already thrown.
 */
export function emptyStoreReason(def: SliceDef, data: SliceData): string | null {
  if (!def.emptyStoreNotApplicable) return null;
  if ((data.rows[def.fts.rowsOf] ?? []).length > 0) return null;
  return `the store at ${def.source.path} was reached and holds no ${def.fts.rowsOf} yet, so there is nothing to slice`;
}

export interface SliceManifest {
  $schema: typeof MANIFEST_SCHEMA;
  slice: string;
  file: string;
  schemaVersion: number;
  sha256: string;
  bytes: number;
  contentDigest: string;
  sqliteVersion: string;
  pageSize: number;
  fts5: { table: string; rowsOf: string; columns: string[]; contentless: true; detail: "full" };
  /** Relative to the SITE ROOT: where a row's `payload_sha256` resolves. */
  payloadPath: string;
  payloads: { mode: "deploy" | "published"; count: number; bytes: number };
  rows: Record<string, number>;
  /** Keys that more than one source row declares. A source defect, reported rather than hidden. */
  duplicateIds: string[];
  /** Other source defects the slice met, in words. */
  findings: string[];
  /** True when `bytes` exceeds {@link SIZE_BUDGET_BYTES}. */
  overBudget: boolean;
  search: SliceSearch;
  source: { graph: string; path: string };
}

const sha256 = (b: Uint8Array | string): string => createHash("sha256").update(b).digest("hex");
const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
const posix = (p: string) => p.split("\\").join("/");

/** The layer's declared `canonicalUrl` — the base a payload IRI is minted on. */
export function canonicalBase(root: string = INSTANCE_ROOT): string {
  const url = readDeclaration(root)?.canonicalUrl;
  if (!url) throw new Error(`gen-slice-sqlite: ${root} declares no canonicalUrl to mint payload IRIs on`);
  return url;
}

/** An empty plan, to which {@link addPayload} adds. */
export function emptyPlan(): PayloadPlan {
  return { payloads: new Map(), links: new Map(), problems: [] };
}

/** Add one payload to a plan, keyed by `ref`. Identical bytes are one payload. */
export function addPayload(plan: PayloadPlan, ref: string, bytes: Buffer, mediaType: string, baseUrl: string): PayloadLink {
  const hex = sha256(bytes);
  const e: PayloadEntry = plan.payloads.get(hex) ?? { sha256: hex, bytes, mediaType, referencedBy: [] };
  if (!e.referencedBy.includes(ref)) e.referencedBy.push(ref);
  e.referencedBy.sort();
  plan.payloads.set(hex, e);
  const link: PayloadLink = { "@id": `${baseUrl.replace(/\/+$/, "")}/${PAYLOAD_PATH}/${hex}`, sha256: hex, bytes: bytes.length };
  plan.links.set(ref, link);
  return link;
}

/** Write a plan's payloads (body + sidecar) into `dir`; returns how many. */
export function writePayloads(plan: PayloadPlan, dir: string): number {
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of renderPayloadFiles(plan, dir)) writeFileSync(path, content);
  return plan.payloads.size;
}

// ── The engine ─────────────────────────────────────────────────────────────

function metaRows(def: SliceDef, data: SliceData): { key: string; value: string }[] {
  const m: Record<string, string> = {
    schema: MANIFEST_SCHEMA,
    schema_version: String(SCHEMA_VERSION),
    slice: def.slice,
    source_graph: def.source.graph,
    ...(data.meta ?? {}),
  };
  return Object.keys(m).sort().map((key) => ({ key, value: m[key]! }));
}

/** A row in its table's column order, which is the order `SELECT` returns. */
function ordered(t: SliceTable, r: Row): Row {
  const out: Row = {};
  for (const c of t.columns) out[c] = r[c] ?? null;
  return out;
}

/**
 * The digest the slice SHOULD have, computed from the source rows without
 * touching SQLite. `--check` compares it to the one read back from the file.
 */
export function expectedContentDigest(def: SliceDef, data: SliceData): string {
  const rows: unknown[] = [...metaRows(def, data)];
  for (const t of def.tables) for (const r of data.rows[t.name] ?? []) rows.push(ordered(t, r));
  return sha256(rows.map((r) => JSON.stringify(r)).join("\n"));
}

/** The same digest, read back from a built database. */
export function databaseContentDigest(db: Database, def: SliceDef): string {
  const rows: unknown[] = [...db.query(`SELECT key, value FROM meta ORDER BY key`).all()];
  for (const t of def.tables) {
    rows.push(...db.query(`SELECT ${t.columns.join(", ")} FROM ${t.name} ORDER BY ${t.orderBy}`).all());
  }
  return sha256(rows.map((r) => JSON.stringify(r)).join("\n"));
}

/**
 * Build one slice at `outFile` and return its manifest. The database is
 * written to a scratch file first and then `VACUUM INTO` the destination, so
 * the published bytes carry no build history.
 */
export function buildSlice(def: SliceDef, data: SliceData, outDir: string): SliceManifest {
  // input-site: inert #4b5268b6 — a scratch dir for the build, removed in the finally below before this returns
  const scratchDir = mkdtempSync(join(tmpdir(), "slice-sqlite-"));
  const scratch = join(scratchDir, "build.sqlite3");
  try {
    const db = new Database(scratch, { create: true });
    db.exec(`PRAGMA page_size = ${PAGE_SIZE}`);
    db.exec(`PRAGMA journal_mode = OFF`);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    db.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID`);
    for (const ddl of def.ddl) db.exec(ddl);

    const ftsRows = data.fts;
    const ftsOf = data.rows[def.fts.rowsOf] ?? [];
    if (ftsRows.length !== ftsOf.length) {
      throw new Error(`slice ${def.slice}: ${ftsRows.length} FTS row(s) for ${ftsOf.length} ${def.fts.rowsOf} row(s)`);
    }
    const insertFts = db.prepare(
      `INSERT INTO ${def.fts.table} (rowid, ${def.fts.columns.join(", ")}) VALUES (?, ${def.fts.columns.map(() => "?").join(", ")})`,
    );
    const insertMeta = db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)`);
    db.transaction(() => {
      for (const t of def.tables) {
        const ins = db.prepare(`INSERT INTO ${t.name} (${t.columns.join(", ")}) VALUES (${t.columns.map(() => "?").join(", ")})`);
        const rows = data.rows[t.name] ?? [];
        rows.forEach((r, i) => {
          const { lastInsertRowid } = ins.run(...t.columns.map((c) => r[c] ?? null));
          if (t.name === def.fts.rowsOf) insertFts.run(lastInsertRowid, ...ftsRows[i]!.map((v) => v ?? ""));
        });
      }
      for (const { key, value } of metaRows(def, data)) insertMeta.run(key, value);
    })();
    db.exec(`INSERT INTO ${def.fts.table} (${def.fts.table}) VALUES ('optimize')`);
    db.exec(`ANALYZE`);

    const rows: Record<string, number> = {};
    for (const t of def.counts) rows[t] = (db.query(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n;
    const duplicateIds = def.duplicateIdsSql
      ? (db.query(def.duplicateIdsSql).all() as { id: string }[]).map((r) => r.id)
      : [];
    const sqliteVersion = (db.query(`SELECT sqlite_version() AS v`).get() as { v: string }).v;

    mkdirSync(outDir, { recursive: true });
    // `.tmp-` never matches SLICE_FILE, so an interrupted build is not a slice.
    const tmpOut = join(outDir, `${def.slice}.tmp-${process.pid}.sqlite3`);
    rmSync(tmpOut, { force: true });
    db.exec(`VACUUM INTO '${tmpOut.replace(/'/g, "''")}'`);
    db.close();

    // The digest is read back from the PUBLISHED bytes, so it describes what shipped.
    const shipped = new Database(tmpOut, { readonly: true });
    const contentDigest = databaseContentDigest(shipped, def);
    shipped.close();

    const bytes = readFileSync(tmpOut);
    const hex = sha256(bytes);
    // The name is the hash, so it is fixed only once the bytes are.
    const file = sliceFileName(def.slice, hex);
    renameSync(tmpOut, join(outDir, file));
    let payloadBytes = 0;
    for (const e of data.payloads.payloads.values()) payloadBytes += e.bytes.length;
    return {
      $schema: MANIFEST_SCHEMA,
      slice: def.slice,
      file,
      schemaVersion: SCHEMA_VERSION,
      sha256: hex,
      bytes: bytes.length,
      contentDigest,
      sqliteVersion,
      pageSize: PAGE_SIZE,
      fts5: { table: def.fts.table, rowsOf: def.fts.rowsOf, columns: [...def.fts.columns], contentless: true, detail: "full" },
      payloadPath: `${PAYLOAD_PATH}/`,
      payloads: { mode: def.payloads, count: data.payloads.payloads.size, bytes: payloadBytes },
      rows,
      duplicateIds,
      findings: [...data.findings],
      overBudget: bytes.length > SIZE_BUDGET_BYTES,
      search: def.search,
      source: { ...def.source },
    };
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

/** The content-addressed name a slice's database is published under: `<slice>.<sha256 hex>.sqlite3`. */
export function sliceFileName(slice: string, hex: string): string {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`slice ${slice}: ${hex} is not a sha256 hex digest`);
  return `${slice}.${hex}.sqlite3`;
}

/** Matches a published slice database name, capturing the slice and its hex. */
export const SLICE_FILE = /^([a-z][a-z0-9-]*)\.([0-9a-f]{64})\.sqlite3$/;

/** The manifest's FIXED name — the one file that says which build is current. */
export const manifestFileName = (slice: string): string => `${slice}.sqlite3.json`;

/**
 * Remove every database of `slice` in `outDir` other than `keep`: earlier
 * content-addressed builds, and the pre-`wixl` fixed `<slice>.sqlite3`.
 * Other slices' files, the manifests and anything unrecognised are not
 * touched. Returns the names removed, so the build can say what went.
 */
export function rotateSliceFiles(outDir: string, slice: string, keep: string): string[] {
  if (!existsSync(outDir)) return [];
  const removed: string[] = [];
  for (const f of readdirSync(outDir).sort()) {
    if (f === keep) continue;
    const m = SLICE_FILE.exec(f);
    if ((m && m[1] === slice) || f === `${slice}.sqlite3`) {
      rmSync(join(outDir, f), { force: true });
      removed.push(f);
    }
  }
  return removed;
}

export function manifestText(m: SliceManifest): string {
  return JSON.stringify(m, null, 2) + "\n";
}

/** The problems `--check` reports for one slice; empty means green. */
export function checkSlice(def: SliceDef, data: SliceData, opts: { publishedPayloadDir?: string } = {}): string[] {
  const problems: string[] = [];
  // input-site: inert #fad5a4d5 — a temp dir for the two check builds, removed in the finally below before this returns
  const dir = mkdtempSync(join(tmpdir(), "slice-check-"));
  try {
    const a = buildSlice(def, data, join(dir, "a"));
    const b = buildSlice(def, data, join(dir, "b"));
    if (a.sha256 !== b.sha256) problems.push(`not deterministic: two builds gave ${a.sha256} and ${b.sha256}`);
    if (a.file !== sliceFileName(def.slice, a.sha256) || !existsSync(join(dir, "a", a.file))) {
      problems.push(`the manifest names ${a.file}, which is not the content-addressed file the build wrote`);
    }
    const expected = expectedContentDigest(def, data);
    if (a.contentDigest !== expected) {
      problems.push(`the database's row digest ${a.contentDigest} ≠ the source's ${expected} — the slice is not the source`);
    }
    for (const t of def.tables) {
      const want = (data.rows[t.name] ?? []).length;
      if (a.rows[t.name] !== undefined && a.rows[t.name] !== want) problems.push(`${t.name} rows ${a.rows[t.name]} ≠ ${want} read`);
    }
    if (!data.probe) problems.push(`no known row to probe FTS5 with — an empty source is not a green slice`);
    else {
      // A PHRASE query, which only full-detail FTS5 can answer.
      const db = new Database(join(dir, "a", a.file), { readonly: true });
      const { phrase, column, value } = data.probe;
      const hit = db
        .query(`SELECT 1 FROM ${def.fts.table} f JOIN ${def.fts.rowsOf} t ON t.rowid = f.rowid WHERE ${def.fts.table} MATCH ? AND t.${column} = ?`)
        .get(`"${phrase}"`, value);
      db.close();
      if (!hit) problems.push(`FTS5 did not find ${column}=${value} by the phrase "${phrase}"`);
    }
    for (const p of data.payloads.problems) problems.push(`payload: ${p}`);
    if (def.payloads === "deploy") {
      const payloadDir = join(dir, "payload");
      writePayloads(data.payloads, payloadDir);
      problems.push(...auditPayloadTree(payloadDir, data.payloads.links));
    } else {
      const pdir = opts.publishedPayloadDir ?? join(INSTANCE_ROOT, payloadOutDir(INSTANCE_ROOT));
      for (const [ref, link] of data.payloads.links) {
        if (!existsSync(overlayPath(join(pdir, link.sha256)))) problems.push(`${ref}: points at payload ${link.sha256}, which the published tree does not hold`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return problems;
}

// ── Helpers the definitions share ──────────────────────────────────────────

/** The first two-long-word phrase in `text`, for a probe. */
export function phraseIn(text: string, min = 4): string | undefined {
  return text.match(new RegExp(`[A-Za-z]{${min},}\\s+[A-Za-z]{${min},}`))?.[0];
}

const FTS = (table: string, columns: readonly string[]) =>
  `CREATE VIRTUAL TABLE ${table} USING fts5 (${columns.join(", ")}, content = '', tokenize = 'unicode61 remove_diacritics 2')`;

// ── Slice: beans ───────────────────────────────────────────────────────────

const BEAN_COLS = [
  "id", "title", "status", "type", "priority", "parent", "created_at", "updated_at",
  "file", "tags", "payload_sha256", "payload_bytes",
] as const;

/** Every edge, from both declarations, deduplicated and sorted. */
/**
 * Every edge, from both declarations, deduplicated and sorted — one row per
 * declaration, which is `bean_block`'s shape. The normalisation itself lives
 * in `beans.ts` (`declaredBlockEdges`, bean `vhqq`) so this slice and the
 * published beans index read ONE answer to "what is an edge".
 */
export const beanEdges = declaredBlockEdges;

/** The beans slice's data from bean nodes. Exported so a test can pass fixtures. */
export function beansData(beans: BeanNode[], root: string = REPO_ROOT, baseUrl = canonicalBase()): SliceData {
  // `file` is the key, NOT `id`: two bean files have declared one id
  // (`folio-assistant-t3n8`, 2026-10-03), and keeping only one would publish
  // a partial slice as a whole one. Both rows go in; `duplicateIds` says so.
  const sorted = [...beans].sort((a, b) => cmp(a.id, b.id) || cmp(a.file, b.file));
  const plan = emptyPlan();
  const rows: Row[] = [];
  const fts: SqlValue[][] = [];
  for (const b of sorted) {
    const file = posix(b.file);
    // The payload is the source FILE verbatim, front matter included (kg-export §"Payloads").
    const link = addPayload(plan, file, readFileSync(join(root, b.file)), PAYLOAD_MEDIA_TYPES.md!, baseUrl);
    rows.push({
      id: b.id, title: b.title, status: b.status, type: b.type, priority: b.priority,
      parent: b.parent || null, created_at: b.createdAt || null, updated_at: b.updatedAt || null,
      file, tags: JSON.stringify(b.tags ?? []), payload_sha256: link.sha256, payload_bytes: link.bytes,
    });
    fts.push([b.title, b.body]);
  }
  const ids = sorted.map((b) => b.id);
  const known = sorted.find((b, i) => ids.indexOf(b.id) === i && ids.lastIndexOf(b.id) === i && phraseIn(b.title));
  return {
    rows: { beans: rows, bean_block: beanEdges(sorted) },
    fts,
    payloads: plan,
    findings: [],
    probe: known ? { phrase: phraseIn(known.title)!, column: "file", value: posix(known.file) } : undefined,
  };
}

/**
 * The bean store, read from its declaration (`beans/beans.json`), never spelled
 * — for the slice's `source` LABEL only.
 *
 * Asked without throwing, so that importing this module for another slice
 * (todos, library, kg), or for its pure functions, does not need the store
 * mounted: an import-time throw made every one of those fail wherever the
 * bean branch is not mounted, including cat-harness standing alone. The
 * refusal is not lost — reading the store still goes through `readBeans`,
 * which throws with the remedy when the store is unreachable.
 */
const BEAN_DEFS = resolveBeanDefs(REPO_ROOT);

export const BEANS_SLICE: SliceDef = {
  slice: "beans",
  emptyStoreNotApplicable: true,
  source: {
    graph: "bean-defs",
    path: BEAN_DEFS.dir
      ? `${posix(relative(REPO_ROOT, BEAN_DEFS.dir))}/`
      : BEAN_DEFS.unreachable
        ? "(bean store not mounted)"
        : "(no bean-defs declared)",
  },
  ddl: [
    // A rowid table, because FTS5 addresses rows by rowid; rows go in (id, file) order.
    `CREATE TABLE beans (
       id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, type TEXT NOT NULL,
       priority TEXT NOT NULL, parent TEXT, created_at TEXT, updated_at TEXT,
       file TEXT NOT NULL UNIQUE,
       tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
       payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64),
       payload_bytes INTEGER NOT NULL
     )`,
    `CREATE INDEX beans_id ON beans (id)`,
    `CREATE INDEX beans_status_type ON beans (status, type)`,
    `CREATE INDEX beans_parent ON beans (parent) WHERE parent IS NOT NULL`,
    `CREATE INDEX beans_updated ON beans (updated_at)`,
    // ONE edge table, each row saying which side declared it; the two
    // directions are views, because two stored tables for one relation are
    // two answers that can disagree.
    `CREATE TABLE bean_block (
       blocker TEXT NOT NULL, blocked TEXT NOT NULL,
       declared_on TEXT NOT NULL CHECK (declared_on IN ('blocking', 'blocked_by')),
       PRIMARY KEY (blocker, blocked, declared_on)
     ) WITHOUT ROWID`,
    `CREATE INDEX bean_block_blocked ON bean_block (blocked, blocker)`,
    `CREATE VIEW blocking (id, target) AS SELECT DISTINCT blocker, blocked FROM bean_block`,
    `CREATE VIEW blocked_by (id, blocker) AS SELECT DISTINCT blocked, blocker FROM bean_block`,
    `CREATE VIEW bean_tags (id, tag) AS SELECT beans.id, j.value FROM beans, json_each(beans.tags) AS j`,
    FTS("beans_fts", ["title", "body"]),
  ],
  tables: [
    { name: "beans", columns: BEAN_COLS, orderBy: "rowid" },
    { name: "bean_block", columns: ["blocker", "blocked", "declared_on"], orderBy: "blocker, blocked, declared_on" },
  ],
  fts: { table: "beans_fts", rowsOf: "beans", columns: ["title", "body"] },
  counts: ["beans", "bean_block", "blocking", "blocked_by", "bean_tags"],
  duplicateIdsSql: `SELECT id FROM beans GROUP BY id HAVING count(*) > 1 ORDER BY id`,
  payloads: "deploy",
  search: {
    noun: "bean",
    title: "Beans — the work plan",
    placeholder: 'e.g. "named subgraph" or opfs',
    select: "SELECT b.id AS key, b.title AS title, b.id || ' · ' || b.status || ' · ' || b.type AS meta, b.payload_sha256 AS payload FROM beans b",
    alias: "b",
    like: "b.title",
    body: "markdown",
  },
  async load(root) {
    const beans = readBeans(root);
    return beans === null ? null : beansData(beans, root);
  },
};

// ── Slice: todos ───────────────────────────────────────────────────────────

/** The published todo index, as `gen-docs-pages` writes it. */
export const TODO_INDEX = join(siteDirFor(INSTANCE_ROOT), "assets", "todos", "index.json");

/**
 * The todos slice's data from the published index plus each todo's SOURCE file
 * (its payload, verbatim). `sources` maps a todo id to its repo-relative file.
 */
export function todosData(
  indexJson: unknown,
  sources: ReadonlyMap<string, string>,
  root: string = REPO_ROOT,
  baseUrl = canonicalBase(),
): SliceData {
  const index = TodoIndexSchema.parse(indexJson);
  const items = [...index.items].sort((a, b) => cmp(a.id, b.id));
  const plan = emptyPlan();
  const findings: string[] = [];
  const todos: Row[] = [];
  const rels: Row[] = [];
  const fts: SqlValue[][] = [];
  for (const t of items) {
    const file = sources.get(t.id);
    let link: PayloadLink | undefined;
    if (file && existsSync(join(root, file))) link = addPayload(plan, file, readFileSync(join(root, file)), PAYLOAD_MEDIA_TYPES.md!, baseUrl);
    else findings.push(`todo ${t.id}: the index publishes it but no source file was found — row kept, no payload`);
    todos.push({
      id: t.id, summary: t.summary, status: t.status, priority: t.priority, origin: t.origin ?? null,
      created_at: t.createdAt, target_label: t.targetLabel ?? null, target_page: t.target?.page ?? null,
      theme: t.theme ?? null, file: file ?? null, view_href: t.viewHref ?? null,
      tags: JSON.stringify(t.tags), payload_sha256: link?.sha256 ?? null, payload_bytes: link?.bytes ?? null,
    });
    fts.push([t.summary, t.comment]);
    const seen = new Set<string>();
    for (const r of t.relations) {
      const k = `${r.axis}\u0000${r.label}`;
      if (seen.has(k)) continue;
      seen.add(k);
      rels.push({ todo: t.id, axis: r.axis, label: r.label, href: r.href ?? null });
    }
  }
  rels.sort((a, b) => cmp(String(a.todo), String(b.todo)) || cmp(String(a.axis), String(b.axis)) || cmp(String(a.label), String(b.label)));
  const known = items.find((t) => phraseIn(t.summary));
  return {
    rows: { todos, todo_relation: rels },
    fts,
    payloads: plan,
    findings,
    probe: known ? { phrase: phraseIn(known.summary)!, column: "id", value: known.id } : undefined,
  };
}

export const TODOS_SLICE: SliceDef = {
  slice: "todos",
  emptyStoreNotApplicable: true,
  source: { graph: "todos", path: posix(join("cat-harness", TODO_INDEX)) },
  ddl: [
    `CREATE TABLE todos (
       id TEXT NOT NULL UNIQUE, summary TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL,
       origin TEXT, created_at TEXT NOT NULL, target_label TEXT, target_page TEXT, theme TEXT,
       file TEXT, view_href TEXT,
       tags TEXT NOT NULL CHECK (json_valid(tags)),
       payload_sha256 TEXT CHECK (payload_sha256 IS NULL OR length(payload_sha256) = 64),
       payload_bytes INTEGER
     )`,
    `CREATE INDEX todos_status ON todos (status, priority)`,
    `CREATE INDEX todos_target ON todos (target_page) WHERE target_page IS NOT NULL`,
    // A todo's relations are declared on the todo, one side only, so there is
    // no `declared_on`: a column that could hold one value is not a fact.
    `CREATE TABLE todo_relation (
       todo TEXT NOT NULL, axis TEXT NOT NULL, label TEXT NOT NULL, href TEXT,
       PRIMARY KEY (todo, axis, label)
     ) WITHOUT ROWID`,
    `CREATE INDEX todo_relation_label ON todo_relation (axis, label)`,
    FTS("todos_fts", ["summary", "comment"]),
  ],
  tables: [
    {
      name: "todos",
      columns: ["id", "summary", "status", "priority", "origin", "created_at", "target_label", "target_page", "theme", "file", "view_href", "tags", "payload_sha256", "payload_bytes"],
      orderBy: "rowid",
    },
    { name: "todo_relation", columns: ["todo", "axis", "label", "href"], orderBy: "todo, axis, label" },
  ],
  fts: { table: "todos_fts", rowsOf: "todos", columns: ["summary", "comment"] },
  counts: ["todos", "todo_relation"],
  payloads: "deploy",
  search: {
    noun: "todo",
    title: "Todos — items for a person",
    placeholder: "e.g. page or roles",
    select: "SELECT t.id AS key, t.summary AS title, t.status || ' · ' || t.priority || coalesce(' · ' || t.target_label, '') AS meta, t.payload_sha256 AS payload FROM todos t",
    alias: "t",
    like: "t.summary",
    body: "markdown",
  },
  async load(root) {
    // Read through the layer overlay: `docs:pages` writes a mounted layer's
    // todo index at its output root (bean `cat-tools-sm8r`, item 4).
    const p = readPathAt(root, join(INSTANCE_ROOT, TODO_INDEX));
    if (!existsSync(p)) return null;
    // The todo reader is imported lazily: it resolves its graph at import.
    const { readTodoFiles } = await import("./todos.ts");
    const sources = new Map<string, string>();
    // `readTodoFiles` reports paths relative to THIS layer (`../todos/…`),
    // so they are resolved here before being made repo-relative (bean `pb04`).
    for (const f of readTodoFiles()) sources.set(f.todo.id, posix(relative(root, resolve(INSTANCE_ROOT, f.path))));
    return todosData(JSON.parse(readFileSync(p, "utf-8")), sources, root);
  },
};

// ── Slice: library ─────────────────────────────────────────────────────────

export const LIBRARY_DIR = join(siteDirFor(INSTANCE_ROOT), "assets", "library");
/** A published entry is JSON; it is not in `PAYLOAD_MEDIA_TYPES`, which types KG pointer files. */
export const JSON_MEDIA_TYPE = "application/json";

/**
 * The library slice's data from the published index and the per-entry graph.
 *
 * The payload of an entry — and of every one of its blocks — is the PUBLISHED
 * `entries/<id>.json`, verbatim. Not the section files under `library/`: a
 * withheld entry (bean `cw35`) publishes no verbatim text, and the published
 * entry is what already applied that rule. One payload per entry rather than
 * per block, because 3,600 blocks would be 7,200 files per deploy for bytes the
 * entry file already holds.
 */
export function libraryData(
  indexJson: unknown,
  entryJson: ReadonlyMap<string, Buffer>,
  baseUrl = canonicalBase(),
  entryPath = (id: string) => `entries/${id}.json`,
): SliceData {
  const index = LibraryIndexSchema.parse(indexJson);
  const entries = [...index.entries].sort((a, b) => cmp(a.id, b.id));
  const plan = emptyPlan();
  const findings: string[] = [];
  const eRows: Row[] = [];
  const bRows: Row[] = [];
  const refs: Row[] = [];
  const fts: SqlValue[][] = [];
  const indexed = new Set(entries.map((e) => e.id));
  for (const id of [...entryJson.keys()].sort()) {
    if (!indexed.has(id)) findings.push(`${entryPath(id)} is not in the library index — not sliced`);
  }
  for (const e of entries) {
    const bytes = entryJson.get(e.id);
    let link: PayloadLink | undefined;
    let blocks: { id: string; kind: string; title: string; pageStart: number | null; pageEnd: number | null; content: string | null; provenance: string; summary: { status: string; text?: string } | null }[] = [];
    if (bytes) {
      link = addPayload(plan, entryPath(e.id), bytes, JSON_MEDIA_TYPE, baseUrl);
      const parsed = LibraryEntrySchema.parse(JSON.parse(bytes.toString("utf-8")));
      if (parsed.id !== e.id) findings.push(`${entryPath(e.id)} declares id ${parsed.id}`);
      blocks = parsed.blocks;
    } else findings.push(`library entry ${e.id}: no ${entryPath(e.id)} — entry row kept, no blocks, no payload`);
    eRows.push({
      id: e.id, instance: e.instance, title: e.title, rung: e.rung, provenance: e.provenance,
      doi: e.doi || null, arxiv: e.arxiv || null, sections: e.sections, blocks: e.blocks, words: e.words,
      page_start: e.pageStart, page_end: e.pageEnd, withheld: e.withheld ?? null, view: e.view ?? null,
      payload_sha256: link?.sha256 ?? null, payload_bytes: link?.bytes ?? null,
    });
    // Blocks keep the entry's page order: `seq` is their position in the file.
    blocks.forEach((b, seq) => {
      bRows.push({
        id: b.id, entry: e.id, seq, kind: b.kind, title: b.title, page_start: b.pageStart, page_end: b.pageEnd,
        provenance: b.provenance, summary_status: b.summary?.status ?? null, has_text: b.content ? 1 : 0,
        payload_sha256: link?.sha256 ?? null,
      });
      fts.push([b.title, [b.content ?? "", b.summary?.text ?? ""].join("\n").trim(), e.title]);
    });
    for (const r of e.referencedBy ?? []) refs.push({ entry: e.id, kind: r.kind, instance: r.instance, from_path: r.from, count: r.count });
  }
  refs.sort((a, b) => cmp(String(a.entry), String(b.entry)) || cmp(String(a.from_path), String(b.from_path)) || cmp(String(a.kind), String(b.kind)));
  // The probe phrase comes from a block's TEXT, the column that is indexed and not stored.
  const k = fts.findIndex((t) => phraseIn(String(t[1])));
  return {
    rows: { entries: eRows, blocks: bRows, entry_ref: refs },
    fts,
    payloads: plan,
    findings,
    probe: k >= 0 ? { phrase: phraseIn(String(fts[k]![1]))!, column: "id", value: String(bRows[k]!.id) } : undefined,
  };
}

export const LIBRARY_SLICE: SliceDef = {
  slice: "library",
  source: { graph: "library", path: posix(join("cat-harness", LIBRARY_DIR, "index.json")) },
  ddl: [
    `CREATE TABLE entries (
       id TEXT NOT NULL UNIQUE, instance TEXT NOT NULL, title TEXT NOT NULL, rung TEXT NOT NULL,
       provenance TEXT NOT NULL, doi TEXT, arxiv TEXT, sections INTEGER, blocks INTEGER, words INTEGER,
       page_start INTEGER, page_end INTEGER, withheld TEXT, view TEXT,
       payload_sha256 TEXT CHECK (payload_sha256 IS NULL OR length(payload_sha256) = 64),
       payload_bytes INTEGER
     )`,
    `CREATE INDEX entries_instance ON entries (instance)`,
    // A rowid table, for FTS5. A block's text is indexed, not stored: its
    // bytes are in the entry payload, at the block whose id is `id`.
    `CREATE TABLE blocks (
       id TEXT NOT NULL UNIQUE, entry TEXT NOT NULL, seq INTEGER NOT NULL, kind TEXT NOT NULL,
       title TEXT NOT NULL, page_start INTEGER, page_end INTEGER, provenance TEXT NOT NULL,
       summary_status TEXT, has_text INTEGER NOT NULL CHECK (has_text IN (0, 1)),
       payload_sha256 TEXT CHECK (payload_sha256 IS NULL OR length(payload_sha256) = 64)
     )`,
    `CREATE INDEX blocks_entry ON blocks (entry, seq)`,
    `CREATE INDEX blocks_kind ON blocks (kind)`,
    // Who cites an entry, declared on the entry by the reference scan.
    `CREATE TABLE entry_ref (
       entry TEXT NOT NULL, kind TEXT NOT NULL, instance TEXT NOT NULL, from_path TEXT NOT NULL, count INTEGER NOT NULL,
       PRIMARY KEY (entry, from_path, kind)
     ) WITHOUT ROWID`,
    `CREATE INDEX entry_ref_from ON entry_ref (from_path)`,
    FTS("library_fts", ["title", "text", "entry_title"]),
  ],
  tables: [
    {
      name: "entries",
      columns: ["id", "instance", "title", "rung", "provenance", "doi", "arxiv", "sections", "blocks", "words", "page_start", "page_end", "withheld", "view", "payload_sha256", "payload_bytes"],
      orderBy: "rowid",
    },
    {
      name: "blocks",
      columns: ["id", "entry", "seq", "kind", "title", "page_start", "page_end", "provenance", "summary_status", "has_text", "payload_sha256"],
      orderBy: "rowid",
    },
    { name: "entry_ref", columns: ["entry", "kind", "instance", "from_path", "count"], orderBy: "entry, from_path, kind" },
  ],
  fts: { table: "library_fts", rowsOf: "blocks", columns: ["title", "text", "entry_title"] },
  counts: ["entries", "blocks", "entry_ref"],
  payloads: "deploy",
  search: {
    noun: "block",
    title: "Library — every ingested source, block by block",
    placeholder: 'e.g. "guideline development" or GRADE',
    select:
      "SELECT b.id AS key, CASE WHEN b.title = '' THEN '(' || b.kind || ')' ELSE b.title END AS title, " +
      "e.title || ' · ' || b.kind || coalesce(' · p. ' || b.page_start, '') AS meta, b.payload_sha256 AS payload, b.id AS part " +
      "FROM blocks b JOIN entries e ON e.id = b.entry",
    alias: "b",
    like: "b.title",
    body: "library-entry",
  },
  async load(root) {
    // Read through the layer output overlay: `library:viz` writes a mounted
    // layer's projection at the output root (`makeEmit` → `writePathAt`), so
    // the path under the mount is only the name. Read there, an index checkout
    // found no source and the slice failed.
    const dir = join(INSTANCE_ROOT, LIBRARY_DIR);
    const index = overlayPath(join(dir, "index.json"), root);
    if (!existsSync(index)) return null;
    const entries = new Map<string, Buffer>();
    const edir = join(dir, "entries");
    // The output twin first, then the mount: the first to hold an entry wins.
    for (const d of overlayDirs(edir, root)) {
      for (const f of readdirSync(d).sort()) {
        if (f.endsWith(".json") && !entries.has(f.slice(0, -5))) entries.set(f.slice(0, -5), readFileSync(join(d, f)));
      }
    }
    return libraryData(JSON.parse(readFileSync(index, "utf-8")), entries);
  },
};

// ── Slice: kg (the whole repository's knowledge graph) ─────────────────────

type KgNode = Record<string, unknown> & { "@id": string; "@type"?: string | string[] };

/**
 * The whole-repo slice from a KG export: nodes, every `@type: @id` edge, and
 * an FTS5 over names, titles, summaries and descriptions — the NO-BODY
 * variant. No instruction body is in the export (it carries
 * `instructionsPath`), and the bodies are already payloads (`f233`), so a node
 * row carries the pointer `planPayloads` computes for the subgraph files, and
 * the client fetches the committed payload.
 *
 * A subject's IRI is stored relative to the document's directory:
 * `skill/todo-manager` for `<doc dir>/skill/todo-manager` (#603), with
 * `<doc dir>` in `meta.base`, so `meta.base + iri` is the IRI again. Measured
 * when it was `<doc>#`: the short form is what keeps 14,000 edges from
 * carrying a 60-byte prefix twice each, plus once more in the reverse index.
 * Only this document's subjects are shortened (`subjectPathOf`): the host's
 * directory is the site root, under which every layer's subjects sit.
 */
export function kgData(doc: { "@id": string; "@context": unknown; "@graph": unknown[] }, plan: PayloadPlan): SliceData {
  const docIri = doc["@id"];
  const base = mintsFragments(docIri) ? `${docIri}#` : subjectBase(docIri);
  const rel = (iri: string) => subjectPathOf(iri, docIri) ?? iri;
  const ctx = (Array.isArray(doc["@context"]) ? Object.assign({}, ...doc["@context"].filter((c) => typeof c === "object")) : doc["@context"]) as Record<string, unknown>;
  const edgeTerms = Object.keys(ctx)
    .filter((k) => { const v = ctx[k]; return typeof v === "object" && v !== null && (v as Record<string, unknown>)["@type"] === "@id"; })
    .sort();
  // Type IRIs compacted to CURIEs with the context's own prefixes, longest namespace first.
  const prefixes = Object.entries(ctx)
    .filter(([k, v]) => typeof v === "string" && /[#/]$/.test(v) && !k.startsWith("@"))
    .map(([k, v]) => [k, v as string] as const)
    .sort((a, b) => b[1].length - a[1].length);
  const curie = (iri: string) => { for (const [k, ns] of prefixes) if (iri.startsWith(ns)) return `${k}:${iri.slice(ns.length)}`; return iri; };
  const str = (v: unknown): string | null => (typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v.join("; ") : null);

  const graph = (doc["@graph"] as KgNode[]).slice().sort((a, b) => cmp(a["@id"], b["@id"]));
  const findings: string[] = [];
  const nodes: Row[] = [];
  const edges = new Map<string, Row>();
  const fts: SqlValue[][] = [];
  let odd = 0;
  for (const n of graph) {
    // A one-release tombstone (`kg-export` §"Whose nodes"; `migrationTombstones`)
    // is a forwarding address for a consumer of the published DOCUMENT: no
    // `@type`, no text, only `isReplacedBy`/`sameAs`. Search has nothing to
    // find in it, and the #603 move gives every subject one, which doubled
    // this slice (4.5 MB to 8.3 MB, bean `0exf`). The document keeps them.
    if (n["@type"] === undefined && n.deprecated === true) continue;
    const types = ([] as unknown[]).concat(n["@type"] ?? []).map((t) => curie(String(t)));
    const link = plan.links.get(n["@id"]);
    nodes.push({
      iri: rel(n["@id"]), type: types[0] ?? null, types: JSON.stringify(types),
      name: str(n.name), title: str(n.title), summary: str(n.summary),
      payload_sha256: link?.sha256 ?? null, payload_bytes: link?.bytes ?? null,
    });
    fts.push([str(n.name), str(n.title), str(n.summary), str(n.description)]);
    for (const term of edgeTerms) {
      if (MIRRORED_EDGE_TERMS.has(term)) continue;
      for (const v of ([] as unknown[]).concat(n[term] ?? [])) {
        const dst = typeof v === "string" ? v : v && typeof v === "object" && typeof (v as { "@id"?: unknown })["@id"] === "string" ? (v as { "@id": string })["@id"] : null;
        if (dst === null) { odd++; continue; }
        const r = { src: rel(n["@id"]), rel: term, dst: rel(dst) };
        edges.set(`${r.src}\u0000${r.rel}\u0000${r.dst}`, r);
      }
    }
  }
  if (odd) findings.push(`${odd} value(s) under an @id-typed term were neither an IRI nor a node reference — not sliced as edges`);
  const edgeRows = [...edges.keys()].sort().map((k) => edges.get(k)!);
  const known = graph.findIndex((n) => typeof n.title === "string" && phraseIn(n.title, 5));
  return {
    rows: { nodes, edges: edgeRows },
    fts,
    payloads: plan,
    findings,
    meta: { base },
    probe: known >= 0 ? { phrase: phraseIn(graph[known]!.title as string, 5)!, column: "iri", value: rel(graph[known]!["@id"]) } : undefined,
  };
}

/**
 * The @id-typed terms the KG slice does NOT store as edges, because each is
 * the exact mirror of a term it does store: a BPMN node's `outgoing` flows are
 * the flows whose `from` is that node, and its `incoming` flows those whose
 * `to` is (`kg-export` writes both sides of every sequence flow). Four edges
 * for two facts made the flows' mirrors 14% of the slice (7,888 of 23,177
 * edges, 877 KB of 6.24 MB), the share that took it over the budget as the
 * process graphs grew. The reverse lookup is the slice's own `incoming` view
 * (`SELECT src FROM incoming WHERE iri = :node AND rel = 'from'`). The
 * published document keeps both sides, as it keeps the tombstones (bean `0exf`).
 */
export const MIRRORED_EDGE_TERMS: ReadonlySet<string> = new Set(["incoming", "outgoing"]);

export const KG_SLICE: SliceDef = {
  slice: "kg",
  source: { graph: "kg", path: "kg-export (bun run cat kg:export)" },
  ddl: [
    `CREATE TABLE nodes (
       iri TEXT NOT NULL UNIQUE, type TEXT, types TEXT NOT NULL CHECK (json_valid(types)),
       name TEXT, title TEXT, summary TEXT,
       payload_sha256 TEXT CHECK (payload_sha256 IS NULL OR length(payload_sha256) = 64),
       payload_bytes INTEGER
     )`,
    `CREATE INDEX nodes_type ON nodes (type)`,
    // ONE edge table for every relation, keyed by `rel`, rather than one table
    // per relation: there are 36 @id-typed terms, each declared on one side
    // (the subject node) only, so a per-relation table would be 36 copies of
    // one shape and `declared_on` would hold one value.
    `CREATE TABLE edges (src TEXT NOT NULL, rel TEXT NOT NULL, dst TEXT NOT NULL, PRIMARY KEY (src, rel, dst)) WITHOUT ROWID`,
    `CREATE INDEX edges_dst ON edges (dst, rel)`,
    `CREATE VIEW incoming (iri, rel, src) AS SELECT dst, rel, src FROM edges`,
    `CREATE VIEW dangling (src, rel, dst) AS SELECT e.src, e.rel, e.dst FROM edges e WHERE e.dst NOT LIKE '%://%' AND NOT EXISTS (SELECT 1 FROM nodes n WHERE n.iri = e.dst)`,
    FTS("kg_fts", ["name", "title", "summary", "description"]),
  ],
  tables: [
    { name: "nodes", columns: ["iri", "type", "types", "name", "title", "summary", "payload_sha256", "payload_bytes"], orderBy: "rowid" },
    { name: "edges", columns: ["src", "rel", "dst"], orderBy: "src, rel, dst" },
  ],
  fts: { table: "kg_fts", rowsOf: "nodes", columns: ["name", "title", "summary", "description"] },
  counts: ["nodes", "edges", "dangling"],
  payloads: "published",
  search: {
    noun: "node",
    title: "The whole knowledge graph",
    placeholder: 'e.g. "todo manager" or payload',
    select:
      "SELECT n.iri AS key, coalesce(n.title, n.name, n.iri) AS title, coalesce(n.type, '') || ' · ' || n.iri AS meta, " +
      "n.payload_sha256 AS payload, n.summary AS snippet FROM nodes n",
    alias: "n",
    like: "coalesce(n.title, n.name, n.iri)",
    body: "markdown",
  },
  async load() {
    const { buildExport } = await import("./kg-export.ts");
    // `checkout`, deliberately: this slice is the CORPUS's search, every
    // layer stacked on this one included, as it was before the published
    // document split (bean `4ak5` item 2). A stacked layer's node keeps
    // this document's `@id`, which the published document answers with a
    // tombstone forwarding to its owner's — so a result still resolves.
    const data = await buildExport({ instanceRoot: INSTANCE_ROOT, scope: "checkout", provenance: false });
    const baseUrl = canonicalBase();
    // The SAME plan `gen-subgraph-jsonld` writes the committed payloads from.
    const plan = planPayloads(data["@graph"] as Parameters<typeof planPayloads>[0], { root: INSTANCE_ROOT, baseUrl });
    return kgData(data as unknown as { "@id": string; "@context": unknown; "@graph": unknown[] }, plan);
  },
};

/** Every slice, in build order. The ONE list — the CLI, the gate and the tests read it. */
export const SLICES: readonly SliceDef[] = [BEANS_SLICE, TODOS_SLICE, LIBRARY_SLICE, KG_SLICE];

/**
 * The shape of `slices/index.json` — what {@link sliceIndexText} writes, as a
 * Zod schema so the `folio-slice-index/v1` family has a validator node
 * (cat-harness `validators/slice-index.json`). Strict: the writer emits
 * exactly these keys, so an extra one is a defect.
 */
export const SliceIndexSchema = z
  .object({
    $schema: z.literal(SLICE_INDEX_SCHEMA),
    slices: z.array(
      z
        .object({
          slice: z.string().min(1),
          manifest: z.string().min(1),
          title: z.string(),
          bytes: z.number().int().nonnegative(),
          rows: z.record(z.string(), z.number().int().nonnegative()),
        })
        .strict(),
    ),
  })
  .strict();

/**
 * `folio-slice-index/v1` as a node kind (issue #2195), so its validator node
 * names a kind and `node-kinds:check` files the family under it. Unversioned:
 * the family's tag is not SemVer, so the `$schema` literal stays a field of
 * the shape. Strict, as {@link SliceIndexSchema} is.
 */
export const SliceIndexKind = nodeKind("folio-slice-index", [], SliceIndexSchema.shape, { strict: true });

/**
 * The shape of one `<slice>.sqlite3.json` manifest — {@link SliceManifest}, which
 * {@link buildSlice} returns and {@link manifestText} writes, as a Zod schema so
 * the `folio-slice-sqlite/v1` family has a validator node (cat-harness
 * `validators/slice-sqlite.json`). Strict, like the index: the writer emits
 * exactly these keys. The type check below fails to compile when the interface
 * holds a field the schema does not accept.
 */
export const SliceManifestSchema = z
  .object({
    $schema: z.literal(MANIFEST_SCHEMA),
    slice: z.string().min(1),
    file: z.string().min(1),
    schemaVersion: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: z.number().int().nonnegative(),
    contentDigest: z.string().min(1),
    sqliteVersion: z.string().min(1),
    pageSize: z.number().int().positive(),
    fts5: z
      .object({
        table: z.string().min(1),
        rowsOf: z.string().min(1),
        columns: z.array(z.string().min(1)),
        contentless: z.literal(true),
        detail: z.literal("full"),
      })
      .strict(),
    payloadPath: z.string().min(1),
    payloads: z.object({ mode: z.enum(["deploy", "published"]), count: z.number().int().nonnegative(), bytes: z.number().int().nonnegative() }).strict(),
    rows: z.record(z.string(), z.number().int().nonnegative()),
    duplicateIds: z.array(z.string()),
    findings: z.array(z.string()),
    overBudget: z.boolean(),
    search: z
      .object({
        noun: z.string().min(1),
        title: z.string().min(1),
        placeholder: z.string(),
        select: z.string().min(1),
        alias: z.string().min(1),
        like: z.string().min(1),
        body: z.enum(["markdown", "library-entry"]),
      })
      .strict(),
    source: z.object({ graph: z.string().min(1), path: z.string().min(1) }).strict(),
  })
  .strict();
// A manifest the writer can return must be one the schema can type.
const _manifestShapeAgrees = (m: SliceManifest): z.infer<typeof SliceManifestSchema> => m;
void _manifestShapeAgrees;

/** `folio-slice-sqlite/v1` as a node kind: {@link SliceManifestSchema}, strict. */
export const SliceManifestKind = nodeKind("folio-slice-sqlite", [], SliceManifestSchema.shape, { strict: true });

export function sliceIndexText(manifests: SliceManifest[]): string {
  const slices = manifests
    .map((m) => ({ slice: m.slice, manifest: manifestFileName(m.slice), title: m.search.title, bytes: m.bytes, rows: m.rows }))
    .sort((a, b) => cmp(a.slice, b.slice));
  return JSON.stringify({ $schema: SLICE_INDEX_SCHEMA, slices }, null, 2) + "\n";
}

function argValues(args: string[], name: string): string[] {
  const out: string[] = [];
  args.forEach((a, i) => { if (a === name && args[i + 1]) out.push(args[i + 1]!); });
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const outDir = resolve(argValues(args, "--out")[0] ?? writePathAt(REPO_ROOT, SLICES_DIR));
  const payloadOut = argValues(args, "--payload-out")[0];
  const wanted = argValues(args, "--slice");
  const unknown = wanted.filter((w) => !SLICES.some((s) => s.slice === w));
  if (unknown.length) {
    console.error(`gen-slice-sqlite: unknown slice(s) ${unknown.join(", ")}; known: ${SLICES.map((s) => s.slice).join(", ")}`);
    process.exit(2);
  }
  const defs = wanted.length ? SLICES.filter((s) => wanted.includes(s.slice)) : SLICES;
  let failed = false;
  const manifests: SliceManifest[] = [];
  const notApplicable: string[] = [];
  for (const def of defs) {
    const t0 = performance.now();
    let data: Awaited<ReturnType<typeof def.load>>;
    try {
      data = await def.load(REPO_ROOT);
    } catch (e) {
      // A store this checkout does not have at all (an instance with no todo
      // graph) builds no slice and fails nothing (smart-ips-pilgrimage#13).
      if (!(e instanceof StoreAbsentError)) throw e;
      console.log(`  · ${def.slice}: not applicable here — ${e.message}`);
      notApplicable.push(def.slice);
      continue;
    }
    if (data === null) {
      // No source is not an empty source: say so, and build nothing.
      console.error(`  ✗ ${def.slice}: no source at ${def.source.path} — could not determine the slice`);
      failed = true;
      continue;
    }
    const empty = emptyStoreReason(def, data);
    if (empty !== null) {
      console.log(`  · ${def.slice}: not applicable here — ${empty}`);
      notApplicable.push(def.slice);
      continue;
    }
    if (args.includes("--check")) {
      const problems = checkSlice(def, data);
      if (problems.length) {
        failed = true;
        for (const p of problems) console.error(`  ✗ ${def.slice}: ${p}`);
      } else {
        const n = (data.rows[def.fts.rowsOf] ?? []).length;
        console.log(`✓ ${def.slice} slice: deterministic, row digest equals the source (${n} ${def.fts.rowsOf}), FTS5 phrase query answers, payloads audit clean`);
      }
      continue;
    }
    const m = buildSlice(def, data, outDir);
    // Database first, manifest second: a manifest must never name a file not yet written.
    writeFileSync(join(outDir, manifestFileName(def.slice)), manifestText(m));
    const rotated = rotateSliceFiles(outDir, def.slice, m.file);
    manifests.push(m);
    const ms = Math.round(performance.now() - t0);
    const counts = Object.entries(m.rows).map(([k, v]) => `${v} ${k}`).join(", ");
    console.log(`  · ${join(outDir, m.file)} — ${m.bytes} bytes (${counts}), ${m.payloads.count} payload(s) ${m.payloads.mode}, ${ms} ms`);
    if (rotated.length) console.log(`  · ${def.slice}: rotated off ${rotated.length} earlier build(s): ${rotated.join(", ")}`);
    if (m.overBudget) console.warn(`  ! ${def.slice}: ${m.bytes} bytes is over the ${SIZE_BUDGET_BYTES}-byte budget — a decision, not a default`);
    if (m.duplicateIds.length) console.warn(`  ! ${def.slice}: keys declared by more than one source row: ${m.duplicateIds.join(", ")}`);
    for (const f of m.findings) console.warn(`  ! ${def.slice}: ${f}`);
    if (payloadOut && def.payloads === "deploy") {
      const n = writePayloads(data.payloads, resolve(payloadOut));
      console.log(`  · ${def.slice}: ${n} payload(s) → ${resolve(payloadOut)}`);
    }
  }
  if (!args.includes("--check") && manifests.length) {
    // The index lists every slice now in `outDir`, so a `--slice` rebuild keeps the others.
    const all: SliceManifest[] = [];
    for (const f of readdirSync(outDir).sort()) {
      if (f.endsWith(".sqlite3.json")) all.push(JSON.parse(readFileSync(join(outDir, f), "utf-8")) as SliceManifest);
    }
    writeFileSync(join(outDir, "index.json"), sliceIndexText(all));
  }
  if (failed) process.exit(1);
  if (notApplicable.length === defs.length) {
    exitNotApplicable("slice:sqlite", `no slice's source is in this checkout (${notApplicable.join(", ")})`);
  }
}
