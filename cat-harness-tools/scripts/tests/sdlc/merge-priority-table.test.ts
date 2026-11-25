/**
 * `merge-priority.dmn` against the vocabulary it answers in.
 *
 * `schemas/sdlc/merge-queue.ts` has said since it was written that "a test asserts
 * the two agree". No such test existed. Measured 2026-10-04: `PRIORITY_CLASSES`
 * was referenced from nowhere but its own file, and the diagram's rule 3
 * returned a class — `ci-not-green` — that the enum did not contain, so the
 * first `placeAll` ever run against the live queue threw in `parse`.
 *
 * Both directions are asserted, because each catches a different defect and
 * neither implies the other: a class the table returns and the enum lacks
 * crashes the steward, while a class the enum lists and no rule returns is dead
 * vocabulary that a reader will take for a reachable state.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { PRIORITY_CLASSES } from "../../../schemas/sdlc/merge-queue.ts";
import { loadPriorityTable, PRIORITY_DMN } from "../../merge-queue.ts";
import { unaryTest } from "../../../src/workflow/decision-table.ts";

/** The `class` output of every rule, read from the diagram rather than restated. */
function classesInTable(): string[] {
  const xml = readFileSync(PRIORITY_DMN, "utf-8");
  const outputs = [...xml.matchAll(/<output id="[^"]*" name="([^"]*)"/g)].map((m) => m[1]);
  const at = outputs.indexOf("class");
  expect(at).toBeGreaterThanOrEqual(0);
  return [...xml.matchAll(/<rule[^>]*>([\s\S]*?)<\/rule>/g)].map((r) => {
    const entries = [...r[1].matchAll(/<outputEntry[^>]*>\s*<text>([\s\S]*?)<\/text>/g)].map((m) =>
      m[1].trim().replace(/^"|"$/g, ""),
    );
    return entries[at]!;
  });
}

describe("the merge-priority table and its vocabulary", () => {
  test("every class the table returns is in PRIORITY_CLASSES", () => {
    const vocabulary = new Set<string>(PRIORITY_CLASSES);
    const unknown = [...new Set(classesInTable())].filter((c) => !vocabulary.has(c));
    expect(unknown).toEqual([]);
  });

  test("...and every class in PRIORITY_CLASSES is returned by some rule", () => {
    // The falsification. Without it the first test passes by making the
    // vocabulary a superset of everything, which is how an unreachable state
    // gets read as a state the steward can be in.
    const returned = new Set(classesInTable());
    const dead = PRIORITY_CLASSES.filter((c) => !returned.has(c));
    expect(dead).toEqual([]);
  });

  test("every unary test in the table parses under this repo's own evaluator", () => {
    // The defect this catches is not hypothetical: the table used `not("green")`
    // from the day it was drawn and the evaluator threw `UnsupportedDmn` on it,
    // so the table was unevaluable by ANY caller — not merely uncalled.
    const xml = readFileSync(PRIORITY_DMN, "utf-8");
    const tests = [...xml.matchAll(/<inputEntry[^>]*>\s*<text>([\s\S]*?)<\/text>/g)]
      .map((m) => m[1].trim().replace(/&gt;/g, ">").replace(/&lt;/g, "<"))
      .filter((t) => t !== "" && t !== "-");
    expect(tests.length).toBeGreaterThan(0);
    for (const t of tests) {
      // The VALUE does not matter — only that the expression can be read. A
      // number test against a string is a DecisionError about the fact, not
      // about the expression, so each is tried against both kinds.
      let read = false;
      for (const v of [0, "x", true]) {
        try {
          unaryTest(t, v);
          read = true;
          break;
        } catch (e) {
          if ((e as Error).constructor.name === "DecisionError") {
            read = true;
            break;
          }
        }
      }
      expect(read, `unary test \`${t}\` cannot be read by this evaluator`).toBe(true);
    }
  });

  test("the table loads, and its hit policy is the one the ordering assumes", () => {
    // `placeAll` reads one rule's outputs, so a table that could return several
    // would make the order depend on rule order silently.
    return loadPriorityTable().then((t) => {
      expect(t.hitPolicy).toBe("FIRST");
    });
  });
});
