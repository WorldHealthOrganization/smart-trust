/**
 * The journeys viewer in every language a layer has a catalogue for.
 *
 * @module scripts/journeys/locales
 * @covers user-scenario, workshop, device-screen
 *
 * The viewer draws its pages in English (`render.ts`, `present.ts`); this
 * module turns that one rendering into one per locale. A page's words come
 * from many places at once (the layer's journeys, workshops, personas and
 * device screens, its ArchiMate model, the viewer's own labels), so the
 * catalogue is taken from the rendered pages with `pipeline/html-po.ts`
 * rather than from each source: one template, `translations/<locale>/journeys-viewer.pot`
 * in the declaring layer, covers every word a reader of the viewer sees.
 *
 * | file | what |
 * |---|---|
 * | `translations/<locale>/journeys-viewer.pot` | written by `journeys:viz --pot`; one per locale, the same msgids |
 * | `translations/<locale>/journeys-viewer.po` | the translation; a locale is drawn when it exists |
 *
 * The words the viewer's scripts write at run time (a timer's "Stop", a
 * "Copied") are in the template too: each is written `T("…")` in
 * `assets/*.js`, and a translated page carries its catalogue for them in
 * `<script type="application/json" id="jv-i18n">`. The JSON models the scripts
 * read (the gap report, the lab summary) have their `label`, `title`,
 * `theme`, `question` and `text` values translated the same way.
 *
 * A string with no translation stays English; a translation whose
 * placeholders do not match its `msgid` is not used (`InjectResult.rejected`).
 * Every page, English included, names its other languages with
 * `<link rel="alternate" hreflang>` and the site chrome's
 * `fa-translation-meta` block, so the site's language picker and the
 * presentation frame's own language links (`<!--jv-langs-->`) go to the
 * same page in another language. A journey page, in the site's chrome, has no
 * links of its own: the site's picker is the one (owner, 2026-11-17); only the
 * presentation frame, which opts out of the chrome, draws them. Translations are agent-made unless a
 * layer says otherwise: the pages say `unverified`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { extractHtml, injectHtml } from "../../pipeline/html-po.ts";
import { extractSvgLabels, injectSvgLabels } from "../../pipeline/svg-label-po.ts";
import { formatPot, potQuote, type PotEntry } from "../../pipeline/pot-extract.ts";
import { parsePo, parsePoEntries } from "../../pipeline/po-inject.ts";
import { TRANSLATION_META_ID } from "../lib/translation-meta.ts";
import type { PageFile } from "./render.ts";

/** The catalogue's file stem under `translations/<locale>/`. */
export const CATALOGUE_STEM = "journeys-viewer";
/** The marker a page leaves where its own language links go. */
export const LANGS_MARK = "<!--jv-langs-->";
/** JSON keys whose string values a reader sees, in the models the scripts read. */
const JSON_TEXT_KEYS = new Set(["label", "title", "theme", "question", "text", "hint", "group", "description"]);
/** What each locale is called in itself, for the language links. */
const ENDONYM: Record<string, string> = { ar: "العربية", en: "English", es: "Español", fr: "Français", ru: "Русский", zh: "中文" };

const ASSET_DIR = join(import.meta.dir, "assets");

/** Every `T("…")` string in the viewer's scripts: the words they write at run time. */
export function runtimeStrings(): { msgid: string; source: string }[] {
  const out: { msgid: string; source: string }[] = [];
  for (const f of readdirSync(ASSET_DIR).filter((n) => n.endsWith(".js")).sort()) {
    const src = readFileSync(join(ASSET_DIR, f), "utf8");
    for (const m of src.matchAll(/\bT\("((?:[^"\\]|\\.)*)"\)/g)) out.push({ msgid: JSON.parse(`"${m[1]}"`) as string, source: `assets/${f}` });
  }
  return out;
}

function jsonScripts(html: string): string[] {
  return [...html.matchAll(/<script type="application\/json"(?![^>]*id="(?:jv-i18n|fa-translation-meta)")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function jsonTexts(v: unknown, out: string[], key?: string): void {
  if (typeof v === "string") {
    if (key !== undefined && JSON_TEXT_KEYS.has(key) && /\p{L}/u.test(v)) out.push(v.trim());
  } else if (Array.isArray(v)) for (const x of v) jsonTexts(x, out, key);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) jsonTexts(x, out, k);
}

function translateJson(v: unknown, cat: ReadonlyMap<string, string>, key?: string): unknown {
  if (typeof v === "string") return key !== undefined && JSON_TEXT_KEYS.has(key) ? (cat.get(v.trim()) ?? v) : v;
  if (Array.isArray(v)) return v.map((x) => translateJson(x, cat, key));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, translateJson(x, cat, k)]));
  return v;
}

const isPage = (f: PageFile): f is PageFile & { content: string } => f.path.endsWith(".html") && typeof f.content === "string";

/** The template's entries: every page's segments, then the scripts' strings; each msgid once, at its first page. */
export function potEntries(files: readonly PageFile[]): PotEntry[] {
  const seen = new Set<string>();
  const out: PotEntry[] = [];
  const add = (msgid: string, source: string) => {
    if (seen.has(msgid)) return;
    seen.add(msgid);
    out.push({ source, line: 0, msgid, kind: "html-text" });
  };
  for (const f of [...files].filter(isPage).sort((a, b) => a.path.localeCompare(b.path))) {
    for (const m of extractHtml(f.content)) add(m, f.path);
    for (const m of extractSvgLabels(f.content)) add(m, f.path);
    for (const j of jsonScripts(f.content)) {
      const texts: string[] = [];
      try {
        jsonTexts(JSON.parse(j), texts);
      } catch {
        continue;
      }
      for (const t of texts) add(t, f.path);
    }
  }
  for (const r of runtimeStrings()) add(r.msgid, r.source);
  return out;
}

export function formatJourneysPot(files: readonly PageFile[], locale: string, project: string): string {
  return formatPot(potEntries(files), { projectName: `${project} journeys viewer`, locale });
}

/** The locales the layer at `root` has a catalogue for, in `supported` order. */
export function catalogueLocales(root: string, supported: readonly string[], translationDir = "translations"): string[] {
  return supported.filter((l) => existsSync(join(root, translationDir, l, `${CATALOGUE_STEM}.po`)));
}

export function readCatalogue(root: string, locale: string, translationDir = "translations"): Map<string, string> {
  return parsePo(readFileSync(join(root, translationDir, locale, `${CATALOGUE_STEM}.po`), "utf8"));
}

function poFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? poFiles(p) : n.endsWith(".po") && n !== `${CATALOGUE_STEM}.po` ? [p] : [];
    });
}

/**
 * What the layer has already translated into `locale`, in its other
 * catalogues: the page, process, scenario and glossary `.po`s under
 * `translations/<locale>/`. A msgid matched exactly, so the viewer says what
 * the IG page and the BPMN drawing say.
 */
export function translationMemory(root: string, locale: string, translationDir = "translations"): Map<string, string> {
  const tm = new Map<string, string>();
  for (const f of poFiles(join(root, translationDir, locale))) {
    for (const [k, v] of parsePo(readFileSync(f, "utf8"))) if (!k.includes("\x04") && !tm.has(k)) tm.set(k, v);
  }
  return tm;
}

/**
 * The catalogue for `locale` brought up to the template: every msgid of
 * `pot` once, its translation kept from `po` (or, when it has none, taken
 * from `memory`), and an entry the template no longer has dropped. Returns
 * the new `.po` text and how many entries were filled from memory.
 */
export function mergeCatalogue(pot: string, po: string | undefined, memory: ReadonlyMap<string, string>): { text: string; fromMemory: number; translated: number; total: number } {
  const have = po === undefined ? new Map<string, string>() : new Map(parsePoEntries(po).filter((e) => !e.flags.includes("fuzzy")).map((e) => [e.msgid, e.msgstr] as const));
  let fromMemory = 0;
  let translated = 0;
  let total = 0;
  const blocks = pot.split(/\n{2,}/).map((block) => {
    const entry = parsePoEntries(block)[0];
    if (!entry || !/^msgstr ""$/m.test(block)) return block;
    total++;
    let t = have.get(entry.msgid) || "";
    if (!t && memory.get(entry.msgid)) {
      t = memory.get(entry.msgid)!;
      fromMemory++;
    }
    if (t) translated++;
    return t ? block.replace(/^msgstr ""$/m, `msgstr ${potQuote(t)}`) : block;
  });
  return { text: blocks.join("\n\n"), fromMemory, translated, total };
}

/** The relative href from page `from` (site-relative) to page `to`. */
export function relHref(from: string, to: string): string {
  const up = from.split("/").length - 1;
  return "../".repeat(up) + to.replace(/index\.html$/, "");
}

/** `path` (site-relative, starting with the locale segment) in `locale`. */
export function inLocale(path: string, locale: string): string {
  return path.replace(/^[^/]+\//, `${locale}/`);
}

/** A page's language links, alternates and translation block, for the locale it is in. */
export function withLanguages(html: string, path: string, locale: string, locales: readonly string[], source: string): string {
  const others = locales.filter((l) => l !== locale);
  const alternates = locales.map((l) => `<link rel="alternate" hreflang="${l}" href="${relHref(path, inLocale(path, l))}">`).join("");
  const meta = {
    lang: locale,
    translationStatus: locale === source ? "" : "unverified",
    translationSource: locale === source ? "" : source,
    supportedLocales: locales,
    availableLocales: locales,
  };
  const block = `<script type="application/json" id="${TRANSLATION_META_ID}">${JSON.stringify(meta)}</script>`;
  let out = html.replace(/<\/head>/i, `${alternates}${html.includes(`id="${TRANSLATION_META_ID}"`) ? "" : block}</head>`);
  const links = others.length
    ? `<nav class="jv-langs" aria-label="Languages">${locales
        .map((l) => (l === locale ? `<span lang="${l}" aria-current="true" translate="no">${ENDONYM[l] ?? l}</span>` : `<a lang="${l}" hreflang="${l}" href="${relHref(path, inLocale(path, l))}" translate="no">${ENDONYM[l] ?? l}</a>`))
        .join("")}</nav>`
    : "";
  out = out.split(LANGS_MARK).join(links);
  return out;
}

export interface LocaleReport {
  locale: string;
  pages: number;
  translated: number;
  untranslated: number;
  rejected: string[];
}

/**
 * The viewer's files in every locale: the English files with their language
 * links, then a translated copy of every file per catalogue, at the same path
 * under `<locale>/`. `files` are site-relative and start with the source
 * locale's segment (`visualiserRoute` with `DEFAULT_LOCALE`).
 */
export function localizedFiles(
  files: readonly PageFile[],
  catalogues: ReadonlyMap<string, ReadonlyMap<string, string>>,
  source = "en",
): { files: PageFile[]; reports: LocaleReport[] } {
  const locales = [source, ...catalogues.keys()];
  const out: PageFile[] = files.map((f) => (isPage(f) ? { ...f, content: withLanguages(f.content, f.path, source, locales, source) } : f));
  const reports: LocaleReport[] = [];
  const runtime = runtimeStrings().map((r) => r.msgid);
  for (const [locale, cat] of catalogues) {
    const report: LocaleReport = { locale, pages: 0, translated: 0, untranslated: 0, rejected: [] };
    const i18n: Record<string, string> = {};
    for (const s of runtime) {
      const t = cat.get(s);
      if (t) i18n[s] = t;
    }
    const i18nBlock = `<script type="application/json" id="jv-i18n">${JSON.stringify(i18n).replace(/</g, "\\u003c")}</script>`;
    for (const f of files) {
      const path = inLocale(f.path, locale);
      if (!isPage(f)) {
        out.push({ path, content: f.content });
        continue;
      }
      const r = injectHtml(f.content, cat, locale);
      const sv = injectSvgLabels(r.html, cat);
      report.pages++;
      report.translated += r.translated + sv.translated;
      report.untranslated += r.untranslated.length + sv.untranslated.length;
      report.rejected.push(...r.rejected);
      let html = sv.html.replace(/(<script type="application\/json"(?![^>]*id="(?:jv-i18n|fa-translation-meta)")[^>]*>)([\s\S]*?)(<\/script>)/g, (m, open: string, body: string, close: string) => {
        try {
          const v = translateJson(JSON.parse(body), cat);
          return open + JSON.stringify(v).replace(/</g, "\\u003c") + close;
        } catch {
          return m;
        }
      });
      html = html.replace(/<\/head>/i, `${i18nBlock}</head>`);
      out.push({ path, content: withLanguages(html, path, locale, locales, source) });
    }
    report.rejected = [...new Set(report.rejected)];
    reports.push(report);
  }
  return { files: out, reports };
}
