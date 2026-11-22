/**
 * cat-harness's READING of bootstrap: the tests that were in bootstrap's own
 * `graph.test.ts` but exercise harness code — the declaration reader, the
 * published vocabulary, the graph-typology registry. They moved out when
 * bootstrap-tools was re-created (bean `xsqm`), because a test of the harness
 * belongs with the harness: bootstrap-tools may import nothing above bootstrap.
 *
 * The tests of this file that read the whole checkout (reads every layer
 * declaration in the checkout) live in
 * `test/bootstrap-reading-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import { CLASS_GLOSSES } from "./content/vocabulary.ts";
import { BASE_GRAPH_TYPOLOGIES, graphTypologyLayer } from "./kg/graph-typology-registry.ts";
import { BOOTSTRAP_GRAPH_TYPOLOGIES, BOOTSTRAP_TERMS } from "@litlfred/bootstrap-tools/schemas/graph.ts";

describe("the harness reads bootstrap's terms and kinds as bootstrap states them", () => {
  const own = Object.keys(BOOTSTRAP_GRAPH_TYPOLOGIES);
  test("the published vocabulary uses bootstrap's definitions, and bootstrap's terms link nowhere above", () => {
    // EVERY term bootstrap defines is a bootstrap-layer class glossed with
    // bootstrap's sentence (owner, 2026-09-30, bean `xsqm`: the `bs:`
    // vocabulary is exactly bootstrap's terms) — not a hand-picked six.
    for (const [term, gloss] of Object.entries(BOOTSTRAP_TERMS)) {
      const cls = term.replace(/\s+/g, "");
      expect(CLASS_GLOSSES[cls]?.gloss, cls).toBe(gloss);
      expect(CLASS_GLOSSES[cls]?.layer, cls).toBe("bootstrap");
    }
    // …and nothing else is: `Directory` was bootstrap-layer while being no
    // bootstrap term, and is gone (its word is Subgraph).
    const bootstrapClasses = Object.entries(CLASS_GLOSSES).filter(([, g]) => g.layer === "bootstrap").map(([n]) => n).sort();
    expect(bootstrapClasses).toEqual(Object.keys(BOOTSTRAP_TERMS).map((t) => t.replace(/\s+/g, "")).sort());
    // Owner, 2026-09-29: "no tools in bootstrap". A Harness defines Tool.
    expect("Tool" in BOOTSTRAP_TERMS).toBe(false);
    expect(CLASS_GLOSSES.Tool!.layer ?? "harness").toBe("harness");
    const bootstrapLinks = Object.entries(CLASS_GLOSSES).filter(([, g]) => g.layer === "bootstrap" && g.seeAlso);
    expect(bootstrapLinks.map(([n]) => n)).toEqual([]);
  });

  test("the harness's registry reads bootstrap's sentence; the class it types a directory with is its own", () => {
    expect(own.length).toBeGreaterThan(0);
    for (const k of own) {
      const def = BASE_GRAPH_TYPOLOGIES[k as keyof typeof BASE_GRAPH_TYPOLOGIES];
      expect(def, k).toBeDefined();
      expect(def.summary).toBe(BOOTSTRAP_GRAPH_TYPOLOGIES[k as keyof typeof BOOTSTRAP_GRAPH_TYPOLOGIES]);
      // There is no per-kind class (owner, 2026-09-30, bean `3r47`): the kind
      // IS bootstrap's individual, `bootstrap:graphTypology/<kind>`.
      expect(graphTypologyLayer(k, def), k).toBe("bootstrap");
    }
  });
});
