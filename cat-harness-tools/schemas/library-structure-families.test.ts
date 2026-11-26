/**
 * A library's `structure.json` is routed to the family its format names
 * (`pdf-structure/v1`, `notebook-structure/v1`, `text-structure/v1`), though
 * it tags itself `_schema` rather than `$schema`. Until these were listed,
 * every one was "library names no $schema family" to kg-validate.
 */
import { describe, expect, test } from "bun:test";

import { familyBody, nodeFamilyTag, resolveNodeSchemas, stripAnnotations } from "./kg/kind-validator.ts";

import { requireHarnessRoot } from "./harness-root.ts";
const HARNESS = requireHarnessRoot();
const text = {
  _schema: "text-structure/v1",
  _comment: "an annotation, dropped",
  doc_id: "t",
  source: { file: "t.md", sha256: "a".repeat(64), digest: "file", bytes: 3, mtime: null, mimetype_sniffed: "text/plain", mimetype_source: "content" },
};

describe("library structure families", () => {
  test("each format resolves to a runnable schema", async () => {
    const fams = new Map((await resolveNodeSchemas("library", HARNESS)).map((f) => [f.tag, f.state]));
    for (const tag of ["pdf-structure/v1", "notebook-structure/v1", "text-structure/v1"]) expect(fams.get(tag)).toBe("resolved");
  });

  test("a node is routed by `$schema`, or by `_schema` when it has none", () => {
    expect(nodeFamilyTag({ $schema: "a/v1", _schema: "b/v1" })).toBe("a/v1");
    expect(nodeFamilyTag(text)).toBe("text-structure/v1");
    expect(nodeFamilyTag({})).toBeUndefined();
    expect(nodeFamilyTag([])).toBeUndefined();
  });

  test("the body keeps the `_schema` tag it was routed by, and drops the annotations", () => {
    expect(familyBody(text)).toEqual({ ...stripAnnotations(text) as object, _schema: "text-structure/v1" });
    expect(familyBody({ $schema: "a/v1", _schema: "x", _note: "n" })).toEqual({ $schema: "a/v1" });
    expect(familyBody({ _note: "n", k: 1 })).toEqual({ k: 1 });
  });
});
