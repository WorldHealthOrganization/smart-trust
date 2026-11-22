import { test, expect, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { siteDirFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { publishedPagePath } from "../../scripts/lib/jekyll-permalink.ts";
import { pageKey } from "../../pipeline/translation-index.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * The left-hand navbar shows the SELECTED locale, and nothing else.
 *
 * Reported by the owner, 2026-09-19:
 *
 *   "i have english selected, but i see the translated pages in LHS navbar.
 *    the fr/ ru/ etc. sub-dirs need to be explicitly labeled as translated
 *    content in the graph and not shown in navbar unless that locale is
 *    selected. (if not present, fall back to source language)"
 *
 * ## Why this is a harness page rather than the built site
 *
 * `_config.yml` uses `remote_theme: just-the-docs/just-the-docs`, UNPINNED and
 * fetched at build time, and the site cannot be built here. The same
 * limitation `docs-ui.js`'s own header states applies: these tests cover the
 * behaviour against the markup just-the-docs emits, reproduced here, and NOT
 * the integration with whatever that theme emits next month.
 *
 * What is NOT reproduced is the half of the fix that is not JavaScript:
 * `nav_exclude: true` keeps the translated pages out of the static nav in the
 * first place. That is Jekyll's to honour and is checked in the unit tests
 * instead (`pipeline/translation-index.test.ts`), which walk for pages
 * declaring a non-source `lang` and fail if any has stopped carrying it. A
 * harness that hand-writes the nav, as this one does, could "verify" that rule
 * by simply not putting the French item in — so it does not try.
 *
 * ## Geometry, not textContent
 *
 * `textContent` is DOM order and says nothing about what is on screen: an
 * element hidden by CSS still reports its text. Every visibility assertion
 * below is `toBeVisible()` or a `boundingBox()`, and every absence assertion
 * names the item it expects gone rather than counting what is left.
 */

const ROOT = join(HARNESS_ROOT);
const SITE = siteDirFor(ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");
const QR = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js"))), "utf8");

/**
 * The fixture is DERIVED FROM THE CORPUS, not copied out of it.
 *
 * `docs/_data/translations.json` is a live verdict about the tree: it changes
 * the moment somebody adds a locale or a translated page. Pinning today's
 * contents here would make this a test of what the corpus said on the day it
 * was written — the trap AGENTS.md calls out — so the two source pages the
 * assertions name are looked up in the real index at test time, and the test
 * says so out loud if either has gone.
 */
const INDEX = JSON.parse(
  readFileSync(overlayPath(join(ROOT, SITE, "_data/translations.json")), "utf8"),
) as {
  sourceLocale: string;
  locales: string[];
  pages: Record<
    string,
    {
      sourceUrl: string;
      sourceTitle: string;
      translations: Record<string, { url: string; title: string; dir: string; status: string }>;
    }
  >;
};

/**
 * A source page (site-relative, no extension) as the index keys it: by where
 * Jekyll PUBLISHES it, which since bean `kc7k` is not where its source sits
 * for the docs-folder pages (`guides/x` → `docs/cat-harness/guides/x`). The
 * same rule the generator reads, so this cannot key a page differently.
 */
function publishedKey(source: string): { key: string; url: string } {
  const url = `/${publishedPagePath(join(ROOT, SITE), source)}`;
  return { key: pageKey(url), url };
}

/** The home page's entry, by the key the generator computes for `/`. */
const HOME = INDEX.pages[""];
/** A page nested under a parent, so the swap is exercised below a `has_children`. */
const GUIDE = INDEX.pages[publishedKey("guides/agent-onboarding").key];

/**
 * A nav item with no translation in ANY locale — the fallback case.
 *
 * **This fixture was `getting-started`, and it did exactly what its own
 * docblock promised.** That note read: *"a real page of this site that has
 * never been translated. If it ever is, this test starts failing loudly rather
 * than silently verifying nothing, which is the correct direction to fail in."*
 * On 2026-09-26 bean `t8g3` translated it into six languages and the test
 * failed. The design was right; only the fixture had expired.
 *
 * ## What the illegible failure cost — TWO sessions, independently
 *
 * The failure surfaced as `element(s) not found` on a locator, which says
 * nothing about why. A sibling session paid *"three environments and a bisect
 * against `origin/main`"* to learn the page had simply been translated; this
 * one paid a full local e2e run and a comparison against main's latest CI.
 * Two people paying the same toll for the same missing sentence is the
 * argument for the assertion in the test below, not the docblock's word for
 * it — **main's copy of this file promises that sentence and its test body
 * does not contain one**, which is how a fix gets believed and not made.
 *
 * ## Derived, not named
 *
 * `HOME` and `GUIDE` above are looked up in the real index; this was the one
 * of the three still named by hand, which is why it is the one that rotted.
 * Two cases:
 *
 * 1. An indexed page carrying no translations. Preferred, because it is a page
 *    the generator has actually seen, and it self-heals: the moment such a page
 *    exists this stops depending on any name at all.
 * 2. When **every** indexed page is translated — true since `t8g3`, all seven
 *    of them — no such entry exists. The index only records pages that HAVE
 *    translations, so "untranslated" then means *absent from the index*, and
 *    the fixture is a real page of this site the index does not list.
 *
 * ## Case 2 is DERIVED now too, because naming it expired twice
 *
 * `architecture` was the hand-picked case-2 fixture, chosen over
 * `agentic-harness` on the reasoning that main's copy wins a merge. Bean `t8g3`
 * then translated **both** — batch 4 on 2026-09-26 — so the name rotted inside
 * the same day, for the third time in this fixture's life and the second for the
 * same reason. A fallback that has to be re-chosen every time the corpus grows
 * is not a fallback; it is a scheduled failure with a comment on it.
 *
 * So case 2 scans the site directory for a real page the index does not list:
 * top-level, carrying a `title:`, not `nav_exclude: true`, first in sorted order
 * so two runs agree. `index.md` is excluded because it IS indexed, under the
 * empty key, and only its filename says otherwise.
 *
 * And it THROWS rather than falling back when the corpus has no such page. That
 * state is real news — every page of the site translated — and it must not reach
 * the browser half as a locator that mysteriously misses, which is precisely the
 * illegible failure the two sessions above each paid for once.
 */
const UNTRANSLATED = ((): { key: string; url: string; title: string } => {
  const indexed = Object.entries(INDEX.pages).find(
    ([, v]) => Object.keys(v.translations ?? {}).length === 0,
  );
  if (indexed !== undefined) {
    const [key, v] = indexed;
    return { key, url: v.sourceUrl, title: v.sourceTitle };
  }
  // Case 2. A real page of this site the index does not list — derived, so the
  // next translation batch cannot expire it.
  const dir = join(ROOT, SITE);
  // The top level AND the docs graph's named groups (bean `xka5`): since the
  // root pages moved into `start/`, `concepts/`, `guides/`, `process/` and
  // `fhir/`, the top level holds almost nothing a reader navigates to. The
  // groups are READ from `docs.json` (typology `doc-group`), not listed here,
  // so a new group is scanned without anyone editing this test.
  const groups = (JSON.parse(readFileSync(join(dir, "docs.json"), "utf8")).directories as
    { path: string; graphTypologies?: string[] }[])
    .filter((d) => (d.graphTypologies ?? []).includes("doc-group"))
    .map((d) => d.path.replace(/\/+$/, ""));
  const candidates = [
    ...readdirSync(dir).filter((f) => f.endsWith(".md")),
    ...groups.flatMap((g) => readdirSync(join(dir, g)).filter((f) => f.endsWith(".md")).map((f) => `${g}/${f}`)),
  ].sort();
  for (const f of candidates) {
    if (!f.endsWith(".md") || f === "index.md" || f.endsWith("/index.md")) continue;
    const { key, url } = publishedKey(f.slice(0, -3));
    if (key in INDEX.pages) continue;
    const head = readFileSync(join(dir, f), "utf8").slice(0, 2000);
    if (/^nav_exclude:\s*true\s*$/m.test(head)) continue;
    // There was a fourth filter here, and it is GONE rather than forgotten.
    //
    // It skipped any candidate claiming a non-source locale, because
    // `crdm-methodology` was absent from the index while declaring
    // `available_locales: ["en","fr"]` with no `docs/fr/crdm-methodology.md`
    // behind it — the one candidate that asserted the very thing this fixture
    // stands for the absence of. Its comment gave the general reason too: the
    // index is the authority, but a page contradicting it is the wrong page to
    // reason from, whichever of the two is wrong.
    //
    // That reason is DISCHARGED, not waived. #1431 fixed the page — the
    // generator now derives `available_locales` from the rendered corpus rather
    // than from `existsSync` on a `.po` — and, more to the point here, added
    // `check:available-locales`, which fails CI for ANY page claiming a locale
    // the index does not back. So the contradiction this filter hand-checked on
    // one page is now impossible corpus-wide, and if it ever recurs the gate
    // fails before this test runs.
    //
    // Keeping the skip would have been the worse outcome: a workaround whose
    // cause is gone still narrows what the fixture covers, and reads to the next
    // author as a rule about locales rather than as scar tissue. Bean `9x01`
    // box 68.
    const title = /^title:\s*(.+)$/m.exec(head)?.[1].trim().replace(/^["']|["']$/g, "");
    if (title === undefined || title === "") continue;
    return { key, url, title };
  }
  throw new Error(
    "no untranslated page left in the corpus: every indexed page has translations AND every " +
      "top-level page is indexed. That is news about the site, not a broken test — the " +
      "no-translation fallback now has nothing to stand for, so decide what this test should " +
      "assert instead rather than re-pointing a fixture.",
  );
})();

/** just-the-docs' nav markup, reduced to what the filter touches. */
function harness(indexIsland: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  body { margin: 0; }
  .side-bar { position: fixed; top: 0; left: 0; width: 16.5rem; height: 100%;
              display: flex; flex-flow: column nowrap; align-items: flex-end;
              background: #27262b; color: #fff; }
  .site-header { width: 100%; max-height: 3.75rem; overflow: hidden; display: flex; align-items: center; }
  .site-title { flex: 1; }
  .site-nav { width: 100%; overflow-y: auto; }
  .nav-list { list-style: none; margin: 0; padding: 0; }
  .nav-list-link { display: block; padding: 4px 8px; color: #fff; }
  ${CSS}
</style>
<script type="application/json" id="fa-translation-meta">{"lang":"en","supportedLocales":["ar","zh","en","fr","ru","es"],"availableLocales":[]}</script>
${indexIsland}
</head><body>
  <div class="side-bar">
    <div class="site-header"><a class="site-title">folio-assistant</a></div>
    <nav class="site-nav" aria-label="Main">
      <ul class="nav-list">
        <li class="nav-list-item"><a href="${HOME.sourceUrl}" class="nav-list-link">${HOME.sourceTitle}</a></li>
        <li class="nav-list-item"><a href="${UNTRANSLATED.url}" class="nav-list-link">${UNTRANSLATED.title}</a></li>
        <li class="nav-list-item">
          <a href="/guides/" class="nav-list-link">Authoring guides</a>
          <ul class="nav-list">
            <li class="nav-list-item"><a href="${GUIDE.sourceUrl}" class="nav-list-link">${GUIDE.sourceTitle}</a></li>
          </ul>
        </li>
      </ul>
    </nav>
  </div>
  <div class="main"><div class="main-content"><h1>x</h1></div></div>
  <script>${QR}<\/script>
  <script>${JS}<\/script>
</body></html>`;
}

const ISLAND = `<script type="application/json" id="fa-translation-index">${JSON.stringify({
  baseurl: "",
  index: INDEX,
})}</script>`;

/** Load the harness with a locale already remembered, as the sidebar bar stores it. */
async function open(page: Page, island: string, locale: string | null): Promise<void> {
  await page.addInitScript((loc) => {
    try {
      if (loc === null) localStorage.removeItem("fa-locale");
      else localStorage.setItem("fa-locale", loc as string);
    } catch { /* a browser with storage blocked still gets the source language */ }
  }, locale);
  // A REAL origin first, then the harness markup into it.
  //
  // `setContent` alone leaves the page at `about:blank`, where `localStorage`
  // throws and `new URL("/", location.href)` has no base to resolve against —
  // so every href would be skipped and all of these tests would pass by doing
  // nothing at all. `test-server.mjs` (playwright.config.ts) is already
  // serving the repo root; any real origin will do.
  await page.goto("/");
  await page.setContent(harness(island));
}

const nav = ".site-nav";

test.describe("the navbar shows the selected locale", () => {
  test.beforeAll(() => {
    // The fixture is derived, so say plainly when the derivation came up empty
    // rather than asserting against `undefined` three tests later.
    expect(HOME, "docs/_data/translations.json has no entry for the home page").toBeTruthy();
    expect(GUIDE, "no entry for guides/agent-onboarding").toBeTruthy();
    expect(Object.keys(HOME.translations), "the home page has no translations at all").toContain("fr");
  });

  test("English selected: no translated page is in the navbar", async ({ page }) => {
    await open(page, ISLAND, "en");
    await expect(page.locator(nav)).toHaveAttribute("data-fa-nav-locale", "en");

    // The reported bug, asserted by NAME in both directions: the English item
    // is on screen, and every locale's title for the same page is nowhere.
    const home = page.locator(`${nav} a`, { hasText: HOME.sourceTitle }).first();
    await expect(home).toBeVisible();
    expect((await home.boundingBox())!.height).toBeGreaterThan(0);
    await expect(home).toHaveAttribute("href", HOME.sourceUrl);

    for (const [loc, t] of Object.entries(HOME.translations)) {
      await expect(
        page.locator(`${nav} a[href="${t.url}"]`),
        `${loc} home page is in the navbar with English selected`,
      ).toHaveCount(0);
    }
    for (const [loc, t] of Object.entries(GUIDE.translations)) {
      await expect(
        page.locator(`${nav} a[href="${t.url}"]`),
        `${loc} guide is in the navbar with English selected`,
      ).toHaveCount(0);
    }
  });

  test("French selected: the French page replaces the English one, in place", async ({ page }) => {
    const fr = HOME.translations.fr;
    await open(page, ISLAND, "fr");
    await expect(page.locator(nav)).toHaveAttribute("data-fa-nav-locale", "fr");

    const link = page.locator(`${nav} a[href="${fr.url}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveText(fr.title);
    await expect(link).toHaveAttribute("lang", "fr");

    // IN PLACE OF, not in addition to. The English target is gone, and the
    // item is still the FIRST nav link — same position, not appended.
    await expect(
      page.locator(`${nav} a[href="${HOME.sourceUrl}"]`),
      "the English home item survived alongside the French one",
    ).toHaveCount(0);
    await expect(page.locator(`${nav} a`).first()).toHaveAttribute("href", fr.url);
  });

  test("French selected: a nested item under a parent is swapped too", async ({ page }) => {
    const fr = GUIDE.translations.fr;
    await open(page, ISLAND, "fr");
    const link = page.locator(`${nav} .nav-list .nav-list a[href="${fr.url}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveText(fr.title);
    // Still nested under its parent rather than promoted to the top level.
    await expect(page.locator(`${nav} a`, { hasText: "Authoring guides" })).toBeVisible();
  });

  test("Arabic selected: the item carries its own dir, not the page's", async ({ page }) => {
    const ar = HOME.translations.ar;
    test.skip(!ar, "no Arabic translation of the home page in the corpus");
    await open(page, ISLAND, "ar");
    const link = page.locator(`${nav} a[href="${ar.url}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("dir", "rtl");
    // Visible means laid out, not merely present: an RTL item inside an LTR
    // column is exactly where a text-only assertion would pass on a box that
    // had collapsed to nothing.
    const box = (await link.boundingBox())!;
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test("...and the premise of that fixture still holds — it really is untranslated", () => {
    // Asserted, not assumed. Without this the fallback test below fails with
    // `element(s) not found`, which is true and tells you nothing: the locator
    // misses because the JS correctly rewrote the href to a localised URL.
    // This says what actually happened, so the fix is one line rather than a
    // bisect. See UNTRANSLATED's docblock — the tripwire has fired once.
    expect(
      Object.keys(INDEX.pages),
      `\`${UNTRANSLATED.key}\` now HAS a translation, so it can no longer stand for the ` +
        `no-translation case. That is good news about the site and a two-line fix here: ` +
        `re-point UNTRANSLATED at a page still absent from _data/translations.json.`,
    ).not.toContain(UNTRANSLATED.key);
  });

  test("a page with no translation falls back to the source language", async ({ page }) => {
    // THE PREMISE, asserted rather than assumed. When this fixture acquired
    // translations on 2026-09-26 the test failed as a 10-second locator
    // timeout on a link that was correctly absent — a true failure wearing the
    // costume of a broken selector. One sentence is cheaper than that triage.
    expect(
      Object.keys(INDEX.pages[UNTRANSLATED.key]?.translations ?? {}),
      `this test needs a page with NO translation, and \`${UNTRANSLATED.key}\` now has some. ` +
        "Pick another untranslated page — the derivation above prefers an indexed one.",
    ).toEqual([]);
    await open(page, ISLAND, "fr");
    const link = page.locator(`${nav} a[href="${UNTRANSLATED.url}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveText(UNTRANSLATED.title);
    // Recorded as a deliberate fallback rather than as something overlooked.
    await expect(link).toHaveAttribute("data-fa-translated", "source");
    // MARKED as the source language (owner, 2026-09-27), so the mix reads as
    // a fallback: "(EN)" after the title, and `lang` for a screen reader.
    await expect(link).toHaveAttribute("lang", INDEX.sourceLocale);
    const tag = await link.evaluate((a) => getComputedStyle(a, "::after").content);
    expect(tag).toBe(`" (${INDEX.sourceLocale.toUpperCase()})"`);
    // And the fallback is per ITEM: the translated items beside it still are.
    await expect(page.locator(`${nav} a[href="${HOME.translations.fr.url}"]`)).toHaveAttribute(
      "data-fa-translated",
      "fr",
    );
  });

  test("no index published: the navbar is left exactly as built", async ({ page }) => {
    // The third state. "Could not determine the translation set" must NEVER
    // render as "this folio has no translations" -- and must not silently
    // rewrite anything either.
    await open(page, "", "fr");
    await expect(page.locator(nav)).toHaveAttribute("data-fa-nav-index", "unknown");
    await expect(page.locator(nav)).not.toHaveAttribute("data-fa-nav-locale", /.*/);
    const home = page.locator(`${nav} a[href="${HOME.sourceUrl}"]`);
    await expect(home).toBeVisible();
    await expect(home).toHaveText(HOME.sourceTitle);
  });

  test("index published but null: also unknown, not empty", async ({ page }) => {
    // What `{{ site.data.translations | jsonify }}` emits when the data file
    // was absent at build time. Distinct from an index with no pages.
    const island =
      '<script type="application/json" id="fa-translation-index">{"baseurl":"","index":null}</script>';
    await open(page, island, "fr");
    await expect(page.locator(nav)).toHaveAttribute("data-fa-nav-index", "unknown");
    await expect(page.locator(`${nav} a[href="${HOME.sourceUrl}"]`)).toBeVisible();
  });

  test("an index with no pages is DETERMINED empty, not unknown", async ({ page }) => {
    const island =
      '<script type="application/json" id="fa-translation-index">' +
      JSON.stringify({ baseurl: "", index: { sourceLocale: "en", locales: [], pages: {} } }) +
      "</script>";
    await open(page, island, "fr");
    // Same navbar as the unknown case, deliberately a different answer: this
    // build looked and found nothing, the other could not look.
    await expect(page.locator(nav)).toHaveAttribute("data-fa-nav-index", "empty");
    await expect(page.locator(`${nav} a[href="${HOME.sourceUrl}"]`)).toBeVisible();
  });

  test("a remembered locale the index has never heard of is not honoured", async ({ page }) => {
    await open(page, ISLAND, "tlh");
    // Labelling the nav `tlh` while every item is in English would be a claim
    // the page cannot support.
    await expect(page.locator(nav)).toHaveAttribute("data-fa-nav-locale", INDEX.sourceLocale);
    await expect(page.locator(`${nav} a[href="${HOME.sourceUrl}"]`)).toBeVisible();
  });

  test("English selected: no item carries the source-language tag", async ({ page }) => {
    await open(page, ISLAND, "en");
    await expect(page.locator(`${nav} a[data-fa-source-locale]`)).toHaveCount(0);
  });

  test("nothing remembered: the source language", async ({ page }) => {
    await open(page, ISLAND, null);
    await expect(page.locator(nav)).toHaveAttribute("data-fa-nav-locale", INDEX.sourceLocale);
    await expect(page.locator(`${nav} a[href="${HOME.sourceUrl}"]`)).toBeVisible();
  });
});

/**
 * THE PAGE FOLLOWS THE CHOSEN LANGUAGE — owner, 2026-09-27: *"user selects
 * locale in icon, then only those pages exist (if translated) otherwise source
 * language fallback"*. `followRememberedLocale` in `docs-ui.js`.
 */
test.describe("the page follows the remembered locale", () => {
  const PAGE = (lang: string, available: string[]) => `<!doctype html><html><head><meta charset="utf-8">
<script type="application/json" id="fa-translation-meta">${JSON.stringify({
    lang,
    supportedLocales: ["ar", "zh", "en", "fr", "ru", "es"],
    availableLocales: available,
  })}</script></head><body><h1>${lang}</h1><script>${JS}<\/script></body></html>`;

  async function serve(page: Page, locale: string | null) {
    await page.route("http://docs.test/**", (route) => {
      const u = new URL(route.request().url());
      const fr = u.pathname.startsWith("/fr/");
      const lonely = u.pathname.endsWith("/lonely.html");
      return route.fulfill({
        contentType: "text/html",
        body: PAGE(fr ? "fr" : "en", lonely ? [] : ["en", "fr"]),
      });
    });
    await page.addInitScript((loc) => {
      if (loc === null) localStorage.removeItem("fa-locale");
      else localStorage.setItem("fa-locale", loc as string);
    }, locale);
  }

  test("French remembered: an English page with a French version opens the French one", async ({ page }) => {
    await serve(page, "fr");
    await page.goto("http://docs.test/guide.html#part");
    await page.waitForURL("http://docs.test/fr/guide.html#part");
  });

  test("French remembered: an English page with NO French version stays English", async ({ page }) => {
    await serve(page, "fr");
    await page.goto("http://docs.test/lonely.html");
    await page.waitForTimeout(300);
    expect(page.url()).toBe("http://docs.test/lonely.html");
  });

  test("nothing remembered: a shared French link stays French", async ({ page }) => {
    await serve(page, null);
    await page.goto("http://docs.test/fr/guide.html");
    await page.waitForTimeout(300);
    expect(page.url()).toBe("http://docs.test/fr/guide.html");
  });

  test("English remembered: a French page opens the English one", async ({ page }) => {
    await serve(page, "en");
    await page.goto("http://docs.test/fr/guide.html");
    await page.waitForURL("http://docs.test/guide.html");
  });

  test("?lang= on the URL wins over the remembered choice", async ({ page }) => {
    await serve(page, "fr");
    await page.goto("http://docs.test/guide.html?lang=en");
    await page.waitForTimeout(300);
    expect(page.url()).toBe("http://docs.test/guide.html?lang=en");
  });
});
