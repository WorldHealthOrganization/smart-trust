/**
 * The rules that make a review auditable — each test removes one thing from an
 * otherwise-clean review and asserts the checker notices.
 *
 * Built that way on purpose: a test that constructs a broken review from
 * scratch passes whether the checker fired on the defect under test or on the
 * five other things also wrong with the fixture.
 */
import { describe, expect, test } from "bun:test";

import {
  QA_REVIEW_SCHEMA,
  QaReviewSchema,
  checkReview,
  openFindings,
  resolveCitations,
  type AuditNote,
  type Citation,
  type Decision,
  type Finding,
  type QaReview,
} from "./qa-review";

const NOW = "2026-09-18T00:00:00Z";

const cite: Citation = { kind: "file", ref: "folio/ch1/thm-foo.ts", locator: "12-14" };

function mechanicalFinding(over: Partial<Finding> = {}): Finding {
  return {
    id: "f-mech",
    subject: "thm:foo",
    criterion: "lean-ref-resolves",
    reviewer: { kind: "script", id: "scripts/qa-sweep.ts", version: "9fda9d84" },
    severity: "critical",
    detail: "`lean.ref` names `Foo.bar`, which no module declares.",
    evidence: [cite],
    raised_at: NOW,
    ...over,
  };
}

function note(over: Partial<AuditNote> = {}): AuditNote {
  return {
    id: "n-1",
    author: { kind: "human", id: "litlfred" },
    rationale: "The declaration moved in the Lean refactor; the ref is right and the checker's index is stale.",
    cites: [{ kind: "witness", ref: "test/results/lean-build.witness.json" }],
    written_at: NOW,
    ...over,
  };
}

function decision(over: Partial<Decision> = {}): Decision {
  return {
    id: "d-1",
    outcome: "approve",
    role: "author",
    by: { kind: "human", id: "litlfred" },
    considered: ["f-mech"],
    overrules: [{ finding: "f-mech", note: "n-1" }],
    notes: ["n-1"],
    decided_at: NOW,
    ...over,
  };
}

/** A review with nothing wrong with it — the baseline every test perturbs. */
function cleanReview(over: Partial<QaReview> = {}): QaReview {
  return {
    $schema: QA_REVIEW_SCHEMA,
    subject: { kind: "block", id: "thm:foo", path: "folio/ch1/thm-foo.ts" },
    findings: [mechanicalFinding()],
    notes: [note()],
    decisions: [decision()],
    updated_at: NOW,
    ...over,
  };
}

describe("the baseline", () => {
  test("a clean review has no problems", () => {
    expect(checkReview(cleanReview())).toEqual([]);
  });

  test("it parses", () => {
    expect(QaReviewSchema.safeParse(cleanReview()).success).toBe(true);
  });
});

describe("a finding carries the axis its reviewer can speak on", () => {
  test("a mechanical finding with no severity is reported", () => {
    const r = cleanReview({ findings: [mechanicalFinding({ severity: undefined })] });
    expect(checkReview(r).map((p) => p.detail).join(" ")).toContain("no severity");
  });

  test("a human finding with no weight is reported", () => {
    const human = mechanicalFinding({
      id: "f-mech",
      reviewer: { kind: "human", id: "litlfred" },
      severity: undefined,
      weight: undefined,
    });
    expect(checkReview(cleanReview({ findings: [human] })).map((p) => p.detail).join(" ")).toContain("no weight");
  });

  test("praise cannot carry a machine severity — the machine axis has no good outcome", () => {
    const praise: Finding = {
      id: "f-praise",
      subject: "thm:foo",
      reviewer: { kind: "human", id: "litlfred" },
      weight: "praise",
      severity: "minor",
      detail: "The proof's second lemma is the clearest statement of this in the folio.",
      evidence: [],
      raised_at: NOW,
    };
    const r = cleanReview({ findings: [mechanicalFinding(), praise] });
    expect(checkReview(r).map((p) => p.where)).toContain("f-praise");
  });

  test("praise needs no evidence, while every other finding does", () => {
    const praise: Finding = {
      id: "f-praise",
      subject: "thm:foo",
      reviewer: { kind: "human", id: "litlfred" },
      weight: "praise",
      detail: "Clearest statement in the folio.",
      evidence: [],
      raised_at: NOW,
    };
    expect(checkReview(cleanReview({ findings: [mechanicalFinding(), praise] }))).toEqual([]);

    const silent = mechanicalFinding({ evidence: [] });
    expect(checkReview(cleanReview({ findings: [silent] })).map((p) => p.detail).join(" ")).toContain("cites nothing");
  });
});

describe("a decision is an act about findings, not a finding", () => {
  test("a decision with no audit note is reported", () => {
    const r = cleanReview({ decisions: [decision({ notes: [] })] });
    expect(checkReview(r).map((p) => p.detail).join(" ")).toContain("records no audit note");
  });

  test("approving over an open critical finding is reported", () => {
    const r = cleanReview({ decisions: [decision({ overrules: [] })] });
    expect(checkReview(r).map((p) => p.detail).join(" ")).toContain("Approved over open finding");
  });

  test("approving over an open blocking human finding is reported", () => {
    const blocking = mechanicalFinding({
      id: "f-human",
      reviewer: { kind: "human", id: "reviewer" },
      severity: undefined,
      weight: "blocking",
    });
    const r = cleanReview({
      findings: [blocking],
      decisions: [decision({ considered: ["f-human"], overrules: [] })],
    });
    expect(checkReview(r).map((p) => p.detail).join(" ")).toContain("Approved over open finding");
  });

  test("overruling clears it, and the overruled finding stays on the record", () => {
    const r = cleanReview();
    expect(checkReview(r)).toEqual([]);
    expect(r.findings.map((f) => f.id)).toContain("f-mech");
    expect(openFindings(r)).toEqual([]);
  });

  test("an overrule naming an audit note that does not exist is reported", () => {
    const r = cleanReview({ decisions: [decision({ overrules: [{ finding: "f-mech", note: "n-missing" }] })] });
    expect(checkReview(r).map((p) => p.detail).join(" ")).toContain("n-missing");
  });

  test("overruling a finding that was never considered is reported", () => {
    const r = cleanReview({ decisions: [decision({ considered: [] })] });
    expect(checkReview(r).map((p) => p.detail).join(" ")).toContain("not listed as considered");
  });
});

describe("an audit note cites", () => {
  test("a note with no citations is reported", () => {
    const r = cleanReview({ notes: [note({ cites: [] })] });
    expect(checkReview(r).map((p) => p.detail).join(" ")).toContain("cites nothing");
  });

  test("an agent may propose the citations without becoming the author", () => {
    const proposed = note({ proposed_by: "authoring-agent" });
    expect(proposed.author.kind).toBe("human");
    expect(checkReview(cleanReview({ notes: [proposed] }))).toEqual([]);
  });
});

describe("citation resolution has three states", () => {
  test("with no resolver nothing is resolved", () => {
    expect(resolveCitations([cite]).map((c) => c.state)).toEqual(["not-checked"]);
  });

  test("a resolver that cannot answer yields not-checked, never resolved", () => {
    expect(resolveCitations([cite], () => undefined).map((c) => c.state)).toEqual(["not-checked"]);
  });

  test("a resolver that answers yields resolved or dangling", () => {
    expect(resolveCitations([cite], () => true).map((c) => c.state)).toEqual(["resolved"]);
    expect(resolveCitations([cite], () => false).map((c) => c.state)).toEqual(["dangling"]);
  });
});

describe("openFindings", () => {
  test("praise is never open", () => {
    const praise: Finding = {
      id: "f-praise",
      subject: "thm:foo",
      reviewer: { kind: "human", id: "litlfred" },
      weight: "praise",
      detail: "Clearest statement in the folio.",
      evidence: [],
      raised_at: NOW,
    };
    expect(openFindings(cleanReview({ findings: [mechanicalFinding(), praise] }))).toEqual([]);
  });

  test("a finding nobody decided about stays open", () => {
    const r = cleanReview({ decisions: [] });
    expect(openFindings(r).map((f) => f.id)).toEqual(["f-mech"]);
  });
});
