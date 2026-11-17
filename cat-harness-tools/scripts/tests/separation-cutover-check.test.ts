/**
 * separation:cutover:check — a separated repository's cutover from the
 * monorepo is COMPLETE only when every condition is measured and passes.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONDITIONS, cutoverExitCode, monorepoPathFindings, ownInstances, type CutoverReport } from "../separation-cutover-check.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe("monorepoPathFindings — wiring that still names the monorepo", () => {
  const scan = (path: string, text: string) => monorepoPathFindings([{ path, text }]);

  test("a path into the old checkout, in code and config", () => {
    expect(scan("scripts/x.ts", 'const p = "folio-assistant/cat-harness/schemas/x.ts";')).toHaveLength(1);
    expect(scan("tsconfig.json", '{"paths": {"s/*": ["../../folio-assistant/schemas/*"]}}')).toHaveLength(1);
    expect(scan("package.json", '{"scripts": {"x": "bun run folio-assistant/cat-harness-tools/scripts/x.ts"}}')).toHaveLength(1);
  });
  test("a reusable workflow called from the monorepo (lessons 16-17)", () => {
    expect(scan(".github/workflows/ci.yml", "    uses: litlfred/folio-assistant/.github/workflows/folio-staging.yml@main")).toHaveLength(1);
  });
  test("livesAt still naming the monorepo (lesson 15)", () => {
    const f = scan("who-iris.json", JSON.stringify({ name: "who-iris", livesAt: { repository: "litlfred/folio-assistant", path: "who-iris" } }));
    expect(f.join("\n")).toContain("livesAt");
  });
  test("a submodule of the monorepo", () => {
    expect(scan(".gitmodules", '[submodule "folio-assistant"]\n\tpath = folio-assistant\n\turl = https://github.com/litlfred/folio-assistant.git\n')).toHaveLength(1);
  });
  test("NOT: the repository named in prose, a sibling layer, a comment, a record, a link", () => {
    expect(scan("scripts/x.ts", 'const url = "https://github.com/litlfred/folio-assistant/issues/2183";')).toEqual([]);
    expect(scan("scripts/x.ts", 'import x from "../folio-assistant-core/schemas/x.ts";')).toEqual([]);
    expect(scan("scripts/x.sh", "# the folio-assistant/ submodule is gone")).toEqual([]);
    expect(scan("beans/defs/x.json", '{"p": "folio-assistant/cat-harness/x"}')).toEqual([]);
    expect(scan("README.md", "see folio-assistant/cat-harness/README.md")).toEqual([]);
  });
});

describe("the verdict", () => {
  const report = (states: Array<CutoverReport["conditions"][number]["state"]>): CutoverReport => ({
    root: "/x",
    instance: "x",
    own: ["x"],
    conditions: CONDITIONS.map((id, i) => ({ id, state: states[i] ?? "pass", by: "t", summary: "", findings: [] })),
  });
  test("complete only when every condition was measured and passed", () => {
    expect(cutoverExitCode(report(["pass", "pass", "pass", "pass", "pass", "pass"]))).toBe(0);
  });
  test("a site not built is NOT complete: exit 2, never 0", () => {
    expect(cutoverExitCode(report(["pass", "pass", "pass", "pass", "pass", "not-run"]))).toBe(2);
  });
  test("a site not applicable to an instance root does not block complete (Q-NA-1 B, #1701)", () => {
    expect(cutoverExitCode(report(["pass", "pass", "pass", "pass", "pass", "not-applicable"]))).toBe(0);
    expect(cutoverExitCode(report(["pass", "fail", "pass", "pass", "pass", "not-applicable"]))).toBe(1);
    expect(cutoverExitCode(report(["could-not-determine", "pass", "pass", "pass", "pass", "not-applicable"]))).toBe(2);
  });
  test("a failure wins over anything undetermined", () => {
    expect(cutoverExitCode(report(["could-not-determine", "fail", "pass", "pass", "pass", "not-run"]))).toBe(1);
  });
});

describe("ownInstances — what the repository tracks, as opposed to what it mounts", () => {
  test("a mounted (untracked) layer is not the repository's own", () => {
    const root = mkdtempSync(join(tmpdir(), "cutover-own-"));
    made.push(root);
    const decl = (name: string) => JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name, version: "0.1.0", needs: [] });
    writeFileSync(join(root, "downstream.json"), decl("downstream"));
    mkdirSync(join(root, "layer"));
    writeFileSync(join(root, "layer", "layer.json"), decl("layer"));
    mkdirSync(join(root, "tracked"));
    writeFileSync(join(root, "tracked", "tracked.json"), decl("tracked"));
    writeFileSync(join(root, ".gitignore"), "layer/\n");
    spawnSync("git", ["init", "-q"], { cwd: root });
    spawnSync("git", ["add", "-A"], { cwd: root });
    expect(ownInstances(root).sort()).toEqual(["downstream", "tracked"]);
  });
});
