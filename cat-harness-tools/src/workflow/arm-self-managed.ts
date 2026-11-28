/**
 * Arm 2 (`self-managed`) for bean `folio-assistant-502c`:
 *
 * The agent is handed the full BPMN specification (`test-plan-execution.bpmn`,
 * its called subprocess `qa-report-signing.bpmn`, all lanes, documentation,
 * DMN decision tables, and all roles/skills in scope) upfront and manages its
 * own step sequence and context window without the token machine (`complete()`)
 * enforcing step order, DMN gateway evaluation, or subprocess entry/exit.
 *
 * - Because the entire multi-lane diagram and all roles/skills sit in the prompt
 *   context across turns, per-turn prompt token cost is substantially higher
 *   than the forced arm's single-step scoped `TaskContext`.
 * - Because no token machine refuses an out-of-order step, a hand-asserted
 *   gateway branch, a call-activity shortcut, or a retained subprocess overlay,
 *   any shortcut in the agent's plan executes unrefused (`refusalRetries === 0`)
 *   and surfaces only in post-run outcome verification.
 *
 * @module folio-assistant/workflow/arm-self-managed
 */

import { resolveRoleSkills, roleForLane, type RoleGraph } from "../../schemas/process/role-graph.js";
import type { ProcessModel } from "./process-model.js";
import { evaluate } from "./decision-table.js";
import type { ArmCaseMetrics, ArmSummaryMetrics, BankCase } from "./arm-forced.js";

function estimateTokens(payload: string): number {
  return Math.max(1, Math.ceil(Buffer.byteLength(payload, "utf-8") / 4));
}

/**
 * Serialize the complete process model (parent + child subprocesses + decision
 * tables + all lane roles and skills) that a self-managed agent carries in
 * context when managing the workflow itself.
 */
export function serializeFullProcessContext(
  model: ProcessModel,
  roleGraph: RoleGraph,
): Record<string, unknown> {
  const serializeOne = (m: ProcessModel): Record<string, unknown> => {
    const lanes = m.lanes.map((lane) => {
      const role = roleForLane(roleGraph, lane.name, lane.roleRef);
      const roleSkills = role ? resolveRoleSkills(roleGraph, role.id).map((s) => s.skill) : [];
      return {
        id: lane.id,
        name: lane.name,
        roleRef: lane.roleRef,
        documentation: lane.documentation,
        nodes: lane.nodes,
        roleSkills,
      };
    });
    const nodes = [...m.nodes.values()].map((n) => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      type: n.type,
      lane: n.lane,
      roleRef: n.roleRef,
      skills: n.skills,
      conventions: n.conventions,
      decisionRef: n.decisionRef,
      calledElement: n.calledElement,
      documentation: n.documentation,
      incoming: n.incoming,
      outgoing: n.outgoing,
    }));
    const flows = [...m.flows.values()].map((f) => ({
      id: f.id,
      name: f.name,
      from: f.from,
      to: f.to,
    }));
    const decisions = [...m.decisions.entries()].map(([gatewayId, table]) => ({
      gatewayId,
      id: table.id,
      name: table.name,
      hitPolicy: table.hitPolicy,
      inputs: table.inputs,
      rules: table.rules,
    }));
    const children: Record<string, unknown> = {};
    for (const [callId, childModel] of m.children.entries()) {
      children[callId] = serializeOne(childModel);
    }
    return {
      id: m.id,
      name: m.name,
      documentation: m.documentation,
      lanes,
      nodes,
      flows,
      decisions,
      children,
    };
  };

  return serializeOne(model);
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

function findNodeModel(
  model: ProcessModel,
  nodeId: string,
): { ownerModel: ProcessModel; isChild: boolean } | undefined {
  if (model.nodes.has(nodeId)) {
    return { ownerModel: model, isChild: false };
  }
  for (const childModel of model.children.values()) {
    if (childModel.nodes.has(nodeId)) {
      return { ownerModel: childModel, isChild: true };
    }
  }
  return undefined;
}

function deriveSelfManagedTerminalNode(executedPath: readonly string[]): string {
  // The bean-close steps (`Close_*`) follow every end that finishes the bean;
  // the verdict is read from the step before them.
  const work = executedPath.filter((s) => !s.startsWith("Close_"));
  const lastStep = work[work.length - 1];
  if (!lastStep) return "unknown";
  if (
    lastStep === "A_FileCertification" ||
    lastStep === "Task_StoreSigned" ||
    lastStep === "Call_Sign"
  ) {
    return "End_Certified";
  }
  if (lastStep === "A_RecordRefusal") {
    return "End_Refused";
  }
  if (lastStep === "A_RecordUndetermined") {
    return "End_Undetermined";
  }
  return "unknown";
}

/**
 * Execute one task-bank case under Arm 2 (`self-managed`), where the agent
 * receives the entire process specification in context and manages its own
 * step sequence without runtime token-machine enforcement.
 */
export function runSelfManagedCase(
  model: ProcessModel,
  roleGraph: RoleGraph,
  bankCase: BankCase,
): ArmCaseMetrics {
  const t0 = performance.now();
  const fullSpec = serializeFullProcessContext(model, roleGraph);

  const executedPath: string[] = [];
  const activeSkills = new Set<string>();
  const childOnlySkills = new Set<string>(["content-test", "qa-reports"]);
  let inSubprocess = false;
  let totalTurns = 0;
  let promptTokens = 0;
  let completionTokens = 0;

  // Turn 0 (initial planning / orientation turn over the full BPMN specification + case facts)
  const planningPrompt = JSON.stringify({
    mode: "self-managed-plan",
    subject: bankCase.subject,
    carriedBeans: bankCase.carriedBeans,
    facts: bankCase.facts,
    processSpecification: fullSpec,
  });
  totalTurns += 1;
  promptTokens += estimateTokens(planningPrompt);
  completionTokens += estimateTokens(JSON.stringify(bankCase.agentProposal.proposedSteps));

  for (const step of bankCase.agentProposal.proposedSteps) {
    const resolved = findNodeModel(model, step.node);
    const nodeObj = resolved?.ownerModel.nodes.get(step.node);

    if (resolved?.isChild) {
      inSubprocess = true;
      for (const s of nodeObj?.skills ?? []) {
        activeSkills.add(s);
      }
    } else if (inSubprocess) {
      inSubprocess = false;
      if (!bankCase.agentProposal.retainSubprocessOverlayOnExit) {
        for (const s of childOnlySkills) {
          activeSkills.delete(s);
        }
      }
      for (const s of nodeObj?.skills ?? []) {
        activeSkills.add(s);
      }
    } else {
      for (const s of nodeObj?.skills ?? []) {
        activeSkills.add(s);
      }
    }

    // At each self-managed execution turn, the agent carries the full process
    // specification, the case facts, its accumulated active skills, and the
    // history of steps it has executed so far.
    const stepPrompt = JSON.stringify({
      mode: "self-managed-step",
      subject: bankCase.subject,
      carriedBeans: bankCase.carriedBeans,
      activeSkills: [...activeSkills],
      executedSoFar: executedPath,
      facts: bankCase.facts,
      processSpecification: fullSpec,
    });
    totalTurns += 1;
    promptTokens += estimateTokens(stepPrompt);

    let stepRecord = step.node;
    if (nodeObj?.kind === "exclusive") {
      const table = resolved?.ownerModel.decisions.get(step.node);
      if (step.useFacts !== false && table) {
        const evaluated = evaluate(table, factsForGateway(step.node, bankCase));
        stepRecord = `${step.node}:${String(evaluated.outcome)}`;
      } else if (step.outcome !== undefined) {
        // Without the token machine's DMN guard, the agent's hand-picked branch
        // outcome is accepted directly.
        stepRecord = `${step.node}:${step.outcome}`;
      }
    }
    executedPath.push(stepRecord);
    completionTokens += estimateTokens(
      JSON.stringify({ executed: stepRecord, activeSkills: [...activeSkills] }),
    );
  }

  // If the last step was inside the child subprocess (e.g. Task_RecordSignature),
  // exiting the subprocess at the end of Call_Sign strips child skills ONLY if
  // the self-managed agent explicitly pops its context frame.
  if (inSubprocess && !bankCase.agentProposal.retainSubprocessOverlayOnExit) {
    for (const s of childOnlySkills) {
      activeSkills.delete(s);
    }
  }

  const postSubprocessSkills = [...activeSkills].filter((s) => childOnlySkills.has(s));
  const wallTimeMs = Number((performance.now() - t0).toFixed(4));
  const terminalNode = deriveSelfManagedTerminalNode(executedPath);

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
    refusalRetries: 0,
    refusals: [],
    wallTimeMs,
    promptTokens,
    completionTokens,
    totalTokens,
    meanPromptTokensPerTurn: totalTurns > 0 ? Math.round(promptTokens / totalTurns) : 0,
    postSubprocessSkills,
  };
}

export function summarizeSelfManagedArm(results: readonly ArmCaseMetrics[]): ArmSummaryMetrics {
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
    arm: "self-managed",
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
