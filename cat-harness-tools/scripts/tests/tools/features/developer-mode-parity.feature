# Developer mode: scripts/check-tool-parity.ts measures MCP-vs-CLI Tool parity, the
# topology schema expresses developer mode, and src/workflow/model-capabilities.ts
# refuses a lane whose model lacks a required capability. Each Scenario names the test that executes it.
Feature: Developer mode tool parity, topology and capability refusal

  @test:scripts/tests/tools/developer-mode-parity.test.ts::MCP-vs-CLI_tool_parity_measurer::measures_live_declared_tools_and_outputs_structured_report
  Scenario: The parity measurer reports on the live declared Tools
    Given the harness's declared Tools
    When Tool parity is measured
    Then more than 50 Tools are counted
    And at least 5 are on both surfaces, at least 10 MCP-only and at least 50 CLI-only
    And the report date is in YYYY-MM-DD form
    And the MCP-only Tools include "workflow-start", "workflow-complete", "skill-fetch" and "translation-status"
    And the MCP-only skills include "process-state" and "skills-and-tools"
    And the formatted report contains the title "# MCP-vs-CLI Tool Parity Report", "Measurement Date", "MCP-Only Skills" and "process-state"

  @test:scripts/tests/tools/developer-mode-parity.test.ts::MCP-vs-CLI_tool_parity_measurer::correctly_categorizes_synthetic_tool_fixtures
  Scenario: The parity measurer categorizes synthetic Tools
    Given four synthetic Tools: one with MCP and shell, one MCP-only, one shell-only and one manual
    When Tool parity is measured over them with no package.json
    Then 4 Tools are counted, one in each of both, MCP-only, CLI-only and neither
    And the skills split into "skill-common" for both, "skill-mcp-only" for MCP-only and "skill-cli-only" for CLI-only
    And the gap summary counts 1 MCP-only skill

  @test:scripts/tests/tools/developer-mode-parity.test.ts::Developer_Mode_Topology::developer_mode_topology_point_conforms_to_schema_and_produces_zero_conflicts
  Scenario: The developer mode topology parses and has no conflicts
    Given the developer mode topology
    When it is parsed by the topology schema
    Then forge is "none", compute "workstation", tool surface "cli" and model cardinality "single"
    And data stores are only "none" and it is not outward facing
    And the developer profile is named "developer" with publication host "local-server"
    And the deployment profiles include "developer"
    And the topology has no conflicts with publication host "local-server"

  @test:scripts/tests/tools/developer-mode-parity.test.ts::Developer_Mode_Topology::all_10_proposal_axes_are_expressible_and_validated
  Scenario: The topology axes list their values and refuse unknown ones
    # Gap: the title says "all 10" axes; the body lists eight enums exactly, checks one publication host by containment, and tests invalid-value rejection for only compute, toolSurface and modelCardinality
    Given the topology axis value lists
    Then compute, tool surface, model cardinality, data stores, visibility, forge, network reach and model provenance each list their exact values
    And the publication hosts include "local-server"
    And parsing compute "quantum-mainframe", tool surface "voice-assistant" or model cardinality "infinite" throws

  @test:scripts/tests/tools/developer-mode-parity.test.ts::Single-Model_Capability_Refusal_Guard::reasoningTierGte_respects_tier_hierarchy
  Scenario: Reasoning tiers compare in the order low, medium, high, expert
    Given the reasoning tier comparison
    Then each tier is at least itself or the tier below it
    And "low" is below "medium", "medium" below "high" and "high" below "expert"

  @test:scripts/tests/tools/developer-mode-parity.test.ts::Single-Model_Capability_Refusal_Guard::checkModelCapabilities_detects_all_capability_gaps
  Scenario: A capability check names every gap
    Given requirements of high reasoning, tool use, a 64000 context window, multimodal and two named capabilities
    When a model lacking all of them is checked
    Then the check is not satisfied, with 5 violations in the order reasoning_tier, tool_use, context_window, multimodal, capabilities
    And when a model meeting all of them is checked, it is satisfied with no violations

  @test:scripts/tests/tools/developer-mode-parity.test.ts::Single-Model_Capability_Refusal_Guard::workflow_lane_refusing_under-capable_single_model
  Scenario: A lane refuses a model below its role's required capabilities
    Given a "researcher" role needing high reasoning, tool use and a 64000 context window, and a "formatter" role needing low reasoning
    And a small model with low reasoning, no tool use and an 8192 context window
    When each lane is validated against the small model
    Then the formatter lane accepts it
    And the researcher lane throws a capability refusal naming role "researcher", lane "Research Lane" and model "small-local-8b"
    And the refusal has 3 violations and says "Workflow refused" and "Refusing rather than silently degrading"
    And the researcher lane accepts a strong model

  @test:scripts/tests/tools/developer-mode-parity.test.ts::Single-Model_Capability_Refusal_Guard::workflow_startInstance_and_complete_enforce_capability_refusal_guard
  Scenario: Starting and completing a workflow refuse an under-capable model
    Given the "crdm-requirements.bpmn" process model and a "business-analyst" role needing high reasoning and tool use
    When an instance is started with an under-capable model
    Then it throws a capability refusal
    And an instance started with a capable model is running with at least one token
    And completing its first token with the under-capable model throws a capability refusal
    And completing it with the capable model records the node in the history
