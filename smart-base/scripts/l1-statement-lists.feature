Feature: L1 statement lists
  The statements of each L1 source and each scenario graph, listed with the
  library entry and page they came from.

  @test:smart-base/scripts/l1-statement-lists.test.ts::where_an_L1_source_came_from::reads_graph.source.entry,_else_the_library/<id>/_its_paths_name,_else_nothing
  Scenario: an L1 source's library entry is its graph.source.entry, else the library id its paths name, else nothing
    Then a source entry "library/unepi-deck" gives "unepi-deck"
    And a source pdf "library/wer-92-17/WER9217.pdf" gives "wer-92-17"
    And a source pdf "uploads/x.pdf" gives no entry
    And a document with no graph gives no entry

  @test:smart-base/scripts/l1-statement-lists.test.ts::where_an_L1_source_came_from::takes_a_row's_first_page
  Scenario: a row's page is its first page
    Then "220–221" gives 220, 7 gives 7, and "" gives no page

  @test:smart-base/scripts/l1-statement-lists.test.ts::where_an_L1_source_came_from::parses_a_scenario's_evidence_location
  Scenario: a scenario's evidence location is parsed into file, key and page
    Then "a/b.l1.yaml#C01 (p210)" gives file "a/b.l1.yaml", key "C01" and page 210
    And "a/b.yaml#K" gives file "a/b.yaml" and key "K" with no page
    And "not a location" gives nothing

  @test:smart-base/scripts/l1-statement-lists.test.ts::statements::are_the_rows_verbatim,_one_line,_with_entry_and_page
  Scenario: recommendation statements are the rows verbatim on one line, with entry and page
    Given recommendation R1 on page "3" with a statement broken over two lines, and R2 with no statement
    When the recommendations of library entry "deck" are listed
    Then the only statement is R1, "Give dose 1.", a recommendation from "deck" page 3

  @test:smart-base/scripts/l1-statement-lists.test.ts::statements::skip_a_node_citing_a_file_that_is_not_an_L1_source,_and_report_one_naming_no_entry
  Scenario: scenario statements skip a node citing a non-L1 file and report one whose file names no entry
    Given a scenario citing an L1 source of entry "deck", a persona citing a mapping file that is not an L1 source, and a scenario citing a file that resolves to no entry
    When the scenario statements are listed
    Then the only statement is the first scenario, derived from R1
    And exactly one node is reported unresolved

  @test:smart-base/scripts/l1-statement-lists.test.ts::a_directory::yields_one_list_per_L1_source_and_per_scenario_graph
  Scenario: a directory yields one list per L1 source and per scenario graph
    Given a directory with an L1 source "src.l1.yaml" and a scenario-candidates graph under candidates/
    When its lists are built
    Then there are no problems
    And the lists are "src.recommendations.json" and "<directory>-scenario-candidates.scenarios.json"

  @test:smart-base/scripts/l1-statement-lists.test.ts::list_names::name_a_candidates/<source>/_graph_after_its_source,_and_a_<x>/candidates/_graph_after_<x>
  Scenario: a scenario list is named after its source or its parent directory
    When the list name of uganda/candidates/unepi-deck/scenario-candidates.l2.json is asked for
    Then it is unepi-deck
    When the list name of measles/candidates/scenario-candidates.l2.json is asked for
    Then it is measles-scenario-candidates
    When the list name of x/graph.l2.json is asked for
    Then it is graph

  @test:smart-base/scripts/l1-statement-lists.test.ts::list_names::keep_two_sources'_scenario_lists_apart_(the_Uganda_layout),_and_refuse_a_name_two_inputs_share
  Scenario: two sources' scenario lists are kept apart, and a shared name is refused
    Given L1 files poster.l1.yaml and deck.l1.yaml, each with a candidates/<source>/scenario-candidates.l2.json
    When the statement lists are built
    Then there are no problems, and poster.scenarios.json and deck.scenarios.json each cite their own library source
    When a second graph under more/candidates/deck/ would also be named deck.scenarios.json
    Then a problem naming deck.scenarios.json is reported, instead of the first list being overwritten
