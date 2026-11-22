#!/usr/bin/env bun
/**
 * serve-local — one command that gets each repo's rendered site and serves
 * them together at http://127.0.0.1:4007, with published IRIs opening the
 * local copy. Local server Phase 3 (issue #1179; Phases 1–2 were #1164 and
 * #1167).
 *
 * ```sh
 * bun run cat-harness-tools/scripts/serve-local.ts --repos folio-assistant,dth-pc
 * bun run cat-harness-tools/scripts/serve-local.ts --repos dth-pc --staging claude-dth-pc-scaffold
 * bun run cat-harness-tools/scripts/serve-local.ts --site dth-pc=../dth-pc/_site --repos folio-assistant
 * ```
 *
 * ## Where each site comes from
 *
 * - `--repos a,b` fetches each repo's published `gh-pages` branch into a
 *   cache (`$XDG_CACHE_HOME/cat-harness/serve-local/<repo>`, else
 *   `~/.cache/...`): a shallow, blob-less, sparse clone, so only the files
 *   checked out are downloaded. A later run updates it. `branches/` is left
 *   out, because previews are most of a large gh-pages branch
 *   (folio-assistant's held 156,803 files on 2026-10-31); `--staging <branch>`
 *   adds the previews you name.
 * - `--site <repo>=<dir>` serves a directory you built yourself, for changes
 *   not published yet. This script does not run builds: each repo builds its
 *   own way, and the build tools share folio-assistant's pins.
 *
 * The owner and host come from the IRI origin, which is the declared
 * `canonicalUrl`'s origin: `https://<owner>.github.io` is
 * `https://github.com/<owner>/<repo>.git`. `--owner` and `--remote`
 * (a template with `{owner}` and `{repo}`) override it.
 *
 * Git runs through `node:child_process`, so nothing here needs Bun beyond the
 * server launcher it hands off to (owner, 2026-10-31: Bun now, Node later).
 *
 * @module scripts/serve-local
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { safeSegment } from "../src/core/safe-path";
import type { Mount } from "./lib/rendering-handler";
import { DEFAULT_PORT, declaredIriOrigin, iriBasesFor, nextPrimePort, parseMount, serveRendering } from "./serve-rendering";
import { PREVIEW_PREFIX_ALT, PREVIEW_PREFIXES } from "./lib/preview-prefix.ts";

/** Where fetched sites are kept between runs. */
export function defaultCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(base, "cat-harness", "serve-local");
}

/** `https://<owner>.github.io` → `<owner>`; anything else gives undefined. */
export function pagesOwner(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  try {
    const host = new URL(origin).hostname;
    const m = /^([A-Za-z0-9-]+)\.github\.io$/i.exec(host);
    return m ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

/** The clone URL for a repo from a `{owner}`/`{repo}` template. */
export function remoteUrl(template: string, owner: string, repo: string): string {
  return template.replaceAll("{owner}", owner).replaceAll("{repo}", repo);
}

/**
 * Sparse patterns (non-cone): everything except `branches/`, then each named
 * preview. A branch name is one safe segment or it is refused.
 */
export function sparsePatterns(staging: readonly string[]): string[] {
  for (const b of staging) {
    if (safeSegment(b) === undefined) throw new Error(`serve-local: bad --staging branch: ${b}`);
  }
  return ["/*", ...PREVIEW_PREFIXES.map((p) => `!/${p}/`), ...staging.flatMap((b) => PREVIEW_PREFIXES.map((p) => `/${p}/${b}/`))];
}

function git(args: readonly string[], cwd?: string): void {
  const r = spawnSync("git", args, { cwd, stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`serve-local: git ${args.join(" ")} failed (exit ${r.status ?? r.signal})`);
}

/**
 * Make `dir` a sparse checkout of `url`'s `branch` at its tip: clone it the
 * first time, fetch and reset after. Returns `dir`.
 */
export function fetchSite(o: { url: string; dir: string; branch?: string; staging?: readonly string[] }): string {
  const branch = o.branch ?? "gh-pages";
  const patterns = sparsePatterns(o.staging ?? []);
  if (!existsSync(join(o.dir, ".git"))) {
    mkdirSync(resolve(o.dir, ".."), { recursive: true });
    git(["clone", "--quiet", "--depth", "1", "--filter=blob:none", "--no-checkout", "--branch", branch, o.url, o.dir]);
  } else {
    git(["fetch", "--quiet", "--depth", "1", "origin", branch], o.dir);
  }
  git(["sparse-checkout", "set", "--no-cone", ...patterns], o.dir);
  git(["-c", "advice.detachedHead=false", "checkout", "--quiet", "--force", existsSync(join(o.dir, ".git", "FETCH_HEAD")) ? "FETCH_HEAD" : branch], o.dir);
  return o.dir;
}

/** The previews a fetched gh-pages branch holds, read from git (they are not checked out). */
export function listStaging(dir: string): string[] {
  const r = spawnSync("git", ["ls-tree", "--name-only", "HEAD", ...PREVIEW_PREFIXES.map((p) => `${p}/`)], { cwd: dir, encoding: "utf-8" });
  if (r.status !== 0) return [];
  const lead = new RegExp(`^${PREVIEW_PREFIX_ALT}/`);
  return [...new Set(r.stdout
    .split("\n")
    .map((s) => s.replace(lead, "").trim())
    .filter((s) => s.length > 0))];
}

/**
 * Where to start reading a served directory that has no `index.html` of its
 * own: the subdirectories one level down that do, sorted. A `--site` of a
 * checkout serves the repository folder, so a layer whose pages sit in
 * `site/` or `docs/` would otherwise print only a root that lists nothing.
 */
export function pagesBelow(dir: string): string[] {
  if (!existsSync(dir) || existsSync(join(dir, "index.html"))) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules" && existsSync(join(dir, d.name, "index.html")))
    .map((d) => d.name)
    .sort();
}

/** Split `a,b , c` into repo names, refusing anything that is not one segment. */
export function parseRepos(list: string | undefined): string[] {
  const out = (list ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const r of out) if (safeSegment(r) === undefined) throw new Error(`serve-local: bad repo name: ${r}`);
  return out;
}

const USAGE = `usage: serve-local.ts [--repos a,b] [--site <repo>=<dir>]... [--staging <branch>]... [--offline]
                     [--port N] [--iri-origin URL] [--owner NAME] [--remote TEMPLATE] [--cache DIR] [--no-rewrite]

  --repos      fetch each repo's gh-pages branch (cached; updated each run) and serve it at /<repo>/
  --site       serve a directory you built yourself at /<repo>/ instead; repeatable
  --staging    also fetch branches/<branch>/ (or old branches/<branch>/) previews; repeatable (previews are left out otherwise)
  --offline    use the cache as it is, no fetch
  --port       default ${DEFAULT_PORT}
  --iri-origin where IRIs are published (default: the declared canonicalUrl's origin)
  --owner      GitHub owner (default: from <owner>.github.io in the IRI origin)
  --remote     clone URL template (default https://github.com/{owner}/{repo}.git)
  --cache      cache directory (default ${defaultCacheDir()})
  --no-rewrite serve bytes as published
`;

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const flags = (name: string): string[] => argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1]] : []));

  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }

  const repos = parseRepos(flag("--repos"));
  const sites = flags("--site").map(parseMount);
  if (repos.length === 0 && sites.length === 0) {
    console.error(USAGE);
    process.exit(2);
  }
  const iriOrigin = flag("--iri-origin") ?? declaredIriOrigin();
  const owner = flag("--owner") ?? pagesOwner(iriOrigin);
  const template = flag("--remote") ?? "https://github.com/{owner}/{repo}.git";
  const cache = flag("--cache") ?? defaultCacheDir();
  const offline = argv.includes("--offline");

  const mounts: Mount[] = sites.map((s) => ({ prefix: s.prefix.startsWith("/") ? s.prefix : `/${s.prefix}`, dir: s.dir }));
  for (const repo of repos) {
    if (mounts.some((m) => m.prefix === `/${repo}`)) continue; // --site wins
    const dir = join(cache, repo);
    if (offline) {
      if (!existsSync(dir)) {
        console.error(`serve-local: --offline and no cached site for ${repo} at ${dir}`);
        process.exit(1);
      }
    } else {
      if (!owner && template.includes("{owner}")) {
        console.error("serve-local: no owner (pass --owner, or --iri-origin https://<owner>.github.io)");
        process.exit(1);
      }
      const url = remoteUrl(template, owner ?? "", repo);
      console.log(`fetching ${repo} gh-pages from ${url} …`);
      fetchSite({ url, dir, staging: flags("--staging") });
    }
    if (!existsSync(join(dir, "index.html"))) {
      const previews = listStaging(dir);
      console.log(
        `note: ${repo} has no published main site${previews.length ? `; its previews: ${previews.join(", ")} (add --staging <name>)` : ""}`,
      );
    }
    mounts.push({ prefix: `/${repo}`, dir });
  }

  const port = Number(flag("--port") ?? DEFAULT_PORT);
  const rewrite = !argv.includes("--no-rewrite");
  const iriBases = iriBasesFor(mounts, iriOrigin);
  let server: ReturnType<typeof serveRendering>;
  try {
    server = serveRendering({ mounts, port, canonicalHost: "127.0.0.1", iriBases, rewrite });
  } catch (e) {
    if ((e as { code?: string }).code === "EADDRINUSE") {
      const next = nextPrimePort(port);
      console.error(`serve-local: port ${port} is in use.${next ? ` Try --port ${next}.` : ""}`);
      process.exit(1);
    }
    throw e;
  }
  const base = `http://127.0.0.1:${server.port}`;
  for (const m of mounts) {
    console.log(`serving ${resolve(m.dir)} at ${base}${m.prefix}/`);
    for (const sub of pagesBelow(m.dir)) console.log(`  pages: ${base}${m.prefix}/${sub}/`);
  }
  if (!rewrite) console.log("IRIs: not rewritten (--no-rewrite)");
  else if (iriBases.length === 0) console.log("IRIs: not rewritten (no --iri-origin and no declared canonicalUrl)");
  else for (const b of iriBases) console.log(`IRIs: ${b.from}/… → ${base}${b.prefix}/…`);
  console.log(`open ${base}/`);
}
