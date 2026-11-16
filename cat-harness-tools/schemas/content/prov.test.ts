/**
 * W3C PROV-O decision records: agreement + grant citations and hash-chained log
 * (DSA B4, bean `3z44`) and IHE PCF Consent `id` + `versionId` citations on
 * consent-based decisions (PCF8, bean `2egb`).
 */
import { describe, expect, test } from "bun:test";
import {
  ProvActivitySchema,
  ProvConsentDecisionRecordSchema,
  ProvConsentRefSchema,
  ProvDecisionRecordSchema,
  agreementDistribution,
  agreementsCited,
  grantCredential,
  grantsCited,
  ProvAgreementDistributionSchema,
  appendProvDecisionRecord,
  buildProvHashChain,
  stampProvDecisionRecord,
  verifyProvHashChain,
} from "./prov.ts";

const run = {
  "@type": "prov:Activity" as const,
  "@id": "urn:uuid:00000000-0000-4000-8000-000000000001",
  "prov:startedAtTime": "2026-09-23T19:30:00Z",
  "prov:qualifiedAssociation": {
    "prov:agent": "owner",
    "prov:hadRole": "maintainer",
    "prov:hadPlan": "code-change-review#Task_merge",
  },
  "prov:used": ["cat-harness/schemas/content/odrl.ts"],
  "prov:generated": ["cat-harness/policies/cat-harness.jsonld"],
  "cat-harness:underPolicy": "https://litlfred.github.io/notebooks/vocab/cat-harness/policies/cat-harness",
};

describe("PROV-O decision records and hash chain (DSA B4, bean 3z44)", () => {
  test("DSA B4 decision records cite agreement URL + SHA-256 (and optional grant) and enforce the hash chain", () => {
    const agreement = agreementDistribution(
      "https://example.org/agreements/who-ministry-dsa-v1#pdf",
      "a".repeat(64),
      "https://example.org/agreements/who-ministry-dsa-v1.pdf",
    );
    const grant = grantCredential("urn:uuid:3978344f-8596-4c3a-a978-8fcaba3903c5");
    const used = (...x: unknown[]) => ({ "prov:used": [...run["prov:used"], ...x] as never });

    // Every decision record must cite its agreement (prov:used DCAT distribution + spdx:checksum) and hash
    expect(ProvDecisionRecordSchema.safeParse(run).success).toBe(false);

    const chain = buildProvHashChain([
      { ...run, "@id": "urn:run:1", ...used(agreement, grant) },
      { ...run, "@id": "urn:run:2", "prov:startedAtTime": "2026-09-23T19:40:00Z", ...used(agreement) },
    ]);
    const fullChain = appendProvDecisionRecord(chain, {
      ...run,
      "@id": "urn:run:3",
      "prov:startedAtTime": "2026-09-23T19:45:00Z",
      ...used(agreement),
    });

    expect(fullChain).toHaveLength(3);
    expect(fullChain[0]!["cat-harness:previousHash"]).toBeNull();
    expect(fullChain[1]!["cat-harness:previousHash"]).toBe(fullChain[0]!["cat-harness:recordHash"]);
    expect(fullChain[2]!["cat-harness:previousHash"]).toBe(fullChain[1]!["cat-harness:recordHash"]);
    expect(verifyProvHashChain(fullChain).valid).toBe(true);

    // The agreement and grant are standard-term prov:used entities, not fields of ours
    expect(agreementsCited(fullChain[0]!)).toEqual([agreement]);
    expect(grantsCited(fullChain[0]!)).toEqual([grant]);
    expect(agreement["spdx:checksum"]).toEqual({
      "@type": "spdx:Checksum",
      "spdx:algorithm": "spdx:checksumAlgorithm_sha256",
      "spdx:checksumValue": "a".repeat(64),
    });
    expect(Object.keys(fullChain[0]!).filter((k) => /agreement|grant/.test(k))).toEqual([]);

    // A record whose only "agreement" is a plain string is not an agreement citation
    expect(() => buildProvHashChain([{ ...run, "@id": "urn:run:s" }] as never)).toThrow(/agreement/);
    expect(
      ProvAgreementDistributionSchema.safeParse({ ...agreement, "spdx:checksum": { ...agreement["spdx:checksum"], "spdx:checksumValue": "abcd" } })
        .success,
    ).toBe(false);
    expect(ProvAgreementDistributionSchema.safeParse({ ...agreement, "@id": "not-an-iri" }).success).toBe(false);

    // Swapping the agreement text's checksum breaks the chain
    const swapped = [
      {
        ...fullChain[0]!,
        "prov:used": [
          ...run["prov:used"],
          agreementDistribution("https://example.org/agreements/who-ministry-dsa-v1#pdf", "c".repeat(64)),
          grant,
        ],
      },
      fullChain[1]!,
      fullChain[2]!,
    ];
    expect(verifyProvHashChain(swapped).errors.some((e) => e.kind === "hash-mismatch")).toBe(true);

    // Editing any past record fails the chain check
    const edited = [
      { ...fullChain[0]!, "prov:used": ["tampered-dataset"] },
      fullChain[1]!,
      fullChain[2]!,
    ];
    const editRes = verifyProvHashChain(edited);
    expect(editRes.valid).toBe(false);
    expect(editRes.errors.some((e) => e.kind === "hash-mismatch")).toBe(true);

    // Removing the first record fails the chain check (genesis previousHash !== null)
    const removedFirst = [fullChain[1]!, fullChain[2]!];
    const remFirstRes = verifyProvHashChain(removedFirst);
    expect(remFirstRes.valid).toBe(false);
    expect(remFirstRes.errors.some((e) => e.kind === "broken-link")).toBe(true);

    // Removing a middle record fails the chain check (previousHash link mismatch)
    const removedMiddle = [fullChain[0]!, fullChain[2]!];
    const remMiddleRes = verifyProvHashChain(removedMiddle);
    expect(remMiddleRes.valid).toBe(false);
    expect(remMiddleRes.errors.some((e) => e.kind === "broken-link")).toBe(true);

    // Removing a record when expectedHeadHash or expectedCount is pinned also fails
    const removedLast = [fullChain[0]!, fullChain[1]!];
    expect(
      verifyProvHashChain(removedLast, { expectedHeadHash: fullChain[2]!["cat-harness:recordHash"] }).valid,
    ).toBe(false);
    expect(verifyProvHashChain(removedLast, { expectedCount: 3 }).valid).toBe(false);
  });
});

describe("PROV decision record cites Consent id + versionId (PCF8, bean 2egb)", () => {
  const agreement = agreementDistribution("https://example.org/agreements/who-ministry-dsa-v1#pdf", "b".repeat(64));
  const used = { "prov:used": [...run["prov:used"], agreement] as never };

  test("ProvConsentRefSchema requires non-empty id and versionId", () => {
    expect(ProvConsentRefSchema.safeParse({ id: "consent-basic-1", versionId: "3" }).success).toBe(true);
    expect(ProvConsentRefSchema.safeParse({ id: "consent-basic-1" }).success).toBe(false);
    expect(ProvConsentRefSchema.safeParse({ versionId: "3" }).success).toBe(false);
    expect(ProvConsentRefSchema.safeParse({ id: "", versionId: "3" }).success).toBe(false);
    expect(ProvConsentRefSchema.safeParse({ id: "consent-basic-1", versionId: "" }).success).toBe(false);
  });

  test("every consent-based decision names its Consent (id + versionId)", () => {
    const consent = { id: "ex-consent-basic-treat", versionId: "2" };

    // A consent-based decision record WITH Consent id + versionId validates
    const stamped = stampProvDecisionRecord({
      ...run,
      "@id": "urn:run:consent-1",
      "cat-harness:underPolicy": ["urn:dsa:pcf6", "urn:ihe:pcf:consent:ex-consent-basic-treat:v2"],
      ...used,
      "cat-harness:consent": consent,
      "cat-harness:consentBased": true,
    });
    expect(stamped["cat-harness:consent"]).toEqual(consent);
    expect(ProvConsentDecisionRecordSchema.safeParse(stamped).success).toBe(true);

    // A consent-based decision record WITHOUT Consent fails schema validation
    expect(
      ProvActivitySchema.safeParse({
        ...run,
        "cat-harness:consentBased": true,
      }).success,
    ).toBe(false);
    expect(
      ProvActivitySchema.safeParse({
        ...run,
        "cat-harness:underPolicy": ["urn:dsa:pcf6", "urn:ihe:pcf:consent:ex-consent-basic-treat:v2"],
      }).success,
    ).toBe(false);
    expect(() =>
      stampProvDecisionRecord({
        ...run,
        ...used,
        "cat-harness:consentBased": true,
      }),
    ).toThrow(/Consent/);

    // verifyProvHashChain enforces Consent citation on consent-based decisions and detects tampering
    const chain = buildProvHashChain([
      {
        ...run,
        "@id": "urn:run:c1",
        "cat-harness:underPolicy": "urn:dsa:pcf6",
        ...used,
        "cat-harness:consent": { id: "c-101", versionId: "1" },
        "cat-harness:consentBased": true,
      },
      {
        ...run,
        "@id": "urn:run:c2",
        "prov:startedAtTime": "2026-09-23T19:40:00Z",
        "cat-harness:underPolicy": "urn:dsa:pcf6",
        ...used,
        "cat-harness:consent": { id: "c-101", versionId: "2" },
        "cat-harness:consentBased": true,
      },
    ]);
    expect(verifyProvHashChain(chain, { requireConsent: true }).valid).toBe(true);
    expect(verifyProvHashChain(chain, { consentPolicyUids: ["urn:dsa:pcf6"] }).valid).toBe(true);

    // Stripping cat-harness:consent or altering versionId fails verifyProvHashChain
    const strippedConsent = [
      (() => {
        const copy = { ...chain[0]! } as Record<string, unknown>;
        delete copy["cat-harness:consent"];
        return copy;
      })(),
      chain[1]!,
    ];
    const strippedRes = verifyProvHashChain(strippedConsent, { consentPolicyUids: ["urn:dsa:pcf6"] });
    expect(strippedRes.valid).toBe(false);
    expect(strippedRes.errors.some((e) => e.kind === "missing-consent")).toBe(true);

    const tamperedVersion = [
      { ...chain[0]!, "cat-harness:consent": { id: "c-101", versionId: "99" } },
      chain[1]!,
    ];
    const tamperedRes = verifyProvHashChain(tamperedVersion, { requireConsent: true });
    expect(tamperedRes.valid).toBe(false);
    expect(tamperedRes.errors.some((e) => e.kind === "hash-mismatch")).toBe(true);
  });
});
