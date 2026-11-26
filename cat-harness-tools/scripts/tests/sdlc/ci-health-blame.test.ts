/**
 * Which merge a red `main` is attributable to — and, above all, when it cannot
 * be told.
 *
 * @module scripts/tests/ci-health-blame.test
 *
 * Bean `kgho`, implementing bean `391j`'s rule: **check the parent before
 * blaming the last merge.** `391j` blamed #1245's merge when `main` had already
 * been red one merge earlier at `08fe2c68` — a confident diagnosis, citing a
 * real commit, and wrong.
 *
 * The test that matters most here is the `none` one. A commit with no run of a
 * workflow is not a commit that passed it, and the cheap implementation — treat
 * anything that is not `failure` as green — produces a named suspect from an
 * absence. That is a false accusation in a tracking issue somebody then acts on.
 */
import { describe, expect, test } from "bun:test";
import {
  BLAME_WALK_CAP,
  blameFailingRun,
  renderBlame,
  type ConclusionOnCommit,
} from "../../../src/workflow/ci-health";

/** A linear first-parent chain `c9 <- c8 <- … <- c0`, newest first. */
function chain(conclusions: ConclusionOnCommit[]) {
  const sha = (i: number) => `${i}`.repeat(40).slice(0, 40);
  return {
    failingSha: sha(0),
    firstParent: (s: string) => {
      const i = conclusions.findIndex((_, n) => sha(n) === s);
      return i >= 0 && i + 1 < conclusions.length ? sha(i + 1) : undefined;
    },
    conclusionOn: (s: string) => {
      const i = conclusions.findIndex((_, n) => sha(n) === s);
      return i >= 0 ? conclusions[i]! : "none";
    },
    sha,
  };
}

describe("the parent is checked before the last merge is blamed", () => {
  test("parent green -> the failing commit is the suspect, stepsBack 0", () => {
    const c = chain(["failure", "success"]);
    expect(blameFailingRun(c)).toEqual({
      kind: "suspect",
      sha: c.sha(0),
      parentSha: c.sha(1),
      stepsBack: 0,
    });
  });

  test("parent ALSO red -> the walk goes back, and the last merge is not blamed", () => {
    // `391j`'s own case, as data: the failing commit and its parent are both
    // red, and the cause is the commit before them. A implementation that named
    // the failing commit would be confidently wrong here — which is exactly
    // what happened, to a person, on a real PR.
    const c = chain(["failure", "failure", "success"]);
    const v = blameFailingRun(c);
    expect(v).toEqual({ kind: "suspect", sha: c.sha(1), parentSha: c.sha(2), stepsBack: 1 });
    expect(renderBlame(v)).toContain("1 merge(s) before the failing one");
    expect(renderBlame(v)).toContain("391j");
  });

  test("a long red stretch is walked to its start", () => {
    const c = chain(["failure", "failure", "failure", "failure", "success"]);
    expect(blameFailingRun(c)).toMatchObject({ kind: "suspect", sha: c.sha(3), stepsBack: 3 });
  });
});

describe("`none` is not `success` — the rule this exists to hold", () => {
  test("a parent with NO run yields cannot-determine, never a suspect", () => {
    const c = chain(["failure", "none", "success"]);
    const v = blameFailingRun(c);
    expect(v).toEqual({
      kind: "cannot-determine",
      why: "no-run-on-parent",
      at: c.sha(1),
      stepsBack: 0,
    });
    // And it must not be silently absent from the report: an omitted suspect
    // is indistinguishable from nothing being wrong (`1xhc`).
    expect(renderBlame(v)).toContain("could not determine");
    expect(renderBlame(v)).toContain("not a commit that passed");
  });

  test("it does NOT keep walking past the gap to find a green further back", () => {
    // The subtle wrong fix: skip the unknown commit and keep going. The green
    // two steps back says nothing about the commit in between, so a suspect
    // derived from it is a guess wearing a measurement's clothes.
    const c = chain(["failure", "none", "success", "success"]);
    expect(blameFailingRun(c)).toMatchObject({ kind: "cannot-determine", why: "no-run-on-parent" });
  });

  test("a failed lookup is its own answer, not a missing run", () => {
    const c = chain(["failure", "unknown", "success"]);
    expect(blameFailingRun(c)).toMatchObject({ kind: "cannot-determine", why: "lookup-failed" });
  });
});

describe("the walk is bounded, and says so when it hits the bound", () => {
  test("all red to the cap -> walk-exhausted, and the report says it is not recent", () => {
    const v = blameFailingRun({
      ...chain(Array(BLAME_WALK_CAP + 5).fill("failure") as ConclusionOnCommit[]),
      cap: BLAME_WALK_CAP,
    });
    expect(v).toMatchObject({ kind: "cannot-determine", why: "walk-exhausted" });
    expect(renderBlame(v)).toContain("it is not the recent merges");
  });

  test("the cap IS the budget: it examines exactly `cap` parents, no more", () => {
    // Rewritten 2026-10-01. The loop was inclusive (`stepsBack <= cap`), so it
    // examined `cap + 1` parents and returned `stepsBack: cap + 1`, while
    // `renderBlame` said "still red 10 first-parents back" and the constant's
    // docblock promised "at most ten extra requests" — three numbers, two
    // wrong. Review on #1725. The cap is now the request budget exactly.
    const c = chain(["failure", "failure", "failure", "failure", "success"]);
    // cap 4 examines parents 1..4; the green is the 4th, so it resolves.
    expect(blameFailingRun({ ...c, cap: 4 })).toMatchObject({ kind: "suspect", stepsBack: 3 });
    // cap 3 examines parents 1..3, all red, and stops WITHOUT looking at the
    // 4th — the green it must not reach.
    expect(blameFailingRun({ ...c, cap: 3 })).toMatchObject({ why: "walk-exhausted", stepsBack: 3 });
  });

  test("`walk-exhausted` reports the cap itself, which is what renderBlame prints", () => {
    // The three numbers that disagreed. Pinned together so they cannot drift
    // apart again: the verdict's `stepsBack`, the constant, and the sentence.
    const v = blameFailingRun({
      ...chain(Array(BLAME_WALK_CAP + 5).fill("failure") as ConclusionOnCommit[]),
    });
    expect(v).toMatchObject({ kind: "cannot-determine", why: "walk-exhausted", stepsBack: BLAME_WALK_CAP });
    expect(renderBlame(v)).toContain(`${BLAME_WALK_CAP} first-parents back`);
  });

  test("a root commit ends the walk as no-parent, not as a suspect", () => {
    const c = chain(["failure"]);
    const v = blameFailingRun(c);
    expect(v).toMatchObject({ kind: "cannot-determine", why: "no-parent", at: c.sha(0) });
    expect(renderBlame(v)).toContain("no first parent");
  });
});

describe("every verdict renders as a statement, never as silence", () => {
  test("no verdict renders empty, and every cannot-determine says so in words", () => {
    const cases: ConclusionOnCommit[][] = [
      ["failure", "success"],
      ["failure", "failure", "success"],
      ["failure", "none"],
      ["failure", "unknown"],
      ["failure"],
    ];
    for (const conclusions of cases) {
      const v = blameFailingRun(chain(conclusions));
      const line = renderBlame(v);
      expect({ conclusions, empty: line.trim().length === 0 }).toEqual({ conclusions, empty: false });
      if (v.kind === "cannot-determine") {
        expect({ conclusions, says: line.includes("could not determine") }).toEqual({
          conclusions,
          says: true,
        });
      }
    }
  });
});
