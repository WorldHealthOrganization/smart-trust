# src/workflow/ci-health.ts classifies each workflow's recent runs (green, red, running, no-runs, superseded) and renders the
# CI-health report, which never shows "could not check", an unjudged head or a silent workflow as green.
# Each Scenario names the test that executes it.
Feature: CI health of a branch's workflows

  @test:scripts/tests/sdlc/ci-health.test.ts::classifying_one_workflow's_history::latest_success_is_green,_with_no_failure_count
  Scenario: A latest success is green with no failure count
    Given a workflow whose newest run succeeded after an older failure
    When its runs are classified
    Then it is "green" with 0 consecutive failures

  @test:scripts/tests/sdlc/ci-health.test.ts::classifying_one_workflow's_history::consecutive_failures_are_counted_from_the_newest_run_backwards
  Scenario: Consecutive failures are counted from the newest run back
    Given three newest failures, then a success on 2026-08-20, then an older failure
    When the runs are classified at 2026-08-26 noon
    Then it is "red" with 3 consecutive failures
    And daysSinceSuccess is 6

  @test:scripts/tests/sdlc/ci-health.test.ts::classifying_one_workflow's_history::no_success_anywhere_in_the_window_leaves_daysSinceSuccess_undefined
  Scenario: No success in the window leaves the days since success undefined
    Given only failed runs
    When the runs are classified
    Then it is "red"
    And daysSinceSuccess and lastSuccess are undefined

  @test:scripts/tests/sdlc/ci-health.test.ts::classifying_one_workflow's_history::a_run_still_in_flight_is_not_a_verdict_either_way
  Scenario: A run still in flight is reported as running
    Given a single run that is in progress with no conclusion
    When the runs are classified
    Then it is "running"

  @test:scripts/tests/sdlc/ci-health.test.ts::classifying_one_workflow's_history::cancelled_and_skipped_runs_are_not_the_workflow's_fault,_and_are_ignored
  Scenario: Cancelled and skipped runs are ignored
    Given a cancelled run and a skipped run newer than a success
    When the runs are classified
    Then it is "green" with 0 consecutive failures

  @test:scripts/tests/sdlc/ci-health.test.ts::classifying_one_workflow's_history::no_runs_at_all_is_its_own_state,_not_green
  Scenario: No runs at all is its own state
    Given no runs
    When they are classified
    Then the health is "no-runs"

  @test:scripts/tests/sdlc/ci-health.test.ts::assessing_a_whole_repo::runs_are_grouped_by_workflow,_newest_first
  Scenario: Runs are grouped by workflow, newest first
    Given runs of Docs site, Code-quality gates and QA sweep
    When they are grouped by workflow
    Then there are exactly those three groups
    And the Docs site group starts with its newest run

  @test:scripts/tests/sdlc/ci-health.test.ts::assessing_a_whole_repo::the_worst_workflow_sorts_first_—_one_line_read_should_be_the_worst_one
  Scenario: The worst workflow sorts first
    Given Docs site failing twice, Code-quality gates green and QA sweep failed long ago
    When the repo is assessed
    Then the first row is Docs site with 2 consecutive failures
    And the last row is Code-quality gates

  @test:scripts/tests/sdlc/ci-health.test.ts::assessing_a_whole_repo::runs_of_a_DELETED_workflow_are_history,_not_a_live_problem
  Scenario: Runs of a deleted workflow are dropped while live failures stay
    Given a failed run of a workflow file that no longer exists, alongside a failing Docs site
    When the repo is assessed with a workflowExists predicate
    Then the deleted workflow is not a row
    And Docs site still is

  @test:scripts/tests/sdlc/ci-health.test.ts::assessing_a_whole_repo::without_a_workflowExists_predicate_nothing_is_filtered
  Scenario: Without a workflowExists predicate nothing is filtered
    Given a failed run of a workflow "Gone"
    When the repo is assessed with no workflowExists predicate
    Then "Gone" is still a row

  @test:scripts/tests/sdlc/ci-health.test.ts::age_separates_an_active_fire_from_a_stale_scorch_mark::a_red_that_has_not_re-run_in_a_week_is_flagged_as_possibly_stale
  Scenario: A red that has not re-run in a week is flagged as possibly stale
    Given QA sweep's last runs failed on 2026-08-07
    When the report is rendered on 2026-08-26
    Then it says "has not run in 18d"
    And it says "may be stale"

  @test:scripts/tests/sdlc/ci-health.test.ts::age_separates_an_active_fire_from_a_stale_scorch_mark::a_red_that_ran_today_is_NOT_softened_as_stale
  Scenario: A red that ran today is not softened as stale
    Given Docs site failed earlier the same day
    When the report is rendered
    Then it says "last ran 0d ago"
    And it does not say "may be stale"

  @test:scripts/tests/sdlc/ci-health.test.ts::rendering,_and_the_thing_it_must_never_do::an_unreachable_API_renders_as_unknown,_never_as_green
  Scenario: An unreachable API renders as unknown, never green
    Given the GitHub API returned 403
    When the report is rendered
    Then it says "Not checked" and "treat as unknown, not as green"
    And it shows no tick and no "green ("

  @test:scripts/tests/sdlc/ci-health.test.ts::rendering,_and_the_thing_it_must_never_do::a_failing_workflow_is_named_with_its_failure_count_and_staleness
  Scenario: A failing workflow is named with its failure count and staleness
    Given Docs site failed twice with no success
    When the report is rendered
    Then it names "Docs site"
    And it says "2 consecutive failure(s)" and "no success in the window"

  @test:scripts/tests/sdlc/ci-health.test.ts::rendering,_and_the_thing_it_must_never_do::all_green_says_so_explicitly_rather_than_printing_nothing
  Scenario: All green is said explicitly
    Given a single green workflow
    When the report is rendered
    Then it says "every workflow with a recent run"

  @test:scripts/tests/sdlc/ci-health.test.ts::rendering,_and_the_thing_it_must_never_do::no_runs_in_the_window_is_stated,_not_rendered_as_green
  Scenario: No runs in the window is stated, not rendered as green
    Given no workflows at all
    When the report is rendered
    Then it says "No runs on"
    And it does not say "green"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_verdict_against_a_file_that_has_since_changed::a_red_whose_file_changed_after_the_failure_is_superseded,_not_red
  Scenario: A red whose file changed after the failure is superseded
    Given qa-sweep.yml failed on 2026-08-07 and its file changed on 2026-08-08
    When the repo is assessed
    Then its health is "superseded", supersededBy that change time

  @test:scripts/tests/sdlc/ci-health.test.ts::a_verdict_against_a_file_that_has_since_changed::a_red_whose_file_changed_BEFORE_the_failure_stays_red
  Scenario: A red whose file changed before the failure stays red
    Given qa-sweep.yml failed on 2026-08-07 and its file last changed on 2026-08-01
    When the repo is assessed
    Then its health is "red" with no supersededBy

  @test:scripts/tests/sdlc/ci-health.test.ts::a_verdict_against_a_file_that_has_since_changed::without_a_workflowChangedAt_predicate_nothing_is_superseded
  Scenario: Without a workflowChangedAt predicate nothing is superseded
    Given qa-sweep.yml failed
    When the repo is assessed with no workflowChangedAt predicate
    Then its health is "red"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_verdict_against_a_file_that_has_since_changed::git_answering_`undefined`_—_a_shallow_clone_—_leaves_it_red
  Scenario: A change time git cannot answer leaves the red standing
    Given qa-sweep.yml failed and workflowChangedAt answers undefined
    When the repo is assessed
    Then its health is "red"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_verdict_against_a_file_that_has_since_changed::a_GREEN_workflow_is_never_touched_by_the_rule
  Scenario: A green workflow is never superseded
    Given a green Code-quality gates run whose file changed afterwards
    When the repo is assessed
    Then its health is "green"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_verdict_against_a_file_that_has_since_changed::a_run_with_no_path_cannot_be_superseded
  Scenario: A run with no path cannot be superseded
    Given a failed run with no path and a later change time
    When the repo is assessed
    Then its health is "red"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_verdict_against_a_file_that_has_since_changed::superseded_renders_below_the_fold,_and_NEVER_as_green
  Scenario: Superseded renders as stale, never as green
    # Gap: the "below the fold" placement is not checked, only the wording
    Given qa-sweep.yml superseded by a later change
    When the report is rendered
    Then it says "stale, not green"
    And it does not say "every workflow with a recent run"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_verdict_against_a_file_that_has_since_changed::a_live_red_still_sorts_above_a_superseded_one
  Scenario: A live red sorts above a superseded one
    Given a superseded qa-sweep.yml and a live failing Docs site
    When the repo is assessed
    Then the first row is Docs site, "red"
    And the last row is "superseded"

  @test:scripts/tests/sdlc/ci-health.test.ts::an_unsettled_newest_run_never_reads_as_a_verdict_about_the_head::newest_in_flight_over_an_older_success_is_flagged,_not_reported_as_green
  Scenario: A newest run in flight over an older success is flagged
    Given a newest run in progress over an older success
    When the workflow is assessed
    Then its health is "green" with newestUnsettled true

  @test:scripts/tests/sdlc/ci-health.test.ts::an_unsettled_newest_run_never_reads_as_a_verdict_about_the_head::a_queued_newest_run_counts_the_same_as_one_in_flight
  Scenario: A queued newest run is flagged like one in flight
    Given a newest queued run over an older success
    When the workflow is assessed
    Then newestUnsettled is true

  @test:scripts/tests/sdlc/ci-health.test.ts::an_unsettled_newest_run_never_reads_as_a_verdict_about_the_head::a_cancelled_newest_run_counts_too_—_completed_is_not_the_same_as_judged
  Scenario: A cancelled newest run is flagged as unsettled
    Given a newest cancelled run over an older success
    When the workflow is assessed
    Then newestUnsettled is true

  @test:scripts/tests/sdlc/ci-health.test.ts::an_unsettled_newest_run_never_reads_as_a_verdict_about_the_head::the_summary_line_does_not_say_every_workflow_is_green
  Scenario: An unsettled newest run withholds the all-green summary
    Given a newest run in progress over an older success
    When the report is rendered
    Then it does not say "every workflow with a recent run"
    And it says "has not reported" and "the head has not been judged"

  @test:scripts/tests/sdlc/ci-health.test.ts::an_unsettled_newest_run_never_reads_as_a_verdict_about_the_head::a_settled_newest_run_is_not_flagged_—_the_ordinary_case_is_unchanged
  Scenario: A settled newest run is not flagged
    Given two successful runs
    When the workflow is assessed
    Then it is "green" with newestUnsettled unset
    And the rendered report says "every workflow with a recent run"

  @test:scripts/tests/sdlc/ci-health.test.ts::an_unsettled_newest_run_never_reads_as_a_verdict_about_the_head::the_trend_survives:_red_with_a_run_in_flight_is_still_red,_and_still_flagged
  Scenario: A red with a run in flight stays red and is flagged
    Given a run in progress over two failures
    When the workflow is assessed
    Then it is "red" with 2 consecutive failures
    And newestUnsettled is true

  @test:scripts/tests/sdlc/ci-health.test.ts::an_unsettled_newest_run_never_reads_as_a_verdict_about_the_head::`running`_is_not_doubly_reported_—_nothing_settled_stays_just_`running`
  Scenario: A workflow with nothing settled is just running
    Given a single run in progress
    When the workflow is assessed
    Then it is "running" with newestUnsettled unset

  @test:scripts/tests/sdlc/ci-health.test.ts::no_run_for_the_head_is_reported_—_but_only_where_a_run_was_owed::a_workflow_that_runs_on_push_and_has_no_run_for_the_head_is_flagged
  Scenario: A push-triggered workflow with no run for the head is flagged
    Given a push-triggered workflow whose only run is for an older commit
    When it is assessed against the head sha
    Then it is "green" with headUnjudged true

  @test:scripts/tests/sdlc/ci-health.test.ts::no_run_for_the_head_is_reported_—_but_only_where_a_run_was_owed::a_dispatch-only_workflow_is_NOT_flagged_—_it_never_owed_a_run
  Scenario: A dispatch-only workflow with no run for the head is not flagged
    Given a workflow that does not trigger on push, whose only run is for an older commit
    When it is assessed against the head sha
    Then headUnjudged is unset

  @test:scripts/tests/sdlc/ci-health.test.ts::no_run_for_the_head_is_reported_—_but_only_where_a_run_was_owed::an_unreadable_trigger_block_claims_nothing
  Scenario: An unreadable trigger block claims nothing
    Given a workflow whose push trigger cannot be read, with no run for the head
    When it is assessed against the head sha
    Then headUnjudged is unset

  @test:scripts/tests/sdlc/ci-health.test.ts::no_run_for_the_head_is_reported_—_but_only_where_a_run_was_owed::no_head_supplied_claims_nothing_—_not_knowing_is_not_a_finding
  Scenario: No head sha claims nothing
    Given a push-triggered workflow with only an older run
    When it is assessed with no head sha
    Then headUnjudged is unset

  @test:scripts/tests/sdlc/ci-health.test.ts::no_run_for_the_head_is_reported_—_but_only_where_a_run_was_owed::a_run_that_DID_judge_the_head_clears_it,_even_in_flight
  Scenario: A run for the head clears the flag even while in flight
    Given an in-progress run for the head over an older run
    When the push-triggered workflow is assessed against the head sha
    Then headUnjudged is unset
    And newestUnsettled is true

  @test:scripts/tests/sdlc/ci-health.test.ts::no_run_for_the_head_is_reported_—_but_only_where_a_run_was_owed::the_summary_refuses_'all_green'_and_says_which_silence_it_is
  Scenario: An unjudged head withholds all-green and names the silence
    Given a push-triggered workflow with no run for the head
    When the report is rendered
    Then it does not say "every workflow with a recent run"
    And it says "no run has judged the current head" and "the head has not been judged"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_that_did_not_run_is_a_row,_not_an_absence::a_file_with_no_runs_becomes_a_no-runs_row
  Scenario: A workflow file with no runs becomes a no-runs row
    Given three workflow files and runs of only Docs site
    When the repo is assessed with the known workflows
    Then all three are rows
    And CI health watchdog and QA sweep are marked noRunsInWindow

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_that_did_not_run_is_a_row,_not_an_absence::omitting_the_file_list_changes_nothing_—_not_looking_must_not_invent_rows
  Scenario: Omitting the file list adds no rows
    Given runs of only Docs site
    When the repo is assessed with no known workflows, and with an empty list
    Then both times the only row is Docs site

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_that_did_not_run_is_a_row,_not_an_absence::a_no-runs_row_is_never_counted_as_green
  Scenario: A no-runs row is not counted as green
    Given three workflow files and runs of only Docs site
    When the report is rendered
    Then the green count reads "(1)"
    And it says "2 other workflow file(s) produced no run"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_that_did_not_run_is_a_row,_not_an_absence::scheduled_is_carried_from_the_caller,_and_unknown_stays_unset
  Scenario: The scheduled flag comes from the caller and an unknown stays unset
    Given a hasSchedule predicate true for ci-health.yml and undefined otherwise
    When the repo is assessed with the known workflows
    Then CI health watchdog is scheduled
    And QA sweep's scheduled flag is unset, not false

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_that_did_not_run_is_a_row,_not_an_absence::a_scheduled_workflow_with_no_runs_is_named,_not_folded_into_the_count
  Scenario: A scheduled workflow with no runs is named and withholds the tick
    Given ci-health.yml is scheduled and has no runs
    When the report is rendered
    Then it names "**CI health watchdog**" and says "fires on a schedule"
    And it has no "✓ every workflow" and says 'Not "all green"'

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_that_did_not_run_is_a_row,_not_an_absence::never-ran_and_could-not-ask_are_DIFFERENT_findings
  Scenario: Never-ran and could-not-ask render as different findings
    Given scheduled workflows with no runs, probed once as "never-ran" and once as "unknown"
    When each report is rendered
    Then the never-ran report says "never run on this branch" and not "request failed"
    And the unknown report says "request failed" and not "never run on this branch"
    And neither has "✓ every workflow"

  @test:scripts/tests/sdlc/ci-health.test.ts::the_window_is_a_page_of_runs,_not_a_period::the_span_is_reported,_so_a_reader_can_see_what_the_report_could_reach
  Scenario: The span of the runs window is reported
    Given a window of 100 runs from 08:14:57 to 14:19:14 on 2026-09-20
    When the report is rendered
    Then it says "100 recent run(s) spanning 6.1h"

  @test:scripts/tests/sdlc/ci-health.test.ts::the_window_is_a_page_of_runs,_not_a_period::a_long_window_reads_in_days,_a_short_one_in_minutes
  Scenario: A long window reads in days and a short one in minutes
    Given windows of ten days and of thirty minutes
    When each is described
    Then they read "10.0d" and "30m"

  @test:scripts/tests/sdlc/ci-health.test.ts::the_window_is_a_page_of_runs,_not_a_period::no_window_is_reported_rather_than_a_zero-length_one
  Scenario: No window is reported as no span
    Given no window
    When the report is rendered
    Then it does not say "spanning"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_too_new_to_have_fired_is_not_a_finding::the_real_case:_added_yesterday,_fires_Tuesdays_—_not_yet_run
  Scenario: A scheduled workflow added yesterday that fires Tuesdays is too young
    Given upstream-pins.yml added 2026-09-19, cron "43 9 * * 2", probed as never-ran, assessed on 2026-09-20
    When the repo is assessed
    Then its row is tooYoung with fileAgeDays 1

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_too_new_to_have_fired_is_not_a_finding::...and_the_report_says_so_instead_of_raising_it
  Scenario: A too-young workflow is reported as not yet due, not as a finding
    Given upstream-pins.yml added the day before with a Tuesday cron and no runs
    When the report is rendered
    Then it says "its schedule has not come round"
    And it does not say "never run on this branch"
    And it says "✓ every workflow"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_too_new_to_have_fired_is_not_a_finding::an_OLD_workflow_that_has_never_run_is_still_a_finding
  Scenario: An old workflow that never ran is still a finding
    Given upstream-pins.yml added two months earlier with a weekly cron and no runs
    When the report is rendered
    Then it says "never run on this branch"
    And it does not say "has not come round" or "✓ every workflow"

  @test:scripts/tests/sdlc/ci-health.test.ts::a_workflow_too_new_to_have_fired_is_not_a_finding::an_unreadable_age_or_cron_leaves_it_a_finding_—_never_explained_away
  Scenario: An unreadable age or cron leaves the workflow a finding
    Given a never-run scheduled workflow with an unknown add date, or an unknown cron, or the cron "30 2 1 * 3"
    When each report is rendered
    Then each says "never run on this branch"

  @test:scripts/tests/sdlc/ci-health.test.ts::cronPeriodDays_—_the_longest_gap,_or_nothing::the_two_real_schedules_in_this_repo
  Scenario: The repo's real schedules give their longest gap
    Given the crons "43 9 * * 2", "17 9 * * 1" and "41 6 * * *"
    When their period is read
    Then they are 7, 7 and 1 days

  @test:scripts/tests/sdlc/ci-health.test.ts::cronPeriodDays_—_the_longest_gap,_or_nothing::sub-daily_is_capped_at_a_day_—_nothing_is_ever_too_young_by_more
  Scenario: Sub-daily schedules are capped at one day
    Given the crons "0 */4 * * *" and "* * * * *"
    When their period is read
    Then both are 1 day

  @test:scripts/tests/sdlc/ci-health.test.ts::cronPeriodDays_—_the_longest_gap,_or_nothing::a_day-of-month_schedule_is_a_month_at_worst
  Scenario: A day-of-month schedule is a month at worst
    Given the cron "0 3 1 * *"
    When its period is read
    Then it is 31 days

  @test:scripts/tests/sdlc/ci-health.test.ts::cronPeriodDays_—_the_longest_gap,_or_nothing::what_it_refuses,_and_refusing_is_the_point
  Scenario: Schedules it cannot read give no period
    Given the crons "30 2 1 * 3", "not a cron" and the four-field "0 3 * *"
    When their period is read
    Then each is undefined
