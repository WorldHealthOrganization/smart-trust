import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  declaredDiagrams,
  invocationBefore,
  decisionReach,
  entrypointsIn,
  executableShape,
  isTestModule,
  moduleReach,
  processReach,
} from "../audit-reachability.ts";
import { loadDecisionTable, unreadableExpressions } from "../../src/workflow/decision-table.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

// A real-corpus sweep: about five seconds already (4.5-4.7 s measured on
// main), past bun's 5s default once global tasks are indexed too.
const CORPUS_TIMEOUT = 60_000;

const HARNESS = resolve(HARNESS_ROOT);
const REPO = repoRootFor(HARNESS);

/**
 * These tests are about ONE distinction, in three places:
 * **a thing that loads is not a thing that can be reached.**
 *
 * `merge-priority.dmn` loaded for two months while no caller could evaluate it,
 * and `merge-queue.ts` had a test proving it worked and nothing that ran it.
 * Nothing here pins either defect's presence — both are fixed on another branch
 * — so every assertion is about the MECHANISM, which is what has to survive.
 */

/** XML text, so a `<=` in a unary test does not make the fixture unparsable. */
const xml = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A one-rule table, written to a temp file, so the grammar can be probed directly. */
function tableWith(inputEntry: string, outputEntry = '"ok"'): string {
  const dir = mkdtempSync(join(tmpdir(), "reach-dmn-"));
  const p = join(dir, "probe.dmn");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="Defs" name="probe" namespace="http://probe">
  <decision id="Decision_Probe" name="Probe">
    <decisionTable id="T" hitPolicy="FIRST">
      <input id="I1" label="fact"><inputExpression id="E1" typeRef="string"><text>fact</text></inputExpression></input>
      <output id="O1" name="outcome" typeRef="string"/>
      <rule id="Rule_Probe">
        <inputEntry id="IE1"><text>${xml(inputEntry)}</text></inputEntry>
        <outputEntry id="OE1"><text>${xml(outputEntry)}</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>
`,
  );
  return p;
}

describe("evaluability is not loadability", () => {
  test("a table that LOADS can still be unevaluable — the whole premise, in one table", async () => {
    // A RANGE, not `not("green")`. The defect that started this was
    // `not("green")` in `merge-priority.dmn`, and #1952 implemented `not(...)`
    // — which broke an earlier version of this very test, the one asserting
    // that expression unreadable. That was the test pinning a DEFECT instead
    // of the MECHANISM, which this file's own header warns against, and it is
    // worth the paragraph: a fixture must exercise the BOUNDARY of the subset,
    // never the one expression somebody is about to move inside it. Ranges are
    // refused by `decision-table.ts`'s documented subset and are on nobody's
    // roadmap.
    const p = tableWith("[1..5]");
    try {
      // The loader is happy: nothing in it looks inside a rule's cells.
      const table = await loadDecisionTable(p, "Decision_Probe");
      expect(table.rules).toHaveLength(1);
      // The evaluability question is the one that fails.
      const bad = unreadableExpressions(table);
      expect(bad).toHaveLength(1);
      expect(bad[0]!.side).toBe("input");
      expect(bad[0]!.of).toBe("fact");
      expect(bad[0]!.rule).toBe("Rule_Probe");
      // The evaluator's OWN message, never a restatement of it.
      expect(bad[0]!.message).toContain("this evaluator does not implement");
    } finally {
      rmSync(p, { recursive: true, force: true });
    }
  });

  test("the supported subset is clean — otherwise this check would fail every table", async () => {
    // `not("green")` is in this list as of #1952, which implemented it. The
    // subset is whatever `decision-table.ts` says it is TODAY, and this list
    // moves with it rather than freezing yesterday's answer.
    for (const entry of ["-", '"green"', "> 0", "<= 2", "= 5", "true", '"a", "b"', "1, 2, 3", 'not("green")', 'not("a", "b")']) {
      const p = tableWith(entry);
      try {
        expect(unreadableExpressions(await loadDecisionTable(p, "Decision_Probe"))).toEqual([]);
      } finally {
        rmSync(p, { recursive: true, force: true });
      }
    }
  });

  test("an unreadable atom AFTER a matching one is still found — `unaryTest`'s `some` would stop early", async () => {
    // This is why the walk splits the list itself instead of handing the whole
    // test to `unaryTest`: `0` matches the probe, and `.some()` would return
    // before ever reading `[1..5]`.
    const p = tableWith("0, [1..5]");
    try {
      const bad = unreadableExpressions(await loadDecisionTable(p, "Decision_Probe"));
      expect(bad).toHaveLength(1);
      expect(bad[0]!.expression).toContain("[1..5]");
      // ...and it names the list it sits in, so a reader can find the cell.
      expect(bad[0]!.expression).toContain("0, [1..5]");
    } finally {
      rmSync(p, { recursive: true, force: true });
    }
  });

  test("an unreadable OUTPUT literal is found — `possibleOutcomes` reads the first column only", async () => {
    const p = tableWith('"green"', "green");
    try {
      const bad = unreadableExpressions(await loadDecisionTable(p, "Decision_Probe"));
      expect(bad).toHaveLength(1);
      expect(bad[0]!.side).toBe("output");
      expect(bad[0]!.of).toBe("outcome");
    } finally {
      rmSync(p, { recursive: true, force: true });
    }
  });

  test("a comparison against a non-numeric literal can never evaluate, for any fact", async () => {
    const p = tableWith('> "a"');
    try {
      expect(unreadableExpressions(await loadDecisionTable(p, "Decision_Probe"))).toHaveLength(1);
    } finally {
      rmSync(p, { recursive: true, force: true });
    }
  });
});

describe("the declared corpus is the denominator", () => {
  test("the union over instances is non-empty, and wider than one instance's scope", () => {
    const { bpmn, dmn, instances } = declaredDiagrams(REPO);
    // A sweep that examined nothing passes every assertion below it.
    expect(bpmn.length).toBeGreaterThan(0);
    expect(dmn.length).toBeGreaterThan(0);
    expect(instances.length).toBeGreaterThan(1);
  });

  test("every declared decision lands in exactly one state, with evidence when it is not clean", async () => {
    const { bpmn, dmn } = declaredDiagrams(REPO);
    const { decisionRefs } = await processReach(REPO, bpmn);
    const rows = await decisionReach(REPO, dmn, decisionRefs);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(["evaluable", "unevaluable", "unloadable"]).toContain(r.state);
      // Could-not-determine is never rendered as clean: a non-clean state must
      // carry its own evidence, or the report would name a file and say nothing.
      if (r.state === "unevaluable") expect(r.unreadable.length).toBeGreaterThan(0);
      if (r.state === "unloadable") expect(r.why).toBeTruthy();
      if (r.state === "evaluable") expect(r.unreadable).toEqual([]);
    }
  }, CORPUS_TIMEOUT);
});

describe("a diagram the resolver cannot reach", () => {
  test("every declared .bpmn gets a state, and an unreachable one says why", async () => {
    const { bpmn } = declaredDiagrams(REPO);
    const { rows, ambiguous } = await processReach(REPO, bpmn);
    expect(rows).toHaveLength(bpmn.length);
    for (const r of rows) {
      expect(["reachable", "shadowed", "unloadable", "shared"]).toContain(r.state);
      if (r.state !== "reachable") expect(r.why).toBeTruthy();
      else expect(r.process).toBeTruthy();
    }
    // Ambiguity is a finding about names, so each entry must name the clash.
    for (const a of ambiguous) {
      expect(["stem", "process-id"]).toContain(a.on);
      expect(a.files.length).toBeGreaterThan(1);
    }
  }, CORPUS_TIMEOUT);
});

describe("@entrypoint tells a use from a mention", () => {
  test("only a declaration at exactly one space past the star counts", () => {
    expect(entrypointsIn(" * @entrypoint script:merge:steward\n")).toEqual(["script:merge:steward"]);
    // A docblock that DOCUMENTS the tag necessarily contains the tag. These are
    // the forms this script's own header shows as examples, and reading them as
    // declarations is `coversIn`'s recorded failure wearing a new tag.
    expect(entrypointsIn(" *     @entrypoint script:example\n")).toEqual([]);
    expect(entrypointsIn(" *   @entrypoint continuation line\n")).toEqual([]);
    expect(entrypointsIn("// @entrypoint not a docblock\n")).toEqual([]);
  });

  test("this script's own docblock declares nothing, though it shows three examples", () => {
    const src = Bun.file(join(TOOLS_ROOT, "scripts", "audit-reachability.ts"));
    return src.text().then((t) => expect(entrypointsIn(t)).toEqual([]));
  });
});

describe("the subject is a declaration, not a guess", () => {
  test("a module is only examined when it SAYS it is runnable", () => {
    expect(executableShape("#!/usr/bin/env bun\nexport const x = 1;\n")).toEqual({ shebang: true, mainGuard: false });
    expect(executableShape("if (import.meta.main) run();\n")).toEqual({ shebang: false, mainGuard: true });
    expect(executableShape("export const x = 1;\n")).toBeUndefined();
  });

  test("test files are not entry points, by either convention", () => {
    expect(isTestModule("cat-harness/scripts/tests/x.ts")).toBe(true);
    expect(isTestModule("cat-harness/schemas/x.test.ts")).toBe(true);
    expect(isTestModule("cat-harness/test/x.e2e.ts")).toBe(true);
    expect(isTestModule("cat-harness/scripts/x.ts")).toBe(false);
  });

  test("the corpus is swept, every row carries its shape, and an orphan is imported by no non-test module", () => {
    const { rows, modules, executables } = moduleReach(REPO);
    // The denominators, because a sweep over nothing passes everything.
    expect(modules).toBeGreaterThan(100);
    expect(executables).toBeGreaterThan(10);
    expect(rows).toHaveLength(executables);
    for (const r of rows) {
      expect(r.shape.shebang || r.shape.mainGuard).toBe(true);
      if (r.state === "invoked") expect(r.via).toBeTruthy();
      if (r.state === "declared") expect(r.entrypoints!.length).toBeGreaterThan(0);
      // The two unrun states must stay distinguishable: an orphan exists only
      // as a claim, a latent one is a dead branch on a live library.
      if (r.state === "entry-point-orphan") expect(r.importers).toEqual([]);
      if (r.state === "entry-point-latent") expect(r.importers.length).toBeGreaterThan(0);
    }
  });

  test("this gate is itself reached — the self-test the first run failed", () => {
    const { rows } = moduleReach(REPO);
    const self = rows.find((r) => r.file.endsWith("scripts/audit-reachability.ts"));
    expect(self).toBeDefined();
    // It reported ITSELF as an orphan until it was wired into `package.json`,
    // which is the cheapest possible falsification of the check.
    expect(self!.state).toBe("invoked");
  });

  test("an invocation must stand CLOSE BEFORE the path, not merely on the same line", () => {
    const at = (line: string, path: string): boolean => invocationBefore(line, line.indexOf(path));
    // A real invocation puts them next to each other.
    expect(at("          run: bun run cat-harness/scripts/minify-site.ts", "cat-harness/")).toBe(true);
    expect(at('execFileSync("bun", ["run", "scripts/x.ts"])', "scripts/x.ts")).toBe(true);
    expect(at('invoke: inProcess("src/tools/workflow.ts", "workflow_list")', "src/tools/")).toBe(true);

    // PROSE ABOUT A FINDING MUST NOT CLEAR IT. This is the measured defect:
    // the artefact-verification declaration that this gate obliged its author
    // to write says that a diagram names `scripts/merge-queue.ts` in prose,
    // and on one long JSON line that sentence counted as a caller.
    const prose =
      "it spawns a probe; and a module named only in a diagram's documentation is not " +
      "credited as reached -- `merge-train.bpmn` and `merge-priority.dmn` both name " +
      "`scripts/merge-queue.ts` in prose, which is not running it.";
    expect(prose).toContain("spawns"); // the token really is on the line
    expect(at(prose, "scripts/merge-queue.ts")).toBe(false);
  });

  test("the tokens are anchored at BOTH ends — `executable` and `denominators` are not invocations", () => {
    // Both fired in the measured false positive, and any docblock on this
    // subject is certain to contain them.
    expect(invocationBefore("a self-declared executable at scripts/x.ts", "a self-declared executable at ".length)).toBe(false);
    expect(invocationBefore("both denominators, then scripts/x.ts", "both denominators, then ".length)).toBe(false);
    // ...while the real binaries still count.
    expect(invocationBefore("node scripts/x.ts", "node ".length)).toBe(true);
    expect(invocationBefore("deno run scripts/x.ts", "deno run ".length)).toBe(true);
  });

  test("a module named only in a diagram's documentation is NOT counted as reached", () => {
    // `merge-train.bpmn` and `merge-priority.dmn` both name `merge-queue.ts` in
    // their `<bpmn:documentation>`, and the generated glossary carries that
    // prose onward. A grep over mentions clears finding 1; requiring an
    // invocation verb on the line does not.
    const { rows } = moduleReach(REPO);
    const mq = rows.find((r) => r.file.endsWith("scripts/merge-queue.ts"));
    // It may be `invoked` once a steward CLI lands, or `declared` once it says
    // how it is reached — but never credited by prose, which is what `via`
    // pointing at a `.bpmn` or a glossary file would mean.
    if (mq?.state === "invoked") expect(mq.via).not.toMatch(/\.(bpmn|dmn)$|glossary/);
  });
});
