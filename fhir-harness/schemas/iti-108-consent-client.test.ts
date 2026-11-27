import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  buildIti108SearchUrl,
  evaluateConsentValidity,
  FHIR_JSON_MEDIA_TYPE,
  findAccessConsents,
  isConsentExpired,
  Iti108ConsentClient,
  PCF_CONSENT_PROFILE_URLS,
  type FhirConsent,
} from "./iti-108-consent-client.ts";

const NOW_ISO = "2026-10-30T12:00:00Z";

const ACTIVE_VALID_CONSENT: FhirConsent = {
  resourceType: "Consent",
  id: "consent-active-1",
  meta: {
    versionId: "1",
    profile: [PCF_CONSENT_PROFILE_URLS.basic],
  },
  status: "active",
  scope: {
    coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentscope", code: "patient-privacy" }],
  },
  category: [
    {
      coding: [{ system: "http://loinc.org", code: "59284-0" }],
    },
  ],
  patient: { reference: "Patient/pat-1" },
  dateTime: "2026-01-15T10:00:00Z",
  policyRule: {
    coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "OPTIN" }],
  },
  provision: {
    type: "permit",
    period: {
      start: "2026-01-01T00:00:00Z",
      end: "2026-12-31T23:59:59Z",
    },
    purpose: [
      { system: "http://terminology.hl7.org/CodeSystem/v3-ActReason", code: "TREAT" },
    ],
  },
};

const ACTIVE_OPEN_PERIOD_CONSENT: FhirConsent = {
  resourceType: "Consent",
  id: "consent-active-open",
  meta: {
    versionId: "2",
    profile: [PCF_CONSENT_PROFILE_URLS.basic],
  },
  status: "active",
  patient: { reference: "Patient/pat-1" },
  provision: {
    type: "permit",
    purpose: [
      { system: "http://terminology.hl7.org/CodeSystem/v3-ActReason", code: "HRESCH" },
    ],
  },
};

const EXPIRED_CONSENT: FhirConsent = {
  resourceType: "Consent",
  id: "consent-expired-1",
  meta: {
    versionId: "1",
    profile: [PCF_CONSENT_PROFILE_URLS.basic],
  },
  status: "active",
  patient: { reference: "Patient/pat-1" },
  provision: {
    type: "permit",
    period: {
      start: "2025-01-01T00:00:00Z",
      end: "2025-12-31T23:59:59Z",
    },
  },
};

const FUTURE_CONSENT: FhirConsent = {
  resourceType: "Consent",
  id: "consent-future-1",
  status: "active",
  patient: { reference: "Patient/pat-1" },
  provision: {
    type: "permit",
    period: {
      start: "2027-01-01T00:00:00Z",
      end: "2027-12-31T23:59:59Z",
    },
  },
};

const INACTIVE_CONSENT: FhirConsent = {
  resourceType: "Consent",
  id: "consent-inactive-1",
  status: "inactive",
  patient: { reference: "Patient/pat-1" },
  provision: {
    type: "permit",
    period: {
      start: "2026-01-01T00:00:00Z",
      end: "2026-12-31T23:59:59Z",
    },
  },
};

const OTHER_PATIENT_CONSENT: FhirConsent = {
  resourceType: "Consent",
  id: "consent-other-patient",
  status: "active",
  patient: { reference: "Patient/pat-2" },
  provision: {
    type: "permit",
  },
};

describe("ITI-108 Consent Registry read client (PCF7)", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;
  let lastRequestHeaders: Headers | undefined;
  let lastRequestUrl: URL | undefined;

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      async fetch(req: Request) {
        const url = new URL(req.url);
        lastRequestHeaders = req.headers;
        lastRequestUrl = url;

        if (url.pathname === "/fhir/Consent") {
          const patient = url.searchParams.get("patient");
          if (patient === "Patient/page-test") {
            const page = url.searchParams.get("_page") ?? "1";
            if (page === "1") {
              return Response.json(
                {
                  resourceType: "Bundle",
                  type: "searchset",
                  total: 2,
                  link: [
                    { relation: "self", url: `${baseUrl}/Consent?patient=Patient/page-test&_page=1` },
                    { relation: "next", url: `${baseUrl}/Consent?patient=Patient/page-test&_page=2` },
                  ],
                  entry: [
                    {
                      resource: {
                        ...ACTIVE_VALID_CONSENT,
                        id: "consent-page-1",
                        patient: { reference: "Patient/page-test" },
                      },
                    },
                  ],
                },
                { headers: { "content-type": FHIR_JSON_MEDIA_TYPE } },
              );
            }
            return Response.json(
              {
                resourceType: "Bundle",
                type: "searchset",
                total: 2,
                entry: [
                  {
                    resource: {
                      ...ACTIVE_OPEN_PERIOD_CONSENT,
                      id: "consent-page-2",
                      patient: { reference: "Patient/page-test" },
                    },
                  },
                ],
              },
              { headers: { "content-type": FHIR_JSON_MEDIA_TYPE } },
            );
          }

          if (patient === "Patient/empty") {
            return Response.json(
              {
                resourceType: "Bundle",
                type: "searchset",
                total: 0,
                entry: [],
              },
              { headers: { "content-type": FHIR_JSON_MEDIA_TYPE } },
            );
          }

          // Default searchset returning a mix of active, expired, future, inactive,
          // other-patient Consents and an informational OperationOutcome.
          return Response.json(
            {
              resourceType: "Bundle",
              id: "bundle-iti-108",
              type: "searchset",
              total: 6,
              entry: [
                { fullUrl: `${baseUrl}/Consent/consent-active-1`, resource: ACTIVE_VALID_CONSENT },
                { fullUrl: `${baseUrl}/Consent/consent-active-open`, resource: ACTIVE_OPEN_PERIOD_CONSENT },
                { fullUrl: `${baseUrl}/Consent/consent-expired-1`, resource: EXPIRED_CONSENT },
                { fullUrl: `${baseUrl}/Consent/consent-future-1`, resource: FUTURE_CONSENT },
                { fullUrl: `${baseUrl}/Consent/consent-inactive-1`, resource: INACTIVE_CONSENT },
                { fullUrl: `${baseUrl}/Consent/consent-other-patient`, resource: OTHER_PATIENT_CONSENT },
                {
                  resource: {
                    resourceType: "OperationOutcome",
                    id: "oo-info",
                    issue: [{ severity: "information", code: "informational", diagnostics: "Search completed" }],
                  },
                },
              ],
            },
            { headers: { "content-type": FHIR_JSON_MEDIA_TYPE } },
          );
        }

        if (url.pathname === "/error-503/Consent") {
          return new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" });
        }

        if (url.pathname === "/malformed-json/Consent") {
          return new Response("{not valid json", {
            status: 200,
            headers: { "content-type": FHIR_JSON_MEDIA_TYPE },
          });
        }

        if (url.pathname === "/wrong-bundle-type/Consent") {
          return Response.json({
            resourceType: "Bundle",
            type: "collection",
            entry: [],
          });
        }

        if (url.pathname === "/error-outcome/Consent") {
          return Response.json({
            resourceType: "Bundle",
            type: "searchset",
            entry: [
              {
                resource: {
                  resourceType: "OperationOutcome",
                  id: "oo-err",
                  issue: [{ severity: "error", code: "Forbidden" }],
                },
              },
            ],
          });
        }

        if (url.pathname === "/slow/Consent") {
          await new Promise((resolve) => setTimeout(resolve, 250));
          return Response.json({
            resourceType: "Bundle",
            type: "searchset",
            entry: [],
          });
        }

        return new Response("Not Found", { status: 404 });
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}/fhir`;
  });

  afterAll(() => {
    server.stop(true);
  });

  test("findsActiveIgnoresOthers", async () => {
    const result = await findAccessConsents({
      baseUrl,
      patient: "Patient/pat-1",
      actor: "Practitioner/prac-1",
      purpose: "TREAT",
      now: NOW_ISO,
      headers: { Authorization: "Bearer test-token" },
    });

    expect(result.status).toBe("determined");
    if (result.status !== "determined") throw new Error("expected determined");

    expect(result.consents.map((c) => c.id)).toEqual(["consent-active-1", "consent-active-open"]);
    expect(result.consents[0]?.meta?.versionId).toBe("1");
    expect(result.consents[0]?.meta?.profile).toContain(PCF_CONSENT_PROFILE_URLS.basic);

    const ignoredByReason = new Map(result.ignored.map((i) => [i.id, i.reason]));
    expect(ignoredByReason.get("consent-expired-1")).toBe("expired");
    expect(ignoredByReason.get("consent-future-1")).toBe("not-yet-valid");
    expect(ignoredByReason.get("consent-inactive-1")).toBe("not-active");
    expect(ignoredByReason.get("consent-other-patient")).toBe("patient-mismatch");
    expect(ignoredByReason.get("oo-info")).toBe("operation-outcome");

    expect(lastRequestHeaders?.get("accept")).toBe(FHIR_JSON_MEDIA_TYPE);
    expect(lastRequestHeaders?.get("authorization")).toBe("Bearer test-token");
    expect(lastRequestUrl?.searchParams.get("patient")).toBe("Patient/pat-1");
    expect(lastRequestUrl?.searchParams.get("status")).toBe("active");
    expect(lastRequestUrl?.searchParams.get("actor")).toBe("Practitioner/prac-1");
    expect(lastRequestUrl?.searchParams.get("purpose")).toBe("TREAT");
  });

  test("followsNextLinks", async () => {
    const client = new Iti108ConsentClient(baseUrl, { now: NOW_ISO });
    const result = await client.findAccessConsents({ patient: "Patient/page-test" });

    expect(result.status).toBe("determined");
    if (result.status !== "determined") throw new Error("expected determined");
    expect(result.consents.map((c) => c.id)).toEqual(["consent-page-1", "consent-page-2"]);
    expect(result.bundleTotal).toBe(2);
  });

  test("emptyBundleIsDeterminedEmpty", async () => {
    const result = await findAccessConsents({
      baseUrl,
      patient: "Patient/empty",
      now: NOW_ISO,
    });

    expect(result.status).toBe("determined");
    if (result.status !== "determined") throw new Error("expected determined");
    expect(result.consents).toEqual([]);
    expect(result.ignored).toEqual([]);
    expect(result.bundleTotal).toBe(0);
  });

  test("connectionRefusedIsUnreachable", async () => {
    // Ephemeral server started and immediately stopped to guarantee a closed local port.
    const deadServer = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch() {
        return new Response("ok");
      },
    });
    const closedPort = deadServer.port;
    deadServer.stop(true);

    const result = await findAccessConsents({
      baseUrl: `http://127.0.0.1:${closedPort}/fhir`,
      patient: "Patient/pat-1",
      now: NOW_ISO,
      timeoutMs: 2_000,
    });

    expect(result.status).toBe("unknown");
    if (result.status !== "unknown") throw new Error("expected unknown");
    expect(result.reason).toBe("unreachable");
    expect(result.requestUrl).toContain(`/Consent?`);
  });

  test("slowServerIsTimeout", async () => {
    const result = await findAccessConsents({
      baseUrl: `http://127.0.0.1:${server.port}/slow`,
      patient: "Patient/pat-1",
      now: NOW_ISO,
      timeoutMs: 40,
    });

    expect(result.status).toBe("unknown");
    if (result.status !== "unknown") throw new Error("expected unknown");
    expect(result.reason).toBe("timeout");
  });

  test("http503IsHttpError", async () => {
    const result = await findAccessConsents({
      baseUrl: `http://127.0.0.1:${server.port}/error-503`,
      patient: "Patient/pat-1",
      now: NOW_ISO,
    });

    expect(result.status).toBe("unknown");
    if (result.status !== "unknown") throw new Error("expected unknown");
    expect(result.reason).toBe("http-error");
    expect(result.httpStatus).toBe(503);
  });

  test("badJsonOrBundleIsUnknown", async () => {
    const badJson = await findAccessConsents({
      baseUrl: `http://127.0.0.1:${server.port}/malformed-json`,
      patient: "Patient/pat-1",
      now: NOW_ISO,
    });
    expect(badJson.status).toBe("unknown");
    if (badJson.status === "unknown") {
      expect(badJson.reason).toBe("invalid-json");
    }

    const wrongBundle = await findAccessConsents({
      baseUrl: `http://127.0.0.1:${server.port}/wrong-bundle-type`,
      patient: "Patient/pat-1",
      now: NOW_ISO,
    });
    expect(wrongBundle.status).toBe("unknown");
    if (wrongBundle.status === "unknown") {
      expect(wrongBundle.reason).toBe("invalid-bundle");
    }

    const errorOutcome = await findAccessConsents({
      baseUrl: `http://127.0.0.1:${server.port}/error-outcome`,
      patient: "Patient/pat-1",
      now: NOW_ISO,
    });
    expect(errorOutcome.status).toBe("unknown");
    if (errorOutcome.status === "unknown") {
      expect(errorOutcome.reason).toBe("invalid-bundle");
    }
  });

  test("buildsSearchUrlAndDateOnlyPeriod", () => {
    const url = buildIti108SearchUrl({
      baseUrl: "https://registry.example.org/fhir/",
      patient: "Patient/pat-1",
      patientIdentifier: "urn:oid:1.2.3|999",
      actor: ["Practitioner/p1", "Organization/o1"],
      purpose: "TREAT",
      category: "http://loinc.org|59284-0",
      securityLabel: "R",
      profile: PCF_CONSENT_PROFILE_URLS.basic,
    });
    expect(url.pathname).toBe("/fhir/Consent");
    expect(url.searchParams.get("patient")).toBe("Patient/pat-1");
    expect(url.searchParams.get("patient.identifier")).toBe("urn:oid:1.2.3|999");
    expect(url.searchParams.get("status")).toBe("active");
    expect(url.searchParams.getAll("actor")).toEqual(["Practitioner/p1", "Organization/o1"]);
    expect(url.searchParams.get("_profile")).toBe(PCF_CONSENT_PROFILE_URLS.basic);

    const sameDayConsent: FhirConsent = {
      ...ACTIVE_VALID_CONSENT,
      provision: {
        type: "permit",
        period: { start: "2026-10-01", end: "2026-10-30" },
      },
    };
    expect(isConsentExpired(sameDayConsent, "2026-10-30T18:00:00Z")).toBe(false);
    expect(isConsentExpired(sameDayConsent, "2026-10-31T00:00:00Z")).toBe(true);
    expect(evaluateConsentValidity(sameDayConsent, "2026-10-30T18:00:00Z", "pat-1")).toEqual({ valid: true });
  });
});
