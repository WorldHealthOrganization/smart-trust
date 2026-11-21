#!/usr/bin/env bun
/**
 * Draw the WHO SMART Guidelines approach chart (L1–L5 knowledge layers and
 * their country adaptations) as an SVG, from `smart-guidelines-approach-figure/v1`
 * data held on a who-iris library entry's `figure-data/`.
 *
 * Like `diig-phases-svg.ts`, the script holds no labels: every band, row,
 * layer name, description and product comes from the data, so the chart has
 * one source and each handbook that reprints it points at the same file.
 *
 *   bun run folio-assistant-core/scripts/smart-approach-svg.ts <data.json> [--out file.svg]
 */
import { readFileSync, writeFileSync } from "node:fs";

export interface Cell { name: string; text: string; product?: string }
export interface Layer { level: number; knowledge: Cell; country: Cell }
export interface Band { id: string; label: string }
export interface Row { id: "knowledge" | "country"; label: string[]; from: string; to: string; chained: boolean }
export interface SmartApproachFigure {
  $schema: "smart-guidelines-approach-figure/v1";
  figure: { library: string; label: string; caption: string; page: number; file: string };
  link?: { glossary?: string; library?: string; url?: string };
  style: { band: string; panel: string; card: string; ink: string; arrow: string; loop: string };
  loop: string;
  bands: Band[];
  rows: Row[];
  layers: Layer[];
}

export function loadFigure(path: string): SmartApproachFigure {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (data.$schema !== "smart-guidelines-approach-figure/v1") {
    throw new Error(`${path}: not smart-guidelines-approach-figure/v1 data`);
  }
  const fig = data as SmartApproachFigure;
  const bandIds = new Set(fig.bands.map((b) => b.id));
  for (const r of fig.rows) {
    for (const b of [r.from, r.to]) if (!bandIds.has(b)) throw new Error(`row ${r.id}: unknown band ${b}`);
  }
  if (fig.rows.length !== 2 || fig.bands.length !== 3) throw new Error("expected 3 bands and 2 rows");
  return fig;
}

const FONT = "'Source Sans Pro','Open Sans','Segoe UI',Helvetica,Arial,sans-serif";
const W = 931, LOOP_X = 16, PANEL_X = 64, BAND_X = 116, BAND_W = 786, BAND_H = 28;
const CARD_X0 = 116, CARD_W = 144, CARD_GAP = 17, PAD = 11;
const FS = 12, LH = 15.5, CHAR_W = 6.4;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word wrap to the card's inner width. */
export function wrap(text: string, width = CARD_W - 2 * PAD): string[] {
  const max = Math.floor(width / CHAR_W);
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function bodyLines(c: Cell): string[] {
  const body = wrap(c.product ? `${c.text}:` : c.text);
  if (c.product) body.push(...wrap(c.product));
  return body;
}

const cardHeight = (cells: Cell[]) => 36 + Math.max(...cells.map((c) => bodyLines(c).length)) * LH;

function cell(x: number, y: number, h: number, level: number, c: Cell, fig: SmartApproachFigure): string {
  const { ink, card } = fig.style;
  const body = bodyLines(c);
  const lines = body.map((l, i) =>
    `<text x="${x + PAD}" y="${y + 36 + i * LH}">${esc(l)}</text>`).join("");
  return `<g id="cell-l${level}-${c.name.toLowerCase().replace(/\W+/g, "-")}">`
    + `<rect x="${x}" y="${y}" width="${CARD_W}" height="${h}" fill="${card}"/>`
    + `<text x="${x + PAD}" y="${y + 20}" font-weight="700">L${level}: ${esc(c.name)}</text>`
    + `<g fill="${ink}">${lines}</g></g>`;
}

function arrowDown(x: number, y0: number, y1: number, color: string): string {
  return `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1 - 6}" stroke="${color}" stroke-width="1"/>`
    + `<path d="M${x - 3.5} ${y1 - 7}L${x} ${y1}L${x + 3.5} ${y1 - 7}Z" fill="${color}"/>`;
}

function arrowRight(x0: number, x1: number, y: number, color: string): string {
  return `<line x1="${x0}" y1="${y}" x2="${x1 - 6}" y2="${y}" stroke="${color}" stroke-width="1"/>`
    + `<path d="M${x1 - 7} ${y - 3.5}L${x1} ${y}L${x1 - 7} ${y + 3.5}Z" fill="${color}"/>`;
}

export function renderSvg(fig: SmartApproachFigure, opts: { title?: string } = {}): string {
  const { band, panel, ink, arrow, loop } = fig.style;
  const [top, mid, bottom] = fig.bands;
  const hK = cardHeight(fig.layers.map((l) => l.knowledge));
  const hC = cardHeight(fig.layers.map((l) => l.country));
  const yTop = 29;
  const cardK = yTop + BAND_H + 25;
  const panel1 = cardK + hK + 26;
  const yMid = panel1 + 30;
  const panel2 = yMid + BAND_H + 26;
  const cardC = panel2 + 30;
  const yBot = cardC + hC + 25;
  const H = yBot + BAND_H + 22;
  const bandY: Record<string, number> = { [top.id]: yTop, [mid.id]: yMid, [bottom.id]: yBot };
  const rowCardY = { knowledge: cardK, country: cardC };
  const rowH = { knowledge: hK, country: hC };
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}" font-size="${FS}" role="img" aria-labelledby="t">`);
  out.push(`<title id="t">${esc(opts.title ?? fig.figure.caption)}</title>`);
  // The two panels behind the rows.
  out.push(`<rect x="${PANEL_X}" y="0" width="${W - PANEL_X}" height="${panel1}" fill="${panel}"/>`);
  out.push(`<rect x="${PANEL_X}" y="${panel2}" width="${W - PANEL_X}" height="${H - panel2}" fill="${panel}"/>`);
  // The feedback loop: from the bottom band back up to the top one.
  const lx = LOOP_X + 12;
  out.push(`<path d="M${BAND_X} ${yBot + BAND_H / 2}H${lx + 12}Q${lx - 12} ${yBot + BAND_H / 2} ${lx - 12} ${yBot - 10}V${yTop + 30}Q${lx - 12} ${yTop + BAND_H / 2} ${lx + 12} ${yTop + BAND_H / 2}H${BAND_X - 7}" fill="none" stroke="${arrow}" stroke-width="1"/>`);
  out.push(`<path d="M${BAND_X - 8} ${yTop + BAND_H / 2 - 3.5}L${BAND_X - 1} ${yTop + BAND_H / 2}L${BAND_X - 8} ${yTop + BAND_H / 2 + 3.5}Z" fill="${arrow}"/>`);
  const loopY0 = yTop + 100, loopY1 = yBot - 80;
  out.push(`<rect x="${LOOP_X - 13}" y="${loopY0}" width="26" height="${loopY1 - loopY0}" rx="13" fill="${loop}"/>`);
  out.push(`<text transform="translate(${LOOP_X + 5} ${(loopY0 + loopY1) / 2}) rotate(-90)" text-anchor="middle" fill="#FFFFFF" font-weight="700" font-size="13" letter-spacing="0.3">${esc(fig.loop.toUpperCase())}</text>`);
  // Bands.
  for (const b of fig.bands) {
    const y = bandY[b.id];
    out.push(`<g id="band-${b.id}"><rect x="${BAND_X}" y="${y}" width="${BAND_W}" height="${BAND_H}" rx="${BAND_H / 2}" fill="${band}"/>`
      + `<text x="${BAND_X + BAND_W / 2}" y="${y + 19}" text-anchor="middle" fill="#FFFFFF" font-weight="700" font-size="13.5">${esc(b.label.toUpperCase())}</text></g>`);
  }
  // Rows of cards, with the arrows that join them to the bands.
  for (const r of fig.rows) {
    const cy = rowCardY[r.id];
    const h = rowH[r.id];
    const ly = cy + h / 2;
    out.push(`<text transform="translate(${PANEL_X + 22} ${ly}) rotate(-90)" text-anchor="middle" fill="${ink}" font-weight="700" font-size="11">`
      + r.label.map((l, i) => `<tspan x="0" dy="${i === 0 ? -(r.label.length - 1) * 6.5 : 13}">${esc(l)}</tspan>`).join("") + `</text>`);
    fig.layers.forEach((layer, i) => {
      const x = CARD_X0 + i * (CARD_W + CARD_GAP);
      const cx = x + 72;
      out.push(arrowDown(cx, bandY[r.from] + BAND_H, cy, arrow));
      out.push(`<line x1="${cx}" y1="${cy + h}" x2="${cx}" y2="${bandY[r.to]}" stroke="${arrow}" stroke-width="1"/>`);
      if (r.id === "country") out.push(arrowDown(cx, cy + h, bandY[r.to], arrow));
      out.push(cell(x, cy, h, layer.level, layer[r.id], fig));
      if (r.chained && i + 1 < fig.layers.length) out.push(arrowRight(x + CARD_W + 2, x + CARD_W + CARD_GAP - 2, cy + h / 2, arrow));
    });
    if (r.id === "knowledge") {
      // The knowledge row's lines run on through the localisation band.
      fig.layers.forEach((_, i) => {
        const cx = CARD_X0 + i * (CARD_W + CARD_GAP) + 72;
        out.push(arrowDown(cx, yMid + BAND_H, rowCardY.country, arrow));
      });
    }
  }
  out.push(`</svg>`);
  return out.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const outIdx = args.indexOf("--out");
  if (!file) { console.error("usage: smart-approach-svg.ts <figure.json> [--out file.svg]"); process.exit(2); }
  const svg = renderSvg(loadFigure(file));
  if (outIdx >= 0) writeFileSync(args[outIdx + 1], svg + "\n"); else process.stdout.write(svg + "\n");
}
