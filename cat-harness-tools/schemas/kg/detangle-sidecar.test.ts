/**
 * The direction counts are PINNED — bean `j79e`'s columns, `1xhc`'s gap.
 *
 * `wdir` and `undet` were added to the report on 2026-09-23, two days after
 * the owner ruled what the sidecar pins. Nobody went back, so for three days
 * `kg:detangle --check` compared nine fields and the two that answer "is the
 * layering inverted" were printed and dropped. In that window
 * `cat-harness/schemas/library/intake.ts` began importing `folio-assistant-core` and
 * the check stayed green, because the field it would have had to compare was
 * not in the file.
 *
 * These tests pin the FIELD LIST rather than a measurement. A test asserting
 * "wrongDirection is 1" would go red the day somebody fixes the edge, which
 * would teach the next agent to delete it. What must not regress is that the
 * number is recorded at all.
 */
import { describe, expect, test } from "bun:test";

import { PINNED_FIELDS, sidecarFor, staleFields } from "./detangle-sidecar.js";

/** A measurement with every field `sidecarFor` picks from, so a test can vary one at a time. */
const metrics = {
  group: "cat-harness/schemas",
  size: 225,
  internal: 122,
  inbound: 25,
  outbound: 2,
  cohesion: 0.8243,
  enforcedBoundary: 26,
  recordedBoundary: 1,
  proseMentions: 1,
  wrongDirection: 1,
  undeterminedDirection: 0,
};

describe("the direction counts survive the round trip", () => {
  test("both are emitted, and `wrongDirection` carries its value rather than a default", () => {
    const s = sidecarFor(metrics);
    expect(s.wrongDirection).toBe(1);
    expect(s.undeterminedDirection).toBe(0);
  });

  test("both are in PINNED_FIELDS, so the comparer sees what the writer wrote", () => {
    // One list feeds `sidecarFor`'s output and `staleFields`' comparison. A
    // field emitted but not listed is the exact shape of the defect above:
    // written to the file, never compared against it.
    expect(PINNED_FIELDS).toContain("wrongDirection");
    expect(PINNED_FIELDS).toContain("undeterminedDirection");
  });

  test("`undeterminedDirection` is pinned SEPARATELY, so the third state cannot hide in the first", () => {
    // An edge moving wrong-direction -> undetermined is not a fix: it means
    // the source layer stopped declaring `needs`. Pinning only
    // `wrongDirection` would read that as 1 -> 0 and call it progress.
    const before = sidecarFor(metrics);
    const after = sidecarFor({ ...metrics, wrongDirection: 0, undeterminedDirection: 1 });
    expect(staleFields(before, after)).toEqual(["wrongDirection", "undeterminedDirection"]);
  });
});

describe("the comparer is neither always-empty nor always-full", () => {
  // The anti-vacuity pair: the same function must return [] for no change AND
  // a finding for one. An implementation that always agrees passes the first
  // of these and fails the second; one that always disagrees does the reverse.
  test("an unchanged measurement is not stale", () => {
    expect(staleFields(sidecarFor(metrics), sidecarFor(metrics))).toEqual([]);
  });

  test("a changed `wrongDirection` IS stale, and is named", () => {
    const committed = sidecarFor({ ...metrics, wrongDirection: 0 });
    expect(staleFields(committed, sidecarFor(metrics))).toEqual(["wrongDirection"]);
  });
});

test("a sidecar missing the direction fields entirely reads as stale, not as zero", () => {
  // The upgrade path. Every sidecar committed before this change lacks both
  // keys, and `undefined !== 0` — so they are reported stale and regenerated,
  // rather than being silently read as "no wrong-direction edges here".
  const legacy = { ...sidecarFor(metrics) } as Record<string, unknown>;
  delete legacy.wrongDirection;
  delete legacy.undeterminedDirection;
  expect(staleFields(legacy, sidecarFor(metrics))).toEqual(["wrongDirection", "undeterminedDirection"]);
});
