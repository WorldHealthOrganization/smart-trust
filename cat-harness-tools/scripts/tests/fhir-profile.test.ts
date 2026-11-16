/**
 * FHIR profiles in the one class model (bean `cat-tools-t6fz`): a `constraint`
 * StructureDefinition drawn as a class over its base, holding only what it
 * constrains.
 *
 * @module scripts/tests/fhir-profile.test
 */
import { describe, expect, it } from "bun:test";

import { cardinalityOf, classModelOfDocuments, readJsonDocument } from "../schema-graph.ts";
import { isFhirProfile, readFhirLogicalModel } from "../fhir-logical-model.ts";
import { diagramOfDecls, renderClassDiagram } from "../class-diagram.ts";
import { sourceOfKind, typeLink } from "../type-links.ts";

const sd = (o: Record<string, unknown>): string => JSON.stringify({ resourceType: "StructureDefinition", derivation: "constraint", ...o });
const BASE = "http://example.org/StructureDefinition/";

const actor = sd({
  url: `${BASE}SGActor`, name: "SGActor", kind: "resource", type: "ActorDefinition",
  baseDefinition: "http://hl7.org/fhir/StructureDefinition/ActorDefinition",
  differential: { element: [
    { id: "ActorDefinition", path: "ActorDefinition" },
    { id: "ActorDefinition.name", path: "ActorDefinition.name", min: 1 },
    { id: "ActorDefinition.status", path: "ActorDefinition.status", mustSupport: true },
    { id: "ActorDefinition.extension", path: "ActorDefinition.extension", slicing: { rules: "open" } },
    { id: "ActorDefinition.extension:link", path: "ActorDefinition.extension", sliceName: "link", min: 0, max: "*", type: [{ code: "Extension", profile: [`${BASE}LinkExt`] }] },
  ] },
  snapshot: { element: [
    { id: "ActorDefinition", path: "ActorDefinition" },
    { id: "ActorDefinition.name", path: "ActorDefinition.name", min: 1, max: "1", type: [{ code: "string" }] },
    { id: "ActorDefinition.status", path: "ActorDefinition.status", min: 1, max: "1", type: [{ code: "code" }] },
  ] },
});
const linkExt = sd({
  url: `${BASE}LinkExt`, name: "LinkExt", kind: "complex-type", type: "Extension",
  baseDefinition: "http://hl7.org/fhir/StructureDefinition/Extension",
  differential: { element: [
    { id: "Extension", path: "Extension" },
    { id: "Extension.extension", path: "Extension.extension", max: "0" },
    { id: "Extension.url", path: "Extension.url", fixedUri: `${BASE}LinkExt` },
    { id: "Extension.value[x]", path: "Extension.value[x]", min: 1, type: [{ code: "Reference", targetProfile: [`${BASE}SGActor`] }], mustSupport: true },
  ] },
});

describe("FHIR profiles", () => {
  it("reads a constraint StructureDefinition as one class generalising its base", () => {
    expect(isFhirProfile(JSON.parse(actor))).toBe(true);
    expect(readJsonDocument(actor, "ig/StructureDefinition-SGActor.json")).toBeDefined();
    const r = readFhirLogicalModel(actor, "ig/StructureDefinition-SGActor.json");
    expect(r.decls).toHaveLength(1);
    const d = r.decls[0]!;
    expect(d.kind).toBe("fhir-profile");
    expect(d.extendsNames).toEqual(["ActorDefinition"]);
    expect(d.external).toContain("ActorDefinition");
    expect(sourceOfKind(d.kind)).toBe("fhir:profile");
  });

  it("holds only what the differential constrains, cardinality filled from the snapshot", () => {
    const d = readFhirLogicalModel(actor, "ig/StructureDefinition-SGActor.json").decls[0]!;
    expect(d.fields.map((f) => `${f.name} : ${f.type} [${cardinalityOf(f)}]${f.constraint ? ` {${f.constraint}}` : ""}`)).toEqual([
      "name : string [1..1]",
      "status : code [1..1] {MS}",
      "extension:link : Extension(LinkExt) [0..*]",
    ]);
  });

  it("says what a profile pins: fixed values, prohibited elements, mustSupport", () => {
    const d = readFhirLogicalModel(linkExt, "ig/StructureDefinition-LinkExt.json").decls[0]!;
    expect(d.fields.map((f) => [f.name, f.constraint])).toEqual([
      ["extension", "prohibited"],
      ["url", `= "${BASE}LinkExt"`],
      ["value[x]", "MS"],
    ]);
  });

  it("joins profiles by canonical: an extension slice is a field edge, a Reference target an id edge", () => {
    const m = classModelOfDocuments([
      { text: actor, module: "ig/StructureDefinition-SGActor.json" },
      { text: linkExt, module: "ig/StructureDefinition-LinkExt.json" },
    ]);
    expect(m.edges.map((e) => `${e.kind}:${e.from.split("#")[1]}->${e.to.split("#")[1]}:${e.via}`).sort()).toEqual([
      "field:SGActor->LinkExt:extension:link",
      "id-ref:LinkExt->SGActor:value[x]",
    ]);
    expect(m.decls.flatMap((d) => d.unresolved)).toEqual([]);
  });

  it("draws the profile labelled «fhir:profile», with its constraints after the cardinality", () => {
    const m = classModelOfDocuments([{ text: linkExt, module: "ig/StructureDefinition-LinkExt.json" }]);
    const svg = renderClassDiagram(diagramOfDecls(m.decls, m.edges));
    expect(svg).toContain("«fhir:profile»");
    expect(svg).toContain('<tspan class="cd-k"> {prohibited}</tspan>');
    expect(typeLink("fhir:profile", "code")).toBe("https://hl7.org/fhir/datatypes.html#code");
  });

  it("draws parallel edges as one line naming every field", () => {
    const two = actor.replace(
      '{"id":"ActorDefinition.extension:link"',
      '{"id":"ActorDefinition.extension:back","path":"ActorDefinition.extension","sliceName":"back","min":0,"max":"*","type":[{"code":"Extension","profile":["' + BASE + 'LinkExt"]}]},{"id":"ActorDefinition.extension:link"',
    );
    const m = classModelOfDocuments([
      { text: two, module: "ig/StructureDefinition-SGActor.json" },
      { text: linkExt, module: "ig/StructureDefinition-LinkExt.json" },
    ]);
    const svg = renderClassDiagram(diagramOfDecls(m.decls, m.edges));
    expect(svg).toContain(">extension:back, extension:link [0..*]</text>");
  });

  it("states a profile with no differential as undetermined", () => {
    const r = readFhirLogicalModel(sd({ name: "Empty", kind: "resource", baseDefinition: "http://hl7.org/fhir/StructureDefinition/Patient" }), "ig/Empty.json");
    expect(r.decls[0]!.kind).toBe("undetermined");
    expect(r.decls[0]!.note).toContain("no differential");
  });
});
