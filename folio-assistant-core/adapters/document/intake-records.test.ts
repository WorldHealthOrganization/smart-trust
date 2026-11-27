/**
 * An upload writes two records that its own registry accepts (bean `d4lb`).
 */
import { describe, expect, test } from "bun:test";

import { DublinCoreRecordSchema, dcValues } from "../../schemas/dublin-core.js";
import { IntakeSchema } from "@litlfred/cat-harness-tools/schemas/library/intake.js";
import { recordFileName, uploadRecords } from "./intake-records.js";

const base = {
  docId: "my-paper",
  title: "My paper",
  type: "guideline",
  capturedAt: "2026-09-24T19:00:00.000Z",
  files: [{ path: "my-paper.pdf", bytes: 10, sha256: "a".repeat(64) }],
};

describe("uploadRecords", () => {
  test("intakePointsAtValidRecord", () => {
    const { intake, record } = uploadRecords(base);
    expect(IntakeSchema.safeParse(intake).success).toBe(true);
    expect(DublinCoreRecordSchema.safeParse(record).success).toBe(true);
    expect(intake.record).toBe(recordFileName("my-paper"));
    expect(intake.title).toBeUndefined();
    expect(intake.files).toEqual([{ path: "my-paper.pdf", bytes: 10, sha256: "a".repeat(64), type: "upload", role: "original-bitstream" }]);
  });

  test("formFieldsLandOnDublinCore", () => {
    const { record } = uploadRecords({ ...base, domain: "maternal health", normativeLevel: "recommendation", format: "pdf" });
    expect(dcValues(record, "title").map((v) => v.value)).toEqual(["My paper"]);
    expect(dcValues(record, "type").map((v) => v.value)).toEqual(["guideline"]);
    expect(dcValues(record, "type", "normativeLevel").map((v) => v.value)).toEqual(["recommendation"]);
    expect(dcValues(record, "subject").map((v) => v.value)).toEqual(["maternal health"]);
    expect(dcValues(record, "format").map((v) => v.value)).toEqual(["pdf"]);
  });

  test("emptyFieldWritesNoDcField", () => {
    const { record } = uploadRecords({ ...base, domain: "", normativeLevel: undefined });
    expect(dcValues(record, "subject")).toEqual([]);
    expect(dcValues(record, "type", "normativeLevel")).toEqual([]);
  });

  test("urlIntakeRecordsUpstream", () => {
    const { intake, record } = uploadRecords({ ...base, files: [], upstream: "https://arxiv.org/abs/1234.5678" });
    expect(intake.source.upstream).toBe("https://arxiv.org/abs/1234.5678");
    expect(record.provenance.source).toBe("https://arxiv.org/abs/1234.5678");
  });
});

describe("IntakeSchema", () => {
  const src = { capturedAt: "2026-09-20T20:30:54" };
  test("intakeRequiresItem", () => {
    expect(IntakeSchema.safeParse({ $schema: "folio-intake/v1", doc_id: "x", source: src, files: [] }).success).toBe(false);
    expect(IntakeSchema.safeParse({ $schema: "folio-intake/v1", doc_id: "x", item: "item/1", source: src, files: [] }).success).toBe(true);
  });

  test("unzonedCaptureTimeAccepted", () => {
    const ok = (capturedAt: string) =>
      IntakeSchema.safeParse({ $schema: "folio-intake/v1", doc_id: "x", title: "t", source: { capturedAt }, files: [] }).success;
    expect(ok("2026-09-20T20:30:54")).toBe(true);
    expect(ok("2026-09-20T07:44:32Z")).toBe(true);
    expect(ok("20260920203054")).toBe(false);
  });
});
