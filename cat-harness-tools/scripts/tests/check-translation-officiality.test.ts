/**
 * Officiality in two places must agree (cat-tools-bbnd). Each case is one rule.
 */
import { describe, expect, test } from "bun:test";

import { officialityFindings } from "../check-translation-officiality.ts";

const cat = (official?: string) => ({ path: "fr/x.po", official });

describe("officialityFindings", () => {
  test("silence on both sides is consistent: unofficial", () => {
    expect(officialityFindings({ dir: "fr", status: undefined, catalogues: [cat()] })).toEqual([]);
    expect(officialityFindings({ dir: "fr", status: { official: false }, catalogues: [cat("no")] })).toEqual([]);
  });

  test("both saying official, with a person named, agree", () => {
    const status = { official: true, signedOffBy: "litlfred", signedOffAt: "2026-10-11T00:00:00Z" };
    expect(officialityFindings({ dir: "fr", status, catalogues: [cat("yes")] })).toEqual([]);
  });

  test("status.json official but a catalogue not: disagree, naming the catalogue", () => {
    const status = { official: true, signedOffBy: "a", signedOffAt: "t" };
    const f = officialityFindings({ dir: "fr", status, catalogues: [cat("yes"), { path: "fr/y.po", official: undefined }] });
    expect(f).toEqual([{ severity: "disagree", where: "fr/y.po", detail: expect.stringContaining("(absent)") }]);
  });

  test("a catalogue saying yes with no status.json: disagree", () => {
    expect(officialityFindings({ dir: "fr", status: undefined, catalogues: [cat("yes")] })[0]).toMatchObject({ severity: "disagree", detail: expect.stringContaining("is absent") });
  });

  test("official with nobody named is its own finding", () => {
    const f = officialityFindings({ dir: "fr", status: { official: true }, catalogues: [cat("yes")] });
    expect(f.map((x) => x.severity)).toEqual(["unnamed"]);
  });

  test("an unreadable status.json is unreadable, never a pass", () => {
    expect(officialityFindings({ dir: "fr", status: null, catalogues: [cat("yes")] })).toEqual([
      { severity: "unreadable", where: "fr/status.json", detail: "status.json will not parse" },
    ]);
  });
});
