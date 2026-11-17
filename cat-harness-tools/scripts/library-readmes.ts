#!/usr/bin/env bun
/**
 * A README for every library item, generated from the item's own manifest.
 *
 * @module scripts/library-readmes
 * @covers cat-harness
 *
 * Writes `<library>/<slug>/README.md` the way
 * `bootstrap-tools/scripts/subgraph-readmes.ts` writes a directory's:
 *
 * - only between the `kg:subgraph` markers, through the SAME `splice`, so a
 *   README somebody wrote without them is left alone and reported;
 * - every value read from the item (`manifest.jsonld`) or counted on disk,
 *   never composed; the layout is a Liquid template beside this script.
 *
 * The library's own subgraph README links each item's row to its README
 * (`subdirs.readme` in `subgraph.liquid`).
 *
 * Libraries are found through the declaration (`directoriesForGraph(root,
 * "library")`), every declared one, as the library viewer finds them — never
 * by path.
 *
 * Usage: `bun run cat library:readmes` · `bun run cat library:readmes:check`
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { Liquid } from "liquidjs";

import { splice } from "@litlfred/bootstrap-tools/scripts/subgraph-readmes.ts";
import { checkoutRootFor, directoriesForGraph, layerRootsIn, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.ts";
import { gateOwnInstances, nothingOwnLine } from "./lib/gate-own.ts";
import { libraryEntryDirs } from "./lib/library-entry-graphs.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const REPO = layerRootsIn(repoRootFor(ROOT)).length ? repoRootFor(ROOT) : checkoutRootFor(ROOT);
const TEMPLATES = join(import.meta.dir, "templates", "readme");

/** What one item's README says, all of it read from the item. */
export interface ItemFacts {
  slug: string;
  title: string;
  disposition: string;
  provenance: string;
  docId: string;
  sourceFile: string;
  sha256: string;
  pages: string;
  arxiv: string;
  doi: string;
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/**
 * The arXiv identifier with its version (`2504.21474v1`), from the manifest's
 * `{ id, version }` record — the form arXiv itself cites. A bare string is
 * taken as given; anything else is "not recorded".
 */
export function arxivId(v: unknown): string {
  if (typeof v === "string") return v;
  if (v !== null && typeof v === "object" && "id" in v) {
    const { id, version } = v as { id: unknown; version?: unknown };
    return `${str(id)}${version ? `v${str(version)}` : ""}`;
  }
  return "";
}

/** An item's facts from its manifest, or `undefined` when it has none. */
export function itemFacts(dir: string): ItemFacts | undefined {
  const path = join(dir, "manifest.jsonld");
  if (!existsSync(path)) return undefined;
  const m = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  const meta = (m.meta ?? {}) as Record<string, unknown>;
  return {
    slug: basename(dir),
    title: str(m.title),
    disposition: str(meta.disposition),
    provenance: str(m.provenance),
    docId: str(meta.doc_id) || basename(dir),
    sourceFile: str(meta.source_file),
    sha256: str(meta.source_sha256).slice(0, 12),
    pages: str(meta.pages),
    arxiv: arxivId(meta.arxiv),
    doi: str(meta.doi),
  };
}

/** Files directly under `dir/sub` (0 when it is absent). */
function countIn(dir: string, sub: string): number {
  const d = join(dir, sub);
  return existsSync(d) && statSync(d).isDirectory() ? readdirSync(d).length : 0;
}

/** Every item README this checkout owes: path → full file contents. */
export async function plan(repo = REPO, own?: ReadonlySet<string>): Promise<{ writes: Map<string, string>; unmarked: string[] }> {
  const liquid = new Liquid({ root: [TEMPLATES], extname: ".liquid", jekyllInclude: true, strictFilters: true });
  const writes = new Map<string, string>();
  const unmarked: string[] = [];
  const seen = new Set<string>();
  for (const instance of layerRootsIn(repo)) {
    const name = readDeclaration(instance)?.name ?? basename(instance);
    if (own && !own.has(name)) continue;
    for (const lib of directoriesForGraph(instance, "library")) {
      if (seen.has(lib) || !existsSync(lib)) continue;
      seen.add(lib);
      // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`):
      // a filed entry is one level deeper, so its link up to the library is too.
      for (const { dir, rel } of libraryEntryDirs(lib)) {
        const up = "../".repeat(rel.split("/").length);
        const item = itemFacts(dir);
        if (item === undefined) continue;
        const libId = repo === instance ? join(readDeclaration(instance)?.name ?? "", relative(repo, lib)) : relative(repo, lib);
        const region = await liquid.renderFile("library-item", {
          item,
          counts: { sections: countIn(dir, "sections"), blocks: countIn(dir, "blocks"), images: countIn(dir, "images") },
          library: { id: libId, readme: existsSync(join(lib, "README.md")) ? `${up}README.md` : up },
        });
        const out = join(dir, "README.md");
        const existing = existsSync(out) ? readFileSync(out, "utf-8") : undefined;
        const next = splice(existing, region);
        if (next === undefined) unmarked.push(relative(repo, out));
        else writes.set(out, next);
      }
    }
  }
  return { writes, unmarked };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const own = check ? gateOwnInstances() : undefined;
  const { writes, unmarked } = await plan(REPO, own);
  if (own && writes.size === 0 && unmarked.length === 0) {
    console.log(nothingOwnLine("library:readmes", "library item README", own));
    process.exit(0);
  }
  const stale = [...writes].filter(([p, body]) => !existsSync(p) || readFileSync(p, "utf-8") !== body).map(([p]) => p);
  for (const u of unmarked) console.log(`  · ${u} has no kg:subgraph markers — left alone`);
  if (check) {
    for (const p of stale) console.log(`  ✗ ${relative(REPO, p)} is stale`);
    console.log(`${writes.size} library item README(s); ${stale.length} stale.`);
    if (stale.length) {
      console.log("Run `bun run cat library:readmes` and commit.");
      process.exit(1);
    }
  } else {
    for (const p of stale) writeFileSync(p, writes.get(p)!);
    console.log(`${writes.size} library item README(s); wrote ${stale.length}.`);
  }
}
