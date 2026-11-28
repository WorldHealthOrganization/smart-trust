import { test, expect } from "@playwright/test";
import { BANNER_SCRIPT, CLIENT, FRAGMENT } from "../../scripts/staging-banner.ts";

/**
 * The staging banner's CLIENT half, in a browser. Bean `g196`.
 *
 * `staging-banner-constant.test.ts` pins the property the bean is about — the
 * injected bytes do not depend on the build. It cannot say whether the script
 * those bytes carry actually WORKS, because the script only runs in a browser
 * with a `location.pathname` under `branches/` and a `staging.json` to fetch.
 * That is this file.
 *
 * The three states below are the ones that matter, and the middle one is the
 * reason this is not a happy-path test:
 *
 *   staging.json fetched     -> the full banner, links and compare target
 *   fetch fails / 404        -> still says FEATURE BRANCH, says detail is gone
 *   not under a branches/ path -> says so, and does not fetch someone else's
 *
 * **"Could not determine" is never rendered as "this is the real site."** The
 * banner exists so a reviewer cannot mistake staged content for the published
 * site; a client-rendered banner that vanishes on a failed fetch would fail
 * exactly when it matters, and the harm is a reviewer approving the wrong
 * artefact. So the degraded states are asserted first-class, not as edge
 * cases.
 *
 * The fragment is IMPORTED rather than retyped. `sidebar-panels.e2e.ts` keeps
 * its own copy of the old offset script, which is how the six copies of
 * `stripLeanComments` happened (bean `bqrg`) — three of them broken, with
 * nothing saying so.
 */

const SLUG = "claude-example";
const ROOT = `/folio-assistant/STAGING/${SLUG}/`;

const FACTS = {
  branch: "claude/example",
  sha: "abc1234",
  built: "2026-09-20T18:00:00Z",
  pr: "563",
  prUrl: "https://github.com/litlfred/folio-assistant/pull/563",
  branchUrl: "https://github.com/litlfred/folio-assistant/tree/claude/example",
  issue: "215",
  issueUrl: "https://github.com/litlfred/folio-assistant/issues/215",
  runUrl: "https://github.com/litlfred/folio-assistant/actions/runs/9",
  mainSite: "https://litlfred.github.io/folio-assistant",
  mainPagesKnown: true,
  newPages: ["guides/brand-new.html"],
};

// The footer include renders CONSTANTLY on a staging build — `short_sha`,
// `built_at` and `run_url` are no longer written to `docs/_data/build.yml`
// there, so Liquid's `| default: 'dev'` is what ships and the client fills the
// real values in. This fixture reproduces exactly that output.
const FOOTER =
  `<p class="text-small mb-0 fa-build-stamp">deployed ` +
  `<a href="https://github.com/litlfred/folio-assistant/actions"><code>dev</code></a></p>`;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>${FRAGMENT}<h1>page</h1>${FOOTER}</body></html>`;

/**
 * Serve a page at `path` and, unless `json` is null, a `staging.json` at the
 * preview root. `page.route` rather than a server: the property under test is
 * how the script behaves given a pathname and a fetch outcome, and a route
 * lets the 404 case be produced exactly rather than arranged.
 */
async function serve(page: import("@playwright/test").Page, path: string, json: object | null) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/${BANNER_SCRIPT}`)) return route.fulfill({ status: 200, contentType: "text/javascript", body: CLIENT });
    if (url.pathname.endsWith("staging.json")) {
      if (json === null) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
    }
    return route.fulfill({ status: 200, contentType: "text/html", body: PAGE });
  });
  await page.goto(`http://127.0.0.1:8080${path}`);
  await page.waitForLoadState("networkidle");
}

test("the banner fills in from staging.json", async ({ page }) => {
  await serve(page, `${ROOT}index.html`, FACTS);
  const banner = page.locator("[data-fa-staging-banner]");
  await expect(banner).toContainText("FEATURE BRANCH");
  await expect(banner).toContainText("claude/example");
  await expect(banner).toContainText("abc1234");
  await expect(banner).toContainText("2026-09-20T18:00:00Z");
  await expect(banner.getByText("PR #563")).toBeVisible();
  await expect(banner.getByText("issue #215")).toBeVisible();
  await expect(banner.getByText("build log")).toBeVisible();
});

test("a preview is green and a release (build type full) is purple — owner, 2026-11-05", async ({ page }) => {
  const banner = page.locator("[data-fa-staging-banner]");
  await serve(page, `${ROOT}index.html`, { ...FACTS, buildType: "preview" });
  await expect(banner).toContainText("claude/example");
  expect(await banner.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe("rgb(79, 111, 82)");
  await expect(banner).toContainText("FEATURE BRANCH");

  await page.unrouteAll();
  await serve(page, `${ROOT}index.html`, { ...FACTS, buildType: "full" });
  await expect(banner).toContainText("claude/example");
  expect(await banner.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe("rgb(107, 63, 160)");
  await expect(banner).toContainText("RELEASE BUILD");
  await expect(banner).toHaveAttribute("data-fa-build-type", "full");
});

test("a preview under the new branches/ prefix finds its staging.json", async ({ page }) => {
  await serve(page, "/folio-assistant/branches/claude-example/guides/a.html", FACTS);
  await expect(page.locator("[data-fa-staging-banner]")).toContainText("claude/example");
});

test("with no open PR it says so in words, never \"PR #n/a\" — bean `zvl0`", async ({ page }) => {
  // A preview built by hand (`workflow_dispatch`) on a branch with no open PR
  // records `"pr": "n/a"`. The link still searches the branch's PRs.
  const search = "https://github.com/litlfred/folio-assistant/pulls?q=head%3Aclaude%2Fexample";
  await serve(page, `${ROOT}index.html`, { ...FACTS, pr: "n/a", prUrl: search });
  const banner = page.locator("[data-fa-staging-banner]");
  await expect(banner.getByText("no open PR found")).toHaveAttribute("href", search);
  await expect(banner).not.toContainText("PR #");
});

test("on an Arabic page it reads left to right, as the English it is — bean `giiw`", async ({ page }) => {
  // The banner is one English sentence on every locale. Measured with it
  // inheriting `dir="rtl"` (bean `giiw`): the links kept their order and each
  // ↗ its side — every run between them is strong LTR text, so the bidi
  // algorithm resolves the " · " separators to LTR as well — but the 🔀 that
  // OPENS the sentence is a neutral at the paragraph's edge, so it took the
  // paragraph's direction and was drawn at the far RIGHT, after "build log".
  // The order and arrow assertions are guards; the 🔀 is the one that failed.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/${BANNER_SCRIPT}`)) return route.fulfill({ status: 200, contentType: "text/javascript", body: CLIENT });
    if (url.pathname.endsWith("staging.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FACTS) });
    }
    return route.fulfill({ status: 200, contentType: "text/html", body: PAGE.replace('<html lang="en">', '<html lang="ar" dir="rtl">') });
  });
  await page.goto(`http://127.0.0.1:8080${ROOT}guides/agent-onboarding.html`);
  const banner = page.locator("[data-fa-staging-banner]");
  await expect(banner.getByText("build log")).toBeVisible();
  expect(await banner.evaluate((b) => [b.getAttribute("lang"), getComputedStyle(b).direction])).toEqual(["en", "ltr"]);
  const x = async (loc: import("@playwright/test").Locator) => (await loc.boundingBox())!.x;
  const order = [
    await x(banner.locator("b", { hasText: "FEATURE BRANCH" })),
    await x(banner.getByText("PR #563")),
    await x(banner.getByText("compare with main ↗")),
    await x(banner.getByText("build log")),
  ];
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  // The 🔀 opens the line: left of FEATURE BRANCH, not right of "build log".
  const mark = await banner.evaluate((b) => {
    const t = b.firstChild as Text;
    const r = document.createRange();
    r.setStart(t, 0);
    r.setEnd(t, t.data.indexOf(" "));
    return r.getBoundingClientRect().right;
  });
  expect(mark).toBeLessThanOrEqual(order[0]!);
  // The arrow follows the word it points from, at the link's right end.
  const arrow = await banner.getByText("compare with main ↗").evaluate((a) => {
    const t = a.firstChild as Text;
    const r = document.createRange();
    const i = t.data.indexOf("↗");
    r.setStart(t, i);
    r.setEnd(t, i + 1);
    return { arrow: r.getBoundingClientRect().right, link: a.getBoundingClientRect().right };
  });
  expect(Math.abs(arrow.arrow - arrow.link)).toBeLessThan(2);
});

test("the compare link deep-links to THIS page on main", async ({ page }) => {
  // Landing the reader on the site root asks them to re-navigate from memory
  // to do the comparison the link is for, and the deeper the page the less
  // likely they bother. The client derives the page from its own pathname.
  await serve(page, `${ROOT}guides/agent-onboarding.html`, FACTS);
  const compare = page.locator("[data-fa-staging-banner] a", { hasText: "compare with main" });
  await expect(compare).toHaveAttribute(
    "href",
    "https://litlfred.github.io/folio-assistant/guides/agent-onboarding.html",
  );
});

test("a page with NO counterpart on main says so instead of linking to a 404", async ({ page }) => {
  // Deep-linking unconditionally would publish a 404 on exactly the pages a
  // reviewer most wants to see — the ones the branch ADDS.
  await serve(page, `${ROOT}guides/brand-new.html`, FACTS);
  const banner = page.locator("[data-fa-staging-banner]");
  await expect(banner).toContainText("(new page)");
  await expect(banner.locator("a", { hasText: "main ↗" })).toHaveAttribute(
    "href",
    "https://litlfred.github.io/folio-assistant/",
  );
});

test("an unread publish ref falls back to the root and does NOT call pages new", async ({ page }) => {
  // The third state. "Could not tell" rendering as "this page is new" would
  // label every page new on any run where the publish-ref fetch failed.
  await serve(page, `${ROOT}guides/brand-new.html`, { ...FACTS, mainPagesKnown: false, newPages: [] });
  const banner = page.locator("[data-fa-staging-banner]");
  await expect(banner).not.toContainText("(new page)");
  await expect(banner.locator("a", { hasText: "compare with main" })).toHaveAttribute(
    "href",
    "https://litlfred.github.io/folio-assistant/",
  );
});

test("a directory URL compares against index.html, not against the bare directory", async ({ page }) => {
  await serve(page, ROOT, FACTS);
  await expect(
    page.locator("[data-fa-staging-banner] a", { hasText: "compare with main" }),
  ).toHaveAttribute("href", "https://litlfred.github.io/folio-assistant/index.html");
});

test("a 404 on staging.json STILL announces the preview", async ({ page }) => {
  // The rule the whole design turns on. A reviewer must not be able to mistake
  // this page for the published site because a fetch failed.
  await serve(page, `${ROOT}index.html`, null);
  const banner = page.locator("[data-fa-staging-banner]");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("FEATURE BRANCH");
  await expect(banner).toContainText("build details unavailable");
});

test("served from outside a preview path, it says so rather than fetching", async ({ page }) => {
  // No `branches/<slug>/` in the pathname means there is no staging.json that
  // belongs to this page; fetching one anyway would read another preview's.
  await serve(page, "/folio-assistant/index.html", FACTS);
  const banner = page.locator("[data-fa-staging-banner]");
  await expect(banner).toContainText("FEATURE BRANCH");
  await expect(banner).toContainText("not served from a preview path");
});

test("the banner pushes the fixed sidebar down, after the fetch changes its height", async ({ page }) => {
  // just-the-docs makes `.side-bar` `position: fixed; top: 0`, and a sticky
  // banner is in normal flow so it moves nothing out of it — the banner
  // covered the site title and the toolbar row holding the theme, reading
  // preferences, language and QR controls. A reader reported the language
  // selector "still not visible"; it was under the banner.
  //
  // Filling the banner in is a THIRD moment its height can change, which the
  // build-time version never had: it was already final when the script ran.
  await serve(page, `${ROOT}index.html`, FACTS);
  const offset = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--fa-staging-offset").trim(),
  );
  const height = await page.locator("[data-fa-staging-banner]").evaluate((b) => b.getBoundingClientRect().height);
  expect(parseFloat(offset)).toBeGreaterThan(0);
  expect(parseFloat(offset)).toBeCloseTo(height, 0);
});

/**
 * A page that does NOT reset `body`'s margin and whose fixed chrome is
 * `.fa-nav` rather than `.side-bar` — i.e. the library viewer, and any layout
 * written without the theme.
 *
 * Deliberately NOT a copy of `PAGE` with a class swapped: the defect was that
 * the banner's rule assumed BOTH facts about the page at once, so a fixture
 * that fixes either one cannot falsify it.
 */
const BARE_PAGE =
  `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
  `<style>body{padding-left:56px}.fa-nav{position:fixed;top:0;left:0;bottom:0;width:56px;z-index:2147483000}</style>` +
  `</head><body>${FRAGMENT}<nav class="fa-nav"></nav><h1>page</h1>${FOOTER}</body></html>`;

async function serveBare(page: import("@playwright/test").Page, path: string) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/${BANNER_SCRIPT}`)) return route.fulfill({ status: 200, contentType: "text/javascript", body: CLIENT });
    if (url.pathname.endsWith("staging.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FACTS) });
    }
    return route.fulfill({ status: 200, contentType: "text/html", body: BARE_PAGE });
  });
  await page.goto(`http://127.0.0.1:8080${path}`);
  await page.waitForLoadState("networkidle");
}

test("the banner is FLUSH on a page that never reset body's margin", async ({ page }) => {
  // Owner, 2026-10-02, with a screenshot: "statging status bar is not at top".
  // `position: sticky; top: 0` resolves against the flow position INSIDE the
  // margin box, so the UA default `body{margin:8px}` held it 8px off every
  // edge. Measured on the served bytes before the fix: `top: 8, left: 64` on a
  // page whose own `padding-left` is 56 — 56 + 8, which is what identified the
  // cause.
  //
  // just-the-docs ships `body{margin:0`, which is the only reason this was
  // invisible across ~2,400 pages. Asserting zero rather than "less than
  // before": a banner 1px off the top is the same defect, smaller.
  await serveBare(page, `${ROOT}index.html`);
  const box = await page.locator("[data-fa-staging-banner]").evaluate((b) => {
    const r = b.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      right: r.right,
      vw: document.documentElement.clientWidth,
      // The fixture's OWN `padding-left`, which is design rather than the
      // defect. Read from the page so the assertion cannot drift from it.
      padLeft: parseFloat(getComputedStyle(document.body).paddingLeft),
    };
  });
  expect(box.top).toBe(0);
  // ZERO, not `padLeft`, since 2026-10-04: the owner asked for the corner
  // above the rail to be green too, so the banner is fixed and full width and
  // the body's own padding no longer reaches it.
  expect(box.padLeft).toBe(56);
  expect(box.left).toBe(0);
  expect(box.right).toBe(box.vw);
});

test("it is at the top ON LOAD on a page that pads body's top, and nothing sits under it", async ({ page }) => {
  // Owner, 2026-10-04, three screenshots of a replica page: "banner is wrong
  // on page load, scrolls, and then is at top. should always be at top". The
  // folio glass band pads a replica's body by 2.25rem; a banner in body's flow
  // rendered 36px down until the page scrolled. Measured on the served bytes
  // before the fix: [56, 36] at load, [56, 0] scrolled.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/${BANNER_SCRIPT}`)) return route.fulfill({ status: 200, contentType: "text/javascript", body: CLIENT });
    if (url.pathname.endsWith("staging.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FACTS) });
    }
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: BARE_PAGE.replace("body{padding-left:56px}", "body{padding-left:56px;padding-top:2.25rem}"),
    });
  });
  await page.goto(`http://127.0.0.1:8080${ROOT}index.html`);
  await page.waitForLoadState("networkidle");
  const at = async () =>
    page.evaluate(() => {
      const b = document.querySelector("[data-fa-staging-banner]")!.getBoundingClientRect();
      const h = document.querySelector("h1")!.getBoundingClientRect();
      return { top: b.top, left: b.left, bottom: b.bottom, h1Top: h.top };
    });
  const load = await at();
  expect(load.top).toBe(0);
  expect(load.left).toBe(0);
  // Reserved, not overlapped: the first heading starts below the banner.
  expect(load.h1Top).toBeGreaterThanOrEqual(load.bottom);
  await page.evaluate(() => {
    document.body.style.minHeight = "3000px";
    window.scrollTo(0, 300);
  });
  expect((await at()).top).toBe(0);
});

test("it pushes `.fa-nav` down too, not only just-the-docs' `.side-bar`", async ({ page }) => {
  // The rule named `.side-bar` alone, which is just-the-docs' name for its
  // fixed chrome. The viewer rail is `.fa-nav` at `top: 0` with a z-index far
  // above the banner's, so it was never pushed down and sat level with the
  // banner — the very defect the rule exists to prevent, on a layout written
  // after it was written.
  await serveBare(page, `${ROOT}index.html`);
  const r = await page.evaluate(() => {
    const nav = document.querySelector(".fa-nav");
    const banner = document.querySelector("[data-fa-staging-banner]");
    return {
      navTop: nav ? nav.getBoundingClientRect().top : null,
      bannerHeight: banner ? banner.getBoundingClientRect().height : null,
    };
  });
  expect(r.bannerHeight).toBeGreaterThan(0);
  // Pushed down by exactly the measured banner height — the same contract the
  // `.side-bar` test above asserts, now held for the second layout.
  expect(r.navTop).toBeCloseTo(r.bannerHeight as number, 0);
});

test("a branch name containing markup is rendered as TEXT", async ({ page }) => {
  // Git ref names may contain `<`, `>` and `"` — they are not in git's
  // forbidden set, which stops at space, `~`, `^`, `:`, `?`, `*`, `[`, `\`
  // and the control characters. The old bash banner interpolated `$BRANCH`
  // into an HTML string. This one must build nodes.
  await serve(page, `${ROOT}index.html`, { ...FACTS, branch: `x<img src=q onerror="window.__pwned=1">y` });
  const banner = page.locator("[data-fa-staging-banner]");
  await expect(banner).toContainText(`x<img src=q onerror="window.__pwned=1">y`);
  expect(await banner.locator("img").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});


test("the footer build stamp is filled from staging.json too", async ({ page }) => {
  // Bean `g196`, second half. `footer_custom.html` renders `short_sha` and
  // `built_at` into EVERY page, so a fresh `date -u` made every page unique on
  // every run — the same defect as the banner, one include away, and it
  // survived the banner fix. Measured on two deploys of one branch three
  // minutes apart, both already shipping a constant banner: 1466 insertions,
  // 1465 deletions across 613 files, every page changed by exactly one line.
  await serve(page, `${ROOT}index.html`, FACTS);
  const stamp = page.locator(".fa-build-stamp");
  await expect(stamp).toContainText("abc1234");
  await expect(stamp).toContainText("2026-09-20T18:00:00Z");
  await expect(stamp).not.toContainText("dev");
  await expect(stamp.locator("a")).toHaveAttribute(
    "href",
    "https://github.com/litlfred/folio-assistant/actions/runs/9",
  );
});

test("a failed fetch leaves the footer as Jekyll rendered it, not blank", async ({ page }) => {
  // The same third-state rule as the banner: "could not determine" degrades to
  // the honest placeholder rather than to an empty footer that looks like a
  // page with no build at all.
  await serve(page, `${ROOT}index.html`, null);
  await expect(page.locator(".fa-build-stamp")).toContainText("dev");
});
