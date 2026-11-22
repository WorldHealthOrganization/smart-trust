/**
 * Unit tests for the one-way ODRL 2.2 Agreement → HL7 FHIR R5 Permission
 * renderer (`odrlAgreementToFhirR5Permission`, bean `folio-assistant-jfbm`,
 * issue `litlfred/folio-assistant#2702`).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import {
  FhirR5PermissionSchema,
  HL7_CONSENT_ACTION_SYSTEM,
  HL7_FHIR_R5_CORE_PACKAGE_ID,
  PERMISSION_RULE_COMBINING_CODES,
  PERMISSION_STATUS_CODES,
  R5_CONSENT_DATA_MEANING_CODES,
  R5_CONSENT_PROVISION_TYPE_CODES,
  RFC_3986_URI_SYSTEM,
  fhirR5PermissionToFsh,
  odrlAgreementToFhirR5Permission,
} from "./odrl-to-fhir-r5-permission.js";
import { HL7_ACT_CODE_SYSTEM, HL7_ACT_REASON_SYSTEM } from "./pcf-consent.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Worked example 1: DSA-042 v1 & dcat.jsonld from folio-assistant-core (bean 2z1t). */
const DSA_042_V1_AGREEMENT = {
  "@context": [
    "http://www.w3.org/ns/odrl.jsonld",
    {
      odrl: "http://www.w3.org/ns/odrl/2/",
      dcterms: "http://purl.org/dc/terms/",
    },
  ],
  "@type": "Agreement",
  uid: "https://example.org/dsa/042/v1",
  assigner: "https://example.org/org/fnphi",
  assignee: "https://example.org/org/frec",
  "dcterms:source": "https://example.org/dsa/042/v1/agreement.md",
  permission: [
    {
      assignee: "https://example.org/org/frec",
      action: "odrl:use",
      target: "https://example.org/datasets/respiratory-surveillance-2026",
      constraint: [
        {
          leftOperand: "odrl:purpose",
          operator: "odrl:isA",
          rightOperand: "PUBHLTH",
        },
        {
          leftOperand: "odrl:dateTime",
          operator: "odrl:lteq",
          rightOperand: "2026-12-31T23:59:59Z",
        },
      ],
      duty: [
        {
          action: "odrl:delete",
          target: "https://example.org/datasets/respiratory-surveillance-2026",
        },
      ],
    },
  ],
} as const;

const DSA_042_V1_DCAT = {
  "@context": {
    dcat: "http://www.w3.org/ns/dcat#",
    dcterms: "http://purl.org/dc/terms/",
    spdx: "http://spdx.org/rdf/terms#",
    odrl: "http://www.w3.org/ns/odrl/2/",
    adms: "http://www.w3.org/ns/adms#",
  },
  "@type": "dcat:Resource",
  "@id": "https://example.org/dsa/042/v1",
  "dcterms:title": "Public Health Data Sharing Agreement DSA-042 (Version 1.0)",
  "dcterms:description":
    "Fictional public data sharing agreement between FNPHI and FREC for respiratory surveillance data.",
  "dcterms:issued": "2026-01-15",
  "dcat:version": "1.0",
  "adms:status": {
    "@id": "http://purl.org/adms/status/Completed",
  },
  "odrl:hasPolicy": {
    "@id": "https://example.org/dsa/042/v1",
  },
  "dcat:distribution": [
    {
      "@type": "dcat:Distribution",
      "@id": "https://example.org/dsa/042/v1/agreement.md",
      "dcterms:title": "Signed legal text of DSA-042 v1.0",
      "dcat:downloadURL": "https://example.org/dsa/042/v1/agreement.md",
      "dcat:mediaType": "text/markdown",
      "spdx:checksum": {
        "@type": "spdx:Checksum",
        "spdx:algorithm": {
          "@id": "http://spdx.org/rdf/terms#checksumAlgorithm_sha256",
        },
        "spdx:checksumValue": "909635085f5af64b7da8be004c051cf11af3662ff13aa9165b4c1d69b7adf22f",
      },
    },
  ],
} as const;

/** Worked example 2: DSAPermissionExample (Agreement 42 v3) from smart-trust-phw#10. */
const PHW_DSA_42_V3_AGREEMENT = {
  "@context": "http://www.w3.org/ns/odrl.jsonld",
  "@type": "Agreement",
  uid: "https://ministry-m.example.org/dsa/42/v3",
  conflict: "prohibit",
  assigner: "https://ministry-m.example.org/",
  assignee: "https://institute-i.example.org/",
  permission: [
    {
      target: "https://ministry-m.example.org/dataset/immunization-coverage",
      action: "use",
      constraint: [
        {
          leftOperand: "purpose",
          operator: "isA",
          rightOperand: "http://terminology.hl7.org/CodeSystem/v3-ActReason#PUBHLTH",
        },
        { leftOperand: "dateTime", operator: "gteq", rightOperand: "2026-01-01" },
        { leftOperand: "dateTime", operator: "lt", rightOperand: "2028-01-01" },
      ],
      duty: [
        {
          action: "delete",
          constraint: [{ leftOperand: "dateTime", operator: "lt", rightOperand: "2028-04-01" }],
        },
        { action: "inform", informedParty: "https://ministry-m.example.org/" },
      ],
    },
  ],
  prohibition: [
    {
      target: "https://ministry-m.example.org/dataset/immunization-coverage",
      action: "distribute",
    },
  ],
} as const;

describe("One-way ODRL 2.2 Agreement → FHIR R5 Permission renderer (bean jfbm)", () => {
  test("workedExamplesRenderValidPermissions", () => {
    // 1a. DSA-042 v1 + DCAT 3 record
    const res042 = odrlAgreementToFhirR5Permission(DSA_042_V1_AGREEMENT, {
      id: "Permission-DSA-042-v1",
      dcat: DSA_042_V1_DCAT,
    });

    expect(FhirR5PermissionSchema.safeParse(res042.permission).success).toBe(true);
    expect(res042.permission).toEqual({
      resourceType: "Permission",
      id: "Permission-DSA-042-v1",
      status: "active",
      asserter: {
        identifier: {
          system: RFC_3986_URI_SYSTEM,
          value: "https://example.org/org/fnphi",
        },
      },
      date: ["2026-01-15"],
      validity: {
        end: "2026-12-31T23:59:59Z",
      },
      justification: {
        basis: [
          {
            coding: [
              {
                system: RFC_3986_URI_SYSTEM,
                code: "https://example.org/dsa/042/v1/agreement.md",
              },
            ],
            text: "https://example.org/dsa/042/v1/agreement.md",
          },
        ],
        evidence: [
          {
            identifier: {
              system: RFC_3986_URI_SYSTEM,
              value: "https://example.org/dsa/042/v1",
            },
            display: "Public Health Data Sharing Agreement DSA-042 (Version 1.0)",
          },
          {
            identifier: {
              system: RFC_3986_URI_SYSTEM,
              value: "https://example.org/dsa/042/v1/agreement.md",
            },
            display: "https://example.org/dsa/042/v1/agreement.md",
          },
        ],
      },
      combining: "deny-overrides",
      rule: [
        {
          type: "permit",
          data: [
            {
              resource: [
                {
                  meaning: "instance",
                  reference: {
                    identifier: {
                      system: RFC_3986_URI_SYSTEM,
                      value: "https://example.org/datasets/respiratory-surveillance-2026",
                    },
                  },
                },
              ],
            },
          ],
          activity: [
            {
              actor: [
                {
                  identifier: {
                    system: RFC_3986_URI_SYSTEM,
                    value: "https://example.org/org/frec",
                  },
                },
              ],
              action: [
                {
                  coding: [
                    {
                      system: HL7_CONSENT_ACTION_SYSTEM,
                      code: "use",
                      display: "use",
                    },
                  ],
                },
              ],
              purpose: [
                {
                  coding: [
                    {
                      system: HL7_ACT_REASON_SYSTEM,
                      code: "PUBHLTH",
                      display: "public health",
                    },
                  ],
                },
              ],
            },
          ],
          limit: [
            {
              coding: [
                {
                  system: HL7_ACT_CODE_SYSTEM,
                  code: "DELAU",
                  display: "delete after use",
                },
              ],
            },
          ],
        },
      ],
    });

    // 1b. PHW DSA 42 v3 (matches smart-trust-phw#10 DSAPermissionExample.fsh)
    const resPhw = odrlAgreementToFhirR5Permission(PHW_DSA_42_V3_AGREEMENT, {
      id: "DSAPermissionExample",
      agreementDisplay: "Data sharing agreement 42, version 3 (fixed-version URL = ODRL uid)",
      partyReferences: {
        "https://ministry-m.example.org/": { reference: "Organization/MinistryM" },
        "https://institute-i.example.org/": { reference: "Organization/InstituteI" },
      },
      targetDisplays: {
        "https://ministry-m.example.org/dataset/immunization-coverage":
          "Ministry M immunization coverage dataset",
      },
    });

    expect(FhirR5PermissionSchema.safeParse(resPhw.permission).success).toBe(true);
    expect(resPhw.permission).toEqual({
      resourceType: "Permission",
      id: "DSAPermissionExample",
      status: "active",
      asserter: {
        reference: "Organization/MinistryM",
      },
      validity: {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T23:59:59Z",
      },
      justification: {
        evidence: [
          {
            identifier: {
              system: RFC_3986_URI_SYSTEM,
              value: "https://ministry-m.example.org/dsa/42/v3",
            },
            display: "Data sharing agreement 42, version 3 (fixed-version URL = ODRL uid)",
          },
        ],
      },
      combining: "deny-overrides",
      rule: [
        {
          type: "permit",
          data: [
            {
              resource: [
                {
                  meaning: "instance",
                  reference: {
                    identifier: {
                      system: RFC_3986_URI_SYSTEM,
                      value: "https://ministry-m.example.org/dataset/immunization-coverage",
                    },
                    display: "Ministry M immunization coverage dataset",
                  },
                },
              ],
            },
          ],
          activity: [
            {
              actor: [{ reference: "Organization/InstituteI" }],
              action: [
                {
                  coding: [
                    {
                      system: HL7_CONSENT_ACTION_SYSTEM,
                      code: "use",
                      display: "use",
                    },
                  ],
                },
              ],
              purpose: [
                {
                  coding: [
                    {
                      system: HL7_ACT_REASON_SYSTEM,
                      code: "PUBHLTH",
                      display: "public health",
                    },
                  ],
                },
              ],
            },
          ],
          limit: [
            {
              coding: [
                {
                  system: HL7_ACT_CODE_SYSTEM,
                  code: "DELAU",
                  display: "delete after use",
                },
              ],
            },
          ],
        },
        {
          type: "deny",
          data: [
            {
              resource: [
                {
                  meaning: "instance",
                  reference: {
                    identifier: {
                      system: RFC_3986_URI_SYSTEM,
                      value: "https://ministry-m.example.org/dataset/immunization-coverage",
                    },
                    display: "Ministry M immunization coverage dataset",
                  },
                },
              ],
            },
          ],
          activity: [
            {
              actor: [{ reference: "Organization/InstituteI" }],
              action: [
                {
                  coding: [
                    {
                      system: HL7_CONSENT_ACTION_SYSTEM,
                      code: "disclose",
                      display: "disclose",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    // 1c. Format as FSH and run SUSHI (when installed locally and ~/.fhir/packages has R5 dependencies)
    const fsh042 = fhirR5PermissionToFsh(res042.permission, {
      title: "Permission rendered from DSA-042 v1",
      description: "One-way FHIR R5 Permission rendering of ODRL 2.2 Agreement https://example.org/dsa/042/v1",
    });
    expect(fsh042).toContain("Instance: Permission-DSA-042-v1");
    expect(fsh042).toContain("InstanceOf: Permission");
    expect(fsh042).toContain("* combining = #deny-overrides");

    const sushiBin = Bun.which("sushi");
    if (sushiBin) {
      const workDir = mkdtempSync(join(tmpdir(), "jfbm-sushi-r5-"));
      try {
        mkdirSync(join(workDir, "input", "fsh"), { recursive: true });
        writeFileSync(
          join(workDir, "sushi-config.yaml"),
          [
            "id: example.fhir.r5.permission.jfbm",
            "canonical: http://example.org/fhir/r5-permission-jfbm",
            "name: ExampleFhirR5PermissionJfbm",
            "status: draft",
            "version: 0.1.0",
            "fhirVersion: 5.0.0",
            "copyrightYear: 2026+",
            "releaseLabel: ci-build",
            "menu:",
            "  Home: index.html",
            "",
          ].join("\n"),
        );
        writeFileSync(join(workDir, "input", "fsh", "Permission-DSA-042-v1.fsh"), fsh042);

        const proc = spawnSync(sushiBin, [workDir], { encoding: "utf-8" });
        const out = `${proc.stdout ?? ""}\n${proc.stderr ?? ""}`;
        // If SUSHI has offline R5 packages in ~/.fhir/packages, it must succeed with 0 Errors and 0 Warnings.
        if (proc.status === 0) {
          expect(out).toContain("0 Errors");
          expect(out).toContain("0 Warnings");
          const generated = JSON.parse(
            readFileSync(
              join(workDir, "fsh-generated", "resources", "Permission-Permission-DSA-042-v1.json"),
              "utf-8",
            ),
          );
          expect(FhirR5PermissionSchema.safeParse(generated).success).toBe(true);
          expect(generated).toEqual(res042.permission);
        }
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    }
  });

  test("listsDroppedTerms", () => {
    // Verify dropped list on PHW DSA 42 v3
    const resPhw = odrlAgreementToFhirR5Permission(PHW_DSA_42_V3_AGREEMENT, {
      dcat: DSA_042_V1_DCAT,
    });
    const droppedPaths = resPhw.dropped.map((d) => d.path);

    expect(droppedPaths).toContain("@type");
    expect(droppedPaths).toContain("dcat:distribution[0].spdx:checksum");
    expect(droppedPaths).toContain("permission[0].constraint[0].operator"); // isA
    expect(droppedPaths).toContain("permission[0].constraint[2].operator"); // lt exclusive bound
    expect(droppedPaths).toContain("permission[0].duty[0]"); // delete -> rough limit DELAU
    expect(droppedPaths).toContain("permission[0].duty[0].constraint[0]"); // delete deadline
    expect(droppedPaths).toContain("permission[0].duty[1]"); // inform duty
    expect(droppedPaths).toContain("permission[0].duty[1].informedParty"); // informedParty
    expect(droppedPaths).toContain("prohibition[0].action"); // distribute -> disclose approximate

    // Verify additional unmapped ODRL terms: profile, inheritFrom, conflict="odrl:invalid",
    // obligation, obtainConsent duty, elapsedTime, BPMN scope, conflicting rule periods,
    // refinement, consequence, remedy
    const complexAgreement = {
      "@context": "http://www.w3.org/ns/odrl.jsonld",
      "@type": "Agreement",
      uid: "https://example.org/dsa/complex/v1",
      profile: "https://litlfred.github.io/cat-harness/policies/profile",
      inheritFrom: ["https://example.org/dsa/base/v1"],
      conflict: "odrl:invalid",
      assigner: "Organization/provider",
      assignee: "Organization/recipient",
      obligation: [{ action: "odrl:attribute", attributedParty: "Organization/provider" }],
      permission: [
        {
          uid: "urn:rule:1",
          assignee: "Organization/recipient",
          action: "odrl:derive",
          target: "Patient/ex-patient",
          refinement: [{ leftOperand: "odrl:resolution", operator: "odrl:lteq", rightOperand: "county" }],
          constraint: [
            { leftOperand: "odrl:elapsedTime", operator: "odrl:lteq", rightOperand: "P30D" },
            { leftOperand: "cat-harness:process", operator: "odrl:eq", rightOperand: "surveillance" },
            { leftOperand: "odrl:purpose", operator: "odrl:neq", rightOperand: "MARKETING" },
            { leftOperand: "odrl:dateTime", operator: "odrl:gteq", rightOperand: "2026-01-01" },
          ],
          duty: [
            {
              action: "odrl:obtainConsent",
              consequence: [{ action: "odrl:delete" }],
            },
          ],
        },
        {
          assignee: "Organization/recipient",
          action: "odrl:display",
          target: "Patient/ex-patient",
          constraint: [
            { leftOperand: "odrl:dateTime", operator: "odrl:gteq", rightOperand: "2026-06-01" },
          ],
        },
      ],
      prohibition: [
        {
          assignee: "Organization/recipient",
          action: "odrl:modify",
          target: "Patient/ex-patient",
          remedy: [{ action: "odrl:inform" }],
        },
      ],
    };

    const resComplex = odrlAgreementToFhirR5Permission(complexAgreement);
    expect(FhirR5PermissionSchema.safeParse(resComplex.permission).success).toBe(true);
    expect(resComplex.permission.combining).toBe("deny-unless-permit");

    const complexDroppedPaths = resComplex.dropped.map((d) => d.path);
    expect(complexDroppedPaths).toEqual(
      expect.arrayContaining([
        "@type",
        "profile",
        "inheritFrom",
        "conflict",
        "obligation[0]",
        "permission[0].uid",
        "permission[0].refinement",
        "permission[0].action",
        "permission[0].constraint[0]", // elapsedTime
        "permission[0].constraint[1]", // cat-harness:process
        "permission[0].constraint[2]", // negative purpose neq
        "permission[0].duty[0]", // obtainConsent
        "permission[0].duty[0].consequence",
        "permission[1].action", // display -> access
        "permission[1].constraint", // conflicting dateTime period across rules
        "prohibition[0].remedy",
        "prohibition[0].action", // modify -> correct
      ]),
    );
  });

  test("schemaFromR5CoreRefusesInvented", () => {
    expect([...PERMISSION_STATUS_CODES]).toEqual([
      "active",
      "entered-in-error",
      "draft",
      "rejected",
    ]);
    expect([...PERMISSION_RULE_COMBINING_CODES]).toEqual([
      "deny-overrides",
      "permit-overrides",
      "ordered-deny-overrides",
      "ordered-permit-overrides",
      "deny-unless-permit",
      "permit-unless-deny",
    ]);
    expect([...R5_CONSENT_PROVISION_TYPE_CODES]).toEqual(["deny", "permit"]);
    expect([...R5_CONSENT_DATA_MEANING_CODES]).toEqual([
      "instance",
      "related",
      "dependents",
      "authoredby",
    ]);

    // Missing required status or combining -> rejected
    expect(
      FhirR5PermissionSchema.safeParse({
        resourceType: "Permission",
        combining: "deny-overrides",
      }).success,
    ).toBe(false);
    expect(
      FhirR5PermissionSchema.safeParse({
        resourceType: "Permission",
        status: "active",
      }).success,
    ).toBe(false);

    // Invalid required code bindings -> rejected
    expect(
      FhirR5PermissionSchema.safeParse({
        resourceType: "Permission",
        status: "proposed", // valid in R4 Consent, NOT in R5 Permission!
        combining: "deny-overrides",
      }).success,
    ).toBe(false);
    expect(
      FhirR5PermissionSchema.safeParse({
        resourceType: "Permission",
        status: "active",
        combining: "invalid", // ODRL conflict="invalid" is NOT a FHIR R5 combining code!
      }).success,
    ).toBe(false);

    // Invented top-level field (e.g. "identifier" or "policy" which R5 Permission does NOT have!) -> rejected
    expect(
      FhirR5PermissionSchema.safeParse({
        resourceType: "Permission",
        status: "active",
        combining: "deny-overrides",
        identifier: [{ system: "urn:ietf:rfc:3986", value: "https://example.org/dsa/042/v1" }],
      }).success,
    ).toBe(false);
    expect(
      FhirR5PermissionSchema.safeParse({
        resourceType: "Permission",
        status: "active",
        combining: "deny-overrides",
        policy: [{ uri: "https://example.org/dsa/042/v1" }],
      }).success,
    ).toBe(false);

    // Invented nested field on rule, rule.activity, or Reference -> rejected
    expect(
      FhirR5PermissionSchema.safeParse({
        resourceType: "Permission",
        status: "active",
        combining: "deny-overrides",
        rule: [{ type: "permit", duty: [{ action: "delete" }] }],
      }).success,
    ).toBe(false);
    expect(
      FhirR5PermissionSchema.safeParse({
        resourceType: "Permission",
        status: "active",
        combining: "deny-overrides",
        justification: {
          evidence: [
            {
              identifier: { system: "urn:ietf:rfc:3986", value: "https://example.org/dsa/042/v1" },
              hash: "909635085f5af64b7da8be004c051cf11af3662ff13aa9165b4c1d69b7adf22f",
            },
          ],
        },
      }).success,
    ).toBe(false);

    // Source file contains no hand-written FhirR5Permission interface shape
    const src = readFileSync(join(HERE, "odrl-to-fhir-r5-permission.ts"), "utf-8");
    expect(src).not.toMatch(/export\s+interface\s+FhirR5Permission\b/);
    expect(src).toContain(HL7_FHIR_R5_CORE_PACKAGE_ID);
  });
});
