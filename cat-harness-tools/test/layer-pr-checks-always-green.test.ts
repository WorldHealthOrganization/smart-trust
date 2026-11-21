/**
 * `compare-gates.py`'s always-green gates (owner, 2026-11-13: "ALWAYS need
 * json(ld) up to date - gate gate"): red on head fails the PR even
 * when main is red too; not applicable (78) is still never counted.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DIR = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks");

function compare(name: string, base: number | undefined, head: number): { status: number | null; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "always-green-"));
  const side = (exit: number) => ({ [name]: { command: "x", exit, tail: "tail" } });
  writeFileSync(join(dir, "base.json"), JSON.stringify(base === undefined ? {} : side(base)));
  writeFileSync(join(dir, "head.json"), JSON.stringify(side(head)));
  const r = spawnSync("python3", ["-I", "-B", join(DIR, "compare-gates.py"), join(dir, "base.json"), join(dir, "head.json")], {
    encoding: "utf-8",
    env: { ...process.env, GITHUB_STEP_SUMMARY: "" },
  });
  return { status: r.status, out: r.stdout };
}

describe("always-green gates", () => {
  test.each(["cat-harness-tools:gen:jsonld:check", "check:kg-blocks"])("%s: red on both sides still fails the PR", (g) => {
    const r = compare(g, 1, 1);
    expect(r.status).toBe(1);
    expect(r.out).toContain("always-green");
  });
  test("could not determine (2) on head fails too", () => {
    expect(compare("x:gen:jsonld:check", 1, 2).status).toBe(1);
  });
  test("not applicable (78) is never counted", () => {
    expect(compare("x:gen:jsonld:check", 1, 78).status).toBe(0);
  });
  test("green passes", () => {
    expect(compare("x:gen:jsonld:check", 1, 0).status).toBe(0);
  });
  test("the diagram SVGs are not always-green: a QA report (owner, 2026-11-13)", () => {
    expect(compare("x:render:bpmn:check", 1, 1).status).toBe(0);
  });
  test("an ordinary gate red on both sides is still main's to fix", () => {
    const r = compare("x:bpmn:checklist:check", 1, 1);
    expect(r.status).toBe(0);
    expect(r.out).toContain("failing on main too");
  });
});
