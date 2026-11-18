/**
 * P2's refusal record (`p2-refusals.ts`): "publishes no Turtle" and "we
 * ignored its Turtle" must stay distinguishable (bean `ntyj`).
 */
import { describe, expect, it } from "bun:test";
import { combinedRefusals, publisherViewPage, refusals } from "./p2-refusals.ts";
import type { FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";

const ix = {
  id: "x",
  packageId: "example.ig",
  artifacts: [
    { key: "ValueSet/a", resourceType: "ValueSet", id: "a", published: { xml: { url: "https://p/ValueSet-a.xml" }, ttl: { url: "https://p/ValueSet-a.ttl" } } },
    { key: "StructureDefinition/m", resourceType: "StructureDefinition", id: "m", published: { xml: { url: "https://p/StructureDefinition-m.xml" } } },
    { key: "ImplementationGuide/x", resourceType: "ImplementationGuide", id: "x", published: { xml: { url: "https://p/ImplementationGuide-x.xml" }, ttl: { url: "https://p/ImplementationGuide-x.ttl" } } },
  ],
} as unknown as FhirArtifactIndex;

describe("P2 refusal record", () => {
  const r = refusals(ix, "fhir-harness/scripts/p2-refusals.ts");

  it("refusesXmlTtlCitingRuling", () => {
    expect(r.families.xml!.count).toBe(3);
    expect(r.families.ttl!.count).toBe(2);
    expect(r.total).toBe(5);
    expect((r.families.xml!.entries[0] as { reason: string }).reason).toContain("P2");
  });

  it("unpublishedKeptApart", () => {
    expect(r.families["not-published"]!.entries).toEqual([{ artifact: "StructureDefinition/m", missing: ["ttl"] }]);
  });

  it("publisherViewPageNames", () => {
    expect(publisherViewPage({ resourceType: "ValueSet", id: "a" }, "xml")).toBe("ValueSet-a.xml.html");
    expect(publisherViewPage({ resourceType: "StructureDefinition", id: "m" }, "xml")).toBe("StructureDefinition-m.profile.xml.html");
    expect(publisherViewPage({ resourceType: "ImplementationGuide", id: "x" }, "ttl")).toBeUndefined();
  });
});

describe("P2 combined view across IGs (bean ntyj)", () => {
  const script = "fhir-harness/scripts/p2-refusals.ts";
  const other = { id: "y", packageId: "other.ig", artifacts: [{ key: "CodeSystem/c", resourceType: "CodeSystem", id: "c", published: { json: { url: "https://q/CodeSystem-c.json" } } }] } as unknown as FhirArtifactIndex;
  const c = combinedRefusals([{ ig: "example.ig", record: refusals(ix, script) }, { ig: "other.ig", record: refusals(other, script) }], script);

  it("combinedTagsAndSums", () => {
    expect(c.total).toBe(5);
    expect(c.families.xml!.entries.every((e) => (e as { ig: string }).ig === "example.ig")).toBe(true);
    expect(c.subject).toEqual({ kind: "fhir-ig-set", id: "example.ig+other.ig" });
  });

  it("combinedStatesEachIg", () => {
    expect(c.families["by-ig"]!.entries).toEqual([
      { ig: "example.ig", xml: 3, ttl: 2, notPublished: 1 },
      { ig: "other.ig", xml: 0, ttl: 0, notPublished: 1 },
    ]);
    expect(c.families["not-published"]!.entries).toContainEqual({ ig: "other.ig", artifact: "CodeSystem/c", missing: ["xml", "ttl"] });
  });

  it("refusesFewerOrTwice", () => {
    expect(() => combinedRefusals([{ ig: "example.ig", record: refusals(ix, script) }], script)).toThrow("at least two");
    expect(() => combinedRefusals([{ ig: "a", record: refusals(ix, script) }, { ig: "a", record: refusals(ix, script) }], script)).toThrow("twice");
  });
});
