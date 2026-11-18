/**
 * THE THEMING SUBGRAPH'S VISUALISER — every theme, drawn.
 *
 * A subgraph owes a **visualiser** and a **documentation entry**;
 * `cat-harness/skills/ui/theming/` gets its visualiser here and its entry in
 * `docs/architecture/theming.md`. Theming takes no `renderExemption`: it
 * produces nothing BUT things a human looks at.
 *
 * ## It PRINTS and never gates
 *
 * The schema proves a scrim parses and a crop box is square and in bounds,
 * but **it cannot see what a picture shows**, so this answers a question no
 * gate can carry. The contrast ratios are computed in
 * `schemas/themes.test.ts`; this page shows them beside a PASS/FAIL against
 * the AAA floor rather than claiming them.
 *
 * ## Two outputs, one set of rows
 *
 * `theme:sheet` writes a STANDALONE file with every image inlined as a data
 * URI, so it can be opened from anywhere, attached, or looked at offline.
 *
 * `theme:page` writes the same rows into the SITE, at `docs/themes/index.md`,
 * with the images LINKED (the art is already published under `assets/img/`)
 * so the committed page carries no base64. Both go through {@link sheetBody},
 * so the page and the sheet cannot show different themes.
 *
 * The page is generated and committed, so `theme:page:check` gates that it
 * matches the registry — never that a picture is right.
 *
 * Usage:  bun run cat theme:sheet [--out <file>]
 *         bun run cat theme:page [--check]
 *
 * @covers none — it reads `THEMES` (the platform's own, declared in code)
 * plus a layer's declared art via `readDeclaration` and `THEME_LAYOUTS`.
 * Neither is the `themes` graph, and this resolves no directory of that kind;
 * `check:instance-themes` is the gate that covers the graph.
 * @module scripts/render-theme-sheet
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { instanceDirectoriesForGraph, layerRootsIn, readDeclaration, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.js";
import { THEME_LAYOUTS, resolveThemeBackdrop, type ResolvedTheme } from "../schemas/ui/theme.js";
import { instanceThemes } from "../schemas/ui/theme-by-ref.js";
import { THEMES } from "../schemas/ui/themes.js";
import type { ImageRegion, KgImage } from "../schemas/kg/kg-node.js";
import { avatarClip, dataUri } from "./render-avatar-crops.js";
import { declaredContributions } from "./ensure-landing-sticky.js";
import { publishedPagePath } from "./lib/jekyll-permalink.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteTarget } from "./lib/site-target.ts";
import { declaredPageRoute, withRenderedByFrontMatter } from "./viewer-declarations.ts";
import { subjectIri } from "./lib/subject-pages.ts";
import { THEME_SUBJECT_KIND, themeNodes, type ThemeNode } from "./lib/theme-nodes.ts";

/** The AAA floor. A value below it is not a worse theme; it is a failing one. */
export const AAA = 7;

/** sRGB relative luminance, per WCAG 2.x. Hex only — see `parseColour`. */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? [...c].map((x) => x + x).join("") : c;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * `ink` over `scrim` laid on PURE BLACK — the binding case.
 *
 * Not over the art in use, and that is the whole idea: a layer may declare
 * its own art for a role, so the picture a value was tuned against is not the
 * picture it will meet. Pure black is the darkest any layer could declare,
 * so a number measured against it is true of all of them.
 */
export function inkOverScrimOnBlack(ink: string, scrim: string): number | undefined {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(scrim);
  if (m === null) return undefined; // could not determine — say so, never guess
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const over = [1, 2, 3]
    .map((i) => Math.round(Number(m[i]) * a)) // composited onto #000
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return contrast(ink, `#${over}`);
}

function swatch(label: string, value: string): string {
  return `<div class="sw"><span class="chip" style="background:${value}"></span>` +
    `<span class="swl">${label}<br><code>${value}</code></span></div>`;
}

function regionBox(r: ImageRegion, cls: string, title: string): string {
  return `<span class="rgn ${cls}" title="${title}" ` +
    `style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%"></span>`;
}

/**
 * Where an image is fetched from, or `undefined` when it cannot be read.
 *
 * The one difference between the two outputs: the standalone sheet inlines the
 * bytes, the site page links the published file.
 */
export type ImageSource = (img: KgImage) => string | undefined;

function artCell(img: KgImage, src: ImageSource): string {
  const uri = src(img);
  if (uri === undefined) {
    // "could not read" is not "no art declared". A blank cell rendered as a
    // clean one is the `dh4f` shape on a page whose job is showing what is there.
    return `<td class="art"><div class="miss">could not read<br><code>${img.src}</code></div></td>`;
  }
  const regions =
    (img.textRegion ? regionBox(img.textRegion, "tx", "textRegion — where words may go") : "") +
    (img.avatarRegion ? regionBox(img.avatarRegion, "av", "avatarRegion — the square the frame clips to") : "");
  const avatar =
    img.avatarRegion === undefined
      ? ""
      : `<div class="av46" style="${avatarClip(uri, img.avatarRegion)}" title="46px, navbar size"></div>`;
  const size = img.width && img.height ? ` <span class="px">${img.width}×${img.height}</span>` : "";
  return `<td class="art"><div class="layout">${img.layout ?? "—"}${size}</div>` +
    `<div class="frame"><img src="${uri}" alt="${img.title ?? img.id}" loading="lazy">${regions}</div>${avatar}</td>`;
}

/**
 * The sample sticky: SQUARE, with the theme's square crop behind the text,
 * faded by the theme's own scrim — the default a todo gets.
 *
 * Owner, 2026-09-24: *"i want sticky themes to by default use the square
 * avatar layout but mostly faded, if not specified. themes/ pages should show
 * sticky as square."* So the sample is the thing a reader will actually meet on
 * a board, not a strip of colour: same crop, same scrim, same ink. A theme with
 * no art shows a plain square in its palette.
 */
function demoSticky(
  t: (typeof THEMES)[number],
  p: (typeof THEMES)[number]["palette"],
  card: KgImage | undefined,
  src: ImageSource,
): string {
  const uri = card === undefined ? undefined : src(card);
  const art =
    uri === undefined || t.backdrop === undefined
      ? ""
      : `<img class="demo-art" src="${uri}" alt="" loading="lazy">` +
        `<span class="demo-scrim" style="background:${t.backdrop.scrim}"></span>`;
  return `<div class="demo" style="background:${p.surface};color:${p.ink};border-color:${p.edge};border-left-color:${p.accent}">` +
    `${art}<span class="demo-text"><b>A sticky on this theme.</b><br>Square crop, faded by the theme's scrim.</span></div>`;
}

/** Which landing-board cards wear each theme, by theme id. */
export function wornBy(root: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const d of declaredContributions(root)) {
    const t = d.contribution.theme.themeId;
    out.set(t, [...(out.get(t) ?? []), d.contribution.id]);
  }
  return out;
}

/**
 * The rows, the key and the stylesheet — everything both outputs share.
 *
 * Every rule is scoped under `.fa-theme-sheet` so the block can sit inside the
 * site's own layout without restyling the page around it. HTML is emitted with
 * NO blank lines and no leading indentation: kramdown ends a raw HTML block at
 * a blank line and reads four leading spaces as a code block, and either would
 * print this markup as text on the site.
 */
export function sheetBody(
  root: string,
  src: ImageSource,
  worn: ReadonlyMap<string, readonly string[]> = new Map(),
  themes: readonly ResolvedTheme[] = THEMES,
): { html: string; css: string; themes: number; missing: string[] } {
  // A theme's art is declared by the layer that owns the theme, so `root`
  // is that layer's root: the platform's for `THEMES`, a layer's for
  // its own `INSTANCE_THEMES`.
  const images = readDeclaration(root)?.images ?? [];
  const missing: string[] = [];

  const rows = themes.map((t) => {
    const p = t.palette;
    const backdrop = resolveThemeBackdrop(t, images);
    if (backdrop.missing.length > 0) missing.push(`${t.id}: ${backdrop.missing.join(", ")}`);

    const scrim = t.backdrop?.scrim;
    const ratio = scrim === undefined ? undefined : inkOverScrimOnBlack(p.ink, scrim);
    const contrastCell =
      t.backdrop === undefined
        ? `<span class="none">no backdrop — art behind ink is what this theme removes</span>`
        : ratio === undefined
          ? `<span class="undet">could not parse the scrim — not the same as failing</span>`
          : `<strong class="${ratio >= AAA ? "pass" : "fail"}">${ratio.toFixed(2)}:1</strong>` +
            `<span class="note">ink over scrim on pure black · AAA floor ${AAA}:1</span>`;

    const art =
      backdrop.art.size === 0
        ? `<td class="art" colspan="3"><div class="miss">${
            backdrop.none ? "declares no backdrop" : `incomplete — missing ${backdrop.missing.join(", ")}`
          }</div></td>`
        : THEME_LAYOUTS.map((l) => {
            const img = backdrop.art.get(l);
            return img === undefined ? `<td class="art"></td>` : artCell(img as KgImage, src);
          }).join("");

    const cards = worn.get(t.id) ?? [];
    const wearers = cards.length
      ? `<div class="worn">worn by ${cards.map((c) => `<code>${c}</code>`).join(", ")}</div>`
      : "";

    return `<tr id="theme-${t.id}"><td class="meta">` +
      `<div class="tid">${t.name}</div><code>${t.id}</code> <span class="kind">${t.kind}</span>` +
      (t.description ? `<p class="desc">${t.description}</p>` : "") +
      wearers +
      `<div class="swatches">${swatch("surface", p.surface)}${swatch("ink", p.ink)}` +
      `${swatch("edge", p.edge)}${swatch("accent", p.accent)}</div>` +
      `<div class="contrast">${contrastCell}</div>` +
      demoSticky(t, p, backdrop.art.get("card") as KgImage | undefined, src) +
      `</td>${art}</tr>`;
  }).join("\n");

  const html = [
    `<div class="fa-theme-sheet">`,
    `<table>`,
    `<thead><tr><th>theme</th><th colspan="3">art, per layout — with regions</th></tr></thead>`,
    `<tbody>`,
    rows,
    `</tbody>`,
    `</table>`,
    `<p class="key">Key: <b class="tx">blue</b> = <code>textRegion</code>, where words may be drawn · ` +
      `<b class="av">pink</b> = <code>avatarRegion</code>, the square a frame clips to · ` +
      `the circle beneath is that clip at 46px, navbar size.</p>`,
    `</div>`,
  ].join("\n");

  const css = `.fa-theme-sheet{--ts-line:rgba(128,128,128,.35);--ts-muted:inherit}
.fa-theme-sheet table{border-collapse:collapse;width:100%;display:table}
.fa-theme-sheet td,.fa-theme-sheet th{border-bottom:1px solid var(--ts-line);padding:14px 10px;vertical-align:top;text-align:left;min-width:0}
.fa-theme-sheet th{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;opacity:.75;font-weight:600}
.fa-theme-sheet .meta{width:32%;min-width:220px}
.fa-theme-sheet .tid{font-weight:650}
.fa-theme-sheet code{font-size:12px}
.fa-theme-sheet .kind,.fa-theme-sheet .px{font-size:.7rem;opacity:.7}
.fa-theme-sheet .desc{font-size:.85rem;opacity:.8;margin:.4rem 0}
.fa-theme-sheet .worn{font-size:.8rem;margin:.3rem 0}
.fa-theme-sheet .swatches{display:flex;flex-wrap:wrap;gap:.5rem;margin:.6rem 0}
.fa-theme-sheet .sw{display:flex;align-items:center;gap:.35rem}
.fa-theme-sheet .chip{width:20px;height:20px;border-radius:4px;border:1px solid var(--ts-line);display:inline-block}
.fa-theme-sheet .swl{font-size:.7rem;line-height:1.2;opacity:.8}
.fa-theme-sheet .contrast{font-size:.85rem;margin:.5rem 0}
.fa-theme-sheet .pass{color:#1d7a3e}.fa-theme-sheet .fail{color:#c0272d}
.fa-theme-sheet .none,.fa-theme-sheet .undet,.fa-theme-sheet .note{opacity:.75;font-size:.78rem;display:block}
.fa-theme-sheet .demo{position:relative;isolation:isolate;overflow:hidden;aspect-ratio:1/1;width:12rem;max-width:100%;margin-top:.6rem;padding:.7em .8em;border:1px solid;border-left-width:5px;border-radius:6px;font-size:.85rem;box-sizing:border-box}
.fa-theme-sheet .demo-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;max-width:none}
.fa-theme-sheet .demo-scrim{position:absolute;inset:0;z-index:-1}
.fa-theme-sheet .demo-text{position:relative;display:block}
.fa-theme-sheet .art{width:22%}
.fa-theme-sheet .layout{font-size:.72rem;opacity:.75;margin-bottom:.3rem}
.fa-theme-sheet .frame{position:relative}
.fa-theme-sheet .frame img{width:100%;display:block;border-radius:5px;max-width:none}
.fa-theme-sheet .rgn{position:absolute;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.6)}
.fa-theme-sheet .tx{border:2px solid #2f7bd6}
.fa-theme-sheet .av{border:2px solid #ff3b6b}
.fa-theme-sheet .av46{width:46px;height:46px;border-radius:50%;margin-top:.5rem;border:1px solid var(--ts-line);background-repeat:no-repeat}
.fa-theme-sheet .miss{opacity:.75;font-size:.8rem;font-style:italic}
.fa-theme-sheet .key{margin:1rem 0 0;font-size:.8rem;opacity:.8}
.fa-theme-sheet .key b.tx{color:#2f7bd6;border:0}.fa-theme-sheet .key b.av{color:#ff3b6b;border:0}
@media (max-width:820px){
.fa-theme-sheet table,.fa-theme-sheet tbody,.fa-theme-sheet tr,.fa-theme-sheet td{display:block}
.fa-theme-sheet thead{display:none}
.fa-theme-sheet tr{border-bottom:1px solid var(--ts-line);padding:12px 0}
.fa-theme-sheet td{border:0}
.fa-theme-sheet td.meta{width:auto;min-width:0}
.fa-theme-sheet td.art{display:inline-block;width:31%;vertical-align:top;padding:4px}
.fa-theme-sheet td.art[colspan]{display:block;width:auto}
}`;
  return { html, css, themes: themes.length, missing };
}

/** The standalone sheet: every image inlined, openable from anywhere. */
export function buildSheet(root: string): { html: string; themes: number; missing: string[] } {
  const body = sheetBody(root, (img) => dataUri(join(root, img.src)), wornBy(root));
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Theme sheet</title>
<style>
:root{color-scheme:light dark;--fg:#16181d;--bg:#fbfbf9}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--fg:#ececee;--bg:#16181d}}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto}
h1{font-size:1.5rem;margin:0 0 .25rem}
p.lede{opacity:.8;margin:0 0 1.5rem;max-width:64ch}
${body.css}
</style></head><body><div class="wrap">
<h1>Theme sheet</h1>
<p class="lede">${LEDE}</p>
${body.html}
</div></body></html>
`;
  return { html, themes: body.themes, missing: body.missing };
}

const LEDE =
  "Every declared theme: palette, the scrim's measured contrast against the binding case, " +
  "and each layout's art with its regions drawn. <strong>This page is for looking.</strong> The schema " +
  "already proves a box is square and inside the frame — what it cannot tell is whether the box is on " +
  "the cat, which is how two crops shipped framing scenery and a third clipped a hard hat.";

/** The site page's path, relative to the layer's site directory. */
export const THEME_PAGE = "themes/index.md";

/**
 * The site page: the same rows, images linked from where the site publishes
 * them. `relative_url` rather than a composed path, so the page works under the
 * project base and under every staging prefix without knowing either.
 */
export function buildPage(root: string): { md: string; themes: number; missing: string[] } {
  const site = resolve(root, siteDirFor(root));
  const src: ImageSource = (img) => {
    const abs = join(root, img.src);
    if (!existsSync(abs)) return undefined;
    const rel = relative(site, abs).split("\\").join("/");
    // An image outside the site is not published, so a link to it would 404.
    if (rel.startsWith("..")) return undefined;
    return `{{ '/${rel}' | relative_url }}`;
  };
  const body = sheetBody(root, src, wornBy(root));
  const withArt = THEMES.filter((t) => t.backdrop !== undefined).length;
  const md = `---
title: "Themes"
description: "Every theme this instance ships — palette, measured contrast, and each layout's art with its text and avatar regions drawn."
---
<!-- GENERATED by cat-harness/scripts/render-theme-sheet.ts — do not edit; run \`bun run cat theme:page\`. -->
<style>
${body.css}
</style>

# Themes

${LEDE}

**${body.themes} theme(s)**, ${withArt} with art. A theme is chosen per note by whoever authors it — there is
no mapping from a role or a kind to a theme — so "worn by" lists the landing-board cards that chose it,
not every place it may appear. How themes are split into skills, and why contrast is measured over pure
black, is on the [theming page]({{ '/${publishedPagePath(resolve(root, siteDirFor(root)), "architecture/theming")}' | relative_url }}).

${body.html}
`;
  return { md, themes: body.themes, missing: body.missing };
}

// ── The `themes` visualiser (bean folio-assistant-6gme) ──────────────────

/** The Tool node that draws the `themes` visualiser. */
export const VIEWER_TOOL = "theme-viewer";

/**
 * The `themes` VISUALISER: every theme in the checkout, the platform's and
 * every layer's, at the route the declaration gives it.
 *
 * Bean `folio-assistant-6gme`, owner 2026-10-20: *"every kind gets a viewer"*.
 * The `themes` kind is declared by layers (an IG template theme, a
 * publisher's publication themes) as a
 * `themes.ts` exporting `INSTANCE_THEMES`, and until this page nothing drew
 * them: `theme:page` draws the platform's `THEMES` only. They are read
 * through `instanceThemes`, the one resolution every generator uses, so this
 * page cannot show a theme the runtime does not resolve, and a layer whose
 * themes cannot be read gets a row saying why rather than no row.
 *
 * Built at publish, like every viewer over a kind the whole checkout holds:
 * which layers are mounted is a fact about the checkout, not this commit.
 */
/** A page the themes viewer writes besides its index: a layer's, or one theme's. */
export interface ThemeVizPage {
  path: string;
  md: string;
}

const yq = (s: string): string => JSON.stringify(s);
const escHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * One theme's own page (owner, 2026-11-13, node-kind audit: every listed node
 * kind has an IRI, a JSON-LD document, a row and a page, no waivers): its
 * sheet row, the module that declares it, and its IRI with the JSON-LD named
 * as the page's alternate, where its layer's export is served.
 */
export function themePageMd(layer: string, node: ThemeNode, body: { html: string; css: string }, iri: string | undefined): string {
  return withRenderedByFrontMatter(
    `---
title: ${yq(node.title)}
description: ${yq(node.description)}
${iri === undefined ? "" : `alternate_jsonld: ${yq(`${iri}.jsonld`)}\n`}---
<!-- GENERATED by cat-harness-tools/scripts/render-theme-sheet.ts --viz — do not edit; run \`bun run cat theme:viz\`. -->
<style>
${body.css}
</style>

# ${node.title}

<p><code>${escHtml(node.id)}</code>${node.kind ? ` · ${escHtml(node.kind)}` : ""} · declared by <b>${escHtml(layer)}</b> in <code>${escHtml(node.sourcePath)}</code> · <a href="../">every ${escHtml(layer)} theme</a></p>
${iri === undefined ? "" : `<p>IRI: <a class="iri" href="${escHtml(iri)}">${escHtml(iri)}</a> · <a href="${escHtml(iri)}.jsonld" type="application/ld+json">JSON-LD</a></p>\n`}
${escHtml(node.description)}

${body.html}
`,
    VIEWER_TOOL,
  );
}

/** The list of a layer's theme pages, each linked, relative to `prefix`. */
export function themeLinks(nodes: readonly ThemeNode[], prefix: string, iriOf: (n: ThemeNode) => string | undefined): string {
  if (nodes.length === 0) return "";
  const items = nodes.map((n) => {
    const iri = iriOf(n);
    return `<li><a href="${escHtml(`${prefix}${n.id}/`)}">${escHtml(n.title)}</a> <code>${escHtml(n.id)}</code>` +
      (iri === undefined ? "" : ` · <a href="${escHtml(iri)}">IRI</a> · <a href="${escHtml(iri)}.jsonld" type="application/ld+json">JSON-LD</a>`) +
      `</li>`;
  });
  return `<ul class="fa-theme-nodes">${items.join("")}</ul>`;
}

export function buildViz(root: string): { path: string; md: string; themes: number; instances: number; missing: string[]; pages: ThemeVizPage[] } | undefined {
  const route = declaredPageRoute(root, VIEWER_TOOL);
  if (route === undefined) return undefined;
  const repoRoot = repoRootFor(root);
  // `--site`: the Tool declares a `site` input, so a site build can have the
  // viewer written into the site it is building rather than this harness's docs.
  const site = siteTarget(resolve(root, siteDirFor(root)));
  // An image is linked only where the site publishes it; anything else is
  // reported as unread on the page rather than linked to a 404.
  const srcFor = (instanceRoot: string): ImageSource => (img) => {
    const abs = join(instanceRoot, img.src);
    if (!existsSync(abs)) return undefined;
    const rel = relative(site, abs).split("\\").join("/");
    return rel.startsWith("..") ? undefined : `{{ '/${rel}' | relative_url }}`;
  };

  const platform = sheetBody(root, srcFor(root), wornBy(root));
  const missing = [...platform.missing];
  let total = platform.themes;
  const sections: string[] = [];
  const pages: ThemeVizPage[] = [];
  const declaring = layerRootsIn(repoRoot)
    .map((r) => ({ r, name: readDeclaration(r)?.name }))
    .filter((x): x is { r: string; name: string } => x.name !== undefined && instanceDirectoriesForGraph(x.r, "themes").length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const { r, name } of declaring) {
    const got = instanceThemes(repoRoot, name);
    if (!got.ok) {
      sections.push(`## ${name}\n\nDeclares a \`themes\` directory whose themes cannot be read: \`${got.miss.kind}\`.\n`);
      continue;
    }
    const body = sheetBody(r, srcFor(r), new Map(), got.themes);
    total += body.themes;
    missing.push(...body.missing.map((m) => `${name}/${m}`));
    // Each theme is a node: a page of its own under its layer's, and its IRI
    // where its layer's export is served (`lib/theme-nodes.ts`, the reader
    // `kg-export` mints from).
    const nodes = themeNodes(r);
    const iriOf = (n: ThemeNode): string | undefined => subjectIri(join(r, n.sourcePath), THEME_SUBJECT_KIND, n.id);
    sections.push(
      `## ${name}\n\n**${body.themes} theme(s)**, declared in ${name}'s \`themes\` directory ([${name}'s page](${name}/)).\n\n` +
        `${themeLinks(nodes, `${name}/`, iriOf)}\n\n${body.html}\n`,
    );
    pages.push({
      path: join(site, route, name, "index.md"),
      md: withRenderedByFrontMatter(
        `---\ntitle: ${yq(`Themes: ${name}`)}\ndescription: ${yq(`The themes ${name} declares, with their palettes, measured contrast and art.`)}\n---\n` +
          `<!-- GENERATED by cat-harness-tools/scripts/render-theme-sheet.ts --viz — do not edit; run \`bun run cat theme:viz\`. -->\n` +
          `<style>\n${body.css}\n</style>\n\n# Themes: ${name}\n\n**${body.themes} theme(s)**, declared in ${name}'s \`themes\` directory. [Every theme](../).\n\n` +
          `${themeLinks(nodes, "", iriOf)}\n\n${body.html}\n`,
        VIEWER_TOOL,
      ),
    });
    for (const n of nodes) {
      const one = sheetBody(r, srcFor(r), new Map(), [n.theme]);
      pages.push({ path: join(site, route, name, n.id, "index.md"), md: themePageMd(name, n, one, iriOf(n)) });
    }
  }

  const md = withRenderedByFrontMatter(
    `---
title: "Themes"
description: "Every theme in this checkout — the platform's and each instance's — with its palette, measured contrast and art."
---
<!-- GENERATED by cat-harness-tools/scripts/render-theme-sheet.ts --viz — do not edit; run \`bun run cat theme:viz\`. -->
<style>
${platform.css}
</style>

# Themes

${LEDE}

**${total} theme(s)**: ${platform.themes} from the platform and ${total - platform.themes} declared by ${declaring.length} instance(s).

## The platform

${platform.html}

${sections.join("\n")}`,
    VIEWER_TOOL,
  );
  return { path: join(site, route, "index.md"), md, themes: total, instances: declaring.length, missing, pages };
}

if (import.meta.main) {
  const root = HARNESS_ROOT;
  const argv = process.argv.slice(2);
  if (argv.includes("--viz")) {
    const viz = buildViz(root);
    if (viz === undefined) {
      console.log(`  · no visualiser declared rendered by ${VIEWER_TOOL} — nothing to publish`);
      process.exit(0);
    }
    if (argv.includes("--check")) {
      for (const p of [{ path: viz.path, md: viz.md }, ...viz.pages]) {
        const current = existsSync(p.path) ? readFileSync(p.path, "utf-8") : "";
        if (current !== p.md) {
          console.error(`::error::render-theme-sheet: ${relative(repoRootFor(root), p.path)} is stale — run \`bun run cat theme:viz\``);
          process.exit(1);
        }
      }
      console.log(`✓ themes viewer is current — ${viz.themes} theme(s), ${viz.instances} instance(s)`);
    } else {
      for (const p of [{ path: viz.path, md: viz.md }, ...viz.pages]) {
        mkdirSync(dirname(p.path), { recursive: true });
        writeFileSync(p.path, p.md);
      }
      console.log(`Themes viewer → ${relative(repoRootFor(root), viz.path)}\n  ${viz.themes} theme(s), ${viz.instances} instance(s)`);
      for (const m of viz.missing) console.log(`  incomplete backdrop — ${m}`);
    }
  } else if (argv.includes("--page")) {
    const { md, themes, missing } = buildPage(root);
    if (themes === 0) {
      console.error("No themes are declared. Nothing was rendered — that is not a clean run.");
      process.exit(2);
    }
    const out = join(resolve(root, siteDirFor(root)), THEME_PAGE);
    if (argv.includes("--check")) {
      const current = existsSync(out) ? readFileSync(out, "utf-8") : "";
      if (current !== md) {
        console.error(`::error::render-theme-sheet: ${THEME_PAGE} is stale — run \`bun run cat theme:page\``);
        process.exit(1);
      }
      console.log(`✓ theme page is current — ${themes} theme(s)`);
    } else {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, md);
      console.log(`Theme page → ${relative(repoRootFor(root), out)}\n  ${themes} theme(s)`);
      for (const m of missing) console.log(`  incomplete backdrop — ${m}`);
    }
  } else {
    const i = argv.indexOf("--out");
    // input-site: inert #77fd4e78 — an OUTPUT path this script writes, never reads
    const out = resolve(i !== -1 ? argv[i + 1]! : join(repoRootFor(root), "_kg", "theme-sheet.html"));
    const { html, themes, missing } = buildSheet(root);
    if (themes === 0) {
      console.error("No themes are declared. Nothing was rendered — that is not a clean run.");
      process.exit(2);
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    console.log(`Theme sheet → ${out}\n  ${themes} theme(s)`);
    // REPORTED, not fatal. An incomplete backdrop is already refused by
    // `resolveThemeBackdrop` and gated by `check:theme-art`; saying it here too
    // helps the person looking at the page understand a blank cell, and a second
    // gate over one fact is a second answer free to disagree with the first.
    for (const m of missing) console.log(`  incomplete backdrop — ${m}`);
    if (!existsSync(out)) process.exit(1);
  }
}
