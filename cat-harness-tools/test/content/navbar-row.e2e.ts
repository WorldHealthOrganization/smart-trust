import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteDirFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * The three JS-mounted navbar regions, as a browser actually builds them.
 *
 * Owner, 2026-09-22, giving the whole layout in one message: *"[x] should be
 * on the navbar w/ other icons, can make two lines avatar+name of
 * harness/catalogue/sub-grrraph as approrirate, the second line are the icons.
 * max is 6 and one for todos one for beans one for processes viewer/ (the
 * factory flow) one for KG viewer. next on navbar then is is library docs/ and
 * other controlled folders next would the navigation for the current harness
 * (per its rules)."*
 *
 * ## Why this file exists
 *
 * `scripts/tests/ui/navbar.test.ts` covers the RAIL — `lib/navbar.ts` renders
 * markup for a mounted page and its output is a string a unit test can read.
 * The Jekyll sidebar is a different construction: `mountNavIconRow`,
 * `mountDocumentIndex` and `mountInstanceGraphs` build the same three regions
 * in the DOM at load, from `#fa-navbar-row`. None of that was covered at any
 * layer when it shipped in #959 — a gap measured after the fact, by grepping
 * the test tree for every class the round introduced and finding zero files.
 *
 * ## The regression it is most for
 *
 * `mountInstanceGraphs` MOVES `.site-nav` into a wrapper and `mountDocumentIndex`
 * inserts before `.site-nav`. Run in the wrong order, `insertBefore` gets a
 * reference node that is no longer a child of `.side-bar`, throws
 * `NotFoundError`, and takes the REST of `init()` with it — the QA panels and
 * the figures vanished from one DOM move, and every one of them looked like a
 * separate bug. So a `pageerror` listener is attached in every test here, not
 * just the one about ordering: a thrown exception in `init()` is silent in a
 * browser and turns the next assertion into a mystery.
 *
 * ## Three states, again
 *
 * `#fa-navbar-row` is `null` when the layer declares no `navbarIcons` and
 * inherits none, ABSENT when the template did not run, and an object when it
 * decided. The page must not draw an empty row for either of the first two:
 * that reports an un-migrated layer as a deliberate one, which is the same
 * collapse `schemas/navbar-icons.test.ts` guards one layer down.
 *
 * NO BACKTICKS INSIDE THE TEMPLATE LITERAL that builds the page — the whole
 * document is one, so a backtick anywhere in it, comments included, ends the
 * string and the file stops parsing as "No tests found" rather than as a
 * syntax error (bean `bmr0`).
 */

// `import.meta.dir` is a Bun extension and is undefined under Node, which is
// what Playwright runs the spec with.
const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
// The row's own stylesheet FIRST, as `head_custom.html` links it (beans `lhvt`, `9rq1`).
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/navbar-row.css"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
// `navbar-row.js` FIRST — it draws the row, and `docs-ui.js` calls it — as `head_custom.html` loads them.
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js"))), "utf8") + "\n" + readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const QR = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");

const BASEURL = "/folio-assistant";

/**
 * The row this layer actually resolved — READ from the generated file.
 *
 * Not retyped. `action-tiles.e2e.ts` carries the argument in full: a fixture
 * that restates the value under test agrees with a wrong one and passes. This
 * spec asserts the row the site ships, so a declaration change that breaks the
 * page breaks the test.
 */
type NavbarRow = {
  icons: string[];
  hrefs: Record<string, string>;
  notes?: Record<string, string>;
  folders: { kind: string; within?: string; path?: string; note?: string; stagingOnly?: true }[];
};
const HARNESS = JSON.parse(readFileSync(overlayPath(join(ROOT, SITE, "_data/harness.json")), "utf8")) as {
  navbar: NavbarRow | null;
  harnesses: { name: string; visualisations?: { kind: string; within?: string }[] }[];
};
const LIVE = HARNESS.navbar;
if (LIVE === null) {
  // Not a skip. This layer IS the floor that declares the default, so a
  // null here means `cat-harness.json` lost its `navbarIcons` — the spec would
  // otherwise quietly stop testing the thing it is named for.
  throw new Error(
    "docs/_data/harness.json has navbar:null — cat-harness is the declared floor " +
      "and must resolve a row. Run `bun run cat docs:harness`.",
  );
}

/** A small hand-built row, for the cases the live one does not happen to hold. */
const CUSTOM: NavbarRow = {
  icons: ["close", "todos", "beans", "kg", "launcher"],
  // `beans` and `kg` deliberately have NO href: declared, not published.
  hrefs: { todos: "/todos/" },
  // ...and each carries WHY, in the wording `harness-tiles.ts` computes. Two
  // DIFFERENT reasons on purpose: the whole point of the ruling on #1036 is
  // that the four inert states stay told apart at the last step, so a fixture
  // with one reason twice could not catch them being collapsed.
  notes: { beans: "no viewer yet", kg: "staging only" },
  folders: [
    { kind: "library", path: "/library/" },
    { kind: "memory", note: "no viewer by design" },
    // A PATH THAT RESOLVES AND A PAGE THAT IS NOT THERE — the staging-only
    // case, which had no fixture and no live case until `fsh-guts` was swept
    // out of a canonical build.
    { kind: "fsh-guts", path: "/fsh-guts/", stagingOnly: true },
    // NO NOTE AT ALL — data older than the note being carried. Not a fourth
    // state, and the page must not invent one for it.
    { kind: "scenarios" },
  ],
};

const HEADINGS =
  '<h1 id="t">Title</h1>' +
  '<h2 id="one">One</h2>' +
  '<h3 id="one-a">One A</h3>' +
  '<h2 id="two">Two</h2>' +
  "<h2>Unlinkable</h2>" +
  '<h4 id="deep">Too deep</h4>';

function page(row: NavbarRow | null | "absent" | "broken", main: string = HEADINGS, staging = ""): string {
  const script =
    row === "absent"
      ? ""
      : '<script type="application/json" id="fa-navbar-row">' +
        (row === "broken" ? "{not json" : JSON.stringify(row)) +
        "<\/script>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="fa-baseurl" content="${BASEURL}">
  <meta name="fa-staging" content="${staging}">
  <style>
  body { margin: 0; }
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; align-items: flex-end;
              background: #27262b; color: #fff; }
  .site-header { width: 100%; max-height: 3.75rem; overflow: hidden; display: flex; align-items: center; }
  /* The theme sizes the avatar link to its 3.75rem header; it is a link now (the open control). */
  .site-title { flex: 1; display: flex; align-items: center; min-height: 3.75rem; }
  .site-nav { width: 100%; overflow-y: auto; }
  /* THE THEME'S OWN NAV LINK, copied from a real build rather than written
     from memory: padding 4px 32px, line-height 24px, so 32px tall. The theme
     sizes this element, not us, and a fixture that left it as a bare anchor
     measured 17px and reported the THEME as failing the target floor. Same
     rule action-tiles.e2e.ts states for its search markup.
     NO BACKTICKS HERE -- this comment is inside the page template literal, and
     one ends the string. It did, and the suite reported "No tests found"
     rather than a syntax error (bean bmr0). */
  .site-nav a { display: block; padding: 4px 32px; font-size: 14px; line-height: 24px; }
  ${CSS}
</style></head><body>
  ${script}
  <div class="side-bar">
    <div class="site-header"><a class="site-title" href="#home"><span class="fa-site-mark"></span><span class="fa-site-title">folio-assistant</span></a></div>
    <nav class="site-nav"><a href="#">Navigation link</a></nav>
    <input type="checkbox" class="fa-nav-open" id="fa-nav-open">
    <footer class="site-footer">
      <div class="fa-nav-bottom__stack">
        <details class="fa-harness-tabs">
          <summary class="fa-harness-tabs__heading">Harnesses <span class="fa-harness-tabs__count">1</span></summary>
          <ul class="fa-harness-tabs__list">
            <li class="fa-harness-tab">
              <a class="fa-harness-tab__body" href="#x">
                <span class="fa-harness-tab__mark fa-harness-tab__mark--initial">W</span>
                <span class="fa-harness-tab__label">who-iris</span>
              </a>
              <ul class="fa-harness-tab__graphs"><li class="fa-harness-graph"><a class="fa-harness-graph__link" href="#g">docs</a></li></ul>
            </li>
          </ul>
        </details>
      </div>
      <a class="fa-nav-home" href="#home"><span class="fa-nav-home__mark">&#8962;</span><span class="fa-nav-home__label">Home</span></a>
    </footer>
  </div>
  <div class="main"><div class="main-header"></div><div class="main-content">${main}</div></div>
  <script>window.jtd = { theme: "dark",
    getTheme: function () { return this.theme; },
    setTheme: function (t) { this.theme = t; } };<\/script>
  <script>${QR}<\/script>
  <script>${JS}<\/script>
</body></html>`;
}

/**
 * Load a fixture and hand back everything the page said on the way up.
 *
 * `pageerror` is the one that matters: an exception in `init()` produces a
 * half-built navbar and no other signal, so every test here asserts it is
 * empty rather than only the test that is about ordering.
 */
async function load(
  p: import("@playwright/test").Page,
  row: NavbarRow | null | "absent" | "broken",
  main?: string,
  staging = "",
): Promise<{ errors: string[]; console: string[] }> {
  const errors: string[] = [];
  const logs: string[] = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => logs.push(m.type() + ": " + m.text()));
  // SERVED FROM AN ORIGIN, not `setContent`. A document set that way has an
  // opaque origin and `localStorage` THROWS a SecurityError on it — which
  // quietly made the whole fixture the private-window case, so the stay-closed
  // preference's persistence would have gone untested while a test named for
  // it passed. `route` + `goto` gives a real `http://` origin and costs one
  // handler.
  await p.route("http://navbar.fixture/**", (r) =>
    r.fulfill({ contentType: "text/html", body: page(row, main, staging) }),
  );
  await p.goto("http://navbar.fixture/nav", { waitUntil: "load" });
  // AT REST MEANS THE POINTER IS NOT OVER THE STRIP, and that is now stated
  // rather than inherited. The strip sits at the left edge, where the pointer
  // starts. With Playwright 1.63's Chromium, the "at rest" tests found the bar
  // already open, as if hovered, on the bump PR (bean x89e) and passed on the
  // same main without it. Parking the pointer in the far corner makes "no hover"
  // a precondition these tests set, not one a browser revision decides.
  const vp = p.viewportSize();
  if (vp) await p.mouse.move(vp.width - 5, vp.height - 5);
  // Moving away from a bar the browser already considered hovered STARTS its
  // close transition. Asserting "at rest" while that runs sees a half-closed
  // bar, which was the one failure left after the pointer was parked. So
  // wait for every running animation or transition to finish, after two
  // frames so a transition the move just queued is already registered.
  await p.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // An infinite animation (a spinner) never finishes, so it is left out:
    // only something that ends can be waited for.
    const settling = document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity);
    await Promise.all(settling.map((a) => a.finished.catch(() => undefined)));
  });
  return { errors, console: logs };
}

test.describe("the icon row — line 2 of the fixed top", () => {
  test("draws one slot per declared icon, in order, minus the declared close", async ({ page }) => {
    // `close` stays in the declaration -- the layer still says six -- and
    // is SKIPPED here rather than dropped. Nothing draws it on a theme page
    // any more: the avatar is the open and close control (ob3m finding 8).
    const { errors } = await load(page, LIVE);
    expect(errors).toEqual([]);
    const drawn = LIVE.icons.filter((i) => i !== "close");
    // The DECLARED slots. The light/dark switch follows them (owner,
    // 2026-09-27: "light dark mode on main icon tab") and is not one.
    // Nor are the Folio icon (owner, 2026-11-13: it replaces the tab at the
    // top) and the rail's Harnesses icon: drawn where their panels exist.
    const slots = ".fa-nav-icons .fa-nav-icon:not(.fa-nav-scheme):not(.fa-nav-folio):not(.fa-nav-harnesses)";
    await expect(page.locator(slots)).toHaveCount(drawn.length);
    expect(drawn).not.toContain("close");
    const labels = await page.locator(slots).evaluateAll((ns) =>
      ns.map((n) => n.getAttribute("aria-label")),
    );
    // fsh-guts joined the row "with the others" (owner, 2026-10-02, #1925). Its
    // accessible name carries the live count after a dash, so only its stem is
    // pinned here; the count states are `fshGutsCount`'s to test.
    expect(labels.map((l) => (l ?? "").split(" — ")[0])).toEqual([
      // Processes and Knowledge graph left the row (owner, 2026-10-05, bean
      // `82qs`); language is the glass band's globe (#2211), not a row slot.
      // Todos, Beans and fsh-guts left it on 2026-11-13 (owner: "remove the
      // fsh-guts, beans and todos").
      "QR code for this page", "More actions",
    ]);
    // ...then the switch, then the Folio icon, last. No [x] after them (ob3m finding 8).
    const tail = await page.locator(".fa-nav-icons > *").evaluateAll((ns) =>
      ns.slice(-2).map((n) => (n.classList.contains("fa-nav-scheme") ? "scheme" : n.classList.contains("fa-nav-folio") ? "folio" : n.className)),
    );
    expect(tail).toEqual(["scheme", "folio"]);
  });

  test("SIX DISTINCT drawings — a row where slots look alike says nothing", async ({ page }) => {
    // `glyphFor` falls back to one net glyph, which would have given four of
    // these five the same picture. The count of distinct markup is the check;
    // which drawing is which is a design decision this does not pin.
    await load(page, LIVE);
    const glyphs = await page
      .locator(".fa-nav-icons .fa-nav-icon")
      .evaluateAll((ns) => ns.map((n) => n.innerHTML));
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  test("QR icon button toggles the current page QR code inside the LHS navbar (bean 5rmf)", async ({ page }) => {
    const { errors } = await load(page, LIVE);
    expect(errors).toEqual([]);

    const qrBtn = page.locator(".fa-nav-icons button.fa-nav-qr");
    await expect(qrBtn).toHaveCount(1);
    await expect(qrBtn).toHaveAttribute("aria-label", "QR code for this page");
    await expect(qrBtn).toHaveAttribute("aria-expanded", "false");

    const qrPanel = page.locator(".side-bar > .fa-qr-panel");
    await expect(qrPanel).toHaveCount(1);
    await expect(qrPanel).toHaveAttribute("data-open", "false");
    await expect(qrPanel).toBeHidden();

    // First click opens it
    await qrBtn.click();
    await expect(qrBtn).toHaveAttribute("aria-expanded", "true");
    await expect(qrPanel).toHaveAttribute("data-open", "true");
    await expect(qrPanel).toBeVisible();

    // Renders the QR code SVG and caption matching the current URL
    const svg = qrPanel.locator("svg");
    await expect(svg).toHaveCount(1);
    const caption = qrPanel.locator(".fa-qr-caption");
    await expect(caption).toHaveCount(1);
    expect(await caption.textContent()).toBe(page.url());

    // THE BAR OPENS WITH IT (measured 2026-10-12): the code lives in the bar,
    // and the pointer on the icon column holds the strip shut, so the code
    // opened as a 56px sliver. Opening it pins the bar.
    await expect.poll(async () => (await page.locator(".side-bar").boundingBox())!.width).toBeGreaterThan(200);
    expect((await qrPanel.boundingBox())!.width).toBeGreaterThan(150);

    // Second click closes it (l4zi: reachable inverse)
    await qrBtn.click();
    await expect(qrBtn).toHaveAttribute("aria-expanded", "false");
    await expect(qrPanel).toHaveAttribute("data-open", "false");
    await expect(qrPanel).toBeHidden();
    // ...and gives back only the pin it made: not pinned, and not held open by
    // the icon's focus once the pointer leaves.
    expect(await page.locator("#fa-nav-open").isChecked()).toBe(false);
    await page.mouse.move(900, 400);
    await expect.poll(async () => (await page.locator(".side-bar").boundingBox())!.width).toBeLessThan(100);

    // Open again, clicking panel closes it
    await qrBtn.click();
    await expect(qrPanel).toHaveAttribute("data-open", "true");
    await qrPanel.click();
    await expect(qrBtn).toHaveAttribute("aria-expanded", "false");
    await expect(qrPanel).toHaveAttribute("data-open", "false");

    // Open again, pressing Escape key closes it
    await qrBtn.click();
    await expect(qrPanel).toHaveAttribute("data-open", "true");
    await page.keyboard.press("Escape");
    await expect(qrBtn).toHaveAttribute("aria-expanded", "false");
    await expect(qrPanel).toHaveAttribute("data-open", "false");
  });

  test("a published destination is a link; a declared one that is not is NOT", async ({ page }) => {
    // `pb04`: a dead link invites a click and then reads as a broken site,
    // while a silent omission answers "where is beans" with nothing. So the
    // slot is rendered, and it is not an anchor.
    const { errors } = await load(page, CUSTOM);
    expect(errors).toEqual([]);
    // `^=`: the name gains its live count once `count.json` is read (bean `gkv6`).
    const todos = page.locator('.fa-nav-icons [aria-label^="Todos"]');
    // WITH THE BASEURL. `#fa-navbar-row` is `jsonify`d raw, unlike
    // `#fa-site-links`, which Liquid has already run `relative_url` over — so
    // a site-root path arriving here is unprefixed and composing it without
    // the base resolves against the ORIGIN. This is the THIRD family to hit
    // that (issue #801 was the graph tiles, and the action tiles carry the
    // rule in their own comment); the owner found it live, 2026-09-23:
    // *"beans and todos links wrong ... https://litlfred.github.io/beans/"*.
    //
    // The first version of this assertion expected the UNPREFIXED value, so
    // it agreed with the defect and passed. That is the failure
    // `action-tiles.e2e.ts` names in full — a fixture that restates the value
    // under test cannot catch a wrong one — arrived at from the other side:
    // the expectation was not read from anything, it was copied off the code.
    await expect(todos).toHaveAttribute("href", BASEURL + "/todos/");
    // THE REASON IS IN THE ACCESSIBLE NAME. This row is glyphs with no words,
    // so `aria-label` is the only channel a screen reader has — and it said
    // just "Beans" for a slot that goes nowhere, describing a working control
    // to somebody who cannot see that it is grey (`gjli`).
    for (const [gap, why] of [["Beans", "no viewer yet"], ["Knowledge graph", "staging only"]]) {
      const slot = page.locator('.fa-nav-icons [aria-label^="' + gap + '"]');
      await expect(slot).toHaveCount(1);
      await expect(slot).toHaveClass(/fa-nav-icon--dead/);
      expect(await slot.evaluate((n) => n.tagName)).toBe("SPAN");
      await expect(slot).toHaveAttribute("aria-label", gap + " — " + why);
      await expect(slot).toHaveAttribute("title", gap + " — " + why);
    }
    // ...and the two reasons are DIFFERENT. A fixture that asserted one
    // wording twice would pass with the four states collapsed into one, which
    // is the defect the ruling on #1036 is about.
    const labels = await page
      .locator(".fa-nav-icons .fa-nav-icon--dead")
      .evaluateAll((ns) => ns.map((n) => n.getAttribute("aria-label")));
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("EVERY composed href carries the baseurl — the class, not the instance", async ({ page }) => {
    // Named as a class on purpose. Three separate tile/link families have now
    // shipped a site-root path unprefixed, each fixed on its own, and a test
    // per layer is what let the next one through. This asserts the property
    // over both regions that compose from `#fa-navbar-row`, so a FOURTH
    // consumer added to either of them cannot repeat it quietly.
    // The live row has no link slot since 2026-11-13 (its Todos, Beans and
    // fsh-guts left it), so two are added to it: the property is the class's.
    await load(page, { ...LIVE, icons: [...LIVE.icons, "todos", "beans"], hrefs: { ...LIVE.hrefs, todos: "/todos/", beans: "/beans/" } });
    const hrefs = await page
      .locator(".fa-nav-icons a[href], .fa-nav-folders a[href]")
      .evaluateAll((ns) => ns.map((n) => n.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) {
      expect(h.startsWith(BASEURL + "/")).toBe(true);
      // ...and prefixed ONCE. Running the base over an already-composed value
      // is the failure in the other direction, which is why the action tiles
      // do NOT prefix inside the shared `tileLink`.
      // `BASEURL + "/"`, not the bare base: since the separation a layer
      // is NAMED `folio-assistant-core`, and its auto-docs href
      // `…/docs/folio-assistant-core-docs/` contains the bare string without
      // repeating the prefix. A doubled prefix is `/folio-assistant/folio-assistant/`.
      expect(h.indexOf(BASEURL + "/", 1)).toBe(-1);
    }
  });

  test("the launcher drives the EXISTING panel — one toggle over one state", async ({ page }) => {
    // `mountActionTiles` owns the panel and its open/close state. A second
    // button with its own idea of whether the panel is open is the `l4zi`
    // defect from the other direction, so this one clicks that one.
    const { errors } = await load(page, LIVE);
    expect(errors).toEqual([]);
    await expect(page.locator(".fa-tiles-toggle")).toHaveCount(1);
    await expect(page.locator(".fa-tiles-toggle")).toHaveAttribute("aria-expanded", "false");
    await page.locator('.fa-nav-icons [aria-label^="More actions"]').click();
    await expect(page.locator(".fa-tiles-toggle")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".fa-tiles")).toBeVisible();
  });

  test("DECLARED NONE draws no row at all, and says so once", async ({ page }) => {
    // The third state. An empty row would report an un-migrated layer as a
    // deliberate one, so there is no row and the console carries the reason at
    // INFO — a declaration gap is an author's to fix, not a reader's.
    const { errors, console: logs } = await load(page, null);
    expect(errors).toEqual([]);
    await expect(page.locator(".fa-nav-icons")).toHaveCount(0);
    expect(logs.join("\n")).toContain("declares no navbarIcons");
  });

  test("an absent element is not a decision either — no row, and no noise", async ({ page }) => {
    const { errors, console: logs } = await load(page, "absent");
    expect(errors).toEqual([]);
    await expect(page.locator(".fa-nav-icons")).toHaveCount(0);
    // Nothing to report: the template did not run, which a reader cannot act
    // on and an author sees in the build.
    expect(logs.join("\n")).not.toContain("declares no navbarIcons");
  });

  test("malformed JSON warns and mounts nothing — and init() CARRIES ON", async ({ page }) => {
    const { errors, console: logs } = await load(page, "broken");
    expect(errors).toEqual([]);
    await expect(page.locator(".fa-nav-icons")).toHaveCount(0);
    expect(logs.join("\n")).toContain("not valid JSON");
    // The point of the assertion below: a parse failure in one region must not
    // be a blank page chrome. The glass handle is mounted after the row, from
    // nothing this element holds, and it is still there.
    await expect(page.locator("body > .fa-glass-handle")).toHaveCount(1);
  });
});

/**
 * THE COLLAPSED STRIP — marks only, and asserted as a CLASS.
 *
 * Owner, 2026-09-23, with a screenshot: *"looks horrible when collapsed.
 * should only be icons/avatars so compat."* What they were looking at was
 * `On this page` clipped to "ON" over six folder names bleeding out of a
 * 3.5rem column.
 *
 * ## Why the regression happened, and what that means for this test
 *
 * The stylesheet hid three named regions. The round that added the document
 * index and the folder block added two more and did not extend that list, so
 * they were never hidden — the defect was in the ENUMERATION. A test that
 * named the two missing regions would be the same mistake one layer up: it
 * would pass, and the next region added would go uncovered in exactly the same
 * way.
 *
 * So the assertion is a property over the whole sidebar: AT REST, NO TEXT IN
 * IT IS VISIBLE. Effective opacity is computed by walking the ancestor chain,
 * because `opacity` does not inherit as a computed value — an element inside
 * an `opacity: 0` parent still reports `1` for itself, which is how an earlier
 * probe of this page reported eight visible rows that a screenshot showed were
 * not there.
 */
test.describe("at rest the strip carries marks and nothing else", () => {
  /** Every element in the sidebar whose own text is actually rendered. */
  const visibleText = () => {
    const bar = document.querySelector(".side-bar")!;
    const out: string[] = [];
    for (const n of Array.from(bar.querySelectorAll("*"))) {
      const own = Array.from(n.childNodes)
        .filter((x) => x.nodeType === 3)
        .map((x) => (x.textContent ?? "").trim())
        .join(" ")
        .trim();
      if (!own) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // A MARK MAY BE TEXT and is not a label: `fa-harness-tab__mark--initial`
      // renders one letter for a harness with no avatar, and `fa-nav-home__mark`
      // is the `⌂` glyph. Both are exactly what the owner asked the strip to
      // keep, so they are excluded by ROLE rather than by name — anything the
      // markup calls a mark, a glyph or an icon is a picture here, whatever
      // characters it happens to be drawn with.
      const role = (n.className || "").toString();
      if (/mark|glyph|icon|count/.test(role) && !/__label|__heading/.test(role)) continue;
      // Effective opacity: the product up the chain. `opacity` is not an
      // inherited property, so the element's own value says nothing about
      // whether a reader can see it.
      let op = 1;
      for (let a: Element | null = n; a && a !== bar.parentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.visibility === "hidden" || cs.display === "none") { op = 0; break; }
        op *= Number(cs.opacity);
      }
      if (op > 0.01) out.push((n.className || n.tagName).toString().split(" ")[0] + ": " + own.slice(0, 24));
    }
    return out;
  };

  test("the folio handle is not in the sidebar, and the avatar still takes its clicks", async ({ page }) => {
    // Owner, 2026-09-27: the handle is back at the top centre, "not on
    // navbar". Kept as a guard: the avatar must still take its clicks. A
    // click on a CLOSED bar (no hover: dispatched, so the pointer does not
    // move onto it) pins it open; an open bar's avatar is the home link
    // (owner, 2026-10-30), and says so. Its href is the theme's, so the
    // fixture's `#home` is what it keeps; "goes home" is tested below.
    await load(page, CUSTOM);
    await expect(page.locator(".side-bar .fa-glass-handle")).toHaveCount(0);
    await expect(page.locator("body > .fa-glass-handle")).toHaveCount(1);
    await page.locator(".side-bar .site-title").dispatchEvent("click");
    await expect(page.locator("#fa-nav-open")).toBeChecked();
    await expect(page.locator(".side-bar .site-title")).toHaveAttribute("title", "Go to the landing page");
  });

  test("NO text region is visible until the bar is opened", async ({ page }) => {
    const { errors } = await load(page, CUSTOM);
    expect(errors).toEqual([]);
    // The viewport is wider than the 50rem breakpoint, so the strip rules are
    // the ones in force. Stated rather than assumed: below it the theme owns
    // the sidebar and hides nothing, which would make this pass for the wrong
    // reason.
    expect(page.viewportSize()!.width).toBeGreaterThan(800);
    expect(await page.evaluate(visibleText)).toEqual([]);
  });

  test("...and every one of them comes back on hover", async ({ page }) => {
    // The other half, and it is not decoration: a rule that hides at rest and
    // forgets to restore is the same defect wearing the opposite sign, and it
    // would look correct in the screenshot that prompted this.
    await load(page, CUSTOM);
    await page.hover(".side-bar");
    await page.waitForTimeout(250);
    const shown = (await page.evaluate(visibleText)).join(" | ");
    // "On this page" and "Folders" are the rail's own sections since 2026-10-15
    // (one rail on every page), so this sidebar no longer carries them.
    for (const region of ["fa-site-title", "fa-harness-tabs__heading", "fa-harness-tab__label", "fa-nav-home__label"]) {
      expect(shown).toContain(region);
    }
  });

  test("the marks stay — they are what the strip is FOR", async ({ page }) => {
    await load(page, CUSTOM);
    // Icons and marks, at rest, with no hover.
    await expect(page.locator(".fa-nav-icons .fa-nav-icon").first()).toBeVisible();
    await expect(page.locator(".fa-nav-home__mark")).toBeVisible();
  });

  test("the harness avatars follow their group, and that is a TRADE the owner made", async ({ page }) => {
    // Two instructions, one day apart, that pull opposite ways:
    //
    //   *"should only be icons/avatars so compat"*  — 2026-09-23, morning
    //   *"harnesses start closed"*                  — 2026-09-23, later
    //
    // The harness avatars live inside that group, so a closed group takes them
    // out of the strip. The second instruction is the later one and is
    // implemented literally; this test states the consequence rather than
    // hiding it, so that reversing it is one `open` in `nav_footer_custom.html`
    // and one expectation here.
    //
    // NOT worked around in CSS. A stylesheet that revealed a closed
    // disclosure's contents would make `[open]` stop meaning what it says,
    // which is worse than either answer.
    await load(page, CUSTOM);
    await expect(page.locator(".fa-harness-tabs")).not.toHaveAttribute("open", "");
    await expect(page.locator(".fa-harness-tab__mark")).not.toBeVisible();

    await page.hover(".side-bar");
    await page.locator(".fa-harness-tabs__heading").click();
    await expect(page.locator(".fa-harness-tab__mark")).toBeVisible();
  });

  test("the icon row STACKS at rest and lies flat when open", async ({ page }) => {
    // Six 36px icons are 232px wide; in a 3.5rem strip five of them are off
    // the edge. Measured as tops rather than as a CSS property, because
    // `flex-wrap` is the mechanism and the requirement is the layout.
    await load(page, CUSTOM);
    const tops = () => page.locator(".fa-nav-icons .fa-nav-icon").evaluateAll(
      (ns) => ns.map((n) => Math.round(n.getBoundingClientRect().top)));
    const rest = await tops();
    expect(new Set(rest).size).toBe(rest.length);
    await page.hover(".side-bar");
    await page.waitForTimeout(250);
    const open = await tops();
    expect(new Set(open).size).toBe(1);
  });


  test("the fixed bottom stays ANCHORED to the bottom in both states", async ({ page }) => {
    // The measurement that decided `flex-basis: 0`: with `flex: 1 1 auto` the
    // middle started from its own 1008px of links, the column overflowed, and
    // every region shrank proportionally — the fixed bottom to 104px, showing
    // ONE of five harness avatars. Collapsing the middle to nothing instead
    // floated the bottom up to meet the icons, which is the opposite failure.
    // Since 2026-11-13 the icon row is the bar's LAST region (owner: "put
    // these controls at the bottom of the navbar"), so the fixed bottom sits
    // directly on the row, and the row on the bar's foot.
    await load(page, CUSTOM);
    const bottomOf = async (sel: string) =>
      await page.locator(sel).evaluate((n) => Math.round(n.getBoundingClientRect().bottom));
    const topOf = async (sel: string) =>
      await page.locator(sel).evaluate((n) => Math.round(n.getBoundingClientRect().top));
    const barBottom = await bottomOf(".side-bar");
    expect(barBottom - (await bottomOf(".side-bar > .fa-nav-icons"))).toBeLessThan(24);
    expect((await topOf(".side-bar > .fa-nav-icons")) - (await bottomOf(".fa-nav-home"))).toBeLessThan(24);
    await page.hover(".side-bar");
    await page.waitForTimeout(250);
    expect(barBottom - (await bottomOf(".side-bar > .fa-nav-icons"))).toBeLessThan(24);
    expect((await topOf(".side-bar > .fa-nav-icons")) - (await bottomOf(".fa-nav-home"))).toBeLessThan(24);
  });
});

/**
 * THE TARGET FLOOR, over the whole navbar.
 *
 * `ui-accessibility`: *"Targets are at least 24x24 CSS px (SC 2.5.8), and aim
 * higher: 32px for rows in a list … Density is cheaper than a missed target."*
 * This layer's declared interaction profile is low-dexterity, so it is a
 * binding constraint rather than a nicety.
 *
 * ## Why this test did not exist, and what its absence cost
 *
 * The repository already holds this floor in two places — the KG viewer's
 * `a11y.e2e.ts` and the language bar — and the NAVBAR was in neither. Three
 * rows had drifted under it unnoticed, measured at 1400x900 on a built site:
 * `.fa-doc-index__link` and `.fa-nav-folders__link` at **23px** (one pixel
 * short, from a padding rule copied between them) and `.fa-harness-graph__link`
 * at **26x13** — an inline `<a>`, so its box was exactly its text.
 *
 * So the assertion is a SWEEP rather than three named selectors. Naming them
 * would pass the day a fourth row is added, which is exactly how these three
 * got here.
 */
test.describe("every row in the navbar is a target", () => {
  test("nothing interactive in the sidebar is under 24px", async ({ page }) => {
    await load(page, CUSTOM);
    // Opened and every disclosure expanded: a row inside a closed `<details>`
    // has no box to measure, and a sweep that skipped them would report clean
    // over the rows most likely to be wrong.
    await page.hover(".side-bar");
    for (const heading of [".fa-doc-index__heading", ".fa-nav-folders__heading", ".fa-harness-tabs__heading"]) {
      const h = page.locator(".side-bar " + heading);
      if (await h.count()) await h.click();
    }
    await page.waitForTimeout(300);

    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const e of Array.from(
        document.querySelectorAll('.side-bar a[href], .side-bar button, .side-bar summary, .side-bar [role="button"]'),
      )) {
        const r = e.getBoundingClientRect();
        // A zero box is hidden, not small — the theme's skip link is 1x1 until
        // it takes focus, and reporting it would be reporting a control that
        // is correct.
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 24 || r.width < 24) {
          out.push(`${(e.className || e.tagName).toString().split(" ")[0]} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return out;
    });
    expect(small).toEqual([]);
  });

  test("...and the sweep actually found something to measure", async ({ page }) => {
    // `dh4f` in a test: a selector that matched nothing would make the
    // assertion above pass over an empty set, which is indistinguishable from
    // a navbar with no defects.
    await load(page, CUSTOM);
    await page.hover(".side-bar");
    const n = await page
      .locator('.side-bar a[href], .side-bar button, .side-bar summary')
      .evaluateAll((ns) => ns.filter((e) => e.getBoundingClientRect().height > 0).length);
    expect(n).toBeGreaterThan(5);
  });
});

/**
 * A GLYPH PAINTS WITH `currentColor`, OR IT PAINTS BLACK.
 *
 * Owner, 2026-09-23, with a screenshot of the dark-mode navbar: *"exploding
 * icon hard to see in dark mode"*. It was not hard to see — it was black. An
 * SVG shape with no `fill` takes the initial value, which is black, and the
 * element's `color` never reaches it.
 *
 * ## Why no contrast check would have caught it
 *
 * The icon's own computed `color` is a perfectly good `rgb(230,225,232)` and
 * its effective opacity is 0.8, so a contrast check that reads the ELEMENT
 * reports **7.99:1** — on an icon rendering at about **1.4:1**. The only way
 * it shows is to walk the painted shapes, which is what this does.
 *
 * Two of the five glyphs were wrong and the other three were fine for a reason
 * worth keeping: the three are strokes, wrapped in `fill="none"
 * stroke="currentColor"`, and only the two FILLED ones had nothing saying what
 * colour to fill with. So this is a sweep rather than two named glyphs — the
 * next filled glyph added is the next one to get this wrong.
 */
test.describe("every glyph in the navbar paints with the text colour", () => {
  test("no shape falls back to the initial black", async ({ page }) => {
    await load(page, LIVE);
    const black = await page.evaluate(() => {
      const out: string[] = [];
      const shapes = ".fa-nav-icons svg rect, .fa-nav-icons svg circle, .fa-nav-icons svg ellipse, " +
        ".fa-nav-icons svg path, .fa-nav-icons svg polygon, .fa-nav-icons svg polyline, .fa-nav-icons svg line";
      for (const sh of Array.from(document.querySelectorAll(shapes))) {
        const cs = getComputedStyle(sh);
        // Black fill AND no stroke: nothing else is carrying the colour, so
        // this shape is painted with the initial value on whatever is behind
        // it. A black fill WITH a stroke is a filled-and-outlined shape and is
        // a judgement, not a fallback.
        if (cs.fill === "rgb(0, 0, 0)" && (cs.stroke === "none" || cs.stroke === "")) {
          out.push((sh.closest("[aria-label]")?.getAttribute("aria-label") ?? "?") + " <" + sh.tagName + ">");
        }
      }
      return out;
    });
    expect(black).toEqual([]);
  });

  test("...and the sweep found shapes to look at", async ({ page }) => {
    // `dh4f`: a selector that matched nothing would pass the assertion above
    // over an empty set, which is what a navbar with no icons also looks like.
    await load(page, LIVE);
    const n = await page.locator(".fa-nav-icons svg *").count();
    expect(n).toBeGreaterThan(5);
  });
});

/**
 * STAY CLOSED, REMEMBERED — the owner's choice of three.
 *
 * Owner, 2026-09-23: *"need mechansim for closing harness navabar (e.g. w/ all
 * pages)"*, with a screenshot of the bar open and nothing to press. The bar
 * had ONE state bit — pinned or not — and also opened on hover, with `[x]`
 * shown only while pinned. So a bar opened by a pointer had no control, and a
 * touch reader, with no pointer to move away, had no way at all.
 *
 * Asked rather than guessed, because the three answers build differently. The
 * owner chose the three-state one: `[x]` whenever the bar is open, and
 * pressing it remembers a stay-closed preference across pages.
 */
test.describe("the navbar can be closed, and the hover peek comes back", () => {
  // ONE CONTROL since ob3m finding 8 (owner, 2026-10-01): the avatar. The [x]
  // and the hamburger are gone from theme pages, as #1762 removed them from
  // the rail. Owner, 2026-10-12: *"when LHS navbar is slid open, the navbar
  // remains collapsed. you then have to click the avatar to open it"* -- with
  // the avatar the only close, a REMEMBERED stay-closed withheld the peek on
  // every page after any close. A close now holds only until the pointer
  // leaves the bar, and is not stored.
  const avatar = (p: import("@playwright/test").Page) => p.locator(".side-bar .site-title");

  test("no [x] and no hamburger are drawn -- the avatar is the control", async ({ page }) => {
    await load(page, CUSTOM);
    await expect(page.locator(".fa-nav-close, .fa-nav-toggle, .side-bar .fa-nav-head")).toHaveCount(0);
    await expect(avatar(page)).toHaveAttribute("aria-controls", /.+/);
    await expect(avatar(page)).toHaveAttribute("aria-expanded", "false");
  });

  /* Owner, 2026-10-30: an open bar's avatar goes home, so the avatar no
   * longer closes the bar. Owner, 2026-11-02 (Q-FMR-11 A): a bar pinned open
   * unpins when the MOUSE leaves it, and goes back to the hover peek. A pin
   * comes from a click on a CLOSED bar with no hover, which is the touch
   * case, so it is dispatched here rather than clicked: a real mouse would
   * hover the strip open first, and its click would go home. */
  const pin = async (p: import("@playwright/test").Page) => {
    await avatar(p).dispatchEvent("click");
    await expect(p.locator("#fa-nav-open")).toBeChecked();
    await expect(avatar(p)).toHaveAttribute("aria-expanded", "true");
  };

  test("a pin lifts when the mouse leaves the bar, and nothing is stored", async ({ page }) => {
    await load(page, CUSTOM);
    await pin(page);
    await page.hover(".side-bar .site-nav");
    await page.mouse.move(900, 400);
    await expect(page.locator("#fa-nav-open")).not.toBeChecked();
    await expect(avatar(page)).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => (await page.locator(".side-bar").boundingBox())!.width).toBeLessThan(100);
    expect(await page.evaluate(() => window.localStorage.getItem("fa-nav"))).toBeNull();
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-fa-nav"))).toBeNull();
  });

  test("a stay-closed an earlier visit STORED is cleared, not obeyed", async ({ page }) => {
    await page.addInitScript(() => {
      try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("fa-nav", "closed"); sessionStorage.setItem("seeded", "1"); } } catch {}
    });
    await load(page, CUSTOM);
    expect(await page.evaluate(() => window.localStorage.getItem("fa-nav"))).toBeNull();
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-fa-nav"))).toBeNull();
    await page.hover(".side-bar .site-nav");
    await expect.poll(async () => (await page.locator(".side-bar").boundingBox())!.width).toBeGreaterThan(200);
  });

  test("after the pin lifts, the hover peek comes back -- and so does keyboard focus", async ({ page }) => {
    await load(page, CUSTOM);
    await pin(page);
    await page.hover(".side-bar .site-nav");
    await page.mouse.move(900, 400);
    await expect.poll(async () => (await page.locator(".side-bar").boundingBox())!.width).toBeLessThan(100);
    await page.hover(".side-bar .site-nav");
    await expect.poll(async () => (await page.locator(".side-bar").boundingBox())!.width).toBeGreaterThan(200);
    await page.mouse.move(900, 400);
    await expect.poll(async () => (await page.locator(".side-bar").boundingBox())!.width).toBeLessThan(100);

    // A KEYBOARD READER IS NOT TRAPPED: keyboard focus still opens it. A key
    // press first gives the focus the keyboard's modality (`:focus-visible`).
    await page.keyboard.press("Shift");
    await page.locator(".side-bar .site-nav a").first().focus();
    expect(await page.evaluate(() => document.activeElement!.matches(":focus-visible"))).toBe(true);
    await expect.poll(async () => (await page.locator(".side-bar").boundingBox())!.width).toBeGreaterThan(200);
  });

  test("a finger leaving does NOT lift the pin -- the tap that pinned it would undo itself", async ({ page }) => {
    await load(page, CUSTOM);
    await pin(page);
    await page.locator(".side-bar").evaluate((bar) => {
      bar.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "touch", bubbles: false }));
    });
    await expect(page.locator("#fa-nav-open")).toBeChecked();
  });

  test("by KEYBOARD, Enter on the focused avatar goes home rather than toggling", async ({ page }) => {
    await load(page, CUSTOM);
    await page.keyboard.press("Shift");
    await avatar(page).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.url()).toBe("http://navbar.fixture/nav#home");
    await expect(page.locator("#fa-nav-open")).not.toBeChecked();
  });

  test("a browser that refuses localStorage still pins and unpins", async ({ page }) => {
    // Nothing is stored any more, but the load still READS storage to clear an
    // old stay-closed, so a throwing localStorage must not break the bar.
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() { throw new Error("denied"); },
      });
    });
    const { errors } = await load(page, CUSTOM);
    expect(errors).toEqual([]);
    await pin(page);
    await page.hover(".side-bar .site-nav");
    await page.mouse.move(900, 400);
    await expect(page.locator("#fa-nav-open")).not.toBeChecked();
    await expect.poll(async () => (await page.locator(".side-bar").boundingBox())!.width).toBeLessThan(100);
  });
});

test.describe("a sub-graph is drawn INSIDE its parent's row, folded — issue #1164", () => {
  /* Owner, 2026-09-23: proposals live in *"a docs/proposals/ sub-graph
   * declared sub-sub-graph (which starts closed in navbar, general
   * behavior)"*. GENERAL: whatever carries `within`, not a case for docs. */
  const _NESTED: NavbarRow = {
    icons: ["close"],
    hrefs: {},
    folders: [
      // The children come FIRST in the data on purpose: the page must still
      // find their parent's row.
      { kind: "proposals", within: "docs", path: "/proposals/" },
      { kind: "docs", path: "/docs/" },
      { kind: "requirements", within: "docs", path: "/requirements/" },
      { kind: "library", path: "/library/" },
      // A parent that is not listed: the child stands on its own rather than
      // vanishing.
      { kind: "orphan", within: "nowhere", path: "/orphan/" },
    ],
  };

  test("the LIVE data nests proposals and requirements under docs", () => {
    // Asked of the harness that DECLARES them. Until the separation the
    // landing row was cat-harness's own; since the owner set the landing to
    // folio-assistant-core (3d4caf6), the navbar row is core's and correctly
    // lists core's folders, which have no proposals. The property is unchanged:
    // a sub-graph carries `within` its parent, read where it is declared.
    const f = HARNESS.harnesses.find((h) => h.name === "cat-harness")?.visualisations ?? [];
    expect(f.find((x) => x.kind === "proposals")?.within).toBe("docs");
    expect(f.find((x) => x.kind === "requirements")?.within).toBe("docs");
  });
});

test.describe("the avatar pins a closed bar and goes home from an open one — owner, 2026-09-27 and 2026-10-30", () => {
  // 2026-09-27: "navbar starts hidden, click avatar opens for a split second
  // then returns to hidden": the avatar was the home link, so a click on a
  // closed bar reloaded the page. 2026-10-30: "who eblmen not clicable to go
  // to landing page": once the bar is open, the avatar IS the home link.
  test("a click on a closed bar pins it without navigating; a click on the open bar goes home", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await load(page, CUSTOM);
    const avatar = page.locator(".side-bar .site-title");
    await expect(avatar).toHaveAttribute("aria-expanded", "false");
    await avatar.dispatchEvent("click");
    expect(page.url()).toBe("http://navbar.fixture/nav");
    expect(await page.locator("#fa-nav-open").isChecked()).toBe(true);
    await expect(avatar).toHaveAttribute("aria-expanded", "true");
    await avatar.click();
    await expect.poll(() => page.url()).toBe("http://navbar.fixture/nav#home");
    expect(await page.evaluate(() => localStorage.getItem("fa-nav"))).toBeNull();
  });
});

test.describe("on a folio's site the fish is not this site's trashcan — #2263 follow-up", () => {
  // `foreign-site-scope.ts` re-bases the platform's fsh-guts onto the
  // platform (an absolute href, with WHOSE in `whose`) or unlinks it with a
  // note. The fish used to be drawn as the dialog BUTTON regardless, and its
  // count was fetched from this site's `/fsh-guts.json`, which a folio's site
  // does not publish: it showed "?", an error, for what is an absence.
  const PLATFORM = "https://example.org/folio-assistant";
  const borrowed = {
    icons: ["fsh-guts"],
    hrefs: { "fsh-guts": PLATFORM + "/fsh-guts/" },
    whose: { "fsh-guts": "the platform's: ig-folio declares no fsh-guts graph" },
    notes: {},
    folders: [],
  } as NavbarRow;
  const unlinked = {
    icons: ["fsh-guts"],
    hrefs: {},
    notes: { "fsh-guts": "ig-folio declares no fsh-guts graph" },
    folders: [],
  } as NavbarRow;

  test("re-based onto the platform: a link that says whose, with no count and no dialog", async ({ page }) => {
    const { errors } = await load(page, borrowed);
    expect(errors).toEqual([]);
    await expect(page.locator(".fa-nav-icons [data-fa-fsh-guts-open]")).toHaveCount(0);
    const fish = page.locator('.fa-nav-icons a[aria-label^="fsh-guts"]');
    await expect(fish).toHaveCount(1);
    await expect(fish).toHaveAttribute("href", PLATFORM + "/fsh-guts/");
    await expect(fish).toHaveAttribute("aria-label", "fsh-guts, discarded items — the platform's: ig-folio declares no fsh-guts graph");
    await expect(fish.locator(".fa-nav-count")).toHaveCount(0);
  });

  test("unlinked: an inert icon that says why, never a '?'", async ({ page }) => {
    const { errors } = await load(page, unlinked);
    expect(errors).toEqual([]);
    await expect(page.locator(".fa-nav-icons [data-fa-fsh-guts-open]")).toHaveCount(0);
    const fish = page.locator('.fa-nav-icons [aria-label^="fsh-guts"]');
    await expect(fish).toHaveClass(/fa-nav-icon--dead/);
    await expect(fish).toHaveAttribute("aria-label", "fsh-guts, discarded items — ig-folio declares no fsh-guts graph");
    await expect(page.locator(".fa-nav-icons")).not.toContainText("?");
  });

  test("the platform's own row still draws the dialog button", async ({ page }) => {
    const { errors } = await load(page, { icons: ["fsh-guts"], hrefs: { "fsh-guts": "/fsh-guts/" }, notes: {}, folders: [] });
    expect(errors).toEqual([]);
    await expect(page.locator(".fa-nav-icons [data-fa-fsh-guts-open]")).toHaveCount(1);
  });
});
