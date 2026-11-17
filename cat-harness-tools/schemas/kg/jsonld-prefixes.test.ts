/**
 * `jsonldPrefixes` (bean folio-assistant-63q4): the shape, the flattening over
 * `needs`, and agreement between this layer's declared table and the
 * hand-kept `CONTENT_CONTEXT` it will replace.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CatHarnessDeclarationSchema } from "./cat-harness.ts";
import { CONTENT_CONTEXT } from "./jsonld.ts";
import { JsonldPrefixTableSchema, mergePrefixTables } from "./jsonld-prefixes.ts";

import { requireHarnessRoot } from "../harness-root.ts";
const ROOT = requireHarnessRoot();

describe("the shape", () => {
  test("a prefix → namespace table is valid", () => {
    expect(JsonldPrefixTableSchema.safeParse({ bibo: "http://purl.org/ontology/bibo/", fhir: "http://hl7.org/fhir/" }).success).toBe(true);
  });
  test("a namespace IRI ends in / or #", () => {
    expect(JsonldPrefixTableSchema.safeParse({ bibo: "http://purl.org/ontology/bibo" }).success).toBe(false);
  });
  test("a relative IRI is refused", () => {
    expect(JsonldPrefixTableSchema.safeParse({ x: "ns/x/" }).success).toBe(false);
  });
  test("a keyword, a URI scheme or the blank-node prefix is not a prefix", () => {
    for (const p of ["@vocab", "http", "_", "urn", "a:b"]) expect(JsonldPrefixTableSchema.safeParse({ [p]: "http://example.org/" }).success).toBe(false);
  });
  test("two prefixes for one namespace are refused", () => {
    expect(JsonldPrefixTableSchema.safeParse({ dc: "http://purl.org/dc/terms/", dcterms: "http://purl.org/dc/terms/" }).success).toBe(false);
  });
});

describe("flattening over needs", () => {
  test("dependencies first, the instance's own prefixes added", () => {
    const { prefixes, conflicts } = mergePrefixTables([
      { instance: "cat-harness", prefixes: { dcterms: "http://purl.org/dc/terms/" } },
      { instance: "folio-assistant-core", prefixes: { bibo: "http://purl.org/ontology/bibo/", dcterms: "http://purl.org/dc/terms/" } },
    ]);
    expect(prefixes).toEqual({ dcterms: "http://purl.org/dc/terms/", bibo: "http://purl.org/ontology/bibo/" });
    expect(conflicts).toEqual([]);
  });
  test("one prefix, two namespaces: reported, not resolved by order", () => {
    const { conflicts } = mergePrefixTables([
      { instance: "a", prefixes: { fhir: "http://hl7.org/fhir/" } },
      { instance: "b", prefixes: { fhir: "https://smart.who.int/base/DataTypes.jsonld#" } },
    ]);
    expect(conflicts.map((c) => c.prefix)).toEqual(["fhir"]);
    expect(conflicts[0]!.bindings.map((b) => b.instance)).toEqual(["a", "b"]);
  });
});

describe("this instance", () => {
  const decl = JSON.parse(readFileSync(join(ROOT, "cat-harness.json"), "utf-8")) as Record<string, unknown>;
  test("cat-harness.json still validates with its table", () => {
    expect(CatHarnessDeclarationSchema.safeParse(decl).success).toBe(true);
  });
  test("every declared prefix binds the namespace a hand-kept published context binds it to", () => {
    const table = decl.jsonldPrefixes as Record<string, string>;
    const subgraph = (JSON.parse(readFileSync(join(ROOT, "ns", "subgraph", "v1.jsonld"), "utf-8")) as { "@context": Record<string, unknown> })["@context"];
    const published = { ...subgraph, ...(CONTENT_CONTEXT as unknown as Record<string, unknown>) };
    for (const [prefix, iri] of Object.entries(table)) expect([prefix, published[prefix]]).toEqual([prefix, iri]);
  });
});
