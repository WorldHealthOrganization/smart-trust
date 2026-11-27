#!/usr/bin/env bun
/**
 * Publish bootstrap's files AS THEY SIT at its site address — every relative
 * link in them still resolves, because nothing moves.
 *
 * @module bootstrap-tools/scripts/publish-files
 *
 * bootstrap's own site serves only
 * what bootstrap-tools generates plus bootstrap's files; a `.md` is rendered
 * by Pages, not here, so this has no Markdown dependency. A harness that
 * hosts a copy of bootstrap on a site Pages does NOT render renders the
 * `.md` itself, after this, with its own renderer.
 *
 * NEVER OVERWRITES. A site build may already have written a file at the same
 * address (the graph's `.json` copy shares its name with `bootstrap.json`); the
 * file already there wins, and the one not published is reported in `skipped`
 * rather than dropped silently.
 *
 * Usage: bun run bootstrap-tools/scripts/publish-files.ts --root ./bootstrap --out ./_site/bootstrap
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** Every file under `dir`, dot-files and `node_modules` aside, sorted. */
export function filesIn(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesIn(p));
    else out.push(p);
  }
  return out;
}

/**
 * Copy every file of `root` into `outDir`, keeping its relative path —
 * or, with `keep`, only the files it keeps (a site rendered from a list of
 * subgraphs rather than the whole graph; `site.ts --subgraph`).
 */
export function publishFiles(root: string, outDir: string, keep?: (rel: string) => boolean): { written: string[]; skipped: string[] } {
  const written: string[] = [];
  const skipped: string[] = [];
  for (const file of filesIn(root)) {
    const rel = relative(root, file);
    if (keep && !keep(rel.split("\\").join("/"))) continue;
    const dest = join(outDir, rel);
    if (existsSync(dest)) {
      skipped.push(rel);
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(file, dest);
    written.push(rel);
  }
  return { written, skipped };
}

if (import.meta.main) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const root = arg("root");
  const out = arg("out");
  if (!root || !out) {
    console.error("usage: publish-files.ts --root <bootstrap> --out <dir>");
    process.exit(2);
  }
  const { written, skipped } = publishFiles(root, out);
  console.log(`Published ${written.length} file(s) from ${root} to ${out}.`);
  for (const rel of skipped) console.log(`  not published, already there: ${rel}`);
}
