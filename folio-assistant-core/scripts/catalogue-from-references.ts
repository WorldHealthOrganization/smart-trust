#!/usr/bin/env bun
/**
 * Catalogue a folio's library from its bibliography: one Dublin Core record
 * and one catalogue node per library entry the source ledger joins to a
 * reference (folio-assistant-core#72).
 *
 * ## Why
 *
 * The title authority order (`cat-harness-tools/pipeline/library-title.ts`)
 * asks the catalogue's `dc.title` second, right after an editor. A folio that
 * keeps its bibliography as CSL-JSON (qou's `folio/schema/references.ts`, or
 * `references/<key>.json`) has no catalogue, so that slot is always empty and
 * real titles fall through to the PDF or the slug. Measured on qou `main`
 * 2026-10-11: 545 of 737 manifests carried `title_source: slug`.
 *
 * ## The join, and why it is not a guess
 *
 * A library entry's `structure.json` names the file it was read from
 * (`source.file`, with its sha256). The source ledger has one row per upload,
 * and a triaged row names the reference it backs (`id`). An entry is joined
 * when exactly one ledger row names a file with the same basename and a
 * reference id, and, where both sides record a sha256, the two agree.
 * Everything else is reported and left alone: no row, a row with `id: null`,
 * two rows naming different references, a sha256 mismatch, or a reference id
 * the bibliography does not hold. Those entries fall through the title order
 * exactly as they do today.
 *
 * ## What it writes, in the folio's declared `catalogue` directory
 *
 * - `records/<slug>.dc.json`: a `folio-dublin-core/v1` record built by
 *   `referenceToDublinCoreRecord` (`schemas/reference.ts`), the same mapping
 *   the bibliography's Dublin Core export uses. Bibliographic layer only, per
 *   `skills/library/cataloguing/filing-dublin-core.md`.
 * - `nodes/item-<slug>.json`: a `folio-catalogue-node/v1` item with
 *   `libraryId` and `metadataRef`, id `item/ref:<reference id>`. It is
 *   `materialized` (the library entry is here), purpose `working`, and every
 *   publication gate is `unknown`: this tool records what the bibliography
 *   says and judges no licence.
 * - `catalogue.json`, only when the directory has none and `--base-url` is
 *   given.
 *
 * It never touches a node or record it did not write. Its own are the nodes
 * whose id starts `item/ref:`; any other node naming the same `libraryId` wins,
 * and the entry is reported as already catalogued. One of its own nodes whose
 * join has gone is reported as stale and removed on `--apply`, with its record.
 *
 * ## Not decided here
 *
 * Whether the records are committed or derived on build (the issue leaves it
 * open). The tool supports both: `--apply` writes them, and `--check` fails
 * when the files on disk differ from what it would write.
 *
 * Usage:
 *   bun run folio-assistant-core/scripts/catalogue-from-references.ts <instance-root>             # dry run
 *   bun run folio-assistant-core/scripts/catalogue-from-references.ts <instance-root> --apply [--base-url <url>]
 *   bun run folio-assistant-core/scripts/catalogue-from-references.ts <instance-root> --check
 *   add --json for a machine-readable report
 *
 * @module folio-assistant-core/scripts/catalogue-from-references
 * @covers catalogue, references, library
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { libraryEntries } from "./lib/library-entries.ts";

import { readStructure, STRUCTURE_FILENAME } from "@litlfred/cat-harness-tools/schemas/content/document-structure.js";

import { CATALOGUE_NODE_SCHEMA_TAG, CATALOGUE_SCHEMA_TAG, CatalogueNodeSchema, CatalogueSchema } from "../schemas/catalogue.ts";
import { DublinCoreRecordSchema, type DublinCoreRecord } from "../schemas/dublin-core.ts";
import { referenceEntryToNode, referenceToDublinCoreRecord, type ReferenceNode } from "../schemas/reference.ts";

/** Node ids this tool owns. Anything else naming the same libraryId is left alone. */
export const OWN_ID_PREFIX = "item/ref:";
export const METHOD = "catalogue-from-references";

/** One library entry, as `structure.json` describes its source. */
export interface LibraryEntry {
  slug: string;
  sourceFile?: string;
  sha256?: string;
}

/** One source-ledger row, reduced to what the join reads. */
export interface LedgerRow {
  file: string | null;
  id: string | null;
  sha256?: string;
}

export interface CatalogueInput {
  references: Map<string, { node: ReferenceNode; file: string }>;
  ledger: LedgerRow[];
  library: LibraryEntry[];
  /** Existing nodes by file name under `nodes/`. */
  nodes: Map<string, Record<string, unknown>>;
  /** Existing records by file name under `records/`. */
  records: Map<string, Record<string, unknown>>;
  /** Layer-relative paths. */
  catalogueRel: string;
  libraryRel: string;
  /** retrievedAt for a record that is new or changed. */
  today: string;
}

export type Skip =
  | "no-source-file"
  | "no-ledger-row"
  | "ledger-row-has-no-reference"
  | "ambiguous"
  | "sha256-mismatch"
  | "unknown-reference"
  | "reference-has-no-title"
  | "already-catalogued";

export interface Write {
  path: string;
  content: string;
  action: "create" | "update";
}

export interface Plan {
  joined: { slug: string; reference: string; upload: string }[];
  skipped: { slug: string; why: Skip; detail: string }[];
  writes: Write[];
  removals: string[];
  unchanged: number;
}

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

/** The Dublin Core record for one joined entry, with this tool's provenance. */
export function recordFor(ref: ReferenceNode, refFile: string, retrievedAt: string): DublinCoreRecord {
  const rec = referenceToDublinCoreRecord(ref);
  return DublinCoreRecordSchema.parse({
    ...rec,
    provenance: { source: `${refFile}#${ref.id}`, retrievedAt, method: METHOD },
  });
}

/** The catalogue item node for one joined entry. */
export function nodeFor(
  ref: ReferenceNode,
  slug: string,
  upload: string,
  refFile: string,
  paths: { catalogueRel: string; libraryRel: string },
): Record<string, unknown> {
  const unjudged = {
    verdict: "unknown",
    basis: `not judged: ${METHOD} records what the bibliography says about the work and decides no licence, restriction or retention`,
  };
  const node = {
    $schema: CATALOGUE_NODE_SCHEMA_TAG,
    id: `${OWN_ID_PREFIX}${ref.id}`,
    kind: "item",
    flavour: "item",
    title: ref.title!,
    parents: [],
    libraryId: slug,
    metadataRef: join(paths.catalogueRel, "records", `${slug}.dc.json`),
    bitstreams: [],
    materialization: {
      state: "materialized",
      provenance: { local: slug },
      localPath: join(paths.libraryRel, slug),
      purpose: "working",
      gates: {
        size: unjudged,
        restrictions: unjudged,
        retention: unjudged,
        sourceLoss: {
          verdict: "unknown",
          basis: "a working copy of derived sections is not the source, so it cannot answer source loss",
        },
        copyright: unjudged,
      },
      note:
        `Catalogued by ${METHOD} from reference \`${ref.id}\` (${refFile}), joined through the source-ledger row for ` +
        `\`${upload}\`, whose basename is this entry's structure.json source.file. Regenerated, not edited: change the reference.`,
    },
  };
  CatalogueNodeSchema.parse(node);
  return node;
}

/** Drop the `_` notes a person may add, as check-catalogue.ts does, so comparison is on data. */
function data(v: Record<string, unknown> | undefined): string | undefined {
  if (!v) return undefined;
  return JSON.stringify(Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith("_"))));
}

/** Everything the tool would do, without touching the disk. */
export function planCatalogue(input: CatalogueInput): Plan {
  const plan: Plan = { joined: [], skipped: [], writes: [], removals: [], unchanged: 0 };
  const byBase = new Map<string, LedgerRow[]>();
  for (const row of input.ledger) {
    if (!row.file) continue;
    const b = basename(row.file);
    byBase.set(b, [...(byBase.get(b) ?? []), row]);
  }
  // libraryId → node file, for nodes this tool did not write.
  const foreign = new Map<string, string>();
  const ours = new Map<string, Record<string, unknown>>();
  for (const [f, n] of input.nodes) {
    const id = typeof n.id === "string" ? n.id : "";
    if (id.startsWith(OWN_ID_PREFIX)) ours.set(f, n);
    else if (typeof n.libraryId === "string") foreign.set(n.libraryId, f);
  }
  const keep = new Set<string>();
  const skip = (slug: string, why: Skip, detail: string) => plan.skipped.push({ slug, why, detail });

  for (const e of [...input.library].sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (!e.sourceFile) {
      skip(e.slug, "no-source-file", "structure.json names no source.file");
      continue;
    }
    const rows = byBase.get(basename(e.sourceFile)) ?? [];
    if (!rows.length) {
      skip(e.slug, "no-ledger-row", `no ledger row names ${basename(e.sourceFile)}`);
      continue;
    }
    const ids = [...new Set(rows.map((r) => r.id).filter((x): x is string => !!x))];
    if (!ids.length) {
      skip(e.slug, "ledger-row-has-no-reference", `the ledger row for ${basename(e.sourceFile)} backs no reference yet (id: null)`);
      continue;
    }
    if (ids.length > 1) {
      skip(e.slug, "ambiguous", `ledger rows for ${basename(e.sourceFile)} name ${ids.length} references: ${ids.join(", ")}`);
      continue;
    }
    const refId = ids[0]!;
    const row = rows.find((r) => r.id === refId)!;
    if (row.sha256 && e.sha256 && row.sha256 !== e.sha256) {
      skip(e.slug, "sha256-mismatch", `ledger row ${row.file} records ${row.sha256.slice(0, 12)}…, structure.json ${e.sha256.slice(0, 12)}…`);
      continue;
    }
    const ref = input.references.get(refId);
    if (!ref) {
      skip(e.slug, "unknown-reference", `the ledger names reference "${refId}", which the bibliography does not hold`);
      continue;
    }
    if (!ref.node.title?.trim()) {
      skip(e.slug, "reference-has-no-title", `reference "${refId}" has no title to catalogue`);
      continue;
    }
    if (foreign.has(e.slug)) {
      skip(e.slug, "already-catalogued", `${foreign.get(e.slug)} already names libraryId "${e.slug}"`);
      continue;
    }
    plan.joined.push({ slug: e.slug, reference: refId, upload: row.file! });

    const nodeName = `item-${e.slug}.json`;
    const recordName = `${e.slug}.dc.json`;
    keep.add(nodeName);
    const node = nodeFor(ref.node, e.slug, row.file!, ref.file, input);
    const existingRec = input.records.get(recordName);
    // Keep an unchanged record's retrievedAt, so a re-run with the same
    // bibliography writes nothing.
    const prevAt = (existingRec?.provenance as { retrievedAt?: string } | undefined)?.retrievedAt;
    let rec = recordFor(ref.node, ref.file, prevAt ?? input.today);
    if (prevAt && data(existingRec) !== data(rec as unknown as Record<string, unknown>)) {
      rec = recordFor(ref.node, ref.file, input.today);
    }
    for (const [name, sub, value, existing] of [
      [nodeName, "nodes", node, input.nodes.get(nodeName)],
      [recordName, "records", rec, existingRec],
    ] as const) {
      const path = join(input.catalogueRel, sub, name);
      if (data(existing) === data(value as Record<string, unknown>)) plan.unchanged += 1;
      else plan.writes.push({ path, content: json(value), action: existing ? "update" : "create" });
    }
  }
  for (const [f, n] of ours) {
    if (keep.has(f)) continue;
    plan.removals.push(join(input.catalogueRel, "nodes", f));
    const ref = typeof n.metadataRef === "string" ? n.metadataRef : undefined;
    if (ref && input.records.has(basename(ref))) plan.removals.push(ref);
  }
  return plan;
}

// ── I/O ─────────────────────────────────────────────────────────────────────

function readJson(p: string): Record<string, unknown> | undefined {
  try {
    const v = JSON.parse(readFileSync(p, "utf-8"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function readDir(dir: string, suffix: string): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(suffix)).sort()) {
    const v = readJson(join(dir, f));
    if (v) out.set(f, v);
  }
  return out;
}

async function main(argv: string[]): Promise<number> {
  const args = argv.filter((a) => !a.startsWith("--"));
  const flag = (n: string) => argv.includes(`--${n}`);
  const opt = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const baseUrl = opt("base-url");
  const rootArg = args.find((a) => a !== baseUrl);
  if (!rootArg) {
    console.error("usage: catalogue-from-references.ts <instance-root> [--apply [--base-url <url>] | --check] [--json]");
    return 2;
  }
  const root = resolve(rootArg);
  const { instanceDirectoryForGraph, repoRootFor } = await import("@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts");
  const { readSourceLedger } = await import("@litlfred/cat-harness-tools/schemas/library/bib-attestations.ts");
  const { ledgerLocalFile } = await import("@litlfred/cat-harness-tools/schemas/library/bib-verification.ts");
  const { referenceEntries } = await import("@litlfred/cat-harness-tools/pipeline/reference-entries.ts");

  const catalogueDir = instanceDirectoryForGraph(root, "catalogue");
  const libraryDir = instanceDirectoryForGraph(root, "library");
  if (!catalogueDir || !libraryDir) {
    console.error(
      `catalogue-from-references: ${rootArg} declares no ${!catalogueDir ? "`catalogue`" : "`library`"} directory. ` +
        "Declare one in the instance's <name>.json; this tool writes only where the folio says its catalogue is.",
    );
    return 2;
  }
  const repo = repoRootFor(root);

  const references = new Map<string, { node: ReferenceNode; file: string }>();
  for (const entry of referenceEntries(root)) {
    try {
      references.set(entry.id, { node: referenceEntryToNode(entry), file: relative(repo, entry.file) });
    } catch {
      // An entry that does not validate is the bibliography's problem; its
      // library entry is then reported as `unknown-reference`.
    }
  }
  const ledger: LedgerRow[] = readSourceLedger(root).ledger.entries.map((e) => ({
    file: ledgerLocalFile(e),
    id: e.id,
    ...((e as { source_sha?: string }).source_sha ? { sha256: (e as { source_sha?: string }).source_sha } : {}),
  }));
  // Flat or filed in a concern group (bean `6fez`).
  const library: LibraryEntry[] = libraryEntries(libraryDir)
    .filter((e) => existsSync(join(e.dir, STRUCTURE_FILENAME)))
    .map((e) => {
      const structure = readStructure(e.dir);
      const src = ("reason" in structure ? {} : ((structure.raw as { source?: unknown }).source ?? {})) as { file?: string; sha256?: string };
      return { slug: e.slug, sourceFile: src.file, sha256: src.sha256 };
    });

  const plan = planCatalogue({
    references,
    ledger,
    library,
    nodes: readDir(join(catalogueDir, "nodes"), ".json"),
    records: readDir(join(catalogueDir, "records"), ".dc.json"),
    catalogueRel: relative(root, catalogueDir),
    libraryRel: relative(root, libraryDir),
    today: new Date().toISOString().slice(0, 10),
  });

  const catalogueJson = join(catalogueDir, "catalogue.json");
  const needsCatalogueJson = !existsSync(catalogueJson);

  const counts: Record<string, number> = {};
  for (const s of plan.skipped) counts[s.why] = (counts[s.why] ?? 0) + 1;
  if (flag("json")) {
    console.log(JSON.stringify({ ...plan, writes: plan.writes.map(({ path, action }) => ({ path, action })), skippedByReason: counts }, null, 2));
  } else {
    console.log(`catalogue-from-references: ${library.length} library entr(ies), ${references.size} reference(s), ${ledger.length} ledger row(s)`);
    console.log(`  joined ${plan.joined.length}; writes ${plan.writes.length}; unchanged ${plan.unchanged}; stale ${plan.removals.length}`);
    for (const [why, n] of Object.entries(counts).sort()) console.log(`  left alone (${why}): ${n}`);
    if (needsCatalogueJson) console.log(`  ${relative(repo, catalogueJson)} is absent${baseUrl ? "; --apply writes it" : "; pass --base-url to create it"}`);
  }

  if (flag("check")) {
    const stale = plan.writes.length + plan.removals.length;
    if (stale) console.error(`✗ ${stale} catalogue file(s) differ from the bibliography. Run with --apply.`);
    return stale ? 1 : 0;
  }
  if (!flag("apply")) {
    if (plan.writes.length || plan.removals.length) console.log("dry run: nothing written (pass --apply)");
    return 0;
  }
  if (needsCatalogueJson) {
    if (!baseUrl) {
      console.error("✗ the catalogue directory has no catalogue.json; pass --base-url <url> (where the bibliography is published) to create it");
      return 2;
    }
    const cat = CatalogueSchema.parse({
      $schema: CATALOGUE_SCHEMA_TAG,
      id: basename(root),
      title: `${basename(root)} — library catalogued from its bibliography`,
      system: "CSL-JSON bibliography",
      baseUrl,
      nodesDir: "nodes",
    });
    mkdirSync(catalogueDir, { recursive: true });
    writeFileSync(catalogueJson, json(cat));
  }
  for (const w of plan.writes) {
    const p = join(root, w.path);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, w.content);
  }
  for (const r of plan.removals) rmSync(join(root, r), { force: true });
  console.log(`✓ wrote ${plan.writes.length}, removed ${plan.removals.length}`);
  return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
