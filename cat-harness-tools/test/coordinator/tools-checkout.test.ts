/**
 * `tools` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/tools/tools.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each discovers skills across every
 * layer in the checkout, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";

import { checkTools, knownSkills } from "../../scripts/check-tools.js";
import { tools } from "../../tools/discover.js";
import { danglingRemedies, networkToolsWithoutRemedies, remediesFor } from "../../schemas/tools/tool.js";

/**
 * The Tool audit, run ONCE at module scope.
 *
 * Bean `sff8`. Five tests called `checkTools()` and each paid the full scan, putting
 * two of them among the repository's highest timeout exposure — measured by
 * `check:test-budgets` at **4.45 s and 3.27 s of a 5000 ms default budget** (89 % and
 * 65 %), named before either had gone red.
 *
 * Safe to share because nothing in this file mutates the corpus: all five calls are
 * no-arg, and no test writes a fixture, so five runs could only ever produce the same
 * answer. Module scope also belongs to no test's timeout, which is the remedy `sff8`
 * settled on over a raised budget — a number decays as the corpus grows.
 */
const CHECKED = checkTools();

describe("tools", () => {

  test("every satisfies names a skill that exists", () => {
    // The constraint a schema cannot express: Zod can require `satisfies` to be
    // non-empty, but it does not get to read the tree.
    expect(CHECKED.danglingSatisfies).toEqual([]);
  });

  test("skill discovery is not a hardcoded list", () => {
    // Four hardcoded corpus paths have been wrong in this repo already; this
    // asserts the check sees the packages a list would have missed.
    const s = knownSkills();
    expect(s.has("smart-base-tools")).toBe(true); // smart-base/skills/content/authoring-who-smart-guidelines
    expect(s.has("lean-formalization")).toBe(true); // schemas/skills/<name>/
    expect(s.has("kg-export")).toBe(true); // skills/folio-core
  });
});

// Bean `6mk7`: the case that motivated `remedies`. On 2026-10-06 a refused
// packages.fhir.org did not lead the agent to the seeder; this is the lookup
// that now does, over the real graph.
describe("remedies over the real Tool graph", () => {
  const all = tools();

  test("every network Tool states its remedies, and every named remedy exists", () => {
    expect(networkToolsWithoutRemedies(all)).toEqual([]);
    expect(danglingRemedies(all)).toEqual([]);
  });

  test("a refused packages.fhir.org leads to fhir-cache-seed-npm", () => {
    const tools_ = new Set(remediesFor(all, "packages.fhir.org").map((m) => m.tool).filter(Boolean));
    expect([...tools_]).toEqual(["fhir-cache-seed-npm"]);
  });
});
