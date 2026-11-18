# pipeline/graph-index.ts loads authored blocks and ingested library nodes from their .jsonld files
# into one graph index, and answers search and neighbour queries over it. Each Scenario names the test that executes it.
Feature: One graph index over authored and ingested nodes

  @test:scripts/tests/kg/graph-index.test.ts::edge_term_contract::every_graph_edge_term_is_@id-typed_in_the_published_context
  Scenario: Every graph edge term is @id-typed in the published JSON-LD context
    Given the published JSON-LD context and the graph edge terms
    When the edge terms are checked against the context
    Then the check does not throw

  @test:scripts/tests/kg/graph-index.test.ts::edge_term_contract::companion_file_links_are_not_traversable_edges
  Scenario: Companion file links are not graph edge terms
    Given the list of graph edge terms
    Then it does not contain "text"
    And it does not contain "leanSource"

  @test:scripts/tests/kg/graph-index.test.ts::loading_both_populations::one_walk_picks_up_authored_and_ingested_nodes_alike
  Scenario: One load picks up authored and ingested nodes alike
    Given three authored block nodes under folio and two ingested nodes under library
    When the graph index is loaded from the default roots
    Then it holds 5 nodes
    And the stats count 3 authored and 2 ingested by provenance

  @test:scripts/tests/kg/graph-index.test.ts::loading_both_populations::a_document_without_@id_is_skipped,_not_treated_as_malformed
  Scenario: A document without @id is skipped, not reported as malformed
    Given a manifest .jsonld under library with no @id
    When the graph index is loaded
    Then the malformed list is empty

  @test:scripts/tests/kg/graph-index.test.ts::loading_both_populations::companion_.md_is_resolved_relative_to_the_.jsonld
  Scenario: A companion .md is resolved next to its .jsonld
    Given the node "def:widget" declares text "def-widget.md" beside its .jsonld
    When the node is looked up by label
    Then its text file path ends with "def-widget.md"

  @test:scripts/tests/kg/graph-index.test.ts::loading_both_populations::nodes_resolve_by_@id_and_by_authored_label
  Scenario: Nodes resolve by @id and by authored label
    Given the loaded graph index
    When "papers/qou/blocks/thm-main" is looked up
    Then the node's label is "thm:main"
    And looking up "thm:main" gives the id "papers/qou/blocks/thm-main"

  @test:scripts/tests/kg/graph-index.test.ts::honest_emptiness::an_absent_root_is_reported_as_absent,_not_as_empty
  Scenario: An absent root is reported as absent, not as empty
    Given a folio root that exists and a library root pointing at a missing directory
    When the graph index is loaded from those roots
    Then the library root is marked not present
    And it has 0 nodes

  @test:scripts/tests/kg/graph-index.test.ts::honest_emptiness::a_colliding_@id_is_recorded_rather_than_silently_overwritten
  Scenario: A colliding @id is recorded as malformed rather than silently overwritten
    Given two .jsonld files that both claim the @id "same/id"
    When the graph index is loaded
    Then it holds 1 node
    And exactly one malformed entry is recorded, its error containing "already claimed"

  @test:scripts/tests/kg/graph-index.test.ts::search::matches_metadata_across_both_populations
  Scenario: Search matches metadata across both populations
    Given the loaded graph index
    When it is searched for "widget"
    Then the hits are the ingested "library/who-anc-2016/nodes/rec-007" and the authored "papers/qou/blocks/def-widget"

  @test:scripts/tests/kg/graph-index.test.ts::search::provenance_filter_separates_the_populations
  Scenario: The provenance filter separates the populations
    Given the loaded graph index
    When it is searched for "widget" filtered to ingested provenance
    Then there is 1 hit
    And searching filtered to authored provenance also gives 1 hit

  @test:scripts/tests/kg/graph-index.test.ts::search::reports_which_field_matched
  Scenario: Search reports which field matched
    Given the loaded graph index
    When it is searched for "Main theorem"
    Then the first hit's matched field is "title"

  @test:scripts/tests/kg/graph-index.test.ts::search::body_text_is_only_searched_when_asked,_and_yields_a_snippet
  Scenario: Body text is searched only when asked, and yields a snippet
    Given the companion text of "def:widget" contains "torsion" and no metadata does
    When it is searched for "torsion" without text search
    Then there are no hits
    And with text search on there is 1 hit, matched in "text", with a snippet containing "torsion"
    And the count of text files scanned is above 0

  @test:scripts/tests/kg/graph-index.test.ts::search::truncation_is_visible_—_totalMatches_exceeds_the_returned_hits
  Scenario: Truncation is visible as totalMatches above the returned hits
    Given the loaded graph index
    When it is searched for "e" with a limit of 1
    Then 1 hit is returned
    And the total match count is greater than 1

  @test:scripts/tests/kg/graph-index.test.ts::search::the_text-scan_cap_reports_itself_rather_than_quietly_stopping
  Scenario: The text-scan cap reports itself rather than quietly stopping
    Given the loaded graph index
    When it is searched for "torsion" with text search on and at most 0 text files
    Then the result says the text scan was truncated
    And there are no hits

  @test:scripts/tests/kg/graph-index.test.ts::neighbors::outbound_follows_dependencies
  Scenario: Outbound neighbours follow dependencies
    Given "thm:main" uses "def-widget"
    When the neighbours of "thm:main" are asked for
    Then the edge targets include "papers/qou/blocks/def-widget"

  @test:scripts/tests/kg/graph-index.test.ts::neighbors::inbound_answers_'what_breaks_if_this_changes?'
  Scenario: Inbound neighbours answer what breaks if a node changes
    Given "thm:main" uses "def:widget"
    When the inbound neighbours of "def:widget" are asked for
    Then the edge sources are exactly "papers/qou/blocks/thm-main"

  @test:scripts/tests/kg/graph-index.test.ts::neighbors::multi-hop_inbound_reaches_a_transitive_dependent
  Scenario: Multi-hop inbound traversal reaches a transitive dependent
    Given "cor:easy" uses "thm:main", which uses "def:widget"
    When the inbound neighbours of "def:widget" are asked for with 2 hops
    Then the nodes are "cor-easy", "def-widget" and "thm-main" under papers/qou/blocks

  @test:scripts/tests/kg/graph-index.test.ts::neighbors::an_edge_to_a_missing_node_is_reported_as_dangling,_not_dropped
  Scenario: An edge to a missing node is reported as dangling, not dropped
    Given "thm:main" also uses "papers/qou/blocks/def-missing", which has no node
    When the neighbours of "thm:main" are asked for
    Then the dangling list is exactly "papers/qou/blocks/def-missing"

  @test:scripts/tests/kg/graph-index.test.ts::neighbors::traverses_ingested_containment_with_the_same_call
  Scenario: Ingested containment is traversed with the same call
    Given the ingested node "rec-007" contains "rem-014"
    When the neighbours of "library/who-anc-2016/nodes/rec-007" are asked for
    Then the only edge runs from rec-007 to rem-014 over "contains" at hop 1

  @test:scripts/tests/kg/graph-index.test.ts::neighbors::edge_filter_restricts_traversal
  Scenario: An edge filter restricts traversal
    Given "thm:main" has only "uses" edges
    When its neighbours are asked for restricted to "cites" edges
    Then there are no edges

  @test:scripts/tests/kg/graph-index.test.ts::neighbors::an_unknown_seed_is_an_error,_not_an_empty_neighbourhood
  Scenario: An unknown seed is an error, not an empty neighbourhood
    Given no node "def:nope"
    When its neighbours are asked for
    Then the result is the error 'No node for "def:nope"'

  @test:scripts/tests/kg/graph-index.test.ts::neighbors::node_cap_reports_truncation
  Scenario: The node cap reports truncation
    Given the loaded graph index
    When the inbound neighbours of "def:widget" are asked for with 3 hops and at most 1 node
    Then the result is marked truncated

  @test:scripts/tests/kg/graph-index.test.ts::parseNode::returns_undefined_for_a_document_with_no_@id
  Scenario: A document with no @id parses to nothing
    Given a JSON document with a title and no @id
    When it is parsed as a node
    Then the result is undefined

  @test:scripts/tests/kg/graph-index.test.ts::parseNode::accepts_a_single_string_where_a_set_is_allowed
  Scenario: A single string is accepted where a set is allowed
    Given a document whose "uses" is the string "b" and whose @type is a single string
    When it is parsed as a node
    Then its "uses" edges are ["b"]
    And its types are ["folio-assistant-core:Theorem"]
