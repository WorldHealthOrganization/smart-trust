/**
 * Wrap text in a Liquid `raw` block so Jekyll emits it verbatim.
 *
 * ## Why a helper and not two `push("{% raw %}")` lines
 *
 * A raw block ends at the FIRST closing tag Liquid sees, wherever it sits — a
 * code span, a fence, prose explaining raw blocks. A skill that wrote the
 * closing tag literally ended its page's raw block early; everything after it
 * was parsed as Liquid and the staging build died with
 * `Liquid syntax error: Unknown tag 'endraw'` on the generator's own trailing
 * tag (bean `kjbb`, noted in `a9tx` §HANDOVER). Both generators that wrap
 * authored text (`gen-skill-docs`, `gen-processes-viz`) had the same shape.
 *
 * ## The escape
 *
 * Each `{%` that opens a closing tag is replaced by: close the raw block, emit
 * `{` from a Liquid string, reopen the raw block, then the literal `%`. The
 * rendered output is byte-identical to the input. Checked against Ruby Liquid
 * 5.14 in strict mode; the tempting `{{ "{%" }}` form does NOT parse, because
 * Liquid's tokenizer sees the `{%` inside the string as a tag opener.
 */

/** Matches the `{%` of any raw-block closing tag, whitespace-control included. */
const CLOSING_TAG_OPENER = /\{%(?=-?\s*endraw\b)/g;

const ESCAPED_OPENER = '{% endraw %}{{ "{" }}{% raw %}%';

/** Escape `text` so it can sit inside one raw block and render unchanged. */
export function escapeForRaw(text: string): string {
  return text.replace(CLOSING_TAG_OPENER, ESCAPED_OPENER);
}

/**
 * What Liquid renders for text escaped by {@link escapeForRaw}: the inverse,
 * for a reader of a committed page (a test's stand-in for the layout) that
 * does not run Liquid.
 */
export function unescapeRaw(text: string): string {
  return text.split(ESCAPED_OPENER).join("{%");
}

/** `text` inside a raw block, one tag per line, safe whatever `text` holds. */
export function wrapRaw(text: string): string[] {
  return ["{% raw %}", escapeForRaw(text), "{% endraw %}"];
}
