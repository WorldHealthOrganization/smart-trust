import { describe, expect, test } from "bun:test";

import { csRequest, fromIssue, triage } from "./cs-requests.js";

describe("csRequest: a feedback cell that asks for a change set", () => {
  test("findsSplitMergeMoveNew", () => {
    expect(csRequest("this CS needs to be split: No. 136 is a glossary change")).toMatchObject({ kind: "split", comments: ["136"] });
    expect(csRequest("Please merge CS-2 with CS-005")).toMatchObject({ kind: "merge", changeSets: ["CS-002", "CS-005"] });
    expect(csRequest("move No. 326 to CS-004")).toMatchObject({ kind: "move", changeSets: ["CS-004"], comments: ["326"] });
    expect(csRequest("No. 327 needs its own change set")).toMatchObject({ kind: "new" });
  });
  test("ordinaryFeedbackNotRequest", () => {
    expect(csRequest("agree we need to define DPI-F before. also make sure in glossary")).toBeNull();
    expect(csRequest("split the sentence in two")).toBeNull();
  });
});

describe("fromIssue: the change-set issue form", () => {
  test("readsIssueFormFields", () => {
    const body = "### What do you need?\n\nSplit a change set\n\n### Title\n\nGlossary terms\n\n### Change sets\n\nCS-001\n\n### Comments\n\nNo. 136, 327\n\n### Committee (TWG)\n\n_No response_\n\n### Details\n\nGlossary work is separate.";
    expect(fromIssue(body)).toEqual({ kind: "split", title: "Glossary terms", changeSets: ["CS-001"], comments: ["136", "327"], committee: undefined, details: "Glossary work is separate." });
  });
  test("nonFormNull", () => {
    expect(fromIssue("Just a bug report.")).toBeNull();
  });
});

describe("triage: where a new comment goes", () => {
  const open = [
    { id: "CS-001", sections: ["Executive Summary"], twgs: ["Core architects"] },
    { id: "CS-003", sections: ["4 Why", "4.2 Goals"], twgs: ["Metadata registries"] },
    { id: "CS-002", sections: ["4.1 Scope"], twgs: [], status: "Change merged" },
  ];
  test("sharedSectionFirstThenNew", () => {
    const s = triage(["4.1 Scope"], open, ["Governance"]);
    expect(s.map(x => x.cs)).toEqual(["CS-003", "new"]);
    expect(s[0].why).toMatch(/same chapter/);
    expect(s[0].twgs).toEqual(["Metadata registries"]);
    expect(s[1].twgs).toEqual(["Governance"]);
  });
  test("noOpenOnlyNew", () => {
    expect(triage(["Annex B"], open).map(x => x.cs)).toEqual(["new"]);
  });
});
