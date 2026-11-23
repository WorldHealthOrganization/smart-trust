/**
 * A committed THEMED page, served in a minimal stand-in for the site layout.
 *
 * ## Why a stand-in
 *
 * A themed page (`layout: default` front matter, a Liquid-raw body) is not a
 * document until Jekyll wraps it, and the e2e server serves the repository as
 * committed. So a spec that opens one gets the front matter as text and no
 * head. The library viewer's pages became themed on 2026-10-07
 * (`gen-library-viz.ts` `libraryPageHtml`); before that every spec here opened
 * the committed standalone file directly.
 *
 * The stand-in carries what the layout contributes that a page relies on, and
 * nothing more: the page title, the `alternate` link `head_custom.html` writes
 * from `alternate_jsonld`, the theme's ground, body ink and link ink for the
 * scheme ({@link THEME} — a page's colours are written for that ground),
 * `data-fa-scheme` on `<html>`, and the
 * body inside `<main class="main-content">`. Whether the page IS on the layout
 * is asserted by the unit tests, from the front matter.
 *
 * `beans-page-search.e2e.ts` is the precedent this follows.
 *
 * @module test/support/themed-page
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import type { Page } from "@playwright/test";

import { themedBody } from "../../scripts/lib/themed-page.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * The theme's ground and body ink in each scheme — the ground as
 * head_custom.html's first-paint block paints it. The LINK ink follows
 * `table-filter.e2e.ts`: light is the theme's (#7253ed, about 5.0:1 on white);
 * dark is the stand-in's own choice, because the theme's dark link colour
 * (#2c84fa on #27262b) measures about 4.1:1 — a site-wide finding outside any
 * one page, which a page's own spec does not inherit.
 */
export const THEME = {
  dark: { ground: "#27262b", ink: "#e6e1e8", link: "#8ab4f8" },
  light: { ground: "#ffffff", ink: "#5c5962", link: "#7253ed" },
} as const;
export type Scheme = keyof typeof THEME;

/** A themed page, split into what Jekyll reads and what it renders. */
export interface ThemedPage {
  frontMatter: Record<string, string>;
  body: string;
}

/** Split a themed page; `undefined` when the text has no front matter. */
export function parseThemed(text: string): ThemedPage | undefined {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return undefined;
  const frontMatter: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv || kv[2] === "") continue;
    const v = kv[2]!.trim();
    frontMatter[kv[1]!] = v.startsWith('"') ? (JSON.parse(v) as string) : v;
  }
  // What Liquid would render: the outer raw block unwrapped, and any endraw
  // the body carries (escaped by `escapeForRaw`) restored.
  return { frontMatter, body: themedBody(text) };
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The stand-in document for one themed page. `head` and `tail` add what a spec needs of the layout. */
export function layoutStandIn(p: ThemedPage, o: { scheme?: Scheme; head?: string; tail?: string } = {}): string {
  const scheme = o.scheme ?? "dark";
  const fm = p.frontMatter;
  return `<!doctype html><html lang="en" data-fa-scheme="${scheme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fm.title ?? "")}</title>
${fm.alternate_jsonld ? `<link rel="alternate" type="application/ld+json" href="${esc(fm.alternate_jsonld)}">\n` : ""}<style>html,body{margin:0;background:${THEME[scheme].ground};color:${THEME[scheme].ink};font:16px/1.5 system-ui,sans-serif}
.main-content{max-width:50rem;padding:1rem 2rem} .main-content a{color:${THEME[scheme].link}}</style>
${o.head ?? ""}</head><body>
<main class="main-content" id="main-content">
${p.body}
</main>
${o.tail ?? ""}</body></html>`;
}

/**
 * Serve every themed `.html` page under `urlPrefix` — the e2e server's view of
 * `fsRoot` — through {@link layoutStandIn}. Anything else, standalone pages
 * included, falls through to the server unchanged.
 */
export async function serveThemed(
  page: Page,
  o: { fsRoot: string; urlPrefix: string; scheme?: Scheme; head?: string; tail?: string },
): Promise<void> {
  const root = resolve(o.fsRoot);
  await page.route(`**${o.urlPrefix}**`, async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    let file = resolve(root, "." + path.slice(o.urlPrefix.length - 1));
    if (file !== root && !file.startsWith(root + sep)) return route.fallback();
    // A page the build wrote for a MOUNTED layer is at its output-root twin
    // (bean cat-tools-sm8r), and a directory may exist only there. Read through
    // the overlay as test-server.mjs serves it; otherwise the page falls through
    // to the server unwrapped, with no ground and no scheme, and every colour
    // spec on it fails (folio-assistant#3124, library-viewer-scope).
    let read = overlayPath(file);
    if (existsSync(read) && statSync(read).isDirectory()) {
      file = join(file, "index.html");
      read = overlayPath(file);
    }
    if (!file.endsWith(".html") || !existsSync(read)) return route.fallback();
    const themed = parseThemed(readFileSync(read, "utf8"));
    if (!themed) return route.fallback();
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: layoutStandIn(themed, o) });
  });
}

/**
 * The THEME's own link colour in each scheme, as axe reports a foreground —
 * as opposed to {@link THEME}'s dark link, the stand-in's choice. #2c84fa on
 * #27262b measures 4.13:1, under AA for body text, on every page of the site;
 * a spec that serves the theme's real colour sets aside exactly that
 * foreground on links, so anything a page does to a link is still reported.
 */
export const THEME_LINK: Record<Scheme, string> = { dark: "#2c84fa", light: "#7253ed" };

/** The stand-in document around a themed page, with the THEME's real link colour. */
export function themedShell(page: string, scheme: Scheme = "dark", title = "Themed page"): string {
  const t = THEME[scheme];
  // The `alternate` link `head_custom.html` writes from `alternate_jsonld`: a
  // thin page (a todo) finds its data through it, as on the site.
  const alt = parseThemed(page)?.frontMatter.alternate_jsonld;
  return `<!doctype html><html lang="en" data-fa-scheme="${scheme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
${alt ? `<link rel="alternate" type="application/ld+json" href="${esc(alt)}">\n` : ""}<style>html,body{background:${t.ground};color:${t.ink}}a{color:${THEME_LINK[scheme]}}body{margin:0;font:16px/1.5 system-ui,sans-serif}
.main-content{max-width:50rem;margin:0 auto;padding:1rem}</style></head><body>
<main class="main-content" id="main-content">
${themedBody(page)}
</main></body></html>`;
}

/**
 * Serve ONE committed page at `urlPath` (repository-relative, as
 * `test-server.mjs` serves it) in {@link themedShell}, and leave every other
 * request to the server. Call before `page.goto(urlPath)`.
 */
export async function serveThemedAt(p: Page, repoRoot: string, urlPath: string, scheme: Scheme = "dark"): Promise<void> {
  const file = join(repoRoot, urlPath.replace(/^\//, "").replace(/\/$/, "/index.html"));
  // A page the build wrote at the layer output root is read there (bean cat-tools-sm8r).
  const body = themedShell(readFileSync(overlayPath(file), "utf8"), scheme);
  await p.route((url) => url.pathname === urlPath, (route) => route.fulfill({ contentType: "text/html", body }));
}
