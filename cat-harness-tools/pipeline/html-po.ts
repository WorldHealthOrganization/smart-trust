/**
 * gettext over finished HTML: the words of a generated page, extracted as
 * `msgid`s and put back from a `.po`.
 *
 * @module pipeline/html-po
 *
 * ## Why a rendered page, and not the generator's source
 *
 * A visualiser page (the journeys viewer, its workshop frames) is drawn from
 * many sources at once: the layer's JSON nodes, the ArchiMate model, the
 * BPMN drawings' panels, and the generator's own chrome ("Overview", "Ask the
 * room"). Each has its own words and none of them knows the others. Reading
 * the page as a reader reads it is the one place where all of them meet, so
 * one catalogue per visualiser covers every word a reader sees, and a word
 * no catalogue has stays English (never blank). The `msgid` is the English
 * text itself, the convention every other extractor here uses, so the
 * catalogue only changes when the English does.
 *
 * ## Segments
 *
 * A segment is a run of inline content that holds text of its own: a
 * paragraph, a list item, a heading, a table cell, a button label. Inline
 * elements inside a run are numbered placeholders, `<0>…</0>`, and an element
 * whose content is not words (`code`, an `svg` icon, `img`, `br`) is a void
 * placeholder `<0/>`; their attributes never enter the `msgid` and are put
 * back as they were. A run without text of its own is not a segment: its
 * elements are walked instead, so `<a><svg/><span><b>Overview</b></span></a>`
 * gives the segment `Overview`, not a sentence of placeholders.
 *
 * `title`, `alt`, `aria-label` and `placeholder` are segments of their own,
 * and so is the `content` of `<meta name="description">`.
 *
 * Never read: `script`, `style`, `svg`, `pre`, `code`, `textarea`, `template`,
 * and anything marked `translate="no"` or `class="notranslate"` (HTML's own
 * spellings for "keep as written").
 *
 * ## Putting a translation back
 *
 * A `msgstr` must carry the same placeholders as its `msgid`, each once and
 * properly nested; one that does not is not used, the English stays, and the
 * page is reported (`InjectResult.rejected`). Placeholders may move, which is
 * the point: word order differs between languages.
 *
 * Pure: no filesystem.
 */

/** A node of the small tree this module reads HTML into. */
type Node = ElementNode | TextNode | RawNode;

interface ElementNode {
  type: "el";
  name: string;
  /** The start tag exactly as written. */
  open: string;
  /** The end tag exactly as written, "" for a void or unclosed element. */
  close: string;
  attrs: Map<string, { value: string; start: number; end: number }>;
  children: Node[];
}

interface TextNode {
  type: "text";
  raw: string;
}

interface RawNode {
  type: "raw";
  raw: string;
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);
/** Elements whose content is never words to translate. */
const SKIP = new Set(["script", "style", "svg", "pre", "code", "textarea", "template", "math", "kbd", "samp", "noscript"]);
/** Phrasing content: inside a run of text these become placeholders, not segment boundaries. */
const INLINE = new Set([
  "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em", "i", "img", "kbd", "mark", "q", "s",
  "samp", "small", "span", "strong", "sub", "sup", "svg", "time", "u", "wbr", "label", "output", "del", "ins",
]);
/** Attributes whose values a reader sees or hears. */
export const TEXT_ATTRIBUTES = ["title", "alt", "aria-label", "placeholder"] as const;

// ── reading ──────────────────────────────────────────────────────────────

const ATTR_RE = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(open: string): ElementNode["attrs"] {
  const attrs: ElementNode["attrs"] = new Map();
  const nameEnd = open.search(/[\s>\/]/);
  ATTR_RE.lastIndex = nameEnd < 0 ? open.length : nameEnd;
  const body = open;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(body)) !== null) {
    if (m.index >= body.length - 1) break;
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4];
    if (value === undefined) {
      attrs.set(name, { value: "", start: -1, end: -1 });
      continue;
    }
    const quoted = m[2] !== undefined || m[3] !== undefined;
    const end = m.index + m[0].length - (quoted ? 1 : 0);
    attrs.set(name, { value, start: end - value.length, end });
  }
  return attrs;
}

/** Read HTML into a tree that serializes back to the same bytes. */
export function parseHtml(html: string): Node[] {
  const root: ElementNode = { type: "el", name: "#root", open: "", close: "", attrs: new Map(), children: [] };
  const stack: ElementNode[] = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      top().children.push({ type: "text", raw: html.slice(i) });
      break;
    }
    if (lt > i) top().children.push({ type: "text", raw: html.slice(i, lt) });
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end < 0 ? html.length : end + 3;
      top().children.push({ type: "raw", raw: html.slice(lt, stop) });
      i = stop;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const end = html.indexOf(">", lt);
      const stop = end < 0 ? html.length : end + 1;
      top().children.push({ type: "raw", raw: html.slice(lt, stop) });
      i = stop;
      continue;
    }
    const tag = /^<(\/?)([A-Za-z][A-Za-z0-9:-]*)/.exec(html.slice(lt, lt + 64));
    if (!tag) {
      top().children.push({ type: "text", raw: "<" });
      i = lt + 1;
      continue;
    }
    const gt = tagEnd(html, lt);
    const raw = html.slice(lt, gt);
    const name = tag[2].toLowerCase();
    i = gt;
    if (tag[1] === "/") {
      const at = stack.map((n) => n.name).lastIndexOf(name);
      if (at <= 0) {
        top().children.push({ type: "raw", raw });
        continue;
      }
      stack.length = at + 1;
      top().close = raw;
      stack.pop();
      continue;
    }
    const el: ElementNode = { type: "el", name, open: raw, close: "", attrs: parseAttrs(raw), children: [] };
    top().children.push(el);
    if (VOID.has(name) || raw.endsWith("/>")) continue;
    if (RAW_TEXT.has(name)) {
      const closeRe = new RegExp(`</${name}\\s*>`, "i");
      const rest = html.slice(i);
      const m = closeRe.exec(rest);
      const inner = m ? rest.slice(0, m.index) : rest;
      if (inner) el.children.push(name === "title" ? { type: "text", raw: inner } : { type: "raw", raw: inner });
      el.close = m ? m[0] : "";
      i += m ? m.index + m[0].length : rest.length;
      continue;
    }
    stack.push(el);
  }
  return root.children;
}

function tagEnd(html: string, from: number): number {
  let q: string | undefined;
  for (let j = from + 1; j < html.length; j++) {
    const c = html[j];
    if (q) {
      if (c === q) q = undefined;
    } else if (c === '"' || c === "'") q = c;
    else if (c === ">") return j + 1;
  }
  return html.length;
}

export function serializeHtml(nodes: readonly Node[]): string {
  let out = "";
  for (const n of nodes) {
    if (n.type === "el") out += n.open + serializeHtml(n.children) + n.close;
    else out += n.raw;
  }
  return out;
}

// ── text ─────────────────────────────────────────────────────────────────

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

/** Collapse whitespace as a browser does. */
function collapse(s: string): string {
  return s.replace(/[ \t\n\r\f]+/g, " ");
}

/** Words worth a translator's time: a letter, and not an identifier such as `TrustDemoJ41Access`. */
export function isWords(s: string): boolean {
  if (!/\p{L}/u.test(s)) return false;
  const t = s.trim();
  if (!/\s/.test(t) && t.length >= 10 && /[a-z]/.test(t) && /[A-Z].*[A-Z]/.test(t) && /^[A-Za-z0-9._:-]+$/.test(t)) return false;
  return true;
}

// ── segments ─────────────────────────────────────────────────────────────

function skipped(el: ElementNode): boolean {
  if (SKIP.has(el.name)) return true;
  if (el.attrs.get("translate")?.value === "no") return true;
  return /(^|\s)notranslate(\s|$)/.test(el.attrs.get("class")?.value ?? "");
}

/** A node a reader reads no words in: whitespace, a comment, an icon, an empty element. */
function wordless(n: Node): boolean {
  if (n.type === "raw") return true;
  if (n.type === "text") return !/\S/.test(n.raw);
  if (VOID.has(n.name) || skipped(n)) return true;
  return n.children.every(wordless);
}

function isInline(n: Node): boolean {
  return n.type !== "el" || INLINE.has(n.name);
}

function hasOwnText(run: readonly Node[]): boolean {
  return run.some((n) => n.type === "text" && /\S/.test(n.raw) && isWords(decodeEntities(n.raw)));
}

/** A segment: the nodes of a run, its msgid, and how to rebuild it. */
interface Segment {
  parent: Node[];
  from: number;
  to: number;
  msgid: string;
  /** Placeholder number → the element it stands for. */
  slots: ElementNode[];
  lead: string;
  trail: string;
}

interface AttrSegment {
  el: ElementNode;
  attr: string;
  msgid: string;
}

/** The msgid of a run, numbering its elements into `slots`. */
function runMsgid(run: readonly Node[], slots: ElementNode[]): string {
  let s = "";
  for (const n of run) {
    if (n.type === "text") s += decodeEntities(n.raw);
    else if (n.type === "raw") continue;
    else {
      const k = slots.length;
      slots.push(n);
      if (VOID.has(n.name) || skipped(n) || n.close === "" || wordless(n)) s += `<${k}/>`;
      else s += `<${k}>${runMsgid(n.children, slots)}</${k}>`;
    }
  }
  return s;
}

function walk(nodes: Node[], segs: Segment[], attrs: AttrSegment[]): void {
  for (const n of nodes) if (n.type === "el" && !skipped(n)) collectAttrs(n, attrs);
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i];
    if (!isInline(n)) {
      if (n.type === "el" && !skipped(n)) walk(n.children, segs, attrs);
      i++;
      continue;
    }
    let j = i;
    while (j < nodes.length && isInline(nodes[j])) j++;
    const run = nodes.slice(i, j);
    if (hasOwnText(run)) {
      // Trim leading and trailing whitespace-only text and void-only edges out of the segment.
      let a = i;
      let b = j;
      while (a < b && wordless(nodes[a])) a++;
      while (b > a && wordless(nodes[b - 1])) b--;
      const slots: ElementNode[] = [];
      const raw = runMsgid(nodes.slice(a, b), slots);
      const lead = /^\s*/.exec(raw)![0];
      const trail = /\s*$/.exec(raw)![0];
      const msgid = collapse(raw).trim();
      if (isWords(msgid.replace(/<\/?\d+\/?>/g, ""))) segs.push({ parent: nodes, from: a, to: b, msgid, slots, lead, trail });
      for (const el of slots) if (!skipped(el)) for (const d of descendants(el)) collectAttrs(d, attrs);
    } else {
      for (const m of run) if (m.type === "el" && !skipped(m)) walk(m.children, segs, attrs);
    }
    i = j;
  }
}

function* descendants(el: ElementNode): Generator<ElementNode> {
  for (const c of el.children) {
    if (c.type !== "el" || skipped(c)) continue;
    yield c;
    yield* descendants(c);
  }
}

function collectAttrs(el: ElementNode, out: AttrSegment[]): void {
  for (const a of TEXT_ATTRIBUTES) {
    const v = el.attrs.get(a);
    if (v && v.start >= 0) {
      const msgid = collapse(decodeEntities(v.value)).trim();
      if (isWords(msgid)) out.push({ el, attr: a, msgid });
    }
  }
  if (el.name === "meta" && el.attrs.get("name")?.value === "description") {
    const v = el.attrs.get("content");
    if (v && v.start >= 0) {
      const msgid = collapse(decodeEntities(v.value)).trim();
      if (isWords(msgid)) out.push({ el, attr: "content", msgid });
    }
  }
}

function segmentsOf(tree: Node[]): { segs: Segment[]; attrs: AttrSegment[] } {
  const segs: Segment[] = [];
  const attrs: AttrSegment[] = [];
  walk(tree, segs, attrs);
  return { segs, attrs };
}

/** Every msgid a page holds, in reading order, each once. */
export function extractHtml(html: string): string[] {
  const { segs, attrs } = segmentsOf(parseHtml(html));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of [...segs.map((s) => s.msgid), ...attrs.map((a) => a.msgid)]) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

// ── injecting ────────────────────────────────────────────────────────────

/** A msgstr's placeholders, checked against the msgid's. */
type Piece = { text: string } | { open: number } | { close: number } | { void: number };

function pieces(s: string): Piece[] | undefined {
  const out: Piece[] = [];
  const re = /<(\/?)(\d+)(\/?)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    const k = Number(m[2]);
    if (m[1] && m[3]) return undefined;
    out.push(m[1] ? { close: k } : m[3] ? { void: k } : { open: k });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

function shape(s: string): string | undefined {
  const p = pieces(s);
  if (!p) return undefined;
  return p
    .map((x) => ("text" in x ? "" : "open" in x ? `o${x.open}` : "close" in x ? `c${x.close}` : `v${x.void}`))
    .filter(Boolean)
    .sort()
    .join(",");
}

/** Rebuild a segment's nodes from a msgstr; undefined when its placeholders do not match. */
function rebuild(seg: Segment, msgstr: string): Node[] | undefined {
  if (shape(msgstr) !== shape(seg.msgid)) return undefined;
  const ps = pieces(msgstr)!;
  const root: Node[] = [];
  const stack: { k: number; nodes: Node[] }[] = [{ k: -1, nodes: root }];
  for (const p of ps) {
    const top = stack[stack.length - 1];
    if ("text" in p) top.nodes.push({ type: "text", raw: escapeText(p.text) });
    else if ("void" in p) {
      const el = seg.slots[p.void];
      if (!el) return undefined;
      top.nodes.push(el);
    } else if ("open" in p) {
      if (!seg.slots[p.open]) return undefined;
      stack.push({ k: p.open, nodes: [] });
    } else {
      if (top.k !== p.close) return undefined;
      stack.pop();
      const el = seg.slots[p.close];
      stack[stack.length - 1].nodes.push({ ...el, children: top.nodes });
    }
  }
  if (stack.length !== 1) return undefined;
  return [{ type: "text", raw: seg.lead }, ...root, { type: "text", raw: seg.trail }];
}

/** The locales written right to left. */
const RTL = new Set(["ar", "fa", "he", "ur", "ps", "dv", "yi"]);

export function isRtl(locale: string): boolean {
  return RTL.has(locale.split("-")[0].toLowerCase());
}

export interface InjectResult {
  html: string;
  /** Segments put back translated. */
  translated: number;
  /** Segments with no translation: still English. */
  untranslated: string[];
  /** Translations not used because their placeholders do not match the msgid's. */
  rejected: string[];
}

/**
 * The page in `locale`: every segment the catalogue translates replaced, the
 * rest left English, and `<html lang dir>` set to the locale.
 */
export function injectHtml(html: string, catalogue: ReadonlyMap<string, string>, locale: string): InjectResult {
  const tree = parseHtml(html);
  const { segs, attrs } = segmentsOf(tree);
  let translated = 0;
  const untranslated: string[] = [];
  const rejected: string[] = [];
  // Attributes first: their elements are reused by reference when a segment is rebuilt.
  const attrEdits = new Map<ElementNode, { start: number; end: number; value: string }[]>();
  for (const a of attrs) {
    const t = catalogue.get(a.msgid);
    if (!t) {
      untranslated.push(a.msgid);
      continue;
    }
    if (t === a.msgid) {
      translated++;
      continue;
    }
    const v = a.el.attrs.get(a.attr)!;
    const list = attrEdits.get(a.el) ?? [];
    if (!list.some((x) => x.start === v.start)) list.push({ start: v.start, end: v.end, value: escapeAttr(t) });
    attrEdits.set(a.el, list);
    translated++;
  }
  for (const [el, edits] of attrEdits) {
    let open = el.open;
    for (const ed of edits.sort((x, y) => y.start - x.start)) open = open.slice(0, ed.start) + ed.value + open.slice(ed.end);
    el.open = open;
  }
  // Segments, last first within a parent, so earlier indices stay valid.
  const byParent = new Map<Node[], Segment[]>();
  for (const s of segs) byParent.set(s.parent, [...(byParent.get(s.parent) ?? []), s]);
  for (const [parent, list] of byParent) {
    for (const s of list.sort((x, y) => y.from - x.from)) {
      const t = catalogue.get(s.msgid);
      if (!t) {
        untranslated.push(s.msgid);
        continue;
      }
      if (t === s.msgid) {
        translated++;
        continue;
      }
      const nodes = rebuild(s, t);
      if (!nodes) {
        rejected.push(s.msgid);
        continue;
      }
      parent.splice(s.from, s.to - s.from, ...nodes);
      translated++;
    }
  }
  const htmlEl = tree.find((n): n is ElementNode => n.type === "el" && n.name === "html");
  if (htmlEl) htmlEl.open = withLangDir(htmlEl.open, locale);
  return { html: serializeHtml(tree), translated, untranslated, rejected };
}

function withLangDir(open: string, locale: string): string {
  let o = /\slang="[^"]*"/.test(open) ? open.replace(/\slang="[^"]*"/, ` lang="${locale}"`) : open.replace(/^<html/i, `<html lang="${locale}"`);
  o = o.replace(/\sdir="[^"]*"/, "");
  if (isRtl(locale)) o = o.replace(/^<html/i, `<html dir="rtl"`);
  return o;
}
