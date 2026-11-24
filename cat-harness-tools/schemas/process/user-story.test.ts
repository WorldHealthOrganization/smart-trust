import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { danglingStoryRoles, readUserStories, UserStorySchema } from "./user-story";
import type { RoleGraph } from "./role-graph";

function withStories(body: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "stories-"));
  writeFileSync(join(dir, "stories.json"), JSON.stringify(body));
  return dir;
}

const GRAPH: RoleGraph = {
  name: "t",
  roles: [{ id: "author", title: "Author", description: "d", actorKinds: ["person"], skills: [] }],
};

describe("user stories point at their role (#1168)", () => {
  test("absent file is undefined, not an empty pass", () => {
    const dir = mkdtempSync(join(tmpdir(), "stories-"));
    expect(readUserStories(dir)).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a story names its role; `_` keys are documentation", () => {
    const dir = withStories({ _comment: "x", name: "t", stories: [{ id: "author-1", role: { role: "author" }, want: "edit one block" }] });
    const g = readUserStories(dir)!;
    expect(g.stories[0]!.role.role).toBe("author");
    expect(danglingStoryRoles(g, GRAPH)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a story told as an undeclared role dangles; one in another instance is not judged here", () => {
    const dir = withStories({
      name: "t",
      stories: [
        { id: "ghost-1", role: { role: "ghost" }, want: "w" },
        { id: "elsewhere-1", role: { instance: "someone/other", role: "ghost" }, want: "w" },
      ],
    });
    expect(danglingStoryRoles(readUserStories(dir)!, GRAPH).map((s) => s.id)).toEqual(["ghost-1"]);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a duplicate id throws, and an unknown key is refused", () => {
    const dup = withStories({ name: "t", stories: [1, 2].map(() => ({ id: "a", role: { role: "author" }, want: "w" })) });
    expect(() => readUserStories(dup)).toThrow(/declared twice/);
    rmSync(dup, { recursive: true, force: true });
    expect(UserStorySchema.safeParse({ id: "a", role: { role: "author" }, want: "w", actor: "x" }).success).toBe(false);
  });
});
