#!/usr/bin/env bun
/**
 * Draw a BPMN 2.0 diagram as a standalone SVG, and write that SVG beside its
 * `.bpmn` for every Process a content graph declares.
 *
 * @module bootstrap-tools/scripts/render-bpmn
 * @covers code
 *
 * The `.bpmn` is the source of truth — plain BPMN 2.0 with diagram
 * interchange, so it opens in bpmn.io, Camunda Modeler or any BPMN tool. A
 * README on GitHub cannot draw BPMN, so the picture beside it is generated.
 *
 * ## Why this lives in bootstrap-tools, and what stays in the harness
 *
 * One copy of the writers, in the tools repository. What is
 * here is the DRAWING — bpmn-js in a headless Chromium, made byte-stable and
 * responsive — and the copy beside the source, whose call activities link
 * only to diagrams in the same directory, since a content graph's pictures
 * must not name anything outside it. A harness that also publishes a site
 * (with its own `render:bpmn`) calls {@link openRenderer} and
 * {@link drawing} for its own copies, with links into its own pages.
 *
 * ## Deterministic by construction
 *
 * bpmn-js mints a fresh random id for every arrowhead marker on each render,
 * so two renders of one source differ byte-for-byte; {@link drawing}
 * renumbers them in order of first appearance, or `--check` would call every
 * diagram stale.
 *
 * Usage: `bun run bootstrap-tools/scripts/render-bpmn.ts [--repo <dir>] [--check]`
 * — the graphs these tools `support`, each `.bpmn` in a `processes` subgraph.
 */
import { generatedNote } from "./generated-by.ts";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { chromium, type Page } from "@playwright/test";

import { knowledgeGraphsIn, readKnowledgeGraphDeclaration, supportsContent } from "../schemas/declaration.ts";
import { tidyDrawing, type TidyStyle } from "./bpmn-tidy.ts";

/** Where bpmn-js's browser bundle sits under a checkout's `node_modules/`. */
export const VIEWER_BUNDLE = "node_modules/bpmn-js/dist/bpmn-viewer.production.min.js";

/**
 * Chromium's location, when the bundled download is not what is installed:
 * a sandbox may ship a build number the installed Playwright does not expect,
 * with re-downloading blocked.
 */
export function chromiumExecutable(): string | undefined {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !existsSync(base)) return undefined;
  for (const dir of readdirSync(base).sort().reverse()) {
    for (const rel of ["chrome-linux/chrome", "chrome-linux/headless_shell", "chrome-linux64/chrome"]) {
      const p = join(base, dir, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

/**
 * The text size every diagram is drawn at, in diagram units (owner,
 * 2026-10-31, on the content-change-review page: *"make the font a bit bigger,
 * the spacing a bit more compact so dont need to zoom as much"*).
 *
 * bpmn-js draws 12px by default. A diagram the page shrinks to fit shrinks
 * that too, so a 2600-wide pool in a 1200px band showed its labels at about
 * 5.5px. 16px inside shapes and 15px for the labels outside them (events,
 * gateways, flows) read at about 14px when the diagram is drawn up to
 * `bpmn-detangle`'s width budget, 1400, and shown in a 1200px band (owner,
 * 2026-10-31, after seeing 14px: *"maybe make tasks a bit taller and font a
 * bit bigger?"*). The budget and this size are one rule: change them together.
 */
export const TEXT_STYLE = {
  defaultStyle: { fontSize: 16, lineHeight: 1.2 },
  externalStyle: { fontSize: 15, lineHeight: 1.2 },
} as const;

/**
 * The names of pools and lanes. bpmn-js draws them, turned on their side, in
 * a strip a fixed 30 wide, so at the 16px of {@link TEXT_STYLE} a name gets
 * one line and anything longer spills across the strip's edge (owner,
 * 2026-10-31, on dth-pc PC-BP-06: *"cluttered swimlane title...expand so text
 * is legible"*). At 13px with tight leading two lines fit the strip; the lane
 * must then be tall enough for the name in two lines, which
 * `bpmn:detangle --write` arranges from {@link DrawnLayout.headers}.
 */
export const HEADER_STYLE = { fontSize: 13, lineHeight: 1.05 } as const;

/**
 * How {@link tidyDrawing} re-lays the text bpmn-js drew: names inside shapes
 * start at {@link TEXT_STYLE}'s size and shrink to `minFontSize` to fit whole
 * words in their box; flows keep bpmn-js's rounded bends (owner, 2026-11-11,
 * Q-SQ-1 = C: the square they meant is the task box, not the bend).
 */
export const TIDY_STYLE: TidyStyle = {
  ...TEXT_STYLE,
  headerStyle: HEADER_STYLE,
  minFontSize: 11,
  squareBends: false,
};

/** A box in diagram coordinates. */
export interface DrawnBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where bpmn-js actually drew the text that sits OUTSIDE a shape: every
 * external label (event, gateway, data object, sequence flow), at the size
 * {@link TEXT_STYLE} gives it. A file's DI may carry no `BPMNLabel` bounds at
 * all, in which case bpmn-js places the label itself, so only the drawn
 * position can say whether two labels collide. `edges` are the drawn flows'
 * waypoints, for a label sitting on a line.
 */
export interface DrawnLayout {
  labels: (DrawnBox & { text: string })[];
  /**
   * The text drawn INSIDE each shape (tasks, sub-processes, call activities),
   * as the box it actually occupies, keyed by the shape's id. A text box
   * larger than its shape is text spilling out (owner, 2026-10-31, after the
   * 16px change: generated 140 × 80 tasks no longer hold their names).
   */
  texts?: DrawnBox[];
  /**
   * Each pool's and lane's name, as laid out in its header strip before it is
   * turned: `width` runs along the lane (at most `room`, the lane's height)
   * and `height` across the 30-wide strip. Taller than 30 means it spills.
   */
  headers?: { id: string; width: number; height: number; room: number }[];
  edges: { id: string; points: { x: number; y: number }[] }[];
  /** What {@link tidyDrawing} could not fix: a name too long for its box, a label with no clear place, a flow through a shape. */
  issues?: string[];
  /** The one size every name inside a shape was drawn at, and the shapes whose names set it. */
  fontSize?: number;
  limitedBy?: string[];
}

/** A headless page with bpmn-js loaded. One per batch: launching per file dominates the runtime. */
export interface Renderer {
  /**
   * bpmn-js's raw SVG for `xml`, its import warnings, and where it drew the
   * labels and flows. Throws when bpmn-js cannot import it.
   */
  render(xml: string): Promise<{ svg: string; warnings: string[]; layout: DrawnLayout }>;
  close(): Promise<void>;
}

/**
 * The font text is MEASURED in while drawing, so a picture is the same bytes
 * on every machine. bpmn-js wraps a name where its measured width runs out,
 * and "Arial" resolves to whatever the machine has: real Arial on one, Liberation
 * Sans on another. Their widths differ by a fraction of a pixel, which moved one
 * line break in a downstream 61-task lifecycle process and made CI call
 * a drawing made elsewhere stale (2026-11-01). Arimo (`@fontsource/arimo`,
 * OFL) is the metric-compatible design both are cut from, bundled here and
 * named "Arial" inside the page only. The SVG still says `Arial, sans-serif`.
 */
export function measuringFont(): string {
  const face = (weight: number): string => {
    const file = Bun.resolveSync(`@fontsource/arimo/files/arimo-latin-${weight}-normal.woff2`, import.meta.dir);
    return `@font-face{font-family:"Arial";font-style:normal;font-weight:${weight};` +
      `src:url(data:font/woff2;base64,${readFileSync(file).toString("base64")}) format("woff2");}`;
  };
  try {
    return face(400) + face(700);
  } catch (e) {
    // Not installed (a mount without this layer's dependencies): measure in
    // the machine's own Arial, as before, and say so.
    console.warn(`· render-bpmn: @fontsource/arimo not found (${(e as Error).message.split("\n")[0]}); text measured in the machine's Arial, so pictures may differ by machine`);
    return "";
  }
}

/**
 * Launch the renderer. `CHROMIUM_PATH` wins when set; otherwise the
 * `PLAYWRIGHT_BROWSERS_PATH` probe, then Playwright's own.
 */
export async function openRenderer(viewerBundle: string): Promise<Renderer> {
  const executablePath = process.env.CHROMIUM_PATH || chromiumExecutable();
  // Hinting changes text widths, and so where bpmn-js wraps a name. The
  // runner's own fontconfig is not trusted for it: render-fonts.conf keeps the
  // machine's fonts but always draws unhinted. A sandbox honours the
  // fontconfig and a CI runner the flag (bootstrap-tools#67), so both are set.
  const env = { ...process.env, FONTCONFIG_FILE: join(import.meta.dir, "render-fonts.conf") } as Record<string, string>;
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), env, args: ["--font-render-hinting=none"] });
  const page: Page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${measuringFont()}</style></head><body><div id="canvas"></div></body></html>`);
  await page.evaluate(() => Promise.all(["16px Arial", "bold 16px Arial"].map((f) => document.fonts.load(f))));
  await page.addScriptTag({ path: viewerBundle });
  // tidyDrawing runs in the page, so it goes over as its source text.
  await page.addScriptTag({ content: `window.tidyDrawing = ${tidyDrawing.toString()};` });
  return {
    render: (xml) =>
      page.evaluate(async ({ bpmnXml, textRenderer, tidyStyle }) => {
        const container = document.getElementById("canvas")!;
        container.innerHTML = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Viewer = (window as any).BpmnJS;
        const viewer = new Viewer({ container, textRenderer });
        const result = await viewer.importXML(bpmnXml);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { issues, fontSize, limitedBy } = (window as any).tidyDrawing(viewer, tidyStyle) as { issues: string[]; fontSize?: number; limitedBy: string[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all: any[] = viewer.get("elementRegistry").getAll();
        const reg = viewer.get("elementRegistry");
        // Where the label's TEXT is, not its DI bounds: bpmn-js wraps an
        // outside label at its own width, so a DI box narrower or shorter
        // than the text says nothing about what the text runs into.
        const labels = all
          .filter((e) => e.type === "label" && e.businessObject?.name)
          .map((e) => {
            const t = reg.getGraphics(e)?.querySelector("text") as SVGTextElement | null;
            const b = t?.getBBox();
            const box = b && b.width > 0 ? { x: e.x + b.x, y: e.y + b.y, width: b.width, height: b.height } : { x: e.x, y: e.y, width: e.width, height: e.height };
            return { id: e.labelTarget?.id ?? e.id, text: String(e.businessObject.name), ...box };
          });
        const edges = all
          .filter((e) => Array.isArray(e.waypoints))
          .map((e) => ({ id: e.id, points: e.waypoints.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })) }));
        const registry = viewer.get("elementRegistry");
        // Pool and lane names, as tidyDrawing laid them, measured before they are turned.
        const headers: { id: string; width: number; height: number; room: number }[] = [];
        for (const e of all) {
          if (!/^bpmn:(Participant|Lane)$/.test(e.type) || !e.businessObject?.name) continue;
          if (e.di?.isHorizontal === false) continue;
          const t = registry.getGraphics(e)?.querySelector(".djs-visual > text.djs-label") as SVGTextElement | null;
          if (!t) continue;
          const b = t.getBBox();
          headers.push({ id: e.id, width: b.width, height: b.height, room: e.height });
        }
        const texts = all
          .filter((e) => e.type !== "label" && !e.waypoints && e.businessObject?.name && !/Participant|Lane/.test(e.type))
          .flatMap((e) => {
            const t = registry.getGraphics(e)?.querySelector("text.djs-label") as SVGGraphicsElement | null;
            if (!t) return [];
            const b = t.getBBox();
            return b.width > 0 ? [{ id: e.id, x: e.x + b.x, y: e.y + b.y, width: b.width, height: b.height }] : [];
          });
        const { svg } = await viewer.saveSVG({ format: true });
        viewer.destroy();
        return { svg, warnings: (result.warnings ?? []).map((w: Error) => w.message), layout: { labels, edges, texts, headers, issues, fontSize, limitedBy } };
      }, { bpmnXml: xml, textRenderer: TEXT_STYLE, tidyStyle: TIDY_STYLE }),
    close: () => browser.close(),
  };
}

/**
 * bpmn-js's SVG, made fit to publish: arrowhead ids renumbered (`<prefix>1`,
 * `<prefix>2`, …) so the output is deterministic; a white backdrop, because
 * outside the pool bpmn-js draws nothing and near-black strokes vanish on a
 * dark theme; and `width="100%"` with `height` DROPPED — an SVG presentation
 * attribute must be a length and "auto" is not one, so the ratio comes from
 * the `viewBox`. `undefined` when bpmn-js's output no longer has the shape
 * these edits expect, so a caller fails rather than publishing half of them.
 */
export function drawing(svg: string, markerPrefix: string): string | undefined {
  const markerIds = new Map<string, string>();
  const stable = svg.replace(/marker-[a-z0-9]{8,}/g, (id: string) => {
    if (!markerIds.has(id)) markerIds.set(id, `${markerPrefix}${markerIds.size + 1}`);
    return markerIds.get(id)!;
  });
  // The viewBox does not start at the origin, so the backdrop is placed in
  // viewBox coordinates — a 100%-sized rect at 0,0 would miss the right edge.
  const opaque = stable.replace(
    /(<svg[^>]*\sviewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"[^>]*>)/,
    (_m: string, tag: string, x: string, y: string, w: string, h: string) =>
      `${tag}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" />`,
  );
  const responsive = opaque.replace(
    /<svg([^>]*?)\swidth="[\d.]+"\sheight="[\d.]+"/,
    (_m: string, attrs: string) => `<svg${attrs} width="100%" style="max-width:100%;height:auto"`,
  );
  if (responsive === opaque || opaque === stable) return undefined;
  return responsive;
}

/**
 * Wrap a shape's `<g>` in an `<a>`, by counting `<g>` depth from the opening
 * tag to its own closing one.
 *
 * A regex cannot do this: a bpmn-js shape contains nested `<g>` elements, so
 * `</g>` first matches an inner one and the wrapper closes in the wrong place —
 * an SVG that still parses and is quietly mis-nested. The caller asserts the
 * count afterwards, so a shape that could not be found fails the render
 * rather than silently losing its link.
 */
export function wrapShapeInLink(svg: string, elementId: string, href: string): string {
  const open = new RegExp(`<g class="djs-element[^"]*" data-element-id="${elementId}"[^>]*>`);
  const m = open.exec(svg);
  if (!m) return svg;
  const start = m.index;
  let i = start + m[0].length;
  let depth = 1;
  const tag = /<g\b|<\/g>/g;
  tag.lastIndex = i;
  let t: RegExpExecArray | null;
  while (depth > 0 && (t = tag.exec(svg)) !== null) {
    depth += t[0] === "</g>" ? -1 : 1;
    i = t.index + t[0].length;
  }
  if (depth !== 0) return svg;
  const a = `<a class="fa-subprocess-link" href="${href}" target="_top">`;
  return svg.slice(0, start) + a + svg.slice(start, i) + "</a>" + svg.slice(i);
}

/** Every `bpmn:process` id in `xml`. */
export function processIds(xml: string): string[] {
  return [...xml.matchAll(/<bpmn:process\s+id="([^"]+)"/g)].map((m) => m[1]!);
}

/**
 * Links for the copy beside the source: a call activity links to the called
 * diagram when that diagram sits in the same directory, and to nothing
 * otherwise. `processFile` maps a process id to the absolute path of the
 * `.bpmn` defining it. By default the link is the called diagram's SVG; a
 * caller that publishes the processes on a page passes `hrefFor` to link the
 * process's place on that page instead, since a bare SVG opened on its own is
 * not where a reader wants to land (owner, 2026-11-11: *"subprocess should
 * link to process page"*).
 */
export function siblingLinks(
  file: string,
  xml: string,
  processFile: Map<string, string>,
  hrefFor: (calledFile: string, calledProcess: string) => string = (home) => `${basename(home, ".bpmn")}.svg`,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of xml.matchAll(/<bpmn:callActivity\b([^>]*)>/g)) {
    const id = /\sid="([^"]+)"/.exec(m[1]!)?.[1];
    const called = /\scalledElement="([^"]+)"/.exec(m[1]!)?.[1];
    const home = called ? processFile.get(called) : undefined;
    if (!id || !home) continue;
    if (dirname(home) !== dirname(file)) continue;
    out.set(id, hrefFor(home, called!));
  }
  return out;
}

/**
 * Every definer of each process id, as the id → file map seen from `file`.
 * Two diagrams may define the same id; a single map built by reading them in
 * turn is last-wins, and `siblingLinks` then drops the link of whichever
 * referrer lost. The definer in `file`'s own directory wins, as `siblingLinks`
 * links only there; otherwise the lexicographically first path, so the answer
 * never depends on read order.
 */
export function processFilesFrom(definers: Map<string, string[]>, file: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, files] of definers) {
    const sorted = [...files].sort();
    out.set(id, sorted.find((f) => dirname(f) === dirname(file)) ?? sorted[0]!);
  }
  return out;
}

/** The picture to write beside `file`, or an error saying why there is none. */
export async function besideSource(
  r: Renderer,
  file: string,
  processFile: Map<string, string>,
  hrefFor?: (calledFile: string, calledProcess: string) => string,
): Promise<{ svg: string } | { error: string }> {
  const xml = readFileSync(file, "utf-8");
  let raw: Awaited<ReturnType<Renderer["render"]>>;
  try {
    raw = await r.render(xml);
  } catch (e) {
    return { error: (e instanceof Error ? e.message : String(e)).split("\n")[0]! };
  }
  if (raw.warnings.length) return { error: `${raw.warnings.length} import warning(s): ${raw.warnings.join("; ")}` };
  const drawn = drawing(raw.svg, "bpmn-marker-");
  if (!drawn) return { error: "could not make the SVG responsive — bpmn-js output changed shape" };
  const own = siblingLinks(file, xml, processFile, hrefFor);
  // The note goes on THIS copy only — the one written into the content graph.
  // A harness drawing its own site copy with `drawing()` is not bootstrap-tools
  // writing into bootstrap, and must not say it is.
  const note = `<!-- ${generatedNote("scripts/render-bpmn.ts", basename(file), `change ${basename(file)}`)} -->`;
  let local = drawn.replace(/^(<\?xml[^>]*\?>\n?)/, `$1${note}\n`);
  if (!local.includes(note)) return { error: "could not place the generated-by note — no XML declaration" };
  for (const [id, href] of own) local = wrapShapeInLink(local, id, href);
  const n = (local.match(/class="fa-subprocess-link"/g) ?? []).length;
  if (n !== own.size) return { error: `${own.size} sibling link(s) to write but ${n} wrapped` };
  return { svg: local };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const repoAt = args.indexOf("--repo");
  const repo = resolve(repoAt >= 0 && args[repoAt + 1] ? args[repoAt + 1]! : join(import.meta.dir, "..", ".."));
  const tools = readKnowledgeGraphDeclaration(join(import.meta.dir, "..")) as Record<string, unknown> | undefined;
  const graphs = knowledgeGraphsIn(repo).filter(({ decl }) => tools !== undefined && supportsContent(tools, decl.name, decl.version));
  const sources = graphs.flatMap(({ root, decl }) =>
    (decl.directories ?? [])
      .filter((d) => d.graphTypologies.includes("processes"))
      .flatMap((d) => {
        const dir = resolve(root, d.path);
        return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".bpmn")).map((f) => join(dir, f)) : [];
      }),
  );
  if (sources.length === 0) {
    console.error(`✗ no .bpmn in a processes subgraph of a graph these tools support, under ${repo} — nothing was drawn or checked.`);
    process.exit(2);
  }
  // Resolved as a module from these tools, not from `--repo`: standalone,
  // bootstrap-tools installs its own dependencies, and the repository it draws
  // for (a bootstrap checkout) has none.
  let viewer: string;
  try {
    viewer = Bun.resolveSync("bpmn-js/dist/bpmn-viewer.production.min.js", import.meta.dir);
  } catch {
    viewer = join(repo, VIEWER_BUNDLE);
  }
  if (!existsSync(viewer)) {
    console.error(`bpmn-js not installed (${viewer} missing). Run \`bun install\`.`);
    process.exit(1);
  }
  const definers = new Map<string, string[]>();
  for (const f of sources) for (const id of processIds(readFileSync(f, "utf-8"))) definers.set(id, [...(definers.get(id) ?? []), f]);
  const r = await openRenderer(viewer);
  let bad = 0;
  for (const file of sources.sort()) {
    const out = file.replace(/\.bpmn$/, ".svg");
    const shown = relative(repo, out);
    // A file that holds no process — a layer's shared global tasks (owner,
    // 2026-10-20, "a1") — has no diagram to draw; it is drawn in each
    // process that calls one of its tasks.
    if (processIds(readFileSync(file, "utf-8")).length === 0) {
      console.log(`· ${relative(repo, file)} holds no process — nothing to draw`);
      continue;
    }
    const got = await besideSource(r, file, processFilesFrom(definers, file));
    if ("error" in got) {
      console.error(`✗ ${relative(repo, file)}: ${got.error}`);
      bad++;
      continue;
    }
    const prev = existsSync(out) ? readFileSync(out, "utf-8") : undefined;
    if (check) {
      if (prev !== got.svg) {
        console.error(`✗ ${shown} is stale — re-run without --check`);
        bad++;
      } else console.log(`✓ ${shown} up to date`);
      continue;
    }
    writeFileSync(out, got.svg);
    console.log(`${prev === got.svg ? "=" : "✓"} ${shown}`);
  }
  await r.close();
  if (bad > 0) process.exit(1);
}
