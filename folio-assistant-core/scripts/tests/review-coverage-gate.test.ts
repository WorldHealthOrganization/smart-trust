/**
 * `review-coverage-gate.dmn`, evaluated by the engine `workflow_complete`
 * uses, over facts shaped exactly as `review-coverage` emits them (bean `bnjs`).
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { evaluate, loadDecisionTable, unreadableExpressions } from "@litlfred/cat-harness-tools/src/workflow/decision-table.js";

const table = await loadDecisionTable(join(import.meta.dir, "../../collab/processes/content/decisions/review-coverage-gate.dmn"), "Decision_ReviewCoverageGate");
const clean = { uncoveredBlocks: 0, openDefects: 0, rendered: "known", unreviewedPages: 0, undeterminedInputs: 0, measured: "known", missedPages: 0 };
const decide = (f: Partial<typeof clean>) => evaluate(table, { ...clean, ...f });

describe("review-coverage-gate.dmn", () => {
  it("everyExpressionReadable", () => {
    expect(unreadableExpressions(table)).toEqual([]);
  });

  it("coveredWhenNothingOwed", () => {
    expect(decide({}).outcome).toBe("yes");
  });

  it("eachCountKeepsOpen", () => {
    expect(decide({ uncoveredBlocks: 1 }).rule).toBe("Rule_Uncovered");
    expect(decide({ openDefects: 1 }).rule).toBe("Rule_OpenDefect");
    expect(decide({ unreviewedPages: 2 }).rule).toBe("Rule_UnreviewedPage");
    expect(decide({ undeterminedInputs: 1 }).rule).toBe("Rule_Undetermined");
    expect(decide({ missedPages: 1 }).rule).toBe("Rule_Missed");
    for (const f of [{ unreviewedPages: 2 }, { undeterminedInputs: 1 }, { missedPages: 1 }]) expect(decide(f).outcome).toBe("no");
  });

  it("uncomputedPageCountNotRead", () => {
    expect(decide({ rendered: "absent", unreviewedPages: 0, undeterminedInputs: 0 }).outcome).toBe("yes");
    expect(decide({ measured: "not-base", missedPages: 3 }).outcome).toBe("yes");
    expect(decide({ measured: "absent", missedPages: 0 }).outcome).toBe("yes");
  });

  it("refusesMissingFact", () => {
    expect(() => evaluate(table, { uncoveredBlocks: 0, openDefects: 0 })).toThrow();
  });
});
