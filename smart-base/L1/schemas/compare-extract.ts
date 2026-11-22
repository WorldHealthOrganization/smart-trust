/**
 * Compares two extractor outputs — a committed fixture against a fresh
 * extraction — ignoring what legitimately differs between two runs: the
 * timestamp, and the paths the sources were read from. A port of WHO smart-kg
 * `tools/compare-extract.mjs` (main 3f5e477); generic over every layer.
 *
 * Everything else must match — the SHA-256 of every source included. If the
 * source of a fixture is edited, this fails with the hash that changed, rather
 * than the fixture continuing to describe a file that no longer exists in that form.
 *
 *   npx tsx L1/schemas/compare-extract.ts <committed.json> <fresh.json>
 */
import { readFileSync } from "node:fs";

import { isMain } from "./extract-doc.ts";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const isObj = (v: Json | undefined): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** A path reduced to its file name, keeping any #fragment (which names an element, not a directory). */
const stripPath = (v: Json): Json => {
  if (typeof v !== "string") return v;
  const [path, ...frag] = v.split("#") as [string, ...string[]];
  if (!path.includes("/")) return v;
  return [path.slice(path.lastIndexOf("/") + 1), ...frag].join("#");
};

/**
 * The document with `generatedAt` and every source path removed or reduced to
 * a file name. A fixture is extracted from a relative path and CI from a clone
 * elsewhere; the file identity that matters is its SHA-256, and that IS compared.
 */
export function normalise(doc: Json): Json {
  const d = JSON.parse(JSON.stringify(doc)) as Json;
  if (!isObj(d)) return d;
  delete d.generatedAt;
  const sources = d.wasDerivedFrom;
  if (Array.isArray(sources)) for (const src of sources) if (isObj(src)) delete src.path;
  const walk = (v: Json): Json => {
    if (Array.isArray(v)) return v.map(walk);
    if (isObj(v)) {
      for (const k of Object.keys(v)) v[k] = k === "location" || k === "source" ? stripPath(v[k]!) : walk(v[k]!);
      return v;
    }
    return v;
  };
  return walk(d);
}

export interface Comparison {
  same: boolean;
  /** What moved, one line each; empty when the two match. */
  findings: string[];
}

const list = (d: Json, k: string): Obj[] => (isObj(d) && Array.isArray(d[k]) ? (d[k] as Json[]).filter(isObj) : []);
const str = (v: Json | undefined): string => (typeof v === "string" ? v : JSON.stringify(v));

/** Compare two extractor outputs, after {@link normalise}. */
export function compare(committed: Json, fresh: Json): Comparison {
  const A = normalise(committed);
  const B = normalise(fresh);
  if (JSON.stringify(A) === JSON.stringify(B)) return { same: true, findings: [] };

  const findings: string[] = [];
  const idx = (d: Json) => new Map(list(d, "nodes").map((n) => [str(n.id), n]));
  const [ia, ib] = [idx(A), idx(B)];
  const gone = [...ia.keys()].filter((k) => !ib.has(k));
  const added = [...ib.keys()].filter((k) => !ia.has(k));
  const changed = [...ia.keys()].filter((k) => ib.has(k) && JSON.stringify(ia.get(k)) !== JSON.stringify(ib.get(k)));

  const srcA = list(A, "wasDerivedFrom");
  const srcB = list(B, "wasDerivedFrom");
  srcA.forEach((s, i) => {
    const t = srcB[i];
    if (t && s.sha256 !== t.sha256) findings.push(`source ${i} hash changed: ${str(s.sha256)} -> ${str(t.sha256)}`);
  });
  if (gone.length) findings.push(`${gone.length} node(s) no longer produced, e.g. ${gone[0]}`);
  if (added.length) findings.push(`${added.length} new node(s), e.g. ${added[0]}`);
  if (changed.length) findings.push(`${changed.length} node(s) changed, e.g. ${changed[0]}`);

  const key = (e: Obj) => `${str(e.predicate)}|${str(e.source)}|${str(e.target)}`;
  const ea = new Map(list(A, "edges").map((e) => [key(e), e]));
  const eb = new Map(list(B, "edges").map((e) => [key(e), e]));
  const eGone = [...ea.keys()].filter((k) => !eb.has(k));
  const eAdded = [...eb.keys()].filter((k) => !ea.has(k));
  const eChanged = [...ea.keys()].filter((k) => eb.has(k) && JSON.stringify(ea.get(k)) !== JSON.stringify(eb.get(k)));
  if (eGone.length) findings.push(`${eGone.length} edge(s) no longer produced, e.g. ${eGone[0]}`);
  if (eAdded.length) findings.push(`${eAdded.length} new edge(s), e.g. ${eAdded[0]}`);
  if (eChanged.length) {
    findings.push(`${eChanged.length} edge(s) changed, e.g. ${eChanged[0]}`);
    const [x, y] = [ea.get(eChanged[0]!)!, eb.get(eChanged[0]!)!];
    for (const f of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) {
        findings.push(
          `    ${f}:\n        committed: ${JSON.stringify(x[f]).slice(0, 160)}` + `\n        fresh:     ${JSON.stringify(y[f]).slice(0, 160)}`,
        );
      }
    }
  }
  // Never report "differs" without saying where. A failure that cannot be localised is one nobody can act on.
  if (!gone.length && !added.length && !changed.length && !eGone.length && !eAdded.length && !eChanged.length) {
    findings.push(`The difference is outside nodes and edges. Committed vs fresh document keys:`);
    const a = isObj(A) ? A : {};
    const b = isObj(B) ? B : {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        findings.push(
          `    ${k}:\n        committed: ${JSON.stringify(a[k]).slice(0, 200)}` + `\n        fresh:     ${JSON.stringify(b[k]).slice(0, 200)}`,
        );
      }
    }
  }
  return { same: false, findings };
}

function main(argv: string[]): number {
  const [a, b] = argv;
  if (!a || !b) {
    console.error("usage: compare-extract.ts <committed.json> <fresh.json>");
    return 2;
  }
  const result = compare(JSON.parse(readFileSync(a, "utf8")) as Json, JSON.parse(readFileSync(b, "utf8")) as Json);
  if (result.same) {
    console.log(`${a}: matches a fresh extraction from upstream`);
    return 0;
  }
  console.error(`${a}: DIFFERS from a fresh extraction from upstream.`);
  for (const f of result.findings) console.error(`  ${f}`);
  console.error(`  Re-run the extractor and commit the result, or fix what regressed.`);
  return 1;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
