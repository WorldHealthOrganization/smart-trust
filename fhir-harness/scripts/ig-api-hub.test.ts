/**
 * `ig-api-hub.ts`: the IG API hub drawn from the index's bound sidecars.
 *
 * @module fhir-harness/scripts/ig-api-hub.test
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hasIgApi, hubEntries, sidecarHref, IG_API_HUB_DEFAULT_PAGE, IG_API_HUB_NODE, igApiHubBody, igApiHubNode, igApiHubPageOf, writeIgApiHubSite } from "./ig-api-hub.ts";
import type { FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";

const ix = {
  artifacts: [
    {
      key: "ValueSet/vs-a",
      resourceType: "ValueSet",
      id: "vs-a",
      sidecars: {
        schema: { url: "https://example.org/ValueSet-vs-a.schema.json", localPath: "fhir-artifact-index/sidecars/ValueSet-vs-a.schema.json" },
        openapi: { url: "https://example.org/ValueSet-vs-a.openapi.json" },
      },
    },
    { key: "CodeSystem/cs", resourceType: "CodeSystem", id: "cs" },
  ],
} as unknown as Pick<FhirArtifactIndex, "artifacts">;

describe("hubEntries", () => {
  it("hubEntriesListBoundSidecars", () => {
    const e = hubEntries(ix);
    expect(e.map((x) => x.file)).toEqual(["ValueSet-vs-a.openapi.json", "ValueSet-vs-a.schema.json"]);
    const schema = e.find((x) => x.label === "JSON Schema")!;
    expect(schema.href).toBe("fhir-artifact-index/sidecars/ValueSet-vs-a.schema.json");
    expect(schema.view).toBe("artifact/ValueSet-vs-a.schema.json.html");
    expect(schema.artefact).toEqual({ key: "ValueSet/vs-a", page: "artifact/ValueSet-vs-a.html" });
    expect(e.find((x) => x.label === "OpenAPI")!.view).toBeUndefined();
    expect(hasIgApi(ix)).toBe(true);
    expect(hasIgApi({ artifacts: [] } as unknown as Pick<FhirArtifactIndex, "artifacts">)).toBe(false);
  });
});

describe("sidecarHref: read from the AST cache commit when the index says so", () => {
  it("sidecarHrefFromBaseOrLocalPath", () => {
    const r = { localPath: "fhir-artifact-index/sidecars/ValueSet-vs-a.schema.json" };
    expect(sidecarHref({}, r, "../")).toBe("../fhir-artifact-index/sidecars/ValueSet-vs-a.schema.json");
    expect(sidecarHref({ sidecarBase: "https://raw.githubusercontent.com/o/ig/abc/ig-api/sidecars" }, r, "../")).toBe("https://raw.githubusercontent.com/o/ig/abc/ig-api/sidecars/ValueSet-vs-a.schema.json");
    expect(sidecarHref({}, { }, "../")).toBeUndefined();
    const e = hubEntries({ ...ix, sidecarBase: "https://raw.example/ig-api/sidecars" });
    expect(e.find((x) => x.label === "JSON Schema")!.href).toBe("https://raw.example/ig-api/sidecars/ValueSet-vs-a.schema.json");
    expect(e.find((x) => x.label === "JSON Schema")!.view).toBe("artifact/ValueSet-vs-a.schema.json.html");
    const n = igApiHubNode({ label: "API", entries: [], documents: ["https://raw.example/ig-api/site/ValueSets.schema.json"] }) as { "schema:workExample": { "schema:name": string; "schema:contentUrl": string }[] };
    expect(n["schema:workExample"][0]).toMatchObject({ "schema:name": "ValueSets.schema.json", "schema:contentUrl": "https://raw.example/ig-api/site/ValueSets.schema.json" });
  });
});

describe("igApiHubNode and igApiHubBody", () => {
  it("hubNodeNamedByLabel", () => {
    const n = igApiHubNode({ label: "Example API", entries: hubEntries(ix), openapi: true, documents: ["B.schema.json", "A.schema.json"] });
    expect(n["schema:name"]).toBe("Example API");
    expect(n["schema:documentation"]).toBe("openapi/");
    expect((n["schema:workExample"] as { "schema:name": string }[]).map((d) => d["schema:name"])).toEqual(["A.schema.json", "B.schema.json"]);
    const body = igApiHubBody("Example API", "../");
    expect(body).toContain(`"node":"../${IG_API_HUB_NODE}"`);
    expect(body).toContain(`src="../assets/ig-api-hub-node.js"`);
  });
});

describe("igApiHubPageOf and writeIgApiHubSite", () => {
  it("hubPageAndSiteWritten", () => {
    const ig = mkdtempSync(join(tmpdir(), "ig-api-hub-"));
    try {
      mkdirSync(join(ig, "input", "pagecontent"), { recursive: true });
      writeFileSync(join(ig, "input", "pagecontent", "api.md"), "<!-- X_CONTENT -->\n");
      expect(igApiHubPageOf(ig, "<!-- X_CONTENT -->")).toBe("api.html");
      expect(igApiHubPageOf(ig, "<!-- OTHER -->")).toBe(IG_API_HUB_DEFAULT_PAGE);
      expect(igApiHubPageOf(ig, undefined)).toBe(IG_API_HUB_DEFAULT_PAGE);
      const site = join(ig, "site");
      mkdirSync(site);
      expect(writeIgApiHubSite({ site, ix, label: "Example API", page: "api.html" })).toEqual(["api.html", IG_API_HUB_NODE, "assets/ig-api-hub-node.js"]);
      expect(readFileSync(join(site, "api.html"), "utf-8")).toContain("<h1>Example API</h1>");
      expect(JSON.parse(readFileSync(join(site, IG_API_HUB_NODE), "utf-8"))["schema:hasPart"]).toHaveLength(2);
    } finally {
      rmSync(ig, { recursive: true, force: true });
    }
  });
});
