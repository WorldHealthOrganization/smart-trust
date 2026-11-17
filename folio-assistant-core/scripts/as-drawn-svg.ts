#!/usr/bin/env bun
/**
 * as-drawn-svg: draw a figure from its `as-drawn-figure/v1` data
 * (schemas/figure-data.ts), the drawing that scripts/pdf-as-drawn.py
 * transcribed from the source PDF's vector layer. The SVG has the same paths,
 * colours, clips and text at the same places as the PDF. Labels are SVG
 * <text> (searchable, translatable), held to their printed width. A label
 * that names a glossary concept links to it.
 *
 *   bun run folio-assistant-core/scripts/as-drawn-svg.ts <data.json|dir>... --out-dir <dir> [--check]
 *
 * Each data file becomes `<out-dir>/as-drawn-fig-<N>[-<M>].svg`, named after
 * the figure labels it draws. `--check` writes nothing; it fails when a data
 * file is invalid or its SVG is missing or stale.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type AsDrawnFigureData, AsDrawnFigureSchema } from "../schemas/figure-data.ts";

const FONT = "'Source Sans Pro','Source Sans 3','Helvetica Neue',Arial,sans-serif";

const esc = (s: string) =>
  s.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");

const clipped = (el: string, clip?: number[]) => {
  for (const c of [...(clip ?? [])].reverse()) el = `<g clip-path="url(#c${c})">${el}</g>`;
  return el;
};

/** The SVG of one figure, from its data alone. */
export function renderAsDrawn(fig: AsDrawnFigureData): string {
  const { width, height } = fig.canvas;
  const title = fig.figure.caption ?? fig.figure.labels.join(", ");
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="t">`);
  out.push(`<title id="t">${esc(title)}</title>`);
  out.push(`<desc>Redrawn as drawn from ${esc(fig.figure.library)}, PDF page ${fig.figure.page} (${esc(fig.figure.render)}), by folio-assistant-core scripts/as-drawn-svg.ts from its as-drawn-figure/v1 data.</desc>`);
  if (fig.clips.length) {
    out.push(`<defs>`);
    fig.clips.forEach((c, i) =>
      out.push(`<clipPath id="c${i}" clipPathUnits="userSpaceOnUse"><path d="${c.d}"${c.evenodd ? ` clip-rule="evenodd"` : ""}/></clipPath>`));
    out.push(`</defs>`);
  }
  out.push(`<g fill="none" stroke-linecap="butt" stroke-linejoin="miter">`);
  for (const s of fig.shapes) {
    const a = [`d="${s.d}"`, `fill="${s.fill ?? "none"}"`];
    if (s.evenodd) a.push(`fill-rule="evenodd"`);
    if (s.fillOpacity !== undefined) a.push(`fill-opacity="${s.fillOpacity}"`);
    if (s.stroke) {
      a.push(`stroke="${s.stroke}"`, `stroke-width="${s.strokeWidth ?? 1}"`);
      if (s.dash?.length) a.push(`stroke-dasharray="${s.dash.join(" ")}"`);
      if (s.cap) a.push(`stroke-linecap="${s.cap}"`);
      if (s.join) a.push(`stroke-linejoin="${s.join}"`);
      if (s.strokeOpacity !== undefined) a.push(`stroke-opacity="${s.strokeOpacity}"`);
    }
    out.push(clipped(`<path ${a.join(" ")}/>`, s.clip));
  }
  out.push(`</g>`);
  for (const im of fig.images ?? []) {
    out.push(clipped(`<image x="${im.x}" y="${im.y}" width="${im.width}" height="${im.height}" preserveAspectRatio="none" href="data:image/png;base64,${im.png}"/>`, im.clip));
  }
  out.push(`<g font-family="${FONT}" fill="#000000">`);
  for (const t of fig.texts) {
    const a = [`x="${t.x}"`, `y="${t.y}"`, `font-size="${t.size}"`];
    if (t.weight) a.push(`font-weight="${t.weight}"`);
    if (t.italic) a.push(`font-style="italic"`);
    if (t.color) a.push(`fill="${t.color}"`);
    if (t.width) a.push(`textLength="${t.width}"`, `lengthAdjust="spacingAndGlyphs"`);
    if (t.rotate) a.push(`transform="rotate(${t.rotate} ${t.x} ${t.y})"`);
    const el = `<text ${a.join(" ")}>${esc(t.text)}</text>`;
    out.push(clipped(t.link ? `<a href="${esc(t.link)}"><title>${esc(t.link)}</title>${el}</a>` : el, t.clip));
  }
  out.push(`</g>`, `</svg>`);
  return out.join("\n") + "\n";
}

/** `as-drawn-fig-26-27.svg` for a figure that draws Figs 26 and 27. */
export const svgName = (fig: AsDrawnFigureData) =>
  `as-drawn-fig-${fig.figure.labels.map((l) => l.replace("Fig. ", "")).join("-")}.svg`;

function dataFiles(args: string[]): string[] {
  return args.flatMap((a) =>
    statSync(a).isDirectory() ? readdirSync(a).filter((f) => f.endsWith(".json")).sort().map((f) => join(a, f)) : [a]);
}

/** Write or check every figure; returns the number that are invalid or stale. */
export function run(files: string[], outDir: string, check: boolean, log = console): number {
  let bad = 0;
  for (const f of files) {
    const parsed = AsDrawnFigureSchema.safeParse(JSON.parse(readFileSync(f, "utf-8")));
    if (!parsed.success) {
      log.error(`✗ ${f}: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      bad++;
      continue;
    }
    const out = join(outDir, svgName(parsed.data));
    const svg = renderAsDrawn(parsed.data);
    if (check) {
      if (!existsSync(out) || readFileSync(out, "utf-8") !== svg) {
        log.error(`✗ ${out} is out of date: run as-drawn-svg without --check`);
        bad++;
      }
    } else {
      writeFileSync(out, svg);
      log.log(`wrote ${out}`);
    }
  }
  if (check) log.log(bad ? `✗ ${bad} as-drawn figure(s) invalid or stale` : `✓ ${files.length} as-drawn SVG(s) match their data`);
  return bad;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const o = argv.indexOf("--out-dir");
  const outDir = o >= 0 ? argv[o + 1] : undefined;
  const inputs = argv.filter((a, i) => !a.startsWith("--") && (o < 0 || i !== o + 1));
  if (!outDir || inputs.length === 0) {
    console.error("usage: bun run folio-assistant-core/scripts/as-drawn-svg.ts <data.json|dir>... --out-dir <dir> [--check]");
    process.exit(2);
  }
  process.exit(run(dataFiles(inputs), outDir, check) ? 1 : 0);
}
