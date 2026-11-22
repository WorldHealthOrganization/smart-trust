#!/usr/bin/env bun
/**
 * Change-size checker script.
 *
 * ## What this script does
 *
 * Evaluates the size of a change against the advisory threshold (~400 effective lines):
 * - Code lines are weighted at 1.0
 * - Prose & KG documentation are weighted at 0.25 (4x line allowance)
 * - Lockfiles, generated artifacts, and uniform mechanical migrations are exempt
 * - Reports threshold with its empirical basis (Cisco 2006, Google 2018)
 * - Current mode is report-only (advisory), transitioning to blocking CI gate once calibrated
 * - Outputs SC-005 metrics as a count with its denominator, never a bare percentage
 *
 * ## Usage
 *
 * ```sh
 * bun run cat-harness-tools/scripts/check-change-size.ts [--against origin/main] [--strict]
 * ```
 *
 * @covers schemas
 * @graphNode tool
 */

import { spawnSync } from "node:child_process";
import {
  calculateChangeSize,
  DEFAULT_CHANGE_SIZE_THRESHOLD,
  formatSc005Metric,
  type ChangeSizeThreshold,
} from "../schemas/sdlc/change-size.ts";

export interface GitDiffNumstatEntry {
  path: string;
  linesChanged: number;
}

/**
 * Get git diff --numstat against a base ref.
 */
export function getGitDiffNumstat(baseRef = "origin/main", cwd?: string): GitDiffNumstatEntry[] {
  // Try git diff --numstat baseRef...HEAD first
  let res = spawnSync("git", ["diff", "--numstat", `${baseRef}...HEAD`], {
    encoding: "utf-8",
    cwd,
  });

  if (res.status !== 0 || !res.stdout.trim()) {
    // Fall back to git diff --numstat baseRef
    res = spawnSync("git", ["diff", "--numstat", baseRef], {
      encoding: "utf-8",
      cwd,
    });
  }

  if (res.status !== 0) {
    return [];
  }

  const entries: GitDiffNumstatEntry[] = [];
  const lines = res.stdout.trim().split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length >= 3) {
      const added = parts[0] === "-" ? 0 : parseInt(parts[0], 10) || 0;
      const deleted = parts[1] === "-" ? 0 : parseInt(parts[1], 10) || 0;
      const path = parts[2].trim();
      entries.push({ path, linesChanged: added + deleted });
    }
  }

  return entries;
}

/**
 * Inspect recent PR merge commits to calculate SC-005 metric.
 */
export function inspectMergeHistory(
  sampleSize = 20,
  threshold: ChangeSizeThreshold = DEFAULT_CHANGE_SIZE_THRESHOLD,
  cwd?: string
): { oversizedCount: number; totalCount: number; formatted: string } {
  const logRes = spawnSync(
    "git",
    ["log", "--merges", `--max-count=${sampleSize}`, "--pretty=format:%H"],
    { encoding: "utf-8", cwd }
  );

  if (logRes.status !== 0 || !logRes.stdout.trim()) {
    return { oversizedCount: 0, totalCount: 0, formatted: formatSc005Metric(0, 0) };
  }

  const mergeHashes = logRes.stdout.trim().split("\n").filter(Boolean);
  let oversizedCount = 0;
  let totalCount = 0;

  for (const hash of mergeHashes) {
    const diffRes = spawnSync("git", ["diff", "--numstat", `${hash}^1`, hash], {
      encoding: "utf-8",
      cwd,
    });
    if (diffRes.status === 0 && diffRes.stdout.trim()) {
      const files: GitDiffNumstatEntry[] = [];
      for (const line of diffRes.stdout.trim().split("\n")) {
        const parts = line.split("\t");
        if (parts.length >= 3) {
          const added = parts[0] === "-" ? 0 : parseInt(parts[0], 10) || 0;
          const deleted = parts[1] === "-" ? 0 : parseInt(parts[1], 10) || 0;
          files.push({ path: parts[2].trim(), linesChanged: added + deleted });
        }
      }
      const breakdown = calculateChangeSize(files, threshold);
      totalCount++;
      if (breakdown.exceedsThreshold) {
        oversizedCount++;
      }
    }
  }

  return {
    oversizedCount,
    totalCount,
    formatted: formatSc005Metric(oversizedCount, totalCount),
  };
}

// ── CLI execution ────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log(`usage: bun run cat-harness-tools/scripts/check-change-size.ts [--against <ref>] [--strict] [--history <N>]

Evaluates change size against the ~400 effective lines advisory threshold (FR-009):
- Code lines: 1.0x weight
- Prose & KG documentation: 0.25x weight (4x line allowance)
- Exemptions: lockfiles, generated files, uniform mechanical migrations
- Reports empirical basis structurally (Cisco 2006, Google 2018)
- Mode: report-only (advisory) by default; fails if --strict is specified
- Reports SC-005 as a count with denominator, never as a bare percentage`);
    process.exit(0);
  }

  let baseRef = "origin/main";
  const againstIdx = args.indexOf("--against");
  if (againstIdx !== -1 && args[againstIdx + 1]) {
    baseRef = args[againstIdx + 1];
  }

  const isStrict = args.includes("--strict") || args.includes("--block");
  const historyIdx = args.indexOf("--history");

  if (historyIdx !== -1) {
    const n = parseInt(args[historyIdx + 1] || "20", 10);
    console.log(`Calibrating against last ${n} merge commits (SC-005)...`);
    const history = inspectMergeHistory(n);
    console.log(`PR Size Compliance (SC-005): ${history.formatted}`);
    process.exit(0);
  }

  console.log(`Evaluating change size against base ref "${baseRef}"...`);
  const entries = getGitDiffNumstat(baseRef);

  if (entries.length === 0) {
    console.log(`✓ No changed files detected against ${baseRef}.`);
    process.exit(0);
  }

  const breakdown = calculateChangeSize(entries);

  console.log(`\nChange Size Breakdown:`);
  console.log(`  Code lines (1.0x):      ${breakdown.codeLines}`);
  console.log(`  Prose & KG lines (0.25x): ${breakdown.proseKgLines}`);
  console.log(`  Exempt lines (0.0x):    ${breakdown.exemptLines}`);
  console.log(`  -----------------------------------------`);
  console.log(`  Effective lines:        ${breakdown.effectiveLines} / ${breakdown.threshold.limit}`);
  console.log(`  Enforcement mode:       ${breakdown.threshold.mode} (advisory limit initially)`);
  console.log(`\nThreshold Basis:`);
  console.log(`  ${breakdown.threshold.basis}`);

  if (breakdown.exceedsThreshold) {
    console.log(
      `\n⚠️  ADVISORY: Change size (${breakdown.effectiveLines} effective lines) exceeds the advisory threshold of ${breakdown.threshold.limit}.`
    );
    console.log(
      `   Per FR-008, consider splitting into child issues/PRs or recording justification in the PR description.`
    );
    if (isStrict) {
      console.error(`\n✗ FAILED (--strict mode requested).`);
      process.exit(1);
    }
  } else {
    console.log(
      `\n✓ Change size is within advisory limit (${breakdown.effectiveLines} <= ${breakdown.threshold.limit} effective lines).`
    );
  }

  process.exit(0);
}
