/**
 * A document site per declared locale (owner, option A, 2026-11-18: "turn on
 * translation for smart-ra … the site then publishes /fr/… pages").
 *
 * `build-document-site.ts` wrote only the source locale's pages, so a folio
 * that declares locales and holds translated `.po` catalogues got no `/fr/…`
 * page: the link 404'd, and the reader fell back to English without being
 * told. This module holds the pure half of the fix; the build wires it in.
 *
 * - **Which locales.** The folio's `translation.supportedLocales` in its
 *   harness config, minus its `defaultLocale`, and only when the folio
 *   declares `translation` at all. A declared locale gets a page only when at
 *   least one of the document's blocks is translated in it: a page that is
 *   all English under `/fr/` would claim a translation that does not exist.
 * - **Untranslated text is the source, marked.** A block the catalogues do
 *   not translate renders in the source language inside
 *   `<div class="fa-untranslated" lang="en">` with a visible
 *   "untranslated" mark, never silently English and never dropped, the policy
 *   the glossary's locale pages already follow.
 * - **How a reader moves between them.** Every page of a document that has a
 *   translation carries a language switcher (each link in its own language,
 *   with `hreflang`) and `<link rel="alternate" hreflang>` for every
 *   version, plus `x-default` for the source, the way IG sites publish
 *   their languages.
 *
 * @module scripts/document-locales
 */
import { splitBlocks } from "./build-document-site.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The folio's source locale and the locales it declares a translation into (source excluded, order kept, duplicates dropped). */
export function declaredLocales(translation: { defaultLocale?: string; supportedLocales?: readonly string[] } | undefined): { source: string; targets: string[] } {
  const source = translation?.defaultLocale ?? "en";
  if (translation === undefined) return { source, targets: [] };
  const targets = [...new Set(translation.supportedLocales ?? [])].filter((l) => l !== source && /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(l));
  return { source, targets };
}

/** Scripts written right to left, by primary language subtag. */
const RTL = new Set(["ar", "arc", "dv", "fa", "he", "ks", "ku", "ps", "sd", "ug", "ur", "yi"]);

/** `rtl` for a locale written right to left, else `ltr`. */
export function directionOf(locale: string): "rtl" | "ltr" {
  return RTL.has(locale.split("-")[0]!.toLowerCase()) ? "rtl" : "ltr";
}

/** A locale's name in its own language ("français", "العربية"), else the code. */
export function nativeName(locale: string): string {
  try {
    const n = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
    return n && n !== locale ? n : locale;
  } catch {
    return locale;
  }
}

/** Where a document's page is in `locale`: `<locale>/<slug>`. */
export function localePageDir(locale: string, slug: string): string {
  return `${locale}/${slug}`;
}

/**
 * The locale's Markdown with every block the catalogues left in the source
 * language wrapped and marked, and how many blocks are translated.
 *
 * A block is untranslated when its Markdown is byte-identical to the source
 * build's: `buildDocumentMarkdown` falls back to the source for every string a
 * catalogue does not translate, so identity is exactly "nothing in this
 * block was translated". The wrapper is a CommonMark HTML block with blank
 * lines inside it, so the Markdown inside is still Markdown.
 */
export function markUntranslated(
  localeMd: string,
  sourceMd: string,
  labels: ReadonlySet<string>,
  sourceLocale = "en",
): { markdown: string; translated: number; total: number } {
  const src = new Map(splitBlocks(sourceMd, new Set(labels)).blocks.map((b) => [b.label, b.markdown]));
  const blocks = splitBlocks(localeMd, new Set(labels)).blocks;
  let markdown = localeMd;
  let translated = 0;
  for (const b of blocks) {
    if (src.get(b.label) !== b.markdown) {
      translated++;
      continue;
    }
    const body = b.markdown.trimEnd();
    const at = markdown.indexOf(body);
    if (at < 0) continue;
    const wrapped =
      `<div class="fa-untranslated" lang="${esc(sourceLocale)}" dir="${directionOf(sourceLocale)}">\n\n` +
      `<p class="fa-untranslated-mark">(untranslated)</p>\n\n${body}\n\n</div>`;
    markdown = markdown.slice(0, at) + wrapped + markdown.slice(at + body.length);
  }
  return { markdown, translated, total: blocks.length };
}

/** Where each locale's pages are routed: its own code, except the source, which stays under the page locale. */
export type RouteOf = (locale: string) => string;
const own: RouteOf = (l) => l;

/** The relative link from one locale's page of a document to another's: both are `<route>/<slug>/`. */
function hrefTo(locale: string, slug: string, routeOf: RouteOf): string {
  return `../../${localePageDir(routeOf(locale), slug)}/index.html`;
}

/**
 * The language switcher on every version of a document: each version named
 * in its own language, linked with `hreflang`, the current one marked
 * `aria-current`. Empty when the document has one version.
 */
export function languageSwitcher(current: string, locales: readonly string[], slug: string, routeOf: RouteOf = own): string {
  if (locales.length < 2) return "";
  const items = locales.map((l) =>
    l === current
      ? `<li><a href="${esc(hrefTo(l, slug, routeOf))}" hreflang="${esc(l)}" lang="${esc(l)}" aria-current="page">${esc(nativeName(l))}</a></li>`
      : `<li><a href="${esc(hrefTo(l, slug, routeOf))}" hreflang="${esc(l)}" lang="${esc(l)}">${esc(nativeName(l))}</a></li>`,
  );
  return `<nav class="fa-lang-switch" aria-label="Language"><ul>${items.join("")}</ul></nav>\n`;
}

/** `<link rel="alternate" hreflang>` for every version, and `x-default` for the source. */
export function hreflangLinks(source: string, locales: readonly string[], slug: string, routeOf: RouteOf = own): string {
  if (locales.length < 2) return "";
  return [
    ...locales.map((l) => `<link rel="alternate" hreflang="${esc(l)}" href="${esc(hrefTo(l, slug, routeOf))}">`),
    `<link rel="alternate" hreflang="x-default" href="${esc(hrefTo(source, slug, routeOf))}">`,
  ].join("\n") + "\n";
}

/** The line at the top of a translated page: unofficial, and how much of it is translated. In the source language, and marked so. */
export function translationNote(sourceLocale: string, translated: number, total: number): string {
  return (
    `<p class="fa-translation-status" lang="${esc(sourceLocale)}" dir="${directionOf(sourceLocale)}">` +
    `Unofficial translation: ${translated} of ${total} blocks translated. Text not yet translated is shown in the source language, marked (untranslated).</p>\n`
  );
}

/** The styles the switcher and the marks need, in the page's own stylesheet. */
export const LOCALE_STYLE = `
  .fa-lang-switch ul { list-style: none; display: flex; flex-wrap: wrap; gap: .25rem .75rem; padding: 0; margin: .25rem 0 1rem; font-size: .9rem; }
  .fa-lang-switch a[aria-current="page"] { font-weight: 600; text-decoration: none; }
  .fa-untranslated { border-inline-start: 3px solid var(--muted, #888); padding-inline-start: .75rem; }
  .fa-untranslated-mark, .fa-translation-status { font-size: .85rem; color: var(--muted, #666); font-style: italic; }
`;
