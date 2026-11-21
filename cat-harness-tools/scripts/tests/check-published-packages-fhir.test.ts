/**
 * A FHIR package's `package.json` is not an npm package (cat-harness-tools#1701):
 * an IG repository's `local-template/package/package.json` declares
 * `"type": "fhir.template"` and is the IG Publisher's, so `check:published-packages`
 * excuses it with a reason instead of running `bun install` on it.
 *
 * @module scripts/tests/check-published-packages-fhir
 */
import { describe, expect, test } from "bun:test";

import { notAnNpmManifest } from "../check-published-packages.ts";

describe("notAnNpmManifest", () => {
  test("a FHIR template package is named as one", () => {
    expect(notAnNpmManifest({ name: "who.fhir.smart-ig-empty-local", type: "fhir.template" })).toContain("a FHIR package");
  });

  test("npm's own `type` values, and an absent one, are npm's", () => {
    expect(notAnNpmManifest({ name: "a" })).toBeUndefined();
    expect(notAnNpmManifest({ name: "a", type: "module" })).toBeUndefined();
    expect(notAnNpmManifest({ name: "a", type: "commonjs" })).toBeUndefined();
  });

  test("any other `type` is not npm's, whatever it is", () => {
    expect(notAnNpmManifest({ name: "a", type: "something-else" })).toContain("not an npm package");
  });
});
