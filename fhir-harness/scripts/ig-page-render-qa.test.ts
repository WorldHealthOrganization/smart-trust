import { describe, expect, test } from "bun:test";
import { pageScanSite } from "./ig-page-render-qa-fixture.ts";
import { blockLeftovers, pageRenderQaMarkdown, pagesOf, PAGE_RENDER_FILE, PAGE_RENDER_JS } from "./ig-page-render-qa.ts";

describe("ig-page-render-qa", () => {
  test("pagesAReaderMeets", () => {
    expect(pagesOf(pageScanSite())).toEqual(["artifact/ActorDefinition-a.html", "index.html"]);
  });

  test("blockRules", () => {
    expect(blockLeftovers("**Persona**: a phone")).toEqual(["bold"]);
    expect(blockLeftovers("1. Plan", "H2")).toEqual([]);
    expect(blockLeftovers("1. Plan", "P")).toEqual(["list marker"]);
    expect(blockLeftovers("[Reference]([Patient])")).toEqual([]);
    expect(blockLeftovers("![Bo]")).toEqual(["image"]);
  });

  // scansDrawnPagesInABrowser is `ig-page-render-qa.e2e.ts`: it needs a browser, and `bun test` runs where none is installed.

  test("qaPanelLoadsResults", () => {
    const md = pageRenderQaMarkdown({ up: "../" }).join("\n");
    expect(md).toContain("### Page scan");
    expect(md).toContain(`data-src="../${PAGE_RENDER_FILE}"`);
    expect(md).toContain('<script src="../assets/fhir-qa/page-render.js" defer></script>');
    expect(() => new Function(PAGE_RENDER_JS)).not.toThrow();
    expect(PAGE_RENDER_JS).not.toContain("innerHTML");
  });
});
