import { test, expect } from "@playwright/test";
import { basename } from "node:path";

import { TOOLS_ROOT } from "../../scripts/lib/roots.ts";

/**
 * Where this layer is under the root the server serves. `playwright.config.ts`
 * starts it with `cwd: '..'` — the directory holding this layer — so the
 * layer is one segment in, named whatever its directory is called.
 */
const TOOLS = `/${basename(TOOLS_ROOT)}`;

/**
 * The test server itself.
 *
 * `playwright.config.ts` referenced `test-server.cjs` from the day it was
 * written and the file never existed, so `bunx playwright test` died before
 * collecting a test and nothing noticed for as long as nobody ran it. Bean
 * `dzl3`.
 *
 * These assertions exist so that stops being possible: if the server is
 * missing, misrouted, or starts refusing to serve, a test fails rather than
 * the whole run failing to start — and a failing test names what is wrong.
 */
test.describe("test-server", () => {
  test("serves the repository root, so any subtree is reachable", async ({ page }) => {
    // Rooting at the repo rather than one subtree is what lets a spec reach
    // ui/, viewer/ or a built _site/ without the server having to guess.
    //
    // `ui/` is one level in — under `cat-harness/` since the move (bean
    // `wggr`), and under this layer since bean `70lx` moved it here: the
    // server still serves the REPOSITORY root, which is the property under
    // test. Prefixing the URL rather than re-rooting the server keeps the
    // assertion about what it claims to be about.
    const res = await page.goto(`${TOOLS}/ui/index.html`);
    expect(res?.status()).toBe(200);
  });

  test("serves a directory's index.html", async ({ page }) => {
    const res = await page.goto(`${TOOLS}/viewer/`);
    expect(res?.status()).toBe(200);
  });

  test("404s a missing path instead of hanging or 500ing", async ({ page }) => {
    const res = await page.goto("/definitely-not-here.html");
    expect(res?.status()).toBe(404);
  });

  test("refuses to serve outside its root, including percent-encoded traversal", async ({ request }) => {
    // Path traversal is checked AFTER resolution: inspecting the raw string
    // for ".." misses encodings and symlinks. A client that normalises (curl,
    // a browser address bar) never exercises this — the request has to reach
    // the server still encoded, which `request` does.
    for (const p of ["/..%2f..%2fetc/passwd", "/%2e%2e%2f%2e%2e%2fetc/passwd"]) {
      const res = await request.get(p);
      expect(res.status()).toBe(403);
    }
  });

  test("sets a usable content type rather than octet-stream for known kinds", async ({ request }) => {
    const res = await request.get(`${TOOLS}/ui/styles.css`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/css");
  });
});
