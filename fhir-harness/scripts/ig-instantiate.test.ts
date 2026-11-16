import { describe, expect, test } from "bun:test";
import { IG_SOURCES, withIgnoredAst, withIgSection } from "./ig-instantiate.ts";

describe("ig-instantiate", () => {
  test("declaresExistingSources", () => {
    const next = withIgSection({ instances: [], contentTypes: { other: { x: 1 } } }, (p) => p !== "ig.ini");
    expect(next).toEqual({ instances: [], contentTypes: { other: { x: 1 }, ig: { include: ["sushi-config.yaml", "input/"] } } });
  });

  test("existingSectionUnchanged", () => {
    expect(withIgSection({ contentTypes: { ig: { include: ["input/fsh/"] } } }, () => true)).toBeUndefined();
  });

  test("refusesNonIgRepo", () => {
    expect(() => withIgSection({}, () => false)).toThrow(/not an IG repository/);
    expect(IG_SOURCES).toContain("input/");
  });

  test("ignoresOutputAstOnce", () => {
    expect(withIgnoredAst("output/\n")).toBe("output/\noutput-ast/\n");
    expect(withIgnoredAst("output/")).toBe("output/\noutput-ast/\n");
    expect(withIgnoredAst("/output-ast/\n")).toBe("/output-ast/\n");
  });
});
