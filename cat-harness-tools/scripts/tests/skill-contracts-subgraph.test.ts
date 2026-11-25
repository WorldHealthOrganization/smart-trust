/**
 * A skill's I/O contract is found through the skill's own ref, wherever its
 * layer keeps it — the root `schemas/skills/` or a subgraph's own, such as
 * smart-base's `L2/schemas/skills/` — and publishes under an address keyed by
 * the skill, so moving it beside its skill does not change its IRI
 * (bean `cat-tools-st4q`).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildSkillIoContracts, skillIoIri } from "../harness-schema-export.js";
import { contractIdentity, layerContracts } from "../skill-contracts.js";
import { skillIoContracts } from "../tool-page.js";
import { FIXTURE_INSTANCE, writeDeclaration } from "../../test/support/instance-fixture.js";

const BASE = "https://site.example/fx/schema";
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function put(root: string, rel: string, text: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}
const skill = (name: string, io: Record<string, string> = {}) =>
  `---\nname: ${name}\ndescription: ${name} does a thing.\n${Object.entries(io)
    .map(([k, v]) => `${k}: ${v}\n`)
    .join("")}---\n\n# ${name}\n\nBody.\n`;
const schema = (type: string) => JSON.stringify({ $id: "https://hand-written.example/x.json", type });

/**
 * A layer with skills at its root and in an opt-in `L2/` subgraph, declared
 * from within as smart-base's are. `beta`'s contracts sit in the subgraph;
 * `alpha`'s at the root; `orphan` is a root contract no skill names.
 */
function layer(extra: (root: string) => void = () => {}): string {
  const root = mkdtempSync(join(tmpdir(), "contracts-subgraph-"));
  roots.push(root);
  writeDeclaration(root, {
    name: FIXTURE_INSTANCE,
    directories: [
      { id: "skills", path: "skills/", graphTypologies: ["skills"] },
      { id: "L2", path: "L2/", optIn: true, graphTypologies: ["cat-harness"] },
    ],
    enableSubgraphs: [`${FIXTURE_INSTANCE}.L2`],
  });
  put(
    root,
    "L2/graph.json",
    JSON.stringify({
      name: "L2",
      directories: [
        { id: "L2-skills", path: "skills/", subgraph: true, graphTypologies: ["skills"] },
        { id: "L2-schemas", path: "schemas/", subgraph: true, graphTypologies: ["schemas"] },
      ],
    }),
  );
  put(root, "skills/pkg/alpha.md", skill("alpha", { input: "schemas/skills/alpha/input.schema.json" }));
  put(root, "schemas/skills/alpha/input.schema.json", schema("object"));
  put(root, "schemas/skills/orphan/output.schema.json", schema("string"));
  put(
    root,
    "L2/skills/smart-l2/beta.md",
    skill("beta", { input: "L2/schemas/skills/beta/input.schema.json", output: "L2/schemas/skills/beta/output.schema.json" }),
  );
  put(root, "L2/schemas/skills/beta/input.schema.json", schema("object"));
  put(root, "L2/schemas/skills/beta/output.schema.json", schema("array"));
  extra(root);
  return root;
}

describe("contracts are found through the skills' refs, in subgraphs too", () => {
  test("the subgraph's, the root's, and an unnamed root contract are all the layer's", () => {
    const { contracts, collisions } = layerContracts(layer());
    expect(contracts).toEqual([
      { skill: "beta", io: "input", source: "L2/schemas/skills/beta/input.schema.json" },
      { skill: "beta", io: "output", source: "L2/schemas/skills/beta/output.schema.json" },
      { skill: "alpha", io: "input", source: "schemas/skills/alpha/input.schema.json" },
      { skill: "orphan", io: "output", source: "schemas/skills/orphan/output.schema.json" },
    ]);
    expect(collisions).toEqual([]);
  });

  test("a subgraph contract is published under the skill's address, with a computed $id", () => {
    const built = buildSkillIoContracts({ root: layer(), schemaBase: BASE });
    const beta = built.find((c) => c.skill === "beta" && c.io === "input");
    expect(beta?.source).toBe(join("L2", "schemas", "skills", "beta", "input.schema.json"));
    expect(beta?.published).toBe(join("skills", "beta", "input.schema.json"));
    expect(beta?.schema.$id).toBe(skillIoIri(BASE, "beta", "input"));
    // Content is the file's; only the identity is replaced, in place.
    expect(beta?.schema.type).toBe("object");
    expect(Object.keys(beta!.schema)).toEqual(["$id", "type"]);
  });

  test("moving a contract into a subgraph does not change where it publishes", () => {
    const atRoot = layer((r) => {
      put(r, "L2/skills/smart-l2/beta.md", skill("beta", { input: "schemas/skills/beta/input.schema.json" }));
      put(r, "schemas/skills/beta/input.schema.json", schema("object"));
    });
    const moved = layer();
    const pick = (root: string) => {
      const c = buildSkillIoContracts({ root, schemaBase: BASE }).find((x) => x.skill === "beta" && x.io === "input")!;
      return [c.published, c.schema.$id];
    };
    expect(pick(moved)).toEqual(pick(atRoot));
  });

  test("a contract outside the conventional tail is keyed by its skill and front-matter key", () => {
    expect(contractIdentity("L2/contracts/gamma-in.schema.json", "gamma", "input")).toEqual({ skill: "gamma", io: "input" });
    expect(contractIdentity("L2/schemas/skills/gamma/output.schema.json", "other", "input")).toEqual({ skill: "gamma", io: "output" });
    const root = layer((r) => {
      put(r, "L2/skills/smart-l2/gamma.md", skill("gamma", { input: "L2/contracts/gamma-in.schema.json" }));
      put(r, "L2/contracts/gamma-in.schema.json", schema("object"));
    });
    const g = buildSkillIoContracts({ root, schemaBase: BASE }).find((c) => c.skill === "gamma");
    expect(g?.published).toBe(join("skills", "gamma", "input.schema.json"));
  });

  test("two files claiming one address: the first by source publishes, the other is reported, not dropped", () => {
    const root = layer((r) => put(r, "schemas/skills/beta/input.schema.json", schema("object")));
    const { contracts, collisions } = layerContracts(root);
    expect(contracts.filter((c) => c.skill === "beta" && c.io === "input").map((c) => c.source)).toEqual([
      "L2/schemas/skills/beta/input.schema.json",
    ]);
    expect(collisions).toEqual([
      { skill: "beta", io: "input", source: "schemas/skills/beta/input.schema.json", kept: "L2/schemas/skills/beta/input.schema.json" },
    ]);
  });

  test("a ref to a missing file publishes nothing", () => {
    const root = layer((r) => put(r, "L2/skills/smart-l2/delta.md", skill("delta", { input: "L2/schemas/skills/delta/input.schema.json" })));
    expect(layerContracts(root).contracts.some((c) => c.skill === "delta")).toBe(false);
  });

  test("the tool pages read a subgraph contract through the skill", () => {
    const root = layer();
    const io = skillIoContracts("beta", [root], root);
    expect(io.map((c) => [c.io, c.file])).toEqual([
      ["input", "L2/schemas/skills/beta/input.schema.json"],
      ["output", "L2/schemas/skills/beta/output.schema.json"],
    ]);
  });
});
