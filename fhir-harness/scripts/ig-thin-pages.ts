/**
 * The THIN artefact page: one IG artefact's rendering, a few KB of identity
 * and a pointer, drawn in the browser from the artefact's JSON-LD node.
 *
 * @module fhir-harness/scripts/ig-thin-pages
 * @covers ig-pages, ig-artifact-jsonld
 *
 * ## Why
 *
 * The owner's ruling of 2026-10-11, option A (paraphrased): FHIR IG output
 * should look like the SMART IG sites' — tiny HTML that loads its content
 * dynamically from the JSON(-LD) knowledge graph. A full artefact page (`gen-ig-pages.ts` without
 * `--thin`) is a just-the-docs page of about 170-230 KB, of which 5-8 KB is
 * the artefact; the rest is the theme's chrome, written into every page
 * (`folio-assistant-gp2f`, #1885). This page carries none of it: the rail is
 * LINKED (`NAVBAR_LINKED`, which the build's rail pass honours), and the
 * content is the node's.
 *
 * ## The helper is reused, not copied
 *
 * {@link thinPageHtml} is cat-harness-tools' (`scripts/thin-page.ts`), the one
 * the OpenAPI operation pages and the library entries follow. fhir-harness may
 * import it: this layer `needs` folio-assistant-core, which sits above
 * cat-harness-tools, so the import runs down the layer order
 * (`check:import-direction`), as `gen-ig-pages.ts`' imports of
 * `route-authority.ts` and `viewer-declarations.ts` already do.
 *
 * ## The address stays the Publisher's
 *
 * `artifact/<Type>-<id>.html`, the file the full page was: the IG's artifacts
 * page, its narrative's links (`ast-pages.json`) and the footer's reading
 * order all name it. So the page passes its file name as `canonical` rather
 * than the helper's `./`.
 *
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 */
import { KG_RENDER_ASSET, escHtml, nodeAttrs, pageNodeOf, thinPageHtml, type PageNode, type Prefixes } from "../../cat-harness-tools/scripts/thin-page.ts";
import { PAGE_BAR_CLASS, PAGE_FOOT_CLASS, PAGE_MAIN_CLASS } from "../../cat-harness-tools/scripts/page-layout.ts";
import type { FhirArtifact, FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";
import { ARTIFACT_DIR, artifactPageName, localResourceHref } from "./ig-artifact-jsonld.ts";
import { igSearchBox, igSearchScript, type IgSearchRef } from "./ig-search.ts";

/**
 * The config block's id of a thin artefact page from before it declared its
 * node (cat-harness-tools#1830): a run still recognises one, to replace it.
 */
export const THIN_PAGE_CONFIG_ID = "ig-artifact-page";
/** FHIR RDF's namespace: an artefact page's node is typed `fhir:<resourceType>`, as its JSON-LD node is. */
export const FHIR_NS = "http://hl7.org/fhir/";
export const ARTIFACT_PREFIXES: Prefixes = { fhir: FHIR_NS };
/** The generic renderer, under the docs root (cat-harness-tools `KG_RENDER_ASSET`). */
export const THIN_PAGE_RENDERER = KG_RENDER_ASSET;

/**
 * The node an artefact's page renders: its IRI is the page's own address
 * without `.html` (`ig-artifact-jsonld.ts`), written relative to the page so
 * it is the same node wherever the site is served.
 */
export function artifactPageNode(a: Pick<FhirArtifact, "resourceType" | "id">): PageNode {
  return { iri: artifactPageName(a), types: [`fhir:${a.resourceType}`] };
}

/** Is this an artefact's thin page — by the FHIR node it declares, not by its name or a config block? */
export function isArtifactPage(html: string): boolean {
  return pageNodeOf(html)?.rdfa.some((n) => n.types.some((t) => t.startsWith(FHIR_NS))) ?? false;
}

/**
 * What an artefact's page tells its renderer, read back from the page, in the
 * shape its config block had (`node`, `view`, `astLoader`, `sidecars`, ...):
 * the same reading `ig-artifact.js` makes. Undefined for any other page.
 */
export function artifactPageConfigOf(html: string): Record<string, unknown> | undefined {
  if (!isArtifactPage(html)) return undefined;
  const unesc = (v: string) => v.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const main = /<main\b[^>]*\stypeof="[^"]*"[^>]*>/.exec(html)?.[0] ?? "";
  const d: Record<string, string> = {};
  for (const m of main.matchAll(/\sdata-kg-([a-z-]+)="([^"]*)"/g)) d[m[1]!] = unesc(m[2]!);
  const alt = /<link rel="alternate" type="application\/ld\+json" href="([^"]*)">/.exec(html)?.[1];
  const cfg: Record<string, unknown> = { ...(alt ? { node: unesc(alt) } : {}) };
  const plain: Record<string, string> = { view: "view", home: "home", toc: "toc", footer: "footer", prev: "prev", next: "next", resource: "resource", pages: "pages", index: "index", definitions: "definitions", published: "published", astLoader: "ast-loader" };
  for (const [k, a] of Object.entries(plain)) if (d[a] !== undefined) cfg[k] = d[a];
  if (d.views) cfg.views = d.views.split(/\s+/);
  if (d["sidecar-jsonld"] || d["sidecar-schema"]) cfg.sidecars = { ...(d["sidecar-jsonld"] ? { jsonld: d["sidecar-jsonld"] } : {}), ...(d["sidecar-schema"] ? { schema: d["sidecar-schema"] } : {}) };
  if (d["history-versions"]) cfg.history = { versions: d["history-versions"], repository: d["history-repository"], resourceType: d["history-type"], id: d["history-id"] };
  return cfg;
}

/** `data-kg-<name>="value"` for each set value, in order: the page's identity for the renderer. */
function dataAttrs(d: Record<string, string | undefined>): string {
  return Object.entries(d)
    .filter((e): e is [string, string] => e[1] !== undefined)
    .map(([k, v]) => ` data-kg-${k}="${escHtml(v)}"`)
    .join("");
}
/** The shared renderer and its stylesheet, under the docs root. */
export const THIN_PAGE_SCRIPT = "assets/ig-artifact.js";
export const THIN_PAGE_STYLE = "assets/ig-artifact.css";

export interface ThinArtifactOptions {
  /** The IG's display name. */
  label: string;
  /** The IG's home, relative to an artefact page. */
  home: string;
  /** The artefact index page, relative to an artefact page. */
  all: string;
  /** The table of contents, relative to an artefact page, when the site has one. */
  toc?: string;
  /** The reading order's neighbours, relative to the page. */
  prev?: string;
  next?: string;
  /** `gen-ig-pages --compiled-data`. */
  compiledData?: string;
  /**
   * The resource's JSON as this site serves it, relative to the page, when
   * there is no compiled copy: the Publisher's own `<Type>-<id>.json`, which
   * an IG repository's site carries as data (`gen-ig-pages --publisher-data`).
   * The page's views draw from it. Absent: the node's own local copy, or none.
   */
  resource?: string;
  /** The artefact's views, its own page first ({@link artifactTabs}). Absent or one: no tab bar. */
  tabs?: readonly ArtifactTab[];
  /**
   * The IG API sidecars the `jsonld` and `schema` views draw, relative to the
   * page: the served copies under `fhir-artifact-index/sidecars/`.
   */
  sidecars?: Partial<Record<SidecarView, string>>;
  /**
   * The History view's data (fhir-harness#329): the AST versions the site
   * serves, relative to the page, and the `owner/repo` whose cache branch
   * holds them, read by raw URL at each version's commit.
   */
  history?: { versions: string; repository: string };
  /** The index node, relative to the page: the examples view finds what claims a profile there. */
  index?: string;
  /** The IG's search (`ig-search.ts`), relative to the page, when the site serves it: the header carries its box. */
  search?: IgSearchRef;
}

/**
 * THE TAB VIEWS (owner, 2026-10-14, answering whether the IG Publisher's
 * per-artefact tab views are rendered: *"3. Render them too"*; and *"I DO NOT
 * WANT THE IG PUBLISHER HTML"*). Each is a thin page beside the artefact's
 * own, at the file name the Publisher gives its tab, so a link written for
 * the Publisher's layout lands once it is pointed at `artifact/`. The view is
 * drawn by the one shared renderer from the resource's JSON; nothing of the
 * Publisher's HTML is read.
 *
 * - `definitions`: the element table, from the StructureDefinition's snapshot
 *   (its differential where it has no snapshot);
 * - `mappings`: the StructureDefinition's `mapping` declarations, each with
 *   the elements that map to it;
 * - `json`: the resource's JSON, by the shared AST loader (`ast-resource.js`).
 *   The Publisher names a profile's `<…>.profile.json.html` and any other
 *   resource's `<…>.json.html`;
 * - `examples`: the IG's artefacts that claim the profile (`meta.profile`),
 *   read off the index node. Written for EVERY StructureDefinition, as the
 *   Publisher writes it; where nothing claims the profile the page says there
 *   are no examples (owner, 2026-10-14: "1a").
 *
 * Not rendered: the change history, testing and XML/Turtle views, and the
 * Publisher's `comparison-v*` directories.
 */
export type ArtifactView = "content" | "definitions" | "mappings" | "json" | "jsonld" | "schema" | "examples" | "history";
/** The views drawn from an IG API sidecar rather than the resource (`ig-api-views.ts`). */
export type SidecarView = "jsonld" | "schema";

export interface ArtifactTab {
  view: ArtifactView;
  label: string;
  /** The page's file name, in the artefact pages' directory: the Publisher's name for the view, kept as a redirect stub. */
  file: string;
  /** Where the view is drawn: the artefact's one page, with `?view=` for any view but its content. */
  href: string;
}

const TAB_LABEL: Record<ArtifactView, string> = { content: "Content", definitions: "Detailed Descriptions", mappings: "Mappings", json: "JSON", jsonld: "JSON-LD", schema: "JSON Schema", examples: "Examples", history: "History" };

/** The file name the Publisher gives an artefact's view, which the site keeps (as a redirect stub for any view but content). */
export function artifactTabFile(a: Pick<FhirArtifact, "resourceType" | "id">, view: ArtifactView): string {
  const stem = artifactPageName(a);
  switch (view) {
    case "content":
      return `${stem}.html`;
    case "json":
      return a.resourceType === "StructureDefinition" ? `${stem}.profile.json.html` : `${stem}.json.html`;
    case "jsonld":
      return `${stem}.jsonld.html`;
    case "schema":
      return `${stem}.schema.json.html`;
    default:
      return `${stem}-${view}.html`;
  }
}

/**
 * Where a view is drawn (owner, 2026-11-10, fhir-harness#325 step 3: "thin
 * page w/ dynamic load"): the artefact's ONE page, the view named in its
 * query. One shell per artefact, not one per view.
 */
export function artifactViewHref(a: Pick<FhirArtifact, "resourceType" | "id">, view: ArtifactView): string {
  const page = artifactTabFile(a, "content");
  return view === "content" ? page : `${page}?view=${view}`;
}

/**
 * The views an artefact gets, its own page first. The resource's views need
 * a resource the pages can read; the sidecar views (`jsonld`, `schema`) need
 * the sidecar served. None of either: no tabs. Deterministic.
 */
export function artifactTabs(a: Pick<FhirArtifact, "resourceType" | "id">, o: { resource: boolean; sidecars?: readonly SidecarView[]; history?: boolean }): ArtifactTab[] {
  const side = (["jsonld", "schema"] as const).filter((v) => o.sidecars?.includes(v));
  if (!o.resource && side.length === 0) return [];
  const sd = a.resourceType === "StructureDefinition";
  const views: ArtifactView[] = ["content", ...(o.resource && sd ? (["definitions", "mappings"] as const) : []), ...(o.resource ? (["json"] as const) : []), ...side, ...(o.resource && sd ? (["examples"] as const) : []), ...(o.resource && o.history ? (["history"] as const) : [])];
  return views.map((view) => ({ view, label: TAB_LABEL[view], file: artifactTabFile(a, view), href: artifactViewHref(a, view) }));
}

/** The tab bar, as static HTML: every view is a plain link to the one page; the renderer marks the current one. */
function tabBar(tabs: readonly ArtifactTab[] | undefined, current: ArtifactView): string {
  if (!tabs || tabs.length < 2) return "";
  const links = tabs.map((t) => `<a href="${escHtml(t.href)}" data-view="${t.view}"${t.view === current ? ' aria-current="page"' : ""}>${escHtml(t.label)}</a>`);
  return `<nav class="iga-tabs" aria-label="Views of this artefact">${links.join("")}</nav>`;
}

/**
 * The page at a view's old file name (`<Type>-<id>.json.html`,
 * `-definitions.html`, `.jsonld.html`, ...): a redirect stub to the
 * artefact's one page with that view, so a link or bookmark to the
 * Publisher's tab name still lands. The script carries a `#fragment` across
 * (an element on the definitions view); the meta refresh is the fallback
 * without scripts. It declines the rail and has no `<body>` tag, so the
 * platform's injectors leave it bare and it stays a few hundred bytes (the
 * first preview build measured 8 KB stubs, banner and chrome injected into a
 * stub with a body). Deterministic.
 */
export function thinViewRedirect(a: Pick<FhirArtifact, "resourceType" | "id">, view: ArtifactView): string {
  const to = artifactViewHref(a, view);
  const t = escHtml(to);
  const js = JSON.stringify(to).replace(/</g, "\\u003c");
  return (
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${escHtml(TAB_LABEL[view])} — ${escHtml(artifactPageName(a))}</title>\n` +
    `<link rel="canonical" href="${t}">\n` +
    `<script>location.replace(${js} + location.hash);</script>\n` +
    `<meta http-equiv="refresh" content="0; url=${t}"><meta name="robots" content="noindex"><meta name="folio-navbar" content="none">\n` +
    // No <body> tag: the platform's injectors (the staging banner, the rail)
    // place their markup after one, and count a meta-refresh page without one
    // as a forwarding stub. The link still renders, in the implied body.
    `</head>\n<p>This view is at <a href="${t}">${t}</a>.</p></html>\n`
  );
}

/** The thin page for one artefact, as `artifact/<Type>-<id>.html`. Deterministic. */
export function thinArtifactPage(ix: FhirArtifactIndex, a: FhirArtifact, o: ThinArtifactOptions): string {
  return thinArtifactView(ix, a, "content", o);
}

/**
 * The thin page of one of an artefact's views ({@link ArtifactView}): the
 * artefact's own page for `content`, else a tab page at the Publisher's file
 * name for that tab ({@link artifactTabFile}). The same shell, config block
 * and renderer as the artefact's page; the config's `view` says what to draw.
 * Deterministic.
 */
export function thinArtifactView(ix: FhirArtifactIndex, a: FhirArtifact, view: ArtifactView, o: ThinArtifactOptions): string {
  const name = a.title ?? a.name ?? a.id;
  const node = `${artifactPageName(a)}.jsonld`;
  const local = localResourceHref(a, o.compiledData) ?? o.resource;
  const html = a.published.html?.url;
  const tab = view === "content" ? undefined : TAB_LABEL[view];
  // The page's identity for the renderer, on the element that declares the
  // node: what to draw and where its data is. The node itself is the head's
  // `alternate`. Nothing of the artefact's content is written here.
  const shows = o.tabs?.map((t) => t.view) ?? [];
  const data = dataAttrs({
    ...(view === "content" ? {} : { view }),
    home: o.home,
    toc: o.toc,
    footer: "../assets/ig-footer.json",
    // The reading order runs through the artefacts' own pages, not their tabs.
    prev: view === "content" ? o.prev : undefined,
    next: view === "content" ? o.next : undefined,
    // The resource this site serves, when the node names no local copy of it.
    resource: o.resource && !localResourceHref(a, o.compiledData) ? o.resource : undefined,
    // The AST loader and the list of this site's own pages, which it uses to
    // keep a narrative link that names one of them.
    "ast-loader": local ? "../assets/ast-resource.js" : undefined,
    pages: local ? "../assets/ast-pages.json" : undefined,
    // The views this one page draws (`?view=`), and what the views beyond the
    // content need: the index for examples, the sidecars, the definitions view
    // a mapping row links its element on.
    views: shows.length > 1 ? shows.join(" ") : undefined,
    index: o.index && (view === "examples" || shows.includes("examples")) ? o.index : undefined,
    "sidecar-jsonld": o.sidecars?.jsonld,
    "sidecar-schema": o.sidecars?.schema,
    ...(o.history && shows.includes("history") ? { "history-versions": o.history.versions, "history-repository": o.history.repository, "history-type": a.resourceType, "history-id": a.id } : {}),
    definitions: view === "mappings" || shows.includes("mappings") ? artifactViewHref(a, "definitions") : undefined,
    // Where the narrative's other relative links go: the published IG, read
    // off this artefact's own published page. None: they lose their href.
    published: html ? html.slice(0, html.lastIndexOf("/") + 1) : undefined,
  });
  const noscript =
    `<p>This page draws ${tab ? `the ${escHtml(tab.toLowerCase())} of ` : ""}${escHtml(a.key)} from <a href="${escHtml(node)}">its JSON-LD node</a>` +
    (local ? ` and <a href="${escHtml(local)}">the resource's JSON</a>` : "") +
    `; it needs JavaScript to draw them. <a href="${escHtml(o.all)}">All ${ix.count} artefacts</a>.</p>`;
  return thinPageHtml({
    title: `${name}${tab ? ` — ${tab}` : ""} — ${o.label}`,
    jsonld: node,
    canonical: artifactTabFile(a, view),
    script: `../${THIN_PAGE_SCRIPT}`,
    renderer: `../${THIN_PAGE_RENDERER}`,
    node: artifactPageNode(a),
    prefixes: ARTIFACT_PREFIXES,
    // The shared page layout (width, bar, scrolling), then the IG's look.
    layout: "../",
    stylesheet: `../${THIN_PAGE_STYLE}`,
    // Identity only — what a link preview, a search engine and a reader
    // without JavaScript need — and the tab bar, plain links between the
    // artefact's views. Everything else is the node's and the resource's.
    body:
      `<header class="iga-top ${PAGE_BAR_CLASS}"><a class="iga-home" href="${escHtml(o.home)}">${escHtml(o.label)}</a>` +
      `<a href="${escHtml(o.all)}">all ${ix.count} artefacts</a>${o.search ? igSearchBox(o.search, o.label) : ""}</header>\n` +
      `<main class="iga ${PAGE_MAIN_CLASS}"${nodeAttrs(artifactPageNode(a))}${data}><h1>${escHtml(name)}${tab ? ` <span class="iga-view">— ${escHtml(tab)}</span>` : ""}</h1><p class="iga-key"><code>${escHtml(a.key)}</code></p>` +
      tabBar(o.tabs, view) +
      `<div class="iga-body" aria-live="polite"><p class="iga-state">Loading the artefact…</p></div></main>\n` +
      `<footer id="ig-footer" class="${PAGE_FOOT_CLASS}"></footer>`,
    noscript,
    ...(o.search ? { tail: igSearchScript(o.search) } : {}),
  });
}

/** The page's path under the docs root. */
export const thinArtifactPath = (a: FhirArtifact): string => `${ARTIFACT_DIR}/${artifactPageName(a)}.html`;

/** The config block's id of a thin IG-level list page (`artifacts`, `toc`). */
export const THIN_INDEX_CONFIG_ID = "ig-index-page";

/**
 * A thin IG-level page that LISTS the artefacts, drawn from the one index
 * node (`artifact/index.jsonld`, `ig-artifact-jsonld.ts`) rather than written
 * into the page: the IG's `artifacts.html` (`view: "artifacts"`, every
 * category OPEN — the owner could not find artefacts behind collapsed ones,
 * 2026-10-12) and its `toc.html` (`view: "toc"`: the IG's own pages, which
 * are the page's structure and stay in its HTML as `outline`, then every
 * artefact under its category). Written by `build-ig-site.ts`, which owns
 * both pages, at the addresses the full pages had. Every href is relative
 * to the page.
 */
export interface ThinIndexOptions {
  view: "artifacts" | "toc";
  /** The page's own heading, plain text. */
  heading: string;
  /** The IG's display name. */
  label: string;
  /** The page's file name, for `rel="canonical"`. */
  canonical: string;
  /** The index node. */
  index: string;
  /** The directory of the artefact pages, ending in `/`. */
  pagesHref: string;
  /** The docs root holding `assets/`, `""` or ending in `/`. */
  assets: string;
  /** The IG's home, its artifacts page and its table of contents. */
  home: string;
  artifacts: string;
  toc: string;
  /** The reading order's neighbours. */
  prev?: string;
  next?: string;
  /** HTML the caller built and escaped: the IG's own pages, for the toc. */
  outline?: string;
  /** The IG's search (`ig-search.ts`), relative to the page, when the site serves it: the header carries its box. */
  search?: IgSearchRef;
}

/** The thin `artifacts` or `toc` page. Deterministic. */
export function thinIndexPage(o: ThinIndexOptions): string {
  const config: Record<string, unknown> = {
    view: o.view,
    index: o.index,
    // What a description's relative links are relative to: the IG's docs root.
    root: o.assets,
    pages: o.pagesHref,
    home: o.home,
    artifacts: o.artifacts,
    toc: o.toc,
    footer: `${o.assets}assets/ig-footer.json`,
    ...(o.prev ? { prev: o.prev } : {}),
    ...(o.next ? { next: o.next } : {}),
  };
  const lead = o.view === "artifacts" ? "This page lists the FHIR artifacts defined as part of this implementation guide." : "";
  return thinPageHtml({
    title: `${o.heading} — ${o.label}`,
    jsonld: o.index,
    canonical: o.canonical,
    script: `${o.assets}${THIN_PAGE_SCRIPT}`,
    layout: o.assets,
    stylesheet: `${o.assets}${THIN_PAGE_STYLE}`,
    configId: THIN_INDEX_CONFIG_ID,
    config,
    body:
      `<header class="iga-top ${PAGE_BAR_CLASS}"><a class="iga-home" href="${escHtml(o.home)}">${escHtml(o.label)}</a>` +
      `<a href="${escHtml(o.artifacts)}">Artifacts</a><a href="${escHtml(o.toc)}">Table of Contents</a>${o.search ? igSearchBox(o.search, o.label) : ""}</header>\n` +
      `<main class="iga igi ${PAGE_MAIN_CLASS}"><h1>${escHtml(o.heading)}</h1>${lead ? `<p>${lead}</p>` : ""}${o.outline ?? ""}` +
      `<div class="iga-body" aria-live="polite"><p class="iga-state">Loading the artefact index…</p></div></main>\n` +
      `<footer id="ig-footer" class="${PAGE_FOOT_CLASS}"></footer>`,
    noscript:
      `<p>The artefacts on this page are drawn from <a href="${escHtml(o.index)}">the IG's artefact index</a>; ` +
      `it needs JavaScript to draw them. Each artefact's page is <code>${escHtml(o.pagesHref)}&lt;Type&gt;-&lt;id&gt;.html</code>.</p>`,
    ...(o.search ? { tail: igSearchScript(o.search) } : {}),
  });
}
