import { describe, expect, it } from "bun:test";
import { astFooterData, dayOf, fhirSpecUrl, igFooterData, igSiteFooter, licenseUrl, sushiFooterData } from "./ig-footer.ts";

describe("igFooterData", () => {
  const pkg = {
    name: "hl7.fhir.uv.example",
    version: "1.8.0",
    date: "20261001114021",
    license: "CC-BY-SA-3.0-IGO",
    fhirVersions: ["5.0.0"],
    author: "HL7",
    maintainers: [{ name: "HL7", url: "http://hl7.org" }],
  };
  const ig = { publisher: "HL7 International", contact: [{ telecom: [{ system: "email", value: "x@y" }, { system: "url", value: "https://hl7.org" }] }], fhirVersion: ["5.0.0"], license: "CC-BY-4.0" };

  it("readsFromPackagePreferringIg", () => {
    expect(igFooterData(pkg, ig, {})).toEqual({
      publisher: "HL7 International",
      publisherUrl: "https://hl7.org",
      packageId: "hl7.fhir.uv.example",
      version: "1.8.0",
      fhirVersion: "5.0.0",
      fhirUrl: "http://hl7.org/fhir/R5/",
      generated: "2026-10-01",
      license: "CC-BY-4.0",
      licenseUrl: "https://spdx.org/licenses/CC-BY-4.0.html",
    });
  });

  it("fallsBackToPackageThenIndex", () => {
    expect(igFooterData(pkg, undefined, {}).publisherUrl).toBe("http://hl7.org");
    expect(igFooterData(undefined, undefined, { packageId: "p", version: "1", fhirVersion: ["4.0.1"], builtAt: "20260826120000" })).toEqual({
      packageId: "p",
      version: "1",
      fhirVersion: "4.0.1",
      fhirUrl: "http://hl7.org/fhir/R4/",
      generated: "2026-08-26",
    });
  });

  it("leavesOutUnsourced", () => {
    const d = igFooterData(undefined, undefined, {});
    expect(d).toEqual({});
    expect(JSON.stringify(d)).toBe("{}");
  });
});

describe("the footer's derived links", () => {
  it("fhirReleaseOnlyKnown", () => {
    expect(fhirSpecUrl("4.3.0")).toBe("http://hl7.org/fhir/R4B/");
    expect(fhirSpecUrl("6.0.0-ballot1")).toBeUndefined();
  });
  it("linksSpdxLicence", () => {
    expect(licenseUrl("CC0-1.0")).toBe("https://spdx.org/licenses/CC0-1.0.html");
    expect(licenseUrl("see the IG")).toBeUndefined();
  });
  it("readsBuildStampForms", () => {
    expect(dayOf("2026-10-01T11:40:21+00:00")).toBe("2026-10-01");
    expect(dayOf("20261001114021")).toBe("2026-10-01");
    expect(dayOf("Oct 1")).toBeUndefined();
  });
});

describe("sushiFooterData: the same facts from the IG's source (#1901)", () => {
  it("sushiFooterShapes", () => {
    expect(sushiFooterData({ id: "x.ig", version: "1.0.0", fhirVersion: "4.0.1", publisher: { name: "Org", url: "https://o" }, license: "CC0-1.0", copyrightYear: "2023+" })).toEqual({
      publisher: "Org",
      publisherUrl: "https://o",
      packageId: "x.ig",
      version: "1.0.0",
      fhirVersion: "4.0.1",
      fhirUrl: "http://hl7.org/fhir/R4/",
      license: "CC0-1.0",
      licenseUrl: "https://spdx.org/licenses/CC0-1.0.html",
      copyrightYear: "2023+",
    });
    // A plain-string publisher, a list of FHIR versions, a numeric year.
    expect(sushiFooterData({ packageId: "p", publisher: "Org", fhirVersion: ["5.0.0"], copyrightYear: 2024 })).toMatchObject({ packageId: "p", publisher: "Org", fhirVersion: "5.0.0", copyrightYear: "2024" });
    expect(sushiFooterData({})).toEqual({});
  });
});

describe("igSiteFooter: the Links row names only what the site holds", () => {
  it("linksRowOnlyHeld", () => {
    const f = igSiteFooter({ licenseUrl: "https://l" }, (h) => h === "toc.html" || h === "history.html");
    expect(f.links.map((l) => l.label)).toEqual(["Table of Contents", "Version History", "License"]);
    expect(igSiteFooter({}, () => false).links).toEqual([]);
  });
});

describe("astFooterData: the AST's own build day", () => {
  it("astBuildDayFromManifest", () => {
    expect(astFooterData({ generatedAt: "2026-11-05T17:28:37.464314193Z" })).toEqual({ generated: "2026-11-05" });
    expect(astFooterData({})).toEqual({});
    expect(astFooterData(undefined)).toEqual({});
  });
});
