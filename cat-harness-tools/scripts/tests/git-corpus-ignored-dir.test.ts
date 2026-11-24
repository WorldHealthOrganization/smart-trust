/**
 * `gitCorpus` over a directory git ignores AS A WHOLE — the working copy of a
 * graph whose record is kept on a branch (the `qa` results since bean `5hox`).
 * Bean `72a8`: asked of git it listed nothing, and every per-directory reader
 * reported 1,285 computed files as an empty graph.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { gitCorpus } from "../../schemas/sdlc/git-corpus.ts";

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "git-corpus-ignored-"));
  spawnSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, ".gitignore"), "results/\n");
  mkdirSync(join(dir, "results", "kg-qa", "node_modules"), { recursive: true });
  mkdirSync(join(dir, "results", ".hidden"), { recursive: true });
  writeFileSync(join(dir, "results", "a.qa.json"), "{}");
  writeFileSync(join(dir, "results", "kg-qa", "b.kg-qa.json"), "{}");
  writeFileSync(join(dir, "results", "kg-qa", "notes.md"), "x");
  writeFileSync(join(dir, "results", "kg-qa", "node_modules", "dep.json"), "{}");
  writeFileSync(join(dir, "results", ".hidden", "c.json"), "{}");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "kept.json"), "{}");
  writeFileSync(join(dir, "src", "ignored.log"), "x");
  return dir;
}

describe("gitCorpus over a directory git ignores wholesale (bean 72a8)", () => {
  test("its files are read from the disk, not reported as none", () => {
    const dir = repo();
    const got = gitCorpus(join(dir, "results"), ["*.json"])!.map((p) => p.slice(dir.length + 1)).sort();
    expect(got).toEqual(["results/a.qa.json", "results/kg-qa/b.kg-qa.json"]);
  });

  test("with no pathspec every file is listed — still never a dependency tree or a dot-directory", () => {
    const dir = repo();
    const got = gitCorpus(join(dir, "results"))!.map((p) => p.slice(dir.length + 1)).sort();
    expect(got).toEqual(["results/a.qa.json", "results/kg-qa/b.kg-qa.json", "results/kg-qa/notes.md"]);
  });

  test("a directory that is NOT ignored is still asked of git, untracked-not-ignored included", () => {
    const dir = repo();
    const got = gitCorpus(join(dir, "src"))!.map((p) => p.slice(dir.length + 1)).sort();
    expect(got).toEqual(["src/ignored.log", "src/kept.json"]);
  });
});
