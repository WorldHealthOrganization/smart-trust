/**
 * Git facts about a repository's refs, and where this layer publishes.
 *
 * @module src/core/git-refs
 *
 * Bean `cp3l`. These four — the repo's web URL, its `owner/repo` slug, the
 * set of paths published at a ref, and the publish targets themselves — are
 * **generic git and configuration facts**. Nothing in any of them is about a
 * README, a folio, or authored content.
 *
 * They lived in `pipeline/readme-toc.ts` because that is where the
 * first caller was, and the cost showed up one layer out: a harness-level
 * link check over `AGENTS.md` reaching `auditLinks` reached `publishedPaths`
 * reached core, so **any** harness check that audits a link inherited a
 * wrong-direction edge, and the only ways out were to duplicate the auditor
 * or to misclassify the check. `check-agent-entry-links.ts` shipped
 * misclassified for exactly one day.
 *
 * ## `undefined` is a third state here, not a zero
 *
 * `publishedPaths` returns `undefined` for a ref it cannot read and an empty
 * set for a ref that published nothing, and the two must not collapse. A
 * shallow clone that never fetched `gh-pages` is the common case, and
 * reporting it as "published nothing" turns a clone detail into a wall of
 * false dead links.
 */
import { execFileSync } from "node:child_process";

import { readEffectiveConfig } from "../../schemas/kg/harness-config.ts";
import { inputSiteReached } from "../../schemas/sdlc/input-trace.ts";

/**
 * Run a git command in `root`, or `undefined` if it fails.
 *
 * The buffer is explicit and large. A published site is tens of thousands of
 * files, and `ls-tree -r` over one is several megabytes; node's 1 MiB default
 * makes `execFileSync` throw ENOBUFS, which the catch below turns into "ref
 * unavailable" — so a large, HEALTHY publish branch was reported as no branch
 * at all, and every PDF cell fell back to '—'. Found against a real folio;
 * the fixture trees in the tests are far too small to reach it.
 */
function git(root: string, args: string[]): string | undefined {
  try {
    // input-site: traced #3bd90e7e — a generic git wrapper over refs and history
    inputSiteReached("git-refs: git");
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * `https://github.com/owner/repo` for this checkout, from `origin`.
 *
 * Normalises the SSH form and strips `.git`, so a config that omits the URL
 * still resolves links against the right repository.
 */
export function detectRepoUrl(root: string): string | undefined {
  let remote: string;
  try {
    // input-site: tree #bdd3672c — git remote get-url origin: the checkout's origin URL
    remote = execFileSync("git", ["-C", root, "remote", "get-url", "origin"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch {
    return undefined;
  }
  if (!remote) return undefined;
  const ssh = remote.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  return withoutCredentials(remote).replace(/\.git$/, "");
}

/**
 * `url` with any user and password removed — `https://x-access-token:<token>@github.com/o/r`
 * becomes `https://github.com/o/r`.
 *
 * `git remote get-url` APPLIES `insteadOf`, and a CI job that authenticates
 * git by rewriting `https://github.com/` to a token-bearing URL (smart-ra's
 * `site-publish.yml`) gets the token back from it. That value was published
 * on every page of smart-ra's site as the "source" link (2026-10-14). A
 * repository's address never carries credentials; nothing read from a remote
 * may reach a page without passing through here.
 */
export function withoutCredentials(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (!u.username && !u.password) return url;
  u.username = "";
  u.password = "";
  return u.toString().replace(/\/$/, url.endsWith("/") ? "/" : "");
}

/** `owner/repo` from a repo web URL, for `raw.githubusercontent.com`. */
export function ownerRepo(repoUrl: string): string | undefined {
  return repoUrl.replace(/\/$/, "").match(/[^/]+\/[^/]+$/)?.[0];
}

/**
 * Every path published at `ref`, or `undefined` when the ref is unavailable.
 *
 * `undefined` and "published nothing" are deliberately different — see the
 * module header. Callers report the first case rather than emitting a blank.
 */
export function publishedPaths(
  root: string,
  ref: string,
  fetch = false,
): Set<string> | undefined {
  const read = (): Set<string> | undefined => {
    for (const candidate of [`refs/remotes/origin/${ref}`, ref]) {
      const listing = git(root, ["ls-tree", "-r", "--name-only", candidate]);
      if (listing !== undefined && listing.length > 0) return new Set(listing.split("\n"));
    }
    return undefined;
  };
  const local = read();
  if (local || !fetch) return local;
  // Opt-in only. A generator that reaches the network on every run is a
  // generator nobody can run offline; the failure message names this command
  // so the choice stays the operator's.
  git(root, ["fetch", "--depth", "1", "origin", `${ref}:refs/remotes/origin/${ref}`]);
  return read();
}

/** The default publish ref — the branch a Pages site is served from. */
export const DEFAULT_PUBLISH_REF = "gh-pages";

/**
 * Where this layer publishes: the repo URL, the Pages base, the ref.
 *
 * **These are repository-level facts that happen to be stored under the
 * `readme` key**, which is where the first consumer put them. They are read
 * here rather than in `loadReadmeConfig` so a harness-level link check can
 * resolve a Pages URL without depending on core — that dependency is the
 * whole of bean `cp3l`. `loadReadmeConfig` layers the README-shaped defaults
 * (link style, marker, PDF path patterns) on top of the same block, so there
 * is one file, one key and no second answer to drift from the first.
 *
 * `harness.config.json` is resolved by `schemas/kg/harness-config.ts`, which is
 * already harness-level, so nothing new crosses a boundary to read it.
 */
export function publishTargets(root: string): {
  repoUrl?: string;
  pagesBaseUrl?: string;
  publishRef: string;
} {
  const eff = readEffectiveConfig(root);
  let block: { repoUrl?: string; pagesBaseUrl?: string; publishRef?: string } = {};
  // The index entry when one lists the layer, else `<name>.config.json`.
  if (eff.state === "ok") {
    try {
      const parsed = eff.config as {
        readme?: typeof block;
      };
      block = parsed.readme ?? {};
    } catch {
      // A harness.config.json that will not parse is reported by the tools
      // that own it; falling back to defaults is better than refusing.
    }
  }
  return {
    repoUrl: block.repoUrl ?? detectRepoUrl(root),
    pagesBaseUrl: block.pagesBaseUrl,
    publishRef: block.publishRef ?? DEFAULT_PUBLISH_REF,
  };
}
