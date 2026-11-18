/**
 * `strengthFinding` over the code lists this layer actually declares, plus a
 * retired code built in the test (bean `55ao`).
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { loadCodeLists } from "@litlfred/cat-harness-tools/schemas/library/code-list.js";
import { recommendation } from "@litlfred/cat-harness-tools/schemas/builders.js";
import { strengthFinding } from "./recommendation-strength.js";

const lists = loadCodeLists([join(import.meta.dir, "..", "code-lists")]);

describe("the code lists core declares", () => {
  it("twoStrengthCodeLists", () => {
    expect([...lists.keys()].sort()).toEqual(["grade-recommendation-strength", "rfc2119-requirement-level"]);
    expect(lists.get("grade-recommendation-strength")!.codes.map((c) => c.code)).toEqual(["strong", "conditional"]);
  });
});

describe("strengthFinding", () => {
  it("declaredCodeResolves", () => {
    expect(strengthFinding({ list: "grade-recommendation-strength", code: "conditional" }, lists)).toBeNull();
    expect(strengthFinding({ list: "rfc2119-requirement-level", code: "should-not" }, lists)).toBeNull();
  });

  it("noStrengthNoFinding", () => {
    expect(strengthFinding(undefined, lists)).toBeNull();
  });

  it("undeclaredListNamed", () => {
    expect(strengthFinding({ list: "grade", code: "strong" }, lists)).toMatch(/"grade".*declared: grade-recommendation-strength, rfc2119-requirement-level/);
  });

  it("unknownCodeNamed", () => {
    expect(strengthFinding({ list: "grade-recommendation-strength", code: "weak" }, lists)).toMatch(/"weak".*codes: strong, conditional/);
  });

  it("retiredCodeRefused", () => {
    const withRetired = new Map(lists);
    const g = lists.get("grade-recommendation-strength")!;
    withRetired.set(g.id, { ...g, codes: [...g.codes, { code: "weak", label: "Weak", definition: "The earlier name for conditional.", status: "retired" }] });
    expect(strengthFinding({ list: g.id, code: "weak" }, withRetired)).toMatch(/retired/);
  });
});

describe("the recommendation builder carries strength and about", () => {
  it("builderCarriesStrengthAndAbout", () => {
    const b = recommendation({ label: "who-anc:iron-folate", title: "Iron and folic acid", strength: { list: "grade-recommendation-strength", code: "strong" }, about: ["hi:anc-supplementation"] });
    expect(b).toMatchObject({ kind: "recommendation", strength: { code: "strong" }, about: ["hi:anc-supplementation"] });
  });

  it("builderRefusesFreeTextStrength", () => {
    expect(() => recommendation({ label: "r:1", strength: "strong" as never })).toThrow();
  });
});
