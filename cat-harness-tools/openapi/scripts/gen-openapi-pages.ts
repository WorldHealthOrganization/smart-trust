#!/usr/bin/env bun
/**
 * Write a JSON-LD node and a thin page for every OpenAPI document a layer
 * holds, and for every OPERATION in each — the "page + IRI for each operation"
 * the owner asked for (2026-10-03, bean `s4ta`).
 *
 * @module cat-harness/openapi/scripts/gen-openapi-pages
 * @covers openapi
 * @conformsTo w3c-hydra
 *
 * Usage:
 *   bun run cat-harness-tools/openapi/scripts/gen-openapi-pages.ts --instance <instance-dir> [--check]
 *
 * ## What is written, INSIDE the layer's `openapi` graph
 *
 * | path (under the graph's directory) | what |
 * |---|---|
 * | `<doc>.openapi.json`, `<doc>.source.json` | the document and its provenance — the INGEST's, never written here |
 * | `<doc>.jsonld`, `.json` | the document as a node: its operations, each by IRI |
 * | `<doc>/operation/<op>.jsonld`, `.json` | one operation; its `@id` is this address less `.jsonld` |
 * | `<doc>/` | the document's RENDERING: a thin page listing the operations, at the document's IRI |
 * | `<doc>/operation/<op>/` | the operation's RENDERING: a thin page, drawn Swagger-style, at the operation's IRI |
 * | `assets/kg-render.js` | the generic renderer every page loads first (`scripts/templates/kg-render.js`) |
 * | `assets/openapi.js`, `assets/openapi.css` | the OpenAPI renderer it dispatches to, and its style |
 *
 * IRIs are extensionless, `…/openapi/<doc>` and `…/openapi/<doc>/operation/<op>`
 * (owner, Q-THIN-2 = A and Q-THIN-4 = A, issue #1830: a clean break from the
 * `.jsonld` IRIs and from `<doc>/<op>`). The page is in the directory the IRI
 * names, so the host serves it at the IRI and no stub is needed. Every page
 * DECLARES its node in RDFa and a JSON-LD stub (`thin-page.ts`).
 *
 * **In the graph, not in `docs/`.** Owner: *"kind is an OpenAPI node"* — an
 * operation is a node OF the openapi graph, so its IRI sits under that
 * graph's path (`<base>/<instance>/openapi/<doc>/operation/<op>`). It also keeps
 * this generator out of a directory another one owns: `gen-ig-pages.ts`
 * treats every file under an IG layer's `docs/` as its own output and
 * reports anything else there as an orphan — measured on the first version of
 * this harness, which wrote `docs/api/` and had the two generators deleting
 * each other's files. The graph is `served`, so its bytes publish verbatim at
 * `/<instance>/<path>`: a thin page is complete HTML and needs no Jekyll.
 *
 * `.json` beside `.jsonld` because GitHub Pages serves no correct
 * Content-Type for `.jsonld` (the `todo-graph` precedent). No `.schema.json`:
 * an operation carries no per-node schema of its own, and the rule is that
 * whatever a node HAS is reachable, not that a missing form is invented.
 *
 * ## Nothing of the API is copied into a page
 *
 * `visualizer-loading`: a page holds identity, layout and a pointer. An
 * operation page's config names the document (relative to the page, so a
 * staging preview works), the method and the path — and the loader fetches
 * the document and draws the parameters, request body, responses and schemas
 * from it. The JSON-LD nodes carry identity only: id, method, path, summary.
 *
 * ## A directory that is not served gets no page
 *
 * `visualizer-loading` §"Where the data is served from": a generator whose
 * data is not served writes no page that would fetch it, and says why.
 *
 * ## Vocabularies — borrowed, not minted
 *
 * A document is a `schema:WebAPI`; an operation is a `hydra:Operation` (W3C
 * Hydra core), with `hydra:method`, `hydra:title` and `hydra:description`;
 * its path is a `schema:urlTemplate` and its id a `schema:identifier`; it is
 * `dcterms:isPartOf` its document, which lists it as `hydra:supportedOperation`.
 * Nothing is minted in this project's namespaces.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { DOCS_SITE_BASE } from "../../schemas/kg/jsonld.ts";
import { KG_RENDER_ASSET, escHtml, kgRenderScript, nodeAttrs, pageNodeOf, thinPageHtml, type PageNode } from "../../scripts/thin-page.ts";
import { OpenApiDocumentSchema, OpenApiProvenanceSchema, operationsOf, type OpenApiOperation } from "../schemas/openapi.ts";
import { CONFIG_FILE, localDirOf, openapiDir, readConfig } from "./ingest-openapi.ts";
import { findDeclarationFile } from "../../schemas/kg/cat-harness.ts";
import { TOOLS_ROOT } from "../../scripts/lib/roots.ts";

/**
 * The classes a page written here declares its node as (`typeof`, issue
 * #1830) — how a run recognises its own output, and what the loader
 * registers with the generic renderer for.
 */
export const WEB_API = "https://schema.org/WebAPI";
export const HYDRA_OPERATION = "http://www.w3.org/ns/hydra/core#Operation";
/** The prefixes a page's `typeof` is written over. */
const PREFIXES = { schema: "https://schema.org/", hydra: "http://www.w3.org/ns/hydra/core#" };
/** The kind segment of an operation's IRI and paths: `<doc>/operation/<op>` (Q-THIN-2/4, singular). */
const OPERATION = "operation";
const LOADER = "assets/openapi.js";
const STYLE = "assets/openapi.css";
const TEMPLATES = join(TOOLS_ROOT, "openapi", "scripts", "templates");

export const CONTEXT = {
  schema: "https://schema.org/",
  hydra: "http://www.w3.org/ns/hydra/core#",
  dcterms: "http://purl.org/dc/terms/",
};

/** A site-relative path under the layer, as an absolute IRI. */
const iri = (instance: string, sitePath: string): string => `${DOCS_SITE_BASE}${instance}/${sitePath}`;

export interface Written {
  path: string;
  content: string;
}

/** Every file a run writes for one layer, keyed by its path under the layer's docs. */
export function pagesFor(instanceRoot: string): Written[] {
  const config = readConfig(instanceRoot);
  const dir = openapiDir(instanceRoot, config);
  // The declaration is FOUND, and the layer is its DECLARED name, never the
  // directory's: in an IG fork the directory is the base IG's checkout name and the
  // layer the fork's own (n3ni stage E), and the name is what every IRI below
  // extends, so the published IRIs stay the same wherever the layer lives.
  const declFile = findDeclarationFile(instanceRoot);
  if (declFile === undefined) throw new Error(`no instance declaration in ${resolve(instanceRoot)}`);
  const decl = JSON.parse(readFileSync(join(instanceRoot, declFile), "utf8")) as {
    name: string;
    directories: Array<{ id: string; served?: boolean; path: string }>;
  };
  const instance = decl.name;
  const entry = decl.directories.find((d) => d.id === config.directory)!;
  if (!entry.served) {
    throw new Error(
      `${instance}: directory "${entry.id}" is not declared \`served: true\`, so a page could not fetch its documents — ` +
        "no page is written (visualizer-loading §\"Where the data is served from\")",
    );
  }
  // The graph's path under /<instance>/ — `openapi` — which every IRI here extends.
  return pagesForGraph({ instance, config, dir, graphPath: localDirOf(instanceRoot, dir).replace(/\/$/, "") });
}

/**
 * The same files for a graph named directly rather than through a
 * declaration: `instance` is the name every IRI extends, `dir` holds the
 * documents and their provenance, `graphPath` is where the graph is served
 * under the layer. An IG repository's own site uses it (`ig-site-openapi.ts`),
 * since such a repository has no declaration (owner, 2026-10-14).
 */
export function pagesForGraph(o: { instance: string; config: ReturnType<typeof readConfig>; dir: string; graphPath: string }): Written[] {
  const { instance, config, dir, graphPath } = o;
  const out: Written[] = [];
  // For the graph's own index page (below): every document, and which
  // document each operation id belongs to.
  const listed: Array<{ id: string; title: string; version: string; ops: number }> = [];
  const opDoc: Record<string, string> = {};
  const json = (path: string, node: object) => {
    const text = `${JSON.stringify(node, null, 2)}\n`;
    out.push({ path: `${path}.jsonld`, content: text }, { path: `${path}.json`, content: text });
  };

  for (const d of config.documents) {
    const prov = OpenApiProvenanceSchema.parse(JSON.parse(readFileSync(join(dir, `${d.id}.source.json`), "utf8")));
    const doc = OpenApiDocumentSchema.parse(JSON.parse(readFileSync(join(dir, prov.file), "utf8")));
    const ops = operationsOf(doc);
    const title = d.title ?? doc.info.title;
    const docSite = d.id;
    listed.push({ id: d.id, title, version: doc.info.version, ops: ops.length });
    for (const o of ops) opDoc[o.id] ??= d.id;
    const docIri = iri(instance, `${graphPath}/${docSite}`);
    const opIri = (o: OpenApiOperation) => iri(instance, `${graphPath}/${docSite}/${OPERATION}/${o.id}`);
    const opSummary = (o: OpenApiOperation) => ({
      "@id": opIri(o),
      "@type": "hydra:Operation",
      "schema:identifier": o.id,
      "hydra:method": o.method.toUpperCase(),
      "schema:urlTemplate": o.path,
      ...(o.summary ? { "hydra:title": o.summary } : {}),
    });

    json(docSite, {
      "@context": CONTEXT,
      "@id": docIri,
      "@type": "schema:WebAPI",
      "schema:identifier": d.id,
      "schema:name": title,
      "schema:version": doc.info.version,
      ...(d.description ? { "schema:description": d.description } : {}),
      "dcterms:conformsTo": `https://spec.openapis.org/oas/v${doc.openapi}`,
      "dcterms:source": `https://github.com/${prov.source.repository}/blob/${prov.source.commit}/${prov.source.path}`,
      "schema:contentUrl": iri(instance, `${graphPath}/${prov.file}`),
      "hydra:supportedOperation": ops.map(opSummary),
    });

    // The document's page, one level into the graph: the document is at ../<file>.
    const docNode: PageNode = { iri: docIri, types: ["schema:WebAPI"] };
    out.push({
      path: `${docSite}/index.html`,
      content: thinPageHtml({
        title: `${title} ${doc.info.version}`,
        jsonld: `../${d.id}.jsonld`,
        script: `../${LOADER}`,
        renderer: `../${KG_RENDER_ASSET}`,
        stylesheet: `../${STYLE}`,
        node: docNode,
        prefixes: PREFIXES,
        body: `<main class="oa"${nodeAttrs(docNode)} data-kg-openapi="${escHtml(`../${prov.file}`)}"><h1>${escHtml(title)}</h1><div class="oa-body" aria-live="polite"><p>Loading the API…</p></div></main>`,
        noscriptLead: `The ${escHtml(title)} API page`,
      }),
    });

    for (const o of ops) {
      json(`${docSite}/${OPERATION}/${o.id}`, {
        "@context": CONTEXT,
        ...opSummary(o),
        ...(o.description ? { "hydra:description": o.description } : {}),
        ...(o.tags.length ? { "schema:keywords": o.tags } : {}),
        ...(o.deprecated ? { "schema:status": "deprecated" } : {}),
        "dcterms:isPartOf": docIri,
      });
      const heading = `${o.method.toUpperCase()} ${o.path}`;
      const opNode: PageNode = { iri: opIri(o), types: ["hydra:Operation"] };
      out.push({
        path: `${docSite}/${OPERATION}/${o.id}/index.html`,
        content: thinPageHtml({
          title: `${heading} — ${title}`,
          jsonld: `../${o.id}.jsonld`,
          script: `../../../${LOADER}`,
          renderer: `../../../${KG_RENDER_ASSET}`,
          stylesheet: `../../../${STYLE}`,
          node: opNode,
          prefixes: PREFIXES,
          // Identity only — what a link preview, search and a no-JS reader need.
          body:
            `<main class="oa"${nodeAttrs(opNode)} data-kg-openapi="${escHtml(`../../../${prov.file}`)}" data-kg-method="${escHtml(o.method)}" data-kg-path="${escHtml(o.path)}">` +
            `<p class="oa-up"><a href="../../">← ${escHtml(title)}</a></p>` +
            `<h1><span class="oa-m oa-m-${o.method}">${o.method.toUpperCase()}</span> <code>${escHtml(o.path)}</code></h1>` +
            `${o.summary ? `<p class="oa-sum">${escHtml(o.summary)}</p>` : ""}` +
            `<div class="oa-body" aria-live="polite"><p>Loading the operation…</p></div></main>`,
          noscriptLead: `The ${escHtml(heading)} page`,
        }),
      });
    }
  }
  // THE GRAPH'S OWN INDEX — `openapi/index.html`. An IG's pages link it the
  // way the Publisher's vendored Swagger UI is linked, often deep:
  // `openapi/index.html#/<tag>/<operationId>`. Nothing wrote it, so 43 links
  // on the first layer's pages led nowhere (#2235). It lists the documents held,
  // and sends a Swagger-style deep link to that operation's own page.
  out.push({
    path: "index.html",
    content:
      `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>API documents — ${escHtml(instance)}</title><link rel="stylesheet" href="${STYLE}"></head>\n<body><main class="oa">` +
      `<h1>API documents</h1><ul>` +
      listed.map((l) => `<li><a href="${encodeURI(l.id)}/">${escHtml(l.title)}</a> ${escHtml(l.version)} — ${l.ops} operation(s)</li>`).join("") +
      `</ul></main>\n<script>(function(){var m=/^#\\/[^/]+\\/([^/?#]+)/.exec(location.hash);var d=${JSON.stringify(opDoc).replace(/</g, "\\u003c")};` +
      `if(m&&Object.prototype.hasOwnProperty.call(d,m[1]))location.replace(encodeURIComponent(d[m[1]])+"/${OPERATION}/"+encodeURIComponent(m[1])+"/");})();</script>\n</body></html>\n`,
  });
  out.push(
    { path: LOADER, content: readFileSync(join(TEMPLATES, "openapi.js"), "utf8") },
    { path: KG_RENDER_ASSET, content: kgRenderScript() },
    { path: STYLE, content: readFileSync(join(TEMPLATES, "openapi.css"), "utf8") },
  );
  return out;
}

/**
 * Files in the graph this generator wrote earlier and no longer would — found
 * by what they are, never by where they sit: a page whose declared node is
 * {@link isOpenApiPage}, a node file (`.jsonld`, or `.json` that is neither a
 * document nor its provenance), or the loader. The ingest's own files and the
 * directory's README and config are never candidates.
 */
/** Is this page one of ours — by the node it declares, not by its name or its directory? */
export function isOpenApiPage(html: string): boolean {
  return pageNodeOf(html)?.rdfa.some((n) => n.types.some((t) => t === WEB_API || t === HYDRA_OPERATION)) ?? false;
}

function orphans(root: string, wanted: Set<string>): string[] {
  const out: string[] = [];
  const ingested = /\.(openapi|source)\.json$/;
  const walk = (d: string) => {
    for (const e of existsSync(d) ? readdirSync(d, { withFileTypes: true }) : []) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        walk(p);
        continue;
      }
      // The config, where a fork keeps it beside the documents (`configPath`), is never ours to remove.
      if (wanted.has(p) || ingested.test(e.name) || e.name === "README.md" || e.name === CONFIG_FILE) continue;
      const ours =
        e.name.endsWith(".jsonld") ||
        e.name.endsWith(".json") ||
        p === join(root, LOADER) ||
        p === join(root, KG_RENDER_ASSET) ||
        p === join(root, STYLE) ||
        (e.name === "index.html" && isOpenApiPage(readFileSync(p, "utf8")));
      if (ours) out.push(p);
    }
  };
  walk(root);
  return out;
}

if (import.meta.main) {
  const i = process.argv.indexOf("--instance");
  const instance = i >= 0 ? process.argv[i + 1] : undefined;
  if (!instance) {
    console.error("usage: gen-openapi-pages.ts --instance <dir> [--check]");
    process.exit(2);
  }
  const check = process.argv.includes("--check");
  const root = resolve(instance);
  const graph = openapiDir(root, readConfig(root));
  const files = pagesFor(root);
  const wanted = new Set(files.map((f) => join(graph, f.path)));
  let stale = 0;
  for (const f of files) {
    const p = join(graph, f.path);
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
  for (const p of orphans(graph, wanted)) {
    if (check) {
      console.error(`✗ ${p} is an orphan — no operation publishes it`);
      stale++;
    } else rmSync(p);
  }
  if (check && stale) {
    console.error(`${stale} file(s) out of date — run without --check`);
    process.exit(1);
  }
  const pages = files.filter((f) => f.path.endsWith("/index.html")).length;
  console.log(`${check ? "✓ current" : "wrote"}: ${instance} — ${pages} page(s) in ${relative(process.cwd(), graph)}/`);
}
