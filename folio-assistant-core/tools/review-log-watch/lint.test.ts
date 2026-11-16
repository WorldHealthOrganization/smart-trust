import { describe, expect, test } from "bun:test";

import { feedbackProblems, lint, prStateProblems, sectionProblems } from "./lint.js";

const good = [
  "⏳ Needs you: answer the Decision needed below, then set Ready for agent to Yes.",
  "Decision needed: should Annex 1 say CDE-HRH \"takes inspiration from\" the 2015 data set?",
  "  A. Yes, as the editor asked (recommended)",
  "  B. No, keep \"builds on\"",
  "Answer in your feedback column, then an Editor sets Ready for agent to Yes.",
  "",
  "Proposal: dth-hrh#61 rewords Annex 1, Points for discussion and 11.1.",
].join("\n");

describe("feedbackProblems (Q-FBK-1 A)", () => {
  test("layoutPasses", () => {
    expect(feedbackProblems(good, "Needs human")).toEqual([]);
  });
  test("needsHumanWithoutQuestion", () => {
    const p = feedbackProblems("⏳ Needs you: answer the Decision needed below.\nDraft PR dth-hrh#81: 6 BPMN processes.", "Needs human");
    expect(p.join(" ")).toMatch(/no "Decision needed:" question/);
  });
  test("buriedAskFlagged", () => {
    const p = feedbackProblems("Step 2 (direction decided): split.\nDecision needed: which?\n  A. One\n  B. Two\nAnswer in your feedback column.", "Needs human");
    expect(p.join(" ")).toMatch(/must be the first thing/);
    expect(p.join(" ")).toMatch(/"\(recommended\)"/);
    expect(p.join(" ")).toMatch(/History lines/);
  });
  test("historyBelongsInDisposition", () => {
    expect(feedbackProblems("Decided (Q-L2P-1, 2026-11-01): A, by the owner.", "").join(" ")).toMatch(/Disposition \(agent\)/);
  });
});

describe("prStateProblems", () => {
  const url = "https://github.com/litlfred/dth-hrh/pull/61";
  test("mergedPrRecordedOpen", () => {
    expect(prStateProblems("PR open", [url], { "litlfred/dth-hrh#61": { state: "closed", merged: true } })[0]).toMatch(/merged on GitHub/);
  });
  test("explainedStatusLeft", () => {
    expect(prStateProblems("Reverted in #74", [url], { "litlfred/dth-hrh#61": { state: "closed", merged: true } })).toEqual([]);
  });
});

describe("lint", () => {
  test("lintJoinsTabs", () => {
    const fb = [["Change-set", "Title", "Feedback (agent)"], ["CS-001", "Annex 1", "Proposal only."]];
    const ag = [["Change-set", "Issue", "Agentic status", "Pull request (change set)"], ["CS-001", "", "PR open", "https://github.com/litlfred/dth-hrh/pull/61"]];
    const out = lint(fb, ag, { "litlfred/dth-hrh#61": { state: "closed", merged: true } });
    expect(out).toHaveLength(1);
    expect(out[0].cs).toBe("CS-001");
  });
});

describe("sectionProblems (Q-FBK-3 A)", () => {
  const url = "https://github.com/litlfred/dth-hrh/pull/82";
  const st = (files: string[]) => ({ "litlfred/dth-hrh#82": { state: "open" as const, merged: false, files } });
  test("noSectionMustAsk", () => {
    expect(sectionProblems("", "Proposed direction: link personas.", [], {})[0]).toMatch(/No Selected Sections/);
    expect(sectionProblems("", "Decision needed: which sections should this cover?\n  A. Ch 5 (recommended)\n  B. Ch 6", [], {})).toEqual([]);
  });
  test("prOutsideChaptersFlagged", () => {
    expect(sectionProblems("5.1 Personas", "Proposed direction: x", [url], st(["content/ch5/a.md", "content/ch6/b.md"]))[0]).toMatch(/chapter 6/);
    expect(sectionProblems("5.1 Personas", "Proposed direction: x\nOutside the selected sections: 6.2, two new personas.", [url], st(["content/ch6/b.md"]))).toEqual([]);
    expect(sectionProblems("Ch 5 Personas, 6.2 Governance", "Proposed direction: x", [url], st(["content/ch6/b.md"]))).toEqual([]);
  });
});
