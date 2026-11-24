import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * The kind fan — the owner picked all three of fan, autoplaying fade, and
 * fade on hover, and they layer rather than conflict.
 *
 * Bean `folio-assistant-4kj4`.
 *
 * ## What is asserted, and why each of it
 *
 * **The fan is complete when still.** That is the property that makes an
 * autoplaying loop defensible at all — not the pause button. A reader who
 * never sees the motion must lose nothing, so every kind is present and the
 * accessible name lists all of them in one string. A cycling BADGE would
 * have failed that however many pause controls it carried.
 *
 * **Reduced motion is checked in both places.** The script must not start
 * the timer and the stylesheet must not transition. Either alone is a bug,
 * and only an e2e run with the media emulated can tell.
 *
 * **The panel shows DECLARED kinds.** The owner was explicit — "not
 * inheritance" — and the distinction is invisible from the list itself, so
 * the panel says it in words.
 */

const ROOT = join(HARNESS_ROOT);
const CSS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/docs-ui.css"))), "utf8");
const AVATARS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/css/avatars.css"))), "utf8");
const JS = readFileSync(overlayPath(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"))), "utf8");

const KINDS = ["beans", "qa", "schemas", "tools"];

/** NO BACKTICKS INSIDE — the whole page is one template literal. */
function harness(kinds: string[] | null): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <style>${CSS}${AVATARS}</style></head><body>
  ${kinds === null ? "" : `<script type="application/json" id="fa-declared-kinds">${JSON.stringify(kinds)}<\/script>`}
  <div class="side-bar">
    <div class="site-header"><a class="site-title">folio-assistant</a></div>
    <nav class="site-nav"><a href="#">Home</a></nav>
  </div>
  <div class="main"><div class="main-header"></div><div class="main-content"><h1>x</h1></div></div>
  <script>window.jtd = { theme: "dark",
    getTheme: function () { return this.theme; },
    setTheme: function (t) { this.theme = t; } };<\/script>
  <script>${JS}<\/script>
</body></html>`;
}

type Page = import("@playwright/test").Page;

async function openSettings(page: Page): Promise<void> {
  await page.locator(".fa-tiles-toggle").click();
  await page.locator('.fa-tiles-grid .fa-tile:has(.fa-tile-caption:text-is("Page settings"))').click();
}

test.describe("the fan is complete when it is still", () => {
  test("every declared kind is present at once, not one at a time", async ({ page }) => {
    // The property the whole design rests on. A badge that swapped one slot
    // would convey its content ONLY through motion, and no pause control
    // fixes that.
    await page.setContent(harness(KINDS));
    await openSettings(page);
    await expect(page.locator(".fa-kind-fan-slot")).toHaveCount(KINDS.length);
    for (const kind of KINDS) {
      await expect(page.locator(`.fa-kind-fan-slot[data-fa-kind-slot="${kind}"]`)).toHaveCount(1);
    }
  });

  test("the accessible name lists every kind, so the cycle conveys nothing extra", async ({ page }) => {
    await page.setContent(harness(KINDS));
    await openSettings(page);
    const name = (await page.locator(".fa-kind-fan").getAttribute("aria-label")) ?? "";
    for (const kind of KINDS) expect(name).toContain(kind);
  });

  test("the tiles are aria-hidden — the group carries the name, not 4 images", async ({ page }) => {
    // Four focusable images would be four stops to learn one fact.
    await page.setContent(harness(KINDS));
    await openSettings(page);
    const tiles = page.locator(".fa-kind-fan .fa-avatar");
    await expect(tiles).toHaveCount(KINDS.length);
    for (let i = 0; i < KINDS.length; i++) {
      await expect(tiles.nth(i)).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("an instance that declares nothing gets no control, not an empty one", async ({ page }) => {
    await page.setContent(harness([]));
    await openSettings(page);
    await expect(page.locator(".fa-kind-fan-open")).toHaveCount(0);
  });

  test("a page that never said gets no control either", async ({ page }) => {
    await page.setContent(harness(null));
    await openSettings(page);
    await expect(page.locator(".fa-kind-fan-open")).toHaveCount(0);
  });
});

test.describe("the cycle, and WCAG 2.2.2", () => {
  test("it autoplays, and the highlight actually moves", async ({ page }) => {
    await page.setContent(harness(KINDS));
    await openSettings(page);
    const fan = page.locator(".fa-kind-fan");
    await expect(fan).toHaveAttribute("data-fa-cycling", "true");
    const first = await page.locator('.fa-kind-fan-slot[data-fa-lit="true"]').getAttribute("data-fa-kind-slot");
    // Longer than one interval, so this measures the loop rather than a race.
    await page.waitForTimeout(2600);
    const later = await page.locator('.fa-kind-fan-slot[data-fa-lit="true"]').getAttribute("data-fa-kind-slot");
    expect(later).not.toBe(first);
  });

  test("the pause control stops it, and says so", async ({ page }) => {
    await page.setContent(harness(KINDS));
    await openSettings(page);
    const pause = page.locator(".fa-kind-fan-pause");
    await expect(pause).toHaveAttribute("aria-label", "Pause the cycling highlight");
    await pause.click();
    await expect(page.locator(".fa-kind-fan")).toHaveAttribute("data-fa-cycling", "false");
    // The NAME changes, not only the glyph: a control whose state is carried
    // by its icon alone is mute to a screen reader.
    await expect(pause).toHaveAttribute("aria-label", "Resume the cycling highlight");

    const held = await page.locator('.fa-kind-fan-slot[data-fa-lit="true"]').getAttribute("data-fa-kind-slot");
    await page.waitForTimeout(2600);
    expect(
      await page.locator('.fa-kind-fan-slot[data-fa-lit="true"]').getAttribute("data-fa-kind-slot"),
    ).toBe(held);
  });

  test("pausing and resuming both work — it is a toggle, not a stop", async ({ page }) => {
    await page.setContent(harness(KINDS));
    await openSettings(page);
    const pause = page.locator(".fa-kind-fan-pause");
    await pause.click();
    await pause.click();
    await expect(page.locator(".fa-kind-fan")).toHaveAttribute("data-fa-cycling", "true");
  });

  test("ONE kind gets no pause control — there is nothing to pause", async ({ page }) => {
    // A button saying "pause" beside something already still tells a reader
    // there is motion they cannot see.
    await page.setContent(harness(["beans"]));
    await openSettings(page);
    await expect(page.locator(".fa-kind-fan-slot")).toHaveCount(1);
    await expect(page.locator(".fa-kind-fan-pause")).toHaveCount(0);
  });
});

test.describe("prefers-reduced-motion is honoured in BOTH places", () => {
  /**
   * `page.emulateMedia`, not `test.use({ reducedMotion })`.
   *
   * MEASURED: with `test.use` inside this describe, `matchMedia(...).matches`
   * read **false** in the page — the fixture did not reach it, and all three
   * tests below failed against code that was in fact correct. A spec that
   * cannot establish its own precondition is worse than no spec: it reports
   * a defect in the subject when the defect is in the harness.
   *
   * `emulateMedia` is also the honest shape here, because ORDER matters: the
   * script reads the query when it mounts, so the emulation has to be in
   * place before `setContent`. A fixture hides that; this states it.
   */
  test("the timer never starts, and no pause control is offered", async ({ page }) => {
    // Script half. A pause button under reduced motion would be a control
    // for an animation that is not running.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setContent(harness(KINDS));
    await openSettings(page);
    await expect(page.locator(".fa-kind-fan-slot")).toHaveCount(KINDS.length);
    await expect(page.locator(".fa-kind-fan")).not.toHaveAttribute("data-fa-cycling", "true");
    await expect(page.locator(".fa-kind-fan-pause")).toHaveCount(0);
  });

  test("nothing moves over a full cycle's worth of time", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setContent(harness(KINDS));
    await openSettings(page);
    const before = await page.locator(".fa-kind-fan-strip").innerHTML();
    await page.waitForTimeout(2600);
    expect(await page.locator(".fa-kind-fan-strip").innerHTML()).toBe(before);
  });

  test("and every kind is at full strength, since nothing will highlight them", async ({ page }) => {
    // CSS half. Without it the fan sits permanently dimmed at the opacity
    // that only made sense as the unlit half of a highlight.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setContent(harness(KINDS));
    await openSettings(page);
    const slot = page.locator(".fa-kind-fan-slot").first();
    await expect(slot).toHaveCSS("opacity", "1");
    // The PROPERTY — effectively no transition — not the literal "0s".
    // Chromium reports `1e-06s` under this emulation rather than `0s`, and
    // an exact-string assertion failed on code that was correct. What
    // matters is that it is not the 0.4s the animated path uses, which is
    // what a pre-fix run actually reported.
    const durations = await slot.evaluate((e) =>
      getComputedStyle(e).transitionDuration.split(",").map((d) => parseFloat(d)),
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) expect(d).toBeLessThan(0.05);
  });

  test("turning it on MID-SESSION stops the loop, without a reload", async ({ page }) => {
    // The live listener. A reader who changes the setting while the page is
    // open should be heard then, not on their next navigation — and this is
    // the half a `test.use` fixture could not have exercised at all.
    await page.setContent(harness(KINDS));
    await openSettings(page);
    await expect(page.locator(".fa-kind-fan")).toHaveAttribute("data-fa-cycling", "true");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".fa-kind-fan")).toHaveAttribute("data-fa-cycling", "false");
    // The pause control goes too: there is no longer anything to pause.
    await expect(page.locator(".fa-kind-fan-pause")).toHaveCount(0);
  });
});

test.describe("the fan opens a PANEL, showing declared kinds", () => {
  test("pressing it lists every kind by name", async ({ page }) => {
    // Owner: "openning fan is panel". The fan gives them a face; the panel
    // says which they are, because most readers cannot tell a spanner from
    // a shield at 24px.
    await page.setContent(harness(KINDS));
    await openSettings(page);
    await page.locator(".fa-kind-fan-open").click();
    const rows = page.locator(".fa-kinds-row");
    await expect(rows).toHaveCount(KINDS.length);
    for (const kind of KINDS) {
      await expect(page.locator(".fa-kinds-name", { hasText: new RegExp(`^${kind}$`) })).toHaveCount(1);
    }
  });

  test("it says DECLARED, not inherited — the distinction is invisible otherwise", async ({ page }) => {
    await page.setContent(harness(KINDS));
    await openSettings(page);
    await page.locator(".fa-kind-fan-open").click();
    await expect(page.locator(".fa-kinds-note")).toContainText("declares in its own harness");
    await expect(page.locator(".fa-kinds-note")).toContainText("inherited");
  });

  test("each kind is shown in AND out of the trash, side by side", async ({ page }) => {
    // The owner asked for both states. Shown apart nobody can tell muted
    // from a different colour, so the pair is only legible as a pair.
    await page.setContent(harness(KINDS));
    await openSettings(page);
    await page.locator(".fa-kind-fan-open").click();
    const row = page.locator(".fa-kinds-row").first();
    await expect(row.locator('.fa-avatar:not([data-fa-trash])')).toHaveCount(1);
    await expect(row.locator('.fa-avatar[data-fa-trash="true"]')).toHaveCount(1);
    await expect(page.locator(".fa-kinds-legend")).toContainText("discarded");
  });

  test("the control names the COUNT, not the picture", async ({ page }) => {
    await page.setContent(harness(KINDS));
    await openSettings(page);
    await expect(page.locator(".fa-kind-fan-open")).toHaveAttribute(
      "aria-label", "What this instance declares — 4 kinds");
  });

  test("one kind reads as \"1 kind\"", async ({ page }) => {
    await page.setContent(harness(["beans"]));
    await openSettings(page);
    await expect(page.locator(".fa-kind-fan-open")).toHaveAttribute(
      "aria-label", "What this instance declares — 1 kind");
  });
});

test.describe("the avatars actually render", () => {
  test("each kind gets a DIFFERENT mask, not the same box", async ({ page }) => {
    // The failure this catches: an unescaped data URI truncates and every
    // avatar renders as nothing, identically, in every scheme.
    await page.setContent(harness(KINDS));
    await openSettings(page);
    const masks = await page.locator(".fa-kind-fan .fa-avatar").evaluateAll((els) =>
      els.map((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage),
    );
    expect(masks).toHaveLength(KINDS.length);
    for (const m of masks) expect(m).toContain("svg");
    expect(new Set(masks).size).toBe(KINDS.length);
  });

  test("an unknown kind still renders — the generic mark, not a blank", async ({ page }) => {
    await page.setContent(harness(["no-such-kind"]));
    await openSettings(page);
    const mask = await page
      .locator(".fa-kind-fan .fa-avatar")
      .evaluate((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage);
    expect(mask).toContain("svg");
    expect(mask).not.toBe("none");
  });
});
