/**
 * One-way renderer from a W3C ODRL 2.2 `Agreement` (plus optional W3C DCAT 3
 * distribution metadata) to an HL7 FHIR R5 `Permission` resource (bean
 * `folio-assistant-jfbm`, issue `litlfred/folio-assistant#2702`).
 *
 * Owner ruling, 2026-10-30 19:23Z ("A: Yes, later bean"):
 * - FHIR R5 `Permission` (Trial Use) is approved **for output only**.
 * - W3C ODRL 2.2 stays the source of truth; nothing reads `Permission` back.
 * - `FhirR5PermissionSchema` and its required value-set code lists are built
 *   at runtime from the published `hl7.fhir.r5.core#5.0.0`
 *   `StructureDefinition-Permission.json` and `CodeSystem-*.json` definitions,
 *   ensuring no field outside FHIR R5 `Permission` is ever invented.
 * - Every ODRL 2.2 (or DCAT 3 / SPDX) term that has no exact home in FHIR R5
 *   `Permission` is reported explicitly in the returned `dropped` array rather
 *   than dropped silently.
 *
 * @module fhir-harness/schemas/odrl-to-fhir-r5-permission
 * @graphNode schema
 * @conformsTo hl7-fhir
 * @conformsTo w3c-odrl
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  ANYONE,
  FOLIO_DEFAULT_CONFLICT,
  HL7_ACT_CODE_SYSTEM,
  HL7_ACT_REASON_SYSTEM,
  HL7_PURPOSE_OF_USE,
  ODRL_NS,
  isKnownHl7PurposeOfUse,
  normalizePurposeCode,
  resolvePublishedFhirPackageFile,
} from "./pcf-consent.js";

export const HL7_FHIR_R5_CORE_PACKAGE_ID = "hl7.fhir.r5.core#5.0.0" as const;
export const HL7_CONSENT_ACTION_SYSTEM = "http://terminology.hl7.org/CodeSystem/consentaction" as const;
export const RFC_3986_URI_SYSTEM = "urn:ietf:rfc:3986" as const;
export const SPDX_SHA256_ALGORITHM_IRI = "http://spdx.org/rdf/terms#checksumAlgorithm_sha256" as const;

interface R5ConceptNode {
  code?: string;
  concept?: readonly R5ConceptNode[];
}

export function loadR5CodeSystemCodes(filename: string): readonly [string, ...string[]] {
  const raw = JSON.parse(
    readFileSync(resolvePublishedFhirPackageFile(HL7_FHIR_R5_CORE_PACKAGE_ID, filename), "utf-8"),
  ) as { concept?: readonly R5ConceptNode[] };
  const codes: string[] = [];
  const walk = (nodes: readonly R5ConceptNode[] | undefined): void => {
    for (const n of nodes ?? []) {
      if (typeof n.code === "string" && n.code.length > 0 && !codes.includes(n.code)) {
        codes.push(n.code);
      }
      walk(n.concept);
    }
  };
  walk(raw.concept);
  if (codes.length === 0) {
    throw new Error(`No codes found in ${HL7_FHIR_R5_CORE_PACKAGE_ID}/${filename}`);
  }
  return codes as [string, ...string[]];
}

export const PERMISSION_STATUS_CODES = loadR5CodeSystemCodes("CodeSystem-permission-status.json");
export const PERMISSION_RULE_COMBINING_CODES = loadR5CodeSystemCodes(
  "CodeSystem-permission-rule-combining.json",
);
export const R5_CONSENT_PROVISION_TYPE_CODES = loadR5CodeSystemCodes(
  "CodeSystem-consent-provision-type.json",
);
export const R5_CONSENT_DATA_MEANING_CODES = loadR5CodeSystemCodes(
  "CodeSystem-consent-data-meaning.json",
);

export const FhirR5PermissionStatusSchema = z.enum(PERMISSION_STATUS_CODES);
export type FhirR5PermissionStatus = z.infer<typeof FhirR5PermissionStatusSchema>;

export const FhirR5PermissionRuleCombiningSchema = z.enum(PERMISSION_RULE_COMBINING_CODES);
export type FhirR5PermissionRuleCombining = z.infer<typeof FhirR5PermissionRuleCombiningSchema>;

export const FhirR5PermissionRuleTypeSchema = z.enum(R5_CONSENT_PROVISION_TYPE_CODES);
export type FhirR5PermissionRuleType = z.infer<typeof FhirR5PermissionRuleTypeSchema>;

export const FhirR5ConsentDataMeaningSchema = z.enum(R5_CONSENT_DATA_MEANING_CODES);
export type FhirR5ConsentDataMeaning = z.infer<typeof FhirR5ConsentDataMeaningSchema>;

const R5_VALUE_SET_REQUIRED_CODES: Readonly<Record<string, ReadonlySet<string>>> = {
  "http://hl7.org/fhir/ValueSet/permission-status": new Set(PERMISSION_STATUS_CODES),
  "http://hl7.org/fhir/ValueSet/permission-rule-combining": new Set(PERMISSION_RULE_COMBINING_CODES),
  "http://hl7.org/fhir/ValueSet/consent-provision-type": new Set(R5_CONSENT_PROVISION_TYPE_CODES),
  "http://hl7.org/fhir/ValueSet/consent-data-meaning": new Set(R5_CONSENT_DATA_MEANING_CODES),
};

interface SdElementType {
  code: string;
}

interface SdElementBinding {
  strength?: string;
  valueSet?: string;
}

interface SdElement {
  id: string;
  path: string;
  min: number;
  max: string;
  type?: readonly SdElementType[];
  contentReference?: string;
  binding?: SdElementBinding;
}

interface StructureDefinitionJson {
  resourceType: "StructureDefinition";
  id: string;
  type: string;
  snapshot: {
    element: readonly SdElement[];
  };
}

function isPlainRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x && typeof x === "object" && !Array.isArray(x));
}

const DATATYPE_ALLOWED_KEYS: Readonly<Record<string, ReadonlySet<string>>> = {
  Coding: new Set(["id", "extension", "system", "version", "code", "display", "userSelected"]),
  CodeableConcept: new Set(["id", "extension", "coding", "text"]),
  Identifier: new Set(["id", "extension", "use", "type", "system", "value", "period", "assigner"]),
  Reference: new Set(["id", "extension", "reference", "type", "identifier", "display"]),
  Period: new Set(["id", "extension", "start", "end"]),
  Expression: new Set(["id", "extension", "description", "name", "language", "expression", "reference"]),
  Meta: new Set(["id", "extension", "versionId", "lastUpdated", "source", "profile", "security", "tag"]),
  Narrative: new Set(["id", "extension", "status", "div"]),
};

function checkAllowedDatatypeKeys(
  obj: Record<string, unknown>,
  typeName: string,
  issuePath: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  const allowed = DATATYPE_ALLOWED_KEYS[typeName];
  if (!allowed) return;
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) continue;
    if (k.startsWith("_") && allowed.has(k.slice(1))) continue;
    if (!allowed.has(k)) {
      ctx.addIssue({
        code: "custom",
        path: [...issuePath, k],
        message: `Unknown element "${k}" on FHIR R5 ${typeName}`,
      });
    }
  }
}

function validateR5DatatypeValue(
  value: unknown,
  typeCode: string,
  issuePath: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  const normType = typeCode.endsWith("System.String") ? "string" : typeCode;
  switch (normType) {
    case "string":
    case "code":
    case "id":
    case "uri":
    case "url":
    case "canonical":
    case "oid":
    case "uuid":
    case "markdown":
    case "date":
    case "dateTime":
    case "instant":
    case "time":
    case "base64Binary":
    case "xhtml": {
      if (typeof value !== "string" || value.trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          path: issuePath,
          message: `Expected non-empty FHIR ${normType} string`,
        });
      }
      return;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR boolean" });
      }
      return;
    }
    case "unsignedInt":
    case "positiveInt":
    case "integer": {
      if (typeof value !== "number" || !Number.isInteger(value) || (normType !== "integer" && value < 0)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: `Expected FHIR ${normType}` });
      }
      return;
    }
    case "decimal": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR decimal" });
      }
      return;
    }
    case "Coding": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Coding object" });
        return;
      }
      checkAllowedDatatypeKeys(value, "Coding", issuePath, ctx);
      for (const k of ["system", "version", "code", "display"] as const) {
        if (
          value[k] !== undefined &&
          (typeof value[k] !== "string" || (k !== "display" && value[k].trim().length === 0))
        ) {
          ctx.addIssue({ code: "custom", path: [...issuePath, k], message: `Invalid Coding.${k}` });
        }
      }
      if (value.userSelected !== undefined && typeof value.userSelected !== "boolean") {
        ctx.addIssue({
          code: "custom",
          path: [...issuePath, "userSelected"],
          message: "Invalid Coding.userSelected",
        });
      }
      return;
    }
    case "CodeableConcept": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR CodeableConcept object" });
        return;
      }
      checkAllowedDatatypeKeys(value, "CodeableConcept", issuePath, ctx);
      if (value.coding !== undefined) {
        if (!Array.isArray(value.coding)) {
          ctx.addIssue({ code: "custom", path: [...issuePath, "coding"], message: "Expected Coding[] array" });
        } else {
          value.coding.forEach((c: unknown, i: number) =>
            validateR5DatatypeValue(c, "Coding", [...issuePath, "coding", i], ctx),
          );
        }
      }
      if (value.text !== undefined && typeof value.text !== "string") {
        ctx.addIssue({ code: "custom", path: [...issuePath, "text"], message: "Expected string for text" });
      }
      return;
    }
    case "Identifier": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Identifier object" });
        return;
      }
      checkAllowedDatatypeKeys(value, "Identifier", issuePath, ctx);
      for (const k of ["use", "system", "value"] as const) {
        if (value[k] !== undefined && (typeof value[k] !== "string" || value[k].trim().length === 0)) {
          ctx.addIssue({ code: "custom", path: [...issuePath, k], message: `Invalid Identifier.${k}` });
        }
      }
      if (value.type !== undefined) {
        validateR5DatatypeValue(value.type, "CodeableConcept", [...issuePath, "type"], ctx);
      }
      if (value.period !== undefined) {
        validateR5DatatypeValue(value.period, "Period", [...issuePath, "period"], ctx);
      }
      return;
    }
    case "Reference": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Reference object" });
        return;
      }
      checkAllowedDatatypeKeys(value, "Reference", issuePath, ctx);
      for (const k of ["reference", "type", "display"] as const) {
        if (
          value[k] !== undefined &&
          (typeof value[k] !== "string" || (k !== "display" && value[k].trim().length === 0))
        ) {
          ctx.addIssue({ code: "custom", path: [...issuePath, k], message: `Invalid Reference.${k}` });
        }
      }
      if (value.identifier !== undefined) {
        validateR5DatatypeValue(value.identifier, "Identifier", [...issuePath, "identifier"], ctx);
      }
      return;
    }
    case "Period": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Period object" });
        return;
      }
      checkAllowedDatatypeKeys(value, "Period", issuePath, ctx);
      for (const k of ["start", "end"] as const) {
        if (value[k] !== undefined && (typeof value[k] !== "string" || value[k].trim().length === 0)) {
          ctx.addIssue({ code: "custom", path: [...issuePath, k], message: `Invalid Period.${k}` });
        }
      }
      return;
    }
    case "Expression": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Expression object" });
        return;
      }
      checkAllowedDatatypeKeys(value, "Expression", issuePath, ctx);
      for (const k of ["description", "name", "language", "expression", "reference"] as const) {
        if (value[k] !== undefined && (typeof value[k] !== "string" || value[k].trim().length === 0)) {
          ctx.addIssue({ code: "custom", path: [...issuePath, k], message: `Invalid Expression.${k}` });
        }
      }
      return;
    }
    case "Meta": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Meta object" });
        return;
      }
      checkAllowedDatatypeKeys(value, "Meta", issuePath, ctx);
      if (value.versionId !== undefined && (typeof value.versionId !== "string" || value.versionId.trim().length === 0)) {
        ctx.addIssue({ code: "custom", path: [...issuePath, "versionId"], message: "Invalid Meta.versionId" });
      }
      if (value.profile !== undefined) {
        if (!Array.isArray(value.profile) || value.profile.some((p) => typeof p !== "string" || p.trim().length === 0)) {
          ctx.addIssue({ code: "custom", path: [...issuePath, "profile"], message: "Invalid Meta.profile" });
        }
      }
      return;
    }
    case "Narrative": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Narrative object" });
        return;
      }
      checkAllowedDatatypeKeys(value, "Narrative", issuePath, ctx);
      return;
    }
    default: {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: `Expected FHIR ${normType} object` });
      }
    }
  }
}

/**
 * Build a strict Zod validator directly from an `hl7.fhir.r5.core#5.0.0`
 * `StructureDefinition-*.json` snapshot, rejecting any element outside the
 * published FHIR R5 structure definition.
 */
export function buildSchemaFromR5StructureDefinition(
  sdFilename: string,
): z.ZodType<Record<string, unknown>> {
  const sd = JSON.parse(
    readFileSync(resolvePublishedFhirPackageFile(HL7_FHIR_R5_CORE_PACKAGE_ID, sdFilename), "utf-8"),
  ) as StructureDefinitionJson;
  const childrenByParent = new Map<string, SdElement[]>();

  for (const el of sd.snapshot.element) {
    if (el.path === sd.type) continue;
    const dot = el.path.lastIndexOf(".");
    if (dot < 0) continue;
    const parentPath = el.path.slice(0, dot);
    const list = childrenByParent.get(parentPath) ?? [];
    list.push(el);
    childrenByParent.set(parentPath, list);
  }

  const validateBackbone = (
    obj: Record<string, unknown>,
    sdPath: string,
    issuePath: (string | number)[],
    ctx: z.RefinementCtx,
  ): void => {
    const children = childrenByParent.get(sdPath) ?? [];
    const allowedFieldMap = new Map<string, { el: SdElement; chosenType: string }>();

    for (const child of children) {
      const rawName = child.path.slice(sdPath.length + 1);
      if (rawName.endsWith("[x]")) {
        const stem = rawName.slice(0, -3);
        for (const t of child.type ?? []) {
          const cap = t.code.charAt(0).toUpperCase() + t.code.slice(1);
          allowedFieldMap.set(`${stem}${cap}`, { el: child, chosenType: t.code });
        }
      } else {
        const chosenType =
          child.contentReference !== undefined
            ? "BackboneElement"
            : child.type?.[0]?.code ?? "BackboneElement";
        allowedFieldMap.set(rawName, { el: child, chosenType });
      }
    }

    for (const child of children) {
      if (child.min < 1) continue;
      const rawName = child.path.slice(sdPath.length + 1);
      if (rawName.endsWith("[x]")) {
        const stem = rawName.slice(0, -3);
        const present = (child.type ?? []).some((t) => {
          const cap = t.code.charAt(0).toUpperCase() + t.code.slice(1);
          return obj[`${stem}${cap}`] !== undefined;
        });
        if (!present) {
          ctx.addIssue({
            code: "custom",
            path: [...issuePath, rawName],
            message: `Missing required element ${child.path}`,
          });
        }
      } else if (obj[rawName] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [...issuePath, rawName],
          message: `Missing required element ${child.path}`,
        });
      }
    }

    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) continue;
      if (sdPath === sd.type && key === "resourceType") continue;
      if (key.startsWith("_") && allowedFieldMap.has(key.slice(1))) continue;

      const entry = allowedFieldMap.get(key);
      if (!entry) {
        ctx.addIssue({
          code: "custom",
          path: [...issuePath, key],
          message: `Unknown element "${key}" on ${sdPath}`,
        });
        continue;
      }

      const { el, chosenType } = entry;
      const targetSdPath = el.contentReference ? el.contentReference.replace(/^#/, "") : el.path;
      const requiredCodes =
        el.binding?.strength === "required" && el.binding.valueSet
          ? R5_VALUE_SET_REQUIRED_CODES[el.binding.valueSet.split("|")[0]!]
          : undefined;

      const checkSingleItem = (item: unknown, itemIssuePath: (string | number)[]): void => {
        if (chosenType === "BackboneElement") {
          if (!isPlainRecord(item)) {
            ctx.addIssue({
              code: "custom",
              path: itemIssuePath,
              message: `Expected BackboneElement object at ${el.path}`,
            });
            return;
          }
          validateBackbone(item, targetSdPath, itemIssuePath, ctx);
          return;
        }
        validateR5DatatypeValue(item, chosenType, itemIssuePath, ctx);
        if (requiredCodes && typeof item === "string" && !requiredCodes.has(item)) {
          ctx.addIssue({
            code: "custom",
            path: itemIssuePath,
            message: `Invalid code "${item}" for ${el.path}; expected one of ${[...requiredCodes].join(", ")}`,
          });
        }
      };

      if (el.max === "*") {
        if (!Array.isArray(val)) {
          ctx.addIssue({
            code: "custom",
            path: [...issuePath, key],
            message: `Expected array for repeating element ${el.path}`,
          });
          continue;
        }
        val.forEach((item: unknown, idx: number) => checkSingleItem(item, [...issuePath, key, idx]));
      } else {
        if (Array.isArray(val)) {
          ctx.addIssue({
            code: "custom",
            path: [...issuePath, key],
            message: `Expected single value (max=${el.max}) for ${el.path}`,
          });
          continue;
        }
        checkSingleItem(val, [...issuePath, key]);
      }
    }
  };

  // A record, not z.custom: z.custom has no JSON Schema form, so the site's
  // schema export could not publish this schema.
  return z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
    if (!isPlainRecord(val)) {
      ctx.addIssue({ code: "custom", path: [], message: `Expected FHIR ${sd.type} object` });
      return;
    }
    if (val.resourceType !== sd.type) {
      ctx.addIssue({
        code: "custom",
        path: ["resourceType"],
        message: `Expected resourceType "${sd.type}", received "${String(val.resourceType ?? "(missing)")}"`,
      });
      return;
    }
    validateBackbone(val, sd.type, [], ctx);
  });
}

/**
 * Strict FHIR R5 `Permission` schema built from
 * `hl7.fhir.r5.core#5.0.0/StructureDefinition-Permission.json`.
 */
export const FhirR5PermissionSchema = buildSchemaFromR5StructureDefinition(
  "StructureDefinition-Permission.json",
);
export type FhirR5Permission = z.infer<typeof FhirR5PermissionSchema>;

// ── ODRL 2.2 Agreement → FHIR R5 Permission (output only) ───────────────

export interface DroppedOdrlTerm {
  /** JSONPath-style location in the input ODRL Agreement or DCAT record. */
  path: string;
  /** The ODRL 2.2 (or DCAT 3 / SPDX) term name that has no exact FHIR R5 Permission home. */
  term: string;
  /** The input value that was dropped or only lossily approximated. */
  value: unknown;
  /** Why FHIR R5 Permission has no exact home for this term, or how it was approximated. */
  reason: string;
  /**
   * `"dropped"` when omitted entirely from the FHIR R5 Permission output;
   * `"lossy"` when approximated in a FHIR R5 Permission element that does not preserve full ODRL semantics.
   */
  disposition: "dropped" | "lossy";
}

export interface DcatSpdxChecksumInput {
  "@type"?: string;
  "spdx:algorithm"?: string | { "@id"?: string };
  "spdx:checksumValue"?: string;
}

export interface DcatDistributionInput {
  "@type"?: string;
  "@id"?: string;
  "dcterms:title"?: string;
  "dcat:downloadURL"?: string;
  "dcat:accessURL"?: string;
  "dcat:mediaType"?: string;
  "spdx:checksum"?: DcatSpdxChecksumInput;
}

export interface DcatResourceInput {
  "@context"?: unknown;
  "@type"?: string;
  "@id"?: string;
  "dcterms:title"?: string;
  "dcterms:description"?: string;
  "dcterms:issued"?: string;
  "dcat:version"?: string;
  "dcat:previousVersion"?: string | { "@id"?: string };
  "adms:status"?: string | { "@id"?: string };
  "odrl:hasPolicy"?: string | { "@id"?: string };
  "dcat:distribution"?: readonly DcatDistributionInput[];
}

export interface OdrlToFhirR5PermissionOptions {
  /** Optional FHIR resource `id` for the rendered `Permission`. */
  id?: string;
  /**
   * Explicit `Permission.status` (`active | entered-in-error | draft | rejected`).
   * If omitted, derived from `dcat["adms:status"]` when provided, or defaults to `"active"`.
   */
  status?: FhirR5PermissionStatus;
  /** Optional DCAT 3 `dcat:Resource` metadata for the agreement version. */
  dcat?: DcatResourceInput;
  /**
   * Optional map from party/target IRIs (e.g. `"https://ministry-m.example.org/"`)
   * to FHIR `Reference`s (e.g. `{ reference: "Organization/MinistryM" }` or display strings).
   */
  partyReferences?: Readonly<
    Record<string, { reference?: string; display?: string; type?: string }>
  >;
  /**
   * Optional map from dataset/target IRIs to human-readable display labels
   * on `rule.data.resource.reference.display`.
   */
  targetDisplays?: Readonly<Record<string, string>>;
  /**
   * Optional display label for the agreement's fixed-version `uid` on
   * `justification.evidence[0].display`.
   */
  agreementDisplay?: string;
  /**
   * Optional human-readable display labels for HL7 `PurposeOfUse` codes.
   */
  purposeDisplays?: Readonly<Record<string, string>>;
}

export interface OdrlToFhirR5PermissionResult {
  /** The rendered FHIR R5 `Permission` resource, validated against `FhirR5PermissionSchema`. */
  permission: FhirR5Permission;
  /**
   * Every ODRL 2.2 (or DCAT 3 / SPDX) term from the input that has no exact
   * home in FHIR R5 `Permission` (either omitted or only lossily approximated).
   */
  dropped: DroppedOdrlTerm[];
}

const DEFAULT_PURPOSE_DISPLAYS: Readonly<Record<string, string>> = {
  PUBHLTH: "public health",
  TREAT: "treatment",
  HPAYMT: "healthcare payment",
  HOPERAT: "healthcare operations",
  HRESCH: "healthcare research",
  ETREAT: "emergency treatment",
  BTG: "break the glass",
};

const FHIR_RELATIVE_REF_RE = /^[A-Z][A-Za-z0-9]*\/[A-Za-z0-9\-._]{1,64}$/;

function stripOdrlPrefix(term: string): string {
  if (term.startsWith(ODRL_NS)) return term.slice(ODRL_NS.length);
  if (term.startsWith("odrl:")) return term.slice("odrl:".length);
  return term;
}

function buildPartyOrTargetReference(
  iriOrRef: string,
  options: OdrlToFhirR5PermissionOptions,
  isTarget = false,
): Record<string, unknown> {
  const mapped = options.partyReferences?.[iriOrRef];
  if (mapped?.reference) {
    const out: Record<string, unknown> = { reference: mapped.reference };
    if (mapped.type) out.type = mapped.type;
    if (mapped.display) out.display = mapped.display;
    return out;
  }
  if (FHIR_RELATIVE_REF_RE.test(iriOrRef)) {
    const out: Record<string, unknown> = { reference: iriOrRef };
    const disp = isTarget ? options.targetDisplays?.[iriOrRef] : mapped?.display;
    if (disp) out.display = disp;
    return out;
  }
  const out: Record<string, unknown> = {
    identifier: {
      system: RFC_3986_URI_SYSTEM,
      value: iriOrRef,
    },
  };
  const disp = isTarget
    ? options.targetDisplays?.[iriOrRef]
    : mapped?.display;
  if (disp) {
    out.display = disp;
  }
  return out;
}

function deriveStatusFromDcat(
  dcat: DcatResourceInput | undefined,
  explicitStatus: FhirR5PermissionStatus | undefined,
): FhirR5PermissionStatus {
  if (explicitStatus) return explicitStatus;
  if (!dcat || !dcat["adms:status"]) return "active";
  const raw =
    typeof dcat["adms:status"] === "string"
      ? dcat["adms:status"]
      : dcat["adms:status"]["@id"] ?? "";
  if (raw.endsWith("/Completed") || raw.endsWith("#Completed") || raw === "Completed") {
    return "active";
  }
  if (raw.endsWith("/UnderDevelopment") || raw === "UnderDevelopment") {
    return "draft";
  }
  if (raw.endsWith("/Withdrawn") || raw.endsWith("/Deprecated") || raw === "Withdrawn" || raw === "Deprecated") {
    return "rejected";
  }
  return "active";
}

function convertExclusiveEndToInclusive(bound: string): string {
  // If bound is a bare YYYY-MM-DD date, the last inclusive second before it is 23:59:59Z of the previous day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(bound)) {
    const ms = Date.parse(`${bound}T00:00:00Z`);
    if (Number.isFinite(ms)) {
      return new Date(ms - 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
    }
  }
  const ms = Date.parse(bound);
  if (Number.isFinite(ms)) {
    return new Date(ms - 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  return bound;
}

function convertExclusiveStartToInclusive(bound: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(bound)) {
    const ms = Date.parse(`${bound}T23:59:59Z`);
    if (Number.isFinite(ms)) {
      return new Date(ms + 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
    }
  }
  const ms = Date.parse(bound);
  if (Number.isFinite(ms)) {
    return new Date(ms + 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  return bound;
}

interface ExtractedRulePeriod {
  rulePath: string;
  start?: string;
  end?: string;
  startHasTime: boolean;
  endHasTime: boolean;
}

const KNOWN_TOP_LEVEL_KEYS = new Set([
  "@context",
  "@type",
  "@id",
  "uid",
  "profile",
  "inheritFrom",
  "conflict",
  "assigner",
  "assignee",
  "dcterms:source",
  "source",
  "odrl:source",
  "permission",
  "prohibition",
  "obligation",
  "duty",
]);

const KNOWN_RULE_KEYS = new Set([
  "uid",
  "assignee",
  "assigner",
  "action",
  "target",
  "constraint",
  "duty",
]);

const KNOWN_DUTY_KEYS = new Set([
  "uid",
  "action",
  "target",
  "assigner",
  "assignee",
  "constraint",
]);

const KNOWN_CONSTRAINT_KEYS = new Set([
  "uid",
  "leftOperand",
  "operator",
  "rightOperand",
]);

/**
 * Map an ODRL 2.2 action IRI or compact term to a FHIR `CodeableConcept` for
 * `Permission.rule.activity.action`, recording in `dropped` when the mapping
 * to `http://terminology.hl7.org/CodeSystem/consentaction` is approximate or
 * absent.
 */
function mapOdrlActionToActivityAction(
  rawAction: string,
  actionPath: string,
  dropped: DroppedOdrlTerm[],
): Record<string, unknown> {
  const bare = stripOdrlPrefix(rawAction);
  switch (bare) {
    case "use":
      return {
        coding: [{ system: HL7_CONSENT_ACTION_SYSTEM, code: "use", display: "use" }],
      };
    case "read":
      return {
        coding: [{ system: HL7_CONSENT_ACTION_SYSTEM, code: "access", display: "access" }],
      };
    case "display":
      dropped.push({
        path: actionPath,
        term: rawAction,
        value: rawAction,
        reason:
          "ODRL action display has no exact HL7 consentaction code; approximated as consentaction#access.",
        disposition: "lossy",
      });
      return {
        coding: [{ system: HL7_CONSENT_ACTION_SYSTEM, code: "access", display: "access" }],
      };
    case "collect":
      return {
        coding: [{ system: HL7_CONSENT_ACTION_SYSTEM, code: "collect", display: "collect" }],
      };
    case "modify":
    case "annotate":
      dropped.push({
        path: actionPath,
        term: rawAction,
        value: rawAction,
        reason: `ODRL action ${bare} has no exact HL7 consentaction code; approximated as consentaction#correct.`,
        disposition: "lossy",
      });
      return {
        coding: [{ system: HL7_CONSENT_ACTION_SYSTEM, code: "correct", display: "correct" }],
      };
    case "distribute":
    case "transfer":
    case "share":
      dropped.push({
        path: actionPath,
        term: rawAction,
        value: rawAction,
        reason: `ODRL action ${bare} maps only approximately to HL7 consentaction#disclose.`,
        disposition: "lossy",
      });
      return {
        coding: [{ system: HL7_CONSENT_ACTION_SYSTEM, code: "disclose", display: "disclose" }],
      };
    default:
      dropped.push({
        path: actionPath,
        term: rawAction,
        value: rawAction,
        reason: `ODRL action ${bare} has no code in HL7 consentaction; emitted with ODRL vocabulary system ${ODRL_NS}.`,
        disposition: "lossy",
      });
      return {
        coding: [{ system: ODRL_NS, code: bare, display: bare }],
      };
  }
}

/**
 * Render a W3C ODRL 2.2 `Agreement` (and optional DCAT 3 resource metadata)
 * one way to an HL7 FHIR R5 `Permission` resource, returning both the validated
 * `Permission` and the explicit list of `dropped` ODRL / DCAT / SPDX terms.
 */
export function odrlAgreementToFhirR5Permission(
  agreement: Record<string, unknown>,
  options: OdrlToFhirR5PermissionOptions = {},
): OdrlToFhirR5PermissionResult {
  const dropped: DroppedOdrlTerm[] = [];

  // 1. Policy type (@type)
  const policyType = agreement["@type"];
  if (policyType !== undefined) {
    dropped.push({
      path: "@type",
      term: "@type",
      value: policyType,
      reason:
        "FHIR R5 Permission has no element distinguishing ODRL policy types (Agreement vs Set vs Offer).",
      disposition: "dropped",
    });
  }

  // 2. ODRL profile and inheritFrom
  if (agreement.profile !== undefined) {
    dropped.push({
      path: "profile",
      term: "profile",
      value: agreement.profile,
      reason: "FHIR R5 Permission has no ODRL profile element.",
      disposition: "dropped",
    });
  }
  if (agreement.inheritFrom !== undefined) {
    dropped.push({
      path: "inheritFrom",
      term: "inheritFrom",
      value: agreement.inheritFrom,
      reason: "FHIR R5 Permission has no policy inheritance (inheritFrom) mechanism.",
      disposition: "dropped",
    });
  }

  // Report any unknown/unmapped top-level ODRL terms (e.g. duty/obligation at top level, etc.)
  for (const [k, v] of Object.entries(agreement)) {
    if (v === undefined || KNOWN_TOP_LEVEL_KEYS.has(k)) continue;
    dropped.push({
      path: k,
      term: k,
      value: v,
      reason: `Top-level ODRL property "${k}" has no home in FHIR R5 Permission.`,
      disposition: "dropped",
    });
  }

  // Policy-level obligations/duties
  for (const key of ["obligation", "duty"] as const) {
    const list = agreement[key];
    if (Array.isArray(list)) {
      list.forEach((ob: unknown, idx: number) => {
        dropped.push({
          path: `${key}[${idx}]`,
          term: key,
          value: ob,
          reason: "FHIR R5 Permission has no policy-level obligation/duty element.",
          disposition: "dropped",
        });
      });
    }
  }

  // 3. Conflict strategy -> Permission.combining
  const rawConflict =
    typeof agreement.conflict === "string"
      ? stripOdrlPrefix(agreement.conflict)
      : stripOdrlPrefix(FOLIO_DEFAULT_CONFLICT);
  let combining: FhirR5PermissionRuleCombining;
  if (rawConflict === "prohibit") {
    combining = "deny-overrides";
  } else if (rawConflict === "perm") {
    combining = "permit-overrides";
  } else {
    combining = "deny-unless-permit";
    dropped.push({
      path: "conflict",
      term: "conflict",
      value: agreement.conflict,
      reason:
        'ODRL conflict="invalid" voids the entire policy on clash, which has no counterpart in FHIR R5 Permission.combining; approximated as "deny-unless-permit".',
      disposition: "lossy",
    });
  }

  // 4. Assigner -> Permission.asserter
  const asserter =
    typeof agreement.assigner === "string" && agreement.assigner.trim().length > 0
      ? buildPartyOrTargetReference(agreement.assigner, options, false)
      : undefined;

  // 5. Public agreement citation (uid, dcterms:source, DCAT distribution + spdx:checksum) -> justification
  const uid =
    typeof agreement.uid === "string" && agreement.uid.trim().length > 0
      ? agreement.uid
      : typeof agreement["@id"] === "string" && agreement["@id"].trim().length > 0
        ? agreement["@id"]
        : undefined;
  const dctermsSource =
    typeof agreement["dcterms:source"] === "string"
      ? agreement["dcterms:source"]
      : typeof agreement.source === "string"
        ? agreement.source
        : typeof agreement["odrl:source"] === "string"
          ? agreement["odrl:source"]
          : undefined;

  const evidenceList: Record<string, unknown>[] = [];
  const basisList: Record<string, unknown>[] = [];

  if (uid) {
    const ev: Record<string, unknown> = {
      identifier: {
        system: RFC_3986_URI_SYSTEM,
        value: uid,
      },
    };
    if (options.agreementDisplay) {
      ev.display = options.agreementDisplay;
    } else if (options.dcat?.["dcterms:title"]) {
      ev.display = options.dcat["dcterms:title"];
    }
    evidenceList.push(ev);
  }

  if (dctermsSource && dctermsSource !== uid) {
    evidenceList.push({
      identifier: {
        system: RFC_3986_URI_SYSTEM,
        value: dctermsSource,
      },
      display: dctermsSource,
    });
    basisList.push({
      coding: [
        {
          system: RFC_3986_URI_SYSTEM,
          code: dctermsSource,
        },
      ],
      text: dctermsSource,
    });
  }

  if (options.dcat?.["dcat:distribution"]) {
    options.dcat["dcat:distribution"].forEach((dist, idx) => {
      const distUrl = dist["dcat:downloadURL"] ?? dist["@id"] ?? dist["dcat:accessURL"];
      if (
        distUrl &&
        distUrl !== uid &&
        distUrl !== dctermsSource &&
        !evidenceList.some((e) => isPlainRecord(e.identifier) && e.identifier.value === distUrl)
      ) {
        const ev: Record<string, unknown> = {
          identifier: {
            system: RFC_3986_URI_SYSTEM,
            value: distUrl,
          },
        };
        if (dist["dcterms:title"]) ev.display = dist["dcterms:title"];
        evidenceList.push(ev);
      }
      if (dist["spdx:checksum"] !== undefined) {
        dropped.push({
          path: `dcat:distribution[${idx}].spdx:checksum`,
          term: "spdx:checksum",
          value: dist["spdx:checksum"],
          reason:
            "FHIR R5 Reference on Permission.justification.evidence has no cryptographic hash field (and Attachment.hash in R5 is SHA-1, not SHA-256).",
          disposition: "dropped",
        });
      }
    });
  }

  // 6. Rules (permission[] -> permit, prohibition[] -> deny) and dateTime extraction
  const renderedRules: Record<string, unknown>[] = [];
  const extractedPeriods: ExtractedRulePeriod[] = [];

  const processRuleList = (
    rules: unknown,
    listKey: "permission" | "prohibition",
    ruleType: "permit" | "deny",
  ): void => {
    if (!Array.isArray(rules)) return;
    rules.forEach((rawRule, ruleIdx) => {
      const rulePath = `${listKey}[${ruleIdx}]`;
      if (!isPlainRecord(rawRule)) return;

      for (const [rk, rv] of Object.entries(rawRule)) {
        if (rv === undefined || KNOWN_RULE_KEYS.has(rk)) continue;
        dropped.push({
          path: `${rulePath}.${rk}`,
          term: rk,
          value: rv,
          reason: `ODRL rule property "${rk}" has no home in FHIR R5 Permission.rule.`,
          disposition: "dropped",
        });
      }

      if (rawRule.uid !== undefined) {
        dropped.push({
          path: `${rulePath}.uid`,
          term: "uid",
          value: rawRule.uid,
          reason: "FHIR R5 Permission.rule has no URI identifier element.",
          disposition: "dropped",
        });
      }

      const dataEntries: Record<string, unknown>[] = [];
      if (typeof rawRule.target === "string" && rawRule.target.trim().length > 0) {
        dataEntries.push({
          resource: [
            {
              meaning: "instance",
              reference: buildPartyOrTargetReference(rawRule.target, options, true),
            },
          ],
        });
      } else if (isPlainRecord(rawRule.target)) {
        dropped.push({
          path: `${rulePath}.target`,
          term: "target",
          value: rawRule.target,
          reason:
            "Complex ODRL AssetCollection / refinement on target has no direct representation in Permission.rule.data.resource.",
          disposition: "dropped",
        });
      }

      // Activity: actor, action, purpose
      const actorRefs: Record<string, unknown>[] = [];
      const effectiveAssignee =
        typeof rawRule.assignee === "string" && rawRule.assignee.trim().length > 0
          ? rawRule.assignee
          : typeof agreement.assignee === "string" && agreement.assignee.trim().length > 0
            ? agreement.assignee
            : undefined;
      if (effectiveAssignee && effectiveAssignee !== ANYONE) {
        actorRefs.push(buildPartyOrTargetReference(effectiveAssignee, options, false));
      } else if (isPlainRecord(rawRule.assignee)) {
        dropped.push({
          path: `${rulePath}.assignee`,
          term: "assignee",
          value: rawRule.assignee,
          reason:
            "Complex ODRL PartyCollection / refinement on assignee has no direct representation in Permission.rule.activity.actor.",
          disposition: "dropped",
        });
      }

      const actionConcepts: Record<string, unknown>[] = [];
      if (typeof rawRule.action === "string" && rawRule.action.trim().length > 0) {
        actionConcepts.push(
          mapOdrlActionToActivityAction(rawRule.action, `${rulePath}.action`, dropped),
        );
      } else if (Array.isArray(rawRule.action)) {
        rawRule.action.forEach((act: unknown, aIdx: number) => {
          if (typeof act === "string" && act.trim().length > 0) {
            actionConcepts.push(
              mapOdrlActionToActivityAction(act, `${rulePath}.action[${aIdx}]`, dropped),
            );
          } else {
            dropped.push({
              path: `${rulePath}.action[${aIdx}]`,
              term: "action",
              value: act,
              reason: "Refined ODRL Action object has no home in Permission.rule.activity.action.",
              disposition: "dropped",
            });
          }
        });
      } else if (isPlainRecord(rawRule.action)) {
        dropped.push({
          path: `${rulePath}.action`,
          term: "action",
          value: rawRule.action,
          reason: "Refined ODRL Action object has no home in Permission.rule.activity.action.",
          disposition: "dropped",
        });
      }

      // Constraints on rule
      const purposeConcepts: Record<string, unknown>[] = [];
      let ruleStart: string | undefined;
      let ruleEnd: string | undefined;
      let startHasTime = false;
      let endHasTime = false;

      if (Array.isArray(rawRule.constraint)) {
        rawRule.constraint.forEach((c: unknown, cIdx: number) => {
          const cPath = `${rulePath}.constraint[${cIdx}]`;
          if (!isPlainRecord(c)) {
            dropped.push({
              path: cPath,
              term: "constraint",
              value: c,
              reason: "Non-object ODRL constraint cannot be mapped to FHIR R5 Permission.",
              disposition: "dropped",
            });
            return;
          }

          for (const [ck, cv] of Object.entries(c)) {
            if (cv === undefined || KNOWN_CONSTRAINT_KEYS.has(ck)) continue;
            dropped.push({
              path: `${cPath}.${ck}`,
              term: ck,
              value: cv,
              reason: `ODRL constraint property "${ck}" has no home in FHIR R5 Permission.`,
              disposition: "dropped",
            });
          }

          const left = typeof c.leftOperand === "string" ? stripOdrlPrefix(c.leftOperand) : "";
          const op = typeof c.operator === "string" ? stripOdrlPrefix(c.operator) : "";
          const right = c.rightOperand;

          if (left === "purpose") {
            const rawValues = Array.isArray(right)
              ? right.filter((x): x is string => typeof x === "string")
              : typeof right === "string"
                ? [right]
                : [];
            if (op === "eq" || op === "isAnyOf" || op === "isA") {
              if (op === "isA") {
                dropped.push({
                  path: `${cPath}.operator`,
                  term: "isA",
                  value: c.operator,
                  reason:
                    "Permission.rule.activity.purpose holds only the CodeableConcept code; the ODRL isA hierarchical subsumption operator is not represented.",
                  disposition: "lossy",
                });
              }
              for (const rawPurpose of rawValues) {
                const code = normalizePurposeCode(rawPurpose);
                if (!isKnownHl7PurposeOfUse(code)) {
                  dropped.push({
                    path: `${cPath}.rightOperand`,
                    term: "purpose",
                    value: rawPurpose,
                    reason: `Purpose "${rawPurpose}" is not in HL7 v3-ActReason PurposeOfUse (${ Object.keys(HL7_PURPOSE_OF_USE).length } concepts).`,
                    disposition: "dropped",
                  });
                  continue;
                }
                const display =
                  options.purposeDisplays?.[code] ?? DEFAULT_PURPOSE_DISPLAYS[code];
                const codingEntry: Record<string, unknown> = {
                  system: HL7_ACT_REASON_SYSTEM,
                  code,
                };
                if (display) codingEntry.display = display;
                purposeConcepts.push({ coding: [codingEntry] });
              }
            } else {
              dropped.push({
                path: cPath,
                term: "purpose",
                value: c,
                reason: `Negative or unsupported purpose constraint operator "${String(c.operator)}" cannot be represented in Permission.rule.activity.purpose.`,
                disposition: "dropped",
              });
            }
            return;
          }

          if (left === "dateTime" && typeof right === "string") {
            if (op === "gteq") {
              ruleStart = right;
              startHasTime = right.includes("T");
              return;
            }
            if (op === "gt") {
              ruleStart = convertExclusiveStartToInclusive(right);
              startHasTime = ruleStart.includes("T");
              dropped.push({
                path: `${cPath}.operator`,
                term: "gt",
                value: c.operator,
                reason:
                  "FHIR Period.start is inclusive; exclusive ODRL gt bound was converted to the first second after the bound.",
                disposition: "lossy",
              });
              return;
            }
            if (op === "lteq") {
              ruleEnd = right;
              endHasTime = right.includes("T");
              return;
            }
            if (op === "lt") {
              ruleEnd = convertExclusiveEndToInclusive(right);
              endHasTime = ruleEnd.includes("T");
              dropped.push({
                path: `${cPath}.operator`,
                term: "lt",
                value: c.operator,
                reason:
                  "FHIR Period.end is inclusive; exclusive ODRL lt bound was converted to the last second before the bound.",
                disposition: "lossy",
              });
              return;
            }
            if (op === "eq") {
              ruleStart = right;
              ruleEnd = right;
              startHasTime = right.includes("T");
              endHasTime = right.includes("T");
              return;
            }
            dropped.push({
              path: cPath,
              term: "dateTime",
              value: c,
              reason: `dateTime constraint with operator "${String(c.operator)}" cannot be represented in FHIR Period.`,
              disposition: "dropped",
            });
            return;
          }

          // Any other constraint (e.g. elapsedTime, cat-harness:process/task/role, logical constraints)
          dropped.push({
            path: cPath,
            term: typeof c.leftOperand === "string" ? c.leftOperand : "constraint",
            value: c,
            reason: `ODRL constraint on "${String(c.leftOperand ?? "unknown")}" has no home in FHIR R5 Permission.`,
            disposition: "dropped",
          });
        });
      }

      if (ruleStart !== undefined || ruleEnd !== undefined) {
        if (ruleStart && ruleEnd && !startHasTime && endHasTime && /^\d{4}-\d{2}-\d{2}$/.test(ruleStart)) {
          ruleStart = `${ruleStart}T00:00:00Z`;
        }
        extractedPeriods.push({
          rulePath,
          start: ruleStart,
          end: ruleEnd,
          startHasTime,
          endHasTime,
        });
      }

      // Duties on rule
      const limitConcepts: Record<string, unknown>[] = [];
      if (Array.isArray(rawRule.duty)) {
        rawRule.duty.forEach((rawDuty: unknown, dIdx: number) => {
          const dutyPath = `${rulePath}.duty[${dIdx}]`;
          if (!isPlainRecord(rawDuty)) {
            dropped.push({
              path: dutyPath,
              term: "duty",
              value: rawDuty,
              reason: "Non-object ODRL duty cannot be mapped to FHIR R5 Permission.",
              disposition: "dropped",
            });
            return;
          }

          const rawDutyAction = typeof rawDuty.action === "string" ? rawDuty.action : "";
          const bareDutyAction = stripOdrlPrefix(rawDutyAction);

          if (bareDutyAction === "delete") {
            limitConcepts.push({
              coding: [
                {
                  system: HL7_ACT_CODE_SYSTEM,
                  code: "DELAU",
                  display: "delete after use",
                },
              ],
            });
            dropped.push({
              path: dutyPath,
              term: "duty",
              value: rawDuty,
              reason:
                "ODRL delete duty maps only roughly to Permission.rule.limit (v3-ActCode#DELAU); FHIR R5 Permission has no structured duty element.",
              disposition: "lossy",
            });
          } else {
            dropped.push({
              path: dutyPath,
              term: `duty:${bareDutyAction || "unknown"}`,
              value: rawDuty,
              reason: `ODRL duty "${rawDutyAction || "unknown"}" has no HL7 ObligationPolicy code in Permission.rule.limit and no structured duty home in FHIR R5 Permission.`,
              disposition: "dropped",
            });
          }

          if (rawDuty.target !== undefined) {
            dropped.push({
              path: `${dutyPath}.target`,
              term: "target",
              value: rawDuty.target,
              reason: "Permission.rule.limit is a CodeableConcept and cannot carry a duty target.",
              disposition: "dropped",
            });
          }
          if (Array.isArray(rawDuty.constraint)) {
            rawDuty.constraint.forEach((dc: unknown, dcIdx: number) => {
              dropped.push({
                path: `${dutyPath}.constraint[${dcIdx}]`,
                term: "constraint",
                value: dc,
                reason:
                  "Permission.rule.limit is a CodeableConcept and cannot carry duty constraints (such as a deletion deadline).",
                disposition: "dropped",
              });
            });
          }
          for (const [dk, dv] of Object.entries(rawDuty)) {
            if (dv === undefined || KNOWN_DUTY_KEYS.has(dk)) continue;
            dropped.push({
              path: `${dutyPath}.${dk}`,
              term: dk,
              value: dv,
              reason: `Duty property "${dk}" on ODRL duty has no home in FHIR R5 Permission.`,
              disposition: "dropped",
            });
          }
        });
      }

      const ruleObj: Record<string, unknown> = {
        type: ruleType,
      };
      if (dataEntries.length > 0) {
        ruleObj.data = dataEntries;
      }
      if (actorRefs.length > 0 || actionConcepts.length > 0 || purposeConcepts.length > 0) {
        const activityObj: Record<string, unknown> = {};
        if (actorRefs.length > 0) activityObj.actor = actorRefs;
        if (actionConcepts.length > 0) activityObj.action = actionConcepts;
        if (purposeConcepts.length > 0) activityObj.purpose = purposeConcepts;
        ruleObj.activity = [activityObj];
      }
      if (limitConcepts.length > 0) {
        ruleObj.limit = limitConcepts;
      }
      renderedRules.push(ruleObj);
    });
  };

  processRuleList(agreement.permission, "permission", "permit");
  processRuleList(agreement.prohibition, "prohibition", "deny");

  // 7. Reconcile rule periods into Permission.validity
  let validity: Record<string, string> | undefined;
  if (extractedPeriods.length > 0) {
    const first = extractedPeriods[0]!;
    const periodObj: Record<string, string> = {};
    if (first.start) periodObj.start = first.start;
    if (first.end) periodObj.end = first.end;
    validity = periodObj;

    for (let i = 1; i < extractedPeriods.length; i++) {
      const p = extractedPeriods[i]!;
      if (p.start !== first.start || p.end !== first.end) {
        dropped.push({
          path: `${p.rulePath}.constraint`,
          term: "dateTime",
          value: { start: p.start, end: p.end },
          reason:
            "FHIR R5 Permission.validity is policy-wide (0..1) and Permission.rule has no rule-validity Period; conflicting per-rule dateTime bounds were dropped.",
          disposition: "dropped",
        });
      }
    }
  }

  // 8. Assemble FHIR R5 Permission
  const permission: Record<string, unknown> = {
    resourceType: "Permission",
    status: deriveStatusFromDcat(options.dcat, options.status),
  };
  if (options.id) {
    permission.id = options.id;
  }
  if (asserter) {
    permission.asserter = asserter;
  }
  if (options.dcat?.["dcterms:issued"]) {
    permission.date = [options.dcat["dcterms:issued"]];
  }
  if (validity && Object.keys(validity).length > 0) {
    permission.validity = validity;
  }
  if (basisList.length > 0 || evidenceList.length > 0) {
    const justification: Record<string, unknown> = {};
    if (basisList.length > 0) justification.basis = basisList;
    if (evidenceList.length > 0) justification.evidence = evidenceList;
    permission.justification = justification;
  }
  permission.combining = combining;
  if (renderedRules.length > 0) {
    permission.rule = renderedRules;
  }

  // Validate against published R5 StructureDefinition-Permission.json so no
  // invented field or invalid code can ever be returned.
  const validated = FhirR5PermissionSchema.parse(permission);
  return {
    permission: validated,
    dropped,
  };
}

/**
 * Format a validated FHIR R5 `Permission` resource as a FHIR Shorthand (FSH)
 * `Instance` of `Permission` for SUSHI compilation.
 */
export function fhirR5PermissionToFsh(
  permission: FhirR5Permission,
  options: {
    instanceId?: string;
    title?: string;
    description?: string;
  } = {},
): string {
  const instanceId = options.instanceId ?? permission.id ?? "RenderedDSAPermission";
  const lines: string[] = [
    `Instance: ${instanceId}`,
    "InstanceOf: Permission",
    "Usage: #example",
  ];
  if (options.title) {
    lines.push(`Title: ${JSON.stringify(options.title)}`);
  }
  if (options.description) {
    lines.push(`Description: ${JSON.stringify(options.description)}`);
  }
  lines.push(`* status = #${permission.status}`);

  const emitReference = (prefix: string, ref: Record<string, unknown>): void => {
    if (typeof ref.reference === "string") {
      lines.push(`* ${prefix}.reference = ${JSON.stringify(ref.reference)}`);
    }
    if (typeof ref.type === "string") {
      lines.push(`* ${prefix}.type = ${JSON.stringify(ref.type)}`);
    }
    if (isPlainRecord(ref.identifier)) {
      if (typeof ref.identifier.system === "string") {
        lines.push(`* ${prefix}.identifier.system = ${JSON.stringify(ref.identifier.system)}`);
      }
      if (typeof ref.identifier.value === "string") {
        lines.push(`* ${prefix}.identifier.value = ${JSON.stringify(ref.identifier.value)}`);
      }
    }
    if (typeof ref.display === "string") {
      lines.push(`* ${prefix}.display = ${JSON.stringify(ref.display)}`);
    }
  };

  const emitCodeableConcept = (prefix: string, cc: Record<string, unknown>): void => {
    if (Array.isArray(cc.coding)) {
      cc.coding.forEach((c: unknown, idx: number) => {
        if (!isPlainRecord(c)) return;
        if (typeof c.system === "string" && typeof c.code === "string") {
          const disp = typeof c.display === "string" ? ` ${JSON.stringify(c.display)}` : "";
          lines.push(`* ${prefix}.coding[${idx}] = ${c.system}#${c.code}${disp}`);
        }
      });
    }
    if (typeof cc.text === "string") {
      lines.push(`* ${prefix}.text = ${JSON.stringify(cc.text)}`);
    }
  };

  if (isPlainRecord(permission.asserter)) {
    emitReference("asserter", permission.asserter);
  }
  if (Array.isArray(permission.date)) {
    permission.date.forEach((d: unknown, i: number) => {
      if (typeof d === "string") {
        lines.push(`* date[${i}] = ${JSON.stringify(d)}`);
      }
    });
  }
  if (isPlainRecord(permission.validity)) {
    if (typeof permission.validity.start === "string") {
      lines.push(`* validity.start = ${JSON.stringify(permission.validity.start)}`);
    }
    if (typeof permission.validity.end === "string") {
      lines.push(`* validity.end = ${JSON.stringify(permission.validity.end)}`);
    }
  }
  if (isPlainRecord(permission.justification)) {
    if (Array.isArray(permission.justification.basis)) {
      permission.justification.basis.forEach((b: unknown, i: number) => {
        if (isPlainRecord(b)) emitCodeableConcept(`justification.basis[${i}]`, b);
      });
    }
    if (Array.isArray(permission.justification.evidence)) {
      permission.justification.evidence.forEach((ev: unknown, i: number) => {
        if (isPlainRecord(ev)) emitReference(`justification.evidence[${i}]`, ev);
      });
    }
  }
  lines.push(`* combining = #${String(permission.combining)}`);

  if (Array.isArray(permission.rule)) {
    permission.rule.forEach((r: unknown, rIdx: number) => {
      if (!isPlainRecord(r)) return;
      const rPrefix = `rule[${rIdx}]`;
      if (typeof r.type === "string") {
        lines.push(`* ${rPrefix}.type = #${r.type}`);
      }
      if (Array.isArray(r.data)) {
        r.data.forEach((d: unknown, dIdx: number) => {
          if (!isPlainRecord(d)) return;
          const dPrefix = `${rPrefix}.data[${dIdx}]`;
          if (Array.isArray(d.resource)) {
            d.resource.forEach((res: unknown, resIdx: number) => {
              if (!isPlainRecord(res)) return;
              const resPrefix = `${dPrefix}.resource[${resIdx}]`;
              lines.push(`* ${resPrefix}.meaning = #${String(res.meaning)}`);
              if (isPlainRecord(res.reference)) {
                emitReference(`${resPrefix}.reference`, res.reference);
              }
            });
          }
        });
      }
      if (Array.isArray(r.activity)) {
        r.activity.forEach((act: unknown, actIdx: number) => {
          if (!isPlainRecord(act)) return;
          const actPrefix = `${rPrefix}.activity[${actIdx}]`;
          if (Array.isArray(act.actor)) {
            act.actor.forEach((actorRef: unknown, aIdx: number) => {
              if (isPlainRecord(actorRef)) emitReference(`${actPrefix}.actor[${aIdx}]`, actorRef);
            });
          }
          if (Array.isArray(act.action)) {
            act.action.forEach((actionCc: unknown, aIdx: number) => {
              if (isPlainRecord(actionCc)) emitCodeableConcept(`${actPrefix}.action[${aIdx}]`, actionCc);
            });
          }
          if (Array.isArray(act.purpose)) {
            act.purpose.forEach((purposeCc: unknown, pIdx: number) => {
              if (isPlainRecord(purposeCc)) emitCodeableConcept(`${actPrefix}.purpose[${pIdx}]`, purposeCc);
            });
          }
        });
      }
      if (Array.isArray(r.limit)) {
        r.limit.forEach((limCc: unknown, lIdx: number) => {
          if (isPlainRecord(limCc)) emitCodeableConcept(`${rPrefix}.limit[${lIdx}]`, limCc);
        });
      }
    });
  }

  return `${lines.join("\n")}\n`;
}
