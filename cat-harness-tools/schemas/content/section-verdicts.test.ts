/**
 * The tests of this file that read the whole checkout (reads who-iris's
 * committed section verdicts) live in `test/section-verdicts-checkout.test.ts`
 * (bean `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SECTION_VERDICTS_FILE, specimenSections } from "./section-verdicts";

describe("section verdicts (bean fnqn)", () => {
  test("an absent file is an empty answer", () => {
    expect(specimenSections(mkdtempSync(join(tmpdir(), "sv-")))).toEqual(new Set());
  });
  test("a present file that does not validate THROWS — never 'nothing is a specimen'", () => {
    const d = mkdtempSync(join(tmpdir(), "sv-"));
    writeFileSync(join(d, SECTION_VERDICTS_FILE), JSON.stringify({ $schema: "folio-section-verdicts/v1", verdicts: { e: { s: { role: "decorative" } } } }));
    expect(() => specimenSections(d)).toThrow();
  });
});
