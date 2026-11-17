#!/usr/bin/env bun
/**
 * Whether a repository's CI is shaped for a busy runner pool: per workflow
 * and job, the median wait for a runner and the median run time, from the
 * repository's recent completed runs.
 *
 * @module scripts/ci-job-shape
 * @graphNode none — a read-only report over the GitHub Actions API
 * @covers none — a CI-health report: it reads workflow runs, no declared graph
 *
 * Owner, 2026-11-13 ("updates skills and processes to see when need to do
 * so"), after a content-core run (43493373385) took 22m58s for about 2.5
 * minutes of work: five serial jobs each waited 1-9 minutes for a runner and
 * ran for 3 seconds to 2 minutes. The light ones were folded into one job
 * (cat-harness-tools#2119). This report says when another workflow needs the
 * same fix.
 *
 * Per job (a matrix's `shard 2/4` and `(head, 2/4)` collapse to one job):
 *
 * - **queue**: `started_at - created_at`. GitHub creates a job once its
 *   `needs` have finished, so this is the wait for a runner.
 * - **run**: `completed_at - started_at`.
 *
 * Two flags:
 *
 * - `queue-exceeds-run`: the job's median queue wait is longer than its
 *   median run time. Fold it into a neighbour, or make it a step.
 * - `short-serial-chain`: more than 2 jobs that each run under a minute
 *   (`--short-seconds`) and run one after another: each is created when the
 *   one before it completed (within `toleranceSeconds`), so no longer job
 *   ran between them. It is flagged when it appears in at least
 *   half of the sampled runs of its workflow.
 *
 * Skipped jobs take no runner and are left out. A job that never started
 * (cancelled while queued) is left out too.
 *
 *   bun run cat ci:job-shape -- --repo <owner>/<repo> [--runs 20] [--workflow pr-checks.yml] [--event pull_request] [--json]
 *
 * Exit 0: read, nothing flagged; 1: something flagged; 2: something could
 * not be read (never read as a pass). `--json` prints the reports, for the CI
 * health watchdog and merge:watch.
 */
import { ghApi, pageItems, type GitHub } from "./merge-watch.ts";

/** A job as the Actions API returns it (`/actions/runs/{id}/jobs`). */
export interface ApiJob {
  id: number;
  name: string;
  status?: string;
  conclusion?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

/** A workflow run as the Actions API returns it (`/actions/runs`). */
export interface ApiRun {
  id: number;
  name?: string | null;
  path?: string | null;
  event?: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
}

/** One sampled job: the timings this report reads. */
export interface JobSample {
  key: string;
  createdAt: number;
  startedAt: number;
  completedAt: number;
}

export interface JobShape {
  job: string;
  samples: number;
  medianQueueSeconds: number;
  medianRunSeconds: number;
  queueExceedsRun: boolean;
}

export interface ShortChain {
  jobs: string[];
  /** Runs it appeared in, of `of` sampled runs. */
  runs: number;
  of: number;
  flagged: boolean;
}

export interface WorkflowShape {
  workflow: string;
  path: string;
  runs: number;
  jobs: JobShape[];
  shortChains: ShortChain[];
  flags: string[];
}

export interface RepoShape {
  repo: string;
  workflows: WorkflowShape[];
  /** What could not be read; non-empty means exit 2. */
  unread: string[];
}

export interface Options {
  /** A job that runs for less than this is "short" (default 60). */
  shortSeconds: number;
  /** More than this many short serial jobs is a chain to flag (default 2). */
  maxShortChain: number;
  /**
   * A job created within this many seconds of another's completion follows
   * it directly (default 10). GitHub creates a job when its last `needs`
   * completes; one created much later followed something else.
   */
  toleranceSeconds: number;
}

export const DEFAULT_OPTIONS: Options = { shortSeconds: 60, maxShortChain: 2, toleranceSeconds: 10 };

/**
 * A job's name with its matrix position collapsed, so every shard of a
 * family is one job: `shard 2/4` and `shard 3/4` both become `shard ∗/4`
 * (written here with a star-like glyph; the key has an asterisk), and
 * `(head, 2/4)` becomes `(head, ∗/4)`.
 */
export function jobKey(name: string): string {
  return name.replace(/(shard |, )\d+\/(\d+)\b/gi, "$1*/$2");
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** The jobs of one run that took a runner, with their timings; skipped and never-started jobs are left out. */
export function samplesOf(jobs: readonly ApiJob[]): JobSample[] {
  const out: JobSample[] = [];
  for (const j of jobs) {
    if (j.conclusion === "skipped") continue;
    const created = Date.parse(j.created_at ?? "");
    const started = Date.parse(j.started_at ?? "");
    const completed = Date.parse(j.completed_at ?? "");
    if (![created, started, completed].every(Number.isFinite) || completed < started || started < created) continue;
    out.push({ key: jobKey(j.name), createdAt: created, startedAt: started, completedAt: completed });
  }
  return out;
}

/**
 * The longest chain of short jobs in one run, each created when the one
 * before it completed. Empty when no short job ran.
 */
export function longestShortChain(samples: readonly JobSample[], opts: Options = DEFAULT_OPTIONS): string[] {
  const short = samples
    .filter((s) => s.completedAt - s.startedAt < opts.shortSeconds * 1000)
    .sort((a, b) => a.createdAt - b.createdAt || a.completedAt - b.completedAt);
  const best: string[][] = [];
  for (let i = 0; i < short.length; i++) {
    let chain = [short[i]!.key];
    for (let p = 0; p < i; p++) {
      if (Math.abs(short[i]!.createdAt - short[p]!.completedAt) > opts.toleranceSeconds * 1000) continue;
      if (best[p]!.length + 1 > chain.length) chain = [...best[p]!, short[i]!.key];
    }
    best.push(chain);
  }
  return best.reduce<string[]>((a, c) => (c.length > a.length ? c : a), []);
}

/** The shape of one workflow from its sampled runs (each run's jobs). */
export function workflowShape(workflow: string, path: string, runs: readonly (readonly ApiJob[])[], opts: Options = DEFAULT_OPTIONS): WorkflowShape {
  const byKey = new Map<string, { queue: number[]; run: number[] }>();
  const chains = new Map<string, { jobs: string[]; runs: number }>();
  for (const jobs of runs) {
    const samples = samplesOf(jobs);
    for (const s of samples) {
      const e = byKey.get(s.key) ?? { queue: [], run: [] };
      e.queue.push((s.startedAt - s.createdAt) / 1000);
      e.run.push((s.completedAt - s.startedAt) / 1000);
      byKey.set(s.key, e);
    }
    const chain = longestShortChain(samples, opts);
    if (chain.length > opts.maxShortChain) {
      const id = chain.join(" → ");
      const c = chains.get(id) ?? { jobs: chain, runs: 0 };
      c.runs++;
      chains.set(id, c);
    }
  }
  const jobs: JobShape[] = [...byKey.entries()]
    .map(([job, e]) => {
      const q = median(e.queue);
      const r = median(e.run);
      return { job, samples: e.queue.length, medianQueueSeconds: q, medianRunSeconds: r, queueExceedsRun: q > r };
    })
    .sort((a, b) => b.medianQueueSeconds - b.medianRunSeconds - (a.medianQueueSeconds - a.medianRunSeconds) || a.job.localeCompare(b.job));
  const shortChains: ShortChain[] = [...chains.values()]
    .map((c) => ({ jobs: c.jobs, runs: c.runs, of: runs.length, flagged: c.runs * 2 >= runs.length }))
    .sort((a, b) => b.runs - a.runs || b.jobs.length - a.jobs.length);
  const flags = [
    ...jobs.filter((j) => j.queueExceedsRun).map((j) => `queue-exceeds-run: ${j.job} (median queue ${fmt(j.medianQueueSeconds)}, run ${fmt(j.medianRunSeconds)})`),
    ...shortChains.filter((c) => c.flagged).map((c) => `short-serial-chain: ${c.jobs.join(" → ")} (${c.runs} of ${c.of} runs)`),
  ];
  return { workflow, path, runs: runs.length, jobs, shortChains, flags };
}

function fmt(seconds: number): string {
  const s = Math.round(seconds);
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export interface ReadOptions {
  runs: number;
  workflow?: string;
  event?: string;
}

/** Read a repository's recent completed runs and their jobs, and shape them per workflow. */
export function repoShape(api: GitHub, repo: string, read: ReadOptions, opts: Options = DEFAULT_OPTIONS): RepoShape {
  const unread: string[] = [];
  const base = read.workflow ? `repos/${repo}/actions/workflows/${encodeURIComponent(read.workflow)}/runs` : `repos/${repo}/actions/runs`;
  const query = [`status=completed`, `per_page=${Math.min(Math.max(read.runs, 1), 100)}`, ...(read.event ? [`event=${encodeURIComponent(read.event)}`] : [])].join("&");
  let runs: ApiRun[];
  try {
    runs = pageItems(api.json<unknown>(`${base}?${query}`)) as ApiRun[];
  } catch (err: unknown) {
    return { repo, workflows: [], unread: [`runs of ${repo}: ${why(err)}`] };
  }
  const groups = new Map<string, { workflow: string; path: string; jobs: ApiJob[][] }>();
  for (const run of runs.slice(0, read.runs)) {
    let jobs: ApiJob[];
    try {
      jobs = api.pages<unknown>(`repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`).flatMap((p) => pageItems(p) as ApiJob[]);
    } catch (err: unknown) {
      unread.push(`jobs of run ${run.id}: ${why(err)}`);
      continue;
    }
    const path = run.path ?? "";
    const g = groups.get(path || String(run.name)) ?? { workflow: run.name ?? path, path, jobs: [] };
    g.jobs.push(jobs);
    groups.set(path || String(run.name), g);
  }
  const workflows = [...groups.values()].map((g) => workflowShape(g.workflow, g.path, g.jobs, opts)).sort((a, b) => b.flags.length - a.flags.length || a.workflow.localeCompare(b.workflow));
  return { repo, workflows, unread };
}

function why(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function formatReport(r: RepoShape): string {
  const lines = [`${r.repo}`];
  for (const w of r.workflows) {
    lines.push(`  ${w.workflow} (${w.path || "?"}): ${w.runs} run(s)${w.flags.length === 0 ? ", nothing flagged" : ""}`);
    for (const f of w.flags) lines.push(`    FLAG ${f}`);
    for (const j of w.jobs) lines.push(`    ${j.queueExceedsRun ? "!" : " "} ${j.job}: queue ${fmt(j.medianQueueSeconds)}, run ${fmt(j.medianRunSeconds)} (n=${j.samples})`);
  }
  for (const u of r.unread) lines.push(`  UNREAD ${u}`);
  return lines.join("\n");
}

interface Cli {
  repos: string[];
  read: ReadOptions;
  opts: Options;
  json: boolean;
}

export function parseArgs(argv: readonly string[]): Cli {
  const cli: Cli = { repos: [], read: { runs: 20 }, opts: { ...DEFAULT_OPTIONS }, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    const num = (): number => {
      const v = Number(next());
      if (!Number.isFinite(v) || v < 0) throw new Error(`${a} needs a non-negative number`);
      return v;
    };
    if (a === "--repo") cli.repos.push(next());
    else if (a === "--runs") cli.read.runs = num();
    else if (a === "--workflow") cli.read.workflow = next();
    else if (a === "--event") cli.read.event = next();
    else if (a === "--short-seconds") cli.opts.shortSeconds = num();
    else if (a === "--max-short-chain") cli.opts.maxShortChain = num();
    else if (a === "--json") cli.json = true;
    else throw new Error(`unknown argument ${a}`);
  }
  for (const r of cli.repos) if (!/^[\w.-]+\/[\w.-]+$/.test(r)) throw new Error(`--repo ${r} is not owner/name`);
  return cli;
}

/** 0: nothing flagged; 1: something flagged; 2: something could not be read. */
export function exitCode(reports: readonly RepoShape[]): number {
  if (reports.some((r) => r.unread.length > 0)) return 2;
  return reports.some((r) => r.workflows.some((w) => w.flags.length > 0)) ? 1 : 0;
}

export function main(argv: readonly string[], api: GitHub = ghApi): number {
  let cli: Cli;
  try {
    cli = parseArgs(argv);
  } catch (err: unknown) {
    console.error(why(err));
    return 2;
  }
  if (cli.repos.length === 0) {
    console.error("usage: ci:job-shape --repo <owner/name>… [--runs n] [--workflow <file>] [--event <event>] [--short-seconds n] [--max-short-chain n] [--json]");
    return 2;
  }
  const reports = cli.repos.map((repo) => repoShape(api, repo, cli.read, cli.opts));
  if (cli.json) console.log(JSON.stringify(reports, null, 2));
  else console.log(reports.map(formatReport).join("\n\n"));
  return exitCode(reports);
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
