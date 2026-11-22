# src/crdm/detect-signals.ts holds the CRDM detector's exclusion and detection patterns, transcribed
# from the crdm-detect skill; these Scenarios keep the two in agreement and guard the eval corpus.
# Each Scenario names the test that executes it.
Feature: The CRDM detector's patterns agree with the crdm-detect skill

  @test:scripts/tests/crdm-detect-signals.test.ts::the_exclusion_patterns_and_the_skill's_prose_agree::every_quoted_exclusion_in_the_skill_is_matched_by_some_pattern
  Scenario: Every quoted exclusion in the skill is matched by some pattern
    Given the exclusions parsed from the crdm-detect skill
    When the exclusion drift is computed
    Then there is no "unmatched-bullet" finding

  @test:scripts/tests/crdm-detect-signals.test.ts::the_exclusion_patterns_and_the_skill's_prose_agree::every_pattern_comes_from_a_bullet_—_no_exclusion_without_prose
  Scenario: Every exclusion pattern comes from a bullet in the skill
    Given the exclusions parsed from the crdm-detect skill
    When the exclusion drift is computed
    Then there is no "orphan-pattern" finding

  @test:scripts/tests/crdm-detect-signals.test.ts::the_exclusion_patterns_and_the_skill's_prose_agree::a_renamed_section_throws_rather_than_reporting_an_empty_list
  Scenario: A skill missing its exclusions section throws instead of yielding an empty list
    Given markdown with a different heading and one bullet
    When its exclusions are parsed
    Then parsing throws an error naming the missing "## What is NOT" section

  @test:scripts/tests/crdm-detect-signals.test.ts::the_bullets_a_phrase_cannot_decide_are_reported,_not_dropped::the_skill_carries_at_least_one_judgement-only_category
  Scenario: The skill carries at least one judgement-only exclusion
    Given the exclusions parsed from the crdm-detect skill
    Then the judgement-only list is not empty

  @test:scripts/tests/crdm-detect-signals.test.ts::the_bullets_a_phrase_cannot_decide_are_reported,_not_dropped::a_judgement-only_bullet_is_not_silently_counted_as_implemented
  Scenario: A judgement-only bullet holds no quoted phrase
    Given the judgement-only bullets parsed from the skill
    Then none of them contains a double quote

  @test:scripts/tests/crdm-detect-signals.test.ts::GUARD:_an_exclusion_must_not_swallow_a_real_feature_request::no_issue_labelled_a_feature_is_excluded_by_phrase
  Scenario: No issue labelled a feature is excluded by phrase
    Given the 27-issue eval corpus
    When each feature-labelled issue is run through the detector
    Then none of them is excluded

  @test:scripts/tests/crdm-detect-signals.test.ts::GUARD:_an_exclusion_must_not_swallow_a_real_feature_request::the_patterns_are_all_case-insensitive_—_an_issue_title_is_not_prose
  Scenario: Every exclusion pattern is case-insensitive
    Given the exclusion patterns
    Then each one carries the "i" flag

  @test:scripts/tests/crdm-detect-signals.test.ts::the_detection_patterns_and_the_skill's_prose_agree::every_quoted_category_example_is_matched_by_a_pattern_in_ITS_category
  Scenario: Every quoted category example is matched by a pattern in its own category
    Given the detection categories parsed from the crdm-detect skill
    When the category drift is computed
    Then there is no finding

  @test:scripts/tests/crdm-detect-signals.test.ts::the_detection_patterns_and_the_skill's_prose_agree::a_renamed_detection_heading_throws_rather_than_silently_going_unchecked
  Scenario: A skill missing a detection heading throws instead of going unchecked
    Given detection-signals markdown whose category heading is renamed
    When its categories are parsed
    Then parsing throws a "missing detection heading" error

  @test:scripts/tests/crdm-detect-signals.test.ts::the_detection_patterns_and_the_skill's_prose_agree::a_pattern_in_the_wrong_category_is_a_finding,_not_a_pass
  Scenario: A category stripped of its patterns produces drift findings
    Given the detection categories with the "cross-cutting" category's patterns removed
    When the category drift is computed against them
    Then there is at least one finding

  @test:scripts/tests/crdm-detect-signals.test.ts::GUARD:_widening_detection_must_not_cost_a_single_true_negative::no_issue_starts_false-alarming_that_was_not_already
  Scenario: No issue false-alarms that did not already
    Given the 27-issue eval corpus and the known false alarm #166
    When the detector is measured over the corpus
    Then every false alarm is one already known

  @test:scripts/tests/crdm-detect-signals.test.ts::GUARD:_widening_detection_must_not_cost_a_single_true_negative::the_anchor's_old_justification_is_GONE_—_recorded,_not_hidden
  Scenario: The unanchored "proposal" pattern adds no false alarm and gains one true positive
    Given the "self-declared-genre" category with unanchored "proposal" and "design document" patterns
    When the detector is measured over the corpus with it
    Then no new false alarm appears
    And the true positives are one more than with the current patterns

  @test:scripts/tests/crdm-detect-signals.test.ts::GUARD:_widening_detection_must_not_cost_a_single_true_negative::the_precision_floor_holds_too_—_but_it_is_not_what_rejected_that_candidate
  Scenario: Precision stays at or above 0.8, and the unanchored candidate clears it too
    Given the 27-issue eval corpus
    When the detector's precision is measured
    Then it is at least 0.8
    And with an unanchored "proposal" pattern in "self-declared-genre" the precision is above 0.8

  @test:scripts/tests/crdm-detect-signals.test.ts::GUARD:_widening_detection_must_not_cost_a_single_true_negative::the_corpus_is_the_whole_population,_so_a_sample_size_is_not_a_defence
  Scenario: The eval corpus is the whole 27-issue population
    Given the eval corpus file
    Then it holds exactly 27 issues
