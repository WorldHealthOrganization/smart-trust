/**
 * The threshold clauses — and the upper size bound in particular.
 *
 * @module cat-harness/schemas/detangle.test
 *
 * `failingClauses` and `DEFAULT_THRESHOLDS` had NO test of any kind before
 * 2026-09-27: nothing asserted that a clause fires, and nothing would have
 * noticed a threshold silently stopping working. Found while adding `maxSize`,
 * which is the point at which an untested predicate becomes a liability rather
 * than a gap.
 */
import { describe, expect, test } from "bun:test";

import { DEFAULT_THRESHOLDS, failingClauses, type DetangleMetrics } from "./detangle.ts";

/** A group that trips NO clause, so each test varies one axis from clean. */
function clean(over: Partial<DetangleMetrics> = {}): DetangleMetrics {
  return {
    group: "g",
    size: 20,
    internal: 40,
    inbound: 10,
    outbound: 0,
    cohesion: 0.8,
    oneWayness: 1,
    directionality: 1,
    role: "provider",
    enforcedBoundary: 10,
    recordedBoundary: 0,
    proseMentions: 0,
    distinctTargets: 0,
    distinctTargetGroups: 0,
    worklist: [],
    ...over,
  } as DetangleMetrics;
}

const tooLarge = (m: DetangleMetrics): string | undefined =>
  failingClauses(m).find((c) => c.includes("too large"));

describe("the baseline group is clean, so every other test varies one axis", () => {
  test("no clause fires", () => {
    expect(failingClauses(clean())).toEqual([]);
  });
});

describe("maxSize — size RAISES the finding, cohesion only shapes it", () => {
  /**
   * The rule the owner corrected into existence. A first draft required
   * `size > maxSize AND cohesion < minCohesion`, which made the module decide
   * that a large COHESIVE group was fine — a judgement §"taste is a declared
   * step" forbids it — and meant `cat-harness/schemas` (234 nodes, cohesion
   * 0.82) could never be reported at all.
   */
  test("a large INCOHERENT group is reported as several subgraphs filed as one", () => {
    const c = tooLarge(clean({ size: 166, cohesion: 0.22, internal: 154, inbound: 523 }));
    expect(c).toBeDefined();
    expect(c).toContain("several");
    // It must point at `internalClusters` rather than ASSERT a seam. Measured
    // 2026-09-27: the two lowest-cohesion groups in this repository are each a
    // single connected component, so low cohesion does not imply a free split
    // and the first wording of this clause was wrong in exactly that way.
    expect(c).toContain("internalClusters");
    expect(c).toContain("BEFORE assuming");
  });

  test("a large COHESIVE group is STILL reported — and as an adjudication", () => {
    const c = tooLarge(clean({ size: 234, cohesion: 0.82, internal: 126, inbound: 27, outbound: 1 }));
    expect(c).toBeDefined();
    expect(c).toContain("adjudication");
    // And it must warn that a high score can hide non-participation.
    expect(c).toContain("PARTICIPATION");
    // It must NOT tell the reader to split: the carve is not this module's call.
    expect(c).not.toContain("several subgraphs filed as one");
  });

  test("the two branches say DIFFERENT things, so cohesion is actually read", () => {
    const incoherent = tooLarge(clean({ size: 100, cohesion: 0.1 }));
    const cohesive = tooLarge(clean({ size: 100, cohesion: 0.9 }));
    expect(incoherent).not.toBe(cohesive);
  });

  test("at or below the bound, nothing fires — the boundary is not off by one", () => {
    expect(tooLarge(clean({ size: DEFAULT_THRESHOLDS.maxSize, cohesion: 0.1 }))).toBeUndefined();
    expect(tooLarge(clean({ size: DEFAULT_THRESHOLDS.maxSize + 1, cohesion: 0.1 }))).toBeDefined();
  });

  /**
   * The anti-vacuity pair. Every test above passes for a clause that fired on
   * size alone AND for one that ignored size entirely, as long as it returned
   * something. This asserts the bound is load-bearing in both directions, which
   * no constant-shaped predicate satisfies.
   */
  test("size is load-bearing: a small group is never `too large`, whatever its cohesion", () => {
    for (const cohesion of [0.05, 0.5, 0.95]) {
      expect(tooLarge(clean({ size: 20, cohesion }))).toBeUndefined();
    }
    expect(tooLarge(clean({ size: 500, cohesion: 0.5 }))).toBeDefined();
  });
});

describe("minSize — the lower bound the upper one was missing beside", () => {
  test("below it, a group is a file move rather than a subgraph", () => {
    const c = failingClauses(clean({ size: 2 })).find((x) => x.includes("file move"));
    expect(c).toBeDefined();
  });

  test("the two size clauses are mutually exclusive, so no group is both", () => {
    for (const size of [1, 4, 5, 20, 70, 71, 500]) {
      const cs = failingClauses(clean({ size, cohesion: 0.1 }));
      const low = cs.some((c) => c.includes("file move"));
      const high = cs.some((c) => c.includes("too large"));
      expect(low && high).toBe(false);
    }
  });
});
