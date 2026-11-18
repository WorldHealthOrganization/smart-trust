/**
 * One class model, three sources (bean `cat-tools-4xq6`): the JSON Schema and
 * FHIR logical-model readers, cardinality, type links, and the one renderer
 * every page shares.
 *
 * @module scripts/tests/class-model.test
 */
import { describe, expect, it } from "bun:test";

import { cardinalityOf, classModelOfDocuments, readJsonDocument, readJsonSchemaModule, type SchemaField } from "../schema-graph.ts";
import { isFhirLogicalModel, readFhirLogicalModel } from "../fhir-logical-model.ts";
import { diagramOfDecls, renderClassDiagram } from "../class-diagram.ts";
import { typeLink, umlType } from "../type-links.ts";

const field = (f: Partial<SchemaField>): SchemaField => ({ name: "f", type: "string", optional: false, array: false, names: [], ...f });

describe("cardinality", () => {
  it("reads min..max from optionality, lists and stated bounds", () => {
    expect(cardinalityOf(field({}))).toBe("1..1");
    expect(cardinalityOf(field({ optional: true }))).toBe("0..1");
    expect(cardinalityOf(field({ array: true, type: "z.array(Foo)" }))).toBe("0..*");
    expect(cardinalityOf(field({ array: true, type: "z.array(Foo).nonempty()" }))).toBe("1..*");
    expect(cardinalityOf(field({ array: true, type: "z.array(Foo).min(2)" }))).toBe("2..*");
    expect(cardinalityOf(field({ array: true, min: 1, max: 20 }))).toBe("1..20");
  });

  it("says ?..? when the source states no cardinality, never a guess", () => {
    expect(cardinalityOf(field({ cardinalityUnknown: true }))).toBe("?..?");
  });
});

describe("JSON Schema reader", () => {
  const userStory = JSON.stringify({
    $id: "https://example.org/UserStory.schema.json",
    title: "User story",
    type: "object",
    required: ["as", "actors"],
    properties: {
      as: { type: "string" },
      actors: { type: "array", minItems: 1, items: { $ref: "#/$defs/Actor" } },
      layout: { type: "object", properties: { columns: { type: "integer" } } },
      tags: { type: "array", maxItems: 5, items: { type: "string" } },
    },
    $defs: {
      Actor: { type: "object", properties: { code: { type: "string" } } },
      Base: { type: "object", properties: { id: { type: "string" } } },
      Named: { allOf: [{ $ref: "#/$defs/Base" }, { properties: { name: { type: "string" } }, required: ["name"] }] },
      Either: { oneOf: [{ $ref: "#/$defs/Actor" }, { $ref: "#/$defs/Base" }] },
      Opaque: { description: "a note and nothing else" },
    },
  });
  const m = classModelOfDocuments([{ text: userStory, module: "s/user-story.schema.json" }]);
  const byName = new Map(m.decls.map((d) => [d.name, d]));

  it("gives array fields their cardinality from required, minItems and maxItems", () => {
    const root = byName.get("UserStory")!;
    expect(root.canonical).toBe("https://example.org/UserStory.schema.json");
    expect(cardinalityOf(root.fields.find((f) => f.name === "actors")!)).toBe("1..*");
    expect(cardinalityOf(root.fields.find((f) => f.name === "tags")!)).toBe("0..5");
    expect(cardinalityOf(root.fields.find((f) => f.name === "as")!)).toBe("1..1");
  });

  it("makes an inline object a nested class joined by an edge", () => {
    expect(byName.get("UserStory.layout")?.fields.map((f) => f.name)).toEqual(["columns"]);
    expect(m.edges).toContainEqual(expect.objectContaining({ from: "s/user-story.schema.json#UserStory", to: "s/user-story.schema.json#UserStory.layout", via: "layout" }));
    expect(m.edges).toContainEqual(expect.objectContaining({ to: "s/user-story.schema.json#Actor", via: "actors", array: true }));
  });

  it("reads allOf as a parent plus own fields, and oneOf as member edges", () => {
    const named = byName.get("Named")!;
    expect(named.extendsNames).toEqual(["Base"]);
    expect(named.fields.map((f) => [f.name, f.optional])).toEqual([["name", false]]);
    expect(m.edges.filter((e) => e.from.endsWith("#Either") && e.kind === "member").map((e) => e.to.split("#")[1]).sort()).toEqual(["Actor", "Base"]);
  });

  it("states a schema with no shape keyword as undetermined, never an empty class", () => {
    const opaque = byName.get("Opaque")!;
    expect(opaque.kind).toBe("undetermined");
    expect(opaque.note).toContain("could not determine");
  });

  it("states unparseable JSON as undetermined", () => {
    const r = readJsonSchemaModule("{ nope", "s/bad.schema.json");
    expect(r.decls[0]!.kind).toBe("undetermined");
    expect(r.decls[0]!.note).toContain("not valid JSON");
  });
});

const sd = (o: Record<string, unknown>): string => JSON.stringify({ resourceType: "StructureDefinition", kind: "logical", derivation: "specialization", ...o });

const persona = sd({
  url: "http://example.org/StructureDefinition/GenericPersona",
  name: "GenericPersona",
  title: "Generic persona",
  baseDefinition: "http://hl7.org/fhir/StructureDefinition/Base",
  differential: { element: [
    { id: "GenericPersona", path: "GenericPersona" },
    { id: "GenericPersona.name", path: "GenericPersona.name", min: 1, max: "1", type: [{ code: "string" }] },
    { id: "GenericPersona.iscoCode", path: "GenericPersona.iscoCode", min: 0, max: "*", type: [{ code: "Coding" }] },
    { id: "GenericPersona.roles", path: "GenericPersona.roles", min: 0, max: "*", type: [{ code: "BackboneElement" }] },
    { id: "GenericPersona.roles.role", path: "GenericPersona.roles.role", min: 1, max: "1", type: [{ code: "CodeableConcept" }] },
    { id: "GenericPersona.roles.sub", path: "GenericPersona.roles.sub", min: 0, max: "*", contentReference: "#GenericPersona.roles" },
    { id: "GenericPersona.note", path: "GenericPersona.note" },
  ] },
});
const requirement = sd({
  url: "http://example.org/StructureDefinition/FunctionalRequirement",
  name: "FunctionalRequirement",
  baseDefinition: "http://example.org/StructureDefinition/Requirement",
  differential: { element: [
    { id: "FunctionalRequirement", path: "FunctionalRequirement" },
    { id: "FunctionalRequirement.actor", path: "FunctionalRequirement.actor", min: 0, max: "*", type: [{ code: "Reference", targetProfile: ["http://example.org/StructureDefinition/GenericPersona"] }] },
    { id: "FunctionalRequirement.persona", path: "FunctionalRequirement.persona", min: 1, max: "1", type: [{ code: "http://example.org/StructureDefinition/GenericPersona" }] },
  ] },
});
const requirementBase = sd({
  url: "http://example.org/StructureDefinition/Requirement",
  name: "Requirement",
  differential: { element: [{ id: "Requirement", path: "Requirement" }, { id: "Requirement.id", path: "Requirement.id", min: 1, max: "1", type: [{ code: "id" }] }] },
});

describe("FHIR logical-model reader", () => {
  it("reads only StructureDefinitions that define a class, never a profile", () => {
    expect(isFhirLogicalModel(JSON.parse(persona))).toBe(true);
    expect(isFhirLogicalModel({ resourceType: "StructureDefinition", kind: "resource", derivation: "specialization" })).toBe(true);
    expect(isFhirLogicalModel({ resourceType: "StructureDefinition", kind: "resource", derivation: "constraint" })).toBe(false);
    expect(readJsonDocument(JSON.stringify({ $schema: "folio-source-descriptor/v1" }), "x/demo.json")).toBeUndefined();
  });

  it("reads elements as fields with min..max, a backbone as a nested class, a contentReference as an edge to it", () => {
    const r = readFhirLogicalModel(persona, "ig/StructureDefinition-GenericPersona.json");
    const root = r.decls.find((d) => d.name === "GenericPersona")!;
    expect(root.kind).toBe("fhir-logical");
    expect(root.canonical).toBe("http://example.org/StructureDefinition/GenericPersona");
    expect(root.fields.map((f) => `${f.name}:${f.type}:${cardinalityOf(f)}`)).toEqual([
      "name:string:1..1",
      "iscoCode:Coding:0..*",
      "roles:GenericPersona.roles:0..*",
      "note:?:?..?",
    ]);
    const roles = r.decls.find((d) => d.name === "GenericPersona.roles")!;
    expect(roles.fields.map((f) => f.name)).toEqual(["role", "sub"]);
    expect(r.edges).toContainEqual(expect.objectContaining({ from: root.id, to: roles.id, via: "roles" }));
    expect(r.edges).toContainEqual(expect.objectContaining({ from: roles.id, to: roles.id, via: "sub" }));
    // FHIR core: recorded as external, linked to its definition, not drawn as a miss.
    expect(root.extendsNames).toEqual(["Base"]);
    expect(root.external).toContain("Coding");
    expect(root.fields[1]!.typeLinks?.Coding).toBe("http://hl7.org/fhir/StructureDefinition/Coding");
  });

  it("resolves a type, a Reference target and a base by canonical across models", () => {
    const m = classModelOfDocuments([
      { text: persona, module: "ig/StructureDefinition-GenericPersona.json" },
      { text: requirement, module: "ig/StructureDefinition-FunctionalRequirement.json" },
      { text: requirementBase, module: "ig/StructureDefinition-Requirement.json" },
    ]);
    const kinds = m.edges
      .filter((e) => e.from.endsWith("#FunctionalRequirement"))
      .map((e) => `${e.kind}:${e.via}:${e.to.split("#")[1]}`)
      .sort();
    expect(kinds).toEqual(["extends::Requirement", "field:persona:GenericPersona", "id-ref:actor:GenericPersona"]);
    const fr = m.decls.find((d) => d.name === "FunctionalRequirement")!;
    expect(fr.unresolved).toEqual([]);
    expect(fr.fields[0]!.type).toBe("Reference(GenericPersona)");
  });

  it("states a model with no elements as undetermined", () => {
    const r = readFhirLogicalModel(sd({ name: "Draft", url: "http://example.org/StructureDefinition/Draft" }), "ig/Draft.json");
    expect(r.decls).toHaveLength(1);
    expect(r.decls[0]!.kind).toBe("undetermined");
    expect(r.decls[0]!.note).toContain("no differential or snapshot");
  });
});

describe("type links", () => {
  it("links each source's built-in types to their specification", () => {
    expect(typeLink("fhir", "dateTime")).toBe("https://hl7.org/fhir/datatypes.html#dateTime");
    expect(typeLink("fhir", "Coding")).toBe("http://hl7.org/fhir/StructureDefinition/Coding");
    expect(typeLink("json-schema", "integer")).toBe("https://json-schema.org/understanding-json-schema/reference/numeric#integer");
    expect(typeLink("json-schema", "date-time")).toBe("https://www.w3.org/TR/xmlschema-2/#dateTime");
    expect(typeLink("zod", "z.string().min(1)")).toBe("https://zod.dev/api#strings");
    expect(typeLink("zod", "MyThing")).toBeUndefined();
  });
});

describe("UML types", () => {
  it("shows a Zod field's type as UML does, the same words as JSON Schema and FHIR", () => {
    expect(umlType("zod", "z.string().optional()")).toBe("string");
    expect(umlType("zod", "z.array(z.string().min(1)).optional()")).toBe("string[]");
    expect(umlType("zod", "z.array(SkillNameSchema).default([])")).toBe("SkillNameSchema[]");
    expect(umlType("zod", "z.array(z.enum(KINDS)).min(1)")).toBe("enum[]");
    expect(umlType("zod", 'z.string().regex(/^\\d{4}$/, "a year")')).toBe("string");
    expect(umlType("json-schema", "string[]")).toBe("string[]");
  });
});

describe("one renderer, one look", () => {
  const zod = { decls: [
    { id: "a#Person", name: "Person", module: "a.ts", kind: "zod-object" as const, fields: [field({ name: "name" }), field({ name: "telecom", type: "ContactPoint[]", array: true })], extendsNames: [], values: [], refs: [], unresolved: [], external: [], line: 1, exported: true },
    { id: "a#ContactPoint", name: "ContactPoint", module: "a.ts", kind: "zod-object" as const, fields: [field({ name: "value" })], extendsNames: [], values: [], refs: [], unresolved: [], external: [], line: 1, exported: true },
  ], edges: [{ from: "a#Person", to: "a#ContactPoint", via: "telecom", kind: "field" as const, optional: false, array: true }] };
  const json = classModelOfDocuments([{ module: "p/person.schema.json", text: JSON.stringify({
    title: "Person", type: "object", required: ["name"],
    properties: { name: { type: "string" }, telecom: { type: "array", items: { $ref: "#/$defs/ContactPoint" } } },
    $defs: { ContactPoint: { type: "object", required: ["value"], properties: { value: { type: "string" } } } },
  }) }]);
  const strip = (svg: string): string =>
    svg.replace(/«[^»]+»/g, "«»").replace(/href="[^"]*"/g, "").replace(/data-id="[^"]*"/g, "").replace(/\bcd[a-z0-9]+(?:-\d+)?-(gen|tip|dia)\b/g, "M-$1");

  it("draws the same shape from Zod and JSON Schema identically, but for the source label", () => {
    const a = renderClassDiagram(diagramOfDecls(zod.decls, zod.edges, { label: "Person" }));
    const b = renderClassDiagram(diagramOfDecls(json.decls, json.edges, { label: "Person" }));
    expect(a).toContain("«zod»");
    expect(b).toContain("«json-schema»");
    expect(strip(a)).toBe(strip(b));
  });

  it("puts the source label upper right, writes name : Type [min..max], and labels the edge with its field", () => {
    const svg = renderClassDiagram(diagramOfDecls(json.decls, json.edges));
    expect(svg).toMatch(/class="cd-st"[^>]*text-anchor="end">«json-schema»/);
    expect(svg).toContain("telecom : ");
    expect(svg).toContain(" [0..*]");
    expect(svg).toContain(">telecom [0..*]</text>");
  });

  it("links every box to its class and every built-in type to its definition", () => {
    const svg = renderClassDiagram(diagramOfDecls(json.decls, json.edges, { hrefOf: (d) => `#${d.name}` }));
    expect(svg).toContain('href="#Person"');
    expect(svg).toContain('href="https://json-schema.org/understanding-json-schema/reference/string"');
  });

  it("gives every diagram its own marker ids, so a page with several repeats none", () => {
    const one = renderClassDiagram(diagramOfDecls(json.decls, json.edges, { label: "Person" }));
    const two = renderClassDiagram(diagramOfDecls(zod.decls, zod.edges, { label: "Person" }));
    const again = renderClassDiagram(diagramOfDecls(json.decls, json.edges, { label: "Person" }));
    const ids = (svg: string): string[] => [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);
    const page = [one, two, again].flatMap(ids);
    expect(page.length).toBe(9);
    expect(new Set(page).size).toBe(page.length);
    // Every marker reference points at a marker of its own diagram.
    for (const svg of [one, two, again]) {
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids(svg)).toContain(m[1]!);
    }
    // A caller may name the prefix.
    expect(renderClassDiagram({ ...diagramOfDecls(json.decls, json.edges), idPrefix: "fig7" })).toContain('<marker id="fig7-tip"');
  });

  it("draws an undetermined declaration dashed with its reason, never as an empty box", () => {
    const bad = readJsonSchemaModule("{", "x/bad.schema.json");
    const svg = renderClassDiagram(diagramOfDecls(bad.decls, []));
    expect(svg).toContain("cd-und");
    expect(svg).toContain("not valid JSON");
  });
});

describe("skill and Tool pages draw their contracts", async () => {
  const { contractDiagramHtml } = await import("../class-diagram.ts");
  const { toolPage } = await import("../tool-page.ts");
  const { defineTool } = await import("../../schemas/tools/tool.ts");
  const input = { title: "Demo input", type: "object", required: ["candidates"], properties: { candidates: { type: "array", minItems: 1, items: { type: "string" } } } };
  const output = { title: "Demo output", type: "object", properties: { report: { type: "string" }, entries: { type: "array", items: { type: "object", properties: { ok: { type: "boolean" } } } } } };

  it("draws the skill as a «skill» box pointing at each contract's root class", () => {
    const html = contractDiagramHtml({ name: "demo-skill", source: "skill", href: "../skills/demo-skill.html" }, [
      { io: "input", file: "s/demo/input.schema.json", schema: input, href: "https://forge.test/input.schema.json" },
      { io: "output", file: "s/demo/output.schema.json", schema: output },
    ]);
    expect(html.startsWith('<div class="cd-wrap"><svg')).toBe(true);
    expect(html).toContain("«skill»");
    expect(html).toContain(">input [1..1]</text>");
    expect(html).toContain(">output [1..1]</text>");
    expect(html).toContain('href="../skills/demo-skill.html"');
    expect(html).toContain('href="https://forge.test/input.schema.json"');
    expect(html).toContain("DemoOutput.entries");
    expect(html).not.toContain("\n");
  });

  it("puts a skill's contract diagram and an MCP tool's input diagram on the Tool page", () => {
    const def = defineTool({
      id: "demo-tool", title: "Demo", description: "A demo Tool.", install: { none: true },
      invoke: { shell: "bun run cat demo" }, io: { inputs: [], outputs: [] }, satisfies: ["demo-skill"],
    });
    const md = toolPage({
      def, instance: "demo", typeIri: "https://x.test/Tool",
      skills: new Map([["demo-skill", { file: "skills/demo-skill.md", io: [
        { io: "input", file: "s/demo/input.schema.json", schema: input },
        { io: "output", file: "s/demo/output.schema.json", schema: output },
      ] }]]),
      skillHref: () => "../skills/demo-skill.html", toolHref: () => undefined, siblings: new Map(), alternatives: [],
      processes: [], processesRead: true, parts: [], moduleImports: [], mcpServers: [], workflows: [],
      mcpTools: [{ name: "demo_run", description: "", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" } } }, _meta: { tool: "demo-tool", source: "declared" } }],
      api: { reference: "../api/#demo", openapi: "../openapi.json", mcp: "../mcp-tools.json" },
    }, "generated: true");
    expect(md).toContain("<style>.cd {");
    expect((md.match(/<div class="cd-wrap"><svg/g) ?? []).length).toBe(2);
    expect(md).toContain("«tool»");
    expect(md).toContain(">demo_run [1..1]</text>");
    expect(md).toContain('href="../mcp-tools.json"');
  });
});

describe("class model QA report", async () => {
  const { classModelQa } = await import("../class-model-qa.ts");
  const docs = classModelOfDocuments([
    { text: "{", module: "s/bad.schema.json" },
    { text: persona, module: "ig/StructureDefinition-GenericPersona.json" },
    { text: requirement, module: "ig/StructureDefinition-FunctionalRequirement.json" },
  ]);
  const report = classModelQa({ roots: [], modules: [], decls: docs.decls, edges: docs.edges, refProblems: [], unread: ["ig/fhir-artifact-index: index.json absent (built at publish)"] });

  it("records undetermined declarations, unresolved references and unknown cardinalities as kg-qa/v1 findings", () => {
    expect(report.$schema).toBe("kg-qa/v1");
    expect(report.subject).toEqual({ kind: "graph", id: "schema-class-model", path: null });
    expect(report.criteria["class-model-determined"]!.result).toBe("fail");
    expect(report.criteria["class-model-determined"]!.findings[0]!.detail).toContain("«json-schema» bad");
    // FunctionalRequirement's base is not in this reading: a real miss, named.
    expect(report.criteria["class-model-references-resolve"]!.findings.map((f) => f.where)).toContain("ig/StructureDefinition-FunctionalRequirement.json#FunctionalRequirement");
    expect(report.criteria["class-model-cardinality-known"]!.findings.map((f) => f.where)).toEqual(["ig/StructureDefinition-GenericPersona.json#GenericPersona.note"]);
  });

  it("reports an unread source as unknown, never a pass, and counts what each reader drew", () => {
    expect(report.criteria["class-model-sources-read"]!.result).toBe("unknown");
    expect(report.criteria["class-model-sources-drawn"]!.findings.map((f) => f.where)).toEqual(["fhir", "json-schema"]);
    expect(report.totals).toEqual({ pass: 1, fail: 3, "n/a": 1, unknown: 1 });
  });
});
