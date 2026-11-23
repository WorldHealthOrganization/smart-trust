/**
 * Links from one document of a folio to another (issue #841).
 *
 * A folio may hold more than one document, `folio/<a>/` and `folio/<b>/`, and
 * b's blocks may point into a: `\ref{a:sec:x}`, `[text](#a:sec:x)`, or a
 * link built from a block's `uses: ["a:sec:x"]`. The part before the first
 * colon names the sibling document's slug, and the rest is the label as it
 * stands on that document's page. A ref is cross-document ONLY when that
 * first part is the slug of a document in the same folio; anything else
 * (`sec:x`, `eq:y`, a ref to an external scheme) is left alone, so a
 * same-page anchor stays a same-page anchor.
 *
 * Two renderings:
 *
 * - the SITE ({@link siteCrossDocumentLinks}, {@link siteCrossDocumentRefs}):
 *   `href="#a:sec:x"` on page b becomes `../a/index.html#sec:x`, the
 *   sibling's page at the block's anchor. A ref that names the page's OWN
 *   slug (`b:sec:x` on page b) becomes the plain same-page `#sec:x`, since
 *   `#b:sec:x` is an id the page does not carry.
 * - Word and PDF ({@link exportCrossDocumentRefs}): a link cannot leave the
 *   file, so the ref is written as a readable citation, "<Document title>,
 *   Section 2.3".
 *
 * Section numbers are counted from the manifests, in the order the document
 * assembles them: chapter i is "Chapter i", its j-th section "Section i.j",
 * a subsection "Section i.j.k", and a block is cited by the section it sits
 * in. A label the sibling does not carry is cited by the document title and
 * the label as written; QA (`uses-resolve` in cat-harness-tools) is where a
 * miss fails.
 *
 * No runtime import from cat-harness-tools: the manifests are read
 * structurally, so this module is testable on its own.
 */
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";

/** One sibling document: its title, and where each label sits in it ("Section 2.3"). */
export interface CrossDocument {
  title: string;
  places: Map<string, string>;
}

/** Every document of a folio, by slug. */
export type CrossDocumentIndex = Map<string, CrossDocument>;

/** A ref split into the sibling document and its label, or undefined when the ref names no document of the folio. */
export function splitCrossRef(ref: string, docs: { has(slug: string): boolean }): { slug: string; label: string } | undefined {
  const at = ref.indexOf(":");
  if (at <= 0 || at === ref.length - 1) return undefined;
  const slug = ref.slice(0, at);
  return docs.has(slug) ? { slug, label: ref.slice(at + 1) } : undefined;
}

/** "<Document title>, Section 2.3", or "<Document title>, <label>" when the label is not in the index. */
export function crossCitation(index: CrossDocumentIndex, slug: string, label: string): string {
  const doc = index.get(slug);
  if (!doc) return label;
  return `${doc.title}, ${doc.places.get(label) ?? label}`;
}

/** From one document's page to another's, both at `en/<slug>/index.html`: `../<slug>/index.html`. */
export function siblingPage(self: string, slug: string): string {
  return posix.relative(posix.join("en", self), posix.join("en", slug, "index.html"));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const FENCE = /^\s*(```|~~~)/;

/** Apply `fn` to every line outside fenced code. */
function outsideFences(markdown: string, fn: (line: string) => string): string {
  let fenced = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (FENCE.test(line)) {
        fenced = !fenced;
        return line;
      }
      return fenced ? line : fn(line);
    })
    .join("\n");
}

const TEX_REF = /\\(?:eq)?ref\{([^}]+)\}/g;
const MD_LINK = /(?<!!)\[([^\]]*)\]\(#([^)\s]+)\)/g;

/**
 * The site, before Markdown is rendered: a cross-document `\ref{a:sec:x}`
 * becomes a link to the sibling's page, reading as its citation. Runs whether
 * or not math is on (a document folio renders without math, where a `\ref`
 * would otherwise stay as text). Other `\ref`s are left for `texInMarkdown`.
 */
export function siteCrossDocumentRefs(markdown: string, self: string, index: CrossDocumentIndex): string {
  if (index.size < 2) return markdown;
  return outsideFences(markdown, (line) =>
    line.replace(TEX_REF, (whole, ref: string) => {
      const x = splitCrossRef(ref, index);
      if (!x) return whole;
      const href = x.slug === self ? `#${x.label}` : `${siblingPage(self, x.slug)}#${x.label}`;
      const text = x.slug === self ? x.label : crossCitation(index, x.slug, x.label);
      return `<a href="${esc(href)}" class="cross-document">${esc(text)}</a>`;
    }),
  );
}

/**
 * The site, after rendering: every `href="#a:sec:x"` (a Markdown link, a
 * `uses`-derived link, raw HTML) whose first part is a sibling document goes
 * to that document's page. A colon a renderer percent-encoded (`%3A`) is read
 * as a colon. Every other anchor is unchanged.
 */
export function siteCrossDocumentLinks(html: string, self: string, docs: { has(slug: string): boolean; size: number }): string {
  if (docs.size < 2) return html;
  return html.replace(/href="#([^"]+)"/g, (whole, raw: string) => {
    const x = splitCrossRef(raw.replace(/%3A/gi, ":"), docs);
    if (!x) return whole;
    return x.slug === self ? `href="#${x.label}"` : `href="${siblingPage(self, x.slug)}#${x.label}"`;
  });
}

/**
 * Word and PDF: a cross-document `\ref{a:sec:x}` becomes "<Title>, Section
 * N", and `[text](#a:sec:x)` becomes "text (<Title>, Section N)". A ref to
 * the document's own slug becomes the same-document anchor (`\ref{sec:x}`,
 * `[text](#sec:x)`), which the export already handles.
 */
export function exportCrossDocumentRefs(markdown: string, self: string, index: CrossDocumentIndex): string {
  if (index.size < 2) return markdown;
  return outsideFences(markdown, (line) =>
    line
      .replace(TEX_REF, (whole, ref: string) => {
        const x = splitCrossRef(ref, index);
        if (!x) return whole;
        return x.slug === self ? whole.replace(ref, x.label) : crossCitation(index, x.slug, x.label);
      })
      .replace(MD_LINK, (whole, text: string, ref: string) => {
        const x = splitCrossRef(ref, index);
        if (!x) return whole;
        if (x.slug === self) return `[${text}](#${x.label})`;
        const cite = crossCitation(index, x.slug, x.label);
        return text.trim() && text.trim() !== cite ? `${text} (${cite})` : cite;
      }),
  );
}

// ── the index, from the manifests ──

interface ManifestSection {
  title?: string;
  label?: string;
  blocks?: readonly string[];
  subsections?: readonly ManifestSection[];
}
interface ManifestChapter {
  title?: string;
  label?: string;
  sections?: readonly ManifestSection[];
}
interface ManifestPaper {
  title?: string;
  chapters?: readonly { dir: string }[];
}

/** Every document in the folio directory: `<folio>/<slug>/<slug>.ts`, sorted by slug. */
export function folioDocuments(folioRoot: string): { slug: string; path: string }[] {
  if (!existsSync(folioRoot)) return [];
  return readdirSync(folioRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ slug: d.name, path: join(folioRoot, d.name, `${d.name}.ts`) }))
    .filter((d) => existsSync(d.path))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

const load = async <T>(path: string): Promise<T> => (await import(path)).default as T;

/** One document's title and the place of every chapter, section and block label in it. */
export async function crossDocument(manifestPath: string, slug: string): Promise<CrossDocument> {
  const docDir = dirname(manifestPath);
  const paper = await load<ManifestPaper>(manifestPath);
  const places = new Map<string, string>();
  let ch = 0;
  for (const ref of paper.chapters ?? []) {
    const chDir = join(docDir, ref.dir);
    const chPath = join(chDir, `${ref.dir}.ts`);
    if (!existsSync(chPath)) continue;
    const chapter = await load<ManifestChapter>(chPath);
    ch++;
    if (chapter.label) places.set(chapter.label, `Chapter ${ch}`);
    const walk = async (secs: readonly ManifestSection[], prefix: string) => {
      let n = 0;
      for (const sec of secs) {
        if (!sec.blocks) continue; // a section reference, not counted by the outline either
        const num = `${prefix}.${++n}`;
        const place = `Section ${num}`;
        if (sec.label) places.set(sec.label, place);
        for (const root of sec.blocks) {
          const ts = join(chDir, `${root}.ts`);
          if (!existsSync(ts)) continue;
          const b = await load<{ label?: string }>(ts);
          if (b?.label && !places.has(b.label)) places.set(b.label, place);
        }
        if (sec.subsections) await walk(sec.subsections, num);
      }
    };
    await walk(chapter.sections ?? [], String(ch));
  }
  return { title: paper.title ?? slug, places };
}

/** Every document of a folio. Empty or one entry: nothing is cross-document. */
export async function crossDocumentIndex(docs: readonly { slug: string; path: string }[]): Promise<CrossDocumentIndex> {
  const index: CrossDocumentIndex = new Map();
  if (docs.length < 2) {
    for (const d of docs) index.set(d.slug, { title: d.slug, places: new Map() });
    return index;
  }
  for (const d of docs) index.set(d.slug, await crossDocument(d.path, d.slug));
  return index;
}
