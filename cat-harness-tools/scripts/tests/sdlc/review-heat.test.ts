/** The review heat map's numbers (bean qbfi). */
import { describe, expect, test } from "bun:test";

import { computeHeat, heatBucket, renderHeat } from "../../review-heat.js";

const change = (label: string, section: string) => ({ label, head: { section } });
const comment = (targetLabel: string, status: string, kind: string, blockHash: string | null, orphaned = false) => ({
  targetLabel, status, review: { kind, blockHash, orphaned },
});

describe("computeHeat", () => {
  const changes = [change("a", "doc::sec:one"), change("b", "doc::sec:one"), change("c", "doc::sec:two")];
  const blocks = {
    a: { hash: "a2", section: "doc::sec:one" },
    b: { hash: "b1", section: "doc::sec:one" },
    c: { hash: "c1", section: "doc::sec:two" },
    u: { hash: "u1", section: "doc::sec:three" },
  };

  test("counts changes, open comments, defects and stale comments per section, in reading order", () => {
    const h = computeHeat({
      changes,
      blocks,
      comments: [
        comment("a", "open", "defect", "a1"), // block changed since: stale
        comment("b", "addressed", "question", "b1"),
        comment("b", "resolved", "defect", "b1"), // closed: not counted
        comment("u", "open", "editorial", "u1"), // unchanged block, own section
      ],
    });
    expect(h.rows).toEqual([
      { section: "doc::sec:one", changed: 2, open: 2, defects: 1, stale: 1, qaFailing: 0, qaWorst: null, qaStale: 0, qaUnaudited: 0, qaScriptsOnly: 0, qaNeedsAgent: 0, qaJudgedUnknown: 0, qaBlocks: 0, needReview: 0, reviewed: 0 },
      { section: "doc::sec:two", changed: 1, open: 0, defects: 0, stale: 0, qaFailing: 0, qaWorst: null, qaStale: 0, qaUnaudited: 0, qaScriptsOnly: 0, qaNeedsAgent: 0, qaJudgedUnknown: 0, qaBlocks: 0, needReview: 0, reviewed: 0 },
      { section: "doc::sec:three", changed: 0, open: 1, defects: 0, stale: 0, qaFailing: 0, qaWorst: null, qaStale: 0, qaUnaudited: 0, qaScriptsOnly: 0, qaNeedsAgent: 0, qaJudgedUnknown: 0, qaBlocks: 0, needReview: 0, reviewed: 0 },
    ]);
  });

  test("an orphaned open comment is still counted, under no section, last", () => {
    const h = computeHeat({ changes, blocks, comments: [comment("gone", "open", "question", "g1", true)] });
    expect(h.rows.at(-1)).toEqual({ section: "(listed in no section)", changed: 0, open: 1, defects: 0, stale: 0, qaFailing: 0, qaWorst: null, qaStale: 0, qaUnaudited: 0, qaScriptsOnly: 0, qaNeedsAgent: 0, qaJudgedUnknown: 0, qaBlocks: 0, needReview: 0, reviewed: 0 });
  });

  test("QA: a failing or stale block is counted in its section; a clean unchanged section gets no row", () => {
    const h = computeHeat({
      changes,
      blocks,
      comments: [],
      qa: {
        a: { state: "failing", worst: "major" },
        b: { state: "failing", worst: "critical" },
        c: { state: "passing", worst: null },
        u: { state: "passing", worst: null },
      },
    });
    expect(h.hasQa).toBe(true);
    expect(h.rows.map((r) => r.section)).toEqual(["doc::sec:one", "doc::sec:two"]);
    expect(h.rows[0]).toMatchObject({ qaFailing: 2, qaWorst: "critical", qaBlocks: 2, needReview: 0, reviewed: 0 });
    expect(h.rows[1]).toMatchObject({ qaFailing: 0, qaBlocks: 1, needReview: 0, reviewed: 0 });
  });

  test("QA: a stale verdict in an unchanged section IS a place to look, and is not a pass", () => {
    const h = computeHeat({ changes, blocks, comments: [], qa: { u: { state: "stale", worst: null } } });
    expect(h.rows.at(-1)).toMatchObject({ section: "doc::sec:three", qaStale: 1, qaFailing: 0 });
  });

  test("QA: a passing block with agent-judged criteria never run passes on SCRIPTS ONLY, and says how many (9791)", () => {
    const h = computeHeat({
      changes,
      blocks,
      comments: [],
      qa: { a: { state: "passing", worst: null, needsAgent: 15 }, b: { state: "passing", worst: null, needsAgent: 0 }, c: { state: "passing", worst: null } },
    });
    expect(h.rows[0]).toMatchObject({ qaBlocks: 2, qaScriptsOnly: 1, qaNeedsAgent: 15, qaJudgedUnknown: 0 });
    // A file from before 9791 has no field: "could not tell", never "all judged".
    expect(h.rows[1]).toMatchObject({ qaBlocks: 1, qaScriptsOnly: 0, qaJudgedUnknown: 1 });
  });

  test("QA wording: scripts-only and fully judged are different words (9791)", () => {
    const src = renderHeat.toString();
    expect(src).toContain("passing on scripts only (");
    expect(src).toContain("passing, every applicable criterion judged");
  });

  test("QA without blocks.json cannot be placed, so it is not published rather than guessed", () => {
    expect(computeHeat({ changes, blocks: null, comments: [], qa: { a: { state: "failing", worst: "major" } } }).hasQa).toBe(false);
  });

  test("coverage: a changed block counts as reviewed only on a verdict for its CURRENT hash (px0t)", () => {
    const cs = [
      { label: "a", change: "changed", head: { section: "doc::sec:one" } },
      { label: "b", change: "added", head: { section: "doc::sec:one" } },
      { label: "gone", change: "removed", base: { section: "doc::sec:one" } },
    ];
    const verdicts = [
      { targetLabel: "a", blockHash: "a1" }, // an older version: does not count
      { targetLabel: "b", blockHash: "b1" },
    ];
    const h = computeHeat({ changes: cs, blocks, comments: [], verdicts });
    expect(h.hasVerdicts).toBe(true);
    expect(h.rows[0]).toMatchObject({ changed: 3, needReview: 2, reviewed: 1 });
  });

  test("coverage without verdicts, or without blocks.json, is not measured rather than zero", () => {
    expect(computeHeat({ changes, blocks, comments: [] }).hasVerdicts).toBe(false);
    expect(computeHeat({ changes, blocks: null, comments: [], verdicts: [] }).hasVerdicts).toBe(false);
  });

  test("no comment file and no blocks file are SAID, not zeroed", () => {
    const h = computeHeat({ changes, blocks: null, comments: null });
    expect(h.hasComments).toBe(false);
    expect(h.hasBlocks).toBe(false);
  });

  test("is self-contained, so the page can embed exactly this function", () => {
    // input-site: inert #5a952969 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    const embedded = new Function(`return (${computeHeat.toString()})`)() as typeof computeHeat;
    expect(embedded({ changes, blocks, comments: [] })).toEqual(computeHeat({ changes, blocks, comments: [] }));
  });
});

describe("heatBucket", () => {
  test("zero is no fill; the rest are tertiles of the column's maximum", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((v) => heatBucket(v, 6))).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect(heatBucket(3, 0)).toBe(0);
  });
});
