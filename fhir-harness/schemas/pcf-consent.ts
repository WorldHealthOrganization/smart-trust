/**
 * IHE Privacy Consent on FHIR (PCF 1.1.0) → W3C ODRL 2.2 policy translation
 * and three-valued access-control decision engine (`permit` | `deny` | `unknown`).
 *
 * Owner decision, 2026-10-30 (bean `jx7m`, issue #2702): IHE PCF 1.1.0 (Trial
 * Implementation) and FHIR R4 `Consent` (Trial Use) approved; no IUA claim;
 * profiles referenced by canonical URL only; Basic consent + Additional
 * `PurposeOfUse` first, plus the four IHE PCF Volume 1 §1:53.2.1 implicit
 * overarching policies as ODRL 2.2 `Set` policies.
 *
 * Follow-up bean `folio-assistant-6jnx`:
 * - Single PCF Consent evaluator in `fhir-harness`; `cat-harness` `odrl:obtainConsent`
 *   duty receives a plain verdict (`permit` | `deny` | `unknown`, plus citation)
 *   from an injected {@link createPcfConsentEvaluator} callback.
 * - `HL7_PURPOSE_OF_USE` is loaded at runtime from the published
 *   `hl7.terminology.r4#5.3.0` `CodeSystem-v3-ActReason.json` (no hand-typed hierarchy).
 * - `FhirConsentSchema`, `FhirSearchsetBundleSchema`, `FhirOperationOutcomeSchema`,
 *   and their bound code lists are built from `hl7.fhir.r4.core#4.0.1`
 *   `StructureDefinition-*.json` and `CodeSystem-*.json` (no hand-written
 *   `FhirConsent` / `Bundle` interfaces or Zod shapes).
 * - `isConsentExpired` is defined once here and imported by `iti-108-consent-client.ts`.
 *
 * @module fhir-harness/schemas/pcf-consent
 * @graphNode schema
 * @conformsTo hl7-fhir
 * @conformsTo w3c-odrl
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { inputSiteReached } from "../../cat-harness-tools/schemas/sdlc/input-trace.ts";
import type * as fhir4 from "fhir/r4";
import { z } from "zod";
import {
  ANYONE,
  FOLIO_DEFAULT_CONFLICT,
  HL7_ACT_REASON_SYSTEM,
  ODRL_ACTIONS,
  ODRL_NS,
  actionGraph,
  broaderOrSelf,
  type ActionGraph,
  type Decision,
  type OdrlDuty,
  type OdrlPolicy,
  type OdrlRule,
  type PermitRequest,
  parseDurationMs,
} from "@litlfred/cat-harness-tools/schemas/content/odrl.js";

export {
  ANYONE,
  FOLIO_DEFAULT_CONFLICT,
  HL7_ACT_REASON_SYSTEM,
  ODRL_ACTIONS,
  ODRL_NS,
  actionGraph,
  broaderOrSelf,
  type ActionGraph,
  type Decision,
};

export const HL7_TERMINOLOGY_PACKAGE_ID = "hl7.terminology.r4#5.3.0" as const;

export interface ConsentDecisionRef {
  id: string;
  versionId: string;
  uid?: string;
}

export interface ConsentEvaluation {
  verdict: Decision;
  consent?: ConsentDecisionRef;
}

export type ConsentEvaluator = (
  req: PermitRequest,
  duty?: OdrlDuty,
  rule?: OdrlRule,
  policy?: OdrlPolicy,
) => ConsentEvaluation | Decision;

interface ActReasonConceptNode {
  code?: string;
  property?: readonly { code?: string; valueCode?: string }[];
  concept?: readonly ActReasonConceptNode[];
}

export function loadHl7PurposeOfUseFromActReason(
  path: string,
): Readonly<Record<string, readonly string[]>> {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as {
    concept?: readonly ActReasonConceptNode[];
  };
  const rawParents = new Map<string, string[]>();
  const walk = (nodes: readonly ActReasonConceptNode[] | undefined, structuralParent?: string): void => {
    for (const node of nodes ?? []) {
      const code = node.code;
      if (!code) continue;
      const parents = rawParents.get(code) ?? [];
      if (structuralParent && !parents.includes(structuralParent)) parents.push(structuralParent);
      for (const prop of node.property ?? []) {
        if (prop.code === "subsumedBy" && typeof prop.valueCode === "string" && !parents.includes(prop.valueCode)) {
          parents.push(prop.valueCode);
        }
      }
      rawParents.set(code, parents);
      walk(node.concept, code);
    }
  };
  walk(raw.concept);

  const inPurposeOfUse = new Map<string, boolean>();
  const reachesPurposeOfUse = (code: string, visiting = new Set<string>()): boolean => {
    if (code === "PurposeOfUse") return true;
    const cached = inPurposeOfUse.get(code);
    if (cached !== undefined) return cached;
    if (visiting.has(code)) return false;
    visiting.add(code);
    const reaches = (rawParents.get(code) ?? []).some((p) => reachesPurposeOfUse(p, new Set(visiting)));
    inPurposeOfUse.set(code, reaches);
    return reaches;
  };

  const out: Record<string, readonly string[]> = { PurposeOfUse: [] };
  for (const [code, parents] of rawParents.entries()) {
    if (code !== "PurposeOfUse" && reachesPurposeOfUse(code)) {
      out[code] = Object.freeze(parents.filter((p) => p === "PurposeOfUse" || reachesPurposeOfUse(p)));
    }
  }
  return Object.freeze(out);
}

// ── Canonical URLs & CodeSystems (referenced by URL only) ──────────────

export const ODRL_CONTEXT_URL = "http://www.w3.org/ns/odrl.jsonld" as const;
export const PCF_IG_CANONICAL = "https://profiles.ihe.net/ITI/PCF" as const;
export const HL7_FHIR_R4_CORE_PACKAGE_ID = "hl7.fhir.r4.core#4.0.1" as const;
export const IHE_ITI_PCF_PACKAGE_ID = "ihe.iti.pcf#1.1.0" as const;

export const PCF_CONSENT_BASIC_PROFILE =
  "https://profiles.ihe.net/ITI/PCF/StructureDefinition/IHE.PCF.consentBasic" as const;
export const PCF_CONSENT_INTERMEDIATE_PROFILE =
  "https://profiles.ihe.net/ITI/PCF/StructureDefinition/IHE.PCF.consentIntermediate" as const;
export const PCF_CONSENT_ADVANCED_PROFILE =
  "https://profiles.ihe.net/ITI/PCF/StructureDefinition/IHE.PCF.consentAdvanced" as const;

export const PCF_CONSENT_PROFILES = [
  PCF_CONSENT_BASIC_PROFILE,
  PCF_CONSENT_INTERMEDIATE_PROFILE,
  PCF_CONSENT_ADVANCED_PROFILE,
] as const;
export type PcfConsentProfile = (typeof PCF_CONSENT_PROFILES)[number];

export const PCF_BASIC_PURPOSE_VS = "https://profiles.ihe.net/ITI/PCF/ValueSet/BasicPurposeVS" as const;
export const PCF_ADVANCED_SECURITY_TAG_VS =
  "https://profiles.ihe.net/ITI/PCF/ValueSet/AdvancedSecurityTagVS" as const;

export const HL7_CONFIDENTIALITY_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-Confidentiality" as const;
export const HL7_ACT_CODE_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-ActCode" as const;
export const HL7_PARTICIPATION_TYPE_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-ParticipationType" as const;
export const HL7_CONSENT_SCOPE_SYSTEM = "http://terminology.hl7.org/CodeSystem/consentscope" as const;
export const LOINC_SYSTEM = "http://loinc.org" as const;
export const LOINC_CONSENT_CODE = "59284-0" as const;

/**
 * The extensible `BasicPurposeVS` codes in IHE PCF 1.1.0: Treatment, Payment,
 * and Healthcare Operations (TPO).
 */
export const PCF_BASIC_PURPOSES = ["TREAT", "HPAYMT", "HOPERAT"] as const;
export type PcfBasicPurpose = (typeof PCF_BASIC_PURPOSES)[number];

// ── Published FHIR Package Resolution (`~/.fhir/packages` + `test/support/pcf`) ──

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPPORT_PCF_DIR = resolve(HERE, "..", "test", "support", "pcf");

/**
 * The file `relativePath` of the published package `packageId`: the vendored
 * copy under `test/support/pcf` when there is one (unmodified, its sha-256 in
 * `provenance.json`), else the FHIR package cache in `~/.fhir/packages`.
 *
 * The vendored copy comes first so that loading this module reads only the
 * tree: every file the module reads at load is vendored, and the bytes are the
 * same exact-version package either way. The cache is outside the tree, so
 * reaching it is a traced input site, and a run that reaches it is not cached.
 */
export function resolvePublishedFhirPackageFile(packageId: string, relativePath: string): string {
  const vendored = join(SUPPORT_PCF_DIR, packageId, relativePath);
  if (existsSync(vendored)) return vendored;
  // input-site: traced #062dde05 — the FHIR package cache outside the tree, read only for a file not vendored under test/support/pcf
  inputSiteReached("pcf-consent: ~/.fhir package cache");
  const cached = join(homedir(), ".fhir", "packages", packageId, "package", relativePath);
  if (existsSync(cached)) return cached;
  throw new Error(`Cannot locate ${relativePath} in published package ${packageId} (checked ${vendored}, ${cached})`);
}

/**
 * HL7 v3 `ActReason` `PurposeOfUse` hierarchy (`subsumedBy` parent links),
 * loaded directly from `hl7.terminology.r4#5.3.0/CodeSystem-v3-ActReason.json`
 * (bean `folio-assistant-6jnx`).
 */
export const HL7_PURPOSE_OF_USE: Readonly<Record<string, readonly string[]>> = loadHl7PurposeOfUseFromActReason(
  resolvePublishedFhirPackageFile(HL7_TERMINOLOGY_PACKAGE_ID, "CodeSystem-v3-ActReason.json"),
);

const PURPOSE_GRAPH: ReadonlyMap<string, readonly string[]> = new Map(Object.entries(HL7_PURPOSE_OF_USE));

/** Normalize an HL7 PurposeOfUse code (stripping optional CodeSystem IRI or prefix). */
export function normalizePurposeCode(code: string): string {
  if (code.startsWith(`${HL7_ACT_REASON_SYSTEM}#`) || code.startsWith(`${HL7_ACT_REASON_SYSTEM}/`)) {
    return code.slice(HL7_ACT_REASON_SYSTEM.length + 1);
  }
  if (code.startsWith("v3-ActReason:") || code.startsWith("hl7:")) {
    return code.slice(code.indexOf(":") + 1);
  }
  return code;
}

/** Whether `code` is in the HL7 v3 `ActReason` `PurposeOfUse` hierarchy. */
export function isKnownHl7PurposeOfUse(code: string): boolean {
  if (code.startsWith("dpv:") || code.includes("/dpv")) return false;
  return PURPOSE_GRAPH.has(normalizePurposeCode(code));
}

// ── Published R4 StructureDefinition & CodeSystem Schema Builder ────────

interface R4ConceptNode {
  code?: string;
  concept?: readonly R4ConceptNode[];
}

export function loadR4CodeSystemCodes(filename: string): readonly [string, ...string[]] {
  const raw = JSON.parse(
    readFileSync(resolvePublishedFhirPackageFile(HL7_FHIR_R4_CORE_PACKAGE_ID, filename), "utf-8"),
  ) as { concept?: readonly R4ConceptNode[] };
  const codes: string[] = [];
  const walk = (nodes: readonly R4ConceptNode[] | undefined): void => {
    for (const n of nodes ?? []) {
      if (typeof n.code === "string" && n.code.length > 0 && !codes.includes(n.code)) {
        codes.push(n.code);
      }
      walk(n.concept);
    }
  };
  walk(raw.concept);
  if (codes.length === 0) {
    throw new Error(`No codes found in ${HL7_FHIR_R4_CORE_PACKAGE_ID}/${filename}`);
  }
  return codes as [string, ...string[]];
}

export const CONSENT_STATE_CODES = loadR4CodeSystemCodes("CodeSystem-consent-state-codes.json");
export const CONSENT_PROVISION_TYPE_CODES = loadR4CodeSystemCodes("CodeSystem-consent-provision-type.json");
export const CONSENT_DATA_MEANING_CODES = loadR4CodeSystemCodes("CodeSystem-consent-data-meaning.json");
export const SEARCH_ENTRY_MODE_CODES = loadR4CodeSystemCodes("CodeSystem-search-entry-mode.json");
export const ISSUE_SEVERITY_CODES = loadR4CodeSystemCodes("CodeSystem-issue-severity.json");
export const ISSUE_TYPE_CODES = loadR4CodeSystemCodes("CodeSystem-issue-type.json");

export const FhirConsentStatusSchema = z.enum(CONSENT_STATE_CODES);
export type FhirConsentStatus = z.infer<typeof FhirConsentStatusSchema>;

export const FhirConsentProvisionTypeSchema = z.enum(CONSENT_PROVISION_TYPE_CODES);
export type FhirConsentProvisionType = z.infer<typeof FhirConsentProvisionTypeSchema>;

export const FhirConsentDataMeaningSchema = z.enum(CONSENT_DATA_MEANING_CODES);
export type FhirConsentDataMeaning = z.infer<typeof FhirConsentDataMeaningSchema>;

const VALUE_SET_REQUIRED_CODES: Readonly<Record<string, ReadonlySet<string>>> = {
  "http://hl7.org/fhir/ValueSet/consent-state-codes": new Set(CONSENT_STATE_CODES),
  "http://hl7.org/fhir/ValueSet/consent-provision-type": new Set(CONSENT_PROVISION_TYPE_CODES),
  "http://hl7.org/fhir/ValueSet/consent-data-meaning": new Set(CONSENT_DATA_MEANING_CODES),
  "http://hl7.org/fhir/ValueSet/search-entry-mode": new Set(SEARCH_ENTRY_MODE_CODES),
  "http://hl7.org/fhir/ValueSet/issue-severity": new Set(ISSUE_SEVERITY_CODES),
  "http://hl7.org/fhir/ValueSet/issue-type": new Set(ISSUE_TYPE_CODES),
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

function validateDatatypeValue(
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
      for (const k of ["system", "version", "code", "display"] as const) {
        if (value[k] !== undefined && (typeof value[k] !== "string" || (k !== "display" && value[k].trim().length === 0))) {
          ctx.addIssue({ code: "custom", path: [...issuePath, k], message: `Invalid Coding.${k}` });
        }
      }
      return;
    }
    case "CodeableConcept": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR CodeableConcept object" });
        return;
      }
      if (value.coding !== undefined) {
        if (!Array.isArray(value.coding)) {
          ctx.addIssue({ code: "custom", path: [...issuePath, "coding"], message: "Expected Coding[] array" });
        } else {
          value.coding.forEach((c: unknown, i: number) =>
            validateDatatypeValue(c, "Coding", [...issuePath, "coding", i], ctx),
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
      for (const k of ["use", "system", "value"] as const) {
        if (value[k] !== undefined && typeof value[k] !== "string") {
          ctx.addIssue({ code: "custom", path: [...issuePath, k], message: `Invalid Identifier.${k}` });
        }
      }
      return;
    }
    case "Reference": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Reference object" });
        return;
      }
      for (const k of ["reference", "type", "display"] as const) {
        if (value[k] !== undefined && (typeof value[k] !== "string" || (k !== "display" && value[k].trim().length === 0))) {
          ctx.addIssue({ code: "custom", path: [...issuePath, k], message: `Invalid Reference.${k}` });
        }
      }
      if (value.identifier !== undefined) {
        validateDatatypeValue(value.identifier, "Identifier", [...issuePath, "identifier"], ctx);
      }
      return;
    }
    case "Period": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Period object" });
        return;
      }
      for (const k of ["start", "end"] as const) {
        if (value[k] !== undefined && (typeof value[k] !== "string" || value[k].trim().length === 0)) {
          ctx.addIssue({ code: "custom", path: [...issuePath, k], message: `Invalid Period.${k}` });
        }
      }
      return;
    }
    case "Meta": {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: "Expected FHIR Meta object" });
        return;
      }
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
    default: {
      if (!isPlainRecord(value)) {
        ctx.addIssue({ code: "custom", path: issuePath, message: `Expected FHIR ${normType} object` });
      }
    }
  }
}

export function buildSchemaFromR4StructureDefinition<T = Record<string, unknown>>(
  sdFilename: string,
  options: { optionalPaths?: readonly string[] } = {},
): z.ZodType<T> {
  const sd = JSON.parse(
    readFileSync(resolvePublishedFhirPackageFile(HL7_FHIR_R4_CORE_PACKAGE_ID, sdFilename), "utf-8"),
  ) as StructureDefinitionJson;
  const optionalOverride = new Set(options.optionalPaths ?? []);
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
      const effectiveMin = optionalOverride.has(child.path) ? 0 : child.min;
      if (effectiveMin < 1) continue;
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
          ? VALUE_SET_REQUIRED_CODES[el.binding.valueSet.split("|")[0]!]
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
        validateDatatypeValue(item, chosenType, itemIssuePath, ctx);
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

  return z.unknown().superRefine((val, ctx) => {
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
  }) as unknown as z.ZodType<T>;
}

// The static types of the schemas below are the published FHIR R4 types from
// `@types/fhir` (`fhir/r4`, generated from the HL7 R4 StructureDefinitions);
// validation stays with the StructureDefinition-built schemas above.

export type FhirCoding = fhir4.Coding;
export type FhirCodeableConcept = fhir4.CodeableConcept;
export type FhirIdentifier = fhir4.Identifier;
export type FhirReference = fhir4.Reference;
export type FhirPeriod = fhir4.Period;
export type FhirConsentMeta = fhir4.Meta;
export type FhirConsentProvision = PcfRelaxedConsentProvision;
export type FhirConsentActor = WithOptional<fhir4.ConsentProvisionActor, "role">;
export type FhirConsentData = fhir4.ConsentProvisionData;
export type FhirConsentPolicy = fhir4.ConsentPolicy;
export type FhirBundleLink = fhir4.BundleLink;
export type FhirBundleEntry = fhir4.BundleEntry;

function buildDatatypeSchema<T>(typeCode: string): z.ZodType<T> {
  return z.unknown().superRefine((val, ctx) => {
    validateDatatypeValue(val, typeCode, [], ctx);
  }) as unknown as z.ZodType<T>;
}

export const FhirCodingSchema = buildDatatypeSchema<fhir4.Coding>("Coding");
export const FhirCodeableConceptSchema = buildDatatypeSchema<fhir4.CodeableConcept>("CodeableConcept");
export const FhirIdentifierSchema = buildDatatypeSchema<fhir4.Identifier>("Identifier");
export const FhirReferenceSchema = buildDatatypeSchema<fhir4.Reference>("Reference");
export const FhirPeriodSchema = buildDatatypeSchema<fhir4.Period>("Period");
export const FhirConsentMetaSchema = buildDatatypeSchema<fhir4.Meta>("Meta");

/** `T` with the elements `K` made optional — how an `optionalPaths` override relaxes an R4 type. */
type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** R4 `Consent.provision` with `actor.role` optional, as `FhirConsentSchema`'s `optionalPaths` accept it. */
type PcfRelaxedConsentProvision = Omit<fhir4.ConsentProvision, "actor" | "provision"> & {
  actor?: WithOptional<fhir4.ConsentProvisionActor, "role">[];
  provision?: PcfRelaxedConsentProvision[];
};

/** R4 `Consent` with `scope`, `category` and `provision.actor.role` optional (the `optionalPaths` below). */
type PcfRelaxedConsent = Omit<WithOptional<fhir4.Consent, "scope" | "category">, "provision"> & {
  provision?: PcfRelaxedConsentProvision;
};

export const FhirConsentSchema = buildSchemaFromR4StructureDefinition<PcfRelaxedConsent>("StructureDefinition-Consent.json", {
  optionalPaths: ["Consent.scope", "Consent.category", "Consent.provision.actor.role"],
});
export const FhirStrictConsentSchema = buildSchemaFromR4StructureDefinition<fhir4.Consent>("StructureDefinition-Consent.json");
export type FhirConsent = z.infer<typeof FhirConsentSchema>;

export const FhirSearchsetBundleSchema = buildSchemaFromR4StructureDefinition<fhir4.Bundle>(
  "StructureDefinition-Bundle.json",
);
export type FhirSearchsetBundle = z.infer<typeof FhirSearchsetBundleSchema>;

export const FhirOperationOutcomeSchema = buildSchemaFromR4StructureDefinition<fhir4.OperationOutcome>(
  "StructureDefinition-OperationOutcome.json",
);
export type FhirOperationOutcome = z.infer<typeof FhirOperationOutcomeSchema>;

// ── ODRL Set types produced by consentToOdrl() ─────────────────────────

export type PcfLeftOperand =
  | "cat-harness:process"
  | "cat-harness:task"
  | "cat-harness:role"
  | "odrl:purpose"
  | "odrl:dateTime"
  | "odrl:elapsedTime"
  | "purpose"
  | "dateTime"
  | "elapsedTime"
  | "pcf:securityLabel"
  | "pcf:dataPeriod"
  | "pcf:author"
  | "pcf:encounter";

export type PcfOperator =
  | "odrl:eq"
  | "odrl:neq"
  | "odrl:isAnyOf"
  | "odrl:isNoneOf"
  | "odrl:lt"
  | "odrl:lteq"
  | "odrl:gt"
  | "odrl:gteq"
  | "odrl:isA"
  | "eq"
  | "neq"
  | "isAnyOf"
  | "isNoneOf"
  | "lt"
  | "lteq"
  | "gt"
  | "gteq"
  | "isA";

export interface PcfOdrlConstraint {
  leftOperand: PcfLeftOperand;
  operator: PcfOperator;
  rightOperand: string | readonly string[];
}

export interface PcfOdrlRule {
  assignee: string;
  action: string;
  target?: string;
  constraint?: PcfOdrlConstraint[];
}

export interface PcfOdrlSet {
  "@context": string | readonly unknown[] | Record<string, unknown>;
  "@type": "Set";
  uid: string;
  profile: string;
  inheritFrom?: string[];
  conflict?: "odrl:perm" | "odrl:prohibit" | "odrl:invalid";
  assigner?: string;
  assignee?: string;
  permission: PcfOdrlRule[];
  prohibition: PcfOdrlRule[];
}

// ── Four IHE PCF 1.1.0 Volume 1 §1:53.2.1 Implicit-Policy ODRL Sets ────

export const PCF_POLICY_BASIC_NORMAL_URI = "https://profiles.ihe.net/ITI/PCF/Policy-basic-normal" as const;
export const PCF_POLICY_ALL_NORMAL_URI = "https://profiles.ihe.net/ITI/PCF/Policy-all-normal" as const;
export const PCF_POLICY_BREAK_GLASS_ONLY_URI = "https://profiles.ihe.net/ITI/PCF/Policy-break-glass-only" as const;
export const PCF_POLICY_DENY_URI = "https://profiles.ihe.net/ITI/PCF/Policy-deny" as const;

export const PCF_IMPLICIT_POLICY_URIS = [
  PCF_POLICY_BASIC_NORMAL_URI,
  PCF_POLICY_ALL_NORMAL_URI,
  PCF_POLICY_BREAK_GLASS_ONLY_URI,
  PCF_POLICY_DENY_URI,
] as const;
export type PcfImplicitPolicyUri = (typeof PCF_IMPLICIT_POLICY_URIS)[number];

/**
 * 1. `https://profiles.ihe.net/ITI/PCF/Policy-basic-normal` (IHE PCF Vol 1
 *    §1:53.2.1 & §1:53.4.2.4.1 *Permit Clinical Treatment*):
 *    "Permit for clinicians that have authorization for Treatment use, but
 *    does not authorize other access."
 */
export const PCF_IMPLICIT_BASIC_NORMAL_SET: PcfOdrlSet = {
  "@context": ODRL_CONTEXT_URL,
  "@type": "Set",
  uid: PCF_POLICY_BASIC_NORMAL_URI,
  profile: PCF_IG_CANONICAL,
  conflict: "odrl:prohibit",
  permission: [
    {
      assignee: ANYONE,
      action: "odrl:use",
      constraint: [
        {
          leftOperand: "odrl:purpose",
          operator: "odrl:isA",
          rightOperand: "TREAT",
        },
      ],
    },
  ],
  prohibition: [],
};

/**
 * 2. `https://profiles.ihe.net/ITI/PCF/Policy-all-normal` (IHE PCF Vol 1
 *    §1:53.2.1 & §1:53.4.2.4.2 *Permit All Authorized*, opt-out baseline):
 *    "Permit for all authorized uses. This presumes that basic user access
 *    control will only allow authorized users and purposes of use."
 */
export const PCF_IMPLICIT_ALL_NORMAL_SET: PcfOdrlSet = {
  "@context": ODRL_CONTEXT_URL,
  "@type": "Set",
  uid: PCF_POLICY_ALL_NORMAL_URI,
  profile: PCF_IG_CANONICAL,
  conflict: "odrl:prohibit",
  permission: [
    {
      assignee: ANYONE,
      action: "odrl:use",
      constraint: [
        {
          leftOperand: "odrl:purpose",
          operator: "odrl:isA",
          rightOperand: "PurposeOfUse",
        },
      ],
    },
  ],
  prohibition: [],
};

/**
 * 3. `https://profiles.ihe.net/ITI/PCF/Policy-break-glass-only` (IHE PCF Vol 1
 *    §1:53.2.1 *Break-Glass Only*):
 *    "Deny for all use, except when the user is a clinician with authorization
 *    to declare a medical patient-safety override (a.k.a. Break-Glass)."
 */
export const PCF_IMPLICIT_BREAK_GLASS_ONLY_SET: PcfOdrlSet = {
  "@context": ODRL_CONTEXT_URL,
  "@type": "Set",
  uid: PCF_POLICY_BREAK_GLASS_ONLY_URI,
  profile: PCF_IG_CANONICAL,
  conflict: "odrl:prohibit",
  permission: [
    {
      assignee: ANYONE,
      action: "odrl:use",
      constraint: [
        {
          leftOperand: "odrl:purpose",
          operator: "odrl:isA",
          rightOperand: "BTG",
        },
      ],
    },
  ],
  prohibition: [
    {
      assignee: ANYONE,
      action: "odrl:use",
      constraint: [
        {
          leftOperand: "odrl:purpose",
          operator: "odrl:isNoneOf",
          rightOperand: ["BTG"],
        },
      ],
    },
  ],
};

/**
 * 4. `https://profiles.ihe.net/ITI/PCF/Policy-deny` (IHE PCF Vol 1 §1:53.2.1 &
 *    §1:53.4.2.4.3 *Deny All*, opt-in baseline):
 *    "Deny all."
 */
export const PCF_IMPLICIT_DENY_SET: PcfOdrlSet = {
  "@context": ODRL_CONTEXT_URL,
  "@type": "Set",
  uid: PCF_POLICY_DENY_URI,
  profile: PCF_IG_CANONICAL,
  conflict: "odrl:prohibit",
  permission: [],
  prohibition: [
    {
      assignee: ANYONE,
      action: "odrl:use",
    },
  ],
};

/**
 * All four IHE PCF Volume 1 §1:53.2.1 implicit-policy ODRL `Set`s, keyed by
 * their canonical URI.
 */
export const PCF_IMPLICIT_POLICY_SETS: Readonly<Record<PcfImplicitPolicyUri, PcfOdrlSet>> = {
  [PCF_POLICY_BASIC_NORMAL_URI]: PCF_IMPLICIT_BASIC_NORMAL_SET,
  [PCF_POLICY_ALL_NORMAL_URI]: PCF_IMPLICIT_ALL_NORMAL_SET,
  [PCF_POLICY_BREAK_GLASS_ONLY_URI]: PCF_IMPLICIT_BREAK_GLASS_ONLY_SET,
  [PCF_POLICY_DENY_URI]: PCF_IMPLICIT_DENY_SET,
};

export type PcfImplicitPolicyAlias =
  | PcfImplicitPolicyUri
  | "basic-normal"
  | "all-normal"
  | "break-glass-only"
  | "deny"
  | "opt-in"
  | "opt-out";

/** Resolve one of the four IHE PCF implicit-policy `Set`s by canonical URI or short alias. */
export function getImplicitPolicySet(uriOrAlias: string): PcfOdrlSet | undefined {
  switch (uriOrAlias) {
    case PCF_POLICY_BASIC_NORMAL_URI:
    case "basic-normal":
    case "Policy-basic-normal":
      return PCF_IMPLICIT_BASIC_NORMAL_SET;
    case PCF_POLICY_ALL_NORMAL_URI:
    case "all-normal":
    case "Policy-all-normal":
    case "opt-out":
      return PCF_IMPLICIT_ALL_NORMAL_SET;
    case PCF_POLICY_BREAK_GLASS_ONLY_URI:
    case "break-glass-only":
    case "Policy-break-glass-only":
      return PCF_IMPLICIT_BREAK_GLASS_ONLY_SET;
    case PCF_POLICY_DENY_URI:
    case "deny":
    case "Policy-deny":
    case "opt-in":
      return PCF_IMPLICIT_DENY_SET;
    default:
      return undefined;
  }
}

export interface ConsentCitation {
  id: string;
  versionId?: string;
  uid: string;
  status: FhirConsentStatus;
  patient?: string;
  performer?: string;
  policyUris: string[];
}

export interface ConsentToOdrlOptions {
  /** ODRL profile URI written into `Set.profile` (default: {@link PCF_IG_CANONICAL}). */
  profile?: string;
  /** Prefix for minted policy `uid`s (default: `"urn:ihe:pcf:consent:"`). */
  uidPrefix?: string;
  /** Default ODRL action when `provision.action` is omitted (default: `"odrl:use"`). */
  defaultAction?: string;
}

const DEFAULT_UID_PREFIX = "urn:ihe:pcf:consent:";

/** Mint a deterministic ODRL `uid` citing `Consent.id` and `Consent.meta.versionId`. */
export function consentPolicyUid(consent: FhirConsent, uidPrefix = DEFAULT_UID_PREFIX): string {
  const id = consent.id?.trim() || "anonymous";
  const versionId = consent.meta?.versionId?.trim();
  return versionId ? `${uidPrefix}${id}:v${versionId}` : `${uidPrefix}${id}`;
}

/** Extract provenance citation metadata (`Consent.id`, `meta.versionId`, `uid`, `patient`, `policy.uri`) from a FHIR `Consent`. */
export function extractConsentCitation(
  consent: FhirConsent,
  uidPrefix = DEFAULT_UID_PREFIX,
): ConsentCitation {
  const id = consent.id?.trim() || "anonymous";
  const versionId = consent.meta?.versionId?.trim();
  const uid = consentPolicyUid(consent, uidPrefix);
  const patient = referenceId(consent.patient);
  const performer = referenceId(consent.performer?.[0]);
  const policyUris: string[] = [];
  for (const p of consent.policy ?? []) {
    if (p.uri) policyUris.push(p.uri);
  }
  for (const c of consent.policyRule?.coding ?? []) {
    if (c.code) policyUris.push(c.system ? `${c.system}#${c.code}` : c.code);
  }
  return {
    id,
    ...(versionId ? { versionId } : {}),
    uid,
    status: consent.status,
    ...(patient ? { patient } : {}),
    ...(performer ? { performer } : {}),
    policyUris,
  };
}

/** Detect which IHE PCF 1.1.0 Consent profile (`Basic`, `Intermediate`, `Advanced`) a FHIR `Consent` uses or conforms to. */
export function detectPcfProfile(consent: FhirConsent): PcfConsentProfile {
  const declared = consent.meta?.profile ?? [];
  if (declared.includes(PCF_CONSENT_ADVANCED_PROFILE)) return PCF_CONSENT_ADVANCED_PROFILE;
  if (declared.includes(PCF_CONSENT_INTERMEDIATE_PROFILE)) return PCF_CONSENT_INTERMEDIATE_PROFILE;
  if (declared.includes(PCF_CONSENT_BASIC_PROFILE)) return PCF_CONSENT_BASIC_PROFILE;

  const prov = consent.provision;
  if (!prov) return PCF_CONSENT_BASIC_PROFILE;

  const allProvisions: FhirConsentProvision[] = [prov, ...(prov.provision ?? [])];
  if (allProvisions.some((p) => (p.securityLabel?.length ?? 0) > 0)) {
    return PCF_CONSENT_ADVANCED_PROFILE;
  }
  if (
    (prov.provision?.length ?? 0) > 0 ||
    allProvisions.some(
      (p) =>
        p.dataPeriod !== undefined ||
        (p.data?.length ?? 0) > 0 ||
        (p.purpose ?? []).some((coding: FhirCoding) => coding.code && !isKnownHl7PurposeOfUse(coding.code)),
    )
  ) {
    return PCF_CONSENT_INTERMEDIATE_PROFILE;
  }
  return PCF_CONSENT_BASIC_PROFILE;
}

function referenceId(ref: FhirReference | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref.reference && ref.reference.trim().length > 0) return ref.reference.trim();
  if (ref.identifier?.value && ref.identifier.value.trim().length > 0) {
    return ref.identifier.system
      ? `${ref.identifier.system}|${ref.identifier.value.trim()}`
      : ref.identifier.value.trim();
  }
  return undefined;
}

function mapFhirActionToOdrl(concept: FhirCodeableConcept): string {
  const code = concept.coding?.[0]?.code?.toLowerCase();
  switch (code) {
    case "read":
      return "odrl:display";
    case "correct":
      return "odrl:modify";
    case "access":
    case "collect":
    case "use":
    case "disclose":
    default:
      return "odrl:use";
  }
}

interface EffectiveProvisionContext {
  type: "permit" | "deny";
  period?: FhirPeriod;
  actor?: readonly FhirConsentActor[];
  action?: readonly FhirCodeableConcept[];
  securityLabel?: readonly FhirCoding[];
  purpose?: readonly FhirCoding[];
  dataPeriod?: FhirPeriod;
  data?: readonly FhirConsentData[];
}

function purposeConstraintForCoding(coding: FhirCoding): PcfOdrlConstraint | undefined {
  const rawCode = coding.code?.trim();
  if (!rawCode) return undefined;
  const isHl7System = !coding.system || coding.system === HL7_ACT_REASON_SYSTEM;
  if (isHl7System && isKnownHl7PurposeOfUse(rawCode)) {
    return {
      leftOperand: "odrl:purpose",
      operator: "odrl:isA",
      rightOperand: normalizePurposeCode(rawCode),
    };
  }
  return {
    leftOperand: "odrl:purpose",
    operator: "odrl:eq",
    rightOperand: rawCode,
  };
}

function expandProvisionToRules(
  prov: EffectiveProvisionContext,
  defaultAction: string,
): PcfOdrlRule[] {
  const assignees = (prov.actor ?? [])
    .map((a) => referenceId(a.reference))
    .filter((a): a is string => Boolean(a));
  const effectiveAssignees = assignees.length > 0 ? assignees : [ANYONE];

  const actions = (prov.action ?? []).map(mapFhirActionToOdrl);
  const effectiveActions = actions.length > 0 ? Array.from(new Set(actions)) : [defaultAction];

  const dataEntries = prov.data ?? [];
  const instanceTargets = dataEntries
    .filter((d) => d.meaning === "instance" || d.meaning === "dependents")
    .map((d) => referenceId(d.reference))
    .filter((r): r is string => Boolean(r));
  const effectiveTargets: readonly (string | undefined)[] =
    instanceTargets.length > 0 ? instanceTargets : [undefined];

  const authors = dataEntries
    .filter((d) => d.meaning === "authoredby")
    .map((d) => referenceId(d.reference))
    .filter((r): r is string => Boolean(r));

  const encounters = dataEntries
    .filter((d) => d.meaning === "related")
    .map((d) => referenceId(d.reference))
    .filter((r): r is string => Boolean(r));

  const sharedConstraints: PcfOdrlConstraint[] = [];

  if (prov.period?.start) {
    sharedConstraints.push({
      leftOperand: "odrl:dateTime",
      operator: "odrl:gteq",
      rightOperand: prov.period.start,
    });
  }
  if (prov.period?.end) {
    sharedConstraints.push({
      leftOperand: "odrl:dateTime",
      operator: "odrl:lteq",
      rightOperand: prov.period.end,
    });
  }

  if (prov.dataPeriod?.start) {
    sharedConstraints.push({
      leftOperand: "pcf:dataPeriod",
      operator: "odrl:gteq",
      rightOperand: prov.dataPeriod.start,
    });
  }
  if (prov.dataPeriod?.end) {
    sharedConstraints.push({
      leftOperand: "pcf:dataPeriod",
      operator: "odrl:lteq",
      rightOperand: prov.dataPeriod.end,
    });
  }

  const securityCodes = (prov.securityLabel ?? [])
    .map((s) => s.code?.trim())
    .filter((c): c is string => Boolean(c));
  if (securityCodes.length === 1) {
    sharedConstraints.push({
      leftOperand: "pcf:securityLabel",
      operator: "odrl:eq",
      rightOperand: securityCodes[0]!,
    });
  } else if (securityCodes.length > 1) {
    sharedConstraints.push({
      leftOperand: "pcf:securityLabel",
      operator: "odrl:isAnyOf",
      rightOperand: securityCodes,
    });
  }

  if (authors.length === 1) {
    sharedConstraints.push({
      leftOperand: "pcf:author",
      operator: "odrl:eq",
      rightOperand: authors[0]!,
    });
  } else if (authors.length > 1) {
    sharedConstraints.push({
      leftOperand: "pcf:author",
      operator: "odrl:isAnyOf",
      rightOperand: authors,
    });
  }

  if (encounters.length === 1) {
    sharedConstraints.push({
      leftOperand: "pcf:encounter",
      operator: "odrl:eq",
      rightOperand: encounters[0]!,
    });
  } else if (encounters.length > 1) {
    sharedConstraints.push({
      leftOperand: "pcf:encounter",
      operator: "odrl:isAnyOf",
      rightOperand: encounters,
    });
  }

  const purposeConstraints = (prov.purpose ?? [])
    .map(purposeConstraintForCoding)
    .filter((c): c is PcfOdrlConstraint => c !== undefined);

  const effectivePurposes: readonly (PcfOdrlConstraint | undefined)[] =
    purposeConstraints.length > 0 ? purposeConstraints : [undefined];

  const rules: PcfOdrlRule[] = [];
  for (const assignee of effectiveAssignees) {
    for (const action of effectiveActions) {
      for (const target of effectiveTargets) {
        for (const purposeConstraint of effectivePurposes) {
          const constraints: PcfOdrlConstraint[] = [
            ...(purposeConstraint ? [purposeConstraint] : []),
            ...sharedConstraints,
          ];
          rules.push({
            assignee,
            action,
            ...(target !== undefined ? { target } : {}),
            ...(constraints.length > 0 ? { constraint: constraints } : {}),
          });
        }
      }
    }
  }
  return rules;
}

function mergePeriods(parent?: FhirPeriod, child?: FhirPeriod): FhirPeriod | undefined {
  if (!parent && !child) return undefined;
  const start = child?.start ?? parent?.start;
  const end = child?.end ?? parent?.end;
  return {
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  };
}

/**
 * Translate a FHIR R4 `Consent` (conforming to IHE PCF 1.1.0 Basic,
 * Intermediate, or Advanced) into a W3C ODRL 2.2 `Set` policy.
 */
export function consentToOdrl(consent: FhirConsent, options: ConsentToOdrlOptions = {}): PcfOdrlSet {
  if (!consent || consent.resourceType !== "Consent") {
    throw new Error("consentToOdrl expects a FHIR Consent resource (resourceType: 'Consent')");
  }
  const profile = options.profile ?? PCF_IG_CANONICAL;
  const uid = consentPolicyUid(consent, options.uidPrefix ?? DEFAULT_UID_PREFIX);
  const assigner = referenceId(consent.performer?.[0]) ?? referenceId(consent.patient);
  const defaultAction = options.defaultAction ?? "odrl:use";

  if (consent.status !== "active" || !consent.provision) {
    return {
      "@context": ODRL_CONTEXT_URL,
      "@type": "Set",
      uid,
      profile,
      conflict: FOLIO_DEFAULT_CONFLICT,
      ...(assigner ? { assigner } : {}),
      permission: [],
      prohibition: [],
    };
  }

  const root = consent.provision;
  const rootType: "permit" | "deny" = root.type ?? "permit";
  const permission: PcfOdrlRule[] = [];
  const prohibition: PcfOdrlRule[] = [];

  const rootRules = expandProvisionToRules(
    {
      type: rootType,
      period: root.period,
      actor: root.actor,
      action: root.action,
      securityLabel: root.securityLabel,
      purpose: root.purpose,
      dataPeriod: root.dataPeriod,
      data: root.data,
    },
    defaultAction,
  );
  if (rootType === "permit") {
    permission.push(...rootRules);
  } else {
    prohibition.push(...rootRules);
  }

  const visitChildren = (parent: EffectiveProvisionContext, children: readonly FhirConsentProvision[]) => {
    for (const child of children) {
      const childType: "permit" | "deny" = child.type ?? (parent.type === "permit" ? "deny" : "permit");
      const effectiveChild: EffectiveProvisionContext =
        childType === "permit"
          ? {
              type: "permit",
              period: mergePeriods(parent.period, child.period),
              actor: child.actor && child.actor.length > 0 ? child.actor : parent.actor,
              action: child.action && child.action.length > 0 ? child.action : parent.action,
              securityLabel:
                child.securityLabel && child.securityLabel.length > 0
                  ? child.securityLabel
                  : parent.type === "permit"
                    ? parent.securityLabel
                    : undefined,
              purpose:
                child.purpose && child.purpose.length > 0
                  ? child.purpose
                  : parent.type === "permit"
                    ? parent.purpose
                    : undefined,
              dataPeriod: child.dataPeriod ?? (parent.type === "permit" ? parent.dataPeriod : undefined),
              data: child.data && child.data.length > 0 ? child.data : parent.type === "permit" ? parent.data : undefined,
            }
          : {
              type: "deny",
              period: mergePeriods(parent.period, child.period),
              actor: child.actor,
              action: child.action,
              securityLabel: child.securityLabel,
              purpose: child.purpose,
              dataPeriod: child.dataPeriod,
              data: child.data,
            };

      const childRules = expandProvisionToRules(effectiveChild, defaultAction);
      if (childType === "permit") {
        permission.push(...childRules);
      } else {
        prohibition.push(...childRules);
      }

      if (child.provision && child.provision.length > 0) {
        visitChildren(effectiveChild, child.provision);
      }
    }
  };

  if (root.provision && root.provision.length > 0) {
    visitChildren(
      {
        type: rootType,
        period: root.period,
        actor: root.actor,
        action: root.action,
        securityLabel: root.securityLabel,
        purpose: root.purpose,
        dataPeriod: root.dataPeriod,
        data: root.data,
      },
      root.provision,
    );
  }

  const hasNestedPermitUnderDeny = rootType === "deny" && permission.length > 0;
  const conflict = hasNestedPermitUnderDeny ? "odrl:perm" : FOLIO_DEFAULT_CONFLICT;

  return {
    "@context": ODRL_CONTEXT_URL,
    "@type": "Set",
    uid,
    profile,
    conflict,
    ...(assigner ? { assigner } : {}),
    permission,
    prohibition,
  };
}

// ── Decision Evaluation (`decide()` & `isConsentExpired()`) ────────────

export interface PcfRequestScope {
  "cat-harness:process"?: string;
  "cat-harness:task"?: string;
  "cat-harness:role"?: string;
  "odrl:purpose"?: string;
  purpose?: string;
  "odrl:dateTime"?: string;
  dateTime?: string;
  "odrl:elapsedTime"?: string | number;
  elapsedTime?: string | number;
  target?: string;
  "pcf:securityLabel"?: string | readonly string[];
  securityLabel?: string | readonly string[];
  "pcf:dataPeriod"?: string;
  dataPeriod?: string;
  dataDateTime?: string;
  "pcf:author"?: string;
  author?: string;
  "pcf:encounter"?: string;
  encounter?: string;
}

export interface PcfDecisionRequest {
  /** Requesting actor (FHIR reference such as `"Practitioner/ex-practitioner"`, DID, actor id, or `null`). */
  actor?: string | null;
  /** Roles the actor holds (or group memberships). */
  actorRoles?: readonly string[];
  /** Groups or organizations the actor belongs to (e.g. `["Group/ex-privilegedUsers"]`). */
  actorGroups?: readonly string[];
  /** Requested ODRL action (defaults to `"odrl:use"`). */
  action?: string;
  /** Request context: `purpose`, `dateTime`, `target`, `securityLabel`, `dataPeriod`, `author`, `encounter`. */
  scope?: PcfRequestScope;
  /** Convenience shorthand: top-level `purpose` when `scope.purpose` is not passed. */
  purpose?: string;
  /** Convenience shorthand: top-level `dateTime` when `scope.dateTime` is not passed. */
  dateTime?: string;
  /** Convenience shorthand: top-level `target` when `scope.target` is not passed. */
  target?: string;
  /** Convenience shorthand: top-level `securityLabel` when `scope.securityLabel` is not passed. */
  securityLabel?: string | readonly string[];
  /** Convenience shorthand: top-level `dataPeriod` / `dataDateTime` when `scope.dataPeriod` is not passed. */
  dataPeriod?: string;
  /** Convenience shorthand: top-level `author` when `scope.author` is not passed. */
  author?: string;
  /** Convenience shorthand: top-level `encounter` when `scope.encounter` is not passed. */
  encounter?: string;
}

export interface PcfDecideOptions {
  /**
   * Overarching implicit policy (`Policy-basic-normal`, `Policy-all-normal`,
   * `Policy-break-glass-only`, `Policy-deny`, or a custom `PcfOdrlSet`) used
   * when no active Consent is on file or when the Consent has expired (IHE PCF
   * Volume 1 §1:53.2.1 & §1:53.4.2.5).
   */
  implicitPolicy?: PcfOdrlSet | PcfImplicitPolicyAlias | string;
  /** Custom ODRL action graph (defaults to `ODRL_ACTIONS`). */
  actionGraph?: ActionGraph;
}

/**
 * Parse a FHIR date / dateTime boundary into epoch milliseconds.
 *
 * For `bound === "end"`, date-only values (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`)
 * resolve to the end of that calendar unit in UTC; for `"start"` or `"point"`,
 * they resolve to the start of that unit in UTC. Full ISO-8601 dateTime strings
 * are parsed via `Date.parse`.
 */
export function parseFhirPeriodBound(
  raw: string,
  bound: "start" | "end" | "point" = "point",
): number {
  const s = raw.trim();
  if (/^\d{4}$/.test(s)) {
    const year = Number(s);
    return bound === "end"
      ? Date.UTC(year, 11, 31, 23, 59, 59, 999)
      : Date.UTC(year, 0, 1, 0, 0, 0, 0);
  }
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split("-").map(Number);
    if (m! < 1 || m! > 12) return Number.NaN;
    return bound === "end"
      ? Date.UTC(y!, m!, 0, 23, 59, 59, 999)
      : Date.UTC(y!, m! - 1, 1, 0, 0, 0, 0);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const probe = new Date(Date.UTC(y!, m! - 1, d!));
    if (
      probe.getUTCFullYear() !== y ||
      probe.getUTCMonth() !== m! - 1 ||
      probe.getUTCDate() !== d
    ) {
      return Number.NaN;
    }
    return bound === "end"
      ? Date.UTC(y!, m! - 1, d!, 23, 59, 59, 999)
      : Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0);
  }
  return Date.parse(s);
}

/**
 * Single canonical check in `fhir-harness` for whether a FHIR `Consent`'s root
 * `provision.period` is outside `atDateTime` (expired after `period.end` or
 * not yet in effect before `period.start`; bean `folio-assistant-6jnx`).
 */
export function isConsentExpired(consent: FhirConsent, atDateTime?: string | Date): boolean {
  const period = consent.provision?.period;
  if (!period || atDateTime === undefined) return false;
  const nowMs =
    atDateTime instanceof Date ? atDateTime.getTime() : parseFhirPeriodBound(atDateTime, "point");
  if (Number.isNaN(nowMs)) return false;
  if (period.start) {
    const startMs = parseFhirPeriodBound(period.start, "start");
    if (Number.isNaN(startMs) || nowMs < startMs) return true;
  }
  if (period.end) {
    const endMs = parseFhirPeriodBound(period.end, "end");
    if (Number.isNaN(endMs) || nowMs > endMs) return true;
  }
  return false;
}

function normalizeScope(req: PcfDecisionRequest): PcfRequestScope {
  const base = req.scope ?? {};
  return {
    ...base,
    ...(base.purpose === undefined && base["odrl:purpose"] === undefined && req.purpose !== undefined
      ? { purpose: req.purpose }
      : {}),
    ...(base.dateTime === undefined && base["odrl:dateTime"] === undefined && req.dateTime !== undefined
      ? { dateTime: req.dateTime }
      : {}),
    ...(base.target === undefined && req.target !== undefined ? { target: req.target } : {}),
    ...(base.securityLabel === undefined &&
    base["pcf:securityLabel"] === undefined &&
    req.securityLabel !== undefined
      ? { securityLabel: req.securityLabel }
      : {}),
    ...(base.dataPeriod === undefined &&
    base["pcf:dataPeriod"] === undefined &&
    base.dataDateTime === undefined &&
    req.dataPeriod !== undefined
      ? { dataPeriod: req.dataPeriod }
      : {}),
    ...(base.author === undefined && base["pcf:author"] === undefined && req.author !== undefined
      ? { author: req.author }
      : {}),
    ...(base.encounter === undefined && base["pcf:encounter"] === undefined && req.encounter !== undefined
      ? { encounter: req.encounter }
      : {}),
  };
}

function canonicalLeftOperand(op: PcfLeftOperand): string {
  if (op === "purpose" || op === "dateTime" || op === "elapsedTime") return `odrl:${op}`;
  return op;
}

function canonicalOperator(op: PcfOperator): string {
  return op.startsWith("odrl:") ? op : `odrl:${op}`;
}

function readScopeOperand(
  leftOperand: PcfLeftOperand,
  scope: PcfRequestScope,
): string | number | readonly string[] | undefined {
  switch (canonicalLeftOperand(leftOperand)) {
    case "odrl:purpose":
      return scope["odrl:purpose"] ?? scope.purpose;
    case "odrl:dateTime":
      return scope["odrl:dateTime"] ?? scope.dateTime;
    case "odrl:elapsedTime":
      return scope["odrl:elapsedTime"] ?? scope.elapsedTime;
    case "pcf:securityLabel":
      return scope["pcf:securityLabel"] ?? scope.securityLabel;
    case "pcf:dataPeriod":
      return scope["pcf:dataPeriod"] ?? scope.dataPeriod ?? scope.dataDateTime;
    case "pcf:author":
      return scope["pcf:author"] ?? scope.author;
    case "pcf:encounter":
      return scope["pcf:encounter"] ?? scope.encounter;
    case "cat-harness:process":
      return scope["cat-harness:process"];
    case "cat-harness:task":
      return scope["cat-harness:task"];
    case "cat-harness:role":
      return scope["cat-harness:role"];
    default:
      return undefined;
  }
}

function compareNum(lhs: number, rhs: number, op: string): boolean {
  switch (op) {
    case "odrl:eq":
      return lhs === rhs;
    case "odrl:neq":
      return lhs !== rhs;
    case "odrl:lt":
      return lhs < rhs;
    case "odrl:lteq":
      return lhs <= rhs;
    case "odrl:gt":
      return lhs > rhs;
    case "odrl:gteq":
      return lhs >= rhs;
    default:
      return false;
  }
}

function evaluateConstraint(c: PcfOdrlConstraint, scope: PcfRequestScope): boolean {
  const raw = readScopeOperand(c.leftOperand, scope);
  if (raw === undefined) return false;
  const left = canonicalLeftOperand(c.leftOperand);
  const op = canonicalOperator(c.operator);
  const rhs = c.rightOperand;

  if (left === "odrl:purpose") {
    const reqPurpose = normalizePurposeCode(String(raw));
    if (op === "odrl:isA") {
      if (typeof rhs !== "string") return false;
      const targetPurpose = normalizePurposeCode(rhs);
      if (isKnownHl7PurposeOfUse(reqPurpose) && isKnownHl7PurposeOfUse(targetPurpose)) {
        return broaderOrSelf(reqPurpose, PURPOSE_GRAPH).has(targetPurpose);
      }
      return reqPurpose === targetPurpose;
    }
    if (op === "odrl:eq") {
      return typeof rhs === "string" && reqPurpose === normalizePurposeCode(rhs);
    }
    if (op === "odrl:neq") {
      return typeof rhs === "string" && reqPurpose !== normalizePurposeCode(rhs);
    }
    if (op === "odrl:isAnyOf") {
      if (!Array.isArray(rhs)) return false;
      return rhs.some((code) => {
        const target = normalizePurposeCode(code);
        return isKnownHl7PurposeOfUse(reqPurpose) && isKnownHl7PurposeOfUse(target)
          ? broaderOrSelf(reqPurpose, PURPOSE_GRAPH).has(target)
          : reqPurpose === target;
      });
    }
    if (op === "odrl:isNoneOf") {
      if (!Array.isArray(rhs)) return false;
      return !rhs.some((code) => {
        const target = normalizePurposeCode(code);
        return isKnownHl7PurposeOfUse(reqPurpose) && isKnownHl7PurposeOfUse(target)
          ? broaderOrSelf(reqPurpose, PURPOSE_GRAPH).has(target)
          : reqPurpose === target;
      });
    }
    return false;
  }

  if (left === "odrl:dateTime" || left === "pcf:dataPeriod") {
    if (typeof rhs !== "string") return false;
    const lhsMs = parseFhirPeriodBound(String(raw), "point");
    const rhsMs = parseFhirPeriodBound(rhs, op === "odrl:lteq" ? "end" : "start");
    if (Number.isNaN(lhsMs) || Number.isNaN(rhsMs)) return false;
    return compareNum(lhsMs, rhsMs, op);
  }

  if (left === "pcf:securityLabel") {
    const reqTags = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    if (op === "odrl:eq") return typeof rhs === "string" && reqTags.includes(rhs);
    if (op === "odrl:neq") return typeof rhs === "string" && !reqTags.includes(rhs);
    if (op === "odrl:isAnyOf") return Array.isArray(rhs) && reqTags.some((t) => rhs.includes(t));
    if (op === "odrl:isNoneOf") return Array.isArray(rhs) && !reqTags.some((t) => rhs.includes(t));
    return false;
  }

  const v = String(raw);
  switch (op) {
    case "odrl:eq":
      return !Array.isArray(rhs) && v === rhs;
    case "odrl:neq":
      return !Array.isArray(rhs) && v !== rhs;
    case "odrl:isAnyOf":
      return Array.isArray(rhs) && rhs.includes(v);
    case "odrl:isNoneOf":
      return Array.isArray(rhs) && !rhs.includes(v);
    case "odrl:lt":
      return !Array.isArray(rhs) && v < rhs;
    case "odrl:lteq":
      return !Array.isArray(rhs) && v <= rhs;
    case "odrl:gt":
      return !Array.isArray(rhs) && v > rhs;
    case "odrl:gteq":
      return !Array.isArray(rhs) && v >= rhs;
    case "odrl:isA":
      return !Array.isArray(rhs) && v === rhs;
    default:
      return false;
  }
}

function actorMatchesAssignee(req: PcfDecisionRequest, assignee: string): boolean {
  if (assignee === ANYONE) return true;
  if (req.actor && req.actor === assignee) return true;
  if (req.actorGroups?.includes(assignee)) return true;
  if (req.actorRoles?.includes(assignee)) return true;
  return false;
}

function hasActorContext(req: PcfDecisionRequest): boolean {
  return (
    (req.actor !== undefined && req.actor !== null && req.actor !== "") ||
    (req.actorGroups !== undefined && req.actorGroups.length > 0) ||
    (req.actorRoles !== undefined && req.actorRoles.length > 0)
  );
}

const DEFAULT_ACTION_GRAPH: ActionGraph = actionGraph([]);

type PermissionEval = "permitted" | "violated" | "unknown" | "no-match";
type ProhibitionEval = "prohibited" | "not-prohibited" | "unknown";

function evaluatePermission(
  r: PcfOdrlRule,
  req: PcfDecisionRequest,
  action: string,
  scope: PcfRequestScope,
  graph: ActionGraph,
): PermissionEval {
  if (!broaderOrSelf(action, graph).has(r.action)) return "no-match";

  let hasUnknown = false;

  if (r.assignee !== ANYONE) {
    if (!hasActorContext(req)) {
      hasUnknown = true;
    } else if (!actorMatchesAssignee(req, r.assignee)) {
      return "violated";
    }
  }

  if (r.target !== undefined) {
    if (scope.target === undefined) {
      hasUnknown = true;
    } else if (scope.target !== r.target) {
      return "violated";
    }
  }

  for (const c of r.constraint ?? []) {
    if (readScopeOperand(c.leftOperand, scope) === undefined) {
      hasUnknown = true;
    } else if (!evaluateConstraint(c, scope)) {
      return "violated";
    }
  }

  return hasUnknown ? "unknown" : "permitted";
}

function evaluateProhibition(
  r: PcfOdrlRule,
  req: PcfDecisionRequest,
  action: string,
  scope: PcfRequestScope,
  graph: ActionGraph,
): ProhibitionEval {
  if (!broaderOrSelf(action, graph).has(r.action)) return "not-prohibited";

  let hasUnknown = false;

  if (r.assignee !== ANYONE) {
    if (!hasActorContext(req)) {
      hasUnknown = true;
    } else if (!actorMatchesAssignee(req, r.assignee)) {
      return "not-prohibited";
    }
  }

  if (r.target !== undefined) {
    if (scope.target === undefined) {
      hasUnknown = true;
    } else if (scope.target !== r.target) {
      return "not-prohibited";
    }
  }

  for (const c of r.constraint ?? []) {
    if (readScopeOperand(c.leftOperand, scope) === undefined) {
      hasUnknown = true;
    } else if (!evaluateConstraint(c, scope)) {
      return "not-prohibited";
    }
  }
  return hasUnknown ? "unknown" : "prohibited";
}

/** Evaluate a single PCF ODRL `Set` against a decision request. */
export function evaluatePcfPolicy(
  policy: PcfOdrlSet,
  req: PcfDecisionRequest,
  graph: ActionGraph = DEFAULT_ACTION_GRAPH,
): Decision {
  if (policy.permission.length === 0 && policy.prohibition.length === 0) {
    return "unknown";
  }

  const action = req.action ?? "odrl:use";
  const scope = normalizeScope(req);

  const permOutcomes = policy.permission.map((r) => evaluatePermission(r, req, action, scope, graph));
  const prohOutcomes = policy.prohibition.map((r) => evaluateProhibition(r, req, action, scope, graph));

  const permitted = permOutcomes.includes("permitted");
  const permViolated = permOutcomes.includes("violated");
  const permUnknown = permOutcomes.includes("unknown");

  const prohibited = prohOutcomes.includes("prohibited");
  const prohUnknown = prohOutcomes.includes("unknown");

  if (prohibited && permitted) {
    const strategy = policy.conflict ?? FOLIO_DEFAULT_CONFLICT;
    return strategy === "odrl:perm" ? "permit" : "deny";
  }
  if (prohibited) {
    if (policy.conflict === "odrl:perm" && permUnknown) return "unknown";
    return "deny";
  }
  if (prohUnknown && (permitted || policy.permission.length === 0)) {
    return "unknown";
  }
  if (permitted) {
    const role = scope["cat-harness:role"];
    if (role && req.actorRoles && req.actorRoles.length > 0 && !req.actorRoles.includes(role)) {
      return "deny";
    }
    return "permit";
  }
  if (permUnknown) return "unknown";
  if (permViolated) return "deny";
  return "unknown";
}

function resolveImplicitPolicy(
  implicit: PcfOdrlSet | PcfImplicitPolicyAlias | string | undefined,
): PcfOdrlSet | undefined {
  if (!implicit) return undefined;
  if (typeof implicit === "string") {
    const resolved = getImplicitPolicySet(implicit);
    if (!resolved) {
      throw new Error(`Unknown IHE PCF implicit policy URI or alias: "${implicit}"`);
    }
    return resolved;
  }
  return implicit;
}

function isFhirConsent(x: unknown): x is FhirConsent {
  return Boolean(x && typeof x === "object" && (x as { resourceType?: unknown }).resourceType === "Consent");
}

function isPcfOdrlSet(x: unknown): x is PcfOdrlSet {
  return Boolean(
    x &&
      typeof x === "object" &&
      "@type" in (x as Record<string, unknown>) &&
      Array.isArray((x as { permission?: unknown }).permission),
  );
}

export type ConsentOrPolicyInput =
  | FhirConsent
  | PcfOdrlSet
  | readonly (FhirConsent | PcfOdrlSet)[]
  | ReadonlyMap<string, FhirConsent | PcfOdrlSet>
  | null
  | undefined;

function refForConsent(consent: FhirConsent): ConsentDecisionRef {
  return {
    id: consent.id?.trim() || "anonymous",
    versionId: consent.meta?.versionId?.trim() || "1",
    uid: consentPolicyUid(consent),
  };
}

function refForSet(set: PcfOdrlSet): ConsentDecisionRef {
  const m = /^urn:ihe:pcf:consent:([^:]+?)(?::v(.+))?$/.exec(set.uid);
  return {
    id: m?.[1] ?? set.uid,
    versionId: m?.[2] ?? "1",
    uid: set.uid,
  };
}

/**
 * Evaluate {@link decide} together with the deciding `ConsentDecisionRef`
 * (`{ id, versionId, uid }`) for `cat-harness` `odrl:obtainConsent` duty
 * evaluation and `prov:used` citations (beans `a7c1`, `2egb`, `6jnx`).
 */
export function decideWithCitation(
  consentOrPolicy: ConsentOrPolicyInput,
  req: PcfDecisionRequest,
  options: PcfDecideOptions = {},
): ConsentEvaluation {
  const graph = options.actionGraph ?? DEFAULT_ACTION_GRAPH;
  const fallback = resolveImplicitPolicy(options.implicitPolicy);
  const scope = normalizeScope(req);
  const reqDateTime = scope["odrl:dateTime"] ?? scope.dateTime;

  const items: (FhirConsent | PcfOdrlSet)[] = [];
  if (consentOrPolicy === null || consentOrPolicy === undefined) {
    // empty
  } else if (consentOrPolicy instanceof Map) {
    for (const v of consentOrPolicy.values()) items.push(v);
  } else if (Array.isArray(consentOrPolicy)) {
    items.push(...consentOrPolicy);
  } else if (isFhirConsent(consentOrPolicy) || isPcfOdrlSet(consentOrPolicy)) {
    items.push(consentOrPolicy);
  }

  const activeEntries: { set: PcfOdrlSet; ref: ConsentDecisionRef }[] = [];
  let hadExpiredActiveConsent = false;
  let expiredRef: ConsentDecisionRef | undefined;

  for (const item of items) {
    if (isFhirConsent(item)) {
      if (item.status !== "active") continue;
      const ref = refForConsent(item);
      if (reqDateTime && isConsentExpired(item, String(reqDateTime))) {
        hadExpiredActiveConsent = true;
        expiredRef ??= ref;
        if (!fallback) {
          activeEntries.push({ set: consentToOdrl(item), ref });
        }
        continue;
      }
      activeEntries.push({ set: consentToOdrl(item), ref });
    } else if (isPcfOdrlSet(item)) {
      if (item.permission.length > 0 || item.prohibition.length > 0) {
        activeEntries.push({ set: item, ref: refForSet(item) });
      }
    }
  }

  if (activeEntries.length === 0) {
    if (fallback) {
      const verdict = evaluatePcfPolicy(fallback, req, graph);
      return { verdict, consent: refForSet(fallback) };
    }
    return hadExpiredActiveConsent
      ? { verdict: "deny", ...(expiredRef ? { consent: expiredRef } : {}) }
      : { verdict: "unknown" };
  }

  let firstPermitRef: ConsentDecisionRef | undefined;
  let firstUnknownRef: ConsentDecisionRef | undefined;
  for (const { set, ref } of activeEntries) {
    const d = evaluatePcfPolicy(set, req, graph);
    if (d === "deny") return { verdict: "deny", consent: ref };
    if (d === "permit" && firstPermitRef === undefined) firstPermitRef = ref;
    if (d === "unknown" && firstUnknownRef === undefined) firstUnknownRef = ref;
  }
  if (firstPermitRef !== undefined) {
    return { verdict: "permit", consent: firstPermitRef };
  }
  return {
    verdict: "unknown",
    ...(firstUnknownRef !== undefined ? { consent: firstUnknownRef } : {}),
  };
}

/**
 * Three-valued IHE PCF access-control decision (`"permit"` | `"deny"` | `"unknown"`)
 * over a FHIR `Consent`, a translated ODRL `Set`, a collection of Consents/Sets,
 * or `null`/`undefined` (with optional fallback to one of the four IHE PCF
 * Volume 1 §1:53.2.1 implicit-policy `Set`s).
 */
export function decide(
  consentOrPolicy: ConsentOrPolicyInput,
  req: PcfDecisionRequest,
  options: PcfDecideOptions = {},
): Decision {
  return decideWithCitation(consentOrPolicy, req, options).verdict;
}

/** One version of an agreement, as its DCAT 3 record describes it. */
export interface AgreementVersion {
  /** The version's ODRL policy; its `uid` is the fixed-version URL. */
  policy: OdrlPolicy;
  /** The fixed-version URL of the version this one amends (`dcat:previousVersion`). */
  previousVersion?: string;
}

const bareOperand = (x: string): string => x.replace(/^odrl:/, "");
const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
type OdrlConstraintLike = NonNullable<OdrlRule["constraint"]>[number];

function boundValue(left: string, value: string): number | undefined {
  if (left === "dateTime") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? undefined : ms;
  }
  if (left === "elapsedTime") return parseDurationMs(value);
  return undefined;
}

/** Is constraint `n` at least as tight as constraint `o`? Unknown cases answer no. */
function constraintAtLeastAsTight(n: OdrlConstraintLike, o: OdrlConstraintLike): boolean {
  const left = bareOperand(n.leftOperand);
  if (left !== bareOperand(o.leftOperand)) return false;
  const nOp = bareOperand(n.operator);
  const oOp = bareOperand(o.operator);
  if (nOp === oOp && sameJson(n.rightOperand, o.rightOperand)) return true;
  if (left === "purpose" && oOp === "isA" && typeof o.rightOperand === "string") {
    const within = (code: string) => broaderOrSelf(normalizePurposeCode(code), PURPOSE_GRAPH).has(normalizePurposeCode(o.rightOperand as string));
    if ((nOp === "isA" || nOp === "eq") && typeof n.rightOperand === "string") return within(n.rightOperand);
    if (nOp === "isAnyOf" && Array.isArray(n.rightOperand)) return n.rightOperand.every(within);
    return false;
  }
  if ((left === "dateTime" || left === "elapsedTime") && typeof n.rightOperand === "string" && typeof o.rightOperand === "string") {
    const nv = boundValue(left, n.rightOperand);
    const ov = boundValue(left, o.rightOperand);
    if (nv === undefined || ov === undefined) return false;
    const upper = (op: string) => op === "lt" || op === "lteq";
    const lower = (op: string) => op === "gt" || op === "gteq";
    if (upper(nOp) && upper(oOp)) return nv < ov || (nv === ov && !(nOp === "lteq" && oOp === "lt"));
    if (lower(nOp) && lower(oOp)) return nv > ov || (nv === ov && !(nOp === "gteq" && oOp === "gt"));
  }
  return false;
}

/** Does newer permission `n` allow nothing that older permission `o` did not? */
function permissionWithin(n: OdrlRule, o: OdrlRule, graph: ActionGraph): boolean {
  if (o.assignee !== ANYONE && n.assignee !== o.assignee) return false;
  if (!broaderOrSelf(n.action, graph).has(o.action)) return false;
  if (o.target !== undefined && n.target !== o.target) return false;
  for (const oc of o.constraint ?? []) {
    if (!(n.constraint ?? []).some((nc) => constraintAtLeastAsTight(nc, oc))) return false;
  }
  for (const od of o.duty ?? []) {
    if (!(n.duty ?? []).some((nd) => sameJson(nd, od))) return false;
  }
  return true;
}

/**
 * Is `newer` a narrowing amendment of `older`: does it permit nothing the
 * older version did not? Computed from the ODRL rules alone, with no extra
 * field (owner card 2026-10-30 19:55Z). Every newer permission must sit
 * inside some older permission (same or narrower action, same target and
 * assignee, every older constraint matched by one at least as tight, every
 * older duty kept); every older prohibition and policy obligation must still
 * be there; parties and conflict strategy must not change. Anything this
 * cannot compare, such as `inheritFrom`, answers false, so the old Consent
 * does not count and new consent is needed.
 */
export function isNarrowingAmendment(newer: OdrlPolicy, older: OdrlPolicy, graph: ActionGraph = DEFAULT_ACTION_GRAPH): boolean {
  if (newer.inheritFrom?.length || older.inheritFrom?.length) return false;
  if (newer.assigner !== older.assigner || newer.assignee !== older.assignee) return false;
  if ((newer.conflict ?? FOLIO_DEFAULT_CONFLICT) !== (older.conflict ?? FOLIO_DEFAULT_CONFLICT)) return false;
  for (const np of newer.permission ?? []) {
    if (!(older.permission ?? []).some((op) => permissionWithin(np, op, graph))) return false;
  }
  for (const oq of older.prohibition ?? []) {
    if (!(newer.prohibition ?? []).some((nq) => sameJson(nq, oq))) return false;
  }
  for (const ob of older.obligation ?? []) {
    if (!(newer.obligation ?? []).some((nb) => sameJson(nb, ob))) return false;
  }
  return true;
}

/**
 * The agreement versions whose Consents still count for `currentUri`: the
 * current version, then each `dcat:previousVersion` reached while every step
 * is a narrowing amendment. The walk stops at the first widening step, at a
 * version missing from `versions`, or at a loop.
 */
export function versionsCoveredByConsent(
  currentUri: string,
  versions: ReadonlyMap<string, AgreementVersion>,
  graph: ActionGraph = DEFAULT_ACTION_GRAPH,
): Set<string> {
  const covered = new Set([currentUri]);
  let current = versions.get(currentUri);
  while (current?.previousVersion && !covered.has(current.previousVersion)) {
    const previous = versions.get(current.previousVersion);
    if (!previous || !isNarrowingAmendment(current.policy, previous.policy, graph)) break;
    covered.add(current.previousVersion);
    current = previous;
  }
  return covered;
}

/**
 * Keep only the FHIR `Consent`s whose `policy[].uri` names this exact agreement
 * version (owner rule 2, 2026-10-30 19:27Z). A Consent given for an earlier or
 * later version, or for no agreement, does not count, so an amendment that
 * changes the agreement's version URL needs new consent. Translated ODRL `Set`s
 * (including PCF's implicit policies) pass through unchanged.
 */
export function consentsCitingAgreement(
  consentOrPolicy: ConsentOrPolicyInput,
  agreementUri: string | ReadonlySet<string>,
): (FhirConsent | PcfOdrlSet)[] {
  const accepted = typeof agreementUri === "string" ? new Set([agreementUri]) : agreementUri;
  const items: (FhirConsent | PcfOdrlSet)[] = [];
  if (consentOrPolicy === null || consentOrPolicy === undefined) return items;
  if (consentOrPolicy instanceof Map) items.push(...consentOrPolicy.values());
  else if (Array.isArray(consentOrPolicy)) items.push(...consentOrPolicy);
  else items.push(consentOrPolicy as FhirConsent | PcfOdrlSet);
  return items.filter((item) => !isFhirConsent(item) || (item.policy ?? []).some((p) => p.uri !== undefined && accepted.has(p.uri)));
}

/**
 * Build an injected {@link ConsentEvaluator} for `cat-harness`'s
 * `odrl:obtainConsent` duty (`permits`, `decide`, `permitsWithConsent`,
 * `decideWithConsent`) backed by this single PCF Consent evaluator (beans
 * `a7c1`, `2egb`, `6jnx`).
 */
export function createPcfConsentEvaluator(
  consentOrPolicy: ConsentOrPolicyInput,
  options: PcfDecideOptions & {
    pcfScope?: Partial<PcfRequestScope>;
    /**
     * The agreement's fixed-version URL. A Consent counts for the agreement
     * only when one of its R4 `Consent.policy.uri` values equals it (owner
     * rule 2, 2026-10-30 19:27Z: version pinning). Defaults to the agreement
     * policy's `uid`; with neither, Consents are not filtered.
     */
    agreementPolicyUri?: string;
    /**
     * The agreement's version chain, from its DCAT 3 records: each version's
     * fixed-version URL, its ODRL policy, and its `dcat:previousVersion`.
     * With it, a Consent for an earlier version still counts when every
     * amendment from that version to the current one narrows use (owner rule
     * 2 and card 2026-10-30 19:55Z "Follow version chain"); see
     * {@link versionsCoveredByConsent}.
     */
    agreementVersions?: ReadonlyMap<string, AgreementVersion>;
  } = {},
): ConsentEvaluator {
  return (req: PermitRequest, _duty, rule, policy): ConsentEvaluation => {
    const agreementUri = options.agreementPolicyUri ?? policy?.uid;
    const pinned = agreementUri
      ? consentsCitingAgreement(
          consentOrPolicy,
          options.agreementVersions
            ? versionsCoveredByConsent(agreementUri, options.agreementVersions, options.actionGraph ?? DEFAULT_ACTION_GRAPH)
            : agreementUri,
        )
      : consentOrPolicy;
    const graph = options.actionGraph ?? DEFAULT_ACTION_GRAPH;
    const effectiveAction =
      req.action && broaderOrSelf(req.action, graph).has("odrl:use")
        ? req.action
        : rule?.action && broaderOrSelf(rule.action, graph).has("odrl:use")
          ? rule.action
          : "odrl:use";
    const scope: PcfRequestScope = {
      ...(req.scope ?? {}),
      ...(options.pcfScope ?? {}),
    };
    return decideWithCitation(
      pinned,
      {
        actor: req.actor,
        actorRoles: req.actorRoles,
        actorGroups: req.actorGroups,
        action: effectiveAction,
        scope,
      },
      options,
    );
  };
}
