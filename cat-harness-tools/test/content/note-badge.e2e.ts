/**
 * A badge that can disagree with its own panel is the defect to design out.
 *
 * Bean `folio-assistant-1rta`, R5 + R6 of issue #602.
 *
 * ## Why this file exists when the behaviour was already right
 *
 * R6 — *the badge's count SHALL be the cardinality of the query the panel
 * renders* — was **already true** in `mountPageStickies` and protected by
 * nothing. It is a regression requirement: it needed a test, not an
 * implementation. The implementation moved one step further while this was
 * written, so the count is now read off the panel's own children and there is
 * no second number to go out of step.
 *
 * ## The trap this file is built to avoid
 *
 * *"A test that FAILS if the count is computed from anything but the rendered
 * set"* is not the same test as "the badge says 2 and the panel has 2 items".
 * The second passes for two independent computations that happen to agree, and
 * agreeing is what they do until the day they do not.
 *
 * So the fixture is built so that a DECOUPLED implementation would give a
 * different number:
 *
 * - `sec:one` has TWO attached notes and one SECONDARY (`alsoAbout`). A count
 *   over "notes mentioning this label" says 3; the panel renders 2.
 * - `sec:two` has a note that is attached here AND names itself in
 *   `alsoAbout`. A union says 2; the panel renders 1.
 * - `sec:three` has three attached notes and one secondary. A union says 4.
 *
 * A page with no secondaries at all would pass for an implementation that
 * counted them, which is why every block here has one.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { badgeAt, notesAt } from "../../schemas/ui/note-anchor.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const base = {
  comment: "",
  status: "open",
  priority: "high",
  origin: "agent",
  createdAt: "2026-09-19",
  tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
  relations: [],
};

const NOTES = [
  // sec:one — one attached, one secondary pointing here from elsewhere.
  { ...base, id: "n1", summary: "Attached to one", targetLabel: "sec:one" },
  {
    ...base,
    id: "n2",
    summary: "Lives on three, also about one",
    targetLabel: "sec:three",
    alsoAbout: [{ kind: "block", label: "sec:one" }],
  },
  // sec:two — one attached note that also names ITSELF. The stronger relation
  // wins and it is counted once.
  {
    ...base,
    id: "n3",
    summary: "Attached to two, and says so twice",
    targetLabel: "sec:two",
    alsoAbout: [{ kind: "block", label: "sec:two" }],
  },
  // sec:three — three attached (n2 above plus these two), one secondary.
  { ...base, id: "n4", summary: "Attached to three", targetLabel: "sec:three" },
  { ...base, id: "n5", summary: "Also attached to three", targetLabel: "sec:three" },
  {
    ...base,
    id: "n6",
    summary: "Lives on one, also about three",
    targetLabel: "sec:one",
    alsoAbout: [{ kind: "block", label: "sec:three" }],
  },
];

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="fa-todo-src" content="/assets/todos/index.json">
<style>${CSS}</style></head><body>
<div class="main-content-wrap"><div class="main-content" id="main-content">
  <h2 id="one" data-fa-label="sec:one">One</h2><p>Body.</p>
  <h2 id="two" data-fa-label="sec:two">Two</h2><p>Body.</p>
  <h2 id="three" data-fa-label="sec:three">Three</h2><p>Body.</p>
  <h2 id="four" data-fa-label="sec:four">Four</h2><p>Body.</p>
</div></div>
<script>${JS}</script></body></html>`;

const URL_PAGE = "http://badge.test/page.html";

test.beforeEach(async ({ page }) => {
  await page.route("http://badge.test/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/page.html")) {
      return route.fulfill({ contentType: "text/html", body: PAGE });
    }
    if (url.endsWith("/assets/todos/index.json")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ $schema: "folio-todo-index/v1", items: NOTES }),
      });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
});

/** Every badge on the page, with its own panel's rendered cardinality. */
async function badges(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".fa-sticky-inline")].map((host) => {
      const badge = host.querySelector(".fa-sticky-badge") as HTMLElement;
      const panel = host.nextElementSibling as HTMLElement;
      const chip = badge.querySelector(".fa-sticky-badge-count");
      return {
        label: (host.previousElementSibling as HTMLElement).dataset.faLabel ?? "",
        declared: Number(badge.dataset.faNotes),
        rendered: panel.children.length,
        chip: chip ? chip.textContent : null,
        aria: badge.getAttribute("aria-label"),
        alsoAbout: Number(host.dataset.faAlsoAbout),
      };
    }),
  );
}

test.describe("R6 — the count IS the panel's cardinality", () => {
  test("for every badge on the page, and the page is built so a decoupled count would differ", async ({ page }) => {
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    const rows = await badges(page);
    expect(rows.length).toBe(3);
    for (const r of rows) {
      expect(r.declared, `badge at ${r.label} declares its own number`).toBe(r.rendered);
    }
    // And the numbers are the ATTACHED counts, not the unions. Named here so a
    // future reader can see the decoupled answers this rules out: 3, 2, 4.
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.rendered]));
    expect(byLabel).toEqual({ "sec:one": 2, "sec:two": 1, "sec:three": 3 });
  });

  test("the rendered chip never disagrees with the panel either", async ({ page }) => {
    // `data-fa-notes` and the chip are two surfaces of one number, and only
    // one of them is what a reader sees.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    for (const r of await badges(page)) {
      if (r.rendered > 1) expect(r.chip).toBe(String(r.rendered));
      else expect(r.chip).toBeNull();
    }
  });

  test("the browser's answer is the MODEL's answer — `badgeAt` agrees case for case", async ({ page }) => {
    // The client cannot import `note-anchor.ts`, so the two implementations
    // can drift. This is the join: the same fixture through the model, checked
    // against what the page rendered.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    const rows = await badges(page);
    for (const r of rows) {
      const model = badgeAt(NOTES, r.label);
      expect(model.count, `model count at ${r.label}`).toBe(r.rendered);
      expect(model.showCount, `model threshold at ${r.label}`).toBe(r.chip !== null);
      expect(notesAt(NOTES, r.label).alsoAbout.length).toBe(r.alsoAbout);
    }
  });
});

test.describe("R5 — a count only above one", () => {
  test("one note gets the icon and no number", async ({ page }) => {
    // `sec:two` is the single-note block — and it is single only because the
    // note naming its own label is counted once. A decoupled union would put
    // a "2" here.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    const two = page.locator('[data-fa-label="sec:two"] + .fa-sticky-inline .fa-sticky-badge');
    await expect(two.locator(".fa-sticky-badge-count")).toHaveCount(0);
    await expect(two).toHaveAttribute("aria-label", "1 note on this section");
  });

  test("three notes get the number, and the accessible name is exact", async ({ page }) => {
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    const three = page.locator('[data-fa-label="sec:three"] + .fa-sticky-inline .fa-sticky-badge');
    await expect(three.locator(".fa-sticky-badge-count")).toHaveText("3");
    await expect(three).toHaveAttribute("aria-label", "3 notes on this section");
  });

  test("the accessible name carries the exact number even when the chip does not", async ({ page }) => {
    // The threshold is a DENSITY decision about the visual. A screen-reader
    // user hearing "a note is here" where a sighted reader sees a count would
    // be told less, and this is the assertion that keeps that from happening
    // quietly.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    for (const r of await badges(page)) {
      expect(r.aria).toBe(`${r.rendered} ${r.rendered === 1 ? "note" : "notes"} on this section`);
    }
  });
});

test.describe("secondaries do not inflate the badge", () => {
  test("a block WITH a secondary still counts only what is attached", async ({ page }) => {
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    const rows = await badges(page);
    const one = rows.find((r) => r.label === "sec:one");
    // The secondary is PRESENT — without this the assertion below would pass
    // for a page that simply had none, which is the vacuous version.
    expect(one?.alsoAbout).toBe(1);
    // Two attached, not three: the secondary is at this label and is not in
    // the panel, so it is not in the count.
    expect(one?.rendered).toBe(2);
  });

  test("a note that names its OWN label is counted once, as attached", async ({ page }) => {
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    const two = (await badges(page)).find((r) => r.label === "sec:two");
    expect(two?.rendered).toBe(1);
    // The stronger relation wins, so it does not also appear as a secondary.
    expect(two?.alsoAbout).toBe(0);
  });

  test("a block with only secondaries gets no badge at all", async ({ page }) => {
    // `sec:four` is named by nothing; the nearest live case is that a label
    // reached ONLY by `alsoAbout` must not grow a panel, because there is
    // nothing attached to put in it.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    await expect(
      page.locator('[data-fa-label="sec:four"] + .fa-sticky-inline'),
    ).toHaveCount(0);
  });
});

test.describe("R17 — a scheme a link may not carry never reaches an `href`", () => {
  /** The same notes, with one relation carrying a scheme the renderer refuses. */
  const HOSTILE = [
    {
      ...base,
      id: "n7",
      summary: "Attached to four",
      targetLabel: "sec:four",
      relations: [
        { axis: "bean", label: "safe", href: "https://example.invalid/ok" },
        { axis: "bean", label: "hostile", href: "javascript:alert(1)" },
        // The classic bypass: the URL parser removes the tab before parsing.
        { axis: "bean", label: "sneaky", href: "java\tscript:alert(1)" },
      ],
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route("http://badge.test/assets/todos/index.json", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ $schema: "folio-todo-index/v1", items: HOSTILE }),
      }),
    );
  });

  test("the allowed relation is a link and the refused ones are not", async ({ page }) => {
    // `TodoRelationSchema.href` is `z.string()`, so the schema permits both.
    // The renderer is where the difference is made.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    await page.locator(".fa-sticky-badge").first().click();
    // A SET, because the board and the inline panel each render the note, so
    // the same allowed link appears twice. What matters is which values reach
    // an href at all, not how many surfaces show them.
    const hrefs = await page
      .locator(".fa-sticky-rel-link")
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect([...new Set(hrefs)]).toEqual(["https://example.invalid/ok"]);
  });

  test("a refused relation is still SHOWN, as text", async ({ page }) => {
    // `pb04` both ways: the edge exists and the reader should see it; what it
    // must not be is a link that executes.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    await page.locator(".fa-sticky-badge").first().click();
    // Asserted STRUCTURALLY rather than by visibility: the same note is
    // rendered on two surfaces and one of them is collapsed, so "is it
    // visible" answers about a surface rather than about the relation.
    const dangling = await page
      .locator(".fa-sticky-rel-dangling")
      .evaluateAll((els) => els.map((e) => e.textContent));
    expect(new Set(dangling)).toEqual(new Set(["hostile", "sneaky"]));
  });

  test("and the reason SAYS which — refused is not the same as unresolved", async ({ page }) => {
    // Two different facts: the edge resolved to nothing, or it carries a
    // scheme a link may not carry. Saying the first about the second would be
    // wrong in the direction that hides a hostile value as a missing one.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    await page.locator(".fa-sticky-badge").first().click();
    const titles = await page
      .locator(".fa-sticky-rel-dangling")
      .evaluateAll((els) => els.map((e) => e.getAttribute("title")));
    for (const t of titles) expect(t).toContain("a scheme a link may not carry");
  });

  test("no element anywhere on the page carries a javascript: href", async ({ page }) => {
    // The broad sweep, because the assertions above only cover the elements
    // they name and the next `href` is the one nobody thought to check.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    await page.locator(".fa-sticky-badge").first().click();
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll("[href]")]
        .map((e) => e.getAttribute("href") ?? "")
        .filter((h) => /^\s*[\u0000- ]*j[\u0009\u000A\u000D]*a/i.test(h.replace(/[\u0009\u000A\u000D]/g, ""))
          && /^javascript:/i.test(h.replace(/[\u0009\u000A\u000D]/g, "").trim())),
    );
    expect(bad).toEqual([]);
  });

  test("and none carries the string `undefined` either", async ({ page }) => {
    // `setAttribute(k, undefined)` writes "undefined", which is a relative
    // link to a page called `undefined` — a link to somewhere wrong rather
    // than no link. `el()` now drops an absent value instead.
    await page.goto(URL_PAGE);
    await page.waitForSelector(".fa-sticky-badge");
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("[href]")].map((e) => e.getAttribute("href")),
    );
    expect(hrefs).not.toContain("undefined");
  });
});
