/**
 * The JSON view pages' data (`resource-views.ts`): what the Publisher's
 * `<Name>.json.html` shows, computed for a template.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSON_VIEW_SCRIPT, hasJsonView, jsonViewData, rebaseDescriptionLinks } from "./resource-views.ts";
import type { FhirArtifact } from "../schemas/fhir-artifact-index.js";

const vs = {
  key: "ValueSet/Actors",
  resourceType: "ValueSet",
  id: "Actors",
  title: "Actors",
  published: { xml: { url: "https://p/ValueSet-Actors.xml" }, json: { url: "https://p/ValueSet-Actors.json" }, ttl: { url: "https://p/ValueSet-Actors.ttl" } },
} as unknown as FhirArtifact;

describe("JSON views", () => {
  it("jsonViewsWherePublisherWrites", () => {
    expect(hasJsonView(vs)).toBe(true);
    expect(hasJsonView({ ...vs, resourceType: "ImplementationGuide" } as FhirArtifact)).toBe(false);
    expect(hasJsonView({ ...vs, resourceType: "StructureDefinition" } as FhirArtifact)).toBe(false);
    expect(hasJsonView({ ...vs, published: {} } as unknown as FhirArtifact)).toBe(false);
  });

  it("readsFromHeldPackage", () => {
    const d = jsonViewData(vs, "fhir-artifact-index/package.tgz");
    expect(d.package).toBe("../fhir-artifact-index/package.tgz");
    expect(d.entry).toBe("package/ValueSet-Actors.json");
    expect(d.raw).toBe("https://p/ValueSet-Actors.json");
    expect(d.script).toBe(`../${JSON_VIEW_SCRIPT}`);
  });

  it("tabsJsonActiveExtrasAfter", () => {
    const d = jsonViewData(vs, "p.tgz", [{ label: "JSON Schema", href: "x.html", active: false }]);
    expect(d.tabs.map((t) => `${t.label}${t.active ? "*" : ""}`)).toEqual(["Narrative Content", "JSON*", "JSON Schema"]);
    // The heading drops the Publisher's leading ": " (an empty type label in its template).
    expect(d.heading).toBe("Actors - JSON Representation");
  });

  it("loaderPrettyPrintsPackage", () => {
    const js = readFileSync(join(import.meta.dir, "templates", "ig-pages", "resource-json.js"), "utf8");
    expect(js).toContain("JSON.stringify(d, null, 2)");
    expect(js).toContain('DecompressionStream("gzip")');
  });
});

describe("rebaseDescriptionLinks", () => {
  const d = "As defined by the [certificate governance](concepts.html#x), see [spec](https://hl7.org/fhir), [up](../a.html) and [here](#top).";
  it("rebasesRelativeLinks", () => {
    expect(rebaseDescriptionLinks(d, "../")).toBe(
      "As defined by the [certificate governance](../concepts.html#x), see [spec](https://hl7.org/fhir), [up](../a.html) and [here](#top).",
    );
  });
  it("noPagesReducesToText", () => {
    expect(rebaseDescriptionLinks(d, null)).toBe(
      "As defined by the certificate governance, see [spec](https://hl7.org/fhir), [up](../a.html) and [here](#top).",
    );
  });
});
