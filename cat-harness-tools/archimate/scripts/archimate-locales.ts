/**
 * The ArchiMate pages in every language a layer has a catalogue for (#2350).
 *
 * @module archimate/scripts/archimate-locales
 * @covers archimate
 *
 * `gen-archimate-pages.ts --out` writes each page once, in English, at the
 * declared route (`en/<harness>/<visualiser>/…`), and most of what a reader
 * sees is drawn in the browser by `archimate.js` from the model (`model.json`)
 * and the view drawings (`view/<id>.svg`). So a locale needs four things, each
 * taken from the one English rendering:
 *
 * | what | how |
 * |---|---|
 * | the static pages (titles, kind lines, the metamodel page) | `pipeline/html-po.ts`, a copy at the same path under `<locale>/` |
 * | the model's names, documentation and folders | `model.<locale>.json` beside `model.json`; the copy's `data-kg-model` names it |
 * | the drawings' labels and titles | `<name>.<locale>.svg` beside each drawing (`pipeline/svg-label-po.ts`), linking into the locale's pages |
 * | `archimate.js`'s own words and the type and layer names | `T("…")` / `F("…{0}…")` in the script, a catalogue the page carries (`<script id="am-i18n">`) |
 *
 * One template, `translations/<locale>/archimate.pot` in the declaring layer,
 * holds every msgid of the four (`gen-archimate-pages.ts --pot`); a locale is
 * drawn when `translations/<locale>/archimate.po` exists. A string with no
 * translation stays English. The thin pages at each node's IRI are data, not
 * pages, and stay as they are. Every page, English included, names its other
 * languages with `<link rel="alternate" hreflang>` and the chrome's
 * translation block, so the navbar's language bar goes to the same page in
 * another language. Agent translations are marked `unverified`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { extractHtml, injectHtml } from "../../pipeline/html-po.ts";
import { extractSvgLabels, injectSvgLabels } from "../../pipeline/svg-label-po.ts";
import { formatPot, type PotEntry } from "../../pipeline/pot-extract.ts";
import { parsePo } from "../../pipeline/po-inject.ts";
import { inLocale, withLanguages } from "../../scripts/journeys/locales.ts";

/** The catalogue's file stem under `translations/<locale>/`. */
export const CATALOGUE_STEM = "archimate";
/** The id of the block that carries a page's catalogue for `archimate.js`. */
export const I18N_ID = "am-i18n";

const SCRIPT = join(import.meta.dir, "templates", "archimate.js");
/** The layers `archimate.js` groups a model's elements by, and the access kinds it names. */
const LAYERS = ["Strategy", "Business", "Application", "Technology", "Physical", "Motivation", "Implementation & Migration", "Other"];
const ACCESS = ["access", "read", "write", "readwrite"];

/** A file of a site being built, site-relative. */
export interface SiteFile {
  path: string;
  content: string;
  /** A page at the declared route (else data at the graph's path). */
  page?: boolean;
}

const typeLabel = (t: string): string => t.replace(/([a-z])([A-Z])/g, "$1 $2");
const hasWords = (s: string): boolean => /\p{L}/u.test(s.replace(/\{\d\}/g, ""));

/** Every `T("…")` and `F("…")` string in `archimate.js`. */
export function scriptStrings(src = readFileSync(SCRIPT, "utf8")): string[] {
  return [...src.matchAll(/\b[TF]\("((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string).filter(hasWords);
}

interface ModelJson {
  name?: string;
  documentation?: string;
  elements: Array<{ type: string; name?: string; documentation?: string; folder?: string[] }>;
  relationships: Array<{ type: string; name?: string; documentation?: string; accessType?: string }>;
  views: Array<{ name?: string; documentation?: string; viewpoint?: string; folder?: string[] }>;
}

/** The words of a served model a reader sees: names, documentation and folders. */
export function modelTexts(m: ModelJson): string[] {
  const out: string[] = [];
  const add = (s: string | undefined) => {
    if (s && hasWords(s)) out.push(s.trim());
  };
  add(m.name);
  add(m.documentation);
  for (const x of [...m.elements, ...m.relationships, ...m.views] as Array<{ name?: string; documentation?: string; folder?: string[] }>) {
    add(x.name);
    add(x.documentation);
    for (const f of x.folder ?? []) add(f);
  }
  return out;
}

/** The type, viewpoint, layer and access names `archimate.js` writes, as it writes them. */
export function modelLabels(m: ModelJson): string[] {
  const types = new Set<string>();
  for (const e of m.elements) types.add(typeLabel(e.type));
  for (const r of m.relationships) types.add(typeLabel(r.type));
  for (const v of m.views) if (v.viewpoint) types.add(typeLabel(v.viewpoint));
  return [...types].sort().concat(LAYERS, ACCESS);
}

/** A served model with its words translated; ids, types and properties as they are. */
export function translateModel(m: ModelJson & Record<string, unknown>, cat: ReadonlyMap<string, string>): unknown {
  const tr = (s: string | undefined) => (s === undefined ? s : (cat.get(s.trim()) ?? s));
  const each = <T extends { name?: string; documentation?: string; folder?: string[] }>(x: T): T => ({
    ...x,
    ...(x.name !== undefined ? { name: tr(x.name) } : {}),
    ...(x.documentation !== undefined ? { documentation: tr(x.documentation) } : {}),
    ...(x.folder ? { folder: x.folder.map((f) => tr(f)!) } : {}),
  });
  return {
    ...m,
    ...(m.name !== undefined ? { name: tr(m.name) } : {}),
    ...(m.documentation !== undefined ? { documentation: tr(m.documentation) } : {}),
    elements: m.elements.map(each),
    relationships: m.relationships.map(each),
    views: m.views.map(each),
  };
}

const isModel = (f: SiteFile) => !f.page && /(^|\/)model\.json$/.test(f.path);
const isSvg = (f: SiteFile) => !f.page && f.path.endsWith(".svg");
const isPage = (f: SiteFile) => f.page === true && f.path.endsWith(".html");

/** An Archi id, or a type pair a drawing names in a `<title>` (`Node->ApplicationComponent`): not words. */
const isIdentifier = (s: string): boolean => !/\s/.test(s) && (s.includes("->") || /\bid-[0-9a-f]{8}/.test(s));

/** Every type label the layer's models use: the words a composed title is made of. */
function typeLabelsOf(files: readonly SiteFile[]): Set<string> {
  const out = new Set<string>();
  for (const f of files.filter(isModel)) {
    const m = JSON.parse(f.content) as ModelJson;
    for (const x of [...m.elements, ...m.relationships]) out.add(typeLabel(x.type));
  }
  return out;
}

/**
 * A string the pages build from other strings, translated part by part: a
 * page title `<name> — <model>`, a relationship `<Type>: <source> → <target>`
 * (or `<Type>: <name>` in a drawing), an element `<name> (<Type>)`. Returns
 * undefined unless every part has a translation (`get`). Composed strings are
 * not in the template: their parts are.
 */
export function compose(s: string, get: (part: string) => string | undefined, types: ReadonlySet<string>, model?: string): string | undefined {
  const part = (x: string): string | undefined => get(x) ?? compose(x, get, types, model);
  if (model !== undefined && s.endsWith(` — ${model}`) && s !== model) {
    const a = part(s.slice(0, -(model.length + 3)));
    const b = get(model);
    return a !== undefined && b !== undefined ? `${a} — ${b}` : undefined;
  }
  const rel = /^([A-Z][A-Za-z ]+): (.+?) → (.+)$/.exec(s);
  if (rel && types.has(rel[1])) {
    const [t, a, b] = [get(rel[1]), part(rel[2]), part(rel[3])];
    return t !== undefined && a !== undefined && b !== undefined ? `${t}: ${a} → ${b}` : undefined;
  }
  const named = /^([A-Z][A-Za-z ]+): (.+)$/.exec(s);
  if (named && types.has(named[1])) {
    const [t, a] = [get(named[1]), part(named[2])];
    return t !== undefined && a !== undefined ? `${t}: ${a}` : undefined;
  }
  const typed = /^(.+) \(([A-Z][A-Za-z ]+)\)$/.exec(s);
  if (typed && types.has(typed[2])) {
    const [a, t] = [part(typed[1]), get(typed[2])];
    return a !== undefined && t !== undefined ? `${a} (${t})` : undefined;
  }
  return undefined;
}

/** The models' titles: the tail of every page title. */
function modelTitles(files: readonly SiteFile[]): string[] {
  return files.filter((f) => isPage(f) && f.content.includes('typeof="archimate:Model"')).map((f) => /<h1>([^<]*)<\/h1>/.exec(f.content)?.[1] ?? "").filter((t, i, a) => t && a.indexOf(t) === i);
}

/** Every msgid the files show, composed ones included, each once, with where it is first. */
function allEntries(files: readonly SiteFile[]): PotEntry[] {
  const seen = new Set<string>();
  const out: PotEntry[] = [];
  const add = (msgid: string, source: string) => {
    if (seen.has(msgid)) return;
    seen.add(msgid);
    out.push({ source, line: 0, msgid, kind: "html-text" });
  };
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted.filter(isPage)) for (const m of extractHtml(f.content)) add(m, f.path);
  for (const f of sorted.filter(isModel)) {
    const m = JSON.parse(f.content) as ModelJson;
    for (const t of modelTexts(m)) add(t, f.path);
    for (const t of modelLabels(m)) add(t, f.path);
  }
  for (const f of sorted.filter(isSvg)) for (const m of extractSvgLabels(f.content)) add(m, f.path);
  for (const s of scriptStrings()) add(s, "archimate/scripts/templates/archimate.js");
  return out.filter((e) => !isIdentifier(e.msgid));
}

/** The template's entries: the pages' segments, the drawings' labels, the models' words, then the script's; less what is composed of other entries ({@link compose}). */
export function potEntries(files: readonly SiteFile[]): PotEntry[] {
  const all = allEntries(files);
  const ids = new Set(all.map((e) => e.msgid));
  const types = typeLabelsOf(files);
  const titles = modelTitles(files);
  // Composable when every part is itself in the template: then the part is translated, not the whole.
  const has = (x: string) => (ids.has(x) ? x : undefined);
  return all.filter((e) => !titles.some((t) => compose(e.msgid, has, types, t) !== undefined) && compose(e.msgid, has, types) === undefined);
}

/** `cat` with every composed string of `files` added, translated part by part. */
export function withComposed(files: readonly SiteFile[], cat: ReadonlyMap<string, string>): Map<string, string> {
  const full = new Map(cat);
  const types = typeLabelsOf(files);
  const titles = modelTitles(files);
  const get = (x: string) => full.get(x);
  for (const e of allEntries(files)) {
    if (full.has(e.msgid)) continue;
    for (const t of [...titles, undefined]) {
      const c = compose(e.msgid, get, types, t);
      if (c !== undefined) {
        full.set(e.msgid, c);
        break;
      }
    }
  }
  return full;
}

export function formatArchimatePot(files: readonly SiteFile[], locale: string, project: string): string {
  return formatPot(potEntries(files), { projectName: `${project} ArchiMate pages`, locale });
}

/** The locales the layer at `root` has an ArchiMate catalogue for, in `supported` order. */
export function archimateLocales(root: string, supported: readonly string[], translationDir = "translations"): string[] {
  return supported.filter((l) => existsSync(join(root, translationDir, l, `${CATALOGUE_STEM}.po`)));
}

export function readArchimateCatalogue(root: string, locale: string, translationDir = "translations"): Map<string, string> {
  return parsePo(readFileSync(join(root, translationDir, locale, `${CATALOGUE_STEM}.po`), "utf8"));
}

/** `name.svg` → `name.<locale>.svg`; `model.json` → `model.<locale>.json`. */
export const localeData = (path: string, locale: string): string => path.replace(/\.(svg|json)$/, `.${locale}.$1`);

export interface ArchimateLocaleReport {
  locale: string;
  pages: number;
  translated: number;
  untranslated: number;
  rejected: string[];
}

/**
 * The site's files in every locale: the English files, its pages with their
 * language links, then per catalogue a translated copy of each page under
 * `<locale>/`, a translated `model.<locale>.json` and `<name>.<locale>.svg`
 * beside each model and drawing. `files` are site-relative; pages start with
 * the source locale's segment.
 */
export function localizedArchimateFiles(
  files: readonly SiteFile[],
  catalogues: ReadonlyMap<string, ReadonlyMap<string, string>>,
  source = "en",
): { files: SiteFile[]; reports: ArchimateLocaleReport[] } {
  const locales = [source, ...catalogues.keys()];
  if (locales.length === 1) return { files: [...files], reports: [] };
  const out: SiteFile[] = files.map((f) => (isPage(f) ? { ...f, content: withLanguages(f.content, f.path, source, locales, source) } : f));
  const reports: ArchimateLocaleReport[] = [];
  const runtime = [...new Set([...scriptStrings(), ...files.filter(isModel).flatMap((f) => modelLabels(JSON.parse(f.content) as ModelJson))])];
  for (const [locale, given] of catalogues) {
    const cat = withComposed(files, given);
    const report: ArchimateLocaleReport = { locale, pages: 0, translated: 0, untranslated: 0, rejected: [] };
    const i18n: Record<string, string> = {};
    for (const s of runtime) {
      const t = cat.get(s);
      if (t) i18n[s] = t;
    }
    const i18nBlock = `<script type="application/json" id="${I18N_ID}">${JSON.stringify(i18n).replace(/</g, "\\u003c")}</script>`;
    // A drawing's links into the pages: the same path under this locale.
    const intoLocale = (svg: string) => svg.replace(/((?:xlink:)?href=")((?:\.\.\/)+)([^/"]+)\//g, (m, attr: string, up: string, seg: string) => (seg === source ? `${attr}${up}${locale}/` : m));
    for (const f of files) {
      if (isModel(f)) {
        out.push({ path: localeData(f.path, locale), content: `${JSON.stringify(translateModel(JSON.parse(f.content), cat))}\n` });
      } else if (isSvg(f)) {
        const sv = injectSvgLabels(f.content, cat);
        out.push({ path: localeData(f.path, locale), content: intoLocale(sv.html) });
      } else if (isPage(f)) {
        const path = inLocale(f.path, locale);
        const r = injectHtml(f.content, cat, locale);
        report.pages++;
        report.translated += r.translated;
        report.untranslated += r.untranslated.length;
        report.rejected.push(...r.rejected);
        // The page's data in this locale: its model and drawings.
        // An inline drawing (a view's figure as drawn) is not read by html-po: its labels go as a drawing's do.
        let html = injectSvgLabels(r.html, cat).html
          .replace(/(data-kg-model="[^"]*\/)model\.json"/g, `$1model.${locale}.json"`)
          .replace(/((?:data-kg-svg|data|src|href)="[^"]*?)\.svg(["#?])/g, `$1.${locale}.svg$2`)
          // The metamodel page's filter picks a drawing from a JSON map in an attribute.
          .replace(/(data-mm-svgs="[^"]*")/g, (m) => m.replace(/\.svg&quot;/g, `.${locale}.svg&quot;`));
        html = html.replace(/<\/head>/i, `${i18nBlock}</head>`);
        out.push({ path, content: withLanguages(html, path, locale, locales, source), page: true });
      }
    }
    report.rejected = [...new Set(report.rejected)];
    reports.push(report);
  }
  return { files: out, reports };
}
