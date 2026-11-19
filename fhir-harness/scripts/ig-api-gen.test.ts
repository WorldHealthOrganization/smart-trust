/**
 * `ig-api-gen.ts`: the IG API files, generated from an AST. The port was
 * measured against the Python generators it replaces on three IGs (every JSON
 * file the same content); these tests hold the shapes that measurement found.
 *
 * @module fhir-harness/scripts/ig-api-gen.test
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { codeSystemIri, enumerationSchema, generateIgApi, generatedAtOf, logicalModel, logicalModelSchema, Ordered, plain, pyJson, schemaKind, valueSetDisplays, valueSetFileId, valueSetSchema, valueSetVocabulary } from "./ig-api-gen.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated schemas and JSON-LD, indexed freely by each case
type Json = Record<string, any>;

const vs = {
  resourceType: "ValueSet",
  id: "colours",
  url: "https://example.org/ig/ValueSet/colours",
  title: "Colours",
  version: "1.0.0",
  expansion: {
    timestamp: "2026-10-23T00:00:00Z",
    contains: [
      { system: "https://example.org/ig/CodeSystem/colours", code: "red", display: "Red" },
      { system: "https://example.org/ig/CodeSystem/colours", code: "1", display: " " },
    ],
  },
};

describe("pyJson", () => {
  it("pyJsonLayoutAndOrder", () => {
    expect(pyJson({ a: [], b: {}, c: [1, "x"] })).toBe('{\n  "a": [],\n  "b": {},\n  "c": [\n    1,\n    "x"\n  ]\n}');
    expect(pyJson(new Ordered().set("b", 1).set("2", 2).set("b", 3))).toBe('{\n  "b": 3,\n  "2": 2\n}');
    expect(plain(new Ordered().set("z", new Ordered().set("1", true)))).toEqual({ z: { "1": true } });
  });
});

describe("ValueSets", () => {
  it("valueSetSinglesSystem", () => {
    const codes = [
      { code: "red", display: "Red", system: vs.expansion.contains[0]!.system },
      { code: "1", display: "1", system: vs.expansion.contains[0]!.system },
    ];
    const s = valueSetSchema(vs, codes) as Json;
    expect(s.$id).toBe("https://example.org/ig/ValueSet-colours.schema.json");
    expect(s.properties.system).toEqual({ type: "string", const: "https://example.org/ig/CodeSystem/colours" });
    expect(s.properties.code.enum).toEqual(["red", "1"]);
    expect(s["fhir:expansionTimestamp"]).toBe("2026-10-23T00:00:00Z");
    const d = pyJson(valueSetDisplays(vs, codes));
    expect(d.indexOf('"red"')).toBeLessThan(d.indexOf('"1"'));
    expect(valueSetFileId({ fullUrl: "https://example.org/x/ValueSet/from-entry", resource: { resourceType: "ValueSet" } })).toBe("from-entry");
  });

  it("multiSystemOneOf", () => {
    const codes = [
      { code: "a", display: "A", system: "https://example.org/CodeSystem/one" },
      { code: "b", display: "B", system: "https://example.org/CodeSystem/two" },
    ];
    expect((valueSetSchema(vs, codes) as Json).oneOf).toHaveLength(2);
    const v = plain(valueSetVocabulary(vs, codes, { vocabBase: "http://hl7.org/fhir/", now: "T" })) as Json;
    expect(v["@context"].cs0).toBe("https://example.org/CodeSystem-one");
    expect(v["@graph"][1]).toEqual({ id: "#b", name: "B", "fhir:CodeSystem": "cs1" });
    expect(v["@context"].fhir).toBe("http://hl7.org/fhir/");
    expect(codeSystemIri("https://example.org/CodeSystem/x")).toBe("https://example.org/CodeSystem-x");
  });
});

describe("logical models", () => {
  const sd = {
    resourceType: "StructureDefinition",
    kind: "logical",
    id: "Patient-lite",
    name: "PatientLite",
    url: "https://example.org/ig/StructureDefinition/PatientLite",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Base",
    differential: {
      element: [
        { path: "PatientLite" },
        { path: "PatientLite.name", min: 1, max: "1", type: [{ code: "string" }], short: "Name" },
        { path: "PatientLite.colour", min: 0, max: "*", type: [{ code: "Coding" }], binding: { valueSet: "https://example.org/ig/ValueSet/colours" } },
        { path: "PatientLite.extension", min: 0, max: "*" },
      ],
    },
  };
  it("logicalModelBindsValueSet", () => {
    const s = plain(logicalModelSchema(logicalModel(sd)!, "https://example.org/ig")) as Json;
    expect(s.$id).toBe("https://example.org/ig/StructureDefinition-PatientLite.schema.json");
    expect(s.required).toEqual(["resourceType", "name"]);
    expect(s.properties.colour).toEqual({ type: "array", items: { $ref: "./ValueSet-colours.schema.json", description: "Coding-shaped {system, code} object from ValueSet colours" } });
    expect(s.properties.extension).toBeUndefined();
    expect(s.allOf[1].properties["jsonld:contextTemplate"].const.colours).toBe("https://example.org/ig/ValueSet-colours.jsonld");
    expect(logicalModel({ ...sd, kind: "resource" })).toBeUndefined();
  });

  it("localModelBySiblingFile", () => {
    const withTypes = {
      ...sd,
      differential: {
        element: [
          { path: "PatientLite" },
          { path: "PatientLite.address", min: 0, max: "1", type: [{ code: "https://example.org/ig/StructureDefinition/AddressLite" }] },
          { path: "PatientLite.link", min: 0, max: "1", type: [{ code: "https://example.org/other/StructureDefinition/LinkPayload" }] },
        ],
      },
    };
    const local = new Set(["https://example.org/ig/StructureDefinition/PatientLite", "https://example.org/ig/StructureDefinition/AddressLite"]);
    const s = plain(logicalModelSchema(logicalModel(withTypes)!, "https://example.org/ig", local)) as Json;
    expect(s.properties.address).toEqual({ $ref: "StructureDefinition-AddressLite.schema.json" });
    expect(s.properties.link).toEqual({
      $ref: "https://example.org/other/StructureDefinition-LinkPayload.schema.json",
      description: "LinkPayload, defined in another package: https://example.org/other/StructureDefinition/LinkPayload",
    });
    // Without the list of local models, the IG's canonical base decides; an overridden base does not make a dependency's model local.
    const byBase = plain(logicalModelSchema(logicalModel(withTypes)!, "https://example.org/ig")) as Json;
    expect(byBase.properties.address.$ref).toBe("StructureDefinition-AddressLite.schema.json");
    expect(byBase.properties.link.$ref).toBe("https://example.org/other/StructureDefinition-LinkPayload.schema.json");
    const overridden = plain(logicalModelSchema(logicalModel(withTypes)!, "https://example.org/elsewhere", local)) as Json;
    expect(overridden.properties.address.$ref).toBe("StructureDefinition-AddressLite.schema.json");
  });

  it("schemaKindsAndEnumeration", () => {
    expect(schemaKind("ValueSet-x.schema.json")).toBe("valueset");
    expect(schemaKind("StructureDefinition-x.schema.json")).toBe("logical_model");
    expect(schemaKind("CodeSystem-x.schema.json")).toBeUndefined();
    expect(schemaKind("ValueSets.schema.json")).toBeUndefined();
    const e = enumerationSchema("logical_model", [["StructureDefinition-x.schema.json", { title: "X", properties: new Ordered().set("a", {}) }]]) as Json;
    expect(e.example.schemas[0]).toEqual({ filename: "StructureDefinition-x.schema.json", id: "", title: "X", description: "", url: "./StructureDefinition-x.schema.json", propertyCount: 1 });
  });
});

describe("generateIgApi", () => {
  it("readsAstIntoSidecarsAndSite", () => {
    const ast = mkdtempSync(join(tmpdir(), "ig-api-gen-"));
    try {
      mkdirSync(join(ast, "resources"), { recursive: true });
      writeFileSync(join(ast, "resources", "ig.json"), JSON.stringify({ resourceType: "ImplementationGuide", url: "https://example.org/ig/ImplementationGuide/example" }));
      writeFileSync(join(ast, "manifest.json"), JSON.stringify({ resources: [{ resourceType: "ImplementationGuide", id: "example", file: "resources/ig.json" }] }));
      writeFileSync(join(ast, "expansions.json"), JSON.stringify({ resourceType: "Bundle", entry: [{ resource: vs }] }));
      const r = generateIgApi(ast, { label: "Example API", now: "T" });
      expect([...r.sidecars.keys()].sort()).toEqual(["ValueSet-colours.displays.json", "ValueSet-colours.jsonld", "ValueSet-colours.openapi.json", "ValueSet-colours.schema.json"]);
      expect([...r.site.keys()].sort()).toEqual(["ValueSets-enumeration.openapi.json", "ValueSets.schema.json", "openapi/index.html"]);
      expect(r.site.get("openapi/index.html")).toContain("<title>OpenAPI Documentation - Example API</title>");
      expect(r.site.get("openapi/index.html")).toContain('"url": "../ValueSet-colours.openapi.json"');
    } finally {
      rmSync(ast, { recursive: true, force: true });
    }
  });
});

describe("generatedAtOf (cat-harness-tools#1230)", () => {
  it("stampsAstCompileTime", () => {
    const ast = mkdtempSync(join(tmpdir(), "ig-api-gen-"));
    try {
      writeFileSync(join(ast, "manifest.json"), JSON.stringify({ generatedAt: "2026-10-20T16:09:48Z", resources: [] }));
      writeFileSync(join(ast, "expansions.json"), JSON.stringify({ resourceType: "Bundle", entry: [{ resource: vs }] }));
      expect(generatedAtOf(ast)).toBe("2026-10-20T16:09:48Z");
      const a = generateIgApi(ast).sidecars.get("ValueSet-colours.jsonld");
      expect(a).toContain("2026-10-20T16:09:48Z");
      expect(generateIgApi(ast).sidecars.get("ValueSet-colours.jsonld")).toBe(a);
      writeFileSync(join(ast, "manifest.json"), JSON.stringify({ resources: [] }));
      expect(generatedAtOf(ast)).toBeUndefined();
    } finally {
      rmSync(ast, { recursive: true, force: true });
    }
  });
});
