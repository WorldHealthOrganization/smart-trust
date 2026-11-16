# The compare job's push steps in .github/workflows/layer-pr-checks.yml, run as the workflow's own
# shell with a stub main-verdict.py: a push that ran nothing on purpose is deferred, and one that
# should have been judged but has no answer fails. Each Scenario names the test that executes it.
Feature: Deferred verdicts on a push to main

  @test:test/layer-pr-checks-deferred-verdict.test.ts::compare,_on_a_push:_main's_verdict_says_DEFERRED_when_nothing_ran_on_purpose_(Q-MQA-2_A)::a_batched_push:_unknown,_with_failures_naming_the_window_and_who_judges_it
  Scenario: A batched push is unknown, with failures naming the window and who judges it
    Given the compare step "Main's own verdict (a push)" and a main-verdict.py that says unknown
    When it runs on a push that did not join, deferred as "batched" in window 29634512
    Then it exits 0 with verdict "unknown"
    And the failures' deferred reason names "window 29634512"
    And the failures say it is judged by "the next window's first push"

  @test:test/layer-pr-checks-deferred-verdict.test.ts::compare,_on_a_push:_main's_verdict_says_DEFERRED_when_nothing_ran_on_purpose_(Q-MQA-2_A)::a_pins-only_push:_unknown_and_deferred
  Scenario: A pins-only push is deferred
    # Gap: the verdict output itself is not asserted, only the deferred reason.
    Given the compare step "Main's own verdict (a push)" and a main-verdict.py that says unknown
    When it runs on a push that did not join, deferred as "pins-only"
    Then the failures' deferred reason holds "pins-only"

  @test:test/layer-pr-checks-deferred-verdict.test.ts::compare,_on_a_push:_main's_verdict_says_DEFERRED_when_nothing_ran_on_purpose_(Q-MQA-2_A)::a_push_that_should_have_been_judged:_main-verdict.py's_own_answer,_unchanged
  Scenario: A push that should have been judged keeps main-verdict.py's own answer
    Given the compare step "Main's own verdict (a push)" and a main-verdict.py that says unknown
    When it runs on a push that did not join and is not deferred
    Then the verdict is "unknown"
    And the failures are exactly main-verdict.py's error that base-results/gates.json could not be read

  @test:test/layer-pr-checks-deferred-verdict.test.ts::compare,_on_a_push:_main's_verdict_says_DEFERRED_when_nothing_ran_on_purpose_(Q-MQA-2_A)::a_judged_push_that_is_green_stays_green,_deferred_or_not
  Scenario: A judged push that is green stays green, deferred or not
    Given the compare step "Main's own verdict (a push)" and a main-verdict.py that says green
    When it runs on a push that joined, deferred as "batched" in window 1
    Then the verdict is "green"

  @test:test/layer-pr-checks-deferred-verdict.test.ts::compare,_on_a_push:_one_that_should_have_been_judged_and_has_no_answer_fails_(Q-MQA-2_B)::unknown_and_not_deferred:_red,_saying_could_not_determine
  Scenario: An unknown push that is not deferred is red
    Given the compare step "A push that should have been judged has main's answer"
    When it runs with verdict "unknown", no deferral, and the base prepared
    Then it exits 1
    And its output holds "::error::this push should have been judged"

  @test:test/layer-pr-checks-deferred-verdict.test.ts::compare,_on_a_push:_one_that_should_have_been_judged_and_has_no_answer_fails_(Q-MQA-2_B)::unknown_but_deferred,_or_a_real_verdict:_passes
  Scenario: An unknown push that is deferred, or a real verdict, passes the guard
    Given the compare step "A push that should have been judged has main's answer"
    When it runs with verdict "unknown" deferred as "batched" or as "pins-only"
    Then it exits 0
    And verdict "green" or "red" with the base prepared also exits 0

  @test:test/layer-pr-checks-deferred-verdict.test.ts::prepare-base_says_why_a_push_ran_nothing::its_skip-prep_step_writes_`deferred`,_and_the_job_exposes_it_with_the_window
  Scenario: prepare-base exposes why a push ran nothing, with its window
    # Gap: a source-text check of the workflow; the skip-prep step is not run.
    Given .github/workflows/layer-pr-checks.yml
    When its text is read
    Then it maps "deferred" to the skip-prep step's deferred output
    And it maps "window" to the integ-bucket step's bucket output
    And it writes "deferred=$deferred" to GITHUB_OUTPUT
