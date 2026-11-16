/**
 * A call activity whose target is hosted by another layer in the repository
 * resolves as a pass, not unknown.
 *
 * A test about the WHOLE CHECKOUT, so it lives in the root `test/` rather than
 * `cat-harness/scripts/tests/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): it audits `folio-assistant-core` and expects `cat-harness` to
 * host the processes it calls, which only the checkout holds. Standing alone,
 * cat-harness has neither, and `check:cat-harness-standalone` collects every
 * test in that layer. Paths are composed from ORIGIN_DIR, the directory it was
 * written in, so nothing it reads changed in the move.
 *
 * @module test/kg-audit-call-activity-parent
 * @covers folio-assistant-t5j5
 */
import { describe, expect, test } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** The directory this test was written in (`cat-harness/scripts/tests/`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");
const REPO = resolve(ORIGIN_DIR, "../../..");

describe("kg-audit: call-activity-resolves across repository instances (bean `t5j5`)", () => {
  test("a call activity whose target resolves from the parent root is a PASS with hosting instance evidence", async () => {
    const p = Bun.spawn(
      ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", "./folio-assistant-core", "--check", "--json"],
      { cwd: REPO, stdout: "pipe", stderr: "pipe" },
    );
    const out = await new Response(p.stdout).text();
    await p.exited;

    const data = JSON.parse(out);
    const reports = data.reports as { subject: { id: string }; criteria: Record<string, { result: string; findings: { where: string; detail: string }[] }> }[];
    const ingestion = reports.find((r) => r.subject.id === "Process_L1DocumentIngestion");
    expect(ingestion).toBeDefined();

    const car = ingestion!.criteria["call-activity-resolves"];
    expect(car.result).toBe("pass");
    // Four: its two ingestion phases, and the bean's open and close (bean m8gz).
    expect(car.findings.length).toBe(4);
    expect(car.findings.some((f) => f.detail === 'calls "Process_Ingestion", hosted by instance "cat-harness".')).toBe(true);
    expect(car.findings.some((f) => f.detail === 'calls "Process_IngestTheme", hosted by instance "cat-harness".')).toBe(true);
    expect(car.findings.some((f) => f.detail === 'calls "Process_BeanOpen", hosted by instance "cat-harness".')).toBe(true);
    expect(car.findings.some((f) => f.detail === 'calls "Process_BeanClose", hosted by instance "cat-harness".')).toBe(true);
  }, 30_000);

  test("a call activity whose targets are all local resolves as a PASS with empty findings", async () => {
    const p = Bun.spawn(
      ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", "./folio-assistant-core", "--check", "--json"],
      { cwd: REPO, stdout: "pipe", stderr: "pipe" },
    );
    const out = await new Response(p.stdout).text();
    await p.exited;

    const data = JSON.parse(out);
    const reports = data.reports as { subject: { id: string }; criteria: Record<string, { result: string; findings: unknown[] }> }[];
    // Process_PublicComment calls only Process_ContentChangeReview, which
    // folio-assistant-core hosts itself. (Process_Lifecycle was the subject until
    // it began calling cat-harness's bean-open and bean-close, bean m8gz.)
    const publicComment = reports.find((r) => r.subject.id === "Process_PublicComment");
    expect(publicComment).toBeDefined();

    const car = publicComment!.criteria["call-activity-resolves"];
    expect(car.result).toBe("pass");
    expect(car.findings).toEqual([]);
  }, 30_000);

  test("a call activity whose target resolves nowhere is a FAIL naming the missing process", async () => {
    const testBpmn = join(REPO, "folio-assistant-core/processes/test-t5j5-dangling.bpmn");
    const bpmnContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             id="Def_TestT5j5Dangling"
             targetNamespace="http://example.org/bpmn">
  <process id="Process_TestT5j5Dangling" name="Test Dangling" isExecutable="true">
    <startEvent id="Start_1"/>
    <sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Call_Dangling"/>
    <callActivity id="Call_Dangling" name="Dangling Step" calledElement="Process_TypoNonExistent999"/>
    <sequenceFlow id="Flow_2" sourceRef="Call_Dangling" targetRef="End_1"/>
    <endEvent id="End_1"/>
  </process>
</definitions>`;

    try {
      writeFileSync(testBpmn, bpmnContent);
      const p = Bun.spawn(
        ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", "./folio-assistant-core", "--check", "--json"],
        { cwd: REPO, stdout: "pipe", stderr: "pipe" },
      );
      const out = await new Response(p.stdout).text();
      await p.exited;

      const data = JSON.parse(out);
      const reports = data.reports as { subject: { id: string }; criteria: Record<string, { result: string; findings: { where: string; detail: string }[] }> }[];
      const rep = reports.find((r) => r.subject.id === "Process_TestT5j5Dangling");
      expect(rep).toBeDefined();

      const car = rep!.criteria["call-activity-resolves"];
      expect(car.result).toBe("fail");
      expect(car.findings.some((f) => f.detail === 'calls "Process_TypoNonExistent999", which is the id of no process this instance or any other instance in the repository can load.')).toBe(true);
    } finally {
      if (existsSync(testBpmn)) rmSync(testBpmn);
    }
  }, 30_000);

  test("a diagram that cannot load leaves criteria as UNKNOWN", async () => {
    const testBpmn = join(REPO, "folio-assistant-core/processes/test-t5j5-malformed.bpmn");
    try {
      writeFileSync(testBpmn, "<not-valid-xml");
      const p = Bun.spawn(
        ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", "./folio-assistant-core", "--check", "--json"],
        { cwd: REPO, stdout: "pipe", stderr: "pipe" },
      );
      const out = await new Response(p.stdout).text();
      await p.exited;

      const data = JSON.parse(out);
      const reports = data.reports as { subject: { id: string }; criteria: Record<string, { result: string }> }[];
      const rep = reports.find((r) => r.subject.id === "test-t5j5-malformed");
      expect(rep).toBeDefined();
      expect(rep!.criteria["call-activity-resolves"].result).toBe("unknown");
    } finally {
      if (existsSync(testBpmn)) rmSync(testBpmn);
    }
  }, 30_000);
});
