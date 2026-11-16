# Specifies checkMethodologyEvidence (scripts/check-methodology-evidence.ts)
# over the cat-harness instance's real methodology corpus, smart-base's
# repository-scoped graph included.
Feature: Methodology evidence over the real corpus resolves, validates and counts correctly

  @test:test/coordinator/methodology-evidence-checkout.test.ts::the_real_corpus::finds_the_methodology_graph_at_all_—_undetermined_is_a_third_state
  Scenario: The methodology graph is found
    Given the methodology evidence report
    When it is read
    Then it is not undetermined
    And it counts at least one node

  @test:test/coordinator/methodology-evidence-checkout.test.ts::the_real_corpus::every_node_in_the_corpus_validates
  Scenario: Every node validates
    Given the methodology evidence report
    When its invalid nodes are read
    Then there are none

  @test:test/coordinator/methodology-evidence-checkout.test.ts::the_real_corpus::no_node_cites_an_`evidence`_that_resolves_nowhere
  Scenario: No node cites evidence that resolves nowhere
    Given the methodology evidence report
    When its unresolved evidence is read
    Then there is none

  @test:test/coordinator/methodology-evidence-checkout.test.ts::the_real_corpus::reaches_`diig`_in_the_repository-scoped_smart-base_graph,_not_just_the_harness's
  Scenario: The sweep reaches diig in smart-base's repository-scoped graph
    Given the methodology evidence report
    When the names of resolved and no-evidence nodes are collected
    Then they include "diig"

  @test:test/coordinator/methodology-evidence-checkout.test.ts::the_real_corpus::swot_is_backed_by_BOTH_its_sources,_and_each_is_really_on_disk
  Scenario: swot is backed by both its sources, each on disk
    Given the methodology evidence report
    When swot's resolved evidence is read
    Then it is exactly the two SWOT library entries
    And each resolved path exists

  @test:test/coordinator/methodology-evidence-checkout.test.ts::the_real_corpus::a_node_is_backed_only_when_EVERY_source_it_cites_resolves
  Scenario: A node is backed only when every source it cites resolves
    Given the methodology evidence report
    When the backed names are compared with the names with unresolved evidence
    Then no backed name has unresolved evidence
    And there are no more backed names than nodes

  @test:test/coordinator/methodology-evidence-checkout.test.ts::the_real_corpus::does_NOT_descend_into_a_methodology's_own_subgraph_directory
  Scenario: The sweep does not descend into a methodology's own subgraph directory
    Given every node in the report, resolved, without evidence, invalid or untagged
    When their node paths are read
    Then none lies inside a subdirectory of a methodologies directory
