/**
 * `beans-landed` tests that read the aggregate repository's own root — the
 * root-declared `beans/` store — moved here from
 * `cat-harness/scripts/tests/beans-landed.test.ts` (bean `ho66`), as
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

import { openBeans } from "../../scripts/beans-landed.js";

describe("openBeans", () => {
  test("reads the real store through its declaration, and excludes epics and closed beans", () => {
    const bs = openBeans();
    expect(bs.length).toBeGreaterThan(0);
    expect(bs.every((b) => b.type !== "epic" && ["todo", "in-progress", "draft"].includes(b.status))).toBe(true);
  });
});
