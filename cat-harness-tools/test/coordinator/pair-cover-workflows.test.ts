/**
 * `pair-cover.ts`'s fold, held against the CI workflows (bean `8qyc`).
 *
 * The one `pair-cover` assertion that reads `.github/workflows/`: every pair
 * the table folds, and every coverer it folds into, must be a pair `regen`
 * actually asks, which `regen` derives from the workflows through
 * `loadGates`. It lives here rather than beside the other `pair-cover` tests
 * in `cat-harness/scripts/tests/` because a standalone cat-harness layer has
 * no workflows, and `check:cat-harness-standalone` collects every test in that
 * layer. The full repository has them, and this layer is never run alone.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";

import { join } from "node:path";

import { COVERED } from "../../scripts/pair-cover.ts";
import { repairableGates } from "../../scripts/regen-after-merge.ts";
import { loadGates } from "../../scripts/gates.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { scriptsOf } from "../../schemas/sdlc/script-table.ts";

/** The directory this test was written in (`cat-harness-tools/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness-tools/scripts/tests");

const REPO = repoRootFor(join(ORIGIN_DIR, "..", "..", "..", "cat-harness"));
const SCRIPTS = scriptsOf(REPO);

describe("the equivalences still hold in this tree", () => {
  test("every residual is a script, and every coverer a pair regen asks", () => {
    const asked = new Set(repairableGates(loadGates(REPO, { all: false }), SCRIPTS).map((p) => p.check));
    for (const [check, c] of Object.entries(COVERED)) {
      expect(asked.has(check), `${check} is a pair`).toBe(true);
      for (const x of c.covers) expect(asked.has(x), `${check}'s coverer ${x} is a pair`).toBe(true);
      if (c.residual !== undefined) expect(SCRIPTS[c.residual], c.residual).toBeDefined();
    }
  });
});
