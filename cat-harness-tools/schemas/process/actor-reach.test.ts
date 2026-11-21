/**
 * Reach composition — and specifically the ASYMMETRY, which is the part a
 * "take the more restrictive value" implementation gets wrong.
 */
import { describe, expect, test } from "bun:test";

import {
  REACH_UNKNOWN,
  canReachOut,
  effectiveReach,
  reachConflict,
} from "./actor-reach";
import { NETWORK_REACHES } from "../kg/cat-harness";

describe("effectiveReach composes two levels, asymmetrically", () => {
  test("an air-gapped deployment determines an undeclared actor", () => {
    // The aggregate admits exactly one value, so it determines every member.
    expect(effectiveReach("air-gapped", undefined)).toBe("air-gapped");
  });

  test("a CONNECTED deployment determines nothing about an undeclared actor", () => {
    // The case the owner raised: a connected site holding an isolated signing
    // host. Reading "internet" here would make that unrepresentable, and would
    // do it by inventing the permissive answer.
    expect(effectiveReach("internet", undefined)).toBe(REACH_UNKNOWN);
    expect(effectiveReach("egress-restricted", undefined)).toBe(REACH_UNKNOWN);
  });

  test("nothing declared is unknown, not a default", () => {
    expect(effectiveReach(undefined, undefined)).toBe(REACH_UNKNOWN);
  });

  test("an actor's own declaration stands when the deployment is silent", () => {
    for (const r of NETWORK_REACHES) expect(effectiveReach(undefined, r)).toBe(r);
  });

  test("with both declared, the more restrictive wins", () => {
    expect(effectiveReach("internet", "air-gapped")).toBe("air-gapped");
    expect(effectiveReach("internet", "egress-restricted")).toBe("egress-restricted");
    expect(effectiveReach("air-gapped", "internet")).toBe("air-gapped");
    expect(effectiveReach("egress-restricted", "internet")).toBe("egress-restricted");
  });

  test("agreement is idempotent", () => {
    for (const r of NETWORK_REACHES) expect(effectiveReach(r, r)).toBe(r);
  });

  test("every value in the vocabulary has an answer — no silent gap", () => {
    // A `Record` keyed on the enum would be checked by the compiler; this
    // checks the RUNTIME behaviour, which is what a DMN fact crosses into.
    const levels = [undefined, ...NETWORK_REACHES] as const;
    for (const d of levels) {
      for (const a of levels) {
        const got = effectiveReach(d, a);
        expect([...NETWORK_REACHES, REACH_UNKNOWN]).toContain(got);
      }
    }
  });
});

describe("canReachOut", () => {
  test("unknown does NOT count as reachable", () => {
    // The third-state rule. Anything that treats could-not-determine as
    // reachable produces an unsigned report that looks signed.
    expect(canReachOut(REACH_UNKNOWN)).toBe(false);
    expect(canReachOut("air-gapped")).toBe(false);
    expect(canReachOut("internet")).toBe(true);
    expect(canReachOut("egress-restricted")).toBe(true);
  });
});

describe("reachConflict reports one direction only", () => {
  test("an actor claiming more than its deployment grants is a conflict", () => {
    const c = reachConflict("signer", "air-gapped", "internet");
    expect(c?.actorId).toBe("signer");
    expect(c?.reason).toMatch(/BOUNDS/);
  });

  test("an air-gapped actor inside a connected deployment is NOT a conflict", () => {
    // It is the case the whole feature exists for. Reporting it would make
    // the finding list useless on the day it matters.
    expect(reachConflict("signer", "internet", "air-gapped")).toBeUndefined();
    expect(reachConflict("signer", "egress-restricted", "air-gapped")).toBeUndefined();
  });

  test("an undeclared side is never a conflict", () => {
    expect(reachConflict("x", undefined, "internet")).toBeUndefined();
    expect(reachConflict("x", "air-gapped", undefined)).toBeUndefined();
  });

  test("a conflict is exactly the complement of the clamp being a no-op", () => {
    // Stated as a relation rather than a second table: if the clamp had to
    // lower the actor's value, the actor over-claimed. Two functions
    // disagreeing about that is the defect this pins.
    const levels = [undefined, ...NETWORK_REACHES] as const;
    for (const d of levels) {
      for (const a of levels) {
        const clamped = effectiveReach(d, a);
        const conflict = reachConflict("x", d, a);
        if (d && a) expect(Boolean(conflict)).toBe(clamped !== a);
        else expect(conflict).toBeUndefined();
      }
    }
  });
});
