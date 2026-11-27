/**
 * An edit link names the repository its file's layer DECLARES, not the
 * `origin` of whichever checkout generated the page — bean `5o5c`, owner
 * ruling C (2026-10-22). The rendered link is a msgid in the translation
 * catalogues, so a link that varied with the checkout root made every
 * foreign root read the catalogue as obsolete.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readDeclaration } from "../../../schemas/kg/cat-harness.ts";

import { baseLayerWeb, declaredEditLocation } from "../../gen-docs-pages.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

describe("declaredEditLocation (bean 5o5c)", () => {
  test("a narrative block's link names the harness's declared repository, path unchanged", () => {
    const declared = readDeclaration(HARNESS_ROOT)?.repository;
    expect(declared).toBeDefined();
    // A real narrative, found rather than named: a literal path would be a
    // second record of the corpus for `declared-paths` to police.
    const sourceDir = join(HARNESS_ROOT, "docs", "source");
    // Directories only: `docs/source/README.md` sits beside the page
    // directories, and reading it as one threw ENOTDIR wherever it was listed first.
    const page = readdirSync(sourceDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .find((d) => readdirSync(join(sourceDir, d)).some((f) => f.endsWith(".md")));
    expect(page).toBeDefined();
    const block = readdirSync(join(sourceDir, page!)).find((f) => f.endsWith(".md"))!;
    const target = `docs/source/${page}/${block}`;
    expect(declaredEditLocation(target)).toEqual({ source: target, repo: declared });
  });
});

// The page header's "generated from" link (cat-harness#1150, item 4): for the
// base layer it named the CHECKOUT's origin, so a page rendered in the index
// linked folio-assistant, in an instance root linked that instance, and in a
// bare clone linked cat-harness. derive:publish then rewrote 8 committed pages
// in every root but the one that last committed them.
describe("baseLayerWeb (cat-harness#1150)", () => {
  test("names the base layer's declared repository, whatever the checkout", () => {
    const declared = readDeclaration(HARNESS_ROOT)?.repository;
    expect(declared).toBeDefined();
    expect(baseLayerWeb()).toBe(`https://github.com/${declared}`);
  });
});
