/**
 * Translated copies of an IG's narrative pages (fhir-harness#382).
 *
 * An IG keeps one gettext catalogue per page and locale at
 * `translations/<locale>/pagecontent/<page>.po`, extracted from
 * `input/pagecontent/<page>.md` by cat-harness-tools `extractMarkdown`. Until
 * this module, the IG site route read none of them: every page carried the
 * language picker with `availableLocales: []`, so each language other than
 * the source showed greyed out (owner, 2026-11-11: "why not translations?").
 *
 * Here each catalogue is injected into its page with cat-harness-tools
 * `injectMarkdown`, the same segmentation the catalogue was written from, and
 * the translated page is placed at `<locale>/<page>.md`. That is the path the
 * language picker opens (`docs-ui.js` `localePath`: `/<base>/<locale>/<file>`).
 *
 * A span with no translation (a fuzzy or empty entry, or English edited after
 * the catalogue was made) stays in English, as on every other folio site.
 *
 * Officiality is the platform's own record (`check:translation-officiality`):
 * a locale is `verified` only when `translations/<locale>/status.json` says
 * `official: true` with `signedOffBy` and `signedOffAt`. Otherwise the page is
 * `unverified`, and `docs-ui.js` shows its "Unverified translation" notice.
 *
 * @module scripts/ig-page-translations
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { injectMarkdown, parsePo } from "../../cat-harness-tools/pipeline/po-inject.ts";

/** The language picker's default list: the six UN languages, as `translation-meta.ts` declares them. */
export const UN_LOCALES = ["ar", "zh", "en", "fr", "ru", "es"] as const;

/** The source language of an IG's pages. */
export const SOURCE_LOCALE = "en";

/** One locale's catalogues for the IG's pages. */
export interface PageLocale {
  locale: string;
  /** `translations/<locale>`, where the locale's review records are read from. */
  dir: string;
  /** `verified` when the locale is signed off, `unverified` otherwise. */
  status: "verified" | "unverified";
  /** Page stem (`concepts`) to its parsed catalogue. Only catalogues with at least one translated entry. */
  catalogues: Map<string, Map<string, string>>;
}

/** Whether `translations/<locale>/status.json` records a sign-off. */
export function signedOff(dir: string): boolean {
  const p = join(dir, "status.json");
  if (!existsSync(p)) return false;
  try {
    const s = JSON.parse(readFileSync(p, "utf-8")) as { official?: unknown; signedOffBy?: unknown; signedOffAt?: unknown };
    return s.official === true && typeof s.signedOffBy === "string" && s.signedOffBy !== "" && typeof s.signedOffAt === "string" && s.signedOffAt !== "";
  } catch {
    return false;
  }
}

function readJson(p: string): Record<string, unknown> | undefined {
  if (!existsSync(p)) return undefined;
  try {
    const v: unknown = JSON.parse(readFileSync(p, "utf-8"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

const filled = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Whether a person reviewed one page's catalogue, and on what record. */
export interface PageReview {
  reviewed: boolean;
  /** The reviewer the record names, when reviewed. */
  by?: string;
  /** Why the page counts as reviewed or not, for a build report. */
  why: string;
}

/**
 * Whether a PERSON reviewed or adjudicated the translation of one page, read
 * from the two records the platform writes, and from nothing else:
 *
 * 1. the page's translation node, `translations/<locale>/pagecontent/<stem>.json`
 *    (`translation-node/v1`): `status.official` true, a reviewer
 *    (`signedOffBy`, `adjudicatedBy` or `reviewedBy`) and a time, not
 *    `flaggedForReview`, and a `sourceHash` that is a prefix of the sha-256
 *    of the page's CURRENT source;
 * 2. the locale's `status.json` as `translation_signoff` writes it, when its
 *    `sourceFile` is this page's source and its `sourceHash` matches it.
 *
 * It fails closed. No record, a record that names nobody, a record that
 * names no source hash, or one signed against an earlier source, is NOT
 * reviewed: an absent sign-off and a stale one read the same to a reader,
 * since neither says a person checked the words on the page. A locale-wide
 * sign-off that names no source file does not cover every page, because it
 * cannot show which page's words it saw.
 */
export function pageReview(l: Pick<PageLocale, "dir">, stem: string, sourceMd: string | undefined): PageReview {
  if (sourceMd === undefined) return { reviewed: false, why: "no source page to check a sign-off against" };
  return catalogueReview(l.dir, `pagecontent/${stem}`, sourceMd, `input/pagecontent/${stem}.md`);
}

/**
 * {@link pageReview} for any catalogue of a locale: its translation node is
 * `<dir>/<rel>.json`, and its source is `sourceText`. The locale's
 * `status.json` counts only when `sourceFile` is given and is the file it
 * names. Fails closed exactly as {@link pageReview} does.
 */
export function catalogueReview(dir: string, rel: string, sourceText: string, sourceFile?: string): PageReview {
  const full = createHash("sha256").update(sourceText).digest("hex");
  const current = (h: unknown): boolean => filled(h) && h.length >= 8 && full.startsWith(h.toLowerCase());
  let stale = false;
  const node = readJson(join(dir, `${rel}.json`));
  const st = node?.status && typeof node.status === "object" ? (node.status as Record<string, unknown>) : undefined;
  if (st?.official === true && st.flaggedForReview !== true) {
    const by = [st.signedOffBy, st.adjudicatedBy, st.reviewedBy].find(filled);
    const at = [st.signedOffAt, st.adjudicatedAt, st.reviewedAt].find(filled);
    if (by && at) {
      if (current(node!.sourceHash)) return { reviewed: true, by, why: `signed off by ${by} (catalogue record)` };
      stale = true;
    }
  }
  const s = readJson(join(dir, "status.json"));
  if (sourceFile && s && signedOff(dir) && s.flaggedForReview !== true && s.sourceFile === sourceFile) {
    if (current(s.sourceHash)) return { reviewed: true, by: s.signedOffBy as string, why: `signed off by ${s.signedOffBy as string} (locale record)` };
    stale = true;
  }
  return { reviewed: false, why: stale ? "signed off against an earlier source" : "no record that a person reviewed it" };
}

/**
 * Every locale under `translationsDir` with page catalogues, sorted. The
 * source locale is never one. A catalogue that translates nothing is left
 * out, so a page never claims a language it has no words in.
 */
export function pageLocales(translationsDir: string | undefined): PageLocale[] {
  if (!translationsDir || !existsSync(translationsDir)) return [];
  const out: PageLocale[] = [];
  for (const locale of readdirSync(translationsDir).sort()) {
    if (locale === SOURCE_LOCALE || !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(locale)) continue;
    const dir = join(translationsDir, locale);
    const pc = join(dir, "pagecontent");
    if (!statSync(dir).isDirectory() || !existsSync(pc)) continue;
    const catalogues = new Map<string, Map<string, string>>();
    for (const f of readdirSync(pc).filter((n) => n.endsWith(".po")).sort()) {
      const po = parsePo(readFileSync(join(pc, f), "utf-8"));
      if ([...po.values()].some((v) => v.trim() !== "")) catalogues.set(f.replace(/\.po$/, ""), po);
    }
    if (catalogues.size) out.push({ locale, dir, status: signedOff(dir) ? "verified" : "unverified", catalogues });
  }
  return out;
}

/** The locales a page can be read in: the source first, then each with a catalogue for it. */
export function localesFor(stem: string, locales: readonly PageLocale[]): string[] {
  return [SOURCE_LOCALE, ...locales.filter((l) => l.catalogues.has(stem)).map((l) => l.locale)];
}

/** One page translated: the Markdown and how many of its spans were. */
export function translatePage(sourceMd: string, catalogue: Map<string, string>): { md: string; translated: number; total: number } {
  const r = injectMarkdown(sourceMd, catalogue);
  return { md: r.translated, translated: r.stats.translatedSpans, total: r.stats.totalSpans };
}

const INCLUDE_RE = /\{%-?\s*include\s+([^\s%]+)\s*-?%\}/g;

/** The pages `md` includes by name (`{% include overview.md %}`), as stems of `pages`. */
export function includedPages(md: string, pages: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const m of md.matchAll(INCLUDE_RE)) {
    const stem = m[1]!.replace(/\.md$/, "");
    if (m[1]!.endsWith(".md") && pages.has(stem) && !out.includes(stem)) out.push(stem);
  }
  return out;
}

/**
 * Whether a page has anything in `locale`: its own catalogue, or one of a page
 * it includes. An IG's home page is often only includes
 * (`{% include overview.md %}`), with no string of its own.
 */
export function hasTranslation(stem: string, l: PageLocale, sourceOf: (stem: string) => string | undefined, pages: ReadonlySet<string>, seen = new Set<string>()): boolean {
  if (l.catalogues.has(stem)) return true;
  if (seen.has(stem)) return false;
  seen.add(stem);
  const md = sourceOf(stem);
  return md !== undefined && includedPages(md, pages).some((s) => hasTranslation(s, l, sourceOf, pages, seen));
}

/**
 * One page translated, with each page it includes inlined in the same
 * language. An included page left as `{% include x.md %}` would render the
 * English copy in `_includes/`, so a French home page would read English.
 * An included page with nothing in this locale stays an include (English).
 */
export function translateWithIncludes(
  stem: string,
  l: PageLocale,
  sourceOf: (stem: string) => string | undefined,
  pages: ReadonlySet<string>,
  depth = 0,
  mark?: UnreviewedMark,
): { md: string; translated: number; total: number; contributors: string[] } {
  const src = sourceOf(stem) ?? "";
  const own = l.catalogues.get(stem);
  const t = own ? translatePage(src, own) : { md: src, translated: 0, total: 0 };
  let { translated, total } = t;
  // The pages whose catalogue put words on this one: the review verdict is over all of them.
  const contributors = own && t.translated > 0 ? [stem] : [];
  if (depth >= 4) return { ...t, md: markUnreviewed(t.md, stem, contributors.length > 0, mark), contributors };
  const md = t.md.replace(INCLUDE_RE, (whole, name: string) => {
    const s = name.replace(/\.md$/, "");
    if (!name.endsWith(".md") || !pages.has(s) || s === stem || !hasTranslation(s, l, sourceOf, pages)) return whole;
    const inner = translateWithIncludes(s, l, sourceOf, pages, depth + 1, mark);
    translated += inner.translated;
    total += inner.total;
    for (const c of inner.contributors) if (!contributors.includes(c)) contributors.push(c);
    return inner.md.trim();
  });
  return { md: markUnreviewed(md, stem, own !== undefined && t.translated > 0, mark), translated, total, contributors };
}

/** Which page catalogues no person reviewed, and the label a marked block carries. */
export interface UnreviewedMark {
  unreviewed: (stem: string) => boolean;
  label: string;
}

/** The class of a block whose translation no person reviewed. */
export const UNREVIEWED_BLOCK_CLASS = "ig-tr-unreviewed";

/**
 * One catalogue's words on the page, fenced as unreviewed when no person
 * reviewed that catalogue. `markdown="1"` keeps kramdown reading the inside
 * as Markdown. Nested when a page includes another: each fence is the words
 * of one catalogue.
 */
function markUnreviewed(md: string, stem: string, contributed: boolean, mark: UnreviewedMark | undefined): string {
  if (!mark || !contributed || !mark.unreviewed(stem)) return md;
  return `\n<div class="${UNREVIEWED_BLOCK_CLASS}" data-tr-catalogue="${stem}" data-tr-label="${escAttr(mark.label)}" markdown="1">\n\n${md.trim()}\n\n</div>\n`;
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * The notice on a page with translated words no person reviewed, in the six
 * UN languages. These sentences are themselves not reviewed by a native
 * speaker; English is always shown beside them.
 */
export const UNREVIEWED_NOTICE: Readonly<Record<string, { title: string; body: string; link: string; block: string }>> = {
  en: {
    title: "Machine translation \u2014 not reviewed by a person",
    body: "This page was translated automatically. No person has reviewed or adjudicated this translation, and it may contain errors. The source-language page is the authoritative text.",
    link: "Read the original (English)",
    block: "Not reviewed by a person",
  },
  fr: {
    title: "Traduction automatique \u2014 non relue par une personne",
    body: "Cette page a été traduite automatiquement. Aucune personne n\u2019a relu ni validé cette traduction, qui peut contenir des erreurs. Seule la page dans la langue source fait foi.",
    link: "Lire l\u2019original (anglais)",
    block: "Non relu par une personne",
  },
  es: {
    title: "Traducción automática \u2014 no revisada por una persona",
    body: "Esta página se tradujo automáticamente. Ninguna persona ha revisado ni validado esta traducción, que puede contener errores. Solo la página en el idioma original es la de referencia.",
    link: "Leer el original (inglés)",
    block: "No revisado por una persona",
  },
  ru: {
    title: "Машинный перевод \u2014 не проверен человеком",
    body: "Эта страница переведена автоматически. Ни один человек не проверял и не утверждал этот перевод, поэтому он может содержать ошибки. Авторитетной является только страница на языке оригинала.",
    link: "Читать оригинал (английский)",
    block: "Не проверено человеком",
  },
  zh: {
    title: "机器翻译\u2014\u2014未经人工审校",
    body: "本页面为自动翻译。尚无任何人审校或裁定此译文，可能存在错误。以源语言页面为准。",
    link: "阅读原文（英文）",
    block: "未经人工审校",
  },
  ar: {
    title: "ترجمة آلية \u2014 لم يراجعها أي شخص",
    body: "تُرجمت هذه الصفحة آليًا. لم يراجع أي شخص هذه الترجمة أو يعتمدها، وقد تحتوي على أخطاء. الصفحة بلغة المصدر هي النص المرجعي.",
    link: "اقرأ النص الأصلي (بالإنجليزية)",
    block: "لم يراجعه أي شخص",
  },
};

/** The label a marked block carries in `locale`, English when the locale has none. */
export function unreviewedLabel(locale: string): string {
  return (UNREVIEWED_NOTICE[locale] ?? UNREVIEWED_NOTICE[SOURCE_LOCALE]!).block;
}

function noticeHtml(locale: string, href: string): string {
  const n = UNREVIEWED_NOTICE[locale]!;
  return [
    `<div class="ig-tr-notice__lang" lang="${locale}" dir="${dirFor(locale)}">`,
    `<p class="ig-tr-notice__title"><span aria-hidden="true">\u26A0\uFE0F</span> <strong>${n.title}</strong></p>`,
    `<p class="ig-tr-notice__body">${n.body} <a class="ig-tr-notice__source" href="${href}">${n.link}</a></p>`,
    "</div>",
  ].join("");
}

/**
 * The full-width notice the thin layout puts at the top of every translated
 * page that has words no person reviewed (`page.translation_reviewed` is not
 * `true`: absent counts as unreviewed). In the page's language, then in
 * English, linking to the source page. It carries `fa-translation-warning` so
 * `docs-ui.js` does not add its one-line notice beside it.
 */
export function unreviewedNoticeLiquid(o: { inlineStyle?: boolean } = {}): string {
  const href = "../{{ page.translation_source }}";
  const others = Object.keys(UNREVIEWED_NOTICE).filter((k) => k !== SOURCE_LOCALE);
  return [
    "{% if page.translation_source and page.translation_reviewed != true %}",
    // A layout that links `ig-artifact.css` gets these rules from it (owner,
    // 2026-11-13: the IG's one stylesheet); one that links none inlines them.
    ...(o.inlineStyle === false ? [] : [`<style>${UNREVIEWED_NOTICE_CSS}</style>`]),
    '<div class="ig-tr-notice fa-translation-warning" role="note" aria-label="Machine translation, not reviewed by a person">',
    "{% case page.lang %}",
    ...others.map((k) => `{% when "${k}" %}${noticeHtml(k, href)}`),
    "{% endcase %}",
    noticeHtml(SOURCE_LOCALE, href),
    "</div>",
    "{% endif %}",
  ].join("");
}

const LANG_FRAGMENT_RE = /\{%-?\s*lang-fragment\s+([^\s%]+)\s*-?%\}/g;

/** A fragment's name in one locale, as the IG Publisher names it: `x.html` → `x-fr.html`. */
export function fragmentFor(name: string, locale: string): string {
  const slash = name.lastIndexOf("/");
  const dot = name.lastIndexOf(".");
  return dot > slash + 1 ? `${name.slice(0, dot)}-${locale}${name.slice(dot)}` : `${name}-${locale}`;
}

/**
 * The HL7 IG Publisher's `{% lang-fragment x %}` as a plain include: on a page
 * in `locale`, the locale's own fragment (`x-<locale>.<ext>`) when the IG has
 * one, otherwise `x` itself, so a page in a language with no fragment reads
 * the source's (owner, 2026-11-13: "translate ... the cards"). With no locale
 * (the source page), always `x`.
 */
export function resolveLangFragments(md: string, locale: string | undefined, has: (name: string) => boolean): string {
  return md.replace(LANG_FRAGMENT_RE, (_w, name: string) => {
    const own = locale ? fragmentFor(name, locale) : undefined;
    return `{% include ${own && has(own) ? own : name} %}`;
  });
}

const SKIP_URL = /^(?:[a-z][a-z0-9+.-]*:|\/|#|\{\{|\{%|\.\.\/)/i;

/**
 * Point a translated page's relative links one level up, since it sits at
 * `<locale>/<page>`. A link to another page translated into the same locale
 * (`translatedHere`, the `.html` names) stays relative, so a reader keeps
 * their language as they move between pages. Absolute, site-rooted, Liquid,
 * anchor-only and already-parent links are left as written.
 */
export function relinkForLocale(md: string, translatedHere: ReadonlySet<string>): string {
  const fix = (url: string): string => {
    if (!url || SKIP_URL.test(url)) return url;
    const file = url.replace(/^\.\//, "").split(/[?#]/)[0]!;
    if (translatedHere.has(file)) return url;
    return `../${url.replace(/^\.\//, "")}`;
  };
  return md
    // Markdown links and images: ](target) or ](target "title")
    .replace(/\]\(\s*<?([^)\s>]+)>?((?:\s+"[^"]*")?)\s*\)/g, (_w, url: string, title: string) => `](${fix(url)}${title})`)
    // Reference definitions: [id]: target
    .replace(/^(\s{0,3}\[[^\]]+\]:\s*)(\S+)/gm, (_w, pre: string, url: string) => `${pre}${fix(url)}`)
    // HTML attributes
    .replace(/\b(href|src)=(["'])([^"']*)\2/g, (_w, attr: string, q: string, url: string) => `${attr}=${q}${fix(url)}${q}`);
}

/**
 * The front matter keys the language picker reads (`fa-translation-meta`):
 * the page's language, the locales it can be read in, and on a translation
 * its status and source page.
 */
export function localeFrontMatter(o: { lang: string; available: readonly string[]; status?: string; source?: string; supported?: readonly string[]; reviewed?: boolean }): Record<string, unknown> {
  return {
    lang: o.lang,
    available_locales: [...o.available],
    supported_locales: [...(o.supported ?? UN_LOCALES)],
    ...(o.status ? { translation_status: o.status } : {}),
    ...(o.source ? { translation_source: o.source } : {}),
    // Only ever `true` when a record says a person reviewed every catalogue on the page.
    ...(o.source ? { translation_reviewed: o.reviewed === true } : {}),
  };
}

/**
 * The picker's block, written by the thin layout from the page's front
 * matter, so a page that has translations names them. A page without
 * `available_locales` gets nothing here and keeps the block
 * `publisher-pages` stamps (`stampTranslationMeta`).
 */
export const TRANSLATION_META_LIQUID = [
  "{% if page.available_locales %}",
  '<script type="application/json" id="fa-translation-meta">{"lang":{{ page.lang | default: "en" | jsonify }},',
  '"translationStatus":{{ page.translation_status | default: "" | jsonify }},',
  '"translationSource":{{ page.translation_source | default: "" | jsonify }},',
  '"supportedLocales":{{ page.supported_locales | jsonify }},',
  '"availableLocales":{{ page.available_locales | jsonify }}}</script>',
  "{% endif %}",
].join("");

/** Right-to-left scripts among the locales an IG may carry. */
const RTL = new Set(["ar", "he", "fa", "ur"]);

/** `rtl` for a right-to-left locale, else `ltr`. */
export function dirFor(locale: string): "rtl" | "ltr" {
  return RTL.has(locale.split("-")[0]!) ? "rtl" : "ltr";
}

/**
 * The notice's and the marked blocks' styles. The thin layout reads them from
 * `templates/ig-pages/ig-artifact.css`, the IG's one stylesheet (owner,
 * 2026-11-13), which carries this string verbatim; a test holds the two
 * equal. The layout that links no `ig-artifact.css` inlines them. The compound
 * selector outranks `docs-ui.css`'s one-line `.fa-translation-warning`.
 */
export const UNREVIEWED_NOTICE_CSS = [
  ".ig-tr-notice.fa-translation-warning{display:block;box-sizing:border-box;width:100%;margin:0 0 1.5rem;padding:1rem 1.25rem;",
  "background:#fff3cd;color:#3b2a00;border:3px solid #b45309;border-inline-start-width:12px;border-radius:6px;font-size:1rem;line-height:1.5}",
  ".ig-tr-notice p{margin:0 0 .35rem}",
  ".ig-tr-notice__title{font-size:1.25rem}",
  ".ig-tr-notice__lang+.ig-tr-notice__lang{margin-top:.75rem;padding-top:.75rem;border-top:1px solid #b45309;font-size:.95rem}",
  ".ig-tr-notice__source{color:#7c2d12;font-weight:700;text-decoration:underline}",
  `.${UNREVIEWED_BLOCK_CLASS}{border-inline-start:4px dashed #b45309;padding-inline-start:.85rem;margin:1rem 0}`,
  `.${UNREVIEWED_BLOCK_CLASS}::before{content:"\\26A0\\FE0F  " attr(data-tr-label);display:inline-block;margin-bottom:.4rem;padding:.1rem .5rem;`,
  "font-size:.8rem;font-weight:700;background:#fff3cd;color:#3b2a00;border:1px solid #b45309;border-radius:4px}",
  "@media (prefers-color-scheme:dark){.ig-tr-notice.fa-translation-warning{background:#3b2a00;color:#ffe8a3;border-color:#f59e0b}",
  ".ig-tr-notice__source{color:#fcd34d}",
  `.${UNREVIEWED_BLOCK_CLASS}{border-inline-start-color:#f59e0b}.${UNREVIEWED_BLOCK_CLASS}::before{background:#3b2a00;color:#ffe8a3;border-color:#f59e0b}}`,
].join("");
