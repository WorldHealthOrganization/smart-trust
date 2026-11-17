/**
 * The translation index — which source page has a translation in which locale,
 * and where that translation is served from.
 *
 * This is the file the left-hand navbar reads to decide what to show. It is
 * generated into `docs/_data/translations.json`, published into every page by
 * `_includes/head_custom.html`, and consumed by `mountNavLocale` in
 * `docs/assets/js/docs-ui.js`.
 *
 * ## Where a translation comes from, and where it emphatically does not
 *
 * **From the file's own front matter.** A page is a translation because it
 * says `lang: fr`, and it names what it translates with
 * `translation_source: index.md`. Nothing here globs for directories, matches
 * a name against a list of language subtags, or reads `fr` out of a path.
 *
 * That is not fastidiousness. A name match is the "distinguishable by
 * extension … a coincidence of the current layout, not a contract" defect #263
 * named, moved to directory names, and it is wrong in BOTH directions: a folio
 * with a `no/` chapter (Norwegian, or the English word) is silently hidden
 * from its own navbar, and a `pt-BR/` or `translated-fr/` directory is
 * silently shown as source. Neither failure announces itself — the navbar
 * simply has the wrong entries in it, which is exactly the bug this file
 * exists to fix.
 *
 * ## Why the locale directories are NOT declared one by one
 *
 * A first draft of PR #351 added a `translated-content` graph typology and a
 * `locale` field to `ContentDirectory`, then declared ten directories —
 * `docs/{ar,es,fr,ru,zh}/` and the same five under `docs/guides/`. It worked.
 * It was the wrong axis, for three reasons that only look small one at a time:
 *
 *   1. **It restated what the files already say.** All ten pages carried
 *      `lang` and `translation_source` before that change and still do. One
 *      fact in two places is the drift this repository keeps paying for.
 *   2. **It grew as O(locales × subtrees).** A sixth locale is two more
 *      entries; declaring `docs/reference/` translatable is five more.
 *   3. **Translatability is a property of a FORMAT, not of a directory.** The
 *      owner, 2026-09-19: *"narrative/audio/visual content with text should be
 *      translatable. its not so much the node schema itself but its content
 *      (e.g. markdown, bpmn) should be translatable."* That model already
 *      exists — `schemas/library/translation-tools.ts` declares per content type which
 *      formats have an extract/inject pair, and {@link isTranslatable} is the
 *      predicate. This module asks IT rather than inventing a second answer.
 *
 * ## Three states, not two
 *
 * `--check` distinguishes:
 *
 * | state | meaning | exit |
 * |---|---|---|
 * | ok | the written index matches what the corpus says | 0 |
 * | stale / invalid | it does not, and here is which page | 1 |
 * | unreadable | the site root or a translated page could not be read | 2 |
 *
 * The third is the one that matters. A tree that cannot be read must NEVER be
 * written into the index as "this folio has no translations" — the navbar
 * would then render a complete absence of translations from an incomplete
 * read. Same rule as the README sections and the CI-health report:
 * could-not-determine is its own answer.
 *
 * Usage:
 *   bun run cat translation:index          # write cat-harness/docs/_data/translations.json
 *   bun run cat translation:index:check    # fail if stale, invalid, or unreadable
 *   bun run cat translation:index:check --instance <dir>   # another layer's own site
 *
 * `--instance <dir>` reads the layer at `<dir>` instead of this one, and its
 * site is the one IT declares ({@link instanceSiteRoot}); the index is written
 * into that site's `_data/`. A layer that declares no Jekyll site is
 * reported `unreadable` (exit 2) — it has published no translated page to
 * index, which is not the same answer as "none of its pages is translated".
 *
 * @module pipeline/translation-index
 * @covers translation-sources
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { overlayDirs, overlayPath, writePathOf } from "../scripts/lib/layer-output.ts";
import { readEffectiveConfig } from "../schemas/kg/harness-config.ts";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { parse as parseYaml } from "yaml";

import { pagePermalink, permalinkDefaultsIn, type PermalinkDefault } from "../scripts/lib/jekyll-permalink.ts";
import { explicitInstanceRoot, HARNESS_ROOT } from "../scripts/lib/roots.ts";

/** Re-exported so a caller that already reads pages through this module needs no second import. */
export { permalinkDefaultsIn };

import { localeIsRtl, UN_LOCALES } from "../schemas/content/translation.ts";
import { isTranslatable } from "../schemas/library/translation-tools.ts";
import { ownDirectoryById, siteDirFor } from "../schemas/kg/cat-harness.ts";

const REPO_ROOT = resolve(HARNESS_ROOT);

/**
 * The Jekyll site directory, relative to the layer root.
 *
 * **Read from the layer's own declaration** (`cat-harness.json`, entry id
 * `docs`), with the composed `siteDirFor()` as the fallback when nothing is
 * declared. That is bean `x4a6`'s last box: *"`translation-index.ts` takes its
 * root from the declaration instead of `SITE_DIR`."*
 *
 * ## Why the id lookup, and not the path
 *
 * This layer declares **two** entries whose `path` is `docs/` — `docs`
 * (instance-scoped, resolving under `cat-harness/`) and `root-docs`
 * (`scope: "repository"`, resolving under the REPOSITORY root). They are
 * different directories wearing one path. {@link ownDirectoryById} excludes
 * the repository-scoped one, so this resolves to the layer's own.
 *
 * Everything here is instance-relative — `join(instanceRoot, SITE_DIR)` below,
 * and `INDEX_PATH` — so the absolute path the lookup returns is made relative
 * again rather than leaked.
 *
 * ## The comment this replaces was stale, and said the opposite
 *
 * It read: *"It is not in `cat-harness.json` because `docs/` would have to be
 * declared with the `folio` kind, which is registered by CORE rather than the
 * harness. Measured 2026-09-19: adding that entry broke `harness:dirs`,
 * `kg:schema:check` and `docs:harness:check` plus 9 tests."*
 *
 * Both entries are in `cat-harness.json` now, and the way they got there is the
 * point: they declare `graphTypologies: ["docs"]`, not `folio`. The measurement was
 * true — declaring `docs/` as `folio` DID break those three checks, because
 * `folio` is registered by core. The CONCLUSION drawn from it, that the
 * directory therefore could not be declared at all, was wrong: it needed a
 * different KIND, not the split to land first. A measurement of one option is
 * not a measurement of the question.
 */
const DECLARED_SITE_DIR = ownDirectoryById(REPO_ROOT, "docs", siteDirFor(REPO_ROOT));

export const SITE_DIR = relative(REPO_ROOT, DECLARED_SITE_DIR);

/** Where the generated index lands, relative to the layer root. */
export const INDEX_PATH = join(SITE_DIR, "_data", "translations.json");

/** The `$schema` tag the generated document carries, per the repo convention. */
export const INDEX_SCHEMA = "folio-translation-index/v1";

/** One translated page, as the navbar needs it. */
export interface TranslatedPage {
  /** Site-absolute URL of the translated page, e.g. `/fr/index.html`. */
  url: string;
  /** The translated page's own title — what the nav item should read. */
  title: string;
  /** `official` | `unverified` | `` — straight from the page's front matter. */
  status: string;
  /** `rtl` when the locale's script is right-to-left, else `ltr`. */
  dir: "ltr" | "rtl";
}

/** One source page and every translation of it. */
export interface IndexedPage {
  /** Site-absolute URL of the SOURCE page, e.g. `/` or `/guides/x.html`. */
  sourceUrl: string;
  /** The source page's own title, so a fallback item can be restored. */
  sourceTitle: string;
  /** locale -> the translated page. */
  translations: Record<string, TranslatedPage>;
}

/** The generated document. */
export interface TranslationIndex {
  $schema: string;
  /** The language the corpus is authored in. */
  sourceLocale: string;
  /** Every locale that has at least one page, sorted. */
  locales: string[];
  /** {@link pageKey} -> the source page and its translations. */
  pages: Record<string, IndexedPage>;
}

/**
 * A finding about the corpus.
 *
 * Three severities, and the split between the last two is the three-states
 * rule made operational:
 *
 * - `error` — the corpus says something wrong, and the fix is in the corpus.
 * - `unreadable` — the translation set for some page **cannot be determined**.
 *   Never written as an empty one; gates at exit 2.
 * - `note` — something could not be read that does not bear on the answer.
 *   Printed, never silent, and does not gate.
 *
 * `note` exists because "unreadable" has to mean something. Three generated
 * pages under `docs/reference/skill-instructions/` carry front matter that
 * strict YAML rejects (an unquoted `:` in a title, a leading backtick). None
 * of them is translated and none is a translation, so the index is exactly as
 * complete without them — escalating those would fail the build over a fact
 * the index does not depend on, and a gate that fires on irrelevancies is a
 * gate people start passing with `--no-verify`.
 */
export interface IndexFinding {
  /** Repo-relative path of the file or directory the finding is about. */
  where: string;
  severity: "error" | "unreadable" | "note";
  message: string;
}

export interface BuildResult {
  index: TranslationIndex;
  findings: IndexFinding[];
}

// ── URLs and keys ───────────────────────────────────────────────

/**
 * The key a source page and its translations are matched on.
 *
 * Jekyll serves one page at several spellings — `/`, `/x.html`, `/x/` — and
 * just-the-docs emits whichever `page.url` holds, under a `baseurl` this
 * module does not know. So both sides normalise to a bare path with no
 * extension, no `index`, and no slashes at either end, and the navbar applies
 * the SAME normalisation to an `href` at read time (`navKey` in docs-ui.js).
 *
 * Matching on the raw URL instead would work on this site and break on any
 * layer with a `baseurl` or a trailing-slash permalink style — which is the
 * platform-specific-literal failure `AGENTS.md` catalogues at length.
 */
export function pageKey(url: string): string {
  let k = url.trim();
  const q = k.search(/[?#]/);
  if (q >= 0) k = k.slice(0, q);
  k = k.replace(/^\/+/, "").replace(/\/+$/, "");
  k = k.replace(/\.html?$/i, "");
  k = k.replace(/(^|\/)index$/i, "");
  return k.replace(/^\/+|\/+$/g, "");
}

/**
 * The URL Jekyll will serve a page at.
 *
 * `permalink` wins when the page declares one — `docs/index.md` declares `/`,
 * and composing `/index.html` for it instead would key the home page under
 * something the nav never links to. Next, the `_config.yml` `defaults` entry
 * that covers the page, which is how cat-harness's docs-folder pages publish
 * under `/docs/cat-harness/` (bean `kc7k`) — pass them as `defaults`, read
 * with `permalinkDefaultsIn(site)`. Otherwise it is the default page
 * permalink style, `/:path/:basename.html`. The rule itself lives in
 * `scripts/lib/jekyll-permalink.ts`, so this and every other generator agree.
 */
export function pageUrl(
  relPathFromSite: string,
  frontMatter: Record<string, unknown>,
  defaults: readonly PermalinkDefault[] = [],
): string {
  return pagePermalink(relPathFromSite.split(sep).join("/"), frontMatter, defaults);
}

// ── Front matter ────────────────────────────────────────────────

/**
 * The YAML front matter of a Markdown page, or `undefined` when there is none.
 *
 * Throws on malformed YAML rather than returning `{}`: a page whose front
 * matter will not parse is a page whose `lang` cannot be read, and treating
 * that as "declares nothing" is how a French page ends up back in the navbar
 * under English — which is the whole bug.
 */
export function frontMatter(text: string): Record<string, unknown> | undefined {
  if (!text.startsWith("---")) return undefined;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return undefined;
  const body = text.slice(text.indexOf("\n") + 1, end + 1);
  const parsed = parseYaml(body);
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("front matter is not a mapping");
  }
  return parsed as Record<string, unknown>;
}

// ── The layer ────────────────────────────────────────────────

/** The layer's config (its index entry, else `<name>.config.json`), or `{}` when there is none. */
function harnessConfig(instanceRoot: string): Record<string, unknown> {
  const eff = readEffectiveConfig(instanceRoot);
  return eff.state === "ok" ? eff.config : {};
}

/** The layer's source language. `harness.config.json`, defaulting to `en`. */
export function sourceLocale(instanceRoot: string): string {
  const t = harnessConfig(instanceRoot).translation as { defaultLocale?: string } | undefined;
  return t?.defaultLocale ?? "en";
}

/**
 * Every locale this layer claims to support, INCLUDING the source language.
 *
 * `harness.config.json`'s `translation.supportedLocales`, defaulting to the six
 * UN languages — the same default `TranslationConfigSchema` declares, read from
 * the same constant rather than restated here.
 *
 * **The source locale is a member and that is the whole point.** Every count in
 * this pipeline used to be taken against the TARGET locales, so an English page
 * on a six-language site reported `0/5` — a denominator that silently excluded
 * the one language the page was certainly available in, and a numerator that
 * could never reach it because `availableLocales` resolves PO files and there is
 * no `translations/en/`. A reader was told a fully-authored page existed in none
 * of the languages. Issue #687, bean `czct`.
 */
export function supportedLocales(instanceRoot: string): string[] {
  const t = harnessConfig(instanceRoot).translation as
    | { supportedLocales?: unknown }
    | undefined;
  const declared = t?.supportedLocales;
  if (Array.isArray(declared) && declared.every((l) => typeof l === "string" && l.length > 0)) {
    return declared as string[];
  }
  return [...UN_LOCALES];
}

/**
 * The locales a translation is PRODUCED into — supported, minus the source.
 *
 * Distinct from {@link supportedLocales} and the two are not interchangeable:
 * this one answers "which `translations/<locale>/` directories can exist" and
 * is what a sweep iterates to look for PO files. It is never a denominator.
 * A count of how many languages a reader can read the page in is taken against
 * `supportedLocales`, because the source language is one of them.
 */
export function targetLocales(instanceRoot: string): string[] {
  const src = sourceLocale(instanceRoot);
  return supportedLocales(instanceRoot).filter((l) => l !== src);
}

/**
 * The locales a page is actually available in, source language included.
 *
 * `poLocales` is what {@link availableLocales} in `po-resolve.ts` returns — the
 * target locales holding a `.po` for this page — and the source locale is added
 * because the page exists in it by construction. Ordered by
 * {@link supportedLocales} so the badge and the language bar read in one order
 * across every page, and filtered by it so a stray `translations/<x>/` does not
 * inflate a count taken against a set that does not contain it.
 */
export function localesAvailableFor(
  instanceRoot: string,
  poLocales: readonly string[],
): string[] {
  const src = sourceLocale(instanceRoot);
  const have = new Set<string>([src, ...poLocales]);
  return supportedLocales(instanceRoot).filter((l) => have.has(l));
}

/**
 * The locales a reader can actually READ a page in — the same question
 * {@link localesAvailableFor} answers, asked of the RENDERED corpus instead of
 * the catalogue directory.
 *
 * `available_locales` is defined by `translation-manager.md` as *"which
 * languages can I read this page in"*. The catalogue is not that question. A
 * `.po` file is **intent to translate**; a rendered page is **availability**,
 * and the two come apart in both directions:
 *
 *   - `crdm-methodology` had `translations/fr/crdm-methodology.po` — 25 lines,
 *     one filled `msgstr`, its own header calling itself partial — and no
 *     French page anywhere. It published `availableLocales: ["en","fr"]` as
 *     JSON-LD, so the chain from *somebody started translating one block* to
 *     *this page is available in French* had no step in it that checked
 *     anything.
 *   - Five pages (`agentic-harness`, `beans-and-todos`, `document-ingestion`,
 *     `evidence`, `publication-workflow`) are rendered in all five target
 *     locales with no catalogue for any of them, and stamped `["en"]`. That is
 *     the same defect pointing the other way, and it is the more costly half:
 *     a reader's language bar hid five translations that exist.
 *
 * Both were one cause — availability inferred from `existsSync` on a `.po`.
 * Bean `9x01`.
 *
 * `sourceKey` is a {@link pageKey}, so the caller normalises once and this does
 * not have to know about `baseurl` or permalink style. An unknown key yields
 * the source locale alone, which is the honest answer for a page with no entry
 * in the index: it exists in the language it was written in, and nothing says
 * it exists in any other.
 *
 * This does **not** replace {@link localesAvailableFor}, and the difference is
 * not cosmetic. `translation-qa-sweep.ts` asks which locales have catalogue
 * material to QA — a question about `.po` files, correctly answered by the
 * catalogue — so it keeps using that one. Two callers, two questions.
 */
export function localesReadableFor(
  instanceRoot: string,
  index: TranslationIndex,
  sourceKey: string,
): string[] {
  const src = sourceLocale(instanceRoot);
  const entry = index.pages[sourceKey];
  const have = new Set<string>([src, ...Object.keys(entry?.translations ?? {})]);
  return supportedLocales(instanceRoot).filter((l) => have.has(l));
}

/** The layer's content type, which decides which formats are translatable. */
export function contentType(instanceRoot: string): string {
  const c = harnessConfig(instanceRoot).contentType;
  // No declared content type means a plain docs site: the `docs` profile this
  // harness declares itself (bean `0r7u`). It defaulted to `paper` until the
  // profiles moved to their owners, which left a standalone cat-harness with
  // no Markdown profile for its own translated site.
  return typeof c === "string" && c.length > 0 ? c : "docs";
}

/**
 * The Jekyll site directory, CONFIRMED rather than assumed.
 *
 * Returns `undefined` when `<root>/docs/_config.yml` is not there, and the
 * caller reports that as unreadable. Scanning a directory that turns out not
 * to be a Jekyll site would produce an empty index and publish it as "no
 * translations" — the `dh4f` shape, where a consumer scans nothing and reports
 * a clean run over it.
 */
export function siteRoot(instanceRoot: string): string | undefined {
  const abs = join(instanceRoot, SITE_DIR);
  return existsSync(join(abs, "_config.yml")) ? abs : undefined;
}

/**
 * The Jekyll site a layer DECLARES for itself — its own `docs` entry, else
 * its composed `siteDirFor` — confirmed by `_config.yml` as {@link siteRoot} is.
 *
 * {@link siteRoot} composes THIS layer's site path under whatever root it is
 * handed, which is right for this layer and its fixtures and wrong for
 * another layer whose site sits elsewhere. `--instance` asks this instead.
 * `undefined` when the layer has no declaration or no site there.
 */
export function instanceSiteRoot(instanceRoot: string): string | undefined {
  let abs: string;
  try {
    abs = ownDirectoryById(instanceRoot, "docs", siteDirFor(instanceRoot));
  } catch {
    return undefined;
  }
  return existsSync(join(abs, "_config.yml")) ? abs : undefined;
}

/** Where the index for a site is written: `<site>/_data/translations.json`. */
function indexPathFor(instanceRoot: string, siteDir?: string): string {
  return siteDir === undefined ? join(instanceRoot, INDEX_PATH) : join(siteDir, "_data", "translations.json");
}

/** Every file under `dir` whose extension is translatable for `type`, sorted. */
function translatablePages(root: string, type: string): string[] {
  const out: string[] = [];
  // Over the layer overlay (bean `cat-tools-sm8r`, item 4): a mounted layer's
  // generated pages are at its output root, so a directory is the union of
  // the output root's copy and the layer's own, each name once.
  const entries = (abs: string) => {
    const seen = new Map<string, import("node:fs").Dirent>();
    for (const d of overlayDirs(abs).length ? overlayDirs(abs) : [abs]) {
      for (const e of readdirSync(d, { withFileTypes: true })) if (!seen.has(e.name)) seen.set(e.name, e);
    }
    return [...seen.values()];
  };
  const walk = (abs: string): void => {
    for (const e of entries(abs).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const p = join(abs, e.name);
      // Jekyll's own machinery is not content: `_data`, `_includes`,
      // `_site`. A leading underscore is Jekyll's convention, not a guess
      // about language.
      if (e.isDirectory()) {
        if (!e.name.startsWith("_")) walk(p);
      } else if (e.isFile() && isTranslatable(type, extname(e.name).toLowerCase())) {
        out.push(relative(root, p));
      }
    }
  };
  walk(root);
  return out;
}

// ── Building ────────────────────────────────────────────────────

/**
 * Build the index from the pages' own front matter.
 *
 * Never throws for content reasons: a corpus problem comes back as a finding
 * so the caller can report every one of them, rather than the first.
 */
export function buildTranslationIndex(instanceRoot: string, siteDir?: string): BuildResult {
  const findings: IndexFinding[] = [];
  const src = sourceLocale(instanceRoot);
  const type = contentType(instanceRoot);
  const empty: TranslationIndex = { $schema: INDEX_SCHEMA, sourceLocale: src, locales: [], pages: {} };

  // `siteDir` names a docs directory that is not a Jekyll site of its own —
  // one a layer above the base renders into and the site build composes
  // under the layer's name (`gen-docs-pages.ts`). Named by the caller, so
  // it is checked to EXIST rather than for a `_config.yml` it never has.
  const site = siteDir !== undefined ? (existsSync(siteDir) ? siteDir : undefined) : siteRoot(instanceRoot);
  if (!site) {
    findings.push({
      where: `${SITE_DIR}/_config.yml`,
      severity: "unreadable",
      message:
        `no Jekyll site here, so the set of translated pages cannot be determined. ` +
        `Reported rather than indexed as "this folio has no translations": an absent site ` +
        `and a site with no translations are different answers, and only one of them is ` +
        `about the corpus.`,
    });
    return { index: empty, findings };
  }

  // One pass over every translatable page, sorting them into sources and
  // translations by what each one DECLARES. A page with no `lang` is source
  // language by default — `AGENTS.md`'s rule that absent means the layer's
  // default rather than unknown.
  interface Page {
    rel: string;
    fm: Record<string, unknown>;
    lang: string;
    url: string;
    title: string;
  }
  // The site's own permalink defaults: where a page is published is Jekyll's
  // answer, not the source path's (bean `kc7k`).
  const permalinks = permalinkDefaultsIn(site);
  const sources = new Map<string, Page>();
  const translations: Page[] = [];
  const unreadable = new Map<string, string>();

  let files: string[];
  try {
    files = translatablePages(site, type);
  } catch (e) {
    findings.push({
      where: SITE_DIR,
      severity: "unreadable",
      message: `could not be read: ${e instanceof Error ? e.message : String(e)}`,
    });
    return { index: empty, findings };
  }

  for (const rel of files) {
    let fm: Record<string, unknown> | undefined;
    try {
      fm = frontMatter(readFileSync(overlayPath(join(site, rel)), "utf-8"));
    } catch (e) {
      unreadable.set(rel.split(sep).join("/"), e instanceof Error ? e.message.split("\n")[0] : String(e));
      continue;
    }
    if (!fm) continue; // no front matter: not a Jekyll page at all.
    const lang = typeof fm.lang === "string" && fm.lang.length > 0 ? fm.lang : src;
    const page: Page = {
      rel,
      fm,
      lang,
      url: pageUrl(rel, fm, permalinks),
      title: typeof fm.title === "string" ? fm.title : rel,
    };
    if (lang === src) sources.set(pageKey(page.url), page);
    else translations.push(page);
  }

  const pages: Record<string, IndexedPage> = {};
  const locales = new Set<string>();

  for (const t of translations) {
    const where = `${SITE_DIR}/${t.rel.split(sep).join("/")}`;
    // `nav_exclude` is what keeps the page out of the STATIC nav. Without it
    // just-the-docs lists the translation beside its source and the locale
    // filter has nothing to remove — the entries are already rendered, for
    // every reader, whatever locale they chose. That IS the reported bug.
    if (t.fm.nav_exclude !== true) {
      findings.push({
        where,
        severity: "error",
        message:
          `declares \`lang: ${t.lang}\` but not \`nav_exclude: true\`, so just-the-docs ` +
          `renders it into the navbar for every reader whatever locale they selected. The ` +
          `locale filter swaps nav items; it cannot un-render one.`,
      });
      continue;
    }
    // A translated page has no nav position of its own: it stands where its
    // SOURCE stands, because it replaces that item rather than joining the
    // list. `nav_order` beside `nav_exclude` is two facts that contradict
    // each other, and a reader cannot tell which was meant.
    if (t.fm.nav_order !== undefined) {
      findings.push({
        where,
        severity: "error",
        message:
          `declares \`nav_order: ${String(t.fm.nav_order)}\` as well as \`nav_exclude\`. A ` +
          `translated page takes its source page's position, because it replaces that item ` +
          `rather than joining the list. Remove the \`nav_order\`.`,
      });
      continue;
    }
    const source = typeof t.fm.translation_source === "string" ? t.fm.translation_source : "";
    if (!source) {
      findings.push({
        where,
        severity: "error",
        message:
          `declares \`lang: ${t.lang}\` but no \`translation_source\`, so nothing says which ` +
          `page it translates — and the navbar has no item to put it in place of.`,
      });
      continue;
    }
    const sourceRel = source.split("/").join(sep);
    const sourceAbs = overlayPath(join(site, sourceRel));
    const why = unreadable.get(source);
    if (why !== undefined) {
      findings.push({
        where,
        severity: "unreadable",
        message:
          `translates ${SITE_DIR}/${source}, whose own front matter will not parse (${why}), ` +
          `so the URL this translation should replace cannot be determined. Reported rather ` +
          `than guessed: a wrong nav target is worse than a missing one.`,
      });
      continue;
    }
    if (!existsSync(sourceAbs)) {
      findings.push({
        where,
        severity: "error",
        message: `\`translation_source: ${source}\` names ${SITE_DIR}/${source}, which is not there.`,
      });
      continue;
    }
    let sfm: Record<string, unknown>;
    try {
      sfm = frontMatter(readFileSync(sourceAbs, "utf-8")) ?? {};
    } catch {
      sfm = {};
    }
    const key = pageKey(pageUrl(sourceRel, sfm, permalinks));
    const known = sources.get(key);
    if (!known) {
      findings.push({
        where,
        severity: "error",
        message:
          `\`translation_source: ${source}\` resolves to a page that is not in the source ` +
          `language (${src}). A translation of a translation has no item in the navbar to ` +
          `replace.`,
      });
      continue;
    }
    const entry = (pages[key] ??= {
      sourceUrl: known.url,
      sourceTitle: known.title,
      translations: {},
    });
    if (entry.translations[t.lang]) {
      findings.push({
        where,
        severity: "error",
        message:
          `is a second ${t.lang} translation of ${SITE_DIR}/${source}; the first was ` +
          `${entry.translations[t.lang].url}. One page cannot have two translations in one ` +
          `locale without something choosing between them.`,
      });
      continue;
    }
    locales.add(t.lang);
    entry.translations[t.lang] = {
      url: t.url,
      title: t.title,
      status: typeof t.fm.translation_status === "string" ? t.fm.translation_status : "",
      dir: localeIsRtl(t.lang) ? "rtl" : "ltr",
    };
  }

  // Reported, at a severity that does not gate. Silence here would be the
  // wrong kind of tidy: a page nobody can parse today is a page nobody can
  // translate tomorrow, and the reader of this output is the person who would
  // otherwise find that out the hard way.
  for (const [rel, why] of [...unreadable].sort(([a], [b]) => a.localeCompare(b))) {
    findings.push({
      where: `${SITE_DIR}/${rel}`,
      severity: "note",
      message:
        `front matter will not parse (${why}). Nothing translates this page and it is not ` +
        `itself a translation, so the index is complete without it — but it could not be ` +
        `translated as things stand.`,
    });
  }

  return {
    index: {
      $schema: INDEX_SCHEMA,
      sourceLocale: src,
      locales: [...locales].sort(),
      pages: Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b))),
    },
    findings,
  };
}

/** The document, serialised exactly as it is written, so `--check` compares like with like. */
export function serialise(index: TranslationIndex): string {
  return JSON.stringify(index, null, 2) + "\n";
}

/** Write the index. Returns whether the file changed. */
export function writeTranslationIndex(
  instanceRoot: string,
  index: TranslationIndex,
  siteDir?: string,
): boolean {
  // A mounted layer's index is computed output: read over the overlay,
  // written at its output root, never into the mount (bean `cat-tools-sm8r`).
  const p = writePathOf(indexPathFor(instanceRoot, siteDir));
  const next = serialise(index);
  const at = overlayPath(indexPathFor(instanceRoot, siteDir));
  const prev = existsSync(at) ? readFileSync(at, "utf-8") : null;
  if (prev === next) return false;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, next, "utf-8");
  return true;
}

/** `ok` | `stale` | `unreadable`, plus what to print. Exit codes: 0 / 1 / 2. */
export function checkTranslationIndex(instanceRoot: string, siteDir?: string): {
  state: "ok" | "stale" | "unreadable";
  findings: IndexFinding[];
  stalePath?: string;
} {
  const { index, findings } = buildTranslationIndex(instanceRoot, siteDir);
  if (findings.some((f) => f.severity === "unreadable")) {
    return { state: "unreadable", findings };
  }
  if (findings.some((f) => f.severity === "error")) return { state: "stale", findings };
  const p = indexPathFor(instanceRoot, siteDir);
  const at = overlayPath(p);
  const prev = existsSync(at) ? readFileSync(at, "utf-8") : null;
  if (prev !== serialise(index)) return { state: "stale", findings, stalePath: relative(instanceRoot, p) };
  return { state: "ok", findings };
}

// ── CLI ─────────────────────────────────────────────────────────

const LABEL: Record<IndexFinding["severity"], string> = {
  unreadable: "UNREADABLE",
  error: "ERROR     ",
  note: "note      ",
};

function report(findings: IndexFinding[]): void {
  for (const f of findings) {
    const line = `${LABEL[f.severity]}  ${f.where}\n    ${f.message}`;
    if (f.severity === "note") console.log(line);
    else console.error(line);
  }
}

if (import.meta.main) {
  // `--instance <dir>`: another layer, read through ITS declaration. Absent,
  // this layer as before.
  const explicit = explicitInstanceRoot();
  const root = explicit ?? REPO_ROOT;
  const site = explicit === undefined ? undefined : instanceSiteRoot(explicit);
  if (explicit !== undefined && site === undefined) {
    report([
      {
        where: explicit,
        severity: "unreadable",
        message:
          "this instance declares no Jekyll site (no `docs` directory with a `_config.yml`), so it " +
          "has published no translated page to index. Its catalogues are not pages: " +
          "`translation:status --instance` and `translation:obsolete:check --instance` read them.",
      },
    ]);
    process.exit(2);
  }
  const check = process.argv.includes("--check");
  if (check) {
    const r = checkTranslationIndex(root, site);
    report(r.findings);
    if (r.state === "unreadable") {
      console.error(
        "\nCould not determine the translation set. NOT written, and NOT reported as " +
          '"no translations" — an unreadable tree must never render as an empty one.',
      );
      process.exit(2);
    }
    if (r.state === "stale") {
      if (r.stalePath) console.error(`\n${r.stalePath} is stale. Run: bun run cat translation:index`);
      process.exit(1);
    }
    const n = Object.keys(buildTranslationIndex(root, site).index.pages).length;
    console.log(`translation index up to date — ${n} source page(s) with translations`);
  } else {
    const { index, findings } = buildTranslationIndex(root, site);
    report(findings);
    if (findings.some((f) => f.severity === "unreadable")) {
      console.error("\nRefusing to write a partial index over a complete one.");
      process.exit(2);
    }
    if (findings.some((f) => f.severity === "error")) process.exit(1);
    const changed = writeTranslationIndex(root, index, site);
    console.log(
      `${changed ? "Wrote" : "Unchanged"} ${relative(root, indexPathFor(root, site))} — ` +
        `${Object.keys(index.pages).length} source page(s), locales: ${index.locales.join(", ") || "(none)"}`,
    );
  }
}
