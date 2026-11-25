#!/usr/bin/env bun
/**
 * Latent Semantic Indexing over the declared knowledge graphs — build a
 * per-graph index sidecar, query it, check it is fresh, and audit which graphs
 * need one.
 *
 * @covers library, skills, beans, folio, docs, methodology, memory, policies, glossary
 *
 * Method: `methodologies/lsi.md`. Engine: `pipeline/lsi.ts`. Skill:
 * `skills/kg/graph-management/lsi-indexing.md`.
 *
 * ## Subcommands
 *
 *   bun run cat lsi index  [--instance <name>] [--graph <id>] [--doc <slug>…] [--k N]
 *   bun run cat lsi query  "<text>" [--instance <name>] [--graph <id>] [--doc <slug>…] [--top N]
 *   echo "<text>" | bun run cat lsi query --instance <name> --graph <id>   # the Tool node's form
 *   bun run cat lsi audit  [--strict]      # which graphs need an index; is each fresh?
 *   bun run cat lsi links  --instance <name> --graph <id> [--per N] [--top N]   # cross-document proposals
 *
 * ## What the sidecar holds, and why not the vectors
 *
 * The sidecar under `cat-harness/test/results/lsi/<instance>/<graph>.lsi.json`
 * carries the input fingerprint, the parameters, the retained variance, the
 * top-loading terms at each pole of the first dimensions, each unit's nearest
 * neighbours, and two kinds of finding. It does NOT carry `U` or `V`: a
 * rebuild is cheap, and a float dump is not something a reviewer can judge.
 *
 * ## The need-an-index rule
 *
 * A graph NEEDS an index when it holds at least `NEED_UNITS` text units and
 * `NEED_WORDS` words — a house threshold, not from the method, named here so a
 * reviewer can move it. Below either threshold the result is `n/a`, not
 * `pass`: a small graph was not judged.
 *
 * ## With no index directory in the checkout
 *
 * The sidecars and their run records are derived QA bound for the
 * `qa-reports` branch. When
 * `test/results/lsi/` is absent, {@link graphVerdict} REBUILDS the index in
 * memory and judges that run, writing nothing: fresh by construction, or
 * failed. It never reads the absence as "has none", and never as a pass it
 * did not compute. A reader that wants the
 * STORED indexes (the viewer page) fetches them by ref and passes them in as
 * an {@link IndexSource}.
 *
 * It REPORTS by default (exit 0 with findings); `--strict` fails on a
 * needed-but-missing or stale index.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { declaredGraphs, layerRootsIn } from "../schemas/kg/cat-harness.ts";
import { PAGE_LOCALE, visualiserSitePath } from "./viewer-declarations.ts";
import { againstOrUsage, buildQaResult, judgeUsage, qaStorageOf, writeQaResult } from "./qa-results.ts";
import { readQaTree } from "./qa-store.ts";
import { overlayDirs, overlayPath, writePathOf } from "./lib/layer-output.ts";
import { downstreamState, parseToolRun, toolRunPath, writeToolRun, TOOL_RUNS_DIR, UNKNOWN_FINGERPRINT, type DownstreamState } from "../schemas/tools/tool-run.ts";
import { specimenSections } from "../schemas/content/section-verdicts.ts";
import {
  buildLsi,
  crossGroupLinks,
  LINK_FLOOR,
  dimensionSummaries,
  fingerprintUnits,
  neighboursOf,
  query,
  tokenize,
  type LsiIndex,
  type LsiOptions,
  type LsiUnit,
} from "../pipeline/lsi";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { libraryEntryDir, libraryEntryDirs } from "./lib/library-entry-graphs.ts";
import type { LsiSidecar } from "../schemas/kg/qa-record-shapes.ts";
// bean 70lx: these record shapes are definitions, and moved to the harness's schemas/
export type { LsiSidecar };

const REPO = resolve(dirname(HARNESS_ROOT));
// declared-path-literal: the LSI run records under cat-harness's `qa` graph. cat-harness-tools reads cat-harness's directory here; 70lx moved this code up a layer and kept the path, which is now an implementer reading the layer below it (downward). Resolving it through cat-harness's declaration is the follow-up; counted, not hidden.
const RESULTS = join(REPO, "cat-harness/test/results/lsi");
/** The layer whose Tool graph declares `lsi-index`; its run records live under its `qa` directory. */
const HARNESS = join(REPO, "cat-harness");
/** The Tool node whose runs this module records (`tools/index.ts`, `downstream`). */
export const LSI_TOOL_ID = "lsi-index";
/**
 * Where `gen-lsi-viz.ts` writes; never a unit of any index (see `unitsOf`).
 * The route cat-harness DECLARES for the `lsi-viewer` visualiser
 * (`<site>/<locale>/cat-harness/lsi/`, owner 2026-10-09; folio-assistant#2527)
 * — read, never spelled here.
 */
// declared-path-literal: cat-harness's docs site, under which the LSI viewer's declared route sits. cat-harness-tools reads cat-harness's directory here; 70lx moved this code up a layer and kept the path, which is now an implementer reading the layer below it (downward). Resolving it through cat-harness's declaration is the follow-up; counted, not hidden.
export const LSI_DOCS_ROOT = join(REPO, "cat-harness/docs");
/** The LSI viewer page's directory: {@link LSI_DOCS_ROOT} plus the route the visualiser declares. */
export const VIEWER_DIR = join(LSI_DOCS_ROOT, lsiViewerRoute()) + "/";
/**
 * The same viewer's OLD address, `<site>/cat-harness/lsi/` (folio-assistant#2527):
 * where a site not yet regenerated still holds the page. Excluded from every
 * index for the same reason {@link VIEWER_DIR} is.
 */
// The viewer's pre-locale address, kept so a stale page there is found and reported.
const OLD_VIEWER_DIR = join(LSI_DOCS_ROOT, lsiViewerRoute().replace(new RegExp(`^${PAGE_LOCALE}/`), "")) + "/";

function lsiViewerRoute(): string {
  try {
    return dirname(visualiserSitePath(HARNESS, "lsi-viewer").rel);
  } catch {
    // No declaration (a fixture checkout): the route the declaration would give.
    return `${PAGE_LOCALE}/cat-harness/lsi`;
  }
}

export const NEED_UNITS = 100;
export const NEED_WORDS = 20_000;
/** Graph typologies whose files are prose a reader reads. `code`, `schemas`,
 *  `tools` and the like are indexed by their own structure, not by LSI. */
const PROSE_KINDS = new Set(["library", "skills", "beans", "folio", "docs", "methodology", "memory", "policies", "glossary"]);
const DEFAULT_OPTS: LsiOptions = { k: 100, weighting: "log-entropy", minDf: 2, maxDfShare: 0.5, powerIterations: 4, seed: 1990 };
/** State graphs change on nearly every commit: a committed index would be
 *  stale on every PR and a merge-conflict magnet, so they are rebuilt on
 *  demand (`lsi:epics` does) and the audit does not ask for a sidecar. */
const ON_DEMAND_KINDS = new Set(["beans"]);
/** A unit shorter than this carries too little vocabulary to place. */
const MIN_TOKENS = 20;

// ─── Unit extraction ─────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

/** A library's unit is a SECTION — the chunking ingestion already produced.
 *  Everything else: one markdown file per unit. */
export function unitsOf(absPath: string, graphTypologies: string[], docs?: string[]): LsiUnit[] {
  let files: string[];
  if (graphTypologies.includes("library")) {
    // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`).
    // A named doc is found wherever it is filed; one that is absent reads as
    // flat, contributing nothing, as it always has.
    const entries = docs?.length
      ? docs.map((s) => ({ slug: s, dir: libraryEntryDir(absPath, s) ?? join(absPath, s) }))
      : libraryEntryDirs(absPath);
    // A section the library marks SPECIMEN (section-verdicts.json, bean
    // `fnqn`) is sample text, not the document speaking: indexing it teaches
    // the index filler's vocabulary as a theme, which is how it was found.
    const specimens = specimenSections(absPath);
    files = entries.flatMap(({ slug: s, dir }) => {
      const sec = join(dir, "sections");
      return existsSync(sec)
        ? readdirSync(sec)
            .filter((f) => f.endsWith(".md") && !specimens.has(`${s}/${f.replace(/\.md$/, "")}`))
            .sort()
            .map((f) => join(sec, f))
        : [];
    });
  } else {
    files = walk(absPath).sort();
  }
  return files
    // The index viewer's own page reports on the indexes; indexing it would
    // make every regeneration stale the index it reports on, and the page
    // would never reach a fixed point (the self-reference class of bean 1xrg).
    .filter((f) => !f.startsWith(VIEWER_DIR) && !f.startsWith(OLD_VIEWER_DIR))
    .map((f) => ({ id: relative(REPO, f), text: readFileSync(f, "utf8") }))
    .filter((u) => tokenize(u.text).length >= MIN_TOKENS);
}

export interface GraphTarget {
  instance: string;
  id: string;
  graphTypologies: string[];
  absPath: string;
}

export function proseGraphs(): GraphTarget[] {
  // A directory is declared again by every layer that sees it — a
  // dependency's graph by each dependent, a sibling's library by the harness.
  // Index it once, attributed to the layer whose ROOT contains it (the
  // owner), falling back to the first declarer for a repository-scoped path.
  const byPath = new Map<string, GraphTarget & { rootLen: number }>();
  for (const root of layerRootsIn(REPO)) {
    for (const g of declaredGraphs(root)) {
      if (!g.absPath || !existsSync(g.absPath) || !statSync(g.absPath).isDirectory()) continue;
      if (!g.graphTypologies.some((k) => PROSE_KINDS.has(k))) continue;
      const owns = g.absPath.startsWith(root + "/") ? root.length : -1;
      const prev = byPath.get(g.absPath);
      if (prev && prev.rootLen >= owns) continue;
      byPath.set(g.absPath, { instance: g.declaredBy, id: g.id, graphTypologies: g.graphTypologies, absPath: g.absPath, rootLen: owns });
    }
  }
  return [...byPath.values()]
    .map(({ rootLen: _r, ...t }) => t)
    .sort((a, b) => (a.instance + a.id < b.instance + b.id ? -1 : 1));
}

function sidecarPath(t: GraphTarget, docs?: string[]): string {
  const suffix = docs?.length ? `.${docs.join("+")}` : "";
  return join(RESULTS, t.instance, `${t.id}${suffix}.lsi.json`);
}

// ─── Findings ────────────────────────────────────────────────────────────────

/** Two units this close are near-duplicates: one may restate the other. */
const DUPLICATE_COSINE = 0.95;

function findings(index: LsiIndex) {
  const dupes: Array<{ a: string; b: string; cosine: number }> = [];
  const neighbours: Record<string, Array<[string, number]>> = {};
  for (const id of index.unitIds) {
    const nn = neighboursOf(index, id, 3);
    neighbours[id] = nn.map((h) => [h.id, Number(h.cosine.toFixed(3))]);
    for (const h of nn) if (h.cosine >= DUPLICATE_COSINE && id < h.id) dupes.push({ a: id, b: h.id, cosine: Number(h.cosine.toFixed(3)) });
  }
  // A dimension carried by very few units is an outlier cluster — boilerplate,
  // specimen text, a mis-extracted page — rather than a theme of the graph.
  const narrow: Array<{ dim: number; units: string[] }> = [];
  const n = index.unitIds.length;
  for (let c = 0; c < Math.min(20, index.k); c++) {
    const mass = index.unitIds.map((id, j) => [id, index.unitCoords[j * index.k + c] ** 2] as const);
    const total = mass.reduce((s, [, m]) => s + m, 0);
    mass.sort((a, b) => b[1] - a[1]);
    let acc = 0;
    const carriers: string[] = [];
    for (const [id, m] of mass) {
      acc += m;
      carriers.push(id);
      if (acc >= 0.8 * total) break;
    }
    if (carriers.length <= Math.max(3, Math.floor(0.01 * n))) narrow.push({ dim: c + 1, units: carriers });
  }
  return { dupes, narrow, neighbours };
}

// ─── Commands ────────────────────────────────────────────────────────────────

/**
 * Build the index sidecar for a graph IN MEMORY: no file, no run record.
 *
 * {@link index} is this plus the two writes. The readers that run with no
 * index in the checkout recompute through here (bean `oq1j`): derived QA is
 * leaving `main` for the `qa-reports` branch, and a rebuild costs about a
 * second per graph (measured 2026-10-01: 0.6–5.5 s over the seven graphs that
 * need one). It is memoised per process for the default options, so a reader
 * that asks for the verdict and then the dimensions builds once.
 */
export function computeIndex(t: GraphTarget, docs?: string[], opts: LsiOptions = DEFAULT_OPTS): { sidecar: LsiSidecar; ms: number } {
  const key = !docs?.length && opts === DEFAULT_OPTS ? targetOf(t) : undefined;
  const hit = key ? computed.get(key) : undefined;
  if (hit) return hit;
  const units = unitsOf(t.absPath, t.graphTypologies, docs);
  // input-site: inert #c1aef090 — a duration for the log
  const t0 = performance.now();
  const ix = buildLsi(units, opts);
  // input-site: inert #8a078e0b — a duration for the log
  const ms = Math.round(performance.now() - t0);
  const f = findings(ix);
  const sidecar: LsiSidecar = {
    $schema: "folio-lsi-index/v1",
    // declared-path-literal: a provenance field in the sidecar naming the methodology node; recorded, not read from disk.
    method: "cat-harness/methodologies/lsi.md",
    instance: t.instance,
    graph: t.id,
    path: relative(REPO, t.absPath),
    docs: docs ?? null,
    fingerprint: ix.fingerprint,
    options: opts,
    units: units.length,
    terms: ix.terms.length,
    k: ix.k,
    retained: Number(ix.retained.toFixed(4)),
    dimensions: dimensionSummaries(ix, 12, 8),
    findings: {
      nearDuplicates: f.dupes,
      narrowDimensions: f.narrow,
    },
    neighbours: f.neighbours,
  };
  const built = { sidecar, ms };
  if (key) computed.set(key, built);
  return built;
}
const computed = new Map<string, { sidecar: LsiSidecar; ms: number }>();

export function index(t: GraphTarget, docs: string[] | undefined, opts: LsiOptions = DEFAULT_OPTS): LsiSidecar {
  // A WRITE always rebuilds: the memo is for readers, and an index written
  // after its graph changed in this process (`ingest --promote`) must not be
  // the build from before the change.
  computed.delete(targetOf(t));
  const { sidecar, ms } = computeIndex(t, docs, opts);
  // Never into a mount: a mounted harness's index goes to its layer output
  // root (bean `cat-tools-sm8r`, item 4); CHECKOUT_SOURCE reads it there.
  const out = writePathOf(sidecarPath(t, docs));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(sidecar, null, 2) + "\n");
  // The run record — only for a WHOLE-graph index, which is what the
  // freshness verdict is about; a `--doc` subset is a different output.
  if (!docs?.length) writeToolRun(HARNESS, { tool: LSI_TOOL_ID, target: targetOf(t), outcome: "succeeded", inputFingerprint: sidecar.fingerprint });
  const f = sidecar.findings;
  console.log(
    `${t.instance}/${t.id}${docs ? ` [${docs.join(", ")}]` : ""}: ${sidecar.units} units, ${sidecar.terms} terms, k=${sidecar.k}, retained ${(sidecar.retained * 100).toFixed(1)}%, ${ms} ms` +
      ` — ${f.nearDuplicates.length} near-duplicate pair(s), ${f.narrowDimensions.length} narrow dimension(s) → ${relative(REPO, out)}`,
  );
  return sidecar;
}

/** The run-record target for a graph: `<instance>/<graph>`. */
export function targetOf(t: GraphTarget): string {
  return `${t.instance}/${t.id}`;
}

/**
 * Index a graph and RECORD the outcome either way — the downstream-tool
 * contract (bean `fq5u`). A failure writes a `failed` record rather than
 * nothing, so the audit reads "failed", which is never green, instead of a
 * previous success over inputs that have since moved.
 */
export function indexRecorded(t: GraphTarget, docs: string[] | undefined, opts: LsiOptions = DEFAULT_OPTS): LsiSidecar {
  try {
    return index(t, docs, opts);
  } catch (e) {
    if (!docs?.length)
      writeToolRun(HARNESS, { tool: LSI_TOOL_ID, target: targetOf(t), outcome: "failed", inputFingerprint: UNKNOWN_FINGERPRINT, detail: (e as Error).message });
    throw e;
  }
}

/**
 * Rebuild the index of the library that holds `libraryDir`, and say what it
 * found about one newly promoted document. Called by `ingest --promote`
 * (option B, bean `ansc`): a promotion changes the library, so its index is
 * stale by construction (method step 7), and the two ingestion findings LSI
 * gives — outlier dimensions and near-duplicate sections — are cheapest to
 * act on while the document is fresh. ADVISORY: returns lines to print and
 * never throws, because an index is not part of L1 and must not fail an
 * ingest that met every L1 requirement.
 */
export function refreshLibraryIndex(libraryDir: string, slug: string): string[] {
  try {
    const abs = resolve(libraryDir);
    const t = proseGraphs().find((g) => g.absPath === abs || g.absPath === abs + "/");
    if (!t) return [`  · lsi: ${relative(REPO, abs)} is not a declared prose graph — no index to refresh`];
    const sc = indexRecorded(t, undefined);
    const mine = (id: string) => id.includes(`/${slug}/`);
    const dupes = sc.findings.nearDuplicates.filter((d) => mine(d.a) || mine(d.b));
    const narrow = sc.findings.narrowDimensions.filter((d) => d.units.some(mine));
    const out = [`  · lsi: ${t.instance}/${t.id} re-indexed (${sc.units} units); this document: ${dupes.length} near-duplicate pair(s), ${narrow.length} narrow dimension(s)`];
    for (const d of dupes.slice(0, 5)) out.push(`      near-duplicate ${d.cosine}: ${relative(REPO, join(REPO, d.a))} ~ ${relative(REPO, join(REPO, d.b))}`);
    for (const d of narrow) out.push(`      narrow dimension ${d.dim} (boilerplate, specimen text or a bad page?): ${d.units.join(", ")}`);
    return out;
  } catch (e) {
    return [`  · lsi: index NOT refreshed — ${(e as Error).message}. Run \`bun run cat lsi index\` for this library; this is not a pass.`];
  }
}

export interface GraphVerdict {
  result: "pass" | "fail" | "n/a";
  /** Human detail WITH counts — for the console and the qa-results file. */
  detail: string;
  /** The same verdict with NO counts, for the kg:audit sidecar: it changes
   *  only when the verdict does, so an edit that keeps an index fresh (or
   *  keeps it missing) does not make the committed audit stale. */
  stableDetail: string;
  units: number;
  words: number;
  /** The downstream-run state when the graph is judged; absent for `n/a`. */
  state?: DownstreamState;
}

/**
 * Does this graph NEED an index? A fact about the tree alone: no index file is
 * read. `needed: false` carries the `n/a` verdict to report.
 */
export function needOf(t: GraphTarget): { needed: false; verdict: GraphVerdict } | { needed: true; units: LsiUnit[]; words: number } {
  const us = unitsOf(t.absPath, t.graphTypologies);
  const units = us.length;
  const words = us.reduce((s, u) => s + tokenize(u.text).length, 0);
  if (t.graphTypologies.some((k) => ON_DEMAND_KINDS.has(k)))
    return { needed: false, verdict: { result: "n/a", detail: `state graph — indexed on demand, never committed (${units} units)`, stableDetail: "state graph — indexed on demand, never committed", units, words } };
  if (!(units >= NEED_UNITS && words >= NEED_WORDS))
    return { needed: false, verdict: { result: "n/a", detail: `below threshold (${units} units, ${words} words)`, stableDetail: "below the need-an-index threshold — not judged", units, words } };
  return { needed: true, units: us, words };
}

/**
 * Is there an index directory in the checkout at all?
 *
 * Bean `oq1j` (arc `3fva`). The indexes and their run records are derived QA,
 * bound for the `qa-reports` branch (owner rulings D1/D4). The DIRECTORY is
 * the switch, not each file. With the directory present, a graph that needs
 * an index and has none is still the finding it always was. With it absent,
 * nothing in the checkout can be stale, so the verdict is computed instead
 * (proposal §2.3: compute and judge).
 */
export function indexesInCheckout(): boolean {
  return overlayDirs(RESULTS).length > 0;
}

/** The index directory, repository-relative: its path in the checkout and on the `qa-reports` branch alike. */
export const INDEX_DIR = relative(REPO, RESULTS).split("\\").join("/");
/** The LSI run records' directory, repository-relative. */
export const RUN_RECORD_DIR = relative(REPO, join(HARNESS, TOOL_RUNS_DIR, LSI_TOOL_ID)).split("\\").join("/");

/**
 * Where a verdict reads an index and its run record from.
 *
 * {@link CHECKOUT_SOURCE} is the working copy. A reader that fetched a tree
 * from the `qa-reports` branch (`scripts/qa-store.ts` `readQaTree`) passes
 * {@link sourceFromFiles} over it, and the verdict is then the one the
 * checkout would give with that tree materialised: the same code over the
 * fetched files, not a second reading of them.
 */
export interface IndexSource {
  /** Is there an index directory in this source at all? `false` makes {@link graphVerdict} compute instead. */
  present: boolean;
  /** The text at a repository-relative path, or `undefined` when the source holds no such file. */
  read(repoPath: string): string | undefined;
  /** Why a source with `present: false` holds no record — said in the computed verdict. Default: the index directory is absent. */
  why?: string;
}

export const CHECKOUT_SOURCE: IndexSource = {
  get present() {
    return indexesInCheckout();
  },
  read(repoPath) {
    const abs = overlayPath(join(REPO, repoPath));
    return existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
  },
};

/** A tree read from the store, keyed by repository-relative path. Present by construction: it was fetched. */
export function sourceFromFiles(files: ReadonlyMap<string, string>): IndexSource {
  return { present: true, read: (p) => files.get(p) };
}

/** Does this graph need an LSI index, and is the one it has fresh? One answer
 *  for `lsi:audit` and for kg:audit's `tool-downstream-fresh` (the
 *  `lsi-index` member, via `scripts/downstream-runs.ts`). */
export function graphVerdict(t: GraphTarget, src: IndexSource = CHECKOUT_SOURCE): GraphVerdict {
  const need = needOf(t);
  if (!need.needed) return need.verdict;
  const us = need.units;
  const units = us.length;
  const words = need.words;
  const sc = sidecarPath(t);
  const run = `bun run cat lsi index --instance ${t.instance} --graph ${t.id}`;
  if (!src.present) {
    // COMPUTE AND JUDGE. The run is this one: it either builds over the
    // current inputs, which is fresh by construction, or it fails, which is
    // never green. Nothing is written, so a `:check` stays a reader.
    try {
      computeIndex(t);
      return {
        result: "pass",
        state: "fresh",
        detail: `fresh — recomputed in this run (${units} units); ${src.why ?? `no index in the checkout (${relative(REPO, RESULTS)}/ is absent) to be stale`}`,
        stableDetail: "fresh — recomputed in this run; there is no index in the checkout to be stale",
        units,
        words,
      };
    } catch (e) {
      return {
        result: "fail",
        state: "failed",
        detail: `the index could not be built here — ${(e as Error).message}`,
        stableDetail: `the index could not be built — run \`${run}\` to see why`,
        units,
        words,
      };
    }
  }
  const text = src.read(relative(REPO, sc).split("\\").join("/"));
  if (text === undefined)
    return { result: "fail", state: "not-run", detail: `needs an index (${units} units, ${words} words) and has none`, stableDetail: `needs an LSI index and has none — run \`${run}\``, units, words };
  // FRESH needs a successful RUN RECORD over the current inputs, not just a
  // sidecar whose fingerprint matches: the sidecar says what an index was
  // built over, the record says the run that built it succeeded and is the
  // latest. No record is `not-run`, never green (bean `fq5u`).
  let s: LsiSidecar;
  try {
    s = JSON.parse(text) as LsiSidecar;
  } catch (e) {
    // Unreadable is not "has none" and not fresh: a fail that says which.
    return { result: "fail", state: "not-run", detail: `${relative(REPO, sc)} does not parse — ${(e as Error).message}`, stableDetail: `the index does not parse — re-run \`${run}\``, units, words };
  }
  const record = parseToolRun(src.read(relative(REPO, toolRunPath(HARNESS, LSI_TOOL_ID, targetOf(t))).split("\\").join("/")));
  const state = downstreamState(record, fingerprintUnits(us, s.options));
  const said: Record<DownstreamState, [string, string]> = {
    fresh: [`fresh (${units} units)`, "fresh"],
    stale: [`stale — the graph changed since ${relative(REPO, sc)} was built`, `stale — re-run \`${run}\``],
    "not-run": [`no run record for ${relative(REPO, sc)} — not shown to be current`, `no successful run recorded — re-run \`${run}\``],
    failed: [`the last index run FAILED — ${relative(REPO, sc)} is a previous run's output`, `the last run failed — re-run \`${run}\``],
  };
  return { result: state === "fresh" ? "pass" : "fail", state, detail: said[state][0], stableDetail: said[state][1], units, words };
}

/**
 * Is the index directory STORED on the `qa-reports` branch (bean `oqe3`)?
 * Then a copy in the checkout is a measurement of the last run, not a record.
 */
export function indexesStored(): boolean {
  return qaStorageOf(RESULTS) !== undefined;
}

/**
 * `lsi check` — compute and judge (bean `oqe3`, proposal §2.3).
 *
 * With the index directory STORED on `qa-reports` (cat-harness declares it),
 * the gate never compares with a working copy: it rebuilds each index in
 * memory and fails only when one cannot be built. "Stale" no longer exists
 * as a failure. A committed index whose fingerprint has moved is printed as
 * advisory, so it is seen, and `qa:refresh` rebuilds the stored record.
 * That comparison was what made every PR touching a skill regenerate and
 * commit `test/results/lsi/`, and what made those files conflict.
 *
 * `--against <ref>` also reads the stored indexes at that ref and reports
 * which are current for this tree. That is reported, never gated: an index
 * is a derived measurement, and its staleness on the branch is the
 * publisher's job, not this change's defect. A ref with no entry is
 * UNKNOWN, and is reported.
 *
 * Unstored (no declaration says the directory leaves `main`), the working
 * copy is still the record and the old strict comparison stands.
 */
export function checkGraphs(ts: readonly GraphTarget[], opts: { against?: string; stored?: boolean; log?: (line: string) => void } = {}): number {
  const log = opts.log ?? ((l: string) => console.log(l));
  const stored = opts.stored ?? indexesStored();
  const inCheckout = indexesInCheckout();
  const computed: IndexSource = {
    present: false,
    read: () => undefined,
    why: inCheckout ? `the copy in ${relative(REPO, RESULTS)}/ is stored on qa-reports, so it is not compared` : undefined,
  };
  let branch: IndexSource | undefined;
  let branchFrom = "";
  if (opts.against !== undefined) {
    const storage = qaStorageOf(RESULTS);
    const tree = readQaTree(opts.against, INDEX_DIR, storage ? { branch: storage, repoRoot: REPO } : { repoRoot: REPO });
    const runs = tree.state === "hit" ? readQaTree(opts.against, RUN_RECORD_DIR, storage ? { branch: storage, repoRoot: REPO } : { repoRoot: REPO }) : undefined;
    if (tree.state !== "hit") log(`  ? UNKNOWN — no stored indexes at qa-reports ${opts.against}: ${tree.reason}. Reported, not gated.`);
    else if (runs && (runs.state === "corrupt" || runs.state === "unknown")) log(`  ? UNKNOWN — run records at qa-reports ${opts.against}: ${runs.reason}. Reported, not gated.`);
    else {
      branch = sourceFromFiles(new Map([...tree.files, ...(runs?.state === "hit" ? runs.files : [])]));
      branchFrom = `qa-reports ${tree.key}`;
    }
  }
  let bad = 0;
  for (const t of ts) {
    const v = graphVerdict(t, stored ? computed : CHECKOUT_SOURCE);
    if (v.result === "fail") bad++;
    log(`${v.result.padEnd(4)}  ${t.instance}/${t.id}  ${v.detail}`);
    if (v.result === "fail" || !stored) continue;
    if (inCheckout) {
      const w = graphVerdict(t, CHECKOUT_SOURCE);
      if (w.result === "fail") log(`      advisory: the working copy — ${w.detail}. Not gated (stored on qa-reports; judge, never compare).`);
    }
    if (branch) {
      const b = graphVerdict(t, branch);
      log(`      ${b.result === "fail" ? "advisory" : "current"}: ${branchFrom} — ${b.detail}${b.result === "fail" ? ". Not gated: `qa:refresh` rebuilds it." : ""}`);
    }
  }
  return bad ? 1 : 0;
}

function audit(strict: boolean): number {
  const rows: Array<Record<string, unknown>> = [];
  let failing = 0;
  for (const t of proseGraphs()) {
    const { result, detail, units, words } = graphVerdict(t);
    if (result === "fail") failing++;
    rows.push({ instance: t.instance, graph: t.id, path: relative(REPO, t.absPath), kinds: t.graphTypologies, units, words, result, detail });
    console.log(`${result.padEnd(4)}  ${`${t.instance}/${t.id}`.padEnd(40)} ${detail}`);
  }
  const failed = (pred: (d: string) => boolean) =>
    rows.filter((r) => r.result === "fail" && pred(String(r.detail))).map(({ instance, graph, path, units, words, detail }) => ({ instance, graph, path, units, words, detail }));
  const out = writeQaResult(
    join(REPO, "cat-harness"),
    "lsi-need-an-index",
    buildQaResult({
      script: "cat-harness-tools/scripts/lsi.ts",
      scriptAbsPath: import.meta.path,
      subject: { kind: "corpus", id: "declared-prose-graphs" },
      families: {
        "index-missing": {
          summary:
            `A declared prose graph with >= ${NEED_UNITS} units and >= ${NEED_WORDS} words has no LSI index sidecar. ` +
            "Basis: a HOUSE threshold, not from the method (the 1990 paper gives no corpus-size rule) — more prose than one " +
            "reader holds in a sitting, so a change of vocabulary between two units goes unnoticed. Graphs below either " +
            "threshold are not judged (n/a, not pass); state graphs (beans) are indexed on demand and never asked for one.",
          entries: failed((d) => d.startsWith("needs")),
        },
        "index-stale": {
          summary: "An LSI index sidecar whose input fingerprint no longer matches the graph: built before the graph last changed.",
          entries: failed((d) => d.startsWith("stale")),
        },
        "index-run-unrecorded": {
          summary:
            "An LSI index sidecar with no successful run record over the current inputs — never run by the recording path, or its " +
            "last run failed. Never green: a file on disk is not evidence the run that should keep it current succeeded (bean fq5u).",
          entries: failed((d) => d.startsWith("no run record") || d.startsWith("the last index run")),
        },
      },
    }),
  );
  console.log(`\n${failing} graph(s) need an index they do not have, or have a stale one. → ${relative(REPO, out)}`);
  return strict && failing > 0 ? 1 : 0;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
function args(name: string): string[] | undefined {
  const out: string[] = [];
  process.argv.forEach((a, i) => { if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out.length ? out : undefined;
}

function targets(): GraphTarget[] {
  const inst = arg("instance");
  const gid = arg("graph");
  const all = proseGraphs().filter((t) => (!inst || t.instance === inst) && (!gid || t.id === gid));
  if (!all.length) {
    console.error(`no prose graph matches --instance ${inst ?? "*"} --graph ${gid ?? "*"}`);
    process.exit(2);
  }
  // `--needed`: only the graphs `needOf` says need an index — the set `lsi
  // audit` judges, computed from the instances present rather than listed by
  // a caller that cannot know which layers sit above it (bean `0r7u`). An
  // empty selection here is a determined "none needs one", not a miss.
  if (process.argv.includes("--needed")) return all.filter((t) => needOf(t).needed);
  return all;
}

if (import.meta.main) {
  const cmd = process.argv[2];
  const opts: LsiOptions = { ...DEFAULT_OPTS, ...(arg("k") ? { k: Number(arg("k")) } : {}) };
  if (cmd === "index") {
    for (const t of targets()) {
      try {
        indexRecorded(t, args("doc"), opts);
      } catch (e) {
        console.log(`${t.instance}/${t.id}: not indexed — ${(e as Error).message}`);
      }
    }
  } else if (cmd === "query") {
    // The query on STDIN when no positional is given — the Tool node's form,
    // since free text never goes on a command line (check:tools).
    const text = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : (await Bun.stdin.text()).trim();
    const top = Number(arg("top") ?? 10);
    for (const t of targets()) {
      const units = unitsOf(t.absPath, t.graphTypologies, args("doc"));
      if (units.length < 3) continue;
      const ix = buildLsi(units, opts);
      console.log(`# ${t.instance}/${t.id} — latent hits (cosine in the k=${ix.k} space; NOT a lexical match)`);
      const words = tokenize(text);
      for (const h of query(ix, text, top)) {
        const body = units.find((u) => u.id === h.id)!.text.toLowerCase();
        const lexical = words.some((w) => body.includes(w));
        console.log(`  ${h.cosine.toFixed(3)}  ${lexical ? "lexical+latent" : "latent only   "}  ${h.id}`);
      }
    }
  } else if (cmd === "links") {
    // Cross-DOCUMENT link proposals inside one graph (a library's documents):
    // a floor, and hubs reported rather than penalised — bean 9udd.
    for (const t of targets()) {
      const units = unitsOf(t.absPath, t.graphTypologies, args("doc"));
      if (units.length < 3) continue;
      const ix = buildLsi(units, opts);
      const docOf = (id: string) => id.split("/").slice(0, -2).join("/");
      const r = crossGroupLinks(ix, docOf, { perUnit: Number(arg("per") ?? 1) });
      console.log(`# ${t.instance}/${t.id} — ${r.links.length} cross-document link proposal(s) at cosine >= ${LINK_FLOOR}; ${r.belowFloor} of ${units.length} units have no other-document match that high`);
      for (const l of r.links.slice(0, Number(arg("top") ?? 25))) console.log(`  ${l.cosine.toFixed(3)}  ${l.a}  ~  ${l.b}`);
      if (r.hubs.length) {
        console.log("  hubs (nearest other-document unit for many units — discount links through them):");
        for (const h of r.hubs) console.log(`    ${h.nearestFor}×  ${h.id}`);
      }
    }
  } else if (cmd === "check") {
    // The verify half of a `skill:register` step (`lsi:skills` /
    // `lsi:skills:check`). See {@link checkGraphs} for what fails.
    const usage = judgeUsage("lsi check", process.argv.slice(3), ["--instance", "--graph", "--needed", "--against"]);
    if (usage !== undefined) process.exit(usage);
    const { against, exit: badRef } = againstOrUsage("lsi check", process.argv.slice(3));
    if (badRef !== undefined) process.exit(badRef);
    process.exit(checkGraphs(targets(), { against }));
  } else if (cmd === "audit") {
    process.exit(audit(process.argv.includes("--strict")));
  } else {
    console.log(readFileSync(import.meta.path, "utf8").split("\n").slice(9, 16).join("\n").replace(/^ \* ?/gm, ""));
    process.exit(cmd ? 2 : 0);
  }
}

