/**
 * Where a document's narrative explains or uses a glossary term: the term's
 * provenance in the text.
 *
 * Owner, 2026-11-01 (folio-assistant-core#498, cards Q-GLO-2 A and Q-GLO-3 C):
 * a term link opens a page for the term. The term's defining site is its
 * glossary row (the SKOS `source`), so every term has the same node-kind
 * structure, AND the term links to the narrative passages as provenance. The
 * Integrated view thread (Q-IV-8 A) puts a concept's long text in a narrative
 * block marked `defines: [<term id>]`; ArchiMate element pages list the same
 * passages. One matcher serves both, so the two lists cannot drift.
 *
 * A passage is a labelled block of a document folio. It is
 *
 * - **explains**, when the block's manifest lists the term in `defines`; or
 * - **mentions**, when the block's Markdown uses one of the term's labels or
 *   its acronym (`notation`) as a whole word.
 *
 * Matching follows `glossary-term-links.ts` where it can: an acronym and a
 * one-word label match case-sensitively (so "Product" is not "product"), a
 * label of two or more words matches in any case. Headings, code and links are
 * not read. The block that IS the term's `source` (its glossary row) is the
 * defining site, not provenance, so it is left out.
 *
 * Read-only: nothing here edits a block.
 *
 * @module folio-assistant-core/scripts/term-passages
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { documentBlocks, documentManifests } from "./build-document-site.ts";
import { documentPage } from "./document-site-route.js";

/** One term to look for. */
export interface TermQuery {
  /** The caller's key for the term, returned as given: an anchor, an IRI, an element id. */
  key: string;
  /** The term's id in its scheme, matched against a block's `defines`. */
  id?: string;
  /** prefLabel and altLabels. */
  labels: readonly string[];
  /** The acronym, `notation`. */
  notation?: string;
  /** The term's `source`, repository-relative, `#fragment` allowed: that block is the defining site, not a passage. */
  source?: string;
}

/** One block of narrative that explains or mentions a term. */
export interface Passage {
  /** `explains`: the block lists the term in `defines`. `mentions`: it uses a label. */
  kind: "explains" | "mentions";
  /** The document's slug. */
  document: string;
  /** The section title the block sits in. */
  section: string;
  /** The block's label, which is its anchor on the document page. */
  label: string;
  /** The document page, relative to the site root, with the block's anchor: `en/<slug>/index.html#<label>`. */
  href: string;
  /** The block's source file, repository-relative. */
  source: string;
  /** The words around the first use, plain text, at most {@link EXCERPT} characters. */
  excerpt: string;
}

export const EXCERPT = 160;
/** At most this many `mentions` per term and document; `explains` are never cut. */
export const MAX_MENTIONS = 12;

interface Block {
  document: string;
  section: string;
  label: string;
  page: string;
  source: string;
  text: string;
  defines: readonly string[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isAcronym = (s: string) => /^[\p{Lu}\p{N}][\p{Lu}\p{N}\-]*$/u.test(s) && /\p{Lu}.*\p{Lu}/u.test(s);
const oneWord = (s: string) => !/[\s-]/.test(s);

/**
 * A block's Markdown as the words a reader sees: headings, code, HTML,
 * directives' names, link targets and table rules dropped; a link's or a
 * directive's text kept.
 */
export function proseText(md: string): string {
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s.*$/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/:{1,3}[a-z][\w-]*\[([^\]]*)\](\{[^}]*\})?/gi, "$1")
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, " ")
    .replace(/[|*_>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The labels to look for, split by the case rule: acronyms and one-word labels match case-sensitively. */
function labelSets(q: Pick<TermQuery, "labels" | "notation">): { exact: string[]; loose: string[] } {
  const exact: string[] = [];
  const loose: string[] = [];
  for (const l of [...q.labels, ...(q.notation ? [q.notation] : [])]) {
    const s = l.trim();
    if (s.length < 2) continue;
    (isAcronym(s) || oneWord(s) ? exact : loose).push(s);
  }
  return { exact, loose };
}

/** The index of the first use of the term in `text` as a whole word (an `s` plural allowed), or -1. */
export function firstUse(text: string, q: Pick<TermQuery, "labels" | "notation">): number {
  const { exact, loose } = labelSets(q);
  const all = [...exact, ...loose].sort((a, b) => b.length - a.length);
  if (!all.length) return -1;
  const re = new RegExp(`(?<![\\p{L}\\p{N}-])(${all.map((l) => escapeRe(l).replace(/\s+/g, "\\s+")).join("|")})s?(?![\\p{L}\\p{N}-])`, "giu");
  const strict = new Set(exact);
  const folded = new Map(exact.map((e) => [e.toLowerCase(), e]));
  for (const m of text.matchAll(re)) {
    const hit = m[1]!;
    // A case-insensitive hit on an exact label counts only in that label's own case.
    const want = folded.get(hit.toLowerCase());
    if (want && !strict.has(hit)) continue;
    return m.index!;
  }
  return -1;
}

function excerptAt(text: string, at: number): string {
  if (text.length <= EXCERPT) return text;
  const start = Math.max(0, at - Math.floor(EXCERPT / 3));
  let cut = text.slice(start, start + EXCERPT);
  if (start > 0) cut = cut.replace(/^\S*\s/, "");
  const end = start + EXCERPT < text.length;
  return `${start > 0 ? "… " : ""}${end ? cut.replace(/\s\S*$/, "") : cut}${end ? " …" : ""}`;
}

const sameFile = (a: string, b: string) => a.split("#", 1)[0]!.replace(/\.(md|ts)$/, "") === b.split("#", 1)[0]!.replace(/\.(md|ts)$/, "");

/** Every labelled block of every document folio in `repoRoot`, with its prose and its `defines`. */
export async function narrativeBlocks(repoRoot: string): Promise<Block[]> {
  const out: Block[] = [];
  for (const d of documentManifests(repoRoot)) {
    for (const b of await documentBlocks(d.path, repoRoot, d.slug)) {
      const abs = join(repoRoot, b.source);
      const ts = abs.replace(/\.md$/, ".ts");
      let defines: string[] = [];
      if (existsSync(ts)) {
        const m = (await import(ts)).default as { defines?: unknown };
        if (Array.isArray(m?.defines)) defines = m.defines.filter((x): x is string => typeof x === "string");
      }
      const text = b.source.endsWith(".md") && existsSync(abs) ? proseText(readFileSync(abs, "utf-8")) : "";
      out.push({ document: d.slug, section: b.section ?? "", label: b.label, page: b.page ?? documentPage(d.slug), source: b.source, text, defines });
    }
  }
  return out;
}

/** The passages for each term, keyed by the caller's key: `explains` first, then `mentions` in document order. */
export function passagesIn(blocks: readonly Block[], terms: readonly TermQuery[]): Map<string, Passage[]> {
  const out = new Map<string, Passage[]>();
  for (const q of terms) {
    const explains: Passage[] = [];
    const mentions = new Map<string, Passage[]>();
    for (const b of blocks) {
      if (q.source && sameFile(b.source, q.source)) continue;
      const at = firstUse(b.text, q);
      const kind = q.id && b.defines.includes(q.id) ? "explains" : at >= 0 ? "mentions" : undefined;
      if (!kind) continue;
      const p: Passage = {
        kind,
        document: b.document,
        section: b.section,
        label: b.label,
        href: `${b.page}#${b.label}`,
        source: b.source,
        excerpt: excerptAt(b.text, Math.max(at, 0)),
      };
      if (kind === "explains") explains.push(p);
      else {
        const list = mentions.get(b.document) ?? [];
        if (list.length < MAX_MENTIONS) list.push(p);
        mentions.set(b.document, list);
      }
    }
    const all = [...explains, ...[...mentions.values()].flat()];
    if (all.length) out.set(q.key, all);
  }
  return out;
}

/** {@link narrativeBlocks} then {@link passagesIn}: what an element page or a term page calls. */
export async function passagesFor(repoRoot: string, terms: readonly TermQuery[]): Promise<Map<string, Passage[]>> {
  return passagesIn(await narrativeBlocks(repoRoot), terms);
}
