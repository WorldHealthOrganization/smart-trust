import { dirname, join } from "node:path";

import { test, expect } from "@playwright/test";

import { siteDirFor } from "../schemas/kg/cat-harness.ts";
import { serveThemed } from "./support/themed-page.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { declaredPageUrl } from "./support/site-pages.ts";

/**
 * A WITHHELD library entry says so in the rendered viewer — issue #1794.
 *
 * Measured before (PR #1799): both of who-iris's withheld entries rendered
 * every row as "(no content carried)", the sentence a page-scan with no text
 * gets. The viewer is client-rendered, so no grep of the committed HTML can
 * see what a reader sees; this opens the page.
 *
 * THE FIXTURE, declared here rather than assumed of a folio (owner ruling
 * 2026-10-09, litlfred/folio-assistant#2521, option b). Until then the
 * withheld entries were read from `who-iris/library/withheld.json`; the owner
 * cleared every who-iris entry on 2026-10-08, that list is empty by design,
 * and the banner went untested. The viewer's own index is now served with ONE
 * who-iris entry withheld — in exactly the shape `library-graph.ts` records
 * (the 2026-10-07 record of who-pub-tps-931, gates and catalogue record) —
 * and every other who-iris entry open, so the committed projection's state,
 * which `library:viz:check` deliberately does not gate, decides nothing here.
 * Real data is still judged where it lives: `iris:pages:check` holds
 * `withheld.json` to the catalogue's gates.
 */
const SITE = process.env.FA_SITE_URL ?? "http://127.0.0.1:8080";
const DOCS = "/cat-harness/docs";
const REPO = join(dirname(HARNESS_ROOT));
const HARNESS = join(REPO, "cat-harness");
/** The page is THEMED (2026-10-07); serve its body in the layout stand-in at its own path. */
const themed = (page: import("@playwright/test").Page): Promise<void> =>
  serveThemed(page, { fsRoot: join(HARNESS, siteDirFor(HARNESS)), urlPrefix: `${DOCS}/` });

const FIXTURE = {
  id: "who-pub-tps-931",
  withheld: 'item/b08c6c19-315a-41a4-a9cb-8edabdbc6791 ORIGINAL "WHO_PUB_TPS_93.1.pdf": copyright refused, restrictions refused',
  withheldBy: {
    gates: [
      { gate: "copyright", verdict: "refused" },
      { gate: "restrictions", verdict: "refused" },
    ],
    record: {
      id: "item/b08c6c19-315a-41a4-a9cb-8edabdbc6791",
      page: "/who-iris/item-item-b08c6c19-315a-41a4-a9cb-8edabdbc6791.html",
      uri: "https://hdl.handle.net/10665/36842",
    },
  },
};
const listed = [FIXTURE.id];

type Entry = { instance: string; id: string; withheld?: string; withheldBy?: unknown };

/** Serve the viewer's index with the fixture applied: FIXTURE withheld, every other who-iris entry open. */
async function withFixture(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/assets/library/index.json", async (route) => {
    const res = await route.fetch();
    const g = (await res.json()) as { entries: Entry[] };
    g.entries = g.entries.map((e) => {
      if (e.instance !== "who-iris") return e;
      const { withheld: _w, withheldBy: _b, ...open } = e;
      return e.id === FIXTURE.id ? { ...open, withheld: FIXTURE.withheld, withheldBy: FIXTURE.withheldBy } : open;
    });
    await route.fulfill({ response: res, json: g });
  });
}

test("the fixture's entry is in the library — else the test below proves nothing", async ({ page }) => {
  const g = (await (await page.request.get(`${SITE}${DOCS}/assets/library/index.json`)).json()) as { entries: Entry[] };
  expect(g.entries.some((e) => e.instance === "who-iris" && e.id === FIXTURE.id)).toBe(true);
});

for (const slug of listed) {
  test(`${slug}: banner, withheld rows with a record link, never "(no content carried)"`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await themed(page);
    await withFixture(page);
    await page.goto(`${SITE}${declaredPageUrl(HARNESS, "library", { subgraph: "who-iris" })}#${encodeURIComponent(`who-iris/${slug}`)}`);
    const blocks = page.locator("#blocks");
    await expect(blocks.locator("table")).toBeVisible();

    const banner = blocks.locator(".wh-banner");
    await expect(banner).toHaveCount(1);
    await expect(banner).toContainText("not granted");
    await expect(banner).toContainText(/\d+ of \d+ sections? summarised/);
    await expect(banner.locator("a")).toHaveAttribute("href", /item-item-[0-9a-f-]+\.html$/);

    const rows = await blocks.locator("tbody tr").count();
    expect(rows).toBeGreaterThan(0);
    // Every row shows a summary (an account of the section, not its words),
    // OR the withheld line with a record link, OR a carried extract (a block
    // whose text the licence does permit, e.g. a figure's caption) — nothing
    // else.
    // Asserted as that partition rather than as "some rows are withheld":
    // once every section of who-pub-tps-931 had a drafted summary (issue
    // #2302, 2026-10-06), "> 0 withheld lines" failed on a page that was
    // exactly right.
    const lines = blocks.locator("tbody .wh-line");
    const summarised = blocks.locator("tbody tr", { hasText: "Summary — an account of this section" });
    const carried = blocks.locator("tbody tr:has(pre)");
    const nLines = await lines.count();
    expect(nLines + (await summarised.count()) + (await carried.count())).toBe(rows);
    if (nLines > 0) await expect(lines.first().locator("a")).toHaveAttribute("href", /item-item-[0-9a-f-]+\.html$/);
    await expect(blocks).not.toContainText("(no content carried)");
    expect(errors).toEqual([]);
  });
}

test("an entry that is not withheld gets no banner", async ({ page }) => {
  const g = (await (await page.request.get(`${SITE}${DOCS}/assets/library/index.json`)).json()) as {
    entries: Entry[];
  };
  // Open under the fixture: any who-iris entry but the one it withholds.
  const open = g.entries.find((e) => e.instance === "who-iris" && !listed.includes(e.id));
  test.skip(open === undefined, "who-iris holds no entry beside the fixture's");
  await themed(page);
  await withFixture(page);
  await page.goto(`${SITE}${declaredPageUrl(HARNESS, "library", { subgraph: "who-iris" })}#${encodeURIComponent(`who-iris/${open!.id}`)}`);
  await expect(page.locator("#blocks h2")).toBeVisible();
  await expect(page.locator("#blocks .wh-banner")).toHaveCount(0);
  await expect(page.locator("#blocks .wh-line")).toHaveCount(0);
});
