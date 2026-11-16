import { describe, expect, test } from "bun:test";

import {
  IG_METADATA_EXPORTS,
  IG_METADATA_INDEX_SCHEMA_TAG,
  IG_METADATA_UNREACHED_TYPES,
  IgCodeSystemRefSchema,
  IgMetadataIndexSchema,
  dependencyReach,
  igMetadataVerdict,
  type IgMetadataIndex,
} from "./ig-metadata-index";
import { defaultGraphTypologies, graphTypologyIri, graphLayer, isDerivedGraph, isRenderable, processMayWrite } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness";

/**
 * A harvest of one IG, in the shape the three Publisher exports actually take.
 *
 * Built by a helper rather than inlined per test, so a test asserting ONE rule
 * cannot pass because of a second violation elsewhere in its fixture.
 */
function index(over: Partial<IgMetadataIndex> = {}): unknown {
  const base = {
    $schema: IG_METADATA_INDEX_SCHEMA_TAG,
    ig: { packageId: "who.smart.example", version: "1.0.0" },
    source: { harvestedFrom: "https://example.test/ig", harvestedAt: "2026-09-30T00:00:00Z" },
    exports: {
      "valueset-ref-list": "present",
      "codesystem-ref-list": "present",
      "usage-stats": "present",
    },
    valueSetRefs: [{ valueSet: "http://example.test/ValueSet/a", codeSystems: ["http://example.test/CodeSystem/b"] }],
    codeSystemRefs: [{ codeSystem: "http://example.test/CodeSystem/b", usesState: "declared-empty", uses: [] }],
    usageStats: [{ url: "http://example.test/StructureDefinition/x", subject: "extension", paths: ["Patient.extension"] }],
  };
  return { ...base, ...over };
}

describe("a determined empty is never a not-found", () => {
  test("baselineHarvestParses", () => {
    expect(IgMetadataIndexSchema.safeParse(index()).success).toBe(true);
  });

  test("presentWithNoRecordsAccepted", () => {
    const r = IgMetadataIndexSchema.safeParse(index({ valueSetRefs: [] }));
    expect(r.success).toBe(true);
  });

  test("refusesRecordsUnderAbsentExport", () => {
    // Records cannot have come out of a file that was not there. Without this
    // rule, a mis-assembled document would read as an IG that published edges.
    const r = IgMetadataIndexSchema.safeParse(
      index({ exports: { "valueset-ref-list": "absent", "codesystem-ref-list": "present", "usage-stats": "present" } } as Partial<IgMetadataIndex>),
    );
    expect(r.success).toBe(false);
  });

  test("refusesRecordsUnderUnknownExport", () => {
    const r = IgMetadataIndexSchema.safeParse(
      index({ exports: { "valueset-ref-list": "unknown", "codesystem-ref-list": "present", "usage-stats": "present" } } as Partial<IgMetadataIndex>),
    );
    expect(r.success).toBe(false);
  });

  test("unknownAndAbsentDiffer", () => {
    // Nobody looked, versus somebody looked and it was not there.
    const notLooked = IgMetadataIndexSchema.parse(
      index({
        exports: { "valueset-ref-list": "unknown", "codesystem-ref-list": "present", "usage-stats": "present" },
        valueSetRefs: [],
      } as Partial<IgMetadataIndex>),
    );
    const looked = IgMetadataIndexSchema.parse(
      index({
        exports: { "valueset-ref-list": "absent", "codesystem-ref-list": "present", "usage-stats": "present" },
        valueSetRefs: [],
      } as Partial<IgMetadataIndex>),
    );
    expect(igMetadataVerdict(notLooked)).toBe("unknown");
    expect(igMetadataVerdict(looked)).toBe("finding");
  });
});

describe("`uses` — the field bean `nsbb` measured as declared and never populated", () => {
  test("declaredEmptyRepresentable", () => {
    const r = IgCodeSystemRefSchema.safeParse({ codeSystem: "cs", usesState: "declared-empty", uses: [] });
    expect(r.success).toBe(true);
  });

  test("notExportedIsThirdState", () => {
    expect(IgCodeSystemRefSchema.safeParse({ codeSystem: "cs", usesState: "not-exported", uses: [] }).success).toBe(true);
  });

  test("refusesPopulatedEmpty", () => {
    expect(IgCodeSystemRefSchema.safeParse({ codeSystem: "cs", usesState: "populated", uses: [] }).success).toBe(false);
  });

  test("refusesDeclaredEmptyWithEntries", () => {
    expect(IgCodeSystemRefSchema.safeParse({ codeSystem: "cs", usesState: "declared-empty", uses: ["x"] }).success).toBe(false);
  });

  test("refusesNotExportedWithEntries", () => {
    expect(IgCodeSystemRefSchema.safeParse({ codeSystem: "cs", usesState: "not-exported", uses: ["x"] }).success).toBe(false);
  });
});

describe("the measured reach ceiling is an API, not a paragraph", () => {
  test("unreachedTypesOutOfReach", () => {
    for (const t of IG_METADATA_UNREACHED_TYPES) expect(dependencyReach(t)).toBe("out-of-reach");
  });

  test("terminologyInReach", () => {
    expect(dependencyReach("ValueSet")).toBe("exported");
    expect(dependencyReach("CodeSystem")).toBe("exported");
  });

  test("planDefinitionNotExported", () => {
    // The consumer-facing point: a caller that cannot ask this reads silence
    // over most of a real IG as "no dependencies", which is the opposite of
    // what is true.
    expect(dependencyReach("PlanDefinition")).not.toBe("exported");
  });
});

describe("the file declares what it is", () => {
  test("refusesMissingSchemaTag", () => {
    const { $schema: _drop, ...rest } = index() as Record<string, unknown>;
    expect(IgMetadataIndexSchema.safeParse(rest).success).toBe(false);
  });

  test("refusesUnknownTopLevelKey", () => {
    expect(IgMetadataIndexSchema.safeParse({ ...(index() as object), metadataExports: {} }).success).toBe(false);
  });

  test("refusesUndecidedExport", () => {
    expect(
      IgMetadataIndexSchema.safeParse(
        index({ exports: { "valueset-ref-list": "present", "codesystem-ref-list": "present" } } as never),
      ).success,
    ).toBe(false);
  });

  test("refusesMissingVersion", () => {
    expect(IgMetadataIndexSchema.safeParse(index({ ig: { packageId: "p" } } as never)).success).toBe(false);
  });

  test("namesThreeExports", () => {
    expect(IG_METADATA_EXPORTS.length).toBe(3);
  });
});

describe("the graph typology it is held under", () => {
  test("typologyRegisteredDerived", () => {
    expect(defaultGraphTypologies.get("ig-metadata-index")).toBeDefined();
    expect(isRenderable("ig-metadata-index")).toBe(false);
    expect(graphLayer("ig-metadata-index")).toBe("derived");
    expect(isDerivedGraph("ig-metadata-index")).toBe(true);
  });

  test("processMayNotWrite", () => {
    expect(processMayWrite("ig-metadata-index")).toBe(false);
  });

  test("differsFromArtifactIndex", () => {
    // A reconstruction and a transcription. The test is here so a later
    // tidy-up that folds them cannot pass silently — which is exactly the
    // Option A the owner rejected as "making the index a bag".
    const kinds = ["fhir-artifact-index", "ig-metadata-index"].map((k) => (defaultGraphTypologies.has(k) ? graphTypologyIri(k, defaultGraphTypologies.get(k)) : undefined));
    expect(new Set(kinds).size).toBe(2);
  });
});
