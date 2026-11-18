#!/usr/bin/env bun
/**
 * Code lists — validate every declared one, check that adjudications name
 * theirs, and build the SKOS document `glossary-export` publishes.
 *
 * @module scripts/code-lists
 * @covers code-list
 *
 * A code list holds codes with a narrative definition and a source; the shape
 * is `schemas/library/code-list.ts`, and this is its gate.
 *
 *   bun run cat-harness-tools/scripts/code-lists.ts --check
 *
 * Exit 0 clean · 1 a finding · 2 nothing to check (no code list anywhere is
 * `could not determine`, never a pass). `--instance <root>` picks the
 * layer (default: this one).
 *
 * ## What it refuses
 *
 * 1. A file declaring `folio-code-list/v1` that does not parse — a malformed
 *    list fails where it lives, not when a diagram first reads it.
 * 2. An adjudication in this layer's diagrams that declares `codes` and
 *    names no `list`. The engine accepts that (a downstream folio may not
 *    have written its lists yet); here it is a finding.
 *
 * Whether the codes MATCH the list is the engine's job, at load time
 * (`checkCodeLists` in `src/workflow/process-model.ts`).
 *
 * @conformsTo w3c-owl2
 * @conformsTo w3c-rdf
 */
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { codeListDirs, codeListToSkos, loadCodeLists, type CodeList } from "../schemas/library/code-list.ts";
import { workflowFiles } from "./known-skills";
import { ownElementPattern } from "../schemas/kg/namespaces.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

const SKOS = "http://www.w3.org/2004/02/skos/core#";
const DCTERMS = "http://purl.org/dc/terms/";
const OWL = "http://www.w3.org/2002/07/owl#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

/** The published SKOS document: one concept scheme per list, in one file. */
export function buildCodeListsDoc(lists: readonly CodeList[], docIri: string): Record<string, unknown> {
  return {
    "@context": {
      skos: SKOS,
      dcterms: DCTERMS,
      owl: OWL,
      rdf: RDF,
      prefLabel: "skos:prefLabel",
      definition: "skos:definition",
      changeNote: "skos:changeNote",
      notation: "skos:notation",
      source: "dcterms:source",
      title: "dcterms:title",
      deprecated: "owl:deprecated",
      inScheme: { "@id": "skos:inScheme", "@type": "@id" },
    },
    "@id": docIri,
    title: "Code lists",
    "@graph": lists.flatMap((l) => codeListToSkos(l, docIri)),
  };
}

/** Adjudications in these diagrams that declare `codes` and name no `list`. */
export function unlistedAdjudications(files: readonly string[], base: string): string[] {
  const out: string[] = [];
  for (const f of files.filter((f) => f.endsWith(".bpmn"))) {
    const xml = readFileSync(f, "utf-8");
    for (const m of xml.matchAll(ownElementPattern(xml, "adjudication", "[^>]*>"))) {
      const tag = m[0]!;
      if (/\scodes="/.test(tag) && !/\slist="/.test(tag)) out.push(`${relative(base, f)}: ${tag}`);
    }
  }
  return out;
}

async function run(argv: string[]): Promise<number> {
  const instance = argv.includes("--instance") ? resolve(argv[argv.indexOf("--instance") + 1]!) : ROOT;
  const dirs = await codeListDirs(instance);
  const lists = loadCodeLists(dirs); // throws, naming the file, on a malformed list
  const base = resolve(instance, "..");

  console.log(`${lists.size} code list(s) from ${dirs.length} declared director${dirs.length === 1 ? "y" : "ies"}:`);
  for (const l of [...lists.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const retired = l.codes.filter((c) => c.status === "retired").length;
    console.log(`  ${l.id.padEnd(38)} ${l.codes.length} code(s)${retired ? `, ${retired} retired` : ""}`);
  }
  if (lists.size === 0) {
    console.error("\nNo code list found — `could not determine`, not a pass.");
    return 2;
  }

  const unlisted = unlistedAdjudications(workflowFiles(instance), base);
  if (unlisted.length > 0) {
    console.error(`\n✗ ${unlisted.length} adjudication(s) declare codes and name no code list:`);
    for (const u of unlisted) console.error(`    ${u}`);
    console.error("  Add list=\"<id>\" naming a code list that defines those codes, with a definition and a");
    console.error("  source for each. A code nobody defined is a string, not an answer.");
    return 1;
  }
  console.log(`\n✓ every list parses; every adjudication names the list its codes come from`);
  return 0;
}

if (import.meta.main) process.exit(await run(process.argv.slice(2)));
