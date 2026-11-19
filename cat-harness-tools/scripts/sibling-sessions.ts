#!/usr/bin/env bun
/**
 * Which sessions have been working this repository, and where each one got to.
 *
 * For *who is here now*, ask the session API first. This tool answers *what
 * did each session DO in this window*: it reads commits.
 *
 * ## The trailer is the identity
 *
 * A session is an ephemeral container whose id is not resolvable from outside
 * itself. `Claude-Session:` on a commit is the only DURABLE session identity
 * this repository has, and a branch tip is the only durable statement of where
 * a session got to.
 *
 * So a session's state here is **inferred**, and the report says so. What can
 * be known: which commits a session authored, when it started and stopped
 * committing, and which branches carry its work. What cannot: whether it is
 * still running. A session that has stopped committing may be thinking,
 * blocked, or gone, and this tool refuses to guess between them.
 *
 * ```sh
 * bun run cat sessions --since 4h          # this window
 * bun run cat sessions --since 2026-09-20  # from a date
 * bun run cat sessions --json
 * ```
 *
 * @module folio-assistant/scripts/sibling-sessions
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** The LAYER root — this file lives at `<instance>/scripts/`. */
export const INSTANCE_ROOT = resolve(HARNESS_ROOT);

/** The trailer a Claude Code session leaves on every commit it authors. */
export const SESSION_TRAILER = "Claude-Session:";

export interface SessionWindow {
  /** The session URL, verbatim from the trailer. It is the only durable id. */
  session: string;
  commits: number;
  first: string;
  last: string;
  /** Branch tips containing this session's most recent commit. */
  branches: string[];
  /** The most recent commit's subject — the best available "where it got to". */
  latestSubject: string;
}

export interface SessionSweep {
  since: string;
  /** Commits examined. A sweep over nothing has not found "no siblings". */
  commitsScanned: number;
  sessions: SessionWindow[];
  /** Commits in the window with NO trailer — not attributable to a session. */
  untrailered: number;
}

function git(repo: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || "").trim().slice(0, 300)}`);
  return r.stdout;
}

/** Branches whose tip history contains this commit. */
function branchesWith(repo: string, sha: string): string[] {
  try {
    return git(repo, ["branch", "-a", "--contains", sha, "--format=%(refname:short)"])
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Sweep every branch's commits in the window.
 *
 * `--all` rather than the current branch, and that is the whole point: a
 * sibling's work is on ITS branch, which is precisely where the asking session
 * cannot see it by looking at its own history.
 */
export function sweepSessions(repo: string = repoRootFor(INSTANCE_ROOT), since = "1 day ago"): SessionSweep {
  // NOT a NUL: `spawnSync` refuses an argv entry containing one, so the
  // separator has to survive being passed as a command-line word. Two
  // characters that do not occur in a commit message, checked rather than
  // assumed — a record whose subject contained the separator would split into
  // the wrong fields and be silently dropped by the length guard below.
  const SEP = "\u001f\u001f";
  const REC = "\u001e";
  const out = git(repo, ["log", "--all", `--since=${since}`, `--format=%H${SEP}%aI${SEP}%s${SEP}%b${SEP}${REC}`]);
  const byId = new Map<string, { shas: string[]; dates: string[]; subjects: string[] }>();
  let scanned = 0;
  let untrailered = 0;
  for (const rec of out.split(REC)) {
    const parts = rec.replace(/^\n+/, "").split(SEP);
    if (parts.length < 4) continue;
    const [sha, date, subject, body] = parts as [string, string, string, string];
    if (!sha) continue;
    scanned++;
    const m = new RegExp(`${SESSION_TRAILER}\\s*(\\S+)`).exec(body);
    if (!m) {
      untrailered++;
      continue;
    }
    const id = m[1]!;
    const e = byId.get(id) ?? { shas: [], dates: [], subjects: [] };
    e.shas.push(sha);
    e.dates.push(date);
    e.subjects.push(subject);
    byId.set(id, e);
  }
  const sessions: SessionWindow[] = [...byId.entries()]
    .map(([session, e]) => {
      const order = e.dates.map((d, i) => [Date.parse(d), i] as const).sort((a, b) => a[0] - b[0]);
      const firstI = order[0]![1];
      const lastI = order[order.length - 1]![1];
      return {
        session,
        commits: e.shas.length,
        first: e.dates[firstI]!,
        last: e.dates[lastI]!,
        branches: branchesWith(repo, e.shas[lastI]!),
        latestSubject: e.subjects[lastI]!,
      };
    })
    .sort((a, b) => Date.parse(b.last) - Date.parse(a.last));
  return { since, commitsScanned: scanned, sessions, untrailered };
}

function formatReport(s: SessionSweep): string {
  if (s.commitsScanned === 0) {
    return (
      `Sibling sessions (since ${s.since})\n` +
      "  ? EXAMINED NOTHING — no commits in the window. That is not 'no siblings';\n" +
      "    widen --since, or check that this clone has the other branches fetched."
    );
  }
  const out = [
    `Sibling sessions (since ${s.since}; ${s.commitsScanned} commit(s) across all branches, ` +
      `${s.untrailered} with no trailer)`,
    "",
    "  State is INFERRED from branches and commit times, so 'still running' is not",
    "  knowable HERE and is not reported. This tool reads COMMITS; an agent that can",
    "  call the session API should ask it first -- it answers what a trailer cannot.",
  ];
  if (s.sessions.length === 0) {
    out.push("");
    out.push("  · no commit in the window carries a `Claude-Session:` trailer.");
    return out.join("\n");
  }
  for (const w of s.sessions) {
    out.push("");
    out.push(`  ${w.session}`);
    out.push(`      ${w.commits} commit(s), ${w.first} → ${w.last}`);
    out.push(`      latest: ${w.latestSubject}`);
    out.push(`      branches: ${w.branches.length ? w.branches.join(", ") : "(none contain its tip — rebased or gone)"}`);
  }
  return out.join("\n");
}

/** `4h`, `2d`, a date, or anything `git log --since` accepts. */
export function normaliseSince(arg: string | undefined): string {
  if (!arg) return "1 day ago";
  const m = /^(\d+)([hdw])$/.exec(arg.trim());
  if (!m) return arg;
  const unit = { h: "hours", d: "days", w: "weeks" }[m[2] as "h" | "d" | "w"];
  return `${m[1]} ${unit} ago`;
}

if (import.meta.main) {
  const i = process.argv.indexOf("--since");
  const since = normaliseSince(i >= 0 ? process.argv[i + 1] : undefined);
  let sweep: SessionSweep;
  try {
    sweep = sweepSessions(undefined, since);
  } catch (e) {
    console.error(`Could not sweep sessions: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT 'no siblings'. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(sweep, null, 2) : formatReport(sweep));
  process.exit(sweep.commitsScanned === 0 ? 1 : 0);
}
