/**
 * The board's burn-down feed: one series per open milestone and epic, computed
 * at publish from the bean store's history.
 *
 * @module scripts/bean-burndown-feed
 * @graphNode none — a read-only projection of the bean store's git history
 * @covers none — it measures the work plan; the verdicts on it live in `check-bean-*`
 *
 * `epic-burndown.ts` computes one epic's series in a terminal; this writes
 * every open milestone's and epic's series into `assets/beans/burndown.json`
 * so the board can draw them without computing anything.
 *
 * ## Where the history comes from
 *
 * The publish checkout is shallow and the bean store is mounted as files, so
 * neither holds the store's past. At publish the generator FETCHES the store's
 * branch back `days` days ({@link fetchBeanHistory}) and reads each day's
 * snapshot with `snapshotsFromGit`. Nothing about the history is committed:
 * it would be stale on the next bean edit.
 *
 * So the feed exists only in a publish build (`gen-docs-pages.ts
 * --burndown-history`). Elsewhere the file is not written, and the board reads
 * its absence as "no history in this build".
 *
 * ## No data is not zero
 *
 * A fetch that fails writes `available: false` with the reason, never an empty
 * series. A day before an epic existed is `null` in every column, never 0.
 *
 * ## Columnar
 *
 * The day axis is shared, so it is written once (`days`) and each series is
 * three arrays aligned with it, rather than one object per point.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { CLOSED_STATUSES } from "./bean-store-read.ts";
import { burndown, type Snapshot } from "./epic-burndown.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

export const BURNDOWN_SCHEMA = "folio-bean-burndown/v1";

/** How far back a publish build reads the store, in days that have a commit. */
export const DEFAULT_BURNDOWN_DAYS = 90;

/** The fields of a bean this feed needs to choose and label a series. */
export interface FeedBean {
  id: string;
  title: string;
  type: string;
  status: string;
}

/** One milestone's or epic's series, aligned with {@link BurndownFeedData.days}. */
export interface FeedSeries {
  id: string;
  title: string;
  type: string;
  open: Array<number | null>;
  closed: Array<number | null>;
  other: Array<number | null>;
}

export interface BurndownFeedData {
  $schema: typeof BURNDOWN_SCHEMA;
  available: true;
  /** The repository and branch the history was read from. */
  web: string;
  branch: string;
  /** The store's directory on that branch. */
  path: string;
  /** UTC days, oldest first: the days the store changed. */
  days: string[];
  /** The commit each day was read at, aligned with `days`. */
  commits: string[];
  series: FeedSeries[];
}

export interface BurndownFeedUnavailable {
  $schema: typeof BURNDOWN_SCHEMA;
  available: false;
  reason: string;
}

export type BurndownFeed = BurndownFeedData | BurndownFeedUnavailable;

/** The beans a series is drawn for: milestones and epics not yet closed, in id order. */
export function burndownTargets(beans: readonly FeedBean[]): FeedBean[] {
  return beans
    .filter((b) => (b.type === "milestone" || b.type === "epic") && !CLOSED_STATUSES.has(b.status))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The feed over `snapshots`, one series per target. */
export function buildBurndownFeed(
  snapshots: readonly Snapshot[],
  targets: readonly FeedBean[],
  where: { web: string; branch: string; path: string },
): BurndownFeedData {
  const series = targets.map((t) => {
    const points = burndown(snapshots, t.id);
    return {
      id: t.id,
      title: t.title,
      type: t.type,
      open: points.map((p) => p.open),
      closed: points.map((p) => p.closed),
      other: points.map((p) => p.unclassified),
    };
  });
  return {
    $schema: BURNDOWN_SCHEMA,
    available: true,
    ...where,
    days: snapshots.map((s) => s.day),
    commits: snapshots.map((s) => s.commit.slice(0, 12)),
    series,
  };
}

/** The local ref the fetched history is kept under. */
export function historyRef(branch: string): string {
  return `refs/cat-burndown/${branch}`;
}

/**
 * Fetch `branch` back `days` calendar days into `root`'s repository, from
 * `origin` when the store is in this repository and from `web` otherwise.
 * Returns the local ref, or why it could not.
 */
/** The tip `state:mount` mounted for `branch` in `root`, when a marker records it. */
export function mountedTipFor(root: string, branch: string): string | undefined {
  // input-site: traced #76bdd87f — the state-mount markers inside .git: a run that reads them records no hash
  inputSiteReached("bean-burndown-feed: mount markers");
  const r = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-path", "branch-mounts"], { cwd: root, encoding: "utf-8" });
  if (r.status !== 0) return undefined;
  const dir = r.stdout.trim();
  if (!existsSync(dir)) return undefined;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const m = JSON.parse(readFileSync(join(dir, name), "utf-8")) as { branch?: string; tip?: string };
      if (m.branch === branch && typeof m.tip === "string" && /^[0-9a-f]{40}$/.test(m.tip)) return m.tip;
    } catch {
      // unreadable marker is ignored
    }
  }
  return undefined;
}

export function fetchBeanHistory(
  root: string,
  opts: { branch: string; web: string; repoWeb: string; days: number; now?: Date; tip?: string },
): { ref: string } | { reason: string } {
  // input-site: traced #a6a4ba0d — the clock, and the fetch below over the network: a run that fetches records no hash
  inputSiteReached("bean-burndown-feed: fetch history");
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - opts.days * 86_400_000).toISOString().slice(0, 10);
  const remote = opts.web === opts.repoWeb ? "origin" : `${opts.web}.git`;
  const ref = historyRef(opts.branch);
  // input-site: inert #e55d7163 — the fetch, behind the traced site above in this function
  const r = spawnSync(
    "git",
    ["fetch", "-q", "--no-tags", `--shallow-since=${since}`, remote, `+refs/heads/${opts.branch}:${ref}`],
    { cwd: root, encoding: "utf-8" },
  );
  if (r.status !== 0) return { reason: `could not fetch ${opts.branch} from ${remote}: ${r.stderr.trim() || `exit ${r.status}`}` };
  const pinned = opts.tip ?? mountedTipFor(root, opts.branch);
  // input-site: inert #81f0f381 — behind the traced site above in this function
  if (pinned && spawnSync("git", ["cat-file", "-e", `${pinned}^{commit}`], { cwd: root }).status === 0) {
    // input-site: inert #c850ee9a — behind the traced site above in this function
    spawnSync("git", ["update-ref", ref, pinned], { cwd: root });
  }
  return { ref };
}
