/**
 * The layer PR-check gate runner runs `skill:register:check` as its
 * declaration half when every chain check it would run is its own gate
 * (folio-assistant-core#444, run 41239562434: 724.8 s of a 14m43s shard).
 *
 * @module test/layer-pr-checks-skill-register-fold.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const RUN_GATES = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks", "run-gates.py");

function fold(gates: Record<string, string>, steps: string[] | null): Record<string, string> {
  const root = mkdtempSync(join(tmpdir(), "sr-fold-"));
  if (steps) {
    mkdirSync(join(root, "cat-harness-tools", "scripts"), { recursive: true });
    const body = steps.map((s) => `  { write: ["x"], verify: ["${s}"] },`).join("\n");
    writeFileSync(join(root, "cat-harness-tools", "scripts", "skill-register.ts"), `export const STEPS = [\n${body}\n];\nexport const CHECKS = [];\n`);
  }
  const code = [
    "import importlib.util, json, sys",
    `spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(RUN_GATES)})`,
    "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
    `g = json.loads(${JSON.stringify(JSON.stringify(gates))})`,
    `m.fold_skill_register(${JSON.stringify(root)}, "bun run cat", g)`,
    "print(json.dumps(g))",
  ].join("\n");
  const r = spawnSync("python3", ["-I", "-B", "-c", code], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

const base = {
  "t:skill:register:check": "bun run cat skill:register:check",
  "t:a:check": "bun run cat a:check",
  "t:b:check": "bun run cat b:check",
  "t:skill:register:declarations:check": "bun run cat skill:register:declarations:check",
};

describe("run-gates.py skill:register fold", () => {
  test("every chain check is a gate: the gate runs the declaration half, once", () => {
    const g = fold(base, ["a:check", "b:check"]);
    expect(g["t:skill:register:check"]).toBe("bun run cat skill:register:declarations:check");
    expect(g["t:skill:register:declarations:check"]).toBeUndefined();
  });
  test("a chain check that is not a gate: the full check runs", () => {
    expect(fold(base, ["a:check", "c:check"])["t:skill:register:check"]).toBe("bun run cat skill:register:check");
  });
  test("the chain cannot be read: the full check runs", () => {
    expect(fold(base, null)["t:skill:register:check"]).toBe("bun run cat skill:register:check");
  });
});
