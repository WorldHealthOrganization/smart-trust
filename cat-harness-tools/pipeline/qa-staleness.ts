#!/usr/bin/env bun
/**
 * QA staleness scanner — given a content root, walk every block
 * triple, load the `<block>.qa.json` sidecar, and report:
 *
 *   - blocks with NO sidecar (never audited)
 *   - blocks with sidecar but at least one criterion stale
 *     (the source file changed since the audit's recorded field_hash)
 *   - blocks fully fresh under the watcher's criterion list
 *
 * Usage:
 *
 *   bun run cat-harness-tools/pipeline/qa-staleness.ts \
 *     content/quantum-observable-universe/organic-chemistry
 *
 *   bun run cat-harness-tools/pipeline/qa-staleness.ts \
 *     content/quantum-observable-universe --json
 *
 *   bun run cat-harness-tools/pipeline/qa-staleness.ts \
 *     content/quantum-observable-universe --criteria voice-status-leak,wall-side-correct
 *
 *   bun run cat-harness-tools/pipeline/qa-staleness.ts \
 *     content/quantum-observable-universe --against main
 *
 * Exit code 0 always (informational). Use `--ci` to exit 1 when any
 * block has stale or missing audit, and 2 when any could not be read.
 *
 * ## `--against <ref>` reads the sidecars from the qa-reports branch (bean `8wj1`)
 *
 * Block QA sidecars are stored on `qa-reports`, so the working copy is the
 * last sweep's output rather than a record. Read off disk, a checkout without
 * `test/results/` reported every block NO-QA (measured 2026-10-22 on
 * cat-harness `docs/source`), which is a fact about the checkout, not about
 * the blocks. With `--against`, each sidecar is read from the branch, so the
 * answer does not depend on what is on disk. A branch that cannot be asked is
 * exit 2; a sidecar it holds but cannot read is UNKNOWN, never NO-QA.
 *
 * @module pipeline/qa-staleness
 */

import { existsSync } from "fs";
import { resolve, relative, join } from "path";
import {
  hashBlockFiles,
  walkBlocks,
  loadQaReport,
  parseQaReport,
  summariseFreshness,
} from "./qa-utils";
import { againstOrUsage, readBaseline } from "../scripts/qa-results.ts";
import { readQaManifest } from "../scripts/qa-store.ts";
import {
  qaCriteriaByIdFor,
  qaCriteriaFor,
  WATCHER_CRITERIA_BY_AXIS,
} from "./qa-criteria-registry";
import { findContentRepoRoot } from "./repo-root";
import { blockQaPath, existingBlockQaPath } from "./qa-paths";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

interface Args {
  root: string;
  criteria?: string[];
  axis?: string[];
  json: boolean;
  ci: boolean;
  against?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { root: "", json: false, ci: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--ci") out.ci = true;
    else if (a === "--criteria") {
      out.criteria = (argv[++i] ?? "").split(",").filter(Boolean);
    } else if (a === "--axis") {
      out.axis = (argv[++i] ?? "").split(",").filter(Boolean);
    } else if (a === "--against") {
      i++;
    } else if (!a.startsWith("--")) {
      if (!out.root) out.root = a;
    }
  }
  if (!out.root) {
    console.error(
      "usage: qa-staleness.ts <content-root> [--criteria ID,ID] [--json] [--ci] [--against <ref>]",
    );
    process.exit(2);
  }
  // Validated by the shared parser, so a malformed ref is refused the way
  // every other `--against` gate refuses it.
  const a = againstOrUsage("qa-staleness", argv);
  if (a.exit !== undefined) process.exit(a.exit);
  if (a.against !== undefined) out.against = a.against;
  return out;
}

interface BlockReport {
  label: string;
  kind: string;
  qa_path: string;
  qa_exists: boolean;
  fresh: string[];
  stale: string[];
  missing: string[];
  status: "fresh" | "stale" | "partial" | "missing-sidecar" | "no-criteria-applicable" | "unknown";
  /** Where the sidecar was read from: the working copy, or `qa-reports:<key>`. */
  from: string;
}

function run(): void {
  // The layer whose criteria this reads. Resolved here rather than at module
  // scope, and BY ID through `qaCriteriaByIdFor` rather than the static index:
  // since bean `btuv` the voice-overlay criteria are derived from the voices a
  // layer ships, so a static lookup returns `undefined` for every one of them
  // and this file would report four registered criteria as unknown.
  const INSTANCE_ROOT = join(HARNESS_ROOT);
  const criteriaById = qaCriteriaByIdFor(INSTANCE_ROOT);
  const args = parseArgs(process.argv.slice(2));
  const rootAbs = resolve(args.root);
  if (!existsSync(rootAbs)) {
    console.error(`qa-staleness: root not found: ${rootAbs}`);
    process.exit(2);
  }
  // Criterion-selection precedence (most-specific first):
  //   --criteria ID[,ID]  explicit criterion IDs (any axis)
  //   --axis NAME[,...]   one or more watcher axes
  //   (default)           every registered criterion across all axes
  const wantCriteria: string[] =
    args.criteria && args.criteria.length > 0
      ? args.criteria.filter((id) => criteriaById[id])
      : args.axis && args.axis.length > 0
        ? args.axis.flatMap((a) => WATCHER_CRITERIA_BY_AXIS[a] ?? [])
        : qaCriteriaFor(INSTANCE_ROOT).map((c) => c.id);

  // An entry that cannot be asked makes every block unknown; say it once.
  if (args.against !== undefined) {
    const m = readQaManifest(args.against);
    if (m.state !== "hit") {
      console.error(`qa-staleness: cannot read qa-reports:${args.against} (${m.state}: ${m.reason}). This is NOT a report of unaudited blocks.`);
      process.exit(2);
    }
  }

  const blocks: BlockReport[] = [];
  let totalUnknown = 0;
  let totalMissing = 0;
  let totalStale = 0;
  let totalFresh = 0;

  // The layer root a verdict path is resolved against — see qa-paths.ts.
  // Computed once: it walks up from cwd and every block in this scan shares it.
  const repoRoot = findContentRepoRoot();

  for (const block of walkBlocks(rootAbs)) {
    // Prefer the results-tree verdict, falling back to the legacy sibling
    // (a downstream folio that has not migrated yet) — see qa-paths.ts's
    // `existingBlockQaPath`. When neither exists, fall back to the canonical
    // (results-tree) path purely so `qa_path` below reports where a fresh
    // audit would land; `loadQaReport` on a path that does not exist returns
    // `undefined` exactly as it did for the old hand-composed path, so a
    // genuinely unaudited block still counts as `missing-sidecar` /
    // `totalMissing` below rather than silently passing as fresh — this must
    // never collapse into "looked in the wrong place" reading as audited.
    const qaPath =
      existingBlockQaPath(repoRoot, block.root) ?? blockQaPath(repoRoot, block.root);
    const qaRel = relative(process.cwd(), qaPath);
    const paths = { md: block.md, ts: block.ts, lean: block.lean };
    const current = hashBlockFiles(paths);

    let report: ReturnType<typeof loadQaReport>;
    let from = "working copy";
    if (args.against !== undefined) {
      // The canonical (results-tree) path is the one the branch mirrors.
      const read = readBaseline(blockQaPath(repoRoot, block.root), { against: args.against });
      from = read.from;
      if (read.state === "corrupt" || read.state === "unknown") {
        blocks.push({ label: block.label, kind: block.kind, qa_path: qaRel, qa_exists: true, fresh: [], stale: [], missing: [], status: "unknown", from });
        totalUnknown++;
        continue;
      }
      // A miss leaves `report` undefined: the branch holds no verdict, NO-QA.
      if (read.state === "hit") report = parseQaReport(read.text, `${read.from}:${qaRel}`);
    } else {
      report = loadQaReport(qaPath);
    }
    if (!report) {
      blocks.push({
        label: block.label,
        kind: block.kind,
        qa_path: qaRel,
        qa_exists: false,
        fresh: [],
        stale: [],
        missing: [...wantCriteria],
        status: "missing-sidecar",
        from,
      });
      totalMissing++;
      continue;
    }

    const freshSummary = summariseFreshness(report, current, undefined, criteriaById);
    const summaryById = Object.fromEntries(
      freshSummary.map((s) => [s.criterion, s]),
    );

    const fresh: string[] = [];
    const stale: string[] = [];
    const missing: string[] = [];
    for (const cid of wantCriteria) {
      const def = criteriaById[cid];
      if (def?.applies_to && !def.applies_to.includes(block.kind)) continue;
      const summary = summaryById[cid];
      if (!summary) missing.push(cid);
      else if (summary.is_fresh) fresh.push(cid);
      else stale.push(cid);
    }

    let status: BlockReport["status"];
    if (fresh.length === 0 && stale.length === 0 && missing.length === 0)
      status = "no-criteria-applicable";
    else if (missing.length === 0 && stale.length === 0) status = "fresh";
    else if (fresh.length === 0) status = "stale";
    else status = "partial";

    if (status === "fresh") totalFresh++;
    else if (status === "stale" || status === "partial") totalStale++;

    blocks.push({
      label: block.label,
      kind: block.kind,
      qa_path: qaRel,
      qa_exists: true,
      fresh,
      stale,
      missing,
      status,
      from,
    });
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          root: relative(process.cwd(), rootAbs),
          want_criteria: wantCriteria,
          totals: {
            blocks: blocks.length,
            fresh: totalFresh,
            stale_or_partial: totalStale,
            missing_sidecar: totalMissing,
            unknown: totalUnknown,
          },
          from: args.against !== undefined ? `qa-reports:${args.against}` : "working copy",
          blocks,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`qa-staleness: ${relative(process.cwd(), rootAbs)}`);
    console.log(
      `              ${blocks.length} blocks; fresh=${totalFresh}, stale/partial=${totalStale}, no-sidecar=${totalMissing}` +
        (totalUnknown > 0 ? `, UNKNOWN=${totalUnknown}` : "") +
        ` — read from ${args.against !== undefined ? `qa-reports:${args.against}` : "the working copy"}`,
    );
    console.log("");
    for (const b of blocks) {
      const tag =
        b.status === "fresh"
          ? "FRESH"
          : b.status === "missing-sidecar"
            ? "NO-QA"
            : b.status === "unknown"
              ? "UNKNOWN"
            : b.status === "stale"
              ? "STALE"
              : b.status === "partial"
                ? "PART"
                : "N/A";
      console.log(`  [${tag}] ${b.label}  (${b.kind})`);
      if (b.stale.length > 0)
        console.log(`         stale: ${b.stale.join(", ")}`);
      if (b.missing.length > 0)
        console.log(`         missing: ${b.missing.join(", ")}`);
    }
  }

  if (args.ci && totalUnknown > 0) process.exit(2);
  if (args.ci && (totalMissing > 0 || totalStale > 0)) {
    process.exit(1);
  }
}

run();
