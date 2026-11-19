/**
 * The JSON-LD contexts: the L1 one is generated from `src/l1.ts`, and the
 * l1-library one makes a graph survive as RDF — node classes,
 * named properties, Dublin Core, and `prov:specializationOf` edges — with no
 * network, through `src/loader.ts`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import jsonld from "jsonld";

import { contextUrl, extensionContext } from "../context.ts";
import { L1 } from "../l1.ts";
import { L1_LIBRARY } from "../l1-library.ts";
import { CONTEXTS, documentLoader } from "../loader.ts";

test("loaderServesEveryHeldLayersContextOnly", async () => {
  assert.deepEqual(Object.keys(CONTEXTS).sort(), ["l1", "l1-library", "l2", "l2-bpmn", "l2-dmn", "l3"].map(contextUrl).sort());
  await assert.rejects(documentLoader("https://example.org/other.context.jsonld"));
});

test("propertyNameIsOneTermAcrossClasses", () => {
  assert.doesNotThrow(() => extensionContext([L1_LIBRARY, L1]));
});

// A minimal l1-library document: a publication, one section, both specialising library nodes.
const PUB = "https://smart.who.int/kg/l1/publication/isbn-9789240016514";
const LIB = "https://litlfred.github.io/folio/library/lnob/manifest";
const DOC = {
  "@context": contextUrl("l1-library"),
  id: `${PUB}/kg/l1-library`,
  type: "Entity",
  ontologyVersion: "3.0",
  generatedAt: "2026-10-08T00:00:00Z",
  nodes: [
    {
      id: PUB,
      type: "publication",
      label: "Leave no one behind",
      properties: { title: "Leave no one behind", publicationType: "implementation-guidance", url: "https://iris.who.int/handle/10665/340749", identifiers: [{ type: "isbn", value: "9789240016514" }] },
      derivation: "decided",
    },
    { id: `${PUB}/section/1.2`, type: "publication-section", label: "1.2", properties: { heading: "Availability", pageRange: "2-4" }, derivation: "inferred" },
    { id: LIB, type: "library-node", label: "entry", properties: { iri: LIB, libraryClass: "https://litlfred.github.io/cat-harness/v0/ns/SourceDocument" }, derivation: "derived" },
  ],
  edges: [
    { type: "Statement", predicate: "specializationOf", source: PUB, target: LIB, derivation: "derived" },
    { type: "Statement", predicate: "contains", source: PUB, target: `${PUB}/section/1.2`, derivation: "inferred" },
  ],
};

test("l1LibraryGraphSurvivesAsRdf", async () => {
  const nq = (await jsonld.toRDF(DOC, { format: "application/n-quads", documentLoader: documentLoader as never })) as unknown as string;
  const has = (s: string) => assert.ok(nq.includes(s), `missing: ${s}`);
  has(`<${PUB}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://smart.who.int/kg/publication>`);
  has(`<${PUB}/section/1.2> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://smart.who.int/kg/publication-section>`);
  has(`<${PUB}> <http://purl.org/dc/terms/title> "Leave no one behind"`);
  has(`<${PUB}/section/1.2> <http://smart.who.int/kg/pageRange> "2-4"`);
  has(`<${PUB}> <http://smart.who.int/kg/url> <https://iris.who.int/handle/10665/340749>`);
  has(`<http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate> <http://www.w3.org/ns/prov#specializationOf>`);
  // A backbone's `type` is its own field, not the identifier node's class.
  has(`<http://smart.who.int/kg/identifiers.type> "isbn"`);
  assert.ok(!nq.includes("<http://smart.who.int/kg/properties>"), "no property collapses into sgkg:properties");
});
