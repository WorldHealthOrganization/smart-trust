import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archimateDepictions, archimatePagePath, depictionHref, newestFirst } from "./glossary-archimate.ts";

describe("glossary-archimate", () => {
  test("newestFirstReleaseBeforeDrafts", () => {
    expect(["0.2.0-draft.3", "0.2.0", "0.3.0-draft.1", "0.2.0-draft.10"].sort(newestFirst)).toEqual([
      "0.3.0-draft.1",
      "0.2.0",
      "0.2.0-draft.10",
      "0.2.0-draft.3",
    ]);
  });

  test("pagePathUsesSingularKindSegments", () => {
    expect(archimatePagePath("en/dpi-h-ra/archimate", "0.3.0-draft.1", "element", "application-component")).toBe(
      "/en/dpi-h-ra/archimate/0.3.0-draft.1/element/application-component/",
    );
    expect(archimatePagePath("en/dpi-h-ra/archimate", "0.3.0-draft.1", "view", "metamodel")).toBe(
      "/en/dpi-h-ra/archimate/0.3.0-draft.1/view/metamodel/",
    );
  });

  test("noModelNoDepictions", async () => {
    const repo = mkdtempSync(join(tmpdir(), "glossary-archimate-"));
    expect((await archimateDepictions(repo, [{ anchor: "a", iri: "i", scheme: "s", id: "t", label: "Trade Item" }])).size).toBe(0);
  });

  test("depictionOnAnotherLayersSiteLinksThatSite", () => {
    const site = mkdtempSync(join(tmpdir(), "glossary-archimate-site-"));
    const path = "/en/dth-sc/archimate/0.1.0-draft.1/element/order-management-system/";
    // Not a site build: the site-root path, as before.
    expect(depictionHref(path, "dth-sc", "https://example.org/dth-sc/")).toBe(path);
    // The site's own layer: its pages are built here, so the path.
    expect(depictionHref(path, "dth-sc", "https://example.org/dth-sc/", { site, own: "dth-sc" })).toBe(path);
    // A mounted layer whose page this site does not carry: its own site.
    expect(depictionHref(path, "dth-sc", "https://example.org/dth-sc/", { site, own: "dth-pc" })).toBe(`https://example.org/dth-sc${path}`);
    expect(depictionHref(path, "dth-sc", "https://example.org/dth-sc/", { site })).toBe(`https://example.org/dth-sc${path}`);
    // No iriBase to point at: the path.
    expect(depictionHref(path, "dth-sc", undefined, { site, own: "dth-pc" })).toBe(path);
    // The page is on this site after all (dth-pc builds dpi-h-ra's): the path.
    mkdirSync(join(site, path), { recursive: true });
    expect(depictionHref(path, "dth-sc", "https://example.org/dth-sc/", { site, own: "dth-pc" })).toBe(path);
  });
});
