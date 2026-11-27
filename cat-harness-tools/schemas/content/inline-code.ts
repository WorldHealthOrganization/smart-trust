/**
 * Backtick spans in authored prose, rendered as `<code>`.
 *
 * @module schemas/inline-code
 * @graphNode schema
 *
 * Bean titles, glossary definitions and skill descriptions are written in
 * Markdown and reach HTML through generators that escape text verbatim, so
 * without this a reader sees the backticks themselves.
 *
 * ## The caller's escaper, not ours
 *
 * Generators escape differently (the glossary also escapes `{` for Liquid),
 * so the caller passes its escaper, and it is applied to EVERY piece, the
 * code spans included. The only thing this adds is the `<code>` wrapper.
 *
 * ## What counts as a span
 *
 * A pair of single backticks on one line with at least one character between
 * them. An unpaired backtick is left as written.
 */
const SPAN = /`([^`\n]+)`/g;

/** Escape `text` with the caller's `escape`, wrapping each backtick span in `<code>`. */
export function withInlineCode(text: string, escape: (s: string) => string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(SPAN)) {
    const at = m.index!;
    out += escape(text.slice(last, at)) + `<code>${escape(m[1]!)}</code>`;
    last = at + m[0].length;
  }
  return out + escape(text.slice(last));
}

/**
 * The same text with the backtick MARKERS removed, for a surface that cannot
 * hold markup: a page `title:` the theme prints as plain text in the sidebar
 * and the browser tab.
 */
export function stripInlineCode(text: string): string {
  return text.replace(SPAN, "$1");
}
