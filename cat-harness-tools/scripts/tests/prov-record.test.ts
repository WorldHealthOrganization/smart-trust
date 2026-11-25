/**
 * The engine writes a `prov:Activity` as it records a step (bean `n2l9`,
 * issues #1180 and #1207): the authenticated agent, the lane's role, the plan
 * and every policy in force — and invents nothing.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { loadProcessModel } from "../../src/workflow/process-model.js";
import { complete, enabled, startInstance } from "../../src/workflow/instance.js";
import {
  ProvConsentDecisionRecordSchema,
  ProvConsentRefSchema,
  ProvDecisionRecordSchema,
  agreementDistribution,
  agreementsCited,
  computeProvRecordHash,
  grantsCited,
  provActivityFor,
  provConsentDecisionRecordFor,
  provDecisionRecordFor,
  verifyProvHashChain,
} from "../../src/workflow/prov-record.js";
import { loadAccessContext, type Principal } from "../../src/core/access.js";
import { ProvActivitySchema, ProvAgreementDistributionSchema } from "../../schemas/content/prov.js";
import { reportInstance } from "../prov-qaqc.js";
import { roleGraphFor, workflowFile } from "../known-skills.js";
import type { TaskAuthVerdict } from "../../src/workflow/authorize.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = join(HARNESS_ROOT);
const CTX = loadAccessContext(ROOT);
const GITHUB: Principal = { actor: "collaborator", authenticatedBy: "github", account: "octo" };

/**
 * The first step of a diagram whose lane binds a role. Any such diagram
 * serves; this one is cat-harness's OWN (`crdm-requirements`), so the engine's
 * record is tested where the engine lives. It read `getting-started.bpmn`
 * until 2026-10-06, which folio-assistant-core owns, so standing alone the
 * harness had nothing to run these on (bean `ho66`).
 */
async function firstRoledStep() {
  const model = await loadProcessModel(workflowFile(ROOT, "crdm-requirements.bpmn"));
  const state = startInstance(model, { id: "t", subject: "s" });
  const e = enabled(model, state).find((x) => x.kind === "activity" && model.nodes.get(x.node)?.roleRef);
  return { model, state, node: model.nodes.get(e!.node)! };
}

describe("complete() writes the activity as it records the step", () => {
  test("an allowed step under a GitHub principal carries a valid prov:Activity", async () => {
    const { model, state, node } = await firstRoledStep();
    const next = complete(model, state, node.id, {
      authz: { ctx: CTX, principal: GITHUB, target: "block-1", mode: "strict" },
    });
    const entry = next.history.at(-1)!;
    expect(entry.prov).toBeDefined();
    expect(ProvActivitySchema.safeParse(entry.prov).success).toBe(true);
    expect(entry.prov!["prov:qualifiedAssociation"]).toEqual({
      "prov:agent": "collaborator",
      "prov:hadRole": node.roleRef!,
      "prov:hadPlan": `crdm-requirements#${node.id}`,
    });
    expect(entry.prov!["prov:used"]).toEqual(["block-1"]);
    // Every policy in force, because decide() evaluated every one.
    const under = entry.prov!["cat-harness:underPolicy"];
    expect(Array.isArray(under) ? under.length : 1).toBe(CTX.policies.size);
  });

  test("no authorization context, no activity: nothing is recorded that was not decided", async () => {
    const { model, state, node } = await firstRoledStep();
    const next = complete(model, state, node.id, {});
    expect(next.history.at(-1)!.prov).toBeUndefined();
  });
});

describe("a Tool activity on a step is informed by the step's own activity (bean w1gy, folio-assistant#875 FR-005)", () => {
  const toolActivity = (plan: string, extra: Record<string, unknown> = {}) => ({
    "@type": "prov:Activity",
    "@id": "skill-update:skills/x.md@0123456789ab",
    "prov:startedAtTime": "2026-10-30T13:40:00.000Z",
    "prov:qualifiedAssociation": { "prov:agent": "authoring-agent", "prov:hadRole": "editor", "prov:hadPlan": plan },
    "prov:generated": ["skills/x.md@sha256:bbbb"],
    "cat-harness:underPolicy": ["policy:test"],
    ...extra,
  });

  test("the Tool activity names the step's prov:Activity in prov:wasInformedBy, and still parses", async () => {
    const { model, state, node } = await firstRoledStep();
    const next = complete(model, state, node.id, {
      authz: { ctx: CTX, principal: GITHUB, target: "block-1", mode: "strict" },
      activities: [toolActivity(`crdm-requirements#${node.id}`)],
    });
    const entry = next.history.at(-1)!;
    expect(entry.prov?.["@id"]).toBeTruthy();
    const tool = entry.activities![0]!;
    expect(tool["prov:wasInformedBy"]).toBe(entry.prov!["@id"]);
    expect(ProvActivitySchema.safeParse(tool).success).toBe(true);
  });

  test("no step activity: the Tool activity is recorded with no link", async () => {
    const { model, state, node } = await firstRoledStep();
    const next = complete(model, state, node.id, { activities: [toolActivity(`crdm-requirements#${node.id}`)] });
    const entry = next.history.at(-1)!;
    expect(entry.prov).toBeUndefined();
    expect(entry.activities![0]!["prov:wasInformedBy"]).toBeUndefined();
  });

  test("a prov:wasInformedBy the Tool supplied is kept and the step's added beside it", async () => {
    const { model, state, node } = await firstRoledStep();
    const next = complete(model, state, node.id, {
      authz: { ctx: CTX, principal: GITHUB, target: "block-1", mode: "strict" },
      activities: [toolActivity(`crdm-requirements#${node.id}`, { "prov:wasInformedBy": "upstream#7" })],
    });
    const entry = next.history.at(-1)!;
    expect(entry.activities![0]!["prov:wasInformedBy"]).toEqual(["upstream#7", entry.prov!["@id"]]);
  });
});

describe("provActivityFor invents nothing", () => {
  const verdict = (over: Partial<TaskAuthVerdict>): TaskAuthVerdict => ({
    allowed: true,
    mode: "strict",
    authenticatedBy: "github",
    actor: "owner",
    role: "author",
    assignment: "unconstrained",
    authorized: "permit",
    findings: [],
    ...over,
  });
  const base = { id: "i#0", at: "2026-09-24T00:00:00.000Z", source: "p.bpmn", node: "Task_A", policies: ["urn:p"] };

  test("a refused step, a step with no actor, and a step with no lane role get no activity", () => {
    expect(provActivityFor({ ...base, verdict: verdict({ allowed: false }) })).toBeUndefined();
    expect(provActivityFor({ ...base, verdict: verdict({ actor: null }) })).toBeUndefined();
    expect(provActivityFor({ ...base, verdict: verdict({ role: undefined }) })).toBeUndefined();
    expect(provActivityFor({ ...base, policies: [], verdict: verdict({}) })).toBeUndefined();
  });

  test("one policy is written as a string, several as a sorted array", () => {
    expect(provActivityFor({ ...base, verdict: verdict({}) })!["cat-harness:underPolicy"]).toBe("urn:p");
    expect(provActivityFor({ ...base, policies: ["urn:b", "urn:a"], verdict: verdict({}) })!["cat-harness:underPolicy"]).toEqual(["urn:a", "urn:b"]);
  });
});

describe("the after-check reads the engine's record", () => {
  test("it re-checks the recorded principal, not a login in `actor`, and emits the recorded activity", async () => {
    const { model, state, node } = await firstRoledStep();
    // The caller typed a GitHub login as `actor`; GitHub vouched for `collaborator`.
    const next = complete(model, state, node.id, {
      actor: "octo",
      authz: { ctx: CTX, principal: GITHUB, mode: "strict" },
    });
    const r = reportInstance("t", next, model, roleGraphFor(ROOT), CTX);
    expect(r.findings.filter((f) => f.kind === "undeclared-actor")).toEqual([]);
    expect(r.activities).toContainEqual(next.history.at(-1)!.prov!);
  });
});

describe("DSA B4: PROV decision records cite agreement + grant and form a hash-chained log (bean 3z44)", () => {
  const verdict = (over: Partial<TaskAuthVerdict> = {}): TaskAuthVerdict => ({
    allowed: true,
    mode: "strict",
    authenticatedBy: "github",
    actor: "owner",
    role: "author",
    assignment: "unconstrained",
    authorized: "permit",
    findings: [],
    ...over,
  });

  const agreement = agreementDistribution(
    "https://example.org/dsa/who-ministry-2026-v1#pdf",
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "https://example.org/dsa/who-ministry-2026-v1.pdf",
  );
  const grantId = "urn:uuid:7f1c2a52-6d1e-4b8e-9b0e-0c4b2b5d1a01";

  test("every decision record cites its agreement (prov:used DCAT distribution + spdx:checksum), its VC grant, and its hash", () => {
    const r0 = provDecisionRecordFor({
      id: "dsa-run#0",
      at: "2026-10-30T12:00:00.000Z",
      source: "dsa-document-lifecycle.bpmn",
      node: "Task_Publish",
      verdict: verdict(),
      policies: ["urn:dsa:agreement:1"],
      target: "dataset:surveillance-2026",
      agreement,
      grant: grantId,
    });
    expect(r0).toBeDefined();
    expect(ProvDecisionRecordSchema.safeParse(r0).success).toBe(true);
    expect(r0!["prov:used"]).toEqual([
      "dataset:surveillance-2026",
      agreement,
      { "@id": grantId, "@type": ["prov:Entity", "cred:VerifiableCredential"] },
    ]);
    expect(agreementsCited(r0!)).toEqual([agreement]);
    expect(grantsCited(r0!).map((g) => g["@id"])).toEqual([grantId]);
    expect(r0!["cat-harness:previousHash"]).toBeNull();
    expect(r0!["cat-harness:recordHash"]).toBe(computeProvRecordHash(r0!));

    // Omitting agreement fails ProvDecisionRecordSchema and verifyProvHashChain
    const withoutAgreement = { ...r0!, "prov:used": r0!["prov:used"]!.filter((u) => agreementsCited({ "prov:used": [u] }).length === 0) };
    expect(ProvDecisionRecordSchema.safeParse(withoutAgreement).success).toBe(false);
    const missingAgCheck = verifyProvHashChain([withoutAgreement]);
    expect(missingAgCheck.valid).toBe(false);
    expect(missingAgCheck.errors.some((e) => e.kind === "missing-agreement")).toBe(true);

    // A distribution @id that is not an absolute IRI, or a checksum of the wrong length, is refused
    expect(ProvAgreementDistributionSchema.safeParse({ ...agreement, "@id": "not-a-uri" }).success).toBe(false);
    expect(() => agreementDistribution(agreement["@id"], "1234")).toThrow();

    // Omitting recordHash fails ProvDecisionRecordSchema and verifyProvHashChain
    const { "cat-harness:recordHash": _noHash, ...withoutHash } = r0!;
    expect(ProvDecisionRecordSchema.safeParse(withoutHash).success).toBe(false);
    const missingHashCheck = verifyProvHashChain([withoutHash]);
    expect(missingHashCheck.valid).toBe(false);
    expect(missingHashCheck.errors.some((e) => e.kind === "missing-hash")).toBe(true);
  });

  test("editing or removing any past record fails the chain check", () => {
    const r0 = provDecisionRecordFor({
      id: "dsa-run#0",
      at: "2026-10-30T12:00:00.000Z",
      source: "dsa-document-lifecycle.bpmn",
      node: "Task_Draft",
      verdict: verdict(),
      policies: ["urn:dsa:agreement:1"],
      agreement,
    })!;
    const r1 = provDecisionRecordFor({
      id: "dsa-run#1",
      at: "2026-10-30T12:05:00.000Z",
      source: "dsa-document-lifecycle.bpmn",
      node: "Task_Review",
      verdict: verdict({ role: "reviewer" }),
      policies: ["urn:dsa:agreement:1"],
      agreement,
      previousRecord: r0,
    })!;
    const r2 = provDecisionRecordFor({
      id: "dsa-run#2",
      at: "2026-10-30T12:10:00.000Z",
      source: "dsa-document-lifecycle.bpmn",
      node: "Task_Sign",
      verdict: verdict({ role: "stakeholder" }),
      policies: ["urn:dsa:agreement:1"],
      agreement,
      previousRecord: r1,
    })!;

    const chain = [r0, r1, r2];
    const ok = verifyProvHashChain(chain, {
      expectedCount: 3,
      expectedHeadHash: r2["cat-harness:recordHash"],
    });
    expect(ok.valid).toBe(true);
    expect(ok.errors).toEqual([]);
    expect(ok.headHash).toBe(r2["cat-harness:recordHash"]);

    // 1. Editing a past record in place fails with hash-mismatch
    const editedField = [{ ...r0, "prov:startedAtTime": "2026-10-30T12:00:01.000Z" }, r1, r2];
    const checkEditedField = verifyProvHashChain(editedField);
    expect(checkEditedField.valid).toBe(false);
    expect(checkEditedField.errors.some((e) => e.index === 0 && e.kind === "hash-mismatch")).toBe(true);

    // 2. Editing a past record AND recomputing its own hash still fails on the next record's broken-link
    const editedR0Rehashed = provDecisionRecordFor({
      id: "dsa-run#0",
      at: "2026-10-30T12:00:01.000Z",
      source: "dsa-document-lifecycle.bpmn",
      node: "Task_Draft",
      verdict: verdict(),
      policies: ["urn:dsa:agreement:1"],
      agreement,
    })!;
    const checkRehashed = verifyProvHashChain([editedR0Rehashed, r1, r2]);
    expect(checkRehashed.valid).toBe(false);
    expect(checkRehashed.errors.some((e) => e.index === 1 && e.kind === "broken-link")).toBe(true);

    // 3. Removing the first record (r0) fails (r1.previousHash !== null)
    const checkRemovedFirst = verifyProvHashChain([r1, r2]);
    expect(checkRemovedFirst.valid).toBe(false);
    expect(checkRemovedFirst.errors.some((e) => e.index === 0 && e.kind === "broken-link")).toBe(true);

    // 4. Removing a middle record (r1) fails (r2.previousHash !== r0.recordHash)
    const checkRemovedMiddle = verifyProvHashChain([r0, r2]);
    expect(checkRemovedMiddle.valid).toBe(false);
    expect(checkRemovedMiddle.errors.some((e) => e.index === 1 && e.kind === "broken-link")).toBe(true);

    // 5. Removing the tail record (r2) fails when expectedHeadHash or expectedCount is checked
    const checkRemovedTailHead = verifyProvHashChain([r0, r1], {
      expectedHeadHash: r2["cat-harness:recordHash"],
    });
    expect(checkRemovedTailHead.valid).toBe(false);
    expect(checkRemovedTailHead.errors.some((e) => e.kind === "head-mismatch")).toBe(true);

    const checkRemovedTailCount = verifyProvHashChain([r0, r1], { expectedCount: 3 });
    expect(checkRemovedTailCount.valid).toBe(false);
    expect(checkRemovedTailCount.errors.some((e) => e.kind === "count-mismatch")).toBe(true);
  });

  test("complete() chains PROV decision records across workflow steps and reportInstance flags tampering", async () => {
    const { model, state, node } = await firstRoledStep();
    const step1 = complete(model, state, node.id, {
      authz: { ctx: CTX, principal: GITHUB, target: "block-1", mode: "strict", agreement, grant: grantId },
    });
    const nextEnabled = enabled(model, step1).find((x) => x.kind === "activity" && model.nodes.get(x.node)?.roleRef);
    expect(nextEnabled).toBeDefined();
    const step2 = complete(model, step1, nextEnabled!.node, {
      authz: { ctx: CTX, principal: GITHUB, target: "block-2", mode: "strict", agreement },
    });

    const provs = step2.history.map((h) => h.prov).filter((p): p is NonNullable<typeof p> => p !== undefined);
    expect(provs.length).toBe(2);
    expect(provs[0]!["cat-harness:previousHash"]).toBeNull();
    expect(provs[1]!["cat-harness:previousHash"]).toBe(provs[0]!["cat-harness:recordHash"]);
    expect(verifyProvHashChain(provs).valid).toBe(true);

    const cleanReport = reportInstance("t", step2, model, roleGraphFor(ROOT), CTX);
    expect(cleanReport.invalid).toEqual([]);

    // Tamper by removing the first step's history entry: reportInstance flags broken-link in invalid
    const tamperedState = {
      ...step2,
      history: step2.history.filter((_, idx) => idx !== 1),
    };
    const tamperedReport = reportInstance("t", tamperedState, model, roleGraphFor(ROOT), CTX);
    expect(tamperedReport.invalid.length).toBeGreaterThan(0);
    expect(tamperedReport.invalid.some((msg) => msg.includes("broken-link"))).toBe(true);
  });
});

describe("PROV decision record cites Consent id + versionId (PCF8, bean 2egb)", () => {
  const verdict = (over: Partial<TaskAuthVerdict> = {}): TaskAuthVerdict => ({
    allowed: true,
    mode: "strict",
    authenticatedBy: "github",
    actor: "owner",
    role: "author",
    assignment: "unconstrained",
    authorized: "permit",
    findings: [],
    ...over,
  });

  const agreement = agreementDistribution(
    "https://example.org/agreements/who-ministry-dsa-v1#pdf",
    "f47ac10b58cc4372a5670e02b2c3d479f47ac10b58cc4372a5670e02b2c3d479",
  );

  const consent = {
    id: "ex-consent-basic-treat",
    versionId: "3",
  };

  test("every consent-based decision names its Consent (id + versionId)", () => {
    expect(ProvConsentRefSchema.safeParse(consent).success).toBe(true);
    expect(ProvConsentRefSchema.safeParse({ id: "ex-consent-basic-treat", versionId: "" }).success).toBe(false);

    const rec = provConsentDecisionRecordFor({
      id: "dsa-consent-run#0",
      at: "2026-10-30T14:00:00.000Z",
      source: "dsa-document-lifecycle.bpmn",
      node: "Task_Disclose",
      verdict: verdict(),
      policies: ["urn:dsa:agreement:1", "urn:ihe:pcf:consent:ex-consent-basic-treat:v3"],
      agreement,
      consent,
    });
    expect(rec).toBeDefined();
    expect(rec!["cat-harness:consent"]).toEqual(consent);
    expect(rec!["cat-harness:consentBased"]).toBe(true);
    expect(ProvConsentDecisionRecordSchema.safeParse(rec).success).toBe(true);

    // A consent-based decision without Consent (either via consentBased: true or a PCF consent policy UID) is rejected
    expect(() =>
      provDecisionRecordFor({
        id: "dsa-consent-run#1",
        at: "2026-10-30T14:05:00.000Z",
        source: "dsa-document-lifecycle.bpmn",
        node: "Task_Disclose",
        verdict: verdict(),
        policies: ["urn:dsa:agreement:1"],
        agreement,
        consentBased: true,
      }),
    ).toThrow();

    expect(() =>
      provDecisionRecordFor({
        id: "dsa-consent-run#2",
        at: "2026-10-30T14:05:00.000Z",
        source: "dsa-document-lifecycle.bpmn",
        node: "Task_Disclose",
        verdict: verdict(),
        policies: ["urn:dsa:agreement:1", "urn:ihe:pcf:consent:ex-consent-basic-treat:v3"],
        agreement,
      }),
    ).toThrow();
  });

  test("complete() records Consent id + versionId on consent-based steps and reportInstance flags missing Consent", async () => {
    const { model, state, node } = await firstRoledStep();
    const step1 = complete(model, state, node.id, {
      authz: {
        ctx: CTX,
        principal: GITHUB,
        target: "Patient/pat-1",
        mode: "strict",
        agreement,
        consent,
        consentBased: true,
      },
    });

    const entry = step1.history.at(-1)!;
    expect(entry.prov).toBeDefined();
    expect(entry.prov!["cat-harness:consent"]).toEqual(consent);
    expect(entry.prov!["cat-harness:consentBased"]).toBe(true);

    const cleanReport = reportInstance("t", step1, model, roleGraphFor(ROOT), CTX);
    expect(cleanReport.invalid).toEqual([]);

    // Tamper by stripping cat-harness:consent from a consent-based decision record
    const strippedProv = { ...entry.prov! } as Record<string, unknown>;
    delete strippedProv["cat-harness:consent"];
    const tamperedState = {
      ...step1,
      history: [
        ...step1.history.slice(0, -1),
        { ...entry, prov: strippedProv as unknown as typeof entry.prov },
      ],
    };
    const tamperedReport = reportInstance("t", tamperedState, model, roleGraphFor(ROOT), CTX);
    expect(tamperedReport.invalid.some((msg) => msg.includes("missing-consent"))).toBe(true);
  });
});
