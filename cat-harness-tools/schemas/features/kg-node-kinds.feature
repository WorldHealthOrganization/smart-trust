# KgRef.kind in schemas/kg/carried-note.ts is a closed list that must cover every node kind
# scripts/kg-export.ts mints an IRI for (#1168 B9c). Each Scenario names the test that executes it.
Feature: KgRef kinds cover the exported graph

  @test:schemas/kg-node-kinds.test.ts::KgRef.kind_is_closed,_and_covers_the_graph::every_kind_kg-export_mints_an_IRI_for_is_a_KG_NODE_KIND
  Scenario: Every kind kg-export mints an IRI for is a KG node kind
    Given the source of scripts/kg-export.ts
    When the kinds passed to makeIri are collected
    Then more than 5 distinct kinds are found
    And every one is in KG_NODE_KINDS

  @test:schemas/kg-node-kinds.test.ts::KgRef.kind_is_closed,_and_covers_the_graph::a_typo_does_not_parse
  Scenario: A misspelled kind does not parse
    Then a KgRef of kind "skill" parses
    And a KgRef of kind "skil" is refused
