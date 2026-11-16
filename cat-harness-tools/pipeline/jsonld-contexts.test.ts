/**
 * `pipeline/jsonld-contexts.ts` — what counts as a used prefix, and how an
 * instance context is built from them (bean folio-assistant-63q4).
 */
import { describe, expect, test } from "bun:test";

import jsonld from "jsonld";

import {
  buildInstanceContext,
  curiePrefix,
  definitionPrefixes,
  documentUses,
  isContextDocument,
  ownBindings,
  usedPrefixes,
  type TermSource,
  type UsedPrefixes,
} from "./jsonld-contexts.ts";

const CONTENT_URL = "https://example.org/ns/content/v1.jsonld";
const remote = new Map<string, Record<string, unknown>>([
  [CONTENT_URL, { dcterms: "http://purl.org/dc/terms/", title: "dcterms:title", cites: { "@id": "cito:cites", "@type": "@id" }, meta: { "@id": "x:meta", "@type": "@json" } }],
]);
const keys = (u: UsedPrefixes) => [...u.keys()].sort();

describe("curiePrefix", () => {
  test("a CURIE has a prefix", () => {
    expect(curiePrefix("doco:Section")).toBe("doco");
    expect(curiePrefix("folio-assistant-core:Definition")).toBe("folio-assistant-core");
  });
  test("an IRI, a blank node, a keyword, a scheme or prose is not a CURIE", () => {
    for (const s of ["http://x.org/a", "https://x.org/a", "urn:isbn:123", "_:b0", "@id", "mailto:a@b.org", "data:text/plain,x", "ftp://x", "Note: something", "no colon", "x://y"]) {
      expect(curiePrefix(s)).toBeUndefined();
    }
  });
});

describe("usedPrefixes", () => {
  test("strings inside ARRAYS count — the case check-context-emission's walk missed", () => {
    const u = usedPrefixes({ "@type": ["doco:Section", "deo:Introduction"], tags: ["skos:x"] });
    expect(keys(u)).toEqual(["deo", "doco", "skos"]);
    expect([...u.get("doco")!]).toEqual(["iri"]);
    expect([...u.get("skos")!]).toEqual(["literal"]);
  });

  test("every @context subtree is skipped: a binding is not a use", () => {
    const u = usedPrefixes({ "@context": { oa: "http://www.w3.org/ns/oa#", label: "rdfs:label" }, "@graph": [{ "@context": { x: "fhir:y" }, "prov:wasDerivedFrom": "a" }] });
    expect(keys(u)).toEqual(["prov"]);
  });

  test("absolute IRIs and schemes are not CURIEs, in any position", () => {
    const u = usedPrefixes({ "@id": "https://x.org/a", "@type": "http://purl.org/spar/doco/Section", see: ["urn:x:y", "mailto:a@b"], "_:b": 1 });
    expect(keys(u)).toEqual([]);
  });

  test("keys and @type are IRI positions; plain values are literals", () => {
    const u = usedPrefixes({ "cito:cites": "qou:QOU.Torsion.x", label: "def:foo" });
    expect([...u.get("cito")!]).toEqual(["iri"]);
    expect([...u.get("qou")!]).toEqual(["literal"]);
    expect([...u.get("def")!]).toEqual(["literal"]);
  });

  test("a remote context's aliases count when the document names it", () => {
    const u = usedPrefixes({ "@context": [CONTENT_URL, { "@base": "https://b/" }], title: "T", cites: ["skos:z"] }, { remoteContexts: remote });
    expect(keys(u)).toEqual(["cito", "dcterms", "skos"]);
    // `cites` is @id-typed, so its value is an IRI position.
    expect([...u.get("skos")!]).toEqual(["iri"]);
  });

  test("an alias does NOT count when the document does not name that context", () => {
    expect(keys(usedPrefixes({ title: "T" }, { remoteContexts: remote }))).toEqual([]);
  });

  test("a @json value is data: its keys and strings are literals", () => {
    const u = usedPrefixes({ "@context": CONTENT_URL, meta: { "fhir:x": "oa:y" } }, { remoteContexts: remote });
    expect([...u.get("fhir")!]).toEqual(["literal"]);
    expect([...u.get("oa")!]).toEqual(["literal"]);
  });

  test("a full-IRI term counts the prefix whose namespace it is in, when given the namespaces", () => {
    const r = new Map([["u", { alternateOf: { "@id": "http://www.w3.org/ns/prov#alternateOf", "@type": "@id" } }]]);
    const ns = new Map([["http://www.w3.org/ns/prov#", "prov"]]);
    expect(keys(usedPrefixes({ "@context": "u", alternateOf: "x" }, { remoteContexts: r, namespacePrefixes: ns }))).toEqual(["prov"]);
    expect(keys(usedPrefixes({ "@context": "u", alternateOf: "x" }, { remoteContexts: r }))).toEqual([]);
  });
});

describe("ownBindings / isContextDocument", () => {
  test("a document's inline context binds a prefix; a CURIE-valued term does not", () => {
    const b = ownBindings({ "@context": [CONTENT_URL, { fhir: "https://smart.who.int/base/DataTypes.jsonld#", name: "rdfs:label" }] });
    expect([...b.keys()]).toEqual(["fhir"]);
  });
  test("a context-only file is a context document; a node is not", () => {
    expect(isContextDocument({ "@context": { a: "http://a/" } })).toBe(true);
    expect(isContextDocument({ "@context": "x", "@id": "y" })).toBe(false);
  });
});

describe("buildInstanceContext", () => {
  const doc = (used: Record<string, ("iri" | "literal")[]>, own: Record<string, string> = {}) => ({
    used: new Map(Object.entries(used).map(([p, pos]) => [p, new Set(pos)])),
    own: new Map(Object.entries(own)),
  });
  const base = { instance: "base", prefixes: { dcterms: "http://purl.org/dc/terms/", skos: "http://www.w3.org/2004/02/skos/core#" } };
  const top = { instance: "top", prefixes: { bibo: "http://purl.org/ontology/bibo/", fabio: "http://purl.org/spar/fabio/" } };

  test("flattens over needs, and binds ONLY what is used", () => {
    const r = buildInstanceContext({ instance: "top", tables: [base, top], documents: new Map([["a.jsonld", doc({ dcterms: ["iri"], bibo: ["iri"] })], ["b.jsonld", doc({ dcterms: ["literal"] })]]) });
    expect(r.context).toEqual({ "@version": 1.1, "@protected": true, bibo: "http://purl.org/ontology/bibo/", dcterms: "http://purl.org/dc/terms/" });
    expect(r.bound.find((b) => b.prefix === "dcterms")!.documents).toBe(2);
    expect(r.unresolved).toEqual([]);
    expect(r.conflicts).toEqual([]);
    // skos and fabio are declared and unused: absent, with nothing to excuse.
    expect("skos" in r.context || "fabio" in r.context).toBe(false);
  });

  test("an unresolved prefix is reported, never dropped silently; a literal-only one is reported apart", () => {
    const r = buildInstanceContext({ instance: "top", tables: [base, top], documents: new Map([["a.jsonld", doc({ oa: ["iri"], qou: ["literal"] })], ["b.jsonld", doc({ oa: ["literal"] })]]) });
    expect(r.unresolved).toEqual([{ prefix: "oa", positions: ["iri", "literal"], documents: ["a.jsonld", "b.jsonld"] }]);
    expect(r.literalOnly).toEqual([{ prefix: "qou", positions: ["literal"], documents: ["a.jsonld"] }]);
    expect(Object.keys(r.context)).toEqual(["@version", "@protected"]);
  });

  test("a prefix the document binds itself is resolved and not put in the instance context", () => {
    const r = buildInstanceContext({ instance: "top", tables: [base], documents: new Map([["ig.jsonld", doc({ fhir: ["iri"] }, { fhir: "https://smart.who.int/base/DataTypes.jsonld#" })]]) });
    expect(r.unresolved).toEqual([]);
    expect("fhir" in r.context).toBe(false);
  });

  test("a conflict is reported and the prefix is left OUT, not resolved by order", () => {
    const clash = { instance: "top", prefixes: { dcterms: "http://example.org/not-dcterms/" } };
    const r = buildInstanceContext({ instance: "top", tables: [base, clash], documents: new Map([["a.jsonld", doc({ dcterms: ["iri"] })]]) });
    expect(r.conflicts.map((c) => c.prefix)).toEqual(["dcterms"]);
    expect("dcterms" in r.context).toBe(false);
  });
});

describe("usedPrefixes — inline full-IRI terms", () => {
  test("an INLINE full-IRI term speaks no prefix (a SMART IG's generatedAt)", () => {
    const ns = new Map([["http://www.w3.org/ns/prov#", "prov"]]);
    const doc = { "@context": { generatedAt: { "@id": "http://www.w3.org/ns/prov#generatedAtTime" } }, generatedAt: "2026-01-01" };
    expect([...usedPrefixes(doc, { namespacePrefixes: ns }).keys()]).toEqual([]);
  });
});

describe("documentUses — remote-context terms", () => {
  const remoteC = new Map<string, Record<string, unknown>>([
    [CONTENT_URL, { dcterms: "http://purl.org/dc/terms/", title: "dcterms:title", cites: { "@id": "cito:cites", "@type": "@id" }, Section: "doco:Section" }],
    ["https://third.party/ctx", { activity: "http://www.w3.org/ns/prov#activity" }],
  ]);

  test("a key or @type value that is a remote term is recorded with its context and definition, verbatim", () => {
    const { terms } = documentUses({ "@context": CONTENT_URL, "@type": "Section", title: "T", cites: ["a"], "dcterms:x": "y" }, { remoteContexts: remoteC });
    expect([...terms.keys()].sort()).toEqual(["Section", "cites", "title"]);
    expect(terms.get("cites")).toEqual({ context: CONTENT_URL, definition: { "@id": "cito:cites", "@type": "@id" } });
  });

  test("a term the document redefines inline is its own, not the remote one", () => {
    const { terms } = documentUses({ "@context": [CONTENT_URL, { title: "http://example.org/title" }], title: "T" }, { remoteContexts: remoteC });
    expect(terms.size).toBe(0);
  });

  test("no context named, no terms; a third-party context's terms are recorded with THAT context", () => {
    expect(documentUses({ title: "T" }, { remoteContexts: remoteC }).terms.size).toBe(0);
    const { terms } = documentUses({ "@context": "https://third.party/ctx", activity: "x" }, { remoteContexts: remoteC });
    expect(terms.get("activity")!.context).toBe("https://third.party/ctx");
  });

  test("usedPrefixes is unchanged by the term record", () => {
    const doc = { "@context": CONTENT_URL, title: "T", cites: ["skos:z"] };
    expect([...usedPrefixes(doc, { remoteContexts: remoteC }).keys()].sort()).toEqual([...documentUses(doc, { remoteContexts: remoteC }).prefixes.keys()].sort());
  });
});

describe("definitionPrefixes", () => {
  test("@id, @type, @reverse and a scoped context's terms; never @container or a full IRI", () => {
    expect(definitionPrefixes("dcterms:title")).toEqual(["dcterms"]);
    expect(definitionPrefixes({ "@id": "cito:cites", "@type": "@id", "@container": "@set" })).toEqual(["cito"]);
    expect(definitionPrefixes({ "@id": "x:a", "@type": "xsd:integer" })).toEqual(["x", "xsd"]);
    expect(definitionPrefixes({ "@reverse": "prov:used" })).toEqual(["prov"]);
    expect(definitionPrefixes({ "@id": "http://a.org/b", "@context": { after: { "@id": "ch:after", "@type": "@id" } } })).toEqual(["ch"]);
    expect(definitionPrefixes({ "@id": "http://www.w3.org/ns/prov#alternateOf", "@type": "@id" })).toEqual([]);
  });
});

describe("buildInstanceContext — terms", () => {
  const dcterms = "http://purl.org/dc/terms/";
  const cito = "http://purl.org/spar/cito/";
  const harness = { instance: "harness", prefixes: { dcterms, cito } };
  const top = { instance: "top", prefixes: {} };
  const contentCtx = { dcterms, cito, title: "dcterms:title", cites: { "@id": "cito:cites", "@type": "@id", "@container": "@set" } };
  const sources = new Map<string, TermSource>([[CONTENT_URL, { instance: "harness", context: contentCtx }]]);
  const doc = (terms: Record<string, unknown>, context = CONTENT_URL) => ({
    used: new Map(),
    own: new Map(),
    terms: new Map(Object.entries(terms).map(([t, definition]) => [t, { context, definition }])),
  });

  test("a used term is defined verbatim, after the prefixes, and its definition's prefixes are bound", () => {
    const r = buildInstanceContext({ instance: "top", tables: [harness, top], termSources: sources, documents: new Map([["a.jsonld", doc({ cites: contentCtx.cites })]]) });
    expect(r.context).toEqual({ "@version": 1.1, "@protected": true, cito, cites: { "@id": "cito:cites", "@type": "@id", "@container": "@set" } });
    expect(Object.keys(r.context)).toEqual(["@version", "@protected", "cito", "cites"]);
    expect(r.terms).toEqual([{ term: "cites", context: CONTENT_URL, documents: 1 }]);
    expect(r.bound).toEqual([{ prefix: "cito", iri: cito, documents: 1 }]);
    // `title` is defined in the source and unused: absent — nothing a later layer uses is carried.
    expect("title" in r.context).toBe(false);
  });

  test("the copy is a copy: mutating the context does not touch the source definition", () => {
    const r = buildInstanceContext({ instance: "top", tables: [harness, top], termSources: sources, documents: new Map([["a.jsonld", doc({ cites: contentCtx.cites })]]) });
    (r.context.cites as Record<string, unknown>)["@id"] = "changed";
    expect(contentCtx.cites["@id"]).toBe("cito:cites");
  });

  test("a term from a context whose owner the instance does not need is reported, not carried", () => {
    const r = buildInstanceContext({ instance: "top", tables: [top], termSources: sources, documents: new Map([["a.jsonld", doc({ title: "dcterms:title" })]]) });
    expect("title" in r.context).toBe(false);
    expect(r.unresolvedTerms).toEqual([{ term: "title", context: CONTENT_URL, reason: "its context belongs to `harness`, which top does not need", documents: ["a.jsonld"] }]);
  });

  test("a term from a context it does not stand in for (third-party) is neither carried nor reported", () => {
    const r = buildInstanceContext({ instance: "top", tables: [harness, top], termSources: sources, documents: new Map([["a.jsonld", doc({ activity: "prov:activity" }, "https://third.party/ctx")]]) });
    expect(r.terms).toEqual([]);
    expect(r.unresolvedTerms).toEqual([]);
  });

  test("a term whose prefix the table binds to a DIFFERENT IRI than its context is reported, not silently re-meant", () => {
    const other = { instance: "harness", prefixes: { dcterms: "http://example.org/not-dcterms/", cito } };
    const r = buildInstanceContext({ instance: "top", tables: [other, top], termSources: sources, documents: new Map([["a.jsonld", doc({ title: "dcterms:title" })]]) });
    expect("title" in r.context).toBe(false);
    expect(r.unresolvedTerms[0]!.reason).toContain("means http://purl.org/dc/terms/ in its context but http://example.org/not-dcterms/");
  });

  test("a term whose prefix no table binds is reported", () => {
    const r = buildInstanceContext({ instance: "top", tables: [{ instance: "harness", prefixes: {} }, top], termSources: sources, documents: new Map([["a.jsonld", doc({ title: "dcterms:title" })]]) });
    expect(r.unresolvedTerms.map((u) => u.reason)).toEqual(["its prefix `dcterms` is bound by no instance in the flattened table"]);
  });

  test("a term defined two ways is a conflict, left out, both definitions named", () => {
    const r = buildInstanceContext({
      instance: "top",
      tables: [harness, top],
      termSources: sources,
      documents: new Map([["a.jsonld", doc({ title: "dcterms:title" })], ["b.jsonld", doc({ title: { "@id": "dcterms:title", "@language": "en" } })]]),
    });
    expect("title" in r.context).toBe(false);
    expect(r.termConflicts.map((c) => [c.term, c.definitions.map((d) => d.documents)])).toEqual([["title", [["a.jsonld"], ["b.jsonld"]]]]);
  });

  test("the same definition with keys in another order is ONE definition", () => {
    const r = buildInstanceContext({
      instance: "top",
      tables: [harness, top],
      termSources: sources,
      documents: new Map([["a.jsonld", doc({ cites: { "@id": "cito:cites", "@type": "@id" } })], ["b.jsonld", doc({ cites: { "@type": "@id", "@id": "cito:cites" } })]]),
    });
    expect(r.termConflicts).toEqual([]);
    expect(r.terms).toEqual([{ term: "cites", context: CONTENT_URL, documents: 2 }]);
  });

  test("the same IRI spelled as a CURIE in one context and in full in another is ONE definition", () => {
    // The content context writes `dcterms:title`; the generated subgraph
    // context writes the full IRI. Comparing the text failed derive:publish.
    const SUB = "https://example.org/harness/ns/subgraph/v1.jsonld";
    const subCtx = { title: `${dcterms}title`, cites: { "@id": `${cito}cites`, "@type": "@id", "@container": "@set" } };
    const both = new Map<string, TermSource>([...sources, [SUB, { instance: "harness", context: subCtx }]]);
    const r = buildInstanceContext({
      instance: "top",
      tables: [harness, top],
      termSources: both,
      documents: new Map([
        ["a.jsonld", doc({ title: "dcterms:title", cites: contentCtx.cites })],
        ["b.jsonld", doc({ title: subCtx.title, cites: subCtx.cites }, SUB)],
      ]),
    });
    expect(r.termConflicts).toEqual([]);
    expect(r.terms.map((t) => [t.term, t.documents])).toEqual([["cites", 2], ["title", 2]]);
  });

  test("a CURIE whose prefix means another IRI is still a conflict", () => {
    const SUB = "https://example.org/harness/ns/subgraph/v1.jsonld";
    const both = new Map<string, TermSource>([...sources, [SUB, { instance: "harness", context: { title: "http://other.example/title" } }]]);
    const r = buildInstanceContext({
      instance: "top",
      tables: [harness, top],
      termSources: both,
      documents: new Map([["a.jsonld", doc({ title: "dcterms:title" })], ["b.jsonld", doc({ title: "http://other.example/title" }, SUB)]]),
    });
    expect(r.termConflicts.map((c) => c.term)).toEqual(["title"]);
  });

  test("a term sharing its name with a bound prefix is a conflict, never resolved by order", () => {
    const r = buildInstanceContext({
      instance: "top",
      tables: [harness, top],
      termSources: sources,
      documents: new Map([["a.jsonld", { ...doc({ dcterms: "cito:x" }), used: new Map([["dcterms", new Set(["iri" as const])]]) }]]),
    });
    expect(r.context.dcterms).toBe(dcterms);
    expect(r.termConflicts.map((c) => c.term)).toEqual(["dcterms"]);
  });
});

describe("the generated context stands in for the remote one with no triple lost", () => {
  // A small content context, a document naming it, and the instance context
  // built from that document. Both expansions must give the same quads.
  const contentCtx = {
    "@version": 1.1,
    cito: "http://purl.org/spar/cito/",
    dcterms: "http://purl.org/dc/terms/",
    ch: "https://example.org/ch/ns#",
    title: "dcterms:title",
    cites: { "@id": "cito:cites", "@type": "@id", "@container": "@set" },
    meta: { "@id": "ch:meta", "@type": "@json" },
    tags: { "@id": "ch:tag", "@container": "@set" },
  };
  const GEN = "https://example.org/top/ns/context/v1.jsonld";
  const doc = { "@context": [CONTENT_URL, { "@base": "https://example.org/top/" }], "@id": "a", "@type": "dcterms:BibliographicResource", title: "A", cites: ["b", "c"], meta: { "fhir:x": [1, 2] } };

  test("same quads, and fewer without the term definitions", async () => {
    const remoteC = new Map([[CONTENT_URL, contentCtx as Record<string, unknown>]]);
    const uses = documentUses(doc, { remoteContexts: remoteC });
    const tables = [{ instance: "harness", prefixes: { cito: contentCtx.cito, dcterms: contentCtx.dcterms, ch: contentCtx.ch } }];
    const built = buildInstanceContext({
      instance: "harness",
      tables,
      termSources: new Map([[CONTENT_URL, { instance: "harness", context: contentCtx }]]),
      documents: new Map([["a.jsonld", { used: uses.prefixes, own: new Map(), terms: uses.terms }]]),
    });
    expect(built.unresolvedTerms).toEqual([]);
    const contexts = new Map<string, unknown>([[CONTENT_URL, { "@context": contentCtx }], [GEN, { "@context": built.context }]]);
    const documentLoader = async (url: string) => ({ contextUrl: null, documentUrl: url, document: contexts.get(url) });
    const quads = async (d: unknown): Promise<string[]> =>
      ((await jsonld.toRDF(d as jsonld.JsonLdDocument, { format: "application/n-quads", documentLoader, safe: true } as unknown as jsonld.Options.ToRdf)) as unknown as string)
        .split("\n")
        .filter(Boolean)
        .sort();
    const before = await quads(doc);
    const after = await quads({ ...doc, "@context": [GEN, { "@base": "https://example.org/top/" }] });
    expect(before.length).toBe(5);
    expect(after).toEqual(before);

    // The control: prefixes alone (what the context held before terms) lose the term-keyed triples.
    const prefixOnly = Object.fromEntries(Object.entries(built.context).filter(([k]) => !built.terms.some((t) => t.term === k)));
    contexts.set(GEN, { "@context": prefixOnly });
    const lossy = await quads({ ...doc, "@context": [GEN, { "@base": "https://example.org/top/" }] }).catch(() => []);
    expect(lossy.length).toBeLessThan(before.length);
  });
});
