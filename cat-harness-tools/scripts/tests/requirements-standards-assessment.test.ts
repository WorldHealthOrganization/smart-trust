/**
 * Test suite for the Requirements Standards Assessment methodology
 * and bootstrap mapping rules (folio-assistant-1gf7).
 *
 * Verifies:
 * 1. Conformance of `methodologies/requirements-standards-assessment.md` to `folio-methodology/v1`.
 * 2. Decoupling of bootstrap requirement schema from external dependencies.
 * 3. Bidirectional mapping rules and field translations between bootstrap fields
 *    and surveyed standards (ReqIF SpecObject, EARS patterns, ISO 29148, ISO 25010).
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { frontMatterOf, resolveEvidence } from "../check-methodology-evidence.ts";
import { MethodologyFrontMatterSchema, METHODOLOGY_SCHEMA_TAG } from "../../schemas/process/methodology.ts";
import { parse as parseYaml } from "yaml";
import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
const METHODOLOGY_PATH = resolve(INSTANCE_ROOT, "methodologies", "requirements-standards-assessment.md");
const BOOTSTRAP_REQ_SCHEMA_PATH = resolve(INSTANCE_ROOT, "..", "..", "..", "bootstrap", "schemas", "requirement.schema.json");

describe("requirements-standards-assessment methodology conformance", () => {
  it("exists on disk and has valid folio-methodology/v1 front matter", () => {
    expect(existsSync(METHODOLOGY_PATH)).toBe(true);
    const content = readFileSync(METHODOLOGY_PATH, "utf-8");
    const fm = frontMatterOf(content);
    expect(fm).toBeDefined();

    const parsedYaml = parseYaml(fm!);
    const parseResult = MethodologyFrontMatterSchema.safeParse(parsedYaml);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      expect(parseResult.data.$schema).toBe(METHODOLOGY_SCHEMA_TAG);
      expect(parseResult.data.name).toBe("requirements-standards-assessment");
      expect(parseResult.data.title).toContain("bootstrap Requirement");
      expect(parseResult.data.origin).toContain("ReqIF");
      expect(parseResult.data.origin).toContain("EARS");
      expect(parseResult.data.origin).toContain("29148");
      expect(parseResult.data["applies-when"]).toContain("higher harness layers");
      expect(parseResult.data.evidence).toBeDefined();
      expect(parseResult.data.evidence?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("resolves all cited evidence in library", () => {
    const content = readFileSync(METHODOLOGY_PATH, "utf-8");
    const fm = frontMatterOf(content);
    const parsed = MethodologyFrontMatterSchema.parse(parseYaml(fm!));

    for (const ref of parsed.evidence ?? []) {
      const resolved = resolveEvidence(INSTANCE_ROOT, ref);
      expect(resolved).toBeDefined();
    }
  });

  it("contains all required survey sections in its body", () => {
    const content = readFileSync(METHODOLOGY_PATH, "utf-8");
    // Surveyed standards
    expect(content).toContain("ReqIF (OMG Requirements Interchange Format");
    expect(content).toContain("OSLC-RM (OASIS OSLC Requirements Management");
    expect(content).toContain("EARS (Easy Approach to Requirements Syntax)");
    expect(content).toContain("ISO/IEC/IEEE 29148:2018");
    expect(content).toContain("IEEE Std 830-1998");
    expect(content).toContain("ISO/IEC 25010");
    expect(content).toContain("INCOSE Guide for Writing Requirements");

    // Recommendations and boundaries
    expect(content).toContain("no-outside-concept rule");
    expect(content).toContain("Maintain Markdown Front Matter + Zod as Native Format");
    expect(content).toContain("Layer 0: Bootstrap Substrate");
    expect(content).toContain("Layer 1: Harness Validation & Quality Linters");
    expect(content).toContain("Layer 2: Projection & Integration Adapters");
  });
});

describe("bootstrap requirement schema decoupling", () => {
  it("remains free of external dependencies and outside concepts", () => {
    if (!existsSync(BOOTSTRAP_REQ_SCHEMA_PATH)) {
      // In standalone checkout where bootstrap is not present, skip file assertion
      return;
    }

    const schemaJson = JSON.parse(readFileSync(BOOTSTRAP_REQ_SCHEMA_PATH, "utf-8"));

    // Standard Draft-07 JSON Schema
    expect(schemaJson.$schema).toBe("http://json-schema.org/draft-07/schema#");

    // Ensure no outside ontology or external standard imports in $ref
    const rawText = JSON.stringify(schemaJson);
    expect(rawText).not.toContain("reqif");
    expect(rawText).not.toContain("oslc");
    expect(rawText).not.toContain("oasis-open.org");
    expect(rawText).not.toContain("omg.org");

    // Check that core fields are defined natively
    const props = schemaJson.properties;
    expect(props.id).toBeDefined();
    expect(props.title).toBeDefined();
    expect(props.description).toBeDefined();
    expect(props.statements).toBeDefined();

    // Statement item properties
    const stmtProps = props.statements.items.properties;
    expect(stmtProps.key).toBeDefined();
    expect(stmtProps.conformance.enum).toEqual(["SHALL", "SHOULD", "MAY", "SHALL NOT"]);
    expect(stmtProps.requirement).toBeDefined();
    expect(stmtProps.kind.enum).toEqual(["functional", "non-functional"]);
    expect(stmtProps.successCriteria).toBeDefined();

    // Success criteria item properties
    const scProps = stmtProps.successCriteria.items.properties;
    expect(scProps.key).toBeDefined();
    expect(scProps.criterion).toBeDefined();
    expect(scProps.verification.enum).toEqual(["test", "inspection", "review", "analysis"]);
  });
});

describe("standards translation rules and mappings", () => {
  // Sample bootstrap requirement statement
  const sampleStatement = {
    key: "detect-plan-request",
    label: "Detection flags plan requests",
    conformance: "SHALL" as const,
    requirement: "When a user requests a plan, the agent SHALL produce a requirements document and work plan.",
    kind: "functional" as const,
    activity: "planning",
    capability: "plan-request-detection",
    benefit: "Prevents code implementation before requirements are agreed.",
    successCriteria: [
      {
        key: "SC-1",
        criterion: "Given five dogfood plan phrasings, detection flags all five.",
        verification: "test" as const,
      },
    ],
  };

  describe("ReqIF SpecObject mapping", () => {
    interface ReqIFAttributeValue {
      definitionRef: string;
      value: string;
    }

    interface ReqIFSpecObject {
      identifier: string;
      typeRef: string;
      attributeValues: ReqIFAttributeValue[];
    }

    // Mapping adapter: Bootstrap Statement -> ReqIF SpecObject
    function mapBootstrapStatementToReqIF(
      reqId: string,
      stmt: typeof sampleStatement,
    ): ReqIFSpecObject {
      return {
        identifier: `${reqId}#${stmt.key}`,
        typeRef: "SpecObjectType_RequirementStatement",
        attributeValues: [
          { definitionRef: "ReqIF.ForeignID", value: `${reqId}#${stmt.key}` },
          { definitionRef: "ReqIF.Name", value: stmt.label },
          { definitionRef: "ReqIF.Text", value: stmt.requirement },
          { definitionRef: "ConformanceLevel", value: stmt.conformance },
          { definitionRef: "Kind", value: stmt.kind },
          { definitionRef: "Benefit", value: stmt.benefit },
          { definitionRef: "PrimaryVerificationMethod", value: stmt.successCriteria[0].verification },
          { definitionRef: "AcceptanceCriteriaSummary", value: stmt.successCriteria.map((c) => `[${c.key}] (${c.verification}) ${c.criterion}`).join("; ") },
        ],
      };
    }

    // Reverse mapping adapter: ReqIF SpecObject -> Partial Bootstrap Statement
    function mapReqIFToBootstrapStatement(specObj: ReqIFSpecObject) {
      const getAttr = (def: string) => specObj.attributeValues.find((a) => a.definitionRef === def)?.value ?? "";
      const foreignId = getAttr("ReqIF.ForeignID");
      const key = foreignId.includes("#") ? foreignId.split("#")[1] : foreignId;

      return {
        key,
        label: getAttr("ReqIF.Name"),
        conformance: getAttr("ConformanceLevel"),
        requirement: getAttr("ReqIF.Text"),
        kind: getAttr("Kind"),
        benefit: getAttr("Benefit"),
      };
    }

    it("maps a bootstrap statement to a valid ReqIF SpecObject structure", () => {
      const specObject = mapBootstrapStatementToReqIF("req:plan-request", sampleStatement);

      expect(specObject.identifier).toBe("req:plan-request#detect-plan-request");
      expect(specObject.typeRef).toBe("SpecObjectType_RequirementStatement");

      const foreignId = specObject.attributeValues.find((a) => a.definitionRef === "ReqIF.ForeignID");
      const name = specObject.attributeValues.find((a) => a.definitionRef === "ReqIF.Name");
      const text = specObject.attributeValues.find((a) => a.definitionRef === "ReqIF.Text");
      const conformance = specObject.attributeValues.find((a) => a.definitionRef === "ConformanceLevel");

      expect(foreignId?.value).toBe("req:plan-request#detect-plan-request");
      expect(name?.value).toBe("Detection flags plan requests");
      expect(text?.value).toBe(sampleStatement.requirement);
      expect(conformance?.value).toBe("SHALL");
    });

    it("supports round-trip fidelity between bootstrap statement and ReqIF SpecObject attributes", () => {
      const specObject = mapBootstrapStatementToReqIF("req:plan-request", sampleStatement);
      const roundTripped = mapReqIFToBootstrapStatement(specObject);

      expect(roundTripped.key).toBe(sampleStatement.key);
      expect(roundTripped.label).toBe(sampleStatement.label);
      expect(roundTripped.requirement).toBe(sampleStatement.requirement);
      expect(roundTripped.conformance).toBe(sampleStatement.conformance);
      expect(roundTripped.kind).toBe(sampleStatement.kind);
      expect(roundTripped.benefit).toBe(sampleStatement.benefit);
    });
  });

  describe("EARS pattern syntax classification", () => {
    type EarsPatternType =
      | "ubiquitous"
      | "event-driven"
      | "state-driven"
      | "unwanted-behavior"
      | "optional-feature"
      | "non-ears";

    function classifyEarsPattern(sentence: string): EarsPatternType {
      const trimmed = sentence.trim();

      // Event-driven: "When <trigger>, the <system> shall <response>."
      if (/^when\s+.+?,\s+the\s+.+?\s+(?:shall|should|may|shall\s+not)\b/i.test(trimmed)) {
        return "event-driven";
      }

      // State-driven: "While <state>, the <system> shall <response>."
      if (/^while\s+.+?,\s+the\s+.+?\s+(?:shall|should|may|shall\s+not)\b/i.test(trimmed)) {
        return "state-driven";
      }

      // Unwanted behavior: "If <trigger/error>, then the <system> shall <response>."
      if (/^if\s+.+?,\s+then\s+the\s+.+?\s+(?:shall|should|may|shall\s+not)\b/i.test(trimmed)) {
        return "unwanted-behavior";
      }

      // Optional feature: "Where <feature present>, the <system> shall <response>."
      if (/^where\s+.+?,\s+the\s+.+?\s+(?:shall|should|may|shall\s+not)\b/i.test(trimmed)) {
        return "optional-feature";
      }

      // Ubiquitous: "The <system> shall <response>."
      if (/^the\s+.+?\s+(?:shall|should|may|shall\s+not)\b/i.test(trimmed)) {
        return "ubiquitous";
      }

      return "non-ears";
    }

    it("correctly identifies all 5 canonical EARS syntax patterns", () => {
      const ubiquitous = "The harness SHALL validate every block against its declared schema.";
      const eventDriven = "When a plan is requested, the agent SHALL produce a requirements document and work plan.";
      const stateDriven = "While in draft stage, the tool SHALL allow editing requirement statement keys.";
      const unwantedBehavior = "If validation fails, then the pipeline SHALL exit with code 1.";
      const optionalFeature = "Where LaTeX is available, the renderer SHALL output PDF via latexmk.";
      const nonEars = "Agents must always be polite and fast.";

      expect(classifyEarsPattern(ubiquitous)).toBe("ubiquitous");
      expect(classifyEarsPattern(eventDriven)).toBe("event-driven");
      expect(classifyEarsPattern(stateDriven)).toBe("state-driven");
      expect(classifyEarsPattern(unwantedBehavior)).toBe("unwanted-behavior");
      expect(classifyEarsPattern(optionalFeature)).toBe("optional-feature");
      expect(classifyEarsPattern(nonEars)).toBe("non-ears");
    });

    it("classifies the sample statement as event-driven EARS", () => {
      expect(classifyEarsPattern(sampleStatement.requirement)).toBe("event-driven");
    });
  });

  describe("ISO/IEC/IEEE 29148:2018 verification method alignment", () => {
    type BootstrapVerification = "test" | "inspection" | "review" | "analysis";
    type Iso29148VerificationMethod = "Test" | "Inspection" | "Demonstration" | "Analysis";

    const ISO_29148_MAPPING: Record<BootstrapVerification, Iso29148VerificationMethod> = {
      test: "Test",
      inspection: "Inspection",
      review: "Demonstration",
      analysis: "Analysis",
    };

    const REVERSE_ISO_MAPPING: Record<Iso29148VerificationMethod, BootstrapVerification> = {
      Test: "test",
      Inspection: "inspection",
      Demonstration: "review",
      Analysis: "analysis",
    };

    it("maps all bootstrap verification methods 1:1 to ISO 29148 Clause 6.4 methods", () => {
      const bootstrapMethods: BootstrapVerification[] = ["test", "inspection", "review", "analysis"];

      for (const method of bootstrapMethods) {
        const isoMethod = ISO_29148_MAPPING[method];
        expect(isoMethod).toBeDefined();
        expect(REVERSE_ISO_MAPPING[isoMethod]).toBe(method);
      }
    });
  });

  describe("ISO/IEC 25010 quality model category validation", () => {
    const ISO_25010_CHARACTERISTICS = new Set([
      "functional-suitability",
      "performance-efficiency",
      "compatibility",
      "interaction-capability",
      "reliability",
      "security",
      "maintainability",
      "portability",
      "safety",
    ]);

    function isValidNfrCategory(category: string): boolean {
      return ISO_25010_CHARACTERISTICS.has(category.toLowerCase().replace(/_/g, "-"));
    }

    it("recognizes standard ISO 25010 product quality characteristics as valid NFR categories", () => {
      expect(isValidNfrCategory("security")).toBe(true);
      expect(isValidNfrCategory("performance-efficiency")).toBe(true);
      expect(isValidNfrCategory("maintainability")).toBe(true);
      expect(isValidNfrCategory("reliability")).toBe(true);
      expect(isValidNfrCategory("safety")).toBe(true);
      expect(isValidNfrCategory("random-non-standard-category")).toBe(false);
    });
  });
});
