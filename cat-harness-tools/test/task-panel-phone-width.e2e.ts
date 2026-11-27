import { test, expect, devices } from "@playwright/test";
import { PANEL_CSS, PANEL_SCRIPT } from "../scripts/lib/task-panel.ts";

/**
 * A process diagram never makes the page wider than a phone.
 *
 * Owner, 2026-11-18, Android Chrome: "Mobile view is wonky ... If you move or
 * scroll on the bpmn diagram then the screen starts to resize." The ⓘ layer
 * (`.pt-layer`) is laid over the whole drawing, which the site's figure viewer
 * draws wider than the column and scrolls inside a box. The layer's clip-path
 * hid its overhang but did not take it out of layout, so the document was as
 * wide as the drawing: the phone widened its layout viewport and zoomed the
 * page out, and each pan moved the layer and resized the page again.
 *
 * The fixture is the process page's shape after `docs-ui.js` has mounted it:
 * the task-panel block, holding a scroll box with an inline SVG wider than
 * the column. The scroll box is written here, not taken from `docs-ui.js`, so
 * the test pins the task panel's own contract: whatever box the drawing is
 * scrolled in, the panel adds no width to the page.
 */
const { defaultBrowserType: _ignored, ...PIXEL_7 } = devices["Pixel 7"];
test.use(PIXEL_7);

const ORIGIN = "https://panel.example.test";
const SVG_W = 920;
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>process</title>
<style>body { margin: 0 } main { margin: 0 16px } .box { overflow: auto; border: 1px solid #888 }
.box svg { display: block; width: ${SVG_W}px; height: auto }</style>
<style>${PANEL_CSS}</style></head><body><main><h1>A process</h1>
<div class="pt-diagram">
<div class="box"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} 500">
<rect x="10" y="10" width="${SVG_W - 20}" height="480" fill="#eef" stroke="#226"/></svg></div>
<div class="pt-layer"><button type="button" class="pt-mark" data-task="T1" style="left:90%;top:10%"
 aria-expanded="false" aria-label="About step: far right">i</button></div>
<div class="pt-panel" role="dialog" aria-label="Task details" hidden></div>
</div><p>After the drawing.</p></main>
<script>${PANEL_SCRIPT}<\/script></body></html>`;

test("the task panel adds no width to a phone page, before or after a pan", async ({ page }) => {
  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: "text/html", body: PAGE }));
  await page.goto(`${ORIGIN}/process.html`);
  const vw = PIXEL_7.viewport.width;
  const measure = () =>
    page.evaluate(() => ({
      inner: window.innerWidth,
      doc: document.documentElement.scrollWidth,
      layer: Math.round(document.querySelector<HTMLElement>(".pt-layer")!.getBoundingClientRect().width),
    }));
  // Wait for the client to lay the layer over the drawing.
  await expect.poll(async () => (await measure()).layer).toBeGreaterThan(vw);
  expect(await measure()).toMatchObject({ inner: vw, doc: vw });

  // A pan, as a finger drag inside the box scrolls it.
  await page.evaluate(() => {
    document.querySelector(".box")!.scrollLeft = 300;
  });
  await page.waitForTimeout(100);
  expect(await measure()).toMatchObject({ inner: vw, doc: vw });
});
