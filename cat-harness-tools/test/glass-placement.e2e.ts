import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.ts";
import { resolveChromium } from "../scripts/playwright-chromium";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { ensureThemesCss } from "./support/themes-css.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * WHERE A CARD FIRST LANDS ON THE GLASS — two leftovers of PR #1781 (issue
 * #1780):
 *
 *  1. Library cards are portrait (288×384) and todos square (324×324). Each
 *     card's default place used to be computed from ITS OWN size alone — a
 *     grid of its own column width and row height — so a mix of the two
 *     landed on top of each other. A card with no saved place must land
 *     clear of every other card, and a card the reader placed must stay
 *     exactly where they put it.
 *  2. A todo whose title carries raw newlines carried them into its card's
 *     button labels; an accessible name is one line, so whitespace collapses
 *     the way `plainGist` collapses it.
 *
 * Both specs were run against the branch before the change and FAILED —
 * the first with overlapping rects, the second with "\n" in the labels.
 */
test.use({
  launchOptions: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: resolveChromium(process.env as Record<string, string | undefined>).path,
  },
});

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const THEMES = readFileSync(ensureThemesCss(ROOT), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const GLASS = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Glass</title>
<style>${CSS}</style><style>${THEMES}</style></head><body><main><p>A page.</p></main>
<script>${JS}</script></body></html>`;

const NEWLINE_TITLE = "The human-todos page   still says\n'Not built yet'\n\tand more";
const TODOS = {
  items: ["t-a", "t-b", "t-c"].map((id) => ({
    id, summary: id === "t-a" ? NEWLINE_TITLE : "Todo " + id, comment: "Some words.",
    status: "todo", priority: "normal", target: { page: "p" }, relations: [],
  })),
  themeArt: {},
};
const ZOOM = { belowPx: 220, byKind: { todo: { belowPx: 300, because: "a todo needs more room" } } };

type Asset = { shown: boolean; title: string; href: string; kind: string; avatar?: string;
  geom?: { left: number; top: number; width: number; height: number } };
/** Interleaved in key order: `a-lib…`, `b-todo…`, `c-lib…`, … so sizes alternate. */
function mixedFolio(): Record<string, Asset> {
  const out: Record<string, Asset> = {};
  for (let i = 0; i < 4; i++) {
    out[`lib${i}/entry-${i}`] = { shown: true, title: `Library entry ${i}`, href: "", kind: "library" };
  }
  out["todo/t-a"] = { shown: true, title: NEWLINE_TITLE, href: "", kind: "todos" };
  out["todo/t-b"] = { shown: true, title: "Todo t-b", href: "", kind: "todos" };
  out["todo/t-c"] = { shown: true, title: "Todo t-c", href: "", kind: "todos" };
  return out;
}

async function serveGlass(page: Page, folio: Record<string, Asset>, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript((f) => {
    try {
      if (!localStorage.getItem("fa-folio-assets")) localStorage.setItem("fa-folio-assets", JSON.stringify(f));
    } catch { /* storage blocked: the spec fails visibly below */ }
  }, folio);
  await page.route("http://replica.test/**", (route) => {
    const url = new URL(route.request().url());
    const json = (b: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(b) });
    if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: GLASS });
    if (url.pathname === "/assets/todos/index.json") return json(TODOS);
    if (url.pathname === "/assets/library/index.json") return json({ entries: [] });
    if (url.pathname === "/assets/semantic-zoom.json") return json(ZOOM);
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto("http://replica.test/page.html");
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
  await page.click(".fa-glass-handle");
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
  await expect(page.locator(".fa-glass-shelf .fa-glass-asset:not(.fa-glass-note-card)"))
    .toHaveCount(Object.values(folio).filter((a) => a.shown).length);
}

/** Every card's geometry in the shelf's own pixels (zoom-independent). */
const geoms = (page: Page) => page.$$eval(".fa-glass-shelf .fa-glass-asset:not(.fa-glass-note-card)", (cs) =>
  cs.map((c) => {
    const s = (c as HTMLElement).style;
    return { key: c.getAttribute("data-fa-asset") || "", kind: c.getAttribute("data-fa-zoom-kind") || "",
      left: parseFloat(s.left), top: parseFloat(s.top), width: parseFloat(s.width), height: parseFloat(s.height) };
  }));

type G = { key: string; left: number; top: number; width: number; height: number };
const overlaps = (gs: G[]) => {
  const bad: string[] = [];
  for (let i = 0; i < gs.length; i++) {
    for (let j = i + 1; j < gs.length; j++) {
      const a = gs[i], b = gs[j];
      if (a.left < b.left + b.width && b.left < a.left + a.width &&
          a.top < b.top + b.height && b.top < a.top + a.height) bad.push(`${a.key} × ${b.key}`);
    }
  }
  return bad;
};

test.describe("1 — first placement does not overlap for mixed sizes", () => {
  for (const width of [1280, 760]) {
    test(`library cards and todos placed together at ${width}px: no two rects intersect`, async ({ page }) => {
      await serveGlass(page, mixedFolio(), width);
      const gs = await geoms(page);
      // The mix is real: both shapes are on the glass.
      expect(new Set(gs.map((g) => `${g.width}x${g.height}`)).size).toBeGreaterThan(1);
      expect(overlaps(gs)).toEqual([]);
      // And as the reader SEES them — the screen rects, at whatever scale.
      const rects = await page.$$eval(".fa-glass-shelf .fa-glass-asset:not(.fa-glass-note-card)", (cs) =>
        cs.map((c) => { const r = c.getBoundingClientRect();
          return { key: c.getAttribute("data-fa-asset") || "", left: r.left, top: r.top, width: r.width, height: r.height }; }));
      expect(overlaps(rects)).toEqual([]);
    });
  }

  test("a card the reader placed stays put, and default cards land clear of it", async ({ page }) => {
    const folio = mixedFolio();
    const placed = { left: 0, top: 0, width: 300, height: 300 };
    folio["lib1/entry-1"].geom = placed;
    await serveGlass(page, folio);
    const gs = await geoms(page);
    const mine = gs.find((g) => g.key === "lib1/entry-1");
    expect(mine && { left: mine.left, top: mine.top, width: mine.width, height: mine.height }).toEqual(placed);
    expect(overlaps(gs)).toEqual([]);
  });
});

test.describe("2 — a todo title's newlines do not reach its button labels", () => {
  test("every label and title on the card's controls is one line, whitespace collapsed", async ({ page }) => {
    await serveGlass(page, mixedFolio());
    const card = page.locator('.fa-glass-asset[data-fa-asset="todo/t-a"]');
    const labels = await card.evaluate((c) => {
      const out: string[] = [c.getAttribute("aria-label") || ""];
      c.querySelectorAll("button, a").forEach((b) => {
        out.push(b.getAttribute("aria-label") || "", b.getAttribute("title") || "");
      });
      return out.filter((s) => s !== "");
    });
    expect(labels.length).toBeGreaterThanOrEqual(5);
    for (const l of labels) {
      expect(l, l).not.toMatch(/[\n\r\t]|\s{2,}/);
    }
    expect(labels.some((l) => l.includes("The human-todos page still says 'Not built yet' and more"))).toBe(true);
    // The move bar names the card too.
    await card.locator('[data-fa-control="move"]').click();
    const bar = await page.$$eval("[aria-label^='Move ']", (ns) => ns.map((n) => n.getAttribute("aria-label") || ""));
    for (const l of bar) expect(l, l).not.toMatch(/[\n\r\t]|\s{2,}/);
  });
});
