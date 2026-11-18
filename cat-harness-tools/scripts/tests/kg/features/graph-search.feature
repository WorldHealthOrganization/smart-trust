# pipeline/graph-search.ts seeds a search lexically over the graph index, then expands it along
# graph edges and reports why each hit was reached. Each Scenario names the test that executes it.
Feature: Graph-aware search over the graph index

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::hops:_0_reproduces_a_pure_lexical_search
  Scenario: Zero hops reproduces a pure lexical search
    Given an authored "def:widget" and an ingested recommendation that both mention "widget"
    When the graph is searched for "widget" with 0 hops
    Then no node is expanded
    And every hit was reached by a match
    And there are 2 seeds

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::expansion_reaches_a_node_that_does_NOT_contain_the_query
  Scenario: Expansion reaches a node that does not contain the query
    Given "thm:main" never says "widget" but uses "def:widget"
    When the graph is searched for "widget" with 1 hop in both directions
    Then the hits include "b/thm-main"
    And it was reached through the graph from the seed "b/def-widget" at 1 hop

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::a_backwards-traversed_edge_keeps_its_path_and_is_marked_reversed
  Scenario: A backwards-traversed edge keeps its path and is marked reversed
    Given "thm:main" uses the seed "def:widget", so the edge is incoming from the seed
    When the graph is searched for "widget" with 1 hop in both directions
    Then "b/thm-main" was reached through the graph with the path "uses" in direction "in"
    And the path renders as "~uses"

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::direction_distinguishes_who_depends_on_whom
  Scenario: Direction distinguishes who depends on whom
    Given the seed "thm:main" uses "def:widget"
    When the graph is searched for "Main theorem" with 1 hop in both directions
    Then "b/def-widget" was reached through the graph with the path "uses" in direction "out"
    And the path renders as "uses"

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::hop_depth_is_respected
  Scenario: Hop depth is respected
    Given "cor:far" uses "thm:main", which uses "def:widget"
    When the graph is searched for "widget" with 1 hop and with 2 hops, in both directions
    Then the 1-hop hits do not include "b/cor-far"
    And the 2-hop hits do

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::a_seed_is_never_demoted_to_an_expansion
  Scenario: A seed is never demoted to an expansion
    Given "def:widget" matches "widget" and is also reachable from other nodes
    When the graph is searched for "widget" with 2 hops in both directions
    Then "b/def-widget" is reported as reached by a match

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::seeds_sort_before_graph-reached_nodes
  Scenario: Seeds sort before graph-reached nodes
    Given the fixture graph
    When the graph is searched for "widget" with 2 hops in both directions
    Then the last match-reached hit comes before the first graph-reached hit

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::provenance_is_reported_split,_not_merged
  Scenario: Seed provenance is reported split, not merged
    Given one authored and one ingested node mention "widget"
    When the graph is searched for "widget" with 1 hop
    Then the summary counts 1 authored seed and 1 ingested seed

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::a_present-but-empty_root_is_reported,_not_silently_zero
  Scenario: A present-but-empty root is reported, not silently zero
    Given folio and library root directories that exist but hold no nodes
    When the graph is searched for "anything"
    Then there are no hits
    And the empty roots reported are "folio" and "library"

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::a_populated_index_reports_no_empty_roots
  Scenario: A populated index reports no empty roots
    Given the populated fixture index
    When the graph is searched for "widget"
    Then no empty roots are reported

  @test:scripts/tests/kg/graph-search.test.ts::graphSearch::no_lexical_seed_means_no_expansion_—_the_graph_cannot_rescue_a_miss
  Scenario: No lexical seed means no expansion
    Given no node mentions "torsion"
    When the graph is searched for "torsion" with 3 hops
    Then the summary says there were no seeds
    And there are no hits
