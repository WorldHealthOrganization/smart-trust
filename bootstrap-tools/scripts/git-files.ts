/**
 * The files git accounts for under a directory — tracked, plus untracked and
 * not ignored — as absolute paths, or `undefined` when git cannot answer.
 *
 * @module bootstrap-tools/scripts/git-files
 *
 * The same rule a harness applies to its git corpus, restated here in a dozen
 * lines rather than imported, because bootstrap-tools depends on bootstrap and
 * nothing above it.
 *
 * Two answers that must not collapse: `undefined` means git could not answer
 * (not a work tree, no git) and the caller falls back or reports "could not
 * determine"; `[]` means git looked and there are none. Untracked files count,
 * because a file just written and not yet staged is part of the change a
 * check exists to examine.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function gitFiles(dir: string): string[] | undefined {
  if (!existsSync(dir)) return undefined;
  // input-site: tree #7e7c88ec — `git ls-files --cached --others --exclude-standard`: the working tree and index under `dir`
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: dir,
    encoding: "utf-8",
    // The 1 MiB default overflowed on this checkout (ENOBUFS, 2026-09-30),
    // which read as "git could not answer" and failed iri:sync:check.
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error !== undefined || r.status !== 0) return undefined;
  return r.stdout.split("\0").filter(Boolean).map((p) => join(dir, p));
}

/**
 * The files git has COMMITTED or STAGED under a directory (`--cached`), as
 * absolute paths, with the untracked-and-not-ignored files it left out named
 * beside them; `undefined` when git cannot answer.
 *
 * For a value that must be a function of the commit (bean `ba9e`): what
 * {@link gitFiles} returns also depends on whatever an earlier step left in
 * the worktree, so a transient nobody ignored moved a committed README and
 * reddened its check for nobody's fault. The untracked files are returned
 * rather than dropped silently: a file just written by the change under way
 * is untracked until staged, and a caller should say so rather than act as
 * though it were not there.
 */
export function committedFiles(dir: string): { files: string[]; untracked: string[] } | undefined {
  if (!existsSync(dir)) return undefined;
  const run = (args: string[]) =>
    // input-site: tree #481c0381 — `git ls-files` (`--cached`, then `--others --exclude-standard`): the working tree and index under `dir`
    spawnSync("git", ["ls-files", "-z", ...args], { cwd: dir, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  const cached = run(["--cached"]);
  const others = run(["--others", "--exclude-standard"]);
  if (cached.error !== undefined || cached.status !== 0 || others.error !== undefined || others.status !== 0) return undefined;
  const abs = (out: string) => out.split("\0").filter(Boolean).map((p) => join(dir, p));
  return { files: abs(cached.stdout), untracked: abs(others.stdout) };
}
