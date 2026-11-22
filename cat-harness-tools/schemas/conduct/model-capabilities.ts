/**
 * Model capabilities and single-model capability refusal schema.
 *
 * In developer mode (and any single-model deployment topology), one model is
 * configured for every workflow. A workflow lane or role may require specific
 * model capabilities — e.g. high reasoning tier, tool use, large context window.
 * If the configured model lacks any required capability, the workflow must
 * **explicitly refuse with a clear structured error rather than silently degrading**.
 *
 * @module schemas/model-capabilities
 * @graphNode schema
 */

import { z } from "zod";

/** Reasoning tiers from low to expert. */
export const REASONING_TIERS = ["low", "medium", "high", "expert"] as const;
export type ReasoningTier = (typeof REASONING_TIERS)[number];

const REASONING_TIER_RANK: Record<ReasoningTier, number> = {
  low: 1,
  medium: 2,
  high: 3,
  expert: 4,
};

/** Compare whether `provided` reasoning tier meets or exceeds `required`. */
export function reasoningTierGte(provided: ReasoningTier, required: ReasoningTier): boolean {
  return (REASONING_TIER_RANK[provided] ?? 0) >= (REASONING_TIER_RANK[required] ?? 0);
}

/** Schema for model capability requirements or provisions. */
export const ModelCapabilitiesSchema = z
  .object({
    /** Minimum reasoning tier required. */
    reasoning_tier: z.enum(REASONING_TIERS).optional(),
    /** Whether function calling / tool invocation is required. */
    tool_use: z.boolean().optional(),
    /** Minimum context window size in tokens. */
    context_window: z.number().int().positive().optional(),
    /** Whether multimodal input (images, diagrams) is required. */
    multimodal: z.boolean().optional(),
    /** Specific named capabilities (e.g. "code_execution", "json_schema"). */
    capabilities: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type ModelCapabilities = z.infer<typeof ModelCapabilitiesSchema>;

/** Schema for a configured model in the deployment. */
export const ModelConfigSchema = z
  .object({
    id: z.string().min(1),
    capabilities: ModelCapabilitiesSchema,
    name: z.string().optional(),
    provider: z.string().optional(),
  })
  .strict();

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/** Structured violation report when a model lacks a required capability. */
export interface ModelCapabilityViolation {
  capability: string;
  required: unknown;
  provided: unknown;
  reason: string;
}

export interface ModelCapabilityCheckResult {
  satisfied: boolean;
  violations: ModelCapabilityViolation[];
}

/** Check whether `provided` capabilities satisfy all `required` capabilities. */
export function checkModelCapabilities(
  required: ModelCapabilities | undefined,
  provided: ModelCapabilities | undefined,
): ModelCapabilityCheckResult {
  if (!required) return { satisfied: true, violations: [] };
  const prov = provided ?? {};
  const violations: ModelCapabilityViolation[] = [];

  if (required.reasoning_tier !== undefined) {
    if (!prov.reasoning_tier || !reasoningTierGte(prov.reasoning_tier, required.reasoning_tier)) {
      violations.push({
        capability: "reasoning_tier",
        required: required.reasoning_tier,
        provided: prov.reasoning_tier ?? null,
        reason: `requires reasoning tier "${required.reasoning_tier}", but configured model provides "${prov.reasoning_tier ?? "none"}"`,
      });
    }
  }

  if (required.tool_use === true && !prov.tool_use) {
    violations.push({
      capability: "tool_use",
      required: true,
      provided: prov.tool_use ?? false,
      reason: `requires tool_use support, but configured model does not support tool_use`,
    });
  }

  if (required.context_window !== undefined) {
    const provWindow = prov.context_window ?? 0;
    if (provWindow < required.context_window) {
      violations.push({
        capability: "context_window",
        required: required.context_window,
        provided: provWindow,
        reason: `requires context window of at least ${required.context_window} tokens, but configured model only provides ${provWindow}`,
      });
    }
  }

  if (required.multimodal === true && !prov.multimodal) {
    violations.push({
      capability: "multimodal",
      required: true,
      provided: prov.multimodal ?? false,
      reason: `requires multimodal input support, but configured model is not multimodal`,
    });
  }

  if (required.capabilities && required.capabilities.length > 0) {
    const provCaps = new Set(prov.capabilities ?? []);
    const missing = required.capabilities.filter((c) => !provCaps.has(c));
    if (missing.length > 0) {
      violations.push({
        capability: "capabilities",
        required: required.capabilities,
        provided: prov.capabilities ?? [],
        reason: `missing required specific capabilities: [${missing.join(", ")}]`,
      });
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}
