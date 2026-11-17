/**
 * The fishbone asks first, and the dialog does not overstate in either direction.
 *
 * Bean `folio-assistant-db7g`, R11 of issue #602. Owner: *"confrim arctions
 * [fishbones] on open content puts in fsh guts"*, and CRDM Q5: **delete
 * becomes move**. `folio-assistant-core/processes/ui/board-relocate.bpmn` is the drawn process;
 * this is its reader-facing half.
 *
 * ## The failure this file guards, and it cuts both ways
 *
 * `deletion-requires-confirmation` names one: a dialog that says *"remove?"*
 * when it means *"unpublish everywhere"*. The same lie pointed the other way
 * is just as bad, and it is the one THIS surface could tell — a published page
 * cannot move a file in the repository, so a dialog promising "off the site,
 * everywhere" would be describing something that did not happen.
 *
 * So both halves are asserted: the dialog names what the action does, and it
 * names what it does not.
 *
 * ## And nothing goes without the confirm
 *
 * Asserted rather than assumed, which is the bean's own last line. The test
 * that matters is the one where the reader CANCELS and the card is still
 * there — an implementation that acted on click and then asked would pass
 * every assertion about the dialog's words.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { PANEL_CONTROLS, controlsFor } from "../../schemas/ui/panel-chrome.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const ITEMS = ["alpha", "beta"].map((id) => ({
  id,
  summary: `Card ${id}`,
  comment: "Body.",
  status: "open",
  priority: "high",
  origin: "agent",
  createdAt: "2026-09-19",
  tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
  relations: [],
}));

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}
.fa-sticky-grid { display: grid; grid-template-columns: 600px; }
</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <div class="fa-landing-board"></div>
</div></div>
<script>${JS}</script></body></html>`;

const URL_PAGE = "http://fishbone.test/page.html";

test.beforeEach(async ({ page }) => {
  await page.route("http://fishbone.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/page.html")) {
      return route.fulfill({ contentType: "text/html", body: PAGE });
    }
    if (url.endsWith("/assets/todos/index.json")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ $schema: "folio-todo-index/v1", items: ITEMS }),
      });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
});

async function open(page: import("@playwright/test").Page, id: string) {
  await page.waitForFunction(() =>
    Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard),
  );
  await page.locator(`.fa-sticky-avatar[data-fa-opens="${id}"]`).focus();
  await page.keyboard.press("Enter");
  return page.locator(`.fa-board-window[data-fa-window="${id}"]`);
}

test.describe("the control is declared, not invented here", () => {
  test("`relocate` is a known control and `todo` offers it", async () => {
    expect(Object.keys(PANEL_CONTROLS)).toContain("relocate");
    expect(controlsFor("todo").map((c) => c.id)).toContain("relocate");
  });

  test("it appears on the open window, with a worded accessible name", async ({ page }) => {
    // The glyph is the owner's `[fishbones]`; a glyph alone is a guess, so the
    // accessible name carries the words.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    const fish = panel.locator('[data-fa-control="relocate"]');
    await expect(fish).toHaveCount(1);
    await expect(fish).toHaveAttribute("aria-label", /Send to the trashcan/);
  });
});

test.describe("nothing goes without the confirm", () => {
  test("clicking the fishbone asks, and takes nothing yet", async ({ page }) => {
    // The assertion that matters: an implementation that acted on click and
    // then asked would pass every assertion about the dialog's words.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="relocate"]').click();
    await expect(page.locator(".fa-relocate")).toHaveCount(1);
    await expect(page.locator('.fa-sticky-avatar[data-fa-opens="alpha"]')).toHaveCount(1);
  });

  test("cancelling leaves the card exactly where it was", async ({ page }) => {
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="relocate"]').click();
    await page.locator(".fa-relocate-cancel").click();
    await expect(page.locator(".fa-relocate")).toHaveCount(0);
    await expect(page.locator('.fa-sticky-avatar[data-fa-opens="alpha"]')).toHaveCount(1);
    await expect(page.locator('.fa-board-window[data-fa-window="alpha"]')).toHaveCount(1);
  });

  test("Escape is the CANCEL, never the confirm", async ({ page }) => {
    // A dialog whose dismissal performs the action is a dialog that did not
    // ask.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="relocate"]').click();
    await page.locator(".fa-relocate").press("Escape");
    await expect(page.locator(".fa-relocate")).toHaveCount(0);
    await expect(page.locator('.fa-sticky-avatar[data-fa-opens="alpha"]')).toHaveCount(1);
  });

  test("focus lands on the SAFE choice", async ({ page }) => {
    // The reader who hits Enter without reading has left the content where it
    // is, which is the recoverable outcome of the two.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="relocate"]').click();
    await expect(page.locator(".fa-relocate-cancel")).toBeFocused();
  });
});

test.describe("the dialog names the scope, in both directions", () => {
  test("it says what the action DOES, including that it is reversible", async ({ page }) => {
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="relocate"]').click();
    const does = page.locator(".fa-relocate-does");
    await expect(does).toContainText("this browser");
    await expect(does).toContainText("not removed for anyone else");
    await expect(does).toContainText("put it back");
  });

  test("and what it does NOT — the half a reader would otherwise assume", async ({ page }) => {
    // The lie this surface could tell. A published page cannot move a file in
    // the repository, so a dialog promising "off the site, everywhere" would
    // describe something that did not happen.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="relocate"]').click();
    const not = page.locator(".fa-relocate-does-not");
    await expect(not).toContainText("does not move the content out of the folio");
    // The scope the owner settled: reader-local is the whole feature, so the
    // dialog describes a per-reader action rather than promising a repository
    // change that is coming.
    await expect(not).toContainText("control over YOUR view of the board");
    await expect(not).toContainText("made by whoever is editing it");
  });

  test("the subject is NAMED — not 'this item'", async ({ page }) => {
    // `deletion-requires-confirmation` asks for WHAT would go. A dialog that
    // does not say which card is a dialog a reader cannot check.
    await page.goto(URL_PAGE);
    const panel = await open(page, "beta");
    await panel.locator('[data-fa-control="relocate"]').click();
    await expect(page.locator(".fa-relocate-title")).toContainText("Card beta");
  });
});

test.describe("confirming takes ONE path, the one `d1r6` already had", () => {
  test("the card leaves the board and the window closes", async ({ page }) => {
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="relocate"]').click();
    await page.locator(".fa-relocate-confirm").click();
    await expect(page.locator('.fa-board-window[data-fa-window="alpha"]')).toHaveCount(0);
    await expect(page.locator('.fa-sticky-avatar[data-fa-opens="alpha"]')).toHaveCount(0);
    // The other card is untouched: the action's subject is one card.
    await expect(page.locator('.fa-sticky-avatar[data-fa-opens="beta"]')).toHaveCount(1);
  });

  test("it lands in the SAME store the discard control uses", async ({ page }) => {
    // One path, not a second answer. Two stores would be two counts of one
    // thing, and the trashcan tile would have to pick.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="relocate"]').click();
    await page.locator(".fa-relocate-confirm").click();
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fa-discarded-todos") ?? "[]"),
    );
    expect(stored).toEqual(["alpha"]);
  });

  test("and it is reversible — the trashcan is kept, not emptied", async ({ page }) => {
    // `fsh-guts` is "the trashcan that is KEPT": a one-way dismiss would wear
    // the fishbone while breaking the rule the icon stands for.
    await page.goto(URL_PAGE);
    const panel = await open(page, "alpha");
    await panel.locator('[data-fa-control="relocate"]').click();
    await page.locator(".fa-relocate-confirm").click();
    await expect(page.locator('.fa-sticky-avatar[data-fa-opens="alpha"]')).toHaveCount(0);
    await page.evaluate(() => {
      localStorage.setItem("fa-discarded-todos", "[]");
      document.dispatchEvent(new CustomEvent("fa:todos-discarded", { detail: {} }));
    });
    await page.reload();
    await expect(page.locator('.fa-sticky-avatar[data-fa-opens="alpha"]')).toHaveCount(1);
  });
});
