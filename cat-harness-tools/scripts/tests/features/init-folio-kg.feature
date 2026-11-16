# scripts/init-folio.ts writes the starter block's knowledge-graph node (.jsonld), so a new folio publishes a graph from its first commit.
# Each Scenario names the test that executes it.
Feature: A new folio's blocks are KG nodes from the first commit

  @test:scripts/tests/init-folio-kg.test.ts::a_new_folio's_blocks_are_KG_nodes_from_the_first_commit::the_starter_block's_.jsonld_is_written,_and_gen-block-jsonld_--check_finds_it_current
  Scenario: The starter block's .jsonld is written and the generator finds it current
    Given a document folio "kg-doc" scaffolded by initFolio in a temp repo, with the platform linked as a sibling
    When folio/kg-doc/introduction/overview.jsonld is read
    Then its label is "prose:overview" and its text is "overview.md"
    And running pipeline/gen-block-jsonld.ts --check in the folio reports "1 sibling(s) up to date"
    And the check exits with status 0
