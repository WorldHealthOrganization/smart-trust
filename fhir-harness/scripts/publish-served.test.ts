import { describe, expect, it } from "bun:test";
import { planServed } from "./publish-served";

const served = [
  { name: "my-ig", dir: "/r/my-ig/fhir-artifact-index", route: "my-ig/fhir-artifact-index" },
  { name: "my-ig", dir: "/r/my-ig/openapi", route: "my-ig/openapi" },
  { name: "other", dir: "/r/other/openapi", route: "other/openapi" },
];

describe("publish-served", () => {
  it("copiesServedDirsToRoot", () => {
    const p = planServed(served, "my-ig", "/site", (x) => x.startsWith("/r/"));
    expect(p.copy).toEqual([
      { from: "/r/my-ig/fhir-artifact-index", to: "/site/fhir-artifact-index" },
      { from: "/r/my-ig/openapi", to: "/site/openapi" },
    ]);
    expect(p.refused).toEqual([]);
  });

  it("refusesAlreadyPublished", () => {
    const p = planServed(served, "my-ig", "/site", (x) => x.startsWith("/r/") || x === "/site/openapi");
    expect(p.copy.map((c) => c.to)).toEqual(["/site/fhir-artifact-index"]);
    expect(p.refused).toEqual(["openapi/ is declared served, but the site already publishes something there"]);
  });

  it("refusesMissingDir", () => {
    const p = planServed(served, "my-ig", "/site", (x) => x === "/r/my-ig/openapi");
    expect(p.refused).toEqual(["fhir-artifact-index/ is declared served, but /r/my-ig/fhir-artifact-index does not exist"]);
  });
});
