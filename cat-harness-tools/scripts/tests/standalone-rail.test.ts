/**
 * `railStandalonePages` — the pages that are neither a mount nor a generated
 * viewer. Bean `oi1y`.
 *
 * What these tests are mostly about is **what the pass must NOT touch**, because
 * every one of those cases looks identical from the outside once it has gone
 * wrong: a page with two navigations, or a replica wearing somebody else's
 * chrome, is not a crash and not a failing gate. It is a page that renders.
 *
 * The fixture deliberately names a page for each exclusion rather than testing
 * the predicate, since the predicate is three `startsWith` calls and the risk
 * is not that it computes wrongly — it is that the caller forgets a family.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PINNED_CHROME_FILES, PINNED_DATA_FILES, generatedChromeBytes, mountRoutes, pinPlatformChrome, railStandalonePages } from "../mount-instance-docs.js";
import { renderThemesCss } from "../gen-themes-css.ts";
import { renderAvatarsCss } from "../gen-avatars-css.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteNotBuilt, STANDALONE } from "../../test/support/checkout.ts";
import { ensureThemesCss } from "../../test/support/themes-css.ts";
import { siteDirFor, siteFileFor } from "../../schemas/kg/cat-harness.js";
import { expandRail, navbarRowJsonOf, railDataJson } from "../lib/harness-rail.ts";

const page = (body: string): string =>
  `<!doctype html>\n<html><head><title>t</title></head><body>${body}</body></html>\n`;

/** The theme's own sidebar, as Jekyll lays it onto a `.md` page. */
const THEME_NAV = `<nav aria-label="Main" id="site-nav" class="site-nav">theme</nav>`;
/** The harness rail, as `injectRail` writes it. */
const HARNESS_NAV = `<nav class="fa-nav" aria-label="folio-assistant">rail</nav>`;

function site(): string {
  const root = mkdtempSync(join(tmpdir(), "oi1y-"));
  const put = (rel: string, body: string): void => {
    const p = join(root, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
  };
  // The two halves of one wireframe directory, which is the defect in miniature.
  put("wireframes/navbar/as-is.html", page(`<div class="side">a DRAWN sidebar</div>`));
  put("wireframes/navbar/intent.html", page(`${THEME_NAV}<p>laid out by Jekyll</p>`));
  put("bootstrap/README.html", page("<p>copied through</p>"));
  put("cat-harness/library/x/index.html", page(HARNESS_NAV));
  put("api/modules/thing.html", page("<p>TypeDoc, with its own navigation</p>"));
  put("who-iris/item.html", page("<p>a mount route</p>"));
  put("STAGING/branch/page.html", page("<p>a preview of somebody's branch</p>"));
  put("fragment.html", "<p>html by extension only</p>\n");
  put("assets/vendor/pdfjs/web/viewer.html", page("<div id=\"viewerContainer\"></div>"));
  return root;
}

const run = (root: string) => railStandalonePages(root, "cat-harness", "cat-harness", ["who-iris"]);
const railed = (root: string, rel: string): boolean =>
  /<nav class="fa-nav"/.test(readFileSync(join(root, rel), "utf-8"));

/** The harness data `docs:harness` writes at publish (gitignored): the icon row a railed page carries. */
const HARNESS_DATA_NOT_BUILT = (): boolean =>
  siteNotBuilt(
    "the harness data `docs:harness` writes at publish (gitignored), whose `navbar` is the icon row",
    join(HARNESS_ROOT, siteDirFor(HARNESS_ROOT), "_data", "harness.json"),
  );
/**
 * A folio's site ships the platform chrome as its pinned copy, `themes.css`
 * among it (`themes:css`, gitignored), and its rail's graphs and icon row are
 * the harness data (`docs:harness`, gitignored). Both are written at publish.
 */
const FOLIO_CHROME_NOT_BUILT = (): boolean =>
  siteNotBuilt(
    "site-chrome/assets/css/themes.css (`themes:css`) and the harness data (`docs:harness`), both written at publish (gitignored), which a folio's pinned chrome and rail read",
    join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/css/themes.css")),
    join(HARNESS_ROOT, siteDirFor(HARNESS_ROOT), "_data", "harness.json"),
  );

describe("what it rails", () => {
  // The row is read off the harness's `_data/harness.json`, which `docs:harness`
  // writes at publish and is gitignored: standing alone it is not built (w1gy F18).
  test.skipIf(
    siteNotBuilt(
      "the harness data `docs:harness` writes at publish (gitignored), whose `navbar` is the icon row",
      join(HARNESS_ROOT, siteDirFor(HARNESS_ROOT), "_data", "harness.json"),
    ),
  )("a railed page carries the harness's icon-row data, so docs-ui draws the row (bean wckf, #2147)", () => {
    // The rail had the harness's navbar without the harness's row: the row's
    // data was written only by the theme's head include. Read from the same
    // `_data/harness.json` the Jekyll sidebar reads, so the two cannot differ.
    const root = site();
    run(root);
    const html = readFileSync(join(root, "bootstrap/README.html"), "utf-8");
    const m = /<script type="application\/json" id="fa-navbar-row"[^>]*>([^<]*)<\/script>/.exec(html);
    expect(m).not.toBeNull();
    const row = JSON.parse(m![1]!) as { icons?: string[] } | null;
    expect(Array.isArray(row?.icons)).toBe(true);
  });

  test("never the pinned pdf.js viewer — it is framed inside a railed page (bean folio-assistant-5ea6)", () => {
    // Measured on the first staging preview: the rail drew the site's whole
    // navigation inside the PDF frame, above pdf.js's own toolbar.
    const root = site();
    run(root);
    expect(railed(root, "assets/vendor/pdfjs/web/viewer.html")).toBe(false);
  });

  test("a standalone page with no navigation gets one", () => {
    const root = site();
    run(root);
    expect(railed(root, "wireframes/navbar/as-is.html")).toBe(true);
    expect(railed(root, "bootstrap/README.html")).toBe(true);
  });

  test("a TypeDoc page gets one too, beside the navigation it already has", () => {
    // The exclusion this test used to assert. `api/` was held out of the first
    // pass because TypeDoc's pages already carry a toolbar, a module list and
    // a search dialog, so a second navigation was a LAYOUT question.
    //
    // Answered by rendering rather than by argument: a real published page was
    // railed and both versions opened at 1280px. The rail takes its 56px
    // COLLAPSED STRIP at x=0, the toolbar reflows to x=56, and `scrollWidth`
    // equals `innerWidth` in both — nothing is pushed off the page, and
    // TypeDoc's module list keeps its own column beside the strip.
    //
    // Asserted here so that re-excluding `api/` has to change a test.
    const root = site();
    run(root);
    expect(railed(root, "api/modules/thing.html")).toBe(true);
  });

  test("a page that DRAWS a sidebar still gets a real one", () => {
    // The IRIS-replica objection, answered from the repository's own
    // precedent: `navbar/intent.md` depicts the navbar too and wears the theme
    // sidebar, and nobody has called that wrong. A replica impersonates
    // somebody else's site; a wireframe is this site documenting itself, so
    // the drawing is content inside the page rather than a claim about it.
    const root = site();
    run(root);
    const html = readFileSync(join(root, "wireframes/navbar/as-is.html"), "utf-8");
    expect(html).toContain("a DRAWN sidebar");
    expect(html).toContain('<nav class="fa-nav"');
  });

  // `navbar-row.js` is linked only when there is a row, read off the harness data.
  test.skipIf(HARNESS_DATA_NOT_BUILT())("the id-lookup page gets the rail with linked style and visualiser nav (bean 7ji4)", () => {
    // The page's own head, inlined: `cat-harness-tools/` is a sibling layer the
    // standalone cat-harness checkout does not have. That the real page carries
    // these declarations is asserted where it lives, in publish-id-lookup.test.ts.
    const root = site();
    const html =
      `<!doctype html>\n<html><head>` +
      `<meta name="folio-navbar" content="linked">` +
      `<meta name="fa-visualiser-label" content="Lookup">` +
      `<title>Identifier lookup</title></head><body>` +
      `<script type="application/json" data-fa-visualiser-nav>[{"label":"Identifier lookup","href":"#f"}]</script>` +
      `<h1>Identifier lookup</h1></body></html>\n`;
    mkdirSync(join(root, "id-lookup"), { recursive: true });
    writeFileSync(join(root, "id-lookup/index.html"), html);
    run(root);
    expect(railed(root, "id-lookup/index.html")).toBe(true);
    const after = readFileSync(join(root, "id-lookup/index.html"), "utf-8");
    expect(after).toContain("assets/css/navbar.css");
    expect(after).toContain("assets/js/navbar.js");
    expect(after).toContain("assets/js/navbar-row.js");
  });
});

describe("what it must NOT touch — each failure renders fine and is therefore invisible", () => {
  test("a page with the THEME's sidebar is already navigated", () => {
    // The one that produced four wrong measurements before this pass existed:
    // `docs-ui.css` styles the theme sidebar with `fa-nav-*` class names, so a
    // test for the harness rail that matches loosely sees a themed page as
    // railed — and a test that matches only the harness element rails it a
    // second time, giving the reader two navigations.
    const root = site();
    const r = run(root);
    expect(railed(root, "wireframes/navbar/intent.html")).toBe(false);
    expect(r.alreadyNavigated).toBeGreaterThan(0);
  });

  test("a page ALREADY carrying the harness rail keeps it, and gains only the first-paint snippet", () => {
    const root = site();
    const before = readFileSync(join(root, "cat-harness/library/x/index.html"), "utf-8");
    run(root);
    const after = readFileSync(join(root, "cat-harness/library/x/index.html"), "utf-8");
    expect(after.replace(/\n<script data-folio-saved-scheme>[\s\S]*?<\/script>\n/, "")).toBe(before);
    expect(after.match(/<nav class="fa-nav"/g)).toHaveLength(1);
    expect(after).toContain("data-folio-saved-scheme");
    run(root);
    expect(readFileSync(join(root, "cat-harness/library/x/index.html"), "utf-8")).toBe(after); // idempotent
  });

  test("a page that DECLINES the rail in its own markup keeps that decision (#1881)", () => {
    // The generator honoured `folio-navbar: none`; this post-build walk did
    // not, so library entry shells published at 25 KB instead of 2.8 KB.
    const root = site();
    const rel = "cat-harness/library/x/entry/index.html";
    const shell = page(`<p>shell</p>`).replace("<body>", `<meta name="folio-navbar" content="none">\n<body>`);
    mkdirSync(join(root, "cat-harness/library/x/entry"), { recursive: true });
    writeFileSync(join(root, rel), shell);
    const r = run(root);
    expect(readFileSync(join(root, rel), "utf-8")).toBe(shell);
    expect(r.declined).toBe(1);
  });

  test("a mount route is the OTHER pass's subject", () => {
    // `injectRails` walks these with a per-instance model. Railing them here
    // too would give a mounted page two rails, and the second would carry the
    // ROOT layer's graphs rather than the mounted layer's — right-looking
    // and wrong.
    const root = site();
    run(root);
    expect(railed(root, "who-iris/item.html")).toBe(false);
  });

  test("STAGING previews are not this site", () => {
    // Every open branch's build lives under branches/. Railing those would
    // rewrite other people's previews with THIS branch's navigation, and the
    // preview would then disagree with the branch it claims to show.
    const root = site();
    run(root);
    expect(railed(root, "STAGING/branch/page.html")).toBe(false);
  });
});

describe("what it reports", () => {
  test("a file with no <body> is NAMED, never counted", () => {
    // Same contract as the mount pass. A fragment is not a page this rail
    // belongs on, and a bare number could not be told from a bug.
    const root = site();
    const r = run(root);
    expect(r.skipped).toEqual(["fragment.html"]);
    expect(r.injected).toBe(3);
  });

  test("running twice injects nothing the second time", () => {
    // `injectRail` refuses a page that already carries one, so the pass is
    // idempotent — which is what makes it safe on a site the build may
    // process more than once.
    const root = site();
    run(root);
    const second = run(root);
    expect(second.injected).toBe(0);
  });
});

describe("the mount routes are ASKED for, not guessed", () => {
  test("`bootstrap` is not a mount route, so the pass must not skip it", () => {
    // The regression this exists for, and it cost a wrong claim on the PR.
    //
    // The first version decided a site directory was a mount when a same-named
    // `<name>/<name>.json` existed in the repository. `bootstrap/bootstrap.json`
    // does — but bootstrap declares no renderable docs, so `mountable()` never
    // mounts it, and the guess excluded exactly the ten pages the pass had just
    // been extended to reach.
    //
    // Asserted against the REAL repository rather than a fixture, because the
    // defect was that a plausible predicate disagreed with the real pipeline.
    expect(mountRoutes("cat-harness")).not.toContain("bootstrap");
  });

  test("it returns the routes the mount pass actually owns", () => {
    // Not pinned to a list: which layers are mountable is a property of the
    // repository and changes when one is added. What must hold is that every
    // route names a directory the mount pass would copy, and that the root
    // layer's own docs are not among them — it is already the site root.
    const routes = mountRoutes("cat-harness");
    expect(routes.every((r) => r.length > 0 && !r.startsWith("/"))).toBe(true);
    expect(routes).not.toContain("cat-harness");
  });
});

describe.skipIf(FOLIO_CHROME_NOT_BUILT())("a FOLIO's site (folio-staging.yml): platform links point at the platform's site", () => {
  beforeAll(() => {
    if (!STANDALONE) ensureThemesCss(HARNESS_ROOT);
  });
  // Measured 2026-10-05 on litlfred/smart-ra: a document folio's pages carried
  // no navbar at all, and re-basing the platform's graphs against the FOLIO's
  // root would have made every one of them a 404 on the folio's Pages site.
  const BASE = "https://litlfred.github.io/folio-assistant";

  test("graphs and harnesses are absolute on the platform site; home is the folio's own root", () => {
    const root = mkdtempSync(join(tmpdir(), "folio-rail-"));
    mkdirSync(join(root, "dpi-h-ra"), { recursive: true });
    writeFileSync(join(root, "dpi-h-ra", "index.html"), page("<h1>Doc</h1><h2>Chapter</h2>"));
    const r = railStandalonePages(root, "cat-harness", "cat-harness", [], { platformBase: BASE, homeLabel: "smart-ra" });
    expect(r.injected).toBe(1);

    // As a browser shows it once navbar.js has drawn the rail from its shared
    // data: the page itself carries only the home link until then.
    const html = expandRail(readFileSync(join(root, "dpi-h-ra", "index.html"), "utf-8"), (name) =>
      railDataJson(readFileSync(join(root, "assets", "navbar", `${name}.js`), "utf-8")),
    );
    expect(html).toMatch(/<nav class="fa-nav"/);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    // The rail's own stylesheets are the site's pinned copy (2026-10-15)...
    const sheets = hrefs.filter((h) => /\/assets\/(?:css\/)?[^/]+\.css$/.test(h));
    expect(sheets.length).toBeGreaterThan(0);
    for (const h of sheets) expect(h.startsWith("../assets/")).toBe(true);
    // ...and every link the platform owns resolves on the platform's site...
    const platform = hrefs.filter((h) => !h.startsWith("#") && h !== "../" && !sheets.includes(h));
    expect(platform.length).toBeGreaterThan(0);
    for (const h of platform) expect(h.startsWith(`${BASE}/`)).toBe(true);
    // ...and home, named for the folio, is the folio site's own root.
    expect(hrefs).toContain("../");
    expect(html).toContain("smart-ra");
  });

  test("the icon row is drawn: docs-ui loads from the site's pinned copy, and the row's links are the platform's", () => {
    // Owner, 2026-10-05: "still missing navbar icons on upper left". The row
    // is drawn by docs-ui.js from #fa-navbar-row, which a folio site never
    // loaded, and its links were site-absolute (/todos/) on the folio's site.
    const root = mkdtempSync(join(tmpdir(), "folio-row-"));
    writeFileSync(join(root, "index.html"), page("<h1>Doc</h1>"));
    railStandalonePages(root, "cat-harness", "cat-harness", [], { platformBase: BASE, homeLabel: "smart-ra" });
    const html = readFileSync(join(root, "index.html"), "utf-8");
    // Owner, 2026-10-15, "pinned copy per site": the code is the site's own,
    // and the platform's base is DECLARED for the data docs-ui still reads.
    expect(html).toContain(`<script src="./assets/js/docs-ui.js" defer`);
    expect(html).toContain(`href="./assets/css/docs-ui.css"`);
    expect(html).toContain(`<meta name="fa-platform-base" content="${BASE}"`);
    // On a folio's site the row is written ONCE beside the rail's data and the
    // page's island names it (2026-10-10); read it as a browser would.
    expect(html).toMatch(/<script type="application\/json" id="fa-navbar-row"[^>]* data-fa-row-src="row-[a-z0-9]+"><\/script>/);
    const row = navbarRowJsonOf(html, (f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), "utf-8") : undefined));
    expect(row).toBeDefined();
    // Since cat-harness 2565c93fa the platform's row holds only page controls
    // (close, qr, launcher), which carry no href; the links it still carries
    // are its folders, which `scopeNavbarRow` re-bases the same way.
    const data = JSON.parse(row!) as { hrefs?: Record<string, string>; folders?: { path?: string }[] };
    const targets = [
      ...Object.values(data.hrefs ?? {}),
      ...(data.folders ?? []).flatMap((f) => (typeof f.path === "string" ? [f.path] : [])),
    ];
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(t.startsWith(`${BASE}/`)).toBe(true);
    // A second pass adds nothing: the loader is marked.
    railStandalonePages(root, "cat-harness", "cat-harness", [], { platformBase: BASE, homeLabel: "smart-ra" });
    expect(readFileSync(join(root, "index.html"), "utf-8").split("docs-ui.js").length).toBe(2);
  });

  test("the icon row is written ONCE for the site, and its file runs before every reader (2026-10-10)", () => {
    // Measured on a folio site: 1,956 B of byte-identical row JSON on each of
    // 434 pages. Two pages at different depths share one file; the page keeps
    // an empty island naming it, and the file's deferred script precedes
    // navbar-row.js and docs-ui.js, which read the island.
    const root = mkdtempSync(join(tmpdir(), "folio-row-shared-"));
    mkdirSync(join(root, "a", "b"), { recursive: true });
    writeFileSync(join(root, "index.html"), page("<h1>Doc</h1>"));
    writeFileSync(join(root, "a", "b", "index.html"), page("<h1>Deep</h1>"));
    railStandalonePages(root, "cat-harness", "cat-harness", [], { platformBase: BASE, homeLabel: "smart-ra" });
    const top = readFileSync(join(root, "index.html"), "utf-8");
    const deep = readFileSync(join(root, "a", "b", "index.html"), "utf-8");
    const name = (h: string) => /data-fa-row-src="(row-[a-z0-9]+)"/.exec(h)?.[1];
    expect(name(top)).toBeDefined();
    expect(name(deep)).toBe(name(top));
    expect(deep).toContain(`<script src="../../assets/navbar/${name(top)}.js" defer></script>`);
    for (const h of [top, deep]) {
      const file = h.indexOf(`${name(top)}.js`);
      expect(file).toBeLessThan(h.indexOf("navbar-row.js"));
      expect(file).toBeLessThan(h.indexOf("docs-ui.js"));
    }
    // The file fills the island the way a browser would run it.
    const body = readFileSync(join(root, "assets", "navbar", `${name(top)}.js`), "utf-8");
    const island = { text: "", attrs: new Map([["data-fa-row-src", name(top)!]]) };
    const node = {
      get textContent() { return island.text; },
      set textContent(v: string) { island.text = v; },
      getAttribute: (k: string) => island.attrs.get(k) ?? null,
      removeAttribute: (k: string) => void island.attrs.delete(k),
    };
    new Function("document", body)({ getElementById: (id: string) => (id === "fa-navbar-row" ? node : null) });
    expect(island.attrs.has("data-fa-row-src")).toBe(false);
    expect((JSON.parse(island.text) as { icons?: unknown }).icons).toBeDefined();
  });

  test("PINNED COPY: no page links the platform's live assets, and every file it links is shipped beside it (owner, 2026-10-15)", () => {
    const root = mkdtempSync(join(tmpdir(), "folio-pinned-"));
    mkdirSync(join(root, "a", "b"), { recursive: true });
    writeFileSync(join(root, "index.html"), page("<h1>Doc</h1><h2 id=\"x\">X</h2><h2 id=\"y\">Y</h2>"));
    writeFileSync(join(root, "a", "b", "index.html"), page("<h1>Deep</h1>"));
    const r = railStandalonePages(root, "cat-harness", "cat-harness", [], { platformBase: BASE, homeLabel: "smart-ra" });
    expect(r.pinned?.copied.slice().sort()).toEqual([...PINNED_CHROME_FILES, ...PINNED_DATA_FILES].sort());
    for (const [rel, toRoot] of [["index.html", "."], ["a/b/index.html", "../.."]] as const) {
      const html = readFileSync(join(root, rel), "utf-8");
      // No script or stylesheet from the platform's live site.
      const loaded = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map((m) => m[1]!);
      expect(loaded.filter((u) => u.startsWith(BASE) && /\.(js|css)$/.test(u))).toEqual([]);
      // Every local script and stylesheet the page loads exists in the site.
      for (const u of loaded.filter((u) => u.startsWith(`${toRoot}/`) && /\.(js|css)$/.test(u))) {
        expect(existsSync(join(root, rel, "..", u))).toBe(true);
      }
    }
    // The platform data docs-ui reads is the site's own too, and the page says so.
    expect(readFileSync(join(root, "index.html"), "utf-8")).toContain('<meta name="fa-pinned-data" content=".">');
    // The copies are the pinned harness's bytes.
    for (const f of PINNED_CHROME_FILES) {
      expect(readFileSync(join(root, f)).equals(readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, f))))).toBe(true);
    }
    // A second pass copies nothing and finds them identical.
    const again = railStandalonePages(root, "cat-harness", "cat-harness", [], { platformBase: BASE, homeLabel: "smart-ra" });
    expect(again.pinned).toBeUndefined();
  });

  test("a file the site already built with other bytes is left, and reported", () => {
    const root = mkdtempSync(join(tmpdir(), "folio-pinned-own-"));
    mkdirSync(join(root, "assets", "js"), { recursive: true });
    writeFileSync(join(root, "assets", "js", "docs-ui.js"), "/* the site's own */");
    const r = pinPlatformChrome(root);
    expect(r.differing).toEqual(["assets/js/docs-ui.js"]);
    expect(readFileSync(join(root, "assets", "js", "docs-ui.js"), "utf-8")).toBe("/* the site's own */");
  });

});

describe("pinned chrome a mount never generated", () => {
  test("a generated stylesheet the mount never wrote is rendered, not refused", () => {
    // themes.css and avatars.css are gitignored in the harness, so a mount laid
    // down from a lock has neither. ihris#43 failed on themes.css this way.
    const themes = generatedChromeBytes("assets/css/themes.css")?.toString();
    expect(themes).toBe(renderThemesCss());
    expect(themes).toStartWith("/* GENERATED by scripts/gen-themes-css.ts");
    expect(themes).toContain(".fa-sticky-board:not([data-fa-sticky-theme])");
    expect(generatedChromeBytes("assets/css/avatars.css")?.toString()).toBe(renderAvatarsCss());
    expect(generatedChromeBytes("assets/js/docs-ui.js")).toBeUndefined();
  });
});
