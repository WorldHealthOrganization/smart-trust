/**
 * CLI driver for the script-QA pipeline.
 *
 * Walks every script under `SCRIPT_ROOTS` (currently
 * `folio-assistant/computations/*.py`), runs every automated
 * criterion in the `script-quality` domain, and writes one
 * `<basename>.script-qa.json` sidecar per audited script under the
 * `script-qa/` subdirectory of the script's parent dir.
 *
 * Usage:
 *
 *   bun run cat-harness-tools/pipeline/script-sweep.ts [--dry-run] [--json]
 *                                            [--only ID[,ID]]
 *                                            [--filter REGEX]
 *
 * `--only` restricts to the listed criterion ids (default: every
 * `domain: "script-quality"` criterion). `--filter REGEX` matches
 * against repo-relative script paths.
 *
 * @module pipeline/script-sweep
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

/**
 * The PLATFORM root (folio-assistant itself). Criterion sources such as
 * `pipeline/qa-checkers-python.ts` live here, and the sidecars record
 * them platform-relative (`source_file`), so criterion hashing must use this.
 */
const PLATFORM_ROOT = resolve(dirname(__filename), "..");

/**
 * The CONTENT repo root (qou, …). The audited scripts live here and the
 * sidecars record them content-relative (`script_path`), so walking must use
 * this.
 *
 * These were ONE constant, and that is the whole bug: the platform root was
 * being joined onto a content-relative `SCRIPT_ROOTS` entry, yielding a
 * doubled path that does not exist, so the walker yielded nothing and the
 * sweep exited 0 over an empty set.
 */
const CONTENT_ROOT = findContentRepoRoot();

import {
  QA_CRITERIA_BY_ID,
  SCRIPT_QUALITY_CRITERIA,
  getCriterionSourceFile,
  getCriterionExtraInputs,
} from "./qa-criteria-registry";
import {
  gitHeadSha,
  gitHeadTree,
  computeCriterionScriptHashes,
  entryIsFresh,
  freshnessKeys,
  saveQaScriptSidecar,
  type CriterionScriptHashes,
} from "./qa-utils";
import {
  walkScripts,
  SCRIPT_ROOTS,
  type ScriptTarget,
} from "./script-walker";
import { implementingRootFor } from "../schemas/kg/harness-config.ts";
import { findContentRepoRoot } from "./repo-root";
import {
  checkDoesNotDefaultToFloat,
  checkComputeNoMpfToFloatCast,
  checkRespectsArchimedeanWall,
  checkCodeIsCommented,
  checkVariablesTyped,
  checkHasReferencesToPaper,
  checkConnectedToCiPipeline,
  checkDeprecated,
  checkUsesLibraryFrameworkAppropriately,
  checkAssertionsAreFalsifiable,
} from "./qa-checkers-python";
import type { CheckerResult } from "./qa-checkers-voice";
import type {
  ScriptQaReport,
  ScriptLanguage,
} from "../schemas/sdlc/script-qa.ts";
import type {
  QaCriterionEntry,
  QaScriptSidecar,
} from "../schemas/sdlc/block-qa.ts";

// ─── Dispatch ──────────────────────────────────────────────────

/**
 * Dispatch from criterion id + script target to a `CheckerResult`.
 * Each criterion knows which languages it supports; out-of-band
 * combinations return `n/a`.
 */
/**
 * Dispatcher signature. The optional second argument is the
 * (partially-) loaded sidecar report — checkers that consume
 * structured metadata (currently `has_references_to_paper`,
 * which reads `references: string[]`) read from this; others
 * ignore it.
 */
type ScriptCheckerFn = (
  target: ScriptTarget,
  sidecar: ScriptQaReport | undefined,
) => CheckerResult;

const SCRIPT_CHECKERS: Record<string, ScriptCheckerFn> = {
  does_not_default_to_float: (t) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    return checkDoesNotDefaultToFloat(t.abs);
  },
  compute_no_mpf_to_float_cast: (t) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    return checkComputeNoMpfToFloatCast(t.abs);
  },
  respects_archimedean_wall: (t) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    return checkRespectsArchimedeanWall(t.abs);
  },
  code_is_commented: (t) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    return checkCodeIsCommented(t.abs);
  },
  variables_typed: (t) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    return checkVariablesTyped(t.abs);
  },
  has_references_to_paper: (t, sidecar) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    // Pass the sidecar's structured `references` array to the checker.
    // It reads that field and NOTHING else: any defined array (including
    // an empty one, a deliberate "no refs intended") passes; `undefined`
    // fails. There is no source-side grep fallback — this comment used to
    // describe one, left over from before the metadata-only contract.
    return checkHasReferencesToPaper(t.abs, sidecar?.references);
  },
  connected_to_ci_pipeline: (t) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    return checkConnectedToCiPipeline(t.abs, CONTENT_ROOT);
  },
  deprecated: (t) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    return checkDeprecated(t.abs);
  },
  uses_library_framework_appropriately: (t) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    return checkUsesLibraryFrameworkAppropriately(t.abs);
  },
  assertions_are_falsifiable: (t) => {
    if (t.language !== "python") return { result: "n/a", hits: [] };
    return checkAssertionsAreFalsifiable(t.abs);
  },
};

// ─── CLI ───────────────────────────────────────────────────────

interface Args {
  dryRun: boolean;
  json: boolean;
  only?: string[];
  filter?: RegExp;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { dryRun: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--json") out.json = true;
    else if (a === "--only") {
      out.only = (argv[++i] ?? "").split(",").filter(Boolean);
    } else if (a === "--filter") {
      const pat = argv[++i] ?? "";
      try {
        out.filter = new RegExp(pat);
      } catch (e) {
        // Surface a clean error rather than a raw stack trace —
        // `--filter` is user-facing CLI input and an invalid
        // pattern should not crash the sweep with low-context
        // noise.
        console.error(
          `script-sweep: --filter pattern is not a valid regex: ` +
            `${pat ? `"${pat}"` : "(empty)"} — ` +
            (e instanceof Error ? e.message : String(e)),
        );
        process.exit(1);
      }
    }
  }
  return out;
}

// ─── Sweep ─────────────────────────────────────────────────────

interface ScriptSweepResult {
  script_path: string;
  language: ScriptLanguage;
  criteria_run: number;
  criteria_skipped_fresh: number;
  fail_critical: number;
  fail_major: number;
  fail_minor: number;
  first_hit?: string;
}

function loadScriptQa(path: string): ScriptQaReport | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    // Schema guard — refuse to treat unrelated JSON (or a future
    // schema version) as a v1 ScriptQaReport. Mirrors `loadQaReport`
    // in `qa-utils.ts`.
    if (parsed?.$schema !== "script-qa/v1") return undefined;
    return parsed as ScriptQaReport;
  } catch {
    return undefined;
  }
}

function saveScriptQa(path: string, report: ScriptQaReport): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  // The run's own time: in this run's summary (`generated_at`) only, never a sidecar.
  const nowIso = new Date().toISOString();
  const headSha = gitHeadSha();
  // What a verdict records as `reviewed_tree`: the tree outlives a PR run's
  // synthetic merge commit (bean 69lr; owner card Q4, 2026-11-05).
  const headTree = gitHeadTree();

  // Resolve criteria under sweep — default to every script-quality
  // criterion that has a registered checker.
  const requestedIds = args.only ?? SCRIPT_QUALITY_CRITERIA;
  const runnableIds = requestedIds.filter(
    (id) => QA_CRITERIA_BY_ID[id]?.automated && SCRIPT_CHECKERS[id],
  );

  // Precompute the script-hash bundle per criterion (mirrors
  // qa-sweep tranche-1 plumbing).
  const scriptHashesByCriterion: Record<string, CriterionScriptHashes> = {};
  // Read each checker from the layer that implements it (ruling T7, bean
  // `70lx`); the recorded `source_file` is the declared path either way.
  for (const id of runnableIds) {
    scriptHashesByCriterion[id] = computeCriterionScriptHashes(
      id,
      getCriterionSourceFile(id),
      getCriterionExtraInputs(id),
      implementingRootFor(PLATFORM_ROOT, getCriterionSourceFile(id)),
      QA_CRITERIA_BY_ID[id],
    );
  }
  const engineVersion = `bun-${Bun.version}`;

  const results: ScriptSweepResult[] = [];
  let totalScripts = 0;
  let totalCritical = 0;
  let totalMajor = 0;
  let totalMinor = 0;

  for (const target of walkScripts(CONTENT_ROOT)) {
    if (args.filter && !args.filter.test(target.rel)) continue;
    totalScripts++;

    const existing = loadScriptQa(target.sidecar_abs);
    const report: ScriptQaReport = existing ?? {
      $schema: "script-qa/v1",
      script_path: target.rel,
      language: target.language,
      source_hash: target.source_hash,
      criteria: {},
    };
    const metadataDrifted =
      !!existing &&
      (existing.script_path !== target.rel ||
        existing.language !== target.language ||
        existing.source_hash !== target.source_hash);
    report.script_path = target.rel;
    report.language = target.language;

    // The `references` field is human-authored metadata only —
    // never auto-extracted from script source. The sweep neither
    // reads script comments / docstrings to populate this field
    // nor modifies a value a human has set. Per author direction
    // (2026-05-24): "needs to be only proper metadata like
    // `references: []` for a script sidecar".
    report.source_hash = target.source_hash;

    // Per-target field hash. `"ts"` is the QaFieldHash convention
    // for the primary source file across every QA axis; in the
    // script-quality axis it carries the audited script's content
    // hash regardless of extension (`.py`, `.rs`, …).
    const currentHashes = { ts: target.source_hash };

    const sweepRow: ScriptSweepResult = {
      script_path: target.rel,
      language: target.language,
      criteria_run: 0,
      criteria_skipped_fresh: 0,
      fail_critical: 0,
      fail_major: 0,
      fail_minor: 0,
    };

    let anyChange = false;
    for (const cid of runnableIds) {
      const def = QA_CRITERIA_BY_ID[cid];
      const checker = SCRIPT_CHECKERS[cid];
      if (!def || !checker) continue;

      // Freshness short-circuit (mirrors qa-sweep.ts:266-282). Skip
      // the checker entirely when a prior entry's `field_hash` +
      // checker `script_hash` still match — prevents unbounded
      // sidecar growth and constant git churn on `updated_at`.
      const sh = scriptHashesByCriterion[cid];
      const prevEntries = report.criteria[cid] ?? [];
      const freshExisting = prevEntries.find((e) =>
        entryIsFresh(e, currentHashes, freshnessKeys(def), sh, def.lean_granularity),
      );
      if (freshExisting) {
        sweepRow.criteria_skipped_fresh++;
        continue;
      }

      const checkRes = checker(target, report);
      const entry: QaCriterionEntry = {
        field_hash: currentHashes,
        result: checkRes.result,
        reviewer: {
          kind: "script",
          id: sh?.source_file ?? "pipeline/script-sweep.ts",
          version: "v1",
          script_hash: sh?.script_hash || undefined,
          script_commit_sha: sh?.script_commit_sha || undefined,
          deps_hash: sh?.deps_hash,
        },
        reviewed_tree: headTree,
      };
      if (checkRes.result === "fail") {
        entry.severity = def.default_severity;
        entry.evidence = checkRes.hits
          .slice(0, 5)
          .map((h) => `${relative(CONTENT_ROOT, h.file)}:${h.line}: ${h.text}`)
          .join(" | ");
        if (def.default_severity === "critical") {
          sweepRow.fail_critical++;
          totalCritical++;
        } else if (def.default_severity === "major") {
          sweepRow.fail_major++;
          totalMajor++;
        } else {
          sweepRow.fail_minor++;
          totalMinor++;
        }
        sweepRow.first_hit ??= entry.evidence?.slice(0, 80);
      }
      report.criteria[cid] = [...prevEntries, entry];
      sweepRow.criteria_run++;
      anyChange = true;
    }

    const wroteSomething = anyChange || metadataDrifted || !existing;
    if (!args.dryRun && wroteSomething) {
      // No clock (owner rulings 2026-11-06, "QA dates" / "Date source"): the
      // date is derived on read from reviewed_tree; a stale legacy one goes.
      delete report.updated_at;
      saveScriptQa(target.sidecar_abs, report);
    }
    if (
      sweepRow.criteria_run > 0 ||
      sweepRow.criteria_skipped_fresh > 0
    ) {
      results.push(sweepRow);
    }
  }

  // Refresh per-criterion script sidecars (same convention as
  // qa-sweep) so consumers can ask "is this checker stale?" in one
  // lookup.
  if (!args.dryRun) {
    for (const [id, sh] of Object.entries(scriptHashesByCriterion)) {
      if (!sh.script_hash) continue;
      const sidecar: QaScriptSidecar = {
        $schema: "qa-script/v1",
        criterion_id: id,
        source_file: sh.source_file,
        script_hash: sh.script_hash,
        script_commit_sha: sh.script_commit_sha,
        extra_inputs:
          sh.extra_inputs.length > 0 ? sh.extra_inputs : undefined,
        deps_hash: sh.deps_hash,
        last_run_sha: headSha,
        engine_version: engineVersion,
      };
      saveQaScriptSidecar(sidecar, CONTENT_ROOT);
    }
  }

  if (totalScripts === 0) {
    // A sweep over nothing used to print "0 findings" and exit 0, which
    // reads exactly like a clean sweep of everything. It is not a result,
    // it is a misconfiguration, and it hid a broken root for months. Say so,
    // name the roots actually walked, and fail.
    console.error("");
    console.error("script-sweep: NO SCRIPTS WERE AUDITED — this is a");
    console.error("  misconfiguration, not a clean result. The roots below");
    console.error("  are joined onto the CONTENT repo root; check that you");
    console.error("  are running from the content repo and that they exist.");
    console.error(`    content root : ${CONTENT_ROOT}`);
    console.error(`    platform root: ${PLATFORM_ROOT}`);
    for (const r of SCRIPT_ROOTS) {
      const abs = resolve(CONTENT_ROOT, r.dir);
      console.error(
        `    root         : ${r.dir} -> ${abs}` +
          `  [${existsSync(abs) ? "exists" : "MISSING"}]`,
      );
    }
    if (args.filter) {
      console.error(
        `  NOTE: --filter ${args.filter} was set; a filter matching nothing`,
      );
      console.error("        also lands here, and is not a misconfiguration.");
    }
    process.exitCode = 1;
  }
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          generated_at: nowIso,
          head: headSha,
          totals: {
            scripts: totalScripts,
            fail_critical: totalCritical,
            fail_major: totalMajor,
            fail_minor: totalMinor,
          },
          results,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`script-sweep: ${totalScripts} script(s) audited`);
    console.log(`           HEAD: ${headSha.slice(0, 12) || "(no git)"}`);
    console.log(`           criteria: ${runnableIds.join(", ")}`);
    console.log(
      `           findings: ${totalCritical} critical, ${totalMajor} major, ${totalMinor} minor`,
    );
    if (results.length > 0) {
      console.log("");
      // Show top 15 failing scripts only, to keep output scannable.
      const failing = results.filter(
        (r) => r.fail_critical + r.fail_major + r.fail_minor > 0,
      );
      console.log(`           ${failing.length} script(s) with findings:`);
      for (const r of failing.slice(0, 15)) {
        const totalFails =
          r.fail_critical + r.fail_major + r.fail_minor;
        console.log(`             ${r.script_path}  (${totalFails} hit${totalFails > 1 ? "s" : ""})`);
      }
      if (failing.length > 15) {
        console.log(`             … ${failing.length - 15} more`);
      }
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
