/**
 * Bean `iym1` — a gate that examined nothing refuses, and the refusal is
 * actionable.
 *
 * ## The control that motivated this file is not in it
 *
 * Recorded because it is evidence and a fixture cannot produce it: run
 * `check:skills` against the real repository with `cat-harness/skills/` and
 * `.claude/skills/` moved aside, and before this change it printed
 *
 *     Validated: 0, Errors: 0
 *
 * and exited **0** — while declaring `@covers skills`, so `audit:coverage`
 * credited the `skills` kind to a gate that could not fail vacuously. After the
 * change the same control exits 2 and names all five sources.
 *
 * That control is deliberately NOT automated. Moving directories during
 * `bun test` repairs the tree other gates are being judged on, which is bean
 * `ymsu` — this defect's own shape one layer up. So the decision is a pure
 * function and the fixtures below construct the empty corpus instead.
 */
import { describe, expect, test } from "bun:test";

import { vacuityRefusal, type Source } from "../vacuity-refusal.ts";

const src = (label: string, found: number, present = true): Source => ({
  label,
  dir: `/repo/${label}`,
  present,
  found,
});

const GATE = { script: "check:example", covers: "skills" };

describe("a population that is NOT empty", () => {
  test("one source with members is enough — the gate judges on its own findings", () => {
    expect(vacuityRefusal(GATE, [src("a", 1), src("b", 0)])).toBeUndefined();
  });

  test("the discriminating case: it is about members, not about directories existing", () => {
    // Without this, a `vacuityRefusal` that merely checked `present` would pass
    // every test above while asserting nothing — and `present` is exactly the
    // signal that was already there and already insufficient, since
    // `validateDir` returned early on a missing directory and said nothing about
    // an empty one.
    expect(vacuityRefusal(GATE, [src("a", 0, true)])).toBeDefined();
  });
});

describe("an empty population — falsified by breaking", () => {
  const msg = vacuityRefusal(GATE, [src("actors", 0, false), src("packages", 0, true)])!;

  test("it refuses", () => {
    expect(msg).toBeDefined();
    expect(msg).toContain("refusing to call that a clean run");
  });

  test("it names the SCRIPT, so the reader can re-run exactly this", () => {
    expect(msg).toContain("check:example");
  });

  test("it names every source with its resolved path", () => {
    // The clause that turned this from a guard into a finding: on the real
    // corpus it printed four sources resolving under `cat-harness/` when the
    // files live at the repository root. A count alone would have hidden that.
    expect(msg).toContain("actors");
    expect(msg).toContain("/repo/actors");
    expect(msg).toContain("packages");
    expect(msg).toContain("/repo/packages");
  });

  test("ABSENT and present-but-empty are DIFFERENT states, because they are different repairs", () => {
    expect(msg).toContain("ABSENT");
    expect(msg).toContain("present, nothing matched");
  });

  test("it says which declared kind would be falsely credited", () => {
    expect(msg).toContain("@covers skills");
    expect(msg).toContain("audit:coverage");
  });

  test("...and says nothing about a kind when the gate declares none", () => {
    // `@covers none` is not a shrug and must not be reported as one: 16 gates
    // carry it legitimately, each naming a subject that is not a declared graph
    // kind.
    for (const covers of [undefined, "none"]) {
      const m = vacuityRefusal({ script: "check:x", covers }, [src("a", 0)])!;
      expect(m).toContain("refusing");
      expect(m).not.toContain("audit:coverage");
    }
  });

  test("it cites the bean and the class, so the next reader finds the reasoning", () => {
    expect(msg).toContain("iym1");
    expect(msg).toContain("6tkl");
  });

  test("it says an empty population may be legitimate, and how to record that", () => {
    // Otherwise the only way past a legitimate empty layer is to delete the
    // guard, which is how a check becomes decoration.
    expect(msg).toContain("record");
    expect(msg).toContain("check-bean-front-matter");
  });
});

describe("a gate that recorded no sources at all", () => {
  test("refuses, and says THAT is its own defect", () => {
    // The empty-list case is not "nothing to complain about": a gate that cannot
    // say where it looked cannot be audited, and returning `undefined` here
    // would make the worst-instrumented gate the one that passes.
    const m = vacuityRefusal(GATE, [])!;
    expect(m).toBeDefined();
    expect(m).toContain("NO sources");
    expect(m).toContain("its own defect");
  });
});
