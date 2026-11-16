/**
 * DAK block authoring: the kinds declared in the previous change are now real
 * — builders, Zod schemas, label prefixes, and discovery.
 *
 * Moved from `cat-harness/scripts/tests/dak-blocks.test.ts` with the module it
 * tests (bean `1335`). Core no longer declares the DAK kinds, so every claim
 * here about how CORE treats one — discovery, adapter ownership, JSON-LD
 * typing — is now made through the registry smart-base's contribution fills,
 * which is the path a running sweep takes.
 *
 * The subtle part is discovery. `BLOCK_BUILDER_RE` recognises a manifest by
 * scanning for `export default <builder>(`, and until now builder name and
 * kind string were the same token, so the regex alternated over the kinds
 * themselves. A DAK kind is multi-word (`decision-table`) and a hyphen is not
 * a valid identifier, so the two namespaces separate: the kind is data, the
 * builder is an identifier, and `kindForBuilder` maps back. Get that wrong and
 * blocks are discovered under the name `decisionTable`, which matches no
 * criterion's `appliesTo` and no adapter — the 461-block failure again, in a
 * new place.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { resolve } from "path";
import {
  DAK_BLOCK_KINDS,
  DAK_COMPONENTS,
  DAK_COMPONENT_DESCRIPTIONS,
  DAK_COMPONENT_FIELDS,
  DAK_COMPONENT_KINDS,
  DAK_KIND_BUILDERS,
  DAK_UNFORMALIZED_COMPONENTS,
  DAK_LABEL_PREFIXES,
} from "./dak-kinds";
import {
  BLOCK_KINDS,
  CONTENT_PROFILES,
  kindForBuilder,
  adapterForKind,
  profileAcceptsKind,
} from "../platform/index.js";
import {
  decisionTable,
  valueSet,
  businessProcess,
  planDefinition,
  layerForKind,
  dakComponentsWithoutL2,
  healthIntervention,
  testScenario,
  type DakBlock,
} from "./dak-blocks";
import { KNOWN_LABEL_PREFIXES } from "../platform/index.js";
import { DAK_KIND_TO_WHO_MODEL, DAK_KIND_TO_FOLIO_TYPE } from "./dak-jsonld";
import { DAK_COMPONENT_SOURCE_KEYS } from "./dak";
import { assertPrefixesInSync, typesForKind } from "../platform/index.js";
import { readBlockManifest } from "../platform/index.js";
import { ContributionRegistry, composedKindOwner } from "../platform/index.js";
import { loadContributionsSync } from "../platform/index.js";
import { smartBaseRegistrySync } from "../scripts/tests/smart-base-consumer";

/**
 * The registry a folio depending on smart-base gets, loaded as
 * `loadContributions` does. Since bean riit, step 3, the DAK kinds reach it as
 * smart-base's declared `block-kinds/` nodes through the dependency walk, not
 * from an array `contributions.ts` returns. The folio is a fixture naming
 * smart-base by path (`smart-base-consumer.ts`): `smart-ig`, which used to be
 * that folio, is a separate repository the composition does not mount.
 */
const registry = smartBaseRegistrySync();
const builders = registry.contributedBuilders();

const DIR = mkdtempSync(join(tmpdir(), "dak-blocks-"));
afterAll(() => {
  try {
    rmSync(DIR, { recursive: true, force: true });
  } catch {}
});

describe("builders", () => {
  test("decisionTableBuilderDerivesL2", () => {
    const b = decisionTable({ label: "dt:anc-danger-signs", title: "ANC danger signs" });
    expect(b.kind).toBe("decision-table");
    expect(b.layer).toBe("L2");
  });

  test("l3KindsDeriveL3", () => {
    expect(valueSet({ label: "vs:danger-signs" }).layer).toBe("L3");
    expect(planDefinition({ label: "pd:anc-contact" }).layer).toBe("L3");
  });

  test("layerForKindPartitionsKinds", () => {
    for (const k of DAK_BLOCK_KINDS) {
      expect(["L2", "L3"]).toContain(layerForKind(k));
    }
  });

  test("rejectsWrongLabelPrefix", () => {
    // The paper side enforces this via labelForKind; DAK must not be laxer.
    expect(() => decisionTable({ label: "def:not-a-decision-table" })).toThrow();
    expect(() => valueSet({ label: "dt:wrong-prefix" })).toThrow();
  });

  test("keepsEditorialFields", () => {
    const b = businessProcess({
      label: "bp:anc-registration",
      title: "ANC registration",
      uses: ["de:patient-id"],
      tags: ["anc"],
      realises: "dt:anc-danger-signs",
    });
    expect(b.uses).toEqual(["de:patient-id"]);
    expect(b.realises).toBe("dt:anc-danger-signs");
  });

  test("keepsAuthorStatedLayer", () => {
    const b = decisionTable({ label: "dt:x", layer: "L3" });
    expect(b.layer).toBe("L3");
  });
});

describe("builder ↔ kind mapping", () => {
  test("builderNamesAreIdentifiers", () => {
    for (const k of DAK_BLOCK_KINDS) {
      const builder = DAK_KIND_BUILDERS[k];
      expect(builder).toBeTruthy();
      expect(builder).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
    }
  });

  test("builderNamesRoundTripToKind", () => {
    for (const k of DAK_BLOCK_KINDS) {
      expect(kindForBuilder(DAK_KIND_BUILDERS[k], builders)).toBe(k);
    }
  });

  test("coreUnawareOfDakBuilders", () => {
    // The point of bean 1335: core's built-in vocabulary is paper only.
    for (const k of DAK_BLOCK_KINDS) {
      if ((BLOCK_KINDS as readonly string[]).includes(DAK_KIND_BUILDERS[k])) continue;
      expect(kindForBuilder(DAK_KIND_BUILDERS[k])).toBeUndefined();
    }
  });

  test("paperBuildersMapToThemselves", () => {
    for (const k of BLOCK_KINDS) expect(kindForBuilder(k, builders)).toBe(k);
  });

  test("builderNamesUnique", () => {
    const names = [...BLOCK_KINDS, ...Object.values(DAK_KIND_BUILDERS)];
    expect(new Set(names).size).toBe(names.length);
  });

  test("unknownBuilderMapsToUndefined", () => {
    expect(kindForBuilder("notABuilder", builders)).toBeUndefined();
  });
});

describe("label prefixes", () => {
  test("dakPrefixesAvoidPaperPrefixes", () => {
    const paper = new Set([
      "def", "thm", "lem", "prop", "cor", "rem", "ex", "conj",
      "prf", "sim", "eq", "fig", "tbl", "sec", "chap", "app", "bib",
    ]);
    for (const k of DAK_BLOCK_KINDS) {
      expect(paper.has(DAK_LABEL_PREFIXES[k])).toBe(false);
    }
  });

  test("dakPrefixesUnique", () => {
    const v = Object.values(DAK_LABEL_PREFIXES);
    expect(new Set(v).size).toBe(v.length);
  });

  test("corePrefixListsInSync", () => {
    // KNOWN_LABEL_PREFIXES (validation) and KIND_PREFIXES (JSON-LD @id
    // minting) list the BUILT-IN prefixes; DAK's left both in bean 1335.
    expect(() => assertPrefixesInSync(KNOWN_LABEL_PREFIXES)).not.toThrow();
  });

  test("dakPrefixesOnlyContributed", () => {
    const contributed = registry.contributedLabelPrefixes();
    for (const k of DAK_BLOCK_KINDS) {
      expect(contributed).toContain(DAK_LABEL_PREFIXES[k]);
      expect(KNOWN_LABEL_PREFIXES).not.toContain(`${DAK_LABEL_PREFIXES[k]}:`);
    }
  });
});

describe("JSON-LD typing", () => {
  test("dakKindsTypedThroughContribution", () => {
    for (const k of DAK_BLOCK_KINDS) {
      expect(DAK_KIND_TO_FOLIO_TYPE[k]).toBeTruthy();
      expect(typesForKind(k, registry).length).toBeGreaterThan(0);
      // Without the registry core does not know the kind, so it types nothing.
      expect(typesForKind(k)).toEqual([]);
    }
  });

  test("valueSetTypedNotFhir", () => {
    // The block is the authored manifest; the FHIR ValueSet is what its .fsh
    // compiles to. Typing the manifest as a FHIR resource would invite a
    // consumer to read FHIR fields off it.
    expect(typesForKind("value-set", registry)).toEqual(["smart-base:ValueSet"]);
  });

  test("docoCoTypingSparing", () => {
    expect(typesForKind("decision-table", registry)).toEqual(["smart-base:DecisionTable", "doco:Table"]);
    expect(typesForKind("persona", registry)).toEqual(["smart-base:Persona"]);
  });

  test("paperTypingUnchanged", () => {
    expect(typesForKind("theorem")).toEqual(["folio-assistant-sci:Theorem", "doco:Section"]);
    expect(typesForKind("theorem", registry)).toEqual(["folio-assistant-sci:Theorem", "doco:Section"]);
  });
});

describe("discovery", () => {
  beforeAll(() => {
    mkdirSync(join(DIR, "ch01"), { recursive: true });
    writeFileSync(
      join(DIR, "ch01", "dt-anc-danger-signs.ts"),
      `import { decisionTable } from "../../smart-base/schemas/dak-blocks";
export default decisionTable({ label: "dt:anc-danger-signs" });\n`,
    );
    writeFileSync(
      join(DIR, "ch01", "vs-danger-signs.ts"),
      `export default valueSet({ label: "vs:danger-signs" });\n`,
    );
    writeFileSync(
      join(DIR, "ch01", "thm-main.ts"),
      `export default theorem({ label: "thm:main" });\n`,
    );
  });

  test("discoversDakManifestByKind", () => {
    const m = readBlockManifest(join(DIR, "ch01", "dt-anc-danger-signs.ts"), builders);
    expect(m).toEqual({ kind: "decision-table", label: "dt:anc-danger-signs" });
  });

  test("discoversMultiWordL3Kind", () => {
    const m = readBlockManifest(join(DIR, "ch01", "vs-danger-signs.ts"), builders);
    expect(m?.kind).toBe("value-set");
  });

  test("noDiscoveryWithoutContribution", () => {
    expect(readBlockManifest(join(DIR, "ch01", "dt-anc-danger-signs.ts"))).toBeUndefined();
  });

  test("paperManifestsUnaffected", () => {
    const m = readBlockManifest(join(DIR, "ch01", "thm-main.ts"));
    expect(m).toEqual({ kind: "theorem", label: "thm:main" });
    expect(readBlockManifest(join(DIR, "ch01", "thm-main.ts"), builders)).toEqual(m);
  });

  test("discoveredKindResolvesToDakAdapter", () => {
    const m = readBlockManifest(join(DIR, "ch01", "dt-anc-danger-signs.ts"), builders)!;
    expect(adapterForKind(m.kind)).toBeUndefined();
    expect(composedKindOwner(m.kind, registry, adapterForKind)).toBe("dak");
  });

  test("everyDakKindOwnedByDakAdapter", () => {
    for (const k of DAK_BLOCK_KINDS) expect(composedKindOwner(k, registry, adapterForKind)).toBe("dak");
  });
});

describe("the union stays partitioned", () => {
  test("dakBlockKindNotPaperKind", () => {
    const b: DakBlock = decisionTable({ label: "dt:x" });
    expect(BLOCK_KINDS as readonly string[]).not.toContain(b.kind);
  });
});

describe("WHO DAK component coverage", () => {
  // WHO publishes eight components; test scenarios was added later, which is
  // why older material — sgex's agent instructions among it — says "the 8 core
  // DAK components". Anything counting against an older source is off by one,
  // so the list is pinned here rather than recited from memory at each use.
  test("componentCountEndsWithTestScenarios", () => {
    expect(DAK_COMPONENTS.length).toBe(10);
    expect(DAK_COMPONENTS[0]).toBe("health-interventions-and-recommendations");
    expect(DAK_COMPONENTS[9]).toBe("test-scenarios");
  });

  test("everyComponentDescribed", () => {
    for (const c of DAK_COMPONENTS) {
      expect(DAK_COMPONENT_DESCRIPTIONS[c]?.length ?? 0).toBeGreaterThan(20);
    }
  });

  test("everyKindInExactlyOneComponent", () => {
    const seen = new Map<string, string[]>();
    for (const c of DAK_COMPONENTS) {
      for (const k of DAK_COMPONENT_KINDS[c]) {
        seen.set(k, [...(seen.get(k) ?? []), c]);
      }
    }
    const unmapped = DAK_BLOCK_KINDS.filter((k) => !seen.has(k));
    expect(unmapped).toEqual([]);
    const doubled = [...seen].filter(([, cs]) => cs.length > 1);
    expect(doubled).toEqual([]);
  });

  test("everyComponentNamesAKind", () => {
    const bare = DAK_COMPONENTS.filter((c) => DAK_COMPONENT_KINDS[c].length === 0);
    expect(bare).toEqual([]);
  });

  test("noComponentWithoutL2Kind", () => {
    // Was ["health-interventions-and-recommendations", "test-scenarios"] until
    // both kinds landed. L2 is what a DAK *is*, so this closing is the point.
    expect(dakComponentsWithoutL2()).toEqual([]);
  });

  test("testScenariosAtBothLayers", () => {
    // The L2 scenario is the narrative a reviewer signs off; the L3 test-case
    // is a FHIR conformance artefact. Collapsing them would lose the review.
    expect(DAK_COMPONENT_KINDS["test-scenarios"]).toEqual(["test-scenario", "test-case"]);
    expect(layerForKind("test-scenario")).toBe("L2");
    expect(layerForKind("test-case")).toBe("L3");
  });

  test("requirementsComponentHasTwoKinds", () => {
    // Its WHO name is a conjunction; splitting the kinds is deliberate.
    expect(DAK_COMPONENT_KINDS["functional-and-non-functional-requirements"]).toEqual([
      "functional-requirement",
      "non-functional-requirement",
    ]);
  });
});

describe("the component list against WHO's own logical model", () => {
  // DAK_COMPONENTS is a claim about WHO's model, so where the model is on disk
  // it is checked rather than trusted. smart-base is an external checkout, so
  // absence must read as "not checked" — never as a pass. Same contract as the
  // rest of the smart-base-backed tooling.
  const DAK_FSH = join(
    process.env.SMART_BASE_HOME ?? "/home/user/litlfred/smart-base",
    "input/fsh/models/DAK.fsh",
  );
  const available = existsSync(DAK_FSH);

  test("reportsDakFshAvailability", () => {
    if (!available) {
      console.warn(`  n/a: no DAK.fsh at ${DAK_FSH} — component fields unverified`);
    }
    expect(typeof available).toBe("boolean");
  });

  test.skipIf(!available)("componentFieldsExistInDakFsh", () => {
    const fsh = readFileSync(DAK_FSH, "utf-8");
    // Component lines look like: `* healthInterventions 0..* HealthInterventionsSource "…"`
    const declared = new Set(
      [...fsh.matchAll(/^\* (\w+) 0\.\.\* (\w+Source)\b/gm)].map((m) => m[1]!),
    );
    expect(declared.size).toBe(9);
    // The owner's tenth, scheduling logic, is not in WHO's model yet — it is
    // named as unformalized rather than checked against a field it lacks.
    for (const c of DAK_COMPONENTS.filter((c) => !DAK_UNFORMALIZED_COMPONENTS.includes(c))) {
      expect(declared.has(DAK_COMPONENT_FIELDS[c])).toBe(true);
    }
  });

  test.skipIf(!available)("noUnlistedWhoComponent", () => {
    const fsh = readFileSync(DAK_FSH, "utf-8");
    const declared = [...fsh.matchAll(/^\* (\w+) 0\.\.\* \w+Source\b/gm)].map((m) => m[1]!);
    const known = new Set(Object.values(DAK_COMPONENT_FIELDS));
    expect(declared.filter((d) => !known.has(d))).toEqual([]);
  });

  test.skipIf(!available)("componentSourcesAreWrappers", () => {
    // DakComponentSourceSchema in ./dak claims this shape; checked here, not trusted.
    const sources = join(DAK_FSH, "..", "DAKComponentSources.fsh");
    expect(existsSync(sources)).toBe(true);
    const fsh = readFileSync(sources, "utf-8");
    const types = [...readFileSync(DAK_FSH, "utf-8").matchAll(/^\* \w+ 0\.\.\* (\w+Source)\b/gm)].map((m) => m[1]!);
    for (const t of types) {
      const body = fsh.split(/^Logical: /m).find((b) => b.startsWith(`${t}\n`));
      expect(body, t).toBeDefined();
      const fields = [...body!.matchAll(/^\* (\w+) 0\.\.1 /gm)].map((m) => m[1]!);
      expect(fields, t).toEqual([...DAK_COMPONENT_SOURCE_KEYS]);
      expect(body, t).toMatch(/exactly one of/);
    }
  });

  test.skipIf(!available)("schedulingLogicNotYetWhoField", () => {
    // WHO's model and the starter kit's table keep it inside decision support.
    // The owner counts it as its own component (2026-09-30), so it is listed and
    // marked unformalized; when DAK.fsh gains the field, this test fails and
    // the unformalized list should shrink.
    expect(readFileSync(DAK_FSH, "utf-8")).not.toMatch(/^\* schedul/im);
  });
});

describe("scheduling logic is its own component, and says it is unformalized", () => {
  test("schedulingLogicOwnsItsKind", () => {
    expect(DAK_COMPONENT_KINDS["scheduling-logic"]).toEqual(["scheduling-logic"]);
    expect(DAK_COMPONENT_KINDS["decision-support-logic"]).not.toContain("scheduling-logic");
  });

  test("schedulingLogicUnformalizedSeventh", () => {
    expect(DAK_UNFORMALIZED_COMPONENTS).toEqual(["scheduling-logic"]);
    expect(DAK_COMPONENTS.indexOf("scheduling-logic")).toBe(6);
  });
});

describe("the two kinds added from WHO's own logical models", () => {
  test("healthInterventionNeedsReference", () => {
    // HealthInterventions.fsh makes `reference` 1..*: an intervention with no
    // source recommendation is not one. Caught at construction, not at review.
    expect(() =>
      healthIntervention({ label: "hi:dtp-booster", title: "DTP booster", references: [] }),
    ).toThrow();
  });

  test("referencesCarryDublinCore", () => {
    const b = healthIntervention({
      label: "hi:dtp-booster",
      title: "DTP booster",
      references: [
        {
          title: "WHO classification of digital health interventions",
          source: "https://iris.who.int/handle/10665/373581",
          publisher: "World Health Organization",
        },
      ],
    });
    expect(b.layer).toBe("L2");
    expect(b.references[0]!.source).toContain("iris.who.int");
  });

  test("dublinCoreReferenceNeedsTitle", () => {
    expect(() =>
      healthIntervention({
        label: "hi:x",
        title: "X",
        references: [{ title: "" }],
      }),
    ).toThrow();
  });

  test("newKindsAreL2WithPrefixes", () => {
    expect(layerForKind("health-intervention")).toBe("L2");
    expect(DAK_LABEL_PREFIXES["health-intervention"]).toBe("hi");
    expect(DAK_LABEL_PREFIXES["test-scenario"]).toBe("tscen");
    expect(() => testScenario({ label: "wrong:x", title: "X" })).toThrow();
    expect(testScenario({ label: "tscen:immz-full-course", title: "Full course" }).layer).toBe("L2");
  });

  test("newKindsMapToWhoModels", () => {
    expect(DAK_KIND_TO_WHO_MODEL["health-intervention"]).toBe(
      "http://smart.who.int/base/StructureDefinition/HealthInterventions",
    );
    expect(DAK_KIND_TO_WHO_MODEL["test-scenario"]).toBe(
      "http://smart.who.int/base/StructureDefinition/TestScenario",
    );
  });

  test("noInventedWhoModelIri", () => {
    // scheduling-logic is folded into decision support in WHO's model, and the
    // L3 kinds are FHIR artefacts rather than DAK component models. A
    // fabricated IRI would be indistinguishable from a real one downstream.
    expect(DAK_KIND_TO_WHO_MODEL["scheduling-logic"]).toBeUndefined();
    expect(DAK_KIND_TO_WHO_MODEL["measure"]).toBeUndefined();
    for (const iri of Object.values(DAK_KIND_TO_WHO_MODEL)) {
      expect(iri).toStartWith("http://smart.who.int/base/StructureDefinition/");
    }
  });
});

// Moved from cat-harness/scripts/tests/adapter-scoping.test.ts (bean 1335).
describe("DAK vocabulary tracks the repo's own L2/L3 schemas", () => {
  test("carriesL2Kinds", () => {
    for (const k of [
      "persona",
      "user-scenario",
      "business-process",
      "data-element",
      "decision-table",
      "scheduling-logic",
      "indicator",
      "functional-requirement",
      "non-functional-requirement",
    ]) {
      expect(DAK_BLOCK_KINDS as readonly string[]).toContain(k);
    }
  });

  test("carriesL3Kinds", () => {
    for (const k of [
      "logical-model",
      "profile",
      "value-set",
      "questionnaire",
      "cql-library",
      "structure-map",
      "plan-definition",
      "measure",
      "test-case",
      "actor-definition",
    ]) {
      expect(DAK_BLOCK_KINDS as readonly string[]).toContain(k);
    }
  });

  test("dakKindsOutOfPaperUnion", () => {
    // They now have builders and Zod schemas (smart-base/schemas/dak-blocks.ts) and their
    // own exhaustiveness proof against DakBlock — but they must never enter
    // BLOCK_KINDS, whose proof is against the paper `Block` union and whose
    // membership is what every paper QA axis is scoped by.
    for (const k of DAK_BLOCK_KINDS) {
      expect(BLOCK_KINDS as readonly string[]).not.toContain(k);
    }
  });
});

// Moved from cat-harness/scripts/tests/content-profiles.test.ts (bean 1335).
describe("profiles do not reach a DAK kind", () => {
  test("dakKindInNoProfile", () => {
    for (const k of DAK_BLOCK_KINDS) {
      for (const p of CONTENT_PROFILES) expect(profileAcceptsKind(p, k)).toBe(false);
    }
  });
});

describe("DAK kinds reach a folio only through its dependency tree (bean riit, step 3)", () => {
  // Owner, 2026-10-04: a folio sees the nodes of the layers it depends on
  // (option 1 of 3). folio-assistant-core's tree does not include smart-base.
  test("smartBaseTreeRegistersDakKinds", () => {
    expect(registry.contributedKinds().filter((k) => k.adapter === "dak").length).toBe(DAK_BLOCK_KINDS.length);
  });

  test("otherTreeRegistersNoDakKinds", () => {
    const other = loadContributionsSync(resolve(import.meta.dir, "..", "..", "folio-assistant-core"), new ContributionRegistry());
    expect(other.contributedKinds().filter((k) => k.adapter === "dak")).toEqual([]);
  });
});
