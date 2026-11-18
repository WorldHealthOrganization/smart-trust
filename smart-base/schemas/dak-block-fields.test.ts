/**
 * The DAK kinds carry the fields of WHO's own DAK logical models
 * (`input/fsh/models/`), smart-base#245.
 *
 * Each field must survive the kind's Zod schema: Zod strips what it does not
 * know (bean `zdrf`), so a field the interface declares but the schema omits
 * would be written by an author and silently vanish. And every field is
 * optional, so a block written before them still builds.
 */
import { describe, test, expect } from "bun:test";
import {
  persona,
  businessProcess,
  dataElement,
  indicator,
  functionalRequirement,
  nonFunctionalRequirement,
  DAK_BLOCK_SCHEMAS,
} from "./dak-blocks";

describe("WHO logical-model fields survive the schema", () => {
  test("persona: GenericPersona / Persona", () => {
    const b = persona({ label: "pers:nurse", title: "Nurse", personaType: "key", otherNames: ["Midwife"], iscoCodes: ["2221"] });
    expect(DAK_BLOCK_SCHEMAS.persona.parse(b)).toMatchObject({ personaType: "key", otherNames: ["Midwife"], iscoCodes: ["2221"] });
  });

  test("business-process: BusinessProcessWorkflow", () => {
    const tasks = [{ identifier: "T1", name: "Submit", description: "Submit the application" }];
    const b = businessProcess({ label: "bp:renew", objectives: "Renew a licence", scenarios: ["scen:renew"], tasks });
    expect(DAK_BLOCK_SCHEMAS["business-process"].parse(b)).toMatchObject({ objectives: "Renew a licence", scenarios: ["scen:renew"], tasks });
  });

  test("data-element: CoreDataElement", () => {
    const b = dataElement({ label: "de:name", cdeType: "logicalmodel", canonical: "http://example.org/StructureDefinition/Name" });
    expect(DAK_BLOCK_SCHEMAS["data-element"].parse(b)).toMatchObject({ cdeType: "logicalmodel", canonical: "http://example.org/StructureDefinition/Name" });
  });

  test("indicator: ProgramIndicator", () => {
    const b = indicator({ label: "ind:a", indicatorId: "IND.01", definition: "d", numerator: "n", denominator: "m", disaggregation: "sex", references: ["hi:a"] });
    expect(DAK_BLOCK_SCHEMAS.indicator.parse(b)).toMatchObject({ indicatorId: "IND.01", numerator: "n", denominator: "m", disaggregation: "sex", references: ["hi:a"] });
  });

  test("functional-requirement: FunctionalRequirement", () => {
    const b = functionalRequirement({ label: "freq:FR-LC-01", requirementId: "FR-LC-01", activity: "Manage status changes", actors: ["pers:registration-officer"], capability: "record a status change", benefit: "the register stays current", classification: ["lifecycle"] });
    expect(DAK_BLOCK_SCHEMAS["functional-requirement"].parse(b)).toMatchObject({ requirementId: "FR-LC-01", actors: ["pers:registration-officer"], capability: "record a status change", benefit: "the register stays current" });
  });

  test("non-functional-requirement: NonFunctionalRequirement", () => {
    const b = nonFunctionalRequirement({ label: "nfreq:availability", requirementId: "NFR-01", requirement: "Available outside working hours", category: "availability" });
    expect(DAK_BLOCK_SCHEMAS["non-functional-requirement"].parse(b)).toMatchObject({ requirementId: "NFR-01", requirement: "Available outside working hours", category: "availability" });
  });
});

describe("the fields are checked", () => {
  test("persona type is SGPersonaTypesVS only", () => {
    expect(() => persona({ label: "pers:x", personaType: "person" as never })).toThrow();
  });
  test("an ISCO-08 code is one to four digits", () => {
    expect(() => persona({ label: "pers:x", iscoCodes: ["nurse"] })).toThrow();
  });
  test("a core data element type is CoreDataElementTypeVS only", () => {
    expect(() => dataElement({ label: "de:x", cdeType: "table" as never })).toThrow();
  });
  test("a business-process task needs identifier, name and description", () => {
    expect(() => businessProcess({ label: "bp:x", tasks: [{ identifier: "T1", name: "", description: "d" }] })).toThrow();
  });
});

describe("blocks written before the fields still build", () => {
  test("a bare persona, requirement and data element", () => {
    expect(persona({ label: "pers:old", uses: [] }).kind).toBe("persona");
    expect(functionalRequirement({ label: "freq:old", uses: [] }).kind).toBe("functional-requirement");
    expect(dataElement({ label: "de:old", uses: [] }).kind).toBe("data-element");
  });
});
