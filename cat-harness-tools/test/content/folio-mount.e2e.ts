import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { MARKER } from "../../scripts/folio-mount.ts";
import { TRANSLATION_META_ID } from "../../scripts/lib/translation-meta.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * THE FOLIO MOUNT on a REAL generated who-iris page. Bean `jpjt`, F8/F9.
 *
 * Owner: *"who-iris, smart-* etc are content libraries a user is browsing and
 * their 'folio' from the cat-harness is consistent across them."*
 *
 * ## Why this reads the generated file instead of building a fixture
 *
 * `glass.e2e.ts` already proves the glass mounts on a page with no
 * just-the-docs furniture — but it proves it against a REPLICA the test
 * itself writes, which is the test author's idea of what a who-iris page
 * looks like. `check-invocation-parity` is the standing lesson here: *a
 * matcher proven only against fixtures is proven against its author's idea of
 * the file.*
 *
 * So the bytes below come off disk: the page `gen-iris-pages.ts` actually
 * wrote, the `docs-ui.css` and `docs-ui.js` actually published. If the
 * generator stops emitting the mount, or the mount's derived root stops
 * finding the assets, these fail.
 *
 * ## The fidelity assertion is the point, not a nicety
 *
 * who-iris exists to be a faithful replica — *"ingested copy — not WHO, not
 * live"* is its requirement 1, and the page is built from the captured IRIS
 * theme *"verbatim"*. A folio that restyled it would have failed F8/F9 rather
 * than met it, and it would fail invisibly: the folio would work.
 *
 * `docs-ui.css` is 587 distinct selectors. Swept before writing this, exactly
 * **one** is globally scoped in a way a replica can feel — `:focus-visible`,
 * which paints a 3px `currentColor` outline. Everything else is `.fa-*`,
 * `:root` custom properties (inert unless referenced), just-the-docs class
 * names absent here, or `*` inside `prefers-reduced-motion`. That sweep is a
 * claim about a file; the test below is the measurement, over every element
 * the replica renders.
 */

const ROOT = join(HARNESS_ROOT);
const REPO = repoRootFor(ROOT);

const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

/**
 * A page the generator wrote. `index.html` is the replica's home, the page a
 * reader arrives on, so the one whose folio matters most. It was
 * `community-list.html` until the owner removed the item, collection and
 * community-list pages (2026-10-30, who-iris `site/README.md`); only the
 * IRIS-style home is still built.
 */
const PAGE_FILE = join(REPO, "who-iris", "site", "index.html");
const PAGE = existsSync(PAGE_FILE) ? readFileSync(PAGE_FILE, "utf8") : "";

/**
 * The same page with the mount REMOVED — the control for the fidelity
 * comparison below.
 *
 * It strips the whole `<script>` ELEMENT, and the first version of this
 * renamed the marker attribute instead. That control was worthless and said
 * so only under falsification: the attribute is a marker for the gate, not
 * what makes the script run, so the inline script still executed, still
 * appended `docs-ui.css`, and "with" and "without" were the same page. The
 * fidelity test passed a deliberately injected `body { font-size: 22px }`.
 *
 * Kept as a comment rather than quietly fixed because the shape recurs: a
 * control that does not remove the thing under test makes every comparison
 * against it vacuous, and it fails silently in the passing direction.
 */
function withoutMount(html: string): string {
  const i = html.indexOf(`<script ${MARKER}>`);
  if (i < 0) return html;
  const j = html.indexOf("</script>", i) + "</script>".length;
  return html.slice(0, i) + html.slice(j);
}

/**
 * Serve the real page at `path`, with the platform assets at the site root
 * the mount derives. `page.route` rather than a server, as
 * `staging-banner.e2e.ts` does, because the 404 on the todo index has to be
 * produced exactly rather than arranged — a replica page has no todo index
 * and the glass must come down anyway.
 */
async function serve(
  page: import("@playwright/test").Page,
  path: string,
  opts: { withMount?: boolean } = {},
): Promise<string[]> {
  const asked: string[] = [];
  const body = opts.withMount === false ? withoutMount(PAGE) : PAGE;

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    asked.push(url.pathname);
    if (url.pathname.endsWith("assets/css/docs-ui.css")) {
      return route.fulfill({ status: 200, contentType: "text/css", body: CSS });
    }
    if (url.pathname.endsWith("assets/js/docs-ui.js")) {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: JS });
    }
    if (url.pathname.endsWith(".json")) {
      return route.fulfill({ status: 404, body: "not found" });
    }
    if (/\.(png|svg|jpe?g|woff2?|ico)$/.test(url.pathname)) {
      return route.fulfill({ status: 404, body: "" });
    }
    return route.fulfill({ status: 200, contentType: "text/html", body });
  });

  await page.goto(`http://127.0.0.1:8080${path}`);
  await page.waitForLoadState("networkidle");
  return asked;
}

test.describe("the generated page carries the mount", () => {
  test("the file gen-iris-pages.ts wrote contains the marker", () => {
    // Guards the whole file: every assertion below is vacuous if the page was
    // never generated, and a suite that passes over a missing artefact is the
    // `dh4f` shape.
    expect(PAGE, `${PAGE_FILE} is missing — run \`bun run cat iris:pages\``).not.toBe("");
    expect(PAGE).toContain(MARKER);
  });
});

test.describe("the glass comes down on a library page", () => {
  test("the handle is there, on the route library/ is served at", async ({ page }) => {
    await serve(page, "/who-iris/index.html");
    await expect(page.locator(".fa-glass-handle")).toBeVisible();
  });

  test("and on the OTHER mount route, where a relative href would 404", async ({ page }) => {
    // `who-iris/site/` is served at `/who-iris/` and `who-iris/docs/` at
    // `/docs/who-iris/`. One generated file, two depths below the site root —
    // which is the whole reason the root is derived in the browser.
    await serve(page, "/docs/who-iris/index.html");
    await expect(page.locator(".fa-glass-handle")).toBeVisible();
  });

  test("and under a staging preview, where an absolute site URL would break", async ({ page }) => {
    await serve(page, "/folio-assistant/STAGING/claude-example/who-iris/index.html");
    await expect(page.locator(".fa-glass-handle")).toBeVisible();
  });

  test("it opens, and closing is reachable — `l4zi`", async ({ page }) => {
    await serve(page, "/who-iris/index.html");
    const handle = page.locator(".fa-glass-handle");
    await handle.click();
    await expect(page.locator('.fa-sticky-layer[data-fa-glass="open"]')).toBeVisible();
    await handle.click();
    await expect(page.locator('.fa-sticky-layer[data-fa-glass="open"]')).toHaveCount(0);
  });

  test("an empty glass says so rather than looking broken", async ({ page }) => {
    // The todo index 404s on a replica — there is no folio content here yet.
    // "Nothing on your glass" and "the glass is broken" are opposite facts.
    await serve(page, "/who-iris/index.html");
    await page.locator(".fa-glass-handle").click();
    await expect(page.locator(".fa-glass-empty")).toBeVisible();
  });
});

test.describe("a path the pattern does not match", () => {
  test("requests no platform assets rather than guessing a root", async ({ page }) => {
    // Returning `null` is a real state. A client that guessed would issue two
    // requests that 404 on every page of a layer that mis-declared its
    // route — noise that looks like a broken site rather than a wrong config.
    const asked = await serve(page, "/somewhere/else/page.html");
    expect(asked.filter((p) => p.includes("docs-ui"))).toHaveLength(0);
  });
});

test.describe("the replica is unchanged with the glass closed", () => {
  /**
   * Every element's computed box and colour, keyed by a stable path. Compared
   * between the page with the mount and the same page without it.
   *
   * POSITIONS ARE MEASURED FROM THE TOP OF BODY'S CONTENT, not the viewport —
   * bean `g9r2`, owner 2026-09-29: "Band on replicas". The top-centre handle
   * (`2vne`) covered the ingested-copy banner, and the owner chose to reserve
   * a band above the replica rather than move the handle. That band is body
   * `padding-top`, so the replica as a whole sits lower and nothing inside it
   * changes. Measured from the viewport, this test would call every element
   * "moved"; measured from the content edge it still fails on a restyle, a
   * resize, or any shift that is not the whole page at once. The band itself
   * is asserted separately below, so it cannot grow unseen.
   */
  const snapshot = async (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const out: Record<string, string> = {};
      const b = document.body.getBoundingClientRect();
      const bs = getComputedStyle(document.body);
      const ox = b.x + parseFloat(bs.paddingLeft);
      const oy = b.y + parseFloat(bs.paddingTop);
      const walk = (el: Element, path: string) => {
        // The folio's own chrome is not the replica and is excluded by name;
        // everything else the page renders is compared.
        if (el.className && String(el.className).indexOf("fa-") === 0) return;
        const c = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        // BODY carries the band, so its padding and height are the band's
        // business and are asserted on their own; its colours still count.
        const isBody = el === document.body;
        out[path] =
          [c.color, c.backgroundColor, c.fontFamily, c.fontSize, c.fontWeight, c.lineHeight,
            c.margin, isBody ? "" : c.padding, c.border, c.display, c.textDecorationLine].join("|") +
          "#" + (isBody ? [r.width] : [r.x - ox, r.y - oy, r.width, r.height]).map((n) => Math.round(n)).join(",");
        // AN ELEMENT WITH NO BOX HAS NO POSITION TO KEEP. A `display: none`
        // element (the replica's `<script type="application/json"
        // data-fa-visualiser-nav>`, the data its rail is drawn from) reports
        // a zero rectangle at the VIEWPORT's origin whatever the page does,
        // so measured from the content edge it "moved" by exactly the band
        // (0,0 -> 0,-36) while nothing was drawn anywhere. Its styles are
        // still compared, and so is whether it has a box at all: an element
        // that gains or loses one still fails.
        if (!isBody && el.getClientRects().length === 0) out[path] = out[path].replace(/#.*$/, "#no box");
        let i = 0;
        for (const kid of Array.from(el.children)) walk(kid, `${path}/${kid.tagName}[${i++}]`);
      };
      walk(document.body, "BODY");
      return out;
    });

  test("no element moves, resizes or changes colour", async ({ page }) => {
    // The REAL page, translation block and all (bean `uvt0`, owner 2026-10-06:
    // "Overlay, no shift"). From #2229 until uvt0 both sides stripped the
    // block, because the locale band then sat in the flow and moved <main>
    // down 52px; that comparison could not see the shift a reader got. The
    // band is now an overlay on the strip the replica already reserves, so the
    // translated page is the one compared. The premise is asserted: the block
    // is present, and the band really drew its locale control.
    expect(PAGE).toContain(`id="${TRANSLATION_META_ID}"`);

    await serve(page, "/who-iris/index.html", { withMount: false });
    const before = await snapshot(page);

    await serve(page, "/who-iris/index.html");
    await expect(page.locator(".fa-glass-handle")).toBeVisible(); // the mount really ran
    await expect(page.locator(".fa-page-lang-toggle")).toHaveCount(1); // and so did the locale band
    const after = await snapshot(page);

    const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
    expect(
      changed.map((k) => `${k}\n  without: ${before[k]}\n  with:    ${after[k]}`).join("\n"),
    ).toBe("");
    // A snapshot of nothing would satisfy the line above, so the premise is
    // asserted: the same trap `site-mark-mask.test.ts` fell into.
    expect(Object.keys(before).length).toBeGreaterThan(20);
  });

  test("the locale band is an overlay on the reserved strip, not a row in the flow (uvt0)", async ({ page }) => {
    await serve(page, "/who-iris/index.html");
    await expect(page.locator(".fa-page-lang-toggle")).toBeVisible();
    const g = await page.evaluate(() => {
      const band = document.querySelector(".fa-glass-band[data-fa-band-tools]")!;
      const r = band.getBoundingClientRect();
      return {
        position: getComputedStyle(band).position,
        overlay: band.hasAttribute("data-fa-band-overlay"),
        inBody: band.parentElement === document.body,
        top: r.top,
        bottom: r.bottom,
        padding: parseFloat(getComputedStyle(document.body).paddingTop),
        bannerTop: document.querySelector(".ingested")!.getBoundingClientRect().top,
      };
    });
    expect(g.overlay).toBe(true);
    expect(g.inBody).toBe(true);
    expect(g.position).toBe("fixed");
    // It occupies the strip body already reserves, and nothing below it.
    expect(g.padding).toBe(36);
    expect(g.top).toBe(0);
    expect(g.bottom).toBeLessThanOrEqual(g.padding);
    expect(g.bannerTop).toBeGreaterThanOrEqual(g.bottom);
  });

  // Sharing the strip means sharing it with the handle: the locale control sits
  // at the inline START, the handle at the centre, and they must not touch —
  // in RTL at phone width too, where the start is the right edge.
  for (const [path, width] of [
    ["/who-iris/index.html", 1280],
    ["/who-iris/index.html", 390],
    ["/who-iris/ar/index.html", 1280],
    ["/who-iris/ar/index.html", 390],
  ] as const) {
    test(`the locale control clears the handle on the shared strip (uvt0, ${path} @ ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await serve(page, path);
      await expect(page.locator(".fa-page-lang-toggle")).toBeVisible();
      await expect(page.locator(".fa-glass-handle")).toBeVisible();
      const [ctrl, handle] = await page.evaluate(() =>
        [".fa-page-lang-bar", ".fa-glass-handle"].map((s) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return { left: r.left, right: r.right };
        }),
      );
      expect(ctrl.right <= handle.left || ctrl.left >= handle.right).toBe(true);
    });
  }

  test("the band above the replica is the handle's, and clears it", async ({ page }) => {
    await serve(page, "/who-iris/index.html");
    const handle = page.locator(".fa-glass-handle");
    await expect(handle).toBeVisible();
    const [band, handleBottom, bannerTop] = await page.evaluate(() => [
      parseFloat(getComputedStyle(document.body).paddingTop),
      document.querySelector(".fa-glass-handle")!.getBoundingClientRect().bottom,
      document.querySelector(".ingested")!.getBoundingClientRect().top,
    ]);
    // 2.25rem, the viewers' band: one reservation, not a second number.
    expect(band).toBe(36);
    // The point of the band: the banner starts below the handle.
    expect(bannerTop).toBeGreaterThanOrEqual(handleBottom);
  });

  test("the ingested-copy banner — who-iris requirement 1 — still reads as itself", async ({ page }) => {
    await serve(page, "/who-iris/index.html");
    const banner = page.locator(".ingested").first();
    await expect(banner).toBeVisible();
    await expect(banner).toHaveCSS("background-color", "rgb(0, 102, 102)");
  });
});

/**
 * A REPLICA ON A PHONE does not pan sideways — bean `g9r2`. Measured
 * 2026-09-29 on this page: 537 px wide at 390, because a stacked download
 * cell kept the desktop `nowrap` on a whole sentence. The glass is mounted
 * here, as a reader has it; the fidelity test above already proves the
 * mount itself moves nothing.
 */
test.describe("the replica at phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the page is no wider than the screen", async ({ page }) => {
    await serve(page, "/who-iris/index.html");
    const [scroll, client] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scroll, "the page scrolls sideways at 390 px").toBeLessThanOrEqual(client);
  });
});

/**
 * ...AND ON A DESKTOP. The phone case above let the desktop one through: the
 * 2026-09-30 QA re-run measured community-list.html 1475 px wide at 1280 and
 * 1405 px at 1024, because the "Metadata record" column kept `nowrap` on its
 * longest file name at every width but a phone's. Same page, same assertion,
 * the two widths that overflowed.
 */
for (const width of [1024, 1280]) {
  test.describe("the replica at " + width + " px", () => {
    test.use({ viewport: { width, height: 800 } });

    test("the page is no wider than the screen", async ({ page }) => {
      await serve(page, "/who-iris/index.html");
      const [scroll, client] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scroll, "the page scrolls sideways at " + width + " px").toBeLessThanOrEqual(client);
    });
  });
}
