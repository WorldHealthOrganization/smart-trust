/**
 * Translation coverage QA sweep — reports translation status for all docs pages.
 *
 * Scans all Markdown files under `docs/` and reports which pages have
 * translations, which don't, and overall coverage per locale. Results
 * are written to `docs/_data/translation-qa.json` so Jekyll can render
 * them, and to stdout for CI/agent consumption.
 *
 * This is a "sidecar" in spirit — it records the translation coverage
 * state alongside the content, enabling the QA badge to show whether
 * the sweep has been run and what it found.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/translation-qa-sweep.ts          # run + write
 *   bun run cat-harness-tools/pipeline/translation-qa-sweep.ts --check  # check only
 *   bun run cat-harness-tools/pipeline/translation-qa-sweep.ts --json   # JSON output
 *
 * @module pipeline/translation-qa-sweep
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { availableLocales } from "./po-resolve";
import {
  localesAvailableFor,
  sourceLocale,
  supportedLocales,
  targetLocales,
} from "./translation-index.ts";
import { siteDirFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

const INSTANCE_ROOT = join(HARNESS_ROOT);
const DOCS_DIR = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT));
const DATA_DIR = join(DOCS_DIR, "_data");
const OUTPUT_FILE = join(DATA_DIR, "translation-qa.json");
const GENERATED_BY = "pipeline/translation-qa-sweep.ts — do not hand-edit; rerun the sweep";

/**
 * The layer's own answer, not a literal — `translation-index.ts` reads the
 * config once and every consumer asks it.
 *
 * TWO lists, because they answer two questions and collapsing them is the
 * defect this sweep shipped with (issue #687, bean `czct`):
 *
 * - {@link TARGET_LOCALES} — the locales a translation is produced INTO, which
 *   is what `translations/<locale>/` can hold and what a locale subdirectory
 *   under `docs/` is named after. Iterated to look for PO files, and used to
 *   recognise a locale subtree so it is not walked as source.
 * - {@link SUPPORTED_LOCALES} — every language the site claims, source
 *   INCLUDED. This is the denominator of any "how many languages can a reader
 *   read this in" count, because the source language is one of the answers.
 *
 * One list served both roles, so `coveragePct` was taken out of five on a
 * six-language site and `localeCoverage` carried no row for the language 97% of
 * the corpus is actually written in.
 */
const SOURCE_LOCALE = sourceLocale(INSTANCE_ROOT);
const SUPPORTED_LOCALES = supportedLocales(INSTANCE_ROOT);
const TARGET_LOCALES = targetLocales(INSTANCE_ROOT);

interface PageTranslationStatus {
  /** Page path relative to docs/ */
  page: string;
  /** Source language */
  sourceLang: string;
  /**
   * Every locale a reader can read this page in — the source language FIRST
   * among them, then each target locale holding a `.po` for it.
   *
   * This field used to hold the PO-derived list alone, so a page authored in
   * English and translated nowhere reported `[]` — read by the badge as "this
   * page exists in no language at all".
   */
  availableLocales: string[];
  /** The locales a translation is produced into — supported, minus the source. */
  targetLocales: string[];
  /** Every language this site claims, source included. The denominator. */
  supportedLocales: string[];
  /** Coverage: {@link availableLocales} over {@link supportedLocales}. */
  coveragePct: number;
  /** Whether this page has any front matter lang field */
  hasLangField: boolean;
}

interface TranslationQaSweepResult {
  /**
   * The file's own declaration that a generator wrote it — the top-level
   * `"_generated"` key `sync-docs-harness.ts` writes into `harness.json`.
   * `check-reference-direction.ts` reads it (`declaresGenerated`): the page
   * paths listed below name whatever layers the site renders pages for, and
   * without the key every such path read as authored prose naming them.
   */
  _generated: string;
  /** ISO timestamp of the sweep */
  sweptAt: string;
  /** Total docs pages scanned */
  totalPages: number;
  /** Pages with at least one translation */
  pagesWithTranslations: number;
  /** Pages with no translations */
  pagesWithoutTranslations: number;
  /** Per-locale coverage counts */
  localeCoverage: Record<string, { available: number; total: number; pct: number }>;
  /** Per-page status */
  pages: PageTranslationStatus[];
  /** Whether the sweep completed fully */
  complete: boolean;
}

/**
 * Extract front matter from a Markdown file.
 */
function extractFrontMatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      fm[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
  }
  return fm;
}

/**
 * Find all non-translated Markdown pages under docs/.
 * Excludes locale subdirectories (fr/, ar/, etc.)
 */
function findSourcePages(): string[] {
  const pages: string[] = [];

  function walk(dir: string, depth: number) {
    if (depth > 3) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip locale subdirectories and special dirs
        if (TARGET_LOCALES.includes(entry.name)) continue;
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
        if (entry.name === "assets" || entry.name === "vendor") continue;
        walk(fullPath, depth + 1);
      } else if (entry.name.endsWith(".md") && !entry.name.startsWith("_")) {
        pages.push(fullPath);
      }
    }
  }

  walk(DOCS_DIR, 0);
  return pages.sort();
}

/**
 * The locales a page is available in OTHER than the one it is written in.
 *
 * The distinction {@link PageTranslationStatus.availableLocales} no longer
 * carries on its own, now that the source language is a member of it.
 */
function translatedInto(page: PageTranslationStatus): string[] {
  return page.availableLocales.filter((l) => l !== page.sourceLang);
}

/**
 * Run the translation QA sweep.
 */
export function runTranslationQaSweep(): TranslationQaSweepResult {
  const pages = findSourcePages();
  const results: PageTranslationStatus[] = [];
  const localeCounts: Record<string, { available: number; total: number }> = {};

  // A row per SUPPORTED locale, so the source language is reported beside the
  // targets instead of being the one language the table cannot mention.
  for (const locale of SUPPORTED_LOCALES) {
    localeCounts[locale] = { available: 0, total: 0 };
  }

  for (const pagePath of pages) {
    const content = readFileSync(pagePath, "utf-8");
    const fm = extractFrontMatter(content);
    const relPath = relative(DOCS_DIR, pagePath);

    // Derive stem for translation lookup
    const stem = basename(relPath, ".md");
    const poLocales = availableLocales(INSTANCE_ROOT, stem);
    const hasLangField = "lang" in fm;
    // The page's OWN declared language, not the layer default: a page under
    // a locale subtree is authored in that locale and is available in it.
    const pageSource = fm.lang || SOURCE_LOCALE;
    const locales = localesAvailableFor(INSTANCE_ROOT, [pageSource, ...poLocales]);

    const status: PageTranslationStatus = {
      page: relPath,
      sourceLang: pageSource,
      availableLocales: locales,
      targetLocales: TARGET_LOCALES,
      supportedLocales: SUPPORTED_LOCALES,
      coveragePct: SUPPORTED_LOCALES.length > 0
        ? Math.round((locales.length / SUPPORTED_LOCALES.length) * 100)
        : 100,
      hasLangField,
    };

    results.push(status);

    for (const locale of SUPPORTED_LOCALES) {
      localeCounts[locale].total++;
      if (locales.includes(locale)) {
        localeCounts[locale].available++;
      }
    }
  }

  const localeCoverage: Record<string, { available: number; total: number; pct: number }> = {};
  for (const [locale, counts] of Object.entries(localeCounts)) {
    localeCoverage[locale] = {
      ...counts,
      pct: counts.total > 0 ? Math.round((counts.available / counts.total) * 100) : 0,
    };
  }

  return {
    _generated: GENERATED_BY,
    sweptAt: new Date().toISOString(),
    totalPages: pages.length,
    // A page is TRANSLATED when it exists in a language other than its own.
    // `availableLocales.length > 0` was the test until the source locale joined
    // that list, at which point it became true of every page in the corpus —
    // the sweep would have reported 154 of 154 pages translated on a site that
    // is 3% translated. A count whose predicate is vacuously true is worse than
    // no count, because it reads as good news.
    pagesWithTranslations: results.filter((r) => translatedInto(r).length > 0).length,
    pagesWithoutTranslations: results.filter((r) => translatedInto(r).length === 0).length,
    localeCoverage,
    pages: results,
    complete: true,
  };
}

// ── CLI ─────────────────────────────────────────────────────────

if (import.meta.main) {
  const jsonOnly = process.argv.includes("--json");
  const checkOnly = process.argv.includes("--check");

  const result = runTranslationQaSweep();

  if (jsonOnly) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n🌐 Translation QA sweep — ${result.sweptAt}\n`);
    console.log(`Total pages:     ${result.totalPages}`);
    console.log(`With translations: ${result.pagesWithTranslations}`);
    console.log(`Without:           ${result.pagesWithoutTranslations}`);
    console.log();

    console.log("Per-locale coverage:");
    for (const [locale, cov] of Object.entries(result.localeCoverage)) {
      const bar = cov.pct > 0 ? "█".repeat(Math.round(cov.pct / 5)) : "░";
      console.log(`  ${locale}: ${cov.available}/${cov.total} (${cov.pct}%) ${bar}`);
    }
    console.log();

    // Pages without translations
    const noTrans = result.pages.filter((p) => translatedInto(p).length === 0);
    if (noTrans.length > 0) {
      console.log(`Pages without any translations (${noTrans.length}):`);
      for (const p of noTrans) {
        const langTag = p.hasLangField ? "" : " (no lang field)";
        console.log(`  · ${p.page}${langTag}`);
      }
    }
    console.log();

    // Pages with translations
    const hasTrans = result.pages.filter((p) => translatedInto(p).length > 0);
    if (hasTrans.length > 0) {
      console.log(`Pages with translations (${hasTrans.length}):`);
      for (const p of hasTrans) {
        console.log(`  ✓ ${p.page} — ${p.availableLocales.join(", ")} (${p.coveragePct}%)`);
      }
    }
  }

  // Write data file for Jekyll
  if (!checkOnly) {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2) + "\n");
    if (!jsonOnly) {
      console.log(`\nWrote ${OUTPUT_FILE}`);
    }
  }

  // Exit with code for CI
  if (checkOnly && result.pagesWithTranslations === 0) {
    process.exit(1);
  }
}
