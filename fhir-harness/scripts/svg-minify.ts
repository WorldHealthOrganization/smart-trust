/**
 * Minify an SVG losslessly: drop what a drawing editor left in the file for
 * itself, and the whitespace between tags that no renderer draws. The picture
 * is not changed.
 *
 * @module fhir-harness/scripts/svg-minify
 *
 * An IG's `input/images/` often holds diagrams saved from Visio or Inkscape,
 * where most of the bytes are the editor's own records: Visio's
 * `v:userDefs`, `v:cp` and `v:textBlock` elements and `v:` attributes on
 * every shape, Inkscape's `sodipodi:namedview` and `inkscape:` attributes.
 * `build-ig-site.ts` passes each SVG it publishes from `input/images/`
 * through {@link minifySvg}; the IG's source is not changed.
 *
 * ## What goes
 *
 * 1. Elements and attributes in an EDITOR namespace ({@link EDITOR_NAMESPACES},
 *    matched by namespace URI, never by prefix), and the `xmlns:` declarations
 *    that bound them. No SVG renderer reads them.
 * 2. Comments, except a licence or copyright notice ({@link keepSvgComment}).
 * 3. Whitespace-only text between tags, except inside an element whose text a
 *    renderer reads or shows ({@link TEXT_ELEMENTS}: `text`, `tspan`, `title`,
 *    `style`, …), where every character is copied through.
 * 4. Whitespace inside a tag: one space between attributes, none before `>`.
 *    Attribute VALUES are copied through byte for byte.
 *
 * Numbers are not rewritten, ids are not removed and `<title>`/`<desc>` stay:
 * each can change what a reader sees or what another file links to.
 *
 * ## When it does nothing
 *
 * Anything it cannot read with certainty — a DOCTYPE (which may declare
 * entities), an unterminated comment or tag, an attribute it cannot parse, a
 * prefix bound to two namespaces, bytes that are not UTF-8
 * ({@link minifySvgBytes}) — returns the input unchanged. A second run
 * changes nothing (`minifySvg(minifySvg(x)) === minifySvg(x)`).
 */

/** Namespaces a drawing editor writes for itself; no renderer reads them. */
export const EDITOR_NAMESPACES: ReadonlySet<string> = new Set([
  "http://www.inkscape.org/namespaces/inkscape",
  "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd",
  "http://schemas.microsoft.com/visio/2003/SVGExtensions/",
  "http://ns.adobe.com/AdobeIllustrator/10.0/",
  "http://ns.adobe.com/AdobeSVGViewerExtensions/3.0/",
  "http://ns.adobe.com/Extensibility/1.0/",
  "http://ns.adobe.com/Flows/1.0/",
  "http://ns.adobe.com/Graphs/1.0/",
  "http://ns.adobe.com/ImageReplacement/1.0/",
  "http://ns.adobe.com/SaveForWeb/1.0/",
  "http://ns.adobe.com/Variables/1.0/",
  "http://www.bohemiancoding.com/sketch/ns",
  "http://www.figma.com/figma/ns",
  "http://www.serif.com/",
]);

/** Elements whose character content is rendered, shown or parsed: their text is copied through. */
export const TEXT_ELEMENTS: ReadonlySet<string> = new Set(["text", "tspan", "textPath", "tref", "altGlyph", "title", "desc", "style", "script", "foreignObject", "metadata"]);

/** A comment kept in the published copy: a licence, copyright or attribution notice. */
export function keepSvgComment(body: string): boolean {
  return /licen[cs]e|copyright|©|\(c\)|attribution|SPDX/i.test(body);
}

type Attr = { name: string; value: string };
type Token =
  | { kind: "raw"; text: string }
  | { kind: "comment"; text: string; body: string }
  | { kind: "text"; text: string }
  | { kind: "open"; name: string; attrs: Attr[]; selfClosing: boolean }
  | { kind: "close"; name: string };

const NAME = /[A-Za-z_:][-A-Za-z0-9_:.]*/y;
const ATTR = /\s+([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*')/y;
const TAG_END = /\s*(\/?)>/y;

/** The document as tokens, or undefined when any part of it cannot be read with certainty. */
function tokenize(s: string): Token[] | undefined {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) {
      out.push({ kind: "text", text: s.slice(i) });
      break;
    }
    if (lt > i) out.push({ kind: "text", text: s.slice(i, lt) });
    if (s.startsWith("<!--", lt)) {
      const end = s.indexOf("-->", lt + 4);
      if (end < 0) return undefined;
      out.push({ kind: "comment", text: s.slice(lt, end + 3), body: s.slice(lt + 4, end) });
      i = end + 3;
    } else if (s.startsWith("<![CDATA[", lt)) {
      const end = s.indexOf("]]>", lt);
      if (end < 0) return undefined;
      out.push({ kind: "raw", text: s.slice(lt, end + 3) });
      i = end + 3;
    } else if (s.startsWith("<?", lt)) {
      const end = s.indexOf("?>", lt);
      if (end < 0) return undefined;
      out.push({ kind: "raw", text: s.slice(lt, end + 2) });
      i = end + 2;
    } else if (s.startsWith("<!", lt)) {
      // A DOCTYPE may declare entities the document uses: not read.
      return undefined;
    } else if (s.startsWith("</", lt)) {
      NAME.lastIndex = lt + 2;
      const m = NAME.exec(s);
      if (!m) return undefined;
      const end = s.indexOf(">", NAME.lastIndex);
      if (end < 0 || s.slice(NAME.lastIndex, end).trim()) return undefined;
      out.push({ kind: "close", name: m[0] });
      i = end + 1;
    } else {
      NAME.lastIndex = lt + 1;
      const m = NAME.exec(s);
      if (!m) return undefined;
      let j = NAME.lastIndex;
      const attrs: Attr[] = [];
      for (;;) {
        ATTR.lastIndex = j;
        const a = ATTR.exec(s);
        if (!a) break;
        attrs.push({ name: a[1]!, value: a[2]! });
        j = ATTR.lastIndex;
      }
      TAG_END.lastIndex = j;
      const rest = TAG_END.exec(s);
      if (!rest) return undefined;
      out.push({ kind: "open", name: m[0], attrs, selfClosing: rest[1] === "/" });
      i = j + rest[0].length;
    }
  }
  return out;
}

const prefixOf = (name: string): string | undefined => (name.includes(":") ? name.slice(0, name.indexOf(":")) : undefined);
const localOf = (name: string): string => name.slice(name.indexOf(":") + 1);
const unquote = (v: string): string => v.slice(1, -1);

/** The SVG with editor records, comments and inter-tag whitespace removed; the input itself when it cannot be read with certainty. */
export function minifySvg(svg: string): string {
  const tokens = tokenize(svg);
  if (!tokens) return svg;
  // Every prefix the document binds, and to what: a prefix bound to two namespaces is not guessed at.
  const bound = new Map<string, string>();
  for (const t of tokens) {
    if (t.kind !== "open") continue;
    for (const a of t.attrs) {
      if (!a.name.startsWith("xmlns:")) continue;
      const p = a.name.slice(6);
      const uri = unquote(a.value);
      if (bound.has(p) && bound.get(p) !== uri) return svg;
      bound.set(p, uri);
    }
  }
  const editor = new Set([...bound].filter(([, uri]) => EDITOR_NAMESPACES.has(uri)).map(([p]) => p));
  const isEditor = (name: string): boolean => {
    const p = prefixOf(name);
    return p !== undefined && editor.has(p);
  };
  const out: string[] = [];
  // The open elements, and how many of them read their text; `dropping` counts editor elements open.
  const stack: string[] = [];
  let textDepth = 0;
  let dropping = 0;
  for (const t of tokens) {
    if (t.kind === "open") {
      if (dropping || isEditor(t.name)) {
        if (!t.selfClosing) {
          stack.push(t.name);
          dropping++;
        }
        continue;
      }
      const attrs = t.attrs.filter((a) => !isEditor(a.name) && !(a.name.startsWith("xmlns:") && editor.has(a.name.slice(6))));
      out.push(`<${t.name}${attrs.map((a) => ` ${a.name}=${a.value}`).join("")}${t.selfClosing ? "/>" : ">"}`);
      if (!t.selfClosing) {
        stack.push(t.name);
        if (TEXT_ELEMENTS.has(localOf(t.name))) textDepth++;
      }
    } else if (t.kind === "close") {
      if (stack.at(-1) !== t.name) return svg;
      stack.pop();
      if (dropping) {
        dropping--;
        continue;
      }
      if (TEXT_ELEMENTS.has(localOf(t.name))) textDepth--;
      out.push(`</${t.name}>`);
    } else if (dropping) {
      continue;
    } else if (t.kind === "comment") {
      if (keepSvgComment(t.body)) out.push(t.text);
    } else if (t.kind === "text") {
      if (textDepth > 0 || t.text.trim()) out.push(t.text);
    } else {
      out.push(t.text);
    }
  }
  if (stack.length) return svg;
  return out.join("");
}

/**
 * {@link minifySvg} over a file's bytes: the bytes themselves when they are
 * not UTF-8, or the XML declaration names another encoding, since text read
 * in the wrong encoding would be written back changed.
 */
export function minifySvgBytes(bytes: Uint8Array): Uint8Array {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return bytes;
  }
  const declared = /^\uFEFF?<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["']/.exec(text);
  if (declared && !/^utf-?8$/i.test(declared[1]!)) return bytes;
  const small = minifySvg(text);
  return small === text ? bytes : new TextEncoder().encode(small);
}
