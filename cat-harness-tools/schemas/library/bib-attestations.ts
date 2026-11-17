/**
 * BIBLIOGRAPHY ATTESTATIONS — the ONE reader and the ONE writer for a folio's
 * two bibliography judgement ledgers.
 *
 * | ledger | legacy file (under the folio directory) | attestations family |
 * |---|---|---|
 * | source ledger (`source-ledger/v1`) | `bib-qa-verifications.json` | `bib-verification` |
 * | human review | `schema/references.review.json` | `bib-human-review` |
 *
 * Shapes and layout are in `schemas/sdlc/qa-attestations.ts` (§"The bibliography
 * families"). Every platform reader and writer of either ledger goes through
 * this module; none opens a ledger file itself.
 *
 * ## Where a read comes from — and it always says so
 *
 * - `store`  — the family's subtree exists in the attestation store: the
 *   store is the source. A legacy file still present beside it is reported
 *   (`legacyPresent`) and ignored.
 * - `legacy` — the store, or this family's subtree of it, is absent and the
 *   legacy file exists: an unmigrated folio. Read from the legacy file.
 * - `none`   — neither: an empty ledger.
 *
 * Every read returns a `note` naming which, for the caller to print. A file
 * in the store that is `corrupt` or `unknown` THROWS ({@link BibAttestationError}).
 *
 * ## Writes go where the read came from
 *
 * A writer reads, changes the assembled ledger, and writes it back: to the
 * store when the read was `store` or `none`, to the legacy file when the read
 * was `legacy` (an unmigrated folio stays unmigrated until
 * `migrate-bib-attestations.ts --apply` moves it). A store write refuses —
 * writing nothing — if any existing file in the family is corrupt, rewrites
 * only files whose content changes, records a subject that lost its last row
 * as an EMPTY file (a retraction is recorded, never a deletion), and reads
 * the store back and compares every row before returning.
 *
 * ## The review ledger's rules
 *
 * Status values are {@link BIB_REVIEW_STATUSES}; a reference with no review is
 * `unreviewed`; an entry is stale when its `entryHash` — a 12-char SHA-256
 * prefix of the canonical-JSON-serialised `references.ts` entry, recursively
 * key-sorted — drifts from the current entry (computed by
 * `validate-references-human-review.ts`). The migration refuses a legacy
 * `_meta` whose `statusEnum` disagrees.
 *
 * @module schemas/bib-attestations
 * @graphNode schema
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import type { LedgerEntry, SourceLedger } from "./bib-verification";
import { folioDir } from "../kg/cat-harness";
import {
  ATTESTATIONS_SUFFIX,
  attestationsHomeFor,
  bibRowVerifierUnknown,
  BIB_REVIEW_STATUSES,
  isAsciiEscaped,
  jsonText,
  QA_ATTESTATIONS_SCHEMA,
  readAttestationFile,
} from "../sdlc/qa-attestations";

export { BIB_REVIEW_STATUSES };

export const BIB_VERIFICATION_FAMILY = "bib-verification" as const;
export const BIB_HUMAN_REVIEW_FAMILY = "bib-human-review" as const;
export type BibFamily = typeof BIB_VERIFICATION_FAMILY | typeof BIB_HUMAN_REVIEW_FAMILY;

/** The legacy file names, under `folioDir(repoRoot)`. */
export const LEGACY_LEDGER_FILE = "bib-qa-verifications.json";
export const LEGACY_REVIEW_FILE = join("schema", "references.review.json");

/** The source ledger's header — constants, so the store need not hold them. */
export const SOURCE_LEDGER_SCHEMA = "source-ledger/v1";
export const SOURCE_LEDGER_AUTHORITATIVE_FOR =
  "Source document <-> reference join, source-verification status, and " +
  "relevance triage. Bibliographic metadata lives ONLY in " +
  "folio/schema/references.ts; this file stores no title, author, " +
  "year, or DOI.";

export type BibReviewStatus = (typeof BIB_REVIEW_STATUSES)[number];
export interface BibReview {
  status: BibReviewStatus;
  by?: string;
  date?: string;
  source?: string;
  page?: string;
  entryHash?: string;
  [k: string]: unknown;
}

export type ReadOrigin = "store" | "legacy" | "none";

/** A store file that cannot be trusted. Nothing is answered past it. */
export class BibAttestationError extends Error {
  constructor(
    readonly path: string,
    readonly state: "corrupt" | "unknown",
    reason: string,
  ) {
    super(`bib attestation store ${state} at ${path}: ${reason}`);
    this.name = "BibAttestationError";
  }
}

// ── Paths ────────────────────────────────────────────────────────────────

/** The attestation home and this family's subtree for a folio repository. */
export function bibFamilyDir(repoRoot: string, family: BibFamily): { famDir: string; storeRoot: string } {
  const home = attestationsHomeFor(repoRoot);
  return { famDir: join(home.root, family), storeRoot: home.storeRoot };
}

export function legacyPath(repoRoot: string, family: BibFamily): string {
  return join(folioDir(repoRoot), family === BIB_VERIFICATION_FAMILY ? LEGACY_LEDGER_FILE : LEGACY_REVIEW_FILE);
}

const SAFE_ID = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
const posix = (p: string) => p.split(sep).join("/");

/** The subject a ledger row belongs to, and its store path under the family directory. */
export function verificationSubject(row: Record<string, unknown>): { kind: "reference" | "source"; id: string; path: string | null; rel: string } {
  const id = row["id"];
  if (typeof id === "string") {
    if (!SAFE_ID.test(id)) throw new Error(`reference id ${JSON.stringify(id)} is not a safe file name; refusing to compose a store path`);
    return { kind: "reference", id, path: null, rel: `reference/${id}${ATTESTATIONS_SUFFIX}` };
  }
  const src = row["source"] as { kind?: unknown; file?: unknown; url?: unknown } | undefined;
  if (src?.kind === "upload" && typeof src.file === "string") {
    const f = posix(src.file);
    if (f.startsWith("/") || f.split("/").some((s) => s === ".." || s === "." || s === "")) {
      throw new Error(`source file ${JSON.stringify(src.file)} is not a clean repo-relative path`);
    }
    return { kind: "source", id: f, path: f, rel: `source/${f}${ATTESTATIONS_SUFFIX}` };
  }
  if (src?.kind === "external" && typeof src.url === "string") {
    const h = createHash("sha256").update(src.url).digest("hex").slice(0, 16);
    return { kind: "source", id: src.url, path: null, rel: `source/external/${h}${ATTESTATIONS_SUFFIX}` };
  }
  throw new Error(`a ledger row with no id names no usable source: ${JSON.stringify(row).slice(0, 200)}`);
}

export function reviewSubjectRel(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error(`reference id ${JSON.stringify(id)} is not a safe file name; refusing to compose a store path`);
  return `reference/${id}${ATTESTATIONS_SUFFIX}`;
}

// ── Store IO ─────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(ATTESTATIONS_SUFFIX)) out.push(p);
  }
  return out.sort();
}

interface StoreFile {
  abs: string;
  rel: string;
  text: string;
  json: Record<string, unknown>;
}

/** Every file of a family, validated. Throws on the first corrupt or unknown one. */
function readFamilyFiles(famDir: string, storeRoot: string, family: BibFamily): StoreFile[] {
  let files: string[];
  try {
    files = walk(famDir);
  } catch (e) {
    throw new BibAttestationError(famDir, "unknown", e instanceof Error ? e.message : String(e));
  }
  return files.map((abs) => {
    const r = readAttestationFile(abs, storeRoot);
    if (r.state !== "hit") throw new BibAttestationError(abs, r.state === "corrupt" ? "corrupt" : "unknown", r.reason);
    const json = r.file as unknown as Record<string, unknown>;
    if (json["family"] !== family) throw new BibAttestationError(abs, "corrupt", `family ${String(json["family"])} in the ${family} subtree`);
    return { abs, rel: posix(relative(famDir, abs)), text: r.text, json };
  });
}

/** Is this family's subtree there to read? `absent` when the store or the subtree is not. */
function familyState(famDir: string, storeRoot: string): "present" | "absent" {
  try {
    if (!existsSync(storeRoot) || !existsSync(famDir)) return "absent";
    if (!statSync(famDir).isDirectory()) throw new BibAttestationError(famDir, "unknown", "the family path is not a directory");
    return "present";
  } catch (e) {
    if (e instanceof BibAttestationError) throw e;
    throw new BibAttestationError(famDir, "unknown", e instanceof Error ? e.message : String(e));
  }
}

function render(doc: Record<string, unknown>, asciiEscape: boolean): string {
  return `${jsonText(doc, asciiEscape)}\n`;
}

/**
 * Write a family's files from `{rel → doc}`. Existing files absent from the
 * map are rewritten EMPTY (`emptyDoc`). Refuses — writing nothing — if any
 * existing file is unreadable. Returns the paths written.
 */
function writeFamily(
  famDir: string,
  storeRoot: string,
  family: BibFamily,
  docs: Map<string, Record<string, unknown>>,
  emptyDoc: (existing: Record<string, unknown>) => Record<string, unknown>,
  asciiEscape: boolean | undefined,
): string[] {
  const existing = familyState(famDir, storeRoot) === "present" ? readFamilyFiles(famDir, storeRoot, family) : [];
  const byRel = new Map(existing.map((f) => [f.rel, f]));
  // A new file takes the style its family already has; failing that, the caller's.
  const famStyle = existing.length > 0 ? existing.some((f) => isAsciiEscaped(f.text)) : (asciiEscape ?? false);
  const plan: { abs: string; body: string }[] = [];
  for (const [rel, doc] of docs) {
    const prior = byRel.get(rel);
    const body = render(doc, prior ? isAsciiEscaped(prior.text) : famStyle);
    if (prior?.text !== body) plan.push({ abs: join(famDir, rel), body });
  }
  for (const f of existing) {
    if (docs.has(f.rel)) continue;
    const body = render(emptyDoc(f.json), isAsciiEscaped(f.text));
    if (f.text !== body) plan.push({ abs: f.abs, body });
  }
  for (const { abs, body } of plan) {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return plan.map((p) => p.abs);
}

// ── The source ledger (bib-verification) ─────────────────────────────────

export interface LedgerRead {
  from: ReadOrigin;
  ledger: SourceLedger;
  /** One line for the caller to print: which home answered. */
  note: string;
  /** Store reads only: a legacy file is still there beside the store. */
  legacyPresent?: boolean;
  /** Store reads only: how many store files were read. */
  files?: number;
}

const emptyLedger = (): SourceLedger => ({ _schema: SOURCE_LEDGER_SCHEMA, _authoritative_for: SOURCE_LEDGER_AUTHORITATIVE_FOR, entries: [] });

/** Assemble the ledger from the store's files, in recorded order. */
function assembleLedger(files: StoreFile[]): SourceLedger {
  const rows: { position: number; entry: LedgerEntry; at: string }[] = [];
  for (const f of files) {
    const subject = f.json["subject"] as { kind: string; id: string };
    for (const rec of f.json["verifications"] as { position: number; entry: Record<string, unknown> }[]) {
      let want: string;
      try {
        want = verificationSubject(rec.entry).rel;
      } catch (e) {
        throw new BibAttestationError(f.abs, "corrupt", e instanceof Error ? e.message : String(e));
      }
      if (want !== f.rel) throw new BibAttestationError(f.abs, "corrupt", `a row for ${want} is filed under ${f.rel} (subject ${subject.kind}:${subject.id})`);
      rows.push({ position: rec.position, entry: rec.entry as unknown as LedgerEntry, at: f.abs });
    }
  }
  rows.sort((a, b) => a.position - b.position);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.position === rows[i - 1]!.position) {
      throw new BibAttestationError(rows[i]!.at, "corrupt", `position ${rows[i]!.position} is also held by ${rows[i - 1]!.at}`);
    }
  }
  return { ...emptyLedger(), entries: rows.map((r) => r.entry) };
}

/** Read the source ledger from wherever it lives. Throws {@link BibAttestationError} on an unreadable store file. */
export function readSourceLedger(repoRoot: string): LedgerRead {
  const { famDir, storeRoot } = bibFamilyDir(repoRoot, BIB_VERIFICATION_FAMILY);
  const legacy = legacyPath(repoRoot, BIB_VERIFICATION_FAMILY);
  if (familyState(famDir, storeRoot) === "present") {
    const files = readFamilyFiles(famDir, storeRoot, BIB_VERIFICATION_FAMILY);
    const ledger = assembleLedger(files);
    const legacyPresent = existsSync(legacy);
    return {
      from: "store",
      ledger,
      files: files.length,
      legacyPresent,
      note:
        `source ledger: ${ledger.entries.length} row(s) from the attestation store (${posix(relative(repoRoot, famDir))}, ${files.length} file(s))` +
        (legacyPresent ? `; the legacy ${posix(relative(repoRoot, legacy))} is still present and was NOT read` : ""),
    };
  }
  if (existsSync(legacy)) {
    const raw = JSON.parse(readFileSync(legacy, "utf-8")) as SourceLedger;
    return {
      from: "legacy",
      ledger: { ...raw, entries: Array.isArray(raw.entries) ? raw.entries : [] },
      note: `source ledger: read from the LEGACY file ${posix(relative(repoRoot, legacy))} — the attestation store has no ${BIB_VERIFICATION_FAMILY} family yet (run migrate-bib-attestations.ts --apply)`,
    };
  }
  return { from: "none", ledger: emptyLedger(), note: "source ledger: none — no attestation store family and no legacy file" };
}

/** The store files a ledger splits into, `{rel → doc}`. Positions are array indices. */
export function ledgerToStoreDocs(entries: readonly unknown[]): Map<string, Record<string, unknown>> {
  const docs = new Map<string, Record<string, unknown>>();
  entries.forEach((raw, position) => {
    const entry = raw as Record<string, unknown>;
    const s = verificationSubject(entry);
    let doc = docs.get(s.rel);
    if (doc === undefined) {
      doc = { $schema: QA_ATTESTATIONS_SCHEMA, family: BIB_VERIFICATION_FAMILY, subject: { kind: s.kind, id: s.id, path: s.path }, verifications: [] };
      docs.set(s.rel, doc);
    }
    const rec: Record<string, unknown> = { position };
    if (bibRowVerifierUnknown(entry)) rec["verifier"] = "unknown";
    rec["entry"] = entry;
    (doc["verifications"] as unknown[]).push(rec);
  });
  return docs;
}

export interface WriteResult {
  to: "store" | "legacy";
  /** Paths written (store) or the legacy path. */
  written: string[];
  note: string;
}

/**
 * Write the assembled source ledger back to where it is read from. Store
 * writes are verified by reading back. `opts.to` forces a destination (the
 * migration uses `"store"`).
 */
export function writeSourceLedger(repoRoot: string, ledger: SourceLedger, opts: { to?: "store" | "legacy"; asciiEscape?: boolean } = {}): WriteResult {
  if (ledger._schema !== SOURCE_LEDGER_SCHEMA) throw new Error(`refusing to write a ledger whose _schema is ${String(ledger._schema)}, not ${SOURCE_LEDGER_SCHEMA}`);
  const { famDir, storeRoot } = bibFamilyDir(repoRoot, BIB_VERIFICATION_FAMILY);
  const legacy = legacyPath(repoRoot, BIB_VERIFICATION_FAMILY);
  const to = opts.to ?? (familyState(famDir, storeRoot) === "present" || !existsSync(legacy) ? "store" : "legacy");
  if (to === "legacy") {
    writeFileSync(legacy, `${JSON.stringify(ledger, null, 2)}\n`);
    return { to, written: [legacy], note: `source ledger: wrote the LEGACY file ${posix(relative(repoRoot, legacy))} (this folio's store has no ${BIB_VERIFICATION_FAMILY} family yet)` };
  }
  const docs = ledgerToStoreDocs(ledger.entries);
  const written = writeFamily(famDir, storeRoot, BIB_VERIFICATION_FAMILY, docs, (j) => ({ ...j, verifications: [] }), opts.asciiEscape);
  const back = readSourceLedger(repoRoot);
  const same =
    back.from === "store" &&
    back.ledger.entries.length === ledger.entries.length &&
    back.ledger.entries.every((e, i) => JSON.stringify(e) === JSON.stringify(ledger.entries[i]));
  if (!same) throw new Error(`the attestation store did not read back the ${ledger.entries.length} row(s) just written to ${famDir}`);
  return { to, written, note: `source ledger: wrote ${written.length} file(s) under ${posix(relative(repoRoot, famDir))} (${ledger.entries.length} row(s))` };
}

// ── The human review ledger (bib-human-review) ───────────────────────────

export interface ReviewRead {
  from: ReadOrigin;
  /** Reference id → review, in recorded order. */
  reviews: Record<string, BibReview>;
  /** The legacy file's `_meta`, when that is where the read came from. */
  meta?: unknown;
  note: string;
  legacyPresent?: boolean;
  files?: number;
}

export function readHumanReviews(repoRoot: string): ReviewRead {
  const { famDir, storeRoot } = bibFamilyDir(repoRoot, BIB_HUMAN_REVIEW_FAMILY);
  const legacy = legacyPath(repoRoot, BIB_HUMAN_REVIEW_FAMILY);
  if (familyState(famDir, storeRoot) === "present") {
    const files = readFamilyFiles(famDir, storeRoot, BIB_HUMAN_REVIEW_FAMILY);
    const rows: { position: number; id: string; review: BibReview; at: string }[] = [];
    for (const f of files) {
      const subject = f.json["subject"] as { kind: string; id: string };
      if (subject.kind !== "reference" || reviewSubjectRel(subject.id) !== f.rel) {
        throw new BibAttestationError(f.abs, "corrupt", `subject ${subject.kind}:${subject.id} is not the reference this path names`);
      }
      for (const rec of f.json["reviews"] as { position: number; review: BibReview }[]) rows.push({ position: rec.position, id: subject.id, review: rec.review, at: f.abs });
    }
    rows.sort((a, b) => a.position - b.position);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i]!.position === rows[i - 1]!.position) throw new BibAttestationError(rows[i]!.at, "corrupt", `position ${rows[i]!.position} is also held by ${rows[i - 1]!.at}`);
    }
    const legacyPresent = existsSync(legacy);
    return {
      from: "store",
      reviews: Object.fromEntries(rows.map((r) => [r.id, r.review])),
      files: files.length,
      legacyPresent,
      note:
        `human reviews: ${rows.length} from the attestation store (${posix(relative(repoRoot, famDir))}, ${files.length} file(s))` +
        (legacyPresent ? `; the legacy ${posix(relative(repoRoot, legacy))} is still present and was NOT read` : ""),
    };
  }
  if (existsSync(legacy)) {
    const raw = JSON.parse(readFileSync(legacy, "utf-8")) as { _meta?: unknown; reviews?: Record<string, BibReview> };
    return {
      from: "legacy",
      reviews: raw.reviews ?? {},
      meta: raw._meta,
      note: `human reviews: read from the LEGACY file ${posix(relative(repoRoot, legacy))} — the attestation store has no ${BIB_HUMAN_REVIEW_FAMILY} family yet (run migrate-bib-attestations.ts --apply)`,
    };
  }
  return { from: "none", reviews: {}, note: "human reviews: none — no attestation store family and no legacy file" };
}

export function reviewsToStoreDocs(reviews: Record<string, unknown>): Map<string, Record<string, unknown>> {
  const docs = new Map<string, Record<string, unknown>>();
  Object.entries(reviews).forEach(([id, review], position) => {
    docs.set(reviewSubjectRel(id), {
      $schema: QA_ATTESTATIONS_SCHEMA,
      family: BIB_HUMAN_REVIEW_FAMILY,
      subject: { kind: "reference", id, path: null },
      reviews: [{ position, review }],
    });
  });
  return docs;
}

/** Write every review back to where they are read from. A removed review is recorded as `reviews: []`. */
export function writeHumanReviews(repoRoot: string, reviews: Record<string, BibReview>, opts: { to?: "store" | "legacy"; asciiEscape?: boolean } = {}): WriteResult {
  const { famDir, storeRoot } = bibFamilyDir(repoRoot, BIB_HUMAN_REVIEW_FAMILY);
  const legacy = legacyPath(repoRoot, BIB_HUMAN_REVIEW_FAMILY);
  const to = opts.to ?? (familyState(famDir, storeRoot) === "present" || !existsSync(legacy) ? "store" : "legacy");
  if (to === "legacy") {
    // Keep the legacy file's own `_meta` and every other top-level key.
    const raw = JSON.parse(readFileSync(legacy, "utf-8")) as Record<string, unknown>;
    raw["reviews"] = reviews;
    writeFileSync(legacy, `${JSON.stringify(raw, null, 2)}\n`);
    return { to, written: [legacy], note: `human reviews: wrote the LEGACY file ${posix(relative(repoRoot, legacy))} (this folio's store has no ${BIB_HUMAN_REVIEW_FAMILY} family yet)` };
  }
  const docs = reviewsToStoreDocs(reviews);
  const written = writeFamily(famDir, storeRoot, BIB_HUMAN_REVIEW_FAMILY, docs, (j) => ({ ...j, reviews: [] }), opts.asciiEscape);
  const back = readHumanReviews(repoRoot);
  const ids = Object.keys(reviews);
  const same =
    back.from === "store" &&
    Object.keys(back.reviews).length === ids.length &&
    ids.every((id) => JSON.stringify(back.reviews[id]) === JSON.stringify(reviews[id]));
  if (!same) throw new Error(`the attestation store did not read back the ${ids.length} review(s) just written to ${famDir}`);
  return { to, written, note: `human reviews: wrote ${written.length} file(s) under ${posix(relative(repoRoot, famDir))} (${ids.length} review(s))` };
}

// ── Byte-level round trip (used by the migration and its test) ───────────

/**
 * Serialise `value` in the style of `like`: its indent width, its ASCII
 * escaping, its trailing newline. The legacy ledgers were written by both
 * Python (`indent=1`, ASCII-escaped) and TypeScript (`indent=2`), so a
 * round-trip is proven against the file's OWN style.
 */
export function serialiseLike(value: unknown, like: string): string {
  const m = /\n( +)\S/.exec(like);
  const indent = m ? m[1]!.length : 2;
  const text = jsonText(value, isAsciiEscaped(like)).replace(/^( +)/gm, (s) => " ".repeat((s.length / 2) * indent));
  return like.endsWith("\n") ? `${text}\n` : text;
}
