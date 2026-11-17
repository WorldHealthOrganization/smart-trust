# src/docs/declaration-claims.ts finds prose claims that a graph is declared in a named file
# and checks each against the files that really declare it (bean hrv2).
# Each Scenario names the test that executes it.
Feature: Prose claims about which file declares a graph

  @test:scripts/tests/kg/declaration-claims.test.ts::a_claim_is_found_and_checked_against_the_declarations::the_defect_that_opened_the_bean
  Scenario: A wrong filename claimed for the health graph is found and disagrees
    Given the "health" graph is declared only in "cat-harness/cat-harness.json"
    When the claims are read from "declared in `folio-assistant.config.json` as the `health` graph"
    Then exactly one claim is found
    And it does not agree
    And its claimed file is "folio-assistant.config.json"
    And its actual files are ["cat-harness.json"]

  @test:scripts/tests/kg/declaration-claims.test.ts::a_claim_is_found_and_checked_against_the_declarations::a_correct_claim_agrees
  Scenario: A correct filename claim agrees
    Given the "health" graph is declared only in "cat-harness/cat-harness.json"
    When the claims are read from "declared in `cat-harness.json` as the `health` graph"
    Then the first claim agrees

  @test:scripts/tests/kg/declaration-claims.test.ts::a_claim_is_found_and_checked_against_the_declarations::the_PATH_form_agrees_too_—_prose_should_be_free_to_be_clearer
  Scenario: A claim naming the declaring file by its path agrees too
    Given the "health" graph is declared only in "cat-harness/cat-harness.json"
    When the claims are read from "declared in `cat-harness/cat-harness.json` as the `health` graph"
    Then the first claim agrees

  @test:scripts/tests/kg/declaration-claims.test.ts::a_claim_is_found_and_checked_against_the_declarations::a_claim_WRAPPED_across_source_lines_is_still_one_claim
  Scenario: A claim wrapped across two source lines is still one claim
    Given a paragraph whose line breaks between "declared in" and "`cat-harness.json` as the `health` graph"
    When the claims are read
    Then exactly one claim is found
    And it agrees

  @test:scripts/tests/kg/declaration-claims.test.ts::GUARD:_two_facts_standing_near_each_other_are_not_a_claim::adjacent_TABLE_ROWS_are_not_paired
  Scenario: Adjacent table rows are not paired into a claim
    Given a table row naming the `cat-harness` graph followed by a row naming "scenarios/roles.json"
    When the claims are read
    Then no claim is found

  @test:scripts/tests/kg/declaration-claims.test.ts::GUARD:_two_facts_standing_near_each_other_are_not_a_claim::...and_separate_PARAGRAPHS_are_not_paired_either
  Scenario: Separate paragraphs are not paired into a claim
    Given one paragraph naming the `health` graph and the next naming "roles.json"
    When the claims are read
    Then no claim is found

  @test:scripts/tests/kg/declaration-claims.test.ts::GUARD:_two_facts_standing_near_each_other_are_not_a_claim::a_filename_beyond_the_window_is_not_paired
  Scenario: A filename beyond the pairing window is not paired
    Given the `health` graph followed by 200 characters and then "roles.json"
    When the claims are read
    Then no claim is found

  @test:scripts/tests/kg/declaration-claims.test.ts::GUARD:_two_facts_standing_near_each_other_are_not_a_claim::an_undeclared_graph_id_is_not_a_claim_at_all
  Scenario: An undeclared graph id is not a claim
    Given the text "the `nonesuch` graph is declared in `whatever.json`"
    And "nonesuch" is not a declared graph
    When the claims are read
    Then no claim is found

  @test:scripts/tests/kg/declaration-claims.test.ts::GUARD:_two_facts_standing_near_each_other_are_not_a_claim::a_graph_id_NOT_followed_by_the_word_`graph`_is_not_an_anchor
  Scenario: A graph id not followed by the word graph is not an anchor
    Given the text "run the `health` check, see `roles.json`"
    When the claims are read
    Then no claim is found

  @test:scripts/tests/kg/declaration-claims.test.ts::GUARD:_two_facts_standing_near_each_other_are_not_a_claim::examined_nothing_returns_nothing_—_and_the_runner_treats_that_as_unknown
  Scenario: With no graph declarations nothing is examined and nothing is returned
    # Gap: how the runner treats an empty result as unknown is not checked
    Given an empty map of graph declarations
    When the claims are read from "declared in `x.json` as the `health` graph"
    Then no claim is found

  @test:scripts/tests/kg/declaration-claims.test.ts::a_placeholder_names_a_pattern_—_counted,_never_a_contradiction::`<name>.json`_is_a_claim,_and_agrees_by_construction
  Scenario: A <name>.json placeholder is a claim that agrees by construction
    Given the text "declared in `<name>.json` as the `health` graph"
    When the claims are read
    Then exactly one claim is found
    And it is marked as a placeholder
    And it agrees

  @test:scripts/tests/kg/declaration-claims.test.ts::a_placeholder_names_a_pattern_—_counted,_never_a_contradiction::`<instance>.json`_and_`<slug>.config.json`_too
  Scenario: <instance>.json and <slug>.config.json are placeholders too
    Given each of "<instance>.json" and "<slug>.config.json" claimed as the file declaring the `health` graph
    When the claims are read
    Then exactly one claim is found each time
    And it is marked as a placeholder

  @test:scripts/tests/kg/declaration-claims.test.ts::a_placeholder_names_a_pattern_—_counted,_never_a_contradiction::a_concrete_filename_is_NOT_a_placeholder
  Scenario: A concrete filename is not a placeholder
    Given the text "declared in `cat-harness.json` as the `health` graph"
    When the claims are read
    Then the first claim is not marked as a placeholder

  @test:scripts/tests/kg/declaration-claims.test.ts::a_placeholder_names_a_pattern_—_counted,_never_a_contradiction::generalising_does_not_MASK_a_wrong_concrete_name_beside_it
  Scenario: A placeholder does not mask a wrong concrete filename beside it
    Given the text "the `health` graph is in `<name>.json`, never in `harness.json`"
    When the claims are read
    Then two claims are found
    And the "harness.json" claim does not agree
    And the "<name>.json" claim is marked as a placeholder

  @test:scripts/tests/kg/declaration-claims.test.ts::a_placeholder_names_a_pattern_—_counted,_never_a_contradiction::a_bare_`<>`_is_not_a_placeholder,_and_not_a_filename_either
  Scenario: A bare <> is not a placeholder
    # Gap: that `<>.json` is not treated as a filename is not checked
    Given the text "declared in `<>.json` as the `health` graph"
    When the claims are read
    Then the first claim is not marked as a placeholder
