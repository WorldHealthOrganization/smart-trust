/**
 * Main's own verdict judges only the gates a layer declares (owner,
 * 2026-10-31, "Layers declare their gates").
 *
 * A layer's root runs the gates of every layer below it, and many cannot
 * apply there: folio-assistant-sci#139 listed 72 red gates, nearly all
 * bootstrap-tools and cat-harness-tools ones. `main-verdict.py` reads the
 * caller's `.github/main-qa-gates.json` and lets only matching gates make
 * main red; the rest are reported, so the list grows. These drive the script
 * through python3, as the workflow does.
 *
 * @module test/layer-main-verdict.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks", "main-verdict.py");

const GATES = {
  "bootstrap-tools:book:check": { exit: 2 },
  "cat-harness-tools:glossary:check": { exit: 1 },
  "cat-harness-tools:typecheck": { exit: 0 },
  "folio-assistant-sci:check:x": { exit: 0 },
  "graph:folio-assistant-sci:kg-audit": { exit: 1 },
  "folio-assistant-sci:na": { exit: 78 },
  "folio-assistant-sci:skipped": { skipped: "not in the cone" },
};
const JUNIT = `<testsuites><testsuite name="a"><testcase name="ok"/></testsuite></testsuites>`;

function run(declared?: unknown): { verdict: string; failures: Record<string, unknown>; summary: string } {
  const d = mkdtempSync(join(tmpdir(), "main-verdict-"));
  writeFileSync(join(d, "gates.json"), JSON.stringify(GATES));
  writeFileSync(join(d, "junit.xml"), JUNIT);
  const decl = join(d, "main-qa-gates.json");
  if (declared !== undefined) writeFileSync(decl, typeof declared === "string" ? declared : JSON.stringify(declared));
  const out = join(d, "out"), sum = join(d, "summary");
  writeFileSync(out, ""); writeFileSync(sum, "");
  const r = spawnSync("python3", ["-I", "-B", SCRIPT, d, decl], {
    // input-site: env PATH #72f0f068 — PATH handed to a child process, which decides which binaries it runs
    encoding: "utf-8", env: { PATH: process.env.PATH ?? "", GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: sum },
  });
  if (r.status !== 0) throw new Error(r.stderr);
  const kv = Object.fromEntries(readFileSync(out, "utf-8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  return { verdict: kv.verdict, failures: JSON.parse(kv.failures), summary: readFileSync(sum, "utf-8") };
}

describe("main-verdict.py and the gates a layer declares", () => {
  test("no declaration: every gate that ran is judged, as before", () => {
    const r = run();
    expect(r.verdict).toBe("red");
    expect(r.failures.gate_count).toBe(3);
    expect(r.failures.declared).toBeUndefined();
  });

  test("only declared gates make main red; the rest are reported, not judged", () => {
    const r = run({ judged: ["folio-assistant-sci:*", "graph:folio-assistant-sci:*"] });
    expect(r.verdict).toBe("red");
    expect(r.failures.gates).toEqual([{ name: "graph:folio-assistant-sci:kg-audit", exit: 1 }]);
    expect(r.failures.not_judged_count).toBe(2);
    expect(r.failures.passing_undeclared_count).toBe(1);
    expect(r.summary).toContain("Not judged: red, but not declared (2)");
    expect(r.summary).toContain("- `cat-harness-tools:typecheck`");
  });

  test("green when every declared gate passes, whatever the undeclared ones do", () => {
    const r = run({ judged: ["folio-assistant-sci:*"] });
    expect(r.verdict).toBe("green");
    expect(r.failures.gate_count).toBe(0);
  });

  test("a declared pattern that matches no gate is reported", () => {
    expect(run({ judged: ["folio-assistant-sci:*", "nothing:*"] }).summary).toContain("- `nothing:*`");
  });

  test("a declaration that cannot be read is unknown, never green", () => {
    expect(run("{not json").verdict).toBe("unknown");
    expect(run({ judged: [] }).verdict).toBe("unknown");
  });
});
