/**
 * Publish the identifier lookup into a BUILT site: the client page and every
 * declared layer's index, under `<site>/id-lookup/`.
 *
 * The lookup client is JavaScript that never sits under the plain docs
 * pipeline, so it is not in the Jekyll source: it is copied into the built
 * tree after Jekyll, the way the KG viewer is emitted, and the site's search
 * box links to it.
 *
 * Layout, which is what `search-split.ts` detects to name each index as a
 * `remote` scope in the search manifest:
 *
 *   <site>/id-lookup/index.html, lookup.js        the client (`?index=<source>/`)
 *   <site>/id-lookup/<source>/manifest.json, ...  one directory per layer
 *
 * Each index is copied byte for byte from the layer's own declared
 * `id-lookup` directory — `gen-id-lookup.ts` writes it and `id-lookup:check`
 * gates it — minus that directory's generated README, which is a repository
 * file and not part of the index.
 *
 * Usage: bun run cat-harness-tools/scripts/publish-id-lookup.ts --site <built site>
 *
 * @module cat-harness-tools/scripts/publish-id-lookup
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { indexedSources, outDirFor } from "./gen-id-lookup.ts";

const TOOLS = resolve(import.meta.dir, "..");
/** The client, as `cat-harness-tools-id-lookup` declares it. */
const CLIENT_DIR = join(TOOLS, "id-lookup");
const CLIENT_FILES = ["index.html", "lookup.js"] as const;
/** Where the lookup lives under the built site. `search-split.ts` reads the same path. */
export const SITE_DIR = "id-lookup";

/** Copy one index directory, skipping its repository README. */
function copyIndex(from: string, to: string): number {
  let files = 0;
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name === "README.md") continue;
    const src = join(from, name);
    if (statSync(src).isDirectory()) files += copyIndex(src, join(to, name));
    else {
      cpSync(src, join(to, name));
      files++;
    }
  }
  return files;
}

/** Publish into `site`; returns what was written, per source. */
export function publish(site: string, sources: readonly string[] = indexedSources()): { source: string; files: number }[] {
  const dest = join(site, SITE_DIR);
  mkdirSync(dest, { recursive: true });
  for (const f of CLIENT_FILES) cpSync(join(CLIENT_DIR, f), join(dest, f));
  const out: { source: string; files: number }[] = [];
  for (const source of sources) {
    const from = outDirFor(source);
    if (!existsSync(join(from, "manifest.json"))) {
      // A declared directory with no generated index is not something to
      // publish a link to: the page would say "could not be read".
      throw new Error(`${source}: ${from} holds no manifest.json — run \`bun run cat id-lookup\``);
    }
    out.push({ source, files: copyIndex(from, join(dest, source)) });
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--site");
  if (at < 0 || !args[at + 1]) {
    console.error("usage: publish-id-lookup.ts --site <built site>");
    process.exit(2);
  }
  const site = resolve(args[at + 1]!);
  const done = publish(site);
  for (const d of done) console.log(`  ${SITE_DIR}/${d.source}/  ${d.files} file(s)`);
  console.log(`identifier lookup → ${SITE_DIR}/ (client + ${done.length} index(es))`);
}
