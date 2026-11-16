# schemas/sdlc/bean-graph.ts parses a bean graph whose directories declare an array of graph typologies,
# and src/workflow/store.ts saves workflow instances tagged with their $schema.
# Each Scenario names the test that executes it.
Feature: Bean graph typologies and self-declaring files

  @test:scripts/tests/bean-graph-typologies.test.ts::a_node's_`kinds`_is_an_array::one_directory_may_declare_several_kinds
  Scenario: One directory may declare several typologies
    Given a bean graph with directory "all" declaring "bean-defs" and "workflow-state"
    When it is parsed
    Then the directory's typologies are "bean-defs" and "workflow-state"
    And the node of kind "bean-defs" is "all"
    And the node of kind "workflow-state" is "all"

  @test:scripts/tests/bean-graph-typologies.test.ts::a_node's_`kinds`_is_an_array::an_empty_kinds_array_is_refused
  Scenario: An empty typologies array is refused
    Given a bean graph with a directory declaring no typologies
    When it is parsed
    Then parsing fails

  @test:scripts/tests/bean-graph-typologies.test.ts::a_node's_`kinds`_is_an_array::an_unknown_kind_is_refused,_not_accepted_and_ignored
  Scenario: An unknown typology is refused
    Given a bean graph with a directory declaring typology "nonsense"
    When it is parsed
    Then parsing fails

  @test:scripts/tests/bean-graph-typologies.test.ts::a_node's_`kinds`_is_an_array::workflow-state_stays_limited_to_ONE_node_even_as_an_array_member
  Scenario: Only one directory may hold workflow-state
    Given a bean graph where directory "a" declares "bean-defs" and "workflow-state" and directory "b" declares "workflow-state"
    When it is parsed
    Then parsing fails with an error naming "workflow-state"

  @test:scripts/tests/bean-graph-typologies.test.ts::a_node's_`kinds`_is_an_array::the_documented_default_parses_as_its_own_schema
  Scenario: The documented default bean graph parses as its own schema
    Given the default bean graph
    When it is parsed
    Then parsing succeeds

  @test:scripts/tests/bean-graph-typologies.test.ts::the_files_declare_what_they_are_—_that_is_what_makes_the_array_safe::a_saved_workflow_instance_carries_$schema
  Scenario: A saved workflow instance carries $schema
    Given a running workflow instance "i1"
    When it is saved
    Then the saved file's $schema is the instance schema

  @test:scripts/tests/bean-graph-typologies.test.ts::the_files_declare_what_they_are_—_that_is_what_makes_the_array_safe::a_file_written_before_the_tag_existed_still_loads
  Scenario: An instance saved without $schema still loads and comes back tagged
    # Gap: the fixture is written through saveInstance, not as a raw untagged file on disk
    Given a running workflow instance "i2" with no $schema field
    When it is saved and loaded back
    Then the loaded instance has id "i2"
    And its $schema is the instance schema
