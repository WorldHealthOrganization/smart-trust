import { describe, expect, test } from "bun:test";
import { QaDeclarationSchema, addCounts, axisOf, globMatch, normalizeCounts, summarizeQaDoc } from "./qa-axis";

describe("normalizeCounts: one vocabulary", () => {
  test("`totals` and `counts`, `n/a` and `na`, read alike", () => {
    expect(normalizeCounts({ pass: 2, "n/a": 1, unknown: 0 })).toEqual({ pass: 2, na: 1, unknown: 0 });
    expect(normalizeCounts({ passed: 2, na: 1, errors: 3, warnings: 1 })).toEqual({ pass: 2, na: 1, fail: 3, warn: 1 });
  });
  test("nothing recognised is undefined, never all-zero", () => {
    expect(normalizeCounts({ rows: 3 })).toBeUndefined();
    expect(normalizeCounts([1, 2])).toBeUndefined();
    expect(normalizeCounts(undefined)).toBeUndefined();
  });
  test("adding keeps never-counted apart from zero", () => {
    expect(addCounts({ pass: 1 }, { fail: 0 })).toEqual({ pass: 1, fail: 0 });
    expect(addCounts({ pass: 1 }, undefined)).toEqual({ pass: 1 });
  });
});

describe("axisOf", () => {
  test("a declared writer's glob wins over the format", () => {
    expect(axisOf("lean/x.kg-qa.json", "kg-qa/v1", [{ axis: "lean", writes: ["lean/**"] }])).toBe("lean");
  });
  test("schema, then path", () => {
    expect(axisOf("x.json", "translation-qa/v1")).toBe("translations");
    expect(axisOf("a/b/c.kg-qa.json")).toBe("kg");
    expect(axisOf("node-views/x.node-views.qa.json")).toBe("site-build");
    expect(axisOf("paper/render-qa.json")).toBe("rendering");
    expect(axisOf("whatever.json")).toBeUndefined();
  });
  test("globs: `*` stays in a segment, `**` crosses them", () => {
    expect(globMatch("lean/*.json", "lean/a.json")).toBe(true);
    expect(globMatch("lean/*.json", "lean/a/b.json")).toBe(false);
    expect(globMatch("lean/**", "lean/a/b.json")).toBe(true);
  });
});

describe("summarizeQaDoc", () => {
  test("kg-qa totals", () => {
    const s = summarizeQaDoc("kg-qa/a.kg-qa.json", { $schema: "kg-qa/v1", subject: { kind: "tool", id: "a" }, totals: { pass: 1, fail: 2, "n/a": 0, unknown: 0 } });
    expect(s).toEqual({ path: "kg-qa/a.kg-qa.json", schema: "kg-qa/v1", axis: "kg", subject: "tool:a", counts: { pass: 1, fail: 2, na: 0, unknown: 0 } });
  });
  test("block-qa: the newest reviewer entry per criterion", () => {
    const s = summarizeQaDoc("x.qa.json", { $schema: "block-qa/v1", label: "def:x", criteria: { a: [{ result: "fail" }, { result: "pass" }], b: [{ result: "warn" }], c: [] } });
    expect(s.counts).toEqual({ pass: 1, warn: 1, unknown: 1 });
    expect(s.axis).toBe("block-qa");
    expect(s.subject).toBe("def:x");
  });
  test("qa-results: a family with findings fails", () => {
    expect(summarizeQaDoc("r.qa-results.json", { $schema: "qa-results/v1", families: { a: { count: 0 }, b: { count: 3 } } }).counts).toEqual({ pass: 1, fail: 1 });
  });
  test("an unknown format with no counts has none", () => {
    expect(summarizeQaDoc("x.json", { rows: 3 }).counts).toBeUndefined();
  });
});

describe("QaDeclarationSchema", () => {
  test("accepts writers and axes, refuses a twice-declared writer and an unknown axis", () => {
    expect(QaDeclarationSchema.safeParse({ writers: [{ id: "r", axis: "rendering", run: "bun run x.ts", writes: ["rendering/**"] }], axes: ["lean"] }).success).toBe(true);
    expect(QaDeclarationSchema.safeParse({ writers: [{ id: "r", axis: "rendering", run: "x", writes: ["a"] }, { id: "r", axis: "lean", run: "y", writes: ["b"] }] }).success).toBe(false);
    expect(QaDeclarationSchema.safeParse({ axes: ["nope"] }).success).toBe(false);
  });
});

describe("the instance declaration carries `qa` and a visualiser's `sections`", () => {
  const mk = (sections: string[], qa?: unknown) => ({
    name: "x",
    directories: [],
    visualisers: [
      { id: "qa", renderedBy: "state-viewer", coversKinds: ["qa"], sections },
      { id: "health", renderedBy: "state-viewer", coversKinds: ["health"] },
    ],
    ...(qa ? { qa } : {}),
  });
  test("a section names another visualiser of the same harness", async () => {
    const { CatHarnessDeclarationSchema } = await import("../kg/cat-harness");
    expect(CatHarnessDeclarationSchema.safeParse(mk(["health"])).success).toBe(true);
    expect(CatHarnessDeclarationSchema.safeParse(mk(["qa"])).success).toBe(false);
    expect(CatHarnessDeclarationSchema.safeParse(mk(["nope"])).success).toBe(false);
  });
  test("`qa` is read through its own schema", async () => {
    const { CatHarnessDeclarationSchema } = await import("../kg/cat-harness");
    expect(CatHarnessDeclarationSchema.safeParse(mk(["health"], { axes: ["lean"] })).success).toBe(true);
    expect(CatHarnessDeclarationSchema.safeParse(mk(["health"], { axes: ["x"] })).success).toBe(false);
  });
});
