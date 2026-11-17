import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteDirFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * The header's four buttons became one launcher over a grid of action tiles.
 *
 * Bean `1le7`, from the owner: *"that navbar is getting crowded. will need to
 * make expandable set of icon tiles that build out to the size of the QR code.
 * use that as kind of the template size for action icons, settins opens into
 * that tile with poppouts from there if neede, same for languages, smae for
 * this KG graph veiwer and src. light dark mode icon is tile under settings."*
 *
 * The motivating fact is that **the knowledge-graph viewer had no entry point
 * at all**: it publishes at `<base>/kg/` and nothing on the site linked to it.
 * Adding it, plus the source link, to a header row that already held four
 * buttons and the site title would have made the stated problem worse.
 *
 * ## What is asserted here, and why each of it
 *
 * The placement property — a panel not clipped by the theme's height-capped
 * header — belongs to `sidebar-panels.e2e.ts` and stays there. This file is
 * about the launcher itself: that every action is REACHABLE, that the two new
 * ones point where the site config says rather than at a hardcoded URL, and
 * that the whole thing is operable by someone who cannot use a mouse.
 *
 * The accessibility half is not decoration. This layer's declared
 * interaction profile is low-dexterity (`cat-harness/memory/interaction.json`), and the
 * standing rule is `skills/ui/ui-core/ui-accessibility.md`. A tile that is
 * barely 24px is a tile that is hard to hit, so the floor is checked and the
 * page aims well above it.
 */

// `import.meta.dir` is a Bun extension and is undefined under Node, which is
// what Playwright runs the spec with.
const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const QR = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");

/**
 * The link block `head_custom.html` fills from `docs/_data/harness.json`.
 *
 * **Read from the generated file, not retyped here.** The previous fixture
 * carried `kg: "/folio-assistant/kg/"` — the very 404 bean `udx8` is about —
 * and asserted the tile matched it, so the spec agreed with the defect and
 * passed. A fixture that restates the value under test cannot catch a wrong
 * one; this one takes whatever `sync-docs-harness.ts` resolved.
 *
 * Liquid applies `relative_url` to each `path`, which under this site's
 * `/folio-assistant/` baseurl is what the template does; `url` entries are
 * off-site and printed as-is.
 */
const HARNESS_DATA = JSON.parse(readFileSync(overlayPath(join(ROOT, SITE, "_data/harness.json")), "utf8")) as {
  links: { id: string; path?: string; url?: string }[];
  tiles?: { id: string; title: string; href?: string; icon?: string; hidden?: boolean }[];
};
const BASEURL = "/folio-assistant";
const LINK_MAP: Record<string, string> = {};
for (const l of HARNESS_DATA.links) LINK_MAP[l.id] = l.path ? BASEURL + l.path : (l.url ?? "");
const LINKS = JSON.stringify(LINK_MAP);

/**
 * just-the-docs' search, as the theme renders it into `.main-header`.
 *
 * **Copied from a real Jekyll build of this branch**, not written from
 * memory. The first version of this stub put an `aria-label` on the input.
 * The theme does not: the accessible name comes from the `<label>` and the
 * `sr-only` span inside it. That difference is not cosmetic — a stylesheet
 * may hide the label and take the input's NAME with it, which is exactly
 * what happened here and what the stub hid, since axe was reading a name the
 * site never renders. A fixture that flatters the code under test is worse
 * than no fixture.
 */
const SEARCH_MARKUP =
  '<div class="search" role="search">' +
  '<div class="search-input-wrap">' +
  '<input type="text" id="search-input" class="search-input" tabindex="0" ' +
  'placeholder="Search folio-assistant" autocomplete="off">' +
  '<label for="search-input" class="search-label">' +
  '<span class="sr-only">Search folio-assistant</span>' +
  '<svg viewBox="0 0 24 24" class="search-icon" aria-hidden="true">' +
  '<circle cx="10" cy="10" r="6" fill="none" stroke="currentColor"/></svg>' +
  "</label>" +
  "</div>" +
  '<div id="search-results" class="search-results"></div>' +
  "</div>";

/**
 * The page under test: the theme's sidebar shape, the assets, and a stub of
 * just-the-docs' own theme API.
 *
 * The stub is not padding. applyScheme refuses to act when jtd.setTheme is
 * absent and warns instead, which is right in production — the theme is an
 * UNPINNED remote theme, so a missing setTheme is version drift and silently
 * pretending to have switched would be worse than saying nothing happened. It
 * does mean a harness without the stub cannot exercise the scheme switch at
 * all: the first run of this spec reported a dead button that is not dead.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERAL BELOW. The whole page is one, so a
 * backtick anywhere in it — including inside an HTML comment — ends the string
 * and the file stops parsing. The note you are reading was in that comment
 * until it did exactly that.
 */
/**
 * The DECLARED tiles, as `head_custom.html` hands them to the client.
 *
 * `<meta name="fa-tiles" content="{{ site.data.harness.tiles | jsonify | escape }}">`
 * at `_includes/head_custom.html:403` — so the fixture reads the same
 * generated file the page does rather than restating a tile list here. A
 * fixture that carries its own copy of the population under test cannot catch
 * the population changing, which is the whole subject of the test below.
 *
 * DEFAULT OFF, and that is not tidiness. Supplying these adds thirty tiles to
 * the panel, and the caption assertions elsewhere in this file name their
 * tiles exactly (`["Search", "Page settings", "Language", "QR code"]`). A third
 * parameter that defaults to `null` leaves every existing call byte-identical
 * in behaviour; putting the meta into the shared HARNESS would have rewritten
 * six unrelated tests to accommodate one new one.
 */
const DECLARED_TILES = JSON.stringify(HARNESS_DATA.tiles ?? []);

/** Liquid's `escape` on the attribute value; `innerHTML` is never used on it. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function harness(
  links: string | null,
  search: string = SEARCH_MARKUP,
  tilesMeta: string | null = null,
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${
    tilesMeta === null ? "" : `<meta name="fa-tiles" content="${escapeAttr(tilesMeta)}">`
  }<style>
  body { margin: 0; }
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; align-items: flex-end;
              background: #27262b; color: #fff; }
  .site-header { width: 100%; max-height: 3.75rem; overflow: hidden; display: flex; align-items: center; }
  .site-title { flex: 1; }
  .site-nav { width: 100%; overflow-y: auto; }
  ${CSS}
</style></head><body>
  ${links === null ? "" : `<script type="application/json" id="fa-site-links">${links}<\/script>`}
  <div class="side-bar">
    <div class="site-header"><a class="site-title">folio-assistant</a></div>
    <nav class="site-nav"><a href="#">Home</a></nav>
  </div>
  <div class="main"><div class="main-header">${search}</div><div class="main-content"><h1>x</h1></div></div>
  <script>window.jtd = { theme: "dark",
    getTheme: function () { return this.theme; },
    setTheme: function (t) { this.theme = t; } };<\/script>
  <script>${QR}<\/script>
  <script>${JS}<\/script>
</body></html>`;
}

const HARNESS = harness(LINKS);

async function openTiles(page: import("@playwright/test").Page): Promise<void> {
  await page.setContent(HARNESS);
  await page.locator(".fa-tiles-toggle").click();
}

test.describe("action tiles", () => {
  test("the header carries THREE named controls, and each is there on purpose", async ({ page }) => {
    // This asserted ONE until 2026-09-21, when the owner asked for two more
    // by name: *"can you put dark/light mode switch in mini-icon on top as
    // well as language icon. to right of folio-asst, to left of the [3x3
    // checkboard]"*.
    //
    // It is still not "however many happen to be there". The original
    // complaint was FOUR toggles plus a title in a 3.75rem row, with six as
    // the alternative that decided it (`1le7`). Three asked-for controls is
    // inside that budget; a fourth that nobody asked for is the regression
    // this test still exists to catch, which is why they are NAMED rather
    // than counted loosely.
    await page.setContent(HARNESS);
    await expect(page.locator(".site-header .fa-scheme-mini")).toHaveCount(1);
    await expect(page.locator(".site-header .fa-lang-mini")).toHaveCount(1);
    await expect(page.locator(".site-header .fa-tiles-toggle")).toHaveCount(1);
    await expect(page.locator(".site-header .fa-qr-toggle")).toHaveCount(3);
    await expect(page.locator(".fa-tiles-toggle")).toHaveAttribute("aria-expanded", "false");
    // Closed until asked. A panel that starts open is a panel in the way.
    await expect(page.locator(".fa-tiles")).toBeHidden();
  });

  test("every action is one press away, and Search leads", async ({ page }) => {
    await openTiles(page);
    await expect(page.locator(".fa-tiles-toggle")).toHaveAttribute("aria-expanded", "true");
    const captions = await page.locator(".fa-tiles-grid .fa-tile-caption").allTextContents();
    // Named, not counted. `toHaveLength(n)` breaks on the next tile and says
    // nothing about which one is missing.
    for (const name of ["Search", "Page settings", "Language", "QR code",
                        "Knowledge graph", "JSON-LD", "Source"]) {
      expect(captions).toContain(name);
    }
    // Search is the one action a reader reaches for repeatedly and the one
    // that was taken off the main panel, so it gets the first cell.
    expect(captions[0]).toBe("Search");
  });

  test("the knowledge-graph tile points at the VIEWER, not at /kg/", async ({ page }) => {
    // The whole reason bean `udx8` exists. `/folio-assistant/kg/` was what
    // the template composed and nothing has ever been published there: the
    // renderings sit at the base, named after the stub. The expected value is
    // read from the generated `harness.json`, so this cannot drift back into
    // agreeing with a wrong one.
    await openTiles(page);
    await expect(page.locator(".fa-tile", { hasText: "Knowledge graph" }))
      .toHaveAttribute("href", LINK_MAP.kg);
    expect(LINK_MAP.kg).not.toContain("/kg/");
    // The graph as DATA and the code that produced it are two artefacts, so
    // they are two tiles — the owner asked for "the jsonld and github".
    await expect(page.locator(".fa-tile", { hasText: "JSON-LD" }))
      .toHaveAttribute("href", LINK_MAP.jsonld);
    await expect(page.locator(".fa-tile", { hasText: "Source" }))
      .toHaveAttribute("href", LINK_MAP.source);
    // `blob`, never `raw.githubusercontent`: raw 404s on a private repo and a
    // session cookie does not authenticate it.
    expect(LINK_MAP.source).toContain("github.com/");
    expect(LINK_MAP.source).not.toContain("raw.githubusercontent");
  });

  test("with no link config, the link tiles are absent rather than broken", async ({ page }) => {
    // A tile that goes nowhere is worse than a missing one: the reader cannot
    // tell a broken link from a broken site. The rest still mount.
    await page.setContent(harness(null));
    await page.locator(".fa-tiles-toggle").click();
    for (const gone of ["Knowledge graph", "JSON-LD", "Source"]) {
      await expect(page.locator(".fa-tile", { hasText: gone })).toHaveCount(0);
    }
    const captions = await page.locator(".fa-tiles-grid .fa-tile-caption").allTextContents();
    expect(captions).toEqual(["Search", "Page settings", "Language", "QR code"]);
  });

  /* ── The search, back in the top display navbar ─────────────────────── */

  test("the search is IN the main navbar on load, not behind the launcher", async ({ page }) => {
    // THE INVERSE OF WHAT THIS ASSERTED UNTIL 2026-09-21. It used to hold
    // that search had LEFT the main panel, on the owner's "keep main display
    // panel uncluttered". Reversed by the owner the same day: *"i want the
    // search restored back to the top display navbar, with option to slide
    // out to the UR corner as an icon."*
    //
    // The old test's own reasoning is why this checks load rather than first
    // open: if it only happened once the launcher was touched, every reader
    // who never opens it gets the other behaviour.
    //
    // 2026-09-30 (issue #1715): on load it is now the CLOSED magnifier at the
    // top of the display panel, and the field opens full width from it. The
    // invariant this test exists for is unchanged: search is in the panel on
    // load, never behind the launcher.
    await page.setContent(HARNESS);
    await expect(page.locator(".main-header .fa-search-home .search")).toHaveCount(1);
    await expect(page.locator(".fa-tiles .search")).toHaveCount(0);
    await expect(page.locator(".fa-search-home")).toHaveAttribute("data-open", "false");
    await expect(page.locator(".fa-search-home .fa-search-peek")).toBeVisible();
  });

  test("the search input is MOVED, not rebuilt — same node, theme handlers intact", async ({ page }) => {
    // A reconstructed box looks identical and does nothing, because the
    // theme's script binds to the element it rendered. Identity is checked by
    // a property set on the original node before the script could have seen
    // it... which is not possible here, so the next best thing: the node
    // inside the panel carries the theme's own id and label.
    //
    // UNCHANGED IN SUBSTANCE, only in destination: the field now lands in
    // `.fa-search-home` in the navbar rather than in the tiles panel. This is
    // the invariant that survived the 2026-09-21 reversal intact, and it is
    // the one that matters most — a rebuilt box looks right and does nothing.
    await page.setContent(HARNESS);
    const input = page.locator(".fa-search-home .search input#search-input");
    await expect(input).toHaveCount(1);
    // The theme's own label came with it. NOT `aria-label` — the theme does
    // not emit one, which an earlier version of this fixture asserted and a
    // real build disproved.
    await expect(page.locator(".fa-search-home .search label[for='search-input']")).toHaveCount(1);
    // The results list travelled with it; a moved input with an orphaned
    // results container renders its hits into the main panel it just left.
    await expect(page.locator(".fa-search-home .search #search-results")).toHaveCount(1);
  });

  test("closed, the field collapses behind its magnifier; opened, it has size", async ({ page }) => {
    // Geometry, not text. `textContent` is DOM order regardless of CSS
    // display, so a collapsed field still answers every text assertion — the
    // input is in the document the whole time BY DESIGN, because the theme
    // looks it up by id and getElementById does not find a detached node.
    //
    // Was "in the navbar ... slid to the corner" until 2026-09-30, when the
    // owner asked for one magnifier that opens full width (issue #1715).
    await page.setContent(HARNESS);
    const input = page.locator("#search-input");

    // CLOSED — collapsed, but still in the document.
    await expect(input).toBeHidden();
    expect(await input.boundingBox()).toBeNull();
    await expect(input).toHaveCount(1);

    // OPEN — the magnifier is the way in, and back (`l4zi`).
    await page.locator(".fa-search-peek").click();
    await expect(input).toBeVisible();
    const box = await input.boundingBox();
    expect(box).not.toBeNull();
    // 24px is the SC 2.5.8 floor; the field is built at 36 and this holds the
    // legal minimum in case that comfort is ever spent.
    expect(box!.height).toBeGreaterThanOrEqual(24);
    expect(box!.width).toBeGreaterThan(80);
  });

  test("pressing Search puts the cursor in the field, from the keyboard alone", async ({ page }) => {
    // A reader who pressed a magnifier is going to type. And the whole path
    // is keyboard-driven here: Tab/Enter to the launcher, Enter on the tile.
    await page.setContent(HARNESS);
    await page.locator(".fa-tiles-toggle").focus();
    await page.keyboard.press("Enter");
    await page.locator(".fa-tile", { hasText: "Search" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#search-input")).toBeFocused();
    await page.keyboard.type("bean");
    await expect(page.locator("#search-input")).toHaveValue("bean");
  });

  test("closing and reopening keeps the SAME input, and what was typed in it", async ({ page }) => {
    // The failure this guards is unchanged and is the reason closing is a
    // STATE CHANGE rather than a move: a detached input is one
    // getElementById away from a dead search. What the reader typed must
    // survive the round trip too — that is the cheap observable proof the
    // node is the same node rather than a convincing replacement.
    //
    // The round trip was navbar -> corner -> navbar until 2026-09-30; it is
    // open -> closed -> open on the one magnifier since (issue #1715).
    await page.setContent(HARNESS);
    await page.locator(".fa-search-peek").click();
    await page.locator("#search-input").fill("workflow");

    await page.locator(".fa-search-peek").click();
    // Collapsed, still IN the document — this is the load-bearing bit.
    await expect(page.locator("#search-input")).toHaveCount(1);
    await expect(page.locator("#search-input")).toBeHidden();

    await page.locator(".fa-search-peek").click();
    await expect(page.locator(".fa-search-home")).toHaveAttribute("data-open", "true");
    await expect(page.locator("#search-input")).toBeVisible();
    await expect(page.locator("#search-input")).toHaveValue("workflow");
  });

  test("closing the whole panel does not destroy the search either", async ({ page }) => {
    await page.setContent(HARNESS);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Search" }).click();
    await page.keyboard.press("Escape"); // view -> grid
    await page.keyboard.press("Escape"); // grid -> closed
    await expect(page.locator(".fa-tiles")).toBeHidden();
    await expect(page.locator("#search-input")).toHaveCount(1);
  });

  test("the field's COMPUTED accessible name comes from the label, not the placeholder", async ({ page }) => {
    // The real accessibility tree, read out of Chromium — not the `for=`
    // association, which resolves whether or not the label is rendered.
    //
    // axe cannot check this: its `label` rule accepts a non-empty
    // `placeholder` as a last-resort pass, so an input whose real label has
    // been hidden with `display: none` sails through the automated gate. And
    // the theme's input carries NO `aria-label` — its name comes from the
    // `<label>` and the `sr-only` span in it, which is precisely why a
    // stylesheet is able to take that name away. Measured against a real
    // Jekyll build of this branch; the fixture had said otherwise.
    await page.setContent(HARNESS);
    await page.locator(".fa-tiles-toggle").click();
    await page.locator(".fa-tile", { hasText: "Search" }).click();
    // Straight out of Chromium's own accessibility tree over CDP.
    // `page.accessibility` was removed from Playwright, and every DOM-level
    // proxy for this question (a `for=` lookup, `getByLabel`) resolves
    // whether or not the label is rendered — which is exactly the case under
    // test, so a proxy here would be a guard that cannot fail.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Accessibility.enable");
    const named = async (): Promise<string> => {
      const { root } = (await cdp.send("DOM.getDocument", { depth: -1 })) as {
        root: { nodeId: number };
      };
      const { nodeId } = (await cdp.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: "#search-input",
      })) as { nodeId: number };
      const { nodes } = (await cdp.send("Accessibility.getPartialAXTree", {
        nodeId,
        fetchRelatives: false,
      })) as { nodes: { name?: { value?: string }; ignored?: boolean }[] };
      const self = nodes.find((n) => !n.ignored && n.name?.value !== undefined);
      return self?.name?.value ?? "";
    };
    expect(await named()).toBe("Search folio-assistant");

    // And the name must SURVIVE TYPING. A placeholder does not: it is gone
    // from the screen the moment there is a value, so an input named only by
    // one loses its name exactly when it is in use. Chromium stops offering
    // the placeholder as a name once the field is non-empty, which is what
    // makes this the assertion that separates the two sources. The kg
    // viewer's suite holds the same line for its own field.
    await page.keyboard.type("bean");
    await expect(page.locator("#search-input")).toHaveValue("bean");
    expect(await named()).toBe("Search folio-assistant");
  });

  test("the magnifier inside the field is hidden without hiding the label", async ({ page }) => {
    // Hidden visually, kept in the accessibility tree. `display: none` would
    // do both, which is the defect above.
    //
    // Looked in `.fa-tiles` until 2026-09-21; the field is in the navbar now,
    // and no tile press is needed to reach it.
    // Opened first since 2026-09-30: search starts closed, and a closed
    // field has no box to measure (issue #1715).
    await page.setContent(HARNESS);
    await page.locator(".fa-search-peek").click();
    const label = page.locator(".fa-search-home .search-label");
    await expect(label).toHaveCount(1);
    const style = await label.evaluate((e) => getComputedStyle(e).display);
    expect(style).not.toBe("none");
    // ...and it still takes up no room the reader can see.
    const box = await label.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(2);
    expect(box!.height).toBeLessThanOrEqual(2);
  });

  test("a site with no search gets no Search tile, and keeps its other tiles", async ({ page }) => {
    // `search_enabled: false`, or a theme that renamed the container. A tile
    // opening onto an empty panel is worse than a missing one.
    await page.setContent(harness(LINKS, ""));
    await page.locator(".fa-tiles-toggle").click();
    await expect(page.locator(".fa-tile", { hasText: "Search" })).toHaveCount(0);
    const captions = await page.locator(".fa-tiles-grid .fa-tile-caption").allTextContents();
    expect(captions[0]).toBe("Page settings");
    expect(captions).toContain("Knowledge graph");
  });

  test("light/dark is a tile under Settings, not in the grid", async ({ page }) => {
    // The owner placed it there. It is the one control here a reader sets once
    // and never touches, so it does not earn a row of prime space.
    await openTiles(page);
    await expect(page.locator(".fa-tiles-grid .fa-theme-toggle")).toHaveCount(0);
    await page.locator(".fa-tile", { hasText: "Page settings" }).click();
    await expect(page.locator(".fa-tiles-view .fa-theme-toggle")).toBeVisible();
  });

  test("the theme tile still switches the scheme, and says which it is in", async ({ page }) => {
    await openTiles(page);
    await page.locator(".fa-tile", { hasText: "Page settings" }).click();
    const theme = page.locator(".fa-theme-toggle");
    const before = await theme.getAttribute("aria-pressed");
    await theme.click();
    await expect(theme).not.toHaveAttribute("aria-pressed", String(before));
    // The caption and the accessible name must agree about the current state;
    // the icon alone is two similar bulbs at 20px.
    const label = await theme.getAttribute("aria-label");
    const caption = await theme.locator(".fa-tile-caption").textContent();
    expect(label).toContain(caption === "Light" ? "Light mode is on" : "Dark mode is on");
  });

  test("Back returns to the grid and to the tile that was pressed", async ({ page }) => {
    // Focus management, not decoration: the panel is rewritten in place, so a
    // reader who cannot easily point must not have to hunt for the keyboard.
    await openTiles(page);
    const tile = page.locator(".fa-tile", { hasText: "Language" });
    await tile.click();
    await expect(page.locator(".fa-tiles-grid")).toBeHidden();
    await page.locator(".fa-tiles-back").click();
    await expect(page.locator(".fa-tiles-grid")).toBeVisible();
    await expect(tile).toBeFocused();
  });

  test("opening a view moves focus to what the view became", async ({ page }) => {
    await openTiles(page);
    await page.locator(".fa-tile", { hasText: "QR code" }).click();
    await expect(page.locator(".fa-tiles-title")).toBeFocused();
    await expect(page.locator(".fa-tiles-title")).toHaveText("QR code");
  });

  test("Escape undoes one step, not three", async ({ page }) => {
    await openTiles(page);
    await page.locator(".fa-tile", { hasText: "Page settings" }).click();
    await page.keyboard.press("Escape");
    // Back to the grid — the panel is still open.
    await expect(page.locator(".fa-tiles-grid")).toBeVisible();
    await expect(page.locator(".fa-tiles")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".fa-tiles")).toBeHidden();
    await expect(page.locator(".fa-tiles-toggle")).toBeFocused();
  });

  test("the QR view encodes the address the reader is at", async ({ page }) => {
    await openTiles(page);
    await page.locator(".fa-tile", { hasText: "QR code" }).click();
    await expect(page.locator(".fa-tiles-view .fa-qr-panel svg")).toBeVisible();
    await expect(page.locator(".fa-qr-caption")).not.toBeEmpty();
  });

  test("every tile clears the 24px target floor, with room to spare", async ({ page }) => {
    // WCAG 2.2 SC 2.5.8 is the floor. A low-dexterity reader needs the margin,
    // so the tiles are built at 4rem and this holds the legal minimum in case
    // that comfort is ever spent.
    await openTiles(page);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const e of document.querySelectorAll(".fa-tiles button, .fa-tiles a[href]")) {
        const r = e.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 24 || r.width < 24) {
          out.push(`${e.textContent} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return out;
    });
    expect(small).toEqual([]);
  });

  test("every tile has an accessible name that is not just its glyph", async ({ page }) => {
    await openTiles(page);
    const names = await page.locator(".fa-tiles-grid .fa-tile").evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? ""),
    );
    expect(names.every((n) => n.length > 0)).toBe(true);
    // Every link says where it GOES, because "Source" and "JSON-LD" name
    // things and not destinations. Named rather than counted: the previous
    // `toHaveLength(2)` said nothing about WHICH tile had lost its hint, and
    // broke the moment a third link was added.
    const hinted = names.filter((n) => n.includes(" — "));
    for (const label of ["Knowledge graph", "JSON-LD", "Source"]) {
      expect(hinted.some((n) => n.startsWith(label + " — "))).toBe(true);
    }
  });

  test("the grid is reachable and operable from the keyboard alone", async ({ page }) => {
    await page.setContent(HARNESS);
    await page.locator(".fa-tiles-toggle").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".fa-tiles")).toBeVisible();
    // Real <button>s and <a>s, so Tab reaches them and Enter acts, without the
    // page having to implement either. A <div> with an onclick would pass a
    // click test and fail this one.
    await page.locator(".fa-tile", { hasText: "Page settings" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".fa-tiles-view .fa-theme-toggle")).toBeVisible();
  });

  /* ── Finding 11's RENDERED half (bean `ob3m`) ────────────────────────── */

  test("the declared tiles' glyphs: every tile draws one, and sameness only improves", async ({ page }) => {
    /*
     * Bean `ob3m` finding 11, the half `check:navbar-consistency` structurally
     * cannot reach. That check reads DECLARATIONS; this reads the rendered
     * panel, and the two answer different questions.
     *
     * THREE DENOMINATORS, and the bean is explicit that they must not be
     * quoted as one. Its render said "18 of 20 draw the identical outline";
     * its declaration half said "2 of 11 declared tiles name a glyph"; today
     * `harness.json` carries THIRTY. So no number is hardcoded from the bean's
     * prose below — every figure is computed from the fixture at run time, and
     * the only literal is the ratchet.
     *
     * WHY A RATCHET RATHER THAN AN EQUALITY. `TILE_GLYPHS` holds two entries
     * and `glyphFor` falls back to `NET_GLYPH` for every other name, so
     * sameness is this panel's DEFAULT rather than an accident. Pinning the
     * current figure as an equality would go red the first time somebody draws
     * a new glyph — it would fail on the improvement it exists to encourage.
     * Pinning it as a ceiling fails only when sameness gets WORSE, which is
     * the regression, and quietly permits every step toward fixing it.
     */
    await page.setContent(harness(LINKS, SEARCH_MARKUP, DECLARED_TILES));
    await page.locator(".fa-tiles-toggle").click();

    const declared = (HARNESS_DATA.tiles ?? []).filter((x) => !x.hidden);
    const named = declared.filter((x) => typeof x.icon === "string" && x.icon.length > 0);

    // The fixture has to actually mount them, or everything after it is
    // vacuous — a panel that rendered none of the declared tiles would pass
    // every assertion below (`dh4f`). The first probe of this spec rendered
    // SIX tiles and reported them all distinct, because it was measuring the
    // built-in controls and not the declared tiles at all.
    const grid = page.locator(".fa-tiles-grid .fa-tile");
    expect(declared.length).toBeGreaterThan(10);
    expect(await grid.count()).toBeGreaterThan(declared.length);

    // Every tile draws SOMETHING. A tile with no glyph is a worse defect than
    // a repeated one: the fallback is at least a mark you can aim at.
    expect(await page.locator(".fa-tiles-grid .fa-tile:not(:has(svg))").count()).toBe(0);

    const svgs = await page
      .locator(".fa-tiles-grid .fa-tile svg")
      .evaluateAll((ns) => ns.map((n) => (n as SVGElement).outerHTML));
    const groups = new Map<string, number>();
    for (const s of svgs) groups.set(s, (groups.get(s) ?? 0) + 1);
    const largestIdenticalGroup = Math.max(...groups.values());

    /*
     * THE RATCHET. Measured 2026-09-30 on this fixture: of 30 declared tiles,
     * 2 name a glyph (`beans`, `uploads` — exactly the two `TILE_GLYPHS` has),
     * so 28 fall back to one drawing and that is the largest identical group.
     * Lower this number when you draw a glyph; it must never be raised.
     */
    const FALLBACK_CEILING = 28;
    expect(
      largestIdenticalGroup,
      `${largestIdenticalGroup} tiles draw the SAME glyph, out of ${svgs.length} rendered ` +
        `(${named.length} of ${declared.length} declared tiles name one, and ` +
        `${groups.size} distinct drawings appear). The ceiling is ${FALLBACK_CEILING}. ` +
        "If you drew a new glyph, LOWER the ceiling to what you measured. If this rose " +
        "without anyone drawing one, a glyph name stopped resolving — check TILE_GLYPHS " +
        "against the `icon` values in docs/_data/harness.json.",
    ).toBeLessThanOrEqual(FALLBACK_CEILING);

    /*
     * NAMING AN ICON HAS TO BUY SOMETHING — and the first version of this
     * assertion could not tell whether it did. It read
     * `expect(groups.size).toBeGreaterThan(1)`, over the WHOLE panel. The
     * built-in controls (Settings, Language, QR code, Knowledge graph,
     * JSON-LD, Source) each carry their own hardcoded drawing and never go
     * through `glyphFor`, so nine distinct drawings appear no matter what the
     * registry does: the assertion passed with every declared tile on the
     * fallback, which is the state it was written to reject. Vacuous, in the
     * `dh4f` sense, and caught by trying to falsify it rather than by reading
     * it.
     *
     * What it checks now is the actual property: the tile of each tile that
     * NAMES a glyph draws something other than the fallback. The fallback is
     * identified as the dominant drawing rather than assumed to be
     * `NET_GLYPH`, so this keeps working if the fallback is redrawn.
     */
    const dominant = [...groups.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const tile of named) {
      const svg = await page
        .locator(".fa-tiles-grid .fa-tile", { hasText: tile.title })
        .first()
        .locator("svg")
        .evaluate((n) => (n as SVGElement).outerHTML);
      expect(
        svg,
        `tile "${tile.title}" declares icon "${tile.icon}" but draws the FALLBACK. ` +
          "Either the name is missing from TILE_GLYPHS in docs-ui.js, or it is " +
          "registered to the fallback drawing — either way the declaration buys nothing.",
      ).not.toBe(dominant);
    }
  });

});
