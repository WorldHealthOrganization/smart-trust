#!/usr/bin/env bun
/**
 * diig-phases-svg: draw a DIIG "phases, steps and resources" chart from its
 * figure data.
 *
 * The chart first appears as DIIG Fig. 1.1.1 (WHO Digital implementation
 * investment guide, 2020). Each Digital Transformation Handbook then
 * republishes it with its own tiles added and itself marked "(this document)"
 * (the product catalogue handbook's Fig. 4, the HRH handbook's own chart).
 * Each published version is transcribed ONCE, as `diig-phases-figure/v1` data
 * on its who-iris library entry (owner, 2026-10-31: option B, "in who-iris").
 * This script holds no labels of its own: every phase, step and tile comes
 * from that data.
 *
 * A folio that adapts a published version further (dth-hrh adds its own tile)
 * passes an adaptation file instead of copying the data:
 *
 *   {"$schema": "diig-phases-adaptation/v1",
 *    "adapts": "<repository-root path to a diig-phases-figure/v1 file>",
 *    "resources": [ ...tiles' resources to add... ],
 *    "tiles": [ ...layout tiles to add... ],
 *    "thisDocument": { "resource": "...", "style": "dashed", ... }}
 *
 *   bun run folio-assistant-core/scripts/diig-phases-svg.ts <data.json> [--out file.svg]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface Phase { id: string; name: string[]; color: string; tint: string; steps: string[] }
export interface Resource {
  id: string; label: string[]; icons: string[]; smallPrint?: string[]; parts?: string[][];
  link?: { library?: string; glossary?: string; url?: string };
}
export interface Tile { resource: string; columns: [number, number]; rows: [number, number]; outlinePhase: string }
export interface ThisDocument { resource: string; style: "dashed" | "filled"; color: string; fill: string; note?: string }
export interface DiigFigure {
  $schema: "diig-phases-figure/v1";
  figure: { library: string; label: string; caption: string; page: number; file: string };
  legend: Record<string, string>;
  phases: Phase[];
  resources: Resource[];
  layout: { columns: number; rows: number; tiles: Tile[] };
  thisDocument: ThisDocument;
}
export interface Adaptation {
  $schema: "diig-phases-adaptation/v1";
  adapts: string;
  title?: string;
  resources?: Resource[];
  tiles?: Tile[];
  thisDocument: ThisDocument;
}

/** Read a figure file, or an adaptation and the figure it adapts. */
export function loadFigure(path: string): DiigFigure {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (data.$schema === "diig-phases-adaptation/v1") {
    const a = data as Adaptation;
    // `adapts` is a repository-root path, e.g. <layer>/library/<entry>/figure-data/...
    const base = loadFigure(resolve(a.adapts));
    const resources = [...base.resources, ...(a.resources ?? [])];
    const tiles = [...base.layout.tiles, ...(a.tiles ?? [])];
    const columns = Math.max(base.layout.columns, ...tiles.map((t) => t.columns[1] + 1));
    return { ...base, resources, layout: { ...base.layout, columns, tiles }, thisDocument: a.thisDocument };
  }
  if (data.$schema !== "diig-phases-figure/v1") throw new Error(`${path}: not diig-phases-figure/v1 data`);
  return data as DiigFigure;
}

const ROW_H = 74, ROW_GAP = 5, COL_W = 60, COL_GAP = 4, TOP = 8;
const BADGE_W = 42, NAME_X = 44, NAME_W = 92, STEPS_X = 142, STEPS_W = 312, TILE_X0 = 462;
const FONT = "'Open Sans','Segoe UI',Helvetica,Arial,sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rowY = (r: number) => TOP + r * (ROW_H + ROW_GAP);
const colX = (c: number) => TILE_X0 + c * (COL_W + COL_GAP);

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if (cur && cur.length + w.length + 1 > width) { lines.push(cur); cur = w; } else cur = `${cur} ${w}`.trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function icon(kind: string, x: number, y: number, color: string): string {
  if (kind === "d")
    return `<path d="M${x} ${y}h5l3 3v8h-8z" fill="none" stroke="${color}" stroke-width="1"/>` +
      `<path d="M${x + 5} ${y}v3h3" fill="none" stroke="${color}" stroke-width="1"/>`;
  return `<rect x="${x - 1}" y="${y + 1}" width="10" height="7" rx="1" fill="none" stroke="${color}" stroke-width="1"/>` +
    `<path d="M${x + 2} ${y + 10}h4M${x + 4} ${y + 8}v2" stroke="${color}" stroke-width="1"/>`;
}

/** Where a tile's resource links: a library entry page, a glossary IRI, or a URL. */
export function resourceHref(r: Resource, libraryBase: string): string | undefined {
  if (r.link?.url) return r.link.url;
  if (r.link?.glossary) return r.link.glossary;
  if (r.link?.library) return `${libraryBase}${r.link.library}/`;
  return undefined;
}

function tileSvg(t: Tile, r: Resource, color: string, self: ThisDocument | undefined, libraryBase: string): string {
  const x = colX(t.columns[0]), y = rowY(t.rows[0]);
  const w = colX(t.columns[1]) + COL_W - x, h = rowY(t.rows[1]) + ROW_H - y;
  const stroke = self ? self.color : color;
  const out: string[] = [];
  out.push(self
    ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${self.fill}" stroke="${self.color}" stroke-width="2.5"${self.style === "dashed" ? ' stroke-dasharray="5 3"' : ""}/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#FFFFFF" stroke="${color}" stroke-width="1.2"/>`);
  let ix = x + w - 12;
  for (const k of [...r.icons].reverse()) { out.push(icon(k, ix, y + 4, stroke)); ix -= 13; }
  const weight = self ? ' font-weight="700"' : "";
  if (r.parts) {
    out.push(`<text x="${x + w / 2}" y="${y + 16}" font-size="9" text-anchor="middle" fill="#3C3C3C"${weight}>${esc(r.label.join(" "))}</text>`);
    const pw = w / r.parts.length;
    r.parts.forEach((part, p) => part.forEach((line, k) =>
      out.push(`<text x="${x + pw * p + pw / 2}" y="${y + 34 + k * 10.5}" font-size="9" text-anchor="middle" fill="#3C3C3C">${esc(line)}</text>`)));
  } else {
    const small = r.smallPrint ?? [];
    const n = r.label.length + small.length * 0.7 + (self?.note ? 1 : 0);
    const lh = n > 5 || (self && n > 4) ? 9.5 : 11;
    let ty = Math.max(y + h / 2 - (n * lh) / 2 + 8, y + 22);
    r.label.forEach((line, i) =>
      out.push(`<text x="${x + w / 2}" y="${(ty + i * lh).toFixed(1)}" font-size="8.4" text-anchor="middle" fill="#3C3C3C"${weight}>${esc(line)}</text>`));
    ty += r.label.length * lh;
    small.forEach((line, i) =>
      out.push(`<text x="${x + w / 2}" y="${(ty + i * 6.8 - 3).toFixed(1)}" font-size="5.8" text-anchor="middle" fill="#5A5A5A">${esc(line)}</text>`));
    if (self?.note)
      out.push(`<text x="${x + w / 2}" y="${(ty + 1).toFixed(1)}" font-size="7" font-style="italic" text-anchor="middle" fill="${self.color}">${esc(self.note)}</text>`);
  }
  const href = resourceHref(r, libraryBase);
  const body = `<g id="tile-${esc(r.id)}">${out.join("")}</g>`;
  return href ? `<a href="${esc(href)}" target="_top">${body}</a>` : body;
}

export function renderSvg(fig: DiigFigure, opts: { title?: string; libraryBase?: string } = {}): string {
  const libraryBase = opts.libraryBase ?? "https://litlfred.github.io/who-iris/library/";
  const resources = new Map(fig.resources.map((r) => [r.id, r]));
  const phaseColor = new Map(fig.phases.map((p) => [p.id, p.color]));
  const width = colX(fig.layout.columns) + 4;
  const height = rowY(fig.layout.rows) + 4;
  const title = opts.title ?? fig.figure.caption;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc" font-family="${FONT}">`,
    `<title id="title">${esc(title)}</title>`,
    `<desc id="desc">Generated by folio-assistant-core scripts/diig-phases-svg.ts from the figure data of ${esc(fig.figure.label)} on who-iris library entry ${esc(fig.figure.library)}.</desc>`,
    `<rect width="${width}" height="${height}" fill="#FFFFFF"/>`,
  ];
  fig.phases.forEach((ph, i) => {
    const y = rowY(i);
    parts.push(`<rect x="4" y="${y}" width="${BADGE_W + NAME_W - 2}" height="${ROW_H}" rx="4" fill="${ph.color}"/>`);
    parts.push(`<rect x="${BADGE_W + 2}" y="${y + 3}" width="0.8" height="${ROW_H - 6}" fill="#FFFFFF" opacity="0.6"/>`);
    parts.push(`<text x="${4 + BADGE_W / 2}" y="${y + ROW_H / 2 - 10}" font-size="7" text-anchor="middle" fill="#FFFFFF">PHASE</text>`);
    parts.push(`<text x="${4 + BADGE_W / 2}" y="${y + ROW_H / 2 + 14}" font-size="22" text-anchor="middle" fill="#FFFFFF">${esc(ph.id)}</text>`);
    const ny = y + ROW_H / 2 - (ph.name.length * 9.5) / 2 + 7;
    ph.name.forEach((line, k) =>
      parts.push(`<text x="${NAME_X + 4 + NAME_W / 2}" y="${(ny + k * 9.5).toFixed(1)}" font-size="8" font-weight="700" text-anchor="middle" fill="#FFFFFF">${esc(line)}</text>`));
    parts.push(`<rect x="${STEPS_X}" y="${y}" width="${STEPS_W}" height="${ROW_H}" rx="4" fill="${ph.tint}"/>`);
    const lines: [string, boolean][] = [];
    for (const s of ph.steps) {
      const w = wrap(s, 62);
      lines.push([`+ ${w[0]}`, true], ...w.slice(1).map((t): [string, boolean] => [t, false]));
    }
    const sy = y + ROW_H / 2 - (lines.length * 10.5) / 2 + 8;
    lines.forEach(([line, first], k) =>
      parts.push(`<text x="${first ? STEPS_X + 8 : STEPS_X + 16}" y="${(sy + k * 10.5).toFixed(1)}" font-size="8.6" fill="#333333">${esc(line)}</text>`));
  });
  for (const t of fig.layout.tiles) {
    const r = resources.get(t.resource);
    if (!r) throw new Error(`tile names unknown resource ${t.resource}`);
    const color = phaseColor.get(t.outlinePhase);
    if (!color) throw new Error(`tile ${t.resource} names unknown phase ${t.outlinePhase}`);
    parts.push(tileSvg(t, r, color, t.resource === fig.thisDocument.resource ? fig.thisDocument : undefined, libraryBase));
  }
  // Legend, in the empty bottom-right corner.
  const lx = colX(Math.max(fig.layout.columns - 3, 4)) + 8, ly = rowY(fig.layout.rows - 2) + 30;
  parts.push(`<rect x="${lx}" y="${ly}" width="${width - lx - 10}" height="34" rx="5" fill="#EEEEEE" stroke="#777777"/>`);
  Object.entries(fig.legend).forEach(([k, label], i) => {
    parts.push(icon(k, lx + 10, ly + 6 + i * 13, "#555555"));
    parts.push(`<text x="${lx + 26}" y="${ly + 14 + i * 14}" font-size="8.5" fill="#444444">${esc(label)}</text>`);
  });
  parts.push("</svg>");
  return parts.join("\n") + "\n";
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) { console.error("usage: diig-phases-svg.ts <figure-or-adaptation.json> [--out file.svg]"); process.exit(2); }
  const outIdx = args.indexOf("--out");
  const fig = loadFigure(file);
  const adaptation = JSON.parse(readFileSync(file, "utf8"));
  const svg = renderSvg(fig, { title: adaptation.title });
  if (outIdx >= 0) writeFileSync(args[outIdx + 1], svg); else process.stdout.write(svg);
}
