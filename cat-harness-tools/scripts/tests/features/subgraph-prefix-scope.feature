# prefixesInScope answers from the declarations, not from what else is
# checked out beside the layer. Each Scenario names the test that executes it.
Feature: Prefixes in scope of a subgraph

  Background:
    Given cat-harness declaring needs bootstrap and nonesuch, alone in its own git checkout
    And the same declaration in a checkout that also holds bootstrap

  @test:scripts/tests/subgraph-prefix-scope.test.ts::prefixesInScope_with_a_needed_instance_absent_from_the_checkout::bootstrap_is_own-prefixed,_so_the_fixture_means_something
  Scenario: bootstrap has an own prefix
    Then the own-prefix table has bootstrap

  @test:scripts/tests/subgraph-prefix-scope.test.ts::prefixesInScope_with_a_needed_instance_absent_from_the_checkout::the_needed_instance's_prefix_is_still_in_scope
  Scenario: The needed prefix is in scope without the layer
    Then the prefixes in scope of the lone checkout are bootstrap and cat-harness

  @test:scripts/tests/subgraph-prefix-scope.test.ts::prefixesInScope_with_a_needed_instance_absent_from_the_checkout::the_reach_is_the_same_as_when_the_checkout_holds_it
  Scenario: The reach is the same either way
    Then the composed checkout's prefixes are bootstrap and cat-harness
    And the lone checkout's equal them

  @test:scripts/tests/subgraph-prefix-scope.test.ts::prefixesInScope_with_a_needed_instance_absent_from_the_checkout::a_needs_name_that_is_neither_here_nor_an_own_prefix_binds_nothing
  Scenario: An unknown needs name binds nothing
    Then nonesuch is not in the lone checkout's prefixes

  @test:scripts/tests/subgraph-prefix-scope.test.ts::prefixesInScope_with_a_needed_instance_absent_from_the_checkout::the_subgraph_context_is_byte-identical_either_way,_and_binds_bootstrap
  Scenario: The subgraph context is the same either way
    Then both checkouts' subgraph contexts serialise identically
    And the context binds bootstrap to its own-prefix IRI
