/**
 * One wrong-direction verdict for `check:partition` and `kg-detangle` — bean `j79e`.
 *
 * @module schemas/layer-direction.test
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";

import { allowedFromNeeds, directionOf, type LayerRule } from "./kg/layer-direction.ts";
import { ancestorsOf, flattenDependencies } from "./kg/dependency-order.ts";
import { ALLOWED } from "../scripts/partition/instance-rules.ts";
import { classifyByDirection } from "./kg/detangle.ts";

/** This repository's layer stack, as `kg-detangle` reads it: three declared, one not. */
function needsRule(): LayerRule {
  const needs = new Map<string, readonly string[] | undefined>([
    ["bootstrap", []],
    ["cat-harness", ["bootstrap"]],
    ["folio-assistant-core", ["cat-harness"]],
    ["undeclared", undefined],
  ]);
  const flat = flattenDependencies([...needs].map(([id, n]) => ({ id, needs: n ?? [], fatal: false })));
  expect(flat.problems).toEqual([]);
  return { allowed: allowedFromNeeds(needs, ancestorsOf(flat.order)) };
}

const e = { from: "a", to: "b" };

describe("directionOf over a `needs` graph", () => {
  test("a layer reaches itself and everything it transitively needs", () => {
    const r = needsRule();
    expect(directionOf(e, "folio-assistant-core", "folio-assistant-core", r).verdict).toBe("allowed");
    expect(directionOf(e, "folio-assistant-core", "bootstrap", r).verdict).toBe("allowed");
  });

  test("pointing up the stack is wrong-direction, with a basis naming both layers", () => {
    const d = directionOf(e, "bootstrap", "cat-harness", needsRule());
    expect(d.verdict).toBe("wrong-direction");
    expect(d.basis).toContain("'bootstrap'");
    expect(d.basis).toContain("'cat-harness'");
  });

  test("absent `needs` is UNDETERMINED — never 'reaches nothing' and never 'reaches anything'", () => {
    const r = needsRule();
    expect(directionOf(e, "undeclared", "cat-harness", r).verdict).toBe("undetermined");
    expect(directionOf(e, "undeclared", "undeclared", r).verdict).toBe("undetermined");
    // An edge INTO an undeclared layer is still decided by the source's declaration.
    expect(directionOf(e, "bootstrap", "undeclared", r).verdict).toBe("wrong-direction");
  });

  test("an end in no layer at all is undetermined, and says which end", () => {
    const d = directionOf({ from: "x/y.md", to: "b" }, undefined, "bootstrap", needsRule());
    expect(d).toEqual({ verdict: "undetermined", basis: "x/y.md sits in no declared layer" });
  });
});

describe("permits", () => {
  const rule: LayerRule = {
    allowed: new Map([["low", new Set(["low"])], ["high", new Set(["high", "low"])]]),
    permits: [
      { from: "l.ts", to: "h.ts", reason: "side-effect registration" },
      { from: "h.ts", to: "l.ts", reason: "never needed" },
    ],
  };

  test("a permit turns a refused edge into `permitted`, carrying the permit", () => {
    const d = directionOf({ from: "l.ts", to: "h.ts" }, "low", "high", rule);
    expect(d.verdict).toBe("permitted");
    if (d.verdict === "permitted") expect(d.permit.reason).toBe("side-effect registration");
  });

  test("a permit on an ALLOWED edge is not consulted — so a caller can report it stale", () => {
    expect(directionOf({ from: "h.ts", to: "l.ts" }, "high", "low", rule).verdict).toBe("allowed");
  });
});

describe("the partition's own rule runs through the same function", () => {
  const rule: LayerRule = {
    allowed: new Map(Object.entries(ALLOWED).map(([k, v]) => [k, new Set<string>(v)])),
  };

  test("harness importing core is wrong-direction; core importing harness is allowed", () => {
    expect(directionOf(e, "harness", "core", rule).verdict).toBe("wrong-direction");
    expect(directionOf(e, "core", "harness", rule).verdict).toBe("allowed");
    expect(directionOf(e, "test", "base", rule).verdict).toBe("allowed");
  });
});

describe("detangle's cut kind is read off the verdict and nothing else", () => {
  const edge = { from: "a", to: "b", via: "md-link", authority: "recorded" as const };

  test("wrong-direction maps to the wrong-direction cut kind", () => {
    const c = classifyByDirection(edge, directionOf(edge, "bootstrap", "cat-harness", needsRule()));
    expect(c.kind).toBe("wrong-direction");
  });

  test("allowed and undetermined stay unclassified — restatement vs essential is an adjudication", () => {
    const r = needsRule();
    for (const [f, t] of [["cat-harness", "bootstrap"], ["undeclared", "bootstrap"]] as const) {
      const c = classifyByDirection(edge, directionOf(edge, f, t, r));
      expect(c.kind).toBe("unclassified");
      expect(c.basis.length).toBeGreaterThan(0);
    }
  });
});
