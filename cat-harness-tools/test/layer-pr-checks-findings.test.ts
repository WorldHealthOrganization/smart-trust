/**
 * A gate already red on main still fails the PR that adds a finding to it.
 *
 * `run-gates.py` records each gate's `✗` findings as `diagnostics`, and
 * `compare-gates.py` fails a PR whose side holds one more often than main's.
 * Without them, folio-assistant main stayed red on `libraries:check`,
 * `bpmn:checklist:check`, `render:bpmn:check` and `kind:json-schemas:check`
 * while layer PRs added stale files to each (2026-11-04).
 *
 * @module test/layer-pr-checks-findings.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DIR = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks");

function findings(text: string): string[] {
  const code = [
    "import importlib.util, json, sys",
    `spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(join(DIR, "run-gates.py"))})`,
    "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
    "print(json.dumps(m.findings(sys.stdin.read())))",
  ].join("\n");
  const r = spawnSync("python3", ["-I", "-B", "-c", code], { input: text, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

const LIBRARIES = (files: string[]): string =>
  [`some progress`, ``, `✗ ${files.length} finding(s):`, ...files.map((f) => `    ${f}: stale — \`libraries:derive\` would rewrite it`), ``, `done`].join("\n");

function compare(base: string, head: string): number {
  const dir = mkdtempSync(join(tmpdir(), "findings-"));
  const side = (text: string) => ({ "libraries:check": { command: "x", exit: 1, tail: "", diagnostics: findings(text) } });
  writeFileSync(join(dir, "base.json"), JSON.stringify(side(base)));
  writeFileSync(join(dir, "head.json"), JSON.stringify(side(head)));
  const r = spawnSync("python3", ["-I", "-B", join(DIR, "compare-gates.py"), join(dir, "base.json"), join(dir, "head.json")], {
    encoding: "utf-8",
    // input-site: env PATH #34b0985f — PATH handed to a child process, which decides which binaries it runs
    env: { PATH: process.env.PATH ?? "" },
  });
  return r.status ?? -1;
}

describe("run-gates.py findings", () => {
  test("reads ✗ lines and the items under a ✗ count header, not the count", () => {
    const text = [LIBRARIES(["a/zod.library.json"]), "  ✗ schemas/kinds/x.schema.json is stale", "✗ 1 kind finding(s) — run it", "✓ fine"].join("\n");
    expect(findings(text)).toEqual(["a/zod.library.json: stale — `libraries:derive` would rewrite it", "schemas/kinds/x.schema.json is stale"]);
  });

  test("reads a number as #, so a count that only went down is not new", () => {
    expect(findings("✗ p.ts: 3 contract(s)")).toEqual(["p.ts: # contract(s)"]);
  });
});

describe("compare-gates.py over a gate red on both sides", () => {
  test("a PR that adds a stale file fails", () => {
    expect(compare(LIBRARIES(["a.json"]), LIBRARIES(["a.json", "b.json"]))).toBe(1);
  });

  test("a PR that leaves the findings as they were, or removes one, passes", () => {
    expect(compare(LIBRARIES(["a.json", "b.json"]), LIBRARIES(["a.json", "b.json"]))).toBe(0);
    expect(compare(LIBRARIES(["a.json", "b.json"]), LIBRARIES(["b.json"]))).toBe(0);
  });
});

/** compare-gates.py's exit over one red gate whose sides name the pin that produced them. */
function compareProduced(base: { producer?: string; diagnostics: string[] }, head: { producer?: string; diagnostics: string[] }): number {
  const dir = mkdtempSync(join(tmpdir(), "compare-gates-producer-"));
  const side = (s: { producer?: string; diagnostics: string[] }) => ({ "cat-harness-tools:check:subgraph-coverage": { command: "x", exit: 1, tail: "", ...s } });
  writeFileSync(join(dir, "base.json"), JSON.stringify(side(base)));
  writeFileSync(join(dir, "head.json"), JSON.stringify(side(head)));
  const r = spawnSync("python3", ["-I", "-B", join(DIR, "compare-gates.py"), join(dir, "base.json"), join(dir, "head.json")], {
    encoding: "utf-8",
    // input-site: env PATH #34b0985f — PATH handed to a child process, which decides which binaries it runs
    env: { PATH: process.env.PATH ?? "" },
  });
  return r.status ?? -1;
}

describe("compare-gates.py when the gate's own code moved between main and the PR", () => {
  // A downstream re-pin of cat-harness-tools (2026-11-12) reworded every finding of
  // check:subgraph-coverage; none was new, and head had fewer than main.
  const old = (d: string) => `${d} / serialisations: no serialisations declared — every declared directory owes json`;
  const reworded = (d: string) => `${d} / serialisations: no serialisations declared — every directory of a node-graph kind owes json`;

  test("reworded findings, as many or fewer, pass", () => {
    expect(compareProduced({ producer: "aaa", diagnostics: ["a", "b", "c"].map(old) }, { producer: "bbb", diagnostics: ["a", "b"].map(reworded) })).toBe(0);
    expect(compareProduced({ producer: "aaa", diagnostics: ["a", "b"].map(old) }, { producer: "bbb", diagnostics: ["a", "b"].map(reworded) })).toBe(0);
  });

  test("more findings than main still fail", () => {
    expect(compareProduced({ producer: "aaa", diagnostics: ["a"].map(old) }, { producer: "bbb", diagnostics: ["a", "b"].map(reworded) })).toBe(1);
  });

  test("the same producer, or a side that names none, keeps the text match", () => {
    expect(compareProduced({ producer: "aaa", diagnostics: ["a", "b"].map(old) }, { producer: "aaa", diagnostics: ["a"].map(reworded) })).toBe(1);
    expect(compareProduced({ diagnostics: ["a", "b"].map(old) }, { producer: "bbb", diagnostics: ["a"].map(reworded) })).toBe(1);
  });
});

describe("gate_diagnostics.producer", () => {
  test("names the pin of the harness a gate is named for, from the root's lock; None for the root's own", () => {
    const root = mkdtempSync(join(tmpdir(), "producer-"));
    writeFileSync(join(root, "index.lock.json"), JSON.stringify({ mounts: [{ harness: "cat-harness-tools", ref: "d30c2f5f" }] }));
    const code = [
      "import importlib.util, json, sys",
      `sys.path.insert(0, ${JSON.stringify(DIR)})`,
      "import gate_diagnostics as g",
      `print(json.dumps([g.producer(${JSON.stringify(root)}, "cat-harness-tools:check:foreign-paths"), g.producer(${JSON.stringify(root)}, "site:check:x")]))`,
    ].join("\n");
    const r = spawnSync("python3", ["-I", "-B", "-c", code], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual(["d30c2f5f", null]);
  });
});
