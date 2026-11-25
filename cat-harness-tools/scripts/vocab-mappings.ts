#!/usr/bin/env bun
/**
 * Vocabulary mapping tables: validate every declared one, and judge what a
 * schema alone cannot.
 *
 * @module scripts/vocab-mappings
 * @covers vocab-mapping
 *
 * Design: `docs/proposals/vocabulary-mappings-2026-10-02.md`. The shape is
 * `schemas/content/vocab-mapping.ts`; this is its gate.
 *
 *   bun run cat-harness-tools/scripts/vocab-mappings.ts --check
 *
 * Exit 0 clean · 1 a finding · 2 nothing to check (no table anywhere is
 * `could not determine`, never a pass).
 *
 * ## What `--check` refuses
 *
 * 1. A file tagged `folio-vocab-mapping/v1` that does not parse, or two tables
 *    with one id. A malformed table fails where it lives, not in the generator
 *    that first applies it.
 * 2. A derived target whose `derivedFrom` names no AUTHORITATIVE target in the
 *    same table. The applier would write nothing for it, which a reader cannot
 *    tell apart from "not mapped".
 * 3. A group `source` or `target` written as a CURIE whose prefix nobody
 *    declares. It would produce a ConceptMap with a system no consumer can
 *    resolve.
 */
import { relative, resolve } from "node:path";

import { ownPrefixTable } from "../schemas/kg/graph-typology-registry.js";
import { STANDARD_PREFIXES, expandCurie, loadVocabMappings, vocabMappingDirs, type VocabMapping } from "../schemas/content/vocab-mapping.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

// The HARNESS (70lx B2): this script moved up, and what it reads stayed in cat-harness.
const ROOT = HARNESS_ROOT;

/** The findings for one table: empty when it is sound. */
export function tableFindings(m: VocabMapping, prefixes: Readonly<Record<string, string>>): string[] {
  const out: string[] = [];
  const authoritative = new Set<string>();
  for (const g of m.group) {
    for (const e of g.element) {
      for (const t of e.target ?? []) {
        const key = t.key ?? t.code;
        if (key !== undefined && t.authority !== "derived") authoritative.add(key);
      }
    }
  }
  m.group.forEach((g, gi) => {
    for (const [side, v] of [["source", g.source], ["target", g.target]] as const) {
      if (v === undefined) continue;
      const curie = /^([A-Za-z][\w.-]*):(?!\/\/)/.exec(v);
      if (curie !== null && !/^(urn|http|https)$/.test(curie[1]!) && expandCurie(v, prefixes) === v) {
        out.push(`${m.id}: group[${gi}].${side} "${v}" uses an undeclared prefix`);
      }
    }
    g.element.forEach((e, ei) => {
      (e.target ?? []).forEach((t, ti) => {
        if (t.authority === "derived" && !authoritative.has(t.derivedFrom!)) {
          out.push(`${m.id}: group[${gi}].element[${ei}].target[${ti}] derives from "${t.derivedFrom}", which no authoritative target in this table writes`);
        }
      });
    });
  });
  return out;
}

function run(argv: string[]): number {
  const instance = argv.includes("--instance") ? resolve(argv[argv.indexOf("--instance") + 1]!) : ROOT;
  const dirs = vocabMappingDirs(instance);
  const tables = loadVocabMappings(dirs); // throws, naming the file, on a malformed table
  const prefixes = { ...STANDARD_PREFIXES, ...ownPrefixTable() };
  console.log(`${tables.size} vocabulary mapping table(s) in ${dirs.map((d) => relative(resolve(ROOT, ".."), d)).join(", ") || "(none declared)"}:`);
  for (const m of [...tables.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const rows = m.group.reduce((n, g) => n + g.element.reduce((k, e) => k + (e.target?.length ?? 0), 0), 0);
    console.log(`  ${m.id.padEnd(34)} ${m.group.length} group(s), ${rows} row(s), ${m.status}`);
  }
  if (tables.size === 0) {
    console.error("\nNo vocabulary mapping table found — `could not determine`, not a pass.");
    return 2;
  }
  const findings = [...tables.values()].flatMap((m) => tableFindings(m, prefixes));
  if (findings.length > 0) {
    console.error(`\n✗ ${findings.length} finding(s):`);
    for (const f of findings) console.error(`    ${f}`);
    return 1;
  }
  console.log("\n✓ every table parses; every derived target copies an authoritative one; every system resolves");
  return 0;
}

if (import.meta.main) process.exit(run(process.argv.slice(2)));
