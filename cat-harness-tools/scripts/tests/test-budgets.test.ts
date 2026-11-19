/**
 * `check:test-budgets` — the declared/default split, and the two ways it refuses.
 *
 * Bean `sff8`. The load-bearing behaviour is not the arithmetic, it is that a test
 * which DECLARES a budget is never given a share: assuming bun's 5000 ms default
 * everywhere is what makes the measurement worthless, because 24–30 tests here
 * declare their own and several run correctly past 5 s.
 *
 * @module scripts/tests/test-budgets.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  BANDS,
  DEFAULT_BUDGET_MS,
  budgets,
  declaredBudgetRanges,
  testcases,
} from "../check-test-budgets.ts";

const xml = (cases: string): string =>
  `<?xml version="1.0"?><testsuites name="bun test" time="12.5">${cases}</testsuites>`;
const tc = (file: string, line: number, secs: number, name = "t"): string =>
  `<testcase name="${name}" time="${secs}" file="${file}" line="${line}" />`;

describe("reading a junit document", () => {
  test("a case's file, line and cost are read", () => {
    const got = testcases(xml(tc("a.test.ts", 7, 1.5, "n")));
    expect(got).toEqual([{ file: "a.test.ts", line: 7, name: "n", costMs: 1500 }]);
  });

  test("a case with no `file` is skipped rather than guessed at", () => {
    // Without a file there is no source to ask about the budget, so counting it
    // as a default-budget case would invent a share.
    expect(testcases(xml('<testcase name="x" time="9" />'))).toEqual([]);
  });

  test("a non-numeric time is skipped, not read as zero", () => {
    // Zero would make an unreadable case look like the fastest in the corpus.
    expect(testcases(xml('<testcase name="x" time="NaN" file="a.ts" line="1" />'))).toEqual([]);
  });

  test("the suite's own wall clock is picked up, so a reader can see the load", () => {
    expect(budgets(xml(tc("a.test.ts", 1, 1)), "/nonexistent").suiteSeconds).toBe(12.5);
  });
});

describe("a declared budget is found in the AST, not evaluated", () => {
  test("a third argument means declared — even as an expression", () => {
    // `declared-directory-resolves.test.ts` passes `modules.length * 600`, so the
    // VALUE is not statically knowable and does not need to be. Presence is the
    // whole question.
    const src = `test("a", () => {}, modules.length * 600);`;
    expect(declaredBudgetRanges(src, "f.ts")).toEqual([[1, 1]]);
  });

  test("two arguments means it inherits the default", () => {
    expect(declaredBudgetRanges(`test("a", () => {});`, "f.ts")).toEqual([]);
  });

  test("a MULTI-LINE call reports its whole range", () => {
    // The reason ranges exist rather than single lines: the runner attributes a
    // case to the line of the call or of its name, and for a `test(` spanning
    // thirty lines those differ. Matching an exact line would have misclassified
    // the one test this tool most needs to get right.
    const src = ['test(', '  "a",', '  () => {},', '  99,', ');'].join("\n");
    expect(declaredBudgetRanges(src, "f.ts")).toEqual([[1, 5]]);
  });

  test("`it` counts, and so does a modifier form", () => {
    expect(declaredBudgetRanges(`it("a", () => {}, 1);`, "f.ts")).toEqual([[1, 1]]);
    expect(declaredBudgetRanges(`test.only("a", () => {}, 1);`, "f.ts")).toEqual([[1, 1]]);
  });

  test("a THREE-argument call that is not a test does not count", () => {
    expect(declaredBudgetRanges(`request("a", () => {}, 1);`, "f.ts")).toEqual([]);
  });

  test("`describe` with three arguments is not a test budget", () => {
    expect(declaredBudgetRanges(`describe("a", () => {}, 1);`, "f.ts")).toEqual([]);
  });
});

describe("the report separates declared from default", () => {
  test("an unreadable source is reported, and its cases get NO share", () => {
    // The failure this refuses: treating "I could not read the budget" as "there
    // is no budget" invents a share for a test that may legitimately run for a
    // minute. An unknown budget is not a default one.
    const r = budgets(xml(tc("does/not/exist.test.ts", 3, 9)), "/nonexistent");
    expect(r.cases).toBe(1);
    expect(r.declared).toBe(1);
    expect(r.unreadable).toEqual(["does/not/exist.test.ts"]);
    expect(r.worst).toEqual([]);
  });

  test("bands count default-budget cases at or above each share", () => {
    const r = budgets(xml(tc("does/not/exist.test.ts", 1, 9)), "/nonexistent");
    // Every band is zero because the only case is unreadable-hence-declared —
    // which is the point: the bands describe the DEFAULT population only.
    expect(r.bands.map((b) => b.count)).toEqual(BANDS.map(() => 0));
  });

  test("zero cases yields zero, which `main` treats as exit 2", () => {
    // A sweep over no subjects asserts nothing (bean `6tkl`); the entry point
    // refuses rather than printing a clean report over an empty set.
    expect(budgets(xml(""), "/nonexistent").cases).toBe(0);
  });

  test("the default budget is bun's, stated once", () => {
    expect(DEFAULT_BUDGET_MS).toBe(5000);
  });
});

describe("against this repository's own sources", () => {
  // The corpus half: a real file, so the AST walk is exercised against real
  // syntax rather than one-line fixtures.
  const REPO = new URL("../../..", import.meta.url).pathname;

  test("`declared-directory-resolves` is seen to declare a budget", () => {
    // It is the clearest correct over-budget test in the repo (22 s, derived from
    // its module count). If this tool called it a default-budget case it would
    // report the repository's best-behaved slow test as its worst offender.
    const ranges = declaredBudgetRanges(
      readFileSync(
        `${REPO}cat-harness-tools/scripts/tests/kg/declared-directory-resolves.test.ts`,
        "utf-8",
      ),
      "declared-directory-resolves.test.ts",
    );
    expect(ranges.length).toBeGreaterThan(0);
  });
});
