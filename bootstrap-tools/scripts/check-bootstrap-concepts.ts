#!/usr/bin/env bun
/**
 * A BOOTSTRAP SCHEMA NAMES NO OUTSIDE CONCEPT.
 *
 * @covers schemas — bootstrap's declared schema directories and the Zod sources they are generated from
 *
 * Bootstrap is the layer every harness starts from. A term from one
 * derivative's world — a health-guideline model, a standards body, an
 * interchange format — written into a bootstrap schema makes every other
 * harness inherit a vocabulary it has no use for, and makes the base depend,
 * in its words, on something above it. The rule covers the schemas' PROSE as
 * well as their fields, since a description is part of the contract a
 * generated JSON Schema publishes.
 *
 * ## Beside `graph.test.ts`, not instead of it
 *
 * `bootstrap-tools/schemas/graph.test.ts` holds ALL of `bootstrap/` to a stricter
 * list — no layer above it may be named either (no harness or folio built on it),
 * because bootstrap is self-definitional. This check covers the narrower
 * rule, no OUTSIDE concept, and applies it to one thing that test does not
 * read: the Zod SOURCES bootstrap's schemas are generated from. Those live in
 * `bootstrap-tools/schemas/`, and may not name an outside concept either,
 * since their text becomes the published schema.
 *
 * ## Which files
 *
 * Both halves are DERIVED, not listed:
 *
 * - every directory the `bootstrap` layer declares with the `schemas`
 *   graph typology, where the published `*.schema.json` live; and
 * - every `../schemas/*.ts` module `gen-bootstrap-schemas.ts` imports, which
 *   are the sources those documents are generated from.
 *
 * A declaration that cannot be read is a failure, not a skip. A check that
 * silently scanned nothing would report clean over exactly the files it
 * exists to guard.
 *
 * ## What counts
 *
 * A short, explicit list of words, each with why it is here. Case matters
 * where the plain-English word is innocent: `who` is a pronoun, `WHO` is an
 * organisation; `smart` alone is an adjective, `SMART` and `smart-…` name a
 * family of harnesses.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO = join(import.meta.dir, "..", "..");

/** The bootstrap layers, by root directory. */
const BOOTSTRAP_INSTANCES = ["bootstrap"];

/** Each forbidden term, with the reason a reader will see if it appears. */
export const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\bDAK\b/i, why: "a derivative's content model" },
  { pattern: /\bL[123]\b/, why: "a derivative's layer names" },
  { pattern: /\bSMART\b/, why: "a derivative family's name" },
  { pattern: /\bsmart-[a-z][a-z0-9-]*/i, why: "a derivative harness's name" },
  { pattern: /\bWHO\b/, why: "an outside organisation" },
  { pattern: /\bwho-[a-z][a-z0-9-]*/i, why: "a derivative instance's name" },
  { pattern: /\bFHIR\b/i, why: "an outside interchange standard" },
  { pattern: /\bHL7\b/i, why: "an outside standards body" },
];

export interface Finding { file: string; line: number; term: string; why: string }

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    // A TEST is not a schema, and one that lists the forbidden names in order
    // to forbid them (`bootstrap-tools/schemas/graph.test.ts`) is not a leak.
    else if (/\.(ts|json)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** The schema directories every bootstrap layer declares. Throws when one cannot be read. */
export function bootstrapSchemaDirs(repo: string): string[] {
  const dirs: string[] = [];
  for (const inst of BOOTSTRAP_INSTANCES) {
    const decl = join(repo, inst, `${inst}.json`);
    const d = JSON.parse(readFileSync(decl, "utf8")) as {
      directories?: { path: string; graphTypologies?: string[] }[];
    };
    for (const e of d.directories ?? []) {
      if ((e.graphTypologies ?? []).includes("schemas")) dirs.push(join(repo, inst, e.path));
    }
  }
  return dirs;
}

/** The Zod modules the bootstrap schemas are GENERATED from, read off the generator's imports. */
export function bootstrapSchemaSources(repo: string): string[] {
  const gen = join(repo, "bootstrap-tools", "scripts", "gen-bootstrap-schemas.ts");
  const text = readFileSync(gen, "utf8");
  const out = new Set<string>();
  // Only a module imported FOR A SCHEMA is a source: the generator also
  // imports `declaration.ts` for its layer helpers, and that module's text
  // never reaches a published document.
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s+"\.\.\/schemas\/([a-z0-9-]+\.ts)"/g)) {
    if (/\b\w+Schema\b/.test(m[1]!)) out.add(join(repo, "bootstrap-tools", "schemas", m[2]!));
  }
  return [...out].sort();
}

export function scan(files: { path: string; text: string }[]): Finding[] {
  const found: Finding[] = [];
  for (const f of files) {
    f.text.split("\n").forEach((line, i) => {
      for (const { pattern, why } of FORBIDDEN) {
        const m = line.match(pattern);
        if (m) found.push({ file: f.path, line: i + 1, term: m[0], why });
      }
    });
  }
  return found;
}

if (import.meta.main) {
  const dirs = bootstrapSchemaDirs(REPO).filter((d) => existsSync(d));
  const sources = bootstrapSchemaSources(REPO).filter((p) => existsSync(p));
  const files = [...dirs.flatMap(filesUnder), ...sources].map((p) => ({ path: relative(REPO, p), text: readFileSync(p, "utf8") }));
  console.log(`Bootstrap schemas — ${files.length} file(s): ${dirs.length} declared schema director${dirs.length === 1 ? "y" : "ies"}, and ${sources.length} Zod source(s) they are generated from`);
  // NEVER A CLEAN RUN OVER NOTHING.
  if (files.length === 0) {
    console.error("  ✗ no bootstrap schema file was found — that is not the same as none naming an outside concept");
    process.exit(1);
  }
  const found = scan(files);
  if (found.length === 0) {
    console.log("  ✓ no outside concept is named");
    process.exit(0);
  }
  for (const f of found) console.error(`  ✗ ${f.file}:${f.line} names \`${f.term}\` — ${f.why}`);
  console.error("\nA bootstrap schema is the base every harness starts from, and names nothing above it (issue #1164).");
  process.exit(1);
}
