#!/usr/bin/env bun
/**
 * Does the SOURCE graph carry dependency edges for an IG's logic layer?
 *
 * `fhir-ig-base/ig-publisher-reduction.md` §"P3 is BLOCKED on more than a fork"
 * measures the Publisher's EXPORTS — `fhir-artifact-index/index.json` — and finds
 * Library + PlanDefinition + Measure carrying no dependency edges at all. That
 * measurement holds, and the index has no edge field to hold one.
 *
 * `fsh-cone.ts` measures a different graph of the same IG: the
 * SOURCE (`.fsh` + `.cql`). This script asks whether that second graph covers the
 * logic layer well enough to mark staleness, and reports three numbers side by
 * side, per resource type, because an aggregate hides the answer:
 *
 *   1. EXPORT      — the artefact index's logic-layer count, and its edge count.
 *   2. EXTRACTED   — what `fsh-cone` actually extracts for those same artefacts,
 *                    including **how many DISTINCT targets** they reach. That
 *                    last column is the one that matters: 458 artefacts each
 *                    carrying one edge to the same shared `RuleSet` is 100 %
 *                    "coverage" and zero information.
 *   3. GROUND TRUTH — what is in the source once FSH `RuleSet` parameters are
 *                    substituted, which is what SUSHI does before the Publisher
 *                    ever sees a resource.
 *
 * The gap between (2) and (3) is the finding. See bean `folio-assistant-f4gj`.
 *
 * ## The gap was two causes, and this branch closed BOTH
 *
 * When first measured, pass 2 found **0 logic→logic edges** for all 458
 * artefacts — 8 distinct targets between them, every one a shared `RuleSet`.
 * Two separable causes, both now fixed in `fsh-cone.ts`:
 *
 * **(a)** The `Library ↔ cql (by name)` edge was guarded on `node.id`, and
 * every Library instance omits `Id:` and relies on SUSHI's name→id default, so
 * it fired 0 times.
 *
 * **(b)** PlanDefinition and Measure write their library edge *inside a
 * parameterised RuleSet* — `* library = Canonical({library}Logic)` — so the
 * token read literally was `{library}Logic`, which resolves to nothing.
 * `buildFshGraph` now substitutes a RuleSet's positional arguments into its
 * body before scanning, and tags what it finds `insert (parameter expanded)`.
 *
 * Measured on an ingested IG (bean `f4gj`), pass 2 now reaches **458 of 458** and every
 * logic target pass 3 names. **This tool's job is to keep it that way:** if
 * pass 2's logic→logic count ever drops below pass 3's, one of the two
 * regressed, and the difference says which.
 *
 * ## Pass 3 is still an approximation, and still not the extractor
 *
 * Passes 2 and 3 now agree on this IG, which is the point — but they are not
 * the same code and must not be collapsed. Pass 3 is a deliberately separate
 * reading of the source, so that pass 2 has something to be wrong against. An
 * IG whose RuleSets use a form only one of them handles will show up as a
 * disagreement, which is the signal this file exists to produce.
 *
 * ## The ground-truth pass is an APPROXIMATION, deliberately labelled
 *
 * Pass 3 reimplements enough of SUSHI's `insert` semantics to substitute
 * positional `{param}` arguments. It is not SUSHI. It exists to establish that
 * the edges are PRESENT in source — a lower bound on what a real expansion would
 * find — not to be the extractor. Do not wire it into a build: an approximation
 * of SUSHI that is silently wrong about one edge is exactly what P3's staleness
 * contract forbids.
 *
 * Usage:
 *   bun run fhir-harness/scripts/measure-logic-layer-edges.ts <ig-root> <artifact-index.json>
 *   bun run fhir-harness/scripts/measure-logic-layer-edges.ts --help
 *
 * @module fhir-harness/scripts/measure-logic-layer-edges
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { buildFshGraph, type FshGraph } from "./fsh-cone.ts";
import { igReadScope } from "./ig-read-scope.ts";

/** The three resource types the skill's 61 % is built from. */
export const LOGIC_TYPES = ["Library", "PlanDefinition", "Measure"] as const;
export type LogicType = (typeof LOGIC_TYPES)[number];

/**
 * How an `InstanceOf:` token names a logic-layer resource type. Two of the three
 * are named by a dependency-package profile URL, not by a bare type — which is
 * itself why `fsh-cone` records only a handful of `InstanceOf` edges for this IG.
 */
const INSTANCE_OF_TO_TYPE: Record<string, LogicType> = {
  Library: "Library",
  "http://hl7.org/fhir/uv/cpg/StructureDefinition/cpg-recommendationdefinition": "PlanDefinition",
  "http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm": "Measure",
};

const DECL_RE =
  /^(Profile|Extension|Logical|Resource|ValueSet|CodeSystem|Instance|Mapping|RuleSet|Invariant):\s*([^\s(]+)(?:\(([^)]*)\))?/;

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

interface FshBlock {
  kind: string;
  name: string;
  /** Declared parameters, for a `RuleSet: Name(a, b)`. */
  params: string[];
  lines: string[];
}

/** The files with `ext` under `rel` that the IG's contentTypes.ig.include declares. */
function declaredWalk(igRoot: string, rel: string, ext: string): string[] {
  const scope = igReadScope(igRoot);
  if (!scope.reaches(rel)) return [];
  return walk(join(scope.root, rel), ext).filter((f) => scope.declares(relative(scope.root, f)));
}

/** Every declaration in `input/fsh`, with its body and (for RuleSets) its parameters. */
export function readFshBlocks(igRoot: string): FshBlock[] {
  const blocks: FshBlock[] = [];
  for (const file of declaredWalk(igRoot, "input/fsh", ".fsh")) {
    let current: FshBlock | undefined;
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.replace(/(^|\s)\/\/.*$/, "$1");
      const d = line.match(DECL_RE);
      if (d) {
        current = {
          kind: d[1],
          name: d[2],
          params: (d[3] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
          lines: [],
        };
        blocks.push(current);
        continue;
      }
      if (current) current.lines.push(line);
    }
  }
  return blocks;
}

/** The `library <name>` of every `.cql` file under `input/cql`. */
export function readCqlNames(igRoot: string): Set<string> {
  const names = new Set<string>();
  for (const file of declaredWalk(igRoot, "input/cql", ".cql")) {
    const m = readFileSync(file, "utf8").match(/^\s*library\s+"?([A-Za-z0-9_]+)"?/m);
    if (m) names.add(m[1]);
  }
  return names;
}

/** The logic-layer type of an FSH block, or undefined if it is not one. */
export function logicTypeOf(block: FshBlock): LogicType | undefined {
  if (block.kind !== "Instance") return undefined;
  const io = block.lines.find((l) => /^InstanceOf:/.test(l));
  if (!io) return undefined;
  return INSTANCE_OF_TO_TYPE[io.replace(/^InstanceOf:\s*/, "").trim().split("|")[0]];
}

/** Split `insert R(a, [[b, c]], "d")` arguments at top-level commas only. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let brackets = 0;
  let quoted = false;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (s.startsWith("[[", i)) { brackets++; cur += "[["; i++; continue; }
    if (s.startsWith("]]", i)) { brackets--; cur += "]]"; i++; continue; }
    if (c === '"') quoted = !quoted;
    if (!quoted && !brackets) {
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Join an `insert` whose argument list runs over several lines. */
function joinInserts(lines: string[]): string[] {
  const out: string[] = [];
  let buf = "";
  for (const line of lines) {
    const t = buf ? `${buf} ${line.trim()}` : line;
    const open = (t.match(/\(/g) ?? []).length;
    const close = (t.match(/\)/g) ?? []).length;
    if (/insert\s+[A-Za-z0-9_-]+\s*\(/.test(t) && open > close) { buf = t; continue; }
    buf = "";
    out.push(t);
  }
  if (buf) out.push(buf);
  return out;
}

const INSERT_RE = /^\s*\*?\s*insert\s+([A-Za-z0-9_-]+)\s*(?:\(([\s\S]*)\))?\s*$/;

/** Substitute `{param}` with the call's positional argument, recursively. */
function expandInserts(
  lines: string[],
  rulesets: Map<string, FshBlock>,
  depth = 0,
): string[] {
  if (depth > 6) return lines;
  const out: string[] = [];
  for (const line of lines) {
    out.push(line);
    const m = line.match(INSERT_RE);
    if (!m) continue;
    const rs = rulesets.get(m[1]);
    if (!rs) continue;
    const args = m[2] ? splitArgs(m[2]) : [];
    const substituted = rs.lines.map((l) => {
      let r = l;
      rs.params.forEach((p, i) => {
        const arg = (args[i] ?? "").replace(/^\[\[|\]\]$/g, "").replace(/^"|"$/g, "");
        r = r.split(`{${p}}`).join(arg);
      });
      return r;
    });
    out.push(...expandInserts(substituted, rulesets, depth + 1));
  }
  return out;
}

// Two passes, not one alternation: a `library = …` branch matches at an earlier
// index than the `Canonical(` that follows it and swallows the token.
const CANONICAL_CALL_RE = /Canonical\(\s*([^)|]+?)\s*(?:\|[^)]*)?\)/g;
const CANONICAL_ASSIGN_RE =
  /(?:^|\s)(?:library|definitionCanonical|instantiatesCanonical|derivedFrom)\s*=\s*"?([^"\s()]+)"?/gm;

export interface TypeRow {
  /** Artefacts of this type in the FSH source. */
  n: number;
  /** ...carrying >= 1 outgoing edge in `fsh-cone` as merged. */
  withOutEdge: number;
  /** ...carrying >= 1 incoming edge in `fsh-cone` as merged. */
  withInEdge: number;
  /** Distinct nodes the whole type depends on — the column that matters. */
  distinctTargets: Set<string>;
  /** Mean outgoing degree in `fsh-cone` as merged. */
  meanOutDegree: number;
  /** ...carrying >= 1 edge to ANOTHER logic artefact, after RuleSet expansion. */
  withLogicEdge: number;
  /** Distinct logic artefacts reached after RuleSet expansion. */
  distinctLogicTargets: Set<string>;
}

export interface Measurement {
  graph: FshGraph;
  rows: Record<LogicType, TypeRow>;
  /** Logic-layer counts from the artefact index, by resource type. */
  exportCounts: Record<string, number>;
  exportTotal: number;
  /** Every field name any artefact in the index carries. */
  exportFields: string[];
  /** Index ids with no matching FSH source declaration. */
  unmatchedExportIds: string[];
}

export function measure(igRoot: string, indexPath: string): Measurement {
  const graph = buildFshGraph(igRoot);
  const blocks = readFshBlocks(igRoot);
  const rulesets = new Map(blocks.filter((b) => b.kind === "RuleSet").map((b) => [b.name, b]));
  const cqlNames = readCqlNames(igRoot);
  const libraryInstances = new Set(
    blocks.filter((b) => logicTypeOf(b) === "Library").map((b) => b.name),
  );

  const rows = Object.fromEntries(
    LOGIC_TYPES.map((t) => [t, {
      n: 0, withOutEdge: 0, withInEdge: 0, distinctTargets: new Set<string>(),
      meanOutDegree: 0, withLogicEdge: 0, distinctLogicTargets: new Set<string>(),
    }]),
  ) as Record<LogicType, TypeRow>;

  const sourceNames = new Set<string>();
  const outDegreeSum: Record<string, number> = { Library: 0, PlanDefinition: 0, Measure: 0 };

  for (const block of blocks) {
    const type = logicTypeOf(block);
    if (!type) continue;
    const row = rows[type];
    row.n++;
    sourceNames.add(block.name);

    // Pass 2 — `fsh-cone` as merged.
    const node = graph.nodes.get(block.name);
    const outDeps = node ? node.deps : new Set<string>();
    const inDeps = graph.dependents.get(block.name)?.size ?? 0;
    if (outDeps.size > 0) row.withOutEdge++;
    if (inDeps > 0) row.withInEdge++;
    outDegreeSum[type] += outDeps.size;
    for (const d of outDeps) row.distinctTargets.add(d);

    // Pass 3 — ground truth, after RuleSet parameter substitution.
    const expanded = expandInserts(joinInserts(block.lines), rulesets).join("\n");
    const found = new Set<string>();
    for (const m of [
      ...expanded.matchAll(CANONICAL_CALL_RE),
      ...expanded.matchAll(CANONICAL_ASSIGN_RE),
    ]) {
      const token = (m[1] ?? "").trim();
      if (!token || token.includes("{")) continue;
      const name = token.split("/").pop()!.split("|")[0];
      if (cqlNames.has(name) || libraryInstances.has(name)) found.add(name);
    }
    // The cql-to-FHIR convention: an Instance with no `Id:` takes its name as id.
    if (type === "Library" && cqlNames.has(block.name)) found.add(block.name);
    if (found.size > 0) row.withLogicEdge++;
    for (const f of found) row.distinctLogicTargets.add(f);
  }
  for (const t of LOGIC_TYPES) rows[t].meanOutDegree = rows[t].n ? outDegreeSum[t] / rows[t].n : 0;

  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  const artifacts: Array<Record<string, unknown>> = index.artifacts ?? index;
  const exportCounts: Record<string, number> = {};
  const exportFields = new Set<string>();
  const unmatchedExportIds: string[] = [];
  for (const a of artifacts) {
    for (const k of Object.keys(a)) exportFields.add(k);
    const rt = String(a.resourceType);
    if (!(LOGIC_TYPES as readonly string[]).includes(rt)) continue;
    exportCounts[rt] = (exportCounts[rt] ?? 0) + 1;
    if (!sourceNames.has(String(a.id))) unmatchedExportIds.push(String(a.key ?? a.id));
  }

  return {
    graph, rows, exportCounts,
    exportTotal: artifacts.length,
    exportFields: [...exportFields].sort(),
    unmatchedExportIds,
  };
}

const pct = (a: number, b: number): string => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");

export function report(m: Measurement): string {
  const out: string[] = [];
  const logicExport = LOGIC_TYPES.reduce((s, t) => s + (m.exportCounts[t] ?? 0), 0);

  out.push("== 1. EXPORT SIDE — the Publisher's artefact index ==");
  out.push(`   ${m.exportTotal} artefacts; logic layer ${logicExport} = ${pct(logicExport, m.exportTotal)}`);
  out.push(`   ${LOGIC_TYPES.map((t) => `${t}=${m.exportCounts[t] ?? 0}`).join("  ")}`);
  out.push(`   fields present: ${m.exportFields.join(", ")}`);
  const hasEdgeField = m.exportFields.some((f) => /depend|edge|require|relatedartifact/i.test(f));
  out.push(`   a field that could hold a dependency edge: ${hasEdgeField ? "YES" : "NONE"}`);
  out.push(`   export ids with no matching FSH declaration: ${m.unmatchedExportIds.length}` +
    (m.unmatchedExportIds.length ? `  e.g. ${m.unmatchedExportIds.slice(0, 5).join(", ")}` : ""));

  out.push("");
  out.push("== 2. fsh-cone AS IT STANDS — edges it extracts for those same artefacts ==");
  out.push("   'distinct targets' is the column that matters: N artefacts each carrying one");
  out.push("   edge to the SAME shared RuleSet is 100% coverage and zero information.");
  out.push("");
  out.push("   type              n   >=1 out-dep    >=1 dependent   mean out-deg   DISTINCT TARGETS");
  let n = 0, o = 0, i = 0;
  const allTargets = new Set<string>();
  for (const t of LOGIC_TYPES) {
    const r = m.rows[t];
    n += r.n; o += r.withOutEdge; i += r.withInEdge;
    for (const x of r.distinctTargets) allTargets.add(x);
    out.push(`   ${t.padEnd(16)}${String(r.n).padStart(4)}  ` +
      `${String(r.withOutEdge).padStart(4)} (${pct(r.withOutEdge, r.n).padStart(6)})  ` +
      `${String(r.withInEdge).padStart(5)} (${pct(r.withInEdge, r.n).padStart(6)})  ` +
      `${r.meanOutDegree.toFixed(2).padStart(11)}   ${String(r.distinctTargets.size).padStart(6)}`);
  }
  out.push(`   ${"TOTAL".padEnd(16)}${String(n).padStart(4)}  ${String(o).padStart(4)} (${pct(o, n)})  ` +
    `${String(i).padStart(5)} (${pct(i, n)})                  ${allTargets.size}`);
  const kinds = [...allTargets].map((t) => m.graph.nodes.get(t)?.kind ?? "?");
  const allRuleSets = kinds.length > 0 && kinds.every((k) => k === "RuleSet");
  out.push(`   every distinct target is a shared RuleSet: ${allRuleSets ? "YES" : "no"}`);
  const logicToLogic = [...allTargets].filter((t) => {
    const b = m.graph.nodes.get(t);
    return b && (b.kind === "CQL" || LOGIC_TYPES.some((lt) => m.rows[lt].distinctLogicTargets.has(t)));
  }).length;
  out.push(`   logic -> logic edges: ${logicToLogic}`);

  out.push("");
  out.push("== 3. GROUND TRUTH — after FSH RuleSet parameter substitution ==");
  out.push("   APPROXIMATION of SUSHI, for presence only. Not an extractor. See module header.");
  out.push("");
  out.push("   type              n   >=1 real logic edge   distinct logic targets");
  let gn = 0, gh = 0;
  for (const t of LOGIC_TYPES) {
    const r = m.rows[t];
    gn += r.n; gh += r.withLogicEdge;
    out.push(`   ${t.padEnd(16)}${String(r.n).padStart(4)}  ${String(r.withLogicEdge).padStart(6)} ` +
      `(${pct(r.withLogicEdge, r.n).padStart(6)})            ${r.distinctLogicTargets.size}`);
  }
  out.push(`   ${"TOTAL".padEnd(16)}${String(gn).padStart(4)}  ${String(gh).padStart(6)} (${pct(gh, gn)})`);
  out.push("");
  out.push("   (2) and (3) read the same source by different means, so a DISAGREEMENT is");
  out.push("   the signal: an edge (3) names that (2) misses is an artefact whose staleness");
  out.push("   cannot be marked. Both causes are fixed; they agreed 458/458 when last");
  out.push("   measured on an ingested IG. Bean folio-assistant-f4gj.");
  return out.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: bun run fhir-harness/scripts/measure-logic-layer-edges.ts <ig-root> <artifact-index.json>\n\n" +
      "  <ig-root>              a checkout of the IG (the directory holding sushi-config.yaml)\n" +
      "  <artifact-index.json>  the Publisher's fhir-artifact-index/index.json for that IG\n",
    );
    process.exit(args.length < 2 ? 1 : 0);
  }
  console.log(report(measure(args[0], args[1])));
}
