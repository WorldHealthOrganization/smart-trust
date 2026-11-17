import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archimateDepictions, archimatePagePath, newestFirst } from "./glossary-archimate.ts";

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
});
