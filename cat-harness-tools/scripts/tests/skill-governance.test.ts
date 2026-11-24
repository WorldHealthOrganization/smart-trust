/**
 * Which skill governs a directory is read from the skills (#1168 B7b).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { frontMatterList, governingSkills, skillGovernance } from "../skill-governance.js";

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "governance-"));
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(root, dirname(f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
  return root;
}

const skill = (kinds: string[], governs: string[] = []): string =>
  "---\nname: s\n" +
  (kinds.length ? `graph-typologies:\n${kinds.map((k) => `  - ${k}\n`).join("")}` : "") +
  (governs.length ? `governs:\n${governs.map((g) => `  - ${g}\n`).join("")}` : "") +
  "---\n# s\n";

const files = {
  "platform/skills/todo-manager.md": skill(["beans"]),
  "platform/skills/skills-and-tools.md": skill([], ["platform/tools"]),
  "domain/skills/ig-build.md": skill(["fhir-index"], ["domain/tools"]),
  "platform/docs/skills/not-a-skill.md": skill(["beans"]),
};

describe("reading the declarations", () => {
  test("a list, an inline list, and nothing", () => {
    expect(frontMatterList("---\ngraph-typologies:\n  - a\n  - b\n---\n", "graph-typologies")).toEqual(["a", "b"]);
    expect(frontMatterList("---\ngraph-typologies: [a, b]\n---\n", "graph-typologies")).toEqual(["a", "b"]);
    expect(frontMatterList("# no front matter\ngraph-typologies: [a]\n", "graph-typologies")).toEqual([]);
  });

  test("skills are read from skills/ directories, never from a published docs copy", () => {
    const root = repo(files);
    expect(skillGovernance(root, Object.keys(files)).map((s) => s.skill).sort()).toEqual([
      "ig-build", "skills-and-tools", "todo-manager",
    ]);
  });
});

describe("who governs a directory", () => {
  const root = repo(files);
  const skills = skillGovernance(root, Object.keys(files));
  const platform = join(root, "platform");
  const domain = join(root, "domain");

  test("a kind claim governs every directory of that kind in reach", () => {
    expect(governingSkills({ instance: "platform", id: "beans", graphTypologies: ["beans"] }, skills, root, [platform])).toEqual(["todo-manager"]);
    expect(governingSkills({ instance: "domain", id: "work", graphTypologies: ["beans"] }, skills, root, [domain, platform])).toEqual(["todo-manager"]);
  });

  test("a kind claim does not reach an instance that does not depend on the skill's", () => {
    // `domain` depends on `platform`, not the other way round.
    expect(governingSkills({ instance: "platform", id: "x", graphTypologies: ["fhir-index"] }, skills, root, [platform])).toEqual([]);
  });

  test("governs: names ONE directory, instance-qualified — the same id elsewhere is not it", () => {
    expect(governingSkills({ instance: "domain", id: "tools", graphTypologies: ["tools"] }, skills, root, [domain, platform])).toEqual(["ig-build"]);
    expect(governingSkills({ instance: "platform", id: "tools", graphTypologies: ["tools"] }, skills, root, [platform])).toEqual(["skills-and-tools"]);
  });
});
