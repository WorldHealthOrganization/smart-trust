/**
 * The MeSH authority stage over a FIXTURE authority: the responses below are
 * the shapes id.nlm.nih.gov returned on 2026-11-10, cut down to what is read.
 * No test reaches the network.
 */
import { describe, expect, test } from "bun:test";
import { entryTermQuery, reportTable, validate, type JsonGet } from "./mesh-authority.ts";

const MEASLES = { resource: "http://id.nlm.nih.gov/mesh/D008457", label: "Measles" };
const VACCINE = { resource: "http://id.nlm.nih.gov/mesh/D008458", label: "Measles Vaccine" };
const DETAILS: Record<string, unknown> = {
  D008457: { terms: [{ label: "Measles", preferred: true }, { label: "Rubeola", preferred: false }], qualifiers: [{ resource: "http://id.nlm.nih.gov/mesh/Q000517", label: "prevention & control" }] },
  D008458: { terms: [{ label: "Measles Vaccine", preferred: true }], qualifiers: [{ resource: "http://id.nlm.nih.gov/mesh/Q000008", label: "administration & dosage" }] },
};
const sparql = (rows: { d: string; dl: string }[]) => ({ results: { bindings: rows.map((r) => ({ d: { value: r.d }, dl: { value: r.dl } })) } });

const get: JsonGet = async (url) => {
  const u = new URL(url);
  if (u.pathname.endsWith("/lookup/descriptor")) {
    const l = u.searchParams.get("label");
    return l === "Measles" ? [MEASLES] : l === "Measles Vaccine" ? [VACCINE] : l === "Twins" ? [MEASLES, VACCINE] : [];
  }
  if (u.pathname.endsWith("/sparql")) {
    return (u.searchParams.get("query") ?? "").includes('"Rubeola"@en') ? sparql([{ d: MEASLES.resource, dl: "Measles" }]) : sparql([]);
  }
  if (u.pathname.endsWith("/lookup/details")) return DETAILS[u.searchParams.get("descriptor") ?? ""] ?? { terms: [], qualifiers: [] };
  throw new Error(`unexpected ${url}`);
};
const at = () => new Date("2026-11-10T00:00:00Z");

describe("validate", () => {
  test("resolvedWithAllowableQualifier", async () => {
    const r = await validate([{ label: "Measles", qualifier: "Prevention & Control" }], get, at);
    expect(r.results[0]!.status).toBe("resolved");
    expect(r.validated).toEqual([{ descriptor: "D008457", label: "Measles", qualifier: "prevention & control" }]);
  });
  test("entryTermBecomesPreferredHeading", async () => {
    const r = await validate([{ label: "Rubeola" }], get, at);
    expect(r.results[0]).toMatchObject({ status: "resolved", viaEntryTerm: true, descriptor: { id: "D008457", label: "Measles" } });
  });
  test("notFoundIsDroppedNeverEmitted", async () => {
    const r = await validate([{ label: "Flibbertigibbet syndrome" }, { descriptor: "not-an-id" }], get, at);
    expect(r.results.map((x) => x.status)).toEqual(["not-found", "not-found"]);
    expect(r.validated).toEqual([]);
  });
  test("ambiguousListsOptionsAndEmitsNothing", async () => {
    const r = await validate([{ label: "Twins" }], get, at);
    expect(r.results[0]!.status).toBe("ambiguous");
    expect(r.results[0]!.options!.map((o) => o.id)).toEqual(["D008457", "D008458"]);
    expect(r.validated).toEqual([]);
  });
  test("disallowedQualifierKeepsDescriptorOnly", async () => {
    const r = await validate([{ label: "Measles Vaccine", qualifier: "surgery" }], get, at);
    expect(r.results[0]!.status).toBe("qualifier-not-allowed");
    expect(r.validated).toEqual([{ descriptor: "D008458", label: "Measles Vaccine" }]);
  });
  test("descriptorIdIsCheckedAgainstTheAuthority", async () => {
    const r = await validate([{ descriptor: "D008457" }, { descriptor: "D999999" }], get, at);
    expect(r.results.map((x) => x.status)).toEqual(["resolved", "not-found"]);
  });
});

describe("helpers", () => {
  test("entryTermQueryQuotesTheLabel", () => {
    expect(entryTermQuery('a "b"')).toContain('"a \\"b\\""@en');
  });
  test("reportTableHasOneRowPerCandidateAndEscapesBars", async () => {
    const r = await validate([{ label: "Measles" }, { label: "x | y" }], get, at);
    const t = reportTable(r).split("\n");
    expect(t).toHaveLength(4);
    expect(t[3]).toContain("x \\| y");
  });
});
