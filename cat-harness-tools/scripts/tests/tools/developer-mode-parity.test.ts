/**
 * Test suite for Developer Mode: tool parity, topology profile, and capability refusal guard.
 *
 * ## Bean `folio-assistant-2ngl`
 *
 * Done when:
 * 1. The MCP-vs-CLI parity gap is measured and written down, with command and date.
 * 2. Developer mode is expressible as axis values in deployment profiles / topology.
 * 3. A workflow whose lane needs a capability the configured model lacks refuses rather than degrades.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { measureToolParity, formatParityReport } from "../../check-tool-parity.js";
import {
  TopologySchema,
  DEVELOPER_MODE_TOPOLOGY,
  DEVELOPER_MODE_PROFILE,
  DEPLOYMENT_PROFILES,
  COMPUTES,
  TOOL_SURFACES,
  MODEL_CARDINALITIES,
  DATA_STORES,
  VISIBILITIES,
  FORGES,
  NETWORK_REACHES,
  MODEL_PROVENANCES,
  PUBLICATION_HOSTS,
  topologyConflicts,
} from "../../../schemas/kg/cat-harness.js";
import {
  reasoningTierGte,
  checkModelCapabilities,
  validateLaneModelCapabilities,
  WorkflowCapabilityRefusalError,
  type ModelConfig,
  type ModelCapabilities,
} from "../../../src/workflow/model-capabilities.js";
import { defineTool, type ToolDefinition } from "../../../schemas/tools/tool.js";
import type { RoleGraph } from "../../../schemas/process/role-graph.js";
import { loadProcessModel } from "../../../src/workflow/process-model.js";
import { startInstance, complete } from "../../../src/workflow/instance.js";
import { workflowFile } from "../../known-skills.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const ROOT = join(HARNESS_ROOT);

describe("MCP-vs-CLI tool parity measurer", () => {
  test("measures live declared tools and outputs structured report", () => {
    const report = measureToolParity();
    expect(report.totalTools).toBeGreaterThan(50);
    expect(report.counts.both).toBeGreaterThanOrEqual(5);
    expect(report.counts.mcpOnly).toBeGreaterThanOrEqual(10);
    expect(report.counts.cliOnly).toBeGreaterThanOrEqual(50);
    expect(report.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Parity gap: verify known MCP-only tools and skills are identified
    const mcpOnlyToolIds = report.tools.mcpOnly.map((t) => t.id);
    expect(mcpOnlyToolIds).toContain("workflow-start");
    expect(mcpOnlyToolIds).toContain("workflow-complete");
    expect(mcpOnlyToolIds).toContain("skill-fetch");
    // paper-preferences was here until bean `bbza` moved it to folio-assistant-sci;
    // this measurer reads the harness's own Tool list.
    expect(mcpOnlyToolIds).toContain("translation-status");

    expect(report.skills.mcpOnly).toContain("process-state");
    expect(report.skills.mcpOnly).toContain("skills-and-tools");

    // Formatted report output
    const formatted = formatParityReport(report);
    expect(formatted).toContain("# MCP-vs-CLI Tool Parity Report");
    expect(formatted).toContain("Measurement Date");
    expect(formatted).toContain("MCP-Only Skills");
    expect(formatted).toContain("process-state");
  });

  test("correctly categorizes synthetic tool fixtures", () => {
    const syntheticTools: ToolDefinition[] = [
      defineTool({
        id: "tool-both",
        title: "Both tool",
        description: "Has both",
        install: { none: true },
        io: { inputs: [], outputs: [] },
        invoke: {
          inProcess: { module: "src/test.ts" },
          mcp: { tool: "test_mcp" },
          shell: "bun run test",
        },
        satisfies: ["skill-common"],
      }),
      defineTool({
        id: "tool-mcp",
        title: "MCP only tool",
        description: "Only MCP",
        install: { none: true },
        io: { inputs: [], outputs: [] },
        invoke: {
          inProcess: { module: "src/test.ts" },
          mcp: { tool: "test_mcp_only" },
        },
        satisfies: ["skill-mcp-only"],
      }),
      defineTool({
        id: "tool-cli",
        title: "CLI only tool",
        description: "Only CLI",
        install: { none: true },
        io: { inputs: [], outputs: [] },
        invoke: {
          shell: "bun run cli",
        },
        satisfies: ["skill-cli-only"],
      }),
      defineTool({
        id: "tool-neither",
        title: "Neither tool",
        description: "Placeholder",
        install: { none: true },
        io: { inputs: [], outputs: [] },
        invoke: { manual: true },
        satisfies: ["skill-placeholder"],
      }),
    ];

    const report = measureToolParity(syntheticTools, "/nonexistent/package.json");
    expect(report.totalTools).toBe(4);
    expect(report.counts.both).toBe(1);
    expect(report.counts.mcpOnly).toBe(1);
    expect(report.counts.cliOnly).toBe(1);
    expect(report.counts.neither).toBe(1);

    expect(report.skills.both).toEqual(["skill-common"]);
    expect(report.skills.mcpOnly).toEqual(["skill-mcp-only"]);
    expect(report.skills.cliOnly).toEqual(["skill-cli-only"]);
    expect(report.gapSummary.mcpOnlySkillCount).toBe(1);
  });
});

describe("Developer Mode Topology", () => {
  test("developer mode topology point conforms to schema and produces zero conflicts", () => {
    const parsed = TopologySchema.parse(DEVELOPER_MODE_TOPOLOGY);
    expect(parsed.forge).toBe("none");
    expect(parsed.compute).toBe("workstation");
    expect(parsed.toolSurface).toBe("cli");
    expect(parsed.modelCardinality).toBe("single");
    expect(parsed.dataStores).toEqual(["none"]);
    expect(parsed.outwardFacing).toBe(false);

    // Verify profile preset
    expect(DEVELOPER_MODE_PROFILE.name).toBe("developer");
    expect(DEVELOPER_MODE_PROFILE.publicationHost).toBe("local-server");
    expect(DEPLOYMENT_PROFILES.developer).toBeDefined();

    // Verify zero topology conflicts
    const conflicts = topologyConflicts(DEVELOPER_MODE_TOPOLOGY, "local-server");
    expect(conflicts).toEqual([]);
  });

  test("all 10 proposal axes are expressible and validated", () => {
    expect([...COMPUTES]).toEqual(["workstation", "vendor-cloud", "jurisdiction-cloud", "own-infrastructure"]);
    expect([...TOOL_SURFACES]).toEqual(["mcp", "cli", "both"]);
    expect([...MODEL_CARDINALITIES]).toEqual(["single", "stack"]);
    expect([...DATA_STORES]).toEqual(["none", "hapi-fhir", "national-portal", "emr", "wallet"]);
    expect([...VISIBILITIES]).toEqual(["public", "private", "internal"]);
    expect([...FORGES]).toEqual(["none", "github", "self-hosted", "jurisdiction-hosted"]);
    expect([...NETWORK_REACHES]).toEqual(["internet", "egress-restricted", "air-gapped"]);
    expect([...MODEL_PROVENANCES]).toEqual(["open-weight-local", "hosted", "mixed"]);
    expect(PUBLICATION_HOSTS).toContain("local-server");

    // Invalid enum values throw on parse
    expect(() => TopologySchema.parse({ compute: "quantum-mainframe" })).toThrow();
    expect(() => TopologySchema.parse({ toolSurface: "voice-assistant" })).toThrow();
    expect(() => TopologySchema.parse({ modelCardinality: "infinite" })).toThrow();
  });
});

describe("Single-Model Capability Refusal Guard", () => {
  test("reasoningTierGte respects tier hierarchy", () => {
    expect(reasoningTierGte("low", "low")).toBe(true);
    expect(reasoningTierGte("medium", "low")).toBe(true);
    expect(reasoningTierGte("high", "medium")).toBe(true);
    expect(reasoningTierGte("expert", "high")).toBe(true);

    expect(reasoningTierGte("low", "medium")).toBe(false);
    expect(reasoningTierGte("medium", "high")).toBe(false);
    expect(reasoningTierGte("high", "expert")).toBe(false);
  });

  test("checkModelCapabilities detects all capability gaps", () => {
    const required: ModelCapabilities = {
      reasoning_tier: "high",
      tool_use: true,
      context_window: 64000,
      multimodal: true,
      capabilities: ["json_schema", "code_execution"],
    };

    // Under-capable model missing all requirements
    const poorModel: ModelCapabilities = {
      reasoning_tier: "low",
      tool_use: false,
      context_window: 8192,
      multimodal: false,
      capabilities: ["basic_text"],
    };

    const failResult = checkModelCapabilities(required, poorModel);
    expect(failResult.satisfied).toBe(false);
    expect(failResult.violations.length).toBe(5);
    expect(failResult.violations.map((v) => v.capability)).toEqual([
      "reasoning_tier",
      "tool_use",
      "context_window",
      "multimodal",
      "capabilities",
    ]);

    // Capable model satisfying all requirements
    const richModel: ModelCapabilities = {
      reasoning_tier: "high",
      tool_use: true,
      context_window: 128000,
      multimodal: true,
      capabilities: ["json_schema", "code_execution", "web_search"],
    };

    const passResult = checkModelCapabilities(required, richModel);
    expect(passResult.satisfied).toBe(true);
    expect(passResult.violations).toEqual([]);
  });

  test("workflow lane refusing under-capable single model", () => {
    const mockRoles: RoleGraph = {
      name: "test-roles",
      roles: [
        {
          id: "researcher",
          title: "Researcher",
          description: "Synthesises complex claims",
          actorKinds: ["agent"],
          skills: [],
          requiredCapabilities: {
            reasoning_tier: "high",
            tool_use: true,
            context_window: 64000,
          },
        },
        {
          id: "formatter",
          title: "Formatter",
          description: "Lightweight text formatting",
          actorKinds: ["agent"],
          skills: [],
          requiredCapabilities: {
            reasoning_tier: "low",
          },
        },
      ],
    };

    const smallModel: ModelConfig = {
      id: "small-local-8b",
      capabilities: {
        reasoning_tier: "low",
        tool_use: false,
        context_window: 8192,
      },
    };

    const strongModel: ModelConfig = {
      id: "claude-3-5-sonnet",
      capabilities: {
        reasoning_tier: "high",
        tool_use: true,
        context_window: 200000,
      },
    };

    // Formatter lane succeeds on small model
    expect(() =>
      validateLaneModelCapabilities("formatter", "Format Lane", smallModel, mockRoles),
    ).not.toThrow();

    // Researcher lane explicitly REFUSES small model
    let refusalErr: unknown;
    try {
      validateLaneModelCapabilities("researcher", "Research Lane", smallModel, mockRoles);
    } catch (e) {
      refusalErr = e;
    }

    expect(refusalErr).toBeInstanceOf(WorkflowCapabilityRefusalError);
    const err = refusalErr as WorkflowCapabilityRefusalError;
    expect(err.role).toBe("researcher");
    expect(err.lane).toBe("Research Lane");
    expect(err.model.id).toBe("small-local-8b");
    expect(err.violations.length).toBe(3); // reasoning_tier, tool_use, context_window
    expect(err.message).toContain("Workflow refused");
    expect(err.message).toContain("Refusing rather than silently degrading");

    // Researcher lane succeeds on strong model
    expect(() =>
      validateLaneModelCapabilities("researcher", "Research Lane", strongModel, mockRoles),
    ).not.toThrow();
  });

  test("workflow startInstance and complete enforce capability refusal guard", async () => {
    const model = await loadProcessModel(workflowFile(ROOT, "crdm-requirements.bpmn"));

    const mockRoles: RoleGraph = {
      name: "test-workflow-roles",
      roles: [
        {
          id: "business-analyst",
          title: "Business Analyst",
          description: "Gathers business requirements",
          actorKinds: ["agent"],
          skills: [],
          requiredCapabilities: {
            reasoning_tier: "high",
            tool_use: true,
          },
        },
      ],
    };

    const underCapableModel: ModelConfig = {
      id: "tiny-model-1b",
      capabilities: {
        reasoning_tier: "low",
        tool_use: false,
      },
    };

    const capableModel: ModelConfig = {
      id: "gemini-1.5-pro",
      capabilities: {
        reasoning_tier: "high",
        tool_use: true,
        context_window: 1000000,
      },
    };

    // startInstance with under-capable model throws WorkflowCapabilityRefusalError
    expect(() =>
      startInstance(model, {
        id: "inst-refusal-test",
        subject: "test",
        model: underCapableModel,
        roles: mockRoles,
      }),
    ).toThrow(WorkflowCapabilityRefusalError);

    // startInstance with capable model succeeds
    const state = startInstance(model, {
      id: "inst-pass-test",
      subject: "test",
      model: capableModel,
      roles: mockRoles,
    });
    expect(state.status).toBe("running");
    expect(state.tokens.length).toBeGreaterThan(0);

    const firstNode = state.tokens[0];

    // complete with under-capable model throws WorkflowCapabilityRefusalError
    expect(() =>
      complete(model, state, firstNode, {
        actor: "test-agent",
        model: underCapableModel,
        roles: mockRoles,
      }),
    ).toThrow(WorkflowCapabilityRefusalError);

    // complete with capable model succeeds and advances
    const nextState = complete(model, state, firstNode, {
      actor: "test-agent",
      model: capableModel,
      roles: mockRoles,
    });
    expect(nextState.history.some((h) => h.node === firstNode)).toBe(true);
  });
});
