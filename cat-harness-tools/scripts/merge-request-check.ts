#!/usr/bin/env bun
/**
 * Check a six-line merge request against the PR as it is now.
 *
 * @module scripts/merge-request-check
 * @graphNode none — a read-only check over the GitHub API
 * @covers none — a merge-steward check on a message; the message's shape is `schemas/sdlc/merge-queue.ts`
 *
 * A sibling sends the merge manager a merge request
 * ({@link MergeRequestSchema}). Before the merge manager posts it and asks the
 * owner by card, this checks three things:
 *
 * 1. **The request is well formed**: {@link parseMergeRequest} accepts it.
 * 2. **The head is current**: the SHA on the `ready:` line is the PR's head
 *    now, and the PR is open. A push after the request makes it stale.
 * 3. **The preview was built for that head.** For folio-assistant, the
 *    "Staging preview" bot comment on the PR (one per PR, edited in place on
 *    each build; its latest body is read) names the commit it built (its
 *    `Commit` field, a short SHA, matched as a prefix of the head), and its
 *    `Status` must not read "staged … queued" (not live yet); the preview URL must have
 *    the form `https://litlfred.github.io/folio-assistant/branches/<slug>/`,
 *    with the comment's slug when the comment gives one. Another repository
 *    has no build record to check: the preview is reported as not verified,
 *    which does not refuse the request. `no preview: <reason>` needs no build.
 *
 * | verdict | meaning | exit |
 * |---|---|---|
 * | `ok` | all three hold | 0 |
 * | `refused: <reasons>` | send it back to its sender with the reasons | 1 |
 * | `unknown: <why>` | the API could not be read; never shown as refused | 2 |
 *
 * Usage:
 *   bun run cat merge:request:check -- request.txt
 *   pbpaste | bun run cat merge:request:check -- -
 *   bun run cat merge:request:check -- request.txt --json
 *
 * Exit 0 ok · 1 refused · 2 unknown, or a usage error.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { parseMergeRequest, type MergeRequest } from "../schemas/sdlc/merge-queue.ts";

/** What the check reads from GitHub; `gh api` in use, a stub in tests. */
export interface GitHubReader {
  json<T>(path: string): T;
  /** Every page of a paginated request, one element per page. */
  pages<T>(path: string): T[];
}

export type CheckVerdict = { kind: "ok"; notes: string[] } | { kind: "refused"; reasons: string[] } | { kind: "unknown"; why: string };

export const FOLIO_PREVIEW = /^https:\/\/litlfred\.github\.io\/folio-assistant\/branches\/([^/\s]+)\//;
const STAGING = /Staging preview/i;
/** `Commit: abc1234`, `**Commit:** abc1234`, `| Commit | \`abc1234\` |`, with an optional link. */
const COMMIT = /Commit\**\s*(?::|\|)\**\s*`?\[?`?([0-9a-f]{7,40})\b/i;

export interface IssueComment {
  body: string | null;
  created_at: string;
  updated_at?: string;
  user?: { login: string; type?: string } | null;
}

/** The latest "Staging preview" comment's commit and preview slug. */
export function stagingPreview(
  comments: readonly IssueComment[],
): { commit: string | null; slug: string | null; live: boolean } | null {
  const staging = comments.filter((c) => c.body && STAGING.test(c.body));
  if (staging.length === 0) return null;
  const at = (c: IssueComment) => Date.parse(c.updated_at ?? c.created_at);
  const latest = staging.reduce((a, b) => (at(b) >= at(a) ? b : a));
  const body = latest.body ?? "";
  const commit = COMMIT.exec(body)?.[1]?.toLowerCase() ?? null;
  const url = /https:\/\/litlfred\.github\.io\/folio-assistant\/branches\/[^/\s)]+\//.exec(body)?.[0];
  // "pushed to `gh-pages` …; live by about …" is rendered; "staged — … queued" is not yet.
  const status = /\*\*Status:\*\*\s*(.*)/i.exec(body)?.[1] ?? "";
  const live = !/\bstaged\b|\bqueued\b/i.test(status);
  return { commit, slug: url ? (FOLIO_PREVIEW.exec(url)?.[1] ?? null) : null, live };
}

/** A short commit names the head when the head starts with it. */
function sameCommit(short: string, full: string): boolean {
  return short.length >= 7 && full.toLowerCase().startsWith(short.toLowerCase());
}

/**
 * The preview half of the check, as a pure function: the request, the PR's
 * repository, and its comments. Returns refusal reasons and notes.
 */
export function previewFindings(r: MergeRequest, repo: string, comments: readonly IssueComment[]): { reasons: string[]; notes: string[] } {
  const reasons: string[] = [];
  const notes: string[] = [];
  if (r.preview.kind === "none") return { reasons, notes };
  if (repo.split("/").pop() !== "folio-assistant") {
    notes.push(`preview not verified: ${repo} has no build record to check`);
    return { reasons, notes };
  }
  const slug = FOLIO_PREVIEW.exec(r.preview.url)?.[1];
  if (!slug) reasons.push(`preview URL is not https://litlfred.github.io/folio-assistant/branches/<slug>/: ${r.preview.url}`);
  const built = stagingPreview(comments);
  if (built === null) {
    reasons.push('no "Staging preview" comment on the PR: the preview was not built');
    return { reasons, notes };
  }
  if (built.commit === null) reasons.push('the "Staging preview" comment names no Commit');
  else if (!sameCommit(built.commit, r.headSha)) {
    reasons.push(`preview built for ${built.commit}, head is ${r.headSha.slice(0, 12)}: wait for the rebuild`);
  }
  if (!built.live) reasons.push("the preview is staged, not live yet: wait for the Pages build");
  if (slug && built.slug && slug !== built.slug) reasons.push(`preview slug ${slug} is not the built one, ${built.slug}`);
  return { reasons, notes };
}

/** Parse the request and check it against the live PR. */
export function checkMergeRequest(api: GitHubReader, text: string): CheckVerdict {
  const parsed = parseMergeRequest(text);
  if (!parsed.success) {
    return { kind: "refused", reasons: parsed.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`) };
  }
  const r = parsed.data;
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/.exec(r.prUrl);
  if (!m) return { kind: "refused", reasons: [`prUrl: not a pull request URL: ${r.prUrl}`] };
  const [, repo, number] = m;
  let pr: { state: string; merged?: boolean; head: { sha: string } };
  let comments: IssueComment[];
  try {
    pr = api.json(`repos/${repo}/pulls/${number}`);
    comments = r.preview.kind === "url" ? api.pages<IssueComment[]>(`repos/${repo}/issues/${number}/comments?per_page=100`).flat() : [];
  } catch (err: unknown) {
    return { kind: "unknown", why: err instanceof Error ? err.message : String(err) };
  }
  const reasons: string[] = [];
  if (pr.state !== "open") reasons.push(`the PR is ${pr.merged ? "merged" : pr.state}`);
  if (pr.head.sha !== r.headSha) reasons.push(`head moved: the request names ${r.headSha.slice(0, 12)}, the PR's head is ${pr.head.sha.slice(0, 12)}`);
  const preview = previewFindings(r, repo, comments);
  reasons.push(...preview.reasons);
  return reasons.length > 0 ? { kind: "refused", reasons } : { kind: "ok", notes: preview.notes };
}

export function formatCheck(v: CheckVerdict): string {
  switch (v.kind) {
    case "ok":
      return ["ok", ...v.notes.map((n) => `  note: ${n}`)].join("\n");
    case "refused":
      return [`refused: ${v.reasons.length} reason${v.reasons.length === 1 ? "" : "s"}`, ...v.reasons.map((x) => `  - ${x}`)].join("\n");
    case "unknown":
      return `unknown: ${v.why}`;
  }
}

function gh(args: readonly string[]): string {
  const r = spawnSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || r.error?.message || `gh exited ${r.status}`).trim().split("\n")[0]);
  return r.stdout;
}

export const ghReader: GitHubReader = {
  json: <T>(path: string) => JSON.parse(gh([path])) as T,
  pages: <T>(path: string) => JSON.parse(gh(["--paginate", "--slurp", path])) as T[],
};

function main(argv: readonly string[]): number {
  const json = argv.includes("--json");
  const files = argv.filter((a) => a !== "--json");
  if (files.length !== 1) {
    console.error("usage: merge:request:check <file | -> [--json]");
    return 2;
  }
  let text: string;
  try {
    text = readFileSync(files[0] === "-" ? 0 : files[0], "utf8");
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    return 2;
  }
  const v = checkMergeRequest(ghReader, text);
  console.log(json ? JSON.stringify(v, null, 2) : formatCheck(v));
  return v.kind === "ok" ? 0 : v.kind === "refused" ? 1 : 2;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
