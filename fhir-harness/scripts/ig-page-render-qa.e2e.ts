/**
 * The browser half of `ig-page-render-qa.test.ts`: the page scan run in a real
 * Chromium. It is an `.e2e.ts` because `bun test` runs where no browser is
 * installed (folio-assistant's bun-test shards are browser-free by design,
 * owner 2026-10-14), and Playwright runs it where one is.
 */
import { expect, test } from "playwright/test";
import { scanSite } from "./ig-page-render-qa.ts";
import { pageScanSite } from "./ig-page-render-qa-fixture.ts";

test("ig-page-render-qa: scans the drawn pages in a browser", async () => {
  test.setTimeout(60_000);
  const q = await scanSite(pageScanSite(), { timeoutMs: 5000 });
  expect(q.unavailable).toBeUndefined();
  expect(q.scanned).toBe(2);
  expect(q.unfinished).toEqual([]);
  expect(q.findings).toEqual([
    { page: "artifact/ActorDefinition-a.html", markup: ["bold"], excerpt: "**Persona**: a phone" },
    { page: "artifact/ActorDefinition-a.html", markup: ["image"], excerpt: "and ![Bo]" },
  ]);
});

test("ig-page-render-qa: a page that never returns cannot hold the scan", async () => {
  test.setTimeout(60_000);
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const site = mkdtempSync(join(tmpdir(), "page-scan-spin-"));
  // smart-ccc run 43738657067 sat in this step for 2 h: a page whose script never yields.
  writeFileSync(join(site, "a-spin.html"), `<html><body><main><p>spins</p></main><script>addEventListener("load", () => setTimeout(() => { for (;;) {} }, 0))</script></body></html>`);
  for (const n of ["b", "c", "d"]) writeFileSync(join(site, `${n}.html`), `<html><body><main><p>page ${n}</p></main></body></html>`);
  const started = Date.now();
  const q = await scanSite(site, { timeoutMs: 2000, concurrency: 1 });
  expect(Date.now() - started).toBeLessThan(30_000);
  expect(q.unfinished).toEqual(["a-spin.html"]);
  expect(q.scanned).toBe(3);

  const none = await scanSite(site, { timeoutMs: 2000, concurrency: 1, budgetMs: 0 });
  expect(none.scanned).toBe(0);
  expect(none.notReached).toBe(4);
});
