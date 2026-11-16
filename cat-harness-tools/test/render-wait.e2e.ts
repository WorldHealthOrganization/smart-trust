/**
 * The headless PDF path WAITS for a client-built region, and REFUSES over one
 * that failed.
 *
 * ## Why this spec exists at all
 *
 * `skills/ui/ui-core/ui-accessibility.md` §"A rendering built client-side owes
 * two things the static one gave for free", owner 2026-10-02: *"print/pdf
 * needs to wait until loaded/rendered before printing"*, and *"a PDF is not
 * re-checkable after the fact the way a web page is"*.
 *
 * Interactive print cannot be made to wait — `beforeprint` is synchronous, a
 * `fetch` cannot be awaited inside it, and no browser lets a script hold the
 * print dialogue open. `docs-ui.css`'s `@media print` rules cover that case by
 * making a premature print say so on the paper. **So `scripts/render-wait.ts`,
 * which the headless PDF writers print through, is the only place in this
 * repository where the obligation is actually enforceable**, which makes it the only place a claim about it can be
 * falsified. A refusal that nothing exercises is a refusal that silently stops
 * refusing.
 *
 * ## All four outcomes, because three of them look alike from outside
 *
 * | page state | what must happen |
 * |---|---|
 * | no `data-fa-render` at all | **emit** — the page declares no dynamic region, so there is nothing to wait for. A PDF writer that assembles its own HTML is exactly this case. |
 * | `ready` | **emit** |
 * | `failed` | **refuse**, naming the attribute |
 * | still `pending` at the deadline | **refuse**, naming the timeout |
 *
 * The first row is the one a narrower test would get wrong. "Never asked" is a
 * third state, and a wait that treated an absent attribute as `pending` would
 * hang the current, correct caller for the full timeout and then refuse it.
 *
 * ## Why Playwright rather than a unit test with a fake page
 *
 * `waitForFunction` is Playwright's, and its behaviour on a document that
 * never changes is the thing under test. A stub that resolved or rejected on
 * command would be a test of the stub — and the attribute is read from a real
 * `document.documentElement`, which is the join between this script and
 * `kg-render.js`.
 *
 * `RENDER_WAIT_MS` is 30 s in production and that is deliberate (the cost of
 * waiting is seconds; the cost of not waiting is a PDF that looks finished and
 * is not). These tests therefore drive the timeout through the exported
 * constant's own mechanism rather than waiting 30 s: the `pending` case is
 * given a page that will never settle and the spec's own timeout budget is
 * what bounds it, so a regression that removed the wait entirely would fail
 * here by RESOLVING rather than by hanging.
 */
import { test, expect } from "@playwright/test";

import { RENDER_WAIT_MS, waitForRender } from "../scripts/render-wait.ts";

/** What `renderPdf` would do: emit, or throw before writing anything. */
async function outcome(page: import("@playwright/test").Page, html: string) {
  await page.setContent(html, { waitUntil: "load" });
  try {
    await waitForRender(page);
    return { emitted: true, why: "" };
  } catch (e) {
    return { emitted: false, why: e instanceof Error ? e.message : String(e) };
  }
}

/** A page that sets the attribute from script, the way `kg-render.js` does. */
const settles = (to: string) =>
  `<html data-fa-render="pending"><body>body text` +
  `<script>document.documentElement.setAttribute("data-fa-render",${JSON.stringify(to)})<\/script>` +
  `</body></html>`;

test.describe("a page with nothing to wait for is printed", () => {
  test("no `data-fa-render` at all: emit — never asked is not pending", async ({ page }) => {
    // THE ROW A NARROWER TEST WOULD GET WRONG, and the one that matters most
    // today: a PDF writer that assembles its own HTML carries no attribute,
    // so treating absent as `pending` would hang that caller for 30 s and
    // then refuse it.
    const r = await outcome(page, `<html><body>a document, assembled by its PDF writer itself</body></html>`);
    expect(r.emitted, r.why).toBe(true);
  });

  test("`ready`: emit", async ({ page }) => {
    const r = await outcome(page, settles("ready"));
    expect(r.emitted, r.why).toBe(true);
  });
});

test.describe("a page that did not finish rendering is REFUSED", () => {
  test("`failed`: refuse, and say that an empty region and a failed one differ", async ({ page }) => {
    const r = await outcome(page, settles("failed"));
    expect(r.emitted).toBe(false);
    // The MESSAGE is asserted, not just the throw. A refusal whose reason a
    // reader cannot act on is the third-state failure one level up.
    expect(r.why).toContain('data-fa-render="failed"');
    expect(r.why).toContain("empty");
  });

  test("still `pending` at the deadline: refuse, naming the wait", async ({ page }) => {
    // A page that never settles. If a regression removed the wait, this
    // RESOLVES and the test fails on `emitted` — it does not hang, which is
    // what makes the assertion falsifiable rather than merely slow.
    test.setTimeout(RENDER_WAIT_MS + 20_000);
    const r = await outcome(page, `<html data-fa-render="pending"><body>a shell</body></html>`);
    expect(r.emitted).toBe(false);
    expect(r.why).toContain("pending");
    expect(r.why).toContain("not re-checkable");
  });
});

test.describe("the constant is a real budget", () => {
  test("`RENDER_WAIT_MS` is generous, because the asymmetry is the whole point", () => {
    // Pinned as a RANGE rather than a value: the number is a judgement and may
    // move, but a wait short enough to expire on a slow network would turn the
    // guard into a refusal generator, and one of zero would remove it.
    expect(RENDER_WAIT_MS).toBeGreaterThanOrEqual(10_000);
    expect(RENDER_WAIT_MS).toBeLessThanOrEqual(120_000);
  });
});
