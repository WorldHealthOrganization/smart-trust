#!/usr/bin/env bun
/**
 * IDEMPOTENT: move every QA judgement still inside a derived file into the
 * attestation store (`schemas/sdlc/qa-attestations.ts`) — the ONE migration path
 * for all three families (kg-qa, block-qa, translation-qa).
 *
 * Judgements stay on main, and `baseline` pair attestations count as
 * judgements. A WRITER also moves a judgement it finds in a prior derived file
 * with no store entry as it saves; this command does a whole layer at
 * once, and `--check` is the gate that says nothing is still waiting.
 *
 * ## kg-qa — move, then strip
 *
 * 1. Read the sidecar. No `pair_attestations` / `voice_reviews` → nothing to
 *    do (this is what makes a second run a no-op).
 * 2. Compose the store file from the sidecar's OWN objects — same keys, same
 *    order, same values — so the attestation content is byte-preserved.
 * 3. If a store file is already there: identical content → already moved,
 *    go to 5; different content → REFUSE, report, touch neither file. Two
 *    disagreeing judgements are a person's to reconcile, not this script's.
 * 4. Write the store file, read it BACK, and compare entry by entry.
 * 5. Only then strip the two arrays from the sidecar. A sidecar is never
 *    stripped on the strength of a write that was not verified.
 *
 * ## block-qa and translation-qa — copy, never strip
 *
 * Every derived report (`test/results/<family>/**` and any legacy sibling
 * beside its subject) is read, and each entry whose `reviewer.kind` is not
 * `script` is added to the subject's store file, verbatim, unless the store
 * already holds it (same serialisation). The derived report keeps its copy:
 * it is the PROJECTION readers still take `criteria[id][0]` from (see the
 * module comment of `schemas/sdlc/qa-attestations.ts`). The store file keeps the
 * escaping of the report its entries came from, so their bytes survive.
 *
 * Nothing is deleted, in either family. `--dry-run` reports the plan and
 * writes nothing; `--check` measures and exits 1 if any judgement is still
 * only in a derived file.
 *
 *   bun run cat qa:attestations:migrate [--dry-run] [--check] [--json] [--family kg-qa|block-qa|translation-qa]
 *
 * Exit: 0 done / nothing waiting; 1 `--check` found a judgement not in the
 * store, or a kg-qa conflict; 3 a file could not be read (nothing is guessed).
 *
 * @module scripts/migrate-qa-attestations
 * @covers attestations, qa
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// `readDeclaration` throws on the `folio` kind unless core has registered it —
// the same side-effect import `qa-store.ts` carries, same reason.
import "../schemas/kg/folio-graph-typology.js";
import { findDeclarationFile, layerRootsIn } from "../schemas/kg/cat-harness.js";
import {
  ATTESTATIONS_SUFFIX,
  attestationKeyForDerived,
  attestationPathFor,
  CRITERIA_FAMILIES,
  criteriaAttestationsHome,
  entryIdentity,
  isAsciiEscaped,
  KG_JUDGEMENT_FIELDS,
  kgAttestationTrees,
  KG_QA_SIDECAR_SUFFIX as KG_SIDECAR_SUFFIX,
  QA_ATTESTATIONS_SCHEMA,
  readAttestationFile,
  readCriteriaAttestations,
  serialiseAttestations,
  splitCriteria,
  writeCriteriaAttestations,
  type AttestationKey,
  type CriteriaMap,
  type KgAttestations,
  type KgAttestationTree as TreePair,
} from "../schemas/sdlc/qa-attestations.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** The kg-qa arrays that are judgements, in the order the sidecar carried them. */
export const JUDGEMENT_FIELDS = KG_JUDGEMENT_FIELDS;

// ── kg-qa ────────────────────────────────────────────────────────────────

export type MigrationOutcome =
  | { state: "moved" | "already-moved"; sidecar: string; store: string; pairs: number; reviews: number }
  | { state: "conflict" | "unreadable"; sidecar: string; store: string; reason: string };

function walk(dir: string, suffix: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, suffix, acc);
    else if (e.name.endsWith(suffix)) acc.push(p);
  }
  return acc.sort();
}

/** The store file a sidecar's judgements compose, or `undefined` when it carries none. */
export function composeAttestations(sidecar: Record<string, unknown>): KgAttestations | undefined {
  const present = JUDGEMENT_FIELDS.filter((f) => Array.isArray(sidecar[f]) && (sidecar[f] as unknown[]).length > 0);
  if (present.length === 0) return undefined;
  const file: Record<string, unknown> = {
    $schema: QA_ATTESTATIONS_SCHEMA,
    family: "kg-qa",
    subject: sidecar["subject"],
  };
  for (const f of present) file[f] = sidecar[f];
  return file as KgAttestations;
}

/** Entry-level identity: the compact JSON of each judgement, per field. */
export function entryFingerprints(file: Record<string, unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of JUDGEMENT_FIELDS) {
    const list = file[f];
    out[f] = Array.isArray(list) ? list.map((e) => JSON.stringify(e)) : [];
  }
  return out;
}

const sameEntries = (a: Record<string, unknown>, b: Record<string, unknown>): boolean =>
  JSON.stringify(entryFingerprints(a)) === JSON.stringify(entryFingerprints(b)) &&
  JSON.stringify(a["subject"]) === JSON.stringify(b["subject"]);

/** Migrate one kg-qa tree. Pure apart from the files it is pointed at. */
export function migrateTree(pair: TreePair, opts: { dryRun?: boolean } = {}): MigrationOutcome[] {
  const outcomes: MigrationOutcome[] = [];
  for (const sidecar of walk(pair.kgTree, KG_SIDECAR_SUFFIX)) {
    const store = attestationPathFor(sidecar, pair.kgTree, pair.attHome, "kg-qa", KG_SIDECAR_SUFFIX);
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(readFileSync(sidecar, "utf-8")) as Record<string, unknown>;
    } catch (e) {
      // Not skipped quietly: an unreadable sidecar may be holding judgements.
      outcomes.push({ state: "unreadable", sidecar, store, reason: e instanceof Error ? e.message : String(e) });
      continue;
    }
    const composed = composeAttestations(json);
    if (composed === undefined) continue;
    const counts = { pairs: composed.pair_attestations?.length ?? 0, reviews: composed.voice_reviews?.length ?? 0 };

    let state: "moved" | "already-moved" = "moved";
    if (existsSync(store)) {
      let prior: Record<string, unknown>;
      try {
        prior = JSON.parse(readFileSync(store, "utf-8")) as Record<string, unknown>;
      } catch (e) {
        outcomes.push({ state: "conflict", sidecar, store, reason: `the store file is unreadable: ${e instanceof Error ? e.message : String(e)}` });
        continue;
      }
      if (!sameEntries(prior, composed as unknown as Record<string, unknown>)) {
        outcomes.push({ state: "conflict", sidecar, store, reason: "the store already holds DIFFERENT judgements for this subject; reconcile by hand" });
        continue;
      }
      state = "already-moved";
    } else if (!opts.dryRun) {
      mkdirSync(dirname(store), { recursive: true });
      writeFileSync(store, serialiseAttestations(composed));
      const back = JSON.parse(readFileSync(store, "utf-8")) as Record<string, unknown>;
      if (!sameEntries(back, composed as unknown as Record<string, unknown>)) {
        throw new Error(`${store}: read-back does not match what was written — stopping before any sidecar is stripped`);
      }
    }

    if (!opts.dryRun) {
      for (const f of JUDGEMENT_FIELDS) delete json[f];
      writeFileSync(sidecar, `${JSON.stringify(json, null, 2)}\n`);
    }
    outcomes.push({ state, sidecar, store, ...counts });
  }
  return outcomes;
}

/** What the kg-qa store holds, over every tree: files and judgement entries. */
export function kgStoreCounts(trees: TreePair[]): { files: number; pairs: number; reviews: number } {
  const out = { files: 0, pairs: 0, reviews: 0 };
  for (const t of trees) {
    for (const f of walk(join(t.attHome, "kg-qa"), ATTESTATIONS_SUFFIX)) {
      const fp = entryFingerprints(JSON.parse(readFileSync(f, "utf-8")) as Record<string, unknown>);
      out.files++;
      out.pairs += fp["pair_attestations"]!.length;
      out.reviews += fp["voice_reviews"]!.length;
    }
  }
  return out;
}

// ── block-qa and translation-qa ──────────────────────────────────────────

export interface CriteriaMigrationReport {
  root: string;
  derivedFiles: number;
  filesWithAttestations: number;
  entries: number;
  byFamily: Record<string, number>;
  alreadyHeld: number;
  added: number;
  storeFilesWritten: number;
  unreadable: string[];
  missing: string[];
}

// input-site: inert #6a924837 — names a build-output directory only to leave it out of a walk
const SKIP_DIRS = new Set(["node_modules", "_site", "vendor"]);

/** Every derived block/translation report under a layer, results tree first, then legacy siblings. */
export function derivedReports(instanceRoot: string): string[] {
  const out: string[] = [];
  const walkDerived = (dir: string, legacy: boolean): void => {
    let names: string[];
    try {
      names = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const name of names) {
      const abs = join(dir, name);
      let isDir = false;
      try {
        isDir = statSync(abs).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        if (!legacy) {
          walkDerived(abs, false);
          continue;
        }
        if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
        // The results tree is walked separately; `test/attestations` is the store itself.
        if (relative(instanceRoot, abs) === "test") continue;
        // A nested layer keeps its own store.
        if (findDeclarationFile(abs) !== undefined) continue;
        walkDerived(abs, true);
        continue;
      }
      if (!name.endsWith(".qa.json") && !name.endsWith(".translation-qa.json")) continue;
      if (legacy && name.endsWith(".qa.json") && !existsSync(abs.replace(/\.qa\.json$/, ".ts"))) continue;
      out.push(abs);
    }
  };
  for (const family of CRITERIA_FAMILIES) walkDerived(join(instanceRoot, "test", "results", family), false);
  walkDerived(instanceRoot, true);
  return out;
}

/** Migrate (or, with `check`, measure) one layer's block and translation judgements. */
export function migrateCriteria(instanceRoot: string, opts: { check?: boolean; dryRun?: boolean } = {}): CriteriaMigrationReport {
  const report: CriteriaMigrationReport = {
    root: instanceRoot,
    derivedFiles: 0,
    filesWithAttestations: 0,
    entries: 0,
    byFamily: {},
    alreadyHeld: 0,
    added: 0,
    storeFilesWritten: 0,
    unreadable: [],
    missing: [],
  };
  // Grouped by store file: a block's results-tree report and its legacy sibling share one.
  const pending = new Map<string, { key: AttestationKey; att: CriteriaMap; asciiEscape: boolean }>();
  for (const derived of derivedReports(instanceRoot)) {
    const key = attestationKeyForDerived(instanceRoot, derived);
    if (!key) continue;
    report.derivedFiles++;
    let doc: { criteria?: CriteriaMap };
    let text: string;
    try {
      text = readFileSync(derived, "utf-8");
      doc = JSON.parse(text) as { criteria?: CriteriaMap };
    } catch (err) {
      report.unreadable.push(`${relative(instanceRoot, derived)}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    // A bare entry object where an array belongs is wrapped by `loadQaReport`; do the same so it is not skipped.
    const criteria: CriteriaMap = {};
    for (const [id, v] of Object.entries(doc?.criteria ?? {})) {
      if (Array.isArray(v)) criteria[id] = v;
      else if (v && typeof v === "object") criteria[id] = [v];
    }
    const { attestations } = splitCriteria(criteria);
    const n = Object.values(attestations).reduce((a, l) => a + l.length, 0);
    if (n === 0) continue;
    report.filesWithAttestations++;
    report.entries += n;
    report.byFamily[key.family] = (report.byFamily[key.family] ?? 0) + n;
    const id = `${key.family}:${key.subject}@${key.locale ?? ""}`;
    const slot = pending.get(id) ?? { key, att: {}, asciiEscape: isAsciiEscaped(text) };
    for (const [cid, list] of Object.entries(attestations)) {
      const into = (slot.att[cid] ??= []);
      const seen = new Set(into.map(entryIdentity));
      for (const e of list) if (!seen.has(entryIdentity(e))) into.push(e);
    }
    pending.set(id, slot);
  }

  for (const { key, att, asciiEscape } of pending.values()) {
    const read = readCriteriaAttestations(instanceRoot, key);
    let movedSubject = false;
    let held: CriteriaMap = {};
    if (read.state === "hit") {
      held = structuredClone(read.criteria);
    } else if (read.state === "corrupt" || read.state === "unknown") {
      // A store file moved with its content directory (`git mv docs/source/... site-docs/source/...`)
      // still carries its old `subject.path` header until rewritten. If the file parses cleanly and
      // matches `key.family` and `key.locale`, treat its stale header as a pending migration rather
      // than an unreadable file so `qa:attestations:migrate` repairs it in place.
      const raw = read.state === "corrupt" ? readAttestationFile(read.path, criteriaAttestationsHome(instanceRoot).storeRoot) : undefined;
      const rawLocale = raw?.state === "hit" && raw.file.family === "translation-qa" ? raw.file.locale : undefined;
      if (raw?.state === "hit" && raw.file.family === key.family && rawLocale === key.locale && raw.file.subject.path !== key.subject) {
        movedSubject = true;
        held = structuredClone((raw.file as unknown as { criteria: CriteriaMap }).criteria);
        report.missing.push(`${relative(instanceRoot, read.path)} subject.path`);
      } else {
        report.unreadable.push(`${relative(instanceRoot, read.path)}: ${read.reason}`);
        continue;
      }
    }
    let added = 0;
    for (const [cid, list] of Object.entries(att)) {
      const into = (held[cid] ??= []);
      const seen = new Set(into.map(entryIdentity));
      for (const e of list) {
        if (seen.has(entryIdentity(e))) {
          report.alreadyHeld++;
          continue;
        }
        added++;
        report.missing.push(`${relative(instanceRoot, read.path)} ${cid}`);
        into.push(e);
      }
    }
    if ((added === 0 && !movedSubject) || opts.check || opts.dryRun) continue;
    report.added += added;
    if (writeCriteriaAttestations(instanceRoot, key, held, { asciiEscape })) report.storeFilesWritten++;
  }
  if (!opts.check && !opts.dryRun) report.missing = [];
  return report;
}

// ── CLI ──────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const check = argv.includes("--check");
  const asJson = argv.includes("--json");
  const fi = argv.indexOf("--family");
  const only = fi >= 0 ? argv[fi + 1] : undefined;
  const want = (f: string) => only === undefined || only === f;
  const host = HARNESS_ROOT; // the harness hosts the stores this migrates (70lx B2)
  const repo = resolve(host, "..");
  const rel = (p: string) => relative(repo, p);

  const kg: MigrationOutcome[] = [];
  if (want("kg-qa")) {
    for (const pair of kgAttestationTrees(repo, host)) kg.push(...migrateTree(pair, { dryRun: dryRun || check }));
  }
  const crit: CriteriaMigrationReport[] = [];
  if (want("block-qa") || want("translation-qa")) {
    for (const root of layerRootsIn(repo)) crit.push(migrateCriteria(root, { check, dryRun }));
  }

  // kg-qa under --check: a sidecar still carrying a judgement is waiting,
  // whether or not the store already holds its copy (it has not been stripped).
  const kgWaiting = kg.filter((o) => o.state === "moved" || (check && o.state === "already-moved"));
  const kgBad = kg.filter((o) => o.state === "conflict" || o.state === "unreadable");
  const critMissing = crit.flatMap((r) => r.missing.map((m) => `${rel(r.root) || "."}: ${m}`));
  const critUnreadable = crit.flatMap((r) => r.unreadable.map((u) => `${rel(r.root) || "."}: ${u}`));

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          kg: kg.map((o) => ({ ...o, sidecar: rel(o.sidecar), store: rel(o.store) })),
          criteria: crit.map((r) => ({ ...r, root: rel(r.root) || "." })),
        },
        null,
        2,
      ),
    );
  } else {
    const mode = check ? " --check" : dryRun ? " [dry run]" : "";
    const n = (rows: MigrationOutcome[], k: "pairs" | "reviews") => rows.reduce((t, o) => t + ("pairs" in o ? o[k] : 0), 0);
    if (want("kg-qa")) {
      const ok = kg.filter((o) => o.state === "moved" || o.state === "already-moved");
      const held = kgStoreCounts(kgAttestationTrees(repo, host));
      console.log(
        `qa-attestations${mode} kg-qa: ${check ? `${kgWaiting.length} sidecar(s) still carry judgements` : `${kgWaiting.length} moved`}, ` +
          `${kg.filter((o) => o.state === "already-moved").length} already moved ` +
          `(${n(ok, "pairs")} pair attestation(s), ${n(ok, "reviews")} voice review(s)) → *${ATTESTATIONS_SUFFIX}; ` +
          `the store holds ${held.pairs} pair attestation(s) and ${held.reviews} voice review(s) in ${held.files} file(s)`,
      );
      for (const o of kgBad) console.error(`  ✗ ${o.state}: ${rel(o.sidecar)} → ${rel(o.store)}: ${"reason" in o ? o.reason : ""}`);
      if (check) for (const o of kgWaiting) console.log(`    ✗ ${rel(o.sidecar)}`);
    }
    for (const r of crit) {
      if (r.derivedFiles === 0) continue;
      const by = Object.entries(r.byFamily).map(([f, k]) => `${f} ${k}`).join(", ") || "none";
      console.log(
        `qa-attestations${mode} ${rel(r.root) || "."}: ${r.entries} judgement(s) in ${r.filesWithAttestations} of ${r.derivedFiles} derived report(s) (${by}); ` +
          `${r.alreadyHeld} already in the store` +
          (check || dryRun ? `, ${r.missing.length} not` : `, ${r.added} added in ${r.storeFilesWritten} store file(s)`),
      );
    }
    for (const m of critMissing) console.log(`    ✗ ${m}`);
    for (const u of critUnreadable) console.error(`  ! could not read ${u}`);
  }
  if (critUnreadable.length > 0 || kg.some((o) => o.state === "unreadable")) process.exit(3);
  if (kgBad.length > 0) process.exit(1);
  if (check && (kgWaiting.length > 0 || critMissing.length > 0)) process.exit(1);
}
