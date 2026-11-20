/**
 * The index's own gates, run over the composed root with a layer PR swapped
 * in, are judged error by error (owner, 2026-10-23, item 2).
 *
 * cat-harness-tools#385 passed every check of its own and failed the index's
 * lint once pinned (`'m' is defined but never used` in
 * scripts/lib/scheme-css.ts). `run-root-gates.py` runs the gates
 * `root-gates.json` names and records the errors each printed;
 * `compare-gates.py` fails the PR on an error main does not have, even when
 * the gate is already red on main. These drive the scripts through python3,
 * as the workflows do.
 *
 * @module test/layer-pr-checks-root-gates.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

const ESLINT = [
  "",
  "/r/fa/cat-harness-tools/scripts/lib/scheme-css.ts",
  "  90:39  error  'm' is defined but never used. Allowed unused args must match /^_/u  @typescript-eslint/no-unused-vars",
  "",
  "/r/fa/cat-harness/schemas/safe-url.ts",
  "  120:3  warning  Unused eslint-disable directive (no problems were reported from 'no-control-regex')",
  "  4:1  error  Parsing error: ';' expected",
  "",
  "✖ 3 problems (2 errors, 1 warning)",
].join("\n");

const TSC = [
  "── tsc --noEmit -p cat-harness-tools/tsconfig.json",
  "cat-harness-tools/pipeline/validate.ts(12,3): error TS2307: Cannot find module 'x'.",
  "error TS5083: Cannot read file 'tsconfig.base.json'.",
].join("\n");

describe("run-root-gates.py diagnostics", () => {
  test("ESLint's errors, relative to the root, with no line numbers; warnings are not errors", () => {
    expect(py("run-root-gates.py", `m.diagnostics(${JSON.stringify(ESLINT)}, "/r/fa")`)).toEqual([
      "cat-harness-tools/scripts/lib/scheme-css.ts: @typescript-eslint/no-unused-vars: 'm' is defined but never used. Allowed unused args must match /^_/u",
      "cat-harness/schemas/safe-url.ts: parse: Parsing error: ';' expected",
    ]);
  });

  test("tsc's errors, with and without a file", () => {
    expect(py("run-root-gates.py", `m.diagnostics(${JSON.stringify(TSC)}, "/r/fa")`)).toEqual([
      "cat-harness-tools/pipeline/validate.ts: TS2307: Cannot find module 'x'.",
      "-: TS5083: Cannot read file 'tsconfig.base.json'.",
    ]);
  });

  test("no gate list is could-not-determine, never an empty pass", () => {
    const dir = mkdtempSync(join(tmpdir(), "root-gates-"));
    writeFileSync(join(dir, "gates.json"), JSON.stringify({ gates: {} }));
    const r = spawnSync("python3", ["-I", "-B", join(DIR, "run-root-gates.py"), dir, join(dir, "gates.json"), join(dir, "out.json")], { encoding: "utf-8" });
    expect(r.status).toBe(2);
  });

  test("root-gates.json names only scripts this layer declares", () => {
    const gates = JSON.parse(readFileSync(join(DIR, "root-gates.json"), "utf-8")).gates as Record<string, string>;
    const pkg = JSON.parse(readFileSync(resolve(import.meta.dir, "..", "package.json"), "utf-8"));
    const declared = { ...pkg.scripts, ...pkg.checkoutScripts };
    expect(Object.keys(gates).length).toBeGreaterThan(0);
    for (const script of Object.values(gates)) expect(declared).toHaveProperty([script]);
  });
});

describe("compare-gates.py with diagnostics", () => {
  const compare = (base: unknown, head: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), "compare-root-"));
    writeFileSync(join(dir, "base.json"), JSON.stringify(base));
    writeFileSync(join(dir, "head.json"), JSON.stringify(head));
    return spawnSync("python3", ["-I", "-B", join(DIR, "compare-gates.py"), join(dir, "base.json"), join(dir, "head.json")], {
      encoding: "utf-8",
      // input-site: env PATH #34b0985f — PATH handed to a child process, which decides which binaries it runs
      env: { PATH: process.env.PATH ?? "" },
    });
  };
  const gate = (exit: number, diagnostics: string[]) => ({ "root:lint": { command: "bun run cat lint", exit, tail: "t", diagnostics } });

  test("#385: green on main, an unused argument on the PR, is a new failure", () => {
    const r = compare(gate(0, []), gate(1, ["a.ts: no-unused-vars: 'm' is defined but never used."]));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("'m' is defined but never used.");
  });

  test("red on main, and the PR adds an error: new", () => {
    const r = compare(gate(1, ["a.ts: r: old"]), gate(1, ["a.ts: r: old", "b.ts: r: added"]));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("b.ts: r: added");
    expect(r.stdout).not.toContain("a.ts: r: old");
  });

  test("the same error twice where main has it once is new", () => {
    expect(compare(gate(1, ["a.ts: r: x"]), gate(1, ["a.ts: r: x", "a.ts: r: x"])).status).toBe(1);
  });

  test("red on main with the same errors, wherever they moved to: not the PR's", () => {
    const r = compare(gate(1, ["a.ts: r: old"]), gate(1, ["a.ts: r: old"]));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("failing on main too");
  });

  test("not applicable on the PR is never a new failure, and says what main answered (#1701)", () => {
    const plain = (exit: number) => ({ "x:check": { command: "c", exit, tail: "t" } });
    for (const b of [0, 1, 2]) {
      const r = compare(plain(b), plain(78));
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(`not applicable here; not counted (main exited ${b})`);
    }
    const absent = compare({}, plain(78));
    expect(absent.status).toBe(0);
    expect(absent.stdout).toContain("main did not run it, so not counted");
  });

  test("a gate without diagnostics is judged by its exit, as before", () => {
    const plain = (exit: number) => ({ "x:check": { command: "c", exit, tail: "t" } });
    expect(compare(plain(1), plain(1)).status).toBe(0);
    expect(compare(plain(0), plain(1)).status).toBe(1);
  });
});
