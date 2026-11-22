/**
 * The milestone closure: transitive, cycle-safe, and three status buckets.
 *
 * Every case here is a shape the bean store can actually hold, and the three
 * that matter are the ones a naive rollup gets wrong: an epic nested under an
 * epic (a fixed two-level walk drops its children), a parent cycle (a naive
 * walk hangs rather than reporting), and a status in neither the open nor the
 * closed set (folding it into either moves the share).
 */
import { describe, expect, it } from "bun:test";

import type { BeanNode } from "../beans.ts";
import { milestoneRollup } from "../milestone-rollup.ts";

/** A bean with only the fields the rollup reads set to anything meaningful. */
function bean(id: string, type: string, status: string, parent = ""): BeanNode {
  return {
    id,
    file: `beans/defs/${id}.md`,
    title: `title ${id}`,
    status,
    type,
    priority: "normal",
    parent,
    blocking: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    body: "",
  };
}

describe("milestoneRollup", () => {
  it("rolls a two-level closure up and derives the share from the counts", () => {
    const r = milestoneRollup([
      bean("m1", "milestone", "in-progress"),
      bean("e1", "epic", "in-progress", "m1"),
      bean("t1", "task", "completed", "e1"),
      bean("t2", "task", "scrapped", "e1"),
      bean("t3", "task", "todo", "e1"),
      bean("t4", "task", "in-progress", "e1"),
    ]);
    expect(r.milestones).toHaveLength(1);
    const m = r.milestones[0]!;
    // The epic counts as a descendant; `epics` counts it separately.
    expect(m.total).toBe(5);
    expect(m.epics).toBe(1);
    // `scrapped` is closed, not discarded: the work is resolved either way.
    expect(m.closed).toBe(2);
    expect(m.open).toBe(3);
    expect(m.inProgress).toBe(2);
    expect(m.todo).toBe(1);
    expect(m.share).toBeCloseTo(2 / 5);
  });

  it("descends through an epic nested under an epic", () => {
    // `check-bean-parents` admits a parent typed `epic` OR `milestone` and says
    // nothing against epic-under-epic, so the depth is whatever the store
    // holds. A two-level walk would report total 1 here.
    const r = milestoneRollup([
      bean("m1", "milestone", "in-progress"),
      bean("e1", "epic", "in-progress", "m1"),
      bean("e2", "epic", "in-progress", "e1"),
      bean("deep", "task", "completed", "e2"),
    ]);
    const m = r.milestones[0]!;
    expect(m.total).toBe(3);
    expect(m.closed).toBe(1);
    // `epics` is DIRECT children only — `e2` is under `e1`, not under `m1`.
    expect(m.epics).toBe(1);
  });

  it("terminates on a parent cycle instead of hanging", () => {
    // Nothing in `check-bean-parents` forbids this, and a naive walk does not
    // return. Counted once each, which is the only answer a cycle admits.
    const r = milestoneRollup([
      bean("m1", "milestone", "in-progress"),
      bean("a", "epic", "in-progress", "m1"),
      bean("b", "epic", "in-progress", "a"),
      bean("c", "epic", "todo", "b"),
    ]);
    // Re-parent `a` under `c` to close the loop.
    const cyclic = [
      bean("m1", "milestone", "in-progress"),
      bean("a", "epic", "in-progress", "c"),
      bean("b", "epic", "in-progress", "a"),
      bean("c", "epic", "todo", "b"),
    ];
    expect(r.milestones[0]!.total).toBe(3);
    // The cycle is unreachable from the milestone, so the milestone is empty
    // and the three beans are orphans — the point is that it RETURNS.
    const got = milestoneRollup(cyclic);
    expect(got.milestones[0]!.total).toBe(0);
    expect(got.orphanOpen).toBe(3);
  });

  it("counts a status in neither set on its own, in neither figure", () => {
    const r = milestoneRollup([
      bean("m1", "milestone", "in-progress"),
      bean("e1", "epic", "in-progress", "m1"),
      bean("odd", "task", "parked", "e1"),
      bean("done", "task", "completed", "e1"),
    ]);
    const m = r.milestones[0]!;
    expect(m.unclassified).toBe(1);
    expect(m.closed).toBe(1);
    // `in-progress` e1 is the only open one — `parked` is in neither.
    expect(m.open).toBe(1);
    // The share is over the CLASSIFIED beans, so the unknown one cannot move it.
    expect(m.share).toBeCloseTo(1 / 2);
  });

  it("reports open beans under no milestone, and does not count them as any milestone's", () => {
    const r = milestoneRollup([
      bean("m1", "milestone", "in-progress"),
      bean("e1", "epic", "in-progress", "m1"),
      bean("in", "task", "todo", "e1"),
      // An epic with no milestone above it — the 2026-10-03 case, 18 of 30.
      bean("loose", "epic", "in-progress"),
      bean("out1", "task", "todo", "loose"),
      bean("out2", "task", "in-progress", "loose"),
      bean("shut", "task", "completed", "loose"),
    ]);
    expect(r.milestones[0]!.total).toBe(2);
    // `loose`, `out1`, `out2` are open and outside; `shut` is closed so it is
    // not in the open denominator at all.
    expect(r.orphanOpen).toBe(3);
    // `openTotal` includes the milestone and both epics, which are open.
    expect(r.openTotal).toBe(6);
    // Summed from the closures, so it reconciles: 6 = 2 covered + 3 orphan +
    // 1 open milestone. Subtraction would not say the same thing.
    expect(r.coveredOpen).toBe(2);
    expect(r.coveredOpen + r.orphanOpen + 1).toBe(r.openTotal);
  });

  it("gives a milestone with no descendants a null share rather than 0%", () => {
    // 0% says the work is untouched; null says there is no work to measure.
    const r = milestoneRollup([bean("m1", "milestone", "todo")]);
    expect(r.milestones[0]!.total).toBe(0);
    expect(r.milestones[0]!.share).toBeNull();
  });

  it("orders milestones by id, so a report does not reorder between runs", () => {
    const r = milestoneRollup([
      bean("zzz", "milestone", "in-progress"),
      bean("aaa", "milestone", "in-progress"),
      bean("mmm", "milestone", "in-progress"),
    ]);
    expect(r.milestones.map((m) => m.id)).toEqual(["aaa", "mmm", "zzz"]);
  });

  it("orders milestones by title, numerically, so GOAL 1..10 read in order whatever their ids", () => {
    // The live store, 2026-10-16: ids npuo, p5wm, rwmf, vuip, yg29 are GOALs
    // 5, 2, 4, 1, 3 — id order put them on the board in exactly that order.
    const goal = (id: string, n: number) => ({ ...bean(id, "milestone", "in-progress"), title: `GOAL ${n}: x` });
    const r = milestoneRollup([goal("npuo", 5), goal("p5wm", 2), goal("rwmf", 10), goal("vuip", 1), goal("yg29", 3)]);
    expect(r.milestones.map((m) => m.id)).toEqual(["vuip", "p5wm", "yg29", "npuo", "rwmf"]);
  });

  it("counts a duplicated id once and reports that it was duplicated", () => {
    // Measured on this store 2026-10-03: `folio-assistant-t3n8` is held by two
    // files. Counting over files made `openTotal - orphanOpen` disagree with
    // the sum of the bars by exactly one.
    const r = milestoneRollup([
      bean("m1", "milestone", "in-progress"),
      bean("e1", "epic", "in-progress", "m1"),
      bean("dup", "task", "todo", "e1"),
      bean("dup", "task", "todo", "e1"),
    ]);
    expect(r.duplicateIds).toBe(1);
    expect(r.milestones[0]!.total).toBe(2);
    expect(r.coveredOpen).toBe(2);
    expect(r.coveredOpen + r.orphanOpen + 1).toBe(r.openTotal);
  });

  it("returns no milestones, rather than throwing, for a store with none", () => {
    const r = milestoneRollup([bean("e1", "epic", "in-progress"), bean("t", "task", "todo", "e1")]);
    expect(r.milestones).toEqual([]);
    // BOTH are open and under no milestone — the epic counts too.
    expect(r.orphanOpen).toBe(2);
    expect(r.coveredOpen).toBe(0);
  });
});
