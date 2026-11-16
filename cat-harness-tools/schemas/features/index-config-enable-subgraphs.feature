# schemas/kg/index-config.ts parses and formats index.config.json; an index's enableSubgraphs
# must survive every rewrite through formatIndexConfig. Each Scenario names the test that executes it.
Feature: An index's enabled sub-graphs

  @test:schemas/index-config-enable-subgraphs.test.ts::an_index's_enabled_sub-graphs::survive_formatIndexConfig,_and_are_absent_when_not_declared
  Scenario: Enabled sub-graphs survive formatting and are absent when not declared
    Given an index config enabling "cat-harness.sdlc" and "cat-harness.work-plan"
    When it is parsed and formatted with formatIndexConfig
    Then the formatted JSON keeps both enabled sub-graphs in order
    And an index config that declares none formats with no enableSubgraphs key

  @test:schemas/index-config-enable-subgraphs.test.ts::an_index's_enabled_sub-graphs::a_formatted_index_parses_again,_unchanged
  Scenario: A formatted index config parses and formats again unchanged
    Given an index config enabling "cat-harness.sdlc", formatted once
    When the formatted text is parsed and formatted again
    Then the second formatting is identical to the first
