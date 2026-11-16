#!/usr/bin/env bun
/**
 * derive:publish — build every derived artefact that cannot be current in a
 * commit, at the moment the site is built.
 *
 * @module cat-harness/scripts/derive-at-publish
 * @covers none — it runs the writers `check:derived-from` names; it judges no graph
 *
 * ## Branch-derived artefacts
 *
 * An artefact derived from an input kept on a BRANCH goes stale without a
 * commit, so it is never committed: `check:derived-from` finds those by
 * walking `derivedFrom` edges up to a branch-kept input (a visualisation
 * counts as derived from the directory it shows) and refuses any that is
 * tracked. The site build runs this after `state:mount` and before composing
 * the site, and it runs each one's declared `writer`, sources before
 * consumers.
 *
 * ## Artefacts a layer declares it builds at publish
 *
 * A layer's `builtAtPublish` (`schemas/kg/built-at-publish.ts`) lists
 * artefacts no commit of it can hold current — computed over the checkout's
 * other layers (`checkout`), or from a branch-kept graph (`state`) — and
 * names each one's writer as a package script. After the branch-derived
 * artefacts, this runs every such writer once, in the order {@link writersOf}
 * works out (see "Writer order"), and then REFUSES an entry that came out
 * missing or empty. `--cause state` runs only the state-derived ones (what an
 * e2e job reading the beans and todos projections needs after `state:mount`).
 * No list of generators lives here or in a workflow.
 *
 * ## Refusals, not silence
 *
 * A writer that exits non-zero fails the step, naming it — after every other
 * declared writer has run, so one run names every failure. A writer refuses an
 * unmounted graph (exit 2), so a build that forgot `state:mount` fails here.
 *
 * A writer that exits `NOT_APPLICABLE_EXIT` (78, `lib/not-applicable.ts`) has
 * said, with a reason, that THIS root cannot build its artefact (`uml:overview`
 * needs the gates workflow, which a document folio lacks). It is reported
 * SKIPPED with its reason, the artefacts that name it are excused from the
 * built-or-refused check (and listed), and the step does not fail on it. Only
 * the writer can say so; no list of writers or roots lives here.
 *
 * ## Writer order: lowest layer first, plus the edges the declarations state
 *
 * The base order is the layers' dependency order (lowest layer first, a
 * function of the declared `needs` alone), each layer's entries in their
 * declared order, and a writer named by several entries runs ONCE. On top of
 * that, two kinds of hard edge, both read from the declarations:
 *
 * - a layer's own declared order: each of its writers runs after the one
 *   it lists before it (`processes:viz` after `render:bpmn`, `navbar:include`
 *   after the `docs:harness` whose `harness.json` it renders). A route
 *   derived from a `builtOnHostSite` visualiser is not listed by its host and
 *   adds no such edge; a harness's host-site viewers run in the order it
 *   declares them;
 * - a READ EDGE (`reads` on an entry, `schemas/kg/built-at-publish.ts` in
 *   cat-harness): the entry's writers run after the writers of every OTHER
 *   layer's entry that fills (`directory`) a directory of one of those
 *   kinds. For example cat-harness's `docs/_data/harness.json` declares
 *   `reads: ["docs"]`, because it links an IG only when that IG's `docs/`
 *   exists.
 *
 * The sort is stable (a writer runs as early as its edges allow, ties broken
 * by first mention), and a cycle is REFUSED, naming the writers in it.
 *
 * ## Reuse and parallelism
 *
 * Each declared writer is keyed (`derive-cache.ts`: its input-hash
 * fingerprint plus its predecessors' outputs), and a writer whose key has a
 * recorded result is RESTORED from `CAT_DERIVE_CACHE_DIR` (default
 * `build/derive-cache`) and reported `reused <writer> (inputs unchanged since
 * <key>)` — never as built. Writers the declared edges leave unordered run at
 * once, at most `CAT_DERIVE_JOBS` (default: the cores); with
 * `CAT_DERIVE_JOBS=1` it is the sequential order above, output unbuffered.
 * `--no-cache` turns reuse off; so does `CI`, unless `CAT_DERIVE_CACHE_DIR`
 * opts in.
 *
 * ```
 * bun run cat derive:publish            # run every writer
 * bun run cat derive:publish --list     # print what would run, run nothing
 * bun run cat derive:publish --no-cache # run every writer, reuse nothing
 * ```
 */
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import { judge, readTree, renderingOrder, trackedIn, type PublishArtefact } from "./check-derived-from.ts";
import { readInstances } from "./check-import-direction.ts";
import { readDeclaration } from "../schemas/kg/cat-harness.ts";
import { BuiltAtPublishCauseSchema, type BuiltAtPublishCause } from "../schemas/kg/built-at-publish.ts";
import { DEFAULT_LOCALE } from "../schemas/content/translation.ts";
import { discoverTools } from "../tools/discover.ts";
import { declaredVisualisers, siteOwnerDir, visualiserPageDir } from "./viewer-declarations.ts";
import { flattenDependencies } from "../schemas/kg/dependency-order.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { outputTwinOf } from "./lib/layer-output.ts";
import { NOT_APPLICABLE_EXIT, NOT_APPLICABLE_REASON_ENV } from "./lib/not-applicable.ts";
import { buildTypeOf, isIndexWriter } from "./lib/build-type.ts";
import { dirname } from "node:path";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { FileDigests, TRACKED, fingerprint, trackedTreeDigest, type Fingerprint } from "./input-hash.ts";
import { TASK_IO } from "./task-io.ts";
import {
  cacheDirOf,
  commitStaged,
  deriveCacheEnabled,
  digestPaths,
  hasEntry,
  jobsOf,
  nestedForeign,
  outputsByWriter,
  predecessorsOf,
  restoreOutputs,
  schedule,
  stageOutputs,
  writerKey,
} from "./derive-cache.ts";
import { openTrace } from "../schemas/sdlc/input-trace.ts";
import { BUILDING_ENV, STAMP_PATH, workingCopyState } from "./qa-working-copy.ts";
import {
  carryRecord,
  decideWriter,
  entryShaOf,
  outputsDiffer,
  churnReport,
  renderChurn,
  WRITER_CHURN_FILE,
  type ChurnEntry,
  type ChurnCause,
  emptyRecords,
  loadWriterRecords,
  projectedReadsOf,
  readTraceFile,
  saveWriterRecords,
  snapshotPaths,
  STRACE_SEES,
  tracedArgv,
  underOutputs,
  writerBase,
  writerRecordOf,
  WRITER_OUTPUTS_DIR,
  WRITER_RECORD_ENV,
  WRITER_RECORD_FILE,
  WRITER_SKIP_ENV,
} from "./writer-cone.ts";

const REPO_ROOT = resolve(dirname(HARNESS_ROOT));

/** The publish-time artefacts in rendering order: a source's artefacts before its consumers'. */
export function publishPlan(repoRoot = REPO_ROOT): PublishArtefact[] {
  const tree = readTree(repoRoot);
  const j = judge(tree, (p) => existsSync(resolve(repoRoot, p)), trackedIn(repoRoot));
  const order = renderingOrder(tree, j.edges);
  const rank = new Map(order.map((n, k) => [n, k]));
  return [...j.publish].sort((a, b) => (rank.get(a.node) ?? 0) - (rank.get(b.node) ?? 0) || a.artefact.localeCompare(b.artefact));
}

/** One declared publish-time artefact, resolved: which layer, where on disk, who writes it. */
export interface DeclaredArtefact {
  instance: string;
  /** Absolute. */
  abs: string;
  /** Instance-relative, as declared. */
  path: string;
  writer: readonly string[];
  because: BuiltAtPublishCause;
  /** The kinds of directory, in other layers, its writers read (`reads`): the declared read edge. */
  reads?: readonly string[];
  /** The kinds of the declared directory this entry fills (`directory`), so a reader of those kinds is ordered after it. */
  fills?: readonly string[];
  /** A whole-corpus index: a `preview` build puts back main's copy rather than running its writer (`lib/build-type.ts`). */
  index?: true;
  /**
   * Derived from a visualiser's `builtOnHostSite` for a translated locale
   * ({@link hostSiteArtefacts}): the writer writes it only when that locale
   * holds strings for it, so an absent route is not a missing output.
   */
  optional?: true;
  /** The harness whose `builtOnHostSite` visualiser this route was derived from ({@link hostSiteArtefacts}). */
  hostSiteOf?: string;
}

/**
 * The order layers' publish-time entries are read in: dependency order,
 * lowest layer first, a function of the declared `needs` alone. The base of
 * {@link writersOf}; the declared edges reorder writers on top of it.
 */
export function writingOrder(repoRoot = REPO_ROOT): string[] {
  const all = readInstances(repoRoot);
  const names = new Set(all.map((i) => i.name));
  const flat = flattenDependencies(all.map((i) => ({ id: i.name, needs: (i.needs ?? []).filter((n) => names.has(n)), fatal: false })));
  if (flat.problems.length > 0) {
    throw new Error(`derive:publish: the instance needs graph is broken — ${flat.problems.map((p) => p.detail).join("; ")}`);
  }
  return flat.order.map((s) => s.id);
}

/**
 * The kinds of the declared directory that holds `path`, for an entry that
 * names no `directory`: the deepest one whose `path` contains it. Its writer
 * writes inside that directory, so a reader of the directory's kinds runs
 * after it. Without this, an IG's `fhir-artifact-index/index.json`
 * (writer `ig-index:build`, which also rewrites `sidecars/`) filled no kind,
 * and `uml:overview`, which draws every declared directory, ran beside it and
 * read a sidecar while it was being replaced (folio-assistant#2953, ENOENT on
 * `sidecars/StructureDefinition-RequirementsSource.schema.json`).
 */
export function enclosingKinds(
  directories: ReadonlyArray<{ path?: string; graphTypologies?: string[]; kinds?: string[] }>,
  path: string,
): string[] {
  const norm = (p: string): string => p.replace(/^\.\//, "").replace(/\/*$/, "/");
  const file = path.replace(/^\.\//, "");
  let best: { len: number; kinds: string[] } | undefined;
  for (const d of directories) {
    if (d.path === undefined) continue;
    const dir = norm(d.path);
    if (dir === "/" || !(file.startsWith(dir) || norm(file) === dir)) continue;
    if (best === undefined || dir.length > best.len) best = { len: dir.length, kinds: d.graphTypologies ?? d.kinds ?? [] };
  }
  return best?.kinds ?? [];
}

/** Every layer's `builtAtPublish`, layers lowest layer first ({@link writingOrder}), entries as declared. */
export function declaredPlan(repoRoot = REPO_ROOT, cause?: BuiltAtPublishCause): DeclaredArtefact[] {
  const order = writingOrder(repoRoot);
  const roots = new Map(readInstances(repoRoot).map((i) => [i.name, i.root] as const));
  const out: DeclaredArtefact[] = [];
  for (const name of order) {
    const root = roots.get(name);
    if (root === undefined) continue;
    const decl = readDeclaration(root) as
      | {
          builtAtPublish?: Array<{ path: string; writer: string[]; because: BuiltAtPublishCause; reads?: string[]; directory?: string; index?: true }>;
          directories?: Array<{ id?: string; path?: string; graphTypologies?: string[]; kinds?: string[] }>;
        }
      | undefined;
    const kindsOf = new Map((decl?.directories ?? []).map((d) => [d.id, d.graphTypologies ?? d.kinds ?? []] as const));
    for (const e of decl?.builtAtPublish ?? []) {
      if (cause !== undefined && e.because !== cause) continue;
      const fills = e.directory === undefined ? enclosingKinds(decl?.directories ?? [], e.path) : (kindsOf.get(e.directory) ?? []);
      out.push({
        instance: name,
        abs: join(root, e.path),
        path: e.path,
        writer: e.writer,
        because: e.because,
        ...(e.reads?.length ? { reads: e.reads } : {}),
        ...(fills.length ? { fills } : {}),
        ...(e.index === true ? { index: true as const } : {}),
      });
    }
  }
  return withHostSiteArtefacts(out, hostSiteArtefacts(repoRoot, out, cause));
}

/**
 * `declared` with the host-site routes placed in the host's writer order: a
 * harness's host-site viewers run together, in the order it declares them,
 * at the place the first one already holds. Each route goes after the host's
 * last entry of its own writer; failing that, after the last route placed for
 * the same harness; failing both, at the end. Placed this way, deriving the
 * routes the host used to list leaves the writer order unchanged.
 */
export function withHostSiteArtefacts(declared: readonly DeclaredArtefact[], derived: readonly DeclaredArtefact[]): DeclaredArtefact[] {
  const out = [...declared];
  const lastOf = new Map<string, number>();
  for (const d of derived) {
    let at = -1;
    for (let k = out.length - 1; k >= 0; k--) {
      if (out[k]!.instance === d.instance && out[k]!.writer.includes(d.writer[0]!)) {
        at = k;
        break;
      }
    }
    if (at < 0) at = lastOf.get(d.hostSiteOf ?? "") ?? out.length - 1;
    out.splice(at + 1, 0, d);
    for (const [h, k] of lastOf) if (k > at) lastOf.set(h, k + 1);
    lastOf.set(d.hostSiteOf ?? "", at + 1);
  }
  return out;
}

/** The locale directories every layer's `translation-sources` directory holds, the page locale aside. */
export function translatedLocales(repoRoot = REPO_ROOT): string[] {
  const out = new Set<string>();
  for (const i of readInstances(repoRoot)) {
    const decl = readDeclaration(i.root) as { directories?: Array<{ path: string; graphTypologies?: string[] }> } | undefined;
    for (const d of decl?.directories ?? []) {
      if (!(d.graphTypologies ?? []).includes("translation-sources")) continue;
      const dir = join(i.root, d.path);
      if (!existsSync(dir)) continue;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory() && /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(e.name) && e.name !== DEFAULT_LOCALE) out.add(e.name);
      }
    }
  }
  return [...out].sort();
}

/**
 * The routes visualisers build on the HOST site (`builtOnHostSite`; bean
 * folio-assistant-uldr, owner option "1", 2026-11-06), as plan entries of the
 * host layer, so the host lists none of them. One per locale the viewer
 * writes: the page locale, and with `translated` each locale of
 * {@link translatedLocales}. The writer is the `renderedBy` Tool's
 * `invoke.shell` script; a Tool that does not resolve to one is refused, not
 * guessed. A route an entry already declares (itself or a parent) is left to
 * that entry. Each route counts as an index when every declared entry of its
 * writer does, so a preview borrows it with the rest of that writer's output.
 */
export function hostSiteArtefacts(repoRoot = REPO_ROOT, declared: readonly DeclaredArtefact[] = [], cause?: BuiltAtPublishCause): DeclaredArtefact[] {
  if (cause !== undefined && cause !== "checkout") return []; // host-site pages are computed over the checkout
  const vis = declaredVisualisers(repoRoot).filter((v) => (v as { builtOnHostSite?: unknown }).builtOnHostSite !== undefined);
  if (vis.length === 0) return [];
  const site = siteOwnerDir(repoRoot);
  const host = readInstances(repoRoot).find((i) => (resolve(site) + sep).startsWith(resolve(i.root) + sep));
  if (host === undefined) throw new Error(`derive:publish: no instance holds the host site ${site}`);
  const covered = (abs: string) => declared.some((a) => (a.path.endsWith("/") ? (resolve(abs) + sep).startsWith(resolve(a.abs) + sep) : resolve(abs) === resolve(a.abs)));
  let translated: string[] | undefined;
  const out: DeclaredArtefact[] = [];
  for (const v of vis) {
    const shell = rendererShell(repoRoot, v);
    const writer = /^bun run (?:cat )?(\S+)$/.exec(shell?.trim() ?? "")?.[1];
    if (writer === undefined) {
      throw new Error(`derive:publish: visualiser ${v.harness}/${v.id} is builtOnHostSite, but its Tool ${v.renderedBy} has no \`bun run cat <script>\` invoke.shell (got ${JSON.stringify(shell)})`);
    }
    const mine = declared.filter((a) => a.writer.includes(writer));
    const index = mine.length > 0 && mine.every((a) => a.index === true);
    const locales = [DEFAULT_LOCALE as string, ...((v as { builtOnHostSite?: { translated?: true } }).builtOnHostSite?.translated ? (translated ??= translatedLocales(repoRoot)) : [])];
    for (const locale of locales) {
      const abs = visualiserPageDir(site, { locale, harness: v.harness, visualiser: v.id });
      if (covered(abs)) continue;
      out.push({
        instance: host.name,
        abs: abs + "/",
        path: relative(host.root, abs).split(sep).join("/") + "/",
        writer: [writer],
        because: "checkout",
        ...(index ? { index: true as const } : {}),
        ...(locale !== DEFAULT_LOCALE ? { optional: true as const } : {}),
        hostSiteOf: v.harness,
      });
    }
  }
  return out;
}

/**
 * The `invoke.shell` of the Tool that renders a visualiser: the declaring
 * layer's own Tool of that id when it has one, else the one another layer
 * holds. A layer above the harness declares a page the harness's Tool draws
 * (cat-harness#1150: folio-assistant-sci's Editor checkers page, drawn by
 * cat-harness's state-viewer), so looking only in the declaring layer refused
 * every such page.
 */
export function rendererShell(repoRoot: string, v: { renderedBy: string; harnessRoot: string }): string | undefined {
  const shellOf = (t: unknown) => (t as { invoke?: { shell?: string } } | undefined)?.invoke?.shell;
  const own = discoverTools(repoRoot, undefined, v.harnessRoot).tools.find((t) => t.id === v.renderedBy);
  if (own !== undefined) return shellOf(own);
  return shellOf(discoverTools(repoRoot).tools.find((t) => t.id === v.renderedBy));
}

/** One ordering edge: `before` runs before `after`, and why the declarations say so. */
export interface WriterEdge {
  before: string;
  after: string;
  why: string;
}

/**
 * The ordering edges the plan declares (see "Writer order" above): each
 * layer's writers in the order it lists them, each harness's host-site
 * viewers in the order it declares them, and every `reads` edge.
 *
 * A host-site route ({@link hostSiteArtefacts}) is not listed by its host, so
 * it adds no "lists" edge: its place in the plan is where it RUNS when nothing
 * orders it, not an order the host declared. Read as one, a host that does not
 * list the route's writer itself (a downstream IG root, whose only
 * entries are its own pages and context) was made to declare its pages before
 * the glossary, while cat-harness declares the glossary before the pages it
 * reads: a cycle, and derive:publish refused to build anything in such a
 * root. The routes of one harness keep their own order.
 */
export function writerEdges(plan: readonly DeclaredArtefact[]): WriterEdge[] {
  const edges: WriterEdge[] = [];
  const byInstance = new Map<string, string[]>();
  const byHarness = new Map<string, string[]>();
  for (const a of plan) {
    const [key, into] = a.hostSiteOf === undefined ? [a.instance, byInstance] : [a.hostSiteOf, byHarness];
    const seq = into.get(key) ?? [];
    for (const w of a.writer) if (!seq.includes(w)) seq.push(w);
    into.set(key, seq);
  }
  for (const [instance, seq] of byInstance) {
    for (let k = 1; k < seq.length; k++) edges.push({ before: seq[k - 1]!, after: seq[k]!, why: `${instance} lists ${seq[k - 1]} before ${seq[k]}` });
  }
  for (const [harness, seq] of byHarness) {
    for (let k = 1; k < seq.length; k++) edges.push({ before: seq[k - 1]!, after: seq[k]!, why: `${harness} declares its host-site viewer of ${seq[k - 1]} before that of ${seq[k]}` });
  }
  for (const reader of plan) {
    for (const kind of reader.reads ?? []) {
      for (const source of plan) {
        if (source.instance === reader.instance || !(source.fills ?? []).includes(kind)) continue;
        for (const before of source.writer) {
          for (const after of reader.writer) {
            if (before !== after) edges.push({ before, after, why: `${reader.instance}/${reader.path} reads ${kind}, which ${source.instance}/${source.path} fills` });
          }
        }
      }
    }
  }
  return edges;
}

/**
 * The scripts to run, each once: first-mention order, reordered by the
 * declared edges ({@link writerEdges}) with a stable topological sort, so a
 * writer runs as early as its edges allow. Throws on a cycle, naming it.
 */
export function writersOf(plan: readonly DeclaredArtefact[]): string[] {
  const nodes = [...new Set(plan.flatMap((a) => a.writer))];
  const rank = new Map(nodes.map((n, k) => [n, k] as const));
  const edges = writerEdges(plan);
  const next = new Map<string, Set<string>>(nodes.map((n) => [n, new Set<string>()]));
  const indegree = new Map<string, number>(nodes.map((n) => [n, 0]));
  for (const e of edges) {
    if (next.get(e.before)!.has(e.after)) continue;
    next.get(e.before)!.add(e.after);
    indegree.set(e.after, indegree.get(e.after)! + 1);
  }
  const out: string[] = [];
  const ready = nodes.filter((n) => indegree.get(n) === 0);
  while (ready.length > 0) {
    ready.sort((a, b) => rank.get(a)! - rank.get(b)!);
    const n = ready.shift()!;
    out.push(n);
    for (const m of next.get(n)!) {
      indegree.set(m, indegree.get(m)! - 1);
      if (indegree.get(m) === 0) ready.push(m);
    }
  }
  if (out.length < nodes.length) {
    const stuck = new Set(nodes.filter((n) => !out.includes(n)));
    const why = edges.filter((e) => stuck.has(e.before) && stuck.has(e.after)).map((e) => `${e.before} → ${e.after} (${e.why})`);
    throw new Error(`derive:publish: the publish-time writers' declared order has a cycle among ${[...stuck].join(", ")}: ${why.join("; ")}`);
  }
  return out;
}

/**
 * Built means present and, for a directory, holding at least one file. An
 * artefact of a MOUNTED layer is built at the layer's output root (bean
 * `cat-tools-sm8r`, item 4, step 4; `lib/layer-output.ts`), so either copy
 * counts: the output root's, or the pinned one.
 */
export function built(a: Pick<DeclaredArtefact, "abs" | "path">, root: string = REPO_ROOT): boolean {
  const twin = outputTwinOf(root, a.abs);
  return [a.abs, ...(twin === undefined ? [] : [twin])].some((at) => builtAt(at, a.path.endsWith("/")));
}

function builtAt(at: string, directory: boolean): boolean {
  if (!existsSync(at)) return false;
  if (!directory) return statSync(at).isFile();
  const walk = (d: string): boolean => readdirSync(d, { withFileTypes: true }).some((e) => (e.isDirectory() ? walk(join(d, e.name)) : true));
  return statSync(at).isDirectory() && walk(at);
}

/**
 * The artefacts only `writer` builds that are still not built: after a preview
 * borrows main's copy of an index writer, an artefact declared since main's
 * copy was made is absent, and the writer has to run to build it.
 */
export function unbuiltOnlyBy(declared: readonly Pick<DeclaredArtefact, "instance" | "abs" | "path" | "writer">[], writer: string): string[] {
  return declared.filter((a) => a.writer.length > 0 && a.writer.every((w) => w === writer) && !built(a)).map((a) => `${a.instance}/${a.path}`);
}

/** Whether `strace` runs here (writer records need it). */
export function straceWorks(): boolean {
  // input-site: inert #50824495 — probes for the tracer; its answer only turns recording on or off
  const r = spawnSync("strace", ["-f", "-qq", "-o", "/dev/null", "true"], { stdio: "ignore" });
  return r.status === 0;
}

/** What one writer did: ran, failed with an exit, or declined this root with a reason. */
export type WriterOutcome = { kind: "ran" } | { kind: "failed"; exit: number | null } | { kind: "skipped"; why: string };

/** Read a writer's exit, and its handed-over reason when it declined (`lib/not-applicable.ts`). */
export function outcomeOf(status: number | null, reason: string | undefined): WriterOutcome {
  if (status === 0) return { kind: "ran" };
  if (status === NOT_APPLICABLE_EXIT) return { kind: "skipped", why: reason?.trim() || "the writer gave no reason" };
  return { kind: "failed", exit: status };
}

/** Run one writer, handing it a file for its not-applicable reason. */
export function runWriter(argv: readonly string[], cwd: string): WriterOutcome {
  // input-site: inert #d24ef100 — a temp dir for the writer's reason, removed before this returns
  const dir = mkdtempSync(join(tmpdir(), "derive-publish-"));
  const file = join(dir, "not-applicable.txt");
  try {
    // input-site: inert #9142594c — hands the environment on to a writer, plus the path it writes its reason to
    const r = spawnSync(argv[0]!, argv.slice(1), { cwd, stdio: "inherit", env: { ...process.env, [NOT_APPLICABLE_REASON_ENV]: file } });
    return outcomeOf(r.status, existsSync(file) ? readFileSync(file, "utf-8") : undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * {@link runWriter}, without blocking, so writers the declared edges leave
 * unordered run side by side. `buffer`: collect the writer's output and hand
 * it back, so parallel writers' logs come out whole rather than interleaved.
 */
// input-site: inert #8d7029a5 — the environment handed on to a writer by default; the writer's own reads are its own sites
export function runWriterAsync(argv: readonly string[], cwd: string, buffer: boolean, env: Record<string, string | undefined> = process.env): Promise<{ outcome: WriterOutcome; log: string }> {
  // input-site: inert #d24ef100 — a temp dir for the writer's reason, removed before this resolves
  const dir = mkdtempSync(join(tmpdir(), "derive-publish-"));
  const file = join(dir, "not-applicable.txt");
  return new Promise((done) => {
    let log = "";
    // input-site: inert #8cc2849c — hands the environment on to a writer, plus the path it writes its reason to
    const child = spawn(argv[0]!, argv.slice(1), { cwd, stdio: buffer ? ["ignore", "pipe", "pipe"] : "inherit", env: { ...env, [NOT_APPLICABLE_REASON_ENV]: file } });
    child.stdout?.on("data", (d: Buffer) => (log += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (log += d.toString()));
    const finish = (status: number | null) => {
      const reason = existsSync(file) ? readFileSync(file, "utf-8") : undefined;
      rmSync(dir, { recursive: true, force: true });
      done({ outcome: outcomeOf(status, reason), log });
    };
    child.on("error", (e) => {
      log += `${String(e)}\n`;
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}

/**
 * The input-hash fingerprint a declared writer is keyed on (`derive-cache.ts`):
 * its own `task-io` inputs when it declares them, else `{tracked}` — the whole
 * tree, never a narrowed guess (`task-io.ts`, "The rule for adding one").
 */
export function writerFingerprint(root: string, scripts: Readonly<Record<string, string>>, writer: string, digests: FileDigests): Fingerprint {
  return fingerprint(root, scripts, [writer], { inputs: TASK_IO[writer]?.inputs ?? [TRACKED] }, digests);
}

/**
 * The declared artefacts excused because a writer of theirs declined this root,
 * and the ones that must be built: an entry naming a skipped writer cannot be
 * complete, so it is reported rather than refused.
 */
export function excused(plan: readonly DeclaredArtefact[], skipped: ReadonlyMap<string, string>): { excused: DeclaredArtefact[]; judged: DeclaredArtefact[] } {
  const ex = plan.filter((a) => a.writer.some((w) => skipped.has(w)));
  return { excused: ex, judged: plan.filter((a) => !ex.includes(a)) };
}

if (import.meta.main) {
  const plan = publishPlan();
  const listOnly = process.argv.includes("--list");
  console.log(`derive:publish — ${plan.length} artefact(s) built at publish`);
  for (const a of plan) console.log(`  ${a.artefact}  ← ${a.via.join(" ← ")}  (writer: ${a.writer.join(", ")})`);
  for (const a of listOnly ? [] : plan) {
    // The writer list holds scripts and, for a directory, template directories
    // it READS (ending in `/`); only the scripts are run.
    for (const w of a.writer.filter((p) => !p.endsWith("/"))) {
      const o = runWriter(["bun", "run", w], REPO_ROOT);
      if (o.kind === "failed") {
        console.log(`::error::derive:publish: writer ${w} for ${a.artefact} exited ${o.exit ?? "on a signal"}`);
        process.exit(1);
      }
      if (o.kind === "skipped") console.log(`  skipped: writer ${w} for ${a.artefact} does not apply to this root — ${o.why}`);
    }
  }
  console.log(`  ✓ ${plan.length} artefact(s) handled`);

  const at = process.argv.indexOf("--cause");
  const cause = at === -1 ? undefined : (process.argv[at + 1] as BuiltAtPublishCause);
  if (cause !== undefined && !BuiltAtPublishCauseSchema.options.includes(cause)) {
    console.log(`::error::derive:publish: --cause is one of ${BuiltAtPublishCauseSchema.options.join(", ")}, not ${String(cause)}`);
    process.exit(2);
  }
  const declared = declaredPlan(REPO_ROOT, cause);
  let writers: string[];
  try {
    writers = writersOf(declared);
  } catch (e) {
    console.log(`::error::${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  console.log(`derive:publish — ${declared.length} declared artefact(s) (builtAtPublish${cause ? `, ${cause} only` : ""}), ${writers.length} writer(s)`);
  for (const a of declared) console.log(`  ${a.instance}/${a.path}  (${a.because}; writer: ${a.writer.join(", ")}${a.reads ? `; reads: ${a.reads.join(", ")}` : ""})`);
  console.log(`  writer order: ${writers.join(" → ")}`);
  if (listOnly) process.exit(0);
  // Every writer runs, whatever an earlier one did, so one run names every
  // failure rather than the first (smart-ra#66 hid three behind uml:overview).
  // A failure still fails the step, after the rest have run.
  const skipped = new Map<string, string>();
  const failed = new Map<string, number | null>();
  const reused = new Map<string, string>();
  // ── Issue #400: key, reuse, and run unordered writers side by side ──
  // input-site: env CAT_BUILD_TYPE,CAT_WRITER_SKIP,CAT_WRITER_RECORD; inert #c6583b74 — the build type (a preview borrows main's indexes, `buildTypeOf`) and the writer skip/record switches (a skipped writer puts back main's recorded outputs) decide WHAT is written, so their values are hashed; the cache directory, the job count and the CI switch decide only how the writers run
  const env = process.env;
  const jobs = jobsOf(env);
  const cacheOn = deriveCacheEnabled(process.argv, env);
  const cacheDir = cacheDirOf(REPO_ROOT, env);
  const edges = writerEdges(declared);
  const byWriter = outputsByWriter(declared, REPO_ROOT);
  const allOutputs = [...new Set([...byWriter.values()].flat())];
  const scripts = cacheOn.on ? scriptsOf(REPO_ROOT) : {};
  const digests = new FileDigests(REPO_ROOT);
  // One tree digest for the run, over the tree as it stands before any declared
  // writer runs, leaving out every declared output (each run rewrites them).
  const treeBefore = cacheOn.on ? trackedTreeDigest(REPO_ROOT, digests, { exclude: allOutputs }) : undefined;
  if (treeBefore !== undefined) digests.tree = treeBefore;
  const base = new Map<string, Fingerprint>(cacheOn.on ? writers.map((w) => [w, writerFingerprint(REPO_ROOT, scripts, w, digests)] as const) : []);
  const staged = new Map<string, { key: string; path: string }>();
  // When qa:working-copy already stamped a current QA copy before derive:publish
  // ran, tell child writers (uml:overview) so they do not re-hash the untracked
  // tree or spawn git hash-object --stdin-paths inside strace.
  const qaCurrent = existsSync(join(REPO_ROOT, STAMP_PATH)) && workingCopyState(REPO_ROOT).state === "current";
  const writerEnv: Record<string, string | undefined> = qaCurrent ? { ...env, [BUILDING_ENV]: "1" } : env;
  // ── Bean fwtz, option B: record what each writer read and wrote (skips nothing) ──
  // input-site: inert #5f0c2a71 — the switch decides whether writers run traced, never what they write
  const recordOn = env[WRITER_RECORD_ENV] === "1" && straceWorks();
  // input-site: inert #a3e7d915 — the commit names the record; it is not an input of any writer
  const records = emptyRecords(env.GITHUB_SHA ?? "local");
  // Files each writer read and then rewrote, kept as its inputs (see parseTrace's rewriteAsInput).
  const rewrittenBy = new Map<string, string[]>();
  const declaredOutput = underOutputs(allOutputs);
  // Previews skip a writer whose recorded reads all match, and put back the
  // outputs the recording run kept (owner 2026-10-31 14:32Z: "dont wait for
  // clean deploys to skip. we can fix aftermath"). With recording on too, the
  // record is INCREMENTAL (cat-harness-tools#1702): a writer whose reads all
  // match is skipped and its record carried forward; only the rest run traced.
  const skipOn = env[WRITER_SKIP_ENV] === "1";
  const incremental = skipOn && recordOn;
  // A PREVIEW build does not rebuild a whole-corpus index: it puts back main's
  // copy from the same recording the skip reads (owner 2026-11-01, "preview" =
  // no reindex, only changes). A full build, and a recording run, run them.
  const bt = buildTypeOf(env);
  if ("refused" in bt) {
    console.log(`::error::derive:publish: ${bt.refused}`);
    process.exit(2);
  }
  const borrowOn = bt.type === "preview" && !recordOn;
  const prevRecords = skipOn || borrowOn ? loadWriterRecords(REPO_ROOT) : undefined;
  const outDir = join(REPO_ROOT, WRITER_OUTPUTS_DIR);
  const decideDigests = new FileDigests(REPO_ROOT);
  const recScripts = recordOn || skipOn ? (cacheOn.on ? scripts : scriptsOf(REPO_ROOT)) : {};
  if (env[WRITER_RECORD_ENV] === "1" && !recordOn) console.log("  writer records: OFF (strace does not run here)");
  console.log(`  build type: ${bt.type} (${bt.why})${borrowOn ? `; indexes from main: ${prevRecords ? prevRecords.sha.slice(0, 12) : "no recording here, so they are built"}` : ""}`);
  if (skipOn) console.log(`  writer skip: ON${incremental ? ", recording incrementally (a skipped writer keeps its record; the rest run traced)" : ""} (${prevRecords ? `records of ${prevRecords.sha.slice(0, 12)}, ${Object.keys(prevRecords.writers).length} writer(s)` : "no records: every writer runs"})`);
  console.log(
    `  ${jobs} job(s); reuse ${cacheOn.on ? `ON (${cacheDir}${treeBefore && "undetermined" in treeBefore ? `; tree undetermined: ${treeBefore.undetermined}` : ""})` : `OFF (${cacheOn.why})`}`,
  );
  /** Run `w` traced and record it; the outcome is always the writer's own (a failed traced run is asked again untraced). */
  const runRecorded = async (w: string): Promise<{ outcome: WriterOutcome; log: string }> => {
    const before = writerBase(REPO_ROOT, recScripts, w, new FileDigests(REPO_ROOT));
    const trace = openTrace(REPO_ROOT);
    // input-site: inert #fd4c3e00 — a scratch file for the trace, removed before this returns
    const traceLog = join(tmpdir(), `writer-cone-${process.pid}-${w.replace(/[^\w.-]/g, "_")}.strace`);
    const tracedEnv = qaCurrent ? { ...trace.env, [BUILDING_ENV]: "1" } : trace.env;
    const first = await runWriterAsync(tracedArgv(["bun", "run", "cat", w], traceLog), REPO_ROOT, jobs > 1, tracedEnv);
    try {
      if (first.outcome.kind !== "ran") {
        records.unrecorded[w] = `the traced run ${first.outcome.kind === "failed" ? `exited ${first.outcome.exit}` : "was skipped"}`;
        trace.reached();
        return first.outcome.kind === "skipped" ? first : await runWriterAsync(["bun", "run", "cat", w], REPO_ROOT, jobs > 1, writerEnv);
      }
      const digests = new FileDigests(REPO_ROOT);
      const reached = trace.reached([], STRACE_SEES);
      const projected = projectedReadsOf(trace.projected(), REPO_ROOT);
      const readSet = readTraceFile(traceLog, REPO_ROOT, underOutputs(byWriter.get(w) ?? []), (rel) => !declaredOutput(rel), new Set(projected.keys()));
      const rec = writerRecordOf({
        sha: records.sha,
        ran: true,
        before,
        after: writerBase(REPO_ROOT, recScripts, w, digests),
        reads: readSet,
        reached,
        root: REPO_ROOT,
        digests,
        projected,
      });
      const own = byWriter.get(w) ?? [];
      const snap = "none" in rec ? rec : snapshotPaths(own, Object.keys(rec.outputs), underOutputs(own), declaredOutput);
      if ("none" in snap) records.unrecorded[w] = snap.none;
      else if (!("none" in rec)) {
        records.writers[w] = rec;
        if ("rewritten" in readSet && readSet.rewritten?.length) {
          rewrittenBy.set(w, readSet.rewritten);
          rec.rewritten = [...readSet.rewritten].sort();
        }
        // Keep what it actually wrote, declared or not, so a preview that skips it puts all of it back.
        const keep = nestedForeign(w, byWriter);
        commitStaged(outDir, w, records.sha, stageOutputs(outDir, w, records.sha, REPO_ROOT, snap.paths, keep));
      }
    } catch (e) {
      // Recording is never allowed to change the writer's outcome.
      records.unrecorded[w] = (e as Error).message;
    } finally {
      rmSync(traceLog, { force: true });
    }
    return first;
  };
  // What each writer did and why, for the churn report (skip mode only: without records there is nothing to compare).
  const churn: ChurnEntry[] = [];
  const runOne = async (w: string): Promise<WriterOutcome> => {
    const keep = nestedForeign(w, byWriter);
    let cause: ChurnCause | undefined;
    let ranWhy = "";
    // Seconds per writer, so a slow one can be named from a published log (bean fwtz).
    const t0 = performance.now();
    const secs = () => `${((performance.now() - t0) / 1000).toFixed(1)}s`;
    // Set when a borrowed copy leaves a declared artefact unbuilt: putting back an older copy cannot build it either.
    let mustRun = false;
    if (borrowOn && prevRecords !== undefined && isIndexWriter(w, declared)) {
      const from = entryShaOf(prevRecords, w);
      const restored = hasEntry(outDir, w, from) && restoreOutputs(outDir, w, from, REPO_ROOT, keep);
      const unbuilt = restored ? unbuiltOnlyBy(declared, w) : [];
      mustRun = unbuilt.length > 0;
      if (restored && unbuilt.length === 0) {
        reused.set(w, from);
        console.log(`  borrowed ${w}: a preview build does not reindex; put back main's copy from ${from.slice(0, 12)} [${secs()}]`);
        return { kind: "ran" };
      }
      console.log(
        restored
          ? `  ${w} runs: main's copy from ${from.slice(0, 12)} builds nothing at ${unbuilt.join(", ")}, declared since [decided in ${secs()}]`
          : `  ${w} runs: an index, but main's recording holds no copy of it [decided in ${secs()}]`,
      );
    }
    if (skipOn && prevRecords !== undefined && !mustRun) {
      // One file-digest memo for every decision: it is keyed on size and
      // mtime, so a file a predecessor rewrote is hashed again, and a fresh
      // memo per writer re-hashed every recorded read once per writer. Only
      // git's view of the tree is asked again for each writer.
      const fresh = decideDigests;
      fresh.tree = undefined;
      const d = decideWriter(prevRecords, w, writerBase(REPO_ROOT, recScripts, w, fresh), REPO_ROOT, fresh);
      const putBack = d.skip && hasEntry(outDir, w, d.sha) && restoreOutputs(outDir, w, d.sha, REPO_ROOT, keep);
      const differ = putBack ? outputsDiffer(REPO_ROOT, prevRecords.writers[w]!) : [];
      if (putBack && differ.length === 0) {
        reused.set(w, d.sha);
        if (incremental && carryRecord(records, prevRecords, w)) {
          const rw = prevRecords.writers[w]!.rewritten;
          if (rw?.length) rewrittenBy.set(w, rw);
        }
        console.log(`  skipped ${w}: ${d.why}; put back its outputs from ${d.sha.slice(0, 12)}${d.proof ? "" : " (evidence, not proof)"}${incremental ? "; its record is kept" : ""} [${secs()}]`);
        churn.push({ writer: w, did: "skipped", why: d.why, seconds: (performance.now() - t0) / 1000 });
        return { kind: "ran" };
      }
      ranWhy = !d.skip ? d.why : differ.length > 0 ? `its put-back outputs do not match its record (${differ.slice(0, 3).join(", ")}${differ.length > 3 ? ", …" : ""})` : "its recorded outputs are not here";
      if (!d.skip) cause = d.cause;
      console.log(`  ${w} runs: ${ranWhy} [decided in ${secs()}]`);
    }
    const fp = base.get(w);
    let key: string | undefined;
    let why = cacheOn.on ? "" : "reuse off";
    if (fp !== undefined && "hash" in fp) {
      const before = [...predecessorsOf(w, edges)].sort().flatMap((p) => byWriter.get(p) ?? []);
      key = writerKey(w, fp.hash, digestPaths(REPO_ROOT, before, [...(byWriter.get(w) ?? [])]));
      if (hasEntry(cacheDir, w, key) && restoreOutputs(cacheDir, w, key, REPO_ROOT, keep)) {
        reused.set(w, key);
        console.log(`  reused ${w} (inputs unchanged since ${key.slice(0, 12)}${fp.wholeTree ? ", keyed on the whole tree" : ""})`);
        if (skipOn) churn.push({ writer: w, did: "reused", why: ranWhy, cause, seconds: (performance.now() - t0) / 1000 });
        return { kind: "ran" };
      }
      why = `no result recorded for ${key.slice(0, 12)}`;
    } else if (fp !== undefined) {
      why = `inputs could not be determined: ${fp.undetermined}`;
    }
    const { outcome, log } = recordOn ? await runRecorded(w) : await runWriterAsync(["bun", "run", "cat", w], REPO_ROOT, jobs > 1, writerEnv);
    if (jobs > 1) process.stdout.write(`── ${w} ──\n${log}${log.endsWith("\n") || log === "" ? "" : "\n"}`);
    console.log(`  ran ${w} (${why}) [${secs()}]`);
    if (skipOn) churn.push({ writer: w, did: "ran", why: ranWhy, cause, seconds: (performance.now() - t0) / 1000 });
    // An index whose run could not be recorded still keeps its outputs, so a
    // preview can borrow them: borrowing needs main's bytes, not its reads.
    if (recordOn && outcome.kind === "ran" && isIndexWriter(w, declared) && !hasEntry(outDir, w, records.sha)) {
      commitStaged(outDir, w, records.sha, stageOutputs(outDir, w, records.sha, REPO_ROOT, byWriter.get(w) ?? [], keep));
      (records.kept ??= {})[w] = records.sha;
      console.log(`  kept ${w}'s outputs for previews to borrow (an index${records.unrecorded[w] ? `; not recorded: ${records.unrecorded[w]}` : ""})`);
    }
    if (outcome.kind === "ran" && key !== undefined) staged.set(w, { key, path: stageOutputs(cacheDir, w, key, REPO_ROOT, byWriter.get(w) ?? [], keep) });
    return outcome;
  };
  const outcomes = await schedule(writers, edges, jobs, runOne);
  if (recordOn) {
    // A file a writer rewrote is kept as its input only when no other writer
    // wrote it too: otherwise its state after the run says nothing about what
    // this writer read.
    for (const [w, paths] of rewrittenBy) {
      const other = paths.find((p) =>
        Object.entries(records.writers).some(([x, r]) => x !== w && p in r.outputs) ||
        [...rewrittenBy].some(([x, ps]) => x !== w && ps.includes(p)));
      if (other === undefined) continue;
      delete records.writers[w];
      records.unrecorded[w] = `the writer rewrites ${other}, which another writer also writes`;
    }
    saveWriterRecords(REPO_ROOT, records);
    const un = Object.entries(records.unrecorded);
    console.log(`  writer records: ${Object.keys(records.writers).length} recorded, ${un.length} not (${WRITER_RECORD_FILE})`);
    for (const [w, why] of un) console.log(`    not recorded: ${w} — ${why}`);
  }
  if (skipOn) writeChurn(prevRecords?.sha ?? "none", churn, (p) => writerOfPath(p, prevRecords, byWriter));
  for (const w of writers) {
    const o = outcomes.get(w)!;
    if (o.kind === "failed") {
      failed.set(w, o.exit);
      console.log(`::error::derive:publish: declared writer \`${w}\` exited ${o.exit ?? "on a signal"}`);
    }
    if (o.kind === "skipped") {
      skipped.set(w, o.why);
      console.log(`derive:publish: declared writer \`${w}\` skipped — it does not apply to this root: ${o.why}`);
    }
  }
  // Record only over a tree that held still (`derive-cache.ts`): the digest the
  // keys were computed over must be the digest now, fresh.
  if (staged.size > 0 && treeBefore !== undefined && "hash" in treeBefore) {
    const after = trackedTreeDigest(REPO_ROOT, new FileDigests(REPO_ROOT), { exclude: allOutputs });
    if ("hash" in after && after.hash === treeBefore.hash) {
      for (const [w, s] of staged) commitStaged(cacheDir, w, s.key, s.path);
      console.log(`  recorded ${staged.size} writer result(s) for reuse`);
    } else {
      rmSync(join(cacheDir, ".staging"), { recursive: true, force: true });
      console.log(`  recorded nothing: the tree outside the declared outputs moved during the run${"undetermined" in after ? ` (${after.undetermined})` : ""}`);
    }
  }
  const { excused: notHere, judged } = excused(declared, skipped);
  // An artefact of a failed writer is already named by its writer's failure.
  const empty = judged.filter((a) => !a.writer.some((w) => failed.has(w)) && !built(a));
  for (const a of empty) console.log(`::error::derive:publish: ${a.instance}/${a.path} is declared built at publish, and ${a.writer.join(", ")} built nothing there`);
  // Last, so the record's tail (layer-pr-checks.yml keeps the final 1500 characters) carries it.
  for (const [w, why] of skipped) {
    const of = notHere.filter((a) => a.writer.includes(w)).map((a) => `${a.instance}/${a.path}`);
    console.log(`  skipped ${w} (not applicable here: ${why}); not built: ${of.join(", ")}`);
  }
  if (failed.size > 0 || empty.length > 0) {
    const parts = [...failed].map(([w, x]) => `${w} exited ${x ?? "on a signal"}`);
    if (empty.length > 0) parts.push(`${empty.length} declared artefact(s) built empty`);
    console.log(`::error::derive:publish: ${parts.join("; ")}`);
    process.exit(1);
  }
  console.log(`  ✓ ${judged.length} declared artefact(s) built or reused${reused.size ? ` (${reused.size} writer(s) reused: ${[...reused.keys()].join(", ")})` : ""}${notHere.length ? `, ${notHere.length} skipped (their writer does not apply to this root)` : ""}`);
}

/** The writer that wrote `path`: by the previous build's records, else by declared outputs. */
export function writerOfPath(
  path: string,
  prev: { writers: Record<string, { outputs: Record<string, string> }> } | undefined,
  byWriter: ReadonlyMap<string, readonly string[]>,
): string | undefined {
  for (const [w, r] of Object.entries(prev?.writers ?? {})) if (path in r.outputs) return w;
  for (const [w, outs] of byWriter) if (underOutputs([...outs])(path)) return w;
  return undefined;
}

/** Write the churn report beside the records, and to the job summary when there is one. */
function writeChurn(against: string, entries: readonly ChurnEntry[], writerOf: (p: string) => string | undefined): void {
  const report = churnReport(entries, against, writerOf);
  const file = join(REPO_ROOT, WRITER_CHURN_FILE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
  const md = renderChurn(report);
  console.log(md);
  // input-site: inert #ab4c9ec1 — the job summary is where the report is shown, never an input of a writer
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, md);
}
