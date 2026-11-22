/**
 * The fictional countries a workshop room may rename — owner, 2026-11-17.
 *
 * @module cat-harness-tools/test/journeys-countries.test
 * @graphNode none — a test
 *
 * When the workshop declares its architecture's countries, those are the
 * countries: a chapter's `country` that names a setting rather than a country
 * ("Cross-Border") gets no renaming box. Without a declaration, the chapters'
 * countries are used, in order, once each.
 */
import { describe, expect, test } from "bun:test";

import { countriesOf, type Presentation } from "../scripts/journeys/present.ts";

const chapter = (country: string) => ({ journey: { scenario: { country } } });
const pres = (countries: string[], declared?: string[]): Presentation =>
  ({
    chapters: countries.map(chapter),
    w: { workshop: { presentation: declared ? { architecture: { countries: declared.map((label) => ({ label })) } } : {} } },
  }) as unknown as Presentation;

describe("countriesOf", () => {
  test("the declared architecture countries, not a chapter's setting", () => {
    expect(countriesOf(pres(["Onesa", "Cross-Border", "Taifafeki"], ["Onesa", "Taifafeki"]))).toEqual(["Onesa", "Taifafeki"]);
  });
  test("without a declaration, the chapters' countries in order, once each", () => {
    expect(countriesOf(pres(["Onesa", "Taifafeki", "Onesa"]))).toEqual(["Onesa", "Taifafeki"]);
  });
  test("an empty declaration falls back to the chapters", () => {
    expect(countriesOf(pres(["Onesa"], []))).toEqual(["Onesa"]);
  });
});
