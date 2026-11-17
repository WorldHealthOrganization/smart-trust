import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * Every figure can be downloaded as SVG, downloaded as PNG, or copied (#1270).
 *
 * Owner, 2026-09-24: "i want to be able downloade renderd png, src svg or copy
 * to clipboard any diagrmas, suich as the UML ones". The controls live on the
 * same toolbar as zoom, so this drives them the way a reader would: a routed
 * page on one https origin (the clipboard needs a secure context, and the
 * inlining fetch needs the same origin), with the SVG served as a file the
 * page inlines — exactly the UML overview's shape.
 */
const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const ORIGIN = "https://figures.example.test";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect x="20" y="20" width="360" height="260" fill="#6a3d9a"/><text x="40" y="160" fill="#fff">Role</text></svg>`;

/** NO BACKTICKS inside the template — the page is one. */
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>UML overview</title>
<style>body { margin: 0; background: #ffffff; } ${CSS}</style></head><body>
<div class="main"><div class="main-content"><h1>UML</h1>
<figure class="bpmn-figure"><img src="${ORIGIN}/uml/overview/cat-harness.svg" alt="The cat-harness overview."></figure>
</div></div>
<script>${JS}<\/script></body></html>`;

async function open(page: Page): Promise<void> {
  // On the CONTEXT, not the page: "Open ↗" opens a new tab, and a page-level
  // route does not serve it, so the tab would never load the drawing.
  await page.context().route(`${ORIGIN}/**`, (route) => {
    const url = route.request().url();
    if (url.endsWith(".svg")) return route.fulfill({ contentType: "image/svg+xml", body: SVG });
    return route.fulfill({ contentType: "text/html", body: PAGE });
  });
  await page.goto(`${ORIGIN}/uml/overview/`);
  // The toolbar mounts once the <img> has been inlined as an <svg>.
  await expect(page.locator(".bpmn-figure svg")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Download this diagram as SVG" })).toBeVisible();
  // Owner, 2026-11-01: with a mouse the controls float over the figure and
  // take clicks only while the pointer is on it (docs-ui.css, "Figure
  // controls on hover"), so a reader reaches them by moving onto the figure
  // first. Playwright's own click does not, so the pointer goes there here.
  await page.locator(".bpmn-figure").hover();
}

test.describe("figure export — SVG, PNG, clipboard (#1270)", () => {
  test("the three controls are named buttons on the figure's toolbar, reachable by keyboard", async ({ page }) => {
    await open(page);
    for (const name of [
      "Download this diagram as SVG",
      "Download this diagram as PNG",
      "Copy this diagram to the clipboard",
    ]) {
      const b = page.getByRole("button", { name });
      await expect(b).toBeVisible();
      await b.focus();
      await expect(b).toBeFocused();
    }
  });

  test("SVG downloads the drawing, named after its source file, at its own size", async ({ page }) => {
    await open(page);
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download this diagram as SVG" }).press("Enter"),
    ]);
    expect(dl.suggestedFilename()).toBe("cat-harness.svg");
    const text = readFileSync((await dl.path())!, "utf8");
    expect(text).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(text).toContain('width="400"');
    expect(text).toContain("<rect");
    expect(text).not.toContain("data-fa-src");
    await expect(page.getByRole("status")).toHaveText("SVG downloaded");
  });

  test("PNG downloads a real PNG at twice the drawing's size", async ({ page }) => {
    await open(page);
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download this diagram as PNG" }).click(),
    ]);
    expect(dl.suggestedFilename()).toBe("cat-harness.png");
    const bytes = readFileSync((await dl.path())!);
    // The PNG signature, then the IHDR width and height (big-endian at 16 and 20).
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.readUInt32BE(16)).toBe(800);
    expect(bytes.readUInt32BE(20)).toBe(600);
  });

  test("Copy puts an image on the clipboard where the browser allows it, and says which", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
    await open(page);
    await page.getByRole("button", { name: "Copy this diagram to the clipboard" }).click();
    const status = page.getByRole("status");
    await expect(status).toHaveText(/^Copied as (a PNG image|SVG text)/);
    const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types));
    if ((await status.textContent())!.startsWith("Copied as a PNG")) expect(types).toContain("image/png");
    else expect(types).toContain("text/plain");
  });

  test("with no image clipboard, Copy falls back to the SVG text and says so", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
    await page.addInitScript(() => {
      // A browser without ClipboardItem — the fallback path, forced.
      (window as unknown as { ClipboardItem?: unknown }).ClipboardItem = undefined;
    });
    await open(page);
    await page.getByRole("button", { name: "Copy this diagram to the clipboard" }).click();
    await expect(page.getByRole("status")).toHaveText(/^Copied as SVG text/);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("<svg");
    expect(text).toContain("<rect");
  });

  test("Open ↗ is a link to the source SVG file, so a new tab shows the drawing (#915)", async ({ page, context }) => {
    await open(page);
    const link = page.getByRole("link", { name: "Open this diagram in a new tab" });
    await expect(link).toHaveAttribute("href", `${ORIGIN}/uml/overview/cat-harness.svg`);
    await expect(link).toHaveAttribute("target", "_blank");
    // A middle-click and "Open link in new tab" are the BROWSER's handling of
    // a link; what the page owns is not getting in their way. So a middle
    // button's events must reach the link uncancelled.
    const cancelled = await link.evaluate((a) =>
      ["mousedown", "mouseup", "auxclick"].filter((type) => !a.dispatchEvent(new MouseEvent(type, { button: 1, bubbles: true, cancelable: true }))),
    );
    expect(cancelled).toEqual([]);
    // The tab is opened with a plain click. A middle-click opens a BACKGROUND
    // tab, which headless Chromium sometimes never reports as a page, or
    // never navigates (measured 2026-11-13: about 1 in 3 runs under 8
    // workers, against 0 of 25 for a plain click), so it timed the test out.
    // And the tab is waited on by its URL, not its load state: a new tab
    // starts at about:blank, which counts as loaded before the navigation.
    const [tab] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await tab.waitForURL(`${ORIGIN}/uml/overview/cat-harness.svg`);
    expect(await tab.content()).toContain("<rect");
  });

  test("an inline SVG with no file opens as a blob: tab, and the page stays put (#915)", async ({ page, context }) => {
    const inline = PAGE.replace(
      /<figure class="bpmn-figure"><img[^>]*><\/figure>/,
      '<figure class="bpmn-figure"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 400"><circle cx="50" cy="50" r="40"/></svg></figure>',
    );
    await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: "text/html", body: inline }));
    await page.goto(`${ORIGIN}/inline/`);
    const opener = page.getByRole("button", { name: "Open this diagram in a new tab" });
    await opener.focus();
    const [tab] = await Promise.all([context.waitForEvent("page"), page.keyboard.press("Enter")]);
    // By URL, not load state: the tab is about:blank, and "loaded", first.
    await tab.waitForURL(/^blob:/);
    expect(await tab.content()).toContain("<circle");
    expect(page.url()).toBe(`${ORIGIN}/inline/`);
  });
});
