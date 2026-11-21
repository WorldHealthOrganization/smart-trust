import { describe, expect, test } from "bun:test";
import { CHANGE_REVIEW_PROCESS, MAKE_PHASE, changeSetCover, madeInProcess, nearMiss } from "./change-set-coverage.js";
import type { InstanceState } from "./instance.js";

const inst = (over: Partial<InstanceState> = {}): InstanceState => ({
  id: "contentchangereview--cs-014",
  processId: CHANGE_REVIEW_PROCESS,
  source: "processes/content/content-change-review.bpmn",
  subject: "CS-014",
  tokens: ["Call_StageChange"],
  arrivals: {},
  history: [
    { at: "t0", node: "Start_Author" },
    { at: "t1", node: MAKE_PHASE },
  ],
  status: "running",
  startedAt: "t0",
  updatedAt: "t1",
  scope: { changeSet: "CS-014", blocks: ["prose:ch11-objectives", "tbl:handbook-at-a-glance"] },
  ...over,
});

describe("change-set cover", () => {
  test("a running change set that made the change covers the blocks it lists", () => {
    expect(changeSetCover([inst()], "prose:ch11-objectives")).toEqual({
      instance: "contentchangereview--cs-014",
      changeSet: "CS-014",
    });
  });

  test("a block the change set does not list is not covered", () => {
    expect(changeSetCover([inst()], "prose:annex-1")).toBeUndefined();
    expect(nearMiss([inst()], "prose:annex-1")).toContain("do not list prose:annex-1");
  });

  test("a completed change set authorises nothing new", () => {
    const done = inst({ status: "completed" });
    expect(changeSetCover([done], "prose:ch11-objectives")).toBeUndefined();
    expect(nearMiss([done], "prose:ch11-objectives")).toContain("already completed");
  });

  test("the make phase must be finished", () => {
    const early = inst({ history: [{ at: "t0", node: "Start_Author" }], tokens: [MAKE_PHASE] });
    expect(madeInProcess(early)).toBe(false);
    expect(changeSetCover([early], "prose:ch11-objectives")).toBeUndefined();
    expect(nearMiss([early], "prose:ch11-objectives")).toContain(MAKE_PHASE);
  });

  test("a completed make child counts as the make phase", () => {
    const child = inst({ history: [], children: { [MAKE_PHASE]: inst({ status: "completed", scope: undefined }) } });
    expect(madeInProcess(child)).toBe(true);
  });

  test("another process never covers, and no change set means no near miss", () => {
    const other = inst({ processId: "Process_Editing" });
    expect(changeSetCover([other], "prose:ch11-objectives")).toBeUndefined();
    expect(nearMiss([other], "prose:ch11-objectives")).toBeUndefined();
  });
});
