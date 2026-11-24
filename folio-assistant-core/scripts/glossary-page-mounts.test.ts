/**
 * glossary:page leaves a MOUNTED layer's extracted schemes alone (bean
 * `cat-tools-sm8r`, item 4, plan step 3; owner, 2026-11-13, "own layers
 * only"): they are committed in that layer's own repository at its pin.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inMount, isMountedScheme, ownedFilesUnder, writeAt, writesIntoSite } from "./glossary-page.ts";

const root = "/checkout";
const mounts = [join(root, "core-layer"), join(root, "ig-layer")];
const generated = [join(root, "core-layer", "glossary", "generated"), join(root, "own", "glossary", "generated")];

describe("inMount", () => {
  test("a path inside a mount, and the mount itself", () => {
    expect(inMount(join(root, "ig-layer", "x.json"), mounts)).toBe(true);
    expect(inMount(join(root, "ig-layer"), mounts)).toBe(true);
  });
  test("a sibling whose name only starts like a mount is not in it", () => {
    expect(inMount(join(root, "ig-layer-2", "x.json"), mounts)).toBe(false);
  });
});

describe("isMountedScheme", () => {
  test("an extracted scheme under a mounted layer's glossary/generated/ is left alone", () => {
    expect(isMountedScheme(join(root, "core-layer", "glossary", "generated", "some-ig", "skills.glossary.json"), generated, mounts)).toBe(true);
  });
  test("an extracted scheme of the checkout's own layer is written", () => {
    expect(isMountedScheme(join(root, "own", "glossary", "generated", "own", "skills.glossary.json"), generated, mounts)).toBe(false);
  });
  test("any other file in a mount (the site's pages, step 4) is not this filter's", () => {
    expect(isMountedScheme(join(root, "core-layer", "docs", "page.md"), generated, mounts)).toBe(false);
  });
});

// The site's pages and SKOS (bean `cat-tools-sm8r`, item 4): a MOUNTED
// site's output goes to the layer's output root, never into the mount.
describe("the site's pages, at the output root", () => {
  const co = mkdtempSync(join(tmpdir(), "glossary-out-"));
  afterAll(() => rmSync(co, { recursive: true, force: true }));
  const mounted = new Map([["site-layer", "site-layer"]]);
  const site = join(co, "site-layer", "docs");
  const twin = join(co, "build", "layers", "site-layer", "docs");
  const page = join(site, "en", "glossary", "index.md");

  test("a page in a mounted site is written at the output root", () => {
    expect(writeAt(page, co, mounted)).toBe(join(twin, "en", "glossary", "index.md"));
  });
  test("a page in no mount is written where it is", () => {
    const own = join(co, "own-site", "x.md");
    expect(writeAt(own, co, mounted)).toBe(own);
  });
  test("orphans come from the pinned site until an output root exists, then from it alone", () => {
    mkdirSync(join(site, "en", "glossary", "old"), { recursive: true });
    writeFileSync(join(site, "en", "glossary", "old", "index.md"), "pinned");
    const dir = join(site, "en", "glossary");
    expect(ownedFilesUnder(dir, co, mounted)).toEqual([join(dir, "old", "index.md")]);
    mkdirSync(join(twin, "en", "glossary"), { recursive: true });
    writeFileSync(join(twin, "en", "glossary", "index.md"), "computed");
    expect(ownedFilesUnder(dir, co, mounted)).toEqual([join(dir, "index.md")]);
  });
});

describe("writesIntoSite: a repository's own site, `--instance`", () => {
  const site = join("/s");
  const g = join(site, "en", "folio-assistant-core", "glossary");
  const assets = join(g, "assets");
  const at = { site, assets, only: "dpi-h-ra", page: join(g, "instance", "dpi-h-ra", "index.md") };
  test("the instance page and its schemes' SKOS", () => {
    expect(writesIntoSite(at.page, at)).toBe(true);
    expect(writesIntoSite(join(assets, "dpi-h-ra--dpi-h-ra.jsonld"), at)).toBe(true);
  });
  test("its term pages, under the page's own directory", () => {
    expect(writesIntoSite(join(g, "instance", "dpi-h-ra", "dpi-h-ra", "product-registry", "index.md"), at)).toBe(true);
  });
  test("not another layer's page, term pages or SKOS", () => {
    expect(writesIntoSite(join(g, "instance", "smart-base", "index.md"), at)).toBe(false);
    expect(writesIntoSite(join(g, "instance", "smart-base", "smart-base", "actor", "index.md"), at)).toBe(false);
    expect(writesIntoSite(join(assets, "smart-base--smart-base.jsonld"), at)).toBe(false);
  });
  test("nothing outside the site; everything inside it without --instance", () => {
    expect(writesIntoSite(join("/elsewhere", "x.md"), at)).toBe(false);
    expect(writesIntoSite(join(g, "instance", "smart-base", "index.md"), { site, assets })).toBe(true);
  });
});
