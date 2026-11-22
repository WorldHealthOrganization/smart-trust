/**
 * The engine checked against the method's own worked example, not against
 * itself. Deerwester et al. (1990), Table 2 and Appendix
 * (`library/deerwester-1990-indexing-by-lsa`, pages 11 and 26–27): nine
 * Bellcore memo titles, twelve index terms, raw frequencies, and the nine
 * singular values the paper prints to two decimals.
 */
import { describe, expect, test } from "bun:test";
import { buildLsi, crossGroupLinks, neighboursOf, query, tokenize } from "./lsi";

// Table 2, the term × document matrix, rows in the paper's order.
const TERMS = ["human", "interface", "computer", "user", "system", "response", "time", "eps", "survey", "trees", "graph", "minors"];
const DOCS = ["c1", "c2", "c3", "c4", "c5", "m1", "m2", "m3", "m4"];
const X = [
  [1, 0, 0, 1, 0, 0, 0, 0, 0],
  [1, 0, 1, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 1, 0, 0, 0, 0],
  [0, 1, 1, 2, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 1, 0, 0, 0, 0],
  [0, 1, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 1, 1],
];
/** Appendix, S0 — printed to two decimals. */
const S0 = [3.34, 2.54, 2.35, 1.64, 1.5, 1.31, 0.85, 0.56, 0.36];

/** Each document as text whose token counts ARE its column of X. */
const units = DOCS.map((id, j) => ({
  id,
  text: TERMS.flatMap((t, i) => Array(X[i][j]).fill(t)).join(" "),
}));

describe("LSI engine against Deerwester et al. (1990)", () => {
  // MIN_TOKENS is a CLI concern; the engine takes the units as given.
  const ix = buildLsi(units, { k: 8, weighting: "raw", minDf: 1, maxDfShare: 1, seed: 1990 });

  test("reads the paper's 12 × 9 matrix", () => {
    expect([...ix.terms].sort()).toEqual([...TERMS].sort());
    expect(ix.unitIds).toEqual(DOCS);
  });

  test("the singular values match the Appendix to the two decimals printed", () => {
    // k = 8 of 9: the ninth is dropped by the min(m, n) − 1 cap.
    ix.singularValues.forEach((s, c) => expect(Math.abs(s - S0[c])).toBeLessThan(0.006));
  });

  test("the paper's query retrieves c3 and c5, which share no term with it", () => {
    // §4.1 and Figure 1: "human computer interaction" in the 2-dimensional
    // space; c1–c5 are near q, m1–m4 are not, and c3/c5 contain neither word.
    const two = buildLsi(units, { k: 2, weighting: "raw", minDf: 1, maxDfShare: 1, seed: 1990 });
    const hits = query(two, "human computer interaction", 9);
    const top5 = hits.slice(0, 5).map((h) => h.id).sort();
    expect(top5).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    for (const m of ["m1", "m2", "m3", "m4"]) expect(hits.find((h) => h.id === m)!.cosine).toBeLessThan(0.5);
  });

  test("is deterministic: the same inputs give the same index", () => {
    const again = buildLsi(units, { k: 8, weighting: "raw", minDf: 1, maxDfShare: 1, seed: 1990 });
    expect(again.singularValues).toEqual(ix.singularValues);
    expect(neighboursOf(again, "c3", 3)).toEqual(neighboursOf(ix, "c3", 3));
  });
});

describe("tokenizer", () => {
  test("a soft hyphen (U+00AD) at a line break joins the word, not splits it", () => {
    // The WHO Handbook's text layer carries 742 of these (2026-09-29).
    expect(tokenize("strong recommenda\u00AD\ntions for organi\u00ADzation")).toEqual(["strong", "recommendations", "organization"]);
  });
});

describe("cross-group link proposals (bean 9udd)", () => {
  // Two groups sharing one topic (cats) and one group about something else.
  const units = [
    { id: "a/1", text: "lion tiger cheetah jaguar savanna prey hunt" },
    { id: "a/2", text: "porsche ferrari engine speed track race car" },
    { id: "b/1", text: "lion tiger cheetah savanna hunt pride prey" },
    { id: "b/2", text: "violin cello orchestra symphony concert music" },
    { id: "c/1", text: "cello violin symphony concert orchestra score" },
    { id: "c/2", text: "engine speed race track porsche car wheel" },
  ];
  const ix = buildLsi(units, { k: 3, weighting: "raw", minDf: 1, maxDfShare: 1, seed: 1990 });
  const r = crossGroupLinks(ix, (id) => id.split("/")[0], { floor: 0.5, perUnit: 1, hubAt: 99 });

  test("never links two units of the same group", () => {
    for (const l of r.links) expect(l.a.split("/")[0]).not.toBe(l.b.split("/")[0]);
  });
  test("proposes the shared topics across groups", () => {
    const pairs = r.links.map((l) => l.a + "~" + l.b);
    expect(pairs).toContain("a/1~b/1");
    expect(pairs).toContain("b/2~c/1");
    expect(pairs).toContain("a/2~c/2");
  });
  test("nothing below the floor is proposed", () => {
    for (const l of r.links) expect(l.cosine).toBeGreaterThanOrEqual(0.5);
    const strict = crossGroupLinks(ix, (id) => id.split("/")[0], { floor: 1.01 });
    expect(strict.links).toEqual([]);
    expect(strict.belowFloor).toBe(6);
  });
});

describe("keywordsOf (issue #2302)", () => {
  // Five units so minDf 2 / maxDfShare 0.5 keep the subject terms.
  const units = [
    { id: "a", text: "Systematic review of the evidence.\nA systematic review pools trials. Anyone takes the systematic review further." },
    { id: "b", text: "Systematic review methods and evidence grading. The systematic review protocol." },
    { id: "c", text: "Wireframe design for mobile apps. Wireframe design tools." },
    { id: "d", text: "Wireframe generation with models. Mobile wireframe layouts. Anyone can sketch." },
    { id: "e", text: "Budget planning and staff time." },
  ];
  test("an adjacent pair said twice is a phrase and covers its words; generic words are not keywords", async () => {
    const { buildTermMatrix, keywordsOf } = await import("./lsi");
    const m = buildTermMatrix(units);
    const terms = keywordsOf(m, [0], [units[0].text], 8).map((k) => k.term);
    expect(terms).toContain("systematic review");
    expect(terms).not.toContain("systematic");
    expect(terms).not.toContain("anyone");
  });
  test("a heading names a term: it is boosted to the front", async () => {
    const { buildTermMatrix, keywordsOf } = await import("./lsi");
    const m = buildTermMatrix(units);
    const ks = keywordsOf(m, [3], [units[3].text], 8, ["Mobile layouts"]);
    expect(ks[0].term).toBe("mobile");
  });
  test("the budget scales with length: a short text gets at most three", async () => {
    const { keywordBudget } = await import("./lsi");
    expect(keywordBudget(10, 8)).toBe(3);
    expect(keywordBudget(1000, 8)).toBe(8);
  });
});
