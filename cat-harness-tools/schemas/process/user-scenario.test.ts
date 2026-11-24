import { describe, expect, test } from "bun:test";
import { BuildingBlocksSchema, JourneyPersonaSchema, parseUserScenario, UserScenarioSchema, UserScenarioV01Schema } from "./user-scenario";

const step = { id: "J1", title: "Born abroad", lead: "mother", experiences: [{ actor: "mother", doing: "holds the cards", emotion: 1 }] };
const v01 = { $schema: "user-scenario/0.1.0", id: "j1", title: "J1", description: "d", personas: ["mother"], steps: [step] };

describe("user-scenario: the draft family is read unchanged, each minor adds to it", () => {
  test("a 0.1.0 file parses as it is, by the draft's own shape and by the kind", () => {
    expect(UserScenarioV01Schema.safeParse(v01).success).toBe(true);
    expect(UserScenarioV01Schema.safeParse({ ...v01, partOf: "j" }).success).toBe(false);
    expect(UserScenarioSchema.safeParse(v01).success).toBe(true);
  });
  test("the kind refuses a newer minor and another major", () => {
    expect(UserScenarioSchema.safeParse({ ...v01, $schema: "user-scenario/0.5.0" }).success).toBe(false);
    expect(UserScenarioSchema.safeParse({ ...v01, $schema: "user-scenario/1.0.0" }).success).toBe(false);
  });
  test("0.2.0 groups (partOf, no steps) and carries gaps and views", () => {
    const group = { ...v01, $schema: "user-scenario/0.2.0", id: "j", steps: [] };
    expect(UserScenarioSchema.safeParse(group).success).toBe(true);
    const views = [{ model: "0.1.0", view: "id-1" }];
    const child = { ...v01, $schema: "user-scenario/0.2.0", partOf: "j", views, steps: [{ ...step, gaps: ["not yet"] }] };
    const parsed = parseUserScenario(child);
    expect(parsed.steps[0]).toMatchObject({ gaps: ["not yet"] });
    expect(parsed).toMatchObject({ partOf: "j", views });
    // A view names its model and its view, and nothing else; 0.1.0 has no views.
    expect(() => parseUserScenario({ ...child, views: [{ model: "0.1.0" }] })).toThrow();
    expect(() => parseUserScenario({ ...child, views: [{ ...views[0], colour: "red" }] })).toThrow();
    expect(UserScenarioV01Schema.safeParse({ ...v01, views }).success).toBe(false);
  });
  test("0.2.0 carries an illustration (alt required) and the scenario's shared style; 0.1.0 does not", () => {
    const il = { src: "docs/images/p3.png", alt: "Helped toward the clinic.", prompt: "A tent city at midday; no readable text." };
    const v02 = { ...v01, $schema: "user-scenario/0.2.0", illustrationStyle: { prompt: "Flat, no text.", cast: [{ actor: "mother", description: "d" }], notes: ["n"] }, steps: [{ ...step, illustration: il }] };
    expect(parseUserScenario(v02).steps[0]).toMatchObject({ illustration: il });
    expect(() => parseUserScenario({ ...v02, steps: [{ ...step, illustration: { src: "x.png" } }] })).toThrow(/alt/);
    expect(() => parseUserScenario({ ...v02, steps: [{ ...step, illustration: { ...il, caption: "baked" } }] })).toThrow();
    expect(UserScenarioV01Schema.safeParse({ ...v01, steps: [{ ...step, illustration: il }] }).success).toBe(false);
  });
  test("a step id twice, an actor not among the personas, and an unknown key are refused", () => {
    expect(() => parseUserScenario({ ...v01, steps: [step, step] })).toThrow(/appears twice/);
    expect(() => parseUserScenario({ ...v01, steps: [{ ...step, lead: "stranger" }] })).toThrow(/not among the scenario's personas/);
    expect(() => parseUserScenario({ ...v01, steps: [{ ...step, mood: 1 }] })).toThrow();
  });
  test("0.2.0 carries a scene, FHIR changes and a hand-off in words; a glyph not on the list is refused", () => {
    const v02 = { ...v01, $schema: "user-scenario/0.2.0", scene: [{ icon: "hospital", label: "A clinic" }] };
    const fhirChanges = [{ resource: "Immunization ×2", change: "primarySource flipped", profile: "LaoImm", profileOf: "LA", examples: ["Immunization/J3HepB"], spec: "https://hl7.org/fhir/immunization.html" }];
    const handoff = { summary: "s", from: "Thai hospital", to: "mother" };
    const parsed = parseUserScenario({ ...v02, steps: [{ ...step, fhirChanges, handoff }] });
    expect(parsed.scene).toEqual([{ icon: "hospital", label: "A clinic" }]);
    expect(parsed.steps[0]!.fhirChanges).toEqual(fhirChanges);
    expect(parsed.steps[0]!.handoff).toEqual(handoff);
    expect(() => parseUserScenario({ ...v02, scene: [{ icon: "unicorn", label: "x" }] })).toThrow();
    expect(() => parseUserScenario({ ...v02, steps: [{ ...step, fhirChanges: [{ resource: "R", change: "c", examples: ["not a key"] }] }] })).toThrow();
    expect(UserScenarioV01Schema.safeParse({ ...v01, steps: [{ ...step, fhirChanges }] }).success).toBe(false);
  });
  test("0.3.0 links a step to its DAK assets by artefact-index key, with what each is to the step; 0.2.0 files still parse", () => {
    const dak = [{ key: "StructureDefinition/DdRegistration", rel: "data" as const }, { key: "PlanDefinition/DT01", rel: "decides" as const }, { key: "Measure/IND03", rel: "measures" as const }, { key: "Library/DT01Logic" }];
    const v03 = { ...v01, $schema: "user-scenario/0.3.0", steps: [{ ...step, dak }] };
    expect(parseUserScenario(v03).steps[0]!.dak).toEqual(dak);
    expect(() => parseUserScenario({ ...v03, steps: [{ ...step, dak: [{ key: "not a key" }] }] })).toThrow();
    expect(() => parseUserScenario({ ...v03, steps: [{ ...step, dak: [{ key: "Measure/IND03", rel: "counts" }] }] })).toThrow();
    expect(() => parseUserScenario({ ...v03, steps: [{ ...step, dak: [{ key: "Measure/IND03", label: "x" }] }] })).toThrow();
    expect(UserScenarioSchema.safeParse({ ...v01, $schema: "user-scenario/0.2.0", steps: [{ ...step, gaps: ["g"] }] }).success).toBe(true);
    expect(UserScenarioV01Schema.safeParse({ ...v01, steps: [{ ...step, dak }] }).success).toBe(false);
  });
  test("0.4.0: a parent lists its parts in order, a step may include a journey, and partOf is refused", () => {
    const v04 = { ...v01, $schema: "user-scenario/0.4.0" };
    const parts = [{ scenario: "j1" }, { scenario: "j2", optional: true as const, repeats: true as const }];
    expect(parseUserScenario({ ...v04, parts, steps: [] }).parts).toEqual(parts);
    expect(parseUserScenario({ ...v04, steps: [{ ...step, includes: "j2" }] }).steps[0]!.includes).toBe("j2");
    expect(() => parseUserScenario({ ...v04, partOf: "j" })).toThrow(/partOf is refused/);
    expect(() => parseUserScenario({ ...v04, parts: [{ scenario: "j1" }, { scenario: "j1" }] })).toThrow(/appears twice/);
    expect(() => parseUserScenario({ ...v04, parts: [{ scenario: "j1", optional: false }] })).toThrow();
    // An older file keeps partOf.
    expect(parseUserScenario({ ...v01, $schema: "user-scenario/0.3.0", partOf: "j" }).partOf).toBe("j");
  });
  test("0.4.0 leaves derivable fields out: personas with parts, steps, a step's lead and experiences; earlier families still need them", () => {
    const plain = { $schema: "user-scenario/0.4.0", id: "s", title: "S", description: "d", personas: ["caregiver"] };
    expect(parseUserScenario(plain).steps).toEqual([]);
    expect(parseUserScenario({ ...plain, personas: undefined, parts: [{ scenario: "a" }] }).personas).toBeUndefined();
    expect(() => parseUserScenario({ ...plain, personas: undefined })).toThrow(/personas is required unless the journey has parts/);
    expect(parseUserScenario({ ...plain, steps: [{ id: "S1", title: "t", realisedBy: [{ process: "p.bpmn", tasks: ["T"] }] }] }).steps[0]!.lead).toBeUndefined();
    // 0.4.0 personas may be roles, so whether a step's actor is among them is check:journey-refs' to say.
    expect(parseUserScenario({ ...plain, steps: [step] }).steps).toHaveLength(1);
    expect(() => parseUserScenario({ ...v01, $schema: "user-scenario/0.3.0", personas: undefined })).toThrow(/personas is required before/);
    expect(() => parseUserScenario({ ...v01, $schema: "user-scenario/0.3.0", steps: [{ id: "S1", title: "t" }] })).toThrow(/lead and experiences are required before/);
  });
  test("an emotion outside -2..2 is refused", () => {
    expect(() => parseUserScenario({ ...v01, steps: [{ ...step, experiences: [{ actor: "mother", doing: "x", emotion: 3 }] }] })).toThrow();
  });
});

describe("building-blocks: a block is in a declared layer, once", () => {
  const block = { id: "sdk", name: "SDK", kind: "tool", layer: "apps", jurisdiction: "International", what: "w" };
  test("valid catalogue", () => {
    expect(BuildingBlocksSchema.safeParse({ $schema: "building-blocks/0.1.0", layers: [{ id: "apps", label: "Apps" }], blocks: [block] }).success).toBe(true);
  });
  test("big ideas name blocks of the catalogue", () => {
    const c = { $schema: "building-blocks/0.1.0", layers: [{ id: "apps", label: "Apps" }], blocks: [block] };
    expect(BuildingBlocksSchema.safeParse({ ...c, ideas: [{ id: "i", title: "T", text: "t", blocks: ["sdk"] }] }).success).toBe(true);
    expect(BuildingBlocksSchema.safeParse({ ...c, ideas: [{ id: "i", title: "T", text: "t", blocks: ["ghost"] }] }).success).toBe(false);
  });
  test("a persona may carry a glyph for its avatar", () => {
    expect(JourneyPersonaSchema.safeParse({ name: "Somsack", icon: "baby" }).success).toBe(true);
    expect(JourneyPersonaSchema.safeParse({ name: "Somsack", icon: "dragon" }).success).toBe(false);
  });
  test("an unknown layer and a duplicate id are refused", () => {
    expect(BuildingBlocksSchema.safeParse({ $schema: "building-blocks/0.1.0", layers: [{ id: "data", label: "Data" }], blocks: [block] }).success).toBe(false);
    expect(BuildingBlocksSchema.safeParse({ $schema: "building-blocks/0.1.0", layers: [{ id: "apps", label: "Apps" }], blocks: [block, block] }).success).toBe(false);
  });
});
