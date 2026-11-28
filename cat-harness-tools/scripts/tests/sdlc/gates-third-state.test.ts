/**
 * The gate runner's third state — bean `6366`.
 *
 * `bun run cat gates` exited 0 or 1 only, so **"every gate passed"** and **"I could
 * not work out what the gates ARE"** were the same answer. That is the failure
 * this repository names everywhere else: could-not-determine is never rendered
 * as clean, and it outranks a finding.
 *
 * ## What was actually wrong, which is not what the bean's criterion implied
 *
 * `loadGates` was already right. It refuses **both** shapes — the workflow file
 * absent, and the file present but yielding no commands — and its message says
 * why: *"no gate commands were extracted. That is not a clean sweep, it is a
 * broken reader."*
 *
 * The defect was in the CLI, which let that throw escape as an uncaught
 * exception. So a could-not-determine arrived as exit **1**, indistinguishable
 * from a real gate failure. The fix therefore adds no detection; it translates a
 * refusal the library already makes into the right exit code.
 *
 * That is also why there is no `gates.length === 0` test below: such a branch
 * cannot fire, because `loadGates` throws first. Asserting on a guard that
 * cannot execute is how a dead guard reads as protection — the defect already
 * paid for in `build-glossary.ts`, where `resolve("")` returned the cwd and the
 * `!existsSync` check never fired.
 *
 * @module scripts/tests/gates-third-state.test
 *
 * The tests of this file that read the whole checkout (reads the aggregate
 * root's `.github/workflows/code-quality-gates.yml`) live in
 * `test/gates-third-state-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GATES_WORKFLOW, loadGates, undeterminedReport } from "../../gates.ts";

/** A root with nothing in it: the workflow file is absent. */
function bareRoot(): string {
  return mkdtempSync(join(tmpdir(), "gates-bare-"));
}

/** A root whose workflow file EXISTS and declares no jobs — the subtler shape. */
function emptyWorkflowRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "gates-emptywf-"));
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  writeFileSync(join(root, GATES_WORKFLOW), "name: gates\njobs: {}\n");
  return root;
}

describe("loadGates refuses rather than returning an empty set", () => {
  it("throws when the workflow file is absent", () => {
    const root = bareRoot();
    try {
      expect(() => loadGates(root, { all: false })).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("throws when the workflow parses but yields NO commands", () => {
    // The shape that would otherwise produce "✓ 0 gate(s) pass" and exit 0 — a
    // clean run over nothing. Asserted on the message, because the exit code
    // alone cannot say which of the two happened.
    const root = emptyWorkflowRoot();
    try {
      expect(() => loadGates(root, { all: false })).toThrow(/not a clean sweep/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the report that accompanies exit 2", () => {
  it("says in words that this is neither a pass nor a failure", () => {
    // The exit code carries the distinction for a machine; a person reads the
    // text, and a caller that only greps for "fail" must not conclude "clean".
    const lines = undeterminedReport(new Error("boom"), "/somewhere");
    const text = lines.join("\n");
    expect(text).toContain("could not derive the gate set");
    expect(text).toContain("NOT a pass and NOT a failure");
    expect(text).toContain("Exit 2");
    // It must NOT read as a clean tree.
    expect(text).not.toMatch(/^✓/m);
  });

  it("names the file it looked for and the root it looked under", () => {
    // A downstream layer gets this Tool and none of the workflows it reads —
    // the case the node's own `selection.when` says it matters most in. "Could
    // not derive" without the path is unactionable there.
    const lines = undeterminedReport(new Error("boom"), "/some/root");
    const text = lines.join("\n");
    expect(text).toContain(GATES_WORKFLOW);
    expect(text).toContain("/some/root");
  });

  it("carries the underlying cause rather than swallowing it", () => {
    expect(undeterminedReport(new Error("ENOENT: nope"), "/r").join("\n")).toContain("ENOENT: nope");
  });

  it("survives a non-Error throw", () => {
    // `catch (e: unknown)` really is unknown; a string throw must not crash the
    // reporter that exists to explain a crash.
    expect(undeterminedReport("just a string", "/r").join("\n")).toContain("just a string");
  });
});
