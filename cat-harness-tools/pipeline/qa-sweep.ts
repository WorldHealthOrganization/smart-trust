#!/usr/bin/env bun
/**
 * QA sweep CLI — run automated criteria on every block under a path
 * and write / update per-block `<block>.qa.json` audit reports.
 *
 * Usage:
 *
 *   # Sweep one section (relative to repo root)
 *   bun run cat-harness-tools/pipeline/qa-sweep.ts \
 *     content/quantum-observable-universe/organic-chemistry
 *
 *   # Sweep the whole paper
 *   bun run cat-harness-tools/pipeline/qa-sweep.ts content/quantum-observable-universe
 *
 *   # Restrict to a single criterion
 *   bun run cat-harness-tools/pipeline/qa-sweep.ts \
 *     content/.../organic-chemistry \
 *     --only voice-status-leak,voice-ai-slop
 *
 *   # Show what would change, write nothing
 *   bun run cat-harness-tools/pipeline/qa-sweep.ts content/.../organic-chemistry --dry-run
 *
 *   # Emit a structured JSON summary to stdout (machine-readable)
 *   bun run cat-harness-tools/pipeline/qa-sweep.ts content/... --json
 *
 * Behaviour:
 *
 *   - For each block triple under <root>, computes the current
 *     md/ts/lean SHA-256 prefixes.
 *   - Loads the existing <block>.qa.json (if any).
 *   - For each automated criterion:
 *       - If a fresh entry exists (field_hash matches current),
 *         skip — no need to re-audit.
 *       - Otherwise, run the checker and write a reviewer entry with
 *         reviewer.kind="script", reviewer.id="qa-sweep". A script
 *         re-run is a REFRESH: the fresh entry REPLACES the prior
 *         script entry (agent/human entries are preserved) so the
 *         criterion array does not grow unboundedly across sweeps.
 *   - Non-automated criteria (scholarly-default, ai-slop, fit-...)
 *     are reported as `needs-agent` in the summary but NOT written
 *     to the sidecar — the watcher dispatches an agent to fill those.
 *   - Writes the updated sidecar (unless --dry-run).
 *
 * Exit codes:
 *   0 — sweep complete, no critical findings
 *   1 — at least one critical finding (use in --ci)
 *   2 — invocation error
 *
 * @module pipeline/qa-sweep
 */

import { existsSync, statSync } from "fs";
import { resolve, relative, dirname } from "path";
import { fileURLToPath } from "url";

// Stable anchor for path normalisation: the LAYER root, computed
// from this file's location (`cat-harness-tools/pipeline/qa-sweep.ts`
// → `cat-harness/`, two levels up). Using `process.cwd()` instead
// would make the emitted `.qa.json` paths sensitive to the directory
// from which the sweep is invoked (sweep run from `content/` produced
// bare paths, sweep run from the root produced `content/...` paths —
// noisy diffs in CI vs local). An anchor tied to this file is invariant
// under the invocation directory, which is the property wanted here.
//
// It was named `REPO_ROOT` and described as the repo root until
// 2026-09-27, and both were true BEFORE the split moved this file under
// `cat-harness/`: two levels up used to be the repository. The split
// changed what it lands on and left the name behind — the `b963`
// re-rooted-ascent shape — and `check:anchor-names` could not see it,
// because its base alternation did not match `dirname(__filename)`.
const __filename = fileURLToPath(import.meta.url);
const INSTANCE_ROOT = resolve(dirname(__filename), "..");

import { GIT_SHA_UNKNOWN, applicabilityGap, scriptSidecarTarget, computeCriterionScriptHashes, entryIsFresh, freshnessKeys, gitHeadSha, gitHeadTree, hashBlockFiles, loadPriorBlockReport, loadQaScriptSidecar, priorRefusalLine, missingCompanionNote, preserveNonScriptEntries, sameScriptVerdict, saveQaReport, saveQaScriptSidecar, sweepActor, type CriterionScriptHashes, walkBlocks } from "./qa-utils.ts";
import {
  qaCriteriaFor,
  qaCriteriaByIdFor,
  WATCHER_CRITERIA_BY_AXIS,
  getCriterionExtraInputs,
} from "./qa-criteria-registry";
import { discoverBlockCheckers } from "./qa-checker-discovery";
import { isCriterionSourceMiss, resolveCriterionSource } from "./criterion-source";
import { loadContributions } from "../schemas/kg/harness-config.ts";
import { ContributionRegistry, composedKindOwner, type FolioContribution } from "../schemas/content/contributions.ts";
import { usesGraphHash } from "./uses-graph-hash";
import { blockQaPath, findContentRepoRoot } from "./qa-paths";
import { PRIOR_FROM_FLAG, priorFromOrExit } from "../scripts/qa-results.ts";
import { blockAttestationKey, composeCriteria, finalizeCriteria, refusalLine, resolvePrior } from "../schemas/sdlc/qa-attestations.ts";
import { contributionsRoot } from "./repo-root";


import type { BlockQaReport, CheckerResult, CompanionRole, QaCriterionEntry, QaScriptSidecar} from "../schemas/sdlc/block-qa.ts";
import {
  criterionAdapters,
  criterionProfiles,
  profileExcludesCriterion,
  voiceExcludesCriterion,
} from "../schemas/sdlc/block-qa.ts";
import { adapterForKind } from "../schemas/content/block-kinds.ts";
import { readDeclaredFolioProfile } from "./profile-check";
import { readActiveVoices } from "../schemas/content/voices.ts";
import { isJsonManifest } from "./json-manifest.ts";


// ── CLI parsing ─────────────────────────────────────────────────

interface Args {
  root: string;
  only?: string[];
  axis?: string[];
  dryRun: boolean;
  json: boolean;
  ci: boolean;
  /**
   * Where the per-criterion script sidecars go. Defaults to `INSTANCE_ROOT` —
   * this platform checkout, whose checkers they describe.
   *
   * ## Why a caller may need to say (bean `ymsu`)
   *
   * Those sidecars describe folio-assistant's OWN checker scripts, so the
   * default is right for a real sweep and wrong for a test: a test sweeping a
   * temp-directory folio still writes into the platform checkout, because
   * `INSTANCE_ROOT` is resolved from this module's location rather than from
   * anything the caller passed. `scripts/tests/init-folio-qa.test.ts` does
   * exactly that, inside `bun test`, which is gate 1 of `bun run cat gates`.
   *
   * `saveQaScriptSidecar`'s write-skip (bean `3ozg`) hides it on a clean tree
   * and stops hiding it the moment a checker's hash actually moves — which is
   * precisely the run where a gate reading a repaired copy matters.
   *
   * A directory rather than a suppress-flag, and explicit rather than an
   * environment variable, because that is the pattern already here:
   * `pipeline/profile-conformance-axis.test.ts` builds its root with
   * `mkdtempSync` and passes it in. The test still exercises the real write —
   * it just writes somewhere it owns.
   */
  scriptSidecarRoot?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { root: "", dryRun: false, json: false, ci: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--script-sidecar-root") {
      // Absent and empty are NOT the same: `--script-sidecar-root` with no
      // value is a caller who meant to redirect and failed to, and silently
      // falling back to the platform checkout is the write they were trying to
      // avoid. Left undefined here; the resolution below refuses it.
      out.scriptSidecarRoot = argv[++i];
    }
    else if (a === "--json") out.json = true;
    else if (a === "--ci") out.ci = true;
    else if (a === PRIOR_FROM_FLAG) i++; // its value is read by priorFromOrExit
    else if (a === "--only") {
      out.only = (argv[++i] ?? "").split(",").filter(Boolean);
    } else if (a === "--axis") {
      out.axis = (argv[++i] ?? "").split(",").filter(Boolean);
    } else if (!a.startsWith("--")) {
      if (!out.root) out.root = a;
    }
  }
  if (!out.root) {
    console.error(
      "usage: qa-sweep.ts <content-root> [--only ID,ID] [--axis NAME[,NAME]] [--dry-run] [--json] [--ci]\n" +
        "                   [--script-sidecar-root DIR] [--prior-from <ref>]",
    );
    process.exit(2);
  }
  if (out.scriptSidecarRoot !== undefined && out.scriptSidecarRoot.trim() === "") {
    console.error("--script-sidecar-root needs a directory. Omit the flag to write to this platform checkout.");
    process.exit(2);
  }
  return out;
}

// ── Sweep ───────────────────────────────────────────────────────

interface BlockSweepResult {
  label: string;
  kind: string;
  md?: string;
  ts: string;
  lean?: string;
  qa_path: string;
  criteria_run: number;
  criteria_skipped_fresh: number;
  criteria_needs_agent: number;
  fail_critical: number;
  fail_major: number;
  fail_minor: number;
  details: Array<{
    criterion: string;
    // `CheckerResult["result"]` is assigned here verbatim, so this union must
    // contain all of it. It omitted `"warn"` and plain `"n/a"` — meaning a
    // soft finding was written into the details JSON as a value the type said
    // could not occur, and a consumer switching exhaustively on `outcome`
    // would not handle it. `CheckerResult` documents that `warn` is
    // "preserved end-to-end … without being silently coerced to `pass`", and
    // an earlier `warn` -> `pass` coercion in the extended dispatch did
    // silently drop chapter-mismatch warnings (#1640). Referencing the type
    // rather than restating it is what stops the two drifting again.
    outcome:
      | "fresh-skip"
      | "needs-agent"
      | `n/a-no-${CompanionRole}`
      | "n/a-wrong-adapter"
      // Deliberately NOT folded into `n/a-wrong-adapter`. Adapter and profile
      // are orthogonal axes and a reader of this report has to be able to
      // tell which one excluded the criterion: "this criterion belongs to
      // another vocabulary" and "this folio is a document and that criterion
      // needs LaTeX" call for entirely different follow-up.
      | "n/a-wrong-profile"
      | "n/a-voice-not-active"
      | CheckerResult["result"];
    severity?: "critical" | "major" | "minor";
    hits?: number;
    first_hit?: string;
  }>;
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const priorFrom = priorFromOrExit("qa-sweep");
  // Resolved ONCE, from the registry rather than from an import list: every
  // automated criterion declares the module its checker lives in, so an
  // adapter's checkers are reached because its criteria name them and not
  // because this file knows the adapter exists. See qa-checker-discovery.
  //
  // THE COMPOSITION ROOT. This process has a top-level `await run()`, so this
  // is the outermost thing that runs before any checker is looked for — the
  // place a dependency's contributions are loaded. It names no dependency: it
  // walks the ones the folio DECLARES, so a higher layer supplying the
  // elaboration-cost checkers costs this file no knowledge that sci exists.
  //
  // Which is the point. `getCriterionSourceFile` used to hold the string
  // `pipeline/qa-checkers-cost.ts`, and `check:partition` counted no
  // edge for it because a string is not an import — but after the repository
  // split that file lives in another package and still has to be there. Bean
  // `zlmp` measured five such runtime edges; this drains one of them.
  //
  // Loaded from `contributionsRoot()`, NOT `INSTANCE_ROOT`. INSTANCE_ROOT is
  // `cat-harness/`, which declares no dependencies, so loading from it
  // registered 0 contributed checkers and the two contributed cost criteria
  // never ran (folio-assistant#1492). INSTANCE_ROOT stays the anchor for
  // path normalisation, which is what it is for.
  const contributions = await loadContributions<FolioContribution, ContributionRegistry>(
    contributionsRoot(),
    new ContributionRegistry(),
  );
  const discovery = await discoverBlockCheckers(contributions);
  const checkers = discovery.checkers;
  const rootAbs = resolve(args.root);
  // Anchor for recorded block paths: the content repo that owns the
  // swept blocks (NOT this platform checkout — see findContentRepoRoot).
  const contentRepoRoot = findContentRepoRoot(rootAbs, INSTANCE_ROOT);
  // The folio's declared content profile, read ONCE per run from the same
  // repo root the block paths are anchored to. `profile` is `undefined` when
  // the folio does not say — see the profile gate below for what that means
  // and why it is not the same as "paper".
  const declaredProfile = readDeclaredFolioProfile(contentRepoRoot);
  // The folio's ACTIVE voices, read once per run from the same repo root.
  //
  // `undefined` means the configuration could not be read at all, which is a
  // third state and NOT the same as "activates nothing": an unreadable config
  // must not be spent granting a skip, so `voiceExcludesCriterion` runs the
  // criterion in that case. An empty array is a folio that read its config and
  // activates none, which is the common case and does exclude.
  const activeVoiceIds = readActiveVoices(contentRepoRoot);
  // Single-block targets: accept a sibling file path (`<block>.ts`,
  // `.md`, `.lean`, `.qa.json`) or an extension-less block-path prefix
  // in addition to a chapter/paper directory. The walk then starts at
  // the block's directory, filtered down to that one block root.
  let walkRoot = rootAbs;
  let blockRootFilter: string | undefined;
  if (!existsSync(rootAbs) || !statSync(rootAbs).isDirectory()) {
    const blockRoot = rootAbs.replace(/\.(qa\.json|ts|json|md|lean)$/, "");
    if (existsSync(blockRoot + ".ts") || isJsonManifest(blockRoot + ".json")) {
      walkRoot = dirname(blockRoot);
      blockRootFilter = blockRoot;
    } else if (existsSync(rootAbs)) {
      console.error(
        `qa-sweep: target has no block manifest (${blockRoot}.ts): ${rootAbs}`,
      );
      process.exit(2);
    } else {
      console.error(`qa-sweep: root not found: ${rootAbs}`);
      process.exit(2);
    }
  }

  const headSha = gitHeadSha();
  // What a block verdict records as `reviewed_tree`: the tree outlives a PR
  // run's synthetic merge commit (bean 69lr; owner card Q4, 2026-11-05).
  const headTree = gitHeadTree();
  // The run's own time. It goes in this run's summary (`generated_at` below),
  // never into a sidecar: a verdict's date is derived from the tree it
  // reviewed (owner ruling 2026-11-06, card "QA dates", option 1).
  const nowIso = new Date().toISOString();
  // Criterion-selection precedence (most-specific first):
  //   --only ID[,ID]    explicit criterion IDs (any axis)
  //   --axis NAME[,...] one or more watcher axes (one-voice, proof,
  //                     canonical, compute, detangler)
  //   (default)         every registered criterion across all axes
  // Criteria BY ID, through the instance-aware index rather than the static
  // one. Since bean `btuv` the voice-overlay criteria are derived from the
  // voices a layer ships, and every lookup below would return `undefined`
  // for them: the selection filter would drop `--only voice-overlay-milnor`,
  // the per-block loop's `if (!def) continue` would leave them out of every
  // sidecar, and — worst — the voice gate would see `{}` and a criterion naming
  // no voice always runs, so a WHO criterion would sweep a folio that never
  // adopted WHO style. Read once per run; the derivation is memoised anyway.
  const criteriaById = qaCriteriaByIdFor(INSTANCE_ROOT);

  const criteriaSelected: string[] =
    args.only && args.only.length > 0
      ? args.only.filter((id) => criteriaById[id])
      : args.axis && args.axis.length > 0
        ? args.axis.flatMap((a) => WATCHER_CRITERIA_BY_AXIS[a] ?? [])
        : qaCriteriaFor(INSTANCE_ROOT).map((c) => c.id);

  // VOICE GATE, applied ONCE here rather than per block, because the question is
  // a property of the folio and not of any block: which editorial registers did
  // this folio opt into?
  //
  // The adapter and profile gates sit inside the per-block loop because they can
  // depend on the block's kind. A voice cannot, so asking 122 times would give
  // 122 identical answers — and, for the `automated: false` criteria that voice
  // overlays are, would put 4 × 122 phantom rows in the agent queue for voices
  // nobody activated. A non-automated criterion is counted as `needs-agent` and
  // never written to a sidecar (see the module comment), so the queue is the
  // only place the exclusion could show, and the queue is exactly where it
  // matters: an agent must not be handed WHO editorial review on a folio that
  // never adopted WHO style.
  //
  // Reported once below rather than written 488 times as `n/a`. An `n/a` entry
  // per block would be sidecar bloat carrying no information a reader of the
  // folio's own configuration does not already have.
  const voiceSkipped = criteriaSelected.filter((id) =>
    voiceExcludesCriterion(criteriaById[id] ?? {}, activeVoiceIds),
  );
  const criteriaToRun: string[] = criteriaSelected.filter(
    (id) => !voiceSkipped.includes(id),
  );
  if (voiceSkipped.length > 0 && !args.json) {
    console.log(
      `  voice gate: ${voiceSkipped.length} criterion(s) skipped — ` +
        `this folio activates ${
          activeVoiceIds && activeVoiceIds.length > 0
            ? activeVoiceIds.join(", ")
            : "no voice"
        } (${voiceSkipped.join(", ")})`,
    );
  }

  // Precompute one (script_hash, script_commit_sha, deps_hash) bundle
  // per criterion under sweep. The bundle is reused for every block
  // visited, then written out at the end of the run as a per-criterion
  // script sidecar under `pipeline/script-sidecars/`.
  const scriptHashesByCriterion: Record<string, CriterionScriptHashes> = {};
  for (const id of criteriaToRun) {
    const def = criteriaById[id];
    if (!def?.automated) continue;
    // Same ONE answer discovery used. Hashing a contributed checker against
    // this repo's root would read the wrong bytes — or none — and a
    // `script_hash` that does not track its checker is a verdict that can
    // never go stale, which is the defect `source_file` exists to prevent.
    const located = resolveCriterionSource(id, INSTANCE_ROOT, contributions);
    if (isCriterionSourceMiss(located)) continue;
    scriptHashesByCriterion[id] = computeCriterionScriptHashes(
      id,
      located.sourceFile,
      getCriterionExtraInputs(id),
      located.root,
      criteriaById[id],
      located.label,
    );
  }
  const engineVersion = `bun-${Bun.version}`;

  // Hash of the `uses[]` edge set under sweep, computed once per run.
  //
  // The detangler criteria answer questions about the GRAPH — forward
  // references, dependency cycles, cone depth, graph energy — so editing block
  // A's `uses[]` changes block B's verdict while B's own files are untouched.
  // Keyed only on its own `field_hash`, B stays `fresh-skip` and keeps a
  // verdict that is now wrong. Criteria opt in with
  // `also_invalidated_by: ["graph"]`; only their entries carry and compare it.
  //
  // The edge SET is hashed rather than the `.ts` files, so an edit that does
  // not touch `uses[]` does not invalidate the axis — hashing the manifests
  // would reintroduce exactly the churn per-criterion `script_hash` removed.
  const graphHash = usesGraphHash(walkRoot);

  const results: BlockSweepResult[] = [];

  let totalBlocks = 0;
  let totalCritical = 0;
  let totalMajor = 0;
  let totalMinor = 0;
  let totalNeedsAgent = 0;
  // Blocks NOT written because their attestations could not be read. Never a pass.
  let attestationRefusals = 0;
  let priorRefusals = 0;

  // `includeUnlabelled`: the sweep's question is "what prose ships?", not "what
  // is in the dependency graph". Unlabelled `prose()` blocks — chapter intros
  // and outros, the notation register — render into the paper and were outside
  // every criterion, while already carrying sidecars nothing could refresh.
  // See `qou/3fui`.
  //
  // `contributedBuilders`: a dependency's block kinds (the contributed `dak`
  // kinds, since bean `1335`) are discovered only when the walk is told their
  // builders — core no longer bakes them in.
  for (const block of walkBlocks(walkRoot, {
    includeUnlabelled: true,
    contributedBuilders: contributions.contributedBuilders(),
  })) {
    if (blockRootFilter && block.root !== blockRootFilter) continue;
    totalBlocks++;
    // Every present companion, not the paper triple. Building `{md, ts,
    // lean}` here was the wiring half of the `depends_on` defect: the type
    // system and the applicability gate learned about `.dmn` and `.fsh`, but
    // the sweep still hashed three files, so a DAK block's verdict could
    // never go stale when its decision table changed — a cached `pass` would
    // outlive the logic it judged.
    const paths = block.companions;
    const currentHashes = hashBlockFiles(paths);

    // Load or initialise report. `qaPath` is the WRITE target — the sweep is
    // a writer per the qa-paths.ts contract and never puts a verdict beside
    // its block. Loading falls back to the legacy sibling location when the
    // results-tree copy does not exist yet, so a folio whose verdicts are
    // still beside their blocks keeps its history instead of this sweep
    // bootstrapping an empty report over it on first run.
    const qaPath = blockQaPath(contentRepoRoot, block.root);
    // The ATTESTATION half never comes from the prior report: it comes from the
    // store (`qa-attestations.ts`, bean `8wj1`). With the prior absent, this
    // used to write a report holding only script entries and drop every agent
    // and human verdict without a word (C11). A store that cannot be read
    // means this block is not written at all, and the run says UNKNOWN.
    const prior = loadPriorBlockReport(contentRepoRoot, block.root, priorFrom);
    if (!prior.ok) {
      console.error(priorRefusalLine("qa-sweep", relative(contentRepoRoot, block.root), prior));
      priorRefusals++;
      continue;
    }
    const attested = resolvePrior(contentRepoRoot, blockAttestationKey(contentRepoRoot, block.root), prior.report);
    if (!attested.ok) {
      console.error(refusalLine("qa-sweep", relative(contentRepoRoot, block.root), attested));
      attestationRefusals++;
      continue;
    }
    const existingReport = attested.prior;
    const newPaths = {
      ts: relative(contentRepoRoot, block.ts),
      md: block.md ? relative(contentRepoRoot, block.md) : undefined,
      lean: block.lean ? relative(contentRepoRoot, block.lean) : undefined,
    };
    const report: BlockQaReport = existingReport ?? {
      $schema: "block-qa/v1",
      label: block.label,
      kind: block.kind,
      paths: newPaths,
      source_hashes: currentHashes,
      criteria: composeCriteria({}, attested.attestations),
    };

    // Detect whether metadata drifted — moved files, renamed blocks,
    // or refreshed hashes (chapter relocation triggers all three).
    // Any drift forces a save even when every criterion is fresh.
    const metadataDrifted =
      !existingReport ||
      existingReport.label !== block.label ||
      existingReport.kind !== block.kind ||
      JSON.stringify(existingReport.paths) !== JSON.stringify(newPaths) ||
      JSON.stringify(existingReport.source_hashes) !==
        JSON.stringify(currentHashes);

    // Refresh top-level metadata (paths / hashes may have shifted).
    report.label = block.label;
    report.kind = block.kind;
    report.paths = newPaths;
    report.source_hashes = currentHashes;

    // Did any criterion's VERDICT actually move this run? Re-running a checker
    // is not by itself a change: a criterion that re-evaluates to exactly what
    // the sidecar already records must keep its existing entry, timestamps and
    // all. Without this, the `staleNa` re-check below (which deliberately
    // re-evaluates every applicable `n/a` on every sweep) restamps
    // `reviewed_at` forever, so every sidecar's `updated_at` moved on every
    // sweep and feature branches carried the churn regardless of the
    // per-criterion `script_hash` fix.
    let verdictChanged = false;

    const sweepResult: BlockSweepResult = {
      label: block.label,
      kind: block.kind,
      md: block.md ? relative(process.cwd(), block.md) : undefined,
      ts: relative(process.cwd(), block.ts),
      lean: block.lean ? relative(process.cwd(), block.lean) : undefined,
      qa_path: relative(process.cwd(), qaPath),
      criteria_run: 0,
      criteria_skipped_fresh: 0,
      criteria_needs_agent: 0,
      fail_critical: 0,
      fail_major: 0,
      fail_minor: 0,
      details: [],
    };

    for (const criterionId of criteriaToRun) {
      const def = criteriaById[criterionId];
      if (!def) continue;

      // Applicability gate.
      if (def.applies_to && !def.applies_to.includes(block.kind)) {
        continue;
      }

      // Skip if a fresh entry already exists. An `n/a` entry whose
      // depends_on files are now all present (i.e. the criterion is
      // newly applicable — typically because `depends_on` was
      // relaxed in the registry) must NOT short-circuit the sweep;
      // it has to be re-evaluated against the actual checker.
      // Graph-scoped criteria (the detangler axis) compare an extra `graph`
      // key so that a `uses[]` edit ANYWHERE in the chapter invalidates them.
      // Only their entries carry it — adding it unconditionally would grow
      // every field_hash on every block for no signal.
      const graphScoped = freshnessKeys(def).includes("graph");
      const fieldHash = graphScoped
        ? { ...currentHashes, graph: graphHash }
        : currentHashes;
      const existing = report.criteria[criterionId] ?? [];
      // A script re-run is a REFRESH, not a new opinion: it must REPLACE the
      // prior script entry rather than append. Only agent-kind reviewers
      // append (their multi-reviewer audit trail is meaningful); human
      // adjudications are always kept. Dropping stale script entries here
      // keeps sidecars from growing unboundedly on every sweep. NOTE: the
      // freshness gate below still scans the FULL `existing` array (including
      // the old script entry) so an unchanged block still short-circuits as
      // `fresh-skip`.
      const nonScriptExisting = preserveNonScriptEntries(existing);
      const scriptHashes = scriptHashesByCriterion[criterionId];
      const freshExisting = existing.find((e) =>
        entryIsFresh(e, fieldHash, freshnessKeys(def), scriptHashes, def.lean_granularity),
      );
      const dependsOnSatisfied = def.depends_on.every(
        (k) => currentHashes[k] !== undefined,
      );
      const staleNa =
        freshExisting?.result === "n/a" && dependsOnSatisfied;
      if (freshExisting && !staleNa) {
        sweepResult.criteria_skipped_fresh++;
        sweepResult.details.push({
          criterion: criterionId,
          outcome: "fresh-skip",
        });
        continue;
      }

      // Reviewer-identity block shared by every script-kind entry
      // written below. `id` points at the source file containing
      // the checker function (NOT the dispatcher) so the recorded
      // `script_hash` aligns with the file qa-sweep just hashed.
      const scriptReviewer = {
        kind: "script" as const,
        id: scriptHashes?.source_file ?? "pipeline/qa-sweep.ts",
        // WHO it acted as, which is a different question from WHAT ran and is
        // the one `qa-reporting` is checked against — see `sweepActor`.
        actor: sweepActor(),
        version: "v1",
        script_hash: scriptHashes?.script_hash || undefined,
        script_commit_sha:
          scriptHashes?.script_commit_sha || undefined,
        deps_hash: scriptHashes?.deps_hash,
        def_hash: scriptHashes?.def_hash,
      };

      // Adapter gate, ahead of the companion gate. A criterion written for
      // the paper adapter must not run against a WHO L2/L3 block: a
      // `voice-scholarly-default` verdict on a FHIR ValueSet is a category
      // error, and it would land as a `fail` rather than as an obviously
      // wrong `n/a`. Criteria default to `["paper"]` (see `criterionAdapters`)
      // so the ~47 existing definitions stay correct unedited.
      //
      // Built-in kinds first, then the registry: a contributed kind (a `dak`
      // one) belongs to the adapter its contributor named.
      const blockAdapter = composedKindOwner(block.kind, contributions, adapterForKind);
      const criterionScope = criterionAdapters(def);
      if (!blockAdapter || !criterionScope.includes(blockAdapter)) {
        const naEntry: QaCriterionEntry = {
          field_hash: fieldHash,
          result: "n/a",
          reviewer: { ...scriptReviewer },
          reviewed_tree: headTree,
          notes: blockAdapter
            ? `criterion applies to ${criterionScope.join("/")}; block kind "${block.kind}" is ${blockAdapter}`
            : `unknown block kind "${block.kind}" — no adapter`,
        };
        const priorNa = existing.find((e) => e?.reviewer?.kind === "script");
        report.criteria[criterionId] = [
          ...nonScriptExisting,
          sameScriptVerdict(priorNa, naEntry)
            ? priorNa!
            : ((verdictChanged = true), naEntry),
        ];
        sweepResult.details.push({
          criterion: criterionId,
          outcome: "n/a-wrong-adapter",
        });
        continue;
      }

      // Profile gate, BESIDE the adapter gate rather than instead of it. The
      // two answer different questions and both have to be asked: the adapter
      // asks whose vocabulary the block's kind is from, the profile asks
      // which restriction of that vocabulary this folio declared. A document
      // folio's `prose` block is a paper-adapter kind — `adapterForKind` is
      // total and unambiguous on all of them — so the adapter gate passes it
      // through, and without this second gate it inherited every LaTeX- and
      // Lean-shaped criterion in the registry. Measured on
      // `docs/source/crdm-methodology` (2026-09-18): 5 of 8 failures were
      // `voice-unicode-crash` firing on characters whose only stated defect
      // is that they crash pdflatex, in a folio whose render path takes no
      // TeX at all.
      //
      // Criteria default to EVERY profile (see `criterionProfiles`), so the
      // gate only fires for the handful that opt out by naming `profiles`.
      //
      // "Could not determine" is a third state and it falls through to
      // RUNNING the criterion. A folio with no `harness.config.json`, or one
      // whose config will not parse, must not quietly lose QA coverage on the
      // strength of a guess: `profileForContentType` resolves the unknown
      // case to `paper` for a validator, but here the answer to an unreadable
      // config is "check everything and let the findings be visible", not
      // "skip whatever the guess excludes".
      const folioProfile = declaredProfile.profile;
      const profileScope = criterionProfiles(def);
      if (profileExcludesCriterion(def, folioProfile)) {
        const naEntry: QaCriterionEntry = {
          field_hash: fieldHash,
          result: "n/a",
          reviewer: { ...scriptReviewer },
          reviewed_tree: headTree,
          // `folioProfile` is necessarily defined here: the undetermined
          // case returns `false` from `profileExcludesCriterion`.
          notes:
            `criterion applies to the ${profileScope.join("/")} profile; ` +
            `this folio is ${folioProfile!} (${declaredProfile.declaredBy})`,
        };
        const priorNa = existing.find((e) => e?.reviewer?.kind === "script");
        report.criteria[criterionId] = [
          ...nonScriptExisting,
          sameScriptVerdict(priorNa, naEntry)
            ? priorNa!
            : ((verdictChanged = true), naEntry),
        ];
        sweepResult.details.push({
          criterion: criterionId,
          outcome: "n/a-wrong-profile",
        });
        continue;
      }


      // Applicability gate, over whichever companion roles the criterion
      // declares. This was two hard-coded `if`s for `.md` and `.lean` — the
      // paper adapter's companion set — so a criterion depending on a `.dmn`
      // or `.fsh` had no gate at all, and every WHO L2/L3 block fell through
      // the `.md` branch to a clean `n/a` for an axis that never ran. A
      // criterion that reports `n/a` on a corpus it did not check is
      // indistinguishable downstream from one that found nothing wrong.
      const missingRole = applicabilityGap(def.depends_on, block.companions);
      if (missingRole) {
        const naEntry: QaCriterionEntry = {
          field_hash: fieldHash,
          result: "n/a",
          reviewer: { ...scriptReviewer },
          reviewed_tree: headTree,
          notes: missingCompanionNote(missingRole),
        };
        const priorNa = existing.find((e) => e?.reviewer?.kind === "script");
        report.criteria[criterionId] = [
          ...nonScriptExisting,
          sameScriptVerdict(priorNa, naEntry)
            ? priorNa!
            : ((verdictChanged = true), naEntry),
        ];
        sweepResult.details.push({
          criterion: criterionId,
          outcome: `n/a-no-${missingRole}`,
        });
        continue;
      }

      // Non-automated or un-implemented criteria mark as needing agent.
      // Placed AFTER the adapter, profile, and companion gates (folio-assistant-nba0):
      // an unapplicable criterion is n/a, never queued as a phantom agent task.
      const checker = checkers.get(criterionId);
      if (!def.automated || !checker) {
        sweepResult.criteria_needs_agent++;
        totalNeedsAgent++;
        sweepResult.details.push({
          criterion: criterionId,
          outcome: "needs-agent",
        });
        continue;
      }

      // Run the automated checker.
      sweepResult.criteria_run++;
      const checkRes = checker(paths);
      const entry: QaCriterionEntry = {
        field_hash: fieldHash,
        result: checkRes.result,
        reviewer: { ...scriptReviewer },
        reviewed_tree: headTree,
      };
      // Surface checker-supplied context (e.g. a cache-staleness reason
      // from `proof-lean-compiles`) so the sidecar records WHY a result
      // is what it is, not just the verdict.
      if (checkRes.notes) entry.notes = checkRes.notes;
      // Persist any structured heuristic measures the checker emits
      // (e.g. the detangler graph metrics) so the sidecar carries the
      // numeric snapshot, not just the pass/fail verdict. Recorded for
      // every result kind (pass/warn/fail), since the measure is useful
      // even when the block is within band.
      if (checkRes.metrics && Object.keys(checkRes.metrics).length > 0)
        entry.metrics = checkRes.metrics;
      if (checkRes.result === "fail") {
        entry.severity = def.default_severity;
        entry.evidence = checkRes.hits
          .slice(0, 5)
          .map((h) => `${relative(process.cwd(), h.file)}:${h.line}: ${h.text}`)
          .join(" | ");
        if (def.default_severity === "critical") {
          sweepResult.fail_critical++;
          totalCritical++;
        } else if (def.default_severity === "major") {
          sweepResult.fail_major++;
          totalMajor++;
        } else {
          sweepResult.fail_minor++;
          totalMinor++;
        }
      }

      // Write the fresh script entry, REPLACING the prior script entry
      // (agent + human entries are preserved via `nonScriptExisting`). When
      // the re-run reproduces what the sidecar already records, keep the
      // existing entry verbatim so its timestamps survive — a re-run is not a
      // change.
      const priorScript = existing.find((e) => e?.reviewer?.kind === "script");
      const settled = sameScriptVerdict(priorScript, entry)
        ? priorScript!
        : ((verdictChanged = true), entry);
      report.criteria[criterionId] = [...nonScriptExisting, settled];

      sweepResult.details.push({
        criterion: criterionId,
        outcome: checkRes.result,
        severity: entry.severity,
        hits: checkRes.hits.length,
        first_hit: checkRes.hits[0]
          ? `${relative(process.cwd(), checkRes.hits[0].file)}:${
              checkRes.hits[0].line
            }`
          : undefined,
      });
    }

    // Save when any of the following changed since the loaded sidecar:
    //   - a criterion's verdict (or its inputs / checker identity) moved
    //   - sidecar metadata drifted (file moved, kind/label changed,
    //     source-file content hash changed)
    //
    // Note this is NOT `criteria_run > 0`. Running a checker and reproducing
    // the recorded verdict leaves the sidecar semantically identical, and
    // saving it anyway rewrote `updated_at` on every block on every sweep —
    // which is what made an otherwise no-op sweep dirty the whole corpus.
    const wroteSomething = verdictChanged || metadataDrifted;
    // Only advance the file's own timestamp when its content actually moved,
    // for the same reason.
    // No clock in the sidecar (owner ruling 2026-11-06, "QA dates"): its date
    // is derived from its entries' `reviewed_tree`. A legacy `updated_at`
    // would now go stale, so a rewrite drops it.
    if (wroteSomething) delete report.updated_at;
    if (wroteSomething) {
      try {
        report.criteria = finalizeCriteria(attested, report.criteria, "script", { dryRun: args.dryRun });
      } catch (err) {
        console.error(refusalLine("qa-sweep", relative(contentRepoRoot, block.root), {
          state: "unknown",
          path: attested.path,
          reason: err instanceof Error ? err.message : String(err),
        }));
        attestationRefusals++;
        continue;
      }
    }
    if (!args.dryRun && wroteSomething) {
      saveQaReport(qaPath, report);
    }
    results.push(sweepResult);
  }

  // Write one script sidecar per automated criterion under sweep
  // to `pipeline/script-sidecars/<criterion-id>.script.json`.
  // Skipped under --dry-run.
  const sidecarTarget = scriptSidecarTarget(args.scriptSidecarRoot, INSTANCE_ROOT);
  if (!args.dryRun && sidecarTarget === null) {
    console.log(`script sidecars: not written — ${INSTANCE_ROOT} is a mounted copy of the platform, not its checkout (pass --script-sidecar-root to write them elsewhere)`);
  }
  if (!args.dryRun && sidecarTarget !== null) {
    for (const [id, hashes] of Object.entries(scriptHashesByCriterion)) {
      if (!hashes.script_hash) continue; // source file absent — skip
      // KEEP THE STORED PROVENANCE WHEN THIS CHECKOUT CANNOT ESTABLISH IT.
      //
      // `gitFileCommitSha` returns "unknown" rather than guessing in a
      // shallow clone, where `git log -1 -- <file>` reports the graft
      // boundary for anything untouched inside the fetched window. Writing
      // that through would replace a true commit with a confident wrong
      // one — measured 2026-09-18, a sweep in a 102-commit checkout
      // flattened 77 of 78 sidecars from nine distinct shas to the single
      // boundary sha. An older true answer beats a fresh false one.
      const sidecarRoot = sidecarTarget;
      const previous = loadQaScriptSidecar(id, sidecarRoot);
      const commitSha =
        hashes.script_commit_sha === GIT_SHA_UNKNOWN && previous?.script_commit_sha
          ? previous.script_commit_sha
          : hashes.script_commit_sha;
      const sidecar: QaScriptSidecar = {
        $schema: "qa-script/v1",
        criterion_id: id,
        source_file: hashes.source_file,
        script_hash: hashes.script_hash,
        script_commit_sha: commitSha,
        extra_inputs:
          hashes.extra_inputs.length > 0 ? hashes.extra_inputs : undefined,
        deps_hash: hashes.deps_hash,
        // The PLATFORM's HEAD, not `headSha`. This sidecar lives in and
        // describes folio-assistant's own checker scripts; `headSha` is the
        // CONTENT repo's HEAD (correct for a block's `reviewed_tree`, since
        // that verdict is about content at that commit). Stamping the
        // content SHA here recorded a foreign repo's commit as this repo's
        // "HEAD at last run".
        last_run_sha: gitHeadSha(INSTANCE_ROOT),
        engine_version: engineVersion,
      };
      saveQaScriptSidecar(sidecar, sidecarRoot);
    }
  }

  // ── Output ────────────────────────────────────────────────────

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          root: relative(process.cwd(), rootAbs),
          head: headSha,
          generated_at: nowIso,
          criteria: criteriaToRun,
          voice_skipped: voiceSkipped,
          active_voices: activeVoiceIds ?? null,
          totals: {
            blocks: totalBlocks,
            fail_critical: totalCritical,
            fail_major: totalMajor,
            fail_minor: totalMinor,
            needs_agent: totalNeedsAgent,
          },
          results,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`qa-sweep: ${relative(process.cwd(), rootAbs)}`);
    console.log(`         HEAD: ${headSha.slice(0, 12) || "(no git)"}`);
    console.log(
      `         criteria: ${criteriaToRun.length}, blocks: ${totalBlocks}`,
    );
    console.log(
      `         findings: ${totalCritical} critical, ${totalMajor} major, ${totalMinor} minor; needs-agent: ${totalNeedsAgent}`,
    );
    console.log("");

    // Discovery's two disagreements between the registry and the code, on
    // stderr so they never pollute a parsed run. Neither is a block finding
    // and neither may be folded into `needs-agent`: that bucket means "a
    // person must judge this", and these mean "the registry and the checker
    // files do not agree about what is automated".
    for (const u of discovery.unimplemented) {
      console.error(
        `  \u26a0 ${u.criterion} is declared automated but ${u.sourceFile} ${u.reason}`,
      );
    }
    for (const o of discovery.orphaned) {
      console.error(
        `  \u26a0 ${o.sourceFile} implements ${o.criterion}, which the registry declares automated: false \u2014 that checker never runs`,
      );
    }

    // Per-block summary, only show blocks with findings or needs-agent.
    for (const r of results) {
      if (
        r.fail_critical === 0 &&
        r.fail_major === 0 &&
        r.fail_minor === 0 &&
        r.criteria_needs_agent === 0
      ) {
        continue;
      }
      console.log(
        `  ${r.label}  (${r.kind})  → ${r.qa_path}`,
      );
      for (const d of r.details) {
        if (d.outcome === "fail") {
          console.log(
            `    [${d.severity}] ${d.criterion}: ${d.hits} hit(s)${
              d.first_hit ? `  first @ ${d.first_hit}` : ""
            }`,
          );
        } else if (d.outcome === "needs-agent") {
          console.log(`    [needs-agent] ${d.criterion}`);
        }
      }
    }
  }

  if (priorRefusals > 0) {
    console.error(`qa-sweep: UNKNOWN — ${priorRefusals} block(s) not written because their prior could not be read from qa-reports:${priorFrom}; see above`);
    process.exit(2);
  }
  if (attestationRefusals > 0) {
    console.error(
      `qa-sweep: UNKNOWN — ${attestationRefusals} block(s) not written because their attestations could not be read; see above`,
    );
    process.exit(4);
  }
  if (args.ci && totalCritical > 0) {
    process.exit(1);
  }
}

await run();
