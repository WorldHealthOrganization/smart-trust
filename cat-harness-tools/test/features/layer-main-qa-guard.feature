# The main-red step of .github/workflows/layer-main-qa.yml, run as the workflow's own shell with a
# stub pre-#1961 report.py and a fake gh: an unknown verdict on main's head is red unless
# layer-pr-checks marked it deferred. Each Scenario names the test that executes it.
Feature: The main-QA step guards an unknown verdict

  @test:test/layer-main-qa-guard.test.ts::layer-main-qa.yml:_an_unknown_verdict_is_red_even_with_a_pinned_report.py_from_before_#1961::unknown_on_main's_head,_report.py_exits_0:_the_step_is_red_(2)
  Scenario: An unknown verdict on main's head is red even when report.py exits 0
    Given the step script with a stub report.py that exits 0
    And main's head is the judged commit
    When the step runs with verdict "unknown" and no failures
    Then it exits 2
    And its output holds "::error::main's verdict"

  @test:test/layer-main-qa-guard.test.ts::layer-main-qa.yml:_an_unknown_verdict_is_red_even_with_a_pinned_report.py_from_before_#1961::unknown_but_DEFERRED_(batched,_or_pins_only)_on_main's_head_is_not_a_failure_(0)
  Scenario: A deferred unknown on main's head is not a failure
    Given the step script with a stub report.py that exits 0
    And main's head is the judged commit
    When the step runs with verdict "unknown" and failures marked deferred as "batched"
    Then it exits 0 and its output says the verdict "is deferred"
    And failures marked deferred as "pins-only" also exit 0

  @test:test/layer-main-qa-guard.test.ts::layer-main-qa.yml:_an_unknown_verdict_is_red_even_with_a_pinned_report.py_from_before_#1961::a_pinned_report.py_from_#1961_on_exits_2_on_every_unknown;_a_DEFERRED_one_still_ends_green_(two_layers'_main_went_red_that_way,_2026-11-12)
  Scenario: A deferred unknown ends green even when the pinned report.py exits 2
    Given a stub report.py that exits 2, and main's head is the judged commit
    When the step runs with verdict "unknown" and failures marked deferred as "batched"
    Then it exits 0 and its output says the verdict "is deferred"
    And with failures holding only an error, not deferred, it exits 2

  @test:test/layer-main-qa-guard.test.ts::layer-main-qa.yml:_an_unknown_verdict_is_red_even_with_a_pinned_report.py_from_before_#1961::unknown_with_failures_that_say_nothing_of_deferral,_or_are_not_JSON,_is_still_red_(2)
  Scenario: An unknown whose failures say nothing of deferral, or are not JSON, stays red
    Given a stub report.py that exits 0, and main's head is the judged commit
    When the step runs with verdict "unknown" and failures holding only an error
    Then it exits 2
    And with failures "not json" it also exits 2

  @test:test/layer-main-qa-guard.test.ts::layer-main-qa.yml:_an_unknown_verdict_is_red_even_with_a_pinned_report.py_from_before_#1961::unknown_on_a_commit_main_has_moved_past:_left_to_the_newer_push_(0)
  Scenario: An unknown on a commit main has moved past is left to the newer push
    Given a stub report.py that exits 0
    And main's head is a different commit
    When the step runs with verdict "unknown"
    Then it exits 0

  @test:test/layer-main-qa-guard.test.ts::layer-main-qa.yml:_an_unknown_verdict_is_red_even_with_a_pinned_report.py_from_before_#1961::green_passes,_red_stays_red,_and_a_report.py_that_already_said_2_keeps_it
  Scenario: Green passes, red stays red, and a report.py exit of 2 is kept
    Given main's head is the judged commit
    When the step runs with verdict "green" and report.py exiting 0
    Then it exits 0
    And verdict "red" with report.py exiting 1 exits 1
    And verdict "unknown" with report.py exiting 2 exits 2
