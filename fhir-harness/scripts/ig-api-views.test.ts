/**
 * The IG API view pages' data (`ig-api-views.ts`): what the Publisher's
 * `<Name>.schema.json.html` / `.jsonld.html` show, computed for a template.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IG_API_VIEW_SCRIPT, igApiServed, igApiViewData, igApiViews } from "./ig-api-views.ts";
import type { FhirArtifact } from "../schemas/fhir-artifact-index.js";

const a = {
  key: "ValueSet/Actors",
  resourceType: "ValueSet",
  id: "Actors",
  title: "Actors",
  published: { xml: { url: "https://p/ValueSet-Actors.xml" }, json: { url: "https://p/ValueSet-Actors.json" } },
  sidecars: {
    schema: { url: "https://p/schemas/ValueSet-Actors.schema.json", localPath: "fhir-artifact-index/sidecars/ValueSet-Actors.schema.json" },
    jsonld: { url: "https://p/ValueSet-Actors.jsonld", localPath: "fhir-artifact-index/sidecars/ValueSet-Actors.jsonld" },
    displays: { url: "https://p/schemas/ValueSet-Actors.displays.json", localPath: "fhir-artifact-index/sidecars/ValueSet-Actors.displays.json" },
  },
} as unknown as FhirArtifact;

describe("IG API views", () => {
  it("viewsForHeldSidecarsOnly", () => {
    expect(igApiViews(a).map((v) => v.file)).toEqual(["ValueSet-Actors.schema.json", "ValueSet-Actors.jsonld"]);
    const byRef = { ...a, sidecars: { schema: { url: "https://p/x.schema.json" } } } as unknown as FhirArtifact;
    expect(igApiViews(byRef)).toEqual([]);
  });

  it("tabsNarrativeJsonViews", () => {
    const d = igApiViewData(a, igApiViews(a)[1]!);
    expect(d.tabs.map((t) => `${t.label}${t.active ? "*" : ""}`)).toEqual(["Narrative Content", "JSON", "JSON Schema", "JSON-LD*"]);
    expect(d.tabs[0]!.href).toBe("ValueSet-Actors.html");
    expect(d.label).toBe("JSON-LD");
    expect(d.script).toBe(`../${IG_API_VIEW_SCRIPT}`);
    // Fetched from the SERVED graph, not from a copy beside the page.
    expect(d.src).toBe("../fhir-artifact-index/sidecars/ValueSet-Actors.jsonld");
    // Read from the AST cache commit when the index names a sidecar base.
    expect(igApiViewData(a, igApiViews(a)[1]!, "../", false, "https://raw.example/ig-api/sidecars").src).toBe("https://raw.example/ig-api/sidecars/ValueSet-Actors.jsonld");
    // The page carries no file text: the loader fetches it (bean `680p`).
    expect(JSON.stringify(d)).not.toContain("@context");
  });

  it("loaderPrettyPrintsJson", () => {
    const js = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-api-view.js"), "utf8");
    expect(js).toContain("JSON.stringify(d, null, 2)");
  });

  it("templateOpensWithComment", () => {
    const t = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-api-view.liquid"), "utf8");
    expect(t.startsWith("{%- comment -%}")).toBe(true);
    expect(t).not.toMatch(/\|\s*(plus|minus|size|replace|jsonify)\b/);
  });

  it("jsonTabOnlyWhenWritten", () => {
    const withJson = { ...a, resourceType: "ValueSet", published: { json: { url: "https://p/ValueSet-Actors.json" } } } as unknown as FhirArtifact;
    const v = igApiViews(withJson)[0]!;
    expect(igApiViewData(withJson, v).tabs.find((t) => t.label === "JSON")!.href).toBe("https://p/ValueSet-Actors.json");
    expect(igApiViewData(withJson, v, "../", true).tabs.find((t) => t.label === "JSON")!.href).toBe("ValueSet-Actors.json.html");
  });
});

describe("igApiServed finds the declaration by its own name, not the directory's (bean rbz3)", () => {
  it("servedFoundBySelfName", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-api-served-"));
    try {
      const root = join(d, "ig-data");
      mkdirSync(root);
      const decl = (name: string) => ({
        name,
        directories: [
          { path: "fhir-artifact-index/", graphTypologies: ["fhir-artifact-index"], served: true },
          { path: "docs/", instanceRoot: true, composed: true },
        ],
      });
      writeFileSync(join(root, "acme-ig.json"), JSON.stringify(decl("acme-ig")));
      expect(igApiServed(root)).toEqual({ ok: true });
      // A file named after the directory but declaring another name is not a declaration.
      rmSync(join(root, "acme-ig.json"));
      writeFileSync(join(root, "ig-data.json"), JSON.stringify(decl("acme-ig")));
      expect(igApiServed(root)).toEqual({ ok: false, why: "ig-data/ holds no instance declaration" });
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});
