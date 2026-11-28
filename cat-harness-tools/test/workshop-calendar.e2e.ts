import { test, expect, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * THE TWO DAYS, AS A CALENDAR — owner, 2026-11-18. A workshop's overview drew
 * its whole Markdown description (introduction and both days' timetable) as
 * one `<h2>`, and the side-by-side calendar of the policy and technical
 * tracks was gone. The overview now carries one sentence in its hero, with no
 * Markdown, and the calendar as a table per day (merged cells across both
 * tracks, rowspan so times line up), on both tracks' overviews, stacking per day on a phone,
 * and the room's country names reach it.
 *
 * The pages are drawn by `workshop-calendar-fixture.build.ts` with the REAL
 * journeys viewer.
 */

let SITE = "";
let PATHS = { techOverview: "", policyOverview: "", techPage: "", policyPage: "" };
test.beforeAll(() => {
  const out = mkdtempSync(join(tmpdir(), "workshop-calendar-"));
  execFileSync("bun", ["run", fileURLToPath(new URL("./workshop-calendar-fixture.build.ts", import.meta.url)), out], { stdio: "pipe" });
  SITE = join(out, "site");
  PATHS = JSON.parse(readFileSync(join(SITE, "paths.json"), "utf8"));
});

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

async function serve(context: BrowserContext): Promise<void> {
  await context.route("http://site.test/**", (route) => {
    let p = join(SITE, decodeURIComponent(new URL(route.request().url()).pathname));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
    if (!existsSync(p)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[extname(p)] ?? "application/octet-stream", body: readFileSync(p) });
  });
}

test.describe("a workshop's overview: one sentence in the hero, and the days as a calendar", () => {
  test.beforeEach(async ({ context }) => serve(context));

  test("the hero is one sentence, no Markdown, at most about three lines; no heading holds the description", async ({ page }) => {
    for (const p of [PATHS.techOverview, PATHS.policyOverview]) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`http://site.test/${p}`);
      const hero = page.locator(".jp-hero h2");
      const text = (await hero.textContent()) ?? "";
      expect(text).not.toMatch(/##|\]\(|\|/);
      const lines = await hero.evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
      expect(lines).toBeLessThanOrEqual(3.2);
      for (const h of await page.locator("h2").all()) {
        const t = (await h.textContent()) ?? "";
        expect(t.length, `a heading of ${t.length} characters: ${t.slice(0, 80)}…`).toBeLessThan(200);
        expect((await h.getAttribute("id"))?.length ?? 0).toBeLessThan(120);
      }
    }
    await page.goto(`http://site.test/${PATHS.techOverview}`);
    await expect(page.locator(".jp-hero h2")).toHaveText("The technical track of a general two-day workshop, taught from the journey of one family in Taifafeki.");
  });

  test("the calendar is a table per day: tracks side by side, joint rows across both, long blocks rowspan", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`http://site.test/${PATHS.techOverview}`);
    const cal = page.locator(".jv-cal");
    await expect(cal.getByRole("heading", { name: "The two days" })).toBeVisible();
    const day1 = cal.getByRole("table", { name: /Day 1/ });
    await expect(day1).toBeVisible();
    await expect(day1.getByRole("columnheader")).toHaveText(["Time", "Policy track", "Technical track"]);
    await expect(day1.getByRole("rowheader").first()).toHaveText("08:30");
    await expect(day1.locator("td.jv-cal-joint")).toHaveAttribute("colspan", "2");
    await expect(day1.locator("td.jv-cal-break")).toHaveAttribute("colspan", "2");
    const m1cell = day1.locator("td.jv-cal-session", { hasText: "M1" });
    await expect(m1cell).toHaveAttribute("rowspan", "2");
    const m1 = await m1cell.boundingBox();
    const t1 = await day1.locator("td.jv-cal-session", { hasText: "T1" }).boundingBox();
    const t2 = await day1.locator("td.jv-cal-session", { hasText: "T2" }).boundingBox();
    const joint = await day1.locator("td.jv-cal-joint").boundingBox();
    // Side by side: the same top, the policy track to the left; M1 runs the length of T1 and T2.
    expect(Math.abs(m1!.y - t1!.y)).toBeLessThan(2);
    expect(m1!.x + m1!.width).toBeLessThanOrEqual(t1!.x);
    expect(Math.abs(m1!.y + m1!.height - (t2!.y + t2!.height))).toBeLessThan(2);
    // The joint session spans both columns.
    expect(joint!.x).toBeLessThanOrEqual(m1!.x + 1);
    expect(joint!.x + joint!.width).toBeGreaterThanOrEqual(t1!.x + t1!.width - 1);
    await expect(day1.locator(".jv-cal-joint .jv-cal-parts li")).toHaveText(["P1.1 Welcome", "P1.4 Country panel: Taifafeki"]);
  });

  test("each module links to its page in its own track's workshop", async ({ page }) => {
    await page.goto(`http://site.test/${PATHS.techOverview}`);
    await page.locator(".jv-cal a.jv-cal-code", { hasText: "M1" }).click();
    await expect(page).toHaveURL(new RegExp(`${PATHS.policyPage}m1/$`));
    await page.goto(`http://site.test/${PATHS.policyOverview}`);
    await page.locator(".jv-cal a.jv-cal-code", { hasText: "T1" }).first().click();
    await expect(page).toHaveURL(new RegExp(`${PATHS.techPage}t1/$`));
  });

  test("the policy track, which holds no schedule, shows the same calendar on its overview and its page", async ({ page }) => {
    for (const p of [PATHS.policyOverview, PATHS.policyPage]) {
      await page.goto(`http://site.test/${p}`);
      await expect(page.locator(".jv-cal table.jv-cal-day")).toHaveCount(2);
      await expect(page.locator(".jv-cal-session.is-here", { hasText: "M1" })).toHaveCount(1);
    }
  });

  test("on a phone each day stacks into one column, in time order, each slot saying its track", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://site.test/${PATHS.techOverview}`);
    const day1 = page.locator(".jv-cal-day").first();
    await expect(day1).toHaveCSS("display", "block");
    await expect(day1.locator("thead")).toBeHidden();
    await expect(day1.locator(".jv-cal-session", { hasText: "M1" }).locator(".jv-cal-where")).toHaveText("Policy track");
    const ys = await day1.locator("td.jv-cal-slot").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().y));
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test("a room's name for a country reaches the calendar", async ({ page }) => {
    await page.goto(`http://site.test/${PATHS.techOverview}`);
    await page.locator('input[data-jp-country="Taifafeki"]').fill("Kenya");
    await page.reload();
    await expect(page.locator(".jv-cal-parts")).toContainText("P1.4 Country panel: Kenya");
    await expect(page.locator(".jv-cal-sum").first()).toContainText("a country panel from Kenya");
  });
});
