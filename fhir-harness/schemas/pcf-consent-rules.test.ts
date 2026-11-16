/**
 * Owner consent rules of 2026-10-30 19:27Z, as far as the PCF evaluator and the
 * ITI-108 client carry them: rule 2 (a Consent counts only for the agreement
 * version its `policy.uri` names) and rule 4 (registry results may be cached,
 * and an entry ends when its Consent is withdrawn).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Iti108ConsentClient } from "./iti-108-consent-client.ts";
import {
  HL7_ACT_REASON_SYSTEM,
  PCF_CONSENT_BASIC_PROFILE,
  consentsCitingAgreement,
  createPcfConsentEvaluator,
  isNarrowingAmendment,
  versionsCoveredByConsent,
  type AgreementVersion,
  type FhirConsent,
} from "./pcf-consent.ts";

const V1 = "https://example.org/dsa/research-registry/1.0.0";
const V2 = "https://example.org/dsa/research-registry/2.0.0";

function consent(id: string, policyUri: string | undefined, end = "2026-12-31"): FhirConsent {
  return {
    resourceType: "Consent",
    id,
    meta: { versionId: "1", profile: [PCF_CONSENT_BASIC_PROFILE] },
    status: "active",
    scope: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentscope", code: "patient-privacy" }] },
    category: [{ coding: [{ system: "http://loinc.org", code: "59284-0" }] }],
    patient: { reference: "Patient/p1" },
    ...(policyUri ? { policy: [{ uri: policyUri }] } : {}),
    provision: {
      type: "permit",
      period: { start: "2026-01-01", end },
      purpose: [{ system: HL7_ACT_REASON_SYSTEM, code: "TREAT" }],
    },
  } as FhirConsent;
}

const req = {
  actor: "Practitioner/x",
  action: "odrl:use",
  scope: { "odrl:purpose": "TREAT", "odrl:dateTime": "2026-06-15T12:00:00Z" },
} as never;

describe("rule 2: a Consent counts only for the agreement version it cites", () => {
  test("keepsConsentsCitingVersion", () => {
    const kept = consentsCitingAgreement([consent("a", V1), consent("b", V2), consent("c", undefined)], V1);
    expect(kept.map((c) => (c as FhirConsent).id)).toEqual(["a"]);
  });

  test("version1ConsentOnlyPermitsVersion1", () => {
    const evaluate = createPcfConsentEvaluator([consent("a", V1)]);
    expect(evaluate(req, undefined, undefined, { uid: V1 } as never)).toMatchObject({ verdict: "permit" });
    expect(evaluate(req, undefined, undefined, { uid: V2 } as never)).toEqual({ verdict: "unknown" });
  });

  test("policyUriOverridesUid", () => {
    expect(createPcfConsentEvaluator([consent("a", V1)], { agreementPolicyUri: V2 })(req)).toEqual({ verdict: "unknown" });
    expect(createPcfConsentEvaluator([consent("c", undefined)])(req)).toMatchObject({ verdict: "permit" });
  });
});

const V3 = "https://example.org/dsa/research-registry/3.0.0";

function agreement(uid: string, purpose: string, until: string, extra: Record<string, unknown> = {}) {
  return {
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Agreement",
    uid,
    profile: "https://litlfred.github.io/cat-harness/policies/profile",
    assigner: "org:registry",
    assignee: "org:research-unit",
    permission: [
      {
        assignee: "org:research-unit",
        action: "odrl:use",
        target: "dataset:registry",
        constraint: [
          { leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: purpose },
          { leftOperand: "odrl:dateTime", operator: "odrl:lt", rightOperand: until },
        ],
        duty: [{ action: "odrl:obtainConsent" }],
      },
    ],
    prohibition: [],
    ...extra,
  } as never;
}

describe("rule 2 with the version chain (owner card 2026-10-30 19:55Z)", () => {
  test("narrowerPurposeOrEarlierEndNarrows", () => {
    const base = agreement(V1, "PurposeOfUse", "2028-01-01");
    expect(isNarrowingAmendment(agreement(V2, "TREAT", "2028-01-01"), base)).toBe(true);
    expect(isNarrowingAmendment(agreement(V2, "PurposeOfUse", "2027-01-01"), base)).toBe(true);
    expect(isNarrowingAmendment(base, agreement(V2, "TREAT", "2028-01-01"))).toBe(false);
    expect(isNarrowingAmendment(agreement(V2, "PurposeOfUse", "2029-01-01"), base)).toBe(false);
  });

  test("droppingDutyOrProhibitionWidens", () => {
    const withProhibition = agreement(V1, "TREAT", "2028-01-01", {
      prohibition: [{ assignee: "org:research-unit", action: "odrl:distribute", target: "dataset:registry" }],
    });
    const noDuty = agreement(V2, "TREAT", "2028-01-01") as unknown as { permission: { duty?: unknown }[] };
    delete noDuty.permission[0].duty;
    expect(isNarrowingAmendment(noDuty as never, agreement(V1, "TREAT", "2028-01-01"))).toBe(false);
    expect(isNarrowingAmendment(agreement(V2, "TREAT", "2028-01-01"), withProhibition)).toBe(false);
    expect(isNarrowingAmendment(agreement(V2, "TREAT", "2028-01-01", { assignee: "org:other" }), agreement(V1, "TREAT", "2028-01-01"))).toBe(false);
  });

  test("earlierVersionCountsWhileNarrowing", () => {
    const narrowing = new Map<string, AgreementVersion>([
      [V1, { policy: agreement(V1, "PurposeOfUse", "2028-01-01") }],
      [V2, { policy: agreement(V2, "TREAT", "2028-01-01"), previousVersion: V1 }],
      [V3, { policy: agreement(V3, "TREAT", "2027-06-01"), previousVersion: V2 }],
    ]);
    expect([...versionsCoveredByConsent(V3, narrowing)]).toEqual([V3, V2, V1]);
    const evaluate = createPcfConsentEvaluator([consent("a", V1)], { agreementVersions: narrowing });
    expect(evaluate(req, undefined, undefined, { uid: V3 } as never)).toMatchObject({ verdict: "permit" });

    const widenedInMiddle = new Map<string, AgreementVersion>([
      [V1, { policy: agreement(V1, "TREAT", "2028-01-01") }],
      [V2, { policy: agreement(V2, "PurposeOfUse", "2028-01-01"), previousVersion: V1 }],
      [V3, { policy: agreement(V3, "TREAT", "2027-06-01"), previousVersion: V2 }],
    ]);
    expect([...versionsCoveredByConsent(V3, widenedInMiddle)]).toEqual([V3, V2]);
    const evaluate2 = createPcfConsentEvaluator([consent("a", V1)], { agreementVersions: widenedInMiddle });
    expect(evaluate2(req, undefined, undefined, { uid: V3 } as never)).toEqual({ verdict: "unknown" });
  });

  test("missingOrLoopStopsWalk", () => {
    const missing = new Map<string, AgreementVersion>([[V2, { policy: agreement(V2, "TREAT", "2028-01-01"), previousVersion: V1 }]]);
    expect([...versionsCoveredByConsent(V2, missing)]).toEqual([V2]);
    const loop = new Map<string, AgreementVersion>([
      [V1, { policy: agreement(V1, "TREAT", "2028-01-01"), previousVersion: V2 }],
      [V2, { policy: agreement(V2, "TREAT", "2028-01-01"), previousVersion: V1 }],
    ]);
    expect([...versionsCoveredByConsent(V2, loop)].sort()).toEqual([V1, V2]);
  });
});

describe("rule 4: cached registry results end when a Consent is withdrawn", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;
  let hits = 0;
  let status = "active";

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch() {
        hits++;
        const c = { ...consent("c1", V1), status };
        const entry = status === "active" ? [{ fullUrl: `${baseUrl}/Consent/c1`, resource: c, search: { mode: "match" } }] : [];
        return new Response(JSON.stringify({ resourceType: "Bundle", type: "searchset", total: entry.length, entry }), {
          headers: { "content-type": "application/fhir+json" },
        });
      },
    });
    baseUrl = `http://localhost:${server.port}`;
  });
  afterAll(() => server.stop(true));

  test("cacheServesUntilWithdrawn", async () => {
    let now = Date.parse("2026-06-15T12:00:00Z");
    const client = new Iti108ConsentClient(baseUrl, { now: "2026-06-15T12:00:00Z" }, { ttlMs: 60_000, clock: () => now });
    const first = await client.findAccessConsents({ patient: "Patient/p1" });
    expect(first.status).toBe("determined");
    await client.findAccessConsents({ patient: "Patient/p1" });
    expect(hits).toBe(1);

    status = "inactive";
    expect(client.consentWithdrawn("Consent/c1/_history/1")).toBe(1);
    const after = await client.findAccessConsents({ patient: "Patient/p1" });
    expect(hits).toBe(2);
    if (after.status !== "determined") throw new Error("expected determined");
    expect(after.consents).toEqual([]);

    now += 61_000;
    await client.findAccessConsents({ patient: "Patient/p1" });
    expect(hits).toBe(3);
  });

  test("cacheEndsAtProvisionEnd", async () => {
    status = "active";
    const before = hits;
    let now = Date.parse("2026-12-31T23:59:00Z");
    const client = new Iti108ConsentClient(baseUrl, { now: "2026-12-31T23:59:00Z" }, { ttlMs: 86_400_000, clock: () => now });
    await client.findAccessConsents({ patient: "Patient/p1" });
    now = Date.parse("2027-01-01T00:00:01Z");
    await client.findAccessConsents({ patient: "Patient/p1", now: "2027-01-01T00:00:01Z" });
    expect(hits).toBe(before + 2);
  });
});
