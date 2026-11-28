#!/usr/bin/env bun
/**
 * Render the `tools` graph — Tool nodes, how each is installed and invoked,
 * and which skill each one satisfies. Tools and skills get separate pages.
 *
 * @module cat-harness/scripts/gen-tools-viz
 * @covers tools
 *
 * ## A Tool against a skill
 *
 * A **skill** states a capability generically: what an actor needs to know to
 * perform a task. A **Tool** is one concrete way to exercise it — with an
 * installation, an invocation, and typed inputs and outputs. One skill may be
 * satisfied by several Tools, and a Tool may satisfy several skills. The
 * relation is `satisfies`, FROM a Tool TO a skill, and this page renders it
 * from the tool side.
 *
 * It imports the graph rather than parsing it: the nodes are TypeScript
 * calling `defineTool`, so a malformed one fails at `tsc`, and a second reader
 * could disagree with the server's.
 *
 * ## One page per layer
 *
 * It reads every declared `tools` graph through auto-discovery
 * (`tools/discover.ts`, the reader `check:tools` gates), and draws the full KG
 * at `<locale>/<harness>/tools/` and one sub-graph page per layer at
 * `<locale>/<harness>/tools/<instance>/`. The visualiser covers the KIND with
 * `subgraphs: "instance"`, and `viewersOf` covers a directory by kind only
 * where its sub-graph page exists — so a layer whose graph yields no Tool
 * gets no page and stays reported.
 *
 * ## Built at publish, not committed
 *
 * Every page is a function of the checkout: the Tools of every mounted
 * layer, the skills each `satisfies` resolves against, and whether that
 * skill's published page (a `skills:docs` output) is on disk. cat-harness
 * declares the route `builtAtPublish` with this script as its writer, and
 * `derive:publish` runs it; under `--check` a declared page has no committed
 * bytes to compare, so it is skipped (the `folio:viz` rule).
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-tools-viz.ts
 *   bun run cat-harness-tools/scripts/gen-tools-viz.ts --check
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { declarationPathIn, instanceDirectoryForGraph, kgQaHomeFor, readDeclaration, siteDirFor } from "../schemas/kg/cat-harness.js";
import { provenanceSectionFor } from "./provenance-footer.ts";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.js";
import { layerRootsIn } from "../schemas/kg/instance-roots.js";
import { tileCounts } from "../schemas/ui/tile-count.js";
import { KG_QA_DIRNAME, kgQaSidecarPath } from "../schemas/sdlc/kg-qa.js";
import { visualiserRoute } from "../schemas/kg/visualiser-route.js";
import { detectRepoUrl } from "../src/core/git-refs.js";
import { discoverTools, toolsOf } from "../tools/discover.ts";
import { baseDocsDir } from "./compose-docs.js";
import { kgRoots } from "./known-skills.js";
import { skillPageHref, skillPagesOf } from "./lib/skill-pages.ts";
import { qaResultHref, siteLinkKey } from "./qa-result-link.ts";
import { qaStorageOf } from "./qa-results.ts";
import { pageParts, renderedByOf, tileCountsForPages, visualiserSitePath, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { dirname } from "node:path";
import { localSiteDir } from "./lib/local-site-dir.ts";
import { siteTarget } from "./lib/site-target.ts";
import { inScope, scopeArg, siteScope } from "./lib/site-scope.ts";
import { deriveAlternatives, type ToolDefinition } from "../schemas/tools/tool.js";
import { toolIri } from "../schemas/tools/tool-folders.js";
import { termIri } from "../schemas/kg/namespaces.js";
import { publishedIdentity } from "./kg-export.ts";
import { pageRelPath as processesPageRelPath, processRows, stepAnchor, type ProcessRow } from "./gen-processes-viz.ts";
import {
  forgeHrefFor,
  mcpServersOf,
  pageHref,
  relativeImports,
  resolveScriptKey,
  scriptPaths,
  skillDocuments,
  skillIoContracts,
  toolPage,
  workflowNeedles,
  workflowUses,
  type ProcessUse,
  type SkillInfo,
  type ToolPageData,
} from "./tool-page.ts";
import { apiReferencePage, mcpToolList, openApiFor, resolveModule, type McpToolEntry } from "./tool-api.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "tools-viewer";
/**
 * Every page this writes declares itself generated in its own front matter —
 * the `generated:` key `check:reference-direction` reads (bean `ws99`), as
 * `gen-processes-viz.ts` does. A page lists the Tool nodes and the layers that declare them, which belong to every
 * layer in the checkout, so without the key those names read as authored
 * prose in the committing layer naming the layers above it.
 */
const GENERATED_FM = "generated: gen-tools-viz.ts — do not hand-edit; run `bun run cat tools:viz`";

const REPO = resolve(dirname(HARNESS_ROOT));
/** The graph typology this renders. A KIND, never a path. */
const KIND = "tools";

/** One Tool, reduced to what the page shows. */
export interface ToolRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** How it is installed — the declared keys, e.g. `none`, `cli`. */
  readonly install: string[];
  /** How it is invoked — `shell`, `mcp`, `inProcess`, `manual`. */
  readonly invoke: string[];
  /** Skills this tool is one way to exercise. */
  readonly satisfies: string[];
  readonly inputs: number;
  readonly outputs: number;
  /** Where this Tool's latest `kg-qa` verdict lives on `qa-reports` (`qa-result-link.ts`, bean `tdir`). */
  readonly qaHref?: string;
  /** The verdict read from the `kg-qa` sidecar when on disk (`pass`, `fail`, `warn`, `unknown`), or `undefined` when not on disk. */
  readonly qaVerdict?: string;
  /** The Tool's provenance log, rendered (`provenance-footer.ts`), when it has one with entries. */
  readonly provenance?: string;
  /** Whether a GitHub workflow in the checkout runs its command — the `action` surface of the filter. */
  readonly action?: boolean;
}

/** A `satisfies` entry, however it was written. */
function skillId(s: unknown): string {
  if (typeof s === "string") return s;
  const o = s as { skill?: string; ref?: string } | null;
  return o?.skill ?? o?.ref ?? String(s);
}

/**
 * The forge URL for `repo`: detected from `origin`, else the harness's declared
 * repository (`gen-library-viz`'s fallback for git-less checkouts).
 */
function repoWebFor(repo: string, inst = join(repo, "cat-harness")): string | undefined {
  const detected = detectRepoUrl(repo);
  if (detected) return detected;
  try {
    const d = (existsSync(inst) ? readDeclaration(inst) : undefined) as
      | { livesAt?: { repository?: string }; repository?: string }
      | undefined;
    const slug = d?.livesAt?.repository ?? d?.repository;
    return slug ? `https://github.com/${slug}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read a `kg-qa/v1` sidecar's verdict when the file is on disk (`pass`, `fail`,
 * `warn`, `unknown`, `n/a`), or `undefined` when it is absent or unreadable.
 *
 * `undefined` is a third state: when `qa-reports` has not been fetched into the
 * local tree, the page still links the Tool's verdict on `qa-reports` via
 * `qa-result-link.ts` rather than fabricating a pass or hiding the link.
 */
function readSidecarVerdict(sidecarPath: string): string | undefined {
  if (!existsSync(sidecarPath)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(sidecarPath, "utf-8")) as {
      overall_verdict?: unknown;
      totals?: { pass?: number; fail?: number; warn?: number; unknown?: number; "n/a"?: number };
      criteria?: Record<string, { result?: string }>;
    };
    if (typeof raw.overall_verdict === "string" && raw.overall_verdict.length > 0) {
      return raw.overall_verdict;
    }
    const t = raw.totals ?? {};
    let fail = t.fail ?? 0;
    let warn = t.warn ?? 0;
    let unknown = t.unknown ?? 0;
    let pass = t.pass ?? 0;
    if (raw.totals === undefined && raw.criteria) {
      for (const c of Object.values(raw.criteria)) {
        if (c.result === "fail") fail++;
        else if (c.result === "warn") warn++;
        else if (c.result === "unknown") unknown++;
        else if (c.result === "pass") pass++;
      }
    }
    if (fail > 0) return "fail";
    if (warn > 0) return "warn";
    if (unknown > 0) return "unknown";
    if (pass > 0) return "pass";
    return "n/a";
  } catch {
    return undefined;
  }
}

/**
 * Resolve each Tool's `kg-qa` sidecar address (`qaResultLinkFor`) and on-disk
 * verdict (`readSidecarVerdict`), keyed by Tool `id`.
 */
function toolQaResolver(
  repo: string,
  opts: { instanceRoot?: string; key?: string } = {},
): (toolId: string) => { qaHref?: string; qaVerdict?: string } {
  const harnessRoot = join(repo, "cat-harness");
  const key = opts.key ?? siteLinkKey();
  const rawPairs: { inst: string; toolsDir: string }[] = [];
  if (opts.instanceRoot !== undefined) {
    try {
      const td = instanceDirectoryForGraph(opts.instanceRoot, KIND);
      if (td) rawPairs.push({ inst: resolve(opts.instanceRoot), toolsDir: td });
    } catch {
      // Unreadable declaration; no QA resolution.
    }
  } else {
    let roots: readonly string[] = [];
    try {
      roots = layerRootsIn(repo);
    } catch {
      roots = [];
    }
    for (const r of roots) {
      try {
        const td = instanceDirectoryForGraph(r, KIND);
        if (td) rawPairs.push({ inst: resolve(r), toolsDir: td });
      } catch {
        // Skip unreadable sibling.
      }
    }
  }
  const pairs: { inst: string; toolsDir: string; qaTree: string; storedOn: string | undefined }[] = [];
  for (const p of rawPairs) {
    try {
      const qaHome = kgQaHomeFor(
        p.inst,
        existsSync(harnessRoot) && p.inst !== resolve(harnessRoot) ? harnessRoot : undefined,
      );
      const qaTree = join(qaHome.root, KG_QA_DIRNAME);
      let storedOn: string | undefined;
      try {
        storedOn = qaStorageOf(qaTree, repo);
      } catch {
        storedOn = undefined;
      }
      pairs.push({ ...p, qaTree, storedOn });
    } catch {
      // Skip layer whose QA home cannot be resolved.
    }
  }
  const repoWeb = repoWebFor(repo, existsSync(harnessRoot) ? harnessRoot : pairs[0]?.inst);
  return (toolId: string) => {
    if (!toolId || pairs.length === 0) return {};
    const owner =
      pairs.find((p) => existsSync(join(p.toolsDir, toolId))) ??
      pairs.find((p) => p.inst === resolve(harnessRoot)) ??
      pairs[0]!;
    try {
      const sidecar = kgQaSidecarPath(owner.inst, owner.toolsDir, toolId, owner.qaTree);
      const repoPath = relative(repo, resolve(sidecar)).split(sep).join("/");
      const link = qaResultHref({ repoWeb, repoPath, storedOn: owner.storedOn, key });
      const qaVerdict = readSidecarVerdict(sidecar);
      return {
        ...(link.href !== undefined ? { qaHref: link.href } : {}),
        ...(qaVerdict !== undefined ? { qaVerdict } : {}),
      };
    } catch {
      return {};
    }
  };
}

/**
 * Where a Tool's provenance log is, and its rendering: `<tools dir>/<id>/<id>.prov.jsonld`
 * in the layer named, or in any layer of the checkout. The owner chose
 * the provenance footer on 2026-11-05 ("2B"); a Tool has no page of its own,
 * so its log is shown on the tools page, under the tool's id.
 */
function toolProvenanceResolver(repo: string, opts: { instanceRoot?: string } = {}): (toolId: string) => string | undefined {
  let roots: readonly string[] = [];
  try {
    roots = opts.instanceRoot !== undefined ? [opts.instanceRoot] : layerRootsIn(repo);
  } catch {
    roots = [];
  }
  const dirs: string[] = [];
  for (const r of roots) {
    try {
      const td = instanceDirectoryForGraph(r, KIND);
      if (td) dirs.push(resolve(r, td));
    } catch {
      // An unreadable declaration: no log is found there.
    }
  }
  return (toolId) => {
    for (const d of dirs) {
      const html = provenanceSectionFor(join(d, toolId, `${toolId}.json`), {
        liquid: false,
        item: true,
        summary: `\`${toolId}\``,
        id: `provenance-${toolId}`,
      });
      if (html !== "") return html;
    }
    return undefined;
  };
}

/**
 * The Tool nodes, reduced.
 *
 * Exported so the reduction is testable without the markdown: the `satisfies`
 * join is the part worth pinning, and a test that went through the rendered
 * table would be testing the table.
 */
export function toolRows(
  defs: readonly unknown[],
  repo = REPO,
  opts: { instanceRoot?: string; key?: string } = {},
): ToolRow[] {
  const qaFor = toolQaResolver(repo, opts);
  const provenanceFor = toolProvenanceResolver(repo, opts);
  return defs
    .map((d) => {
      const t = d as Record<string, unknown>;
      const io = (t.io ?? {}) as { inputs?: unknown[]; outputs?: unknown[] };
      const id = String(t.id ?? "");
      return {
        id,
        title: String(t.title ?? t.id ?? ""),
        description: String(t.description ?? ""),
        install: Object.keys((t.install ?? {}) as object).sort(),
        invoke: Object.keys((t.invoke ?? {}) as object).sort(),
        satisfies: ((t.satisfies ?? []) as unknown[]).map(skillId).sort(),
        inputs: io.inputs?.length ?? 0,
        outputs: io.outputs?.length ?? 0,
        ...qaFor(id),
        ...(() => {
          const provenance = provenanceFor(id);
          return provenance === undefined ? {} : { provenance };
        })(),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, "en"));
}

/** Every skill document in the checkout, by id, so a `satisfies` can be resolved. */
export function skillIds(repo = REPO): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string, depth = 0): void => {
    if (depth > 5) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name.endsWith(".md")) out.add(e.name.replace(/\.md$/, ""));
    }
  };
  // Every directory declaring a `kg` or `skills` graph, read from the
  // declarations — a hardcoded list here is the `check:declared-assets` shape,
  // and it would go stale the first time a layer is added.
  for (const declPath of instanceDeclarations(repo)) {
    const d = JSON.parse(readFileSync(declPath, "utf-8")) as {
      directories?: { path?: string; scope?: string; graphTypologies?: string[] }[];
    };
    const instanceRoot = join(declPath, "..");
    for (const entry of d.directories ?? []) {
      if (!entry.path) continue;
      const kinds = entry.graphTypologies ?? [];
      if (!kinds.includes("skills") && !kinds.includes("kg") && !kinds.includes("methodology")) continue;
      walk(join(entry.scope === "repository" ? repo : instanceRoot, entry.path));
    }
  }
  // And every skills root the checkout RESOLVES, which includes a directory a
  // layer holds by inheritance and does not restate (option A, bean
  // `1g4s`): sci's `skills/` is a member of the harness's `skills` graph, and
  // since placement PR1 (bean `ybwt`) it holds the paper skills harness tools
  // satisfy. Reading declarations alone missed it.
  const platform = join(repo, "cat-harness");
  if (existsSync(platform)) for (const d of kgRoots(platform)) walk(d);
  return out;
}

/**
 * Every LAYER declaration in the checkout.
 *
 * `declarationPathIn`, never a "does it have `directories`?" heuristic. That
 * heuristic sweeps in `beans/beans.json` and `todos/todos.json`, whose stem is
 * not their declared `name` — and it produced a wrong corpus for two separate
 * sessions on 2026-09-21 (`w4tq`, and this session's own `yunp` re-measure).
 * It is attractive because it is one line and NEARLY right, so it returns a
 * plausible answer rather than an error.
 */
function instanceDeclarations(repo: string): string[] {
  const out: string[] = [];
  const at = declarationPathIn(repo);
  if (at && existsSync(at)) out.push(at);
  for (const e of readdirSync(repo, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = declarationPathIn(join(repo, e.name));
    if (p && existsSync(p)) out.push(p);
  }
  return out;
}

/**
 * Where the page goes: the declared directory's own name (#1168 B7a-2b,
 * `conventionalPage`). Never a literal — `site-dir-single-answer` refuses one.
 */
export function pageRelPath(repo = REPO, subgraph?: string): string | undefined {
  // The route cat-harness DECLARES for this Tool's visualiser (owner,
  // 2026-10-09): `<locale>/<harness>/<id>/index.md`, never chosen here. A
  // sub-graph page is `<locale>/<harness>/<id>/<instance>/index.md`.
  try {
    const { rel, visualiser: v } = visualiserSitePath(join(repo, "cat-harness"), VIEWER_TOOL);
    if (subgraph === undefined) return rel;
    return visualiserRoute({ ...pageParts({ harness: v.harness, visualiser: v.id }), subgraph, asset: "index.md" });
  } catch {
    return undefined;
  }
}

/** One layer's slice of the tools graph: its declared name and its Tool rows. */
export interface ToolSubject {
  readonly name: string;
  readonly rows: ToolRow[];
  /** The layer root, and its Tool nodes as loaded: what each Tool's own page is drawn from. */
  readonly root?: string;
  readonly defs?: readonly ToolDefinition[];
}

/**
 * Every layer that declares a `tools` graph, with the Tools it yields, in
 * the order `layerRootsIn` lists them. `empty` names the ones whose graph
 * yields no Tool: they get no page, and are reported rather than drawn.
 *
 * Read through auto-discovery (`toolsOf`), which THROWS on a declared graph
 * that does not load — a partial list would draw a layer as having fewer
 * Tools than it declares.
 */
export function toolSubjects(repo = REPO): { subjects: ToolSubject[]; empty: string[] } {
  const subjects: ToolSubject[] = [];
  const empty: string[] = [];
  for (const inst of layerRootsIn(repo)) {
    if (instanceDirectoryForGraph(inst, "tools") === undefined) continue;
    const p = declarationPathIn(inst);
    const name = p && existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")) as { name?: string }).name : undefined;
    if (!name) continue;
    const defs = toolsOf(inst);
    const rows = toolRows(defs, repo, { instanceRoot: inst });
    if (rows.length === 0) empty.push(name);
    else subjects.push({ name, rows, root: inst, defs });
  }
  return { subjects, empty };
}

/** How {@link page} titles and introduces the slice it draws. */
export interface PageScope {
  /** `undefined` for the full KG; else the layer whose Tools the page shows. */
  readonly instance?: string;
  /** The per-instance pages, for the full view's index of them. */
  readonly subjects?: readonly { name: string; count: number; href: string }[];
  /** The full view, relative to a sub-graph page. */
  readonly upHref?: string;
  /** A Tool's own page, relative to this one; absent, the id links to its row. */
  readonly toolHref?: (id: string) => string | undefined;
  /**
   * A Tool's IRI, its published JSON-LD document (`toolIri`, as kg-export
   * mints it), linked from its row beside its page (owner, 2026-11-13,
   * node-kind audit: "link existing IRIs").
   */
  readonly toolIri?: (id: string) => string | undefined;
  /** The API documents for the Tools this page shows, relative to it. */
  readonly api?: { openapi: string; mcp: string; reference: string };
}

/** The base docs layer — the same answer `compose-docs.ts` uses. */

const CSS = `
.tg-tag{display:inline-block;padding:.05rem .4rem;border-radius:3px;font-size:.72rem;
  font-weight:600;white-space:nowrap;border:1px solid currentColor;margin-right:.2rem}
/* Bean rtuo: these inks were chosen for a LIGHT page and measured 2.33-2.54:1
   on this site's default dark one (#27262b), under the 4.5:1 text floor. The
   dark inks are the default; the site's light scheme keeps the originals,
   which clear 5.9:1 on white. Every ratio computed, not eyeballed. */
.tg-shell{color:#5cd3bd}   /* 8.23:1 on #27262b */
.tg-mcp{color:#b9a8ec}     /* 7.06:1 */
.tg-inproc{color:#86b8f2}  /* 7.26:1 */
.tg-manual{color:#f5a070}  /* 7.25:1 */
.tg-action{color:#e6c07b}
:root[data-fa-scheme="light"] .tg-action{color:#7a5a00}
.tg-filter{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin:.5rem 0}
.tg-filter button{font:inherit;font-size:.8rem;padding:.15rem .6rem;border-radius:3px;border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;cursor:pointer}
.tg-filter button[aria-pressed="true"]{border-color:currentColor;font-weight:600}
:root[data-fa-scheme="light"] .tg-shell{color:#0d6e5e}
:root[data-fa-scheme="light"] .tg-mcp{color:#6b5b95}
:root[data-fa-scheme="light"] .tg-inproc{color:#1d5fa8}
:root[data-fa-scheme="light"] .tg-manual{color:#a8430f}
.tg-grid{display:flex;flex-wrap:wrap;gap:.75rem;margin:1rem 0}
.tg-stat{flex:1 1 8rem;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:.5rem .7rem;text-decoration:none;color:inherit;display:block}
.tg-stat:hover,.tg-stat:focus{border-color:currentColor;text-decoration:none}
.tg-stat b{display:block;font-size:1.25rem;line-height:1.2}
.tg-stat span{font-size:.75rem;opacity:.75}
.table-wrapper{position:relative}
.table-wrapper table{min-width:36rem}
@media (max-width: 799.98px) {
  @supports (animation-timeline: scroll()) {
    .table-wrapper {
      mask-image: linear-gradient(to right,
        transparent 0, #000 var(--fa-cue-l, 0px),
        #000 calc(100% - var(--fa-cue-r, 2.5rem)), transparent 100%);
      animation: fa-scroll-cue linear both;
      animation-timeline: scroll(self inline);
    }
  }
  @supports not (animation-timeline: scroll()) {
    .table-wrapper {
      mask-image: linear-gradient(to right, #000 calc(100% - 2.5rem), transparent 100%);
    }
  }
}
@property --fa-cue-l { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --fa-cue-r { syntax: "<length>"; inherits: false; initial-value: 0px; }
@keyframes fa-scroll-cue {
  0%   { --fa-cue-l: 0px;    --fa-cue-r: 2.5rem; }
  12%  { --fa-cue-l: 2.5rem; }
  88%  { --fa-cue-r: 2.5rem; }
  100% { --fa-cue-l: 2.5rem; --fa-cue-r: 0px; }
}
`;

const INVOKE_CLASS: Record<string, string> = {
  action: "tg-action",
  container: "tg-shell",
  shell: "tg-shell",
  mcp: "tg-mcp",
  inProcess: "tg-inproc",
  manual: "tg-manual",
};

function badge(kind: string): string {
  return `<span class="tg-tag ${INVOKE_CLASS[kind] ?? ""}" data-surface="${kind}">${SURFACE_LABEL[kind] ?? kind}</span>`;
}

/** How a surface reads to someone choosing one: `shell` is the command line, `action` a GitHub workflow. */
const SURFACE_LABEL: Record<string, string> = { shell: "cli", action: "github action" };

/**
 * The surface filter over the "Every tool" table (owner, 2026-11-12: the MCP
 * services view "could just be a filter on the tools", and so could GitHub
 * Actions "and other things like this"). Each row's invocation cell carries one
 * badge per surface, `data-surface`; with JS off every row shows.
 */
const FILTER_SCRIPT = `
(function(){
  var bar=document.getElementById('tg-filter'); if(!bar) return;
  var t=bar.nextElementSibling; while(t && !t.querySelector('table')) t=t.nextElementSibling; if(!t) return;
  var rows=t.querySelectorAll('tbody tr'), out=document.getElementById('tg-shown');
  bar.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return;
    bar.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});
    var s=b.getAttribute('data-surface'), n=0;
    rows.forEach(function(r){ var ok=!s || !!r.querySelector('[data-surface="'+s+'"]'); r.hidden=!ok; if(ok) n++; });
    if(out) out.textContent=String(n); });
})();
`;

/** Escape a cell so a pipe in a description cannot break the table. */
function cell(v: string): string {
  return v.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ");
}

/**
 * `skillPages` is the set of skills with a published instruction page
 * (`lib/skill-pages.ts`): a `satisfies` naming one is a link, anything else
 * stays code — bean `qgjh`. `fromPage` is where this page is published, as
 * {@link pageRelPath} reads it from the declaration, so the link is relative
 * to it rather than assumed. With no `skillPages` nothing is linked, so its
 * default does not matter.
 */
export function page(
  rows: readonly ToolRow[],
  known: ReadonlySet<string>,
  skillPages: ReadonlySet<string> = new Set(),
  fromPage = "",
  scope: PageScope = {},
): string {
  const invoke = new Map<string, number>();
  const install = new Map<string, number>();
  for (const r of rows) {
    for (const k of r.invoke) invoke.set(k, (invoke.get(k) ?? 0) + 1);
    for (const k of r.install) install.set(k, (install.get(k) ?? 0) + 1);
  }
  const allSkills = new Set(rows.flatMap((r) => r.satisfies));
  const unresolved = [...allSkills].filter((s) => !known.has(s)).sort();
  const noSatisfies = rows.filter((r) => r.satisfies.length === 0);

  const title = scope.instance === undefined ? "Tools" : `Tools — ${scope.instance}`;
  const whose =
    scope.instance === undefined
      ? scope.subjects !== undefined
        ? "every instance in this checkout declares"
        : "this instance declares"
      : `${scope.instance} declares`;
  const b: string[] = [
    "---",
    `title: "${title}"`,
    `description: "The Tool nodes ${whose} — how each is installed and invoked, and which skill it satisfies."`,
    GENERATED_FM,
    // The page is the Tools' own words, and a Tool may describe a Liquid
    // step in them: an IG layer's build-ig-site named its include tags and
    // site-data references, and Jekyll failed smart-ra's whole build on the
    // page (2026-10-15). Nothing here is Liquid, so none is rendered.
    "render_with_liquid: false",
    "---",
    `<style>${CSS}</style>`,
    "",
    ...(scope.instance !== undefined
      ? [
          `The Tool nodes **${scope.instance}** declares in its \`tools\` graph${scope.upHref ? ` — one instance's slice of [every instance's tools](${scope.upHref})` : ""}.`,
          "",
        ]
      : []),
    ...(scope.api
      ? [
          `**As an API:** [OpenAPI document](${scope.api.openapi}) · [MCP tool list](${scope.api.mcp}) · [API reference](${scope.api.reference}).`,
          "",
        ]
      : []),
    "A **skill** states a capability generically: what an actor needs to know to",
    "perform a task. A **Tool** is one concrete way to exercise it, with an",
    "installation, an invocation and typed inputs and outputs. One skill may be",
    "satisfied by several tools, and one tool may satisfy several skills.",
    "",
    "They are separate graphs and this is the tools one. The relation between them",
    "is `satisfies`, and it runs **from a tool to a skill** — *this tool is one way",
    "to do that*, never *this skill is a tool*.",
    "",
    "<div class=\"tg-grid\">",
    `<a class="tg-stat" href="#every-tool"><b>${rows.length}</b><span>Tool nodes</span></a>`,
    `<a class="tg-stat" href="#does-every-satisfies-name-a-skill-that-exists"><b>${allSkills.size}</b><span>skills satisfied</span></a>`,
    `<a class="tg-stat" href="#how-they-are-invoked-and-installed"><b>${invoke.get("shell") ?? 0}</b><span>invoked as a shell command</span></a>`,
    `<a class="tg-stat" href="#how-they-are-invoked-and-installed"><b>${invoke.get("mcp") ?? 0}</b><span>reachable over MCP</span></a>`,
    "</div>",
    "",
    ...(scope.subjects !== undefined && scope.subjects.length > 0
      ? [
          "## By instance",
          "",
          "Each instance that declares a `tools` graph has its own page.",
          "",
          "| instance | tools |",
          "|---|---|",
          ...scope.subjects.map((x) => `| [${cell(x.name)}](${x.href}) | ${x.count} |`),
          "",
        ]
      : []),
    "## How they are invoked, and installed",
    "",
    "A tool may declare more than one invocation, so these do not sum to the total.",
    "",
    "| invocation | tools |",
    "|---|---|",
    ...[...invoke.entries()]
      .sort((a, b2) => b2[1] - a[1])
      .map(([k, n]) => `| ${badge(k)} | ${n} |`),
    "",
    "| installation | tools |",
    "|---|---|",
    ...[...install.entries()]
      .sort((a, b2) => b2[1] - a[1])
      .map(([k, n]) => `| \`${k}\` | ${n} |`),
    "",
    "## Does every `satisfies` name a skill that exists?",
    "",
  ];

  // The join, reported either way. "Nothing unresolved" and "the check did not
  // run" are different facts, and a section that appeared only on failure
  // could not tell them apart.
  if (unresolved.length === 0) {
    b.push(
      `Yes — all **${allSkills.size}** skills named across **${rows.length}** tools resolve to a`,
      "skill document in this checkout. A `satisfies` pointing at nothing would be a",
      "tool advertising a capability the graph cannot locate.",
      "",
    );
  } else {
    b.push(
      `**${unresolved.length} of ${allSkills.size} do not.** A \`satisfies\` naming a skill that is`,
      "not in this checkout is a dangling reference — the tool advertises a capability",
      "the graph cannot locate.",
      "",
      "| unresolved skill | named by |",
      "|---|---|",
      ...unresolved.map((s) => {
        const by = rows.filter((r) => r.satisfies.includes(s)).map((r) => `\`${r.id}\``);
        return `| \`${cell(s)}\` | ${by.join(", ")} |`;
      }),
      "",
    );
  }

  if (noSatisfies.length > 0) {
    b.push(
      `**${noSatisfies.length} tool(s) satisfy no skill at all**, which is a different gap: the`,
      "tool exists and nothing says what capability it is a way of exercising.",
      "",
      ...noSatisfies.map((r) => `- \`${cell(r.id)}\` — ${cell(r.title)}`),
      "",
    );
  }

  const surfaces = [...new Set(rows.flatMap((r) => [...r.invoke, ...(r.action ? ["action"] : [])]))].sort();
  b.push(
    "## Every tool",
    "",
    `<div class="tg-filter" id="tg-filter" role="group" aria-label="Filter by how a tool is reached"><span>Reached as:</span><button type="button" aria-pressed="true" data-surface="">all</button>${surfaces
      .map((s) => `<button type="button" aria-pressed="false" data-surface="${s}">${SURFACE_LABEL[s] ?? s} (${rows.filter((r) => (s === "action" ? r.action : r.invoke.includes(s))).length})</button>`)
      .join("")}<span><span id="tg-shown">${rows.length}</span> of ${rows.length} shown</span></div>`,
    "",
    "| tool | what it does | invoked | satisfies | i/o | qa |",
    "|---|---|---|---|---|---|",
  );
  for (const r of rows) {
    const sat = r.satisfies.length
      ? r.satisfies
          .map((s) => {
            const href = skillPageHref(s, fromPage, skillPages);
            return href === undefined ? `\`${cell(s)}\`` : `[\`${cell(s)}\`](${href})`;
          })
          .join("<br>")
      : "**—**";
    const qa = r.qaHref
      ? `[\`${cell(r.qaVerdict ?? "qa-reports")}\`](${r.qaHref})`
      : r.qaVerdict
        ? `\`${cell(r.qaVerdict)}\``
        : "**—**";
    const own = scope.toolHref?.(r.id);
    const iri = scope.toolIri?.(r.id);
    b.push(
      `| <a id="${cell(r.id)}"></a>[\`${cell(r.id)}\`](${own ?? `#${cell(r.id)}`})${iri ? ` · [JSON-LD](${iri})` : ""}<br>${cell(r.title)} | ${cell(r.description)} | ` +
        `${[...r.invoke, ...(r.action ? ["action"] : [])].map(badge).join(" ")} | ${sat} | ${r.inputs} in / ${r.outputs} out | ${qa} |`,
    );
  }
  b.push("", `<script>${FILTER_SCRIPT}</script>`, "");

  // THE PROVENANCE OF EACH TOOL (owner, 2026-11-05, "2B"): shown here,
  // collapsed, under its id, only where a Tool has no page of its own. Since
  // 2026-11-12 each Tool has one (`toolPages`), and its log is on it.
  const withLog = scope.toolHref === undefined ? rows.filter((r) => r.provenance !== undefined) : [];
  if (withLog.length > 0) {
    b.push(
      "## Provenance",
      "",
      `Who decided, when, and under which work item, for the ${withLog.length} tool(s) whose provenance log has entries. Open a tool to read its record.`,
      "",
    );
    // One collapsed row per tool, named by its id: a heading each made a page
    // of 35 headings with a box under every one.
    b.push(`<div class="fa-provenance-items">`, ...withLog.map((r) => r.provenance!.trimEnd()), `</div>`, "");
  }
  return b.join("\n").trimEnd() + "\n";
}

/** The page as committed: {@link page} plus the directories it draws (#1168 B7a-2). */
export function publishedPage(
  rows: Parameters<typeof page>[0],
  known: Parameters<typeof page>[1],
  repo = REPO,
  scope: PageScope = {},
): string {
  // With no declared page there is no base to link from: render codes, never
  // guess a location.
  const rel = pageRelPath(repo, scope.instance);
  const skillPages = rel === undefined ? new Set<string>() : skillPagesOf(repo);
  return withRenderedByFrontMatter(
    page(rows, known, skillPages, rel ?? "", scope),
    VIEWER_TOOL,
  );
}

/** Where a Tool's own page goes: one directory under its layer's sub-graph page. */
export function toolPageRelPath(repo: string, instance: string, id: string): string | undefined {
  const sub = pageRelPath(repo, instance);
  return sub === undefined ? undefined : posixJoin(dirname(sub), encodeURIComponent(id), "index.md");
}

const posixJoin = (...p: string[]): string => p.join("/").split(sep).join("/").replace(/\/+/g, "/");

/**
 * Every Tool's page, keyed by its site-relative path, with each row's
 * `action` surface found on the way (the workflows that run its command).
 *
 * Owner, 2026-11-12: a page per Tool, with its IRI and viewer, its skills and
 * their I/O contracts, the processes and tasks it serves, how it is deployed
 * and reached (MCP, CLI, GitHub Action), and what it is made of.
 */
export async function toolPages(
  subjects: readonly ToolSubject[],
  repo = REPO,
): Promise<{
  pages: Map<string, string>;
  actions: Set<string>;
  hrefOf: (fromPage: string, id: string) => string | undefined;
  /** Each layer's API documents, site-relative, for its page to link. */
  apiOf: (instance: string) => { openapi: string; mcp: string; reference: string } | undefined;
  /** Each Tool's IRI, its published JSON-LD document, where its layer publishes one. */
  iriOf: (id: string) => string | undefined;
}> {
  const roots = layerRootsIn(repo);
  const forge = forgeHrefFor(repo, repoWebFor(repo));
  const all = subjects.flatMap((x) => (x.defs ?? []).map((d) => ({ d, x })));
  const pageOf = new Map(all.map(({ d, x }) => [d.id, toolPageRelPath(repo, x.name, d.id)]));
  const hrefOf = (fromPage: string, id: string): string | undefined => {
    const to = pageOf.get(id);
    return to === undefined ? undefined : pageHref(fromPage, to);
  };

  // The skills: every document the checkout holds, and their I/O contracts.
  const platform = join(repo, "cat-harness");
  const skillDirs = existsSync(platform) ? kgRoots(platform) : [];
  const docs = skillDocuments([...skillDirs, ...roots], repo);
  const skillPages = skillPagesOf(repo);
  const bySkill = new Map<string, string[]>();
  for (const { d } of all) for (const s of d.satisfies.map(skillId)) bySkill.set(s, [...(bySkill.get(s) ?? []), d.id]);
  const alternatives = deriveAlternatives(all.map(({ d }) => d));

  // The processes, read once by the processes viewer's own reader.
  let rows: ProcessRow[] = [];
  let processesRead = true;
  try {
    rows = await processRows(repo);
  } catch {
    processesRead = false;
  }
  const procPage = (() => {
    try {
      return processesPageRelPath(repo);
    } catch {
      return undefined;
    }
  })();
  const mcpServers = mcpServersOf(repo);
  const typeIri = termIri("Tool");

  // EACH LAYER'S DOCUMENT IRI, and so each Tool's (`toolIri`, as kg-export mints it).
  const docIriOf = new Map<string, string | undefined>();
  for (const x of subjects) {
    try {
      docIriOf.set(x.name, x.root ? publishedIdentity(x.root).docIri : undefined);
    } catch {
      docIriOf.set(x.name, undefined);
    }
  }
  const iriOf = new Map(all.map(({ d, x }) => [d.id, docIriOf.get(x.name) ? toolIri(docIriOf.get(x.name)!, d.id) : undefined]));

  // THE MCP TOOL LIST, read from the registrars (`tool-api.ts`).
  const mcp = await mcpToolList(
    all.filter(({ x }) => x.root).map(({ d, x }) => ({ def: d, root: x.root!, ...(iriOf.get(d.id) ? { iri: iriOf.get(d.id)! } : {}) })),
    roots,
  );
  for (const pr of mcp.problems) console.error(`  · mcp tool list: ${pr}`);
  const mcpOf = (id: string): McpToolEntry[] => mcp.tools.filter((m) => m._meta.tool === id);

  const pages = new Map<string, string>();
  const actions = new Set<string>();

  // THE API DOCUMENTS, per layer and for every layer together (owner, 2026-11-12).
  const contracts = (s: string) => skillIoContracts(s, roots, repo).map((c) => ({ io: c.io, schema: c.schema }));
  const apiFiles = new Map<string, { openapi: string; mcp: string; reference: string }>();
  const writeApi = (dir: string, title: string, version: string, defs: readonly ToolDefinition[], upHref: string, key?: string) => {
    const files = { openapi: posixJoin(dir, "openapi.json"), mcp: posixJoin(dir, "mcp-tools.json"), reference: posixJoin(dir, "api", "index.md") };
    const doc = openApiFor(defs, {
      title,
      version,
      toolIri: (id) => iriOf.get(id),
      toolPage: (id) => hrefOf(files.openapi, id),
      skillContracts: contracts,
      mcpNames: (id) => mcpOf(id).map((m) => m.name),
    });
    const ids = new Set(defs.map((d) => d.id));
    const list = mcp.tools.filter((m) => ids.has(m._meta.tool));
    pages.set(files.openapi, JSON.stringify(doc, null, 2) + "\n");
    pages.set(files.mcp, JSON.stringify({ tools: list }, null, 2) + "\n");
    pages.set(
      files.reference,
      withRenderedByFrontMatter(
        apiReferencePage({
          title: title.replace(/^Tools — /, ""),
          generatedFm: GENERATED_FM,
          openapi: doc,
          mcp: list,
          openapiHref: "../openapi.json",
          mcpHref: "../mcp-tools.json",
          toolHref: (id) => hrefOf(files.reference, id),
          upHref,
        }),
        VIEWER_TOOL,
      ),
    );
    if (key !== undefined) apiFiles.set(key, files);
  };
  const versionOf = (root: string | undefined): string => {
    try {
      return String((root && readDeclaration(root)?.version) ?? "0.0.0");
    } catch {
      return "0.0.0";
    }
  };
  const indexPage = pageRelPath(repo);
  if (indexPage !== undefined) {
    writeApi(dirname(indexPage), "Tools — every layer", versionOf(join(repo, "cat-harness")), all.map(({ d }) => d), "../", "");
  }
  for (const x of subjects) {
    const sub = pageRelPath(repo, x.name);
    if (sub === undefined || !x.defs) continue;
    if (x.defs.some((d) => d.id === "api")) {
      console.error(`  · ${x.name}: a Tool named \`api\` would collide with the API reference page; it is not drawn`);
      continue;
    }
    writeApi(dirname(sub), `Tools — ${x.name}`, versionOf(x.root), x.defs, "../", x.name);
  }

  for (const x of subjects) {
    const root = x.root;
    if (!root || !x.defs) continue;
    const docIri = docIriOf.get(x.name);
    const toolsDir = instanceDirectoryForGraph(root, KIND);
    for (const def of x.defs) {
      const rel = toolPageRelPath(repo, x.name, def.id);
      if (rel === undefined) continue;
      const row = x.rows.find((r) => r.id === def.id);
      const repoRel = (abs: string) => relative(repo, abs).split(sep).join("/");
      const file = toolsDir
        ? [".ts", ".json"].map((e) => join(toolsDir, def.id, `${def.id}${e}`)).find((f) => existsSync(f))
        : undefined;
      const satisfies = def.satisfies.map(skillId);
      const skills = new Map<string, SkillInfo | undefined>(
        satisfies.map((s) => {
          const doc = docs.get(s);
          return [s, doc ? { ...doc, io: skillIoContracts(s, roots, repo) } : undefined];
        }),
      );
      const script = def.invoke.shell ? resolveScriptKey(def.invoke.shell, [repo, ...roots], repo) : undefined;

      const parts: ToolPageData["parts"] = [];
      const part = (role: string, abs: string) => parts.push({ role, file: repoRel(abs), href: forge(repoRel(abs)), exists: existsSync(abs) });
      if (file) part("definition", file);
      const provLog = file && join(dirname(file), `${def.id}.prov.jsonld`);
      if (provLog && existsSync(provLog)) part("provenance log", provLog);
      let moduleImports: ToolPageData["moduleImports"] = [];
      if (def.invoke.inProcess) {
        const mod = resolveModule(def.invoke.inProcess.module, root, roots) ?? join(root, def.invoke.inProcess.module);
        part("in-process module", mod);
        moduleImports = relativeImports(mod, repo).map((f) => ({ file: f, href: forge(f) }));
      }
      for (const p of [...scriptPaths(def.invoke.shell ?? ""), ...scriptPaths(script?.command ?? "")]) {
        part("script", join(repo, p));
      }
      for (const m of def.maintains ?? []) part("maintained source", join(root, String((m as { source: unknown }).source)));
      for (const sp of def.subprocesses ?? []) {
        const r = rows.find((pr) => pr.id === sp || pr.stem === sp);
        if (r) part("subprocess diagram", join(repo, r.file));
      }

      const procHref = (r: ProcessRow, step?: string) =>
        procPage === undefined ? undefined : `${pageHref(rel, posixJoin(dirname(procPage), `${r.stem}.html`))}${step ? `#${stepAnchor(step)}` : ""}`;
      const processes: ProcessUse[] = [];
      for (const sp of def.subprocesses ?? []) {
        const r = rows.find((pr) => pr.id === sp || pr.stem === sp);
        processes.push({ process: sp, processName: r?.name ?? sp, ...(r && procHref(r) ? { href: procHref(r) } : {}) });
      }
      for (const r of rows) {
        for (const st of r.steps ?? []) {
          const via = st.skills.find((s) => satisfies.includes(s));
          if (!via) continue;
          const href = procHref(r, st.id);
          processes.push({ process: r.id, processName: r.name, step: { id: st.id, name: st.name, lane: st.lane }, via, ...(href ? { href } : {}) });
        }
      }

      const workflows = workflowUses(repo, roots, workflowNeedles(def, script), forge);
      if (workflows.length) actions.add(def.id);
      const data: ToolPageData = {
        def,
        instance: x.name,
        ...(docIri ? { docIri, iri: toolIri(docIri, def.id) } : {}),
        typeIri,
        ...(file ? { source: { file: repoRel(file), ...(forge(repoRel(file)) ? { href: forge(repoRel(file)) } : {}) } } : {}),
        skills,
        skillHref: (s) => skillPageHref(s, rel, skillPages),
        toolHref: (id) => hrefOf(rel, id),
        siblings: bySkill,
        alternatives: alternatives.get(def.id) ?? [],
        processes,
        processesRead,
        ...(script ? { script } : {}),
        parts,
        moduleImports,
        mcpServers: def.invoke.mcp ? mcpServers : [],
        mcpTools: mcpOf(def.id),
        ...(apiFiles.has(x.name)
          ? { api: { reference: `${pageHref(rel, apiFiles.get(x.name)!.reference)}#${def.id}`, openapi: pageHref(rel, apiFiles.get(x.name)!.openapi), mcp: pageHref(rel, apiFiles.get(x.name)!.mcp) } }
          : {}),
        workflows,
        ...(row?.qaHref ? { qaHref: row.qaHref } : {}),
        ...(row?.qaVerdict ? { qaVerdict: row.qaVerdict } : {}),
        ...(row?.provenance ? { provenance: row.provenance } : {}),
      };
      pages.set(rel, withRenderedByFrontMatter(toolPage(data, GENERATED_FM), VIEWER_TOOL));
    }
  }
  return { pages, actions, hrefOf, apiOf: (instance) => apiFiles.get(instance), iriOf: (id) => iriOf.get(id) };
}

/**
 * Every page the viewer draws, site-relative, with its content: the full KG,
 * one per layer, and one per Tool. One function, so the writer and the test
 * that asserts the written pages are current cannot assemble them differently.
 */
export async function allPages(
  allRows: readonly ToolRow[],
  PAGE: string,
  known: ReadonlySet<string>,
  repo = REPO,
): Promise<{ pages: Map<string, string>; rows: ToolRow[]; subjects: ToolSubject[]; empty: string[] }> {
  const { subjects: plain, empty } = toolSubjects(repo);
  const built = await toolPages(plain, repo);
  const withAction = (rs: readonly ToolRow[]): ToolRow[] => rs.map((r) => (built.actions.has(r.id) ? { ...r, action: true } : r));
  const subjects = plain.map((x) => ({ ...x, rows: withAction(x.rows) }));
  const rows = withAction(allRows);
  const pages = new Map<string, string>();
  pages.set(
    PAGE,
    publishedPage(rows, known, repo, {
      subjects: subjects.map((x) => ({ name: x.name, count: x.rows.length, href: `${x.name}/` })),
      toolHref: (id) => built.hrefOf(PAGE, id),
      toolIri: built.iriOf,
      ...(built.apiOf("") ? { api: { openapi: "openapi.json", mcp: "mcp-tools.json", reference: "api/" } } : {}),
    }),
  );
  for (const x of subjects) {
    const rel = pageRelPath(repo, x.name)!;
    pages.set(rel, publishedPage(x.rows, known, repo, {
        instance: x.name,
        upHref: "../",
        toolHref: (id) => built.hrefOf(rel, id),
        toolIri: built.iriOf,
        ...(built.apiOf(x.name) ? { api: { openapi: "openapi.json", mcp: "mcp-tools.json", reference: "api/" } } : {}),
      }));
  }
  // ONE PAGE PER TOOL, under its layer's page (owner, 2026-11-12).
  for (const [rel, rendered] of built.pages) pages.set(rel, rendered);
  return { pages, rows, subjects, empty };
}

/**
 * The pages a scoped site build writes: `pages` without those under an
 * out-of-scope layer's own Tools page directory. That layer's Tools pages are
 * linked on the platform's site, not copied (owner, 2026-11-13: "other
 * harnesses should be referenced not included"); the combined index and the
 * API documents stay, since they are this site's own view of every Tool.
 * `outOfScopeDirs` are those directories, site-relative, with `/` separators.
 */
export function withoutLayers(pages: ReadonlyMap<string, string>, outOfScopeDirs: readonly string[]): Map<string, string> {
  if (outOfScopeDirs.length === 0) return new Map(pages);
  return new Map([...pages].filter(([rel]) => !outOfScopeDirs.some((d) => rel === d || rel.startsWith(`${d}/`))));
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  // A scoped site (`--scope`): the layers whose own Tools pages are written.
  const scope = siteScope();
  // Every declared `tools` graph, not cat-harness's alone (bean 1nu0). A
  // discovery failure is reported, never folded into "no tools".
  const found = discoverTools(REPO);
  if (found.failures.length > 0) {
    for (const f of found.failures) console.error(`::error::gen-tools-viz: ${f.dir ?? f.instance}: ${f.reason}`);
    process.exit(1);
  }
  const rows0 = toolRows(found.tools);
  if (rows0.length === 0) {
    // A declared graph that yields nothing is the `dh4f` shape — scanning
    // nothing and reporting a clean run. Refuse rather than write an empty page.
    console.error("::error::gen-tools-viz: the tools graph yielded no nodes");
    process.exit(1);
  }
  const PAGE = pageRelPath(REPO);
  if (PAGE === undefined) {
    console.error(`::error::gen-tools-viz: no visualiser declared for graph typology '${KIND}'`);
    process.exit(1);
  }
  const known = skillIds(REPO);
  const drawnAll = await allPages(rows0, PAGE, known, REPO);
  const { rows, subjects: allSubjects, empty } = drawnAll;
  const subjects = allSubjects.filter((x) => inScope(scope, x.name));
  const pages = withoutLayers(
    drawnAll.pages,
    allSubjects.filter((x) => !inScope(scope, x.name)).map((x) => dirname(pageRelPath(REPO, x.name)!).split(sep).join("/")),
  );
  if (scope !== undefined) console.log(`  scope ${scopeArg(scope)}: ${subjects.length} of ${allSubjects.length} layer page(s); the others are linked on their own site`);
  const localDocs = localSiteDir(resolve(HARNESS_ROOT));
  const site = siteTarget(localDocs ?? baseDocsDir(REPO));

  // ORPHANS: a sub-graph page this viewer drew for a layer that no
  // longer declares Tools. Only a page that says it is ours is touched.
  const viewDir = join(site, PAGE, "..");
  const drawn = new Set(allSubjects.map((x) => x.name));
  const orphans = existsSync(viewDir)
    ? readdirSync(viewDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !drawn.has(e.name) && !pages.has(posixJoin(dirname(PAGE), e.name, "index.md")))
        .map((e) => join(viewDir, e.name))
        .filter((d) => {
          const f = join(d, "index.md");
          return existsSync(f) && renderedByOf(readFileSync(f, "utf-8")) === VIEWER_TOOL;
        })
    : [];

  // ORPHANED TOOL PAGES: a Tool page under a drawn layer whose Tool is gone.
  for (const x of subjects) {
    const dir = join(site, pageRelPath(REPO, x.name)!, "..");
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || pages.has(posixJoin(relative(site, dir), e.name, "index.md"))) continue;
      const f = join(dir, e.name, "index.md");
      if (existsSync(f) && renderedByOf(readFileSync(f, "utf-8")) === VIEWER_TOOL) orphans.push(join(dir, e.name));
    }
  }

  // A page cat-harness declares it builds at publish (`builtAtPublish`), by its
  // path in cat-harness's own site: the same site-relative path is asked under
  // `--site`, so the answer does not depend on where the site is written.
  const harnessRoot = join(REPO, "cat-harness");
  const declaredBuilt = readDeclaration(harnessRoot)?.builtAtPublish ?? [];
  const builtHere = (rel: string): boolean => isBuiltAtPublish(declaredBuilt, join(siteDirFor(harnessRoot), rel).split(sep).join("/"));

  if (check) {
    let stale = 0;
    let skipped = 0;
    for (const [rel, rendered] of pages) {
      if (builtHere(rel)) {
        skipped++;
        continue;
      }
      const out = join(site, rel);
      const current = existsSync(out) ? readFileSync(out, "utf-8") : "";
      if (current !== rendered) {
        console.error(`::error::gen-tools-viz: ${rel} is stale — run \`bun run cat tools:viz\``);
        stale++;
      }
    }
    // Under a built-at-publish route a stale local page is not a committed
    // orphan, so `--check` does not report it; a write run still prunes it.
    for (const d of orphans) {
      if (builtHere(relative(site, join(d, "index.md")))) continue;
      console.error(`::error::gen-tools-viz: ${d} is an orphan — its instance declares no Tools now`);
      stale++;
    }
    if (stale > 0) process.exit(1);
    console.log(
      skipped === pages.size
        ? `✓ tools viewer: ${pages.size} page(s) built at publish (builtAtPublish), not committed — nothing to compare; \`bun run cat tools:viz\` writes them`
        : `✓ tools viewer is current — ${rows.length} tool(s), ${subjects.length} instance page(s)${skipped ? `, ${skipped} built at publish` : ""}`,
    );
  } else {
    for (const [rel, rendered] of pages) {
      const out = join(site, rel);
      mkdirSync(join(out, ".."), { recursive: true });
      writeFileSync(out, rendered);
    }
    for (const d of orphans) {
      rmSync(d, { recursive: true });
      console.log(`  ✗ pruned ${d}`);
    }
    // THE TILE COUNTS (folio-assistant#931, owner's ruling 2026-10-29): each
    // page's own Tool count, keyed by the tile that opens that page. Build-time
    // data, like every projection `scanTileCounts` reads, so `--check` does not
    // compare it.
    const counted = tileCountsForPages(
      [
        { page: relative(REPO, join(site, PAGE)), count: rows.length, unit: ["tool", "tools"] },
        ...subjects.map((x) => ({ page: relative(REPO, join(site, pageRelPath(REPO, x.name)!)), count: x.rows.length, unit: ["tool", "tools"] as const })),
      ],
      REPO,
      resolve(HARNESS_ROOT),
    );
    const countFile = join(site, "assets", "tools", "index.json");
    mkdirSync(join(countFile, ".."), { recursive: true });
    writeFileSync(countFile, JSON.stringify(tileCounts(counted), null, 2) + "\n");
    console.log(`  tile counts: ${Object.keys(counted).length} tile(s) → assets/tools/index.json`);
    const bad = [...new Set(rows.flatMap((r) => r.satisfies))].filter((s) => !known.has(s));
    console.log(`tools viewer: ${rows.length} tool(s) → ${PAGE}`);
    for (const x of subjects) console.log(`  ${x.name}: ${x.rows.length} tool(s) → ${pageRelPath(REPO, x.name)}`);
    console.log(bad.length === 0 ? "  every satisfies resolves" : `  ${bad.length} unresolved — shown on the page`);
  }
  // A layer that declares a `tools` graph yielding no Tool gets no page —
  // and is said, so its tile's "no viewer yet" is explained rather than silent.
  for (const n of empty) console.log(`  · ${n} declares a tools graph with no Tool nodes — no page drawn`);
}
