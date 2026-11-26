/**
 * LANGUAGE VERSIONS of a library entry, and the summary its catalogue record
 * gives — owner, 2026-11-10: *"where is summary, sections,
 * keywords etc? I should be able to toggle between source language and
 * chosen locale translation when viewing a non source locale artefact."*
 *
 * A publication's language versions reach the library two ways, both read
 * from the catalogue rather than guessed from slugs:
 *
 * - **One item, several PDFs.** IRIS often keeps the Arabic, Chinese,
 *   English and Russian editions as ORIGINAL bitstreams of one item. Each one
 *   derived here names its entry in `provenance.local`
 *   (`library/<slug>/structure.json#source`); its language is the file
 *   name's suffix (`_ara.pdf`, `-chi.pdf`), as IRIS names its files.
 * - **Linked items.** French and Spanish editions are usually items of their
 *   own, joined by the record's `who.relation.languageVersion` (Handles).
 *
 * Every version found this way is a WHO edition, so each is an OFFICIAL
 * translation. The source is the English edition when there is one: WHO
 * publishes in English first, and the record says nothing more precise.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** File-name language suffix, as IRIS names its files -> ISO 639-1. */
const SUFFIX: Record<string, string> = {
  eng: "en", en: "en", ara: "ar", ar: "ar", chi: "zh", zho: "zh", ch: "zh", rus: "ru", ru: "ru",
  fre: "fr", fra: "fr", fr: "fr", spa: "es", sp: "es", es: "es", por: "pt", fas: "fa", per: "fa",
  ger: "de", deu: "de",
};

/** Each language's own name, for the switcher. */
export const ENDONYM: Record<string, string> = {
  en: "English", fr: "Français", es: "Español", ru: "Русский", zh: "中文", ar: "العربية",
  fa: "فارسی", pt: "Português", de: "Deutsch",
};

/** The six UN languages first, in the UN's order, then the rest. */
const ORDER = ["en", "fr", "es", "ru", "zh", "ar"];

/** A PDF file name's language, from its suffix (`WHO_RHR_06.11_ara.pdf` -> `ar`), or `undefined`. */
export function languageOfFile(name: string): string | undefined {
  const m = /[_-]([a-z]{2,3})\.pdf$/i.exec(name);
  return m ? SUFFIX[m[1]!.toLowerCase()] : undefined;
}

export interface LanguageVersion {
  /** The library entry's id. */
  id: string;
  /** ISO 639-1. */
  lang: string;
  /** True for the source edition. */
  source: boolean;
}

export interface EntryLanguages {
  /** This entry's own language, when known. */
  lang?: string;
  /** Every version in the library, this one included, source first. Empty when there is no other. */
  versions: LanguageVersion[];
  /** The record's `dc.description.abstract`, verbatim. */
  abstract?: string;
}

interface Node {
  handle?: unknown;
  libraryId?: unknown;
  metadataRef?: unknown;
  bitstreams?: { name?: unknown; bundle?: unknown; materialization?: { provenance?: { local?: unknown } } }[];
}
interface DcRecord {
  fields?: { schema?: string; element?: string; qualifier?: string | null; values?: { value?: unknown }[] }[];
}

function readJson<T>(p: string): T | undefined {
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

function values(rec: DcRecord | undefined, schema: string, element: string, qualifier: string | null): string[] {
  return (rec?.fields ?? [])
    .filter((f) => (f.schema ?? "dc") === schema && f.element === element && (f.qualifier ?? null) === qualifier)
    .flatMap((f) => f.values ?? [])
    .map((v) => (typeof v.value === "string" ? v.value.trim() : ""))
    .filter(Boolean);
}

/** The library slug a bitstream's `provenance.local` names, or `undefined`. */
export function slugOfLocal(local: unknown): string | undefined {
  if (typeof local !== "string") return undefined;
  const m = /^library\/([A-Za-z0-9][A-Za-z0-9._-]*)\/structure\.json#source$/.exec(local);
  return m ? m[1] : undefined;
}

/**
 * Language versions and summary for every entry whose catalogue node is known.
 *
 * @param entries  each entry's id and, when a node names it, the node's absolute path
 * @param exists   the ids that are entries of the library — a version without one is not linked
 */
export function entryLanguages(
  entries: readonly { id: string; node?: string }[],
  exists: ReadonlySet<string>,
): Map<string, EntryLanguages> {
  // Every node any entry names, read once; then every node of the same
  // catalogue directory, since a linked item's node need not name an entry
  // that this list reached first.
  const nodes = new Map<string, Node>();
  const dirs = new Set<string>();
  for (const e of entries) if (e.node) dirs.add(dirname(e.node));
  const byHandle = new Map<string, string>();
  for (const d of dirs) {
    let names: string[] = [];
    try {
      names = readdirSync(d).filter((n) => n.endsWith(".json"));
    } catch {
      continue;
    }
    for (const n of names) {
      const p = join(d, n);
      const node = readJson<Node>(p);
      if (!node) continue;
      nodes.set(p, node);
      if (typeof node.handle === "string") byHandle.set(node.handle, p);
    }
  }
  // Per node: its slugs with their languages, its record's abstract, its linked Handles.
  const facts = new Map<string, { slugs: Map<string, string | undefined>; abstract?: string; linked: string[] }>();
  const factsOf = (p: string) => {
    const hit = facts.get(p);
    if (hit) return hit;
    const node = nodes.get(p) ?? readJson<Node>(p);
    const slugs = new Map<string, string | undefined>();
    let rec: DcRecord | undefined;
    if (node && typeof node.metadataRef === "string" && !node.metadataRef.includes("..")) {
      // `metadataRef` is relative to the layer root: two levels above `catalogue/nodes/`.
      const rp = join(dirname(dirname(dirname(p))), node.metadataRef);
      if (existsSync(rp)) rec = readJson<DcRecord>(rp);
    }
    const isos = values(rec, "dc", "language", "iso");
    for (const b of node?.bitstreams ?? []) {
      if (b.bundle !== "ORIGINAL") continue;
      const slug = slugOfLocal(b.materialization?.provenance?.local);
      if (slug) slugs.set(slug, typeof b.name === "string" ? languageOfFile(b.name) : undefined);
    }
    if (node && typeof node.libraryId === "string" && !slugs.has(node.libraryId)) slugs.set(node.libraryId, undefined);
    // A single-language item says its language in the record.
    for (const [s, l] of slugs) if (!l && isos.length === 1) slugs.set(s, isos[0]!.toLowerCase().slice(0, 2));
    const abstract = values(rec, "dc", "description", "abstract")[0];
    const f = { slugs, ...(abstract ? { abstract } : {}), linked: values(rec, "who", "relation", "languageVersion") };
    facts.set(p, f);
    return f;
  };
  // Group nodes joined by languageVersion (in either direction): union-find on node paths.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(rb < ra ? ra : rb, rb < ra ? rb : ra);
  };
  for (const p of nodes.keys()) {
    parent.set(p, parent.get(p) ?? p);
    for (const h of factsOf(p).linked) {
      const q = byHandle.get(h);
      if (q) union(p, q);
    }
  }
  const groups = new Map<string, string[]>();
  for (const p of nodes.keys()) {
    const r = find(p);
    groups.set(r, [...(groups.get(r) ?? []), p]);
  }
  const out = new Map<string, EntryLanguages>();
  for (const members of groups.values()) {
    const versions: LanguageVersion[] = [];
    const seen = new Set<string>();
    for (const p of members.sort()) {
      for (const [slug, lang] of factsOf(p).slugs) {
        if (!exists.has(slug) || !lang || seen.has(slug)) continue;
        seen.add(slug);
        versions.push({ id: slug, lang, source: false });
      }
    }
    const hasEn = versions.some((v) => v.lang === "en");
    for (const v of versions) v.source = hasEn && v.lang === "en";
    const rank = (l: string) => (ORDER.includes(l) ? ORDER.indexOf(l) : ORDER.length);
    versions.sort((a, b) => Number(b.source) - Number(a.source) || rank(a.lang) - rank(b.lang) || a.id.localeCompare(b.id));
    for (const p of members) {
      const f = factsOf(p);
      for (const [slug, lang] of f.slugs) {
        if (!exists.has(slug)) continue;
        out.set(slug, {
          ...(lang ? { lang } : {}),
          versions: versions.length > 1 ? versions : [],
          ...(f.abstract ? { abstract: f.abstract } : {}),
        });
      }
    }
  }
  return out;
}

/**
 * Each entry's own language and its editions' titles by language, for the
 * listing: owner, 2026-11-13, *"when display title not in locale, then
 * display locale if present under original"*. Only an edition the library
 * holds gives a title, so every title shown is WHO's own, never a guess.
 * (`dc.title.alternative` is not read: its value `language` is the
 * cataloguer's, not the title's, so it cannot say which title is which.)
 */
export function listingTitles(
  entries: readonly { id: string; title: string }[],
  langs: ReadonlyMap<string, EntryLanguages>,
): Map<string, { lang: string; titles?: Record<string, string> }> {
  const titleOf = new Map(entries.map((e) => [e.id, e.title]));
  const out = new Map<string, { lang: string; titles?: Record<string, string> }>();
  for (const e of entries) {
    const l = langs.get(e.id);
    if (!l?.lang) continue;
    const titles: Record<string, string> = {};
    for (const v of l.versions) {
      const t = titleOf.get(v.id);
      // A title that is only its slug names nothing.
      if (v.id !== e.id && v.lang !== l.lang && t && t !== v.id && !(v.lang in titles)) titles[v.lang] = t;
    }
    out.set(e.id, { lang: l.lang, ...(Object.keys(titles).length ? { titles } : {}) });
  }
  return out;
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** The entry's summary: the record's abstract, said to be WHO's own. Empty without one. */
export function summaryHtml(abstract: string | undefined): string {
  if (!abstract) return "";
  return `<section class="lib-summary" id="lib-summary">
<h2>Summary</h2>
<p>${escHtml(abstract)}</p>
<p class="note">The abstract from the item's catalogue record, as WHO published it.</p>
</section>`;
}

/**
 * The language line and the source / chosen-locale toggle. `hrefOf` maps an
 * entry id to its page, relative to this one. The toggle itself is drawn by
 * {@link LANGUAGE_TOGGLE_JS} from the reader's remembered locale; this HTML
 * lists every version, so the page says it without script.
 */
export function versionsHtml(current: string, langs: EntryLanguages, hrefOf: (id: string) => string): string {
  if (langs.versions.length < 2) return "";
  const items = langs.versions.map((v) => {
    const name = ENDONYM[v.lang] ?? v.lang;
    const what = v.source ? "source" : "WHO official translation";
    const label = `<span lang="${escHtml(v.lang)}">${escHtml(name)}</span> <span class="note">${what}</span>`;
    return v.id === current
      ? `<strong aria-current="page">${label}</strong>`
      : `<a href="${escHtml(hrefOf(v.id))}" hreflang="${escHtml(v.lang)}">${label}</a>`;
  });
  const data = JSON.stringify({
    current,
    versions: langs.versions.map((v) => ({ id: v.id, lang: v.lang, source: v.source, href: hrefOf(v.id), name: ENDONYM[v.lang] ?? v.lang })),
  }).replace(/</g, "\\u003c");
  return `<section class="lib-versions" id="lib-versions">
<p><strong>Language versions:</strong> ${items.join(" &middot; ")}</p>
<div class="lib-lang-toggle" id="lib-lang-toggle" hidden></div>
<script type="application/json" id="lib-versions-data">${data}</script>
</section>`;
}

/**
 * Client side of {@link versionsHtml}: a two-way toggle between the source
 * edition and the edition in the reader's chosen locale (`fa-locale`, which
 * the site's language switcher stores), drawn only when both exist and they
 * differ. A reader whose locale has no official edition is told so.
 */
export const LANGUAGE_TOGGLE_JS = `
(function(){
  var box = document.getElementById("lib-lang-toggle");
  var dataEl = document.getElementById("lib-versions-data");
  if (!box || !dataEl) return;
  var d; try { d = JSON.parse(dataEl.textContent || "{}"); } catch (_e) { return; }
  var vs = d.versions || [];
  var loc = "en"; try { loc = localStorage.getItem("fa-locale") || "en"; } catch (_e) {}
  var cur = vs.filter(function(v){ return v.id === d.current; })[0];
  var src = vs.filter(function(v){ return v.source; })[0];
  var mine = vs.filter(function(v){ return v.lang === loc; })[0];
  if (!cur || !src) return;
  var other = cur.source ? mine : src;
  if (cur.source && loc !== src.lang && !mine) {
    box.innerHTML = '<p class="note">No official WHO translation of this publication into your chosen language (' + esc(loc) + ').</p>';
    box.hidden = false; return;
  }
  if (!other || other.id === cur.id) return;
  var pair = cur.source ? [cur, other] : [other, cur];
  box.innerHTML = '<span class="seg" role="group" aria-label="Language">' + pair.map(function(v){
    var label = esc(v.name) + (v.source ? " (source)" : " (WHO official)");
    return v.id === cur.id
      ? '<button type="button" aria-pressed="true" lang="' + esc(v.lang) + '">' + label + "</button>"
      : '<a class="seg-link" role="button" aria-pressed="false" lang="' + esc(v.lang) + '" hreflang="' + esc(v.lang) + '" href="' + esc(v.href) + '">' + label + "</a>";
  }).join("") + "</span>";
  box.hidden = false;
})();
`;
