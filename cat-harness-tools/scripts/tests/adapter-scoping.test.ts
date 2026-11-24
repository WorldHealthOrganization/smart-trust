/**
 * `BLOCK_KINDS` was one global pool with a compile-time exhaustiveness proof
 * against the `Block` union. Adding WHO L2/L3 kinds to that pool would make
 * every math axis nominally applicable to a FHIR ValueSet and every WHO axis
 * applicable to a lemma — and the failure would not be a visible `n/a` but a
 * `voice-scholarly-default: fail` on a decision table, which reads like a real
 * finding.
 *
 * So kinds are scoped by content adapter, and QA criteria carry an adapter
 * scope that the sweep gates on before it gates on companion files.
 *
 * The load-bearing choice is the **default**. `adapters` absent means
 * `["paper"]`, not "all": every one of the criteria in the registry today was
 * written for the paper adapter, so defaulting to "all" would need all ~47
 * edited to stay correct and would misfire silently on any that were missed.
 * These tests pin that default, and pin that the change is a no-op for every
 * kind the existing corpus actually contains.
 *
 * Since bean `1335` the `dak` adapter is not built in: smart-base contributes
 * it. The tests that pinned the DAK vocabulary itself moved to
 * `smart-base/schemas/dak-blocks.test.ts`; what stays here is how CORE scopes
 * criteria to an adapter, checked against the contributed adapter the way a
 * running sweep sees it — through the registry `loadContributions` fills from
 * this checkout's declared dependencies.
 *
 * The tests of this file that read the whole checkout (reads the adapters and
 * block kinds the content layers contribute (smart-base's `dak`)) live in
 * `test/adapter-scoping-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, test, expect } from "bun:test";
import { resolve } from "path";
import {
  BLOCK_KINDS,
  ALL_BLOCK_KINDS,
  ADAPTER_BLOCK_KINDS,
  CONTENT_ADAPTERS,
  adapterForKind,
} from "../../schemas/content/block-kinds.ts";
import { criterionAdapters, incompatibleCompanions } from "../../schemas/sdlc/block-qa.ts";
import { QA_CRITERIA_REGISTRY } from "../../pipeline/qa-criteria-registry";
import { loadContributions } from "../../schemas/kg/harness-config.ts";
import {
  ContributionRegistry,
  composedKindOwner,
  type FolioContribution,
} from "../../schemas/content/contributions.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

/** The checkout's declared dependencies, as the sweep loads them. */
const REPO = resolve(dirname(HARNESS_ROOT));
const registry = await loadContributions<FolioContribution, ContributionRegistry>(
  REPO,
  new ContributionRegistry(),
);
/** Every kind a dependency contributed, with the adapter it named. */
const contributed = registry.contributedKinds();

describe("adapter partition", () => {
  test("ALL_BLOCK_KINDS is the built-in kinds, with no duplicates", () => {
    expect([...ALL_BLOCK_KINDS]).toEqual([...BLOCK_KINDS]);
    expect(new Set(ALL_BLOCK_KINDS).size).toBe(ALL_BLOCK_KINDS.length);
  });

  test("every adapter has a kind list and every kind maps back", () => {
    for (const a of CONTENT_ADAPTERS) {
      expect(ADAPTER_BLOCK_KINDS[a].length).toBeGreaterThan(0);
      for (const k of ADAPTER_BLOCK_KINDS[a]) expect(adapterForKind(k)).toBe(a);
    }
  });

  test("an unknown kind maps to undefined, never defaulted to paper", () => {
    // Defaulting here is exactly how a math axis would come to run against a
    // ValueSet: the caller has to decide what an unrecognised kind means.
    expect(adapterForKind("value-sett")).toBeUndefined();
    expect(adapterForKind("")).toBeUndefined();
  });
});

describe("criterion adapter scope", () => {
  test("absent defaults to every built-in vocabulary, not to all", () => {
    // It was `["paper"]` while one vocabulary held every built-in kind; since
    // the split by layer (bean bzwk: core `document`, sci `mathpaper`) the
    // same meaning is every typed vocabulary, whichever layout is mounted.
    expect(criterionAdapters({})).toEqual([...CONTENT_ADAPTERS]);
  });

  test("an explicit scope is honoured", () => {
    expect(criterionAdapters({ adapters: ["dak"] })).toEqual(["dak"]);
    expect(criterionAdapters({ adapters: [...CONTENT_ADAPTERS, "dak"] })).toEqual([...CONTENT_ADAPTERS, "dak"]);
  });

  test("every criterion resolves to a non-empty scope", () => {
    for (const def of QA_CRITERIA_REGISTRY) {
      expect(criterionAdapters(def).length).toBeGreaterThan(0);
    }
  });

  test("without the registry, a contributed adapter's roles are not guessed", () => {
    // The loud answer: every companion is reported, never assumed compatible.
    expect(incompatibleCompanions({ adapters: ["dak"], depends_on: ["ts"] })).toEqual(["ts"]);
  });

  test("built-in axes never admit a DAK block, and DAK axes never admit a built-in one", () => {
    for (const def of QA_CRITERIA_REGISTRY) {
      const scope = criterionAdapters(def);
      for (const { kind } of contributed.filter((c) => c.adapter === "dak")) {
        const owner = composedKindOwner(kind, registry, adapterForKind)!;
        expect(scope.includes(owner)).toBe(scope.includes("dak"));
      }
      for (const k of BLOCK_KINDS) {
        if (scope.includes("dak")) expect(scope.includes(adapterForKind(k)!)).toBe(false);
      }
    }
  });

  test("every DAK-scoped criterion says so explicitly", () => {
    // Omitting `adapters` silently scopes to paper, so a DAK criterion that
    // forgets it never runs on the blocks it was written for.
    for (const def of QA_CRITERIA_REGISTRY) {
      if (def.domain === "dak") expect(criterionAdapters(def)).toEqual(["dak"]);
    }
  });

  test("the dak domain is actually populated", () => {
    // The scoping mechanism landed before anything was registered in it, which
    // meant DAK blocks would sweep clean for want of a question, not an answer.
    expect(QA_CRITERIA_REGISTRY.filter((d) => d.domain === "dak").length).toBeGreaterThan(0);
  });
});

describe("no-op for the existing paper corpus", () => {
  test("every kind the corpus can contain resolves to a built-in vocabulary", () => {
    // walkBlocks recognises a block only via BLOCK_BUILDER_RE, built from
    // BLOCK_KINDS — so these are exactly the kinds a sweep can encounter
    // today. All must pass the adapter gate, or the next sweep rewrites
    // sidecars across the whole corpus.
    for (const k of BLOCK_KINDS) expect(CONTENT_ADAPTERS as readonly string[]).toContain(adapterForKind(k)!);
  });

  test("every built-in-scoped criterion admits every built-in kind", () => {
    // No criterion scopes to ONE of the built-in vocabularies yet, so a
    // criterion that names any of them is written for all built-in kinds.
    for (const def of QA_CRITERIA_REGISTRY) {
      if (!CONTENT_ADAPTERS.some((a) => criterionAdapters(def).includes(a))) continue;
      for (const k of BLOCK_KINDS) {
        expect(criterionAdapters(def).includes(adapterForKind(k)!)).toBe(true);
      }
    }
  });
});
