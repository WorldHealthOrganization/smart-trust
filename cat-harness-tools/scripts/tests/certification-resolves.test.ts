/**
 * `certification-resolves` — bean `folio-assistant-zaui`, Done-when 2: the
 * certification family is JUDGED, not only typed. Each test plants one way a
 * filed certification can be wrong.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auditCertifications } from "../test-plan-audit.ts";

const DIR = mkdtempSync(join(tmpdir(), "cert-resolves-"));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

const PLAN = join(import.meta.dir, "fixtures", "test-plan-execution", "tiny.test-plan.json");

let n = 0;
/** A layer root with one report file and one certification file holding `entries`. */
function instance(entries: unknown[], raw?: string): { root: string; files: string[] } {
  const root = join(DIR, `i${n++}`);
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(join(root, "reports", "test-report.json"), "{}");
  const dir = join(root, "test", "attestations", "certification");
  mkdirSync(dir, { recursive: true });
  const f = join(dir, "tiny-workflow-tool.attestations.json");
  writeFileSync(
    f,
    raw ??
      JSON.stringify({
        $schema: "qa-attestations/v1",
        family: "certification",
        subject: { kind: "test-plan", id: "tiny-workflow-tool", path: "reports/test-report.json" },
        certifications: entries,
      }),
  );
  return { root, files: [f] };
}

const good = {
  signer: { kind: "human", id: "owner" },
  timestamp: "2026-10-11T09:00:00Z",
  decision: "certified",
  testPlanId: "tiny-workflow-tool",
  evidence: "reports/test-report.json",
};

describe("certification-resolves", () => {
  test("nothing filed is `n/a`, never a pass over nothing", () => {
    expect(auditCertifications({ root: DIR, plans: [PLAN], files: [] }).result).toBe("n/a");
  });

  test("a certified entry naming a held plan and present evidence passes", () => {
    const i = instance([good]);
    expect(auditCertifications({ root: i.root, plans: [PLAN], files: i.files })).toEqual({ result: "pass", findings: [] });
  });

  test("FALSIFICATION: a refusal filed as a certification fails", () => {
    const i = instance([{ ...good, decision: "refused" }]);
    const r = auditCertifications({ root: i.root, plans: [PLAN], files: i.files });
    expect(r.result).toBe("fail");
    expect(r.findings[0]!.detail).toContain('"refused"');
  });

  test("FALSIFICATION: a plan no declared directory holds fails", () => {
    const i = instance([{ ...good, testPlanId: "no-such-plan" }]);
    expect(auditCertifications({ root: i.root, plans: [PLAN], files: i.files }).result).toBe("fail");
  });

  test("FALSIFICATION: a certification with no evidence fails", () => {
    const { evidence: _drop, ...noEvidence } = good;
    const i = instance([noEvidence]);
    expect(auditCertifications({ root: i.root, plans: [PLAN], files: i.files }).result).toBe("fail");
  });

  test("FALSIFICATION: a file that is not the certification family fails", () => {
    const i = instance([], JSON.stringify({ $schema: "qa-attestations/v1", family: "certification", subject: { kind: "x", id: "y", path: null } }));
    expect(auditCertifications({ root: i.root, plans: [PLAN], files: i.files }).result).toBe("fail");
  });

  test("evidence kept on qa-reports, not in this checkout, is `unknown` — never a pass", () => {
    const i = instance([{ ...good, evidence: "test/results/tests/x/y/r1/test-report.json" }]);
    const r = auditCertifications({ root: i.root, plans: [PLAN], files: i.files });
    expect(r.result).toBe("unknown");
    expect(r.findings[0]!.detail).toContain("qa:fetch");
  });
});
