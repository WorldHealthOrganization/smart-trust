#!/usr/bin/env bun
/**
 * Merge a batch of agent / human QA findings into the per-block
 * `<block>.qa.json` sidecars. Each finding appends a new entry to
 * the named criterion's reviewer-entry array. Prior entries are
 * NEVER deleted — multi-reviewer history is preserved.
 *
 * Input format (JSON, via stdin or `--file <path>`):
 *
 *   {
 *     "reviewer": { "kind": "agent", "id": "<agent-name>", "version": "<model-id>" },
 *     "findings": [
 *       {
 *         "block_md": "content/.../carbon-valence.md",
 *         "criterion": "voice-scholarly-default",
 *         "result": "pass" | "fail" | "warn" | "n/a",
 *         "severity": "critical" | "major" | "minor",   // omit on pass / n/a
 *         "evidence": "<file:line: quote>",             // omit on pass / n/a
 *         "notes": "<free-form rationale>"
 *       },
 *       ...
 *     ]
 *   }
 *
 * Usage:
 *
 *   bun run cat-harness-tools/pipeline/qa-merge-findings.ts --file findings.json
 *   … [--prior-from <ref>]   read each block's earlier report from the results store at <ref>
 *   bun run cat-harness-tools/pipeline/qa-merge-findings.ts < findings.json
 *
 * @module pipeline/qa-merge-findings
 */

import { readFileSync, existsSync } from "fs";
import { resolve, relative } from "path";
import { execSync } from "child_process";
import {
  hashBlockFiles,
  gitHeadSha,
  gitHeadTree,
  loadQaReport,
  saveQaReport,
  readBlockManifest,
  insertAdjudication,
  loadPriorBlockReport,
  priorRefusalLine,
} from "./qa-utils";
import { priorFromOrExit } from "../scripts/qa-results.ts";
import { qaCriteriaByIdFor } from "./qa-criteria-registry";
import { blockQaPath, existingBlockQaPath, findContentRepoRoot } from "./qa-paths";
import { blockAttestationKey, composeCriteria, finalizeCriteria, refusalLine, resolvePrior } from "../schemas/sdlc/qa-attestations.ts";
import type {
  BlockQaReport,
  QaCriterionEntry,
  QaReviewer,
} from "../schemas/sdlc/block-qa.ts";

interface FindingInput {
  block_md?: string;
  block_ts?: string;
  block_root?: string;
  criterion: string;
  result: "pass" | "fail" | "warn" | "n/a";
  severity?: "critical" | "major" | "minor";
  evidence?: string;
  notes?: string;
}

interface BatchInput {
  reviewer: QaReviewer;
  findings: FindingInput[];
}

function readStdin(): string {
  return readFileSync(0, "utf-8");
}

function parseArgs(argv: string[]): { file?: string } {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) return { file: argv[i + 1] };
  }
  return {};
}

/**
 * Repo root (one ancestor of `content/`). Resolved once via
 * `git rev-parse --show-toplevel`; falls back to the parent of
 * the current working directory if not in a git repo.
 */
function repoRoot(): string {
  try {
    return execSync("git rev-parse --show-toplevel", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return process.cwd();
  }
}

/**
 * Resolve a block path tolerantly. The script may be invoked from
 * repo root OR from `content/` (the conventional CWD for the other
 * pipeline CLIs). Findings JSON may use either prefix shape:
 *
 *   - `content/quantum-observable-universe/.../carbon-valence.md`
 *     (repo-root-relative, the natural form when the JSON is hand-
 *     authored)
 *   - `quantum-observable-universe/.../carbon-valence.md`
 *     (content-relative, the natural form when invoking other CLIs
 *     from `content/`)
 *
 * Resolution order:
 *   1. The path as given, resolved from the current CWD.
 *   2. The path as given, resolved from the repo root.
 *   3. With a leading `content/` prefix stripped, resolved from CWD.
 *   4. With a leading `content/` prefix prepended, resolved from CWD.
 *
 * Returns the first variant whose `<root>.ts` exists. If none
 * exist, returns the CWD-resolved form of the given path (so the
 * caller surfaces the original error).
 */
function resolveBlockRoot(input: string): string {
  const root = repoRoot();
  const candidates = [
    resolve(input),
    resolve(root, input),
    resolve(input.replace(/^content\//, "")),
    // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
    resolve("folio", input),
  ];
  for (const c of candidates) {
    if (existsSync(c + ".ts")) return c;
  }
  return candidates[0];
}

function blockRootFromInput(f: FindingInput): string | undefined {
  if (f.block_root) return f.block_root;
  if (f.block_md) return f.block_md.replace(/\.md$/, "");
  if (f.block_ts) return f.block_ts.replace(/\.ts$/, "");
  return undefined;
}

function run(): void {
  const args = parseArgs(process.argv.slice(2));
  // `--prior-from <ref>` (bean `8wj1`, owner option B): read each block's
  // earlier report from the results store at that ref. A bad ref exits 2 here.
  const priorFrom = priorFromOrExit("qa-merge-findings");
  let priorRefused = 0;
  const raw = args.file ? readFileSync(args.file, "utf-8") : readStdin();
  let batch: BatchInput;
  try {
    batch = JSON.parse(raw);
  } catch (e) {
    const where = args.file ? `--file ${args.file}` : "stdin";
    console.error(`failed to parse JSON from ${where}: ${(e as Error).message}`);
    process.exit(2);
  }
  if (!batch.reviewer || !Array.isArray(batch.findings)) {
    console.error("input must have { reviewer, findings: [] }");
    process.exit(2);
  }
  if (batch.reviewer.kind !== "agent" && batch.reviewer.kind !== "human") {
    console.error("reviewer.kind must be 'agent' or 'human' (use qa-sweep.ts for scripts)");
    process.exit(2);
  }

  const headSha = gitHeadSha();
  // What each entry records as `reviewed_tree` (bean 69lr; owner card Q4,
  // 2026-11-05): the tree outlives a PR run's synthetic merge commit.
  const headTree = gitHeadTree();
  let added = 0;
  let skipped = 0;
  // Findings NOT merged because the attestation store could not be read.
  let refused = 0;

  // Hoisted out of the loop: `qaCriteriaByIdFor` memoises the derivation but
  // builds a fresh index on each call, and the repository root is the same for
  // every finding in a batch.
  const criteriaById = qaCriteriaByIdFor(repoRoot());

  for (const f of batch.findings) {
    const root = blockRootFromInput(f);
    if (!root) {
      console.error("finding missing block_md / block_ts / block_root:", f);
      skipped++;
      continue;
    }
    const rootAbs = resolveBlockRoot(root);
    const tsPath = rootAbs + ".ts";
    const mdPath = rootAbs + ".md";
    const leanPath = rootAbs + ".lean";
    // `qaPath` is the WRITE target — this tool is a writer per the
    // qa-paths.ts contract and never puts a verdict beside its block; loading
    // just below falls back to the legacy sibling so a not-yet-migrated
    // folio's history is read rather than overwritten with an empty report.
    //
    // Anchored at the block's own CONTENT repo, found the way qa-sweep finds it
    // (bean `8wj1`). This was the git top level, which in a checkout holding
    // more than one layer — this one: the verdicts live under
    // `cat-harness/test/results/` — named a results tree nothing reads, so a
    // merged finding started a fresh report there instead of joining the real
    // one. The attestation store is anchored at the same root, so the sweep
    // and this tool agree on where an adjudication lives.
    const repo = findContentRepoRoot(rootAbs, repoRoot());
    const qaPath = blockQaPath(repo, rootAbs);
    if (!existsSync(tsPath)) {
      console.error(`no .ts manifest at ${tsPath}`);
      skipped++;
      continue;
    }
    // Instance-aware: every voice-overlay criterion is `automated: false`, so
    // the findings this tool merges are exactly the kind an agent adjudicates
    // against a voice. Read from the static index they would come back
    // undefined and be rejected below as unknown.
    const def = criteriaById[f.criterion];
    if (!def) {
      console.error(`unknown criterion: ${f.criterion}`);
      skipped++;
      continue;
    }

    const currentHashes = hashBlockFiles({
      md: existsSync(mdPath) ? mdPath : undefined,
      ts: tsPath,
      lean: existsSync(leanPath) ? leanPath : undefined,
    });

    // READ: prefer the results-tree verdict, fall back to the legacy sidecar
    // (see the comment on `qaPath` above).
    // An adjudication is an ATTESTATION: it is written to the store first, and
    // the store — never the prior report — is where the others come from.
    let priorReport: BlockQaReport | undefined;
    if (priorFrom !== undefined) {
      const loaded = loadPriorBlockReport(repo, rootAbs, priorFrom);
      if (!loaded.ok) {
        // Unreadable at the ref: refuse rather than fall back to the working
        // copy, which would make a missing store look like no history.
        console.error(priorRefusalLine("qa-merge-findings", relative(repo, rootAbs), loaded));
        priorRefused++;
        continue;
      }
      priorReport = loaded.report;
    } else {
      priorReport = loadQaReport(existingBlockQaPath(repo, rootAbs) ?? qaPath);
    }
    const attested = resolvePrior(repo, blockAttestationKey(repo, rootAbs), priorReport);
    if (!attested.ok) {
      console.error(refusalLine("qa-merge-findings", relative(repo, rootAbs), attested));
      refused++;
      continue;
    }
    let report: BlockQaReport | undefined = attested.prior;
    if (!report) {
      // CatBootstrap a fresh sidecar — agent can write the first
      // entry even if qa-sweep hasn't run yet. Reuses the shared
      // `readBlockManifest` helper to extract { kind, label } in a
      // single file read.
      const manifest = readBlockManifest(tsPath);
      const label = manifest?.label ?? "unknown";
      const kind = manifest?.kind ?? "unknown";
      report = {
        $schema: "block-qa/v1",
        label,
        kind,
        paths: {
          ts: relative(process.cwd(), tsPath),
          md: existsSync(mdPath) ? relative(process.cwd(), mdPath) : undefined,
          lean: existsSync(leanPath)
            ? relative(process.cwd(), leanPath)
            : undefined,
        },
        source_hashes: currentHashes,
        criteria: composeCriteria({}, attested.attestations) as BlockQaReport["criteria"],
      };
    }
    // Refresh source hashes (best-effort).
    report.source_hashes = currentHashes;

    const entry: QaCriterionEntry = {
      field_hash: currentHashes,
      result: f.result,
      reviewer: batch.reviewer,
      reviewed_tree: headTree,
    };
    if (f.severity) entry.severity = f.severity;
    if (f.evidence) entry.evidence = f.evidence;
    if (f.notes) entry.notes = f.notes;

    const existing = report.criteria[f.criterion] ?? [];
    // Leads the criterion rather than appending: order IS the verdict here.
    // Rationale and the measurement in `insertAdjudication`.
    report.criteria[f.criterion] = insertAdjudication(existing, entry);
    // No clock (owner rulings 2026-11-06, "QA dates" / "Date source"): the
    // date is derived on read from reviewed_tree; a stale legacy one goes.
    delete report.updated_at;
    try {
      report.criteria = finalizeCriteria(attested, report.criteria, "attesting");
    } catch (err) {
      console.error(refusalLine("qa-merge-findings", relative(repo, rootAbs), {
        state: "unknown",
        path: attested.path,
        reason: err instanceof Error ? err.message : String(err),
      }));
      refused++;
      continue;
    }
    saveQaReport(qaPath, report);
    added++;
  }

  console.log(
    JSON.stringify(
      {
        added,
        skipped,
        refused,
        reviewer: batch.reviewer,
        head: headSha,
      },
      null,
      2,
    ),
  );
  if (priorRefused > 0) process.exit(2);
  if (refused > 0) process.exit(4);
}

run();
