/**
 * A QA verdict's date is DERIVED from the tree it reviewed (owner ruling
 * 2026-11-06, card "QA dates", option 1): `entryDate` reads the tree's commit
 * date from the `tree-commits` index and falls back to a legacy entry's own
 * `reviewed_at`; `newestFirst` orders by it, and on a tie or no date keeps
 * position, because `list[0]` is a criterion's effective verdict.
 */
import { describe, expect, test } from "bun:test";

import { entryDate, newestFirst } from "../../pipeline/qa-utils.ts";

const T = (c: string) => c.repeat(40);

describe("entryDate", () => {
  test("the tree's commit date wins over the entry's own", () => {
    expect(entryDate({ reviewed_tree: T("a"), reviewed_at: "2020-01-01T00:00:00Z" }, { [T("a")]: "2026-11-06T04:00:00Z" })).toBe("2026-11-06T04:00:00Z");
  });
  test("a legacy entry keeps its own date; with neither there is none, never now", () => {
    expect(entryDate({ reviewed_at: "2026-06-12T00:00:00Z" })).toBe("2026-06-12T00:00:00Z");
    expect(entryDate({ reviewed_tree: T("b") }, {})).toBeUndefined();
  });
});

describe("newestFirst", () => {
  test("orders by the derived date, and by position (list[0] leads) otherwise", () => {
    const old = { id: "old", reviewed_tree: T("a") };
    const fresh = { id: "fresh", reviewed_tree: T("b") };
    const undated1 = { id: "u1", reviewed_tree: T("c") };
    const undated2 = { id: "u2", reviewed_tree: T("d") };
    const dates = { [T("a")]: "2026-11-01T00:00:00Z", [T("b")]: "2026-11-05T00:00:00Z" };
    expect(newestFirst([old, fresh, undated1, undated2], dates).map((e) => e.id)).toEqual(["fresh", "old", "u1", "u2"]);
  });
});
