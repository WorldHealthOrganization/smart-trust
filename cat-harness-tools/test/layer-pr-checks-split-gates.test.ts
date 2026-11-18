/**
 * The layer PR-check gate runner runs a slow gate as parts, one per shard
 * (S-CI6: `check:cat-harness-tools-standalone`, 510 s alone on
 * folio-assistant-core run 41287467368), and names the gate set to
 * skill-register.ts so the QA working copy a gate builds does not re-run the
 * chain checks the gates already run.
 *
 * @module test/layer-pr-checks-split-gates.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const RUN_GATES = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks", "run-gates.py");

function py(body: string): unknown {
  const code = [
    "import importlib.util, json, sys",
    `spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(RUN_GATES)})`,
    "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
    body,
  ].join("\n");
  const r = spawnSync("python3", ["-I", "-B", "-c", code], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

const gates = {
  "t:a:check": "bun run cat a:check",
  "cat-harness-tools:check:cat-harness-tools-standalone": "bun run cat check:cat-harness-tools-standalone",
  "t:b:check": "bun run cat b:check",
};

function split(timings: Record<string, number> | null, alone: string[]) {
  return py(
    [
      `g = json.loads(${JSON.stringify(JSON.stringify(gates))})`,
      `t = json.loads(${JSON.stringify(JSON.stringify(timings))})`,
      `a = set(json.loads(${JSON.stringify(JSON.stringify(alone))}))`,
      `out = m.split_gates(g, "bun run cat", t, a)`,
      "print(json.dumps({'gates': out, 'timings': t, 'alone': sorted(a)}))",
    ].join("\n"),
  ) as { gates: Record<string, string>; timings: Record<string, number> | null; alone: string[] };
}

describe("run-gates.py split_gates", () => {
  const whole = "cat-harness-tools:check:cat-harness-tools-standalone";
  test("the standalone gate becomes four parts, in its place, each one slice", () => {
    const { gates: g } = split(null, []);
    expect(Object.keys(g)).toEqual(["t:a:check", `${whole}#1/4`, `${whole}#2/4`, `${whole}#3/4`, `${whole}#4/4`, "t:b:check"]);
    expect(g[`${whole}#3/4`]).toBe("bun run cat check:cat-harness-tools-standalone --part 3/4");
    expect(g[whole]).toBeUndefined();
  });
  test("parts inherit alone, and a quarter of the whole gate's seconds until they have their own", () => {
    const { timings, alone } = split({ [whole]: 500, [`${whole}#2/4`]: 90 }, [whole]);
    expect(timings![`${whole}#1/4`]).toBe(125);
    expect(timings![`${whole}#2/4`]).toBe(90);
    expect(alone).toContain(`${whole}#4/4`);
  });
  test("the parts run alone, so the balancer puts one in each of four shards", () => {
    const names = py(
      [
        `w = ${JSON.stringify(whole)}`,
        "t = {w: 500.0, 't:a:check': 100.0, 't:b:check': 100.0}",
        "a = {w}",
        `g = m.split_gates(json.loads(${JSON.stringify(JSON.stringify(gates))}), "bun run cat", t, a)`,
        "print(json.dumps([[n for n in m.shard_names(list(g), i, 4, t, a, 4) if '#' in n] for i in range(1, 5)]))",
      ].join("\n"),
    ) as string[][];
    expect(names.every((s) => s.length === 1)).toBe(true);
  });
  test("a side whose check-standalone.ts has no --part keeps the gate whole", () => {
    const root = mkdtempSync(join(tmpdir(), "split-gates-"));
    mkdirSync(join(root, "cat-harness-tools", "scripts"), { recursive: true });
    const at = (src: string | null) => {
      if (src !== null) writeFileSync(join(root, "cat-harness-tools", "scripts", "check-standalone.ts"), src);
      return Object.keys(py(`print(json.dumps(m.split_gates(json.loads(${JSON.stringify(JSON.stringify(gates))}), "bun run cat", root=${JSON.stringify(root)})))`) as object);
    };
    try {
      expect(at(null)).toContain(whole);
      expect(at("const x = 1;\n")).toContain(whole);
      expect(at('const partArg = arg("--part", argv);\n')).toContain(`${whole}#4/4`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  test("a gate with another script is untouched", () => {
    const g = py(`print(json.dumps(m.split_gates({"x:check:bootstrap-standalone": "bun run cat check:bootstrap-standalone"}, "bun run cat")))`);
    expect(g).toEqual({ "x:check:bootstrap-standalone": "bun run cat check:bootstrap-standalone" });
  });
});

describe("run-gates.py verified_by_gates", () => {
  test("names every gate's script, once, sorted", () => {
    const v = py(`print(json.dumps(m.verified_by_gates({"a:kg:audit:check": "x", "b:kg:audit:check": "y", "graph:core:z": "z", "c:lsi:viz:check": "w"})))`);
    expect(v).toBe("core:z,kg:audit:check,lsi:viz:check");
  });
});
