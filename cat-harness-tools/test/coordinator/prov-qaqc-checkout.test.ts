/**
 * `prov-qaqc` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/prov-qaqc.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads the root-declared
 * `beans/workflows/` instances, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";

import {
  buildReport,
  outputs,
  staleness,
  totals,
} from "../../scripts/prov-qaqc.js";

describe("prov-qaqc: the real repository", () => {
  test("vacuity guard: the committed instances yield more than zero activities, all valid", async () => {
    const r = await buildReport();
    const t = totals(r);
    expect(r.instances.size).toBeGreaterThan(0);
    expect(t.activities).toBeGreaterThan(0);
    expect(r.invalid).toEqual([]);
  });

  test("the committed page and logs are current (what check:prov-qaqc gates)", async () => {
    const files = outputs(await buildReport());
    expect(staleness(files)).toEqual({ stale: [], orphans: [] });
  });
});
