/**
 * Stale paths, and the two false-positive classes that were measured and closed.
 *
 * Bean `k59d`. The first draft of this rule produced **three findings over the
 * whole store, of which two were wrong** — which is the ratio that makes a rule
 * worth narrowing rather than shipping. Both wrong ones have a guard below, and
 * those guards must keep passing if the rule is ever widened.
 *
 * @module folio-assistant/scripts/tests/stale-paths
 */

import { describe, expect, test } from "bun:test";

import {
  assertsPending,
  attributedTo,
  chainRefs,
  doneWhenClause,
  stalePaths,
  underPathHeading,
  type Bean,
} from "../check-stale-paths.ts";

const bean = (id: string, status: string, body: string): Bean => ({
  id,
  status,
  title: id,
  body,
  file: `${id}.md`,
  archived: false,
  frontMatter: "",
  type: "task",
  parent: "",
  tags: [],
});

/** A store: one open bean carrying `body`, plus the closed beans it names. */
const store = (body: string, closed: string[] = ["2krx"], openId = "p5wm"): Bean[] => [
  bean(openId, "in-progress", body),
  ...closed.map((c) => bean(c, "completed", "")),
];

describe("a path through finished work is a finding", () => {
  test("an arrow chain routing through a completed bean", () => {
    const r = stalePaths(store("`b5f0` → `2krx` → `supn`\n"));
    expect(r).toHaveLength(1);
    expect(r[0]!.rule).toBe("chain");
    expect(r[0]!.through.map((t) => t.id)).toEqual(["2krx"]);
  });

  test("the ASCII arrow is the same rule — the corpus uses both", () => {
    expect(stalePaths(store("`b5f0` -> `2krx` -> `supn`\n"))).toHaveLength(1);
  });

  test("a numbered step under a path heading", () => {
    const r = stalePaths(store("## Shortest path\n\n1. Close `2krx`, which is built\n"));
    expect(r).toHaveLength(1);
    expect(r[0]!.rule).toBe("numbered-step");
  });

  test("a scrapped bean counts as finished too", () => {
    const beans = [bean("p5wm", "in-progress", "`a1b2` → `dead` → `z9y8`\n"), bean("dead", "scrapped", "")];
    expect(stalePaths(beans)).toHaveLength(1);
  });

  test("a path through OPEN work is not a finding", () => {
    const beans = [bean("p5wm", "in-progress", "`b5f0` → `live` → `supn`\n"), bean("live", "todo", "")];
    expect(stalePaths(beans)).toHaveLength(0);
  });

  test("a CLOSED bean's own stale path is not reported — it is finished", () => {
    const beans = [bean("old", "completed", "`b5f0` → `2krx`\n"), bean("2krx", "completed", "")];
    expect(stalePaths(beans)).toHaveLength(0);
  });
});

// ── The two guards. Each closes a class MEASURED on the real store. ──

describe("GUARD: an arrow is not always a dependency", () => {
  test("a line-count range is not a route, even with a closed id in the same paragraph", () => {
    // `x3bd`, verbatim in shape: "README is 97 → 66 lines" in a long paragraph
    // that also mentions a closed bean hundreds of characters away. The first
    // draft asked only "arrow on the line, closed id on the line".
    const r = stalePaths(store("README is 97 → 66 lines, and bean `2krx` carries the reason.\n"));
    expect(r).toHaveLength(0);
  });

  test("an id must be an OPERAND of the arrow, not merely nearby", () => {
    expect(chainRefs("`a1b2` → `c3d4`")).toEqual(expect.arrayContaining(["a1b2", "c3d4"]));
    expect(chainRefs("some prose with `a1b2` and no arrow at all")).toEqual([]);
  });
});

describe("GUARD: a bean describing ANOTHER bean's stale path is not stale", () => {
  test("a table row is attributed by its first cell", () => {
    // `k59d` quotes `p5wm`'s chain as evidence and was reported as its own
    // defect. The same shape `check-bean-bodies` closed with a quotation guard,
    // and the same shape that flagged `jijc` hours earlier.
    const known = new Set(["p5wm", "2krx"]);
    expect(attributedTo("| `p5wm` (GOAL 2) | critical path `b5f0 → 2krx` | `2krx` is done |", ["2krx"], known)).toBe(
      "p5wm",
    );
  });

  test("a quoted chain in a table row produces no finding", () => {
    const beans = [
      bean("k59d", "in-progress", "| `p5wm` | critical path `b5f0 → 2krx → supn` | `2krx` is completed |\n"),
      bean("p5wm", "in-progress", ""),
      bean("2krx", "completed", ""),
    ];
    expect(stalePaths(beans)).toHaveLength(0);
  });

  test("a bean stating its OWN path is still reported — the guard must not swallow it", () => {
    // The direction that matters: narrowing for the quoted case must not make
    // the real case invisible.
    expect(stalePaths(store("`b5f0` → `2krx` → `supn`\n"))).toHaveLength(1);
  });
});

describe("a numbered step is only a path when its heading says so", () => {
  test("a heading naming a path qualifies", () => {
    expect(underPathHeading(["## Shortest path", "", "1. do `2krx`"], 2)).toBe(true);
  });

  test("an ordinary numbered list under an unrelated heading does not", () => {
    // Otherwise every enumerated note in the store becomes a route.
    expect(underPathHeading(["## Measured", "", "1. do `2krx`"], 2)).toBe(false);
  });

  test("a numbered list under no heading at all does not", () => {
    expect(underPathHeading(["1. do `2krx`"], 0)).toBe(false);
  });
});

/**
 * Bean `k59d`, round 2. A milestone states what remains in THREE shapes; the
 * first two were already read. The third is its Done-when list, and an
 * UNCHECKED box is structurally a claim about what is still to come — which is
 * why it can be read where free prose cannot.
 *
 * Every guard below is a false positive that the first draft actually produced
 * over the real store, not a hypothetical.
 */
describe("an unchecked Done-when clause that waits on finished work", () => {
  const done = (body: string) => stalePaths([bean("aaaa", "todo", body), bean("bbbb", "completed", "x")]);

  test("a precondition on a completed bean is a finding", () => {
    const f = done("## Done when\n\n- [ ] The instances are migrated once `bbbb` is answered");
    expect(f.map((x) => x.rule)).toEqual(["done-when"]);
    expect(f[0]!.through).toEqual([{ id: "bbbb", status: "completed" }]);
  });

  test("the mirror form — the reference first, its completion after", () => {
    expect(done("- [ ] `bbbb` fixed — before anything else").map((x) => x.rule)).toEqual(["done-when"]);
  });

  test("a CHECKED box is not a claim about what remains", () => {
    // The box says the work is done. Naming a finished bean there is correct.
    expect(done("- [x] The instances are migrated once `bbbb` is answered")).toEqual([]);
  });

  test("a clause that ACTS ON a finished bean is correct prose, not a stale path", () => {
    // Measured: 13 of the 16 unchecked clauses naming a closed bean are this
    // shape. Reporting them would have made the rule noise.
    expect(done("- [ ] `bbbb` and the others are re-read under that distinction")).toEqual([]);
  });

  test("an OPEN bean named as a precondition is not a finding", () => {
    expect(stalePaths([bean("aaaa", "todo", "- [ ] migrated once `cccc` is answered"), bean("cccc", "todo", "x")])).toEqual([]);
  });

  test('GUARD: the literal words "Done-when" supply neither "when" nor "done"', () => {
    // Both false positives in the first measurement came from this ONE phrase,
    // which every bean in the store carries: "when" fed the precondition list
    // through `Done-when`, and "done" fed the completion list through the same
    // hyphen. Two plausible-looking findings, neither real.
    expect(done("- [ ] `bbbb`'s Done-when and the recorded answer are corrected")).toEqual([]);
    expect(assertsPending("`bbbb`'s Done-when is cited", "bbbb")).toBe(false);
  });

  test("GUARD: a clause does not borrow the NEXT box's precondition", () => {
    // A fixed three-line window let one box reach into its neighbour, which
    // reported two clauses that name no precondition at all.
    const body = "- [ ] `bbbb` — the import the regex misses\n- [ ] Worth having once `bbbb` is settled";
    const f = done(body);
    expect(f).toHaveLength(1);
    expect(f[0]!.line).toBe("- [ ] Worth having once `bbbb` is settled");
  });

  test("a clause ends at a dedent, a blank line, a heading or the next box", () => {
    const lines = ["- [ ] first", "      wrapped continuation", "- [ ] second"];
    expect(doneWhenClause(lines, 0)).toBe("- [ ] first wrapped continuation");
    expect(doneWhenClause(lines, 1)).toBeUndefined();
  });

  test("REACHABILITY: the rule runs on an ordinary line, not only under a path heading", () => {
    // It did not. `if (!underPathHeading(...)) continue` sat above this rule and
    // made it unreachable, so it ran on NO line and the check printed ✓ over a
    // store holding three findings. A green check that never executed looks
    // exactly like a green one that did.
    const f = done("Some prose.\n\n- [ ] migrated once `bbbb` is answered\n\nMore prose.");
    expect(f).toHaveLength(1);
  });
});
