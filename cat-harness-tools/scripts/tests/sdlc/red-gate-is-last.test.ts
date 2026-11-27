/**
 * `cpss` boxes 3 and 4 — the convention is enforced, and the enforcement can
 * fail.
 *
 * The corpus test says the repository is currently correct. The fixture tests
 * say the check would notice if it were not, which is the half that a check
 * asserting a property of the current tree cannot establish about itself.
 *
 * ## The control that matters most is not in this file
 *
 * Recorded here because it is evidence and it is not reproducible from a
 * fixture: run against `.github/workflows/code-quality-gates.yml` **as it stood
 * on `main` before the fix**, `redGateIsLast` reports both defects bean `cpss`
 * documented, independently of the bean —
 *
 *     [shares-a-step] ... shares step "gates that were registered and never run"
 *                         of job `gates` with 106 other gate(s)
 *     [not-last]      ... is step 46 of 51 ... and 5 step(s) follow it
 *
 * — matching the 107 invocations and 5 trailing steps measured by hand on
 * 2026-09-26. That is not asserted as a test, on purpose: pinning a historical
 * blob makes a test that decays into a statement about `origin/main` at some
 * past moment, and the fixtures below assert the same two rules without a date
 * on them.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parse } from "yaml";

import {
  DELIBERATELY_RED,
  invocations,
  notApplicableHere,
  redGateIsLast,
  type RedGate,
} from "../../check-red-gate-is-last.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..", "..");
const WORKFLOW = join(REPO, ".github", "workflows", "code-quality-gates.yml");

/** The one gate under test, so a fixture and the real list cannot drift apart. */
const RED: readonly RedGate[] = [{ script: "drift:check", why: "fixture" }];

const wf = (steps: Array<{ name?: string; run?: string }>): unknown => ({
  jobs: { gates: { steps } },
});

// A content root (an instance run by layer-pr-checks) carries no gates
// workflow, so the corpus half has nothing to read there; the gate exits 78
// in such a root, and the fixtures below still run (cat-harness-tools#1701).
describe.skipIf(notApplicableHere(REPO) !== null)("the real workflow", () => {
  // Read lazily: a skipped describe still runs its body.
  const real = (): ReturnType<typeof redGateIsLast> => redGateIsLast(parse(readFileSync(WORKFLOW, "utf-8")));

  test("it PARSED — jobs and steps were found, so a clean verdict means something", () => {
    const report = real();
    // The failure shape this repository keeps paying for: a scan that matched
    // nothing reporting a clean run over it. `main` exits 2 on this state
    // rather than 0, and the assertion is here as well because a test that
    // only checked `findings` would pass over an empty parse.
    expect(report.jobs).toBeGreaterThan(0);
    expect(report.steps).toBeGreaterThan(0);
  });

  test("every declared red gate was LOCATED, not merely not-found", () => {
    const report = real();
    // `absent` is a finding rather than a pass, so this is really asserting
    // that the declaration still matches the workflow's spelling.
    expect(report.located.map((l) => l.script).sort()).toEqual(
      DELIBERATELY_RED.map((g) => g.script).sort(),
    );
  });

  test("each is the last step of its job", () => {
    const report = real();
    expect(report.findings.map((f) => `${f.kind}: ${f.script}`)).toEqual([]);
    for (const l of report.located) expect(l.index).toBe(l.of - 1);
  });
});

describe("falsified by breaking — a step registered below the red one", () => {
  test("one step after it is caught, and the finding names that step", () => {
    const r = redGateIsLast(
      wf([{ name: "drift", run: "bun run drift:check" }, { name: "appended later" }]),
      RED,
    );
    expect(r.findings.map((f) => f.kind)).toEqual(["not-last"]);
    // The message has to name what follows: "not last" is not actionable and
    // "this step follows it" is.
    expect(r.findings[0]!.message).toContain("appended later");
    expect(r.findings[0]!.message).toContain("step 1 of 2");
  });

  test("several steps after it are all named", () => {
    const r = redGateIsLast(
      wf([
        { name: "drift", run: "bun run drift:check" },
        { name: "alpha" },
        { name: "beta" },
      ]),
      RED,
    );
    expect(r.findings[0]!.message).toContain("alpha");
    expect(r.findings[0]!.message).toContain("beta");
    expect(r.findings[0]!.message).toContain("2 step(s) follow");
  });

  test("last in its job is clean — the rule is about position, not about the gate", () => {
    const r = redGateIsLast(
      wf([{ name: "something else" }, { name: "drift", run: "bun run drift:check" }]),
      RED,
    );
    expect(r.findings).toEqual([]);
    expect(r.located).toEqual([{ script: "drift:check", job: "gates", index: 1, of: 2 }]);
  });
});

describe("falsified by breaking — bundled into a step with other gates", () => {
  test("sharing a step is caught EVEN WHEN the step is last", () => {
    // The load-bearing case, and the reason `shares-a-step` is a separate
    // finding rather than folded into `not-last`. This is the exact state
    // `cpss` was opened about: job-level ordering says "last", and under
    // `set -e` the gate still masks everything after it INSIDE the step. A
    // check that only compared step indices would have passed on the defect.
    const r = redGateIsLast(
      wf([
        {
          name: "a batch",
          run: "set -e\nbun run drift:check\nbun run other:check\nbun run third:check\n",
        },
      ]),
      RED,
    );
    expect(r.findings.map((f) => f.kind)).toEqual(["shares-a-step"]);
    expect(r.findings[0]!.message).toContain("2 other gate(s)");
    expect(r.findings[0]!.message).toContain("other:check");
  });

  test("bundled AND not last reports both, rather than stopping at the first", () => {
    const r = redGateIsLast(
      wf([{ name: "a batch", run: "bun run drift:check\nbun run other:check" }, { name: "after" }]),
      RED,
    );
    expect(r.findings.map((f) => f.kind).sort()).toEqual(["not-last", "shares-a-step"]);
  });

  test("alone in a last step is clean", () => {
    const r = redGateIsLast(wf([{ name: "drift", run: "bun run drift:check" }]), RED);
    expect(r.findings).toEqual([]);
  });
});

describe("a declared gate that is not there at all", () => {
  test("absent is a FINDING, not a pass", () => {
    // Otherwise this whole check reports clean the day its subject is renamed —
    // the failure shape it exists to prevent one level up.
    const r = redGateIsLast(wf([{ name: "unrelated", run: "bun run something:else" }]), RED);
    expect(r.findings.map((f) => f.kind)).toEqual(["absent"]);
    expect(r.findings[0]!.message).toContain("appears in no step");
  });

  test("an empty workflow yields no jobs, which `main` treats as exit 2", () => {
    const r = redGateIsLast({ jobs: {} }, RED);
    expect(r.jobs).toBe(0);
    expect(r.steps).toBe(0);
    // It still reports the declared gate as absent rather than silently
    // returning an empty report — two different answers to two questions.
    expect(r.findings.map((f) => f.kind)).toEqual(["absent"]);
  });

  test("a null document does not throw", () => {
    // `parse("")` yields null, and a check that throws on an empty file gives a
    // stack trace where it owes a verdict.
    expect(() => redGateIsLast(null, RED)).not.toThrow();
    expect(redGateIsLast(null, RED).findings.map((f) => f.kind)).toEqual(["absent"]);
  });
});

describe("invocations — what counts as running a gate", () => {
  test("one per line, in order", () => {
    expect(invocations("bun run a:check\nbun run b:check")).toEqual(["a:check", "b:check"]);
  });

  test("indented lines inside a block count", () => {
    expect(invocations("  set -e\n  bun run a:check\n")).toEqual(["a:check"]);
  });

  test("a COMMENTED-OUT invocation does not count", () => {
    // Measured against the real file: it carries a commented-out
    // `#     bun run cat agent-memory:check`, and counting it would make this check
    // report a gate the job does not run — the mirror image of `ot9a`.
    expect(invocations("# bun run a:check\n          #  bun run b:check")).toEqual([]);
  });

  test("a bare `bun run` with no target yields nothing rather than an empty name", () => {
    expect(invocations("bun run\n")).toEqual([]);
  });

  test("an absent or non-string run is empty, not a throw", () => {
    expect(invocations(undefined)).toEqual([]);
  });
});

describe("a bare runner is a gate too — `bun test` takes no target", () => {
  // Bean `dvcx`. `bun test` carried the same drift assertion as the declared
  // `translation:drift:check` and could not be declared, because the matcher
  // could only name a `bun run` target. These pin the vocabulary, not the
  // workflow: the corpus tests above already assert the real file's ordering.

  test("it is named by its own spelling, so the declaration reads like the workflow", () => {
    expect(invocations("bun test")).toEqual(["bun test"]);
    expect(invocations("  bun test\n")).toEqual(["bun test"]);
  });

  test("a COMMENTED-OUT bare runner does not count, same as a `bun run` line", () => {
    expect(invocations("# bun test\n   #  bun test")).toEqual([]);
  });

  test("arguments narrow the run and are ignored — position still applies", () => {
    // Deliberate over-match, argued in `invocations`' docblock: the cost is an
    // ordering constraint on a step that may not carry the assertion any more,
    // against masking if a narrowed run still carries it.
    expect(invocations("bun test cat-harness/content/pipeline")).toEqual(["bun test"]);
  });

  test("`bun testing:check` is a `bun run`-less word, not a bare runner", () => {
    // `\b` is load-bearing: without it this would be read as `bun test`, and the
    // check would claim to track a gate that does not exist.
    expect(invocations("bun testing:check")).toEqual([]);
  });

  test("both spellings in one step, in order", () => {
    expect(invocations("bun run a:check\nbun test\nbun run b:check")).toEqual([
      "a:check",
      "bun test",
      "b:check",
    ]);
  });

  test("falsified by breaking — a step appended below it is caught", () => {
    const bare: readonly RedGate[] = [{ script: "bun test", why: "fixture" }];
    const r = redGateIsLast(
      wf([{ name: "bun test", run: "bun test" }, { name: "appended later" }]),
      bare,
    );
    expect(r.findings.map((f) => f.kind)).toEqual(["not-last"]);
    expect(r.findings[0]!.message).toContain("appended later");
  });

  test("falsified by breaking — bundling it with another gate is caught", () => {
    const bare: readonly RedGate[] = [{ script: "bun test", why: "fixture" }];
    const r = redGateIsLast(wf([{ name: "a batch", run: "bun test\nbun run other:check" }]), bare);
    expect(r.findings.map((f) => f.kind)).toEqual(["shares-a-step"]);
    expect(r.findings[0]!.message).toContain("other:check");
  });

  test("it is DECLARED, so the corpus test above is really asserting its position", () => {
    // Without this the widening could be reverted and every test in this block
    // would still pass, since they all supply their own fixture list.
    expect(DELIBERATELY_RED.map((g) => g.script)).toContain("bun test");
  });
});

describe("not applicable in a content root (cat-harness-tools#1701)", () => {
  test("a root with no gates workflow is a content root: not applicable, with a reason", () => {
    const root = mkdtempSync(join(tmpdir(), "red-gate-content-"));
    try {
      expect(notApplicableHere(root)).toContain("content root");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a root that carries it is a harness root and is judged as before", () => {
    const root = mkdtempSync(join(tmpdir(), "red-gate-harness-"));
    try {
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(join(root, ".github", "workflows", "code-quality-gates.yml"), "jobs: {}\n");
      expect(notApplicableHere(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
