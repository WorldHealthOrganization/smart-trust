/**
 * The review page's diff renderers, in a real browser (bean d903).
 *
 * Everything is served from memory through `page.route`, so no folio and no
 * server are needed: the page, the ChangeSet, its text, `staging.json`, and two
 * one-block pages standing in for `main` and the preview.
 */
import { test, expect, type Page } from "@playwright/test";

import { reviewPageHtml } from "../../scripts/gen-review-page.ts";

const ORIGIN = "http://review.test";
const at = (file: string, kind: string, index: number) => ({ file, kind, section: "doc/ch::sec:one", index });

/** A published page: a staging banner, a tall section, then the block. */
function page(title: string, block: string): string {
  return (
    `<!doctype html><html><body><div data-fa-staging-banner style="position:fixed;top:0">FEATURE BRANCH</div><nav class="fa-nav">rail</nav>` +
    `<h1>${title}</h1><div style="height:3000px">Give 5 mg</div><section id="prose:dose">${block}</section>` +
    `<div style="height:3000px"></div></body></html>`
  );
}

const FILES: Record<string, { type: string; body: string }> = {
  "/preview/review/": { type: "text/html", body: reviewPageHtml() },
  "/preview/staging.json": {
    type: "application/json",
    body: JSON.stringify({ branch: "edit/dosing", pr: "7", prUrl: "https://example.org/pull/7", mainSite: "/main" }),
  },
  "/preview/changeset.json": {
    type: "application/json",
    body: JSON.stringify({
      $schema: "folio-changeset/v1",
      folio: "folio",
      base: { ref: "origin/main", commit: "abcdef1234567890abcdef1234567890abcdef12" },
      head: { ref: "worktree", commit: null },
      summary: { added: 1, removed: 0, changed: 2, unchanged: 0, renamed: 0, prose: 1, manifest: 1, moved: 0 },
      changes: [
        { change: "changed", label: "prose:dose", aspects: ["prose"], base: at("doc/ch/dose.ts", "prose", 0), head: at("doc/ch/dose.ts", "prose", 0) },
        { change: "changed", label: "tbl:doses", aspects: ["manifest"], base: at("doc/ch/doses.ts", "table", 1), head: at("doc/ch/doses.ts", "table", 1) },
        { change: "added", label: "prose:scope", head: at("doc/ch/scope.ts", "prose", 2) },
      ],
    }),
  },
  "/preview/changeset-text.json": {
    type: "application/json",
    body: JSON.stringify({
      $schema: "folio-changeset-text/v1",
      blocks: {
        "prose:dose": {
          base: { prose: "Give 5 mg daily.\n", html: "<p>Give 5 mg daily.</p>\n" },
          head: { prose: "Give **10 mg** daily.\n", html: '<p>Give <strong>10 mg</strong> daily.<img src="x" onerror="window.__pwned=1"></p>\n' },
        },
        "prose:scope": { head: { prose: "Adults only.\n", html: "<p>Adults only.</p>\n" } },
      },
    }),
  },
  "/main/doc/index.html": { type: "text/html", body: page("main", "<p>Give 5 mg daily.</p>") },
  "/preview/doc/index.html": { type: "text/html", body: page("preview", "<p>Give <strong>10 mg</strong> daily.</p>") },
};

async function open(page: Page): Promise<void> {
  await page.route(`${ORIGIN}/**`, (route) => {
    const f = FILES[new URL(route.request().url()).pathname];
    return f ? route.fulfill({ status: 200, contentType: f.type, body: f.body }) : route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}/preview/review/`);
  await page.waitForFunction(() => !document.getElementById("status")!.textContent!.startsWith("Loading"));
}

test.describe("review page: selectable diff renderers (d903)", () => {
  test("each block opens with its kind's default: prose inline, a table side by side", async ({ page }) => {
    await open(page);
    const values = await page.$$eval("li select", (ss) => ss.map((s) => (s as HTMLSelectElement).value));
    expect(values).toEqual(["inline", "side-by-side", "inline"]);
  });

  test("inline keeps the head's markup and marks the change in place", async ({ page }) => {
    await open(page);
    const first = page.locator("#changes li").first();
    await expect(first.locator(".diff-inline strong ins")).toHaveText("10");
    await expect(first.locator(".diff-inline del")).toHaveText("5");
  });

  test("the folio's rendered HTML is cleaned: no handler attribute survives", async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(await page.locator(".diff-inline img[onerror]").count()).toBe(0);
  });

  test("a renderer that cannot run is listed, disabled, with the reason", async ({ page }) => {
    await open(page);
    const table = page.locator("#changes li").nth(1).locator("select option", { hasText: "Word diff" });
    await expect(table).toBeDisabled();
    await expect(table).toContainText("unavailable: no prose on either side");
  });

  test("the page-level choice applies everywhere it can, and is remembered", async ({ page }) => {
    await open(page);
    await page.selectOption("#view", "word");
    // "mg" is unchanged, so the source diff is two insertions around it.
    await expect(page.locator("#changes li").first().locator(".diff-word ins")).toHaveText(["**10", "**"]);
    await expect(page.locator("#changes li").first().locator(".diff-word del")).toHaveText(["5"]);
    // The table has no prose, so it falls back to a renderer that can run.
    expect(await page.locator("#changes li").nth(1).locator("select").inputValue()).toBe("side-by-side");
    await page.reload();
    await page.waitForFunction(() => !document.getElementById("status")!.textContent!.startsWith("Loading"));
    expect(await page.inputValue("#view")).toBe("word");
  });

  test("side by side: both pages at the block, and an added block says it is not on main", async ({ page }) => {
    await open(page);
    await page.selectOption("#view", "side-by-side");
    const frames = page.locator("#changes li").first().locator("iframe");
    await expect(frames).toHaveCount(2);
    expect(await frames.nth(0).getAttribute("src")).toBe("/main/doc/index.html#prose%3Adose");
    await expect(page.locator("#changes li").nth(2)).toContainText("Not on main: this block is new.");
  });

  test("side by side: each pane scrolls to its change and marks it, under its own header", async ({ page }) => {
    await open(page);
    await page.selectOption("#view", "side-by-side");
    const li = page.locator("#changes li").first();
    await expect(li.locator(".sbs-side-base")).toContainText("Main");
    // Main's commit beside the preview's (owner, 2026-10-31).
    await expect(li.locator(".sbs-side-base")).toContainText("commit abcdef1");
    const head = li.locator(".sbs-side-head");
    await expect(head).toContainText("This preview");
    await expect(head).toContainText("edit/dosing");
    await expect(head.getByRole("link", { name: "PR #7" })).toHaveAttribute("href", "https://example.org/pull/7");
    for (const [i, cls, text] of [[0, "fa-change-base", "5"], [1, "fa-change-head", "10"]] as const) {
      const frame = li.frameLocator("iframe").nth(i);
      // The "5" inside the block, not the decoy above it.
      await expect(frame.locator(`#prose\\:dose mark.${cls}`)).toHaveText(text);
      await expect(frame.locator("[data-fa-staging-banner]")).toBeHidden();
      // Neither pane keeps the page's left rail (owner, 2026-10-31).
      await expect(frame.locator("nav.fa-nav")).toBeHidden();
      const y = await li.locator("iframe").nth(i).evaluate((f: HTMLIFrameElement) => f.contentWindow!.scrollY);
      expect(y).toBeGreaterThan(2500);
    }
  });

  test("inline marks a link added around words that did not change (owner, 2026-10-31)", async ({ page }) => {
    await open(page);
    const out = await page.evaluate(() => {
      const w = window as unknown as Record<string, (...a: unknown[]) => unknown>;
      const box = w.renderInline(document, "<p>data and digital infrastructure here</p>", '<p>data and <a href="g#di">digital infrastructure</a> here</p>', w.wordDiff, w.cleanRendered) as HTMLElement;
      const same = w.renderInline(document, '<p>see <a href="g#di">term</a></p>', '<p>see <a href="g#di">term</a></p>', w.wordDiff, w.cleanRendered) as HTMLElement;
      return { added: box.querySelector("a ins.diff-link-added")?.textContent, same: same.querySelectorAll("ins").length };
    });
    expect(out).toEqual({ added: "digital infrastructure", same: 0 });
  });

  test("a swapped figure shows before and after, each from its own page's directory", async ({ page }) => {
    await open(page);
    const out = await page.evaluate(() => {
      const w = window as unknown as Record<string, (...a: unknown[]) => unknown>;
      const clean = (dir: string) => (d: Document, h: string) => w.cleanRendered(d, h, dir);
      const box = w.imageChange(document, '<p><img src="media/old.png" alt="Figure"></p>', '<p><img src="media/new.svg" alt="Figure"></p>', clean("/main/doc/"), clean("../doc/")) as HTMLElement | null;
      const same = w.imageChange(document, '<p><img src="media/a.svg"></p>', '<p><img src="media/a.svg"></p>', clean("x/"), clean("y/"));
      const abs = (w.cleanRendered(document, '<p><img src="https://x.io/a.png"><a href="#s">s</a></p>', "../doc/") as HTMLElement).innerHTML;
      return {
        caps: Array.from(box?.querySelectorAll("figcaption") ?? []).map((c) => c.textContent),
        srcs: Array.from(box?.querySelectorAll("img") ?? []).map((i) => i.getAttribute("src")),
        same,
        abs,
      };
    });
    expect(out).toEqual({
      caps: ["Before", "After"],
      srcs: ["/main/doc/media/old.png", "../doc/media/new.svg"],
      same: null,
      abs: '<p><img src="https://x.io/a.png"><a href="#s">s</a></p>',
    });
  });

  test("the review brief draws a link inside bold (a comment number linked to its row)", async ({ page }) => {
    await open(page);
    const html = await page.evaluate(() => {
      const p = document.createElement("p");
      (window as unknown as Record<string, (...a: unknown[]) => void>).briefInline(document, p, "**No. [136](https://x.io/pc/#PC-0137):** Accepted.");
      return p.innerHTML;
    });
    expect(html).toBe('<strong>No. <a href="https://x.io/pc/#PC-0137" rel="noopener">136</a>:</strong> Accepted.');
  });

  test("typing j inside a selector does not navigate", async ({ page }) => {
    await open(page);
    const before = await page.textContent("#status");
    await page.focus("li select");
    await page.keyboard.press("j");
    expect(await page.textContent("#status")).toBe(before);
  });
});
