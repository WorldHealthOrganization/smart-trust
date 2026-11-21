/**
 * Bean `w1gy`: "below the harness" is every layer that does not reach the
 * harness through `needs`, whatever the harness itself names.
 *
 * @module scripts/tests/needs-reach.test
 */
import { describe, expect, test } from "bun:test";

import { belowHarness, reaches } from "../lib/needs-reach.ts";

/** The layering since cat-harness#787: the harness needs bootstrap only. */
const NEEDS = new Map<string, readonly string[]>([
  ["bootstrap", []],
  ["bootstrap-tools", ["bootstrap"]],
  ["cat-harness", ["bootstrap"]],
  ["cat-harness-tools", ["cat-harness", "bootstrap-tools"]],
  ["folio-assistant-core", ["cat-harness-tools"]],
]);

describe("needs-reach", () => {
  test("an instance reaches itself and what it transitively needs", () => {
    expect(reaches(NEEDS, "cat-harness", "cat-harness")).toBe(true);
    expect(reaches(NEEDS, "folio-assistant-core", "cat-harness")).toBe(true);
    expect(reaches(NEEDS, "bootstrap-tools", "cat-harness")).toBe(false);
  });

  test("a needed name with no declaration of its own still counts as reached", () => {
    expect(reaches(new Map([["above", ["cat-harness"]]]), "above", "cat-harness")).toBe(true);
  });

  test("bootstrap-tools is below the harness although the harness does not need it", () => {
    expect([...belowHarness("cat-harness", NEEDS)].sort()).toEqual(["bootstrap", "bootstrap-tools"]);
  });

  test("an instance that needs a layer the checkout does not declare is not called below", () => {
    const partial = new Map<string, readonly string[]>([["smart-x", ["folio-assistant-core"]], ["bootstrap", []]]);
    expect([...belowHarness("cat-harness", partial)]).toEqual(["bootstrap"]);
  });

  test("a cycle in needs terminates", () => {
    expect(reaches(new Map([["a", ["b"]], ["b", ["a"]]]), "a", "cat-harness")).toBe(false);
  });
});
