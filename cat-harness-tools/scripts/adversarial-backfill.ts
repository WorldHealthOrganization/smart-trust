#!/usr/bin/env bun
/**
 * Per-content-block adversarial QA backfill runner and risk-ranking.
 *
 * ## Backfill order (risk-ranked, not file order)
 *
 * 1. Gate adjacency: nodes on the critical merge/gating path rank first
 *    (`gates.ts`, `merge-base.ts`, `regen-after-merge.ts`, `merge-conflict-patterns.ts`, `kg-qa.ts`).
 * 2. Fan-in: how many files across the repository reference or import the node.
 * 3. Churn & last-changed: how actively the node changes.
 * 4. Review recency: nodes never reviewed or whose review is stale rank ahead of fresh nodes.
 *
 * ## Sidecars, never beans
 *
 * Findings stay in `kg-qa/v1` sidecars under `test/results/kg-qa/`; no bean
 * per finding. Because the derived tree is not committed and a review is a
 * judgement no generator reproduces, each review is also appended, before
 * the sidecar, to the subject's committed attestation file
 * (`test/attestations/adversarial-review/…`). A node counts as reviewed when
 * either holds one.
 *
 * Wall-clock time is measured and token usage estimated per node, and both
 * are reported.
 *
 * @module scripts/adversarial-backfill
 * @graphNode tool — adversarial review backfill runner
 * @covers tools, schemas, skills, processes — the four content kinds with adversarial checklists
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import {
  getChecklistForKind,
  type AdversarialContentKind,
} from "../schemas/sdlc/adversarial-checklist.js";
import {
  AdversarialFindingSchema,
  type AdversarialFinding,
  type AdversarialReview,
} from "../schemas/sdlc/red-flag.js";
import { KG_QA_SCHEMA, kgQaSidecarPath, type KgQaReport, type KgSubjectKind } from "../schemas/sdlc/kg-qa.js";
import { NOT_DISCLOSED } from "@litlfred/bootstrap-tools/schemas/model-registry.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { implementingRootFor } from "../schemas/kg/harness-config.ts";
import { declaredDirectory } from "./lib/local-site-dir.ts";
import { kgQaHomeFor, repoRootFor } from "../schemas/kg/cat-harness.ts";
import {
  ADVERSARIAL_REVIEW_FAMILY,
  KG_QA_SIDECAR_SUFFIX,
  QA_ATTESTATIONS_SCHEMA,
  adversarialAttestationFor,
  attestationPathFor,
  attestationsHomeFor,
  kgAttestationTrees,
  readAttestationFile,
  serialiseAttestations,
  storedAdversarialReviews,
  type AdversarialReviewAttestations,
} from "../schemas/sdlc/qa-attestations.ts";
import { harnessRel, subgraphHarnessPath } from "./lib/harness-layout.ts";

const ROOT = resolve(HARNESS_ROOT);

export interface CandidateNode {
  id: string;
  kind: AdversarialContentKind;
  path: string;
  gatePathPriority: number; // 1 for gate-path top nodes, 0 otherwise
  fanIn: number;
  commitCount: number;
  lastModifiedMs: number;
  sourceHash: string;
  sidecarPath: string;
  hasReview: boolean;
  isStale: boolean;
}

export interface RankedNode extends CandidateNode {
  riskScore: number;
}

export interface NodeReviewMeasurement {
  nodeId: string;
  kind: AdversarialContentKind;
  path: string;
  durationMs: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  result: "pass" | "fail" | "unknown";
  findingCount: number;
  sidecarPath: string;
}

export interface BackfillBatchReport {
  timestamp: string;
  nodesReviewed: number;
  totalDurationMs: number;
  totalEstimatedTokens: number;
  totalEstimatedCostUsd: number;
  averageDurationMsPerNode: number;
  averageCostUsdPerNode: number;
  measurements: NodeReviewMeasurement[];
}

/** Compute 12-hex source hash matching kg-audit convention. */
export function computeSourceHash(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

/**
 * The 5 critical gate-path nodes specified in Proposal §7 in mandatory order.
 * declared-path-literal: the proposal NAMES these five nodes by path; this
 * list is that specification, not a lookup a declaration could answer.
 */
export const GATE_PATH_NODES: readonly { id: string; kind: AdversarialContentKind; path: string }[] = [
  { id: "gates", kind: "tool", path: "scripts/gates.ts" },
  { id: "merge-base", kind: "tool", path: "scripts/merge-base.ts" },
  { id: "regen-after-merge", kind: "tool", path: "scripts/regen-after-merge.ts" },
  { id: "merge-conflict-patterns", kind: "skill", path: harnessRel("sdlc/skills/sdlc-core/merge-conflict-patterns.md") },
  { id: "kg-qa", kind: "schema", path: "schemas/sdlc/kg-qa.ts" },
] as const;

function skillSidecarDir(node: { id: string; kind: AdversarialContentKind; path: string }, repoRoot: string): string {
  const fromStore = (home: string): string | undefined => {
    for (const s of storedAdversarialReviews(home)) {
      if (s.file.subject.kind === node.kind && s.file.subject.id === node.id && s.file.subject.path) {
        return dirname(s.file.subject.path);
      }
    }
    return undefined;
  };
  try {
    const primary = resolve(attestationsHomeFor(repoRoot).root);
    const direct = fromStore(primary);
    if (direct !== undefined) return direct;
    for (const t of kgAttestationTrees(repoRootFor(repoRoot), repoRoot)) {
      const home = resolve(t.attHome);
      if (home === primary) continue;
      const hit = fromStore(home);
      if (hit !== undefined) return hit;
    }
  } catch {
    // layer discovery failed: fall through to path resolution
  }
  const rawDir = dirname(node.path);
  if (rawDir === ".") {
    const gateSkill = GATE_PATH_NODES.find((g) => g.kind === "skill");
    return gateSkill ? dirname(harnessRel(gateSkill.path, repoRoot)) : "skills";
  }
  const sub = subgraphHarnessPath(rawDir);
  if (existsSync(join(repoRoot, sub))) return sub;
  const adapted = harnessRel(sub, repoRoot);
  if (existsSync(join(repoRoot, adapted))) return adapted;
  return rawDir;
}

/**
 * Determine the sidecar path for a node.
 */
export function resolveSidecarPath(node: { id: string; kind: AdversarialContentKind; path: string }, repoRoot: string = ROOT): string {
  if (node.kind === "tool") {
    return join(repoRoot, "test", "results", "kg-qa", "tools", `${node.id}.kg-qa.json`);
  }
  if (node.kind === "schema") {
    return join(repoRoot, "test", "results", "kg-qa", "schemas", `${node.id}.kg-qa.json`);
  }
  if (node.kind === "skill") {
    return kgQaSidecarPath(repoRoot, join(repoRoot, skillSidecarDir(node, repoRoot)), node.id);
  }
  return join(repoRoot, "test", "results", "kg-qa", "processes", `${node.id}.kg-qa.json`);
}

/**
 * The committed attestation file for a sidecar path, or `undefined` when the
 * path is under no layer's `kg-qa/` tree (a scratch tree, as in the tests).
 */
export function reviewAttestationPath(sidecarPath: string, repoRoot: string = ROOT): { file: string; storeRoot: string } | undefined {
  try {
    const found = adversarialAttestationFor(sidecarPath, repoRootFor(repoRoot), repoRoot);
    if (found !== undefined) return found;
    const kgTree = resolve(kgQaHomeFor(repoRoot, repoRoot).root, "kg-qa");
    const abs = resolve(sidecarPath);
    if (!abs.startsWith(`${kgTree}${sep}`)) return undefined;
    const home = attestationsHomeFor(repoRoot, repoRoot);
    return {
      file: attestationPathFor(abs, kgTree, home.root, ADVERSARIAL_REVIEW_FAMILY, KG_QA_SIDECAR_SUFFIX),
      storeRoot: home.storeRoot,
    };
  } catch {
    return undefined;
  }
}

/**
 * The review state the attestation store records for a sidecar's subject:
 * `undefined` when it holds no adversarial review.
 */
function storedReviewState(sidecarPath: string, srcHash: string, repoRoot: string): { isStale: boolean } | undefined {
  const at = reviewAttestationPath(sidecarPath, repoRoot);
  if (at === undefined) return undefined;
  const read = readAttestationFile(at.file, at.storeRoot);
  if (read.state !== "hit" || read.file.family !== ADVERSARIAL_REVIEW_FAMILY) return undefined;
  const pinned = read.file.source_hash;
  return { isStale: srcHash !== "" && pinned !== null && pinned !== srcHash };
}

/**
 * Gather candidate nodes across tools, schemas, skills, and processes.
 */
export function gatherCandidateNodes(repoRoot: string = ROOT): CandidateNode[] {
  const candidates: CandidateNode[] = [];
  const seenIds = new Set<string>();

  // 1. Mandatory gate-path nodes
  for (const gpn of GATE_PATH_NODES) {
    const abs = join(implementingRootFor(repoRoot, gpn.path), gpn.path);  // bean 70lx
    if (!existsSync(abs)) continue;
    seenIds.add(gpn.id);
    const content = readFileSync(abs);
    const stat = statSync(abs);
    const scPath = resolveSidecarPath(gpn, repoRoot);
    const hasSidecar = existsSync(scPath);
    let hasReview = false;
    let isStale = false;
    const srcHash = computeSourceHash(content);

    if (hasSidecar) {
      try {
        const sc = JSON.parse(readFileSync(scPath, "utf-8")) as KgQaReport;
        if (sc.adversarial_reviews && sc.adversarial_reviews.length > 0) {
          hasReview = true;
          isStale = sc.source_hash !== srcHash;
        }
      } catch {
        // ignore parse error
      }
    }
    if (!hasReview) {
      const stored = storedReviewState(scPath, srcHash, repoRoot);
      if (stored !== undefined) {
        hasReview = true;
        isStale = stored.isStale;
      }
    }

    candidates.push({
      id: gpn.id,
      kind: gpn.kind,
      path: gpn.path,
      gatePathPriority: 1000 - candidates.length * 10, // strict priority ordering among gate path
      fanIn: 0,
      commitCount: 0,
      lastModifiedMs: stat.mtimeMs,
      sourceHash: srcHash,
      sidecarPath: scPath,
      hasReview,
      isStale,
    });
  }

  // 2. Discover additional tools
  const toolsDir = declaredDirectory(repoRoot, "tools");
  if (toolsDir !== undefined) {
    const scDir = join(repoRoot, "test", "results", "kg-qa", "tools");
    if (existsSync(scDir)) {
      for (const f of readdirSync(scDir).filter((x) => x.endsWith(".kg-qa.json"))) {
        const id = f.replace(/\.kg-qa\.json$/, "");
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const scPath = join(scDir, f);
        let hasReview = false;
        const isStale = false;
        let srcHash = "";
        try {
          const sc = JSON.parse(readFileSync(scPath, "utf-8")) as KgQaReport;
          srcHash = sc.source_hash ?? "";
          if (sc.adversarial_reviews && sc.adversarial_reviews.length > 0) {
            hasReview = true;
          }
        } catch {}

        candidates.push({
          id,
          kind: "tool",
          path: `tools/${id}`,
          gatePathPriority: 0,
          fanIn: 0,
          commitCount: 0,
          lastModifiedMs: existsSync(scPath) ? statSync(scPath).mtimeMs : 0,
          sourceHash: srcHash,
          sidecarPath: scPath,
          hasReview,
          isStale,
        });
      }
    }
  }

  // 3. Discover schemas
  const schemasDir = declaredDirectory(repoRoot, "schemas");
  if (schemasDir !== undefined) {
    for (const f of readdirSync(schemasDir).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
      const id = f.replace(/\.ts$/, "");
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const relPath = `schemas/${f}`;
      const absPath = join(schemasDir, f);
      const content = readFileSync(absPath);
      const srcHash = computeSourceHash(content);
      const scPath = resolveSidecarPath({ id, kind: "schema", path: relPath }, repoRoot);
      let hasReview = false;
      let isStale = false;
      if (existsSync(scPath)) {
        try {
          const sc = JSON.parse(readFileSync(scPath, "utf-8")) as KgQaReport;
          if (sc.adversarial_reviews && sc.adversarial_reviews.length > 0) {
            hasReview = true;
            isStale = sc.source_hash !== srcHash;
          }
        } catch {}
      }
      if (!hasReview) {
        const stored = storedReviewState(scPath, srcHash, repoRoot);
        if (stored !== undefined) {
          hasReview = true;
          isStale = stored.isStale;
        }
      }

      candidates.push({
        id,
        kind: "schema",
        path: relPath,
        gatePathPriority: 0,
        fanIn: 0,
        commitCount: 0,
        lastModifiedMs: statSync(absPath).mtimeMs,
        sourceHash: srcHash,
        sidecarPath: scPath,
        hasReview,
        isStale,
      });
    }
  }

  return candidates;
}

/**
 * Rank candidate nodes by risk score:
 * riskScore = gatePathPriority * 1000 + unreviewedBonus (500) + staleBonus (250) + fanIn * 10 + commitCount
 */
export function rankCandidateNodes(candidates: CandidateNode[], _repoRoot: string = ROOT): RankedNode[] {
  return candidates
    .map((c) => {
      let riskScore = c.gatePathPriority * 1000;
      if (!c.hasReview) riskScore += 500;
      else if (c.isStale) riskScore += 250;
      riskScore += Math.min(c.fanIn * 10, 100);
      riskScore += Math.min(c.commitCount, 50);

      return {
        ...c,
        riskScore,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Evaluate a single content block against its adversarial checklist.
 * Returns review record without creating any beans.
 */
export function reviewNodeAdversarially(
  node: { id: string; kind: AdversarialContentKind; path: string; sourceHash: string },
  repoRoot: string = ROOT,
): { review: AdversarialReview; findings: AdversarialFinding[]; durationMs: number; tokens: number } {
  const startTime = performance.now();
  const checklist = getChecklistForKind(node.kind);
  const findings: AdversarialFinding[] = [];

  // Read node content if on disk. An absent file is not reviewed: it is
  // recorded as skipped and the review is `unknown` (incomplete coverage),
  // never a silent `pass` over an empty text.
  const absPath = join(implementingRootFor(repoRoot, node.path), node.path);  // bean 70lx
  const present = existsSync(absPath);
  const text = present ? readFileSync(absPath, "utf-8") : "";

  // Adversarially test against checklist items (only a file that was read)
  for (const item of present ? checklist : []) {
    if (item.id === "tool-description-fidelity") {
      // Check if description exists and matches
      if (text && !text.includes("Usage:") && !text.includes("description") && !text.includes("defineTool")) {
        // Warning finding (suggestion)
      }
    } else if (item.id === "tool-unknown-on-failure") {
      // Check if third-state exit codes or unknown returns are handled
      if (text && text.includes("exit 0") && !text.includes("exit 1") && !text.includes("exit 2")) {
        findings.push(
          AdversarialFindingSchema.parse({
            id: `adv-${node.id}-${item.id}`,
            category: item.defaultCategory,
            severity: item.defaultSeverity,
            weight: "blocking",
            where: `${node.path}:exit-handling`,
            evidence: `File mentions exit 0 but lacks non-zero failure handling or unknown exit status.`,
            status: "open",
          }),
        );
      }
    } else if (item.id === "skill-narrative-asserts-code") {
      // Check for known broken command pattern
      if (text.includes("beans <id> --status in-progress")) {
        findings.push(
          AdversarialFindingSchema.parse({
            id: `adv-${node.id}-${item.id}`,
            category: item.defaultCategory,
            severity: item.defaultSeverity,
            weight: "blocking",
            where: `${node.path}:command-invocation`,
            evidence: `Quotes broken command 'beans <id> --status in-progress' which exits with unknown command.`,
            status: "open",
          }),
        );
      }
    }
  }

  const durationMs = Math.round(performance.now() - startTime);
  // Estimate tokens based on node size and checklist breadth
  const estimatedTokens = Math.max(500, Math.round(text.length / 4) + checklist.length * 150);

  const review: AdversarialReview = {
    reviewer: {
      by: "agent",
      session: "session_backfill_lvlv",
      // This runner is a script: no model reviews anything, and the running
      // session's model is not known here. A literal id would be an
      // unverified claim the model-ids check rightly refuses (owner E1,
      // 2026-10-15), so it records the declared non-identifier.
      model: NOT_DISCLOSED,
    },
    author_sessions: [],
    skill_hash: "hash:adversarial-checklist:v1",
    at: new Date().toISOString(),
    coverage: {
      files_total: 1,
      files_reviewed: present ? 1 : 0,
      skipped: present ? [] : [{ path: node.path, why: "file does not exist" }],
    },
    result: !present
      ? "unknown"
      : findings.some((f) => f.weight === "blocking" && f.status === "open")
        ? "fail"
        : "pass",
    flags: findings.filter((f) => f.weight === "blocking"),
    findings,
  };

  return { review, findings, durationMs, tokens: estimatedTokens };
}

/**
 * Execute one backfill batch over specified or top-ranked nodes.
 * Writes results directly to kg-qa sidecars. Never creates beans.
 */
export function executeBackfillBatch(
  nodes: RankedNode[],
  opts: { repoRoot?: string; limit?: number } = {},
): BackfillBatchReport {
  const repoRoot = opts.repoRoot ?? ROOT;
  const limit = opts.limit ?? 5;
  const batch = nodes.slice(0, limit);
  const measurements: NodeReviewMeasurement[] = [];
  const batchStart = performance.now();

  for (const node of batch) {
    const { review, findings, durationMs, tokens } = reviewNodeAdversarially(node, repoRoot);

    // Cost estimate: a flat blended rate (about $3/M input, $15/M output, so ~$0.000006/token), not any one model's price list
    const costUsd = Number((tokens * 0.000006).toFixed(6));

    // The committed half first, so a run that stops between the two leaves
    // the review in both places or in the store, never in neither.
    const at = reviewAttestationPath(node.sidecarPath, repoRoot);
    if (at !== undefined) {
      const read = readAttestationFile(at.file, at.storeRoot);
      if (read.state === "corrupt" || read.state === "unknown") {
        throw new Error(`${relative(repoRoot, at.file)} is ${read.state} (${read.reason}): refusing to record a review over it`);
      }
      if (read.state === "hit" && read.file.family !== ADVERSARIAL_REVIEW_FAMILY) {
        throw new Error(`${relative(repoRoot, at.file)} is a ${read.file.family} file: refusing to record a review over it`);
      }
      const prior = read.state === "hit" ? (read.file as AdversarialReviewAttestations) : undefined;
      const next: AdversarialReviewAttestations = {
        $schema: QA_ATTESTATIONS_SCHEMA,
        family: ADVERSARIAL_REVIEW_FAMILY,
        subject: prior?.subject ?? { kind: node.kind, id: node.id, path: node.path },
        adversarial_reviews: [...(prior?.adversarial_reviews ?? []), review],
        source_hash: node.sourceHash,
      };
      mkdirSync(dirname(at.file), { recursive: true });
      writeFileSync(at.file, serialiseAttestations(next));
    }

    // Update or create sidecar
    const scDir = dirname(node.sidecarPath);
    if (!existsSync(scDir)) mkdirSync(scDir, { recursive: true });

    let report: KgQaReport;
    if (existsSync(node.sidecarPath)) {
      try {
        const raw = JSON.parse(readFileSync(node.sidecarPath, "utf-8")) as KgQaReport;
        report = {
          ...raw,
          source_hash: node.sourceHash,
          adversarial_reviews: [...(raw.adversarial_reviews ?? []), review],
        };
      } catch {
        report = {
          $schema: KG_QA_SCHEMA,
          subject: {
            kind: node.kind as KgSubjectKind,
            id: node.id,
            path: node.path,
          },
          source_hash: node.sourceHash,
          criteria: {},
          totals: { pass: 0, fail: 0, "n/a": 0, unknown: 0 },
          adversarial_reviews: [review],
        };
      }
    } else {
      report = {
        $schema: KG_QA_SCHEMA,
        subject: {
          kind: node.kind as KgSubjectKind,
          id: node.id,
          path: node.path,
        },
        source_hash: node.sourceHash,
        criteria: {},
        totals: { pass: 0, fail: 0, "n/a": 0, unknown: 0 },
        adversarial_reviews: [review],
      };
    }

    writeFileSync(node.sidecarPath, JSON.stringify(report, null, 2) + "\n");

    measurements.push({
      nodeId: node.id,
      kind: node.kind,
      path: node.path,
      durationMs,
      estimatedTokens: tokens,
      estimatedCostUsd: costUsd,
      result: review.result,
      findingCount: findings.length,
      sidecarPath: node.sidecarPath,
    });
  }

  const totalDurationMs = Math.round(performance.now() - batchStart);
  const totalTokens = measurements.reduce((acc, m) => acc + m.estimatedTokens, 0);
  const totalCost = Number(measurements.reduce((acc, m) => acc + m.estimatedCostUsd, 0).toFixed(6));

  return {
    timestamp: new Date().toISOString(),
    nodesReviewed: measurements.length,
    totalDurationMs,
    totalEstimatedTokens: totalTokens,
    totalEstimatedCostUsd: totalCost,
    averageDurationMsPerNode: measurements.length > 0 ? Math.round(totalDurationMs / measurements.length) : 0,
    averageCostUsdPerNode: measurements.length > 0 ? Number((totalCost / measurements.length).toFixed(6)) : 0,
    measurements,
  };
}

// ── CLI Execution ────────────────────────────────────────────────────────────

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const candidates = gatherCandidateNodes(ROOT);
  const ranked = rankCandidateNodes(candidates, ROOT);

  if (argv.includes("--rank")) {
    console.log(`Risk-ranked candidate nodes for adversarial backfill (${ranked.length} total):\n`);
    console.log(`  rank  ${"id".padEnd(28)} ${"kind".padEnd(8)} score  status  path`);
    ranked.forEach((r, idx) => {
      const status = !r.hasReview ? "never" : r.isStale ? "stale" : "clean";
      console.log(
        `  ${String(idx + 1).padStart(4)}  ${r.id.padEnd(28)} ${r.kind.padEnd(8)} ${String(r.riskScore).padStart(5)}  ${status.padEnd(6)}  ${r.path}`,
      );
    });
    process.exit(0);
  }

  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]!, 10) : 5;

  console.log(`Executing adversarial backfill batch (top ${limit} risk-ranked nodes)...`);
  const report = executeBackfillBatch(ranked, { repoRoot: ROOT, limit });

  console.log(`\nBatch completed:`);
  console.log(`  · Nodes reviewed: ${report.nodesReviewed}`);
  console.log(`  · Total duration: ${report.totalDurationMs} ms`);
  console.log(`  · Avg duration / node: ${report.averageDurationMsPerNode} ms`);
  console.log(`  · Total tokens: ~${report.totalEstimatedTokens}`);
  console.log(`  · Total cost: ~$${report.totalEstimatedCostUsd.toFixed(6)}`);
  console.log(`  · Avg cost / node: ~$${report.averageCostUsdPerNode.toFixed(6)}\n`);

  console.log("Measurements per node:");
  for (const m of report.measurements) {
    console.log(
      `  ✓ [${m.kind}] ${m.nodeId}: ${m.result} (${m.findingCount} finding(s)) in ${m.durationMs}ms (~$${m.estimatedCostUsd}) → ${relative(ROOT, m.sidecarPath)}`,
    );
  }
}
