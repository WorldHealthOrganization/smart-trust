#!/usr/bin/env bun
/**
 * Warn when a document's glossary or acronyms sit anywhere but its back matter.
 *
 * Owner, 2026-11-02 (card Q-BM-1, option A): every document opens on its
 * title and summary, and ends Annexes, Glossary (terms, then acronyms),
 * References. Acronyms are a SUBSECTION of the glossary, not a chapter of
 * their own: an acronym is a glossary term's SKOS `notation`
 * (folio-glossary/v1), so the acronyms list is a view of the glossary graph.
 *
 * A REPORT, never an edit, and it never fails a build: moving a chapter in an
 * existing document is a decision for its editor (see the
 * `document-structure` skill, "Back matter").
 *
 *   bun run folio-assistant-core/scripts/back-matter-order.ts --document <id> [--repo <dir>] [--json]
 *
 * @module folio-assistant-core/scripts/back-matter-order
 */
import { join, resolve } from "node:path";

import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

export interface OutlineSection { title: string; label?: string }
export interface OutlineChapter { dir: string; title: string; label?: string; sections: OutlineSection[] }
export interface BackMatterFinding { code: "glossary-before-main" | "acronyms-own-chapter" | "acronyms-outside-glossary"; chapter: string; message: string }

const GLOSSARY = /glossar/i;
const ACRONYMS = /acronym|abbreviation/i;
/** Chapters that may follow the glossary: the back matter. */
const BACK = /annex|appendi|reference|bibliograph|glossar|acronym|abbreviation|index/i;

const names = (c: OutlineChapter) => `${c.dir} ${c.title} ${c.label ?? ""}`;
const isGlossaryLike = (s: { title: string; label?: string }) => GLOSSARY.test(`${s.title} ${s.label ?? ""}`) || ACRONYMS.test(`${s.title} ${s.label ?? ""}`);

/** The findings for one document outline, in reading order. Empty when it follows the rule. */
export function backMatterFindings(chapters: OutlineChapter[]): BackMatterFinding[] {
  const out: BackMatterFinding[] = [];
  const firstGlossaryLike = chapters.findIndex((c) => GLOSSARY.test(names(c)) || ACRONYMS.test(names(c)) || c.sections.some(isGlossaryLike));
  if (firstGlossaryLike >= 0) {
    const later = chapters.slice(firstGlossaryLike + 1).filter((c) => !BACK.test(names(c)));
    if (later.length) {
      out.push({
        code: "glossary-before-main",
        chapter: chapters[firstGlossaryLike].dir,
        message: `glossary or acronyms in "${chapters[firstGlossaryLike].title}" come before ${later.length} main chapter(s) (first: "${later[0].title}"); move them to the back matter, after the annexes`,
      });
    }
  }
  const glossaryChapter = chapters.find((c) => GLOSSARY.test(names(c)));
  for (const c of chapters) {
    if (ACRONYMS.test(names(c)) && !GLOSSARY.test(names(c))) {
      out.push({ code: "acronyms-own-chapter", chapter: c.dir, message: `"${c.title}" is a chapter of its own; make it a section of the Glossary chapter` });
    } else if (glossaryChapter && c !== glossaryChapter) {
      for (const s of c.sections.filter((x) => ACRONYMS.test(`${x.title} ${x.label ?? ""}`))) {
        out.push({ code: "acronyms-outside-glossary", chapter: c.dir, message: `section "${s.title}" belongs in the Glossary chapter ("${glossaryChapter.title}")` });
      }
    }
  }
  return out;
}

/** The outline of `<folio dir>/<document>/`, read from its manifests; the folio directory is the one the repo declares. */
export async function loadOutline(repo: string, document: string): Promise<OutlineChapter[]> {
  const folio = join(folioDir(repo), document);
  const paper = (await import(join(folio, `${document}.ts`))).default as { chapters: Array<{ dir: string }> };
  const out: OutlineChapter[] = [];
  for (const { dir } of paper.chapters) {
    const ch = (await import(join(folio, dir, `${dir}.ts`))).default as { title: string; label?: string; sections?: Array<{ title: string; label?: string; subsections?: OutlineSection[] }> };
    const sections = (ch.sections ?? []).flatMap((s) => [s, ...(s.subsections ?? [])]).map((s) => ({ title: s.title, label: s.label }));
    out.push({ dir, title: ch.title, label: ch.label, sections });
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const document = opt("document");
  if (!document) throw new Error("--document <id> is required");
  const findings = backMatterFindings(await loadOutline(resolve(opt("repo") ?? "."), document));
  if (args.includes("--json")) console.log(JSON.stringify(findings, null, 2));
  else if (!findings.length) console.log(`✓ ${document}: glossary and acronyms are back matter`);
  else for (const f of findings) console.log(`⚠ ${document} ${f.chapter}: ${f.message} [${f.code}]`);
}
