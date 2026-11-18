#!/usr/bin/env bun
/**
 * A paper's block graph as UML: chapters as packages, one box per block,
 * editorial and formal edges drawn apart, and each block filled by its
 * formalization status. The `graph-rendering` skill applied to papers and to
 * Lean proofs at once.
 *
 * `buildContentGraph` holds both relations over the same nodes: `editorial`
 * edges from `uses[]` and `interprets` (what a READER needs first) and
 * `formal` edges from the Lean dependency cache (what the PROOF needs).
 *
 * The relations stay distinct (rule 4): editorial is solid and black, formal is
 * dashed and purple, and neither is ever derived from the other. `uses[]` is
 * authored; populating it from Lean destroys the signal every ordering metric
 * is computed from (`AGENTS.md`, `uses-editorial-review`).
 *
 * ## Output
 *
 * ```
 * <out>/content-graph.puml                the whole paper (portrait)
 * <out>/content-graph/<chapter>.puml      one chapter; cross-chapter targets as stubs
 * <out>/…/*.svg, *.landscape.svg          both views, stamped with the source hash
 * ```
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-content-graph-uml.ts --root <content dir> --out <dir> \
 *     [--status proof-objects.json] [--check]
 *
 * Run it from a folio, against that folio's content directory.
 *
 * @module scripts/gen-content-graph-uml
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { buildContentGraph, isElaborated, type ContentGraph } from "../pipeline/content-graph.js";
import type { FormalizationStatus, ProofObjectsManifest } from "../schemas/formalization-types.js";
import { bothViews, renderSvgs, safeId, sha256, svgStamp, type RenderJob } from "./plantuml-render.js";
import { readUmlPalette } from "./uml-palette.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const HARNESS = resolve(HARNESS_ROOT);
const REPO = resolve(HARNESS, "..");
const GENERATOR = relative(REPO, import.meta.path);

// ── The model ─────────────────────────────────────────────────────────────

/** How far a block's formal claim has got; `reviewed_*` outranks the Lean status. */
export type BlockStatus = FormalizationStatus | "reviewed_human" | "reviewed_agentic";

export interface BlockNode {
  label: string;
  kind: string;
  /** Chapter: the block manifest's directory, relative to the content root. */
  group: string;
  leanRef?: string;
  status?: BlockStatus;
}

export interface BlockEdge {
  from: string;
  to: string;
  kind: "editorial" | "formal";
  /** `uses` / `interprets` for editorial; `type` / `value` for formal. */
  via: string;
}

export interface BlockModel {
  nodes: BlockNode[];
  edges: BlockEdge[];
  /**
   * Where the formal edges came from — `undefined` when there is no formal
   * cache. The legend states it: a lexical `scan` graph (measured recall 0.63,
   * folio-assistant#1492) drawn without comment reads as authoritative, and no
   * cache at all reads as "nothing depends on anything formally".
   */
  formalSource?: string;
}

/** The legend's formal-edge line, saying what the purple edges can be trusted for. */
export function formalLegend(source: string | undefined): string {
  if (source === undefined) return "  dashed purple: formal, a Lean dependency: UNAVAILABLE here (no formal cache), so none drawn";
  if (isElaborated(source)) return `  dashed purple: formal, a Lean dependency (type / value), source ${source} (elaborated)`;
  return `  dashed purple: formal, a Lean dependency, source ${source}: APPROXIMATE (lexical), missing edges likely`;
}

/** The status a block is drawn with: a human review, else an agentic one, else its Lean status. */
export function statusOf(obj: ProofObjectsManifest["objects"][number]): BlockStatus | undefined {
  const reviews = obj.reviews ?? [];
  if (reviews.some((r) => r.reviewer_type === "human")) return "reviewed_human";
  if (reviews.some((r) => r.reviewer_type === "agentic")) return "reviewed_agentic";
  return obj.formalization_status;
}

/** Read `proof-objects.json`, checking the two fields this uses rather than casting. */
export function readStatus(file: string): Map<string, BlockStatus> {
  const doc = JSON.parse(readFileSync(file, "utf8")) as Partial<ProofObjectsManifest>;
  if (!Array.isArray(doc.objects)) throw new Error(`${file}: no objects[] — not a proof-objects manifest`);
  const out = new Map<string, BlockStatus>();
  for (const o of doc.objects) {
    if (typeof o?.label !== "string") throw new Error(`${file}: an object has no label`);
    const s = statusOf(o);
    if (s) out.set(o.label, s);
  }
  return out;
}

/** The content graph, reduced to what a drawing shows. */
export function modelOf(g: ContentGraph, contentRoot: string, status?: Map<string, BlockStatus>): BlockModel {
  const nodes = [...g.nodes.values()]
    .map((n) => ({
      label: n.label,
      kind: n.kind,
      group: relative(contentRoot, dirname(n.ts)).replace(/\\/g, "/") || "(root)",
      leanRef: n.leanRef,
      status: status?.get(n.label),
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  const edges = g.edges
    .filter((e) => g.nodes.has(e.from) && g.nodes.has(e.to))
    .map((e) => ({
      from: e.from,
      to: e.to,
      kind: e.kind,
      via: e.kind === "editorial" ? (e.editorialField ?? "uses") : (e.formalKind ?? "formal"),
    }))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.via.localeCompare(b.via));
  return { nodes, edges, formalSource: g.hasFormal ? g.formalSource : undefined };
}

// ── PlantUML ──────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/"/g, "'");
const nodeId = (label: string) => safeId(`b_${label}`);

/**
 * One diagram. With `only`, the chapter's own blocks are drawn in full and any
 * block an edge reaches in another chapter is drawn as a dashed stub, so a
 * chapter diagram says where its edges go without drawing the whole paper.
 */
export function contentGraphPuml(
  m: BlockModel,
  opts: { name: string; title: string; statusFill: Record<string, string>; only?: string },
): string {
  const inScope = (n: BlockNode) => !opts.only || n.group === opts.only;
  const byLabel = new Map(m.nodes.map((n) => [n.label, n]));
  const edges = m.edges.filter((e) => {
    const a = byLabel.get(e.from)!;
    const b = byLabel.get(e.to)!;
    return inScope(a) || inScope(b);
  });
  const stubs = new Set<string>();
  for (const e of edges) for (const l of [e.from, e.to]) if (!inScope(byLabel.get(l)!)) stubs.add(l);

  const L = [
    `' GENERATED by ${GENERATOR} — do not edit.`,
    "' A paper's block graph: editorial edges (uses / interprets) solid, formal",
    "' Lean edges dashed purple, never one derived from the other.",
    `@startuml ${safeId(opts.name)}`,
    "!pragma layout elk",
    "!theme plain",
    "skinparam classAttributeIconSize 0",
    "skinparam shadowing false",
    "skinparam packageStyle rectangle",
    "hide empty methods",
    "hide circle",
    "",
    `title ${esc(opts.title)}`,
    "",
  ];
  const groups = [...new Set(m.nodes.filter(inScope).map((n) => n.group))];
  for (const gname of groups) {
    L.push(`package "${esc(gname)}" as ${safeId(`pkg_${gname}`)} {`);
    for (const n of m.nodes.filter((x) => x.group === gname && inScope(x))) {
      const fill = n.status ? (opts.statusFill[n.status] ?? "") : "";
      L.push(`  class "${esc(n.label)}" as ${nodeId(n.label)} <<${esc(n.kind)}>> ${fill} {`);
      // Rule 3: never an empty box. A block with no Lean says so.
      if (n.leanRef) L.push(`    lean.ref : ${esc(n.leanRef)}`);
      if (n.status) L.push(`    status : ${n.status}`);
      if (!n.leanRef && !n.status) L.push("    //prose only: no lean.ref//");
      L.push("  }");
    }
    L.push("}");
  }
  for (const label of [...stubs].sort()) {
    const n = byLabel.get(label)!;
    L.push(`class "${esc(label)}" as ${nodeId(label)} <<in ${esc(n.group)}>> #FFFFFF;line.dashed {`);
    L.push(`  //drawn in full on the ${esc(n.group)} diagram//`);
    L.push("}");
  }
  L.push("");
  for (const e of edges) {
    const arrow = e.kind === "editorial" ? "-->" : "-[#6a3d9a,dashed]->";
    L.push(`${nodeId(e.from)} ${arrow} ${nodeId(e.to)} : ${e.via}`);
  }
  L.push(
    "",
    // Top right: at the default position ELK let a stub box run into it.
    "legend top right",
    "  solid black: editorial, a reader's prerequisite (uses / interprets)",
    formalLegend(m.formalSource),
    "  fill: formalization status, from proof-objects.json when given",
    "  dashed box: a block in another chapter",
    "endlegend",
    "@enduml",
  );
  return L.join("\n") + "\n";
}

// ── main ──────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Every `.puml` this generator writes, keyed by path. */
export function buildFiles(m: BlockModel, out: string, statusFill: Record<string, string>): Map<string, string> {
  const files = new Map<string, string>();
  files.set(join(out, "content-graph.puml"), contentGraphPuml(m, { name: "content-graph", title: "Block graph", statusFill }));
  for (const g of [...new Set(m.nodes.map((n) => n.group))]) {
    files.set(
      join(out, "content-graph", `${safeId(g)}.puml`),
      contentGraphPuml(m, { name: `content-graph_${g}`, title: `Block graph — ${g}`, statusFill, only: g }),
    );
  }
  return files;
}

async function main(): Promise<void> {
  const root = arg("root");
  const out = arg("out");
  if (!root || !out) {
    console.error("usage: gen-content-graph-uml.ts --root <content dir> --out <dir> [--status proof-objects.json] [--check]");
    process.exit(2);
  }
  const statusFile = arg("status");
  const status = statusFile ? readStatus(statusFile) : undefined;
  const m = modelOf(buildContentGraph(resolve(root)), resolve(root), status);
  if (m.nodes.length === 0) {
    // Not a pass: a graph with no nodes is a wrong --root, and drawing an empty
    // diagram would say the paper has no blocks.
    console.error(`could not determine: no blocks under ${root}`);
    process.exit(2);
  }
  const files = buildFiles(m, resolve(out), readUmlPalette(HARNESS).status);
  const jobs: RenderJob[] = [...files].flatMap(([p, text]) => bothViews(p, text, p.replace(/\.puml$/, ".svg")));
  const own = new Set([...files.keys(), ...jobs.map((j) => j.svg)]);
  const orphans = walk(resolve(out)).filter(
    (p) => /content-graph(\/|\.)/.test(relative(resolve(out), p)) && /\.(puml|svg)$/.test(p) && !own.has(p),
  );

  if (process.argv.includes("--check")) {
    const stale = [...files].filter(([p, t]) => !existsSync(p) || readFileSync(p, "utf8") !== t).map(([p]) => p);
    for (const j of jobs) if (svgStamp(j.svg) !== sha256(j.text)) stale.push(j.svg);
    if (stale.length || orphans.length) {
      for (const p of stale) console.error(`stale: ${p}`);
      for (const p of orphans) console.error(`orphan: ${p}`);
      process.exit(1);
    }
    console.log(`block graph is current — ${m.nodes.length} blocks, ${m.edges.length} edges, ${files.size} diagram(s)`);
    return;
  }
  for (const p of orphans) rmSync(p);
  for (const [p, t] of files) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, t);
  }
  const r = await renderSvgs(jobs, { repo: REPO, generator: GENERATOR });
  if (r.skipped) {
    console.error(`SVGs NOT rendered (${r.skipped}); set PLANTUML_JAR or install java, then re-run`);
    process.exit(2);
  }
  console.log(`wrote ${files.size} diagram(s) for ${m.nodes.length} blocks; rendered ${r.rendered} SVG(s)`);
}

// Guarded: an import must write nothing (see gen-uml-overview.ts).
if (import.meta.main) await main();
