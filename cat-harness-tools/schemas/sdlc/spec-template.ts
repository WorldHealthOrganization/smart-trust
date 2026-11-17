/**
 * Spec template schema and validator for platform feature specifications (spec-kit).
 *
 * A feature specification in spec-kit follows upstream's `spec-template.md`.
 * Upstream marks three sections as mandatory:
 * - `User Scenarios & Testing`
 * - `Requirements`
 * - `Success Criteria`
 *
 * And two sections as recommended:
 * - `Edge Cases`
 * - `Assumptions`
 *
 * Plus a metadata header carrying `Feature Branch`, `Created`, and `Status`.
 *
 * This module defines the machine-readable contract for the spec template,
 * validates that specs conform to it, and refuses adjudicated status for a
 * spec that still carries unresolved clarification markers.
 *
 * @module schemas/spec-template
 * @graphNode schema
 */

import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

/** Schema identifier for spec templates. */
export const FOLIO_SPEC_TEMPLATE_SCHEMA = "folio-spec-template/v1";

/** Mandatory section headings in a spec-kit specification. */
export const MANDATORY_SPEC_SECTIONS = [
  "User Scenarios & Testing",
  "Requirements",
  "Success Criteria",
] as const;

export type MandatorySpecSection = (typeof MANDATORY_SPEC_SECTIONS)[number];

/** Recommended section headings in a spec-kit specification. */
export const RECOMMENDED_SPEC_SECTIONS = [
  "Edge Cases",
  "Assumptions",
] as const;

export type RecommendedSpecSection = (typeof RECOMMENDED_SPEC_SECTIONS)[number];

/** Required metadata fields in the spec header. */
export const SPEC_METADATA_FIELDS = [
  "Feature Branch",
  "Created",
  "Status",
] as const;

export type SpecMetadataField = (typeof SPEC_METADATA_FIELDS)[number];

/** Schema for the spec template's front matter declaration. */
export const SpecTemplateFrontMatterSchema = z.object({
  $schema: z.literal(FOLIO_SPEC_TEMPLATE_SCHEMA).optional(),
  name: z.literal("spec-template"),
  title: z.string().optional(),
  description: z.string().min(1),
  mandatory_sections: z.array(z.string()).min(1),
  recommended_sections: z.array(z.string()).default([]),
  metadata_fields: z.array(z.string()).default([]),
});

export type SpecTemplateFrontMatter = z.infer<typeof SpecTemplateFrontMatterSchema>;

/** Status values a spec can carry. */
export const ADJUDICATED_STATUS_KEYWORDS = [
  "adjudicated",
  "approved",
  "accepted",
  "completed",
] as const;

export const DRAFT_STATUS_KEYWORDS = [
  "draft",
  "in-progress",
  "wip",
  "review",
] as const;

/** Result of validating a spec text. */
export interface SpecValidationResult {
  /** "pass" if compliant, "fail" if mandatory section missing or invalid adjudication. */
  state: "pass" | "fail";
  /** Descriptive findings for any rule breach. */
  findings: string[];
  /** Any mandatory sections that were not found in the spec. */
  missingSections: string[];
  /** Any unresolved [NEEDS CLARIFICATION: ...] markers. */
  unresolvedClarifications: string[];
  /** Whether the spec carries an ACTION REQUIRED marker. */
  hasActionRequired: boolean;
  /** Extracted status string from header, if found. */
  status?: string;
  /** Whether the status is considered adjudicated. */
  isAdjudicated: boolean;
  /** Extracted feature title/name if found. */
  featureName?: string;
}

/** Regex pattern matching markdown section headers at depth 2 (## Section Title). */
const H2_HEADER_REGEX = /^##\s+([^\n#]+)/gm;

/** Regex pattern matching [NEEDS CLARIFICATION: ...] markers. */
export const NEEDS_CLARIFICATION_REGEX = /\[NEEDS CLARIFICATION(?::\s*([^\]]*))?\]/gi;

/** Regex pattern matching ACTION REQUIRED marker. */
export const ACTION_REQUIRED_REGEX = /ACTION\s+REQUIRED/i;

/** Regex pattern matching Status header field: **Status**: <value>. */
const STATUS_HEADER_REGEX = /\*\*Status\*\*:\s*([^\n\r]+)/i;

/** Regex pattern matching Feature title in spec header: # Feature Specification: <title>. */
const FEATURE_TITLE_REGEX = /^#\s+(?:Feature\s+Specification:?\s*)?([^\n\r]+)/mi;

/** Normalize a section title by trimming whitespace and removing trailing markdown suffixes like *(mandatory)*. */
export function normalizeSectionTitle(title: string): string {
  return title
    .replace(/\*+\s*\((?:mandatory|recommended)\)\s*\*+/gi, "")
    .replace(/[#*_~`]/g, "")
    .trim();
}

/**
 * Extract all level-2 markdown section titles from text.
 */
export function extractH2Sections(markdown: string): string[] {
  const sections: string[] = [];
  const matches = markdown.matchAll(H2_HEADER_REGEX);
  for (const match of matches) {
    if (match[1]) {
      sections.push(normalizeSectionTitle(match[1]));
    }
  }
  return sections;
}

/**
 * Extract unresolved clarification markers from spec markdown.
 */
export function extractClarificationMarkers(markdown: string): string[] {
  const markers: string[] = [];
  const matches = markdown.matchAll(NEEDS_CLARIFICATION_REGEX);
  for (const match of matches) {
    markers.push(match[0].trim());
  }
  return markers;
}

/**
 * Check whether a spec text represents an adjudicated status.
 */
export function isStatusAdjudicated(statusText?: string): boolean {
  if (!statusText) return false;
  const lower = statusText.toLowerCase();
  return ADJUDICATED_STATUS_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Validate a spec text against the template requirements.
 *
 * Pure function: takes spec text and returns validation verdict and findings.
 *
 * Enforces:
 * 1. Mandatory sections present (names missing sections if any).
 * 2. Unresolved [NEEDS CLARIFICATION] markers block adjudicated status (SC-004).
 * 3. Extracts header status and fields.
 */
export function validateSpec(
  specText: string,
  options: {
    mandatorySections?: readonly string[];
    requireAdjudicated?: boolean;
  } = {}
): SpecValidationResult {
  const mandatory = options.mandatorySections ?? MANDATORY_SPEC_SECTIONS;
  const sections = extractH2Sections(specText);
  const normalizedSections = new Set(sections.map((s) => s.toLowerCase()));

  const missingSections: string[] = [];
  for (const req of mandatory) {
    const norm = req.toLowerCase();
    const found = Array.from(normalizedSections).some(
      (s) => s === norm || s.startsWith(norm) || norm.startsWith(s)
    );
    if (!found) {
      missingSections.push(req);
    }
  }

  // Extract status and feature title
  const statusMatch = specText.match(STATUS_HEADER_REGEX);
  const status = statusMatch ? statusMatch[1].trim() : undefined;
  const isAdjudicated = isStatusAdjudicated(status);

  const titleMatch = specText.match(FEATURE_TITLE_REGEX);
  const featureName = titleMatch ? titleMatch[1].trim() : undefined;

  // Extract markers
  const unresolvedClarifications = extractClarificationMarkers(specText);
  const hasActionRequired = ACTION_REQUIRED_REGEX.test(specText);

  const findings: string[] = [];

  // Finding: Missing mandatory sections
  if (missingSections.length > 0) {
    for (const missing of missingSections) {
      findings.push(`missing mandatory section: "${missing}"`);
    }
  }

  // Finding: Unresolved clarification markers on adjudicated status (SC-004)
  if (unresolvedClarifications.length > 0) {
    if (isAdjudicated || options.requireAdjudicated) {
      findings.push(
        `spec has ${unresolvedClarifications.length} unresolved [NEEDS CLARIFICATION] marker(s) but is marked as adjudicated: ${unresolvedClarifications.join(
          ", "
        )}`
      );
    }
  }

  // Finding: Missing status in header
  if (!status) {
    findings.push('missing "**Status**:" field in metadata header');
  }

  const state: "pass" | "fail" = findings.length === 0 ? "pass" : "fail";

  return {
    state,
    findings,
    missingSections,
    unresolvedClarifications,
    hasActionRequired,
    status,
    isAdjudicated,
    featureName,
  };
}

/**
 * Read the declared spec template from disk and extract its mandatory sections.
 */
export function loadDeclaredSpecTemplate(templatePath: string): {
  mandatorySections: string[];
  recommendedSections: string[];
  metadataFields: string[];
} {
  if (!existsSync(templatePath)) {
    throw new Error(`Declared spec template not found at ${templatePath}`);
  }
  const content = readFileSync(templatePath, "utf-8");

  // Parse YAML frontmatter
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {
      mandatorySections: [...MANDATORY_SPEC_SECTIONS],
      recommendedSections: [...RECOMMENDED_SPEC_SECTIONS],
      metadataFields: [...SPEC_METADATA_FIELDS],
    };
  }

  const rawYaml = match[1];
  // Simple extraction of array fields from YAML front matter
  const parseYamlArray = (key: string): string[] => {
    const keyMatch = rawYaml.match(new RegExp(`${key}:\\s*\\n((?:\\s*-\\s*[^\\n]+\\n?)*)`, "i"));
    if (!keyMatch || !keyMatch[1]) return [];
    return keyMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*["']?([^"'\n]+)["']?/, "$1").trim())
      .filter(Boolean);
  };

  const mandatorySections = parseYamlArray("mandatory_sections");
  const recommendedSections = parseYamlArray("recommended_sections");
  const metadataFields = parseYamlArray("metadata_fields");

  return {
    mandatorySections: mandatorySections.length > 0 ? mandatorySections : [...MANDATORY_SPEC_SECTIONS],
    recommendedSections: recommendedSections.length > 0 ? recommendedSections : [...RECOMMENDED_SPEC_SECTIONS],
    metadataFields: metadataFields.length > 0 ? metadataFields : [...SPEC_METADATA_FIELDS],
  };
}
