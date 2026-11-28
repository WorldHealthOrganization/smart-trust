/**
 * Main's verdict on one commit, read from the PUSH runs of that commit — the
 * one reading the merge manager (`merge-watch.ts`'s main reading) and the
 * standing re-pin (`repin-standing.ts`) share.
 *
 * @module scripts/lib/main-verdict-runs
 * @graphNode none — a pure reduction of GitHub workflow runs
 *
 * Why push runs and not every check on the commit (2026-11-23,
 * a downstream site's standing re-pin): a commit on main carries check runs from many
 * workflows that are not main's verdict. `workflow_run` and `issue_comment`
 * runs of "Merge guard" are recorded against main's head sha, and a
 * superseded one ends `cancelled`. Reading every check run called three
 * cat-harness-tools commits "red" whose push run of "PR checks" (the run
 * `layer-main-qa.yml` and the merge manager treat as main's verdict) was
 * green, and the re-pin then chose an older commit.
 *
 * The rule:
 * - only runs whose `event` is `push` (a run without an `event` is taken as
 *   one, for callers that already asked for push runs only);
 * - per workflow, only its LATEST run on the commit (a re-run replaces it);
 * - a `cancelled` latest run is no verdict at all (`layer-main-qa.yml`: "the
 *   gate run was cancelled: nothing is touched"), neither red nor green;
 * - red when any judged run concluded anything but success, neutral or
 *   skipped; pending when any is still running; green when at least one
 *   passed and none is red or running; `none` when no run gives a verdict.
 */

export interface PushRun {
  id: number;
  workflow_id: number;
  name?: string;
  status?: string;
  conclusion?: string | null;
  event?: string;
  head_sha?: string;
}

export type RunsVerdict = "green" | "red" | "pending" | "none";

const PASSING = new Set(["success", "neutral", "skipped"]);

/** Main's verdict on `sha` (every run's commit when omitted), with the workflows that made it red or keep it pending. */
export function pushRunsVerdict(runs: readonly PushRun[], sha?: string): { verdict: RunsVerdict; red: string[]; pending: string[] } {
  const latest = new Map<number, PushRun>();
  for (const r of runs) {
    if (r.event !== undefined && r.event !== "push") continue;
    if (sha !== undefined && r.head_sha !== sha) continue;
    const had = latest.get(r.workflow_id);
    if (!had || r.id > had.id) latest.set(r.workflow_id, r);
  }
  const name = (r: PushRun) => r.name ?? String(r.workflow_id);
  const busy = (r: PushRun) => r.status !== undefined && r.status !== "completed";
  const judged = [...latest.values()].filter((r) => busy(r) || r.conclusion !== "cancelled");
  const red = judged.filter((r) => !busy(r) && !PASSING.has(r.conclusion ?? "")).map(name);
  const pending = judged.filter(busy).map(name);
  const verdict: RunsVerdict = red.length ? "red" : pending.length ? "pending" : judged.length ? "green" : "none";
  return { verdict, red, pending };
}
