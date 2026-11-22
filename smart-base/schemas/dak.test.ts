/**
 * What the DAK placeholder promises, and — more usefully — what it promises
 * NOT to do while WHO's logical model is still being finalised.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DAK_COMPONENTS, DAK_COMPONENT_FIELDS, DAK_UNFORMALIZED_COMPONENTS } from "./dak-kinds";
import {
  DAK_INDEX_FILE,
  DAK_INDEX_SECTION,
  DAK_TYPE,
  DakDeclarationSchema,
  componentEntries,
  populatedComponents,
  readDakDeclaration,
  type DakDeclaration,
} from "./dak";

const minimal = { name: "smart-immunizations" };

/** A repo whose root `index.config.json` holds `index` verbatim (or no index at all). */
function inTempRepo(index: string | undefined, run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "dak-"));
  try {
    if (index !== undefined) writeFileSync(join(root, DAK_INDEX_FILE), index);
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** An index whose `contentTypes.dak` section is `section`. */
const withDak = (section: unknown) =>
  JSON.stringify({ $schema: "folio-index-config/v1", instances: [], contentTypes: { [DAK_INDEX_SECTION]: section } });

describe("the marker", () => {
  test("markerIsDakSectionOfIndex", () => {
    expect(DAK_INDEX_FILE).toBe("index.config.json");
    expect(DAK_INDEX_SECTION).toBe("dak");
  });

  test("projectsToWhoLogicalModel", () => {
    expect(DAK_TYPE).toBe("http://smart.who.int/base/StructureDefinition/DAK");
  });

  test("absentIsNotAnError", () => {
    inTempRepo(undefined, (root) => expect(readDakDeclaration(root)).toBeUndefined());
    inTempRepo(JSON.stringify({ $schema: "folio-index-config/v1", instances: [] }), (root) =>
      expect(readDakDeclaration(root)).toBeUndefined(),
    );
  });

  test("readsSectionAsDeclaration", () => {
    inTempRepo(withDak({ name: "smart-immunizations", canonicalUrl: "http://smart.who.int/immunizations" }), (root) =>
      expect(readDakDeclaration(root)).toMatchObject({ name: "smart-immunizations" }),
    );
  });

  test("unreadableOrMalformedThrows", () => {
    inTempRepo("{ not json", (root) => expect(() => readDakDeclaration(root)).toThrow(/not valid JSON/));
    inTempRepo(withDak({ canonicalUrl: "x" }), (root) =>
      expect(() => readDakDeclaration(root)).toThrow(/not a valid DAK declaration/),
    );
  });

  test("dakJsonNotRead", () => {
    inTempRepo(undefined, (root) => {
      writeFileSync(join(root, "dak.json"), JSON.stringify({ name: "old" }));
      expect(readDakDeclaration(root)).toBeUndefined();
    });
  });
});

describe("what it refuses to invent", () => {
  test("inlineInstanceCarriedUntouched", () => {
    // WHO's wrapper is settled (#active); what an instance holds is WHO's model,
    // not restated here. Anything inside comes back byte-identical.
    const odd = { instance: { anything: [1, 2], nested: { at: "all" } } };
    const parsed = DakDeclarationSchema.parse({ ...minimal, healthInterventions: [odd] });
    expect((parsed as DakDeclaration).healthInterventions).toEqual([odd]);
  });

  test("entryIsExactlyOneSourceWrapper", () => {
    const ok = (e: unknown) => DakDeclarationSchema.safeParse({ ...minimal, personas: [e] }).success;
    expect(ok({ url: "input/personas.json" })).toBe(true);
    expect(ok({ canonical: "http://smart.who.int/base/GenericPersona/x" })).toBe(true);
    expect(ok({ instance: {} })).toBe(true);
    expect(ok({})).toBe(false);
    expect(ok({ url: "a", canonical: "b" })).toBe(false);
    expect(ok({ anything: [1] })).toBe(false);
  });

  test("wrapperKeepsUnknownKeys", () => {
    const e = { url: "u", note: "kept" };
    const parsed = DakDeclarationSchema.parse({ ...minimal, indicators: [e] }) as DakDeclaration;
    expect(parsed.indicators).toEqual([e]);
  });

  test("unformalizedComponentTakesAnything", () => {
    for (const c of DAK_UNFORMALIZED_COMPONENTS) {
      const field = DAK_COMPONENT_FIELDS[c];
      expect(DakDeclarationSchema.safeParse({ ...minimal, [field]: [{ anything: 1 }] }).success).toBe(true);
    }
  });

  test("cardinalityEnforced", () => {
    expect(DakDeclarationSchema.safeParse({ ...minimal, personas: "not-an-array" }).success).toBe(false);
    expect(DakDeclarationSchema.safeParse({ ...minimal, personas: [] }).success).toBe(true);
  });

  test("unknownKeysSurviveRoundTrip", () => {
    const extra = { name: "x", somethingWHOAdded: { deep: [1] }, anotherThing: "kept" };
    const parsed = DakDeclarationSchema.parse(extra) as Record<string, unknown>;
    expect(parsed.somethingWHOAdded).toEqual({ deep: [1] });
    expect(parsed.anotherThing).toBe("kept");
  });
});

describe("the component fields come from the vocabulary, not from this module", () => {
  test("everyComponentAcceptedByName", () => {
    const all = Object.fromEntries(DAK_COMPONENTS.map((c) => [DAK_COMPONENT_FIELDS[c], []]));
    expect(DakDeclarationSchema.safeParse({ ...minimal, ...all }).success).toBe(true);
  });

  test("componentEntriesByComponentName", () => {
    const ab = [{ url: "a" }, { url: "b" }];
    const d = DakDeclarationSchema.parse({ ...minimal, personas: ab }) as DakDeclaration;
    expect(componentEntries(d, "generic-personas")).toEqual(ab);
    expect(componentEntries(d, "test-scenarios")).toEqual([]);
  });
});

describe("coverage distinguishes three states, not two", () => {
  test("absentEmptyPopulatedDistinct", () => {
    const absent = DakDeclarationSchema.parse(minimal) as DakDeclaration;
    const empty = DakDeclarationSchema.parse({ ...minimal, personas: [] }) as DakDeclaration;
    const full = DakDeclarationSchema.parse({ ...minimal, personas: [{ url: "a" }] }) as DakDeclaration;

    expect(populatedComponents(absent)).toEqual([]);
    expect(populatedComponents(empty)).toEqual([]);
    expect(populatedComponents(full)).toEqual(["generic-personas"]);

    // The first two agree on `populatedComponents` and differ on the record —
    // "nobody has said" is not "somebody said none".
    expect("personas" in absent).toBe(false);
    expect("personas" in empty).toBe(true);
  });
});

describe("labels", () => {
  test("dakCarriesTitleAndDescription", () => {
    const d = DakDeclarationSchema.parse({
      ...minimal,
      title: "Immunizations",
      description: "WHO SMART Guidelines DAK for routine immunization.",
    }) as DakDeclaration;
    expect(d.title).toBe("Immunizations");
    expect(d.description).toContain("immunization");
  });
});
