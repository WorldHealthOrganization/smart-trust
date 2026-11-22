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
 * - `v<major>/<@id>.jsonld`: the node, as the generator writes it now;
 * - `v<major>/<@id>.html`: a page a static host serves at the extensionless
 *   IRI, embedding the node and linking to where a person reads it.
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

/** The page served at a node's IRI: the node embedded as JSON-LD, its data file, and the page a person reads it on. */
export function nodePage(iri: string, rel: string, text: string, page?: string): string {
  const name = rel.split("/").pop()!;
  const up = "../".repeat(rel.split("/").length - 1);
  const read = page === undefined ? "" : `<p>Read it in context: <a href="${escHtml(up + page)}">${escHtml(page)}</a>.</p>\n`;
  // `</` cannot appear inside the script element, so it is escaped in the JSON.
  const json = text.trimEnd().replace(/<\//g, "<\\/");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(name)}</title>
<link rel="alternate" type="application/ld+json" href="${escHtml(name)}.jsonld">
${page === undefined ? "" : `<link rel="canonical" href="${escHtml(up + page)}">\n`}<script type="application/ld+json">
${json}
</script>
</head>
<body>
<h1><code>${escHtml(iri)}</code></h1>
${read}<p>Machine-readable: <a href="${escHtml(name)}.jsonld">${escHtml(name)}.jsonld</a>.</p>
</body>
</html>
`;
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
    const jsonld = `${rel}.jsonld`;
    const prior = files.get(jsonld);
    if (prior !== undefined) {
      if (prior !== n.text) collisions.push(`${iri}: published by both ${from.get(jsonld)} and ${n.source}, with different content`);
      continue;
    }
    files.set(jsonld, n.text);
    from.set(jsonld, n.source);
    files.set(`${rel}.html`, nodePage(iri, rel, n.text, n.page));
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
