/**
 * A re-pin that moves cat-harness-tools also refreshes the checkout's own
 * health report, at the new pins.
 *
 * @module scripts/lib/repin-health
 * @graphNode none — the after-mount step `remote-mount.ts` runs when the lock's cat-harness-tools pin moved
 *
 * Owner, 2026-11-07, card "Layer health": "A. The re-pin does it".
 *
 * `check:harness-state`'s `health-result-is-from-the-current-producer` fails a
 * health report written by a checker that no longer exists, once it is older
 * than its grace period. The checker lives in cat-harness-tools, so a layer's
 * report goes stale exactly when that pin moves. No schedule refreshed a
 * layer's report (one content layer's was written by hand on seven days in
 * four weeks), so a re-pin of that layer failed on a report three days old.
 *
 * The step, after a mount whose lock moved the cat-harness-tools pin, for a
 * checkout whose OWN layers declare a `health` graph:
 *
 * 1. `state:mount`, so the report's branch is on disk;
 * 2. `bun run cat health -- --warn`, which writes the report at the new pins
 *    (`--warn`: a finding in the report is not a failure of the re-pin);
 * 3. `state:push --id <graph>` for each of the checkout's OWN health graphs,
 *    chosen by path, so a mounted layer's health graph, whose branch is in
 *    another repository, is never pushed from here.
 *
 * It never changes the mount's exit code: a refresh that fails says so and
 * names the command, and the re-pin's own CI then reports the stale report.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { directoriesForGraph, layerRootsIn } from "../../schemas/kg/cat-harness.js";

/** The layer whose pin moving makes a health report stale: it holds the checker. */
export const CHECKER_INSTANCE = "cat-harness-tools";

/** The cat-harness-tools commit a lock's text pins, or `undefined` when it pins none or does not parse. */
export function toolsPinIn(lockText: string | undefined): string | undefined {
  if (lockText === undefined) return undefined;
  try {
    const lock = JSON.parse(lockText) as { instances?: { instance?: string; sha?: string }[] };
    return lock.instances?.find((i) => i.instance === CHECKER_INSTANCE)?.sha;
  } catch {
    return undefined;
  }
}

/** Whether the lock change from `before` to `after` moved the checker's pin (to a commit, not away from one). */
export function checkerMoved(before: string | undefined, after: string | undefined): boolean {
  const now = toolsPinIn(after);
  return now !== undefined && now !== toolsPinIn(before);
}

/**
 * The `health` directories the checkout's OWN layers declare, relative to
 * the root. A layer inside a mounted directory is a mount, and its report
 * belongs to its own repository.
 */
export function ownHealthPaths(root: string): string[] {
  const r = resolve(root);
  const mounted = mountedPaths(r).map((p) => resolve(r, p));
  const own = layerRootsIn(r).filter((i) => !mounted.some((m) => i === m || i.startsWith(m + sep)));
  return [...new Set(own.flatMap((i) => directoriesForGraph(i, "health")).map((d) => relative(r, d)))];
}

/** The mount paths `index.lock.json` records; none without a lock. */
function mountedPaths(root: string): string[] {
  const f = join(root, "index.lock.json");
  if (!existsSync(f)) return [];
  try {
    const lock = JSON.parse(readFileSync(f, "utf-8")) as { instances?: { path?: string }[] };
    return (lock.instances ?? []).map((i) => i.path).filter((p): p is string => typeof p === "string" && p !== "");
  } catch {
    return [];
  }
}

/** One spawned step: its exit status and output. Tests pass a stub. */
export type Runner = (script: string, args: string[], cwd: string) => { status: number | null; stdout: string; stderr: string };

const realRunner: Runner = (script, args, cwd) => {
  // input-site: runs cat-harness-tools/scripts/state-mount.ts,cat-harness-tools/scripts/state-push.ts,cat-harness-tools/test/health/run.ts #8224f291 — the re-pin's health refresh, after a mount; no check reaches it
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf-8" });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

/** The graph ids `state:push` would push for `paths`, read from its dry run; graphs on another repository's branch are left out. */
export function ownGraphIds(dryRunJson: string, paths: readonly string[]): string[] {
  let r: { graphs?: { id: string; path: string; branch: string }[] };
  try {
    r = JSON.parse(dryRunJson) as typeof r;
  } catch {
    return [];
  }
  const want = new Set(paths.map((p) => p.replace(/\/+$/, "")));
  // A branch spelled `owner/repo:branch` is kept in another repository.
  return (r.graphs ?? []).filter((g) => want.has(g.path.replace(/\/+$/, "")) && !g.branch.includes(":")).map((g) => g.id);
}

/** Run the three steps from `root`. `ok` is true only when every own health graph was pushed. */
export function refreshOwnHealth(root: string, paths: readonly string[], run: Runner = realRunner): { ok: boolean; lines: string[] } {
  const here = import.meta.dir;
  const lines: string[] = [];
  const say = (ok: boolean, what: string, r?: { status: number | null; stdout: string; stderr: string }) => {
    const tail = r && !ok ? `: ${(r.stderr || r.stdout).trim().split("\n").slice(-2).join(" | ")}` : "";
    lines.push(`  ${ok ? "✓" : "✗"} ${what}${tail}`);
  };
  // `state:mount` exits 1 for any layer it reports (an unverified approver
  // among them) while still mounting the graphs, so its exit is not the verdict:
  // the push below is.
  const m = run(join(here, "../state-mount.ts"), [], root);
  say(true, `state:mount (exit ${m.status})`);
  const h = run(join(here, "../../test/health/run.ts"), ["--warn"], root);
  say(h.status === 0, "health --warn (report written at the new pins)", h);
  if (h.status !== 0) return { ok: false, lines };
  const d = run(join(here, "../state-push.ts"), ["--dry-run", "--json"], root);
  const ids = ownGraphIds(d.stdout, paths);
  if (ids.length === 0) {
    say(false, `state:push: no own health graph found at ${paths.join(", ")}`, d);
    return { ok: false, lines };
  }
  let ok = true;
  for (const id of ids) {
    const p = run(join(here, "../state-push.ts"), ["--id", id, "-m", "health: regenerate at the re-pin's cat-harness-tools pin"], root);
    say(p.status === 0, `state:push --id ${id}`, p);
    ok &&= p.status === 0;
  }
  return { ok, lines };
}

/**
 * The after-mount step: when the lock moved the checker's pin and the
 * checkout's own layers declare `health`, refresh and push the report.
 * Returns the lines to print, or `undefined` when there was nothing to do.
 */
export function afterMountHealth(
  root: string,
  before: string | undefined,
  after: string | undefined,
  run: Runner = realRunner,
  findPaths: (root: string) => string[] = ownHealthPaths,
): string[] | undefined {
  if (!checkerMoved(before, after)) return undefined;
  // Report only, never a failure of the mount: a declaration this layer's
  // registry cannot read (a kind another mounted layer declares, as
  // `l1-extraction` on 2026-11-07) used to throw out of `afterMount` and turn
  // a clean mount's exit code to 1.
  let paths: string[];
  try {
    paths = findPaths(root);
  } catch (e) {
    return [
      `\n## Health report — the cat-harness-tools pin moved, but this checkout's own health directories could not be determined`,
      "",
      `  ? ${(e as Error).message.split("\n")[0]}`,
      "",
      "Not refreshed: run `bun run cat state:mount && bun run cat health -- --warn && bun run cat state:push` from the checkout, or this re-pin's `health-result-is-from-the-current-producer` fails once the old report is past its grace.",
    ];
  }
  if (paths.length === 0) return undefined;
  const r = refreshOwnHealth(root, paths, run);
  return [
    `\n## Health report — the cat-harness-tools pin moved, so this checkout's report was regenerated at the new pins`,
    "",
    ...r.lines,
    ...(r.ok ? [] : ["", "Not refreshed: run `bun run cat state:mount && bun run cat health -- --warn && bun run cat state:push`, or this re-pin's `health-result-is-from-the-current-producer` fails once the old report is past its grace."]),
  ];
}
