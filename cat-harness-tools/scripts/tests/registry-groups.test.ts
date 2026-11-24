/**
 * Every class the graph exporter can MINT is one the vocabulary DEFINES.
 *
 * Bean `3190`. `kg-export` projects `folio:<Class>` onto every node it finds
 * under `.claude/skills/<group>/`, taking the class name from
 * `REGISTRY_GROUPS`. `ns-export` writes the vocabulary those classes must
 * resolve in. Nothing joined the two, so `Convention` shipped as the `@type`
 * of two real nodes with no definition behind it — a link-shaped value that
 * does not dereference, bean `blv9`.
 *
 * `ns:check` reported **0 undefined** throughout, because it scanned for
 * `termIri("Name")` literals and a class minted from this table is not a
 * literal anywhere. `Requirement` had been in the same state for longer.
 *
 * So the join is tested here as well as performed in `ns-export`: the check
 * proves the CURRENT corpus is sound, and this proves the check still looks
 * at the right set — the failure mode that produced the gap was a check
 * passing over ground it never covered.
 *
 * @module scripts/tests/registry-groups
 */
import { describe, expect, test } from "bun:test";

import { REGISTRY_GROUPS } from "../../schemas/kg/kg-node.ts";
import { CLASS_GLOSSES } from "../../schemas/content/vocabulary.ts";
import { mintedTermsFromSource } from "../ns-export.ts";

describe("a minted class is a defined class", () => {
  test("every REGISTRY_GROUPS class has a vocabulary gloss", () => {
    const missing = Object.values(REGISTRY_GROUPS).filter((c) => CLASS_GLOSSES[c] === undefined);
    expect(missing).toEqual([]);
  });

  test("the table is not empty — a vacuous pass would satisfy the above", () => {
    // The assertion above holds trivially over an empty table, which is the
    // exact defect (`dh4f`) the convention this bean ships is named for.
    expect(Object.keys(REGISTRY_GROUPS).length).toBeGreaterThanOrEqual(5);
    expect(Object.values(REGISTRY_GROUPS)).toContain("Convention");
  });

  test("keys are directories, values are classes — and they differ", () => {
    // Keyed by directory (`conventions`), valued by class (`Convention`).
    // Collapsing the two is what a later reader is most likely to "tidy",
    // and it would mint `folio:conventions` onto every node.
    for (const [dir, cls] of Object.entries(REGISTRY_GROUPS)) {
      expect(dir).not.toBe(cls);
      expect(cls[0]).toBe(cls[0]!.toUpperCase());
      expect(dir[0]).toBe(dir[0]!.toLowerCase());
    }
  });
});

describe("the source scan cannot see these, which is why the union exists", () => {
  test("a registry-minted class appears in NO `termIri` literal", () => {
    // This is the whole reason `ns-export` must union the two sources. If a
    // later change ever makes these literals, the union becomes redundant
    // rather than wrong — but until then, removing it re-opens the gap.
    const scanned = mintedTermsFromSource();
    expect(scanned.has("Convention")).toBe(false);
    expect(scanned.has("Requirement")).toBe(false);
  });

  test("...while the scan is still finding real terms", () => {
    // Guards the assertion above from passing because the scan found nothing.
    expect(mintedTermsFromSource().size).toBeGreaterThan(20);
  });
});
