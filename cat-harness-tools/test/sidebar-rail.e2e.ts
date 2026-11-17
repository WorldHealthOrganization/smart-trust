import { test, expect, type Page } from "@playwright/test";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { navbarHtml } from "../scripts/lib/navbar.ts";
import { NAV_COLLAPSED_PX, NAV_OPEN_PX, NAV_OPEN_WIDE_PX } from "../scripts/lib/navbar-geometry.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";
import { COPY_ID_SUFFIX } from "../scripts/gen-navbar-include.ts";

/**
 * The theme sidebar wears the viewer rail's layout: ONE scroll region.
 *
 * Owner ruling on bean ob3m finding 7, 2026-10-01, option 1 of 4: *"Use the
 * viewer-rail layout on Jekyll pages."* The generated rail (`lib/navbar.ts`,
 * #1762) has one scroller, the page's own section first and a folded "Graphs"
 * group after it. On a theme page the same reader met, measured on the built
 * landing at 1280x800 with every group open: the middle at its 128px floor
 * with 0 of 430 page links visible because FOLDERS sat above them, a second
 * scroller in the footer's harness group, and `.side-bar` clipping 2108px of
 * content into 800.
 *
 * ## What is asserted, and why as properties
 *
 * Three properties the ruling names, each one a thing a reader can see:
 *
 *   - exactly ONE element in the sidebar scrolls, and the sidebar itself
 *     hides nothing it cannot scroll to -- on arrival AND with every
 *     disclosure open, because nested scrollers only appear once things open;
 *   - FOLDERS -- a top-level section since the owner's ruling on #2150
 *     (2026-10-05, option (a): no "Graphs" wrapper on this surface) -- and
 *     the harness group beside it are both
 *     folded on arrival, and both headings are on screen -- ▦ Harnesses
 *     stays its own disclosure, as on the viewer rail, so the strip still
 *     shows it at rest (ob3m finding 1, #1805; `rail-tips.e2e.ts`);
 *   - page-list links are visible in the open sidebar, hit-tested rather than
 *     read off a box, because a link under another region is in the DOM, has
 *     a size, and cannot be clicked.
 *
 * ## The footer is the REAL one
 *
 * The harness group is read from `_includes/generated/navbar-footer.html`, the
 * include the site ships, with its Liquid resolved the one way it is used here
 * (the canonical branch, `relative_url` as the baseurl). A hand-written footer
 * in an older shape is exactly how `navbar-row.e2e.ts` came to test a harness
 * block (`.fa-harness-tabs`) that the generator no longer emits.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERAL below -- the page is one, so a
 * backtick in it ends the string (bean `bmr0`).
 */

const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
// The row's own stylesheet FIRST, as `head_custom.html` links it (beans `lhvt`, `9rq1`).
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/navbar-row.css"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
// `navbar-row.js` FIRST — it draws the row, and `docs-ui.js` calls it — as `head_custom.html` loads them.
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const QR = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");
const BASEURL = "/folio-assistant";

type Folder = { kind: string; label?: string; path?: string; note?: string; stagingOnly?: true };
const HARNESS = JSON.parse(readFileSync(overlayPath(join(ROOT, SITE, "_data/harness.json")), "utf8")) as {
  navbar: { folders?: Folder[] } | null;
  railScopes?: { name: string; title: string; href: string; folders: Folder[] }[];
};
if (HARNESS.navbar === null || HARNESS.navbar === undefined) {
  throw new Error("docs/_data/harness.json has no navbar row. Run `bun run cat docs:harness`.");
}

/** The generated footer include, canonical branch, Liquid resolved. */
function footer(): string {
  const src = readFileSync(overlayPath(join(ROOT, SITE, "_includes/generated/navbar-footer.html")), "utf8");
  const open = "{%- if _fa_staging == '' -%}";
  const at = src.indexOf(open);
  const end = src.indexOf("{%- else -%}", at);
  if (at < 0 || end < 0) throw new Error("navbar-footer.html: canonical branch not found");
  const branch = src.slice(at + open.length, end);
  // The FIRST copy of the include, as the theme renders it: its ids carry no
  // per-copy suffix (gen-navbar-include COPY_ID_SUFFIX).
  const html = branch.split(COPY_ID_SUFFIX).join("").replace(/\{\{ '([^']*)' \| relative_url \}\}/g, (_m, p: string) => BASEURL + p);
  if (/\{\{|\{%/.test(html)) throw new Error("navbar-footer.html: unresolved Liquid in the canonical branch");
  return '<input type="checkbox" class="fa-nav-open" id="fa-nav-open">' + html;
}

/** Enough sections for "On this page", and a page list longer than any window. */
const MAIN = Array.from({ length: 12 }, (_, i) => '<h2 id="s' + i + '">Section ' + i + "</h2><p>text</p>").join("");
const NAV_ITEMS = Array.from(
  { length: 60 },
  (_, i) => '<li class="nav-list-item"><a class="nav-list-link" href="#p' + i + '">Page ' + i + "</a></li>",
).join("");

/**
 * THE SCOPE UNDER TEST (#1902), taken from the generated data rather than
 * named: the first layer `railScopes` lists. The fixture page sits at that
 * layer's root, and its page list holds the layer's root row with a
 * table of contents under it, among the site's 60 other pages.
 */
const SCOPE = (HARNESS.railScopes ?? [])[0];
const TOC = ["Home", "Business Requirements", "Deployment"];
function scopedNavItem(): string {
  if (!SCOPE) return "";
  const kids = TOC.map(
    (t, i) => '<li class="nav-list-item"><a class="nav-list-link" href="' + BASEURL + SCOPE.href + "toc-" + i + '.html">' + t + "</a></li>",
  ).join("");
  return '<li class="nav-list-item"><button class="nav-list-expander" aria-expanded="false"></button>' +
    '<a class="nav-list-link" href="' + BASEURL + SCOPE.href + '">' + SCOPE.title + '</a><ul class="nav-list">' + kids + "</ul></li>";
}

function page(scoped = false): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="fa-baseurl" content="${BASEURL}">
  <meta name="fa-staging" content="">
  <style>
  body { margin: 0; }
  /* The theme's structure, copied from a built page: a fixed full-height
     flex column with a height-capped header, the page list, and the footer
     that carries the generated include. */
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; align-items: flex-end;
              background: #27262b; color: #fff; z-index: 0; }
  .site-header { width: 100%; max-height: 3.75rem; overflow: hidden; display: flex; align-items: center; }
  /* The theme sizes the avatar link to its 3.75rem header; it is a link now (the open control). */
  .site-title { flex: 1; display: flex; align-items: center; min-height: 3.75rem; }
  .site-nav { width: 100%; overflow-y: auto; }
  .nav-list { margin: 0; padding: 0; list-style: none; }
  .site-nav a { display: block; padding: 4px 32px; font-size: 14px; line-height: 24px; color: #9ec5fe; }
  .d-none { display: none !important; }
  @media (min-width: 50rem) { .d-md-block { display: block !important; } .d-md-none { display: none !important; } .main { margin-left: 16.5rem; } }
  /* The theme folds a row's children until it is active; the fixture keeps that rule. */
  .nav-list .nav-list-item > .nav-list { display: none; }
  .nav-list .nav-list-item.active > .nav-list { display: block; }
  ${CSS}
</style></head><body>
  <script type="application/json" id="fa-navbar-row">${JSON.stringify(HARNESS.navbar)}<\/script>
  ${scoped && SCOPE ? '<script type="application/json" id="fa-rail-scope">' + JSON.stringify(SCOPE) + "<\/script>" : ""}
  <div class="side-bar">
    <div class="site-header"><a class="site-title" href="/folio-assistant/"><span class="fa-site-mark"></span><span class="fa-site-title">folio-assistant</span></a></div>
    <nav aria-label="Main" id="site-nav" class="site-nav"><ul class="nav-list">${NAV_ITEMS}${scoped ? scopedNavItem() : ""}</ul></nav>
    <div class="d-md-block d-none site-footer">${footer()}</div>
  </div>
  <div class="main"><div class="main-header"></div><div class="main-content">${MAIN}</div></div>
  <script>window.jtd = { theme: "dark",
    getTheme: function () { return this.theme; },
    setTheme: function (t) { this.theme = t; } };<\/script>
  <script>${QR}<\/script>
  <script>${JS}<\/script>
</body></html>`;
}

const fixturePage = (): string => page();

const RAIL_CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/navbar.css"))), "utf8");

function railedPage(): string {
  const navHtml = navbarHtml({
    instance: "cat-harness",
    hrefs: "resolved",
    openControl: "input",
    headHref: "/",
    folders: HARNESS.navbar?.folders ?? [],
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <style>
  body { margin: 0; font-family: sans-serif; }
  .page-main { background: #222; color: #fff; min-height: 100vh; padding: 20px; box-sizing: border-box; }
  ${RAIL_CSS}
  </style></head><body>
  ${navHtml}
  <main class="page-main"><h1>Railed Page</h1><div class="content">${MAIN}</div></main>
</body></html>`;
}

async function captureScreenshot(p: Page, name: string): Promise<void> {
  const dir1 = join(ROOT, "test/results/ei4q");
  mkdirSync(dir1, { recursive: true });
  const file1 = join(dir1, name);
  await p.screenshot({ path: file1 });

  const artifactDir = "/Users/litlfred/.gemini/antigravity-cli/brain/436871eb-bb7e-4520-b04e-79e16c8ca6d7";
  if (existsSync(artifactDir)) {
    copyFileSync(file1, join(artifactDir, name));
  }
}

async function _load(p: Page, scoped = false): Promise<string[]> {
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  // Served from an origin rather than set as content, so localStorage works.
  await p.route("http://sidebar.fixture/**", (r) => r.fulfill({ contentType: "text/html", body: page(scoped) }));
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.goto("http://sidebar.fixture" + (scoped && SCOPE ? BASEURL + SCOPE.href : "/page"), { waitUntil: "load" });
  // PINNED OPEN, the state the ruling is about. Set on the checkbox: since
  // 2026-10-30 a pointer click on the avatar of a hovered (open) bar goes to
  // the landing page rather than pinning it.
  await p.evaluate(() => { const b = document.getElementById("fa-nav-open") as HTMLInputElement; b.checked = true; b.dispatchEvent(new Event("change")); });
  await expect(p.locator("#fa-nav-open")).toBeChecked();
  await p.mouse.move(1270, 790);
  await p.waitForTimeout(300);
  return errors;
}

/** Every element in the sidebar that actually scrolls, and whether the bar clips. */
async function _scrolling(p: Page): Promise<{ scrollers: string[]; clipped: number }> {
  return p.evaluate(() => {
    const bar = document.querySelector(".side-bar") as HTMLElement;
    const scrollers = [bar, ...Array.from(bar.querySelectorAll<HTMLElement>("*"))]
      .filter((e) => {
        const s = getComputedStyle(e);
        return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1 && e.getClientRects().length > 0;
      })
      .map((e) => e.tagName.toLowerCase() + "." + Array.from(e.classList).join("."));
    // A bar with overflow hidden that is taller inside than out is hiding
    // content nobody can scroll to -- a scroller that does not admit to it.
    // The same question of every region INSIDE the one scroller: a flex
    // child allowed to shrink is clipped rather than scrolled, which is how an
    // open "On this page" was once squeezed to a sliver.
    const mid = bar.querySelector(".fa-nav-middle");
    const inner = mid
      ? Array.from(mid.children as HTMLCollectionOf<HTMLElement>).reduce(
          (n, e) => n + Math.max(0, e.scrollHeight - e.clientHeight - 1),
          0,
        )
      : 0;
    return { scrollers, clipped: Math.max(0, bar.scrollHeight - bar.clientHeight - 1) + inner };
  });
}

/** Page-list links a pointer can actually land on, in the window. */
async function _visiblePageLinks(p: Page): Promise<number> {
  return p.evaluate(() => {
    let n = 0;
    for (const a of Array.from(document.querySelectorAll<HTMLElement>(".side-bar .site-nav a"))) {
      const r = a.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const x = r.left + Math.min(20, r.width / 2);
      const y = r.top + r.height / 2;
      if (y < 0 || y > innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === a || a.contains(hit))) n++;
    }
    return n;
  });
}

test.describe("on desktop opening the rail shrinks content width so they do not overlap (bean ei4q)", () => {
  test("theme sidebar: opening the rail at 1280px shrinks content width and bounding client rectangles do not intersect", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("http://sidebar.fixture/**", (r) => r.fulfill({ contentType: "text/html", body: fixturePage() }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://sidebar.fixture/page", { waitUntil: "load" });
    await page.mouse.move(1270, 790);
    // Hover test: opening via hover widens rail and pushes main content
    await page.locator(".side-bar").hover();
    await page.waitForTimeout(300);
    const hoverSidebar = (await page.locator(".side-bar").boundingBox())!;
    const hoverMain = (await page.locator(".main").boundingBox())!;
    expect(hoverSidebar.width).toBe(NAV_OPEN_WIDE_PX);
    expect(hoverSidebar.x + hoverSidebar.width).toBeLessThanOrEqual(hoverMain.x + 0.5);

    // Mouse away: restores closed state
    await page.mouse.move(1270, 790);
    await page.waitForTimeout(300);

    // Closed state: sidebar is collapsed strip, main content has full width
    const closedSidebar = (await page.locator(".side-bar").boundingBox())!;
    const closedMain = (await page.locator(".main").boundingBox())!;
    expect(closedSidebar.width).toBe(NAV_COLLAPSED_PX);
    expect(closedSidebar.x + closedSidebar.width).toBeLessThanOrEqual(closedMain.x + 0.5);
    await captureScreenshot(page, "sidebar-1280-closed.png");

    // Pin open on the checkbox (a click on an open bar's avatar goes home since 2026-10-30)
    await page.evaluate(() => { const b = document.getElementById("fa-nav-open") as HTMLInputElement; b.checked = true; b.dispatchEvent(new Event("change")); });
    await expect(page.locator("#fa-nav-open")).toBeChecked();
    await page.mouse.move(1270, 790);
    await page.waitForTimeout(300);

    const openSidebar = (await page.locator(".side-bar").boundingBox())!;
    const openMain = (await page.locator(".main").boundingBox())!;
    const openContent = (await page.locator(".main-content").boundingBox())!;

    // 1. Sidebar widened to wide open width (16.5rem = 264px)
    expect(openSidebar.width).toBe(NAV_OPEN_WIDE_PX);
    // 2. Bounding rectangles DO NOT intersect: rail's right edge <= main's left edge
    expect(openSidebar.x + openSidebar.width).toBeLessThanOrEqual(openMain.x + 0.5);
    expect(openSidebar.x + openSidebar.width).toBeLessThanOrEqual(openContent.x + 0.5);
    // 3. Main content width shrunk by the exact expansion of the sidebar
    expect(openMain.width).toBeLessThan(closedMain.width);
    expect(closedMain.width - openMain.width).toBeCloseTo(openSidebar.width - closedSidebar.width, 1);
    await captureScreenshot(page, "sidebar-1280-open.png");

    // Close: restores full width
    await page.evaluate(() => { const b = document.getElementById("fa-nav-open") as HTMLInputElement; b.checked = false; b.dispatchEvent(new Event("change")); });
    await expect(page.locator("#fa-nav-open")).not.toBeChecked();
    await page.mouse.move(1270, 790);
    await page.waitForTimeout(300);

    const restoredMain = (await page.locator(".main").boundingBox())!;
    expect(restoredMain.width).toBeCloseTo(closedMain.width, 1);

    expect(errors).toEqual([]);
  });

  test("theme sidebar: on phone (390px) the rail stays an overlay drawer", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("http://sidebar.fixture/**", (r) => r.fulfill({ contentType: "text/html", body: fixturePage() }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://sidebar.fixture/page", { waitUntil: "load" });
    await page.waitForTimeout(200);

    await captureScreenshot(page, "sidebar-390-closed.png");

    // On phone, checking #fa-nav-open opens drawer over page without shrinking content
    await page.evaluate(() => {
      const box = document.getElementById("fa-nav-open") as HTMLInputElement | null;
      if (box) {
        box.checked = true;
        box.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await captureScreenshot(page, "sidebar-390-open.png");

    // Content width on phone is not shrunk to nothing
    const mainBox = (await page.locator(".main").boundingBox())!;
    expect(mainBox.width).toBe(390);

    expect(errors).toEqual([]);
  });

  test("fa-nav layout: opening the rail at 1280px shrinks content width and rectangles do not intersect", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("http://rail.fixture/**", (r) => r.fulfill({ contentType: "text/html", body: railedPage() }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://rail.fixture/page", { waitUntil: "load" });
    await page.mouse.move(1270, 790);
    await page.waitForTimeout(200);

    // Closed state
    const closedRail = (await page.locator("nav.fa-nav").boundingBox())!;
    const closedContent = (await page.locator(".page-main").boundingBox())!;
    expect(closedRail.width).toBe(NAV_COLLAPSED_PX);
    expect(closedRail.x + closedRail.width).toBeLessThanOrEqual(closedContent.x + 0.5);
    await captureScreenshot(page, "rail-1280-closed.png");

    // Open via the head's open/close label (pins #fa-nav-open). Dispatched:
    // a pointer over the bar opens it by hover, and an open bar's header is
    // the landing-page link (owner, 2026-10-30).
    await page.locator(".fa-nav-head-toggle").dispatchEvent("click");
    await expect(page.locator("#fa-nav-open")).toBeChecked();
    await page.mouse.move(1270, 790);
    await page.waitForTimeout(300);

    const openRail = (await page.locator("nav.fa-nav").boundingBox())!;
    const openContent = (await page.locator(".page-main").boundingBox())!;
    expect(openRail.width).toBe(NAV_OPEN_WIDE_PX);
    // Rectangles DO NOT intersect: rail right <= content left
    expect(openRail.x + openRail.width).toBeLessThanOrEqual(openContent.x + 0.5);
    // Content width shrunk
    expect(openContent.width).toBeLessThan(closedContent.width);
    expect(closedContent.width - openContent.width).toBeCloseTo(openRail.width - closedRail.width, 1);
    await captureScreenshot(page, "rail-1280-open.png");

    // Close restores width (an open bar shows .fa-nav-head-toggle on hover, so a real click closes it without leaving :focus-visible)
    await page.locator(".fa-nav-head-toggle").click();
    await expect(page.locator("#fa-nav-open")).not.toBeChecked();
    await page.mouse.move(1270, 790);
    await page.waitForTimeout(300);
    const restoredContent = (await page.locator(".page-main").boundingBox())!;
    expect(restoredContent.width).toBeCloseTo(closedContent.width, 1);

    // Open via hover
    await page.locator("nav.fa-nav").hover();
    await page.waitForTimeout(300);
    const hoverRail = (await page.locator("nav.fa-nav").boundingBox())!;
    const hoverContent = (await page.locator(".page-main").boundingBox())!;
    expect(hoverRail.width).toBe(NAV_OPEN_WIDE_PX);
    expect(hoverRail.x + hoverRail.width).toBeLessThanOrEqual(hoverContent.x + 0.5);

    expect(errors).toEqual([]);
  });

  test("fa-nav layout: on phone (390px) the rail stays an overlay drawer", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("http://rail.fixture/**", (r) => r.fulfill({ contentType: "text/html", body: railedPage() }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://rail.fixture/page", { waitUntil: "load" });
    await page.waitForTimeout(200);

    await captureScreenshot(page, "rail-390-closed.png");

    // Open rail by the head's open/close label. Dispatched: this browser can
    // hover, and an open bar's header is the landing-page link (2026-10-30).
    await page.locator(".fa-nav-head-toggle").dispatchEvent("click");
    await expect(page.locator("#fa-nav-open")).toBeChecked();
    await page.waitForTimeout(300);

    await captureScreenshot(page, "rail-390-open.png");

    // On phone, body padding-left stays collapsed so rail overlays page without shrinking content
    const openRail = (await page.locator("nav.fa-nav").boundingBox())!;
    const content = (await page.locator(".page-main").boundingBox())!;
    expect(openRail.width).toBe(NAV_OPEN_PX);
    // Content left stays at 56px, rail at 248px overlays it
    expect(content.x).toBe(NAV_COLLAPSED_PX);

    expect(errors).toEqual([]);
  });
});

