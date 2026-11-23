# src/mcp/project.ts projects Tool definitions to MCP declarations and builds each
# shell invocation's argv from inputs whose types refuse injection payloads, and
# records invocations. Each Scenario names the test that executes it.
Feature: MCP projection of Tools and its injection defence

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::argv_is_an_array,_and_the_command_is_its_head
  Scenario: The argv is an array headed by the command
    Given a "beans" Tool with a positional BeanId "id" and a "--status" flag
    When its argv is built for id "fa-1dfh" and status "in-progress"
    Then the argv is "beans", "fa-1dfh", "--status", "in-progress"

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::a_payload_cannot_be_constructed_—_the_type_refuses_it
  Scenario: A shell payload is refused as a bean id
    Given the "beans" Tool
    When its argv is built with an id of "; rm -rf /", "$(whoami)", a backticked "id", "a && b", "x | y" or "../../etc/passwd"
    Then each build throws

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::an_enum_input_refuses_anything_outside_the_enum
  Scenario: An enum input refuses a value outside the enum
    Given the "beans" Tool
    When its argv is built with status "completed; rm -rf /"
    Then the build throws

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::a_missing_required_input_throws_rather_than_producing_a_short_argv
  Scenario: A missing required input throws
    Given the "beans" Tool
    When its argv is built with no inputs
    Then the build throws an error naming the "required input"

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::positionals_keep_their_declared_order_regardless_of_declaration_order
  Scenario: Positionals follow their position, not their declaration order
    Given a "cmd" Tool declaring positional 1 "second" before positional 0 "first"
    When its argv is built for first "a" and second "b"
    Then the argv is "cmd", "a", "b"

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::free_prose_goes_on_stdin,_never_into_argv
  Scenario: A Markdown input goes on stdin
    Given a "cmd" Tool with a Markdown "body" input read from stdin
    When its argv is built with a body containing shell metacharacters
    Then the argv is only "cmd"
    And stdin is the body unchanged

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::Markdown_is_not_injection-safe,_and_that_is_deliberate
  Scenario: Markdown is not injection-safe while the constrained types are
    Then "Markdown" is not injection-safe
    And "BeanId", "BeanStatus", "RepoPath", "Url", "Branch" and "ChangeProposalNumber" are injection-safe

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::every_injection-safe_type_actually_refuses_metacharacters
  Scenario: Every injection-safe type refuses metacharacters
    Given every Tool type marked injection-safe
    When each parses "; rm -rf /", "$(whoami)", a backticked "id" and "a b"
    Then every parse fails

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::a_Tool_with_both_shell_and_MCP_arms_projects_on_its_shell_arm,_and_nothing_is_omitted
  Scenario: A Tool with both shell and MCP arms projects on its shell arm
    Given a Tool "shell-and-mcp" invoked by shell and by MCP tool "some_mcp_tool"
    When the Tools are projected
    Then the declarations include "shell_and_mcp"
    And there are no omissions

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::an_unmet_requirement_means_NOT_LISTED,_and_the_omission_is_reported
  Scenario: A Tool whose requirement is unmet is not listed and its omission is reported
    Given a Tool "needs-net" that requires network
    When the Tools are projected without network
    Then there are no declarations
    And the first omission's reason contains "requires network"
    And the Tool has an unmet requirement without network

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::a_manual-only_Tool_is_omitted,_and_says_why
  Scenario: A manual-only Tool is omitted, and its omission says why
    Given a Tool "by-hand" whose only invoke arm is manual
    When it is projected
    Then there are no declarations
    And there is exactly one omission, for "by-hand"
    And its reason contains "manual-only"
    And the real Tool "beans-manual", which declares both shell and manual, projects to exactly one declaration with no omission

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::the_real_Tool_set_projects,_and_every_declaration_has_a_schema
  Scenario: The real Tool set projects to well-formed declarations
    Given the real Tool set
    When it is projected with network and the "go" runtime
    Then there is at least one declaration
    And every declaration has a lowercase underscore name, a non-empty description and an input schema

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::a_repeated_flag_is_emitted_once_per_element,_never_comma-joined
  Scenario: A repeated flag is emitted once per element
    Given the real Tool "readme-sync"
    When its argv is built with only "folio:toc" and "folio:simulators" and check true
    Then the argv is "bun run cat readme:sync", "--check", "--only", "folio:toc", "--only", "folio:simulators"

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::a_repeated_positional_becomes_trailing_words
  Scenario: A repeated positional becomes trailing words
    Given the real Tool "stakeholder-map"
    When its argv is built with paths "src/a.ts" and "skills/folio-core/x.md"
    Then the argv is "bun run cat stakeholder-map", "src/a.ts", "skills/folio-core/x.md"

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::each_element_of_a_repeated_input_is_parsed_by_the_element_type
  Scenario: Each element of a repeated input is parsed by its type
    Given the real Tool "stakeholder-map"
    When its argv is built with paths including "../../etc/passwd" or "src/a.ts; rm -rf /"
    Then each build throws

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::a_repeated_input_given_a_scalar_is_an_error,_not_something_to_coerce
  Scenario: A repeated input given a scalar is refused
    Given the real Tool "stakeholder-map"
    When its argv is built with paths as the single string "src/a.ts"
    Then the build throws an error saying it "needs an array"

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::a_boolean_projects_to_the_presence_of_its_flag,_and_false_to_nothing
  Scenario: A boolean input is the presence or absence of its flag
    Given the real Tool "readme-audit"
    When its argv is built for file "README.md" with fetch true
    Then the argv is "bun run cat readme:audit", "README.md", "--fetch"
    And with fetch false the argv is "bun run cat readme:audit", "README.md"

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::an_in-process_Tool_says_so_rather_than_reading_as_a_broken_record
  Scenario: Building argv for an in-process Tool says it is in-process
    Given the real Tool "skill-fetch"
    When its argv is built
    Then the build throws an error mentioning "in-process"

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::the_migrated_MCP_surface_matches_what_the_server_actually_serves
  Scenario: The Tool nodes agree with the tools the MCP server serves
    Given the tools captured from the real MCP registrars, with no capture problems
    And the Tool nodes with both an MCP and an in-process arm, keyed by MCP tool name
    When each served tool is matched to its node
    Then every served tool has a node with the same module
    And every served input is declared on the node
    And every declared input is served, with the same required flag

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::an_invocation_records_who,_in_which_role,_at_which_task
  Scenario: An invocation record carries actor, role and task
    Given an invocation of the "beans" Tool for skill "todo-manager" by "authoring-agent" as "content-author" at task "Task_ReviewStaging"
    When it is recorded
    Then the record is valid against the invocation schema
    And it carries the actor, role and task given

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::recording_a_skill_the_Tool_does_not_satisfy_is_refused
  Scenario: Recording an invocation for a skill the Tool does not satisfy is refused
    Given an invocation of the "beans" Tool for skill "not-a-skill-it-satisfies"
    When it is recorded
    Then recording throws "does not satisfy"

  @test:scripts/tests/tools/mcp-project.test.ts::mcp_projection::a_refusal_without_a_reason_is_not_a_valid_record
  Scenario: A refused invocation needs a reason
    Given an invocation record with outcome "refused-permission"
    Then it is invalid without a reason
    And it is valid with reason "lacks admin-settings"
