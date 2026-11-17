#!/usr/bin/env bun
/**
 * Check a bean is free, then claim it on every copy — the `bean-claim-check`
 * Tool (cat-harness `work-plan/tools/bean-claim-check/`), skill `bean-drain` step 2.
 *
 * A bean's status alone does not show whether someone is working on it, so
 * this reads recent activity on every copy, then open PRs, and only then
 * claims.
 *
 * ## How the claim is written
 *
 * As a plain commit on each copy's bean branch, built with a temporary index
 * (`GIT_INDEX_FILE`) so the caller's checkout and working tree are never
 * touched. Pushed with no force. A rejected push means somebody wrote first:
 * fetch, re-read, re-check from the top, up to {@link MAX_ATTEMPTS} times.
 *
 * Copies are claimed in order. If a later copy turns out to be held, the
 * earlier claims are NOT reverted (that would be a force-shaped edit of a
 * shared branch); the outcome names them so the caller can release them with
 * a note.
 *
 * Exit: 0 claimed or would-claim, 1 skip, 2 unknown.
 *
 * @module scripts/bean-claim-check
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendNoteToText, setFieldInText } from "./beans-fallback.js";
import {
  type Agent,
  agentOf,
  argList,
  argOne,
  type Commit,
  type Copy,
  DEFAULT_AGENTS,
  DEFS_DIR,
  fetchCopy,
  git,
  type GitHub,
  heldOnBranch,
  idMatches,
  type Lookup,
  lookupOpenWork,
  type Me,
  parseBean,
  recentCommits,
  renderLookup,
  REST,
  windowMs,
} from "./lib/bean-drain.ts";

export const MAX_ATTEMPTS = 4;

export type ClaimState = "claimed" | "would-claim" | "skip-recent-commit" | "skip-claim-note" | "skip-open-pr" | "skip-closed" | "unknown";

export interface CopyReport {
  repo: string;
  ref: string;
  recent: Array<Commit & { agent: string }>;
  status?: string;
  claimCommit?: string;
  pushAttempts?: number;
}

export interface ClaimCheck {
  bean: string;
  state: ClaimState;
  copies: CopyReport[];
  openWork: Lookup;
  reason: string;
}

export interface Options {
  copies: string[];
  repos: string[];
  /** `owner/name#N` PRs that are the caller's own (the CLI takes PR links). */
  minePrs: string[];
  agents: Agent[];
  me: Me;
  windowMs: number;
  dryRun: boolean;
  gh?: GitHub;
  now?: () => Date;
}

/** Locate the bean's file at a copy's ref. */
function beanAt(c: Copy, id: string): { path: string; text: string; blob: string } | undefined {
  const ls = git(c.path, ["ls-tree", "--name-only", `${c.ref}`, "--", `${DEFS_DIR}/`]).out.split("\n");
  const path = ls.find((p) => {
    const base = p.slice(DEFS_DIR.length + 1).split("--")[0] ?? "";
    return p.endsWith(".md") && idMatches(base, id);
  });
  if (path === undefined) return undefined;
  const blob = git(c.path, ["rev-parse", `${c.ref}:${path}`]).out.trim();
  return { path, text: git(c.path, ["cat-file", "blob", blob]).out, blob };
}

/** Commit `content` at `path` on top of `c.ref`, without touching any checkout. Returns the new commit. */
function commitOnRef(c: Copy, path: string, content: string, message: string): string | { error: string } {
  const dir = mkdtempSync(join(tmpdir(), "claim-"));
  const env = { ...process.env, GIT_INDEX_FILE: join(dir, "index") };
  const run = (args: string[], input?: string) => spawnSync("git", args, { cwd: c.path, env, input, encoding: "utf8" });
  try {
    if (run(["read-tree", c.ref]).status !== 0) return { error: "read-tree failed" };
    const blob = run(["hash-object", "-w", "--stdin"], content);
    if (blob.status !== 0) return { error: "hash-object failed" };
    if (run(["update-index", "--add", "--cacheinfo", `100644,${blob.stdout.trim()},${path}`]).status !== 0) return { error: "update-index failed" };
    const tree = run(["write-tree"]);
    if (tree.status !== 0) return { error: "write-tree failed" };
    const parent = git(c.path, ["rev-parse", c.ref]).out.trim();
    const commit = run(["commit-tree", tree.stdout.trim(), "-p", parent], message);
    if (commit.status !== 0) return { error: `commit-tree failed: ${commit.stderr.trim()}` };
    return commit.stdout.trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function claimMessage(id: string, me: Me): string {
  return [
    `beans(${id}): claim in-progress (bean drain, ${me.agent})`,
    "",
    "Claim only, no work. Plain commit, written by bean-claim-check after",
    "checking recent commits on every copy and open PRs naming the bean.",
    ...(me.session ? ["", `Claude-Session: ${me.session}`] : []),
    "",
  ].join("\n");
}

/** The whole check, then the claim. */
export function claimCheck(id: string, o: Options): ClaimCheck {
  const now = o.now ?? (() => new Date());
  const empty: Lookup = { query: { kind: "bean", value: id }, checkedAt: now().toISOString(), hits: [], unread: [] };
  const fail = (reason: string, copies: CopyReport[] = [], openWork = empty): ClaimCheck => ({ bean: id, state: "unknown", copies, openWork, reason });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 1. Fetch every copy, each in its own command.
    const copies: Copy[] = [];
    for (const p of o.copies) {
      const c = fetchCopy(p);
      if ("error" in c) return fail(c.error);
      copies.push(c);
    }

    // 2. Activity on the bean's file, per copy.
    const reports: CopyReport[] = [];
    const found: Array<{ c: Copy; path: string; text: string }> = [];
    for (const c of copies) {
      const b = beanAt(c, id);
      if (b === undefined) {
        reports.push({ repo: c.repo, ref: c.branch, recent: [] });
        continue;
      }
      const recent = recentCommits(c.path, c.ref, b.path, 3);
      const bean = parseBean(b.path, b.text)!;
      reports.push({ repo: c.repo, ref: c.branch, recent: recent.map((r) => ({ ...r, agent: agentOf(r.author, o.agents)?.name ?? "other" })), status: bean.status });
      const held = heldOnBranch(bean, recent, o.agents, o.me, now().getTime(), o.windowMs);
      if (held) return { bean: id, state: held.state, copies: reports, openWork: empty, reason: `${c.repo}: ${held.reason}` };
      found.push({ c, path: b.path, text: b.text });
    }
    if (found.length === 0) return fail(`no bean matching "${id}" on any copy`, reports);

    // 3. Open work naming the bean.
    const repos = o.repos.length > 0 ? o.repos : [...new Set(copies.map((c) => c.repo))];
    const openWork = lookupOpenWork({ kind: "bean", value: id }, repos, o.gh ?? REST, now());
    // Every cloud thread's PR has the same author, so authorship cannot tell
    // ours from a sibling's. Any open PR counts, unless the caller names it as
    // its own with --mine-pr (resuming a bean it already holds).
    const foreign = openWork.hits.filter((h) => !o.minePrs.includes(`${h.repo}#${h.pr}`));
    if (foreign.length > 0) {
      const h = foreign[0]!;
      return { bean: id, state: "skip-open-pr", copies: reports, openWork, reason: `${h.repo}#${h.pr} (${h.head}, ${h.author}, ${h.createdAt}) names it in its ${h.match}` };
    }
    if (openWork.unread.length > 0) return fail(`could not read open PRs: ${openWork.unread.join("; ")}`, reports, openWork);

    if (o.dryRun) return { bean: id, state: "would-claim", copies: reports, openWork, reason: `free on ${found.length} cop${found.length === 1 ? "y" : "ies"} and no open PR names it` };

    // 4. Claim: a plain commit on every copy that has the bean.
    const stamp = now().toISOString().replace(/\.\d{3}Z$/, "Z");
    let rejected = false;
    const claimed: string[] = [];
    for (const f of found) {
      const text = appendNoteToText(setFieldInText(f.text, "status", "in-progress", stamp), `Claimed by ${o.me.agent}${o.me.session ? ` (${o.me.session})` : ""} with bean-claim-check: no other agent's commit in the window, no open PR naming it.`, stamp);
      const commit = commitOnRef(f.c, f.path, text, claimMessage(id, o.me));
      if (typeof commit !== "string") return fail(`${f.c.repo}: ${commit.error}`, reports, openWork);
      const push = git(f.c.path, ["push", "-q", "origin", `${commit}:refs/heads/${f.c.branch}`]);
      const r = reports.find((x) => x.repo === f.c.repo)!;
      r.pushAttempts = (r.pushAttempts ?? 0) + 1;
      if (!push.ok) {
        // 5. Somebody wrote first. Never force: re-read and re-check from the top.
        if (/rejected|non-fast-forward|fetch first/i.test(push.err)) { rejected = true; break; }
        return fail(`${f.c.repo}: push failed: ${push.err.trim().split("\n")[0]}`, reports, openWork);
      }
      r.claimCommit = commit;
      r.status = "in-progress";
      claimed.push(f.c.repo);
    }
    if (!rejected) return { bean: id, state: "claimed", copies: reports, openWork, reason: `claimed on ${claimed.join(" and ")}` };
    if (claimed.length > 0) return fail(`claimed on ${claimed.join(", ")} but a later copy rejected the push; release those with a note or re-run`, reports, openWork);
  }
  return fail(`every one of ${MAX_ATTEMPTS} attempts lost a push race`);
}

export function render(r: ClaimCheck): string {
  const lines = [`${r.bean}: ${r.state} — ${r.reason}`];
  for (const c of r.copies) {
    lines.push(`- ${c.repo} ${c.ref}: ${c.status ?? "absent"}${c.claimCommit ? `, claim ${c.claimCommit.slice(0, 7)}` : ""}`);
    for (const x of c.recent) lines.push(`  - ${x.at} ${x.agent} ${x.author}: ${x.subject}`);
  }
  lines.push(renderLookup(r.openWork));
  return lines.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const id = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !argv[i - 1]!.startsWith("--")));
  if (id === undefined || !/^[a-z0-9-]+$/.test(id)) {
    console.error("usage: bun run cat beans:claim-check <id> [--copy <checkout>]... [--repo owner/name]... [--mine-pr <PR link>]... [--as cloud] [--session <url>] [--agents <file>] [--window 24h] [--dry-run] [--json]");
    process.exit(2);
  }
  const agentsFile = argOne(argv, "--agents");
  const w = windowMs(argOne(argv, "--window") ?? "24h");
  if (w === undefined) { console.error("--window is a count and a unit: 90m, 24h, 2d, 1w"); process.exit(2); }
  const r = claimCheck(id, {
    copies: argList(argv, "--copy").length > 0 ? argList(argv, "--copy") : [process.cwd()],
    repos: argList(argv, "--repo"),
    // A PR link, https://github.com/<owner>/<name>/pull/<n>, read as owner/name#n.
    minePrs: argList(argv, "--mine-pr").map((u) => u.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+).*$/, "$1#$2")),
    agents: agentsFile ? (JSON.parse(readFileSync(agentsFile, "utf8")) as Agent[]) : DEFAULT_AGENTS,
    me: { agent: argOne(argv, "--as") ?? "cloud", session: argOne(argv, "--session") ?? process.env.CLAUDE_SESSION_URL },
    windowMs: w,
    dryRun: argv.includes("--dry-run"),
  });
  console.log(argv.includes("--json") ? JSON.stringify(r, null, 2) : render(r));
  process.exit(r.state === "claimed" || r.state === "would-claim" ? 0 : r.state === "unknown" ? 2 : 1);
}
