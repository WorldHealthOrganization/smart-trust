import { describe, expect, test } from "bun:test";
import { diff, judges, splitFindings } from "../scripts/split-baseline.ts";

describe("split-baseline --check findings", () => {
  const base = { mcpTools: [{ name: "a", required: [], optional: [] }], knownSkills: ["x", "y"] };

  test("a skill a downstream repo adds is a note, not a failure (smart-base#249)", () => {
    const now = { ...base, knownSkills: ["x", "y", "dth-authoring"] };
    expect(splitFindings(diff(base, now))).toEqual({ failing: [], notes: ["skill newly resolves: dth-authoring"] });
  });

  test("a skill that stops resolving still fails", () => {
    const now = { ...base, knownSkills: ["x"] };
    expect(splitFindings(diff(base, now)).failing).toEqual(["skill no longer resolves: y"]);
  });

  test("a tool change still fails", () => {
    const now = { ...base, mcpTools: [] };
    expect(splitFindings(diff(base, now)).failing).toEqual(["tool gone: a"]);
  });
});

describe("split-baseline judges only the root it was recorded at", () => {
  // Owner, 2026-11-05: "scope to fa". A site that does not mount a layer
  // resolves none of its skills, and each read as "no longer resolves".
  test("the root it names is judged", () => {
    expect(judges({ root: "folio-assistant" }, "folio-assistant")).toBe(true);
  });

  test("any other root is not", () => {
    expect(judges({ root: "folio-assistant" }, "smart-ra")).toBe(false);
  });

  test("a baseline naming no root judges every root", () => {
    expect(judges({}, "smart-ra")).toBe(true);
  });
});
