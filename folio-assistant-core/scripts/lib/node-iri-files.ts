/**
 * Each content node published where its IRI says it is.
 *
 * A block, paper or library node names itself by a relative `@id`
 * (`papers/<doc>/blocks/<label>`, `library/<entry>/sections/<id>`) against
 * the `@base` of its context. Since cat-harness-tools#2454 (IRI fix 1A, a;
 * owner 2026-11-18) that base is the layer's own release, `<iriBase>v<major>/`,
 * so the node's IRI is `<iriBase>v<major>/<@id>`. The document site published
 * block nodes only as data under `<doc>/kg/…`, a path no IRI names, and
 * library nodes nowhere, so every node IRI was a 404. This computes the two
 * files that make one resolve on the site published at `<iriBase>`:
 *
 * - `v<major>/<@id>/index.html`: the page any static host serves at the
 *   extensionless IRI (not only GitHub Pages, which also answers `<path>.html`),
 *   showing the node's properties, embedding it, and linking to where a
 *   person reads it in context;
 * - `v<major>/<@id>/index.jsonld`: the node, as the generator writes it now.
 *
 * Minting and serving are one decision, made here. The site publishes a node
 * in three places (`<doc>/kg/…`, `<doc>/graph.jsonld`, and at its IRI), and
 * each takes the node's text as the generator writes it now ({@link
 * atCurrentBase}, or the regenerated node) and its IRI from {@link nodeIri},
 * so a copy cannot name an IRI the site does not serve. Before, the `kg/`
 * copy and `graph.jsonld` carried the node AS COMMITTED: on a folio whose
 * nodes still named the old shared base, every block was minted at
 * `https://litlfred.github.io/folio/papers/…` (`check:site-iris`
 * `foreign-base`, 933 on smart-ra), and `graph.jsonld`'s members, whose
 * `@base` sits in each member's own context, resolved against the graph
 * file's own URL, `<iriBase><doc>/papers/…`, a path nothing serves (933
 * `unserved`). {@link graphDocument} writes each member's `@id` absolute.
 *
 * A committed node still carrying the old shared base (`FOLIO_BASE`) is
 * published under its layer's release base, as the generator now writes it
 * ({@link atCurrentBase}): until the content layers regenerate, that is
 * where its IRI is.
 *
 * @module scripts/lib/node-iri-files
 * @graphNode none — a site build step over content nodes, not a schema
 *
 * @conformsTo w3c-json-ld
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { corpusDirectoriesForGraph } from "@litlfred/cat-harness-tools/schemas/kg/harness-config.ts";
import { libraryEntriesIn } from "@litlfred/cat-harness-tools/pipeline/gen-library-jsonld.ts";
import { atInstanceContext } from "@litlfred/cat-harness-tools/pipeline/instance-document-context.js";
import { CONTENT_CONTEXT_URL, FOLIO_BASE } from "@litlfred/cat-harness-tools/schemas/kg/jsonld.js";

/** A node to publish: its text as written at its path, and the page a person reads it on (site-relative), when it has one. */
export interface PublishedNode {
  text: string;
  /** The file the node was read from, named in a collision. */
  source: string;
  /** Site-relative path of the page showing the node, with any `#anchor`. */
  page?: string;
}

/** The `@base` a node's context declares, when it declares one. */
function baseOf(doc: Record<string, unknown>): string | undefined {
  const ctx = doc["@context"];
  for (const c of Array.isArray(ctx) ? ctx : [ctx]) {
    if (c !== null && typeof c === "object" && typeof (c as Record<string, unknown>)["@base"] === "string") return (c as Record<string, string>)["@base"];
  }
  return undefined;
}

/** A node's IRI: its `@id` resolved against its context's `@base`, without a fragment. Undefined when it has none or it does not resolve. */
export function nodeIri(text: string): string | undefined {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const id = doc["@id"];
  if (typeof id !== "string" || id === "" || id.startsWith("_:")) return undefined;
  try {
    const u = new URL(id, baseOf(doc));
    u.hash = "";
    return u.href;
  } catch {
    return undefined;
  }
}

/**
 * Where a node with IRI `iri` is served on the site published at `siteBase`:
 * its path there, without an extension. Undefined when the IRI is another
 * site's, or names a directory (a trailing slash) rather than a node.
 */
export function nodeSitePath(iri: string, siteBase: string): string | undefined {
  const base = siteBase.endsWith("/") ? siteBase : `${siteBase}/`;
  if (!iri.startsWith(base)) return undefined;
  const rel = iri.slice(base.length).split("?")[0]!;
  if (rel === "" || rel.endsWith("/") || rel.split("/").some((s) => s === "" || s === "." || s === "..")) return undefined;
  return decodeURIComponent(rel);
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A property value as a reader reads it: text as text, an IRI as a link, anything else as compact JSON. */
function valueHtml(v: unknown): string {
  if (Array.isArray(v)) return v.length === 1 ? valueHtml(v[0]) : `<ul>${v.map((x) => `<li>${valueHtml(x)}</li>`).join("")}</ul>`;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("@value" in o) return escHtml(String(o["@value"]));
    return `<code>${escHtml(JSON.stringify(o))}</code>`;
  }
  const s = String(v);
  return /^https?:\/\//.test(s) ? `<a href="${escHtml(s)}">${escHtml(s)}</a>` : escHtml(s);
}

/**
 * The page served at a node's IRI, `<rel>/index.html`: the node's label, type
 * and properties, the node embedded as JSON-LD, its data file beside it, and
 * the page a person reads it on, when it has one.
 */
export function nodePage(iri: string, rel: string, text: string, page?: string): string {
  let doc: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) doc = parsed as Record<string, unknown>;
  } catch {
    // shown as its IRI and its data, with no properties
  }
  const title = typeof doc["label"] === "string" && doc["label"] !== "" ? doc["label"] : rel.split("/").pop()!;
  const up = "../".repeat(rel.split("/").length);
  const read = page === undefined ? "" : `<p>Read it in context: <a href="${escHtml(up + page)}">${escHtml(page)}</a>.</p>\n`;
  const t = doc["@type"];
  const types = t === undefined ? "" : `<p class="type">${(Array.isArray(t) ? t : [t]).map((x) => `<code>${escHtml(String(x))}</code>`).join(" ")}</p>\n`;
  const rows = Object.entries(doc)
    .filter(([k]) => k !== "@context" && k !== "@id" && k !== "@type")
    .map(([k, v]) => `<dt>${escHtml(k)}</dt><dd>${valueHtml(v)}</dd>`);
  const props = rows.length ? `<dl>\n${rows.join("\n")}\n</dl>\n` : "";
  // `</` cannot appear inside the script element, so it is escaped in the JSON.
  const json = text.trimEnd().replace(/<\//g, "<\\/");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)}</title>
<link rel="alternate" type="application/ld+json" href="index.jsonld">
<script type="application/ld+json">
${json}
</script>
</head>
<body>
<h1>${escHtml(title)}</h1>
<p><code>${escHtml(iri)}</code></p>
${read}${types}${props}<p>Machine-readable: <a href="index.jsonld">index.jsonld</a>.</p>
</body>
</html>
`;
}

/**
 * Where the files serving a node at site path `rel` go: `<rel>/index.html`,
 * which every static host answers the extensionless IRI with, and the node
 * itself beside it as `<rel>/index.jsonld`.
 */
export function nodeServedFiles(rel: string): { html: string; jsonld: string } {
  return { html: `${rel}/index.html`, jsonld: `${rel}/index.jsonld` };
}

/**
 * A graph document of `texts` (each one node as the generator writes it): a
 * `@graph` of the nodes, each `@id` written as the absolute IRI {@link nodeIri}
 * mints for it. A member's `@base` is in its own context, and a reader that
 * resolves the graph's relative `@id`s against the graph file's URL (the
 * document has no `@base` of its own) would place every node beside the
 * graph file, where nothing is served; an absolute `@id` reads one way only.
 */
export function graphDocument(texts: readonly string[]): string {
  const graph = texts.map((t) => {
    const node = JSON.parse(t) as Record<string, unknown>;
    const iri = nodeIri(t);
    if (iri === undefined || typeof node["@id"] !== "string") return node;
    const hash = node["@id"].indexOf("#");
    return { ...node, "@id": hash === -1 ? iri : `${iri}${node["@id"].slice(hash)}` };
  });
  return `${JSON.stringify({ "@graph": graph })}\n`;
}

/**
 * The files that serve each node at its IRI on the site published at
 * `siteBase`, site-relative path → content, and the nodes two sources claim
 * with different content (each is an error: one IRI, two nodes). A node
 * whose IRI is another site's is left out.
 */
export function nodeIriFiles(nodes: readonly PublishedNode[], siteBase: string): { files: Map<string, string>; collisions: string[] } {
  const files = new Map<string, string>();
  const from = new Map<string, string>();
  const collisions: string[] = [];
  for (const n of nodes) {
    const iri = nodeIri(n.text);
    if (iri === undefined) continue;
    const rel = nodeSitePath(iri, siteBase);
    if (rel === undefined) continue;
    const { html, jsonld } = nodeServedFiles(rel);
    const prior = files.get(jsonld);
    if (prior !== undefined) {
      if (prior !== n.text) collisions.push(`${iri}: published by both ${from.get(jsonld)} and ${n.source}, with different content`);
      continue;
    }
    files.set(jsonld, n.text);
    from.set(jsonld, n.source);
    files.set(html, nodePage(iri, rel, n.text, n.page));
  }
  return { files, collisions };
}

/** Every `.jsonld` file under `dir`, recursively, sorted. */
function jsonldUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...jsonldUnder(p));
    else if (e.endsWith(".jsonld")) out.push(p);
  }
  return out;
}

/**
 * A committed node's text as the generator writes it now: one whose context
 * still names the old shared `@base` is moved to its layer's release, by the
 * write boundary's own rule (`atInstanceContext`), and anything else is
 * returned unchanged. The committed file names its layer's context already,
 * which `atInstanceContext` leaves alone, so it is handed the shared context
 * the generator starts from.
 */
export function atCurrentBase(text: string, path: string): string {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return text;
  }
  const ctx = doc["@context"];
  if (!Array.isArray(ctx) || baseOf(doc) !== FOLIO_BASE) return text;
  const moved = atInstanceContext({ ...doc, "@context": [CONTENT_CONTEXT_URL, ...ctx.slice(1)] }, path);
  if (baseOf(moved) === FOLIO_BASE) return text;
  // The emitters' one format.
  return `${JSON.stringify({ ...moved, "@context": [ctx[0], ...(moved["@context"] as unknown[]).slice(1)] }, null, 2)}\n`;
}

/**
 * The library nodes of the layer at `root`: every `.jsonld` of every entry in
 * each library it declares, as the generator would write it at its path.
 * They have no page of their own on a document site.
 */
export function libraryNodes(root: string): PublishedNode[] {
  const nodes: PublishedNode[] = [];
  for (const lib of corpusDirectoriesForGraph(root, "library").filter((d) => existsSync(d))) {
    for (const { dir } of libraryEntriesIn(lib)) {
      for (const p of jsonldUnder(dir)) nodes.push({ text: atCurrentBase(readFileSync(p, "utf-8"), p), source: p });
    }
  }
  return nodes;
}
