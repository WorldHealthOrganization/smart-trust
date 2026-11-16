#!/usr/bin/env bun
/**
 * cat-harness holds no code: every source file under it is a ratcheted debt.
 *
 * @module cat-harness-tools/scripts/check-content-code-free
 * @covers code — every tracked file under the cat-harness layer, read by extension only
 *
 * The harness is content: its manifests, Tool definitions and skill records
 * are JSON data that the tools validate on read, and code lives in
 * cat-harness-tools. So no tracked `.ts/.js/.py/.sh` belongs under
 * `cat-harness/`.
 *
 * The gate is a ratchet. The committed list
 * (`content-code-free-baseline.json`) names every code file still allowed. A
 * code file NOT on the list is red: new code in content. A listed file that
 * is gone is reported with the command that shortens the list, and is not
 * red, so a move landing elsewhere never turns an unrelated PR red. The list
 * only ever shrinks.
 *
 * Code is decided by extension: `.ts .tsx .mts .cts .js .mjs .cjs .py .sh .rb`
 * (`.rb` is how Jekyll plugins are written). Git decides what is tracked.
 *
 * Exempt by rule:
 *
 * - browser assets: a `.js`/`.mjs` under `site-chrome/assets/`,
 *   `site-chrome/_includes/` or `docs/assets/` is a file the site ships to
 *   the browser, next to the include that loads it;
 * - two build helpers: the folio file-list renderer (`folio-render/`) and the
 *   Jekyll plugins (`_plugins/*.rb`), part of the same chrome layout;
 * - anything under a path the harness declares `builtAtPublish`: written by a
 *   writer at publish, never tracked. In a mounted checkout there is no git
 *   index to say so, so the corpus is a walk, and a publish-built page's
 *   script (`docs/en/cat-harness/processes/task-panel.js`, `processes:viz`)
 *   read as code in content (folio-assistant#2985).
 *
 * Usage: bun run cat check:content-code-free [--update] [--no-baseline]
 * Exit:  0 when every code file is listed · 1 otherwise
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";
import { readDeclaration } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

export const BASELINE_PATH = resolve(TOOLS_ROOT, "scripts", "content-code-free-baseline.json");

/** File extensions that count as code. */
export const CODE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".py", ".sh", ".rb"] as const;

/** Directories whose `.js`/`.mjs` files are shipped browser assets, not code. */
// declared-path-literal: a classifier over repo-relative paths from any layer, not a read; no one declaration answers it
export const BROWSER_ASSET_DIRS = ["site-chrome/assets/", "site-chrome/_includes/", "docs/assets/"] as const;

export const isBrowserAsset = (rel: string): boolean =>
  /\.m?js$/.test(rel) && (BROWSER_ASSET_DIRS.some((d) => rel.startsWith(d)) || BUILT_PAGE_ASSET.test(rel));

/**
 * A page built at publish under `docs/<lang>/` ships its script beside it in an
 * `assets/` folder (the OpenAPI viewer's `openapi.js`, folio-assistant#2741).
 * It is a browser asset by the same rule as above, and it is never tracked.
 */
export const BUILT_PAGE_ASSET = /^docs\/[a-z]{2}(?:-[A-Za-z]+)?\/(?:[^/]+\/)*assets\/[^/]+\.m?js$/;

/** The folio file-list renderer and the Jekyll plugins, kept by owner card (2026-10-30, option A). */
// declared-path-literal: a classifier over repo-relative paths, as BROWSER_ASSET_DIRS above
export const isBuildHelper = (rel: string): boolean =>
  rel.startsWith("folio-render/") || /(^|\/)_plugins\/[^/]+\.rb$/.test(rel);

export const isCode = (rel: string): boolean =>
  CODE_EXTENSIONS.some((e) => rel.endsWith(e)) && !isBrowserAsset(rel) && !isBuildHelper(rel);

/** The root-relative paths `root`'s declaration says are built at publish (`builtAtPublish`); a `/`-ended one is a directory. */
export function builtAtPublishPaths(root: string): string[] {
  const decl = readDeclaration(root) as { builtAtPublish?: Array<{ path?: unknown }> } | undefined;
  return (decl?.builtAtPublish ?? []).map((b) => b.path).filter((p): p is string => typeof p === "string" && p !== "");
}

/** Pure: whether `rel` lies under one of `built` (a `/`-ended entry is a directory, else one file). */
export const isBuiltAtPublish = (rel: string, built: readonly string[]): boolean =>
  built.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p));

/** Every tracked code file under `root`, as root-relative POSIX paths, sorted. */
export function codeFiles(root: string, built: readonly string[] = builtAtPublishPaths(root)): string[] {
  return gitFiles(root, (rel) => isCode(rel) && !isBuiltAtPublish(rel, built))
    .files.map((abs) => relative(root, abs).split("\\").join("/"))
    .sort();
}

export interface Judgement {
  /** Code files not on the list: red. */
  added: string[];
  /** Listed files that are gone: the list can shrink. */
  gone: string[];
}

/** Pure: the current code files against the allowed list. One way: only an addition is red. */
export function judge(current: readonly string[], allowed: readonly string[]): Judgement {
  const a = new Set(allowed);
  const c = new Set(current);
  return {
    added: current.filter((f) => !a.has(f)),
    gone: allowed.filter((f) => !c.has(f)),
  };
}

const COMMENT =
  "Code files still allowed under cat-harness/ (bean `y9r6`, FR-7: content holds no code). A RATCHET, one way: a code file not listed is red; a listed file that is gone is reported with `bun run cat content-code-free:baseline`, which shortens the list. WRITTEN by that command; a longer list is a diff somebody reviews. Most entries are `schemas/`, which bean `8lcl` moves. See the module header of cat-harness-tools/scripts/check-content-code-free.ts.";

export function readBaseline(path = BASELINE_PATH): string[] {
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, "utf-8")) as { files?: string[] }).files ?? [];
}

if (import.meta.main) {
  const current = codeFiles(HARNESS_ROOT);
  if (process.argv.includes("--update")) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ _comment: COMMENT, files: current }, null, 2)}\n`);
    console.log(`content-code-free: wrote ${current.length} file(s) to ${relative(TOOLS_ROOT, BASELINE_PATH)}`);
    process.exit(0);
  }
  const allowed = process.argv.includes("--no-baseline") ? [] : readBaseline();
  const j = judge(current, allowed);
  console.log(`content-code-free: ${current.length} code file(s) under ${HARNESS_ROOT}; ${allowed.length} allowed by the list.`);
  if (j.gone.length) {
    console.log(`  ${j.gone.length} listed file(s) are gone — \`bun run cat content-code-free:baseline\` shortens the list (not a failure).`);
  }
  if (j.added.length) {
    console.log(`✗ ${j.added.length} code file(s) under cat-harness/ that the list does not allow. Content holds no code: make it JSON data, or move it to cat-harness-tools.`);
    for (const f of j.added.slice(0, 50)) console.log(`  · ${f}`);
    if (j.added.length > 50) console.log(`  … and ${j.added.length - 50} more`);
    process.exit(1);
  }
  console.log("✓ no code file under cat-harness/ beyond the list.");
}
