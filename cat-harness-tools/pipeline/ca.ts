/**
 * Correspondence analysis of a document × term matrix, for retrieval — the
 * method node is `methodologies/correspondence-analysis.md`; this is the
 * platform's application of it. A PARALLEL track to `lsi.ts`, not a variant
 * of it: same input matrix, a different matrix decomposed, a different claim.
 *
 * ## What it computes (Qi, Hessen & van der Heijden 2023, §2.2)
 *
 *   P = F / N                     joint proportions (F: documents × terms)
 *   r = P 1,  c = Pᵀ 1            row and column masses
 *   S = D_r^{-½} (P − r cᵀ) D_c^{-½}   standardised residuals from independence
 *   S = U Σ Vᵀ                    rank-k SVD
 *   Φ = D_r^{-½} U,  Γ = D_c^{-½} V      standard coordinates
 *
 * Documents sit at the principal coordinates `ΦΣ`; a new document `d` is placed
 * by the transition formula (their eq. 8) at `(d / Σ d) Γ` — its term PROFILE
 * averaged over the column standard coordinates. With `α` (their §3.2) both
 * are scaled by `Σ^{α−1}` so the query and the documents stay in one frame.
 *
 * `‖S‖²_F` is the total inertia, `χ² / N`; `retained` reports the share the
 * `k` dimensions keep. Because `Σ_i r_i φ_ik = 0 = Σ_j c_j γ_jk`, every
 * dimension is orthogonal to the margins — the property the paper argues makes
 * CA better for retrieval than LSA, whose first dimensions carry document
 * length and term frequency.
 *
 * ## The residual matrix is never formed
 *
 * `P − r cᵀ` is dense (documents × terms), which at this corpus size is
 * ~10⁷ cells. The randomized SVD only needs products with `S` and `Sᵀ`, and
 * both expand into one sparse product plus a rank-one correction:
 *
 *   S x  = D_r^{-½} ( Aᵀ D_c^{-½} x / N − r · (cᵀ D_c^{-½} x) )
 *   Sᵀ y = D_c^{-½} ( A D_r^{-½} y / N − c · (rᵀ D_r^{-½} y) )
 *
 * with `A` the stored term × unit matrix (so `F = Aᵀ`).
 *
 * The returned object is an `LsiIndex` in SHAPE — `unitCoords`, `U` for
 * folding-in, `singularValues` — so `rank`, `centroid`, `neighboursOf` and
 * `foldIn` serve both methods. That is shared plumbing, not a blended method:
 * the decomposition, and therefore every coordinate, is CA's own.
 */

import {
  buildTermMatrix,
  dense,
  fingerprintUnits,
  gaussian,
  mulberry32,
  orthonormalizeColumns,
  spmm,
  spmmT,
  symmetricEigen,
  type Dense,
  type LsiIndex,
  type LsiOptions,
  type LsiUnit,
} from "./lsi";

export interface CaOptions extends LsiOptions {
  /** Singular-value weighting exponent (Qi et al. §3.2). 1 is standard CA;
   *  > 1 emphasises the first dimensions. Default 1. */
  alpha?: number;
}

export function buildCa(units: LsiUnit[], opts: CaOptions = {}): LsiIndex {
  // CA's own convention is the RAW count matrix — "Processing the raw data
  // matrix ... is considered an integral part of CA" (§3.1). Weighted input is
  // allowed, as the paper tests it, but raw is the default.
  const o: CaOptions = { weighting: "raw", ...opts };
  const alpha = o.alpha ?? 1;
  const q = o.powerIterations ?? 4;
  const { terms, A, globalWeight, weighting } = buildTermMatrix(units, o);
  const m = A.rows; // terms
  const n = A.cols; // documents

  // Masses.
  let N = 0;
  const docSum = new Float64Array(n);
  const termSum = new Float64Array(m);
  for (let j = 0; j < n; j++)
    for (let p = A.colPtr[j]; p < A.colPtr[j + 1]; p++) {
      docSum[j] += A.vals[p];
      termSum[A.rowIdx[p]] += A.vals[p];
      N += A.vals[p];
    }
  const r = docSum.map((x) => x / N);
  const c = termSum.map((x) => x / N);
  // A unit that keeps no indexed term has no profile, so CA cannot place it.
  // Its row of S is taken as zero (D_r^{-½} := 0 there), which is exactly
  // dropping it from the analysis: its coordinates are the zero vector and it
  // scores 0 against everything, rather than a made-up position.
  const rInvSqrt = r.map((x) => (x > 0 ? 1 / Math.sqrt(x) : 0));
  const cInvSqrt = c.map((x) => 1 / Math.sqrt(x));

  // Total inertia ‖S‖² = Σ p²/(r c) − 1, from the sparse entries alone.
  let inertia = -1;
  for (let j = 0; j < n; j++)
    for (let p = A.colPtr[j]; p < A.colPtr[j + 1]; p++) {
      const pij = A.vals[p] / N;
      if (r[j] > 0) inertia += (pij * pij) / (r[j] * c[A.rowIdx[p]]);
    }

  // S · X  (X: m × b)  →  n × b
  const mulS = (X: Dense): Dense => {
    const Xs = dense(m, X.cols);
    for (let b = 0; b < X.cols; b++) for (let i = 0; i < m; i++) Xs.data[b * m + i] = X.data[b * m + i] * cInvSqrt[i];
    const Y = spmmT(A, Xs); // n × b, = Aᵀ D_c^{-½} X
    for (let b = 0; b < X.cols; b++) {
      let cx = 0;
      for (let i = 0; i < m; i++) cx += c[i] * Xs.data[b * m + i];
      for (let j = 0; j < n; j++) Y.data[b * n + j] = rInvSqrt[j] * (Y.data[b * n + j] / N - r[j] * cx);
    }
    return Y;
  };
  // Sᵀ · Y  (Y: n × b)  →  m × b
  const mulSt = (Y: Dense): Dense => {
    const Ys = dense(n, Y.cols);
    for (let b = 0; b < Y.cols; b++) for (let j = 0; j < n; j++) Ys.data[b * n + j] = Y.data[b * n + j] * rInvSqrt[j];
    const Z = spmm(A, Ys); // m × b, = A D_r^{-½} Y
    for (let b = 0; b < Y.cols; b++) {
      let ry = 0;
      for (let j = 0; j < n; j++) ry += r[j] * Ys.data[b * n + j];
      for (let i = 0; i < m; i++) Z.data[b * m + i] = cInvSqrt[i] * (Z.data[b * m + i] / N - c[i] * ry);
    }
    return Z;
  };

  // Randomized subspace iteration on S (n × m), Halko et al. Alg. 4.4 + 5.1.
  // The residual matrix has rank ≤ min(n, m) − 1: the trivial dimension is
  // already removed by subtracting r cᵀ.
  const k = Math.max(1, Math.min(o.k ?? 100, Math.min(m, n) - 2));
  const rr = Math.min(k + 10, Math.min(m, n) - 1);
  const rand = mulberry32(o.seed ?? 1990);
  const Omega = dense(m, rr);
  for (let i = 0; i < Omega.data.length; i++) Omega.data[i] = gaussian(rand);
  let Q = mulS(Omega);
  orthonormalizeColumns(Q);
  for (let it = 0; it < q; it++) {
    const Z = mulSt(Q);
    orthonormalizeColumns(Z);
    Q = mulS(Z);
    orthonormalizeColumns(Q);
  }
  const Bt = mulSt(Q); // m × rr, = Sᵀ Q = Bᵀ
  const G = new Float64Array(rr * rr);
  for (let a = 0; a < rr; a++)
    for (let b = a; b < rr; b++) {
      let s = 0;
      for (let i = 0; i < m; i++) s += Bt.data[a * m + i] * Bt.data[b * m + i];
      G[a * rr + b] = s;
      G[b * rr + a] = s;
    }
  const { values, vectors } = symmetricEigen(G, rr);
  const sigma = new Float64Array(k);
  for (let d = 0; d < k; d++) sigma[d] = Math.sqrt(Math.max(values[d], 0));

  // Documents: ΦΣ^α = D_r^{-½} Q W Σ^α.
  const unitCoords = new Float64Array(n * k);
  for (let d = 0; d < k; d++) {
    const scale = Math.pow(sigma[d], alpha);
    for (let a = 0; a < rr; a++) {
      const w = vectors[a * rr + d];
      if (w === 0) continue;
      for (let j = 0; j < n; j++) unitCoords[j * k + d] += Q.data[a * n + j] * w;
    }
    for (let j = 0; j < n; j++) unitCoords[j * k + d] *= rInvSqrt[j] * scale;
  }
  // Terms, for folding-in: ΓΣ^{α−1} = D_c^{-½} V Σ^{α−2}·Σ, with V = Bᵀ W Σ^{-1}.
  const U = new Float64Array(m * k);
  for (let d = 0; d < k; d++) {
    const s = sigma[d];
    const scale = s > 1e-12 ? Math.pow(s, alpha - 1) / s : 0;
    for (let a = 0; a < rr; a++) {
      const w = vectors[a * rr + d];
      if (w === 0) continue;
      for (let i = 0; i < m; i++) U[i * k + d] += Bt.data[a * m + i] * w;
    }
    for (let i = 0; i < m; i++) U[i * k + d] *= cInvSqrt[i] * scale;
  }
  // Sign convention as in lsi.ts: the largest-magnitude term loading positive.
  for (let d = 0; d < k; d++) {
    let best = 0;
    for (let i = 0; i < m; i++) if (Math.abs(U[i * k + d]) > Math.abs(best)) best = U[i * k + d];
    if (best < 0) {
      for (let i = 0; i < m; i++) U[i * k + d] = -U[i * k + d];
      for (let j = 0; j < n; j++) unitCoords[j * k + d] = -unitCoords[j * k + d];
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
    retained: inertia > 0 ? kept / inertia : 0,
    U,
    unitCoords,
    globalWeight,
    fingerprint: fingerprintUnits(units, { ...o, method: "ca" } as LsiOptions),
  };
}

/** Total inertia (χ²/N) of the same matrix — exposed for the test that the
 *  principal inertias sum to it. */
export function totalInertia(units: LsiUnit[], opts: CaOptions = {}): number {
  const { A } = buildTermMatrix(units, { weighting: "raw", ...opts });
  const rs = new Float64Array(A.cols);
  const cs = new Float64Array(A.rows);
  for (let j = 0; j < A.cols; j++)
    for (let p = A.colPtr[j]; p < A.colPtr[j + 1]; p++) {
      rs[j] += A.vals[p];
      cs[A.rowIdx[p]] += A.vals[p];
    }
  // p²/(r c) = f²/(row sum · column sum): N cancels.
  let x = -1;
  for (let j = 0; j < A.cols; j++)
    for (let p = A.colPtr[j]; p < A.colPtr[j + 1]; p++) x += (A.vals[p] * A.vals[p]) / (rs[j] * cs[A.rowIdx[p]]);
  return x;
}
