/**
 * The Harnesses config panel (issue #1146), the owner's "Hybrid": reached from
 * Settings and from a ⚙ on each sidebar divider, never from a fifth strip tile.
 * The data is the generated `assets/harness/config.json`, stubbed here in its
 * real shape (`scripts/harness-panel.ts`).
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${CSS}</style></head><body>
<ul class="fa-harness-tabs__list"><li class="fa-harness-tab">
  <a class="fa-harness-tab__body" href="/cat/">C@T Harness</a>
  <button type="button" class="fa-harness-tab__config" data-fa-harness-config="cat-harness"
          aria-label="Configuration of C@T Harness">&#x2699;&#xFE0E;</button>
</li></ul>
<script>${JS}</script></body></html>`;

const CONFIG = {
  properties: [
    { key: "name", skills: [{ name: "instance-kinds", path: "/reference/skill-instructions/instance-kinds.html" }] },
    { key: "associatedHarnesses", skills: [{ name: "associate-harness", path: "/reference/skill-instructions/associate-harness.html" }] },
    { key: "topology", skills: [], gap: "no skill edits `topology` yet" },
  ],
  harnesses: [
    {
      name: "cat-harness", title: "C@T Harness", group: "instantiated", declaredIn: "cat-harness/cat-harness.json",
      viewHref: "https://github.com/x/y/blob/main/cat-harness/cat-harness.json",
      editHref: "https://github.com/x/y/edit/main/cat-harness/cat-harness.json",
      declared: [{ key: "name", summary: "cat-harness" }, { key: "associatedHarnesses", summary: "1: ihris" }],
    },
    { name: "smart-ig", title: "smart-ig", group: "checkout", declaredIn: "smart-ig/smart-ig.json", declared: [] },
  ],
  associated: [
    {
      name: "ihris", title: "iHRIS Knowledge Base", url: "https://litlfred.github.io/ihris/",
      repository: "https://github.com/litlfred/ihris", editHref: "https://github.com/litlfred/ihris",
      relation: "folio-of", declaredBy: ["cat-harness"],
    },
  ],
  // Issue #1719: a harness a subscription reaches and this checkout has not
  // instantiated (cat-harness subscribes to litlfred/ihris since bean tmo5).
  subscribed: [
    {
      name: "other-kb", title: "Other KB", repository: "litlfred/other-kb", ref: "0123456789abcdef0123456789abcdef01234567",
      url: "https://github.com/litlfred/other-kb/tree/0123456789abcdef0123456789abcdef01234567",
      editHref: "https://github.com/litlfred/other-kb", subscription: "other-kb", chosen: false, declaredBy: ["cat-harness"],
    },
  ],
  findings: ["`topology`: no skill edits `topology` yet"],
};

test.beforeEach(async ({ page }) => {
  // The strip starts HIDDEN on a first open (owner, 2026-10-01). These specs
  // are about what is ON the strip, so they arrive as a reader who has shown
  // it; `glass-strip-default-hidden.e2e.ts` holds the default itself.
  await page.addInitScript(() => {
    try { if (localStorage.getItem("fa-glass-strip-hidden") === null) localStorage.setItem("fa-glass-strip-hidden", "0"); } catch { /* no storage */ }
  });
  await page.route("http://replica.test/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: PAGE });
    if (url.pathname === "/assets/harness/config.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(CONFIG) });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto("http://replica.test/page.html");
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
});

const panel = (page: Page) => page.locator('[data-fa-panel="glass-harnesses"]');

test("the sidebar ⚙ opens the glass on that harness's properties and edit skills", async ({ page }) => {
  await page.click('[data-fa-harness-config="cat-harness"]');
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
  const p = panel(page);
  await expect(p.locator(".fa-hc-title")).toContainText("C@T Harness");
  await expect(p.locator('.fa-hc-item[aria-current="true"]')).toContainText("C@T Harness");
  const row = p.locator(".fa-hc-table tbody tr", { hasText: "associatedHarnesses" }).first();
  await expect(row.locator("a")).toHaveAttribute("href", /associate-harness\.html$/);
  const edit = p.locator(".fa-hc-actions a").first();
  await expect(edit).toHaveAttribute("href", /\/edit\/main\/cat-harness\/cat-harness\.json$/);
  await expect(edit).toHaveAttribute("aria-label", /Edit C@T Harness's declaration/);
});

test("Settings reaches the panel; the four groups are there", async ({ page }) => {
  await page.click(".fa-glass-handle");
  await page.click('[data-fa-glass-chrome="glass-settings"]');
  await page.click(".fa-glass-harnesses");
  const p = panel(page);
  await expect(p.locator('[data-fa-hc-group="instantiated"] h3')).toContainText("(1)");
  await expect(p.locator('[data-fa-hc-group="checkout"] h3')).toContainText("(1)");
  await expect(p.locator('[data-fa-hc-group="associated"] h3')).toContainText("(1)");
  await expect(p.locator('[data-fa-hc-group="subscribed"] h3')).toContainText("(1)");
  await expect(p.locator(".fa-hc-findings")).toContainText("1 findings");
});

test("a subscribed harness has its own group, and links to its pin and its own repository, never here", async ({ page }) => {
  await page.click('[data-fa-harness-config="cat-harness"]');
  const p = panel(page);
  await expect(p.locator('[data-fa-hc-group="subscribed"] h3')).toContainText("Subscribed ↗ remote (1)");
  await p.locator(".fa-hc-item", { hasText: "Other KB" }).click();
  await expect(p.locator(".fa-hc-actions a", { hasText: "Open at the pin" })).toHaveAttribute(
    "href",
    "https://github.com/litlfred/other-kb/tree/0123456789abcdef0123456789abcdef01234567",
  );
  await expect(p.locator(".fa-hc-actions a", { hasText: "Its repository" })).toHaveAttribute("href", "https://github.com/litlfred/other-kb");
  await expect(p).toContainText("not chosen: referenced only");
  await expect(p).toContainText("not instantiated here");
});

test("a config with no `subscribed` field (built before #1719) draws an empty group, not an error", async ({ page }) => {
  await page.route("http://replica.test/assets/harness/config.json", (route) => {
    const { subscribed: _s, ...old } = CONFIG;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(old) });
  });
  await page.reload();
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  await page.click('[data-fa-harness-config="cat-harness"]');
  const p = panel(page);
  await expect(p.locator('[data-fa-hc-group="subscribed"] h3')).toContainText("(0)");
  await expect(p.locator('[data-fa-hc-group="associated"] h3')).toContainText("(1)");
});

test("an associated harness links to its own site and its own repository, never here", async ({ page }) => {
  await page.click('[data-fa-harness-config="cat-harness"]');
  const p = panel(page);
  await p.locator(".fa-hc-item", { hasText: "iHRIS Knowledge Base" }).click();
  await expect(p.locator(".fa-hc-actions a", { hasText: "Open" })).toHaveAttribute("href", "https://litlfred.github.io/ihris/");
  await expect(p.locator(".fa-hc-actions a", { hasText: "Its repository" })).toHaveAttribute("href", "https://github.com/litlfred/ihris");
  await expect(p).toContainText("referenced, never loaded");
});

test("every control in the panel is at least 44px tall", async ({ page }) => {
  await page.click('[data-fa-harness-config="cat-harness"]');
  const small = await panel(page).locator(".fa-hc-item, .fa-hc-actions a").evaluateAll((els) =>
    els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).map((e) => e.textContent));
  expect(small).toEqual([]);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("it drills in: the chosen harness alone, with a way back to the list", async ({ page }) => {
    await page.click('[data-fa-harness-config="cat-harness"]');
    const p = panel(page);
    await expect(p.locator(".fa-hc-list")).toBeHidden();
    await p.locator(".fa-hc-back").click();
    await expect(p.locator(".fa-hc-list")).toBeVisible();
    await expect(p.locator(".fa-hc-detail")).toBeHidden();
  });
});
