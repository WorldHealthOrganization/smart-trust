#!/usr/bin/env bun
/**
 * The workflow page's process table covers every declared BPMN — read from the
 * published named-subgraph JSON-LD, the only store it has.
 *
 * The page walks `docs/subgraph/index.jsonld` down to every `processes`
 * subgraph's `index.hydrated.jsonld`; this gate checks the same files:
 *
 *   1. the repository index, every harness root and every `processes`
 *      subgraph it reaches exist and validate against `schemas/kg/subgraph-manifest.ts`;
 *   2. every `.bpmn` a layer in this graph's corpus declares has a
 *      `Process` node there — recomputed from the declarations, so the
 *      published files cannot vouch for themselves;
 *   3. every such node carries its diagram's documentation (`summary`), and
 *      a `depiction` names an SVG that is there;
 *   4. no node names a diagram that is not declared;
 *   5. the page still carries the container the view mounts on, with a
 *      `<noscript>` fallback.
 *
 * ## Diagrams of instances this graph does not frame
 *
 * Lower layers (`bootstrap`, `bootstrap-tools`) publish their own subgraphs
 * at their own sites, linked from the repository index with `seeAlso`. Such a
 * diagram is covered when that link is there AND bootstrap-tools'
 * `buildSubgraphs` (run here in process, nothing fetched) holds a documented
 * Process node for it, keyed by its `source` IRI. An unframed layer with
 * no such link is LISTED as not covered, with the reason, never folded into a
 * clean total. Which layers are unframed is computed (`framedInstances`).
 *
 * Staleness (the files differ from what the generator writes now) is
 * `subgraph:jsonld:check`'s, not this gate's.
 *
 * Usage:  bun run cat check:process-index
 * Exit:   0 covered (with any out-of-graph diagrams listed) · 1 a covered
 *         layer's diagram is missing or undocumented, a node is stale, or
 *         the page lost its mount
 *
 * @covers processes, docs
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { docsSources } from "./lib/docs-sources.ts";
import { existsSync, readFileSync } from "node:fs";
import { overlayPath } from "./lib/layer-output.ts";
import { join, relative, resolve, sep } from "node:path";

import { workflowFiles } from "./known-skills.ts";
import { isGlobalTasksFile } from "../src/workflow/process-model.ts";
import { SubgraphHydratedSchema, SubgraphIndexSchema, SUBGRAPH_HYDRATED_FILE, SUBGRAPH_INDEX_FILE } from "../schemas/kg/subgraph-manifest.ts";
import { docsSourceDirFor, layerRootsIn, readDeclaration, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { framedInstances as framedRoots, subgraphOutDir } from "./gen-subgraph-jsonld.ts";
import { readKnowledgeGraphDeclaration } from "@litlfred/bootstrap-tools/schemas/declaration.ts";
import { buildSubgraphs, publicationBase } from "@litlfred/bootstrap-tools/scripts/subgraph-jsonld.ts";
import { gateOwnsFile } from "./lib/gate-own.ts";

const ROOT = HARNESS_ROOT;
const REPO = repoRootFor(ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));
const OUT = join(ROOT, subgraphOutDir(ROOT));
/**
 * The block that mounts the view, in whichever docs source holds its page —
 * the page may be authored by a layer above this one (`lib/docs-sources.ts`).
 * The base layer's own path when no source holds it, so a missing page is
 * still reported where it was expected.
 */
export const PAGE_BLOCK = join("process-publication-workflow", "every-workflow-in-the-repo.md");

/**
 * The page that mounts the process view: in a docs source stacked on the
 * base layer (`docsSources`), else in ANY layer of the checkout that holds
 * it. cat-harness#445 moved it up to the content core; a walk of the base
 * layer's dependents alone did not reach the core in every checkout
 * (smart-ra#242's simulation), so the gate demanded the page at the base
 * layer's old path, which nothing writes any more. Only when NO layer holds
 * it is the base layer's path named, as the place it was expected — a page
 * gone from every layer is still the defect this gate reports.
 */
export function processIndexPage(root: string = ROOT, repo: string = REPO): string {
  const stacked = docsSources(root).map((s) => join(s.srcDir, PAGE_BLOCK)).find((f) => existsSync(f));
  if (stacked !== undefined) return stacked;
  for (const layer of layerRootsIn(repo)) {
    let src: string;
    try {
      src = docsSourceDirFor(layer);
    } catch {
      continue; // no readable declaration: not a docs source
    }
    const f = join(src, PAGE_BLOCK);
    if (existsSync(f)) return f;
  }
  return join(docsSourceDirFor(root), PAGE_BLOCK);
}
const PAGE = processIndexPage();

type Doc = Record<string, unknown>;
const list = (v: unknown): unknown[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const repoRel = (abs: string): string => relative(REPO, abs).split(sep).join("/");

/** Every `.bpmn` any layer under the repository declares, by owning layer root. */
export function declaredDiagrams(repoRoot: string = REPO): Map<string, string> {
  const out = new Map<string, string>();
  for (const inst of layerRootsIn(repoRoot)) {
    for (const abs of workflowFiles(inst, "instance")) {
      // A layer's shared global-tasks file holds no process, so it is no Process node.
      if (abs.endsWith(".bpmn") && !out.has(repoRel(abs)) && !isGlobalTasksFile(readFileSync(abs, "utf-8"))) {
        out.set(repoRel(abs), resolve(inst));
      }
    }
  }
  return out;
}

/**
 * The layer roots whose knowledge-graph directories this graph frames —
 * `gen-subgraph-jsonld`'s own answer, so the gate and the generator cannot
 * disagree about which diagrams are covered.
 */
export function framedInstances(root: string = ROOT): Set<string> {
  return new Set(framedRoots(root));
}

/** Each repository's layers by declared name, read once per run. */
const instanceByName = new Map<string, Map<string, string>>();

/**
 * A published Process's diagram, repository-relative. Its `sourcePath` is
 * relative to the layer that EXPORTED it — the one whose tree it is in,
 * named by `harness` — since each layer is framed from its own export
 * (bean `4ak5` item 2). It was relative to this layer while one
 * checkout-scope export carried every framed layer's processes.
 */
export function diagramPath(p: PublishedProcess, repoRoot: string = REPO): string {
  let byName = instanceByName.get(repoRoot);
  if (byName === undefined) {
    byName = new Map(layerRootsIn(repoRoot).flatMap((r) => {
      const name = readDeclaration(r)?.name;
      return name === undefined ? [] : [[name, r] as const];
    }));
    instanceByName.set(repoRoot, byName);
  }
  return relative(repoRoot, resolve(byName.get(p.harness) ?? ROOT, p.sourcePath)).split(sep).join("/");
}

/** A Process node as the gate reads it, with the layer tree it was found in. */
export interface PublishedProcess { id: string; sourcePath: string; summary?: string; depiction?: string; harness: string }

/**
 * Every Process in every `processes` subgraph the repository index reaches,
 * read from the files on disk, plus what could not be read.
 */
export function publishedProcesses(outDir: string = OUT): { processes: PublishedProcess[]; problems: string[]; repoIri?: string; seeAlso: string[] } {
  const problems: string[] = [];
  const processes: PublishedProcess[] = [];
  const read = (abs: string, schema: typeof SubgraphIndexSchema | typeof SubgraphHydratedSchema): Doc | undefined => {
    // A mounted layer's subgraph tree is at its output root (bean `cat-tools-sm8r`, item 4).
    const at = overlayPath(abs);
    if (!existsSync(at)) { problems.push(`${relative(ROOT, abs)} is missing — run \`bun run cat subgraph:jsonld\``); return undefined; }
    const doc = JSON.parse(readFileSync(at, "utf-8")) as Doc;
    const parsed = schema.safeParse(doc);
    if (!parsed.success) problems.push(`${relative(ROOT, abs)} does not validate: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    return doc;
  };
  const repo = read(join(outDir, SUBGRAPH_INDEX_FILE), SubgraphIndexSchema);
  if (!repo) return { processes, problems, seeAlso: [] };
  const repoIri = String(repo["@id"]);
  const fileOf = (iri: string, file: string): string | undefined => {
    if (!iri.startsWith(repoIri)) { problems.push(`${iri} is not under the repository's subgraph IRI ${repoIri}`); return undefined; }
    return join(outDir, iri.slice(repoIri.length), file);
  };
  for (const rootIri of list(repo.hasSubgraph).map(String)) {
    const rootFile = fileOf(rootIri, SUBGRAPH_INDEX_FILE);
    const root = rootFile ? read(rootFile, SubgraphIndexSchema) : undefined;
    if (!root) continue;
    for (const topIri of list(root.hasSubgraph).map(String)) {
      const topFile = fileOf(topIri, SUBGRAPH_INDEX_FILE);
      const top = topFile ? read(topFile, SubgraphIndexSchema) : undefined;
      if (!top || !list(top.holdsGraph).some((k) => /graphTypology\/processes$/.test(String(k)))) continue;
      const hydFile = fileOf(topIri, SUBGRAPH_HYDRATED_FILE);
      const hyd = hydFile ? read(hydFile, SubgraphHydratedSchema) : undefined;
      if (!hyd) continue;
      const walk = (node: Doc): void => {
        for (const m of list(node.hasMember) as Doc[]) {
          if (!list(m["@type"]).some((t) => String(t).replace(/^.*[#:/]/, "") === "Process")) continue;
          processes.push({
            id: String(m["@id"]),
            sourcePath: String(m.sourcePath ?? ""),
            summary: typeof m.summary === "string" ? m.summary : undefined,
            depiction: typeof m.depiction === "string" ? m.depiction : undefined,
            harness: String(root.name ?? ""),
          });
        }
        for (const c of list(node.hasSubgraph) as Doc[]) walk(c);
      };
      walk(hyd);
    }
  }
  return { processes, problems, repoIri, seeAlso: list(repo.seeAlso).map(String) };
}

/**
 * The diagrams a layer this graph does NOT frame publishes as documented
 * Process nodes in its OWN subgraphs (bean `t8c4`) — bootstrap's, which
 * bootstrap-tools publishes at bootstrap's site. Counted only when the
 * repository index links that site (`seeAlso`), since that link is how the
 * page finds it. Computed with the build that publishes them, run here in
 * process: nothing is fetched, so a gate does not depend on a site being up,
 * and the files cannot vouch for themselves any more than ours can. Those
 * files carry no `sourcePath`; a node is keyed by its `source` IRI under the
 * layer's publication base.
 */
export function unframedProcesses(seeAlso: readonly string[], framed: ReadonlySet<string>, repoRoot: string = REPO): { byPath: Map<string, PublishedProcess>; problems: string[] } {
  const byPath = new Map<string, PublishedProcess>();
  const problems: string[] = [];
  for (const inst of layerRootsIn(repoRoot)) {
    if (framed.has(resolve(inst))) continue;
    const decl = readKnowledgeGraphDeclaration(inst);
    const base = publicationBase(decl);
    if (!decl || !base || !seeAlso.includes(`${base}subgraph/`)) continue;
    let build: ReturnType<typeof buildSubgraphs>;
    try {
      build = buildSubgraphs(inst);
    } catch (e) {
      problems.push(`${decl.name}: its subgraphs could not be built — ${String(e)}`);
      continue;
    }
    for (const p of build.problems) problems.push(`${decl.name}: ${p}`);
    for (const [file, text] of build.files) {
      if (!file.endsWith(`/${SUBGRAPH_HYDRATED_FILE}`)) continue;
      const walk = (node: Doc): void => {
        for (const m of list(node.hasMember) as Doc[]) {
          if (!list(m["@type"]).some((t) => String(t).replace(/^.*[#:/]/, "") === "Process")) continue;
          const source = typeof m.source === "string" ? m.source : "";
          if (!source.startsWith(base)) { problems.push(`${String(m["@id"])}: its source ${JSON.stringify(source)} is not under ${base}`); continue; }
          const path = repoRel(join(inst, source.slice(base.length)));
          byPath.set(path, {
            id: String(m["@id"]),
            sourcePath: path,
            summary: typeof m.summary === "string" ? m.summary : undefined,
            harness: decl.name,
          });
        }
        for (const c of list(node.hasSubgraph) as Doc[]) walk(c);
      };
      walk(JSON.parse(text) as Doc);
    }
  }
  return { byPath, problems };
}

if (import.meta.main) {
  // In a layer's PR checks, only the caller's own diagrams and page (owner
  // ruling 2026-11-05, "Move the checks"; `lib/gate-own.ts`): a lower layer's
  // diagram is judged by that layer's own CI.
  const scoped = gateOwnsFile(".") !== undefined;
  const mine = (repoPath: string) => gateOwnsFile(repoPath) !== false;
  const whole = publishedProcesses();
  const { repoIri, seeAlso } = whole;
  const problems = whole.problems;
  const processes = whole.processes.filter((p) => mine(diagramPath(p)));
  const declared = new Map([...declaredDiagrams()].filter(([path]) => mine(path)));
  if (scoped && processes.length === 0 && declared.size === 0) {
    console.log("✓ check:process-index: the caller commits no process diagram; the mounted layers' are judged by their own CI.");
    process.exit(0);
  }
  const framed = framedInstances();
  const unframed = unframedProcesses(seeAlso, framed);
  problems.push(...unframed.problems);
  const byPath = new Map<string, PublishedProcess>();
  for (const p of processes) {
    const path = diagramPath(p);
    if (byPath.has(path)) problems.push(`two Process nodes for one diagram: ${path}`);
    byPath.set(path, p);
    if (!declared.has(path)) problems.push(`a Process node for an undeclared diagram: ${path} (${p.id})`);
    if (!p.summary) problems.push(`a Process node carries no documentation: ${path} — give the diagram a <bpmn:documentation> of its own`);
    if (p.depiction) {
      const base = (repoIri ?? "").replace(/subgraph\/$/, "");
      const local = p.depiction.startsWith(base) ? join(SITE, p.depiction.slice(base.length)) : undefined;
      if (!local || !existsSync(overlayPath(local))) problems.push(`a Process node depicts an SVG that is not there: ${p.depiction}`);
    }
  }
  for (const [path, p] of unframed.byPath) {
    if (!mine(path)) continue;
    if (!declared.has(path)) problems.push(`a Process node for an undeclared diagram: ${path} (${p.id})`);
    if (!p.summary) problems.push(`a Process node carries no documentation: ${path} — give the diagram a <bpmn:documentation> of its own`);
  }
  const outside: string[] = [];
  for (const [path, inst] of declared) {
    if (byPath.has(path) || unframed.byPath.has(path) || !mine(path)) continue;
    if (framed.has(inst)) problems.push(`declared but not a Process node in any published processes subgraph: ${path}`);
    else outside.push(`${path}  (${readDeclaration(inst)?.name ?? relative(REPO, inst)})`);
  }
  if (processes.length === 0) problems.push("the published subgraphs hold no process — a sweep over nothing has cleared nothing");

  const page = existsSync(PAGE) ? readFileSync(PAGE, "utf-8") : "";
  if (mine(repoRel(PAGE)) && !/data-fa-process-index\b/.test(page)) problems.push(`${PAGE} no longer carries the [data-fa-process-index] container`);
  if (mine(repoRel(PAGE)) && !/<noscript>/.test(page)) problems.push(`${PAGE} has no <noscript> fallback for the process table`);

  if (outside.length) {
    console.log(`Not covered — declared by an instance outside this graph whose own subgraphs the repository index does not link (pve3, t8c4):`);
    for (const o of outside.sort()) console.log(`  · ${o}`);
  }
  if (problems.length) {
    console.error("Process index — the published JSON-LD does not cover the declarations:");
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(
    `Process index: ${processes.length + unframed.byPath.size} of ${declared.size} declared diagram(s) are documented Process nodes in the published subgraphs ` +
    `(${unframed.byPath.size} in the subgraphs of instances this graph does not frame, linked by seeAlso); ` +
    `${outside.length} not covered${outside.length ? " (listed above)" : ""}; page mount present.`,
  );
}
