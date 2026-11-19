/**
 * `merge:watch`'s readings 2–4, its per-PR flags, the runner-relief
 * candidates and its many-repository flags, over a GitHub API stub.
 *
 * The stub answers each `gh api` path with a canned payload shaped like
 * GitHub's (trimmed to the fields the report reads); a path it does not know
 * throws, as `gh` does on a 404.
 */
import { describe, expect, test } from "bun:test";

import {
  formatReport,
  mainReading,
  newFailureCounts,
  ownerReading,
  parseArgs,
  pinChanges,
  prFlags,
  queueReading,
  reliefCandidates,
  supersededBy,
  watchRepo,
  paginate,
  unreadSummary,
  formatQueue,
  queueLabels,
  queueRepo,
  queueUnread,
  QUEUE_LABELS,
  type GitHub,
  type PinChange,
  type WorkflowRun,
} from "../../merge-watch.ts";

const NOW = new Date("2026-11-07T10:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

/** A GitHub API stub: `json` and `text` answer one path, `pages` wraps the answer as one page. */
function stub(routes: Record<string, unknown>): GitHub & { asked: string[] } {
  const asked: string[] = [];
  const get = (path: string) => {
    asked.push(path);
    if (!(path in routes)) throw new Error(`HTTP 404: Not Found (${path})`);
    return routes[path];
  };
  return {
    asked,
    json: <T>(path: string) => get(path) as T,
    pages: <T>(path: string) => [get(path)] as T[],
    text: (path: string) => String(get(path)),
  };
}

const run = (over: Partial<WorkflowRun> & { id: number }): WorkflowRun => ({
  workflow_id: 7,
  check_suite_id: over.id + 1000,
  name: `wf${over.id}`,
  status: "completed",
  conclusion: "success",
  event: "pull_request",
  created_at: minutesAgo(5),
  ...over,
});

describe("Q-PIPE-1 table", () => {
  test("reads the bold line, the details line and a Markdown row", () => {
    expect(newFailureCounts("**New failures: 0** · fixed by this PR: 1")).toEqual([0]);
    expect(newFailureCounts("New failures (fail this check): 3")).toEqual([3]);
    expect(newFailureCounts("| New failures | 2 |")).toEqual([2]);
  });
  test("a judge's name or prose is not a table", () => {
    expect(newFailureCounts("Tests (no new failures)\nNo new failures against main's record")).toEqual([]);
  });
});

describe("reading 2: the runner queue", () => {
  test("counts queued and in-progress runs, by event, with the oldest queued age", () => {
    const q = queueReading(
      [
        run({ id: 1, status: "queued", event: "pull_request", created_at: minutesAgo(70) }),
        run({ id: 2, status: "queued", event: "push", created_at: minutesAgo(10) }),
        run({ id: 3, status: "in_progress", event: "pull_request" }),
        run({ id: 4, status: "waiting", event: "workflow_dispatch", created_at: minutesAgo(3) }),
      ],
      NOW,
    );
    expect(q).toEqual({
      queued: 3,
      inProgress: 1,
      oldestQueuedMinutes: 70,
      byEvent: {
        pull_request: { queued: 1, inProgress: 1 },
        push: { queued: 1, inProgress: 0 },
        workflow_dispatch: { queued: 1, inProgress: 0 },
      },
    });
  });
  test("an empty queue has no oldest age", () => {
    expect(queueReading([], NOW).oldestQueuedMinutes).toBeNull();
  });
});

describe("reading 3: the latest main push", () => {
  test("judges only the newest SHA, each workflow's latest run", () => {
    const runs = [
      run({ id: 10, workflow_id: 1, event: "push", head_sha: "old", conclusion: "failure", created_at: minutesAgo(60) }),
      run({ id: 20, workflow_id: 1, event: "push", head_sha: "new", conclusion: "failure", created_at: minutesAgo(20) }),
      run({ id: 21, workflow_id: 1, event: "push", head_sha: "new", conclusion: "success", created_at: minutesAgo(10) }),
      run({ id: 22, workflow_id: 2, event: "push", head_sha: "new", conclusion: "success", created_at: minutesAgo(20) }),
    ];
    expect(mainReading(runs)).toEqual({ sha: "new", verdict: "green" });
  });
  test("red names the failed workflow; a running one is pending", () => {
    expect(mainReading([run({ id: 1, name: "Main QA", head_sha: "a", conclusion: "failure" })]).verdict).toBe("red: Main QA");
    expect(mainReading([run({ id: 1, name: "Main QA", head_sha: "a", status: "in_progress", conclusion: null })]).verdict).toBe(
      "pending: Main QA",
    );
  });
});

describe("reading 4: the owners", () => {
  test("the later of the owner's last push and last comment; others' comments do not count", () => {
    const o = ownerReading(
      "alice",
      [minutesAgo(300), minutesAgo(200)],
      [
        { login: "alice", at: minutesAgo(90) },
        { login: "bot", at: minutesAgo(1) },
      ],
      NOW,
      2,
    );
    expect(o).toMatchObject({ owner: "alice", lastPush: minutesAgo(200), lastComment: minutesAgo(90), idleHours: 1, stale: false });
  });
  test("two hours of silence is stale", () => {
    expect(ownerReading("alice", [minutesAgo(130)], [], NOW, 2).stale).toBe(true);
  });
});

describe("per-PR flags", () => {
  const smart: PinChange = { instance: "smart-base", repository: "WorldHealthOrganization/smart-base", sha: "b", from: "a" };
  test("a workflow change is a direct merge, even on folio-assistant", () => {
    expect(prFlags({ repo: "litlfred/folio-assistant", files: [".github/workflows/x.yml"], pinChanges: [] })).toEqual([
      "direct-merge (.github/workflows)",
    ]);
  });
  test("folio-assistant without a workflow change takes the merge-train path", () => {
    expect(prFlags({ repo: "litlfred/folio-assistant", files: ["src/a.ts"], pinChanges: [] })).toEqual(["merge-train"]);
    expect(prFlags({ repo: "litlfred/cat-harness", files: ["src/a.ts"], pinChanges: [] })).toEqual([]);
  });
  test("a pin change to an excluded layer needs owner consent", () => {
    expect(prFlags({ repo: "litlfred/cat-harness", files: ["index.lock.json"], pinChanges: [smart] })).toEqual([
      "owner-consent (pins smart-base)",
    ]);
    expect(prFlags({ repo: "litlfred/cat-harness", files: [], pinChanges: [smart] }, ["other"])).toEqual([]);
    expect(prFlags({ repo: "litlfred/cat-harness", files: [], pinChanges: [smart] }, ["smart-base"])).toEqual(["owner-consent (pins smart-base)"]);
    expect(prFlags({ repo: "litlfred/cat-harness", files: [], pinChanges: [{ ...smart, instance: "smartish", repository: "o/smartish" }] })).toEqual([]);
  });
  test("pin changes are the instances whose SHA moved", () => {
    const base = [
      { instance: "a", repository: "o/a", sha: "1" },
      { instance: "b", repository: "o/b", sha: "1" },
    ];
    const head = [
      { instance: "a", repository: "o/a", sha: "1" },
      { instance: "b", repository: "o/b", sha: "2" },
      { instance: "c", repository: "o/c", sha: "9" },
    ];
    expect(pinChanges(base, head)).toEqual([
      { instance: "b", repository: "o/b", sha: "2", from: "1" },
      { instance: "c", repository: "o/c", sha: "9", from: null },
    ]);
  });
  test("superseded: every pin is an ancestor of another PR's pin, and one moved further", () => {
    const pin = (instance: string, sha: string): PinChange => ({ instance, repository: `o/${instance}`, sha, from: "0" });
    const anc = (_r: string, a: string, b: string) => (a === b ? true : a < b);
    const me = { number: 1, pinChanges: [pin("a", "3")] };
    expect(supersededBy(me, [{ number: 2, pinChanges: [pin("a", "5"), pin("b", "1")] }], anc)).toBe(2);
    expect(supersededBy(me, [{ number: 2, pinChanges: [pin("a", "3")] }], anc)).toBeUndefined(); // same pins: a duplicate, not newer
    expect(supersededBy(me, [{ number: 2, pinChanges: [pin("a", "2")] }], anc)).toBeUndefined(); // older
    expect(supersededBy(me, [{ number: 2, pinChanges: [pin("b", "9")] }], anc)).toBeUndefined(); // another layer
    expect(supersededBy(me, [{ number: 2, pinChanges: [pin("a", "5")] }], () => undefined)).toBeUndefined(); // unread never supersedes
  });
});

describe("runner relief", () => {
  const prs = [
    { number: 1, draft: true, labels: [], headSha: "d1", headBranch: "draft-branch" },
    { number: 2, draft: false, labels: ["P3"], headSha: "p3", headBranch: "p3-branch" },
    { number: 3, draft: false, labels: [], headSha: "r3", headBranch: "ready-branch" },
  ];
  test("draft, P3, closed-PR and never-started runs; never a main push or dynamic run, never the canceller", () => {
    const runs = [
      run({ id: 1, status: "in_progress", head_sha: "d1", head_branch: "draft-branch" }),
      run({ id: 2, status: "queued", head_sha: "p3", head_branch: "p3-branch" }),
      run({ id: 3, status: "queued", head_sha: "gone", head_branch: "closed-branch" }),
      run({ id: 4, status: "queued", head_sha: "r3", head_branch: "ready-branch", created_at: minutesAgo(90), run_started_at: null }),
      run({ id: 5, status: "queued", head_sha: "r3", head_branch: "ready-branch", created_at: minutesAgo(5) }),
      run({ id: 6, status: "in_progress", event: "push", head_sha: "m", head_branch: "main", run_started_at: minutesAgo(30) }),
      run({ id: 7, status: "queued", event: "push", head_sha: "m2", head_branch: "main", created_at: minutesAgo(120) }),
      run({ id: 8, status: "completed", head_sha: "d1", head_branch: "draft-branch" }),
      // Live shapes (2026-11-07): GitHub sets run_started_at on a run that is still queued.
      run({ id: 9, status: "queued", head_sha: "r3", head_branch: "ready-branch", created_at: minutesAgo(75), run_started_at: minutesAgo(75) }),
      // CodeQL's "Push on main" is event `dynamic` on main: main's own run.
      run({ id: 10, status: "queued", event: "dynamic", name: "Push on main", head_sha: "m3", head_branch: "main", created_at: minutesAgo(200) }),
      // The canceller of a closed PR's runs, itself queued on that closed PR.
      run({ id: 11, status: "queued", name: "Cancel the runs of a closed PR", path: ".github/workflows/cancel-on-close.yml", head_sha: "gone2", head_branch: "closed-2" }),
    ];
    expect(reliefCandidates(runs, prs, "main", NOW, 60).map((c) => [c.runId, c.reason])).toEqual([
      [1, "draft PR #1"],
      [2, "P3 PR #2"],
      [3, "closed PR (closed-branch)"],
      [4, "queued 90m, never started"],
      [9, "queued 75m, never started"],
    ]);
  });
});

describe("many repositories", () => {
  test("--repo, --repos and --config combine, without duplicates", () => {
    const cli = parseArgs(["--repo", "o/a", "--repos", "o/b, o/a", "--config", "c.json", "--json"], () =>
      JSON.stringify({ repos: ["o/c"], staleHours: 4, queuedMinutes: 30, excludedLayers: ["x"] }),
    );
    expect(cli).toEqual({ repos: ["o/a", "o/b", "o/c"], json: true, queue: false, opts: { staleHours: 4, queuedMinutes: 30, excludedLayers: ["x"] } });
  });
  test("--exclude-layer replaces the default; a bad repo or flag is a usage error", () => {
    expect(parseArgs(["--repo", "o/a", "--exclude-layer", "y"]).opts.excludedLayers).toEqual(["y"]);
    expect(() => parseArgs(["--repo", "nope"])).toThrow("not owner/name");
    expect(() => parseArgs(["--frobnicate"])).toThrow("unknown flag");
    expect(() => parseArgs(["--stale-hours", "x"])).toThrow("needs a number");
  });
});

describe("watchRepo over the stub", () => {
  const R = "litlfred/folio-assistant";
  const lock = (sha: string) => ({
    content: Buffer.from(JSON.stringify({ instances: [{ instance: "smart-base", repository: "https://github.com/o/smart-base", sha }] })).toString(
      "base64",
    ),
    encoding: "base64",
  });
  const head = (n: number) => `h${n}`;
  const pull = (n: number, draft = false, labels: string[] = []) => ({
    number: n,
    draft,
    user: { login: "litlfred" },
    labels: labels.map((name) => ({ name })),
    head: { sha: head(n), ref: `b${n}` },
    base: { sha: "base" },
    mergeable_state: "clean", // printed as served, never judged (bean fx5r)
  });
  const judged = (n: number, newFailures: number) => ({
    [`repos/${R}/commits/${head(n)}/check-runs?per_page=100`]: {
      check_runs: [
        { id: n * 10 + 1, name: "bun test (head, 1/1)", status: "completed", conclusion: "success", check_suite: { id: n }, app: { slug: "github-actions" } },
        { id: n * 10 + 2, name: "Tests (no new failures)", status: "completed", conclusion: "success", check_suite: { id: n }, app: { slug: "github-actions" } },
      ],
    },
    [`repos/${R}/actions/runs?head_sha=${head(n)}&per_page=100`]: {
      workflow_runs: [{ id: n, workflow_id: 1, check_suite_id: n, status: "completed", conclusion: "success", event: "pull_request" }],
    },
    [`repos/${R}/actions/jobs/${n * 10 + 1}/logs`]: `**New failures: ${newFailures}**`,
    [`repos/${R}/actions/jobs/${n * 10 + 2}/logs`]: "**New failures: 0**",
    [`repos/${R}/pulls/${n}/commits?per_page=100`]: [{ commit: { committer: { date: minutesAgo(n === 2 ? 600 : 30) } } }],
    [`repos/${R}/issues/${n}/comments?per_page=100`]: [],
  });
  const api = stub({
    [`repos/${R}`]: { default_branch: "main" },
    [`repos/${R}/actions/runs?branch=main&event=push&per_page=50`]: {
      workflow_runs: [{ id: 900, workflow_id: 5, check_suite_id: 9, name: "Main QA", head_sha: "m", status: "completed", conclusion: "success", event: "push", created_at: minutesAgo(15) }],
    },
    [`repos/${R}/actions/runs?status=queued&per_page=100`]: {
      workflow_runs: [{ id: 950, workflow_id: 1, check_suite_id: 95, name: "PR tests", head_sha: "h3", head_branch: "b3", status: "queued", event: "pull_request", created_at: minutesAgo(80), pull_requests: [{ number: 3 }] }],
    },
    [`repos/${R}/actions/runs?status=in_progress&per_page=100`]: { workflow_runs: [] },
    [`repos/${R}/pulls?state=open&per_page=100`]: [{ number: 1 }, { number: 2 }, { number: 3 }],
    [`repos/${R}/pulls/1`]: pull(1),
    [`repos/${R}/pulls/2`]: pull(2),
    [`repos/${R}/pulls/3`]: pull(3, true),
    ...judged(1, 0),
    ...judged(2, 4),
    [`repos/${R}/commits/${head(3)}/check-runs?per_page=100`]: { check_runs: [] },
    [`repos/${R}/actions/runs?head_sha=${head(3)}&per_page=100`]: { workflow_runs: [] },
    [`repos/${R}/pulls/3/commits?per_page=100`]: [{ commit: { committer: { date: minutesAgo(5) } } }],
    [`repos/${R}/issues/3/comments?per_page=100`]: [],
    [`repos/${R}/pulls/1/files?per_page=100`]: [{ filename: "index.lock.json" }],
    [`repos/${R}/pulls/2/files?per_page=100`]: [{ filename: "index.lock.json" }, { filename: ".github/workflows/ci.yml" }],
    [`repos/${R}/pulls/3/files?per_page=100`]: [{ filename: "src/a.ts" }],
    [`repos/${R}/contents/index.lock.json?ref=base`]: lock("s0"),
    [`repos/${R}/contents/index.lock.json?ref=h1`]: lock("s1"),
    [`repos/${R}/contents/index.lock.json?ref=h2`]: lock("s2"),
    ["repos/o/smart-base/compare/s1...s2"]: { status: "ahead" },
    ["repos/o/smart-base/compare/s2...s1"]: { status: "behind" },
  });
  const report = watchRepo(api, R, { staleHours: 2, queuedMinutes: 60, excludedLayers: ["smart-base"] }, NOW);

  test("reading 1 with the every-judge verdict and the flags", () => {
    expect(report.prs.map((p) => [p.number, p.verdict, p.flags])).toEqual([
      [1, "green", ["merge-train", "owner-consent (pins smart-base)", "superseded by #2"]],
      [2, "red: bun test (head, 1/1) (4 new failures)", ["direct-merge (.github/workflows)", "owner-consent (pins smart-base)"]],
      [3, "draft", ["merge-train"]],
    ]);
  });
  test("readings 2–4 and relief", () => {
    expect(report.main).toEqual({ sha: "m", verdict: "green" });
    expect(report.queue).toMatchObject({ queued: 1, inProgress: 0, oldestQueuedMinutes: 80 });
    expect(report.prs.map((p) => [p.number, p.owner?.stale])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
    expect(report.relief.map((c) => [c.runId, c.reason])).toEqual([[950, "draft PR #3"]]);
    expect(report.errors).toEqual([]);
  });
  test("a draft's logs are never read", () => {
    expect(api.asked.some((p) => p.includes("/jobs/3"))).toBe(false);
  });
  test("the text report names every reading", () => {
    const text = formatReport(report);
    for (const s of ["== litlfred/folio-assistant", "main\tm\tgreen", "queue\tqueued 1", "#2\tready", "STALE", "relief\trun 950"]) {
      expect(text).toContain(s);
    }
  });
  test("an unreadable repository is reported, never red", () => {
    const r = watchRepo(stub({}), "o/x", undefined, NOW);
    expect(r.main.verdict).toBe("unknown: main push runs not read");
    expect(r.queue).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("pagination never follows GitHub's Link header", () => {
  test("asks by page= on the given path, and stops at a short page", () => {
    const asked: string[] = [];
    const full = Array.from({ length: 2 }, (_, i) => ({ id: i }));
    const pages = paginate((p) => {
      asked.push(p);
      return p.endsWith("page=3") ? [{ id: 9 }] : full;
    }, "repos/o/r/pulls/1/commits?per_page=2");
    expect(asked).toEqual([
      "repos/o/r/pulls/1/commits?per_page=2&page=1",
      "repos/o/r/pulls/1/commits?per_page=2&page=2",
      "repos/o/r/pulls/1/commits?per_page=2&page=3",
    ]);
    expect(pages).toHaveLength(3);
    expect(asked.every((p) => !p.startsWith("repositories/"))).toBe(true);
  });
  test("a wrapped page is measured by its array field", () => {
    const asked: string[] = [];
    paginate((p) => {
      asked.push(p);
      return { total_count: 1, check_runs: [{ id: 1 }] };
    }, "repos/o/r/commits/s/check-runs?per_page=100");
    expect(asked).toEqual(["repos/o/r/commits/s/check-runs?per_page=100&page=1"]);
  });
});

describe("exit 2 says why", () => {
  test("names each repository and what of it was not read", () => {
    const report = watchRepo(stub({}), "o/x", undefined, NOW);
    const [line] = unreadSummary([report]);
    expect(line).toStartWith("o/x: ");
    expect(line).toContain("runner queue");
    expect(line).toContain("main verdict");
    expect(unreadSummary([{ ...report, errors: [], queue: queueReading([], NOW), main: { sha: "m", verdict: "green" } }])).toEqual([]);
  });
});

describe("the labelled queue (--queue)", () => {
  const R = "litlfred/cat-harness";
  const green = (n: number) => ({
    [`repos/${R}/commits/h${n}/check-runs?per_page=100`]: {
      check_runs: [{ id: n * 10, name: "bun test (head, 1/1)", status: "completed", conclusion: "success", check_suite: { id: n }, app: { slug: "github-actions" } }],
    },
    [`repos/${R}/actions/runs?head_sha=h${n}&per_page=100`]: {
      workflow_runs: [{ id: n, workflow_id: 1, check_suite_id: n, status: "completed", conclusion: "success", event: "pull_request" }],
    },
    [`repos/${R}/actions/jobs/${n * 10}/logs`]: "**New failures: 0**",
  });
  const listed = (n: number, labels: string[], draft = false) => ({ number: n, title: `PR ${n}`, draft, labels: labels.map((name) => ({ name })), head: { sha: `h${n}` } });
  const routes = {
    [`repos/${R}/pulls?state=open&per_page=100`]: [
      listed(9, ["needs-repin", "ready-to-merge"]),
      listed(4, ["ready-to-merge"]),
      listed(5, ["enhancement"]),
      listed(7, ["needs-repin"]),
    ],
    ...green(4),
    ...green(9),
    [`repos/${R}/commits/h7/check-runs?per_page=100`]: {
      check_runs: [{ id: 70, name: "bun test (head, 1/1)", status: "in_progress", conclusion: null, check_suite: { id: 7 }, app: { slug: "github-actions" } }],
    },
    [`repos/${R}/actions/runs?head_sha=h7&per_page=100`]: { workflow_runs: [] },
  };

  test("the queue labels are ready-to-merge and needs-repin, read in that order", () => {
    expect(QUEUE_LABELS).toEqual(["ready-to-merge", "needs-repin"]);
    expect(queueLabels(["needs-repin", "bug", "ready-to-merge"])).toEqual(["ready-to-merge", "needs-repin"]);
    expect(queueLabels(["bug"])).toEqual([]);
  });

  test("a content PR is never queued, whatever else it carries (owner, 2026-11-15)", () => {
    expect(queueLabels(["ready-to-merge", "content"])).toEqual([]);
    expect(queueLabels(["needs-repin", "release", "content"])).toEqual([]);
  });

  test("lists only labelled open PRs, oldest first, with the verdict on each head and needs-repin flagged", () => {
    const api = stub(routes);
    const q = queueRepo(api, R);
    expect(q.errors).toEqual([]);
    expect(q.prs.map((p) => [p.number, p.labels, p.needsRepin, p.verdict])).toEqual([
      [4, ["ready-to-merge"], false, "green"],
      [7, ["needs-repin"], true, "pending: bun test (head, 1/1)"],
      [9, ["ready-to-merge", "needs-repin"], true, "green"],
    ]);
    // The unlabelled PR's head is never read.
    expect(api.asked.some((p) => p.includes("/h5/") || p.includes("head_sha=h5"))).toBe(false);
  });

  test("the text form names repo#n, the head, the verdict and NEEDS-REPIN; the JSON form carries the same rows", () => {
    const q = queueRepo(stub(routes), R);
    const text = formatQueue([q]).split("\n");
    expect(text[0]).toBe(`${R}#4\th4\tgreen\t-\t-\tPR 4`);
    expect(text[1]).toStartWith(`${R}#7\th7\tpending: `);
    expect(text[1]).toContain("\tNEEDS-REPIN\t");
    const json = JSON.parse(JSON.stringify([q])) as { prs: { number: number; needsRepin: boolean; verdict: string; headSha: string }[] }[];
    expect(json[0]!.prs.map((p) => [p.number, p.needsRepin, p.headSha])).toEqual([
      [4, false, "h4"],
      [7, true, "h7"],
      [9, true, "h9"],
    ]);
  });

  test("an empty queue says so; an unread repository or head is unknown and named for exit 2, never red", () => {
    expect(formatQueue([{ repo: R, prs: [], errors: [] }])).toBe("queue empty: no open PR labelled ready-to-merge or needs-repin");
    const missing = queueRepo(stub({}), "o/x");
    expect(missing.errors[0]).toStartWith("open PRs: ");
    const unjudged = queueRepo(stub({ [`repos/o/y/pulls?state=open&per_page=100`]: [listed(2, ["ready-to-merge"])] }), "o/y");
    expect(unjudged.prs[0]!.verdict).toStartWith("unknown: ");
    expect(queueUnread([missing, unjudged])).toEqual([expect.stringMatching(/^o\/x: open PRs: /), "o/y: #2 verdict"]);
    expect(queueUnread([queueRepo(stub(routes), R)])).toEqual([]);
  });

  test("--queue is a flag of the CLI, beside --json", () => {
    expect(parseArgs(["--queue", "--repo", "o/a", "--json"])).toMatchObject({ queue: true, json: true, repos: ["o/a"] });
    expect(parseArgs(["--repo", "o/a"]).queue).toBe(false);
  });
});
