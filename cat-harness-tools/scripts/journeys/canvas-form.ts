/**
 * The workshop's canvas as an on-screen form, and the model its PDF is
 * written from (owner, 2026-11-17: the canvas is the policy track's primary
 * data collection).
 *
 * @module scripts/journeys/canvas-form
 * @covers workshop
 *
 * The canvas (`workshop.canvas`: a cover and its sheets, each of sections of
 * fields) is drawn in the canvas's own styling, a sheet per card, every field
 * kept in the browser under `<workshop>:cv:<sheet>:<field>[:<row>[:<col>]]`
 * by the same script as every other answer (`present.js`). A journey question
 * that names a field (`questions[].canvas`) is that field, under that key; the
 * sheet's other journey questions, of the modules it names, follow it as its
 * annex. `canvasModel` is the same canvas as JSON, every key with its label,
 * from which `assets/canvas-pdf.js` writes the editable, pre-filled PDF.
 */
import { escHtml } from "../thin-page.ts";
import { canvasFieldRefs, type WorkshopCanvas, type WorkshopCanvasField, type WorkshopCanvasSheet } from "../../schemas/process/workshop.ts";

const e = escHtml;

/** Where a canvas answer is kept (`jv:` + this): `<workshop>:cv:<sheet>:<field>[:<row>[:<col>]]`. */
export function canvasKey(workshop: string, ref: string): string {
  return `${workshop}:cv:${ref}`;
}

/** One answer the PDF writes: a write-in (`text`) or a tick (`tick`, kept as `value` when ticked). */
export interface CanvasModelCell {
  key: string;
  label: string;
  kind: "text" | "tick";
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
  rows: { label?: string; cells: CanvasModelCell[] }[];
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

const gapOptions = (f: Extract<WorkshopCanvasField, { type: "gap" }>, scale: readonly { id: string; label: string }[] | undefined) => f.options ?? scale ?? [];

function fieldModel(ws: string, sheet: string, f: WorkshopCanvasField, scale: readonly { id: string; label: string }[] | undefined): CanvasModelField {
  const k = (ref: string) => canvasKey(ws, `${sheet}:${f.id}${ref}`);
  const base = { label: f.label, ...(f.hint ? { hint: f.hint } : {}) };
  switch (f.type) {
    case "text":
      return { ...base, rows: [{ cells: [{ key: k(""), label: f.label, kind: "text", lines: f.lines }] }] };
    case "choice":
      return { ...base, rows: [{ cells: f.options.map((o) => ({ key: k(""), label: o.label, kind: "tick" as const, value: o.id, radio: true as const })) }] };
    case "ticks":
      return { ...base, rows: [{ cells: f.options.map((o) => ({ key: k(`:${o.id}`), label: o.label, kind: "tick", value: "1" })) }] };
    case "grid":
      return {
        ...base,
        heads: f.columns.map((c) => c.label),
        rows: f.rows.map((r) => ({ label: r.label, cells: f.columns.map((c) => ({ key: k(`:${r.id}:${c.id}`), label: `${r.label}: ${c.label}`, kind: c.cell === "tick" ? "tick" : "text", ...(c.cell === "tick" ? { value: "1" } : { lines: 1 }) })) })),
      };
    case "gap": {
      const opts = gapOptions(f, scale);
      return { ...base, heads: opts.map((o) => o.label), rows: f.rows.map((r) => ({ label: r.label, cells: opts.map((o) => ({ key: k(`:${r.id}`), label: `${r.label}: ${o.label}`, kind: "tick" as const, value: o.id, radio: true as const })) })) };
    }
  }
}

/** The questions a sheet's annex lists: those of its modules that are no field of the canvas. */
export function annexOf(sheet: WorkshopCanvasSheet, questions: readonly AnnexQuestion[]): AnnexQuestion[] {
  const mods = new Set(sheet.modules ?? []);
  return questions.filter((q) => mods.has(q.module) && q.canvas === undefined);
}

/** The canvas as the PDF writer reads it. */
export function canvasModel(ws: string, c: WorkshopCanvas, questions: readonly AnnexQuestion[], scale?: readonly { id: string; label: string }[]): CanvasModel {
  return {
    title: c.title,
    size: c.size ?? "A3",
    workshop: ws,
    sheets: c.sheets.map((s) => ({
      id: s.id,
      ...(s.label ? { label: s.label } : {}),
      title: s.title,
      ...(s.intro ? { intro: s.intro } : {}),
      sections: s.sections.map((x) => ({ ...(x.title ? { title: x.title } : {}), fields: x.fields.map((f) => fieldModel(ws, s.id, f, scale)) })),
      annex: annexOf(s, questions).map((q) => ({ step: q.step, label: q.text, key: q.key })),
    })),
  };
}

/** One answer of the canvas as the lab's summary lists it. */
export interface CanvasSummaryItem {
  label: string;
  name: string;
  type: "text" | "choice" | "check";
  options?: { id: string; label: string }[];
  group?: string;
}

/** Every key a canvas keeps, with what the lab's summary calls it. */
export function canvasSummaryItems(ws: string, c: WorkshopCanvas, scale?: readonly { id: string; label: string }[]): { sheet: WorkshopCanvasSheet; items: CanvasSummaryItem[] }[] {
  return c.sheets.map((s) => ({
    sheet: s,
    items: s.sections.flatMap((x) =>
      x.fields.flatMap((f): CanvasSummaryItem[] => {
        const k = (ref: string) => canvasKey(ws, `${s.id}:${f.id}${ref}`);
        const group = s.label ?? s.title;
        switch (f.type) {
          case "text":
            return [{ label: f.label, name: k(""), type: "text" as const, group }];
          case "choice":
            return [{ label: f.label, name: k(""), type: "choice" as const, options: f.options, group }];
          case "ticks":
            return f.options.map((o) => ({ label: `${f.label}: ${o.label}`, name: k(`:${o.id}`), type: "check" as const, group }));
          case "grid":
            return f.rows.flatMap((r) => f.columns.map((cl) => ({ label: `${f.label} · ${r.label} · ${cl.label}`, name: k(`:${r.id}:${cl.id}`), type: cl.cell === "tick" ? ("check" as const) : ("text" as const), group })));
          case "gap":
            return f.rows.map((r) => ({ label: `${f.label} · ${r.label}`, name: k(`:${r.id}`), type: "choice" as const, options: [...gapOptions(f, scale)], group }));
        }
      }),
    ),
  }));
}

function fieldHtml(ws: string, sheet: string, f: WorkshopCanvasField, scale: readonly { id: string; label: string }[] | undefined, extra: (ref: string) => string): string {
  const k = (ref: string) => canvasKey(ws, `${sheet}:${f.id}${ref}`);
  const head = `<div class="jp-cv-fh"><b>${e(f.label)}</b>${f.hint ? `<small>${e(f.hint)}</small>` : ""}</div>`;
  const radios = (name: string, opts: readonly { id: string; label: string }[], label: string) =>
    `<div class="jp-cv-opts" role="radiogroup" aria-label="${e(label)}">${opts.map((o) => `<label class="jp-cv-opt"><input type="radio" name="${e(name)}" value="${e(o.id)}" data-jv-store><span>${e(o.label)}</span></label>`).join("")}</div>`;
  switch (f.type) {
    case "text":
      return `<div class="jp-cv-field jp-cv-text" data-jp-cv-field="${e(`${sheet}:${f.id}`)}"><label>${head}<textarea class="jp-answer jp-cv-in" name="${e(k(""))}" rows="${f.lines}" data-jv-text${extra(`${sheet}:${f.id}`)} aria-label="${e(f.label)}"></textarea></label></div>`;
    case "choice":
      return `<div class="jp-cv-field jp-cv-choice" data-jp-cv-field="${e(`${sheet}:${f.id}`)}">${head}${radios(k(""), f.options, f.label)}</div>`;
    case "ticks":
      return `<div class="jp-cv-field jp-cv-ticks" data-jp-cv-field="${e(`${sheet}:${f.id}`)}">${head}<div class="jp-cv-opts">${f.options.map((o) => `<label class="jp-cv-opt"><input type="checkbox" name="${e(k(`:${o.id}`))}" data-jv-check><span>${e(o.label)}</span></label>`).join("")}</div></div>`;
    case "grid":
      return `<div class="jp-cv-field jp-cv-grid" data-jp-cv-field="${e(`${sheet}:${f.id}`)}">${head}<div class="jp-cv-scroll"><table class="jp-cv-t"><thead><tr><th></th>${f.columns.map((c) => `<th scope="col">${e(c.label)}</th>`).join("")}</tr></thead><tbody>${f.rows
        .map(
          (r) =>
            `<tr><th scope="row">${e(r.label)}${r.hint ? `<small>${e(r.hint)}</small>` : ""}</th>${f.columns
              .map((c) => {
                const name = k(`:${r.id}:${c.id}`);
                const label = `${r.label}: ${c.label}`;
                return `<td>${c.cell === "tick" ? `<input type="checkbox" name="${e(name)}" data-jv-check aria-label="${e(label)}">` : `<textarea class="jp-answer jp-cv-in" name="${e(name)}" rows="1" data-jv-text${extra(`${sheet}:${f.id}:${r.id}:${c.id}`)} aria-label="${e(label)}"></textarea>`}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("")}</tbody></table></div></div>`;
    case "gap": {
      const opts = gapOptions(f, scale);
      return `<div class="jp-cv-field jp-cv-gap" data-jp-cv-field="${e(`${sheet}:${f.id}`)}">${head}<div class="jp-cv-scroll"><table class="jp-cv-t jp-cv-gapt"><thead><tr><th></th>${opts.map((o) => `<th scope="col">${e(o.label)}</th>`).join("")}</tr></thead><tbody>${f.rows
        .map((r) => {
          const name = k(`:${r.id}`);
          return `<tr><th scope="row">${e(r.label)}${r.hint ? `<small>${e(r.hint)}</small>` : ""}</th>${opts.map((o) => `<td><input type="radio" name="${e(name)}" value="${e(o.id)}" data-jv-store aria-label="${e(`${r.label}: ${o.label}`)}"></td>`).join("")}</tr>`;
        })
        .join("")}</tbody></table></div></div>`;
    }
  }
}

/**
 * The canvas sheets `ids` (all when absent) as the on-screen form: a card per
 * sheet in the canvas's styling, its sections and fields, then its annex of
 * journey questions, each with a link to its step. `was` names, per field
 * ref, an earlier key its answer moves from (a journey question's own key,
 * before it named the field). `stepLink` draws a step's chip.
 */
export function canvasFormHtml(
  ws: string,
  c: WorkshopCanvas,
  questions: readonly AnnexQuestion[],
  o: { ids?: readonly string[]; scale?: readonly { id: string; label: string }[]; was?: ReadonlyMap<string, string>; stepLink: (q: AnnexQuestion) => string; answerBox: (name: string, label: string) => string },
): string {
  const sheets = c.sheets.filter((s) => !o.ids || o.ids.includes(s.id));
  const extra = (ref: string) => {
    const w = o.was?.get(ref);
    return w ? ` data-jv-was="${e(w)}"` : "";
  };
  return sheets
    .map((s) => {
      const annex = annexOf(s, questions);
      return `<article class="jp-cv-sheet jp-cv-${(c.size ?? "A3").toLowerCase()}" id="canvas-${e(s.id)}" data-jp-cv-sheet="${e(s.id)}">
<header class="jp-cv-head"><span class="jp-cv-kick">${e(c.title)}${s.label ? ` · ${e(s.label)}` : ""}</span><h3>${e(s.title)}</h3>${s.intro ? `<p>${e(s.intro)}</p>` : ""}</header>
<div class="jp-cv-secs">${s.sections
        .map((x) => `<section class="jp-cv-sec" data-jp-cv-sec="${e(x.id)}">${x.title ? `<h4>${e(x.title)}</h4>` : ""}${x.fields.map((f) => fieldHtml(ws, s.id, f, o.scale, extra)).join("")}</section>`)
        .join("")}</div>
${annex.length ? `<section class="jp-cv-annex"><h4>Annex: the journey’s questions for this sheet</h4><ol>${annex.map((q) => `<li>${o.stepLink(q)}<div><span>${e(q.text)}</span>${o.answerBox(q.key, q.text)}</div></li>`).join("")}</ol></section>` : ""}
</article>`;
    })
    .join("\n");
}

/** Every canvas key, for a check that two fields never share one. */
export function canvasKeys(ws: string, c: WorkshopCanvas): string[] {
  return c.sheets.flatMap((s) => s.sections.flatMap((x) => x.fields.flatMap((f) => canvasFieldRefs(s.id, f).map((r) => canvasKey(ws, r)))));
}
