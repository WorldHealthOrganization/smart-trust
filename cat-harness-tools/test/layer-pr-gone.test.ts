/**
 * A PR run that starts as the PR merges judges nothing, and says so
 * (cat-harness-tools#2391).
 *
 * WHO dth-phc run 44031440302 started at 06:28:15Z; its PR merged at
 * 06:28:16Z. GitHub deleted `refs/pull/3/merge`, the checkout of it failed,
 * and the merged PR was left with red checks that said nothing about it.
 * `pr-gone.py` asks the API whether the PR is still open: gone (merged or
 * closed) skips prepare-head's checkouts and everything after them, and the
 * later jobs report nothing to judge; open, or unread, changes nothing, and a
 * failed checkout of an open PR stays a failure. The script runs here against
 * a stand-in GitHub API; the last tests read the wiring out of the workflow
 * and run the steps' scripts.
 *
 * @module test/layer-pr-gone.test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const ROOT = resolve(import.meta.dir, "..");
const SCRIPT = join(ROOT, ".github", "scripts", "layer-pr-checks", "pr-gone.py");
const WORKFLOW = join(ROOT, ".github", "workflows", "layer-pr-checks.yml");
const REPO = "o/r";
// input-site: env PATH #49673533 — PATH handed to a child process, which decides which binaries it runs
const PATH = process.env.PATH ?? "";

/** PR number -> the API's answer; absent is a 404, `fail` a 500. */
const PRS: Record<string, unknown> = {
  "1": { number: 1, state: "open", merged: false, merged_at: null },
  "2": { number: 2, state: "closed", merged: true, merged_at: "2026-11-17T06:28:16Z" },
  "3": { number: 3, state: "closed", merged: false, merged_at: null },
  "4": "fail",
};
let server: ReturnType<typeof Bun.serve>;
let lastAuth: string | null = null;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const m = new URL(req.url).pathname.match(new RegExp(`^/repos/${REPO}/pulls/(\\d+)$`));
      const body = m ? PRS[m[1]!] : undefined;
      lastAuth = req.headers.get("authorization");
      if (body === "fail") return new Response("boom", { status: 500 });
      return body ? Response.json(body) : new Response("not found", { status: 404 });
    },
  });
});
afterAll(() => server.stop(true));

interface Result { code: number; stdout: string; output: Record<string, string>; env: string; summary: string }

function files(): { out: string; env: string; sum: string } {
  const d = mkdtempSync(join(tmpdir(), "pr-gone-"));
  const f = { out: join(d, "out"), env: join(d, "env"), sum: join(d, "sum") };
  for (const p of Object.values(f)) writeFileSync(p, "");
  return f;
}

function kv(text: string): Record<string, string> {
  return Object.fromEntries(text.trim().split("\n").filter(Boolean).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
}

/** Run the script; asynchronously, so the stand-in API in this process can answer. */
async function run(pr: string, late = false, api = `http://127.0.0.1:${server.port}`): Promise<Result> {
  const f = files();
  const p = Bun.spawn(["python3", "-I", "-B", SCRIPT, ...(late ? ["--late"] : [])], {
    env: { PATH, GITHUB_API_URL: api, GH_TOKEN: "tok", REPO, PR: pr, GITHUB_OUTPUT: f.out, GITHUB_ENV: f.env, GITHUB_STEP_SUMMARY: f.sum },
    stdout: "pipe", stderr: "pipe",
  });
  const stdout = await new Response(p.stdout).text();
  const code = await p.exited;
  return { code, stdout, output: kv(readFileSync(f.out, "utf-8")), env: readFileSync(f.env, "utf-8"), summary: readFileSync(f.sum, "utf-8") };
}

describe("pr-gone.py", () => {
  test("an open PR is not gone, and the run goes on", async () => {
    const r = await run("1");
    expect(r.code).toBe(0);
    expect(r.output).toEqual({ gone: "false", state: "open" });
    expect(r.env).toBe("");
    expect(lastAuth).toBe("Bearer tok");
  });

  test("a merged PR is gone: GONE is set and a notice says there is nothing to judge", async () => {
    const r = await run("2");
    expect(r.code).toBe(0);
    expect(r.output).toEqual({ gone: "true", state: "merged" });
    expect(r.env).toBe("GONE=true\n");
    expect(r.stdout).toContain("::notice title=Nothing to judge::PR #2 was merged as this run started");
    expect(r.summary).toContain("Is the PR still open? No, merged");
  });

  test("a closed, unmerged PR is gone too", async () => {
    expect((await run("3")).output).toEqual({ gone: "true", state: "closed" });
  });

  test("a PR that cannot be read is taken as open, never as gone", async () => {
    for (const pr of ["4", "99"]) {
      const r = await run(pr);
      expect(r.code).toBe(0);
      expect(r.output).toEqual({ gone: "false", state: "unknown" });
      expect(r.env).toBe("");
    }
    expect((await run("2", false, "http://127.0.0.1:1")).output.gone).toBe("false");
  });

  test("--late: gone exits 0; open or unread keeps the failed checkout a failure", async () => {
    expect((await run("2", true)).code).toBe(0);
    const open = await run("1", true);
    expect(open.code).toBe(1);
    expect(open.stdout).toContain("::error::the merge ref of PR #1 could not be checked out, and the PR is still open");
    const unread = await run("4", true);
    expect(unread.code).toBe(1);
    expect(unread.stdout).toContain("could not be read");
  });
});

describe("the workflow's wiring", () => {
  type Step = { id?: string; name?: string; if?: string; run?: string; env?: Record<string, string>; "continue-on-error"?: unknown };
  const wf = parse(readFileSync(WORKFLOW, "utf-8"), { maxAliasCount: -1 }) as { jobs: Record<string, { if?: string; outputs?: Record<string, string>; steps: Step[] }> };
  const jobs = wf.jobs;
  const head = jobs["prepare-head"]!.steps;
  const at = (id: string) => head.findIndex((s) => s.id === id);
  const step = (id: string) => head[at(id)]!;

  test("prepare-head asks before its checkout, and again only when a checkout of the PR side failed", () => {
    expect(at("pr-open")).toBeGreaterThan(at("fa-judging-scripts"));
    expect(at("pr-open")).toBeLessThan(at("fa-checkout-index"));
    expect(step("pr-open").if).toContain("github.event_name == 'pull_request'");
    expect(step("pr-open")["continue-on-error"]).toBe(true);
    expect(step("pr-open").run).toContain("ci/.github/scripts/layer-pr-checks/pr-gone.py");
    expect(at("pr-open-late")).toBeGreaterThan(at("fa-caller"));
    expect(at("pr-open-late")).toBeLessThan(at("skip-prep"));
    expect(step("pr-open-late").if).toContain("steps.fa-checkout-index.outcome == 'failure'");
    expect(step("pr-open-late").if).toContain("steps.fa-caller.outcome == 'failure'");
    expect(step("pr-open-late").run).toContain('"$script" --late');
    // A full-tier failure of the late step fails the job, as the checkout did.
    expect(step("pr-open-late")["continue-on-error"]).toBe("${{ steps.tier.outputs.full == 'false' }}");
  });

  test("gone skips the checkouts and every prepared step after them", () => {
    for (const id of ["fa-checkout-index", "fa-caller", "lock-only", "quick"]) expect(step(id).if).toContain("env.GONE != 'true'");
    expect(step("skip-prep").run).toContain("env.GONE == 'true'");
    // Every step after skip-prep has a condition, so `hit` skips the preparation.
    for (const s of head.slice(at("skip-prep") + 1)) expect(s.if, s.name ?? s.id).toBeTruthy();
    expect(jobs["prepare-head"]!.outputs!.gone).toBe("${{ steps.pr-open.outputs.gone == 'true' || steps.pr-open-late.outputs.gone == 'true' }}");
  });

  test("the later jobs judge nothing for a gone PR", () => {
    for (const j of ["prepare-base", "layers-ref", "lock-coherence"]) expect(jobs[j]!.if).toContain("needs.prepare-head.outputs.gone != 'true'");
    const pins = jobs["compare"]!.steps.find((s) => s.id === "pins-only")!;
    expect(pins.env!.GONE).toBe("${{ needs.prepare-head.result == 'success' && needs.prepare-head.outputs.gone == 'true' }}");
    const f = files();
    const r = spawnSync("bash", ["-c", pins.run!], { encoding: "utf-8", env: { PATH, GONE: "true", GITHUB_OUTPUT: f.out, GITHUB_STEP_SUMMARY: f.sum } });
    expect(r.status).toBe(0);
    expect(kv(readFileSync(f.out, "utf-8"))).toEqual({ only: "true" });
    expect(readFileSync(f.sum, "utf-8")).toContain("nothing to judge");
  });

  test("the fast tier's advisory verdict is green, and says why, for a gone PR", () => {
    const fast = head.find((s) => s.id === "fast-verdict")!;
    const f = files();
    const r = spawnSync("bash", ["-c", fast.run!], {
      encoding: "utf-8",
      // A failed checkout is in the steps; gone still judges nothing.
      env: { PATH, GONE: "true", STATE: "merged", PREPARED: "success", STEPS: JSON.stringify({ "fa-checkout-index": { outcome: "failure" } }), GITHUB_OUTPUT: f.out, GITHUB_STEP_SUMMARY: f.sum },
    });
    expect(r.status).toBe(0);
    expect(kv(readFileSync(f.out, "utf-8"))).toEqual({ verdict: "green" });
    expect(readFileSync(f.sum, "utf-8")).toContain("SKIPPED — the PR was merged as this run started");
  });
});
