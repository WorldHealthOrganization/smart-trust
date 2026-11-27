#!/usr/bin/env bun
/**
 * The bean work-plan board ("Plans and work") for ANY checkout, as a
 * standalone page in that checkout's own published site.
 *
 * ## Why this exists
 *
 * `gen-docs-pages.ts` + `state-visualizer.ts` draw the board for a platform
 * layer, as a themed page on that layer's Jekyll site. A folio (qou) keeps its
 * own bean store and publishes its own site, which is not a Jekyll site, so
 * neither generator reaches it. This draws the SAME board there:
 *
 * - the data is `lib/bean-index.ts`, the projection `gen-docs-pages.ts` uses,
 *   so the two boards cannot disagree about what the work plan holds;
 * - the renderer is the harness's own `kg-render.js` + `work-plan.js` +
 *   `work-plan.css`, inlined byte for byte (the same files the docs site
 *   serves), so there is one board, not a copy of one.
 *
 * Output, in `--out`:
 *
 * ```
 * index.html    the page: `<div data-fa-workplan data-fa-workplan-only="beans">`
 * index.json    folio-bean-index/v1, fetched by the page (relative URL)
 * ```
 *
 * The page carries no navbar of its own: a folio's publish rails every
 * standalone page (`rail-standalone-pages.ts --foreign-site`).
 *
 * It does NOT open from `file://` (the data is fetched); over any HTTP root it
 * works with no configuration, because the data path is relative.
 *
 * A checkout with no mounted bean store is an ERROR (exit 3), never an empty
 * board: "no store" and "a store with nothing in it" are opposite facts.
 *
 * Usage:
 *   bun run scripts/beans-board.ts --repo <checkout> --out <site>/beans \
 *     [--harness <cat-harness dir>] [--repo-web https://github.com/<o>/<r>] \
 *     [--title "<heading>"]
 *
 * @module scripts/beans-board
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { detectRepoUrl } from "../src/core/git-refs.js";
import { readBeans } from "./beans.js";
import { beanIndexOf } from "./lib/bean-index.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** One `--flag value` (or `--flag=value`) from argv. */
function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}`) return argv[i + 1];
    if (argv[i].startsWith(`--${name}=`)) return argv[i].slice(name.length + 3);
  }
  return undefined;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A script or stylesheet body, safe inside its element. */
function inlineSafe(body: string, tag: "script" | "style"): string {
  return body.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
}

/**
 * The type-scale tokens `work-plan.css` names, from the site chrome's own
 * stylesheet: the `:root { … }` block that declares `--fa-text-xs` (it holds
 * the font stacks too). Read, not restated, so the board here and on the docs
 * site use one scale. The stylesheet has many `:root` blocks; the first is the
 * navbar's, which is why this matches on the token rather than the position.
 */
function tokenBlock(harness: string): string {
  const css = readFileSync(join(harness, "site-chrome", "assets", "css", "docs-ui.css"), "utf8");
  const m = [...css.matchAll(/:root\s*\{[^}]*\}/g)].find((b) => b[0].includes("--fa-text-xs:"));
  if (!m) throw new Error("beans-board: site-chrome/assets/css/docs-ui.css carries no :root block declaring --fa-text-xs");
  return m[0];
}

/** The page. Everything it runs is inlined; only the data is fetched. */
export function boardPage(opts: { title: string; repoWeb: string; harness: string }): string {
  const asset = (p: string) => readFileSync(join(opts.harness, "docs", "assets", p), "utf8");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="fa-beans-src" content="index.json">
<style>
${inlineSafe(tokenBlock(opts.harness), "style")}
body { margin: 0; padding: 1rem 1.5rem 3rem; font-family: var(--fa-font-sans); background: Canvas; color: CanvasText; }
.bb-head h1 { font-size: var(--fa-text-xl); margin: 0.5rem 0 0.25rem; }
.bb-head p { font-size: var(--fa-text-sm); margin: 0 0 1rem; opacity: 0.8; }
</style>
<style>
${inlineSafe(asset("css/work-plan.css"), "style")}
</style>
</head>
<body>
<header class="bb-head">
<h1>${esc(opts.title)}</h1>
<p>The bean work plan of <a href="${esc(opts.repoWeb)}">${esc(opts.repoWeb.replace(/^https:\/\/github\.com\//, ""))}</a>.
Each bean links to its file on the branch that keeps the store.</p>
</header>
<div class="fa-workplan" data-fa-workplan data-fa-workplan-only="beans">
  <p class="fa-workplan-fallback">This view needs JavaScript. The data is
  <a href="index.json">a plain JSON file</a>.</p>
</div>
<script>
${inlineSafe(asset("js/kg-render.js"), "script")}
</script>
<script>
${inlineSafe(asset("js/work-plan.js"), "script")}
</script>
</body>
</html>
`;
}

function main(): void {
  const repo = resolve(arg("repo") ?? process.cwd());
  const out = arg("out");
  if (!out) {
    console.error("beans-board: --out <dir> is required");
    process.exit(2);
  }
  const harness = resolve(arg("harness") ?? HARNESS_ROOT);
  const repoWeb = arg("repo-web") ?? detectRepoUrl(repo);
  if (!repoWeb) {
    console.error(`beans-board: cannot tell ${repo}'s forge address; pass --repo-web`);
    process.exit(2);
  }
  const beans = readBeans(repo);
  if (beans === null) {
    console.error(`beans-board: ${repo} has no bean store (mount it with state-mount.ts first); no board written`);
    process.exit(3);
  }
  const index = beanIndexOf(beans, { repoRoot: repo, repoWeb });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.json"), JSON.stringify(index.document, null, 2) + "\n");
  writeFileSync(join(out, "index.html"), boardPage({ title: arg("title") ?? "Plans and work", repoWeb, harness }));
  const open = beans.filter((b) => b.status === "todo" || b.status === "in-progress" || b.status === "draft").length;
  console.log(
    `beans-board: ${beans.length} bean(s) (${open} open), ${index.edges.length} block edge(s) -> ${join(out, "index.html")}`,
  );
}

if (import.meta.main) main();
