/**
 * JSON-LD contexts for L1 graph documents, generated from the same Zod layer
 * specs as the ontology JSON and the FHIR artefacts, so the three cannot drift.
 *
 *   l1.context.jsonld          smart-kg's own, rebuilt the way smart-kg
 *                              `tools/build-exports.mjs` builds it (`buildContext`).
 *                              No longer compared with WHO's file: smart-kg is
 *                              deprecated (owner, 2026-10-16).
 *   l1-library.context.jsonld  the context an `l1-library` document names. It is
 *                              the same base over L1 + l1-library, plus three
 *                              additions without which the document does not
 *                              survive as RDF.
 *
 * ## The three additions, and why
 *
 * Measured 2026-10-08 by expanding the Leave-no-one-behind L1 graph with
 * jsonld.js under smart-kg's context: 1,400 triples, but
 *
 * 1. **no node kept its class.** A node's `type` is a class id
 *    ("publication-section"); the base context maps class NAMES
 *    ("PublicationSection"), has no `@vocab`, and so drops every class id.
 *    → `@vocab` is the smart-kg namespace, whose class IRIs ARE
 *    `<namespace><class id>`.
 * 2. **every property collapsed into one predicate.** `properties` is an
 *    `@index` container, so `"pageRange": "11-12"` becomes
 *    `sgkg:properties "11-12"` and the name is gone.
 *    → `properties` is `@nest`: each property is a statement about its node.
 *    A property the class inherits from Dublin Core (`parent: DublinCore`)
 *    is `dcterms:<name>`; a `uri`-typed one is an IRI, not a string.
 * 3. **a predicate the base does not know vanished.** `specializationOf` is
 *    l1-library's. → every predicate in scope maps to its declared `iri`
 *    (for L1's own that is `<namespace><predicate>`, as the base does).
 *
 * The base stays smart-kg's, unchanged: an `l1` document means what smart-kg
 * says it means. The three are proposed upstream rather than patched in.
 */
import type { ClassSpec, LayerSpec, PropertySpec } from "./ontology.ts";

/** smart-kg `build-exports.mjs` `camel`: "Publication section" → "PublicationSection". */
const camel = (name: string): string =>
  name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => (/^[A-Z0-9]+$/.test(w) ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join("");

export const contextUrl = (layer: string): string => `http://smart.who.int/kg/${layer}.context.jsonld`;

/** smart-kg `buildContext`, over the layer and everything it imports. */
export function baseContext(scope: LayerSpec[]): Record<string, unknown> {
  const ns = scope[0]!.namespace;
  const aliases: Record<string, string> = {};
  const predicates: Record<string, { "@id": string }> = {};
  // smart-kg lists imported terms first, then the layer's own.
  for (const l of [...scope].reverse()) {
    for (const p of l.predicates) predicates[p.predicate] = { "@id": `sgkg:${p.predicate}` };
    for (const c of l.classes) aliases[camel(c.name)] = `sgkg:${c.id}`;
  }
  return {
    "@context": {
      "@version": 1.1,
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      owl: "http://www.w3.org/2002/07/owl#",
      skos: "http://www.w3.org/2004/02/skos/core#",
      dcterms: "http://purl.org/dc/terms/",
      prov: "http://www.w3.org/ns/prov#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
      sgkg: ns,
      id: "@id",
      type: "@type",
      label: { "@id": "rdfs:label" },
      properties: { "@id": "sgkg:properties", "@container": "@index" },
      nodes: { "@id": "sgkg:node", "@container": "@set" },
      edges: { "@id": "sgkg:edge", "@container": "@set" },
      Statement: "rdf:Statement",
      Entity: "prov:Entity",
      predicate: { "@id": "rdf:predicate", "@type": "@vocab" },
      source: { "@id": "rdf:subject", "@type": "@id" },
      target: { "@id": "rdf:object", "@type": "@id" },
      qualifier: { "@id": "sgkg:qualifier" },
      derivation: { "@id": "sgkg:derivation" },
      evidence: { "@id": "sgkg:evidence" },
      location: { "@id": "sgkg:location" },
      quote: { "@id": "sgkg:quote" },
      note: { "@id": "skos:note" },
      skill: { "@id": "sgkg:skill" },
      generatedAt: { "@id": "prov:generatedAtTime", "@type": "xsd:dateTime" },
      wasDerivedFrom: { "@id": "prov:wasDerivedFrom", "@type": "@id" },
      ontologyVersion: { "@id": "sgkg:ontologyVersion" },
      ...predicates,
      ...aliases,
    },
  };
}

/** One property's term: Dublin Core when inherited from it, an IRI when uri-typed. */
function propertyTerm(c: ClassSpec, name: string, p: PropertySpec): string | Record<string, unknown> {
  const id = p.inherited && c.parent?.name === "DublinCore" ? `dcterms:${name}` : `sgkg:${name}`;
  if (p.fhir === "uri") return { "@id": id, "@type": "@id" };
  if (p.children) {
    // A backbone ({type, value}): its `type` is a field, not the node's @type.
    const scoped: Record<string, unknown> = {};
    for (const child of Object.keys(p.children)) scoped[child] = `sgkg:${name}.${child}`;
    return { "@id": id, "@context": scoped };
  }
  return id;
}

/** The context an `l1-library` (or any extension) document names: the base plus the three additions. */
export function extensionContext(scope: LayerSpec[]): Record<string, unknown> {
  const base = baseContext(scope)["@context"] as Record<string, unknown>;
  const terms: Record<string, unknown> = {};
  const seen = new Map<string, string>();
  for (const l of [...scope].reverse()) {
    for (const c of l.classes) {
      for (const [name, p] of Object.entries(c.properties)) {
        // Top-level document terms (label, note, …) keep their meaning; a
        // property name is only added where it is not already a term.
        if (name in base) continue;
        const term = propertyTerm(c, name, p);
        const key = JSON.stringify(term);
        // One name, one meaning across classes — refused otherwise, never chosen silently.
        if (seen.has(name) && seen.get(name) !== key) throw new Error(`property "${name}" maps to two terms: ${seen.get(name)} and ${key}`);
        seen.set(name, key);
        terms[name] = term;
      }
    }
  }
  const predicates: Record<string, { "@id": string }> = {};
  for (const l of scope) for (const p of l.predicates) predicates[p.predicate] = { "@id": p.iri };
  return {
    "@context": {
      ...base,
      "@vocab": base.sgkg,
      properties: { "@id": "@nest" },
      ...terms,
      ...predicates,
    },
  };
}

/** Dublin Core names a property maps to `dcterms:` under, wherever it appears. */
export const DUBLIN_CORE = ["title", "creator", "publisher", "issued", "modified", "language", "rights", "description", "identifier", "source"] as const;

/**
 * The context an L2, L2-BPMN, L2-DMN or L3 document names. These layers have
 * properties named like document terms (`type` on a data element, `source`
 * on nearly every class), so `properties` cannot be `@nest` as it is for
 * `l1-library`: under `@nest` those names would become the node's class and an
 * edge's subject, and jsonld.js ignores a scoped context on a `@nest` term.
 * Instead `properties` is a node with its own scoped context (the form
 * litlfred/smart-kg#2 measured): every property is named, `@vocab` gives the
 * rest their ontology IRI, Dublin Core names go to `dcterms:`, a name shared
 * with a document term keeps its own meaning, and a `uri` property is an IRI.
 * The cost is one blank-node hop: `node sgkg:properties _:p . _:p dcterms:title "…"`.
 */
export function scopedContext(scope: LayerSpec[]): Record<string, unknown> {
  const base = baseContext(scope)["@context"] as Record<string, unknown>;
  const ns = base.sgkg as string;
  const inner: Record<string, unknown> = { "@vocab": ns };
  const iriTyped = new Map<string, boolean>();
  for (const l of scope) {
    for (const c of l.classes) {
      for (const [name, p] of Object.entries(c.properties)) {
        const isIri = p.fhir === "uri";
        // One name, one meaning: a name that is an IRI in one class and a literal in another is refused.
        if (iriTyped.has(name) && iriTyped.get(name) !== isIri) throw new Error(`property "${name}" is uri-typed in one class and not in another`);
        iriTyped.set(name, isIri);
      }
    }
  }
  for (const [name, isIri] of [...iriTyped].sort(([a], [b]) => a.localeCompare(b))) {
    const id = (DUBLIN_CORE as readonly string[]).includes(name) ? `dcterms:${name}` : `sgkg:${name}`;
    const clashes = name in base;
    if (isIri) inner[name] = { "@id": id, "@type": "@id" };
    else if (clashes || id.startsWith("dcterms:")) inner[name] = id;
  }
  const predicates: Record<string, { "@id": string }> = {};
  for (const l of scope) for (const p of l.predicates) predicates[p.predicate] = { "@id": p.iri };
  return {
    "@context": {
      ...base,
      "@vocab": ns,
      properties: { "@id": "sgkg:properties", "@context": inner },
      ...predicates,
    },
  };
}
