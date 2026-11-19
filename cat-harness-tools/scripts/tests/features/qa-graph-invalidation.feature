# Detangler verdicts read the whole uses[] graph, so they carry a "graph"
# freshness key that changes only when an edge does. Each Scenario names the
# test that executes it.
Feature: Graph-scoped QA verdicts go stale when the uses graph changes

  @test:scripts/tests/qa-graph-invalidation.test.ts::usesGraphHash::changes_when_an_edge_is_added_or_removed
  Scenario: The uses-graph hash changes when an edge is added
    Given a chapter where "one" uses "rem:two", and one where it also uses "rem:three"
    Then their uses-graph hashes differ

  @test:scripts/tests/qa-graph-invalidation.test.ts::usesGraphHash::is_stable_when_a_manifest_changes_but_uses[]_does_not
  Scenario: The uses-graph hash is stable when a manifest changes but its uses do not
    Given a chapter where "one" uses "rem:two"
    When a comment is added to one.ts without changing its uses
    Then the uses-graph hash is unchanged

  @test:scripts/tests/qa-graph-invalidation.test.ts::usesGraphHash::is_independent_of_block_ordering
  Scenario: The uses-graph hash is independent of block ordering
    Given the same two blocks written in either order
    Then their uses-graph hashes are equal

  @test:scripts/tests/qa-graph-invalidation.test.ts::graph-scoped_criteria::every_detangler_criterion_is_graph-scoped
  Scenario: Every detangler criterion is graph-scoped
    Given every registered detangler criterion and the fenced archimedean-wall ones
    Then there is at least one
    And each is in the registry and its freshness keys include "graph"

  @test:scripts/tests/qa-graph-invalidation.test.ts::graph-scoped_criteria::a_non-detangler_criterion_is_NOT_graph-scoped
  Scenario: A non-detangler criterion is not graph-scoped
    Then the freshness keys of "voice-ai-slop" do not include "graph"

  @test:scripts/tests/qa-graph-invalidation.test.ts::entryIsFresh_with_a_graph_key::a_changed_graph_makes_the_entry_stale
  Scenario: A changed graph makes the entry stale
    Given an entry recorded with graph "111111111111" and the current graph "999999999999", md and ts unchanged
    Then it is stale by md, ts and graph

  @test:scripts/tests/qa-graph-invalidation.test.ts::entryIsFresh_with_a_graph_key::an_unchanged_graph_leaves_it_fresh
  Scenario: An unchanged graph leaves the entry fresh
    Given an entry recorded with the current graph, md and ts
    Then it is fresh by md, ts and graph

  @test:scripts/tests/qa-graph-invalidation.test.ts::entryIsFresh_with_a_graph_key::an_entry_predating_the_graph_key_is_stale_once_a_graph_hash_exists
  Scenario: An entry predating the graph key is stale once a graph hash exists
    Given an entry recorded without a graph hash, and a current graph hash
    Then it is stale by md, ts and graph
