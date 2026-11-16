import { describe, expect, test } from "bun:test";
import { blockPlacement, pointsForward } from "../../pipeline/qa-checkers-extended";
import { hasFolio } from "./helpers";

/**
 * `blockPlacement` / `pointsForward` exist so a caller can cost a proposed
 * `uses[]` edge before writing it — restoring a pruned dependency adds a
 * `uses[]` entry, and if the target sits later in the same chapter that is a
 * forward reference, which is the metric the detangler arc has been reducing.
 *
 * The contract these pin is the three-way outcome. `unlisted` and
 * `unavailable` must stay distinct, and `pointsForward` must answer
 * `undefined` rather than `false` when it cannot tell — conflating "I could not
 * check" with "it is fine" is the exact defect this area keeps producing
 * (`checkDetanglerNoForwardRef` returns `pass` for an unpositioned block, so an
 * unbuilt graph and a clean corpus read identically).
 */
describe("blockPlacement", () => {
  test("a label nothing could ever list is never reported as ok", () => {
    // True with or without a folio attached: with one, the graph builds and the
    // label is `unlisted`; without one, the graph cannot build and it is
    // `unavailable`. Either way it must not come back positioned.
    const p = blockPlacement("def:not-a-real-block-xyzzy");
    expect(p.status === "unlisted" || p.status === "unavailable").toBe(true);
    expect(p.status).not.toBe("ok");
  });

  test("an unanswerable comparison is undefined, not false", () => {
    expect(pointsForward("def:not-a-real-block-xyzzy", "def:also-not-real-xyzzy")).toBeUndefined();
  });

  test.skipIf(!hasFolio())("a real block resolves, and within is the intra-chapter index", () => {
    // Any block the attached folio lists will do — take one from the graph via
    // a label the corpus is known to carry.
    const p = blockPlacement("def:crossing-energy");
    if (p.status !== "ok") {
      // The folio attached may not be qou; that is not a failure of this API.
      expect(p.status === "unlisted").toBe(true);
      return;
    }
    expect(p.pos).toBeGreaterThanOrEqual(0);
    expect(p.within).toBe(p.pos % 1_000_000);
    expect(p.chapter.length).toBeGreaterThan(0);
  });

  test.skipIf(!hasFolio())("a block never points forward to itself", () => {
    const p = blockPlacement("def:crossing-energy");
    if (p.status !== "ok") return;
    expect(pointsForward("def:crossing-energy", "def:crossing-energy")).toBe(false);
  });
});
