/**
 * The accessibility gate.
 *
 * Bean `gjli`: "ALL UI MUST FOLLOW ACCESSIBILITY GUIDELINES." A rule with no
 * check is an assertion, and the bean's own finding was that nothing here was
 * checkable — no a11y gate existed in this repository.
 *
 * ## Why axe alone is not the standard
 *
 * axe-core is necessary and it is not sufficient, and this suite exists in two
 * halves because of a measured fact rather than a principle.
 *
 * Baselined against the knowledge-graph viewer on 2026-09-19, axe found two
 * defects — insufficient colour contrast and undersized targets — and **none
 * of the four found by reading the markup against the rule**. The worst of
 * those four was a one-hop neighbourhood diagram whose every node was a bare
 * `<circle>` with a click handler: unreachable by keyboard, while the same
 * edges in the table beside it were fine.
 *
 * axe could not flag it. A `<circle>` with an `onclick` is not *recognised* as
 * interactive, so there is no control there to find a fault with. An automated
 * pass over a control the checker cannot see is not evidence about that
 * control.
 *
 * The complement holds too, which is the honest other half: making those nodes
 * real buttons introduced an ARIA contradiction — `role="img"` on the SVG,
 * which is a leaf in the accessibility tree, wrapped around focusable children
 * — and **axe caught that immediately** where a human reading the diff had
 * not. Neither half of this file replaces the other.
 *
 * ## Why the thresholds are above the floor
 *
 * This layer's declared interaction profile is low-dexterity
 * (`cat-harness/memory/interaction.json`). WCAG 2.2 SC 2.5.8 asks for 24x24 CSS pixels;
 * a target that is barely legal is a target that is hard to hit. The page aims
 * at 32px for list and facet rows and 28px for inline edge controls, and the
 * assertion below holds the 24px line so a regression is caught even if the
 * comfort margin is spent.
 *
 * @module test/a11y.e2e
 */
import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { artefactStubFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/** This file's own repo root: it resolves assets from three different
 * local variables, so the site root gets one name here too. */
const REPO_A11Y = join(HARNESS_ROOT);

// The viewer lives one level DOWN from the graph — `_kg/<stub>/index.html`
// reading `../<stub>/<stub>.jsonld` (#603 decision 1b) — mirroring the published layout, where
// `<base>/<stub>/` is the directory that makes the extensionless
// `<base>/<stub>` a page GitHub Pages can serve. Driving the real relative
// path is the point: a viewer that resolved its document correctly in a flat
// fixture and wrongly in the deployed tree is exactly the failure a stand-in
// hides.
/**
 * The published artefact name, RESOLVED from the declaration.
 *
 * These were `folio-assistant` literals until the 2026-09-21 stub rename
 * (issue #649), which is the same repair made in `kg-viewer.e2e.ts` and for
 * the same reason: the exporter writes `_kg/<stub>/<stub>.jsonld`, so a literal here
 * sends the suite looking for a file nothing produces.
 */
const STUB = artefactStubFor(REPO_A11Y);

// `_kg/${STUB}/${STUB}.jsonld` and its page are generated once, before any worker
// starts, by `e2e-global-setup.ts` (bean `dlqu`) — not here, where every
// worker loading this module would run the generators concurrently.

const PAGE = `/_kg/${STUB}/index.html`;

/** WCAG 2.0/2.1/2.2 A and AA. Level AAA is not the bar being claimed. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Put the page in its most-populated state: a node selected, panel drawn. */
async function selectANode(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(PAGE);
  await page.locator("#q").fill("beans-cli");
  await page.locator("#list li button").first().click();
  await expect(page.locator(".detail h3")).toBeVisible();
}

test.describe("accessibility — automated", () => {
  // Both schemes and both widths, because a contrast pair that passes in one
  // scheme can fail in the other: the viewer shipped `color: #fff` on an
  // accent that is dark in light mode (5.97:1) and LIGHT in dark mode
  // (2.19:1). One value written once, never rechecked in the other scheme.
  for (const colorScheme of ["light", "dark"] as const) {
    for (const [name, viewport] of [
      ["desktop", { width: 1280, height: 860 }],
      ["phone", { width: 390, height: 780 }],
    ] as const) {
      test(`no WCAG A/AA violations — ${colorScheme}, ${name}`, async ({ browser }) => {
        const ctx = await browser.newContext({ colorScheme, viewport });
        const page = await ctx.newPage();
        await selectANode(page);
        const { violations } = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();
        // Named in the failure, so a red run says WHAT rather than how many.
        expect(violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
        await ctx.close();
      });
    }
  }
});

/* ── The viewer, in a language that is not English ──────────────────────── */

/**
 * A translated interface is a DIFFERENT interface, and a gate that only ever
 * ran in English is a gate over one of the pages this generator can produce.
 *
 * Nothing translated ships yet — every `translations/<locale>/kg-viewer.po` is a stub
 * with empty msgstrs, awaiting a person — so the language switcher, the
 * announcement, the right-to-left flip and the target sizes under a different
 * script would be unchecked, in a repository whose own rule is that a check
 * which does not run is a habit rather than a rule.
 *
 * `scripts/tests/kg-viewer-fixture.ts` therefore calls the REAL generator with
 * a pseudolocalised catalogue of its own, under the reserved tag `qaa` so no
 * real language is impersonated. It declares itself right-to-left, which is
 * the one thing no left-to-right catalogue could exercise and the direction
 * Arabic will arrive in.
 */
const I18N_PAGE = "/_kg/folio-assistant-i18n-fixture/index.html";
// Generated by `e2e-global-setup.ts`, once, for the reason above.

test.describe("accessibility — a translated, right-to-left interface", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`no WCAG A/AA violations — translated and RTL, ${colorScheme}`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme, viewport: { width: 1280, height: 860 } });
      const page = await ctx.newPage();
      await page.goto(`${I18N_PAGE}?lang=qaa`);
      await page.locator("#q").fill("beans-cli");
      await page.locator("#list li button").first().click();
      await expect(page.locator(".detail h3")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      const { violations } = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();
      expect(violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
      await ctx.close();
    });
  }

  test("the language switcher is reachable and operable from the keyboard", async ({ page }) => {
    // A switcher only a mouse can reach hands the choice to exactly the people
    // this layer's declared interaction profile says to build for first.
    await page.goto(I18N_PAGE);
    const other = page.locator('.lang[lang="qaa"]');
    await other.focus();
    await expect(other).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#list-h")).toHaveText("«Nodes»");

    // Space too: it is a button, and a button answers both.
    await page.locator('.lang[lang="en"]').focus();
    await page.keyboard.press(" ");
    await expect(page.locator("#list-h")).toHaveText("Nodes");
  });

  test("changing language is announced, not just redrawn", async ({ page }) => {
    // The whole page is rewritten in place and the reader's cursor does not
    // move. Without a live region they are told nothing at all.
    await page.goto(I18N_PAGE);
    await expect(page.locator("#langstatus")).toHaveAttribute("aria-live", "polite");
    await page.locator('.lang[lang="qaa"]').click();
    await expect(page.locator("#langstatus")).toHaveText("«Interface language: Qaa (fixture)»");
  });

  test("a language button names its language, and declares it", async ({ page }) => {
    // The name IS the accessible name, so there is nothing to mistranslate --
    // and the lang attribute is what lets a screen reader switch voice rather
    // than read one language's name in another's.
    await page.goto(I18N_PAGE);
    await expect(page.locator('.lang[lang="en"]')).toHaveText("English");
    await expect(page.locator('.lang[lang="qaa"]')).toHaveText("Qaa (fixture)");
    await expect(page.locator('.lang[lang="qaa"]')).toHaveAttribute("dir", "rtl");
  });

  test("no language button is under the 24px target floor", async ({ page }) => {
    // Language names have very different widths -- 中文 beside Français -- so a
    // control sized only by its own text is one that shrinks in some
    // languages. The floor is held rather than assumed.
    await page.goto(I18N_PAGE);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll(".lang")]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height < 24 || r.width < 24).length);
    expect(small).toBe(0);
  });

  test("the accessible names are translated too, not just the visible text", async ({ page }) => {
    // Half a translation is a screen reader still reading English out of a
    // translated page, with no visible text to say so.
    await page.goto(`${I18N_PAGE}?lang=qaa`);
    await expect(page.locator("#detail")).toHaveAttribute("aria-label", "«Selected node»");
    await expect(page.locator("#langs")).toHaveAttribute("aria-label", "«Interface language»");
    // And the field keeps a name of its own after typing, in any language.
    await page.locator("#q").fill("beans");
    const name = await page.locator("#q").evaluate((el) => {
      const id = el.getAttribute("id");
      const lab = id === null ? null : document.querySelector(`label[for="${id}"]`);
      return el.getAttribute("aria-label") ?? lab?.textContent ?? null;
    });
    expect(name).toBeTruthy();
  });
});

/* ── The docs site's own UI ─────────────────────────────────────────────── */

/**
 * The second surface under the rule, and it is a different KIND of surface:
 * the viewer above is a generated page this repo writes end to end, while
 * everything here is mounted by script into an unpinned remote theme's markup
 * — the action tiles and their views in the sidebar, and the per-page language
 * bar in `.main-content`. Contrast is the pair to watch: these sit on
 * backgrounds that differ per scheme, and a token checked in one scheme and
 * not the other is the trap this project has already paid for once.
 */
const INSTANCE_ROOT = join(HARNESS_ROOT);

/**
 * The harness page, as a function of THE SITE'S scheme rather than the OS's.
 *
 * The loop below has always said `light` and `dark`, and until 2026-09-19 it
 * only ever rendered the dark palette: `colorScheme` on the context sets
 * `prefers-color-scheme`, which this stylesheet consults twice and for
 * something else entirely. What the site's own colours key off is
 * `data-fa-scheme`, which `docs-ui.js` derives from `jtd.getTheme()` — and the
 * stub below was pinned to `"dark"`. A per-scheme token checked twice in the
 * same scheme is not checked in both.
 *
 * It is stamped on `<html>` as well as returned by the stub so the first paint
 * already has it. Otherwise the attribute lands after the bar has mounted, and
 * a `transition: background` means a reader of `getComputedStyle` — or an axe
 * run that is quick off the mark — can sample a colour that is on its way out.
 *
 * `fa-translation-meta` is here so the language bar renders all three of its
 * states: with no meta every locale but English is "not yet translated", and
 * the available-locale colour — one of the three text tokens — is never put on
 * screen for anything to measure.
 */
const tilesPage = (scheme: "light" | "dark") => `<!doctype html><html lang="en" data-fa-scheme="${scheme}"><head><meta charset="utf-8"><title>Action tiles harness</title><style>
  body { margin: 0; }
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; align-items: flex-end;
              background: #27262b; color: #fff; }
  .site-header { width: 100%; max-height: 3.75rem; overflow: hidden; display: flex; align-items: center; }
  .site-title { flex: 1; }
  .site-nav { width: 100%; overflow-y: auto; }
  /* The theme colours its own nav links; a bare UA #0000ee on the dark
     sidebar is a harness artefact, and leaving it in would have this gate
     failing on markup the site does not ship. */
  .site-nav a { color: inherit; }
  ${readFileSync(overlayPath(join(INSTANCE_ROOT, siteFileFor(INSTANCE_ROOT, "assets/css/docs-ui.css"))), "utf8")}
</style></head><body>
  <script type="application/json" id="fa-translation-meta">{"lang":"en","availableLocales":["fr","es"]}<\/script>
  <script type="application/json" id="fa-site-links">{"kg":"/folio-assistant/folio-assistant/","jsonld":"/folio-assistant/folio-assistant.jsonld","source":"https://example.invalid/r"}<\/script>
  <div class="side-bar">
    <div class="site-header"><a class="site-title">folio-assistant</a></div>
    <nav class="site-nav"><a href="#">Home</a></nav>
  </div>
  <div class="main"><div class="main-header">
    <!-- just-the-docs' own search, which docs-ui.js MOVES into the launcher.
         It is here so axe measures the field WHERE IT ENDS UP -- on the
         opaque sidebar panel, not on the main column it was written for. -->
    <div class="search" role="search"><div class="search-input-wrap">
      <input type="text" id="search-input" class="search-input" tabindex="0"
             placeholder="Search folio-assistant" autocomplete="off">
      <label for="search-input" class="search-label"><span class="sr-only">Search folio-assistant</span><svg viewBox="0 0 24 24" class="search-icon" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor"/></svg></label>
    </div><div id="search-results" class="search-results"></div></div>
  </div><div class="main-content"><h1>Harness</h1></div></div>
  <script>window.jtd = { theme: "${scheme}", getTheme: function () { return this.theme; },
    setTheme: function (t) { this.theme = t; } };<\/script>
  <script>${readFileSync(overlayPath(join(INSTANCE_ROOT, siteFileFor(INSTANCE_ROOT, "assets/js/vendor/qrcode.js"))), "utf8")}<\/script>
  <script>${readFileSync(overlayPath(join(INSTANCE_ROOT, siteFileFor(INSTANCE_ROOT, "assets/js/docs-ui.js"))), "utf8")}<\/script>
</body></html>`;

test.describe("accessibility — the docs-site UI", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const [state, open] of [
      ["the grid", [] as string[]],
      ["a view", ["Page settings"]],
      // The search field is the new control and the one most likely to fail
      // contrast: it lands on an opaque sidebar panel it was not styled for.
      ["the search view", ["Search"]],
      // THE VIEW THIS LOOP DID NOT OPEN, and the gap is the whole of `rptk`'s
      // second half. `buildLanguageBar()` kept the inline literals the
      // per-page bar was fixed for -- an unavailable tab at `opacity:0.5`
      // composited to 1.39:1, the current tab to 3.67:1 -- for two days after
      // the scope came off the run above, because a page-wide axe pass only
      // measures what is ON the page, and this bar is behind a tile nobody
      // clicked. Three of four tiles checked is not the tiles checked.
      ["the language view", ["Language"]],
    ] as const) {
      test(`no WCAG A/AA violations — ${state}, ${colorScheme}`, async ({ browser }) => {
        const ctx = await browser.newContext({ colorScheme });
        const page = await ctx.newPage();
        await page.setContent(tilesPage(colorScheme));
        await page.locator(".fa-tiles-toggle").click();
        for (const tile of open) await page.locator(".fa-tile", { hasText: tile }).click();
        // THE WHOLE PAGE, not just `.side-bar`.
        //
        // This run was scoped to the sidebar because a page-wide one failed on
        // the per-page language bar that `mountPageLanguageBar()` puts in
        // `.main-content` — #cbd1d9 on #f0f0f0 at 1.34:1 across five locale
        // tabs, and #ffffff on #3b82f6 at 3.67:1 on the current one, against a
        // 4.5:1 floor. Failing the tiles' gate for a defect that was not the
        // tiles' is how a gate gets weakened later, so it was recorded as bean
        // `rptk` and the scope stayed until the bar was fixed.
        //
        // It is fixed (per-scheme tokens in `docs-ui.css`, measured beside
        // each), so the scope comes off. What is checked here now is every
        // control `docs-ui.js` mounts into this page: the action tiles and
        // their views in `.side-bar`, AND the language bar in `.main-content`
        // — in both site schemes, since `tilesPage` drives `data-fa-scheme`.
        const { violations } = await new AxeBuilder({ page })
          .withTags([...TAGS])
          .analyze();
        // Named with the offending markup, because "color-contrast (7)" on its
        // own does not say WHICH pair, and a contrast failure is always a pair.
        expect(violations.map((v) => `${v.id}: ` +
          v.nodes.map((n) => n.failureSummary ?? n.html).join(" | "))).toEqual([]);
        await ctx.close();
      });
    }
  }
});

test.describe("scheme coherence — the question axe cannot ask", () => {
  /* Bean `23bc`, owner: *"class=\"fa-qr-toggle fa-tiles-toggle\" does not
   * respect light mode."*
   *
   * The axe runs above drive this exact harness in BOTH schemes and passed
   * throughout, while `.fa-tiles` painted `#27262b` on a light page. They were
   * right to: a dark panel with light text PASSES contrast. Scheme incoherence
   * is not a WCAG failure, so no amount of axe coverage would have found it —
   * which makes the gate's silence evidence of nothing, and is the whole
   * reason this describe block exists beside it.
   *
   * What it asserts is the property a reader actually notices: **in light
   * mode, the panel is light.** Stated as a luminance comparison rather than a
   * hex equality, so a future palette change that keeps the intent passes and
   * only an inverted one fails. */
  const luminance = (rgb: string): number => {
    const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? ["0", "0", "0"]).slice(0, 3)
      .map((n) => Number(n) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  };

  for (const [scheme, expectation] of [
    ["light", "light"],
    ["dark", "dark"],
  ] as const) {
    test(`the tiles panel is ${expectation} in the ${scheme} scheme`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await page.setContent(tilesPage(scheme));
      await page.locator(".fa-tiles-toggle").click();
      const bg = await page.locator(".fa-tiles").evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );
      // 0.5 is the midpoint of relative luminance: everything above it reads
      // as a light surface, everything below as a dark one. A threshold rather
      // than a value, so the assertion survives a palette that changes shade
      // without changing side.
      const L = luminance(bg);
      if (expectation === "light") expect(L, `panel was ${bg}`).toBeGreaterThan(0.5);
      else expect(L, `panel was ${bg}`).toBeLessThan(0.5);
      await ctx.close();
    });

    test(`the language bar sits on the same side as its panel — ${scheme}`, async ({ browser }) => {
      // The coupling this change had to repair. `.fa-lang-bar` was tokenised
      // hours earlier with a comment arguing ONE palette was correct *because*
      // `.fa-tiles` had no light override. Fixing `23bc` falsified that, and a
      // bar still painting #27262b inside a light panel is the visible form of
      // a claim that outlived its reason.
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await page.setContent(tilesPage(scheme));
      await page.locator(".fa-tiles-toggle").click();
      await page.locator(".fa-tile", { hasText: "Language" }).click();
      const [panel, bar] = await Promise.all([
        page.locator(".fa-tiles").evaluate((el) => getComputedStyle(el).backgroundColor),
        page.locator(".fa-lang-bar").evaluate((el) => getComputedStyle(el).backgroundColor),
      ]);
      const side = (c: string) => luminance(c) > 0.5;
      expect(side(bar), `panel ${panel}, bar ${bar}`).toBe(side(panel));
      await ctx.close();
    });
  }
});

test.describe("accessibility — what axe cannot check", () => {
  test("the neighbourhood diagram is operable by keyboard", async ({ page }) => {
    // The gap axe is structurally unable to see. Every node in this diagram
    // was a <circle> with a click handler: no role, no tabindex, no keyboard
    // path, and nothing for a checker to report.
    await selectANode(page);
    const node = page.locator(".detail svg g.node").first();
    await expect(node).toHaveAttribute("role", "button");
    await expect(node).toHaveAttribute("tabindex", "0");

    await node.focus();
    const active = await page.evaluate(() => document.activeElement?.getAttribute("role"));
    expect(active).toBe("button");
  });

  test("Enter and Space follow an edge, as a button must", async ({ page }) => {
    // A <button> gets these from the platform. An SVG group with role="button"
    // does not, and a control that only answers the mouse is not a control.
    for (const key of ["Enter", " "]) {
      await selectANode(page);
      const before = await page.locator(".detail h3").textContent();
      await page.locator(".detail svg g.node").first().focus();
      await page.keyboard.press(key);
      await expect(page.locator(".detail h3")).not.toHaveText(String(before));
    }
  });

  test("every neighbour announces where it goes and how", async ({ page }) => {
    // The visible label is aria-hidden and truncated to 26 characters; the
    // accessible name is the whole thing plus the edge it travels.
    await selectANode(page);
    const label = await page.locator(".detail svg g.node").first().getAttribute("aria-label");
    expect(label).toMatch(/^(Links to|Referenced by) .+ via \w+$/);
  });

  test("no interactive target is under 24px tall", async ({ page }) => {
    // WCAG 2.2 SC 2.5.8. The page aims higher — see the module note — and this
    // holds the floor so the comfort margin can be spent without silence.
    await selectANode(page);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const e of document.querySelectorAll('button, a[href], [role="button"]')) {
        const r = e.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 24) out.push(`${e.className || e.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    expect(small).toEqual([]);
  });

  test("a keyboard user can skip the facet column", async ({ page }) => {
    await page.goto(PAGE);
    await page.keyboard.press("Tab");
    const skip = page.locator("a.skip");
    await expect(skip).toBeFocused();
    // Visible only when focused — it must not be a permanent artefact, and it
    // must not be one of those skip links that is hidden from everyone.
    await expect(skip).toBeVisible();
  });

  test("the search field has a name that survives typing", async ({ page }) => {
    // A placeholder IS the accessible name until somebody types, and then the
    // field has none. axe passes a placeholder-only input; a user does not.
    await page.goto(PAGE);
    await page.locator("#q").fill("beans");
    const name = await page.locator("#q").evaluate((el) => {
      const id = el.getAttribute("id");
      const lab = id === null ? null : document.querySelector(`label[for="${id}"]`);
      return el.getAttribute("aria-label") ?? lab?.textContent ?? null;
    });
    expect(name).toBeTruthy();
    expect(name).not.toBe("");
  });

  test("selecting a node is announced, not just redrawn", async ({ page }) => {
    // The panel is rewritten in place. Without a live region a screen-reader
    // user activates an edge and is told nothing: the page changed and their
    // cursor did not move.
    await page.goto(PAGE);
    const detail = page.locator("#detail");
    await expect(detail).toHaveAttribute("aria-live", "polite");
    await expect(detail).toHaveAttribute("role", "region");
  });

  test("filtering announces how many nodes matched", async ({ page }) => {
    await page.goto(PAGE);
    await page.locator("#q").fill("beans-cli");
    await expect(page.locator("#count")).toHaveAttribute("aria-live", "polite");
    await expect(page.locator("#count")).toContainText(/node/);
  });

  test("focus is visible, and not left to the UA default", async ({ page }) => {
    // The page had no focus styling at all and was never checked against the
    // accent backgrounds a focused control sits on.
    await page.goto(PAGE);
    await page.locator("#q").focus();
    const outline = await page.locator("#q").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.outlineWidth, style: cs.outlineStyle };
    });
    expect(outline.style).not.toBe("none");
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });
});

/* ── The sticky todo board ──────────────────────────────────────────────── */

/**
 * The board, the pinned layer, and the greyed slot.
 *
 * Run in BOTH schemes and BOTH viewports, like the viewer above, because the
 * defect this catches is a colour that passes in one scheme and fails in the
 * other from a single declaration — measured at 5.97:1 light / 2.19:1 dark.
 * The sticky CSS is written as neutral overlays over `currentColor` precisely
 * so it cannot have that shape; this is what says so rather than assuming it.
 *
 * The board is checked OPEN and with a sticky PINNED, because a hidden region
 * has no contrast to measure and an empty float layer has no card in it. An
 * axe run over a surface that is not on screen is a green that means nothing.
 */
test.describe("the sticky todo board", () => {
  const STICKY_ITEMS = [
    {
      id: "a", summary: "Decide the thing", comment: "Some detail.",
      status: "open", priority: "high", origin: "agent", createdAt: "2026-09-19",
      tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
      // Relations must be PRESENT here or the axe runs below are green over
      // chips that never rendered. Silence is not success.
      relations: [
        { axis: "who", label: "github:litlfred", href: "https://example.invalid/u" },
        { axis: "PR", label: "#314", href: "https://example.invalid/pr/314" },
        { axis: "bean", label: "unresolvable-bean" },
      ],
      // Attached to the section above, so the per-block badge and its inline
      // list are ON SCREEN when axe looks. A surface the run never renders is
      // a green that means nothing.
      targetLabel: "sec:a11y-one",
      editHref: "https://example.invalid/edit/main/todos/items/a.md",
    },
    {
      id: "b", summary: "Decide the other thing", comment: "More detail.",
      status: "blocked", priority: "critical", origin: "human", createdAt: "2026-09-19",
      tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
      editHref: "https://example.invalid/edit/main/todos/items/b.md",
    },
  ];

  const ROOT2 = join(HARNESS_ROOT);
  const HARNESS = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Sticky todo harness</title>
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${readFileSync(overlayPath(join(ROOT2, siteFileFor(ROOT2, "assets/css/docs-ui.css"))), "utf8")}</style></head><body>
<div class="side-bar"><div class="site-header"><a class="site-title">Site</a></div><nav class="site-nav"></nav></div>
<div class="main-content-wrap"><div class="main-content" id="main-content"><h1>Harness</h1>
<h2 id="s" data-fa-label="sec:a11y-one">A section</h2><p>Body.</p></div></div>
<script>${readFileSync(overlayPath(join(ROOT2, siteFileFor(ROOT2, "assets/js/docs-ui.js"))), "utf8")}</script></body></html>`;

  for (const colorScheme of ["light", "dark"] as const) {
    for (const [name, viewport] of [
      ["desktop", { width: 1280, height: 860 }],
      ["phone", { width: 390, height: 780 }],
    ] as const) {
      test(`no WCAG A/AA violations — ${colorScheme}, ${name}`, async ({ browser }) => {
        const ctx = await browser.newContext({ colorScheme, viewport });
        const page = await ctx.newPage();
        await page.route("http://todo.a11y/**", (route) => {
          const url = route.request().url();
          if (url.endsWith("/page.html")) {
            return route.fulfill({ contentType: "text/html", body: HARNESS });
          }
          if (url.endsWith("/assets/todos/index.json")) {
            return route.fulfill({
              contentType: "application/json",
              body: JSON.stringify({ items: STICKY_ITEMS }),
            });
          }
          return route.fulfill({ status: 404, body: "not found" });
        });
        await page.goto("http://todo.a11y/page.html");
        await page.locator(".fa-tiles-toggle").click();
        await page.locator(".fa-tile", { hasText: "Todos" }).click();
        // Expand one body and pin one sticky, so every surface this PR adds is
        // actually on screen when axe looks at it.
        // Open the per-block badge first, so its inline sticky renders too.
        await page.locator(".fa-sticky-badge").first().click();
        // Since #1925 a board slot is its closed tile with one icon row
        // under it, and the full card opens in a window: open one, expand
        // its body, and pin the sticky to the folio glass from the row.
        await page.locator('.fa-sticky-slot[data-fa-home-slot="a"] .fa-sticky-tile').click();
        await page.locator('.fa-board-window[data-fa-window="a"] .fa-sticky-toggle').click();
        await page.locator('.fa-sticky-slot[data-fa-home-slot="a"] .fa-sticky-act-pin').click();

        const { violations } = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();
        expect(violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);

        // And the two new surfaces: the confirmation before fsh-guts, and the
        // pinned sticky as a card on the pulled-down folio glass.
        await page.locator('.fa-sticky-slot[data-fa-home-slot="b"] .fa-sticky-act-discard').click();
        await expect(page.locator("dialog.fa-fsh-confirm")).toBeVisible();
        const confirm = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();
        expect(confirm.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
        await page.locator("dialog.fa-fsh-confirm .fa-fsh-confirm-cancel").click();
        await page.reload();
        await page.locator(".fa-glass-handle").click();
        await expect(page.locator('.fa-glass-asset[data-fa-asset="todo/a"]')).toBeVisible();
        const glass = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();
        expect(glass.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
        await ctx.close();
      });
    }
  }
});

/* ── The per-node edit link ─────────────────────────────────────────────── */

/**
 * `.fa-node-edit` is on EVERY node of the site, and it failed contrast.
 *
 * Bean `y8cm`. Measured 2026-09-19: **2.22:1** in light, from `opacity: 0.35`
 * compositing the link colour toward the white behind it. In dark the same
 * declaration moves the colour AWAY from the background and measured clean —
 * so the fix is light-only, and this checks BOTH so the next person to
 * "simplify" the two mechanisms into one finds out here.
 *
 * Driven by `data-fa-scheme` on `<html>`, which is what the page's own JS
 * sets. An earlier probe used Playwright's `colorScheme` and loaded no JS, so
 * both its runs silently measured light and reported dark as unknown — a
 * harness that does not reproduce the mechanism under test measures nothing.
 */
test.describe("the per-node edit link", () => {
  const EDIT_CSS = readFileSync(
    overlayPath(join(REPO_A11Y, siteFileFor(REPO_A11Y, "assets/css/docs-ui.css"))),
    "utf8",
  );
  const page_ = (scheme: string) => `<!doctype html><html lang="en" data-fa-scheme="${scheme}">
<head><meta charset="utf-8"><title>Edit link harness</title><style>${EDIT_CSS}</style>
<style>:root[data-fa-scheme="dark"] body { background:#27262b; color:#f4f4f6; }
:root[data-fa-scheme="light"] body { background:#fff; color:#27262b; }</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
<h2 id="n">A node</h2>
<p><a class="fa-node-edit" href="https://example.invalid/e" title="Edit">&#9998; Edit</a></p>
<p>Body text.</p></div></div></body></html>`;

  for (const scheme of ["light", "dark"] as const) {
    test(`no contrast violation — ${scheme}`, async ({ page }) => {
      await page.route("http://edit.a11y/**", (route) =>
        route.fulfill({ contentType: "text/html", body: page_(scheme) }),
      );
      await page.goto("http://edit.a11y/page.html");
      const { violations } = await new AxeBuilder({ page }).withTags([...TAGS]).analyze();
      expect(violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
    });
  }
});
