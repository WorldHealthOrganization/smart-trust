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
function runStep(step: Step, env: Record<string, string>, subs: Record<string, string> = {}): { code: number; out: string; summary: string; output: string } {
  const dir = mkdtempSync(join(tmpdir(), "job-graph-"));
  const summary = join(dir, "summary");
  writeFileSync(summary, "");
  const output = join(dir, "output");
  writeFileSync(output, "");
  let script = step.run!;
  for (const [k, v] of Object.entries(subs)) script = script.split(k).join(v);
  const r = spawnSync("bash", ["-c", script], {
    encoding: "utf-8",
    // input-site: env PATH #00552802 — PATH handed to a child process, which decides which binaries it runs
    env: { PATH: process.env.PATH ?? "", GITHUB_STEP_SUMMARY: summary, GITHUB_OUTPUT: output, ...env },
  });
  return { code: r.status ?? -1, out: r.stdout + r.stderr, summary: readFileSync(summary, "utf-8"), output: readFileSync(output, "utf-8") };
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
    // lock-coherence: not when prepare-head's lock step passed, nor on the
    // fast tier, where prepare-head's advisory verdict names a red lock.
    expect(jobs["lock-coherence"]!.if).toContain("needs.prepare-head.outputs.lock-coherence != 'success'");
    expect(jobs["lock-coherence"]!.if).toContain("needs.prepare-head.outputs.full != 'false'");
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

  const red = (r: { code: number; output: string }) => r.code === 0 && r.output.includes("verdict=red");
  const green = (r: { code: number; output: string }) => r.code === 0 && r.output.includes("verdict=green");

  test("fast tier: the typecheck decides, as compare's draft verdict did, and a red is advisory (exit 0, verdict=red)", () => {
    const ok = fast({});
    expect(green(ok)).toBe(true);
    expect(ok.summary).toContain(`### ${FAST}`);
    expect(ok.summary).toContain("fast tier: prepare-head success, typecheck success");
    const tsc = fast({ TYPECHECK: "failure" });
    expect(red(tsc)).toBe(true);
    expect(tsc.out).toContain("::warning title=Fast tier RED (advisory)::fast tier: typecheck failed");
    expect(tsc.summary).toContain("**Verdict: RED (advisory)**");
    expect(fast({ PREPARED: "failure" }).out).toContain("::warning title=Fast tier RED (advisory)::fast tier: the PR side could not be prepared (failure)");
  });

  test("fast tier: a step red under continue-on-error is named from the steps' outcomes", () => {
    const steps = JSON.stringify({
      tier: { outcome: "success" },
      "fa-mount": { outcome: "failure", conclusion: "success" },
      "fa-install": { outcome: "success" },
      "judged-key": { outcome: "failure" }, // never a gate
      tsc: { outcome: "failure" }, // named on its own
    });
    const r = fast({ STEPS: steps });
    expect(red(r)).toBe(true);
    expect(r.out).toContain("the PR side could not be prepared (failure (red: fa-mount))");
    expect(r.out).not.toContain("judged-key");
    expect(green(fast({ STEPS: JSON.stringify({ tier: { outcome: "success" }, "judged-key": { outcome: "failure" } }) }))).toBe(true);
  });

  test("fast tier: a red lock step is reported here, since lock-coherence skips on the fast tier", () => {
    const r = fast({ LOCK: "failure" });
    expect(red(r)).toBe(true);
    expect(r.out).toContain("the lock pins do not agree");
  });

  test("fast tier: a reused or pins-only PR passes with nothing run", () => {
    const reused = fast({ REUSED: "true", REUSED_RUN: "https://example.invalid/run/1", TYPECHECK: "skipped" });
    expect(green(reused)).toBe(true);
    expect(reused.summary).toContain("SKIPPED — already passed as judged in run https://example.invalid/run/1");
    const pins = fast({ SKIP: "true", TYPECHECK: "skipped" });
    expect(green(pins)).toBe(true);
    expect(pins.summary).toContain("changes only the caller's own pins");
  });

  test("fast tier: the quick lane needs its tests and the typecheck", () => {
    expect(green(fast({ QUICK: "true", TESTS: "success" }))).toBe(true);
    expect(fast({ QUICK: "true", TESTS: "success" }).summary).toContain("quick lane: this PR changes only `docs/`");
    expect(red(fast({ QUICK: "true", TESTS: "failure" }))).toBe(true);
    expect(red(fast({ QUICK: "true", TESTS: "success", TYPECHECK: "failure" }))).toBe(true);
  });
});

/**
 * ADVISORY FAST TIER (owner, card 2026-11-18): on a PR without `release` /
 * `ready-to-merge` no job concludes `failure`; the full tier still fails hard.
 */
describe("the advisory fast tier", () => {
  const FAST_COE = "${{ steps.tier.outputs.full == 'false' }}";
  // Steps whose red never failed the job (`continue-on-error: true` before
  // this rule), and the lock step, which the lock-coherence job reports.
  const ALWAYS = new Set(["true", "${{ github.job == 'prepare-head' }}"]);

  test("every prepare-head step after the tier is continue-on-error on the fast tier only", () => {
    const after = head.slice(1, -1);
    expect(after.length).toBeGreaterThan(40);
    for (const s of after) {
      const coe = String(s["continue-on-error"] ?? "");
      expect(coe === FAST_COE || ALWAYS.has(coe), `${s.id ?? s.name}: ${coe}`).toBe(true);
    }
    // The tier step itself and the verdict are never continue-on-error.
    expect(head[0]!["continue-on-error"]).toBeUndefined();
    expect(byName(FAST)["continue-on-error"]).toBeUndefined();
  });

  test("a fast-tier step that can go red has an id, so the verdict can name it", () => {
    for (const s of head.slice(1, -1)) {
      if (String(s["continue-on-error"]) === FAST_COE) expect(s.id, s.name ?? s.uses).toBeTruthy();
    }
    expect(byName(FAST).env?.STEPS).toBe("${{ toJSON(steps) }}");
    expect(jobs["prepare-head"]!.outputs!["fast-verdict"]).toBe("${{ steps.fast-verdict.outputs.verdict }}");
  });

  test("the expression is false outside prepare-head's fast tier: the full tier and every other job fail hard", () => {
    // Only prepare-head has a `tier` step, so in prepare-base, run and the
    // shards (which share these steps as YAML aliases) it is never true.
    for (const [name, job] of Object.entries(jobs)) {
      if (name === "prepare-head") continue;
      expect((job.steps ?? []).some((s) => s.id === "tier"), name).toBe(false);
    }
    // compare (the full-tier judge) has no continue-on-error at all.
    for (const s of jobs.compare!.steps ?? []) expect(String(s["continue-on-error"] ?? "")).not.toBe(FAST_COE);
  });

  test("layers-ref waits for the tier and is a warning on the fast tier only", () => {
    const j = jobs["layers-ref"]!;
    expect(j.needs).toEqual(["prepare-head"]);
    expect(j.if).toContain("!cancelled()");
    const step = j.steps!.find((s) => s.name === "Is this lock's layers ref published?")!;
    expect(step.env?.ADVISORY).toBe("${{ needs.prepare-head.outputs.full == 'false' }}");
    expect(step.run).toContain('if [ "$ADVISORY" = "true" ]');
    expect(step.run).toContain('echo "::error::$msg"');
  });
});
