/**
 * The sidebar's title row on a right-to-left page (bean `giiw`).
 *
 * Owner, 2026-10-06, on the Arabic site: *"avatar still cutoff/overlapping
 * text"*. Measured in a local build before the fix: the avatar sat half outside
 * the collapsed strip (1330-1362px against a strip from 1344px), the title
 * touched the avatar (0px apart; 6px on the English site), and on a phone the
 * title ran under the Folio handle. Each was a physical side written for the
 * left. These hold the three, on an Arabic page and on an English control.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");

/**
 * Just enough of just-the-docs: a fixed bar on the reading side (a full-width
 * top row on a phone), its header a flex row, the theme's PHYSICAL title
 * padding — the thing that cut the avatar in half on the right-docked strip.
 */
function page(dir: "rtl" | "ltr"): string {
  const side = dir === "rtl" ? "right: 0" : "left: 0";
  return `<!doctype html><html lang="${dir === "rtl" ? "ar" : "en"}" dir="${dir}"><head><meta charset="utf-8"><style>
  body { margin: 0; font: 16px sans-serif; }
  .side-bar { position: fixed; top: 0; ${side}; height: 100%; display: flex; flex-flow: column nowrap; overflow: hidden; background: #f5f6fa; }
  .site-header { display: flex; align-items: center; min-height: 3.75rem; }
  /* The theme's desktop title padding is 2rem on BOTH sides: on a right-docked
     strip it is the right one that pushed the avatar out (1330-1362px against
     a strip from 1344px, measured). */
  .site-title { display: flex; align-items: center; flex-grow: 1; padding: 0.5rem 2rem; }
  /* Below 50rem the theme's bar is a full-width row across the top. */
  @media not all and (min-width: 50rem) {
    .side-bar { position: static; width: 100%; height: auto; }
    .site-title { padding: 0.5rem 0.875rem; }
  }
  ${CSS}
  </style></head><body>
  <div class="side-bar"><div class="site-header"><a class="site-title" href="#">
    <span class="fa-site-mark fa-site-mark--avatar" aria-hidden="true"></span>
    <span class="fa-site-title" lang="en" dir="ltr">C@T Harness</span>
  </a></div></div>
  <button class="fa-glass-handle" type="button">Folio</button>
  <div class="main"><h1>${dir === "rtl" ? "البدء" : "Start"}</h1></div>
</body></html>`;
}

const rect = (p: Page, sel: string) =>
  p.locator(sel).first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right };
  });

for (const dir of ["rtl", "ltr"] as const) {
  test.describe(`the sidebar title on an ${dir === "rtl" ? "Arabic (RTL)" : "English (LTR) control"} page`, () => {
    test("the title is English, read left to right, whatever the page", async ({ page: p }) => {
      await p.setContent(page(dir));
      const t = p.locator(".fa-site-title");
      await expect(t).toHaveAttribute("lang", "en");
      expect(await t.evaluate((e) => getComputedStyle(e).direction)).toBe("ltr");
    });

    test("at rest, the whole avatar is inside the collapsed strip", async ({ page: p }) => {
      await p.setViewportSize({ width: 1400, height: 600 });
      await p.setContent(page(dir));
      const strip = await rect(p, ".side-bar");
      const mark = await rect(p, ".fa-site-mark");
      expect(strip.right - strip.left).toBeLessThan(100); // it IS the strip
      expect(mark.left).toBeGreaterThanOrEqual(strip.left);
      expect(mark.right).toBeLessThanOrEqual(strip.right);
    });

    test("on a phone the avatar and the title do not touch, and neither runs under the Folio handle", async ({ page: p }) => {
      await p.setViewportSize({ width: 390, height: 600 });
      await p.setContent(page(dir));
      const mark = await rect(p, ".fa-site-mark");
      const text = await rect(p, ".fa-site-title");
      const pill = await rect(p, ".fa-glass-handle");
      const gap = dir === "rtl" ? mark.left - text.right : text.left - mark.right;
      expect(gap).toBeGreaterThanOrEqual(4);
      for (const r of [mark, text]) expect(r.right <= pill.left || r.left >= pill.right).toBe(true);
    });
  });
}
