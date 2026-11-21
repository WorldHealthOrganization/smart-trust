/**
 * `A_FileCertification` writes, and what it writes reads back (bean
 * `folio-assistant-zaui`, done-when #1).
 *
 * The family, its schema and the store functions live in cat-harness
 * (`schemas/sdlc/qa-attestations.ts`). These tests drive the STEP: the
 * `fileSignedCertification` that `test-plan-execution.bpmn`'s filing activity
 * names, against a real directory, in each state the store can be in.
 *
 * @module scripts/tests/test-plan-file-certification.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readCertificationAttestations } from "../../schemas/sdlc/qa-attestations.ts";
import { fileSignedCertification, type FileCertificationInput } from "../test-plan-execution.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A layer with an (empty) attestation store at the convention path. */
function instance(): string {
  const d = mkdtempSync(join(tmpdir(), "file-cert-"));
  dirs.push(d);
  mkdirSync(join(d, "test", "attestations"), { recursive: true });
  return d;
}

const input = (over: Partial<FileCertificationInput> = {}): FileCertificationInput => ({
  plan: { id: "tiny-workflow-tool", version: "1.0.0" },
  decision: "certified",
  signer: { kind: "agent", id: "attestation-service" },
  signature: { algorithm: "sha256", value: "abc123" },
  reportPath: "test/results/tiny-workflow-tool.test-report.json",
  timestamp: "2026-10-10T17:00:00.000Z",
  ...over,
});

const storeFile = (root: string) => join(root, "test", "attestations", "certification", "tiny-workflow-tool.attestations.json");

describe("A_FileCertification (fileSignedCertification)", () => {
  test("a certified decision is filed under certification/ and reads back", () => {
    const root = instance();
    const r = fileSignedCertification(root, input());
    expect(r).toEqual({ state: "filed", path: storeFile(root), written: true });
    const back = readCertificationAttestations(root, "tiny-workflow-tool");
    expect(back.state).toBe("hit");
    if (back.state !== "hit") return;
    expect(back.file.family).toBe("certification");
    expect(back.file.subject).toEqual({ kind: "test-plan", id: "tiny-workflow-tool", path: "test/results/tiny-workflow-tool.test-report.json" });
    expect(back.file.certifications).toHaveLength(1);
    expect(back.file.certifications[0]).toMatchObject({
      decision: "certified",
      testPlanId: "tiny-workflow-tool",
      evidence: "test/results/tiny-workflow-tool.test-report.json",
      timestamp: "2026-10-10T17:00:00.000Z",
    });
  });

  test("notes say how the decision reached the filer, beside the plan version", () => {
    const root = instance();
    fileSignedCertification(root, input({ notes: "decided by the owner in session S, relayed" }));
    const back = readCertificationAttestations(root, "tiny-workflow-tool");
    expect(back.state === "hit" && back.file.certifications[0]!.notes).toBe("plan version 1.0.0; decided by the owner in session S, relayed");
  });

  test("a second certification is appended, never replacing the first", () => {
    const root = instance();
    fileSignedCertification(root, input());
    fileSignedCertification(root, input({ timestamp: "2026-10-11T09:00:00.000Z" }));
    const back = readCertificationAttestations(root, "tiny-workflow-tool");
    expect(back.state === "hit" && back.file.certifications.map((c) => c.timestamp)).toEqual([
      "2026-10-10T17:00:00.000Z",
      "2026-10-11T09:00:00.000Z",
    ]);
  });

  test("a refused or undetermined decision files nothing", () => {
    for (const decision of ["refused", "undetermined"]) {
      const root = instance();
      const r = fileSignedCertification(root, input({ decision }));
      expect(r.state).toBe("refused");
      expect(existsSync(storeFile(root))).toBe(false);
    }
  });

  test("a certification with no report to point at is refused", () => {
    const root = instance();
    expect(fileSignedCertification(root, input({ reportPath: "" })).state).toBe("refused");
    expect(existsSync(storeFile(root))).toBe(false);
  });

  test("a corrupt store is unknown, and the corrupt file is left exactly as it was", () => {
    const root = instance();
    mkdirSync(join(root, "test", "attestations", "certification"), { recursive: true });
    writeFileSync(storeFile(root), "{ not json");
    const r = fileSignedCertification(root, input());
    expect(r.state).toBe("unknown");
    expect(readFileSync(storeFile(root), "utf-8")).toBe("{ not json");
  });
});
