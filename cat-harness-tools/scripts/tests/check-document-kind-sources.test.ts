/**
 * check:document-kind-sources, seen failing on planted violations (bean qvxh):
 * a `computedFrom` claim is only checkable if a wrong one is refused.
 */
import { describe, expect, it } from "bun:test";

import { check, judge, reachableGraphIds } from "../check-document-kind-sources.ts";

const reach = reachableGraphIds();
const kind = (computedFrom: string[]) => [
  { instance: "smart-base", file: "smart-base/document-kinds/x.json", kind: { id: "x", sections: [{ id: "s", computedFrom }] } },
];

describe("what an instance can name", () => {
  it("smart-base reaches its own library", () => {
    expect(reach.get("smart-base")?.has("library")).toBe(true);
  });
  it("a graph only an instance ABOVE declares is not reachable: fhir-harness cannot name smart-base-findings", () => {
    expect(reach.get("smart-base")?.has("smart-base-findings")).toBe(true);
    expect(reach.get("fhir-harness")?.has("smart-base-findings")).toBe(false);
  });
});

describe("the judgement", () => {
  it("a declared graph id passes", () => {
    expect(judge(kind(["library"]), reach)).toEqual({ problems: [], claims: 1 });
  });
  it("an undeclared graph — the external evidence nobody has ingested — is refused", () => {
    const r = judge(kind(["cochrane-reviews"]), reach);
    expect(r.problems.map((p) => p.id)).toEqual(["cochrane-reviews"]);
  });
  it("the real corpus makes claims, and every one resolves", () => {
    const r = check();
    expect(r.claims).toBeGreaterThan(0);
    expect(r.problems).toEqual([]);
  });
});
