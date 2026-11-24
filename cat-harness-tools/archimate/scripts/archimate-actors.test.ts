import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArchimate } from "../schemas/archimate.ts";
import { actorTypeOf, backLinks, checkActors, fshActors, igActors, igCanonical } from "./archimate-actors.ts";

const C = "http://example.org/ig";

const FSH = `// The IG's actors, written by hand from the DAK's personas.
Instance: ClientRegistry
InstanceOf: ActorDefinition
Usage: #definition
* name = "Client Registry"
* description = "Keeps one record per person.
* type = #person is a line of the description, not a rule"
* type = #system

Instance: HealthWorker
InstanceOf: ActorDefinition
* id = "health-worker"
* type = http://hl7.org/fhir/examplescenario-actor-type#person

Instance: FacilityRegistry
InstanceOf: ActorDefinition
* type = #system

Instance: NotAnActor
InstanceOf: Patient
* name.family = "x"
`;

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Tiny" id="id-model" version="5.0.0">
  <folder name="Application" id="id-f1" type="application">
    <element xsi:type="archimate:ApplicationComponent" name="Client Registry" id="id-cr">
      <property key="fhir-actor" value="${C}/ActorDefinition/ClientRegistry"/>
    </element>
    <element xsi:type="archimate:ApplicationInterface" name="Registry API" id="id-api">
      <property key="fhir-actor" value="${C}/ActorDefinition/ClientRegistry|0.1.0"/>
    </element>
    <element xsi:type="archimate:ApplicationComponent" name="Wrong kind" id="id-wk">
      <property key="fhir-actor" value="${C}/ActorDefinition/health-worker"/>
    </element>
    <element xsi:type="archimate:ApplicationComponent" name="Missing" id="id-miss">
      <property key="fhir-actor" value="${C}/ActorDefinition/Nowhere"/>
    </element>
    <element xsi:type="archimate:ApplicationComponent" name="By id only" id="id-bad">
      <property key="fhir-actor" value="ClientRegistry"/>
    </element>
    <element xsi:type="archimate:ApplicationComponent" name="Untagged" id="id-u"/>
    <element xsi:type="archimate:DataObject" name="Record" id="id-d">
      <property key="fhir-actor" value="${C}/ActorDefinition/ClientRegistry"/>
    </element>
  </folder>
  <folder name="Business" id="id-f2" type="business">
    <element xsi:type="archimate:BusinessRole" name="Health worker" id="id-hw">
      <property key="fhir-actor" value="${C}/ActorDefinition/health-worker"/>
    </element>
    <element xsi:type="archimate:BusinessActor" name="Registrar" id="id-reg">
      <property key="fhir-actor" value="${C}/ActorDefinition/FacilityRegistry"/>
    </element>
  </folder>
</archimate:model>`;

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("the IG's ActorDefinitions", () => {
  it("reads id, canonical and type from FSH, and skips rules inside a description", () => {
    expect(fshActors(FSH, C, "actors.fsh").map((a) => [a.id, a.url, a.type])).toEqual([
      ["ClientRegistry", `${C}/ActorDefinition/ClientRegistry`, "system"],
      ["health-worker", `${C}/ActorDefinition/health-worker`, "person"],
      ["FacilityRegistry", `${C}/ActorDefinition/FacilityRegistry`, "system"],
    ]);
    expect(igCanonical(`id: x\ncanonical: http://smart.who.int/ra/ # the IG\n`)).toBe("http://smart.who.int/ra");
  });

  it("finds them under input/fsh and in generated JSON, keyed by canonical", () => {
    const ig = mkdtempSync(join(tmpdir(), "actors-ig-"));
    dirs.push(ig);
    writeFileSync(join(ig, "sushi-config.yaml"), `id: tiny\ncanonical: ${C}\n`);
    mkdirSync(join(ig, "input", "fsh", "actors"), { recursive: true });
    writeFileSync(join(ig, "input", "fsh", "actors", "actors.fsh"), FSH);
    mkdirSync(join(ig, "fsh-generated", "resources"), { recursive: true });
    writeFileSync(join(ig, "fsh-generated", "resources", "ActorDefinition-ClientRegistry.json"), JSON.stringify({ resourceType: "ActorDefinition", id: "ClientRegistry", type: "system" }));
    writeFileSync(join(ig, "fsh-generated", "resources", "ActorDefinition-Lab.json"), JSON.stringify({ resourceType: "ActorDefinition", id: "Lab", url: `${C}/ActorDefinition/Lab`, type: "system" }));
    const { canonical, actors } = igActors(ig);
    expect(canonical).toBe(C);
    expect([...actors.keys()].sort()).toEqual(["ClientRegistry", "FacilityRegistry", "Lab", "health-worker"].map((id) => `${C}/ActorDefinition/${id}`));
  });
});

describe("the model's fhir-actor tags", () => {
  const actors = new Map(fshActors(FSH, C, "actors.fsh").map((a) => [a.url, a]));
  const check = checkActors(parseArchimate(XML), actors);

  it("resolves a tag to an actor, and fails a bad value, a missing actor, a wrong kind and a type mismatch", () => {
    expect(check.links.map((l) => [l.element, l.actor])).toEqual([
      ["id-cr", `${C}/ActorDefinition/ClientRegistry`],
      ["id-api", `${C}/ActorDefinition/ClientRegistry`],
      ["id-hw", `${C}/ActorDefinition/health-worker`],
    ]);
    expect(check.problems).toEqual([
      `id-wk "Wrong kind" (ApplicationComponent): health-worker is a #person actor, and ApplicationComponent elements realize only #system actors`,
      `id-miss "Missing" (ApplicationComponent): fhir-actor="${C}/ActorDefinition/Nowhere" names no ActorDefinition of the IG`,
      `id-bad "By id only" (ApplicationComponent): fhir-actor="ClientRegistry" is not an ActorDefinition canonical URL (<IG canonical>/ActorDefinition/<id>)`,
      `id-d "Record" (DataObject): a DataObject cannot realize an actor (an application or technology element, or a business actor or role)`,
      `id-reg "Registrar" (BusinessActor): FacilityRegistry is a #system actor, and BusinessActor elements realize only #person actors`,
    ]);
    expect(actorTypeOf("BusinessRole")).toBe("person");
    expect(actorTypeOf("Goal")).toBeUndefined();
  });

  it("reports the actors no element realizes", () => {
    expect(check.unrealized).toEqual([`${C}/ActorDefinition/FacilityRegistry`]);
  });

  it("gives element → actors and actor → elements for back-links", () => {
    const b = backLinks(check, actors);
    expect(b.elements["id-api"]).toEqual({ name: "Registry API", type: "ApplicationInterface", actors: [`${C}/ActorDefinition/ClientRegistry`] });
    expect(b.actors[`${C}/ActorDefinition/ClientRegistry`]).toEqual({ id: "ClientRegistry", type: "system", elements: ["id-cr", "id-api"] });
    expect(b.actors[`${C}/ActorDefinition/FacilityRegistry`].elements).toEqual([]);
  });
});
