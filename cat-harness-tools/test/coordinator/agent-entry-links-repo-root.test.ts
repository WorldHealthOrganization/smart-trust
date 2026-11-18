/**
 * `agent-entry-links` tests that read the aggregate repository's own root —
 * the root `AGENTS.md` — moved here from
 * `cat-harness/scripts/tests/agent-entry-links.test.ts` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has no
 * such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { parseLinks } from "../../src/core/markdown-links.js";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = repoRootFor(resolve(ORIGIN_DIR, "..", ".."));

describe("this repository, right now", () => {

  test("AGENTS.md carries a NON-TRIVIAL number of links", () => {
    // The guard against the failure mode this whole bean is about: "0 links
    // checked, 0 dead" over the file every agent opens first reads exactly
    // like a pass. If the parser breaks or the file is emptied, this fails.
    const links = parseLinks(readFileSync(join(REPO, "AGENTS.md"), "utf-8"));
    expect(links.length).toBeGreaterThan(20);
  });
});
