/**
 * The edit-skill map is TOTAL (issue #1146). Owner: *"it is a QA in and of
 * itself if there are missing"*, so a declaration key with no row fails here,
 * and so does a row naming a skill that does not exist.
 *
 * The tests of this file that read the whole checkout (resolves skills that
 * the content layers above cat-harness hold) live in
 * `test/property-skills-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import { CatHarnessDeclarationSchema } from "./cat-harness.ts";
import { PROPERTY_SKILLS } from "./property-skills.ts";

function declarationKeys(): string[] {
  const s = CatHarnessDeclarationSchema as unknown as { _def: { schema?: { shape: object } }; shape?: object };
  const shape = s._def.schema?.shape ?? s.shape;
  return Object.keys(shape ?? {});
}

describe("PROPERTY_SKILLS", () => {
  test("the schema has keys to check (vacuity guard)", () => {
    expect(declarationKeys().length).toBeGreaterThan(10);
  });

  test("every declaration key has a row: a skill or a recorded gap", () => {
    const missing = declarationKeys().filter((k) => !(k in PROPERTY_SKILLS));
    expect(missing).toEqual([]);
  });

  test("no row for a key the schema does not have", () => {
    const keys = new Set(declarationKeys());
    expect(Object.keys(PROPERTY_SKILLS).filter((k) => !keys.has(k))).toEqual([]);
  });

  test("a row with no skill says why", () => {
    for (const [, r] of Object.entries(PROPERTY_SKILLS)) {
      const row = r as { skills: readonly string[]; gap?: string };
      if (row.skills.length === 0) expect((row.gap ?? "").length).toBeGreaterThan(0);
    }
  });
});
