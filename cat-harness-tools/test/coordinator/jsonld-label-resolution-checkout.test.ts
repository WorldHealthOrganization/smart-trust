/**
 * `jsonld-label-resolution` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/jsonld-label-resolution.test.ts` (bean `7zz1`,
 * owner ruling 2026-10-06 "Top-level instance"): each reads the label prefixes
 * the content layers contribute, which only the checkout holds. Standing
 * alone, cat-harness has none of it, and `check:cat-harness-standalone`
 * collects every test in that layer. The rest of that file's tests stay there;
 * every path here is composed from ORIGIN_DIR, the directory they were written
 * in, so nothing they read changed.
 */
import { describe, test, expect } from "bun:test";
import { resolve, join } from "path";
import { parseReference } from "../../schemas/kg/jsonld.ts";
import type { FolioContribution } from "../../schemas/content/contributions.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("contributed label prefixes", () => {

  test("the real registry supplies them", async () => {
    const { loadContributions } = await import("../../schemas/kg/harness-config.ts");
    const { ContributionRegistry } = await import("../../schemas/content/contributions.ts");
    const registry = await loadContributions<FolioContribution, InstanceType<typeof ContributionRegistry>>(
      resolve(ORIGIN_DIR, "../../.."),
      new ContributionRegistry(),
    );
    const prefixes = registry.contributedLabelPrefixes();
    expect(prefixes).toContain("dt");
    expect(parseReference("dt:anc-contact", prefixes).form).toBe("same-paper");
  });
});
