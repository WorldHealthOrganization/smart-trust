# scripts/gen-uml-overview.ts writes one .puml/.mmd pair per declared directory and
# sub-subgraph, and its umlOrphans names what it would no longer write so a retired
# layer's UML pages are removed. Each Scenario names the test that executes it.
Feature: UML overview orphans and sub-subgraph pairs

  @test:scripts/tests/ui/uml-overview-orphans.test.ts::umlOrphans_(ghgn)::a_retired_instance's_page,_diagram_and_picture_are_orphans
  Scenario: A retired instance's page, diagram and picture are orphans
    Given this run writes the cat-harness overview diagram, page and SVG
    And the tree also holds a "detangle" page, .puml diagram and SVG
    When the orphans are listed
    Then they are exactly the three "detangle" files, in order

  @test:scripts/tests/ui/uml-overview-orphans.test.ts::umlOrphans_(ghgn)::what_this_run_writes_is_never_an_orphan
  Scenario: What this run writes is never an orphan
    Given the tree holds only the files this run writes and its SVGs
    When the orphans are listed
    Then there are none

  @test:scripts/tests/ui/uml-overview-orphans.test.ts::umlOrphans_(ghgn)::a_file_of_a_kind_the_generator_does_not_write_is_left_alone
  Scenario: A file of a kind the generator does not write is left alone
    Given the tree holds "docs/uml/overview/notes.txt" and "uml/overview/.gitkeep"
    When the orphans are listed
    Then there are none

  @test:scripts/tests/ui/uml-overview-orphans.test.ts::umlOrphans_(ghgn)::a_declared_directory's_README_is_readme:subgraphs'_output,_never_an_orphan_(PR_#2094)
  Scenario: A declared directory's README is never a UML orphan
    Given the tree also holds "docs/uml/overview/README.md" and "img/uml/overview/README.md"
    When the orphans are listed
    Then there are none

  @test:scripts/tests/ui/uml-overview-orphans.test.ts::declared_vs_undeclared_sub-subgraphs_(f8wp_falsifier_3)::emits_one_.puml/.mmd_pair_per_declared_sub-subgraph_and_none_for_an_undeclared_one
  Scenario: Only declared sub-subgraphs get a .puml/.mmd pair
    Given a "demo" layer whose "schemas" directory declares the sub-subgraph "sub-declared"
    And a schema file under both "declared/" and an undeclared "undeclared/" directory
    When its sections are read and its overview files are generated
    Then the sections are "schemas" and "sub-declared"
    And the demo diagrams are demo, demo/schemas and demo/sub-declared, each as .mmd and .puml
    And no diagram is written for "undeclared" or for the "kg" concern group
    And an undeclared .puml/.mmd pair left on disk is listed as orphans

  @test:scripts/tests/ui/uml-overview-orphans.test.ts::declared_vs_undeclared_sub-subgraphs_(f8wp_falsifier_3)::cat-harness-tools_resolves_schemas/schemas.json_as_concern-groups/v1
  Scenario: cat-harness-tools resolves schemas/schemas.json as concern-groups/v1
    Given the cat-harness-tools repository
    When its UML sections are read
    Then there is one section per declared directory, in order
    And the "cat-harness-tools-schemas" section has no undetermined JSON kind
    And it has a "concern-groups/v1" class sourced from "json: ConcernGroupsSchema"

  @test:scripts/tests/ui/uml-overview-orphans.test.ts::declared_vs_undeclared_sub-subgraphs_(f8wp_falsifier_3)::cat-harness_emits_one_.puml/.mmd_pair_per_declared_directory/sub-subgraph
  Scenario: cat-harness gets one .puml/.mmd pair per declared directory
    Given the cat-harness repository
    When its sections are read and its overview files are generated
    Then there is one section per declared directory, in order
    And each declared directory has a .puml and a .mmd under "cat-harness/"
    And there are exactly two such files per declared directory
