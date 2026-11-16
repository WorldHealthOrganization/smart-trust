/**
 * The topic level of a skills directory (bean `9umr`, owner ruling 2026-09-30:
 * a topic directory holds packages, and `skills.json` says which are topics).
 *
 * @module scripts/tests/skill-topics.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { packageDirsIn, topicsOf, TOPICS_FILE } from "../skill-topics.ts";

function tree(topics?: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "skill-topics-"));
  for (const d of ["crdm", "kg/graph-management", "kg/kg-core", "memory"]) mkdirSync(join(root, d), { recursive: true });
  if (topics !== undefined) writeFileSync(join(root, TOPICS_FILE), JSON.stringify({ $schema: "skill-topics/v1", ...(topics as object) }));
  return root;
}
const KG = { id: "kg", path: "kg", title: "Knowledge graph", description: "Structure, management and use." };

describe("packageDirsIn", () => {
  test("with no skills.json every direct subdirectory is a candidate, and nothing is descended into", () => {
    expect(packageDirsIn(tree()).map((p) => p.rel)).toEqual(["crdm", "kg", "memory"]);
  });

  test("a declared topic is replaced by its subdirectories, which keep their own names", () => {
    const got = packageDirsIn(tree({ topics: [KG] }));
    expect(got.map((p) => p.rel)).toEqual(["crdm", "kg/graph-management", "kg/kg-core", "memory"]);
    const gm = got.find((p) => p.rel === "kg/graph-management")!;
    expect(gm.name).toBe("graph-management");
    expect(gm.topic).toBe("kg");
  });

  test("an absent skills directory has no packages", () => {
    expect(packageDirsIn(join(tmpdir(), "no-such-skills-dir-9umr"))).toEqual([]);
  });
});

describe("topicsOf refuses what it cannot verify", () => {
  test("malformed JSON throws", () => {
    const root = tree();
    writeFileSync(join(root, TOPICS_FILE), "{ not json");
    expect(() => topicsOf(root)).toThrow(/not valid JSON/);
  });
  test("a file that is not the skill-topics/v1 family throws", () => {
    const root = tree();
    writeFileSync(join(root, TOPICS_FILE), JSON.stringify({ topics: [KG] }));
    expect(() => topicsOf(root)).toThrow(/\$schema/);
  });
  test("a topic missing a field throws", () => {
    expect(() => topicsOf(tree({ topics: [{ id: "kg", path: "kg", title: "K" }] }))).toThrow(/description/);
  });
  test("a declared topic that does not exist throws — declare only what exists", () => {
    expect(() => topicsOf(tree({ topics: [{ ...KG, id: "lib", path: "library" }] }))).toThrow(/does not exist/);
  });
  test("a path that is not one plain segment throws", () => {
    expect(() => topicsOf(tree({ topics: [{ ...KG, path: "kg/deeper" }] }))).toThrow(/one plain segment/);
  });
});
