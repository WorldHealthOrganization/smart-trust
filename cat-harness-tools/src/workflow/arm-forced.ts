/**
 * Arm 1 (`forced`) for bean `folio-assistant-502c`:
 *
 * The orchestrator walks the BPMN diagram via `startInstance`, `enabled`, and
 * `complete` (`src/workflow/instance.ts`), handing the agent ONLY the currently
 * enabled step(s) and their scoped `TaskContext` at each turn.
 *
 * - An out-of-order step proposal (e.g. jumping from `A_ExecuteCases` to
 *   `A_AssembleReport` without `A_ReExecuteSample`) is refused by `complete()`
 *   (`WorkflowError`), costing a refusal turn (`refusalRetries`) and re-prompting
 *   with the currently enabled step.
 * - A hand-supplied outcome on a DMN-backed gateway (`GW_ExitCriteria`,
 *   `Gateway_SigningRoute`) is refused by `complete()`, forcing evaluation of
 *   the DMN decision table over the case's recorded facts.
 * - Attempting to complete a call activity (`Call_Sign`) as a leaf step while
 *   its child subprocess (`Process_QaReportSigning`) is running is refused by
 *   `complete()`, forcing execution through the child's own steps and stripping
 *   the child `TaskContext` overlay automatically upon return.
 *
 * @module folio-assistant/workflow/arm-forced
 */

import type { RoleGraph } from "../../schemas/process/role-graph.js";
import type { ProcessModel } from "./process-model.js";
import {
  complete,
  enabled,
  startInstance,
  WorkflowError,
  type Enabled,
  type InstanceState,
} from "./instance.js";

export interface ProposedStep {
  node: string;
  useFacts?: boolean;
  outcome?: string;
}

export interface BankCase {
  id: string;
  category: "disciplined" | "temptation";
  description: string;
  subject: string;
  carriedBeans: string[];
  facts: {
    exitCriteria: Record<string, unknown>;
    signingRoute?: Record<string, unknown>;
    /**
     * The branch to take at each gateway that has no DMN table (the bean-open
     * and bean-close gateways): those are chosen, not computed, so the case
     * names the choice a correct agent makes.
     */
    gatewayOutcomes?: Record<string, string>;
  };
  expected: {
    canonicalPath: string[];
    terminalNode: string;
    exitOutcome: string;
    signingOutcome: string | null;
  };
  agentProposal: {
    retainSubprocessOverlayOnExit: boolean;
    proposedSteps: ProposedStep[];
  };
}

export interface ArmCaseMetrics {
  caseId: string;
  category: "disciplined" | "temptation";
  executedPath: string[];
  terminalNode: string;
  exactMatch: boolean;
  terminalMatch: boolean;
  skippedMandatorySteps: string[];
  invalidGatewayAssertions: string[];
  subprocessBypasses: string[];
  contextOverlayLeaks: number;
  totalTurns: number;
  refusalRetries: number;
  refusals: string[];
  wallTimeMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  meanPromptTokensPerTurn: number;
  postSubprocessSkills: string[];
}

export interface ArmSummaryMetrics {
  arm: "forced" | "self-managed";
  totalCases: number;
  disciplinedCases: number;
  temptationCases: number;
  exactMatches: number;
  exactMatchRate: number;
  terminalMatches: number;
  terminalMatchRate: number;
  temptationExactMatchRate: number;
  skippedMandatoryStepsTotal: number;
  invalidGatewayAssertionsTotal: number;
  subprocessBypassesTotal: number;
  contextOverlayLeaksTotal: number;
  totalTurns: number;
  totalRefusalRetries: number;
  totalWallTimeMs: number;
  meanCaseWallTimeMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  meanTokensPerCase: number;
  meanPromptTokensPerTurn: number;
}

function estimateTokens(payload: string): number {
  return Math.max(1, Math.ceil(Buffer.byteLength(payload, "utf-8") / 4));
}

function factsForGateway(nodeId: string, bankCase: BankCase): Record<string, unknown> {
  if (nodeId === "GW_ExitCriteria") {
    return bankCase.facts.exitCriteria;
  }
  if (nodeId === "Gateway_SigningRoute") {
    return bankCase.facts.signingRoute ?? { reach: "unknown", signingApiConfigured: false };
  }
  return {};
}

function lastRecordedOutcome(state: InstanceState, nodeId: string): string | undefined {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i]!;
    if (h.node === nodeId && h.outcome !== undefined) {
      return h.outcome;
    }
  }
  for (const child of Object.values(state.children ?? {})) {
    const found = lastRecordedOutcome(child, nodeId);
    if (found !== undefined) return found;
  }
  return undefined;
}

function terminalEventOf(state: InstanceState): string {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i]!;
    if (h.note === "end event reached") {
      return h.node;
    }
  }
  return "unknown";
}

/**
 * Execute one task-bank case under Arm 1 (`forced`), where the token machine
 * drives control flow and scopes each turn's prompt payload to the enabled step.
 */
export function runForcedCase(
  model: ProcessModel,
  roleGraph: RoleGraph,
  bankCase: BankCase,
): ArmCaseMetrics {
  const t0 = performance.now();
  let state = startInstance(model, {
    id: `forced-${bankCase.id}`,
    subject: bankCase.subject,
    bean: bankCase.carriedBeans[0],
    carriedBeans: bankCase.carriedBeans,
  });

  const proposalQueue: ProposedStep[] = [...bankCase.agentProposal.proposedSteps];
  const executedPath: string[] = [];
  const refusals: string[] = [];
  let totalTurns = 0;
  let refusalRetries = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let lastRefusalError: string | undefined;
  const childOnlySkills = new Set<string>(["content-test", "qa-reports"]);
  const postSubprocessSkills: string[] = [];
  const skippableAheadNodes = new Set<string>(["GW_ExitCriteria", "Gateway_SigningRoute"]);

  // A bound on turns, not a budget: every case's canonical path plus its
  // refusals fits well inside it.
  const maxTurns = 4 * bankCase.expected.canonicalPath.length;
  let safetyGuard = 0;
  while (state.status === "running" && safetyGuard < maxTurns) {
    safetyGuard += 1;
    const open: Enabled[] = enabled(model, state, roleGraph);
    if (open.length === 0) break;
    const current = open[0]!;
    if (current.node === "A_FileCertification") {
      for (const s of current.context?.effectiveSkills ?? []) {
        if (childOnlySkills.has(s) && !postSubprocessSkills.includes(s)) {
          postSubprocessSkills.push(s);
        }
      }
    }

    // Turn prompt payload contains ONLY the currently enabled step(s) and their
    // scoped TaskContext, plus the engine's refusal message if the prior turn failed.
    const turnPromptPayload = JSON.stringify({
      instanceId: state.id,
      subject: state.subject,
      enabled: open,
      ...(lastRefusalError ? { refusalError: lastRefusalError } : {}),
    });

    // Determine what the agent attempts on this turn:
    // If there was no refusal on the immediately preceding turn for this step and
    // the proposal queue has an item, try the agent's next proposed step first.
    // After a refusal the RUNNER, not an agent, submits the enabled node: the
    // simulated agent has no way to read the refusal and choose again.
    const canTryProposal = lastRefusalError === undefined && proposalQueue.length > 0;
    const isComputed = current.kind === "decision" && current.computed !== undefined;
    const candidate: ProposedStep = canTryProposal
      ? proposalQueue.shift()!
      : current.kind === "decision" && !isComputed
        ? { node: current.node, outcome: bankCase.facts.gatewayOutcomes?.[current.node] }
        : { node: current.node, useFacts: isComputed };

    totalTurns += 1;
    promptTokens += estimateTokens(turnPromptPayload);

    const attemptPayload =
      isComputed && candidate.node === current.node && candidate.useFacts !== false
        ? { node: candidate.node, facts: factsForGateway(candidate.node, bankCase) }
        : { node: candidate.node, outcome: candidate.outcome };
    completionTokens += estimateTokens(JSON.stringify(attemptPayload));

    try {
      if (candidate.useFacts === false && candidate.outcome !== undefined) {
        // Agent attempts to hand-assert an outcome at a gateway instead of supplying DMN facts
        state = complete(model, state, candidate.node, {
          outcome: candidate.outcome,
          actor: current.role ?? "agent",
        });
      } else if (isComputed && candidate.node === current.node) {
        state = complete(model, state, candidate.node, {
          facts: factsForGateway(candidate.node, bankCase),
          actor: current.role ?? "agent",
        });
      } else {
        state = complete(model, state, candidate.node, {
          outcome: candidate.outcome,
          actor: current.role ?? "agent",
        });
      }

      // Step succeeded! If a proposal had tried to skip ahead (e.g. proposed A_AssembleReport
      // when A_ReExecuteSample was enabled), keep that later proposal in the queue so it
      // can still be matched when its turn legitimately arrives.
      lastRefusalError = undefined;
      if (current.kind === "decision") {
        const out = lastRecordedOutcome(state, candidate.node);
        executedPath.push(out ? `${candidate.node}:${out}` : candidate.node);
      } else {
        executedPath.push(candidate.node);
      }
    } catch (err) {
      if (err instanceof WorkflowError) {
        refusalRetries += 1;
        refusals.push(err.message);
        lastRefusalError = err.message;
        // If the refused candidate was a valid future step that the agent tried to jump
        // ahead to (such as A_AssembleReport while A_ReExecuteSample was still enabled),
        // put it back at the head of proposalQueue so after the mandatory step is forced,
        // the rest of the sequence proceeds naturally.
        if (skippableAheadNodes.has(candidate.node)) {
          proposalQueue.unshift(candidate);
        }
        continue;
      }
      throw err;
    }
  }

  const wallTimeMs = Number((performance.now() - t0).toFixed(4));
  const terminalNode = terminalEventOf(state);
  const exactMatch =
    executedPath.length === bankCase.expected.canonicalPath.length &&
    executedPath.every((step, idx) => step === bankCase.expected.canonicalPath[idx]);
  const terminalMatch = terminalNode === bankCase.expected.terminalNode;

  const skippedMandatorySteps = bankCase.expected.canonicalPath
    .map((s) => s.split(":")[0]!)
    .filter((expectedNode) => !executedPath.some((actual) => actual.split(":")[0] === expectedNode));

  const invalidGatewayAssertions = bankCase.expected.canonicalPath
    .filter((s) => s.includes(":"))
    .filter((expectedGateway) => !executedPath.includes(expectedGateway))
    .map((s) => s.split(":")[0]!);

  const subprocessBypasses = executedPath.includes("Call_Sign") ? ["Call_Sign"] : [];
  const contextOverlayLeaks = postSubprocessSkills.length;
  const totalTokens = promptTokens + completionTokens;

  return {
    caseId: bankCase.id,
    category: bankCase.category,
    executedPath,
    terminalNode,
    exactMatch,
    terminalMatch,
    skippedMandatorySteps,
    invalidGatewayAssertions,
    subprocessBypasses,
    contextOverlayLeaks,
    totalTurns,
    refusalRetries,
    refusals,
    wallTimeMs,
    promptTokens,
    completionTokens,
    totalTokens,
    meanPromptTokensPerTurn: totalTurns > 0 ? Math.round(promptTokens / totalTurns) : 0,
    postSubprocessSkills,
  };
}

export function summarizeForcedArm(results: readonly ArmCaseMetrics[]): ArmSummaryMetrics {
  const totalCases = results.length;
  const disciplined = results.filter((r) => r.category === "disciplined");
  const temptation = results.filter((r) => r.category === "temptation");
  const exactMatches = results.filter((r) => r.exactMatch).length;
  const terminalMatches = results.filter((r) => r.terminalMatch).length;
  const temptationExact = temptation.filter((r) => r.exactMatch).length;

  const skippedMandatoryStepsTotal = results.reduce(
    (sum, r) => sum + r.skippedMandatorySteps.length,
    0,
  );
  const invalidGatewayAssertionsTotal = results.reduce(
    (sum, r) => sum + r.invalidGatewayAssertions.length,
    0,
  );
  const subprocessBypassesTotal = results.reduce((sum, r) => sum + r.subprocessBypasses.length, 0);
  const contextOverlayLeaksTotal = results.reduce((sum, r) => sum + r.contextOverlayLeaks, 0);
  const totalTurns = results.reduce((sum, r) => sum + r.totalTurns, 0);
  const totalRefusalRetries = results.reduce((sum, r) => sum + r.refusalRetries, 0);
  const totalWallTimeMs = Number(
    results.reduce((sum, r) => sum + r.wallTimeMs, 0).toFixed(4),
  );
  const totalPromptTokens = results.reduce((sum, r) => sum + r.promptTokens, 0);
  const totalCompletionTokens = results.reduce((sum, r) => sum + r.completionTokens, 0);
  const totalTokens = totalPromptTokens + totalCompletionTokens;

  return {
    arm: "forced",
    totalCases,
    disciplinedCases: disciplined.length,
    temptationCases: temptation.length,
    exactMatches,
    exactMatchRate: totalCases > 0 ? Number((exactMatches / totalCases).toFixed(4)) : 0,
    terminalMatches,
    terminalMatchRate: totalCases > 0 ? Number((terminalMatches / totalCases).toFixed(4)) : 0,
    temptationExactMatchRate:
      temptation.length > 0 ? Number((temptationExact / temptation.length).toFixed(4)) : 0,
    skippedMandatoryStepsTotal,
    invalidGatewayAssertionsTotal,
    subprocessBypassesTotal,
    contextOverlayLeaksTotal,
    totalTurns,
    totalRefusalRetries,
    totalWallTimeMs,
    meanCaseWallTimeMs: totalCases > 0 ? Number((totalWallTimeMs / totalCases).toFixed(4)) : 0,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    meanTokensPerCase: totalCases > 0 ? Math.round(totalTokens / totalCases) : 0,
    meanPromptTokensPerTurn: totalTurns > 0 ? Math.round(totalPromptTokens / totalTurns) : 0,
  };
}
