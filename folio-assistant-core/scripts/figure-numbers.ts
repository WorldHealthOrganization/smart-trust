/**
 * Every figure, diagram and table of a document carries a number a reader
 * can see and cite.
 *
 * The block renderer (cat-harness-tools `pipeline/render-markdown.ts`) takes
 * a numbered block's number from its caption ("Fig. 4. …") and invents none,
 * so a figure a folio authored itself, whose caption starts with words, came
 * out as a bare "**Figure.**" (owner, 2026-11-17, of dth-hrh's DIIG phases
 * figure: "make sure figures are anchored"). Numbering needs the whole
 * document, which a single block's renderer does not see; the document build
 * does, so it numbers here, on the assembled Markdown, before the page is
 * rendered or split into lazy chunks.
 *
 * An unnumbered block takes the number after the last one of its kind above
 * it. A figure numbered from its source keeps that number; the count is per
 * heading word ("Figure", "Table"), and only a whole number moves it ("Figure
 * 2.13" names a chapter's figure and leaves the document's count alone). The
 * block's anchor (its label) and its permalink are the renderer's; the link's
 * accessible name takes the new number with the heading.
 *
 * @module folio-assistant-core/scripts/figure-numbers
 */

const FRAME = /^<div class="fa-numbered fa-numbered-([\w-]+)[\s"][^>]*>\s*$/;
const HEADING = /^\*\*([^*]+?)\.\*\*/;
const FENCE = /^\s*(```|~~~)/;

/** The heading word and number of a numbered block's heading ("Figure 4" → Figure, "4"). */
function parseHeading(text: string): { word: string; number?: string } {
  const m = /^(.*?)\s+(\d+(?:\.\d+)*(?:–\d+(?:\.\d+)*)?)$/.exec(text);
  return m ? { word: m[1]!, number: m[2]! } : { word: text };
}

/** The Markdown with every unnumbered figure, diagram and table heading numbered in document order. */
export function numberFigures(markdown: string): string {
  const last = new Map<string, number>();
  const lines = markdown.split("\n");
  let inFence = false;
  let framed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (FENCE.test(line)) inFence = !inFence;
    if (inFence) continue;
    if (FRAME.test(line)) { framed = true; continue; }
    if (!framed) continue;
    const h = HEADING.exec(line);
    if (!h) {
      if (line.trim() === "</div>") framed = false;
      continue;
    }
    framed = false;
    const { word, number } = parseHeading(h[1]!);
    if (number !== undefined) {
      const whole = /^(?:\d+–)?(\d+)$/.exec(number);
      if (whole) last.set(word, Number(whole[1]));
      continue;
    }
    const n = (last.get(word) ?? 0) + 1;
    last.set(word, n);
    const name = `${word} ${n}`;
    lines[i] = `**${name}.**` + line.slice(h[0].length).replace(`aria-label="Link to ${word}" title="Link to ${word}"`, `aria-label="Link to ${name}" title="Link to ${name}"`);
  }
  return lines.join("\n");
}

/** Kinds whose title goes under the drawing. A table keeps its title above it, where a reader starts a table. */
const TITLE_BELOW = new Set(["figure", "diagram"]);
const ITALIC_LINE = /^\*(?!\*)([\s\S]*[^*\s])\*$/;

/**
 * The Markdown with each figure's and diagram's title line ("**Figure 1.**
 * *caption*" and its permalink) moved under the drawing (owner, 2026-11-17:
 * "figure titles below figure with centering and max width 67%"). The
 * block's anchor stays above, so a link to the figure still lands on its top.
 * A title line with no caption of its own takes the caption printed as the
 * frame's last italic line, so the figure has one line under it, not two.
 * Centring and width are the stylesheet's (`.fa-numbered > p`).
 */
export function figureTitlesBelow(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (FENCE.test(line)) inFence = !inFence;
    const f = inFence ? null : FRAME.exec(line);
    if (!f || !TITLE_BELOW.has(f[1]!)) { out.push(line); continue; }
    const end = lines.findIndex((l, k) => k > i && l.trim() === "</div>");
    if (end < 0) { out.push(line); continue; }
    const frame = lines.slice(i + 1, end);
    const h = frame.findIndex((l) => HEADING.test(l));
    if (h < 0 || frame.slice(0, h).some((l) => FENCE.test(l))) { out.push(line); continue; }
    let title = frame[h]!;
    const body = [...frame.slice(0, h), ...frame.slice(h + 1)];
    while (body.length && body[body.length - 1]!.trim() === "") body.pop();
    const named = HEADING.exec(title)!;
    const rest = title.slice(named[0].length);
    const last = body[body.length - 1];
    const cap = last === undefined ? null : ITALIC_LINE.exec(last.trim());
    if (cap && !/^\s*\*(?!\*)/.test(rest)) {
      body.pop();
      title = `${named[0]} *${cap[1]}*${rest}`;
    }
    out.push(line, ...body, "", title, "", "</div>");
    i = end;
  }
  return out.join("\n");
}
