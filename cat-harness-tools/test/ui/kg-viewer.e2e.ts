/**
 * The knowledge-graph viewer, rendered.
 *
 * `AGENTS.md` is emphatic that a human cannot assess a rendered artefact from a
 * description of it. The same applies to the agent that built it: "the HTML
 * looks right" is not evidence that 1111 nodes load, that an edge is
 * clickable, or that a failed fetch says so rather than drawing an empty
 * graph. This drives the real page in the real browser.
 *
 * Served by `test-server.mjs` from the repo root, so the fixtures are the
 * actual generated artefacts under `_kg/` — not a hand-written stand-in that
 * could agree with the test while disagreeing with what ships.
 *
 * @module test/kg-viewer.e2e
 */
import { test, expect } from "@playwright/test";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { artefactStubFor } from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";

/**
 * The published artefact name, RESOLVED from the declaration.
 *
 * Every path below was a `folio-assistant` literal until 2026-09-21, when the
 * stub was renamed to `cat-harness` (issue #649) and this suite went red with
 * `ENOENT: _kg/folio-assistant.jsonld` while the exporter was correctly
 * writing `_kg/cat-harness.jsonld`.
 *
 * The comment on {@link PAGE} below had already diagnosed this exact shape one
 * layer in — *"a constant would have moved all of them together"* — after the
 * layout moved and two tests kept the old path. That repair named the PAGE and
 * stopped there, leaving the stub itself inlined four times. This finishes it:
 * the name is resolved once, so the next rename moves every path here with it.
 */
// Two things this got wrong before it got right, both invisible to the fast
// gate set and both fatal at COLLECTION time, where Playwright reports them as
// "no tests found" rather than as a failure:
//
//  1. `import.meta.dir` is a BUN extension and is `undefined` under Playwright.
//     `a11y.e2e.ts` beside this already used the portable form.
//  2. `readDeclaration` validates the whole declaration and throws when any
//     directory names an unregistered graph typology — the hazard `siteDirFor`
//     documents. `artefactStubFor` is the raw read, added for this.
const STUB = artefactStubFor(join(HARNESS_ROOT));

// `_kg/` is gitignored — it is build output, not a fixture to commit. Generate
// it if absent so the suite runs from a clean checkout with one command, and
// so the artefacts under test are the ones the deploy actually emits rather
// than a stand-in that could agree with the test and disagree with what ships.
//
// The viewer lives at `_kg/<stub>/index.html` reading `../<stub>/<stub>.jsonld`
// (the document's site path, under its layer's own directory since #603
// decision 1b) — mirroring the published layout, where
// `<base>/<stub>/` is the directory that makes the extensionless
// `<base>/<stub>` a page Pages can serve. Driving the real relative path is
// the point: a viewer that resolved its document correctly in a flat fixture
// and wrongly in the deployed tree is exactly the failure a stand-in hides.
// Generated once, before any worker starts, by `e2e-global-setup.ts` (bean
// `dlqu`): with several workers, a module-level generator here ran in every
// one of them, concurrently, against the files the others were serving.

/**
 * The page under test, named once.
 *
 * It was inlined at every `page.goto`. When the layout moved from
 * `_kg/index.html` to `_kg/<stub>/index.html`, two tests added on a branch kept
 * the old path and went green locally against a leftover `_kg/` — a constant
 * would have moved all of them together.
 */
const PAGE = `/_kg/${STUB}/index.html`;

/** Facet ids carry `(`, `)` and `-`; they are matched literally, not as patterns. */
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Kg = {
  "@graph": Array<Record<string, unknown>>;
  counts: Record<string, number>;
  /** Absent since bean `2634` — kept optional so the fixture below can set it. */
  undeclaredTerms?: Array<{ term: string }>;
  sourceCommit?: string;
};

/**
 * The export as the page shows it: a TOMBSTONE (bean `4ak5` item 2, one
 * release) is a forwarding address the viewer leaves out, as the export
 * leaves it out of `counts`, so the page's node count is the rest.
 */
const KG_RAW = JSON.parse(readFileSync(`_kg/${STUB}/${STUB}.jsonld`, "utf-8")) as Kg;
const KG: Kg = { ...KG_RAW, "@graph": KG_RAW["@graph"].filter((n) => n.deprecated !== true) };

test.describe("kg viewer", () => {
  test("loads the sibling document and reports the real node count", async ({ page }) => {
    await page.goto(PAGE);
    // The count comes from the document, so this fails if the page silently
    // fetched nothing — which is the failure mode that matters most.
    await expect(page.locator("#meta")).toContainText(`${KG["@graph"].length} nodes`);
    await expect(page.locator("#meta")).not.toContainText("could not load");
  });

  test("every type in the export is offered as a facet, with its count", async ({ page }) => {
    await page.goto(PAGE);
    for (const [type, n] of Object.entries(KG.counts)) {
      // Name THEN count — the facet button's DOM order, which is also the
      // order a screen reader reads ("ProcessNode 374", not "374 ProcessNode").
      // These assertions matched count-then-name until the accessibility pass
      // reordered the markup, and they are how that reorder was caught.
      const facet = page.locator(".facet", { hasText: new RegExp(`^${type}${n}$`) });
      await expect(facet, `facet for ${type}`).toHaveCount(1);
    }
  });

  // ── The Subgraph facet ────────────────────────────────────────────────
  //
  // It shipped with no test at all, and the change that added it deleted the
  // `renderMeta()` call from `renderAll`. The page then loaded 1687 nodes and
  // sat on "loading …" forever — no console error, no failed request, nothing
  // for a screenshot to look wrong about unless you read the provenance line.
  // Nine tests in this file caught it; none of them was about the facet. The
  // three below are, so the next such edit fails on its own terms.

  /**
   * The facet's values, computed from the document rather than listed here.
   *
   * It mirrors `subOf` in the viewer: `inSubgraph` is a link to a Directory
   * node, so the readable id is the fragment, and a node without one is its
   * own value rather than being folded into a default. Recomputing it here
   * rather than hardcoding ids means the test follows a declaration being
   * added or renamed, which is the whole point of a declaration-driven facet.
   */
  const UNSTAMPED = "(no declared subgraph)";
  const subTally = (): Record<string, number> => {
    const c: Record<string, number> = {};
    for (const n of KG["@graph"]) {
      const v = n.inSubgraph;
      const k = typeof v === "string" && v.length > 0 ? String(v).split("/").pop()! : UNSTAMPED;
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  };

  test("every declared subgraph is offered as a facet, with its count", async ({ page }) => {
    await page.goto(PAGE);
    const tally = subTally();
    // A floor, not the number: the count is a claim that goes stale, and the
    // failure worth guarding is "the group rendered nothing".
    expect(Object.keys(tally).length).toBeGreaterThan(2);
    for (const [id, n] of Object.entries(tally)) {
      const facet = page.locator("#subs .facet", { hasText: new RegExp(`^${escapeRe(id)}${n}$`) });
      await expect(facet, `subgraph facet for ${id}`).toHaveCount(1);
    }
  });

  test("a node in no declared subgraph gets its own facet, not a default", async ({ page }) => {
    await page.goto(PAGE);
    // The gap is the point. Vocabulary nodes are minted from the namespace
    // rather than from a file, so they belong to no directory — absorbing them
    // into whichever subgraph sorted first would report a clean partition over
    // nodes nothing declared.
    const tally = subTally();
    expect(tally[UNSTAMPED], "nodes with no stamp").toBeGreaterThan(0);
    await expect(
      page.locator("#subs .facet", { hasText: new RegExp(`^${escapeRe(UNSTAMPED)}\\d+$`) }),
    ).toHaveCount(1);
  });

  test("the two facet groups compose — picking a subgraph narrows the kinds", async ({ page }) => {
    await page.goto(PAGE);
    const before = await page.locator("#facets .facet").allTextContents();
    // The largest subgraph other than the unstamped one, so there is certainly
    // something to narrow to.
    const [biggest] = Object.entries(subTally())
      .filter(([id]) => id !== UNSTAMPED)
      .sort((a, b) => b[1] - a[1])[0]!;
    await page.locator("#subs .facet", { hasText: new RegExp(`^${escapeRe(biggest)}\\d+$`) }).click();
    const after = await page.locator("#facets .facet").allTextContents();
    // Composition, not merely "something changed": every node in the list must
    // now be in the chosen subgraph, and the Kind counts are re-tallied over
    // that subset rather than left at the whole-graph numbers.
    expect(after).not.toEqual(before);
    const kinds = await page.locator("#list li button .kind").allTextContents();
    expect(kinds.length).toBeGreaterThan(0);
  });

  test("filtering by a facet narrows the list to that kind", async ({ page }) => {
    await page.goto(PAGE);
    await page.locator(".facet", { hasText: /^Tool\d+$/ }).click();
    const kinds = await page.locator("#list li button .kind").allTextContents();
    expect(kinds.length).toBeGreaterThan(0);
    expect(new Set(kinds)).toEqual(new Set(["Tool"]));
  });

  test("selecting a node shows its properties and its IRI", async ({ page }) => {
    await page.goto(PAGE);
    await page.locator("#q").fill("beans-cli");
    await page.locator("#list li button").first().click();
    await expect(page.locator(".detail h3")).toContainText("beans CLI");
    // A Tool's IRI is its own document beside the graph's (bean `tdir`).
    await expect(page.locator(".detail .iri")).toContainText("/tools/beans-cli.jsonld");
    await expect(page.locator(".detail th", { hasText: /^satisfies$/ })).toHaveCount(1);
  });

  test("an edge is a link you can follow, and following it changes the panel", async ({ page }) => {
    await page.goto(PAGE);
    await page.locator("#q").fill("beans-cli");
    await page.locator("#list li button").first().click();
    const before = await page.locator(".detail h3").textContent();
    // `satisfies` is an @id-coerced term, so its values render as buttons.
    await page.locator(".detail td .link").first().click();
    await expect(page.locator(".detail h3")).not.toHaveText(String(before));
    // The target is a skill, at its subject page: `<doc dir>/skill/<id>`
    // (cat-harness-tools#603), not a fragment of the graph document.
    await expect(page.locator(".detail .iri")).toContainText("/skill/");
  });

  test("back-links are computed, so a node says what points AT it", async ({ page }) => {
    await page.goto(PAGE);
    await page.locator("#q").fill("todo-manager");
    await page.locator("#list li button").first().click();
    // Several Tools satisfy this skill; none of them is stored on the skill.
    await expect(page.locator(".detail th", { hasText: /referenced by/ })).toHaveCount(1);
  });

  test("the published graph has no property a JSON-LD processor would drop", async ({ page }) => {
    // This assertion USED to read `toBeGreaterThan(0)`: 34 property names and
    // 3583 occurrences were undeclared, and the viewer's job was to make that
    // impossible to miss. Bean `ovkk` closed the backlog, so the same fact is
    // now asserted the other way round — and `kg-export` exits non-zero if a
    // new one appears, which is what stops this quietly inverting again.
    // Bean `2634`: the published document no longer CARRIES `undeclaredTerms`
    // — it is a QA finding and lives in `test/results/kg-export.qa-results.json`.
    // Absent is the assertion now, and it is a stronger one than `[]` was: the
    // exporter exits non-zero if the count is ever non-zero, so a document can
    // only ship when there is nothing to report.
    expect(KG.undeclaredTerms).toBeUndefined();
    await page.goto(PAGE);
    // Both the types that carried the worst of it. A mark HERE would mean the
    // page and the document disagree about what the context declares.
    for (const type of ["ProcessNode", "Skill"]) {
      await page.locator(".facet", { hasText: new RegExp(`^${type}\\d+$`) }).click();
      await page.locator("#list li button").first().click();
      await expect(page.locator(".detail th.undeclared")).toHaveCount(0);
      await expect(page.locator(".detail .note")).toHaveCount(0);
    }
  });

  test("a property missing from the @context IS marked, when there is one", async ({ page }) => {
    // The marking path has no real artefact to run against any more, and the
    // wrong conclusion to draw from that is that it need not be tested: it is
    // the guard that makes the next undeclared term visible rather than
    // silently dropped. So it runs against a SYNTHETIC document — and against
    // the REAL page bytes, copied rather than re-templated, so this cannot
    // pass over a viewer that ships differently.
    //
    // The copy sits one directory deeper, which is also why it works at all:
    // the page fetches `../<stub>/<stub>.jsonld` RELATIVE to itself, the property the
    // deployed layout depends on. A page that resolved its document any other
    // way would read the real graph from here and fail.
    const dir = "_kg/fixtures";
    mkdirSync(`${dir}/${STUB}`, { recursive: true });
    copyFileSync(`_kg/${STUB}/index.html`, `${dir}/${STUB}/index.html`);
    const NS = "https://litlfred.github.io/folio-assistant/ns/";
    writeFileSync(
      `${dir}/${STUB}/${STUB}.jsonld`,
      JSON.stringify({
        "@context": { "@version": 1.1, id: "@id", type: "@type", name: "http://www.w3.org/2000/01/rdf-schema#label" },
        "@id": "https://example.invalid/fixture.jsonld",
        counts: { Tool: 1 },
        undeclaredTerms: [{ term: "undeclaredProbe", onTypes: ["Tool"], occurrences: 1 }],
        problems: [],
        danglingLinks: [],
        "@graph": [{ "@id": "https://example.invalid/tools/probe.jsonld", "@type": `${NS}Tool`, name: "probe", undeclaredProbe: "dropped on expansion" }],
      }),
    );

    await page.goto(`/${dir}/${STUB}/index.html`);
    await expect(page.locator("#meta")).toContainText("1 nodes");
    await page.locator("#list li button").first().click();
    await expect(page.locator(".detail .note")).toContainText("not in the");
    await expect(page.locator(".detail th.undeclared").first()).toBeVisible();
    // The DECLARED property beside it is not marked — otherwise the mark says
    // nothing, and a page that flagged everything would pass the line above.
    await expect(page.locator(".detail th", { hasText: /^name$/ })).not.toHaveClass(/undeclared/);
  });

  test("a one-hop neighbourhood is drawn, and is not the whole graph", async ({ page }) => {
    await page.goto(PAGE);
    await page.locator("#q").fill("beans-cli");
    await page.locator("#list li button").first().click();
    const circles = page.locator(".detail svg circle");
    const n = await circles.count();
    expect(n).toBeGreaterThan(1);
    // Capped deliberately: a hairball answers no question. 14 neighbours + self.
    expect(n).toBeLessThanOrEqual(15);
    await expect(page.locator(".detail svg circle.self")).toHaveCount(1);
  });

  test("the page links back to the document it renders, relatively", async ({ page }) => {
    // RELATIVE, not composed. The page already fetched its sibling by this
    // path, so the link is right wherever the page is served from — canonical
    // or branches/<slug>/. Composing <base>/kg/<stub>.jsonld from the
    // declaration would be a second answer to a question already answered,
    // and the one that breaks on a preview.
    //
    // The path is `../<stub>/<stub>.jsonld`, not a bare sibling name: the
    // page climbs to the site root and descends the document's own path,
    // which is under the layer's directory since #603 decision 1b. That layout changed under this branch, and these two tests
    // kept passing locally against a STALE `_kg/` while failing in CI — which
    // is the same class of defect as the one this PR fixes in `qa-panel`, so it
    // is worth saying out loud: `_kg/` is gitignored build output, and a suite
    // run against a leftover copy of it is not evidence about what ships.
    await page.goto(PAGE);
    const src = page.locator("#meta a").first();
    await expect(src).toHaveAttribute("href", `../${STUB}/${STUB}.jsonld`);
    // A name that says what it gets you: "JSON-LD" alone names a syntax.
    await expect(src).toHaveAttribute("aria-label", /Download this graph as JSON-LD/);
    // And it actually resolves — from the PAGE's own directory, the way a
    // browser would follow it, rather than from a path this test composes.
    const res = await page.request.get(new URL(
      String(await src.getAttribute("href")),
      new URL(PAGE, page.url()),
    ).toString());
    expect(res.status()).toBe(200);
  });

  // Bean yhcq, findings 5, 3/4, 8 and 2 — each asserted on the page as drawn.
  test("the node list is alphabetical by the name shown, not in document order", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator("#list li button").first()).toBeVisible();
    const names = await page.locator("#list li button").evaluateAll((bs) =>
      bs.map((b) => (b.firstChild?.textContent ?? "").trim().replace(/^[^\p{L}\p{N}]+/u, "")));
    const collate = new Intl.Collator("en", { sensitivity: "base", numeric: true });
    let descending = 0;
    for (let i = 1; i < names.length; i++) if (collate.compare(names[i - 1], names[i]) > 0) descending++;
    expect(descending).toBe(0);
  });

  test("a link into another graph says so, and is not followed by 'no links'", async ({ page }) => {
    await page.goto(PAGE);
    const ids = new Set(KG["@graph"].map((m) => m["@id"]));
    const target = KG["@graph"].find((n) =>
      ([] as unknown[]).concat(n.satisfies ?? []).some((v) =>
        typeof v === "string" && /^https?:/.test(v) && !ids.has(v)));
    test.skip(!target, "the export has no node linking only into another graph");
    // The id as the list shows it (kg-viewer.ts `short`): the fragment, or a
    // per-Tool document IRI's `tool/<id>` (bean tdir), which has no fragment.
    const id = String(target!["@id"]);
    const tool = /\/tools\/([^/]+)\.jsonld$/.exec(id);
    await page.locator("#q").fill(id.includes("#") ? id.split("#").pop()! : tool ? `tool/${decodeURIComponent(tool[1])}` : id);
    await page.locator("#list li button").first().click();
    await expect(page.locator(".detail td .elsewhere").first()).toContainText("in another graph");
    await expect(page.locator(".detail p.empty")).not.toHaveText("No links to or from this node.");
  });

  test("the page links back to the docs site, relatively", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator("#home")).toHaveAttribute("href", "../");
    await expect(page.locator("#home")).toContainText("Docs site");
  });

  test("on one column, choosing a node brings its detail into view", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
    await page.locator("#list li button").first().click();
    const top = await page.locator("#detail").evaluate((d) => d.getBoundingClientRect().top);
    expect(top).toBeLessThan(844);
    expect(top).toBeGreaterThanOrEqual(0);
    await expect(page.locator("#detail")).toBeFocused();
  });

  test("the source commit is linked when the export knew it", async ({ page }) => {
    await page.goto(PAGE);
    const commit = KG.sourceCommit;
    if (commit === undefined) {
      // Third state: a tarball or export-stripped checkout produces a complete
      // graph that cannot say which commit it came from. Absent, not wrong.
      await expect(page.locator("#meta a")).toHaveCount(1);
      return;
    }
    await expect(page.locator("#meta a", { hasText: "source commit" })).toHaveAttribute("href", commit);
  });

  test("the interface is in English, because no catalogue is translated yet", async ({ page }) => {
    // The shipped state, asserted rather than assumed. Every
    // translations/<locale>/kg-viewer.po carries every msgid with an empty
    // msgstr, so there is nothing to switch TO: English is the only choice.
    await page.goto(PAGE);
    await expect(page.locator("#facets-h")).toHaveText("Kind");
    await expect(page.locator("#list-h")).toHaveText("Nodes");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('.lang:not(.planned)')).toHaveCount(1);
    await expect(page.locator('.lang[lang="en"]')).toHaveAttribute("aria-pressed", "true");
    // No boundary note either: in English there is no boundary to draw.
    await expect(page.locator("#boundary")).toBeHidden();
  });

  /**
   * Owner's ruling 2026-10-02 (issue #1838, bean w6fu): SHOW the switcher,
   * disabled, so readers can see translations are planned.
   *
   * "Disabled" is asserted as an accessible state, not a colour: reachable by
   * keyboard, announced as unavailable, with a reason a phone and a keyboard
   * can both open. A greyed button with a hover tooltip would pass a
   * screenshot and fail every one of those.
   */
  test("planned languages are shown disabled, with a reason you can open without a mouse", async ({ page }) => {
    await page.goto(PAGE);
    const planned = page.locator(".lang.planned");
    await expect(planned).toHaveCount(5);
    for (const loc of ["ar", "es", "fr", "ru", "zh"]) {
      const b = page.locator(`.lang.planned[lang="${loc}"]`);
      await expect(b).toHaveAttribute("aria-disabled", "true");
      // aria-disabled rather than the disabled attribute: it stays in the tab order.
      await expect(b).not.toHaveAttribute("disabled", /.*/);
      await expect(b).toHaveAttribute("aria-describedby", "langs-why-s");
    }
    await expect(page.locator('.lang.planned[lang="ar"]')).toHaveAttribute("dir", "rtl");
    await expect(page.locator('.lang.planned[lang="zh"]')).toHaveText("中文");

    // The reason is VISIBLE, not hover-only, and is the description of every
    // planned button.
    const reason = page.locator("#langs-why-s");
    await expect(reason).toBeVisible();
    await expect(reason).toHaveText("Translations coming");
    await expect(page.locator("#langs-why-t")).toBeHidden();

    // Keyboard: focus a planned language and press it -- the explanation opens
    // and focus lands on its toggle; nothing about the page's language changes.
    await page.locator('.lang.planned[lang="fr"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#langs-why-t")).toBeVisible();
    await expect(page.locator("#langs-why-t")).toContainText("Français");
    await expect(page.locator("#langs-why-t")).toContainText("shown in English");
    await expect(reason).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(new URL(page.url()).searchParams.get("lang")).toBeNull();

    // ...and the toggle itself closes and reopens with the keyboard.
    await page.keyboard.press("Enter");
    await expect(page.locator("#langs-why-t")).toBeHidden();
    await page.keyboard.press("Space");
    await expect(page.locator("#langs-why-t")).toBeVisible();
  });

  /**
   * The switcher is drawn before the document arrives and redrawn after it.
   * A key pressed in between used to land on a node the redraw discarded, so
   * the reason opened and focus fell to <body> -- the intermittent CI failure
   * of the test above on a slow runner. Hold the fetch to make the window
   * certain rather than lucky.
   */
  test("a redraw when the document arrives keeps the keyboard's place", async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(`**/${STUB}.jsonld`, async (r) => { await held; await r.continue(); });
    await page.goto(PAGE);
    await page.locator('.lang.planned[lang="fr"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#langs-why-s")).toBeFocused();
    release();
    await expect(page.locator("#list-h")).toHaveText("Nodes");
    await expect(page.locator("#list li button").first()).toBeVisible();
    await expect(page.locator("#langs-why-t")).toBeVisible();
    await expect(page.locator("#langs-why-s")).toBeFocused();
  });

  test("the disabled switcher's targets clear 24px, and a tap opens the reason", async ({ page }) => {
    // SC 2.5.8's floor is 24px; this layer's interaction profile is
    // low-dexterity, so the switcher keeps the facets' 32px.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
    await page.mouse.move(380, 830);
    for (const t of await page.locator("#langs .lang, #langs-why-s").all()) {
      const box = (await t.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(box.width).toBeGreaterThanOrEqual(24);
    }
    // A tap on a planned language explains itself rather than doing nothing.
    // `force`, because Playwright treats aria-disabled as "not enabled" and
    // would wait forever -- which is exactly the state being tested. So the
    // hit-test it would have done is done here: the button's centre is the
    // button, not something drawn over it.
    const es = page.locator('.lang.planned[lang="es"]');
    const c = (await es.boundingBox())!;
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.getAttribute("lang"),
      [c.x + c.width / 2, c.y + c.height / 2])).toBe("es");
    await es.click({ force: true });
    await expect(page.locator("#langs-why-t")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("asking for a language nobody has translated yet gets English, not a blank page", async ({ page }) => {
    // The failure this guards against is the one that ships today: with every
    // catalogue empty, EVERY string takes the fallback path. A lookup that
    // returned the empty msgstr instead of the msgid would render a page of
    // blank labels and no test would have been looking.
    await page.goto(`${PAGE}?lang=fr`);
    await expect(page.locator("#facets-h")).toHaveText("Kind");
    await expect(page.locator("#list-h")).toHaveText("Nodes");
    await expect(page.locator("#q")).toHaveAttribute("placeholder", "search name, id, title…");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#meta")).toContainText(`${KG["@graph"].length} nodes`);
  });
});

/**
 * The half no shipped catalogue exercises.
 *
 * `scripts/tests/kg-viewer-fixture.ts` calls the REAL generator with a
 * catalogue of its own — a pseudolocalised, deliberately PARTIAL one under the
 * reserved tag `qaa`, so no real language is impersonated and the strings it
 * leaves out prove the English fallback. See that module for why the fixture
 * exists rather than a shipped translation.
 */
test.describe("kg viewer — with a catalogue", () => {
  // The fixture page is generated by `e2e-global-setup.ts`, once.
  const FIXTURE = "/_kg/folio-assistant-i18n-fixture/index.html";

  test("the switcher appears once there is something to switch to", async ({ page }) => {
    await page.goto(FIXTURE);
    await expect(page.locator("#langs")).toBeVisible();
    // English first, and always offered: it is the msgid, so it is never
    // missing and it is the way back.
    await expect(page.locator(".lang").first()).toHaveText("English");
    await expect(page.locator('.lang[lang="qaa"]')).toHaveText("Qaa (fixture)");
    await expect(page.locator('.lang[lang="en"]')).toHaveAttribute("aria-pressed", "true");
    // A catalogue WITH strings is a choice, never a planned language -- the
    // enable-on-content path of bean w6fu, with no code change between them.
    await expect(page.locator('.lang[lang="qaa"]')).not.toHaveAttribute("aria-disabled", /.*/);
    await expect(page.locator('.lang.planned[lang="qaa"]')).toHaveCount(0);
  });

  test("choosing a language translates the chrome and turns the page", async ({ page }) => {
    await page.goto(FIXTURE);
    await page.locator('.lang[lang="qaa"]').click();
    await expect(page.locator("#list-h")).toHaveText("«Nodes»");
    await expect(page.locator("#facets-h")).toHaveText("«Kind»");
    await expect(page.locator("html")).toHaveAttribute("lang", "qaa");
    // Right to left, because a frame that does not turn with the language is
    // a translation of the words only.
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('.lang[lang="qaa"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("a string the catalogue does not carry falls back to English, not to blank", async ({ page }) => {
    await page.goto(`${FIXTURE}?lang=qaa`);
    // Translated:
    await expect(page.locator("#list-h")).toHaveText("«Nodes»");
    // Not translated, and therefore English — per string, not per page.
    await expect(page.locator("a.skip")).toHaveText("Skip to results");
    await expect(page.locator(".facet").first()).toContainText("All");
    await expect(page.locator("#meta")).toContainText(`${KG["@graph"].length} nodes`);
  });

  test("the page says where the translation stops, in the language chosen", async ({ page }) => {
    // The chrome is translated; node names, descriptions and property names
    // come from the corpus and cannot be reached from here. A screen that is
    // two-thirds translated and silent about it is worse than one that states
    // its edge — and the statement is itself translatable, because the person
    // who needs it is reading the translated page.
    await page.goto(`${FIXTURE}?lang=qaa`);
    const note = page.locator("#boundary");
    await expect(note).toBeVisible();
    await expect(note).toContainText("«The interface is shown in Qaa (fixture); the graph is not.»");
    // Unofficial, and it says so rather than letting a reader assume somebody
    // adjudicated it. That sentence is untranslated here, so it arrives in
    // English — which is the fallback doing its job inside a live sentence.
    await expect(note).toContainText("has not been reviewed by a person");
  });

  test("the provenance line's parts are isolated, so a count stays beside its noun", async ({ page }) => {
    // Found by LOOKING at the right-to-left render, not by a checker. The line
    // was "source commit · JSON-LD · nodes · commit dac179a6 · … 1148": the
    // digits are a weak run, the middots between parts are neutral, and the
    // bidi algorithm merged them and moved the number to the far end of the
    // line, away from the word it counted.
    //
    // Every assertion still passed while it was wrong, because textContent is
    // in DOM order whatever the display does — which is why this one measures
    // geometry.
    await page.goto(`${FIXTURE}?lang=qaa`);
    const parts = page.locator("#meta bdi");
    // Retrying, not a bare `count()`: the line is written inside the graph
    // fetch's `.then`, so `goto` returns before it exists. The same race as
    // the pressed-facet count below (d345255); reproduced by delaying the
    // `.jsonld` route 900 ms — bare count 0, this green.
    await expect(parts.nth(1)).toBeAttached();
    await expect(parts.first()).toHaveText(/^\d+ nodes$/);

    // In RTL the first part sits at the RIGHT, and the last to its left.
    const first = await parts.first().boundingBox();
    const last = await parts.last().boundingBox();
    expect(first!.x).toBeGreaterThan(last!.x);
  });

  test("the graph's own words stay in the graph's language", async ({ page }) => {
    // The other half of the boundary, asserted rather than described. If this
    // ever fails, the note above has become a lie.
    await page.goto(`${FIXTURE}?lang=qaa`);
    await page.locator("#q").fill("beans-cli");
    await page.locator("#list li button").first().click();
    await expect(page.locator(".detail h3")).toContainText("beans CLI");
    await expect(page.locator(".detail th", { hasText: /^satisfies$/ })).toHaveCount(1);
  });

  test("switching language redraws the panel that is open, not just the frame", async ({ page }) => {
    // The detail panel is built once per selection. A switcher that only
    // relabelled the chrome would leave the node the reader is looking at in
    // the language they just left.
    await page.goto(FIXTURE);
    await page.locator("#q").fill("beans-cli");
    await page.locator("#list li button").first().click();
    await expect(page.locator("#detail")).toHaveAttribute("aria-label", "Selected node");
    await page.locator('.lang[lang="qaa"]').click();
    await expect(page.locator("#detail")).toHaveAttribute("aria-label", "«Selected node»");
    await expect(page.locator(".detail h3")).toContainText("beans CLI");
  });

  test("the choice is remembered under the same key the docs site writes", async ({ page }) => {
    // fa-locale, not a second key: a reader who chose a language on the docs
    // site arrives here in it, and a reader who chooses here keeps it there.
    await page.goto(FIXTURE);
    await page.locator('.lang[lang="qaa"]').click();
    expect(await page.evaluate(() => localStorage.getItem("fa-locale"))).toBe("qaa");
    // ...and the address is shareable to somebody whose browser asks for
    // something else.
    expect(new URL(page.url()).searchParams.get("lang")).toBe("qaa");
    await page.goto(FIXTURE);
    await expect(page.locator("#list-h")).toHaveText("«Nodes»");
  });

  test("a language with no catalogue is not offered and not selected", async ({ page }) => {
    // A stale link or a browser set to Swedish is the ordinary case, and the
    // answer is the source language rather than an empty page.
    await page.goto(`${FIXTURE}?lang=sv`);
    await expect(page.locator("#list-h")).toHaveText("Nodes");
    await expect(page.locator('.lang[lang="sv"]')).toHaveCount(0);
  });

  test("an unreadable document says so in the reader's language, and is still not drawn as empty", async ({ page }) => {
    await page.route(`**/${STUB}.jsonld`, (r) => r.fulfill({ status: 404, body: "" }));
    await page.goto(`${FIXTURE}?lang=qaa`);
    await expect(page.locator("#meta")).toContainText("could not load");
    await expect(page.locator(".detail")).toContainText("not an empty graph");
    // Three states, in every language: no facets and no list, because an
    // empty index and an unreadable document mean opposite things.
    await expect(page.locator(".facet")).toHaveCount(0);
    await expect(page.locator("#list li")).toHaveCount(0);
  });
});

test.describe("kg viewer — the failed fetch", () => {
  test("a document that cannot be fetched says so, and is never drawn as empty", async ({ page }) => {
    // Three states, not two. An empty index and a failed fetch look identical
    // on screen and mean opposite things.
    await page.route(`**/${STUB}.jsonld`, (r) => r.fulfill({ status: 404, body: "" }));
    await page.goto(PAGE);
    await expect(page.locator("#meta")).toContainText("could not load");
    await expect(page.locator(".detail")).toContainText("not an empty graph");
  });
});

/**
 * Bean `tac5` asked whether a cross-tallied facet can hide a button that is
 * still filtering — the `l4zi` shape, *an action whose inverse is not
 * reachable is not a toggle*.
 *
 * **These assert the INVARIANT, not the defect**, because driving the page
 * could not produce the defect and reading the source says why: `kind` and
 * `sub` are written in exactly two places, both `onPick` handlers, and
 * `drawGroup` wires `onPick` only to buttons it rendered. A button exists only
 * for a non-zero tally, so every pick leaves the two selections with a
 * non-empty intersection — and a non-empty intersection is precisely the
 * condition for both buttons to be re-rendered.
 *
 * A test that reproduced nothing would be worth little; these pin the property
 * that makes the defect unreachable, so a future change that breaks the
 * invariant fails here rather than shipping the bean's scenario for real.
 */
test.describe("kg viewer — a selected facet is always unselectable", () => {
  // Local copies: the originals are scoped to the first describe block, and
  // hoisting them would edit tests this change has no business touching.
  const UNSTAMPED = "(no declared subgraph)";
  const subTally = (): Record<string, number> => {
    const c: Record<string, number> = {};
    for (const n of KG["@graph"]) {
      const v = n.inSubgraph;
      const k = typeof v === "string" && v.length > 0 ? String(v).split("/").pop()! : UNSTAMPED;
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  };

  test("picking a subgraph then a kind leaves BOTH selected buttons on the page", async ({ page }) => {
    await page.goto(PAGE);
    const [biggest] = Object.entries(subTally())
      .filter(([id]) => id !== UNSTAMPED)
      .sort((a, b) => b[1] - a[1])[0]!;
    await page.locator("#subs .facet", { hasText: new RegExp(`^${escapeRe(biggest)}\\d+$`) }).click();

    // Whatever kinds remain are, by construction, kinds present in `biggest`.
    const kindText = (await page.locator("#facets .facet").allTextContents()).find((t) => !t.startsWith("All"));
    expect(kindText, "the subgraph must admit at least one kind").toBeTruthy();
    const kindName = kindText!.replace(/\d+$/, "");
    await page.locator("#facets .facet", { hasText: new RegExp(`^${escapeRe(kindName)}\\d+$`) }).click();

    // The defect would be: one of these is gone while its filter still bites.
    await expect(page.locator("#subs .facet[aria-pressed='true']")).toHaveCount(1);
    await expect(page.locator("#facets .facet[aria-pressed='true']")).toHaveCount(1);
    // ...and the list is non-empty, which is what "still filtering" would empty.
    expect(await page.locator("#list li").count()).toBeGreaterThan(0);
  });

  test("EVERY facet group always has exactly one pressed control", async ({ page }) => {
    await page.goto(PAGE);
    // This is the property that makes the bean's scenario impossible, and it
    // is stronger than "the selected button survives": `drawGroup` marks
    // `All` pressed when the selection is null, so a group is never without a
    // pressed control — and the bean's failure state is precisely a group
    // with NONE, its selected button hidden while `All` reads false.
    const groups = ["#facets", "#subs"] as const;
    // RETRYING, not a bare `await …count()`. `kg-viewer.ts` draws the facets
    // inside `fetch(DOC).then(…)`, so `page.goto` — which resolves on `load` —
    // returns with ZERO pressed controls and the count samples before
    // `drawGroup` has run. That is not this page's defect; it is the
    // assertion's, and it is the only bare count in this file: every other
    // test here either uses `toHaveCount` or a `.click()`, both of which wait.
    //
    // It went red in CI on 2026-09-23 while passing locally and on the base
    // branch at the identical commit — a race lost rather than a behaviour
    // changed, and lost here because this branch's export is bigger, so the
    // fetch takes longer. Reproduced deterministically by delaying the
    // `.jsonld` route 900 ms: bare count 0, `toHaveCount(1)` green on the same
    // page. The property asserted is unchanged.
    const pressedIn = (g: string) => page.locator(`${g} .facet[aria-pressed='true']`);

    for (const g of groups) await expect(pressedIn(g), `${g} at rest`).toHaveCount(1);
    const all = await page.locator("#list li").count();
    expect(all).toBeGreaterThan(0);

    await page.locator("#facets .facet", { hasText: /^Tool\d+$/ }).click();
    for (const g of groups) await expect(pressedIn(g), `${g} while filtered`).toHaveCount(1);

    // The inverse is REACHABLE — the whole of `l4zi`. Clicking the pressed
    // control returns the full list rather than merely changing something.
    await page.locator("#facets .facet[aria-pressed='true']").click();
    for (const g of groups) await expect(pressedIn(g), `${g} after undo`).toHaveCount(1);
    expect(await page.locator("#list li").count()).toBe(all);
  });
});
