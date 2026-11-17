# pipeline/pipeline-plugins.ts gives generic pipeline code its plug-in slots: a
# dependency registers an implementation by kind, a duplicate throws, and an
# unfilled kind is an error, never a default. Each Scenario names the test that executes it.
Feature: Pipeline plug-in slots

  @test:pipeline/pipeline-plugins.test.ts::registration::a_registered_implementation_is_what_the_slot_returns,_and_the_delegate_calls_it
  Scenario: A registered implementation is what the slot returns and the delegate calls
    Given a registry with a "lean-lexer" implementation registered by "dep-a"
    When the registry is put in use
    Then the "lean-lexer" slot strips "x" to "dep-a:x"
    And the stripLeanComments delegate strips "y" to "dep-a:y"
    And the registry lists one pipeline plug-in, kind "lean-lexer" from contributor "dep-a"

  @test:pipeline/pipeline-plugins.test.ts::registration::loads_through_the_declared_dependency_walk,_synchronously,_with_the_entry's_name_pinned
  Scenario: The slot is filled synchronously through the declared dependency walk
    Given a root whose dependency "dep-a" declares a pipeline-plugins node filling "lean-lexer"
    When the contributions are loaded synchronously from the root and put in use
    Then the "lean-lexer" slot strips "z" to "stripped:z"
    And the contributor is pinned to the dependency entry's name "dep-a"

  @test:pipeline/pipeline-plugins.test.ts::registration::a_diamond_—_the_same_contributor_twice_—_is_not_a_collision
  Scenario: The same contributor registering a kind twice is not a collision
    Given a registry with a "lean-lexer" implementation from "dep-a"
    When "dep-a" registers the same kind again
    Then nothing is thrown

  @test:pipeline/pipeline-plugins.test.ts::a_duplicate_THROWS::two_contributors_for_one_kind_is_a_collision_naming_both
  Scenario: Two contributors for one kind is a collision naming both
    Given a registry with a "lean-lexer" implementation from "dep-a"
    When "dep-b" registers "lean-lexer" too
    Then a ContributionCollisionError is thrown for what "pipeline-plugin" and id "lean-lexer"
    And its message names both "dep-a" and "dep-b"

  @test:pipeline/pipeline-plugins.test.ts::a_duplicate_THROWS::and_it_throws_through_the_loader_too,_whatever_order_the_dependencies_are_listed_in
  Scenario: The loader throws the collision too
    # Gap: only one dependency order (dep-a then dep-b) is tried
    Given a root whose dependencies "dep-a" and "dep-b" both fill "lean-lexer"
    When the contributions are loaded synchronously from the root
    Then a ContributionCollisionError is thrown

  @test:pipeline/pipeline-plugins.test.ts::an_unregistered_kind::throws_an_error_naming_the_kind_and_what_IS_filled,_never_a_default
  Scenario: An unregistered kind throws, naming the kind and what is filled
    Given a registry in use with only "lean-lexer" filled by "dep-a"
    When the "latex-preflight" slot is asked for
    Then an UnregisteredPipelinePluginError is thrown
    And its message names "latex-preflight" and "lean-lexer (dep-a)"

  @test:pipeline/pipeline-plugins.test.ts::an_unregistered_kind::names_the_instances_whose_declarations_fill_the_slot,_read_from_the_checkout
  Scenario: The error names the checkout's instances that declare the slot
    Given a checkout holding an instance "filler" whose declaration fills "lean-lexer"
    When the declaring instances of each slot are read from the checkout
    Then "lean-lexer" is declared by "filler" and "latex-preflight" by none
    And the error for "lean-lexer" says "declared in this checkout by filler"
    And the error for "latex-preflight" says "no instance in this checkout declares it"

  @test:pipeline/pipeline-plugins.test.ts::an_unregistered_kind::says_so_when_nothing_at_all_is_filled
  Scenario: The error says so when no slot is filled at all
    Given an empty registry in use
    When the "lean-coverage" slot is asked for
    Then the error says "No slot is filled at all"

  @test:pipeline/pipeline-plugins.test.ts::an_unregistered_kind::is_undefined_from_the_optional_accessor,_for_callers_with_their_own_could-not-determine_state
  Scenario: The optional accessor returns undefined for an unfilled kind
    Given an empty registry in use
    When "lean-coverage" is asked for through the optional accessor
    Then the result is undefined

  @test:pipeline/pipeline-plugins.test.ts::the_tabular-csvw_slot_(bean_urat)::is_a_declared_kind,_and_its_delegate_passes_the_source_and_options_through
  Scenario: The tabular-csvw slot is declared and its delegate passes source and options through
    Given "tabular-csvw" is among the declared plug-in kinds
    And a registry in use whose "tabular-csvw" implementation records what it is given and returns null
    When extractTabularCsvw is called with the source "x,y" and options for "a.csv"
    Then it returns null
    And the implementation saw the text "x,y" and the same options

  @test:pipeline/pipeline-plugins.test.ts::the_tabular-csvw_slot_(bean_urat)::unfilled,_it_refuses_with_the_slot_error_rather_than_falling_back_to_v1
  Scenario: An unfilled tabular-csvw slot refuses rather than falling back
    Given an empty registry in use
    When extractTabularCsvw is called
    Then an UnregisteredPipelinePluginError is thrown

  @test:pipeline/pipeline-plugins.test.ts::this_repository::generic_pipeline_code_imports_none_of_the_modules_that_fill_the_slots
  Scenario: Generic pipeline code imports none of the slot-filling modules
    Given the non-test .ts files in pipeline/, other than the slot fillers themselves
    When each file's import specifiers are scanned for "lean-lexer", "latex-preflight" and "lean-coverage"
    Then no file imports any of them
