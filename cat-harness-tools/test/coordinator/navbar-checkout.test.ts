/**
 * `navbar` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/ui/navbar.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each draws the navbar rows of who-iris's
 * declared graphs, which only the checkout holds. Standing alone, cat-harness
 * has none of it, and `check:cat-harness-standalone` collects every test in
 * that layer. The rest of that file's tests stay there; every path here is
 * composed from ORIGIN_DIR, the directory they were written in, so nothing
 * they read changed.
 */
import { describe, expect, it } from "bun:test";

import { navbarRegionsHtml } from "../../scripts/lib/navbar.js";
import { railModel } from "../../scripts/lib/harness-rail.js";
import { declaredGraphs } from "../../scripts/mount-instance-docs.js";
import { kindTitle } from "../../scripts/lib/nav-label.js";

describe("every declared graph reaches the navbar, linked or not", () => {
  // The owner's report: "there shuold be all the harness controlled
  // dirs/graphs". The navbar listed two of who-iris's six.
  //
  // THIS IS BOUND TO `declaredGraphs`, not to a hand-built model. The
  // renderer's handling of a non-link is tested above against a fixture, and
  // that fixture went on passing while the PRODUCER emitted only the mounted
  // kinds — the regression was visible only by building a site. A test that
  // cannot see the producer cannot see this defect.
  const kinds = (linked: Record<string, string> = {}) =>
    declaredGraphs("who-iris", new Map(Object.entries(linked))).map((i) => i.label);
  // Rows say the kind's DISPLAY name since bean `ob3m` finding 6 ("One name
  // everywhere"), so a kind word is compared through the same function.
  const K = (kind: string): string => kindTitle(kind);
  // Kinds who-iris is gaining or dropping across layer pins (see the first
  // test). Expected exactly when the mounted who-iris declares them.
  // `references` joins while it is in transit: who-iris declared its
  // `references/` graph (one `folio-reference/v1` node per cited work, written
  // by `references-extract`; owner, 2026-11-11) on main, and the index's pin
  // of who-iris may predate it. It moves to the pinned list once every pin
  // this test runs under has it.
  const IN_TRANSIT = ["attestations", "references", "uploads"];
  const declaredNow = new Set(kinds());
  const expectedKinds = (pinned: string[]): string[] =>
    [...pinned, ...IN_TRANSIT.filter((k) => declaredNow.has(K(k)))].sort().map(K);

  it("lists every kind the instance declares, not only the published ones", () => {
    // SEVEN declared, and the seventh arrived by this test doing its job.
    // `code` joined on 2026-09-23 when `who-iris/scripts/` was declared under
    // bean `ylj7` — `gen-iris-pages.ts` and the catalogue checker had been
    // sitting in no declared directory while every OTHER graph in this
    // layer was declared. The list grew because the layer did, which is
    // what "every kind the instance declares" is for; pinning it at six would
    // have made the assertion a statement about 2026-09-22 rather than about
    // the declaration.
    // EIGHT since 2026-09-27: `qa` joined when `who-iris/test/results/` was
    // declared, so that auditing this layer produces a committed verdict
    // rather than nothing — 13 layers had no `test/results` at all, which
    // made "audited clean" and "never audited" the same observation (bean
    // `bjzs`). The list grew because the layer did, exactly as it did for
    // `code`; pinning it at seven would make the assertion a statement about
    // 2026-09-26 rather than about the declaration.
    // ELEVEN since 2026-10-01: `schemas` joined when who-iris took its own
    // source descriptor (`sources/`) and generated lookup (`id-lookup/`, kind
    // `code`) from large-datasets (bean `j7ql`); `glossary` and `voices` joined
    // when the WHO style guide was folded into who-iris as a subgraph (bean
    // `qsx4`) — the voices declared from within `skills/skills.json`, the
    // glossary in who-iris.json. Same reason as both above.
    // TWELVE since 2026-10-09: `tools` joined when who-iris declared its own
    // Tool node (`iris-pages`), the one its catalogue visualiser is
    // `renderedBy` (owner: "Need harness to declare visualizer is renderedBy").
    // FOURTEEN with `folio`, which joined when who-iris's landing sticky moved
    // into its own `folio/` (bean `1yd7`). Same reason as every one above.
    // FIFTEEN with `health`, which joined when who-iris declared its own
    // repository health report (`test/health/results/`; owner, 2026-10-10:
    // "All repos need health check"). Same reason again.
    // EIGHTEEN with `processes` and `software-library`, which joined when
    // who-iris declared the IRIS CDN exporter's BPMN and its library node
    // (who-iris#103, 2026-10-30), and `scenarios`, the roles those BPMN
    // lanes bind (folio-assistant#2781). Same reason again.
    // NINETEEN with `attestations`, which joined when who-iris moved its
    // translation round-trip TSVs onto `cat/who-iris/attestations`
    // (who-iris#175, 2026-11-03), and `uploads` leaves with who-iris#176. A
    // kind in IN_TRANSIT is expected exactly when who-iris's mounted
    // declaration has it: this layer's CI mounts the index's pins and the
    // re-pin train mounts who-iris's main, so a fixed list fails one of them
    // whenever who-iris gains or drops a graph. Every other kind is pinned.
    expect(kinds()).toEqual(expectedKinds(["catalogue", "code", "docs", "folio", "glossary", "health", "library", "processes", "qa", "scenarios", "schemas", "skills", "software-library", "themes", "tools", "translation-sources", "voices"]));
  });

  it("links exactly the kinds it was told are published", () => {
    const got = declaredGraphs("who-iris", new Map([["docs", "../docs/who-iris/"]]));
    expect(got.find((i) => i.label === K("docs"))?.href).toBe("../docs/who-iris/");
    // ...and everything else carries no href, which the renderer draws as a
    // non-link. `harness-tiles`: declared and not rendered is a GAP.
    // The IN_TRANSIT kinds (`attestations`, a state-branch graph since
    // who-iris#175, and `uploads`) are expected exactly when declared.
    expect(got.filter((i) => i.href === undefined).map((i) => i.label)).toEqual(expectedKinds([
      "catalogue",
      // `code` is declared and publishes no page — which is exactly the state
      // this assertion exists to keep visible, rather than a gap to hide.
      "code",
      // `folio` (bean `1yd7`) holds the landing sticky; no page is passed in here.
      "folio",
      // `glossary` and `voices` arrived with the style guide (bean `qsx4`); no
      // page is passed in here, so both are declared-and-unlinked.
      "glossary",
      // `health` (2026-10-10) is a state-branch report with no page passed in here.
      "health",
      "library",
      // `processes` (who-iris#103): the IRIS CDN exporter's BPMN, no page passed in here.
      "processes",
      // `qa` is declared and publishes no page, like `code` above: the audit
      // writes sidecars, and the viewer for them is the QA index rather than a
      // per-instance graph page. Declared-and-unrendered is the state this
      // assertion keeps visible.
      "qa",
      // `scenarios`: the roles the IRIS CDN lanes bind, no page passed in here.
      "scenarios",
      // `schemas` (who-iris/sources/, bean `j7ql`) publishes no page either.
      "schemas",
      "skills",
      // `software-library` (who-iris#103): the exporter's library node, no page passed in here.
      "software-library",
      "themes",
      // `tools`: who-iris's own Tool graph (2026-10-09) publishes no page.
      "tools",
      // `translation-sources`: who-iris carries its own glossary catalogues
      // since bean riit ("move things to semantically appropriate place").
      "translation-sources",
      "voices",
    ]));
  });

  it("carries the generator's REASON onto the rows that have no href", () => {
    const got = declaredGraphs(
      "who-iris",
      new Map([["docs", "../docs/who-iris/"]]),
      new Map([
        ["catalogue", { note: "no viewer yet" }],
        ["themes", { note: "staging only" }],
      ]),
    );
    expect(got.find((i) => i.label === K("catalogue"))?.note).toBe("no viewer yet");
    // TWO ROWS, TWO REASONS. One wording for every inert row is the defect
    // this replaced — `title="declared, with no published viewer"` was wrong
    // for the staging-only and render-exempt cases, which are not gaps.
    expect(got.find((i) => i.label === K("themes"))?.note).toBe("staging only");
    // A kind the generator said nothing about renders as it always did: grey,
    // and making no claim about why. The honest third state.
    expect(got.find((i) => i.label === K("skills"))?.note).toBeUndefined();
  });

  it("links a kind whose viewer the HANDLER published — `pk2s`", () => {
    // The defect: who-iris's `catalogue` drew as a grey row over a page that
    // exists. `cat-harness/catalogue/who-iris/index.html` is 23,534 bytes on
    // `gh-pages`, measured 2026-09-23 — the rail was losing a working link.
    //
    // The mount table cannot see it. `mountable()` requires an `index.html`
    // in the layer's own directory, and `who-iris/catalogue/` holds DATA.
    // The page that renders it is the cat-harness HANDLER's, and a handler's
    // viewer is never a mount.
    const got = declaredGraphs(
      "who-iris",
      new Map([["docs", "../docs/who-iris/"]]),
      new Map([["catalogue", { href: "../cat-harness/catalogue/who-iris/" }]]),
    );
    expect(got.find((i) => i.label === K("catalogue"))?.href).toBe("../cat-harness/catalogue/who-iris/");
    // And it is a LINK, so it owes no explanation.
    expect(got.find((i) => i.label === K("catalogue"))?.note).toBeUndefined();
  });

  it("the MOUNT TABLE wins where it has an answer — the owner's order, not a tie-break", () => {
    // *"cliking shoud go to folio view, not the schema viweer."* A mount is
    // the layer presenting itself; the handler's viewer is cat-harness's
    // default rendering of the same graph. Both exist for `library`, and the
    // layer's own route is the one a reader gets.
    const got = declaredGraphs(
      "who-iris",
      new Map([["library", "../who-iris/"]]),
      new Map([["library", { href: "../cat-harness/library/who-iris/" }]]),
    );
    expect(got.find((i) => i.label === K("library"))?.href).toBe("../who-iris/");
  });
});

describe("adjacent graph rows cannot be confused (bean yag0)", () => {
  // The owner clicked who-iris's `docs` row meaning `library` on 2026-09-23:
  // adjacent rows, each a one-letter initial beside a bare kind word, and at
  // rest the strip shows only the marks. `catalogue` and `code` shared `C`.
  const rows = declaredGraphs("who-iris", new Map([["docs", "../docs/who-iris/"], ["library", "../cat-harness/library/who-iris/"]]));

  it("docs and library carry a drawn glyph and distinct hues, not initials", () => {
    // The rows say the kind's display name since bean `ob3m` finding 6.
    const docs = rows.find((r) => r.label === "Docs")!;
    const library = rows.find((r) => r.label === "Library")!;
    expect(docs.glyphPath).toBeDefined();
    expect(library.glyphPath).toBeDefined();
    expect(docs.icon).toBeUndefined();
    expect(docs.tone).not.toBe(library.tone);
  });

  it("every row's accessible name is full and distinct, and begins with its visible label", () => {
    const html = navbarRegionsHtml(railModel({ instance: "who-iris", toRoot: "..", links: rows }));
    const names = rows.map((r) => `${r.label} — ${r.description}`);
    expect(new Set(names).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.description).toContain("who-iris");
      // The visible label then the hidden rest, inside the same row, and the
      // same text as its tooltip.
      expect(html).toContain(`${r.label}<span class="fa-nav-sr"> — ${r.description!.replace(/&/g, "&amp;")}`);
    }
    expect(rows.find((r) => r.label === "Library")!.description).toBe("L1 source content, who-iris");
    expect(html).toContain('title="Library — L1 source content, who-iris"');
  });

  it("the glyph is an SVG hidden from assistive technology — the words are the name", () => {
    const html = navbarRegionsHtml(railModel({ instance: "who-iris", toRoot: "..", links: rows }));
    expect(html).toMatch(/<span class="fa-nav-glyph fa-nav-tone" style="[^"]*" aria-hidden="true"><svg viewBox="0 0 24 24"/);
  });
});
