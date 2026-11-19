# The stale-field-advice gate: a bare mention of a field that serves a stale
# view must carry a qualifier nearby. The sabotages are pinned so they stay
# run. Each Scenario names the test that executes it.
Feature: Stale field advice gate

  @test:scripts/tests/stale-field-advice.test.ts::the_field_table_is_not_empty
  Scenario: The field table is not empty
    Then at least one stale field is declared

  @test:scripts/tests/stale-field-advice.test.ts::every_field_declares_the_bean_that_measured_it_and_at_least_one_qualifier
  Scenario: Every field names its bean, its measurement and a reasoned qualifier
    Then every field names a four-character bean id and records a measurement over 20 characters
    And it has at least one qualifier, each with a reason over 10 characters

  @test:scripts/tests/stale-field-advice.test.ts::SABOTAGE_—_the_gate_fails_when_the_defect_is_present::a_fourth_copy_of_the_advice_string_is_caught
  Scenario: A bare copy of the advice is caught
    Given a workflow line telling the reader to check mergeable_state by hand
    When it is scanned for the first field
    Then there is one mention and it has no qualifier

  @test:scripts/tests/stale-field-advice.test.ts::SABOTAGE_—_the_gate_fails_when_the_defect_is_present::stripping_the_qualifier_from_a_real,_currently-passing_site_is_caught
  Scenario: Stripping a real site's caution is caught
    Then the real text, which says what "unknown" means, is qualified
    And the same text with its caution removed is not

  @test:scripts/tests/stale-field-advice.test.ts::the_anti-vacuity_pair_—_one_function,_both_directions
  Scenario: A bare mention is unqualified and a qualified one is qualified
    Then "read `mergeable_state` and act on it" has no qualifier
    And the same naming bean fx5r's measurement has one

  @test:scripts/tests/stale-field-advice.test.ts::a_qualifier_outside_the_window_does_NOT_count
  Scenario: A qualifier outside the window does not count
    Given a mention followed by more lines than the window, then a qualifier
    Then the mention has no qualifier

  @test:scripts/tests/stale-field-advice.test.ts::the_real_corpus_is_clean,_and_the_sweep_is_not_vacuous
  Scenario: The real corpus is clean and the sweep is not vacuous
    When the repository is checked
    Then more than 100 files are scanned
    And at least one qualified mention is found
    And no mention is bare

  @test:scripts/tests/stale-field-advice.test.ts::declining_is_by_PATH_and_every_declension_carries_a_reason
  Scenario: Declined paths are whole paths with reasons
    When the repository is checked
    Then every declined path is declined by skipPath with the same reason, over 10 characters
    And fewer than 10 paths are declined
