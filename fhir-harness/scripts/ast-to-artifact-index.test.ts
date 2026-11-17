/**
 * `ast-to-artifact-index.ts` on a small synthetic AST: the index it derives,
 * and how it compares with a published-output index.
 *
 * The cases are the ones the first real run (smart-trust, 2026-10-02) found:
 * the manifest keys a canonical resource `url|version`, not `Type/id`; an
 * Endpoint's `name` is free text the published list shows as a description;
 * and the published HTML collapses whitespace and Markdown links.
 *
 * @module fhir-harness/scripts/ast-to-artifact-index.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { astToArtifactIndex, attachSidecars, compareIndexes, conceptOf, keepPublishedGrouping, profilesOf, publisherCategory, readerText, withCrossVersionFields } from "./ast-to-artifact-index";
import { readAst } from "./ig-ast";
import { FhirArtifactIndexSchema, type FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";

const X = "http://example.org/ig";

function put(dir: string, rel: string, body: unknown): void {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body));
}

/** An AST with an IG, a CodeSystem, a logical model and an Endpoint. */
function syntheticAst(inputs: Record<string, string> | null = {
  toolchain: "ig-publisher 2.3.4 / core 6.10.4",
  sourceRevision: "a".repeat(40),
  inputDigest: "b".repeat(64),
}) {
  const dir = mkdtempSync(join(tmpdir(), "ast-index-"));
  const res = [
    { resourceType: "ImplementationGuide", id: "example.ig", url: `${X}/ImplementationGuide/example.ig`, version: "1.0.0", name: "ExampleIG", title: "Example IG" },
    { resourceType: "CodeSystem", id: "Colours", url: `${X}/CodeSystem/Colours`, version: "1.0.0", name: "Colours", title: "Colours", description: "See the [palette](p.html).  Two spaces." },
    { resourceType: "StructureDefinition", id: "Cat", url: `${X}/StructureDefinition/Cat`, version: "1.0.0", name: "Cat", title: "Cat", kind: "logical", type: "Cat" },
    { resourceType: "Endpoint", id: "ep-1", name: "Trustlist one\nresolvable at https://x" },
  ];
  const manifestResources = res.map((r) => {
    const file = `resources/${r.resourceType}/${r.id}--0000.json`;
    put(dir, file, r);
    const key = r.url ? `${r.url}|${r.version}` : `${r.resourceType}/${r.id}`;
    return { key, canonical: r.url ?? null, version: r.version ?? null, resourceType: r.resourceType, id: r.id, name: r.name, file, source: `fsh-generated/resources/${r.resourceType}-${r.id}.json` };
  });
  put(dir, "manifest.json", {
    $schema: "ig-ast/v1",
    authority: "cache",
    provisional: ["indices", "dependencies", "versions"],
    generatedAt: "2026-10-01T19:05:45Z",
    ...(inputs ? { inputs } : {}),
    resources: manifestResources,
  });
  put(dir, "dependencies.json", { $schema: "ig-ast-dependencies/v1", authority: "cache", dependencies: [] });
  return readAst(dir);
}

describe("astToArtifactIndex", () => {
  const { index, unreadable } = astToArtifactIndex(syntheticAst(), { instanceId: "example", publishedBase: "https://pub.example.org/ig/" });

  test("validatesWithTypeIdKeys", () => {
    expect(FhirArtifactIndexSchema.safeParse(index).success).toBe(true);
    expect(unreadable).toEqual([]);
    expect(index.artifacts.map((a) => a.key)).toEqual([
      "CodeSystem/Colours",
      "Endpoint/ep-1",
      "ImplementationGuide/example.ig",
      "StructureDefinition/Cat",
    ]);
  });

  test("identityFromIgSourceFromBuild", () => {
    expect(index.packageId).toBe("example.ig");
    expect(index.version).toBe("1.0.0");
    expect(index.canonicalBase).toBe(X);
    expect(index.source).toEqual({ kind: "output", of: "output-ast", revision: "a".repeat(40), readAt: "2026-10-01" });
  });

  test("artefactsAreCompiledCopies", () => {
    for (const a of index.artifacts) {
      expect(a.materialization.state).toBe("materialized");
      expect(a.materialization.purpose).toBe("compiled");
      expect(a.materialization.inputs?.sourceRevision).toBe("a".repeat(40));
    }
  });

  test("endpointTitledById", () => {
    const ep = index.artifacts.find((a) => a.key === "Endpoint/ep-1")!;
    expect(ep.title).toBe("ep-1");
    expect(ep.description).toBe("Trustlist one resolvable at https://x");
    expect(ep.name).toBeUndefined();
  });

  test("publishedUrlsFromPublishedBase", () => {
    const cs = index.artifacts.find((a) => a.key === "CodeSystem/Colours")!;
    expect(cs.published.html?.url).toBe("https://pub.example.org/ig/CodeSystem-Colours.html");
    const ig = index.artifacts.find((a) => a.resourceType === "ImplementationGuide")!;
    expect(ig.published.html).toBeUndefined();
    expect(ig.category).toBeUndefined();
  });

  test("ownSiteLinksTheArtefactPage", () => {
    // The harness's own site: the page is artifact/<Type>-<id>.html, the root holds only the JSON
    // (smart-trust-demo's journey actors linked /ActorDefinition-….html, which no build writes).
    const { index: ix } = astToArtifactIndex(syntheticAst(), { instanceId: "example", publishedBase: "https://alpha.github.io/ig/", publishedLayout: "site" });
    const cs = ix.artifacts.find((a) => a.key === "CodeSystem/Colours")!;
    expect(cs.published).toEqual({
      json: { url: "https://alpha.github.io/ig/CodeSystem-Colours.json" },
      html: { url: "https://alpha.github.io/ig/artifact/CodeSystem-Colours.html" },
    });
    // Every artefact the index lists gets a page on that site, the IG too.
    const ig = ix.artifacts.find((a) => a.resourceType === "ImplementationGuide")!;
    expect(ig.published.html?.url).toBe("https://alpha.github.io/ig/artifact/ImplementationGuide-example.ig.html");
  });

  test("unpublishedArtefactGetsNoLink", () => {
    const { index: ix } = astToArtifactIndex(syntheticAst(), {
      instanceId: "example",
      publishedBase: "https://pub.example.org/ig",
      publishedKeys: new Set(["CodeSystem/Colours"]),
    });
    expect(ix.artifacts.find((a) => a.key === "CodeSystem/Colours")!.published.html?.url).toBe(
      "https://pub.example.org/ig/CodeSystem-Colours.html",
    );
    const ep = ix.artifacts.find((a) => a.key === "Endpoint/ep-1")!;
    expect(ep.published).toEqual({});
    expect(ep.materialization.provenance.upstream).toBeUndefined();
  });

  test("noPublishedBaseNoClaim", () => {
    const { index: bare } = astToArtifactIndex(syntheticAst(), { instanceId: "example" });
    expect(bare.artifacts.every((a) => Object.keys(a.published).length === 0)).toBe(true);
  });

  test("noRevisionNotMaterialized", () => {
    const { index: noRev } = astToArtifactIndex(syntheticAst(null), { instanceId: "example" });
    expect(noRev.artifacts.every((a) => a.materialization.state === "unknown" && a.materialization.note)).toBe(true);
  });
});

describe("withCrossVersionFields", () => {
  const xv = (f: string) => `http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.${f}`;
  const basic = {
    resourceType: "Basic",
    id: "P",
    extension: [
      { url: xv("url"), valueUri: `${X}/ActorDefinition/P` },
      { url: xv("title"), valueString: "A Persona" },
      { url: xv("description"), valueMarkdown: "Someone." },
      { url: xv("experimental"), valueBoolean: true },
      { url: "http://hl7.org/fhir/5.0/StructureDefinition/extension-Other.title", valueString: "not mine" },
    ],
  };

  test("basicReadsCrossVersionFields", () => {
    const r = withCrossVersionFields(basic, "ActorDefinition");
    expect(r.resourceType).toBe("ActorDefinition");
    expect(r.url).toBe(`${X}/ActorDefinition/P`);
    expect(r.title).toBe("A Persona");
    expect(r.description).toBe("Someone.");
    expect(publisherCategory(r)).toBe("Requirements: Actor Definitions");
  });

  test("sameTypeReturnedAsIs", () => {
    const cs = { resourceType: "CodeSystem", id: "c", title: "t" };
    expect(withCrossVersionFields(cs, "CodeSystem")).toBe(cs);
  });
});

describe("publisherCategory", () => {
  test("publisherDefaultGrouping", () => {
    expect(publisherCategory({ resourceType: "StructureDefinition", kind: "logical" })).toBe("Structures: Logical Models");
    expect(publisherCategory({ resourceType: "StructureDefinition", type: "Extension", derivation: "constraint" })).toBe("Structures: Extension Definitions");
    expect(publisherCategory({ resourceType: "StructureDefinition", kind: "resource", derivation: "constraint" })).toBe("Structures: Resource Profiles");
    expect(publisherCategory({ resourceType: "ActorDefinition" })).toBe("Requirements: Actor Definitions");
    expect(publisherCategory({ resourceType: "Endpoint" })).toBe("Other");
    expect(publisherCategory({ resourceType: "ImplementationGuide" })).toBeUndefined();
  });
});

describe("compareIndexes", () => {
  const { index: ast } = astToArtifactIndex(syntheticAst(), { instanceId: "example" });
  const pub = (mut: (ix: FhirArtifactIndex) => void): FhirArtifactIndex => {
    const ix = structuredClone(ast);
    mut(ix);
    ix.count = ix.artifacts.length;
    return ix;
  };

  test("whitespaceAndLinksEquivalent", () => {
    expect(readerText("See the [palette](p.html).  Two spaces.")).toBe("See the palette. Two spaces.");
    const c = compareIndexes(ast, pub((ix) => {
      ix.artifacts.find((a) => a.key === "CodeSystem/Colours")!.description = "See the palette. Two spaces.";
    }));
    expect(c.differs).toEqual([]);
    expect(c.equivalent).toEqual([{ field: "description", count: 1 }]);
  });

  test("missingFieldIsAstRicher", () => {
    const c = compareIndexes(ast, pub((ix) => {
      delete ix.artifacts.find((a) => a.key === "Endpoint/ep-1")!.description;
    }));
    expect(c.astRicher).toEqual([{ field: "description", count: 1 }]);
    expect(c.differs).toEqual([]);
  });

  test("reportsChangeAdditionRemoval", () => {
    const c = compareIndexes(ast, pub((ix) => {
      ix.artifacts.find((a) => a.key === "StructureDefinition/Cat")!.title = "Dog";
      ix.artifacts = ix.artifacts.filter((a) => a.key !== "Endpoint/ep-1");
      ix.artifacts.push({ ...ix.artifacts[0]!, key: "CodeSystem/Gone", id: "Gone" });
    }));
    expect(c.differs).toEqual([{ key: "StructureDefinition/Cat", field: "title", ast: "Cat", published: "Dog" }]);
    expect(c.onlyInAst).toEqual(["Endpoint/ep-1"]);
    expect(c.onlyInPublished).toEqual(["CodeSystem/Gone"]);
  });
});

describe("a resource whose `name` is not a string (bean c65n)", () => {
  test("patientIndexedUnderId", () => {
    const dir = mkdtempSync(join(tmpdir(), "ast-index-patient-"));
    const patient = { resourceType: "Patient", id: "child-1", name: [{ family: "Doe", given: ["Ada"] }] };
    put(dir, "resources/Patient/child-1--0000.json", patient);
    put(dir, "manifest.json", {
      $schema: "ig-ast/v1",
      authority: "cache",
      provisional: [],
      inputs: { toolchain: "t", sourceRevision: "a".repeat(40) },
      resources: [{ key: "Patient/child-1", canonical: null, version: null, resourceType: "Patient", id: "child-1", name: null, file: "resources/Patient/child-1--0000.json", source: null }],
    });
    put(dir, "dependencies.json", { $schema: "ig-ast-dependencies/v1", dependencies: [] });
    const { index, unreadable } = astToArtifactIndex(readAst(dir), { instanceId: "x" });
    expect(unreadable).toEqual([]);
    const p = index.artifacts.find((a) => a.key === "Patient/child-1")!;
    expect(p.title).toBe("child-1");
    expect(p.description).toBeUndefined();
    expect(p.name).toBeUndefined();
  });
});

describe("attachSidecars", () => {
  const sidecars = () => {
    const dir = mkdtempSync(join(tmpdir(), "ast-sidecars-"));
    put(dir, "CodeSystem-Colours.jsonld", { "@context": {} });
    // A logical model's schema named after its TITLE, not its id.
    put(dir, "StructureDefinition-Cat.schema.json", { type: "object" });
    put(dir, "CodeSystem-Colours.displays.json", {});
    // An enumeration of every schema: binds to nothing, and is recorded.
    put(dir, "LogicalModels.schema.json", {});
    put(dir, "README.md", "not a sidecar");
    return dir;
  };

  test("attachSidecarsBindsByTypeId", () => {
    const { index } = astToArtifactIndex(syntheticAst(), { instanceId: "example" });
    const r = attachSidecars(index, sidecars(), { localPrefix: "fhir-artifact-index/sidecars/" });
    expect(FhirArtifactIndexSchema.safeParse(index).success).toBe(true);
    expect(r.attached).toBe(3);
    const cs = index.artifacts.find((a) => a.key === "CodeSystem/Colours")!;
    expect(cs.sidecars?.jsonld?.localPath).toBe("fhir-artifact-index/sidecars/CodeSystem-Colours.jsonld");
    expect(cs.sidecars?.displays?.localPath).toBe("fhir-artifact-index/sidecars/CodeSystem-Colours.displays.json");
    expect(index.artifacts.find((a) => a.key === "StructureDefinition/Cat")!.sidecars?.schema?.bytes).toBeGreaterThan(0);
    expect(index.sidecarApi).toBe("present");
    expect(index.sidecarsUnbound?.map((u) => u.filename)).toEqual(["LogicalModels.schema.json"]);
  });

  test("emptyAstPathRecordsTreePaths", () => {
    const { index } = astToArtifactIndex(syntheticAst(), { instanceId: "example", astPath: "" });
    expect(FhirArtifactIndexSchema.safeParse(index).success).toBe(true);
    expect(index.source.of).toBe(".");
    const paths = index.artifacts.map((a) => (a.materialization as { localPath?: string } | undefined)?.localPath).filter(Boolean);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(p).toMatch(/^resources\//);
  });

  test("servedBaseRecordedAsSidecarBase", () => {
    const { index } = astToArtifactIndex(syntheticAst(), { instanceId: "example" });
    attachSidecars(index, sidecars(), { localPrefix: "fhir-artifact-index/sidecars", servedBase: "https://raw.githubusercontent.com/o/ig/abc/ig-api/sidecars/" });
    expect(FhirArtifactIndexSchema.safeParse(index).success).toBe(true);
    expect(index.sidecarBase).toBe("https://raw.githubusercontent.com/o/ig/abc/ig-api/sidecars");
    // The held path stays: it names the file, and the base says where it is read.
    expect(index.artifacts.find((a) => a.key === "CodeSystem/Colours")!.sidecars?.jsonld?.localPath).toBe("fhir-artifact-index/sidecars/CodeSystem-Colours.jsonld");
    const { index: none } = astToArtifactIndex(syntheticAst(), { instanceId: "example" });
    attachSidecars(none, mkdtempSync(join(tmpdir(), "ast-sidecars-")), { localPrefix: "x", servedBase: "https://raw.example/x" });
    expect(none.sidecarBase).toBeUndefined();
  });

  test("titleStemBindsWithPublishedUrl", () => {
    const { index } = astToArtifactIndex(syntheticAst(), { instanceId: "example" });
    const cat = index.artifacts.find((a) => a.key === "StructureDefinition/Cat")!;
    cat.id = "C4";
    cat.name = "C4";
    cat.title = "Cat: the record";
    const dir = mkdtempSync(join(tmpdir(), "ast-sidecars-"));
    put(dir, "StructureDefinition-Cat_the_record.schema.json", {});
    const r = attachSidecars(index, dir, { localPrefix: "sc", publishedBase: "https://pub.example.org/ig/" });
    expect(r.attached).toBe(1);
    expect(cat.sidecars?.schema).toEqual({ url: "https://pub.example.org/ig/StructureDefinition-Cat_the_record.schema.json", localPath: "sc/StructureDefinition-Cat_the_record.schema.json", bytes: 2 });
  });

  test("noSidecarsCannotTell", () => {
    const { index } = astToArtifactIndex(syntheticAst(), { instanceId: "example" });
    const r = attachSidecars(index, mkdtempSync(join(tmpdir(), "ast-sidecars-")), { localPrefix: "sc" });
    expect(r).toEqual({ attached: 0, unbound: [] });
    expect(index.sidecarApi).toBe("unknown");
    expect(index.sidecarsUnbound).toBeUndefined();
  });
});

describe("keepPublishedGrouping", () => {
  test("publishedGroupingWins", () => {
    const { index } = astToArtifactIndex(syntheticAst(), { instanceId: "example" });
    const published = structuredClone(index);
    const cs = published.artifacts.find((a) => a.key === "CodeSystem/Colours")!;
    cs.category = "Terminology: Colour schemes";
    cs.listedAt = 3;
    published.artifacts = published.artifacts.filter((a) => a.key !== "StructureDefinition/Cat");
    expect(keepPublishedGrouping(index, published)).toBe(2);
    const got = index.artifacts.find((a) => a.key === "CodeSystem/Colours")!;
    expect([got.category, got.listedAt]).toEqual(["Terminology: Colour schemes", 3]);
    expect(index.artifacts.find((a) => a.key === "StructureDefinition/Cat")!.category).toBe("Structures: Logical Models");
    expect(FhirArtifactIndexSchema.safeParse(index).success).toBe(true);
  });
});

describe("what an instance states: profilesOf and conceptOf (owner, 2026-10-12)", () => {
  test("profilesOfAsWritten", () => {
    expect(profilesOf({ meta: { profile: ["http://x/StructureDefinition/p", ""] } })).toEqual(["http://x/StructureDefinition/p"]);
    expect(profilesOf({})).toBeUndefined();
    expect(profilesOf({ meta: { profile: "not a list" } })).toBeUndefined();
  });
  test("conceptKeepsTextAndCodings", () => {
    expect(conceptOf({ code: { coding: [{ system: "http://x/cs", code: "page" }] } })).toEqual({ coding: [{ system: "http://x/cs", code: "page" }] });
    expect(conceptOf({ code: { text: "iHRIS Relationship" } })).toEqual({ text: "iHRIS Relationship" });
  });
  test("codingListIsConcept", () => {
    expect(conceptOf({ code: [{ code: "a", display: "A" }] })).toEqual({ coding: [{ code: "a", display: "A" }] });
    expect(conceptOf({ code: "name" })).toBeUndefined();
    expect(conceptOf({ code: {} })).toBeUndefined();
  });
  test("indexCarriesProfilesAndCode", () => {
    const dir = mkdtempSync(join(tmpdir(), "ast-index-"));
    const r = { resourceType: "Basic", id: "page-role", meta: { profile: [`${X}/StructureDefinition/page`] }, code: { coding: [{ system: `${X}/CodeSystem/k`, code: "page" }] } };
    put(dir, "resources/Basic/page-role--0000.json", r);
    put(dir, "manifest.json", { $schema: "ig-ast/v1", authority: "cache", provisional: [], generatedAt: "2026-10-12T00:00:00Z", inputs: { toolchain: "t", sourceRevision: "a".repeat(40) }, resources: [{ key: "Basic/page-role", canonical: null, version: null, resourceType: "Basic", id: "page-role", file: "resources/Basic/page-role--0000.json", source: "fsh-generated/resources/Basic-page-role.json" }] });
    put(dir, "dependencies.json", { $schema: "ig-ast-dependencies/v1", authority: "cache", dependencies: [] });
    const a = astToArtifactIndex(readAst(dir), { instanceId: "x" }).index.artifacts[0]!;
    expect(a.profiles).toEqual([`${X}/StructureDefinition/page`]);
    expect(a.code).toEqual({ coding: [{ system: `${X}/CodeSystem/k`, code: "page" }] });
  });
});
