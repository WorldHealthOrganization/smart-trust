#!/usr/bin/env bun
/**
 * IDEMPOTENT: move a folio's two bibliography judgement ledgers into the
 * attestation store.
 *
 * | legacy file (under the folio directory) | family |
 * |---|---|
 * | `bib-qa-verifications.json` | `bib-verification`, one file per reference (orphan sources by file) |
 * | `schema/references.review.json` | `bib-human-review`, one file per reference |
 *
 * Shapes: `schemas/sdlc/qa-attestations.ts`. Reading and writing:
 * `schemas/library/bib-attestations.ts`, which falls back to the legacy file while a
 * family is absent from the store — so a folio keeps working before and after.
 *
 * ## The round trip is the licence
 *
 * `--apply` writes the store, then reads it back through the SAME reader every
 * caller uses, and serialises the result in the legacy file's own style
 * (indent, ASCII escaping, trailing newline). Unless that is BYTE-IDENTICAL to
 * the legacy file — header, every row, every key, every order — the files it
 * just created are removed again and it exits 1. Rows with no `verified_by`
 * are carried as `verifier: "unknown"`; nothing is attributed.
 *
 * For the review ledger the round trip covers `reviews`; its `_meta` block is
 * format documentation and is refused unless its `statusEnum` is the schema's
 * own.
 *
 * Nothing is deleted: the legacy files stay until a person removes them, and
 * the reader ignores them (saying so) once the store holds the family. A
 * family already in the store is left alone when it round-trips and refused
 * (exit 1) when it does not.
 *
 *   bun run cat-harness-tools/scripts/migrate-bib-attestations.ts [--repo <dir>] [--apply | --check] [--json] [--family bib-verification|bib-human-review]
 *   bun run cat-harness-tools/scripts/migrate-bib-attestations.ts [--repo <dir>] --export verification|review
 *
 * `--export verification|review` prints what the ONE reader returns (the
 * assembled ledger, or the reviews map) as JSON on stdout, its provenance
 * note on stderr — the hook a non-TypeScript reader (qou's Python
 * `scripts/lib/bib_ledger.py --parity`) checks itself against.
 *
 * No flag reports the plan and writes nothing. `--check` exits 1 unless every
 * legacy file present round-trips from the store.
 *
 * Exit: 0 done / nothing waiting; 1 `--check` found work, or a round trip failed;
 * 3 a file could not be read (nothing is guessed).
 *
 * @module scripts/migrate-bib-attestations
 * @covers attestations
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { relative, resolve } from "node:path";

import "../schemas/kg/folio-graph-typology.js";
import {
  BIB_HUMAN_REVIEW_FAMILY,
  BIB_REVIEW_STATUSES,
  BIB_VERIFICATION_FAMILY,
  BibAttestationError,
  bibFamilyDir,
  legacyPath,
  readHumanReviews,
  readSourceLedger,
  serialiseLike,
  SOURCE_LEDGER_AUTHORITATIVE_FOR,
  SOURCE_LEDGER_SCHEMA,
  writeHumanReviews,
  writeSourceLedger,
  type BibFamily,
  type BibReview,
} from "../schemas/library/bib-attestations.js";
import type { SourceLedger } from "../schemas/library/bib-verification.js";

export interface FamilyReport {
  family: BibFamily;
  legacy: string | null;
  /** `waiting`: legacy only; `migrated`: store round-trips; `diverged`: store does not match legacy; `store-only`; `nothing`. */
  state: "waiting" | "migrated" | "diverged" | "store-only" | "nothing" | "refused";
  rows: number;
  unknownVerifier?: number;
  wrote?: number;
  detail?: string;
}

/** The legacy text, rebuilt from what the store reader returns. `undefined` when the store does not hold the family. */
function roundTrip(repoRoot: string, family: BibFamily, legacyText: string): { ok: boolean; detail: string } {
  if (family === BIB_VERIFICATION_FAMILY) {
    const r = readSourceLedger(repoRoot);
    if (r.from !== "store") return { ok: false, detail: "the store does not hold the family" };
    const text = serialiseLike(r.ledger, legacyText);
    return text === legacyText ? { ok: true, detail: `byte-identical (${r.ledger.entries.length} rows, ${r.files} files)` } : { ok: false, detail: firstDiff(text, legacyText) };
  }
  const r = readHumanReviews(repoRoot);
  if (r.from !== "store") return { ok: false, detail: "the store does not hold the family" };
  const legacy = JSON.parse(legacyText) as Record<string, unknown>;
  const rebuilt = { ...legacy, reviews: r.reviews };
  const text = serialiseLike(rebuilt, legacyText);
  return text === legacyText ? { ok: true, detail: `byte-identical (${Object.keys(r.reviews).length} reviews, ${r.files} files)` } : { ok: false, detail: firstDiff(text, legacyText) };
}

function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `differs at byte ${i}: store gives ${JSON.stringify(a.slice(Math.max(0, i - 40), i + 40))}, legacy has ${JSON.stringify(b.slice(Math.max(0, i - 40), i + 40))}`;
}

/** What a legacy file must look like before it may be moved. `undefined` = fine. */
function preflight(family: BibFamily, legacy: Record<string, unknown>): string | undefined {
  if (family === BIB_VERIFICATION_FAMILY) {
    const keys = Object.keys(legacy);
    if (legacy["_schema"] !== SOURCE_LEDGER_SCHEMA) return `_schema is ${JSON.stringify(legacy["_schema"])}, not ${SOURCE_LEDGER_SCHEMA}`;
    if (legacy["_authoritative_for"] !== undefined && legacy["_authoritative_for"] !== SOURCE_LEDGER_AUTHORITATIVE_FOR) {
      return "_authoritative_for differs from the platform's header; the store would not reproduce it";
    }
    const extra = keys.filter((k) => !["_schema", "_authoritative_for", "entries"].includes(k));
    if (extra.length) return `top-level key(s) the store does not hold: ${extra.join(", ")}`;
    if (!Array.isArray(legacy["entries"])) return "entries is not an array";
    return undefined;
  }
  const meta = legacy["_meta"] as { statusEnum?: unknown } | undefined;
  if (meta?.statusEnum !== undefined && JSON.stringify(meta.statusEnum) !== JSON.stringify(BIB_REVIEW_STATUSES)) {
    return `_meta.statusEnum ${JSON.stringify(meta.statusEnum)} is not the schema's ${JSON.stringify(BIB_REVIEW_STATUSES)}`;
  }
  const extra = Object.keys(legacy).filter((k) => !["_meta", "reviews"].includes(k));
  if (extra.length) return `top-level key(s) the store does not hold: ${extra.join(", ")}`;
  if (typeof legacy["reviews"] !== "object" || legacy["reviews"] === null || Array.isArray(legacy["reviews"])) return "reviews is not an object";
  return undefined;
}

export function migrateFamily(repoRoot: string, family: BibFamily, mode: "plan" | "check" | "apply"): FamilyReport {
  const lp = legacyPath(repoRoot, family);
  const { famDir, storeRoot } = bibFamilyDir(repoRoot, family);
  const storeHas = existsSync(storeRoot) && existsSync(famDir);
  const rel = relative(repoRoot, lp);
  if (!existsSync(lp)) return { family, legacy: null, state: storeHas ? "store-only" : "nothing", rows: 0 };
  const text = readFileSync(lp, "utf-8");
  const legacy = JSON.parse(text) as Record<string, unknown>;
  const rows = family === BIB_VERIFICATION_FAMILY ? (legacy["entries"] as unknown[]).length : Object.keys((legacy["reviews"] as object) ?? {}).length;
  const unknownVerifier =
    family === BIB_VERIFICATION_FAMILY
      ? (legacy["entries"] as Record<string, unknown>[]).filter((e) => e["verified_by"] === undefined || e["verified_by"] === null).length
      : undefined;
  const base = { family, legacy: rel, rows, ...(unknownVerifier !== undefined ? { unknownVerifier } : {}) };
  const bad = preflight(family, legacy);
  if (bad) return { ...base, state: "refused", detail: bad };
  if (storeHas) {
    const rt = roundTrip(repoRoot, family, text);
    return { ...base, state: rt.ok ? "migrated" : "diverged", detail: rt.detail };
  }
  if (mode !== "apply") return { ...base, state: "waiting" };

  const asciiEscape = /\\u[0-9a-fA-F]{4}/.test(text);
  const res =
    family === BIB_VERIFICATION_FAMILY
      ? writeSourceLedger(repoRoot, legacy as unknown as SourceLedger, { to: "store", asciiEscape })
      : writeHumanReviews(repoRoot, legacy["reviews"] as Record<string, BibReview>, { to: "store", asciiEscape });
  const rt = roundTrip(repoRoot, family, text);
  if (!rt.ok) {
    // Every file here was created by this run (the family was absent), so undoing it removes nothing that was there before.
    rmSync(famDir, { recursive: true, force: true });
    return { ...base, state: "diverged", detail: `round trip FAILED, the new files were removed: ${rt.detail}` };
  }
  return { ...base, state: "migrated", wrote: res.written.length, detail: rt.detail };
}

function main(): void {
  const args = process.argv.slice(2);
  const val = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const repoRoot = resolve(val("--repo") ?? process.env["FOLIO_REPO_ROOT"] ?? process.cwd());
  const exp = val("--export");
  if (exp !== undefined) {
    try {
      if (exp === "verification") {
        const r = readSourceLedger(repoRoot);
        console.error(r.note);
        console.log(JSON.stringify(r.ledger));
      } else if (exp === "review") {
        const r = readHumanReviews(repoRoot);
        console.error(r.note);
        console.log(JSON.stringify(r.reviews));
      } else {
        console.error("--export takes verification or review");
        process.exit(2);
      }
    } catch (e) {
      if (e instanceof BibAttestationError) {
        console.error(`migrate-bib-attestations: ${e.message}`);
        process.exit(3);
      }
      throw e;
    }
    process.exit(0);
  }
  const mode = args.includes("--apply") ? "apply" : args.includes("--check") ? "check" : "plan";
  const only = val("--family");
  const families = ([BIB_VERIFICATION_FAMILY, BIB_HUMAN_REVIEW_FAMILY] as BibFamily[]).filter((f) => !only || f === only);
  let reports: FamilyReport[];
  try {
    reports = families.map((f) => migrateFamily(repoRoot, f, mode));
  } catch (e) {
    if (e instanceof BibAttestationError) {
      console.error(`migrate-bib-attestations: ${e.message}. Nothing was guessed.`);
      process.exit(3);
    }
    throw e;
  }
  if (args.includes("--json")) console.log(JSON.stringify({ repoRoot, mode, reports }, null, 2));
  else {
    for (const r of reports) {
      const extra = r.unknownVerifier !== undefined ? `, ${r.unknownVerifier} with no verifier (carried as unknown)` : "";
      console.log(`${r.family}: ${r.state} — ${r.rows} row(s)${extra}${r.legacy ? ` from ${r.legacy}` : ""}${r.wrote !== undefined ? `; wrote ${r.wrote} file(s)` : ""}${r.detail ? `\n  ${r.detail}` : ""}`);
    }
    if (mode === "plan") console.log("(plan only — pass --apply to write, --check to gate)");
  }
  const failed = reports.some((r) => r.state === "diverged" || r.state === "refused" || (mode === "check" && r.state === "waiting"));
  process.exit(failed ? 1 : 0);
}

if (import.meta.main) main();
