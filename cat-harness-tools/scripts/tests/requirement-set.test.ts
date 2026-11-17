/**
 * Issue #2405, the RequirementSet amendment (FR-010 to FR-013, SC-006 to
 * SC-008): the bootstrap `RequirementSet`, its published JSON Schema, the
 * `requirement-signoff` attestation family, and `check:requirements`.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Ajv from "ajv";

import { RequirementSetSchema, SignerKindSchema, type SignOff } from "@litlfred/bootstrap-tools/schemas/requirement-set.ts";
import { QA_REVIEWER_KINDS } from "../../schemas/sdlc/block-qa.ts";
import {
  QaAttestationsSchema,
  requirementSignoffPath,
} from "../../schemas/sdlc/qa-attestations.ts";
import { loadProcessModel } from "../../src/workflow/process-model.ts";
import { checkRequirementSet, signoffFacts, storedSignOffs, unionSignOffs } from "../check-requirements.ts";

const REPO = join(import.meta.dir, "..", "..", "..");
const MEASLES = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", "measles-l1.requirement-set.json"), "utf8"));
const published = JSON.parse(readFileSync(join(REPO, "bootstrap", "schemas", "requirement-set.schema.json"), "utf8"));
const validate = new Ajv({ allErrors: true }).compile(published);

const human: SignOff = {
  kind: "human", id: "litlfred", at: "2026-10-07", scope: "reqset:x", outcome: "approve", stage: "approved",
  evidence: "https://github.com/o/r/issues/1#issuecomment-1",
};
const set = (over: Record<string, unknown> = {}) => ({
  id: "reqset:x", title: "X", methodology: "crdm", stage: "draft",
  members: [{ ref: "req:x#a", decision: "approved" }], ...over,
});
const inForce = () => "in-force";

describe("SC-007: the measles requirements set, as a RequirementSet", () => {
  test("passes the Zod and the published JSON Schema", () => {
    const r = RequirementSetSchema.safeParse(MEASLES);
    expect(r.success ? "ok" : JSON.stringify(r.error.issues)).toBe("ok");
    expect(validate(MEASLES)).toBe(true);
  });
  test("signOffs[0] is the owner's human approval of 2026-10-07, with the issue-comment permalink", () => {
    const s = MEASLES.signOffs[0];
    expect([s.kind, s.id, s.at, s.outcome, s.stage]).toEqual(["human", "litlfred", "2026-10-07", "approve", "approved"]);
    expect(s.evidence).toBe("https://github.com/litlfred/test/issues/1#issuecomment-6035163009");
  });
  test("check:requirements finds nothing wrong with it", () => {
    expect(checkRequirementSet("measles", MEASLES, [], inForce)).toEqual([]);
  });
});

describe("SC-006: check:requirements refuses a stage its record does not justify (planted failures)", () => {
  test("`approved` with no human sign-off — none at all, or only an agent's", () => {
    expect(checkRequirementSet("f", set({ stage: "approved" }), [], inForce).map((p) => p.message).join()).toContain("HUMAN sign-off");
    const agent = { ...human, kind: "agent", id: "claude" };
    expect(checkRequirementSet("f", set({ stage: "approved", signOffs: [agent] }), [], inForce)).not.toEqual([]);
    expect(validate(set({ stage: "approved", signOffs: [agent] }))).toBe(false);
    expect(checkRequirementSet("f", set({ stage: "approved", signOffs: [human] }), [], inForce)).toEqual([]);
  });
  test("`planned` with no beans", () => {
    const planned = set({ stage: "planned", signOffs: [human] });
    expect(checkRequirementSet("f", planned, [], inForce).map((p) => p.message).join()).toContain("work plan");
    expect(validate(planned)).toBe(false);
    expect(checkRequirementSet("f", { ...planned, workPlan: ["abcd"] }, [], inForce)).toEqual([]);
  });
  test("`cancelled` with no reason", () => {
    const cancel = { ...human, kind: "agent", outcome: "cancel", stage: "cancelled" };
    expect(checkRequirementSet("f", set({ stage: "cancelled", signOffs: [cancel] }), [], inForce)).not.toEqual([]);
    expect(validate(set({ stage: "cancelled", signOffs: [cancel] }))).toBe(false);
    const withReason = { ...cancel, reason: "superseded by the L2 plan" };
    expect(checkRequirementSet("f", set({ stage: "cancelled", signOffs: [withReason] }), [], inForce)).toEqual([]);
  });
  test("past `approved` presupposes an approval", () => {
    const delivered = set({ stage: "delivered", workPlan: ["abcd"] });
    expect(checkRequirementSet("f", delivered, [], inForce).map((p) => p.message).join()).toContain("never approved");
  });
  test("a sign-off scoped to something that is neither the set nor a member", () => {
    expect(checkRequirementSet("f", set({ signOffs: [{ ...human, scope: "req:other", stage: undefined }] }), [], inForce)).not.toEqual([]);
  });
});

describe("a set's stage and its members' statuses stay independent — with ONE link", () => {
  const accepted = set({
    stage: "accepted", workPlan: ["abcd"],
    signOffs: [human, { ...human, at: "2026-10-09", stage: "accepted" }],
  });
  test("accepted needs every APPROVED member in force", () => {
    expect(checkRequirementSet("f", accepted, [], () => "proposed").map((p) => p.message).join()).toContain("not `in-force`");
    expect(checkRequirementSet("f", accepted, [], inForce)).toEqual([]);
  });
  test("a deferred member does not hold acceptance back", () => {
    const s = { ...accepted, members: [{ ref: "req:x#a", decision: "approved" }, { ref: "req:y#b", decision: "deferred" }] };
    expect(checkRequirementSet("f", s, [], (id) => (id === "req:x" ? "in-force" : "proposed"))).toEqual([]);
  });
  test("an in-force member does not move its set", () => {
    expect(checkRequirementSet("f", set({ stage: "proposed" }), [], inForce)).toEqual([]);
  });
});

describe("FR-011: a sign-off is an adjudication record, kept in the attestations graph", () => {
  test("its signer kinds ARE the QA reviewer kinds — one vocabulary, not two", () => {
    expect([...SignerKindSchema.options].sort())
      .toEqual([...QA_REVIEWER_KINDS].sort());
  });
  test("the `requirement-signoff` family round-trips, and a stored sign-off justifies the stage", () => {
    const home = mkdtempSync(join(tmpdir(), "reqsig-"));
    const path = requirementSignoffPath(home, "reqset:x");
    expect(path).toEndWith("requirement-signoff/x.attestations.json");
    const file = { $schema: "qa-attestations/v1", family: "requirement-signoff", subject: { kind: "requirement-set", id: "reqset:x", path: null }, signoffs: [human] };
    expect(QaAttestationsSchema.safeParse(file).success).toBe(true);
    mkdirSync(join(home, "requirement-signoff"), { recursive: true });
    writeFileSync(path, JSON.stringify(file));
    const stored = storedSignOffs(home, "reqset:x");
    expect(checkRequirementSet("f", set({ stage: "approved" }), stored, inForce)).toEqual([]);
    expect(QaAttestationsSchema.safeParse({ ...file, signoffs: [] }).success).toBe(false);
  });
  test("the inline and stored records are one union, de-duplicated", () => {
    expect(unionSignOffs([human], [human])).toHaveLength(1);
  });
});

describe("SC-008: a sign-off step cannot proceed on a decision nobody recorded", () => {
  test("the facts are read off the record", () => {
    expect(signoffFacts("reqset:x", [])).toEqual({ signoffRecorded: "no", signoffOutcome: "none" });
    expect(signoffFacts("reqset:x", [human, { ...human, at: "2026-10-08", outcome: "amend" }]))
      .toEqual({ signoffRecorded: "yes", signoffOutcome: "amend" });
  });
  test.each([["crdm-signoff.bpmn", "BA_Signoff"], ["crdm-close.bpmn", "BA_Confirm"]] as const)("%s: %s calls the adjudication with the requirement-set codes, and only a recorded sign-off leaves", async (file, step) => {
    const model = await loadProcessModel(join(REPO, "cat-harness", "processes", "process", file));
    const node = model.nodes.get(step)!;
    expect(node.adjudication?.codes).toEqual(["approve", "amend", "reject", "defer", "cancel"]);
    expect(node.adjudication?.list).toBe("adjudication-requirement-set");
    const gw = model.nodes.get("GW_SignoffRecorded")!;
    expect(gw.decisionRef).toContain("requirement-signoff-recorded.dmn");
    // Every path out of the step goes through the record and the gate.
    const record = model.nodes.get("A_RecordSignoff")!;
    expect(record).toBeDefined();
    const missing = [...model.flows.values()].find((f) => f.from === "GW_SignoffRecorded" && f.to === "A_RecordSignoff");
    expect(missing).toBeDefined();
  });
});
