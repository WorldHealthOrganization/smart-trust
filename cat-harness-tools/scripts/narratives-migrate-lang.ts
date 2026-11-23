/**
 * Move a library's stored narratives from the single form to a one-entry
 * list that names its language (`lang: "en"` by default). No library entry
 * records a language, so the language is the one the narratives were written
 * in.
 *
 * What it does NOT touch, on purpose:
 * - a slot already in list form (it has its languages);
 * - an empty `not-authored` slot: nothing is written in any language, so
 *   there is no language to name;
 * - a file that does not round-trip byte-identically through
 *   `JSON.parse`/`JSON.stringify`. Rewriting it would change more than
 *   narratives, so it is refused and reported instead.
 *
 * Dry run unless `--apply`. Every converted slot is re-parsed with
 * `NarrativeSlotSchema`, and a file whose narrative count changes is refused.
 *
 * Usage: bun run cat narratives:migrate-lang <library-dir>… [--lang en] [--apply]
 *
 * @module scripts/narratives-migrate-lang
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LANGUAGE_TAG, NarrativeSlotSchema } from "../schemas/content/narrative.ts";
import { LIBRARY_NARRATIVE_BEARING, NARRATIVE_BEARING, narrativesIn, slotsIn, type NarrativePath } from "./narratives.ts";
import { DEFAULT_NARRATIVE_LANG } from "./lib/narrative-display.ts";
import { libraryEntryDirs } from "./lib/library-entry-graphs.ts";

export interface FileResult {
  file: string;
  converted: number;
  skippedNotAuthored: number;
  alreadyList: number;
  refused?: string;
}

function indentOf(raw: string): number | string {
  const m = /^\{\r?\n([ \t]+)"/.exec(raw);
  return m ? (m[1]!.startsWith("\t") ? "\t" : m[1]!.length) : 2;
}

function at(doc: unknown, path: NarrativePath): { parent: Record<string, unknown> | unknown[]; key: string | number } {
  let cur = doc as Record<string, unknown>;
  for (const k of path.slice(0, -1)) cur = (cur as Record<string | number, unknown>)[k] as Record<string, unknown>;
  return { parent: cur, key: path[path.length - 1]! };
}

/** Non-ASCII characters as `\uXXXX`, the way Python's `json` writes a file. */
function escapeNonAscii(text: string): string {
  return text.replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/**
 * How this file was serialised: plain, or with non-ASCII escaped. A file in
 * neither form is not ours to rewrite.
 */
function serializerFor(raw: string, doc: unknown, indent: number | string, trailing: string): ((d: unknown) => string) | undefined {
  const plain = (d: unknown) => JSON.stringify(d, null, indent) + trailing;
  const escaped = (d: unknown) => escapeNonAscii(JSON.stringify(d, null, indent)) + trailing;
  if (plain(doc) === raw) return plain;
  if (escaped(doc) === raw) return escaped;
  return undefined;
}

/**
 * Parse `raw`, keeping every number exactly as it is written.
 *
 * The library's Python producers write a float such as `338.0` or `1e-05`,
 * which `JSON.parse` reads as `338` and `0.00001` and `JSON.stringify` then
 * writes as `338` and `0.00001`. A file holding one did not round-trip and was
 * refused: 9 files across cat-harness and a content layer on 2026-10-21, so their
 * narratives could not be migrated. A number whose source is not what
 * `JSON.stringify` would write is kept as that source (`JSON.rawJSON`), so it
 * is written back character for character.
 */
function parseKeepingNumbers(raw: string): Record<string, unknown> {
  // `JSON.rawJSON` (ES2025) is in Bun but not yet in TypeScript's lib.
  const { rawJSON } = JSON as JSON & { rawJSON(text: string): unknown };
  return JSON.parse(raw, (_key: string, value: unknown, context?: { source?: string }) =>
    typeof value === "number" && context?.source !== undefined && context.source !== JSON.stringify(value)
      ? rawJSON(context.source)
      : value,
  ) as Record<string, unknown>;
}

/** Migrate one file's text. Pure: returns the new text (or the same) and what happened. */
export function migrateText(raw: string, lang: string): { text: string; result: Omit<FileResult, "file"> } {
  const result = { converted: 0, skippedNotAuthored: 0, alreadyList: 0 };
  const doc = parseKeepingNumbers(raw);
  const indent = indentOf(raw);
  const trailing = raw.endsWith("\n") ? "\n" : "";
  const write = serializerFor(raw, doc, indent, trailing);
  if (write === undefined) {
    return { text: raw, result: { ...result, refused: "does not round-trip through JSON byte-identically" } };
  }
  // Raw slots, not `narrativesIn`: from stage 4 the slot schema refuses a
  // written single narrative, which is exactly what this converts.
  for (const { at: path, value } of slotsIn(doc)) {
    if (Array.isArray(value)) {
      result.alreadyList += value.length;
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    const single = value as Record<string, unknown>;
    if (single.state === "not-authored") {
      result.skippedNotAuthored++;
      continue;
    }
    const list = [{ ...single, lang }];
    const r = NarrativeSlotSchema.safeParse(list);
    if (!r.success) return { text: raw, result: { ...result, refused: `${path.join(".")}: ${r.error.issues[0]?.message}` } };
    const { parent, key } = at(doc, path);
    (parent as Record<string | number, unknown>)[key] = list;
    result.converted++;
  }
  // Every slot now reads through the schema: the converted ones, the lists
  // already there, and the empty slots. Anything else was malformed already.
  if (narrativesIn(doc).length !== result.converted + result.alreadyList + result.skippedNotAuthored) {
    return { text: raw, result: { ...result, refused: "a narrative slot does not validate after conversion" } };
  }
  return { text: result.converted ? write(doc) : raw, result };
}

/** Every narrative-bearing file of every entry in a library directory. */
export function libraryFiles(lib: string): string[] {
  const out: string[] = [];
  // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`).
  for (const { dir } of libraryEntryDirs(lib)) {
    for (const name of NARRATIVE_BEARING) {
      const f = join(dir, name);
      if (existsSync(f)) out.push(f);
    }
  }
  for (const name of LIBRARY_NARRATIVE_BEARING) {
    const f = join(lib, name);
    if (existsSync(f)) out.push(f);
  }
  return out;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const li = argv.indexOf("--lang");
  const lang = li >= 0 ? argv[li + 1]! : DEFAULT_NARRATIVE_LANG;
  const libs = argv.filter((a, i) => !a.startsWith("--") && !(li >= 0 && i === li + 1));
  if (libs.length === 0 || !LANGUAGE_TAG.test(lang)) {
    console.error("usage: bun run cat narratives:migrate-lang <library-dir>… [--lang <bcp47>] [--apply]");
    process.exit(2);
  }
  let converted = 0, skipped = 0, files = 0, refused = 0;
  for (const lib of libs) {
    for (const f of libraryFiles(lib)) {
      const raw = readFileSync(f, "utf-8");
      const { text, result } = migrateText(raw, lang);
      if (result.refused) {
        refused++;
        console.error(`  REFUSED ${f}: ${result.refused}`);
        continue;
      }
      converted += result.converted;
      skipped += result.skippedNotAuthored;
      if (result.converted) {
        files++;
        if (apply) writeFileSync(f, text);
      }
    }
  }
  console.log(`${apply ? "migrated" : "would migrate"} ${converted} narrative(s) in ${files} file(s) to [{…, lang: "${lang}"}]; ${skipped} not-authored left as they are; ${refused} file(s) refused`);
  process.exit(refused ? 1 : 0);
}
