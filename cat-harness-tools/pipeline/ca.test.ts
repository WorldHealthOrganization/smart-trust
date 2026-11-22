/**
 * Correspondence analysis checked against the source's own worked example:
 * Qi, Hessen & van der Heijden (2023), Table 1 and Fig. 1
 * (`library/qi-hessen-vanderheijden-2023-ca-vs-lsa`, §2) — six documents,
 * six terms, where "jaguar" is polysemous (a cat and a car). The paper prints
 * LSA-RAW's singular values (its Table 2) and CA's first two principal
 * inertias (Fig. 1b axis labels: 0.475, 93.2 %; 0.017, 3.4 %).
 */
import { describe, expect, test } from "bun:test";
import { buildCa, totalInertia } from "./ca";
import { buildLsi, cosineVectors, foldIn, unitVector } from "./lsi";

const TERMS = ["lion", "tiger", "cheetah", "jaguar", "porsche", "ferrari"];
// Table 1: rows are documents.
const F = [
  [2, 2, 1, 2, 0, 0],
  [2, 3, 3, 3, 0, 0],
  [1, 1, 1, 1, 0, 0],
  [2, 2, 2, 3, 1, 1],
  [0, 0, 0, 1, 1, 1],
  [0, 0, 0, 2, 1, 2],
];
const units = F.map((row, i) => ({ id: `doc${i + 1}`, text: TERMS.flatMap((t, j) => Array(row[j]).fill(t)).join(" ") }));
const all = { minDf: 1, maxDfShare: 1, seed: 1990 } as const;

describe("the shared matrix, read as LSA-RAW (Qi et al. Table 2)", () => {
  test("singular values 8.425, 3.261, 0.988, 0.574, 0.272", () => {
    const ix = buildLsi(units, { ...all, k: 5, weighting: "raw" });
    [8.425, 3.261, 0.988, 0.574, 0.272].forEach((s, d) => expect(Math.abs(ix.singularValues[d] - s)).toBeLessThan(0.0015));
  });
});

describe("correspondence analysis (Qi et al. §2.2, Fig. 1b)", () => {
  const ca = buildCa(units, { ...all, k: 4 });
  const inertia = totalInertia(units, all);

  test("the first two principal inertias are 0.475 (93.2 %) and 0.017 (3.4 %)", () => {
    const lam = ca.singularValues.map((s) => s * s);
    expect(Math.abs(lam[0] - 0.475)).toBeLessThan(0.0006);
    expect(Math.abs(lam[1] - 0.017)).toBeLessThan(0.0006);
    expect(Math.abs(lam[0] / inertia - 0.932)).toBeLessThan(0.0006);
    expect(Math.abs(lam[1] / inertia - 0.034)).toBeLessThan(0.0006);
  });

  test("the principal inertias sum to the total inertia χ²/N — a theorem, not a fit", () => {
    // Rank of S is at most min(6,6) − 1 = 5; k = 4 keeps all but the last,
    // so compare with a full-rank solve on the same data.
    const full = buildCa(units, { ...all, k: 5 });
    const sum = full.singularValues.reduce((s, x) => s + x * x, 0);
    expect(Math.abs(sum - inertia)).toBeLessThan(1e-9);
  });

  test("jaguar lies between the cat terms and the car terms, document 4 between the cat and car documents", () => {
    // Fig. 1b's description. On dimension 1 the cat and car groups sit on
    // opposite sides; the polysemous term and the mixed document fall between.
    const termD1 = (t: string) => ca.U[ca.terms.indexOf(t) * ca.k];
    const cats = ["lion", "tiger", "cheetah"].map(termD1);
    const cars = ["porsche", "ferrari"].map(termD1);
    const lo = Math.min(Math.max(...cats), Math.max(...cars));
    const hi = Math.max(Math.min(...cats), Math.min(...cars));
    const j = termD1("jaguar");
    expect(j > Math.min(lo, hi) && j < Math.max(lo, hi)).toBe(true);
    const docD1 = (id: string) => unitVector(ca, id)![0];
    const catDocs = ["doc1", "doc2", "doc3"].map(docD1);
    const carDocs = ["doc5", "doc6"].map(docD1);
    const d4 = docD1("doc4");
    const catSide = Math.sign(catDocs[0]);
    expect(catDocs.every((x) => Math.sign(x) === catSide)).toBe(true);
    expect(carDocs.every((x) => Math.sign(x) === -catSide)).toBe(true);
    expect(d4 * catSide).toBeLessThan(Math.min(...catDocs.map((x) => x * catSide)));
  });

  test("every dimension is centred on the masses: Σ r_i φ_ik = 0 (the margins are removed)", () => {
    const N = F.flat().reduce((a, b) => a + b, 0);
    const r = F.map((row) => row.reduce((a, b) => a + b, 0) / N);
    for (let d = 0; d < ca.k; d++) {
      const s = ca.unitIds.reduce((acc, id, i) => acc + r[i] * unitVector(ca, id)![d], 0);
      expect(Math.abs(s)).toBeLessThan(1e-9);
    }
  });

  test("the transition formula places a document where the analysis put it", () => {
    // Eq. (8): a row's profile averaged over the column standard coordinates
    // IS its principal coordinate — so folding a document in reproduces it.
    for (const u of units) expect(cosineVectors(foldIn(ca, u.text), unitVector(ca, u.id)!)).toBeGreaterThan(0.999999);
  });
});
