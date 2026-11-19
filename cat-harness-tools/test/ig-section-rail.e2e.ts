/**
 * An IG page's section links, driven in Chromium: the ✎ and 📣 of each
 * heading live in the right gutter, in the same box and panel as every other
 * document's, not after the heading's text.
 *
 * ## Why this exists
 *
 * Owner, 2026-11-08, on /smart-trust/: "edit feedback on IGs like rest of
 * documents should be on right grill not touching section title ...
 * consolidate infrastructure". The FHIR layer's thin IG layout used to append
 * its own ✎ 📣 to each heading; it now only writes the page's
 * `<script id="ig-source-lines">`, and `EDIT_LINKS_RUNTIME` draws the boxes.
 * This drives the runtime over a page shaped like that layout's output.
 *
 * Self-contained: no network, the page is set inline.
 *
 * @covers none — a browser test of one runtime, not an audit of a declared graph
 */
import { expect, test } from "@playwright/test";

import { EDIT_LINKS_RUNTIME } from "../src/core/edit-links.ts";

const OV = "https://github.com/o/ig/blob/main/input/pagecontent/overview.md";
const LINES = {
  blob: "https://github.com/o/ig/blob/main/input/pagecontent/index.md",
  repo: "o/ig",
  lines: [
    { t: "Summary", l: 2, b: OV },
    { t: "Background &amp; Purpose", l: 25, b: OV },
  ],
};
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>X IG — host</title></head><body>
<main class="ig-main main-content fa-page-main" id="main-content">
<h3 id="summary">Summary</h3><p>Summary text.</p>
<h4 id="background--purpose">Background &amp; Purpose</h4><p>More.</p>
<h4 id="extra">Not in the source</h4><p>Added by an include.</p>
<script type="application/json" id="ig-source-lines">${JSON.stringify(LINES)}</script>
<script>${EDIT_LINKS_RUNTIME}</script></main></body></html>`;

test("each IG heading gets one right-gutter box, nothing inside the heading", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.setContent(PAGE);
  await expect(page.locator(".fa-sec-actions")).toHaveCount(3);
  // Nothing is appended to a heading's own text.
  expect(await page.locator("h3 a, h4 a").count()).toBe(0);
  await expect(page.locator("#summary")).toHaveText("Summary");

  // The box sits right of the text column, in the gutter.
  const box = await page.locator("#summary + .fa-sec-actions").boundingBox();
  const p = await page.locator("#summary + .fa-sec-actions + p").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(p!.x + p!.width);
  // ...and inside the window, not pushed off its right edge.
  expect(box!.x + box!.width).toBeLessThanOrEqual(1200);

  // ✎ goes to the heading's own line in its own file; 📣 to the IG's repository.
  const edit = page.locator("#background--purpose + .fa-sec-actions a[data-fa-link=edit]");
  await expect(edit).toHaveAttribute("href", `${OV}#L25`);
  const fb = new URL((await page.locator("#background--purpose + .fa-sec-actions a[data-fa-link=feedback]").getAttribute("href"))!);
  expect(fb.pathname).toBe("/o/ig/issues/new");
  expect(fb.searchParams.get("title")).toBe("Feedback on “Background & Purpose” (page: X IG)");
  expect(fb.searchParams.get("body")).toContain(`**Source:** ${OV}#L25`);

  // A heading the source does not hold still gets 📣, with no ✎.
  await expect(page.locator("#extra + .fa-sec-actions a[data-fa-link=edit]")).toHaveCount(0);
  await expect(page.locator("#extra + .fa-sec-actions a[data-fa-link=feedback]")).toHaveCount(1);

  // The 📣 opens the shared panel with the section's links.
  await page.locator("#summary + .fa-sec-actions .ba-trigger").click();
  await expect(page.locator(".fa-block-panel.open a[data-fa-link=feedback]")).toBeVisible();
  await expect(page.locator(".fa-block-panel.open a[data-fa-link=edit]")).toHaveAttribute("href", "https://github.com/o/ig/edit/main/input/pagecontent/overview.md");
});

// Owner, 2026-11-08, on a FHIR-layer docs page (publishing.html): "Suggest is now
// redundant with right grill icons. QA and TR should be in right grill."
const DOC = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Doc</title></head><body>
<div class="main-content" id="main-content">
<h2 id="lands"><a href="#lands" class="anchor-heading"></a> Where it lands</h2><p><a href="https://github.com/o/layer/edit/main/docs/lands.md" class="fa-node-edit" data-fa-link="edit" data-src="docs/lands.md" data-repo="o/layer">✎ Edit</a> <span class="fa-qa-badges"><span class="fa-qa-badge fa-qa-unswept" title="Content QA: not available in this build"><span class="fa-qa-tag">QA</span></span> <span class="fa-qa-badge fa-qa-unswept" title="Translation QA: not available in this build"><span class="fa-qa-tag">TR</span></span></span></p>
<p>Body text.</p>
<script>${EDIT_LINKS_RUNTIME}</script></div></body></html>`;

test("a docs section's ✎ and QA / TR leave the line under its heading for the gutter box", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.setContent(DOC);
  const box = page.locator("#lands + .fa-sec-actions");
  await expect(box).toHaveCount(1);
  // The line under the heading is gone: no inline ✍ suggest, ✎ or badges.
  await expect(page.locator("#lands + .fa-sec-actions + p")).toHaveText("Body text.");
  await expect(page.locator(".main-content > p .fa-qa-badges, .main-content > p a.ba-suggest, .main-content > p a.fa-node-edit")).toHaveCount(0);
  await expect(box.locator(".fa-sec-qa .fa-qa-badge")).toHaveCount(2);
  // 📣 goes to the section's own repository and names its source.
  const fb = new URL((await box.locator("a[data-fa-link=feedback]").getAttribute("href"))!);
  expect(fb.pathname).toBe("/o/layer/issues/new");
  expect(fb.searchParams.get("body")).toContain("**Source:** https://github.com/o/layer/blob/main/docs/lands.md");
  // A QA chip opens the section's panel, which says what each badge found.
  await box.locator(".fa-sec-qa .fa-qa-badge").first().click();
  await expect(page.locator(".fa-block-panel.open .fa-sec-qa .fa-qa-badge")).toHaveCount(2);
  await expect(page.locator(".fa-block-panel.open a[data-fa-link=edit]")).toHaveCount(1);
});
