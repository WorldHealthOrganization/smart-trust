import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { resolveChromium } from "../scripts/playwright-chromium";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { ensureThemesCss } from "./support/themes-css.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * A LIBRARY CARD ON THE GLASS OPENS, SIZES BY ITS CORNER, AND × ASKS FIRST —
 * issue #1900, owner rulings 2026-10-02 (verbatim):
 *
 * > as will all library assets in folio, i cant click to open/view them
 * > is [+] icon anything differfent then just drag and drop? do we need icon? remove if not needed
 * > [x] should confirm returning back to library and tell them which library in case they need again.
 * > Title in popup is right but not avatar...
 * > i also expected to be able to click on "smart-trust" slug and open up the visualizer for
 * > smart-trust (which is what i would expect also when opening the avatar on the folio glass)
 *
 * One describe per ruling. Opening is measured by the request the browser
 * makes for the target page, which the route below records and answers.
 */
test.use({
  launchOptions: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: resolveChromium(process.env as Record<string, string | undefined>).path,
  },
});

const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const THEMES = readFileSync(ensureThemesCss(ROOT), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const ART = readFileSync(overlayPath(join(ROOT, SITE, "assets/img/harness/landing-library-card.webp")));

const GLASS = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Glass</title>
<style>${CSS}</style><style>${THEMES}</style></head><body><main><p>A page.</p></main>
<script>${JS}</script></body></html>`;

const STYLE_KEY = "who-iris/9789240081949-eng";
const TRUST_KEY = "smart-base/smart-trust";
const LIBRARY = {
  entries: [
    // The issue's own case: the row was stored as "Abies", the index knows better.
    { id: "9789240081949-eng", instance: "who-iris", title: "WHO editorial style manual" },
    // An asset with a VISUALIZER of its own.
    { id: "smart-trust", instance: "smart-base", title: "SMART Trust", view: "/smart-trust/" },
  ],
};
const ZOOM = { belowPx: 220 };

const style = `.fa-glass-asset[data-fa-asset="${STYLE_KEY}"]`;
const trust = `.fa-glass-asset[data-fa-asset="${TRUST_KEY}"]`;
// A LANDING STICKY pinned to the glass (#1926's `kind: "sticky"`): it goes
// back to the page it was pinned from, never to "your Todos".
const NOTE_KEY = "landing/welcome";
const note = `.fa-glass-asset[data-fa-asset="${NOTE_KEY}"]`;

async function serveGlass(page: Page, stripHidden = "0"): Promise<string[]> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(([a, b, c, hidden]) => {
    try {
      // #1819 hides the tile strip by default; these specs must hold with it
      // shown (and the confirm must not depend on it either way).
      localStorage.setItem("fa-glass-strip-hidden", hidden);
      if (!localStorage.getItem("fa-folio-assets")) {
        localStorage.setItem("fa-folio-assets", JSON.stringify({
          [a]: { shown: true, title: "Abies", href: "", avatar: "/assets/cover.webp", kind: "library",
                 geom: { left: 20, top: 20, width: 288, height: 384 } },
          [b]: { shown: true, title: "smart-trust", href: "", avatar: "", kind: "library",
                 geom: { left: 340, top: 20, width: 288, height: 384 } },
          [c]: { shown: true, title: "Welcome to the folio", href: "/home.html", label: "Home page",
                 kind: "sticky", text: "Start here.", geom: { left: 660, top: 20, width: 240, height: 240 } },
        }));
      }
    } catch { /* storage blocked: the spec fails visibly below */ }
  }, [STYLE_KEY, TRUST_KEY, NOTE_KEY, stripHidden]);
  const opened: string[] = [];
  await page.route("http://replica.test/**", (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: GLASS });
    if (url.pathname === "/assets/library/index.json") return json(LIBRARY);
    if (url.pathname === "/assets/semantic-zoom.json") return json(ZOOM);
    if (url.pathname === "/assets/todos/index.json") return json({ items: [] });
    if (url.pathname === "/assets/cover.webp") return route.fulfill({ contentType: "image/webp", body: ART });
    if (route.request().isNavigationRequest()) {
      opened.push(url.pathname + url.hash);
      return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Opened</title><p>opened</p>" });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto("http://replica.test/page.html");
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  await page.click(".fa-glass-handle");
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
  await expect(page.locator(style)).toBeVisible();
  // The index has answered once the caption is the index's title.
  await expect(page.locator(`${style} .fa-glass-asset-name`)).toHaveText("WHO editorial style manual");
  return opened;
}
const width = (page: Page, sel: string) =>
  page.locator(sel).evaluate((n) => parseFloat((n as HTMLElement).style.width));

test.describe("open — a library card opens its visualizer, or its entry page", () => {
  test("a click on the cover opens the entry page when the entry declares no visualizer", async ({ page }) => {
    const opened = await serveGlass(page);
    const box = (await page.locator(`${style} .fa-glass-avatar`).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => opened).toEqual(["/cat-harness/library/who-iris/9789240081949-eng/"]);
  });

  test("a click opens the declared `view` — the smart-trust visualizer", async ({ page }) => {
    const opened = await serveGlass(page);
    await expect(page.locator(trust)).toHaveAttribute("data-fa-opens", "/smart-trust/");
    const box = (await page.locator(trust).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => opened).toEqual(["/smart-trust/"]);
  });

  test("Enter on the focused card opens it", async ({ page }) => {
    const opened = await serveGlass(page);
    await page.locator(style).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => opened).toEqual(["/cat-harness/library/who-iris/9789240081949-eng/"]);
  });

  test("a drag is a move, not an open; a press on a tool is the tool's", async ({ page }) => {
    const opened = await serveGlass(page);
    const box = (await page.locator(`${style} .fa-glass-avatar`).boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 30, { steps: 4 });
    await page.mouse.up();
    await page.locator(`${style} [data-fa-control="move"]`).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    expect(opened).toEqual([]);
  });
});

test.describe("resize — only the card's − and + (owner, 2026-10-05)", () => {
  test("the card carries − and +, and no corner grip", async ({ page }) => {
    await serveGlass(page);
    await expect(page.locator(`${style} button[aria-label$=" smaller"]`)).toHaveCount(1);
    await expect(page.locator(`${style} button[aria-label$=" larger"]`)).toHaveCount(1);
    await expect(page.locator(`${style} .fa-glass-asset-resize`)).toHaveCount(0);
  });

  test("+ grows it and − shrinks it, says so, and the size is kept", async ({ page }) => {
    await serveGlass(page);
    const card = page.locator(style);
    const w0 = await width(page, style);
    await card.locator('[data-fa-size="larger"]').click();
    expect(await width(page, style)).toBe(w0 + 48);
    await expect(card.locator('.fa-sr-only[aria-live="polite"]')).toContainText("Size " + (w0 + 48));
    await card.locator('[data-fa-size="smaller"]').click();
    await card.locator('[data-fa-size="smaller"]').click();
    expect(await width(page, style)).toBe(w0 - 48);
    const stored = await page.evaluate((k) =>
      JSON.parse(localStorage.getItem("fa-folio-assets") || "{}")[k].geom.width, STYLE_KEY);
    expect(stored).toBe(w0 - 48);
  });

  test("in move mode the keys only move: + / − and Shift+arrows do not resize", async ({ page }) => {
    await serveGlass(page);
    const card = page.locator(style);
    const w0 = await width(page, style);
    await card.locator('[data-fa-control="move"]').click();
    await expect(card).toHaveAttribute("data-fa-moving", "true");
    await page.keyboard.press("+");
    await page.keyboard.press("-");
    await page.keyboard.press("Shift+ArrowRight");
    expect(await width(page, style)).toBe(w0);
    const left0 = await card.evaluate((n) => parseFloat((n as HTMLElement).style.left));
    await page.keyboard.press("ArrowRight");
    expect(await card.evaluate((n) => parseFloat((n as HTMLElement).style.left))).toBe(left0 + 16);
    // The move bar offers moves, not sizes.
    await expect(page.locator(".fa-glass-move-bar [data-fa-size]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(card).toHaveAttribute("data-fa-moving", "false");
  });
});

test.describe("close — × confirms, names the library, and links it", () => {
  test("× shows a confirm naming the library; Cancel keeps the card", async ({ page }) => {
    await serveGlass(page);
    await page.locator(`${style} .fa-glass-asset-close`).click();
    const dlg = page.getByRole("dialog", { name: "Back to the library?" });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("Put “WHO editorial style manual” back in the who-iris library? It stays in your folio.");
    await expect(dlg.getByRole("link", { name: "the who-iris library" }))
      .toHaveAttribute("href", "/cat-harness/library/who-iris/");
    await expect(dlg.getByRole("link", { name: "its entry" }))
      .toHaveAttribute("href", "/cat-harness/library/who-iris/9789240081949-eng/");
    // Focus is on the safe choice, and stays inside the dialog.
    await expect(dlg.getByRole("button", { name: "Keep it on the glass" })).toBeFocused();
    const { violations } = await new AxeBuilder({ page })
      .include(".fa-glass-confirm")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ` + v.nodes.map((n) => n.failureSummary ?? n.html).join(" | "))).toEqual([]);
    await dlg.getByRole("button", { name: "Keep it on the glass" }).click();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator(style)).toBeVisible();
    await expect(page.locator(`${style} .fa-glass-asset-close`)).toBeFocused();
  });

  test("Escape cancels the confirm and leaves the glass open", async ({ page }) => {
    await serveGlass(page);
    await page.locator(`${style} .fa-glass-asset-close`).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
    await expect(page.locator(style)).toBeVisible();
  });

  test("Confirm shelves it, and says where it went with the same link", async ({ page }) => {
    await serveGlass(page);
    await page.locator(`${style} .fa-glass-asset-close`).click();
    await page.getByRole("button", { name: "Put it back" }).click();
    await expect(page.locator(style)).toHaveCount(0);
    const say = page.getByRole("status").filter({ hasText: "is back in" });
    await expect(say).toHaveText("“WHO editorial style manual” is back in the who-iris library — it stays in your folio.");
    await expect(say.getByRole("link")).toHaveAttribute("href", "/cat-harness/library/who-iris/");
    // The middle state: still the reader's, just not on the glass.
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem("fa-folio-assets") || "{}")[k], STYLE_KEY);
    expect(stored.shown).toBe(false);
    const { violations } = await new AxeBuilder({ page })
      .include(".fa-glass-sheet")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ` + v.nodes.map((n) => n.failureSummary ?? n.html).join(" | "))).toEqual([]);
  });

  test("a landing sticky's × names ITS PAGE, not the library and not your Todos", async ({ page }) => {
    await serveGlass(page);
    const close = page.locator(`${note} .fa-glass-asset-close`);
    await expect(close).toHaveAttribute("aria-label",
      "Put Welcome to the folio back on its page, Home page — it stays in your folio");
    await close.click();
    const dlg = page.getByRole("dialog", { name: "Back on its page?" });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("Put “Welcome to the folio” back on its page, Home page? It stays in your folio.");
    await expect(dlg).not.toContainText("Todos");
    await expect(dlg.getByRole("link", { name: "its page, Home page" })).toHaveAttribute("href", "/home.html");
    await expect(dlg.getByRole("button", { name: "Keep it on the glass" })).toBeFocused();
    await dlg.getByRole("button", { name: "Put it back" }).click();
    await expect(page.locator(note)).toHaveCount(0);
    const say = page.getByRole("status").filter({ hasText: "is back on" });
    await expect(say).toHaveText("“Welcome to the folio” is back on its page, Home page — it stays in your folio.");
  });

  test("the confirm works with the tile strip hidden too", async ({ page }) => {
    await serveGlass(page, "1");
    await page.locator(`${style} .fa-glass-asset-close`).click();
    await page.getByRole("button", { name: "Put it back" }).click();
    await expect(page.locator(style)).toHaveCount(0);
  });
});

test.describe("caption — the index's title wins over a stale stored one", () => {
  test("a row stored as “Abies” shows the index title on the card, its name and gist, and is corrected", async ({ page }) => {
    await serveGlass(page);
    const card = page.locator(style);
    await expect(card.locator(".fa-glass-asset-name")).toHaveText("WHO editorial style manual");
    await expect(card).toHaveAttribute("aria-label", "WHO editorial style manual");
    await expect(card.locator(".fa-glass-asset-gist")).toHaveText("WHO editorial style manual");
    await expect(card.locator('[data-fa-control="move"]'))
      .toHaveAttribute("aria-label", "Move WHO editorial style manual around the glass");
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem("fa-folio-assets") || "{}")[k].title, STYLE_KEY);
    expect(stored).toBe("WHO editorial style manual");
  });
});
