import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { feedbackBasis, feedbackRow, parseFeedbackIssue, PC_BASIS_GREY } from "./feedback-issue.js";

const anchors = {
  chapters: [{ dir: "ch01-why", title: "Chapter 1. Why it matters", number: 1 }],
  sections: [
    { label: "sec:ch01-lead", title: "Objectives and key messages", chapter: "ch01-why" },
    { label: "sec:1-1", number: "1.1", title: "1.1 Global challenges", chapter: "ch01-why" },
  ],
  blocks: [{ label: "prose:ch01-global-challenges", sections: ["sec:1-1"] }],
};

const formBody = [
  "### Content", "", "dth-hrh", "", "### Section", "", "1.1 Global challenges", "",
  "### Block", "", "prose:ch01-global-challenges", "", "### On the site", "", "https://x/#prose%3Ach01", "",
  "### Source", "", "_No response_", "", "### Type", "", "Technical", "",
  "### Comment", "", "Add shortage numbers. They matter.", "", "### Proposed change", "", "_No response_",
].join("\n");

// The plain body the site's link writes when the folio has no form.
const plainBody = [
  "**Content:** `dth-hrh`", "**Block:** `prose:ch01-global-challenges`", "**Section:** 1.1 Global challenges",
  "**Source:** https://github.com/o/r/blob/main/x.md", "**On the site:** https://x/#p", "",
  "**Type:** general | technical | editorial", "", "**Comment:**", "Too vague.", "", "**Proposed change:**", "Say 10 million.", "",
].join("\n");

describe("feedback issues become Contributor Feedback rows", () => {
  test("issueFormParsed", () => {
    expect(parseFeedbackIssue(formBody)).toEqual({
      content: "dth-hrh", section: "1.1 Global challenges", block: "prose:ch01-global-challenges",
      url: "https://x/#prose%3Ach01", type: "Technical", comment: "Add shortage numbers. They matter.",
    });
  });

  test("plainBodyParsed", () => {
    const f = parseFeedbackIssue(plainBody);
    expect(f.block).toBe("prose:ch01-global-challenges");
    expect(f.type).toBeUndefined();
    expect(f.comment).toBe("Too vague.");
    expect(f.proposed).toBe("Say 10 million.");
  });

  test("feedbackRowMade", () => {
    expect(feedbackRow({ body: formBody, url: "https://github.com/o/r/issues/7", login: "ana" }, anchors)).toEqual({
      title: "1.1 Global challenges: Add shortage numbers.",
      sections: "\u2800\u2800\u28001.1 Global challenges",
      feedback: "@ana (Technical): Add shortage numbers. They matter.",
      issue: "https://github.com/o/r/issues/7",
    });
    expect(feedbackRow({ body: plainBody, url: "u", login: "bo" }, anchors).feedback).toBe("@bo: Too vague.\nProposed: Say 10 million.");
  });

  test("sharedFormIds", () => {
    const yml = readFileSync(join(import.meta.dir, "../../templates/issue-forms/block-feedback.yml"), "utf8");
    const ids = [...yml.matchAll(/^\s+id:\s*(\S+)\s*$/gm)].map((m) => m[1]);
    expect(ids).toEqual(["content", "section", "block", "url", "source", "type", "comment", "proposed"]);
  });
});

describe("feedbackBasis", () => {
  const header = ["Change-set", "Title", "Selected Sections", "Contributor Feedback (CL)", "Ready for merge", "Contributor Feedback (agent)", "Issue"];
  const row = ["CS-001", "Define registry", "\u2800\u2800\u28001.1 Global challenges", "CL: needs a definition", "No", "Try X", "dth#1"];
  const b = feedbackBasis(header, row);
  test("basisChangesWithPersonCell", () => {
    expect(feedbackBasis(header, row.map((v, i) => (i === 3 ? v + " more" : v)))).not.toBe(b);
    expect(feedbackBasis(header, row.map((v, i) => (i === 1 ? "Other" : v)))).not.toBe(b);
  });
  test("basisIgnoresAgentColumns", () => {
    expect(feedbackBasis(header, row.map((v, i) => (i === 5 ? "Try Y" : i === 6 ? "dth#2" : i === 4 ? "Yes" : v)))).toBe(b);
    expect(feedbackBasis(header, row.map((v, i) => (i === 2 ? "1.1 Global challenges" : v)))).toBe(b);
  });
});

describe('feedbackBasis with grey content (a "2:" basis)', () => {
  const header = ["Change-set", "Title", "Suggested Revisions", "TWG (PCs)", "TWG (CS)", "Architect Feedback (AB)", "Architect Feedback (agent)", "Agentic status"];
  const row = ["CS-001", "Fix scope", "No. 1 \u00b7 Lengthen it", "Editorial", "", "", "Accept", "Not started"];
  const exact = ["Title", "TWG (CS)"];
  const b1 = feedbackBasis(header, row, exact, "Architect Feedback");
  const b2 = feedbackBasis(header, row, exact, "Architect Feedback", PC_BASIS_GREY);
  test("greyBasisMarked", () => {
    expect(b2).toMatch(/^2:[0-9a-z]+$/);
    expect(b1).not.toMatch(/:/);
  });
  test("greyBasisChangesWithGrey", () => {
    const moved = row.map((v, i) => (i === 2 ? v + ", and add an example" : v));
    expect(feedbackBasis(header, moved, exact, "Architect Feedback", PC_BASIS_GREY)).not.toBe(b2);
    expect(feedbackBasis(header, moved, exact, "Architect Feedback")).toBe(b1);
  });
  test("greyBasisIgnoresAgent", () => {
    const own = row.map((v, i) => (i === 6 ? "Reject" : i === 7 ? "PR open" : v));
    expect(feedbackBasis(header, own, exact, "Architect Feedback", PC_BASIS_GREY)).toBe(b2);
  });
});
