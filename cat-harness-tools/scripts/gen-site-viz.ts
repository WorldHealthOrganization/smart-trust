#!/usr/bin/env bun
/**
 * A viewer over the PUBLISHED SITE: the top-level routes of each declared
 * `basic-cdn-site` directory, read from the branch that keeps it.
 *
 * @module scripts/gen-site-viz
 * @covers basic-cdn-site
 * @graphNode none — a generator over the site graph, not a schema itself
 *
 * Owner, 2026-10-20 (bean `folio-assistant-6gme`): "Build route listing". The
 * site is never in the checkout — `storage.branch` (`gh-pages`) keeps it, keyed
 * by route — so this reads that branch's TREE with git (fetched shallow, trees
 * only, through `branch-store.ts`'s `BranchStore`) and never a network API.
 *
 * Three states, never a zero standing in for "could not look": `present` (the
 * tree was read: one row per top-level route and per staging preview, with
 * its page and file counts), `empty` (git answered: the branch is absent or
 * its tree holds nothing) and `could-not-read` (git did not answer; the page
 * says why and draws no counts). Built at publish (`builtAtPublish`), since
 * the branch moves without a commit, so `--check` has nothing to compare.
 *
 * Usage:
 *   bun run cat site:viz            # write <site>/en/cat-harness/site/index.html
 *   bun run cat site:viz -- --site <dir>
 */
import { join } from "node:path";

import { layerRootsIn, readDeclaration, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { BranchStore } from "./branch-store.ts";
import { makeEmit } from "./viewer-page.ts";
import { declaredPageRoute, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { themedPage } from "./lib/themed-page.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteTarget } from "./lib/site-target.ts";
import { PREVIEW_PREFIXES } from "./lib/preview-prefix.ts";

const VIEWER_TOOL = "site-viewer";
const KIND = "basic-cdn-site";
/** The directories on the branch that hold one preview per slug (`lib/preview-prefix.ts`). */
const PREVIEW_DIRS = new Set(PREVIEW_PREFIXES);

/** One route's counts, and whether it holds an `index.html` a link to `<route>/` can land on. */
export interface RouteRow { route: string; pages: number; files: number; index: boolean }
export type SiteRead =
  | { state: "present"; tip: string; routes: RouteRow[]; previews: RouteRow[]; rootFiles: number }
  | { state: "empty"; reason: string }
  | { state: "could-not-read"; reason: string };
export interface SiteSection { instance: string; id: string; branch: string; remote: string; read: SiteRead }

/** Group a branch's file paths by top-level route, and staging previews by slug. Pure. */
export function summariseTree(paths: readonly string[]): { routes: RouteRow[]; previews: RouteRow[]; rootFiles: number } {
  const routes = new Map<string, RouteRow>();
  const previews = new Map<string, RouteRow>();
  let rootFiles = 0;
  const bump = (m: Map<string, RouteRow>, route: string, p: string): void => {
    const r = m.get(route) ?? { route, pages: 0, files: 0, index: false };
    r.files++;
    if (p.endsWith(".html")) r.pages++;
    if (p === `${route}/index.html`) r.index = true;
    m.set(route, r);
  };
  for (const p of paths) {
    const segs = p.split("/");
    if (segs.length === 1) rootFiles++;
    else if (PREVIEW_DIRS.has(segs[0]!) && segs.length > 2) bump(previews, `${segs[0]}/${segs[1]}`, p);
    else bump(routes, segs[0]!, p);
  }
  const sorted = (m: Map<string, RouteRow>): RouteRow[] => [...m.values()].sort((a, b) => a.route.localeCompare(b.route));
  return { routes: sorted(routes), previews: sorted(previews), rootFiles };
}

/** Read one branch's tree through a shallow, trees-only fetch. Never throws. */
export function readSiteBranch(repoRoot: string, branch: string): { remote: string; read: SiteRead } {
  let store: BranchStore;
  try {
    store = BranchStore.open(branch, { repoRoot, keyedBy: "route", log: () => {} });
  } catch (e) {
    return { remote: "(none)", read: { state: "could-not-read", reason: (e as Error).message } };
  }
  const remote = store.remote.replace(/\/\/[^@/]*@/, "//");
  try {
    const tip = store.fetchTip();
    if (tip.state === "unknown") return { remote, read: { state: "could-not-read", reason: tip.reason } };
    if (tip.state === "absent") return { remote, read: { state: "empty", reason: `the remote has no branch \`${branch}\`` } };
    const paths = store.must(["ls-tree", "-r", "-z", "--name-only", tip.tip]).split("\0").filter(Boolean);
    if (paths.length === 0) return { remote, read: { state: "empty", reason: `\`${branch}\` at ${tip.tip.slice(0, 12)} holds no files` } };
    return { remote, read: { state: "present", tip: tip.tip, ...summariseTree(paths) } };
  } catch (e) {
    return { remote, read: { state: "could-not-read", reason: (e as Error).message } };
  }
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function table(rows: readonly RouteRow[], up: string, head: string): string {
  // A route with no index.html answers nothing at `<route>/`, so it is named, not linked.
  const cell = (r: RouteRow): string => (r.index ? `<a href="${esc(up + r.route)}/"><code>${esc(r.route)}/</code></a>` : `<code>${esc(r.route)}/</code>`);
  const body = rows.map((r) => `<tr><td>${cell(r)}</td><td>${r.pages}</td><td>${r.files}</td></tr>`).join("\n");
  return `<div class="clip"><table><thead><tr><th>${head}</th><th>Pages</th><th>Files</th></tr></thead><tbody>\n${body}\n</tbody></table></div>`;
}

function section(s: SiteSection, up: string): string {
  const head = `<h2>${esc(s.instance)} · <code>${esc(s.id)}</code></h2>\n<p class="m">Branch <code>${esc(s.branch)}</code> on <code>${esc(s.remote)}</code></p>`;
  const r = s.read;
  if (r.state === "could-not-read") return `${head}\n<p class="warn"><b>Could not read the branch</b>, so nothing is counted here: ${esc(r.reason)}</p>`;
  if (r.state === "empty") return `${head}\n<p><b>Empty:</b> ${esc(r.reason)}. Nothing is published there yet.</p>`;
  const pages = r.routes.reduce((n, x) => n + x.pages, 0);
  return `${head}
<p class="m">Tip <code>${esc(r.tip.slice(0, 12))}</code> · ${r.routes.length} top-level route(s), ${pages} page(s) · ${r.previews.length} staging preview(s) · ${r.rootFiles} file(s) at the root</p>
${table(r.routes, up, "Route")}
${r.previews.length > 0 ? `<h3>Staging previews</h3>\n${table(r.previews, up, "Preview")}` : '<p class="m">No staging previews.</p>'}`;
}

/** The page. `route` is the declared page route, so links climb back to the site root. */
export function pageHtml(sections: readonly SiteSection[], route: string): string {
  const up = "../".repeat(route.split("/").filter(Boolean).length);
  return themedPage({
    title: "Published site",
    generator: "cat-harness-tools/scripts/gen-site-viz.ts",
    command: "bun run site:viz",
    body: `<style>
.site-page { min-width:0; overflow-wrap:anywhere; --muted:#bcbab3; }
:root[data-fa-scheme="light"] .site-page { --muted:#5b6168; }
.site-page .m { color:var(--muted); font-size:.88rem; }
.site-page .warn { border-left:4px solid #d97706; padding:4px 10px; }
.site-page .clip { width:100%; overflow-x:auto; }
.site-page table { display:table; width:100%; border-collapse:collapse; font-size:.9rem; }
.site-page th, .site-page td { text-align:left; padding:6px 8px; border:0; border-bottom:1px solid rgba(127,127,127,.4); background:transparent; }
.site-page th { background:rgba(127,127,127,.12); }
.site-page td:nth-child(n+2) { white-space:nowrap; }
</style>
<div class="site-page">
<h1>Published site</h1>
<p class="m">The routes the site's CDN branch holds, read from its tree when this page was built. A page is an <code>.html</code> file.</p>
${sections.length === 0 ? `<p>No directory of kind <code>${KIND}</code> is declared.</p>` : sections.map((s) => section(s, up)).join("\n")}
</div>`,
  });
}

if (import.meta.main) {
  const repoRoot = repoRootFor(HARNESS_ROOT);
  const route = declaredPageRoute(HARNESS_ROOT, VIEWER_TOOL);
  if (route === undefined) {
    console.log(`  · no visualiser declared rendered by ${VIEWER_TOOL} — nothing to publish`);
    process.exit(0);
  }
  if (process.argv.includes("--check")) {
    console.log(`  · ${route}/ is built at publish (builtAtPublish), from a branch that moves without a commit — nothing to compare`);
    process.exit(0);
  }
  const sections: SiteSection[] = [];
  for (const root of layerRootsIn(repoRoot)) {
    const decl = readDeclaration(root);
    for (const d of decl?.directories ?? []) {
      const branch = (d.storage as { branch?: string } | undefined)?.branch;
      if (!(d.graphTypologies ?? []).includes(KIND) || branch === undefined) continue;
      sections.push({ instance: decl!.name, id: d.id, branch, ...readSiteBranch(repoRoot, branch) });
    }
  }
  const site = siteTarget(join(HARNESS_ROOT, siteDirFor(HARNESS_ROOT)));
  makeEmit({ check: false, onStale: () => {} })(join(site, route, "index.html"), withRenderedByFrontMatter(pageHtml(sections, route), VIEWER_TOOL));
  for (const s of sections) console.log(`  ${s.instance}/${s.id}: ${s.read.state}${s.read.state === "present" ? "" : ` — ${s.read.reason}`}`);
}
