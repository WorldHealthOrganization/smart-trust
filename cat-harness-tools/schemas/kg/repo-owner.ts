/**
 * Who owns a checkout on GitHub, and how a SAME-OWNER repository name resolves.
 *
 * @module schemas/kg/repo-owner
 * @graphNode none — repository naming helpers, not a schema
 *
 * WHO migration, plan step T3 (owner decision Q-WP-1 = A, 2026-11-15;
 * cat-harness-tools#2337). The content layers move from one GitHub owner
 * to another by PRs from the forks, and the
 * same commit must build correctly in both places. So a content layer's pin
 * on ANOTHER content layer does not name an owner:
 *
 * ```json
 * { "name": "base", "source": { "remote": { "repository": "base", "ref": "<sha>" } } }
 * ```
 *
 * A repository written without an owner is a SAME-OWNER name: it resolves to
 * `<owner of the checkout that holds the file>/<name>`. A fork resolves to
 * the fork and WHO resolves to WHO, at the same commit, because WHO merges
 * with merge commits (plan rule M1). `{ "repository": "base",
 * "sameOwner": true }` is read the same way.
 *
 * The owner of a checkout is never declared ({@link checkoutOwner}).
 *
 * Harness layers ({@link HARNESS_REPOSITORIES}) stay absolute under
 * {@link HARNESS_OWNER}: that constant (and the two workflow `env` lines that
 * mirror it) is what changes when the harness moves to its own org.
 *
 * A repository that must name another owner on purpose keeps the absolute
 * form: a content repository that stays behind while the layers it pins
 * move names their new owner in each of those pins.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { inputSiteReached } from "../sdlc/input-trace.ts";

/** The GitHub owner of the harness layers. Change here when the harness moves. */
export const HARNESS_OWNER = "litlfred";

/**
 * The harness layers, as their GitHub addresses: always pinned with an owner
 * ({@link HARNESS_OWNER}), never same-owner. Written as addresses because
 * they name REPOSITORIES, not layers this one depends on; a test holds every
 * address to {@link HARNESS_OWNER}, so a move rewrites both together.
 */
export const HARNESS_ADDRESSES: readonly string[] = [
  "https://github.com/litlfred/bootstrap",
  "https://github.com/litlfred/bootstrap-tools",
  "https://github.com/litlfred/cat-harness",
  "https://github.com/litlfred/cat-harness-tools",
  "https://github.com/litlfred/folio-assistant",
  "https://github.com/litlfred/folio-assistant-core",
  "https://github.com/litlfred/folio-assistant-sci",
  "https://github.com/litlfred/fhir-harness",
];

/** The harness layers' repository names: the last segment of each of {@link HARNESS_ADDRESSES}. */
export const HARNESS_REPOSITORIES: readonly string[] = HARNESS_ADDRESSES.map((u) => u.slice(u.lastIndexOf("/") + 1));

/** A GitHub owner or repository name segment. */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** `owner/name`. */
const FULL = /^([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;

/** True when `repo` is a bare repository name: a same-owner name. */
export function isSameOwnerName(repo: string): boolean {
  return SEGMENT.test(repo) && !repo.includes("..");
}

/** The owner in a remote URL (`https://github.com/o/r(.git)`, `git@github.com:o/r.git`, a proxy's `…/git/o/r`). */
export function ownerFromUrl(url: string): string | undefined {
  const m = url.trim().replace(/\/+$/, "").replace(/\.git$/, "").match(/[/:]([A-Za-z0-9][A-Za-z0-9._-]*)\/[A-Za-z0-9][A-Za-z0-9._-]*$/);
  return m?.[1];
}

/**
 * The GitHub owner of the checkout at `root`, derived, never declared:
 *
 * 1. `CAT_REPO_OWNER` — an explicit override, for a dry run that builds a
 *    fork as if it were another owner's (plan T5);
 * 2. `origin`'s URL — the checkout's own answer, right for every checkout a
 *    job lays down, whichever repository's CI is running;
 * 3. `GITHUB_REPOSITORY_OWNER` — CI, when the checkout has no origin.
 *
 * `undefined` when none says; a caller that needs an owner reports it.
 */
// input-site: env CAT_REPO_OWNER,GITHUB_REPOSITORY_OWNER #3f8d28e3 — the default environment: only these two variables are read from it
export function checkoutOwner(root: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = env.CAT_REPO_OWNER?.trim();
  if (explicit) return explicit;
  try {
    // input-site: traced #1cb0a1c5 — origin's URL, from this clone's git config: no fingerprint names it, so a run that reaches it records no hash
    inputSiteReached("repo-owner: origin's URL");
    const url = execFileSync("git", ["-C", root, "remote", "get-url", "origin"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const o = url ? ownerFromUrl(url) : undefined;
    if (o) return o;
  } catch {
    /* no git, or no origin: fall through */
  }
  return env.GITHUB_REPOSITORY_OWNER?.trim() || undefined;
}

/**
 * `repo` as `owner/name`: unchanged when it names an owner; a same-owner name
 * takes `owner`. Throws when a same-owner name has no owner to take — a
 * silent guess here is a fetch from the wrong account.
 */
export function resolveRepository(repo: string, owner: string | undefined): string {
  if (!isSameOwnerName(repo)) return repo;
  if (!owner) {
    throw new Error(
      `\`${repo}\` is a same-owner repository name and this checkout's owner is unknown (no CAT_REPO_OWNER, no origin, no GITHUB_REPOSITORY_OWNER)`,
    );
  }
  return `${owner}/${repo}`;
}

/** The name part of `owner/name`, or `repo` itself when it has no owner. */
export function repositoryName(repo: string): string {
  return FULL.exec(repo)?.[2] ?? repo;
}

/** The owner part of `owner/name`, or `undefined` for a same-owner name. */
export function repositoryOwner(repo: string): string | undefined {
  return FULL.exec(repo)?.[1];
}

/** True when two owners are the same GitHub account (GitHub owners are case-insensitive). */
export function sameOwner(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();
}

/** True when `repo` (bare or `owner/name`) is a harness layer. */
export function isHarnessRepository(repo: string): boolean {
  return HARNESS_REPOSITORIES.includes(repositoryName(repo));
}

type LockShape = {
  mounts?: Array<{ repository?: unknown }>;
  instances?: Array<{ repository?: unknown }>;
};

/**
 * A lock with every same-owner `repository` resolved against `owner` — a
 * copy; the input is not changed. Entries that already name an owner, and
 * entries with no string `repository`, are left as they are.
 */
export function resolveLockRepositories<T extends LockShape>(lock: T, owner: string | undefined): T {
  const fix = <E extends { repository?: unknown }>(e: E): E =>
    typeof e?.repository === "string" && isSameOwnerName(e.repository) ? { ...e, repository: resolveRepository(e.repository, owner) } : e;
  return {
    ...lock,
    ...(Array.isArray(lock.mounts) ? { mounts: lock.mounts.map(fix) } : {}),
    ...(Array.isArray(lock.instances) ? { instances: lock.instances.map(fix) } : {}),
  };
}

/**
 * A lock with every `repository` in `sameOwnerRepos` (resolved `owner/name`s,
 * compared case-insensitively) written as its bare name — the inverse of
 * {@link resolveLockRepositories}, used by the lock's writer so a same-owner
 * mount stays same-owner on disk. A copy; the input is not changed.
 */
export function relativizeLockRepositories<T extends LockShape>(lock: T, sameOwnerRepos: Iterable<string>): T {
  const set = new Set([...sameOwnerRepos].map((r) => r.toLowerCase()));
  const fix = <E extends { repository?: unknown }>(e: E): E =>
    typeof e?.repository === "string" && set.has(e.repository.toLowerCase()) ? { ...e, repository: repositoryName(e.repository) } : e;
  return {
    ...lock,
    ...(Array.isArray(lock.mounts) ? { mounts: lock.mounts.map(fix) } : {}),
    ...(Array.isArray(lock.instances) ? { instances: lock.instances.map(fix) } : {}),
  };
}

/**
 * A lock's JSON with its same-owner names resolved. `owner` is the owner of
 * the repository the lock belongs to: a string, or a function asked only
 * when the lock holds a same-owner name (so a lock with none never runs git).
 * Anything that is not an object comes back as it is.
 */
export function resolveLockJson<T>(raw: T, owner: string | undefined | (() => string | undefined)): T {
  if (raw === null || typeof raw !== "object") return raw;
  const l = raw as LockShape;
  const bare = [...(Array.isArray(l.mounts) ? l.mounts : []), ...(Array.isArray(l.instances) ? l.instances : [])].some(
    (e) => typeof e?.repository === "string" && isSameOwnerName(e.repository),
  );
  if (!bare) return raw;
  return resolveLockRepositories(l, typeof owner === "function" ? owner() : owner) as T;
}

/**
 * Parse the lock at `file` and resolve its same-owner names against the owner
 * of the checkout holding it ({@link checkoutOwner} of its directory). Throws
 * as `JSON.parse` does, and when a same-owner name has no owner to take.
 */
export function readLockFile<T = unknown>(file: string): T {
  const raw = JSON.parse(readFileSync(file, "utf-8")) as T;
  return resolveLockJson(raw, () => checkoutOwner(dirname(resolve(file))));
}
