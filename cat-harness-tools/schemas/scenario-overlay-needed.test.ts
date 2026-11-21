import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RoleGraph } from "./process/role-graph";
import {
  checkoutActors,
  checkoutPolicies,
  neededActors,
  neededPolicies,
  onlyAdds,
  overlayRoleGraphs,
  scenarioLayersBelow,
} from "./process/scenario-overlay";

/**
 * A layer audit resolves actors from the platform, every layer the
 * audited one `needs`, and its own `scenarios/actors/` — never from a sibling
 * or a dependent. Built as throwaway trees, never the live repository.
 */
const SCENARIOS = [{ id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] }];

function actor(root: string, inst: string, file: string, body: object): void {
  mkdirSync(join(root, inst, "scenarios", "actors"), { recursive: true });
  writeFileSync(join(root, inst, "scenarios", "actors", `${file}.json`), JSON.stringify(body));
}

function policy(root: string, inst: string, file: string, uid: string, permission: object[]): void {
  mkdirSync(join(root, inst, "policies"), { recursive: true });
  writeFileSync(
    join(root, inst, "policies", `${file}.jsonld`),
    JSON.stringify({ "@context": "http://www.w3.org/ns/odrl.jsonld", "@type": "Set", uid, profile: "urn:folio-odrl", permission }),
  );
}

function checkout(): string {
  const root = mkdtempSync(join(tmpdir(), "needed-actors-"));
  const decl = (name: string, needs: string[]): void => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name, ...(needs.length ? { needs } : {}), directories: SCENARIOS }));
  };
  decl("cat-harness", []);
  decl("mid", ["cat-harness"]);
  decl("top", ["mid"]);
  decl("sibling", ["cat-harness"]);
  actor(root, "cat-harness", "admin", { id: "admin", title: "Administrator", kind: "person", roles: ["administrator"], capabilities: [] });
  actor(root, "mid", "vhl-sharer", { id: "vhl-sharer", title: "VHL Sharer", kind: "system", roles: ["sharer"], capabilities: [] });
  actor(root, "top", "vhl-receiver", { id: "vhl-receiver", title: "VHL Receiver", kind: "system", capabilities: [] });
  actor(root, "top", "sharer-ext", { extends: "vhl-sharer", roles: ["key-holder"] });
  actor(root, "sibling", "stranger", { id: "stranger", title: "Stranger", kind: "person", capabilities: [] });
  policy(root, "cat-harness", "defaults", "urn:p:defaults", [{ assignee: "admin", action: "role-management" }]);
  policy(root, "mid", "sharing", "urn:p:mid", [{ assignee: "vhl-sharer", action: "content-authoring" }]);
  policy(root, "sibling", "stranger", "urn:p:sibling", [{ assignee: "stranger", action: "content-authoring" }]);
  return root;
}

describe("neededActors — the actors one instance may name", () => {
  test("the platform's, every needed instance's and its own; not a sibling's", () => {
    const root = checkout();
    try {
      const ids = neededActors(join(root, "top"), join(root, "cat-harness", "scenarios", "actors")).map((a) => a.id).sort();
      expect(ids).toEqual(["admin", "vhl-receiver", "vhl-sharer"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an extension in the audited instance adds roles to an actor a needed instance declares", () => {
    const root = checkout();
    try {
      const sharer = neededActors(join(root, "top"), join(root, "cat-harness", "scenarios", "actors")).find((a) => a.id === "vhl-sharer");
      expect(sharer?.roles).toEqual(["sharer", "key-holder"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a needed instance sees nothing of the instance above it", () => {
    const root = checkout();
    try {
      const ids = neededActors(join(root, "mid"), join(root, "cat-harness", "scenarios", "actors")).map((a) => a.id).sort();
      expect(ids).toEqual(["admin", "vhl-sharer"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the layers are deepest first, the audited instance last", () => {
    const root = checkout();
    try {
      const names = scenarioLayersBelow(join(root, "top")).map((l) => l.instance);
      expect(names).toEqual(["cat-harness", "mid", "top"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("policies travel with the actors they grant", () => {
  const PLATFORM = (root: string) => join(root, "cat-harness", "policies");

  test("an instance's own audit reads the platform's, every needed instance's and its own; not a sibling's", () => {
    const root = checkout();
    try {
      expect([...neededPolicies(join(root, "top"), PLATFORM(root)).keys()].sort()).toEqual(["urn:p:defaults", "urn:p:mid"]);
      expect([...neededPolicies(join(root, "mid"), PLATFORM(root)).keys()].sort()).toEqual(["urn:p:defaults", "urn:p:mid"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the platform's checkout reads every dependent's", () => {
    const root = checkout();
    try {
      const uids = [...checkoutPolicies(join(root, "cat-harness"), PLATFORM(root)).keys()].sort();
      expect(uids).toEqual(["urn:p:defaults", "urn:p:mid", "urn:p:sibling"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a higher instance redeclaring a lower policy's uid and dropping its rules is refused, not merged", () => {
    const root = checkout();
    try {
      policy(root, "top", "takeover", "urn:p:defaults", []);
      expect(() => neededPolicies(join(root, "top"), PLATFORM(root))).toThrow(/already declared below/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * A move in flight (owner, 2026-10-23, "Relax the rule"): between the pull
 * request that adds an id to a higher layer and the one that removes it from
 * the lower layer, both declare it. A redeclaration that only adds is
 * accepted with a warning naming the id and both layers; one that changes or
 * drops anything is refused as before.
 */
describe("a move in flight — a redeclaration that only adds", () => {
  let warn: ReturnType<typeof spyOn<Console, "warn">> | undefined;
  const warnings = (): string[] => (warn?.mock.calls ?? []).map((c) => String(c[0]));
  afterEach(() => {
    warn?.mockRestore();
    warn = undefined;
  });
  const listen = (): void => {
    warn = spyOn(console, "warn").mockImplementation(() => {});
  };
  const ACTORS = (root: string) => join(root, "cat-harness", "scenarios", "actors");
  const PLATFORM = (root: string) => join(root, "cat-harness", "policies");
  const ADMIN = { id: "admin", title: "Administrator", kind: "person", roles: ["administrator"], capabilities: [] };

  test("onlyAdds: equal scalars, superset arrays, nested objects by the same rule; `_`-keys ignored", () => {
    expect(onlyAdds({ a: 1, b: ["x"], m: { w: "p" } }, { a: 1, b: ["x", "y"], m: { w: "p", v: 2 }, c: 3 })).toBe(true);
    expect(onlyAdds({ a: 1, _comment: "old" }, { a: 1, _comment: "new" })).toBe(true);
    expect(onlyAdds({ a: 1 }, { a: 2 })).toBe(false);
    expect(onlyAdds({ a: 1, b: ["x"] }, { a: 1, b: [] })).toBe(false);
    expect(onlyAdds({ a: 1 }, {})).toBe(false);
    expect(onlyAdds({ m: { w: "p" } }, { m: { w: "q" } })).toBe(false);
    // An array member is kept only if it is there unchanged: a rule that gains a constraint is a changed rule.
    expect(onlyAdds({ r: [{ assignee: "a", action: "x" }] }, { r: [{ assignee: "a", action: "x", constraint: [] }] })).toBe(false);
  });

  test("an actor redeclared identically by a higher instance is accepted, with a warning naming both layers", () => {
    const root = checkout();
    try {
      actor(root, "top", "admin-moved", ADMIN);
      listen();
      const admin = neededActors(join(root, "top"), ACTORS(root)).filter((a) => a.id === "admin");
      expect(admin).toHaveLength(1);
      expect(admin[0]!.path).toContain(join("top", "scenarios", "actors"));
      const w = warnings().filter((m) => m.includes('actor "admin"'));
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("cat-harness");
      expect(w[0]).toContain("top");
      expect(w[0]).toMatch(/move in flight/);
      expect(w[0]).toMatch(/removing the copy/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an actor redeclared with an added role and field is accepted, and keeps what a lower extension added", () => {
    const root = checkout();
    try {
      actor(root, "mid", "admin-moved", { ...ADMIN, roles: ["administrator", "auditor"], description: "Now with a description." });
      actor(root, "top", "admin-ext", { extends: "admin", roles: ["key-holder"] });
      listen();
      const admin = checkoutActors(join(root, "cat-harness"), ACTORS(root)).find((a) => a.id === "admin")!;
      expect(admin.roles).toEqual(["administrator", "auditor", "key-holder"]);
      expect(admin.description).toBe("Now with a description.");
      expect(warnings().some((m) => m.includes('actor "admin"') && /move in flight/.test(m))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an actor redeclared with a changed field or a dropped role is refused", () => {
    for (const changed of [{ ...ADMIN, kind: "agent" }, { ...ADMIN, roles: [] }, { ...ADMIN, title: "Admin" }]) {
      const root = checkout();
      try {
        actor(root, "top", "admin-moved", changed);
        expect(() => neededActors(join(root, "top"), ACTORS(root))).toThrow(/already declared below/);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  const ROLES: RoleGraph = {
    name: "base",
    roles: [
      { id: "mover", title: "Mover", description: "Moves.", actorKinds: ["agent"], skills: ["carry"] },
      { id: "stayer", title: "Stayer", description: "Stays.", actorKinds: ["person"], skills: [] },
    ] as RoleGraph["roles"],
  };

  test("a role redeclared identically is accepted, with a warning", () => {
    listen();
    const { graph } = overlayRoleGraphs(ROLES, [{ instance: "upper", graph: { name: "upper", roles: [{ ...ROLES.roles[0]! }] } }]);
    expect(graph.roles.map((r) => r.id)).toEqual(["mover", "stayer"]);
    expect(warnings().some((m) => m.includes('role "mover"') && m.includes("base") && m.includes("upper"))).toBe(true);
  });

  test("a role redeclared with added skills is accepted, and keeps what a lower extension added", () => {
    listen();
    const { graph } = overlayRoleGraphs(ROLES, [
      { instance: "middle", graph: { name: "middle", roles: [], extensions: [{ role: "stayer", skills: ["wait"] }] } },
      {
        instance: "upper",
        graph: { name: "upper", roles: [{ ...ROLES.roles[1]!, skills: ["sit"], persona: "Patient." }] as RoleGraph["roles"] },
      },
    ]);
    const stayer = graph.roles.find((r) => r.id === "stayer")!;
    expect(stayer.skills).toEqual(["sit", "wait"]);
    expect(warnings().some((m) => m.includes('role "stayer"') && m.includes("upper"))).toBe(true);
  });

  test("a role redeclared with a changed title or a dropped skill is refused", () => {
    for (const r of [{ ...ROLES.roles[0]!, title: "Carrier" }, { ...ROLES.roles[0]!, skills: [] }]) {
      expect(() =>
        overlayRoleGraphs(ROLES, [{ instance: "upper", graph: { name: "upper", roles: [r] as RoleGraph["roles"] } }]),
      ).toThrow(/already declared by base/);
    }
  });

  test("a policy redeclared identically, or with an added rule, is accepted with a warning", () => {
    const root = checkout();
    try {
      policy(root, "top", "moved", "urn:p:defaults", [
        { assignee: "admin", action: "role-management" },
        { assignee: "vhl-receiver", action: "content-authoring" },
      ]);
      listen();
      const all = neededPolicies(join(root, "top"), PLATFORM(root));
      expect(all.get("urn:p:defaults")!.permission).toHaveLength(2);
      expect(warnings().some((m) => m.includes('policy "urn:p:defaults"') && m.includes("top") && /move in flight/.test(m))).toBe(true);

      policy(root, "top", "moved", "urn:p:defaults", [{ assignee: "admin", action: "role-management" }]);
      expect(neededPolicies(join(root, "top"), PLATFORM(root)).get("urn:p:defaults")!.permission).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a policy redeclared with a changed rule is refused", () => {
    const root = checkout();
    try {
      policy(root, "top", "moved", "urn:p:defaults", [{ assignee: "admin", action: "content-authoring" }]);
      expect(() => neededPolicies(join(root, "top"), PLATFORM(root))).toThrow(/already declared below/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
