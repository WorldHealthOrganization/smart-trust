import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { join } from "node:path";

import { siteDirFor } from "../schemas/kg/cat-harness.ts";
import { serveThemed, type Scheme } from "./support/themed-page.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { declaredPageUrl } from "./support/site-pages.ts";

/**
 * Every library entry has its own IRI, and the page there renders it.
 *
 * Owner, 2026-10-02 (#1881), having tried
 * `/cat-harness/library/smart-base/smart-trust` and found a 404: *"each
 * link/page needs to be materialized on the CDN (gh-pagees), just load the
 * content from the KG json(ld) assets already published"*, and *"no query
 * strings... each asset gets its own IRI"*.
 *
 * So the page at `<library>/<instance>/<id>/` is a real committed file — a thin
 * shell with no entry content in it — and this asserts, in a browser, that the
 * shell loads the entry from the published projection and selects it. A grep of
 * the committed HTML cannot: the shell holds the entry's id and nothing else,
 * whether it works or not (`library-viewer-scope.e2e.ts` carries that lesson).
 *
 * Served from the repository root by `test-server.mjs`, like every e2e here;
 * the shell's paths are relative, so they resolve under this prefix exactly as
 * they do on the published site. The shell is a THEMED page since 2026-10-07,
 * so its body is served in a stand-in for the layout (`support/themed-page.ts`)
 * at the same path; its assets and data still come off the server.
 */
const SITE = process.env.FA_SITE_URL ?? "http://127.0.0.1:8080";
const DOCS = "/cat-harness/docs";
const HARNESS = join(HARNESS_ROOT);
const LIB = declaredPageUrl(HARNESS, "library").replace(/\/$/, "");

/** Serve the committed themed pages under the docs prefix in the layout stand-in. */
async function themed(page: Page, scheme: Scheme = "dark"): Promise<void> {
  await serveThemed(page, { fsRoot: join(HARNESS, siteDirFor(HARNESS)), urlPrefix: `${DOCS}/`, scheme });
}

function listen(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  return errors;
}

test("the smart-trust entry's own IRI renders it from the published data", async ({ page }) => {
  const errors = listen(page);
  await themed(page);
  const res = await page.goto(`${SITE}${LIB}/smart-base/smart-trust/`, { waitUntil: "networkidle" });
  expect(res?.status(), "the entry IRI must be a materialized page").toBe(200);

  const row = page.locator('[data-fa-library-item="smart-base/smart-trust"]');
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-fa-anchored", "1");
  // Content the shell does NOT carry, so it came from the projection.
  await expect(row).toContainText("WHO SMART Trust");
  await expect(row.locator('a[href="http://smart.who.int/trust"]')).toHaveCount(1);
  // The artefact index: this site's /smart-trust/ (the title also ends in
  // /smart-trust/, but under the library route).
  await expect(row.locator('a.src[href$="/smart-trust/"]', { hasText: "artefact index" })).toHaveCount(1);
  // The SLUG opens the entry's visualiser — smart-trust's own IG viewer at the
  // site root's /smart-trust/ — from the projection's generated `view`.
  await expect(row.locator("a.lib-view")).toHaveAttribute("href", "/cat-harness/docs/smart-trust/");
  // The TITLE opens the entry's own page, not a README the entry may not have.
  await expect(row.locator("a.lib-title")).toHaveAttribute("href", `${LIB}/smart-base/smart-trust/`);
  // The row's own address is the path IRI — never a fragment or a query.
  const href = await row.getAttribute("data-fa-library-href");
  expect(href).toBe(`${LIB}/smart-base/smart-trust/`);
  await expect(page).toHaveTitle(/WHO SMART Trust/);
  // The JSON-LD it names as its alternate is published.
  const alt = await page.locator('link[rel="alternate"][type="application/ld+json"]').getAttribute("href");
  const ld = await page.request.get(new URL(alt!, page.url()).href);
  expect(ld.status()).toBe(200);
  const asset = (await ld.json()) as { title?: string; "@id"?: string };
  expect(asset.title).toBe("WHO SMART Trust");
  // The ASSET's IRI is extensionless (…/source/<id>); its JSON-LD is at <IRI>.jsonld — a different resource
  // from this page, which only renders it (owner, 2026-10-02).
  expect(asset["@id"]).toBe(
    "https://litlfred.github.io/folio-assistant/assets/library/jsonld/smart-base/source/smart-trust",
  );
  expect(errors).toEqual([]);
});

test("an old #key link is normalised ONCE to the path IRI", async ({ page }) => {
  const errors = listen(page);
  await themed(page);
  await page.goto(`${SITE}${LIB}/smart-base/#${encodeURIComponent("smart-base/smart-trust")}`, { waitUntil: "networkidle" });
  expect(new URL(page.url()).pathname).toBe(`${LIB}/smart-base/smart-trust/`);
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.locator('[data-fa-library-item="smart-base/smart-trust"]')).toHaveAttribute("data-fa-anchored", "1");
  expect(errors).toEqual([]);
});

test("a shell whose entry the data does not hold says so, with a way back", async ({ page }) => {
  // The projection is served WITHOUT the entry: the shell is there and the
  // data is not, which is the case a reader would otherwise see as a blank
  // table that looks like it worked.
  await page.route("**/assets/library/index.json", async (route) => {
    const r = await route.fetch();
    const g = (await r.json()) as { entries: { instance: string; id: string }[] };
    g.entries = g.entries.filter((e) => !(e.instance === "smart-base" && e.id === "smart-trust"));
    await route.fulfill({ response: r, json: g });
  });
  await themed(page);
  await page.goto(`${SITE}${LIB}/smart-base/smart-trust/`, { waitUntil: "networkidle" });
  const status = page.locator('#status[data-fa-not-found="1"]');
  await expect(status).toContainText("No entry at this address");
  await expect(status.locator("a")).toHaveAttribute("href", `${LIB}/smart-base/`);
});

for (const scheme of ["dark", "light"] as const) {
  test(`an entry page on the ${scheme} ground has no WCAG A/AA violations`, async ({ page }) => {
    // The page's colours are its own (viewer.css, keyed on data-fa-scheme),
    // so both grounds the theme paints are checked, with the entry selected
    // and its document and blocks panels drawn.
    await themed(page, scheme);
    await page.goto(`${SITE}${LIB}/smart-base/smart-trust/`, { waitUntil: "networkidle" });
    await expect(page.locator('[data-fa-library-item="smart-base/smart-trust"]')).toHaveAttribute("data-fa-anchored", "1");
    const { violations } = await new AxeBuilder({ page })
      .include(".lib-page")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map((v) => `${v.id} [${v.impact}] ×${v.nodes.length} — ${v.help}: ` +
        v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")} (${n.failureSummary ?? ""})`).join("; ")),
    ).toEqual([]);
  });
}
