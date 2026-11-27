#!/usr/bin/env bun
/**
 * stage-local — the ONE agent publish path: build a folio's or an IG's site in
 * the agent's own checkout and push it to the publish branch, as a preview
 * or as the main site, without an Actions runner.
 *
 * @module scripts/stage-local
 * @covers none — a PUBLISHER, not an audit: it builds and deploys one preview and judges nothing
 *
 * ```sh
 * bun run cat-harness-tools/scripts/stage-local.ts --repo ../<repository> [--branch B] [--plan | --dry-run | --artifact DIR]
 * ```
 *
 * ## One command, every agent-run publish (owner, 2026-10-10)
 *
 * The owner, asking on 2026-10-10 about the IG repositories then publishing
 * by hand: *"i want one consolidated worfklow."* A repository is AGENT-RUN
 * when it declares so in its own `index.config.json`, `"site": { "agentRun":
 * true }` (owner, 2026-10-14, Q7: "Yes, declare it"; {@link agentRunOf}).
 * Its publish workflows are dispatch-only, documentation of what this path
 * must match and never something an agent dispatches, and every plan says
 * whether the repository declares it. This file keeps no list of them. So:
 *
 * - **a declared site first**: a repository whose layer config (its
 *   `index.config.json` entry; a legacy `<instance>.config.json` is a reported fallback)
 *   carries `site.build` is built by `build-instance-site.ts` from its own
 *   package scripts ({@link declaredRecipe}, {@link stageDeclared});
 * - otherwise **which publisher** is read from the repository's own workflow files
 *   (`detectPublisher`, `site-publisher.ts`): a caller of `folio-staging.yml`
 *   is a folio, published here; a caller of a workflow another publisher
 *   declares is handed to THAT publisher's code. A publisher other than the
 *   folio's is a mounted layer's declared `site-publisher-<kind>` pipeline
 *   slot (owner, 2026-10-14, Q4 of the folio-assistant#2529
 *   reference-direction review: the FHIR-IG publish path moved to the layer
 *   that owns IG builds). This layer names no publisher above it: what can
 *   publish a repository is whatever that repository's mounts declare;
 * - **main site or preview** follows the branch ({@link chooseTarget}): the
 *   default branch publishes the main site at the root as `publish-main`
 *   does ({@link composeMain}: `publish-main-site.ts`, the `main-site`
 *   render-log entry, `main-site: from <sha>`); any other branch a preview;
 * - every run prints its plan first, `--plan` stops there, and `--dry-run`
 *   builds and composes the commit in a temporary publish-branch worktree
 *   without pushing.
 *
 * ## Why this exists
 *
 * Owner, 2026-10-07: *"do agent-triggered staging next"* — chosen over
 * logging it, after a measurement. smart-ra's dispatch of `staging.yml` that
 * morning (run 37584204273) waited **33 min** for a runner and then ran for
 * 45 s. The agent that asked for it had the checkout, the platform and bun in
 * hand the whole time.
 *
 * ## What it does NOT remove, and says so
 *
 * A push to the publish branch is deployed by GitHub's own `pages build and
 * deployment`, which is ALSO an Actions run. The same morning that run took
 * **47 min**, of which about a minute was work. Nothing here can skip it: the
 * official URL is served by Pages, and Pages deploys on a runner. So this
 * removes the first wait and not the second, and its output says the preview
 * is live only once that deploy has run.
 *
 * ## A folio's preview: the same steps as the workflow, read from the folio
 *
 * The folio's own workflow (`staging.yml`) passes `build_command`,
 * `site_dir`, `folio_dir`, `platform_dir` and `publish_branch` to the
 * reusable `folio-staging.yml`. Those inputs are READ from that file, never
 * restated here, so a folio that changes its build changes it once. Then, in
 * the workflow's order:
 *
 * 1. the slug, by the workflow's rule ({@link slugOf}), refused when it names
 *    no single path segment (bean `fuzm`);
 * 2. the folio's build command, run in the folio checkout;
 * 3. the rail, `rail-standalone-pages.ts`, with the workflow's arguments;
 * 4. the ChangeSet and the rendered impact against the base branch, so the
 *    review page has its data;
 * 5. the banner, `staging-banner.ts`, saying the preview was built locally;
 * 6. the push, held by `staging-push-gate.ts` exactly as the workflow is
 *    (issue #1956): a preview never lands while the main site's Pages build
 *    it would cancel is running. The commit message starts `staging(<slug>)`,
 *    which is how the gate and every later push recognise a staging commit.
 *    The preview REPLACES the slug's directory (bean `85im`), the build is
 *    checked non-empty before anything is deleted (bean `oisv`), and the
 *    render log gets its entry (`render-log.ts`).
 *
 * A preview also carries its build record, `_build-record.json`
 * ({@link writePreviewRecord}): the tree it was built from and a hash of every
 * file. CI rebuilds that tree in full afterwards, off the critical path, and
 * replaces the preview when anything differs (folio-assistant#2881).
 *
 * Not run: the QA sweep, block screenshots, review-comment ingestion and the
 * PR comment. The banner names the preview as built locally so a reviewer is
 * not told those exist.
 *
 * ## `--artifact <dir>`: a preview with no GitHub in the loop
 *
 * The second half of the owner's choice: the same build, written as a BUNDLE a
 * claude.ai Artifact can carry, and nothing pushed. The agent then publishes
 * `<dir>/index.html` with the files `<dir>/artifact.json` lists; it is live in
 * about a minute and private until shared. An Artifact holds at most
 * {@link ARTIFACT_MAX_FILES} files per publish and {@link ARTIFACT_MAX_BYTES}
 * bytes, so when the site is bigger, whole top-level directories are left out,
 * the ones holding the most files first (smart-ra's 2,931 node-kind pages
 * under `en/`), and `artifact.json` names each one left out and how many
 * files it held: a link into one of them 404s in the Artifact, and a reviewer
 * is told rather than left to find out.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

import { siteDirFor } from "../schemas/kg/cat-harness.ts";

import { waitFor } from "../src/core/retry.js";
import { PUSH_BASE_MS, PUSH_CAP_MS } from "./backoff-sleep.ts";
import { closedIssue } from "./review-brief.ts";
import { MANIFEST, RESERVED } from "./publish-main-site.ts";
import {
  declaredSitePublishers,
  type Detected,
  detectPublisher,
  FOLIO_PUBLISHER,
  FOLIO_PUBLISHER_KIND,
  FOLIO_WORKFLOW,
  type Publisher,
  type PublisherWorkflows,
  readWorkflows,
  SITE_PUBLISHER_SLOT_PREFIX,
} from "./site-publisher.ts";
import { decide, readTip } from "./staging-push-gate.ts";
import { findDeclarationFile } from "../schemas/kg/instance-roots.ts";
import { readIndexConfig } from "../schemas/kg/index-config.ts";
import { buildInstanceSite, declaredIriBase, linkedDataSteps, recipeFromConfig, siteFields, siteIriCheckStep, siteScopeOf, softRun, type SiteRecipe } from "./build-instance-site.ts";
import { makeRecord, RECORD_FILE } from "./preview-record.ts";
import { findReport, injectSite } from "./preview-qa.ts";
import { reviewSiteSize, SITE_SIZE_FILE } from "./site-size.ts";
import { isPreviewPath, PREVIEW_PREFIX, previewPath } from "./lib/preview-prefix.ts";
import { ensurePublishBranch } from "./lib/publish-branch.ts";
import { editedMountsIn, relayAdvice } from "./remote-mount.ts";

/** Files one Artifact publish may carry, the page included (the Artifact tool's limit is 255; one is the page). */
export const ARTIFACT_MAX_FILES = 254;
/** Bytes one Artifact publish may carry (the tool's limit is 64 MB; a margin for the page). */
export const ARTIFACT_MAX_BYTES = 60 * 1024 * 1024;

export interface ArtifactBundle {
  page: "index.html";
  /** Published paths, relative to the bundle directory, the page excluded. */
  files: string[];
  bytes: number;
  /** Top-level directories left out to fit, with how many files each held. */
  dropped: { dir: string; files: number; bytes: number }[];
}

/**
 * Why HEAD is not the pushed tip. Behind it (an ancestor of the tip): a newer
 * push replaced it, SUPERSEDED. Anything else (a local commit nobody pushed,
 * a diverged branch) stays an error: that is not main's site, and nobody else
 * will publish it.
 */
export function notTipError(repo: string, sha: string, tip: string, branch: string): Error {
  const behind = spawnSync("git", ["-C", repo, "merge-base", "--is-ancestor", sha, tip]).status === 0;
  return behind
    ? new SupersededError(sha, tip, branch)
    : new Error(`HEAD ${sha.slice(0, 7)} is not origin/${branch}'s tip ${tip.slice(0, 7)}; the main site is published from the pushed default branch only`);
}

/**
 * The commit the live publish root was built from, read from the publish
 * branch's history: a root publish by build-instance-site is
 * `Publish <instance> <sha>` (no "preview of"), one by publish-main-site.ts is
 * `main-site: from <sha>`. `undefined` when none of the last 200 commits says.
 */
export function liveRootCommit(repo: string, pagesBranch = "gh-pages"): string | undefined {
  if (spawnSync("git", ["-C", repo, "fetch", "-q", "--depth", "200", "origin", pagesBranch]).status !== 0) return undefined;
  const log = spawnSync("git", ["-C", repo, "log", "--format=%s", "-n", "200", "FETCH_HEAD"], { encoding: "utf-8" });
  if (log.status !== 0) return undefined;
  return liveRootCommitIn(log.stdout.split("\n"));
}

/** {@link liveRootCommit} over the subjects, newest first. Pure. */
export function liveRootCommitIn(subjects: readonly string[]): string | undefined {
  for (const s of subjects) {
    const m = /^main-site: from ([0-9a-f]{7,40})\b/.exec(s) ?? (/ preview of /.test(s) ? null : /^Publish \S+ ([0-9a-f]{7,40})$/.exec(s));
    if (m) return m[1];
  }
  return undefined;
}

/**
 * Should a SUPERSEDED main run publish anyway? Yes when the live root is
 * strictly older than this commit (an ancestor of it), because the newer
 * push's own run may never get to publish: GitHub keeps one PENDING run per
 * concurrency group and cancels the rest, and the one that does start finds
 * main moved again whenever merges land faster than a build takes. Measured on
 * litlfred/qou, 2026-11-27: 0 root publishes in 40 minutes and 20 runs, every
 * one cancelled or superseded, while the PDF workflow published each merge.
 * Publishing an older-than-tip commit that is newer than the live root keeps
 * the site moving forward and never moves it back. Unknown (no record, or the
 * commit is not in this clone) keeps the old answer: superseded, skip.
 */
export function publishSupersededAnyway(repo: string, sha: string, live: string | undefined): boolean {
  if (!live) return false;
  const full = spawnSync("git", ["-C", repo, "rev-parse", "--verify", "-q", `${live}^{commit}`], { encoding: "utf-8" });
  if (full.status !== 0) return false;
  const liveSha = full.stdout.trim();
  if (liveSha === sha) return false;
  return spawnSync("git", ["-C", repo, "merge-base", "--is-ancestor", liveSha, sha]).status === 0;
}

/**
 * The commit asked for is no longer the pushed default branch's tip: a newer
 * push replaced it while this run waited or built. The main site is that newer
 * commit's, and its own push runs the publish (`folio-site-publish.yml` queues
 * runs per repository, never cancelling one in progress). So this run has
 * nothing to publish, and it ends as SUPERSEDED, exit 0, rather than as a
 * failure that emails the owner about a commit nobody will publish (a content
 * layer's publish on 2026-11-12 was replaced by the next push within a minute).
 * A local run that is simply behind origin is told the same, and still
 * publishes nothing.
 */
export class SupersededError extends Error {
  constructor(readonly sha: string, readonly tip: string, readonly branch: string) {
    super(`HEAD ${sha.slice(0, 7)} is not origin/${branch}'s tip ${tip.slice(0, 7)}; the main site is published from the pushed default branch only`);
    this.name = "SupersededError";
  }
}

/**
 * Which files of a built site fit one Artifact publish. Pure over the listing:
 * `files` maps each site-relative path to its size. Whole top-level
 * directories are dropped, most files first, until the rest fits; a site whose
 * root files alone do not fit is refused.
 */
export function artifactBundle(files: Map<string, number>): ArtifactBundle {
  if (!files.has("index.html")) throw new Error("the site has no index.html to open the Artifact on");
  const top = new Map<string, { files: number; bytes: number }>();
  for (const [p, n] of files) {
    const i = p.indexOf("/");
    if (i < 0) continue;
    const d = p.slice(0, i);
    const t = top.get(d) ?? { files: 0, bytes: 0 };
    top.set(d, { files: t.files + 1, bytes: t.bytes + n });
  }
  const dropped: ArtifactBundle["dropped"] = [];
  const kept = () => [...files.entries()].filter(([p]) => p !== "index.html" && !dropped.some((d) => p.startsWith(`${d.dir}/`)));
  const fits = () => {
    const k = kept();
    return k.length <= ARTIFACT_MAX_FILES && k.reduce((a, [, n]) => a + n, 0) + (files.get("index.html") ?? 0) <= ARTIFACT_MAX_BYTES;
  };
  const order = [...top.entries()].sort((a, b) => b[1].files - a[1].files || b[1].bytes - a[1].bytes || a[0].localeCompare(b[0]));
  for (const [dir, t] of order) {
    if (fits()) break;
    dropped.push({ dir, ...t });
  }
  if (!fits()) throw new Error(`even the site's root files exceed one Artifact publish (${ARTIFACT_MAX_FILES} files, ${ARTIFACT_MAX_BYTES} bytes)`);
  const k = kept();
  return { page: "index.html", files: k.map(([p]) => p).sort(), bytes: k.reduce((a, [, n]) => a + n, 0) + files.get("index.html")!, dropped };
}

/**
 * Where the bundle carries the platform's own assets. Not `_platform`: the
 * Artifact service reserves top-level names that start with `_`.
 */
export const PLATFORM_ASSETS = "platform-assets";

/**
 * The platform assets a page loads from the platform's PUBLISHED site — the
 * rail's script and style, `<root>/assets/<path>.js|.css` with `<root>` the
 * page's `data-fa-root` — and the bundle-relative path each is rewritten to.
 * Pure over the files' text. Links to other platform PAGES stay as they are:
 * following one leaves the Artifact, which is what a link should do.
 */
export function platformAssetRefs(texts: Map<string, string>): { roots: string[]; assets: string[] } {
  const roots = new Set<string>();
  for (const t of texts.values()) for (const m of t.matchAll(/data-fa-root="(https?:\/\/[^"]+)"/g)) roots.add(m[1]!.replace(/\/+$/, ""));
  const assets = new Set<string>();
  for (const root of roots) {
    const esc = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const t of texts.values()) for (const m of t.matchAll(new RegExp(`${esc}/assets/([^"'\\s)?#]+\\.(?:js|css))`, "g"))) assets.add(m[1]!);
  }
  return { roots: [...roots].sort(), assets: [...assets].sort() };
}

/**
 * An Artifact runs only scripts from its allowed hosts, so the rail's script
 * and style, loaded from the platform's published site, would not run there.
 * Copy each from the platform checkout's own site directory into
 * `<out>/platform-assets/assets/` and point every page at the copy. An asset the
 * platform does not have is left pointing at the published site.
 */
function vendorPlatformAssets(out: string, files: string[], platform: string): string[] {
  const textual = files.filter((f) => /\.(html|css|js)$/.test(f));
  const texts = new Map(textual.map((f) => [f, readFileSync(join(out, f), "utf-8")] as const));
  const { roots, assets } = platformAssetRefs(texts);
  const instances = existsSync(platform) ? readdirSync(platform, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => join(platform, e.name)) : [];
  const source = (rel: string) => {
    for (const inst of instances) {
      let dir: string;
      try {
        dir = siteDirFor(inst);
      } catch {
        continue;
      }
      const f = join(inst, dir, "assets", rel);
      if (existsSync(f)) return f;
    }
    return undefined;
  };
  const copied: string[] = [];
  for (const rel of assets) {
    const from = source(rel);
    if (!from) continue;
    const to = `${PLATFORM_ASSETS}/assets/${rel}`;
    mkdirSync(dirname(join(out, to)), { recursive: true });
    cpSync(from, join(out, to));
    copied.push(to);
  }
  for (const [f, t] of texts) {
    let u = t;
    for (const to of copied) {
      const rel = to.slice(`${PLATFORM_ASSETS}/assets/`.length);
      const local = relative(dirname(join(out, f)), join(out, to)).split("\\").join("/");
      for (const root of roots) u = u.split(`${root}/assets/${rel}`).join(local);
    }
    if (u !== t) writeFileSync(join(out, f), u);
  }
  return copied;
}

function listSite(dir: string): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (d: string, rel: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(d, e.name), r);
      else if (e.isFile()) out.set(r, statSync(join(d, e.name)).size);
    }
  };
  walk(dir, "");
  return out;
}

/** The staging workflow's inputs this needs, as the folio's own file passes them. */
export interface StagingInputs {
  build_command: string;
  site_dir: string;
  folio_dir: string;
  platform_dir: string;
  publish_branch: string;
}

const DEFAULTS: Omit<StagingInputs, "build_command"> = {
  site_dir: "_site",
  folio_dir: "folio",
  platform_dir: "folio-assistant",
  publish_branch: "gh-pages",
};

/**
 * The `with:` inputs of the folio's staging workflow. A line-level read, not a
 * YAML parser: the file is one `uses:` job whose inputs are single-line scalars,
 * which is the shape `folio_init` writes. Undefined when there is no
 * `build_command`, since nothing can be built without it.
 */
export function readStagingInputs(yaml: string): StagingInputs | undefined {
  const got: Record<string, string> = {};
  for (const m of yaml.matchAll(/^\s+(build_command|site_dir|folio_dir|platform_dir|publish_branch):\s*(.+?)\s*$/gm)) {
    let v = m[2]!;
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
    if (m[2]!.startsWith("'")) v = v.replace(/''/g, "'");
    got[m[1]!] = v;
  }
  if (!got.build_command) return undefined;
  return { ...DEFAULTS, ...got } as StagingInputs;
}

/**
 * The workflow's slug rule: anything outside `[A-Za-z0-9._-]` becomes `-`,
 * runs collapse, ends trim. Undefined when the result names no single path
 * segment, because the deploy then deletes `branches/<slug>` (bean `plj1`).
 */
export function slugOf(branch: string): string | undefined {
  const s = branch.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s === "" || s === "." || s === ".." ? undefined : s;
}

/** Files a preview's data steps write that are not a site on their own (the workflow's list). */
const DATA_ONLY = /^(review-brief\.json|changeset\.json|changeset-text\.json|changeset-structure\.json|rendered-impact\.json|rendered-measured\.json|blocks\.json|block-qa\.json|review-comments\.json|visual-diff\.json|visual)$/;

/** True when the build wrote at least one file that is a page, not only data (bean `oisv`). */
export function builtSomething(siteDir: string): boolean {
  return existsSync(siteDir) && readdirSync(siteDir).some((f) => !DATA_ONLY.test(f));
}

/** `owner/repo` from a GitHub remote URL, or undefined. */
export function ownerRepoOf(remote: string): string | undefined {
  return /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(remote.trim())?.[1];
}

/** `<instance>/<rel>` in the first of the platform's top-level directories that has it, or undefined. */
export function inPlatform(platform: string, rel: string): string | undefined {
  if (!existsSync(platform)) return undefined;
  for (const d of readdirSync(platform, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort()) {
    const f = join(platform, d, rel);
    if (existsSync(f)) return f;
  }
  return undefined;
}

const git = (cwd: string, args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf-8" }).trim();

function run(cwd: string, cmd: string, args: string[], env: NodeJS.ProcessEnv = {}): void {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")} … exited ${r.status}`);
}

/**
 * Where this platform's pin keeps a script: `cat-harness-tools/scripts/` since
 * the 70lx split, `cat-harness/scripts/` before it. The folio's own build
 * command makes the same fallback, so a folio pinned either side of the split
 * publishes.
 */
export const SCRIPT_HOMES = ["cat-harness-tools/scripts", "cat-harness/scripts"] as const;

export function platformScript(platform: string, name: string): string {
  for (const h of SCRIPT_HOMES) {
    const f = join(platform, h, name);
    if (existsSync(f)) return f;
  }
  throw new Error(`${name}: in none of ${SCRIPT_HOMES.map((h) => join(platform, h)).join(", ")}`);
}

/** The default branch from `git ls-remote --symref origin HEAD`, or undefined. */
export function parseSymref(out: string): string | undefined {
  return /^ref:\s+refs\/heads\/(\S+)\s+HEAD$/m.exec(out)?.[1];
}

function readDefaultBranch(repo: string): string | undefined {
  const r = spawnSync("git", ["-C", repo, "ls-remote", "--symref", "origin", "HEAD"], { encoding: "utf-8" });
  const remote = r.status === 0 ? parseSymref(r.stdout) : undefined;
  if (remote) return remote;
  const l = spawnSync("git", ["-C", repo, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { encoding: "utf-8" });
  return l.status === 0 ? l.stdout.trim().replace(/^origin\//, "") || undefined : undefined;
}

export type Target = "main" | "preview";

/**
 * Main site or preview. The default branch publishes the main site, as the
 * workflows do (`publish-main` runs only there, and the stage job skips it);
 * any other branch publishes a preview. `--main` says so explicitly and is
 * refused off the default branch: the root is the "before" side every
 * preview is compared with, and a feature branch there would make every
 * comparison wrong.
 */
export function chooseTarget(o: { branch: string; defaultBranch?: string; main?: boolean }): Target {
  // A detached checkout names no branch: `rev-parse --abbrev-ref HEAD` answers
  // the literal "HEAD", which would otherwise publish a preview at
  // branches/HEAD/. Say which branch this is rather than guess.
  if (o.branch === "HEAD") throw new Error("the checkout is detached, so it names no branch; check out the branch, or pass --branch <name>");
  if (o.main) {
    if (o.defaultBranch && o.branch !== o.defaultBranch) throw new Error(`--main publishes the site at the publish root, and '${o.branch}' is not the default branch '${o.defaultBranch}'; refusing`);
    return "main";
  }
  if (!o.defaultBranch) throw new Error("could not read the default branch from origin; pass --main on the default branch, or run where origin is reachable");
  return o.branch === o.defaultBranch ? "main" : "preview";
}

/** The commit `publish-main` writes, with its run link replaced by where this was built. */
export function mainCommitMessage(sha: string, branch: string, runUrl: string): string[] {
  return [`main-site: from ${sha}`, `render-log: rendered the root from ${branch}`, `built locally: ${runUrl}`];
}

/** The commit a staging preview writes. `staging(` is how the push gate recognises one. */
export function previewCommitMessage(slug: string, sha: string, runUrl: string): string[] {
  return [`staging(${slug}): from ${sha}`, `render-log: rendered ${previewPath(slug)}`, `built locally: ${runUrl}`];
}

/** What one publish wrote into the publish-branch checkout: the commit to make, and the paths to stage. */
export interface Composed {
  commit: string[];
  add: string[];
}

type Script = (name: string) => string;

function renderLog(script: Script, pages: string, o: { kind: string; path: string; slug: string; branch: string; sha: string; runUrl: string; summary: string }): void {
  execFileSync("bun", ["run", script("render-log.ts"), "--dir", pages, "--event", "rendered", "--kind", o.kind, "--path", o.path, "--slug", o.slug, "--branch", o.branch, "--commit", o.sha, "--run", o.runUrl], { input: JSON.stringify({ summary: o.summary }), stdio: ["pipe", "inherit", "inherit"] });
}

/** A preview: `branches/<slug>/` replaced wholesale (bean `85im`), and its render-log entry. */
export function composePreview(pages: string, site: string, o: { slug: string; branch: string; sha: string; runUrl: string; script: Script }): Composed {
  const dest = join(pages, PREVIEW_PREFIX, o.slug);
  rmSync(dest, { recursive: true, force: true });
  cpSync(site, dest, { recursive: true });
  renderLog(o.script, pages, { kind: "staging-preview", path: previewPath(o.slug), slug: o.slug, branch: o.branch, sha: o.sha, runUrl: o.runUrl, summary: "folio staging preview published (built locally by an agent)" });
  return { commit: previewCommitMessage(o.slug, o.sha, o.runUrl), add: [previewPath(o.slug), "_render-log"] };
}

/**
 * The main site, as `publish-main` lays it: the platform's
 * `publish-main-site.ts` replaces only what its manifest names, so `branches/`,
 * `_render-log/` and anything a person put at the root stay; then the
 * `main-site` render-log entry for `/`.
 */
export function composeMain(
  pages: string,
  site: string,
  // `stderr: "pipe"` keeps the script's `::error::` refusal off a CI log: the
  // test that EXPECTS the refusal set a GitHub error annotation on every run.
  // The text is then on the thrown error's `stderr`.
  o: { branch: string; sha: string; runUrl: string; script: Script; stderr?: "inherit" | "pipe" },
): Composed {
  execFileSync("bun", ["run", o.script("publish-main-site.ts"), "--site", site, "--pages", pages, "--commit", o.sha], { stdio: ["ignore", "inherit", o.stderr ?? "inherit"] });
  renderLog(o.script, pages, { kind: "main-site", path: "/", slug: o.branch, branch: o.branch, sha: o.sha, runUrl: o.runUrl, summary: `${o.branch}'s site published at the root (built locally by an agent)` });
  return { commit: mainCommitMessage(o.sha, o.branch, o.runUrl), add: ["."] };
}

/**
 * Whether a repository declares itself AGENT-RUN: `site.agentRun` in its own
 * `index.config.json` (owner, 2026-10-14, Q7 of the folio-assistant#2529
 * reference-direction review: "Yes, declare it"). The declaration is the only
 * source. No repository is agent-run because this file, or a skill, lists it.
 *
 * Three answers, never two: `true` when declared, `false` when the index says
 * `false` or says nothing, and `unreadable` when the index cannot be read. An
 * unreadable index is not the same as an absent flag, so the plan reports which
 * one it found.
 */
export type AgentRunDeclaration =
  | { agentRun: true; file: string }
  | { agentRun: false; file: string; why: "absent" | "not-declared" | "declared-false" }
  | { agentRun: "unreadable"; file: string; why: string };

export function agentRunOf(repo: string): AgentRunDeclaration {
  const r = readIndexConfig(resolve(repo));
  if (r.state === "absent") return { agentRun: false, file: r.file, why: "absent" };
  if (r.state === "unreadable") return { agentRun: "unreadable", file: r.file, why: r.why };
  const v = r.config.site?.agentRun;
  if (v === true) return { agentRun: true, file: r.file };
  return { agentRun: false, file: r.file, why: v === false ? "declared-false" : "not-declared" };
}

/** The plan's `agent-run` line: what the repository declares, and what that means for this run. */
export function agentRunLine(a: AgentRunDeclaration): string {
  const where = basename(a.file);
  if (a.agentRun === true) return `  agent-run   yes, declared in ${where} (site.agentRun): this is the only publish path; never dispatch the publish workflow`;
  if (a.agentRun === "unreadable") return `  agent-run   unknown: ${where} cannot be read (${a.why})`;
  const said = a.why === "absent" ? `no ${where}` : a.why === "declared-false" ? `${where} says site.agentRun: false` : `${where} declares no site.agentRun`;
  return `  agent-run   not declared (${said}): this run publishes as asked, and the repository's own workflow may also publish`;
}

/** What a run will do, printed before it does anything. */
export interface StagePlan {
  /** `folio`, or the kind of the publisher that staged it. */
  kind: Publisher;
  /** The repository's own workflow, and the reusable one it calls. */
  caller: string;
  workflow: string;
  note?: string;
  target: Target;
  branch: string;
  defaultBranch?: string;
  sha: string;
  publishBranch: string;
  dest: string;
  url: string;
  replaces: string;
  preserved: string[];
  build: string[];
  renderLog?: { kind: string; path: string };
  gate: string;
  commit: string[];
  /** IG only: each workflow step, and what this path does with it. */
  steps?: { name: string; action: string; reason?: string }[];
  notRun: string[];
  missing?: string[];
}

export function formatPlan(p: StagePlan): string {
  const l = [
    `plan: ${p.kind} ${p.target === "main" ? "MAIN SITE" : "preview"} of ${p.branch} (${p.sha.slice(0, 7)}) → ${p.publishBranch}:${p.dest}`,
    `  mirrors     ${p.caller} → ${p.workflow}`,
    ...(p.note ? [`  note        ${p.note}`] : []),
    `  default     ${p.defaultBranch ?? "(unknown)"}`,
    `  url         ${p.url}`,
    `  replaces    ${p.replaces}`,
    `  preserves   ${p.preserved.join(", ")}`,
    `  build       ${p.build.join("\n              ")}`,
    ...(p.renderLog ? [`  render-log  rendered ${p.renderLog.kind} ${p.renderLog.path}`] : ["  render-log  none (the workflow writes none)"]),
    `  gate        ${p.gate}`,
    `  commit      ${p.commit.join(" / ")}`,
    ...(p.steps ?? []).map((s) => `  step ${s.action.padEnd(6)} ${s.name}${s.reason ? ` — ${s.reason}` : ""}`),
    ...p.notRun.map((n) => `  not run     ${n}`),
    ...(p.missing?.length ? p.missing.map((m) => `  MISSING     ${m}`) : []),
  ];
  return l.join("\n");
}

export interface StageOptions {
  repo: string;
  branch?: string;
  base?: string;
  runUrl?: string;
  /** Build, and compose the commit in a temporary publish-branch worktree; push nothing. */
  dryRun?: boolean;
  /** Print the plan and stop: nothing is built, nothing written. */
  plan?: boolean;
  /** Publish the main site at the root. Implied on the default branch; refused off it. */
  main?: boolean;
  /** Write an Artifact bundle here instead of pushing. */
  artifact?: string;
  /** Re-lay, before the build, every mount whose bytes no longer match the lock ({@link relayEditedMounts}). */
  fresh?: boolean;
  /** A declared publisher: read the reusable workflow from this local checkout instead of fetching it. */
  workflowSource?: string;
  /** Which publisher, when the repository's workflows call several (the folio by default). */
  publisher?: Publisher;
  /** IG publisher: publish the IG Publisher's output as it is, even where the folio site route applies. */
  bareIg?: boolean;
  /**
   * The publishers on offer besides the folio's. Absent: the ones `repo`'s
   * declared dependencies contribute through their `site-publisher-<kind>`
   * pipeline slots ({@link declaredSitePublishers}). A test, or a caller that
   * has already loaded them, hands them over here.
   */
  publishers?: readonly SitePublisher[];
  log?: (s: string) => void;
}

export interface StageResult {
  kind: Publisher;
  target: Target;
  slug: string;
  url: string;
  pushed: boolean;
  commit?: string;
  site: string;
  plan: StagePlan;
  /** With `dryRun`: the commit composed and discarded, as `git diff --shortstat` reads it. */
  composed?: string;
  /** With `artifact`: the bundle written, and where. */
  bundle?: ArtifactBundle & { dir: string };
}

interface PushLoop {
  repo: string;
  publishBranch: string;
  dryRun?: boolean;
  /** Hold the push on `staging-push-gate.ts` (previews only, as the workflow). */
  gate: boolean;
  /** Push attempts before giving up (without the gate). */
  attempts: number;
  compose: (pages: string) => Composed;
  url: string;
  log: (s: string) => void;
}

/**
 * Check out the publish branch in a temporary worktree, compose the publish
 * there, commit, and push — or, with `dryRun`, stop after the commit. Every
 * attempt starts from the branch's current tip, so a lost race is recomposed
 * on the winner rather than rebased over it.
 */
async function pushLoop(o: PushLoop): Promise<{ pushed: boolean; commit?: string; composed?: string }> {
  const pages = mkdtempSync(join(tmpdir(), "stage-local-"));
  // No publish branch yet (a first publish): start one, an orphan holding
  // `.nojekyll`, and publish onto it as onto any other (an IG's first agent publish, 2026-11-06).
  // A dry run pushes nothing, so it composes on an orphan worktree instead.
  let exists = spawnSync("git", ["-C", o.repo, "ls-remote", "--exit-code", "--heads", "origin", o.publishBranch], { stdio: "ignore" }).status === 0;
  if (!exists && !o.dryRun) {
    ensurePublishBranch(git(o.repo, ["remote", "get-url", "origin"]), o.publishBranch, { log: o.log });
    exists = true;
  }
  const orphan = exists ? undefined : `stage-local-orphan-${process.pid}`;
  try {
    if (exists) {
      git(o.repo, ["fetch", "-q", "--depth=1", "origin", o.publishBranch]);
      git(o.repo, ["worktree", "add", "-q", "--detach", pages, "FETCH_HEAD"]);
    } else {
      o.log(`· no ${o.publishBranch} branch yet; starting one`);
      git(o.repo, ["worktree", "add", "-q", "--orphan", "-b", orphan!, pages]);
    }
    const queuedMs = Date.now();
    for (let lost = 0, failed = 0, attempt = 1; ; attempt++) {
      if (exists) {
        git(pages, ["fetch", "-q", "--depth=1", "origin", o.publishBranch]);
        git(pages, ["reset", "-q", "--hard", "FETCH_HEAD"]);
        git(pages, ["clean", "-q", "-fdx"]);
      }
      if (o.gate && exists && !o.dryRun) {
        const tip = readTip(pages);
        if (!tip) throw new Error("could not read the publish branch tip — refusing to call the window open");
        const d = decide(tip, Date.now(), queuedMs);
        if (d.expired) throw new Error("waited past the gate's deadline: the publish branch is being pushed continuously; not deployed");
        if (!d.open) {
          const ms = Math.max(d.openAtMs - Date.now(), 0) + 5_000;
          o.log(`· gate closed — ${d.reason}; waiting ${Math.round(ms / 1000)}s`);
          await new Promise((r) => setTimeout(r, ms));
          continue;
        }
      }
      const before = exists ? git(pages, ["rev-parse", "HEAD"]) : undefined;
      const c = o.compose(pages);
      git(pages, ["add", "-A", "--", ...c.add]);
      if (git(pages, ["status", "--porcelain"]) === "") {
        o.log("· the publish is unchanged; nothing to push");
        return { pushed: false };
      }
      const stat = git(pages, ["diff", "--cached", "--shortstat"]);
      git(pages, ["commit", "-q", ...c.commit.flatMap((m) => ["-m", m])]);
      if (o.dryRun) {
        o.log(`✓ --dry-run: composed ${git(pages, ["rev-parse", "--short", "HEAD"])} "${c.commit[0]}" on ${o.publishBranch} in a temporary worktree (${stat}); nothing pushed`);
        return { pushed: false, composed: stat };
      }
      const r = spawnSync("git", ["-C", pages, "push", "-q", "origin", `HEAD:${o.publishBranch}`], { stdio: "inherit" });
      if (r.status === 0) {
        const commit = git(pages, ["rev-parse", "HEAD"]);
        o.log(`✓ pushed ${commit.slice(0, 7)} to ${o.publishBranch}; live at ${o.url} once GitHub's Pages deploy has run`);
        return { pushed: true, commit };
      }
      if (!exists) throw new Error(`could not start ${o.publishBranch}; not deployed`);
      if (o.gate) {
        // A rejection with the tip MOVED is a lost race: the gate now holds this
        // push for that one's window. With the tip UNMOVED it is our failure.
        git(pages, ["fetch", "-q", "--depth=1", "origin", o.publishBranch]);
        if (git(pages, ["rev-parse", "FETCH_HEAD"]) !== before) {
          if (++lost > 20) throw new Error("lost the race to the publish branch 20 times; not deployed");
        } else if (++failed >= 3) throw new Error("push rejected 3 times with the tip unmoved; not deployed");
      } else {
        if (attempt >= o.attempts) throw new Error(`could not publish after ${o.attempts} attempts; not deployed`);
        const ms = waitFor(attempt, PUSH_BASE_MS, PUSH_CAP_MS);
        o.log(`· push rejected; recomposing on the new tip in ${Math.round(ms / 1000)}s`);
        await new Promise((res) => setTimeout(res, ms));
      }
    }
  } finally {
    spawnSync("git", ["-C", o.repo, "worktree", "remove", "--force", pages]);
    if (orphan) spawnSync("git", ["-C", o.repo, "branch", "-D", orphan], { stdio: "ignore" });
  }
}

function writeArtifact(site: string, out: string, platform: string | undefined, meta: Record<string, string>, log: (s: string) => void): ArtifactBundle & { dir: string } {
  const dir = resolve(out);
  const b = artifactBundle(listSite(site));
  rmSync(dir, { recursive: true, force: true });
  for (const p of [b.page, ...b.files]) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    cpSync(join(site, p), join(dir, p));
  }
  const vendored = platform ? vendorPlatformAssets(dir, [b.page, ...b.files], platform) : [];
  if (b.files.length + vendored.length > ARTIFACT_MAX_FILES) throw new Error(`with the platform's ${vendored.length} asset(s) the bundle exceeds one Artifact publish`);
  b.files = [...b.files, ...vendored].sort();
  if (vendored.length) log(`· carried ${vendored.length} platform asset(s) into the bundle: an Artifact loads scripts only from its allowed hosts`);
  writeFileSync(join(dir, "artifact.json"), JSON.stringify({ $schema: "stage-local-artifact/v1", ...meta, ...b }, null, 1) + "\n");
  for (const d of b.dropped) log(`· left out ${d.dir}/ (${d.files} files) to fit one Artifact publish; links into it 404 there`);
  log(`✓ Artifact bundle in ${dir}: index.html + ${b.files.length} files, ${(b.bytes / 1048576).toFixed(1)} MB; nothing pushed`);
  return { ...b, dir };
}

/** Steps of `folio-staging.yml` this path does not run, and why — said in every plan. */
const FOLIO_NOT_RUN = {
  preview: ["the QA sweep, block screenshots, review-comment ingestion and the PR comment (the banner names the preview as built locally)"],
  main: ["nothing of publish-main's own steps; its run link is replaced by `built locally: <commit url>`"],
};

/**
 * What `stageLocal` hands a declared publisher: the run it detected, after the
 * checks every publish shares (the target from the branch; the main site only
 * from the pushed default branch).
 */
export interface PublisherRun {
  o: StageOptions;
  log: (s: string) => void;
  repo: string;
  detected: Detected;
  branch: string;
  sha: string;
  ownerRepo: string;
  pagesRoot: string;
  runUrl: string;
  defaultBranch: string | undefined;
  target: Target;
  /** The repository's own workflow file, repository-relative. */
  caller: string;
  /** `<owner>/<repo>/<path>@<ref>` of the reusable workflow it calls. */
  workflow: string;
}

/**
 * The services this layer lends a declared publisher, so that every publish
 * prints its plan, pushes and writes an Artifact bundle the same way. Handed
 * over rather than imported, because the publisher may be loaded from a
 * layer mounted in the checkout being published, whose own copy of this file
 * is not the one running.
 */
export interface PublisherHost {
  formatPlan: typeof formatPlan;
  pushLoop: typeof pushLoop;
  writeArtifact: typeof writeArtifact;
  listSite: typeof listSite;
  run: typeof run;
  git: typeof git;
  platformScript: typeof platformScript;
  /** The advisory size review a publisher runs on its built site before the push ({@link sizeReview}). */
  sizeReview?: typeof sizeReview;
}

/** A site publisher a layer above declares: its workflows, and how it stages a repository that calls one. */
export interface SitePublisher extends PublisherWorkflows {
  stage(run: PublisherRun, host: PublisherHost): Promise<StageResult>;
}

const HOST: PublisherHost = { formatPlan, pushLoop, writeArtifact, listSite, run, git, platformScript, sizeReview };

/**
 * The size review (`site-size.ts`; owner, 2026-11-10: "add size review as part
 * of authoring process"): printed before the push, compared with the local
 * `origin/gh-pages`, its report written to `<repo>/../<name>-site/site-size.json`,
 * beside the build and never in the published site. Advisory: it never stops a publish.
 */
export function sizeReview(repo: string, site: string, name: string, log: (s: string) => void): void {
  const out = join(resolve(repo), "..", `${name}-site`);
  mkdirSync(out, { recursive: true });
  reviewSiteSize({ site, out: join(out, SITE_SIZE_FILE), repo, log });
}

/**
 * Mounts an earlier attempt left "modified" (an IG's first agent publish, 2026-11-06): a
 * plain mount leaves them as they are, so the build's mount step refuses.
 * With `fresh`, re-lay them now (`remote-mount.ts --fresh`, which replaces
 * only the mounts off the lock); without it, a plan says what to run, and the
 * build's mount step refuses with the same words (`build-instance-site.ts`).
 * Answers what was re-laid.
 */
export function relayEditedMounts(repo: string, o: { fresh?: boolean; plan?: boolean }, log: (s: string) => void, relay: (repo: string) => void = relayMounts): string[] {
  const edited = editedMountsIn(repo);
  if (edited.length === 0) return [];
  if (o.plan || !o.fresh) {
    if (o.plan) log(relayAdvice(repo, edited, { script: join(import.meta.dir, "remote-mount.ts") }));
    return [];
  }
  log(`· --fresh: re-laying ${edited.length} mount(s) that no longer match the lock: ${edited.map((e) => e.path ?? e.instance).join(", ")}`);
  relay(repo);
  return edited.map((e) => e.path ?? e.instance);
}

function relayMounts(repo: string): void {
  run(repo, "bun", ["run", join(import.meta.dir, "remote-mount.ts"), "--fresh"]);
}

/** The declared publishers for `repo`, or none, said, when its dependencies cannot be read. */
function publishersFor(repo: string, log: (s: string) => void): readonly SitePublisher[] {
  try {
    return declaredSitePublishers(repo) as unknown as SitePublisher[];
  } catch (e) {
    log(`· no declared site publisher could be read from ${repo}'s dependencies (${(e as Error).message}); only the folio publisher is on offer`);
    return [];
  }
}

export async function stageLocal(o: StageOptions): Promise<StageResult> {
  const log = o.log ?? ((s: string) => console.error(s));
  const repo = resolve(o.repo);
  const declared = o.publishers ?? publishersFor(repo, log);
  const branch = o.branch ?? git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const sha = git(repo, ["rev-parse", "HEAD"]);
  // The CONFIGURED url, not `remote get-url`: an `insteadOf` rewrite (a mirror,
  // a proxy) changes where git talks to, not which repository this is.
  const ownerRepo = ownerRepoOf(git(repo, ["config", "--get", "remote.origin.url"]));
  if (!ownerRepo) throw new Error("origin is not a GitHub remote");
  const [selfOwner, selfName] = ownerRepo.split("/") as [string, string];
  const detected = detectPublisher(readWorkflows(repo), [FOLIO_PUBLISHER, ...declared], o.publisher, { owner: selfOwner, repo: selfName, ref: sha });
  const [owner, name] = ownerRepo.split("/") as [string, string];
  const pagesRoot = `https://${owner}.github.io/${name}`;
  const gh = `https://github.com/${ownerRepo}`;
  const runUrl = o.runUrl ?? `${gh}/commit/${sha}`;
  const defaultBranch = readDefaultBranch(repo);
  const target = chooseTarget({ branch, defaultBranch, ...(o.main ? { main: true } : {}) });
  if (target === "main" && !o.plan) {
    // The root is main as PUSHED: publish-main builds the commit the push
    // event names. A local commit nobody has pushed is not main's site.
    git(repo, ["fetch", "-q", "origin", defaultBranch ?? branch]);
    const tip = git(repo, ["rev-parse", "FETCH_HEAD"]);
    if (tip !== sha) throw notTipError(repo, sha, tip, defaultBranch ?? branch);
  }
  const caller = `.github/workflows/${detected.caller}`;
  const workflow = `${detected.uses.owner}/${detected.uses.repo}/${detected.uses.path}@${detected.uses.ref}`;
  log(agentRunLine(agentRunOf(repo)));
  if (detected.alsoCalls) log(`· this repository also calls ${detected.alsoCalls.file} (${detected.alsoCalls.caller}); building the ${detected.kind} — pass --publisher ${detected.alsoCalls.kind} for the other`);

  if (detected.kind !== FOLIO_PUBLISHER_KIND) {
    const publisher = declared.find((p) => p.kind === detected.kind)!;
    relayEditedMounts(repo, o, log);
    return publisher.stage({ o, log, repo, detected, branch, sha, ownerRepo, pagesRoot, runUrl, defaultBranch, target, caller, workflow }, HOST);
  }

  const inputs = readStagingInputs(readFileSync(join(repo, caller), "utf-8"));
  if (!inputs) throw new Error(`${caller}: no build_command — this folio has no staging workflow to mirror`);
  const slug = target === "main" ? branch : slugOf(branch);
  if (!slug) throw new Error(`branch '${branch}' gives no safe staging slug`);
  const url = target === "main" ? `${pagesRoot}/` : `${pagesRoot}/${previewPath(slug)}/`;
  const platform = resolve(repo, inputs.platform_dir);
  const site = resolve(repo, inputs.site_dir);
  const base = o.base ?? defaultBranch ?? "main";
  const plan: StagePlan = {
    kind: "folio", caller, workflow, target, branch, ...(defaultBranch ? { defaultBranch } : {}), sha,
    publishBranch: inputs.publish_branch,
    dest: target === "main" ? "/" : `${previewPath(slug)}/`,
    url,
    replaces: target === "main" ? `only the files the last main publish listed in ${MANIFEST}` : `${previewPath(slug)}/, wholesale (bean 85im)`,
    preserved: target === "main" ? [...RESERVED, "any root file no manifest names"] : [`everything outside ${previewPath(slug)}/`],
    build: [inputs.build_command, "rail-standalone-pages.ts", ...(target === "preview" ? ["changeset.ts + document-rendered-impact.ts (when the platform has them)", "staging-banner.ts"] : [])],
    renderLog: target === "main" ? { kind: "main-site", path: "/" } : { kind: "staging-preview", path: previewPath(slug) },
    gate: target === "main" ? "none, as publish-main: the main publish is what staging-push-gate protects; 3 push attempts" : "staging-push-gate.ts (issue #1956)",
    commit: target === "main" ? mainCommitMessage(sha, branch, runUrl) : previewCommitMessage(slug, sha, runUrl),
    notRun: FOLIO_NOT_RUN[target],
  };
  log(formatPlan(plan));
  const done = (r: Partial<StageResult>): StageResult => ({ kind: "folio", target, slug, url, pushed: false, site, plan, ...r });
  if (o.plan) return done({});

  if (!existsSync(join(platform, "cat-harness"))) throw new Error(`${platform}: the platform is not checked out where ${caller} names it`);
  const script = (n: string) => platformScript(platform, n);

  log(`· building ${ownerRepo}@${branch} (${sha.slice(0, 7)}) → ${plan.dest}`);
  rmSync(site, { recursive: true, force: true });
  run(repo, "bash", ["-c", inputs.build_command]);
  if (!builtSomething(site)) throw new Error(`the build produced no site in ${site} — refusing to deploy`);

  run(repo, "bun", ["run", script("rail-standalone-pages.ts"), "--site", site, "--built", "cat-harness", "--foreign-site", "--home-label", name]);
  // The layer's JSON-LD context and vocabulary, as every declared site publishes
  // them (IRI fix 1A, d): a folio built from a workflow file gets them too.
  const layer = declaredLayerName(repo);
  if (layer !== undefined) {
    for (const st of linkedDataSteps(dirname(script("publish-instance-context.ts")), layer, site)) softRun(st.label, st.argv, repo);
  }
  // And it serves the IRIs it mints (IRI fix 1A, f): a finding, never a refusal.
  const declFile = findDeclarationFile(resolve(repo));
  const iriBase = declFile === undefined ? undefined : declaredIriBase(join(resolve(repo), declFile));
  if (iriBase !== undefined) {
    const st = siteIriCheckStep(dirname(script("check-site-iris.ts")), site, iriBase);
    softRun(st.label, st.argv, repo, spawnSync, st.ok);
  }

  if (target === "preview") {
    git(repo, ["fetch", "-q", "origin", base]);
    // The ChangeSet and the rendered impact are a content layer's, above this
    // one: found in whichever of the platform's layers carries them, never
    // named here. A platform without them gets no review data, and the review
    // page says so, as the workflow does when it has no renderer.
    // declared-path-literal: a path INSIDE another platform layer, resolved
    // by inPlatform against each layer's root, never against this one.
    const changeset = inPlatform(platform, "schemas/changeset.ts");
    if (changeset) run(repo, "bun", ["run", changeset, "--folio", inputs.folio_dir, "--base", `origin/${base}`, "--head", "worktree", "--out", join(site, "changeset.json"), "--text-out", join(site, "changeset-text.json"), "--structure-out", join(site, "changeset-structure.json")]);
    else log("· this platform has no ChangeSet tool: no review data on this preview");
    const impact = inPlatform(platform, "scripts/document-rendered-impact.ts");
    if (changeset && impact) {
      run(repo, "bun", ["run", impact, "--root", ".", "--base", `origin/${base}`, "--head", "HEAD", "--changeset", join(site, "changeset.json"), "--outline", join(site, "outline.json"), "--build-command", inputs.build_command, "--out", join(site, "rendered-impact.json")]);
    }

    run(repo, "bun", [
      "run", script("staging-banner.ts"),
      "--site", site, "--branch", branch, "--sha", sha.slice(0, 7),
      "--built", `${new Date().toISOString().replace(/\.\d+Z$/, "Z")} (built locally by an agent)`,
      "--pr", "n/a", "--pr-url", `${gh}/pulls?q=head%3A${encodeURIComponent(branch)}`,
      "--branch-url", `${gh}/tree/${branch}`, "--issues-url", `${gh}/issues`,
      "--run-url", runUrl, "--main-site", pagesRoot, "--before-ref", base,
      ...((mp) => (mp ? ["--main-pages", mp] : []))(mainPagesFile(repo, inputs.publish_branch, log)),
    ]);
  }

  if (target === "preview") {
    previewQa(repo, site, sha, log);
    writePreviewRecord(repo, site, { slug, sha, base, log });
  }
  sizeReview(repo, site, name, log);

  if (o.artifact) return done({ bundle: writeArtifact(site, o.artifact, platform, { slug, branch, sha }, log) });

  const compose = target === "main"
    ? (pages: string) => composeMain(pages, site, { branch, sha, runUrl, script })
    : (pages: string) => composePreview(pages, site, { slug, branch, sha, runUrl, script });
  const r = await pushLoop({ repo, publishBranch: inputs.publish_branch, ...(o.dryRun ? { dryRun: true } : {}), gate: target === "preview", attempts: 3, compose, url, log });
  return done(r);
}

/**
 * The layer a checkout declares at its root, and the `site.build` recipe its
 * config carries (its `index.config.json` entry, index first), or undefined when it declares none. A
 * repository that declares a recipe builds its site from its own package
 * scripts, through `build-instance-site.ts`, rather than from a workflow file.
 * smart-ra has no publishing workflow at all (bean n3h9), so reading its
 * workflows found only `fhirbuild.yml` and took the folio for an IG.
 */
/** The name of the layer `repo` declares at its root, or `undefined` when it declares none. */
export function declaredLayerName(repo: string): string | undefined {
  const root = resolve(repo);
  const file = findDeclarationFile(root);
  return file === undefined ? undefined : siteFields(readFileSync(join(root, file), "utf-8"), join(root, file)).name;
}

export function declaredRecipe(repo: string): { instance: string; recipe: SiteRecipe } | undefined {
  const root = resolve(repo);
  const file = findDeclarationFile(root);
  if (file === undefined) return undefined;
  const instance = siteFields(readFileSync(join(root, file), "utf-8"), join(root, file)).name;
  const recipe = recipeFromConfig(root, instance);
  return recipe === undefined ? undefined : { instance, recipe };
}

/** What `stageDeclared` did: the declared-recipe path's answer to {@link StageResult}. */
export interface DeclaredResult {
  kind: "folio";
  via: "site.build";
  instance: string;
  target: Target;
  url: string;
  pushed: boolean;
  site?: string;
}

/**
 * The declared-recipe path: hand the checkout to `build-instance-site.ts` with
 * its own `site.build`. The target follows the branch exactly as
 * {@link chooseTarget} decides it for a workflow-described folio. The root is
 * published only from the pushed default branch, a preview at
 * `branches/<branch>/`, and `--plan` and `--dry-run` publish nothing.
 */
export async function stageDeclared(
  o: StageOptions,
  d: { instance: string; recipe: SiteRecipe },
): Promise<DeclaredResult> {
  const log = o.log ?? ((s: string) => console.error(s));
  if (o.artifact) throw new Error("--artifact is not available for a site.build recipe: build-instance-site publishes to the Pages branch only");
  const repo = resolve(o.repo);
  const branch = o.branch ?? git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const sha = git(repo, ["rev-parse", "HEAD"]);
  const remote = git(repo, ["config", "--get", "remote.origin.url"]);
  const ownerRepo = ownerRepoOf(remote);
  if (!ownerRepo) throw new Error("origin is not a GitHub remote");
  const [owner, name] = ownerRepo.split("/") as [string, string];
  const defaultBranch = readDefaultBranch(repo);
  const target = chooseTarget({ branch, defaultBranch, ...(o.main ? { main: true } : {}) });
  if (target === "main" && !o.plan) {
    git(repo, ["fetch", "-q", "origin", defaultBranch ?? branch]);
    const tip = git(repo, ["rev-parse", "FETCH_HEAD"]);
    if (tip !== sha) {
      const err = notTipError(repo, sha, tip, defaultBranch ?? branch);
      const live = err instanceof SupersededError ? liveRootCommit(repo) : undefined;
      if (!(err instanceof SupersededError) || !publishSupersededAnyway(repo, sha, live)) throw err;
      log(`· superseded by ${tip.slice(0, 7)}, but the live root (${live!.slice(0, 7)}) is older than ${sha.slice(0, 7)}: publishing ${sha.slice(0, 7)} so the site moves forward while merges keep landing`);
    }
  }
  const url = `https://${owner}.github.io/${name}/${target === "preview" ? `${PREVIEW_PREFIX}/${branch.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")}/` : ""}`;
  const publish = !o.plan && !o.dryRun;
  log(`plan: ${d.instance}'s declared site (site.build) → ${target === "main" ? "the publish root" : `${PREVIEW_PREFIX}/ preview of ${branch}`}`);
  log(agentRunLine(agentRunOf(repo)).trimStart());
  log(`via         build-instance-site.ts --instance ${d.instance}${target === "preview" ? ` --staging ${branch}` : ""}${publish ? " --publish" : ""}`);
  const scope = siteScopeOf(repo, d.instance);
  log(`scope       ${scope ? `${scope.join(", ")}: the other layers' pages are linked on their own sites, not written here` : "every instance the checkout mounts"}`);
  log(`pre         ${d.recipe.pre.join(", ") || "(none)"}`);
  log(`source      ${d.recipe.sourceSteps.join(", ") || "(none)"}`);
  log(`site        ${d.recipe.siteSteps.join(", ") || "(none)"}`);
  if (d.recipe.finalSteps?.length) log(`final       ${d.recipe.finalSteps.join(", ")} (after the platform's own writers)`);
  log(`profile     ${d.recipe.profile ?? "folio"}${d.recipe.profile === "ig-repo-site" ? " (the platform steps folio-site.yml runs: the shell, its navbar, Jekyll, the rail)" : ""}`);
  if (d.recipe.extends) log(`extends     ${d.recipe.extends} (shared site preset: its steps run first, read once the layers are mounted)`);
  log(`links       ${d.recipe.links === "refuse" ? "refuse: an unresolved link refuses the publish (the recipe says so)" : d.recipe.links === undefined && d.recipe.extends ? "as the preset says (refuse in the shared presets)" : "report: unresolved links are said, not refused"}`);
  log("refuses     only on graph data (.json/.jsonld) and a build that cannot run; pages, links, scripts and stylesheets are QA findings (assets/site-qa/)");
  if (target === "main") {
    log(`keeps       branches/, STAGING/, _render-log/${(d.recipe.keep ?? []).map((k) => `, ${k}/`).join("")}`);
    log(`guard       the build is measured against the published root (site-parity.ts: theme side bar and search, icon row, rail, top-level directories, folio-build.json); a shortfall is reported to QA (assets/site-qa/parity.json), not refused`);
  }
  relayEditedMounts(repo, o, log);
  if (o.plan) return { kind: "folio", via: "site.build", instance: d.instance, target, url, pushed: false };
  const open = target === "preview" ? await openPrFor(owner, name, branch, log) : undefined;
  const pr = open?.number;
  const base = previewBase({ ...(o.base ? { base: o.base } : {}), ...(open ? { prBase: open.base } : {}), ...(defaultBranch ? { defaultBranch } : {}) });
  if (target === "preview") log(`· review compares against origin/${base}${o.base ? " (--base)" : open ? ` (PR #${open.number}'s base)` : " (the default branch)"}`);
  const r = await buildInstanceSite({
    root: repo,
    instance: d.instance,
    linkRoot: "https://litlfred.github.io/folio-assistant",
    out: join(repo, "..", `${d.instance}-site`),
    ...(d.recipe.home !== undefined ? { home: d.recipe.home } : {}),
    pre: d.recipe.pre,
    sourceSteps: d.recipe.sourceSteps,
    siteSteps: d.recipe.siteSteps,
    ...(d.recipe.finalSteps ? { finalSteps: d.recipe.finalSteps } : {}),
    ...(d.recipe.keep ? { keep: d.recipe.keep } : {}),
    ...(d.recipe.profile ? { profile: d.recipe.profile } : {}),
    ...(d.recipe.links ? { links: d.recipe.links } : {}),
    ...(d.recipe.extends ? { extends: d.recipe.extends } : {}),
    ...(d.recipe.coverage ? { coverage: d.recipe.coverage } : {}),
    ...(d.recipe.rootIndex ? { rootIndex: true } : {}),
    ...(target === "preview" ? { staging: branch, beforePublish: (site: string) => {
      previewData(repo, { instance: d.instance, branch, sha, base, owner, name, ...(o.runUrl ? { runUrl: o.runUrl } : {}), ...(pr ? { pr } : {}) }, site, log);
      previewQa(repo, site, sha, log);
      writePreviewRecord(repo, site, { slug: branch.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, ""), sha, base, log });
    } } : {}),
    ...(scope ? { scope } : {}),
    mount: true,
    fresh: false,
    publish,
    // The remote is read even when nothing is published: the root's guard measures what it would replace.
    remote,
  });
  return { kind: "folio", via: "site.build", instance: d.instance, target, url, pushed: publish, site: r.site };
}

/**
 * Every agent-built preview carries its build record (`preview-record.ts`,
 * folio-assistant#2881): the tree it was built from and a hash of every file,
 * so CI can rebuild the same tree in full afterwards and replace the preview
 * if anything differs (owner, 2026-11-01, Q-SPD-9 B and Q-SPD-9b A). Written
 * last, after every step that changes the site, and never for the main site,
 * which stays CI-built.
 */
/**
 * "This change (preview)" on top of every QA page of a preview (owner,
 * 2026-11-14; `preview-qa.ts`): the cone run's report when the checkout has
 * one for this commit (`build/preview-qa/preview-qa.json`, or
 * `PREVIEW_QA_REPORT`; the site-publish workflow fetches it), else a section
 * that says no cone run is recorded and how to start one. The main QA
 * report stays below it, unchanged.
 */
export function previewQa(repo: string, site: string, sha: string, log: (s: string) => void): void {
  const report = findReport(repo);
  const pages = injectSite(site, report, { sha });
  const state = report === undefined ? "no cone run recorded" : report.head.startsWith(sha.slice(0, 7)) ? `cone run of ${report.head.slice(0, 7)}` : `cone run of ${report.head.slice(0, 7)}, not this commit`;
  log(`· preview QA (${state}) on ${pages.length} QA page(s)`);
}

export function writePreviewRecord(repo: string, site: string, o: { slug: string; sha: string; base: string; log: (s: string) => void }): void {
  let baseSha: string | undefined;
  try {
    baseSha = git(repo, ["rev-parse", `origin/${o.base}`]);
  } catch {
    baseSha = undefined;
  }
  const r = makeRecord({ site, repo, slug: o.slug, builder: "agent", head: o.sha, ...(baseSha ? { base: baseSha } : {}) });
  writeFileSync(join(site, RECORD_FILE), JSON.stringify(r, null, 1) + "\n");
  o.log(`· build record: ${Object.keys(r.files).length} file(s), tree ${r.tree.slice(0, 12)} → ${RECORD_FILE} (CI rebuilds this tree and replaces the preview if it differs)`);
}

/**
 * The branch a preview's review page compares against. A pull request is
 * reviewed against the branch it merges into, so a change set stacked on an
 * unmerged baseline shows only its own change, not the whole baseline. In
 * order: `--base`, the open PR's base, the default branch, `main`.
 */
export function previewBase(o: { base?: string; prBase?: string; defaultBranch?: string }): string {
  return o.base || o.prBase || o.defaultBranch || "main";
}

/**
 * The open pull request whose head is `branch` (its number and the branch it
 * merges into), or `undefined`, said in the
 * log. A preview's review comments are the tagged comments on that PR (bean
 * 423d), and the workflow is handed its number by the event; a local build has
 * to ask. A lookup that fails (no network, a rate limit) costs the preview its
 * comments, not its publish.
 */
export async function openPrFor(owner: string, name: string, branch: string, log: (s: string) => void): Promise<{ number: number; base: string } | undefined> {
  const q = `https://api.github.com/repos/${owner}/${name}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`;
  try {
    const token = process.env.GITHUB_TOKEN;
    const r = await fetch(q, { headers: { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) } });
    if (!r.ok) {
      log(`· no PR looked up for ${branch} (GitHub answered ${r.status}): no review comments on this preview`);
      return undefined;
    }
    const prs = (await r.json()) as { number: number; base?: { ref?: string } }[];
    if (!prs.length) log(`· ${branch} has no open pull request: no review comments on this preview`);
    const p = prs[0];
    return p ? { number: p.number, base: p.base?.ref ?? "" } : undefined;
  } catch (e) {
    log(`· no PR looked up for ${branch} (${(e as Error).message}): no review comments on this preview`);
    return undefined;
  }
}

/**
 * A declared-recipe preview's review data, as the workflow-described path
 * writes it: the ChangeSet (`changeset.json`, `changeset-text.json`) from the
 * platform's content layer when it carries one, and the staging banner with
 * its `staging.json`. Without them the review page of a `site.build` folio
 * (dth-hrh) said there was nothing to compare against (bean xp72). The folio
 * is `folio/<instance>`, the conventional root; a checkout without one gets
 * the banner and no ChangeSet, and says so.
 */
/**
 * The pages the MAIN site holds, read from the publish ref, written one path
 * per line for `staging-banner.ts --main-pages`, or undefined when the ref
 * could not be read.
 *
 * Without it the banner cannot tell which pages main has, so every page's
 * "compare with main" link fell back to the site root (owner, 2026-10-30:
 * "compare with main should show same page as on main"). The ref is read in
 * a throwaway bare repository, shallow and blob-less, so the checkout's own
 * history and refs are never touched. branches/ and _render-log/ are not main
 * pages, so they are left out.
 */
export function mainPagesFile(repo: string, publishBranch: string, log: (s: string) => void): string | undefined {
  const tmp = mkdtempSync(join(tmpdir(), "main-pages-"));
  try {
    const remote = git(repo, ["remote", "get-url", "origin"]);
    execFileSync("git", ["init", "-q", "--bare", tmp]);
    execFileSync("git", ["-C", tmp, "fetch", "-q", "--depth=1", "--filter=blob:none", remote, publishBranch], { stdio: ["ignore", "pipe", "pipe"] });
    const pages = execFileSync("git", ["-C", tmp, "ls-tree", "-r", "--name-only", "FETCH_HEAD"], { encoding: "utf-8", maxBuffer: 512 * 1024 * 1024 })
      .split("\n")
      .filter((l) => l.endsWith(".html") && !isPreviewPath(l) && !l.startsWith("_render-log/"));
    const out = join(mkdtempSync(join(tmpdir(), "main-pages-list-")), "main-pages.txt");
    writeFileSync(out, pages.join("\n") + "\n");
    log(`· the publish ref ${publishBranch} holds ${pages.length} main page(s): compare links go to the same page on main`);
    return out;
  } catch (e) {
    log(`⚠ could not read the publish ref ${publishBranch} (${(e as Error).message.split("\n")[0]}): compare links fall back to the site root`);
    return undefined;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function previewData(
  repo: string,
  f: { instance: string; branch: string; sha: string; base: string; owner: string; name: string; runUrl?: string; pr?: number },
  site: string,
  log: (s: string) => void,
): void {
  git(repo, ["fetch", "-q", "origin", f.base]);
  // declared-path-literal: the conventional `<repo>/folio/<instance>` root of a `site.build` folio, and a path INSIDE another platform layer resolved by inPlatform against each layer's root.
  const folio = join("folio", f.instance);
  const changeset = inPlatform(repo, "schemas/changeset.ts");
  if (!changeset) log("· this platform has no ChangeSet tool: no review data on this preview");
  else if (!existsSync(join(repo, folio))) log(`· no ${folio}/ in this checkout: no ChangeSet on this preview`);
  // The ChangeSet is read from the folio ROOT, as the workflow path does
  // (`inputs.folio_dir`), so each block's file starts with its document's
  // slug. The review page takes that first segment as the document
  // (`docOf` in gen-review-page.ts). Read from `folio/<instance>`, the files
  // started at the chapter, and every "view on this preview" link and
  // side-by-side frame went to `<chapter>/index.html`, a 404 (smart-ra#97,
  // 2026-10-30).
  else run(repo, "bun", ["run", changeset, "--folio", dirname(folio), "--base", `origin/${f.base}`, "--head", "worktree", "--out", join(site, "changeset.json"), "--text-out", join(site, "changeset-text.json"), "--structure-out", join(site, "changeset-structure.json")]);
  // The PR's tagged review comments, as the workflow's `stage` job ingests them:
  // `blocks.json` from the head's manifests and `review-comments.json`, with the
  // statuses committed to the folio's todos graph winning (bean 423d).
  const comments = inPlatform(repo, "scripts/review-comments.ts");
  if (f.pr === undefined) {
    // said by openPrFor
  } else if (!comments) log("· this platform has no review-comments Tool: no review comments on this preview");
  else if (!existsSync(join(repo, folio))) log(`· no ${folio}/ in this checkout: no review comments on this preview`);
  else {
    // declared-path-literal: the folio's todos graph root, as `review-comment-move.ts` reads it (`todos/todos.json`).
    const todos = join(repo, "todos");
    const hasTodos = existsSync(join(todos, "todos.json"));
    run(repo, "bun", [
      "run", comments, "--repo", `${f.owner}/${f.name}`, "--pr", String(f.pr), "--commit", f.sha,
      "--folio", folio, "--blocks-out", join(site, "blocks.json"), "--out", join(site, "review-comments.json"),
      ...(hasTodos ? ["--todos", todos, "--write-decided"] : []),
    ]);
    // A `resolve:` decision applied above is RECORDED, not only published
    // (owner, 2026-10-15): the Tool wrote each decided comment into the todos
    // graph's feedback directory, and a graph kept on its own state branch is
    // spliced there by `state:push` (a no-op when nothing changed, and when the
    // graph is not branch-kept). A todos graph in the feature branch's tree is
    // left for the editor to commit. A push that fails costs the record, which
    // the next build writes again, not the preview.
    const push = hasTodos ? inPlatform(repo, "scripts/state-push.ts") : undefined;
    if (push) {
      const r = spawnSync("bun", ["run", push, "--id", "todos", "-m", `review decisions from PR #${f.pr}`], { cwd: repo, encoding: "utf-8" });
      const said = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-2).join(" ");
      log(r.status === 0 ? `· todos: ${said || "pushed"}` : `⚠ todos not pushed (${said}): the next build records the decisions again`);
    }
  }
  const banner = inPlatform(repo, "scripts/staging-banner.ts");
  if (!banner) { log("· this platform has no staging banner: no staging.json on this preview"); return; }
  const gh = `https://github.com/${f.owner}/${f.name}`;
  run(repo, "bun", [
    "run", banner,
    "--site", site, "--branch", f.branch, "--sha", f.sha.slice(0, 7),
    "--built", `${new Date().toISOString().replace(/\.\d+Z$/, "Z")} (built locally by an agent)`,
    ...(f.pr !== undefined
      ? ["--pr", String(f.pr), "--pr-url", `${gh}/pull/${f.pr}`]
      : ["--pr", "n/a", "--pr-url", `${gh}/pulls?q=head%3A${encodeURIComponent(f.branch)}`]),
    "--branch-url", `${gh}/tree/${f.branch}`, "--issues-url", `${gh}/issues`,
    "--run-url", f.runUrl ?? `${gh}/commit/${f.sha}`, "--main-site", `https://${f.owner}.github.io/${f.name}/`, "--before-ref", f.base,
    // declared-path-literal: site.build previews publish to gh-pages, as the plan says.
    ...((mp) => (mp ? ["--main-pages", mp] : []))(mainPagesFile(repo, "gh-pages", log)),
  ]);
  if (f.pr !== undefined) writeReviewBrief(site, f.owner, f.name, f.pr, log);
}

/**
 * The review page's "What to expect" pane reads the PR and its issue live;
 * this is its fallback copy, taken now (cat-harness-tools#1153). Best effort:
 * no `gh`, or no network, just means no copy, said in the log.
 */
export function writeReviewBrief(site: string, owner: string, name: string, pr: number, log: (s: string) => void): void {
  const api = (path: string): Record<string, unknown> | null => {
    const r = spawnSync("gh", ["api", `repos/${owner}/${name}/${path}`], { encoding: "utf-8" });
    try { return r.status === 0 ? JSON.parse(r.stdout) : null; } catch { return null; }
  };
  const p = api(`pulls/${pr}`);
  if (!p) { log("· review brief: could not read the PR with gh, so the review page reads it live only"); return; }
  const body = typeof p.body === "string" ? p.body : "";
  const n = closedIssue(body);
  const i = n ? api(`issues/${n}`) : null;
  const brief = {
    fetchedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    pr: { number: pr, title: String(p.title ?? ""), body, url: String(p.html_url ?? "") },
    issue: n ? { number: n, title: String(i?.title ?? ""), url: String(i?.html_url ?? `https://github.com/${owner}/${name}/issues/${n}`) } : null,
  };
  writeFileSync(join(site, "review-brief.json"), JSON.stringify(brief, null, 2) + "\n");
  log(`· review brief: PR #${pr}${n ? ` and issue #${n}` : ""} copied to review-brief.json`);
}

const USAGE = `usage: stage-local.ts [--repo DIR] [--branch B] [--base B] [--run-url URL] [--main] [--fresh] [--plan | --dry-run | --artifact DIR] [--workflow-source DIR] [--publisher KIND] [--bare-ig]

  One command for every agent-run publish: a folio that declares its site in
  its index.config.json entry site.build (built by build-instance-site.ts), a folio whose workflow calls
  ${FOLIO_WORKFLOW}, or a repository whose workflow calls one a mounted layer's declared
  publisher builds (its ${SITE_PUBLISHER_SLOT_PREFIX}<kind> pipeline slot: an IG, where the IG layer
  is mounted); preview or main site. The default branch publishes the main site; any other branch a preview.

  --plan             print what would be built and where, and stop
  --dry-run          build, and compose the commit in a temporary publish-branch worktree; push nothing
  --main             publish the main site (implied on the default branch; refused off it)
  --fresh            first re-lay every mount an earlier build left modified (remote-mount.ts --fresh);
                     without it, such a mount refuses the build and the error says what to run
  --artifact DIR     write a claude.ai Artifact bundle instead of pushing
  --workflow-source  a declared publisher: read the reusable workflow from this checkout instead of fetching it
  --publisher        folio, or a declared publisher's kind (e.g. ig), when the repository's workflows call
                     several (folio by default: it owns the publish root, and an IG root deploy is a clean one)
  --bare-ig          IG: publish the IG Publisher's output as its workflow lays it, even where the
                     repository is harnessed (index.config.json) and would publish its folio site`;

/**
 * The publisher this checkout's `index.config.json` names in `site.publisher`,
 * the default when `--publisher` is not given (cat-harness-tools#1879).
 * Undefined when it names none, or when the file is absent or unreadable.
 */
export function configuredPublisher(repo: string): Publisher | undefined {
  const r = readIndexConfig(resolve(repo));
  return r.state === "ok" ? r.config.site?.publisher : undefined;
}

function publisherOf(s: string): Publisher {
  if (!/^[a-z][a-z0-9-]*$/.test(s)) throw new Error(`--publisher is folio or a declared publisher's kind, not '${s}'`);
  return s;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    console.log(USAGE);
    process.exit(0);
  }
  const opt = (k: string) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  try {
    const repoArg = opt("repo") ?? process.cwd();
    const chosen = opt("publisher") ?? configuredPublisher(repoArg);
    if (opt("publisher") === undefined && chosen !== undefined) console.log(`· publisher ${chosen}, from index.config.json site.publisher`);
    const declared = chosen !== undefined && chosen !== FOLIO_PUBLISHER_KIND ? undefined : declaredRecipe(repoArg);
    if (declared !== undefined) {
      const d = await stageDeclared(
        {
          repo: repoArg,
          ...(opt("branch") ? { branch: opt("branch")! } : {}),
          dryRun: argv.includes("--dry-run"),
          plan: argv.includes("--plan"),
          main: argv.includes("--main"),
          fresh: argv.includes("--fresh"),
          ...(opt("artifact") ? { artifact: opt("artifact")! } : {}),
        },
        declared,
      );
      console.log(JSON.stringify(d));
      process.exit(0);
    }
    const r = await stageLocal({
      repo: opt("repo") ?? process.cwd(),
      ...(opt("branch") ? { branch: opt("branch")! } : {}),
      ...(opt("base") ? { base: opt("base")! } : {}),
      ...(opt("run-url") ? { runUrl: opt("run-url")! } : {}),
      dryRun: argv.includes("--dry-run"),
      plan: argv.includes("--plan"),
      main: argv.includes("--main"),
      fresh: argv.includes("--fresh"),
      ...(opt("artifact") ? { artifact: opt("artifact")! } : {}),
      ...(opt("workflow-source") ? { workflowSource: opt("workflow-source")! } : {}),
      ...(chosen ? { publisher: publisherOf(chosen) } : {}),
      ...(argv.includes("--bare-ig") ? { bareIg: true } : {}),
    });
    const { plan: _plan, ...rest } = r;
    console.log(JSON.stringify(rest));
  } catch (e) {
    if (e instanceof SupersededError) {
      // Not a failure: the newer commit's own push publishes the site.
      console.log(`· superseded: ${e.message}. ${e.tip.slice(0, 7)}'s own push publishes the site; nothing to publish here.`);
      if (process.env.GITHUB_ACTIONS === "true") console.log(`::notice title=Superseded::${e.sha.slice(0, 7)} was replaced on ${e.branch} by ${e.tip.slice(0, 7)}, whose run publishes the site`);
      process.exit(0);
    }
    console.error(`✗ stage-local (${basename(process.argv[1] ?? "")}): ${(e as Error).message}`);
    process.exit(1);
  }
}
