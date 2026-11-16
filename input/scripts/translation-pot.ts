#!/usr/bin/env bun
/**
 * `.pot` templates for this IG's narrative pages and BPMN diagrams, one per
 * (locale, source), in the declared `translations/` (smart-trust-translations).
 *
 * The harness's `translation:pot` serves `translation:drift`'s findings (pages
 * already published in a locale with no catalogue) and `translate-bpmn` scans
 * declared `processes` graphs; neither reaches this IG's sources, which sit in
 * `input/` (not mounted, not a graph). This runs the harness's own extractors
 * over them — `extractMarkdown`, `extractBpmn`, `formatPot`,
 * `potWithoutTimestamp` from the pinned cat-harness-tools — and adds nothing:
 *
 * - `input/pagecontent/*.md`         → `translations/<locale>/pagecontent/<page>.pot`
 * - `input/business-processes/*.bpmn` → `translations/<locale>/processes/<diagram>.pot`
 *
 * Not here: FHIR resources (FHIR's own designation/translation mechanism, as
 * CodeSystem supplements), the glossary (`glossary:pot`), and `library/`, a
 * copy of a WHO publication whose translations are WHO's.
 *
 * Usage:
 *   bun input/scripts/translation-pot.ts           # write every template
 *   bun input/scripts/translation-pot.ts --check   # exit 1 if one is missing or stale
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { extractMarkdown, formatPot, potWithoutTimestamp } from "../../cat-harness-tools/pipeline/pot-extract.ts";
import { extractBpmn } from "../../cat-harness-tools/pipeline/bpmn-translate.ts";

const ROOT = resolve(import.meta.dir, "..", "..");
/** Target locales: the six UN languages less the source, `en`. */
const LOCALES = ["ar", "es", "fr", "ru", "zh"];

const sources: { src: string; tpl: string; extract: (text: string, src: string) => ReturnType<typeof extractMarkdown>; project: string }[] = [];
for (const f of readdirSync(join(ROOT, "input/pagecontent")).filter((n) => n.endsWith(".md")).sort()) {
  sources.push({ src: `input/pagecontent/${f}`, tpl: `pagecontent/${basename(f, ".md")}.pot`, extract: extractMarkdown, project: "smart-trust" });
}
for (const f of readdirSync(join(ROOT, "input/business-processes")).filter((n) => n.endsWith(".bpmn")).sort()) {
  sources.push({ src: `input/business-processes/${f}`, tpl: `processes/${basename(f, ".bpmn")}.pot`, extract: extractBpmn, project: basename(f, ".bpmn") });
}

const check = process.argv.includes("--check");
let bad = 0;
let msgids = 0;
for (const { src, tpl, extract, project } of sources) {
  const entries = extract(readFileSync(join(ROOT, src), "utf8"), src);
  if (!entries.length) continue;
  msgids += entries.length;
  for (const locale of LOCALES) {
    const pot = formatPot(entries, { projectName: project, locale });
    const path = join(ROOT, "translations", locale, tpl);
    if (existsSync(path) && potWithoutTimestamp(readFileSync(path, "utf8")) === potWithoutTimestamp(pot)) continue;
    if (check) {
      console.error(`  ✗ ${relative(ROOT, path)} ${existsSync(path) ? "stale" : "missing"}`);
      bad++;
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, pot);
    }
  }
}
if (check && bad) {
  console.error(`${bad} template(s) missing or stale: bun input/scripts/translation-pot.ts`);
  process.exit(1);
}
console.log(`✓ ${sources.length} source(s), ${msgids} msgid(s), templates ${check ? "current" : "written"} for ${LOCALES.join(", ")}.`);
