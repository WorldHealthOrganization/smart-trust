#!/usr/bin/env bun
/**
 * Record a fixity digest for every materialized FILE that has none.
 *
 * @module folio-assistant-core/scripts/backfill-materialized-fixity
 *
 * ## Why this exists
 *
 * `check-materialized-fixity.ts` enforces that materialized content is not
 * edited in place, by hashing the bytes against the digest their record
 * carries. Measured 2026-09-22, the corpus held **229 materialized artefacts
 * and 6 verifiable digests** — so the gate was real and covered 2.6% of what
 * it is meant to protect. A green gate over that reads as "materialized
 * content is protected", which would have been false.
 *
 * The owner chose to close it: *"Backfill all 222 now."*
 *
 * ## WHAT A BACKFILLED DIGEST DOES AND DOES NOT PROVE
 *
 * This is the part that must not be lost. It is carried by `verifiedAt` on
 * each record — see the note on `VERIFIED_AT` for why that field rather than
 * prose — and stated in full here, in the commit, the PR and bean `10s1`.
 *
 * A digest computed today hashes **what is on disk today**. It establishes a
 * baseline from this moment forward: from here, an edit in place is caught.
 * It does **not** prove the bytes are pristine. If an artefact was already
 * edited before this ran, the backfill blesses that edit and nothing here can
 * tell.
 *
 * Egress is blocked in this environment, so re-fetching upstream to compare
 * was not available. That is a limit of the run, not of the idea — a later
 * run with network access could verify against `materialization.of` and
 * upgrade the claim from *observed* to *confirmed*.
 *
 * A machine-readable marker in the data rather than only a commit message is
 * deliberate: a commit message is read once, by whoever reviews it, and the
 * record is read every time somebody asks what the digest means.
 *
 * ## It backfills FILES only
 *
 * Three of the records without a digest are directories — the IRIS catalogue's items
 * point at `library/<id>` while their bitstreams point at
 * `uploads/<id>/<file>`. A file digest does not apply to a directory, and
 * those items are already covered by their parts, which the checker reports as
 * its own verdict rather than as a gap. One more has no `localPath` at all.
 * Neither is backfilled, and neither is a failure.
 *
 * Usage:
 *   bun run cat-harness/scripts/backfill-materialized-fixity.ts --dry-run
 *   bun run cat-harness/scripts/backfill-materialized-fixity.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { collect, type MaterializedRecord } from "./check-materialized-fixity.js";

const REPO = resolve(import.meta.dir, "..", "..");

/**
 * THE CAVEAT LIVES IN `verifiedAt`, NOT IN A PROSE FIELD — and that is a
 * correction, not the original design.
 *
 * The first version wrote a `note` onto each `fixity` explaining that a
 * backfilled digest is a baseline rather than proof. `FixitySchema` is
 * `.strict()` and permits `algorithm`, `digest` and `verifiedAt` only, so that
 * broke validation on both artefact indexes — caught by `bun run cat gates`, which
 * was still running when the change was pushed.
 *
 * The field that already exists says the load-bearing part precisely:
 * `verifiedAt` is *"when the digest was last RE-COMPUTED against the bytes,
 * not when it was recorded"*. A record whose ingestion never wrote a digest,
 * carrying a `verifiedAt` of the backfill date, IS the statement that this
 * digest was observed rather than original.
 *
 * The prose caveat is not repeated onto 217 records, where it would be 217
 * copies of one sentence. It lives in this module's header, the commit, the
 * PR and bean `10s1`. The owner chose a plain backfill over the option that
 * carried a distinguishing schema flag, so adding one here would be taking
 * back a decision rather than implementing it.
 */
const VERIFIED_AT = new Date().toISOString();

/** A file that can be hashed, and currently carries no digest. */
export function backfillable(records: readonly MaterializedRecord[]): MaterializedRecord[] {
  return records.filter(
    (r) =>
      r.digest === undefined &&
      r.localPath !== undefined &&
      r.abs !== undefined &&
      existsSync(r.abs) &&
      statSync(r.abs).isFile(),
  );
}

/**
 * Write the digest into every materialization in `doc` whose `localPath`
 * matches, and report how many were changed.
 *
 * Matched on `localPath` rather than on object identity because the document
 * is re-parsed from disk here: the records handed in came from an earlier
 * parse, and mutating those would write nothing.
 */
export function applyTo(doc: unknown, digests: ReadonlyMap<string, string>): number {
  let changed = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (typeof v !== "object" || v === null) return;
    const o = v as Record<string, unknown>;
    const m = o.materialization as Record<string, unknown> | undefined;
    if (m && m.state === "materialized" && typeof m.localPath === "string" && m.fixity === undefined) {
      const d = digests.get(m.localPath);
      if (d !== undefined) {
        m.fixity = { algorithm: "sha256", digest: d, verifiedAt: VERIFIED_AT };
        changed++;
      }
    }
    for (const child of Object.values(o)) walk(child);
  };
  walk(doc);
  return changed;
}

if (import.meta.main) {
  const dry = process.argv.includes("--dry-run");
  const records = collect(REPO);
  const todo = backfillable(records);

  console.log(`materialized records: ${records.length}`);
  console.log(`  already carrying a digest: ${records.filter((r) => r.digest !== undefined).length}`);
  console.log(`  backfillable files:        ${todo.length}`);
  const skipped = records.filter((r) => r.digest === undefined && !todo.includes(r));
  console.log(`  not backfillable:          ${skipped.length} (directories, or no localPath)`);

  // Digest each file ONCE, keyed by the path its record names.
  const digests = new Map<string, string>();
  for (const r of todo) {
    if (digests.has(r.localPath!)) continue;
    digests.set(r.localPath!, createHash("sha256").update(readFileSync(r.abs!)).digest("hex"));
  }

  const bySource = new Map<string, MaterializedRecord[]>();
  for (const r of todo) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);

  let written = 0;
  for (const [source, rs] of bySource) {
    const abs = join(REPO, source);
    const doc = JSON.parse(readFileSync(abs, "utf-8"));
    const n = applyTo(doc, digests);
    console.log(`  ${dry ? "would write" : "wrote"} ${n} digest(s) → ${source} (${rs.length} record(s))`);
    if (!dry && n > 0) writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`);
    written += n;
  }
  console.log(dry ? `\n--dry-run: ${written} digest(s) would be recorded.` : `\n${written} digest(s) recorded.`);
}
