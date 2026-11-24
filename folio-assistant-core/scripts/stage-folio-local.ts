#!/usr/bin/env bun
/**
 * stage-folio-local — a folio's branches/ preview built and published from a
 * checkout, running the same steps as `.github/workflows/folio-staging.yml`
 * in the same order, for when Actions are unavailable.
 *
 * ## Why this exists: a process failure, recorded
 *
 * Owner, 2026-10-05: Actions are off ("no $"), and asked for the qou folio on
 * staging. An agent assembled the preview BY HAND from the workflow's parts
 * and published four times; each time the owner found the step it had
 * skipped — no harness chrome (`rail-standalone-pages`), then no staging
 * banner (`staging-banner`), then a light-mode toggle that did nothing and
 * math taller than the text (never checked in a browser). *"figure out why
 * process failures in harnessing and using chrome from harness."* The cause
 * was not any one step: it was rebuilding a pipeline from memory instead of
 * running it. So the pipeline is this one command, and its last step before
 * publishing is a browser check (`folio-site-chrome-check.ts`) of exactly the
 * defects a person found.
 *
 * Steps, named as in `folio-staging.yml`:
 *   1. Build the folio's site            `--build` (default: build-folio-site.ts)
 *   2. Give every page the harness navbar and rail   rail-standalone-pages.ts --foreign-site
 *   3. Inject staging banner             staging-banner.ts
 *   4. Check the chrome in a browser     folio-site-chrome-check.ts (refuses to publish on a failure)
 *   5. Deploy the preview                `--deploy`: branches/<slug>/ on the publish branch, replaced whole
 *
 * `--slug` is refused (exit 2) unless it is one staging-slug segment
 * ({@link stagingSlugProblem}), and the check server answers only files that
 * are inside the built site after links are followed, on 127.0.0.1
 * ({@link resolveSitePath}). Bean `folio-core-q7x7`.
 *
 * Not run here, and said so rather than skipped silently: the ChangeSet, the
 * folio's QA sweep and the before/after screenshots. They need a base build
 * and a reviewer surface this local path does not have yet.
 *
 *   bun run folio-assistant-core/scripts/stage-folio-local.ts --repo <folio> --slug <slug> \
 *     --publish-repo owner/repo --pr-url <url> --run-url <url> [--check-page <path>] [--lean-status <json>] [--deploy]
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

import { realPathWithin, resolveWithin } from "@litlfred/cat-harness-tools/src/core/safe-path.js";

import { checkChrome } from "./folio-site-chrome-check.js";

// The preview directory (cat-harness-tools `schemas/sdlc/preview-prefix.ts`),
// named here rather than imported so this layer does not wait on that
// module's release.
const PREVIEW_PREFIX = "branches";
const previewPath = (slug: string): string => `${PREVIEW_PREFIX}/${slug}`;

/**
 * The shape a staging slug must have, the same rule `feature-staging.yml`
 * (folio-assistant) applies to the slug it derives from a branch: one path
 * segment of `[A-Za-z0-9._-]`, never `.` or `..`. It is stricter in two ways:
 * the first character must be a letter or digit (so a slug can never read as
 * an option to `git`, and never names a dot-directory or `_retired`), and the
 * length is capped.
 */
export const STAGING_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const STAGING_SLUG_MAX = 100;

/**
 * Why `slug` is not a staging slug, or `undefined` when it is.
 *
 * The slug names `branches/<slug>/` in the publish branch: the directory that is
 * removed with `git rm -r`, the copy's destination and the commit that is
 * pushed. So it is checked by value and refused, never repaired: a repaired
 * value would silently name a different preview.
 */
export function stagingSlugProblem(slug: string | undefined): string | undefined {
  if (typeof slug !== "string" || slug.length === 0) return "it is empty";
  if (slug.length > STAGING_SLUG_MAX) return `it is longer than ${STAGING_SLUG_MAX} characters`;
  if (slug === "." || slug === "..") return "it names a directory, not a preview";
  if (!STAGING_SLUG.test(slug)) return `it must match ${STAGING_SLUG} (one path segment, starting with a letter or digit)`;
  return undefined;
}

/**
 * The file a request URL names inside `site`, or `undefined` when it names
 * nothing there.
 *
 * Two checks, both from cat-harness-tools' `safe-path`: `resolveWithin` keeps
 * the decoded path lexically inside the site, and `realPathWithin` keeps it
 * inside after links are followed. Either refusal is answered as a 404.
 */
export function resolveSitePath(site: string, url: string | undefined): string | undefined {
  let path = (url ?? "/").split("?")[0]!.split("#")[0]!;
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.endsWith("/")) path = `${path}index.html`;
  const lexical = resolveWithin(site, path);
  if (lexical === undefined) return undefined;
  return realPathWithin(site, lexical);
}

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

/** Serve `site` read-only on a free port of the loopback interface. */
export async function serveSite(site: string): Promise<{ server: Server; port: number }> {
  const server = createServer(async (req, res) => {
    const p = resolveSitePath(site, req.url);
    let body: Buffer;
    try {
      if (p === undefined) throw new Error("outside the site");
      body = await readFile(p); // read BEFORE the header goes out, so a miss can still answer 404
    } catch {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" }).end(body);
  });
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ok);
  });
  return { server, port: (server.address() as { port: number }).port };
}

async function main(): Promise<void> {
  const REPO_ROOT = resolve(import.meta.dir, "../..");
  const arg = (n: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const need = (n: string): string => {
    const v = arg(n);
    if (!v) {
      console.error(`stage-folio-local: --${n} is required`);
      process.exit(2);
    }
    return v;
  };
  const run = (cmd: string, args: string[], cwd: string) => {
    console.error(`$ ${cmd} ${args.join(" ")}`);
    execFileSync(cmd, args, { cwd, stdio: "inherit" });
  };

  const repo = resolve(need("repo"));
  const slug = need("slug");
  const slugProblem = stagingSlugProblem(slug);
  if (slugProblem) {
    console.error(`stage-folio-local: refusing --slug ${JSON.stringify(slug)}: ${slugProblem}.`);
    process.exit(2);
  }
  const site = resolve(repo, arg("site-dir") ?? "_site");
  const publishRepo = need("publish-repo");
  const sha = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { cwd: repo }).toString().trim();

  // 1. Build
  rmSync(site, { recursive: true, force: true });
  const build = arg("build");
  if (build) run("bash", ["-c", build], repo);
  else {
    // A measured Lean compile status (qou-lean-status/v1) is the folio's to supply; without it every Lean link reads "unchecked".
    const leanStatus = arg("lean-status");
    run("bun", ["run", join(REPO_ROOT, "folio-assistant-core/scripts/build-folio-site.ts"), "--out", site, ...(leanStatus ? ["--lean-status", resolve(leanStatus)] : [])], repo);
  }

  // 2. Rail
  run("bun", ["run", join(REPO_ROOT, "cat-harness-tools/scripts/rail-standalone-pages.ts"), "--site", site, "--built", "cat-harness", "--foreign-site", "--home-label", arg("home-label") ?? slug], REPO_ROOT);

  // 3. Banner
  run(
    "bun",
    [
      "run", join(REPO_ROOT, "cat-harness-tools/scripts/staging-banner.ts"),
      "--site", site, "--branch", slug, "--sha", sha, "--built", new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      "--pr", arg("pr") ?? "n/a", "--pr-url", need("pr-url"),
      "--branch-url", `https://github.com/${publishRepo}/tree/${arg("source-ref") ?? "main"}`,
      "--issues-url", `https://github.com/${publishRepo}/issues`, "--run-url", need("run-url"),
      "--main-site", arg("main-site") ?? `https://${publishRepo.split("/")[0]}.github.io/${publishRepo.split("/")[1]}`,
      "--before-ref", arg("before-ref") ?? "main",
    ],
    REPO_ROOT,
  );

  // 4. Chrome check, over a local server, on one representative page.
  const { server, port } = await serveSite(site);
  // declared-path-literal: the default page to CHECK is build-folio-site's published URL route
  // (the owner's `<base>/cat-harness/folio/`), under the built site — nothing is read from
  // cat-harness's declared folio/ graph. `--check-page` overrides it.
  const page = arg("check-page") ?? "cat-harness/folio/";
  let checks;
  try {
    checks = await checkChrome({ url: `http://127.0.0.1:${port}/${page.replace(/^\/+/, "")}`, assets: arg("assets"), katex: arg("katex") });
  } catch (e) {
    server.close();
    console.error(`? chrome check could not run (${(e as Error).message}); NOT publishing — a check that did not run is not a pass.`);
    process.exit(2);
  }
  server.close();
  for (const c of checks) console.error(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  if (!checks.every((c) => c.ok)) {
    console.error("✗ chrome check failed; NOT publishing.");
    process.exit(1);
  }
  console.error("Not run locally (said, not skipped): ChangeSet, folio QA sweep, before/after screenshots.");

  // 5. Deploy
  if (!process.argv.includes("--deploy")) {
    console.error(`built and checked in ${site}; pass --deploy to publish ${previewPath(slug)}/`);
    process.exit(0);
  }
  const branch = arg("publish-branch") ?? "gh-pages";
  const work = mkdtempSync(join(tmpdir(), "stage-"));
  try {
    // Partial, sparse: the publish branch can hold tens of thousands of files, none of which we need.
    run("git", ["clone", "-q", "--depth=1", "--filter=blob:none", "--no-checkout", "--single-branch", "-b", branch, `https://github.com/${publishRepo}`, work], repo);
    run("git", ["sparse-checkout", "set", "--no-cone", `/${previewPath(slug)}/`], work);
    run("git", ["checkout", "-q", branch], work);
    const dest = join(work, PREVIEW_PREFIX, slug);
    if (existsSync(dest)) run("git", ["rm", "-r", "-q", previewPath(slug)], work);
    cpSync(site, dest, { recursive: true });
    run("git", ["add", "-A", PREVIEW_PREFIX], work);
    run("git", ["-c", "gc.auto=0", "commit", "-q", "-m", `staging: ${slug} @ ${sha} (stage-folio-local)\n\n${arg("message") ?? ""}`.trim()], work);
    run("git", ["-c", "gc.auto=0", "push", "-q", "origin", branch], work);
    console.error(`✓ published ${previewPath(slug)}/ to ${publishRepo}@${branch}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
