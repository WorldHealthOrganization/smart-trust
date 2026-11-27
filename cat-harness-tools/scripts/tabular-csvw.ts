#!/usr/bin/env bun
/**
 * The tabular ingest rung for delimited text and workbooks: a source read as
 * `folio-tabular-csvw/v1` by whichever layer fills the `tabular-csvw` pipeline
 * slot, written to `<library>/<slug>/tabular.csvw.json`.
 *
 * ```sh
 * bun run cat-harness-tools/scripts/tabular-csvw.ts -o <library> <file>
 * ```
 *
 * The CSVW extractors live in core, which tools may not name
 * (`check:reference-direction`), so this reaches them through the slot. When
 * nothing fills the slot this refuses with the slot's own error, which names
 * what is missing. It never falls back to `tabular-records.py`, which keeps
 * only what core has no reader for: ODS, and fixed-width text through
 * `codata-ingest`.
 *
 * The record carries the entry's `source` (the `_tech_meta` block every rung
 * writes) and its `narrative`, empty until a person authors it: what
 * `check-l1-complete`, `check-library-qa` and `narratives` read.
 *
 * Exit 0 written, 2 not a table this reader takes, 1 anything else.
 *
 * @module cat-harness-tools/scripts/tabular-csvw
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { libraryEntryDir } from "./lib/library-entry-graphs.ts";
import { fileURLToPath } from "node:url";

import { NOT_AUTHORED } from "../schemas/content/narrative.ts";
import { TABULAR_CSVW_FILENAME, TabularCsvwSchema, type TabularCsvw } from "../schemas/library/tabular-csvw.ts";
import { extractTabularCsvw } from "../pipeline/pipeline-plugins.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** `_tech_meta.tech_meta(file)` — the `source` block every rung records. */
export function techMeta(file: string): Record<string, unknown> {
  return python(
    `spec = u.spec_from_file_location('t', ${JSON.stringify(join(HERE, "_tech_meta.py"))})\n` +
      "m = u.module_from_spec(spec); spec.loader.exec_module(m)\n" +
      "print(json.dumps(m.tech_meta(sys.argv[1])))\n",
    file,
  ) as Record<string, unknown>;
}

/** The entry's slug, from `_pdf_doc_id.slugify` — the one definition — as `tabular-records.py` makes it. */
export function entrySlug(file: string): string {
  const stem = basename(file).replace(/\.[^.]+$/, "");
  return python(
    `spec = u.spec_from_file_location('d', ${JSON.stringify(join(HERE, "_pdf_doc_id.py"))})\n` +
      "m = u.module_from_spec(spec); spec.loader.exec_module(m)\n" +
      "print(json.dumps(m.slugify(sys.argv[1])))\n",
    stem,
  ) as string;
}

function python(body: string, arg: string): unknown {
  const r = Bun.spawnSync(["python3", "-c", "import sys, json, importlib.util as u\n" + body, arg]);
  if (r.exitCode !== 0) throw new Error(`python3 failed: ${new TextDecoder().decode(r.stderr).trim()}`);
  return JSON.parse(new TextDecoder().decode(r.stdout));
}

/**
 * The record for one source, or `null` when the slot's reader does not take
 * it. Throws `UnregisteredPipelinePluginError` when nothing fills the slot.
 */
export function csvwRecord(file: string, source: Record<string, unknown>, docId: string): TabularCsvw | null {
  const mimetype = typeof source.mimetype_sniffed === "string" ? source.mimetype_sniffed : null;
  const record = extractTabularCsvw(readFileSync(file), { url: basename(file), docId, mimetype });
  if (record === null) return null;
  // A reader extracts tables; nobody has authored what they are about yet.
  return TabularCsvwSchema.parse({ ...record, source, narrative: NOT_AUTHORED });
}

function main(argv: string[]): number {
  const o = argv.indexOf("-o");
  const lib = o >= 0 ? argv[o + 1] : undefined;
  const file = argv.find((a, i) => !a.startsWith("-") && argv[i - 1] !== "-o");
  if (!lib || !file) {
    console.error("usage: tabular-csvw.ts -o <library> <file>");
    return 1;
  }
  const slug = entrySlug(file);
  const record = csvwRecord(file, techMeta(file), slug);
  if (record === null) {
    console.error(`SKIP ${basename(file)}: not a table the tabular-csvw reader takes, nothing written`);
    return 2;
  }
  // Re-ingest writes over the entry where it is filed (`library/<group>/<slug>/`,
  // bean `6fez`); a new entry lands unfiled at `library/<slug>/`.
  const out = libraryEntryDir(lib, slug) ?? join(lib, slug);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, TABULAR_CSVW_FILENAME), JSON.stringify(record, null, 2) + "\n");
  console.log(`ok  ${slug.padEnd(28)} ${record.tables.length} table(s)  [csvw]`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
