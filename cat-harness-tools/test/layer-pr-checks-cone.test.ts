/**
 * The CI cone in the layer PR checks (bean `4rbc`, cat-harness-tools#398): a
 * gate whose recorded read set is unchanged is SKIPPED, never passed, and
 * anything the cone cannot answer runs the gate.
 *
 * `run-gates.py` asks `ci-cone.ts decide-all` once per shard (`GATE_CONE`),
 * and in record mode runs the candidates through `ci-cone.ts run`. Here
 * `GATE_CONE_CLI` replaces ci-cone.ts with a stub that answers from a JSON
 * spec, so these test the wiring only: the tracer and the exact-match decision
 * are ci-cone.ts's own, tested in `scripts/tests/sdlc/ci-cone.test.ts`. Then
 * `merge-shards.py`, `compare-gates.py` and `merge-cone.py` on what it wrote.
 *
 * @module test/layer-pr-checks-cone.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DIR = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks");
const RUN_GATES = join(DIR, "run-gates.py");
const MERGE = join(DIR, "merge-shards.py");
const COMPARE = join(DIR, "compare-gates.py");
const MERGE_CONE = join(DIR, "merge-cone.py");
const RUNNER_TEMP = mkdtempSync(join(tmpdir(), "cone-runner-temp-"));

/**
 * The stand-in for ci-cone.ts. `decide-all <out> <script>...` writes the
 * spec's `decisions` (or exits with `decideExit`); `run <script>` logs the call
 * and, when the spec lists the script in `record`, files a record for it in
 * `build/ci-cone/records.json`, as ci-cone.ts `recordRun` does.
 */
const STUB = `
import json, os, sys
spec = json.load(open(os.environ["CONE_STUB_SPEC"]))
log = os.environ["CONE_STUB_LOG"]
cmd = sys.argv[1]
with open(log, "a") as f:
    f.write(" ".join(sys.argv[1:]) + "\\n")
if cmd == "decide-all":
    if spec.get("decideExit"):
        sys.exit(spec["decideExit"])
    out, names = sys.argv[2], sys.argv[3:]
    d = spec.get("decisions", {})
    json.dump({"records": spec.get("sha"), "decisions": {n: d.get(n, {"skip": False, "why": "no record", "candidate": False}) for n in names}}, open(out, "w"))
elif cmd == "keep":
    path = os.path.join("build", "ci-cone", "records.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        rec = json.load(open(path))
    except (OSError, ValueError):
        rec = {"version": 2, "recipe": 1, "sha": "new", "checks": {}}
    for f in sys.argv[2:]:
        got = json.load(open(f))
        if got["record"] is None:
            rec["checks"].pop(got["script"], None)
        else:
            rec["checks"][got["script"]] = got["record"]
    json.dump(rec, open(path, "w"))
elif cmd == "run" and os.environ.get("CI_CONE_TOUCHED_OUT"):
    import time
    script = sys.argv[2]
    time.sleep(spec.get("sleep", 0))
    json.dump(spec.get("touched", {}).get(script, {"reads": [], "listed": [], "writes": [], "git": 0}), open(os.environ["CI_CONE_TOUCHED_OUT"], "w"))
    if script in spec.get("failBeside", []):
        sys.exit(1)
    record = {"sha": "new", "base": "fp", "reads": {"b/x.json": "file 1"}, "git": {}} if script in spec.get("record", []) else None
    json.dump({"script": script, "sha": "new", "run": "new", "recordedAt": "t", "record": record}, open(os.environ["CI_CONE_RECORD_OUT"], "w"))
elif cmd == "run":
    script = sys.argv[2]
    path = os.path.join("build", "ci-cone", "records.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        rec = json.load(open(path))
    except (OSError, ValueError):
        rec = {"version": 2, "recipe": 1, "sha": "new", "checks": {}}
    if script in spec.get("record", []):
        rec["checks"][script] = {"sha": "new", "base": "fp", "reads": {"b/x.json": "file 1"}, "git": {}}
    json.dump(rec, open(path, "w"))
`;

interface Spec {
  decisions?: Record<string, object>;
  decideExit?: number;
  record?: string[];
  sha?: string;
  /** Parallel tracing: what each traced run reports it touched, and how long each run takes (s). */
  touched?: Record<string, object>;
  sleep?: number;
  /** Gates whose traced run fails beside others (and passes alone). */
  failBeside?: string[];
}

/** A root with two layers: `c` (the caller) needs `b`. Each declares three gates, which pass (the root's `cat` script is `true`). */
function fixture(records?: object): string {
  const root = mkdtempSync(join(tmpdir(), "cone-root-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", scripts: { cat: "true" } }));
  for (const [n, needs] of [["b", []], ["c", ["b"]]] as const) {
    mkdirSync(join(root, n));
    writeFileSync(join(root, n, `${n}.json`), JSON.stringify({ name: n, needs }));
    const scripts: Record<string, string> = {};
    for (const g of ["one", "two", "three"]) scripts[`check:${n}-${g}`] = "true";
    writeFileSync(join(root, n, "package.json"), JSON.stringify({ name: n, scripts }));
  }
  if (records !== undefined) {
    mkdirSync(join(root, "build", "ci-cone"), { recursive: true });
    writeFileSync(join(root, "build", "ci-cone", "records.json"), JSON.stringify(records));
  }
  return root;
}

function stub(spec: Spec): { cli: string; specPath: string; log: string } {
  const dir = mkdtempSync(join(tmpdir(), "cone-stub-"));
  writeFileSync(join(dir, "stub.py"), STUB);
  writeFileSync(join(dir, "spec.json"), JSON.stringify(spec));
  writeFileSync(join(dir, "log"), "");
  return { cli: `python3 -I -B ${join(dir, "stub.py")}`, specPath: join(dir, "spec.json"), log: join(dir, "log") };
}

interface Run {
  status: number | null;
  stdout: string;
  gates: Record<string, { exit?: number; skipped?: string; unchanged?: string; command: string }>;
  meta: { ran: string[]; unchanged: string[]; total: number };
  log: string[];
  out: string;
}

function runGates(root: string, mode: string | undefined, spec: Spec | undefined, extraEnv: Record<string, string> = {}): Run {
  const out = mkdtempSync(join(tmpdir(), "cone-out-"));
  // input-site: inert #cc5526e4 — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
  const { GATE_SHARD: _a, GATE_CONE: _b, GATE_CONE_CLI: _c, GATE_TIMINGS: _d, ...rest } = process.env;
  const s = spec === undefined ? undefined : stub(spec);
  const env: NodeJS.ProcessEnv = { ...rest, RUNNER_TEMP, ...extraEnv };
  if (mode !== undefined) env.GATE_CONE = mode;
  if (s !== undefined) Object.assign(env, { GATE_CONE_CLI: s.cli, CONE_STUB_SPEC: s.specPath, CONE_STUB_LOG: s.log });
  const r = spawnSync("python3", ["-I", "-B", RUN_GATES, root, join(out, "gates.json"), "--instance", "c"], { encoding: "utf-8", env });
  return {
    status: r.status,
    stdout: r.stdout + r.stderr,
    gates: existsSync(join(out, "gates.json")) ? JSON.parse(readFileSync(join(out, "gates.json"), "utf-8")) : {},
    meta: existsSync(join(out, "gates-shard.json")) ? JSON.parse(readFileSync(join(out, "gates-shard.json"), "utf-8")) : {},
    log: s === undefined ? [] : readFileSync(s.log, "utf-8").split("\n").filter(Boolean),
    out,
  };
}

const SKIP = (sha = "abc123") => ({ skip: true, sha, why: `inputs unchanged since ${sha} (1 paths)`, candidate: true });

describe("run-gates.py GATE_CONE=skip", () => {
  test("a gate the cone says is unchanged is SKIPPED with its sha, has no exit, and is never counted as run", () => {
    const r = runGates(fixture(), "skip", { decisions: { "check:b-one": SKIP() } });
    expect(r.status).toBe(0);
    const g = r.gates["b:check:b-one"]!;
    expect(g.exit).toBeUndefined();
    expect(g.unchanged).toBe("abc123");
    expect(g.skipped).toContain("inputs unchanged since abc123");
    expect(r.meta.unchanged).toEqual(["b:check:b-one"]);
    expect(r.meta.ran).not.toContain("b:check:b-one");
    expect(r.gates["b:check:b-two"]!.exit).toBe(0);
    expect(r.stdout).toContain("b:check:b-one: SKIPPED — inputs unchanged since abc123");
    expect(r.stdout).not.toMatch(/b:check:b-one: (exit 0|pass)/);
  });

  test("the set is still covered: ran and unchanged together are every gate of the shard", () => {
    const r = runGates(fixture(), "skip", { decisions: { "check:b-one": SKIP(), "check:c-two": SKIP() } });
    expect(r.meta.ran.length + r.meta.unchanged.length).toBe(r.meta.total);
  });

  test("decide-all is asked once, before any gate, for the declared `bun run cat <script>` gates only", () => {
    const r = runGates(fixture(), "skip", {});
    expect(r.log.length).toBe(1);
    const asked = r.log[0]!.split(" ");
    expect(asked[0]).toBe("decide-all");
    // CHECKOUT_SCRIPTS and index-gates.json gates are run as `bun run cat <script>` too.
    const indexGates = Object.values(
      JSON.parse(readFileSync(join(DIR, "index-gates.json"), "utf-8")).gates as Record<string, string>,
    );
    expect(asked.slice(2).sort()).toEqual(
      [
        "agent-memory:check",
        "check:b-one",
        "check:b-three",
        "check:b-two",
        "check:c-one",
        "check:c-three",
        "check:c-two",
        "index-config:inline:check",
        "skill:commands:check",
        ...indexGates,
      ].sort(),
    );
    expect(r.log.slice(1)).toEqual([]);
  });

  test.each([
    ["a skip with no sha", { skip: true, why: "x" }],
    ["a skip that is not literally true", { skip: "yes", sha: "abc" }],
    ["no decision at all", undefined],
  ] as const)("%s runs the gate (fail-closed)", (_what, d) => {
    const r = runGates(fixture(), "skip", { decisions: d === undefined ? {} : { "check:b-one": d } });
    expect(r.gates["b:check:b-one"]!.exit).toBe(0);
    expect(r.meta.unchanged).toEqual([]);
  });

  test("decide-all failing runs every gate, and says why", () => {
    const r = runGates(fixture(), "skip", { decideExit: 3, decisions: { "check:b-one": SKIP() } });
    expect(r.meta.unchanged).toEqual([]);
    expect(r.gates["b:check:b-one"]!.exit).toBe(0);
    expect(r.stdout).toContain("decide-all exited 3");
  });

  test("no ci-cone.ts at this side's pin runs every gate, and says so", () => {
    const r = runGates(fixture(), "skip", undefined);
    expect(r.meta.unchanged).toEqual([]);
    expect(r.stdout).toContain("ci-cone.ts is absent at this side's pin");
  });

  test("GATE_CONE unset: the cone is never asked", () => {
    const r = runGates(fixture(), undefined, { decisions: { "check:b-one": SKIP() } });
    expect(r.log).toEqual([]);
    expect(r.gates["b:check:b-one"]!.exit).toBe(0);
  });

  test("an unknown GATE_CONE is off, and says so", () => {
    const r = runGates(fixture(), "maybe", { decisions: { "check:b-one": SKIP() } });
    expect(r.log).toEqual([]);
    expect(r.stdout).toContain("neither skip nor record");
  });

  test("a record whose read set lies in its own instance's tree is reported own-tree, not the caller (2b, derived)", () => {
    const records = {
      version: 2,
      recipe: 1,
      sha: "abc123",
      checks: {
        "check:b-one": { sha: "abc123", base: "fp", reads: { b: "dir x", "b/x.json": "file 1" }, git: {} },
        "check:b-two": { sha: "abc123", base: "fp", reads: { "b/x.json": "file 1", "package.json": "file 2" }, git: {} },
      },
    };
    const r = runGates(fixture(records), "skip", { decisions: { "check:b-one": SKIP(), "check:b-two": SKIP() } });
    expect(r.gates["b:check:b-one"]!.skipped).toContain("reads only b/ (own tree, not the caller)");
    // A root-level read is outside b's tree: unchanged, and not own-tree.
    expect(r.gates["b:check:b-two"]!.skipped).not.toContain("own tree");
    expect(r.gates["b:check:b-two"]!.unchanged).toBe("abc123");
  });
});

describe("run-gates.py footprint (2b): derived from the record, never declared", () => {
  const py = (expr: string): unknown => {
    const code = [
      "import importlib.util, json",
      `spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(RUN_GATES)})`,
      "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
      `print(json.dumps(${expr}))`,
    ].join("\n");
    const r = spawnSync("python3", ["-I", "-B", "-c", code], { encoding: "utf-8" });
    if (r.status !== 0) throw new Error(r.stderr);
    return JSON.parse(r.stdout);
  };

  test("the top-level entries of its reads and of its git calls' cwd; `.` for the root itself", () => {
    expect(py(`m.footprint({"reads": {"b": "", "b/x": "", "b/y/z": "", "bun.lock": ""}, "git": {json.dumps(["c/d", "ls-files"]): ""}})`)).toEqual(["b", "bun.lock", "c"]);
    expect(py(`m.footprint({"reads": {"": "dir x"}, "git": {json.dumps(["", "ls-files"]): ""}})`)).toEqual(["."]);
  });

  test("an unreadable git key is an unknown directory, so never own-tree", () => {
    expect(py(`m.own_tree(m.footprint({"reads": {"b/x": ""}, "git": {"not json": ""}}), "b")`)).toBe(false);
  });

  test("no record has no footprint, and the root is no instance's own tree", () => {
    expect(py("m.footprint(None)")).toEqual([]);
    expect(py(`m.own_tree(["."], ".")`)).toBe(false);
  });
});

describe("run-gates.py GATE_CONE=record", () => {
  const strace = spawnSync("strace", ["-f", "-qq", "-o", "/dev/null", "true"]).status === 0;

  test.if(strace)("candidates that do not skip run through `ci-cone.ts run`, after the rest; the shard's records are written", () => {
    const records = { version: 2, recipe: 1, sha: "old", checks: { "check:c-three": { sha: "old", base: "fp", reads: { "c/a": "file 1" }, git: {} }, "check:zz-not-here": { sha: "old", base: "fp", reads: {}, git: {} } } };
    const r = runGates(fixture(records), "record", {
      decisions: {
        "check:b-one": SKIP("old"),
        "check:b-two": { skip: false, why: "b/x.json changed", candidate: true },
        "check:c-three": { skip: false, why: "c/a changed", candidate: true },
        "check:c-one": { skip: false, why: "not declared {tracked}", candidate: false },
      },
      record: ["check:b-two"],
    });
    expect(r.status).toBe(0);
    const runs = r.log.filter((l) => l.startsWith("run "));
    expect(runs.sort()).toEqual(["run check:b-two", "run check:c-three"]);
    expect(r.gates["b:check:b-two"]!.exit).toBe(0);
    expect(r.gates["b:check:b-two"]!.command).toBe("bun run cat check:b-two");
    expect(r.gates["b:check:b-one"]!.unchanged).toBe("old");
    const cone = JSON.parse(readFileSync(join(r.out, "cone-records.json"), "utf-8"));
    // b-two: recorded by its traced run. c-three: ran and did not record, so
    // its restored record is forgotten. A script not in this shard is not
    // this shard's to keep.
    expect(Object.keys(cone.checks).sort()).toEqual(["check:b-two"]);
  });

  test.if(strace)("a gate that matched keeps the record it matched", () => {
    const records = { version: 2, recipe: 1, sha: "old", checks: { "check:b-one": { sha: "old", base: "fp", reads: { "b/x.json": "file 1" }, git: {} } } };
    const r = runGates(fixture(records), "record", { decisions: { "check:b-one": SKIP("old") } });
    const cone = JSON.parse(readFileSync(join(r.out, "cone-records.json"), "utf-8"));
    expect(cone.checks["check:b-one"].sha).toBe("old");
  });

  const PARALLEL = { GATE_JOBS: "4", GATE_CONE_PARALLEL: "1" };
  const CANDIDATE = (why: string) => ({ skip: false, why, candidate: true });

  test.if(strace)("pooled candidates are traced side by side; a record whose reads a neighbour wrote is dropped and the gate runs again alone", () => {
    const r = runGates(
      fixture(),
      "record",
      {
        decisions: { "check:b-one": CANDIDATE("x"), "check:b-two": CANDIDATE("x"), "check:c-three": CANDIDATE("x"), "check:c-one": CANDIDATE("x") },
        record: ["check:b-one", "check:b-two", "check:c-three", "check:c-one"],
        touched: {
          "check:b-one": { reads: ["b/x.json"], listed: [], writes: [], git: 0 },
          "check:b-two": { reads: ["b"], listed: ["b"], writes: [], git: 0 },
          "check:c-three": { reads: ["c/a"], listed: [], writes: ["b/x.json", "b/new.json"], git: 0 },
          "check:c-one": { reads: ["b/new.json"], listed: [], writes: [], git: 0 },
        },
        sleep: 0.5,
      },
      PARALLEL,
    );
    expect(r.status).toBe(0);
    const runs = r.log.filter((l) => l.startsWith("run "));
    // Three side by side, then b-one (read what c-three wrote) and b-two
    // (listed the directory c-three wrote into) again alone.
    expect(runs.sort()).toEqual(["run check:b-one", "run check:b-one", "run check:b-two", "run check:b-two", "run check:c-one", "run check:c-one", "run check:c-three"]);
    const keep = r.log.filter((l) => l.startsWith("keep "));
    expect(keep).toHaveLength(1);
    expect(keep[0]!.split(" ")).toHaveLength(2); // c-three's record only
    expect(r.stdout).toContain("b:check:b-one runs again alone: c:check:c-three wrote b/x.json, which it read");
    expect(r.stdout).toContain("b:check:b-two runs again alone: c:check:c-three wrote b/new.json into a directory it listed");
    // c-one probed b/new.json before it existed; c-three created it beside it.
    expect(r.stdout).toContain("c:check:c-one runs again alone: c:check:c-three wrote b/new.json, which it read");
    expect(r.stdout).toContain("check:c-three wrote inside the checkout while judging");
    const cone = JSON.parse(readFileSync(join(r.out, "cone-records.json"), "utf-8"));
    expect(Object.keys(cone.checks).sort()).toEqual(["check:b-one", "check:b-two", "check:c-one", "check:c-three"]);
  });

  test.if(strace)("a neighbour whose writes are not known disturbs every run beside it; runs that did not overlap are kept", () => {
    const r = runGates(
      fixture(),
      "record",
      {
        decisions: { "check:b-one": CANDIDATE("x"), "check:b-two": CANDIDATE("x") },
        record: ["check:b-one", "check:b-two"],
        touched: { "check:b-two": { undetermined: "not traced — fingerprint undetermined" } },
        sleep: 0.5,
      },
      PARALLEL,
    );
    expect(r.stdout).toContain("b:check:b-one runs again alone: b:check:b-two ran beside it and what it wrote is not known");
    // b-two's own reads met no write, so its record is kept.
    expect(r.log.filter((l) => l === "run check:b-one")).toHaveLength(2);
    expect(r.log.filter((l) => l === "run check:b-two")).toHaveLength(1);
  });

  test.if(strace)("a gate that fails beside others keeps no record and is judged by a run alone; its neighbours keep theirs", () => {
    const r = runGates(
      fixture(),
      "record",
      {
        decisions: { "check:b-one": CANDIDATE("x"), "check:b-two": CANDIDATE("x"), "check:c-one": CANDIDATE("x") },
        record: ["check:b-one", "check:b-two", "check:c-one"],
        failBeside: ["check:b-one"],
        sleep: 0.3,
      },
      PARALLEL,
    );
    expect(r.status).toBe(0);
    expect(r.gates["b:check:b-one"]!.exit).toBe(0);
    expect(r.log.filter((l) => l === "run check:b-one")).toHaveLength(2);
    expect(r.log.filter((l) => l === "run check:b-two")).toHaveLength(1);
    expect(r.stdout).toContain("b:check:b-one runs again alone: it failed beside other gates");
    const keep = r.log.filter((l) => l.startsWith("keep "));
    expect(keep).toHaveLength(1);
    expect(keep[0]!.split(" ")).toHaveLength(3); // b-two's and c-one's records
  });

  test.if(strace)("GATE_CONE_PARALLEL=0, or a ci-cone.ts without the touched report, traces one at a time with the shared record file", () => {
    const r = runGates(fixture(), "record", { decisions: { "check:b-one": CANDIDATE("x"), "check:b-two": CANDIDATE("x") }, record: ["check:b-one"] }, { GATE_JOBS: "4" });
    expect(r.log.filter((l) => l.startsWith("keep "))).toEqual([]);
    expect(r.log.filter((l) => l.startsWith("run ")).sort()).toEqual(["run check:b-one", "run check:b-two"]);
    const cone = JSON.parse(readFileSync(join(r.out, "cone-records.json"), "utf-8"));
    expect(Object.keys(cone.checks)).toEqual(["check:b-one"]);
  });

  test("without strace nothing is traced, and it says so; a match still skips", () => {
    // A PATH holding python3 and a `bun` that passes, and no strace.
    const bin = mkdtempSync(join(tmpdir(), "cone-path-"));
    symlinkSync(spawnSync("python3", ["-c", "import sys; print(sys.executable)"], { encoding: "utf-8" }).stdout.trim(), join(bin, "python3"));
    writeFileSync(join(bin, "bun"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const r = runGates(
      fixture(),
      "record",
      { decisions: { "check:b-one": SKIP(), "check:b-two": { skip: false, why: "x", candidate: true } } },
      { PATH: bin },
    );
    expect(r.log.filter((l) => l.startsWith("run "))).toEqual([]);
    expect(r.stdout).toContain("strace does not run here");
    expect(r.gates["b:check:b-one"]!.unchanged).toBe("abc123");
  });
});

describe("merge-shards.py with cone-skipped gates", () => {
  function shardDir(gates: object, meta: object): string {
    const results = mkdtempSync(join(tmpdir(), "cone-merge-"));
    const d = join(results, "results-head-1");
    mkdirSync(d);
    writeFileSync(join(d, "gates.json"), JSON.stringify(gates));
    writeFileSync(join(d, "gates-shard.json"), JSON.stringify(meta));
    writeFileSync(join(d, "junit.xml"), `<?xml version="1.0"?><testsuites tests="0"></testsuites>`);
    return results;
  }
  const merge = (results: string) => spawnSync("python3", ["-I", "-B", MERGE, results, "head", "1", mkdtempSync(join(tmpdir(), "cone-merged-"))], { encoding: "utf-8" });

  test("an unchanged gate counts toward covering the set", () => {
    const results = shardDir(
      { a: { command: "x", exit: 0 }, b: { command: "y", skipped: "inputs unchanged since s", unchanged: "s" } },
      { shard: 1, of: 1, total: 2, ran: ["a"], unchanged: ["b"] },
    );
    expect(merge(results).status).toBe(0);
  });

  test("an unchanged gate with no record sha is could-not-determine", () => {
    const results = shardDir(
      { a: { command: "x", exit: 0 }, b: { command: "y", skipped: "inputs unchanged since s" } },
      { shard: 1, of: 1, total: 2, ran: ["a"], unchanged: ["b"] },
    );
    const m = merge(results);
    expect(m.status).toBe(2);
    expect(m.stdout).toContain("no unchanged record");
  });

  test("a gate both ran and unchanged is could-not-determine", () => {
    const results = shardDir({ a: { command: "x", exit: 0 } }, { shard: 1, of: 1, total: 1, ran: ["a"], unchanged: ["a"] });
    expect(merge(results).status).toBe(2);
  });
});

describe("compare-gates.py with cone-skipped gates", () => {
  function compare(base: object, head: object): { status: number | null; out: string } {
    const d = mkdtempSync(join(tmpdir(), "cone-compare-"));
    writeFileSync(join(d, "base.json"), JSON.stringify(base));
    writeFileSync(join(d, "head.json"), JSON.stringify(head));
    // input-site: inert #30464c2d — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const { GITHUB_STEP_SUMMARY: _s, ...env } = process.env;
    const r = spawnSync("python3", ["-I", "-B", COMPARE, join(d, "base.json"), join(d, "head.json")], { encoding: "utf-8", env });
    return { status: r.status, out: r.stdout };
  }
  const U = { command: "c", skipped: "inputs unchanged since abc (3 paths)", unchanged: "abc" };

  test("unchanged on head is SKIPPED with its reason, never a pass, and never fails the PR", () => {
    const r = compare({ g: { command: "c", exit: 1, tail: "" } }, { g: U });
    expect(r.status).toBe(0);
    expect(r.out).toContain("| `g` | 1 | unchanged since abc | SKIPPED — inputs unchanged since abc (3 paths) |");
    expect(r.out).not.toContain("| pass |");
  });

  test("unchanged on both sides is SKIPPED, not pass", () => {
    const r = compare({ g: U }, { g: U });
    expect(r.status).toBe(0);
    expect(r.out).toContain("SKIPPED — inputs unchanged since abc");
    expect(r.out).not.toContain("| pass |");
  });

  test("unchanged on base stands for its green run: a head failure against it is NEW", () => {
    const r = compare({ g: U }, { g: { command: "c", exit: 1, tail: "boom" } });
    expect(r.status).toBe(1);
    expect(r.out).toContain("NEW FAILURE");
  });

  test("unchanged on base, head could not determine: NEW", () => {
    const r = compare({ g: U }, { g: { command: "c", exit: 2, tail: "?" } });
    expect(r.status).toBe(1);
    expect(r.out).toContain("NEW: could not determine");
  });

  test("passed on base, head could not determine: labelled could not determine, still counted", () => {
    const r = compare({ g: { command: "c", exit: 0, tail: "" } }, { g: { command: "c", exit: 2, tail: "?" } });
    expect(r.status).toBe(1);
    expect(r.out).toContain("| `g` | 0 | 2 | NEW: could not determine |");
    expect(r.out).not.toContain("NEW FAILURE");
  });

  test("unchanged on base, head passes: pass", () => {
    const r = compare({ g: U }, { g: { command: "c", exit: 0, tail: "" } });
    expect(r.status).toBe(0);
    expect(r.out).toContain("| `g` | unchanged since abc | 0 | pass |");
  });
});

describe("compare-gates.py with a gate main did not run", () => {
  function compare(base: object, head: object): { status: number | null; out: string } {
    const d = mkdtempSync(join(tmpdir(), "absent-compare-"));
    writeFileSync(join(d, "base.json"), JSON.stringify(base));
    writeFileSync(join(d, "head.json"), JSON.stringify(head));
    // input-site: inert #30464c2d — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const { GITHUB_STEP_SUMMARY: _s, ...env } = process.env;
    const r = spawnSync("python3", ["-I", "-B", COMPARE, join(d, "base.json"), join(d, "head.json")], { encoding: "utf-8", env });
    return { status: r.status, out: r.stdout };
  }

  test("not applicable (78) on head, absent on base: listed, not counted", () => {
    const r = compare({}, { g: { command: "c", exit: 78, tail: "NOT APPLICABLE" } });
    expect(r.status).toBe(0);
    expect(r.out).toContain("| `g` | — | 78 | not applicable here; main did not run it, so not counted |");
  });

  test("could not determine (2) on head, absent on base: listed, not counted", () => {
    const r = compare({}, { g: { command: "c", exit: 2, tail: "?" } });
    expect(r.status).toBe(0);
    expect(r.out).toContain("could not determine; main did not run it, so not counted");
  });

  test("a plain failure on head, absent on base, is still NEW", () => {
    const r = compare({}, { g: { command: "c", exit: 1, tail: "boom" } });
    expect(r.status).toBe(1);
    expect(r.out).toContain("NEW FAILURE");
  });

  test("not applicable (78) on head where base passed is listed with main's answer, not counted (#1701)", () => {
    // Was NEW. A gate that learns it does not apply to an instance root then
    // failed that instance's next PR (dth-phc#7, check:qa-reviewer-permission
    // 0 -> 78), while main-verdict.py never counts 78 red. The lost answer
    // still shows in the table.
    const r = compare({ g: { command: "c", exit: 0, tail: "" } }, { g: { command: "c", exit: 78, tail: "" } });
    expect(r.status).toBe(0);
    expect(r.out).toContain("not applicable here; not counted (main exited 0)");
  });
});

describe("merge-cone.py", () => {
  function shards(...files: (object | undefined)[]): string {
    const results = mkdtempSync(join(tmpdir(), "cone-records-"));
    files.forEach((f, k) => {
      const d = join(results, `results-base-${k + 1}`);
      mkdirSync(d);
      if (f !== undefined) writeFileSync(join(d, "cone-records.json"), JSON.stringify(f));
    });
    return results;
  }
  const run = (results: string, n: number) => {
    const out = join(mkdtempSync(join(tmpdir(), "cone-records-out-")), "records.json");
    const r = spawnSync("python3", ["-I", "-B", MERGE_CONE, results, "base", String(n), out, "mainsha"], { encoding: "utf-8" });
    return { status: r.status, stdout: r.stdout, file: existsSync(out) ? JSON.parse(readFileSync(out, "utf-8")) : undefined };
  };
  const rec = { sha: "s", base: "fp", reads: {}, git: {} };

  test("the shards' records joined, in ci-cone.ts's records.json shape, at this run's sha", () => {
    const r = run(shards({ version: 2, recipe: 1, checks: { a: rec } }, { version: 2, recipe: 1, checks: { b: rec } }), 2);
    expect(r.status).toBe(0);
    expect(r.file).toEqual({ version: 2, recipe: 1, sha: "mainsha", checks: { a: rec, b: rec } });
  });

  test("a missing shard is left out with a warning: its gates have no record, so they run", () => {
    const r = run(shards({ version: 2, recipe: 1, checks: { a: rec } }, undefined), 2);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("::warning::");
    expect(Object.keys(r.file.checks)).toEqual(["a"]);
  });

  test("two shards recording one script, or disagreeing on the version, keep nothing", () => {
    expect(run(shards({ version: 2, recipe: 1, checks: { a: rec } }, { version: 2, recipe: 1, checks: { a: rec } }), 2)).toMatchObject({ status: 2, file: undefined });
    expect(run(shards({ version: 2, recipe: 1, checks: { a: rec } }, { version: 3, recipe: 1, checks: { b: rec } }), 2)).toMatchObject({ status: 2, file: undefined });
  });

  test("no records anywhere keeps nothing", () => {
    expect(run(shards({ version: 2, recipe: 1, checks: {} }), 1)).toMatchObject({ status: 0, file: undefined });
  });
});

describe("merge-results.py: the shards' result stores, unioned, newest 16 per gate", () => {
  const MERGE_RESULTS = join(DIR, "merge-results.py");
  // The stores are written by result-store.ts itself, so the union is tested on the real shape.
  const store = async () => await import("../scripts/result-store.ts");

  test("two shards' stores union into one, an entry both carried is kept once, and ci-cone.ts reads it back", async () => {
    const { listResults, putResult } = await store();
    const a = mkdtempSync(join(tmpdir(), "store-a-"));
    const b = mkdtempSync(join(tmpdir(), "store-b-"));
    const put = (root: string, p: string, at: string) => putResult(root, { gate: "x:check", recipe: "r", recordedAt: at, run: at, entry: { reads: { p } } });
    put(a, "1", "2026-11-05T01:00:00Z");
    put(a, "2", "2026-11-05T02:00:00Z");
    put(b, "2", "2026-11-05T02:00:00Z");
    put(b, "3", "2026-11-05T03:00:00Z");
    const out = mkdtempSync(join(tmpdir(), "store-out-"));
    const r = spawnSync("python3", ["-I", "-B", MERGE_RESULTS, join(out, "build", "result-store"), join(a, "build", "result-store"), join(b, "build", "result-store"), join(b, "absent")], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("3 result(s) of 1 gate(s) kept");
    expect(listResults<{ reads: { p: string } }>(out, "x:check", "r").map((e) => e.entry.reads.p)).toEqual(["3", "2", "1"]);
  });

  test("past 16 per gate the oldest go, and an unreadable file is dropped", async () => {
    const { listResults, putResult, gateDir } = await store();
    const a = mkdtempSync(join(tmpdir(), "store-a-"));
    const b = mkdtempSync(join(tmpdir(), "store-b-"));
    for (let i = 0; i < 12; i++) putResult(a, { gate: "x:check", recipe: "r", recordedAt: `2026-11-05T00:00:${String(i).padStart(2, "0")}Z`, run: "a", entry: { i } });
    for (let i = 12; i < 24; i++) putResult(b, { gate: "x:check", recipe: "r", recordedAt: `2026-11-05T00:00:${String(i).padStart(2, "0")}Z`, run: "b", entry: { i } });
    writeFileSync(join(gateDir(b, "x:check"), "junk.json"), "{not json");
    const out = mkdtempSync(join(tmpdir(), "store-out-"));
    const r = spawnSync("python3", ["-I", "-B", MERGE_RESULTS, join(out, "build", "result-store"), join(a, "build", "result-store"), join(b, "build", "result-store")], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    const kept = listResults<{ i: number }>(out, "x:check", "r").map((e) => e.entry.i);
    expect(kept).toHaveLength(16);
    expect(kept[0]).toBe(23);
    expect(kept.at(-1)).toBe(8);
  });
});
