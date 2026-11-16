/**
 * A scratch `gh-pages` origin, and the three ways the staging jobs check it
 * out: FULL (every blob on disk), SPARSE (cone mode, `--filter=blob:none`,
 * as the preview deploy can), and BARE-TREE (`--no-checkout`,
 * `--filter=blob:none`, as the changes page can). A test runs the same script
 * on two of them and expects the same answer.
 *
 * @module scripts/tests/sdlc/gh-pages-fixture
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
};

/** Run git in `dir`; throws with its stderr on failure. */
export function git(dir: string, ...args: string[]): string {
  const r = spawnSync("git", ["-C", dir, ...args], { env: ENV, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

/** Write `files` under `dir`. */
export function put(dir: string, files: Record<string, string | Buffer>): void {
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
}

/** An origin repository whose `gh-pages` holds `files`, served with filters and fetch-by-id. */
export function origin(files: Record<string, string | Buffer>, subject = "staging(x): from y", date = "2026-10-01T00:00:00Z"): string {
  const dir = mkdtempSync(join(tmpdir(), "gh-pages-origin-"));
  git(dir, "init", "-q", "-b", "gh-pages");
  put(dir, files);
  git(dir, "add", "-A");
  spawnSync("git", ["-C", dir, "commit", "-q", "-m", subject], {
    env: { ...ENV, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
  git(dir, "config", "uploadpack.allowFilter", "true");
  git(dir, "config", "uploadpack.allowAnySHA1InWant", "true");
  return dir;
}

function clone(from: string, ...flags: string[]): string {
  const dir = join(mkdtempSync(join(tmpdir(), "gh-pages-clone-")), "pages");
  const r = spawnSync("git", ["clone", "-q", "--depth=1", "--branch", "gh-pages", ...flags, `file://${from}`, dir], { env: ENV, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`clone: ${r.stderr}`);
  git(dir, "config", "user.name", "t");
  git(dir, "config", "user.email", "t@t");
  return dir;
}

/** Every blob on disk — what `actions/checkout` gives today. */
export function fullClone(from: string): string {
  return clone(from);
}

/** Cone-mode sparse, blobless: only `cone` (and every root-level file) on disk. */
export function sparseClone(from: string, cone: string[]): string {
  const dir = clone(from, "--filter=blob:none", "--no-checkout");
  git(dir, "sparse-checkout", "set", "--cone", ...cone);
  git(dir, "checkout", "-q", "gh-pages");
  return dir;
}

/** No checkout and no blob: only commits and trees. */
export function treeClone(from: string): string {
  return clone(from, "--filter=blob:none", "--no-checkout");
}

/** Whether `path` at HEAD still has no blob in `dir` — i.e. was never fetched. */
export function blobAbsent(dir: string, path: string): boolean {
  const oid = git(dir, "rev-parse", `HEAD:${path}`).trim();
  return git(dir, "rev-list", "--objects", "--missing=print", "HEAD").split("\n").includes(`?${oid}`);
}
