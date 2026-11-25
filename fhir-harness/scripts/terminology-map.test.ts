/**
 * The service worker's request → response mapping, as a pure function: every
 * cross-site request the Form Builder or LHC-Forms makes is answered from this
 * site, and none goes to the network.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "./terminology-map.js";

type Answer = { kind: string; status?: number; body?: unknown; type?: string; path?: string } | null;
const { answer, NOT_IN_CACHE } = (globalThis as unknown as { faTerminologyMap: { answer: (u: string, c: object) => Answer; NOT_IN_CACHE: string } }).faTerminologyMap;

const L = "http://loinc.org";
const ctx = {
  origin: "https://o.github.io",
  index: { codes: [[L, "1000-1", "Body weight"], [L, "2000-2", "Heart rate"], ["http://example.org/cs", "f", "Female"]] },
  ucum: [["kg", "kilogram", "", "kilograms", "kg"], ["mm[Hg]", "millimeter of mercury", "blood pressure", "", "mm Hg"], ["g", "gram", "", "grams; gm", "g"]],
  lhcBase: "https://o.github.io/ig/assets/lhc-forms/44.1.0/",
  lhcVersion: "44.1.0",
};
const CT = "https://clinicaltables.nlm.nih.gov/api";

describe("LOINC: only what the IG's cache holds", () => {
  test("loincItemSearchCtss", () => {
    const a = answer(`${CT}/loinc_items/v3/search?df=text,LONG_COMMON_NAME,COMPONENT,SHORTNAME,CONSUMER_NAME&type=question&terms=body%20we&maxList=10`, ctx);
    expect(a).toEqual({ kind: "json", status: 200, body: [1, ["1000-1"], null, [["Body weight", "Body weight", "Body weight", "Body weight", "Body weight"]]] });
  });
  test("loincByCodeOnly", () => {
    expect(answer(`${CT}/loinc_items/v3/search?df=text,LOINC_NUM&terms=2000-2`, ctx)!.body).toEqual([1, ["2000-2"], null, [["Heart rate", "2000-2"]]]);
    expect((answer(`${CT}/loinc_items/v3/search?df=text,LOINC_NUM&terms=female`, ctx)!.body as unknown[])[3]).toEqual([[NOT_IN_CACHE, ""]]);
  });
  test("notInCacheSaysSo", () => {
    const a = answer(`${CT}/loinc_items/v3/search?df=text,LOINC_NUM&terms=glucose`, ctx);
    expect(a!.body).toEqual([1, [""], null, [[NOT_IN_CACHE, ""]]]);
    expect(NOT_IN_CACHE).toBe("not in this IG's terminology cache; add it via the FSH source");
  });
  test("noIndexSameAnswer", () => {
    expect((answer(`${CT}/loinc_items/v3/search?terms=x`, { ...ctx, index: null })!.body as unknown[])[3]).toEqual([[NOT_IN_CACHE, ""]]);
  });
});

describe("UCUM: the full list", () => {
  test("ucumSearchPagingFields", () => {
    expect(answer(`${CT}/ucum/v3/search?df=cs_code,name,guidance&terms=mm`, ctx)!.body).toEqual([1, ["mm[Hg]"], null, [["mm[Hg]", "millimeter of mercury", "blood pressure"]]]);
    // A term matches the start of a word: "gram" finds g, not kilogram.
    expect(answer(`${CT}/ucum/v3/search?df=cs_code&terms=gram&ef=name`, ctx)!.body).toEqual([1, ["g"], { name: ["gram"] }, [["g"]]]);
    expect(answer(`${CT}/ucum/v3/search?df=cs_code&maxList=1&offset=1`, ctx)!.body).toEqual([3, ["mm[Hg]"], null, [["mm[Hg]"]]]);
  });
});

describe("LHC-Forms, served from this site", () => {
  test("lhcVersionListing", () => {
    expect(answer("https://lhcforms-static.nlm.nih.gov/lforms-versions/", ctx)).toMatchObject({ kind: "text", status: 200, body: expect.stringContaining(">lforms-44.1.0.zip<") });
    expect(answer("https://lhcforms-static.nlm.nih.gov/lforms-versions/44.1.0/webcomponent/lhc-forms.js", ctx)).toEqual({ kind: "local", path: `${ctx.lhcBase}webcomponent/lhc-forms.js` });
    expect(answer("https://lhcforms-static.nlm.nih.gov/lforms-versions/34.3.0/webcomponent/lhc-forms.js", ctx)!.status).toBe(404);
  });
});

describe("everything else is a local error, never the network", () => {
  test.each([
    ["https://lforms-fhir.nlm.nih.gov/baseR4/Questionnaire/x", "Import from and export to a FHIR server"],
    [`${CT.replace("/api", "")}/loinc_form_definitions?loinc_num=1`, "LOINC forms"],
    ["https://fonts.gstatic.com/s/roboto/x.woff2", "https://fonts.gstatic.com"],
    ["https://snomedbrowser.org/fhir/CodeSystem", "https://snomedbrowser.org"],
  ])("localErrorNeverNetwork[%s]", (url, says) => {
    const a = answer(url, ctx) as { kind: string; status: number; body: { resourceType: string; issue: { diagnostics: string }[] } };
    expect(a.kind).toBe("json");
    expect(a.status).toBe(503);
    expect(a.body.issue[0]!.diagnostics).toContain(says);
    expect(a.body.issue[0]!.diagnostics).toContain("disabled on this site");
  });
  test("ownRequestsUntouched", () => {
    expect(answer("https://o.github.io/ig/assets/terminology/index.json", ctx)).toBeNull();
  });
  test("swNeverForwardsCrossOrigin", () => {
    const sw = readFileSync(join(import.meta.dir, "terminology-sw.js"), "utf-8");
    expect(sw).not.toContain("fetch(e.request)");
    expect(sw).toContain("status: 503");
  });
});
