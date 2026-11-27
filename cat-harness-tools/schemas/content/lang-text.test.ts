/**
 * A glossary label or definition may be a string or a language map
 * (`folio-glossary/v1`, owner option C, 2026-11-18): every reader takes its
 * SOURCE text.
 */
import { describe, expect, test } from "bun:test";

import { schemeSourceLanguage, sourceText, sourceTexts } from "./lang-text.ts";

describe("sourceText", () => {
  test("a string is source text", () => {
    expect(sourceText("Policy")).toBe("Policy");
  });
  test("a language map gives its source entry, wherever it sits", () => {
    expect(sourceText({ fr: "Politique", en: "Policy" })).toBe("Policy");
  });
  test("a declared source language wins over en", () => {
    expect(sourceText({ en: "Policy", fr: "Politique" }, "fr")).toBe("Politique");
  });
  test("a map without the source language falls back to its first entry", () => {
    expect(sourceText({ fr: "Politique", es: "Política" })).toBe("Politique");
  });
  test("JSON-LD value objects, alone or in an array", () => {
    expect(sourceText({ "@value": "Policy", "@language": "en" })).toBe("Policy");
    expect(sourceText([{ "@value": "Politique", "@language": "fr" }, { "@value": "Policy", "@language": "en" }])).toBe("Policy");
  });
  test("nothing usable is undefined, never `[object Object]`", () => {
    expect(sourceText(undefined)).toBeUndefined();
    expect(sourceText({})).toBeUndefined();
    expect(sourceText(42)).toBeUndefined();
  });
});

describe("sourceTexts (altLabel)", () => {
  test("every shape folio-glossary/v1 allows", () => {
    expect(sourceTexts(undefined)).toEqual([]);
    expect(sourceTexts("Participant")).toEqual(["Participant"]);
    expect(sourceTexts(["Participant", "Agent"])).toEqual(["Participant", "Agent"]);
    expect(sourceTexts([{ en: "Participant", fr: "Participant·e" }, "Agent"])).toEqual(["Participant", "Agent"]);
    expect(sourceTexts({ fr: ["Participant·e"], en: ["Participant", "Agent"] })).toEqual(["Participant", "Agent"]);
    expect(sourceTexts({ en: "Participant", fr: "Participant·e" })).toEqual(["Participant"]);
  });
});

describe("schemeSourceLanguage", () => {
  test("declared, or en", () => {
    expect(schemeSourceLanguage({ sourceLanguage: "fr" })).toBe("fr");
    expect(schemeSourceLanguage({})).toBe("en");
    expect(schemeSourceLanguage(null)).toBe("en");
  });
});
