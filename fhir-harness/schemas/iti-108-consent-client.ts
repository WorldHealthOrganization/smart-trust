/**
 * IHE ITI-108 (*Find Access Consent* / *Access Consent* `[ITI-108]`) Consent
 * Registry read client for IHE Privacy Consent on FHIR (PCF) 1.1.0 and HL7
 * FHIR R4 `Consent`.
 *
 * Queries a FHIR R4 Consent Registry (`GET [base]/Consent` with ITI-108 search
 * parameters `patient`, `patient.identifier`, `status=active`, `actor`,
 * `purpose`, `category`, `security-label`, `date`, `action`, `source-reference`,
 * `_profile`), validates the returned searchset `Bundle`, filters out
 * non-`active`, expired (`provision.period.end < now`), and not-yet-valid
 * (`provision.period.start > now`) `Consent` resources (as well as
 * `OperationOutcome` informational entries), and returns a three-valued result:
 *
 * - `status: "determined"` with active, non-expired `Consent` resources when
 *   the registry responds with a valid searchset `Bundle`;
 * - `status: "unknown"` (never silent empty and never permit) with a
 *   diagnostic `reason` when the registry is unreachable, times out, returns a
 *   non-2xx HTTP status, or returns malformed JSON / a non-searchset payload.
 *
 * Follow-up bean `folio-assistant-6jnx`:
 * - `FhirConsentSchema`, `FhirSearchsetBundleSchema`, `FhirOperationOutcomeSchema`,
 *   `parseFhirPeriodBound`, and `isConsentExpired` are imported from
 *   `./pcf-consent.js` (built from `hl7.fhir.r4.core#4.0.1` `StructureDefinition-*.json`
 *   and `CodeSystem-*.json`, with a single `isConsentExpired` definition).
 *
 * @module fhir-harness/schemas/iti-108-consent-client
 * @graphNode schema
 * @conformsTo hl7-fhir
 */
import { inputSiteReached } from "../../cat-harness-tools/schemas/sdlc/input-trace.ts";
import {
  FhirCodeableConceptSchema,
  FhirCodingSchema,
  FhirConsentDataMeaningSchema,
  FhirConsentMetaSchema,
  FhirConsentProvisionTypeSchema,
  FhirConsentSchema,
  FhirConsentStatusSchema,
  FhirIdentifierSchema,
  FhirOperationOutcomeSchema,
  FhirPeriodSchema,
  FhirReferenceSchema,
  FhirSearchsetBundleSchema,
  FhirStrictConsentSchema,
  PCF_CONSENT_ADVANCED_PROFILE,
  PCF_CONSENT_BASIC_PROFILE,
  PCF_CONSENT_INTERMEDIATE_PROFILE,
  isConsentExpired,
  parseFhirPeriodBound,
  type FhirBundleEntry,
  type FhirBundleLink,
  type FhirCodeableConcept,
  type FhirCoding,
  type FhirConsent,
  type FhirConsentActor,
  type FhirConsentData,
  type FhirConsentDataMeaning,
  type FhirConsentMeta,
  type FhirConsentPolicy,
  type FhirConsentProvision,
  type FhirConsentProvisionType,
  type FhirConsentStatus,
  type FhirIdentifier,
  type FhirOperationOutcome,
  type FhirPeriod,
  type FhirReference,
  type FhirSearchsetBundle,
} from "./pcf-consent.js";

export {
  FhirCodeableConceptSchema,
  FhirCodingSchema,
  FhirConsentDataMeaningSchema,
  FhirConsentMetaSchema,
  FhirConsentProvisionTypeSchema,
  FhirConsentSchema,
  FhirConsentStatusSchema,
  FhirIdentifierSchema,
  FhirOperationOutcomeSchema,
  FhirPeriodSchema,
  FhirReferenceSchema,
  FhirSearchsetBundleSchema,
  FhirStrictConsentSchema,
  isConsentExpired,
  parseFhirPeriodBound,
  type FhirBundleEntry,
  type FhirBundleLink,
  type FhirCodeableConcept,
  type FhirCoding,
  type FhirConsent,
  type FhirConsentActor,
  type FhirConsentData,
  type FhirConsentDataMeaning,
  type FhirConsentMeta,
  type FhirConsentPolicy,
  type FhirConsentProvision,
  type FhirConsentProvisionType,
  type FhirConsentStatus,
  type FhirIdentifier,
  type FhirOperationOutcome,
  type FhirPeriod,
  type FhirReference,
  type FhirSearchsetBundle,
};

export const ITI_108_TRANSACTION = "ITI-108" as const;
export const FHIR_JSON_MEDIA_TYPE = "application/fhir+json" as const;

export const PCF_CONSENT_PROFILE_URLS = {
  basic: PCF_CONSENT_BASIC_PROFILE,
  intermediate: PCF_CONSENT_INTERMEDIATE_PROFILE,
  advanced: PCF_CONSENT_ADVANCED_PROFILE,
} as const;

export interface Iti108Query {
  /** Base URL of the FHIR R4 Consent Registry (e.g. `"https://registry.example.org/fhir"`). */
  baseUrl: string;
  /** Patient reference (e.g. `"Patient/pat-1"` or `"pat-1"`). */
  patient?: string;
  /** Patient business identifier token (e.g. `"urn:oid:1.2.3|12345"`), sent as `patient.identifier`. */
  patientIdentifier?: string;
  /** Status parameter sent on the query (defaults to `"active"`). */
  status?: string | readonly string[];
  /** Actor reference(s) (e.g. `"Practitioner/prac-1"` or `"Organization/org-1"`). */
  actor?: string | readonly string[];
  /** PurposeOfUse token(s) (e.g. `"TREAT"`, `"HRESCH"`). */
  purpose?: string | readonly string[];
  /** Category token(s) (e.g. `"http://loinc.org|59284-0"`). */
  category?: string | readonly string[];
  /** Security label token(s), sent as `security-label`. */
  securityLabel?: string | readonly string[];
  /** Date filter(s), e.g. `"ge2026-01-01"`. */
  date?: string | readonly string[];
  /** Action token(s). */
  action?: string | readonly string[];
  /** Source reference filter, sent as `source-reference`. */
  sourceReference?: string;
  /** Profile canonical URL filter(s), sent as `_profile`. */
  profile?: string | readonly string[];
  /** Optional HTTP headers (e.g. `{ Authorization: "Bearer ..." }`); no IUA claim is required. */
  headers?: Readonly<Record<string, string>>;
  /** Request timeout in milliseconds (defaults to `10_000`). */
  timeoutMs?: number;
  /** Follow `Bundle.link[relation="next"]` pagination links (defaults to `true`). */
  followNext?: boolean;
  /** Maximum number of Bundle pages to fetch when `followNext` is `true` (defaults to `10`). */
  maxPages?: number;
  /** Reference timestamp (`ISO-8601` string or `Date`) used to evaluate `provision.period` expiry (defaults to `new Date()`). */
  now?: string | Date;
  /** Custom `fetch` implementation (defaults to `globalThis.fetch`). */
  fetchImpl?: typeof fetch;
}

export type Iti108IgnoredReason =
  | "not-active"
  | "expired"
  | "not-yet-valid"
  | "invalid-period"
  | "patient-mismatch"
  | "operation-outcome"
  | "invalid-resource";

export interface Iti108IgnoredEntry {
  id?: string;
  resourceType?: string;
  reason: Iti108IgnoredReason;
  detail: string;
}

export type Iti108UnknownReason =
  | "invalid-query"
  | "unreachable"
  | "timeout"
  | "http-error"
  | "invalid-json"
  | "invalid-bundle";

export interface Iti108DeterminedResult {
  status: "determined";
  /** Active, non-expired FHIR R4 `Consent` resources returned by the registry. */
  consents: FhirConsent[];
  /** Entries in the searchset `Bundle` that were filtered out (inactive, expired, not-yet-valid, informational `OperationOutcome`, etc.). */
  ignored: Iti108IgnoredEntry[];
  /** The initial ITI-108 search URL issued to the Consent Registry. */
  requestUrl: string;
  /** ISO-8601 timestamp against which `provision.period` validity was evaluated. */
  evaluatedAt: string;
  /** Total reported by the first Bundle page, if present. */
  bundleTotal?: number;
}

export interface Iti108UnknownResult {
  status: "unknown";
  reason: Iti108UnknownReason;
  detail: string;
  requestUrl?: string;
  httpStatus?: number;
}

export type Iti108Result = Iti108DeterminedResult | Iti108UnknownResult;

function appendParam(params: URLSearchParams, key: string, value?: string | readonly string[]): void {
  if (value === undefined) return;
  if (typeof value === "string") {
    if (value.trim().length > 0) params.append(key, value.trim());
    return;
  }
  for (const item of value) {
    if (item.trim().length > 0) params.append(key, item.trim());
  }
}

/**
 * Construct the IHE ITI-108 `GET [base]/Consent?...` search URL from query parameters.
 * Defaults `status` to `"active"` when omitted.
 */
export function buildIti108SearchUrl(query: Iti108Query): URL {
  const trimmedBase = query.baseUrl.trim().replace(/\/+$/, "");
  if (!trimmedBase) {
    throw new Error("baseUrl must be a non-empty URL");
  }
  const url = new URL(`${trimmedBase}/Consent`);
  const params = url.searchParams;

  appendParam(params, "patient", query.patient);
  appendParam(params, "patient.identifier", query.patientIdentifier);
  appendParam(params, "status", query.status ?? "active");
  appendParam(params, "actor", query.actor);
  appendParam(params, "purpose", query.purpose);
  appendParam(params, "category", query.category);
  appendParam(params, "security-label", query.securityLabel);
  appendParam(params, "date", query.date);
  appendParam(params, "action", query.action);
  appendParam(params, "source-reference", query.sourceReference);
  appendParam(params, "_profile", query.profile);

  return url;
}

function resolveNowMs(now?: string | Date): number {
  if (now === undefined) {
    // input-site: traced #c1d486be — the clock, when a caller names no time; a run that reaches it is not cached
    inputSiteReached("iti-108: clock");
    return Date.now();
  }
  if (now instanceof Date) return now.getTime();
  return Date.parse(now);
}

/**
 * Normalize a FHIR Patient reference (`"Patient/pat-1"`, `"https://.../Patient/pat-1"`,
 * or `"pat-1"`) to its bare logical id for client-side patient matching.
 */
export function normalizePatientId(ref: string): string {
  const trimmed = ref.trim();
  const match = /(?:^|\/)Patient\/([^/?#]+)$/.exec(trimmed);
  if (match) return match[1]!;
  return trimmed;
}

/**
 * Evaluate whether a FHIR R4 `Consent` resource is active, currently within
 * its `provision.period` (neither expired nor future-dated), and matches the
 * expected patient (when specified).
 */
export function evaluateConsentValidity(
  consent: FhirConsent,
  now?: string | Date,
  expectedPatient?: string,
): { valid: true } | { valid: false; reason: Iti108IgnoredReason; detail: string } {
  if (consent.status !== "active") {
    return {
      valid: false,
      reason: "not-active",
      detail: `Consent${consent.id ? ` ${consent.id}` : ""} has status "${consent.status}" (expected "active")`,
    };
  }

  if (expectedPatient !== undefined && expectedPatient.trim().length > 0) {
    const actualRef = consent.patient?.reference;
    if (!actualRef || normalizePatientId(actualRef) !== normalizePatientId(expectedPatient)) {
      return {
        valid: false,
        reason: "patient-mismatch",
        detail: `Consent${consent.id ? ` ${consent.id}` : ""} patient "${actualRef ?? "(missing)"}" does not match requested patient "${expectedPatient}"`,
      };
    }
  }

  const nowMs = resolveNowMs(now);
  if (Number.isNaN(nowMs)) {
    return {
      valid: false,
      reason: "invalid-period",
      detail: "Evaluation timestamp `now` is not a valid date",
    };
  }

  const period = consent.provision?.period;
  if (period) {
    let startMs: number | undefined;
    let endMs: number | undefined;
    if (period.start !== undefined) {
      startMs = parseFhirPeriodBound(period.start, "start");
      if (Number.isNaN(startMs)) {
        return {
          valid: false,
          reason: "invalid-period",
          detail: `Consent${consent.id ? ` ${consent.id}` : ""} has invalid provision.period.start "${period.start}"`,
        };
      }
    }
    if (period.end !== undefined) {
      endMs = parseFhirPeriodBound(period.end, "end");
      if (Number.isNaN(endMs)) {
        return {
          valid: false,
          reason: "invalid-period",
          detail: `Consent${consent.id ? ` ${consent.id}` : ""} has invalid provision.period.end "${period.end}"`,
        };
      }
    }
    if (startMs !== undefined && endMs !== undefined && startMs > endMs) {
      return {
        valid: false,
        reason: "invalid-period",
        detail: `Consent${consent.id ? ` ${consent.id}` : ""} has provision.period.start "${period.start}" after provision.period.end "${period.end}"`,
      };
    }
    if (endMs !== undefined && endMs < nowMs) {
      return {
        valid: false,
        reason: "expired",
        detail: `Consent${consent.id ? ` ${consent.id}` : ""} expired at "${period.end}" (evaluated at ${new Date(nowMs).toISOString()})`,
      };
    }
    if (startMs !== undefined && startMs > nowMs) {
      return {
        valid: false,
        reason: "not-yet-valid",
        detail: `Consent${consent.id ? ` ${consent.id}` : ""} is not valid until "${period.start}" (evaluated at ${new Date(nowMs).toISOString()})`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate and filter a single FHIR R4 `Bundle` (`type: "searchset"`) returned
 * by an ITI-108 Consent Registry query.
 */
export function filterIti108Bundle(
  bundlePayload: unknown,
  options: { now?: string | Date; patient?: string; requestUrl?: string } = {},
): Iti108Result {
  const requestUrl = options.requestUrl ?? "";
  const nowMs = resolveNowMs(options.now);
  if (Number.isNaN(nowMs)) {
    return {
      status: "unknown",
      reason: "invalid-query",
      detail: "Evaluation timestamp `now` is not a valid date",
      ...(requestUrl ? { requestUrl } : {}),
    };
  }
  const evaluatedAt = new Date(nowMs).toISOString();

  const parsedBundle = FhirSearchsetBundleSchema.safeParse(bundlePayload);
  if (!parsedBundle.success) {
    const rt =
      bundlePayload !== null && typeof bundlePayload === "object" && "resourceType" in bundlePayload
        ? String((bundlePayload as Record<string, unknown>).resourceType)
        : undefined;
    return {
      status: "unknown",
      reason: "invalid-bundle",
      detail: rt
        ? `Expected FHIR Bundle resource, received resourceType "${rt}"`
        : `Response is not a valid FHIR Bundle: ${parsedBundle.error.issues.map((i) => i.message).join("; ")}`,
      ...(requestUrl ? { requestUrl } : {}),
    };
  }

  const bundle = parsedBundle.data;
  if (bundle.type !== "searchset") {
    return {
      status: "unknown",
      reason: "invalid-bundle",
      detail: `Expected Bundle.type "searchset", received "${bundle.type}"`,
      ...(requestUrl ? { requestUrl } : {}),
    };
  }

  const consents: FhirConsent[] = [];
  const ignored: Iti108IgnoredEntry[] = [];

  for (const entry of bundle.entry ?? []) {
    const resource = entry.resource;
    if (!resource || typeof resource !== "object") {
      ignored.push({
        reason: "invalid-resource",
        detail: "Bundle entry contains no resource object",
      });
      continue;
    }

    const resourceType = typeof resource.resourceType === "string" ? resource.resourceType : undefined;
    const resourceId = typeof resource.id === "string" ? resource.id : undefined;

    if (resourceType === "OperationOutcome") {
      const parsedOutcome = FhirOperationOutcomeSchema.safeParse(resource);
      // A valid OperationOutcome always carries `issue` (1..*); an invalid one is an error anyway.
      const issues = parsedOutcome.success ? parsedOutcome.data.issue : [];
      const hasError =
        !parsedOutcome.success ||
        issues.some((iss) => iss && (iss.severity === "error" || iss.severity === "fatal"));
      if (hasError) {
        return {
          status: "unknown",
          reason: "invalid-bundle",
          detail: `Searchset Bundle contains error/fatal OperationOutcome${resourceId ? ` (${resourceId})` : ""}`,
          ...(requestUrl ? { requestUrl } : {}),
        };
      }
      ignored.push({
        ...(resourceId ? { id: resourceId } : {}),
        resourceType: "OperationOutcome",
        reason: "operation-outcome",
        detail: "Informational OperationOutcome in searchset Bundle",
      });
      continue;
    }

    if (resourceType !== "Consent") {
      ignored.push({
        ...(resourceId ? { id: resourceId } : {}),
        ...(resourceType ? { resourceType } : {}),
        reason: "invalid-resource",
        detail: `Unexpected resourceType "${resourceType ?? "(missing)"}" in Consent searchset Bundle`,
      });
      continue;
    }

    const parsedConsent = FhirConsentSchema.safeParse(resource);
    if (!parsedConsent.success) {
      ignored.push({
        ...(resourceId ? { id: resourceId } : {}),
        resourceType: "Consent",
        reason: "invalid-resource",
        detail: `Invalid FHIR R4 Consent${resourceId ? ` ${resourceId}` : ""}: ${parsedConsent.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      });
      continue;
    }

    const validity = evaluateConsentValidity(parsedConsent.data, new Date(nowMs), options.patient);
    if (!validity.valid) {
      ignored.push({
        ...(parsedConsent.data.id ? { id: parsedConsent.data.id } : {}),
        resourceType: "Consent",
        reason: validity.reason,
        detail: validity.detail,
      });
      continue;
    }

    consents.push(parsedConsent.data);
  }

  return {
    status: "determined",
    consents,
    ignored,
    requestUrl,
    evaluatedAt,
    ...(bundle.total !== undefined ? { bundleTotal: bundle.total } : {}),
  };
}

function classifyFetchError(
  err: unknown,
  abortedByTimeout: boolean,
): { reason: "timeout" | "unreachable"; detail: string } {
  if (abortedByTimeout) {
    return {
      reason: "timeout",
      detail: "Consent Registry ITI-108 request timed out",
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  if (name === "TimeoutError" || name === "AbortError" || /timeout|timed out|aborted/i.test(msg)) {
    return {
      reason: "timeout",
      detail: `Consent Registry ITI-108 request timed out: ${msg}`,
    };
  }
  return {
    reason: "unreachable",
    detail: `Consent Registry unreachable: ${msg}`,
  };
}

/**
 * Execute an IHE ITI-108 (*Find Access Consent*) read query against a FHIR R4
 * Consent Registry.
 */
export async function findAccessConsents(query: Iti108Query): Promise<Iti108Result> {
  let initialUrl: URL;
  try {
    initialUrl = buildIti108SearchUrl(query);
  } catch (err) {
    return {
      status: "unknown",
      reason: "invalid-query",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const nowMs = resolveNowMs(query.now);
  if (Number.isNaN(nowMs)) {
    return {
      status: "unknown",
      reason: "invalid-query",
      detail: "Evaluation timestamp `now` is not a valid date",
      requestUrl: initialUrl.toString(),
    };
  }

  const fetchFn = query.fetchImpl ?? fetch;
  const timeoutMs = query.timeoutMs ?? 10_000;
  const followNext = query.followNext ?? true;
  const maxPages = Math.max(1, query.maxPages ?? 10);

  const allConsents: FhirConsent[] = [];
  const allIgnored: Iti108IgnoredEntry[] = [];
  const seenConsentIds = new Set<string>();
  let bundleTotal: number | undefined;
  let currentUrl: string | undefined = initialUrl.toString();
  let pageCount = 0;

  while (currentUrl !== undefined && pageCount < maxPages) {
    pageCount += 1;
    const controller = new AbortController();
    let timeoutFired = false;
    const timer = setTimeout(() => {
      timeoutFired = true;
      controller.abort();
    }, timeoutMs);

    let response: Response;
    try {
      response = await fetchFn(currentUrl, {
        method: "GET",
        headers: {
          Accept: FHIR_JSON_MEDIA_TYPE,
          ...(query.headers ?? {}),
        },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const classified = classifyFetchError(err, timeoutFired);
      return {
        status: "unknown",
        reason: classified.reason,
        detail: classified.detail,
        requestUrl: currentUrl,
      };
    }

    if (!response.ok) {
      clearTimeout(timer);
      return {
        status: "unknown",
        reason: "http-error",
        httpStatus: response.status,
        detail: `Consent Registry returned HTTP ${response.status} ${response.statusText}`.trim(),
        requestUrl: currentUrl,
      };
    }

    let rawText: string;
    try {
      rawText = await response.text();
    } catch (err) {
      clearTimeout(timer);
      const classified = classifyFetchError(err, timeoutFired);
      return {
        status: "unknown",
        reason: classified.reason,
        detail: classified.detail,
        requestUrl: currentUrl,
      };
    } finally {
      clearTimeout(timer);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawText);
    } catch (err) {
      return {
        status: "unknown",
        reason: "invalid-json",
        detail: `Consent Registry response is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
        requestUrl: currentUrl,
      };
    }

    const pageResult = filterIti108Bundle(payload, {
      now: new Date(nowMs),
      patient: query.patient,
      requestUrl: currentUrl,
    });
    if (pageResult.status === "unknown") {
      return pageResult;
    }

    if (pageCount === 1 && pageResult.bundleTotal !== undefined) {
      bundleTotal = pageResult.bundleTotal;
    }

    for (const c of pageResult.consents) {
      const dedupeKey = c.id ? `${c.id}#${c.meta?.versionId ?? ""}` : undefined;
      if (dedupeKey !== undefined) {
        if (seenConsentIds.has(dedupeKey)) continue;
        seenConsentIds.add(dedupeKey);
      }
      allConsents.push(c);
    }
    allIgnored.push(...pageResult.ignored);

    if (!followNext) break;
    const parsedBundle = FhirSearchsetBundleSchema.parse(payload);
    const nextLink = parsedBundle.link?.find((l: FhirBundleLink) => l.relation === "next")?.url;
    currentUrl = nextLink ? new URL(nextLink, currentUrl).toString() : undefined;
  }

  return {
    status: "determined",
    consents: allConsents,
    ignored: allIgnored,
    requestUrl: initialUrl.toString(),
    evaluatedAt: new Date(nowMs).toISOString(),
    ...(bundleTotal !== undefined ? { bundleTotal } : {}),
  };
}

/** Options for {@link Iti108ConsentClient}'s optional result cache. */
export interface Iti108CacheOptions {
  /** How long a determined result may be reused, in milliseconds. */
  ttlMs: number;
  /** Clock for expiry, in epoch milliseconds (tests). Defaults to `Date.now`. */
  clock?: () => number;
}

interface Iti108CacheEntry {
  result: Iti108DeterminedResult;
  expiresAtMs: number;
  consentIds: ReadonlySet<string>;
}

/**
 * Reusable IHE ITI-108 Consent Registry read client bound to a base URL and
 * default request options.
 *
 * With `cache`, determined results are reused (owner rule 4, 2026-10-30
 * 19:27Z: "registry lookups may be cached, but the cache entry ends when the
 * Consent is withdrawn"). An entry ends at the earliest of its TTL and the
 * earliest `provision.period.end` among its Consents, and
 * {@link Iti108ConsentClient.consentWithdrawn} ends every entry holding that
 * Consent at once. Unknown results are never cached.
 */
export class Iti108ConsentClient {
  readonly baseUrl: string;
  private readonly defaults: Omit<Iti108Query, "baseUrl">;
  private readonly cacheOptions?: Iti108CacheOptions;
  private readonly cache = new Map<string, Iti108CacheEntry>();

  constructor(baseUrl: string, defaults: Omit<Iti108Query, "baseUrl"> = {}, cache?: Iti108CacheOptions) {
    this.baseUrl = baseUrl;
    this.defaults = defaults;
    this.cacheOptions = cache;
  }

  async findAccessConsents(query: Omit<Iti108Query, "baseUrl"> = {}): Promise<Iti108Result> {
    const full: Iti108Query = {
      ...this.defaults,
      ...query,
      baseUrl: this.baseUrl,
      headers: {
        ...(this.defaults.headers ?? {}),
        ...(query.headers ?? {}),
      },
    };
    if (!this.cacheOptions) return findAccessConsents(full);

    const now = (this.cacheOptions.clock ?? Date.now)();
    let key: string;
    try {
      key = buildIti108SearchUrl(full).toString();
    } catch {
      return findAccessConsents(full);
    }
    const hit = this.cache.get(key);
    if (hit && hit.expiresAtMs > now) return hit.result;
    if (hit) this.cache.delete(key);

    const result = await findAccessConsents(full);
    if (result.status === "determined") {
      let expiresAtMs = now + this.cacheOptions.ttlMs;
      for (const c of result.consents) {
        const end = c.provision?.period?.end;
        if (end) {
          const endMs = parseFhirPeriodBound(end, "end");
          if (!Number.isNaN(endMs)) expiresAtMs = Math.min(expiresAtMs, endMs);
        }
      }
      const consentIds = new Set(result.consents.map((c) => c.id).filter((id): id is string => typeof id === "string"));
      this.cache.set(key, { result, expiresAtMs, consentIds });
    }
    return result;
  }

  /**
   * A Consent was withdrawn (its status left `active`): end every cached
   * result that holds it, so the next lookup asks the registry again.
   * Returns how many entries ended.
   */
  consentWithdrawn(consentId: string): number {
    const id = consentId.replace(/^Consent\//, "").split("/_history/")[0];
    let ended = 0;
    for (const [key, entry] of this.cache) {
      if (entry.consentIds.has(id)) {
        this.cache.delete(key);
        ended++;
      }
    }
    return ended;
  }

  /** Drop every cached result. */
  clearCache(): void {
    this.cache.clear();
  }
}
