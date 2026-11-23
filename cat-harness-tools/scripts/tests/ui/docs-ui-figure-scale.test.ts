/**
 * A drawing that arrives as `<img src="x.svg">` must not be drawn at the
 * browser's 300×150 default (owner, 2026-11-17, dth-hrh HRH-BP-01 at §4.3: a
 * bpmn-js SVG has width="100%" and no height, so the <img> reported a
 * `naturalWidth` of 266 and the figure was drawn 266px wide in a 1022px
 * column at "100%").
 *
 * Runs docs-ui.js in a real browser against a page that fills its block
 * AFTER load, the way a whole-document page does, and checks the three ways
 * the figure can end up: inlined and text-fitted, left an <img> because the
 * fetch failed (fits the column), and an <img width="100%"> (not 100px).
 *
 * The script under test is the harness's site chrome, read from the mounted
 * cat-harness layer: content holds no code, so the test lives here
 * (cat-harness#1369 added it there).
 *
 * It needs a Chromium. Where none is installed (the standalone measure, the
 * test shards that do not install one) the cases are skipped, as
 * `test/coordinator/regen-writers.test.ts` skips its browser cases; a launch
 * that fails where a browser IS present still fails.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium } from "playwright";
import { chromiumExecutable } from "../../bpmn-render.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const DOCS_UI = readFileSync(join(HARNESS_ROOT, "site-chrome", "assets", "js", "docs-ui.js"), "utf8");
const ORIGIN = "http://figure-scale.test";

// What bootstrap-tools' render-bpmn.ts writes: width="100%", no height, a
// viewBox, and bpmn-js shapes carrying `data-element-id`.
const BPMN_SVG = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 1600 900">
  <g data-element-id="Task_1"><rect x="10" y="10" width="200" height="80"/>
    <text style="font-size: 12px"><tspan x="20" y="50">Register health worker</tspan></text></g>
  <g data-element-id="Task_2"><rect x="1300" y="700" width="200" height="80"/>
    <text style="font-size: 12px"><tspan x="1310" y="740">Verify licence</tspan></text></g>
</svg>`;

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>body{margin:0;font-size:16px}.main-content{width:1022px}</style></head>
<body><div class="main-content"><div class="fa-doc" id="doc"></div></div>
<script src="${ORIGIN}/docs-ui.js"></script></body></html>`;

/** A Chromium to launch: the one the image pins, else Playwright's own build if it is installed. */
function hasBrowser(): boolean {
  if (chromiumExecutable() !== undefined) return true;
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}
const BROWSER = hasBrowser();

let browser: Browser;
beforeAll(async () => {
  if (!BROWSER) return;
  const executablePath = chromiumExecutable();
  browser = await chromium.launch(executablePath ? { executablePath } : {});
});
afterAll(async () => {
  await browser?.close();
});

/** Load the page, add the figure after load, and read back how it is drawn. */
async function drawLate(img: string, opts: { svgFails?: boolean } = {}) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    await page.route(`${ORIGIN}/**`, (route) => {
      const url = route.request().url();
      if (url.endsWith("/docs-ui.js")) return route.fulfill({ contentType: "application/javascript", body: DOCS_UI });
      if (url.endsWith(".svg")) {
        // An <img> still loads it; only the inlining fetch is refused.
        if (opts.svgFails && route.request().resourceType() === "fetch") return route.fulfill({ status: 500, body: "" });
        return route.fulfill({ contentType: "image/svg+xml", body: BPMN_SVG });
      }
      if (url === `${ORIGIN}/` || url.endsWith(".html")) return route.fulfill({ contentType: "text/html", body: PAGE });
      return route.fulfill({ status: 404, body: "" });
    });
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: "load" });
    await page.evaluate((html) => {
      const blk = document.createElement("p");
      blk.innerHTML = html;
      document.getElementById("doc")!.appendChild(blk);
    }, img);
    await page.waitForFunction(() => {
      const n = document.querySelector("#doc img, #doc svg");
      return !!n && !n.hasAttribute("data-fa-inline-pending") && !!n.closest(".fa-figure-scope");
    }, undefined, { timeout: 15000 });
    await page.waitForTimeout(200);
    return await page.evaluate(() => {
      const n = document.querySelector("#doc img, #doc svg")!;
      const scope = n.closest(".fa-figure-scope") as HTMLElement;
      return {
        tag: n.tagName.toLowerCase(),
        textfit: scope.classList.contains("fa-textfit"),
        natural: scope.style.getPropertyValue("--fa-natural"),
        width: n.getBoundingClientRect().width,
        column: (document.querySelector(".main-content") as HTMLElement).clientWidth,
      };
    });
  } finally {
    await page.close();
  }
}

describe.skipIf(!BROWSER)("docs-ui: an SVG <img> is not drawn at the browser's default size", () => {
  it("inlines a late bpmn-js drawing and text-fits it", async () => {
    const r = await drawLate('<img src="media/bp-1.svg" alt="HRH-BP-01">');
    expect(r.tag).toBe("svg");
    expect(r.textfit).toBe(true);
    // Text-fitted from the viewBox's 1600 units, never the 300×150 default.
    expect(parseFloat(r.natural)).toBeGreaterThan(400);
    expect(r.width).toBeGreaterThan(400);
  }, 30000);

  it("fits the column when the drawing cannot be inlined", async () => {
    const r = await drawLate('<img src="media/bp-1.svg" alt="HRH-BP-01">', { svgFails: true });
    expect(r.tag).toBe("img");
    expect(r.natural).toBe("");
    expect(r.width).toBeGreaterThan(0.9 * r.column);
  }, 30000);

  it('does not read width="100%" as 100px', async () => {
    const r = await drawLate('<img src="media/bp-1.svg" width="100%" alt="HRH-BP-01">', { svgFails: true });
    expect(r.natural).toBe("");
    expect(r.width).toBeGreaterThan(0.9 * r.column);
  }, 30000);
});
