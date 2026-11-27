/**
 * The gate result store: every green, fully-derived result a gate has had, so
 * a run whose inputs match ANY of them reuses it instead of re-running.
 *
 * @module scripts/result-store
 * @graphNode none — a CI helper behind `ci-cone.ts`, not a gate itself
 *
 * The CI cone (`ci-cone.ts`, bean `folio-assistant-4rbc`) keeps ONE record per
 * check: main's last green run. A PR whose base is older than that run, or a
 * merge-train run between two pushes to main, matches nothing, and the check
 * runs. This store keeps many: one entry per distinct green result, keyed by
 * what it is a result OF.
 *
 * ## The key
 *
 * An entry is the gate id plus the cone's record of one green traced run: the
 * `f017` fingerprint without the tree (script closure, audited environment,
 * tool versions, `--against` baseline), the state of every path the run read,
 * and the answer of every git command it ran. Its file name is the sha-256 of
 * exactly that, so two runs with the same inputs write one file. The record
 * is DERIVED from the run that gave the verdict, never authored and never
 * stored as an input declaration (owner ruling, bean `4rbc`: "DERIVED = no
 * drift, no extra data fields").
 *
 * ## Layout
 *
 * `build/result-store/<gate>/<digest>.json`, one file per entry. Content
 * addressing makes two stores merge by file union: restoring several CI caches
 * into one directory, or keeping the directory on a store branch, needs no
 * merge step. Only a green result is ever written; a gate whose run was red,
 * undetermined or reached a `traced` site writes nothing.
 *
 * ## Deciding
 *
 * {@link findReusable} offers each entry of the gate, newest first, to the
 * caller's matcher (the cone's exact-match rule). The first that matches is
 * the reuse, reported with the run that recorded it. None matching, or a store
 * that cannot be read, means the gate runs: an unreadable entry is skipped,
 * never treated as a match.
 *
 * This module reads no clock and no environment. Callers pass `recordedAt`
 * and `run`.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Where the store lives, relative to the checkout. `build/` is git-ignored, so CI caches carry it. */
// input-site: inert #fdc7657e — the store's own directory, which every read set leaves out
export const STORE_DIR = join("build", "result-store");

/** The schema of one stored entry. */
export const RESULT_SCHEMA = "cat-gate-result/v1";

/** At most this many entries are kept per gate; the oldest go first. */
export const MAX_PER_GATE = 16;

/** One stored green result. `E` is the caller's record (the cone's `ConeCheck`). */
export interface StoredResult<E> {
  $schema: typeof RESULT_SCHEMA;
  /** The gate: a package.json script name. */
  gate: string;
  /** The recipe the entry was made under (the cone's tracer and fingerprint versions). Another recipe's entries are ignored. */
  recipe: string;
  /** When the run that recorded it finished, ISO 8601. Orders entries; never part of the key. */
  recordedAt: string;
  /** Which run recorded it: a commit sha and, in CI, a run id. Reported on reuse; never part of the key. */
  run: string;
  entry: E;
}

/** A JSON value with its object keys sorted, so equal records hash equal. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** The digest an entry is filed under: gate, recipe and the record itself. */
export function entryDigest(gate: string, recipe: string, entry: unknown): string {
  return createHash("sha256").update(canonical([gate, recipe, entry])).digest("hex");
}

/** The directory of one gate's entries. A script name such as `kg:audit:check` is percent-encoded. */
export function gateDir(root: string, gate: string): string {
  return join(root, STORE_DIR, encodeURIComponent(gate));
}

/** Every readable entry of `gate` under `recipe`, newest first. */
export function listResults<E>(root: string, gate: string, recipe: string): StoredResult<E>[] {
  const dir = gateDir(root, gate);
  if (!existsSync(dir)) return [];
  const out: StoredResult<E>[] = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    try {
      const r = JSON.parse(readFileSync(join(dir, name), "utf-8")) as StoredResult<E>;
      if (r.$schema !== RESULT_SCHEMA || r.gate !== gate || r.recipe !== recipe) continue;
      // A file whose name is not its content's digest was edited or truncated.
      if (`${entryDigest(gate, recipe, r.entry)}.json` !== name) continue;
      out.push(r);
    } catch {
      /* unreadable: never a match */
    }
  }
  return out.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : 0));
}

/**
 * File one green result. Returns its digest. An entry already present is left
 * as it is (same inputs, same verdict). The gate's oldest entries beyond
 * {@link MAX_PER_GATE} are removed.
 */
export function putResult<E>(root: string, r: Omit<StoredResult<E>, "$schema">): string {
  const digest = entryDigest(r.gate, r.recipe, r.entry);
  const dir = gateDir(root, r.gate);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${digest}.json`);
  if (!existsSync(file)) writeFileSync(file, `${JSON.stringify({ $schema: RESULT_SCHEMA, ...r }, null, 1)}\n`);
  const all = listResults<E>(root, r.gate, r.recipe);
  for (const old of all.slice(MAX_PER_GATE)) rmSync(join(dir, `${entryDigest(old.gate, old.recipe, old.entry)}.json`), { force: true });
  return digest;
}

/** What a matcher says about one entry: the cone's exact-match rule, or any rule of the same shape. */
export type Match = { skip: true; why: string } | { skip: false; why: string };

/** The reuse a gate may take, or why it must run. */
export type Reuse<E> = { reuse: true; result: StoredResult<E>; why: string } | { reuse: false; why: string };

/**
 * The newest stored result of `gate` that `match` accepts. Each entry is tried
 * at most once; the first match wins. With nothing stored, or nothing
 * matching, the gate runs, and the reason names how many entries were tried.
 */
export function findReusable<E>(root: string, gate: string, recipe: string, match: (entry: E) => Match): Reuse<E> {
  const all = listResults<E>(root, gate, recipe);
  if (all.length === 0) return { reuse: false, why: "no stored result" };
  let first: string | undefined;
  for (const r of all) {
    let m: Match;
    try {
      m = match(r.entry);
    } catch (e) {
      m = { skip: false, why: `could not compare: ${(e as Error).message}` };
    }
    if (m.skip) return { reuse: true, result: r, why: `reused ${r.run}: ${m.why}` };
    first ??= m.why;
  }
  return { reuse: false, why: `none of ${all.length} stored result(s) matches (newest: ${first})` };
}
