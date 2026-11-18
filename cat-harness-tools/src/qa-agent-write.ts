/**
 * Shared agent/human QA-entry writer.
 *
 * Centralises the staleness-stamping that every audit (script, agent,
 * human) must perform, so it is *transparent to the audit*: a reviewer
 * supplies only the verdict (result / severity / evidence); this helper
 * captures the `field_hash` (current md/ts/lean source hashes) and
 * `reviewed_tree` uniformly — no `reviewed_at`, whose date is derived on read
 * from the tree (owner rulings 2026-11-06, "QA dates" / "Date source") — the provenance
 * `qa-sweep.ts` stamps on script entries, with HEAD's tree in place of its
 * commit (bean 69lr; owner card Q4, 2026-11-05: a PR run's HEAD is a
 * synthetic merge commit that can vanish, while its tree survives onto main).
 *
 * This is the write path used by the parallel agent-drain campaign:
 * a sub-agent evaluates one criterion on one block, then calls
 *
 *   bun run pipeline/qa-agent-write.ts \
 *     --block <base-path-without-extension> \
 *     --criterion <criterion-id> \
 *     --result pass|fail|warn|n/a \
 *     [--severity critical|major|minor] \
 *     [--score 0.85] [--score-max 1] [--score-rubric '{"clarity":0.9}'] \
 *     [--evidence "file:line — verbatim quote"] \
 *     [--notes "..."] \
 *     [--model <agent-model>] [--skill local/qa-agent-drain]
 *
 * Idempotent per (block, criterion, agent-id): any prior entry from
 * the same agent identity (`reviewer.id`) on this criterion is
 * replaced before the fresh one is appended; script, human, and
 * other agents' entries are preserved. Freshness of *all* entries
 * is judged at read time by `entryIsFresh` over the full md/ts/lean
 * `field_hash` — this writer does not second-guess it.
 *
 * @module pipeline/qa-agent-write
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import {
  hashBlockFiles,
  gitHeadTree,
  loadQaReport,
  saveQaReport,
  readBlockManifest,
  resolveCanonicalLean,
  loadPriorBlockReport,
  priorRefusalLine,
} from "../pipeline/qa-utils";
import { priorFromOrExit } from "../scripts/qa-results.ts";
import { blockQaPath, existingBlockQaPath, findContentRepoRoot } from "../pipeline/qa-paths";
import { blockAttestationKey, composeCriteria, finalizeCriteria, refusalLine, resolvePrior } from "../schemas/sdlc/qa-attestations.ts";
import type {
  BlockQaReport,
  QaCriterionEntry,
} from "../schemas/sdlc/block-qa.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { dirname } from "node:path";

const REPO_ROOT = resolve(dirname(HARNESS_ROOT));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fail(msg: string): never {
  console.error(`qa-agent-write: ${msg}`);
  process.exit(2);
}

const blockArg = arg("block");
const criterion = arg("criterion");
const result = arg("result") as QaCriterionEntry["result"] | undefined;
if (!blockArg || !criterion || !result) {
  fail(
    "required: --block <base-path> --criterion <id> --result pass|fail|warn|n/a",
  );
}
const VALID_RESULTS = ["pass", "fail", "warn", "n/a"];
if (!VALID_RESULTS.includes(result!)) {
  fail(`--result must be one of ${VALID_RESULTS.join("|")} (got ${result})`);
}

const severity = arg("severity") as
  | "critical"
  | "major"
  | "minor"
  | undefined;
if (severity && !["critical", "major", "minor"].includes(severity)) {
  fail("--severity must be critical|major|minor");
}
const evidence = arg("evidence");
const notes = arg("notes");
// Optional rubric score for scored (rater-style) criteria, e.g. proof-rater-*.
// The agent supplies BOTH --result (band) and --score (the 0–1 value).
const scoreRaw = arg("score");
// --score-max / --score-rubric are meaningless without --score; reject rather
// than silently ignore a user mistake (Copilot review #1939).
if (scoreRaw === undefined) {
  if (arg("score-max") !== undefined) fail("--score-max requires --score");
  if (arg("score-rubric") !== undefined) fail("--score-rubric requires --score");
}
let score: QaCriterionEntry["score"] | undefined;
if (scoreRaw !== undefined) {
  const value = Number(scoreRaw);
  const max = arg("score-max") !== undefined ? Number(arg("score-max")) : 1;
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    fail("--score and --score-max must be finite numbers with max > 0");
  }
  if (value < 0 || value > max) fail(`--score must be in [0, ${max}] (got ${value})`);
  const rubricRaw = arg("score-rubric");
  let rubric: Record<string, number> | undefined;
  if (rubricRaw !== undefined) {
    if (rubricRaw === "" || rubricRaw.startsWith("-")) {
      fail("--score-rubric requires a JSON-object value, e.g. '{\"clarity\":0.8}'");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rubricRaw);
    } catch {
      fail("--score-rubric must be valid JSON, e.g. '{\"clarity\":0.8}'");
    }
    // Must be a plain object whose values are all finite numbers
    // (matches Record<string, number>; rejects arrays/scalars/null/NaN).
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      !Object.values(parsed as Record<string, unknown>).every(
        (v) => typeof v === "number" && Number.isFinite(v),
      )
    ) {
      fail(
        "--score-rubric must be a JSON object of finite numbers, e.g. '{\"clarity\":0.8}'",
      );
    }
    rubric = parsed as Record<string, number>;
  }
  score = { value, max, ...(rubric ? { rubric } : {}) };
}
// Enforce the rubric band↔result mapping when a score is present (prevents
// e.g. `--result pass --score 0.1`): ≥0.66 ⇒ pass, ≥0.33 ⇒ warn, else fail.
if (score) {
  const frac = score.value / score.max;
  const band = frac >= 0.66 ? "pass" : frac >= 0.33 ? "warn" : "fail";
  if (result !== band) {
    fail(
      `--result "${result}" contradicts --score ${score.value}/${score.max} ` +
        `(band "${band}"); use --result ${band} or adjust the score`,
    );
  }
}
const model = arg("model");
const skill = arg("skill") ?? "local/qa-agent-drain";

// Resolve the block triple from the base path (no extension).
const base = blockArg!.replace(/\.(ts|md|lean|qa\.json)$/, "");
const tsPath = `${base}.ts`;
if (!existsSync(tsPath)) fail(`block manifest not found: ${tsPath}`);
const mdPath = existsSync(`${base}.md`) ? `${base}.md` : undefined;
// Prefer the sibling `<root>.lean`; if absent, resolve the canonical
// compiled declaration named by the block's `lean.ref` so QA scores the
// real statement rather than a missing/stub sibling (CLAUDE.md §3b-cond;
// mirrors walkBlocks' read-path fallback in qa-utils).
let leanPath: string | undefined = existsSync(`${base}.lean`)
  ? `${base}.lean`
  : undefined;
if (!leanPath) {
  const refMatch = readFileSync(tsPath, "utf-8").match(
    /ref:\s*["']([^"']+)["']/,
  );
  leanPath = resolveCanonicalLean(refMatch?.[1], REPO_ROOT);
}
// Read where the readers look; write where they look FIRST (bean r7v6, R50).
//
// This used to read and write `${base}.qa.json` beside the block, the legacy
// path. Every reader goes through `existingBlockQaPath`, which prefers the
// results tree, so once a block had a results-tree verdict an agent verdict
// written here was shadowed and never read. Now it is load-then-write, the
// same as `qa-agent-entry.ts` and `qa-sweep.ts`: the read falls back to the
// legacy sibling, so an unmigrated block keeps its history, and the write
// never does. The anchor is the block's own content repo, found the way
// qa-sweep finds it, so the recorded path does not depend on the cwd.
const contentRepoRoot = findContentRepoRoot(resolve(base), REPO_ROOT);
const qaReadPath = existingBlockQaPath(contentRepoRoot, resolve(base));
const qaPath = blockQaPath(contentRepoRoot, resolve(base));

const paths = { ts: tsPath, md: mdPath, lean: leanPath };
const currentHashes = hashBlockFiles(paths);
const headTree = gitHeadTree();
const nowIso = new Date().toISOString();
const today = nowIso.slice(0, 10);

const manifest = readBlockManifest(tsPath);
const label = manifest?.label ?? base.split("/").pop()!;
const kind = manifest?.kind ?? "unknown";

const relPaths = {
  ts: relative(REPO_ROOT, tsPath),
  md: mdPath ? relative(REPO_ROOT, mdPath) : undefined,
  lean: leanPath ? relative(REPO_ROOT, leanPath) : undefined,
};

// An agent verdict is an ATTESTATION (bean `8wj1`, D2): written to the store
// first, with the block's other attestations read from the store rather than
// from the prior report (C11). An unreadable store means nothing is written.
// `--prior-from <ref>` (bean `8wj1`, owner option B) reads the earlier report
// from the results store at that ref. An unreadable read refuses with exit 2
// rather than falling back to the working copy.
const priorFrom = priorFromOrExit("qa-agent-write");
let priorReport: BlockQaReport | undefined;
if (priorFrom !== undefined) {
  const loaded = loadPriorBlockReport(contentRepoRoot, resolve(base), priorFrom);
  if (!loaded.ok) {
    console.error(priorRefusalLine("qa-agent-write", relative(contentRepoRoot, resolve(base)), loaded));
    process.exit(2);
  }
  priorReport = loaded.report;
} else if (qaReadPath !== undefined) {
  priorReport = loadQaReport(qaReadPath);
}
const attested = resolvePrior(
  contentRepoRoot,
  blockAttestationKey(contentRepoRoot, resolve(base)),
  priorReport,
);
if (!attested.ok) {
  console.error(refusalLine("qa-agent-write", relative(contentRepoRoot, resolve(base)), attested));
  process.exit(4);
}
let report: BlockQaReport | undefined = attested.prior;
if (!report) {
  report = {
    $schema: "block-qa/v1",
    label,
    kind,
    paths: relPaths,
    source_hashes: currentHashes,
    criteria: composeCriteria({}, attested.attestations) as BlockQaReport["criteria"],
  };
}

// Refresh top-level provenance.
report.source_hashes = currentHashes;
// No clock in the sidecar (owner rulings 2026-11-06, "QA dates" / "Date
// source"): its date is derived on read from reviewed_tree.
delete report.updated_at;

const entry: QaCriterionEntry = {
  field_hash: currentHashes,
  result: result!,
  ...(severity ? { severity } : {}),
  ...(score ? { score } : {}),
  ...(evidence ? { evidence } : {}),
  reviewer: {
    kind: "agent",
    id: skill,
    ...(model ? { agent_model: model } : {}),
    agent_date: today,
    agent_skill: skill,
  },
  reviewed_tree: headTree,
  ...(notes ? { notes } : {}),
};

const existing = report.criteria[criterion] ?? [];
// Idempotent per agent identity: replace any prior entry written by
// THIS agent (`reviewer.id === skill`) on this criterion. Preserve
// script, human, and other agents' entries — their freshness is
// determined at read time over the full md/ts/lean field_hash.
const kept = existing.filter(
  (e) => !(e.reviewer.kind === "agent" && e.reviewer.id === skill),
);
report.criteria[criterion] = [...kept, entry];
try {
  report.criteria = finalizeCriteria(attested, report.criteria, "attesting");
} catch (err) {
  console.error(refusalLine("qa-agent-write", relative(contentRepoRoot, resolve(base)), {
    state: "unknown",
    path: attested.path,
    reason: err instanceof Error ? err.message : String(err),
  }));
  process.exit(4);
}

saveQaReport(qaPath, report);
console.log(
  `qa-agent-write: ${criterion} = ${result}${severity ? ` (${severity})` : ""}${score ? ` score=${score.value}/${score.max}` : ""}  -> ${relative(REPO_ROOT, qaPath)}`,
);
