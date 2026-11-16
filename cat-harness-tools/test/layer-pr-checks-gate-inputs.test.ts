/**
 * The layer PR-check gate runner gives a gate the input this run has, and
 * says why when it has none — it never runs one bare to read its usage error.
 *
 * smart-ra#65 (run 38640286019): `check:corpus-gate` run with no arguments
 * printed its usage and exited 2, `check:test-budgets` exited 2 with no junit
 * report, and `uml:overview:check` ended "/usr/bin/cat: 'qa:refresh': No such
 * file or directory" because the root declared no `cat` script. These drive
 * `.github/scripts/layer-pr-checks/` through python3, as the workflow does.
 *
 * @module test/layer-pr-checks-gate-inputs.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DIR = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks");

/** Load `<file>` from DIR as a module and print the JSON of `expr` over it (`m`). */
function py(file: string, expr: string): unknown {
  const code = [
    "import importlib.util, json, sys",
    `spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(join(DIR, file))})`,
    "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
    `print(json.dumps(${expr}))`,
  ].join("\n");
  const r = spawnSync("python3", ["-I", "-B", "-c", code], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

const junit = (cases: number): string => {
  const dir = mkdtempSync(join(tmpdir(), "gate-inputs-"));
  const path = join(dir, "junit.xml");
  const tc = Array.from({ length: cases }, (_, i) => `<testcase name="t${i}" file="a.test.ts" time="0.1"/>`).join("");
  writeFileSync(path, `<?xml version="1.0"?><testsuites tests="${cases}"><testsuite name="a.test.ts">${tc}</testsuite></testsuites>`);
  return path;
};

describe("run-gates.py gate inputs", () => {
  test("corpus-gate is given --since the PR's diff base", () => {
    const sha = "a".repeat(40);
    expect(py("run-gates.py", `m.gate_args("check:corpus-gate", {"GATE_DIFF_BASE": "${sha}"})`)).toEqual([["--since", sha], null]);
  });

  test("corpus-gate with no diff base is skipped with a reason, never run bare", () => {
    const [args, why] = py("run-gates.py", `m.gate_args("check:corpus-gate", {})`) as [unknown, string];
    expect(args).toBeNull();
    expect(why).toContain("--since");
  });

  test("translation:catalogue:check is given --base the PR's diff base, not a three-dot default", () => {
    const sha = "b".repeat(40);
    expect(py("run-gates.py", `m.gate_args("translation:catalogue:check", {"GATE_DIFF_BASE": "${sha}"})`)).toEqual([["--base", sha], null]);
    const [args, why] = py("run-gates.py", `m.gate_args("translation:catalogue:check", {})`) as [unknown, string];
    expect(args).toBeNull();
    expect(why).toContain("--base");
  });

  test("test-budgets is given the junit report the tests step wrote", () => {
    const path = junit(3);
    expect(py("run-gates.py", `m.gate_args("check:test-budgets", {"GATE_JUNIT": ${JSON.stringify(path)}})`)).toEqual([[path], null]);
  });

  test("test-budgets over a report of no cases, or none, is skipped with a reason", () => {
    const empty = junit(0);
    const [a1, w1] = py("run-gates.py", `m.gate_args("check:test-budgets", {"GATE_JUNIT": ${JSON.stringify(empty)}})`) as [unknown, string];
    expect(a1).toBeNull();
    expect(w1).toContain("no test cases");
    const [a2, w2] = py("run-gates.py", `m.gate_args("check:test-budgets", {"GATE_JUNIT": "/nonexistent/junit.xml"})`) as [unknown, string];
    expect(a2).toBeNull();
    expect(w2).toContain("absent");
  });

  test("a gate that takes no input runs as declared", () => {
    expect(py("run-gates.py", `m.gate_args("check:workflows", {})`)).toEqual([[], null]);
  });

  test("the supplied gates are no longer in the never-supplied list", () => {
    expect(py("run-gates.py", `sorted(set(m.SUPPLIED_INPUTS) & set(m.NEEDS_INPUT_SCRIPTS))`)).toEqual([]);
  });

  test("post-merge:regen:check is skipped as live-state so it does not run the gates inside the gates (bean lpcs)", () => {
    const [kind, why] = py("run-gates.py", `m.skip_reason(".", "post-merge:regen:check")`) as [string, string];
    expect(kind).toBe("live-state");
    expect(why).toContain("live state");
  });

  test("check:upstream-pins is skipped as live-state: an upstream release, not the diff, turns it red", () => {
    const [kind, why] = py("run-gates.py", `m.skip_reason(".", "check:upstream-pins")`) as [string, string];
    expect(kind).toBe("live-state");
    expect(why).toContain("live state");
  });

  test("ingest:ig-chrome:check is skipped as needs-input because it requires external --layer template checkouts (smart-base#239)", () => {
    const [kind, why] = py("run-gates.py", `m.skip_reason(".", "ingest:ig-chrome:check")`) as [string, string];
    expect(kind).toBe("needs-input");
    expect(why).toContain("--layer");
  });

  test("software:check judges the runner, not the checkout (folio-assistant-core#287)", () => {
    const [kind, why] = py("run-gates.py", `m.skip_reason(".", "software:check", {})`) as [string, string];
    expect(kind).toBe("runner-state");
    expect(why).toContain("machine");
  });

  test("the navbar --strict sweep is not a gate: its advisories are editorial calls (Q-FMR-12)", () => {
    const [kind, why] = py("run-gates.py", `m.skip_reason(".", "check:navbar-consistency:strict", {})`) as [string, string];
    expect(kind).toBe("sweep-only");
    expect(why).toContain("navbar-consistency:check");
    expect(py("run-gates.py", `m.skip_reason(".", "check:navbar-consistency:check", {})`)).toEqual([null, null]);
  });

  test("the diagram SVGs are a QA report, not a merge gate (owner, 2026-11-13); the KG's JSON-LD is gated", () => {
    const [kind, why] = py("run-gates.py", `m.skip_reason(".", "render:bpmn:check", {})`) as [string, string];
    expect(kind).toBe("qa-report");
    expect(why).toContain("QA report");
    expect(py("run-gates.py", `m.skip_reason(".", "gen:jsonld:check", {})`)).toEqual([null, null]);
  });

  test("the lock and default-branch gates are skipped in layer mode only (folio-assistant-core#287)", () => {
    for (const s of ["mount:lock:check", "mount:remote:check", "check:draft-beans", "readmes:check", "readme-sections:check", "book:check", "check:standalone"]) {
      const [kind] = py("run-gates.py", `m.skip_reason(".", ${JSON.stringify(s)}, {"MODE": "layer"})`) as [string, string];
      expect(kind).toBe("layer-mode");
      expect(py("run-gates.py", `m.skip_reason(".", ${JSON.stringify(s)}, {"MODE": "index"})`)).toEqual([null, null]);
    }
  });

  test("another layer's standalone rehearsal is skipped in any root but its own (smart-ra#213)", () => {
    const skip = (script: string, env: object, own: string[] | null) =>
      py("run-gates.py", `m.skip_reason(".", ${JSON.stringify(script)}, ${JSON.stringify(env)}, ${own === null ? "None" : JSON.stringify(own)})`);
    for (const mode of ["layer", "index"]) {
      const [kind, why] = skip("check:cat-harness-tools-standalone", { MODE: mode }, ["smart-ra"]) as [string, string];
      expect(kind).toBe("other-layer");
      expect(why).toContain("cat-harness-tools's own CI");
    }
    // The layer's own run and an index that holds it as its own still judge it, as does an unknown caller.
    expect(skip("check:cat-harness-tools-standalone", { MODE: "layer" }, ["cat-harness-tools"])).toEqual([null, null]);
    expect(skip("check:cat-harness-tools-standalone", { MODE: "index" }, ["cat-harness", "cat-harness-tools", "smart-base"])).toEqual([null, null]);
    expect(skip("check:cat-harness-tools-standalone", { MODE: "layer" }, null)).toEqual([null, null]);
  });

  test("the bare-usage gates are skipped as needs-input (folio-assistant-core#287)", () => {
    for (const s of ["check:qa-corpus", "check:session-staleness", "folio:shim:check", "publish:check"]) {
      const [kind] = py("run-gates.py", `m.skip_reason(".", ${JSON.stringify(s)}, {})`) as [string, string];
      expect(kind).toBe("needs-input");
    }
  });
});

describe("root-cat-script.py", () => {
  const root = (pkg: object | null, runner = "cat-harness-tools/scripts/run-script.ts"): string => {
    const dir = mkdtempSync(join(tmpdir(), "root-cat-"));
    if (pkg) writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
    if (runner) {
      mkdirSync(join(dir, runner, ".."), { recursive: true });
      writeFileSync(join(dir, runner), "");
    }
    return dir;
  };

  test("a root with no `cat` script gets one that runs the harness's runner", () => {
    const dir = root({ name: "smart-ra", scripts: { "check:archimate": "x" } });
    expect(py("root-cat-script.py", `m.ensure(${JSON.stringify(dir)})`)).toEqual(["added", "bun cat-harness-tools/scripts/run-script.ts"]);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
    expect(pkg.scripts).toEqual({ "check:archimate": "x", cat: "bun cat-harness-tools/scripts/run-script.ts" });
  });

  test("a root that declares `cat` keeps its own", () => {
    const dir = root({ scripts: { cat: "bun cat-harness/scripts/run-script.ts" } });
    expect(py("root-cat-script.py", `m.ensure(${JSON.stringify(dir)})`)).toEqual(["kept", "bun cat-harness/scripts/run-script.ts"]);
  });

  test("before bean 70lx the runner is cat-harness's", () => {
    const dir = root({}, "cat-harness/scripts/run-script.ts");
    expect(py("root-cat-script.py", `m.ensure(${JSON.stringify(dir)})`)).toEqual(["added", "bun cat-harness/scripts/run-script.ts"]);
  });

  test("no runner anywhere is reported, not papered over", () => {
    const dir = root({}, "");
    expect(py("root-cat-script.py", `m.ensure(${JSON.stringify(dir)})`)).toEqual(["missing", null]);
  });
});
