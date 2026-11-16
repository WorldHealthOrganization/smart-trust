/**
 * Marked ready for review: reuse an earlier run's verdict only on equal inputs
 * (merge manager, 2026-11-07: "same head_sha AND same base.sha", "compare the
 * pins the first run mounted, fall back to the window only when they aren't
 * recorded", "an API error means no reuse").
 *
 * `ready-reuse.py` is driven through python3, as the workflow does, against a
 * stand-in GitHub API served here; the last test checks the workflow's wiring.
 *
 * @module test/layer-ready-reuse.test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const ROOT = resolve(import.meta.dir, "..");
const SCRIPT = join(ROOT, ".github", "scripts", "layer-pr-checks", "ready-reuse.py");
const WORKFLOW = join(ROOT, ".github", "workflows", "layer-pr-checks.yml");

const REPO = "o/r";
const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const MERGE = "c".repeat(40);
const NOW = "2026-11-07T12:00:00Z";
const THIS_RUN = 900;
const WF = 77;
const FULL = "checks / No new failures (tests and gates)";
const DRAFT = "checks / Fast tier only (advisory; the full checks gate a release)";

interface Run { id: number; workflow_id?: number; head_sha?: string; created_at: string; run_started_at?: string; pull_requests?: unknown[] }
interface World {
  runs: Run[];
  jobs: Record<number, { name: string; conclusion: string }[]>;
  artifacts: Record<number, string[]>;
  tree?: string;
  fail?: RegExp;
}

let world: World;
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const u = new URL(req.url);
      const path = u.pathname + u.search;
      if (world.fail?.test(path)) return new Response("{}", { status: 403 });
      const json = (b: unknown) => Response.json(b);
      let m: RegExpMatchArray | null;
      if (u.pathname === `/repos/${REPO}/git/commits/${MERGE}`) {
        return json({ tree: { sha: world.tree ?? "t".repeat(40) }, parents: [{ sha: "p".repeat(40) }, { sha: HEAD }] });
      }
      if (u.pathname === `/repos/${REPO}/actions/runs/${THIS_RUN}`) return json({ id: THIS_RUN, workflow_id: WF });
      if (u.pathname === `/repos/${REPO}/actions/runs`) {
        return json({ workflow_runs: world.runs.filter((r) => r.head_sha === u.searchParams.get("head_sha")) });
      }
      if ((m = u.pathname.match(/\/actions\/runs\/(\d+)\/jobs$/))) return json({ jobs: world.jobs[Number(m[1])] ?? [] });
      if ((m = u.pathname.match(/\/actions\/runs\/(\d+)\/artifacts$/))) {
        return json({ artifacts: (world.artifacts[Number(m[1])] ?? []).map((name) => ({ name })) });
      }
      return new Response("not found", { status: 404 });
    },
  });
});
afterAll(() => server.stop(true));

const d = mkdtempSync(join(tmpdir(), "ready-reuse-"));
const STATE = join(d, "state.json");
writeFileSync(STATE, JSON.stringify({ "o/r": { "cat/r/beans": "1".repeat(40) } }));

async function py(cmd: "key" | "decide", extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const out = join(d, `out-${Math.random()}`);
  const sum = join(d, `sum-${Math.random()}`);
  writeFileSync(out, "");
  writeFileSync(sum, "");
  const p = Bun.spawn(["python3", "-I", "-B", SCRIPT, cmd], {
    env: {
      PATH: process.env.PATH ?? "",
      GITHUB_OUTPUT: out,
      GITHUB_STEP_SUMMARY: sum,
      GITHUB_API_URL: `http://127.0.0.1:${server.port}`,
      REPO, RUN_ID: String(THIS_RUN), HEAD_SHA: HEAD, BASE_SHA: BASE, MERGE_SHA: MERGE,
      INDEX: "i".repeat(40), TOOLS: "s".repeat(40), STATE, MAX_HOURS: "24", NOW,
      ...extra,
    },
    stdout: "pipe", stderr: "pipe",
  });
  const code = await p.exited;
  if (code !== 0) throw new Error(await new Response(p.stderr).text());
  const kv: Record<string, string> = {};
  for (const l of readFileSync(out, "utf-8").split("\n").filter(Boolean)) kv[l.slice(0, l.indexOf("="))] = l.slice(l.indexOf("=") + 1);
  kv.summary = readFileSync(sum, "utf-8");
  return kv;
}

const prs = (base = BASE) => [{ number: 1, base: { sha: base } }];
const run = (id: number, hoursAgo: number, over: Partial<Run> = {}): Run => {
  const t = new Date(Date.parse(NOW) - hoursAgo * 3600e3).toISOString();
  return { id, workflow_id: WF, head_sha: HEAD, created_at: t, run_started_at: t, pull_requests: prs(), ...over };
};

async function keyNow(): Promise<string> {
  world = { runs: [], jobs: {}, artifacts: {} };
  return (await py("key")).key;
}

describe("ready-reuse.py", () => {
  test("key: names the inputs, and changes when any of them does", async () => {
    const k = await keyNow();
    expect(k).toMatch(/^layer-judged-[0-9a-f]{40}$/);
    expect((await py("key", { BASE_SHA: "d".repeat(40) })).key).not.toBe(k);
    expect((await py("key", { INDEX: "j".repeat(40) })).key).not.toBe(k);
    expect((await py("key", { TOOLS: "u".repeat(40) })).key).not.toBe(k);
    expect((await py("key", { STATE: join(d, "absent.json") })).key).not.toBe(k);
    world.tree = "e".repeat(40);
    expect((await py("key")).key).not.toBe(k);
  });

  test("key: an unreadable merge commit records nothing, never a guess", async () => {
    world = { runs: [], jobs: {}, artifacts: {}, fail: /git\/commits/ };
    expect((await py("key")).key).toBe("");
  });

  test("pins: an earlier full-tier pass with the same key is reused", async () => {
    const k = await keyNow();
    world = { runs: [run(800, 30)], jobs: { 800: [{ name: FULL, conclusion: "success" }] }, artifacts: { 800: [k] } };
    const r = await py("decide");
    expect(r.reuse).toBe("true");
    expect(r.how).toBe("pins");
    expect(r.run_id).toBe("800");
    expect(r.key).toBe(k);
    expect(r.summary).toContain("SKIPPED -- already passed as judged in run");
  });

  test("pins: a different key is never reused, however recent", async () => {
    world = { runs: [run(800, 1)], jobs: { 800: [{ name: FULL, conclusion: "success" }] }, artifacts: { 800: ["layer-judged-" + "0".repeat(40)] } };
    expect((await py("decide")).reuse).toBe("false");
  });

  test("a draft's fast tier, or a failed full tier, never counts", async () => {
    const k = await keyNow();
    world = {
      runs: [run(800, 1), run(801, 2)],
      jobs: { 800: [{ name: DRAFT, conclusion: "success" }], 801: [{ name: FULL, conclusion: "failure" }] },
      artifacts: { 800: [k], 801: [k] },
    };
    expect((await py("decide")).reuse).toBe("false");
  });

  test("another workflow's run, or this run itself, never counts", async () => {
    const k = await keyNow();
    world = {
      runs: [run(800, 1, { workflow_id: 5 }), run(THIS_RUN, 0)],
      jobs: { 800: [{ name: FULL, conclusion: "success" }], [THIS_RUN]: [{ name: FULL, conclusion: "success" }] },
      artifacts: { 800: [k], [THIS_RUN]: [k] },
    };
    expect((await py("decide")).reuse).toBe("false");
  });

  test("window: a run with no record counts only with the same base and within record-pin-max-hours", async () => {
    const full = { name: FULL, conclusion: "success" };
    world = { runs: [run(800, 3)], jobs: { 800: [full] }, artifacts: { 800: ["prepared-head"] } };
    const r = await py("decide");
    expect(r.reuse).toBe("true");
    expect(r.how).toBe("window");
    world = { runs: [run(800, 30)], jobs: { 800: [full] }, artifacts: {} };
    expect((await py("decide")).reuse).toBe("false");
    world = { runs: [run(800, 3, { pull_requests: prs("d".repeat(40)) })], jobs: { 800: [full] }, artifacts: {} };
    expect((await py("decide")).reuse).toBe("false");
    world = { runs: [run(800, 3, { pull_requests: [] })], jobs: { 800: [full] }, artifacts: {} };
    expect((await py("decide")).reuse).toBe("false");
  });

  test("an API error is no reuse", async () => {
    const k = await keyNow();
    world = { runs: [run(800, 1)], jobs: { 800: [{ name: FULL, conclusion: "success" }] }, artifacts: { 800: [k] }, fail: /\/jobs/ };
    const r = await py("decide");
    expect(r.reuse).toBe("false");
    expect(r.summary).toContain("Could not determine");
  });
});

describe("the workflow's wiring", () => {
  const wf = parse(readFileSync(WORKFLOW, "utf-8"));
  const jobs = wf.jobs;

  // The "Already judged?" check is a step of prepare-head (owner,
  // 2026-11-13, "A. Collapse into one job"): its own job waited a minute for
  // a runner to run for 9 seconds.
  const head = () => jobs["prepare-head"].steps as { id?: string; name?: string; if?: string; run?: string; env?: Record<string, string> }[];
  const step = (id: string) => head().find((s) => s.id === id)!;

  test("only a ready_for_review PR event asks", () => {
    expect(jobs["ready-reuse"]).toBeUndefined();
    expect(step("decide").name).toBe("Already judged? (marked ready for review)");
    expect(step("decide").if).toContain("github.event.action == 'ready_for_review'");
    expect(step("decide").if).toContain("github.event_name == 'pull_request'");
  });

  test("a reused answer prepares nothing on either side", () => {
    // In prepare-head: the decision sets REUSED, and every preparing step
    // reads skip-prep, which a reused run hits.
    expect(step("decide").run).toContain('echo "REUSED=true" >> "$GITHUB_ENV"');
    expect(step("skip-prep").run).toContain("env.REUSED == 'true'");
    expect(step("judged-key").if).toContain("env.REUSED != 'true'");
    // prepare-base (and with it the shards) is skipped.
    expect(jobs["prepare-base"].needs).toContain("prepare-head");
    expect(jobs["prepare-base"].if).toContain("needs.prepare-head.outputs.reuse != 'true'");
    expect(jobs["prepare-base"].if).toContain("!cancelled()");
    expect(jobs["prepare-head"].outputs.reuse).toBe("${{ steps.decide.outputs.reuse }}");
  });

  test("ready-reuse pins the run as prepare-head does, before deciding", () => {
    const names = head().map((s) => s.id ?? s.name ?? "");
    expect(names.indexOf("pins")).toBeGreaterThan(-1);
    expect(names.indexOf("pins")).toBeLessThan(names.indexOf("decide"));
    expect(step("decide").env!.INDEX).toBe("${{ steps.pins.outputs.index }}");
  });

  test("a full-tier PR run records its key; compare reports the reuse under the full verdict's name", () => {
    const key = step("judged-key");
    expect(key.if).toContain("github.event_name == 'pull_request'");
    expect(key.if).toContain("env.FULL == 'true'");
    expect(jobs.compare.needs).toContain("prepare-head");
    const pinsOnly = jobs.compare.steps.find((s: { id?: string }) => s.id === "pins-only");
    expect(pinsOnly.env.REUSED).toContain("needs.prepare-head.outputs.reuse == 'true'");
    expect(pinsOnly.run).toContain("SKIPPED — already passed as judged in run");
    // A fast-tier reuse is reported by prepare-head's fast-tier step.
    const fast = head().find((s) => s.name === "Fast tier only (advisory; the full checks gate a release)")!;
    expect(fast.env!.REUSED).toBe("${{ steps.decide.outputs.reuse == 'true' }}");
    expect(fast.run).toContain("SKIPPED — already passed as judged in run");
  });
});
