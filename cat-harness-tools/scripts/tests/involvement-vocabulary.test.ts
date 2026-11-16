/**
 * `<cat-harness.processes:involvement vocabulary="…"/>` — RACI's four letters or RASCI's five.
 *
 * @module scripts/tests/involvement-vocabulary
 * @graphNode none — a test
 *
 * Issue #1004. **The load-bearing cases here are the refusals**, for the
 * reason this whole change exists: until 2026-09-23 an involvement outside the
 * vocabulary was filtered out inside `loadProcessModel` and the comment at the
 * filter claimed `check:raci` reported it. Nothing did — the rejects were gone
 * before any row was built, and `process-model.ts` was the only reader of the
 * raw element, so no other consumer could have caught them either.
 *
 * A test that only showed the corpus passing would have passed throughout that
 * entire period. So every case below is about what happens to a value the
 * vocabulary does not admit.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  INVOLVEMENT_VOCABULARIES,
  RACI_INVOLVEMENTS,
  RASCI_INVOLVEMENTS,
  loadProcessModel,
} from "../../src/workflow/process-model.js";
import { raciBreaches, raciRowsOf } from "../raci-chart.js";

/**
 * One activity in one lane, with whatever process-level extension the case
 * needs and whatever involvement it declares.
 */
function fixture(processExt: string, involvement: string): string {
  const dir = mkdtempSync(join(tmpdir(), "involvement-"));
  const p = join(dir, "p.bpmn");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_T" name="T" isExecutable="false">
    <bpmn:extensionElements>${processExt}</bpmn:extensionElements>
    <bpmn:laneSet id="LaneSet_T">
      <bpmn:lane id="Lane_T" name="Doer">
        <bpmn:extensionElements><bootstrap.processes:role ref="a-role"/></bpmn:extensionElements>
        <bpmn:flowNodeRef>Start_T</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>A_T</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_T" name="Start"/>
    <bpmn:task id="A_T" name="Do the thing">
      <bpmn:extensionElements>
        <cat-harness.processes:raci ref="a-role" involvement="accountable"/>
        <cat-harness.processes:raci ref="b-role" involvement="${involvement}"/>
      </bpmn:extensionElements>
    </bpmn:task>
  </bpmn:process>
</bpmn:definitions>
`,
  );
  return p;
}

const ROLES = new Set(["a-role", "b-role"]);

describe("the vocabulary is a CHOICE, so choosing the other one is refused", () => {
  test("`supportive` in a four-letter process is REPORTED, not accepted and not dropped", async () => {
    // The case the whole issue is about. Before this change: `raci` came back
    // with one entry, the `supportive` vanished, and nothing anywhere said so.
    const m = await loadProcessModel(fixture("", "supportive"));
    const n = m.nodes.get("A_T")!;

    expect(m.involvementVocabulary, "absent declaration must mean raci").toBe("raci");
    expect(n.raci.map((r) => r.involvement), "the legal one survives").toEqual(["accountable"]);
    expect(n.raciUnknown, "and the illegal one is RECORDED rather than discarded").toEqual([
      { role: "b-role", involvement: "supportive" },
    ]);

    const breaches = raciBreaches(raciRowsOf(m), ROLES);
    expect(breaches.map((b) => b.kind)).toEqual(["involvement-unknown"]);
    // The message has to name the way out, or the finding is a dead end.
    expect(breaches[0]!.detail).toContain('vocabulary="rasci"');
  });

  test("the SAME diagram is clean once the process declares `rasci`", async () => {
    // Same activity, same annotation — only the process-level declaration
    // differs. That is what makes this a vocabulary rather than a spelling
    // rule.
    const m = await loadProcessModel(
      fixture('<cat-harness.processes:involvement vocabulary="rasci"/>', "supportive"),
    );
    const n = m.nodes.get("A_T")!;

    expect(m.involvementVocabulary).toBe("rasci");
    expect(n.raciUnknown).toEqual([]);
    expect(n.raci).toContainEqual({ role: "b-role", involvement: "supportive" });
    expect(raciBreaches(raciRowsOf(m), ROLES)).toEqual([]);
  });

  test("a TYPO is reported the same way, and is never coerced to a neighbour", async () => {
    // The original reason for not coercing, preserved: `consultd` read as
    // `informed` would put somebody on a notification list who was meant to be
    // asked. Not-coerced was always right; not-recorded never was.
    const m = await loadProcessModel(fixture("", "consultd"));
    const n = m.nodes.get("A_T")!;

    expect(n.raci.map((r) => r.involvement)).toEqual(["accountable"]);
    expect(n.raciUnknown).toEqual([{ role: "b-role", involvement: "consultd" }]);
    expect(n.raci.some((r) => r.role === "b-role")).toBe(false);

    const breaches = raciBreaches(raciRowsOf(m), ROLES);
    expect(breaches.map((b) => b.kind)).toEqual(["involvement-unknown"]);
    // A typo gets the spelling advice, NOT the rasci advice.
    expect(breaches[0]!.detail).not.toContain('vocabulary="rasci"');
  });

  test("an activity whose involvements are ALL unknown is still reported", async () => {
    // The sharpest form of the old bug. `raciRowsOf` skipped on
    // `raci.length === 0`, so an activity annotated entirely wrongly looked
    // exactly like one that was never annotated — the state most worth
    // reporting was the one guaranteed to be silent.
    const dir = mkdtempSync(join(tmpdir(), "involvement-allbad-"));
    const p = join(dir, "p.bpmn");
    writeFileSync(
      p,
      `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_T" name="T" isExecutable="false">
    <bpmn:startEvent id="Start_T" name="Start"/>
    <bpmn:task id="A_T" name="Do the thing">
      <bpmn:extensionElements><cat-harness.processes:raci ref="a-role" involvement="acountable"/></bpmn:extensionElements>
    </bpmn:task>
  </bpmn:process>
</bpmn:definitions>
`,
    );
    const m = await loadProcessModel(p);
    expect(m.nodes.get("A_T")!.raci).toEqual([]);
    expect(raciRowsOf(m), "an all-typo activity must not read as unannotated").toHaveLength(1);
    expect(raciBreaches(raciRowsOf(m), ROLES).map((b) => b.kind)).toContain("involvement-unknown");
  });

  test("an undeclared vocabulary THROWS rather than falling back to four letters", async () => {
    // Same posture as `folio:policy` and `folio:bean op`. A silent fallback
    // would be indistinguishable from having chosen raci deliberately, which
    // is the one thing a choice must never be.
    await expect(loadProcessModel(fixture('<cat-harness.processes:involvement vocabulary="racsi"/>', "informed"))).rejects.toThrow(
      /not a declared vocabulary/,
    );
  });
});

describe("the vocabularies themselves", () => {
  test("rasci is raci plus exactly `supportive`", () => {
    // Derived, not restated — so a letter added to RACI cannot go missing
    // from RASCI.
    expect(RASCI_INVOLVEMENTS).toEqual([...RACI_INVOLVEMENTS, "supportive"]);
  });

  test("neither vocabulary admits `responsible` — the lane carries it", () => {
    // If this ever flips, `supportive` loses its discriminator and the whole
    // argument for the fifth letter collapses. Pinned here rather than left
    // to the docstring.
    for (const v of Object.values(INVOLVEMENT_VOCABULARIES)) {
      expect(v as readonly string[]).not.toContain("responsible");
    }
  });

  test("the real corpus declares no vocabulary, so nothing changed meaning", async () => {
    // The inertness claim, checked. Every existing diagram predates the
    // element, so all of them must resolve to `raci`.
    const { raciRows } = await import("../raci-chart.js");
    for (const r of await raciRows()) expect(r.vocabulary).toBe("raci");
  });
});
