/**
 * The review page's navigation, driven by the KEYBOARD ONLY (bean eb4l): no
 * click, no hover, no mouse anywhere in this file. The owner works with very
 * limited hand function, and the bean's done-when asks for exactly this test.
 */
import { test, expect, type Page } from "@playwright/test";

import { reviewPageHtml } from "../../scripts/gen-review-page.ts";

const ORIGIN = "http://nav.test";
const at = (file: string, section: string, index: number) => ({ file, kind: "prose", section, index });
const openComment = (id: number, targetLabel: string) => ({
  $schema: "review-comment/1.0.0", id: `review-pr7-c${id}`, summary: "s", comment: "c", createdAt: "2026-09-23T07:00:00Z",
  targetLabel, status: "open", priority: "medium", origin: "human",
  tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
  review: { repo: "o/r", pr: 7, commentId: id, commentUrl: `https://example.org/c/${id}`, reviewer: "r", role: "reviewer", kind: "question", blockHash: "h", commit: "c1", orphaned: false, anchoredFrom: [] },
});

const verdict = (id: number, targetLabel: string, blockHash: string) => ({
  $schema: "folio-review-verdict/v1", id: `verdict-pr7-c${id}-${targetLabel}`, targetLabel, verdict: "ok", blockHash,
  reviewer: "sme", role: "clinical-sme", repo: "o/r", pr: 7, commentId: id, commentUrl: `https://example.org/c/${id}`, commit: "c1", at: "2026-09-23T09:00:00Z",
});

const FILES: Record<string, { type: string; body: string }> = {
  "/preview/review/": { type: "text/html", body: reviewPageHtml() },
  "/preview/staging.json": { type: "application/json", body: JSON.stringify({ branch: "b", pr: "7", prUrl: "https://example.org/pull/7", mainSite: "/main" }) },
  "/preview/changeset.json": {
    type: "application/json",
    body: JSON.stringify({
      $schema: "folio-changeset/v1", folio: "folio", base: { ref: "origin/main", commit: "a" }, head: { ref: "worktree", commit: null },
      summary: { added: 0, removed: 0, changed: 3, unchanged: 1, renamed: 0, prose: 3, manifest: 0, moved: 0 },
      changes: [
        { change: "changed", label: "p:a", aspects: ["prose"], base: at("doc/one/a.ts", "doc/one::sec:a", 0), head: at("doc/one/a.ts", "doc/one::sec:a", 0) },
        { change: "changed", label: "p:b", aspects: ["prose"], base: at("doc/one/b.ts", "doc/one::sec:a", 1), head: at("doc/one/b.ts", "doc/one::sec:a", 1) },
        { change: "changed", label: "p:c", aspects: ["prose"], base: at("doc/two/c.ts", "doc/two::sec:c", 0), head: at("doc/two/c.ts", "doc/two::sec:c", 0) },
      ],
    }),
  },
  "/preview/review-comments.json": {
    type: "application/json",
    body: JSON.stringify({ $schema: "folio-review-comments/v1", repo: "o/r", pr: 7, commit: "c1", generatedAt: "2026-09-23T08:00:00Z", comments: [openComment(1, "p:b"), openComment(2, "p:c")], malformed: [], untagged: 0,
      // px0t: p:b has a verdict on its current version; p:a's is on an OLDER one, so it does not count.
      verdicts: [verdict(3, "p:b", "hb"), verdict(4, "p:a", "ha-old")] }),
  },
  "/preview/blocks.json": {
    type: "application/json",
    body: JSON.stringify({ "p:a": { hash: "ha", section: "doc/one::sec:a" }, "p:b": { hash: "hb", section: "doc/one::sec:a" }, "p:c": { hash: "hc", section: "doc/two::sec:c" } }),
  },
  "/preview/outline.json": {
    type: "application/json",
    body: JSON.stringify({
      $schema: "folio-outline/v1",
      documents: [{
        slug: "doc", title: "Handbook", page: "doc/index.html",
        chapters: [
          { title: "One", sections: [{ key: "doc/one::sec:a", title: "Section A", blocks: ["p:a", "p:b"] }, { key: "doc/one::sec:quiet", title: "Quiet", blocks: ["p:q"] }] },
          { title: "Two", sections: [{ key: "doc/two::sec:c", title: "Section C", blocks: ["p:c"] }] },
        ],
      }],
    }),
  },
};

// The same page with a drawn harness rail, as rail-standalone-pages leaves it.
FILES["/preview/railed/"] = {
  type: "text/html",
  body: reviewPageHtml().replace(/<body([^>]*)>/, '<body$1><nav class="fa-nav" aria-label="folio-assistant"><div class="fa-nav-in"><div class="fa-nav-top"></div><div class="fa-nav-bottom"></div></div></nav>'),
};

async function open(page: Page, at = "review"): Promise<void> {
  await page.route(`${ORIGIN}/**`, (route) => {
    const f = FILES[new URL(route.request().url()).pathname];
    return f ? route.fulfill({ status: 200, contentType: f.type, body: f.body }) : route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}/preview/${at}/`);
  await page.waitForFunction(() => !document.getElementById("status")!.textContent!.startsWith("Loading"));
}

const focused = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null;
  return a ? (a.getAttribute("data-label") || a.getAttribute("aria-label") || a.textContent || "").trim() : "";
});

test.describe("review navigation, keyboard only (eb4l)", () => {
  test("j announces where you are: document, chapter, section, block", async ({ page }) => {
    await open(page);
    await page.keyboard.press("j");
    await expect(page.locator("#status")).toHaveText("Item 1 of 3: Handbook › One › Section A › p:a");
  });

  test("n and p move between blocks with open comments, skipping the others, and wrap", async ({ page }) => {
    await open(page);
    await page.keyboard.press("n");
    expect(await focused(page)).toBe("p:b");
    await page.keyboard.press("n");
    expect(await focused(page)).toBe("p:c");
    await page.keyboard.press("n");
    expect(await focused(page)).toBe("p:b");
    await page.keyboard.press("p");
    expect(await focused(page)).toBe("p:c");
  });

  test("u moves to the next changed block with no verdict on its CURRENT version, and wraps (px0t)", async ({ page }) => {
    await open(page);
    await page.keyboard.press("u");
    expect(await focused(page)).toBe("p:a"); // its verdict is on an older version
    await page.keyboard.press("u");
    expect(await focused(page)).toBe("p:c"); // no verdict at all
    await page.keyboard.press("u");
    expect(await focused(page)).toBe("p:a");
    const words = await page.$$eval("li[data-label] .verdict", (vs) => vs.map((v) => v.textContent!.replace(/\s+/g, " ").trim()));
    expect(words).toEqual([
      "No verdict on this version yet (1 verdict on an earlier version, not counted)",
      "Reviewed: ok by sme as clinical-sme",
      "No verdict on this version yet",
    ]);
  });

  test("the outline lists every section in order, with word badges, and a section jumps with Enter", async ({ page }) => {
    await open(page);
    const rows = await page.$$eval("nav.outline li li", (ls) => ls.map((l) => l.textContent!.replace(/\s+/g, " ").trim()));
    expect(rows).toEqual(["Section A 2 changed, 1 comment", "Quiet", "Section C 1 changed, 1 comment"]);
    await page.locator("nav.outline button", { hasText: "Section C" }).focus();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-section"))).toBe("doc/two::sec:c");
  });

  test("with a harness rail, the outline is a section OF THE RAIL, not a column of the page (owner, 2026-10-07)", async ({ page }) => {
    await open(page, "railed");
    expect(await page.locator("#navpane nav.outline").count()).toBe(0);
    const group = page.locator("nav.fa-nav .fa-nav-graphs details.fa-nav-group[open]");
    await expect(group.locator("summary")).toHaveText("\u00a7Outline");
    const rows = await group.locator(".fa-nav-sub > *").evaluateAll((ls) => ls.map((l) => l.textContent!.replace(/\s+/g, " ").trim()));
    expect(rows).toEqual(["One", "Section A · 2 changed, 1 comment", "Quiet", "Two", "Section C · 1 changed, 1 comment"]);
    // A quiet section links to its anchor on the document page.
    expect(await group.locator("a", { hasText: "Quiet" }).getAttribute("href")).toMatch(/#sec%3Aquiet$/);
    // One with something to review jumps to it in the list.
    await group.locator("a", { hasText: "Section C" }).click();
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-section"))).toBe("doc/two::sec:c");
  });

  test("the minimap is ONE tab stop: arrows move, Enter jumps to the block", async ({ page }) => {
    await open(page);
    const stops = await page.$$eval(".minimap .cell", (c) => c.filter((x) => (x as HTMLElement).tabIndex === 0).length);
    expect(stops).toBe(1);
    await page.locator(".minimap .cell[tabindex='0']").focus();
    expect(await focused(page)).toBe("p:a: changed");
    await page.keyboard.press("End");
    expect(await focused(page)).toBe("p:c: changed, 1 open comment");
    await page.keyboard.press("ArrowUp");
    expect(await focused(page)).toBe("p:q: unchanged");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    expect(await focused(page)).toBe("p:b");
  });

  test("every control is reachable with Tab alone", async ({ page }) => {
    await open(page);
    const want = ["Previous (k)", "Next (j)", "Previous with comments (p)", "Next with comments (n)", "Next unreviewed (u)"];
    const seen = new Set<string>();
    for (let i = 0; i < 80 && seen.size < want.length; i++) {
      await page.keyboard.press("Tab");
      const t = (await focused(page)).trim();
      if (want.includes(t)) seen.add(t);
    }
    expect([...seen].sort()).toEqual([...want].sort());
  });
});
