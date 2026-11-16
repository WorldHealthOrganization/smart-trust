/**
 * The deployment report's own logic (bean `v3zw`): the role IS-A closure it
 * hands the resolver. The resolver's rules are tested in cat-harness.
 */
import { describe, expect, test } from "bun:test";

import { isAFrom } from "../lib/role-isa";

describe("isAFrom", () => {
  const graph = {
    roles: [
      { id: "viewer" },
      { id: "reviewer", inherits: ["viewer"] },
      { id: "qc-reviewer", inherits: ["reviewer"] },
    ],
  };

  test("follows inherits transitively", () => {
    const isA = isAFrom(graph);
    expect(isA("qc-reviewer", "reviewer")).toBe(true);
    expect(isA("qc-reviewer", "viewer")).toBe(true);
  });

  test("never upward, and never itself", () => {
    const isA = isAFrom(graph);
    expect(isA("viewer", "reviewer")).toBe(false);
    expect(isA("reviewer", "reviewer")).toBe(false);
  });

  test("no graph is no IS-A", () => {
    expect(isAFrom(undefined)("reviewer", "viewer")).toBe(false);
  });
});
