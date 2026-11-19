/**
 * `section-verdicts` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/schemas/section-verdicts.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads who-iris's committed section
 * verdicts, which only the checkout holds. Standing alone, cat-harness has
 * none of it, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there; every path here is composed
 * from ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { specimenSections } from "../../schemas/content/section-verdicts.ts";

/** The directory these tests were written in (`cat-harness/schemas/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/schemas");

describe("section verdicts (bean fnqn)", () => {
  test("the committed who-iris verdicts load, and name six WPRO pages", () => {
    const s = specimenSections(resolve(ORIGIN_DIR, "../../who-iris/library"));
    expect(s.size).toBe(6);
    for (const p of ["014", "015", "028", "029", "030", "031"]) expect(s.has(`wpr-rdo-2020-003-eng/page-${p}`)).toBe(true);
    // pp. 20-22 were proposed and rejected: real guidance beside the samples
    for (const p of ["020", "021", "022"]) expect(s.has(`wpr-rdo-2020-003-eng/page-${p}`)).toBe(false);
  });
});
