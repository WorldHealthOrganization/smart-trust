/**
 * One look for every generated figure and table: the ArchiMate layer colours
 * (Archi's defaults, the notation's convention) for every box, and one set of
 * neutral inks, bands, frames and type around them.
 *
 * @module cat-harness/archimate/scripts/figure-theme
 * @covers archimate
 *
 * The colour of a box always says its ArchiMate layer, in every renderer:
 * lilac Motivation, tan Strategy, yellow Business, blue Application, green
 * Technology. Anything else a figure wants to say (who stewards a layer, a
 * starred component, a cross-cutting column) is said by frames, stars,
 * labels and dashes, never by another fill, so a reader never sees lilac mean
 * "Motivation" in one figure and "applications" in the next (owner,
 * 2026-11-01, Q-IV-4 A: "poster style, ArchiMate colours").
 */
import type { ArchimateLayer } from "../schemas/archimate.ts";
import { layerOf } from "../schemas/archimate.ts";

/** Archi's default fill per layer. */
export const LAYER_FILL: Record<ArchimateLayer, string> = {
  Strategy: "#f5deaa",
  Business: "#ffffb5",
  Application: "#b5ffff",
  Technology: "#c9e7b7",
  Physical: "#c9e7b7",
  Motivation: "#ccccff",
  "Implementation & Migration": "#ffe0e0",
  Other: "#ffffff",
};

/** Archi's default outline: the fill, darkened — not black. */
export function outlineOf(fill: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(fill);
  if (!m) return "#555";
  const n = parseInt(m[1]!, 16);
  const d = (c: number) => Math.round(c * 0.55).toString(16).padStart(2, "0");
  return `#${d(n >> 16)}${d((n >> 8) & 255)}${d(n & 255)}`;
}

/** `hex` mixed with white: `f` = 0 is the colour, 1 is white. */
export function tint(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const c = (v: number) => Math.round(v + (255 - v) * f).toString(16).padStart(2, "0");
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** `hex` darkened: `f` = 1 is the colour, 0 is black. */
export function shade(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const c = (v: number) => Math.round(v * f).toString(16).padStart(2, "0");
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** A band of a poster in one layer's hue: a pale ground, and a deep header strip for white type. */
export const bandColours = (fill: string) => ({ ground: tint(fill, 0.4), stroke: shade(fill, 0.62), header: shade(fill, 0.42) });

/** The fill of an element type's box. */
export const fillOfType = (type: string): string => LAYER_FILL[layerOf(type)];

/** The neutral parts: everything that is not a box's layer colour. */
export const THEME = {
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  ink: "#14213d",
  body: "#2d3748",
  muted: "#6b778a",
  page: "#f8f9fb",
  band: "#f3f4f6",
  bandStroke: "#9aa3b2",
  frame: "#14213d",
  header: "#4a5568",
  star: "#c9922e",
  starText: "#a07a2a",
} as const;

/**
 * The handbook look (`theme: "handbook"` in `render-view.ts`): for a figure
 * redrawn from a printed source, it is drawn close to the printed page instead of
 * in layer colours. It has white boxes with teal outlines, pale panels and teal
 * headings, and the title in ink above them. It is the one exception to "a fill
 * says the layer", and it is chosen per figure (owner, 2026-11-01, Q-DTH1-9 B:
 * "handbook look in shared theme"). The key then says shape and nesting, not colour.
 */
export const HANDBOOK = {
  page: "#e9ebee",
  panel: "#f1f7f8",
  box: "#ffffff",
  teal: "#13939f",
  tealText: "#0f7f8a",
  ink: "#1f2d4d",
  muted: "#5b6577",
} as const;

/**
 * The same look for an HTML table: the theme's type and inks, a neutral
 * header, and `.layer-<Layer>` classes that tint a cell naming an ArchiMate
 * type (`layerClass`).
 */
export const TABLE_CSS = `
table.ft{border-collapse:collapse;font:13px/1.45 ${THEME.font};color:${THEME.body}}
table.ft th{background:${THEME.ink};color:#fff;font-weight:600;text-align:left;padding:6px 8px}
table.ft td{border:1px solid #d5dae3;padding:5px 8px;vertical-align:top}
table.ft tr:nth-child(even) td{background:${THEME.page}}
${Object.entries(LAYER_FILL).map(([l, f]) => `table.ft td.layer-${l.replace(/[^A-Za-z]/g, "")}{background:${f};border-color:${outlineOf(f)}}`).join("\n")}
`.trim();

/** The class that tints a table cell naming `type` with its layer colour. */
export const layerClass = (type: string): string => `layer-${layerOf(type).replace(/[^A-Za-z]/g, "")}`;
