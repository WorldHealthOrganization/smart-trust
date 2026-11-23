/**
 * A layer that uses a kind ANOTHER planned layer declares is readable at a
 * pin once the planner folds that layer's kinds in first ({@link withKindsOf}),
 * whatever order the two are listed in (2026-11-15: a downstream's standing
 * re-pin refused a layer whose declaration names a kind only a layer it
 * depends on registers, because the using layer comes first in the lock).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RemoteTree } from "../remote-tree.ts";
import { upstreamDirectories, withKindsOf } from "../upstream-directories.ts";

const dirs: string[] = [];
function repoWith(files: Record<string, unknown>): { repo: string; sha: string } {
  const repo = mkdtempSync(join(tmpdir(), "dep-kinds-"));
  dirs.push(repo);
  for (const [p, v] of Object.entries(files)) {
    mkdirSync(join(repo, p, ".."), { recursive: true });
    writeFileSync(join(repo, p), typeof v === "string" ? v : JSON.stringify(v, null, 2));
  }
  const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, encoding: "utf-8" }).trim();
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "fixture");
  return { repo, sha: git("rev-parse", "HEAD") };
}

// `dep` contributes the kind; `user` only uses it.
const dep = repoWith({
  "dep.json": {
    $schema: "cat-harness-declaration/1.0.0",
    version: "0.1.0",
    name: "dep",
    directories: [{ id: "dep-typologies", path: "typologies/", description: "dep's kinds", graphTypologies: ["typologies"] }],
  },
  "typologies/dep-kind.json": {
    $schema: "folio-graph-typology/v1",
    kind: "dep-contributed-kind",
    title: "dep kind",
    renderable: false,
    holds: "derived",
    summary: "A kind only dep declares.",
    validatorNotApplicable: "A fixture.",
  },
});
const user = repoWith({
  "user.json": {
    $schema: "cat-harness-declaration/1.0.0",
    version: "0.1.0",
    name: "user",
    directories: [{ id: "user-things", path: "things/", description: "uses dep's kind", graphTypologies: ["dep-contributed-kind"] }],
  },
  "things/.keep": "",
});

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("upstreamDirectories: a kind another planned layer contributes", () => {
  test("is refused without that layer's kinds, and read with them", () => {
    const depTree = RemoteTree.open("fixture/dep", dep.sha, { urlFor: () => dep.repo });
    const userTree = RemoteTree.open("fixture/user", user.sha, { urlFor: () => user.repo });
    try {
      const without = upstreamDirectories(userTree, "", "user.json");
      expect(without.ok).toBe(false);
      if (!without.ok) expect(without.detail).toContain("dep-contributed-kind");

      const kinds = withKindsOf(depTree, "", "dep.json");
      const r = upstreamDirectories(userTree, "", "user.json", kinds);
      if (!r.ok) throw new Error(r.detail);
      expect(r.directories.map((d) => d.id)).toContain("user-things");
    } finally {
      depTree.close();
      userTree.close();
    }
  });
});
