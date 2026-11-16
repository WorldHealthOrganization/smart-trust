/**
 * THE GLASS, FINISHED ENOUGH TO USE — bean `zrvt`, issue #1006.
 *
 * Owner, 2026-09-23, with the glass pulled down over the who-iris library:
 *
 * > how do i get stuff from library onto glass? same w/ todos. where are the
 * > todo, fsh guts etc tiles on bottom of glass? … also tile to change folio
 * > settings … should be able to set opactiy.
 *
 * > library items need avatar (book's) which should use the cover
 *
 * > oh it was there, hard to see -- buried on RHS … when it went to glass, no
 * > avatar very hard to read. start with the glass being 20% opaque with a
 * > blur effect.
 *
 * Every spec below answers one of those sentences, on a REPLICA page — no
 * `<main>`, no sidebar, no `fa-tiles` meta, no `fa-todo-src` meta — because
 * that is where the owner was standing when they asked.
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

const COVER = "/library/who-iris/book-cover.png";
// A 1x1 PNG, so "the cover loaded" is a real image load, not a stub.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** A library table WIDER than the viewport — the shape that hid the control. */
const REPLICA = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${CSS}</style></head><body>
<table style="width:3000px"><tbody>
<tr data-fa-library-item="who-iris/book" data-fa-library-title="A handbook"
    data-fa-library-href="/lib.html#book" data-fa-library-avatar="${COVER}">
  <td data-fa-pullout-host>book</td><td>A handbook</td><td>far right</td></tr>
<tr data-fa-library-item="who-iris/nocover" data-fa-library-title="No cover here"
    data-fa-library-avatar="/library/who-iris/missing.png">
  <td>nocover</td><td>No cover here</td><td>far right</td></tr>
</tbody></table>
<script>${JS}</script></body></html>`;

const TILES = [
  { id: "fsh-guts", directory: "fsh-guts", title: "fsh-guts", ref: "x", href: "/fsh-guts/",
    surfaces: ["navbar", "board", "glass"], hidden: false },
  { id: "todos", directory: "todos", title: "todos", ref: "x", href: "/todos/",
    surfaces: ["navbar", "board", "glass"], hidden: false },
  { id: "board-only", directory: "board-only", title: "board only", ref: "x", href: "/b/",
    surfaces: ["board"], hidden: false },
];

const TODOS = {
  items: [
    { id: "t-one", summary: "First thing to do" },
    { id: "t-two", summary: "Second thing to do" },
  ],
};

/** The folio's DECLARED zoom — the same shape as `assets/semantic-zoom.json`. */
const ZOOM = { belowPx: 220, byKind: { todo: { belowPx: 300, because: "a todo needs more room" } } };

test.beforeEach(async ({ page }) => {
  // The strip starts HIDDEN on a first open (owner, 2026-10-01). These specs
  // are about what is ON the strip, so they arrive as a reader who has shown
  // it; `glass-strip-default-hidden.e2e.ts` holds the default itself.
  await page.addInitScript(() => {
    try { if (localStorage.getItem("fa-glass-strip-hidden") === null) localStorage.setItem("fa-glass-strip-hidden", "0"); } catch { /* no storage */ }
  });
  await page.route("http://replica.test/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/page.html") return route.fulfill({ contentType: "text/html", body: REPLICA });
    if (url.pathname === "/assets/harness/tiles.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(TILES) });
    }
    if (url.pathname === "/assets/todos/index.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(TODOS) });
    }
    if (url.pathname === "/assets/semantic-zoom.json") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(ZOOM) });
    }
    if (url.pathname === COVER) return route.fulfill({ contentType: "image/png", body: PNG });
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto("http://replica.test/page.html");
  await page.waitForSelector(".fa-glass-handle", { state: "attached" });
});

const layer = ".fa-sticky-layer";
const handle = ".fa-glass-handle";
const open = async (page: Page) => {
  await page.click(handle);
  await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
};
const shut = async (page: Page) => {
  await page.click(handle);
  await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "closed");
};

test.describe("the glass starts 20% opaque, blurred", () => {
  test("the owner's default: glass theme, 0.2, blur on", async ({ page }) => {
    await open(page);
    const l = page.locator(layer);
    await expect(l).toHaveAttribute("data-fa-glass-theme", "glass");
    await expect(l).toHaveAttribute("data-fa-glass-blur", "on");
    const bg = await l.evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(bg).toMatch(/rgba\(\s*20,\s*20,\s*24,\s*0\.2\s*\)/);
    const blur = await l.evaluate((n) => getComputedStyle(n).backdropFilter);
    expect(blur).toContain("blur");
  });
});

test.describe("library → glass: the control is where the eye starts", () => {
  test("the pull-out is in the FIRST cell and on screen, not past the right edge", async ({ page }) => {
    const btn = page.locator('[data-fa-library-item="who-iris/book"] .fa-pullout');
    await expect(btn).toBeVisible();
    // In the first cell — the declared host.
    expect(await btn.evaluate((b) => b.closest("td")?.cellIndex)).toBe(0);
    // Inside the viewport without any horizontal scroll.
    const box = await btn.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
  });

  test("a row with no declared host still gets its FIRST cell", async ({ page }) => {
    const btn = page.locator('[data-fa-library-item="who-iris/nocover"] .fa-pullout');
    expect(await btn.evaluate((b) => b.closest("td")?.cellIndex)).toBe(0);
  });

  test("pulled out, the book shows its COVER on a solid, readable card", async ({ page }) => {
    await page.click('[data-fa-library-item="who-iris/book"] .fa-pullout');
    await open(page);
    const card = page.locator('.fa-glass-asset[data-fa-asset="who-iris/book"]');
    await expect(card).toBeVisible();
    const img = card.locator(".fa-glass-avatar img");
    await expect(img).toHaveAttribute("src", COVER);
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    // "very hard to read": the card is opaque whatever the glass is.
    const bg = await card.evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(bg).not.toMatch(/rgba\(.*,\s*0(\.\d+)?\)/);
    expect(bg).not.toBe("transparent");
  });

  test("a cover that fails to load becomes the KIND avatar, never a broken image", async ({ page }) => {
    await page.click('[data-fa-library-item="who-iris/nocover"] .fa-pullout');
    await open(page);
    const card = page.locator('.fa-glass-asset[data-fa-asset="who-iris/nocover"]');
    await expect(card.locator('.fa-avatar[data-fa-kind="library"]')).toBeAttached();
    await expect(card.locator("img")).toHaveCount(0);
  });
});

test.describe("the tile strip along the glass's bottom edge", () => {
  test("with no strip declared, the strip holds the glass's own Todos and Settings, then More", async ({ page }) => {
    // This replica serves no `glass-strip.json`, so nothing declared a strip:
    // the page pins its own chrome and never guesses which graphs matter
    // (bean `ob3m` finding 10 — the pinned set is DECLARED).
    await open(page);
    const strip = page.locator(".fa-glass-tiles");
    await expect(strip).toBeVisible();
    const ids = await strip.locator("[data-fa-glass-chrome]").evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-fa-glass-chrome")));
    expect(ids).toEqual(["glass-todos", "glass-settings", "glass-more"]);
    await expect(strip.locator("[data-fa-tile]")).toHaveCount(0);
  });

  test("More lists the declared glass tiles — from the published list", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-more"]');
    const more = page.locator(".fa-glass-more");
    await expect(more.locator('[data-fa-tile="fsh-guts"]')).toBeVisible();
    // Filtered to the glass surface, and the declared `todos` is not drawn twice.
    await expect(more.locator('[data-fa-tile="board-only"]')).toHaveCount(0);
    await expect(more.locator('[data-fa-tile="todos"]')).toHaveCount(0);
    await expect(page.locator(".fa-glass-panel-status")).toHaveText("1 visualisation.");
  });

  test("the strip sits on the BOTTOM edge", async ({ page }) => {
    await open(page);
    const strip = page.locator(".fa-glass-tiles");
    // At the BOTTOM edge.
    const box = await strip.boundingBox();
    const vh = page.viewportSize()!.height;
    expect(Math.round(box!.y + box!.height)).toBe(vh);
  });
});

test.describe("todos → glass", () => {
  test("the Todos tile lists them, and one pulled out lands on the glass with a todo avatar", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-todos"]');
    await expect(page.locator('[data-fa-glass-chrome="glass-todos"]')).toHaveAttribute("aria-expanded", "true");
    const row = page.locator('[data-fa-library-item="todo/t-one"]');
    await expect(row).toBeVisible();
    await row.locator(".fa-pullout").click();
    const card = page.locator('.fa-glass-asset[data-fa-asset="todo/t-one"]');
    await expect(card).toBeVisible();
    // A STICKY NOTE, not the thin outline glyph — owner, 2026-09-23: *"todos
    // should have stick note avatar"* (bean `b8eq`).
    await expect(card.locator('.fa-sticky-note-avatar[data-fa-kind="todos"]')).toBeVisible();
    // The row now says where it is, and offers no second close.
    await expect(row.locator(".fa-pullout-state")).toHaveText("On your folio glass");
  });

  test("Escape closes the panel first, then the glass", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-todos"]');
    await expect(page.locator(".fa-glass-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".fa-glass-panel")).toBeHidden();
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
    await page.keyboard.press("Escape");
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "closed");
  });
});

test.describe("the Settings tile", () => {
  test("a usability theme brings its own opacity, and it persists", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await page.check("#fa-glass-theme-contrast");
    const l = page.locator(layer);
    await expect(l).toHaveAttribute("data-fa-glass-theme", "contrast");
    await expect(page.locator(".fa-glass-opacity-value")).toHaveText("100%");
    await page.reload();
    await page.waitForSelector(".fa-glass-handle", { state: "attached" });
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass-theme", "contrast");
  });

  test("opacity steps with large buttons, not only a slider", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await page.click('button[aria-label="More opaque"]');
    await expect(page.locator(".fa-glass-opacity-value")).toHaveText("30%");
    const bg = await page.locator(layer).evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(bg).toMatch(/,\s*0\.3\s*\)/);
    await page.click('button[aria-label="Less opaque"]');
    await page.click('button[aria-label="Less opaque"]');
    await expect(page.locator(".fa-glass-opacity-value")).toHaveText("10%");
  });

  test("avatar style: text only removes every picture from the glass", async ({ page }) => {
    await page.click('[data-fa-library-item="who-iris/book"] .fa-pullout');
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await page.check("#fa-glass-avatars-text");
    await expect(page.locator(".fa-glass-asset .fa-glass-avatar")).toHaveCount(0);
    await page.check("#fa-glass-avatars-kinds");
    const card = page.locator('.fa-glass-asset[data-fa-asset="who-iris/book"]');
    await expect(card.locator('.fa-avatar[data-fa-kind="library"]')).toBeAttached();
    await expect(card.locator("img")).toHaveCount(0);
  });

  test("the glass is jewelled per theme, and High contrast stays plain", async ({ page }) => {
    // Owner, 2026-09-24: "Mix, per theme". Each glass theme paints its own
    // purple pattern behind the cards; the usability theme paints none.
    await open(page);
    const pattern = () =>
      page.locator(layer).evaluate((n) => getComputedStyle(n, "::before").backgroundImage);
    expect(await pattern()).toContain("conic-gradient"); // amethyst facets, the default
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await page.check("#fa-glass-theme-rose");
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass-theme", "rose");
    expect(await pattern()).toContain("repeating-conic-gradient"); // the leaded rose
    await page.check("#fa-glass-theme-leaded");
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass-theme", "leaded");
    expect(await pattern()).toContain("linear-gradient");
    await page.check("#fa-glass-theme-contrast");
    expect(await pattern()).toBe("none");
  });

  test("the pattern follows the reader's opacity", async ({ page }) => {
    await open(page);
    const op = () => page.locator(layer).evaluate((n) => Number(getComputedStyle(n, "::before").opacity));
    const at20 = await op();
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await page.click('button[aria-label="More opaque"]');
    expect(await op()).toBeGreaterThan(at20);
  });

  test("the default can be restored in one press", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await page.check("#fa-glass-theme-paper");
    await page.click(".fa-glass-defaults");
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass-theme", "glass");
    await expect(page.locator(".fa-glass-opacity-value")).toHaveText("20%");
  });

  test("closing the glass closes its panel, so it reopens clean", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await shut(page);
    await open(page);
    await expect(page.locator(".fa-glass-panel")).toBeHidden();
  });
});

test.describe("cards on the glass move, resize and zoom — the glass is a surface", () => {
  const book = '.fa-glass-asset[data-fa-asset="who-iris/book"]';
  const pull = async (page: Page) => {
    await page.click('[data-fa-library-item="who-iris/book"] .fa-pullout');
    await open(page);
    await expect(page.locator(book)).toBeVisible();
  };
  const leftOf = (page: Page) => page.locator(book).evaluate((n) => parseFloat((n as HTMLElement).style.left));
  const widthOf = (page: Page) => page.locator(book).evaluate((n) => parseFloat((n as HTMLElement).style.width));

  test("the keyboard moves a card: Move, then arrows, then Escape", async ({ page }) => {
    await pull(page);
    const before = await leftOf(page);
    await page.locator(`${book} [data-fa-control="move"]`).click();
    await expect(page.locator(book)).toHaveAttribute("data-fa-moving", "true");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect(await leftOf(page)).toBe(before + 32);
    await page.keyboard.press("Escape");
    await expect(page.locator(book)).toHaveAttribute("data-fa-moving", "false");
    // Escape left MOVE MODE, not the glass.
    await expect(page.locator(layer)).toHaveAttribute("data-fa-glass", "open");
  });

  test("where a card was put survives a reload", async ({ page }) => {
    await pull(page);
    const before = await leftOf(page);
    await page.locator(`${book} [data-fa-control="move"]`).click();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await page.reload();
    await page.waitForSelector(handle, { state: "attached" });
    await open(page);
    expect(await leftOf(page)).toBe(before + 16);
  });

  test("a drag moves it too — the accelerator, over the keyboard path", async ({ page }) => {
    await pull(page);
    const box = (await page.locator(`${book} .fa-glass-avatar`).boundingBox())!;
    // The avatar is INSIDE its own card. A 112px card once drew a 78px cover
    // over its top edge, clipped, and a press on the cover missed the card.
    const card = (await page.locator(book).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(card.y);
    expect(box.y + box.height).toBeLessThanOrEqual(card.y + card.height);
    const before = await leftOf(page);
    // The MIDDLE of the cover. Since the cover fills the card, its top-left
    // corner is under the title link — and a drag deliberately never starts
    // on a link, so that a press on the title opens the book.
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 4 });
    await page.mouse.up();
    expect(await leftOf(page)).toBe(before + 60);
  });

  test("a press on the TITLE is not a drag — the title stays a link", async ({ page }) => {
    await pull(page);
    const name = (await page.locator(`${book} .fa-glass-asset-name`).boundingBox())!;
    const before = await leftOf(page);
    await page.mouse.move(name.x + 5, name.y + 5);
    await page.mouse.down();
    await page.mouse.move(name.x + 65, name.y + 45, { steps: 4 });
    await page.mouse.up();
    expect(await leftOf(page)).toBe(before);
  });

  test("its own − shrinks it, and below the DECLARED width it zooms to its avatar", async ({ page }) => {
    // Owner, 2026-10-05: *"Only the plus minus"* — the card's own buttons.
    await pull(page);
    const card = page.locator(book);
    await expect(card).toHaveAttribute("data-fa-zoom", "card");
    await expect(card.locator(".fa-glass-asset-name")).toBeVisible();
    const w = await widthOf(page);
    await card.locator('button[aria-label="Make A handbook smaller"]').click();
    expect(await widthOf(page)).toBe(w - 48);
    // 288 → 240 → 192: 192 is below the declared 220.
    await card.locator('button[aria-label="Make A handbook smaller"]').click();
    await expect(card).toHaveAttribute("data-fa-zoom", "avatar");
    await expect(card.locator(".fa-glass-asset-name")).toBeHidden();
    await expect(card.locator(".fa-glass-avatar img")).toBeVisible();
    // The name is still the card's accessible name.
    await expect(card).toHaveAttribute("aria-label", "A handbook");
    await card.locator('button[aria-label="Make A handbook larger"]').click();
    await expect(card).toHaveAttribute("data-fa-zoom", "card");
  });

  test("a todo starts wide enough for ITS declared threshold, so it starts with words", async ({ page }) => {
    await open(page);
    await page.click('[data-fa-glass-chrome="glass-todos"]');
    await page.locator('[data-fa-library-item="todo/t-one"] .fa-pullout').click();
    const card = page.locator('.fa-glass-asset[data-fa-asset="todo/t-one"]');
    await expect(card).toHaveAttribute("data-fa-zoom", "card");
    const w = await card.evaluate((n) => parseFloat((n as HTMLElement).style.width));
    expect(w).toBeGreaterThanOrEqual(300);
  });

  test("Tidy puts every card back in the grid, and nothing leaves the glass", async ({ page }) => {
    await pull(page);
    const home = await leftOf(page);
    await page.locator(`${book} [data-fa-control="move"]`).click();
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    expect(await leftOf(page)).toBe(home + 80);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await page.click(".fa-glass-tidy");
    await expect(page.locator(book)).toBeVisible();
    expect(await leftOf(page)).toBe(home);
  });
});

test.describe("the book's cover COVERS its card — owner: \"artefact avatar should cover sheet\"", () => {
  test("the avatar fills the whole card, and the title rides above it", async ({ page }) => {
    await page.click('[data-fa-library-item="who-iris/book"] .fa-pullout');
    await open(page);
    const card = page.locator('.fa-glass-asset[data-fa-asset="who-iris/book"]');
    const c = (await card.boundingBox())!;
    const a = (await card.locator(".fa-glass-avatar").boundingBox())!;
    expect(Math.abs(a.width - c.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.height - c.height)).toBeLessThanOrEqual(2);
    // A book card starts portrait, the shape of a cover.
    expect(c.height).toBeGreaterThan(c.width);
    // The title is painted above the picture and has its own solid strip.
    const z = await card.locator(".fa-glass-asset-name").evaluate((n) => getComputedStyle(n).zIndex);
    expect(Number(z)).toBeGreaterThan(0);
    await expect(card.locator(".fa-glass-asset-name")).toBeVisible();
  });
});

test.describe("the browser-only note can be dismissed, and brought back", () => {
  const note = ".fa-glass-sheet .fa-glass-local-note:not(.fa-glass-settings-note)";
  test("it says no save tool is enabled", async ({ page }) => {
    await page.click('[data-fa-library-item="who-iris/book"] .fa-pullout');
    await open(page);
    await expect(page.locator(note)).toContainText("No \u201Csave\u201D tool is currently enabled.");
  });

  test("dismissed, it stays gone across a reload; Settings shows it again", async ({ page }) => {
    await page.click('[data-fa-library-item="who-iris/book"] .fa-pullout');
    await open(page);
    await page.click(".fa-glass-note-dismiss");
    await expect(page.locator(note)).toHaveCount(0);
    await page.reload();
    await page.waitForSelector(handle, { state: "attached" });
    await open(page);
    await expect(page.locator(note)).toHaveCount(0);
    await page.click('[data-fa-glass-chrome="glass-settings"]');
    await page.click(".fa-glass-note-restore");
    await expect(page.locator(note)).toHaveCount(1);
  });
});


test.describe("linking an external document on the glass (bean 95sk, R28)", () => {
  test("Link a document opens the link panel, previews the CLI command, and places the linked card on the glass", async ({ page }) => {
    await open(page);
    const btn = page.locator('[data-fa-glass-action="link-document"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator(".fa-glass-panel")).toHaveAttribute("data-fa-panel", "glass-link-document");

    await page.fill("#fa-glass-link-url", "https://example.org/smart-dak");
    await page.fill("#fa-glass-link-title", "SMART DAK Spec");
    await expect(page.locator("[data-fa-link-command]")).toContainText(
      'bun run cat folio:create --link "https://example.org/smart-dak" --slug smart-dak-spec --title "SMART DAK Spec"',
    );

    await page.click(".fa-glass-link-submit");
    const card = page.locator('.fa-glass-asset[data-fa-asset="linked/smart-dak-spec"]');
    await expect(card).toBeVisible();
    await expect(card.locator("a.fa-glass-asset-name")).toHaveAttribute("href", "https://example.org/smart-dak");
    await expect(page.locator('.fa-glass-linked-list [data-fa-library-item="linked/smart-dak-spec"] .fa-pullout-state')).toHaveText(
      "On your folio glass",
    );
  });
});
