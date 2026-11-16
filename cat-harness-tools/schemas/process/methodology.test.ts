/**
 * The skill → methodology edge (`uses-methodology`, owner 2026-10-16).
 * Whether each name resolves to a node is `check:methodology-evidence`'s
 * question, in cat-harness-tools; this pins only the field's shape.
 */
import { describe, expect, it } from "bun:test";

import { USES_METHODOLOGY_FIELD, UsesMethodologySchema } from "./methodology.ts";

describe("uses-methodology", () => {
  it("is the field skills carry", () => {
    expect(USES_METHODOLOGY_FIELD).toBe("uses-methodology");
  });

  it("is a list of methodology names", () => {
    expect(UsesMethodologySchema.safeParse(["wiregen", "hybrid-llm-deterministic"]).success).toBe(true);
  });

  it("refuses an empty list, a path, and a single string", () => {
    expect(UsesMethodologySchema.safeParse([]).success).toBe(false);
    expect(UsesMethodologySchema.safeParse(["not-a-dir/wiregen.md"]).success).toBe(false);
    expect(UsesMethodologySchema.safeParse("wiregen").success).toBe(false);
  });
});
