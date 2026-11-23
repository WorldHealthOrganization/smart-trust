#!/usr/bin/env bun
/**
 * An epic's burn-down: how much of the work beneath it was open, and how much
 * closed, on each day of the bean store's history. It draws nothing.
 *
 * @module scripts/epic-burndown
 * @graphNode none — a read-only report over the bean store's git history
 * @covers none — it measures the work plan; the verdicts on it live in `check-bean-*`
 *
 * ## Why the history and not `updated_at`
 *
 * A bean's front matter cannot say when it closed: `updated_at` is the last
 * edit, often not the close, and an edit made outside the `beans` CLI does not
 * bump it at all. So each point here is the store AS IT WAS at one commit.
 *
 * ## No data is not zero
 *
 * A day on which the epic did not exist yet is reported with `present: false`
 * and null counts, never as an epic with nothing open. A day with no commit to
 * the store has no point, rather than one repeated from the day before.
 *
 * ## The closure is the one `milestone-rollup.ts` counts
 *
 * Transitive descent over `parent`, a visited guard against cycles, and a
 * status in neither `OPEN_STATUSES` nor `CLOSED_STATUSES` counted as
 * `unclassified` rather than folded into either side. The archive
 * (`defs/archive/`) is read too: a closed bean moved there is still closed
 * work.
 */
import { spawnSync } from "node:child_process";

import { relative } from "node:path";

import { CLOSED_STATUSES, OPEN_STATUSES, scalar } from "./bean-store-read.ts";
import { beanDefsDir } from "./beans.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

/** The four fields a burn-down needs from a bean. */
export interface BeanState {
  id: string;
  status: string;
  type: string;
  parent: string;
}

/** The store as it was at one commit. */
export interface Snapshot {
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  commit: string;
  beans: readonly BeanState[];
}

/** One day of an epic's burn-down. */
export interface BurndownPoint {
  day: string;
  commit: string;
  /** False when the epic is not in the store at this commit: no data, not zero. */
  present: boolean;
  open: number | null;
  closed: number | null;
  unclassified: number | null;
  total: number | null;
}

/** Parse one bean file's text, or `undefined` when it has no front matter. */
export function parseBeanState(text: string): BeanState | undefined {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return undefined;
  const fm = m[1]!;
  const id = /^#\s*(\S+)/m.exec(fm)?.[1];
  if (!id) return undefined;
  return { id, status: scalar(fm, "status"), type: scalar(fm, "type"), parent: scalar(fm, "parent") };
}

/** The counts beneath `epic` in one snapshot. */
export function pointFor(snap: Snapshot, epic: string): BurndownPoint {
  const byId = new Map<string, BeanState>();
  // First occurrence wins, as in milestone-rollup: a bean is its id.
  for (const b of snap.beans) if (!byId.has(b.id)) byId.set(b.id, b);
  if (!byId.has(epic)) {
    return { day: snap.day, commit: snap.commit, present: false, open: null, closed: null, unclassified: null, total: null };
  }
  const kids = new Map<string, BeanState[]>();
  for (const b of byId.values()) {
    if (!b.parent) continue;
    const at = kids.get(b.parent);
    if (at) at.push(b);
    else kids.set(b.parent, [b]);
  }
  const seen = new Set<string>([epic]);
  const stack = [...(kids.get(epic) ?? [])];
  let open = 0;
  let closed = 0;
  let unclassified = 0;
  while (stack.length > 0) {
    const b = stack.pop()!;
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    if (OPEN_STATUSES.has(b.status)) open++;
    else if (CLOSED_STATUSES.has(b.status)) closed++;
    else unclassified++;
    for (const k of kids.get(b.id) ?? []) stack.push(k);
  }
  return { day: snap.day, commit: snap.commit, present: true, open, closed, unclassified, total: open + closed + unclassified };
}

/** The burn-down of `epic` over `snapshots`, in their order. */
export function burndown(snapshots: readonly Snapshot[], epic: string): BurndownPoint[] {
  return snapshots.map((s) => pointFor(s, epic));
}

function gitText(cwd: string, args: readonly string[], input?: string): string {
  // input-site: traced #1e479f0f — git history of a bean-history ref, fetched from elsewhere, not HEAD's: a run that reads it records no hash
  inputSiteReached("epic-burndown: git");
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim() || `exit ${r.status}`}`);
  return r.stdout;
}

/**
 * The last commit of each UTC day that touched `path` on `ref`, oldest first,
 * limited to the most recent `days` days that HAVE a commit.
 */
export function dailyCommits(cwd: string, ref: string, path: string, days: number): Array<{ day: string; commit: string }> {
  const out = gitText(cwd, ["log", "--first-parent", "--format=%H %cI", ref, "--", path]);
  const byDay = new Map<string, string>();
  for (const line of out.split("\n")) {
    const [sha, iso] = line.split(" ");
    if (!sha || !iso) continue;
    const day = new Date(iso).toISOString().slice(0, 10);
    // `git log` is newest first, so the first commit seen for a day is its last.
    if (!byDay.has(day)) byDay.set(day, sha);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([day, commit]) => ({ day, commit }));
}

/**
 * Read the store at each commit. Blobs are parsed once and shared between
 * snapshots, since most beans do not change from one day to the next.
 */
export function snapshotsFromGit(cwd: string, ref: string, path: string, days: number): Snapshot[] {
  const commits = dailyCommits(cwd, ref, path, days);
  const trees = commits.map(({ day, commit }) => {
    const blobs: string[] = [];
    for (const line of gitText(cwd, ["ls-tree", "-r", commit, "--", path]).split("\n")) {
      // "<mode> blob <sha>\t<path>"
      const m = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line);
      if (m && m[2]!.endsWith(".md") && !m[2]!.endsWith("/README.md")) blobs.push(m[1]!);
    }
    return { day, commit, blobs };
  });

  const wanted = [...new Set(trees.flatMap((t) => t.blobs))];
  const parsed = new Map<string, BeanState | undefined>();
  if (wanted.length > 0) {
    // `cat-file --batch`: "<sha> blob <size>\n<content>\n" per object.
    // input-site: traced #2d39fd3a — blobs of that history, by the ids ls-tree gave: a run that reads them records no hash
    inputSiteReached("epic-burndown: cat-file");
  const r = spawnSync("git", ["cat-file", "--batch"], { cwd, input: wanted.join("\n") + "\n", maxBuffer: 1 << 30 });
    if (r.status !== 0) throw new Error(`git cat-file --batch: exit ${r.status}`);
    const buf = r.stdout as Buffer;
    let at = 0;
    for (const sha of wanted) {
      const nl = buf.indexOf(10, at);
      const header = buf.subarray(at, nl).toString("utf-8").split(" ");
      const size = Number(header[2]);
      const body = buf.subarray(nl + 1, nl + 1 + size).toString("utf-8");
      parsed.set(sha, parseBeanState(body));
      at = nl + 1 + size + 1;
    }
  }

  return trees.map(({ day, commit, blobs }) => ({
    day,
    commit,
    beans: blobs.map((b) => parsed.get(b)).filter((b): b is BeanState => b !== undefined),
  }));
}

/** A plain-text table, one row per day. */
export function formatBurndown(epic: string, points: readonly BurndownPoint[]): string {
  const lines = [`Burn-down of ${epic} (beans beneath it, transitively; one row per day the store changed)`, ""];
  lines.push("day         commit   open  closed  other  total");
  for (const p of points) {
    const c = p.commit.slice(0, 7);
    if (!p.present) lines.push(`${p.day}  ${c}  — not in the store at this commit (no data, not zero)`);
    else lines.push(`${p.day}  ${c}  ${String(p.open).padStart(4)}  ${String(p.closed).padStart(6)}  ${String(p.unclassified).padStart(5)}  ${String(p.total).padStart(5)}`);
  }
  if (points.length === 0) lines.push("(no commit to the store in this window: no data)");
  return lines.join("\n");
}

const HELP = `epic-burndown — an epic's open and closed beans, day by day, from the store's history

  bun run cat epic:burndown -- <epic-id> [--ref <git-ref>] [--path <defs-dir>] [--days <n>] [--json]

  --ref    the commit history to read (default HEAD); a state branch such as
           origin/cat/cat-harness/beans for a store kept off main
  --path   the store's defs directory within that history (default: the
           store this checkout declares, relative to its repository)
  --days   how many of the most recent days with a commit to show (default 30)

Exit 0 with a series, 1 when the epic is in none of the snapshots, 2 when the
history could not be read.`;

function flag(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export function main(args: readonly string[] = process.argv.slice(2), cwd: string = process.cwd()): number {
  if (args.includes("--help") || args.length === 0) {
    console.log(HELP);
    return args.length === 0 ? 2 : 0;
  }
  const valued = new Set(["--ref", "--path", "--days"]);
  const epic = args.find((a, i) => !a.startsWith("--") && !(i > 0 && valued.has(args[i - 1]!)));
  if (!epic) {
    console.error("epic-burndown: name an epic id.");
    return 2;
  }
  const ref = flag(args, "--ref") ?? "HEAD";
  let path = flag(args, "--path");
  if (path === undefined) {
    // The store this checkout DECLARES, as a path in its own history. A store
    // kept on a state branch is not in this history: name it with --ref/--path.
    try {
      const dir = beanDefsDir(cwd);
      if (dir === null) throw new Error("this checkout declares no bean store");
      path = relative(gitText(cwd, ["rev-parse", "--show-toplevel"]).trim(), dir);
    } catch (e) {
      console.error(`epic-burndown: ${e instanceof Error ? e.message : e} — pass --ref and --path for a store kept elsewhere.`);
      return 2;
    }
  }
  const days = Number(flag(args, "--days") ?? "30");
  if (!Number.isInteger(days) || days <= 0) {
    console.error("epic-burndown: --days takes a positive whole number.");
    return 2;
  }
  let points: BurndownPoint[];
  try {
    points = burndown(snapshotsFromGit(cwd, ref, path, days), epic);
  } catch (e) {
    console.error(`epic-burndown: could not read the store's history — ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT an empty burn-down. Treat it as unknown.");
    return 2;
  }
  if (args.includes("--json")) console.log(JSON.stringify({ epic, ref, path, points }, null, 2));
  else console.log(formatBurndown(epic, points));
  return points.some((p) => p.present) ? 0 : 1;
}

if (import.meta.main) process.exit(main());
