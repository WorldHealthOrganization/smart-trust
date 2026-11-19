#!/usr/bin/env bun
/**
 * Rewrite node files' `$schema` tags — the migration a renamed or MAJOR-bumped
 * node kind ships with.
 *
 * @module scripts/retag-schemas
 * @graphNode none — a migration over node files, not a schema
 *
 * Each node kind has one live version, so a major bump rewrites every file in
 * the same change. The renames applied start with the move to short names
 * ({@link RENAMES_2026_10_05}).
 *
 * It changes ONLY the value of a `$schema` key: a JSON file's top-level
 * `"$schema"`, or a Markdown file's `$schema:` front-matter line. A tag quoted
 * in prose is left alone, since prose that names an old tag is a record.
 *
 *   bun run cat-harness-tools/scripts/retag-schemas.ts <dir>...            rewrite
 *   bun run cat-harness-tools/scripts/retag-schemas.ts --check <dir>...    fail if any file still carries an old tag
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Old tag → new tag, for the rename to short SemVer names (issue #2195). */
export const RENAMES_2026_10_05: Readonly<Record<string, string>> = {
  "folio-todo/v1": "todo/1.0.0",
  "folio-review-comment/v1": "review-comment/1.0.0",
  "folio-public-comment/v1": "public-comment/1.0.0",
  "folio-public-comment-changeset/v1": "changeset/1.0.0",
  "folio-node-kind-index/v1": "node-kind-index/1.0.0",
};

/**
 * Old tag → new tag for document kinds, made node kinds on 2026-10-06 (owner:
 * every node kind gets pages). The same rename rule as above.
 */
export const RENAMES_2026_10_06: Readonly<Record<string, string>> = {
  "folio-document-kind/v1": "document-kind/1.0.0",
  "folio-document-kind-coverage/v1": "document-kind-coverage/1.0.0",
};

/** Every rename this script has shipped, so `--check` catches a file any of them missed. */
export const RENAMES: Readonly<Record<string, string>> = { ...RENAMES_2026_10_05, ...RENAMES_2026_10_06 };

const JSON_TAG = /("\$schema"\s*:\s*")([^"]+)(")/;
const FRONT_MATTER_TAG = /^(\$schema:\s*["']?)([^"'\s]+)(["']?\s*)$/m;

/** The text with its `$schema` value renamed, or undefined when there is nothing to rename. */
export function retag(text: string, file: string, renames: Readonly<Record<string, string>>): string | undefined {
  if (file.endsWith(".json")) {
    const m = JSON_TAG.exec(text);
    const to = m && renames[m[2]!];
    return to ? text.replace(JSON_TAG, `$1${to}$3`) : undefined;
  }
  if (file.endsWith(".md")) {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!fm) return undefined;
    const m = FRONT_MATTER_TAG.exec(fm[1]!);
    const to = m && renames[m[2]!];
    return to ? text.replace(fm[1]!, fm[1]!.replace(FRONT_MATTER_TAG, `$1${to}$3`)) : undefined;
  }
  return undefined;
}

function* files(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (e.endsWith(".json") || e.endsWith(".md")) yield p;
  }
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const dirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (dirs.length === 0) {
    console.error("usage: retag-schemas.ts [--check] <dir>...");
    process.exit(2);
  }
  let n = 0;
  for (const dir of dirs) {
    for (const f of files(dir)) {
      const next = retag(readFileSync(f, "utf-8"), f, RENAMES);
      if (next === undefined) continue;
      n++;
      if (check) console.error(`  ✗ ${f} carries a renamed tag`);
      else writeFileSync(f, next);
    }
  }
  console.log(check ? `${n} file(s) carry a renamed tag` : `retagged ${n} file(s)`);
  process.exit(check && n > 0 ? 1 : 0);
}
