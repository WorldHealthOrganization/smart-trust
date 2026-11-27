import { test, expect } from "@playwright/test";
// Overlay-aware drop-ins: the library view and its data are written at publish (bean cat-tools-sm8r).
import { existsSync, readFileSync } from "../support/site-fs.ts";
import { join } from "node:path";

import { siteDirFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { layoutStandIn, parseThemed } from "../support/themed-page.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { declaredPagePath } from "../support/site-pages.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * R30's THREE STATES, bean `j2if`. Owner, 2026-09-21:
 *
 * > they can also be closed and returned to their homes (e.g. "back in
 * > library", matieral asset still in folio/ but not displayed, need to go
 * > back to the library and pull it out to folio display window)
 *
 * ## What these specs are actually for
 *
 * Not "does the button work". `board-windows` names the defect this feature
 * exists to avoid, and it is a defect that LOOKS like a working feature:
 *
 * > A two-state model — in the folio, or not — makes *closing a sticky* and
 * > *un-materialising an asset* the same gesture. A reader tidying their
 * > glass would then silently discard work, and would have no way to tell
 * > that they had.
 *
 * A two-state implementation passes every happy-path test a three-state one
 * does. The specs that tell them apart are the two below under "the middle
 * state is real": close, then assert the asset is STILL the reader's, and
 * that the way back is on the library and NOT on the glass.
 *
 * `l4zi` one level out — *"the inverse of close must be reachable, and here
 * it is reachable from a DIFFERENT surface than the one that closed it."*
 */

const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
// The published site directory, ABSOLUTE. Named for what it holds: the first
// version called this `SITE_REL` while holding an absolute path and was then
// joined onto the repo root again, producing
// `/home/user/folio-assistant/home/user/folio-assistant/...`. A name that
// lies about a path is a name that gets joined wrongly.
const SITE_ABS = join(ROOT, SITE);
/**
 * A committed library page as the LAYOUT serves it. The pages are THEMED since
 * 2026-10-07: front matter and a Liquid-raw body, on the site's `default`
 * layout, which loads `docs-ui.css` and `docs-ui.js` on every page — so the
 * folio comes from the layout rather than from a mount fragment in the page.
 * The stand-in (`support/themed-page.ts`) loads the two the same way, from the
 * site root, where the routes below serve the real files.
 */
function asLayoutServesIt(file: string): string {
  const themed = parseThemed(readFileSync(file, "utf8"));
  if (!themed) throw new Error(`${file} is not a themed page`);
  return layoutStandIn(themed, {
    head: '<link rel="stylesheet" href="/assets/css/docs-ui.css">',
    tail: '<script src="/assets/js/docs-ui.js"></script>',
  });
}

/**
 * The library viewer's SHARED assets (#1881). A library page is a thin shell
 * that loads `assets/library/viewer.css` and `viewer.js`, so a route that
 * answers every other request with the page's HTML must serve these first —
 * or the "script" it loads is the page itself, and nothing renders.
 */
function libraryViewerAsset(pathname: string): { contentType: string; body: string } | undefined {
  for (const [file, contentType] of [["viewer.js", "text/javascript"], ["viewer.css", "text/css"]] as const) {
    if (pathname.endsWith(`assets/library/${file}`)) {
      return { contentType, body: readFileSync(overlayPath(join(SITE_ABS, "assets", "library", file)), "utf8") };
    }
  }
  return undefined;
}
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

/**
 * A library page: two rows that declare themselves, and nothing else.
 *
 * No `<main>`, no sidebar, no todo index — a generated library view is a
 * standalone document, so a fixture with just-the-docs furniture would be
 * testing a page this feature never runs on.
 */
const LIBRARY = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${CSS}</style></head><body>
<h1>who-iris library</h1>
<table><tbody>
  <tr data-fa-library-item="who-iris/item-a"
      data-fa-library-title="Guideline A"
      data-fa-library-href="/who-iris/item-a.html"><td>Guideline A</td></tr>
  <tr data-fa-library-item="who-iris/item-b"
      data-fa-library-title="Guideline B"
      data-fa-library-href="/who-iris/item-b.html"><td>Guideline B</td></tr>
</tbody></table>
<script>${JS}</script></body></html>`;

/** A page that is NOT a library — no declaring rows anywhere. */
const PLAIN = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${CSS}</style></head><body><h1>An ordinary page</h1>
<script>${JS}</script></body></html>`;

async function serve(page: import("@playwright/test").Page, body: string, path = "/library.html") {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(".json")) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ status: 200, contentType: "text/html", body });
  });
  await page.goto(`http://127.0.0.1:8080${path}`);
  await page.waitForLoadState("networkidle");
}

const rowA = '[data-fa-library-item="who-iris/item-a"]';
const rowB = '[data-fa-library-item="who-iris/item-b"]';

/**
 * A library page whose rows carry HOSTILE hrefs.
 *
 * Not hypothetical. CI caught this as a red gate — *"every href in the client
 * goes through the check"* — on the first draft, which rendered
 * `a.href` from `localStorage` straight into an `<a>`. `safe-url.ts` says the
 * hazard at the render points it was written for is LATENT, because every URL
 * there is COMPOSED rather than taken. This one is taken: it originates in a
 * library page's `data-fa-library-href`, which is authored markup.
 *
 * So the vector was real and new, and these specs are the evidence that it is
 * closed rather than merely that a gate is satisfied.
 */
const HOSTILE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${CSS}</style></head><body>
<table><tbody>
  <tr data-fa-library-item="evil/js"
      data-fa-library-title="Looks ordinary"
      data-fa-library-href="javascript:window.__pwned=1"><td>x</td></tr>
  <tr data-fa-library-item="evil/split"
      data-fa-library-title="Split scheme"
      data-fa-library-href="java&#9;script:window.__pwned=1"><td>x</td></tr>
  <tr data-fa-library-item="ok/relative"
      data-fa-library-title="An ordinary link"
      data-fa-library-href="/who-iris/item-a.html"><td>x</td></tr>
</tbody></table>
<script>${JS}</script></body></html>`;

test.describe("state 1 — in the library", () => {
  test("a row the reader has never touched offers a pull-out and claims nothing", async ({ page }) => {
    await serve(page, LIBRARY);
    await expect(page.locator(rowA)).toHaveAttribute("data-fa-folio-state", "library");
    await expect(page.locator(`${rowA} .fa-pullout`)).toHaveText("Pull out to folio");
    await expect(page.locator(`${rowA} .fa-pullout-state`)).toHaveText("");
  });

  test("the glass says it is empty, rather than looking broken", async ({ page }) => {
    await serve(page, LIBRARY);
    await page.locator(".fa-glass-handle").click();
    await expect(page.locator(".fa-glass-empty")).toBeVisible();
  });

  test("a page with no library rows mounts no pull-outs at all", async ({ page }) => {
    // The guard every mount here uses. Without it, loading docs-ui.js on a
    // replica page would decorate whatever happened to match.
    await serve(page, PLAIN, "/plain.html");
    await expect(page.locator(".fa-pullout")).toHaveCount(0);
    await expect(page.locator(".fa-glass-handle")).toBeVisible(); // the glass still comes
  });
});

test.describe("state 3 — on the glass", () => {
  test("pulling out puts it on the glass and the row stops offering it", async ({ page }) => {
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await expect(page.locator(rowA)).toHaveAttribute("data-fa-folio-state", "glass");
    await expect(page.locator(`${rowA} .fa-pullout-state`)).toHaveText("On your folio glass");
    await page.locator(".fa-glass-handle").click();
    await expect(page.locator('.fa-glass-asset[data-fa-asset="who-iris/item-a"]')).toBeVisible();
    await expect(page.locator(".fa-glass-empty")).toBeHidden();
  });

  test("the row offers no close — closing belongs to the glass, and to one surface", async ({ page }) => {
    // Two surfaces offering the same close would answer "where does this go"
    // twice, and the two answers would be free to disagree.
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await expect(page.locator(`${rowA} .fa-pullout`)).toBeHidden();
  });

  test("it survives a reload — a folio that forgets is not a folio", async ({ page }) => {
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(rowA)).toHaveAttribute("data-fa-folio-state", "glass");
  });

  test("and says in words that it is saved in this browser only", async ({ page }) => {
    // The discarded-todos rule, unchanged: a reader who thinks their folio
    // follows them to another machine has been misled by the control.
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await page.locator(".fa-glass-handle").click();
    await expect(page.locator(".fa-glass-local-note")).toContainText("this browser only");
  });
});

test.describe("the middle state is real — these are the specs a two-state build fails", () => {
  test("closing does NOT return it to the library", async ({ page }) => {
    // THE defect `board-windows` exists to forbid. A two-state build passes
    // every other spec in this file and fails here: it would read "library".
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await page.locator(".fa-glass-handle").click();
    await page.locator('.fa-glass-asset[data-fa-asset="who-iris/item-a"] .fa-glass-asset-close').click();
    await page.getByRole("button", { name: "Put it back" }).click(); // the confirm, #1900

    await expect(page.locator(rowA)).toHaveAttribute("data-fa-folio-state", "folio");
    await expect(page.locator(`${rowA} .fa-pullout-state`)).toHaveText("In your folio, not displayed");
  });

  test("...and the way back is on the LIBRARY, not on the glass", async ({ page }) => {
    // `l4zi` one level out. The skill says where this is easy to get wrong:
    // "the thing to check is that the library offers the way back — not that
    // the glass does."
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await page.locator(".fa-glass-handle").click();
    await page.locator('.fa-glass-asset[data-fa-asset="who-iris/item-a"] .fa-glass-asset-close').click();
    await page.getByRole("button", { name: "Put it back" }).click(); // the confirm, #1900

    // Gone from the glass...
    await expect(page.locator('.fa-glass-asset[data-fa-asset="who-iris/item-a"]')).toHaveCount(0);
    // ...and the glass does not offer it back.
    await expect(page.locator(".fa-glass-shelf .fa-pullout")).toHaveCount(0);
    // The library does, and says so.
    await expect(page.locator(`${rowA} .fa-pullout`)).toHaveText("Put back on glass");
  });

  test("the glass SAYS where the way back is — including that the folio is in the way", async ({ page }) => {
    // A reader who is not told reads a closed asset as one they lost. And
    // the FIRST draft of this note said only "open its library view", which
    // sends them to a control this very sheet is covering: the spec below
    // failed with the sheet named as intercepting the pointer. That is
    // `pb04` — the affordance exists, it is reachable, and not from where
    // the reader is standing.
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await page.locator(".fa-glass-handle").click();
    await page.locator('.fa-glass-asset[data-fa-asset="who-iris/item-a"] .fa-glass-asset-close').click();
    await page.getByRole("button", { name: "Put it back" }).click(); // the confirm, #1900
    const note = page.locator(".fa-glass-shelved-note");
    await expect(note).toContainText("library view");
    await expect(note).toContainText("Put your folio away");
  });

  test("the open glass really does cover the library row — the note is not superstition", async ({ page }) => {
    // Pins the premise of the sentence above. If the sheet stopped
    // intercepting, the note would be telling readers to do a needless step
    // and nothing would say so.
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await page.locator(".fa-glass-handle").click();
    await page.locator('.fa-glass-asset[data-fa-asset="who-iris/item-a"] .fa-glass-asset-close').click();
    await page.getByRole("button", { name: "Put it back" }).click(); // the confirm, #1900
    await expect(page.locator(`${rowA} .fa-pullout`)).toHaveText("Put back on glass");
    // Visible and named, but not clickable from here: the sheet is over it.
    await expect(page.locator(`${rowA} .fa-pullout`).click({ timeout: 1500 })).rejects.toThrow();
  });

  test("putting it back from the library returns it to the glass", async ({ page }) => {
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await page.locator(".fa-glass-handle").click();
    await page.locator('.fa-glass-asset[data-fa-asset="who-iris/item-a"] .fa-glass-asset-close').click();
    await page.getByRole("button", { name: "Put it back" }).click(); // the confirm, #1900
    // Put the folio away first — which is what the note now tells the reader.
    await page.locator(".fa-glass-handle").click();
    await page.locator(`${rowA} .fa-pullout`).click();
    await expect(page.locator(rowA)).toHaveAttribute("data-fa-folio-state", "glass");
    await page.locator(".fa-glass-handle").click();
    await expect(page.locator('.fa-glass-asset[data-fa-asset="who-iris/item-a"]')).toBeVisible();
  });

  test("a shelved asset survives a reload as SHELVED, not as forgotten", async ({ page }) => {
    // The state that would be lost by an implementation storing only an
    // array of ids: "closed" and "never pulled out" become one absence.
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await page.locator(".fa-glass-handle").click();
    await page.locator('.fa-glass-asset[data-fa-asset="who-iris/item-a"] .fa-glass-asset-close').click();
    await page.getByRole("button", { name: "Put it back" }).click(); // the confirm, #1900
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(rowA)).toHaveAttribute("data-fa-folio-state", "folio");
  });
});

test.describe("one asset's state is its own", () => {
  test("pulling A out leaves B in the library", async ({ page }) => {
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await expect(page.locator(rowB)).toHaveAttribute("data-fa-folio-state", "library");
    await expect(page.locator(`${rowB} .fa-pullout`)).toHaveText("Pull out to folio");
  });
});

test.describe("a hostile href never reaches the glass", () => {
  test("`javascript:` is refused — the asset renders with NO link", async ({ page }) => {
    // `pb04` and default-deny together: the refusal is not a broken card, it
    // is a card with no link. The asset is still the reader's and still
    // named; only the navigation is withheld.
    await serve(page, HOSTILE);
    await page.locator('[data-fa-library-item="evil/js"] .fa-pullout').click();
    await page.locator(".fa-glass-handle").click();
    const card = page.locator('.fa-glass-asset[data-fa-asset="evil/js"]');
    await expect(card).toBeVisible();
    // A LIBRARY card links the entry page composed from its key (#1900), so
    // the stored href never reaches an anchor at all — and nothing hostile does.
    await expect(card.locator('a[href^="javascript"], a[href*="alert"]')).toHaveCount(0);
    await expect(card.locator("a")).toHaveAttribute("href", "/cat-harness/library/evil/js/");
    await expect(card.locator(".fa-glass-asset-name")).toHaveText("Looks ordinary");
  });

  test("a TAB-split scheme is refused too — the bypass `safeHref`'s own spec caught", async ({ page }) => {
    // safe-url.ts: "the URL parser strips exactly these three before parsing,
    // so leaving one in the middle leaves a `javascript:` URL looking like a
    // relative path. The first version of this function trimmed only the ends
    // and shipped that bypass."
    await serve(page, HOSTILE);
    await page.locator('[data-fa-library-item="evil/split"] .fa-pullout').click();
    await page.locator(".fa-glass-handle").click();
    await expect(page.locator('.fa-glass-asset[data-fa-asset="evil/split"] a')).toHaveAttribute("href", "/cat-harness/library/evil/split/");
  });

  test("and nothing was executed — a BACKSTOP, and measured to be the weak one", async ({ page }) => {
    // THIS SPEC DOES NOT DETECT THE HOLE, and its first comment claimed the
    // opposite. Falsified against the vulnerable draft (both `safeHref`
    // calls removed): specs 1 and 2 above failed, and this one PASSED. So
    // clicking a `javascript:` anchor does not run the payload under this
    // harness, and an assertion that nothing ran proves nothing about a
    // build that renders the link.
    //
    // Kept rather than deleted, and relabelled rather than quietly fixed:
    // it still guards a DIFFERENT regression — a future harness where the
    // click does navigate — and a reader who believed the old comment would
    // have trusted the wrong spec of the four. The detectors are 1 and 2,
    // which assert no anchor is rendered at all.
    await serve(page, HOSTILE);
    await page.locator('[data-fa-library-item="evil/js"] .fa-pullout').click();
    await page.locator(".fa-glass-handle").click();
    await page.locator('.fa-glass-asset[data-fa-asset="evil/js"] .fa-glass-asset-name').click();
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  });

  test("an ORDINARY href still links — default-deny refuses schemes, not links", async ({ page }) => {
    // The control. Without it, a build that dropped every href would pass
    // all three specs above while breaking the feature.
    await serve(page, HOSTILE);
    await page.locator('[data-fa-library-item="ok/relative"] .fa-pullout').click();
    await page.locator(".fa-glass-handle").click();
    // A library card's link is its entry page, composed from its key (#1900).
    await expect(page.locator('.fa-glass-asset[data-fa-asset="ok/relative"] a'))
      .toHaveAttribute("href", "/cat-harness/library/ok/relative/");
  });
});

test.describe("rows that are rebuilt, which is what the real library view does", () => {
  /**
   * `gen-library-viz` renders rows client-side and replaces them WHOLESALE on
   * every filter keystroke and every sort — `$("listing").innerHTML = …`.
   *
   * Every spec above uses static fixture rows, and that is exactly why the
   * first implementation's per-row `document.addEventListener` passed all 18
   * of them while being an unbounded leak on the real page. Bean `ebvl`. The
   * fixture below is the shape the author did not have in mind.
   */
  const rebuild = async (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const body = document.querySelector("tbody")!;
      body.innerHTML = body.innerHTML;
    });

  test("the control survives a wholesale re-render", async ({ page }) => {
    await serve(page, LIBRARY);
    await rebuild(page);
    await expect(page.locator(`${rowA} .fa-pullout`)).toHaveText("Pull out to folio");
  });

  test("and state survives it — a rebuilt row still knows the asset is the reader's", async ({ page }) => {
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await rebuild(page);
    await expect(page.locator(rowA)).toHaveAttribute("data-fa-folio-state", "glass");
    await expect(page.locator(`${rowA} .fa-pullout-state`)).toHaveText("On your folio glass");
  });

  test("a rebuilt row is still clickable — delegation, not a re-bound handler", async ({ page }) => {
    await serve(page, LIBRARY);
    await rebuild(page);
    await page.locator(`${rowA} .fa-pullout`).click();
    await expect(page.locator(rowA)).toHaveAttribute("data-fa-folio-state", "glass");
  });

  test("ten re-renders leave ONE control per row, not ten", async ({ page }) => {
    // The visible half of the leak. The listener half cannot be counted from
    // here, which is why the fix is structural: delegation has no per-row
    // registration to leak.
    await serve(page, LIBRARY);
    for (let i = 0; i < 10; i++) await rebuild(page);
    await expect(page.locator(`${rowA} .fa-pullout`)).toHaveCount(1);
    await expect(page.locator(".fa-pullout")).toHaveCount(2); // two rows
  });

  test("the painter does not re-enter on its own mutations", async ({ page }) => {
    // The observer watches childList; the painter writes textContent, which
    // IS a childList mutation. Unguarded, it re-enters and never returns —
    // measured, not feared: the first spec run hung and was killed. If this
    // regresses, this spec times out rather than failing quietly.
    await serve(page, LIBRARY);
    await page.locator(`${rowA} .fa-pullout`).click();
    await expect(page.locator(rowA)).toHaveAttribute("data-fa-folio-state", "glass");
    // The page is still responsive: a second interaction completes.
    await page.locator(`${rowB} .fa-pullout`).click();
    await expect(page.locator(rowB)).toHaveAttribute("data-fa-folio-state", "glass");
  });
});

test.describe("the REAL generated library view, not a fixture", () => {
  /**
   * Everything above runs against fixtures this file writes — which is the
   * author's idea of the page. `check-invocation-parity`'s standing lesson,
   * and it has already cost this feature twice: #890's static rows hid a
   * per-row listener leak, and its fixture had no re-render at all.
   *
   * So this reads the page `gen-library-viz` actually wrote, with the rows
   * it actually emits, rendered by its own client-side code.
   */
  const VIEW = declaredPagePath(ROOT, "library", "index.html", { subgraph: "who-iris" });
  // Read from the page's OWN `DATA_HREF` rather than guessed: the first
// version guessed `assets/cat-harness/library/who-iris/`, the real path is
// `assets/library/`, and a wrong guess serves `{}` — which renders an empty
// corpus and would have made every spec below pass over nothing.
const PROJECTION = join(SITE_ABS, "assets", "library", "index.json");

  const serveReal = async (page: import("@playwright/test").Page) => {
    const html = asLayoutServesIt(VIEW);
    const data = existsSync(PROJECTION) ? readFileSync(PROJECTION, "utf8") : "{}";
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("assets/css/docs-ui.css")) {
        return route.fulfill({ status: 200, contentType: "text/css", body: CSS });
      }
      if (url.pathname.endsWith("assets/js/docs-ui.js")) {
        return route.fulfill({ status: 200, contentType: "text/javascript", body: JS });
      }
      if (url.pathname.endsWith(".json")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: data });
      }
      const asset = libraryViewerAsset(url.pathname);
      if (asset) return route.fulfill({ status: 200, ...asset });
      return route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto("http://127.0.0.1:8080/cat-harness/library/who-iris/index.html");
    await page.waitForLoadState("networkidle");
    // PARK THE POINTER OFF THE RAIL. The viewer rail expands to an OVERLAY
    // 248-264 px wide on hover, by design. In CI the pointer starts over it,
    // and Playwright hit-tests before it moves, so a control in the first
    // 264 px reads as covered and the click retries until timeout. Since bean
    // gnqa wrapped the pull-out under the slug (x = 74), this is that case.
    // Reproduced locally by hovering (10, 300) first. A person reaching for
    // the button has, by definition, moved off the rail.
    await page.mouse.move(900, 600);
  };

  test("the generated page exists, and is on the layout that carries the folio", () => {
    expect(existsSync(VIEW), `${VIEW} is missing — run \`bun run cat library:viz\``).toBe(true);
    // Themed: the layout loads docs-ui.js, so the page carries no mount of its
    // own — a second one would load the folio twice.
    const page = readFileSync(VIEW, "utf8");
    expect(page.startsWith("---\nlayout: default\n")).toBe(true);
    expect(page).not.toContain("data-fa-folio-mount");
    expect(readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "_includes/head_custom.html"))), "utf8")).toMatch(
      /<script src="\{\{ '\/assets\/js\/docs-ui\.js' \| relative_url \}\}[^"]*" defer><\/script>/,
    );
  });

  test("its rows declare themselves, and the folio decorates them", async ({ page }) => {
    await serveReal(page);
    const rows = page.locator("[data-fa-library-item]");
    await expect(rows.first()).toBeVisible();
    await expect(page.locator("[data-fa-library-item] .fa-pullout").first())
      .toHaveText("Pull out to folio");
  });

  test("the glass comes down on it — the layout's docs-ui.js mounts it", async ({ page }) => {
    await serveReal(page);
    await expect(page.locator(".fa-glass-handle")).toBeVisible();
  });

  test("pulling a real entry out puts it on the glass", async ({ page }) => {
    await serveReal(page);
    const first = page.locator("[data-fa-library-item]").first();
    const key = await first.getAttribute("data-fa-library-item");
    await first.locator(".fa-pullout").click();
    await page.locator(".fa-glass-handle").click();
    await expect(page.locator(`.fa-glass-asset[data-fa-asset="${key}"]`)).toBeVisible();
  });

  test("and FILTERING — the re-render that a fixture cannot exercise", async ({ page }) => {
    // The whole reason `ebvl` existed. `renderList` replaces the tbody on
    // every keystroke; the control must come back and the state with it.
    await serveReal(page);
    const first = page.locator("[data-fa-library-item]").first();
    const key = await first.getAttribute("data-fa-library-item");
    await first.locator(".fa-pullout").click();
    await expect(page.locator(`[data-fa-library-item="${key}"]`))
      .toHaveAttribute("data-fa-folio-state", "glass");

    await page.locator("#q").fill("a");
    await page.locator("#q").fill("");
    await expect(page.locator(`[data-fa-library-item="${key}"] .fa-pullout-state`))
      .toHaveText("On your folio glass");
  });
});

test.describe("an asset's address is its own path IRI", () => {
  /**
   * Measured before choosing the shape: an ingested library document has NO
   * published page of its own. Nothing writes one, and this viewer is the
   * only thing that renders these entries at all — so there was no stale URL
   * to fix, there was no URL.
   *
   * Owner, 2026-09-22: *"instance of what, harness or asset? harness OK.
   * asset has too much drift"*. cat-harness owns this viewer, so the viewer
   * IS the address, and the fragment names the asset.
   */
  const VIEW2 = declaredPagePath(ROOT, "library", "index.html", { subgraph: "who-iris" });
  const DATA2 = join(SITE_ABS, "assets", "library", "index.json");

  const serveView = async (page: import("@playwright/test").Page, hash = "") => {
    const html = asLayoutServesIt(VIEW2);
    const data = readFileSync(DATA2, "utf8");
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("assets/css/docs-ui.css")) {
        return route.fulfill({ status: 200, contentType: "text/css", body: CSS });
      }
      if (url.pathname.endsWith("assets/js/docs-ui.js")) {
        return route.fulfill({ status: 200, contentType: "text/javascript", body: JS });
      }
      if (url.pathname.endsWith(".json")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: data });
      }
      const asset = libraryViewerAsset(url.pathname);
      if (asset) return route.fulfill({ status: 200, ...asset });
      return route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto(`http://127.0.0.1:8080/cat-harness/library/who-iris/index.html${hash}`);
    await page.waitForLoadState("networkidle");
    // PARK THE POINTER OFF THE RAIL. The viewer rail expands to an OVERLAY
    // 248-264 px wide on hover, by design. In CI the pointer starts over it,
    // and Playwright hit-tests before it moves, so a control in the first
    // 264 px reads as covered and the click retries until timeout. Since bean
    // gnqa wrapped the pull-out under the slug (x = 74), this is that case.
    // Reproduced locally by hovering (10, 300) first. A person reaching for
    // the button has, by definition, moved off the rail.
    await page.mouse.move(900, 600);
  };

  test("a row's href is the entry's own path IRI", async ({ page }) => {
    await serveView(page);
    const row = page.locator("[data-fa-library-item]").first();
    const key = await row.getAttribute("data-fa-library-item");
    const href = await row.getAttribute("data-fa-library-href");
    // The entry's own IRI, a materialized path (#1881) — never a fragment.
    const [inst, id] = key!.split("/");
    expect(href).toBe(`/cat-harness/library/${encodeURIComponent(inst!)}/${encodeURIComponent(id!)}/`);
  });

  test("and the glass carries it, so a pulled-out asset is reachable", async ({ page }) => {
    // The whole point of the href: before this, an asset on the glass was
    // named and went nowhere.
    await serveView(page);
    const row = page.locator("[data-fa-library-item]").first();
    const key = await row.getAttribute("data-fa-library-item");
    await row.locator(".fa-pullout").click();
    await page.locator(".fa-glass-handle").click();
    // The card's NAME link, not every link on it: a card whose source has a
    // viewer also carries the eye (`[data-fa-control="view"]`, cat-harness
    // a949b6d0), which is a second `<a>` to the same entry's view panel.
    await expect(page.locator(`.fa-glass-asset[data-fa-asset="${key}"] a.fa-glass-asset-name`)).toHaveCount(1);
  });

  test("arriving at a LEGACY anchor SELECTS the row, at its path IRI", async ({ page }) => {
    // The page is a shell (#1881); the selection logic is the shared script.
    const js = readFileSync(overlayPath(join(SITE_ABS, "assets", "library", "viewer.js")), "utf8");
    expect(js).toContain("honourAddress");
    const data = JSON.parse(readFileSync(DATA2, "utf8")) as { entries: Array<{ instance: string; id: string }> };
    const mine = data.entries.find((e) => e.instance === "who-iris");
    test.skip(!mine, "no who-iris entry in the projection to anchor to");
    const key = `${mine!.instance}/${mine!.id}`;
    await serveView(page, `#${encodeURIComponent(key)}`);
    await expect(page.locator(`[data-fa-library-item="${key}"]`))
      .toHaveAttribute("data-fa-anchored", "1");
    // Normalised ONCE to the entry's own IRI; nothing new carries the fragment.
    expect(new URL(page.url()).pathname).toBe(`/cat-harness/library/who-iris/${encodeURIComponent(mine!.id)}/`);
  });

  test("a legacy anchor for ANOTHER library's asset goes to THAT asset's IRI", async ({ page }) => {
    // A folio carries assets ACROSS libraries, so an anchor naming an asset
    // this page does not scope is ordinary rather than exceptional. Since
    // every entry has its own materialized IRI (#1881), the page no longer
    // explains that the asset is elsewhere — it goes there.
    const data = JSON.parse(readFileSync(DATA2, "utf8")) as { entries: Array<{ instance: string; id: string }> };
    const other = data.entries.find((e) => e.instance !== "who-iris");
    test.skip(!other, "projection holds only who-iris entries");
    const key = `${other!.instance}/${other!.id}`;
    await serveView(page, `#${encodeURIComponent(key)}`);
    await page.waitForURL((u) => u.pathname === `/cat-harness/library/${other!.instance}/${encodeURIComponent(other!.id)}/`);
  });

  test("no fragment at all changes nothing", async ({ page }) => {
    await serveView(page);
    await expect(page.locator("[data-fa-anchored]")).toHaveCount(0);
  });
});

test.describe("the folio viewer page RUNS — not just 'the bytes are current'", () => {
  /**
   * `check:artefact-verification` exists for exactly this gap, and its own
   * declaration names the precedent: *"library:viz:check was green while the
   * page it generated could not run (PR #805)."*
   *
   * A staleness check regenerates and diffs. It cannot tell whether the page
   * it blessed throws on load, fetches a projection that 404s, or renders an
   * empty table over a graph that has nodes. Those are the consumer's
   * questions and only a browser answers them. Bean `7ofc`.
   */
  const PAGE_F = declaredPagePath(ROOT, "folio");
  const DATA_F = join(SITE_ABS, "assets", "folio", "index.json");

  const serveFolio = async (page: import("@playwright/test").Page, data?: string) => {
    // Themed since 2026-10-07: served as the layout serves it, which is
    // also what brings the folio down on it (docs-ui, routed below).
    const html = asLayoutServesIt(PAGE_F);
    const body = data ?? readFileSync(DATA_F, "utf8");
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("assets/css/docs-ui.css")) {
        return route.fulfill({ status: 200, contentType: "text/css", body: CSS });
      }
      if (url.pathname.endsWith("assets/js/docs-ui.js")) {
        return route.fulfill({ status: 200, contentType: "text/javascript", body: JS });
      }
      // The row's and the rail's own files, which docs-ui loads (beans `lhvt`, `lnoy`).
      // Resolved through the site LAYERS, not the pages' directory alone: since
      // the chrome moved to `site-chrome/`, `assets/js/navbar-row.js` is not
      // under SITE_ABS, and the fallback below answered it with HTML.
      {
        const at = url.pathname.indexOf("/assets/");
        const file = at < 0 ? "" : join(ROOT, siteFileFor(ROOT, url.pathname.slice(at + 1)));
        if (file && /\/assets\/(navbar\/|js\/navbar|css\/navbar)/.test(url.pathname) && existsSync(file)) {
          return route.fulfill({ status: 200, contentType: file.endsWith(".css") ? "text/css" : "text/javascript", body: readFileSync(file, "utf8") });
        }
      }
      if (url.pathname.endsWith("folio/index.json")) {
        if (body === "__404__") return route.fulfill({ status: 404, body: "nope" });
        return route.fulfill({ status: 200, contentType: "application/json", body });
      }
      return route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto("http://127.0.0.1:8080/cat-harness/folio/index.html");
    await page.waitForLoadState("networkidle");
  };

  test("it loads with no console error and renders every node", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await serveFolio(page);
    const expected = (JSON.parse(readFileSync(DATA_F, "utf8")) as { nodes: unknown[] }).nodes.length;
    await expect(page.locator("#nodes tbody tr")).toHaveCount(expected);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the badge count equals the rows it shows", async ({ page }) => {
    // `tis1`: a count nobody can see is a count nobody checks, and a badge
    // also makes a WRONG count visible — which is how the voices tile was
    // caught saying 5 over a graph of 6.
    await serveFolio(page);
    const rows = await page.locator("#nodes tbody tr").count();
    await expect(page.locator("#badges")).toContainText(String(rows));
  });

  test("a declared-but-absent directory gets a ROW, not silence", async ({ page }) => {
    // `dh4f`. Fed a projection naming a directory that is not present, the
    // page must say so rather than omit it — a consumer that scans nothing
    // and reports a clean run is the defect this repository keeps paying for.
    await serveFolio(page, JSON.stringify({
      directories: [{ dir: "somewhere/gone", present: false, nodes: 0 }],
      nodes: [],
    }));
    await expect(page.locator("#dirs")).toContainText("somewhere/gone");
    await expect(page.locator("#dirs .pill.warn")).toContainText("declared, absent");
  });

  test("an empty graph is NOT reported as a graph that could not load", async ({ page }) => {
    await serveFolio(page, JSON.stringify({ directories: [], nodes: [] }));
    await expect(page.locator("#nodes")).toContainText("not a graph that could not be read");
  });

  test("...and a projection that 404s says THAT instead — the third state", async ({ page }) => {
    // The two are opposite facts and the page must not render them alike.
    await serveFolio(page, "__404__");
    await expect(page.locator("#nodes")).toContainText("could not be read");
    await expect(page.locator("#nodes")).toContainText("not an empty folio");
  });

  test("and the reader's folio comes down on it", async ({ page }) => {
    await serveFolio(page);
    await expect(page.locator(".fa-glass-handle")).toBeVisible();
  });
});
