/**
 * Bibliography human-review audit (phase-1 gate of the bib-human-review workflow).
 *
 * Every entry in `content/schema/references.ts` must be **human-reviewed against
 * its source**. This script computes each entry's `entryHash` (staleness gate),
 * reads each reference's human review — the attestation store's `bib-human-review`
 * family, or the legacy `<folio>/schema/references.review.json` before migration
 * (`schemas/library/bib-attestations.ts`) — and flags
 * every reference whose *effective* status is not `validated` (absent ⇒
 * `unreviewed` by default; a `validated` entry whose `entryHash` has drifted is
 * stale ⇒ treated as `unreviewed`).
 *
 * Design of record:
 *   docs/workplans/2026-06-08-bib-human-review-workflow-design.md
 * Skill:
 *   .claude/skills/local/bib-human-review.md
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/validate-references-human-review.ts            # warn-only report
 *   bun run cat-harness-tools/pipeline/validate-references-human-review.ts --strict   # exit 1 if any non-validated
 *   bun run cat-harness-tools/pipeline/validate-references-human-review.ts --json     # machine-readable summary
 *   bun run cat-harness-tools/pipeline/validate-references-human-review.ts --seed     # list refs that would get a physical-review issue
 *
 * @module pipeline/validate-references-human-review
 */

import { deferResolution } from "../schemas/kg/cat-harness.js";
import { createHash } from "crypto";
import { references } from "./references-registry-di";
import type { Data as CSLData } from "csl-json";
import { findContentRepoRoot } from "./repo-root";
import { BIB_REVIEW_STATUSES, readHumanReviews } from "../schemas/library/bib-attestations.ts";

/** The status vocabulary — the schema's (`BIB_REVIEW_STATUSES`), not a second copy. */
const STATUS_ENUM = BIB_REVIEW_STATUSES;
type ReviewStatus = (typeof STATUS_ENUM)[number];

interface ReviewEntry {
  status: ReviewStatus;
  by?: string;
  date?: string;
  source?: string;
  page?: string;
  entryHash?: string;
}

interface ReviewSidecar {
  _meta?: unknown;
  reviews: Record<string, ReviewEntry>;
}

// The reviews are read through the ONE reader of the human-review ledger:
// the attestation store's `bib-human-review` family, or the legacy
// `<folio>/schema/references.review.json` while the store has none. It says
// which. (The sidecar path was once computed from `import.meta.dir`, pointing
// into the platform; the reader resolves from the content repo root.)
const CONTENT_ROOT = deferResolution(() => findContentRepoRoot(), {
  moduleUrl: import.meta.url,
  what: "CONTENT_ROOT",
  under: process.cwd(),
});

/** Recursively key-sorted JSON, so the hash is independent of source key order.
 *  Mimics `JSON.stringify` semantics for the non-JSON values that can appear in a
 *  TS object literal: `undefined`/function/symbol serialize as `null` in array
 *  position and are *omitted* as object keys (so the hash never depends on a raw
 *  `undefined`). */
function stableStringify(value: unknown): string {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return "null"; // JSON.stringify drops these as keys / nulls them in arrays
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => {
      const v = obj[k];
      return v !== undefined && typeof v !== "function" && typeof v !== "symbol";
    })
    .sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** 12-char SHA-256 prefix of the canonical-JSON-serialized references.ts entry. */
export function entryHash(entry: CSLData): string {
  return createHash("sha256").update(stableStringify(entry)).digest("hex").slice(0, 12);
}

function loadSidecar(): ReviewSidecar {
  const read = readHumanReviews(CONTENT_ROOT());
  console.error(read.note);
  return { _meta: read.meta, reviews: read.reviews as Record<string, ReviewEntry> };
}

interface Flag {
  id: string;
  effective: ReviewStatus | "stale";
  recorded?: ReviewStatus;
  reason: string;
}

function audit() {
  const sidecar = loadSidecar();
  const flags: Flag[] = [];
  const counts: Record<string, number> = Object.fromEntries(
    STATUS_ENUM.map((s) => [s, 0]),
  );
  counts["stale"] = 0;

  for (const entry of references) {
    const id = entry.id as string;
    const hash = entryHash(entry);
    const rec = sidecar.reviews[id];

    if (!rec) {
      counts["unreviewed"]++;
      flags.push({ id, effective: "unreviewed", reason: "no review record (default unreviewed)" });
      continue;
    }
    // Staleness gate: a `validated` record is only trusted with a *matching*
    // entryHash. Missing entryHash ⇒ unverifiable ⇒ stale (don't silently pass).
    if (rec.status === "validated" && (!rec.entryHash || rec.entryHash !== hash)) {
      counts["stale"]++;
      flags.push({
        id,
        effective: "stale",
        recorded: rec.status,
        reason: rec.entryHash
          ? `entryHash drift (recorded ${rec.entryHash}, now ${hash}) — re-review required`
          : `validated but no entryHash recorded — unverifiable, re-review required`,
      });
      continue;
    }
    counts[rec.status] = (counts[rec.status] ?? 0) + 1;
    if (rec.status !== "validated") {
      flags.push({ id, effective: rec.status, recorded: rec.status, reason: `status=${rec.status}` });
    }
  }

  return { total: references.length, counts, flags };
}

/** Refs that would get a NEW physical-review issue: those with no usable review
 *  (`unreviewed` or `stale`). Already-`issue-open` / `source-in-repo` /
 *  `photo-uploaded` / `validated` refs are excluded — they are past this step. */
function seedCandidates(flags: Flag[]): Flag[] {
  return flags.filter((f) => f.effective === "unreviewed" || f.effective === "stale");
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const json = args.includes("--json");
  const seed = args.includes("--seed");

  const { total, counts, flags } = audit();

  if (json) {
    console.log(JSON.stringify({ total, counts, flags }, null, 2));
  } else if (seed) {
    const cands = seedCandidates(flags);
    console.log(`Physical-review issue candidates (${cands.length}):`);
    for (const c of cands) console.log(`  ${c.id}  [${c.effective}]  ${c.reason}`);
    console.log(
      "\nIssue creation is NOT automatic — the bib-human-review skill opens one issue per",
    );
    console.log(
      "ref needing physical access (template .github/ISSUE_TEMPLATE/bib-physical-review.md),",
    );
    console.log("assigned @litlfred. Keep GitHub noise low (skill §3 guardrail).");
  } else {
    console.log("Bibliography human-review audit");
    console.log("================================");
    console.log(`Total references: ${total}`);
    for (const s of [...STATUS_ENUM, "stale"]) {
      console.log(`  ${s.padEnd(16)} ${counts[s] ?? 0}`);
    }
    const nonValidated = flags.length;
    console.log(`\nFlagged (not validated): ${nonValidated}`);
    // Show a capped sample so the report stays readable.
    for (const f of flags.slice(0, 25)) {
      console.log(`  ✗ ${f.id.padEnd(28)} [${f.effective}] ${f.reason}`);
    }
    if (flags.length > 25) console.log(`  … and ${flags.length - 25} more (use --json for the full list)`);
    console.log(
      `\n${nonValidated === 0 ? "✓ all references validated" : `${nonValidated} reference(s) await human review`}`,
    );
  }

  if (strict && flags.length > 0) process.exit(1);
}

// Guard so `entryHash` / `audit` can be imported (e.g. by the bib-human-review
// skill to record a ref's hash) without running the CLI audit.
if (import.meta.main) main();
