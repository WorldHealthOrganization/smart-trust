/**
 * The text-only tab pages (`resource-views.ts`): each states exactly what the
 * Publisher's does, and nothing where the Publisher's would list data this
 * build cannot render.
 */
import { describe, expect, it } from "bun:test";
import { VIEW_PAGE, examplesPage, historyPage, mdText, resourceFacts, statusLine, testingPage } from "./resource-views.ts";
import type { FhirArtifact } from "../schemas/fhir-artifact-index.js";

const vs = resourceFacts({ resourceType: "ValueSet", id: "Actors", name: "Actors", title: "Actor codes", status: "active", date: "2026-10-01T11:40:21+00:00", experimental: true, url: "http://x/ValueSet/Actors" });
const ep = resourceFacts({ resourceType: "Endpoint", id: "E-1", name: "Latvia trust list", status: "active" });
const lm = resourceFacts({ resourceType: "StructureDefinition", id: "CWT", name: "CWT", status: "active", date: "2026-10-01", kind: "logical", url: "http://x/StructureDefinition/CWT" });
const a = { key: "x", resourceType: "Endpoint", id: "E-1" } as unknown as FhirArtifact;

describe("tab pages", () => {
  it("historyHeadingAndSentence", () => {
    const p = historyPage(a, ep, [])!;
    expect(p.heading).toBe("Latvia trust list - Change History");
    expect(p.sections).toEqual([{ text: "History of changes for E-1 ." }]);
    expect(p.status).toBeUndefined();
    expect(historyPage(a, lm, [])!.sections[0]!.text).toBe("Changes in the CWT logical model.");
  });

  it("testingTypeTitleExperimental", () => {
    const p = testingPage(vs, [], false)!;
    expect(p.heading).toBe("ValueSet: Actor codes - Testing (Experimental)");
    expect(p.status).toBe("Active as of 2026-10-01");
    expect(p.sections.map((s) => s.heading)).toEqual(["Test Plans", "Test Scripts"]);
    expect(testingPage(vs, [], true)).toBeUndefined();
    expect(testingPage(ep, [], false)).toBeUndefined(); // no canonical URL: no testing page
    expect(testingPage(lm, [], false)!.sections[0]!.text).toBe("No test plans are currently available for the Profile.");
  });

  it("examplesOnlyUnclaimedModel", () => {
    expect(examplesPage(lm, [], false)!.heading).toBe("Logical Model: CWT - Examples");
    expect(examplesPage(lm, [], true)).toBeUndefined();
  });

  it("statusLineAndEscaping", () => {
    expect(statusLine(ep)).toBeUndefined();
    expect(mdText("a_b*[c]")).toBe("a\\_b\\*\\[c\\]");
  });

  it("viewPagesOneRule", () => {
    for (const f of ["X.json.md", "X.schema.json.md", "X.jsonld.md", "X.change.history.md", "X-testing.md", "X.profile.history.md", "X.profile.json.md", "X-examples.md"]) expect(VIEW_PAGE.test(f)).toBe(true);
    expect(VIEW_PAGE.test("ValueSet-Actors.md")).toBe(false);
  });
});
