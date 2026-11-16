/**
 * The kind declares its controls; the platform fixes the chrome.
 *
 * Bean `folio-assistant-t4my`, R10 + R7 of issue #602. Owner:
 *
 * > each content type controls its own avatar, visualtion/rendering. but
 * > assume they can open a full screen panel w/ fixed controls like [x] or
 * > [linksrc] or [edit] or what not depedning on conent.
 *
 * ## The three states this file exists to keep apart
 *
 * | | what it means | how a reader sees it |
 * |---|---|---|
 * | not declared | this kind does not offer it | no control |
 * | declared, servable | offered and usable | the control |
 * | declared, unservable | offered, and this node cannot | no control, **and a reason** |
 *
 * A test that only checked "Edit is absent" would pass for the first and the
 * third alike, which is exactly the collapse `pb04` warns about: an `[edit]`
 * the pipeline cannot perform 404s for the one reader who cannot edit, and
 * reads as *"this page is broken"*. So the fixture carries **both** a node
 * with no source and a node with a readable-but-not-writable one, and the
 * hidden set is asserted by name rather than by absence.
 *
 * ## And the model is the reference
 *
 * `docs-ui.js` cannot import `schemas/ui/panel-chrome.ts`, so the two can drift.
 * Same mitigation as `window-stack`: the browser's answer is checked against
 * the model's, case for case, from one fixture.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { controlsFor, servableControls, validateControls } from "../../schemas/ui/panel-chrome.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const base = {
  comment: "Body.",
  status: "open",
  priority: "high",
  origin: "agent",
  createdAt: "2026-09-19",
  tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
  relations: [],
};

const ITEMS = [
  // Everything servable.
  {
    ...base,
    id: "full",
    summary: "Both links",
    targetLabel: "sec:one",
    viewHref: "https://example.invalid/view",
    editHref: "https://example.invalid/edit",
  },
  // Readable, not writable — a public repository a reader cannot push to.
  {
    ...base,
    id: "readonly",
    summary: "View only",
    targetLabel: "sec:one",
    viewHref: "https://example.invalid/view",
  },
  // No source at all: the pipeline had no forge for this node.
  { ...base, id: "bare", summary: "No source", targetLabel: "sec:two" },
];

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}
.fa-sticky-grid { display: grid; grid-template-columns: 600px; }
</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <div class="fa-landing-board"></div>
</div></div>
<script>${JS}</script></body></html>`;

const URL_PAGE = "http://chrome.test/page.html";

test.beforeEach(async ({ page }) => {
  await page.route("http://chrome.test/**", (route) => {
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

async function openCard(page: import("@playwright/test").Page, id: string) {
  await page.waitForFunction(() =>
    Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard),
  );
  // Addressed by id, never by position. The board stacks by BPMN subprocess
  // depth, so DOM order is not the fixture's order — the first version of this
  // helper used `.nth(i)` and opened the wrong card every time.
  await page.locator(`.fa-sticky-avatar[data-fa-opens="${id}"]`).focus();
  await page.keyboard.press("Enter");
  return page.locator(`.fa-board-window[data-fa-window="${id}"]`);
}

/** That card's avatar badge count, or null when it carries none. */
function avatarBadge(page: import("@playwright/test").Page, id: string) {
  return page
    .locator(`.fa-sticky-avatar[data-fa-opens="${id}"] .fa-node-badge`)
    .getAttribute("data-fa-notes");
}

/** The control ids on a panel, in the order the frame placed them. */
async function controlsOn(panel: import("@playwright/test").Locator) {
  return panel
    .locator("[data-fa-control]")
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.faControl));
}

test.describe("the frame is the platform's", () => {
  test("`[x]` is present and FIRST on every panel, whatever the node can serve", async ({ page }) => {
    // The ordering half of "a reader learns the frame once": a control that
    // moves depending on what a node carries is not a fixed control.
    await page.goto(URL_PAGE);
    for (const id of ["full", "readonly", "bare"]) {
      const panel = await openCard(page, id);
      const ids = await controlsOn(panel);
      expect(ids[0], `${id} puts close first`).toBe("close");
    }
  });

  test("no capability answer can take the way out away", async ({ page }) => {
    // `close` needs nothing, so the most impoverished node still has an
    // inverse for opening — `l4zi`.
    await page.goto(URL_PAGE);
    const panel = await openCard(page, "bare");
    await expect(panel.locator('[data-fa-control="close"]')).toHaveCount(1);
    await panel.locator('[data-fa-control="close"]').click();
    await expect(page.locator('.fa-board-window[data-fa-window="bare"]')).toHaveCount(0);
  });
});

test.describe("declared and unservable is a THIRD state, not absence", () => {
  test("a node with no source hides View and Edit, and SAYS which", async ({ page }) => {
    // Asserted by name. "Edit is absent" alone would pass for a kind that
    // never offered it, which is the collapse this whole file is about.
    await page.goto(URL_PAGE);
    const panel = await openCard(page, "bare");
    expect(await controlsOn(panel)).toEqual(["close", "move", "pin", "discard", "relocate"]);
    await expect(panel).toHaveAttribute("data-fa-hidden-controls", "view edit");
  });

  test("a readable-but-not-writable node shows View and hides only Edit", async ({ page }) => {
    // The two capabilities are separate, and one board serves both cases —
    // which is why the gate is per node rather than per deployment.
    await page.goto(URL_PAGE);
    const panel = await openCard(page, "readonly");
    expect(await controlsOn(panel)).toEqual(["close", "view", "move", "pin", "discard", "relocate"]);
    await expect(panel).toHaveAttribute("data-fa-hidden-controls", "edit");
  });

  test("a fully servable node hides nothing and carries no reason", async ({ page }) => {
    await page.goto(URL_PAGE);
    const panel = await openCard(page, "full");
    expect(await controlsOn(panel)).toEqual([
      "close",
      "view",
      "edit",
      "move",
      "pin",
      "discard",
      "relocate",
    ]);
    await expect(panel).not.toHaveAttribute("data-fa-hidden-controls", /./);
  });

  test("a hidden control is never rendered as a link to nowhere", async ({ page }) => {
    // The `pb04` failure itself: a button that 404s reads as a broken page
    // rather than as something you cannot do.
    await page.goto(URL_PAGE);
    const panel = await openCard(page, "bare");
    const hrefs = await panel
      .locator("a[data-fa-control]")
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")));
    expect(hrefs).toEqual([]);
  });
});

test.describe("the browser's answer is the MODEL's answer", () => {
  test("`controlsFor` + `servableControls` agree, case for case", async ({ page }) => {
    await page.goto(URL_PAGE);
    for (const item of ITEMS) {
      const panel = await openCard(page, item.id);
      const model = servableControls(controlsFor("todo"), {
        "source-read": Boolean(item.viewHref),
        "source-write": Boolean(item.editHref),
      });
      expect(await controlsOn(panel), `shown on ${item.id}`).toEqual(
        model.shown.map((c) => c.id),
      );
      const hidden = (await panel.getAttribute("data-fa-hidden-controls")) ?? "";
      expect(hidden.split(" ").filter(Boolean), `hidden on ${item.id}`).toEqual(
        model.hidden.map((h) => h.control.id),
      );
    }
  });

  test("this repository's declarations are clean, so the fixture is not testing a typo", async () => {
    expect(validateControls()).toEqual([]);
  });
});

test.describe("R7 — the same badge on the avatar and on the open window", () => {
  test("both carry the node's count, and it is the same number", async ({ page }) => {
    // `sec:one` has two notes, `sec:two` has one. One query per card; both
    // surfaces render its answer, so there is no second count to disagree.
    await page.goto(URL_PAGE);
    const panel = await openCard(page, "full");
    const onWindow = await panel.locator(".fa-node-badge").getAttribute("data-fa-notes");
    const onAvatar = await avatarBadge(page, "full");
    expect(onWindow).toBe("2");
    expect(onAvatar).toBe(onWindow);
  });

  test("R5's threshold applies on both surfaces alike", async ({ page }) => {
    // One note: the icon and no number, and the exact count still in the
    // accessible name.
    await page.goto(URL_PAGE);
    const panel = await openCard(page, "bare");
    const badge = panel.locator(".fa-node-badge");
    await expect(badge.locator(".fa-node-badge-count")).toHaveCount(0);
    await expect(badge).toHaveAttribute("aria-label", "1 note on this section");
  });

  test("every avatar's badge matches its own window's", async ({ page }) => {
    await page.goto(URL_PAGE);
    for (const item of ITEMS) {
      const panel = await openCard(page, item.id);
      const w = await panel.locator(".fa-node-badge").getAttribute("data-fa-notes");
      const a = await avatarBadge(page, item.id);
      expect(a, `avatar and window agree for ${item.id}`).toBe(w);
    }
  });
});
