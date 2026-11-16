/**
 * `contributionsRoot()` is where contributions load from, and the regression
 * it guards is measured, not hypothetical: qa-sweep loaded from
 * `cat-harness/`, which declares no dependencies, registered 0 contributed
 * checkers, and so never ran folio-assistant-sci's two cost criteria
 * (folio-assistant#1492). Loading from `cat-harness/` returns an empty
 * registry WITHOUT error, which is why this needs a test rather than a crash
 * to notice it.
 *
 * The tests here whose subject is folio-assistant-sci's contribution (the two
 * cost checkers this layer contributes) live in
 * the checkout's `test/contributions-root-sci-checkout.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such contribution to read.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "path";
import { contributionsRoot } from "./repo-root";
import { loadContributions } from "../schemas/kg/harness-config.ts";
import { ContributionRegistry, type FolioContribution } from "../schemas/content/contributions.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

const PLATFORM_INSTANCE = resolve(HARNESS_ROOT);
const COST_CRITERIA = ["proof-compile-cost", "proof-no-cost-regression"];

async function checkersFrom(root: string) {
  const reg = await loadContributions<FolioContribution, ContributionRegistry>(root, new ContributionRegistry());
  return COST_CRITERIA.filter((c) => reg.qaChecker(c) !== undefined);
}

describe("contributionsRoot", () => {
  test("in the platform's own repository it is the repository root, not cat-harness/", () => {
    expect(contributionsRoot()).toBe(resolve(PLATFORM_INSTANCE, ".."));
  });

  test("the control: loading from cat-harness/ registers neither cost checker", async () => {
    expect(await checkersFrom(PLATFORM_INSTANCE)).toEqual([]);
  });
});
