/**
 * `bun run cat regen` — repair the artefacts a merge left wrong, by asking the gates.
 *
 * Bean `lxpq`. The command's whole value is that it distinguishes STALENESS
 * from a real defect, so the assertions that matter are the ones about the
 * states it reports, not the happy path.
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/code-quality-gates.yml`) live in
 * `test/regen-after-merge-workflows.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read. So do the
 * two that assert `WRITER_OVERRIDES` and `NO_WRITER` name real scripts: those
 * scripts are declared by layers above cat-harness, which only the whole
 * checkout's script table holds.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_MAX_PASSES,
  JUDGE_CHECKS,
  NO_WRITER,
  UNGATED_INPUTS,
  WRITER_OVERRIDES,
  exitCodeFor,
  isJudgeCheck,
  maxPassesFromArgv,
  mountFirst,
  REGEN_VERDICT_TAG,
  regenExitMeaning,
  regenPass,
  regenToFixpoint,
  relabelForMissingBrowser,
  repairableGates,
  scriptOf,
  writerFor,
  type Outcome,
  type Result,
  type Runner,
} from "../../regen-after-merge.ts";
import { loadGates } from "../../gates.ts";
import { repoRootFor } from "../../../schemas/kg/cat-harness.ts";
import { scriptsOf } from "../../../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { regenArgs } from "../../merge-base.ts";

function resolveRepoRoot(instance: string): string {
  let cur = repoRootFor(instance);
  while (cur !== "/" && Object.keys(scriptsOf(cur)).length === 0) {
    const parent = join(cur, "..");
    if (parent === cur) break;
    cur = parent;
  }
  return cur;
}

const INSTANCE = join(HARNESS_ROOT);
const REPO = resolveRepoRoot(INSTANCE);
const SCRIPTS = scriptsOf(REPO);

describe("the pair is READ, never assumed", () => {
  test("`X:check` pairs with `X` when `X` exists", () => {
    expect(writerFor(SCRIPTS, "voices:viz:check")).toBe("voices:viz");
    expect(writerFor(SCRIPTS, "kg:audit:check")).toBe("kg:audit");
  });

  test("a check whose writer does NOT exist returns undefined, not a guess", () => {
    // The failure mode this prevents: a writer renamed out from under its
    // check, where composing the name by convention would produce a command
    // that runs nothing and a report that claims a repair.
    expect(writerFor({ "thing:check": "x" }, "thing:check")).toBeUndefined();
  });

  test("a script that is not a `:check` has no writer", () => {
    expect(writerFor(SCRIPTS, "lint")).toBeUndefined();
  });
});

describe("only a gate that runs EXACTLY one script is repairable", () => {
  test("a plain `bun run X` yields X", () => {
    expect(scriptOf("bun run cat voices:viz:check")).toBe("voices:viz:check");
    expect(scriptOf("  bun run cat kg:audit:check  ")).toBe("kg:audit:check");
  });

  test("anything else yields undefined rather than a partial match", () => {
    // A compound or argument-carrying command cannot be paired with a writer
    // by name, and pretending otherwise would run the wrong thing.
    expect(scriptOf("bun run a && bun run b")).toBeUndefined();
    expect(scriptOf("bun test")).toBeUndefined();
    expect(scriptOf("bunx tsc --noEmit -p tsconfig.json")).toBeUndefined();
    expect(scriptOf("bun run gen-voices-viz.ts --check")).toBeUndefined();
  });
});

describe("the set comes from the WORKFLOW, not from package.json", () => {
  // `gates.ts` measured that 21 of this repository's `:check` scripts appear
  // in no workflow at all. Deriving the set from package.json would run
  // generators CI does not gate — a guess that reads as coverage.
  const gates = loadGates(REPO, {});
  const pairs = repairableGates(gates, SCRIPTS);

  test("it finds a real, non-empty set", () => {
    expect(pairs.length).toBeGreaterThan(10);
  });

  test("...and a STRICT subset of package.json's check scripts", () => {
    const allChecks = Object.keys(SCRIPTS).filter((s) => s.endsWith(":check") || WRITER_OVERRIDES[s] !== undefined);
    expect(pairs.length).toBeLessThan(allChecks.length);
    for (const p of pairs) {
      if (p.writer !== undefined) expect(allChecks).toContain(p.check);
    }
  });

  test("every pair it reports as repairable has a writer that exists", () => {
    for (const p of pairs) {
      if (p.writer === undefined) continue;
      expect(SCRIPTS[p.writer]).toBeDefined();
    }
  });

  test("the voices check — the one that broke main — is in the set", () => {
    // The regression. `lxpq` reached main through exactly this check, so a
    // repair command that did not cover it would be answering a different
    // question from the one it was written for.
    expect(pairs.map((p) => p.check)).toContain("voices:viz:check");
    expect(pairs.find((p) => p.check === "voices:viz:check")?.writer).toBe("voices:viz");
  });

  test("a gate listed twice is offered once", () => {
    const names = pairs.map((p) => p.check);
    expect(names.length).toBe(new Set(names).size);
  });
});

describe("a check with no writer is REPORTED, never skipped", () => {
  test("it is carried through as a pair with an undefined writer", () => {
    // Not filtered out: "this check failed and nothing can regenerate it" is
    // a finding, and dropping it would leave a red check invisible to the one
    // command a person runs after a merge.
    const fake = [
      { job: "j", step: "s", command: "bun run orphan:check" },
      { job: "j", step: "s", command: "bun run cat voices:viz:check" },
    ];
    const pairs = repairableGates(fake, SCRIPTS);
    expect(pairs.map((p) => p.check)).toEqual(["orphan:check", "voices:viz:check"]);
    expect(pairs[0]!.writer).toBeUndefined();
    expect(pairs[1]!.writer).toBe("voices:viz");
  });
});

describe("a writer that is not <check minus :check> is DECLARED (bean eowd)", () => {
  test("translate-bpmn:check is repaired by the script that writes, not the one that reports", () => {
    expect(writerFor(SCRIPTS, "translate-bpmn:check")).toBe("translate-bpmn:extract");
    expect(SCRIPTS["translate-bpmn:extract"]).toContain("--extract");
  });
});

describe("a `check:X` gate is paired only by DECLARATION — bean `uju6`", () => {
  test("`check:prov-qaqc` is repaired by `prov:qaqc`", () => {
    // #1550 went red on it while regen said "63 current, 0 regenerated": the
    // gate is `check:`-prefixed, so the `X:check` convention never offered it.
    expect(writerFor(SCRIPTS, "check:prov-qaqc")).toBe("prov:qaqc");
    const pairs = repairableGates([{ job: "j", step: "s", command: "bun run cat check:prov-qaqc" }], SCRIPTS);
    expect(pairs).toEqual([{ check: "check:prov-qaqc", writer: "prov:qaqc" }]);
  });
});

describe("regen runs to a FIXPOINT, not one pass — bean `14ve`", () => {
  /**
   * A tiny tree: writer B's output is an INPUT to check A, and A is asked
   * first. Staleness is modelled as version numbers, so the test says exactly
   * which write made which check current.
   */
  function tree() {
    const v = { bInput: 1, bOut: 0, aOut: 0 };
    const scripts: Record<string, () => boolean> = {
      "a:check": () => v.aOut === v.bOut, // A is derived from B's output
      a: () => ((v.aOut = v.bOut), true),
      "b:check": () => v.bOut === v.bInput,
      b: () => ((v.bOut = v.bInput), true),
    };
    const runner: Runner = (s) => scripts[s]!();
    return { v, runner };
  }
  const pairs = [
    { check: "a:check", writer: "a" },
    { check: "b:check", writer: "b" },
  ];

  test("one pass leaves A stale; the fixpoint leaves every check current", async () => {
    const { v, runner } = tree();
    const r = await regenToFixpoint(pairs, runner);
    expect(r.settled).toBe(true);
    // Pass 1: A current (0 === 0), B stale → B writes 1. Pass 2: A stale →
    // repaired. Pass 3: nothing ran.
    expect(r.passes).toBe(3);
    expect(v.aOut).toBe(v.bOut);
    expect(r.results.map((x) => x.outcome)).toEqual(["regenerated", "regenerated"]);
  });

  test("a single pass really does leave it stale — the control", async () => {
    const { v, runner } = tree();
    const r = await regenToFixpoint(pairs, runner, 1);
    expect(r.settled).toBe(false);
    expect(v.aOut).not.toBe(v.bOut);
  });

  test("two writers that undo each other stop at the cap and say so", async () => {
    let x = 0;
    const flip: Runner = (s) => (s.endsWith(":check") ? false : ((x = 1 - x), true));
    const r = await regenToFixpoint([{ check: "p:check", writer: "p" }], flip, 3);
    expect(r.passes).toBe(3);
    expect(r.settled).toBe(false);
    expect(x === 0 || x === 1).toBe(true);
  });
});

describe("UNGATED_INPUTS — writers regen runs without making them gates (bean 5qq3)", () => {
  const pkg = { scripts: scriptsOf(REPO) };

  test("every pair names two scripts that exist", () => {
    for (const { check, writer } of UNGATED_INPUTS) {
      expect(pkg.scripts[check], `${check} is not a script`).toBeDefined();
      expect(pkg.scripts[writer], `${writer} is not a script`).toBeDefined();
    }
  });

  test("an ungated input asked FIRST lets a dependent check settle in one pass", async () => {
    // library:viz writes what methodologies:viz reads. Asked first, the
    // dependent sees the fresh input in the same pass: no second pass needed.
    let libraryFresh = false;
    const runner: Runner = (s) => {
      if (s === "library:viz") { libraryFresh = true; return true; }
      if (s === "library:viz:check") return libraryFresh;
      if (s === "methodologies:viz:check") return libraryFresh;
      return true;
    };
    const pairs = [{ check: "library:viz:check", writer: "library:viz" }, { check: "methodologies:viz:check", writer: "methodologies:viz" }];
    const fx = await regenToFixpoint(pairs, runner);
    expect(fx.results.map((r) => r.outcome)).toEqual(["regenerated", "current"]);
  });
});

describe("the derivation finds the writers a merge stales — bean `g5kt`", () => {
  /**
   * The THREE reds of 2026-10-04, each of which cost a CI cycle because the
   * contributor ran the writers from memory instead of `bun run cat regen`.
   *
   * The brief for that session read *"the regeneration loop has no
   * derivation"*. It has one, and these are the measurements that say so, so
   * the next agent re-derives the answer instead of rebuilding the tool: a
   * second derived list would be a second answer to "what must I re-run",
   * free to disagree with this one.
   */
  const MEASURED: readonly [check: string, writer: string][] = [
    ["readme:subgraphs:check", "readme:subgraphs"],
    ["check:term-mapping", "term:mapping"],
    ["docs:harness:check", "docs:harness"],
    // The pair whose chain needed a third writer pass, which is what raised
    // DEFAULT_MAX_PASSES off 3.
    ["skill:register:check", "skill:register"],
  ];

  const pairs = repairableGates(loadGates(REPO, { all: true }), SCRIPTS);

  test.each(MEASURED)("%s is derived, with %s as its writer", (check, writer) => {
    const p = pairs.find((x) => x.check === check);
    expect(p, `${check} is not in the derived set`).toBeDefined();
    expect(p!.writer).toBe(writer);
  });

  test("a writer added to package.json appears with NO list to edit", () => {
    // The property the whole command rests on, asserted against a synthetic
    // gate rather than by waiting for somebody to add one: nothing in
    // `regen-after-merge.ts` names `brand:new`, and the pair still forms.
    const scripts = { ...SCRIPTS, "brand:new": "bun run x.ts", "brand:new:check": "bun run x.ts --check" };
    const gate = { job: "typescript", step: "s", command: "bun run brand:new:check" };
    expect(repairableGates([gate], scripts)).toEqual([{ check: "brand:new:check", writer: "brand:new" }]);
    // ...and the SAME gate against the unmodified scripts is reported as a gap
    // rather than silently dropped, which is what makes the first half safe.
    expect(repairableGates([gate], SCRIPTS)).toEqual([{ check: "brand:new:check", writer: undefined }]);
  });

  test("a derived name that resolves to no script is a GAP, never a guess", () => {
    // The trap of the 2026-10-04 sweep: stripping `:check` off `check:glossary`
    // gives `glossary`, which is not a script at all (`glossary:page` is). A
    // derivation that ran its candidates unresolved would have run nothing and
    // called it a repair.
    expect(SCRIPTS["glossary"]).toBeUndefined();
    expect(SCRIPTS["glossary:page"]).toBeDefined();
    expect(writerFor(SCRIPTS, "check:glossary")).toBe("glossary:page");
    // And the general case: every candidate is resolved against package.json.
    expect(writerFor(SCRIPTS, "nothing-like-this:check")).toBeUndefined();
  });
});

describe("a run that did not settle is NOT clean — bean `g5kt`", () => {
  const ok: Result[] = [{ check: "a:check", writer: "a", outcome: "current" }];

  test("settled and clean exits 0", () => {
    expect(exitCodeFor({ results: ok, settled: true })).toEqual({ code: 0, reason: "clean" });
  });

  test("NOT settled exits non-zero, even with nothing unrepaired", () => {
    // The false clean this bean is about: `settled` was printed and dropped,
    // so this exact run exited 0.
    const v = exitCodeFor({ results: ok, settled: false, passes: 6 });
    expect(v.code).toBe(2);
    expect(v.reason).toBe("not-settled");
    expect(v.message).toContain("COULD NOT DETERMINE");
    // The number of passes it gave up after is ON the line, so "did not
    // settle in 6" is distinguishable from "did not settle in 1".
    expect(v.message).toContain("6 pass(es)");
  });

  test("a real defect outranks non-convergence, because it names checks to read", () => {
    const results: Result[] = [...ok, { check: "b:check", writer: "b", outcome: "unrepaired" }];
    expect(exitCodeFor({ results, settled: false }).reason).toBe("not-staleness");
    expect(exitCodeFor({ results, settled: true }).code).toBe(1);
  });

  test("no-writer is a defect too, not a shrug", () => {
    const results: Result[] = [{ check: "c:check", outcome: "no-writer" }];
    expect(exitCodeFor({ results, settled: true }).code).toBe(1);
  });

  test("--dry-run ran no writer, so it is not judged on settling", () => {
    const v = exitCodeFor({ results: ok, settled: false, dryRun: true });
    expect(v).toEqual({ code: 0, reason: "dry-run" });
  });

  test("every reason maps to exactly one code — the states cannot collapse", () => {
    const seen = new Map<string, number>();
    for (const run of [
      { results: ok, settled: true },
      { results: ok, settled: false },
      { results: [{ check: "x", outcome: "unrepaired" as const }], settled: true },
      { results: ok, settled: false, dryRun: true },
    ]) {
      const v = exitCodeFor(run);
      const prev = seen.get(v.reason);
      if (prev !== undefined) expect(v.code).toBe(prev);
      seen.set(v.reason, v.code);
    }
    expect([...seen.keys()].sort()).toEqual(["clean", "dry-run", "not-settled", "not-staleness"]);
  });
});

describe("the fixpoint bound is above the measured need — bean `g5kt`", () => {
  /**
   * A chain three writers deep: C's output feeds B, B's feeds A, and they are
   * asked A, B, C — the worst order. This is the `skill:register` shape the
   * 2026-10-04 sweep measured, where a third writer pass was needed.
   */
  function chain() {
    const v = { c: 1, cOut: 0, bOut: 0, aOut: 0 };
    const scripts: Record<string, () => boolean> = {
      "a:check": () => v.aOut === v.bOut,
      a: () => ((v.aOut = v.bOut), true),
      "b:check": () => v.bOut === v.cOut,
      b: () => ((v.bOut = v.cOut), true),
      "c:check": () => v.cOut === v.c,
      c: () => ((v.cOut = v.c), true),
    };
    return { v, runner: ((s) => scripts[s]!()) as Runner };
  }
  const pairs = [
    { check: "a:check", writer: "a" },
    { check: "b:check", writer: "b" },
    { check: "c:check", writer: "c" },
  ];

  test("the default settles it", async () => {
    const { v, runner } = chain();
    const r = await regenToFixpoint(pairs, runner);
    expect(r.settled).toBe(true);
    expect(v.aOut).toBe(v.c);
    expect(v.bOut).toBe(v.c);
  });

  test("the OLD default of 3 does not — the control that justifies the raise", async () => {
    const { runner } = chain();
    const r = await regenToFixpoint(pairs, runner, 3);
    expect(r.passes).toBe(3);
    expect(r.settled).toBe(false);
    // ...and under the old CLI, which dropped `settled`, this exited 0.
    expect(exitCodeFor({ results: r.results, settled: r.settled, passes: 3 }).code).toBe(2);
  });

  test("`not settled` means UNVERIFIED, which is why it cannot be read as stale either", async () => {
    // Asserted because it is the easy thing to get backwards, including in
    // this test file on the first try. At the cap the third pass had just
    // repaired A, so the tree happens to be correct — but no pass confirmed
    // it, and the pairs were last read while a writer was running. The tool
    // therefore reports "could not determine" and NOT "stale": claiming
    // either would be a verdict it has no evidence for.
    const { v, runner } = chain();
    const r = await regenToFixpoint(pairs, runner, 3);
    expect(v.aOut).toBe(v.c); // in fact repaired
    expect(r.settled).toBe(false); // and in fact unconfirmed
    expect(exitCodeFor({ results: r.results, settled: r.settled, passes: 3 }).reason).toBe("not-settled");
  });

  test("a chain one deeper than the measurement is genuinely stale at the old cap", async () => {
    // The same shape with a fourth link, so the cap bites before the last
    // writer runs: here the tree really is wrong when it gives up.
    const v = { d: 1, dOut: 0, cOut: 0, bOut: 0, aOut: 0 };
    const s: Record<string, () => boolean> = {
      "a:check": () => v.aOut === v.bOut,
      a: () => ((v.aOut = v.bOut), true),
      "b:check": () => v.bOut === v.cOut,
      b: () => ((v.bOut = v.cOut), true),
      "c:check": () => v.cOut === v.dOut,
      c: () => ((v.cOut = v.dOut), true),
      "d:check": () => v.dOut === v.d,
      d: () => ((v.dOut = v.d), true),
    };
    const deep = ["a", "b", "c", "d"].map((n) => ({ check: `${n}:check`, writer: n }));
    const r = await regenToFixpoint(deep, ((x) => s[x]!()) as Runner, 3);
    expect(r.settled).toBe(false);
    expect(v.aOut).not.toBe(v.d); // still stale, and the old CLI exited 0
    const better = await regenToFixpoint(deep, ((x) => s[x]!()) as Runner);
    expect(better.settled).toBe(true);
    expect(v.aOut).toBe(v.d);
  });

  test("DEFAULT_MAX_PASSES admits more writer passes than the deepest chain measured", () => {
    // A pass is settled only when it ran NO writer, so a cap of N admits N-1
    // writer passes. The measured need was 3.
    expect(DEFAULT_MAX_PASSES - 1).toBeGreaterThan(3);
  });

  test("--max-passes is read from argv, and a bad value is refused rather than defaulted", () => {
    expect(maxPassesFromArgv(["--max-passes", "9"])).toBe(9);
    expect(maxPassesFromArgv(["--max-passes=9"])).toBe(9);
    expect(maxPassesFromArgv([])).toBe(DEFAULT_MAX_PASSES);
    // A silent fallback here would re-create the defect one level up: the run
    // would use a bound nobody asked for and report its result as settled.
    for (const bad of ["0", "-1", "two", undefined]) {
      expect(() => maxPassesFromArgv(["--max-passes", ...(bad === undefined ? [] : [bad])])).toThrow("--max-passes");
    }
  });
});

describe("a writer must WRITE — bean `i1q7`", () => {
  test("translate-bpmn:bootstrap is the convention writer, and it extracts when run bare", () => {
    // It printed "Nothing to do. Pass --extract…" and exited 2, so regen ran it,
    // the check stayed red, and the verdict was "a real defect, not staleness".
    expect(writerFor(SCRIPTS, "translate-bpmn:bootstrap:check")).toBe("translate-bpmn:bootstrap");
    expect(SCRIPTS["translate-bpmn:bootstrap"]).toContain("--extract");
  });

  test("check:published-instance-exports is repaired by re-exporting the bootstrap instance", () => {
    expect(writerFor(SCRIPTS, "check:published-instance-exports")).toBe("kg:export:bootstrap");
    expect(SCRIPTS["kg:export:bootstrap"]).toMatch(/kg-export\.ts --instance \.\/bootstrap$/);
  });

  test("a writer that exits non-zero is reported `writer-failed`, not as a defect in the tree", async () => {
    const runner: Runner = (s) => (s === "x:check" ? false : s !== "x");
    const { results } = await regenPass([{ check: "x:check", writer: "x" }], runner);
    expect(results).toEqual([{ check: "x:check", writer: "x", outcome: "writer-failed" }]);
  });

  test("a writer that exits 0 and changes nothing stays `unrepaired`", async () => {
    const runner: Runner = (s) => s !== "x:check";
    expect((await regenPass([{ check: "x:check", writer: "x" }], runner)).results[0]!.outcome).toBe("unrepaired");
  });
});

describe("the default asks the WHOLE gate set — bean `i1q7`, item 3", () => {

  test("without a browser, a browser-job failure is `no-browser`, and a fast-set failure keeps its verdict", () => {
    const results = [
      { check: "render:bpmn:check", writer: "render:bpmn", outcome: "unrepaired" as const },
      { check: "voices:viz:check", writer: "voices:viz", outcome: "unrepaired" as const },
      { check: "bat:sync:check", writer: "bat:sync", outcome: "regenerated" as const },
    ];
    const fast = new Set(["voices:viz:check"]);
    expect(relabelForMissingBrowser(results, fast, false).map((r) => r.outcome)).toEqual([
      "no-browser",
      "unrepaired",
      "regenerated",
    ]);
    expect(relabelForMissingBrowser(results, fast, true)).toEqual(results);
  });
});

// Bean `wczm` item 1: regen-vs-CI parity for the gates merge trains 2 and 3
// found unrepairable (#1876, #1883). Each must reach regen from the REAL
// workflow, with a writer that exists — or regen calls the tree current and CI
// goes red on it.
describe("regen can repair what trains 2 and 3 could not — bean wczm", () => {
  const pairs = repairableGates(loadGates(REPO, {}), SCRIPTS);
  test.each([
    ["check:l1-complete:check", "l1-complete:write"],
    // The second pair, `smart-base:smart-kg-l1:check` / `:all`, left with
    // smart-base at the SMART separation cutover (bean `hupw`): the gate now
    // belongs to litlfred/smart-base, which owns the content it checked.
  ] as const)("%s is a gate regen asks, and %s is its writer", (check, writer) => {
    expect(pairs.find((p) => p.check === check)).toEqual({ check, writer });
    expect(SCRIPTS[writer]).toBeDefined();
  });
});

describe("a NEW outcome cannot quietly become clean — bean `g5kt` x `i1q7`", () => {
  /**
   * The merge of 2026-10-04 is the reason this exists.
   *
   * `exitCodeFor` landed listing its failures — `unrepaired` and `no-writer`.
   * `i1q7` then added `writer-failed` and `no-browser` on `main`. Two lists of
   * failures, authored a day apart, and the resolution had to notice that the
   * newer two belonged in the older list. Nothing would have failed if it had
   * not: they would simply have exited 0.
   *
   * So the question is asked of EVERY outcome, and the map below is
   * `Record<Outcome, …>` on purpose — add a seventh outcome and this file
   * stops compiling until somebody says which side it falls on.
   */
  const CLEAN: Record<Outcome, boolean> = {
    current: true,
    regenerated: true,
    judged: true,
    unrepaired: false,
    "no-writer": false,
    "writer-failed": false,
    "no-browser": false,
  };

  test.each((Object.entries(CLEAN) as [Outcome, boolean][]).map(([o, c]) => [o, c ? "exits 0" : "does NOT exit 0", c] as const))("%s %s", (outcome, _label, clean) => {
    const v = exitCodeFor({ results: [{ check: "x:check", writer: "x", outcome }], settled: true });
    if (clean) expect(v.code).toBe(0);
    else expect(v.code).not.toBe(0);
  });

  test("a run holding only clean outcomes is clean", () => {
    const results: Result[] = [
      { check: "a:check", writer: "a", outcome: "current" },
      { check: "b:check", writer: "b", outcome: "regenerated" },
    ];
    expect(exitCodeFor({ results, settled: true })).toEqual({ code: 0, reason: "clean" });
  });

  test("no-browser keeps i1q7's exit code, but is not called a defect in the tree", () => {
    // The wording matters because the one-size message said every failure was
    // something "a generator cannot fix" — which misdescribes a machine that
    // merely has no Chromium. The COUNT stays i1q7's; only the prose splits.
    const v = exitCodeFor({
      results: [{ check: "render:bpmn:check", writer: "render:bpmn", outcome: "no-browser" }],
      settled: true,
    });
    expect(v.code).toBe(1);
    expect(v.message).toContain("COULD NOT BE DETERMINED");
    expect(v.message).toContain("render:bpmn:check");
    expect(v.message).not.toContain("cannot fix a defect");
  });

  test("a real defect and a missing browser in one run are reported as BOTH, not as one", () => {
    const v = exitCodeFor({
      results: [
        { check: "a:check", writer: "a", outcome: "unrepaired" },
        { check: "render:bpmn:check", writer: "render:bpmn", outcome: "no-browser" },
      ],
      settled: true,
    });
    expect(v.code).toBe(1);
    expect(v.message).toContain("cannot fix a defect");
    expect(v.message).toContain("COULD NOT BE DETERMINED");
  });
});

describe("a caller holding only regen's exit CODE is told the truth (task #62)", () => {
  // The defect this pins: `merge-base.ts` had ONE message for every non-zero
  // exit — "the gate set could not reproduce the resolution (regen reported
  // unrepaired checks)". `exitCodeFor` above returns three distinct verdicts,
  // so that sentence was false in three of the four cases a caller can see.
  // The abort was right every time; only the recorded reason was wrong, and
  // the abort line is the one place the reason is written down.

  test("exit 2 is COULD NOT DETERMINE, and says regen reported no unrepaired check", () => {
    const m = regenExitMeaning(2);
    expect(m.verdict).toBe("not-settled");
    expect(m.determined).toBe(false);
    expect(m.why).toContain("COULD NOT DETERMINE");
    // The precise falsehood being removed: the old message asserted unrepaired
    // checks for exactly this exit, where regen reported none.
    expect(m.why).toContain("NO unrepaired check");
  });

  test("exit 1 does not name ONE kind, because the code cannot tell them apart", () => {
    const m = regenExitMeaning(1);
    expect(m.verdict).toBe("not-staleness");
    expect(m.determined).toBe(true);
    // All four kinds are named, so a caller cannot honestly report one of them
    // as the cause: `no-browser` is a could-not-determine and `writer-failed`
    // is a verdict about the tool, not the tree (bean `i1q7`).
    for (const kind of ["unrepaired", "no-writer", "writer-failed", "no-browser"]) {
      expect(m.why).toContain(kind);
    }
  });

  test("an exit outside regen's own three verdicts is a CRASH, not a measurement", () => {
    for (const code of [3, 127, 137]) {
      const m = regenExitMeaning(code);
      expect(m.verdict).toBe("crashed");
      expect(m.determined).toBe(false);
      expect(m.why).toContain(String(code));
      expect(m.why).toContain("nothing was measured");
    }
  });

  test("a signal (status null) is a crash too, and does not read as code 0", () => {
    const m = regenExitMeaning(null);
    expect(m.verdict).toBe("crashed");
    expect(m.determined).toBe(false);
    expect(m.why).toContain("on a signal");
  });

  test("exit 0 is the only clean verdict", () => {
    const m = regenExitMeaning(0);
    expect(m.verdict).toBe("clean");
    expect(m.determined).toBe(true);
  });

  test("every code exitCodeFor can return decodes to the reason that produced it", () => {
    // The two functions are inverses over the codes `exitCodeFor` actually
    // emits, which is the property that keeps a caller's report true as the
    // verdict set grows. Each case is built from `exitCodeFor` rather than
    // from a literal, so adding a verdict there fails HERE.
    const cases = [
      { run: { results: [], settled: true }, expect: "clean" },
      {
        run: { results: [{ check: "a:check", writer: "a", outcome: "unrepaired" as Outcome }], settled: true },
        expect: "not-staleness",
      },
      { run: { results: [], settled: false }, expect: "not-settled" },
    ] as const;
    for (const c of cases) {
      expect(regenExitMeaning(exitCodeFor(c.run).code).verdict).toBe(c.expect);
    }
  });

  test("merge-base composes its abort from the TAG, not from matched prose", () => {
    // The verdict crosses a module boundary: merge-base prints it and
    // merge-main-comment reads it back out of the captured log to decide
    // whether the PR's comment says "Error" or "Could not determine". If
    // somebody hand-writes the sentence again the pair breaks silently, so
    // the pairing is pinned at the source.
    const mergeBase = readFileSync(join(import.meta.dir, "..", "..", "merge-base.ts"), "utf-8");
    expect(mergeBase).toContain("REGEN_VERDICT_TAG");
    expect(mergeBase).toContain("regenExitMeaning");
    // And the false sentence does not come back.
    expect(mergeBase).not.toContain("regen reported unrepaired checks)");
    const comment = readFileSync(join(import.meta.dir, "..", "..", "merge-main-comment.ts"), "utf-8");
    expect(comment).toContain("REGEN_VERDICT_TAG");
    expect(REGEN_VERDICT_TAG).toBe("regen-verdict:");
  });
});

describe("judge-mode pairs are distinguished from artefact staleness checks — bean loxz", () => {
  test("audit:coverage:strict and audit:coverage:require-all are declared in NO_WRITER", () => {
    expect(NO_WRITER["audit:coverage:strict"]).toBeDefined();
    expect(NO_WRITER["audit:coverage:strict"]).toContain("judge-mode baseline check");
    expect(NO_WRITER["audit:coverage:require-all"]).toBeDefined();
    expect(NO_WRITER["audit:coverage:require-all"]).toContain("judge-mode baseline check");
  });

  test("JUDGE_CHECKS and isJudgeCheck identify judge-mode gates", () => {
    // The set and the predicate are one answer: every listed check is judged.
    for (const c of JUDGE_CHECKS) expect(isJudgeCheck(c)).toBe(true);
    expect(isJudgeCheck("audit:coverage:strict")).toBe(true);
    expect(isJudgeCheck("audit:coverage:require-all")).toBe(true);
    expect(isJudgeCheck("voices:viz:check")).toBe(false);
    expect(isJudgeCheck("custom:check", { check: "custom:check", writer: undefined, judge: true })).toBe(true);
  });

  test("a judge-mode check that passes is reported as 'judged', NEVER 'current'", async () => {
    const runner: Runner = (cmd) => cmd === "audit:coverage:strict";
    const res = await regenPass(
      [{ check: "audit:coverage:strict", writer: undefined, judge: true }],
      runner,
    );
    expect(res.results).toHaveLength(1);
    expect(res.results[0]!.outcome).toBe("judged");
    expect(res.results[0]!.outcome).not.toBe("current");
  });

  test("a run holding passing judge-mode checks yields clean exit 0 with outcome 'judged'", async () => {
    const runner: Runner = () => true;
    const { results, settled } = await regenToFixpoint(
      [{ check: "audit:coverage:strict", writer: undefined, judge: true }],
      runner,
    );
    expect(settled).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0]!.outcome).toBe("judged");
    const exit = exitCodeFor({ results, settled });
    expect(exit.code).toBe(0);
    expect(exit.reason).toBe("clean");
  });

  test("a stale artefact for a judge-mode pair is NOT reported as current", async () => {
    // When a judge-mode check passes (e.g. baseline check exits 0 against qa-reports),
    // it must not be reported as "current".
    const runner: Runner = () => true;
    const { results } = await regenToFixpoint(
      [{ check: "audit:coverage:strict", writer: undefined }],
      runner,
    );
    expect(results[0]!.outcome).toBe("judged");
    expect(results[0]!.outcome).not.toBe("current");
  });

  test("audit-coverage in writer mode refuses to write sidecar when undetermined graphs exist", () => {
    // Bean loxz: an unmounted tree must not leave a committed sidecar that
    // drops unmounted graphs as undetermined.
    const auditScript = readFileSync(join(import.meta.dir, "..", "..", "audit-coverage.ts"), "utf-8");
    expect(auditScript).toContain("Refusing to write audit-coverage.qa-results.json");
    expect(auditScript).toContain("undet.length > 0");
  });
});


// folio-assistant#2247, gap 3: a bare `regen` graded an unmounted branch-kept
// graph as a real defect. It now mounts first; only a caller that has just
// mounted — `merge:main` — opts out.
describe("regen mounts the branch-kept graphs before it grades", () => {
  test("by default", () => {
    expect(mountFirst(["bun", "regen-after-merge.ts"])).toBe(true);
    expect(mountFirst(["bun", "regen-after-merge.ts", "--dry-run", "--fast"])).toBe(true);
  });
  test("not with --no-mount", () => {
    expect(mountFirst(["bun", "regen-after-merge.ts", "--no-mount"])).toBe(false);
  });
  test("merge:main, which has just mounted against the merged declarations, passes --no-mount on both paths", () => {
    expect(mountFirst(["bun", "x", ...regenArgs(undefined)])).toBe(false);
    expect(mountFirst(["bun", "x", ...regenArgs("abc123")])).toBe(false);
    expect(regenArgs("abc123")).toContain("--changed");
    expect(regenArgs("abc123")[regenArgs("abc123").indexOf("--changed") + 1]).toBe("abc123");
  });
});

describe("bean p7mb — glossary:check and libraries:check pair with their writers via WRITER_OVERRIDES", () => {
  test("WRITER_OVERRIDES maps glossary:check to glossary:export and libraries:check to libraries:derive", () => {
    expect(WRITER_OVERRIDES["glossary:check"]).toBe("glossary:export");
    expect(WRITER_OVERRIDES["libraries:check"]).toBe("libraries:derive");
    expect(writerFor(SCRIPTS, "glossary:check")).toBe("glossary:export");
    expect(writerFor(SCRIPTS, "libraries:check")).toBe("libraries:derive");
  });
});
