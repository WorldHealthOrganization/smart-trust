/**
 * `contributions-root` tests whose subject is folio-assistant-sci's
 * contribution — the two cost checkers this layer contributes — moved here
 * from `cat-harness/content/pipeline/contributions-root.test.ts` (bean
 * `ho66`). The code under test is cat-harness's, imported DOWN; what it is
 * held against is this layer's, so standing alone cat-harness has nothing
 * for these to read. The rest of that file's tests stay there.
 *
 * Then moved up again, to the aggregate's `test/` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): `contributionsRoot()` answers for the
 * RUNNING checkout, and only the aggregate's root depends on sci. Standing
 * alone, folio-assistant-sci is no folio that depends on itself
 * (`seed:ready --layer folio-assistant-sci --rehearse`, 2026-10-07).
 */
import { describe, expect, test } from "bun:test";
import { contributionsRoot } from "../../pipeline/repo-root.ts";
import { loadContributions } from "../../schemas/kg/harness-config.ts";
import { ContributionRegistry, type FolioContribution } from "../../schemas/content/contributions.ts";
const COST_CRITERIA = ["proof-compile-cost", "proof-no-cost-regression"];

async function checkersFrom(root: string) {
  const reg = await loadContributions<FolioContribution, ContributionRegistry>(root, new ContributionRegistry());
  return COST_CRITERIA.filter((c) => reg.qaChecker(c) !== undefined);
}

describe("contributionsRoot", () => {

  test("loading from contributionsRoot() registers both contributed cost checkers", async () => {
    expect(await checkersFrom(contributionsRoot())).toEqual(COST_CRITERIA);
  });
});
