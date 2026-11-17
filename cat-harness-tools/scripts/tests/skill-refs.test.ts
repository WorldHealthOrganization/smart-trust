/**
 * A skill reference — `name` or `package/name` — names exactly one skill
 * (#1168 B8, owner 2026-09-30: "both; qualify if ambiguous").
 *
 * The schema checks a reference's SHAPE; this checks that it resolves, and
 * that a bare name is not one two packages hold. A bare name that became
 * ambiguous would otherwise resolve to whichever package a scan met first.
 *
 * The tests of this file that read the whole checkout (resolves every skill
 * reference across every layer in the checkout) live in
 * `test/skill-refs-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import { resolveSkillRef } from "../known-skills.js";

describe("resolveSkillRef", () => {
  const index = new Map<string, string[]>([
    ["solo", ["folio-core"]],
    ["twice", ["folio-core", "crdm"]],
  ]);

  test("a bare name one package holds resolves to it", () => {
    expect(resolveSkillRef("solo", index)).toEqual({ kind: "ok", name: "solo", package: "folio-core" });
  });

  test("a bare name two packages hold is ambiguous, never picked", () => {
    expect(resolveSkillRef("twice", index)).toEqual({ kind: "ambiguous", ref: "twice", packages: ["crdm", "folio-core"] });
  });

  test("qualifying it resolves it", () => {
    expect(resolveSkillRef("crdm/twice", index)).toEqual({ kind: "ok", name: "twice", package: "crdm" });
  });

  test("a name nothing holds, or a package that does not hold it, is missing", () => {
    expect(resolveSkillRef("nope", index).kind).toBe("missing");
    expect(resolveSkillRef("crdm/solo", index).kind).toBe("missing");
  });
});
