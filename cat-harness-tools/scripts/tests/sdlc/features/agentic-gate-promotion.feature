# schemas/sdlc/merge-queue.ts records would-have-blocked findings of the agentic
# gate and decides whether it may be promoted from warn to block, by PR window,
# review coverage and empirical false-positive rate. Each Scenario names the test that executes it.
Feature: Agentic gate promotion from warn to block

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::WouldHaveBlockedRecordSchema_validation::accepts_a_valid_would-have-blocked_record
  Scenario: A valid would-have-blocked record is accepted
    Given a record for PR 101 with one true positive, one false positive and one unknown finding
    When it is parsed
    Then its PR number, head sha and three findings are kept
    And its metrics count 3 warned, 1 true positive, 1 false positive and 1 unknown
    And its empirical false-positive rate is 0.5

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::WouldHaveBlockedRecordSchema_validation::schemas/sdlc/merge-review.ts_re-exports_the_identical_schema
  Scenario: The merge-review module re-exports the identical schema and evaluator
    Given schemas/sdlc/merge-review.ts and schemas/sdlc/merge-queue.ts
    Then the record schema each exports is the same object
    And the promotion evaluator each exports is the same function

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::WouldHaveBlockedRecordSchema_validation::refuses_an_invalid_headSha_(non-hex,_wrong_length)
  Scenario: An invalid head sha is refused
    Given a valid record
    When its head sha is "too-short" or forty "g" characters
    Then parsing throws

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::WouldHaveBlockedRecordSchema_validation::refuses_invalid_prNumber_(zero_or_negative)
  Scenario: A zero or negative PR number is refused
    Given a valid record
    When its PR number is 0 or -5
    Then parsing throws

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::WouldHaveBlockedRecordSchema_validation::refuses_non-blocking_severity_in_finding
  Scenario: A finding whose severity is not blocking is refused
    Given a finding with severity "suggestion"
    When it is parsed
    Then parsing throws

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::WouldHaveBlockedRecordSchema_validation::refuses_invalid_humanVerdict
  Scenario: A human verdict outside the enum is refused
    Given a blocking finding with human verdict "approved"
    When it is parsed
    Then parsing throws

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::WouldHaveBlockedRecordSchema_validation::refuses_invalid_evaluatedAt_date_string
  Scenario: An invalid evaluatedAt date is refused
    Given a valid record
    When its evaluatedAt is "not-a-valid-date"
    Then parsing throws

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::WouldHaveBlockedRecordSchema_validation::AgenticPromotionCriteriaSchema_validates_criteria_boundaries
  Scenario: The promotion criteria schema checks its boundaries
    Given criteria of window 50, maximum false-positive rate 0.05 and coverage 0.8
    When they are parsed
    Then the window and rate are kept
    And a window of -1 is refused
    And a maximum false-positive rate of 1.5 is refused

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::FPR_calculation_and_strict_third-state_rule::computes_zero_FPR_when_all_findings_are_confirmed_true_positives
  Scenario: All confirmed true positives give a zero false-positive rate
    Given two findings judged true positive
    When the metrics are calculated
    Then they count 2 warned, 2 true positives, 0 false positives, 0 unknown
    And the empirical false-positive rate is 0

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::FPR_calculation_and_strict_third-state_rule::computes_expected_FPR_on_adjudicated_findings
  Scenario: The false-positive rate is computed over adjudicated findings
    Given nine true-positive findings and one false-positive finding
    When the metrics are calculated
    Then they count 10 warned, 9 true positives, 1 false positive, 0 unknown
    And the empirical false-positive rate is 0.1

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::FPR_calculation_and_strict_third-state_rule::STRICT_THIRD_STATE:_unknown_is_never_folded_into_TP_or_FP
  Scenario: Unknown findings are never folded into true or false positives
    Given 8 true positives, 1 false positive, 10 unknown and 1 unadjudicated finding
    When the metrics are calculated
    Then they count 20 warned, 8 true positives, 1 false positive and 11 unknown
    And the empirical false-positive rate is 1/9
    And it is neither 1/20 nor 12/20

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::FPR_calculation_and_strict_third-state_rule::empiricalFpr_is_undefined_when_no_findings_are_adjudicated
  Scenario: The false-positive rate is undefined when nothing is adjudicated
    Given two unknown findings and one unadjudicated finding
    When the metrics are calculated
    Then they count 3 warned, 0 true positives, 0 false positives and 3 unknown
    And the empirical false-positive rate is undefined

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::FPR_calculation_and_strict_third-state_rule::handles_empty_findings_list_gracefully
  Scenario: An empty findings list gives zero counts
    Given no findings
    When the metrics are calculated
    Then every count is 0
    And the empirical false-positive rate is undefined

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::Threshold_evaluation_against_promotion_criteria::fails_promotion_when_evaluation_window_is_unmet_(<_50_PRs)
  Scenario: Promotion fails when fewer than 50 PRs are in the window
    Given 25 records, each with one true-positive finding
    When promotion is evaluated against the default criteria
    Then the gate is not promoted and the decision is "remain_warn_only"
    And the window check fails while the coverage and false-positive checks pass
    And a reason says "PR window not met"

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::Threshold_evaluation_against_promotion_criteria::fails_promotion_when_review_coverage_is_below_threshold_(<_80%)
  Scenario: Promotion fails when review coverage is below 80%
    Given 50 records, each with one true positive and four unknown findings
    When promotion is evaluated against the default criteria
    Then the gate is not promoted and the decision is "remain_warn_only"
    And the window check passes and the coverage check fails
    And the review coverage is 0.2
    And a reason says "Review coverage not met"

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::Threshold_evaluation_against_promotion_criteria::fails_promotion_when_empirical_FPR_exceeds_threshold_(>_5%)
  Scenario: Promotion fails when the false-positive rate exceeds 5%
    Given 50 records holding 90 true positives and 10 false positives
    When promotion is evaluated against the default criteria
    Then the gate is not promoted and the decision is "remain_warn_only"
    And the window and coverage checks pass and the false-positive check fails
    And the empirical false-positive rate is 0.1
    And a reason says "Empirical false-positive rate not met"

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::Threshold_evaluation_against_promotion_criteria::fails_promotion_under_CodeAgent_literature_baseline_(48.6%_unconfirmed_rate)
  Scenario: Promotion fails at the literature's 48.6% false-positive rate
    Given 50 records of 10 adjudicated findings each, 243 of the 500 false positives
    When promotion is evaluated with the default criteria
    Then the gate is not promoted and the decision is "remain_warn_only"
    And the empirical false-positive rate is 0.486
    And the window and coverage checks pass while the false-positive rate check fails

  @test:scripts/tests/sdlc/agentic-gate-promotion.test.ts::Threshold_evaluation_against_promotion_criteria::SUCCEEDS_promotion_when_all_criteria_are_met_(window_>=_50,_coverage_>=_80%,_FPR_<=_5%)
  Scenario: Promotion succeeds when window, coverage and false-positive rate are all met
    Given 50 records holding 98 true positives, 2 false positives and 5 unknown findings
    When promotion is evaluated against the default criteria
    Then the gate is promoted and the decision is "promote_to_block"
    And all three checks pass
    And the empirical false-positive rate is 2/100 and the review coverage 100/105
    And a reason says "All criteria met"
