#!/usr/bin/env bun
/**
 * No library section carries a soft hyphen (U+00AD).
 *
 * @covers library
 *
 * A soft hyphen kept from a PDF text layer splits one word into two fragments
 * for search and indexing. Ingestion joins them (`scripts/_pdf_text.py`); this
 * gate says none came back.
 *
 * Not scanned: `vector-labels.json`, where a soft hyphen ends a POSITIONED
 * label and joining needs the figure's geometry.
 *
 *   bun run cat check:soft-hyphens
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { declaredGraphs, layerRootsIn } from "../schemas/kg/cat-harness.ts";
import { libraryEntryDirs } from "./lib/library-entry-graphs.ts";

const REPO = resolve(import.meta.dir, "../..");

export function sectionsWithSoftHyphens(): Array<{ file: string; count: number }> {
  const seen = new Set<string>();
  const out: Array<{ file: string; count: number }> = [];
  for (const root of layerRootsIn(REPO)) {
    for (const g of declaredGraphs(root)) {
      if (!g.absPath || !g.graphTypologies.includes("library") || seen.has(g.absPath) || !existsSync(g.absPath)) continue;
      seen.add(g.absPath);
      // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`).
      for (const doc of libraryEntryDirs(g.absPath)) {
        const sec = join(doc.dir, "sections");
        if (!existsSync(sec)) continue;
        for (const f of readdirSync(sec)) {
          if (!f.endsWith(".md")) continue;
          const p = join(sec, f);
          const count = (readFileSync(p, "utf8").match(/­/g) ?? []).length;
          if (count) out.push({ file: relative(REPO, p), count });
        }
      }
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

if (import.meta.main) {
  const hits = sectionsWithSoftHyphens();
  if (hits.length === 0) {
    console.log("✓ no library section carries a soft hyphen (U+00AD)");
    process.exit(0);
  }
  const total = hits.reduce((n, h) => n + h.count, 0);
  for (const h of hits.slice(0, 20)) console.log(`  ✗ ${h.file}  ${h.count}`);
  if (hits.length > 20) console.log(`  … and ${hits.length - 20} more`);
  console.log(
    `\n${total} soft hyphen(s) in ${hits.length} section(s). Re-ingest with the current rungs (they join them), ` +
      "or apply scripts/_pdf_text.py's join_soft_hyphens to the section text and update structure.json's n_chars/n_words.",
  );
  process.exit(1);
}
