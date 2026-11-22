import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * A subprocess link lands in the same place whatever page the diagram is on
 * (bean `xl55`).
 *
 * `render-bpmn.ts` writes each link relative to the SVG FILE. Inlined into a
 * page, a relative href would resolve against the PAGE — correct from the docs
 * root, wrong from `processes/`, which is exactly how five hand-written links
 * broke. `docs-ui.js` re-anchors each to the file's own URL; this drives it
 * from both depths, and checks a link that fails `safeHref` loses its href.
 */
const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const ORIGIN = "https://links.example.test";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <a class="fa-subprocess-link" href="../../../evidence.html#the-subprocess" target="_top"><rect x="20" y="20" width="160" height="80"/></a>
  <a class="fa-subprocess-link" href="javascript:alert(1)"><rect x="220" y="20" width="160" height="80"/></a></svg>`;

/** NO BACKTICKS inside the template — the page is one. */
const page = (imgSrc: string): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Diagram</title>
<style>${CSS}</style></head><body><div class="main"><div class="main-content"><h1>Diagram</h1>
<figure class="bpmn-figure"><img src="${imgSrc}" alt="A process."></figure></div></div>
<script>${JS}<\/script></body></html>`;

async function open(p: Page, path: string, imgSrc: string): Promise<void> {
  await p.route(`${ORIGIN}/**`, (route) => {
    const url = route.request().url();
    if (url.endsWith(".svg")) return route.fulfill({ contentType: "image/svg+xml", body: SVG });
    return route.fulfill({ contentType: "text/html", body: page(imgSrc) });
  });
  await p.goto(`${ORIGIN}${path}`);
  await expect(p.locator(".bpmn-figure svg")).toHaveCount(1);
}

const hrefs = (p: Page): Promise<(string | null)[]> =>
  p.locator(".bpmn-figure svg a.fa-subprocess-link").evaluateAll((as) => as.map((a) => a.getAttribute("href")));

test.describe("subprocess links resolve from the SVG file, not the page (xl55)", () => {
  test("from a page at the docs root", async ({ page: p }) => {
    await open(p, "/content-lifecycle.html", "assets/img/workflows/x.svg");
    expect((await hrefs(p))[0]).toBe(`${ORIGIN}/evidence.html#the-subprocess`);
  });

  test("from a page under processes/ — where page-relative links broke", async ({ page: p }) => {
    await open(p, "/processes/editing-hci-validation.html", "../assets/img/workflows/x.svg");
    expect((await hrefs(p))[0]).toBe(`${ORIGIN}/evidence.html#the-subprocess`);
  });

  test("a link that fails the URL check keeps no href", async ({ page: p }) => {
    await open(p, "/content-lifecycle.html", "assets/img/workflows/x.svg");
    expect((await hrefs(p))[1]).toBeNull();
  });
});
