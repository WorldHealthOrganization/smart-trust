/**
 * Unit tests for IHE PCF 1.1.0 Consent → ODRL 2.2 translation (`consentToOdrl`)
 * and three-valued access-control decisions (`decide`), plus the four IHE PCF
 * Volume 1 §1:53.2.1 implicit-policy ODRL `Set`s (bean `jx7m`, PCF5).
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

import * as odrlModule from "@litlfred/cat-harness-tools/schemas/content/odrl.js";
import {
  OdrlPolicySchema,
  actionGraph,
  decide as odrlDecide,
  permits as odrlPermits,
  type OdrlPolicy,
  type PermitRequest,
} from "@litlfred/cat-harness-tools/schemas/content/odrl.js";
import { isConsentExpired as clientIsConsentExpired } from "./iti-108-consent-client.js";
import {
  ANYONE,
  CONSENT_DATA_MEANING_CODES,
  CONSENT_PROVISION_TYPE_CODES,
  CONSENT_STATE_CODES,
  FhirConsentSchema,
  FhirStrictConsentSchema,
  HL7_ACT_CODE_SYSTEM,
  HL7_ACT_REASON_SYSTEM,
  HL7_CONFIDENTIALITY_SYSTEM,
  HL7_CONSENT_SCOPE_SYSTEM,
  HL7_FHIR_R4_CORE_PACKAGE_ID,
  HL7_PARTICIPATION_TYPE_SYSTEM,
  HL7_PURPOSE_OF_USE,
  HL7_TERMINOLOGY_PACKAGE_ID,
  IHE_ITI_PCF_PACKAGE_ID,
  LOINC_CONSENT_CODE,
  LOINC_SYSTEM,
  PCF_BASIC_PURPOSES,
  PCF_CONSENT_ADVANCED_PROFILE,
  PCF_CONSENT_BASIC_PROFILE,
  PCF_CONSENT_INTERMEDIATE_PROFILE,
  PCF_IG_CANONICAL,
  PCF_IMPLICIT_ALL_NORMAL_SET,
  PCF_IMPLICIT_BASIC_NORMAL_SET,
  PCF_IMPLICIT_BREAK_GLASS_ONLY_SET,
  PCF_IMPLICIT_DENY_SET,
  PCF_IMPLICIT_POLICY_SETS,
  PCF_POLICY_ALL_NORMAL_URI,
  PCF_POLICY_BASIC_NORMAL_URI,
  PCF_POLICY_BREAK_GLASS_ONLY_URI,
  PCF_POLICY_DENY_URI,
  consentPolicyUid,
  consentToOdrl,
  createPcfConsentEvaluator,
  decide,
  decideWithCitation,
  detectPcfProfile,
  extractConsentCitation,
  getImplicitPolicySet,
  isConsentExpired,
  resolvePublishedFhirPackageFile,
  type FhirCoding,
  type FhirConsent,
  type FhirConsentProvision,
} from "./pcf-consent.js";

const TPO_PURPOSES: FhirCoding[] = PCF_BASIC_PURPOSES.map((code) => ({
  system: HL7_ACT_REASON_SYSTEM,
  code,
}));

function makeConsent(
  id: string,
  provision: FhirConsentProvision,
  overrides: Partial<FhirConsent> = {},
): FhirConsent {
  return {
    resourceType: "Consent",
    id,
    meta: {
      profile: [PCF_CONSENT_BASIC_PROFILE],
      ...(overrides.meta ?? {}),
    },
    status: "active",
    scope: {
      coding: [{ system: HL7_CONSENT_SCOPE_SYSTEM, code: "patient-privacy" }],
    },
    category: [
      {
        coding: [{ system: LOINC_SYSTEM, code: LOINC_CONSENT_CODE, display: "Consent" }],
      },
    ],
    patient: { reference: "Patient/ex-patient" },
    dateTime: "2022-06-13",
    performer: [{ reference: "Patient/ex-patient" }],
    organization: [{ reference: "Organization/ex-organization" }],
    sourceReference: { reference: "DocumentReference/ex-documentreference" },
    policy: [{ uri: "http://example.org/policies/basePrivacyConsentPolicy.txt" }],
    provision,
    ...overrides,
  };
}

describe("Four IHE PCF 1.1.0 Volume 1 §1:53.2.1 implicit-policy ODRL Sets", () => {
  test("exportsFourImplicitSets", () => {
    expect(Object.keys(PCF_IMPLICIT_POLICY_SETS)).toEqual([
      PCF_POLICY_BASIC_NORMAL_URI,
      PCF_POLICY_ALL_NORMAL_URI,
      PCF_POLICY_BREAK_GLASS_ONLY_URI,
      PCF_POLICY_DENY_URI,
    ]);
    for (const set of Object.values(PCF_IMPLICIT_POLICY_SETS)) {
      expect(set["@type"]).toBe("Set");
      expect(set.profile).toBe(PCF_IG_CANONICAL);
    }
    expect(getImplicitPolicySet(PCF_POLICY_BASIC_NORMAL_URI)).toBe(PCF_IMPLICIT_BASIC_NORMAL_SET);
    expect(getImplicitPolicySet("basic-normal")).toBe(PCF_IMPLICIT_BASIC_NORMAL_SET);
    expect(getImplicitPolicySet(PCF_POLICY_ALL_NORMAL_URI)).toBe(PCF_IMPLICIT_ALL_NORMAL_SET);
    expect(getImplicitPolicySet("opt-out")).toBe(PCF_IMPLICIT_ALL_NORMAL_SET);
    expect(getImplicitPolicySet(PCF_POLICY_BREAK_GLASS_ONLY_URI)).toBe(PCF_IMPLICIT_BREAK_GLASS_ONLY_SET);
    expect(getImplicitPolicySet("break-glass-only")).toBe(PCF_IMPLICIT_BREAK_GLASS_ONLY_SET);
    expect(getImplicitPolicySet(PCF_POLICY_DENY_URI)).toBe(PCF_IMPLICIT_DENY_SET);
    expect(getImplicitPolicySet("opt-in")).toBe(PCF_IMPLICIT_DENY_SET);
    expect(getImplicitPolicySet("nonexistent")).toBeUndefined();
  });

  test("basicNormalPermitsTreat", () => {
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe(
      "permit",
    );
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "ETREAT" })).toBe(
      "permit",
    );
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "BTG" })).toBe(
      "permit",
    );
    // In published v3-ActReason (hl7.terminology.r4#5.3.0), COC ("coordination of care"),
    // CLINTRL, and POPHLTH are subsumedBy TREAT, whereas CAREMGT is subsumedBy HOPERAT only.
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "COC" })).toBe(
      "permit",
    );
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "CLINTRL" })).toBe(
      "permit",
    );
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "POPHLTH" })).toBe(
      "permit",
    );
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "CAREMGT" })).toBe(
      "deny",
    );
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "HRESCH" })).toBe(
      "deny",
    );
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "HPAYMT" })).toBe(
      "deny",
    );
    expect(decide(PCF_IMPLICIT_BASIC_NORMAL_SET, { actor: "Practitioner/ex-practitioner" })).toBe("unknown");
  });

  test("allNormalPermitsAnyPurpose", () => {
    for (const purpose of ["TREAT", "HPAYMT", "HOPERAT", "HRESCH", "CLINTRCH", "PUBHLTH", "PATRQT", "BTG"]) {
      expect(decide(PCF_IMPLICIT_ALL_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose })).toBe("permit");
    }
    expect(decide(PCF_IMPLICIT_ALL_NORMAL_SET, { actor: "Practitioner/ex-practitioner", purpose: "dpv:ResearchAndDevelopment" })).toBe(
      "deny",
    );
    expect(decide(PCF_IMPLICIT_ALL_NORMAL_SET, { actor: "Practitioner/ex-practitioner" })).toBe("unknown");
  });

  test("breakGlassOnlyPermitsBtg", () => {
    expect(decide(PCF_IMPLICIT_BREAK_GLASS_ONLY_SET, { actor: "Practitioner/ex-practitioner", purpose: "BTG" })).toBe(
      "permit",
    );
    expect(decide(PCF_IMPLICIT_BREAK_GLASS_ONLY_SET, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe(
      "deny",
    );
    expect(decide(PCF_IMPLICIT_BREAK_GLASS_ONLY_SET, { actor: "Practitioner/ex-practitioner", purpose: "HRESCH" })).toBe(
      "deny",
    );
    expect(decide(PCF_IMPLICIT_BREAK_GLASS_ONLY_SET, { actor: "Practitioner/ex-practitioner" })).toBe("unknown");
  });

  test("denyPolicyDeniesAll", () => {
    expect(decide(PCF_IMPLICIT_DENY_SET, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe("deny");
    expect(decide(PCF_IMPLICIT_DENY_SET, { actor: "Practitioner/ex-practitioner", purpose: "BTG" })).toBe("deny");
    expect(decide(PCF_IMPLICIT_DENY_SET, { actor: "Practitioner/ex-practitioner" })).toBe("deny");
  });
});

describe("IHE PCF Basic Consent & Additional PurposeOfUse (consentToOdrl + decide)", () => {
  test("basicTreatTranslatesToIsARules", () => {
    const consent = makeConsent("ex-consent-basic-treat", {
      type: "permit",
      purpose: TPO_PURPOSES,
    });
    expect(detectPcfProfile(consent)).toBe(PCF_CONSENT_BASIC_PROFILE);

    const set = consentToOdrl(consent);
    expect(set["@type"]).toBe("Set");
    expect(set.uid).toBe("urn:ihe:pcf:consent:ex-consent-basic-treat");
    expect(set.assigner).toBe("Patient/ex-patient");
    expect(set.permission).toHaveLength(3);
    expect(set.prohibition).toHaveLength(0);
    expect(set.permission.map((r) => r.constraint?.[0])).toEqual([
      { leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: "TREAT" },
      { leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: "HPAYMT" },
      { leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: "HOPERAT" },
    ]);

    // Direct TPO codes and sub-codes permit
    for (const purpose of ["TREAT", "CLINTRL", "ETREAT", "BTG", "CAREMGT", "HPAYMT", "COVAUTH", "HOPERAT", "PATADMIN"]) {
      expect(decide(consent, { actor: "Practitioner/ex-practitioner", purpose })).toBe("permit");
    }
    // Non-TPO codes deny
    expect(decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "HRESCH" })).toBe("deny");
    expect(decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "HMARKT" })).toBe("deny");
    // Missing purpose -> unknown
    expect(decide(consent, { actor: "Practitioner/ex-practitioner" })).toBe("unknown");
  });

  test("citesPerformerAndVersion", () => {
    const consent = makeConsent(
      "ex-consent-basic-treat-infant",
      { type: "permit", purpose: TPO_PURPOSES },
      {
        meta: { versionId: "2", profile: [PCF_CONSENT_BASIC_PROFILE] },
        performer: [{ reference: "Patient/ex-mother" }],
      },
    );
    expect(consentPolicyUid(consent)).toBe("urn:ihe:pcf:consent:ex-consent-basic-treat-infant:v2");
    const citation = extractConsentCitation(consent);
    expect(citation).toEqual({
      id: "ex-consent-basic-treat-infant",
      versionId: "2",
      uid: "urn:ihe:pcf:consent:ex-consent-basic-treat-infant:v2",
      status: "active",
      patient: "Patient/ex-patient",
      performer: "Patient/ex-mother",
      policyUris: ["http://example.org/policies/basePrivacyConsentPolicy.txt"],
    });
    const set = consentToOdrl(consent);
    expect(set.assigner).toBe("Patient/ex-mother");
    expect(decide(set, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe("permit");
  });

  test("researchSubsumesSubConcepts", () => {
    const consent = makeConsent(
      "ex-consent-basic-research",
      {
        type: "permit",
        purpose: [{ system: HL7_ACT_REASON_SYSTEM, code: "HRESCH" }],
      },
      {
        policy: [{ uri: "http://example.org/policies/researchPrivacyConsentPolicy.txt" }],
      },
    );
    const set = consentToOdrl(consent);
    expect(set.permission).toEqual([
      {
        assignee: ANYONE,
        action: "odrl:use",
        constraint: [{ leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: "HRESCH" }],
      },
    ]);

    for (const researchCode of ["HRESCH", "BIORCH", "CLINTRCH", "CLINTRCHNPC", "CLINTRCHPC", "PRECLINTRCH", "DSRCH", "POARCH", "TRANSRCH"]) {
      expect(decide(consent, { actor: "Organization/ex-org-researcher", purpose: researchCode })).toBe("permit");
    }
    expect(decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe("deny");
    expect(decide(consent, { actor: "Organization/ex-org-researcher" })).toBe("unknown");
  });

  test("rejectTranslatesToProhibitions", () => {
    const consent = makeConsent("ex-consent-basic-reject", {
      type: "deny",
      purpose: TPO_PURPOSES,
    });
    const set = consentToOdrl(consent);
    expect(set.permission).toHaveLength(0);
    expect(set.prohibition).toHaveLength(3);

    expect(decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe("deny");
    expect(decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "HPAYMT" })).toBe("deny");
    expect(decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "HOPERAT" })).toBe("deny");
    expect(
      decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" }, { implicitPolicy: "all-normal" }),
    ).toBe("deny");
    expect(decide(consent, { actor: "Practitioner/ex-practitioner" })).toBe("unknown");
  });

  test("periodEnforcesExpiration", () => {
    const consent = makeConsent("ex-consent-expired-treat", {
      type: "permit",
      period: { end: "2022-12-31" },
      purpose: TPO_PURPOSES,
    });
    expect(isConsentExpired(consent, "2022-06-15")).toBe(false);
    expect(isConsentExpired(consent, "2022-12-31T18:00:00Z")).toBe(false);
    expect(isConsentExpired(consent, "2023-01-01")).toBe(true);

    // Inside validity period -> permit
    expect(
      decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", dateTime: "2022-06-15" }),
    ).toBe("permit");
    expect(
      decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", dateTime: "2022-12-31" }),
    ).toBe("permit");

    // Past period.end -> deny when no implicit policy, or fallback to implicit policy per PCF Vol 1 §1:53.4.2.5
    expect(
      decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", dateTime: "2023-01-01" }),
    ).toBe("deny");
    expect(
      decide(
        consent,
        { actor: "Practitioner/ex-practitioner", purpose: "TREAT", dateTime: "2023-01-01" },
        { implicitPolicy: "deny" },
      ),
    ).toBe("deny");
    expect(
      decide(
        consent,
        { actor: "Practitioner/ex-practitioner", purpose: "TREAT", dateTime: "2023-01-01" },
        { implicitPolicy: "basic-normal" },
      ),
    ).toBe("permit");

    // Missing dateTime when Consent has period -> unknown
    expect(decide(consent, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe("unknown");
  });

  test("nonActiveConsentIsUnknown", () => {
    expect(decide(null, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe("unknown");
    expect(
      decide(null, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" }, { implicitPolicy: "basic-normal" }),
    ).toBe("permit");
    expect(
      decide(null, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" }, { implicitPolicy: "deny" }),
    ).toBe("deny");

    for (const status of ["inactive", "rejected", "draft", "proposed", "entered-in-error"] as const) {
      const nonActive = makeConsent("ex-non-active", { type: "permit", purpose: TPO_PURPOSES }, { status });
      const set = consentToOdrl(nonActive);
      expect(set.permission).toEqual([]);
      expect(set.prohibition).toEqual([]);
      expect(decide(nonActive, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe("unknown");
    }
  });
});

describe("IHE PCF Intermediate & Advanced Consent examples (nested exceptions, data & securityLabel scoping)", () => {
  test("intermediatePurposeAndActor", () => {
    const consent = makeConsent(
      "ex-consent-intermediate-purpose",
      {
        type: "permit",
        actor: [
          {
            role: { coding: [{ system: HL7_PARTICIPATION_TYPE_SYSTEM, code: "IRCP" }] },
            reference: { reference: "Organization/ex-org-researcher" },
          },
        ],
        purpose: [{ system: "http://example.org/policies/purposeOfUse", code: "FooBar" }],
      },
      {
        meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] },
        policy: [{ uri: PCF_POLICY_BASIC_NORMAL_URI }],
      },
    );
    expect(detectPcfProfile(consent)).toBe(PCF_CONSENT_INTERMEDIATE_PROFILE);
    expect(decide(consent, { actor: "Organization/ex-org-researcher", purpose: "FooBar" })).toBe("permit");
    expect(decide(consent, { actor: "Organization/ex-other", purpose: "FooBar" })).toBe("deny");
    expect(decide(consent, { actor: "Organization/ex-org-researcher", purpose: "TREAT" })).toBe("deny");
    expect(decide(consent, { actor: null, purpose: "FooBar" })).toBe("unknown");
  });

  test("breakGlassNestedPermit", () => {
    const consent = makeConsent(
      "ex-dissent-intermediate-break-glass",
      {
        type: "deny",
        provision: [
          {
            type: "permit",
            actor: [
              {
                role: { coding: [{ system: HL7_PARTICIPATION_TYPE_SYSTEM, code: "IRCP" }] },
                reference: { reference: "Group/ex-privilegedUsers" },
              },
            ],
            purpose: [{ system: HL7_ACT_REASON_SYSTEM, code: "BTG" }],
          },
        ],
      },
      {
        meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] },
        policy: [{ uri: PCF_POLICY_BREAK_GLASS_ONLY_URI }],
      },
    );
    const set = consentToOdrl(consent);
    expect(set.conflict).toBe("odrl:perm");

    // Privileged user with BTG permits (directly or via actorGroups)
    expect(decide(consent, { actor: "Group/ex-privilegedUsers", purpose: "BTG" })).toBe("permit");
    expect(
      decide(consent, {
        actor: "Practitioner/ex-practitioner",
        actorGroups: ["Group/ex-privilegedUsers"],
        purpose: "BTG",
      }),
    ).toBe("permit");

    // Non-BTG purpose or non-privileged user denies
    expect(decide(consent, { actor: "Group/ex-privilegedUsers", purpose: "TREAT" })).toBe("deny");
    expect(decide(consent, { actor: "Practitioner/ex-clerk", purpose: "BTG" })).toBe("deny");
  });

  test("dataInstanceScoping", () => {
    const allowData = makeConsent(
      "ex-consent-intermediate-data",
      {
        type: "permit",
        purpose: TPO_PURPOSES,
        data: [
          { meaning: "instance", reference: { reference: "Encounter/ex-encounter" } },
          { meaning: "instance", reference: { reference: "Observation/ex-bloodPressure" } },
        ],
      },
      { meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] } },
    );
    expect(
      decide(allowData, {
        actor: "Practitioner/ex-practitioner",
        purpose: "TREAT",
        target: "Observation/ex-bloodPressure",
      }),
    ).toBe("permit");
    expect(
      decide(allowData, {
        actor: "Practitioner/ex-practitioner",
        purpose: "TREAT",
        target: "Observation/ex-alcoholUse",
      }),
    ).toBe("deny");
    expect(decide(allowData, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe("unknown");

    const denyData = makeConsent(
      "ex-consent-intermediate-not-data",
      {
        type: "permit",
        purpose: TPO_PURPOSES,
        provision: [
          {
            type: "deny",
            data: [{ meaning: "instance", reference: { reference: "Observation/ex-alcoholUse" } }],
          },
        ],
      },
      { meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] } },
    );
    expect(
      decide(denyData, {
        actor: "Practitioner/ex-practitioner",
        purpose: "TREAT",
        target: "Observation/ex-bloodPressure",
      }),
    ).toBe("permit");
    expect(
      decide(denyData, {
        actor: "Practitioner/ex-practitioner",
        purpose: "TREAT",
        target: "Observation/ex-alcoholUse",
      }),
    ).toBe("deny");
    expect(decide(denyData, { actor: "Practitioner/ex-practitioner", purpose: "TREAT" })).toBe("unknown");
  });

  test("authoredByEncounterTimeframe", () => {
    const notAuthor = makeConsent(
      "ex-consent-intermediate-not-authoredby",
      {
        type: "permit",
        purpose: TPO_PURPOSES,
        provision: [
          {
            type: "deny",
            data: [{ meaning: "authoredby", reference: { reference: "Practitioner/ex-practitioner" } }],
          },
        ],
      },
      { meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] } },
    );
    expect(
      decide(notAuthor, {
        actor: "Practitioner/ex-clerk",
        purpose: "TREAT",
        author: "Practitioner/ex-author",
      }),
    ).toBe("permit");
    expect(
      decide(notAuthor, {
        actor: "Practitioner/ex-clerk",
        purpose: "TREAT",
        author: "Practitioner/ex-practitioner",
      }),
    ).toBe("deny");

    const notEncounter = makeConsent(
      "ex-consent-intermediate-not-encounter",
      {
        type: "permit",
        purpose: TPO_PURPOSES,
        provision: [
          {
            type: "deny",
            data: [{ meaning: "related", reference: { reference: "Encounter/ex-encounter" } }],
          },
        ],
      },
      { meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] } },
    );
    expect(
      decide(notEncounter, {
        actor: "Practitioner/ex-practitioner",
        purpose: "TREAT",
        encounter: "Encounter/ex-other",
      }),
    ).toBe("permit");
    expect(
      decide(notEncounter, {
        actor: "Practitioner/ex-practitioner",
        purpose: "TREAT",
        encounter: "Encounter/ex-encounter",
      }),
    ).toBe("deny");

    const timeframe = makeConsent(
      "ex-consent-intermediate-timeframe",
      {
        type: "permit",
        purpose: TPO_PURPOSES,
        dataPeriod: { start: "2022-01-01", end: "2022-12-31" },
      },
      { meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] } },
    );
    expect(
      decide(timeframe, {
        actor: "Practitioner/ex-practitioner",
        purpose: "TREAT",
        dataPeriod: "2022-06-01",
      }),
    ).toBe("permit");
    expect(
      decide(timeframe, {
        actor: "Practitioner/ex-practitioner",
        purpose: "TREAT",
        dataPeriod: "2023-03-01",
      }),
    ).toBe("deny");
  });

  test("securityLabelScoping", () => {
    const focused = makeConsent(
      "ex-consent-advanced-normal-focused-psy-or-sdv",
      {
        type: "permit",
        securityLabel: [{ system: HL7_CONFIDENTIALITY_SYSTEM, code: "N" }],
        purpose: TPO_PURPOSES,
        provision: [
          {
            type: "permit",
            actor: [
              {
                role: { coding: [{ system: HL7_PARTICIPATION_TYPE_SYSTEM, code: "IRCP" }] },
                reference: { reference: "Practitioner/ex-practitioner" },
              },
            ],
            securityLabel: [
              { system: HL7_ACT_CODE_SYSTEM, code: "PSY" },
              { system: HL7_ACT_CODE_SYSTEM, code: "SDV" },
            ],
          },
        ],
      },
      { meta: { profile: [PCF_CONSENT_ADVANCED_PROFILE] } },
    );
    expect(detectPcfProfile(focused)).toBe(PCF_CONSENT_ADVANCED_PROFILE);
    expect(
      decide(focused, { actor: "Practitioner/ex-other", purpose: "TREAT", securityLabel: "N" }),
    ).toBe("permit");
    expect(
      decide(focused, { actor: "Practitioner/ex-other", purpose: "TREAT", securityLabel: "PSY" }),
    ).toBe("deny");
    expect(
      decide(focused, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "PSY" }),
    ).toBe("permit");
    expect(
      decide(focused, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "SDV" }),
    ).toBe("permit");

    const breakGlassAdv = makeConsent(
      "ex-consent-advanced-normal-break-glass-restricted",
      {
        type: "permit",
        securityLabel: [{ system: HL7_CONFIDENTIALITY_SYSTEM, code: "N" }],
        purpose: TPO_PURPOSES,
        provision: [
          {
            type: "permit",
            actor: [
              {
                role: { coding: [{ system: HL7_PARTICIPATION_TYPE_SYSTEM, code: "IRCP" }] },
                reference: { reference: "Group/ex-privilegedUsers" },
              },
            ],
            securityLabel: [{ system: HL7_CONFIDENTIALITY_SYSTEM, code: "R" }],
            purpose: [{ system: HL7_ACT_REASON_SYSTEM, code: "BTG" }],
          },
        ],
      },
      { meta: { profile: [PCF_CONSENT_ADVANCED_PROFILE] } },
    );
    expect(
      decide(breakGlassAdv, { actor: "Practitioner/ex-other", purpose: "TREAT", securityLabel: "N" }),
    ).toBe("permit");
    expect(
      decide(breakGlassAdv, { actor: "Practitioner/ex-other", purpose: "TREAT", securityLabel: "R" }),
    ).toBe("deny");
    expect(
      decide(breakGlassAdv, { actor: "Group/ex-privilegedUsers", purpose: "BTG", securityLabel: "R" }),
    ).toBe("permit");
    expect(
      decide(breakGlassAdv, { actor: "Group/ex-privilegedUsers", purpose: "TREAT", securityLabel: "R" }),
    ).toBe("deny");
  });


  test("remainingIntermediateAdvanced", () => {
    const authoredBy = makeConsent(
      "ex-consent-intermediate-authoredby",
      {
        type: "permit",
        purpose: TPO_PURPOSES,
        data: [{ meaning: "authoredby", reference: { reference: "Practitioner/ex-practitioner" } }],
      },
      { meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] } },
    );
    expect(
      decide(authoredBy, { actor: "Practitioner/ex-clerk", purpose: "TREAT", author: "Practitioner/ex-practitioner" }),
    ).toBe("permit");
    expect(
      decide(authoredBy, { actor: "Practitioner/ex-clerk", purpose: "TREAT", author: "Practitioner/ex-author" }),
    ).toBe("deny");
    expect(decide(authoredBy, { actor: "Practitioner/ex-clerk", purpose: "TREAT" })).toBe("unknown");

    const encounter = makeConsent(
      "ex-consent-intermediate-encounter",
      {
        type: "permit",
        purpose: TPO_PURPOSES,
        data: [{ meaning: "related", reference: { reference: "Encounter/ex-encounter" } }],
      },
      { meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] } },
    );
    expect(
      decide(encounter, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", encounter: "Encounter/ex-encounter" }),
    ).toBe("permit");
    expect(
      decide(encounter, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", encounter: "Encounter/ex-other" }),
    ).toBe("deny");

    const notTimeframe = makeConsent(
      "ex-consent-intermediate-not-timeframe",
      {
        type: "permit",
        purpose: TPO_PURPOSES,
        provision: [{ type: "deny", dataPeriod: { start: "2022-01-01", end: "2022-12-31" } }],
      },
      { meta: { profile: [PCF_CONSENT_INTERMEDIATE_PROFILE] } },
    );
    expect(
      decide(notTimeframe, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", dataPeriod: "2023-06-01" }),
    ).toBe("permit");
    expect(
      decide(notTimeframe, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", dataPeriod: "2022-06-01" }),
    ).toBe("deny");

    const advNormal = makeConsent(
      "ex-consent-advanced-normal",
      {
        type: "permit",
        securityLabel: [{ system: HL7_CONFIDENTIALITY_SYSTEM, code: "N" }],
        purpose: TPO_PURPOSES,
      },
      { meta: { profile: [PCF_CONSENT_ADVANCED_PROFILE] } },
    );
    expect(decide(advNormal, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "N" })).toBe(
      "permit",
    );
    expect(decide(advNormal, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "R" })).toBe(
      "deny",
    );

    const advNormalRestricted = makeConsent(
      "ex-consent-advanced-normal-restricted",
      {
        type: "permit",
        securityLabel: [
          { system: HL7_CONFIDENTIALITY_SYSTEM, code: "N" },
          { system: HL7_CONFIDENTIALITY_SYSTEM, code: "R" },
        ],
        purpose: TPO_PURPOSES,
      },
      { meta: { profile: [PCF_CONSENT_ADVANCED_PROFILE] } },
    );
    expect(
      decide(advNormalRestricted, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "N" }),
    ).toBe("permit");
    expect(
      decide(advNormalRestricted, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "R" }),
    ).toBe("permit");
    expect(
      decide(advNormalRestricted, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "V" }),
    ).toBe("deny");

    const advNotRestricted = makeConsent(
      "ex-consent-advanced-normal-not-restricted",
      {
        type: "permit",
        securityLabel: [{ system: HL7_CONFIDENTIALITY_SYSTEM, code: "N" }],
        purpose: TPO_PURPOSES,
        provision: [{ type: "deny", securityLabel: [{ system: HL7_CONFIDENTIALITY_SYSTEM, code: "R" }] }],
      },
      { meta: { profile: [PCF_CONSENT_ADVANCED_PROFILE] } },
    );
    expect(
      decide(advNotRestricted, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "N" }),
    ).toBe("permit");
    expect(
      decide(advNotRestricted, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "R" }),
    ).toBe("deny");

    const advFocusedRestricted = makeConsent(
      "ex-consent-advanced-normal-focused-restricted",
      {
        type: "permit",
        securityLabel: [{ system: HL7_CONFIDENTIALITY_SYSTEM, code: "N" }],
        purpose: TPO_PURPOSES,
        provision: [
          {
            type: "permit",
            actor: [{ reference: { reference: "Practitioner/ex-practitioner" } }],
            securityLabel: [{ system: HL7_CONFIDENTIALITY_SYSTEM, code: "R" }],
          },
        ],
      },
      { meta: { profile: [PCF_CONSENT_ADVANCED_PROFILE] } },
    );
    expect(
      decide(advFocusedRestricted, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "R" }),
    ).toBe("permit");
    expect(
      decide(advFocusedRestricted, { actor: "Practitioner/ex-other", purpose: "TREAT", securityLabel: "R" }),
    ).toBe("deny");

    const advFocusedPsy = makeConsent(
      "ex-consent-advanced-normal-focused-psy",
      {
        type: "permit",
        securityLabel: [{ system: HL7_CONFIDENTIALITY_SYSTEM, code: "N" }],
        purpose: TPO_PURPOSES,
        provision: [
          {
            type: "permit",
            actor: [{ reference: { reference: "Practitioner/ex-practitioner" } }],
            securityLabel: [{ system: HL7_ACT_CODE_SYSTEM, code: "PSY" }],
          },
        ],
      },
      { meta: { profile: [PCF_CONSENT_ADVANCED_PROFILE] } },
    );
    expect(
      decide(advFocusedPsy, { actor: "Practitioner/ex-practitioner", purpose: "TREAT", securityLabel: "PSY" }),
    ).toBe("permit");
    expect(
      decide(advFocusedPsy, { actor: "Practitioner/ex-other", purpose: "TREAT", securityLabel: "PSY" }),
    ).toBe("deny");
  });
});

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPPORT_PCF_DIR = resolve(HERE, "..", "test", "support", "pcf");
const PCF_EXAMPLES_DIR = dirname(
  resolvePublishedFhirPackageFile(IHE_ITI_PCF_PACKAGE_ID, "example/Consent-ex-consent-basic-treat.json"),
);

describe("Published ihe.iti.pcf#1.1.0 package Consent examples sweep", () => {
  test("packageExamplesValidateAndDecide", () => {
    const files = readdirSync(PCF_EXAMPLES_DIR)
      .filter((f) => f.startsWith("Consent-") && f.endsWith(".json"))
      .sort();
    expect(files.length).toBe(23);

    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(PCF_EXAMPLES_DIR, file), "utf-8"));
      const parsed = FhirStrictConsentSchema.safeParse(raw);
      expect(parsed.success).toBe(true);

      const consent = parsed.data!;
      const set = consentToOdrl(consent);
      expect(set["@type"]).toBe("Set");
      expect(set.permission.length + set.prohibition.length).toBeGreaterThan(0);

      // Missing scope always yields unknown
      expect(decide(consent, { actor: null })).toBe("unknown");
    }
  });
});

describe("Published package provenance, v3-ActReason hierarchy, R4 Consent schema, and injected ConsentEvaluator (bean 6jnx)", () => {
  test("supportFilesMatchSha", () => {
    const prov = JSON.parse(readFileSync(join(SUPPORT_PCF_DIR, "provenance.json"), "utf-8")) as {
      packages: Record<string, { files: Record<string, { sha256: string }> }>;
    };
    expect(Object.keys(prov.packages).sort()).toEqual([
      HL7_FHIR_R4_CORE_PACKAGE_ID,
      "hl7.fhir.r5.core#5.0.0",
      HL7_TERMINOLOGY_PACKAGE_ID,
      IHE_ITI_PCF_PACKAGE_ID,
    ]);
    for (const [pkgId, pkgMeta] of Object.entries(prov.packages)) {
      const fileEntries = Object.entries(pkgMeta.files);
      expect(fileEntries.length).toBeGreaterThan(0);
      for (const [relPath, meta] of fileEntries) {
        const bytes = readFileSync(join(SUPPORT_PCF_DIR, pkgId, relPath));
        const actualSha = createHash("sha256").update(bytes).digest("hex");
        expect(actualSha).toBe(meta.sha256);
      }
    }
  });

  test("purposeOfUseFromTerminology", () => {
    expect(Object.keys(HL7_PURPOSE_OF_USE).length).toBe(60);
    // CLINTRL ("clinical trial" health care), POPHLTH ("population health"), and COC ("coordination of care")
    // have subsumedBy: TREAT in v3-ActReason:
    expect(HL7_PURPOSE_OF_USE.CLINTRL).toEqual(["TREAT"]);
    expect(HL7_PURPOSE_OF_USE.POPHLTH).toEqual(["TREAT"]);
    expect(HL7_PURPOSE_OF_USE.COC).toEqual(["TREAT"]);
    // CAREMGT has subsumedBy: HOPERAT only (not TREAT):
    expect(HL7_PURPOSE_OF_USE.CAREMGT).toEqual(["HOPERAT"]);
    // HTEST is subsumedBy SYSDEV (-> HOPERAT); LABELING and METAMGT are subsumedBy HSYSADMIN (-> HOPERAT):
    expect(HL7_PURPOSE_OF_USE.HTEST).toEqual(["SYSDEV"]);
    expect(HL7_PURPOSE_OF_USE.SYSDEV).toEqual(["HOPERAT"]);
    expect(HL7_PURPOSE_OF_USE.LABELING).toEqual(["HSYSADMIN"]);
    expect(HL7_PURPOSE_OF_USE.METAMGT).toEqual(["HSYSADMIN"]);
    expect(HL7_PURPOSE_OF_USE.HSYSADMIN).toEqual(["HOPERAT"]);
    // HAAUTH does not exist in v3-ActReason:
    expect("HAAUTH" in HL7_PURPOSE_OF_USE).toBe(false);

    // Transitive subsumption via SYSDEV -> HOPERAT and HSYSADMIN -> HOPERAT:
    const hoperatConsent = makeConsent("ex-hoperat-only", {
      type: "permit",
      purpose: [{ system: HL7_ACT_REASON_SYSTEM, code: "HOPERAT" }],
    });
    expect(decide(hoperatConsent, { actor: "Practitioner/ex-practitioner", purpose: "HTEST" })).toBe("permit");
    expect(decide(hoperatConsent, { actor: "Practitioner/ex-practitioner", purpose: "LABELING" })).toBe("permit");
    expect(decide(hoperatConsent, { actor: "Practitioner/ex-practitioner", purpose: "METAMGT" })).toBe("permit");
  });

  test("consentSchemaFromR4Core", () => {
    expect(isConsentExpired).toBe(clientIsConsentExpired);
    expect([...CONSENT_STATE_CODES]).toEqual([
      "draft",
      "proposed",
      "active",
      "rejected",
      "inactive",
      "entered-in-error",
    ]);
    expect([...CONSENT_PROVISION_TYPE_CODES]).toEqual(["deny", "permit"]);
    expect([...CONSENT_DATA_MEANING_CODES]).toEqual(["instance", "related", "dependents", "authoredby"]);

    // Rejects invalid status, invalid provision.type, invalid data.meaning, and unknown elements
    expect(
      FhirConsentSchema.safeParse({
        resourceType: "Consent",
        status: "not-a-valid-status",
      }).success,
    ).toBe(false);
    expect(
      FhirConsentSchema.safeParse({
        resourceType: "Consent",
        status: "active",
        provision: { type: "maybe" },
      }).success,
    ).toBe(false);
    expect(
      FhirConsentSchema.safeParse({
        resourceType: "Consent",
        status: "active",
        provision: {
          type: "permit",
          data: [{ meaning: "bogus", reference: { reference: "Patient/ex-patient" } }],
        },
      }).success,
    ).toBe(false);
    expect(
      FhirConsentSchema.safeParse({
        resourceType: "Consent",
        status: "active",
        notAnR4ConsentElement: true,
      }).success,
    ).toBe(false);

    // Source files contain no hand-typed HL7_PURPOSE_OF_USE literal and no hand-written FhirConsent interface
    const pcfSrc = readFileSync(join(HERE, "pcf-consent.ts"), "utf-8");
    const clientSrc = readFileSync(join(HERE, "iti-108-consent-client.ts"), "utf-8");
    expect(pcfSrc).not.toMatch(/export\s+interface\s+FhirConsent\b/);
    expect(pcfSrc).not.toMatch(/HL7_PURPOSE_OF_USE[^=]*=\s*\{/);
    expect(clientSrc).not.toMatch(/function\s+isConsentExpired\b/);
    expect(clientSrc).not.toMatch(/z\.literal\(["']Consent["']\)/);
  });

  test("evaluatorIntegratesObtainConsentDuty", () => {
    const g = actionGraph([{ id: "read-dataset", includedIn: ["odrl:use"] }]);
    const dsa = OdrlPolicySchema.parse({
      "@context": "http://www.w3.org/ns/odrl.jsonld",
      "@type": "Agreement",
      uid: "urn:dsa:pcf6",
      profile: "https://litlfred.github.io/cat-harness/policies/profile",
      assigner: "org:who",
      assignee: "Practitioner/ex-practitioner",
      permission: [
        {
          assignee: "Practitioner/ex-practitioner",
          action: "odrl:use",
          target: "Patient/ex-patient",
          constraint: [{ leftOperand: "odrl:purpose", operator: "odrl:isA", rightOperand: "PurposeOfUse" }],
          duty: [{ action: "odrl:obtainConsent" }],
        },
      ],
    });
    const policies = new Map<string, OdrlPolicy>([[dsa.uid, dsa]]);

    const activePermitConsent = makeConsent(
      "c-basic-treat",
      {
        type: "permit",
        period: { start: "2026-01-01", end: "2026-12-31" },
        actor: [{ reference: { reference: "Practitioner/ex-practitioner" } }],
        purpose: [{ system: HL7_ACT_REASON_SYSTEM, code: "TREAT" }],
        data: [{ meaning: "instance", reference: { reference: "Patient/ex-patient" } }],
      },
      // Owner rule 2 (2026-10-30 19:27Z): a Consent cites the agreement version it is for.
      { meta: { versionId: "3", profile: [PCF_CONSENT_BASIC_PROFILE] }, policy: [{ uri: dsa.uid }] },
    );

    const activeDenyConsent = makeConsent(
      "c-dissent",
      { type: "deny" },
      { meta: { versionId: "2", profile: [PCF_CONSENT_BASIC_PROFILE] }, policy: [{ uri: dsa.uid }] },
    );

    const inactiveConsent = makeConsent(
      "c-inactive",
      { type: "permit", purpose: TPO_PURPOSES },
      { status: "inactive" },
    );

    const baseReq = {
      actor: "Practitioner/ex-practitioner",
      action: "read-dataset",
      scope: {
        target: "Patient/ex-patient",
        "odrl:purpose": "ETREAT",
        "odrl:dateTime": "2026-06-15T12:00:00Z",
      },
    };

    const withConsent = (consentInput: FhirConsent | null): PermitRequest =>
      ({
        ...baseReq,
        consentEvaluator: createPcfConsentEvaluator(consentInput, { actionGraph: g }),
        consent: consentInput,
      }) as unknown as PermitRequest;

    // 1. DSA + no Consent (or inactive Consent) -> unknown
    expect(odrlPermits(withConsent(null), dsa, policies, g)).toBe("unknown");
    expect(odrlPermits(withConsent(inactiveConsent), dsa, policies, g)).toBe("unknown");
    expect(createPcfConsentEvaluator(null, { actionGraph: g })(baseReq)).toEqual({
      verdict: "unknown",
    });

    // 2. DSA + deny Consent -> deny + deciding Consent citation
    expect(odrlPermits(withConsent(activeDenyConsent), dsa, policies, g)).toBe("deny");
    expect(
      createPcfConsentEvaluator(activeDenyConsent, { actionGraph: g })(
        baseReq,
        { action: "odrl:obtainConsent" },
        dsa.permission[0]!,
        dsa,
      ),
    ).toEqual({
      verdict: "deny",
      consent: {
        id: "c-dissent",
        versionId: "2",
        uid: "urn:ihe:pcf:consent:c-dissent:v2",
      },
    });

    // 3. DSA + matching active permit Consent -> permit + deciding Consent citation
    expect(odrlPermits(withConsent(activePermitConsent), dsa, policies, g)).toBe("permit");
    expect(odrlDecide(withConsent(activePermitConsent), policies, g)).toBe("permit");
    expect(
      decideWithCitation(
        activePermitConsent,
        {
          actor: "Practitioner/ex-practitioner",
          action: "read-dataset",
          scope: baseReq.scope,
        },
        { actionGraph: g },
      ),
    ).toEqual({
      verdict: "permit",
      consent: {
        id: "c-basic-treat",
        versionId: "3",
        uid: "urn:ihe:pcf:consent:c-basic-treat:v3",
      },
    });

    if ("permitsWithConsent" in odrlModule && typeof odrlModule.permitsWithConsent === "function") {
      expect(odrlModule.permitsWithConsent(withConsent(activePermitConsent), dsa, policies, g)).toEqual({
        decision: "permit",
        consent: {
          id: "c-basic-treat",
          versionId: "3",
          uid: "urn:ihe:pcf:consent:c-basic-treat:v3",
        },
      });
    }
  });
});
