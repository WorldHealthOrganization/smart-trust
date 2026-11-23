# `sweepFamilies` in `scripts/check-kind-validators.ts` does not read a graph's own declaration
# file (the kind's `declarationFile`, e.g. `todos/todos.json`) as one of its nodes (dth-sfp#13),
# while a real node with an unmapped `$schema` beside it is still reported.
# Each Scenario names the test that executes it.
Feature: Kind validators and a graph's own declaration file

  @test:scripts/tests/kind-validators-declaration-file.test.ts::check:kind-validators_and_a_graph's_own_declaration_file::todos/todos.json_with_the_bootstrap_graph_$schema_is_not_an_unmapped_todos_family
  Scenario: The todos declaration file with the bootstrap graph $schema is not an unmapped family
    Given an instance declaring "todos/" as todos
    And "todos/todos.json" carrying the bootstrap graph schema as its $schema
    When the families are swept
    Then todos reports no unmapped family

  @test:scripts/tests/kind-validators-declaration-file.test.ts::check:kind-validators_and_a_graph's_own_declaration_file::a_node_beside_it_with_an_unmapped_$schema_is_still_reported
  Scenario: A node beside it with an unmapped $schema is still reported
    Given the same instance
    And "todos/stray.json" carrying "no-such-family/v1"
    When the families are swept
    Then todos reports "no-such-family/v1" as unmapped
