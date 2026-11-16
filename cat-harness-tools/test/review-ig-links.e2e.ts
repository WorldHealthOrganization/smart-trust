/**
 * The review page's links for a ChangeSet whose blocks name their own page:
 * an IG preview's (fhir-harness `ig-review-data.ts`, folio-assistant#215).
 * A section links to its page and heading on both sides; a source file has
 * no page, and says so.
 */
import { test, expect } from "@playwright/test";

import { reviewPageHtml } from "../scripts/gen-review-page.ts";

const ORIGIN = "http://review.test";
const section = { file: "input/pagecontent/schedule.md", kind: "page-section", section: "pages::schedule", index: 1, page: "schedule.html", anchor: "children" };
const source = { file: "input/cql/Logic.cql", kind: "cql", section: "sources::input/cql", index: 0, page: "" };

const FILES: Record<string, { type: string; body: string }> = {
  "/preview/review/": { type: "text/html", body: reviewPageHtml("../") },
  "/preview/staging.json": { type: "application/json", body: JSON.stringify({ branch: "sample", mainSite: "/main" }) },
  "/preview/changeset.json": {
    type: "application/json",
    body: JSON.stringify({
      $schema: "folio-changeset/v1",
      folio: "input/pagecontent",
      base: { ref: "main", commit: "a" },
      head: { ref: "worktree", commit: "b" },
      summary: { added: 0, removed: 0, changed: 2, unchanged: 3, renamed: 0, prose: 2, manifest: 0, moved: 0 },
      changes: [
        { change: "changed", label: "schedule/children", aspects: ["prose"], base: section, head: section },
        { change: "changed", label: "input/cql/Logic.cql", aspects: ["prose"], base: source, head: source },
      ],
    }),
  },
};

test("a block that names its page links to the page and heading; one on no page links nowhere", async ({ page }) => {
  await page.route(`${ORIGIN}/**`, (route) => {
    const f = FILES[new URL(route.request().url()).pathname];
    return f ? route.fulfill({ status: 200, contentType: f.type, body: f.body }) : route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}/preview/review/`);
  await page.waitForFunction(() => !document.getElementById("status")!.textContent!.startsWith("Loading"));
  const first = page.locator("li[data-label='schedule/children'] .links a");
  await expect(first).toHaveCount(2);
  expect(await first.nth(0).getAttribute("href")).toBe("../schedule.html#children");
  expect(await first.nth(1).getAttribute("href")).toBe("/main/schedule.html#children");
  await expect(page.locator("li[data-label='input/cql/Logic.cql'] .links")).toHaveText("no page to link to");
});
