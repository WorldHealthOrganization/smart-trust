/**
 * The layer PR-check gates split across jobs (bean `lpcs`, step 3) judge the
 * same set as one job, and a missing shard is never a pass.
 *
 * `run-gates.py` runs shard `i` of `N` when `GATE_SHARD=i/N` is set;
 * `merge-shards.py` joins one side's shards for the compare step and exits 2
 * when any is missing or they do not cover the set exactly once. These drive
 * both through python3, as `layer-pr-checks.yml` does, over a fixture root
 * whose declared gates run `true` (its `cat` script), so they are fast.
 *
 * @module test/layer-pr-checks-shards.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DIR = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks");
const RUN_GATES = join(DIR, "run-gates.py");
const MERGE = join(DIR, "merge-shards.py");
/** One RUNNER_TEMP for every run here: kg-export's command names it, and the runs are compared. */
const RUNNER_TEMP = mkdtempSync(join(tmpdir(), "gate-runner-temp-"));

/** A root declaring layer `a`, with 17 declared gates that all pass. */
function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "gate-shards-"));
  writeFileSync(join(root, "a.json"), JSON.stringify({ name: "a", needs: [] }));
  const scripts: Record<string, string> = { cat: "true" };
  for (let k = 0; k < 15; k++) scripts[`check:g${String(k).padStart(2, "0")}`] = "true";
  scripts["zz:check"] = "true";
  scripts["lint:check"] = "true";
  scripts["build"] = "true"; // not a gate
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "a", scripts }));
  return root;
}

function env(shard?: string): NodeJS.ProcessEnv {
  // input-site: inert #6693371f — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
  const { GATE_SHARD: _drop, ...rest } = process.env;
  return shard === undefined ? rest : { ...rest, GATE_SHARD: shard };
}

function list(root: string, shard?: string): { gates: Record<string, string>; skipped: object; shard?: { shard: number; of: number; total: number } } {
  const r = spawnSync("python3", ["-I", "-B", RUN_GATES, root, "--list"], { encoding: "utf-8", env: env(shard) });
  if (r.status !== 0) throw new Error(`--list exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

/** Run shard `i/n` of `root` into `<results>/results-<side>-<i>/`, as the workflow's upload lays it out. */
function runShard(root: string, results: string, side: string, i: number, n: number): void {
  const out = join(results, `results-${side}-${i}`);
  mkdirSync(out, { recursive: true });
  const r = spawnSync("python3", ["-I", "-B", RUN_GATES, root, join(out, "gates.json")], {
    encoding: "utf-8",
    env: { ...env(`${i}/${n}`), RUNNER_TEMP },
  });
  if (r.status !== 0) throw new Error(`run-gates.py exited ${r.status}: ${r.stderr}`);
  writeFileSync(join(out, "junit.xml"), `<?xml version="1.0"?><testsuites tests="${i}"><testsuite name="s${i}"><testcase name="t${i}"/></testsuite></testsuites>`);
}

function merge(results: string, side: string, n: number): { status: number | null; out: string; stdout: string } {
  const out = mkdtempSync(join(tmpdir(), "gate-merged-"));
  const r = spawnSync("python3", ["-I", "-B", MERGE, results, side, String(n), out], { encoding: "utf-8", env: env() });
  return { status: r.status, out, stdout: r.stdout + r.stderr };
}

describe("run-gates.py GATE_SHARD", () => {
  const root = fixtureRoot();
  const whole = list(root);
  const names = Object.keys(whole.gates);

  test("the fixture derives a gate set big enough to split", () => {
    expect(names.length).toBeGreaterThan(17);
    expect(names).not.toContain("a:build");
  });

  test("1/1 is today's set, in today's order", () => {
    const one = list(root, "1/1");
    expect(Object.keys(one.gates)).toEqual(names);
    expect(one.gates).toEqual(whole.gates);
    expect(one.skipped).toEqual(whole.skipped);
  });

  test.each([2, 3, 4, 7])("%d shards are disjoint, and their union is the unsharded set", (n) => {
    const seen: string[] = [];
    for (let i = 1; i <= n; i++) {
      const part = list(root, `${i}/${n}`);
      expect(part.shard).toEqual({ shard: i, of: n, total: names.length });
      const mine = Object.keys(part.gates);
      for (const g of mine) expect(part.gates[g]).toBe(whole.gates[g]);
      // Balanced to within one gate: a round-robin of the sorted names.
      expect(Math.abs(mine.length - names.length / n)).toBeLessThan(1);
      seen.push(...mine);
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort()).toEqual([...names].sort());
  });

  test("the slice is the same on every call (base and head split alike)", () => {
    expect(list(root, "2/3").gates).toEqual(list(root, "2/3").gates);
  });

  test.each(["0/4", "5/4", "1/0", "x", "1/2/3", "-1/4"])("a malformed GATE_SHARD (%s) exits 2, never a guessed slice", (bad) => {
    const r = spawnSync("python3", ["-I", "-B", RUN_GATES, root, "--list"], { encoding: "utf-8", env: env(bad) });
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
  });
});

describe("run-gates.py GATE_TIMINGS (cat-harness-tools#397)", () => {
  const root = fixtureRoot();
  const names = Object.keys(list(root).gates);
  // One slow gate, the rest fast: a count split would put it beside others.
  const timings = Object.fromEntries(names.map((g, k) => [g, { exit: 0, seconds: g === "a:check:g07" ? 1000 : 10 + k }]));
  const file = join(mkdtempSync(join(tmpdir(), "gate-timings-")), "gates.json");
  writeFileSync(file, JSON.stringify(timings));
  const timed = (shard: string, path = file) => {
    // input-site: inert #5eb54616 — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const { GATE_SHARD: _s, GATE_TIMINGS: _t, ...rest } = process.env;
    const r = spawnSync("python3", ["-I", "-B", RUN_GATES, root, "--list"], { encoding: "utf-8", env: { ...rest, GATE_SHARD: shard, GATE_TIMINGS: path } });
    if (r.status !== 0) throw new Error(`--list exited ${r.status}: ${r.stderr}`);
    return Object.keys(JSON.parse(r.stdout).gates);
  };

  test("shards split by recorded seconds stay disjoint and cover the set", () => {
    const seen = [1, 2, 3, 4].flatMap((i) => timed(`${i}/4`));
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort()).toEqual([...names].sort());
  });

  test("the slowest gate gets a shard to itself", () => {
    const withSlow = [1, 2, 3, 4].map((i) => timed(`${i}/4`)).find((s) => s.includes("a:check:g07"));
    expect(withSlow).toEqual(["a:check:g07"]);
  });

  test("the split is the same on every call", () => {
    expect(timed("3/4")).toEqual(timed("3/4"));
  });

  test("an absent timings file falls back to the count split", () => {
    expect(timed("2/4", join(tmpdir(), "no-such-gates.json"))).toEqual(Object.keys(list(root, "2/4").gates));
  });
});

describe("run-gates.py shard_names weighs alone gates by wall time", () => {
  /** shard_names over `names`, called in python3 -I as the workflow's runner is. */
  const split = (timings: Record<string, number>, alone: string[], n: number, jobs: number): string[][] => {
    const code = [
      "import importlib.util, json, sys",
      "spec = importlib.util.spec_from_file_location('rg', sys.argv[1]); rg = importlib.util.module_from_spec(spec); spec.loader.exec_module(rg)",
      "t, a, n, j = json.loads(sys.argv[2]), json.loads(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])",
      "print(json.dumps([rg.shard_names(sorted(t), i, n, t, set(a), j) for i in range(1, n + 1)]))",
    ].join("\n");
    const r = spawnSync("python3", ["-I", "-B", "-c", code, RUN_GATES, JSON.stringify(timings), JSON.stringify(alone), String(n), String(jobs)], { encoding: "utf-8" });
    if (r.status !== 0) throw new Error(r.stderr);
    return JSON.parse(r.stdout);
  };
  // folio-assistant-core run 41260767852, simplified: one 500 s gate that
  // runs alone, then forty 25 s pooled gates (1000 s summed). By summed
  // seconds the alone gate's shard should take 20 of them; in wall time, with
  // 4 at once, all forty take 250 s, so they belong on the other shard.
  const timings: Record<string, number> = { "a:check:alone": 500 };
  for (let k = 0; k < 40; k++) timings[`a:check:p${String(k).padStart(2, "0")}`] = 25;

  test("an alone gate costs its whole seconds, pooled ones their sum over GATE_JOBS", () => {
    const parts = split(timings, ["a:check:alone"], 2, 4);
    const lone = parts.find((p) => p.includes("a:check:alone"));
    // The summed-seconds split gives it 10 of the pooled gates (750 s a side).
    expect(lone).toEqual(["a:check:alone"]);
  });

  test("with GATE_JOBS 1 the split is the summed-seconds split", () => {
    const parts = split(timings, ["a:check:alone"], 2, 1);
    expect(parts.map((p) => p.length).sort((x, y) => x - y)).toEqual([11, 30]);
    const plain = split(timings, [], 2, 1);
    expect(plain).toEqual(parts);
  });

  test("eight shards stay disjoint, cover the set and agree across calls", () => {
    const a = split(timings, ["a:check:alone"], 8, 4);
    const seen = a.flat();
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.sort()).toEqual(Object.keys(timings).sort());
    expect(split(timings, ["a:check:alone"], 8, 4)).toEqual(a);
  });
});

describe("merge-shards.py", () => {
  const root = fixtureRoot();
  const unsharded = mkdtempSync(join(tmpdir(), "gate-whole-"));
  runShard(root, unsharded, "head", 1, 1);
  const wholeGates = JSON.parse(readFileSync(join(unsharded, "results-head-1", "gates.json"), "utf-8"));
  const results = mkdtempSync(join(tmpdir(), "gate-results-"));
  for (let i = 1; i <= 4; i++) runShard(root, results, "head", i, 4);

  test("every gate records its wall time", () => {
    for (const entry of Object.values(wholeGates) as { seconds?: number }[]) expect(typeof entry.seconds).toBe("number");
  });

  test("four joined shards hold the same verdicts as one unsharded run", () => {
    const m = merge(results, "head", 4);
    expect(m.status).toBe(0);
    const merged = JSON.parse(readFileSync(join(m.out, "gates.json"), "utf-8"));
    const verdicts = (g: Record<string, { exit?: number; command: string }>) =>
      Object.fromEntries(Object.entries(g).map(([k, v]) => [k, [v.command, v.exit]]));
    expect(verdicts(merged)).toEqual(verdicts(wholeGates));
    const junit = readFileSync(join(m.out, "junit.xml"), "utf-8");
    expect(junit).toContain('tests="10"'); // 1+2+3+4: every shard's suites, under one root
    for (let i = 1; i <= 4; i++) expect(junit).toContain(`name="t${i}"`);
  });

  test("a missing shard is could-not-determine, never a pass", () => {
    const partial = mkdtempSync(join(tmpdir(), "gate-partial-"));
    for (const i of [1, 2, 4]) cpSync(join(results, `results-head-${i}`), join(partial, `results-head-${i}`), { recursive: true });
    const m = merge(partial, "head", 4);
    expect(m.status).toBe(2);
    expect(m.stdout).toContain("results-head-3 is missing");
    expect(existsSync(join(m.out, "gates.json"))).toBe(false);
  });

  test("a shard missing one of its files is could-not-determine", () => {
    const partial = mkdtempSync(join(tmpdir(), "gate-partial-"));
    cpSync(results, partial, { recursive: true });
    rmSync(join(partial, "results-head-2", "gates.json"));
    expect(merge(partial, "head", 4).status).toBe(2);
  });

  test("shards of another N, or a side with fewer shards than expected, are could-not-determine", () => {
    expect(merge(results, "head", 3).status).toBe(2); // shard 1 says 1/4
    expect(merge(results, "head", 5).status).toBe(2);
    expect(merge(results, "base", 4).status).toBe(2); // no base shards at all
  });

  test("a shard that dropped a gate it was given is could-not-determine", () => {
    const partial = mkdtempSync(join(tmpdir(), "gate-partial-"));
    cpSync(results, partial, { recursive: true });
    const p = join(partial, "results-head-3", "gates-shard.json");
    const meta = JSON.parse(readFileSync(p, "utf-8"));
    meta.ran = meta.ran.slice(1);
    writeFileSync(p, JSON.stringify(meta));
    const m = merge(partial, "head", 4);
    expect(m.status).toBe(2);
    expect(m.stdout).toContain("of a set of");
  });
});

describe("snapshot.py (cat-harness-tools#397)", () => {
  const SNAPSHOT = join(DIR, "snapshot.py");
  const py = (...a: string[]) => {
    const r = spawnSync("python3", ["-B", SNAPSHOT, ...a], { encoding: "utf-8" });
    expect(r.status).toBe(0);
  };

  test("a shard that applies the snapshot holds the prepared tree, a moved-in caller included", () => {
    const work = mkdtempSync(join(tmpdir(), "snapshot-"));
    const prep = join(work, "prep");
    // The mount: what every shard also mounts for itself.
    mkdirSync(join(prep, "caller"), { recursive: true });
    writeFileSync(join(prep, "caller", "a.ts"), "mounted\n");
    writeFileSync(join(prep, "caller", "gone.ts"), "mounted\n");
    writeFileSync(join(prep, "kept.ts"), "mounted\n");
    const shard = join(work, "shard");
    cpSync(prep, shard, { recursive: true });
    // The caller's checkout, made BEFORE the mark: `mv` keeps its older mtimes.
    const src = join(work, "src");
    mkdirSync(src);
    writeFileSync(join(src, "a.ts"), "the PR\n");
    writeFileSync(join(src, "new.ts"), "the PR\n");
    const list = join(work, "mounted.txt");
    py("mark", prep, list);
    rmSync(join(prep, "caller"), { recursive: true });
    spawnSync("mv", [src, join(prep, "caller")]);
    writeFileSync(join(prep, "derived.json"), "{}\n");
    // A graph's mount marker, which branch-store files in the git directory.
    mkdirSync(join(prep, ".git", "branch-mounts"), { recursive: true });
    writeFileSync(join(prep, ".git", "branch-mounts", "beans.json"), "{}\n");
    // And a graph the mount found absent (bean x5e0): every shard's gates read it.
    writeFileSync(join(prep, ".git", "branch-mounts", "issue-marks.absent"), "{}\n");
    writeFileSync(join(prep, ".git", "HEAD"), "not carried\n");
    py("save", prep, list, join(work, "root"));
    py("apply", shard, join(work, "root"));
    expect(readFileSync(join(shard, "caller", "a.ts"), "utf-8")).toBe("the PR\n");
    expect(readFileSync(join(shard, "caller", "new.ts"), "utf-8")).toBe("the PR\n");
    expect(existsSync(join(shard, "caller", "gone.ts"))).toBe(false);
    expect(existsSync(join(shard, "derived.json"))).toBe(true);
    expect(readFileSync(join(shard, "kept.ts"), "utf-8")).toBe("mounted\n");
    expect(existsSync(join(shard, ".git", "branch-mounts", "beans.json"))).toBe(true);
    expect(existsSync(join(shard, ".git", "branch-mounts", "issue-marks.absent"))).toBe(true);
    expect(existsSync(join(shard, ".git", "HEAD"))).toBe(false);
    rmSync(work, { recursive: true, force: true });
  });

  test("a directory the PR emptied is gone from the shard, not left empty (cat-harness#390)", () => {
    const work = mkdtempSync(join(tmpdir(), "snapshot-"));
    const prep = join(work, "prep");
    mkdirSync(join(prep, "caller", "tools", "github"), { recursive: true });
    writeFileSync(join(prep, "caller", "tools", "github", "github.ts"), "mounted\n");
    writeFileSync(join(prep, "caller", "kept.ts"), "mounted\n");
    const shard = join(work, "shard");
    cpSync(prep, shard, { recursive: true });
    const src = join(work, "src");
    mkdirSync(join(src, "tools"), { recursive: true });
    writeFileSync(join(src, "kept.ts"), "the PR\n");
    const list = join(work, "mounted.txt");
    py("mark", prep, list);
    rmSync(join(prep, "caller"), { recursive: true });
    spawnSync("mv", [src, join(prep, "caller")]);
    py("save", prep, list, join(work, "root"));
    py("apply", shard, join(work, "root"));
    expect(existsSync(join(shard, "caller", "tools", "github"))).toBe(false);
    expect(readFileSync(join(shard, "caller", "kept.ts"), "utf-8")).toBe("the PR\n");
    rmSync(work, { recursive: true, force: true });
  });
});
