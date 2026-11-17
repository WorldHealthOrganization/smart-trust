/**
 * cat-harness reaches bootstrap-tools by PACKAGE NAME, never by climbing out of
 * its own directory — bean `pxtk`, the first layer of epic `f6gq` (separation
 * lesson 5: "All cross-repository imports MUST be authored as package
 * imports ... NEVER through escaping filesystem `../..` traversals").
 *
 * The name resolves through bun WORKSPACES to the one copy the checkout mounts,
 * pinned by its `index.lock.json`, so there is no second version to drift from
 * the mount: `bootstrap-tool[s]` matches it inside cat-harness's own repository
 * (mounted at its root) and `../bootstrap-tool[s]` beside it (the monorepo, a
 * downstream checkout such as who-iris). A bracket glob matches nothing rather
 * than failing when the mount is absent — bun refuses a literal workspace path
 * that does not exist, and an install may run before a mount.
 *
 * @module cat-harness/scripts/tests/package-imports
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
/**
 * The package that imports bootstrap-tools: this tools layer since bean `8lcl`
 * moved cat-harness's code here. cat-harness's own `package.json` declares
 * neither the dependency nor the workspaces any more, so reading it asked a
 * package with no such import whether it declared one.
 */
const CODE = resolve(TOOLS_ROOT);
const pkg = JSON.parse(readFileSync(join(CODE, "package.json"), "utf-8")) as {
  workspaces?: string[];
  dependencies?: Record<string, string>;
};

describe("bootstrap-tools by package name (pxtk)", () => {
  test("no tracked source imports bootstrap-tools by climbing out of the repository", () => {
    // Both repositories: the code is here, and the content repository must not
    // grow a climbing import either.
    for (const cwd of new Set([CODE, ROOT])) {
      const r = spawnSync("git", ["grep", "-nE", "(from|import)[ (]*['\"](\\.\\./)+bootstrap-tools/", "--", "*.ts", "*.js"], { cwd, encoding: "utf-8" });
      // git grep exits 1 when nothing matches — the state this test requires.
      expect(r.status === 1 ? "" : r.stdout, cwd).toBe("");
    }
  });

  test("the package is declared, and resolved by workspace both inside and beside", () => {
    expect(pkg.dependencies?.["@litlfred/bootstrap-tools"]).toBeDefined();
    expect(pkg.workspaces).toEqual(expect.arrayContaining(["bootstrap-tool[s]", "../bootstrap-tool[s]"]));
  });

  test("the name resolves to a bootstrap-tools beside or inside this checkout, not a downloaded copy", () => {
    const at = Bun.resolveSync("@litlfred/bootstrap-tools/schemas/graph.ts", CODE);
    expect(at.includes("/node_modules/") && !at.includes("/bootstrap-tools/schemas/")).toBe(false);
    expect(at.endsWith("/bootstrap-tools/schemas/graph.ts")).toBe(true);
  });
});
