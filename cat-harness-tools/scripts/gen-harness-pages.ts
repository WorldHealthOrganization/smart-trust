#!/usr/bin/env bun
/**
 * One overview page for every harness a site is built on.
 *
 * @module scripts/gen-harness-pages
 * @covers none — a page writer over the site's harness data and its checkout; it judges no graph
 * @graphNode none — a generator, not a schema
 *
 * Owner, 2026-11-13, on the navbar's Harnesses panel: *"links under harnesses
 * inconsistent… should be page that give an overview of how the particular
 * harness is being used and linked back to the harnesses documentation and
 * knowledge graph."*
 *
 * | page | shows |
 * |---|---|
 * | `/<locale>/<host>/harness/` | every harness of this site, with its role and pin |
 * | `/<locale>/<host>/harness/<layer>/` | how this site uses that harness |
 * | `…/<layer>/index.jsonld` | the same page as JSON-LD, its `@id` the page's IRI |
 *
 * A harness's page says, from the checkout the site is built from:
 *
 * - its role here: the site's own harness, instantiated here, or a layer the
 *   site is built on, and which harnesses need it;
 * - the version it declares and the commit `index.lock.json` pins it at;
 * - the content types it supplies that this site uses (an `index.config.json`
 *   `contentTypes` section, or a layer whose config names the type), with the
 *   paths such a section lists;
 * - the folders it declares, each with its graph typologies, local or remote,
 *   and the opt-in groups among them, each on or off for this checkout;
 * - links to its own documentation (the platform's page for it, its source
 *   repository at the pinned commit) and to its knowledge graph (its
 *   declaration's node page and its graph views on this site, its IRI base).
 *
 * The navbar's Harnesses panel links each row here (`lib/harness-overview.ts`).
 * Written on the BUILT site, after the node-kind pages (whose declaration
 * pages it links) and before the rail pass (which rails these pages and links
 * the panel to them): `build-instance-site.ts` runs it.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-harness-pages.ts --root <checkout> --out <site> [--base-url <url>] [--commit <sha>]
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { DEFAULT_LOCALE } from "../schemas/content/translation.js";
import { DOCS_SITE_BASE } from "../schemas/kg/jsonld.ts";
import { findDeclarationFile } from "../schemas/kg/instance-roots.ts";
import { effectiveLayerConfig } from "../schemas/kg/harness-config.ts";
import { readIndexConfig } from "../schemas/kg/index-config.ts";
import { enabledSubgraphs } from "../schemas/kg/opt-in-subgraphs.ts";
import { harnessOverviewRoute, harnessOverviewsRoute } from "./lib/harness-overview.ts";
import { HARNESS_NAME } from "./lib/roots.ts";
import { darkRules } from "./lib/scheme-css.ts";

/** Marks a page this generator wrote. */
export const PAGE_MARK = "data-fa-harness-page";

/** The node kind whose pages show each layer's declaration (`gen-node-kind-pages.ts`). */
export const DECLARATION_KIND = `${HARNESS_NAME}-declaration`;

const esc = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One row of `_data/harness.json`, the fields this page reads. */
export interface HarnessDataRow {
  name: string;
  title?: string;
  label?: string;
  description?: string;
  href?: string | null;
  hrefKind?: "folio" | "section" | "viewer" | "handled";
  instantiated?: boolean;
  needs?: string[];
  visualisations?: { kind: string; label?: string; path?: string | null; note?: string; sameAs?: string; stagingOnly?: true }[];
  subgraphs?: { id: string; where?: "local" | "remote"; path?: string }[];
}

/** A link on the page. `href` is site-relative (no leading slash) unless `external`. */
export interface PageLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FolderRow {
  id: string;
  /** Checkout-relative, with a trailing slash. */
  path: string;
  kinds: string[];
  where?: "local" | "remote";
  /** Set when the folder is an opt-in group: its qualified id and whether this checkout switches it on. */
  optIn?: { id: string; enabled: boolean };
}

export interface ContentTypeRow {
  id: string;
  /** This site's `index.config.json` `contentTypes.<id>` section names it. */
  section: boolean;
  /** The paths that section's `include` lists, when it has one. */
  include: string[];
  /** The layers of this checkout whose config names the type. */
  layers: string[];
}

/** Everything one overview page shows, worked out from the checkout and the site. */
export interface HarnessOverview {
  name: string;
  label: string;
  description?: string;
  role: "site" | "instantiated" | "dependency";
  needs: string[];
  neededBy: string[];
  version?: string;
  /** The harness's IRI base, from its declaration. */
  iri?: string;
  repository?: string;
  pin?: { local: true; commit?: string } | { local: false; sha: string; repository: string; pinnedBy?: string; via?: string };
  docs: PageLink[];
  graphs: { label: string; href?: string; note?: string }[];
  /** Site-relative route of the declaration's node page, when the site holds it. */
  declarationPage?: string;
  contentTypes: ContentTypeRow[];
  folders: FolderRow[];
}

export interface OverviewInput {
  checkout: string;
  site: string;
  rows: readonly HarnessDataRow[];
  /** The checkout's own commit, for the local layer's pin. */
  commit?: string;
  /** The platform documentation site, with a trailing slash. */
  docsBase?: string;
  /** The opt-in groups switched on here; default: the checkout's own. */
  enabled?: ReadonlySet<string>;
}

type Declaration = {
  name?: string;
  title?: string;
  description?: string;
  version?: string;
  iriBase?: string;
  repository?: string;
  needs?: string[];
  directories?: { id?: string; path?: string; graphTypologies?: string[]; optIn?: boolean }[];
  contentAdapters?: { contentType?: string }[];
  contentTranslations?: { contentType?: string }[];
};

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

function declarationIn(dir: string): Declaration | undefined {
  const f = findDeclarationFile(dir);
  return f === undefined ? undefined : readJson<Declaration>(join(dir, f));
}

/** Where `name`'s declaration is in the checkout: the root for the checkout's own layer, else `<checkout>/<name>/`. */
export function layerDirOf(checkout: string, name: string): string | undefined {
  if (declarationIn(checkout)?.name === name) return checkout;
  const dir = join(checkout, name);
  return declarationIn(dir)?.name === name ? dir : undefined;
}

type LockEntry = { instance?: string; repository?: string; sha?: string; pinnedBy?: string; via?: string };

function lockEntries(checkout: string): LockEntry[] {
  const lock = readJson<{ instances?: LockEntry[] }>(join(checkout, "index.lock.json"));
  return Array.isArray(lock?.instances) ? lock.instances : [];
}

/** Does the built site hold a page (or file) at this site-absolute path? */
function siteHolds(site: string, path: string): boolean {
  const rel = path.replace(/^\/+/, "").split("#")[0]!;
  const at = join(site, rel);
  if (!existsSync(at)) return false;
  return statSync(at).isDirectory() ? existsSync(join(at, "index.html")) : true;
}

const uniq = (xs: readonly string[]): string[] => [...new Set(xs)];

/** Every overview, one per harness of `rows` that the checkout holds, in `rows`' order. */
export function buildOverviews(o: OverviewInput): HarnessOverview[] {
  const docsBase = o.docsBase ?? DOCS_SITE_BASE;
  const index = readIndexConfig(o.checkout);
  const config = index.state === "ok" ? index.config : undefined;
  const rootName = declarationIn(o.checkout)?.name;
  const siteHarnesses = new Set(config?.harnesses?.map((h) => h.name) ?? (rootName ? [rootName] : []));
  if (config?.site?.landing) siteHarnesses.add(config.site.landing);
  const enabled = o.enabled ?? enabledSubgraphs(o.checkout);
  const lock = lockEntries(o.checkout);

  // Which layer of this checkout names which content type in its config.
  const layerTypes = new Map<string, string>();
  for (const l of config?.instances ?? []) {
    let t: unknown = (l as Record<string, unknown>).contentType;
    try {
      t = effectiveLayerConfig(o.checkout, l.name)?.contentType ?? t;
    } catch {
      // An unreadable config is reported by the gates that read it; the inline field stands.
    }
    if (typeof t === "string") layerTypes.set(l.name, t);
  }

  const held = o.rows.filter((r) => layerDirOf(o.checkout, r.name) !== undefined);
  const names = new Set(held.map((r) => r.name));
  return held.map((r) => {
    const dir = layerDirOf(o.checkout, r.name)!;
    const decl = declarationIn(dir) ?? {};
    const label = r.label ?? r.title ?? decl.title ?? r.name;
    const role: HarnessOverview["role"] = siteHarnesses.has(r.name) ? "site" : r.instantiated === true ? "instantiated" : "dependency";
    const needs = (r.needs ?? decl.needs ?? []).filter((n) => names.has(n));
    const neededBy = held.filter((x) => (x.needs ?? []).includes(r.name)).map((x) => x.name);

    const locked = lock.find((e) => e.instance === r.name);
    const repository = locked?.repository ?? decl.repository;
    const pin: HarnessOverview["pin"] =
      dir === o.checkout
        ? { local: true, ...(o.commit ? { commit: o.commit } : {}) }
        : locked?.sha && locked.repository
          ? { local: false, sha: locked.sha, repository: locked.repository, ...(locked.pinnedBy ? { pinnedBy: locked.pinnedBy } : {}), ...(locked.via && locked.via !== r.name ? { via: locked.via } : {}) }
          : undefined;
    const ref = pin === undefined ? undefined : pin.local ? pin.commit : pin.sha;

    const docs: PageLink[] = [];
    if (role === "site" && dir === o.checkout) docs.push({ label: "This site's home page", href: "" });
    else if (r.href && r.href.startsWith("/")) {
      // A `viewer` href is one of its graphs on the platform's site, still the platform's page for it.
      const what = r.hrefKind === "viewer" ? `A graph view of ${label}` : label;
      docs.push({ label: `${what} on the platform documentation site`, href: `${docsBase}${r.href.slice(1)}`, external: true });
    }
    if (repository && /^[\w.-]+\/[\w.-]+$/.test(repository)) {
      const gh = `https://github.com/${repository}`;
      docs.push({ label: ref ? `Source repository at ${ref.slice(0, 12)}` : "Source repository", href: ref ? `${gh}/tree/${ref}` : gh, external: true });
      if (existsSync(join(dir, "README.md"))) docs.push({ label: "README", href: `${gh}/blob/${ref ?? "HEAD"}/README.md`, external: true });
      if (existsSync(join(dir, "AGENTS.md"))) docs.push({ label: "Agent guidance (AGENTS.md)", href: `${gh}/blob/${ref ?? "HEAD"}/AGENTS.md`, external: true });
    }

    const graphs = (r.visualisations ?? [])
      .filter((v) => v.sameAs === undefined)
      .map((v) => {
        const l = v.label ?? v.kind;
        // The data's path names the platform's viewer; on a layer's own site the
        // handler's route for this layer's graph is the page (as the rail's `ownSiteGraphs` reads it).
        const at = [v.path, `${DEFAULT_LOCALE}/${HARNESS_NAME}/${v.kind}/${r.name}/`].find((p): p is string => typeof p === "string" && siteHolds(o.site, p));
        if (at) return { label: l, href: at.replace(/^\/+/, "") };
        return { label: l, note: v.note ?? "not published on this site" };
      });
    const declRoute = `${DEFAULT_LOCALE}/${HARNESS_NAME}/${DECLARATION_KIND}/${r.name}/`;
    const declarationPage = siteHolds(o.site, declRoute) ? declRoute : undefined;

    const declaredTypes = uniq([...(decl.contentAdapters ?? []), ...(decl.contentTranslations ?? [])].map((x) => x.contentType).filter((x): x is string => typeof x === "string"));
    const contentTypes: ContentTypeRow[] = declaredTypes.map((id) => {
      const sec = config?.contentTypes?.[id];
      const include = Array.isArray(sec?.include) ? (sec.include as unknown[]).filter((x): x is string => typeof x === "string") : [];
      const layers = [...layerTypes].filter(([, t]) => t === id).map(([n]) => n);
      return { id, section: sec !== undefined, include, layers };
    });

    const where = new Map((r.subgraphs ?? []).map((s) => [s.id, s.where]));
    const folders: FolderRow[] = (decl.directories ?? [])
      .filter((d): d is { id: string; path: string; graphTypologies?: string[]; optIn?: boolean } => typeof d.id === "string" && typeof d.path === "string")
      .map((d) => {
        const rel = relative(o.checkout, join(dir, d.path)).split(sep).join("/");
        const q = `${r.name}.${d.id}`;
        const w = where.get(d.id);
        return {
          id: d.id,
          path: rel === "" ? "./" : `${rel.replace(/\/$/, "")}/`,
          kinds: d.graphTypologies ?? [],
          ...(w ? { where: w } : {}),
          ...(d.optIn === true ? { optIn: { id: q, enabled: enabled.has(q) } } : {}),
        };
      });

    return {
      name: r.name,
      label,
      ...(r.description ?? decl.description ? { description: (r.description ?? decl.description)! } : {}),
      role,
      needs,
      neededBy,
      ...(decl.version ? { version: decl.version } : {}),
      ...(decl.iriBase ? { iri: decl.iriBase } : {}),
      ...(repository ? { repository } : {}),
      ...(pin ? { pin } : {}),
      docs,
      graphs,
      ...(declarationPage ? { declarationPage } : {}),
      contentTypes,
      folders,
    };
  });
}

const ROLE_TEXT: Record<HarnessOverview["role"], string> = {
  site: "This site's own harness",
  instantiated: "Instantiated on this site",
  dependency: "A layer this site is built on",
};

const STYLE = `
  :root { color-scheme: light dark; --fg:#1b1b1b; --bg:#fdfdfb; --muted:#5b5b5b; --line:#d6d6d0; --link:#0b5cad; --panel:#f3f4f2; --on:#1d6b3a; --off:#8a4b00; }
  ${darkRules(":root { --fg:#e8e8e6; --bg:#161616; --muted:#a8a8a4; --line:#3a3a38; --link:#7db4ff; --panel:#1f2124; --on:#7bd69a; --off:#f0b36a; }")}
  body { margin:0; font:1rem/1.5 system-ui,sans-serif; color:var(--fg); background:var(--bg); }
  main { max-width:64rem; margin:0 auto; padding:1.5rem 1.5rem 4rem; min-width:0; overflow-wrap:anywhere; }
  h1 { font-size:1.35rem; margin:0 0 .25rem; } h2 { font-size:1.05rem; margin:1.75rem 0 .5rem; }
  a { color:var(--link); } a:focus-visible, summary:focus-visible { outline:3px solid var(--link); outline-offset:2px; }
  .m { color:var(--muted); font-size:.9rem; }
  dl { display:grid; grid-template-columns:minmax(8rem,12rem) 1fr; gap:.25rem 1rem; margin:.75rem 0; }
  dt { font-weight:600; } dd { margin:0; }
  ul.links { padding-left:1.2rem; margin:.25rem 0; } ul.links li { margin:.15rem 0; }
  .clip { width:100%; overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:.92rem; }
  th, td { text-align:left; vertical-align:top; padding:.35rem .5rem; border-bottom:1px solid var(--line); }
  th { background:var(--panel); white-space:nowrap; }
  td code, dd code, li code { font-size:.88em; overflow-wrap:anywhere; }
  .on { color:var(--on); font-weight:600; } .off { color:var(--off); font-weight:600; }
  details > summary { cursor:pointer; color:var(--link); margin:.25rem 0; }
  @media (max-width:40rem) { dl { grid-template-columns:1fr; } }
`;

function pageHtml(title: string, body: string, opts: { jsonld?: boolean } = {}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>${opts.jsonld ? `\n<link rel="alternate" type="application/ld+json" href="index.jsonld">` : ""}
<style>${STYLE}</style>
</head>
<body ${PAGE_MARK}>
<main>
${body}
</main>
</body>
</html>
`;
}

/** `../` once per segment of a site-relative directory route. */
const upFrom = (route: string): string => "../".repeat(route.split("/").filter(Boolean).length);

function linkHtml(l: PageLink, up: string): string {
  const href = l.external ? l.href : `${up}${l.href}`;
  return `<a href="${esc(href || "./")}"${l.external ? ` rel="noopener"` : ""}>${esc(l.label)}</a>`;
}

function pinText(p: HarnessOverview["pin"]): string {
  if (p === undefined) return `<span class="m">not recorded in <code>index.lock.json</code></span>`;
  if (p.local) return `this repository${p.commit ? `, at <code>${esc(p.commit.slice(0, 12))}</code>` : ""} (a local layer)`;
  const how = [p.pinnedBy ? `pin: ${esc(p.pinnedBy)}` : "", p.via ? `mounted through <code>${esc(p.via)}</code>` : ""].filter(Boolean).join(", ");
  return `<code>${esc(p.repository)}</code> at <a href="https://github.com/${esc(p.repository)}/tree/${esc(p.sha)}" rel="noopener"><code>${esc(p.sha.slice(0, 12))}</code></a>${how ? ` <span class="m">(${how})</span>` : ""}`;
}

/** The page for one harness. `siteTitle` is the site's name; `all` names every harness that has a page here. */
export function overviewHtml(h: HarnessOverview, siteTitle: string, all: ReadonlyMap<string, string>): string {
  const route = harnessOverviewRoute(h.name);
  const up = upFrom(route);
  const peer = (n: string) => (all.has(n) ? `<a href="../${esc(n)}/">${esc(all.get(n)!)}</a>` : `<code>${esc(n)}</code>`);
  const parts: string[] = [];
  parts.push(`<p class="m"><a href="../">Harnesses</a> on ${esc(siteTitle)}</p>`);
  parts.push(`<h1>${esc(h.label)}</h1>`);
  if (h.description) parts.push(`<p>${esc(h.description)}</p>`);
  parts.push(
    `<dl>` +
      `<dt>Role here</dt><dd>${ROLE_TEXT[h.role]}</dd>` +
      `<dt>Name</dt><dd><code>${esc(h.name)}</code></dd>` +
      (h.version ? `<dt>Declared version</dt><dd><code>${esc(h.version)}</code></dd>` : "") +
      `<dt>Pinned</dt><dd>${pinText(h.pin)}</dd>` +
      `<dt>Built on</dt><dd>${h.needs.length ? h.needs.map(peer).join(", ") : `<span class="m">nothing</span>`}</dd>` +
      `<dt>Needed by</dt><dd>${h.neededBy.length ? h.neededBy.map(peer).join(", ") : `<span class="m">no other harness on this site</span>`}</dd>` +
      `</dl>`,
  );

  parts.push(`<h2 id="documentation">Documentation</h2>`);
  parts.push(h.docs.length ? `<ul class="links">${h.docs.map((l) => `<li>${linkHtml(l, up)}</li>`).join("")}</ul>` : `<p class="m">This harness declares no documentation this site can link.</p>`);

  parts.push(`<h2 id="knowledge-graph">Knowledge graph</h2>`);
  const kg: string[] = [];
  if (h.declarationPage) kg.push(`<li><a href="${esc(up + h.declarationPage)}">Its declaration, as a node of the graph</a></li>`);
  if (h.iri) kg.push(`<li>IRI base: <a href="${esc(h.iri)}" rel="noopener"><code>${esc(h.iri)}</code></a></li>`);
  kg.push(`<li><a href="index.jsonld">This page as JSON-LD</a></li>`);
  parts.push(`<ul class="links">${kg.join("")}</ul>`);
  const shown = h.graphs.filter((g) => g.href);
  const unshown = h.graphs.filter((g) => !g.href);
  if (shown.length) {
    parts.push(`<p class="m">Its graph views on this site:</p>`);
    parts.push(`<ul class="links">${shown.map((g) => `<li><a href="${esc(up + g.href!)}">${esc(g.label)}</a></li>`).join("")}</ul>`);
  }
  if (unshown.length) {
    parts.push(
      `<details><summary>${unshown.length} declared graph${unshown.length > 1 ? "s" : ""} with no view on this site</summary>` +
        `<ul class="links">${unshown.map((g) => `<li>${esc(g.label)} <span class="m">— ${esc(g.note ?? "")}</span></li>`).join("")}</ul></details>`,
    );
  }

  parts.push(`<h2 id="content-types">Content types</h2>`);
  if (h.contentTypes.length === 0) parts.push(`<p class="m">This harness supplies no content type.</p>`);
  else {
    const rows = h.contentTypes.map((t) => {
      const used = t.section || t.layers.length > 0;
      const how = [
        t.section ? `<code>index.config.json</code> <code>contentTypes.${esc(t.id)}</code>` : "",
        t.layers.length ? `layer${t.layers.length > 1 ? "s" : ""} ${t.layers.map((n) => `<code>${esc(n)}</code>`).join(", ")}` : "",
      ].filter(Boolean);
      const reads = t.include.length ? `<ul class="links">${t.include.map((p) => `<li><code>${esc(p)}</code></li>`).join("")}</ul>` : "";
      return `<tr><td><code>${esc(t.id)}</code></td><td>${used ? `<span class="on">used</span> — ${how.join("; ")}` : `<span class="m">not used here</span>`}</td><td>${reads}</td></tr>`;
    });
    parts.push(`<div class="clip"><table><thead><tr><th>Type</th><th>On this site</th><th>Paths it reads</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`);
  }

  parts.push(`<h2 id="folders">Folders</h2>`);
  const optIns = h.folders.filter((f) => f.optIn);
  if (optIns.length) {
    parts.push(
      `<p>Opt-in groups: ${optIns.map((f) => `<code>${esc(f.optIn!.id)}</code> <span class="${f.optIn!.enabled ? "on" : "off"}">${f.optIn!.enabled ? "on" : "off"}</span>`).join(", ")}.</p>`,
    );
  } else parts.push(`<p class="m">No opt-in groups.</p>`);
  if (h.folders.length === 0) parts.push(`<p class="m">This harness declares no folders.</p>`);
  else {
    const table =
      `<div class="clip"><table><thead><tr><th>Folder</th><th>Path in this checkout</th><th>Graph typologies</th><th>Where</th></tr></thead><tbody>` +
      h.folders
        .map(
          (f) =>
            `<tr><td><code>${esc(f.id)}</code>${f.optIn ? ` <span class="${f.optIn.enabled ? "on" : "off"}">opt-in, ${f.optIn.enabled ? "on" : "off"}</span>` : ""}</td>` +
            `<td><code>${esc(f.path)}</code></td><td>${f.kinds.map((k) => `<code>${esc(k)}</code>`).join(" ")}</td><td>${esc(f.where ?? "")}</td></tr>`,
        )
        .join("") +
      `</tbody></table></div>`;
    parts.push(h.folders.length > 12 ? `<details><summary>${h.folders.length} declared folders</summary>${table}</details>` : table);
  }
  return pageHtml(`${h.label} · Harnesses · ${siteTitle}`, parts.join("\n"), { jsonld: true });
}

/** The page listing every harness of the site. */
export function indexHtml(hs: readonly HarnessOverview[], siteTitle: string): string {
  const rows = hs
    .map(
      (h) =>
        `<tr><td><a href="${esc(h.name)}/">${esc(h.label)}</a></td><td>${ROLE_TEXT[h.role]}</td>` +
        `<td>${h.pin === undefined ? "" : h.pin.local ? "local" : `<code>${esc(h.pin.sha.slice(0, 12))}</code>`}</td></tr>`,
    )
    .join("");
  return pageHtml(
    `Harnesses · ${siteTitle}`,
    `<h1>Harnesses</h1>\n<p>The harnesses ${esc(siteTitle)} is built on, and how it uses each one.</p>\n` +
      `<div class="clip"><table><thead><tr><th>Harness</th><th>Role here</th><th>Pinned</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  );
}

/**
 * The page as JSON-LD, in schema.org terms: a `WebPage` whose `about` is the
 * harness, as `SoftwareSourceCode` with its IRI base as `@id`.
 */
export function overviewJsonld(h: HarnessOverview, siteTitle: string, baseUrl: string | undefined, all: ReadonlyMap<string, HarnessOverview>): Record<string, unknown> {
  const route = harnessOverviewRoute(h.name);
  const pageIri = baseUrl ? new URL(route, baseUrl).href : undefined;
  const iriOf = (n: string) => all.get(n)?.iri;
  const harness: Record<string, unknown> = {
    ...(h.iri ? { "@id": h.iri } : {}),
    "@type": "SoftwareSourceCode",
    identifier: h.name,
    name: h.label,
    ...(h.description ? { description: h.description } : {}),
    ...(h.version ? { version: h.version } : {}),
    ...(h.repository ? { codeRepository: `https://github.com/${h.repository}` } : {}),
    ...(h.needs.length ? { isBasedOn: h.needs.map((n) => (iriOf(n) ? { "@id": iriOf(n) } : { identifier: n })) } : {}),
    ...(h.pin && !h.pin.local ? { additionalProperty: { "@type": "PropertyValue", name: "pinnedCommit", value: h.pin.sha } } : {}),
    ...(h.contentTypes.length ? { keywords: h.contentTypes.map((t) => t.id) } : {}),
  };
  return {
    "@context": { "@vocab": "https://schema.org/" },
    ...(pageIri ? { "@id": pageIri, url: pageIri } : {}),
    "@type": "WebPage",
    name: `${h.label} on ${siteTitle}`,
    about: harness,
    ...(baseUrl ? { isPartOf: { "@id": new URL(baseUrl).href, name: siteTitle } } : {}),
    significantLink: h.docs.filter((l) => l.external).map((l) => l.href),
  };
}

/** Write every page under `site`. Returns the site-relative routes written. */
export function writeHarnessPages(site: string, hs: readonly HarnessOverview[], siteTitle: string, baseUrl?: string): string[] {
  const names = new Map(hs.map((h) => [h.name, h.label]));
  const byName = new Map(hs.map((h) => [h.name, h]));
  const written: string[] = [];
  const write = (route: string, file: string, body: string) => {
    const dir = join(site, route);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), body);
  };
  for (const h of hs) {
    const route = harnessOverviewRoute(h.name);
    write(route, "index.html", overviewHtml(h, siteTitle, names));
    write(route, "index.jsonld", `${JSON.stringify(overviewJsonld(h, siteTitle, baseUrl, byName), null, 2)}\n`);
    written.push(route);
  }
  if (hs.length) {
    write(harnessOverviewsRoute(), "index.html", indexHtml(hs, siteTitle));
    written.push(harnessOverviewsRoute());
  }
  return written;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opt = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const checkout = resolve(opt("--root") ?? ".");
  const site = resolve(opt("--out") ?? "_site");
  if (!existsSync(site)) {
    console.error(`  ? ${site} does not exist — no site to write the harness pages into`);
    process.exit(2);
  }
  // The harness data the rail reads, so the pages and the panel list the same harnesses.
  const { harnessDataPath, publishedDocsPrefix } = await import("./mount-instance-docs.ts");
  const prefix = publishedDocsPrefix(checkout, HARNESS_NAME);
  const data = prefix === undefined ? undefined : harnessDataPath(prefix, checkout);
  const parsed = data && existsSync(data) ? readJson<{ title?: string; harnesses?: HarnessDataRow[] }>(data) : undefined;
  if (!parsed || !Array.isArray(parsed.harnesses)) {
    console.error(`  ? no readable harness data${data ? ` at ${relative(checkout, data)}` : ""} — run sync-docs-harness first; no harness pages written`);
    process.exit(2);
  }
  const commit = opt("--commit");
  const hs = buildOverviews({ checkout, site, rows: parsed.harnesses, ...(commit ? { commit } : {}) });
  const title = opt("--title") ?? parsed.title ?? declarationIn(checkout)?.title ?? "this site";
  const written = writeHarnessPages(site, hs, title, opt("--base-url"));
  console.log(`harness pages: ${hs.length} harness overview page(s) under ${harnessOverviewsRoute()}${written.length ? "" : " (none: no harness of the data is in this checkout)"}`);
}
