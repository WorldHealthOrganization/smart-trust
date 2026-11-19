import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * IG site diagrams get the shared figure viewer (bean `n7f8`).
 *
 * Owner, 2026-10-06, on an IG's sequence-diagrams page: *"the diagrams on
 * … are now resiable/scrollable like the bpmn diagrams are. tehy should
 * be"*. Measured
 * on a local staged build: the page's two inline PlantUML diagrams had the
 * viewer, and its three `<object data="x.svg">` diagrams did not, so the
 * widest ran past the content column and was clipped.
 *
 * The fixture is that page's SHAPE: an IG page as the IG site build composes
 * it (the opt-in stamp, then the IG's content), with each way an IG
 * embeds a diagram — an inline `<svg>` in the Publisher's
 * `<figure style="width:70%">`, an `<object>`, and a wide raster drawing.
 *
 * The opt-in attribute, `data-fa-figure-images`, is THIS file's contract:
 * `docs-ui.js` owns it, and the IG site build is one page writer that stamps
 * it (its own unit test asserts the stamp carries it). So the fixture writes
 * the attribute itself rather than reaching into the IG build: a platform
 * test that read a dependant layer's source would point the wrong way.
 */
const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

/** The page-level opt-in, as a page writer stamps it. */
const FIGURE_IMAGES_STAMP = '<span hidden data-fa-figure-images="ig"></span>';

const ORIGIN = "https://ig.example.test";

/** A PlantUML-shaped SVG: fixed px size in attributes AND inline style, as PlantUML writes. */
function plantuml(w: number, h: number, label: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg xmlns="http://www.w3.org/2000/svg" ` +
    `height="${h}px" preserveAspectRatio="none" style="width:${w}px;height:${h}px;background:#FFFFFF;" ` +
    `version="1.1" viewBox="0 0 ${w} ${h}" width="${w}px"><rect x="10" y="10" width="${w - 20}" height="${h - 20}" ` +
    `fill="#eef" stroke="#226"/><text x="20" y="40">${label}</text></svg>`;
}

/** A solid-colour PNG, built here so the fixture needs no binary file. */
function png(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x88)]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const FILES: Record<string, { type: string; body: string | Buffer }> = {
  "/ig/wide.svg": { type: "image/svg+xml", body: plantuml(2000, 400, "Federated verification") },
  "/ig/small.svg": { type: "image/svg+xml", body: plantuml(400, 200, "Aggregation") },
  "/ig/arch.drawio.png": { type: "image/png", body: png(2400, 300) },
  "/ig/photo.png": { type: "image/png", body: png(300, 300) },
};

/** NO BACKTICKS inside the template — the page is one. */
function pageHtml(stamped: boolean): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sequence Diagrams</title>
<style>body { margin: 0; background: #fff; } .main { margin-left: 16rem; }
.main-content { max-width: 50rem; padding: 1rem; } .main-content img { max-width: 100%; } ${CSS}</style></head><body>
<div class="main"><div class="main-content" id="main-content">
${stamped ? FIGURE_IMAGES_STAMP : ""}
<h1>Sequence Diagrams</h1>
<h4>Routine Synchronization</h4>
<figure style="width:70%">
${plantuml(1600, 500, "Routine synchronization")}
</figure>
<h4>Federated Verification</h4>
<object data="wide.svg" type="image/svg+xml">Federated verification sequence</object>
<h4>Federated PKD Aggregation</h4>
<object data="small.svg" type="image/svg+xml"></object>
<h4>Architecture</h4>
<p><img src="arch.drawio.png" alt="Architecture overview"></p>
<p><img src="photo.png" alt="A small picture"></p>
</div></div>
<script>${JS}<\/script></body></html>`;
}

async function open(page: Page, stamped = true): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const f = FILES[path];
    if (f) return route.fulfill({ contentType: f.type, body: f.body });
    return route.fulfill({ contentType: "text/html", body: pageHtml(stamped) });
  });
  await page.goto(`${ORIGIN}/ig/sequence-diagrams.html`);
  // Both <object>s are inlined before the figures mount.
  await expect(page.locator(".main-content object")).toHaveCount(0);
  await expect(page.locator(".main-content .fa-figure-scope svg")).toHaveCount(3);
}

test.describe("IG site diagrams — the shared figure viewer (bean n7f8)", () => {
  test("every diagram an IG page embeds gets the viewer: inline <svg>, <object>, and a shrunk raster drawing", async ({ page }) => {
    await open(page);
    // Three SVGs and the wide PNG; the 300px picture is shown at its own size and is left alone.
    await expect(page.locator(".main-content .fa-figure-scope")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Zoom in" })).toHaveCount(4);
    await expect(page.locator(".fa-figure-scope img[src$='arch.drawio.png']")).toHaveCount(1);
    await expect(page.locator(".fa-figure-scope img[src$='photo.png']")).toHaveCount(0);
    // The <object>'s fallback text is the inlined drawing's accessible name.
    await expect(page.getByRole("img", { name: "Federated verification sequence" })).toHaveCount(1);
  });

  test("nothing overflows the content column unclipped: a diagram wider than it scrolls inside its figure", async ({ page }) => {
    await open(page);
    const report = await page.evaluate(() => {
      const main = document.querySelector(".main-content")!;
      const right = main.getBoundingClientRect().right;
      const arts = [...main.querySelectorAll("svg, img, object")].filter((n) => n.getBoundingClientRect().width > 240);
      return arts.map((n) => {
        const scope = n.closest(".fa-figure-scope") as HTMLElement | null;
        const box = (scope ?? n).getBoundingClientRect();
        return {
          what: n.getAttribute("src") || n.getAttribute("data-fa-src") || n.tagName,
          inScope: !!scope,
          overflowX: scope ? getComputedStyle(scope).overflowX : "",
          // A figure far wider than the column starts in FULL WIDTH (the
          // viewer's own default, `shouldAutoExpand`): its bound is then the
          // viewport, not the column, and the drawing still scrolls inside it.
          fullWidth: !!scope && scope.classList.contains("is-fullwidth"),
          fits: box.right <= (scope && scope.classList.contains("is-fullwidth") ? document.documentElement.clientWidth : right) + 1,
        };
      });
    });
    expect(report.length).toBeGreaterThanOrEqual(4);
    for (const r of report) {
      expect(r.fits, JSON.stringify(r)).toBe(true);
      // The small picture is shown at its own size and needs no figure.
      if (String(r.what).endsWith("photo.png")) continue;
      expect(r.inScope, JSON.stringify(r)).toBe(true);
      expect(["auto", "scroll"], JSON.stringify(r)).toContain(r.overflowX);
    }
  });

  test("100% is the drawing's own size, capped at the column", async ({ page }) => {
    await open(page);
    const small = page.locator(".fa-figure-scope svg[data-fa-src$='small.svg']");
    const w = await small.evaluate((n) => n.getBoundingClientRect().width);
    expect(Math.round(w)).toBe(400);
    const wide = page.locator(".fa-figure-scope svg[data-fa-src$='wide.svg']");
    const fit = await wide.evaluate((n) => {
      const s = n.closest(".fa-figure-scope") as HTMLElement;
      return { art: n.getBoundingClientRect().width, scroll: s.scrollWidth, client: s.clientWidth };
    });
    expect(fit.art).toBeLessThan(2000);
    expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1);
  });

  test("keyboard only: focus the figure, zoom with + and -, pan with the arrows, reset with 0", async ({ page }) => {
    await open(page);
    const scope = page.locator(".fa-figure-scope:has(svg[data-fa-src$='wide.svg'])");
    const level = page.locator(".fa-figure-tools:has(+ .fa-figure-scope svg[data-fa-src$='wide.svg']) .fa-zoom-level");
    await expect(scope).toHaveAttribute("tabindex", "0");
    // Reached by Tab from its own toolbar, not only by a script focusing it.
    // From the toolbar's LAST control: cat-harness#916 put "Open ↗" after
    // Copy, so Tab from Copy now lands on that link, not on the figure.
    await page.locator(".fa-figure-tools:has(+ .fa-figure-scope svg[data-fa-src$='wide.svg']) :is(button, a)").last().focus();
    await page.keyboard.press("Tab");
    await expect(scope).toBeFocused();

    await page.keyboard.press("+");
    await expect(level).toHaveText("125%");
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    await expect(level).toHaveText("200%");
    await expect.poll(() => scope.evaluate((s) => s.scrollWidth > s.clientWidth)).toBe(true);

    const before = await scope.evaluate((s) => s.scrollLeft);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const after = await scope.evaluate((s) => s.scrollLeft);
    expect(after).toBeGreaterThan(before);
    await page.keyboard.press("ArrowLeft");
    expect(await scope.evaluate((s) => s.scrollLeft)).toBeLessThan(after);

    await page.keyboard.press("-");
    await expect(level).toHaveText("150%");
    await page.keyboard.press("0");
    await expect(level).toHaveText("100%");
  });

  test("an arrow on a figure that fits is left to the page", async ({ page }) => {
    await open(page);
    const scope = page.locator(".fa-figure-scope:has(svg[data-fa-src$='small.svg'])");
    await scope.focus();
    const prevented = await scope.evaluate((s) => {
      const e = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
      s.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(prevented).toBe(false);
  });

  test("without the IG page's opt-in, a raster image is not taken for a figure", async ({ page }) => {
    await open(page, false);
    await expect(page.locator(".fa-figure-scope img")).toHaveCount(0);
    // The SVG diagrams still get the viewer: they never needed the opt-in.
    await expect(page.locator(".main-content .fa-figure-scope")).toHaveCount(3);
  });
});
