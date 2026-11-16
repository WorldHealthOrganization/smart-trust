/**
 * The job graph of `layer-pr-checks.yml` after the owner's 2026-11-13 card
 * "A. Collapse into one job".
 *
 * folio-assistant-core run 43493373385 took 22m58s, of which about 2.5
 * minutes was work. Five serial jobs each queued for a runner:
 *
 * | job                             | queue wait | ran   |
 * |---------------------------------|------------|-------|
 * | Lock pins agree … at main       | 9m29s      | 9s    |
 * | Already judged?                 | ~1m        | 9s    |
 * | Which tier                      | ~1m45s     | 3s    |
 * | Prepare the PR side + typecheck | 3m43s      | 2m11s |
 * | Fast tier summary               | 4m22s      | 5s    |
 *
 * The four light ones are now steps of prepare-head. Each verdict keeps its
 * name, as a step and as a heading in the job summary. The required check
 * "Lock pins agree with each other and are at main" stays a job. It is
 * skipped when prepare-head's step of that name passed, and it runs only to
 * report a failure, or to judge when the step did not run. The full-tier
 * shards and the main-side prepare stay separate jobs, and start after
 * prepare-head.
 *
 * The step scripts are read out of the workflow and run, so what is tested
 * is the shell the workflow runs.
 *
 * @module test/layer-pr-checks-job-graph.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const WORKFLOW = resolve(import.meta.dir, "..", ".github", "workflows", "layer-pr-checks.yml");
type Step = { id?: string; name?: string; if?: string; run?: string; uses?: string; env?: Record<string, string>; "continue-on-error"?: string };
type Job = { name?: string; needs?: string[]; if?: string; outputs?: Record<string, string>; env?: Record<string, string>; steps?: Step[] };
const WF = parse(readFileSync(WORKFLOW, "utf-8"), { maxAliasCount: -1 }) as { jobs: Record<string, Job> };
const jobs = WF.jobs;
const head = jobs["prepare-head"]!.steps!;
const byName = (name: string) => head.find((s) => s.name === name)!;

const LOCK = "Lock pins agree with each other and are at main";
const TIER = "Which tier (the PR's live labels)";
const READY = "Already judged? (marked ready for review)";
const FAST = "Fast tier only (advisory; the full checks gate a release)";

/** Run a step's script; `${{ … }}` in it is replaced from `subs`. */
function runStep(step: Step, env: Record<string, string>, subs: Record<string, string> = {}): { code: number; out: string; summary: string } {
  const dir = mkdtempSync(join(tmpdir(), "job-graph-"));
  const summary = join(dir, "summary");
  writeFileSync(summary, "");
  let script = step.run!;
  for (const [k, v] of Object.entries(subs)) script = script.split(k).join(v);
  const r = spawnSync("bash", ["-c", script], {
    encoding: "utf-8",
    // input-site: env PATH #b146a4ab — PATH handed to a child process, which decides which binaries it runs
    env: { PATH: process.env.PATH ?? "", GITHUB_STEP_SUMMARY: summary, ...env },
  });
  return { code: r.status ?? -1, out: r.stdout + r.stderr, summary: readFileSync(summary, "utf-8") };
}

describe("the job graph", () => {
  test("five jobs before (tier, ready-reuse, lock-coherence, prepare-head, compare on the fast tier), one now", () => {
    expect(Object.keys(jobs).sort()).toEqual(["compare", "layers-ref", "lock-coherence", "prepare-base", "prepare-head", "record-writers", "run"]);
    expect(jobs.tier).toBeUndefined();
    expect(jobs["ready-reuse"]).toBeUndefined();
    expect(jobs["prepare-head"]!.needs).toBeUndefined();
    expect(jobs["prepare-base"]!.needs).toEqual(["prepare-head"]);
    expect(jobs.run!.needs).toEqual(["prepare-head", "prepare-base"]);
    expect(jobs.compare!.needs).toEqual(["prepare-head", "prepare-base", "run"]);
    expect(jobs["lock-coherence"]!.needs).toEqual(["prepare-head"]);
    expect(jobs["record-writers"]!.needs).toEqual(["prepare-base"]);
  });

  test("on a fast-tier PR whose lock step passed, every job after prepare-head is skipped", () => {
    // prepare-base: the full tier or a push only; run needs it to succeed.
    expect(jobs["prepare-base"]!.if).toContain("(github.event_name == 'push' || needs.prepare-head.outputs.full == 'true')");
    expect(jobs.run!.if).toContain("needs.prepare-base.result == 'success'");
    // compare: not when prepare-head decided the fast tier.
    expect(jobs.compare!.if).toContain("needs.prepare-head.outputs.full != 'false'");
    // lock-coherence: not when prepare-head's lock step passed.
    expect(jobs["lock-coherence"]!.if).toContain("needs.prepare-head.outputs.lock-coherence != 'success'");
    expect(jobs["record-writers"]!.if).toContain("github.event_name == 'push'");
  });

  test("prepare-head's outputs carry what the folded jobs handed on", () => {
    const o = jobs["prepare-head"]!.outputs!;
    expect(o.full).toBe("${{ steps.tier.outputs.full }}");
    expect(o.reuse).toBe("${{ steps.decide.outputs.reuse }}");
    expect(o["run-url"]).toBe("${{ steps.decide.outputs.run_url }}");
    expect(o["lock-coherence"]).toBe("${{ steps.lock-coherence.outcome }}");
  });

  test("the folded verdicts are steps in order: tier, lock, then the pins, the reuse decision, and the fast tier last", () => {
    const at = (name: string) => head.findIndex((s) => s.name === name);
    const pins = head.findIndex((s) => s.id === "pins");
    // The tier first: nothing it needs can fail, so the later jobs always learn the tier.
    expect(at(TIER)).toBe(0);
    expect(at(LOCK)).toBeGreaterThan(at(TIER));
    expect(at(LOCK)).toBeLessThan(head.findIndex((s) => s.id === "shards"));
    expect(pins).toBeLessThan(at(READY));
    expect(at(FAST)).toBe(head.length - 1);
    expect(byName(LOCK).id).toBe("lock-coherence");
    expect(byName(TIER).id).toBe("tier");
    expect(byName(READY).id).toBe("decide");
  });

  test("each folded verdict keeps its name as a heading in the job summary", () => {
    for (const name of [LOCK, TIER, READY, FAST]) expect(byName(name).run, name).toContain(`### ${name}`);
  });

  test("the lock step never stops prepare-head, and fails the lock-coherence job", () => {
    expect(byName(LOCK)["continue-on-error"]).toBe("${{ github.job == 'prepare-head' }}");
    const mirror = jobs["lock-coherence"]!;
    expect(mirror.name).toBe(LOCK);
    // The same steps (YAML aliases), after the one that reads prepare-head's verdict.
    const lockSteps = head.slice(head.findIndex((s) => s.uses?.startsWith("actions/checkout@") && s.if === "github.event_name == 'pull_request'"), head.indexOf(byName(LOCK)) + 1);
    expect(lockSteps.length).toBe(3);
    expect(mirror.steps!.slice(1)).toEqual(lockSteps);
  });
});

describe("the folded steps' scripts", () => {
  const mirrorFirst = () => jobs["lock-coherence"]!.steps![0]!;

  test("lock-coherence: a failure in prepare-head fails the job; an unjudged lock is judged here", () => {
    const failed = runStep(mirrorFirst(), { OUTCOME: "failure" });
    expect(failed.code).toBe(1);
    expect(failed.out).toContain(`::error::the step "${LOCK}"`);
    for (const outcome of ["", "cancelled", "skipped"]) {
      const r = runStep(mirrorFirst(), { OUTCOME: outcome });
      expect(r.code, outcome).toBe(0);
      expect(r.out).toContain("judged here");
    }
  });

  const fast = (env: Record<string, string>) =>
    runStep(
      byName(FAST),
      { PREPARED: "success", REUSED: "false", REUSED_RUN: "", SKIP: "false", QUICK: "false", TESTS: "", TYPECHECK: "success", ...env },
      { "${{ inputs.quick-paths }}": "docs/", "${{ inputs.quick-test }}": "test/x.test.ts" },
    );

  test("fast tier: the typecheck decides, as compare's draft verdict did", () => {
    const ok = fast({});
    expect(ok.code).toBe(0);
    expect(ok.summary).toContain(`### ${FAST}`);
    expect(ok.summary).toContain("fast tier: prepare-head success, typecheck success");
    expect(fast({ TYPECHECK: "failure" }).code).toBe(1);
    expect(fast({ PREPARED: "failure" }).out).toContain("::error::fast tier: the PR side could not be prepared (failure)");
  });

  test("fast tier: a reused or pins-only PR passes with nothing run", () => {
    const reused = fast({ REUSED: "true", REUSED_RUN: "https://example.invalid/run/1", TYPECHECK: "skipped" });
    expect(reused.code).toBe(0);
    expect(reused.summary).toContain("SKIPPED — already passed as judged in run https://example.invalid/run/1");
    const pins = fast({ SKIP: "true", TYPECHECK: "skipped" });
    expect(pins.code).toBe(0);
    expect(pins.summary).toContain("changes only the caller's own pins");
  });

  test("fast tier: the quick lane needs its tests and the typecheck", () => {
    expect(fast({ QUICK: "true", TESTS: "success" }).code).toBe(0);
    expect(fast({ QUICK: "true", TESTS: "success" }).summary).toContain("quick lane: this PR changes only `docs/`");
    expect(fast({ QUICK: "true", TESTS: "failure" }).code).toBe(1);
    expect(fast({ QUICK: "true", TESTS: "success", TYPECHECK: "failure" }).code).toBe(1);
  });
});
