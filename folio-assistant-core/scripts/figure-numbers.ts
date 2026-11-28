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
 * it, skipping any number a source label holds elsewhere in the document. A
 * caption that already carries the source's label ("Fig. 3. …") is not
 * labelled twice: the heading takes that number and the caption drops it
 * ({@link numberFigures}). A figure numbered from its source keeps that number; the count is per
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

/**
 * The words a source publication puts before a figure's or a table's own
 * number, in the languages WHO publishes in ("Fig. 3.", "Figure 2.13:",
 * "Figura 4", "Tableau 1", "Рис. 2", "图 1", "الشكل 5"). A diagram is
 * labelled as a figure is.
 */
const FIGURE_WORDS = "Figures?|Figs?\\.?|Figuras?|Abbildung|Abb\\.?|Diagrams?|Рисунок|Рис\\.?|图|圖|الشكل|شكل";
const TABLE_WORDS = "Tables?|Tableaux?|Tablas?|Tabelas?|Tabellen?|Tab\\.?|Tbl\\.?|Таблица|Табл\\.?|表|الجدول|جدول";
const labelRe = (words: string) => new RegExp(`^\\s*(?:${words})\\s*(\\d+(?:\\.\\d+)*)(?![\\d.]*\\d)\\s*[.:]?\\s*`, "iu");
const FIGURE_LABEL = labelRe(FIGURE_WORDS);
const TABLE_LABEL = labelRe(TABLE_WORDS);

/** The label a caption starts with: its number, the caption without it, and whether it is the block's own kind. */
function captionLabel(kind: string, caption: string): { number: string; rest: string; own: boolean } | null {
  const ownRe = kind === "table" ? TABLE_LABEL : FIGURE_LABEL;
  const own = ownRe.exec(caption);
  if (own) return { number: own[1]!, rest: caption.slice(own[0].length).trim(), own: true };
  const other = (kind === "table" ? FIGURE_LABEL : TABLE_LABEL).exec(caption);
  return other ? { number: other[1]!, rest: caption, own: false } : null;
}

/** A caption printed on the heading line: " *Fig. 1. Title*", before the permalink. */
const INLINE_CAPTION = /^ \*(?!\*)(.*?[^*\s])\*(?= <a |\s*$)/;

interface Frame {
  readonly heading: number;
  readonly old: string;
  readonly word: string;
  number?: string;
  /** Where the caption is: on the heading line, or the frame's last italic line. */
  readonly caption?: { readonly text: string; readonly line: number; readonly inline?: RegExpExecArray };
  /** The caption without the source's label, when it had one of its own kind. */
  rest?: string;
}

/**
 * The Markdown with every unnumbered figure, diagram and table heading
 * numbered in document order, and no label printed twice.
 *
 * A caption that starts with the source's own label ("Fig. 3. Primary health
 * care digital ecosystem", "Table 2: …", "Figura 4.") gives the heading its
 * number, and the caption drops the label: the page reads "Figure 3. Primary
 * health care digital ecosystem", never "Figure 3. Fig. 3. …" (dth-phc,
 * 2026-11-17). The source's number is kept (owner: source numbering stays);
 * a number is added only to a block whose caption has none. A caption that
 * starts with another kind's label ("Fig. 8 as a table: …" on a table) names
 * the figure it comes from, not the table's own number, so the table is
 * numbered as unnumbered and the caption is left as written. A number a
 * source label holds anywhere in the document is not given to an unnumbered
 * block, so no two blocks are cited by the same number.
 */
export function numberFigures(markdown: string): string {
  const lines = markdown.split("\n");
  const frames: Frame[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i]!)) inFence = !inFence;
    if (inFence) continue;
    const f = FRAME.exec(lines[i]!);
    if (!f) continue;
    let h = -1;
    let end = -1;
    let fenced = false;
    let open = false;
    for (let k = i + 1; k < lines.length; k++) {
      const l = lines[k]!;
      if (FENCE.test(l)) { if (h < 0) break; fenced = true; open = !open; continue; }
      if (!open && l.trim() === "</div>") { end = k; break; }
      if (h < 0 && HEADING.test(l)) h = k;
    }
    if (h < 0) continue;
    const named = HEADING.exec(lines[h]!)!;
    const { word, number } = parseHeading(named[1]!);
    const inline = INLINE_CAPTION.exec(lines[h]!.slice(named[0].length));
    let caption: Frame["caption"];
    if (inline) caption = { text: inline[1]!, line: h, inline };
    else if (end > 0) {
      let k = end - 1;
      while (k > h && lines[k]!.trim() === "") k--;
      const cap = k > h ? ITALIC_LINE.exec(lines[k]!.trim()) : null;
      if (cap && !fenced) caption = { text: cap[1]!, line: k };
    }
    const frame: Frame = { heading: h, old: named[1]!, word, number, caption };
    const label = caption ? captionLabel(f[1]!, caption.text) : null;
    if (label?.own) {
      frame.number = label.number;
      frame.rest = label.rest;
    } else if (label && number !== undefined && number.split("–")[0] === label.number) {
      frame.number = undefined;
    }
    frames.push(frame);
  }

  const held = new Map<string, Set<number>>();
  for (const fr of frames) {
    const whole = fr.number === undefined ? null : /^(?:\d+(?:\.\d+)*–)?(\d+)$/.exec(fr.number);
    if (whole) held.set(fr.word, (held.get(fr.word) ?? new Set()).add(Number(whole[1])));
  }
  const last = new Map<string, number>();
  for (const fr of frames) {
    let number = fr.number;
    if (number !== undefined) {
      const whole = /^(?:\d+(?:\.\d+)*–)?(\d+)$/.exec(number);
      if (whole) last.set(fr.word, Number(whole[1]));
    } else {
      const taken = held.get(fr.word) ?? new Set<number>();
      let n = (last.get(fr.word) ?? 0) + 1;
      while (taken.has(n)) n++;
      last.set(fr.word, n);
      held.set(fr.word, taken.add(n));
      number = String(n);
    }
    const name = `${fr.word} ${number}`;
    if (name === fr.old && fr.rest === undefined) continue;
    const line = lines[fr.heading]!;
    let tail = line.slice(HEADING.exec(line)![0].length);
    const cap = fr.caption;
    if (cap?.inline && fr.rest !== undefined) {
      tail = (fr.rest ? ` *${fr.rest}*` : "") + tail.slice(cap.inline[0].length);
    } else if (cap && fr.rest !== undefined) {
      lines[cap.line] = fr.rest ? `*${fr.rest}*` : "";
    }
    const link = (what: string) => `aria-label="Link to ${what}" title="Link to ${what}"`;
    lines[fr.heading] = `**${name}.**` + tail.replace(link(fr.old), link(name));
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
