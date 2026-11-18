/**
 * Draw a DMN 1.3 decision table as an HTML table, for the document site.
 *
 * A decision-table block's rules live in its `.dmn` companion. Until this
 * module the site showed only the block's `.md`, so authors copied the rule
 * table into Markdown by hand, and nothing kept the copy in step with the
 * `.dmn` (issue #1323; one copy in dth-hrh#83 rendered as raw text because of
 * a broken separator). The owner chose to draw the table from the file, the
 * way a process is drawn from its `.bpmn` (Q-DMN-1 A, 2026-11-01).
 *
 * ## One reader
 *
 * The table is read by {@link loadDecisionTable}, the same reader the
 * evaluator and the DMN checks use, and every cell is put through
 * {@link unreadableExpressions}. A table that reader refuses, or a cell it
 * cannot read, is refused here too, naming why. A second, more lenient
 * reader for the page would show readers rules the engine does not run.
 *
 * ## Deterministic, and plain HTML
 *
 * The output depends only on the file's content: no dates, no random ids, the
 * cells in file order. It is one raw-HTML block with no blank line inside, so
 * CommonMark (remark) keeps it whole, and every text value is escaped.
 *
 * It sits in the shared `.fa-numbered` frame that `render-markdown.ts` gives
 * figures and tables, so it takes the site look from `docs-ui.css` with no new
 * CSS: the table centred, the title line centred at no more than 66% of the
 * column.
 *
 * @module pipeline/render-dmn-table
 */

import { existsSync } from "node:fs";
import { basename } from "node:path";
import {
  listDecisions,
  loadDecisionTable,
  splitTop,
  unreadableExpressions,
  type DecisionTable,
} from "../src/workflow/decision-table.ts";

/** Escape text for HTML element content and double-quoted attributes. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A block a table may name in its labels and descriptions
 * (`freq:FR-ID-01`), as the page shows it: its title and its anchor.
 */
export interface BlockRef {
  title?: string;
  href: string;
}

/** Labels to the blocks they name, for {@link linkRefs}. */
export type BlockRefs = ReadonlyMap<string, BlockRef>;

/** A label as written in DMN prose: `prefix:ID`, e.g. `freq:FR-ID-01`. */
const LABEL = /\b[a-z][a-z0-9-]*:[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]/g;

/**
 * Escape `text`, and turn each label of a block on the page into a link that
 * reads as the block's title (owner, 2026-11-01: "dont need things like
 * freq:FR-ID-01 spelled out, just linked w/ titles"). A label naming no block
 * on the page is left as written: a link to nowhere would be worse.
 */
export function linkRefs(text: string, refs: BlockRefs = new Map()): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(LABEL)) {
    const ref = refs.get(m[0]);
    if (!ref) continue;
    out += escapeHtml(text.slice(last, m.index));
    out += `<a href="${escapeHtml(ref.href)}" title="${escapeHtml(m[0])}">${escapeHtml(ref.title ?? m[0])}</a>`;
    last = m.index! + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

/** Six hues, so each distinct outcome keeps one colour across the table. */
const CHIP_HUES = 6;

/** A stable hue index for a value: the same outcome is the same colour. */
function hueOf(value: string): number {
  let h = 0;
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % CHIP_HUES;
}

/**
 * A cell as a reader sees it, not as FEEL writes it: `-` is a faded "any",
 * each value is a chip without its quotes, a list reads "a or b", `not(x)`
 * reads "not x". Comparisons and numbers stay as written. Output values are
 * coloured by value, so rows with the same outcome stand out together. Only
 * the look changes; the cell as written is kept in the `title` attribute.
 */
export function plainCell(text: string, side: "input" | "output" = "input"): string {
  const t = text.trim();
  if (t === "" || t === "-") return '<span class="fa-dmn-any">any</span>';
  const neg = /^not\s*\(([\s\S]*)\)$/.exec(t);
  if (neg) return `<span class="fa-dmn-not">not</span> ${plainCell(neg[1]!, side)}`;
  const parts = splitTop(t);
  if (parts.length > 1) return parts.map((p) => plainCell(p, side)).join(' <span class="fa-dmn-or">or</span> ');
  const shown = /^".*"$/.test(t) ? t.slice(1, -1) : t;
  const hue = side === "output" ? ` fa-dmn-hue-${hueOf(shown)}` : "";
  return `<span class="fa-dmn-chip fa-dmn-chip-${side}${hue}">${escapeHtml(shown)}</span>`;
}

/**
 * The table's look, scoped to `.fa-dmn-table`. It ships with the table so a
 * site shows it without a theme change; the frame (centring, title width)
 * still comes from the shared `.fa-numbered` rules in `docs-ui.css`. One
 * line, no blank lines, so it stays inside the table's HTML block.
 */
export const DMN_TABLE_CSS = [
  ".fa-dmn-table{border-collapse:separate;border-spacing:0;font-size:0.9em;line-height:1.35}",
  ".fa-dmn-table th,.fa-dmn-table td{border:0;border-bottom:1px solid var(--fa-dmn-line);padding:6px 8px;vertical-align:top;text-align:left}",
  ".fa-dmn-table thead th{font-weight:600;border-bottom:2px solid var(--fa-dmn-line)}",
  ".fa-dmn-table .fa-dmn-side{text-align:center;font-size:0.8em;letter-spacing:0.04em;text-transform:uppercase}",
  ".fa-dmn-table .fa-dmn-input{background:var(--fa-dmn-in-bg)}",
  ".fa-dmn-table .fa-dmn-output{background:var(--fa-dmn-out-bg)}",
  ".fa-dmn-table .fa-dmn-first-output{border-left:3px double var(--fa-dmn-line)}",
  ".fa-dmn-table tbody th{color:var(--fa-dmn-muted);font-weight:600;text-align:center}",
  ".fa-dmn-table a{text-decoration:underline dotted}",
  ".fa-dmn-table a.fa-dmn-ref{text-decoration:none;margin-left:2px}",
  ".fa-dmn-chip{display:inline-block;border-radius:999px;padding:1px 8px;margin:1px 0;white-space:nowrap}",
  ".fa-dmn-chip-input{border:1px solid var(--fa-dmn-line);background:var(--fa-dmn-bg)}",
  ".fa-dmn-any{color:var(--fa-dmn-muted);font-style:italic;opacity:0.7}",
  ".fa-dmn-or,.fa-dmn-not{color:var(--fa-dmn-muted);font-size:0.85em}",
  ".fa-dmn-description td{color:var(--fa-dmn-muted);padding-top:0;border-bottom:1px solid var(--fa-dmn-line)}",
  ".fa-dmn-has-note>th,.fa-dmn-has-note>td{border-bottom:0}",
  ".fa-dmn-table{--fa-dmn-line:#c9ced6;--fa-dmn-muted:#5b6470;--fa-dmn-bg:#fff;--fa-dmn-in-bg:#eef4fb;--fa-dmn-out-bg:#eef8f0}",
  ".fa-dmn-hue-0{background:#dbe9ff;color:#123d7a}.fa-dmn-hue-1{background:#d9f2e3;color:#14532d}.fa-dmn-hue-2{background:#fde9c8;color:#6b3d00}",
  ".fa-dmn-hue-3{background:#f6d9e4;color:#6d1a3a}.fa-dmn-hue-4{background:#e6dcf7;color:#3d2470}.fa-dmn-hue-5{background:#d6f0f2;color:#0f4f57}",
  "@media (prefers-color-scheme:dark){.fa-dmn-table{--fa-dmn-line:#3d4450;--fa-dmn-muted:#a3acb9;--fa-dmn-bg:#1b1f24;--fa-dmn-in-bg:#16212e;--fa-dmn-out-bg:#15261c}" +
    ".fa-dmn-hue-0{background:#1d3557;color:#cfe0ff}.fa-dmn-hue-1{background:#1c3d2a;color:#c9f0d6}.fa-dmn-hue-2{background:#4a3410;color:#fde3b5}" +
    ".fa-dmn-hue-3{background:#4a1f30;color:#f6cfdd}.fa-dmn-hue-4{background:#33264f;color:#e1d6f7}.fa-dmn-hue-5{background:#123c40;color:#cdeef0}}",
].join("");

/**
 * A column header: the label, with the fact it reads as a tooltip.
 *
 * A label often ends by citing its requirements, `(freq:FR-ID-01,
 * freq:FR-ID-02)`. Those titles are whole sentences, and spelled out in a
 * header they made it many lines tall (the dth-hrh preview), so a trailing
 * citation of blocks on the page becomes small linked marks instead, each
 * showing its block's title on hover.
 */
function header(label: string | undefined, key: string, refs: BlockRefs): string {
  const text = label?.trim() ?? "";
  if (text === "") return `<span title="${escapeHtml(key)}">${escapeHtml(key)}</span>`;
  const cite = /^(.*?)\s*\(([^()]*)\)$/.exec(text);
  const cited = cite ? cite[2]!.split(",").map((c) => c.trim()) : [];
  if (cite && cited.length > 0 && cited.every((c) => refs.has(c))) {
    const marks = cited
      .map((c) => {
        const ref = refs.get(c)!;
        return `<a class="fa-dmn-ref" href="${escapeHtml(ref.href)}" title="${escapeHtml(ref.title ?? c)}">\u2197</a>`;
      })
      .join("");
    return `<span title="${escapeHtml(key)}">${escapeHtml(cite[1]!)}</span><sup>${marks}</sup>`;
  }
  return `<span title="${escapeHtml(key)}">${linkRefs(text, refs)}</span>`;
}

/** What the hit policy means, in words. */
const HIT_POLICY_WORDS: Record<DecisionTable["hitPolicy"], string> = {
  FIRST: "The first rule that matches applies.",
  UNIQUE: "Exactly one rule matches.",
};

/**
 * The HTML for one decision table, for a reader rather than an engine.
 *
 * Columns follow the DMN layout: the rule, the inputs, the outputs, then any
 * DMN 1.3 annotations. An annotation column appears only when some rule has
 * one, so a table without them is not padded with empty cells.
 *
 * The page shows words: column labels, not fact names; plain cell values;
 * block labels as titled links; the hit policy as a sentence. The technical
 * names (fact, rule id, decision id, file) stay in `title` and `data-`
 * attributes, so they are a hover away and still in the page for tools.
 *
 * A rule's `description` is prose, often a sentence or two. As a column it
 * squeezed every other column in a document's text width and made each row
 * many lines tall (the dth-hrh preview), so it sits in a full-width row under
 * its rule instead.
 */
export function decisionTableHtml(
  table: DecisionTable,
  opts: { source?: string; refs?: BlockRefs } = {},
): string {
  const refs = opts.refs ?? new Map();
  const hasDescription = table.rules.some((r) => r.description && r.description.trim() !== "");
  const annotationCount = Math.max(0, ...table.rules.map((r) => r.annotations?.length ?? 0));
  const source = opts.source ?? basename(table.source);

  const head: string[] = ['<th scope="col" rowspan="2">Rule</th>'];
  table.inputs.forEach((i) => head.push(`<th scope="col" class="fa-dmn-input">${header(i.label, i.expression, refs)}</th>`));
  table.outputs.forEach((name, n) =>
    head.push(`<th scope="col" class="fa-dmn-output${n === 0 ? " fa-dmn-first-output" : ""}">${header(table.outputLabels?.[n], name, refs)}</th>`),
  );
  for (let n = 0; n < annotationCount; n++) {
    head.push(`<th scope="col" class="fa-dmn-annotation" rowspan="2">Note${annotationCount > 1 ? ` ${n + 1}` : ""}</th>`);
  }

  const rows = table.rules.map((r, n) => {
    const cells = [`<th scope="row" title="${escapeHtml(r.id)}">${n + 1}</th>`];
    r.when.forEach((t) => cells.push(`<td class="fa-dmn-input" title="${escapeHtml(t.trim() || "-")}">${plainCell(t, "input")}</td>`));
    r.then.forEach((t, i) =>
      cells.push(`<td class="fa-dmn-output${i === 0 ? " fa-dmn-first-output" : ""}" title="${escapeHtml(t.trim())}">${plainCell(t, "output")}</td>`),
    );
    for (let a = 0; a < annotationCount; a++) {
      cells.push(`<td class="fa-dmn-annotation">${linkRefs(r.annotations?.[a] ?? "", refs)}</td>`);
    }
    const description = (r.description ?? "").trim();
    if (!hasDescription || description === "") return `<tr>${cells.join("")}</tr>`;
    return `<tr class="fa-dmn-has-note">${cells.join("")}</tr>\n<tr class="fa-dmn-description"><td></td><td colspan="${cells.length - 1}"><small><em>${linkRefs(description, refs)}</em></small></td></tr>`;
  });

  // `scope` and the label make the table readable to a screen reader; the
  // visible title line is the frame's centred `<p>`, as for every figure.
  // `table-wrapper` is the theme's own wrapper, so a wide table scrolls
  // sideways inside the column instead of widening the page.
  const title =
    `<p class="fa-dmn-title"><strong>${escapeHtml(table.name)}</strong><br>` +
    `${HIT_POLICY_WORDS[table.hitPolicy]}</p>`;
  return [
    `<div class="fa-numbered fa-numbered-decision-table" data-dmn-decision="${escapeHtml(table.id)}" data-dmn-file="${escapeHtml(source)}" data-dmn-hit-policy="${table.hitPolicy}">`,
    `<style>${DMN_TABLE_CSS}</style>`,
    title,
    `<div class="table-wrapper"><table class="fa-dmn-table" aria-label="${escapeHtml(table.name)}">`,
    `<thead><tr>${head[0]}<th scope="colgroup" colspan="${table.inputs.length}" class="fa-dmn-input fa-dmn-side">When</th>` +
      `<th scope="colgroup" colspan="${table.outputs.length}" class="fa-dmn-output fa-dmn-first-output fa-dmn-side">Then</th>` +
      `${head.slice(1 + table.inputs.length + table.outputs.length).join("")}</tr>` +
      `<tr>${head.slice(1, 1 + table.inputs.length + table.outputs.length).join("")}</tr></thead>`,
    `<tbody>`,
    ...rows,
    `</tbody>`,
    `</table></div>`,
    `</div>`,
  ].join("\n");
}

/** What {@link renderDmnFile} returns: the HTML, or why there is none. */
export type DmnRender =
  | { ok: true; html: string; decisionId: string; table: DecisionTable }
  | { ok: false; reason: string };

/**
 * Read a `.dmn` file and draw one of its decision tables.
 *
 * `decisionId` picks the decision. Without one, a file declaring exactly one
 * decision draws it, and a file declaring several is refused rather than
 * guessed: the same rule {@link loadDecisionTable} keeps for gateways.
 */
export async function renderDmnFile(
  dmnPath: string,
  decisionId?: string,
  opts: { refs?: BlockRefs } = {},
): Promise<DmnRender> {
  if (!existsSync(dmnPath)) return { ok: false, reason: `${basename(dmnPath)} does not exist` };
  try {
    let id = decisionId;
    if (!id) {
      const all = await listDecisions(dmnPath);
      if (all.length !== 1) {
        return {
          ok: false,
          reason:
            `${basename(dmnPath)} declares ${all.length} decisions (${all.map((d) => d.id).join(", ") || "none"}); ` +
            `name one with the block's \`decisionId\``,
        };
      }
      id = all[0]!.id;
    }
    const table = await loadDecisionTable(dmnPath, id);
    const unreadable = unreadableExpressions(table);
    if (unreadable.length > 0) {
      const first = unreadable[0]!;
      return {
        ok: false,
        reason:
          `${id}: ${unreadable.length} cell(s) use FEEL the reader cannot read, first ` +
          `${first.rule} ${first.side} column ${first.column} \`${first.expression}\`: ${first.message}`,
      };
    }
    return { ok: true, html: decisionTableHtml(table, opts), decisionId: id, table };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Where a block's body asks for its table. A line holding only this comment
 * is replaced by the table; a body without it gets the table at its end.
 */
export const DMN_TABLE_MARKER = "<!-- dmn:table -->";

/**
 * Put a rendered table into a block's Markdown body: at the
 * {@link DMN_TABLE_MARKER} line if there is one, otherwise after the body.
 * Blank lines either side keep the HTML a block of its own.
 */
export function placeDmnTable(body: string, html: string): string {
  const lines = body.split("\n");
  const at = lines.findIndex((l) => l.trim() === DMN_TABLE_MARKER);
  if (at >= 0) {
    return [...lines.slice(0, at), "", html, "", ...lines.slice(at + 1)].join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  return body.trim() ? `${body.trim()}\n\n${html}` : html;
}

/** The refusal shown in place of a table, so a page never silently drops one. */
export function dmnRefusalNote(reason: string): string {
  return `> **Decision table not drawn:** ${escapeHtml(reason)}`;
}
