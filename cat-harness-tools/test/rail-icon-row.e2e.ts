import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteDirFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { injectRail } from "../scripts/lib/harness-rail.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * The harness icon row on a RAILED page — bean `wckf` (#2147), under `9rq1`.
 *
 * Owner, 2026-10-05: *"still no LHS icons top navbar on who-iris page"*, then
 * *"this should be a common navbar functionality in harness"*. The row was
 * drawn only into the theme's `.side-bar` (`navbar-row.e2e.ts` covers that
 * surface). These pages carry `lib/navbar.ts`'s `nav.fa-nav` instead, so they
 * had the harness's navbar without the harness's row.
 *
 * The page is built by the REAL `injectRail` — not a hand-written copy of the
 * rail — so a change to the rail's markup or its own stylesheet is tested
 * here as it ships. That is how the first measurement below was found: the
 * rail's `.fa-nav a{padding:8px 12px}` drew the row's LINK glyphs 8px wide.
 */

const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
// The row's own stylesheet FIRST, as `head_custom.html` links it (beans `lhvt`, `9rq1`).
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/navbar-row.css"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
// `navbar-row.js` FIRST — it draws the row, and `docs-ui.js` calls it — as `head_custom.html` loads them.
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const LIVE = (JSON.parse(readFileSync(overlayPath(join(ROOT, SITE, "_data/harness.json")), "utf8")) as { navbar: { icons: string[] } | null }).navbar;
if (!LIVE) throw new Error("docs/_data/harness.json has navbar:null — run `bun run cat docs:harness`.");

const SHELL =
  `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
  `<meta name="fa-baseurl" content="/folio-assistant"><style>${CSS}</style></head>` +
  `<body><h1 id="t">A replica page</h1><h2 id="a">One</h2><h2 id="b">Two</h2>` +
  `<script>${JS}<\/script></body></html>`;

function railed(row: unknown): string {
  const html = injectRail(SHELL, {
    instance: "WHO IRIS",
    toRoot: "..",
    links: [{ label: "Catalogue", href: "../cat-harness/catalogue/who-iris/" }],
    navbarRow: row,
  });
  if (!html) throw new Error("injectRail declined the fixture");
  return html;
}

const ROW_JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js"))), "utf8");
const ROW_CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/navbar-row.css"))), "utf8");
const DOCS_UI_JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const QR_JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");
const QR_UTF8_JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode_UTF8.js"))), "utf8");

/**
 * Serve `html` at a who-iris replica's address, and the site's real assets at
 * the addresses `injectRail` links them from (`../assets/...` from there).
 */
async function serve(page: import("@playwright/test").Page, html: string, assets: Record<string, string> = {}) {
  const files: Record<string, [string, string]> = {
    "/folio-assistant/assets/js/navbar-row.js": ["text/javascript", ROW_JS],
    "/folio-assistant/assets/css/navbar-row.css": ["text/css", ROW_CSS],
    "/folio-assistant/assets/js/docs-ui.js": ["text/javascript", DOCS_UI_JS],
    "/folio-assistant/assets/js/vendor/qrcode.js": ["text/javascript", QR_JS],
    "/folio-assistant/assets/js/vendor/qrcode_UTF8.js": ["text/javascript", QR_UTF8_JS],
    ...Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, ["text/javascript", v] as [string, string]])),
  };
  await page.route("**/*", (r) => {
    const path = new URL(r.request().url()).pathname;
    const hit = files[path];
    if (hit) return r.fulfill({ status: 200, contentType: hit[0], body: hit[1] });
    if (path.endsWith(".html")) return r.fulfill({ status: 200, contentType: "text/html", body: html });
    return r.fulfill({ status: 404, body: "" });
  });
  await page.goto("http://127.0.0.1:8080/folio-assistant/who-iris/x.html");
  await page.waitForLoadState("load");
}

/** A railed page as the 2,709 were: the real rail, no `docs-ui.js`, no `docs-ui.css`. */
const BARE =
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>bare</title></head>` +
  `<body><h1 id="t">An API page</h1><h2 id="a">One</h2></body></html>`;
function railedBare(row: unknown): string {
  const html = injectRail(BARE, {
    instance: "C@T Harness",
    toRoot: "..",
    links: [{ label: "Catalogue", href: "../cat-harness/catalogue/who-iris/" }],
    navbarRow: row,
  });
  if (!html) throw new Error("injectRail declined the bare fixture");
  return html;
}

test("the rail carries the harness row, at its FOOT (owner, 2026-11-13)", async ({ page }) => {
  await serve(page, railed(LIVE));
  const row = page.locator("nav.fa-nav .fa-nav-in > .fa-nav-icons");
  await expect(row).toHaveCount(1);
  // Placement: "put these controls at the bottom of the navbar" -- the row is
  // the rail's last region, and it sits at the bottom of the window.
  expect(await row.evaluate((r) => r.nextElementSibling)).toBeNull();
  expect(await row.evaluate((r) => Math.round(r.getBoundingClientRect().bottom))).toBe(page.viewportSize()!.height);
  // Every declared slot but `close` (CSS-placed, never drawn in the row).
  const declared = LIVE.icons.filter((i) => i !== "close").length;
  expect(await row.locator(".fa-nav-icon").count()).toBeGreaterThanOrEqual(declared);
});

test("every glyph in the rail's row is drawn at full size — links as well as buttons", async ({ page }) => {
  // Measured before the fix: links 8px, buttons 18px, on the who-iris replica.
  await serve(page, railed(LIVE));
  const widths = await page.$$eval("nav.fa-nav .fa-nav-icons svg", (s) => s.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(widths.length).toBeGreaterThan(0);
  expect(new Set(widths)).toEqual(new Set([18]));
});

test("at rest the row is one icon wide; open, it lies flat", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await serve(page, railed(LIVE));
  // AT REST means the pointer is not over the rail. Playwright's pointer can
  // start at (0, 0) — which IS the rail — so the strip measured open (248px)
  // in CI and at rest locally. Put it over the page body first.
  await page.mouse.move(900, 600);
  const box = () => page.locator("nav.fa-nav .fa-nav-icons").evaluate((r) => r.getBoundingClientRect());
  await expect.poll(async () => Math.round((await box()).width)).toBe(56);
  const rest = await box();
  expect(Math.round(rest.width)).toBe(56); // --fa-nav-collapsed, 3.5rem
  await page.hover("nav.fa-nav");
  await expect.poll(async () => Math.round((await box()).height)).toBeLessThan(Math.round(rest.height));
});

test("no row data, no row — and no invented one", async ({ page }) => {
  await serve(page, railed(undefined));
  expect(await page.locator("#fa-navbar-row").count()).toBe(0);
  await expect(page.locator("nav.fa-nav .fa-nav-icons")).toHaveCount(0);
});

test("the QR icon button on the rail toggles the page QR code (bean 5rmf)", async ({ page }) => {
  await serve(page, railed(LIVE));
  const qrBtn = page.locator("nav.fa-nav .fa-nav-icons button.fa-nav-qr");
  await expect(qrBtn).toHaveCount(1);
  await expect(qrBtn).toHaveAttribute("aria-label", "QR code for this page");
  await expect(qrBtn).toHaveAttribute("aria-expanded", "false");

  const qrPanel = page.locator("nav.fa-nav .fa-qr-panel");
  await expect(qrPanel).toHaveCount(1);
  await expect(qrPanel).toHaveAttribute("data-open", "false");

  await qrBtn.click();
  await expect(qrBtn).toHaveAttribute("aria-expanded", "true");
  await expect(qrPanel).toHaveAttribute("data-open", "true");
  await expect(qrPanel.locator("svg")).toHaveCount(1);

  await qrBtn.click();
  await expect(qrBtn).toHaveAttribute("aria-expanded", "false");
  await expect(qrPanel).toHaveAttribute("data-open", "false");
});

/* THE 2,709 — bean `lhvt`. Measured on the built site after #2149: railed
 * pages that never load `docs-ui.js` carried the row's data and drew nothing.
 * These run the page exactly as `injectRail` writes it, with the real
 * `navbar-row.js` and `navbar-row.css` fetched from where it links them. */

test("a railed page WITHOUT docs-ui.js draws the row — the link slots, at full size", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await serve(page, railedBare(LIVE));
  const row = page.locator("nav.fa-nav .fa-nav-in > .fa-nav-icons");
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-fa-row", "lite");
  expect(await row.evaluate((r) => r.nextElementSibling)).toBeNull();
  // Links, prefixed with the site base the SCRIPT was served under: this page
  // carries no `fa-baseurl` meta, which is the case the derivation is for.
  const hrefs = await row.locator("a.fa-nav-icon").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  // Every declared slot except the one that needs `docs-ui.js` (the launcher,
  // LEFT OUT here) and the retired close. Derived, not a
  // number: the row's membership is the owner's to change (bean `82qs`).
  const linked = LIVE.icons.filter((i: string) => !["close", "launcher", "qr"].includes(i));
  expect(hrefs.length).toBe(linked.length);
  for (const h of hrefs) expect(h).toMatch(/^\/folio-assistant\//);
  const widths = await row.locator("svg").evaluateAll((s) => s.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(new Set(widths)).toEqual(new Set([18]));
  expect(errors).toEqual([]);
});

test("without docs-ui.js the launcher is LEFT OUT and fsh-guts is a link — owner, 2026-10-05", async ({ page }) => {
  await serve(page, railedBare(LIVE));
  const row = page.locator("nav.fa-nav .fa-nav-icons");
  await expect(row).toHaveCount(1);
  await expect(row.locator('[aria-label^="More actions"]')).toHaveCount(0);
  await expect(row.locator(".fa-nav-scheme")).toHaveCount(0);
  if (LIVE.icons.includes("fsh-guts")) {
    await expect(row.locator("button[data-fa-fsh-guts-open]")).toHaveCount(0);
    await expect(row.locator('a[aria-label^="fsh-guts"], span[aria-label^="fsh-guts"]')).toHaveCount(1);
  }
});

test("at rest the lite row is one icon wide, with no docs-ui.css to size it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await serve(page, railedBare(LIVE));
  await page.mouse.move(900, 600);
  const width = () => page.locator("nav.fa-nav .fa-nav-icons").evaluate((r) => Math.round(r.getBoundingClientRect().width));
  await expect.poll(width).toBe(56);
});

test("docs-ui.js arriving AFTER the row upgrades it to the full row", async ({ page }) => {
  // A `folio-mount.ts` page appends docs-ui.js from an inline script; here it
  // is appended once the lite row is drawn, the later of the two orders.
  await serve(page, railedBare(LIVE));
  await expect(page.locator("nav.fa-nav .fa-nav-icons")).toHaveAttribute("data-fa-row", "lite");
  await page.evaluate(() => {
    const s = document.createElement("script");
    s.src = "/folio-assistant/assets/js/docs-ui.js";
    document.head.appendChild(s);
  });
  const row = page.locator("nav.fa-nav .fa-nav-icons");
  await expect(row).toHaveAttribute("data-fa-row", "full");
  await expect(row).toHaveCount(1);
  await expect(row.locator(".fa-nav-scheme")).toHaveCount(1);
});

test("docs-ui.js running BEFORE the row script still ends with the full row", async ({ page }) => {
  // The other order: docs-ui.js first, leaving its hooks; navbar-row.js then
  // finds them. Only the row's own tag is removed from the page for this.
  const html = railedBare(LIVE)
    .replace(/<script src="[^"]*navbar-row\.js" defer><\/script>/, "")
    .replace("</head>", '<script src="/folio-assistant/assets/js/docs-ui.js"></script></head>');
  await serve(page, html);
  const row = page.locator("nav.fa-nav .fa-nav-icons");
  await expect(row).toHaveAttribute("data-fa-row", "full");
  await expect(row).toHaveCount(1);
});

/** The live row with Todos and Beans put back, linked: cat-harness's own row
 *  dropped them on 2026-11-13, and a layer may still declare them (ihris
 *  declares beans), so the badge is tested on a row that carries them. */
const COUNTED = { ...LIVE, icons: [...LIVE.icons, "todos", "beans"], hrefs: { ...((LIVE as { hrefs?: Record<string, string> }).hrefs ?? {}), todos: "/todos/", beans: "/beans/" } };

/* COUNT BADGES ON TODOS AND BEANS — bean `gkv6`. Owner, 2026-10-05: "why no
 * count on beans and todos on LHS top navbar as badges like fsh-guts has?".
 * Fetched from the `count.json` beside each index; drawn in the LITE row, so
 * on every railed page, not only where `docs-ui.js` loads. */
test.describe("the Todos and Beans icons carry a live count badge (bean gkv6)", () => {
  const count = (id: string, n: number) => JSON.stringify({ tile: { [id]: { count: n, unit: id } } });

  test("the published counts are drawn, and the name says them", async ({ page }) => {
    await serve(page, railedBare(COUNTED), {
      "/folio-assistant/assets/todos/count.json": count("todos", 3),
      "/folio-assistant/assets/beans/count.json": count("beans", 528),
    });
    const row = page.locator("nav.fa-nav .fa-nav-icons");
    const beans = row.locator('a[aria-label^="Beans"]');
    await expect(beans.locator(".fa-nav-count")).toHaveText("528");
    await expect(beans.locator(".fa-nav-count")).toHaveAttribute("data-fa-count-state", "some");
    await expect(beans).toHaveAttribute("aria-label", "Beans — 528 open");
    await expect(beans).toHaveAttribute("data-fa-tip", "Beans — 528 open");
    const todos = row.locator('a[aria-label^="Todos"]');
    await expect(todos.locator(".fa-nav-count")).toHaveText("3");
    await expect(todos).toHaveAttribute("aria-label", "Todos — 3 outstanding");
    await expect(todos.locator(".fa-nav-count")).toBeVisible();
  });

  test("nothing published is NO badge, and an unreadable file says '?' — never a made-up number", async ({ page }) => {
    await serve(page, railedBare(COUNTED), {
      "/folio-assistant/assets/beans/count.json": "not json",
    });
    const row = page.locator("nav.fa-nav .fa-nav-icons");
    const todos = row.locator('a[aria-label^="Todos"]');
    await expect(todos.locator(".fa-nav-count")).toHaveAttribute("data-fa-count-state", "absent");
    await expect(todos.locator(".fa-nav-count")).toBeHidden();
    await expect(todos).toHaveAttribute("aria-label", "Todos");
    const beans = row.locator('a[aria-label^="Beans"]');
    await expect(beans.locator(".fa-nav-count")).toHaveText("?");
    await expect(beans.locator(".fa-nav-count")).toHaveAttribute("data-fa-count-state", "error");
  });
});

/* THE FLAKE THIS PR CAUSED, AND ITS FIX (bean `gkv6`). `library-entry-iri:69`
 * hung for 180 s on some loads: the library page `replaceState`s a legacy
 * `#instance/id` one segment DEEPER, the row resolved its relative
 * `data-fa-root` against the moved address, fetched a 404 — and left that
 * 404's body unread, so the request never finished and `networkidle` never
 * came. Measured 6 of 12 loads before the fix, 0 of 16 after. The unread
 * body is not tested here: a mocked route always completes, so only the real
 * server in `library-entry-iri.e2e.ts` can see it. */
test.describe("the count fetch survives a page that moves its own address (bean gkv6)", () => {
  const count = (id: string, n: number) => JSON.stringify({ tile: { [id]: { count: n, unit: id } } });

  test("a replaceState one level deeper still fetches the right count.json", async ({ page }) => {
    // At the END of <body>: the deferred scripts are already requested (their
    // URLs resolved) and have not run yet — the order the library page has.
    const deeper = railedBare(COUNTED).replace("</body>", '<script>history.replaceState(null, "", "deeper/than/before/")</script></body>');
    const asked: string[] = [];
    page.on("request", (r) => { if (r.url().includes("count.json")) asked.push(new URL(r.url()).pathname); });
    await serve(page, deeper, {
      "/folio-assistant/assets/todos/count.json": count("todos", 3),
      "/folio-assistant/assets/beans/count.json": count("beans", 528),
    });
    const beans = page.locator('nav.fa-nav .fa-nav-icons a[aria-label^="Beans"]');
    await expect(beans.locator(".fa-nav-count")).toHaveText("528");
    expect(asked.sort()).toEqual(["/folio-assistant/assets/beans/count.json", "/folio-assistant/assets/todos/count.json"]);
  });
});

/* THE FOLIO AND HARNESSES ICONS — owner, 2026-11-13: "remove the folio purple
 * tab at top instead add an icon to the controls for the folio. remove the
 * harnesses navbar, instead add an icon to the controls to show the harnesses." */

function railedWithHarnesses(row: unknown, shell = SHELL): string {
  const html = injectRail(shell, {
    instance: "Folio X",
    toRoot: "..",
    links: [{ label: "Catalogue", href: "../cat-harness/catalogue/folio-x/" }],
    harnesses: [{ label: "C@T Harness", href: "../cat-harness/" }, { label: "Folio X", href: "../folio-x/" }],
    navbarRow: row,
  });
  if (!html) throw new Error("injectRail declined the fixture");
  return html;
}

for (const [name, html] of [
  ["full (docs-ui.js)", () => railedWithHarnesses(LIVE)],
  ["lite (no docs-ui.js)", () => railedWithHarnesses(LIVE, BARE)],
] as const) {
  test(`the Harnesses icon is IN the row and opens the harness list — ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serve(page, html());
    const row = page.locator("nav.fa-nav .fa-nav-in > .fa-nav-icons");
    const icon = row.locator("button.fa-nav-harnesses");
    await expect(icon).toHaveCount(1);
    // Last in the row, and no Harnesses disclosure left anywhere in the rail.
    expect(await row.evaluate((r) => r.lastElementChild?.classList.contains("fa-nav-harnesses"))).toBe(true);
    await expect(page.locator("nav.fa-nav details.fa-nav-group summary", { hasText: "Harnesses" })).toHaveCount(0);
    await expect(icon).toHaveAttribute("aria-label", "Harnesses");
    await expect(icon).toHaveAttribute("aria-expanded", "false");
    const panel = page.locator("#fa-nav-harnesses");
    await expect(panel).toBeHidden();
    // Keyboard: focus it and press Enter; the list shows, with its links.
    await icon.focus();
    await page.keyboard.press("Enter");
    await expect(icon).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    await expect(panel.locator('a[href="../cat-harness/"]')).toBeVisible();
    // The panel sits above the row, inside the window.
    const [p, r] = await Promise.all([panel.boundingBox(), row.boundingBox()]);
    expect(p!.y + p!.height).toBeLessThanOrEqual(r!.y + 1);
    expect(p!.y).toBeGreaterThanOrEqual(0);
    // Escape closes it and gives focus back to the icon.
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(icon).toHaveAttribute("aria-expanded", "false");
    await expect(icon).toBeFocused();
  });
}

test("the Harnesses icon stays reachable where the layer declares no row", async ({ page }) => {
  await serve(page, railedWithHarnesses(undefined));
  await expect(page.locator("nav.fa-nav .fa-nav-icons")).toHaveCount(0);
  const icon = page.locator("nav.fa-nav .fa-nav-bottom button.fa-nav-harnesses");
  await expect(icon).toHaveCount(1);
  await icon.click();
  await expect(page.locator("#fa-nav-harnesses")).toBeVisible();
});

test("the Folio icon is in the row, the top tab is gone, and the icon opens and closes the glass", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await serve(page, railedWithHarnesses(LIVE));
  const folio = page.locator("nav.fa-nav .fa-nav-icons button.fa-nav-folio");
  await expect(folio).toHaveCount(1);
  await expect(page.locator(".fa-glass-handle")).toHaveCount(1);
  await expect(page.locator(".fa-glass-handle")).toBeHidden();
  await expect(folio).toHaveAttribute("aria-label", /^Pull down your folio/);
  await expect(folio).toHaveAttribute("aria-expanded", "false");
  await folio.click();
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
  await expect(folio).toHaveAttribute("aria-expanded", "true");
  await expect(folio).toHaveAttribute("aria-label", "Put your folio away");
  // The rail stays above the glass, so the same icon puts it away.
  await folio.click();
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "closed");
  // Keyboard: open, then Escape returns focus to the icon, not the hidden tab.
  await folio.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "open");
  await page.keyboard.press("Escape");
  await expect(page.locator(".fa-sticky-layer")).toHaveAttribute("data-fa-glass", "closed");
  await expect(folio).toBeFocused();
});

test("todos, beans and fsh-guts are not in cat-harness's row (owner, 2026-11-13)", async () => {
  for (const gone of ["todos", "beans", "fsh-guts"]) expect(LIVE.icons).not.toContain(gone);
});

test("at phone width the row and its icons stay in the window", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await serve(page, railedWithHarnesses(LIVE));
  await page.mouse.move(300, 400);
  const boxes = await page.$$eval("nav.fa-nav .fa-nav-icons > *", (els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
  expect(boxes.length).toBeGreaterThanOrEqual(3);
  for (const b of boxes) {
    expect(b.l).toBeGreaterThanOrEqual(0);
    expect(b.r).toBeLessThanOrEqual(56);
    expect(b.t).toBeGreaterThanOrEqual(0);
    expect(b.b).toBeLessThanOrEqual(844);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
