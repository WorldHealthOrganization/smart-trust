/**
 * Numbered citations, linked both ways (owner, 2026-11-16: "references …
 * should link back to where used in text and link to biblio entry").
 *
 * A document folio that cites by number writes `<sup>7</sup>` in its prose and
 * keeps a numbered list under a "References" heading. Rendered as written,
 * neither knows the other. This links them, on the rendered HTML, so the
 * block's Markdown is not changed:
 *
 * - each item of the reference list gets the anchor `ref-N`;
 * - each `<sup>` whose text is citation numbers (`7`, `3,5`, `3–5`), and each
 *   WHO-style bracketed number in running text (`(29)`, `(3, 5)`), links each
 *   number to its item, and carries the anchor `cite-K`, K counting citations
 *   in document order. A bracketed number that opens a paragraph or follows a
 *   colon or semicolon is an enumeration, "(1) … (2) …", and is left alone;
 * - each item ends with back-links to every citation of it: `↩` for one,
 *   `↩ a b c` for several;
 * - an item whose DOI, URL, ISBN or handle names exactly one entry of the
 *   bibliography the build links to (`--bibliography-url`) links to that
 *   entry's page. No match, or more than one, and nothing is added.
 *
 * A `<sup>` that names a number the list does not have is left as written:
 * a link to nothing is worse than no link.
 *
 * A lazy page renders its blocks one at a time (`build-document-site.ts`),
 * so this takes the document as PARTS in document order and numbers the
 * citations across all of them. Every anchor it writes is inside a block, so
 * the lazy loader's `ids` index finds the chunk of a `#ref-N` or `#cite-K`
 * as it finds a footnote's.
 */
import { referenceSegment } from "../schemas/reference.ts";

/** A bibliography entry this build can link to, and the identifiers that name it. */
export interface LibraryLink {
  href: string;
  keys: string[];
}

/** The reference list heading, in the languages documents here are written in. */
const HEADING = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
const LIST_TITLE = /^(references|bibliography|works cited|références|referencias|bibliografía)$/i;
/** WHO style: "(29)", "(3, 5)", "(3–5)" in running text. */
const PAREN = /\((\d{1,3}(?:\s*[-–—]\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*[-–—]\s*\d{1,3})?)*)\)/g;
const NUMBERS = /^\s*\d+(?:\s*[-–—]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–—]\s*\d+)?)*\s*$/;
/** A range longer than this is not a citation ("1–2000" is a span of years). */
const MAX_RANGE = 50;

/** A heading's words, for comparing with {@link LIST_TITLE} only: never written to the page. */
const text = (h: string) => h.split(/<[^>]*>/).join("").split(/\s+/).filter(Boolean).join(" ");
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The `<ol>…</ol>` that starts at `from`, as [start, end) offsets; nested lists are inside it. */
function olAt(html: string, from: number): [number, number] | undefined {
  const re = /<(\/?)ol\b[^>]*>/gi;
  re.lastIndex = from;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return [from, m.index + m[0].length];
  }
  return undefined;
}

/**
 * Where the reference list is in a whole document's HTML: the first `<ol>`
 * after a "References" heading, with no other heading between, and the ids of
 * the anchors before it (the block that holds it is among them).
 */
export function findReferenceList(html: string): { start: number; end: number; anchors: string[] } | undefined {
  for (const h of html.matchAll(HEADING)) {
    if (!LIST_TITLE.test(text(h[2]!))) continue;
    const after = h.index! + h[0].length;
    const ol = html.slice(after).search(/<ol\b/i);
    if (ol < 0) return undefined;
    const between = html.slice(after, after + ol);
    if (/<h[1-6]\b/i.test(between)) continue;
    const span = olAt(html, after + ol);
    if (!span) return undefined;
    return { start: span[0], end: span[1], anchors: [...between.matchAll(/<a id="([^"]+)"/g)].map((m) => m[1]!) };
  }
  return undefined;
}

/** The top-level `<li>` items of a list, as [start of `<li…>`, end of `<li…>`, start of `</li>`]. */
function items(html: string, [start, end]: [number, number]): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  const re = /<(\/?)(ol|ul|li)\b[^>]*>/gi;
  re.lastIndex = start;
  let depth = 0;
  let open: [number, number] | undefined;
  for (let m = re.exec(html); m && m.index < end; m = re.exec(html)) {
    const closing = !!m[1];
    const tag = m[2]!.toLowerCase();
    if (tag !== "li") depth += closing ? -1 : 1;
    else if (depth === 1 && !closing) open = [m.index, m.index + m[0].length];
    else if (depth === 1 && closing && open) {
      out.push([open[0], open[1], m.index]);
      open = undefined;
    }
  }
  return out;
}

/** The citation numbers a `<sup>`'s text names, or `undefined` when it is not a citation. */
export function citedNumbers(sup: string): number[] | undefined {
  if (!NUMBERS.test(sup)) return undefined;
  const out: number[] = [];
  for (const part of sup.split(",")) {
    const [a, b] = part.split(/[-–—]/).map((x) => Number(x.trim()));
    if (b === undefined) out.push(a!);
    else if (b < a! || b - a! > MAX_RANGE) return undefined;
    else for (let n = a!; n <= b; n++) out.push(n);
  }
  return out;
}

/** a, b, …, z, aa, ab, … */
const letter = (i: number): string => (i < 26 ? String.fromCharCode(97 + i) : letter(Math.floor(i / 26) - 1) + letter(i % 26));

/** The identifiers a piece of HTML or a reference names, normalised so the same work matches. */
export function identifierKeys(htmlOrUrls: string): string[] {
  const keys = new Set<string>();
  for (const m of htmlOrUrls.matchAll(/https?:\/\/[^\s"'<>)]+/gi)) {
    const url = m[0].replace(/&amp;/g, "&").replace(/[.,;]+$/, "");
    const doi = /doi\.org\/(10\.[^\s?#]+)/i.exec(url)?.[1];
    if (doi) keys.add(`doi:${decodeURIComponent(doi).toLowerCase()}`);
    const handle = /\/handle(?:\.net)?\/(\d+(?:\.\d+)*\/\d+)/i.exec(url)?.[1] ?? /hdl\.handle\.net\/(\d+(?:\.\d+)*\/\d+)/i.exec(url)?.[1];
    if (handle) keys.add(`hdl:${handle}`);
    keys.add(`url:${url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase()}`);
  }
  for (const m of htmlOrUrls.matchAll(/\bdoi:\s*(10\.\d{4,9}\/[^\s<>"]+?)[.,;]?(?=\s|<|$)/gi)) keys.add(`doi:${m[1]!.toLowerCase()}`);
  return [...keys];
}

/**
 * The entries of the bibliography sub-graph `bibliographyUrl` points at, with
 * the identifiers each is known by. The URL's last segment names the sub-graph
 * (`…/bibliography/references/`); one that names none gives no links.
 */
export async function libraryLinks(repoRoot: string, bibliographyUrl: string): Promise<LibraryLink[]> {
  const { collect, hasOwnPage } = await import("./bibliography-page.ts");
  const base = bibliographyUrl.replace(/\/*$/, "/");
  const seg = base.replace(/\/$/, "").split("/").pop();
  const c = collect(repoRoot);
  const sub = c.subgraphs.find((s) => s.slug === seg && (!c.own || s.instance === c.own)) ?? c.subgraphs.find((s) => s.slug === seg);
  if (!sub) return [];
  return c.entries
    .filter((e) => e.subgraph === sub.id && e.instance === sub.instance && hasOwnPage(e))
    .map((e) => {
      const r = e.ref;
      const urls = [r.URL, r.DOI ? `https://doi.org/${r.DOI}` : undefined, ...(r.sources ?? []).map((s) => s.url)].filter(Boolean).join(" ");
      const keys = identifierKeys(urls);
      const isbn = r.ISBN?.replace(/[^0-9Xx]/g, "");
      if (isbn) keys.push(`isbn:${isbn}`);
      return { href: `${base}${referenceSegment(r.id)}/`, keys };
    });
}

/** The one entry the item's identifiers name, or none when they name none or several. */
function matchEntry(itemHtml: string, library: readonly LibraryLink[]): LibraryLink | undefined {
  const mine = identifierKeys(itemHtml);
  for (const m of itemHtml.matchAll(/\b(97[89]\d{10})\b/g)) mine.push(`isbn:${m[1]}`);
  if (!mine.length) return undefined;
  const found = new Set(library.filter((l) => l.keys.some((k) => mine.includes(k))));
  return found.size === 1 ? [...found][0] : undefined;
}

export interface CitationPart {
  /** The block's label; absent for a whole document. */
  label?: string;
  html: string;
}

/**
 * Link the numbered citations of a document given as parts in document order.
 * `refBlock` is the label of the part holding the reference list; without it,
 * the list is looked for by its heading in each part.
 */
export function linkCitations(parts: readonly CitationPart[], opts: { refBlock?: string; library?: readonly LibraryLink[] } = {}): string[] {
  // The list: which part, where in it, how many items and their numbering.
  let at = -1;
  let span: [number, number] | undefined;
  parts.forEach((p, i) => {
    if (span) return;
    if (opts.refBlock !== undefined) {
      if (p.label !== opts.refBlock) return;
      const ol = p.html.search(/<ol\b/i);
      const s = ol >= 0 ? olAt(p.html, ol) : undefined;
      if (s) {
        at = i;
        span = s;
      }
    } else {
      const f = findReferenceList(p.html);
      if (f) {
        at = i;
        span = [f.start, f.end];
      }
    }
  });
  if (!span) return parts.map((p) => p.html);
  const list = parts[at]!.html;
  const first = Number(/^<ol\b[^>]*\bstart="(\d+)"/i.exec(list.slice(span[0]))?.[1] ?? 1);
  const its = items(list, span);
  const last = first + its.length - 1;

  // The citations, numbered across the parts; the list itself cites nothing.
  const citedAt = new Map<number, number[]>();
  let k = 0;
  const link = (inner: string, sup: boolean): string | undefined => {
    const ns = citedNumbers(inner);
    if (!ns || ns.some((n) => n < first || n > last)) return undefined;
    const id = ++k;
    for (const n of new Set(ns)) citedAt.set(n, [...(citedAt.get(n) ?? []), id]);
    const linked = inner.replace(/\d+/g, (n) => `<a href="#ref-${n}">${n}</a>`);
    return sup ? `<sup class="fa-cite" id="cite-${id}">${linked}</sup>` : `<span class="fa-cite" id="cite-${id}">(${linked})</span>`;
  };
  // Tag by tag, so a citation is never read inside a tag, a link, code or a
  // heading, and both forms are numbered in the order they are read.
  const cite = (h: string): string => {
    const toks = h.split(/(<[^>]*>)/);
    let skip = 0;
    let prev = "";
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]!;
      if (t.startsWith("<")) {
        const m = /^<(\/?)(a|code|pre|h[1-6]|script|style)\b/i.exec(t);
        if (m) skip = Math.max(0, skip + (m[1] ? -1 : 1));
        if (skip === 0 && /^<sup>$/i.test(t) && /^<\/sup>$/i.test(toks[i + 2] ?? "")) {
          const r = link(toks[i + 1] ?? "", true);
          if (r) {
            toks[i] = r;
            toks[i + 1] = "";
            toks[i + 2] = "";
            i += 2;
            prev = "x";
            continue;
          }
        }
        if (/^<\/?(p|li|td|th|br|div|ol|ul|blockquote)\b/i.test(t)) prev = "";
        continue;
      }
      if (skip === 0) {
        toks[i] = t.replace(PAREN, (whole: string, inner: string, at: number) => {
          // After a word or closing punctuation, as "… use cases (29)."; not
          // opening a paragraph or item, nor after a colon or semicolon,
          // where "(1) … (2) …" is an enumeration.
          const lead = t.slice(0, at) || prev;
          if (!/[\p{L}\p{N}.,'"’”)\]]\s?$/u.test(lead)) return whole;
          return link(inner, false) ?? whole;
        });
      }
      if (t) prev = t;
    }
    return toks.join("");
  };
  let before = "";
  let after = "";
  const out = parts.map((p, i) => {
    if (i !== at) return cite(p.html);
    before = cite(list.slice(0, span![0]));
    after = cite(list.slice(span![1]));
    return p.html;
  });

  // The list: an anchor on each item, then its bibliography entry and its back-links.
  let body = "";
  let from = span[0];
  its.forEach(([open, openEnd, close], i) => {
    const n = first + i;
    const tag = list.slice(open, openEnd);
    const back = citedAt.get(n) ?? [];
    const entry = opts.library?.length ? matchEntry(list.slice(openEnd, close), opts.library) : undefined;
    const tail = [
      entry ? ` <a class="fa-cite-lib" href="${escAttr(entry.href)}" title="This work in the bibliography">[bibliography]</a>` : "",
      back.length === 1
        ? ` <a class="fa-cite-back" href="#cite-${back[0]}" title="Back to where it is cited" aria-label="Back to where it is cited">↩</a>`
        : back.length
          ? ` <span class="fa-cite-back" title="Back to where it is cited">↩ ${back.map((c, j) => `<a href="#cite-${c}" aria-label="Back to citation ${letter(j)}">${letter(j)}</a>`).join(" ")}</span>`
          : "",
    ].join("");
    const withId = /\bid=/.test(tag) ? tag : tag.replace(/^<li\b/i, `<li id="ref-${n}"`);
    body += list.slice(from, open) + withId + list.slice(openEnd, close) + tail;
    from = close;
  });
  body += list.slice(from, span[1]);
  out[at] = before + body + after;
  return out;
}
