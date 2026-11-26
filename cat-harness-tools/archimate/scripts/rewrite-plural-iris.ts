#!/usr/bin/env bun
/**
 * Rewrite links to an ArchiMate graph's old PLURAL paths to the singular
 * paths `gen-archimate-pages` writes.
 *
 * Since cat-harness-tools cf14a4e a node's IRI is `…/archimate/<v>/<m>/element/<id>`
 * (likewise `view/`, `relationship/`), and its data is that IRI plus
 * `.jsonld`. Content written before then still links
 * `…/archimate/<v>/<m>/elements/<id>.jsonld` and `…/views/…`, which no
 * build publishes any more, so every such link is a 404 (IRI scan,
 * 2026-11-18, finding 4).
 *
 * ## Why a rewrite, and not redirect stubs at the old paths
 *
 * The owner ruled the move a clean break, twice: Q-THIN-2 A ("nothing
 * forwards", issue #1830) and cat-harness-tools#1054 ("nothing redirects
 * from the old id paths"). A stub per element and per view at the plural
 * paths would undo that for every model of every layer, permanently. The
 * links are in a bounded set of content files, so they are fixed once, at
 * the source, and a `--check` keeps them fixed.
 *
 * ## What is rewritten
 *
 * Only the kind segment, and only under an `archimate/` path:
 * `archimate/…/elements/` → `archimate/…/element/` (also `views/`,
 * `relationships/`). Everything after it is kept, so a `.jsonld` link still
 * names the node's data and a page link (`…/elements/<slug>/`) its page.
 * Whitespace, a quote, a bracket or `<`/`>` ends a path, so text around the
 * link is never touched.
 *
 *   bun run cat archimate:rewrite-plural-iris [--check] [--json] <file-or-dir>…
 *
 * Without `--check` the files are rewritten in place. With it nothing is
 * written, and the run fails when any file would change, naming each one.
 * Directories are walked for text files (`.md`, `.html`, `.json`, `.jsonld`,
 * `.yml`, `.yaml`, `.archimate`, `.xml`, `.ts`, `.fsh`), skipping `.git` and
 * `node_modules`.
 *
 * @module cat-harness-tools/archimate/scripts/rewrite-plural-iris
 * @covers archimate
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

/** The file extensions a directory walk reads. */
export const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([".md", ".html", ".json", ".jsonld", ".yml", ".yaml", ".archimate", ".xml", ".ts", ".fsh"]);

const SKIP_DIRS: ReadonlySet<string> = new Set([".git", "node_modules"]);

/**
 * `archimate/`, then any path segments (no whitespace, quote, bracket or
 * angle bracket), then the plural kind segment. Group 1 is everything up to
 * the kind, group 2 the singular kind.
 */
const PLURAL = /(\barchimate\/(?:[^\s"'`()<>[\]{}/]+\/)*?)(element|view|relationship)s\//g;

/** `text` with every plural ArchiMate kind segment made singular, and how many were. */
export function rewritePluralIris(text: string): { text: string; count: number } {
  let count = 0;
  const out = text.replace(PLURAL, (_m, head: string, kind: string) => {
    count++;
    return `${head}${kind}/`;
  });
  return { text: out, count };
}

/** Every text file at or under `paths`, in a stable order. */
export function textFilesUnder(paths: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (p: string): void => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const name of readdirSync(p).sort()) {
        if (SKIP_DIRS.has(name)) continue;
        walk(join(p, name));
      }
    } else if (st.isFile() && TEXT_EXTENSIONS.has(extname(p))) {
      out.push(p);
    }
  };
  for (const p of paths) walk(p);
  return out;
}

/** One file the run changed, or would. */
export interface Rewritten {
  file: string;
  count: number;
}

/** Rewrite (or, with `check`, only find) every plural link in `paths`. */
export function rewriteFiles(paths: readonly string[], check: boolean): Rewritten[] {
  const changed: Rewritten[] = [];
  for (const file of textFilesUnder(paths)) {
    const before = readFileSync(file, "utf8");
    const { text, count } = rewritePluralIris(before);
    if (count === 0) continue;
    changed.push({ file, count });
    if (!check) writeFileSync(file, text);
  }
  return changed;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const asJson = args.includes("--json");
  const paths = args.filter((a) => !a.startsWith("--"));
  if (paths.length === 0) {
    console.error("usage: archimate:rewrite-plural-iris [--check] [--json] <file-or-dir>…");
    process.exit(2);
  }
  const changed = rewriteFiles(paths, check);
  const total = changed.reduce((n, c) => n + c.count, 0);
  if (asJson) {
    console.log(JSON.stringify({ check, files: changed, links: total }, null, 2));
  } else {
    for (const c of changed) console.log(`${check ? "✗" : "✓"} ${c.file}: ${c.count} plural ArchiMate link(s)${check ? "" : " rewritten"}`);
    console.log(`${changed.length} file(s), ${total} link(s)${check ? " to rewrite" : " rewritten"}`);
  }
  if (check && changed.length > 0) process.exit(1);
}
