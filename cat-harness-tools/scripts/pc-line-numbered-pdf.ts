#!/usr/bin/env bun
/**
 * Print a document page as a line-numbered PDF for a public comment release,
 * and write the map from each block to its lines and pages.
 *
 * ```sh
 * bun run cat-harness-tools/scripts/pc-line-numbered-pdf.ts \
 *   --html _site/en/my-doc/index.hydrated.html --out PC/v0.9/my-doc.pdf \
 *   [--root main] [--title "Draft for Public Comment v0.9"] [--map PC/v0.9/line-map.json]
 * ```
 *
 * A public comment draft is cited as "page 22, lines 618-624", and the comment
 * sheet, the form and the triage all key on those numbers, so they must be
 * the same for every reader.
 *
 * ## How
 *
 * The page is laid out in Chromium at the PDF's own content width, with print
 * styles on. Each line start of the document's text is found from the layout
 * (a text range's rectangle moves down), and the line's first letter is
 * wrapped in a marker that draws its number in the left gutter. The marker
 * moves with its line across page breaks, and a single-letter inline adds no
 * break opportunity, so the line breaks do not change.
 *
 * Numbering runs through the whole document (Word's "continuous"). Tables,
 * figures and code are not numbered: a comment on one cites its number and
 * page.
 *
 * After printing, `pdftotext -layout` reads the PDF back, and every number
 * must be found, in order, at the start of a line. A miss fails the run, so a
 * PDF whose numbers drifted is never released.
 *
 * Output `pc-line-map/v1`:
 * `{ lines, pages, blocks: { "<anchor>": { lineStart, lineEnd, page, pageEnd } } }`
 *
 * @module scripts/pc-line-numbered-pdf
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveChromium } from "./playwright-chromium.ts";

/**
 * A4. The numbers sit in a gutter INSIDE the page's content box, because
 * Chromium clips anything drawn into the page margin.
 */
export const PAGE = { format: "A4", widthMm: 210, marginMm: { top: 20, bottom: 20, left: 13, right: 18 }, gutterMm: 12 } as const;

/** Elements whose lines are numbered. Anything inside an excluded element is not. */
/** How much narrower the measuring layout is than the printed one. */
export const SLACK_PX = 8;

export const NUMBERED = "p, li, h1, h2, h3, h4, h5, h6, dd, dt, blockquote, figcaption";
export const EXCLUDED = "table, figure, pre, svg, .pc-no-lines";

export interface BlockLines { lineStart: number; lineEnd: number; page?: number; pageEnd?: number }
export interface LineMap {
  $schema: "pc-line-map/v1";
  source: string;
  pdf: { file: string; sha256: string; pages: number };
  lines: number;
  blocks: Record<string, BlockLines>;
}

/** Site controls that are not part of the document and never print. */
export const STRIPPED = "script, style, link, nav, header, footer, button, .block-actions, .anchor-heading, .pc-no-print, [aria-hidden=true]";

/**
 * The print stylesheet. The site's own styles are dropped, so the PDF looks
 * the same whichever theme the site had, and the gutter numbers are drawn.
 */
export function printCss(title: string): string {
  const m = PAGE.marginMm;
  const esc = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `
@page { size: ${PAGE.format}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
  @top-center { content: "${esc}"; font: 8pt sans-serif; color: #555; }
  @bottom-center { content: "Page " counter(page) " of " counter(pages); font: 8pt sans-serif; color: #555; } }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font: 10.5pt/1.45 "Liberation Serif", "Times New Roman", serif; }
.pc-print-root { position: relative; display: block; margin: 0; padding: 0 0 0 ${PAGE.gutterMm}mm; box-sizing: border-box; }
.pc-print-root * { position: static !important; }
h1 { font-size: 18pt; } h2 { font-size: 15pt; } h3 { font-size: 13pt; } h4, h5, h6 { font-size: 11pt; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; break-after: avoid; font-family: "Liberation Sans", Arial, sans-serif; }
a { color: inherit; text-decoration: none; }
img, svg { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 0.6em 0; }
th, td { border: 0.5pt solid #999; padding: 2pt 4pt; vertical-align: top; text-align: left; }
pre, code { font-family: "Liberation Mono", monospace; font-size: 9pt; }
.pc-ln::before { content: attr(data-n); position: absolute; left: 0; width: ${PAGE.gutterMm - 3}mm; text-align: right;
  font: inherit; font-weight: 400; font-style: normal; color: #777; white-space: nowrap; }
`;
}

/**
 * In the page: number every line. Runs in the browser, so it must be
 * self-contained. Returns the per-block line ranges.
 */
function numberLines(args: { numbered: string; excluded: string }): { lines: number; blocks: Record<string, [number, number]> } {
  const root = document.querySelector(".pc-print-root") as HTMLElement;
  const els = Array.from(root.querySelectorAll<HTMLElement>(args.numbered)).filter(
    (el) => !el.closest(args.excluded) && !el.parentElement?.closest(args.numbered),
  );
  // Collect line starts first, then insert, so the measuring sees no markers.
  type Start = { node: Text; offset: number; el: HTMLElement };
  const starts: Start[] = [];
  const range = document.createRange();
  for (const el of els) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest(args.excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let lastBottom = -Infinity;
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const t = n.data;
      for (let i = 0; i < t.length; i++) {
        // A line starts at a word, so only each word's first letter is measured.
        if (/\s/.test(t[i]!) || (i > 0 && !/\s/.test(t[i - 1]!))) continue;
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        const r = range.getClientRects()[0];
        if (!r || r.height === 0) continue;
        if (r.top >= lastBottom - 1) {
          starts.push({ node: n, offset: i, el });
          lastBottom = r.bottom;
        }
      }
    }
  }
  // Insert from the end so earlier offsets stay valid. The marker wraps the
  // line's first letter: an empty marker before the word would sit at the end
  // of the line above, and a letter in its own inline adds no break.
  const blocks: Record<string, [number, number]> = {};
  for (let k = starts.length - 1; k >= 0; k--) {
    const s = starts[k]!;
    const letter = s.node.splitText(s.offset);
    letter.splitText(1);
    const mark = document.createElement("span");
    mark.className = "pc-ln";
    mark.dataset.n = String(k + 1);
    letter.parentNode!.insertBefore(mark, letter);
    mark.appendChild(letter);
    // Hold the break: the print layout may wrap a word differently from this
    // one, and a forced break keeps every line as measured.
    if (k > 0 && starts[k - 1]!.el === s.el) mark.parentNode!.insertBefore(document.createElement("br"), mark);
  }
  // Block ranges: the nearest element with an id that holds the line.
  starts.forEach((s, k) => {
    const holder = s.el.closest("[id]") ?? s.el.querySelector("[id]");
    const id = holder?.id;
    if (!id) return;
    const b = blocks[id];
    if (b) b[1] = k + 1;
    else blocks[id] = [k + 1, k + 1];
  });
  return { lines: starts.length, blocks };
}

/**
 * The page of each line number, read from `pdftotext -layout`. A number is
 * found at the start of a row, in order. One that is not found is reported,
 * and the search goes on from the next, so one miss does not hide the rest.
 */
export function pagesOfLines(pdfText: string, lines: number): { pageOf: number[]; pages: number; missing: number[] } {
  const pages = pdfText.split("\f");
  const pageOf: number[] = new Array(lines + 1).fill(0);
  let want = 1;
  pages.forEach((txt, p) => {
    for (const row of txt.split("\n")) {
      const m = /^\s*(\d+)(?!\d)/.exec(row);
      if (!m) continue;
      const n = Number(m[1]);
      // A number up to a few past the one wanted is a line whose predecessor
      // was not read; anything else is the document's own text.
      if (n >= want && n <= want + 3) {
        pageOf[n] = p + 1;
        want = n + 1;
      }
    }
  });
  const missing: number[] = [];
  for (let n = 1; n <= lines; n++) if (!pageOf[n]) missing.push(n);
  return { pageOf, pages: pages.filter((t) => t.trim()).length, missing };
}

export async function render(o: { html: string; out: string; root: string; title: string; map?: string }): Promise<LineMap> {
  const { chromium } = await import("playwright");
  const choice = resolveChromium(process.env);
  const browser = await chromium.launch({ ...(choice.path ? { executablePath: choice.path } : {}), args: ["--no-sandbox"] });
  try {
    const mmToPx = 96 / 25.4;
    const contentPx = Math.floor((PAGE.widthMm - PAGE.marginMm.left - PAGE.marginMm.right) * mmToPx);
    // Measured a little narrower than the page, so that no measured line is
    // too long for the printed one; the forced breaks keep the rest.
    const page = await browser.newPage({ viewport: { width: contentPx - SLACK_PX, height: 1200 } });
    await page.goto(pathToFileURL(resolve(o.html)).href, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    // Read the hydrated page: the shell of a large document fills its blocks
    // lazily. Keep only the document root, without the site's controls and
    // styles; the base URL stays, so images still load.
    const found = await page.evaluate((a: { sel: string; stripped: string }) => {
      const el = document.querySelector(a.sel);
      if (!el) return false;
      // What the site's own styles hide (a glossary's data, a collapsed
      // panel) is not part of the read document either.
      const hidden = Array.from(el.querySelectorAll("*")).filter((n) => getComputedStyle(n).display === "none");
      hidden.forEach((n) => n.remove());
      el.querySelectorAll(a.stripped).forEach((n) => n.remove());
      el.classList.add("pc-print-root");
      document.head.querySelectorAll("style, link[rel=stylesheet], script").forEach((n) => n.remove());
      document.body.replaceChildren(el);
      document.body.removeAttribute("class");
      return true;
    }, { sel: o.root, stripped: STRIPPED });
    if (!found) throw new Error(`${o.html}: no element matches --root ${o.root}`);
    await page.addStyleTag({ content: printCss(o.title) });
    await page.evaluate(() => document.fonts.ready);
    // A figure that did not load would print as a broken icon in a draft the
    // public cites. Load every image now, and refuse the PDF if any failed.
    const broken = await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      imgs.forEach((i) => (i.loading = "eager"));
      await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
      return imgs.filter((i) => i.naturalWidth === 0).map((i) => i.getAttribute("src") ?? "(no src)");
    });
    if (broken.length) throw new Error(`${broken.length} image(s) did not load (first: ${broken.slice(0, 5).join(", ")}); not releasing a PDF with broken figures`);
    const got = await page.evaluate(numberLines, { numbered: NUMBERED, excluded: EXCLUDED });
    mkdirSync(dirname(resolve(o.out)), { recursive: true });
    await page.pdf({
      path: o.out,
      format: PAGE.format,
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
    });

    const txt = spawnSync("pdftotext", ["-layout", o.out, "-"], { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
    if (txt.status !== 0) throw new Error(`pdftotext failed: ${txt.stderr || txt.error}`);
    const read = pagesOfLines(txt.stdout, got.lines);
    if (read.missing.length) {
      throw new Error(`${read.missing.length} of ${got.lines} line numbers were not read back from the PDF (first: ${read.missing.slice(0, 5).join(", ")}); not releasing it`);
    }
    const blocks: Record<string, BlockLines> = {};
    for (const [id, [a, b]] of Object.entries(got.blocks)) {
      const page0 = read.pageOf[a]!;
      const page1 = read.pageOf[b]!;
      blocks[id] = { lineStart: a, lineEnd: b, page: page0, ...(page1 !== page0 ? { pageEnd: page1 } : {}) };
    }
    const map: LineMap = {
      $schema: "pc-line-map/v1",
      source: o.html,
      pdf: { file: o.out, sha256: createHash("sha256").update(readFileSync(o.out)).digest("hex"), pages: read.pages },
      lines: got.lines,
      blocks,
    };
    if (o.map) writeFileSync(o.map, JSON.stringify(map, null, 2) + "\n");
    return map;
  } finally {
    await browser.close();
  }
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const html = arg(argv, "html");
  const out = arg(argv, "out");
  if (!html || !out) {
    console.error("usage: pc-line-numbered-pdf.ts --html <page.html> --out <file.pdf> [--root main] [--title <text>] [--map <line-map.json>]");
    process.exit(64);
  }
  const map = await render({ html, out, root: arg(argv, "root") ?? "main", title: arg(argv, "title") ?? "Draft for Public Comment", ...(arg(argv, "map") ? { map: arg(argv, "map")! } : {}) });
  console.log(`✓ ${out}: ${map.pdf.pages} pages, ${map.lines} numbered lines, ${Object.keys(map.blocks).length} blocks mapped`);
}
