# The MCP graph tools in adapters/mcp-server/tools/graph.ts (search_graph,
# get_neighbors, get_graph_stats, corpus_search) and their MCP registration in
# src/tools/graph.ts. Each Scenario names the test that executes it.
Feature: MCP graph tools over the folio and library roots

  @test:test/mcp-graph-tools.test.ts::dispatch::owns_exactly_the_four_declared_tools
  Scenario: The graph dispatcher owns exactly the four declared tools
    Given the declared graph tool names
    Then they are exactly "corpus_search", "get_graph_stats", "get_neighbors" and "search_graph"
    And each of them is recognised as a graph tool

  @test:test/mcp-graph-tools.test.ts::dispatch::returns_undefined_for_a_tool_it_does_not_own,_rather_than_guessing
  Scenario: A tool the dispatcher does not own returns undefined
    When "get_block" is executed through the graph dispatcher
    Then the result is undefined

  @test:test/mcp-graph-tools.test.ts::dispatch::every_handler_returns_parseable_JSON
  Scenario: Every graph tool handler returns parseable JSON
    Given a folio with three authored blocks and a library with one ingested block
    When each graph tool is called with query "x" and id "def:widget"
    Then each result parses as JSON without throwing

  @test:test/mcp-graph-tools.test.ts::search_graph::spans_both_populations_—_the_thing_search_blocks_cannot_do
  Scenario: search_graph spans both the authored and the ingested population
    Given a folio with three authored blocks and a library with one ingested block
    When search_graph is called with query "widget"
    Then the hits' provenances are "authored", "authored" and "ingested"

  @test:test/mcp-graph-tools.test.ts::search_graph::provenance_narrows_to_one_population
  Scenario: A provenance filter narrows search_graph to one population
    Given a folio with three authored blocks and a library with one ingested block
    When search_graph is called with query "widget" and provenance "ingested"
    Then there is exactly one hit

  @test:test/mcp-graph-tools.test.ts::search_graph::truncation_is_reported,_never_silent
  Scenario: A truncated search_graph result reports the total match count
    Given a folio with three authored blocks and a library with one ingested block
    When search_graph is called with query "widget" and limit 1
    Then there is exactly one hit
    And totalMatches is 3

  @test:test/mcp-graph-tools.test.ts::search_graph::a_missing_query_returns_an_empty_result_rather_than_everything
  Scenario: search_graph with no query returns no hits
    When search_graph is called with no query
    Then the hits are empty

  @test:test/mcp-graph-tools.test.ts::get_neighbors::resolves_an_authored_label,_not_just_an_@id
  Scenario: get_neighbors resolves an authored label to its @id
    When get_neighbors is called with id "thm:main"
    Then the seed is "papers/qou/blocks/thm-main"

  @test:test/mcp-graph-tools.test.ts::get_neighbors::direction_'in'_answers_what_breaks_if_this_changes
  Scenario: get_neighbors with direction "in" lists the blocks that depend on the seed
    Given "thm:main" uses "def:widget"
    When get_neighbors is called with id "def:widget" and direction "in"
    Then the only edge comes from "papers/qou/blocks/thm-main"

  @test:test/mcp-graph-tools.test.ts::get_neighbors::an_unknown_seed_is_an_error,_not_an_empty_neighbourhood
  Scenario: get_neighbors on an unknown seed returns an error
    When get_neighbors is called with id "def:nope"
    Then the error contains "No node"

  @test:test/mcp-graph-tools.test.ts::get_neighbors::an_unknown_edge_term_is_reported,_not_silently_dropped
  Scenario: get_neighbors reports an unknown edge term
    When get_neighbors is called on "thm:main" with edges "uses" and "bogus"
    Then the error contains "bogus"
    And the known edge terms include "uses"

  @test:test/mcp-graph-tools.test.ts::get_neighbors::a_valid_edge_filter_still_works
  Scenario: get_neighbors with a valid edge filter returns the matching edges
    When get_neighbors is called on "thm:main" with edges "uses"
    Then there is exactly one edge

  @test:test/mcp-graph-tools.test.ts::get_graph_stats::reports_both_roots_and_their_counts
  Scenario: get_graph_stats counts the nodes across both roots by provenance
    Given a folio with three authored blocks and a library with one ingested block
    When get_graph_stats is called
    Then it reports 4 nodes
    And byProvenance is 3 authored and 1 ingested

  @test:test/mcp-graph-tools.test.ts::get_graph_stats::an_absent_root_is_reported_absent,_so_'not_built'_differs_from_'no_match'
  Scenario: get_graph_stats reports an absent root as not present
    Given roots where the library directory does not exist
    When get_graph_stats is called with refresh
    Then the "library" root is reported with present false

  @test:test/mcp-graph-tools.test.ts::corpus_search::reaches_a_node_that_does_not_contain_the_query
  Scenario: corpus_search reaches a node that does not contain the query
    Given "cor:scaling" says nothing about widgets but uses "thm:main", which uses "def:widget"
    When corpus_search is called with query "widget" and hops 2
    Then the hits include "papers/qou/blocks/cor-scaling"
    And that hit's reason says it was reached by a hop

  @test:test/mcp-graph-tools.test.ts::corpus_search::hops:_0_is_exactly_search_graph
  Scenario: corpus_search with zero hops returns exactly the search_graph hits
    When corpus_search and search_graph are both called with query "widget", corpus_search with hops 0
    Then both return the same hit ids
    And corpus_search reports 0 expanded

  @test:test/mcp-graph-tools.test.ts::corpus_search::says_whether_a_hit_MATCHED_or_was_REACHED,_and_which_way_the_edge_ran
  Scenario: corpus_search says whether a hit matched or was reached, and in which edge direction
    When corpus_search is called with query "Widget theorem" and hops 1
    Then the reason for "thm:main" starts with "match:"
    And the reason for "def:widget" is "1hop via uses from papers/qou/blocks/thm-main"
    And the reason for "cor:scaling" is "1hop via ~uses from papers/qou/blocks/thm-main"

  @test:test/mcp-graph-tools.test.ts::corpus_search::splits_counts_by_provenance_rather_than_merging_them
  Scenario: corpus_search splits its seed counts by provenance
    When corpus_search is called with query "widget" and hops 0
    Then the summary counts 2 authored seeds and 1 ingested seed

  @test:test/mcp-graph-tools.test.ts::corpus_search::a_query_that_seeds_on_nothing_says_so,_rather_than_looking_like_an_absence
  Scenario: corpus_search flags a query that seeds on nothing
    When corpus_search is called with query "torsion" and hops 3
    Then the summary sets noSeeds to true
    And there are no hits

  @test:test/mcp-graph-tools.test.ts::served_over_MCP_(src/tools/graph.ts)::tools/list_carries_all_four_graph_tools
  Scenario: The MCP tools/list carries all four graph tools
    Given an MCP server with the graph tools registered, connected to a client over an in-memory transport
    When the client lists the tools
    Then every declared graph tool name is listed

  @test:test/mcp-graph-tools.test.ts::served_over_MCP_(src/tools/graph.ts)::tools/call_corpus_search_answers_over_the_folio_and_library_roots
  Scenario: An MCP call to corpus_search answers over the folio and library roots
    Given an MCP server with the graph tools registered, connected to a client over an in-memory transport
    When the client calls corpus_search with query "widget" and hops 0
    Then the result is not an error
    And its summary counts 2 authored seeds and 1 ingested seed

  @test:test/mcp-graph-tools.test.ts::served_over_MCP_(src/tools/graph.ts)::the_roots_are_the_declared_folio_and_library,_falling_back_to_the_convention
  Scenario: The graph roots of a tree are its folio and library directories
    # Gap: only the conventional fallback is exercised; a declared folio and library is not
    Given a tree with folio/ and library/ directories and no declaration
    When its graph roots are computed
    Then they are "folio" at folio/ and "library" at library/

  @test:test/mcp-graph-tools.test.ts::served_over_MCP_(src/tools/graph.ts)::an_unreadable_declaration_falls_back_to_the_convention_and_SAYS_so
  Scenario: An unreadable declaration falls back to the conventional roots with a note
    Given an instance declaration naming a directory with an unknown graph typology "no-such-typology"
    When its graph roots are resolved
    Then the roots are "folio" at folio/ and "library" at library/
    And the note contains "searched the conventional folio/ and library/"
