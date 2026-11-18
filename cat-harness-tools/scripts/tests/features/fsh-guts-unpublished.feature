# No published graph mentions fsh-guts: the exclusion predicates in schemas/kg/cat-harness.ts and the
# published: false skill declaration (scripts/known-skills.ts) keep it out of the built kg-export.
# Each Scenario names the test that executes it.
Feature: No published graph mentions fsh-guts

  @test:scripts/tests/fsh-guts-unpublished.test.ts::the_exclusion_predicates::fsh-guts_is_excluded_and_the_ordinary_kinds_are_not
  Scenario: The fsh-guts graph typology is unpublished and ordinary typologies are published
    Then UNPUBLISHED_GRAPH_TYPOLOGIES contains "fsh-guts"
    And "fsh-guts" is not a published graph typology
    And "cat-harness", "schemas", "beans", "qa" and "tools" are published graph typologies

  @test:scripts/tests/fsh-guts-unpublished.test.ts::the_exclusion_predicates::a_directory_is_excluded_when_ANY_graph_it_holds_is_excluded
  Scenario: A directory is unpublished when any graph it holds is unpublished
    Then a directory holding only "fsh-guts" is not published
    And a directory holding "cat-harness" and "fsh-guts" is not published
    And a directory holding "schemas" and "cat-harness" is published
    And a directory declaring no graph typologies is published

  @test:scripts/tests/fsh-guts-unpublished.test.ts::the_built_export::contains_no_`fsh-guts`_anywhere,_at_any_depth
  Scenario: The built export contains no fsh-guts at any depth
    Given the built main graph export
    When it is serialised to JSON
    Then the text does not contain "fsh-guts"

  @test:scripts/tests/fsh-guts-unpublished.test.ts::the_built_export::the_export_is_not_empty,_so_the_check_above_is_not_vacuous
  Scenario: The built export is not empty
    Given the built main graph export
    When it is serialised to JSON
    Then the text is longer than 10000 characters
    And it contains "cat-harness"

  @test:scripts/tests/fsh-guts-unpublished.test.ts::the_built_export::no_individual_node_names_it,_and_the_node_list_is_real
  Scenario: No node of the built export names fsh-guts
    Given the built main graph export
    Then its "@graph" holds more than 100 nodes
    And no node's JSON contains "fsh-guts"

  @test:scripts/tests/fsh-guts-unpublished.test.ts::the_built_export::the_skill_documenting_the_trashcan_is_excluded,_and_ordinary_skills_are_not
  Scenario: The fsh-guts skill is unpublished and ordinary skills are published
    Then "fsh-guts" is not a published skill
    And "where-a-proposal-goes" and "prepare-merge" are published skills

  @test:scripts/tests/fsh-guts-unpublished.test.ts::the_declaration,_not_just_the_name::`fsh-guts`_declares_`published:_false`_in_its_own_front_matter
  Scenario: The fsh-guts skill is declared unpublished
    When the skills declaring "published: false" are collected from the harness root
    Then they include "fsh-guts"

  @test:scripts/tests/fsh-guts-unpublished.test.ts::the_declaration,_not_just_the_name::the_declaration_is_what_excludes_it,_independently_of_the_name_rule
  Scenario: Both the declaration and the name rule exclude the fsh-guts skill
    # Gap: checks that each input says no; does not show the declaration excludes it with the name rule removed
    Given the skills declared unpublished under the harness root
    Then "fsh-guts" is among them
    And "fsh-guts" is not a published skill

  @test:scripts/tests/fsh-guts-unpublished.test.ts::the_declaration,_not_just_the_name::an_ordinary_skill_is_neither_declared_nor_name-matched
  Scenario: An ordinary skill is neither declared unpublished nor name-matched
    Given the skills declared unpublished under the harness root
    Then "todo-manager", "opening-brief" and "directory-conventions" are not among them
    And each of them is a published skill
    And fewer than 5 skills are declared unpublished
