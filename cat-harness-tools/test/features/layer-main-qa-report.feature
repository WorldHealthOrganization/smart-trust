# .github/scripts/layer-main-qa/report.py, which keeps the main-red issue in step with main's
# verdict, run against a fake gh that logs its calls: a verdict that could not be determined is
# never green. Each Scenario names the test that executes it.
Feature: The main-QA report never turns an unknown verdict green

  @test:test/layer-main-qa-report.test.ts::layer-main-qa_report.py:_could_not_determine_is_never_green::an_unknown_verdict_on_main's_head_is_red_(exit_2),_and_the_issue_is_not_touched
  Scenario: An unknown verdict on main's head is red and leaves the issue alone
    Given main's head is the judged commit
    When report.py runs with verdict "unknown" and failures saying "gates.json missing"
    Then it exits 2
    And its output holds "::error::main's verdict" and "gates.json missing"
    And it makes no POST, no PATCH and no issues call

  @test:test/layer-main-qa-report.test.ts::layer-main-qa_report.py:_could_not_determine_is_never_green::a_DEFERRED_unknown_on_main's_head_(a_batched_or_pins-only_push)_is_not_a_failure_(exit_0),_and_the_issue_is_not_touched
  Scenario: A deferred unknown on main's head is not a failure and leaves the issue alone
    Given main's head is the judged commit
    When report.py runs with verdict "unknown" and failures marked deferred as batched
    Then it exits 0
    And its output says "deferred"
    And it makes no POST, no PATCH and no issues call

  @test:test/layer-main-qa-report.test.ts::layer-main-qa_report.py:_could_not_determine_is_never_green::an_unknown_verdict_on_a_commit_main_has_moved_past_is_left_to_the_newer_push_(exit_0)
  Scenario: An unknown verdict on a commit main has moved past is left to the newer push
    Given main's head is a different commit
    When report.py runs with verdict "unknown"
    Then it exits 0
    And its output says main has "moved on"
    And it makes no POST and no PATCH call

  @test:test/layer-main-qa-report.test.ts::layer-main-qa_report.py:_could_not_determine_is_never_green::green_on_main's_head_still_passes_(exit_0)
  Scenario: Green on main's head passes
    Given main's head is the judged commit
    When report.py runs with verdict "green"
    Then it exits 0
