#!/usr/bin/env bun
/**
 * Publish a staged site onto a branch (default `gh-pages`) as a FULL REPLACE.
 *
 * @module scripts/publish-site
 *
 * The same command for every runner — an agent, a person at a terminal, or a
 * CI job:
 *
 *   bun run bootstrap-tools/scripts/site.ts --root . --out _site-src
 *   bun run bootstrap-tools/scripts/publish-site.ts --site _site-src --remote <git url>
 *
 * Nothing here is GitHub-specific: `--remote` is any git URL the caller can
 * push to, with whatever credentials that caller already has (a token in the
 * URL in CI, the user's own git credentials locally). Serving the branch —
 * GitHub Pages, or any static host that reads a branch — is the host's job.
 *
 * Rebuild, never rebase: each attempt clones the branch fresh, replaces every
 * tracked file with the staged site, and pushes.
 *
 * Two narrower replaces, for a branch that holds more than one site:
 *
 *   --into branches/<branch>   replace ONLY that subtree; everything else on the
 *                             branch stays (a preview never touches the root)
 *   --keep branches/ --keep branches
 *                             a full replace that keeps these top-level paths
 *                             (the root publish never deletes the previews)
 *
 * A push that loses a race is retried from a fresh clone (3 attempts), so a
 * concurrent publisher's commit is never merged into ours or overwritten by a
 * force push.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export interface PublishOptions {
  /** The staged site directory (what `site.ts --out` wrote). */
  site: string;
  /** Any git URL the caller can push to. */
  remote: string;
  branch?: string;
  message?: string;
  attempts?: number;
  /** Author for the publish commit. */
  name?: string;
  email?: string;
  /** Seconds between attempts, times the attempt number. */
  backoff?: number;
  /** Replace only this subtree of the branch (a relative path); the rest stays. */
  into?: string;
  /** On a full replace, top-level paths of the branch to keep as they are. */
  keep?: string[];
}

/** A relative path inside the branch, never `.`, absolute, or climbing out. */
function safeRelative(p: string): boolean {
  const parts = p.split("/").filter((x) => x !== "");
  return parts.length > 0 && !p.startsWith("/") && parts.every((x) => x !== "." && x !== ".." && x !== ".git");
}

export type PublishResult =
  | { state: "published"; commit: string; attempt: number }
  | { state: "current" }
  | { state: "failed"; reason: string };

function git(cwd: string, ...args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

/**
 * What a publish needs on disk, as non-cone sparse-checkout patterns, or
 * undefined for everything.
 *
 * A branch that holds many sites is mostly what a publish KEEPS: on
 * litlfred/smart-ra, gh-pages held about 690,000 files, nearly all of them
 * branches/ previews, and checking them all out filled a runner's disk ("could
 * not clone gh-pages: unable to write file branches/…", run 41411973742). Kept
 * paths are never read or written here, so they are never checked out: git
 * leaves files outside the sparse patterns as they are in the commit, and
 * `add -A` does not stage them as deleted.
 */
export function sparsePatterns(o: Pick<PublishOptions, "into" | "keep">): string[] | undefined {
  if (o.into !== undefined) return [`/${o.into.replace(/^\/+|\/+$/g, "")}/`];
  if ((o.keep ?? []).length > 0) return ["/*", ...(o.keep ?? []).map((k) => `!/${k}/`)];
  return undefined;
}

/**
 * Clone the branch at depth 1 with no blobs fetched up front, then check out
 * only `patterns` (all of it when undefined). History and the blobs of kept
 * paths are never needed: the publish commits on top of the tip and pushes.
 */
function cloneForPublish(work: string, remote: string, branch: string, patterns: string[] | undefined): { ok: boolean; out: string } {
  const clone = git(work, "clone", "--quiet", "--depth", "1", "--filter=blob:none", "--no-checkout", "--branch", branch, "--single-branch", remote, "repo");
  if (!clone.ok) return clone;
  const repo = join(work, "repo");
  if (patterns !== undefined) {
    const init = git(repo, "sparse-checkout", "set", "--no-cone", ...patterns);
    if (!init.ok) return init;
  }
  return git(repo, "checkout", "--quiet", branch);
}

/** One clone-replace-commit-push cycle per attempt. */
export function publishSite(o: PublishOptions): PublishResult {
  const site = resolve(o.site);
  if (!existsSync(site) || !statSync(site).isDirectory()) return { state: "failed", reason: `${site} is not a directory` };
  if (readdirSync(site).length === 0) return { state: "failed", reason: `${site} is empty — refusing to publish an empty site over the branch` };
  if (o.into !== undefined && !safeRelative(o.into)) return { state: "failed", reason: `--into ${o.into} is not a relative path inside the branch` };
  for (const k of o.keep ?? []) if (!safeRelative(k) || k.includes("/")) return { state: "failed", reason: `--keep ${k} is not a top-level path of the branch` };
  if (o.into !== undefined && (o.keep ?? []).length > 0) return { state: "failed", reason: "--into and --keep are exclusive: --into already keeps everything outside its subtree" };
  const branch = o.branch ?? "gh-pages";
  const attempts = o.attempts ?? 3;
  let last = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const work = mkdtempSync(join(tmpdir(), "publish-site-"));
    try {
      const clone = cloneForPublish(work, o.remote, branch, sparsePatterns(o));
      if (!clone.ok) return { state: "failed", reason: `could not clone ${branch}: ${clone.out}` };
      const repo = join(work, "repo");
      if (o.into !== undefined) {
        const dest = join(repo, o.into);
        rmSync(dest, { recursive: true, force: true });
        cpSync(site, dest, { recursive: true });
      } else {
        const keep = new Set([".git", ...(o.keep ?? [])]);
        for (const f of readdirSync(repo)) if (!keep.has(f)) rmSync(join(repo, f), { recursive: true, force: true });
        for (const f of readdirSync(site)) {
          // A kept path is the branch's, not the staged site's: never overwrite it.
          if (keep.has(f)) continue;
          cpSync(join(site, f), join(repo, f), { recursive: true });
        }
      }
      git(repo, "config", "user.name", o.name ?? "site publisher");
      git(repo, "config", "user.email", o.email ?? "site-publisher@users.noreply.github.com");
      git(repo, "add", "-A");
      if (git(repo, "diff", "--cached", "--quiet").ok) return { state: "current" };
      const commit = git(repo, "commit", "--quiet", "-m", o.message ?? "Publish site");
      if (!commit.ok) return { state: "failed", reason: `commit failed: ${commit.out}` };
      const push = git(repo, "push", "--quiet", "origin", branch);
      if (push.ok) return { state: "published", commit: git(repo, "rev-parse", "HEAD").out, attempt };
      last = push.out;
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
    if (attempt < attempts && (o.backoff ?? 5) > 0) Bun.sleepSync(attempt * (o.backoff ?? 5) * 1000);
  }
  return { state: "failed", reason: `push to ${branch} failed after ${attempts} attempt(s): ${last}` };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const site = opt("--site");
  const remote = opt("--remote");
  if (!site || !remote) {
    console.error("usage: bun run bootstrap-tools/scripts/publish-site.ts --site <staged dir> --remote <git url> [--branch gh-pages] [--message <msg>] [--into <subdir> | --keep <top-level path>...]");
    process.exit(2);
  }
  const keep = args.flatMap((a, i) => (a === "--keep" && args[i + 1] ? [args[i + 1]] : []));
  const r = publishSite({ site, remote, branch: opt("--branch"), message: opt("--message"), name: opt("--name"), email: opt("--email"), into: opt("--into"), keep });
  if (r.state === "published") console.log(`published ${r.commit} (attempt ${r.attempt})`);
  else if (r.state === "current") console.log("branch already current");
  else { console.error(r.reason); process.exit(1); }
}
