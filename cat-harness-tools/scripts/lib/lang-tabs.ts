/**
 * The language tabs a built page will draw, and where each one links — read
 * from the page's HTML the way the site chrome reads it in the browser.
 *
 * The tabs (`a.fa-page-lang-tab`, `a.fa-lang-tab`) are drawn by cat-harness's
 * `site-chrome/assets/js/docs-ui.js` at load time, so they are not in the
 * built HTML and the publish link check never saw them. Owner, 2026-11-13:
 * a layer home's tabs linked `/<layer>/fr/` (and ar, zh, ru, es), all
 * 404, while the page's own `hreflang` alternates named the translations that
 * exist. This module repeats the chrome's rule so `checkLinks` can hold the
 * tabs to the same standard as every other link:
 *
 *  - only a locale the page's `fa-translation-meta` block declares available
 *    (or its own `lang`), within its `supportedLocales`, gets a link;
 *  - its href is the page's declared `<link rel="alternate" hreflang>` for
 *    that locale when it has one (`declaredAlternates` in docs-ui.js),
 *  - else the `/<locale>/` sibling: a translated page swaps its own locale
 *    segment (`siblingPath`), an English page inserts one (`localePath`).
 *
 * Change one, change the other: `scripts/tests/lang-tabs.test.ts` pins this
 * side of the rule.
 *
 * @module scripts/lib/lang-tabs
 */

/** The fallback when a page declares no `supportedLocales` (`UN_LOCALES` in docs-ui.js). */
export const UN_LOCALES = ["ar", "zh", "en", "fr", "ru", "es"] as const;

/** One tab that will be a link: its locale, and the href the chrome gives it. */
export interface LangTab {
  locale: string;
  /** As written: a page-relative alternate, or a root-absolute convention path. */
  href: string;
  /** Where the href came from. */
  from: "alternate" | "convention";
}

interface Meta {
  lang?: string;
  supportedLocales?: string[];
  availableLocales?: string[];
}

/** `localePath` in docs-ui.js. */
export function localePath(basePath: string, locale: string): string {
  if (locale === "en") return basePath;
  const parts = basePath.split("/");
  const filename = parts.pop();
  return `${parts.join("/")}/${locale}/${filename}`;
}

/** `deriveBasePath` in docs-ui.js. */
export function deriveBasePath(path: string, currentLang: string): string {
  if (currentLang === "en") return path;
  return path.replace(new RegExp(`/${currentLang}/`), "/");
}

/**
 * The convention path for `locale`, from a page at `pagePath` in `current`:
 * a translated page swaps its own locale segment wherever it sits (`/r/fr/x/`
 * as well as `/r/x/fr/a.html`); otherwise `localePath` of the English path.
 * `translationHref` in docs-ui.js.
 */
export function siblingPath(pagePath: string, basePath: string, current: string, locale: string): string {
  const seg = `/${current}/`;
  if (current !== "en" && locale !== "en" && pagePath.includes(seg)) return pagePath.replace(seg, `/${locale}/`);
  return localePath(basePath, locale);
}

/** The page's meta block and its declared html alternates, read by an HTML parser. */
async function readPage(html: string): Promise<{ meta: Meta | null; alternates: Map<string, string> }> {
  let metaText: string | null = null;
  let inMeta = false;
  const alternates = new Map<string, string>();
  await new HTMLRewriter()
    .on('script#fa-translation-meta', {
      element(el) {
        if (metaText !== null) return;
        metaText = "";
        inMeta = true;
        el.onEndTag(() => {
          inMeta = false;
        });
      },
      text(t) {
        if (inMeta) metaText += t.text;
      },
    })
    .on("link[hreflang]", {
      element(el) {
        const rel = (el.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
        if (!rel.includes("alternate")) return;
        const type = el.getAttribute("type");
        if (type && type !== "text/html") return;
        const href = el.getAttribute("href");
        const lang = (el.getAttribute("hreflang") ?? "").toLowerCase();
        if (!href || !lang) return;
        if (!alternates.has(lang)) alternates.set(lang, href);
        const primary = lang.split("-")[0]!;
        if (!alternates.has(primary)) alternates.set(primary, href);
      },
    })
    .transform(new Response(html))
    .text();
  let meta: Meta | null = null;
  if (metaText !== null) {
    try {
      meta = JSON.parse(metaText) as Meta;
    } catch {
      meta = null;
    }
  }
  return { meta, alternates };
}

/**
 * The tabs `html` will draw as links, other than the page's own language.
 * `pagePath` is the page's root-absolute URL path (`/repo/dir/page.html`);
 * a page with no `fa-translation-meta` block draws no tabs.
 */
export async function langTabs(html: string, pagePath: string): Promise<LangTab[]> {
  const { meta, alternates } = await readPage(html);
  if (!meta) return [];
  const current = meta.lang || "en";
  const supported = meta.supportedLocales ?? [...UN_LOCALES];
  const have = new Set([current, ...(meta.availableLocales ?? [])]);
  const basePath = deriveBasePath(pagePath, current);
  const out: LangTab[] = [];
  for (const loc of supported) {
    if (!have.has(loc) || loc === current) continue;
    const alt = alternates.get(loc);
    out.push(alt ? { locale: loc, href: alt, from: "alternate" } : { locale: loc, href: siblingPath(pagePath, basePath, current, loc), from: "convention" });
  }
  return out;
}
