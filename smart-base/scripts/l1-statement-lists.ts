#!/usr/bin/env bun
/**
 * The collector for the standard step `publish-extracted-statements`: an
 * `l1-extraction` directory's authored L1 sources and scenario candidates,
 * as core's statement lists (`folio-extracted-statements/v1`).
 *
 * @module smart-base/scripts/l1-statement-lists
 * @covers l1-extraction — the authored L1 source YAML and the L2 scenario-candidate graphs in one directory
 *
 * ## Why here
 *
 * Core publishes statement lists, but the formats they come from are a
 * content layer's. The L1 source YAML (`recommendations:` rows) and the
 * scenario-candidate graph (`user-scenario` nodes whose `evidence.location`
 * names a row) are smart-base's, so smart-base turns them into lists and core
 * resolves, labels, renders and checks them (`statements:pages`).
 *
 * ## Where a statement came from
 *
 * - **The library entry** is the L1 source's own: `graph.source.entry`, or
 *   else the `library/<id>/` its `graph.source` paths name. An L1 source that
 *   names no entry is refused, never guessed.
 * - **The page** is the row's `page`, its first number ("220–221" is 220): a
 *   row is quoted from where it starts.
 * - A **scenario candidate** came from the row its `evidence.location` names
 *   (`<l1 yaml>#<KEY> (p<N>)`), so it takes that L1 source's entry and the
 *   page in the location, and names the row's key as `derivedFrom`.
 *
 * Usage:
 *   bun run smart-base/scripts/l1-statement-lists.ts --dir <l1-extraction dir> --out <dir> [--check]
 *
 * Writes `<out>/<l1 file stem>.recommendations.json` for each L1 source, and
 * `<out>/<graph file stem>.scenarios.json` for each scenario-candidate graph.
 * Exit: 0 written or current · 1 stale (`--check`) or a source names no entry · 2 bad usage.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { EXTRACTED_STATEMENTS_SCHEMA_ID, type ExtractedStatement, type ExtractedStatements } from "../platform/index.js";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : undefined);
const oneLine = (t: string): string => t.replace(/\s+/g, " ").trim();

/** The library entry an L1 source was extracted from, or undefined when it names none. */
export function libraryIdOfL1(doc: unknown): string | undefined {
  if (!isObj(doc) || !isObj(doc["graph"]) || !isObj(doc["graph"]["source"])) return undefined;
  const source = doc["graph"]["source"];
  const entry = str(source["entry"]);
  if (entry) return entry.replace(/\/+$/, "").split("/").pop();
  for (const v of Object.values(source)) {
    const m = typeof v === "string" ? /(?:^|\/)library\/([^/]+)\//.exec(v) : null;
    if (m) return m[1];
  }
  return undefined;
}

/** The first page number a row names: "220–221" is 220, "p210" is 210. */
export function firstPage(v: unknown): number | undefined {
  const m = /(\d+)/.exec(str(v) ?? "");
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** True for an authored L1 source: a document with `recommendations` rows. */
export function isL1Source(doc: unknown): doc is Obj {
  return isObj(doc) && Array.isArray(doc["recommendations"]);
}

/** An L1 source's recommendation rows as statements. */
export function recommendationsOf(doc: Obj, libraryId: string): ExtractedStatement[] {
  return (doc["recommendations"] as unknown[]).filter(isObj).flatMap((r) => {
    const key = str(r["key"]);
    const text = str(r["statement"]);
    if (!key || !text) return [];
    const page = firstPage(r["page"]);
    return [
      {
        id: key,
        statement: oneLine(text),
        kind: "recommendation",
        ...(str(r["status"]) ? { status: str(r["status"])! } : {}),
        source: { libraryId, ...(page !== undefined ? { page } : {}) },
      },
    ];
  });
}

/** `<path>.yaml#<KEY> (p<N>)` → its parts. */
export function parseLocation(loc: string): { file: string; key: string; page?: number } | undefined {
  const m = /^(.+?\.ya?ml)#([^\s(]+)(?:\s*\(p\.?\s*(\d+)[^)]*\))?/.exec(loc.trim());
  if (!m) return undefined;
  return { file: m[1]!, key: m[2]!, ...(m[3] ? { page: Number(m[3]) } : {}) };
}

/** A scenario-candidate graph's nodes that cite an L1 row, as statements. */
/**
 * `entryOfFile` answers `null` when the cited file is not an L1 source (a
 * persona cites the mapping, not a publication): that node is not an extracted
 * statement and is skipped. `undefined` means an L1 source that names no entry.
 */
export function scenariosOf(graph: unknown, entryOfFile: (file: string) => string | null | undefined): { statements: ExtractedStatement[]; unresolved: string[] } {
  const statements: ExtractedStatement[] = [];
  const unresolved: string[] = [];
  const nodes = isObj(graph) && Array.isArray(graph["nodes"]) ? graph["nodes"].filter(isObj) : [];
  for (const n of nodes) {
    const ev = isObj(n["evidence"]) ? n["evidence"] : undefined;
    const loc = ev ? parseLocation(str(ev["location"]) ?? "") : undefined;
    if (!loc) continue;
    const libraryId = entryOfFile(loc.file);
    if (libraryId === null) continue;
    const id = str(isObj(n["properties"]) ? n["properties"]["id"] : undefined) ?? str(n["id"]) ?? "?";
    if (!libraryId) {
      unresolved.push(`${id}: ${loc.file} names no library entry`);
      continue;
    }
    const text = str(isObj(n["properties"]) ? n["properties"]["statement"] : undefined) ?? str(n["label"]) ?? "";
    statements.push({
      id,
      statement: oneLine(text),
      kind: str(n["type"]) ?? "candidate",
      ...(str(n["derivation"]) ? { status: str(n["derivation"])! } : {}),
      // The L1 row it was written from, so a reviewer can check one against the other.
      derivedFrom: loc.key,
      source: { libraryId, ...(loc.page !== undefined ? { page: loc.page } : {}) },
    });
  }
  return { statements, unresolved };
}

function readAny(path: string): unknown {
  const text = readFileSync(path, "utf8");
  return /\.ya?ml$/.test(path) ? parseYaml(text) : JSON.parse(text);
}

function filesIn(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((f) => join(dir, f))
    .filter((p) => statSync(p).isFile() && /\.(ya?ml|json)$/.test(p))
    .sort();
}

/**
 * The name of a scenario-candidate graph's list, read off where it sits:
 *
 * - `<x>/candidates/<stem>.l2.json` (one source per extraction directory, the
 *   measles layout) is named after `<x>`: `measles-scenario-candidates`;
 * - `candidates/<source>/<stem>.l2.json` (one sub-directory per source, the
 *   Uganda layout) is named after `<source>`: `ug-moh-schedule-poster`;
 * - anything else keeps its file stem.
 */
export function scenarioListName(path: string, stem: string): string {
  const parent = basename(dirname(path));
  const grand = basename(dirname(dirname(path)));
  if (grand === "candidates") return parent;
  if (parent === "candidates") return `${grand}-${stem}`;
  return stem;
}

/** Every list a directory yields, keyed by its output file name. */
export function listsOf(dir: string, instanceRoot: string): { lists: Map<string, ExtractedStatements>; problems: string[] } {
  const lists = new Map<string, ExtractedStatements>();
  const problems: string[] = [];
  // Two inputs that map to one output name would overwrite each other
  // silently, losing the first list's statements. Refuse instead.
  const from = new Map<string, string>();
  const put = (name: string, path: string, list: ExtractedStatements): void => {
    const prior = from.get(name);
    if (prior !== undefined) {
      problems.push(`${relative(dir, path)}: its list would be ${name}, which ${relative(dir, prior)} already writes`);
      return;
    }
    from.set(name, path);
    lists.set(name, list);
  };
  const entryCache = new Map<string, string | null | undefined>();
  const entryOfFile = (file: string): string | null | undefined => {
    const abs = [resolve(instanceRoot, file), resolve(dir, file), resolve(dir, basename(file))].find((p) => existsSync(p));
    if (!abs) return undefined;
    if (!entryCache.has(abs)) {
      const doc = readAny(abs);
      entryCache.set(abs, isL1Source(doc) ? libraryIdOfL1(doc) : null);
    }
    return entryCache.get(abs);
  };
  for (const path of filesIn(dir)) {
    let doc: unknown;
    try {
      doc = readAny(path);
    } catch {
      continue;
    }
    const stem = basename(path).replace(/(\.l[12])?\.(ya?ml|json)$/, "");
    if (isL1Source(doc)) {
      const libraryId = libraryIdOfL1(doc);
      if (!libraryId) {
        problems.push(`${relative(dir, path)}: graph.source names no library entry`);
        continue;
      }
      const title = isObj(doc["publication"]) ? str(doc["publication"]["title"]) : undefined;
      put(`${stem}.recommendations.json`, path, {
        _schema: EXTRACTED_STATEMENTS_SCHEMA_ID,
        ...(title ? { title } : {}),
        statements: recommendationsOf(doc, libraryId),
      });
    } else if (isObj(doc) && doc["@context"] !== undefined && Array.isArray(doc["nodes"])) {
      const { statements, unresolved } = scenariosOf(doc, entryOfFile);
      problems.push(...unresolved.map((u) => `${relative(dir, path)}: ${u}`));
      if (statements.length > 0) {
        put(`${scenarioListName(path, stem)}.scenarios.json`, path, { _schema: EXTRACTED_STATEMENTS_SCHEMA_ID, title: "Scenario candidates", statements });
      }
    }
  }
  return { lists, problems };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (f: string): string | undefined => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const dir = arg("--dir");
  const out = arg("--out");
  const check = argv.includes("--check");
  if (!dir || !out) {
    console.error("usage: l1-statement-lists.ts --dir <l1-extraction dir> --out <dir> [--instance-root <dir>] [--check]");
    process.exit(2);
  }
  const { lists, problems } = listsOf(resolve(dir), resolve(arg("--instance-root") ?? process.cwd()));
  if (problems.length > 0) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  let stale = 0;
  for (const [name, list] of lists) {
    const path = join(resolve(out), name);
    const text = `${JSON.stringify(list, null, 2)}\n`;
    const prev = existsSync(path) ? readFileSync(path, "utf8") : undefined;
    if (check) {
      if (prev !== text) {
        console.error(`✗ ${relative(process.cwd(), path)} is stale`);
        stale++;
      }
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
      console.log(`${prev === text ? "=" : "✓"} ${relative(process.cwd(), path)}: ${list.statements.length} statement(s)`);
    }
  }
  process.exit(stale > 0 ? 1 : 0);
}
