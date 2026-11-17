/**
 * Which repository a checkout is, and how a same-owner lock entry resolves.
 *
 * @module scripts/lib/checkout-repository
 * @graphNode none — repository naming helpers, not a schema
 *
 * A content layer's lock may name a sibling layer without an owner
 * (`"repository": "<name>"`): a SAME-OWNER name, which resolves to the owner
 * of the checkout holding the lock, so one commit builds under either owner
 * of a fork pair. The rule, and every other reader of it, is
 * cat-harness-tools' `schemas/kg/repo-owner.ts` (cat-harness-tools#2337). It
 * is restated here, in a few lines, so this layer does not wait on a re-pin
 * of cat-harness-tools to read such a lock; the two must agree.
 *
 * The owner is derived, never declared: `CAT_REPO_OWNER` (an explicit
 * override), else the checkout's `origin`, else `GITHUB_REPOSITORY_OWNER`.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { inputSiteReached } from "@litlfred/cat-harness-tools/schemas/sdlc/input-trace.ts";

/** A bare repository name: a same-owner name. */
export const SAME_OWNER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function git(dir: string, args: string[]): string | undefined {
  // input-site: traced #15055830 — a checkout's top level and origin URL, from its git config: no fingerprint names them, so a run that reaches it records no hash
  inputSiteReached("checkout-repository: git");
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf-8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

/** `owner/name` from a remote URL (https, ssh, or a proxy's `…/git/owner/name`). */
export function repositoryFromUrl(url: string): string | undefined {
  const m = url.trim().replace(/\/+$/, "").replace(/\.git$/, "").match(/[/:]([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

/**
 * `owner/name` of the git checkout whose top level is `dir`, from its
 * `origin` (the owner overridden by `CAT_REPO_OWNER`); `undefined` when `dir`
 * is not itself a checkout's top level, so a directory inside another
 * repository never borrows that repository's name.
 */
// input-site: env CAT_REPO_OWNER #8acc2372 — the default environment: only this variable is read from it
export function checkoutRepository(dir: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const top = git(dir, ["rev-parse", "--show-toplevel"]);
  if (top === undefined || resolve(top) !== resolve(dir)) return undefined;
  const url = git(dir, ["remote", "get-url", "origin"]);
  const repo = url ? repositoryFromUrl(url) : undefined;
  if (!repo) return undefined;
  const owner = env.CAT_REPO_OWNER?.trim();
  return owner ? `${owner}/${repo.split("/")[1]}` : repo;
}

/** The owner a same-owner name in `dir`'s lock resolves to: CAT_REPO_OWNER, origin's, else GITHUB_REPOSITORY_OWNER. */
// input-site: env CAT_REPO_OWNER,GITHUB_REPOSITORY_OWNER #a0b4424b — the default environment: only these variables are read from it
export function checkoutOwner(dir: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.CAT_REPO_OWNER?.trim()) return env.CAT_REPO_OWNER.trim();
  const url = git(dir, ["remote", "get-url", "origin"]);
  return (url ? repositoryFromUrl(url)?.split("/")[0] : undefined) ?? (env.GITHUB_REPOSITORY_OWNER?.trim() || undefined);
}

/** `repo` as `owner/name`: unchanged when it names an owner; a same-owner name takes `owner` (undefined when there is none). */
export function resolveRepository(repo: string, owner: string | undefined): string | undefined {
  if (!SAME_OWNER_NAME.test(repo)) return repo;
  return owner ? `${owner}/${repo}` : undefined;
}
