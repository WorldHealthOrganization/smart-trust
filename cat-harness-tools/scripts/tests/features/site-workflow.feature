# site:workflow runs the repository's own publish path, read from its
# index.config.json. Each Scenario names the test that executes it.
Feature: Site workflow route

  @test:scripts/tests/site-workflow.test.ts::siteRoute::an_agent-run_repository_publishes_through_stage-local
  Scenario: An agent-run repository publishes through stage-local
    Given an index config with site.agentRun true
    When the publish route is read
    Then it is "agent-run", running stage-local.ts with --main

  @test:scripts/tests/site-workflow.test.ts::siteRoute::a_repository_with_no_index_config_is_undeclared,_not_guessed
  Scenario: A repository with no index config is undeclared
    When the stage route of a directory with no index config is read
    Then it is "undeclared"

  @test:scripts/tests/site-workflow.test.ts::siteRoute::no_declaration_is_undeclared,_and_not_a_check:tools_finding
  Scenario: No site declaration is undeclared and not a finding
    Given an index config with no site section and a docs-site.yml workflow
    Then the publish route is "undeclared"
    And no site workflow is reported missing

  @test:scripts/tests/site-workflow.test.ts::workflowInputs::passes_other_flags_as_workflow_inputs,_dash_read_as_underscore
  Scenario: Other flags become workflow inputs
    When the inputs are read from --repo, --branch, --cleanup-slug and --check
    Then the inputs are only cleanup_slug "x"
