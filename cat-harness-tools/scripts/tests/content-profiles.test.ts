/**
 * The profile axis: `document` and `paper` as nested restrictions of one
 * adapter's vocabulary.
 *
 * The load-bearing invariant is that profiles are a DIFFERENT axis from
 * content adapters. Adapters partition kinds into disjoint namespaces and
 * `adapterForKind` answers "whose vocabulary is this word from?"; profiles
 * nest and answer "may this folio use it?". Conflating them would either make
 * `adapterForKind` ambiguous on every shared kind or re-scope every QA
 * criterion in the registry — so these tests pin that adding the profile axis
 * changed neither.
 */
import { describe, test, expect } from "bun:test";
import {
  BLOCK_KINDS,
  DOCUMENT_BLOCK_KINDS,
  MATH_BLOCK_KINDS,
  CONTENT_ADAPTERS,
  CONTENT_PROFILES,
  PROFILE_BLOCK_KINDS,
  adapterForKind,
  profileAcceptsKind,
  kindsOutsideProfile,
  profileForContentType,
} from "../../schemas/content/block-kinds.ts";
import { pathToFileURL } from "node:url";
import { vocabularies } from "../../schemas/content/vocabulary-modules.ts";

describe("the profile partition", () => {
  test("document and math are disjoint and cover the built-in kinds", () => {
    const doc = new Set<string>(DOCUMENT_BLOCK_KINDS);
    const math = new Set<string>(MATH_BLOCK_KINDS);
    for (const k of math) expect(doc.has(k)).toBe(false);
    expect(doc.size + math.size).toBe(BLOCK_KINDS.length);
    expect(new Set([...doc, ...math])).toEqual(new Set<string>(BLOCK_KINDS));
  });

  test("a kind added to BLOCK_KINDS cannot go unclassified", () => {
    // DOCUMENT_BLOCK_KINDS is the derived complement, so this holds by
    // construction — which is the point. The assertion is here so that
    // replacing the derivation with a second hand-written list fails loudly.
    for (const k of BLOCK_KINDS) {
      const inDoc = (DOCUMENT_BLOCK_KINDS as readonly string[]).includes(k);
      const inMath = (MATH_BLOCK_KINDS as readonly string[]).includes(k);
      expect(inDoc !== inMath).toBe(true);
    }
  });

  test("the document profile is named explicitly, not inherited silently", () => {
    // Spelled out so that a kind moving between profiles is a reviewed diff
    // rather than a consequence of an unrelated edit to BLOCK_KINDS.
    expect([...(DOCUMENT_BLOCK_KINDS as readonly string[])].sort()).toEqual(
      // `figure` joined the document profile with bean `d5f1` (2026-09-20): an
      // image extracted from a source document asserts nothing formal, so it
      // belongs here rather than in the math set. Reviewed, not inherited.
      // `recommendation` joined with bean `55ao` (folio-assistant-core's
      // block-kinds/recommendation.json, `profile: "document"`): a normative
      // statement an L1 document makes, proved by nothing, so not a math kind.
      ["algorithm", "diagram", "equation", "example", "figure", "prose", "recommendation", "remark", "simulator", "table"],
    );
    expect([...(MATH_BLOCK_KINDS as readonly string[])].sort()).toEqual(
      ["conjecture", "corollary", "definition", "lemma", "proof", "proposition", "theorem"],
    );
  });

  // The module that types `definition`: the science layer's vocabulary module
  // since 2026-10-22. Absent when this checkout does not mount that layer.
  const definitionModule = vocabularies().find((v) => v.schemas.has("definition"))?.module;

  test.skipIf(definitionModule === undefined)("`definition` is in the math profile for a reason the type enforces", () => {
    // DefinitionBlock declares `lean: LeanRef` — REQUIRED, unlike every other
    // kind's optional one. A document folio therefore cannot hold one even in
    // principle, which is the sharpest point of the whole partition. If this
    // ever moves to the document profile, the type has changed and the
    // partition's stated rationale is stale.
    const src = Bun.file(pathToFileURL(definitionModule!)).text();
    return src.then((text) => {
      const iface = text.slice(text.indexOf("export interface DefinitionBlock"));
      const body = iface.slice(0, iface.indexOf("\n}"));
      expect(body).toContain("lean: LeanRef");
      expect(body).not.toContain("lean?: LeanRef");
      expect((MATH_BLOCK_KINDS as readonly string[]).includes("definition")).toBe(true);
    });
  });
});

describe("profiles do not disturb the adapter axis", () => {
  test("every built-in kind maps to exactly one built-in vocabulary", () => {
    // The regression this guards: making `document` a third CONTENT_ADAPTER
    // would have made `adapterForKind` ambiguous on all eight shared kinds,
    // and QA criteria are scoped through it.
    // Since bean bzwk the vocabularies are by layer (core `document`, sci
    // `mathpaper`), disjoint, so this is unambiguous in either layout.
    for (const k of BLOCK_KINDS) expect(CONTENT_ADAPTERS as readonly string[]).toContain(adapterForKind(k)!);
  });

  // "A DAK kind is in no profile" moved to smart-base/schemas/dak-blocks.test.ts
  // with the DAK kinds (bean 1335): core no longer names one to test with.
});

describe("profileAcceptsKind", () => {
  test("paper admits everything the document profile does", () => {
    for (const k of DOCUMENT_BLOCK_KINDS) expect(profileAcceptsKind("paper", k)).toBe(true);
  });

  test("document rejects every math kind", () => {
    for (const k of MATH_BLOCK_KINDS) expect(profileAcceptsKind("document", k)).toBe(false);
  });

  test("an unknown kind is admitted by no profile", () => {
    for (const p of CONTENT_PROFILES) {
      // Not `recommendation`, which became a real document kind (bean `55ao`).
      expect(profileAcceptsKind(p, "no-such-kind")).toBe(false);
      expect(profileAcceptsKind(p, "")).toBe(false);
    }
  });

  test("PROFILE_BLOCK_KINDS agrees with the predicate", () => {
    for (const p of CONTENT_PROFILES) {
      for (const k of PROFILE_BLOCK_KINDS[p]) expect(profileAcceptsKind(p, k)).toBe(true);
    }
  });
});

describe("kindsOutsideProfile", () => {
  test("reports math kinds against the document profile, de-duplicated", () => {
    expect(kindsOutsideProfile("document", ["prose", "theorem", "theorem", "table"]))
      .toEqual(["theorem"]);
  });

  test("reports unknown kinds too, whichever profile is declared", () => {
    // An unrecognised kind is a finding under any profile; swallowing it here
    // is how it would reach a renderer instead of a validator.
    expect(kindsOutsideProfile("paper", ["prose", "value-set"])).toEqual(["value-set"]);
  });

  test("known kinds come back in BLOCK_KINDS order, unknown ones sorted after", () => {
    expect(kindsOutsideProfile("document", ["proof", "zzz", "definition", "aaa"]))
      .toEqual(["definition", "proof", "aaa", "zzz"]);
  });

  test("a conforming corpus reports nothing", () => {
    expect(kindsOutsideProfile("document", [...DOCUMENT_BLOCK_KINDS])).toEqual([]);
    expect(kindsOutsideProfile("paper", [...BLOCK_KINDS])).toEqual([]);
  });
});

describe("profileForContentType", () => {
  test("only the exact string 'document' selects the narrower profile", () => {
    expect(profileForContentType("document")).toBe("document");
  });

  test("anything else falls back to paper — the WIDER profile, on purpose", () => {
    // The narrower default would reject legitimate content on a typo. The
    // wider one only fails to catch a violation, which the author sees when
    // the build needs a toolchain they do not have.
    expect(profileForContentType("paper")).toBe("paper");
    expect(profileForContentType(undefined)).toBe("paper");
    expect(profileForContentType("Document")).toBe("paper");
    expect(profileForContentType("dak")).toBe("paper");
  });
});
