# The involvement vocabulary of a BPMN process (src/workflow/process-model.ts and
# scripts/raci-chart.ts): RACI's four letters or RASCI's five, with any involvement
# outside the chosen vocabulary reported. Each Scenario names the test that executes it.
Feature: The RACI or RASCI involvement vocabulary

  @test:scripts/tests/involvement-vocabulary.test.ts::the_vocabulary_is_a_CHOICE,_so_choosing_the_other_one_is_refused::`supportive`_in_a_four-letter_process_is_REPORTED,_not_accepted_and_not_dropped
  Scenario: Supportive in a four-letter process is reported, not accepted and not dropped
    Given a process with no vocabulary declared and an activity with an accountable a-role and a supportive b-role
    When the process model is loaded
    Then its involvement vocabulary is "raci"
    And the activity's raci holds only "accountable"
    And its unknown involvements record b-role as "supportive"
    And the RACI breaches are one "involvement-unknown" whose detail names 'vocabulary="rasci"'

  @test:scripts/tests/involvement-vocabulary.test.ts::the_vocabulary_is_a_CHOICE,_so_choosing_the_other_one_is_refused::the_SAME_diagram_is_clean_once_the_process_declares_`rasci`
  Scenario: The same diagram is clean once the process declares rasci
    Given the same activity in a process declaring vocabulary "rasci"
    When the process model is loaded
    Then its involvement vocabulary is "rasci"
    And it has no unknown involvements
    And its raci contains b-role as "supportive"
    And there are no RACI breaches

  @test:scripts/tests/involvement-vocabulary.test.ts::the_vocabulary_is_a_CHOICE,_so_choosing_the_other_one_is_refused::a_TYPO_is_reported_the_same_way,_and_is_never_coerced_to_a_neighbour
  Scenario: A typo is reported the same way and never coerced to a neighbour
    Given an activity whose b-role involvement is "consultd"
    When the process model is loaded
    Then its raci holds only "accountable" and has no entry for b-role
    And its unknown involvements record b-role as "consultd"
    And the RACI breaches are one "involvement-unknown" whose detail does not suggest 'vocabulary="rasci"'

  @test:scripts/tests/involvement-vocabulary.test.ts::the_vocabulary_is_a_CHOICE,_so_choosing_the_other_one_is_refused::an_activity_whose_involvements_are_ALL_unknown_is_still_reported
  Scenario: An activity whose involvements are all unknown is still reported
    Given an activity whose only involvement is the typo "acountable"
    When the process model is loaded
    Then the activity's raci is empty
    And it still yields one RACI row
    And the breaches include "involvement-unknown"

  @test:scripts/tests/involvement-vocabulary.test.ts::the_vocabulary_is_a_CHOICE,_so_choosing_the_other_one_is_refused::an_undeclared_vocabulary_THROWS_rather_than_falling_back_to_four_letters
  Scenario: An undeclared vocabulary throws rather than falling back to four letters
    Given a process declaring vocabulary "racsi"
    When the process model is loaded
    Then loading rejects with "not a declared vocabulary"

  @test:scripts/tests/involvement-vocabulary.test.ts::the_vocabularies_themselves::rasci_is_raci_plus_exactly_`supportive`
  Scenario: RASCI is RACI plus exactly supportive
    When the RASCI involvements are compared with the RACI involvements
    Then RASCI equals RACI followed by "supportive"

  @test:scripts/tests/involvement-vocabulary.test.ts::the_vocabularies_themselves::neither_vocabulary_admits_`responsible`_—_the_lane_carries_it
  Scenario: Neither vocabulary admits responsible, since the lane carries it
    When every declared involvement vocabulary is read
    Then none contains "responsible"

  @test:scripts/tests/involvement-vocabulary.test.ts::the_vocabularies_themselves::the_real_corpus_declares_no_vocabulary,_so_nothing_changed_meaning
  Scenario: The real corpus declares no vocabulary, so nothing changed meaning
    Given the RACI rows of the real process corpus
    When each row's vocabulary is read
    Then every row's vocabulary is "raci"
