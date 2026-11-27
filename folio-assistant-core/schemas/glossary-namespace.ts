/**
 * A layer's namespace document, with its glossary concepts in it.
 *
 * Every glossary concept a layer mints is named under its namespace,
 * `<iriBase>v<major>/ns/` (`instanceNamespaceOf`, `schemeIri` and `termIri`
 * in `glossary.ts`). The harness tools publish that address with the classes
 * and properties a layer mints (`publish-instance-context.ts vocab`), but
 * not its glossary concepts, so every concept IRI was a 404 on every
 * instance (owner, 2026-11-18, option 1A). This builds the namespace
 * document WITH them: one entry per scheme and per concept in the
 * machine-readable graph, and one anchor per concept in the page a person
 * reads, so `<ns>#glossary/<scheme>/<term>` lands on the concept's entry and
 * `<ns>glossary/<scheme>/<term>` has an entry naming it.
 *
 * The anchor of a concept is its IRI with the namespace taken off
 * (`glossary/<scheme>/<term>`). That is the fragment the hash spelling of a
 * concept IRI would carry, so the page serves either spelling of the
 * concept's address; which spelling the IRIs take is decided separately.
 *
 * Pure: no file is read or written here. `scripts/glossary-page.ts` writes
 * the document into a site being built.
 *
 * @module schemas/glossary-namespace
 * @graphNode none — a rendering of the glossary graph, not a schema of it
 *
 * @conformsTo w3c-skos
 * @conformsTo w3c-rdf
 */
import { schemeIri, termIri, type Glossary, type LangText } from "./glossary.ts";

/** One scheme as the namespace document needs it. */
export interface NamespaceScheme {
  glossary: Pick<Glossary, "id" | "title" | "description" | "terms">;
  /** Where the scheme's full SKOS is published, relative to the namespace document's directory. */
  skos?: string;
  /** A term's own page, relative to the namespace document's directory, when it has one. */
  pageOf?: (termId: string) => string | undefined;
}

/** The JSON-LD `@context` the concept entries are written against. */
export const NAMESPACE_CONTEXT: Readonly<Record<string, unknown>> = {
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  dcterms: "http://purl.org/dc/terms/",
  label: "rdfs:label",
  comment: "rdfs:comment",
  isDefinedBy: { "@id": "rdfs:isDefinedBy", "@type": "@id" },
  seeAlso: { "@id": "rdfs:seeAlso", "@type": "@id" },
  prefLabel: "skos:prefLabel",
  definition: "skos:definition",
  inScheme: { "@id": "skos:inScheme", "@type": "@id" },
};

type Node = Record<string, unknown>;

const firstText = (t: LangText | undefined): string | undefined =>
  t === undefined ? undefined : typeof t === "string" ? t : (t.en ?? Object.values(t)[0]);

/**
 * The scheme and concept entries of a namespace: every concept whose IRI is
 * minted in `ns`. A term that names its own concept IRI elsewhere (`iri`) is
 * not this namespace's to serve and is left out.
 */
export function glossaryConceptNodes(ns: string, schemes: readonly NamespaceScheme[]): Node[] {
  const nodes: Node[] = [];
  for (const s of schemes) {
    const g = s.glossary;
    const scheme = schemeIri(ns, g);
    nodes.push({
      "@id": scheme,
      "@type": "skos:ConceptScheme",
      prefLabel: g.title,
      ...(g.description ? { definition: g.description } : {}),
      isDefinedBy: ns,
      ...(s.skos ? { seeAlso: s.skos } : {}),
    });
    for (const t of g.terms) {
      if (t.iri) continue;
      const page = s.pageOf?.(t.id);
      const definition = firstText(t.definition);
      nodes.push({
        "@id": termIri(ns, g, t.id),
        "@type": "skos:Concept",
        inScheme: scheme,
        prefLabel: firstText(t.prefLabel),
        ...(definition ? { definition } : {}),
        isDefinedBy: ns,
        ...(page ? { seeAlso: page } : {}),
      });
    }
  }
  return nodes;
}

/**
 * The namespace document: `base` (the layer's vocabulary as the tools build
 * it, when there is one) with the concept entries added, or a document of
 * the concepts alone. An entry `base` already holds is kept as it is.
 */
export function namespaceDocument(instance: string, ns: string, concepts: readonly Node[], base?: Node): Node {
  if (base !== undefined && base["@id"] !== ns) {
    throw new Error(`the vocabulary's @id ${String(base["@id"])} is not the namespace ${ns}`);
  }
  const graph = [...(((base?.["@graph"] as Node[] | undefined) ?? []) as Node[])];
  const held = new Set(graph.map((n) => expand(String(n["@id"]), base?.["@context"])));
  const added = concepts.filter((n) => !held.has(String(n["@id"])));
  const context = { ...NAMESPACE_CONTEXT, ...((base?.["@context"] as Node | undefined) ?? {}) };
  const { "@context": _c, "@id": _i, "@type": type, label, "@graph": _g, ...rest } = base ?? {};
  return {
    "@context": context,
    "@id": ns,
    "@type": type ?? "owl:Ontology",
    label: label ?? `${instance} namespace`,
    ...rest,
    "@graph": [...graph, ...added],
  };
}

/** A compact `prefix:local` id expanded against a context's prefixes; anything else as given. */
function expand(id: string, context: unknown): string {
  const m = /^([A-Za-z][\w.-]*):(?!\/\/)(.*)$/.exec(id);
  if (!m || typeof context !== "object" || context === null) return id;
  const p = (context as Record<string, unknown>)[m[1]!];
  return typeof p === "string" ? `${p}${m[2]}` : id;
}

/** An entry's anchor in the namespace page: its IRI with the namespace taken off, or undefined when it is not in the namespace. */
export function anchorIn(ns: string, iri: string): string | undefined {
  return iri.startsWith(ns) && iri.length > ns.length ? iri.slice(ns.length) : undefined;
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object" && "@value" in (v as Node)) return String((v as Node)["@value"]);
  return String(v);
};

/**
 * The page a static host serves at the namespace's address: one list item
 * per entry, each with the anchor {@link anchorIn} gives it, and the whole
 * document as `application/ld+json` for an agent (a static host cannot
 * negotiate content type, so one page carries both).
 */
export function namespaceHtml(instance: string, ns: string, doc: Node): string {
  const context = doc["@context"];
  const graph = ((doc["@graph"] as Node[] | undefined) ?? []).filter((n) => typeof n["@id"] === "string");
  const rows = graph
    .map((n) => {
      const iri = expand(String(n["@id"]), context);
      const anchor = anchorIn(ns, iri);
      const label = text(n["prefLabel"] ?? n["label"]) ?? iri;
      const def = text(n["definition"] ?? n["comment"]);
      const more = typeof n["seeAlso"] === "string" ? ` <a href="${escHtml(n["seeAlso"])}">more</a>` : "";
      const id = anchor === undefined ? "" : ` id="${escHtml(anchor)}"`;
      return `<li${id}><code>${escHtml(iri)}</code> ${escHtml(label)}${def === undefined ? "" : ` — ${escHtml(def)}`}${more}</li>`;
    })
    .join("\n");
  // `</` cannot appear inside the script element, so it is escaped in the JSON.
  const json = JSON.stringify(doc, null, 2).replace(/<\//g, "<\\/");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(instance)} namespace</title>
<link rel="alternate" type="application/ld+json" href="index.jsonld">
<script type="application/ld+json">
${json}
</script>
</head>
<body>
<h1>${escHtml(instance)} namespace</h1>
<p>Namespace <code>${escHtml(ns)}</code>. Machine-readable: <a href="index.jsonld">index.jsonld</a>.</p>
<ul>
${rows}
</ul>
</body>
</html>
`;
}

/**
 * Where the namespace document is written under a site published at
 * `siteBase`: the namespace's directory, holding `index.html` (what a static
 * host serves for `…/ns/`, and for `…/ns` by redirect), `index.jsonld` and
 * `index.json` (a static host sends no JSON-LD content type). Undefined when
 * the namespace is not under that site.
 */
export function namespacePaths(ns: string, siteBase: string): { html: string; jsonld: string; json: string } | undefined {
  const base = siteBase.endsWith("/") ? siteBase : `${siteBase}/`;
  if (!ns.startsWith(base)) return undefined;
  const rel = ns.slice(base.length).replace(/[#/]+$/, "");
  if (rel === "") return undefined;
  return { html: `${rel}/index.html`, jsonld: `${rel}/index.jsonld`, json: `${rel}/index.json` };
}

// ── A page at every IRI the namespace mints (owner, 2026-11-19) ───────────
//
// Glossary concept IRIs keep the slash form, one path per term:
// `<ns>glossary/<scheme>/<term>`, with `#label-<lang>` fragments on it
// (owner decision, 2026-11-19: not #anchors on the namespace page). A static
// host serves such a path only from `<path>/index.html`, so the namespace
// page's anchors alone left every concept a 404 (`check:site-iris`, 63 on
// smart-ra). {@link resourcePages} writes that page for every node a
// published JSON-LD document mints under the namespace, read from the very
// document that mints it, so what is minted and what is served cannot drift.

/** A published JSON-LD document whose top-level nodes this site serves, with what each node's page links back to. */
export interface ServedDocument {
  doc: Node;
  /** Links shown at the head of the page of the node with this IRI; `href` is site-relative, without a leading `/`. */
  linksOf?: (iri: string) => ReadonlyArray<{ label: string; href: string }>;
}

/** A property's name as a reader reads it; anything not named here is shown compact. */
const PROPERTY_LABELS: Readonly<Record<string, string>> = {
  "skos:prefLabel": "Label",
  "skosxl:prefLabel": "Label resources",
  "skosxl:literalForm": "Label",
  "skos:altLabel": "Also called",
  "skos:definition": "Definition",
  "skos:scopeNote": "Scope note",
  "skos:editorialNote": "Editorial note",
  "skos:example": "Example",
  "skos:note": "Note",
  "skos:notation": "Code",
  "skos:inScheme": "In scheme",
  "skos:broader": "Broader",
  "skos:related": "Related",
  "skos:exactMatch": "Exact match",
  "skos:closeMatch": "Close match",
  "skos:broadMatch": "Broad match",
  "skos:narrowMatch": "Narrow match",
  "skos:memberList": "Members, in order",
  "skos:member": "Members",
  "fa:translationStatus": "Translation status",
  "dcterms:source": "Source",
  "dcterms:requires": "Requires",
  "dcterms:subject": "Subject",
  "rdfs:isDefinedBy": "Defined by",
  "rdfs:label": "Label",
  "foaf:focus": "About",
};

/** The prefixes a document's `@context` binds, an array of contexts included (a context named by URL binds none here). */
function prefixesOf(context: unknown): Record<string, unknown> {
  const parts = Array.isArray(context) ? context : [context];
  return Object.assign({}, ...parts.filter((p): p is Node => typeof p === "object" && p !== null));
}

/**
 * Where a static host serves `iri` in a site published at `siteBase`: the
 * site-relative directory whose `index.html` it is, and its fragment. Undefined
 * outside the site, and for the site root.
 */
export function servedPath(iri: string, siteBase: string): { dir: string; fragment?: string } | undefined {
  const base = siteBase.endsWith("/") ? siteBase : `${siteBase}/`;
  if (!iri.startsWith(base)) return undefined;
  const hash = iri.indexOf("#");
  const dir = (hash === -1 ? iri : iri.slice(0, hash)).slice(base.length).replace(/\/+$/, "");
  if (dir === "") return undefined;
  return hash === -1 ? { dir } : { dir, fragment: iri.slice(hash + 1) };
}

/**
 * One page per IRI the documents mint under `ns` (the namespace itself
 * excepted: {@link namespaceHtml} is its page), keyed by its site-relative
 * path `<dir>/index.html`. A node whose IRI has a fragment is a section of its
 * document's page, with that fragment as its `id`, so `…/<term>#label-fr`
 * lands on the French label. Each page shows every property of its nodes,
 * labels and definitions in each language, matches as links, and the node's
 * JSON-LD for an agent.
 */
export function resourcePages(ns: string, siteBase: string, docs: readonly ServedDocument[]): Map<string, string> {
  const nsPath = servedPath(ns, siteBase)?.dir;
  const groups = new Map<string, { iri: string; nodes: Array<{ node: Node; fragment?: string }>; context: unknown; linksOf?: ServedDocument["linksOf"] }>();
  for (const d of docs) {
    const context = d.doc["@context"];
    const prefixes = prefixesOf(context);
    for (const node of ((d.doc["@graph"] as Node[] | undefined) ?? []).filter((n) => typeof n["@id"] === "string")) {
      const iri = expand(String(node["@id"]), prefixes);
      if (anchorIn(ns, iri) === undefined) continue;
      const at = servedPath(iri, siteBase);
      if (at === undefined || at.dir === nsPath) continue;
      const g = groups.get(at.dir) ?? { iri: iri.split("#")[0]!, nodes: [], context, linksOf: d.linksOf };
      g.nodes.push({ node, ...(at.fragment !== undefined ? { fragment: at.fragment } : {}) });
      groups.set(at.dir, g);
    }
  }
  const out = new Map<string, string>();
  for (const [dir, g] of groups) out.set(`${dir}/index.html`, resourceHtml(dir, g.iri, g.nodes, g.context, siteBase, g.linksOf));
  return out;
}

function resourceHtml(
  dir: string,
  iri: string,
  nodes: ReadonlyArray<{ node: Node; fragment?: string }>,
  context: unknown,
  siteBase: string,
  linksOf: ServedDocument["linksOf"],
): string {
  const prefixes = prefixesOf(context);
  const up = "../".repeat(dir.split("/").length);
  const base = siteBase.endsWith("/") ? siteBase : `${siteBase}/`;
  const href = (target: string): string => (target.startsWith(base) ? `${up}${target.slice(base.length)}` : target);
  const own = nodes.find((n) => n.fragment === undefined)?.node;
  const sections = nodes.filter((n) => n.fragment !== undefined);
  const labelOf = (n: Node | undefined): string | undefined => {
    if (n === undefined) return undefined;
    const vals = [n["skos:prefLabel"], n["skosxl:literalForm"], n["rdfs:label"], n["prefLabel"], n["label"]].find((v) => v !== undefined);
    const list = (Array.isArray(vals) ? vals : vals === undefined ? [] : [vals]) as unknown[];
    const en = list.find((v) => typeof v === "object" && v !== null && (v as Node)["@language"] === "en");
    return text(en ?? list[0]);
  };
  const title = labelOf(own) ?? iri;
  const value = (v: unknown): string => {
    if (Array.isArray(v)) return v.length === 1 ? value(v[0]) : `<ul>${v.map((x) => `<li>${value(x)}</li>`).join("")}</ul>`;
    if (v === null || v === undefined) return "";
    if (typeof v === "object") {
      const o = v as Node;
      if ("@value" in o) {
        const lang = typeof o["@language"] === "string" ? o["@language"] : undefined;
        return lang ? `<span lang="${escHtml(lang)}">${escHtml(String(o["@value"]))}</span> <small>(${escHtml(lang)})</small>` : escHtml(String(o["@value"]));
      }
      if ("@list" in o) return `<ol>${((o["@list"] as unknown[]) ?? []).map((x) => `<li>${value(x)}</li>`).join("")}</ol>`;
      if (typeof o["@id"] === "string") {
        const target = expand(o["@id"], prefixes);
        return `<a href="${escHtml(href(target))}"><code>${escHtml(target)}</code></a>`;
      }
      return `<code>${escHtml(JSON.stringify(o))}</code>`;
    }
    const s = String(v);
    return /^https?:\/\//.test(s) ? `<a href="${escHtml(href(s))}">${escHtml(s)}</a>` : escHtml(s);
  };
  const props = (n: Node): string => {
    const rows = Object.entries(n)
      .filter(([k]) => k !== "@id" && k !== "@type" && k !== "@context")
      .map(([k, v]) => `<dt>${escHtml(PROPERTY_LABELS[k] ?? k)}</dt><dd>${value(k === "@graph" ? ((v as Node[]) ?? []).map((x) => ({ "@id": x["@id"] })) : v)}</dd>`);
    return rows.length ? `<dl>\n${rows.join("\n")}\n</dl>` : "";
  };
  const typeLine = (n: Node): string => {
    const t = n["@type"];
    return t === undefined ? "" : `<p class="type">${(Array.isArray(t) ? t : [t]).map((x) => `<code>${escHtml(String(x))}</code>`).join(" ")}</p>`;
  };
  const links = (linksOf?.(iri) ?? []).map((l) => `<a href="${escHtml(`${up}${l.href}`)}">${escHtml(l.label)}</a>`).join(" · ");
  const json = JSON.stringify({ "@context": context, "@graph": nodes.map((n) => n.node) }, null, 2).replace(/<\//g, "<\\/");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)}</title>
<link rel="canonical" href="${escHtml(iri)}">
<script type="application/ld+json">
${json}
</script>
</head>
<body>
<h1>${escHtml(title)}</h1>
<p><code>${escHtml(iri)}</code></p>
${links ? `<p class="links">${links}</p>\n` : ""}${own ? `${typeLine(own)}\n${props(own)}\n` : ""}${sections
    .map((s) => `<section id="${escHtml(s.fragment!)}">\n<h2>${escHtml(labelOf(s.node) ?? s.fragment!)}</h2>\n<p><code>${escHtml(`${iri}#${s.fragment}`)}</code></p>\n${typeLine(s.node)}\n${props(s.node)}\n</section>`)
    .join("\n")}
</body>
</html>
`;
}
