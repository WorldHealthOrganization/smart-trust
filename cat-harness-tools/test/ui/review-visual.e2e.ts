/**
 * The review page's visual renderer (bean 0rxe), driven by the KEYBOARD only:
 * no click, no hover, no drag. The pictures are tiny PNGs served from memory.
 */
import { test, expect, type Page } from "@playwright/test";

import { reviewPageHtml } from "../../scripts/gen-review-page.ts";

const ORIGIN = "http://visual.test";
const at = (file: string, kind: string, index: number) => ({ file, kind, section: "doc/ch::sec:one", index });
// A 1×1 PNG: which picture is shown is read from `src`, not from pixels.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

const JSONS: Record<string, unknown> = {
  "/preview/staging.json": { branch: "b", prUrl: "https://example.org/pull/7", mainSite: "/main" },
  "/preview/changeset.json": {
    $schema: "folio-changeset/v1", folio: "folio", base: { ref: "origin/main", commit: "a" }, head: { ref: "worktree", commit: null },
    summary: { added: 1, removed: 0, changed: 1, unchanged: 0, renamed: 0, prose: 0, manifest: 1, moved: 0 },
    changes: [
      { change: "changed", label: "fig:dose-curve", aspects: ["manifest"], base: at("doc/ch/f.ts", "figure", 0), head: at("doc/ch/f.ts", "figure", 0) },
      { change: "added", label: "tbl:new", head: at("doc/ch/t.ts", "table", 1) },
    ],
  },
  "/preview/visual-diff.json": {
    $schema: "folio-visual-diff/v1", tolerance: 24,
    blocks: {
      "fig:dose-curve": { label: "fig:dose-curve", kind: "figure", changed: 0.123,
        before: { png: "visual/fig_dose-curve.before.png" }, after: { png: "visual/fig_dose-curve.after.png" }, diff: "visual/fig_dose-curve.diff.png" },
      "tbl:new": { label: "tbl:new", kind: "table", changed: null, before: null, after: { png: "visual/tbl_new.after.png" }, diff: null },
    },
  },
};

async function open(page: Page): Promise<void> {
  await page.route(`${ORIGIN}/**`, (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/preview/review/") return route.fulfill({ status: 200, contentType: "text/html", body: reviewPageHtml() });
    if (p in JSONS) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(JSONS[p]) });
    if (p.endsWith(".png")) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}/preview/review/`);
  await page.waitForFunction(() => !document.getElementById("status")!.textContent!.startsWith("Loading"));
}

test.describe("review page: pictures before and after (0rxe)", () => {
  test("a figure opens on pictures, says in words how much changed, and shows the changed pixels first", async ({ page }) => {
    await open(page);
    const fig = page.locator("li").first();
    expect(await fig.locator("select").inputValue()).toBe("visual");
    await expect(fig.locator(".diff-visual .kind")).toHaveText("12.3% of the block's pixels changed.");
    expect(await fig.locator(".diff-visual img").getAttribute("src")).toBe("../visual/fig_dose-curve.diff.png");
    expect(await fig.locator(".diff-visual img").getAttribute("alt")).toBe("fig:dose-curve: changed pixels marked");
  });

  test("the four views are radios: arrow keys move between them, no click or drag", async ({ page }) => {
    await open(page);
    const fig = page.locator("li").first();
    await fig.locator("input[type=radio]").first().focus();
    await page.keyboard.press("ArrowRight");
    expect(await fig.locator(".diff-visual img").getAttribute("src")).toBe("../visual/fig_dose-curve.before.png");
    await page.keyboard.press("ArrowRight");
    expect(await fig.locator(".diff-visual img").getAttribute("src")).toBe("../visual/fig_dose-curve.after.png");
    await page.keyboard.press("ArrowRight");
    await expect(fig.locator(".diff-visual img")).toHaveCount(2);
    const labels = await fig.locator(".visual-modes label").allTextContents();
    expect(labels.map((l) => l.trim())).toEqual(["Changed pixels", "Before", "After", "Both"]);
  });

  test("a new block has no before: it says so, and compares nothing", async ({ page }) => {
    await open(page);
    const tbl = page.locator("li").nth(1);
    await expect(tbl.locator(".diff-visual .kind")).toHaveText("Only one side could be pictured, so nothing is compared.");
    // It opens on the side that WAS pictured, not on the missing one.
    expect(await tbl.locator("input[type=radio]:checked").getAttribute("value")).toBe("after");
    expect(await tbl.locator(".diff-visual img").getAttribute("src")).toBe("../visual/tbl_new.after.png");
    await tbl.locator("input[type=radio]:checked").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tbl.locator(".diff-visual")).toContainText("Not on main: this block is new.");
  });
});
