/**
 * fhir-harness populates `site.data.fhir` for a just-the-docs render of one
 * IG (bean `bamf`). It writes only what it can source and says what it could
 * not, and it refuses a source that describes a different IG.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { igSiteData } from "./ig-site-data";
import { IPA, IPS, artifactIndex, scratchRepo } from "../test/support/ig-fixture";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe("from sushi-config.yaml (what the IG Publisher reads)", () => {
  test("fieldsFromSushiConfig", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-sushi-"));
    made.push(dir);
    writeFileSync(
      join(dir, "sushi-config.yaml"),
      [
        "id: example.fhir.demo",
        "canonical: http://example.org/fhir/demo",
        "name: DemoIG",
        "title: Demo Implementation Guide",
        "status: draft",
        "version: 0.1.0",
        "fhirVersion: 4.0.1",
        "publisher:",
        "  name: Example Org",
      ].join("\n"),
    );
    const r = igSiteData(dir);
    expect(r.data).toEqual({
      packageId: "example.fhir.demo", // SUSHI: packageId defaults to id
      canonical: "http://example.org/fhir/demo",
      ig: {
        id: "example.fhir.demo",
        url: "http://example.org/fhir/demo/ImplementationGuide/example.fhir.demo",
        name: "DemoIG",
        title: "Demo Implementation Guide",
        version: "0.1.0",
        status: "draft",
        publisher: "Example Org",
        fhirVersion: ["4.0.1"],
      },
    });
    expect(r.undetermined).toEqual([]);
  });
});

describe("from published IGs' artifact indexes", () => {
  // Two IGs, one whose index records its status. The committed WHO layers
  // are checked in `smart-base/scripts/ig-pages-committed.test.ts`.
  const repo = scratchRepo({
    ipa: { index: artifactIndex(IPA, "ipa") },
    ips: { index: artifactIndex(IPS, "ips", "active") },
  });
  made.push(repo);

  describe("an index that records no status", () => {
    const r = igSiteData(join(repo, "ipa"));

    test("indexFieldsFromIndex", () => {
      expect(r.data.packageId).toBe(IPA.packageId);
      expect(r.data.canonical).toBe(IPA.canonical);
      expect(r.data.ig.version).toBe(IPA.version);
      expect(r.data.ig.fhirVersion).toEqual(["4.0.1"]);
      expect(r.provenance["ig.version"]).toBe("fhir-artifact-index/index.json");
    });

    test("listsUnsourcedFields", () => {
      expect(r.undetermined).toEqual(expect.arrayContaining(["ig.id", "ig.name", "ig.publisher"]));
      expect(JSON.stringify(r.data)).not.toContain('""');
    });

    test("noStatusInIndexNoStatus", () => {
      expect(r.data.ig.status).toBeUndefined();
      expect(r.refused).toEqual([]);
    });
  });

  describe("an index that records its status", () => {
    const r = igSiteData(join(repo, "ips"));

    test("statusFromIndex", () => {
      expect(r.data.ig.status).toBe("active");
      expect(r.provenance["ig.status"]).toBe("fhir-artifact-index/index.json");
    });
  });
});

test("noSourceIsError", () => {
  const dir = mkdtempSync(join(tmpdir(), "ig-none-"));
  made.push(dir);
  expect(() => igSiteData(dir)).toThrow(/nothing to populate/);
});

describe("from the FHIR AST first (owner 2026-10-09, bean jut3)", () => {
  const ast = (dir: string, ig: Record<string, unknown> | undefined) => {
    const a = join(dir, "output-ast");
    mkdirSync(a, { recursive: true });
    const resources = ig ? [{ key: `${ig.url}|${ig.version}`, canonical: ig.url, version: ig.version, resourceType: "ImplementationGuide", id: ig.id, file: "ImplementationGuide-x.json", source: null }] : [];
    writeFileSync(join(a, "manifest.json"), JSON.stringify({ $schema: "ig-ast/v1", authority: "cache", provisional: [], resources }));
    writeFileSync(join(a, "dependencies.json"), JSON.stringify({ $schema: "ig-ast-dependencies/v1", dependencies: [] }));
    if (ig) writeFileSync(join(a, "ImplementationGuide-x.json"), JSON.stringify({ resourceType: "ImplementationGuide", ...ig }));
  };
  const IG = {
    id: "example.fhir.demo",
    url: "http://example.org/fhir/demo/ImplementationGuide/example.fhir.demo",
    name: "DemoIG",
    title: "Demo IG (built)",
    version: "0.2.0",
    status: "active",
    publisher: "Example Org",
    fhirVersion: ["4.0.1"],
    packageId: "example.fhir.demo",
  };

  test("astSuppliesEveryField", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-ast-"));
    made.push(dir);
    ast(dir, IG);
    const r = igSiteData(dir);
    expect(r.data).toEqual({
      packageId: "example.fhir.demo",
      canonical: "http://example.org/fhir/demo",
      ig: { id: IG.id, url: IG.url, name: IG.name, title: IG.title, version: IG.version, status: IG.status, publisher: IG.publisher, fhirVersion: IG.fhirVersion },
    });
    expect(r.provenance["ig.version"]).toBe("FHIR AST ImplementationGuide-x.json (cache)");
    expect(r.undetermined).toEqual([]);
    expect(r.disagreements).toEqual([]);
  });

  test("sushiFillsGapsOnly", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-ast-sushi-"));
    made.push(dir);
    const { publisher: _p, ...noPublisher } = IG;
    ast(dir, noPublisher);
    writeFileSync(join(dir, "sushi-config.yaml"), ["id: example.fhir.demo", "canonical: http://example.org/fhir/demo", "version: 0.1.0", "publisher:", "  name: Example Org"].join("\n"));
    const r = igSiteData(dir);
    expect(r.data.ig.version).toBe("0.2.0");
    expect(r.data.ig.publisher).toBe("Example Org");
    expect(r.provenance["ig.publisher"]).toBe("sushi-config.yaml");
    expect(r.disagreements).toEqual(['ig.version: FHIR AST ImplementationGuide-x.json (cache) says "0.2.0", sushi-config.yaml says "0.1.0"']);
  });

  test("astWithoutIgNotUsed", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-ast-empty-"));
    made.push(dir);
    ast(dir, undefined);
    writeFileSync(join(dir, "sushi-config.yaml"), "id: example.fhir.demo\ncanonical: http://example.org/fhir/demo\n");
    const r = igSiteData(dir);
    expect(r.astNotUsed).toContain("holds 0 ImplementationGuide resources");
    expect(r.refused).toEqual([]);
    expect(r.data.packageId).toBe("example.fhir.demo");
  });
});
