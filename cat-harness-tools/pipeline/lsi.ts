/**
 * Latent Semantic Indexing over a set of text units — the method node is
 * `methodologies/lsi.md`; this file is the platform's application of it.
 *
 * ## What it computes
 *
 * 1. A term × unit matrix `A`, weighted log-entropy (local `log(1 + tf)`,
 *    global `1 + Σ_j p_ij log p_ij / log n`), the weighting the LSI
 *    literature settled on for retrieval. `tfidf` is available for comparison.
 * 2. A rank-`k` truncated SVD `A ≈ U_k Σ_k V_kᵀ`, by the randomized range
 *    finder (Gaussian sketch, `q` power iterations with re-orthonormalisation)
 *    followed by an exact SVD of the small projected matrix. The sketch is
 *    seeded, so the same inputs produce the same index — a sidecar that
 *    changed on re-run with no input change would be unauditable.
 * 3. Unit coordinates `V_k Σ_k` and a folding-in map for queries,
 *    `q̂ = qᵀ U_k` compared by cosine against the unit coordinates.
 *
 * ## What it does NOT do, on purpose
 *
 * - **It never merges a latent score with a lexical match.** `graph-search.ts`
 *   refuses to rank because a made-up order hides that everything matched
 *   equally. A cosine in the latent space is a DEFINED quantity, not a made-up
 *   one, but it answers a different question ("close in co-occurrence
 *   structure") from "contains the words". Callers report it as its own
 *   provenance — `latent` — beside the lexical result, never folded into it.
 * - **It does not stem or lemmatise.** Stemming is language-specific and the
 *   corpus is multilingual by design (translations). LSI recovers much of what
 *   stemming would, because inflections co-occur; that is part of the method's
 *   claim, and stemming first would hide whether the claim held.
 * - **No model download.** Every step is linear algebra over the corpus
 *   itself — which is why it runs in a sandbox where huggingface.co is a 403
 *   (bean `p2en`).
 */

import { createHash } from "node:crypto";
import type { LsiOptions } from "../schemas/kg/qa-record-shapes.ts";
// bean 70lx: these record shapes are definitions, and moved to the harness's schemas/
export type { LsiOptions };

// ─── Tokenisation ────────────────────────────────────────────────────────────

/** A deliberately short English function-word list. Frequency-based pruning
 *  (`maxDfShare`) removes the rest, and does so for any language. */
const STOP = new Set(
  (
    "a an and are as at be been being but by can could did do does for from had has have he her his how i if in into is it its " +
    "may might more most must no not of on or our shall should so such than that the their them then there these they this " +
    "those to up us was we were what when where which while who whom why will with would you your also any all each other " +
    "only one two three see e.g i.e etc via per within without between over under about after before"
  ).split(/\s+/),
);

/** Strip the markdown and front-matter a unit carries so that syntax does not
 *  become vocabulary (a `|` table rule co-occurs with everything). */
export function plainText(raw: string): string {
  return raw
    .replace(/^---\n[\s\S]*?\n---\n/, " ") // front matter
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]+>/g, " ")
    // A soft hyphen (U+00AD) is a line-break HINT the PDF text layer kept:
    // "recommenda\u00AD\ntions". Left in, it splits one word into two
    // fragments that each become a term. Measured 2026-09-29: 742 of them in
    // the WHO guideline Handbook, 201 fragment terms. Joined, not spaced.
    .replace(/\u00AD\s*/g, "");
}

export function tokenize(raw: string): string[] {
  const out: string[] = [];
  for (const m of plainText(raw).toLowerCase().matchAll(/\p{L}[\p{L}\p{N}'-]*\p{L}|\p{L}{2,}/gu)) {
    const t = m[0].replace(/'s$/, "");
    if (t.length < 3 || STOP.has(t)) continue;
    out.push(t);
  }
  return out;
}

// ─── Deterministic PRNG and small dense linear algebra ───────────────────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Column-major dense matrix: `rows × cols`, element (i, j) at `j * rows + i`. */
export interface Dense {
  rows: number;
  cols: number;
  data: Float64Array;
}

export function dense(rows: number, cols: number): Dense {
  return { rows, cols, data: new Float64Array(rows * cols) };
}

/** Modified Gram–Schmidt, in place, twice for stability ("twice is enough"). */
export function orthonormalizeColumns(M: Dense): void {
  const { rows, cols, data } = M;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < cols; j++) {
      const oj = j * rows;
      for (let p = 0; p < j; p++) {
        const op = p * rows;
        let dot = 0;
        for (let i = 0; i < rows; i++) dot += data[op + i] * data[oj + i];
        for (let i = 0; i < rows; i++) data[oj + i] -= dot * data[op + i];
      }
      let norm = 0;
      for (let i = 0; i < rows; i++) norm += data[oj + i] * data[oj + i];
      norm = Math.sqrt(norm);
      if (norm < 1e-12) {
        for (let i = 0; i < rows; i++) data[oj + i] = 0;
      } else {
        for (let i = 0; i < rows; i++) data[oj + i] /= norm;
      }
    }
  }
}

/** Cyclic Jacobi eigendecomposition of a small symmetric matrix (row-major,
 *  `n × n`). Returns eigenvalues descending with eigenvectors as columns. */
export function symmetricEigen(S: Float64Array, n: number): { values: Float64Array; vectors: Float64Array } {
  const a = Float64Array.from(S);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k * n + p];
          const akq = a[k * n + q];
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p * n + k];
          const aqk = a[q * n + k];
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k * n + p];
          const vkq = v[k * n + q];
          v[k * n + p] = c * vkp - s * vkq;
          v[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = [...Array(n).keys()].sort((i, j) => a[j * n + j] - a[i * n + i]);
  const values = new Float64Array(n);
  const vectors = new Float64Array(n * n);
  order.forEach((src, dst) => {
    values[dst] = a[src * n + src];
    for (let k = 0; k < n; k++) vectors[k * n + dst] = v[k * n + src];
  });
  return { values, vectors };
}

// ─── Sparse term × unit matrix ───────────────────────────────────────────────

/** Compressed sparse columns: one column per unit. */
export interface Csc {
  rows: number; // terms
  cols: number; // units
  colPtr: Int32Array;
  rowIdx: Int32Array;
  vals: Float64Array;
}

/** Y = A · X  (A: m×n sparse, X: n×r dense) → m×r dense. */
export function spmm(A: Csc, X: Dense): Dense {
  const Y = dense(A.rows, X.cols);
  for (let r = 0; r < X.cols; r++) {
    const xo = r * X.rows;
    const yo = r * A.rows;
    for (let j = 0; j < A.cols; j++) {
      const xj = X.data[xo + j];
      if (xj === 0) continue;
      for (let p = A.colPtr[j]; p < A.colPtr[j + 1]; p++) Y.data[yo + A.rowIdx[p]] += A.vals[p] * xj;
    }
  }
  return Y;
}

/** Z = Aᵀ · Y  (A: m×n sparse, Y: m×r dense) → n×r dense. */
export function spmmT(A: Csc, Y: Dense): Dense {
  const Z = dense(A.cols, Y.cols);
  for (let r = 0; r < Y.cols; r++) {
    const yo = r * Y.rows;
    const zo = r * A.cols;
    for (let j = 0; j < A.cols; j++) {
      let s = 0;
      for (let p = A.colPtr[j]; p < A.colPtr[j + 1]; p++) s += A.vals[p] * Y.data[yo + A.rowIdx[p]];
      Z.data[zo + j] = s;
    }
  }
  return Z;
}

// ─── The index ───────────────────────────────────────────────────────────────

export interface LsiUnit {
  /** Stable id — a repo-relative path, a bean id, `pr:1234`. */
  id: string;
  text: string;
}

export interface LsiIndex {
  k: number;
  weighting: "log-entropy" | "tfidf" | "raw";
  terms: string[];
  unitIds: string[];
  /** Σ_k, descending. */
  singularValues: number[];
  /** Share of ‖A‖²_F retained by the rank-k approximation. */
  retained: number;
  /** m × k, row-major: term coordinates U_k. */
  U: Float64Array;
  /** n × k, row-major: unit coordinates V_k Σ_k. */
  unitCoords: Float64Array;
  /** Global term weights, for folding a query in with the same weighting. */
  globalWeight: Float64Array;
  /** sha256 over the options and the (id, text) of every unit. */
  fingerprint: string;
}

export function fingerprintUnits(units: LsiUnit[], opts: LsiOptions = {}): string {
  const h = createHash("sha256");
  // `v` is the TOKENIZER version: a change to how text becomes terms changes
  // every index without changing any input, so it must change the fingerprint
  // or a stale index reads as fresh. v2: soft hyphens joined.
  h.update(JSON.stringify({ ...opts, v: 2 }));
  for (const u of [...units].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    h.update(u.id);
    h.update("\0");
    h.update(u.text);
    h.update("\0");
  }
  return h.digest("hex");
}

/** The weighted term × unit matrix both decompositions start from — LSI takes
 *  its SVD directly, correspondence analysis (`ca.ts`) takes the SVD of its
 *  standardised residuals. Shared so that "the same vocabulary, the same
 *  weighting" is true by construction when the two are compared. */
export interface TermMatrix {
  terms: string[];
  A: Csc;
  globalWeight: Float64Array;
  weighting: "log-entropy" | "tfidf" | "raw";
}

export function buildTermMatrix(units: LsiUnit[], opts: LsiOptions = {}): TermMatrix {
  const weighting = opts.weighting ?? "log-entropy";
  const minDf = opts.minDf ?? 2;
  const maxDfShare = opts.maxDfShare ?? 0.5;
  const n = units.length;
  if (n < 3) throw new Error(`needs at least 3 units, got ${n}`);

  // Term frequencies per unit, then document frequency.
  const tfs = units.map((u) => {
    const m = new Map<string, number>();
    for (const t of tokenize(u.text)) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  });
  const df = new Map<string, number>();
  for (const m of tfs) for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const maxDf = Math.max(minDf, Math.floor(maxDfShare * n));
  const terms = [...df.entries()]
    .filter(([, d]) => d >= minDf && d <= maxDf)
    .map(([t]) => t)
    .sort();
  const termIdx = new Map(terms.map((t, i) => [t, i]));
  const m = terms.length;
  if (m < 3) throw new Error(`kept only ${m} terms from ${n} units — the units share no vocabulary`);

  // Global weights.
  const globalWeight = new Float64Array(m);
  if (weighting === "raw") {
    // Deerwester et al. (1990) §5: "each cell indicates the frequency with
    // which each term occurs" — no weighting. Kept so the engine can be
    // checked against the paper's own worked example (lsi.test.ts).
    globalWeight.fill(1);
  } else if (weighting === "tfidf") {
    for (let i = 0; i < m; i++) globalWeight[i] = Math.log(n / df.get(terms[i])!);
  } else {
    const gf = new Float64Array(m);
    for (const tf of tfs) for (const [t, c] of tf) { const i = termIdx.get(t); if (i !== undefined) gf[i] += c; }
    const ent = new Float64Array(m);
    for (const tf of tfs)
      for (const [t, c] of tf) {
        const i = termIdx.get(t);
        if (i === undefined) continue;
        const p = c / gf[i];
        ent[i] += p * Math.log(p);
      }
    const logN = Math.log(n);
    for (let i = 0; i < m; i++) globalWeight[i] = 1 + ent[i] / logN;
  }

  // Assemble CSC.
  const colPtr = new Int32Array(n + 1);
  const rowIdx: number[] = [];
  const vals: number[] = [];
  tfs.forEach((tf, j) => {
    const entries = [...tf].map(([t, c]) => [termIdx.get(t), c] as const).filter((e): e is [number, number] => e[0] !== undefined);
    entries.sort((a, b) => a[0] - b[0]);
    for (const [i, c] of entries) {
      const local = weighting === "log-entropy" ? Math.log1p(c) : c;
      const w = local * globalWeight[i];
      if (w !== 0) { rowIdx.push(i); vals.push(w); }
    }
    colPtr[j + 1] = rowIdx.length;
  });
  const A: Csc = { rows: m, cols: n, colPtr, rowIdx: Int32Array.from(rowIdx), vals: Float64Array.from(vals) };
  return { terms, A, globalWeight, weighting };
}

export function buildLsi(units: LsiUnit[], opts: LsiOptions = {}): LsiIndex {
  const q = opts.powerIterations ?? 4;
  const { terms, A, globalWeight, weighting } = buildTermMatrix(units, opts);
  const m = A.rows;
  const n = A.cols;
  let frob2 = 0;
  for (const v of A.vals) frob2 += v * v;

  // Randomized range finder (Halko–Martinsson–Tropp), oversampled by 10.
  const k = Math.max(1, Math.min(opts.k ?? 100, Math.min(m, n) - 1));
  const r = Math.min(k + 10, Math.min(m, n));
  const rand = mulberry32(opts.seed ?? 1990);
  const Omega = dense(n, r);
  for (let i = 0; i < Omega.data.length; i++) Omega.data[i] = gaussian(rand);
  let Y = spmm(A, Omega);
  orthonormalizeColumns(Y);
  for (let it = 0; it < q; it++) {
    const Z = spmmT(A, Y);
    orthonormalizeColumns(Z);
    Y = spmm(A, Z);
    orthonormalizeColumns(Y);
  }
  // B = Qᵀ A (r × n); SVD of B via eigen of B Bᵀ (r × r).
  const Bt = spmmT(A, Y); // n × r, = Bᵀ
  const G = new Float64Array(r * r);
  for (let a = 0; a < r; a++)
    for (let b = a; b < r; b++) {
      let s = 0;
      const oa = a * n;
      const ob = b * n;
      for (let j = 0; j < n; j++) s += Bt.data[oa + j] * Bt.data[ob + j];
      G[a * r + b] = s;
      G[b * r + a] = s;
    }
  const { values, vectors } = symmetricEigen(G, r);

  const sigma = new Float64Array(k);
  for (let c = 0; c < k; c++) sigma[c] = Math.sqrt(Math.max(values[c], 0));
  // U_k = Q · W_k ; V_k Σ_k = Bᵀ W_k.
  const U = new Float64Array(m * k);
  for (let c = 0; c < k; c++)
    for (let a = 0; a < r; a++) {
      const w = vectors[a * r + c];
      if (w === 0) continue;
      const oa = a * m;
      for (let i = 0; i < m; i++) U[i * k + c] += Y.data[oa + i] * w;
    }
  const unitCoords = new Float64Array(n * k);
  for (let c = 0; c < k; c++)
    for (let a = 0; a < r; a++) {
      const w = vectors[a * r + c];
      if (w === 0) continue;
      const oa = a * n;
      for (let j = 0; j < n; j++) unitCoords[j * k + c] += Bt.data[oa + j] * w;
    }
  // Fix the sign of each dimension (an SVD is unique only up to sign) so that
  // the largest-magnitude term loading is positive — otherwise the committed
  // per-dimension summaries flip between runs on different hardware.
  for (let c = 0; c < k; c++) {
    let best = 0;
    for (let i = 0; i < m; i++) if (Math.abs(U[i * k + c]) > Math.abs(best)) best = U[i * k + c];
    if (best < 0) {
      for (let i = 0; i < m; i++) U[i * k + c] = -U[i * k + c];
      for (let j = 0; j < n; j++) unitCoords[j * k + c] = -unitCoords[j * k + c];
    }
  }
  let kept = 0;
  for (const s of sigma) kept += s * s;

  return {
    k,
    weighting,
    terms,
    unitIds: units.map((u) => u.id),
    singularValues: [...sigma],
    retained: frob2 > 0 ? kept / frob2 : 0,
    U,
    unitCoords,
    globalWeight,
    fingerprint: fingerprintUnits(units, opts),
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

function cosine(a: Float64Array, ao: number, b: Float64Array, bo: number, k: number): number {
  let d = 0, na = 0, nb = 0;
  for (let c = 0; c < k; c++) {
    d += a[ao + c] * b[bo + c];
    na += a[ao + c] ** 2;
    nb += b[bo + c] ** 2;
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

/** Fold arbitrary text into the latent space: `q̂ = qᵀ U_k`, weighted as the
 *  corpus was. Terms outside the vocabulary contribute nothing — and a query
 *  made only of such terms folds to the zero vector, which scores 0 against
 *  everything rather than pretending to a match. */
export function foldIn(index: LsiIndex, text: string): Float64Array {
  const termIdx = new Map(index.terms.map((t, i) => [t, i]));
  const tf = new Map<number, number>();
  for (const t of tokenize(text)) { const i = termIdx.get(t); if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1); }
  const out = new Float64Array(index.k);
  for (const [i, c] of tf) {
    const w = (index.weighting === "log-entropy" ? Math.log1p(c) : c) * index.globalWeight[i];
    for (let d = 0; d < index.k; d++) out[d] += w * index.U[i * index.k + d];
  }
  // Scale into the same frame as unit coordinates (V Σ = Aᵀ U).
  return out;
}

export interface LsiHit {
  id: string;
  cosine: number;
}

export function query(index: LsiIndex, text: string, top = 10): LsiHit[] {
  const q = foldIn(index, text);
  return rank(index, q, top);
}

export function rank(index: LsiIndex, q: Float64Array, top = 10, exclude?: Set<string>): LsiHit[] {
  const hits: LsiHit[] = [];
  for (let j = 0; j < index.unitIds.length; j++) {
    if (exclude?.has(index.unitIds[j])) continue;
    hits.push({ id: index.unitIds[j], cosine: cosine(q, 0, index.unitCoords, j * index.k, index.k) });
  }
  return hits.sort((a, b) => b.cosine - a.cosine || (a.id < b.id ? -1 : 1)).slice(0, top);
}

export function unitVector(index: LsiIndex, id: string): Float64Array | undefined {
  const j = index.unitIds.indexOf(id);
  if (j < 0) return undefined;
  return index.unitCoords.slice(j * index.k, (j + 1) * index.k);
}

/** Nearest neighbours of a unit, excluding itself. */
export function neighboursOf(index: LsiIndex, id: string, top = 5): LsiHit[] {
  const v = unitVector(index, id);
  return v ? rank(index, v, top, new Set([id])) : [];
}

/** Mean of several unit vectors, each first normalised so that a long unit
 *  does not dominate the centroid by length alone. */
export function centroid(index: LsiIndex, ids: string[]): Float64Array {
  const c = new Float64Array(index.k);
  for (const id of ids) {
    const v = unitVector(index, id);
    if (!v) continue;
    let norm = 0;
    for (const x of v) norm += x * x;
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < index.k; d++) c[d] += v[d] / norm;
  }
  return c;
}

export function cosineVectors(a: Float64Array, b: Float64Array): number {
  return cosine(a, 0, b, 0, Math.min(a.length, b.length));
}

/** The highest-loading terms on each of the first `dims` dimensions — the
 *  human-readable face of a latent axis, and the part of an index a reviewer
 *  can actually judge. Positive and negative poles are listed separately
 *  because a dimension is a contrast, not a topic. */
export function dimensionSummaries(index: LsiIndex, dims = 10, perPole = 8): Array<{ dim: number; sigma: number; positive: string[]; negative: string[] }> {
  const out = [];
  for (let c = 0; c < Math.min(dims, index.k); c++) {
    const loads = index.terms.map((t, i) => [t, index.U[i * index.k + c]] as const);
    loads.sort((a, b) => b[1] - a[1]);
    out.push({
      dim: c + 1,
      sigma: Number(index.singularValues[c].toFixed(4)),
      positive: loads.slice(0, perPole).filter((l) => l[1] > 0).map((l) => l[0]),
      negative: loads.slice(-perPole).reverse().filter((l) => l[1] < 0).map((l) => l[0]),
    });
  }
  return out;
}

// ─── Keywords (issue #2302) ──────────────────────────────────────────────────

export interface Keyword {
  term: string;
  /** The unit's weighted score for it: log(1+tf) × global weight, summed
   *  over a phrase's words. Comparable within one matrix only. */
  score: number;
}

/**
 * How {@link keywordsOf} scores terms. Absent `scores`, a term's score is its
 * weighted count in the units' columns of the surface matrix — the default,
 * and the keywords this platform has always written. With `scores` (term row
 * → score), the caller supplies them, e.g. {@link latentTermScores}.
 */
export interface KeywordScoring {
  scores?: Map<number, number>;
  /** Admit a term the text does not use. Only meaningful with latent `scores`. */
  anyTerm?: boolean;
}

/**
 * Term scores for a set of units from an index's rank-k reconstruction: for
 * term `i`, `Σ_{j ∈ cols} Â_ij` where `Â = U · unitCoordsᵀ`.
 *
 * For LSI (`buildLsi`) `unitCoords` is `V_k Σ_k`, so this is the rank-k
 * approximation of the weighted matrix (Deerwester et al. 1990, §4): a term
 * scores in a unit it never occurs in when it occurs with that unit's words
 * elsewhere. For CA (`buildCa`, α = 1) `unitCoords` is the principal row
 * coordinates and `U` the standard column coordinates, so the product is the
 * reconstitution `p_ij / (r_j c_i) − 1` of CA (Qi et al. 2023, §2.2): how far
 * the term is OVER-represented in the unit relative to independence, length
 * and frequency margins removed. Keys are rows of `index.terms`; a caller
 * scoring against another matrix maps them by term.
 */
export function latentTermScores(index: LsiIndex, cols: number[], opts: { rows?: Iterable<number>; top?: number } = {}): Map<number, number> {
  const k = index.k;
  const sum = new Float64Array(k);
  for (const j of cols) for (let c = 0; c < k; c++) sum[c] += index.unitCoords[j * k + c];
  const at = (i: number): number => {
    let s = 0;
    const o = i * k;
    for (let c = 0; c < k; c++) s += index.U[o + c] * sum[c];
    return s;
  };
  const out = new Map<number, number>();
  if (opts.rows) {
    // Only the rows asked for: a re-rank over the words a text uses.
    for (const i of opts.rows) {
      const s = at(i);
      if (s > 0) out.set(i, s);
    }
    return out;
  }
  const all = new Float64Array(index.terms.length);
  for (let i = 0; i < all.length; i++) all[i] = at(i);
  // The `top` highest only: a caller keeps a dozen keywords, and handing it
  // every positive score of a 10⁴-term vocabulary costs a sort per unit.
  const top = opts.top ?? all.length;
  let floor = -Infinity;
  if (top < all.length) {
    const sorted = Float64Array.from(all).sort();
    floor = sorted[sorted.length - top]!;
  }
  for (let i = 0; i < all.length; i++) if (all[i]! > 0 && all[i]! >= floor) out.set(i, all[i]!);
  return out;
}

/**
 * The terms that characterise one unit (or several, pooled), read from the
 * SAME weighted matrix the index is built from — so a keyword is "frequent
 * here, rare across this corpus" exactly as the index means it, with no second
 * vocabulary to drift from it.
 *
 * Two-word phrases are offered beside single terms: a pair of adjacent tokens
 * occurring at least twice in the text, both of whose words are in the
 * matrix ("systematic review", "conflict interest"). A phrase replaces its
 * words when it scores at least as well as the better of them, so a list does
 * not say "systematic", "review" and "systematic review" at once.
 */
// Words the index keeps (they do discriminate between texts) but that say
// nothing about what a text is ABOUT. Measured 2026-10-06 on a catalogue
// layer's handbook: "anyone", "aims", "take", "produce", "resulting" and "positive"
// led section keyword lists. A keyword list only, never the index's tokens.
const KEYWORD_STOP = new Set(
  ("anyone anything everyone someone something aim aims aimed take takes taken taking make makes made " +
    "making produce produces produced resulting result results positive negative easy easily well " +
    "many much several various given give gives need needs needed want wants able possible include " +
    "includes included including example examples way ways thing things part parts set sets use used " +
    "uses using new good best better large small high low first second third last next often usually " +
    "generally particular particularly specific specifically important however therefore thus also " +
    "within without upon whether while since already always never sometimes rather quite really very " +
    "interested understanding accurately describe describes described provide provides provided " +
    "develop develops developed help helps helped show shows shown see seen")
    .split(" "),
);

/** How many keywords a text of `tokens` content tokens supports: a 30-word
 *  section does not have eight things it is about. */
export function keywordBudget(tokens: number, top: number): number {
  return Math.max(3, Math.min(top, Math.ceil(tokens / 20)));
}

/** Plural-insensitive comparison form of a term: "evidence reviews" and
 *  "evidence review" are one keyword. */
function fold(term: string): string {
  return term
    .split(" ")
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");
}

/** term → row, once per matrix: building it per call cost a 10⁴-entry map per unit. */
const TERM_INDEX = new WeakMap<TermMatrix, Map<string, number>>();
function termIndexOf(m: TermMatrix): Map<string, number> {
  let idx = TERM_INDEX.get(m);
  if (!idx) TERM_INDEX.set(m, (idx = new Map(m.terms.map((t, i) => [t, i]))));
  return idx;
}

/**
 * A text's runs of truly adjacent content tokens, once per text: the same
 * section is read by every keyword variant. Bounded so a long-lived process
 * does not keep every text it ever saw.
 */
const RUNS = new Map<string, string[][]>();
const RUNS_MAX = 20_000;
function tokenRuns(t: string): string[][] {
  const hit = RUNS.get(t);
  if (hit) return hit;
  const runs: string[][] = [];
  // A line break ends a run when the next line opens with a capital or a
  // heading mark: that is a table cell, a heading or a new item, not a
  // wrapped sentence ("Development" over "Systematic review team" is two
  // cells of a WHO table, not the phrase "development systematic"). A
  // wrapped sentence continues in lower case and keeps its run.
  const pieces = plainText(t)
    .split(/\n(?=\s*[\p{Lu}#])/u)
    .flatMap((line) => line.toLowerCase().split(/[.,;:!?()\[\]"“”]+/));
  for (const piece of pieces) {
    let run: string[] = [];
    for (const mm of piece.matchAll(/\p{L}[\p{L}\p{N}'-]*\p{L}|\p{L}{2,}/gu)) {
      const w = mm[0].replace(/'s$/, "");
      if (w.length < 3 || STOP.has(w)) {
        if (run.length) runs.push(run);
        run = [];
        continue;
      }
      run.push(w);
    }
    if (run.length) runs.push(run);
  }
  if (RUNS.size >= RUNS_MAX) RUNS.clear();
  RUNS.set(t, runs);
  return runs;
}

/**
 * `headings` are the text's own statements of its subject — a section's
 * title. A term every word of which a heading names scores double: the author
 * saying what the text is about outranks a rare word the text merely uses.
 */
export function keywordsOf(
  m: TermMatrix,
  cols: number[],
  texts: string[],
  top = 8,
  headings: string[] = [],
  opts: KeywordScoring = {},
): Keyword[] {
  const named = new Set(headings.flatMap((h) => tokenize(h)));
  let score = new Map<number, number>();
  if (opts.scores) {
    score = opts.scores;
  } else {
    for (const j of cols) {
      for (let p = m.A.colPtr[j]; p < m.A.colPtr[j + 1]; p++) {
        score.set(m.A.rowIdx[p], (score.get(m.A.rowIdx[p]) ?? 0) + m.A.vals[p]);
      }
    }
  }
  const termIdx = termIndexOf(m);
  // Token runs that are truly adjacent in the text: a stop word, a short
  // word or punctuation BREAKS the run, so "evidence and systematic" never
  // yields the phrase "evidence systematic" (measured: that and "new contain"
  // came from adjacency computed after stop words were dropped).
  const tf = new Map<string, number>();
  const pairs = new Map<string, number>();
  let tokens = 0;
  for (const t of texts) {
    for (const run of tokenRuns(t)) {
      let prev: string | null = null;
      for (const w of run) {
        tokens++;
        tf.set(w, (tf.get(w) ?? 0) + 1);
        if (prev && prev !== w && termIdx.has(prev) && termIdx.has(w)) {
          const k = `${prev} ${w}`;
          pairs.set(k, (pairs.get(k) ?? 0) + 1);
        }
        prev = w;
      }
    }
  }
  // In a text of any length, a word said once is weak evidence of what the
  // text is about — log-entropy alone ranks a rare one-off ("anyone",
  // "resulting") above the text's subject. Below 100 tokens every word counts.
  const minTf = tokens >= 100 ? 2 : 1;
  const single: Keyword[] = [...score]
    .map(([i, w]) => ({ term: m.terms[i], score: w }))
    .filter((k) => (opts.scores === undefined || k.score > 0) && !KEYWORD_STOP.has(k.term) && !/ly$/.test(k.term))
    // A LATENT score may propose a term the text never uses (synonymy,
    // Deerwester et al. 1990 §1): `anyTerm` lets it through. Otherwise a word
    // must occur in the text, as before.
    .filter((k) => opts.anyTerm || (tf.get(k.term) ?? 0) >= minTf || named.has(k.term));
  const byTerm = new Map([...score].map(([i, w]) => [m.terms[i], w]));
  const phrases: Keyword[] = [...pairs]
    .filter(([k, c]) => c >= 2 && !k.split(" ").some((w) => KEYWORD_STOP.has(w) || /ly$/.test(w)))
    .map(([k]) => {
      const [a, b] = k.split(" ");
      return { term: k, score: (byTerm.get(a) ?? 0) + (byTerm.get(b) ?? 0) };
    });
  const boosted = (k: Keyword): Keyword =>
    k.term.split(" ").every((w) => named.has(w)) ? { ...k, score: 2 * k.score } : k;
  const ranked = [...phrases, ...single]
    .map(boosted)
    .sort((x, y) => y.score - x.score || x.term.localeCompare(y.term));
  const out: Keyword[] = [];
  const covered = new Set<string>();
  const budget = keywordBudget(tokens, top);
  for (const k of ranked) {
    if (out.length >= budget) break;
    const words = fold(k.term).split(" ");
    if (words.every((w) => covered.has(w)) || covered.has(fold(k.term))) continue;
    out.push({ term: k.term, score: Number(k.score.toFixed(4)) });
    for (const w of words) covered.add(w);
    covered.add(fold(k.term));
  }
  return out;
}

// ─── Cross-group link proposals (bean `9udd`) ─────────────────────────────────

/** Below this cosine a cross-group pair is not proposed. House number,
 *  measured 2026-09-29 on a catalogue layer's 15 strongest cross-document pairs a
 *  reader labelled: 0.5 keeps all 4 real pairs and drops 5 of 7 spurious
 *  ones. Fitted to 15 examples — move it when a larger ground truth exists. */
export const LINK_FLOOR = 0.5;

export interface CrossLink {
  a: string;
  b: string;
  cosine: number;
}

export interface CrossLinks {
  links: CrossLink[];
  /** Units that are the nearest other-group unit for many units — a reader
   *  should discount links through them. REPORTED, not penalised: a
   *  CSLS-style penalty (2·cos − r(a) − r(b), r = mean cosine to the K nearest
   *  other-group units) was measured on the same 15 pairs and made ranking
   *  WORSE (AUC real-vs-spurious 0.96 with cosine, 0.75–0.79 with the penalty
   *  at K = 5, 10, 20): the page it demoted most was a genuinely central one. */
  hubs: Array<{ id: string; nearestFor: number }>;
  /** How many units' best other-group match fell below the floor. */
  belowFloor: number;
}

/**
 * Propose links between units of DIFFERENT groups (documents, graphs):
 * each unit's best `perUnit` other-group matches at or above `floor`, deduped.
 * A proposal, never a relation (method `lsi`, refusal 3).
 */
export function crossGroupLinks(
  index: LsiIndex,
  groupOf: (id: string) => string,
  opts: { floor?: number; perUnit?: number; hubAt?: number } = {},
): CrossLinks {
  const floor = opts.floor ?? LINK_FLOOR;
  const perUnit = opts.perUnit ?? 1;
  const ids = index.unitIds;
  const k = index.k;
  const seen = new Map<string, CrossLink>();
  const nearest = new Map<string, number>();
  let belowFloor = 0;
  for (let i = 0; i < ids.length; i++) {
    const g = groupOf(ids[i]);
    const cand: Array<[number, number]> = [];
    for (let j = 0; j < ids.length; j++) {
      if (j === i || groupOf(ids[j]) === g) continue;
      cand.push([j, cosine(index.unitCoords, i * k, index.unitCoords, j * k, k)]);
    }
    if (cand.length === 0) continue;
    cand.sort((x, y) => y[1] - x[1]);
    nearest.set(ids[cand[0][0]], (nearest.get(ids[cand[0][0]]) ?? 0) + 1);
    if (cand[0][1] < floor) belowFloor++;
    for (const [j, c] of cand.slice(0, perUnit)) {
      if (c < floor) break;
      const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
      seen.set(a + "\u0000" + b, { a, b, cosine: Number(c.toFixed(3)) });
    }
  }
  const hubAt = opts.hubAt ?? Math.max(5, Math.ceil(0.05 * ids.length));
  const hubs = [...nearest]
    .filter(([, n]) => n >= hubAt)
    .map(([id, nearestFor]) => ({ id, nearestFor }))
    .sort((x, y) => y.nearestFor - x.nearestFor || (x.id < y.id ? -1 : 1));
  const links = [...seen.values()].sort((x, y) => y.cosine - x.cosine || (x.a < y.a ? -1 : 1));
  return { links, hubs, belowFloor };
}
