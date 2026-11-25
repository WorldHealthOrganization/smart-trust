/**
 * Put each built page's OWN locale on its `<html>` element.
 *
 * The pinned remote theme emits `<html lang="{{ site.lang | default: 'en-US' }}">`
 * — `site.lang`, not `page.lang` — and no `dir`, so every translated page is
 * served as English (WCAG 3.1.1, Language of Page): a screen reader
 * mispronounces it and the browser picks the wrong fonts and hyphenation.
 *
 * ## A post-build pass, not a layout override
 *
 * As with `strip-preview-seo.ts`, a pass over the emitted tree couples to
 * nothing, where overriding the theme's layout would mean vendoring a file that
 * goes stale whenever the theme pin moves. A runtime JavaScript patch cannot
 * fix first paint or a reader with JavaScript off: the language has to be in
 * the served bytes.
 *
 * ## It reads the page's own declaration
 *
 * Every page already carries a `fa-translation-meta` JSON block — the pipeline
 * emits it and `docs-ui.js` reads it — whose `lang` is the page's own locale.
 * This pass reads that and rewrites the `<html>` tag (`lang`, and `dir` for
 * right-to-left locales). No index, no URL-to-file mapping, no knowledge of
 * the theme.
 *
 * A page with no meta block is LEFT ALONE and counted: rewriting a page that
 * has not declared a locale would be inventing one.
 *
 * Idempotent: a second run finds every tag already correct and writes nothing.
 *
 * `tools` is the graph typology this audits — the subject is the emitted site,
 * which is harness output rather than any folio's content.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/set-html-lang.ts --site ./_site
 *   bun run cat-harness-tools/scripts/set-html-lang.ts --site ./_site --check
 *
 * @covers tools
 * @graphNode tool
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Locales whose script runs right to left.
 *
 * The same four `docs-ui.js` lists. Kept as its own constant rather than inlined
 * so the two can be compared by name when one of them changes — and so the
 * reason a fifth locale is absent is a question somebody can ask of a named list.
 */
export const RTL_LOCALES: readonly string[] = ["ar", "he", "fa", "ur"];

/** What one page's pass did. */
export interface PageResult {
  /** The locale the page declared, or `null` when it declared none. */
  lang: string | null;
  /** True when the `<html>` tag needed changing. */
  changed: boolean;
  /** Why the page was skipped, when it was. */
  skipped?: "no-meta" | "unparseable-meta" | "no-html-tag";
}

export interface RunResult {
  /** Pages walked. */
  pages: number;
  /** Pages that declared a locale. */
  declared: number;
  /** Pages whose `<html>` tag was rewritten. */
  changed: number;
  /** Pages left alone because they declared no locale — the site's own pages. */
  noMeta: number;
  /** Pages whose meta block could not be read. Never folded into `noMeta`. */
  unreadable: string[];
  /** Pages that declared a locale and have no `<html>` tag to put it on. */
  noHtmlTag: string[];
}

/**
 * The locale a page declares about itself, or `null`.
 *
 * Read from the `fa-translation-meta` block rather than from the file's path. A
 * path says where a file sits; `lang` says what language it is in, and bean
 * `9rnf`'s whole lesson is that those are different questions.
 */
export function declaredLang(html: string): string | null | "unreadable" {
  const m = /<[^>]*\bid="fa-translation-meta"[^>]*>([\s\S]*?)<\//.exec(html);
  if (!m) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    return "unreadable";
  }
  const lang = (parsed as { lang?: unknown } | null)?.lang;
  return typeof lang === "string" && lang.length > 0 ? lang : null;
}

/**
 * Rewrite one page's `<html>` tag to carry `locale` (and `dir` when it is RTL).
 *
 * Returns the new text and whether anything changed, rather than writing — so the
 * counts are testable with no filesystem, and `--check` can report without
 * touching the tree. Same shape as `stripSeo`.
 *
 * **Only `lang` and `dir` are touched.** Any other attribute on the tag is
 * preserved as written: the theme may add its own, and a rewrite that reprinted
 * the tag would silently drop them.
 */
export function setLang(html: string, locale: string): { html: string; changed: boolean } {
  const rtl = RTL_LOCALES.includes(locale);
  const m = /<html\b([^>]*)>/i.exec(html);
  if (!m) return { html, changed: false };

  // **Compare the PRIMARY SUBTAG, and leave a tag that already agrees.** Measured
  // on the real built site: a naive "does the value equal the locale" test wanted
  // to rewrite **1317 of 1408** pages, because the theme emits `en-US` while every
  // page — source pages included — declares `lang: en`. Those two are the same
  // language, and `en-US` is the MORE specific of them: replacing it with `en`
  // would discard a region for no reader's benefit, on 1247 pages that have
  // nothing to do with this bean.
  //
  // So the rule is the one BCP 47 already implies: `en-US` satisfies a page that
  // declares `en`; `en-US` does not satisfy one that declares `zh`. A page whose
  // tag names the right language keeps whatever refinement it has.
  const current = /\blang\s*=\s*(["'])([^"']*)\1/i.exec(m[1])?.[2] ?? "";
  const sameLanguage =
    current.length > 0 && current.split("-")[0].toLowerCase() === locale.split("-")[0].toLowerCase();

  let attrs = m[1];
  // Replace the value in place when the attribute is there, so attribute ORDER
  // survives; append only when it is absent.
  if (!sameLanguage) {
    attrs = /\blang\s*=/i.test(attrs)
      ? attrs.replace(/\blang\s*=\s*(["'])[^"']*\1/i, `lang="${locale}"`)
      : `${attrs} lang="${locale}"`;
  }
  // `dir` is decided independently of the language check: a tag that already says
  // `ar` may still carry no direction, which is the half-corrected state the
  // runtime patch leaves behind on first paint.
  if (rtl) {
    attrs = /\bdir\s*=/i.test(attrs)
      ? attrs.replace(/\bdir\s*=\s*(["'])[^"']*\1/i, 'dir="rtl"')
      : `${attrs} dir="rtl"`;
  }
  // A left-to-right page gets NO `dir` rather than `dir="ltr"`: `ltr` is the
  // default, and writing it would put an attribute on 600-odd pages to say what
  // their absence already says.

  const tag = `<html${attrs}>`;
  if (tag === m[0]) return { html, changed: false };
  return { html: html.slice(0, m.index) + tag + html.slice(m.index + m[0].length), changed: true };
}

/** Every `.html` file under `dir`, depth-first. */
function htmlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue; // A broken symlink is not a page; skip rather than fail the build.
    }
    if (st.isDirectory()) found.push(...htmlFiles(path));
    else if (/\.html?$/i.test(entry)) found.push(path);
  }
  return found;
}

export interface RunOptions {
  /** The built site to walk — `_site` in the docs and staging workflows. */
  site: string;
  /** Report without writing. */
  check?: boolean;
}

/** Walk a built site, setting each declared locale on its page. */
export function run(opts: RunOptions): RunResult {
  const result: RunResult = {
    pages: 0,
    declared: 0,
    changed: 0,
    noMeta: 0,
    unreadable: [],
    noHtmlTag: [],
  };
  for (const file of htmlFiles(opts.site)) {
    result.pages++;
    const html = readFileSync(file, "utf-8");
    const lang = declaredLang(html);
    if (lang === "unreadable") {
      result.unreadable.push(file);
      continue;
    }
    if (lang === null) {
      result.noMeta++;
      continue;
    }
    result.declared++;
    if (!/<html\b[^>]*>/i.test(html)) {
      result.noHtmlTag.push(file);
      continue;
    }
    const { html: out, changed } = setLang(html, lang);
    if (!changed) continue;
    result.changed++;
    if (!opts.check) writeFileSync(file, out, "utf-8");
  }
  return result;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--site");
  const site = at >= 0 ? argv[at + 1] : undefined;
  const check = argv.includes("--check");
  if (!site) {
    console.error("set-html-lang: --site <dir> is required (the BUILT site, e.g. ./_site).");
    process.exit(2);
  }

  const r = run({ site, check });

  // A walk that found nothing is never reported as clean: an empty or wrong
  // `--site` looks exactly like a site with nothing to fix. The `dh4f` shape.
  if (r.pages === 0) {
    console.error(
      `set-html-lang: walked ${site} and found 0 HTML page(s) — refusing to call that done. ` +
        "Either the path is wrong or the site was not built.",
    );
    process.exit(2);
  }

  console.log(
    `set-html-lang: ${r.pages} page(s); ${r.declared} declare a locale; ` +
      `${r.changed} ${check ? "would be" : "were"} corrected; ${r.noMeta} declare none (left alone).`,
  );

  // Reported, never folded into the counts above — "could not read" is a third
  // state and not a quiet pass.
  for (const f of r.unreadable) console.error(`  ! ${f} — its fa-translation-meta block is unreadable`);
  for (const f of r.noHtmlTag) console.error(`  ! ${f} — declares a locale but has no <html> tag`);

  if (r.unreadable.length > 0 || r.noHtmlTag.length > 0) process.exit(2);

  if (check && r.changed > 0) {
    console.error(
      `\n✗ ${r.changed} page(s) carry a \`lang\` that is not their own. Run this script ` +
        "without `--check` in the build, before the deploy.",
    );
    process.exit(1);
  }
  process.exit(0);
}
