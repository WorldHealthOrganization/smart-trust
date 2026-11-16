#!/usr/bin/env bun
/**
 * Two-arm experiment runner:
 *   "EXPERIMENT: forced along a BPMN vs managing it — do outcomes change, at what compute?"
 *
 * Runs both arms on the same BPMN diagram (`test-plan-execution.bpmn` and its
 * called subprocess `qa-report-signing.bpmn`) over the same independent task bank
 * (`scripts/eval/bpmn-forced-vs-managed-bank.json`), and records each arm as a
 * `folio-test-run/v1` record (`schemas/sdlc/test-run.ts`):
 *
 * - **Identical `data` hash across arms**: `dataInputs` is the diagram, its
 *   called subprocess diagram, both DMN decision tables, `roles.json`, and the
 *   task bank file.
 * - **Differing `process` hash across arms**: `processInputs` is the arm's own
 *   runner (`src/workflow/arm-forced.ts` + `src/workflow/instance.ts` +
 *   `process-state.md` vs `src/workflow/arm-self-managed.ts` +
 *   `specification-compiled-agents.md`), disjoint from `dataInputs`.
 * - **Compute and outcome recorded per arm and per case**: wall-clock time
 *   (`wallTimeMs`), turn count (`totalTurns`, `refusalRetries`), prompt and
 *   completion token counts (`promptTokens`, `completionTokens`, `totalTokens`),
 *   path exactness (`exactMatchRate`), terminal state match (`terminalMatchRate`),
 *   skipped mandatory steps, invalid gateway assertions, subprocess bypasses,
 *   and context overlay leaks.
 *
 * **The agent here is simulated.** No model is called: each bank case's
 * `agentProposal.proposedSteps` is a hand-written script both arms replay, and
 * after a refusal the forced arm's runner submits the enabled node itself.
 * Token counts are `ceil(bytes / 4)` of the payloads the runner builds, and
 * wall time is the runner's own. The output exercises the harness and the
 * engine's refusals; it is not evidence about how a model behaves.
 *
 * Per `deployment-topologies.md` §2 and `benchmarking-mode`, benchmark outputs
 * default to `build/benchmarks/bpmn-forced-vs-managed/` and are guarded by
 * `assertBenchmarkOutputPath` so they never land in declared
 * knowledge-graph directories.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { directoryForGraph, ownDirectoryById } from "../schemas/kg/cat-harness.ts";
import { requireHarnessRoot } from "../schemas/harness-root.ts";
import { readRoleGraph } from "../schemas/process/role-graph.js";
import {
  buildTestRun,
  hashesReproduce,
  type TestCase,
  type TestRun,
} from "../schemas/sdlc/test-run.ts";
import { loadProcessModel } from "../src/workflow/process-model.js";
import {
  runForcedCase,
  summarizeForcedArm,
  type ArmCaseMetrics,
  type ArmSummaryMetrics,
  type BankCase,
} from "../src/workflow/arm-forced.js";
import {
  runSelfManagedCase,
  summarizeSelfManagedArm,
} from "../src/workflow/arm-self-managed.js";
import { assertBenchmarkOutputPath } from "./benchmark-guard.ts";
import { harnessRel } from "./lib/harness-layout.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const TOOLS_ROOT = resolve(SCRIPT_DIR, "..");
// The harness is found through harness-root.ts since bean `8lcl` moved its
// schemas here; resolving a schema module would now land in cat-harness-tools.
export const HARNESS_ROOT = requireHarnessRoot();

export const DEFAULT_BENCHMARK_OUT_DIR = join(
  TOOLS_ROOT,
  "build",
  "benchmarks",
  "bpmn-forced-vs-managed",
);

export interface TaskBankFile {
  $schema: string;
  bankId: string;
  diagram: string;
  subprocessDiagram: string;
  description: string;
  cases: BankCase[];
}

export interface ForcedVsManagedEvaluation {
  diagramId: string;
  bankId: string;
  forcedRun: TestRun;
  selfManagedRun: TestRun;
  forcedCases: ArmCaseMetrics[];
  selfManagedCases: ArmCaseMetrics[];
  forcedSummary: ArmSummaryMetrics;
  selfManagedSummary: ArmSummaryMetrics;
  reproducibility: {
    data: boolean;
    process: boolean;
    both: boolean;
  };
}

function toPosixRelative(fromRoot: string, absTarget: string): string {
  return relative(fromRoot, absTarget).replace(/\\/g, "/");
}

function toTestRunCase(metrics: ArmCaseMetrics): TestCase {
  const verdict =
    metrics.exactMatch && metrics.terminalMatch && metrics.contextOverlayLeaks === 0
      ? "pass"
      : "fail";
  const outputObj = {
    caseId: metrics.caseId,
    verdict,
    category: metrics.category,
    executedPath: metrics.executedPath,
    terminalNode: metrics.terminalNode,
    exactMatch: metrics.exactMatch,
    terminalMatch: metrics.terminalMatch,
    skippedMandatorySteps: metrics.skippedMandatorySteps,
    invalidGatewayAssertions: metrics.invalidGatewayAssertions,
    subprocessBypasses: metrics.subprocessBypasses,
    contextOverlayLeaks: metrics.contextOverlayLeaks,
    totalTurns: metrics.totalTurns,
    refusalRetries: metrics.refusalRetries,
    wallTimeMs: metrics.wallTimeMs,
    promptTokens: metrics.promptTokens,
    completionTokens: metrics.completionTokens,
    totalTokens: metrics.totalTokens,
    meanPromptTokensPerTurn: metrics.meanPromptTokensPerTurn,
  };
  return {
    input: { caseId: metrics.caseId, category: metrics.category },
    output: outputObj,
  };
}

/**
 * Run both arms (`forced` and `self-managed`) on `test-plan-execution.bpmn` and
 * the independent task bank `bpmn-forced-vs-managed-bank.json`, returning both
 * `folio-test-run/v1` records and comparative outcome + compute summaries.
 */
export async function evaluateForcedVsManaged(opts?: {
  now?: Date;
}): Promise<ForcedVsManagedEvaluation> {
  // The sdlc diagrams sit in the `sdlc` sub-graph (cat-harness#991 step 23.2); both graphs looked up by id,
  // since `processes` and `skills` now have more than one directory each.
  // declared-path-literal: the fallback only — the directory is read by its declared id `sdlc-processes`; the literal is the convention when the `sdlc` sub-graph is not declared, at the call site so the choice is visible.
  const processesDir = ownDirectoryById(HARNESS_ROOT, "sdlc-processes", harnessRel("sdlc/processes"));
  const scenariosDir = directoryForGraph(HARNESS_ROOT, "scenarios");
  const skillsDir = ownDirectoryById(HARNESS_ROOT, "skills", "skills");
  if (!processesDir || !scenariosDir || !skillsDir) {
    throw new Error(`Missing declared directories in ${HARNESS_ROOT}`);
  }

  const mainDiagramPath = join(processesDir, "test-plan-execution.bpmn");
  const childDiagramPath = join(processesDir, "qa-report-signing.bpmn");
  const certDmnPath = join(processesDir, "decisions", "test-certification.dmn");
  const signingDmnPath = join(processesDir, "decisions", "signing-route.dmn");
  const beanOpenPath = join(processesDir, "bean-open.bpmn");
  const beanClosePath = join(processesDir, "bean-close.bpmn");
  const rolesPath = join(scenariosDir, "roles.json");
  const bankPath = join(TOOLS_ROOT, "scripts", "eval", "bpmn-forced-vs-managed-bank.json");

  const forcedRunnerPath = join(TOOLS_ROOT, "src", "workflow", "arm-forced.ts");
  const instanceEnginePath = join(TOOLS_ROOT, "src", "workflow", "instance.ts");
  const forcedSkillPath = join(skillsDir, "process", "workflow", "process-state.md");

  const selfManagedRunnerPath = join(TOOLS_ROOT, "src", "workflow", "arm-self-managed.ts");
  const selfManagedSkillPath = join(
    skillsDir,
    "process",
    "workflow",
    "specification-compiled-agents.md",
  );

  const model = await loadProcessModel(mainDiagramPath);
  const roleGraph = readRoleGraph(scenariosDir);
  if (!roleGraph) {
    throw new Error(`Could not load role graph from ${scenariosDir}`);
  }
  const bank = JSON.parse(readFileSync(bankPath, "utf-8")) as TaskBankFile;

  const forcedCases = bank.cases.map((c) => runForcedCase(model, roleGraph, c));
  const selfManagedCases = bank.cases.map((c) => runSelfManagedCase(model, roleGraph, c));

  const forcedSummary = summarizeForcedArm(forcedCases);
  const selfManagedSummary = summarizeSelfManagedArm(selfManagedCases);

  // Shared data basis: identical across both arms (diagram + called diagrams + DMNs + roles + task bank)
  const dataInputs = [
    toPosixRelative(TOOLS_ROOT, mainDiagramPath),
    toPosixRelative(TOOLS_ROOT, childDiagramPath),
    toPosixRelative(TOOLS_ROOT, beanOpenPath),
    toPosixRelative(TOOLS_ROOT, beanClosePath),
    toPosixRelative(TOOLS_ROOT, certDmnPath),
    toPosixRelative(TOOLS_ROOT, signingDmnPath),
    toPosixRelative(TOOLS_ROOT, rolesPath),
    toPosixRelative(TOOLS_ROOT, bankPath),
  ];

  // Disjoint process bases: differ between Arm 1 (forced) and Arm 2 (self-managed)
  const forcedProcessInputs = [
    toPosixRelative(TOOLS_ROOT, forcedRunnerPath),
    toPosixRelative(TOOLS_ROOT, instanceEnginePath),
    toPosixRelative(TOOLS_ROOT, forcedSkillPath),
  ];

  const selfManagedProcessInputs = [
    toPosixRelative(TOOLS_ROOT, selfManagedRunnerPath),
    toPosixRelative(TOOLS_ROOT, selfManagedSkillPath),
  ];

  const forcedRun = buildTestRun({
    root: TOOLS_ROOT,
    skill: "process-state",
    subject: `${model.id}@${bank.bankId}#forced`,
    ...(opts?.now ? { now: opts.now } : {}),
    dataInputs,
    processInputs: forcedProcessInputs,
    outcome: {
      arm: forcedSummary.arm,
      totalCases: forcedSummary.totalCases,
      disciplinedCases: forcedSummary.disciplinedCases,
      temptationCases: forcedSummary.temptationCases,
      exactMatches: forcedSummary.exactMatches,
      exactMatchRate: forcedSummary.exactMatchRate,
      terminalMatches: forcedSummary.terminalMatches,
      terminalMatchRate: forcedSummary.terminalMatchRate,
      temptationExactMatchRate: forcedSummary.temptationExactMatchRate,
      skippedMandatoryStepsTotal: forcedSummary.skippedMandatoryStepsTotal,
      invalidGatewayAssertionsTotal: forcedSummary.invalidGatewayAssertionsTotal,
      subprocessBypassesTotal: forcedSummary.subprocessBypassesTotal,
      contextOverlayLeaksTotal: forcedSummary.contextOverlayLeaksTotal,
      totalTurns: forcedSummary.totalTurns,
      totalRefusalRetries: forcedSummary.totalRefusalRetries,
      totalWallTimeMs: forcedSummary.totalWallTimeMs,
      meanCaseWallTimeMs: forcedSummary.meanCaseWallTimeMs,
      totalPromptTokens: forcedSummary.totalPromptTokens,
      totalCompletionTokens: forcedSummary.totalCompletionTokens,
      totalTokens: forcedSummary.totalTokens,
      meanTokensPerCase: forcedSummary.meanTokensPerCase,
      meanPromptTokensPerTurn: forcedSummary.meanPromptTokensPerTurn,
    },
    cases: forcedCases.map(toTestRunCase),
  });

  const selfManagedRun = buildTestRun({
    root: TOOLS_ROOT,
    skill: "specification-compiled-agents",
    subject: `${model.id}@${bank.bankId}#self-managed`,
    ...(opts?.now ? { now: opts.now } : {}),
    dataInputs,
    processInputs: selfManagedProcessInputs,
    outcome: {
      arm: selfManagedSummary.arm,
      totalCases: selfManagedSummary.totalCases,
      disciplinedCases: selfManagedSummary.disciplinedCases,
      temptationCases: selfManagedSummary.temptationCases,
      exactMatches: selfManagedSummary.exactMatches,
      exactMatchRate: selfManagedSummary.exactMatchRate,
      terminalMatches: selfManagedSummary.terminalMatches,
      terminalMatchRate: selfManagedSummary.terminalMatchRate,
      temptationExactMatchRate: selfManagedSummary.temptationExactMatchRate,
      skippedMandatoryStepsTotal: selfManagedSummary.skippedMandatoryStepsTotal,
      invalidGatewayAssertionsTotal: selfManagedSummary.invalidGatewayAssertionsTotal,
      subprocessBypassesTotal: selfManagedSummary.subprocessBypassesTotal,
      contextOverlayLeaksTotal: selfManagedSummary.contextOverlayLeaksTotal,
      totalTurns: selfManagedSummary.totalTurns,
      totalRefusalRetries: selfManagedSummary.totalRefusalRetries,
      totalWallTimeMs: selfManagedSummary.totalWallTimeMs,
      meanCaseWallTimeMs: selfManagedSummary.meanCaseWallTimeMs,
      totalPromptTokens: selfManagedSummary.totalPromptTokens,
      totalCompletionTokens: selfManagedSummary.totalCompletionTokens,
      totalTokens: selfManagedSummary.totalTokens,
      meanTokensPerCase: selfManagedSummary.meanTokensPerCase,
      meanPromptTokensPerTurn: selfManagedSummary.meanPromptTokensPerTurn,
    },
    cases: selfManagedCases.map(toTestRunCase),
  });

  return {
    diagramId: model.id,
    bankId: bank.bankId,
    forcedRun,
    selfManagedRun,
    forcedCases,
    selfManagedCases,
    forcedSummary,
    selfManagedSummary,
    reproducibility: hashesReproduce(forcedRun, selfManagedRun),
  };
}

/**
 * Write the two `folio-test-run/v1` arm records and the comparative summary to
 * a benchmark output directory after verifying `assertBenchmarkOutputPath`
 * (bean `wp49`).
 */
export function writeForcedVsManagedOutputs(
  evaluation: ForcedVsManagedEvaluation,
  outDir: string = DEFAULT_BENCHMARK_OUT_DIR,
  repoRoot: string = TOOLS_ROOT,
): { forcedPath: string; selfManagedPath: string; comparisonPath: string } {
  const absOutDir = isAbsolute(outDir) ? outDir : resolve(repoRoot, outDir);
  assertBenchmarkOutputPath(absOutDir, repoRoot);

  const forcedPath = join(absOutDir, "forced.test-run.json");
  const selfManagedPath = join(absOutDir, "self-managed.test-run.json");
  const comparisonPath = join(absOutDir, "comparison.json");

  assertBenchmarkOutputPath(forcedPath, repoRoot);
  assertBenchmarkOutputPath(selfManagedPath, repoRoot);
  assertBenchmarkOutputPath(comparisonPath, repoRoot);

  mkdirSync(absOutDir, { recursive: true });
  writeFileSync(forcedPath, JSON.stringify(evaluation.forcedRun, null, 2) + "\n", "utf-8");
  writeFileSync(
    selfManagedPath,
    JSON.stringify(evaluation.selfManagedRun, null, 2) + "\n",
    "utf-8",
  );
  writeFileSync(
    comparisonPath,
    JSON.stringify(
      {
        diagramId: evaluation.diagramId,
        bankId: evaluation.bankId,
        dataHashForced: evaluation.forcedRun.data.hash,
        dataHashSelfManaged: evaluation.selfManagedRun.data.hash,
        processHashForced: evaluation.forcedRun.process.hash,
        processHashSelfManaged: evaluation.selfManagedRun.process.hash,
        reproducibility: evaluation.reproducibility,
        forced: evaluation.forcedSummary,
        selfManaged: evaluation.selfManagedSummary,
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );

  return { forcedPath, selfManagedPath, comparisonPath };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let outDir = DEFAULT_BENCHMARK_OUT_DIR;
  let writeFiles = false;
  let jsonOnly = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--out-dir" && args[i + 1]) {
      outDir = args[++i]!;
      writeFiles = true;
    } else if (arg === "--write") {
      writeFiles = true;
    } else if (arg === "--json") {
      jsonOnly = true;
    }
  }

  const evaluation = await evaluateForcedVsManaged();
  if (writeFiles) {
    writeForcedVsManagedOutputs(evaluation, outDir, TOOLS_ROOT);
  }

  if (jsonOnly) {
    console.log(
      JSON.stringify(
        {
          diagramId: evaluation.diagramId,
          bankId: evaluation.bankId,
          dataHashForced: evaluation.forcedRun.data.hash,
          dataHashSelfManaged: evaluation.selfManagedRun.data.hash,
          processHashForced: evaluation.forcedRun.process.hash,
          processHashSelfManaged: evaluation.selfManagedRun.process.hash,
          reproducibility: evaluation.reproducibility,
          forced: evaluation.forcedSummary,
          selfManaged: evaluation.selfManagedSummary,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`=== BPMN Forced vs Self-Managed Experiment (${evaluation.diagramId}) ===`);
    console.log(`Task bank:                ${evaluation.bankId} (${evaluation.forcedSummary.totalCases} cases)`);
    console.log(`Data hash (forced):       ${evaluation.forcedRun.data.hash}`);
    console.log(`Data hash (self-managed): ${evaluation.selfManagedRun.data.hash}`);
    console.log(`Process hash (forced):    ${evaluation.forcedRun.process.hash}`);
    console.log(`Process hash (managed):   ${evaluation.selfManagedRun.process.hash}`);
    console.log(
      `hashesReproduce:          data=${evaluation.reproducibility.data}, process=${evaluation.reproducibility.process}, both=${evaluation.reproducibility.both}`,
    );
    console.log("");
    console.log("Metric                          | Arm 1: forced | Arm 2: self-managed");
    console.log("--------------------------------|---------------|--------------------");
    console.log(
      `Exact path match rate           | ${(evaluation.forcedSummary.exactMatchRate * 100).toFixed(1).padStart(12)}% | ${(evaluation.selfManagedSummary.exactMatchRate * 100).toFixed(1).padStart(17)}%`,
    );
    console.log(
      `Terminal verdict match rate     | ${(evaluation.forcedSummary.terminalMatchRate * 100).toFixed(1).padStart(12)}% | ${(evaluation.selfManagedSummary.terminalMatchRate * 100).toFixed(1).padStart(17)}%`,
    );
    console.log(
      `Temptation exact match rate     | ${(evaluation.forcedSummary.temptationExactMatchRate * 100).toFixed(1).padStart(12)}% | ${(evaluation.selfManagedSummary.temptationExactMatchRate * 100).toFixed(1).padStart(17)}%`,
    );
    console.log(
      `Skipped mandatory steps         | ${String(evaluation.forcedSummary.skippedMandatoryStepsTotal).padStart(13)} | ${String(evaluation.selfManagedSummary.skippedMandatoryStepsTotal).padStart(18)}`,
    );
    console.log(
      `Invalid DMN gateway assertions  | ${String(evaluation.forcedSummary.invalidGatewayAssertionsTotal).padStart(13)} | ${String(evaluation.selfManagedSummary.invalidGatewayAssertionsTotal).padStart(18)}`,
    );
    console.log(
      `Subprocess bypasses (Call_Sign) | ${String(evaluation.forcedSummary.subprocessBypassesTotal).padStart(13)} | ${String(evaluation.selfManagedSummary.subprocessBypassesTotal).padStart(18)}`,
    );
    console.log(
      `Subprocess context leaks        | ${String(evaluation.forcedSummary.contextOverlayLeaksTotal).padStart(13)} | ${String(evaluation.selfManagedSummary.contextOverlayLeaksTotal).padStart(18)}`,
    );
    console.log(
      `Total turns                     | ${String(evaluation.forcedSummary.totalTurns).padStart(13)} | ${String(evaluation.selfManagedSummary.totalTurns).padStart(18)}`,
    );
    console.log(
      `Engine refusal retries          | ${String(evaluation.forcedSummary.totalRefusalRetries).padStart(13)} | ${String(evaluation.selfManagedSummary.totalRefusalRetries).padStart(18)}`,
    );
    console.log(
      `Total prompt tokens             | ${String(evaluation.forcedSummary.totalPromptTokens).padStart(13)} | ${String(evaluation.selfManagedSummary.totalPromptTokens).padStart(18)}`,
    );
    console.log(
      `Total completion tokens         | ${String(evaluation.forcedSummary.totalCompletionTokens).padStart(13)} | ${String(evaluation.selfManagedSummary.totalCompletionTokens).padStart(18)}`,
    );
    console.log(
      `Total tokens                    | ${String(evaluation.forcedSummary.totalTokens).padStart(13)} | ${String(evaluation.selfManagedSummary.totalTokens).padStart(18)}`,
    );
    console.log(
      `Mean prompt tokens / turn       | ${String(evaluation.forcedSummary.meanPromptTokensPerTurn).padStart(13)} | ${String(evaluation.selfManagedSummary.meanPromptTokensPerTurn).padStart(18)}`,
    );
    console.log(
      `Total wall time (ms)            | ${evaluation.forcedSummary.totalWallTimeMs.toFixed(2).padStart(13)} | ${evaluation.selfManagedSummary.totalWallTimeMs.toFixed(2).padStart(18)}`,
    );
  }
}
