/**
 * The review page's heat map, in a real browser (bean qbfi). Served from
 * memory, as review-diff.e2e.ts is.
 */
import { test, expect, type Page } from "@playwright/test";

import { reviewPageHtml } from "../../scripts/gen-review-page.ts";

const ORIGIN = "http://heat.test";
const at = (file: string, section: string, index: number) => ({ file, kind: "prose", section, index });
const comment = (id: number, targetLabel: string, kind: string, blockHash: string, status = "open") => ({
  $schema: "review-comment/1.0.0", id: `review-pr7-c${id}`, summary: "s", comment: "c", createdAt: "2026-09-23T07:00:00Z",
  targetLabel, status, priority: "medium", origin: "human",
  tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
  review: { repo: "o/r", pr: 7, commentId: id, commentUrl: `https://example.org/c/${id}`, reviewer: "r", role: "reviewer", kind, blockHash, commit: "c1", orphaned: false, anchoredFrom: [] },
});

function files(withComments: boolean, withQa = false): Record<string, { type: string; body: string }> {
  const f: Record<string, { type: string; body: string }> = {
    "/preview/review/": { type: "text/html", body: reviewPageHtml() },
    "/preview/staging.json": { type: "application/json", body: JSON.stringify({ branch: "b", pr: "7", prUrl: "https://example.org/pull/7", mainSite: "/main" }) },
    "/preview/changeset.json": {
      type: "application/json",
      body: JSON.stringify({
        $schema: "folio-changeset/v1", folio: "folio", base: { ref: "origin/main", commit: "a" }, head: { ref: "worktree", commit: null },
        summary: { added: 0, removed: 0, changed: 3, unchanged: 1, renamed: 0, prose: 3, manifest: 0, moved: 0 },
        changes: [
          { change: "changed", label: "p:a", aspects: ["prose"], base: at("doc/ch/a.ts", "doc/ch::sec:one", 0), head: at("doc/ch/a.ts", "doc/ch::sec:one", 0) },
          { change: "changed", label: "p:b", aspects: ["prose"], base: at("doc/ch/b.ts", "doc/ch::sec:one", 1), head: at("doc/ch/b.ts", "doc/ch::sec:one", 1) },
          { change: "changed", label: "p:c", aspects: ["prose"], base: at("doc/ch/c.ts", "doc/ch::sec:two", 0), head: at("doc/ch/c.ts", "doc/ch::sec:two", 0) },
        ],
      }),
    },
    "/preview/blocks.json": {
      type: "application/json",
      body: JSON.stringify({
        "p:a": { hash: "a2", renamedFrom: [], section: "doc/ch::sec:one" },
        "p:b": { hash: "b1", renamedFrom: [], section: "doc/ch::sec:one" },
        "p:c": { hash: "c1", renamedFrom: [], section: "doc/ch::sec:two" },
        "p:u": { hash: "u1", renamedFrom: [], section: "doc/ch::sec:three" },
      }),
    },
  };
  if (withComments) {
    f["/preview/review-comments.json"] = {
      type: "application/json",
      body: JSON.stringify({
        $schema: "folio-review-comments/v1", repo: "o/r", pr: 7, commit: "c1", generatedAt: "2026-09-23T08:00:00Z",
        comments: [comment(1, "p:a", "defect", "a1"), comment(2, "p:b", "question", "b1"), comment(3, "p:u", "editorial", "u1")],
        malformed: [], untagged: 0,
      }),
    };
  }
  if (withQa) {
    f["/preview/block-qa.json"] = {
      type: "application/json",
      body: JSON.stringify({
        $schema: "folio-block-qa-summary/v1",
        blocks: {
          "p:a": { state: "failing", fails: 1, warns: 0, worst: "critical", staleCriteria: 0 },
          "p:b": { state: "passing", fails: 0, warns: 0, worst: null, staleCriteria: 0 },
          "p:c": { state: "unaudited", fails: 0, warns: 0, worst: null, staleCriteria: 0 },
          "p:u": { state: "stale", fails: 0, warns: 0, worst: null, staleCriteria: 3 },
        },
        counts: { failing: 1, passing: 1, stale: 1, unaudited: 1 },
      }),
    };
  }
  return f;
}

async function open(page: Page, withComments = true, withQa = false): Promise<void> {
  const f = files(withComments, withQa);
  await page.route(`${ORIGIN}/**`, (route) => {
    const hit = f[new URL(route.request().url()).pathname];
    return hit ? route.fulfill({ status: 200, contentType: hit.type, body: hit.body }) : route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}/preview/review/`);
  await page.waitForFunction(() => !document.getElementById("status")!.textContent!.startsWith("Loading"));
}

const rows = (page: Page) =>
  page.$$eval("table.heat tbody tr", (rs) => rs.map((r) => Array.from(r.children).map((c) => c.textContent!.trim())));

test.describe("review page: heat map (qbfi)", () => {
  test("one row per section in reading order, a comment on an unchanged block in its own section", async ({ page }) => {
    await open(page);
    expect(await rows(page)).toEqual([
      ["doc/ch › sec:one", "2", "2 (1 defect)", "1", "no data", "not published"],
      ["doc/ch › sec:two", "1", "0", "0", "no data", "not published"],
      ["doc/ch › sec:three", "0", "1", "0", "no data", "not published"],
    ]);
  });

  test("never colour alone: the tint follows the number, and zero has no fill", async ({ page }) => {
    await open(page);
    const cls = await page.$$eval("table.heat tbody tr:first-child td", (tds) => tds.slice(0, 3).map((t) => t.className));
    expect(cls).toEqual(["h3", "h3", "h3"]);
    expect(await page.locator("table.heat tbody tr:nth-child(2) td").nth(1).getAttribute("class")).toBe("h0");
  });

  test("no comment file is SAID in the comment columns, not zeroed", async ({ page }) => {
    await open(page, false);
    const r = await rows(page);
    expect(r[0]!.slice(2, 4)).toEqual(["no data", "no data"]);
  });

  test("a section's name moves focus to it in the list", async ({ page }) => {
    await open(page);
    await page.locator("table.heat tbody th button").first().click();
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-section"))).toBe("doc/ch::sec:one");
  });

  test("published QA: failing with its severity, stale and unaudited said, never a bare pass", async ({ page }) => {
    await open(page, true, true);
    const qa = (await rows(page)).map((r) => r[5]);
    expect(qa).toEqual(["1 failing (critical)", "1 unaudited", "1 stale"]);
    expect(await page.locator("table.heat tbody tr:first-child td").nth(4).getAttribute("class")).toBe("h3");
  });
});
