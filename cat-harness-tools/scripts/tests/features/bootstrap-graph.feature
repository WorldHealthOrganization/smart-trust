# bootstrap-tools' scripts/export-graph.ts publishes the bootstrap graph; these
# Scenarios read its export against the disk and against GraphExportSchema.
# Each Scenario names the test that executes it.
Feature: The bootstrap graph export agrees with the disk

  @test:scripts/tests/bootstrap-graph.test.ts::what_it_contains,_read_against_the_disk::every_skill_bootstrap_holds_is_in_the_graph
  Scenario: Every skill file in bootstrap/skills is a Skill node in the graph
    Given the repository's bootstrap/ directory
    When the graph is exported and its bootstrap:Skill node ids are collected
    Then they equal the names of the skill .md files read directly from bootstrap/skills/

  @test:scripts/tests/bootstrap-graph.test.ts::what_it_contains,_read_against_the_disk::bootstrap_publishes_only_the_graph_typologies_it_DECLARES
  Scenario: Bootstrap publishes only graph typologies its declaration lists
    Given the graph typologies declared in bootstrap's own declaration file
    When the graph is exported and the types of its bootstrap:Subgraph nodes are collected
    Then at least one subgraph type is published
    And every published type is among the declared typologies

  @test:scripts/tests/bootstrap-graph.test.ts::what_it_contains,_read_against_the_disk::bootstrap's_process_IS_in_the_graph,_with_its_flows_and_lanes
  Scenario: Bootstrap's processes are in the graph with nodes, flows and roles
    Given the BPMN process ids drawn in bootstrap/processes/
    When the graph is exported
    Then its bootstrap:Process ids equal the process ids on disk
    And it counts at least one ProcessNode, one SequenceFlow and one Role
    And no reported problem mentions "bpmn"

  @test:scripts/tests/bootstrap-graph.test.ts::the_document_has_a_schema,_and_the_published_build_satisfies_it_(bean_n350)::the_published_document_—_bootstrap-tools'_export-graph,_the_one_publisher_—_parses
  Scenario: The published bootstrap graph document parses against GraphExportSchema
    Given the bootstrap graph exported with provenance
    When it is parsed with GraphExportSchema
    Then there are no issues

  @test:scripts/tests/bootstrap-graph.test.ts::the_document_has_a_schema,_and_the_published_build_satisfies_it_(bean_n350)::the_two_emission_skills_are_in_bootstrap's_skills_package
  Scenario: The two emission skills are listed in bootstrap's skills package
    Given bootstrap/skills/package-manifest.json
    When its skills list is read
    Then it contains "bootstrap-graph-emission" and "bootstrap-graph-publication"
