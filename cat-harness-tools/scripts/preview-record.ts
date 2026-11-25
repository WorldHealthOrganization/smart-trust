#!/usr/bin/env bun
/**
 * preview-record — what a preview build produced, written so a second build of
 * the same tree can be checked against it, file for file.
 *
 * @module scripts/preview-record
 * @covers none — a PUBLISHER step: it hashes one built site and compares two
 * hashings; it judges no graph and no content
 *
 * ```sh
 * bun run cat-harness-tools/scripts/preview-record.ts write   --site _site --repo . --slug <slug> --builder agent|ci [--base <sha>] [--run <url>]
 * bun run cat-harness-tools/scripts/preview-record.ts match   --record <file> --repo . [--tree <sha>]
 * bun run cat-harness-tools/scripts/preview-record.ts compare --claimed <file> --rebuilt <file> [--slug <slug>] [--run <url>] [--out <file>]
 * ```
 *
 * ## Why (owner, 2026-11-01, Q-SPD-9 B and Q-SPD-9b A; folio-assistant#2881)
 *
 * An agent's session has the checkout and the tools in hand, so it can build
 * a preview itself and put it live at once, instead of waiting 25 to 50
 * minutes for a runner. The owner chose that for PREVIEWS ONLY (main and
 * release stay CI-built), checked by a FULL rebuild in CI afterwards, off the
 * critical path, rather than by a random sample: *"why random sample? what is
 * the intent?"*. A full rebuild is a complete check, with nothing left to
 * chance.
 *
 * ## What a record holds
 *
 * - `tree`: the git TREE the site was built from (`HEAD^{tree}`). A preview is
 *   the branch merged into its base, and a clean merge of the same two commits
 *   gives the same tree, so this is the one exact identity of "the same
 *   input". The head and base commits are kept beside it to rebuild from.
 * - `lock`: the sha256 of `index.lock.json`, so a re-pin is a different input
 *   even when someone hand-edits around it. (The tree already covers it; the
 *   field makes a mismatch readable.)
 * - `files`: every file of the built site, path to sha256, before
 *   `staging-share` prunes it. HTML is hashed after the per-preview edits
 *   are set aside ({@link normalisePreviewHtml}), so the record says the same
 *   thing whoever built it.
 * - `digest`: one sha256 over the sorted `path NUL hash` lines.
 *
 * ## What is never compared, and why it is a fixed list
 *
 * {@link BUILD_FACTS}: the files that describe a BUILD rather than its
 * output (when, by whom, from which run). They differ between any two builds
 * by design. The list lives here, in code a reviewer reads, and not in the
 * record, so a builder cannot widen it for itself.
 *
 * Any other difference counts. When a writer turns out to stamp a time or a
 * run into its output, the fix is to make that writer reproducible, not to
 * add its file here: a file left out of the check is a file an agent build
 * could get wrong unseen.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { normalisePreviewHtml } from "./staging-share.ts";
import { previewPath } from "./lib/preview-prefix.ts";
import { SITE_REPORT as PREVIEW_QA_REPORT, stripSection as stripPreviewQa } from "./preview-qa.ts";

/** The record's own file name, at the preview root. */
export const RECORD_FILE = "_build-record.json";

/**
 * Files that describe the build, not what it built. Each differs between two
 * builds of the same tree by design:
 *
 * - the record itself;
 * - `staging.json` and `build.json`: the build's time, run and builder;
 * - `shared.json` and `staging-sw.js`: written by `staging-share` against the
 *   live site at push time, which moves between the two builds;
 * - `preview-qa.json`: the change's cone run (`preview-qa.ts`), which two
 *   builds of the same tree can find at different stages (not yet run, run);
 * - `_render-log/`: the publish branch's log, never part of a site.
 */
export const BUILD_FACTS: readonly string[] = [RECORD_FILE, "staging.json", "build.json", "shared.json", "staging-sw.js", PREVIEW_QA_REPORT];
const BUILD_FACT_DIRS: readonly string[] = ["_render-log/"];

export type Builder = "agent" | "ci";

export interface PreviewRecord {
  version: 1;
  kind: "preview-build-record";
  builder: Builder;
  builtAt: string;
  slug: string;
  /** The commit whose tree was built (a merge commit when the base was merged in). */
  commit: string;
  /** `HEAD^{tree}` of that commit: the identity of the input. */
  tree: string;
  /** The branch head and the base it was merged with, to rebuild from. */
  head?: string;
  base?: string;
  /** sha256 of index.lock.json, or "none". */
  lock: string;
  run?: string;
  files: Record<string, string>;
  digest: string;
}

/** Whether `rel` is a build fact, never compared. */
export function isBuildFact(rel: string): boolean {
  return BUILD_FACTS.includes(rel) || BUILD_FACT_DIRS.some((d) => rel.startsWith(d));
}

function sha256(b: Buffer | string): string {
  return createHash("sha256").update(b).digest("hex");
}

/**
 * The hash a record keeps for one file: HTML with the per-preview edits set
 * aside, anything else byte for byte. The "This change (preview)" section is
 * set aside here only, never in `staging-share.ts`: a QA page that differs
 * from the live one only by it must still be served from the preview.
 */
export function fileHash(rel: string, bytes: Buffer, slug: string): string {
  if (rel.endsWith(".html")) return sha256(normalisePreviewHtml(stripPreviewQa(bytes.toString("utf-8")), slug));
  return sha256(bytes);
}

function filesUnder(dir: string, root: string = dir, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) filesUnder(p, root, out);
    else if (e.isFile()) out.push(relative(root, p).split("\\").join("/"));
  }
  return out;
}

/** Path → hash for every compared file of a built site. */
export function hashSite(site: string, slug: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const rel of filesUnder(site).sort()) {
    if (isBuildFact(rel)) continue;
    files[rel] = fileHash(rel, readFileSync(join(site, rel)), slug);
  }
  return files;
}

/** One sha256 over the sorted `path NUL hash` lines. */
export function digestOf(files: Record<string, string>): string {
  const lines = Object.keys(files).sort().map((p) => `${p}\0${files[p]}\n`);
  return sha256(lines.join(""));
}

function git(repo: string, args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf-8" }).trim();
}

/** The sha256 of a repository's `index.lock.json`, or "none". */
export function lockOf(repo: string): string {
  const p = join(repo, "index.lock.json");
  return existsSync(p) ? sha256(readFileSync(p)) : "none";
}

export interface WriteOptions {
  site: string;
  repo: string;
  slug: string;
  builder: Builder;
  head?: string;
  base?: string;
  run?: string;
  now?: Date;
}

/** Hash a built site into a record. Writes nothing. */
export function makeRecord(o: WriteOptions): PreviewRecord {
  if (!existsSync(o.site) || !statSync(o.site).isDirectory()) throw new Error(`${o.site}: no built site`);
  const files = hashSite(o.site, o.slug);
  if (Object.keys(files).length === 0) throw new Error(`${o.site}: the build produced no files, so there is nothing to record`);
  const commit = git(o.repo, ["rev-parse", "HEAD"]);
  return {
    version: 1,
    kind: "preview-build-record",
    builder: o.builder,
    builtAt: (o.now ?? new Date()).toISOString().replace(/\.\d+Z$/, "Z"),
    slug: o.slug,
    commit,
    tree: git(o.repo, ["rev-parse", "HEAD^{tree}"]),
    ...(o.head ? { head: o.head } : {}),
    ...(o.base ? { base: o.base } : {}),
    lock: lockOf(o.repo),
    ...(o.run ? { run: o.run } : {}),
    files,
    digest: digestOf(files),
  };
}

/** Read a record, refusing anything that is not one (a record is read off the publish branch, which anyone with push can write). */
export function readRecord(path: string): PreviewRecord {
  const r = JSON.parse(readFileSync(path, "utf-8")) as Partial<PreviewRecord>;
  if (r.version !== 1 || r.kind !== "preview-build-record") throw new Error(`${path}: not a preview build record`);
  if (typeof r.tree !== "string" || !/^[0-9a-f]{40,64}$/.test(r.tree)) throw new Error(`${path}: no tree`);
  if (!r.files || typeof r.files !== "object") throw new Error(`${path}: no files`);
  if (r.digest !== digestOf(r.files)) throw new Error(`${path}: the digest does not match its own files`);
  return r as PreviewRecord;
}

export interface Comparison {
  same: boolean;
  /** In both, with different hashes. */
  changed: string[];
  /** In the claimed build only. */
  onlyClaimed: string[];
  /** In the rebuild only. */
  onlyRebuilt: string[];
  /** Why the two cannot be compared at all, when they cannot. */
  incomparable?: string;
}

/** Compare a claimed build (the agent's) with a full rebuild of the same tree. */
export function compareRecords(claimed: PreviewRecord, rebuilt: PreviewRecord): Comparison {
  if (claimed.tree !== rebuilt.tree) {
    return { same: false, changed: [], onlyClaimed: [], onlyRebuilt: [], incomparable: `built from different trees (${claimed.tree.slice(0, 12)} vs ${rebuilt.tree.slice(0, 12)})` };
  }
  const changed: string[] = [], onlyClaimed: string[] = [], onlyRebuilt: string[] = [];
  for (const [p, h] of Object.entries(claimed.files)) {
    const r = rebuilt.files[p];
    if (r === undefined) onlyClaimed.push(p);
    else if (r !== h) changed.push(p);
  }
  for (const p of Object.keys(rebuilt.files)) if (!(p in claimed.files)) onlyRebuilt.push(p);
  const same = changed.length === 0 && onlyClaimed.length === 0 && onlyRebuilt.length === 0;
  return { same, changed: changed.sort(), onlyClaimed: onlyClaimed.sort(), onlyRebuilt: onlyRebuilt.sort() };
}

/** The PR comment for a comparison: short, with the first paths of each kind. */
export function comparisonText(c: Comparison, o: { slug: string; run?: string; limit?: number }): string {
  const limit = o.limit ?? 20;
  const head = "<!-- preview-build-verify -->\n";
  const run = o.run ? `\n\nCI run: ${o.run}` : "";
  if (c.incomparable) return `${head}**Agent-built preview was stale:** ${c.incomparable}, so the base or the branch moved after the agent built it. CI's build of the current tree replaced \`${previewPath(o.slug)}/\`. The agent build was not judged.${run}\n`;
  if (c.same) return `${head}**Agent-built preview verified.** A full CI rebuild of the same tree produced the same files. \`${previewPath(o.slug)}/\` stays as the agent built it.${run}\n`;
  const list = (title: string, ps: string[]) => (ps.length === 0 ? "" : `\n\n${title} (${ps.length}):\n${ps.slice(0, limit).map((p) => `- \`${p}\``).join("\n")}${ps.length > limit ? `\n- … and ${ps.length - limit} more` : ""}`);
  return `${head}**Agent-built preview differed from CI's rebuild, so CI's build replaced it.** \`${previewPath(o.slug)}/\` now shows the CI build.`
    + list("Changed", c.changed) + list("Only in the agent build", c.onlyClaimed) + list("Only in the CI build", c.onlyRebuilt)
    + `\n\nA difference in a file that should not change between builds (a time, a run link) means its writer is not reproducible yet: fix the writer, not this check.${run}\n`;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function need(name: string): string {
  const v = flag(name);
  if (!v) {
    console.error(`preview-record: --${name} is required`);
    process.exit(2);
  }
  return v;
}

if (import.meta.main) {
  const cmd = process.argv[2];
  try {
    if (cmd === "write") {
      const builder = need("builder");
      if (builder !== "agent" && builder !== "ci") throw new Error(`--builder is agent or ci, not '${builder}'`);
      // declared-path-literal: "site" is the name of a command-line flag (--site), not a path.
      const site = resolve(need("site"));
      const r = makeRecord({
        site, repo: resolve(flag("repo") ?? "."), slug: need("slug"), builder,
        ...(flag("head") ? { head: flag("head")! } : {}),
        ...(flag("base") ? { base: flag("base")! } : {}),
        ...(flag("run") ? { run: flag("run")! } : {}),
      });
      const out = flag("out") ?? join(site, RECORD_FILE);
      writeFileSync(out, JSON.stringify(r, null, 1) + "\n");
      console.log(`preview-record: ${Object.keys(r.files).length} file(s), tree ${r.tree.slice(0, 12)}, digest ${r.digest.slice(0, 12)} → ${out}`);
    } else if (cmd === "match") {
      // Exit 0 when the record was built from this checkout's tree, 1 when not.
      const r = readRecord(need("record"));
      const tree = flag("tree") ?? git(resolve(flag("repo") ?? "."), ["rev-parse", "HEAD^{tree}"]);
      const ok = r.tree === tree;
      console.log(`preview-record: ${r.builder} record, tree ${r.tree.slice(0, 12)}; this tree ${tree.slice(0, 12)}: ${ok ? "match" : "no match"}`);
      process.exit(ok ? 0 : 1);
    } else if (cmd === "compare") {
      // Exit 0 when the two builds produced the same files, 1 when not, 3 when
      // they were built from different trees and so cannot be compared (the
      // base moved, or a newer push): not a wrong build, a stale one.
      const c = compareRecords(readRecord(need("claimed")), readRecord(need("rebuilt")));
      const text = comparisonText(c, { slug: flag("slug") ?? "?", ...(flag("run") ? { run: flag("run")! } : {}) });
      if (flag("out")) writeFileSync(flag("out")!, text);
      console.log(c.same ? "preview-record: same files" : `preview-record: ${c.incomparable ?? `${c.changed.length} changed, ${c.onlyClaimed.length} only in the claimed build, ${c.onlyRebuilt.length} only in the rebuild`}`);
      process.exit(c.same ? 0 : c.incomparable ? 3 : 1);
    } else {
      console.error("usage: preview-record.ts write|match|compare (see the module header)");
      process.exit(2);
    }
  } catch (e) {
    console.error(`✗ preview-record: ${(e as Error).message}`);
    process.exit(2);
  }
}
