/**
 * A gate red for a NEW reason must not look like one red for the old reason.
 *
 * @module scripts/tests/gates-failure-summary
 *
 * Bean `ucb9`, and the cost was paid before it was filed. On 2026-09-20
 * `bun test` was red for one reason (a stale `__pycache__`, bean `koth`); six
 * new BPMN diagrams added a second (`no activity is silently skill-less`, 17
 * activities). `bun run cat gates` printed:
 *
 *     ✗ 2 of 55 failed:
 *       · bun test   (typescript / bun test)
 *
 * byte-identical before and after the second failure existed. It was read as
 * the known one and pushed. CI caught it.
 *
 * ## The bean's own diagnosis was wrong, and that is worth recording
 *
 * It said the summary "discards" the output. It does not — `gates.ts` ran
 * each gate with `stdio: "inherit"`, so everything WAS printed and simply
 * scrolled past. Nothing was captured, so the summary had nothing to quote.
 * The fix is a tee rather than "stop swallowing stdout", and the difference
 * matters: capturing with `spawnSync` and printing afterwards would also have
 * worked and would have traded a minute of live `bun test` output for the
 * recap, which is a regression, not a fix.
 */
import { describe, expect, test } from "bun:test";

import { salientFailures } from "../../gates.js";

describe("the lines a failed gate gets quoted back", () => {
  test("TWO failing tests are both named — the whole point", () => {
    // Exactly the situation that reached CI: one failure a contributor is
    // already living with, and one that arrived later.
    const out = [
      "bun test v1.3.11",
      "(fail) this repository, as it stands > the root is clean, and stays that way [9.33ms]",
      "(fail) every activity names a skill > no activity is silently skill-less [272.99ms]",
      " 3768 pass",
      " 2 fail",
    ].join("\n");
    expect(salientFailures(out)).toEqual([
      "(fail) this repository, as it stands > the root is clean, and stays that way [9.33ms]",
      "(fail) every activity names a skill > no activity is silently skill-less [272.99ms]",
    ]);
  });

  test("a `*:check` script's own ✗ lines are quoted, not just bun test's", () => {
    // NOT a `bun test` parser. Most gates here are `*:check` scripts that
    // already name what drifted, and special-casing one runner would leave
    // every other gate exactly as opaque as before.
    const out = "✓ a passing thing\n✗ DRIFTED — the diagram no longer matches\n  ✗ another\n";
    expect(salientFailures(out)).toEqual([
      "✗ DRIFTED — the diagram no longer matches",
      "✗ another",
    ]);
  });

  test("a thrown script is quoted too", () => {
    expect(salientFailures("error: Cannot find module 'x'\n")).toEqual([
      "error: Cannot find module 'x'",
    ]);
  });

  test("a PASSING line is never quoted", () => {
    expect(salientFailures("✓ 56 gate(s) pass\n 3766 pass\n")).toEqual([]);
  });

  test("ANSI colour is stripped, so a coloured runner still matches", () => {
    const out = "\u001b[31m(fail)\u001b[0m something broke";
    expect(salientFailures(out)).toEqual(["(fail) something broke"]);
  });

  test("the same shape repeated is quoted ONCE", () => {
    // A gate failing a hundred files prints one shape a hundred times; the
    // summary wants the distinct ones or it becomes the scrollback it
    // replaced.
    expect(salientFailures("✗ same\n✗ same\n✗ other\n")).toEqual(["✗ same", "✗ other"]);
  });

  test("a long run is CAPPED, and says so rather than truncating silently", () => {
    const out = Array.from({ length: 40 }, (_, i) => `(fail) test number ${i}`).join("\n");
    const hits = salientFailures(out);
    expect(hits).toHaveLength(7); // 6 + the notice
    expect(hits.at(-1)).toContain("scroll up");
  });

  test("a very long single line is elided rather than wrapping the summary", () => {
    const hit = salientFailures(`(fail) ${"x".repeat(400)}`)[0]!;
    expect(hit.length).toBeLessThanOrEqual(160);
    expect(hit.endsWith("…")).toBe(true);
  });

  test("output matching NOTHING returns empty — which the caller says out loud", () => {
    // An unrecognised shape is not an absence of one. Returning `[]` here and
    // printing the gate bare would read as "nothing to say"; the caller
    // instead tells the reader to scroll up, which is the honest third state.
    expect(salientFailures("a gate that failed quietly\nwith prose nobody parses\n")).toEqual([]);
  });
});
