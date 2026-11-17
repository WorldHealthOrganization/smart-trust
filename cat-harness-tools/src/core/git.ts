/**
 * Folio Assistant — Git helpers for branch-aware content resolution.
 *
 * Uses `git show <branch>:<path>` to read files from any branch
 * without checking it out. Falls back to disk reads for the
 * current working-tree branch (fast path).
 *
 * @module folio-assistant/core/git
 */

import { folioDir } from "../../schemas/kg/cat-harness.js";
import { readFileSync, existsSync, writeFileSync, unlinkSync, mkdirSync, symlinkSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";

/** Run a git command and return trimmed stdout, or null on failure. */
function git(repoRoot: string, ...args: string[]): string | null {
  const result = spawnSync("git", args, { cwd: repoRoot, stdio: "pipe", timeout: 5000 });
  if (result.status !== 0) return null;
  return result.stdout.toString().trim();
}

export class GitHelper {
  constructor(private repoRoot: string) {}

  /** Get the current HEAD branch name. */
  currentBranch(): string {
    return git(this.repoRoot, "rev-parse", "--abbrev-ref", "HEAD") || "HEAD";
  }

  /** Fetch from origin silently (best-effort). */
  fetchOrigin(): void {
    try {
      spawnSync("git", ["fetch", "--prune", "--quiet"], {
        cwd: this.repoRoot,
        stdio: "pipe",
        timeout: 10000,
      });
    } catch {}
  }

  /** List all branch names (local + remote tracking, deduplicated). */
  listBranches(): string[] {
    const localRaw = git(this.repoRoot, "branch", "--list", "--format=%(refname:short)");
    const local = new Set((localRaw || "").split("\n").filter(Boolean));

    const remoteRaw = git(this.repoRoot, "branch", "-r", "--format=%(refname:short)");
    const remote = (remoteRaw || "")
      .split("\n")
      .filter(Boolean)
      .map((b) => b.replace(/^origin\//, ""))
      .filter((b) => b !== "HEAD");

    for (const b of remote) local.add(b);

    const current = this.currentBranch();
    return [...local].sort((a, b) => {
      if (a === current) return -1;
      if (b === current) return 1;
      if (a === "main" || a === "master") return -1;
      if (b === "main" || b === "master") return 1;
      return a.localeCompare(b);
    });
  }

  /** Get the commit hash for a branch. */
  branchHead(branch: string): string | null {
    return git(this.repoRoot, "rev-parse", branch);
  }

  /** Find the merge-base (common ancestor) of two branches. */
  mergeBase(base: string, head: string): string | null {
    return git(this.repoRoot, "merge-base", base, head);
  }

  /** Check if the given branch is the current working-tree branch. */
  isCurrentBranch(branch: string | undefined): boolean {
    if (!branch) return true;
    return branch === this.currentBranch();
  }

  /** Read a file from a specific branch via `git show`. */
  gitShow(branch: string, relPath: string): string | null {
    return git(this.repoRoot, "show", `${branch}:${relPath}`);
  }

  /** Check if a file exists on a specific branch. */
  gitShowExists(branch: string, relPath: string): boolean {
    const result = spawnSync("git", ["cat-file", "-t", `${branch}:${relPath}`], {
      cwd: this.repoRoot,
      stdio: "pipe",
      timeout: 3000,
    });
    return result.status === 0;
  }

  /** List directory entries on a specific branch. */
  gitLs(branch: string, relDir: string): string[] {
    const raw = git(this.repoRoot, "ls-tree", "--name-only", `${branch}:${relDir}`);
    if (!raw) return [];
    return raw.split("\n").filter(Boolean);
  }

  /** Read a file — from disk if current branch, from git otherwise. */
  readFileBranch(branch: string | undefined, relPath: string): string | null {
    if (this.isCurrentBranch(branch)) {
      const absPath = resolve(this.repoRoot, relPath);
      if (!existsSync(absPath)) return null;
      return readFileSync(absPath, "utf-8");
    }
    return this.gitShow(branch!, relPath);
  }

  /** Check file existence — on disk if current branch, via git otherwise. */
  fileExistsBranch(branch: string | undefined, relPath: string): boolean {
    if (this.isCurrentBranch(branch)) {
      return existsSync(resolve(this.repoRoot, relPath));
    }
    return this.gitShowExists(branch!, relPath);
  }

  /**
   * Import a TypeScript module from a non-current branch.
   * Writes the file to a temp location, imports it, then cleans up.
   */
  private tsCache = new Map<string, { head: string; value: unknown }>();
  private tmpDir: string | undefined;

  private getTmpDir(): string {
    if (!this.tmpDir) {
      this.tmpDir = join(this.repoRoot, ".folio-tmp");
    }
    return this.tmpDir;
  }

  async gitImportTs(branch: string, relPath: string): Promise<unknown> {
    const head = this.branchHead(branch);
    const cacheKey = `${branch}:${relPath}`;
    const cached = this.tsCache.get(cacheKey);
    if (cached && cached.head === head) return cached.value;

    const source = this.gitShow(branch, relPath);
    if (source === null) return null;

    const branchTmpDir = join(
      this.getTmpDir(),
      `branch_${branch.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    );
    const tmpFile = join(branchTmpDir, relPath);
    const tmpFileDir = join(tmpFile, "..");
    mkdirSync(tmpFileDir, { recursive: true });
    try {
      // Symlink schema dir for relative imports
      const schemaLink = join(folioDir(branchTmpDir),  "schema");
      const realSchema = join(folioDir(this.repoRoot),  "schema");
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

      if (head) this.tsCache.set(cacheKey, { head, value });
      return value;
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {}
    }
  }

  /**
   * Import a .ts module — from disk if current branch, via temp file otherwise.
   *
   * Generic, matching `adapters/mcp-server/git.ts`: every caller knows the
   * manifest shape it asked for, and returning bare `unknown` meant each one
   * re-asserted it with `as any` — nine of them in `adapters/paper/resolver.ts`
   * alone, which is how `blk.status` (a field no block manifest carries) went
   * unnoticed there. `T` defaults to `unknown`, so a caller that does not
   * supply one is no worse off than before.
   */
  async importTsBranch<T = unknown>(branch: string | undefined, relPath: string): Promise<T> {
    if (this.isCurrentBranch(branch)) {
      const absPath = resolve(this.repoRoot, relPath);
      delete require.cache?.[absPath];
      const mod = await import(`${absPath}?t=${Date.now()}`);
      return (mod.default ?? mod) as T;
    }
    return this.gitImportTs(branch!, relPath) as Promise<T>;
  }

  /** Get commits that touched any of the given files (relative paths). */
  gitLogFiles(relPaths: string[], limit = 20): Array<{ sha: string; shortSha: string; date: string; author: string; message: string }> {
    const result = spawnSync("git", [
      "log", `--max-count=${limit}`,
      "--pretty=format:%H|%h|%aI|%an|%s",
      "--", ...relPaths,
    ], { cwd: this.repoRoot, stdio: "pipe", timeout: 5000 });
    if (result.status !== 0) return [];
    return result.stdout.toString().trim().split("\n").filter(Boolean).map(line => {
      const [sha, shortSha, date, author, ...rest] = line.split("|");
      return { sha, shortSha, date, author, message: rest.join("|") };
    });
  }

  /** Read a binary file at a specific commit SHA. */
  gitShowBinaryAt(sha: string, relPath: string): Buffer | null {
    const result = spawnSync("git", ["show", `${sha}:${relPath}`], {
      cwd: this.repoRoot, stdio: "pipe", timeout: 5000,
    });
    if (result.status !== 0) return null;
    return result.stdout as Buffer;
  }

  /** List directory — from disk if current branch, via git otherwise. */
  listDirBranch(branch: string | undefined, relDir: string): string[] {
    if (this.isCurrentBranch(branch)) {
      const absPath = resolve(this.repoRoot, relDir);
      if (!existsSync(absPath)) return [];
      return readdirSync(absPath);
    }
    return this.gitLs(branch!, relDir);
  }
}
