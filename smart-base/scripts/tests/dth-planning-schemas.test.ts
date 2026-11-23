/**
 * Unit tests for the proposed DTH governance and planning schemas
 * (`litlfred/dth-sfp#1` Step P6d, `litlfred/dth-phc#1` Step P4b, and
 * `litlfred/smart-base#242`).
 *
 * Exercises all five schemas against realistic fixtures from:
 * - `dth-sfp` (`9789240120747-eng`, Substandard and falsified medical products)
 * - `dth-phc` (`9789240093362-eng`, Primary health care / PCPOSS)
 * - `dth-pc` (`9789240116191-eng`, National product catalogue)
 *
 * @module smart-base/scripts/tests/dth-planning-schemas.test
 */

import { describe, expect, test } from "bun:test";

import {
  BARRIER_SOLUTION_MAP_SCHEMA_TAG,
  BarrierSolutionMapSchema,
  DTH_PLANNING_SCHEMA_TAGS,
  DthPlanningArtefactSchema,
  GOVERNANCE_ROLE_SCHEMA_TAG,
  GovernanceRoleSchema,
  RACI_MATRIX_SCHEMA_TAG,
  RaciMatrixSchema,
  RISK_REGISTER_SCHEMA_TAG,
  RiskRegisterSchema,
  STAKEHOLDER_ANALYSIS_SCHEMA_TAG,
  StakeholderAnalysisSchema,
} from "../../schemas/dth-planning-schemas.ts";

describe("1. GovernanceRoleSchema (dth-governance-role/v1)", () => {
  test("accepts SFP §2.3 Steering Committee and NMRA Regulator fixtures (9789240120747-eng)", () => {
    const sfpSteeringCommittee = GovernanceRoleSchema.parse({
      id: "SFP-GOV-01",
      name: "National SF Medical Products Digital Surveillance Steering Committee",
      roleType: "steering-committee",
      mandate:
        "Provide strategic oversight, inter-ministerial policy alignment, and resource allocation for national substandard and falsified medical product reporting systems.",
      chairOrLeadRoleIri: "urn:who:smart-ra:role:nmra-director",
      memberRoleIris: [
        "urn:who:smart-ra:role:nmra-reviewer",
        "urn:who:smart-ra:role:moh-digital-health-lead",
        "urn:who:smart-ra:role:customs-enforcement-liaison",
      ],
      meetingCadence: "Quarterly",
      decisionRights: [
        "Approve national SF reporting digital roadmap and budget",
        "Endorse data-sharing agreements between NMRA, customs, and WHO GSMS",
      ],
      archimateElementIri: "urn:who:smart-ra:archimate:role:regulatory-steering-committee",
      sourceRef: {
        libraryId: "9789240120747-eng",
        sectionId: "sec-008",
        pages: "14-17",
        tableOrAnnex: "§2.3",
      },
    });

    expect(sfpSteeringCommittee.$schema).toBe(GOVERNANCE_ROLE_SCHEMA_TAG);
    expect(sfpSteeringCommittee.roleType).toBe("steering-committee");
    expect(sfpSteeringCommittee.memberRoleIris).toHaveLength(3);
  });

  test("accepts PHC Ch 1 §1.1.2 Technical Working Group fixture (9789240093362-eng)", () => {
    const phcTwg = GovernanceRoleSchema.parse({
      id: "PHC-GOV-TWG-01",
      name: "PCPOSS Technical Working Group",
      roleType: "technical-working-group",
      mandate:
        "Coordinate clinical, health-information, and ICT stakeholders to adapt functional requirements, interoperability standards, and implementation plans for person-centred point-of-service systems.",
      chairOrLeadRoleIri: "urn:who:dth-phc:persona:PHC-R-04",
      memberRoleIris: [
        "urn:who:dth-phc:persona:PHC-R-01",
        "urn:who:dth-phc:persona:PHC-R-05",
        "urn:who:dth-phc:persona:PHC-R-08",
      ],
      meetingCadence: "Monthly during requirements and design phases",
      decisionRights: [
        "Validate clinical workflows and minimum data sets",
        "Review vendor conformance against SMART Guidelines functional requirements",
      ],
      archimateElementIri: "urn:who:smart-ra:archimate:role:phc-technical-working-group",
      sourceRef: "9789240093362-eng#sec-004-1.1.2",
    });

    expect(phcTwg.$schema).toBe("dth-governance-role/v1");
    expect(phcTwg.roleType).toBe("technical-working-group");
  });

  test("rejects unknown roleType or non-IRI chairOrLeadRoleIri", () => {
    expect(
      GovernanceRoleSchema.safeParse({
        id: "SFP-GOV-BAD",
        name: "Invalid Governance Body",
        roleType: "informal-chat-group",
        mandate: "Mandate",
        chairOrLeadRoleIri: "urn:who:smart-ra:role:nmra",
        memberRoleIris: ["urn:who:smart-ra:role:nmra"],
        meetingCadence: "Quarterly",
        decisionRights: ["Approve roadmap"],
        archimateElementIri: "urn:who:smart-ra:archimate:role:nmra",
        sourceRef: "9789240120747-eng#sec-2.3",
      }).success,
    ).toBe(false);

    expect(
      GovernanceRoleSchema.safeParse({
        id: "SFP-GOV-BAD-IRI",
        name: "Invalid Chair IRI",
        roleType: "regulator",
        mandate: "Mandate",
        chairOrLeadRoleIri: "not a valid iri with spaces",
        memberRoleIris: ["urn:who:smart-ra:role:nmra"],
        meetingCadence: "Quarterly",
        decisionRights: ["Approve roadmap"],
        archimateElementIri: "urn:who:smart-ra:archimate:role:nmra",
        sourceRef: "9789240120747-eng#sec-2.3",
      }).success,
    ).toBe(false);
  });
});

describe("2. RaciMatrixSchema (dth-raci-matrix/v1)", () => {
  test("accepts populated RACI matrix and enforces at least one Accountable ('A') per activity", () => {
    const populatedRaci = RaciMatrixSchema.parse({
      id: "PHC-RACI-ANNEX-02",
      title: "PCPOSS Implementation Governance RACI Matrix",
      mode: "populated",
      roles: [
        {
          roleId: "moh-steering",
          label: "MoH Steering Committee",
          roleIri: "urn:who:dth-phc:governance:PHC-GOV-01",
        },
        {
          roleId: "pcposs-twg",
          label: "PCPOSS Technical Working Group",
          roleIri: "urn:who:dth-phc:governance:PHC-GOV-TWG-01",
        },
        {
          roleId: "health-worker",
          label: "Primary Health Care Worker",
          roleIri: "urn:who:dth-phc:persona:PHC-R-01",
        },
      ],
      activities: [
        {
          activityId: "PHC-ACT-01",
          activity: "Define national PCPOSS vision and scope",
          phase: "Phase 1: Assess current state",
          assignments: {
            "moh-steering": ["A"],
            "pcposs-twg": ["R", "C"],
            "health-worker": ["I"],
          },
        },
        {
          activityId: "PHC-ACT-02",
          activity: "Validate clinical user scenarios and point-of-service workflows",
          phase: "Phase 5: Determine requirements",
          assignments: {
            "moh-steering": ["I"],
            "pcposs-twg": ["A", "R"],
            "health-worker": ["C"],
          },
        },
      ],
      sourceRef: {
        libraryId: "9789240093362-eng",
        sectionId: "sec-036",
        pages: "71-72",
        tableOrAnnex: "Annex 2",
      },
    });

    expect(populatedRaci.$schema).toBe(RACI_MATRIX_SCHEMA_TAG);
    expect(populatedRaci.activities).toHaveLength(2);
  });

  test("accepts SFP Annex 4 blank worksheet in template mode without requiring 'A'", () => {
    const sfpTemplateRaci = RaciMatrixSchema.parse({
      id: "SFP-RACI-ANNEX-04",
      title: "Annex 4: RACI matrix template for SF medical products reporting system",
      mode: "template",
      roles: [
        {
          roleId: "nmra",
          label: "National Medicines Regulatory Authority (NMRA)",
          roleIri: "urn:who:smart-ra:role:nmra",
        },
        {
          roleId: "twg",
          label: "Technical Working Group",
          roleIri: "urn:who:dth-sfp:governance:SFP-GOV-TWG",
        },
      ],
      activities: [
        {
          activityId: "SFP-RACI-TPL-01",
          activity: "Establish governance structure and terms of reference",
          phase: "Phase 1: Assess current state",
          assignments: {},
        },
      ],
      sourceRef: {
        libraryId: "9789240120747-eng",
        pages: "54",
        tableOrAnnex: "Annex 4",
      },
    });

    expect(sfpTemplateRaci.mode).toBe("template");
  });

  test("rejects populated RACI activity missing 'A' or referencing undeclared role key", () => {
    const missingAccountable = RaciMatrixSchema.safeParse({
      id: "RACI-NO-A",
      title: "Missing Accountable",
      mode: "populated",
      roles: ["urn:who:smart-ra:role:nmra"],
      activities: [
        {
          activityId: "ACT-1",
          activity: "Draft SOP",
          phase: "Phase 2",
          assignments: {
            "urn:who:smart-ra:role:nmra": ["R", "C"],
          },
        },
      ],
      sourceRef: "9789240120747-eng#Annex-4",
    });
    expect(missingAccountable.success).toBe(false);

    const undeclaredRole = RaciMatrixSchema.safeParse({
      id: "RACI-UNDECLARED-ROLE",
      title: "Undeclared Role Key",
      mode: "populated",
      roles: ["urn:who:smart-ra:role:nmra"],
      activities: [
        {
          activityId: "ACT-1",
          activity: "Draft SOP",
          phase: "Phase 2",
          assignments: {
            "unknown-role-key": ["A", "R"],
          },
        },
      ],
      sourceRef: "9789240120747-eng#Annex-4",
    });
    expect(undeclaredRole.success).toBe(false);
  });
});

describe("3. RiskRegisterSchema (dth-risk-register/v1)", () => {
  test("accepts a populated PHC Ch 1 register (9789240093362-eng) and SFP Annex 7 template (9789240120747-eng)", () => {
    const phcRiskRegister = RiskRegisterSchema.parse({
      id: "PHC-RISK-REG-CH01",
      title: "PCPOSS governance and data stewardship risk register",
      mode: "populated",
      entries: [
        {
          id: "PHC-RISK-01-01",
          category: "Governance",
          risk:
            "Unclear ownership of PCPOSS master data across the ministry, district health offices and vertical programmes leads to conflicting identifiers.",
          likelihood: "high",
          impact: "high",
          priority: "critical",
          mitigation:
            "Establish an inter-agency data governance charter with a single authoritative steward per data domain before system configuration.",
          ownerRoleId: "actor:moh-digital-health-unit",
          stepIds: ["PHC-CH01-STEP-02"],
        },
        {
          id: "PHC-RISK-01-02",
          category: "Technical interoperability",
          risk: "Existing HMIS and EHR systems fail to adopt the agreed FHIR and terminology standards.",
          likelihood: "medium",
          impact: "high",
          priority: "high",
          mitigation:
            "Mandate FHIR profiles and terminology bindings in national interoperability specifications and procurement RFPs.",
          ownerRoleId: "pers:data-steward",
        },
      ],
      sourceRef: "9789240093362-eng#Ch1",
    });

    expect(phcRiskRegister.$schema).toBe(RISK_REGISTER_SCHEMA_TAG);
    expect(phcRiskRegister.entries).toHaveLength(2);

    const sfpAnnex7Template = RiskRegisterSchema.parse({
      id: "SFP-RISK-ANNEX-07",
      title: "Annex 7: Risk and mitigation register template for SF medical products reporting",
      mode: "template",
      entries: [],
      sourceRef: {
        libraryId: "9789240120747-eng",
        pages: "58-59",
        tableOrAnnex: "Annex 7",
      },
    });

    expect(sfpAnnex7Template.mode).toBe("template");
    expect(sfpAnnex7Template.entries).toHaveLength(0);
  });

  test("rejects populated RiskRegister with zero entries", () => {
    expect(
      RiskRegisterSchema.safeParse({
        id: "EMPTY-POPULATED-RISK",
        title: "Empty Populated Risk Register",
        mode: "populated",
        entries: [],
        sourceRef: "9789240116191-eng#Ch2",
      }).success,
    ).toBe(false);
  });

  test("a register row is a DthRiskMitigationRowSchema row: owner is a structured role id", () => {
    const row = {
      id: "R-1",
      category: "Governance",
      risk: "No steward",
      mitigation: "Name one",
      ownerRoleId: "Ministry of Health, somebody",
    };
    expect(
      RiskRegisterSchema.safeParse({ id: "X", title: "X", mode: "populated", entries: [row], sourceRef: "x" }).success,
    ).toBe(false);
    expect(
      RiskRegisterSchema.safeParse({
        id: "X",
        title: "X",
        mode: "populated",
        entries: [{ ...row, ownerRoleId: "actor:moh" }],
        sourceRef: "x",
      }).success,
    ).toBe(true);
  });
});

describe("4. BarrierSolutionMapSchema (dth-barrier-map/v1)", () => {
  test("accepts SFP Table 5 & Annex 6 barrier-to-solution mapping (9789240120747-eng) and PHC Table 1 (9789240093362-eng)", () => {
    const sfpBarrierMap = BarrierSolutionMapSchema.parse({
      id: "SFP-BAR-TBL-05",
      title: "Table 5: Common barriers to reporting SF medical products and candidate digital solutions",
      entries: [
        {
          barrierId: "SFP-BAR-01",
          category: "Reporter motivation and feedback",
          barrier:
            "Health workers and patients rarely receive acknowledgement or outcome feedback after submitting a suspected SF medical product report.",
          affectedRoleIris: [
            "urn:who:dth-sfp:persona:health-care-worker",
            "urn:who:dth-sfp:persona:patient-consumer",
          ],
          candidateSolutions: [
            "Automated two-way acknowledgement and status notifications via SMS/mobile app",
            "Confidential reporting channel with tracking reference number",
          ],
          relatedRequirementIds: ["SFR.FXREQ.003", "SFR.FXREQ.005"],
          archimateAssessmentIri: "urn:who:smart-ra:archimate:assessment:lack-of-reporter-feedback",
        },
        {
          barrierId: "SFP-BAR-02",
          category: "Connectivity and field usability",
          barrier:
            "Remote health facilities and border checkpoints lack reliable internet connectivity when inspecting suspect products.",
          affectedRoleIris: [
            "urn:who:dth-sfp:persona:health-care-worker",
            "urn:who:dth-sfp:persona:border-inspector",
          ],
          candidateSolutions: [
            "Offline-first mobile reporting form with store-and-forward synchronisation (SF-REP-006)",
            "Barcode / GS1 DataMatrix scan capture with local cache",
          ],
          relatedRequirementIds: ["SFR.FXREQ.001", "SFR.NFXREQ.OFFLINE.01"],
          archimateAssessmentIri: "urn:who:smart-ra:archimate:assessment:intermittent-connectivity",
        },
      ],
      sourceRef: {
        libraryId: "9789240120747-eng",
        sectionId: "sec-011",
        pages: "20-21",
        tableOrAnnex: "Table 5 & Annex 6",
      },
    });

    expect(sfpBarrierMap.$schema).toBe(BARRIER_SOLUTION_MAP_SCHEMA_TAG);
    expect(sfpBarrierMap.entries).toHaveLength(2);
    expect(sfpBarrierMap.entries[0]!.relatedRequirementIds).toContain("SFR.FXREQ.003");
  });
});

describe("5. StakeholderAnalysisSchema (dth-stakeholder-analysis/v1)", () => {
  test("accepts SFP Table 2 (9789240120747-eng) and PHC Ch 1 Table 2 (9789240093362-eng) stakeholder mappings", () => {
    const sfpStakeholders = StakeholderAnalysisSchema.parse({
      id: "SFP-STK-TBL-02",
      title: "Table 2: Key stakeholders in substandard and falsified medical product surveillance and reporting",
      stakeholders: [
        {
          stakeholderId: "SFP-STK-01",
          name: "National Medicines Regulatory Authority (NMRA)",
          sector: "Public health & regulation",
          roleInSystem:
            "Receives, triages, investigates, and takes regulatory action on suspected SF medical product reports; reports confirmed cases to WHO GSMS.",
          interestOrInfluence:
            "High influence and statutory mandate over national pharmacovigilance and post-market surveillance.",
          engagementMechanism:
            "Chairs the national steering committee and leads technical working group requirements validation.",
          roleIri: "urn:who:smart-ra:role:nmra",
          archimateStakeholderIri: "urn:who:smart-ra:archimate:stakeholder:nmra",
        },
        {
          stakeholderId: "SFP-STK-02",
          name: "Customs and law enforcement authorities",
          sector: "Law enforcement & border control",
          roleInSystem:
            "Intercepts suspect consignments at ports of entry and collaborates on criminal investigation of falsified medical products.",
          interestOrInfluence:
            "High operational influence on cross-border seizures and chain-of-custody evidence.",
          engagementMechanism:
            "Inter-agency SOPs, joint alert notifications, and representation on the steering committee.",
          roleIri: "urn:who:smart-ra:role:law-enforcement-customs",
          archimateStakeholderIri: "urn:who:smart-ra:archimate:stakeholder:law-enforcement-and-customs",
        },
      ],
      sourceRef: {
        libraryId: "9789240120747-eng",
        sectionId: "sec-006",
        pages: "9-11",
        tableOrAnnex: "Table 2",
      },
    });

    expect(sfpStakeholders.$schema).toBe(STAKEHOLDER_ANALYSIS_SCHEMA_TAG);
    expect(sfpStakeholders.stakeholders).toHaveLength(2);
  });
});

describe("DthPlanningArtefactSchema union", () => {
  test("lists the 5 schema tags and parses a register through the union", () => {
    expect(DTH_PLANNING_SCHEMA_TAGS).toHaveLength(5);
    expect(DTH_PLANNING_SCHEMA_TAGS as readonly string[]).not.toContain("dth-implementation-steps/v1");
    const parsed = DthPlanningArtefactSchema.parse({
      $schema: RISK_REGISTER_SCHEMA_TAG,
      id: "SFP-RISK-ANNEX-07",
      title: "Annex 7 template",
      mode: "template",
      entries: [],
      sourceRef: "9789240120747-eng#Annex-7",
    });
    expect(parsed.$schema).toBe(RISK_REGISTER_SCHEMA_TAG);
  });
});
