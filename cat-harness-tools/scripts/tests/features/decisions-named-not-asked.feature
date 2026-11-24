# scripts/decisions-named-not-asked.ts finds paragraphs that hand the owner several decision ids
# without the terms of a choice, and builds the reminder for them. Each Scenario names the test that executes it.
Feature: Decisions named but not asked are flagged

  @test:scripts/tests/decisions-named-not-asked.test.ts::the_anti-vacuity_pair_—_the_same_function_must_do_both
  Scenario: The detector both fires on a bare wrap-up list and stays quiet on a count
    Given the verbatim wrap-up list naming "bf5l", "e8m3", "#951" and others
    And the turn "Three other decisions are waiting" naming no ids
    When the detector runs on each
    Then the wrap-up list yields at least one finding
    And the count yields none

  @test:scripts/tests/decisions-named-not-asked.test.ts::a_comparison_ANYWHERE_in_the_paragraph_suppresses_it
  Scenario: Ids followed by a comparison table yield only the bare lead-in paragraph
    # Gap: the table paragraph names no ids, so suppression of a paragraph that holds both ids and a comparison is not exercised
    Given a "Still yours" paragraph naming "bf5l" and "e8m3", then an option table with pro, con and downstream columns, then a default
    When the detector runs on it
    Then exactly one finding is reported

  @test:scripts/tests/decisions-named-not-asked.test.ts::the_reminder_names_the_count_and_the_ids,_not_just_the_rule
  Scenario: The reminder names the ids and where the rule lives
    # Gap: the count in the reminder is not asserted
    Given the findings for the verbatim wrap-up list
    When the reminder is built from them
    Then it contains "bf5l" and "#951"
    And it mentions "downstream", in any case
    And it names "interaction-modality.md"

  @test:scripts/tests/decisions-named-not-asked.test.ts::it_fires_on_the_shape_the_owner_had_to_name_twice::%s
  Scenario: The detector fires on a verbatim wrap-up that hands over decisions without terms
    Given each verbatim closing paragraph: the wrap-up list, the same shape with a different lead-in, and one hedged as a report rather than a question
    When the detector runs on it
    Then it yields at least one finding
    And the first finding names at least 2 ids

  @test:scripts/tests/decisions-named-not-asked.test.ts::it_stays_quiet_on_turns_that_did_the_right_thing::%s
  Scenario: The detector stays quiet on a turn that did the right thing
    Given each turn from the same session: a report of finished work naming many ids, one decision asked in full, a count with no names, and an outstanding marker with only one id
    When the detector runs on it
    Then it yields no findings
