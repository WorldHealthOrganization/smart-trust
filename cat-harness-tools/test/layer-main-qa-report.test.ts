/**
 * Post-merge QA of main: a verdict that could not be determined is never green.
 *
 * `layer-main-qa/report.py` keeps the `main-red` issue in step with main's
 * verdict. When main's answer could not be read (`main-verdict.py` says
 * `unknown`: its gates.json was missing), the run used to exit 0, so main
 * showed a green QA run it never earned. Now it exits 2 while that commit is
 * still main's head, and leaves the issue alone either way. `gh` is a fake on
 * PATH that answers the reads and logs every call.
 *
 * @module test/layer-main-qa-report.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPORT = resolve(import.meta.dir, "..", ".github", "scripts", "layer-main-qa", "report.py");
const SHA = "a".repeat(40);

/** Run report.py with `verdict`, main's head at `head`; its exit and the API paths it called. */
function report(verdict: string, head: string, failures = ""): { status: number; calls: string[]; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "main-qa-report-"));
  const log = join(dir, "calls.log");
  writeFileSync(
    join(dir, "gh"),
    [
      "#!/usr/bin/env python3",
      "import json, sys",
      `open(${JSON.stringify(log)}, "a").write(sys.argv[3] + " " + sys.argv[4] + "\\n")`,
      "path = sys.argv[4]",
      "if path.endswith('/jobs?filter=latest&per_page=100'): print(json.dumps({'jobs': []}))",
      "elif '/actions/runs/' in path: print(json.dumps({'id': 7, 'conclusion': 'success', 'html_url': 'u', 'workflow_id': 1, 'head_branch': 'main', 'created_at': 't'}))",
      `elif path.endswith('/commits/main'): print(json.dumps({'sha': ${JSON.stringify(head)}}))`,
      "elif path == 'repos/o/r': print(json.dumps({'default_branch': 'main'}))",
      "elif 'issues?labels=' in path: print('[]')",
      "else: print('{}')",
    ].join("\n"),
  );
  chmodSync(join(dir, "gh"), 0o755);
  const r = spawnSync("python3", ["-I", "-B", REPORT], {
    encoding: "utf-8",
    env: {
      // input-site: env PATH #34b0985f — PATH handed to a child process, which decides which binaries it runs
      PATH: `${dir}:${process.env.PATH ?? ""}`,
      GITHUB_REPOSITORY: "o/r",
      VERDICT: verdict,
      FAILURES: failures,
      CHECKS_RESULT: "success",
      GATE_RUN_ID: "7",
      SHA,
    },
  });
  let calls: string[] = [];
  try {
    calls = readFileSync(log, "utf-8").trim().split("\n");
  } catch {
    // no call made
  }
  return { status: r.status ?? -1, calls, out: r.stdout + r.stderr };
}

describe("layer-main-qa report.py: could not determine is never green", () => {
  test("an unknown verdict on main's head is red (exit 2), and the issue is not touched", () => {
    const r = report("unknown", SHA, JSON.stringify({ error: "main's answer could not be read: gates.json missing" }));
    expect(r.status).toBe(2);
    expect(r.out).toContain("::error::main's verdict");
    expect(r.out).toContain("gates.json missing");
    expect(r.calls.some((c) => c.startsWith("POST") || c.startsWith("PATCH") || c.includes("issues"))).toBe(false);
  });

  test("a DEFERRED unknown on main's head (a batched or pins-only push) is not a failure (exit 0), and the issue is not touched", () => {
    const r = report("unknown", SHA, JSON.stringify({ deferred: "batched: window 9", "judged-by": "the next window's first push" }));
    expect(r.status).toBe(0);
    expect(r.out).toContain("deferred");
    expect(r.calls.some((c) => c.startsWith("POST") || c.startsWith("PATCH") || c.includes("issues"))).toBe(false);
  });

  test("an unknown verdict on a commit main has moved past is left to the newer push (exit 0)", () => {
    const r = report("unknown", "b".repeat(40));
    expect(r.status).toBe(0);
    expect(r.out).toContain("moved on");
    expect(r.calls.some((c) => c.startsWith("POST") || c.startsWith("PATCH"))).toBe(false);
  });

  test("green on main's head still passes (exit 0)", () => {
    expect(report("green", SHA).status).toBe(0);
  });
});
