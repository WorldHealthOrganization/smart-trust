/**
 * gettext over the labels of an inline SVG drawing: a BPMN diagram as
 * bpmn-js draws it, a chart's `<title>`s.
 *
 * @module pipeline/svg-label-po
 *
 * `html-po.ts` never reads inside `<svg>`: a drawing's words are laid out by
 * coordinates, not by the browser, so they cannot simply be swapped. A label
 * is one `<text>` whose `<tspan>`s are its lines, each placed by bpmn-js at
 * an `x` that centres it in its box. The `msgid` is the whole label, its
 * lines joined with a space, which is how `bpmn-translate.ts` offers a BPMN
 * `name` (the authored breaks are not load-bearing; bpmn-js re-wraps), so a
 * layer's `translations/<locale>/processes/*.po` already answers it.
 *
 * Putting a translation back re-wraps it: to the width of the widest English
 * line (estimated from the font size, a CJK character a full em), centred on
 * the centre the English lines had, and the block of lines centred on the
 * English block's middle. An estimate, not a measurement: there is no font
 * in a build. A `<text>` with no `<tspan>` and a `<title>` are replaced as
 * they are.
 *
 * Pure: no filesystem.
 */
import { decodeEntities, isWords } from "./html-po.ts";

const TEXT_RE = /<text\b([^>]*)>((?:\s*<tspan\b[^>]*>[^<]*<\/tspan>)+)\s*<\/text>/g;
const TSPAN_RE = /<tspan\b([^>]*)>([^<]*)<\/tspan>/g;
const PLAIN_TEXT_RE = /<text\b([^>]*)>([^<]+)<\/text>/g;
const TITLE_RE = /<title>([^<]+)<\/title>/g;

function svgs(html: string): { start: number; end: number }[] {
  // Outermost drawings only, counting nested `<svg>`s so an inner one does not end its parent.
  const out: { start: number; end: number }[] = [];
  const re = /<svg\b|<\/svg\s*>/g;
  let depth = 0;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[0][1] !== "/") {
      if (depth === 0) start = m.index;
      depth++;
    } else if (depth > 0 && --depth === 0) out.push({ start, end: m.index + m[0].length });
  }
  return out;
}

const label = (s: string) => decodeEntities(s).replace(/\s+/g, " ").trim();

/** Every label in the page's inline drawings, joined lines first. */
export function extractSvgLabels(html: string): string[] {
  const out: string[] = [];
  for (const { start, end } of svgs(html)) {
    const svg = html.slice(start, end);
    for (const m of svg.matchAll(TEXT_RE)) out.push(label([...m[2].matchAll(TSPAN_RE)].map((t) => t[2]).join(" ")));
    for (const m of svg.matchAll(PLAIN_TEXT_RE)) out.push(label(m[2]));
    for (const m of svg.matchAll(TITLE_RE)) out.push(label(m[1]));
  }
  return [...new Set(out.filter(isWords))];
}

function num(attrs: string, name: string): number | undefined {
  const m = new RegExp(`\\s${name}="(-?[0-9.]+)"`).exec(attrs);
  return m ? Number(m[1]) : undefined;
}

function fontSize(attrs: string): number {
  const m = /font-size:\s*([0-9.]+)px/.exec(attrs);
  return m ? Number(m[1]) : 12;
}

/** An estimated advance width, in px. */
export function textWidth(s: string, size: number): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x2e80) w += 1.0;
    else if (ch === " ") w += 0.28;
    else if (/[A-Z0-9]/.test(ch)) w += 0.62;
    else if (/[iljtf.,:;'!|]/.test(ch)) w += 0.3;
    else w += 0.52;
  }
  return w * size;
}

/** Break `s` into lines no wider than `max`; a CJK run may break between any two characters. */
export function wrap(s: string, size: number, max: number): string[] {
  const tokens = s.match(/[⺀-￿]|[^\s⺀-￿]+|\s+/g) ?? [];
  const lines: string[] = [];
  let cur = "";
  for (const t of tokens) {
    if (/^\s+$/.test(t)) {
      if (cur) cur += " ";
      continue;
    }
    const next = cur + t;
    if (cur.trim() && textWidth(next.trim(), size) > max) {
      lines.push(cur.trim());
      cur = t;
    } else cur = next;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface SvgInjectResult {
  html: string;
  translated: number;
  untranslated: string[];
}

/** The page with its drawings' labels in the catalogue's language. */
export function injectSvgLabels(html: string, catalogue: ReadonlyMap<string, string>): SvgInjectResult {
  let translated = 0;
  const untranslated: string[] = [];
  const parts: string[] = [];
  let last = 0;
  for (const { start, end } of svgs(html)) {
    parts.push(html.slice(last, start));
    let svg = html.slice(start, end);
    svg = svg.replace(TEXT_RE, (whole, attrs: string, inner: string) => {
      const spans = [...inner.matchAll(TSPAN_RE)].map((t) => ({ attrs: t[1], text: decodeEntities(t[2]) }));
      const id = label(spans.map((s) => s.text).join(" "));
      if (!isWords(id)) return whole;
      const t = catalogue.get(id);
      if (!t) {
        untranslated.push(id);
        return whole;
      }
      translated++;
      if (t === id) return whole;
      const size = fontSize(attrs);
      const xs = spans.map((s) => num(s.attrs, "x"));
      const ys = spans.map((s) => num(s.attrs, "y"));
      if (xs.some((x) => x === undefined) || ys.some((y) => y === undefined)) {
        return `<text${attrs}><tspan${spans[0].attrs}>${esc(t)}</tspan></text>`;
      }
      const widths = spans.map((s) => textWidth(s.text, size));
      const centre = spans.reduce((a, _s, i) => a + xs[i]! + widths[i] / 2, 0) / spans.length;
      const max = Math.max(...widths, size * 4);
      const lh = spans.length > 1 ? (ys[spans.length - 1]! - ys[0]!) / (spans.length - 1) : size * 1.2;
      const mid = (ys[0]! + ys[spans.length - 1]!) / 2;
      const lines = wrap(t, size, max * 1.05);
      const tspans = lines
        .map((l, k) => {
          const y = mid + (k - (lines.length - 1) / 2) * lh;
          const x = centre - textWidth(l, size) / 2;
          return `<tspan x="${x.toFixed(2)}" y="${y.toFixed(2)}">${esc(l)}</tspan>`;
        })
        .join("");
      return `<text${attrs}>${tspans}</text>`;
    });
    svg = svg.replace(PLAIN_TEXT_RE, (whole, attrs: string, text: string) => {
      const id = label(text);
      if (!isWords(id)) return whole;
      const t = catalogue.get(id);
      if (!t) {
        untranslated.push(id);
        return whole;
      }
      translated++;
      return t === id ? whole : `<text${attrs}>${esc(t)}</text>`;
    });
    svg = svg.replace(TITLE_RE, (whole, text: string) => {
      const id = label(text);
      if (!isWords(id)) return whole;
      const t = catalogue.get(id);
      if (!t) {
        untranslated.push(id);
        return whole;
      }
      translated++;
      return t === id ? whole : `<title>${esc(t)}</title>`;
    });
    parts.push(svg);
    last = end;
  }
  parts.push(html.slice(last));
  return { html: parts.join(""), translated, untranslated };
}
