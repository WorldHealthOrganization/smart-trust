#!/usr/bin/env bun
/**
 * Write a JSON-LD node and a thin page for every ArchiMate model a layer
 * holds, and for every VIEW, ELEMENT and RELATIONSHIP in each — and draw every
 * view as SVG from the model's own diagram.
 *
 * @module cat-harness/archimate/scripts/gen-archimate-pages
 * @conformsTo opengroup-archimate-3.0
 * @covers archimate
 *
 * Usage:
 *   bun run cat-harness-tools/archimate/scripts/gen-archimate-pages.ts --instance <dir> --out <site-dir>
 *   bun run cat-harness-tools/archimate/scripts/gen-archimate-pages.ts --instance <dir> [--check]
 *
 * With `--out`, they are written into a site being built — the way a folio's
 * staging build uses it, since a large model is thousands of nodes and nobody
 * should commit them. The DATA (every `.jsonld`, `.json`, `model.json`, drawn
 * view and the loader) is at the path the graph has in the layer,
 * `<site>/<graph path>/…`, so no IRI moves. The PAGES are at the route of the
 * visualiser the layer DECLARES for this Tool, `<site>/en/<harness>/<id>/…`
 * (`visualiserRoute`; owner 2026-10-09, every visualiser page at
 * `<base>/<harness>/<visualiser>`, and folio-assistant#2527, under the
 * locale). A layer that declares none gets no site pages: the run stops
 * and says so, because a generator writing to a route nobody declared is what
 * the routes gate exists to end. Each page carries `rendered-by`, so
 * `check:visualiser-routes` can see it. Each page reaches its data, and each
 * drawn view its pages, by a relative link across the two trees, so a preview
 * under a staging slug works the same.
 *
 * Without `--out` they are written into the graph itself, as
 * `gen-openapi-pages.ts` does, and `--check` gates them: pages beside their
 * data, as the directory is served verbatim at its own path.
 *
 * ## What is written, under the graph's path
 *
 * | path | what |
 * |---|---|
 * | `<m>.jsonld`, `.json` | the model as a node: its views, each by IRI |
 * | `<m>.html`, `<m>/<kind>/<id>.html` | the small page AT each node's IRI: its declaration, and a link to its page (Q-THIN-3 A) |
 * | `<m>/` | the model's page: views, and elements by layer |
 * | `<m>/model.json` | the model, normalised — what the loader draws from |
 * | `<m>/view/<v>.svg` | the view, drawn (`render-view.ts`) |
 * | `<m>/view/<v>.as-drawn.svg` | the source publication's figure of the view, as drawn (`figures[].asDrawn`); its page then switches between the two |
 * | `<m>/view/<v>.jsonld`, `.json`, `<m>/view/<slug>/` | a view's node and page |
 * | `<m>/element/<e>.jsonld`, `.json`, `<m>/element/<slug>/` | an element's node and page |
 * | `<m>/relationship/<r>.jsonld`, `.json`, `<m>/relationship/<r>/` | a relationship's node and page |
 * | `<m>/metamodel.json`, `.dot`, `.mmd`, `.svg`, `<m>/metamodel/` | the metamodel the model uses, derived (Tool `archimate-metamodel`, `schemas/metamodel.ts`); the SVG only when a run can lay out DOT |
 * | `index.html` | every model the graph holds |
 * | `assets/kg-render.js` | the generic renderer every page loads first (`scripts/templates/kg-render.js`, issue #1830) |
 * | `assets/archimate.js`, `assets/archimate.css` | the ArchiMate renderer it dispatches to, and its style |
 *
 * Ids are Archi's own (`schemas/archimate.ts` §"Ids are the model's own"), so
 * an element keeps its IRI across a model's versions wherever Archi kept its id.
 *
 * A node's IRI is extensionless, `<base><graph>/<m>/<kind>/<id>`, and its data
 * is that IRI plus `.jsonld` (owner, Q-THIN-2 = A, issue #1830; a clean break
 * from the `.jsonld` IRIs, nothing forwards). Every page DECLARES the node it
 * renders — RDFa `resource`/`typeof` on its `<main>` and a JSON-LD stub in its
 * head (`thin-page.ts`) — and loads the generic renderer, which hands it to
 * `archimate.js`. No private config block.
 *
 * A view's or an element's PAGE is at a readable slug worked out from its
 * name each build (`schemas/slugs.ts`), `<m>/view/<slug>/`, while its node
 * keeps the id IRI. Nothing redirects from the old id paths: a clean break
 * (owner, cat-harness-tools#1054).
 *
 * ## Elements reused from another model
 *
 * A layer that draws on another layer's model (an IG on smart-ra's reference
 * architecture, a DTH overlay) keeps the copied element under its own id,
 * and so under this layer's IRI. Each copy names the node it copies in the
 * property {@link BASE_PROPERTY}, whose value is that node's IRI. Its node
 * then carries `dcterms:source` to that IRI, and its page links there. An
 * element of the layer's own that Realizes or Specializes such a copy, at
 * any depth, links on its page to the node the copy came from, so a
 * country's system leads back to the reference architecture's block it
 * plays (smart-trust-demo, issue #1949).
 *
 * ## Vocabularies — borrowed, not minted
 *
 * The Open Group's ArchiMate exchange-format namespace names the types —
 * `archimate:ApplicationComponent`, `archimate:Composition` — exactly as the
 * exchange format spells them, which is Archi's spelling less its prefix and
 * its `Relationship` suffix. A relationship's ends are `archimate:source` and
 * `archimate:target`, as there. Names, descriptions and membership are
 * `schema:` and `dcterms:`. Nothing is minted in this project's namespaces.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { DOCS_SITE_BASE } from "../../schemas/kg/jsonld.ts";
import { KG_RENDER_ASSET, contentsCardScript, contentsCardStyle, escHtml, kgRenderScript, nodeAttrs, nodeStubPageHtml, pageNodeOf, thinPageHtml, type PageNode } from "../../scripts/thin-page.ts";
import { visualiserNavDeclaration, type VisualiserNavEntry } from "../../scripts/lib/navbar.ts";
import { findDeclarationFile } from "../../schemas/kg/cat-harness.ts";
import { readArchimate, type ArchimateModel } from "../schemas/archimate.ts";
import { renderViewSvg, typeLabel } from "./render-view.ts";
import { posterFits, renderPosterSvg } from "./render-poster.ts";
import { CONFIG_FILE, archimateDir, configPath, localDirOf, readConfig } from "./check-archimate.ts";
import { planSlugs } from "../schemas/slugs.ts";
import { LAYER_ORDER, categorySubsets, drawnCategories, layerSlug, metamodelDot, metamodelSvgName, metamodelMermaid, metamodelOf, pairAnchor, typeAnchor, typeName, verbOf, type Metamodel } from "../schemas/metamodel.ts";
import { dataModelDot, dataModelMermaid, dataModelOf, dataModelPuml, sequencesMermaid, sequencesOf, sequencesPuml, type DataModel, type SequenceSet } from "../schemas/diagrams.ts";
import { TOOLS_ROOT } from "../../scripts/lib/roots.ts";
import { darkRules } from "../../scripts/lib/scheme-css.ts";
import { pageParts, withRenderedBy } from "../../scripts/viewer-declarations.ts";
import { visualiserRoute } from "../../schemas/kg/visualiser-route.ts";
import { readHarnessConfig, TranslationConfigSchema } from "../../schemas/kg/harness-config.ts";
import { potWithoutTimestamp } from "../../pipeline/pot-extract.ts";
import { archimateLocales, CATALOGUE_STEM, formatArchimatePot, localizedArchimateFiles, readArchimateCatalogue, type SiteFile } from "./archimate-locales.ts";

/**
 * The namespace every page written here declares its node's class in
 * (`typeof="archimate:…"`, issue #1830) — how a run recognises its own output,
 * and what the loader registers with the generic renderer for.
 */
export const ARCHIMATE_NS = "http://www.opengroup.org/xsd/archimate/3.0/";
/** The prefixes a page's `typeof` is written over. */
const PREFIXES = { archimate: ARCHIMATE_NS };
/** The Tool node these pages are drawn by (`cat-harness/tools/index.ts`), which a layer names in its `visualisers`. */
export const TOOL_ID = "archimate-pages";
/**
 * The property a copied element or relationship carries: the IRI of the node
 * in another layer's model that it copies (dth-hrh's `overlay:base`, read by
 * core's `check:dth-glossary`). See §"Elements reused from another model".
 */
export const BASE_PROPERTY = "overlay:base";
/** The relationships an element of a layer's own follows to the copy it plays: it is, or does, that block. */
const PLAYS = new Set(["Realization", "Specialization"]);

/**
 * The IRI a node copies, from its {@link BASE_PROPERTY}; only an absolute
 * http(s) IRI counts. The DTH overlays wrote it before the slash IRIs
 * (Q-THIN-2 A, issue #1830), as `…/elements/<id>.jsonld`; that is read as the
 * node's IRI now, `…/element/<id>`, so the link reaches the page and not a
 * file the upstream no longer writes.
 */
export function baseIriOf(properties: ReadonlyArray<{ key: string; value: string }>): string | undefined {
  const v = properties.find((p) => p.key === BASE_PROPERTY)?.value.trim();
  if (v === undefined || !/^https?:\/\/\S+$/.test(v)) return undefined;
  return v.replace(/\/(element|relationship|view)s\/([^/]+)\.jsonld$/, "/$1/$2");
}

/**
 * What a reader calls the model an IRI is in: its layer and model segment,
 * `smart-ra 0.3.0-draft.1`, read from `<host>/<layer>/…/<model>/<kind>/<id>`;
 * else the IRI's host and path.
 */
export function sourceLabel(iri: string): string {
  const u = new URL(iri);
  const parts = u.pathname.split("/").filter(Boolean);
  const k = parts.findIndex((p) => /^(element|relationship|view)s?$/.test(p));
  if (k >= 2) return `${parts[0]} ${parts[k - 1]}`;
  return `${u.host}${u.pathname}`;
}

/**
 * The copies an element plays: following its own Realization and
 * Specialization relationships outward, breadth first, the first copies
 * (elements with a {@link baseIriOf}) on each path. Empty for a copy itself.
 */
export function playedCopies(model: ArchimateModel, id: string): Array<{ id: string; iri: string; via: string[] }> {
  const byId = new Map(model.elements.map((e) => [e.id, e]));
  if (byId.get(id) && baseIriOf(byId.get(id)!.properties)) return [];
  const out = new Map<string, string[]>();
  for (const r of model.relationships) if (PLAYS.has(r.type)) out.set(r.source, [...(out.get(r.source) ?? []), r.target]);
  const found: Array<{ id: string; iri: string; via: string[] }> = [];
  const seen = new Set([id]);
  let frontier: Array<{ id: string; via: string[] }> = [{ id, via: [] }];
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const f of frontier) {
      for (const t of out.get(f.id) ?? []) {
        if (seen.has(t) || !byId.has(t)) continue;
        seen.add(t);
        const iri = baseIriOf(byId.get(t)!.properties);
        if (iri !== undefined) found.push({ id: t, iri, via: f.via });
        else next.push({ id: t, via: [...f.via, t] });
      }
    }
    frontier = next;
  }
  return found;
}
const LOADER = "assets/archimate.js";
const STYLE = "assets/archimate.css";
// declared-path-literal: this module's own templates under cat-harness-tools/archimate/, not a layer's archimate/ directory.
const TEMPLATES = join(TOOLS_ROOT, "archimate", "scripts", "templates");

export const CONTEXT = {
  archimate: ARCHIMATE_NS,
  schema: "https://schema.org/",
  dcterms: "http://purl.org/dc/terms/",
};

export interface Written {
  /** Path under the graph's directory. */
  path: string;
  content: string;
  /** A rendered page (an `index.html`), as opposed to data or the loader: what goes to the declared route in a site. */
  page?: true;
}

/** Where a run's files go: the data at the graph's path, and the pages — in a site — at the declared route. */
export interface Layout {
  /** The graph's path in the layer, with no trailing slash: where the data is, in the graph and in a site. */
  graphPath: string;
  /**
   * Site-relative, with no trailing slash: where the PAGES are in a site,
   * `<locale>/<harness>/<visualiser id>`. In the graph (no site) it is the
   * graph's path, since the pages sit beside their data.
   */
  pageRoot: string;
}

/**
 * Where a written file goes in a SITE being built (`--out`), site-relative:
 * a page at the declared route, `<pageRoot>/<path>`; data at the graph's own
 * path, `<graph path>/<path>`.
 */
export function sitePathOf(layout: Layout, f: Written): string {
  return posix.join(f.page ? layout.pageRoot : layout.graphPath, f.path);
}

interface Declaration {
  name: string;
  iriBase?: string;
  directories: Array<{ id: string; served?: boolean; path: string }>;
  visualisers?: Array<{ id: string; renderedBy: string; covers?: string[] }>;
}

/**
 * The route a layer declares for these pages: its one visualiser
 * `renderedBy` {@link TOOL_ID}, or — when it declares several — the one that
 * covers the archimate directory. Throws when there is none to choose, and
 * says what to declare.
 */
export function declaredPageRoot(decl: Declaration, directory: string): string {
  const mine = (decl.visualisers ?? []).filter((v) => v.renderedBy === TOOL_ID);
  const chosen = mine.length === 1 ? mine[0] : mine.find((v) => v.covers?.includes(directory));
  if (chosen === undefined) {
    throw new Error(
      `${decl.name}: declares ${mine.length === 0 ? "no" : mine.length} visualiser(s) rendered by \`${TOOL_ID}\`` +
        `${mine.length > 1 ? `, and none covers "${directory}"` : ""} — declare one in its \`visualisers\`, ` +
        `e.g. { "id": "archimate", "renderedBy": "${TOOL_ID}", "covers": ["${directory}"] } ` +
        "(cat-harness/schemas/kg/cat-harness.ts, HarnessVisualiserSchema); the pages are written at its route",
    );
  }
  return visualiserRoute(pageParts({ harness: decl.name, visualiser: chosen.id })).replace(/\/$/, "");
}

/** Where the layer's IRIs start: its own `iriBase`, else the platform's site under its name. */
export function iriBaseOf(decl: Declaration): string {
  const b = decl.iriBase ?? `${DOCS_SITE_BASE}${decl.name}/`;
  return b.endsWith("/") ? b : `${b}/`;
}

/**
 * Every file a run writes for one layer, keyed by its path under the graph.
 * `site`: the files are for a site being built (`--out`), so each page links
 * its data and loader, and each drawn view its pages, across the locale (see
 * {@link sitePathOf}); otherwise everything sits together in the graph.
 */
export function pagesFor(
  instanceRoot: string,
  opts: { requireServed?: boolean; site?: boolean; drawDot?: (dot: string) => string } = {},
): Layout & { files: Written[] } {
  const config = readConfig(instanceRoot);
  const dir = archimateDir(instanceRoot, config);
  const declFile = findDeclarationFile(instanceRoot);
  if (declFile === undefined) throw new Error(`no instance declaration in ${resolve(instanceRoot)}`);
  const decl = JSON.parse(readFileSync(join(instanceRoot, declFile), "utf8")) as Declaration;
  const entry = decl.directories.find((d) => d.id === config.directory)!;
  // In the graph, the pages fetch what sits beside them, so the directory must
  // be published verbatim; into a site being built (`--out`), the site is
  // what is published and the question does not arise.
  if (opts.requireServed && !entry.served) {
    throw new Error(
      `${decl.name}: directory "${entry.id}" is not declared \`served: true\`, so a page could not fetch its model — ` +
        "no page is written (visualizer-loading §\"Where the data is served from\"); pass --out to write into a site build instead",
    );
  }
  const graphPath = localDirOf(instanceRoot, dir).replace(/\/$/, "");
  const site = opts.site === true;
  const pageRoot = site ? declaredPageRoot(decl, config.directory) : graphPath;
  const base = `${iriBaseOf(decl)}${graphPath}/`;
  const files: Written[] = [];
  // A link from a page in directory `from` (graph-relative) to `rel`, written
  // relative to that directory in the GRAPH — which is where a site keeps the
  // data, while the page itself is at the declared route.
  const toData = (from: string, rel: string): string =>
    site ? posix.relative(posix.join(pageRoot, from), posix.join(graphPath, from, rel)) : rel;
  // A link from a drawn view (data, in `<m>/view/`) to a page, the reverse way.
  const toPage = (from: string, rel: string): string =>
    site ? `${posix.relative(posix.join(graphPath, from), posix.join(pageRoot, from, rel))}/` : rel;
  // In a site, every page names the Tool that drew it, which is what lets
  // `check:visualiser-routes` hold it to the declared route.
  const stamp = (w: Written): Written => (site ? { ...w, content: withRenderedBy(w.content, TOOL_ID) } : w);
  const page = (path: string, depth: number, title: string, jsonld: string, node: PageNode, body: string, tail?: string): Written =>
    stamp(thinPage(path, depth, title, jsonld, node, body, tail, toData));
  // The element the generic renderer fills: the node in RDFa, and where the
  // loader finds what it draws from (`data-kg-*`, relative to the page).
  // The small page AT a node's IRI (`<dir>/<id>.html`, which the host serves
  // at the extensionless IRI): the same declaration, and a link and redirect
  // to the page that draws it (owner, Q-THIN-3 = A). Data, not a page: it is
  // at the graph's path, where the IRI is, in a site as in the graph.
  const stubAt = (dir: string, id: string, title: string, node: PageNode, pageRel: string): void => {
    files.push({
      path: dir === "" ? `${id}.html` : `${dir}/${id}.html`,
      content: nodeStubPageHtml({ title, node, prefixes: PREFIXES, jsonld: `${encodeURIComponent(id)}.jsonld`, page: `${toPage(dir, pageRel)}${site ? "" : "/"}` }),
    });
  };
  const mount = (node: PageNode, cls: string, data: Record<string, string>): string =>
    `<main class="${cls}"${nodeAttrs(node)}${Object.entries(data).map(([k, v]) => ` data-kg-${k}="${escHtml(v)}"`).join("")}>`;
  const json = (path: string, node: object) => {
    const text = `${JSON.stringify(node, null, 2)}\n`;
    files.push({ path: `${path}.jsonld`, content: text }, { path: `${path}.json`, content: text });
  };
  const listed: Array<{ id: string; title: string; views: number; elements: number }> = [];

  for (const cm of config.models) {
    const model = readArchimate(readFileSync(join(dir, cm.file)));
    const m = cm.id;
    const title = cm.title ?? model.name;
    listed.push({ id: m, title, views: model.views.length, elements: model.elements.length });
    // Extensionless slash IRIs, `…/<kind>/<id>`; each node's data is `<IRI>.jsonld` (Q-THIN-2 A, issue #1830).
    const modelIri = `${base}${m}`;
    const viewIri = (id: string) => `${base}${m}/view/${id}`;
    const elIri = (id: string) => `${base}${m}/element/${id}`;
    const relIri = (id: string) => `${base}${m}/relationship/${id}`;
    const elements = new Map(model.elements.map((e) => [e.id, e]));
    const slugOf = planSlugs(model);
    // The path segment of a view's or an element's page: its slug, else its id.
    const seg = (id: string): string => slugOf.get(id) ?? id;
    // The line under a page's kind naming where a reused node comes from
    // (§"Elements reused from another model"): the node it copies, or, for
    // an element of the layer's own, the copies it Realizes or Specializes.
    const reusedFrom = (id: string, properties: ReadonlyArray<{ key: string; value: string }>): string => {
      const own = baseIriOf(properties);
      const link = (iri: string, text: string) => `<a href="${escHtml(iri)}">${escHtml(text)}</a>`;
      if (own !== undefined) return `<p class="am-from">Reused from ${link(own, sourceLabel(own))}</p>`;
      const played = playedCopies(model, id);
      if (played.length === 0) return "";
      return `<p class="am-from">Plays ${played
        .map((p) => {
          const via = p.via.map((v) => elements.get(v)?.name || v);
          return `${link(p.iri, elements.get(p.id)?.name || p.id)} in ${escHtml(sourceLabel(p.iri))}${via.length ? ` (through ${via.map(escHtml).join(", ")})` : ""}`;
        })
        .join("; ")}</p>`;
    };

    json(m, {
      "@context": CONTEXT,
      "@id": modelIri,
      "@type": "archimate:Model",
      "schema:identifier": m,
      "schema:name": title,
      ...(cm.description ?? model.documentation ? { "schema:description": cm.description ?? model.documentation } : {}),
      "dcterms:identifier": model.id,
      "schema:contentUrl": `${base}${cm.file.split("/").map(encodeURIComponent).join("/")}`,
      "schema:hasPart": model.views.map((v) => ({ "@id": viewIri(v.id), "@type": "archimate:Diagram", "schema:name": v.name })),
    });
    files.push({ path: `${m}/model.json`, content: `${JSON.stringify(normalisedFor(model, cm.file, slugOf))}\n` });
    // The rail's left-hand section for this model's pages: the model, then its
    // views (`visualiserNavDeclaration`, the one writer of the format the
    // navbar pass reads). Relative to the page, so it holds in a preview.
    const nav = (toModel: string): string =>
      visualiserNavDeclaration([
        {
          label: title,
          href: toModel,
          items: [
            { label: "Metamodel in use", href: `${toModel}metamodel/` },
            ...model.views.map((v) => ({ label: v.name || "(unnamed view)", href: `${toModel}view/${seg(v.id)}/` })),
          ],
        },
        { label: "ArchiMate models", href: `${toModel}../` },
      ]);
    const modelNode: PageNode = { iri: modelIri, types: ["archimate:Model"] };
    stubAt("", m, title, modelNode, m);
    files.push(page(`${m}/index.html`, 1, title, toData(m, `../${m}.jsonld`), modelNode,
      `${mount(modelNode, "am", { model: toData(m, "./model.json") })}<p class="am-up"><a href="../">← ArchiMate models</a></p><h1>${escHtml(title)}</h1>` +
        `<p class="am-kind"><a href="metamodel/">Metamodel in use</a>: the element types and relationships this model uses, derived from it</p>` +
        `<div class="am-body" aria-live="polite"><p>Loading the model…</p></div></main>`, nav("./")));

    // The metamodel the model uses, derived, never drawn (Tool `archimate-metamodel`).
    const mm = metamodelOf(model, m);
    // Every box and line opens its section of the metamodel page: the
    // drawing is data (`<m>/`), the page is at the declared route.
    const mmPage = `${toPage(m, "metamodel")}${site ? "" : "/"}`;
    const mmHref = { type: (t: string) => `${mmPage}#${typeAnchor(t)}`, pair: (a: string, b: string) => `${mmPage}#${pairAnchor(a, b)}` };
    const mmDot = metamodelDot(mm, { href: mmHref });
    files.push(
      { path: `${m}/metamodel.json`, content: `${JSON.stringify(mm, null, 2)}\n` },
      { path: `${m}/metamodel.dot`, content: mmDot },
      { path: `${m}/metamodel.mmd`, content: metamodelMermaid(mm) },
    );
    const drawn = opts.drawDot !== undefined;
    if (drawn) {
      files.push({ path: `${m}/metamodel.svg`, content: opts.drawDot!(mmDot) });
      // Each set of categories the filters can pick is laid out on its own,
      // so unticking one redraws the picture without those lines, not the
      // full tangle with gaps in it (owner, 2026-11-01: "detangle metamodel filters").
      const all = drawnCategories(mm);
      for (const cats of categorySubsets(mm)) {
        files.push({ path: `${m}/${metamodelSvgName(cats, all)}`, content: opts.drawDot!(metamodelDot(mm, { href: mmHref, categories: cats })) });
      }
    }
    const dm = dataModelOf(model, m);
    if (dm.classes.length > 0) {
      const dmDot = dataModelDot(dm, {
        href: {
          element: (id) => `${toPage(m, `element/${seg(id)}`)}${site ? "" : "/"}`,
          relationship: (id) => `${toPage(m, `relationship/${id}`)}${site ? "" : "/"}`,
        },
      });
      files.push(
        { path: `${m}/data-model.json`, content: `${JSON.stringify(dm, null, 2)}\n` },
        { path: `${m}/data-model.puml`, content: dataModelPuml(dm) },
        { path: `${m}/data-model.mmd`, content: dataModelMermaid(dm) },
        { path: `${m}/data-model.dot`, content: dmDot },
      );
      if (drawn) files.push({ path: `${m}/data-model.svg`, content: opts.drawDot!(dmDot) });
    }
    const seqs = sequencesOf(model, m);
    if (seqs.sequences.length > 0) {
      files.push(
        { path: `${m}/sequences.json`, content: `${JSON.stringify(seqs, null, 2)}\n` },
        { path: `${m}/sequences.puml`, content: sequencesPuml(seqs) },
        { path: `${m}/sequences.mmd`, content: sequencesMermaid(seqs) },
      );
    }
    const mp = `${m}/metamodel`;
    files.push(page(`${mp}/index.html`, 2, `Metamodel in use — ${title}`, toData(mp, `../../${m}.jsonld`), modelNode,
      metamodelBody(mm, title, {
        data: (rel) => toData(mp, `../${rel}`),
        element: (id) => `../element/${seg(id)}/`,
        relationship: (id) => `../relationship/${id}/`,
        view: (id) => `../view/${seg(id)}/`,
        nameOf: (id) => elements.get(id)?.name ?? id,
        drawn,
        dataModel: dm,
        sequences: seqs,
      }, modelNode), nav("../")));

    const figuresOf = (viewId: string) => (config.figures ?? []).filter((f) => f.model === m && f.view === viewId);
    for (const v of model.views) {
      const shown = [...new Set(v.nodes.filter((n) => n.kind === "element" && n.ref && elements.has(n.ref)).map((n) => n.ref!))];
      json(`${m}/view/${v.id}`, {
        "@context": CONTEXT,
        "@id": viewIri(v.id),
        "@type": "archimate:Diagram",
        "schema:identifier": v.id,
        "schema:name": v.name,
        ...(v.documentation ? { "schema:description": v.documentation } : {}),
        ...(v.viewpoint ? { "archimate:viewpoint": v.viewpoint } : {}),
        "schema:image": `${base}${m}/view/${v.id}.svg`,
        "schema:about": shown.map((id) => ({ "@id": elIri(id) })),
        ...(figuresOf(v.id).length ? { "schema:subjectOf": figuresOf(v.id).map((f) => ({ "schema:name": f.label, "schema:url": `${iriBaseOf(decl)}${f.block}` })) } : {}),
        "dcterms:isPartOf": modelIri,
      });
      // Relative to the SVG's own address (`<m>/view/`), so it links correctly
      // standalone, embedded as a figure, or in its page's <object>.
      // In a site the pages are under the locale and the drawing is not, so
      // there each link crosses to the page (`toPage`).
      const vd = `${m}/view`;
      files.push({
        path: `${m}/view/${v.id}.svg`,
        // Banded views without lines are drawn as posters; the rest keep their layout, in the same theme.
        content: posterFits(model, v)
          ? renderPosterSvg(model, v, { ...config.poster, elementHref: (id) => toPage(vd, `../element/${seg(id)}/`) })
          : renderViewSvg(model, v, {
              elementHref: (id) => toPage(vd, `../element/${seg(id)}/`),
              relationshipHref: (id) => toPage(vd, `../relationship/${id}/`),
              viewHref: (id) => toPage(vd, `./${seg(id)}/`),
            }),
      });
      const vp = `${m}/view/${seg(v.id)}`;
      const viewNode: PageNode = { iri: viewIri(v.id), types: ["archimate:Diagram"] };
      stubAt(`${m}/view`, v.id, `${v.name} — ${title}`, viewNode, seg(v.id));
      // The source publication's figure as drawn, beside the view's drawing, and the switch between the two.
      const drawnAs = figuresOf(v.id).find((f) => f.asDrawn !== undefined);
      let asDrawn = "";
      if (drawnAs?.asDrawn !== undefined) {
        const src = join(instanceRoot, drawnAs.asDrawn);
        if (!existsSync(src)) throw new Error(`${drawnAs.label}: as-drawn figure ${drawnAs.asDrawn} is not in the instance`);
        const svg = readFileSync(src, "utf8");
        files.push({ path: `${vd}/${v.id}${AS_DRAWN_SUFFIX}`, content: svg });
        asDrawn = asDrawnSwitch(drawnAs.label, svg, toData(vp, `../${v.id}${AS_DRAWN_SUFFIX}`));
      }
      files.push(page(`${vp}/index.html`, 3, `${v.name} — ${title}`, toData(vp, `../${v.id}.jsonld`), viewNode,
        `${mount(viewNode, "am am-wide", { model: toData(vp, "../../model.json"), svg: toData(vp, `../${v.id}.svg`) })}<p class="am-up"><a href="../../">← ${escHtml(title)}</a></p><h1>${escHtml(v.name)}</h1>` +
          `<p class="am-kind">View${figuresOf(v.id).map((f) => ` · drawn in the document as ${escHtml(f.label)} (<code>${escHtml(f.block)}</code>)`).join("")}</p>` +
          `${asDrawn}<div class="am-body" aria-live="polite"><p>Loading the view…</p></div></main>`, nav("../../")));
    }

    for (const e of model.elements) {
      json(`${m}/element/${e.id}`, {
        "@context": CONTEXT,
        "@id": elIri(e.id),
        "@type": `archimate:${e.type}`,
        "schema:identifier": e.id,
        "schema:name": e.name,
        ...(e.documentation ? { "schema:description": e.documentation } : {}),
        "schema:category": e.layer,
        ...(baseIriOf(e.properties) ? { "dcterms:source": { "@id": baseIriOf(e.properties) } } : {}),
        "dcterms:isPartOf": modelIri,
      });
      const ep = `${m}/element/${seg(e.id)}`;
      const elNode: PageNode = { iri: elIri(e.id), types: [`archimate:${e.type}`] };
      stubAt(`${m}/element`, e.id, `${e.name || typeLabel(e.type)} — ${title}`, elNode, seg(e.id));
      files.push(page(`${ep}/index.html`, 3, `${e.name || typeLabel(e.type)} — ${title}`, toData(ep, `../${e.id}.jsonld`), elNode,
        `${mount(elNode, "am", { model: toData(ep, "../../model.json") })}<p class="am-up"><a href="../../">← ${escHtml(title)}</a></p><h1>${escHtml(e.name || "(unnamed)")}</h1>` +
          `<p class="am-kind">${escHtml(typeLabel(e.type))} · ${escHtml(e.layer)}</p>${reusedFrom(e.id, e.properties)}<div class="am-body" aria-live="polite"><p>Loading the element…</p></div></main>`));
    }

    for (const r of model.relationships) {
      json(`${m}/relationship/${r.id}`, {
        "@context": CONTEXT,
        "@id": relIri(r.id),
        "@type": `archimate:${r.type}`,
        "schema:identifier": r.id,
        ...(r.name ? { "schema:name": r.name } : {}),
        ...(r.documentation ? { "schema:description": r.documentation } : {}),
        "archimate:source": { "@id": elements.has(r.source) ? elIri(r.source) : relIri(r.source) },
        "archimate:target": { "@id": elements.has(r.target) ? elIri(r.target) : relIri(r.target) },
        ...(baseIriOf(r.properties) ? { "dcterms:source": { "@id": baseIriOf(r.properties) } } : {}),
        "dcterms:isPartOf": modelIri,
      });
      const label = `${typeLabel(r.type)}: ${elements.get(r.source)?.name ?? r.source} → ${elements.get(r.target)?.name ?? r.target}`;
      const rp = `${m}/relationship/${r.id}`;
      const relNode: PageNode = { iri: relIri(r.id), types: [`archimate:${r.type}`] };
      stubAt(`${m}/relationship`, r.id, `${label} — ${title}`, relNode, r.id);
      files.push(page(`${rp}/index.html`, 3, `${label} — ${title}`, toData(rp, `../${r.id}.jsonld`), relNode,
        `${mount(relNode, "am", { model: toData(rp, "../../model.json") })}<p class="am-up"><a href="../../">← ${escHtml(title)}</a></p><h1>${escHtml(r.name || typeLabel(r.type))}</h1>` +
          `<p class="am-kind">${escHtml(typeLabel(r.type))} relationship</p>${reusedFrom(r.id, r.properties)}<div class="am-body" aria-live="polite"><p>Loading the relationship…</p></div></main>`));
    }

  }

  files.push(stamp({
    path: "index.html",
    page: true,
    content:
      `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>ArchiMate models — ${escHtml(decl.name)}</title><link rel="stylesheet" href="${toData("", STYLE)}"></head>\n<body><main class="am">` +
      `<h1>ArchiMate models</h1><ul>` +
      listed.map((l) => `<li><a href="${encodeURI(l.id)}/">${escHtml(l.title)}</a> <code>${escHtml(l.id)}</code> — ${l.views} view(s), ${l.elements} element(s)</li>`).join("") +
      `</ul></main>\n` +
      visualiserNavDeclaration([{ label: "ArchiMate models", href: "./", items: listed.map((l): VisualiserNavEntry => ({ label: l.title, href: `${encodeURI(l.id)}/` })) }]) +
      `\n</body></html>\n`,
  }));
  files.push(
    // The Contents card rides in the renderer's own files (issue #1885), so a page loads nothing more.
    { path: LOADER, content: contentsCardScript() + "\n" + readFileSync(join(TEMPLATES, "archimate.js"), "utf8") },
    { path: KG_RENDER_ASSET, content: kgRenderScript() },
    // `color-scheme: light dark` alone follows the OS, not the navbar switch
    // (`data-fa-scheme`, issue #2208): pin the scheme the reader picked.
    { path: STYLE, content: readFileSync(join(TEMPLATES, "archimate.css"), "utf8") + contentsCardStyle() + darkRules(":root { color-scheme: dark; }") + "\n" },
  );
  return { graphPath, pageRoot, files };
}

/**
 * Checkboxes over the drawing: ArchiMate's relationship categories, and the
 * layers. They hide boxes and lines by the classes `metamodelDot` gives them,
 * in the browser, so they work on a static host. A line shows while any of
 * its categories is ticked and both its ends' layers are.
 */
function filterBar(mm: Metamodel, svg: (name: string) => string): string {
  const cats = drawnCategories(mm);
  const held = new Set(mm.types.map((t) => t.layer));
  const layers = LAYER_ORDER.filter((l) => l !== "Other" && held.has(l));
  const box = (kind: string, value: string, label: string) =>
    `<label style="margin-right:.8rem"><input type="checkbox" checked data-mm-${kind}="${escHtml(value)}"> ${escHtml(label)}</label>`;
  // Which drawing each set of ticked categories shows, keyed by the set joined in order.
  const drawings: Record<string, string> = {};
  for (const set of [...categorySubsets(mm), cats]) drawings[set.join("-")] = svg(metamodelSvgName(set, cats));
  return (
    `<form class="am-filters" style="margin:.5rem 0" onsubmit="return false" data-mm-svgs="${escHtml(JSON.stringify(drawings))}">` +
    `<div><strong>Relationships:</strong> ${cats.map((c) => box("cat", c, c)).join("")}</div>` +
    `<div><strong>Layers:</strong> ${layers.map((l) => box("layer", layerSlug(l), l)).join("")}</div>` +
    `<p class="am-filter-note" style="margin:.3rem 0;font-size:.9em" hidden>No relationship category is ticked.</p></form>` +
    // Categories pick a drawing laid out for them; layers then hide the lines
    // with an end in an unticked layer, and any box left with no line.
    `<script>(function(){var f=document.currentScript.previousElementSibling,svgs=JSON.parse(f.getAttribute("data-mm-svgs")),note=f.querySelector(".am-filter-note");` +
    `function on(k){var r={};f.querySelectorAll("[data-mm-"+k+"]").forEach(function(i){r[i.getAttribute("data-mm-"+k)]=i.checked;});return r;}` +
    `function has(e,p){for(var i=0;i<e.classList.length;i++)if(e.classList[i].indexOf(p)===0)return e.classList[i].slice(p.length);}` +
    `function obj(){return document.querySelector(".am-figure object");}` +
    `function layers(){var o=obj(),d=o&&o.contentDocument;if(!d)return;var l=on("layer"),seen={};` +
    `d.querySelectorAll("g.edge").forEach(function(e){var a=has(e,"mm-from-"),b=has(e,"mm-to-");if(a===undefined)return;var v=l[a]!==false&&l[b]!==false;e.style.display=v?"":"none";` +
    `if(v){var t=(e.querySelector("title")||{}).textContent||"";t.split("->").forEach(function(n){seen[n.trim()]=1;});}});` +
    `var any=Object.keys(l).some(function(k){return l[k]===false;}),shown={};` +
    `d.querySelectorAll("g.node").forEach(function(n){var y=has(n,"mm-layer-"),t=((n.querySelector("title")||{}).textContent||"").trim();` +
    `var v=(y&&l[y]===false)||(any&&!seen[t]);n.style.display=v?"none":"";if(!v&&y)shown[y]=1;});` +
    // A layer's band goes too once none of its boxes is left.
    `d.querySelectorAll("g.cluster").forEach(function(g){var y=has(g,"mm-layer-");g.style.display=y&&!shown[y]?"none":"";});` +
    // Then crop the drawing to what is left, so no empty band stays on the page.
    `var s=d.documentElement,bg=d.querySelector("g.graph > polygon");if(!s.hasAttribute("data-vb"))s.setAttribute("data-vb",[s.getAttribute("viewBox"),s.getAttribute("width"),s.getAttribute("height")].join("|"));` +
    `var o0=s.getAttribute("data-vb").split("|");if(bg)bg.style.display=any?"none":"";` +
    `if(any){var b=s.getBBox(),p=8;s.setAttribute("viewBox",[b.x-p,b.y-p,b.width+2*p,b.height+2*p].join(" "));s.setAttribute("width",(b.width+2*p)+"pt");s.setAttribute("height",(b.height+2*p)+"pt");}` +
    `else{s.setAttribute("viewBox",o0[0]);s.setAttribute("width",o0[1]);s.setAttribute("height",o0[2]);}}` +
    `function apply(){var c=on("cat"),k=Object.keys(c).filter(function(x){return c[x];}).join("-"),o=obj();note.hidden=!!k;if(!o)return;` +
    `o.style.display=k?"":"none";if(!k)return;var u=svgs[k];if(u&&o.getAttribute("data")!==u){o.setAttribute("data",u);return;}layers();}` +
    `f.addEventListener("change",apply);var o=obj();if(o)o.addEventListener("load",layers);apply();})();</script>`
  );
}

/**
 * The body of the "Metamodel in use" page. Everything on it is computed at
 * build time, so the loader has nothing to draw: the page declares the
 * model as its node (`node`, RDFa on its `<main>`) but holds no `.am-body`
 * for the loader to fill. Links: `data` to the model's data directory,
 * `element` and `relationship` to their pages.
 */
export function metamodelBody(
  mm: Metamodel,
  title: string,
  link: {
    data: (rel: string) => string;
    element: (id: string) => string;
    relationship: (id: string) => string;
    view?: (id: string) => string;
    nameOf: (id: string) => string;
    drawn: boolean;
    dataModel?: DataModel;
    sequences?: SequenceSet;
  },
  node?: PageNode,
): string {
  const verdict = (a: boolean | undefined): string => (a === true ? "✓ allowed" : a === false ? "✗ not allowed" : "? not in the table");
  const bad = mm.patterns.filter((p) => p.allowed === false);
  const rels = (ids: string[]): string =>
    ids.slice(0, 8).map((id, i) => `<a href="${escHtml(link.relationship(id))}">${i + 1}</a>`).join(" ") + (ids.length > 8 ? ` +${ids.length - 8} more` : "");
  return (
    `<main class="am am-wide"${node ? nodeAttrs(node) : ""}><p class="am-up"><a href="../">← ${escHtml(title)}</a></p><h1>Metamodel in use</h1>` +
    `<p class="am-kind">Derived from the model on every build (Tool <code>archimate-metamodel</code>), never drawn: ` +
    `${mm.types.length} element type(s) and ${mm.patterns.length} relationship pattern(s), each checked against ArchiMate ${escHtml(mm.archimateVersion)}'s relationship table.</p>` +
    `<p>${bad.length ? `✗ ${mm.notAllowed} relationship(s) follow ${bad.length} pattern(s) ArchiMate does not allow (red below).` : "✓ Every relationship follows a pattern ArchiMate allows."}` +
    (mm.placeholders.length ? ` ${mm.placeholders.length} placeholder element(s), named after their own type, are left out (listed at the end).` : "") +
    `</p>` +
    (link.drawn ? `<p>Click a box to see its elements, or a line to see its relationships.</p>${filterBar(mm, link.data)}` : "") +
    (link.drawn
      ? `<div class="am-figure"><object type="image/svg+xml" style="width:100%;height:auto" data="${escHtml(link.data("metamodel.svg"))}" aria-label="Metamodel in use, drawn"></object></div>`
      : `<p>This build drew no picture; the same diagram is below as Graphviz DOT and Mermaid.</p>`) +
    `<p>To keep the picture readable, relationships between the same two types share one line, a type's relationships to itself are written in its box, ` +
    `and <em>associated with</em> (which says nothing about how two things relate), groupings and junctions are left out. The tables below list everything.</p>` +
    `<p>The same diagram as <a href="${escHtml(link.data("metamodel.dot"))}">Graphviz DOT</a>, a <a href="${escHtml(link.data("metamodel.mmd"))}">Mermaid class diagram</a>, ` +
    `and <a href="${escHtml(link.data("metamodel.json"))}">JSON</a>.</p>` +
    `<h2>Element types</h2><table class="am-props"><thead><tr><th>Type</th><th>Layer</th><th>Elements</th></tr></thead><tbody>` +
    mm.types
      .map(
        (t) =>
          `<tr id="${escHtml(typeAnchor(t.type))}"><td>${escHtml(typeName(t.type))}</td><td>${escHtml(t.layer)}</td><td><details><summary>${t.elements}</summary><ul class="am-els">` +
          t.ids.map((id) => `<li><a href="${escHtml(link.element(id))}">${escHtml(link.nameOf(id) || "(unnamed)")}</a></li>`).join("") +
          `</ul></details></td></tr>`,
      )
      .join("") +
    `</tbody></table>` +
    `<h2>Relationship patterns</h2><table class="am-props"><thead><tr><th>Source</th><th>Relationship</th><th>Target</th><th>Count</th><th>ArchiMate ${escHtml(mm.archimateVersion)}</th><th>Relationships</th></tr></thead><tbody>` +
    mm.patterns
      .map(
        (p, i) =>
          `<tr${mm.patterns.findIndex((q) => q.source === p.source && q.target === p.target) === i ? ` id="${escHtml(pairAnchor(p.source, p.target))}"` : ""}` +
          `${p.allowed === false ? ` style="color:#c0392b"` : ""}><td>${escHtml(typeName(p.source))}</td><td>${escHtml(verbOf(p.relationship))}</td><td>${escHtml(typeName(p.target))}</td>` +
          `<td>${p.count}</td><td>${verdict(p.allowed)}</td><td>${rels(p.relationships)}</td></tr>`,
      )
      .join("") +
    `</tbody></table>` +
    (mm.placeholders.length
      ? `<h2>Placeholder elements</h2><p>Named after their own type, so they stand for the type rather than for a thing in the architecture: ` +
        `how a metamodel gets drawn by hand inside a model. They and their ${mm.placeholderRelationships.length} relationship(s) are left out of the patterns above. ` +
        `Removing them is the model authors' call.</p><ul class="am-els">` +
        mm.placeholders.map((e) => `<li><a href="${escHtml(link.element(e.id))}">${escHtml(e.name)}</a> <span class="am-type">${escHtml(typeName(e.type))}</span></li>`).join("") +
        `</ul>`
      : "") +
    (link.dataModel && link.dataModel.classes.length
      ? `<h2>Data class diagram</h2>` +
        `<p>Derived from the model's <code>DataObject</code> and <code>BusinessObject</code> elements (${link.dataModel.classes.length} class(es), ${link.dataModel.relationships.length} relationship(s)): ` +
        `<a href="${escHtml(link.data("data-model.puml"))}">PlantUML</a>, ` +
        `<a href="${escHtml(link.data("data-model.mmd"))}">Mermaid class diagram</a>, ` +
        `<a href="${escHtml(link.data("data-model.dot"))}">Graphviz DOT</a>, and ` +
        `<a href="${escHtml(link.data("data-model.json"))}">JSON</a>.</p>` +
        (link.drawn
          ? `<div class="am-figure"><object type="image/svg+xml" style="width:100%;height:auto" data="${escHtml(link.data("data-model.svg"))}" aria-label="Data class diagram, drawn"></object></div>`
          : "") +
        `<table class="am-props"><thead><tr><th>Class</th><th>Type</th><th>Logical model</th><th>Attributes</th><th>Accessed / governed by</th></tr></thead><tbody>` +
        link.dataModel.classes
          .map(
            (c) =>
              `<tr><td><a href="${escHtml(link.element(c.id))}">${escHtml(c.name)}</a></td><td>${escHtml(typeName(c.type))}</td>` +
              `<td>${c.logicalModel ? `<code>${escHtml(c.logicalModel)}</code>` : "—"}</td>` +
              `<td>${c.attributes.length ? c.attributes.map((a) => `<code>${escHtml(a.name)}</code>${a.type ? ` (${escHtml(a.type)})` : ""}${a.cardinality ? ` [${escHtml(a.cardinality)}]` : ""}`).join(", ") : "—"}</td>` +
              `<td>${c.accessedBy.length ? c.accessedBy.map((a) => `<a href="${escHtml(link.element(a.elementId))}">${escHtml(a.name)}</a> (${escHtml(a.label ?? a.kind)})`).join(", ") : "—"}</td></tr>`,
          )
          .join("") +
        `</tbody></table>`
      : "") +
    (link.sequences && link.sequences.sequences.length
      ? `<h2>Sequence diagrams</h2>` +
        `<p>Derived from the model's <code>ApplicationInteraction</code>s and cross-component <code>Flow</code> / <code>Triggering</code> chains (${link.sequences.sequences.length} sequence diagram(s)): ` +
        `<a href="${escHtml(link.data("sequences.puml"))}">PlantUML</a>, ` +
        `<a href="${escHtml(link.data("sequences.mmd"))}">Mermaid sequence diagrams</a>, and ` +
        `<a href="${escHtml(link.data("sequences.json"))}">JSON</a>.</p>` +
        `<table class="am-props"><thead><tr><th>Sequence</th><th>Source</th><th>Participants</th><th>Steps</th></tr></thead><tbody>` +
        link.sequences.sequences
          .map(
            (s) =>
              `<tr><td>${s.viewId && link.view ? `<a href="${escHtml(link.view(s.viewId))}">${escHtml(s.title)}</a>` : escHtml(s.title)}</td>` +
              `<td>${escHtml(s.source)}</td>` +
              `<td>${s.participants.map((p) => (p.elementId ? `<a href="${escHtml(link.element(p.elementId))}">${escHtml(p.name)}</a>` : escHtml(p.name))).join(", ")}</td>` +
              `<td>${s.messages.length}</td></tr>`,
          )
          .join("") +
        `</tbody></table>`
      : "") +
    `<p class="am-type">Relationship table: ArchiMate ${escHtml(mm.archimateVersion)} Appendix B as Archi holds it (MIT).</p>` +
    // A click on a box lands on its row: open the row's element list.
    `<script>(function(){function o(){var t=location.hash&&document.getElementById(decodeURIComponent(location.hash.slice(1)));` +
    `var d=t&&t.querySelector("details");if(d)d.open=true;}addEventListener("hashchange",o);o();})();</script>` +
    `</main>`
  );
}

/**
 * A thin page `depth` directories below the graph's root; `tail`, a
 * declaration after its script. `toData` links the page's directory to the
 * loader, wherever the run keeps it (`pagesFor`).
 */
function thinPage(
  path: string,
  depth: number,
  title: string,
  jsonld: string,
  node: PageNode,
  body: string,
  tail: string | undefined,
  toData: (from: string, rel: string) => string,
): Written {
  const up = "../".repeat(depth);
  const dir = posix.dirname(path);
  return {
    path,
    page: true,
    content: thinPageHtml({
      title,
      jsonld,
      script: toData(dir, `${up}${LOADER}`),
      renderer: toData(dir, `${up}${KG_RENDER_ASSET}`),
      stylesheet: toData(dir, `${up}${STYLE}`),
      node,
      prefixes: PREFIXES,
      body,
      noscriptLead: `The page for ${escHtml(title)}`,
      ...(tail !== undefined ? { tail } : {}),
    }),
  };
}

/** The name, beside a view's drawing `<id>.svg`, of the copy of its figure as the source publication drew it (`figures[].asDrawn`). */
export const AS_DRAWN_SUFFIX = ".as-drawn.svg";

/**
 * An as-drawn SVG made fit to inline in a page: no XML prolog, DOCTYPE or
 * comments. Refused when it carries what a page must not run or embed — a
 * script, an event handler, a `javascript:` link, or an
 * `<object>`/`<embed>`/`<iframe>`/`<foreignObject>` (the IG content QA gate
 * refuses embedded objects).
 */
export function inlineSvg(svg: string, label: string): string {
  // Until nothing changes: one pass can join the halves of a nested `<!<!---->--` into a new comment.
  let body = svg;
  for (let prev = ""; prev !== body; ) {
    prev = body;
    body = body
      .replace(/<\?xml[\s\S]*?\?>/g, "")
      .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");
  }
  body = body.trim();
  if (!/^<svg[\s>]/.test(body)) throw new Error(`${label}: the as-drawn figure is not an SVG drawing`);
  // An unclosed comment or a markup declaration left would swallow the rest of the page.
  if (/<!/.test(body)) throw new Error(`${label}: the as-drawn figure carries an unclosed comment or a markup declaration, which a page must not inline`);
  const bad = /<(script|object|embed|iframe|foreignObject)[\s>/]/i.exec(body) ?? /\son[a-z]+\s*=/i.exec(body) ?? /javascript:/i.exec(body);
  if (bad) throw new Error(`${label}: the as-drawn figure carries ${JSON.stringify(bad[0].trim())}, which a page must not inline`);
  return body;
}

/**
 * The CSS-only switch on a view's page between the figure as the source
 * publication drew it and the model's view (issue #2368): two radios in a
 * fieldset, their labels styled as pill tabs, "As drawn" checked. `archimate.css` hides the drawing not
 * chosen (`.am-switch`, by `:has`), so with no script both still show. The
 * words are static, so `--pot` takes them like the rest of the page.
 */
export function asDrawnSwitch(label: string, svg: string, href: string): string {
  return (
    `<fieldset class="am-switch"><legend>Show the figure</legend>` +
    `<input type="radio" name="am-figure" id="am-show-drawn" value="drawn" checked><label for="am-show-drawn">As drawn</label>` +
    `<input type="radio" name="am-figure" id="am-show-model" value="model"><label for="am-show-model">ArchiMate</label></fieldset>` +
    `<figure class="am-figure am-as-drawn" aria-label="${escHtml(label)}, as drawn">${inlineSvg(svg, label)}` +
    `<figcaption>${escHtml(label)}, as drawn in the source publication · <a href="${escHtml(href)}">the drawing (SVG)</a></figcaption></figure>`
  );
}

/** A document figure the config maps to a view, with where the site holds its drawing and its page. */
export interface FigureTarget {
  /** The block holding the figure, relative to the layer root (`figures[].block`). */
  block: string;
  label: string;
  model: string;
  view: string;
  /** The view's name in the model. */
  viewName: string;
  /** Site-relative: the view drawn as SVG, which `archimate-pages --out` writes. */
  svg: string;
  /** Site-relative, with a trailing slash: the view's page, at the declared route. */
  page: string;
}

/**
 * Lays out every DOT a site build draws, before the pages are written.
 *
 * One Graphviz WebAssembly instance does not survive many layouts: its heap
 * grows with each one until a later layout fails with "Out of bounds memory
 * access" (smart-ra#221: the eleventh drawing of 0.3.0-draft.1). Loading is
 * async and `pagesFor` is not, so a first pass collects the DOTs, each is laid
 * out here, and a failed layout is retried once on a freshly loaded instance.
 * The function returned looks each drawing up, so the second pass is sync.
 */
export async function drawEveryDot(
  Graphviz: { load(): Promise<{ dot(dot: string): string }>; unload(): void },
  collect: (draw: (dot: string) => string) => unknown,
): Promise<(dot: string) => string> {
  const dots = new Set<string>();
  collect((dot) => {
    dots.add(dot);
    return "";
  });
  const svgs = new Map<string, string>();
  let gv = await Graphviz.load();
  for (const dot of dots) {
    try {
      svgs.set(dot, gv.dot(dot));
    } catch {
      Graphviz.unload();
      gv = await Graphviz.load();
      svgs.set(dot, gv.dot(dot));
    }
  }
  return (dot) => {
    const svg = svgs.get(dot);
    if (svg === undefined) throw new Error("drawEveryDot: a DOT the first pass did not collect");
    return svg;
  };
}

/**
 * Every figure the layer's config maps to a view (`figures`), with the site
 * paths `archimate-pages --out` writes for it, so a document site can show the
 * live drawing in the figure's place and link its page. Empty when the
 * layer holds no ArchiMate config or maps no figure. Reads only the models
 * a figure names.
 */
export function figureTargets(instanceRoot: string): FigureTarget[] {
  if (configPath(instanceRoot) === undefined) return [];
  const config = readConfig(instanceRoot);
  const figures = config.figures ?? [];
  if (figures.length === 0) return [];
  const dir = archimateDir(instanceRoot, config);
  const declFile = findDeclarationFile(instanceRoot)!;
  const decl = JSON.parse(readFileSync(join(instanceRoot, declFile), "utf8")) as Declaration;
  const graphPath = localDirOf(instanceRoot, dir).replace(/\/$/, "");
  const pageRoot = declaredPageRoot(decl, config.directory);
  const out: FigureTarget[] = [];
  for (const cm of config.models) {
    const mine = figures.filter((f) => f.model === cm.id);
    if (mine.length === 0) continue;
    const model = readArchimate(readFileSync(join(dir, cm.file)));
    const slugOf = planSlugs(model);
    for (const f of mine) {
      const v = model.views.find((x) => x.id === f.view);
      if (v === undefined) continue; // check-archimate reports it
      out.push({
        ...f,
        viewName: v.name,
        svg: posix.join(graphPath, cm.id, "view", `${v.id}.svg`),
        page: `${posix.join(pageRoot, cm.id, "view", slugOf.get(v.id) ?? v.id)}/`,
      });
    }
  }
  return out;
}

/**
 * The model as the loader reads it: the normalised model, without diagram
 * geometry (the SVG carries that), plus which views show each element and
 * relationship — computed once here rather than in every reader's browser.
 */
export function normalisedFor(model: ArchimateModel, file: string, slugOf?: Map<string, string>) {
  const inViews: Record<string, string[]> = {};
  for (const v of model.views) {
    const seen = new Set<string>();
    for (const n of v.nodes) if (n.kind === "element" && n.ref) seen.add(n.ref);
    for (const c of v.connections) if (c.relationship) seen.add(c.relationship);
    for (const id of seen) (inViews[id] ??= []).push(v.id);
  }
  return {
    $schema: "folio-archimate-normalised/v1",
    id: model.id,
    name: model.name,
    file,
    ...(model.documentation ? { documentation: model.documentation } : {}),
    properties: model.properties,
    elements: model.elements,
    relationships: model.relationships,
    views: model.views.map((v) => ({
      id: v.id,
      name: v.name,
      ...(v.viewpoint ? { viewpoint: v.viewpoint } : {}),
      ...(v.documentation ? { documentation: v.documentation } : {}),
      folder: v.folder,
    })),
    inViews,
    // Each view's and element's page segment where it is not its id (`schemas/slugs.ts`).
    ...(slugOf && slugOf.size ? { slugs: Object.fromEntries(slugOf) } : {}),
  };
}

/**
 * Files in the graph this generator wrote earlier and no longer would — found
 * by what they are: a page declaring an ArchiMate node ({@link isArchimatePage}), a node file,
 * a drawn view, the normalised model, or the loader. The models, the config
 * and any README are never candidates.
 */
/**
 * What a page points its renderer at, read from its markup: the node's data
 * (`rel="alternate"`), and the model and drawing (`data-kg-model`,
 * `data-kg-svg` on the node's element). Each relative to the page.
 */
export function pageDataOf(html: string): { node?: string; model?: string; svg?: string } {
  const get = (re: RegExp) => re.exec(html)?.[1];
  const out: { node?: string; model?: string; svg?: string } = {};
  const node = get(/<link rel="alternate" type="application\/ld\+json" href="([^"]*)">/);
  const model = get(/\sdata-kg-model="([^"]*)"/);
  const svg = get(/\sdata-kg-svg="([^"]*)"/);
  if (node !== undefined) out.node = node;
  if (model !== undefined) out.model = model;
  if (svg !== undefined) out.svg = svg;
  return out;
}

/** Is this page one of ours — by the node it declares (an ArchiMate class), not by its name or its directory? */
export function isArchimatePage(html: string): boolean {
  return pageNodeOf(html)?.rdfa.some((n) => n.types.some((t) => t.startsWith(ARCHIMATE_NS))) ?? false;
}

function orphans(root: string, wanted: Set<string>): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of existsSync(d) ? readdirSync(d, { withFileTypes: true }) : []) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        walk(p);
        continue;
      }
      if (wanted.has(p) || e.name.endsWith(".archimate") || e.name === "README.md" || e.name === CONFIG_FILE) continue;
      const ours =
        /\.(jsonld|svg|dot|mmd|puml)$/.test(e.name) ||
        e.name === "model.json" ||
        e.name === "metamodel.json" ||
        e.name === "data-model.json" ||
        e.name === "sequences.json" ||
        // A node's `.json` twin — never a `.json` that has no `.jsonld` beside it.
        (e.name.endsWith(".json") && existsSync(p.replace(/\.json$/, ".jsonld"))) ||
        p === join(root, LOADER) ||
        p === join(root, KG_RENDER_ASSET) ||
        p === join(root, STYLE) ||
        (e.name.endsWith(".html") && isArchimatePage(readFileSync(p, "utf8")));
      if (ours) out.push(p);
    }
  };
  walk(root);
  return out;
}

/** Each configured model's Archi file: where it is in the checkout, and its path under the data root. */
export function modelFilesFor(root: string): Array<{ file: string; source: string }> {
  const config = readConfig(root);
  const dir = archimateDir(root, config);
  return config.models.map((m) => ({ file: m.file, source: join(dir, m.file) })).filter((m) => existsSync(m.source));
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const instance = arg("instance");
  if (!instance) {
    console.error("usage: gen-archimate-pages.ts --instance <dir> (--out <site-dir> | [--check])");
    process.exit(2);
  }
  const out = arg("out");
  const check = process.argv.includes("--check");
  const root = resolve(instance);
  // `--pot` writes the template of every word the pages show
  // (`translations/<locale>/archimate.pot`, archimate-locales.ts); `--pot-check`
  // exits 1 when one is missing or stale.
  const potMode = process.argv.includes("--pot") || process.argv.includes("--pot-check");
  // A site build lays the metamodel's DOT out to SVG with Graphviz compiled to
  // WebAssembly (no JVM, no binary). If it cannot load, the page says so and
  // still offers the DOT and Mermaid.
  let drawDot: ((dot: string) => string) | undefined;
  if (out || potMode) {
    try {
      const { Graphviz } = await import("@hpcc-js/wasm-graphviz");
      drawDot = await drawEveryDot(Graphviz, (draw) => pagesFor(root, { site: true, drawDot: draw }));
    } catch (e) {
      console.warn(`! no metamodel drawing: @hpcc-js/wasm-graphviz would not load (${(e as Error).message})`);
    }
  }
  const { graphPath, pageRoot, files } = pagesFor(root, { requireServed: out === undefined && !potMode, site: out !== undefined || potMode, drawDot });
  const target = out ? join(resolve(out), graphPath) : archimateDir(root, readConfig(root));
  const siteFiles: SiteFile[] = files.map((f) => ({ path: sitePathOf({ graphPath, pageRoot }, f), content: f.content, page: f.page === true }));
  const tc = (() => {
    const parsed = TranslationConfigSchema.safeParse((readHarnessConfig(root) as { translation?: unknown } | null)?.translation ?? {});
    return parsed.success ? parsed.data : TranslationConfigSchema.parse({});
  })();
  if (potMode) {
    const name = (JSON.parse(readFileSync(join(root, findDeclarationFile(root)!), "utf8")) as { name: string }).name;
    const stale: string[] = [];
    for (const l of tc.supportedLocales.filter((x) => x !== tc.defaultLocale)) {
      const pot = formatArchimatePot(siteFiles, l, name);
      const p = join(root, tc.translationDir, l, `${CATALOGUE_STEM}.pot`);
      if (existsSync(p) && potWithoutTimestamp(readFileSync(p, "utf8")) === potWithoutTimestamp(pot)) continue;
      stale.push(relative(root, p));
      if (!process.argv.includes("--pot-check")) {
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, pot);
      }
    }
    if (process.argv.includes("--pot-check")) {
      if (stale.length) {
        for (const s of stale) console.error(`✗ ${s} is missing or stale`);
        console.error(`run: bun run cat-harness-tools/archimate/scripts/gen-archimate-pages.ts --instance ${instance} --pot`);
        process.exit(1);
      }
      console.log("✓ archimate templates current");
    } else console.log(stale.length ? stale.map((s) => `  wrote ${s}`).join("\n") : "✓ archimate templates current");
    process.exit(0);
  }
  if (out) {
    const locales = archimateLocales(root, tc.supportedLocales.filter((l) => l !== tc.defaultLocale), tc.translationDir);
    const catalogues = new Map(locales.map((l) => [l, readArchimateCatalogue(root, l, tc.translationDir)] as const));
    const localized = localizedArchimateFiles(siteFiles, catalogues, tc.defaultLocale);
    for (const f of localized.files) {
      const p = join(resolve(out), f.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.content);
    }
    for (const r of localized.reports) {
      console.log(`  ${r.locale}: ${r.pages} page(s), ${r.translated} segment(s) translated, ${r.untranslated} left in English${r.rejected.length ? `, ${r.rejected.length} rejected (placeholders differ)` : ""}`);
    }
    // Each model's Archi file, at the data path its page links and its node's
    // `schema:contentUrl` names (`<data root>/<file>`). A committed tree has it
    // there already; a site build must copy it, or the link is a 404.
    for (const m of modelFilesFor(root)) {
      const p = join(target, m.file);
      mkdirSync(dirname(p), { recursive: true });
      copyFileSync(m.source, p);
    }
  } else {
    const wanted = new Set(files.map((f) => join(target, f.path)));
    let stale = 0;
    for (const f of files) {
      const p = join(target, f.path);
      const current = existsSync(p) ? readFileSync(p, "utf8") : undefined;
      if (current === f.content) continue;
      if (check) {
        console.error(`✗ ${p} is ${current === undefined ? "missing" : "stale"}`);
        stale++;
      } else {
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, f.content);
      }
    }
    for (const p of orphans(target, wanted)) {
      if (check) {
        console.error(`✗ ${p} is an orphan — no node publishes it`);
        stale++;
      } else rmSync(p);
    }
    if (check && stale) {
      console.error(`${stale} file(s) out of date — run without --check`);
      process.exit(1);
    }
  }
  const pages = files.filter((f) => f.path.endsWith("/index.html")).length;
  const svgs = files.filter((f) => f.path.endsWith(".svg")).length;
  const where = out ? `${relative(process.cwd(), join(resolve(out), pageRoot))}/ (pages) and ${relative(process.cwd(), target)}/ (data)` : `${relative(process.cwd(), target)}/`;
  console.log(`${check ? "✓ current" : "wrote"}: ${instance} — ${pages} page(s), ${svgs} view drawing(s) in ${where}`);
}
