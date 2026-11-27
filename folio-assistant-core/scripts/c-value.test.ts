/**
 * C-value against the worked example of Frantzi & Ananiadou 1996, §3,
 * Table 2: the n-grams containing "Wall Street", with their frequencies,
 * and the C-values the paper gives for them.
 */
import { describe, expect, test } from "bun:test";
import { cValues, countNgrams, rankCandidates, segments } from "./c-value.ts";

const TABLE2: [string, number, number][] = [
  ["staff reporter of the wall street journal", 19, 114],
  ["wall street journal", 26, 37.33],
  ["the wall street journal", 22, 36],
  ["wall street", 38, 33],
  ["the wall street", 23, 31.33],
  ["wall street analysts", 3, 6],
  ["of the wall street journal", 20, 4],
  ["reporter of the wall street", 19, 0],
  ["reporter of the wall street journal", 19, 0],
  ["staff reporter of the wall street", 19, 0],
  ["of the wall street", 20, 0],
];

describe("cValues", () => {
  const rows = new Map(cValues(new Map(TABLE2.map(([g, f]) => [g, f]))).map((r) => [r.term, r]));
  test("reproducesTable2", () => {
    for (const [g, , cv] of TABLE2) expect(rows.get(g)!.cValue).toBeCloseTo(cv, 1);
  });
  test("wallStreetNestingMatchesThePaper", () => {
    // §3 example, step 6: t("Wall Street") = 30 and c("Wall Street") = 6.
    expect(rows.get("wall street")).toMatchObject({ nested: 30, containers: 6 });
  });
});

describe("counting", () => {
  test("segmentsStopAtPunctuationAndSkipCode", () => {
    expect(segments("Heart arrest, then `code here` more.\n\nNext para")).toEqual([["heart", "arrest"], ["then", "more"], ["next", "para"]]);
  });
  test("articleEndingNgramsAreDropped", () => {
    const f = countNgrams(["see the cat. see the cat. see the cat."], { maxLength: 3, minFreq: 1 });
    expect([...f.keys()].sort()).toEqual(["see the cat", "the cat"]);
  });
  const text = Array(3).fill("the knowledge graph holds a knowledge graph node.").join(" ");
  test("nestedTermScoresZeroAsPublished", () => {
    // Leading articles stay, as in the paper's own Table 2 ("The Wall Street Journal"),
    // so "knowledge graph" only ever occurs inside them and scores 0 (case 1).
    const r = rankCandidates([text], { maxLength: 3, minFreq: 3 });
    expect(r.map((x) => x.term)).not.toContain("knowledge graph");
    expect(r.every((x) => x.cValue > 0)).toBe(true);
  });
  test("edgeStopwordsLetTheNestedTermThrough", () => {
    const varied = "the knowledge graph holds nodes. a knowledge graph is large. a knowledge graph grows.";
    // As published: "a knowledge graph" (2) holds two of its three uses, so 1 · (3 − 2/1) = 1.
    expect(rankCandidates([varied], { maxLength: 3, minFreq: 2 }).find((x) => x.term === "knowledge graph")!.cValue).toBe(1);
    const r = rankCandidates([varied], { maxLength: 3, minFreq: 2, edgeStopwords: true });
    expect(r[0]).toMatchObject({ term: "knowledge graph", freq: 3, cValue: 3 });
  });
  test("frontMatterIsNotProse", () => {
    expect(segments("---\nname: x y\n---\nreal words")).toEqual([["real", "words"]]);
  });
});
