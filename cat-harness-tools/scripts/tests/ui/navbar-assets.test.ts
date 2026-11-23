import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { navbarAssetPaths, navbarCssFile, navbarJsFile, runtimeNote } from "../../gen-navbar-assets.ts";
import { PIN_FILE } from "../../check-bun-pin.ts";
import { NAVBAR_JS, RAIL_DATA_DIR, expandRail, injectRail, railPageOf } from "../../lib/harness-rail.ts";
import { NAVBAR_CSS } from "../../lib/navbar.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { siteDirFor } from "../../../schemas/kg/cat-harness.js";

/**
 * The rail from shared data — bean `lnoy`. Owner, 2026-10-05: *"4. Option 3
 * everywhere"*.
 *
 * The property that matters is ONE DRAWING: a page railed from shared data,
 * once `navbar.js` has run, shows the rail the build would have rendered into
 * it. `expandRail` runs the code `navbar.js` bundles, so comparing it with the
 * server's own rendering compares the two places the drawing runs.
 */
describe("the committed navbar.css and navbar.js are what the generator writes", () => {
  test("navbar.css — run `bun run cat navbar:assets` if not", () => {
    const { css } = navbarAssetPaths();
    expect(existsSync(css)).toBe(true);
    expect(readFileSync(css, "utf-8")).toBe(navbarCssFile());
  });

  test("navbar.js — run `bun run cat navbar:assets` if not", async () => {
    const { js } = navbarAssetPaths();
    expect(existsSync(js)).toBe(true);
    const want = await navbarJsFile();
    const note = runtimeNote();
    if (note && readFileSync(js, "utf-8") !== want) console.warn(`navbar.js: ${note}`);
    expect(readFileSync(js, "utf-8")).toBe(want);
  });
});

describe("a stale navbar.js names a Bun that is not the pinned one", () => {
  // A pin of its own, so this does not depend on the monorepo's root file
  // (cat-harness also runs standalone, where that file is absent).
  const root = mkdtempSync(join(tmpdir(), "navbar-pin-"));
  // At PIN_FILE, wherever the pin lives (cat-harness/ since bean `ar1s` phase 4).
  mkdirSync(dirname(join(root, PIN_FILE)), { recursive: true });
  writeFileSync(join(root, PIN_FILE), "1.3.14\n");

  test("silent when the running Bun is the pin", () => {
    expect(runtimeNote("1.3.14", root)).toBeUndefined();
  });

  test("names both versions when they differ", () => {
    const note = runtimeNote("1.4.2", root);
    expect(note).toContain("Bun 1.4.2");
    expect(note).toContain(".bun-version pins 1.3.14");
  });

  test("silent when there is no pin to compare with", () => {
    expect(runtimeNote("1.4.2", mkdtempSync(join(tmpdir(), "navbar-nopin-")))).toBeUndefined();
  });
});

describe("a page railed from shared data", () => {
  const SHELL = "<!doctype html><html><head><title>x</title></head><body><h1>x</h1><h2 id=\"a\">A</h2><h2 id=\"b\">B</h2></body></html>";
  const opts = (toRoot: string) => ({
    instance: "C@T Harness",
    toRoot,
    homeLabel: "folio-assistant",
    links: [
      { label: "Library", href: `${toRoot}/cat-harness/library/`, description: "L1 source content" },
      { label: "Schemas", href: `${toRoot}/cat-harness/schemas/` },
    ],
    harnesses: [{ label: "WHO IRIS", href: `${toRoot}/who-iris/` }],
  });
  const emitted = new Map<string, string>();
  const emit = (file: string, body: string) => emitted.set(file, body);
  const readData = (name: string): string | undefined => {
    const body = emitted.get(`${RAIL_DATA_DIR}/${name}.js`);
    return body === undefined ? undefined : (JSON.parse(body.slice(body.indexOf("]=") + 2, body.lastIndexOf(";"))) as string);
  };
  const navOf = (html: string) => html.slice(html.indexOf('<nav class="fa-nav"'), html.indexOf("</nav>") + 6);

  test("draws EXACTLY the rail the build renders — one drawing", () => {
    for (const depth of ["..", "../..", "../../.."]) {
      const server = injectRail(SHELL, opts(depth))!;
      const shared = injectRail(SHELL, { ...opts(depth), emitRailData: emit })!;
      expect(navOf(expandRail(shared, readData))).toBe(navOf(server));
    }
  });

  test("pages at different depths share ONE data file", () => {
    emitted.clear();
    injectRail(SHELL, { ...opts(".."), emitRailData: emit });
    injectRail(SHELL, { ...opts("../../.."), emitRailData: emit });
    expect(emitted.size).toBe(1);
  });

  test("carries only its own block, a Home link, and three links — not the rail's markup", () => {
    const plain = injectRail(SHELL, opts("../.."))!;
    const shared = injectRail(SHELL, { ...opts("../.."), emitRailData: emit })!;
    expect(shared.length).toBeLessThan(plain.length / 4);
    expect(shared).toContain(`<link rel="stylesheet" href="../../${NAVBAR_CSS}">`);
    expect(shared).toContain(`<script src="../../${NAVBAR_JS}" defer></script>`);
    expect(shared).toMatch(/<script src="\.\.\/\.\.\/assets\/navbar\/rail-[a-z0-9]+\.js" defer><\/script>/);
    expect(shared).toContain('<a href="../../">folio-assistant</a>');
    expect(railPageOf(shared)?.documentIndex?.items.length).toBe(2);
  });

  test("its own row is 'you are here', not a link to itself", () => {
    const shared = injectRail(SHELL, { ...opts(".."), here: "/cat-harness/library/", emitRailData: emit })!;
    const nav = navOf(expandRail(shared, readData));
    expect(nav).not.toContain('href="../cat-harness/library/"');
    expect(nav).toContain('href="../cat-harness/schemas/"');
  });

  test("the page HTML stays byte-identical when the rail's links, pages, harnesses or row change (bean g196)", () => {
    // Owner, 2026-10-30: "Give the rail data a stable filename and do the
    // cache-busting outside the page, so railed pages stop changing whenever
    // the rail does."
    const beforeFiles = new Map<string, string>();
    const afterFiles = new Map<string, string>();
    const beforeHtml = injectRail(SHELL, {
      ...opts(".."),
      pages: [{ label: "Home", href: "../" }, { label: "Guide", href: "../guide/" }],
      navbarRow: { icons: ["beans"], counts: { beans: 10 } },
      shareNavbarRow: true,
      emitRailData: (f, b) => void beforeFiles.set(f, b),
    })!;
    const afterHtml = injectRail(SHELL, {
      ...opts(".."),
      mark: { tone: 210 },
      links: [
        { label: "Library", href: "../cat-harness/library/", description: "Updated description" },
        { label: "Catalogue", note: "no viewer by design" },
      ],
      pages: [{ label: "Home", href: "../" }, { label: "Guide", href: "../guide/" }, { label: "New page", href: "../new/" }],
      harnesses: [{ label: "WHO IRIS", href: "../who-iris/" }, { label: "SMART Base", href: "../smart-base/" }],
      navbarRow: { icons: ["beans"], counts: { beans: 11 } },
      shareNavbarRow: true,
      emitRailData: (f, b) => void afterFiles.set(f, b),
    })!;
    expect(afterHtml).toBe(beforeHtml);
    expect([...afterFiles.keys()].sort()).toEqual([...beforeFiles.keys()].sort());
    const readAfter = (name: string): string | undefined => {
      const body = afterFiles.get(`${RAIL_DATA_DIR}/${name}.js`);
      return body === undefined ? undefined : (JSON.parse(body.slice(body.indexOf("]=") + 2, body.lastIndexOf(";"))) as string);
    };
    const expanded = navOf(expandRail(afterHtml, readAfter));
    expect(expanded).toContain("no viewer by design");
    expect(expanded).toContain("New page");
    expect(expanded).toContain("SMART Base");
  });
});

describe("the committed rail data and the pages that name it agree (bean lnoy)", () => {
  // Every viewer generator writes the shared file its pages name, and the
  // file is named by its content — so when a rail changes, the pages move to
  // a new name and the old file is left behind. Neither direction may drift:
  // a page naming a missing file draws only its Home link; a file no page
  // names is stale output. `bun run cat navbar:assets` removes the latter.
  // The pages' site directory, not the chrome's that holds navbar.js (semantic
  // subgraphs, slice 1): rail data serves the harness pages.
  const site = join(HARNESS_ROOT, siteDirFor(HARNESS_ROOT)) + "/";
  const dataDir = site + RAIL_DATA_DIR;
  const files = new Set(
    existsSync(dataDir) ? [...new Bun.Glob("rail-*.js").scanSync({ cwd: dataDir })].map((f) => f.replace(/\.js$/, "")) : [],
  );
  const named = new Set<string>();
  const missing: string[] = [];
  const pages = [...new Bun.Glob("**/*.html").scanSync({ cwd: site })];
  for (const rel of pages) {
    const page = railPageOf(readFileSync(site + rel, "utf-8"));
    if (!page) continue;
    named.add(page.data);
    if (!files.has(page.data)) missing.push(`${rel} names ${page.data}`);
  }

  // Since 2026-10-07 every committed generated page is on the theme's layout
  // and carries no rail, so NO committed page names shared rail data and none
  // is committed: zero is the expected reading. The guard against an empty
  // scan is on the pages READ instead.
  test("the scan read the committed site — an empty scan is not a clean one", () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  test("every page's shared data is committed", () => {
    expect(missing).toEqual([]);
  });

  test("every committed data file is named by a page — run `bun run cat navbar:assets` to remove the rest", () => {
    expect([...files].filter((f) => !named.has(f))).toEqual([]);
  });
});
