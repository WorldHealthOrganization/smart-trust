# The skill overlay (resolveSkillDirs in schemas/kg/harness-config.js) and the directory
# resolvers ownDirectories and resolveDirectories, over synthetic layer fixtures.
# Each Scenario names the test that executes it.
Feature: The skill overlay reads declarations and keeps every layer's skills

  @test:schemas/skill-overlay.test.ts::the_overlay_is_read_from_declarations,_not_from_a_literal::a_knowledge_graph_NOT_at_skills/_is_still_found
  Scenario: A knowledge graph declared somewhere other than skills/ is still found
    Given a layer declaring its cat-harness graph at "kg"
    When its skill directories are resolved
    Then the result is just its "kg" directory

  @test:schemas/skill-overlay.test.ts::the_overlay_is_read_from_declarations,_not_from_a_literal::a_dependency's_graph_AND_the_root's_both_survive_—_deepest_first
  Scenario: A dependency's graph and the root's both survive, deepest first
    Given a root layer and a dependency layer, each declaring a cat-harness graph at "skills"
    And the root depends on the dependency
    When the root's skill directories are resolved
    Then the result is the dependency's "skills" then the root's "skills"

  @test:schemas/skill-overlay.test.ts::the_overlay_is_read_from_declarations,_not_from_a_literal::resolveDirectories_keeps_both_as_MEMBERS,_but_not_in_overlay_order_—_why_it_is_not_used
  Scenario: resolveDirectories keeps both graphs as members but not in overlay order
    # Gap: the root does not depend on dep in this fixture, so the overlay result compared against is root's skills alone, not the reversed pair.
    Given a root layer and a dependency layer, each declaring a graph at "skills"
    When resolveDirectories is run over both links and filtered to kg-only directories
    Then the members are the root's "skills" then the dependency's
    And that order differs from the root's resolved skill directories

  @test:schemas/skill-overlay.test.ts::the_overlay_is_read_from_declarations,_not_from_a_literal::`provides`_without_'skills'_opts_a_dependency_out
  Scenario: A dependency whose provides list omits "skills" is left out of the overlay
    Given a root that depends on a layer providing only "content"
    When the root's skill directories are resolved
    Then the result is only the root's "skills"

  @test:schemas/skill-overlay.test.ts::the_overlay_is_read_from_declarations,_not_from_a_literal::a_directory_declared_but_absent_is_not_returned
  Scenario: A directory declared but absent on disk is not returned
    Given a layer declaring a cat-harness graph at "nope", which does not exist
    When its skill directories are resolved
    Then the result is empty

  @test:schemas/skill-overlay.test.ts::the_overlay_is_read_from_declarations,_not_from_a_literal::an_UNDECLARED_instance_still_falls_back_to_the_conventions
  Scenario: An undeclared layer falls back to the conventional skills/ directory
    Given a layer with no declaration and a "skills" directory on disk
    When its skill directories are resolved
    Then the result is its "skills" directory
    And its own directories include one declared by "(default)"

  @test:schemas/skill-overlay.test.ts::the_overlay_is_read_from_declarations,_not_from_a_literal::an_undeclared_instance_with_NO_conventional_directory_yields_nothing
  Scenario: An undeclared layer with no conventional directory yields nothing
    Given a bare layer with no declaration and no directories
    When its skill directories are resolved
    Then the result is empty

  @test:schemas/skill-overlay.test.ts::the_overlay_is_read_from_declarations,_not_from_a_literal::a_directory_holding_more_than_the_kg_is_excluded
  Scenario: A directory holding more than the knowledge graph is excluded
    Given a layer declaring "schemas" with graph typologies "schemas" and "cat-harness"
    When its skill directories are resolved
    Then the result is empty

  @test:schemas/skill-overlay.test.ts::a_REPOSITORY-scoped_directory_resolves_against_the_repository::ownDirectories_resolves_`scope:_repository`_one_level_out
  Scenario: ownDirectories resolves a repository-scoped entry one level out
    Given a layer nested in a repository, declaring a repository-scoped graph at "sibling" that exists beside it
    When its own directories and skill directories are resolved
    Then both are the repository's "sibling" directory

  @test:schemas/skill-overlay.test.ts::a_REPOSITORY-scoped_directory_resolves_against_the_repository::...and_WITHOUT_the_scope_the_same_declaration_resolves_inside
  Scenario: Without the repository scope the same declaration resolves inside the layer
    Given the same nested layer declaring "sibling" with no scope
    When its own directories are resolved
    Then the result is "sibling" inside the layer
    And its skill directories are empty, since that directory does not exist

  @test:schemas/skill-overlay.test.ts::a_REPOSITORY-scoped_directory_resolves_against_the_repository::a_DEPENDENCY's_repository-scoped_entry_is_not_inherited
  Scenario: A dependency's repository-scoped entry is not inherited
    Given a root layer depending on a nested layer that declares a repository-scoped "sibling"
    When the root's skill directories are resolved
    Then the result is only the root's "skills"
    And the dependency's repository "sibling" is not among them

  @test:schemas/skill-overlay.test.ts::the_two_resolvers_agree_about_what_a_declaration_means::an_instance_that_declares_NOTHING_keeps_its_conventional_directories
  Scenario: A layer whose declaration omits the conventional directories still keeps them
    # Gap: the title says the instance declares nothing, but the fixture declares its graph directory; what is shown is that conventional directories survive alongside one declared entry.
    Given a declared layer with "beans" and "uploads" directories on disk that it does not declare
    When its own directories are resolved
    Then their ids include "beans" and "uploads"

  @test:schemas/skill-overlay.test.ts::the_two_resolvers_agree_about_what_a_declaration_means::a_default_that_is_NOT_on_disk_is_not_resolved_—_dh4f,_not_generosity
  Scenario: A conventional directory not on disk is not resolved
    Given a declared layer with none of the conventional directories on disk
    When its own directories are resolved
    Then none of "beans", "todos", "uploads", "library" or "voices" is among the ids

  @test:schemas/skill-overlay.test.ts::the_two_resolvers_agree_about_what_a_declaration_means::a_declared_entry_OVERRIDES_the_default_of_the_same_id
  Scenario: A declared entry overrides the default of the same id
    Given a layer declaring its graph at "kg"
    When its own directories are resolved
    Then exactly one entry has id "skills"
    And it is at "kg" and is not declared by "(default)"

  @test:schemas/skill-overlay.test.ts::the_two_resolvers_agree_about_what_a_declaration_means::and_the_two_functions_return_the_same_ids_for_the_same_root
  Scenario: ownDirectories and resolveDirectories return the same ids for the same root
    Given a declared layer with "beans" and "uploads" also on disk
    When both resolvers are run over it
    Then their sorted ids are equal
    And there are more than two of them
