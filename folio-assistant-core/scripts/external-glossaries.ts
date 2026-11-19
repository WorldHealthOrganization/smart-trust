/**
 * The external glossaries a document cites, shown where its own glossary
 * starts.
 *
 * Owner, 2026-11-02, of the DTH-HRH handbook and the ingested WHO 2015 HRHIS
 * registry glossary: "as it is a referenced external glossary can we link to
 * it in the DTH-HRH glossary ... make that a feature of any ingested external
 * library reference with a glossary".
 *
 * A layer names an external glossary the way it names any graph it does
 * not hold: a `remoteGraphs` entry with `graphTypologies: ["glossary"]` in its
 * declaration (the platform glossary page already lists those). An ingested
 * library entry's glossary (for example an L1 catalogue's SKOS scheme for a WHO
 * guide) is declared the same way, by its published address. This module
 * reads those entries and puts one short note above the document's first
 * glossary entry, so a reader sees the external glossaries next to the
 * document's own terms. They are external references, not definitions: the
 * note says so.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { readDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import type { Chapter, Paper, Section, SectionRef } from "@litlfred/cat-harness-tools/schemas/types.js";

export interface ExternalGlossary {
  id: string;
  url: string;
  title?: string;
}

/** The external glossaries the layer at `repoRoot` declares, in declaration order. */
export function externalGlossaries(repoRoot: string): ExternalGlossary[] {
  const decl = readDeclaration(repoRoot);
  return (decl?.remoteGraphs ?? [])
    .filter((g) => g.graphTypologies.includes("glossary"))
    .map((g) => ({ id: g.id, url: g.url, ...(typeof g.title === "string" && g.title ? { title: g.title } : {}) }));
}

const isRef = (s: Section | SectionRef): s is SectionRef => !("blocks" in s);

/**
 * The label of the first entry of the document's glossary: the section with
 * the most blocks whose `meta.glossary` names a term (a term defined in
 * passing in the narrative also carries one, so the first such block is not
 * enough), and its first such block.
 */
export async function firstGlossaryLabel(manifestPath: string): Promise<string | undefined> {
  const docDir = dirname(manifestPath);
  const paper = (await import(manifestPath)).default as Paper;
  let best: { n: number; first: string } | undefined;
  for (const chRef of paper.chapters) {
    const chDir = join(docDir, chRef.dir);
    const chPath = join(chDir, `${chRef.dir}.ts`);
    if (!existsSync(chPath)) continue;
    const chapter = (await import(chPath)).default as Chapter;
    const walk = async (secs: Array<Section | SectionRef>): Promise<void> => {
      for (const sec of secs) {
        if (isRef(sec)) continue;
        const entries: string[] = [];
        for (const root of sec.blocks) {
          const ts = join(chDir, `${root}.ts`);
          if (!existsSync(ts)) continue;
          const b = (await import(ts)).default as { label?: string; meta?: { glossary?: unknown } };
          const g = b.meta?.glossary;
          if (b.label && g && typeof g === "object" && !Array.isArray(g) && "term" in g) entries.push(b.label);
        }
        if (entries.length > (best?.n ?? 0)) best = { n: entries.length, first: entries[0]! };
        if (sec.subsections) await walk(sec.subsections);
      }
    };
    await walk(chapter.sections);
  }
  return best?.first;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The note: each external glossary by name, linked, and what it is for. */
export function externalGlossaryNote(list: readonly ExternalGlossary[]): string {
  if (list.length === 0) return "";
  const links = list.map((g) => `<a href="${esc(g.url)}" rel="external">${esc(g.title ?? g.id)}</a>`).join(" · ");
  const what = list.length === 1 ? "glossary" : "glossaries";
  return `<aside class="fa-ext-glossaries" aria-label="External ${what}"><span class="fa-block-kind">External ${what}</span> ${links}. <span class="fa-ext-glossaries-note">Cited as external sources, not as definitions; the terms below are this document's working definitions.</span></aside>\n`;
}

/**
 * The page with the note placed just before the first glossary entry's
 * anchor paragraph. A page with no glossary entry, or nothing to cite, is
 * returned unchanged.
 */
export function withExternalGlossaries(html: string, firstLabel: string | undefined, list: readonly ExternalGlossary[]): string {
  if (!firstLabel || list.length === 0) return html;
  const at = html.indexOf(`<p><a id="${esc(firstLabel)}"></a>`);
  return at < 0 ? html : html.slice(0, at) + externalGlossaryNote(list) + html.slice(at);
}
