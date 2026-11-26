/**
 * FHIR core types resolved from a declared `fhir-core-definitions` graph
 * (bean `cat-tools-t6fz`): loaded by reference, from the
 * release the model states, and never guessed.
 *
 * @module scripts/tests/fhir-core-resolve.test
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { loadFhirCore, readJsonDocument, resolveClassModelRefs, type SchemaDecl } from "../schema-graph.ts";
import { fhirCoreRelease } from "../fhir-logical-model.ts";

const CORE = "http://hl7.org/fhir/StructureDefinition/";

const model = (fhirVersion: string | undefined): string =>
  JSON.stringify({
    resourceType: "StructureDefinition", kind: "logical", name: "Persona", url: "http://example.org/StructureDefinition/Persona",
    ...(fhirVersion ? { fhirVersion } : {}),
    differential: { element: [
      { id: "Persona", path: "Persona" },
      { id: "Persona.code", path: "Persona.code", min: 0, max: "*", type: [{ code: "Coding" }] },
      { id: "Persona.name", path: "Persona.name", min: 1, max: "1", type: [{ code: "string" }] },
    ] },
  });

const coding = JSON.stringify({
  resourceType: "StructureDefinition", kind: "complex-type", derivation: "specialization", name: "Coding", url: `${CORE}Coding`, fhirVersion: "4.0.1",
  baseDefinition: `${CORE}Element`,
  differential: { element: [
    { id: "Coding", path: "Coding" },
    { id: "Coding.system", path: "Coding.system", min: 0, max: "1", type: [{ code: "uri" }] },
    { id: "Coding.code", path: "Coding.code", min: 0, max: "1", type: [{ code: "code" }] },
  ] },
});

/** A fhir-core directory with the given releases. */
function coreDir(releases: Record<string, { status: "read" | "unread"; bodies?: Record<string, string>; listed?: string[] }>): { root: string; dir: string } {
  const root = mkdtempSync(join(tmpdir(), "fhir-core-"));
  const dir = join(root, "fhir-core");
  for (const [r, spec] of Object.entries(releases)) {
    mkdirSync(join(dir, r), { recursive: true });
    const names = spec.listed ?? Object.keys(spec.bodies ?? {});
    writeFileSync(join(dir, r, "manifest.json"), JSON.stringify(
      spec.status === "read"
        ? { $schema: "folio-fhir-core-release/v1", status: "read", definitions: names.map((n) => ({ url: `${CORE}${n}`, file: `StructureDefinition-${n}.json` })) }
        : { $schema: "folio-fhir-core-release/v1", status: "unread", reason: "registry refused" },
    ));
    for (const [n, body] of Object.entries(spec.bodies ?? {})) writeFileSync(join(dir, r, `StructureDefinition-${n}.json`), body);
  }
  return { root, dir };
}

function read(fhirVersion: string | undefined) {
  const r = readJsonDocument(model(fhirVersion), "ig/StructureDefinition-Persona.json")!;
  return r;
}

describe("FHIR core types from a declared fhir-core graph", () => {
  it("maps a fhirVersion to its release, and says nothing for an unknown one", () => {
    expect(fhirCoreRelease("4.0.1")).toBe("r4");
    expect(fhirCoreRelease("4.3.0")).toBe("r4b");
    expect(fhirCoreRelease("5.0.0")).toBe("r5");
    expect(fhirCoreRelease("6.0.0-ballot")).toBeUndefined();
    expect(fhirCoreRelease(undefined)).toBeUndefined();
  });

  it("loads only the referenced core type, from the model's release, and resolves the edge to it", () => {
    const { root, dir } = coreDir({ r4: { status: "read", bodies: { Coding: coding }, listed: ["Coding", "Patient"] } });
    try {
      const persona = read("4.0.1");
      const core = loadFhirCore([dir], persona.refs, new Set(), (p) => relative(root, p));
      expect(core.decls.map((d) => d.name)).toEqual(["Coding"]);
      expect(core.unread).toEqual([]);
      const all: SchemaDecl[] = [...persona.decls, ...core.decls];
      const resolved = resolveClassModelRefs(persona.refs, new Map(all.map((d) => [d.id, d])));
      expect(resolved.edges).toContainEqual(expect.objectContaining({ via: "code", kind: "field", to: "fhir-core/r4/StructureDefinition-Coding.json#Coding" }));
      expect(resolved.unresolved.size).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports an unread release, an unmaterialised body and an unstated version, and loads nothing for them", () => {
    const { root, dir } = coreDir({ r4: { status: "read", listed: ["Coding"] }, r5: { status: "unread" } });
    try {
      const unmaterialised = loadFhirCore([dir], read("4.0.1").refs, new Set(), (p) => relative(root, p));
      expect(unmaterialised.decls).toEqual([]);
      expect(unmaterialised.unread.join("\n")).toContain("not materialised");
      const unreadRelease = loadFhirCore([dir], read("5.0.0").refs, new Set(), (p) => relative(root, p));
      expect(unreadRelease.unread.join("\n")).toContain("release unread — registry refused");
      const noVersion = loadFhirCore([dir], read(undefined).refs, new Set(), (p) => relative(root, p));
      expect(noVersion.decls).toEqual([]);
      expect(noVersion.unread.join("\n")).toContain("state no fhirVersion");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("loads nothing when no layer declares FHIR core", () => {
    expect(loadFhirCore([], read("4.0.1").refs, new Set(), (p) => p)).toEqual({ modules: [], decls: [], edges: [], unread: [] });
  });
});
