/**
 * The namespace document carries every glossary concept a layer mints
 * (owner, 2026-11-18, option 1A: every concept IRI was a 404 because no
 * instance served `<iriBase>v0/ns`).
 */
import { describe, expect, test } from "bun:test";

import { anchorIn, glossaryConceptNodes, namespaceDocument, namespaceHtml, namespacePaths, resourcePages, servedPath } from "./glossary-namespace.ts";
import type { Glossary } from "./glossary.ts";

const ns = "https://example.org/layer/v0/ns/";
const glossary = {
  id: "demo",
  title: "Demo terms",
  description: "A scheme for the test.",
  terms: [
    { id: "alpha", prefLabel: { en: "alpha", fr: "alpha (fr)" }, definition: "The first <term>.", status: "authored" },
    { id: "beta", prefLabel: "beta", status: "authored" },
    { id: "elsewhere", prefLabel: "elsewhere", iri: "https://other.example/concept/x", status: "authored" },
  ],
} as unknown as Glossary;

describe("glossaryConceptNodes", () => {
  test("one entry per scheme and per concept minted in the namespace", () => {
    const nodes = glossaryConceptNodes(ns, [{ glossary, skos: "../../assets/glossary/layer--demo.skos.jsonld", pageOf: (id) => (id === "alpha" ? "../../alpha/" : undefined) }]);
    expect(nodes.map((n) => n["@id"])).toEqual([`${ns}glossary/demo`, `${ns}glossary/demo/alpha`, `${ns}glossary/demo/beta`]);
    expect(nodes[0]).toMatchObject({ "@type": "skos:ConceptScheme", prefLabel: "Demo terms", seeAlso: "../../assets/glossary/layer--demo.skos.jsonld", isDefinedBy: ns });
    expect(nodes[1]).toMatchObject({ "@type": "skos:Concept", inScheme: `${ns}glossary/demo`, prefLabel: "alpha", definition: "The first <term>.", seeAlso: "../../alpha/" });
    expect(nodes[2]!["seeAlso"]).toBeUndefined();
  });
  test("a term naming its own IRI elsewhere is not this namespace's to serve", () => {
    const ids = glossaryConceptNodes(ns, [{ glossary }]).map((n) => n["@id"]);
    expect(ids).not.toContain("https://other.example/concept/x");
    expect(ids.some((i) => String(i).endsWith("/elsewhere"))).toBe(false);
  });
});

describe("namespaceDocument", () => {
  const concepts = glossaryConceptNodes(ns, [{ glossary }]);
  test("the concepts alone, as a document whose @id is the namespace", () => {
    const doc = namespaceDocument("layer", ns, concepts);
    expect(doc["@id"]).toBe(ns);
    expect((doc["@graph"] as unknown[]).length).toBe(3);
    expect((doc["@context"] as Record<string, unknown>)["skos"]).toBe("http://www.w3.org/2004/02/skos/core#");
  });
  test("added to the layer's vocabulary, keeping its entries and its own spelling of one already held", () => {
    const base = {
      "@context": { layer: ns, label: "rdfs:label" },
      "@id": ns,
      "@type": ["owl:Ontology", "skos:ConceptScheme"],
      label: "layer vocabulary",
      "@graph": [
        { "@id": "layer:graphTypology/glossary", label: "glossary" },
        { "@id": "layer:glossary/demo/beta", label: "beta, as the vocabulary has it" },
      ],
    };
    const doc = namespaceDocument("layer", ns, concepts, base);
    const graph = doc["@graph"] as Array<Record<string, unknown>>;
    expect(doc["label"]).toBe("layer vocabulary");
    expect(doc["@type"]).toEqual(["owl:Ontology", "skos:ConceptScheme"]);
    expect(graph.map((n) => n["@id"])).toEqual(["layer:graphTypology/glossary", "layer:glossary/demo/beta", `${ns}glossary/demo`, `${ns}glossary/demo/alpha`]);
  });
  test("a vocabulary for another namespace is refused", () => {
    expect(() => namespaceDocument("layer", ns, concepts, { "@id": "https://example.org/other/v0/ns/" })).toThrow(/not the namespace/);
  });
});

describe("namespaceHtml", () => {
  const doc = namespaceDocument("layer", ns, glossaryConceptNodes(ns, [{ glossary, pageOf: (id) => (id === "alpha" ? "../../alpha/" : undefined) }]), {
    "@context": { layer: ns },
    "@id": ns,
    "@graph": [{ "@id": "layer:graphTypology/glossary", label: "glossary" }],
  });
  const html = namespaceHtml("layer", ns, doc);
  test("one anchor per concept: its IRI with the namespace taken off", () => {
    for (const a of ["glossary/demo", "glossary/demo/alpha", "glossary/demo/beta", "graphTypology/glossary"]) expect(html).toContain(`id="${a}"`);
  });
  test("escapes what it prints, links a term page, and embeds the document", () => {
    expect(html).toContain("The first &lt;term&gt;.");
    expect(html).toContain('<a href="../../alpha/">more</a>');
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('href="index.jsonld"');
    expect(html.slice(html.indexOf("<body>"))).not.toMatch(/<term>/);
  });
  test("anchorIn: only an IRI inside the namespace has one", () => {
    expect(anchorIn(ns, `${ns}glossary/demo/alpha`)).toBe("glossary/demo/alpha");
    expect(anchorIn(ns, ns)).toBeUndefined();
    expect(anchorIn(ns, "https://other.example/x")).toBeUndefined();
  });
});

describe("namespacePaths", () => {
  test("a slash namespace under the site is its directory's index", () => {
    expect(namespacePaths(ns, "https://example.org/layer/")).toEqual({ html: "v0/ns/index.html", jsonld: "v0/ns/index.jsonld", json: "v0/ns/index.json" });
    expect(namespacePaths(ns, "https://example.org/layer")).toEqual({ html: "v0/ns/index.html", jsonld: "v0/ns/index.jsonld", json: "v0/ns/index.json" });
  });
  test("a hash namespace is served from the same directory", () => {
    expect(namespacePaths("https://example.org/layer/v0/ns#", "https://example.org/layer/")?.html).toBe("v0/ns/index.html");
  });
  test("a namespace another site serves is not this site's", () => {
    expect(namespacePaths("https://example.org/other/v0/ns/", "https://example.org/layer/")).toBeUndefined();
    expect(namespacePaths("https://example.org/layer/", "https://example.org/layer/")).toBeUndefined();
  });
});

describe("resourcePages", () => {
  const site = "https://example.org/layer/";
  const skos = {
    "@context": { skos: "http://www.w3.org/2004/02/skos/core#", skosxl: "http://www.w3.org/2008/05/skos-xl#" },
    "@graph": [
      { "@id": `${ns}glossary/demo`, "@type": "skos:ConceptScheme", "skos:prefLabel": "Demo terms" },
      {
        "@id": `${ns}glossary/demo/alpha`,
        "@type": "skos:Concept",
        "skos:inScheme": { "@id": `${ns}glossary/demo` },
        "skos:prefLabel": [{ "@value": "alpha", "@language": "en" }, { "@value": "alpha (fr)", "@language": "fr" }],
        "skos:definition": [{ "@value": "The first <term>.", "@language": "en" }],
        "skos:scopeNote": "Only in tests.",
        "skos:exactMatch": [{ "@id": "https://other.example/concept/x" }],
        "skos:related": [{ "@id": `${ns}glossary/demo/beta` }],
      },
      { "@id": `${ns}glossary/demo/alpha#label-fr`, "@type": "skosxl:Label", "skosxl:literalForm": { "@value": "alpha (fr)", "@language": "fr" } },
      { "@id": `${ns}glossary/demo#order`, "@type": "skos:OrderedCollection", "skos:memberList": { "@list": [{ "@id": `${ns}glossary/demo/alpha` }] } },
      { "@id": "https://other.example/concept/x", "@type": "skos:Concept" },
    ],
  };
  const pages = resourcePages(ns, site, [{ doc: skos, linksOf: (iri) => (iri.endsWith("/alpha") ? [{ label: "Glossary entry", href: "en/glossary/#demo--alpha" }] : []) }]);

  test("a page at <path>/index.html for every IRI minted in the namespace, and none outside it", () => {
    expect([...pages.keys()].sort()).toEqual(["v0/ns/glossary/demo/alpha/index.html", "v0/ns/glossary/demo/index.html"]);
  });
  test("a fragment IRI is a section of its document's page, with the fragment as its id", () => {
    expect(pages.get("v0/ns/glossary/demo/alpha/index.html")).toContain('<section id="label-fr">');
    expect(pages.get("v0/ns/glossary/demo/index.html")).toContain('<section id="order">');
  });
  test("a concept's page shows each language's label, its definition, scope note and matches, and links back to the glossary", () => {
    const html = pages.get("v0/ns/glossary/demo/alpha/index.html")!;
    expect(html).toContain("<title>alpha</title>");
    expect(html).toContain('<span lang="fr">alpha (fr)</span>');
    expect(html).toContain("The first &lt;term&gt;.");
    expect(html).toContain("<dt>Scope note</dt><dd>Only in tests.</dd>");
    expect(html).toContain('<a href="https://other.example/concept/x">');
    // A link inside the site is relative, so a staged copy of the site links itself.
    expect(html).toContain('<a href="../../../../../v0/ns/glossary/demo/beta">');
    expect(html).toContain('<a href="../../../../../en/glossary/#demo--alpha">Glossary entry</a>');
    expect(html).toContain('<script type="application/ld+json">');
  });
  test("servedPath: the directory and fragment a static host serves an IRI from", () => {
    expect(servedPath(`${ns}glossary/demo/alpha#label-fr`, site)).toEqual({ dir: "v0/ns/glossary/demo/alpha", fragment: "label-fr" });
    expect(servedPath(`${ns}glossary/demo`, site)).toEqual({ dir: "v0/ns/glossary/demo" });
    expect(servedPath("https://other.example/x", site)).toBeUndefined();
    expect(servedPath(site, site)).toBeUndefined();
  });
});
