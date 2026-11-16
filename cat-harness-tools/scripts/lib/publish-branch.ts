/**
 * Start a publish branch that does not exist yet: an ORPHAN commit holding
 * only `.nojekyll`, pushed to the remote, so a first publish has a branch to
 * clone and replace instead of failing.
 *
 * An IG's first agent publish (2026-11-06) failed with "could not clone
 * gh-pages" because origin had no `gh-pages` yet, and the repository grew a
 * pre-check in its own publish script to make the branch by hand. The
 * publisher makes it instead.
 *
 * Built with plumbing in a throwaway bare repository (`hash-object`,
 * `mktree`, `commit-tree`), so no checkout, worktree or ref of the caller's
 * is touched, and no `git worktree add --orphan` (git 2.42+) is needed.
 *
 * A remote that does not answer is never read as "no branch": creating a
 * branch over one nobody checked could only fail, or worse.
 *
 * @module cat-harness-tools/scripts/lib/publish-branch
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The one file a new publish branch holds: GitHub Pages serves the files as they are, with no Jekyll run. */
export const NEW_BRANCH_FILE = ".nojekyll";

export type PublishBranchState = "exists" | "created";

function git(cwd: string | undefined, args: string[], o: { input?: string; env?: NodeJS.ProcessEnv } = {}) {
  const r = spawnSync("git", cwd ? ["-C", cwd, ...args] : args, { encoding: "utf-8", input: o.input, env: { ...process.env, ...o.env }, stdio: ["pipe", "pipe", "pipe"] });
  return { ok: r.status === 0, status: r.status, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

/** Whether `remote` has `branch`: true, false, or a reason it did not answer. */
export function remoteHasBranch(remote: string, branch: string): boolean | { unknown: string } {
  const r = git(undefined, ["ls-remote", "--exit-code", "--heads", remote, `refs/heads/${branch}`]);
  if (r.ok) return true;
  // `--exit-code`: 2 means the remote answered and has no such ref.
  if (r.status === 2) return false;
  return { unknown: r.err.split("\n")[0] || `git ls-remote exited ${r.status}` };
}

/**
 * Make sure `remote` has `branch`. When it has none, push an orphan commit
 * holding only {@link NEW_BRANCH_FILE} and answer `created`; when it has one,
 * change nothing and answer `exists`. A push that loses to a concurrent
 * publisher's creation is `exists`. Throws when the remote cannot be read or
 * the branch cannot be made.
 */
export function ensurePublishBranch(
  remote: string,
  branch: string,
  o: { name?: string; email?: string; log?: (s: string) => void } = {},
): PublishBranchState {
  const has = remoteHasBranch(remote, branch);
  if (has === true) return "exists";
  if (has !== false) throw new Error(`could not read ${branch} from ${remote} (${has.unknown}); not starting one over a branch nobody checked`);
  const dir = mkdtempSync(join(tmpdir(), "publish-branch-"));
  try {
    const must = (r: ReturnType<typeof git>, what: string): string => {
      if (!r.ok) throw new Error(`could not start ${branch}: ${what} failed (${r.err.split("\n")[0]})`);
      return r.out;
    };
    must(git(undefined, ["init", "-q", "--bare", dir]), "git init");
    const blob = must(git(dir, ["hash-object", "-w", "--stdin"], { input: "" }), "hash-object");
    const tree = must(git(dir, ["mktree"], { input: `100644 blob ${blob}\t${NEW_BRANCH_FILE}\n` }), "mktree");
    const name = o.name ?? "Claude";
    const email = o.email ?? "noreply@anthropic.com";
    const env = { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };
    const commit = must(git(dir, ["commit-tree", tree, "-m", `Start ${branch}: an empty site (${NEW_BRANCH_FILE} only)`], { env }), "commit-tree");
    const push = git(dir, ["push", "-q", remote, `${commit}:refs/heads/${branch}`]);
    if (!push.ok) {
      // Somebody else started it between the read and the push: theirs stands.
      if (remoteHasBranch(remote, branch) === true) return "exists";
      throw new Error(`could not start ${branch} on ${remote}: ${push.err.split("\n")[0]}`);
    }
    o.log?.(`· ${remote} had no ${branch} branch: started it as an orphan holding ${NEW_BRANCH_FILE}`);
    return "created";
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
