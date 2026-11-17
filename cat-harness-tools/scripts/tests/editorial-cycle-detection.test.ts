import { describe, expect, test } from "bun:test";
import {
  checkDetanglerNoDependencyCycle,
  checkDetanglerNoForwardRef,
} from "../../pipeline/qa-checkers-extended";
import { buildContentGraph } from "../../pipeline/content-graph";
import { walkBlocks } from "../../pipeline/qa-utils";
import { FOLIO_ROOT, hasFolio } from "./helpers";
import { join } from "path";

/**
 * `detangler-no-dependency-cycle` scanned `uses[]` alone, so a cycle running
 * through an `interprets` edge was invisible — and one sat in the corpus
 * undetected: a remark interpreting a conjecture that `uses` the remark back.
 * "Read A before B and B before A" is just as circular whichever field carries
 * the leg.
 *
 * The fix runs cycle detection on the full editorial relation while leaving
 * `detangler-no-forward-ref` on `uses[]`. That separation is the point, and
 * these tests pin both halves of it: the checker must agree with the union
 * graph, and the forward-reference count must not have been widened as a side
 * effect — widening it moves a number several merged PRs were measured against.
 *
 * Asserted generically against whatever folio is attached, never against
 * specific labels: a test that hardcodes content is a test that breaks when the
 * content is right.
 */
describe.skipIf(!hasFolio())("editorial cycle detection", () => {
  // Lazy: `describe.skipIf` still evaluates this body, and FOLIO_ROOT is
  // undefined when the platform repo is tested on its own.
  const contentDir = (): string => join(FOLIO_ROOT!, "folio");

  /** Labels the checker says sit on a cycle. */
  function flaggedByChecker(): Set<string> {
    const out = new Set<string>();
    for (const b of walkBlocks(contentDir())) {
      if (checkDetanglerNoDependencyCycle(b.ts).result === "fail") out.add(b.label);
    }
    return out;
  }

  /** Labels that genuinely sit on a cycle in the union editorial graph. */
  function onCycleInUnionGraph(): Set<string> {
    const g = buildContentGraph(contentDir(), FOLIO_ROOT!);
    const WHITE = 0, GREY = 1, BLACK = 2;
    const colour = new Map<string, number>();
    const onCycle = new Set<string>();
    const dfs = (n: string, stack: string[]): void => {
      colour.set(n, GREY);
      stack.push(n);
      for (const m of g.out(n, "editorial")) {
        const c = colour.get(m) ?? WHITE;
        if (c === GREY) for (const l of stack.slice(stack.indexOf(m))) onCycle.add(l);
        else if (c === WHITE) dfs(m, stack);
      }
      stack.pop();
      colour.set(n, BLACK);
    };
    for (const n of g.nodes.keys()) if ((colour.get(n) ?? WHITE) === WHITE) dfs(n, []);
    return onCycle;
  }

  test("the checker flags every block the union graph puts on a cycle", () => {
    // The regression: an `interprets` leg made a real cycle invisible here, so
    // the axis reported clean on material it could not see.
    const flagged = flaggedByChecker();
    for (const label of onCycleInUnionGraph()) {
      expect(flagged.has(label)).toBe(true);
    }
  });

  test("the checker does not invent cycles the union graph does not have", () => {
    const onCycle = onCycleInUnionGraph();
    for (const label of flaggedByChecker()) {
      expect(onCycle.has(label)).toBe(true);
    }
  });

  test("forward-reference counting was NOT widened to interprets", () => {
    // Every hit must name a `uses[]` target. If `interprets` had leaked into
    // the ordering adjacency, hits would appear for edges no `uses[]` carries,
    // and the gate's number would move under everyone measuring against it.
    const g = buildContentGraph(contentDir(), FOLIO_ROOT!);
    for (const b of walkBlocks(contentDir())) {
      const r = checkDetanglerNoForwardRef(b.ts);
      if (!r.hits.length) continue;
      const usesTargets = new Set(
        g.outEdges(b.label, "editorial")
          .filter((e) => e.editorialField === "uses")
          .map((e) => e.to),
      );
      for (const hit of r.hits) {
        const named = [...usesTargets].some((t) => hit.text.includes(t));
        expect(named).toBe(true);
      }
    }
  });
});
