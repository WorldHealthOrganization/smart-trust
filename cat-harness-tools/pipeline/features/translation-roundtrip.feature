# pipeline/translation-roundtrip.ts turns a round-trip review into its adjudicator and back-translator QA entries,
# recording the review's provenance as given and never inventing a time, commit or model.
# Each Scenario names the test that executes it.
Feature: Round-trip QA provenance

  @test:pipeline/translation-roundtrip.test.ts::roundTripEntries_—_provenance_is_recorded,_never_invented::a_re-record_keeps_the_original_time_and_HEAD_on_BOTH_entries
  Scenario: A re-record keeps the original time and HEAD on both entries
    Given a round-trip payload reviewed at "2026-09-18T20:32:46.150Z" on commit "c3998d16ecf1"
    When its entries are built
    Then there are 2 entries
    And each records that time and that commit

  @test:pipeline/translation-roundtrip.test.ts::roundTripEntries_—_provenance_is_recorded,_never_invented::without_them_it_stamps_no_clock:_a_first_recording_is_dated_by_its_tree
  Scenario: A first recording stamps no clock and is dated by its tree
    Given a round-trip payload with no review time, commit or tree
    When its entries are built
    Then the first entry has no review time
    And it has a reviewed tree
    And it has no reviewed commit

  @test:pipeline/translation-roundtrip.test.ts::roundTripEntries_—_provenance_is_recorded,_never_invented::a_re-record_by_tree_keeps_that_tree_on_BOTH_entries
  Scenario: A re-record by tree keeps that tree on both entries
    Given a round-trip payload with a review time and tree "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
    When its entries are built
    Then each entry records that tree
    And neither records a commit

  @test:pipeline/translation-roundtrip.test.ts::roundTripEntries_—_provenance_is_recorded,_never_invented::a_model_identifier_carries_the_basis_for_it,_beside_the_model
  Scenario: A model identifier carries the basis for it, beside the model
    Given an adjudicator with model "some-model" and model source "read from get_session"
    When the entries are built
    Then the first entry's reviewer model is "some-model"
    And its metrics record model source "read from get_session"

  @test:pipeline/translation-roundtrip.test.ts::roundTripEntries_—_provenance_is_recorded,_never_invented::no_model,_no_model_source_row_—_and_the_panel_then_prints_'not_recorded'
  Scenario: No model gives no model_source row
    # Gap: that the panel then prints "not recorded" is not checked
    Given an adjudicator with no model
    When the entries are built
    Then the first entry has no reviewer model
    And no model source metric

  @test:pipeline/translation-roundtrip.test.ts::roundTripEntries_—_provenance_is_recorded,_never_invented::the_adjudicator_rules_and_the_back-translator_does_not
  Scenario: The adjudicator rules and the back-translator does not
    Given a payload with verdict "fail" and severity "major"
    When the entries are built
    Then the adjudicator entry's result is "fail" with severity "major"
    And the back-translator entry's result is "n/a"
    And its notes contain the back-translation
