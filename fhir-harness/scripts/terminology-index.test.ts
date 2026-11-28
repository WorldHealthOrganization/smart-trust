/**
 * The site's terminology index, from a fixture of the IG Publisher's own
 * cache: a synthetic IG, and codes that stand for no real one.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildIndex, expansionsOf, GZIP_OVER, parseTxCache, preExpand, ucumRows, writeIndex } from "./terminology-index.ts";

const made: string[] = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "term-"));
  made.push(d);
  return d;
};

const L = "http://loinc.org";
const DASH = "-".repeat(85);
// The shape of a Publisher txcache file: a request, ####, then results.
const CACHE = [
  "",
  DASH,
  '{"code" : {\n  "system" : "http://loinc.org",\n  "code" : "1000-1"\n}, "valueSet" :null, "langs":"en"}####',
  'v: {\n  "display" : "Body weight",\n  "code" : "1000-1",\n  "system" : "http://loinc.org",\n  "version" : "2.77"\n}',
  DASH,
  '{"code" : {"system" : "http://loinc.org", "code" : "9999-9"}}####',
  'v: {\n  "severity" : "error",\n  "error" : "Unknown code 9999-9"\n}',
  DASH,
  '{"hierarchical" : false, "valueSet" :{"resourceType":"ValueSet","url":"http://example.org/ig/ValueSet/yn"}}####',
  'e: {\n  "valueSet" : {"resourceType":"ValueSet","url":"http://example.org/ig/ValueSet/yn","expansion":{"contains":[{"system":"http://example.org/cs","code":"y","display":"Yes {x}"},{"system":"http://example.org/cs","code":"n","display":"No"}]}}\n}',
  DASH,
  "",
].join("\n");

const EXPANSIONS = {
  resourceType: "Bundle",
  entry: [
    { resource: { resourceType: "ValueSet", url: "http://example.org/ig/ValueSet/sex", version: "0.1.0", expansion: { contains: [{ system: "http://example.org/cs", code: "f", display: "Female" }, { abstract: true, code: "grp", contains: [{ system: "http://example.org/cs", code: "m", display: "Male" }] }] } } },
    { resource: { resourceType: "ValueSet", url: "http://example.org/ig/ValueSet/obs", expansion: { contains: [{ system: L, code: "2000-2", display: "Heart rate" }] } } },
  ],
};

function fixture(): { expansions: string; txcache: string } {
  const d = tmp();
  const expansions = join(d, "expansions.json");
  writeFileSync(expansions, JSON.stringify(EXPANSIONS));
  mkdirSync(join(d, "txcache", "sub"), { recursive: true });
  writeFileSync(join(d, "txcache", "tx.fhir.org.4.0.1.cache"), "http://tx.fhir.org\n" + CACHE);
  writeFileSync(join(d, "txcache", "sub", "ignored.json"), "{}");
  return { expansions, txcache: join(d, "txcache") };
}

describe("the Publisher's txcache", () => {
  test("txcacheCodesAndValueSets", () => {
    const t = parseTxCache(CACHE + "\n####\nv: {not json\n");
    expect(t.codes).toEqual([[L, "1000-1", "Body weight"]]);
    expect(t.valueSets.map((v) => v.url)).toEqual(["http://example.org/ig/ValueSet/yn"]);
  });
});

describe("buildIndex", () => {
  test("buildIndexCodesAndValueSets", () => {
    const i = buildIndex(fixture());
    expect(i.codes).toContainEqual([L, "1000-1", "Body weight"]);
    expect(i.codes).toContainEqual([L, "2000-2", "Heart rate"]);
    expect(i.codes.filter((r) => r[1] === "f")).toHaveLength(1);
    expect(i.codes.some((r) => r[1] === "grp")).toBe(false);
    const sex = i.valueSets["http://example.org/ig/ValueSet/sex|0.1.0"]!.map((n) => i.codes[n]![1]);
    expect(sex).toEqual(["f", "m"]);
    expect(i.valueSets["http://example.org/ig/ValueSet/sex"]).toEqual(i.valueSets["http://example.org/ig/ValueSet/sex|0.1.0"]!);
    expect(i.valueSets["http://example.org/ig/ValueSet/yn"]).toHaveLength(2);
    expect(i.sources).toMatchObject({ valueSets: 2, txcacheFiles: 1 });
  });
  test("noCacheEmptyIndex", () => {
    expect(buildIndex({ txcache: join(tmp(), "absent") }).codes).toEqual([]);
  });
});

describe("writeIndex", () => {
  test("smallIndexPlainJson", () => {
    const out = tmp();
    const w = writeIndex(buildIndex(fixture()), out);
    expect(w.file).toBe("index.json");
    const back = JSON.parse(readFileSync(join(out, w.file), "utf-8"));
    expect(back.sources.expansions).toBe("expansions.json");
    expect(JSON.stringify(back)).not.toContain(tmpdir());
  });
  test("largeIndexGzipped", () => {
    const out = tmp();
    const big = { $schema: "fhir-harness-terminology-index/v1" as const, sources: { valueSets: 0, txcacheFiles: 0 }, codes: Array.from({ length: GZIP_OVER / 20 }, (_, n): [string, string, string] => [L, `${n}-0`, "x".repeat(10)]), valueSets: {} };
    const w = writeIndex(big, out);
    expect(w.file).toBe("index.json.gz");
    expect(JSON.parse(gunzipSync(readFileSync(join(out, w.file))).toString()).codes).toHaveLength(big.codes.length);
  });
});

test("fullUcumList", () => {
  const rows = ucumRows(JSON.parse(readFileSync(join(import.meta.dir, "assets/vendor/ucum-lhc/8.0.0/ucumDefs.min.json"), "utf-8")));
  expect(rows.length).toBeGreaterThan(700);
  expect(rows.find((r) => r[0] === "g")!.slice(0, 2)).toEqual(["g", "gram"]);
  expect(rows.find((r) => r[0] === "mm[Hg]")).toBeDefined();
});

describe("preExpand: the rendered copy only", () => {
  const q = {
    resourceType: "Questionnaire",
    contained: [{ resourceType: "ValueSet", id: "local", expansion: { contains: [{ code: "a", display: "A" }] } }],
    item: [
      { linkId: "1", type: "choice", answerValueSet: "http://example.org/ig/ValueSet/sex|0.1.0" },
      { linkId: "g", type: "group", item: [{ linkId: "2", type: "choice", answerValueSet: "http://example.org/ig/ValueSet/unknown" }] },
      { linkId: "3", type: "choice", answerValueSet: "#local" },
      { linkId: "4", type: "choice", answerValueSet: "http://example.org/ig/ValueSet/sex", answerOption: [{ valueString: "kept" }] },
    ],
  };
  test("preExpandRenderedCopy", () => {
    const before = JSON.stringify(q);
    const r = preExpand(q, expansionsOf(EXPANSIONS));
    expect(r.expanded).toEqual(["1", "3"]);
    expect(r.missing).toEqual(["2"]);
    expect(r.questionnaire.item[0].answerOption).toEqual([
      { valueCoding: { system: "http://example.org/cs", code: "f", display: "Female" } },
      { valueCoding: { system: "http://example.org/cs", code: "m", display: "Male" } },
    ]);
    expect(r.questionnaire.item[0].answerValueSet).toBeUndefined();
    expect(r.questionnaire.item[3].answerOption).toEqual([{ valueString: "kept" }]);
    expect(JSON.stringify(q)).toBe(before);
  });
});
