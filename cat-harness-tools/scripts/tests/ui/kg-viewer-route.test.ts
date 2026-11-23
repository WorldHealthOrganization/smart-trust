import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { kgViewerRoute, upFrom, viewerHtml, writeViewer } from "../../kg-viewer.ts";

// Owner, 2026-10-20: "move graph viewer so aligns" — the viewer leaves
// `<stub>/` (the layer as itself) for a viewer's route.
describe("kg-viewer route", () => {
  test("the viewer is published at <locale>/<stub>/kg/", () => {
    expect(kgViewerRoute("cat-harness")).toBe("en/cat-harness/kg/");
    expect(upFrom("en/cat-harness/kg/")).toBe("../../../");
  });

  test("the page reads its graph from the site root, and the old address forwards", () => {
    const site = mkdtempSync(join(tmpdir(), "kg-viewer-"));
    const { page, forwarded } = writeViewer(site, "cat-harness", (up) => `doc=${up}cat-harness.jsonld`);
    expect(readFileSync(page, "utf-8")).toBe("doc=../../../cat-harness.jsonld");
    expect(readFileSync(forwarded!, "utf-8")).toContain(`location.replace("../en/cat-harness/kg/"`);
  });

  // #603 decision 1b (owner, 2026-10-23): the host's document is under its
  // own directory like every layer's, so the page climbs to the root and
  // descends `<name>/<stub>.jsonld`, not the old root `<stub>.jsonld`.
  test("the page reads <name>/<stub>.jsonld, the host's included", () => {
    const html = viewerHtml("cat-harness", [], [], "../../../");
    expect(html).toContain('"../../../cat-harness/cat-harness.jsonld"');
    expect(html).not.toContain('"../../../cat-harness.jsonld"');
    expect(viewerHtml("cat-harness", [], [], "../", "x/y.jsonld")).toContain('"../x/y.jsonld"');
  });

  test("a page already at <stub>/ is the instance's, and is not replaced", () => {
    const site = mkdtempSync(join(tmpdir(), "kg-viewer-"));
    mkdirSync(join(site, "cat-harness"));
    writeFileSync(join(site, "cat-harness", "index.html"), "instance");
    const { forwarded } = writeViewer(site, "cat-harness", () => "viewer");
    expect(forwarded).toBeUndefined();
    expect(readFileSync(join(site, "cat-harness", "index.html"), "utf-8")).toBe("instance");
    expect(existsSync(join(site, "en", "cat-harness", "kg", "index.html"))).toBe(true);
  });
});
