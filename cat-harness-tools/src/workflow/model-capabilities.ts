/**
 * Model capabilities and single-model capability refusal guard.
 *
 * ## Why this exists — bean `folio-assistant-2ngl`
 *
 * In developer mode (and any single-model deployment topology), one model is
 * configured for every workflow. A workflow lane or role may require specific
 * model capabilities — e.g. high reasoning tier, tool use, large context window.
 * If the configured model lacks any required capability, the workflow must
 * **explicitly refuse with a clear structured error rather than silently degrading**.
 * Degrading silently produces plausible-looking junk; refusing tells the operator
 * that the model class does not meet the workflow's requirements.
 *
 * @module folio-assistant/workflow/model-capabilities
 */

import type { ProcessModel } from "./process-model.js";
import type { RoleGraph } from "../../schemas/process/role-graph.js";
import { roleForLane } from "../../schemas/process/role-graph.js";
import {
  checkModelCapabilities,
  type ModelCapabilities,
  type ModelCapabilityViolation,
  type ModelConfig,
} from "../../schemas/conduct/model-capabilities.js";

export * from "../../schemas/conduct/model-capabilities.js";

/**
 * Structured refusal error thrown when a workflow or lane demands capabilities
 * that the configured model lacks.
 */
export class WorkflowCapabilityRefusalError extends Error {
  constructor(
    public readonly role: string,
    public readonly lane: string,
    public readonly required: ModelCapabilities,
    public readonly model: ModelConfig,
    public readonly violations: ModelCapabilityViolation[],
  ) {
    const details = violations.map((v) => v.reason).join("; ");
    super(
      `Workflow refused: lane "${lane}" (role "${role}") requires model capabilities that configured model "${model.id}" lacks: ${details}. Refusing rather than silently degrading.`,
    );
    this.name = "WorkflowCapabilityRefusalError";
  }
}

/**
 * Validate a specific lane's role capability requirements against a model.
 * Throws {@link WorkflowCapabilityRefusalError} if the model is insufficient.
 */
export function validateLaneModelCapabilities(
  roleId: string,
  laneName: string,
  model: ModelConfig,
  roles?: RoleGraph,
): void {
  if (!roles) return;
  const role = roles.roles.find((r) => r.id === roleId);
  if (!role || !role.requiredCapabilities) return;

  const result = checkModelCapabilities(role.requiredCapabilities, model.capabilities);
  if (!result.satisfied) {
    throw new WorkflowCapabilityRefusalError(
      roleId,
      laneName,
      role.requiredCapabilities,
      model,
      result.violations,
    );
  }
}

/**
 * Validate an entire process model against a single configured model before dispatch.
 * Refuses if any lane in the workflow binds to a role whose required capabilities
 * the model lacks.
 */
export function validateWorkflowModel(
  processModel: ProcessModel,
  model: ModelConfig,
  roles?: RoleGraph,
): void {
  if (!roles) return;

  for (const [, node] of processModel.nodes) {
    const laneName = node.lane;
    const roleRef = node.roleRef;
    if (!laneName && !roleRef) continue;

    const boundRole = roleForLane(roles, laneName, roleRef);
    if (!boundRole || !boundRole.requiredCapabilities) continue;

    const result = checkModelCapabilities(boundRole.requiredCapabilities, model.capabilities);
    if (!result.satisfied) {
      throw new WorkflowCapabilityRefusalError(
        boundRole.id,
        laneName ?? boundRole.title,
        boundRole.requiredCapabilities,
        model,
        result.violations,
      );
    }
  }

  // Also validate any child call activities / subprocesses
  for (const [, child] of processModel.children) {
    validateWorkflowModel(child, model, roles);
  }
}
