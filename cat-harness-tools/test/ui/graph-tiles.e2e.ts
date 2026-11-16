/**
 * Every declared visualisation gets a tile, and each opens the EXISTING
 * visualisation.
 *
 * Bean `folio-assistant-zsah`, R12 + R16 of issue #602. Owner, 2026-09-20:
 *
 * > its not a function of nodes, its a function of a harness watching a
 * > directort … if harness declares visaluzers, those should have tile
 *
 * and *"those should open their exisiting visualzaiton"*.
 *
 * ## "Asserted by reuse, not by screenshot" — what that means here
 *
 * The bean asks for reuse to be *asserted*, and a screenshot would assert
 * nothing: a tile that opened a brand-new page would look identical. So the
 * assertion is that the tile's href is the DECLARED ref, resolved to its
 * published route and nothing else — checked against `graph-tiles.ts`'s own
 * answer from the same declaration. A tile that composed its own path could
 * reach a different page, and this is what would catch it.
 *
 * ## The sticky board carries none
 *
 * Q11: a tile is declared once and says where it shows. The board was a
 * second surface for the same declaration until the owner ruled, 2026-10-02
 * (issue #1905, bean `t6ht`): *"stickies panel shouldnt have all those
 * icons"*. The `board` surface value is still legal — so a declaration naming
 * it stays valid — but nothing mounts it, and that is asserted below rather
 * than left to the absence of code.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import {
  graphTiles,
  publishedHref,
  withTileCounts,
  type TiledDirectory,
} from "../../scripts/graph-tiles.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

/** Declarations, and the tiles they must yield — one source for both. */
const DIRS: TiledDirectory[] = [
  // Icons are declared on EXISTING entries rather than new ones: the id set is
  // asserted exactly a few tests down, and a fixture that grows to cover a new
  // field would quietly rewrite what "exactly the declarations that say
  // navbar" means.
  { id: "beans", coverage: { visualiser: [{ ref: "cat-harness/docs/beans/index.html", icon: "beans" }] } },
  {
    id: "library",
    coverage: {
      visualiser: [
        // An icon the client's registry has not got: the fallback case, which
        // is a folio declaring against a newer platform than the one rendering.
        { ref: "cat-harness/docs/library/shelf.html", title: "Shelf", icon: "no-such-glyph" },
        // BOARD-ONLY: a surface no longer rendered (#1905). Still a valid
        // declaration; it must yield no tile anywhere on this page.
        { ref: "cat-harness/docs/library/map.html", title: "Map", surfaces: ["board"] },
      ],
    },
  },
  // NO icon, on the navbar: the generic glyph a fallback must equal. It was
  // `library/2` on the board until that surface stopped rendering.
  { id: "plain", coverage: { visualiser: [{ ref: "cat-harness/docs/p.html", surfaces: ["navbar"] }] } },
  // An INHERITED property of every object literal. A registry read as
  // `TILE_GLYPHS[name]` would return `Object`'s constructor here and hand a
  // function to `innerHTML`; this pins the `hasOwnProperty` guard.
  { id: "navbar-only", coverage: { visualiser: [{ ref: "cat-harness/docs/n.html", surfaces: ["navbar"], icon: "constructor" }] } },
  { id: "starts-hidden", coverage: { visualiser: [{ ref: "cat-harness/docs/h.html", hidden: true }] } },
  // A page withheld from the canonical deploy. Its tile must vanish with it:
  // a tile pointing at a page that was not deployed is a link to a 404, and
  // it advertises content the declaration deliberately does not publish.
  {
    id: "staging-only",
    coverage: { visualiser: [{ ref: "cat-harness/docs/s.html", publish: "staging-only" }] },
  },
  // Declares nothing: it must get no tile, however much a viewer exists.
  { id: "undeclared" },
  // Declared OUTSIDE the published site: a tile, but not a link (`pb04`).
  { id: "elsewhere", coverage: { visualiser: "somewhere-else/v.html" } },
];

/**
 * The counts, attached the same way the real site attaches them — issue #856.
 *
 * Deliberately PARTIAL, and the gaps are the point. `beans` has a number,
 * `library` has ZERO, and `navbar-only` has none at all: the three states a
 * reader has to be able to tell apart, present in one fixture so a test can
 * compare them against each other rather than against a remembered string.
 *
 * A fixture where every tile had a count would pass just as happily on a
 * reader that fell back to `0`.
 */
const TILES = withTileCounts(graphTiles(DIRS, "cat-harness/docs"), new Map([
  ["beans", { count: 466, unit: "beans" }],
  ["library", { count: 0, unit: "entries" }],
]));

/**
 * The base this fixture is served under — NON-EMPTY on purpose.
 *
 * It was absent until issue #801, and the absence is what let the defect ship:
 * a tile's declared href is site-root-relative (`/beans/`), the code emitted it
 * raw, and under a fixture served at the origin root "composed against the
 * base" and "not composed at all" are the same string. The assertion below
 * restated `publishedHref` and passed BECAUSE nothing happened — the shape
 * PR #776 paid for in `toRootFor`, where a test that restates the expression
 * guards nothing at the call site.
 *
 * So the fixture now carries what the real deploy carries. `/folio-assistant`
 * rather than a placeholder, because that is this site's own base and a reader
 * comparing the test with the 404 in the issue should see the same string.
 */
const BASE = "/folio-assistant";

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<meta name="fa-baseurl" content="${BASE}">
<!-- No fa-staging meta: this fixture is the CANONICAL deploy, which is the
     default and the case a staging-only tile must not appear in. -->
<meta name="fa-tiles" content='${JSON.stringify(TILES).replace(/'/g, "&#39;")}'>
<style>${CSS}</style></head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">Site</a></div><nav class="site-nav"></nav></div>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <div class="fa-landing-board"></div>
</div></div>
<script>${JS}</script></body></html>`;

const URL_PAGE = "http://tiles.test/page.html";

const ITEMS = [
  {
    id: "one",
    summary: "A todo",
    comment: "Body.",
    status: "open",
    priority: "high",
    origin: "agent",
    createdAt: "2026-09-19",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
    relations: [],
  },
];

test.beforeEach(async ({ page }) => {
  await page.route("http://tiles.test/**", (route) => {
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

/** Every graph tile on a surface (or on ANY surface, with `"*"`): id, visible text, and href. */
async function tilesOnPage(page: import("@playwright/test").Page, surface: string) {
  const sel = surface === "*" ? "[data-fa-tile]" : `[data-fa-tile][data-fa-surface="${surface}"]`;
  return page.locator(sel).evaluateAll((els) =>
    els.map((e) => ({
      id: (e as HTMLElement).dataset.faTile,
      title: e.querySelector(".fa-tile-caption")?.textContent,
      href: e.getAttribute("href"),
      glyph: e.querySelector("svg")?.outerHTML,
    })),
  );
}

/**
 * Wait for the tiles to be BUILT, which is not the same as visible.
 *
 * The launcher's tiles are built on load and shown only when it is opened —
 * `sticky-todos.e2e.ts` records the same distinction: *"asserting visibility
 * without opening it tests the launcher, not the tile."* Every assertion here
 * is about what was derived, so attachment is the right wait and opening the
 * launcher would be testing `1le7`'s control rather than this bean's.
 */
async function ready(page: import("@playwright/test").Page) {
  await page.waitForSelector("[data-fa-tile]", { state: "attached" });
  await page.waitForFunction(() =>
    Boolean((window as never as { __faTodoBoard?: unknown }).__faTodoBoard),
  );
}

test.describe("a tile per declared visualisation, derived and not listed", () => {
  test("the navbar carries exactly the declarations that say navbar", async ({ page }) => {
    await page.goto(URL_PAGE);
    await ready(page);
    const ids = (await tilesOnPage(page, "navbar")).map((t) => t.id).sort();
    // `library/2` says board only, which nothing renders (#1905);
    // `starts-hidden` starts out of frame; `undeclared` declares nothing;
    // `elsewhere` has no published href.
    expect(ids).toEqual(["beans", "library/1", "navbar-only", "plain"]);
  });

  test("a directory that declares NOTHING gets no tile", async ({ page }) => {
    // However much a viewer exists. A tile appearing without a declaration
    // would make the audit that reports the gap look wrong.
    await page.goto(URL_PAGE);
    await ready(page);
    const all = await tilesOnPage(page, "*");
    expect(all.map((t) => t.id)).not.toContain("undeclared");
  });

  test("a declaration outside the published site is not rendered as a link to nowhere", async ({ page }) => {
    // `pb04`. The tile's absence here is the honest answer: the page cannot
    // serve it, and a link that 404s reads as a broken site.
    await page.goto(URL_PAGE);
    await ready(page);
    const all = await tilesOnPage(page, "*");
    expect(all.map((t) => t.id)).not.toContain("elsewhere");
  });
});

test.describe("each tile opens the EXISTING visualisation — asserted by reuse", () => {
  test("every href is the declared ref, resolved, and nothing else", async ({ page }) => {
    // A tile that composed its own path could reach a different page. This is
    // what catches that, and a screenshot would not.
    await page.goto(URL_PAGE);
    await ready(page);
    for (const t of await tilesOnPage(page, "navbar")) {
      const declared = TILES.find((x) => x.id === t.id)!;
      // Two facts, and keeping them apart is the point. The DATA is the
      // published route of the declared ref and carries no base -- that is
      // what `graph-tiles.ts` stores and what an override resolves against.
      // The HREF is that path composed against this deploy, which is what a
      // browser follows. Asserting the second equals the first is the bug.
      expect(declared.href).toBe(publishedHref("cat-harness/docs", declared.ref));
      expect(t.href, `${t.id} opens its declared visualisation`).toBe(BASE + declared.href);
    }
  });

  test("an href is composed against the base, not left at the origin", async ({ page }) => {
    // #801 stated as the thing the reader experienced: the beans tile pointed
    // at `litlfred.github.io/beans/`, which is a different site. Asserted by
    // RESOLVING it the way a browser does rather than by matching the string,
    // so a half-fix that produced `/folio-assistant//beans/` still fails.
    await page.goto(URL_PAGE);
    await ready(page);
    const beans = (await tilesOnPage(page, "navbar")).find((t) => t.id === "beans")!;
    expect(beans.href).toBe("/folio-assistant/beans/");
    expect(new URL(beans.href!, URL_PAGE).pathname).toBe("/folio-assistant/beans/");
  });

  test("with no base declared the path is unchanged", async ({ page }) => {
    // The documented fallback, and the common case: the e2e fixtures and a
    // local `jekyll serve` have no base. A site that declares an empty one and
    // a site that declares none render identically through Liquid, so there is
    // nothing here to tell apart and nothing to report.
    await page.route("http://nobase.test/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/page.html")) {
        return route.fulfill({
          contentType: "text/html",
          body: PAGE.replace(`<meta name="fa-baseurl" content="${BASE}">`, ""),
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
    await page.goto("http://nobase.test/page.html");
    await ready(page);
    const beans = (await tilesOnPage(page, "navbar")).find((t) => t.id === "beans")!;
    expect(beans.href).toBe("/beans/");
  });

  test("the title is the declared one, and falls back to the directory's id", async ({ page }) => {
    await page.goto(URL_PAGE);
    await ready(page);
    const byId = Object.fromEntries((await tilesOnPage(page, "navbar")).map((t) => [t.id, t.title]));
    expect(byId["library/1"]).toBe("Shelf");
    expect(byId["beans"]).toBe("beans");
    expect(byId["navbar-only"]).toBe("navbar-only");
  });
});

/* ── No tiles on the sticky board — owner, 2026-10-02, issue #1905 ─────
 *
 * *"stickies panel shouldnt have all those icons."* That reverses the
 * 2026-09-21 ruling (bean `v0jv`: *"lets have the square tiles lined up on
 * the top of the folio-sicky-board-landingpanel…"*) which these specs used to
 * hold in place: a "Visualisations" strip along the top of every sticky
 * board, open, sticky, square. Those specs are gone with the strip; what
 * replaces them is the inverse, plus the half that keeps the removal honest —
 * the tiles are still reachable from the navbar.
 */
test.describe("the sticky board carries no tiles", () => {
  test("no strip and no tile inside the board, while the navbar still has them", async ({ page }) => {
    await page.goto(URL_PAGE);
    await ready(page);
    const board = page.locator(".fa-sticky-board").first();
    await expect(board).toHaveCount(1);
    // The board is really there — its grid and filter row survive — so an
    // empty answer below is about the strip, not about a missing board.
    await expect(board.locator(".fa-sticky-grid")).toHaveCount(1);
    await expect(board.locator(".fa-board-filter")).toHaveCount(1);
    await expect(board.locator(".fa-board-strip")).toHaveCount(0);
    await expect(board.locator("[data-fa-tile]")).toHaveCount(0);
    await expect(page.locator(".fa-board-strip, .fa-board-tiles")).toHaveCount(0);
    expect((await tilesOnPage(page, "navbar")).length).toBeGreaterThan(0);
  });

  test("nothing renders the `board` surface anywhere on the page", async ({ page }) => {
    await page.goto(URL_PAGE);
    await ready(page);
    expect(await tilesOnPage(page, "board")).toEqual([]);
  });

  test("a board-only declaration stays valid but yields no tile at all", async ({ page }) => {
    // `library/2` declares `surfaces: ["board"]`. The value is still in
    // `TILE_SURFACES`, so the declaration parses; it simply has nowhere to
    // render. The navbar must not pick it up as a fallback either.
    await page.goto(URL_PAGE);
    await ready(page);
    expect(TILES.map((t) => t.id)).toContain("library/2");
    expect((await tilesOnPage(page, "*")).map((t) => t.id)).not.toContain("library/2");
  });

  test("a navbar-only declaration appears in the navbar", async ({ page }) => {
    await page.goto(URL_PAGE);
    await ready(page);
    expect((await tilesOnPage(page, "navbar")).map((t) => t.id)).toContain("navbar-only");
  });
});

test.describe("declared visibility, and the reader's override commits nothing", () => {
  test("a tile declared hidden starts out of frame", async ({ page }) => {
    await page.goto(URL_PAGE);
    await ready(page);
    const all = await tilesOnPage(page, "*");
    expect(all.map((t) => t.id)).not.toContain("starts-hidden");
  });

  test("nothing about tiles is persisted — the declared default is the only stored fact", async ({ page }) => {
    // The reader's half is theirs alone. If it reached any store it would be
    // one step from reaching the declaration, and then one reader's view of
    // the navbar would be everyone's navbar.
    await page.goto(URL_PAGE);
    await ready(page);
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    expect(stored).not.toContain("starts-hidden");
    expect(stored).not.toContain("fa-tile");
  });
});

test.describe("the tile template is `1le7`'s, not a second one", () => {
  test("a graph tile IS a `.fa-tile`, on every surface rendered", async ({ page }) => {
    // Asserted structurally rather than by looking: two templates would be two
    // tiles that look alike until one of them is changed.
    await page.goto(URL_PAGE);
    await ready(page);
    const n = await page.locator(".fa-tile[data-fa-tile]").count();
    const all = await page.locator("[data-fa-tile]").count();
    expect(all).toBeGreaterThan(0);
    expect(n, "every graph tile uses the shared template").toBe(all);
  });

  test("every tile has an accessible name saying what it opens", async ({ page }) => {
    await page.goto(URL_PAGE);
    await ready(page);
    const labels = await page
      .locator("[data-fa-tile]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(l).toContain("the declared visualisation of");
  });
});

test.describe("the glyph a tile wears is DECLARED, by name", () => {
  test("a declared icon renders a different glyph from the generic one", async ({ page }) => {
    // Asserted as a DIFFERENCE, not against the bean's path data. A test
    // carrying the artwork would fail on every redraw while proving only that
    // the string was copied twice; what has to hold is that the declaration
    // reached the renderer and changed what it drew.
    await page.goto(URL_PAGE);
    await ready(page);
    const byId = Object.fromEntries((await tilesOnPage(page, "navbar")).map((t) => [t.id, t.glyph]));
    expect(byId["beans"]).toBeTruthy();
    expect(byId["beans"]).not.toBe(byId["library/1"]);
  });

  test("an unknown icon name falls back to the glyph every tile had before", async ({ page }) => {
    // `library/1` declares `no-such-glyph`; `plain` declares nothing. The
    // two must be identical, which is what "falls back" has to mean — a folio
    // naming a glyph its platform has not got still gets a working tile.
    await page.goto(URL_PAGE);
    await ready(page);
    const nav = Object.fromEntries((await tilesOnPage(page, "navbar")).map((t) => [t.id, t.glyph]));
    expect(nav["library/1"]).toBeTruthy();
    expect(nav["library/1"]).toBe(nav["plain"]);
  });

  test("an INHERITED property name is not a glyph", async ({ page }) => {
    // `navbar-only` declares `constructor`. A bare `TILE_GLYPHS[name]` lookup
    // returns `Object`'s constructor for it, and `innerHTML = <function>`
    // writes its SOURCE into the page. Asserted both ways: the tile renders
    // the fallback, and the word `function` appears nowhere in it.
    await page.goto(URL_PAGE);
    await ready(page);
    const nav = Object.fromEntries((await tilesOnPage(page, "navbar")).map((t) => [t.id, t.glyph]));
    expect(nav["navbar-only"]).toBe(nav["library/1"]);
    const html = await page.locator('[data-fa-tile="navbar-only"]').innerHTML();
    expect(html).not.toContain("function");
  });
});

test.describe("a staging-only tile appears only on a preview", () => {
  /**
   * The companion to `compose-docs.ts` withholding the PAGE. Both halves have
   * to agree or the reader gets the worst outcome of the two: a tile in the
   * navbar linking to a page that deploy does not carry.
   *
   * Asserted on both sides of the switch, and the canonical case first —
   * that is the default, the one `docs-site.yml` produces, and the one where
   * being wrong publishes a dead link to everybody.
   */
  test("it is absent when the page carries no fa-staging", async ({ page }) => {
    await page.goto(URL_PAGE);
    await ready(page);
    const ids = (await tilesOnPage(page, "navbar")).map((t) => t.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain("staging-only");
  });

  test("it appears when fa-staging names a slug", async ({ page }) => {
    await page.route("http://staging.test/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/page.html")) {
        return route.fulfill({
          contentType: "text/html",
          body: PAGE.replace(
            `<meta name="fa-baseurl" content="${BASE}">`,
            `<meta name="fa-baseurl" content="${BASE}">\n<meta name="fa-staging" content="my-branch">`,
          ),
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
    await page.goto("http://staging.test/page.html");
    await ready(page);
    expect((await tilesOnPage(page, "navbar")).map((t) => t.id)).toContain("staging-only");
  });

  test("an EMPTY fa-staging is canonical, not a preview", async ({ page }) => {
    // The value `{{ site.data.build.staging_slug }}` renders to when the key
    // is absent — which is every canonical build. Treating empty as "present"
    // would publish the tile on the real site while the page is withheld,
    // which is the exact failure this pair exists to prevent.
    await page.route("http://empty.test/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/page.html")) {
        return route.fulfill({
          contentType: "text/html",
          body: PAGE.replace(
            `<meta name="fa-baseurl" content="${BASE}">`,
            `<meta name="fa-baseurl" content="${BASE}">\n<meta name="fa-staging" content="">`,
          ),
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
    await page.goto("http://empty.test/page.html");
    await ready(page);
    expect((await tilesOnPage(page, "navbar")).map((t) => t.id)).not.toContain("staging-only");
  });

  test("showing hidden tiles does not resurrect it", async ({ page }) => {
    // `hidden` and `publish` are different axes: one is a reader's preference
    // about a page that exists, the other is whether the page is there at all.
    // Conflating them would let "show hidden" produce a link to a 404.
    await page.goto(URL_PAGE);
    await ready(page);
    const all = (await tilesOnPage(page, "*")).map((t) => t.id);
    expect(all).not.toContain("staging-only");
  });
});


/**
 * Issue #856, bean `tis1`. A tile carried a glyph and a caption and nothing
 * else, so an empty viewer's tile was indistinguishable from a populated one
 * until somebody clicked it — `rptk`'s shape moved onto the navigation, and
 * how #801's twelve off-site tiles survived a hundred-odd green gates.
 *
 * The owner chose a badge over greying an empty tile out, for the stronger
 * reason: a badge also makes a WRONG count visible, where a dimmed tile only
 * ever answers "empty or not".
 */
test.describe("the count on a tile", () => {
  test("a declared count is drawn", async ({ page }) => {
    await page.goto(URL_PAGE);
    const badge = page.locator('.fa-tile[data-fa-tile^="beans"] .fa-tile-count').first();
    await expect(badge).toHaveText("466");
  });

  test("ZERO is drawn, and marked as the empty state", async ({ page }) => {
    // The whole feature. A tile that hid its badge at zero would leave the
    // reader with exactly the ambiguity this exists to remove.
    await page.goto(URL_PAGE);
    const badge = page.locator('.fa-tile[data-fa-tile^="library"] .fa-tile-count').first();
    await expect(badge).toHaveText("0");
    await expect(badge).toHaveAttribute("data-fa-empty", "true");
  });

  test("a tile with NO declared count draws NO badge", async ({ page }) => {
    // The assertion that would fail on a `?? 0` anywhere in the reader, which
    // is the only failure mode worth building a fixture for. `dh4f`: an
    // absent count and an empty graph are opposite facts.
    await page.goto(URL_PAGE);
    const tile = page.locator('.fa-tile[data-fa-tile^="navbar-only"]').first();
    await expect(tile).toHaveCount(1);
    await expect(tile.locator(".fa-tile-count")).toHaveCount(0);
  });

  test("absent and zero are distinguishable WITHOUT reading the number", async ({ page }) => {
    // Asserted as a comparison rather than against a literal: the two states
    // have to differ from each other, which is what a reader glancing at a row
    // of tiles actually does. A test pinning a specific colour would pass on
    // the day both became the same colour by a theme edit.
    //
    // STRUCTURE rather than `toBeVisible`. These tiles mount inside the
    // navbar's collapsible menu, so nothing here is visible until a reader
    // opens it -- and an assertion that depended on that would be testing the
    // disclosure, not the badge. What has to hold is that the two states are
    // different ELEMENTS: zero draws a pill carrying the empty marker, absent
    // draws nothing at all. A reader cannot confuse those, and a `?? 0` in the
    // reader would collapse them into one.
    await page.goto(URL_PAGE);
    const zero = page.locator('.fa-tile[data-fa-tile^="library"] .fa-tile-count').first();
    const absent = page.locator('.fa-tile[data-fa-tile^="navbar-only"] .fa-tile-count');
    await expect(zero).toHaveAttribute("data-fa-empty", "true");
    await expect(absent).toHaveCount(0);
  });

  test("the count reaches the ACCESSIBLE NAME, not only the pixels", async ({ page }) => {
    // A badge a screen reader does not announce leaves exactly the reader who
    // cannot glance at the tile unable to tell an empty viewer from a full
    // one — the defect, made worse for the people it hurts most.
    await page.goto(URL_PAGE);
    const tile = page.locator('.fa-tile[data-fa-tile^="beans"]').first();
    await expect(tile).toHaveAttribute("aria-label", /466 beans/);
  });

  test("a zero count is announced as zero, not omitted", async ({ page }) => {
    await page.goto(URL_PAGE);
    const tile = page.locator('.fa-tile[data-fa-tile^="library"]').first();
    await expect(tile).toHaveAttribute("aria-label", /0 entries/);
  });

  test("an uncounted tile's name says nothing about a count", async ({ page }) => {
    // Not "says zero", and not a made-up "unknown": the name carries what the
    // tile always carried and no more.
    await page.goto(URL_PAGE);
    const label = await page
      .locator('.fa-tile[data-fa-tile^="navbar-only"]')
      .first()
      .getAttribute("aria-label");
    expect(label).not.toMatch(/\b0\b/);
    expect(label).toMatch(/navbar-only/);
  });

  test("the badge does not displace the caption", async ({ page }) => {
    // The tile still has to say what it IS. A count that pushed the caption
    // out would answer "how many" and lose "how many of what".
    await page.goto(URL_PAGE);
    const tile = page.locator('.fa-tile[data-fa-tile^="beans"]').first();
    await expect(tile.locator(".fa-tile-caption")).toHaveText("beans");
  });
});
