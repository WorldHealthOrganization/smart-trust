/**
 * Print waits for render: the headless PDF path's wait on `data-fa-render`,
 * and its refusal over a page that is still `pending` or has `failed`.
 *
 * The wait is generic — any page this platform renders can carry
 * `data-fa-render` — so every PDF writer above this layer imports it from
 * here; its end-to-end spec is `test/render-wait.e2e.ts`.
 *
 * @module scripts/render-wait
 */

/**
 * How long a client-built region may take before a PDF of it is refused.
 *
 * Generous on purpose: the cost of waiting is seconds, and the cost of not
 * waiting is a PDF that looks finished and is not.
 */
export const RENDER_WAIT_MS = 30_000;

/**
 * Wait for every client-built region on the page, or THROW.
 *
 * `skills/ui/ui-core/ui-accessibility.md` §"A rendering built client-side owes
 * two things the static one gave for free", owner 2026-10-02: *"print/pdf
 * needs to wait until loaded/rendered before printing"*, and *"a PDF is not
 * re-checkable after the fact the way a web page is"*.
 *
 * `waitUntil: "load"` — what this used before — fires when the document's
 * subresources have loaded, which is BEFORE a `fetch()` started at
 * `DOMContentLoaded` has resolved and rendered. On a page that builds a region
 * client-side it captures the shell. Nothing printed a site page through here
 * on the day this was written, so nothing was broken yet; it is fixed in the
 * same change that made the first region client-built, because the failure
 * mode is a silently wrong artefact rather than an error.
 *
 * ## Why this THROWS rather than emitting a marked-up PDF
 *
 * The asymmetry R4 points at: on screen a pending state is a moment, on paper
 * it is the artefact. A web page can be reloaded by the reader; a PDF that
 * says "this section had not finished loading" in the middle of a chapter is
 * a file somebody attaches to an email. So `failed` and a timeout both abort.
 * `docs-ui.css`'s `@media print` rules handle the INTERACTIVE case, which
 * cannot be made to wait at all — `beforeprint` is synchronous and no browser
 * lets a script block the print dialogue.
 *
 * ## Exported so the refusal is TESTED rather than asserted
 *
 * This is the only place in the repository where "print waits for render" is
 * actually enforceable, so it is the one place where a claim about it can be
 * falsified. `test/render-wait.e2e.ts` drives all four outcomes against real
 * Chromium. Exported for that, and for the PDF writers in the layers above
 * that print through it: a refusal nothing exercises is a refusal that
 * silently stops refusing, which is this repository's standing complaint
 * about a printed verdict.
 *
 * ## The absent attribute is not a failure
 *
 * A page that declares no dynamic region carries no `data-fa-render`, and that
 * is the same third state `kg-render.js` keeps for a `<meta>` that is not
 * there: never asked. a PDF writer that assembles its own HTML is exactly
 * such a page, so this costs that caller one `waitForFunction` that
 * returns immediately.
 */
export async function waitForRender(page: import("playwright").Page): Promise<void> {
  try {
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-fa-render") !== "pending",
      undefined,
      { timeout: RENDER_WAIT_MS },
    );
  } catch {
    throw new Error(
      `the page's client-built regions had not finished rendering after ${RENDER_WAIT_MS} ms ` +
        `(data-fa-render is still "pending"). Refusing to write a PDF of a half-rendered ` +
        `page: a PDF is not re-checkable after the fact the way a web page is.`,
    );
  }
  const state = await page.evaluate(() =>
    document.documentElement.getAttribute("data-fa-render"),
  );
  if (state === "failed") {
    throw new Error(
      `at least one of the page's client-built regions could not be loaded ` +
        `(data-fa-render="failed"). Refusing to write a PDF: the reader of the file would ` +
        `have no way to tell a failed region from an empty one.`,
    );
  }
}
