#!/usr/bin/env bun
/**
 * Turn Archi's relationship table into the JSON the `archimate-metamodel` Tool
 * checks a model against.
 *
 * @module cat-harness/archimate/scripts/import-archi-relationships
 * @conformsTo opengroup-archimate-3.0
 * @covers archimate
 *
 * ArchiMate 3.2 Appendix B says which relationships are allowed between each
 * pair of element types. Archi keeps that table as data,
 * `com.archimatetool.model/model/relationships.xml` (MIT), with the letter key
 * in `relationships-keys.xml` beside it. This script reads both and writes
 * `archimate/schemas/archimate-relationships.json`. It is the only writer of
 * that file: to move to a newer table, run it on a newer Archi checkout and
 * commit the result. No Java is involved; the files are plain XML.
 *
 * Usage:
 *   bun run cat-harness-tools/archimate/scripts/import-archi-relationships.ts \
 *     --archi <archi checkout> --commit <sha> [--out <file>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TABLE_FILE, type RelationshipTable } from "../schemas/metamodel.ts";

const MODEL_DIR = "com.archimatetool.model/model";

/** Parse the two XML files into a table. Pure: tested without a checkout. */
export function parseArchiTable(relationshipsXml: string, keysXml: string, source: RelationshipTable["source"]): RelationshipTable {
  const keys: Record<string, string> = {};
  for (const m of keysXml.matchAll(/<key\s+char="([a-z])"\s+relationship="(\w+)"\s*\/>/g)) keys[m[1]] = m[2];
  if (Object.keys(keys).length === 0) throw new Error("no <key> in relationships-keys.xml");
  const version = /<relationships\s+version="([^"]+)"/.exec(relationshipsXml)?.[1];
  if (!version) throw new Error("no <relationships version> in relationships.xml");
  const allowed: Record<string, Record<string, string>> = {};
  for (const s of relationshipsXml.matchAll(/<source\s+concept="(\w+)">([\s\S]*?)<\/source>/g)) {
    const row: Record<string, string> = {};
    for (const t of s[2].matchAll(/<target\s+concept="(\w+)"\s+relations="([a-zA-Z]*)"\s*\/>/g)) {
      for (const ch of t[2]) if (!keys[ch.toLowerCase()]) throw new Error(`unknown key letter "${ch}" for ${s[1]} → ${t[1]}`);
      row[t[1]] = t[2].toLowerCase();
    }
    allowed[s[1]] = row;
  }
  return { $schema: "archimate-relationship-table/v1", archimateVersion: version, source, keys, allowed };
}

/** The table as committed: one line per source type, so a diff shows which rows moved. */
export function tableJson(table: RelationshipTable): string {
  const { allowed, ...head } = table;
  const body = JSON.stringify(head, null, 2).replace(/\n}$/, "");
  const rows = Object.entries(allowed).map(([s, row]) => `    ${JSON.stringify(s)}: ${JSON.stringify(row)}`);
  return `${body},\n  "allowed": {\n${rows.join(",\n")}\n  }\n}\n`;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const archi = arg("archi");
  const commit = arg("commit");
  if (!archi || !commit) {
    console.error("usage: import-archi-relationships.ts --archi <archi checkout> --commit <sha> [--out <file>]");
    process.exit(2);
  }
  const dir = join(resolve(archi), MODEL_DIR);
  const table = parseArchiTable(readFileSync(join(dir, "relationships.xml"), "utf8"), readFileSync(join(dir, "relationships-keys.xml"), "utf8"), {
    repository: "https://github.com/archimatetool/archi",
    commit,
    path: `${MODEL_DIR}/relationships.xml`,
    license: "MIT",
    copyright: "Copyright (c) 2013-2026 Phillip Beauvoir, Jean-Baptiste Sarrodie, The Open Group",
  });
  const out = arg("out") ?? TABLE_FILE;
  writeFileSync(out, tableJson(table));
  console.log(`wrote ${out}: ArchiMate ${table.archimateVersion}, ${Object.keys(table.allowed).length} source types`);
}
