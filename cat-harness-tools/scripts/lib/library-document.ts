/**
 * The DOCUMENT view of an ingested library entry — what a reader browses.
 *
 * @module scripts/lib/library-document
 *
 * Issue #2302, bean `turh`. Owner, 2026-10-06: an ingested document should be
 * browsable "page by page", with "an overview of figures/tables, the TOC and
 * link to sections, and extracted summaries of each section" — and not for one
 * layer: "it is being ingested into a certain schema, no? that schema needs
 * a visualizer." So this reads the SCHEMA, `pdf-structure/v1`
 * (`schemas/ui/pdf-structure.ts`), and every `library/<slug>/` of every layer
 * that carries a `structure.json` gets the same view.
 *
 * ## What it reads, and only that
 *
 * - `structure.json` — the TOC (with each inferred entry's confidence and
 *   evidence), the sections, `pages[]` (each physical page's printed label),
 *   `figures[]`, and the diagnostics: contents-vs-body alignment, figure
 *   numbering gaps, page-label conflicts.
 * - `summaries.json` (`folio-block-summaries/v1`) — a section's summary, matched
 *   by the section FILE it summarises (`source`), never by position.
 * - keywords (`scripts/library-keywords.ts`) — from the derived keywords graph
 *   the caller passes (`folio-keywords/v2`, built at publish), else a legacy
 *   `keywords.json` (`folio-keywords/v1`) in the entry — the
 *   document's and each section's keywords, from the LSI term weights, with
 *   `heading` evidence where a heading also names the term.
 * - `sections/<id>.md` — an EXTRACT (the opening of the section's text) where
 *   no summary exists. An extract is labelled as one: it is the document's own
 *   words cut short, never our writing about it, and a reader must be able to
 *   tell the two apart.
 *
 * ## Two states that must not look alike
 *
 * - an entry with no `structure.json` — `null`, and the viewer shows no
 *   document panel: there is nothing in this schema to show;
 * - a field the artefact does not carry (an older ingestion with no `pages`)
 *   — the key is ABSENT from the projection, and the viewer says "not
 *   recorded for this entry" rather than drawing an empty table.
 *
 * A WITHHELD entry (bean `cw35`) publishes no verbatim BODY text: its section
 * extracts are omitted and say so. Its structure, page labels, figure and
 * table captions (labels, like TOC titles) and our own summaries stay.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { readStructure } from "../../schemas/content/document-structure.ts";
import { displayNarrative } from "./narrative-display.ts";

/** How much of a section's text an extract carries. */
export const EXTRACT_CHARS = 420;

export interface DocTocEntry {
  level: number;
  title: string;
  number: string | null;
  page: number | null;
  pageLabel: string | null;
  confidence: number | null;
  evidence: string[] | null;
  source: string;
  /** The section this entry opens, when one was split at it. */
  section: string | null;
}

export interface DocSection {
  id: string;
  number: string | null;
  title: string;
  level: number;
  pageStart: number | null;
  pageEnd: number | null;
  labelStart: string | null;
  labelEnd: string | null;
  words: number;
  summary: { text: string; status: string } | null;
  keywords: DocKeyword[];
  /** The opening of the section's own text; null when withheld or empty. */
  extract: string | null;
  extractCut: boolean;
  /**
   * Where this section was MATERIALISED for editing, when it was (bean zcak):
   * a library entry is frozen (owner, 2026-10-07: "published 'draft for
   * public comment' goes in library/, changes to it from PC review go under
   * folio/"), so [edit] on a section opens the folio block made from it.
   * Supplied by the caller ({@link EntryLinks}); absent when none maps.
   */
  edit?: { path: string; label: string };
  /**
   * The blocks this section holds, by `@id`, as its `sections/<id>.jsonld`
   * `contains` lists them. The Contents tree draws them as leaves under the
   * section. Absent when the section's node lists none.
   */
  blocks?: string[];
}

/**
 * What a section's [source], [feedback] and [edit] links are built from
 * (bean zcak, the shared recipe of bean v433). `dir` is the entry's directory,
 * repository-relative. The library never gets an edit link of its own: it is
 * frozen, and `editFor` is how a folio that materialised it says where edits go.
 */
export interface EntryLinks {
  repo: string;
  branch?: string;
  dir: string;
  editFor?: (s: { id: string; number: string | null; title: string }) => { path: string; label: string } | undefined;
}

export interface DocKeyword { term: string; heading: boolean }

export interface DocumentView {
  $schema: "folio-library-document/v1";
  id: string;
  title: string | null;
  /**
   * Which structure variant the entry is. Only a PDF has pages and an
   * outline: a text or notebook source is divided by its own headings, so
   * the view lists those as its contents and shows no page count, rather
   * than "0 pages" and "the PDF carries no outline" (litlfred/dth-hrh).
   */
  variant: "pdf" | "notebook" | "text";
  /**
   * The source's page count, or `null` when the ingestion recorded none. An
   * older ingestion (`9789241511766-eng`, page granularity) has no
   * `source.pages` and no `pages[]`, and `0` read as "an empty PDF" on the
   * page (owner, 2026-10-15: "(0 pages)"). Unknown is not zero.
   */
  pages: number | null;
  /** The last page a section reaches, when the count is unknown: what the sections DO say. */
  pagesCovered?: number;
  tocSource: string | null;
  tocMethod: string | null;
  toc: DocTocEntry[];
  sections: DocSection[];
  /** Absent when the entry has no keywords.json — not the same as none found. */
  keywords?: DocKeyword[];
  pageLabels?: { physical: number; label: string | null; source: string | null; confidence: number }[];
  figures?: { kind: string; number: string; title: string; page: number; pageLabel: string | null; confidence: number; evidence: string[] }[];
  checks: {
    tocAlignment?: Record<string, { count: number; items: string[] }>;
    figureSequenceGaps?: string[];
    pageLabelConflicts?: { count: number; items: string[] };
  };
  /**
   * The entry's KEPT figures (role `figure`, a WebP or PNG file on disk), with every
   * language's description (who-iris#224). Absent when the entry keeps none.
   * `file` is relative to the entry; the site copies it to
   * `assets/library/files/<id>/<file>` ({@link entryFigureFiles}).
   */
  images?: DocImage[];
  /** The entry's transcribed tables (`tabular.csvw.json`), cells inline. Absent when it has none. */
  tables?: DocTable[];
  withheld: boolean;
  /** What was extracted, kind by kind ({@link entryCoverage}). */
  coverage?: DocCoverage[];
  /** Present when the caller gave {@link EntryLinks}: the page draws the links. */
  links?: { repo: string; branch: string; dir: string };
}

/**
 * WHAT WAS EXTRACTED, kind by kind — owner, 2026-11-14: "why no biblio,
 * glossary, etc here" on a one-page notice that has none. A blank said
 * nothing: "none in the text", "not extracted yet" and "never looked" all
 * read the same. Each kind now says one of:
 *
 * - `found` (with a count), `partial` (fewer kept than the text captions),
 * - `none` — only where something DID look: the extractor's own output, or
 *   the headings and text, which are held and were read here;
 * - `not-extracted` — the step has not run for this entry.
 *
 * An `extraction.json` the ingest writes ({ kinds: { <kind>: { state, count,
 * note } } }) is the authority for any kind it names; the rest is derived.
 */
export interface DocCoverage {
  kind: "contents" | "sections" | "figures" | "tables" | "references" | "glossary" | "footnotes" | "summaries";
  state: "found" | "partial" | "none" | "not-extracted";
  count?: number;
  note?: string;
}

const PAGE_TITLE = /^page\s+\d+$/i;
const HEADING_OF: Record<"references" | "glossary", RegExp> = {
  references: /^(?:\d+(?:\.\d+)*\.?\s+)?(?:references|bibliography|works cited|literature cited|sources|further reading|r[ée]f[ée]rences|bibliographie|referencias|bibliograf[ií]a)\s*:?$/i,
  glossary: /^(?:\d+(?:\.\d+)*\.?\s+)?(?:glossary|abbreviations(?: and acronyms)?|acronyms(?: and abbreviations)?|definitions|glossaire|abr[ée]viations|sigles(?: et abr[ée]viations)?|glosario|abreviaturas|siglas)\s*:?$/i,
};

/** Where a References or Glossary heading is: a section's title, else a short line of the held text. */
function headingAt(dir: string, sections: DocSection[], re: RegExp): DocSection | null {
  const byTitle = sections.find((x) => re.test(x.title.trim()));
  if (byTitle) return byTitle;
  for (const x of sections) {
    const p = join(dir, "sections", `${x.id}.md`);
    if (!existsSync(p)) continue;
    const body = readFileSync(p, "utf8").replace(/^---[\s\S]*?\n---\n/, "");
    if (body.split("\n").some((l) => l.trim().length < 60 && re.test(l.replace(/^#+\s*/, "").trim()))) return x;
  }
  return null;
}

/** {@link DocCoverage} for one entry. */
export function entryCoverage(dir: string, v: DocumentView, captions: { kind: string }[] | undefined): DocCoverage[] {
  const out: DocCoverage[] = [];
  const pageSplit = v.sections.length > 0 && v.sections.every((x) => PAGE_TITLE.test(x.title.trim()));
  const depth = new Set(v.sections.map((x) => x.level)).size;
  out.push(v.toc.length
    ? { kind: "contents", state: "found", count: v.toc.length, ...(v.tocSource ? { note: v.tocSource } : {}) }
    : pageSplit
      ? { kind: "contents", state: "not-extracted", note: "split one section per page; no contents was trusted" }
      : { kind: "contents", state: "none", note: "no outline in the PDF and none inferred" });
  out.push({ kind: "sections", state: pageSplit ? "partial" : "found", count: v.sections.length,
    note: pageSplit ? "one per page, not by heading" : depth > 1 ? `${depth} levels` : "one level" });
  const capFig = (captions ?? []).filter((c) => /fig/i.test(c.kind)).length;
  const capTab = (captions ?? []).filter((c) => /tab/i.test(c.kind)).length;
  const figs = v.images?.length ?? 0;
  const looked = existsSync(join(dir, "images.json")) || existsSync(join(dir, "vector-figures.json"));
  out.push(figs
    ? { kind: "figures", state: capFig > figs ? "partial" : "found", count: figs, ...(capFig > figs ? { note: `${capFig} captioned in the text` } : {}) }
    : looked
      ? capFig ? { kind: "figures", state: "partial", count: 0, note: `${capFig} captioned in the text, none kept` } : { kind: "figures", state: "none" }
      : { kind: "figures", state: "not-extracted" });
  const tabs = v.tables?.length ?? 0;
  out.push(tabs
    ? { kind: "tables", state: capTab > tabs ? "partial" : "found", count: tabs, ...(capTab > tabs ? { note: `${capTab} captioned in the text` } : {}) }
    : existsSync(join(dir, "tabular.csvw.json"))
      ? { kind: "tables", state: "none" }
      : { kind: "tables", state: "not-extracted", ...(capTab ? { note: `${capTab} captioned in the text` } : {}) });
  for (const kind of ["references", "glossary"] as const) {
    const at = headingAt(dir, v.sections, HEADING_OF[kind]);
    const where = at ? (at.pageStart != null ? `p${at.pageStart}` : `“${at.title}”`) : "";
    out.push(at
      ? { kind, state: "not-extracted", note: `a ${kind === "references" ? "references" : "glossary"} section is in the text (${where}); its entries are not extracted` }
      : { kind, state: "none", note: "no such heading in the text" });
  }
  const fn = readJson<{ footnotes?: unknown[] }>(join(dir, "footnotes.json"));
  out.push(fn ? (fn.footnotes?.length ? { kind: "footnotes", state: "found", count: fn.footnotes.length } : { kind: "footnotes", state: "none" })
    : { kind: "footnotes", state: "not-extracted" });
  const summed = v.sections.filter((x) => x.summary).length;
  out.push({ kind: "summaries", state: summed === v.sections.length && summed ? "found" : summed ? "partial" : "not-extracted",
    count: summed, note: `${summed} of ${v.sections.length} sections` });
  // The ingest's own record wins for every kind it names.
  const rec = readJson<{ kinds?: Record<string, { state?: string; count?: number; note?: string }> }>(join(dir, "extraction.json"));
  for (const c of out) {
    const r = rec?.kinds?.[c.kind];
    if (r && (r.state === "found" || r.state === "partial" || r.state === "none" || r.state === "not-extracted")) {
      c.state = r.state;
      if (typeof r.count === "number") c.count = r.count; else delete c.count;
      if (r.note) c.note = r.note; else delete c.note;
    }
  }
  return out;
}

/** One kept figure: where it is, and what it shows in each language (`lang` → text). */
export interface DocImage {
  id: string;
  /** Where the site publishes it, under `files/<id>/`: always inside that directory ({@link containedRel}). */
  file: string;
  /** The entry-relative path it is READ from, when that differs from `file` (a file outside the entry). */
  source?: string;
  page: number | null;
  /** The captions this render shows (`shows`), vector renders only. */
  shows?: string[];
  narratives: Record<string, string>;
  /** Every description here is a draft until a person confirms it. */
  state: string;
}

/** One transcribed table: its grid inline, so the page needs no CSV parser. */
export interface DocTable {
  label: string;
  caption: string;
  pages: number[];
  columns: { titles: string; group?: string }[];
  rows: string[][];
  notes?: string;
  narratives: Record<string, string>;
  /** The CSV beside the record, relative to the entry. */
  csv: string;
  /** The entry-relative path it is READ from, when that differs from `csv`. */
  source?: string;
}

interface RawNarrative { text?: string | null; lang?: string; state?: string }
const narrativeMap = (raw: unknown): { map: Record<string, string>; state: string } => {
  const list = (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : []) as RawNarrative[];
  const map: Record<string, string> = {};
  let state = "draft";
  for (const n of list) {
    if (!n || !n.text) continue;
    map[n.lang || "en"] = n.text;
    if (n.state) state = n.state;
  }
  return { map, state };
};

/** RFC 4180 CSV, enough for the tables this repository writes (quotes, doubled quotes, newlines in a cell). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

interface RawImage { id: string; file?: string; role?: string; basis?: { page?: number }; narrative?: unknown; shows?: string[] }

/**
 * The kept figures of an entry: raster images and vector renders whose role
 * is `figure` and whose image file (WebP or PNG) exists. PNG was left out
 * (owner, 2026-11-14: "has no figures"): 9789240116191-eng has 15 PNG vector
 * figures and its gallery showed none.
 */
export function readEntryImages(dir: string): DocImage[] {
  const out: DocImage[] = [];
  const add = (r: RawImage, page: number | null) => {
    if (r.role !== undefined && r.role !== "figure") return;
    if (!r.file || !/\.(?:webp|png)$/i.test(r.file) || !existsSync(join(dir, r.file))) return;
    const { map, state } = narrativeMap(r.narrative);
    const file = containedRel(r.file);
    out.push({ id: r.id, file, ...(file === r.file ? {} : { source: r.file }), page, ...(r.shows?.length ? { shows: r.shows } : {}), narratives: map, state });
  };
  const im = readJson<{ images?: RawImage[] }>(join(dir, "images.json"));
  for (const r of im?.images ?? []) add(r, r.basis?.page ?? null);
  const vf = readJson<{ figures?: (RawImage & { page?: number })[] }>(join(dir, "vector-figures.json"));
  for (const r of vf?.figures ?? []) add({ ...r, role: r.role ?? "figure" }, r.page ?? null);
  return out.sort((a, b) => (a.page ?? 0) - (b.page ?? 0) || a.id.localeCompare(b.id, undefined, { numeric: true }));
}

interface RawCsvwTable {
  url: string;
  tableSchema?: { columns?: { titles?: string; "fac:group"?: string }[] };
  "fac:label"?: string; "fac:caption"?: string; "fac:pages"?: number[]; "fac:notes"?: string; "fac:narrative"?: unknown;
  "fac:headerRow"?: number;
}

/** The transcribed tables of an entry, from `tabular.csvw.json` and the CSVs it names. */
export function readEntryTables(dir: string): DocTable[] {
  const rec = readJson<{ tables?: RawCsvwTable[] }>(join(dir, "tabular.csvw.json"));
  const out: DocTable[] = [];
  for (const t of rec?.tables ?? []) {
    const path = join(dir, t.url);
    if (!existsSync(path)) continue;
    const grid = parseCsv(readFileSync(path, "utf8"));
    const body = t["fac:headerRow"] === 0 ? grid : grid.slice(1);
    out.push({
      label: t["fac:label"] ?? t.url,
      caption: t["fac:caption"] ?? "",
      pages: t["fac:pages"] ?? [],
      columns: (t.tableSchema?.columns ?? []).map((c) => ({ titles: c.titles ?? "", ...(c["fac:group"] ? { group: c["fac:group"] } : {}) })),
      rows: body,
      ...(t["fac:notes"] ? { notes: t["fac:notes"] } : {}),
      narratives: narrativeMap(t["fac:narrative"]).map,
      csv: containedRel(t.url),
      ...(containedRel(t.url) === t.url ? {} : { source: t.url }),
    });
  }
  return out;
}

/**
 * An entry-relative path made safe to publish under `files/<id>/`: each `..`
 * becomes `_up`, so the copy and the page's link stay inside that directory.
 * An entry may point at a file outside itself (`kg-folio-asst-2026-09-30`'s
 * images are `../../../docs/assets/img/kg-deck/…`); joined as-is, the copy
 * escaped `assets/library/files/<id>/` and landed at `docs/docs/assets/…`,
 * inside the layer's mount (bean `cat-tools-sm8r`, measured 2026-11-15).
 */
export function containedRel(rel: string): string {
  return posix
    .normalize(rel.split("\\").join("/"))
    .split("/")
    .filter((seg) => seg !== "" && seg !== ".")
    .map((seg) => (seg === ".." ? "_up" : seg))
    .join("/");
}

/**
 * The files the site copies for an entry's figures: where each is published
 * (`rel`, under `files/<id>/`) and where it is read from (`source`), both
 * entry-relative. Through {@link readEntryImages}, so the page and the copy can
 * never disagree.
 */
export function entryFigureCopies(dir: string): { rel: string; source: string }[] {
  return [
    ...readEntryImages(dir).map((i) => ({ rel: i.file, source: i.source ?? i.file })),
    ...readEntryTables(dir).map((t) => ({ rel: t.csv, source: t.source ?? t.csv })),
  ];
}

/** The published paths of {@link entryFigureCopies}. */
export function entryFigureFiles(dir: string): string[] {
  return entryFigureCopies(dir).map((c) => c.rel);
}

/** The raw `structure.json` fields this view reads (schemas/ui/pdf-structure.ts). */
interface RawToc { level?: number; title: string; number?: string | null; page?: number | null; page_label?: string | null; confidence?: number | null; evidence?: string[] | null; source?: string }
interface RawSection { id: string; number?: string | null; title: string; level?: number; page_start?: number | null; page_end?: number | null; label_start?: string | null; label_end?: string | null; n_words?: number }
interface RawPage { physical: number; label?: string | null; source?: string | null; confidence?: number }
interface RawFigure { kind: string; number: string; title: string; page: number; page_label?: string | null; confidence: number; evidence?: string[] }
interface RawStructure {
  source?: { pages?: number };
  metadata?: { title?: string };
  toc_source?: string;
  toc?: RawToc[];
  sections?: RawSection[];
  pages?: RawPage[];
  figures?: RawFigure[];
  diagnostics?: {
    toc_inferred_method?: string;
    toc_alignment?: Record<string, { count: number; items: string[] }>;
    figure_sequence_gaps?: string[];
    page_label_conflicts?: { count: number; items: string[] };
  };
}
interface RawKeyword { term: string; evidence?: string[] }
interface RawKeywords { document?: RawKeyword[]; sections?: Record<string, RawKeyword[]> }
/** One variant's keywords for an entry: the document's, and each section's by id. */
export type EntryKeywordLists = RawKeywords;
const kw = (ks: RawKeyword[] | undefined): DocKeyword[] =>
  (ks ?? []).map((k) => ({ term: k.term, heading: (k.evidence ?? []).includes("heading") }));
// `narrative` is one narrative or one per language (bean `cat-tools-e1lo`); read
// through `displayNarrative`, never by field.
interface RawSummaries { summaries?: { source?: string; status?: string; narrative?: unknown }[] }

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * A section file's body, front matter removed. When the section is Markdown
 * (a text or notebook source divided at its headings), the body is read as a
 * reader sees it: see `plainMarkdown`.
 */
function sectionText(path: string, markdown = false): string | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const body = raw.startsWith("---") ? raw.replace(/^---\n[\s\S]*?\n---\n?/, "") : raw;
  const t = (markdown ? plainMarkdown(body) : body).replace(/\s+/g, " ").trim();
  return t || null;
}

/**
 * A Markdown section body as one line of plain text, for an extract: the
 * section's own opening heading dropped (the view already shows it as the
 * title), heading, quote and bullet markers and fence lines removed, links
 * and images reduced to their text, a table's delimiter row dropped and each
 * row read as its non-empty cells joined by "; " (the twg-outline's "Handbook
 * at a glance" showed its pipes), and each line's emphasis and escapes removed
 * by `plainHeading`. Display only; sections/*.md stays verbatim.
 */
export function plainMarkdown(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && !lines[i]!.trim()) i++;
  if (/^ {0,3}#{1,6}(\s|$)/.test(lines[i] ?? "")) i++;
  return lines
    .slice(i)
    .filter((l) => !/^\s*(```|~~~)/.test(l) && !/^\s*([-*_]\s*){3,}$/.test(l) && !TABLE_DELIMITER.test(l))
    .map((l) => (/^\s*\|/.test(l) ? tableRow(l) : l))
    .map((l) =>
      plainHeading(
        l.replace(/^ {0,3}#{1,6}\s+/, "")
          .replace(/\s+#+\s*$/, "")
          .replace(/^\s*>\s?/, "")
          .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/, "")
          .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
      ))
    .join(" ");
}

/** A GFM table's delimiter row: `| :--- | ---: |`, with or without the outer pipes. */
const TABLE_DELIMITER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** A table row as its non-empty cells, joined by "; ". `\|` inside a cell is a literal pipe. */
function tableRow(l: string): string {
  return l.trim().replace(/^\|/, "").replace(/(?<!\\)\|\s*$/, "")
    .split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim()).filter(Boolean).join("; ");
}

/** Cut at a word boundary, and say whether anything was cut. */
export function extractOf(text: string | null, max = EXTRACT_CHARS): { extract: string | null; cut: boolean } {
  if (!text) return { extract: null, cut: false };
  if (text.length <= max) return { extract: text, cut: false };
  const head = text.slice(0, max);
  const at = head.lastIndexOf(" ");
  return { extract: (at > max * 0.6 ? head.slice(0, at) : head).trimEnd(), cut: true };
}

/**
 * The document view of one entry directory, or null when it carries no
 * `structure.json`. `withheld` suppresses every verbatim extract.
 */
/**
 * A text or notebook heading as a reader should SEE it: inline Markdown
 * emphasis (`**…**`, `__…__`, `*…*`, `_…_`, `` `…` ``) and backslash escapes
 * (`1\.`) removed. Display only: the text rung keeps the source verbatim in
 * structure.json and sections/*.md, and so does this view's data for a PDF.
 * The words are unchanged, so matching a heading to a folio section (which
 * compares letters and digits only) is unaffected (litlfred/dth-hrh).
 */
export function plainHeading(t: string): string {
  // Escapes are held aside first, so an escaped "\*" is never read as emphasis.
  const held: string[] = [];
  const hold = (c: string) => `\u0000${held.push(c) - 1}\u0000`;
  return t
    .replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, (_m, c: string) => hold(c))
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_](?=\S)(.+?)(?<=\S)[*_](?![\w*])/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\u0000(\d+)\u0000/g, (_m, i: string) => held[Number(i)]!)
    .trim();
}

/** The block `@id`s a section's own node `contains` (a sub-section it names is not a block). */
function sectionBlocks(dir: string, id: string): { blocks?: string[] } {
  const c = readJson<{ contains?: unknown }>(join(dir, "sections", `${id}.jsonld`))?.contains;
  const blocks = (Array.isArray(c) ? c : []).filter((x): x is string => typeof x === "string" && x !== "" && !x.includes("/sections/"));
  return blocks.length ? { blocks } : {};
}

export function readEntryDocument(
  dir: string,
  id: string,
  opts: { withheld?: boolean; links?: EntryLinks; keywords?: EntryKeywordLists } = {},
): DocumentView | null {
  // Through the shared accessor (bean rkqp): it knows every structure
  // variant. A pdf structure carries the TOC, pages and figures this view
  // shows; a notebook or text structure shows its sections only.
  const read = readStructure(dir);
  if ("reason" in read) return null;
  const s: RawStructure = read.variant === "pdf"
    ? (read.raw as unknown as RawStructure)
    : {
        metadata: { title: read.title ?? undefined },
        toc_source: (read.raw as { toc_source?: string }).toc_source,
        sections: read.sections.map((x) => ({
          id: x.id, number: x.number, title: plainHeading(x.title), level: x.level, n_words: x.n_words,
          page_start: x.locator.kind === "pages" ? x.locator.start : null,
          page_end: x.locator.kind === "pages" ? x.locator.end : null,
        })),
      };
  const withheld = !!opts.withheld;
  // A text section divided at a heading, and a notebook's cells, are Markdown;
  // a PDF page's text and a whole verbatim file (XML, say) are not.
  const markdownIds = new Set(read.variant === "pdf" ? [] : read.sections
    .filter((x, k) => (read.raw as { sections?: { unit?: string }[] }).sections?.[k]?.unit !== "file")
    .map((x) => x.id));

  const summaries = new Map<string, { text: string; status: string }>();
  const sj = readJson<RawSummaries>(join(dir, "summaries.json"));
  for (const r of sj?.summaries ?? []) {
    const src = String(r.source ?? "").replace(/^sections\//, "").replace(/\.md$/, "");
    const nar = displayNarrative(r.narrative);
    const text = nar?.text;
    if (src && typeof text === "string" && text.trim()) {
      // The narrative schema names this field `state`; `status` is the older form.
      summaries.set(src, { text, status: String(nar?.state ?? nar?.status ?? r.status ?? "draft") });
    }
  }

  // Keywords are derived terms, not the document's text, so a withheld entry
  // shows them too — as it shows its captions.
  // From the derived keywords graph the caller computed (cat-harness#1144:
  // built at publish, outside the ingest record), else a legacy keywords.json
  // still committed in the entry.
  const kj = opts.keywords ?? readJson<RawKeywords>(join(dir, "keywords.json"));

  const sections: DocSection[] = (s.sections ?? []).map((x) => {
    const text = withheld ? null : sectionText(join(dir, "sections", `${x.id}.md`), markdownIds.has(x.id));
    const { extract, cut } = extractOf(text);
    return {
      id: x.id,
      number: x.number ?? null,
      title: x.title,
      level: x.level ?? 1,
      pageStart: x.page_start ?? null,
      pageEnd: x.page_end ?? null,
      labelStart: x.label_start ?? null,
      labelEnd: x.label_end ?? null,
      words: x.n_words ?? 0,
      summary: summaries.get(x.id) ?? null,
      keywords: kw(kj?.sections?.[x.id]),
      extract,
      extractCut: cut,
      ...sectionBlocks(dir, x.id),
    };
  });

  // A TOC entry links to the section split at it: same title, starting on
  // its page. Matched on both, because a title can repeat.
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const toc: DocTocEntry[] = (s.toc ?? []).map((e) => {
    const sec = sections.find((x) => norm(x.title) === norm(e.title) && (e.page == null || x.pageStart === e.page))
      ?? sections.find((x) => norm(x.title) === norm(e.title));
    return {
      level: e.level ?? 1,
      title: e.title,
      number: e.number ?? null,
      page: e.page ?? null,
      pageLabel: e.page_label ?? null,
      confidence: e.confidence ?? null,
      evidence: e.evidence ?? null,
      source: e.source ?? "outline",
      section: sec ? sec.id : null,
    };
  });

  const d = s.diagnostics ?? {};
  const view: DocumentView = {
    $schema: "folio-library-document/v1",
    id,
    title: s.metadata?.title ?? null,
    variant: read.variant,
    pages: s.source?.pages ?? (Array.isArray(s.pages) && s.pages.length ? s.pages.length : null),
    tocSource: s.toc_source ?? null,
    tocMethod: d.toc_inferred_method ?? null,
    toc,
    sections,
    checks: {},
    withheld,
  };
  if (view.pages == null) {
    const last = Math.max(0, ...sections.map((x) => x.pageEnd ?? x.pageStart ?? 0));
    if (last > 0) view.pagesCovered = last;
  }
  if (kj) view.keywords = kw(kj.document);
  if (Array.isArray(s.pages)) {
    view.pageLabels = s.pages.map((p) => ({
      physical: p.physical, label: p.label ?? null, source: p.source ?? null, confidence: p.confidence ?? 0,
    }));
  }
  if (Array.isArray(s.figures)) {
    view.figures = s.figures.map((f) => ({
      // A caption is shown even for a withheld entry (owner, 2026-10-06:
      // "why caption on table/figure withheld? add them"): it is a label of a
      // dozen words, like the TOC titles already shown, not the work's text.
      kind: f.kind, number: f.number, title: f.title, page: f.page,
      pageLabel: f.page_label ?? null, confidence: f.confidence, evidence: f.evidence ?? [],
    }));
  }
  // Figures and tables are the work's own content, so a WITHHELD entry
  // (bean cw35) shows neither, as it shows no body text.
  if (!withheld) {
    // `source` is this module's own (where the copy is read from), not part of the published document.
    const images = readEntryImages(dir).map(({ source: _s, ...i }) => i);
    if (images.length) view.images = images;
    const tables = readEntryTables(dir).map(({ source: _s, ...t }) => t);
    if (tables.length) view.tables = tables;
  }
  view.coverage = entryCoverage(dir, view, s.figures);
  if (d.toc_alignment) view.checks.tocAlignment = d.toc_alignment;
  if (Array.isArray(d.figure_sequence_gaps)) view.checks.figureSequenceGaps = d.figure_sequence_gaps;
  if (d.page_label_conflicts) view.checks.pageLabelConflicts = d.page_label_conflicts;
  const links = opts.links;
  if (links) {
    view.links = { repo: links.repo, branch: links.branch ?? "main", dir: links.dir.replace(/\/+$/, "") };
    if (links.editFor)
      for (const x of view.sections) {
        const e = links.editFor({ id: x.id, number: x.number, title: x.title });
        if (e) x.edit = e;
      }
  }
  return view;
}

/**
 * The viewer's document panel — browser code, embedded verbatim in the page
 * (same pattern and reasons as `library-withheld-view.ts`): a unit test can
 * run the exact text the page runs. Needs `esc` and `$` from the page.
 */
export const DOCUMENT_VIEW_JS = String.raw`
/* THE DOCUMENT PANEL -- issue #2302. See scripts/lib/library-document.ts. */
var DOC = null, DOC_ID = null, DOC_TAB = "contents";
function docHref(id){
  var dir = DATA_HREF.slice(0, DATA_HREF.lastIndexOf("/") + 1);
  return dir + "entries/" + encodeURIComponent(id) + ".doc.json";
}
function pageText(phys, label){
  /* The label a reader sees first; the physical index beside it when they
     differ, because that is what a PDF viewer's page box takes. */
  if (phys == null) return "—";
  return label && String(label) !== String(phys) ? esc(label) + ' <span class="note">(p' + phys + ')</span>' : 'p' + phys;
}
function confPill(c, ev){
  if (c == null) return "";
  var cls = c >= 0.8 ? "ok" : c >= 0.6 ? "info" : "warn";
  return '<span class="pill ' + cls + '" title="' + esc((ev || []).join(", ")) + '">' + c.toFixed(2) + '</span>';
}
function notRecorded(what){
  return '<p class="empty">' + esc(what) + ' not recorded for this entry — it was ingested before this field existed. Re-ingest to add it.</p>';
}
/* THE CONTENTS TREE. Owner, 2026-11-13: "a hierarchy tree expandable
   browser of sections on library items ... that shows blocks within". From
   the outline when there is one, else from the sections, nested by level; a
   section's blocks are its leaves. A node's children are built when it is
   first opened, so a document of a thousand sections stays fast. */
var DOC_BLOCKS = null, DOC_TREE = [];
/* Section id -> its blocks: the ids its own node contains, then any block
   whose target is that section's file. A block placed by neither is left to
   the Blocks panel rather than guessed into a section. */
function docBlocksBySection(d){
  var out = {}, byId = {}, placed = {};
  (DOC_BLOCKS || []).forEach(function(b){ byId[b.id] = b; });
  d.sections.forEach(function(s){
    (s.blocks || []).forEach(function(id){
      if (placed[id]) return;
      placed[id] = 1; (out[s.id] = out[s.id] || []).push(byId[id] || { id: id });
    });
  });
  var known = {};
  d.sections.forEach(function(s){ known[s.id] = 1; });
  (DOC_BLOCKS || []).forEach(function(b){
    var m = !placed[b.id] && /(?:^|\/)sections\/([^\/]+)\.md$/.exec(b.target || "");
    if (m && known[m[1]]) { placed[b.id] = 1; (out[m[1]] = out[m[1]] || []).push(b); }
  });
  return out;
}
function blockAnchor(id){ return "blk-" + String(id).split("/").pop(); }
function blockLeaf(b, secTitle){
  var words = String(b.content || (b.summary && b.summary.text) || "").replace(/\s+/g, " ").trim().split(" ").slice(0, 10).join(" ");
  var t = b.title && b.title !== secTitle ? b.title : words ? words + "…" : b.title || String(b.id).split("/").pop();
  return '<li class="leaf blk"><span class="pill">' + esc(b.kind || "block") + '</span> <a href="#' + esc(blockAnchor(b.id)) +
    '" data-blk="' + esc(blockAnchor(b.id)) + '">' + esc(t) + '</a></li>';
}
/* Nest a flat list by its levels: node = { item, kids: [node index] }. */
function docNest(items){
  var nodes = [], i = 0;
  function level(lv){
    var out = [];
    while (i < items.length && (items[i].level || 1) >= lv) {
      var n = nodes.push({ item: items[i++], kids: [] }) - 1;
      if (i < items.length && (items[i].level || 1) > (nodes[n].item.level || 1)) nodes[n].kids = level((nodes[n].item.level || 1) + 1);
      out.push(n);
    }
    return out;
  }
  /* From the shallowest level, so an item above the first one's is not dropped. */
  var top = items.length ? level(Math.min.apply(null, items.map(function(x){ return x.level || 1; }))) : [];
  return { nodes: nodes, top: top };
}
/* The <li> of each node in ns. A node that is the ONLY one at its level
   starts open (an outline whose single root is the book's title would
   otherwise collapse to one line, 9789241548960-eng), so its children are
   built now; every other node's are built on its first toggle. */
function docTreeItems(ns){
  var only = ns.length === 1;
  return ns.map(function(k){
    var n = DOC_TREE[k];
    if (!n.kids.length && !n.blocks.length) return '<li class="leaf">' + n.line + '</li>';
    return '<li><details data-node="' + k + '"' + (only ? ' open' : '') + '><summary>' + n.line + '</summary><ul data-kids="' + k + '"' +
      (only ? ' data-built="1">' + docTreeKids(k) : '>') + '</ul></details></li>';
  }).join("");
}
function docTreeKids(k){
  var n = DOC_TREE[k];
  return docTreeItems(n.kids) + n.blocks.map(function(b){ return blockLeaf(b, n.title); }).join("");
}
function docTreeBuild(details){
  var ul = details.querySelector("ul[data-kids]");
  if (!ul || ul.getAttribute("data-built")) return;
  ul.setAttribute("data-built", "1");
  ul.innerHTML = docTreeKids(Number(ul.getAttribute("data-kids")));
}
/* An INFERRED contents lists what the contents pages print. A section the
   rung cut that no entry names -- the front matter, or the 30 chapters of
   Parts 2 and 3 that 10665-75211's oversized split cut by running heads --
   was not in the tree at all. Each is placed among the entries by its first
   page, at its own level, and says it is not listed. An outline is the
   PDF's own and is shown as it is. */
function docTocWithSections(d){
  if (d.tocSource === "outline") return d.toc;
  var named = {};
  d.toc.forEach(function(e){ if (e.section) named[e.section] = true; });
  var extra = d.sections.filter(function(s){ return !named[s.id] && s.pageStart != null; }).map(function(s){
    return { level: s.level || 1, title: s.title, number: s.number, page: s.pageStart, pageLabel: s.labelStart, section: s.id, unlisted: true };
  });
  if (!extra.length) return d.toc;
  var out = [], j = 0;
  d.toc.forEach(function(e){
    while (j < extra.length && e.page != null && extra[j].page < e.page) out.push(extra[j++]);
    out.push(e);
  });
  return out.concat(extra.slice(j));
}
function docContents(d){
  var bySec = {};
  d.sections.forEach(function(s){ bySec[s.id] = s; });
  var blocksOf = docBlocksBySection(d);
  var useToc = d.toc.length > 0, items = useToc ? docTocWithSections(d) : d.sections;
  if (!items.length) return d.variant && d.variant !== "pdf"
    ? '<p class="empty">No sections: the source has no headings.</p>'
    : '<p class="empty">No table of contents: the PDF carries no outline and none could be inferred.</p>';
  function line(e){
    var sid = useToc ? e.section : e.id, s = sid && bySec[sid];
    var t = (e.number ? esc(e.number) + ' ' : '') + esc(e.title);
    var link = sid ? '<a href="#sec-' + esc(sid) + '" data-sec="' + esc(sid) + '">' + t + '</a>' : t;
    var where = useToc && e.unlisted ? ' <span class="note">' + pageText(e.page, e.pageLabel) + ' · a section the contents do not list</span>'
      : useToc ? ' <span class="note">' + pageText(e.page, e.pageLabel) + '</span> ' + confPill(e.confidence, e.evidence)
      : e.pageStart != null ? ' <span class="note">' + pageText(e.pageStart, e.labelStart) + '</span>' : '';
    return link + where + (s && s.edit && d.links ? ' ' + editHost(s) : '');
  }
  var t = docNest(items);
  DOC_TREE = t.nodes.map(function(n){
    var sid = useToc ? n.item.section : n.item.id;
    return { line: line(n.item), title: n.item.title, kids: n.kids, blocks: (sid && blocksOf[sid]) || [] };
  });
  var how = !useToc
    ? (d.variant && d.variant !== "pdf" ? "Contents: the source’s own headings."
      : "No outline: the PDF carries none and none could be inferred, so its sections are listed.") + ' ' + d.sections.length + ' sections.'
    : 'Source: ' + (d.tocSource === "outline" ? "the PDF’s own outline"
      : "inferred (" + esc(d.tocMethod || "unknown") + "); each entry’s confidence and the evidence behind it are shown") + '. ' + d.toc.length + ' entries.' +
      (items.length > d.toc.length ? ' ' + (items.length - d.toc.length) + ' section(s) the contents do not list are shown at their place.' : '');
  return '<p class="note">' + how + (DOC_BLOCKS ? '' : ' Blocks are listed once the block graph has loaded.') + '</p>' +
    '<p><button type="button" data-toc="open">Expand all</button> <button type="button" data-toc="close">Collapse all</button></p>' +
    '<ul class="toc">' + docTreeItems(t.top) + '</ul>';
}
function docPages(d){
  if (!d.pageLabels) return notRecorded("Page labels");
  var secAt = {}, figAt = {};
  d.sections.forEach(function(s){ if (s.pageStart != null) (secAt[s.pageStart] = secAt[s.pageStart] || []).push(s); });
  (d.figures || []).forEach(function(f){ (figAt[f.page] = figAt[f.page] || []).push(f); });
  return '<table><thead><tr><th>page</th><th>printed label</th><th>sections starting</th><th>figures &amp; tables</th></tr></thead><tbody>' +
    d.pageLabels.map(function(p){
      var secs = (secAt[p.physical] || []).map(function(s){
        return '<a href="#sec-' + esc(s.id) + '" data-sec="' + esc(s.id) + '">' + esc((s.number ? s.number + ' ' : '') + s.title) + '</a>'; }).join('<br>');
      var figs = (figAt[p.physical] || []).map(function(f){ return esc(f.kind + ' ' + f.number); }).join(', ');
      var lab = p.label ? esc(p.label) + ' <span class="note">' + esc(p.source) + '</span>' : '<span class="note">none printed</span>';
      return '<tr><td class="num">' + p.physical + '</td><td>' + lab + '</td><td>' + secs + '</td><td>' + figs + '</td></tr>';
    }).join("") + '</tbody></table>';
}
/* FIGURES AND TABLES SHOWN -- who-iris#224. Each kept figure as its picture
   with its description in the page's language (else English, else the first),
   and each transcribed table drawn from its cells. Every description is an
   agent draft until a person confirms it, and the page says so. */
function docLang(){
  var l = (document.documentElement.getAttribute("lang") || "en").toLowerCase().split("-")[0];
  return l || "en";
}
function pickNarrative(m){
  if (!m) return "";
  var l = docLang();
  if (m[l]) return m[l];
  if (m.en) return m.en;
  for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) return m[k];
  return "";
}
function docFileHref(id, file){
  var dir = DATA_HREF.slice(0, DATA_HREF.lastIndexOf("/") + 1);
  return dir + "files/" + encodeURIComponent(id) + "/" + file.split("/").map(encodeURIComponent).join("/");
}
/* A FIGURE'S SHORT NAME -- owner, 2026-11-14: "very duplicative and long
   text. blue figure titles should be shortened". The description opens with
   the figure's own label as the caption gives it ("Fig. 10, 'Product
   packaging hierarchy' (source: ...)"), so that label is the name. Failing
   it, the caption the text carries on the same page; failing that, the
   description's first words. Never the whole description. */
var FIG_LABEL = /^\s*((?:Fig(?:ure)?|Graph|Chart|Map|Box)\.?\s*[A-Z]?\d+[a-z]?)\s*[,:.–-]?\s*['‘"“]([^'’"”]{1,120})['’"”]\s*[.,;:]?\s*/i;
function figName(im, d){
  var text = pickNarrative(im.narratives);
  var m = FIG_LABEL.exec(text);
  if (m) return m[1] + " · " + m[2];
  var c = (d.figures || []).filter(function(f){ return f.page === im.page && /fig/i.test(f.kind) && f.title; })[0];
  if (c) return (c.number ? c.kind + " " + c.number + " · " : "") + c.title;
  var w = text.split(/\s+/).slice(0, 8).join(" ");
  return w ? w + (text.length > w.length ? "…" : "") : im.id;
}
/* THE GALLERY: a THUMBNAIL that pops out -- owner, 2026-11-14: "i wanted to
   actually see the figure thumbnail as a popout", "figures should be
   vertically stacked". One figure per row: its thumbnail, its short name on
   one line and its page; the description is in the
   popout only, so it is said once. Thumbnails load as they scroll near
   (loading="lazy"); the popout is one <dialog>, built on first use. */
function docGallery(d){
  if (!d.images || !d.images.length) return "";
  DOC_GALLERY = d;
  return '<h3>Figures <span class="note">(' + d.images.length + ')</span></h3>' +
    '<p class="note">Select a figure to see it large with its description. Descriptions are drafts written by an agent and not yet reviewed.</p>' +
    '<div class="doc-gallery">' + d.images.map(function(im, i){
      var name = figName(im, d);
      return '<figure class="doc-figure" id="fig-' + esc(im.id) + '">' +
        '<button type="button" class="fig-thumb" data-fig="' + i + '" title="' + esc(name) + '">' +
        '<img loading="lazy" decoding="async" src="' + esc(docFileHref(DOC_ID, im.file)) + '" alt="' + esc(name) + '"></button>' +
        '<figcaption><span class="fig-name" title="' + esc(name) + '">' + esc(name) + '</span> <span class="note">' +
        pageText(im.page, null) + '</span></figcaption></figure>';
    }).join("") + '</div>';
}
var DOC_GALLERY = null;
function figPopout(i){
  var d = DOC_GALLERY, im = d && d.images[i];
  if (!im) return;
  var dlg = document.getElementById("fig-pop");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "fig-pop"; dlg.className = "fig-pop";
    (document.querySelector(".lib-page") || document.body).appendChild(dlg);
    /* A click on the backdrop (the dialog itself, outside its box) closes it. */
    dlg.addEventListener("click", function(ev){ if (ev.target === dlg || (ev.target.closest && ev.target.closest("[data-fig-close]"))) dlg.close(); });
  }
  var rtl = { ar: 1, fa: 1, he: 1, ur: 1 }[docLang()] ? ' dir="rtl"' : '';
  var href = docFileHref(DOC_ID, im.file), name = figName(im, d), full = pickNarrative(im.narratives);
  /* The heading already names the figure: the description goes on from there. */
  var named = FIG_LABEL.test(full), text = named ? full.replace(FIG_LABEL, "") : full;
  var shows = named ? [] : (im.shows || []);
  dlg.innerHTML = '<div class="fig-pop-box"><button type="button" class="fig-pop-x" data-fig-close aria-label="Close">×</button>' +
    '<h3>' + esc(name) + ' <span class="note">' + pageText(im.page, null) + '</span></h3>' +
    '<img decoding="async" src="' + esc(href) + '" alt="' + esc(name) + '">' +
    '<p' + rtl + '>' + (shows.length ? '<strong>' + esc(shows.join(", ")) + '.</strong> ' : '') + esc(text) + '</p>' +
    '<p class="note">Agent draft, not yet reviewed. <a href="' + esc(href) + '" target="_blank" rel="noopener">Open the image on its own</a></p></div>';
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
}
function docTable(t){
  var groups = t.columns.some(function(c){ return c.group; });
  var head = "";
  if (groups) {
    var cells = [], i = 0;
    while (i < t.columns.length) {
      var g = t.columns[i].group || "", n = 1;
      while (i + n < t.columns.length && (t.columns[i + n].group || "") === g && g) n++;
      cells.push('<th' + (n > 1 ? ' colspan="' + n + '"' : '') + '>' + esc(g) + '</th>');
      i += n;
    }
    head += '<tr>' + cells.join("") + '</tr>';
  }
  head += '<tr>' + t.columns.map(function(c){ return '<th>' + esc(c.titles) + '</th>'; }).join("") + '</tr>';
  var body = t.rows.map(function(r){ return '<tr>' + r.map(function(c){ return '<td>' + esc(c) + '</td>'; }).join("") + '</tr>'; }).join("");
  var text = pickNarrative(t.narratives);
  return '<details class="doc-table"><summary><strong>' + esc(t.caption || t.label) + '</strong> <span class="note">' +
    (t.pages.length ? 'p' + t.pages.join("\u2013") : '') + ', ' + t.rows.length + ' rows</span></summary>' +
    (text ? '<p>' + esc(text) + '</p>' : '') +
    '<div class="doc-table-scroll"><table>' + '<thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
    (t.notes ? '<p class="note">' + esc(t.notes) + '</p>' : '') +
    '<p class="note"><a href="' + esc(docFileHref(DOC_ID, t.csv)) + '">CSV</a></p></details>';
}
function docTables(d){
  if (!d.tables || !d.tables.length) return "";
  return '<h3>Tables <span class="note">(' + d.tables.length + ', transcribed from the pages; drafts)</span></h3>' + d.tables.map(docTable).join("");
}
function docFigures(d){
  var shown = docGallery(d) + docTables(d);
  if (!d.figures) return shown + notRecorded("Figures and tables");
  if (!d.figures.length) return shown + '<p class="empty">No captions found. Nothing failed — none opens a line with a label and number.</p>';
  var gaps = (d.checks.figureSequenceGaps || []);
  return shown + (shown ? '<h3>Captions in the text</h3>' : '') + (gaps.length ? '<p class="note">Numbering gaps in the document: ' + esc(gaps.join(", ")) + '.</p>' : '') +
    '<table><thead><tr><th>kind</th><th>no.</th><th>caption</th><th>page</th><th>confidence</th></tr></thead><tbody>' +
    d.figures.map(function(f){
      return '<tr><td>' + esc(f.kind) + '</td><td>' + esc(f.number) + '</td><td>' + (f.title ? esc(f.title) : '<span class="note">withheld</span>') +
        '</td><td>' + pageText(f.page, f.pageLabel) + '</td><td>' + confPill(f.confidence, f.evidence) + '</td></tr>';
    }).join("") + '</tbody></table>';
}
function chips(ks){
  /* A keyword a heading also names is marked: the document saying it of itself. */
  if (!ks || !ks.length) return "";
  return '<p class="kw">' + ks.map(function(k){
    return '<span class="pill' + (k.heading ? ' ok' : '') + '"' + (k.heading ? ' title="also named by a heading"' : '') + '>' + esc(k.term) + '</span>';
  }).join(" ") + '</p>';
}
/* LINKS -- bean zcak, from the shared recipe (edit-links, bean v433). The
   library is frozen, so [source] and [feedback] are about the library's own
   section file, and [edit] opens the folio block MATERIALISED from the
   section, when there is one. Each is its own host, so the runtime builds
   every href from that host's data-src and nothing else. */
function editHost(s){
  return '<span class="doc-actions" data-src="' + esc(s.edit.path) + '" data-block="' + esc(s.edit.label) + '">' +
    '<a data-fa-link="edit" title="Edit the folio block made from this section (the library copy is frozen)">✎ edit</a></span>';
}
function secActions(d, s){
  if (!d.links) return '';
  var t = (s.number ? s.number + ' ' : '') + s.title;
  return ' <span class="doc-actions" data-src="' + esc(d.links.dir + '/sections/' + s.id + '.md') + '" data-block="' + esc(s.id) +
    '" data-sec="' + esc(t) + '"><a data-fa-link="source" title="This section as extracted, on GitHub">source</a> ' +
    '<a data-fa-link="feedback" title="Give feedback on this section (opens a GitHub issue)">📣 feedback</a></span>' +
    (s.edit ? ' ' + editHost(s) : '');
}
function docSections(d){
  if (!d.sections.length) return '<p class="empty">No sections.</p>';
  return d.sections.map(function(s){
    var range = s.pageStart == null ? "" : pageText(s.pageStart, s.labelStart) +
      (s.pageEnd != null && s.pageEnd !== s.pageStart ? ' – ' + pageText(s.pageEnd, s.labelEnd) : '');
    var body = s.summary
      ? '<div class="sum"><span class="pill info">summary · ' + esc(s.summary.status) + '</span><p>' + esc(s.summary.text) + '</p></div>'
      : s.extract
        ? '<div class="sum"><span class="pill">extract — the section’s own opening text' + (s.extractCut ? ', cut' : '') + '</span><p>' + esc(s.extract) + (s.extractCut ? '…' : '') + '</p></div>'
        : '<p class="note">' + (d.withheld ? 'Withheld — no text published; no summary yet.' : 'No text and no summary.') + '</p>';
    return '<article id="sec-' + esc(s.id) + '" class="docsec"><h3>' + esc((s.number ? s.number + ' ' : '') + s.title) +
      ' <span class="note">' + range + ' · ' + s.words + ' words</span>' + secActions(d, s) + '</h3>' + chips(s.keywords) + body + '</article>';
  }).join("");
}
function docChecks(d){
  var c = d.checks, rows = [];
  function row(name, n, items){
    var cell = !items || !items.length ? '<span class="note">none</span>'
      : '<details><summary>' + items.length + (n > items.length ? ' of ' + n : '') + ' shown</summary><ul>' +
        items.map(function(i){ return '<li>' + esc(i) + '</li>'; }).join("") + '</ul></details>';
    rows.push('<tr><td>' + esc(name) + '</td><td class="num">' + n + '</td><td>' + cell + '</td></tr>');
  }
  if (c.tocAlignment) {
    var names = { listed_not_found: "On the contents page, not found in the body",
      found_not_listed: "Numbered in the body, missing from the contents page", page_mismatch: "Page differs from the contents page" };
    Object.keys(names).forEach(function(k){ var v = c.tocAlignment[k]; if (v) row(names[k], v.count, v.items); });
  }
  if (c.figureSequenceGaps) row("Figure and table numbering gaps", c.figureSequenceGaps.length, c.figureSequenceGaps);
  if (c.pageLabelConflicts) row("Page-label conflicts (built-in label vs printed)", c.pageLabelConflicts.count, c.pageLabelConflicts.items);
  if (!rows.length) return '<p class="empty">No checks recorded for this entry.</p>';
  return '<p class="note">Findings about the DOCUMENT, reported and never corrected \u2014 drafts drift.</p>' +
    '<table><thead><tr><th>check</th><th>count</th><th>items</th></tr></thead><tbody>' + rows.join("") + '</tbody></table>';
}
/* WHAT WAS EXTRACTED -- one line of pills, kind by kind (owner,
   2026-11-14: "why no biblio, glossary, etc here"). Words, never colour
   alone: "none in the text" is a finding, "not extracted" is a gap. */
/* PRINTING LOADS EVERYTHING FIRST -- owner, 2026-11-14: "Make sure printing
   loads all of the content before it renders the PDF on the browser". What
   this panel defers for the screen -- lazy thumbnails, figure descriptions
   kept for the popout, the contents tree built on toggle, summaries behind a
   disclosure -- is all made present before a print:
   - the "Print / PDF" button prepares, WAITS for every image, then prints;
   - the browser's own print (Ctrl+P) gets the same preparation on
     beforeprint; the images are switched to eager there too, and afterprint
     closes again what the preparation opened. */
var PRINT_OPENED = [];
function docPrintPrep(){
  var root = document.querySelector(".lib-page") || document;
  /* The contents tree and every disclosure in the panels, built and open. */
  for (var ds; (ds = root.querySelectorAll("ul.toc details:not([open])")).length;)
    Array.prototype.forEach.call(ds, function(x){ docTreeBuild(x); x.open = true; PRINT_OPENED.push(x); });
  Array.prototype.forEach.call(root.querySelectorAll("#document details:not([open]), #blocks details:not([open])"), function(x){ x.open = true; PRINT_OPENED.push(x); });
  /* Each figure's description, said in print as the popout says it on screen. */
  if (DOC_GALLERY) Array.prototype.forEach.call(root.querySelectorAll(".doc-figure button.fig-thumb[data-fig]"), function(b){
    var fig = b.closest(".doc-figure");
    if (!fig || fig.querySelector(".fig-print-desc")) return;
    var im = DOC_GALLERY.images[+b.getAttribute("data-fig")];
    var p = document.createElement("p");
    p.className = "fig-print-desc";
    p.textContent = im ? pickNarrative(im.narratives) : "";
    fig.appendChild(p);
  });
  /* Every image fetched now, not when it would have scrolled into view. */
  var imgs = Array.prototype.slice.call(root.querySelectorAll("img"));
  imgs.forEach(function(i){ if (i.loading === "lazy" || i.getAttribute("loading") === "lazy") i.loading = "eager"; });
  return Promise.all(imgs.map(function(i){
    if (i.complete && i.naturalWidth) return null;
    return new Promise(function(ok){
      var done = function(){ ok(null); };
      i.addEventListener("load", done, { once: true });
      i.addEventListener("error", done, { once: true });
      setTimeout(done, 15000);
    });
  }));
}
function docPrintDone(){
  PRINT_OPENED.forEach(function(x){ x.open = false; });
  PRINT_OPENED = [];
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("beforeprint", function(){ docPrintPrep(); });
  window.addEventListener("afterprint", docPrintDone);
}
var COVER_NAMES = { contents: "Contents", sections: "Sections", figures: "Figures", tables: "Tables",
  references: "References", glossary: "Glossary", footnotes: "Footnotes", summaries: "Summaries" };
function docCoverage(d){
  if (!d.coverage || !d.coverage.length) return "";
  return '<p class="doc-cover"><span class="note">What was extracted:</span> ' + d.coverage.map(function(c){
    var word = c.state === "found" ? (c.count != null ? String(c.count) : "found")
      : c.state === "partial" ? (c.count != null ? c.count + ", partial" : "partial")
      : c.state === "none" ? "none in the text" : "not extracted";
    var cls = c.state === "found" ? "ok" : c.state === "none" ? "" : "warn";
    return '<span class="pill ' + cls + '"' + (c.note ? ' title="' + esc(c.note) + '"' : '') + '>' +
      esc(COVER_NAMES[c.kind] || c.kind) + ': ' + esc(word) + '</span>';
  }).join(" ") + '</p>';
}
/* THE SHARED LINK RUNTIME (edit-links.js), which the page's head loads with
   defer: viewer.js runs before it, so the first document can render before
   it is there. Wait for it -- deferred scripts have all run by
   DOMContentLoaded -- and on a host whose head has none, load it from the
   site root, as navbar-row.js loads its vendor scripts. */
var EDIT_LINKS_WAIT = null;
function withEditLinks(fn){
  if (window.faEditLinks) { fn(window.faEditLinks); return; }
  if (!EDIT_LINKS_WAIT) EDIT_LINKS_WAIT = new Promise(function(done){
    function load(){
      if (window.faEditLinks) { done(window.faEditLinks); return; }
      var root = typeof SITE_ROOT === "string" ? SITE_ROOT : "/";
      var s = document.createElement("script");
      s.src = root + "assets/js/edit-links.js";
      s.onload = function(){ done(window.faEditLinks || null); };
      s.onerror = function(){ done(null); };
      document.head.appendChild(s);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
    else load();
  });
  EDIT_LINKS_WAIT.then(function(L){ if (L) fn(L); });
}
var DOC_TABS = [["contents","Contents",docContents],["pages","Pages",docPages],["figures","Figures & tables",docFigures],["sections","Sections",docSections],["checks","Checks",docChecks]];
function renderDocument(id, d, err){
  var el = $("document");
  /* No structure.json: nothing in this schema to show, a determined answer
     served as a file (absent: true), never a 404 to tell from a failure. */
  if (!err && d && d.absent) { el.hidden = true; return; }
  el.hidden = false;
  if (err) { el.innerHTML = '<h2>Document</h2><p class="empty">Could not read the document view for ' + esc(id) + ' — ' + esc(err) + '. This is a failure to read, not an empty document.</p>'; return; }
  DOC = d; DOC_ID = id;

  var tab = DOC_TABS.filter(function(t){ return t[0] === DOC_TAB; })[0] || DOC_TABS[0];
  var whole = d.links ? ' <span class="doc-actions" data-src="' + esc(d.links.dir) + '" data-block="' + esc(id) + '"><a data-fa-link="source">source</a> ' +
    '<a data-fa-link="feedback" title="Give feedback on this document (opens a GitHub issue)">📣 feedback</a></span>' : '';
  /* An unknown page count is said as unknown, never as "0 pages". */
  var size = d.variant && d.variant !== "pdf" ? d.sections.length + ' sections'
    : d.pages ? d.pages + ' pages'
    : d.pagesCovered ? 'page count not recorded; sections reach page ' + d.pagesCovered
    : 'page count not recorded';
  el.innerHTML = '<h2>Document — ' + esc(d.title || id) + ' <span class="note">(' + size + ')</span>' + whole +
    ' <button type="button" class="doc-print" title="Load every figure and section, then print or save as PDF">Print / PDF</button></h2>' +
    docCoverage(d) +
    '<div class="seg" role="tablist" aria-label="Document view">' + DOC_TABS.map(function(t){
      return '<button type="button" role="tab" aria-selected="' + (t[0] === tab[0]) + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join("") + '</div>' + (d.keywords && d.keywords.length ? '<div class="dockw"><span class="note">Keywords (LSI):</span> ' + chips(d.keywords) + '</div>' : '') +
    '<div class="docbody" role="tabpanel">' + tab[2](d) + '</div>';
  Array.prototype.forEach.call(el.querySelectorAll("[data-tab]"), function(b){
    b.addEventListener("click", function(){ DOC_TAB = b.getAttribute("data-tab"); renderDocument(id, DOC, null); });
  });
  Array.prototype.forEach.call(el.querySelectorAll("[data-toc]"), function(b){
    b.addEventListener("click", function(){
      if (b.getAttribute("data-toc") !== "open") {
        Array.prototype.forEach.call(el.querySelectorAll("ul.toc details"), function(x){ x.open = false; });
        return;
      }
      /* Opening builds children, which may be nodes of their own: repeat
         until every node is open. */
      for (var ds; (ds = el.querySelectorAll("ul.toc details:not([open])")).length;)
        Array.prototype.forEach.call(ds, function(x){ docTreeBuild(x); x.open = true; });
    });
  });
  /* toggle does not bubble, so it is caught on the way down; once per panel. */
  if (!el.getAttribute("data-tree")) {
    el.setAttribute("data-tree", "1");
    el.addEventListener("toggle", function(ev){
      var t = ev.target;
      if (t && t.matches && t.matches("ul.toc details[data-node]") && t.open) docTreeBuild(t);
    }, true);
    /* A block leaf scrolls to its row in the Blocks panel; the address is
       left alone, since a changed hash re-reads the whole entry. */
    el.addEventListener("click", function(ev){
      /* Print: prepare, wait for every image, then print. */
      if (ev.target && ev.target.closest && ev.target.closest("button.doc-print")) {
        docPrintPrep().then(function(){ window.print(); });
        return;
      }
      /* A figure's thumbnail opens its popout. */
      var fb = ev.target && ev.target.closest && ev.target.closest("button.fig-thumb[data-fig]");
      if (fb) { figPopout(+fb.getAttribute("data-fig")); return; }
      var a = ev.target && ev.target.closest && ev.target.closest("a[data-blk]");
      if (!a) return;
      ev.preventDefault();
      var r = document.getElementById(a.getAttribute("data-blk")); if (r) r.scrollIntoView({ block: "center" });
    });
  }
  /* Hrefs now, not on first hover: a keyboard reader tabs to these links.
     Configured and filled together, once the shared runtime is there. */
  if (d.links) withEditLinks(function(L){
    if (DOC !== d || DOC_ID !== id) return;   /* another entry or tab since */
    L.configure({ repo: d.links.repo, branch: d.links.branch, content: id });
    L.fill(el);
  });
  /* A section link from any tab opens the Sections tab at that section. Only
     <a>: a link HOST carries data-sec too (its section's name, for an issue). */
  Array.prototype.forEach.call(el.querySelectorAll("a[data-sec]:not([data-fa-link])"), function(a){
    a.addEventListener("click", function(ev){
      ev.preventDefault(); DOC_TAB = "sections"; renderDocument(id, DOC, null);
      var t = document.getElementById("sec-" + a.getAttribute("data-sec")); if (t) t.scrollIntoView();
    });
  });
}
/* An address naming a section (#sec-<id>), from the rail's contents or a
   link from anywhere, opens the Sections tab at it: the section exists only
   on that tab, so a bare fragment would scroll to nothing. */
function openSectionFromHash(){
  var h = decodeURIComponent(location.hash || "");
  if (h.indexOf("#sec-") !== 0 || !DOC) return;
  if (DOC_TAB !== "sections") { DOC_TAB = "sections"; renderDocument(DOC_ID, DOC, null); }
  var t = document.getElementById(h.slice(1)); if (t) t.scrollIntoView();
}
window.addEventListener("hashchange", openSectionFromHash);
/* "no-cache", not "no-store": revalidated every time, so never stale, but an
   unchanged structure.json is a 304 rather than its body again. */
function fetchDocument(id){
  return fetch(docHref(id), {cache: "no-cache"})
    .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
}
/* takeEarly is the viewer's (gen-library-viz.ts): the response the entry page
   started before its index arrived. Without it, this fetches. */
function loadDocument(id){
  (typeof takeEarly === "function" ? takeEarly("document", id, fetchDocument) : fetchDocument(id))
    .then(function(d){ renderDocument(id, d, null); openSectionFromHash(); })
    .catch(function(e){ renderDocument(id, null, String(e && e.message || e)); });
}
`;
