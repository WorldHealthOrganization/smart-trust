import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

import { layerRootsIn, readDeclaration, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { serveThemed, type Scheme } from "../support/themed-page.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { declaredPageUrl } from "../support/site-pages.ts";

/**
 * A scoped library viewer renders ITS SUBJECT's entries.
 *
 * ## Why this exists — the absence of it let a false finding stand
 *
 * Bean `yag0` reported `/cat-harness/library/who-iris/` as "a shell" holding
 * none of who-iris's three corpus entries. It was wrong, and it was wrong in a
 * way nothing could catch: the finding came from grepping the COMMITTED HTML
 * for the entry names, and this viewer is **client-rendered** — it fetches
 * `assets/library/index.json` at runtime and filters by
 * `inScope(x) { return !SCOPE || x.instance === SCOPE }`. The names are
 * necessarily absent from the static file whether the page works or not, so
 * that test could not have returned anything else.
 *
 * The inverse is the reason to keep this: a viewer that genuinely rendered
 * nothing — a broken `DATA_HREF`, a `SCOPE` that matches no `instance`, a 404
 * on the data — would pass every existing gate. `gen-library-viz.ts` exits
 * clean and reports the subject pages it wrote; writing a page is not the same
 * as that page having content, and nothing asserted the second.
 *
 * ## What it asserts, and what it deliberately does not
 *
 * ## The expectations come from the DECLARATIONS, never from the viewer's data
 *
 * The first version of this test derived the subjects it checked from
 * `assets/library/index.json` — the viewer's own data. It passed against a
 * fixture with who-iris's entries deliberately removed, because deleting a
 * subject's entries also deleted the assertion about them: no key, no loop
 * iteration, green.
 *
 * That is the defect it is written against, one level up — a check that learns
 * its expectations from the artefact it audits reports a clean run over a loss.
 * So the subjects come from the repository: every instance declaring a
 * `library` graph whose directory actually holds entry directories. That list
 * cannot be emptied by the failure being looked for.
 *
 * `pageerror` and console errors are listened for, per `rendered-verification`
 * §"Listen for `pageerror`, or a crash reads as a missing feature": a viewer
 * that throws before rendering looks identical to one with nothing to show.
 */
// The repo root, served by `test-server.mjs` on 8080 — the same surface every
// other e2e here uses, so this needs no site build. The viewer's own
// `DATA_HREF` is RELATIVE (`../../../assets/library/index.json`), so it
// resolves correctly under this prefix exactly as it does under the published
// one; that is what makes testing the committed tree legitimate here.
const SITE = process.env.FA_SITE_URL ?? "http://127.0.0.1:8080";
const DOCS = "/cat-harness/docs";
// `import.meta.dir` is a Bun extension and is undefined under Node, which is
// what Playwright runs on — `action-tiles.e2e.ts` carries the same note, and
// this file cost a run by not reading it first.
const REPO = join(dirname(HARNESS_ROOT));
const HARNESS = join(REPO, "cat-harness");

/**
 * The library pages are THEMED since 2026-10-07: the committed file is front
 * matter and a Liquid-raw body, so it is served in a stand-in for the layout
 * (`support/themed-page.ts`) at its own path. Its data and assets still come
 * off the server, relative to that path, as on the published site.
 */
async function themed(page: Page, scheme: Scheme = "dark"): Promise<void> {
  await serveThemed(page, { fsRoot: join(HARNESS, siteDirFor(HARNESS)), urlPrefix: `${DOCS}/`, scheme });
}

/**
 * Subjects that MUST appear, read from the declarations rather than the data.
 *
 * An instance qualifies when it declares a `library` graph and that directory
 * holds at least one subdirectory — `library-graph.ts`'s own rule is that every
 * DIRECTORY under a library graph is a corpus entry and loose files are not.
 */
function declaredLibrarySubjects(): { name: string; entries: string[] }[] {
  const out: { name: string; entries: string[] }[] = [];
  for (const root of layerRootsIn(REPO)) {
    let decl;
    try {
      decl = readDeclaration(root);
    } catch {
      continue; // an unreadable declaration is check:declaration-filename's to report
    }
    if (decl?.name === undefined) continue;
    for (const dir of decl.directories ?? []) {
      if (!(dir.graphTypologies ?? []).includes("library")) continue;
      const abs = join(root, dir.path);
      if (!existsSync(abs)) continue;
      const entries = readdirSync(abs, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
      if (entries.length > 0) out.push({ name: decl.name, entries });
    }
  }
  return out;
}

test("a scoped library viewer renders its subject's entries", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()}`));
  await themed(page);

  const data = await page.request.get(`${SITE}${DOCS}/assets/library/index.json`);
  expect(data.status(), "the viewer's data file must be published").toBe(200);
  const g = (await data.json()) as { entries: { instance: string; id?: string }[] };

  const subjects = declaredLibrarySubjects();
  expect(
    subjects.length,
    "no instance declares a library graph with entries — the guard every assertion below needs",
  ).toBeGreaterThan(0);

  for (const { name, entries } of subjects) {
    // 1. The DATA must carry this declared subject at all. This is the step the
    //    first version of this test could not perform, because it read its
    //    expectations from here.
    const inData = g.entries.filter((e) => e.instance === name);
    expect(
      inData.length,
      `${name} declares ${entries.length} library entr(ies) on disk and the viewer data holds none`,
    ).toBeGreaterThan(0);

    // 2. The PAGE must render them, scoped to itself.
    await page.goto(`${SITE}${declaredPageUrl(HARNESS, "library", { subgraph: name })}`, { waitUntil: "networkidle" });
    const status = (await page.locator("#status").textContent()) ?? "";
    expect(status, `${name}: the status line must name its own subject`).toContain(name);
    expect(status, `${name}: reports a different entry count than its data`).toContain(
      `${inData.length} entries`,
    );

    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const e of inData) {
      if (e.id === undefined) continue;
      expect(body, `${name}: entry \`${e.id}\` is in the data and not on its page`).toContain(
        e.id.toLowerCase(),
      );
    }
  }

  expect(errors, "the viewer must render without errors").toEqual([]);
});

/**
 * WCAG A/AA over a whole subject listing, in both views and on both grounds.
 * The listing is where the most colour is — every pill state, the badges, the
 * sorted header — and its palette is the page's own (viewer.css, keyed on the
 * scheme the site paints), so each scheme is a separate claim.
 */
for (const scheme of ["dark", "light"] as const) {
  test(`a subject page on the ${scheme} ground has no WCAG A/AA violations, listing and desktop`, async ({ page }) => {
    const subject = declaredLibrarySubjects()[0];
    expect(subject, "no declared library subject to open").toBeDefined();
    await themed(page, scheme);
    await page.goto(`${SITE}${declaredPageUrl(HARNESS, "library", { subgraph: subject!.name })}`, { waitUntil: "networkidle" });
    await expect(page.locator("#listing [data-fa-library-item]").first()).toBeVisible();
    const audit = async (): Promise<string[]> =>
      (
        await new AxeBuilder({ page })
          .include(".lib-page")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.map((v) => `${v.id} [${v.impact}] ×${v.nodes.length} — ${v.help}: ` +
        v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")} (${n.failureSummary ?? ""})`).join("; "));
    expect(await audit(), "listing").toEqual([]);
    await page.locator("#vDesk").click();
    await expect(page.locator("#desktop .card").first()).toBeVisible();
    expect(await audit(), "desktop").toEqual([]);
  });
}

/**
 * Every listing link is a 24 px target (WCAG 2.2 SC 2.5.8) WHEREVER ITS CELL
 * WRAPS — not only at the widths this machine's fonts happen to give.
 *
 * Why it exists: main's CI went red on the audit above for
 * `cat-harness/nist-sp-800-207` — `.lib-title` 157.9×16 px, safe clickable
 * diameter 21.2 px — while the same commit passed on a developer machine. The
 * title link was a 16 px inline box and the row's `a.src` links beside it are
 * 24 px; where the title cell wrapped and "source" fell to the next line, its
 * box sat ~10.6 px under the title's centre. Whether the cell wraps depends on
 * the runner's fonts, so an audit of the natural layout is a coin toss. This
 * narrows the title and slug cells until every row wraps — the worst case of
 * the geometry CI met — then asserts the computed size AND axe's own verdict.
 */
test("every listing link is a 24 px target even where its cell wraps", async ({ page }) => {
  const subject = declaredLibrarySubjects()[0];
  expect(subject, "no declared library subject to open").toBeDefined();
  await themed(page, "dark");
  await page.goto(`${SITE}${declaredPageUrl(HARNESS, "library", { subgraph: subject!.name })}`, { waitUntil: "networkidle" });
  await expect(page.locator("#listing [data-fa-library-item]").first()).toBeVisible();
  await page.addStyleTag({
    content:
      ".lib-page #listing td.t-title, .lib-page #listing td.lib-first " +
      "{ min-width:0 !important; max-width:7rem !important; }",
  });

  const links = page.locator("#listing a.lib-title, #listing a.lib-view");
  expect(await links.count(), "the guard: the listing renders no title or slug links").toBeGreaterThan(0);
  const small = await links.evaluateAll((as) =>
    as
      .map((a) => {
        const r = a.getBoundingClientRect();
        return { text: (a.textContent ?? "").trim(), w: Math.round(r.width), h: Math.round(r.height * 10) / 10 };
      })
      .filter((r) => r.h < 24 || r.w < 24),
  );
  expect.soft(small, "listing links smaller than 24×24 px").toEqual([]);

  const found = (
    await new AxeBuilder({ page }).include("#listing").withRules(["target-size"]).analyze()
  ).violations.map((x) => `${x.id} ×${x.nodes.length}: ` + x.nodes.slice(0, 5).map((n) => n.target.join(" ")).join("; "));
  expect(found, "target-size with every title cell wrapped").toEqual([]);
});
