/**
 * A document figure that is a view of an ArchiMate model is shown as the
 * model's own drawing, not as the screenshot pasted into the text.
 *
 * Owner, 2026-10-31: *"i dont really like native UML, rather derived"*
 * (smart-ra#166, follow-up D3b). The layer's ArchiMate config maps a
 * figure's block to the view it shows (`figures` in `cat-archimate.config.json`,
 * cat-harness-tools#1064), and `archimate-pages --out` draws every view as SVG
 * into the same site. Here each `<img>` in a mapped block is replaced by that
 * SVG, with a line saying where it is drawn from and linking the view's page.
 *
 * The drawing is an `<object>`, never an `<img>`: every box in it links to its
 * element's page (`target="_top"`), and a browser makes no link inside an SVG
 * loaded through `<img>` clickable. The PNG in `media/` is the object's
 * fallback content, shown when a build ran without the ArchiMate step.
 *
 * A figure that also has an AS-DRAWN source — `figures[].asDrawn` in the
 * config, or an image in the block whose name says `as-drawn` — gets the
 * two-radio "As drawn / ArchiMate" switch an ArchiMate view page carries
 * (cat-harness-tools `gen-archimate-pages.ts` `asDrawnSwitch`), "As drawn"
 * first and checked (owner, 2026-11-17: dth-phc Fig. 3). It needs no script:
 * real radios with labels, so the keyboard moves between them; colours for
 * light and dark; and print shows the as-drawn drawing only.
 *
 * @module folio-assistant-core/scripts/live-figures
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, posix } from "node:path";
import { findDeclarationFile } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { TOOLS_ROOT } from "@litlfred/cat-harness-tools/scripts/lib/roots.js";
import { fromPageDir } from "./document-site-route.js";

/** A document figure the config maps to a view, with where the site holds its drawing and its page. */
export interface FigureTarget {
  /** The block holding the figure, relative to the layer root (`figures[].block`). */
  block: string;
  label: string;
  model: string;
  view: string;
  /** The view's name in the model. */
  viewName: string;
  /** Site-relative: the view drawn as SVG, which `archimate-pages --out` writes. */
  svg: string;
  /** Site-relative, with a trailing slash: the view's page, at the declared route. */
  page: string;
  /** The figure as drawn (`figures[].asDrawn`), relative to the layer root, when the config names one. */
  asDrawn?: string;
}

type ConfigFigure = { block: string; label: string; model: string; view: string; asDrawn?: string };

const req = createRequire(import.meta.url);

/**
 * Every figure the layer's config maps to a view (`figures`), with the site
 * paths `archimate-pages --out` writes for it. Delegates to `gen-archimate-pages`
 * when `figureTargets` is exported there (cat-harness-tools#1077), and computes
 * the same paths from the tools layer's ArchiMate modules otherwise.
 */
export function figureTargets(instanceRoot: string): FigureTarget[] {
  const pages = req(join(TOOLS_ROOT, "archimate/scripts/gen-archimate-pages.ts")) as {
    figureTargets?: (root: string) => FigureTarget[];
    declaredPageRoot: (decl: unknown, directory: string) => string;
  };
  const check = req(join(TOOLS_ROOT, "archimate/scripts/check-archimate.ts")) as {
    configPath: (root: string) => string | undefined;
    readConfig: (root: string) => {
      directory: string;
      models: Array<{ id: string; file: string }>;
      figures?: ConfigFigure[];
    };
    archimateDir: (root: string, config: unknown) => string;
    localDirOf: (root: string, dir: string) => string;
  };
  if (typeof pages.figureTargets === "function") {
    // The tools layer's targets may predate `asDrawn`; carry it over from the config.
    const targets = pages.figureTargets(instanceRoot);
    if (targets.length === 0 || targets.some((t) => t.asDrawn !== undefined) || check.configPath(instanceRoot) === undefined) return targets;
    const figs = check.readConfig(instanceRoot).figures ?? [];
    return targets.map((t) => {
      const asDrawn = figs.find((f) => f.block === t.block && f.model === t.model && f.view === t.view)?.asDrawn;
      return asDrawn === undefined ? t : { ...t, asDrawn };
    });
  }
  if (check.configPath(instanceRoot) === undefined) return [];
  const config = check.readConfig(instanceRoot);
  const figures = config.figures ?? [];
  if (figures.length === 0) return [];
  const dir = check.archimateDir(instanceRoot, config);
  const declFile = findDeclarationFile(instanceRoot)!;
  const decl = JSON.parse(readFileSync(join(instanceRoot, declFile), "utf8"));
  const graphPath = check.localDirOf(instanceRoot, dir).replace(/\/$/, "");
  const pageRoot = pages.declaredPageRoot(decl, config.directory);
  const { readArchimate } = req(join(TOOLS_ROOT, "archimate/schemas/archimate.ts")) as {
    readArchimate: (buf: Buffer) => { views: Array<{ id: string; name: string }> };
  };
  const { planSlugs } = req(join(TOOLS_ROOT, "archimate/schemas/slugs.ts")) as {
    planSlugs: (model: unknown) => Map<string, string>;
  };
  const out: FigureTarget[] = [];
  for (const cm of config.models) {
    const mine = figures.filter((f) => f.model === cm.id);
    if (mine.length === 0) continue;
    const model = readArchimate(readFileSync(join(dir, cm.file)));
    const slugOf = planSlugs(model);
    for (const f of mine) {
      const v = model.views.find((x) => x.id === f.view);
      if (v === undefined) continue;
      out.push({
        ...f,
        viewName: v.name,
        svg: posix.join(graphPath, cm.id, "views", `${v.id}.svg`),
        page: `${posix.join(pageRoot, cm.id, "views", slugOf.get(v.id) ?? v.id)}/`,
      });
    }
  }
  return out;
}

/** One image the document links (`media/…`), and the view that replaces it, as links from the document page. */
export interface LiveFigure {
  /** The image as the block links it, e.g. `media/image28.png`. */
  src: string;
  label: string;
  viewName: string;
  model: string;
  /** From the document page to the view's SVG. */
  svg: string;
  /** From the document page to the view's page. */
  page: string;
  /** From the document page to the figure as drawn, when it has one: the switch shows it first. */
  asDrawn?: string;
}

/** The name of an image says it is the figure as drawn (`as-drawn-fig-3.svg`, `fig-3-…-as-drawn.svg`). */
const isAsDrawn = (src: string): boolean => /(^|[/_.-])as-drawn([_.-]|$)/i.test(src);

/**
 * `figures[].asDrawn` as the document page links it. A document's images move
 * with its page to `<page>/media/` (document-site-route.ts), so a file in a
 * `media/` folder is linked as `media/<file>`; any other path is left as the
 * config gives it, relative to the page.
 */
const asDrawnLink = (path: string): string => {
  const i = path.lastIndexOf("media/");
  return i < 0 ? path : path.slice(i);
};

const IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

/** The images the mapped blocks of one document link, each with its view. */
export function liveFiguresFor(targets: FigureTarget[], repoRoot: string, pageDir: string): Map<string, LiveFigure> {
  const out = new Map<string, LiveFigure>();
  for (const t of targets) {
    const file = join(repoRoot, t.block);
    if (!existsSync(file)) continue; // check-archimate reports it
    const images = [...readFileSync(file, "utf8").matchAll(IMAGE)].map((m) => m[1]);
    const asDrawn = t.asDrawn !== undefined ? asDrawnLink(t.asDrawn) : images.find(isAsDrawn);
    for (const src of images) {
      out.set(src, {
        src,
        label: t.label,
        viewName: t.viewName,
        model: t.model,
        svg: fromPageDir(pageDir, t.svg),
        page: `${fromPageDir(pageDir, t.page)}/`,
        ...(asDrawn !== undefined ? { asDrawn } : {}),
      });
    }
  }
  return out;
}

/** {@link liveFiguresFor} for a layer: empty when it holds no ArchiMate config or maps no figure. */
export function liveFigures(repoRoot: string, pageDir: string): Map<string, LiveFigure> {
  return liveFiguresFor(figureTargets(repoRoot), repoRoot, pageDir);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The switch's stylesheet, emitted once before the first switch on a page, so
 * it works on a standalone page and on a themed one alike. The radios stay in
 * the tab order (hidden only visually); the checked one's label is filled, the
 * focused one's is outlined. Print drops the radios and shows the as-drawn pane.
 */
export const FIGURE_SWITCH_STYLE = `<style data-fa-figure-switch>
.fa-figure-switch { margin: 1rem 0; --fa-sw: #0b5cad; --fa-sw-on: #fff; }
@media (prefers-color-scheme: dark) { html:not([data-fa-scheme="light"]) .fa-figure-switch { --fa-sw: #7db4ff; --fa-sw-on: #111; } }
html[data-fa-scheme="dark"] .fa-figure-switch { --fa-sw: #7db4ff; --fa-sw-on: #111; }
.fa-figure-switch > input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; }
.fa-figure-switch > label { display: inline-block; padding: 4px 12px; margin: 0 4px 8px 0; border: 1px solid var(--fa-sw); border-radius: 14px; color: var(--fa-sw); cursor: pointer; font-size: .9em; }
.fa-figure-switch > input:checked + label { background: var(--fa-sw); color: var(--fa-sw-on); }
.fa-figure-switch > input:focus-visible + label { outline: 3px solid var(--fa-sw); outline-offset: 2px; }
.fa-figure-switch > .fa-figure-pane { display: none; }
.fa-figure-switch > input.fa-figure-as-drawn:checked ~ .fa-figure-pane-as-drawn,
.fa-figure-switch > input.fa-figure-archimate:checked ~ .fa-figure-pane-archimate { display: block; }
.fa-figure-pane-as-drawn img { display: block; max-width: 100%; height: auto; }
@media print {
  .fa-figure-switch > input, .fa-figure-switch > label { display: none !important; }
  .fa-figure-switch > .fa-figure-pane-as-drawn { display: block !important; }
  .fa-figure-switch > .fa-figure-pane-archimate { display: none !important; }
}
</style>`;

/** Rendered HTML with every mapped `<img>` drawn from the model, its boxes linked to their elements. */
export function withLiveFigures(html: string, figures: Map<string, LiveFigure>): string {
  if (figures.size === 0) return html;
  let n = 0;
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const src = /\ssrc="([^"]*)"/.exec(tag)?.[1];
    const f = src === undefined ? undefined : figures.get(src);
    if (f === undefined) return tag;
    const alt = `${f.label}: view "${f.viewName}" of ArchiMate model ${f.model}, drawn from the model`;
    const fallback = f.asDrawn ?? f.src;
    // An <object>, so the drawing's own links work; its content (the page's own
    // `media/` copy) shows only when the drawing is missing.
    const object = `<object class="fa-live-figure" type="image/svg+xml" data="${esc(f.svg)}" aria-label="${esc(alt)}"><img src="${esc(fallback)}" alt="${esc(alt)}" loading="lazy"></object>`;
    const note = `<span class="fa-live-figure-note">Drawn from the ArchiMate model: <a href="${esc(f.page)}">view &ldquo;${esc(f.viewName)}&rdquo;</a> (${esc(f.model)})</span>`;
    if (f.asDrawn === undefined) return object + note;
    // Both an as-drawn source and a view: the switch, "As drawn" first.
    const id = `fa-figure-${++n}`;
    const drawnAlt = `${f.label}, as drawn`;
    return (
      (n === 1 ? FIGURE_SWITCH_STYLE : "") +
      `<span class="fa-figure-switch" role="group" aria-label="${esc(`${f.label}: show as`)}" style="display:block">` +
      `<input type="radio" class="fa-figure-as-drawn" name="${id}" id="${id}-as-drawn" checked>` +
      `<label for="${id}-as-drawn">As drawn</label>` +
      `<input type="radio" class="fa-figure-archimate" name="${id}" id="${id}-archimate">` +
      `<label for="${id}-archimate">ArchiMate</label>` +
      `<span class="fa-figure-pane fa-figure-pane-as-drawn"><img src="${esc(f.asDrawn)}" alt="${esc(drawnAlt)}" loading="lazy"></span>` +
      `<span class="fa-figure-pane fa-figure-pane-archimate">${object}${note}</span>` +
      `</span>`
    );
  });
}

/** Whether an SVG file holds a link a reader can follow (`<a href=…>` or `<a xlink:href=…>`). */
function svgHasLinks(file: string): boolean {
  if (!existsSync(file)) return false;
  return /<a\b[^>]*\s(?:xlink:)?href="[^"#][^"]*"/.test(readFileSync(file, "utf8"));
}

/**
 * Rendered HTML with every image that is a linked SVG of the document's own
 * (`media/…svg`) embedded as an `<object>`, so its links work.
 *
 * A browser makes no link inside an SVG loaded through `<img>` clickable. The
 * DIIG phases chart that every Digital Transformation Handbook shows
 * (`diig-phases-svg.ts`) links each resource box to its library entry, and as
 * an `<img>` none of those boxes could be followed (owner, 2026-11-17: "I
 * thought this was a reusable SVG with linked content in boxes"). An SVG with
 * no link stays an `<img>`: an `<object>` costs a document load for nothing.
 * The `<img>` stays inside as the object's fallback content.
 *
 * `documentDir` is the document's folder (`folio/<slug>/`), against which a
 * block's `media/…` path resolves.
 */
export function linkedSvgFigures(html: string, documentDir: string): string {
  // An image already inside an <object> (a model view's fallback) is left as it is.
  return html.replace(/<object\b[\s\S]*?<\/object>|<img\b[^>]*>/g, (tag) => {
    if (tag.startsWith("<object")) return tag;
    const src = /\ssrc="([^"]*)"/.exec(tag)?.[1];
    if (src === undefined || !/^media\/[^?#]+\.svg$/i.test(src) || src.split("/").includes("..")) return tag;
    if (!svgHasLinks(join(documentDir, ...src.split("/")))) return tag;
    const alt = /\salt="([^"]*)"/.exec(tag)?.[1] ?? "";
    return `<object class="fa-live-figure" type="image/svg+xml" data="${src}"${alt ? ` aria-label="${alt}"` : ""}>${tag}</object>`;
  });
}
