/**
 * A page may not claim a language a reader cannot read it in.
 *
 * `available_locales` is defined by `translation-manager.md` as *"which
 * languages can I read this page in"*. This gate holds the corpus to that
 * sentence: every locale a page claims must have a RENDERED page behind it.
 *
 * `gen-docs-pages.ts` computes the field from the translation index and
 * `docs:pages:check` holds generated pages to it; this gate covers the
 * hand-authored pages, translations and sources alike, that stamp their own
 * list.
 *
 * ## Over-claiming only
 *
 * A page claiming a locale it has no rendering for makes the language bar
 * offer a link and the coverage badge count a language that are not there.
 * Claiming FEWER locales than exist is a different defect, the generator's
 * to get right, and is not judged here.
 *
 * ## A translated page is resolved through its SOURCE
 *
 * The index keys translations under the page they translate, so
 * `docs/fr/architecture.md` is not a key of its own. The index is inverted
 * here — translated page key → source key — rather than re-resolving
 * `translation_source` by hand, so there is one answer.
 *
 * ## Three states
 *
 * An index that could not be read is not an index with no translations: on
 * a non-`note` index finding this exits 2 without judging the corpus.
 * Finding no page that declares the field at all also exits 2, since a sweep
 * over an empty set asserts nothing.
 *
 * Only tracked files are examined; an untracked scratch page under `docs/`
 * is not what the repository publishes.
 *
 * `docs` is the graph typology this audits — `cat-harness.json` declares `docs/`
 * with `graphs: ["docs"]`, and the locale subtrees walked here are part of it.
 *
 * Usage:
 *   bun run cat check:available-locales
 *
 * @covers docs
 * @graphNode tool
 */
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  buildTranslationIndex,
  frontMatter,
  pageKey,
  pageUrl,
  permalinkDefaultsIn,
  sourceLocale,
  SITE_DIR,
  type IndexFinding,
  type TranslationIndex,
} from "../pipeline/translation-index.ts";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const INSTANCE_ROOT = HARNESS_ROOT;
const REPO_ROOT = resolve(INSTANCE_ROOT, "..");

/** One page claiming a locale it has no rendered page for. */
export interface Overclaim {
  /** Repo-relative path of the page making the claim. */
  file: string;
  /** What the page's `available_locales` says. */
  claims: string[];
  /** The claimed locales with no rendered page behind them. */
  unbacked: string[];
  /** `source`, or the key of the page this one translates. */
  role: string;
}

export interface Report {
  /** Every locale the index found a rendered page for, source language first. */
  locales: string[];
  /** Pages declaring `available_locales` at all. */
  declaring: number;
  /** ...of which, source pages. */
  sourcePages: number;
  /** ...of which, translations of another page. */
  translations: number;
  findings: Overclaim[];
  /**
   * Why the corpus could not be judged, when it could not be. Non-empty means
   * every other field is meaningless — not clean.
   */
  unreadable: IndexFinding[];
}

/**
 * Translated page key → the key of the page it translates.
 *
 * Inverted from the index rather than read from `translation_source`, so the
 * resolution a translated page gets here is the same one the navbar gets.
 */
export function sourceKeyByTranslation(index: TranslationIndex): Map<string, string> {
  const byTranslation = new Map<string, string>();
  for (const [sourceKey, entry] of Object.entries(index.pages)) {
    for (const translated of Object.values(entry.translations)) {
      byTranslation.set(pageKey(translated.url), sourceKey);
    }
  }
  return byTranslation;
}

/**
 * The locales a claim on `sourceKey` may legitimately name: the source language,
 * which every page is readable in by construction, plus every locale the index
 * holds a rendered translation for.
 */
export function backedLocales(index: TranslationIndex, src: string, sourceKey: string): Set<string> {
  const entry = index.pages[sourceKey];
  return new Set<string>([src, ...Object.keys(entry?.translations ?? {})]);
}

/** Tracked `.md` files under the layer's site directory, repo-relative. */
function trackedPages(): string[] {
  const siteAbs = join(INSTANCE_ROOT, SITE_DIR);
  // In a composed checkout every layer is a REMOTE MOUNT, laid down from
  // `index.lock.json` and ignored by the index repository's git, so a bare
  // `git ls-files` at the root lists none of their files. `gitCorpus` counts a
  // mount's files as it counted a submodule's, and is tracked-plus-untracked
  // exactly as before everywhere else. A DIRECTORY is spelled `<dir>/**`:
  // a mount's files are matched as globs, and a bare directory matches none.
  const out = gitCorpus(REPO_ROOT, [`${relative(REPO_ROOT, siteAbs)}/**`]);
  if (out === undefined) throw new Error(`git could not list the files under ${siteAbs}`);
  return out.map((f) => relative(REPO_ROOT, f)).filter((f) => f.endsWith(".md"));
}

export function availableLocaleClaims(): Report {
  const { index, findings } = buildTranslationIndex(INSTANCE_ROOT);
  const unreadable = findings.filter((f) => f.severity !== "note");
  const empty: Report = {
    locales: [],
    declaring: 0,
    sourcePages: 0,
    translations: 0,
    findings: [],
    unreadable,
  };
  if (unreadable.length > 0) return empty;

  const src = sourceLocale(INSTANCE_ROOT);
  const siteAbs = join(INSTANCE_ROOT, SITE_DIR);
  const bySource = sourceKeyByTranslation(index);

  const report: Report = { ...empty, locales: [src, ...index.locales.filter((l) => l !== src)] };

  for (const file of trackedPages()) {
    let front: Record<string, unknown> | undefined;
    try {
      front = frontMatter(readFileSync(join(REPO_ROOT, file), "utf-8"));
    } catch {
      // A page whose front matter strict YAML rejects is the index's `note`
      // case, not this gate's: three generated reference pages carry one, none
      // is translated, and escalating them here would fail the build over a
      // fact no claim depends on.
      continue;
    }
    const claims = front?.["available_locales"];
    if (!Array.isArray(claims)) continue;
    report.declaring++;

    const own = pageKey(pageUrl(relative(siteAbs, join(REPO_ROOT, file)), front ?? {}, permalinkDefaultsIn(siteAbs)));
    const sourceKey = bySource.get(own);
    if (sourceKey === undefined) report.sourcePages++;
    else report.translations++;

    const backed = backedLocales(index, src, sourceKey ?? own);
    const unbacked = (claims as unknown[])
      .filter((l): l is string => typeof l === "string")
      .filter((l) => !backed.has(l));
    if (unbacked.length > 0) {
      report.findings.push({
        file,
        claims: claims as string[],
        unbacked,
        role: sourceKey === undefined ? "source" : `translation of ${sourceKey || "(home)"}`,
      });
    }
  }

  return report;
}

if (import.meta.main) {
  const report = availableLocaleClaims();

  if (report.unreadable.length > 0) {
    console.error("The translation index could not be determined, so no page's claim was judged:");
    for (const f of report.unreadable) console.error(`  ${f.severity}  ${f.where}: ${f.message}`);
    console.error("\nThat is not a clean corpus. Fix the index first.");
    process.exit(2);
  }

  if (report.declaring === 0) {
    console.error(
      "No page declares `available_locales`, so this gate asserted nothing — refusing to call that clean.",
    );
    process.exit(2);
  }

  console.log(
    `available_locales — ${report.declaring} page(s) declare it ` +
      `(${report.sourcePages} source, ${report.translations} translation(s)), ` +
      `over locales: ${report.locales.join(", ")}`,
  );

  if (report.findings.length === 0) {
    console.log("  ✓ every locale claimed has a rendered page behind it");
    process.exit(0);
  }

  console.error(
    `\n✗ ${report.findings.length} page(s) claim a locale a reader cannot read them in:`,
  );
  for (const f of report.findings) {
    console.error(`  ${f.file}  [${f.role}]`);
    console.error(
      `      claims ${JSON.stringify(f.claims)}   NO RENDERED PAGE for ${JSON.stringify(f.unbacked)}`,
    );
  }
  console.error(
    "\n`available_locales` is what a reader's language bar and coverage badge are computed from,\n" +
      "so a locale with no page behind it offers a link that goes nowhere. Either render the page,\n" +
      "or drop the locale from the claim. A `.po` catalogue is intent to translate, not availability.",
  );
  process.exit(1);
}
