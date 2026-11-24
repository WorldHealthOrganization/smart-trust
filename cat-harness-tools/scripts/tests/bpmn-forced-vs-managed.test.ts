import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ownDirectoryById } from "../../schemas/kg/cat-harness.ts";
import {
  basisOverlap,
  hashesReproduce,
  TEST_RUN_SCHEMA_ID,
  TestRunSchema,
  UNKNOWN_HASH,
} from "../../schemas/sdlc/test-run.ts";
import {
  evaluateForcedVsManaged,
  HARNESS_ROOT,
  TOOLS_ROOT,
  writeForcedVsManagedOutputs,
} from "../eval-bpmn-forced-vs-managed.ts";

describe("bean 502c — forced along a BPMN vs managing it (two-arm experiment)", () => {
  test("both arms run the same diagram on the same task bank as folio-test-run/v1 with identical data hash and differing process hash", async () => {
    const result = await evaluateForcedVsManaged();

    expect(result.diagramId).toBe("Process_TestPlanExecution");
    expect(result.bankId).toBe("bpmn-forced-vs-managed-v1");

    const parsedForced = TestRunSchema.parse(result.forcedRun);
    const parsedManaged = TestRunSchema.parse(result.selfManagedRun);

    expect(parsedForced.$schema).toBe(TEST_RUN_SCHEMA_ID);
    expect(parsedManaged.$schema).toBe(TEST_RUN_SCHEMA_ID);

    // Criterion 1: data hashes identical (and known), process hashes differing (and known)
    expect(parsedForced.data.hash).not.toBe(UNKNOWN_HASH);
    expect(parsedManaged.data.hash).not.toBe(UNKNOWN_HASH);
    expect(parsedForced.data.hash).toBe(parsedManaged.data.hash);
    expect(parsedForced.data.inputs).toEqual(parsedManaged.data.inputs);

    expect(parsedForced.process.hash).not.toBe(UNKNOWN_HASH);
    expect(parsedManaged.process.hash).not.toBe(UNKNOWN_HASH);
    expect(parsedForced.process.hash).not.toBe(parsedManaged.process.hash);

    expect(basisOverlap(parsedForced.data, parsedForced.process)).toEqual([]);
    expect(basisOverlap(parsedManaged.data, parsedManaged.process)).toEqual([]);

    expect(hashesReproduce(parsedForced, parsedManaged)).toEqual({
      data: true,
      process: false,
      both: false,
    });
  });

  test("records wall-clock time and token compute cost per arm and per case alongside outcomes", async () => {
    const result = await evaluateForcedVsManaged();

    for (const summary of [result.forcedSummary, result.selfManagedSummary]) {
      expect(summary.totalCases).toBe(10);
      expect(summary.disciplinedCases).toBe(5);
      expect(summary.temptationCases).toBe(5);
      expect(summary.totalWallTimeMs).toBeGreaterThan(0);
      expect(summary.meanCaseWallTimeMs).toBeGreaterThan(0);
      expect(summary.totalPromptTokens).toBeGreaterThan(0);
      expect(summary.totalCompletionTokens).toBeGreaterThan(0);
      expect(summary.totalTokens).toBe(summary.totalPromptTokens + summary.totalCompletionTokens);
      expect(summary.totalTurns).toBeGreaterThan(0);
      expect(summary.meanPromptTokensPerTurn).toBeGreaterThan(0);
    }

    // Per-turn prompt payload in self-managed (whole diagram + child diagram + all lanes/roles)
    // is substantially larger than in forced (single enabled step + scoped TaskContext).
    expect(result.selfManagedSummary.meanPromptTokensPerTurn).toBeGreaterThan(
      result.forcedSummary.meanPromptTokensPerTurn * 10,
    );

    // Every case record in both folio-test-run/v1 files carries time and token cost in output.
    for (const run of [result.forcedRun, result.selfManagedRun]) {
      expect(run.cases).toHaveLength(10);
      for (const c of run.cases ?? []) {
        const detail = c.output as Record<string, unknown>;
        expect(typeof detail.wallTimeMs).toBe("number");
        expect(typeof detail.promptTokens).toBe("number");
        expect(typeof detail.completionTokens).toBe("number");
        expect(typeof detail.totalTokens).toBe("number");
        expect(typeof detail.totalTurns).toBe("number");
        expect((detail.totalTokens as number) > 0).toBe(true);
      }
    }
  });

  test("forced arm refuses shortcuts at extra turn cost while self-managed arm allows skipped steps, DMN overrides, subprocess bypass, and overlay leak", async () => {
    const result = await evaluateForcedVsManaged();

    // Arm 1 (forced): 100% path exactness and terminal match across all 10 cases,
    // paid for via engine refusal retries on the temptation cases.
    expect(result.forcedSummary.exactMatchRate).toBe(1);
    expect(result.forcedSummary.terminalMatchRate).toBe(1);
    expect(result.forcedSummary.temptationExactMatchRate).toBe(1);
    expect(result.forcedSummary.skippedMandatoryStepsTotal).toBe(0);
    expect(result.forcedSummary.invalidGatewayAssertionsTotal).toBe(0);
    expect(result.forcedSummary.subprocessBypassesTotal).toBe(0);
    expect(result.forcedSummary.contextOverlayLeaksTotal).toBe(0);
    expect(result.forcedSummary.totalRefusalRetries).toBeGreaterThan(0);

    // Arm 2 (self-managed): matches on disciplined cases, but on temptation cases
    // skips mandatory steps, overrides DMN gateways, bypasses Call_Sign, and leaks child overlay.
    expect(result.selfManagedSummary.exactMatchRate).toBeLessThan(result.forcedSummary.exactMatchRate);
    expect(result.selfManagedSummary.terminalMatchRate).toBeLessThan(
      result.forcedSummary.terminalMatchRate,
    );
    expect(result.selfManagedSummary.skippedMandatoryStepsTotal).toBeGreaterThan(0);
    expect(result.selfManagedSummary.invalidGatewayAssertionsTotal).toBeGreaterThan(0);
    expect(result.selfManagedSummary.subprocessBypassesTotal).toBe(1);
    expect(result.selfManagedSummary.contextOverlayLeaksTotal).toBeGreaterThan(0);
    expect(result.selfManagedSummary.totalRefusalRetries).toBe(0);
  });

  test("enforces benchmark output guard (wp49): allows scratch/build paths and refuses declared KG paths", async () => {
    const result = await evaluateForcedVsManaged();
    const tempDir = mkdtempSync(join(tmpdir(), "bpmn-forced-vs-managed-"));
    try {
      const written = writeForcedVsManagedOutputs(result, tempDir, TOOLS_ROOT);
      expect(existsSync(written.forcedPath)).toBe(true);
      expect(existsSync(written.selfManagedPath)).toBe(true);
      expect(existsSync(written.comparisonPath)).toBe(true);

      const loadedForced = TestRunSchema.parse(
        JSON.parse(readFileSync(written.forcedPath, "utf-8")),
      );
      const loadedManaged = TestRunSchema.parse(
        JSON.parse(readFileSync(written.selfManagedPath, "utf-8")),
      );
      expect(loadedForced.data.hash).toBe(loadedManaged.data.hash);
      expect(loadedForced.process.hash).not.toBe(loadedManaged.process.hash);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }

    // A graph directory inside HARNESS_ROOT: the guard judges paths relative to
    // the root it is given, and `beans` is declared at the checkout root, outside it.
    const processesDir = ownDirectoryById(HARNESS_ROOT, "processes", "processes");
    if (!processesDir) throw new Error("processes directory not declared");
    expect(() => writeForcedVsManagedOutputs(result, processesDir, HARNESS_ROOT)).toThrow(
      /resolves inside declared graph directory/,
    );
  });
});
