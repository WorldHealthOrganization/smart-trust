/**
 * A throwaway git repository with KNOWN facts, for a test of logic that reads git.
 *
 * ## Why a test needs one (owner, 2026-10-06: "Throwaway repository, plus moving
 * the real-repo checks")
 *
 * A dozen tests asked THIS checkout's git for the input to the function under
 * test — its `origin` remote, its `HEAD`, a remote-tracking ref — and so passed
 * only where the checkout happened to have them. Standing alone
 * (`check:cat-harness-standalone`), cat-harness is a fresh clone with no
 * `origin` and one commit, and every one of them failed on a missing input
 * rather than on a defect: a failure that looks exactly like a regression.
 *
 * The function under test was never about this checkout. Address derivation,
 * the upload-URL shape, a commit IRI, resolving a short sha: each is logic over
 * WHATEVER repository it is handed. So it is handed this one, whose every fact
 * is set here and therefore known, and the assertions stay exactly as strict.
 *
 * A check that THIS repository is configured right is the other case, and it
 * does not use this: it keeps its assertion verbatim and moves to the
 * checkout's declared test home, `test/` at the root (`kg-separation`).
 *
 * @module test/support/git-fixture
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** The `origin` every fixture carries unless told otherwise — `.git` suffix included, on purpose. */
export const FIXTURE_REMOTE = "https://github.com/example/demo.git";

/** {@link FIXTURE_REMOTE} as a web URL, which is what the derivations should produce from it. */
export const FIXTURE_REPO_URL = "https://github.com/example/demo";

export interface GitFixture {
  /** The repository's work tree. */
  root: string;
  /** The full sha of its one commit. */
  sha: string;
  /** Run git in it; returns trimmed stdout. */
  git: (...args: string[]) => string;
  cleanup: () => void;
}

export interface GitFixtureOptions {
  /** Files to commit, by repo-relative path. Default: one `AGENTS.md`. */
  files?: Record<string, string>;
  /** The `origin` URL, or `null` for a repository with no remote. Default {@link FIXTURE_REMOTE}. */
  remote?: string | null;
  /**
   * Also record the commit as `refs/remotes/origin/main` — what a fetch of a
   * pushed `main` leaves behind — without any network. Default false.
   */
  pushed?: boolean;
}

/**
 * `git init`, a local identity, the files, ONE commit on `main`, and an
 * `origin` remote. Everything set locally, so nothing the developer's global
 * git config says (signing, default branch, identity) can change a fact a test
 * asserts.
 */
export function gitFixtureRepo(opts: GitFixtureOptions = {}): GitFixture {
  // input-site: inert #d37a2b31 — a scratch repository under the temp dir, removed by its cleanup; its name never reaches an answer
  const root = mkdtempSync(join(tmpdir(), "git-fixture-"));
  const git = (...args: string[]): string =>
    // input-site: tree #9757f5b2 — git in the fixture's own scratch repository, with every setting a test relies on set locally: git's answer, which the cone records
    execFileSync("git", ["-C", root, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  for (const [rel, body] of Object.entries(opts.files ?? { "AGENTS.md": "# fixture\n" })) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  git("add", "-A");
  git("commit", "-q", "--allow-empty", "-m", "fixture");
  const remote = opts.remote === undefined ? FIXTURE_REMOTE : opts.remote;
  if (remote !== null) git("remote", "add", "origin", remote);
  const sha = git("rev-parse", "HEAD");
  if (opts.pushed) git("update-ref", "refs/remotes/origin/main", sha);
  return { root, sha, git, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
