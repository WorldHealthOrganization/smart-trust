# tools/discover.ts loads every declared tools graph across a checkout's layers, and reports
# every way loading can fail rather than reading it as "no tools". Each Scenario names the test that executes it.
Feature: Tool auto-discovery

  @test:scripts/tests/tools/tools-discover.test.ts::discoverTools::merges_every_declared_tools_graph,_one_source_per_instance
  Scenario: Every declared tools graph is merged, with one source per instance
    Given a repo whose layer "alpha" declares Tools "a-one" and "a-two" and layer "beta" declares "b-one"
    When discoverTools runs over it
    Then there are no failures
    And the Tools are "a-one", "a-two" and "b-one"
    And the sources are "alpha" with 2 and "beta" with 1

  @test:scripts/tests/tools/tools-discover.test.ts::discoverTools::a_declared_graph_with_no_index.ts_is_a_failure,_not_zero_tools
  Scenario: A declared graph with no index.ts is a failure
    Given a repo with layer "alpha" declaring "a-one" and a layer "empty" with no tools index.ts
    When discoverTools runs over it
    Then the Tools are just "a-one"
    And there is one failure whose reason says "no index.ts"

  @test:scripts/tests/tools/tools-discover.test.ts::discoverTools::a_module_that_throws_on_load_is_a_failure_with_its_message
  Scenario: A module that throws on load is a failure carrying its message
    Given a layer whose tools index.ts throws "boom at load"
    When discoverTools runs over it
    Then the first failure's reason contains "boom at load"

  @test:scripts/tests/tools/tools-discover.test.ts::discoverTools::a_module_with_no_tools()_export_is_a_failure
  Scenario: A module with no tools() export is a failure
    Given a layer whose tools index.ts exports only "notTools"
    When discoverTools runs over it
    Then the first failure's reason says there is no "tools()"

  @test:scripts/tests/tools/tools-discover.test.ts::discoverTools::a_Tool_that_fails_its_schema_is_a_failure;_its_valid_siblings_still_load
  Scenario: A Tool failing its schema is a failure while its valid siblings load
    Given a layer whose tools() returns a valid "ok-tool" and an invalid object with id "no-good"
    When discoverTools runs over it
    Then the Tools are just "ok-tool"
    And the first failure's reason names "no-good"

  @test:scripts/tests/tools/tools-discover.test.ts::discoverTools::onlyInstance_scopes_discovery_to_one_instance's_own_graph
  Scenario: onlyInstance scopes discovery to one instance
    Given a repo with layers "alpha" and "beta" each declaring one Tool
    When discoverTools runs with onlyInstance set to the "beta" layer
    Then the Tools are just "b-one"
    And the only source is "beta"

  @test:scripts/tests/tools/tools-discover.test.ts::discoverTools::the_same_Tool_id_from_two_instances_is_a_failure_naming_the_first
  Scenario: The same Tool id from two instances is a failure naming the first
    Given layers "alpha" and "beta" both declaring a Tool "shared"
    When discoverTools runs over them
    Then one Tool is kept
    And the first failure's reason says "also declared by alpha"
