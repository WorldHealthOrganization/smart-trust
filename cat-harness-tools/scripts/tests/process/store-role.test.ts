/**
 * A store is a Role with a `store` block (owner, 2026-11-01, Q-DS-1 A).
 *
 * @module scripts/tests/process/store-role
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";

import { RoleDefSchema, storeRoleError } from "../../../schemas/process/role-graph.js";

const WORK_PLAN = {
  id: "work-plan",
  title: "Work plan (beans)",
  description: "The shared store.",
  actorKinds: ["system"],
  skills: ["todo-manager"],
  store: {
    holds: ["bean-defs", "bean-notes", "workflow-state"],
    api: [
      { style: "graphql", document: "https://github.com/litlfred/beans/blob/main/internal/graph/schema.graphqls" },
      { style: "cli", tools: ["beans-cli"] },
    ],
    realisedBy: "beans",
    published: true,
  },
};

describe("the store block", () => {
  test("a store role parses with its block intact", () => {
    const r = RoleDefSchema.parse(WORK_PLAN);
    expect(r.store?.api?.[0]?.style).toBe("graphql");
    expect(storeRoleError(r)).toBeUndefined();
  });

  test("an API style no transport uses is refused", () => {
    const bad = { ...WORK_PLAN, store: { api: [{ style: "soap", document: "x" }] } };
    expect(RoleDefSchema.safeParse(bad).success).toBe(false);
  });

  test("an unknown key in the block is refused, not dropped", () => {
    const bad = { ...WORK_PLAN, store: { ...WORK_PLAN.store, owner: "someone" } };
    expect(RoleDefSchema.safeParse(bad).success).toBe(false);
  });

  test("a role people or agents play cannot be a store", () => {
    const r = RoleDefSchema.parse({ ...WORK_PLAN, actorKinds: ["agent", "system"] });
    expect(storeRoleError(r)).toMatch(/a store is played by system or external actors only/);
  });
});
