/**
 * `gates-third-state` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/sdlc/gates-third-state.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads the aggregate root's
 * `.github/workflows/code-quality-gates.yml`, which only the checkout holds.
 * Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { loadGates } from "../../scripts/gates.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("loadGates refuses rather than returning an empty set", () => {

  it("returns a NON-EMPTY set for this repository, so the tests above are not vacuous", () => {
    // Without this, both assertions could be passing because `loadGates` throws
    // unconditionally — the "filter over nothing" trap. A real root must work.
    const root = join(ORIGIN_DIR, "..", "..", "..");
    expect(loadGates(root, { all: false }).length).toBeGreaterThan(0);
  });
});
