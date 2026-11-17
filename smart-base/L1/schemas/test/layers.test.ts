/**
 * The layers above L1 (L2, L2-BPMN, L2-DMN, L3), each in its own named
 * subgraph, migrated from WHO smart-kg 3f5e477 (issue #359).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import jsonld from "jsonld";

import { contextUrl } from "../context.ts";
import { HELD, LAYERS, scopeList } from "../layers.ts";
import { documentLoader } from "../loader.ts";
import { OntologyLayerSchema, toOntologyJson } from "../ontology.ts";
import { check, scopeOf } from "../validate.ts";

const ABOVE = ["l2", "l2-bpmn", "l2-dmn", "l3"];

test("registryHoldsEveryDeclaredLayerBaseFirst", () => {
  assert.deepEqual(HELD.map((h) => h.key), ["l1", "l1-library", "l2", "l2-bpmn", "l2-dmn", "l3"]);
  assert.deepEqual(HELD.map((h) => h.dir), ["smart-base/L1/schemas", "smart-base/L1/schemas", "smart-base/L2/schemas", "smart-base/L2-bpmn/schemas", "smart-base/L2-dmn/schemas", "smart-base/L3/schemas"]);
});

test("everyLayerImportsOnlyDownTheLayering", () => {
  const order = HELD.map((h) => h.key);
  for (const h of HELD) for (const i of h.spec.imports ?? []) assert.ok(order.indexOf(i) < order.indexOf(h.key), `${h.key} imports ${i}, which is not below it`);
  assert.deepEqual(scopeList("l3").map((l) => l.layer), ["L3", "L2-DMN", "L2-BPMN", "L2", "L1"]);
});

test("everyEdgeNamesClassesAndAPredicateInScope", () => {
  for (const key of ABOVE) {
    const spec = LAYERS[key]!;
    OntologyLayerSchema.parse(toOntologyJson(spec));
    const scope = scopeOf(key);
    for (const e of spec.edges) {
      assert.ok(scope.classes.has(e.source), `${key}: edge source ${e.source} is not a class in scope`);
      assert.ok(scope.classes.has(e.target), `${key}: edge target ${e.target} is not a class in scope`);
      assert.ok(scope.predicates.has(e.predicate), `${key}: predicate ${e.predicate} is not in scope`);
    }
    for (const c of spec.classes) for (const [prop, b] of Object.entries(c.valueSets ?? {})) {
      const set = typeof b === "string" ? b : b.set;
      assert.ok(scope.valueSets.has(set), `${key}/${c.id}.${prop}: value set ${set} is not in scope`);
    }
  }
});

test("smartKgCountsCarriedOver", () => {
  // WHO smart-kg 3f5e477: classes/predicates/edges per layer, plus what this migration adds to L2.
  const n = (k: string) => [LAYERS[k]!.classes.length, LAYERS[k]!.predicates.length, LAYERS[k]!.edges.length];
  assert.deepEqual(n("l2"), [14, 12 + 1, 44 + 3], "L2 3.0, plus verifiedBy and 3 requirement edges from litlfred/smart-kg main");
  assert.deepEqual(n("l2-bpmn"), [6, 3, 20]);
  assert.deepEqual(n("l2-dmn"), [6, 3, 10]);
  assert.deepEqual(n("l3"), [14, 3, 39]);
});

test("requirementStatementCarriesTypedSuccessCriteria", () => {
  const rs = LAYERS.l2!.classes.find((c) => c.id === "requirement-statement")!;
  const sc = rs.properties.successCriteria!;
  assert.equal(sc.fhir, "BackboneElement");
  assert.ok(sc.schema.safeParse([{ key: "SC-1", criterion: "The form shows the due date.", verification: "test" }]).success);
  assert.ok(!sc.schema.safeParse([{ key: "SC-1", criterion: "x", verification: "vibes" }]).success);
});

const T = "https://smart.who.int/kg/l2/test";
const L2_DOC = {
  "@context": contextUrl("l2"),
  id: `${T}/graph`,
  type: "Entity",
  ontologyVersion: "3.0",
  generatedAt: "2026-11-13T00:00:00Z",
  nodes: [
    { id: `${T}/data-element/DE1`, type: "data-element", label: "DE1", properties: { id: "DE1", type: "Coding", source: "input/dictionary/immz.xlsx", canonical: "http://smart.who.int/immunizations/StructureDefinition/IMMZ.C.DE1" }, derivation: "derived" },
    { id: `${T}/requirement-statement/FR1-1`, type: "requirement-statement", label: "FR1-1", properties: { key: "FR1-1", conformance: "SHALL", successCriteria: [{ key: "SC-1", criterion: "Shown.", verification: "test" }] }, derivation: "derived" },
    { id: `${T}/test-scenario/TS1`, type: "test-scenario", label: "TS1", properties: { id: "TS1", feature: "input/tests/immz.feature" }, derivation: "derived" },
  ],
  edges: [{ type: "Statement", predicate: "verifiedBy", source: `${T}/requirement-statement/FR1-1`, target: `${T}/test-scenario/TS1`, derivation: "derived" }],
};

test("l2GraphValidates", () => {
  const v = check(L2_DOC);
  assert.deepEqual(v.errors, [], JSON.stringify(v.errors));
  const bad = structuredClone(L2_DOC);
  bad.edges[0]!.predicate = "verifiedBy";
  bad.edges[0]!.source = `${T}/test-scenario/TS1`;
  bad.edges[0]!.target = `${T}/requirement-statement/FR1-1`;
  assert.ok(check(bad).errors.length > 0, "an edge the layer does not license is refused");
});

test("l2GraphSurvivesAsRdf", async () => {
  const nq = (await jsonld.toRDF(L2_DOC, { format: "application/n-quads", documentLoader: documentLoader as never })) as unknown as string;
  const has = (s: string) => assert.ok(nq.includes(s), `missing: ${s}`);
  const de = `${T}/data-element/DE1`;
  has(`<${de}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://smart.who.int/kg/data-element>`);
  // A property named like a document term keeps its own meaning.
  has(`<http://smart.who.int/kg/type> "Coding"`);
  assert.ok(!nq.includes(`<${de}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://smart.who.int/kg/Coding>`), "the type property did not become the node's class");
  has(`<http://purl.org/dc/terms/source> "input/dictionary/immz.xlsx"`);
  has(`<http://smart.who.int/kg/canonical> <http://smart.who.int/immunizations/StructureDefinition/IMMZ.C.DE1>`);
  has(`<http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate> <http://smart.who.int/kg/verifiedBy>`);
  has(`<http://smart.who.int/kg/successCriteria>`);
});

test("everyLayerAboveL1HasAContextThatLoads", async () => {
  for (const key of ABOVE) {
    const doc = { "@context": contextUrl(key), id: `${T}/${key}`, type: "Entity", nodes: [], edges: [] };
    await assert.doesNotReject(jsonld.toRDF(doc, { documentLoader: documentLoader as never }));
  }
});
