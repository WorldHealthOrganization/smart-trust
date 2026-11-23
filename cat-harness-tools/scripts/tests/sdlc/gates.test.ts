/**
 * The gate runner derives its list, and refuses to report an empty one.
 *
 * Bean `folio-assistant-n60j`. The property under test is not "it runs
 * things" — it is that **the list is not authored here**, and that a reader
 * that finds nothing says so instead of exiting clean.
 *
 * @module scripts/tests/gates.test
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/`) live in
 * `test/gates-workflows.test.ts` (bean `ho66`):
 * standing alone, cat-harness has no such root to read. So does
 * "every script exemption still names a script that EXISTS": the exemptions
 * name scripts declared by layers above cat-harness (cat-harness-tools,
 * smart-base, smart-trust), which only the whole checkout's script table holds.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  carriesUnexpandedVariable,
  GATES_WORKFLOW,
  NoCheckScriptsFound,
  NoGatesFound,
  SCRIPT_EXEMPTIONS,
  STEP_EXEMPTIONS,
  checkScriptNames,
  commandRunsScript,
  declaresWriter,
  gateSegments,
  gatesFrom,
  isWriterStep,
  loadGatesCiRuns,
  loadWriterSteps,
  runnableGatesFrom,
  unresolvedGatesFrom,
  loadGates,
  scriptExemptionFor,
  unrunScripts,
} from "../../gates.ts";
import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

// THE REPOSITORY root — `GATES_WORKFLOW` is `.github/workflows/…`. See the
// same constant in `gates.ts`.
const ROOT = repoRootFor(resolve(HARNESS_ROOT));
/** The REPOSITORY root — where `.github/workflows/` lives. */
const REPO = ROOT;

describe("an empty extraction is a broken reader, never a clean sweep", () => {
  test("a workflow with no bun steps extracts nothing — the pure half", () => {
    // `gatesFrom` reports what it found and does not judge it. The judging
    // is `loadGates`'s job, below. Splitting them matters: a pure reader
    // that threw could not be used to ASK whether a workflow has gates.
    expect(
      gatesFrom(`
jobs:
  typescript:
    steps:
      - run: echo nothing here
`),
    ).toEqual([]);
  });

  test("a step whose run block is absent is skipped, not crashed on", () => {
    // `uses:` steps (checkout, setup-bun) have no `run`. They are the
    // majority of a real job's steps.
    expect(
      gatesFrom(`
jobs:
  typescript:
    steps:
      - uses: actions/checkout@v4
      - run: bun run cat lint
`),
    ).toEqual([{ job: "typescript", step: "(unnamed step)", command: "bun run cat lint" }]);
  });

  test("loadGates THROWS on a workflow it cannot read gates from", () => {
    // The vacuity guard, exercised end to end against a real file rather
    // than by re-implementing the check in the test. A runner that executes
    // an empty list exits 0 and reads as a pass — the shape already paid for
    // three times here: a grep over zero Lean files reporting OK, a ruff
    // scan of missing paths reporting a baseline it never computed, and
    // readme:sync:check passing over a README with no markers.
    const dir = mkdtempSync(join(tmpdir(), "gates-"));
    try {
      mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
      writeFileSync(
        join(dir, GATES_WORKFLOW),
        "jobs:\n  typescript:\n    steps:\n      - run: echo hi\n",
      );
      expect(() => loadGates(dir)).toThrow(NoGatesFound);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the refusal says it is not green", () => {
    // A reader who sees this must not read it as "no gates needed".
    const msg = new NoGatesFound("w.yml").message;
    expect(msg).toContain("not a clean sweep");
    expect(msg).toContain("do not treat this as green");
  });
});

describe("every workflow step is accounted for", () => {

  test("every exemption states a reason", () => {
    // Same rule `folio:no-skill` and `workflow-policy.json` follow: an
    // exemption whose justification is "" is one somebody added to get to
    // green, and nobody can review it afterwards.
    const reasonless = STEP_EXEMPTIONS.filter((e) => !e.reason.trim()).map((e) => e.match);
    expect(reasonless).toEqual([]);
  });
});

describe("every check script is accounted for — the direction nothing asked", () => {
  test("the script scan finds scripts — an empty read is not full coverage", () => {
    // `unrunScripts` FILTERS this list, so a scan returning nothing reports
    // nothing unrun: total coverage over a `package.json` it could not read.
    // The scan throws instead, and this asserts the floor rather than
    // inferring it from silence.
    expect(checkScriptNames(REPO).length).toBeGreaterThan(20);
  });

  test("an empty scan THROWS rather than reporting full coverage", () => {
    const root = mkdtempSync(join(tmpdir(), "gates-noscripts-"));
    try {
      writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { build: "x" } }));
      expect(() => checkScriptNames(root)).toThrow(NoCheckScriptsFound);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a script name must end at a TOKEN BOUNDARY, not merely match", () => {
    // `check:partition` is the gate; `check:partition:edges` is a report. A
    // substring match would read the wired gate as covering the unwired
    // report — the two scripts in this repository that differ exactly in
    // that way — and the report would count as gated.
    expect(commandRunsScript("bun run cat check:partition", "check:partition")).toBe(true);
    expect(commandRunsScript("bun run cat check:partition:edges", "check:partition")).toBe(false);
    expect(commandRunsScript("bun run cat check:partition", "check:partition:edges")).toBe(false);
    // A trailing flag is still a run of that script.
    expect(commandRunsScript("bun run cat check:l1-complete -- --check", "check:l1-complete")).toBe(true);
    // And a name inside a longer word is not a run of it.
    expect(commandRunsScript("bun run xcheck:partition", "check:partition")).toBe(false);
  });

  test("every script exemption states a reason", () => {
    // Same rule as STEP_EXEMPTIONS above: an exemption with an empty
    // justification is one somebody added to get to green.
    const reasonless = SCRIPT_EXEMPTIONS.filter((e) => !e.reason.trim()).map((e) => e.script);
    expect(reasonless).toEqual([]);
  });

  test("an exemption matches by exact name, never by prefix", () => {
    // `check:partition:edges` is exempt and `check:partition` is not. A
    // prefix or substring lookup would exempt the gate along with the report.
    expect(scriptExemptionFor("check:partition:edges")).toBeDefined();
    expect(scriptExemptionFor("check:partition")).toBeUndefined();
  });

  test("an unwired script IS reported — the check can fail", () => {
    // The clean result above is only evidence if this reports a real gap.
    // Built as a fixture rather than by mutating the repo: a gate that has
    // never been shown failing is a gate nobody has tested.
    const root = mkdtempSync(join(tmpdir(), "gates-unrun-"));
    try {
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ scripts: { "check:wired": "x", "check:orphan": "y" } }),
      );
      writeFileSync(
        join(root, GATES_WORKFLOW),
        "jobs:\n  typescript:\n    steps:\n      - run: bun run check:wired\n",
      );
      expect(unrunScripts(root)).toEqual(["check:orphan"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("a command whose shell variable this reader discarded is NOT a gate", () => {
  // Bean `9zok`. The extraction keeps `bun …` lines and drops the shell that
  // gave them their variables, so a command referencing one was being run with
  // the variable's NAME. Measured: that made `bun run cat gates` report `✗ 1 of
  // 210` on a clean tree, which made the STRICT pre-push rule in `AGENTS.md`
  // unsatisfiable on every branch.
  const WORKFLOW = `name: w
on: [push]
jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - name: catalogue
        run: |
          base="$(git merge-base origin/main HEAD)"
          bun run cat translation:catalogue:check
          bun run cat translation:catalogue:check -- --base "$base"
`;

  test("it is diverted out of the RUNNABLE set, and only that set", () => {
    // `gatesFrom` still carries it, deliberately. That function answers "what
    // does CI run", which `unclassifiedSteps` and the `STEP_EXEMPTIONS`
    // staleness check both read — filtering there made 14 exemptions look
    // stale and asserted something false about CI, which is how the first
    // draft of this fix was caught.
    expect(gatesFrom(WORKFLOW, { all: true }).map((g) => g.command)).toContain(
      'bun run cat translation:catalogue:check -- --base "$base"',
    );
    const runnable = runnableGatesFrom(WORKFLOW, { all: true }).map((g) => g.command);
    expect(runnable).toContain("bun run cat translation:catalogue:check");
    expect(runnable).not.toContain('bun run cat translation:catalogue:check -- --base "$base"');
  });

  test("the two sets PARTITION the extraction — nothing falls out of both", () => {
    const all = gatesFrom(WORKFLOW, { all: true }).map((g) => g.command).sort();
    const split = [
      ...runnableGatesFrom(WORKFLOW, { all: true }),
      ...unresolvedGatesFrom(WORKFLOW, { all: true }),
    ]
      .map((g) => g.command)
      .sort();
    expect(split).toEqual(all);
  });

  test("and reported rather than dropped — the whole point", () => {
    // A silent skip and a pass are indistinguishable from the exit code, which
    // is this file's own `NoGatesFound` doctrine applied one command at a time.
    const skipped = unresolvedGatesFrom(WORKFLOW, { all: true }).map((g) => g.command);
    expect(skipped).toEqual(['bun run cat translation:catalogue:check -- --base "$base"']);
  });

  test("the script keeps its coverage, because CI invokes it BOTH ways", () => {
    // The reason skipping is safe here rather than merely convenient: the bare
    // invocation is in the same workflow and is still extracted. If that ever
    // stops being true this test fails, which is the point of asserting it
    // rather than noting it in a comment.
    const runnable = runnableGatesFrom(WORKFLOW, { all: true }).map((g) => g.command);
    expect(runnable.filter((c) => c.includes("translation:catalogue"))).toHaveLength(1);
  });

  test("the predicate catches both spellings and leaves ordinary commands alone", () => {
    expect(carriesUnexpandedVariable('bun run x -- --base "$base"')).toBe(true);
    expect(carriesUnexpandedVariable("bun run x -- --base ${BASE}")).toBe(true);
    expect(carriesUnexpandedVariable("bun run cat gates --all")).toBe(false);
    // A literal dollar that is not a variable reference must not be caught.
    expect(carriesUnexpandedVariable("bun run x -- --label '$'")).toBe(false);
  });
});

describe("a step that declares itself a writer is not a gate in the pool", () => {
  // folio-assistant#2633 runs the whole-repository projections' writers as
  // plain lines at the END of a gates job, so CI goes red when a writer cannot
  // write. `gatesFrom` reads every `bun` line as a gate, so without this the
  // local runner put them in the gate list: a writer rewriting what the gates
  // beside it read, and the tree guard (`ymsu`) reporting the run NOT clean
  // for the write that is the step's whole purpose. The mark is DATA — the
  // script's own `@covers none — writer` — so no name is listed here.
  const WRITER_DOC = "/**\n * Regenerates a projection.\n *\n * @covers none — writer — regenerates the visualisation; judges nothing\n */\n";
  const MENTION_DOC = "/**\n * Declares itself with\n *     @covers none — writer — like this\n * @covers none — a report\n */\n";

  function fixture(): string {
    const dir = mkdtempSync(join(tmpdir(), "gates-writers-"));
    mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
    mkdirSync(join(dir, "tools"), { recursive: true });
    writeFileSync(join(dir, "tools", "gen-proj.ts"), WRITER_DOC);
    writeFileSync(join(dir, "tools", "report.ts"), MENTION_DOC);
    writeFileSync(join(dir, "tools", "nav.ts"), "/**\n * @covers pages\n */\n");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        scripts: {
          "proj:viz": "bun run tools/gen-proj.ts",
          "proj:viz:check": "bun run tools/gen-proj.ts --check",
          report: "bun run tools/report.ts",
          "check:nav": "bun run tools/nav.ts",
        },
      }),
    );
    writeFileSync(
      join(dir, GATES_WORKFLOW),
      [
        "jobs:",
        "  gates-unrun:",
        "    steps:",
        "      - run: bun run cat check:nav",
        "      - run: bun run cat report",
        "      - name: the projections' writers, last",
        "        run: |",
        "          bun run cat proj:viz",
        "          bun run tools/gen-proj.ts",
        "",
      ].join("\n"),
    );
    return dir;
  }

  test("the mark is a USE in the docblock, never a mention", () => {
    expect(declaresWriter(WRITER_DOC)).toBe(true);
    // An indented sample and a plain `@covers none` are not the mark.
    expect(declaresWriter(MENTION_DOC)).toBe(false);
  });

  test("read from a workflow line, a declared writer is held out of the gate list and the pool", () => {
    const dir = fixture();
    try {
      // Both shapes a workflow uses: through the script table, and by path.
      expect(isWriterStep(dir, "bun run cat proj:viz")).toBe(true);
      expect(isWriterStep(dir, "bun run tools/gen-proj.ts")).toBe(true);
      expect(isWriterStep(dir, "bun run cat report")).toBe(false);
      expect(isWriterStep(dir, "bun run cat check:nav")).toBe(false);

      // `gatesFrom` still answers "what does CI run" — all four lines.
      expect(gatesFrom(readFileSync(join(dir, GATES_WORKFLOW), "utf-8")).map((g) => g.command)).toHaveLength(4);

      const gates = loadGates(dir).map((g) => g.command);
      expect(gates).toEqual(["bun run cat check:nav", "bun run cat report"]);
      expect(loadWriterSteps(dir).map((g) => g.command)).toEqual(["bun run cat proj:viz", "bun run tools/gen-proj.ts"]);

      // So no segment the runner builds — parallel or serial — holds a writer,
      // even with every gate declared read-only.
      const pooled = gateSegments(loadGates(dir), () => true).flatMap((s) => s.gates.map((g) => g.command));
      expect(pooled.some((c) => c.includes("proj:viz") || c.includes("gen-proj"))).toBe(false);

      // And the CI census (`audit:coverage`) still counts them: CI runs them.
      expect(loadGatesCiRuns(dir).map((g) => g.command)).toEqual([...gates, "bun run cat proj:viz", "bun run tools/gen-proj.ts"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
