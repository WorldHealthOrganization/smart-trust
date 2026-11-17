/**
 * A visualiser page a harness commits in its OWN site directory, rather than
 * in the site owner's (wrong-direction move M1, 2026-10-20), and a wireframe a
 * layer keeps in a `docs` directory other than its site directory (move M3).
 *
 * One fixture checkout: `base` is the site owner (named cat-harness); `top`
 * needs it, declares a visualiser, and holds that visualiser's page at
 * `docs/<visualiser>/`. A second `docs` directory of `top` holds wireframes.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeHeldVisualiserPages } from "../../compose-docs.ts";
import { wireframeSources } from "../../check-wireframes.ts";
import { clearDeclaredVisualisers, heldVisualiserPages, heldVisualiserPaths, viewersOf, visualiserPageRef } from "../../viewer-declarations.ts";
import { findAssetDir, assetDirSuffixes } from "../../wireframe-check.mjs";

const REPO = mkdtempSync(join(tmpdir(), "held-visualiser-"));
afterAll(() => rmSync(REPO, { recursive: true, force: true }));

const put = (rel: string, body: string | object): void => {
  mkdirSync(join(REPO, dirname(rel)), { recursive: true });
  writeFileSync(join(REPO, rel), typeof body === "string" ? body : JSON.stringify(body));
};

put("base/cat-harness.json", {
  name: "cat-harness",
  directories: [{ id: "docs", path: "docs/", graphTypologies: ["docs"] }],
});
put("base/docs/index.md", "---\ntitle: home\n---\n");
put("base/docs/wireframes/index.json", { wireframes: {} });
put("top/top.json", {
  name: "top",
  needs: ["cat-harness"],
  directories: [
    { id: "top-docs", path: "docs/", graphTypologies: ["docs"] },
    { id: "top-notes", path: "notes/", graphTypologies: ["docs"] },
    { id: "top-catalogue", path: "catalogue/", graphTypologies: ["catalogue"] },
  ],
  visualisers: [
    { id: "catalogue", renderedBy: "top-pages", covers: ["top-catalogue"] },
    { id: "other", renderedBy: "other-tool", covers: ["top-catalogue"] },
  ],
});
// The visualiser's own page, drawn by its declared Tool.
put("top/docs/catalogue/index.html", "---\nlayout: default\nrendered-by: top-pages\n---\n<p>catalogue</p>\n");
put("top/docs/catalogue/data.json", "{}");
// A docs page that happens to sit at another visualiser's id, drawn by nobody: not held.
put("top/docs/other/index.html", "<html><head></head><body>docs</body></html>");
put("top/docs/plain.html", "<html></html>");
// Wireframes in the layer's SECOND docs directory.
put("top/notes/wireframes/index.json", { wireframes: { catalogue: { covers: ["top/catalogue"] } } });
put("top/notes/wireframes/catalogue/as-is.html", "<html><body>drawn</body></html>");
clearDeclaredVisualisers();

describe("a visualiser page its own harness holds", () => {
  test("is found by its declared Tool, at the unlocalised route", () => {
    const held = heldVisualiserPages(REPO);
    expect(held.map((h) => [h.visualiser.harness, h.visualiser.id, h.route])).toEqual([["top", "catalogue", "top/catalogue/"]]);
    expect(held[0]!.dir).toBe(join(REPO, "top/docs/catalogue"));
  });

  test("a page at a visualiser's id that its Tool did not draw is the harness's own docs, not held", () => {
    expect(heldVisualiserPages(REPO).some((h) => h.visualiser.id === "other")).toBe(false);
  });

  test("the docs mount leaves it out, relative to the mounted directory", () => {
    expect(heldVisualiserPaths(REPO, join(REPO, "top/docs"))).toEqual(["catalogue"]);
    expect(heldVisualiserPaths(REPO, join(REPO, "top/notes"))).toEqual([]);
  });

  test("a tile's page ref names it where the site publishes it, and the held file as its writer", () => {
    expect(visualiserPageRef(REPO, { harness: "top", visualiser: "catalogue" })).toBe("base/docs/top/catalogue/index.html");
    const [v] = viewersOf({ id: "top-catalogue", path: "catalogue/", graphTypologies: ["catalogue"] }, join(REPO, "top"), REPO);
    expect(v?.ref).toBe("base/docs/top/catalogue/index.html");
    expect(v?.writer).toEqual(["top/docs/catalogue/index.html"]);
  });

  test("compose lays it at its route, and keeps a page the tree already carries", () => {
    const out = mkdtempSync(join(tmpdir(), "held-out-"));
    try {
      const first = writeHeldVisualiserPages(out, REPO);
      expect(first.written).toEqual(["top/catalogue/data.json", "top/catalogue/index.html"]);
      expect(readFileSync(join(out, "top/catalogue/index.html"), "utf-8")).toContain("rendered-by: top-pages");
      expect(existsSync(join(out, "top/other"))).toBe(false);
      writeFileSync(join(out, "top/catalogue/index.html"), "kept");
      const again = writeHeldVisualiserPages(out, REPO);
      expect(again.written).toEqual([]);
      expect(again.collisions).toHaveLength(2);
      expect(readFileSync(join(out, "top/catalogue/index.html"), "utf-8")).toBe("kept");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("wireframes are read from every declared `docs` directory", () => {
  test("an instance's second docs directory is a source, named by the instance", () => {
    const got = wireframeSources(REPO).filter((s) => s.prefix !== "");
    expect(got).toContainEqual({ dir: join(REPO, "top/notes/wireframes"), prefix: "top/" });
  });

  test("wireframe:check finds a topic there with no candidate given", () => {
    expect(findAssetDir(join(REPO, "top"), assetDirSuffixes("as-is", "catalogue"))).toBe(join(REPO, "top/notes/wireframes/catalogue"));
  });
});
