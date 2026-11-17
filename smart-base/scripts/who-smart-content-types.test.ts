/**
 * Slide 1 of the living deck (`cat-harness/docs/source/concepts-harnessed-kg-overview/`):
 * the layers page lists all five SMART knowledge layers.
 *
 * Moved from cat-harness-tools' `test/coordinator/harnessed-kg-overview.test.ts`
 * with the section it reads, which left the harness's FHIR content page for
 * this layer's WHO SMART content types page (bean p9bu). The claim is
 * unchanged; only who makes it moved, as slide 3's did (bean 1335).
 *
 * @module smart-base/scripts/who-smart-content-types.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = join(import.meta.dir, "../site-docs/source/concepts-who-smart-content-types");

describe("living deck slide 1: the five SMART layers", () => {
  test("layersSectionListsFiveLayers", () => {
    const t = readFileSync(join(PAGE, "the-three-layers.md"), "utf-8");
    for (const l of ["**L1** Narrative", "**L2** Operational", "**L3** Machine readable", "L4 Executable", "L5 Dynamic"]) {
      expect(t).toContain(l);
    }
  });
});
