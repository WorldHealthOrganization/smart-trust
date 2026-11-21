#!/usr/bin/env bun
/**
 * Print the repository-relative directories holding each named graph typology.
 *
 * @module scripts/declared-dirs
 *
 * `render-pipeline.ts` spawns this rather than calling `readDeclaration`
 * itself, because reading the declaration validates EVERY kind in it,
 * including `folio`, whose kind only core registers (on importing
 * `schemas/kg/folio-graph-typology.ts`).
 *
 * Output is one line, which the pipeline parses. **A failure prints nothing to
 * stdout and exits non-zero**, so a caller cannot mistake "could not resolve"
 * for "declares nothing".
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/declared-dirs.ts schemas cat-harness tools
 */
import { relative, sep } from "node:path";

import { directoriesForGraph, repoRootFor } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

if (import.meta.main) {
  const kinds = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  if (kinds.length === 0) {
    console.error("usage: declared-dirs.ts <graph-typology>...");
    process.exit(2);
  }
  const instance = HARNESS_ROOT;
  const repo = repoRootFor(instance);
  const out: Record<string, string[]> = {};
  for (const k of kinds) {
    out[k] = directoriesForGraph(instance, k).map((d) => relative(repo, d).split(sep).join("/")).sort();
  }
  console.log(JSON.stringify(out));
}
