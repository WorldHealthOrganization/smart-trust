/**
 * Link glossary terms where a document's prose uses them.
 *
 * A DTH writes its KG concepts Capitalized and plain-English uses lower case
 * (dth-pc and dth-sc AGENTS.md; owner, 2026-10-31), so a Capitalized
 * prefLabel or altLabel in running text is a use of the concept. The owner
 * asked for these uses to link to the glossary (2026-10-31: "glossary words
 * linkable in rendered content?"). This adds the links when the page is
 * rendered. The block's Markdown is not changed, so there is no `:refterm` to
 * author or keep in step.
 *
 * - The terms are the authored schemes (not the extracted KG candidates)
 *   declared by the document's own layer and by the layers it `needs`
 *   directly: dth-pc links dth-pc, dth-sc, smart-ra (dpi-h-ra) and smart-base
 *   terms. The layers further down (bootstrap's "Process", "Role") are
 *   platform vocabulary, not the handbook's, and are left alone.
 * - A one-word label that is not an acronym ("Product", "Registry",
 *   "Traceability") links only from the document's own glossary, and never at
 *   the start of a sentence. Another layer's one-word term is too often the
 *   English word: "Product code" and "Product verification" in dth-pc are not
 *   smart-ra's Product.
 * - Each link goes to the term's own page (`glossary-page.ts`, `termPagePath`),
 *   which shows its glossary row, related terms and the narrative passages
 *   (owner, 2026-11-01, Q-GLO-2 A, folio-assistant-core#498).
 * - Only a whole-word, case-sensitive match of a label that starts with a
 *   capital letter links, with an optional plural "s". The longest label wins
 *   ("Regulated Trade Item" before "Trade Item").
 * - Each term links once per section (from one heading to the next), so a
 *   paragraph is not a wall of links.
 * - Nothing inside a heading, a link, code, inline HTML or a directive is
 *   touched.
 * - A Markdown link whose target is a term's SKOS IRI, such as a block's
 *   "Concepts:" line (`[Stakeholder](https://…/ns/glossary/dpi-h-ra/stakeholder)`),
 *   is pointed at the term's entry instead. The IRI is the identifier the
 *   Markdown keeps; the page is where this build puts it (owner, 2026-10-31,
 *   "Through the glossary"). Every term of the layers above resolves this
 *   way, one-word or not.
 *
 * Opt-in: `build-document-site.ts --link-terms`.
 */
import { posix, resolve } from "node:path";
import { instanceRootsIn, readDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

export interface TermLink {
  /** The text as written in prose. */
  label: string;
  /** The link, relative to the document's page. */
  href: string;
  /** The term's definition, first sentence, for the link's title. */
  title?: string;
  /** The term's SKOS IRI: a Markdown link to it is pointed at the entry instead. */
  iri?: string;
  /** `false`: resolve links to the IRI only, never match the label in prose. */
  prose?: false;
}

type LangText = string | Record<string, string>;
const labelOf = (l: LangText): string => (typeof l === "string" ? l : (l.en ?? Object.values(l)[0] ?? ""));

/** The layer at `repoRoot` and the layers it needs directly. */
export function neededInstances(repoRoot: string): Set<string> {
  for (const root of instanceRootsIn(repoRoot)) {
    if (resolve(root) !== resolve(repoRoot)) continue;
    const d = readDeclaration(root) as { name?: string; needs?: unknown } | undefined;
    if (!d?.name) break;
    const needs = Array.isArray(d.needs) ? d.needs.filter((x): x is string => typeof x === "string") : [];
    return new Set([d.name, ...needs]);
  }
  return new Set();
}

/** The links for a document whose page is in `pageDir` (relative to the site root). */
export async function termLinks(repoRoot: string, pageDir: string): Promise<TermLink[]> {
  const { collect, termPermalink } = await import("./glossary-page.ts");
  const { termIri } = await import("../schemas/glossary.ts");
  const wanted = neededInstances(repoRoot);
  const self = [...wanted][0];
  const byLabel = new Map<string, TermLink>();
  const byIri = new Map<string, TermLink>();
  for (const s of collect(repoRoot).glossaries) {
    // A scheme counts for the layer that declares it, so a term of dth-sc's is
    // dth-sc's even while the page credits it elsewhere (scheme-owner.ts).
    if (s.extracted || !wanted.has(s.declaredBy ?? s.instance)) continue;
    for (const t of s.glossary.terms) {
      const def = t.definition ? labelOf(t.definition as LangText).split(/(?<=\.)\s/)[0] : undefined;
      // The term's own page (folio-assistant-core#498, Q-GLO-2 A), which links
      // on to its glossary row, related terms and the narrative passages.
      const href = `${posix.relative(pageDir, termPermalink(s, t.id).replace(/^\/|\/$/g, ""))}/`;
      const iri = t.iri ?? termIri(s.ns, s.glossary, t.id);
      byIri.set(iri, { label: labelOf(t.prefLabel as LangText), href, iri, prose: false, ...(def ? { title: def } : {}) });
      for (const label of [labelOf(t.prefLabel as LangText), ...(t.altLabel ?? [])]) {
        if (!/^\p{Lu}/u.test(label) || label.length < 3 || byLabel.has(label)) continue;
        if (oneWord(label) && (s.declaredBy ?? s.instance) !== self) continue;
        byLabel.set(label, { label, href, ...(def ? { title: def } : {}) });
      }
    }
  }
  return [...[...byLabel.values()].sort((a, b) => b.label.length - a.label.length || a.label.localeCompare(b.label)), ...byIri.values()];
}

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  url?: string;
  title?: string | null;
  depth?: number;
  data?: Record<string, unknown>;
}

const SKIP = new Set(["heading", "link", "linkReference", "inlineCode", "code", "html", "textDirective", "leafDirective", "containerDirective", "inlineMath", "math", "definition", "image"]);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A one-word label that is not an acronym: "Product", not "NPC" or "Trade Item". */
const oneWord = (label: string): boolean => !/[\s-]/.test(label) && !/^[\p{Lu}\p{N}]{2,}s?$/u.test(label);

/** Whether `at` in `text` starts a sentence: nothing before it in the paragraph, or a full stop, colon, ? or ! and space. */
function sentenceStart(text: string, at: number, before: readonly MdNode[]): boolean {
  const head = text.slice(0, at);
  if (/[.!?:]\s+$/.test(head)) return true;
  // An anchor (`<a id>`) or a break before the text does not start a sentence; words do.
  return head.trim() === "" && !before.some((n) => !["html", "break"].includes(n.type) && (n.type !== "text" || (n.value ?? "").trim() !== ""));
}

/** A remark plugin: the first use of each term in each section becomes a link to its entry. */
export function linkTerms(links: readonly TermLink[]) {
  if (links.length === 0) return () => () => undefined;
  const prose = links.filter((l) => l.prose !== false);
  const byLabel = new Map(prose.map((l) => [l.label, l]));
  const byIri = new Map(links.filter((l) => l.iri).map((l) => [l.iri!, l]));
  const re = prose.length
    ? new RegExp(`(?<![\\p{L}\\p{N}-])(${prose.map((l) => escapeRe(l.label)).join("|")})(s?)(?![\\p{L}\\p{N}-])`, "gu")
    : /$^/gu;
  return () => (tree: MdNode) => {
    let seen = new Set<string>();
    const walk = (node: MdNode) => {
      if (!node.children) return;
      const out: MdNode[] = [];
      for (const child of node.children) {
        if (child.type === "heading") {
          seen = new Set();
          out.push(child);
          continue;
        }
        const target = child.type === "link" && child.url ? byIri.get(child.url) : undefined;
        if (target) {
          seen.add(target.href);
          out.push({ ...child, url: target.href, title: target.title ?? null, data: { hProperties: { className: ["fa-term"] } } });
          continue;
        }
        if (SKIP.has(child.type)) {
          out.push(child);
          continue;
        }
        if (child.type !== "text" || !child.value) {
          walk(child);
          out.push(child);
          continue;
        }
        const text = child.value;
        let last = 0;
        for (const m of text.matchAll(re)) {
          const l = byLabel.get(m[1]!)!;
          if (seen.has(l.href)) continue;
          if (oneWord(l.label) && sentenceStart(text, m.index!, out)) continue;
          seen.add(l.href);
          if (m.index! > last) out.push({ type: "text", value: text.slice(last, m.index) });
          out.push({ type: "link", url: l.href, title: l.title ?? null, data: { hProperties: { className: ["fa-term"] } }, children: [{ type: "text", value: m[0] }] });
          last = m.index! + m[0].length;
        }
        if (last === 0) out.push(child);
        else if (last < text.length) out.push({ type: "text", value: text.slice(last) });
      }
      node.children = out;
    };
    walk(tree);
  };
}
