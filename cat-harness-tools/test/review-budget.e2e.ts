/**
 * The review page's performance budget at handbook scale — bean
 * folio-assistant-xp72 (done-when 2), epic q4jm.
 *
 * Every review child can pass on a ten-block fixture and still fall over on a
 * real handbook, so this serves the page a ChangeSet over a 2,000-block folio,
 * from memory as review-heat.e2e.ts does, and times it: from navigation to the
 * moment the list is on the page and the status has stopped saying "Loading".
 *
 * ## The budget, and what it was set from
 *
 * Proposed in the bean: interactive in under 2 s for 2,000 blocks. Measured
 * on 2026-10-11 in a cloud container (Chromium 1194, 4 CPUs), served by a
 * real HTTP server, 3 runs each:
 *
 * | ChangeSet | before | after `content-visibility` |
 * |---|---|---|
 * | 100 of 2,000 changed (xp72's golden fixture) | 296–383 ms | 397–493 ms |
 * | all 2,000 changed, with change text | 1,676–1,788 ms | 673–720 ms |
 * | all 2,000 changed, no change text (two lazy iframes each) | 3,525–3,834 ms | 598–763 ms |
 *
 * The 100-change row is noise at that size. The fix is one rule in
 * `gen-review-page.ts`'s stylesheet: `content-visibility: auto` on each entry.
 * A CPU profile had put the time in style and layout of entries off screen,
 * not in the page's script.
 *
 * **Gated:** the with-text case, the worst realistic staging build. It measured
 * 894 ms through this file's in-memory routing.
 *
 * **Logged, not gated:** the no-text case. Through `page.route` it still
 * measures about 4.4 s here, against 0.6–0.8 s from a real server, probably
 * because the router intercepts every iframe request. A gate on it would
 * measure the test harness, not the page.
 */
import { test, expect, type Page } from "@playwright/test";

import { reviewPageHtml } from "../scripts/gen-review-page.ts";

const ORIGIN = "http://budget.test";
const BUDGET_MS = 2000;
const p2 = (n: number) => String(n).padStart(2, "0");

/** 10 chapters × 10 sections × 20 blocks, every one changed (prose). */
function changeset(): { cs: unknown; text: unknown } {
  const changes: unknown[] = [];
  const blocks: Record<string, unknown> = {};
  for (let c = 0; c < 10; c++) for (let s = 0; s < 10; s++) for (let b = 0; b < 20; b++) {
    const label = `def:${p2(c)}-${p2(s)}-${p2(b)}`;
    const at = { file: `ch-${p2(c)}/b-${p2(c)}-${p2(s)}-${p2(b)}.ts`, kind: "definition", section: `ch-${p2(c)}::sec-${p2(s)}`, index: b };
    changes.push({ change: "changed", label, aspects: ["prose"], base: at, head: at });
    const before = `Block ${label}. It states one requirement and gives its rationale.`;
    const after = `Block ${label}. It states one requirement, reworded in review.`;
    blocks[label] = { base: { prose: before, html: `<p>${before}</p>` }, head: { prose: after, html: `<p>${after}</p>` } };
  }
  return {
    cs: {
      $schema: "folio-changeset/v1", folio: "folio", base: { ref: "base", commit: null }, head: { ref: "worktree", commit: null },
      summary: { added: 0, removed: 0, changed: 2000, unchanged: 0, renamed: 0, prose: 2000, manifest: 0, moved: 0 },
      changes,
    },
    text: { $schema: "folio-changeset-text/v1", blocks },
  };
}

async function timeToList(page: Page, withText: boolean): Promise<{ ms: number; items: number }> {
  const { cs, text } = changeset();
  const files: Record<string, { type: string; body: string }> = {
    "/preview/review/": { type: "text/html", body: reviewPageHtml() },
    "/preview/staging.json": { type: "application/json", body: "{}" },
    "/preview/changeset.json": { type: "application/json", body: JSON.stringify(cs) },
  };
  if (withText) files["/preview/changeset-text.json"] = { type: "application/json", body: JSON.stringify(text) };
  await page.route(`${ORIGIN}/**`, (route) => {
    const hit = files[new URL(route.request().url()).pathname];
    return hit ? route.fulfill({ status: 200, contentType: hit.type, body: hit.body }) : route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}/preview/review/`);
  await page.waitForFunction(
    () => !/Loading the ChangeSet/.test(document.getElementById("status")?.textContent ?? "") && (document.getElementById("changes")?.children.length ?? 0) > 0,
    null,
    { timeout: 60_000 },
  );
  return page.evaluate(() => ({ ms: Math.round(performance.now()), items: document.querySelectorAll("#changes li[data-label]").length }));
}

test.describe("review page at 2,000 blocks (xp72)", () => {
  test.setTimeout(120_000);

  test(`every block changed, with change text: on the page within ${BUDGET_MS} ms`, async ({ page }) => {
    const { ms, items } = await timeToList(page, true);
    console.log(`review page, 2000 changes with text: ${ms} ms`);
    expect(items).toBe(2000);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  test("every block changed, no change text: measured and logged, not gated (see header)", async ({ page }) => {
    const { ms, items } = await timeToList(page, false);
    console.log(`review page, 2000 changes, no text (side-by-side iframes): ${ms} ms — budget ${BUDGET_MS} ms, not gated`);
    expect(items).toBe(2000);
  });
});
