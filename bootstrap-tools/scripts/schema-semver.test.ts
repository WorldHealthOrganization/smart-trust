/**
 * The bump classifier behind `bootstrap:semver` — skill `bootstrap-contract-semver`.
 *
 * Each case is one change to a small published-shaped schema, and the
 * assertion is the bump the skill's table requires. The `could not determine`
 * cases are the ones that must never read as "patch".
 *
 * @module bootstrap-tools/scripts/schema-semver.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { classify, diffSchema, readAtRef, requiredBump } from "./schema-semver.ts";

const BASE = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://example.org/x.schema.json",
  title: "X",
  description: "A thing.",
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    kind: { type: "string", enum: ["a", "b"] },
    note: { type: "string" },
  },
  required: ["name"],
  additionalProperties: false,
};

const text = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;
const bump = (head: unknown): string => classify(text(BASE), text(head)).bump;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a mutable fixture edited by path in each case
const edit = (f: (s: Record<string, any>) => void): Record<string, unknown> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above
  const s = structuredClone(BASE) as Record<string, any>;
  f(s);
  return s;
};

describe("major — something that validated can now fail", () => {
  test("fieldMadeRequiredIsMajor", () => expect(bump(edit((s) => s.required.push("kind")))).toBe("major"));
  test("closedFieldRemovedIsMajor", () => expect(bump(edit((s) => delete s.properties.note))).toBe("major"));
  test("enumNarrowedIsMajor", () => expect(bump(edit((s) => (s.properties.kind.enum = ["a"])))).toBe("major"));
  test("lowerBoundRaisedIsMajor", () => expect(bump(edit((s) => (s.properties.name.minLength = 3)))).toBe("major"));
  test("patternAddedIsMajor", () => expect(bump(edit((s) => (s.properties.note.pattern = "^x")))).toBe("major"));
  test("strictnessTightenedIsMajor", () => {
    const open = edit((s) => delete s.additionalProperties);
    expect(classify(text(open), text(BASE)).bump).toBe("major");
  });
  test("conditionalAddedIsMajor", () => expect(bump(edit((s) => (s.allOf = [{ if: {}, then: {} }])))).toBe("major"));
  test("idChangedIsMajor", () => expect(bump(edit((s) => (s.$id = "https://example.org/y.schema.json")))).toBe("major"));
  test("schemaRemovedIsMajor", () => expect(classify(text(BASE), null).bump).toBe("major"));
  test("unknownKeywordChangeIsMajor", () =>
    expect(bump(edit((s) => (s.properties.note.dependentRequired = { a: ["b"] })))).toBe("major"));
});

describe("minor — only widens", () => {
  test("optionalFieldAddedIsMinor", () => expect(bump(edit((s) => (s.properties.extra = { type: "string" })))).toBe("minor"));
  test("requiredRelaxedIsMinor", () => expect(bump(edit((s) => (s.required = [])))).toBe("minor"));
  test("enumWidenedIsMinor", () => expect(bump(edit((s) => s.properties.kind.enum.push("c")))).toBe("minor"));
  test("strictnessRelaxedIsMinor", () => expect(bump(edit((s) => delete s.additionalProperties))).toBe("minor"));
  test("schemaPublishedIsMinor", () => expect(classify(null, text(BASE)).bump).toBe("minor"));
  test("requiredFieldAddedIsMajor", () =>
    expect(
      bump(
        edit((s) => {
          s.properties.extra = { type: "string" };
          s.required.push("extra");
        }),
      ),
    ).toBe("major"));
});

describe("patch and none", () => {
  test("descriptionRewrittenIsPatch", () => expect(bump(edit((s) => (s.properties.name.description = "The name.")))).toBe("patch"));
  test("releaseIriBumpIsNone", () => {
    const v1 = edit((s) => (s.$id = "https://example.org/b/0.1.0/x.schema.json"));
    const v2 = edit((s) => (s.$id = "https://example.org/b/0.2.0/x.schema.json"));
    expect(classify(text(v1), text(v2)).bump).toBe("none");
  });
  test("releaseIriToMajorIsNone", () => {
    const v1 = edit((s) => (s.$id = "https://example.org/b/0.1.0/x.schema.json"));
    const v2 = edit((s) => (s.$id = "https://example.org/b/v0/x.schema.json"));
    expect(classify(text(v1), text(v2)).bump).toBe("none");
  });
  test("keyOrderIsNone", () => {
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(BASE).reverse()));
    expect(classify(text(BASE), reordered).bump).toBe("none");
  });
  test("foldTakesHighest", () =>
    expect(requiredBump([...diffSchema(BASE, edit((s) => (s.title = "Y"))), { bump: "minor", at: "/", why: "x" }])).toBe("minor"));
});

describe("could not determine — never patch", () => {
  test("unreadableBaseUndetermined", () => expect(classify({ unreadable: "no such ref" }, text(BASE)).bump).toBe("could not determine"));
  test("unparsableBaseUndetermined", () => expect(classify("{ nope", text(BASE)).bump).toBe("could not determine"));
  test("unparsableHeadUndetermined", () => expect(classify(text(BASE), "{ nope").bump).toBe("could not determine"));
  test("unresolvedRefUndetermined", () => {
    const repo = join(import.meta.dir, "..", "..");
    const r = readAtRef(repo, "refs/heads/definitely-not-a-branch-81tw", "bootstrap/schemas/graph.schema.json");
    expect(typeof r === "object" && r !== null && "unreadable" in r).toBe(true);
    expect(classify(r, readFileSync(join(repo, "bootstrap/schemas/graph.schema.json"), "utf8")).bump).toBe(
      "could not determine",
    );
  });
});
