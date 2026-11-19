import { describe, expect, test } from "bun:test";
import { parseNestedStringField } from "../../pipeline/uses-field";
import { parseLeanRef } from "../../pipeline/content-graph";

/**
 * A block manifest carries several `ref:` keys — `lean.ref`, `simulator.ref`,
 * `computation.ref`. `parseLeanRef` matched `/\bref\s*:\s*["']([^"']+)["']/`
 * against the whole file and returned whichever came first.
 *
 * Three blocks in the `qou` corpus have `simulator: { ref: … }` and **no
 * `lean:` block at all**. They were reported as owning a Lean declaration
 * called `sim:…` — which put them in `declOwners` and gave them formal edges
 * they cannot have. A block that declares no Lean must read as declaring none.
 */
describe("parseLeanRef is scoped to the lean object", () => {
  test("a simulator ref is not a lean ref", () => {
    const src = `export default remark({
  label: "rem:x",
  simulator: { ref: "sim:q-double-slit" },
});`;
    expect(parseLeanRef(src)).toBeUndefined();
  });

  test("the lean ref wins even when another ref: comes first", () => {
    const src = `export default proposition({
  simulator: { ref: "sim:decoy" },
  lean: { ref: "qou:QOU.Real.decl", validation: "not_checked" },
});`;
    expect(parseLeanRef(src)).toBe("qou:QOU.Real.decl");
  });

  test("a lean ref is found when it comes first too", () => {
    const src = `lean: { ref: "qou:QOU.A.b" }, computation: { ref: "probe:x" },`;
    expect(parseLeanRef(src)).toBe("qou:QOU.A.b");
  });

  test("a lean block with no ref yields undefined, not a neighbour's", () => {
    const src = `lean: { validation: "stub" }, simulator: { ref: "sim:y" },`;
    expect(parseLeanRef(src)).toBeUndefined();
  });

  test("no lean block at all yields undefined", () => {
    expect(parseLeanRef(`label: "rem:x", computation: { ref: "probe:z" },`)).toBeUndefined();
  });
});

describe("parseNestedStringField", () => {
  test("a nested object does not end the scan early", () => {
    const src = `lean: { meta: { note: "x" }, ref: "qou:QOU.After.nested" },`;
    expect(parseNestedStringField(src, "lean", "ref")).toBe("qou:QOU.After.nested");
  });

  test("a comment before the outer field does not hide it", () => {
    const src = `title: "T",\n  // the lean decl moved in July\n  lean: { ref: "qou:QOU.A.b" },`;
    expect(parseNestedStringField(src, "lean", "ref")).toBe("qou:QOU.A.b");
  });

  test("the key quoted in prose does not win", () => {
    const src = `body: "set lean: { ref: \\"qou:GHOST\\" } on it", lean: { ref: "qou:REAL" },`;
    expect(parseNestedStringField(src, "lean", "ref")).toBe("qou:REAL");
  });

  test("an outer field that is not an object is skipped, not mis-read", () => {
    const src = `lean: someVar, lean: { ref: "qou:QOU.Second.form" },`;
    expect(parseNestedStringField(src, "lean", "ref")).toBe("qou:QOU.Second.form");
  });

  test("an absent outer field yields undefined", () => {
    expect(parseNestedStringField(`ref: "loose"`, "lean", "ref")).toBeUndefined();
  });
});
