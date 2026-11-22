/**
 * The structured-assets page of a document: every requirement, persona,
 * scenario, data element (and any other structured kind) the document holds,
 * one table per kind, each row linked to its card in the text.
 *
 * Owner, 2026-11-01, of the DTH drafts: "is there a requirements viewer
 * already?", "look at all the structured assets... not just requirements";
 * card Q-SAV-1 = A, "one Structured assets page per document".
 *
 * The page sits at `<page dir>/assets/` beside the document page, so a row
 * links to `../#<label>` and the cards' kind labels link back to
 * `assets/#<kind>` ({@link linkKindLabels}). The fields come from the block
 * manifests, not from the text, so the page shows exactly what the KG holds.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { kindHeading } from "@litlfred/cat-harness-tools/schemas/content/translation.js";
import type { Chapter, Paper, Section, SectionRef } from "@litlfred/cat-harness-tools/schemas/types.js";

/** Kinds that are narrative or pictures, not structured assets. */
const NOT_ASSETS = new Set(["prose", "figure", "diagram", "table", "remark", "note", "example", "proof", "quote"]);

/** Fields that say where a block came from, not what it is. */
const HIDDEN_META = new Set(["source", "requirementId", "indicatorId", "id"]);

/**
 * Kinds whose table shows a chosen set of columns, in this order, rather than
 * every scalar field. An indicator carries a dozen fields (definition,
 * reporting frequency, frameworks…); its table keeps the ones a reader scans
 * by and leaves the rest to its card. Owner, 2026-11-02, card Q-IND-1 = A.
 */
const KIND_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  indicator: ["module", "numerator", "denominator", "unit", "disaggregation", "dataSources"],
};

export interface StructuredAsset {
  kind: string;
  label: string;
  id?: string;
  title?: string;
  /** The section the block sits in, as its heading reads. */
  section: string;
  /** Scalar fields of `meta`, as shown. */
  fields: Record<string, string>;
  /** Labels this block names (a scenario's personas). */
  personas: string[];
}

const isRef = (s: Section | SectionRef): s is SectionRef => !("blocks" in s);

const scalar = (v: unknown): string | undefined =>
  typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : undefined;

/** Every structured block of one document, in manifest order. */
export async function structuredAssets(manifestPath: string): Promise<StructuredAsset[]> {
  const docDir = dirname(manifestPath);
  const paper = (await import(manifestPath)).default as Paper;
  const out: StructuredAsset[] = [];
  for (const chRef of paper.chapters) {
    const chDir = join(docDir, chRef.dir);
    const chPath = join(chDir, `${chRef.dir}.ts`);
    if (!existsSync(chPath)) continue;
    const chapter = (await import(chPath)).default as Chapter;
    const walk = async (secs: Array<Section | SectionRef>) => {
      for (const sec of secs) {
        if (isRef(sec)) continue;
        for (const root of sec.blocks) {
          const ts = join(chDir, `${root}.ts`);
          if (!existsSync(ts)) continue;
          const b = (await import(ts)).default as Record<string, unknown> & { kind?: string; label?: string };
          if (!b.kind || !b.label || NOT_ASSETS.has(b.kind)) continue;
          const meta = b.meta && typeof b.meta === "object" ? (b.meta as Record<string, unknown>) : {};
          const fields: Record<string, string> = {};
          for (const [k, v] of Object.entries(meta)) {
            const s = scalar(v);
            if (s !== undefined && !HIDDEN_META.has(k)) fields[k] = s;
          }
          const id = scalar(meta.requirementId) ?? scalar(meta.indicatorId) ?? scalar(meta.id);
          const title = scalar(b.title) ?? scalar(b.caption);
          out.push({
            kind: b.kind,
            label: b.label,
            ...(id ? { id } : {}),
            ...(title ? { title } : {}),
            section: sec.title,
            fields,
            personas: Array.isArray(b.personas) ? b.personas.filter((p): p is string => typeof p === "string") : [],
          });
        }
        if (sec.subsections) await walk(sec.subsections);
      }
    };
    await walk(chapter.sections);
  }
  return out;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "personaType" -> "Persona type", "minimumDataSet" -> "Minimum data set". */
export function fieldHeading(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The heading a kind's table wears, plural. */
const plural = (h: string): string => (/(s|x|ch|sh)$/i.test(h) ? `${h}es` : /[^aeiou]y$/i.test(h) ? `${h.slice(0, -1)}ies` : `${h}s`);

/** An enum-like value (one word: "must", "person", "to-be-prioritized") shows as a tag. */
const isTag = (v: string): boolean => v.length > 0 && v.length <= 32 && !/\s/.test(v);
/**
 * A cell: one tag per enum-like value, so "A; B" shows two tags like "A" shows
 * one, and a column never mixes tags with the same values as plain text.
 */
export const cellValue = (v: string): string => {
  const items = v.split(/\s*[;,]\s*/).filter(Boolean);
  return items.length > 0 && items.every(isTag) ? items.map((i) => `<span class="fa-assets-tag">${esc(i)}</span>`).join(" ") : esc(v);
};

/**
 * The page body: a title, one tile per kind (its count, linking to its
 * table), a filter box, then one sortable table per kind, in the order the
 * kinds first appear in the document. `toDoc` is the document page's path
 * relative to this page (`../`).
 *
 * Tables wear the site's poster table style (`tableStyle`, the same as every
 * table in the document); the rest is `currentColor` tints, so the page takes
 * the theme's type and colours, light or dark, standalone or themed.
 */
export function structuredAssetsBody(title: string, assets: readonly StructuredAsset[], toDoc = "../"): string {
  const byKind = new Map<string, StructuredAsset[]>();
  for (const a of assets) byKind.set(a.kind, [...(byKind.get(a.kind) ?? []), a]);
  const titleOf = new Map(assets.map((a) => [a.label, a.title ?? a.label]));
  const link = (label: string, text: string, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${esc(toDoc)}#${esc(encodeURIComponent(label))}">${esc(text)}</a>`;
  const parts: string[] = [
    `<div class="fa-assets-page">`,
    `<p class="fa-assets-eyebrow"><a href="${esc(toDoc)}">${esc(title)}</a></p>`,
    `<h1>Structured assets</h1>`,
    `<nav class="fa-assets-tiles" aria-label="Kinds">${[...byKind]
      .map(([k, v]) => `<a class="fa-assets-tile" href="#${esc(k)}"><span class="fa-assets-n">${v.length}</span><span class="fa-block-kind">${esc(plural(kindHeading(k, "en")))}</span></a>`)
      .join("")}</nav>`,
    `<p class="fa-assets-filter"><label>Filter <input type="search" placeholder="id, title, persona, section…" aria-controls="fa-assets-tables"></label></p>`,
    `<div id="fa-assets-tables">`,
  ];
  for (const [kind, rows] of byKind) {
    const all = [...new Set(rows.flatMap((r) => Object.keys(r.fields)))];
    const chosen = KIND_COLUMNS[kind];
    const keys = chosen ? chosen.filter((k) => all.includes(k)) : all;
    const hasId = rows.some((r) => r.id);
    const hasPersonas = rows.some((r) => r.personas.length > 0);
    const head = [hasId ? "Id" : "", "Title", ...keys.map(fieldHeading), hasPersonas ? "Personas" : "", "Section"].filter(Boolean);
    const body = rows.map((r) => {
      const cells = [
        ...(hasId ? [r.id ? link(r.label, r.id, "fa-block-id") : ""] : []),
        link(r.label, r.title ?? r.label),
        ...keys.map((k) => cellValue(r.fields[k] ?? "")),
        ...(hasPersonas ? [r.personas.map((p) => link(p, titleOf.get(p) ?? p)).join(", ")] : []),
        `<span class="fa-assets-section">${esc(r.section)}</span>`,
      ];
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    });
    parts.push(
      `<section class="fa-assets-kind" aria-labelledby="${esc(kind)}">`,
      `<h2 id="${esc(kind)}">${esc(plural(kindHeading(kind, "en")))} <span class="fa-assets-count">${rows.length}</span></h2>`,
      `<table class="fa-assets"><thead><tr>${head.map((h) => `<th scope="col" aria-sort="none"><button type="button">${esc(h)}</button></th>`).join("")}</tr></thead>`,
      `<tbody>\n${body.join("\n")}\n</tbody></table>`,
      `</section>`,
    );
  }
  parts.push(`</div>`, `<p class="fa-assets-back"><a href="${esc(toDoc)}">← Back to the document</a></p>`, `</div>`, ASSETS_STYLE, SORT_SCRIPT);
  return parts.join("\n");
}

/** The page's own look: tiles, tags and chips in currentColor tints, so any theme carries them. */
const ASSETS_STYLE = `<style>
.fa-assets-page { --fa-tint: color-mix(in srgb, currentColor 4%, transparent); --fa-line: color-mix(in srgb, currentColor 18%, transparent); }
.fa-assets-eyebrow { margin: 0 0 .2rem; font-size: .85rem; }
.fa-assets-eyebrow a { text-decoration: none; opacity: .75; }
.fa-assets-page h1 { margin-top: 0; }
.fa-assets-tiles { display: flex; flex-wrap: wrap; gap: .6rem; margin: 1rem 0 1.2rem; }
.fa-assets-tile { display: flex; flex-direction: column; gap: .15rem; min-width: 8.5rem; padding: .55rem .8rem; border-left: 3px solid var(--fa-line); border-radius: 0 6px 6px 0; background: var(--fa-tint); color: inherit; text-decoration: none; }
.fa-assets-tile:hover, .fa-assets-tile:focus-visible { background: color-mix(in srgb, currentColor 8%, transparent); }
.fa-assets-n { font-size: 1.6rem; font-weight: 700; line-height: 1.1; }
.fa-assets-page .fa-block-kind { font-size: .72em; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; opacity: .7; }
.fa-assets-filter input { font: inherit; padding: .3rem .6rem; margin-left: .4rem; min-width: min(22rem, 70vw); border: 1px solid var(--fa-line); border-radius: 4px; background: transparent; color: inherit; }
.fa-assets-kind { margin-top: 1.8rem; }
.fa-assets-kind h2 { display: flex; align-items: baseline; gap: .5rem; }
.fa-assets-count { font-size: .7em; font-weight: 600; padding: .05em .5em; border-radius: 999px; background: var(--fa-tint); border: 1px solid var(--fa-line); }
.fa-assets th button { all: unset; cursor: pointer; }
.fa-assets th button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.fa-assets th[aria-sort="ascending"] button::after { content: " \\25B4"; }
.fa-assets th[aria-sort="descending"] button::after { content: " \\25BE"; }
.fa-assets .fa-block-id { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .85em; font-weight: 600; white-space: nowrap; }
.fa-assets-tag { display: inline-block; font-size: .8em; padding: 0 .45em; margin: .1em .25em .1em 0; border-radius: 3px; border: 1px solid #c9cfd8; white-space: nowrap; }
/* Left-aligned in the reading column ("tables should be left aligned", 2026-11-02), filling it on a wide screen. */
.fa-assets-page table.fa-assets { margin: .8rem 0 0; font-size: .86em; }
@media (min-width: 50rem) { .fa-assets-page table.fa-assets { display: table; width: 100%; } }
.fa-assets-page .fa-assets th { white-space: nowrap; }
.fa-assets-page .fa-assets td { padding: .3rem .55rem; }
.fa-assets-section { opacity: .75; white-space: nowrap; }
.fa-assets tr[hidden] { display: none; }
</style>`;

/** Click a column heading to sort by it, again to reverse; the filter hides rows (and empty tables) that do not match. */
const SORT_SCRIPT = `<script>
(function () {
  document.querySelectorAll("table.fa-assets").forEach(function (t) {
    t.querySelectorAll("th").forEach(function (th, i) {
      th.querySelector("button").addEventListener("click", function () {
        var dir = th.getAttribute("aria-sort") === "ascending" ? -1 : 1;
        t.querySelectorAll("th").forEach(function (h) { h.setAttribute("aria-sort", "none"); });
        th.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
        var body = t.tBodies[0];
        Array.from(body.rows).sort(function (a, b) {
          var x = a.cells[i].textContent.trim(), y = b.cells[i].textContent.trim();
          var nx = Number(x), ny = Number(y);
          return dir * (x !== "" && y !== "" && !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, undefined, { numeric: true }));
        }).forEach(function (r) { body.appendChild(r); });
      });
    });
  });
  var box = document.querySelector(".fa-assets-filter input");
  if (box) box.addEventListener("input", function () {
    var q = box.value.trim().toLowerCase();
    document.querySelectorAll(".fa-assets-kind").forEach(function (s) {
      var shown = 0;
      s.querySelectorAll("tbody tr").forEach(function (r) { var hit = !q || r.textContent.toLowerCase().indexOf(q) >= 0; r.hidden = !hit; if (hit) shown++; });
      s.hidden = shown === 0;
    });
  });
})();
</script>`;

/**
 * On the document page, each card's kind label becomes a link to its kind's
 * table on the assets page (`assets/#<kind>`). Only kinds the page lists are
 * linked, so no link lands on a missing table.
 */
export function linkKindLabels(html: string, kinds: ReadonlySet<string>, toAssets = "assets/"): string {
  return html.replace(
    /(<div class="fa-block fa-block-([a-z0-9-]+)"[^>]*>(?:(?!<div class="fa-block )[\s\S])*?)<span class="fa-block-kind">([^<]*)<\/span>/g,
    (all, before: string, kind: string, text: string) =>
      kinds.has(kind) ? `${before}<a class="fa-block-kind" href="${toAssets}#${kind}" title="Every ${esc(text.toLowerCase())} in this document">${text}</a>` : all,
  );
}

/** A glossary entry a card can link to: its label and its page, relative to the document page. */
export interface GlossaryEntryLink {
  label: string;
  href: string;
  title?: string;
}

/**
 * Data element cards, kept light (owner, 2026-11-02: "data element is a bit
 * heavy on the table... link to glossary for more technical info"; Q-DE-1 A).
 * In each `.fa-block-data-element` card the first table folds behind a
 * "Technical details" toggle, and the element's bold name links to its
 * glossary entry when one has that label (exactly, or as the part before a
 * colon: "Employment status: full-time, …"). Nothing is removed: the table is
 * one click away and stays in the page for search and print.
 */
export function lightenDataElements(html: string, glossary: readonly GlossaryEntryLink[] = []): string {
  const byName = new Map<string, GlossaryEntryLink>();
  for (const g of glossary) {
    const full = g.label.trim().toLowerCase();
    const head = full.split(":")[0]!.trim();
    if (!byName.has(full)) byName.set(full, g);
    if (!byName.has(head)) byName.set(head, g);
  }
  const OPEN = '<div class="fa-block fa-block-data-element"';
  if (!html.includes(OPEN)) return html;
  const parts = html.split(OPEN);
  return parts
    .map((part, i) => {
      if (i === 0) return part;
      // This card's text runs to the next card of any kind.
      const end = part.indexOf('<div class="fa-block ');
      let card = end < 0 ? part : part.slice(0, end);
      const rest = end < 0 ? "" : part.slice(end);
      card = card.replace(/(<div class="table-wrapper">\s*)?<table>[\s\S]*?<\/table>(\s*<\/div>)?/, (t) =>
        `<details class="fa-block-details"><summary>Technical details</summary>\n${t}\n</details>`);
      card = card.replace(/(<(?:span|a) class="fa-block-kind"[^>]*>[^<]*<\/(?:span|a)>\s*)<strong>([^<]+)<\/strong>/, (all, kind: string, name: string) => {
        const g = byName.get(name.replace(/\.\s*$/, "").trim().toLowerCase());
        return g ? `${kind}<strong><a href="${esc(g.href)}"${g.title ? ` title="${esc(g.title)}"` : ""}>${name}</a></strong>` : all;
      });
      return OPEN + card + rest;
    })
    .join("");
}
