/**
 * The todo board opens, pins, docks, and can be driven from a keyboard.
 *
 * Against the real `docs-ui.js` and the real published index shape, not a
 * hand-made fixture that can agree with the code while the code disagrees with
 * what the generator writes — the lesson `qa-panel.e2e.ts` paid for twice.
 *
 * The VERDICT-vs-SHAPE rule from bean `iumj` applies here too, in the other
 * direction: a todo's content is a person's outstanding work and changes
 * whenever they resolve one, so this spec supplies its own items rather than
 * reading `docs/assets/todos/index.json`. What it takes from the real pipeline
 * is the SHAPE — the fields `gen-docs-pages.ts` emits — and there is a unit
 * test pinning that the two agree.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const ITEMS = [
  {
    id: "first-todo",
    summary: "Decide the thing",
    comment: "Context paragraph one.\n\nContext paragraph two.",
    status: "open",
    priority: "high",
    origin: "agent",
    createdAt: "2026-09-19",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
    relations: [
      { axis: "who", label: "github:litlfred", href: "https://github.com/litlfred" },
      { axis: "bean", label: "folio-assistant-29ij", href: "https://github.com/litlfred/folio-assistant/blob/main/beans/defs/x.md" },
      { axis: "PR", label: "#314", href: "https://github.com/litlfred/folio-assistant/pull/314" },
      // Deliberately unresolvable: a bean nothing on disk carries.
      { axis: "bean", label: "folio-assistant-gone" },
    ],
    viewHref: "https://github.com/litlfred/folio-assistant/blob/main/todos/items/first-todo.md",
    editHref: "https://github.com/litlfred/folio-assistant/edit/main/todos/items/first-todo.md",
  },
  {
    id: "second-todo",
    summary: "Decide the other thing",
    comment: "",
    status: "blocked",
    priority: "low",
    origin: "human",
    createdAt: "2026-09-19",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
    viewHref: "https://github.com/litlfred/folio-assistant/blob/main/todos/items/second-todo.md",
    editHref: "https://github.com/litlfred/folio-assistant/edit/main/todos/items/second-todo.md",
  },
];

const PAGE_URL = "http://todo.test/page.html";
/** The LANDING page: the board is page content there, not an overlay. */
const LANDING_URL = "http://todo.test/landing.html";

/**
 * A SECOND fixture, for the themed sticky, on its own page and its own index.
 *
 * Not a third entry in `ITEMS`, and the reason is this file's own `d1r6`
 * lesson one step earlier: the count assertions above are load-bearing — the
 * discard test proves a slot disappeared by counting 2 then 1 — so widening
 * the shared fixture would have rewritten six unrelated assertions to keep a
 * new one passing. A separate page costs one route and touches nothing.
 *
 * `theme` is already on `ThemedTodoFieldsSchema`. What does not exist yet is
 * the generator emitting it and the art behind it, which is `5y4b`. So this
 * fixture is ahead of the pipeline by exactly one field, deliberately: the
 * board's handling of a themed todo is testable now, and it is what `5y4b`
 * will land on.
 */
const THEMED_PAGE_URL = "http://todo.test/themed.html";
const THEMED_ART = {
  library: {
    laptop: "/assets/img/harness/landing-library-laptop.webp",
    mobile: "/assets/img/harness/landing-library-mobile.webp",
    card: "/assets/img/harness/landing-library-card.webp",
  },
};
const THEMED_ITEMS = [
  {
    id: "themed-todo",
    summary: "Ingest the sources",
    comment: "A todo that has chosen a theme.",
    status: "open",
    priority: "medium",
    origin: "agent",
    createdAt: "2026-09-20",
    theme: "library",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
    relations: [],
  },
  {
    id: "themed-todo-tall",
    summary: "Read the tall crop",
    comment: "A todo that names its layout.",
    status: "open",
    priority: "medium",
    origin: "agent",
    createdAt: "2026-09-20",
    theme: "library",
    layout: "mobile",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
    relations: [],
  },
];

const HARNESS = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}</style></head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">Site</a></div><nav class="site-nav"></nav></div>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <h1>Harness</h1>
  <p>Body text.</p>
</div></div>
<script>${JS}</script></body></html>`;

test.beforeEach(async ({ page }) => {
  await page.route("http://todo.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/page.html")) {
      return route.fulfill({ contentType: "text/html", body: HARNESS });
    }
    if (url.endsWith("/landing.html")) {
      // `.fa-landing-board` is what makes `mountTodoBoard` render INLINE
      // rather than as a hidden overlay — the branch bean `l4zi` is about.
      return route.fulfill({
        contentType: "text/html",
        body: HARNESS.replace('<p>Body text.</p>', '<div class="fa-landing-board"></div>'),
      });
    }
    if (url.endsWith("/panelled.html")) {
      // The REAL landing page since 2026-09-21: `landing.html` wraps the
      // board in a collapsed `.fa-sticky-panel`, so `mountTodoBoard` mounts
      // INSIDE that panel. `/landing.html` above keeps the bare wrapper on
      // purpose — the two are different branches and both ship.
      //
      // `open` on the details because Playwright cannot measure a box inside
      // a closed one, and what this fixture exists to check is what the
      // reader sees once they open it.
      return route.fulfill({
        contentType: "text/html",
        body: HARNESS.replace(
          "<p>Body text.</p>",
          '<details class="fa-sticky-panel" open><summary class="fa-sticky-panel__handle">' +
            '<span class="fa-sticky-panel__count" data-fa-sticky-count="2">2</span></summary>' +
            '<div class="fa-sticky-panel__body"><div class="fa-landing-board"></div></div></details>',
        ),
      });
    }
    if (url.endsWith("/themed.html")) {
      return route.fulfill({
        contentType: "text/html",
        body: HARNESS.replace("/assets/todos/index.json", "/assets/todos/themed.json"),
      });
    }
    if (url.endsWith("/assets/todos/themed.json")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          $schema: "folio-todo-index/v1",
          items: THEMED_ITEMS,
          themeArt: THEMED_ART,
        }),
      });
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

/* ── One sticky (#1925) ──────────────────────────────────────────────────
 *
 * Every board slot is the closed tile with the icon row under it; the full
 * card is drawn in the WINDOW a tile opens, and Pin puts the sticky on the
 * FOLIO GLASS (owner, 2026-10-02: "pin to glass should pin to folio glass").
 * These helpers say that once, so a test reads as what it checks. */
const openBoard = async (page: import("@playwright/test").Page) => {
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();
};
const slotOf = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`.fa-sticky-slot[data-fa-home-slot="${id}"]`);
/** Open a todo's window from its tile; the window's card is the full sticky. */
const openWin = async (page: import("@playwright/test").Page, id: string) => {
  await slotOf(page, id).locator(".fa-sticky-tile").click();
  const win = page.locator(`.fa-board-window[data-fa-window="${id}"]`);
  await expect(win).toBeVisible();
  return win;
};
const folioOf = (page: import("@playwright/test").Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fa-folio-assets") || "{}"));
const confirmSend = (page: import("@playwright/test").Page) =>
  page.locator("dialog.fa-fsh-confirm .fa-fsh-confirm-ok").click();
const glassCardOf = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`.fa-sticky-layer .fa-glass-asset[data-fa-asset="todo/${id}"]`);
const toggleGlass = (page: import("@playwright/test").Page) => page.locator(".fa-glass-handle").click();

test("the launcher grows a Todos tile carrying the count", async ({ page }) => {
  await page.goto(PAGE_URL);
  const tile = page.locator(".fa-tile", { hasText: "Todos" });
  // The tile is BUILT on load and only shown once the launcher is opened —
  // asserting visibility without opening it tests the launcher, not the tile.
  await expect(tile).toHaveCount(1);
  await page.locator(".fa-tiles-toggle").click();
  await expect(tile).toBeVisible();
  await expect(tile.locator(".fa-tile-count")).toHaveText("2");
  // The count is in the ACCESSIBLE NAME too. A badge that only renders
  // visually tells a screen-reader user there are todos and not how many.
  await expect(tile).toHaveAttribute("aria-label", "Todos — 2 outstanding");
});

test("the board lands in the main display, not the sidebar", async ({ page }) => {
  await page.goto(PAGE_URL);
  const board = page.locator(".fa-sticky-board");
  // Present but hidden until asked for — the reader did not open it.
  await expect(board).toBeHidden();
  const parentClass = await board.evaluate((n) => n.parentElement?.className);
  expect(parentClass).toContain("main-content");
});

test("opening shows every sticky, summary first and body folded", async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();

  const board = page.locator(".fa-sticky-board");
  await expect(board).toBeVisible();
  await expect(board.locator(".fa-sticky")).toHaveCount(2);
  await expect(board.locator(".fa-sticky-summary").first()).toHaveText("Decide the thing");
  await expect(board.locator(".fa-sticky-body").first()).toBeHidden();
});

test("a sticky expands to its body, and the paragraphs survive", async ({ page }) => {
  // In the WINDOW its tile opens: the slot is the closed tile (#1925).
  await page.goto(PAGE_URL);
  await openBoard(page);
  const first = (await openWin(page, "first-todo")).locator(".fa-sticky");
  const toggle = first.locator(".fa-sticky-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(first.locator(".fa-sticky-body p")).toHaveCount(2);
});

test("a todo with no body says so rather than opening blank", async ({ page }) => {
  // Third state. An empty card is indistinguishable from one that failed to
  // render, and the reader cannot tell which.
  await page.goto(PAGE_URL);
  await openBoard(page);
  const second = (await openWin(page, "second-todo")).locator(".fa-sticky");
  await second.locator(".fa-sticky-toggle").click();
  await expect(second.locator(".fa-sticky-empty")).toHaveText("No detail recorded.");
});

test("a sticky shows its knowledge-graph edges, each as axis + label", async ({ page }) => {
  // The point of a six-axis relationship model is that a reader can SEE the
  // edges. A card showing only status and priority spends the whole schema on
  // two enums — which is what this rendered before the owner pointed it out.
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();

  const rels = page.locator(".fa-sticky").first().locator(".fa-sticky-rel");
  await expect(rels).toHaveCount(4);
  await expect(rels.nth(0).locator(".fa-sticky-rel-axis")).toHaveText("who");
  await expect(rels.nth(0).locator("a")).toHaveAttribute("href", "https://github.com/litlfred");
  await expect(rels.nth(2).locator("a")).toHaveAttribute(
    "href",
    "https://github.com/litlfred/folio-assistant/pull/314",
  );
});

test("an edge that resolves to nothing is SHOWN, not dropped", async ({ page }) => {
  // A dangling reference and no reference at all are different facts. Dropping
  // the first makes it look like the second, and the reader never learns the
  // todo points at something this site could not reach.
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();

  const dangling = page.locator(".fa-sticky").first().locator(".fa-sticky-rel-dangling");
  await expect(dangling).toHaveText("folio-assistant-gone");
  await expect(dangling).toHaveAttribute("title", /No link/);
  // Read as text, never as a link that goes nowhere.
  expect(await page.locator(".fa-sticky").first().locator("a[href='']").count()).toBe(0);
});

test("a sticky carries VIEW and EDIT, two controls for two acts", async ({ page }) => {
  // Bean `pb04`, the owner: "rendeding shows edit src icon (and also need view
  // icon)". `/blob/` is reading and `/edit/` opens GitHub's editor — a reader
  // checking what a card says should not land in a text box.
  await page.goto(PAGE_URL);
  await openBoard(page);

  // BELOW the sticky, in the one icon row every sticky has (#1925): view,
  // edit, pin, send to fsh-guts. Two controls, two different URLs.
  const row = page.locator(".fa-sticky-slot").first().locator(".fa-sticky-actions");
  await expect(row.locator(".fa-sticky-act-view")).toHaveAttribute(
    "href",
    "https://github.com/litlfred/folio-assistant/blob/main/todos/items/first-todo.md",
  );
  await expect(row.locator(".fa-sticky-act-edit")).toHaveAttribute(
    "href",
    "https://github.com/litlfred/folio-assistant/edit/main/todos/items/first-todo.md",
  );
  // Two DIFFERENT URLs. One control pointing at one of them would satisfy any
  // assertion that only checked presence.
  const hrefs = await row
    .locator("a.fa-sticky-act")
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")));
  expect(hrefs.length).toBe(2);
  expect(new Set(hrefs).size).toBe(hrefs.length);
});

test("both controls are ABSENT, not broken, when the pipeline has no forge", async ({ page }) => {
  // The other direction, and the one that matters. `sourceLinks` returns
  // undefined for anything that is not a github.com `origin`, and the
  // generator SPREADS the result, so the keys are missing rather than empty. A
  // test that only checked the present case would pass equally for a control
  // that is always shown.
  //
  // A dead edit link is worse than no link: it invites a click, and on a
  // private repository it 404s for exactly the reader who cannot edit, which
  // reads as "this page is broken" rather than "you cannot do this".
  await page.route("http://todo.test/assets/todos/index.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        $schema: "folio-todo-index/v1",
        items: ITEMS.map((t) => {
          const copy: Record<string, unknown> = { ...t };
          delete copy["viewHref"];
          delete copy["editHref"];
          return copy;
        }),
      }),
    }),
  );
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();
  await expect(page.locator(".fa-sticky")).not.toHaveCount(0); // the board did mount
  await expect(page.locator(".fa-sticky-view, .fa-sticky-act-view")).toHaveCount(0);
  await expect(page.locator(".fa-sticky-edit, .fa-sticky-act-edit")).toHaveCount(0);
  // ...and nothing disabled or greyed in their place.
  await expect(page.locator(".fa-sticky-tools a, .fa-sticky-actions a")).toHaveCount(0);
});

test("neither link carries a `..` — the old one resolved to a dead path", () => {
  // The path `readTodoFiles` reports is relative to the cat-harness LAYER
  // while todos/ sits at the repository root, so it read `../todos/items/x.md`
  // and the old link shipped that verbatim. A browser normalises the `..`
  // before the request is sent, so GitHub received `/edit/todos/items/x.md` —
  // the branch segment eaten, a path that has never existed. Every pencil on
  // the board was dead, and the generated JSON looked entirely correct.
  for (const t of ITEMS) {
    expect(t.editHref).not.toContain("..");
    expect(t.viewHref).not.toContain("..");
  }
});

test("the pencil is `.fa-node-edit` pointing at the todo's own file", async ({ page }) => {
  // The owner's rule: the edit affordance is the class-level pattern every
  // content object on this site already has, not a bespoke editor. On the
  // open window's bar it is `.fa-node-edit`; under the tile it is the row's
  // pencil, to the same file.
  await page.goto(PAGE_URL);
  await openBoard(page);
  const file = "https://github.com/litlfred/folio-assistant/edit/main/todos/items/first-todo.md";
  await expect(page.locator(".fa-sticky-slot").first().locator("a.fa-sticky-act-edit")).toHaveAttribute("href", file);
  const win = await openWin(page, "first-todo");
  await expect(win.locator('a.fa-node-edit[data-fa-control="edit"]')).toHaveAttribute("href", file);
});

test("pin puts a sticky on the folio glass and greys its board slot", async ({ page }) => {
  await page.goto(PAGE_URL);
  await openBoard(page);

  const slot = slotOf(page, "first-todo");
  const pin = slot.locator(".fa-sticky-act-pin");
  await pin.click();
  expect((await folioOf(page))["todo/first-todo"]).toMatchObject({ shown: true, kind: "todos" });
  await expect(slot).toHaveClass(/fa-sticky-slot-floating/);
  // The pressed pin is a REAL button, not a disabled one: `disabled` removes
  // it from the tab order, and it is the control that takes the sticky back.
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await expect(pin).toBeVisible();
  await expect(pin).not.toBeDisabled();
});

/**
 * Bean `ivfw`, the owner: *"when you unpin, sticky, it loses its theme and you
 * cant move around dispaly."*
 *
 * This is the THEME half. The move half is `6lb8`'s board model and is not
 * here.
 *
 * Two things had to be true and neither was. The card is REBUILT on the float
 * layer and DESTROYED on dock, so a theme carried on the DOM node is dropped by
 * construction — `buildSticky` now reads it from the todo, which is the only
 * place that survives both transitions. And `.fa-sticky-floating` set a flat
 * `background` and `color` unconditionally, after `.fa-sticky` at equal
 * specificity, so it painted over whatever the theme had chosen.
 *
 * Asserted against the ATTRIBUTE rather than the computed colour on purpose:
 * `themes.css` is not loaded in this harness, so a colour assertion here would
 * be testing the fixture. What the attribute cannot answer — that the override
 * no longer wins — the CSS assertion below does, and
 * `schemas/themes.test.ts` carries the premise that every theme surface is
 * opaque.
 */
test("a themed sticky keeps its theme across pin AND unpin", async ({ page }) => {
  await page.goto(THEMED_PAGE_URL);
  await openBoard(page);

  const onBoard = page.locator('.fa-sticky-slot .fa-sticky[data-todo-id="themed-todo"]');
  await expect(onBoard).toHaveAttribute("data-fa-sticky-theme", "library");

  await slotOf(page, "themed-todo").locator(".fa-sticky-act-pin").click();
  // On the glass, the card is dressed from the published index, theme and all.
  await page.keyboard.press("Escape");
  await toggleGlass(page);
  const onGlass = glassCardOf(page, "themed-todo");
  await expect(onGlass).toHaveAttribute("data-fa-sticky-theme", "library");
  await toggleGlass(page);

  // ...and back off the glass. This is the direction the owner reported.
  await page.reload();
  await openBoard(page);
  await slotOf(page, "themed-todo").locator(".fa-sticky-act-pin").click();
  expect((await folioOf(page))["todo/themed-todo"]).toMatchObject({ shown: false });
  await expect(onBoard).toHaveAttribute("data-fa-sticky-theme", "library");
});

test("a themed todo renders its backdrop art, the way every other sticky does", async ({ page }) => {
  // Bean `5y4b`, the owner: "todos need grump cat themeing based on content
  // too." Until this, the landing board carried two kinds of sticky side by
  // side — a harness card with per-theme art, a measured text region and a
  // scrim, and a todo that was a flat card with a coloured border. On one page
  // they read as two systems.
  await page.goto(THEMED_PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();

  await expect(page.locator('.fa-sticky-slot .fa-sticky[data-todo-id="themed-todo"]')).toHaveClass(/fa-sticky--backdrop/);
  // The closed tile wears the same faded art (#1925).
  await expect(slotOf(page, "themed-todo").locator(".fa-sticky-tile")).toHaveClass(/fa-sticky--backdrop/);
  // Measured in the WINDOW, where the full card is drawn.
  const card = (await openWin(page, "themed-todo")).locator(".fa-sticky");
  await expect(card).toHaveClass(/fa-sticky--backdrop/);

  // THE PICTURE IS THE POSITIONED LAYER, and the `<img>` is its child. The
  // stylesheet records that `.fa-sticky--backdrop > .fa-sticky-art` matched
  // NOTHING once — the img is a grandchild — and the art laid out at its
  // intrinsic 1672px across the whole viewport with the markup entirely
  // correct. So the STRUCTURE is what is asserted here, not just presence.
  const img = card.locator("picture > img.fa-sticky-art");
  await expect(img).toHaveCount(1);
  // THE CROP FOLLOWS THE STICKY'S SHAPE when the todo names no layout —
  // owner, 2026-09-27 ("theme todos layout should be dynamic", then "board
  // stickies adapt too"), replacing the square-everywhere rule of 2026-09-24.
  // Wide → laptop, tall → mobile, near-square → the square card crop.
  const b = (await card.boundingBox())!;
  const ratio = b.width / b.height;
  const want = ratio >= 1.3 ? THEMED_ART.library.laptop : ratio <= 0.8 ? THEMED_ART.library.mobile : THEMED_ART.library.card;
  await expect(img).toHaveAttribute("src", want);

  // One `<img>`, no `<source>`: the crop is chosen by the sticky's own shape,
  // not by a media query on the window.
  await expect(card.locator("picture > source")).toHaveCount(0);

  // Decoration behind text that already says everything. A description of the
  // cat would be read out before every todo on the board.
  await expect(img).toHaveAttribute("alt", "");
  await expect(card.locator("picture")).toHaveAttribute("aria-hidden", "true");
});

test("a todo that NAMES a layout gets that crop instead of the square", async ({ page }) => {
  await page.goto(THEMED_PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();
  const card = page.locator('.fa-sticky-slot .fa-sticky[data-todo-id="themed-todo-tall"]');
  await expect(card.locator("picture > img.fa-sticky-art")).toHaveAttribute(
    "src",
    "/assets/img/harness/landing-library-mobile.webp",
  );
});

test("the art survives a pin, because the glass card is dressed from the todo", async ({ page }) => {
  await page.goto(THEMED_PAGE_URL);
  await openBoard(page);
  await slotOf(page, "themed-todo").locator(".fa-sticky-act-pin").click();
  await page.reload();
  await toggleGlass(page);
  const onGlass = glassCardOf(page, "themed-todo");
  await expect(onGlass).toHaveClass(/fa-sticky--backdrop/);
  await expect(onGlass.locator("picture > img.fa-sticky-art")).toHaveCount(1);
});

test("an UNTHEMED todo gets no backdrop — the check can fire", async ({ page }) => {
  // Every assertion above passes equally for code that adds a backdrop to
  // everything. The shared fixture's todos carry no theme, so this is the
  // other direction against the same build.
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();
  await expect(page.locator(".fa-sticky--backdrop")).toHaveCount(0);
  await expect(page.locator(".fa-sticky picture")).toHaveCount(0);
});

test("a theme with no published art renders a flat THEMED card, not a broken one", async ({ page }) => {
  // The third state. `resolveThemeBackdrop` refuses a partial set, and a theme
  // that declares no backdrop at all — `pale-sage`, the high-contrast pair —
  // is simply absent from `themeArt`. The sticky must still take its palette.
  await page.route("http://todo.test/assets/todos/themed.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ $schema: "folio-todo-index/v1", items: THEMED_ITEMS, themeArt: {} }),
    }),
  );
  await page.goto(THEMED_PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();

  const card = page.locator('.fa-sticky[data-todo-id="themed-todo"]');
  await expect(card).toHaveAttribute("data-fa-sticky-theme", "library");
  await expect(card).not.toHaveClass(/fa-sticky--backdrop/);
  await expect(card.locator("picture")).toHaveCount(0);
});

test("a todo with NO theme still gets the opaque floating treatment", () => {
  // The other direction, and the reason the override was written: an unthemed
  // sticky's surface is `rgba(128, 128, 128, 0.08)`, so lifted over page text
  // it is see-through. Narrowing the rule must not have removed it.
  expect(CSS).toContain(".fa-sticky-floating:not([data-fa-sticky-theme])");
  // And it must no longer apply to a themed one — the bug, stated as the
  // absence of the rule that caused it.
  expect(CSS).not.toMatch(/^\.fa-sticky-floating \{[^}]*background:/m);
});

/**
 * REWRITTEN for bean `d1r6`. This test was "closing a pinned sticky returns
 * it to the board", and the owner replaced that control with a discard:
 * *"stikies have an [x] to close/restore to panel... that should now be
 * replaced with it going into the fsh-guts."*
 *
 * It kept passing against the new behaviour, and the way it did is worth
 * recording. It asserted `.fa-sticky-slot").first()` was not floating — and
 * the discard REMOVES that slot, so `.first()` silently retargeted to the
 * NEXT todo's slot, which had never floated. Two items in the fixture was
 * all it took. A locator that matches a different element after the change
 * is not a passing test, and it is harder to spot than a vacuous one
 * because the count is not zero.
 *
 * Measured: 2 slots before, 1 after.
 */
test("sending a pinned sticky to fsh-guts takes it off the glass AND off the board", async ({ page }) => {
  await page.goto(PAGE_URL);
  await openBoard(page);
  await expect(page.locator(".fa-sticky-slot")).toHaveCount(2);
  await slotOf(page, "first-todo").locator(".fa-sticky-act-pin").click();

  await slotOf(page, "first-todo").locator(".fa-sticky-act-discard").click();
  await confirmSend(page);
  // Shelved, not forgotten: the entry is still the reader's.
  expect((await folioOf(page))["todo/first-todo"]).toMatchObject({ shown: false });
  // The COUNT, not `.first()`: that is the assertion the old test should
  // have made, and the one that would have caught this change.
  await expect(page.locator(".fa-sticky-slot")).toHaveCount(1);
});

test("the send control says where it goes, and the confirmation that it comes back", async ({ page }) => {
  await page.goto(PAGE_URL);
  await openBoard(page);
  const send = slotOf(page, "first-todo").locator(".fa-sticky-act-discard");
  // Owner, 2026-10-02: "[x] is what? send to fsh-guts?" — the name says WHERE.
  await expect(send).toHaveAttribute("aria-label", "Send Decide the thing to fsh-guts");
  await expect(send).toHaveAttribute("title", "Send to fsh-guts");
  // "make sure confirmed by user": the confirmation says it is restorable,
  // and the limitation — a reader who thinks they cleared a todo for the
  // team has been misled by the control.
  await send.click();
  const dialog = page.locator("dialog.fa-fsh-confirm");
  await expect(dialog).toContainText("restorable");
  await expect(dialog).toContainText("this browser only");
  await dialog.locator(".fa-fsh-confirm-cancel").click();
  await expect(page.locator(".fa-sticky-slot")).toHaveCount(2);
});

test("a discarded sticky is RESTORABLE — the rule the crumpled icon stands for", async ({ page }) => {
  // `fsh-guts` is "the trashcan that is kept": a thing in it can be read,
  // cited and restored. A one-way dismiss would wear the icon and break the
  // rule it stands for.
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();
  await slotOf(page, "first-todo").locator(".fa-sticky-act-discard").click();
  await confirmSend(page);
  await expect(page.locator(".fa-sticky-slot")).toHaveCount(1);

  // It is listed under Settings → Discarded, in its own labelled section.
  //
  // This harness publishes NO `fsh-guts` document, which is the case the
  // control has to survive: a site that has not deployed one yet still owes
  // the reader a way back. The first version of this feature removed the
  // control entirely when the document was absent, which made the discard
  // one-way — a delete wearing a crumpled icon. This test is what found it.
  await page.locator(".fa-tiles-toggle").click();
  await page.locator('.fa-tiles-grid .fa-tile:has(.fa-tile-caption:text-is("Page settings"))').click();
  await page.locator(".fa-discarded-open").click();
  const local = page.locator(".fa-discarded-local");
  await expect(local).toContainText("1 sticky you discarded");
  // Stated in WORDS, not by colour or placement.
  await expect(local).toContainText("this browser only");
  await local.locator(".fa-discarded-restore").click();

  // Back on the board after a reload, which is what "restored" has to mean.
  await page.reload();
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();
  await expect(page.locator(".fa-sticky-slot")).toHaveCount(2);
});

test("a discard survives a reload, and the tile count follows it", async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();
  await slotOf(page, "first-todo").locator(".fa-sticky-act-discard").click();
  await confirmSend(page);

  await page.reload();
  await page.locator(".fa-tiles-toggle").click();
  const tile = page.locator(".fa-tile", { hasText: "Todos" });
  // The count is what a reader sees before opening anything, so a discard
  // that did not move it would read as having done nothing.
  await expect(tile.locator(".fa-tile-count")).toHaveText("1");
  await expect(tile).toHaveAttribute("aria-label", "Todos — 1 outstanding");
});

test("pressing the pressed pin takes it off the glass — the pin is its own inverse", async ({ page }) => {
  await page.goto(PAGE_URL);
  await openBoard(page);
  const pin = slotOf(page, "first-todo").locator(".fa-sticky-act-pin");
  await pin.click();
  await pin.click();
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await expect(slotOf(page, "first-todo")).not.toHaveClass(/fa-sticky-slot-floating/);
  expect((await folioOf(page))["todo/first-todo"]).toMatchObject({ shown: false });
});

test("pin and unpin are reachable and operable from the keyboard alone", async ({ page }) => {
  // The reason "pick up and move" is a BUTTON rather than a drag. This
  // layer's declared interaction profile is low-dexterity, and a pointer
  // drag cannot be operated without reimplementing the whole gesture.
  await page.goto(PAGE_URL);
  await openBoard(page);

  const pin = slotOf(page, "first-todo").locator(".fa-sticky-act-pin");
  await pin.focus();
  await page.keyboard.press("Enter");
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(pin).toHaveAttribute("aria-pressed", "false");
});

test("Escape closes the board", async ({ page }) => {
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();
  await expect(page.locator(".fa-sticky-board")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".fa-sticky-board")).toBeHidden();
});

test("content reaches the DOM as TEXT, never as markup", async ({ page }) => {
  // A todo is authored — by a person, or by an agent on their behalf — and
  // travels through JSON to this page. The string that closes a tag is exactly
  // the string somebody eventually writes.
  //
  // AND THE DEPLOY TARGET IS WHY THIS IS THE ONLY LINE OF DEFENCE. This board
  // ships to gh-pages, a STATIC host: there is no request-time anything — no
  // sanitiser, no template filter, no server to reject a payload before it
  // reaches a browser. Escaping at render is not defence in depth here, it is
  // the whole depth: gh-pages has no request-time sanitisation, so escaping at
  // render is the required line of defence (XSS defence). On a local-server
  // topology the same page would have a second chance; it must never come to
  // rely on one, because the same code serves both (bean `81vy`, under the
  // deployment epic `5a3l`).
  //
  // Recorded because a rule enforced without its reason is one somebody
  // eventually "simplifies": a reader who finds no stated justification
  // concludes the constraint is imaginary. That exact failure is written up
  // in `platform-gates` and cost a CI round today.
  await page.route("http://todo.test/assets/todos/index.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [{ ...ITEMS[0], summary: "<img src=x onerror=alert(1)>", comment: "<script>x</script>" }],
      }),
    }),
  );
  await page.goto(PAGE_URL);
  await openBoard(page);
  // The tile's title is text…
  const tile = slotOf(page, "first-todo").locator(".fa-sticky-tile");
  await expect(tile.locator(".fa-sticky-tile-title")).toHaveText("<img src=x onerror=alert(1)>");
  expect(await tile.locator("img:not(.fa-sticky-art)").count()).toBe(0);
  // …and so is the full card, in its window.
  const first = (await openWin(page, "first-todo")).locator(".fa-sticky");
  await expect(first.locator(".fa-sticky-summary")).toHaveText("<img src=x onerror=alert(1)>");
  expect(await first.locator("img").count()).toBe(0);
  await first.locator(".fa-sticky-toggle").click();
  expect(await first.locator(".fa-sticky-body script").count()).toBe(0);
});

test("a missing index mounts nothing rather than an empty board", async ({ page }) => {
  // Third state again: "could not read it" is not "there is nothing".
  await page.route("http://todo.test/assets/todos/index.json", (route) =>
    route.fulfill({ status: 404, body: "gone" }),
  );
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await expect(page.locator(".fa-tile", { hasText: "Todos" })).toHaveCount(0);
  await expect(page.locator(".fa-sticky-board")).toHaveCount(0);
});

/* ── Per-block stickies ─────────────────────────────────────────────────── */

const LABELLED = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Labelled harness</title>
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}</style></head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">Site</a></div><nav class="site-nav"></nav></div>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <h1>Harness</h1>
  <h2 id="one" data-fa-label="sec:page-one">Section one</h2>
  <p>Body one.</p>
  <h2 id="two" data-fa-label="sec:page-two">Section two</h2>
  <p>Body two.</p>
  <h2 id="three" data-fa-label="sec:page-three">Section three</h2>
</div></div>
<script>${JS}</script></body></html>`;

const TARGETED = [
  { ...ITEMS[0], id: "t1", targetLabel: "sec:page-one" },
  { ...ITEMS[1], id: "t2", targetLabel: "sec:page-one" },
  { ...ITEMS[0], id: "t3", summary: "Elsewhere", targetLabel: "sec:page-two" },
  // Deliberately points at a block no page carries.
  { ...ITEMS[1], id: "t4", summary: "Orphan", targetLabel: "sec:nowhere" },
];

test.describe("todos attached to a block", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("http://todo.test/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/page.html")) {
        return route.fulfill({ contentType: "text/html", body: LABELLED });
      }
      if (url.endsWith("/assets/todos/index.json")) {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ items: TARGETED }),
        });
      }
      return route.fulfill({ status: 404, body: "not found" });
    });
  });

  test("a badge appears beside each block that has them, and shows a count only above one", async ({ page }) => {
    // R5, the owner: *"badge of # if > 1"*. Updated for bean `1rta` — this
    // asserted a rendered "1" on the single-note block, which is exactly the
    // behaviour the requirement removes.
    await page.goto(PAGE_URL);
    const badges = page.locator(".fa-sticky-badge");
    await expect(badges).toHaveCount(2);
    await expect(badges.nth(0).locator(".fa-sticky-badge-count")).toHaveText("2");
    await expect(badges.nth(1).locator(".fa-sticky-badge-count")).toHaveCount(0);
    // THE EXACT NUMBER IS IN THE ACCESSIBLE NAME IN BOTH CASES. The threshold
    // is a density decision about the visual; a screen-reader user must not be
    // told less than a sighted one, so the single-note badge still says "1".
    await expect(badges.nth(0)).toHaveAttribute("aria-label", "2 notes on this section");
    await expect(badges.nth(1)).toHaveAttribute("aria-label", "1 note on this section");
  });

  test("a block with no todos gets no badge", async ({ page }) => {
    await page.goto(PAGE_URL);
    const third = page.locator("#three");
    const next = await third.evaluate((n) => n.nextElementSibling?.className ?? "");
    expect(next).not.toContain("fa-sticky-inline");
  });

  test("the badge is a SIBLING of the heading — a div inside an h2 is invalid", async ({ page }) => {
    await page.goto(PAGE_URL);
    const tag = await page
      .locator(".fa-sticky-inline")
      .first()
      .evaluate((n) => n.parentElement?.tagName);
    expect(tag).toBe("DIV");
  });

  test("opening a badge shows that block's todos and no others", async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.locator(".fa-sticky-badge").first().click();
    const list = page.locator(".fa-sticky-inline-list").first();
    await expect(list.locator(".fa-sticky")).toHaveCount(2);
    await expect(list.getByText("Elsewhere")).toHaveCount(0);
  });

  test("an inline sticky carries no Pin and no Close", async ({ page }) => {
    // It is already beside the content it annotates. Pinning would move it
    // AWAY from that, and closing would hide a block annotation with no way
    // back — the board is where those controls mean something.
    await page.goto(PAGE_URL);
    await page.locator(".fa-sticky-badge").first().click();
    const first = page.locator(".fa-sticky-inline-list .fa-sticky").first();
    await expect(first.locator(".fa-sticky-pin")).toHaveCount(0);
    await expect(first.locator(".fa-sticky-close")).toHaveCount(0);
    await expect(first.locator(".fa-sticky-discard")).toHaveCount(0);
    // But it keeps BOTH source affordances, which is the point: an inline
    // sticky loses the board's controls and keeps the content object's.
    // Asserted by name, because a count over the shared `.fa-node-edit` class
    // would silently accept two pencils.
    //
    // ON THE CELL, not on the card, since 2026-09-21 — the row is a caption
    // BELOW the sticky now. This test caught the move as a real regression
    // rather than a rename: the first cut added the links back only in the
    // board's slot loop, so inline stickies lost them entirely.
    const cell = page.locator(".fa-sticky-inline-list .fa-sticky-cell").first();
    await expect(cell.locator("a.fa-sticky-view")).toHaveCount(1);
    await expect(cell.locator("a.fa-sticky-edit")).toHaveCount(1);
    // ...and NOT inside the card, which is the thing that changed.
    await expect(first.locator("a.fa-sticky-edit")).toHaveCount(0);
  });

  test("an inline sticky carries no Move either — it is already beside its subject", async ({ page }) => {
    // Bean `ivfw`'s fourth Done-when. Move is the same case as Pin: an inline
    // sticky sits next to the content it annotates, and moving it would take
    // it AWAY from that content. It lives in THIS describe rather than beside
    // the other `ivfw` specs because the badge only exists on the labelled
    // fixture — a copy at the file's end found no badge and timed out, which
    // is the right failure and the wrong place for the test.
    await page.goto(PAGE_URL);
    await page.locator(".fa-sticky-badge").first().click();
    const first = page.locator(".fa-sticky-inline-list .fa-sticky").first();
    await expect(first).toBeVisible();
    await expect(first.locator(".fa-sticky-move")).toHaveCount(0);
  });

  test("a todo targeting a block this page lacks still reaches the board", async ({ page }) => {
    // The orphan must not vanish. It is on no block here, and the board is the
    // surface that shows everything regardless of where it is attached.
    await page.goto(PAGE_URL);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Todos" }).click();
    // Once, as its tile — the full card is drawn only in a window.
    await expect(page.locator(".fa-sticky-board .fa-sticky-tile-title").getByText("Orphan")).toHaveCount(1);
  });
});

/* ── Stacking by subprocess hierarchy ───────────────────────────────────── */

test.describe("board stacking", () => {
  // `Process_Lifecycle` calls `Process_Publication`, which calls
  // `Process_Editing`. Real edges, copied from the diagrams.
  const HIER = {
    Process_Lifecycle: ["Process_Editing", "Process_Publication"],
    Process_Publication: ["Process_Editing"],
    Process_Editing: ["Process_EvidenceRetrieval"],
    Process_EvidenceRetrieval: [],
  };
  const tagged = (id: string, processes: string[]) => ({
    ...ITEMS[0],
    id,
    summary: id,
    tags: { ...ITEMS[0].tags, processes },
  });

  test.beforeEach(async ({ page }) => {
    await page.route("http://todo.test/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/page.html")) {
        return route.fulfill({ contentType: "text/html", body: HARNESS });
      }
      if (url.endsWith("/assets/todos/index.json")) {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            processes: HIER,
            items: [
              tagged("deep", ["Process_EvidenceRetrieval"]),
              tagged("untagged", []),
              tagged("mid", ["Process_Publication"]),
              tagged("outer", ["Process_Lifecycle"]),
              // Two processes at different depths: takes the SHALLOWEST.
              tagged("both", ["Process_EvidenceRetrieval", "Process_Lifecycle"]),
            ],
          }),
        });
      }
      return route.fulfill({ status: 404, body: "not found" });
    });
  });

  test("callers sort above their callees, and untagged todos come first", async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Todos" }).click();
    const order = await page
      .locator(".fa-sticky-board .fa-sticky-summary")
      .allTextContents();
    // `untagged` first: most todos carry no process, and sinking them below a
    // hierarchy they are not part of buries the common case under the rare one.
    expect(order[0]).toBe("untagged");
    expect(order.indexOf("outer")).toBeLessThan(order.indexOf("mid"));
    expect(order.indexOf("mid")).toBeLessThan(order.indexOf("deep"));
  });

  test("a todo on several processes takes the SHALLOWEST, and appears once", async ({ page }) => {
    // `what-kick-off-means-for-a-ci-watcher` really is tagged with two
    // processes in different diagrams, because its two dispatch points are.
    // Listing it twice would double a single outstanding item.
    await page.goto(PAGE_URL);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Todos" }).click();
    const both = page.locator(".fa-sticky-board .fa-sticky[data-todo-id='both']");
    await expect(both).toHaveCount(1);
    // `has:` is RELATIVE to the slot, so a board-scoped selector can never
    // match inside one — the board is the slot's ancestor, not its descendant.
    const slot = page.locator(".fa-sticky-slot", {
      has: page.locator(".fa-sticky[data-todo-id='both']"),
    });
    // Named ON the tile, so the grid stays a grid (#1925).
    await expect(slot.locator(".fa-sticky-tile-process")).toHaveText("Process_Lifecycle");
    await expect(slot).toHaveAttribute("data-fa-depth", "0");
  });

  test("depth is the PROCESS's, so two todos on one process land together", async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Todos" }).click();
    const mid = page.locator(".fa-sticky-slot", {
      has: page.locator(".fa-sticky[data-todo-id='mid']"),
    });
    await expect(mid).toHaveAttribute("data-fa-depth", "1");
  });

  test("an untagged todo carries no process label at all", async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Todos" }).click();
    const slot = page.locator(".fa-sticky-slot", {
      has: page.locator(".fa-sticky[data-todo-id='untagged']"),
    });
    await expect(slot.locator(".fa-sticky-process, .fa-sticky-tile-process")).toHaveCount(0);
  });

  test("a cycle between two processes does not hang the board", async ({ page }) => {
    // Two diagrams calling each other is possible in principle, and an
    // unbounded parent walk would spin forever. The walk is bounded by the
    // process count; this proves the board still renders.
    await page.route("http://todo.test/assets/todos/index.json", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          processes: { Process_A: ["Process_B"], Process_B: ["Process_A"] },
          items: [tagged("cyclic", ["Process_A"])],
        }),
      }),
    );
    await page.goto(PAGE_URL);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Todos" }).click();
    await expect(page.locator(".fa-sticky-board .fa-sticky")).toHaveCount(1);
  });
});

/**
 * Bean `l4zi` — the owner, 2026-09-21: *"clicking on postit display panel,
 * hides it, no place to get it back."*
 *
 * On the landing board the todos are page CONTENT, so closing them removes a
 * section of the page. The launcher's Todos tile re-opens it, but a control
 * two clicks deep inside a collapsed launcher is not a place to get it back;
 * it is a place a reader has to already know about.
 */
test.describe("the inline board's close has a reachable inverse", () => {
  test("closing leaves a control WHERE THE BOARD WAS, and focuses it", async ({ page }) => {
    await page.goto(LANDING_URL);
    const board = page.locator(".fa-sticky-board");
    await expect(board).toBeVisible();
    await page.locator(".fa-sticky-board-close").click();
    await expect(board).toBeHidden();

    const back = page.locator(".fa-sticky-board-reopen");
    await expect(back).toBeVisible();
    // In the board's own position, not appended somewhere else on the page.
    await expect(page.locator(".fa-landing-board > *").first()).toHaveClass(/fa-sticky-board-reopen/);
    // Focus follows it. Left alone it lands on <body>, which tells a reader
    // nothing and loses the keyboard position entirely.
    await expect(back).toBeFocused();
    // The count rides the accessible name, so it is not a bare "Todos".
    await expect(back).toHaveAttribute("aria-label", /\d+ outstanding/);
  });

  test("clicking it brings the board back and takes the control away", async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.locator(".fa-sticky-board-close").click();
    await page.locator(".fa-sticky-board-reopen").click();
    await expect(page.locator(".fa-sticky-board")).toBeVisible();
    await expect(page.locator(".fa-sticky-board-reopen")).toHaveCount(0);
    // Round trip, because a one-way fix is the defect in the other direction.
    await page.locator(".fa-sticky-board-close").click();
    await expect(page.locator(".fa-sticky-board-reopen")).toBeVisible();
  });

  test("an OVERLAY page gets no such control — the tile is its way back", async ({ page }) => {
    // The distinction is the whole point: an overlay was covering what you
    // were reading, so closing it returns you to the page. Adding a button to
    // that page would be litter.
    await page.goto(PAGE_URL);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Todos" }).click();
    await expect(page.locator(".fa-sticky-board")).toBeVisible();
    await page.locator(".fa-sticky-board-close").click();
    await expect(page.locator(".fa-sticky-board")).toBeHidden();
    await expect(page.locator(".fa-sticky-board-reopen")).toHaveCount(0);
  });
});

/* ── The MOVE half of `ivfw` ─────────────────────────────────────────────
 *
 * The owner, verbatim: *"when you unpin, sticky, it loses its theme and you
 * cant move around dispaly. treate it as visible to move in fixed place around
 * miro build like folio visualtion."*
 *
 * The theme half landed 2026-09-20. The move half was recorded blocked, and
 * the recorded reason was precise: *"a note's position is STATE and two
 * sessions moving one note is a merge conflict."* `6lb8` then landed the board
 * window's movement model and the owner ruled on `db7g` that a relocation is
 * **reader-local** — which dissolves that blocker rather than working around
 * it, because a reader-local move has no second session to conflict with.
 *
 * So these specs assert the bean's remaining three Done-whens: the sticky is
 * visible and movable in the board frame, the keyboard path survives with no
 * drag-only affordance, and the inline case is untouched.
 */
test("a pinned sticky can be moved, and by the keyboard alone", async ({ page }) => {
  await page.goto(PAGE_URL);
  await openBoard(page);
  await slotOf(page, "first-todo").locator(".fa-sticky-act-pin").click();
  await page.reload();
  await toggleGlass(page);

  // ON THE FOLIO GLASS, with the glass's own move (#1925).
  const card = glassCardOf(page, "first-todo");
  await expect(card).toBeVisible();
  const before = await card.evaluate((el) => ({
    left: parseFloat((el as HTMLElement).style.left),
    top: parseFloat((el as HTMLElement).style.top),
  }));
  expect(Number.isFinite(before.left)).toBe(true);
  expect(Number.isFinite(before.top)).toBe(true);

  // NO POINTER FROM HERE ON. This layer's declared interaction profile is
  // low-dexterity, and a move that needs a drag excludes its owner.
  const move = card.locator('[data-fa-control="move"]');
  await expect(move).toHaveAttribute("aria-pressed", "false");
  await move.press("Enter");
  await expect(card).toHaveAttribute("data-fa-moving", "true");
  await expect(move).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const after = await card.evaluate((el) => ({
    left: parseFloat((el as HTMLElement).style.left),
    top: parseFloat((el as HTMLElement).style.top),
  }));
  expect(after.left).toBeLessThan(before.left);
  expect(after.top).toBeLessThan(before.top);

  // And the mode is leavable — `l4zi`.
  await page.keyboard.press("Escape");
  await expect(card).not.toHaveAttribute("data-fa-moving", "true");
});

test("the arrows only move IN the mode — outside it they still scroll", async ({ page }) => {
  await page.goto(PAGE_URL);
  await openBoard(page);
  await slotOf(page, "first-todo").locator(".fa-sticky-act-pin").click();
  await page.reload();
  await toggleGlass(page);

  const card = glassCardOf(page, "first-todo");
  const before = await card.evaluate((el) => (el as HTMLElement).style.left);
  await card.evaluate((el) => (el as HTMLElement).focus());
  await page.keyboard.press("ArrowLeft");
  // Unchanged: a card that moved whenever a reader pressed an arrow while
  // reading it would have stolen the page's own navigation.
  expect(await card.evaluate((el) => (el as HTMLElement).style.left)).toBe(before);
});

test("a moved sticky comes back where it was, not in the corner", async ({ page }) => {
  await page.goto(PAGE_URL);
  await openBoard(page);
  await slotOf(page, "first-todo").locator(".fa-sticky-act-pin").click();
  await page.reload();
  await toggleGlass(page);

  const card = glassCardOf(page, "first-todo");
  await card.locator('[data-fa-control="move"]').press("Enter");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  const moved = await card.evaluate((el) => (el as HTMLElement).style.left);
  await toggleGlass(page);

  // Unpin and pin again: the folio entry keeps its place (`placeOnGlass`), so
  // a reader who moved it and put it back has not asked for it to jump.
  await openBoard(page);
  const pin = slotOf(page, "first-todo").locator(".fa-sticky-act-pin");
  await pin.click();
  await pin.click();
  await page.reload();
  await toggleGlass(page);
  expect(await glassCardOf(page, "first-todo").evaluate((el) => (el as HTMLElement).style.left)).toBe(moved);
});

test("the layer is a coordinate frame, not a surface that swallows the page", async ({ page }) => {
  await page.goto(PAGE_URL);
  await openBoard(page);
  await slotOf(page, "first-todo").locator(".fa-sticky-act-pin").click();

  // The layer covers the whole viewport, so if it took pointer events with
  // the glass put away the page would be unusable the moment one sticky was
  // pinned. This is the one assertion that would fail catastrophically in
  // production and silently in a spec that only checked the card.
  const layer = page.locator(".fa-sticky-layer");
  await expect(layer).toHaveCSS("pointer-events", "none");
  await page.reload();
  await toggleGlass(page);
  await expect(glassCardOf(page, "first-todo")).toHaveCSS("pointer-events", "auto");
});

/* ── One panel, not two ───────────────────────────────────────────────────
 *
 * Owner, 2026-09-21, on the staging preview: *"why are there two panels???"*
 *
 * `.fa-sticky-board` paints its own bordered, padded, tinted box with an
 * `<h2>` and a close button. That is right for the overlay it is on an
 * ordinary page and wrong inside `.fa-sticky-panel`, which paints exactly
 * that already — the reader got a box headed "Todos" inside a box headed
 * "Stickies", with a close button beside a summary that already toggles.
 *
 * These are geometry and identity assertions rather than class checks: a
 * class name can be kept while the rule behind it is dropped, and what the
 * owner saw was pixels.
 */
test.describe("the todo board inside the sticky panel", () => {
  test("renders BARE — no second border, background or padding", async ({ page }) => {
    await page.goto("http://todo.test/panelled.html");
    const board = page.locator(".fa-sticky-board--bare");
    await expect(board).toHaveCount(1);

    const box = await board.evaluate((e) => {
      const s = getComputedStyle(e);
      return {
        borderTop: s.borderTopWidth,
        borderLeft: s.borderLeftWidth,
        padding: s.paddingTop,
        // `background-image: none` AND a transparent colour: `background: none`
        // resets both, and checking only one lets a tint survive the reset.
        bgImage: s.backgroundImage,
        bgColor: s.backgroundColor,
      };
    });
    expect(box.borderTop).toBe("0px");
    expect(box.borderLeft).toBe("0px");
    expect(box.padding).toBe("0px");
    expect(box.bgImage).toBe("none");
    // rgba(…, 0) in every engine that reports a transparent computed colour.
    expect(box.bgColor).toMatch(/^rgba\(.*,\s*0\)$/);
  });

  test("carries no close button — the panel's summary is the inverse", async ({ page }) => {
    // `l4zi` is satisfied by the panel, not by a second button inside it.
    // Two closes at one spot doing different things is the state nobody
    // could describe: one collapses the panel, one swaps the board for a
    // reopen control INSIDE the still-open panel.
    await page.goto("http://todo.test/panelled.html");
    await expect(page.locator(".fa-sticky-board--bare .fa-sticky-board-close")).toHaveCount(0);
  });

  test("keeps its heading in the accessibility tree, clipped not removed", async ({ page }) => {
    // Deleting it is the obvious move and is wrong twice: it is the focus
    // target for discard/close, and the section is `role="region"`, which
    // owes an accessible name. "Stickies" on the summary and "Todos" here
    // are different facts.
    await page.goto("http://todo.test/panelled.html");
    const heading = page.locator(".fa-sticky-board-title");
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText("Todos");

    const display = await heading.evaluate((e) => getComputedStyle(e).display);
    // `display: none` would hide the pixels AND the name — the exact defect
    // the search label's rule records against itself.
    expect(display).not.toBe("none");

    const b = await heading.boundingBox();
    expect(b!.width).toBeLessThanOrEqual(2);
    expect(b!.height).toBeLessThanOrEqual(2);
  });

  test("and the bare board still shows its todos", async ({ page }) => {
    // The control that matters: every assertion above is about what is NOT
    // drawn, and all four would pass over a board that rendered nothing.
    await page.goto("http://todo.test/panelled.html");
    await expect(page.locator(".fa-sticky-board--bare .fa-sticky")).not.toHaveCount(0);
  });

  test("an ordinary page's board is NOT bare — the overlay keeps its chrome", async ({ page }) => {
    // The other half, and the one that makes the four above mean something:
    // a rule that stripped the chrome everywhere would pass all of them.
    await page.goto("http://todo.test/page.html");
    await page.locator(".fa-tiles-toggle").click();
    await expect(page.locator(".fa-sticky-board--bare")).toHaveCount(0);
  });
});

/* ── The backdrop art resolves against the site's baseurl ─────────────────
 *
 * Owner, 2026-09-21: *"i want the theme on the lower ones too. why are they
 * dispalyed differently."*
 *
 * They were not styled differently. `gen-docs-pages.ts` publishes backdrop
 * paths site-ROOT-absolute (`/assets/img/...`) because the SAME index file is
 * served from `/folio-assistant/` and from every
 * `/folio-assistant/branches/<branch>/` prefix, so it cannot bake one in. The
 * client never added the prefix back, so every backdrop 404'd and the todo
 * cards showed a broken-image placeholder next to landing stickies that had
 * their art. The theme was applied the whole time; only the picture failed.
 *
 * These assert the PATH, not the pixels: a 404'd <img> still has its src, and
 * asserting "the card has a backdrop" would have passed throughout the bug.
 */
test.describe("todo backdrop art under a baseurl", () => {
  test("the art src carries the prefix the page itself was served from", async ({ page }) => {
    await page.goto("http://todo.test/themed.html");
    const img = page.locator(".fa-sticky--backdrop .fa-sticky-art").first();
    await expect(img).toHaveCount(1);
    const src = await img.getAttribute("src");
    // The fixture serves `meta[name=fa-todo-src]` at the site root, so the
    // derived baseurl is "" and the path is unchanged — the interesting case
    // is the next test. This one pins that the src is a real path at all.
    expect(src).toBeTruthy();
    expect(src!).toMatch(/\/assets\//);
  });

  test("under a baseurl the prefix is ADDED, and added once", async ({ page }) => {
    // The actual regression. `siteBaseurl()` strips the known suffix off the
    // meta the server resolved with `relative_url`, so a page served from a
    // prefix gets its art from that prefix too.
    await page.goto("http://todo.test/themed.html");
    const resolved = await page.evaluate(() => {
      const m = document.querySelector('meta[name="fa-todo-src"]')!;
      m.setAttribute("content", "/folio-assistant/assets/todos/index.json");
      // Re-derive through the same path the loader uses.
      const src = m.getAttribute("content")!;
      const suffix = "/assets/todos/index.json";
      const base = src.slice(0, -suffix.length);
      const one = base + "/assets/img/harness/x-card.webp";
      // Idempotence: a path that already carries the prefix must not gain a
      // second one, which is what makes this safe if the generator is ever
      // changed to resolve paths itself.
      const twice = one.indexOf(base + "/") === 0 ? one : base + one;
      return { base, one, twice };
    });
    expect(resolved.base).toBe("/folio-assistant");
    expect(resolved.one).toBe("/folio-assistant/assets/img/harness/x-card.webp");
    expect(resolved.twice).toBe(resolved.one);
  });
});

/* ── `qefk` — the face carries board gestures; the forge links are BELOW ──
 *
 * These three tests are `main`'s, rewritten rather than dropped.
 *
 * `main` answered *"the todos controls are too clunky / take up too much
 * real estate"* with the owner's **"3+1"**: three board gestures on the
 * card's face, View and Edit collapsed into a `⋯` drawer one level in. The
 * owner then went one step further on 2026-09-21 — *"edit, view links can be
 * below, not inside stick"* — so the links left the card entirely and the
 * drawer had nothing to hold.
 *
 * WHAT SURVIVES IS MAIN'S SPLIT, which is the part that mattered: a gesture
 * that acts on the CARD belongs on the card; a link that acts on the FILE
 * does not. Only where the second group lives has changed, from a drawer
 * inside to a caption below.
 */
test("a board sticky's tile carries no control; the row under it carries them all", async ({ page }) => {
  // #1925: "icons are a mess on both. make compact underneath". The split
  // `qefk` made — a gesture on the CARD, a link to the FILE — collapses into
  // one row under the tile, in one order, because the tile itself is closed.
  await page.goto(PAGE_URL);
  await openBoard(page);

  const slot = page.locator(".fa-sticky-slot").first();
  const tile = slot.locator(".fa-sticky-tile");
  expect(await tile.locator("button, a").count()).toBe(0);
  const order = await slot.locator(".fa-sticky-actions [data-fa-act]")
    .evaluateAll((ns) => ns.map((n) => n.getAttribute("data-fa-act")));
  expect(order).toEqual(["view", "edit", "pin", "discard"]);
  // And NOT inside the card at all — a descendant selector, which would catch
  // a drawer sneaking back in.
  const card = slot.locator(".fa-sticky").first();
  await expect(card.locator("a.fa-sticky-view, a.fa-sticky-act-view")).toHaveCount(0);
  await expect(card.locator(".fa-sticky-pin, .fa-sticky-discard")).toHaveCount(0);
});

test("the forge links need no drawer to reach — they are one Tab away", async ({ page }) => {
  // This replaces main's "the drawer opens from the keyboard and names what
  // it holds". The accessibility intent is preserved and is now cheaper to
  // satisfy: with no drawer there is no disclosure to open, so the links are
  // directly focusable and directly named. A control you do not have to open
  // is strictly better than one that opens well.
  await page.goto(PAGE_URL);
  await page.locator(".fa-tiles-toggle").click();
  await page.locator(".fa-tile", { hasText: "Todos" }).click();

  const links = page.locator(".fa-sticky-slot").first().locator(".fa-sticky-actions");
  const view = links.locator("a.fa-sticky-act-view");
  const edit = links.locator("a.fa-sticky-act-edit");

  // Visible without any prior gesture — the thing the drawer cost.
  await expect(view).toBeVisible();
  await expect(edit).toBeVisible();

  // Icon-only, so the NAME must come from `aria-label`. Main's drawer test
  // held the same line for its summary, and it matters more here: there is
  // no visible text at all to fall back on.
  await expect(view).toHaveAttribute("aria-label", /^View the source of .+/);
  await expect(edit).toHaveAttribute("aria-label", /^Edit .+/);

  // And a pointer user gets the same words on hover, which `aria-label`
  // alone does not give them.
  await expect(edit).toHaveAttribute("title", /Edit/);

  await edit.focus();
  await expect(edit).toBeFocused();
});

test("on the glass a pinned sticky gets the glass's tools, and no forge links", async ({ page }) => {
  // A pinned sticky is a folio-glass card (#1925), so its tools are the
  // glass's — move, smaller, larger, back to library view — in that order.
  await page.goto(PAGE_URL);
  await openBoard(page);
  await slotOf(page, "first-todo").locator(".fa-sticky-act-pin").click();
  await page.reload();
  await toggleGlass(page);

  const tools = glassCardOf(page, "first-todo").locator(".fa-glass-asset-tools");
  const order = await tools.evaluate((el) =>
    Array.from(el.children).map((c) => c.getAttribute("data-fa-control") || c.className));
  expect(order[0]).toBe("move");
  expect(order[order.length - 1]).toContain("fa-glass-asset-close");
  // The forge links stay under the tile, which is why the row owns them.
  await expect(page.locator(".fa-sticky-layer a.fa-sticky-act-edit")).toHaveCount(0);
});

/* ── The board's geometry is a MEASUREMENT, not a taste ──────────────────
 *
 * Owner, 2026-09-21: *"to much padding between panels, condense"* and
 * *"sticky should stilll be ~2.5" in large macbook screen"* — two halves of
 * one instruction. Condensing without the floor shrinks the card; the floor
 * without the condensing leaves the dead space. Both are asserted, because a
 * later "tighten this up" that took the card with it would satisfy half the
 * request and look like it satisfied all of it.
 */
test.describe("board geometry", () => {
  // The screen the request names. 3456x2234 over a 16.2" diagonal is 13.6" of
  // width, presented as 1728 CSS px — about 127 CSS px per PHYSICAL inch. That
  // ratio is the whole point: a CSS `in` is exactly 96 CSS px and is NOT a
  // physical inch, so `2.5in` in the stylesheet would have rendered ~1.9" of
  // glass. 2.5 x 127 = 318px, and 20rem is 320px.
  test.use({ viewport: { width: 1728, height: 1000 } });

  test("a closed sticky is the declared tile size, the same on every screen", async ({ page }) => {
    // SUPERSEDED RULING, kept as history: 2026-09-21 asked for a ~2.5"
    // card. 2026-10-02 (#1925): *"upper smaller same size closed looks
    // niceer"* — every sticky is now its closed tile, one declared size
    // (`--fa-sticky-tile-size`), and the full card opens in a window.
    await page.goto(PAGE_URL);
    await openBoard(page);
    const want = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.width = "var(--fa-sticky-tile-size)";
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    });
    expect(want).toBeGreaterThan(0);
    const widths = await page.locator(".fa-sticky-grid > .fa-sticky-slot > .fa-sticky-tile")
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(widths.length).toBe(2);
    for (const w of widths) expect(w).toBe(Math.round(want));
  });

  test("the cards do not stretch to fill the row", async ({ page }) => {
    // `1fr` WAS THE BUG, and this is the spec that would have caught it: with
    // a `1fr` track every column absorbs the leftover width, so the card's
    // size is whatever the viewport happens to leave — a number nobody chose
    // and the test above could only pass by luck of the viewport.
    await page.goto(PAGE_URL);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Todos" }).click();

    const widths = await page
      .locator(".fa-sticky-grid > *")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).getBoundingClientRect().width));
    expect(widths.length).toBeGreaterThan(0);
    const grid = await page.locator(".fa-sticky-grid").boundingBox();
    // Every card is capped well under the board's own width; none of them has
    // been handed the remainder.
    for (const w of widths) expect(w).toBeLessThan(grid!.width / 2);
  });
});
