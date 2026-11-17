/**
 * `ci:job-shape`: per job, the median runner wait and run time, and the two
 * flags (owner, 2026-11-13: "updates skills and processes to see when need
 * to do so").
 *
 * The main fixture is the shape of folio-assistant-core run 43493373385, the
 * run that started this: five serial jobs, four of them light, each waiting
 * longer for a runner than it ran.
 */
import { describe, expect, test } from "bun:test";

import type { GitHub } from "../../merge-watch.ts";
import { exitCode, jobKey, longestShortChain, main, median, parseArgs, repoShape, samplesOf, workflowShape, type ApiJob } from "../../ci-job-shape.ts";

const T0 = Date.parse("2026-11-13T10:00:00Z");
const at = (s: number) => new Date(T0 + s * 1000).toISOString();
/** A job created at `c` seconds, that waited `q` and ran `r`. */
const job = (id: number, name: string, c: number, q: number, r: number, conclusion = "success"): ApiJob => ({
  id,
  name,
  conclusion,
  created_at: at(c),
  started_at: at(c + q),
  completed_at: at(c + q + r),
});

/** Run 43493373385's shape: the lock in parallel, then tier → ready-reuse → prepare-head → summary. */
function before(offset = 0): ApiJob[] {
  const o = offset;
  return [
    job(1, "checks / Lock pins agree with each other and are at main", o + 0, 569, 9),
    job(2, "checks / Which tier (the PR's live labels)", o + 0, 105, 3),
    job(3, "checks / Already judged? (marked ready for review)", o + 108, 60, 9),
    job(4, "checks / Prepare the PR side (and typecheck)", o + 177, 223, 131),
    job(5, "checks / Fast tier only (advisory; the full checks gate a release)", o + 531, 262, 5),
    job(6, "checks / No new failures (tests and gates)", o + 0, 0, 0, "skipped"),
  ];
}

/** The same run after the collapse: one job. */
function after(): ApiJob[] {
  return [job(1, "checks / Prepare the PR side (and typecheck)", 0, 223, 150)];
}

describe("ci:job-shape", () => {
  test("a matrix's shards are one job, and skipped or never-started jobs are left out", () => {
    expect(jobKey("checks / head — tests and gates, shard 3/4")).toBe("checks / head — tests and gates, shard */4");
    expect(jobKey("bun test (head, 2/4)")).toBe("bun test (head, */4)");
    expect(jobKey("Typecheck")).toBe("Typecheck");
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
    const never: ApiJob = { id: 9, name: "x", conclusion: "cancelled", created_at: at(0), started_at: null, completed_at: at(5) };
    expect(samplesOf([...before(), never]).map((s) => s.key)).not.toContain("x");
    expect(samplesOf(before())).toHaveLength(5);
  });

  test("run 43493373385's shape: every job waited longer than it ran; its short jobs never ran three in a row", () => {
    const w = workflowShape("PR checks", ".github/workflows/pr-checks.yml", [before(0), before(3600), before(7200)]);
    expect(w.runs).toBe(3);
    expect(w.jobs).toHaveLength(5);
    expect(w.jobs.every((j) => j.queueExceedsRun)).toBe(true);
    const lock = w.jobs.find((j) => j.job.startsWith("checks / Lock pins"))!;
    expect(lock.medianQueueSeconds).toBe(569);
    expect(lock.medianRunSeconds).toBe(9);
    expect(w.jobs[0]!.job).toBe(lock.job); // the worst queue-over-run first
    // tier → ready-reuse is short, prepare-head runs 2m11s, then the summary: no chain of 3.
    expect(longestShortChain(samplesOf(before()))).toHaveLength(2);
    expect(w.shortChains).toEqual([]);
    expect(w.flags.filter((f) => f.startsWith("queue-exceeds-run: "))).toHaveLength(5);
    expect(w.flags[0]).toBe("queue-exceeds-run: checks / Lock pins agree with each other and are at main (median queue 9m29s, run 9s)");
  });

  test("a chain of more than 2 short serial jobs is flagged when it is in half the runs or more", () => {
    // a → b → c, each 10s, each created when the one before completed; d runs alongside.
    // In the flat runs all three are created at once.
    const chain = (o: number): ApiJob[] => [job(1, "a", o, 5, 10), job(2, "b", o + 15, 5, 10), job(3, "c", o + 30, 5, 10), job(4, "d", o, 5, 10)];
    expect(longestShortChain(samplesOf(chain(0)))).toEqual(["a", "b", "c"]);
    const flat = (o: number): ApiJob[] => [job(1, "a", o, 5, 10), job(2, "b", o, 5, 10), job(3, "c", o, 5, 10)];
    const w = workflowShape("w", "w.yml", [chain(0), chain(100), flat(200)]);
    expect(w.shortChains).toEqual([{ jobs: ["a", "b", "c"], runs: 2, of: 3, flagged: true }]);
    expect(w.flags).toContain("short-serial-chain: a → b → c (2 of 3 runs)");
    // One run in three is not the workflow's shape.
    const rare = workflowShape("w", "w.yml", [chain(0), flat(100), flat(200)]);
    expect(rare.shortChains[0]!.flagged).toBe(false);
    expect(rare.flags.some((f) => f.startsWith("short-serial-chain"))).toBe(false);
    // A job of a minute or more breaks the chain.
    expect(longestShortChain(samplesOf([job(1, "a", 0, 5, 10), job(2, "b", 15, 5, 60), job(3, "c", 80, 5, 10)]))).toHaveLength(1);
  });

  test("after the collapse the same workflow is one job, and nothing is flagged when it runs longer than it waits", () => {
    const w = workflowShape("PR checks", "pr-checks.yml", [after(), after()]);
    expect(w.jobs).toHaveLength(1);
    expect(w.jobs[0]!.queueExceedsRun).toBe(true); // 3m43s wait, 2m30s run: still worth knowing
    const fast = workflowShape("PR checks", "pr-checks.yml", [[job(1, "p", 0, 30, 150)]]);
    expect(fast.flags).toEqual([]);
  });

  test("it reads runs and their jobs through the API, groups them by workflow, and prints JSON", () => {
    const asked: string[] = [];
    const api: GitHub = {
      json: <T>(path: string) => {
        asked.push(path);
        return { workflow_runs: [{ id: 11, name: "PR checks", path: ".github/workflows/pr-checks.yml" }, { id: 12, name: "PR checks", path: ".github/workflows/pr-checks.yml" }, { id: 13, name: "Nightly", path: ".github/workflows/nightly.yml" }] } as T;
      },
      pages: <T>(path: string) => {
        asked.push(path);
        if (path.includes("/runs/13/")) return [{ jobs: [job(1, "n", 0, 1, 100)] }] as T[];
        return [{ jobs: before() }] as T[];
      },
      text: () => "",
    };
    const r = repoShape(api, "o/r", { runs: 20, event: "pull_request" });
    expect(asked[0]).toBe("repos/o/r/actions/runs?status=completed&per_page=20&event=pull_request");
    expect(asked).toContain("repos/o/r/actions/runs/11/jobs?per_page=100");
    expect(r.unread).toEqual([]);
    expect(r.workflows.map((w) => [w.workflow, w.runs, w.flags.length > 0])).toEqual([
      ["PR checks", 2, true],
      ["Nightly", 1, false],
    ]);
    expect(exitCode([r])).toBe(1);
    const out: string[] = [];
    const log = console.log;
    console.log = (s: string) => out.push(s);
    try {
      expect(main(["--repo", "o/r", "--json"], api)).toBe(1);
    } finally {
      console.log = log;
    }
    const parsed = JSON.parse(out.join("\n"));
    expect(parsed[0].repo).toBe("o/r");
    expect(parsed[0].workflows[0].jobs[0]).toHaveProperty("medianQueueSeconds");
  });

  test("what cannot be read is exit 2, never a pass; a bad argument is refused", () => {
    const failing: GitHub = {
      json: () => {
        throw new Error("HTTP 403");
      },
      pages: () => [],
      text: () => "",
    };
    const r = repoShape(failing, "o/r", { runs: 5 });
    expect(r.unread).toEqual(["runs of o/r: HTTP 403"]);
    expect(exitCode([r])).toBe(2);
    const halfRead: GitHub = {
      json: <T>() => ({ workflow_runs: [{ id: 1, name: "w", path: "w.yml" }] }) as T,
      pages: () => {
        throw new Error("HTTP 502");
      },
      text: () => "",
    };
    expect(repoShape(halfRead, "o/r", { runs: 5 }).unread).toEqual(["jobs of run 1: HTTP 502"]);
    expect(() => parseArgs(["--repo", "not a repo"])).toThrow("is not owner/name");
    expect(() => parseArgs(["--runs"])).toThrow("needs a value");
    expect(parseArgs(["--repo", "o/r", "--workflow", "pr-checks.yml"]).read).toEqual({ runs: 20, workflow: "pr-checks.yml" });
    expect(exitCode([{ repo: "o/r", workflows: [], unread: [] }])).toBe(0);
  });
});
