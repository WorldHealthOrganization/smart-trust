#!/usr/bin/env bun
/**
 * terminology-index.ts — a static terminology index for an IG site, built from
 * the IG's own cache, so nothing on the site asks a terminology server.
 *
 * Owner, 2026-10-14: *"cache + ucum. this is gh-pages so no XSS"*. The IG
 * Publisher's terminology work is already on disk after `ig-cache.sh restore`
 * (skill `ig-build-pipeline`, §"The AST cache lifecycle"):
 *
 * - `output-ast/expansions.json`: the Publisher's ValueSet expansions, a Bundle;
 * - `input-cache/txcache/`: its terminology cache — every code it looked up
 *   (`v:` results carry `system`, `code`, `display`) and every expansion it
 *   asked for (`e:` results carry a ValueSet).
 *
 * Out: `{ codes: [system, code, display][], valueSets: { "<url>|<version>": [row…] } }`,
 * gzipped as `index.json.gz` when it is over `GZIP_OVER` bytes. LOINC comes
 * ONLY from here, never from a server; UCUM comes whole from the vendored
 * `@lhncbc/ucum-lhc` definitions (`ucumRows`).
 *
 * Also `preExpand`: a Questionnaire's `answerValueSet` replaced by the
 * expansion's codes as `answerOption`, for the copy LHC-Forms renders. The
 * source Questionnaire is never changed.
 *
 *   bun run fhir-harness/scripts/terminology-index.ts --expansions <expansions.json> --txcache <dir> --out <dir>
 *
 * @module fhir-harness/scripts/terminology-index
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const INDEX_SCHEMA = "fhir-harness-terminology-index/v1";
/** Above this many bytes the index is written gzipped. */
export const GZIP_OVER = 1_000_000;

export type Row = [system: string, code: string, display: string];

export interface TerminologyIndex {
  $schema: typeof INDEX_SCHEMA;
  sources: { expansions?: string; txcache?: string; valueSets: number; txcacheFiles: number };
  codes: Row[];
  valueSets: Record<string, number[]>;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- FHIR and cache JSON are read as plain data. */
type Json = Record<string, any>;

/** Every code an expansion lists, nested `contains` flattened. */
export function containsOf(vs: Json): Array<{ system?: string; code?: string; display?: string; version?: string }> {
  const out: Json[] = [];
  const walk = (cs: Json[] | undefined) => {
    for (const c of cs ?? []) {
      if (c.code !== undefined && !c.abstract) out.push(c);
      walk(c.contains);
    }
  };
  walk(vs?.expansion?.contains);
  return out;
}

/** The ValueSets of an expansions Bundle (or a lone ValueSet), keyed `url|version` and `url`. */
export function expansionsOf(doc: Json): Map<string, Json> {
  const m = new Map<string, Json>();
  const add = (vs: Json) => {
    if (vs?.resourceType !== "ValueSet" || !vs.url || !vs.expansion) return;
    if (vs.version) m.set(`${vs.url}|${vs.version}`, vs);
    if (!m.has(vs.url)) m.set(vs.url, vs);
  };
  if (doc?.resourceType === "Bundle") for (const e of doc.entry ?? []) add(e.resource);
  else add(doc);
  return m;
}

/** The first balanced JSON object starting at `from`, parsed; undefined when it does not parse. */
function jsonAt(text: string, from: number): Json | undefined {
  const start = text.indexOf("{", from);
  if (start < 0) return undefined;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * One IG Publisher txcache file (`<server>.cache`): entries separated by a
 * line of dashes, each a request, `####`, then results. `v:` is a code
 * validation (`system`, `code`, `display`); `e:` an expansion (a ValueSet,
 * itself or under `valueSet`). Anything that does not parse is skipped:
 * a cache is a record of what was asked, not a schema this layer owns.
 */
export function parseTxCache(text: string): { codes: Row[]; valueSets: Json[] } {
  const codes: Row[] = [];
  const valueSets: Json[] = [];
  for (const entry of text.split(/^-{20,}\s*$/m)) {
    const hash = entry.indexOf("####");
    if (hash < 0) continue;
    const results = entry.slice(hash + 4);
    for (const m of results.matchAll(/^\s*([a-z]):\s*\{/gm)) {
      const obj = jsonAt(results, m.index! + m[0].length - 1);
      if (!obj) continue;
      if (m[1] === "v" && obj.system && obj.code && obj.display && !obj.error) codes.push([obj.system, obj.code, obj.display]);
      if (m[1] === "e") {
        const vs = obj.resourceType === "ValueSet" ? obj : obj.valueSet;
        if (vs?.resourceType === "ValueSet") valueSets.push(vs);
      }
    }
  }
  return { codes, valueSets };
}

const cacheFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? cacheFiles(p) : f.endsWith(".cache") ? [p] : [];
      })
    : [];

/** The index from what the IG's cache holds. Either source may be absent; neither is fetched. */
export function buildIndex(o: { expansions?: string; txcache?: string }): TerminologyIndex {
  const rows = new Map<string, number>();
  const codes: Row[] = [];
  const row = (r: Row): number => {
    const k = `${r[0]}|${r[1]}`;
    const at = rows.get(k);
    if (at !== undefined) return at;
    rows.set(k, codes.length);
    codes.push(r);
    return codes.length - 1;
  };
  const valueSets: Record<string, number[]> = {};
  const addVs = (vs: Json) => {
    const ids = containsOf(vs).flatMap((c) => (c.system && c.code ? [row([c.system, c.code, c.display ?? ""])] : []));
    const keys = vs.version ? [`${vs.url}|${vs.version}`, vs.url] : [vs.url];
    for (const k of keys) if (k && !valueSets[k]) valueSets[k] = ids;
  };
  let vsCount = 0;
  if (o.expansions && existsSync(o.expansions)) {
    for (const vs of new Set(expansionsOf(JSON.parse(readFileSync(o.expansions, "utf-8"))).values())) {
      addVs(vs);
      vsCount++;
    }
  }
  const files = o.txcache ? cacheFiles(o.txcache) : [];
  for (const f of files) {
    const t = parseTxCache(readFileSync(f, "utf-8"));
    for (const r of t.codes) row(r);
    for (const vs of t.valueSets) if (vs.url) addVs(vs);
  }
  return {
    $schema: INDEX_SCHEMA,
    sources: { ...(o.expansions ? { expansions: o.expansions } : {}), ...(o.txcache ? { txcache: o.txcache } : {}), valueSets: vsCount, txcacheFiles: files.length },
    codes,
    valueSets,
  };
}

/** Write the index; gzipped as `index.json.gz` when large. Returns the file written. */
export function writeIndex(index: TerminologyIndex, outDir: string): { file: string; bytes: number } {
  mkdirSync(outDir, { recursive: true });
  const text = JSON.stringify({ ...index, sources: { ...index.sources, expansions: index.sources.expansions && "expansions.json", txcache: index.sources.txcache && "txcache/" } });
  if (text.length > GZIP_OVER) {
    const gz = gzipSync(text);
    writeFileSync(join(outDir, "index.json.gz"), gz);
    return { file: "index.json.gz", bytes: gz.length };
  }
  writeFileSync(join(outDir, "index.json"), text);
  return { file: "index.json", bytes: text.length };
}

/**
 * The full UCUM list as search rows `[csCode, name, guidance, synonyms, printSymbol]`,
 * from the vendored `ucumDefs.min.json` (`units.config` names the columns).
 */
export function ucumRows(defs: Json): string[][] {
  const cfg: unknown[] = defs.units.config;
  const at = (n: string) => cfg.indexOf(n);
  const [cs, name, guidance, syn, print] = ["csCode_", "name_", "guidance_", "synonyms_", "printSymbol_"].map(at);
  return (defs.units.data as unknown[][]).map((u) => [u[cs!], u[name!], u[guidance!], u[syn!], u[print!]].map((v) => (v === null || v === undefined ? "" : String(v))));
}

/**
 * The copy LHC-Forms renders: every item's `answerValueSet` that the IG's
 * expansions hold becomes `answerOption`, so the form needs no terminology
 * server. A value set the cache does not hold is left as it was, and listed.
 */
export function preExpand(q: Json, expansions: Map<string, Json>): { questionnaire: Json; expanded: string[]; missing: string[] } {
  const copy: Json = structuredClone(q);
  const expanded: string[] = [];
  const missing: string[] = [];
  const contained = new Map<string, Json>((copy.contained ?? []).filter((r: Json) => r.resourceType === "ValueSet").map((r: Json) => [`#${r.id}`, r]));
  const walk = (items: Json[] | undefined) => {
    for (const it of items ?? []) {
      if (it.answerValueSet && !it.answerOption) {
        const vs = contained.get(it.answerValueSet) ?? expansions.get(it.answerValueSet) ?? expansions.get(String(it.answerValueSet).split("|")[0]!);
        const cs = vs ? containsOf(vs) : [];
        if (cs.length) {
          it.answerOption = cs.map((c) => ({ valueCoding: { ...(c.system ? { system: c.system } : {}), code: c.code, ...(c.display ? { display: c.display } : {}) } }));
          delete it.answerValueSet;
          expanded.push(it.linkId);
        } else missing.push(it.linkId);
      }
      walk(it.item);
    }
  };
  walk(copy.item);
  return { questionnaire: copy, expanded, missing };
}

if (import.meta.main) {
  const a = process.argv.slice(2);
  const opt = (n: string) => (a.includes(n) ? a[a.indexOf(n) + 1] : undefined);
  const out = opt("--out");
  if (!out) {
    console.error("usage: terminology-index.ts --expansions <expansions.json> --txcache <dir> --out <dir>");
    process.exit(2);
  }
  const index = buildIndex({ expansions: opt("--expansions"), txcache: opt("--txcache") });
  const w = writeIndex(index, out);
  console.log(`${index.codes.length} code(s), ${Object.keys(index.valueSets).length} value set key(s) from ${index.sources.valueSets} expansion(s) and ${index.sources.txcacheFiles} txcache file(s) → ${join(out, w.file)} (${w.bytes} bytes)`);
  if (!index.codes.length) console.log("no code in the IG's cache: every search on the site will say so");
}
