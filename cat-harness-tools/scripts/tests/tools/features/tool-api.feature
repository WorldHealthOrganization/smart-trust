# scripts/tool-api.ts presents the Tools as an API: an OpenAPI document of their
# contracts and the MCP tool list read from the registrars. Each Scenario names the test that executes it.
Feature: The Tools as an OpenAPI document and an MCP tool list

  @test:scripts/tests/tools/tool-api.test.ts::openApiFor::is_OpenAPI_3.1_with_no_servers,_and_says_its_paths_are_contracts
  Scenario: The OpenAPI document is 3.1 with no servers
    Given the OpenAPI document for a "demo-tool" Tool
    Then its version is "3.1.0"
    And it lists no servers
    And its description says "No HTTP server serves these paths"

  @test:scripts/tests/tools/tool-api.test.ts::openApiFor::has_one_operation_per_Tool,_carrying_its_IRI,_invocation,_MCP_names_and_skills
  Scenario: Each Tool's operation carries its IRI, invocation, MCP names and skills
    Given the OpenAPI document for the "demo-tool" Tool
    When the POST operation at "/tools/demo-tool" is read
    Then its operation id is "demo-tool"
    And its Tool IRI is "https://x.test/fa/tools/demo-tool.jsonld"
    And its invocation equals the Tool's invoke
    And its MCP tools are "demo_run"
    And its tags are "process-state"

  @test:scripts/tests/tools/tool-api.test.ts::openApiFor::resolves_every_$ref_inside_the_document_—_a_skill_contract's_own_definitions_are_hoisted
  Scenario: Every reference resolves to a component schema, including hoisted skill definitions
    Given the OpenAPI document for the "demo-tool" Tool with a skill input contract defining "A"
    Then the component schemas include "ProcessId", "skill.process-state.input" and "skill.process-state.input.A"
    And every reference in the document points to a component schema that exists

  @test:scripts/tests/tools/tool-api.test.ts::hoistSchema::rewrites_#,_#/definitions_and_#/$defs_refs_to_the_hoisted_names
  Scenario: Hoisting rewrites root, definitions and $defs references
    Given a schema with an $id, a root reference, a $defs entry "D" and a definitions entry "E"
    When it is hoisted under the name "N"
    Then the hoisted schemas are "N", "N.D" and "N.E"
    And every reference points to one of those component schemas
    And the hoisted "N" has no $id

  @test:scripts/tests/tools/tool-api.test.ts::the_MCP_tool_list::reads_each_served_name_and_its_input_schema_from_the_registrar
  Scenario: The registrar capture reads served names and input schemas
    Given a registrar serving "demo_start", "demo_next" and "other_tool"
    When the registrar is captured
    Then the served names are "demo_start", "demo_next", "other_tool" in that order
    And "demo_start" has properties "process" and "note", with only "process" required

  @test:scripts/tests/tools/tool-api.test.ts::the_MCP_tool_list::expands_a_pattern_to_the_served_names,_and_falls_back_to_the_declared_inputs_only_by_name
  Scenario: A name pattern expands to served names and a plain name falls back to declared inputs
    Given the registrar and a Tool whose MCP tool is the pattern "demo_*"
    When the MCP tool list is built
    Then there are no problems
    And the tools are "demo_next" and "demo_start", each sourced from the registrar for "demo-tool"
    And a Tool naming "demo_run", which the registrar does not serve, lists "demo_run" sourced as declared with "process" required
