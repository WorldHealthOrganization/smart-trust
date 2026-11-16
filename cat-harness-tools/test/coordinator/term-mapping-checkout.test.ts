/**
 * `term-mapping` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/term-mapping.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each maps the real glossary onto
 * fhir-harness's terminology, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";

import { TermMappingsFileSchema } from "../../schemas/content/term-mapping.ts";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FHIR_PIN,
  FHIR_SNAPSHOT,
  pinnedTerminology,
} from "../../scripts/check-term-mapping.ts";

describe("corpus — the real glossary, asserting scope rather than a count", () => {
  test("every candidate gets a row for BOTH targets, and fhir is never silently unmapped", async () => {
    const { run } = await import("../../scripts/check-term-mapping.ts");
    const { mappings, scope } = await run(process.cwd());
    expect(TermMappingsFileSchema.safeParse({
      $schema: "folio-term-mappings/v1", checked_at: "2026-09-30", scope, mappings,
    }).success).toBe(true);

    const skos = mappings.filter((m) => m.target === "skos");
    const fhir = mappings.filter((m) => m.target === "fhir");
    expect(skos.length).toBeGreaterThan(0);
    expect(fhir.length).toBe(skos.length);

    // The load-bearing one, stated so it holds EITHER WAY: a row may be
    // `undetermined` only when it carries a reason, and `unmapped` only when
    // it does not. Pinning the snapshot flipped this target from the first to
    // the second, and the invariant is what must survive that, not the count.
    for (const m of fhir) {
      if (m.concept === "undetermined") expect(m.undetermined_reason).toBeTruthy();
      else expect(m.undetermined_reason).toBeUndefined();
    }
    // And the scope says which of the two happened, rather than leaving a
    // reader to infer it from the counts.
    const s = scope.find((x) => x.target === "fhir")!;
    expect(Boolean(s.unreachable_reason)).toBe(fhir.some((m) => m.concept === "undetermined"));
  }, 60_000);

  test("the pin and its snapshot agree on the version", async () => {
    const { pinnedTerminology } = await import("../../scripts/check-term-mapping.ts");
    const p = pinnedTerminology(process.cwd());
    // A snapshot of one version labelled another is the single way this could
    // assert something false, so it is refused rather than reported.
    if (typeof p === "string") {
      // Not loaded, for a reason of its own — never the disagreement.
      expect(p).not.toMatch(/ holds \S+ while .* pins /);
    } else {
      expect(p.version).toMatch(/^v\d/);
      // The version the snapshot holds IS the one the pin record names.
      const pinned = (JSON.parse(readFileSync(join(process.cwd(), FHIR_PIN), "utf-8")) as { version?: string }).version;
      expect(p.version).toBe(pinned as string);
    }
  });

  // A review bot on #1633 found `pinnedTerminology` casting the snapshot with
  // `as PinnedTerminology` instead of parsing it, so only `version` was ever
  // checked. These cover what the cast let through. Each asserts a REASON
  // STRING rather than a throw, because the three states are the point: an
  // unusable snapshot makes a miss `undetermined`, never `unmapped`.
  describe("an unusable snapshot is a reason, not a silent zero", () => {
    const writePair = (version: string, snapshot: unknown): string => {
      const root = mkdtempSync(join(tmpdir(), "pinned-"));
      mkdirSync(join(root, "cat-harness", "external-schemas"), { recursive: true });
      writeFileSync(join(root, FHIR_PIN), JSON.stringify({ version }));
      writeFileSync(join(root, FHIR_SNAPSHOT), JSON.stringify(snapshot));
      return root;
    };
    const wellFormed = (over: Record<string, unknown> = {}) => ({
      $schema: "folio-pinned-terminology/v1",
      pin: "cat-harness/external-schemas/who-smart-base.json",
      version: "v1.0.0",
      source: "https://example.invalid/ig",
      concepts: [{ system: "http://example.invalid/cs", code: "a", display: "Alpha" }],
      ...over,
    });

    test("a well-formed snapshot still loads — the control", () => {
      const p = pinnedTerminology(writePair("v1.0.0", wellFormed()));
      expect(typeof p).not.toBe("string");
    });

    test("ZERO concepts is undetermined, not a terminology that matched nothing", () => {
      const p = pinnedTerminology(writePair("v1.0.0", wellFormed({ concepts: [] })));
      expect(typeof p).toBe("string");
      expect(p as string).toContain("NO concepts");
    });

    test("a snapshot missing `concepts` entirely is refused by the schema", () => {
      const bad = wellFormed();
      delete (bad as Record<string, unknown>).concepts;
      const p = pinnedTerminology(writePair("v1.0.0", bad));
      expect(typeof p).toBe("string");
      expect(p as string).toContain("PinnedTerminologySchema");
    });

    test("a concept missing its code is refused — the cast accepted any shape", () => {
      const p = pinnedTerminology(
        writePair("v1.0.0", wellFormed({ concepts: [{ system: "http://x.invalid", display: "Alpha" }] })),
      );
      expect(typeof p).toBe("string");
      expect(p as string).toContain("PinnedTerminologySchema");
    });

    test("the version disagreement is still caught, and reported as itself", () => {
      const p = pinnedTerminology(writePair("v2.0.0", wellFormed()));
      expect(typeof p).toBe("string");
      expect(p as string).toContain("re-snapshot at the pinned tag");
    });
  });
});
