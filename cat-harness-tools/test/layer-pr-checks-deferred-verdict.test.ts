/**
 * Main's verdict on a push that ran nothing on purpose is DEFERRED, and a
 * push that should have been judged but has no answer fails (owner, Q-MQA-2
 * A+B, 2026-11-12).
 *
 * Release-gated batching (`integration-minutes`) runs main's full suite only
 * on the first push of a window; the rest run nothing, and main-verdict.py,
 * with no gates.json to read, says `unknown`. Before this, every such push
 * and a real hole (a push that should have been judged and kept no answer)
 * both read `unknown`, and both went green. The compare job's two push steps
 * are read out of `layer-pr-checks.yml` and run here with a stub
 * main-verdict.py, so the shell under test is the shell the workflow runs.
 *
 * @module test/layer-pr-checks-deferred-verdict.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const WORKFLOW = resolve(import.meta.dir, "..", ".github", "workflows", "layer-pr-checks.yml");

type Step = { name?: string; run?: string };
function compareStep(name: string): string {
  const wf = parse(readFileSync(WORKFLOW, "utf-8"), { maxAliasCount: -1 }) as { jobs: Record<string, { steps?: Step[] }> };
  const step = (wf.jobs.compare?.steps ?? []).find((s) => s.name === name);
  if (!step?.run) throw new Error(`compare has no step "${name}"`);
  return step.run;
}

/** Run a step's script in a scratch directory; its exit, output and what it wrote to GITHUB_OUTPUT. */
function runStep(script: string, env: Record<string, string>, stubVerdict = "unknown"): { status: number; out: string; outputs: Record<string, string> } {
  const dir = mkdtempSync(join(tmpdir(), "deferred-verdict-"));
  const scripts = join(dir, ".github", "scripts", "layer-pr-checks");
  mkdirSync(scripts, { recursive: true });
  // main-verdict.py as it behaves with no gates.json to read.
  writeFileSync(
    join(scripts, "main-verdict.py"),
    [
      "import json, os",
      "with open(os.environ['GITHUB_OUTPUT'], 'a') as f:",
      `    f.write("verdict=${stubVerdict}\\n")`,
      `    f.write("failures=" + json.dumps({"error": "main's answer could not be read: base-results/gates.json"}) + "\\n")`,
    ].join("\n"),
  );
  const output = join(dir, "github-output");
  writeFileSync(output, "");
  const r = spawnSync("bash", ["-e", "-c", script], {
    cwd: dir,
    encoding: "utf-8",
    env: {
      // input-site: env PATH #34b0985f — PATH handed to a child process, which decides which binaries it runs
      PATH: process.env.PATH ?? "",
      RUNNER_TEMP: dir,
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: join(dir, "summary"),
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

describe("compare, on a push: main's verdict says DEFERRED when nothing ran on purpose (Q-MQA-2 A)", () => {
  const verdictStep = compareStep("Main's own verdict (a push)");

  test("a batched push: unknown, with failures naming the window and who judges it", () => {
    const r = runStep(verdictStep, { JOINED: "false", DEFERRED: "batched", WINDOW: "29634512" });
    expect(r.status).toBe(0);
    expect(r.outputs.verdict).toBe("unknown");
    const f = JSON.parse(r.outputs.failures!) as Record<string, string>;
    expect(f.deferred).toContain("window 29634512");
    expect(f["judged-by"]).toBe("the next window's first push");
  });

  test("a pins-only push: unknown and deferred", () => {
    const r = runStep(verdictStep, { JOINED: "false", DEFERRED: "pins-only", WINDOW: "" });
    expect(JSON.parse(r.outputs.failures!).deferred).toContain("pins-only");
  });

  test("a push that should have been judged: main-verdict.py's own answer, unchanged", () => {
    const r = runStep(verdictStep, { JOINED: "false", DEFERRED: "", WINDOW: "" });
    expect(r.outputs.verdict).toBe("unknown");
    expect(JSON.parse(r.outputs.failures!)).toEqual({ error: "main's answer could not be read: base-results/gates.json" });
  });

  test("a judged push that is green stays green, deferred or not", () => {
    expect(runStep(verdictStep, { JOINED: "true", DEFERRED: "batched", WINDOW: "1" }, "green").outputs.verdict).toBe("green");
  });
});

describe("compare, on a push: one that should have been judged and has no answer fails (Q-MQA-2 B)", () => {
  const guard = compareStep("A push that should have been judged has main's answer");

  test("unknown and not deferred: red, saying could not determine", () => {
    const r = runStep(guard, { VERDICT: "unknown", DEFERRED: "", PREPARED: "true" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("::error::this push should have been judged");
  });

  test("unknown but deferred, or a real verdict: passes", () => {
    expect(runStep(guard, { VERDICT: "unknown", DEFERRED: "batched", PREPARED: "false" }).status).toBe(0);
    expect(runStep(guard, { VERDICT: "unknown", DEFERRED: "pins-only", PREPARED: "false" }).status).toBe(0);
    expect(runStep(guard, { VERDICT: "green", DEFERRED: "", PREPARED: "true" }).status).toBe(0);
    expect(runStep(guard, { VERDICT: "red", DEFERRED: "", PREPARED: "true" }).status).toBe(0);
  });
});

describe("prepare-base says why a push ran nothing", () => {
  test("its skip-prep step writes `deferred`, and the job exposes it with the window", () => {
    const text = readFileSync(WORKFLOW, "utf-8");
    expect(text).toContain("deferred: ${{ steps.skip-prep.outputs.deferred }}");
    expect(text).toContain("window: ${{ steps.integ-bucket.outputs.bucket }}");
    expect(text).toContain('echo "deferred=$deferred" >> "$GITHUB_OUTPUT"');
  });
});
