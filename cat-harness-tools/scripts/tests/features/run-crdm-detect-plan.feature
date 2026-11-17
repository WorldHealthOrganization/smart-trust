# Dogfood test plan #1, executed: no threshold, an untainted sampled checker,
# and a process that stops at the certifier's task.
# Each Scenario names the test that executes it.
Feature: Running the CRDM detect evaluation plan

  @test:scripts/tests/run-crdm-detect-plan.test.ts::the_plan_and_the_corpus_agree::one_case_per_issue,_and_every_case_is_answered
  Scenario: One case per corpus issue, every case answered
    Given the crdm-detect-evaluation test plan and its corpus
    Then the plan has as many cases as the corpus has issues
    And the verdicts answer exactly the plan's case ids

  @test:scripts/tests/run-crdm-detect-plan.test.ts::the_plan_and_the_corpus_agree::the_measurement_is_the_one_the_earlier_eval_recorded
  Scenario: The measurement matches the recorded evaluation
    When the detector's outputs over the corpus are measured
    Then the population is 27 with 21 true positives, 1 false positive, 4 true negatives and 1 false negative

  @test:scripts/tests/run-crdm-detect-plan.test.ts::no_threshold_—_a_mismatch_is_recorded,_never_a_failure::mismatches_are_`warn`,_so_nothing_fails_and_the_two_numbers_still_count_them
  Scenario: Mismatches are recorded as warn
    When the test report is built from the verdicts
    Then the rollup has 0 fail, 2 warn and 25 pass

  @test:scripts/tests/run-crdm-detect-plan.test.ts::no_threshold_—_a_mismatch_is_recorded,_never_a_failure::FALSIFICATION:_a_detector_that_gives_no_classification_FAILS_the_case_—_the_required_assertion
  Scenario: A detector giving no classification fails the case
    Given the detector output for the first issue is missing
    When the verdicts are computed
    Then that issue's case result is "fail"

  @test:scripts/tests/run-crdm-detect-plan.test.ts::no_threshold_—_a_mismatch_is_recorded,_never_a_failure::the_tester_is_never_the_system_under_test
  Scenario: The tester is not the system under test
    Then the tester's actor differs from the SUT's actor
    And the tester's id differs from the SUT's actor

  @test:scripts/tests/run-crdm-detect-plan.test.ts::the_untainted_checker::agrees_on_a_faithful_re-execution,_comparing_only_what_it_sampled
  Scenario: The checker agrees on a faithful re-execution of its sample
    When the checker re-executes a sample of the report
    Then it reports "agree"
    And it sampled one fifth of the corpus, rounded up

  @test:scripts/tests/run-crdm-detect-plan.test.ts::the_untainted_checker::FALSIFICATION:_a_re-execution_that_classifies_differently_disagrees
  Scenario: A re-execution that classifies differently disagrees
    When the checker re-executes with a detector that inverts every firing
    Then it reports "disagree" with at least one disagreement

  @test:scripts/tests/run-crdm-detect-plan.test.ts::the_untainted_checker::an_empty_sample_is_`unknown`,_never_agreement
  Scenario: An empty sample is unknown
    When the checker runs over an empty corpus
    Then it reports "unknown"

  @test:scripts/tests/run-crdm-detect-plan.test.ts::through_test-plan-execution.bpmn::the_plan's_own_DMN_routes_to_the_CERTIFIER's_user_task_—_the_process_does_not_certify_itself
  Scenario: An agreeing checker routes to the certifier's task
    Given test-plan-execution.bpmn advanced by the tester through every step up to the sample re-execution
    When the exit criteria gateway is completed with the checker agreeing
    Then the only enabled node is A_RecordCertification

  @test:scripts/tests/run-crdm-detect-plan.test.ts::through_test-plan-execution.bpmn::FALSIFICATION:_a_checker_that_disagrees_is_undetermined,_not_certified
  Scenario: A disagreeing checker routes to undetermined
    Given the same process advanced to the exit criteria gateway
    When it is completed with the checker disagreeing
    Then the only enabled node is A_RecordUndetermined
