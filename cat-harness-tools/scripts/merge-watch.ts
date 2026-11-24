#!/usr/bin/env bun
/**
 * The merge manager's four readings, per repository, with the merge
 * steward's "all green" verdict on each open PR.
 *
 * @module scripts/merge-watch
 * @graphNode none — a read-only report over the GitHub API
 * @covers none — a merge-steward report: it judges open PRs' checks, no declared graph
 *
 * The readings of `merge-manager-watcher` ("What it reads each time"):
 *
 * 1. **The open PRs**, each with rule 1 of §"Merge-sweep rules" applied to its
 *    head SHA, and the per-PR flags below.
 * 2. **The runner queue**: queued and in-progress runs, the oldest queued
 *    run's age, and both counts by event.
 * 3. **The latest main push**: its SHA and the verdict of every workflow run
 *    on it.
 * 4. **The owners**: the last push or comment by each PR's author, flagged
 *    `stale` after `--stale-hours` (default 2) of silence.
 *
 * Then **runner-relief candidates** for the owner's card: runs of draft and
 * P3 PRs, runs of closed PRs, and queued runs that never started. A main push
 * run is never a candidate. This only reports; it never cancels anything.
 *
 * ## The verdict
 *
 * | verdict | meaning |
 * |---|---|
 * | `draft` | the PR is a draft; nothing else is judged |
 * | `pending: <what>` | a check or a workflow run has not finished, or the full tier has not run |
 * | `red: <check names>` | a judge, a check no judge names, or a shard's new-failure table is red |
 * | `green` | every check and run finished, the full tier ran, and it is green as judged |
 * | `unknown: <why>` | the API could not be read; **never shown as red** |
 *
 * ### Every judge (owner ruling, 2026-11-07)
 *
 * An aggregate "No new failures" job covers only the parts it names: the test
 * shards. So, where judges exist:
 *
 * - **every** judge must conclude success;
 * - each test shard's Q-PIPE-1 table (`New failures: N`, in the job log or
 *   step summary) must list 0 new failures — a table listing more is red
 *   even when the job itself is green;
 * - a red shard is excused only when its table was read and lists 0;
 * - any other red check is red: no judge names it.
 *
 * With no judge, every check must conclude success, skipped or neutral, and
 * the full tier must have run: every shard `k/N` of each shard family
 * (`shard 2/4`, or a matrix name such as `bun test (head, 2/4)`).
 *
 * Either way, anything still queued or in progress blocks: a check run, and
 * also a **workflow run** on the head whose checks do not exist yet, such as
 * the second run `ready_for_review` starts.
 *
 * ### Superseded cancelled jobs
 *
 * Check runs are grouped by workflow (through the workflow run that owns
 * their check suite) and job name. A cancelled job is ignored when a later
 * run of the same workflow on the same head has that job; the later one is
 * then judged in its place. A cancelled job with no later run counts as red.
 *
 * ## Per-PR flags
 *
 * | flag | when |
 * |---|---|
 * | `direct-merge (.github/workflows)` | it changes a workflow: the merge needs the workflows permission, not the train |
 * | `merge-train` | a folio-assistant PR with no workflow change: the `merge-train` label path |
 * | `owner-consent (pins <layer>)` | it changes the pin of an excluded layer (by default `smart-*`, the WHO SMART upstream layers the role may not touch) |
 * | `superseded by #N` | every pin it changes is an ancestor of (or equal to) #N's pin of the same layer |
 *
 * Pins are read from `index.lock.json` (or a legacy `*.mount-lock.json`) at
 * the PR's head and base.
 *
 * ## The queue (`--queue`)
 *
 * Only the merge manager merges and re-pins (owner, 2026-11-13,
 * cat-harness#1313). A session tells it a PR is finished by sending
 * `ready:` or `repin+merge:`; an agent that cannot send messages labels its
 * own PR instead, and `--queue` is how the merge manager reads those labels:
 *
 * | label | the PR's own agent says |
 * |---|---|
 * | `ready-to-merge` | it is green; merge it |
 * | `needs-repin` | it is green except the re-pin; re-pin, then merge |
 *
 * `--queue` lists every open PR carrying either label across the repositories
 * named, with the same verdict on its head as above, and flags `needs-repin`.
 * It leaves out every PR labelled `content` (owner, 2026-11-15: "dont include
 * content PRs in the table"): content merges on the owner's approval of its
 * documented review (merge-guard check 9), never from the queue.
 * It only reads. The merge path is `merge:guard --merge`, the merge manager's
 * alone; this report never merges, re-pins or labels anything.
 *
 * Repositories are reported in the order given: name them lowest dependency
 * first, so the report reads in the order the merge manager works
 * (cat-harness merge-manager-watcher §"Merging across dependent
 * repositories", rules 1 and 4).
 *
 * Usage:
 *   bun run cat merge:watch -- --queue --repos litlfred/cat-harness,litlfred/cat-harness-tools --json
 *   bun run cat merge:watch -- --repo litlfred/cat-harness --repo litlfred/cat-harness-tools
 *   bun run cat merge:watch -- --repos litlfred/cat-harness,litlfred/folio-assistant --json
 *   bun run cat merge:watch -- --config merge-watch.json
 *
 * Flags: `--repo <owner/name>` (repeatable) · `--repos a,b` · `--config
 * <file>` (`{"repos": [...], "staleHours": 2, "queuedMinutes": 60,
 * "excludedLayers": ["smart-*"]}`; a trailing `*` matches a prefix) · `--stale-hours <n>` ·
 * `--queued-minutes <n>` (a queued run this old is a relief candidate) ·
 * `--exclude-layer <name>` (repeatable; replaces the default) · `--queue` (the
 * labelled queue instead of the four readings) · `--json`.
 *
 * Exit 0 printed · 2 usage error, or something could not be read (a one-line
 * summary on stderr names each repository and what of it was not read).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { pushRunsVerdict } from "./lib/main-verdict-runs.ts";

export interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  check_suite?: { id: number } | null;
  app?: { slug: string } | null;
}

export interface WorkflowRun {
  id: number;
  workflow_id: number;
  check_suite_id: number;
  name?: string;
  status?: string;
  conclusion?: string | null;
  event?: string;
  head_sha?: string;
  head_branch?: string | null;
  created_at?: string;
  run_started_at?: string | null;
  pull_requests?: { number: number }[] | null;
  /** The workflow file, e.g. `.github/workflows/cancel-on-close.yml`. */
  path?: string;
}

export type Verdict =
  | { kind: "draft" }
  | { kind: "green" }
  | { kind: "pending"; what: string[] }
  | { kind: "red"; checks: string[] }
  | { kind: "unknown"; why: string };

const PASSING = new Set(["success", "skipped", "neutral"]);
const JUDGE = /No new failures/i;
const FAST_TIER = /fast tier only/i;
/** `shard 2/4`, or a matrix name such as `bun test (head, 2/4)`. */
const SHARD = /(?:shard |, )(\d+)\/(\d+)\b/i;

/**
 * A job name GitHub never rendered: its `name:` expression is still the
 * template (`bun test (head, ${{ matrix.shard }}/4)`, or a bare
 * `needs.tier.outputs.full != 'true' && … || …`). A run cancelled before its
 * matrix expanded leaves these behind, and no later job can carry the same
 * name.
 */
export const UNRENDERED = /\$\{\{|(?:^|[\s(/])(?:needs|github|inputs|matrix|steps|env|vars)\.[\w-]+(?:\.[\w-]+)*\s*(?:==|!=|&&|\|\|)/;

/**
 * The checks that count: every run except a cancelled one a later run of the
 * same workflow supersedes. A later run supersedes a cancelled job when it
 * has a job of the same name, when it is still running (it blocks as pending
 * instead), or when the cancelled job's name was never rendered.
 */
export function effectiveChecks(checks: readonly CheckRun[], runs: readonly WorkflowRun[]): CheckRun[] {
  const bySuite = new Map(runs.map((r) => [r.check_suite_id, r]));
  const place = (c: CheckRun): { group: string; order: number } => {
    const suite = c.check_suite?.id;
    const run = suite === undefined ? undefined : bySuite.get(suite);
    if (run) return { group: `wf:${run.workflow_id}`, order: run.id };
    return { group: `app:${c.app?.slug ?? "?"}`, order: suite ?? c.id };
  };
  return checks.filter((c) => {
    if (c.status !== "completed" || c.conclusion !== "cancelled") return true;
    const me = place(c);
    const sameName = checks.some((o) => {
      if (o === c || o.name !== c.name) return false;
      const p = place(o);
      return p.group === me.group && p.order > me.order;
    });
    if (sameName) return false;
    const laterRuns = runs.filter((r) => `wf:${r.workflow_id}` === me.group && r.id > me.order);
    if (laterRuns.some(busy)) return false;
    if (UNRENDERED.test(c.name) && laterRuns.length > 0) return false;
    return true;
  });
}

/** Did the full tier run: a judge, or every shard of each shard family? */
function fullTier(checks: readonly CheckRun[]): boolean {
  if (checks.some((c) => JUDGE.test(c.name))) return true;
  const families = new Map<string, { of: number; seen: Set<number> }>();
  for (const c of checks) {
    const m = SHARD.exec(c.name);
    if (!m) continue;
    const key = c.name.replace(SHARD, "shard");
    const f = families.get(key) ?? { of: Number(m[2]), seen: new Set<number>() };
    f.seen.add(Number(m[1]));
    families.set(key, f);
  }
  if (families.size === 0) return false;
  return [...families.values()].every((f) => f.seen.size >= f.of);
}

/**
 * The new-failure counts a Q-PIPE-1 table states in a job log or step
 * summary: `**New failures: 2**`, `New failures (fail this check): 2`, or a
 * Markdown row `| New failures | 2 |`. Empty when the text holds no table.
 */
export function newFailureCounts(text: string): number[] {
  const out: number[] = [];
  const patterns = [/New failures(?: \(fail this check\))?:\**\s*(\d+)/gi, /\|\s*\**New failures\**\s*\|\s*\**(\d+)\**\s*\|/gi];
  for (const re of patterns) for (const m of text.matchAll(re)) out.push(Number(m[1]));
  return out;
}

/** Is this check a test shard or a judge, whose log the verdict reads? */
export function wantsLog(c: CheckRun): boolean {
  return c.status === "completed" && (SHARD.test(c.name) || JUDGE.test(c.name));
}

/** A workflow run that has not finished: `queued`, `in_progress`, `waiting`, `requested`, `pending`. */
function busy(r: WorkflowRun): boolean {
  return r.status !== undefined && r.status !== "completed";
}

/**
 * Rule 1 of merge-manager-watcher, as a pure function of the PR and what is
 * on its head. `logs` maps a check run's id to its job log (`null`: it could
 * not be read); a check with no entry has no table to judge.
 */
export function verdictOf(
  pr: { draft: boolean },
  checks: readonly CheckRun[],
  runs: readonly WorkflowRun[],
  logs: ReadonlyMap<number, string | null> = new Map(),
): Verdict {
  if (pr.draft) return { kind: "draft" };
  const busyRuns = runs.filter(busy);
  if (checks.length === 0 && busyRuns.length === 0) return { kind: "pending", what: ["no checks"] };
  const live = effectiveChecks(checks, runs);
  const unfinished = [
    ...live.filter((c) => c.status !== "completed").map((c) => c.name),
    ...busyRuns.map((r) => `run ${r.name ?? r.id} (${r.status}${r.event ? `, ${r.event}` : ""})`),
  ];
  const judges = live.filter((c) => JUDGE.test(c.name));
  const failed = (cs: readonly CheckRun[]) => cs.filter((c) => c.status === "completed" && !PASSING.has(c.conclusion ?? ""));

  // A table that lists new failures is red, whatever the job concluded.
  const tableRed: string[] = [];
  const unreadable: string[] = [];
  const counts = new Map<number, number[]>();
  for (const c of live) {
    if (!logs.has(c.id)) continue;
    const log = logs.get(c.id);
    if (log === null || log === undefined) {
      unreadable.push(c.name);
      continue;
    }
    const n = newFailureCounts(log);
    counts.set(c.id, n);
    const worst = Math.max(0, ...n);
    if (worst > 0) tableRed.push(`${c.name} (${worst} new failures)`);
  }

  if (judges.length > 0) {
    const redJudges = failed(judges).map((c) => c.name);
    const otherRed: string[] = [];
    for (const c of failed(live.filter((x) => !JUDGE.test(x.name)))) {
      if (!SHARD.test(c.name)) {
        otherRed.push(c.name); // no judge names it
        continue;
      }
      const n = counts.get(c.id);
      if (n === undefined && unreadable.includes(c.name)) continue; // judged below as unknown
      if (n === undefined || n.length === 0) otherRed.push(`${c.name} (no Q-PIPE-1 table)`);
      else if (n.every((k) => k === 0)) continue; // a red shard with 0 new failures: main's known failures
    }
    const red = uniq([...redJudges, ...otherRed, ...tableRed]);
    if (red.length > 0) return { kind: "red", checks: red };
    if (unfinished.length > 0) return { kind: "pending", what: uniq(unfinished) };
    if (unreadable.length > 0) return { kind: "unknown", why: `log not read: ${uniq(unreadable).join(", ")}` };
    if (judges.some((j) => j.conclusion !== "success")) return { kind: "pending", what: ["full tier (judge did not run)"] };
    return { kind: "green" };
  }

  const red = uniq([...failed(live).map((c) => c.name), ...tableRed]);
  if (red.length > 0) return { kind: "red", checks: red };
  if (unfinished.length > 0) return { kind: "pending", what: uniq(unfinished) };
  if (!fullTier(live)) {
    return { kind: "pending", what: [live.some((c) => FAST_TIER.test(c.name)) ? "fast tier only" : "full tier not run"] };
  }
  if (unreadable.length > 0) return { kind: "unknown", why: `log not read: ${uniq(unreadable).join(", ")}` };
  return { kind: "green" };
}

function uniq(xs: readonly string[]): string[] {
  return [...new Set(xs)];
}

export function formatVerdict(v: Verdict): string {
  switch (v.kind) {
    case "draft":
    case "green":
      return v.kind;
    case "pending":
      return `pending: ${v.what.join(", ")}`;
    case "red":
      return `red: ${v.checks.join(", ")}`;
    case "unknown":
      return `unknown: ${v.why}`;
  }
}

// ── Reading 2: the runner queue ─────────────────────────────────────────

export interface QueueReading {
  queued: number;
  inProgress: number;
  /** Minutes the oldest queued run has waited; null when none is queued. */
  oldestQueuedMinutes: number | null;
  byEvent: Record<string, { queued: number; inProgress: number }>;
}

function minutesSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
}

export function queueReading(runs: readonly WorkflowRun[], now: Date): QueueReading {
  const q: QueueReading = { queued: 0, inProgress: 0, oldestQueuedMinutes: null, byEvent: {} };
  for (const r of runs) {
    const ev = (q.byEvent[r.event ?? "?"] ??= { queued: 0, inProgress: 0 });
    if (r.status === "in_progress") {
      q.inProgress++;
      ev.inProgress++;
    } else if (busy(r)) {
      q.queued++;
      ev.queued++;
      const age = minutesSince(r.created_at, now);
      if (age !== null && (q.oldestQueuedMinutes === null || age > q.oldestQueuedMinutes)) q.oldestQueuedMinutes = age;
    }
  }
  return q;
}

// ── Reading 3: the latest main push ─────────────────────────────────────

export interface MainReading {
  sha: string | null;
  verdict: string;
}

/**
 * The verdict of the newest main push: every workflow's latest push run on
 * that SHA, reduced by `pushRunsVerdict` — the same reading the standing
 * re-pin judges a candidate commit by, so the two never disagree about main
 * (a cancelled run is no verdict, never red).
 */
export function mainReading(pushRuns: readonly WorkflowRun[]): MainReading {
  const withSha = pushRuns.filter((r) => r.head_sha);
  if (withSha.length === 0) return { sha: null, verdict: "pending: no main push run" };
  const newest = [...withSha].sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "") || b.id - a.id)[0];
  const sha = newest.head_sha ?? null;
  const v = pushRunsVerdict(withSha, sha ?? undefined);
  if (v.verdict === "red") return { sha, verdict: `red: ${v.red.join(", ")}` };
  if (v.verdict === "pending") return { sha, verdict: `pending: ${v.pending.join(", ")}` };
  if (v.verdict === "none") return { sha, verdict: "pending: every push run on it was cancelled" };
  return { sha, verdict: "green" };
}

// ── Reading 4: the owners ───────────────────────────────────────────────

export interface OwnerReading {
  owner: string;
  lastPush: string | null;
  lastComment: string | null;
  idleHours: number | null;
  stale: boolean;
}

export function ownerReading(
  owner: string,
  pushDates: readonly (string | null | undefined)[],
  comments: readonly { login: string; at: string }[],
  now: Date,
  staleHours: number,
): OwnerReading {
  const latest = (xs: readonly (string | null | undefined)[]) =>
    xs.filter((x): x is string => !!x).reduce<string | null>((a, b) => (a === null || Date.parse(b) > Date.parse(a) ? b : a), null);
  const lastPush = latest(pushDates);
  const lastComment = latest(comments.filter((c) => c.login === owner).map((c) => c.at));
  const last = latest([lastPush, lastComment]);
  const idleHours = last === null ? null : Math.floor((now.getTime() - Date.parse(last)) / 3_600_000);
  return { owner, lastPush, lastComment, idleHours, stale: idleHours === null || idleHours >= staleHours };
}

// ── Per-PR flags ────────────────────────────────────────────────────────

export interface Pin {
  instance: string;
  repository: string;
  sha: string;
}

export interface PinChange extends Pin {
  from: string | null;
}

/** The WHO SMART upstream layers (merge-manager-watcher §"Safety rules"). A trailing `*` matches a prefix. */
export const DEFAULT_EXCLUDED_LAYERS = ["smart-*"];

/** Does `name` match an excluded-layer entry: exact, or a prefix when the entry ends in `*`? */
export function layerExcluded(name: string, excluded: readonly string[]): boolean {
  return excluded.some((e) => (e.endsWith("*") ? name.startsWith(e.slice(0, -1)) : name === e));
}

const LOCK_FILE = /(^|\/)(index\.lock\.json|[^/]+\.mount-lock\.json)$/;

export function isLockFile(path: string): boolean {
  return LOCK_FILE.test(path);
}

/** The pins a lock's text records. */
export function pinsOf(lockText: string): Pin[] {
  const lock = JSON.parse(lockText) as { instances?: { instance: string; repository: string; sha: string }[] };
  return (lock.instances ?? []).map(({ instance, repository, sha }) => ({ instance, repository, sha }));
}

/** The pins whose SHA differs between base and head (a new pin has `from: null`). */
export function pinChanges(base: readonly Pin[], head: readonly Pin[]): PinChange[] {
  const before = new Map(base.map((p) => [p.instance, p.sha]));
  return head.filter((p) => before.get(p.instance) !== p.sha).map((p) => ({ ...p, from: before.get(p.instance) ?? null }));
}

/** `owner/name` from `owner/name`, `https://github.com/owner/name(.git)` or similar. */
export function repoSlug(repository: string): string {
  return repository.replace(/^.*github\.com[/:]/, "").replace(/\.git$/, "");
}

function layerName(p: Pin): string {
  return repoSlug(p.repository).split("/").pop() ?? p.instance;
}

export function prFlags(
  pr: { repo: string; files: readonly string[]; pinChanges: readonly PinChange[] },
  excludedLayers: readonly string[] = DEFAULT_EXCLUDED_LAYERS,
): string[] {
  const flags: string[] = [];
  const workflows = pr.files.some((f) => f.startsWith(".github/workflows/"));
  if (workflows) flags.push("direct-merge (.github/workflows)");
  else if (pr.repo.split("/").pop() === "folio-assistant") flags.push("merge-train");
  const consent = uniq(
    pr.pinChanges.filter((p) => layerExcluded(p.instance, excludedLayers) || layerExcluded(layerName(p), excludedLayers)).map((p) => p.instance),
  );
  if (consent.length > 0) flags.push(`owner-consent (pins ${consent.join(", ")})`);
  return flags;
}

/**
 * The open PR that supersedes this one: every pin it changes is pinned by the
 * other PR too, at a commit its own is an ancestor of (or equal to), and the
 * other PR moves at least one of them further. `isAncestor(repo, a, b)` is
 * `undefined` when it could not be read, which never supersedes.
 */
export function supersededBy(
  me: { number: number; pinChanges: readonly PinChange[] },
  others: readonly { number: number; pinChanges: readonly PinChange[] }[],
  isAncestor: (repository: string, a: string, b: string) => boolean | undefined,
): number | undefined {
  if (me.pinChanges.length === 0) return undefined;
  for (const o of others) {
    if (o.number === me.number) continue;
    const theirs = new Map(o.pinChanges.map((p) => [p.instance, p.sha]));
    let further = false;
    const covered = me.pinChanges.every((p) => {
      const t = theirs.get(p.instance);
      if (t === undefined) return false;
      if (t === p.sha) return true;
      const anc = isAncestor(repoSlug(p.repository), p.sha, t);
      if (anc === true) further = true;
      return anc === true;
    });
    if (covered && further) return o.number;
  }
  return undefined;
}

/**
 * The pins a PR moves BACKWARDS: each change whose new sha is a strict
 * ancestor of the one it replaces (2026-11-23: a downstream site's standing
 * re-pin PR took a content layer and cat-harness-tools back to ancestors of main's
 * pins). `isAncestor(repo, a, b)` is `undefined` when it could not be read,
 * which never flags. Pure.
 */
export function backwardPins(
  pinChanges: readonly PinChange[],
  isAncestor: (repository: string, a: string, b: string) => boolean | undefined,
): PinChange[] {
  return pinChanges.filter((p) => p.from !== null && p.from !== p.sha && isAncestor(repoSlug(p.repository), p.sha, p.from) === true);
}

// ── Runner relief ───────────────────────────────────────────────────────

export interface ReliefCandidate {
  runId: number;
  name: string;
  event: string;
  status: string;
  reason: string;
}

const P3 = /^(?:priority[:/ ]\s*)?P3$/i;
const PR_EVENTS = new Set(["pull_request", "pull_request_target", "pull_request_review", "pull_request_review_comment"]);
/** Main's own runs: a push, and the `dynamic` runs GitHub starts for a push (CodeQL's "Push on main"). */
const MAIN_EVENTS = new Set(["push", "dynamic"]);
/** The workflow that cancels a closed PR's runs: cancelling it would undo the relief it brings. */
const CANCELLER = /(^|\/)cancel-on-close\.ya?ml$/;

/**
 * The busy runs the owner might cancel to free runners. Never a main push
 * run, started or not, nor the `dynamic` run a push starts: those are main's
 * verdict. Never the canceller itself. Report only.
 *
 * "Never started" reads `status`, not `run_started_at`: GitHub sets
 * `run_started_at` when a run is created, so a run still queued carries one.
 */
export function reliefCandidates(
  runs: readonly WorkflowRun[],
  openPrs: readonly { number: number; draft: boolean; labels: readonly string[]; headSha: string; headBranch: string }[],
  defaultBranch: string,
  now: Date,
  queuedMinutes: number,
): ReliefCandidate[] {
  const out: ReliefCandidate[] = [];
  for (const r of runs.filter(busy)) {
    if (MAIN_EVENTS.has(r.event ?? "") && r.head_branch === defaultBranch) continue;
    if (r.path && CANCELLER.test(r.path)) continue;
    const linked = new Set((r.pull_requests ?? []).map((p) => p.number));
    const pr = openPrs.find((p) => linked.has(p.number) || p.headSha === r.head_sha || (r.head_branch && p.headBranch === r.head_branch));
    let reason: string | undefined;
    if (pr?.draft) reason = `draft PR #${pr.number}`;
    else if (pr && pr.labels.some((l) => P3.test(l))) reason = `P3 PR #${pr.number}`;
    else if (!pr && PR_EVENTS.has(r.event ?? "")) reason = `closed PR (${r.head_branch ?? r.head_sha?.slice(0, 7) ?? "?"})`;
    else if (r.status !== "in_progress") {
      const age = minutesSince(r.created_at, now);
      if (age !== null && age >= queuedMinutes) reason = `queued ${age}m, never started`;
    }
    if (reason) out.push({ runId: r.id, name: r.name ?? String(r.id), event: r.event ?? "?", status: r.status ?? "?", reason });
  }
  return out;
}

// ── I/O ─────────────────────────────────────────────────────────────────

/** What the report reads from GitHub; `gh api` in use, a stub in tests. */
export interface GitHub {
  /** One request, parsed. */
  json<T>(path: string): T;
  /** Every page of a paginated request, parsed, one element per page. */
  pages<T>(path: string): T[];
  /** One request, as text (a job log). */
  text(path: string): string;
}

function gh(args: readonly string[]): string {
  const r = spawnSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || r.error?.message || `gh exited ${r.status}`).trim().split("\n")[0]);
  return r.stdout;
}

/** The items on one page: the array itself, or the first array-valued field (`check_runs`, `workflow_runs`). */
export function pageItems(page: unknown): unknown[] {
  if (Array.isArray(page)) return page;
  if (page && typeof page === "object") {
    for (const v of Object.values(page)) if (Array.isArray(v)) return v;
  }
  return [];
}

/** Hard stop, so a server that ignores `page` cannot loop forever. */
export const MAX_PAGES = 50;

/**
 * Every page of `path`, asked for by `page=N` on the path we were given.
 * `gh api --paginate` follows GitHub's `Link` header instead, whose next URL
 * names the repository by id (`repositories/{id}/…`); the agent proxy refuses
 * those (merge:watch's first live run, 2026-11-13). A page shorter than
 * `per_page` is the last.
 */
export function paginate(get: (path: string) => unknown, path: string): unknown[] {
  const perPage = Number(/[?&]per_page=(\d+)/.exec(path)?.[1] ?? 30);
  const out: unknown[] = [];
  for (let n = 1; n <= MAX_PAGES; n++) {
    const page = get(`${path}${path.includes("?") ? "&" : "?"}page=${n}`);
    out.push(page);
    if (pageItems(page).length < perPage) break;
  }
  return out;
}

export const ghApi: GitHub = {
  json: <T>(path: string) => JSON.parse(gh([path])) as T,
  pages: <T>(path: string) => paginate((p) => JSON.parse(gh([p])), path) as T[],
  text: (path: string) => gh([path]),
};

function flat<T>(pages: readonly unknown[], key?: string): T[] {
  return pages.flatMap((p) => (key ? ((p as Record<string, T[]>)[key] ?? []) : (p as T[])));
}

export interface Options {
  staleHours: number;
  queuedMinutes: number;
  excludedLayers: string[];
}

export const DEFAULT_OPTIONS: Options = { staleHours: 2, queuedMinutes: 60, excludedLayers: DEFAULT_EXCLUDED_LAYERS };

export interface Row {
  repo: string;
  number: number;
  draft: boolean;
  headSha: string;
  mergeableState: string;
  verdict: string;
  flags: string[];
  owner: OwnerReading | null;
}

export interface RepoReport {
  repo: string;
  main: MainReading | { sha: null; verdict: string };
  queue: QueueReading | null;
  prs: Row[];
  relief: ReliefCandidate[];
  errors: string[];
}

interface PullDetail {
  number: number;
  draft: boolean;
  user: { login: string };
  labels: { name: string }[];
  head: { sha: string; ref: string };
  base: { sha: string };
  /** Printed as served, never judged: possibly stale or `unknown` (bean fx5r). */
  mergeable_state: string | null;
}

function why(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function judgeHead(api: GitHub, repo: string, pr: { draft: boolean; head: { sha: string } }): Verdict {
  const sha = pr.head.sha;
  const checks = flat<CheckRun>(api.pages(`repos/${repo}/commits/${sha}/check-runs?per_page=100`), "check_runs");
  const runs = flat<WorkflowRun>(api.pages(`repos/${repo}/actions/runs?head_sha=${sha}&per_page=100`), "workflow_runs");
  const first = verdictOf(pr, checks, runs);
  if (first.kind === "draft" || first.kind === "pending") return first;
  // Only a verdict that could be green or red needs the shards' tables.
  const logs = new Map<number, string | null>();
  for (const c of effectiveChecks(checks, runs).filter(wantsLog)) {
    if (c.app?.slug && c.app.slug !== "github-actions") continue;
    try {
      logs.set(c.id, api.text(`repos/${repo}/actions/jobs/${c.id}/logs`));
    } catch {
      logs.set(c.id, null);
    }
  }
  return verdictOf(pr, checks, runs, logs);
}

function readPins(api: GitHub, repo: string, path: string, ref: string): Pin[] {
  try {
    const f = api.json<{ content?: string; encoding?: string }>(`repos/${repo}/contents/${path}?ref=${ref}`);
    return f.content ? pinsOf(Buffer.from(f.content, (f.encoding as BufferEncoding) ?? "base64").toString("utf8")) : [];
  } catch {
    return []; // absent at that ref
  }
}

/** All four readings and the relief candidates for one repository. */
export function watchRepo(api: GitHub, repo: string, opts: Options = DEFAULT_OPTIONS, now = new Date()): RepoReport {
  const errors: string[] = [];
  const attempt = <T>(what: string, f: () => T, fallback: T): T => {
    try {
      return f();
    } catch (err: unknown) {
      errors.push(`${what}: ${why(err)}`);
      return fallback;
    }
  };

  const defaultBranch = attempt("repo", () => api.json<{ default_branch: string }>(`repos/${repo}`).default_branch, "main");
  const pushRuns = attempt(
    "main push runs",
    () => flat<WorkflowRun>([api.json(`repos/${repo}/actions/runs?branch=${defaultBranch}&event=push&per_page=50`)], "workflow_runs"),
    null,
  );
  const main = pushRuns ? mainReading(pushRuns) : { sha: null, verdict: "unknown: main push runs not read" };

  const busyRuns = attempt(
    "runner queue",
    () =>
      ["queued", "in_progress"].flatMap((s) =>
        flat<WorkflowRun>(api.pages(`repos/${repo}/actions/runs?status=${s}&per_page=100`), "workflow_runs"),
      ),
    null,
  );
  const queue = busyRuns ? queueReading(busyRuns, now) : null;

  const open = attempt("open PRs", () => flat<{ number: number }>(api.pages(`repos/${repo}/pulls?state=open&per_page=100`)), []);
  const details: PullDetail[] = [];
  const prs: Row[] = [];
  const changes = new Map<number, PinChange[]>();
  const files = new Map<number, string[]>();
  for (const { number } of open) {
    let row: Row = { repo, number, draft: false, headSha: "", mergeableState: "?", verdict: "", flags: [], owner: null };
    try {
      // `mergeable_state` is printed as served, never judged: `unknown` means
      // GitHub has not finished computing it, and a merged PR keeps serving
      // its pre-merge value (bean fx5r). The verdict reads the checks only.
      const pr = api.json<PullDetail>(`repos/${repo}/pulls/${number}`);
      details.push(pr);
      // Content PRs are not the merge manager's (owner, 2026-11-15): no row.
      if (pr.labels.some((l) => l.name === CONTENT_LABEL)) continue;
      // mergeable_state: shown as served, never trusted (bean fx5r, above).
      row = { ...row, draft: pr.draft, headSha: pr.head.sha, mergeableState: pr.mergeable_state ?? "unknown" };
      let verdict: Verdict;
      try {
        verdict = judgeHead(api, repo, pr);
      } catch (err: unknown) {
        verdict = { kind: "unknown", why: why(err) };
      }
      row.verdict = formatVerdict(verdict);
      const changed = flat<{ filename: string }>(api.pages(`repos/${repo}/pulls/${number}/files?per_page=100`)).map((f) => f.filename);
      files.set(number, changed);
      const pins = changed
        .filter(isLockFile)
        .flatMap((p) => pinChanges(readPins(api, repo, p, pr.base.sha), readPins(api, repo, p, pr.head.sha)));
      changes.set(number, pins);
      row.flags = prFlags({ repo, files: changed, pinChanges: pins }, opts.excludedLayers);
      const commits = flat<{ commit: { committer: { date: string } | null } }>(api.pages(`repos/${repo}/pulls/${number}/commits?per_page=100`));
      const comments = flat<{ user: { login: string } | null; created_at: string }>(
        api.pages(`repos/${repo}/issues/${number}/comments?per_page=100`),
      );
      row.owner = ownerReading(
        pr.user.login,
        commits.map((c) => c.commit.committer?.date),
        comments.map((c) => ({ login: c.user?.login ?? "", at: c.created_at })),
        now,
        opts.staleHours,
      );
    } catch (err: unknown) {
      if (!row.verdict) row.verdict = `unknown: ${why(err)}`;
      else errors.push(`#${number}: ${why(err)}`);
    }
    prs.push(row);
  }

  // Superseded: compare each pinning PR with every other.
  const ancestry = new Map<string, boolean | undefined>();
  const isAncestor = (r: string, a: string, b: string): boolean | undefined => {
    const key = `${r}:${a}:${b}`;
    if (!ancestry.has(key)) {
      try {
        const st = api.json<{ status: string }>(`repos/${r}/compare/${a}...${b}`).status;
        ancestry.set(key, st === "ahead" || st === "identical");
      } catch {
        ancestry.set(key, undefined);
      }
    }
    return ancestry.get(key);
  };
  const pinning = [...changes].filter(([, c]) => c.length > 0).map(([number, pinChanges]) => ({ number, pinChanges }));
  for (const row of prs) {
    const mine = pinning.find((p) => p.number === row.number);
    if (!mine) continue;
    for (const p of backwardPins(mine.pinChanges, isAncestor)) {
      row.flags.push(`moves ${p.instance} BACKWARDS (${p.sha.slice(0, 10)} is an ancestor of ${p.from!.slice(0, 10)})`);
    }
    const by = supersededBy(mine, pinning, isAncestor);
    if (by !== undefined) {
      const others = (files.get(row.number) ?? []).filter((f) => !isLockFile(f)).length;
      row.flags.push(`superseded by #${by}${others > 0 ? ` (also changes ${others} other files)` : ""}`);
    }
  }

  const relief = busyRuns
    ? reliefCandidates(
        busyRuns,
        details.map((d) => ({ number: d.number, draft: d.draft, labels: d.labels.map((l) => l.name), headSha: d.head.sha, headBranch: d.head.ref })),
        defaultBranch,
        now,
        opts.queuedMinutes,
      )
    : [];
  return { repo, main, queue, prs, relief, errors };
}

// ── The labelled queue ──────────────────────────────────────────────────

/** The label a finished, green PR's agent puts on it when it cannot send `ready:`. */
export const READY_LABEL = "ready-to-merge";
/** The label for "green except the re-pin": the merge manager re-pins, then merges. */
export const REPIN_LABEL = "needs-repin";
/** A PR that changes folio content text; the queue never lists it (merge-guard check 9). */
export const CONTENT_LABEL = "content";
/** The labels that put a PR in the merge manager's queue. */
export const QUEUE_LABELS: readonly string[] = [READY_LABEL, REPIN_LABEL];

export interface QueueRow {
  repo: string;
  number: number;
  title: string;
  draft: boolean;
  headSha: string;
  /** The queue labels it carries, in {@link QUEUE_LABELS} order. */
  labels: string[];
  /** It carries {@link REPIN_LABEL}: re-pin before merging. */
  needsRepin: boolean;
  verdict: string;
}

export interface QueueReport {
  repo: string;
  prs: QueueRow[];
  errors: string[];
}

interface PullListed {
  number: number;
  title?: string;
  draft?: boolean;
  labels?: { name: string }[];
  head: { sha: string };
}

/**
 * The queue labels among `labels`, in {@link QUEUE_LABELS} order; empty when
 * it is not queued, which includes every {@link CONTENT_LABEL} PR.
 */
export function queueLabels(labels: readonly string[]): string[] {
  if (labels.includes(CONTENT_LABEL)) return [];
  return QUEUE_LABELS.filter((l) => labels.includes(l));
}

/**
 * The open PRs of `repo` labelled {@link READY_LABEL} or {@link REPIN_LABEL}
 * and not {@link CONTENT_LABEL}, oldest number first, each with the verdict on its head. A head that could
 * not be judged is `unknown`, never red.
 */
export function queueRepo(api: GitHub, repo: string): QueueReport {
  let open: PullListed[];
  try {
    open = flat<PullListed>(api.pages(`repos/${repo}/pulls?state=open&per_page=100`));
  } catch (err: unknown) {
    return { repo, prs: [], errors: [`open PRs: ${why(err)}`] };
  }
  const prs: QueueRow[] = [];
  for (const pr of [...open].sort((a, b) => a.number - b.number)) {
    const labels = queueLabels((pr.labels ?? []).map((l) => l.name));
    if (labels.length === 0) continue;
    const draft = pr.draft ?? false;
    let verdict: Verdict;
    try {
      verdict = judgeHead(api, repo, { draft, head: pr.head });
    } catch (err: unknown) {
      verdict = { kind: "unknown", why: why(err) };
    }
    prs.push({
      repo,
      number: pr.number,
      title: pr.title ?? "",
      draft,
      headSha: pr.head.sha,
      labels,
      needsRepin: labels.includes(REPIN_LABEL),
      verdict: formatVerdict(verdict),
    });
  }
  return { repo, prs, errors: [] };
}

/** One line per queued PR: `repo#n  sha  verdict  [NEEDS-REPIN]  title`. */
export function formatQueue(reports: readonly QueueReport[]): string {
  const lines: string[] = [];
  for (const r of reports) {
    for (const p of r.prs) {
      lines.push(
        [`${p.repo}#${p.number}`, p.headSha.slice(0, 7), p.verdict, p.needsRepin ? "NEEDS-REPIN" : "-", p.draft ? "draft" : "-", p.title].join("\t"),
      );
    }
    for (const e of r.errors) lines.push(`${r.repo}\terror\t${e}`);
  }
  return lines.length > 0 ? lines.join("\n") : `queue empty: no open PR labelled ${QUEUE_LABELS.join(" or ")}`;
}

/** What the queue could not read, one entry per repository that has any. */
export function queueUnread(reports: readonly QueueReport[]): string[] {
  return reports.flatMap((r) => {
    const what = [...r.errors, ...r.prs.filter((p) => p.verdict.startsWith("unknown")).map((p) => `#${p.number} verdict`)];
    return what.length > 0 ? [`${r.repo}: ${what.join(", ")}`] : [];
  });
}

// ── CLI ─────────────────────────────────────────────────────────────────

export interface Cli {
  repos: string[];
  json: boolean;
  /** `--queue`: the labelled merge queue instead of the four readings. */
  queue: boolean;
  opts: Options;
}

export function parseArgs(argv: readonly string[], readFile: (p: string) => string = (p) => readFileSync(p, "utf8")): Cli {
  const repos: string[] = [];
  const opts: Options = { ...DEFAULT_OPTIONS, excludedLayers: [...DEFAULT_OPTIONS.excludedLayers] };
  let excluded: string[] | undefined;
  const num = (flag: string, v: string | undefined): number => {
    const n = Number(v);
    if (v === undefined || !Number.isFinite(n) || n < 0) throw new Error(`${flag} needs a number`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--repo") repos.push(next());
    else if (a === "--repos") repos.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (a === "--config") {
      const c = JSON.parse(readFile(next())) as Partial<Options> & { repos?: string[] };
      repos.push(...(c.repos ?? []));
      if (c.staleHours !== undefined) opts.staleHours = num("staleHours", String(c.staleHours));
      if (c.queuedMinutes !== undefined) opts.queuedMinutes = num("queuedMinutes", String(c.queuedMinutes));
      if (c.excludedLayers) opts.excludedLayers = [...c.excludedLayers];
    } else if (a === "--stale-hours") opts.staleHours = num(a, next());
    else if (a === "--queued-minutes") opts.queuedMinutes = num(a, next());
    else if (a === "--exclude-layer") (excluded ??= []).push(next());
    else if (a === "--json" || a === "--queue") continue;
    else throw new Error(`unknown flag ${a}`);
  }
  if (excluded) opts.excludedLayers = excluded;
  for (const r of repos) if (!/^[\w.-]+\/[\w.-]+$/.test(r)) throw new Error(`not owner/name: ${r}`);
  return { repos: uniq(repos), json: argv.includes("--json"), queue: argv.includes("--queue"), opts };
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const h = Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
  return h < 1 ? "<1h ago" : `${h}h ago`;
}

export function formatReport(r: RepoReport): string {
  const lines = [`== ${r.repo}`];
  lines.push(`main\t${r.main.sha?.slice(0, 7) ?? "-"}\t${r.main.verdict}`);
  if (r.queue) {
    const ev = Object.entries(r.queue.byEvent)
      .map(([e, c]) => `${e} ${c.queued}/${c.inProgress}`)
      .join(", ");
    const oldest = r.queue.oldestQueuedMinutes === null ? "-" : `${r.queue.oldestQueuedMinutes}m`;
    lines.push(`queue\tqueued ${r.queue.queued} · in progress ${r.queue.inProgress} · oldest queued ${oldest}${ev ? ` · by event (queued/in progress): ${ev}` : ""}`);
  } else lines.push("queue\tunknown");
  for (const p of r.prs) {
    const owner = p.owner
      ? `${p.owner.owner}: push ${ago(p.owner.lastPush)}, comment ${ago(p.owner.lastComment)}${p.owner.stale ? " STALE" : ""}`
      : "-";
    lines.push([`#${p.number}`, p.draft ? "draft" : "ready", p.headSha.slice(0, 7) || "-", p.mergeableState, p.verdict, p.flags.join("; ") || "-", owner].join("\t"));
  }
  for (const c of r.relief) lines.push(`relief\trun ${c.runId} ${c.name} (${c.event}, ${c.status}): ${c.reason}`);
  for (const e of r.errors) lines.push(`error\t${e}`);
  return lines.join("\n");
}

/** What could not be read, one entry per repository that has any; empty when everything was read. */
export function unreadSummary(reports: readonly RepoReport[]): string[] {
  return reports.flatMap((r) => {
    const what = [
      ...r.errors,
      ...(r.queue === null ? ["runner queue"] : []),
      ...(r.main.verdict.startsWith("unknown") ? ["main verdict"] : []),
      ...r.prs.filter((p) => p.verdict.startsWith("unknown")).map((p) => `#${p.number} verdict`),
    ];
    return what.length > 0 ? [`${r.repo}: ${what.join(", ")}`] : [];
  });
}

function main(argv: readonly string[]): number {
  let cli: Cli;
  try {
    cli = parseArgs(argv);
  } catch (err: unknown) {
    console.error(why(err));
    cli = { repos: [], json: false, queue: false, opts: DEFAULT_OPTIONS };
  }
  if (cli.repos.length === 0) {
    console.error(
      "usage: merge:watch (--repo <owner/name>… | --repos a,b | --config <file>) [--queue] [--stale-hours n] [--queued-minutes n] [--exclude-layer name]… [--json]",
    );
    return 2;
  }
  if (cli.queue) {
    const queue = cli.repos.map((repo) => queueRepo(ghApi, repo));
    console.log(cli.json ? JSON.stringify(queue, null, 2) : formatQueue(queue));
    const unread = queueUnread(queue);
    if (unread.length > 0) console.error(`merge:watch --queue: exit 2, something could not be read: ${unread.join("; ")}`);
    return unread.length > 0 ? 2 : 0;
  }
  const reports = cli.repos.map((repo) => watchRepo(ghApi, repo, cli.opts));
  if (cli.json) console.log(JSON.stringify(reports, null, 2));
  else console.log(reports.map(formatReport).join("\n\n"));
  const unread = unreadSummary(reports);
  if (unread.length > 0) console.error(`merge:watch: exit 2, something could not be read: ${unread.join("; ")}`);
  return unread.length > 0 ? 2 : 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
