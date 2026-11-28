/**
 * A base without the instance (a downstream base layer's first harness PR, run
 * 44489605227): the PR that first brings an instance into a repository, an
 * instance newly added beside others, or an empty main. Main's side used to
 * be mounted regardless, the swap stopped with `mv: cannot stat
 * 'src/<instance>'`, and "No new failures" then read `results-base-1
 * missing`. Now main's side is EMPTY: nothing is prepared or run for it, and
 * the PR side is judged on its own, so every test and gate on the head must
 * pass outright (a gate's exit 2 included) and nothing is excused as failing
 * on main. A base that has the instance is judged exactly as before.
 *
 * The workflow's own step scripts are read out of `layer-pr-checks.yml` and
 * run here, so the shell under test is the shell the workflow runs.
 *
 * @module test/layer-pr-checks-no-instance-base.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const ROOT = resolve(import.meta.dir, "..");
const WORKFLOW = join(ROOT, ".github", "workflows", "layer-pr-checks.yml");
const SCRIPTS = join(ROOT, ".github", "scripts", "layer-pr-checks");

type Step = { id?: string; name?: string; run?: string; if?: string; env?: Record<string, string> };
type Job = { steps?: Step[]; outputs?: Record<string, string>; strategy?: { matrix?: Record<string, string> } };
const wf = parse(readFileSync(WORKFLOW, "utf-8"), { maxAliasCount: -1 }) as { jobs: Record<string, Job> };

function step(job: string, pick: (s: Step) => boolean): Step {
  const s = (wf.jobs[job]?.steps ?? []).find(pick);
  if (!s?.run) throw new Error(`${job} has no such step`);
  return s;
}

function runScript(script: string, cwd: string, env: Record<string, string>): { status: number; out: string; outputs: Record<string, string> } {
  const output = join(cwd, "github-output");
  writeFileSync(output, "");
  const r = spawnSync("bash", ["-e", "-c", script], {
    cwd,
    encoding: "utf-8",
    env: {
      // input-site: env PATH #34b0985f — PATH handed to a child process, which decides which binaries it runs
      PATH: process.env.PATH ?? "",
      RUNNER_TEMP: cwd,
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: join(cwd, "summary"),
      ...env,
    },
  });
  const outputs: Record<string, string> = {};
  for (const line of readFileSync(output, "utf-8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) outputs[line.slice(0, i)] = line.slice(i + 1);
  }
  return { status: r.status ?? -1, out: r.stdout + r.stderr, outputs };
}

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A caller checkout at a PR's merge commit, whose main has (or lacks) the instance. */
function caller(mainHasInstance: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), "no-instance-base-"));
  const src = join(dir, "src");
  mkdirSync(src);
  git(src, "init", "-q", "-b", "main");
  writeFileSync(join(src, "README.md"), "main\n");
  if (mainHasInstance) {
    mkdirSync(join(src, "demo-layer"));
    writeFileSync(join(src, "demo-layer", "demo-layer.json"), "{}\n");
  }
  git(src, "add", "-A");
  git(src, "commit", "-q", "-m", "main");
  git(src, "checkout", "-q", "-b", "pr");
  mkdirSync(join(src, "demo-layer"), { recursive: true });
  writeFileSync(join(src, "demo-layer", "demo-layer.json"), '{"pr":true}\n');
  git(src, "add", "-A");
  git(src, "commit", "-q", "-m", "pr");
  git(src, "checkout", "-q", "main");
  git(src, "merge", "-q", "--no-ff", "-m", "merge", "pr");
  return dir;
}

describe("the caller's base side finds whether main has the instance", () => {
  const s = step("prepare-base", (x) => x.id === "fa-caller-base");
  const env = { DEFAULT_BRANCH: "main", DIR: "src", SUBDIR: "demo-layer", INSTANCE: "demo-layer" };

  test("main without the instance: absent, and no failure", () => {
    const r = runScript(s.run!, caller(false), env);
    expect(r.status).toBe(0);
    expect(r.outputs.absent).toBe("true");
    expect(r.out).toContain("main's side is empty");
  });

  test("main with the instance: not absent (the normal comparison)", () => {
    const r = runScript(s.run!, caller(true), env);
    expect(r.status).toBe(0);
    expect(r.outputs.absent).toBe("false");
  });

  test("the instance at the repository root (path-in-repo '.')", () => {
    const dir = caller(false);
    const r = runScript(s.run!, dir, { ...env, SUBDIR: "." });
    expect(r.outputs.absent).toBe("true");
  });
});

describe("prepare-base prepares nothing for an empty main, and the shards run the head only", () => {
  test("prepare-base hands `absent` on", () => {
    expect(wf.jobs["prepare-base"]?.outputs?.absent).toContain("fa-caller-base.outputs.absent");
  });

  test("main's answer is neither looked up nor stored for an absent main", () => {
    const steps = wf.jobs["prepare-base"]?.steps ?? [];
    for (const id of ["base-lookup", "stored-lookup"]) expect(steps.find((x) => x.id === id)?.if ?? "").toContain("absent != 'true'");
  });

  test("'Is there anything to prepare?' stops at an absent main", () => {
    const s = step("prepare-base", (x) => x.id === "skip-prep");
    const dir = mkdtempSync(join(tmpdir(), "no-instance-skip-"));
    const r = runScript(s.run!, dir, { ABSENT: "true", PUSH: "false", BASE_HIT: "false", INSTANCE: "demo-layer" });
    expect(r.outputs.hit).toBe("true");
    const normal = runScript(s.run!, dir, { ABSENT: "false", PUSH: "false", BASE_HIT: "false", INSTANCE: "demo-layer" });
    expect(normal.outputs.hit).toBe("false");
  });

  test("the run matrix has no base side when main has no instance", () => {
    expect(wf.jobs.run?.strategy?.matrix?.side).toContain("needs.prepare-base.outputs.absent == 'true'");
  });
});

describe("compare judges the PR side on its own", () => {
  function join_(absent: boolean): string {
    const s = step("compare", (x) => x.id === "join");
    const dir = mkdtempSync(join(tmpdir(), "no-instance-join-"));
    const scripts = join(dir, ".github", "scripts", "layer-pr-checks");
    mkdirSync(scripts, { recursive: true });
    // merge-shards.py stub: one side's joined answer, from a head that has a red gate and a failing test.
    writeFileSync(
      join(scripts, "merge-shards.py"),
      [
        "import os, sys",
        "out = sys.argv[4]",
        "os.makedirs(out, exist_ok=True)",
        "if sys.argv[2] != 'head': sys.exit(2)  # results-base-1 missing",
        "open(os.path.join(out, 'junit.xml'), 'w').write('<testsuites tests=\"2\"><testsuite name=\"a.test.ts\"><testcase name=\"ok\"/><testcase name=\"bad\"><failure/></testcase></testsuite></testsuites>')",
        "open(os.path.join(out, 'gates.json'), 'w').write('{\"x:red\": {\"exit\": 1, \"tail\": \"t\"}, \"x:undetermined\": {\"exit\": 2, \"tail\": \"t\"}, \"x:na\": {\"exit\": 78, \"tail\": \"t\"}}')",
      ].join("\n"),
    );
    const r = runScript(s.run!, dir, {
      N: "1",
      CACHED: "false",
      PUSH: "false",
      PREVIEW: "false",
      ABSENT: absent ? "true" : "false",
      OWN_SHA: "x",
      PIN_AT: "x",
      INDEX: "x",
      LOWER: "",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "o/r",
      GITHUB_RUN_ID: "1",
    });
    if (absent) expect(r.status).toBe(0);
    else expect(r.status).not.toBe(0); // a base that should exist and is missing is still could-not-determine
    return dir;
  }

  test("an empty main side is joined, and never kept as main's answer", () => {
    const dir = join_(true);
    expect(existsSync(join(dir, "merged", "base", "junit.xml"))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "merged", "base", "gates.json"), "utf-8"))).toEqual({});
    expect(existsSync(join(dir, "base-results"))).toBe(false);
    join_(false);
  });

  test("every head failure is new against the empty main", () => {
    const dir = join_(true);
    const py = (script: string, ...args: string[]) =>
      spawnSync("python3", ["-I", "-B", join(SCRIPTS, script), ...args], { cwd: dir, encoding: "utf-8", env: { ...process.env, GITHUB_STEP_SUMMARY: "" } });
    const tests = py("compare-test-failures.py", "merged/base/junit.xml", "merged/head/junit.xml");
    expect(tests.status).toBe(1);
    expect(tests.stdout).toContain("New failures: 1");
    const gates = py("compare-gates.py", "--no-base", "merged/base/gates.json", "merged/head/gates.json");
    expect(gates.status).toBe(1);
    expect(gates.stdout).toContain("`x:red` | — | 1 | NEW FAILURE");
    expect(gates.stdout).toContain("`x:undetermined` | — | 2 | NEW: could not determine");
    expect(gates.stdout).toContain("`x:na` | — | 78 | not applicable here");
  });

  test("the Gates step passes --no-base only when main has no instance", () => {
    const s = step("compare", (x) => x.id === "gates");
    expect(s.env?.NO_BASE).toContain("needs.prepare-base.outputs.absent == 'true' && '--no-base'");
    expect(s.run).toContain("$NO_BASE");
  });
});

describe("compare-gates.py --no-base", () => {
  function compare(head: Record<string, unknown>, base: Record<string, unknown> = {}, noBase = true) {
    const dir = mkdtempSync(join(tmpdir(), "no-base-gates-"));
    writeFileSync(join(dir, "base.json"), JSON.stringify(base));
    writeFileSync(join(dir, "head.json"), JSON.stringify(head));
    return spawnSync("python3", ["-I", "-B", join(SCRIPTS, "compare-gates.py"), ...(noBase ? ["--no-base"] : []), join(dir, "base.json"), join(dir, "head.json")], {
      encoding: "utf-8",
      env: { ...process.env, GITHUB_STEP_SUMMARY: "" },
    });
  }
  const g = (exit: number) => ({ "x:g": { exit, tail: "t" } });

  test("green passes", () => expect(compare(g(0)).status).toBe(0));
  test("red fails", () => expect(compare(g(1)).status).toBe(1));
  test("could not determine (2) fails: nothing is excused", () => expect(compare(g(2)).status).toBe(1));
  test("not applicable (78) is not counted", () => expect(compare(g(78)).status).toBe(0));
  test("a skipped gate is not counted", () => expect(compare({ "x:g": { skipped: "no inputs" } }).status).toBe(0));
  test("a non-empty base with --no-base is could not determine", () => expect(compare(g(0), g(0)).status).toBe(2));

  test("without --no-base the normal comparison is unchanged: 2 on a gate main did not run is not counted", () => {
    expect(compare(g(2), {}, false).status).toBe(0);
  });
  test("without --no-base a gate red on main too is still main's", () => {
    expect(compare(g(1), g(1), false).status).toBe(0);
  });
});
