import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { resolveChromium } from "../scripts/playwright-chromium";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { ensureThemesCss } from "./support/themes-css.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * A CARD ON THE GLASS SAYS WHAT IT IS — owner, 2026-10-01 (issue #1780):
 *
 * > no content in todos... when small should display first text. where is
 * > title of thing from library? hovering should show metadata.
 *
 * Three asks, one spec each:
 *
 *  1. a todo shrunk to its avatar by its OWN − button (not only by the view's
 *     zoom, which `glass-zoom-steady.e2e.ts` covers) shows its first words;
 *  2. a library card zoomed to its cover shows the entry's title — from the
 *     library index, so a row stored under its bare id gets the real one —
 *     clamped to two lines with nothing painted past the ellipsis;
 *  3. hovering OR focusing a card shows its metadata in a popover outside the
 *     scaled shelf, the same facts are the card's accessible description, and
 *     Escape dismisses the popover without putting the glass away.
 *
 * Asks 2 and 3 were seen to FAIL against the branch before this change, and
 * the caption's last assertion against the strip's old bottom padding. Ask 1
 * fails against main before PR #1781 and passes on it: it guards the gist in
 * a state the view-zoom specs do not reach.
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

const ART_PATH = "/assets/img/harness/landing-library-card.webp";
const ART = readFileSync(overlayPath(join(ROOT, SITE, ART_PATH.slice(1))));

const GLASS = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Glass</title>
<style>${CSS}</style><style>${THEMES}</style></head><body><main><p>A page.</p></main>
<script>${JS}</script></body></html>`;

const TODOS = {
  items: [
    {
      id: "t-one",
      summary: "The human-todos page   still says\n'Not built yet'",
      comment: "The page opens **\"Not built yet\"**,   and that is\n\nno longer *true*.",
      status: "in_progress",
      priority: "high",
      theme: "library",
      target: { page: "beans-and-todos", node: "human-todos", label: "sec:beans-and-todos-human-todos" },
      relations: [],
    },
  ],
  themeArt: { library: { card: ART_PATH, laptop: ART_PATH, mobile: ART_PATH } },
};
const LONG_TITLE = "Digital transformation handbook for primary health care: optimizing " +
  "person-centred point of service systems, second edition";
const LIBRARY = {
  entries: [
    {
      id: "9789240093362-eng", instance: "smart-base", title: LONG_TITLE,
      sourceFile: "9789240093362-eng.pdf", pageStart: 1, pageEnd: 98, words: 46772,
      documentClass: "", doi: "", arxiv: "",
    },
  ],
};
const ZOOM = { belowPx: 220, byKind: { todo: { belowPx: 300, because: "a todo needs more room" } } };

const LIB_KEY = "smart-base/9789240093362-eng";
const lib = `.fa-glass-asset[data-fa-asset="${LIB_KEY}"]`;
const themed = '.fa-glass-asset[data-fa-asset="todo/t-one"]';
const pop = ".fa-glass-meta";

async function serveGlass(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // The strip starts HIDDEN on a first open (owner, 2026-10-01, bean `ob3m`
  // finding 10). These specs click a strip tile, so they arrive as a reader
  // who has shown it; `glass-strip-default-hidden.e2e.ts` holds the default.
  await page.addInitScript(() => {
    try { if (localStorage.getItem("fa-glass-strip-hidden") === null) localStorage.setItem("fa-glass-strip-hidden", "0"); } catch { /* no storage */ }
  });
  // The library row was pulled out before this page loaded, and stored — as a
  // real row of an untitled entry is — under its bare id.
  await page.addInitScript((key) => {
    try {
      if (!localStorage.getItem("fa-folio-assets")) {
        localStorage.setItem("fa-folio-assets", JSON.stringify({
          [key]: { shown: true, title: key.split("/")[1], href: "", avatar: "/assets/cover.webp", kind: "library" },
        }));
      }
    } catch { /* storage blocked: the spec fails visibly below */ }
  }, LIB_KEY);
  await page.route("http://replica.test/**", (route) => {
    const url = new URL(route.request().url());
    const json = (b: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(b) });
    if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: GLASS });
    if (url.pathname === "/assets/todos/index.json") return json(TODOS);
    if (url.pathname === "/assets/library/index.json") return json(LIBRARY);
    if (url.pathname === "/assets/semantic-zoom.json") return json(ZOOM);
    if (url.pathname === ART_PATH || url.pathname === "/assets/cover.webp") {
      return route.fulfill({ contentType: "image/webp", body: ART });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto("http://replica.test/page.html");
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  await page.click(".fa-glass-handle");
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
  await page.click('[data-fa-glass-chrome="glass-todos"]');
  await page.locator('[data-fa-library-item="todo/t-one"] .fa-pullout').click();
  await page.click('[data-fa-glass-chrome="glass-todos"]');
  await expect(page.locator(`${themed} .fa-glass-sticky-body`)).toBeAttached();
  await expect(page.locator(lib)).toBeVisible();
}
const zoomOut = async (page: Page, n: number) => {
  for (let i = 0; i < n; i++) await page.click('[data-fa-zoom-control="out"]');
};
/** On-screen font size, the shelf's scale multiplied back in. */
const screenPx = (page: Page, sel: string) => page.locator(sel).evaluate((n) => {
  const shelf = n.closest(".fa-glass-shelf") as HTMLElement;
  return parseFloat(getComputedStyle(n).fontSize) * Number(shelf.getAttribute("data-fa-scale") || 1);
});

test.describe("ask 1 — a todo made small by its own − shows its first words", () => {
  test("shrunk below the todo threshold at 100%, the themed sticky's gist is seen and readable", async ({ page }) => {
    await serveGlass(page);
    const card = page.locator(themed);
    // Its own − (owner, 2026-10-05: only the card's −/+ size it).
    const smaller = card.locator('[data-fa-size="smaller"]');
    for (let i = 0; i < 8 && (await card.getAttribute("data-fa-zoom")) !== "avatar"; i++) await smaller.click();
    await expect(card).toHaveAttribute("data-fa-zoom", "avatar");
    const gist = card.locator(".fa-glass-asset-gist");
    await expect(gist).toBeVisible();
    const seen = (await gist.evaluate((n) => (n as HTMLElement).innerText)).trim();
    expect(seen.startsWith("The human-todos page still says 'Not built yet'")).toBe(true);
    expect(seen).not.toMatch(/\s{2,}|\*/);
    expect(await screenPx(page, `${themed} .fa-glass-asset-gist`)).toBeGreaterThanOrEqual(11);
  });
});

test.describe("ask 2 — a library card zoomed to its cover shows its title", () => {
  test("the index's title captions the cover, two lines at most, legible, nothing past the ellipsis", async ({ page }) => {
    await serveGlass(page);
    await zoomOut(page, 7); // 30%
    const card = page.locator(lib);
    await expect(card).toHaveAttribute("data-fa-zoom", "avatar");
    const gist = card.locator(".fa-glass-asset-gist");
    await expect(gist).toBeVisible();
    // The INDEX's title, not the bare id the row was stored under.
    expect(await gist.textContent()).toBe(LONG_TITLE);
    await expect(card).toHaveAttribute("aria-label", LONG_TITLE);
    const m = await gist.evaluate((n) => {
      const cs = getComputedStyle(n);
      const pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
      return { h: (n as HTMLElement).clientHeight - pt - pb, below: pb,
        lh: parseFloat(cs.lineHeight), clipped: n.scrollHeight > n.clientHeight + 1 };
    });
    // Clamped (the title is longer than two lines at this width) to whole lines…
    expect(m.clipped).toBe(true);
    expect(Math.round(m.h / m.lh)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.h - Math.round(m.h / m.lh) * m.lh)).toBeLessThanOrEqual(1);
    // …and nothing painted past the last one: a clamped box clips at its
    // PADDING edge, so any bottom padding shows the top of the next line
    // (seen on the first render of this caption).
    expect(m.below).toBeLessThanOrEqual(0.5);
    expect(await screenPx(page, `${lib} .fa-glass-asset-gist`)).toBeGreaterThanOrEqual(11);
    // Inside its card.
    const g = (await gist.boundingBox())!;
    const c = (await card.boundingBox())!;
    expect(g.y + g.height).toBeLessThanOrEqual(c.y + c.height + 0.5);
  });

  test("at full size the caption is not drawn — the title strip already says it", async ({ page }) => {
    await serveGlass(page);
    await expect(page.locator(lib)).toHaveAttribute("data-fa-zoom", "card");
    await expect(page.locator(`${lib} .fa-glass-asset-gist`)).toBeHidden();
    await expect(page.locator(`${lib} .fa-glass-asset-name`)).toHaveText(LONG_TITLE);
  });
});

test.describe("ask 3 — hovering or focusing a card shows its metadata", () => {
  test("a library card: title, library, source, pages, words, and an honest note that author and year are not recorded", async ({ page }) => {
    await serveGlass(page);
    await zoomOut(page, 7);
    await expect(page.locator(pop)).toBeHidden();
    await page.locator(lib).hover();
    await expect(page.locator(pop)).toBeVisible();
    const text = (await page.locator(pop).innerText()).replace(/\s+/g, " ");
    for (const want of [LONG_TITLE, "smart-base", "9789240093362-eng.pdf", "1–98", "46,772",
      "Author, year not recorded in the library index"]) {
      expect(text).toContain(want);
    }
    // Drawn at reading size, though the shelf is at 30%.
    expect(parseFloat(await page.locator(pop).evaluate((n) => getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(12);
    // Beside the card, not over it.
    const p = (await page.locator(pop).boundingBox())!;
    const c = (await page.locator(lib).boundingBox())!;
    expect(p.x >= c.x + c.width || p.x + p.width <= c.x).toBe(true);
    // The same facts are the card's accessible description.
    const desc = await page.locator(lib).evaluate((n) =>
      document.getElementById(n.getAttribute("aria-describedby") || "")?.textContent || "");
    expect(desc).toContain(LONG_TITLE);
    expect(desc).toContain("Pages: 1–98");
    // Hoverable (WCAG 1.4.13): the pointer can move onto it and it stays.
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2, { steps: 4 });
    await expect(page.locator(pop)).toBeVisible();
    // Gone when the pointer leaves both.
    await page.mouse.move(5, 700);
    await expect(page.locator(pop)).toBeHidden();
  });

  test("a todo: its whole title, status, priority and the node it is attached to", async ({ page }) => {
    await serveGlass(page);
    await page.locator(themed).hover();
    await expect(page.locator(pop)).toBeVisible();
    const text = (await page.locator(pop).innerText()).replace(/\s+/g, " ");
    expect(text).toContain("The human-todos page still says 'Not built yet'");
    expect(text).toContain("Status in progress");
    expect(text).toContain("Priority high");
    expect(text).toContain("Attached to beans-and-todos › human-todos");
  });

  test("keyboard focus inside a card shows it too, and Escape dismisses it without closing the glass", async ({ page }) => {
    await serveGlass(page);
    await page.mouse.move(5, 700);
    await page.locator(`${lib} [data-fa-control="move"]`).focus();
    await expect(page.locator(pop)).toBeVisible();
    expect(await page.locator(pop).innerText()).toContain(LONG_TITLE);
    await page.keyboard.press("Escape");
    await expect(page.locator(pop)).toBeHidden();
    await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
    // A second Escape is the glass's own again.
    await page.keyboard.press("Escape");
    await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "closed");
  });
});
