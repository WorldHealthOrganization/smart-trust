/**
 * Post-merge QA of main: the workflow's own guard keeps an `unknown` verdict
 * from going green while a layer still pins a report.py from before
 * cat-harness-tools#1961 (owner, Q-MQA-1 A, 2026-11-12), EXCEPT an `unknown`
 * that layer-pr-checks marked deferred: a push batched into its window's
 * integration run, or one that changes only pins (Q-MQA-2 A). #1968 had no
 * such exception and turned every batched push red; it was reverted (#1969).
 *
 * The step's script is read out of `layer-main-qa.yml` and run with a stub
 * report.py and a fake `gh` on PATH, so what is tested is the shell the
 * workflow runs, not a copy of it.
 *
 * @module test/layer-main-qa-guard.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const WORKFLOW = resolve(import.meta.dir, "..", ".github", "workflows", "layer-main-qa.yml");
const SHA = "a".repeat(40);

/** The `run:` of the step that keeps the main-red issue in step. */
function stepScript(): string {
  const wf = parse(readFileSync(WORKFLOW, "utf-8")) as { jobs: Record<string, { steps: Array<{ name?: string; run?: string }> }> };
  const step = wf.jobs.report!.steps.find((s) => s.name === "Keep the main-red issue in step with main's verdict");
  if (!step?.run) throw new Error("the report step has no run script");
  return step.run;
}

/** Run the step with report.py exiting `reportExit`, main's head at `head`. */
function run(verdict: string, reportExit: number, head: string, failures = ""): { status: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "main-qa-guard-"));
  const scripts = join(dir, "qa", ".github", "scripts", "layer-main-qa");
  mkdirSync(scripts, { recursive: true });
  // A report.py from before #1961: it prints and exits as told.
  writeFileSync(join(scripts, "report.py"), `import sys\nprint("stub report")\nsys.exit(${reportExit})\n`);
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "gh"),
    ["#!/usr/bin/env bash", 'case "$2" in', '  repos/o/r) echo main ;;', `  repos/o/r/commits/main) echo ${head} ;;`, "  *) exit 1 ;;", "esac"].join("\n"),
  );
  chmodSync(join(bin, "gh"), 0o755);
  const r = spawnSync("bash", ["-e", "-c", stepScript()], {
    cwd: dir,
    encoding: "utf-8",
    // input-site: env PATH #34b0985f — PATH handed to a child process, which decides which binaries it runs
    env: { PATH: `${bin}:${process.env.PATH ?? ""}`, GITHUB_REPOSITORY: "o/r", VERDICT: verdict, FAILURES: failures, SHA },
  });
  return { status: r.status ?? -1, out: r.stdout + r.stderr };
}

describe("layer-main-qa.yml: an unknown verdict is red even with a pinned report.py from before #1961", () => {
  test("unknown on main's head, report.py exits 0: the step is red (2)", () => {
    const r = run("unknown", 0, SHA);
    expect(r.status).toBe(2);
    expect(r.out).toContain("::error::main's verdict");
  });

  test("unknown but DEFERRED (batched, or pins only) on main's head is not a failure (0)", () => {
    const batched = JSON.stringify({ deferred: "batched: this window's integration run (window 4) already started", "judged-by": "the next window's first push" });
    const r = run("unknown", 0, SHA, batched);
    expect(r.status).toBe(0);
    expect(r.out).toContain("is deferred");
    expect(run("unknown", 0, SHA, JSON.stringify({ deferred: "pins-only: this push changes only the caller's pins" })).status).toBe(0);
  });

  test("a pinned report.py from #1961 on exits 2 on every unknown; a DEFERRED one still ends green (two layers' main went red that way, 2026-11-12)", () => {
    const batched = JSON.stringify({ deferred: "batched: this window's integration run (window 9) already started", "judged-by": "the next window's first push" });
    const r = run("unknown", 2, SHA, batched);
    expect(r.status).toBe(0);
    expect(r.out).toContain("is deferred");
    // Not deferred: the pinned report.py's 2 stands.
    expect(run("unknown", 2, SHA, JSON.stringify({ error: "main's answer could not be read" })).status).toBe(2);
  });

  test("unknown with failures that say nothing of deferral, or are not JSON, is still red (2)", () => {
    expect(run("unknown", 0, SHA, JSON.stringify({ error: "main's answer could not be read: base-results/gates.json" })).status).toBe(2);
    expect(run("unknown", 0, SHA, "not json").status).toBe(2);
  });

  test("unknown on a commit main has moved past: left to the newer push (0)", () => {
    expect(run("unknown", 0, "b".repeat(40)).status).toBe(0);
  });

  test("green passes, red stays red, and a report.py that already said 2 keeps it", () => {
    expect(run("green", 0, SHA).status).toBe(0);
    expect(run("red", 1, SHA).status).toBe(1);
    expect(run("unknown", 2, SHA).status).toBe(2);
  });
});
