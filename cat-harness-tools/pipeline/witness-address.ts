/**
 * Where a Lean witness LIVES, and whether one is there.
 *
 * @module pipeline/witness-address
 *
 * ## Why this is core and the rest of witnessing is not
 *
 * Third time this seam has appeared, and the test is the same each time —
 * `schemas/lean-packages.ts` (the `lean.ref` grammar), `pipeline/
 * lean-lexer.ts` (comment stripping and declaration splitting), and now this:
 * **would core function without the science layer installed?**
 *
 * It would not. `BlockBase` carries an optional `lean` field, and
 * `export-json.ts` — the generic exporter, which a document folio runs as much
 * as a paper one — emits `witnessed` for every block that has one. Answering
 * that question is two lines of arithmetic: hash the file, look for a sibling
 * at the hash-derived name.
 *
 * What is genuinely the science layer's is everything that PRODUCES or
 * INVALIDATES a witness — `stampWitness`, `clearWitnesses`, `isStale`,
 * `readWitnessMeta`, `findAllWitnesses` — because those run proofs, read git
 * history and manage a lifecycle. Those stay in `scripts/lean-witness.ts`,
 * which re-exports these three so its own callers are unaffected.
 *
 * The distinction is the one that keeps recurring: **naming a thing is
 * grammar; doing something with it is tooling.**
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

/**
 * Length of the hash in a witness filename.
 *
 * Twelve hex characters of SHA-256. It is part of the on-disk NAME, so
 * changing it orphans every witness in every folio — which is why it is a
 * named constant here rather than a literal at the two call sites.
 */
export const WITNESS_HASH_LENGTH = 12;

/** 12-char SHA-256 hex prefix of a file's content. */
export function leanFileHash(filePath: string): string {
  const content = readFileSync(filePath, "utf-8");
  return createHash("sha256").update(content).digest("hex").slice(0, WITNESS_HASH_LENGTH);
}

/** The witness file's path for a `.lean` file at a given content hash. */
export function witnessPath(leanFile: string, hash: string): string {
  return `${leanFile}.${hash}.witness`;
}

/**
 * Is there a witness for this file's CURRENT content?
 *
 * The hash is returned alongside the verdict because every caller wants both
 * and recomputing it is a second file read. A missing `.lean` file is
 * `{ witnessed: false, hash: "" }` rather than a throw: a block may declare a
 * `lean.ref` whose file has not been written yet, which is a content state the
 * exporter reports rather than an error it raises.
 */
export function isWitnessed(leanFile: string): { witnessed: boolean; hash: string } {
  if (!existsSync(leanFile)) return { witnessed: false, hash: "" };
  const hash = leanFileHash(leanFile);
  return { witnessed: existsSync(witnessPath(leanFile, hash)), hash };
}
