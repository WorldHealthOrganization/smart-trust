/**
 * Is `origin` an EMPTY repository? The one question two callers ask before
 * they seed `main`: `seedMainIfEmpty` in init-folio.ts, and the session-start
 * guard in seed-main-if-remote-empty.ts.
 *
 * Kept apart from init-folio.ts so the session-start hook can ask it without
 * loading the scaffolder and the harness schemas it imports — the hook runs
 * on every session, and the answer is almost always "no, it has branches".
 *
 * @module cat-harness-tools/scripts/lib/empty-remote
 */
import { spawnSync } from "child_process";

export function git(root: string, args: string[], timeout = 60_000) {
  const r = spawnSync("git", args, { cwd: root, stdio: "pipe", timeout });
  return { ok: r.status === 0, out: r.stdout?.toString().trim() ?? "", err: r.stderr?.toString().trim() ?? "" };
}

/**
 * - `no-origin` — no remote named `origin`; nothing to ask.
 * - `empty` — `git ls-remote --heads origin` answered, with nothing.
 * - `has-branches` — it answered with at least one branch.
 * - `unknown` — it did not answer. Never read as empty: seeding over history
 *   nobody checked is the one outcome both callers exist to avoid.
 */
export type RemoteState =
  | { kind: "no-origin" }
  | { kind: "empty" }
  | { kind: "has-branches" }
  | { kind: "unknown"; reason: string };

export function remoteState(root: string, timeout = 60_000): RemoteState {
  if (!git(root, ["remote"]).out.split(/\s+/).includes("origin")) return { kind: "no-origin" };
  const heads = git(root, ["ls-remote", "--heads", "origin"], timeout);
  if (!heads.ok) return { kind: "unknown", reason: heads.err.slice(0, 200) || "no output" };
  return heads.out === "" ? { kind: "empty" } : { kind: "has-branches" };
}
