#!/usr/bin/env bun
/**
 * Publish the folio graph as a projection, and a viewer over it.
 *
 * @module scripts/gen-folio-viz
 * @covers folio
 * @graphNode none — a generator over the folio graph, not a schema itself
 *
 * `folio` is the only `renderable` graph typology, and `gen-landing-data.ts`
 * renders its CONTENT as the landing board. This shows the GRAPH: which nodes
 * exist, what each anchors to, which theme it claims, where it was declared,
 * and whether its links resolve.
 *
 * ## Three pieces, the same three as its siblings
 *
 * A reader over the declared directories, a projection under
 * `<site>/assets/folio/`, and a zero-dependency viewer under
 * `<site>/<handler>/folio/` that fetches the projection relative to its own
 * location. The viewer carries the reader's folio with the site's layout.
 *
 * NO BACKTICKS BELOW THE TEMPLATE LITERAL — not in strings, not in comments.
 * The whole page is one template literal and a backtick anywhere inside it
 * terminates the string, failing at a line number far from the mistake.
 *
 * ## One page per layer
 *
 * It covers the KIND with `subgraphs: "instance"`: the full view stays
 * cat-harness's own graph at `<locale>/<harness>/folio/`, and every OTHER
 * layer in the checkout holding a folio directory gets
 * `<locale>/<harness>/folio/<instance>/`, over a projection of that
 * layer's directories alone at `assets/folio/<instance>/index.json`. Those
 * pages describe layers above this layer, so they are built at publish
 * (`builtAtPublish`) and never committed here.
 *
 * Usage:
 *   bun run cat folio:viz
 *   bun run cat folio:viz -- --check
 *
 * Exit: 0 written or up to date · 1 stale under `--check`.
 */
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

import { viewerPlacement } from "./gen-schema-viz.ts";
import { folioFileList, formatBytes, type FolioFile } from "@litlfred/cat-harness/folio-render/file-list.ts";
import {
  checkoutRootFor,
  directoriesForGraph,
  readDeclaration,
  repoRootFor,
  siteDirFor,
} from "../schemas/kg/cat-harness.js";
import { makeEmit } from "./viewer-page.ts";
import { mergeFolio } from "./folio-merge.ts";
import { themedPage } from "./lib/themed-page.ts";
import { publishedHref } from "./lib/jekyll-permalink.ts";
import { buildsHostSite, hostSiteBase } from "./lib/subject-pages.ts";
import { declaredPageRoute, renderedByOf, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { checkoutDirectories } from "../schemas/kg/harness-config.js";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteTarget } from "./lib/site-target.ts";
import { mountedInstances } from "./lib/layer-output.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "folio-viewer";

const ROOT = join(HARNESS_ROOT);
const check = process.argv.includes("--check");

/** One node of the folio graph, as the viewer needs it. */
export interface FolioNodeRow {
  id: string;
  summary: string;
  theme: string | null;
  anchor: string | null;
  declaredIn: string | null;
  links: Array<{ label: string; href: string }>;
  /** Characters of prose. A node with none is a sticky with nothing to say. */
  chars: number;
  file: string;
}

export interface FolioGraph {
  /** Every declared folio directory, ABSENT ONES INCLUDED. */
  /**
   * `files` is the folio as a list of files: the harness's minimal
   * rendering (`folio-render/file-list.ts`, bean `ohx6`), read through the
   * same function, so the viewer's 'list' view and the harness's page cannot
   * disagree about what the folio holds.
   */
  directories: Array<{ dir: string; present: boolean; nodes: number; files: FolioFile[] }>;
  nodes: FolioNodeRow[];
}

/**
 * Read every declared folio directory.
 *
 * A DECLARED-BUT-ABSENT DIRECTORY IS A ROW, NOT SILENCE — `dh4f`, the defect
 * this repository keeps paying for, and one the author of this file
 * personally re-enacted on 2026-09-22 by measuring an instance-relative path
 * from the repository root (bean `8mbk`, scrapped). A consumer that scans
 * nothing and reports a clean run is worse than one that says it found
 * nothing.
 */
export function readFolioGraph(roots: string[], repo?: string): FolioGraph | null {
  const dirs = new Set<string>();
  for (const root of roots) for (const d of directoriesForGraph(root, "folio")) dirs.add(d);
  if (dirs.size === 0) return null;
  return readFolioDirs([...dirs], repo ?? roots[roots.length - 1] ?? "");
}

/**
 * {@link readFolioGraph} over directories already resolved — one layer's,
 * for its own page. Absent directories are rows here too.
 */
export function readFolioDirs(dirList: readonly string[], repo: string): FolioGraph {
  const dirs = new Set(dirList);

  // REPO-RELATIVE, AND THE COMMITTED ARTEFACT IS WHY.
  //
  // The first version emitted absolute paths, so the projection carried
  // `/home/user/folio-assistant/cat-harness/folio/...` — the author's own
  // checkout. CI builds at `/home/runner/work/...`, so `folio:viz:check`
  // went red on a file that was correct: the artefact could never be
  // current anywhere but the machine that wrote it, and it published that
  // machine's directory layout into a JSON anyone can read.
  //
  // Caught by the gate this same change added, on its first CI run. Its
  // siblings (`library/`, `voices/`) already emit relative paths; this one
  // did not, and nothing said so until the path differed.
  const base = repo;
  const rel = (p: string): string => (base ? relative(base, p) : p).split("\\").join("/");

  const g: FolioGraph = { directories: [], nodes: [] };
  for (const dir of [...dirs].sort()) {
    const present = existsSync(dir);
    let n = 0;
    if (present) {
      for (const name of readdirSync(dir).sort()) {
        if (!name.endsWith(".json")) continue;
        const file = join(dir, name);
        let raw: Record<string, unknown>;
        try {
          raw = JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
        } catch {
          // UNREADABLE IS NOT ABSENT. A node counted as missing would make a
          // broken file look like a file nobody wrote.
          g.nodes.push({
            id: basename(name, ".json"),
            summary: "could not be read — this file is not valid JSON",
            theme: null,
            anchor: null,
            declaredIn: null,
            links: [],
            chars: 0,
            file: rel(file),
          });
          n++;
          continue;
        }
        const anchor = raw.anchor as { kind?: string; page?: string } | undefined;
        g.nodes.push({
          id: String(raw.id ?? basename(name, ".json")),
          summary: String(raw.summary ?? ""),
          // A ThemeRef `{instance?, themeId}` since #1168 B8; the page shows the id.
          theme:
            raw.theme == null
              ? null
              : typeof raw.theme === "object"
                ? String((raw.theme as { themeId?: unknown }).themeId ?? "")
                : String(raw.theme),
          anchor: anchor?.kind ? `${anchor.kind}:${anchor.page ?? ""}` : null,
          declaredIn: raw.declaredIn == null ? null : String(raw.declaredIn),
          links: Array.isArray(raw.links)
            ? (raw.links as Array<Record<string, unknown>>).map((l) => ({
                label: String(l.label ?? ""),
                // Authored as the page's source location; published elsewhere
                // for the docs-folder pages (bean `kc7k`).
                href: platformDocHref(join(ROOT, siteDirFor(ROOT)), String(l.href ?? "")),
              }))
            : [],
          chars: String(raw.comment ?? raw.text ?? "").length,
          file: rel(file),
        });
        n++;
      }
    }
    g.directories.push({ dir: rel(dir), present, nodes: n, files: present ? folioFileList(dir) : [] });
  }
  return g;
}

/**
 * A sticky's link to a page of the platform's own docs, where this build
 * publishes it. The href is authored site-rooted (`/concepts/…`) and the page
 * is published only on the platform's site, so on a downstream's site
 * (a WHO library folio) it resolved against that site and 404'd: 5 of 5 sticky links on
 * `/folio/` (owner, 2026-11-13, node-kind audit). Where this build is not
 * the platform's site, a link to one of its docs pages names the platform's
 * site absolutely; on the platform's site it stays site-rooted, so a preview
 * keeps its links. Any other href is {@link publishedHref}'s.
 */
export function platformDocHref(
  siteDir: string,
  href: string,
  host: { here: boolean; base: string | undefined } = { here: buildsHostSite(), base: hostSiteBase() },
): string {
  const published = publishedHref(siteDir, href);
  if (host.here || host.base === undefined || !published.startsWith("/") || published.startsWith("//")) return published;
  const path = /^([^#?]*)/.exec(href)![1]!.replace(/^\/+/, "");
  const stem = path === "" || path.endsWith("/") ? `${path}index` : path.replace(/\.html$/i, "");
  return existsSync(join(siteDir, `${stem}.md`)) || existsSync(join(siteDir, `${stem}.html`)) ? `${host.base}${published}` : published;
}

export function projection(g: FolioGraph): unknown {
  return {
    $schema: "folio-graph-projection/v1",
    tile: { folio: { count: g.nodes.length, unit: "stickies" } },
    // Sizes formatted by the harness's own `formatBytes`, so the list view and
    // `folio/index.md` show the same number, not two roundings of it.
    directories: g.directories.map((d) => ({ ...d, files: d.files.map((f) => ({ ...f, size: formatBytes(f.bytes) })) })),
    nodes: g.nodes,
  };
}

/**
 * The viewer — a THEMED Jekyll page since 2026-10-07 (lib/themed-page.ts):
 * on the site's default layout, so it carries the top band (search, Folio,
 * language) that only that layout delivers, and the folio with it — the
 * layout loads docs-ui, so the page carries no folio-mount fragment of its
 * own (check:folio-mount counts a page on the layout as mounted). Every rule
 * is scoped under .fo-page; the one hue, the warn pill, is keyed on the
 * site's own scheme switch (data-fa-scheme), dark first because the site's
 * ground is, and everything else is neutral and translucent.
 */
export function viewerHtml(dataHref: string, instance?: string): string {
  const heading = instance === undefined ? "folio — the graph" : "folio — " + instance;
  const scope =
    instance === undefined
      ? ""
      : " This page is <strong>" + escText(instance) + "</strong>'s folio graph alone; " +
        '<a href="../">the full view</a> is cat-harness\'s.';
  // NO BACKTICKS BELOW THIS LINE — see the module header.
  return themedPage({
    title: heading,
    generator: "cat-harness-tools/scripts/gen-folio-viz.ts",
    command: "bun run folio:viz",
    body: `<style>
.fo-page { --edge:rgba(127,127,127,.4); --box:rgba(127,127,127,.12);
           --warn:#f0c27a; --warn-edge:#8a6420; --warn-bg:rgba(236,148,51,.16); }
:root[data-fa-scheme="light"] .fo-page { --warn:#7a4a10; --warn-edge:#ec9433; --warn-bg:#fdf4e8; }
.fo-page h1 { margin:0 0 .2rem; }
.fo-page h2 { font-size:1.15rem; margin:1.5rem 0 .5rem; font-weight:600; }
.fo-page .lede { opacity:.9; margin:0 0 1.2rem; }
.fo-page .badge { display:inline-block; border:1px solid var(--edge); background:var(--box);
         border-radius:0; padding:.2rem .5rem; margin:0 .4rem .4rem 0; font-size:.85rem; }
.fo-page table { display:table; width:100%; border-collapse:collapse; margin:1rem 0; font-size:.95rem; }
.fo-page caption { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.fo-page th, .fo-page td { text-align:left; padding:.5rem .55rem; border:0; border-bottom:1px solid var(--edge); vertical-align:top; background:transparent; }
.fo-page th { font-weight:600; white-space:nowrap; }
.fo-page .muted { opacity:.9; }
.fo-page .pill { display:inline-block; font-size:.72rem; font-weight:700; letter-spacing:.04em;
        text-transform:uppercase; padding:.12rem .45rem; border:1px solid var(--edge); }
.fo-page .pill.warn { color:var(--warn); border-color:var(--warn-edge); background:var(--warn-bg); }
.fo-page .links { display:flex; flex-wrap:wrap; gap:.25rem .35rem; max-height:4.8rem; overflow-y:auto; padding-right:.2rem; }
.fo-page .link-pill { display:inline-block; font-size:.8rem; line-height:1.25; padding:.1rem .4rem; border:1px solid var(--edge); background:var(--box); border-radius:2px; word-break:break-word; text-decoration:none; }
/* The body text colour, underlined: the theme's link colour on the pill's grey
   measured 3.55:1 (dark) and 4.41:1 (light), under WCAG AA's 4.5:1. */
.fo-page a.link-pill { color:inherit; text-decoration:underline; }
.fo-page a.link-pill:hover { border-color:currentColor; }
.fo-page .empty { opacity:.9; }
.fo-page .pill.ok { border-color:var(--edge); }
.fo-page .pill.local { color:var(--warn); border-color:var(--warn-edge); background:var(--warn-bg); }
</style>
<div class="fo-page">
  <h1 id="fo-title">${escText(heading)}</h1>
  <p class="lede">Every node the folio graph holds: what it anchors to, the theme it claims,
     where it was declared, and the links it carries. The folio's <em>content</em> renders as
     the landing board; this is a view of the graph behind it.${scope}</p>
  <div id="badges"></div>
  <div id="dirs"></div>
  <div id="files"></div>
  <div id="merged" aria-live="polite"></div>
  <div id="nodes"><p class="empty">loading…</p></div>
</div>
<script>
var DATA_HREF = ${JSON.stringify(dataHref)};
var INSTANCE = ${JSON.stringify(instance ?? "")};
/* The reader's folio, the store docs-ui's glass reads and writes (R30 j2if). */
var FOLIO_KEY = "fa-folio-assets";
var mergeFolio = ${mergeFolio.toString()};
// Bean "qgjh": a node's links are LINKS. An absolute http(s) href is used as
// it is; a site-rooted one ("/concepts/agentic-harness.html") is resolved against this
// site's root, found from where the page reads its data, so it works under the
// bare site, the project baseurl and a staging preview alike. Anything else
// stays text rather than becoming a link that 404s.
var SITE_ROOT = (function (h) { var i = h.lastIndexOf("assets/"); return i < 0 ? "" : h.slice(0, i); })(DATA_HREF);
function linkHref(h) {
  if (/^https?:[/][/]/.test(h)) return h;
  if (h.charAt(0) === "/" && h.charAt(1) !== "/") return SITE_ROOT + h.slice(1);
  return "";
}
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

/* BOTH SOURCES, LOADED DYNAMICALLY (owner, 2026-11-13). The published
   projection and the reader's folio in this browser are read on every load
   and merged by mergeFolio (scripts/folio-merge.ts): a union keyed by id,
   the published copy wins for content, the local copy for the reader's own
   state, and a local-only item is kept and marked unsynced. The projection
   is fetched with no-store and a stamp, so a cached copy cannot hide what
   was published since; it is fetched again when the tab comes back, and the
   merge is redrawn whenever the reader's folio changes (this tab or another). */
var published = null, publishedError = null, publishedText = null;
function readLocalFolio() {
  try {
    var raw = localStorage.getItem(FOLIO_KEY);
    var parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_e) { return {}; }
}
function stamped(h) { return h + (h.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now(); }
function renderMerged() {
  var M = mergeFolio(published ? published.nodes : [], readLocalFolio(), INSTANCE);
  var c = M.counts;
  var STATUS = {
    synced: '<span class="pill ok">published, in this browser</span>',
    published: '<span class="pill ok">published</span>',
    unsynced: '<span class="pill local">this browser only, unsynced</span>'
  };
  var head = '<h2 id="fo-merged-head">Folio: published and in this browser</h2>' +
    '<p class="muted">' + (published
      ? "<b>" + c.published + "</b> published"
      : publishedError ? '<span class="pill warn">published copy could not be read</span>'
      : "published copy loading\u2026") +
    " \u00b7 <b>" + c.local + "</b> in this browser" +
    " \u00b7 <b>" + c.unsynced + "</b> unsynced. Your own items stay in this browser; " +
    "the site cannot see them.</p>";
  if (M.rows.length === 0) {
    $("merged").innerHTML = head + '<p class="empty">Nothing published and nothing in this browser\u2019s folio.</p>';
    return;
  }
  $("merged").innerHTML = head +
    '<table aria-label="Folio: published and in this browser" aria-labelledby="fo-merged-head">' +
    "<caption>Folio: published and in this browser</caption>" +
    "<thead><tr><th>item</th><th>source</th><th>on your glass</th><th>from</th></tr></thead><tbody>" +
    M.rows.map(function(r){
      /* A published link is site-rooted (linkHref resolves it); a local one is
         the address docs-ui stored after its own safeHref, used as it is
         when it is http(s), rooted or relative, and text otherwise. */
      var h = r.hrefFrom === "published" ? linkHref(r.href)
        : (/^https?:[/][/]|^[/.#]/.test(r.href) ? r.href : "");
      var name = h ? '<a href="' + esc(h) + '">' + esc(r.title) + "</a>" : esc(r.title);
      return '<tr data-fo-key="' + esc(r.key || r.id) + '" data-fo-status="' + r.status + '">' +
        "<td>" + name + '<br><code class="muted">' + esc(r.id) + "</code></td>" +
        "<td>" + STATUS[r.status] + "</td>" +
        "<td>" + (r.shown === null ? '<span class="muted">not in your folio</span>'
                  : r.shown ? "on the glass" : '<span class="muted">shelved</span>') + "</td>" +
        '<td class="muted">' + esc(r.source || r.declaredIn || "") + "</td></tr>";
    }).join("") + "</tbody></table>";
}
function loadPublished() {
  return fetch(stamped(DATA_HREF), { cache: "no-store" })
    .then(function(r){ if(!r.ok) throw new Error(r.status + " " + r.statusText); return r.text(); })
    .then(function(t){
      publishedError = null;
      if (t === publishedText) return;
      var G = JSON.parse(t);
      publishedText = t;
      published = G;
      renderPublished(G);
    })
    .catch(function(e){
      publishedError = e;
      if (published) return;
      /* COULD NOT LOAD IS NOT EMPTY, and the page says which. */
      $("nodes").innerHTML = '<p class="empty">The projection at <code>' + esc(DATA_HREF) +
        "</code> could not be read: " + esc(e.message) +
        ". That is not an empty folio \u2014 it is a folio that could not be loaded.</p>";
    })
    .then(renderMerged);
}
renderMerged();
loadPublished();
window.addEventListener("storage", function(ev){ if (ev.key === null || ev.key === FOLIO_KEY) renderMerged(); });
document.addEventListener("fa:folio-changed", renderMerged);
document.addEventListener("visibilitychange", function(){ if (document.visibilityState === "visible") loadPublished(); });
window.addEventListener("pageshow", function(ev){ if (ev.persisted) loadPublished(); });

function renderPublished(G){
  $("badges").innerHTML =
    '<span class="badge"><b>' + G.nodes.length + "</b> stick" + (G.nodes.length===1?"y":"ies") + "</span>" +
    '<span class="badge"><b>' + G.directories.length + "</b> declared director" +
    (G.directories.length===1?"y":"ies") + "</span>";

  /* A DECLARED-BUT-ABSENT DIRECTORY GETS A ROW. Omitting it is the dh4f
     shape: a consumer scans nothing and reports a clean run over it. */
  $("dirs").innerHTML = '<h2 id="fo-dirs-head">Declared folio directories</h2>' +
    '<table aria-label="Declared folio directories" aria-labelledby="fo-dirs-head">' +
    '<caption>Declared folio directories</caption>' +
    '<thead><tr><th>declared directory</th><th>state</th><th>stickies</th></tr></thead><tbody>' +
    G.directories.map(function(d){
      return "<tr><td><code>" + esc(d.dir) + "</code></td><td>" +
        (d.present ? "present" : '<span class="pill warn">declared, absent</span>') +
        "</td><td>" + d.nodes + "</td></tr>";
    }).join("") + "</tbody></table>";

  /* THE 'LIST' VIEW (bean ohx6): the folio as the files it holds, the same
     list the harness's own page (folio/index.md) renders. Drawn before the
     node table so it shows even when the folio has no stickies. */
  $("files").innerHTML = '<h2 id="fo-files-head">List view: files</h2>' +
    G.directories.map(function(d){
      var files = d.files || [];
      if (!d.present) return '<p class="empty"><code>' + esc(d.dir) + "</code> is declared but absent, so it holds no files.</p>";
      if (files.length === 0) return '<p class="empty"><code>' + esc(d.dir) + "</code> holds no files.</p>";
      return '<table aria-label="Files in ' + esc(d.dir) + '" aria-labelledby="fo-files-head">' +
        "<caption>Files in <code>" + esc(d.dir) + "</code></caption>" +
        "<thead><tr><th>file</th><th>size</th></tr></thead><tbody>" +
        files.map(function(f){ return "<tr><td><code>" + esc(f.path) + '</code></td><td class="muted">' + esc(f.size) + "</td></tr>"; }).join("") +
        "</tbody></table>";
    }).join("");

  if (G.nodes.length === 0) {
    $("nodes").innerHTML = '<h2 id="fo-nodes-head">Folio nodes</h2>' +
      '<p class="empty">No stickies. That is a folio graph with no nodes, ' +
      "not a graph that could not be read \\u2014 the directories above say which were found.</p>";
    return;
  }

  $("nodes").innerHTML = '<h2 id="fo-nodes-head">Folio nodes</h2>' +
    '<table aria-label="Folio nodes" aria-labelledby="fo-nodes-head">' +
    '<caption>Folio nodes</caption>' +
    '<thead><tr><th>id</th><th>summary</th><th>anchor</th>' +
    "<th>theme</th><th>declared in</th><th>links</th><th>prose</th></tr></thead><tbody>" +
    G.nodes.map(function(n){
      return "<tr>" +
        "<td><code>" + esc(n.id) + "</code></td>" +
        "<td>" + esc(n.summary) + "</td>" +
        "<td>" + (n.anchor ? "<code>" + esc(n.anchor) + "</code>"
                           : '<span class="muted">none</span>') + "</td>" +
        "<td>" + (n.theme ? esc(n.theme) : '<span class="muted">none</span>') + "</td>" +
        '<td><code class="muted">' + esc(n.declaredIn || "\\u2014") + "</code></td>" +
        "<td>" + (n.links.length
          ? '<div class="links">' + n.links.map(function(l){
              var h = linkHref(l.href);
              return h ? '<a class="link-pill" href="' + esc(h) + '">' + esc(l.label) + "</a>"
                       : '<span class="link-pill muted">' + esc(l.label) + "</span>";
            }).join("") + "</div>"
          : '<span class="muted">none</span>') + "</td>" +
        '<td class="muted">' + n.chars.toLocaleString() + " chars</td>" +
      "</tr>";
    }).join("") + "</tbody></table>";
}
</script>`,
  });
}

/** HTML-escape text placed in the page at generate time. */
function escText(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One layer's folio graph: its declared name and its folio directories. */
export interface FolioSubject {
  name: string;
  dirs: string[];
}

/**
 * Every layer in the checkout holding a folio directory, EXCEPT the
 * directories the visualiser names by id (`covers`) on its declarer — those
 * are the full view's. Read from the resolved checkout, so a new layer
 * declaring a folio graph gets its page with no edit here.
 */
export function folioSubjects(
  dirs: ReadonlyArray<{ id: string; absPath: string; declaredBy: string; member?: string; graphTypologies: readonly string[] }>,
  handler: string,
  coversById: readonly string[],
): FolioSubject[] {
  const out = new Map<string, FolioSubject>();
  for (const d of dirs) {
    if (!d.graphTypologies.includes("folio")) continue;
    if (d.declaredBy === handler && coversById.includes(d.id)) continue;
    const name = d.member ?? d.declaredBy;
    const s = out.get(name) ?? { name, dirs: [] };
    if (!s.dirs.includes(d.absPath)) s.dirs.push(d.absPath);
    out.set(name, s);
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

let stale = 0;
/**
 * The viewer `emit`, for the projection and the page alike. No `nav` since
 * 2026-10-07: the page is themed, so the theme's sidebar is its navigation
 * and there is no rail to inject.
 */
const emit = makeEmit({ check, onStale: () => { stale++; } });

if (import.meta.main) {
  const repoRoot = repoRootFor(ROOT);
  const g = readFolioGraph([ROOT, repoRoot], repoRoot);
  if (g === null) {
    console.log("  · no folio directory is declared — nothing to publish");
    process.exit(0);
  }

  const site = siteTarget(join(ROOT, siteDirFor(ROOT)));
  const seg = basename(g.directories[0]!.dir);
  const handler = readDeclaration(ROOT)?.name;
  if (!handler) {
    console.log("  · this instance declares no name — no handler segment to publish under");
    process.exit(0);
  }

  // A MOUNTED HARNESS'S PAGES ARE NOT THIS CHECKOUT'S TO JUDGE. Here the
  // full view reads this checkout's folio directories too, and its links
  // resolve against this site's host, so what it computes describes the
  // checkout, never the bytes the harness committed at its pin: every
  // downstream read them as stale (dth-sc, smart-immunizations-uganda,
  // 2026-11-15), and nothing a downstream does can make them current. The
  // harness's own repository checks them; a downstream builds them at
  // publish. A lower layer never waits on a higher one.
  if (check && mountedInstances(checkoutRootFor(ROOT)).has(handler)) {
    console.log(`  · ${handler} is a mounted layer here: its folio pages are checked in its own repository and built at this site's publish`);
    process.exit(0);
  }

  // THE ROUTE IS DECLARED (owner, 2026-10-09): `<locale>/<harness>/<id>/`, from the
  // visualiser this harness declares `renderedBy` this Tool — never composed
  // here from the directory's name.
  const route = declaredPageRoute(ROOT, VIEWER_TOOL);
  if (route === undefined) {
    console.log(`  · no visualiser declared rendered by ${VIEWER_TOOL} — nothing to publish`);
    process.exit(0);
  }

  const { pageDir, dataDir, dataHref } = viewerPlacement(site, route, seg);

  emit(join(dataDir, "index.json"), JSON.stringify(projection(g), null, 2) + "\n");
  // The page names the Tool that drew it; the route is the declaration's.
  emit(join(pageDir, "index.html"), withRenderedByFrontMatter(viewerHtml(dataHref), VIEWER_TOOL));

  // PER-INSTANCE PAGES (bean `folio-assistant-1nu0`), for a visualiser that
  // asks for them. A page built at publish has no committed bytes for
  // `--check` to compare, so it is skipped there and written otherwise.
  const decl = readDeclaration(ROOT);
  const vis = (decl?.visualisers ?? []).find((v) => v.renderedBy === VIEWER_TOOL);
  const builtHere = (p: string): boolean =>
    isBuiltAtPublish(decl?.builtAtPublish ?? [], relative(ROOT, p).split(sep).join("/"));
  const subjects =
    vis?.subgraphs === "instance" ? folioSubjects(checkoutDirectories(ROOT), handler, vis.covers ?? []) : [];
  for (const sub of subjects) {
    const subPage = join(pageDir, sub.name);
    const subData = join(dataDir, sub.name);
    const subHref = relative(subPage, join(subData, "index.json")).split(sep).join("/");
    const sg = readFolioDirs(sub.dirs, repoRoot);
    if (check && builtHere(join(subPage, "index.html"))) continue;
    emit(join(subData, "index.json"), JSON.stringify(projection(sg), null, 2) + "\n");
    emit(join(subPage, "index.html"), withRenderedByFrontMatter(viewerHtml(subHref, sub.name), VIEWER_TOOL));
  }
  // ORPHANS: a page this viewer drew for a layer that no longer holds a
  // folio graph. Only a page that names this Tool as its renderer is touched.
  const drawn = new Set(subjects.map((x) => x.name));
  const orphans = existsSync(pageDir)
    ? readdirSync(pageDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !drawn.has(e.name))
        .map((e) => e.name)
        .filter((n) => {
          const f = join(pageDir, n, "index.html");
          return existsSync(f) && renderedByOf(readFileSync(f, "utf-8")) === VIEWER_TOOL;
        })
    : [];
  for (const n of orphans) {
    if (check && builtHere(join(pageDir, n, "index.html"))) continue;
    console.error(`  ${check ? "!" : "-"} orphan instance page ${check ? "" : "removed "}${relative(site, join(pageDir, n))}`);
    if (check) stale++;
    else {
      rmSync(join(pageDir, n), { recursive: true });
      rmSync(join(dataDir, n), { recursive: true, force: true });
    }
  }

  const absent = g.directories.filter((d) => !d.present).length;
  console.log(
    `  ${g.nodes.length} sticky(ies) across ${g.directories.length} declared director(ies)` +
      (absent ? `, ${absent} declared but absent` : "") +
      (subjects.length ? `; ${subjects.length} instance page(s): ${subjects.map((x) => x.name).join(", ")}` : ""),
  );
  if (check && stale > 0) {
    console.error(`\n${stale} artefact(s) stale — run \`bun run cat folio:viz\``);
    process.exit(1);
  }
}
