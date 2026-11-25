import { describe, expect, test } from "bun:test";

import { previewRequest, previewSteps, refreshMode, shouldCheck } from "./previews.js";

const pr = (o: Partial<Parameters<typeof previewSteps>[0][number]>) => ({ key: "o/r#1", state: "open" as const, base: "main", behind: 0, mergeable: "clean", fork: false, ...o });

describe("previewSteps: previews follow main", () => {
  test("behindMergedUp", () => {
    expect(previewSteps([pr({ behind: 3 })])[0]).toMatchObject({ step: "merge-main", behind: 3 });
  });
  test("conflictNamed", () => {
    expect(previewSteps([pr({ behind: 2, mergeable: "dirty" })])[0].step).toBe("resolve-conflict");
  });
  test("currentNoneClosedForkOut", () => {
    const s = previewSteps([pr({}), pr({ key: "o/r#2", state: "closed", behind: 5 }), pr({ key: "o/r#3", fork: true, behind: 5 })]);
    expect(s).toHaveLength(1);
    expect(s[0].step).toBe("none");
  });
});

describe("previewRequest: people ask for a current preview", () => {
  test("asksFound", () => {
    for (const t of ["please update the preview", "the staging is out of date", "rebase on main", "bring it up to date with main"]) expect(previewRequest(t)).toBe(true);
  });
  test("otherFeedbackNotAsk", () => {
    expect(previewRequest("update the glossary entry")).toBe(false);
    expect(previewRequest("the preview looks good")).toBe(false);
  });
});

describe("refresh mode (owner, 07:34Z: automatic as the default)", () => {
  test("automaticUnlessOnFeedback", () => {
    expect(refreshMode(undefined)).toBe("automatic");
    expect(refreshMode("")).toBe("automatic");
    expect(refreshMode("on-feedback")).toBe("on-feedback");
    expect(shouldCheck("automatic", false)).toBe(true);
    expect(shouldCheck("on-feedback", false)).toBe(false);
    expect(shouldCheck("on-feedback", true)).toBe(true);
  });
});
