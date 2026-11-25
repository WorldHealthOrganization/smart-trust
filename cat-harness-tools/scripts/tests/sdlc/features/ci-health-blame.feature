# src/workflow/ci-health.ts blames a red main on a merge only after checking its parent: blameFailingRun walks
# first parents back to the last green, and returns cannot-determine for a missing run, a failed lookup, a root or the walk cap.
# Each Scenario names the test that executes it.
Feature: Blaming a red main on a merge

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::the_parent_is_checked_before_the_last_merge_is_blamed::parent_green_->_the_failing_commit_is_the_suspect,_stepsBack_0
  Scenario: A green parent makes the failing commit the suspect
    Given a first-parent chain of "failure" then "success"
    When the failing run is blamed
    Then the verdict is a suspect naming the failing commit, its parent, and stepsBack 0

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::the_parent_is_checked_before_the_last_merge_is_blamed::parent_ALSO_red_->_the_walk_goes_back,_and_the_last_merge_is_not_blamed
  Scenario: A red parent sends the walk back instead of blaming the last merge
    Given a first-parent chain of "failure", "failure", "success"
    When the failing run is blamed
    Then the suspect is the parent commit, with the green commit as its parent and stepsBack 1
    And the rendered line says "1 merge(s) before the failing one"
    And the rendered line cites "391j"

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::the_parent_is_checked_before_the_last_merge_is_blamed::a_long_red_stretch_is_walked_to_its_start
  Scenario: A long red stretch is walked back to its first red commit
    Given a chain of four "failure" commits followed by a "success"
    When the failing run is blamed
    Then the suspect is the fourth commit, with stepsBack 3

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::`none`_is_not_`success`_—_the_rule_this_exists_to_hold::a_parent_with_NO_run_yields_cannot-determine,_never_a_suspect
  Scenario: A parent with no run yields cannot-determine, never a suspect
    Given a chain of "failure", "none", "success"
    When the failing run is blamed
    Then the verdict is cannot-determine, why "no-run-on-parent", at the parent, stepsBack 0
    And the rendered line says "could not determine"
    And the rendered line says "not a commit that passed"

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::`none`_is_not_`success`_—_the_rule_this_exists_to_hold::it_does_NOT_keep_walking_past_the_gap_to_find_a_green_further_back
  Scenario: The walk stops at a commit with no run rather than skipping to a green further back
    Given a chain of "failure", "none", "success", "success"
    When the failing run is blamed
    Then the verdict is cannot-determine with why "no-run-on-parent"

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::`none`_is_not_`success`_—_the_rule_this_exists_to_hold::a_failed_lookup_is_its_own_answer,_not_a_missing_run
  Scenario: A failed lookup is reported as its own reason, not as a missing run
    Given a chain of "failure", "unknown", "success"
    When the failing run is blamed
    Then the verdict is cannot-determine with why "lookup-failed"

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::the_walk_is_bounded,_and_says_so_when_it_hits_the_bound::all_red_to_the_cap_->_walk-exhausted,_and_the_report_says_it_is_not_recent
  Scenario: A chain red past the cap ends as walk-exhausted
    Given a chain of BLAME_WALK_CAP + 5 "failure" commits and the cap set to BLAME_WALK_CAP
    When the failing run is blamed
    Then the verdict is cannot-determine with why "walk-exhausted"
    And the rendered line says "it is not the recent merges"

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::the_walk_is_bounded,_and_says_so_when_it_hits_the_bound::the_cap_IS_the_budget:_it_examines_exactly_`cap`_parents,_no_more
  Scenario: The walk examines exactly cap parents and no more
    Given a chain of four "failure" commits followed by a "success"
    When the failing run is blamed with cap 4
    Then the verdict is a suspect with stepsBack 3
    And with cap 3 the verdict is "walk-exhausted" with stepsBack 3, the green never reached

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::the_walk_is_bounded,_and_says_so_when_it_hits_the_bound::`walk-exhausted`_reports_the_cap_itself,_which_is_what_renderBlame_prints
  Scenario: A walk-exhausted verdict reports the cap, and the rendered line prints the same number
    Given a chain of BLAME_WALK_CAP + 5 "failure" commits and the default cap
    When the failing run is blamed
    Then the verdict is cannot-determine, why "walk-exhausted", with stepsBack equal to BLAME_WALK_CAP
    And the rendered line says "<BLAME_WALK_CAP> first-parents back"

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::the_walk_is_bounded,_and_says_so_when_it_hits_the_bound::a_root_commit_ends_the_walk_as_no-parent,_not_as_a_suspect
  Scenario: A root commit ends the walk as no-parent, not as a suspect
    Given a chain holding only one "failure" commit
    When the failing run is blamed
    Then the verdict is cannot-determine, why "no-parent", at that commit
    And the rendered line says "no first parent"

  @test:scripts/tests/sdlc/ci-health-blame.test.ts::every_verdict_renders_as_a_statement,_never_as_silence::no_verdict_renders_empty,_and_every_cannot-determine_says_so_in_words
  Scenario: Every verdict renders as a non-empty line, and every cannot-determine says so
    Given the chains failure/success, failure/failure/success, failure/none, failure/unknown and a lone failure
    When each is blamed and rendered
    Then no rendered line is empty
    And every cannot-determine line says "could not determine"
