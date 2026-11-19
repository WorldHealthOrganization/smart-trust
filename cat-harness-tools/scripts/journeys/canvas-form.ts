/**
 * The workshop's canvas as an on-screen form, and the model its PDF is
 * written from (owner, 2026-11-17: the canvas is the policy track's primary
 * data collection).
 *
 * @module scripts/journeys/canvas-form
 * @covers workshop
 *
 * The canvas (`workshop.canvas`: a cover and its sheets, each of sections of
 * fields) is drawn as its printed pages are laid out (owner, 2026-11-19: "look
 * exactly like source PDF"): a sheet's band, title, masthead and header
 * write-ins, each section's number, minutes, DISCUSS and RULES lines and the
 * module it is worked in, then its fields as the page has them: tables with
 * their printed columns, cards side by side or one per row, sentences with
 * blanks, the gap strip. Every field is kept in the browser under
 * `<workshop>:cv:<sheet>:<field>[:<row>[:<col>]]` by the same script as every
 * other answer (`present.js`). A journey question that names a field
 * (`questions[].canvas`) is that field, under that key; unless the canvas
 * says `annex: false`, the sheet's other journey questions, of the modules it
 * names, follow it as its annex. `canvasModel` is the same canvas as JSON,
 * every key with its label, from which `assets/canvas-pdf.js` writes the
 * editable, pre-filled PDF.
 */
import { escHtml } from "../thin-page.ts";
import { canvasBlanks, canvasFieldRefs, type WorkshopCanvas, type WorkshopCanvasField, type WorkshopCanvasSection, type WorkshopCanvasSheet } from "../../schemas/process/workshop.ts";

const e = escHtml;

/** Where a canvas answer is kept (`jv:` + this): `<workshop>:cv:<sheet>:<field>[:<row>[:<col>]]`. */
export function canvasKey(workshop: string, ref: string): string {
  return `${workshop}:cv:${ref}`;
}

/** Words the sheet prints, with `**bold**` and `*italic*` and nothing else read as markup. */
export function mdLite(s: string): string {
  return e(s)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<i>$2</i>");
}
/** The same words, plain (for the PDF and the summary). */
export function plainLite(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1$2");
}

/** One answer the PDF writes: a write-in (`text`), a tick (`tick`, kept as `value` when ticked), or printed words (`label`). */
export interface CanvasModelCell {
  key: string;
  label: string;
  kind: "text" | "tick" | "label";
  /** A tick's kept value: "1" for a ticks or grid cell, the option's id for a choice or a gap rating. */
  value?: string;
  /** One of a group under one key (a choice, a gap strip's row): a radio button, exported as `value`. */
  radio?: true;
  lines?: number;
}
/** A field as the PDF lays it out: a heading, then its cells in rows (`cols` across). */
export interface CanvasModelField {
  label: string;
  hint?: string;
  /** A grid's or gap strip's column heads. */
  heads?: string[];
  /** A row with `group` is a heading row, and has no cells. */
  rows: { label?: string; group?: string; cells: CanvasModelCell[] }[];
}
export interface CanvasModelSheet {
  id: string;
  label?: string;
  title: string;
  intro?: string;
  sections: { title?: string; fields: CanvasModelField[] }[];
  /** The journey questions of the sheet's modules that no field asks: its annex. */
  annex: { step: string; label: string; key: string }[];
}
export interface CanvasModel {
  title: string;
  size: "A3" | "A4";
  workshop: string;
  sheets: CanvasModelSheet[];
  /** What the PDF appends after the sheets (owner, 2026-11-19): the table's systems, the architecture, the views and the processes. */
  appendix?: CanvasAppendix;
}

/** A box the appendix draws: its name, and (an application component the table may name) its key's slug. */
export interface CanvasAppendixBox {
  name: string;
  slug?: string;
}
/**
 * The PDF's appendix, after the sheets: the application components the table
 * marked on How it works (`have` and `local` are the keys of its tick and its
 * own name), the architecture panel, then each ArchiMate view and BPMN
 * process as a drawing, fetched from `src` (relative to the page) and drawn
 * with every component the table named under its own name.
 */
export interface CanvasAppendix {
  systems: { name: string; slug: string; have: string; local: string }[];
  panel?: { title: string; countries: string[]; rows: { layer: string; cells: CanvasAppendixBox[][] }[]; shared?: { group: string; members: CanvasAppendixBox[] } };
  figures: { kind: "archimate" | "bpmn"; title: string; src: string }[];
}

/** A journey question, with its step and the key its answer is kept under. */
export interface AnnexQuestion {
  /** The step's id, as the room says it ("J4.2"). */
  step: string;
  /** The presented step's key, for its link. */
  stepKey: string;
  module: string;
  text: string;
  key: string;
  /** The field it is, when it names one. */
  canvas?: string;
}

type Opt = { id: string; label: string; write?: boolean };
type Grid = Extract<WorkshopCanvasField, { type: "grid" }>;
type Col = Grid["columns"][number];
type Row = Grid["rows"][number];

const gapOptions = (f: Extract<WorkshopCanvasField, { type: "gap" }>, scale: readonly { id: string; label: string }[] | undefined) => f.options ?? scale ?? [];
const fieldLabel = (f: WorkshopCanvasField): string => ("label" in f && f.label ? f.label : "");
const fieldHint = (f: WorkshopCanvasField): string | undefined => ("hint" in f ? f.hint : undefined);
/** The blanks' words, split at each `___`. */
const blankParts = (text: string) => text.split("___");
/** A blanks field's text with its blanks as printed. */
const blankText = (text: string) => plainLite(text).replace(/___/g, "____");
/** A row's heading rows, in order. */
const groupsOf = (r: Row): string[] => (r.group === undefined ? [] : Array.isArray(r.group) ? r.group : [r.group]);
/** The options a grid's `choice` cell offers in a row. */
const rowOptions = (c: Col, r: Row): readonly Opt[] => r.options ?? c.options ?? [];
/** The key prefix a field's answers are kept under: its own, or (`same`) another field's. */
const keyAt = (sheet: string, f: WorkshopCanvasField): string => ("same" in f && f.same ? f.same : `${sheet}:${f.id}`);

// ── the PDF's model ───────────────────────────────────────────────────────

function gridModel(ws: string, at: string, f: Grid): CanvasModelField[] {
  const k = (ref: string) => canvasKey(ws, `${at}${ref}`);
  const base = { label: plainLite(f.label ?? ""), ...(f.hint ? { hint: plainLite(f.hint) } : {}) };
  // A choice column whose rows offer their own options draws as a choice per row.
  if (f.columns.some((c) => c.cell === "choice" && f.rows.some((r) => r.options))) {
    return [
      ...(base.label || base.hint ? [{ ...base, rows: [] }] : []),
      ...f.rows.flatMap((r): CanvasModelField[] => {
        const cells: CanvasModelCell[] = f.columns.flatMap((c): CanvasModelCell[] => {
          const key = k(`:${r.id}:${c.id}`);
          const where = `${r.label}: ${c.label}`;
          switch (c.cell) {
            case "choice":
              return rowOptions(c, r).map((o) => ({ key, label: o.label, kind: "tick", value: o.id, radio: true }));
            case "ticks":
              return (c.options ?? []).map((o) => ({ key: k(`:${r.id}:${c.id}:${o.id}`), label: o.label, kind: "tick", value: "1" }));
            case "option":
              return [{ key: k(`:${r.id}:${c.group ?? c.id}`), label: c.label, kind: "tick", value: c.id, radio: true }];
            case "tick":
              return [{ key, label: where, kind: "tick", value: "1" }];
            case "label":
              return [];
            default:
              return [{ key, label: where, kind: "text", lines: 1 }];
          }
        });
        return [...groupsOf(r).map((g) => ({ label: plainLite(g), rows: [] })), { label: plainLite(r.label), rows: [{ cells }] }];
      }),
    ];
  }
  const heads: string[] = [];
  const cellsOf: ((r: Row) => CanvasModelCell[])[] = [];
  const groups = new Set<string>();
  for (const c of f.columns) {
    if (c.cell === "choice" || c.cell === "ticks") {
      for (const o of c.options ?? []) {
        heads.push(`${c.label}: ${o.label}`);
        cellsOf.push((r) => [
          c.cell === "choice"
            ? { key: k(`:${r.id}:${c.id}`), label: `${r.label}: ${o.label}`, kind: "tick", value: o.id, radio: true }
            : { key: k(`:${r.id}:${c.id}:${o.id}`), label: `${r.label}: ${c.label}: ${o.label}`, kind: "tick", value: "1" },
        ]);
      }
    } else if (c.cell === "option") {
      const g = c.group ?? c.id;
      groups.add(g);
      heads.push(c.label);
      cellsOf.push((r) => [{ key: k(`:${r.id}:${g}`), label: `${r.label}: ${c.label}`, kind: "tick", value: c.id, radio: true }]);
    } else {
      heads.push(c.label);
      cellsOf.push((r) => [
        c.cell === "label"
          ? { key: "", label: plainLite(r.values?.[c.id] ?? ""), kind: "label" }
          : c.cell === "tick"
            ? { key: k(`:${r.id}:${c.id}`), label: `${r.label}: ${c.label}`, kind: "tick", value: "1" }
            : { key: k(`:${r.id}:${c.id}`), label: `${r.label}: ${c.label}`, kind: "text", lines: 1 },
      ]);
    }
  }
  const rows: CanvasModelField["rows"] = [];
  for (const r of f.rows) {
    for (const g of groupsOf(r)) rows.push({ group: plainLite(g), cells: [] });
    rows.push({ label: f.rowLabels === false ? "" : plainLite(r.label), cells: cellsOf.flatMap((fn) => fn(r)) });
  }
  return [{ ...base, heads, rows }];
}

function fieldModel(ws: string, sheet: string, f: WorkshopCanvasField, scale: readonly { id: string; label: string }[] | undefined): CanvasModelField[] {
  const at = `${sheet}:${f.id}`;
  const k = (ref: string) => canvasKey(ws, `${at}${ref}`);
  const label = plainLite(fieldLabel(f));
  const hint = fieldHint(f);
  const base = { label, ...(hint ? { hint: plainLite(hint) } : {}) };
  switch (f.type) {
    case "text":
      // A field showing another's answer is written once, where that one is.
      return f.same ? [] : [{ ...base, rows: [{ cells: [{ key: k(""), label, kind: "text", lines: f.inline ? 1 : f.lines }] }] }];
    case "choice":
      return [{ ...base, rows: [{ cells: f.options.map((o) => ({ key: k(""), label: o.label, kind: "tick" as const, value: o.id, radio: true as const })) }] }];
    case "ticks":
      return [
        {
          ...base,
          rows: [
            {
              cells: f.options.flatMap((o): CanvasModelCell[] => [
                { key: k(`:${o.id}`), label: o.label, kind: "tick", value: "1" },
                ...(o.write ? [{ key: k(`:${o.id}:text`), label: `${label}: ${o.label}`, kind: "text" as const, lines: 1 }] : []),
              ]),
            },
          ],
        },
      ];
    case "grid":
      return gridModel(ws, at, f);
    case "gap": {
      const opts = gapOptions(f, scale);
      return [{ ...base, heads: opts.map((o) => o.label), rows: f.rows.map((r) => ({ label: r.label, cells: opts.map((o) => ({ key: k(`:${r.id}`), label: `${r.label}: ${o.label}`, kind: "tick" as const, value: o.id, radio: true as const })) })) }];
    }
    case "blanks": {
      if (f.same) return [];
      const n = canvasBlanks(f.text);
      return [{ label: [label, blankText(f.text)].filter(Boolean).join(" "), ...(hint ? { hint: plainLite(hint) } : {}), rows: [{ cells: Array.from({ length: n }, (_, i) => ({ key: k(`:${i + 1}`), label: `${label || blankText(f.text)} (${i + 1})`, kind: "text" as const, lines: 1 })) }] }];
    }
    case "note":
      return [{ label, hint: plainLite(f.text), rows: [] }];
    case "table":
      return [{ label, heads: f.heads.slice(1), rows: f.rows.map((r) => ({ label: plainLite(r[0] ?? ""), cells: r.slice(1).map((c) => ({ key: "", label: plainLite(c), kind: "label" as const })) })) }];
    case "cards":
      return [
        ...(label ? [{ label, rows: [] }] : []),
        ...f.items.flatMap((c) => [
          { label: [c.badge, plainLite(c.title)].filter(Boolean).join(" "), ...(c.text || c.note || c.lead ? { hint: [c.lead, c.text, c.note].filter(Boolean).map((x) => plainLite(x!)).join(" ") } : {}), rows: [] },
          ...(c.fields ?? []).flatMap((x) => fieldModel(ws, at + ":" + c.id, x, scale)),
        ]),
      ];
  }
}

/** The questions a sheet's annex lists: those of its modules that are no field of the canvas; none when the canvas has no annex. */
export function annexOf(sheet: WorkshopCanvasSheet, questions: readonly AnnexQuestion[], canvas?: Pick<WorkshopCanvas, "annex">): AnnexQuestion[] {
  if (canvas?.annex === false) return [];
  const mods = new Set(sheet.modules ?? []);
  return questions.filter((q) => mods.has(q.module) && q.canvas === undefined);
}

/** A sheet's header write-ins as fields of its own. */
const headerFields = (s: WorkshopCanvasSheet): WorkshopCanvasField[] => (s.header ?? []).map((h) => ({ type: "text", id: h.id, label: h.label, lines: 1, inline: true, ...(h.same ? { same: h.same } : {}) }));

/** The canvas as the PDF writer reads it. */
export function canvasModel(ws: string, c: WorkshopCanvas, questions: readonly AnnexQuestion[], scale?: readonly { id: string; label: string }[]): CanvasModel {
  return {
    title: c.title,
    size: c.size ?? "A3",
    workshop: ws,
    sheets: c.sheets.map((s) => {
      const head = headerFields(s).flatMap((f) => fieldModel(ws, s.id, f, scale));
      return {
        id: s.id,
        ...(s.label ? { label: s.label } : {}),
        title: s.title,
        ...(s.intro ? { intro: plainLite(s.intro) } : {}),
        sections: [
          ...(head.length ? [{ fields: head }] : []),
          ...s.sections.map((x) => ({
            ...(x.title ? { title: [x.number, plainLite(x.title), x.minutes ? `(${x.minutes} min)` : ""].filter(Boolean).join(" ") } : {}),
            fields: [
              ...(x.discuss ? [{ label: "Discuss", hint: plainLite(x.discuss), rows: [] }] : []),
              ...(x.rules ? [{ label: "Rules", hint: plainLite(x.rules), rows: [] }] : []),
              ...x.fields.flatMap((f) => fieldModel(ws, s.id, f, scale)),
            ],
          })),
        ],
        annex: annexOf(s, questions, c).map((q) => ({ step: q.step, label: q.text, key: q.key })),
      };
    }),
  };
}

// ── the summary ───────────────────────────────────────────────────────────

/** One answer of the canvas as the lab's summary lists it. */
export interface CanvasSummaryItem {
  label: string;
  name: string;
  type: "text" | "choice" | "check";
  options?: { id: string; label: string }[];
  /** A check's heading, its ticks listed after it; a choice's heading when it is counted. */
  group?: string;
  /** A choice shown on its own line with the option chosen, not counted with others. */
  each?: true;
}

/** A label as the summary reads it: a printed caption in capitals in sentence case, without the page's markup. */
function readable(s: string | undefined): string {
  const t = plainLite(s ?? "").trim();
  return t && t === t.toUpperCase() && /[A-Z]/.test(t) ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}
const joinPath = (...parts: (string | undefined)[]) => parts.map((x) => (x ?? "").trim()).filter(Boolean).join(" · ");

function summaryItems(ws: string, sheet: string, f: WorkshopCanvasField, ctx: string, scale: readonly { id: string; label: string }[] | undefined): CanvasSummaryItem[] {
  const at = `${sheet}:${f.id}`;
  const k = (ref: string) => canvasKey(ws, `${at}${ref}`);
  // What the answer is called: its field's caption, or the section (or card) it sits in when it has none.
  const label = readable(fieldLabel(f)) ? joinPath(ctx.split(" · ").length > 1 ? ctx : undefined, readable(fieldLabel(f))) : ctx;
  switch (f.type) {
    case "text":
      return f.same ? [] : [{ label, name: k(""), type: "text" }];
    case "choice":
      return [{ label, name: k(""), type: "choice", options: f.options, each: true }];
    case "ticks":
      return f.options.flatMap((o): CanvasSummaryItem[] => [{ label: o.label, name: k(`:${o.id}`), type: "check", group: label }, ...(o.write ? [{ label: joinPath(label, o.label), name: k(`:${o.id}:text`), type: "text" as const }] : [])]);
    case "grid":
      return f.rows.flatMap((r) => {
        const row = joinPath(label, readable(r.label));
        const seen = new Set<string>();
        return f.columns.flatMap((cl): CanvasSummaryItem[] => {
          switch (cl.cell) {
            case "label":
              return [];
            case "tick":
              return [{ label: cl.label, name: k(`:${r.id}:${cl.id}`), type: "check", group: row }];
            case "choice":
              return [{ label: joinPath(row, f.columns.filter((x) => x.cell !== "label").length > 1 ? cl.label : undefined), name: k(`:${r.id}:${cl.id}`), type: "choice", options: [...rowOptions(cl, r)], each: true }];
            case "ticks":
              return (cl.options ?? []).map((o) => ({ label: o.label, name: k(`:${r.id}:${cl.id}:${o.id}`), type: "check" as const, group: joinPath(row, cl.label) }));
            case "option": {
              const g = cl.group ?? cl.id;
              if (seen.has(g)) return [];
              seen.add(g);
              return [{ label: row, name: k(`:${r.id}:${g}`), type: "choice", options: f.columns.filter((x) => x.cell === "option" && (x.group ?? x.id) === g).map((x) => ({ id: x.id, label: x.label })), each: true }];
            }
            default:
              return [{ label: joinPath(row, cl.label), name: k(`:${r.id}:${cl.id}`), type: "text" }];
          }
        });
      });
    case "gap":
      return f.rows.map((r) => ({ label: joinPath(label, r.label), name: k(`:${r.id}`), type: "choice" as const, options: [...gapOptions(f, scale)], each: true as const }));
    case "blanks":
      return f.same ? [] : Array.from({ length: canvasBlanks(f.text) }, (_, i) => ({ label: `${readable(f.label) || blankText(f.text)} (${i + 1})`, name: k(`:${i + 1}`), type: "text" as const }));
    case "note":
    case "table":
      return [];
    case "cards":
      return f.items.flatMap((c) => (c.fields ?? []).flatMap((x) => summaryItems(ws, `${at}:${c.id}`, x, joinPath(ctx, [c.badge, readable(c.title)].filter(Boolean).join(" ")), scale)));
  }
}

/** Every key a canvas keeps, with what the lab's summary calls it: the section (or card), the field, the row and the column. */
export function canvasSummaryItems(ws: string, c: WorkshopCanvas, scale?: readonly { id: string; label: string }[]): { sheet: WorkshopCanvasSheet; items: CanvasSummaryItem[] }[] {
  return c.sheets.map((s) => ({
    sheet: s,
    items: [...headerFields(s).flatMap((f) => summaryItems(ws, s.id, f, "", scale)), ...s.sections.flatMap((x) => x.fields.flatMap((f) => summaryItems(ws, s.id, f, readable(x.title), scale)))],
  }));
}

// ── the form ──────────────────────────────────────────────────────────────

/** A label as printed: in capitals (as the page prints a write-in's caption) small and spaced; otherwise bold. */
const isCaps = (label: string) => label === label.toUpperCase() && /[A-Z]/.test(label) && !label.startsWith("**");
const labHtml = (label: string | undefined, hint?: string, tag = "span") =>
  label ? `<${tag} class="jp-cv-lab${isCaps(label) ? " jp-cv-caps" : ""}">${mdLite(label)}</${tag}>${hint ? `<small class="jp-cv-hint">${mdLite(hint)}</small>` : ""}` : hint ? `<small class="jp-cv-hint">${mdLite(hint)}</small>` : "";

interface Draw {
  ws: string;
  scale: readonly { id: string; label: string }[] | undefined;
  extra: (ref: string) => string;
}

function radio(name: string, value: string, label: string, aria?: string): string {
  return `<label class="jp-cv-opt"><input type="radio" name="${e(name)}" value="${e(value)}" data-jv-store${aria ? ` aria-label="${e(aria)}"` : ""}><span>${mdLite(label)}</span></label>`;
}
function tick(name: string, label: string, aria?: string): string {
  return `<label class="jp-cv-opt"><input type="checkbox" name="${e(name)}" data-jv-check${aria ? ` aria-label="${e(aria)}"` : ""}><span>${mdLite(label)}</span></label>`;
}
function line(d: Draw, name: string, ref: string, aria: string, cls = "jp-cv-line"): string {
  return `<input type="text" class="jp-answer ${cls}" name="${e(name)}" data-jv-text${d.extra(ref)} aria-label="${e(aria)}">`;
}

function gridHtml(d: Draw, at: string, f: Grid): string {
  const k = (ref: string) => canvasKey(d.ws, `${at}${ref}`);
  const rowLabels = f.rowLabels !== false;
  const span = f.columns.length + (rowLabels ? 1 : 0);
  const head =
    f.heads === false
      ? ""
      : `<thead><tr>${rowLabels ? `<th scope="col" class="jp-cv-rh">${e(f.rowHead ?? "")}</th>` : ""}${f.columns.map((c) => `<th scope="col" class="jp-cv-c-${c.cell ?? "text"}${c.width ? ` jp-cv-w-${c.width}` : ""}">${e(c.label)}</th>`).join("")}</tr></thead>`;
  const body = f.rows
    .map((r) => {
      const rl = plainLite(r.label);
      const cells = f.columns
        .map((c) => {
          const name = k(`:${r.id}:${c.id}`);
          const ref = `${at}:${r.id}:${c.id}`;
          const aria = `${rl}: ${c.label}`;
          switch (c.cell) {
            case "label":
              return `<td class="jp-cv-c-label">${mdLite(r.values?.[c.id] ?? "")}</td>`;
            case "tick":
              return `<td class="jp-cv-c-tick"><input type="checkbox" name="${e(name)}" data-jv-check aria-label="${e(aria)}"></td>`;
            case "choice":
              return `<td class="jp-cv-c-choice"><div class="jp-cv-opts" role="radiogroup" aria-label="${e(aria)}">${rowOptions(c, r).map((o) => radio(name, o.id, o.label)).join("")}</div></td>`;
            case "ticks":
              return `<td class="jp-cv-c-ticks"><div class="jp-cv-opts">${(c.options ?? []).map((o) => tick(k(`:${r.id}:${c.id}:${o.id}`), o.label, `${aria}: ${o.label}`)).join("")}</div></td>`;
            case "option":
              return `<td class="jp-cv-c-option"><input type="radio" name="${e(k(`:${r.id}:${c.group ?? c.id}`))}" value="${e(c.id)}" data-jv-store aria-label="${e(aria)}"></td>`;
            default:
              return `<td class="jp-cv-c-text">${line(d, name, ref, aria, "jp-cv-cell")}</td>`;
          }
        })
        .join("");
      return `${groupsOf(r).map((g) => `<tr class="jp-cv-grp"><th colspan="${span}" scope="rowgroup">${mdLite(g)}</th></tr>`).join("")}<tr>${rowLabels ? `<th scope="row">${mdLite(r.label)}${r.hint ? `<small>${mdLite(r.hint)}</small>` : ""}</th>` : ""}${cells}</tr>`;
    })
    .join("");
  return `<div class="jp-cv-field jp-cv-grid" data-jp-cv-field="${e(at)}">${labHtml(f.label, f.hint)}<div class="jp-cv-scroll"><table class="jp-cv-t${f.heads === false ? " jp-cv-t-nohead" : ""}">${head}<tbody>${body}</tbody></table></div></div>`;
}

function fieldHtml(d: Draw, sheet: string, f: WorkshopCanvasField): string {
  const at = `${sheet}:${f.id}`;
  const keys = keyAt(sheet, f);
  const k = (ref: string) => canvasKey(d.ws, `${keys}${ref}`);
  const label = fieldLabel(f);
  switch (f.type) {
    case "text":
      if (f.inline) return `<label class="jp-cv-field jp-cv-text jp-cv-inline" data-jp-cv-field="${e(at)}">${labHtml(label)}${line(d, k(""), keys, plainLite(label))}${f.hint ? `<small class="jp-cv-hint">${mdLite(f.hint)}</small>` : ""}</label>`;
      return `<label class="jp-cv-field jp-cv-text" data-jp-cv-field="${e(at)}">${labHtml(label, f.hint)}<textarea class="jp-answer jp-cv-in" name="${e(k(""))}" rows="${f.lines}" data-jv-text${d.extra(keys)} aria-label="${e(plainLite(label))}"></textarea></label>`;
    case "choice":
      return `<div class="jp-cv-field jp-cv-choice" data-jp-cv-field="${e(at)}">${labHtml(label, f.hint)}<div class="jp-cv-opts" role="radiogroup" aria-label="${e(plainLite(label))}">${f.options.map((o) => radio(k(""), o.id, o.label)).join("")}</div></div>`;
    case "ticks":
      return `<div class="jp-cv-field jp-cv-ticks" data-jp-cv-field="${e(at)}">${labHtml(label, f.hint)}<div class="jp-cv-opts">${f.options
        .map((o) => (o.write ? `<span class="jp-cv-optw">${tick(k(`:${o.id}`), `${o.label}:`)}${line(d, k(`:${o.id}:text`), `${keys}:${o.id}:text`, `${plainLite(label)}: ${o.label}`, "jp-cv-line jp-cv-short")}</span>` : tick(k(`:${o.id}`), o.label)))
        .join("")}</div></div>`;
    case "grid":
      return gridHtml(d, at, f);
    case "gap": {
      const opts = gapOptions(f, d.scale);
      return `<div class="jp-cv-field jp-cv-gap" data-jp-cv-field="${e(at)}">${labHtml(label, f.hint)}<div class="jp-cv-scroll"><table class="jp-cv-t jp-cv-gapt"><thead><tr><th></th>${opts.map((o) => `<th scope="col">${e(o.label)}</th>`).join("")}</tr></thead><tbody>${f.rows
        .map((r) => `<tr><th scope="row">${e(r.label)}${r.hint ? `<small>${e(r.hint)}</small>` : ""}</th>${opts.map((o) => `<td><input type="radio" name="${e(k(`:${r.id}`))}" value="${e(o.id)}" data-jv-store aria-label="${e(`${r.label}: ${o.label}`)}"></td>`).join("")}</tr>`)
        .join("")}</tbody></table></div></div>`;
    }
    case "blanks": {
      const parts = blankParts(f.text);
      const aria = plainLite(label || f.text.replace(/___/g, "…"));
      return `<p class="jp-cv-field jp-cv-blanks" data-jp-cv-field="${e(at)}">${labHtml(label)} ${parts.map((p, i) => `${mdLite(p)}${i < parts.length - 1 ? line(d, k(`:${i + 1}`), `${keys}:${i + 1}`, `${aria} (${i + 1})`, "jp-cv-line jp-cv-blank") : ""}`).join("")}${f.hint ? `<small class="jp-cv-hint">${mdLite(f.hint)}</small>` : ""}</p>`;
    }
    case "note": {
      const tag = f.tone === "discuss" || f.tone === "rules" ? `<b class="jp-cv-tag-${f.tone}">${e(f.label ?? (f.tone === "discuss" ? "Discuss" : "Rules"))}</b> ` : f.label ? `${labHtml(f.label)} ` : "";
      return `<p class="jp-cv-field jp-cv-note jp-cv-note-${f.tone ?? "plain"}">${tag}<span>${mdLite(f.text)}</span></p>`;
    }
    case "table":
      return `<div class="jp-cv-field jp-cv-static">${labHtml(f.label)}<div class="jp-cv-scroll"><table class="jp-cv-t"><thead><tr>${f.heads.map((h) => `<th scope="col">${e(h)}</th>`).join("")}</tr></thead><tbody>${f.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${mdLite(c)}</th>` : `<td>${mdLite(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table></div></div>`;
    case "cards":
      return cardsHtml(d, at, f);
  }
}

function cardsHtml(d: Draw, at: string, f: Extract<WorkshopCanvasField, { type: "cards" }>): string {
  const inner = (c: (typeof f.items)[number]) => (c.fields ?? []).map((x) => fieldHtml(d, `${at}:${c.id}`, x)).join("");
  const words = (c: (typeof f.items)[number]) => `${c.text ? `<p class="jp-cv-card-text">${mdLite(c.text)}</p>` : ""}${c.note ? `<p class="jp-cv-card-note">${mdLite(c.note)}</p>` : ""}`;
  const title = (c: (typeof f.items)[number]) => `${c.badge ? `<span class="jp-cv-badge">${e(c.badge)}</span> ` : ""}<span${isCaps(c.title) ? ' class="jp-cv-caps"' : ""}>${mdLite(c.title)}</span>`;
  const lead = (c: (typeof f.items)[number]) => (c.lead ? `<p class="jp-cv-card-lead">${mdLite(c.lead)}</p>` : "");
  if (f.layout === "rows") {
    const n = f.heads?.length ?? 2;
    const row = (c: (typeof f.items)[number]) => {
      const tone = c.tone ? ` class="jp-cv-tone-${c.tone}"` : "";
      if (n >= 4) return `<tr><th scope="row" class="jp-cv-card-badge">${e(c.badge ?? "")}</th><td class="jp-cv-card-title">${mdLite(c.title)}</td><td>${words(c)}</td><td${tone}>${lead(c)}${inner(c)}</td></tr>`;
      if (n === 3) return `<tr><th scope="row" class="jp-cv-card-title jp-cv-top">${title(c)}</th><td>${words(c)}</td><td${tone}>${lead(c)}${inner(c)}</td></tr>`;
      return `<tr><th scope="row" class="jp-cv-card-title jp-cv-top">${title(c)}${words(c)}</th><td${tone}>${lead(c)}${inner(c)}</td></tr>`;
    };
    return `<div class="jp-cv-field jp-cv-cards jp-cv-cards-rows" data-jp-cv-field="${e(at)}">${labHtml(f.label, f.hint)}<div class="jp-cv-scroll"><table class="jp-cv-t jp-cv-ct">${f.heads ? `<thead><tr>${f.heads.map((h) => `<th scope="col">${e(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>${f.items.map(row).join("")}</tbody></table></div></div>`;
  }
  const cards = f.items.map((c) => `<div class="jp-cv-card${c.tone ? ` jp-cv-tone-${c.tone}` : ""}" data-jp-cv-card="${e(c.id)}"><h5>${title(c)}</h5>${words(c)}${lead(c)}${inner(c)}</div>`);
  return `<div class="jp-cv-field jp-cv-cards jp-cv-cards-cols${f.arrows ? " jp-cv-arrows" : ""}" data-jp-cv-field="${e(at)}" style="--cv-n:${f.items.length}">${labHtml(f.label, f.hint)}<div class="jp-cv-cardrow">${cards.join(f.arrows ? `<span class="jp-cv-arrow" aria-hidden="true">→</span>` : "")}</div></div>`;
}

function sectionHtml(d: Draw, s: WorkshopCanvasSheet, x: WorkshopCanvasSection, moduleLink: (id: string) => string): string {
  const mods = x.module ?? s.modules ?? [];
  const meta = [x.minutes ? `${x.minutes} min` : "", x.note ? mdLite(x.note) : ""].filter(Boolean).join(" · ");
  const head = x.title
    ? `<h4 class="jp-cv-st">${x.number ? `<span class="jp-cv-num">${e(x.number)}</span>` : ""}<span class="jp-cv-stt">${mdLite(x.title)}</span>${meta ? ` <span class="jp-cv-meta">${meta}</span>` : ""}${mods.length ? ` <span class="jp-cv-mods">${mods.map(moduleLink).join("")}</span>` : ""}</h4>`
    : "";
  const tags = `${x.discuss ? `<p class="jp-cv-tag"><b class="jp-cv-tag-discuss">Discuss</b> <span>${mdLite(x.discuss)}</span></p>` : ""}${x.rules ? `<p class="jp-cv-tag"><b class="jp-cv-tag-rules">Rules</b> <span>${mdLite(x.rules)}</span></p>` : ""}`;
  const fields = x.fields.map((f) => fieldHtml(d, s.id, f));
  const lay = x.layout ?? "stack";
  const cls = `jp-cv-sec jp-cv-lay-${lay}${x.tone ? ` jp-cv-tone-${x.tone}` : ""}`;
  const data = ` data-jp-cv-sec="${e(x.id)}" id="canvas-${e(s.id)}-${e(x.id)}"${mods.length ? ` data-jp-cv-modules="${e(mods.join(" "))}"` : ""}`;
  if (lay === "aside") return `<section class="${cls}"${data}><div class="jp-cv-aside">${head}${tags}${fields[0] ?? ""}</div><div class="jp-cv-main">${fields.slice(1).join("")}</div></section>`;
  if (lay === "columns") {
    const split = x.split ?? x.fields.map(() => 1);
    let i = 0;
    const cols = split.map((n) => `<div class="jp-cv-col">${fields.slice(i, (i += n)).join("")}</div>`);
    return `<section class="${cls}"${data} style="--cv-cols:${split.length}">${head}${tags}<div class="jp-cv-body">${cols.join("")}</div></section>`;
  }
  return `<section class="${cls}"${data}>${head}${tags}<div class="jp-cv-body">${fields.join("")}</div></section>`;
}

/**
 * The canvas sheets `ids` (all when absent) as the on-screen form: a card per
 * sheet laid out as its printed page, its sections and fields, then (unless
 * the canvas has none) its annex of journey questions, each with a link to its
 * step. `was` names, per field ref, an earlier key its answer moves from (a
 * journey question's own key, before it named the field). `stepLink` draws a
 * step's chip; `moduleLink` a module's.
 */
export function canvasFormHtml(
  ws: string,
  c: WorkshopCanvas,
  questions: readonly AnnexQuestion[],
  o: {
    ids?: readonly string[];
    scale?: readonly { id: string; label: string }[];
    was?: ReadonlyMap<string, string>;
    stepLink: (q: AnnexQuestion) => string;
    answerBox: (name: string, label: string) => string;
    moduleLink?: (id: string) => string;
  },
): string {
  const sheets = c.sheets.filter((s) => !o.ids || o.ids.includes(s.id));
  const d: Draw = {
    ws,
    scale: o.scale,
    extra: (ref: string) => {
      const w = o.was?.get(ref);
      return w ? ` data-jv-was="${e(w)}"` : "";
    },
  };
  const moduleLink = o.moduleLink ?? ((id: string) => `<span class="jp-mod">${e(id)}</span>`);
  return sheets
    .map((s) => {
      const annex = annexOf(s, questions, c);
      const kicker = s.kicker ?? `${c.title}${s.label ? ` · ${s.label}` : ""}`;
      const header = headerFields(s)
        .map((f) => fieldHtml(d, s.id, f))
        .join("");
      const mast = c.masthead ? `<p class="jp-cv-mast"><b>${e(c.masthead.title)}</b>${c.masthead.subtitle ? `<span>${e(c.masthead.subtitle)}</span>` : ""}</p>` : "";
      return `<article class="jp-cv-sheet jp-cv-${(c.size ?? "A3").toLowerCase()}" id="canvas-${e(s.id)}" data-jp-cv-sheet="${e(s.id)}"${s.modules?.length ? ` data-jp-cv-modules="${e(s.modules.join(" "))}"` : ""}>
<header class="jp-cv-head"><div class="jp-cv-head-l"><span class="jp-cv-kick">${e(kicker)}</span>${s.modules?.length ? ` <span class="jp-cv-mods">${s.modules.map(moduleLink).join("")}</span>` : ""}<h3>${e(s.title)}</h3>${s.intro ? `<p>${mdLite(s.intro)}</p>` : ""}</div>${mast || header ? `<div class="jp-cv-head-r">${mast}${header ? `<div class="jp-cv-hdr">${header}</div>` : ""}</div>` : ""}</header>
<div class="jp-cv-secs">${s.sections.map((x) => sectionHtml(d, s, x, moduleLink)).join("")}</div>
${annex.length ? `<section class="jp-cv-annex"><h4>Annex: the journey’s questions for this sheet</h4><ol>${annex.map((q) => `<li>${o.stepLink(q)}<div><span>${e(q.text)}</span>${o.answerBox(q.key, q.text)}</div></li>`).join("")}</ol></section>` : ""}${s.footer ? `\n<footer class="jp-cv-foot">${mdLite(s.footer)}</footer>` : ""}
</article>`;
    })
    .join("\n");
}

/** Every canvas key, for a check that two fields never share one. */
export function canvasKeys(ws: string, c: WorkshopCanvas): string[] {
  return c.sheets.flatMap((s) => [...headerFields(s), ...s.sections.flatMap((x) => x.fields)].flatMap((f) => canvasFieldRefs(s.id, f).map((r) => canvasKey(ws, r))));
}

/** The sections of the canvas worked in a module, sheet by sheet: a section's own modules, else its sheet's. */
export function canvasPartsOf(c: WorkshopCanvas, module: string): { sheet: WorkshopCanvasSheet; section: WorkshopCanvasSection }[] {
  return c.sheets.flatMap((s) => s.sections.filter((x) => (x.module ?? s.modules ?? []).includes(module)).map((section) => ({ sheet: s, section })));
}
