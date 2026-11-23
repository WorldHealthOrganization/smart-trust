import { describe, expect, test } from "bun:test";

import { cellValue, fieldHeading, lightenDataElements, linkKindLabels, structuredAssetsBody, type StructuredAsset } from "./structured-assets.ts";

const fr: StructuredAsset = { kind: "functional-requirement", label: "freq:FR-AN-01", id: "FR-AN-01", title: "Standard reports", section: "7.5 Analytics", fields: { priority: "must" }, personas: [] };
const pers: StructuredAsset = { kind: "persona", label: "pers:officer", title: "Registration officer", section: "5.1 Personas", fields: { personaType: "person" }, personas: [] };
const scen: StructuredAsset = { kind: "user-scenario", label: "scen:renew", title: "Renew a licence", section: "5.2", fields: {}, personas: ["pers:officer"] };

describe("the structured-assets page", () => {
  const html = structuredAssetsBody("DTH", [pers, scen, fr]);
  test("oneTablePerKind", () => {
    expect(html.indexOf('id="persona"')).toBeLessThan(html.indexOf('id="user-scenario"'));
    expect(html.indexOf('id="user-scenario"')).toBeLessThan(html.indexOf('id="functional-requirement"'));
    expect(html).toContain("Functional requirements");
    expect(html).toContain('<span class="fa-assets-count">1</span>');
  });
  test("rowsLinkCards", () => {
    expect(html).toContain('<a class="fa-block-id" href="../#freq%3AFR-AN-01">FR-AN-01</a>');
    expect(html).toContain('<a href="../#pers%3Aofficer">Registration officer</a>');
  });
  test("scenarioPersonasLinked", () => {
    expect(html).toMatch(/Renew a licence<\/a><\/td><td><a href="\.\.\/#pers%3Aofficer">Registration officer<\/a>/);
  });
  test("metaFieldsColumns", () => {
    expect(html).toContain(">Priority<");
    expect(html).toContain(">Persona type<");
    expect(fieldHeading("minimumDataSet")).toBe("Minimum data set");
  });
});

describe("kind labels link to the assets page", () => {
  const card = (kind: string) => `<div class="fa-block fa-block-${kind}" markdown="1">\n<p><a id="x"></a>\n<span class="fa-block-kind">K</span> text</p>\n</div>`;
  test("listedKindLinks", () => {
    expect(linkKindLabels(card("persona"), new Set(["persona"]))).toContain('<a class="fa-block-kind" href="assets/#persona"');
  });
  test("unlistedKindPlain", () => {
    expect(linkKindLabels(card("remark"), new Set(["persona"]))).toContain('<span class="fa-block-kind">K</span>');
  });
});

describe("data element cards stay light", () => {
  const de = (name: string) =>
    `<div class="fa-block fa-block-data-element" markdown="1">\n<p><a id="de:x"></a>\n<span class="fa-block-kind">Data element</span> <strong>${name}</strong> — element 8.</p>\n<table><tr><td>to draft</td></tr></table>\n</div>`;
  const glossary = [{ label: "Employment status: full-time, part-time", href: "../glossary/es/", title: "How a worker is employed." }];
  test("tableFoldsBehindDetails", () => {
    const h = lightenDataElements(de("Name"));
    expect(h).toContain('<details class="fa-block-details"><summary>Technical details</summary>\n<table>');
  });
  test("nameLinksGlossary", () => {
    expect(lightenDataElements(de("Employment status"), glossary)).toContain('<strong><a href="../glossary/es/" title="How a worker is employed.">Employment status</a></strong>');
  });
  test("noEntryNoLink", () => {
    expect(lightenDataElements(de("Name"), glossary)).toContain("<strong>Name</strong>");
    const p = '<div class="fa-block fa-block-persona"><table></table></div>';
    expect(lightenDataElements(p, glossary)).toBe(p);
  });
});

describe("cellValue", () => {
  test("enumValuesAreTags", () => {
    expect(cellValue("HealthcareProvider; CommunityHealthWorker")).toBe(
      '<span class="fa-assets-tag">HealthcareProvider</span> <span class="fa-assets-tag">CommunityHealthWorker</span>',
    );
    expect(cellValue("person")).toBe('<span class="fa-assets-tag">person</span>');
    expect(cellValue("to be set")).toBe("to be set");
    expect(cellValue("")).toBe("");
  });
});

describe("indicators", () => {
  const ind = (n: string, extra: Record<string, string> = {}): StructuredAsset => ({
    kind: "indicator", label: `ind:${n}`, id: n, title: `Indicator ${n}`, section: "NHWA", personas: [],
    fields: { module: "1", numerator: "Active health workers", denominator: "Total population", definition: "Long text", ...extra },
  });
  test("indicatorColumns", () => {
    const html = structuredAssetsBody("Doc", [ind("1-01", { disaggregation: "sex; age" }), ind("1-02")]);
    const head = /<section class="fa-assets-kind" aria-labelledby="indicator">[\s\S]*?<\/thead>/.exec(html)![0];
    expect([...head.matchAll(/<button type="button">([^<]+)</g)].map((m) => m[1])).toEqual(["Id", "Title", "Module", "Numerator", "Denominator", "Disaggregation", "Section"]);
    expect(html).toContain('<span class="fa-assets-tag">sex</span> <span class="fa-assets-tag">age</span>');
    expect(html).not.toContain("Long text");
  });
});
