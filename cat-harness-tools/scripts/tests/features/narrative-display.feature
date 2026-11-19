# An untyped reader's one narrative (e1lo stage 3): the single form as it is,
# a list chosen by locale. Each Scenario names the test that executes it.
Feature: Displaying one narrative

  @test:scripts/tests/narrative-display.test.ts::displayNarrative:_an_untyped_reader's_one_narrative_(e1lo_stage_3)::the_single_form_is_returned_exactly_as_it_is
  Scenario: The single form is returned exactly as it is
    When a single narrative object is displayed
    Then the same object comes back

  @test:scripts/tests/narrative-display.test.ts::displayNarrative:_an_untyped_reader's_one_narrative_(e1lo_stage_3)::a_list_goes_through_narrativeFor:_locale_match,_else_first
  Scenario: A list is chosen by locale, else its first entry
    Given a list of an English and a French draft
    Then with no locale the English one is shown
    And with fr-CA the French one is shown

  @test:scripts/tests/narrative-display.test.ts::displayNarrative:_an_untyped_reader's_one_narrative_(e1lo_stage_3)::a_list_that_is_not_a_valid_slot_shows_nothing_rather_than_a_guess
  Scenario: A list that is not a valid slot shows nothing
    Then a list with one entry missing its language shows nothing
    And an empty list shows nothing

  @test:scripts/tests/narrative-display.test.ts::displayNarrative:_an_untyped_reader's_one_narrative_(e1lo_stage_3)::no_narrative_is_no_narrative
  Scenario: No narrative is no narrative
    Then undefined, null, a string and a number each show nothing
