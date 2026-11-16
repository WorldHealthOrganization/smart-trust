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
}

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
  if (typeof pages.figureTargets === "function") return pages.figureTargets(instanceRoot);
  const check = req(join(TOOLS_ROOT, "archimate/scripts/check-archimate.ts")) as {
    configPath: (root: string) => string | undefined;
    readConfig: (root: string) => {
      directory: string;
      models: Array<{ id: string; file: string }>;
      figures?: Array<{ block: string; label: string; model: string; view: string }>;
    };
    archimateDir: (root: string, config: unknown) => string;
    localDirOf: (root: string, dir: string) => string;
  };
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
}

const IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

/** The images the mapped blocks of one document link, each with its view. */
export function liveFiguresFor(targets: FigureTarget[], repoRoot: string, pageDir: string): Map<string, LiveFigure> {
  const out = new Map<string, LiveFigure>();
  for (const t of targets) {
    const file = join(repoRoot, t.block);
    if (!existsSync(file)) continue; // check-archimate reports it
    for (const m of readFileSync(file, "utf8").matchAll(IMAGE)) {
      out.set(m[1], { src: m[1], label: t.label, viewName: t.viewName, model: t.model, svg: fromPageDir(pageDir, t.svg), page: `${fromPageDir(pageDir, t.page)}/` });
    }
  }
  return out;
}

/** {@link liveFiguresFor} for a layer: empty when it holds no ArchiMate config or maps no figure. */
export function liveFigures(repoRoot: string, pageDir: string): Map<string, LiveFigure> {
  return liveFiguresFor(figureTargets(repoRoot), repoRoot, pageDir);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Rendered HTML with every mapped `<img>` drawn from the model, its boxes linked to their elements. */
export function withLiveFigures(html: string, figures: Map<string, LiveFigure>): string {
  if (figures.size === 0) return html;
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const src = /\ssrc="([^"]*)"/.exec(tag)?.[1];
    const f = src === undefined ? undefined : figures.get(src);
    if (f === undefined) return tag;
    const alt = `${f.label}: view "${f.viewName}" of ArchiMate model ${f.model}, drawn from the model`;
    // An <object>, so the drawing's own links work; its content (the page's own
    // `media/` copy) shows only when the drawing is missing.
    return (
      `<object class="fa-live-figure" type="image/svg+xml" data="${esc(f.svg)}" aria-label="${esc(alt)}"><img src="${esc(f.src)}" alt="${esc(alt)}" loading="lazy"></object>` +
      `<span class="fa-live-figure-note">Drawn from the ArchiMate model: <a href="${esc(f.page)}">view &ldquo;${esc(f.viewName)}&rdquo;</a> (${esc(f.model)})</span>`
    );
  });
}
