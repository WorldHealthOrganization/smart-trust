import { test, expect } from "@playwright/test";

/**
 * End-to-end tests for WHO-IRIS static catalogue search and faceted filtering.
 *
 * Verifies the client-side KG metadata search on who-iris/site/index.html and
 * the IRIS-style dynamic faceted search page on who-iris/site/search.html (who-iris#197):
 * 1. Landing page search bar & instant typing preview with highlighting (<mark>)
 * 2. Dedicated search page (`search.html`) with dynamic facets computed from Dublin Core records
 * 3. Facet selection (Subject MeSH, Has files, Date issued year range) & applied filter chips
 * 4. Verification that search operates purely on structured KG metadata and not raw text blobs
 * 5. Multi-lingual availability on translated replicas (e.g. /fr/index.html and /fr/search.html)
 */

/**
 * A MeSH facet value, as a reader reaches it: the facet shows its top values
 * first, so one further down is reached with "Show more". Which values make the
 * top depends on the catalogue, which grows (MeSH indexing added subjects
 * that now outrank "Guidelines as Topic"), so the test does not rely on it.
 */
async function meshFacetLink(page: import("@playwright/test").Page, label: string) {
  const link = page.locator('#is-facets a[data-facet="mesh"]').filter({ hasText: label }).first();
  for (let i = 0; i < 50 && !(await link.isVisible()); i++) {
    const more = page.locator('#is-facets button[data-more="mesh"]');
    if (!(await more.isVisible())) break;
    await more.click();
  }
  return link;
}

test.describe("WHO-IRIS search & faceted exploration", () => {
  test("landing page renders search bar forwarding to search.html, and search.html renders dynamic facets", async ({ page }) => {
    const res = await page.goto("/who-iris/site/index.html");
    expect(res?.status()).toBe(200);

    const searchForm = page.locator("#iris-search-form");
    await expect(searchForm).toHaveAttribute("action", "search.html");

    const searchInput = page.locator("#iris-search-input");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("name", "query");

    // Navigate to the IRIS-style search page (who-iris#197)
    const searchRes = await page.goto("/who-iris/site/search.html");
    expect(searchRes?.status()).toBe(200);

    await expect(page.locator("#iris-search-input")).toBeVisible();
    await expect(page.locator("#is-facets")).toBeVisible();
    await expect(page.locator("#is-sort")).toBeVisible();
    await expect(page.locator("#is-rpp")).toBeVisible();

    const facets = page.locator("#is-facets details.is-facet");
    expect(await facets.count()).toBeGreaterThanOrEqual(4);
  });

  test("instant keyword search highlights matching terms and displays results panel", async ({ page }) => {
    await page.goto("/who-iris/site/index.html");

    const input = page.locator("#iris-search-input");
    const results = page.locator("#iris-search-results");

    // Initially results panel is hidden
    await expect(results).toBeHidden();

    // Type query
    await input.fill("handbook");
    await expect(results).toBeVisible();

    // Contains result item link (links to its library entry since who-iris#94)
    const itemLink = results.locator('a[href*="9789241548960-eng"]');
    await expect(itemLink).toBeVisible();
    await expect(itemLink).toContainText("WHO handbook for guideline development");

    // Highlighting verified
    const mark = itemLink.locator("mark.search-mark");
    await expect(mark).toHaveText("handbook");
  });

  test("clicking a dynamic subject facet on search.html filters results and renders an applied filter chip", async ({ page }) => {
    await page.goto("/who-iris/site/search.html");

    const facetLink = await meshFacetLink(page, "Guidelines as Topic");
    await expect(facetLink).toBeVisible();
    await facetLink.click();

    // Applied filter chip and reset link appear
    const chips = page.locator("#is-chips .is-chip");
    expect(await chips.count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator("#is-chips")).toContainText("Guidelines as Topic");

    // Guideline items tagged with "Guidelines as Topic" should match
    const cards = page.locator("#is-results .is-card");
    expect(await cards.count()).toBeGreaterThanOrEqual(2);

    const textContent = await page.locator("#is-results").textContent();
    expect(textContent).toContain("Publication and information products style guide");
    expect(textContent).toContain("WHO handbook for guideline development");
  });

  test("complex faceted filtering on search.html combines query, subject facet, and date issued range", async ({ page }) => {
    await page.goto("/who-iris/site/search.html");

    // Apply MeSH facet "Guidelines as Topic"
    const meshLink = await meshFacetLink(page, "Guidelines as Topic");
    await meshLink.click();
    expect(await page.locator("#is-results .is-card").count()).toBeGreaterThanOrEqual(2);

    // Narrow by Date issued year range to 2014..2014 (WHO handbook for guideline development, 2nd ed. is 2014)
    const rangeForm = page.locator("#is-facets form.is-range");
    await rangeForm.locator('input[name="min"]').fill("2014");
    await rangeForm.locator('input[name="max"]').fill("2014");
    await rangeForm.locator('button[type="submit"]').click();

    const cards = page.locator("#is-results .is-card");
    expect(await cards.count()).toBe(1);
    await expect(page.locator("#is-results")).toContainText("WHO handbook for guideline development");

    // Reset all filters -> full item list returns
    await page.locator("#is-chips a.is-reset").click();
    expect(await page.locator("#is-results .is-card").count()).toBeGreaterThanOrEqual(3);
  });

  test("search index payload operates purely on structured KG metadata without full text blobs", async ({ page }) => {
    await page.goto("/who-iris/site/index.html");

    // Evaluate client-side index items directly from window.__irisSearch.
    // The home page fetches its records on first use (who-iris 81026d6a5:
    // `home-search.json`, read on the box's first focus), so `index` is empty
    // until `load()` resolves — load it first, or every check below is vacuous.
    const indexData = await page.evaluate(async () => {
      const g = window as unknown as { __irisSearch?: { index: unknown[]; load?: () => Promise<void> } };
      if (!g.__irisSearch) return null;
      if (typeof g.__irisSearch.load === "function") await g.__irisSearch.load();
      return g.__irisSearch.index;
    });

    expect(Array.isArray(indexData)).toBe(true);
    expect((indexData as unknown[]).length).toBeGreaterThan(0);
    for (const item of indexData as Array<Record<string, unknown>>) {
      // Must contain structured KG metadata
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("badge");

      // Verify no binary blobs or excessive OCR full text payloads
      const textLen = typeof item.text === "string" ? item.text.length : 0;
      expect(textLen).toBeLessThan(5000); // Concatenated DC metadata + abstract strings are concise (< 5 KB)

      // Items have structured access control metadata; copyrightGate is emitted when the bitstream records a copyright gate verdict
      if (item.badge === "Item") {
        expect(item).toHaveProperty("subjects");
        expect(item).toHaveProperty("hasPdf");
        if ("copyrightGate" in item) {
          expect(["permitted", "refused", "unknown"]).toContain(item.copyrightGate);
        }
      }
    }
    const items = (indexData as Array<Record<string, unknown>>).filter((it) => it.badge === "Item");
    expect(items.some((it) => it.copyrightGate === "permitted")).toBe(true);
  });

  test("multilingual search interface is translated and functional on locale pages", async ({ page }) => {
    const res = await page.goto("/who-iris/site/fr/index.html");
    expect(res?.status()).toBe(200);

    const searchInput = page.locator("#iris-search-input");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("placeholder", /Rechercher parmi les .* documents du dépôt/);

    const searchRes = await page.goto("/who-iris/site/fr/search.html");
    expect(searchRes?.status()).toBe(200);
    await expect(page.locator("#is-filters-h")).toBeVisible();
    expect(await page.locator("#is-facets details.is-facet").count()).toBeGreaterThanOrEqual(4);
  });
});

