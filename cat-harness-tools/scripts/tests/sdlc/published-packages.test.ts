/**
 * `publishablePackages()` discovers BOTH halves of what this repository ships.
 *
 * The gate it backs exists because `@litlfred/block-qa-schema` shipped to npm
 * for months with nothing building it (bean `rsi6`, PR #914 — ten green checks,
 * none of which read the file it changed). Closing that left the package's
 * SECOND half — `python/block_qa_schema/` and an 18-test pytest suite — still
 * reachable by nothing at all (bean `1s5s`).
 *
 * The discovery is the part worth testing, because every way it can be wrong
 * is a way the gate goes green over an unexamined package:
 *
 *   - miss a manifest → that package is never built, silently;
 *   - walk the filesystem instead of the index → thousands of third-party
 *     packages under `node_modules/` and `.venv/` are reported as this
 *     repository's own (the `ramz` rule);
 *   - collapse a directory's two halves into one entry → the npm half passing
 *     would vouch for the Python half, which is precisely the state `1s5s`
 *     names;
 *   - guess a test runner rather than read the package's declaration → a
 *     package that declares none gets a verdict nobody computed.
 *
 * Fixtures are real git repositories in a temp dir, because the function's
 * contract is "what git accounts for" and a mocked `git ls-files` would test
 * the mock. Each one is initialised, populated and `git add`ed; the untracked
 * case is deliberately NOT added, which is the only way to check the index is
 * doing the work rather than the filesystem.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GitUnanswerable, publishablePackages } from "../../check-published-packages.js";

/** A throwaway git repo holding `files`; every path is staged unless untracked. */
function fixture(files: Record<string, string>, untracked: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "pubpkg-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  const write = (rel: string, body: string): void => {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body, "utf-8");
  };
  for (const [rel, body] of Object.entries(files)) write(rel, body);
  for (const [rel, body] of Object.entries(untracked)) write(rel, body);
  spawnSync("git", ["add", "--", ...Object.keys(files)], { cwd: root });
  return root;
}

const NPM = JSON.stringify({
  name: "@scope/thing",
  scripts: { build: "tsup", test: "vitest run" },
});

const PYPROJECT = [
  "[project]",
  'name = "thing"',
  'version = "0.1.0"',
  "",
  "[project.optional-dependencies]",
  'test = ["pytest>=7"]',
  "",
  "[tool.pytest.ini_options]",
  'pythonpath = ["python"]',
].join("\n");

describe("publishablePackages — what this repository ships, in both ecosystems", () => {
  test("the fixture mechanism really produces packages", () => {
    // Non-vacuity. Every assertion below is of the form "X is/is not in the
    // result"; if the fixture silently produced nothing they would all pass
    // for the wrong reason, which is the failure this whole gate is about.
    expect(publishablePackages(fixture({ "pkg/package.json": NPM })).length).toBeGreaterThan(0);
  });

  test("an npm half is found, with its declared build and test steps", () => {
    const [pkg, ...rest] = publishablePackages(fixture({ "pkg/package.json": NPM }));
    expect(rest).toEqual([]);
    expect(pkg).toMatchObject({
      dir: "pkg",
      name: "@scope/thing",
      ecosystem: "npm",
      build: "tsup",
      test: "vitest run",
    });
  });

  test("a PyPI half is found, and declares pytest by carrying its config table", () => {
    const [pkg] = publishablePackages(fixture({ "pkg/pyproject.toml": PYPROJECT }));
    expect(pkg).toMatchObject({ dir: "pkg", name: "thing", ecosystem: "pypi", test: "pytest" });
  });

  test("a pyproject with no pytest table declares no test step — it is not guessed", () => {
    const bare = '[project]\nname = "thing"\nversion = "0.1.0"\n';
    const [pkg] = publishablePackages(fixture({ "pkg/pyproject.toml": bare }));
    expect(pkg.ecosystem).toBe("pypi");
    expect(pkg.test).toBeUndefined();
  });

  test("ONE directory shipping to both registries is TWO entries, not one", () => {
    // The `1s5s` finding in miniature: the halves fail independently, so a
    // single verdict would let the npm half vouch for the Python one.
    const found = publishablePackages(
      fixture({ "pkg/package.json": NPM, "pkg/pyproject.toml": PYPROJECT }),
    );
    expect(found).toHaveLength(2);
    expect(found.map((p) => p.ecosystem).sort()).toEqual(["npm", "pypi"]);
    expect(new Set(found.map((p) => p.dir))).toEqual(new Set(["pkg"]));
  });

  test("the repository's own root package.json is not a published package", () => {
    const found = publishablePackages(fixture({ "package.json": NPM, "pkg/package.json": NPM }));
    expect(found.map((p) => p.dir)).toEqual(["pkg"]);
  });

  test("`private: true` is excluded", () => {
    const priv = JSON.stringify({ name: "@scope/internal", private: true, scripts: {} });
    const found = publishablePackages(fixture({ "a/package.json": priv, "b/package.json": NPM }));
    expect(found.map((p) => p.dir)).toEqual(["b"]);
  });

  test("a `Private ::` classifier excludes a pyproject — PEP 621 has no `private` flag", () => {
    const priv = [
      "[project]",
      'name = "internal"',
      'version = "0.1.0"',
      'classifiers = ["Private :: Do Not Upload"]',
    ].join("\n");
    const found = publishablePackages(fixture({ "a/pyproject.toml": priv, "b/pyproject.toml": PYPROJECT }));
    expect(found.map((p) => p.dir)).toEqual(["b"]);
  });

  test("a manifest on disk but NOT in the index is invisible — the `ramz` rule", () => {
    // The one assertion that distinguishes reading the index from walking the
    // tree. Walking would find `node_modules/dep/package.json` and report a
    // third-party package as this repository's own.
    const found = publishablePackages(
      fixture(
        { "pkg/package.json": NPM },
        {
          "node_modules/dep/package.json": JSON.stringify({ name: "dep", scripts: {} }),
          "vendored/.venv/lib/pyproject.toml": PYPROJECT,
        },
      ),
    );
    expect(found.map((p) => p.dir)).toEqual(["pkg"]);
  });

  test("an unparseable manifest is skipped rather than crashing the sweep", () => {
    const found = publishablePackages(
      fixture({ "bad/package.json": "{not json", "bad2/pyproject.toml": "[[[", "ok/package.json": NPM }),
    );
    expect(found.map((p) => p.dir)).toEqual(["ok"]);
  });

  test("a manifest with no name is not a package", () => {
    const anon = JSON.stringify({ scripts: { build: "tsup" } });
    const found = publishablePackages(fixture({ "a/package.json": anon, "b/package.json": NPM }));
    expect(found.map((p) => p.dir)).toEqual(["b"]);
  });

  test("this repository's own corpus — the real block-qa-schema has both halves", () => {
    // The fixtures above prove the function; this proves it is pointed at
    // something. A discovery that works perfectly on temp dirs and finds
    // nothing here is the vacuity the gate's own empty-set check guards.
    const found = publishablePackages();
    expect(found.length).toBeGreaterThan(0);
    const qa = found.filter((p) => p.dir.endsWith("schemas/block-qa-schema"));
    expect(qa.map((p) => p.ecosystem).sort()).toEqual(["npm", "pypi"]);
  });
});

/*
 * An unanswerable git is not an empty repository. Bean `bnuy`.
 *
 * `manifests()` returned `[]` when `git ls-files` failed, until 2026-09-30.
 * The entry point's vacuity guard does not catch that, and the reason is the
 * interesting half: discovery asks git once PER ECOSYSTEM and concatenates,
 * so a failure on `*pyproject.toml` alone deletes the Python packages while
 * the npm ones still answer — `pkgs.length` is not 0, the guard is satisfied,
 * and the gate reports green over a corpus with a hole in it. That is the
 * exact shape this file's header was written about (`1s5s`: the npm half
 * passing vouching for a Python half nothing ran).
 *
 * A directory that is not a git repository at all is the reachable stand-in
 * for "git could not answer" — `git ls-files` exits 128 there. Whether the
 * cause is a missing repository, a broken git or ENOBUFS does not change what
 * the caller may conclude, which is nothing.
 */
describe("git could not answer — bean `bnuy`", () => {
  test("a directory that is not a repository REFUSES rather than reporting no packages", () => {
    const bare = mkdtempSync(join(tmpdir(), "pubpkg-nogit-"));
    // A real, publishable manifest sits here, so an empty answer would be
    // wrong on the merits too and not merely uninformative.
    writeFileSync(join(bare, "package.json"), JSON.stringify({ name: "@x/y", scripts: { build: "true" } }));

    expect(() => publishablePackages(bare)).toThrow(GitUnanswerable);
  });

  test("the refusal names the pathspec and says nothing was checked", () => {
    const bare = mkdtempSync(join(tmpdir(), "pubpkg-nogit-"));
    try {
      publishablePackages(bare);
      throw new Error("expected a refusal");
    } catch (e) {
      expect(e).toBeInstanceOf(GitUnanswerable);
      const g = e as GitUnanswerable;
      expect(g.pathspec).toBe("*package.json");
      expect(g.message).toContain("nothing was checked");
      // The reason git gave, not a generic sentence: a reader must be able to
      // tell ENOBUFS from "not a repository" without re-running it.
      expect(g.why.length).toBeGreaterThan(0);
    }
  });

  test("a repository that genuinely publishes nothing still answers []", () => {
    const repo = mkdtempSync(join(tmpdir(), "pubpkg-empty-"));
    spawnSync("git", ["init", "-q"], { cwd: repo });
    writeFileSync(join(repo, "README.md"), "no packages here");
    spawnSync("git", ["add", "-A"], { cwd: repo });

    // The distinction the throw exists to preserve: this is a determined
    // empty and must NOT refuse.
    expect(publishablePackages(repo)).toEqual([]);
  });
});
