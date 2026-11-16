/**
 * Git helpers for branch-aware content resolution.
 *
 * Uses `git show <branch>:<path>` to read files from any branch
 * without checking it out. Falls back to disk reads for the
 * current working-tree branch (fast path).
 *
 * @module scripts/mcp-server/git
 */

import { folioDir } from "../../schemas/kg/cat-harness.js";
import { REPO_ROOT } from "./paths.js";
import { readFileSync, existsSync, writeFileSync, unlinkSync, mkdirSync, symlinkSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";

/** Run a git command and return trimmed stdout, or null on failure. */
function git(...args: string[]): string | null {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, stdio: "pipe", timeout: 5000 });
  if (result.status !== 0) return null;
  return result.stdout.toString().trim();
}

/** Get the current HEAD branch name (e.g. "main", "feature-x"). */
export function currentBranch(): string {
  return git("rev-parse", "--abbrev-ref", "HEAD") || "HEAD";
}

/**
 * The commit `branch` points at (the current HEAD when absent), as a full SHA,
 * or `undefined` when git cannot resolve it.
 *
 * Memoised for a few seconds: a page asks once per Lean block, and hundreds of
 * `git rev-parse` calls for one page would cost more than the page. Short,
 * because a branch moves, and a stale commit would pair a line number read
 * from today's file with yesterday's text.
 */
const commitMemo = new Map<string, { sha: string | undefined; at: number }>();
export function commitOf(branch: string | undefined): string | undefined {
  const key = branch ?? "HEAD";
  const hit = commitMemo.get(key);
  if (hit && Date.now() - hit.at < 5000) return hit.sha;
  const sha = git("rev-parse", "--verify", "--quiet", `${key}^{commit}`) ?? undefined;
  commitMemo.set(key, { sha, at: Date.now() });
  return sha;
}

/** Fetch from origin silently (best-effort, never blocks). */
export function fetchOrigin(): void {
  try {
    spawnSync("git", ["fetch", "--prune", "--quiet"], { cwd: REPO_ROOT, stdio: "pipe", timeout: 10000 });
  } catch { /* ignore fetch failures */ }
}

/** List all branch names (local + remote tracking, deduplicated).
 *  Order: current branch first, then main/master, then top 5 most
 *  recently committed branches, then remaining alphabetical.
 *  Returns { branches, recentCount } where recentCount is the number
 *  of recent branches (after current + main). */
export function listBranches(): { branches: string[]; recentCount: number } {
  // Local branches
  const localRaw = git("branch", "--list", "--format=%(refname:short)");
  const local = new Set((localRaw || "").split("\n").filter(Boolean));

  // Remote branches (strip origin/ prefix)
  const remoteRaw = git("branch", "-r", "--format=%(refname:short)");
  const remote = (remoteRaw || "").split("\n").filter(Boolean)
    .map(b => b.replace(/^origin\//, ""))
    .filter(b => b !== "HEAD");

  for (const b of remote) local.add(b);

  const current = currentBranch();
  const allNames = [...local];

  // Get recent branches by committer date (top 5 excluding current/main)
  let recentSet = new Set<string>();
  try {
    const recentRaw = spawnSync("git", [
      "branch", "-a", "--sort=-committerdate",
      "--format=%(refname:short)",
    ], { cwd: REPO_ROOT, stdio: "pipe", timeout: 5000 });
    if (recentRaw.status === 0) {
      const recent = (recentRaw.stdout?.toString() || "").split("\n")
        .filter(Boolean)
        .map(b => b.replace(/^origin\//, ""))
        .filter(b => b !== "HEAD" && b !== current && b !== "main" && b !== "master");
      // Deduplicate and take top 5
      const seen = new Set<string>();
      for (const b of recent) {
        if (!seen.has(b) && allNames.includes(b)) {
          seen.add(b);
          if (seen.size >= 5) break;
        }
      }
      recentSet = seen;
    }
  } catch { /* fall back to alphabetical */ }

  // Sort: current first, then main/master, then recent (by recency),
  // then remaining alphabetical
  const sorted = allNames.sort((a, b) => {
    if (a === current) return -1;
    if (b === current) return 1;
    if (a === "main" || a === "master") return -1;
    if (b === "main" || b === "master") return 1;
    const aRecent = recentSet.has(a);
    const bRecent = recentSet.has(b);
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;
    return a.localeCompare(b);
  });
  return { branches: sorted, recentCount: recentSet.size };
}

/** Get the commit hash for a branch (for cache invalidation). */
export function branchHead(branch: string): string | null {
  return git("rev-parse", branch);
}

/**
 * Find the merge-base (common ancestor) of two branches.
 * This is where `head` diverged from `base`, so diffs only show
 * what the branch actually changed — not what happened on base after forking.
 */
export function mergeBase(base: string, head: string): string | null {
  return git("merge-base", base, head);
}

/**
 * Check if the given branch is the current working-tree branch.
 * When true, callers should read from disk instead of git.
 */
export function isCurrentBranch(branch: string | undefined): boolean {
  if (!branch) return true;
  return branch === currentBranch();
}

/**
 * Read a file from a specific branch via `git show`.
 * Path is relative to repo root.
 * Returns file contents as string, or null if not found.
 */
export function gitShow(branch: string, relPath: string): string | null {
  return git("show", `${branch}:${relPath}`);
}

/**
 * Check if a file exists on a specific branch.
 */
export function gitShowExists(branch: string, relPath: string): boolean {
  const result = spawnSync("git", ["cat-file", "-t", `${branch}:${relPath}`], {
    cwd: REPO_ROOT, stdio: "pipe", timeout: 3000,
  });
  return result.status === 0;
}

/**
 * List directory entries on a specific branch.
 * Returns array of entry names (files and dirs).
 */
export function gitLs(branch: string, relDir: string): string[] {
  const raw = git("ls-tree", "--name-only", `${branch}:${relDir}`);
  if (!raw) return [];
  return raw.split("\n").filter(Boolean);
}

// ── Block changelog (derived from git log) ────────────────────────

export interface BlockCommit {
  sha: string;
  shortSha: string;
  date: string;
  author: string;
  message: string;
}

/**
 * Get git log for a set of files (a block's .ts, .md, .lean siblings).
 * Returns commits that touched any of the given files, newest first.
 */
export function gitLogFiles(relPaths: string[], limit = 20): BlockCommit[] {
  const result = spawnSync("git", [
    "log", `--max-count=${limit}`,
    "--pretty=format:%H|%h|%aI|%an|%s",
    "--", ...relPaths,
  ], { cwd: REPO_ROOT, stdio: "pipe", timeout: 5000 });
  if (result.status !== 0) return [];
  return result.stdout.toString().trim().split("\n").filter(Boolean).map(line => {
    const [sha, shortSha, date, author, ...rest] = line.split("|");
    return { sha, shortSha, date, author, message: rest.join("|") };
  });
}

/**
 * Read a file's content at a specific commit SHA.
 * Wrapper around gitShow that accepts full commit hashes.
 */
export function gitShowAt(sha: string, relPath: string): string | null {
  return git("show", `${sha}:${relPath}`);
}

/**
 * Read a binary file at a specific commit SHA.
 * Returns a Buffer or null.
 */
export function gitShowBinaryAt(sha: string, relPath: string): Buffer | null {
  const result = spawnSync("git", ["show", `${sha}:${relPath}`], {
    cwd: REPO_ROOT, stdio: "pipe", timeout: 5000,
  });
  if (result.status !== 0) return null;
  return result.stdout as Buffer;
}

// ── TypeScript module evaluation from git branches ────────────────

const TMP_DIR = join(REPO_ROOT, ".folio-assistant-tmp");

/**
 * Import a TypeScript module from a non-current branch.
 *
 * Writes the file to a temp location, imports it, then cleans up.
 * Cached by branch HEAD hash + path to avoid repeated imports.
 */
const tsCache = new Map<string, { head: string; value: unknown }>();

export async function gitImportTs(branch: string, relPath: string): Promise<unknown> {
  const head = branchHead(branch);
  const cacheKey = `${branch}:${relPath}`;
  const cached = tsCache.get(cacheKey);
  if (cached && cached.head === head) return cached.value;

  const source = gitShow(branch, relPath);
  if (source === null) return null;

  // Write to a temp file that preserves directory structure so relative
  // imports (e.g. "../../schema/builders") resolve correctly.
  const branchTmpDir = join(TMP_DIR, `branch_${branch.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
  const tmpFile = join(branchTmpDir, relPath);
  const tmpDir = join(tmpFile, "..");
  mkdirSync(tmpDir, { recursive: true });
  try {
    // Also need to ensure imported relative deps are on disk.
    // For content .ts files, they import from schema/ which lives on disk
    // and is the same across branches. We symlink content/schema → real schema.
    const schemaLink = join(folioDir(branchTmpDir),  "schema");
    const realSchema = join(folioDir(REPO_ROOT),  "schema");
    if (!existsSync(schemaLink) && existsSync(realSchema)) {
      mkdirSync(folioDir(branchTmpDir), { recursive: true });
      try {
        symlinkSync(realSchema, schemaLink, "dir");
      } catch {}
    }

    writeFileSync(tmpFile, source, "utf-8");
    delete require.cache?.[tmpFile];
    const mod = await import(`${tmpFile}?t=${Date.now()}`);
    const value = mod.default ?? mod;

    if (head) tsCache.set(cacheKey, { head, value });
    return value;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Read a file — from disk if current branch, from git otherwise.
 * relPath is relative to repo root.
 */
export function readFileBranch(branch: string | undefined, relPath: string): string | null {
  if (isCurrentBranch(branch)) {
    const absPath = resolve(REPO_ROOT, relPath);
    if (!existsSync(absPath)) return null;
    return readFileSync(absPath, "utf-8");
  }
  return gitShow(branch!, relPath);
}

/**
 * Check file existence — on disk if current branch, via git otherwise.
 */
export function fileExistsBranch(branch: string | undefined, relPath: string): boolean {
  if (isCurrentBranch(branch)) {
    return existsSync(resolve(REPO_ROOT, relPath));
  }
  return gitShowExists(branch!, relPath);
}

/**
 * Import a .ts module — from disk if current branch, via temp file otherwise.
 *
 * Generic in the module's default export. It returned `Promise<unknown>`, so
 * every one of the dozen call sites cast the result — and they all reached for
 * `as any` rather than `as Chapter` / `as Block` / `as Paper`, which the schema
 * already defines. The cast moves to the type argument, where it is at least
 * named. Still a claim about a dynamically imported module, not a check: `T`
 * defaults to `unknown` so an un-annotated call stays honest.
 */
export async function importTsBranch<T = unknown>(
  branch: string | undefined,
  relPath: string,
): Promise<T> {
  if (isCurrentBranch(branch)) {
    const absPath = resolve(REPO_ROOT, relPath);
    delete require.cache?.[absPath];
    // Bust ESM module cache with timestamp query param
    const mod = await import(`${absPath}?t=${Date.now()}`);
    return (mod.default ?? mod) as T;
  }
  return gitImportTs(branch!, relPath) as Promise<T>;
}

/**
 * List directory — from disk if current branch, via git otherwise.
 */
export function listDirBranch(branch: string | undefined, relDir: string): string[] {
  if (isCurrentBranch(branch)) {
    const absPath = resolve(REPO_ROOT, relDir);
    if (!existsSync(absPath)) return [];
    return readdirSync(absPath);
  }
  return gitLs(branch!, relDir);
}
