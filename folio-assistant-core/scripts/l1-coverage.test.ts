/**
 * l1-coverage — issue #2405 FR-009, contract methodologies/l1-coverage.md.
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { coverage, exitCodeFor, markersOf, parsePages, reasonProblem, sentencesOf } from "./l1-coverage";

const SCRIPT = resolve(import.meta.dir, "l1-coverage.ts");

const PAGES = [
  { page: 1, text: "Measles is a highly contagious disease. All children should receive two doses of measles vaccine. WHO recommends that the first dose be given at 9 months." },
  { page: 2, text: "All regions should have eliminated measles by 2020. HIV infection is not a reason to withhold vaccination. Further studies should assess duration of protection." },
  { page: 3, text: "Coverage data are reported annually." },
];
const CAPTURED = [
  { id: "rec-1", text: "All children should receive two doses of measles vaccine." },
  { id: "rec-2", text: "WHO recommends that the first dose be given at 9 months" },
  { id: "rec-3", text: "HIV infection is not a reason to withhold vaccination." },
];

describe("the marker list is closed (contract §1)", () => {
  it("countsListedMarkers", () => {
    expect(markersOf("Children should be vaccinated.")).toEqual(["obligation"]);
    expect(markersOf("WHO recommends this.")).toEqual(["recommendation"]);
    expect(markersOf("It may be given at birth.")).toEqual(["permission"]);
    expect(markersOf("Pregnancy is not a reason to delay.")).toEqual(["negation"]);
  });
  it("shouldNotIsNegationBareMayNone", () => {
    expect(markersOf("It should not be given.")).toEqual(["negation"]);
    expect(markersOf("This may be associated with fever.")).toEqual([]);
  });
});

describe("coverage", () => {
  it("capturedUnaccountedPerPage", () => {
    const r = coverage(PAGES, CAPTURED);
    expect(r.totals.normative).toBe(5);
    expect(r.totals.captured).toBe(3);
    expect(r.totals.unaccounted).toBe(2);
    expect(r.pages.find((p) => p.page === 1)?.capturedPct).toBe(100);
    expect(r.pages.find((p) => p.page === 3)?.accountedForPct).toBeNull(); // empty denominator
    expect(exitCodeFor(r)).toBe(1);
  });

  it("signedExclusionAccounts", () => {
    const proposed = coverage(PAGES, CAPTURED, [{ location: "p2:s1", reason: "background-fact" }]);
    expect(proposed.sentences.find((s) => s.location === "p2:s1")?.state).toBe("unaccounted");
    const r = coverage(PAGES, CAPTURED, [
      { location: "p2:s1", reason: "background-fact", signedOffBy: "owner", signedOffAt: "2026-10-07" },
      { text: "Further studies should assess duration of protection.", reason: "research-question", signedOffBy: "owner" },
    ]);
    expect(r.totals.accountedForPct).toBe(100);
    expect(r.totals.capturedPct).toBe(60);
    expect(exitCodeFor(r)).toBe(0);
  });

  it("refusesBadReasons", () => {
    expect(reasonProblem("not-important", new Set())).toContain("not one of the fixed reasons");
    expect(reasonProblem("duplicate-of:rec-9", new Set(["rec-1"]))).toContain("names no captured statement");
    expect(reasonProblem("duplicate-of:rec-1", new Set(["rec-1"]))).toBeNull();
    const r = coverage(PAGES, CAPTURED, [{ location: "p2:s1", reason: "boring", signedOffBy: "x" }]);
    expect(r.problems).toHaveLength(1);
    expect(exitCodeFor(r)).toBe(1);
  });

  it("noNormativeExitZero", () => {
    const r = coverage([{ page: 1, text: "Nothing here binds anyone." }], []);
    expect(r.totals.accountedForPct).toBeNull();
    expect(exitCodeFor(r)).toBe(0);
  });
});

describe("inputs", () => {
  it("formFeedPages", () => {
    expect(parsePages("a\fb\fc").map((p) => p.page)).toEqual([1, 2, 3]);
  });
  it("sentenceSplit", () => {
    expect(sentencesOf("One. Two words.\nThree?")).toEqual(["One.", "Two words.", "Three?"]);
  });
});

describe("CLI", () => {
  it("cliExitsBelowTarget", () => {
    const d = mkdtempSync(join(tmpdir(), "l1cov-"));
    writeFileSync(join(d, "t.json"), JSON.stringify({ pages: PAGES }));
    writeFileSync(join(d, "c.json"), JSON.stringify(CAPTURED));
    const r = spawnSync("bun", ["run", SCRIPT, "--text", join(d, "t.json"), "--captured", join(d, "c.json")], { encoding: "utf8" });
    expect(r.status).toBe(1);
    const rep = JSON.parse(r.stdout);
    for (const k of ["definitionVersion", "source", "graph", "totals", "pages", "sentences", "generatedAt"]) expect(rep).toHaveProperty(k);
    expect(rep.source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
