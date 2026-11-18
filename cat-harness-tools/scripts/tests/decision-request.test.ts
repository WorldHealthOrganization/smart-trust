/**
 * The decision schema, tested on each way the rule was actually broken.
 *
 * Every case below is a clause of `interaction-modality` §4.1 or
 * `decision-comparison`, and the first four are the four this agent broke on
 * 2026-09-20 asking the owner about `wqht`, `vlhk`, `cvab` and `bbbl`. A schema
 * whose refusals are not tested is a schema that quietly stops refusing.
 *
 * @module folio-assistant/scripts/tests/decision-request
 */

import { describe, expect, test } from "bun:test";

import {
  DecisionRequestSchema,
  renderDecision,
  type DecisionRequest,
} from "../../schemas/process/decision-request.ts";

const opt = (label: string) => ({
  label,
  does: `does ${label}`,
  pro: `pro ${label}`,
  con: `con ${label}`,
  downstream: `downstream ${label}`,
  reversibility: `reversibility ${label}`,
});

const good: DecisionRequest = {
  decides: "Whether the sweep reports quiet claims, which changes what a reviewer sees at session start.",
  glossary: { quiet: "in-progress with no PR, no branch and no note since" },
  options: [opt("Report them"), opt("Leave it")],
  recommends: "Report them",
  because: "the denominator is what makes the count answerable",
  ifSilent: "I will report them and say so in the turn report",
  question: "Report quiet claims?",
  othersPending: 0,
};

describe("a complete decision parses", () => {
  test("the whole shape", () => {
    expect(DecisionRequestSchema.safeParse(good).success).toBe(true);
  });
});

describe("each omission is REFUSED, not tolerated", () => {
  test.each([
    ["decides", "what will differ"],
    ["glossary", "every identifier expanded"],
    ["recommends", "the recommended option, marked"],
    ["because", "why that one"],
    ["ifSilent", "what happens if they say nothing"],
    ["question", "the question itself"],
    ["othersPending", "the count of other decisions"],
  ])("no `%s` — %s", (field) => {
    const bad = { ...good } as Record<string, unknown>;
    delete bad[field];
    expect(DecisionRequestSchema.safeParse(bad).success).toBe(false);
  });

  test.each(["does", "pro", "con", "downstream", "reversibility"])(
    "an option with no `%s` — the comparison is unomittable, not merely required",
    (col) => {
      const o = { ...opt("A") } as Record<string, unknown>;
      delete o[col];
      expect(DecisionRequestSchema.safeParse({ ...good, options: [o, opt("B")], recommends: "A" }).success).toBe(false);
    },
  );
});

describe("the bounds interaction-modality §4.2 states", () => {
  test("one option is not a choice", () => {
    expect(DecisionRequestSchema.safeParse({ ...good, options: [opt("A")], recommends: "A" }).success).toBe(false);
  });

  test("five options is a question that should be split", () => {
    const five = ["A", "B", "C", "D", "E"].map(opt);
    expect(DecisionRequestSchema.safeParse({ ...good, options: five, recommends: "A" }).success).toBe(false);
  });

  test("a recommendation naming no option is refused", () => {
    expect(DecisionRequestSchema.safeParse({ ...good, recommends: "Neither" }).success).toBe(false);
  });

  test("two options sharing a label are refused — the reader cannot tell them apart", () => {
    const dup = { ...good, options: [opt("A"), opt("A")], recommends: "A" };
    expect(DecisionRequestSchema.safeParse(dup).success).toBe(false);
  });

  test("an unknown field is refused rather than dropped", () => {
    expect(DecisionRequestSchema.safeParse({ ...good, urgency: "high" }).success).toBe(false);
  });
});

describe("the render puts the comparison BEFORE the question", () => {
  const md = renderDecision(good);

  test("the recommended option comes first and is marked", () => {
    const header = md.split("\n").find((l) => l.startsWith("| |"))!;
    expect(header.indexOf("Report them")).toBeLessThan(header.indexOf("Leave it"));
    expect(header).toContain("*(recommended)*");
  });

  test("all five comparison rows are present", () => {
    for (const row of ["What it does", "Pro", "Con", "Downstream", "Reversibility"]) {
      expect(md).toContain(`| **${row}** |`);
    }
  });

  test("the question is LAST", () => {
    expect(md.trimEnd().endsWith(good.question)).toBe(true);
  });

  test("the table precedes the question — the whole point", () => {
    expect(md.indexOf("| **Con** |")).toBeLessThan(md.indexOf(good.question));
  });

  test("the silence default is stated", () => {
    expect(md).toContain("**If you say nothing:**");
  });

  test("other pending decisions are a COUNT, never a list of names", () => {
    const withOthers = renderDecision({ ...good, othersPending: 2 });
    expect(withOthers).toContain("2 other decisions are waiting");
  });

  test("the glossary is rendered before the table", () => {
    expect(md.indexOf("**quiet**")).toBeLessThan(md.indexOf("| |"));
  });
});
