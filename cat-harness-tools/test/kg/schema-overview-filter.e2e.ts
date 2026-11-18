/**
 * The schema viewer's overview panel follows the filters — all of them.
 *
 * Bean `whbf`, the live-filtering item. Before this, `render()` honoured
 * search, kind and module while `diaModel()` honoured module ALONE, so a
 * reader who typed into the search box watched the list narrow and the
 * picture sit still. The bean records that as deliberate — the overview shows
 * SCOPE, not filter — and as a design that is defensible. As an *experience*
 * it is not, because nothing on the page said so, and an undisclosed
 * deliberate choice is indistinguishable from a bug to the person looking at
 * it.
 *
 * ## Why these assertions are over a rendered page rather than the generator
 *
 * The panel's whole behaviour lives inside a template literal as browser
 * JavaScript, so a unit test over `viewerHtml()` can pin that the WIRING is
 * present and cannot pin that it WORKS. This repository has already paid for
 * that distinction: `qttr` found 12 of 67 modules rendering their 10px font
 * at under 5px — the worst at 1.60px — and every gate was green across it,
 * because the generator's output looked right. Only a rendered page showed
 * it. The sibling unit tests in `schemas/viz-generators.test.ts` cover the
 * cheap half; this file covers the half that catches the `qttr` shape.
 *
 * ## What must not regress
 *
 * `whbf`'s closing line: *"a reader can return to the static arrangement, and
 * the undrawn-edge count survives every mode."* The second clause described a
 * mechanism that had been DELETED — `ovModel`'s intra-module counter went
 * with the ring when the layered diagram replaced it in `3f629d42b`, and
 * nothing replaced the contract. Live filtering restores it for the one loss
 * the current layout actually has: a relationship between two faded context
 * boxes, where both boxes are on screen and the line between them is not.
 *
 * @module test/schema-overview-filter.e2e
 */
import { test, expect, type Page } from "@playwright/test";
import { dirname, join } from "node:path";

import { serveThemedAt } from "../support/themed-page.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { declaredPageUrl } from "../support/site-pages.ts";

/** Served from the repository root by `test-server.mjs`. */
const PAGE = `${declaredPageUrl(HARNESS_ROOT, "schemas")}index.html`;
const REPO = join(dirname(HARNESS_ROOT));

// The page is THEMED since 2026-10-07: Jekyll front matter and a Liquid raw
// block, which a browser served the file as-is would print. So its body is
// served in a stand-in for the site's layout, at its real path, and the
// projection it fetches still comes from the server.
test.beforeEach(async ({ page }) => {
  await serveThemedAt(page, REPO, PAGE);
});

/** The caption is the panel's own report; every count below is read from it. */
const CAP = "#ov-cap";

/**
 * Open the panel and wait for a drawn picture.
 *
 * `diagram()` runs on first open rather than at load, so a test that asserts
 * before opening asserts over an empty `<svg>` and passes for the wrong
 * reason.
 */
async function openPanel(page: Page): Promise<void> {
  await page.goto(PAGE);
  await expect(page.locator("#counts")).toContainText("declarations");
  await page.locator("#overview > summary").click();
  await expect(page.locator("#overview")).toHaveAttribute("open", "");
}

/** Declarations the caption says it drew, or `null` when it refused. */
async function drawnCount(page: Page): Promise<number | null> {
  const text = (await page.locator(CAP).textContent()) ?? "";
  if (text.includes("too many to draw")) return null;
  const m = /^(\d+)\s+declaration/.exec(text.trim());
  return m ? Number(m[1]) : null;
}

/**
 * The drawn count, once the caption has SETTLED.
 *
 * `drawnCount` is a single read, and the two halves of a filter change do not
 * land together: the list re-renders on the `input` event while the diagram is
 * DEBOUNCED at 150ms, the same trade the resize handler makes. So between "the
 * caption no longer says it refused" and "the caption reports a count" there is
 * a window holding neither, and a one-shot read can sample it.
 *
 * This failed exactly once, in CI, on a commit whose diff was a bean markdown
 * file and a base merge — and did NOT reproduce here over three repeats of the
 * whole file. A test that passes twenty-one times locally and fails on a slower
 * runner is not measuring the page; it is measuring the runner. Polling is the
 * fix rather than a longer timeout, because the failure is a missed sample and
 * not a slow one.
 */
async function drawnSettled(page: Page): Promise<number> {
  await expect.poll(async () => await drawnCount(page), { timeout: 10_000 }).not.toBeNull();
  const n = await drawnCount(page);
  expect(n).not.toBeNull();
  return n!;
}

/**
 * The caption's verdict once it has SETTLED — a count, or `null` for a refusal.
 *
 * {@link drawnSettled} cannot serve a caller that does not know which verdict to
 * expect: it polls `.not.toBeNull()` and so FAILS the test on a refusal, which is
 * correct for the tests that have already narrowed below the limit and wrong for
 * one that is asking which kinds do. Measured 2026-09-27: using it to probe
 * turned a red test into a differently-red one.
 *
 * It polls for the same reason `drawnSettled` does, and the reason is the one
 * written there: the list re-renders on `input` while the diagram is DEBOUNCED at
 * 150ms, so between "no longer refusing" and "reports a count" there is a window
 * holding NEITHER, and a single read can sample it. The third state here is
 * `"unsettled"`, and it is polled away rather than treated as a refusal — reading
 * the gap as "this kind is too big" would be the same defect the debounce comment
 * describes, one caller along.
 */
async function settledVerdict(page: Page): Promise<number | null> {
  let verdict: number | null = null;
  await expect
    .poll(
      async () => {
        const text = (await page.locator(CAP).textContent()) ?? "";
        if (text.includes("too many to draw")) {
          verdict = null;
          return "refused";
        }
        const m = /^(\d+)\s+declaration/.exec(text.trim());
        if (m) {
          verdict = Number(m[1]);
          return "drew";
        }
        return "unsettled";
      },
      { timeout: 10_000 },
    )
    .not.toBe("unsettled");
  return verdict;
}

test.describe("overview panel — the picture follows every filter", () => {
  test("a SEARCH narrows the diagram, not only the list", async ({ page }) => {
    await openPanel(page);

    // The unfiltered page is over DIA_MAX and refuses, which is the state
    // that made the old behaviour invisible: nothing moved because nothing
    // was drawn.
    //
    // The query must land well under DIA_MAX. `role` was used until
    // 2026-10-08, when it matched exactly 40 declarations, the limit, so one
    // more schema mentioning a role (`ToolReleaseRoleSchema`, #2505) turned
    // this red with nothing broken. `role-graph` matched 20 when chosen.
    await page.locator("#q").fill("role-graph");
    await expect(page.locator(CAP)).not.toContainText("too many to draw");

    const drawn = await drawnSettled(page);

    // The picture and the list are filtered through ONE predicate, so the
    // number the caption reports is the number the header reports. They
    // drifted precisely because there were two.
    const counts = (await page.locator("#counts").textContent()) ?? "";
    const listed = Number(/(\d+)\s+of\s+\d+\s+declarations/.exec(counts)?.[1]);
    expect(drawn).toBe(listed);
  });

  test("a search EARNS a picture the unfiltered page refuses to draw", async ({ page }) => {
    await openPanel(page);

    // Measured at 842 declarations against DIA_MAX = 40. Asserted as the
    // REFUSAL rather than as a number, so growing the corpus does not redden
    // this and shrinking it below the limit fails loudly instead of passing
    // vacuously.
    await expect(page.locator(CAP)).toContainText("too many to draw");

    await page.locator("#q").fill("workflow");
    await expect(page.locator(CAP)).not.toContainText("too many to draw");
    expect(await drawnSettled(page)).toBeGreaterThan(0);

    // ...and clearing it returns the reader to where they were. `whbf`
    // requires a way back to the static arrangement; this is that, for the
    // filter axis.
    await page.locator("#q").fill("");
    await expect(page.locator(CAP)).toContainText("too many to draw");
  });

  test("the KIND select narrows the diagram too", async ({ page }) => {
    await openPanel(page);
    // NAMES NO KIND, and that is the fix rather than the shortcut.
    //
    // This asserted `zod-enum` on the comment *"measured at 35 in scope — under
    // the limit, so it draws"*. That is a count, and counts grow: regenerating
    // the schema index on 2026-09-27 took `zod-enum` to 41 against `DIA_MAX =
    // 40`, so the kind this test had chosen for being small became one the panel
    // correctly refuses — and the test failed while both the panel and the
    // caption were right.
    //
    // The sibling test above already states the rule this one broke: *"Asserted
    // as the REFUSAL rather than as a number, so growing the corpus does not
    // redden this and shrinking it below the limit fails loudly instead of
    // passing vacuously."* The property here is that SELECTING A KIND NARROWS
    // THE SCOPE — not that any particular kind is small. So it tries each kind
    // and requires that at least one draws.
    //
    // A kind that draws still proves the narrowing: the unfiltered page refuses
    // at 842 declarations, so anything that draws was narrowed to under 40 by
    // the select and nothing else.
    const options = await page.locator("#kind option").evaluateAll((els) =>
      (els as HTMLOptionElement[]).map((e) => e.value).filter((v) => v !== ""),
    );
    expect(options.length, "the kind select offers nothing to narrow BY").toBeGreaterThan(0);

    let drew: { kind: string; count: number } | undefined;
    for (const kind of options) {
      await page.locator("#kind").selectOption(kind);
      // `settledVerdict`, NOT `drawnSettled`: the latter asserts a count and so
      // fails on the first kind that is legitimately too big to draw.
      const n = await settledVerdict(page);
      if (n !== null && n > 0) {
        drew = { kind, count: n };
        break;
      }
    }

    expect(
      drew,
      `no kind narrowed the scope below the diagram limit — tried ${options.length}: ${options.join(", ")}. ` +
        "Either every kind now exceeds DIA_MAX, or the select stopped filtering the picture, and those are " +
        "different defects.",
    ).toBeDefined();
    await expect(page.locator(CAP)).not.toContainText("too many to draw");
  });

  test("an empty result names the FILTER, never the scope", async ({ page }) => {
    await openPanel(page);
    await page.locator("#q").fill("zzzznotathing");

    // The old wording was "Nothing in scope to draw", which was true while
    // only scope and the module select could empty the set. Once a search
    // can, the same words blame the subject for what a filter did.
    await expect(page.locator(CAP)).toContainText("No declaration matches the filters");
    await expect(page.locator(CAP)).not.toContainText("Nothing in scope");
    await expect(page.locator("#ov-svg")).toBeEmpty();
  });
});

test.describe("overview panel — a suppressed relationship is counted, never silent", () => {
  test("two faded boxes with a hidden edge between them are REPORTED", async ({ page }) => {
    await openPanel(page);

    // Context-to-context edges are dropped by design: the picture is about
    // the filter, not its surroundings. But both endpoints are DRAWN, so an
    // unreported drop tells the reader these two are unrelated — a false
    // statement the picture makes silently.
    //
    // Driven through the module select, because that is where the loss
    // actually occurs: 15 summed across 79 module filters, 0 across eight
    // sample searches. No fixed count is asserted — the corpus moves — only
    // that the loss happens somewhere and is reported where it does.
    const mods = await page.locator("#mod option").count();
    expect(mods).toBeGreaterThan(1);

    let sawSuppression = false;
    for (let i = 1; i < Math.min(mods, 40); i++) {
      const value = await page.locator("#mod option").nth(i).getAttribute("value");
      if (!value) continue;
      await page.locator("#mod").selectOption(value);
      const text = (await page.locator(CAP).textContent()) ?? "";
      if (text.includes("are not drawn, because")) {
        expect(text).toMatch(/\d+\s+relationship\(s\) BETWEEN two faded boxes/);
        // The point of the clause: it says a missing line is not a missing
        // relationship.
        expect(text).toContain("never mistaken for a missing relationship");
        sawSuppression = true;
        break;
      }
    }
    // ASSERTED TO OCCUR, and the first draft of this line did not: it read
    // `expect(typeof sawSuppression).toBe("boolean")`, which is true whether
    // the loop found anything or nothing. A check that passes over an empty
    // examination is the `dh4f` shape — a consumer that scans nothing and
    // reports a clean run — and writing one INTO the test for the
    // count-it-rather-than-drop-it contract would have been the same defect
    // one level up.
    //
    // The basis for asserting it rather than tolerating zero: measured at 15
    // summed across the 79 module filters over the committed projection of
    // 842 declarations and 525 edges. A margin wide enough that a drop to
    // zero means the
    // context mechanism changed, which is worth a red test and a look, not a
    // silent pass.
    expect(sawSuppression, "no module filter suppressed a context-to-context edge").toBe(true);
  });
});

test.describe("overview panel — drivable without a mouse", () => {
  // `gjli` is a standing rule here and it is load-bearing rather than
  // boilerplate: this layer's declared interaction profile is
  // low-dexterity, so a control that needs precise pointing is unusable by
  // the person the page is built for. A filter that only a mouse can reach
  // would have made the picture follow the list for everyone except them.
  test("the filters and the panel are reachable and operable by keyboard", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator("#counts")).toContainText("declarations");

    // The panel opens from the keyboard: <summary> is focusable and Enter
    // toggles it. A <details> replaced by a div+click handler would fail
    // here, which is the `l4zi`/bare-<circle> shape one element up.
    await page.locator("#overview > summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#overview")).toHaveAttribute("open", "");

    // Typing into the search — no pointer — must move the picture.
    await page.locator("#q").focus();
    await expect(page.locator("#q")).toBeFocused();
    await page.keyboard.type("workflow");
    await expect(page.locator(CAP)).not.toContainText("too many to draw");

    // And the way back is reachable the same way.
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await expect(page.locator(CAP)).toContainText("too many to draw");
  });

  test("every filter control carries an accessible name", async ({ page }) => {
    await page.goto(PAGE);
    // The search field's name came from a placeholder once, which vanishes on
    // input — the `gjli` finding (3). These are asserted rather than trusted.
    for (const id of ["#q", "#kind", "#mod"]) {
      const el = page.locator(id);
      const label = await el.getAttribute("aria-label");
      expect(label, `${id} has no accessible name`).toBeTruthy();
      expect(label!.length).toBeGreaterThan(3);
    }
  });
});
