import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { siteDirFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { declaredPagePath } from "../support/site-pages.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * The site-wide table filter, as a browser builds it (bean 0fua).
 *
 * The glossary, processes, skills index and tools pages were each one flat
 * table of 48 to 270 rows with no way in but scrolling. The owner chose one
 * filter in the shared script over one per visualiser (2026-09-30), so the
 * thing under test is `mountTableFilters` in the shipped docs-ui.js, loaded
 * from the file rather than retyped.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERAL that builds the page (bean bmr0).
 */

const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
/** A file under the site's `assets/`, served as itself — `undefined` for anything else. */
function siteAsset(path: string): { contentType: string; body: string } | undefined {
  const at = path.indexOf("/assets/");
  if (at < 0) return undefined;
  const file = join(ROOT, SITE, path.slice(at + 1));
  if (!existsSync(file)) return undefined;
  const type = file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : "application/octet-stream";
  return { contentType: type, body: readFileSync(file, "utf8") };
}

function table(n: number, attrs = "", wrap = false): string {
  const rows = Array.from({ length: n }, (_, i) =>
    "<tr><td>item-" + i + "</td><td>" + (i % 2 ? "lean proof" : "prose note") + "</td></tr>").join("");
  const t = "<table" + attrs + "><thead><tr><th>id</th><th>kind</th></tr></thead><tbody>" + rows + "</tbody></table>";
  return wrap ? '<div class="table-wrapper">' + t + "</div>" : t;
}

function page(main: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="fa-baseurl" content="/folio-assistant">
  <style>${CSS}</style></head>
  <body><div class="main"><div class="main-content">${main}</div></div>
  <script>${JS}<\/script></body></html>`;
}

async function open(p: Page, main: string): Promise<string[]> {
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.route("http://filter.fixture/**", (r) => r.fulfill({ contentType: "text/html", body: page(main) }));
  await p.goto("http://filter.fixture/t", { waitUntil: "load" });
  return errors;
}

test.describe("table filter", () => {
  test("a long table gets a labelled filter with a live count; a short one does not", async ({ page: p }) => {
    const errors = await open(p, table(40, "", true) + table(10));
    expect(errors).toEqual([]);
    const boxes = p.locator(".fa-table-filter");
    await expect(boxes).toHaveCount(1);
    const input = p.getByLabel("Filter this table");
    await expect(input).toBeVisible();
    const count = p.locator(".fa-table-filter-count");
    await expect(count).toHaveAttribute("aria-live", "polite");
    await expect(count).toHaveText("40 of 40 rows");
    // Before the theme's scroll wrapper, so it does not scroll with the table.
    expect(await p.locator(".table-wrapper").evaluate((w) => w.previousElementSibling?.className)).toBe(
      "fa-table-filter",
    );
    const h = await input.evaluate((e) => e.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
  });

  test("every word must match, and clearing restores every row", async ({ page: p }) => {
    await open(p, table(40));
    const input = p.getByLabel("Filter this table");
    const visible = p.locator("tbody tr:not([hidden])");
    await input.fill("LEAN");
    await expect(visible).toHaveCount(20);
    await expect(p.locator(".fa-table-filter-count")).toHaveText("20 of 40 rows");
    await input.fill("lean item-3");
    // item-3, item-31..39 odd ones: 3, 31, 33, 35, 37, 39
    await expect(visible).toHaveCount(6);
    await input.fill("");
    await expect(visible).toHaveCount(40);
  });

  test("data-fa-no-filter opts a table out", async ({ page: p }) => {
    await open(p, '<div data-fa-no-filter="">' + table(40) + "</div>" + table(30, ' data-fa-no-filter=""'));
    await expect(p.locator(".fa-table-filter")).toHaveCount(0);
  });
});

/**
 * The auto-docs pages carry their own filter (bean 0fua, reopened 2026-09-30):
 * the SHIPPED swimlane glossary page, read from the file the generator
 * committed, so a generator change that drops the filter fails here.
 *
 * Since 2026-10-07 the page is THEMED: front matter, then a Liquid-raw body.
 * It is served the way the beans page spec serves its own: the front matter
 * and the raw tags stripped (Jekyll consumes both), and the body inside a
 * minimal stand-in for the layout, a main-content element on the theme's
 * ground. Real: the committed page, docs-ui.css and docs-ui.js, which the
 * layout now loads on it, so the spec also proves the page's own box is the
 * ONLY box (docs-ui.js skips a table already marked data-fa-filtered).
 *
 * Not real: the theme's stylesheet. The stand-in paints the theme's ground and
 * body ink for each scheme. The dark link ink is the stand-in's own choice:
 * the theme's dark-scheme link colour (#2c84fa on #27262b) measures about
 * 4.1:1, a site-wide finding outside this page that this spec does not
 * inherit. The light one is the theme's (#7253ed, about 5.0:1 on white).
 */
const GLOSSARY = readFileSync(
  overlayPath(declaredPagePath(ROOT, "auto-docs", "index.html", { subgraph: "glossary/swimlane-glossary" })),
  "utf8",
);
/** What Jekyll leaves of the themed page: no front matter, no raw tags. */
const GLOSSARY_BODY = GLOSSARY.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/\{%-?\s*(?:end)?raw\s*-?%\}/g, "");

const SCHEMES = {
  dark: { ground: "#27262b", ink: "#e6e1e8", link: "#8ab4f8" },
  light: { ground: "#ffffff", ink: "#5c5962", link: "#7253ed" },
} as const;

function themedShell(scheme: keyof typeof SCHEMES): string {
  const c = SCHEMES[scheme];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Glossary</title>
  <meta name="fa-baseurl" content="/folio-assistant">
  <style>${CSS}</style>
  <style>html,body{background:${c.ground};color:${c.ink}} a{color:${c.link}}</style></head>
  <body><div class="main"><main class="main-content" id="main-content">${GLOSSARY_BODY}</main></div>
  <script>${JS}<\/script></body></html>`;
}

async function openThemed(p: Page, scheme: keyof typeof SCHEMES): Promise<string[]> {
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.route("http://docsauto.fixture/**", (r) => {
    // The shipped page links the row's own files (bean `lhvt`); serve the real ones.
    const asset = siteAsset(new URL(r.request().url()).pathname);
    if (asset) return r.fulfill(asset);
    return r.fulfill({ contentType: "text/html", body: themedShell(scheme) });
  });
  await p.goto("http://docsauto.fixture/g", { waitUntil: "load" });
  return errors;
}

test.describe("table filter on a themed auto-docs page", () => {
  test("the committed page is themed: front matter, raw body, no document or rail of its own", () => {
    expect(GLOSSARY.startsWith("---\nlayout: default\n")).toBe(true);
    expect(GLOSSARY).toMatch(/^nav_exclude: true$/m);
    expect(GLOSSARY).not.toMatch(/<!doctype|<html|<head|<body/i);
    expect(GLOSSARY).not.toContain('class="fa-nav"');
    expect(GLOSSARY.match(/\{%\s*endraw/g)).toHaveLength(1);
  });

  test("the shipped glossary page filters its rows with a live count, and has ONE filter", async ({ page: p }) => {
    const errors = await openThemed(p, "dark");
    expect(errors).toEqual([]);
    await expect(p.locator(".fa-table-filter")).toHaveCount(1);
    const input = p.getByLabel("Filter this table");
    await expect(input).toBeVisible();
    const rows = p.locator("table[data-fa-filtered] tbody tr");
    const total = await rows.count();
    expect(total).toBeGreaterThan(25);
    const count = p.locator(".fa-table-filter-count");
    await expect(count).toHaveText(total + " of " + total + " rows");
    await input.fill("reviewer");
    const shown = await p.locator("table[data-fa-filtered] tbody tr:not([hidden])").count();
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(total);
    await expect(count).toHaveText(shown + " of " + total + " rows");
    await input.fill("");
    await expect(count).toHaveText(total + " of " + total + " rows");
  });

  for (const scheme of ["dark", "light"] as const) {
    test("WCAG 2.x A/AA: no axe violations in the page body on the " + scheme + " ground", async ({ page: p }) => {
      await openThemed(p, scheme);
      await expect(p.locator("#da-title")).toBeVisible();
      const r = await new AxeBuilder({ page: p })
        .include(".da-page")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(r.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", "))).toEqual([]);
    });
  }
});
