import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * A JUMP LANDS BELOW THE branches/ BANNER AND THE SITE BAR — owner, 2026-10-31,
 * on dth-pc staging: "clicking on anchor link for Zambia scrolls the title out
 * of frame" (option A: offset every jump target by the live header height).
 *
 * A document page is a just-the-docs page: its site bar is the theme's
 * `#main-header.fa-page-bar`, its column `.main-content`, not `.fa-page-main`,
 * and it sets its own `.fa-doc :target{scroll-margin-top:4rem}`. 4rem is less
 * than a staging banner plus the bar, so the heading landed under them.
 * Measured before the fix on the dth-pc copy: heading top 64px, bar bottom 106px.
 */

// The shipped files themselves (page-layout.ts's PAGE_LAYOUT_CSS_SOURCE / _JS_SOURCE), read directly so the spec needs no build.
const css = readFileSync(fileURLToPath(new URL("../../scripts/templates/page-layout.css", import.meta.url)), "utf-8");
const js = readFileSync(fileURLToPath(new URL("../../scripts/templates/page-layout.js", import.meta.url)), "utf-8");

function pageHtml(bannerLines: number): string {
  const filler = Array.from({ length: 60 }, (_, i) => `<p>Paragraph ${i}</p>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${css}</style>
<style>.fa-doc :target{scroll-margin-top:4rem} p{margin:0;height:40px}</style>
</head><body>
<div id="banner" style="position:fixed;top:0;left:0;right:0;z-index:99;background:#4F6F52;color:#fff;line-height:28px">${"Feature branch<br>".repeat(bannerLines)}</div>
<div class="main"><div id="main-header" class="main-header fa-site-bar fa-page-bar"><a class="fa-page-bar-home" href="#">Site</a><input id="search-input"></div>
<div id="main-content" class="main-content"><main><div class="fa-doc">
<p><a id="go" href="#h-zambia">Zambia</a> <a id="go-fig" href="#fig-1">Figure</a></p>
${filler}<h3 id="h-zambia">Zambia</h3>${filler}<figure id="fig-1" style="margin:0;height:200px">Figure 1</figure>${filler}
</div></main></div></div>
<script>document.documentElement.style.setProperty("--fa-staging-offset", document.getElementById("banner").getBoundingClientRect().height + "px");</script>
<script>${js}</script>
</body></html>`;
}

for (const [label, width, bannerLines] of [["wide, one-line banner", 1440, 1], ["tablet, banner wraps", 820, 2], ["phone, bar not sticky", 390, 4]] as const) {
  test(`a jump to a heading or a figure lands below the banner and the bar (${label})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.setContent(pageHtml(bannerLines));
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--fa-page-bar-h"))).not.toBe("");
    for (const [link, id] of [["#go", "h-zambia"], ["#go-fig", "fig-1"]] as const) {
      await page.evaluate(() => window.scrollTo(0, 0));
      // Clicked as a reader clicks a contents link; the fixed banner covers this one at the top, so by script.
      await page.locator(link).evaluate((a) => (a as HTMLAnchorElement).click());
      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#${id}`);
      const m = await page.evaluate((id) => {
        const t = document.getElementById(id)!.getBoundingClientRect().top;
        const bar = document.getElementById("main-header")!.getBoundingClientRect();
        const banner = document.getElementById("banner")!.getBoundingClientRect().bottom;
        // The bar covers the page only while stuck (wide screens); scrolled away, it is above the window.
        const covered = Math.max(banner, bar.top >= 0 ? bar.bottom : 0);
        return { t, covered, scrolled: window.scrollY };
      }, id);
      expect(m.scrolled).toBeGreaterThan(0);
      expect(m.t).toBeGreaterThanOrEqual(m.covered);
      // …and not far below it: the margin is the cover plus .5rem.
      expect(m.t - m.covered).toBeLessThan(24);
    }
  });
}
