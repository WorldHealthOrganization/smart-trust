/**
 * `root-scan-census` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/root-scan-census.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each scans folio-assistant-core's
 * scripts, which only the checkout holds. Standing alone, cat-harness has none
 * of it, and `check:cat-harness-standalone` collects every test in that layer.
 * The rest of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { censusRepository } from "../../scripts/root-scan-census.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("the census covers the repository, and says which instances it scanned (tqv4)", () => {

  test("over this repository, folio-assistant-core's scripts are in scope", () => {
    const { rows, scope } = censusRepository(resolve(ORIGIN_DIR, "..", "..", ".."));
    expect(scope.find((s) => s.path === "folio-assistant-core/scripts")?.state).toBe("scanned");
    expect(rows.some((r) => r.file.startsWith("folio-assistant-core/scripts/"))).toBe(true);
  });
});
