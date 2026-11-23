# src/workflow/ci-health.ts: pure reducers over GitHub's Pages deployment runs and publish-branch
# commits (pagesHealth, slugOfDeployCommit, selfSupersedes) and renderPages, the report section.
# Each Scenario names the test that executes it.
Feature: Pages build outcome

  @test:scripts/tests/ui/pages-health.test.ts::pagesHealth_—_cancelled_is_a_third_state::a_cancelled_deployment_is_neither_success_nor_failure
  Scenario: A cancelled deployment is neither success nor failure
    Given one cancelled Pages run
    When Pages health is computed
    Then cancelled is 1
    And success, failure and unsettled are each 0

  @test:scripts/tests/ui/pages-health.test.ts::pagesHealth_—_cancelled_is_a_third_state::the_four_settled_states_and_the_unsettled_one_partition_the_runs
  Scenario: The settled states and the unsettled one partition the runs
    Given Pages runs: two cancelled, one success, one failure, one in progress and one skipped
    When Pages health is computed
    Then total is 6, cancelled 2, success 1, failure 1 and unsettled 2
    And success, cancelled, failure and unsettled add up to the total

  @test:scripts/tests/ui/pages-health.test.ts::pagesHealth_—_cancelled_is_a_third_state::only_the_Pages_workflow_is_counted
  Scenario: Only the Pages workflow is counted
    Given a successful Pages run and failed "Docs site" and "CI health" runs
    When Pages health is computed
    Then total is 1
    And failure is 0

  @test:scripts/tests/ui/pages-health.test.ts::pagesHealth_—_cancelled_is_a_third_state::the_workflow_name_is_matched_case-insensitively
  Scenario: The Pages workflow name is matched case-insensitively
    Given a run named "Pages build and deployment" with a capital P
    When Pages health is computed
    Then total is 1
    And the Pages workflow constant is all lowercase

  @test:scripts/tests/ui/pages-health.test.ts::pagesHealth_—_cancelled_is_a_third_state::no_Pages_runs_is_total_0_with_no_latest_—_never_a_green
  Scenario: No Pages runs is total 0 with no latest
    Given only a "Docs site" run
    When Pages health is computed
    Then total is 0
    And there is no latest run

  @test:scripts/tests/ui/pages-health.test.ts::pagesHealth_—_cancelled_is_a_third_state::latest_is_the_newest_Pages_run,_not_the_newest_run
  Scenario: Latest is the newest Pages run, not the newest run of any workflow
    Given a newest "Docs site" run, then a cancelled Pages run at 11:00, then a Pages run at 09:00
    When Pages health is computed
    Then latest was created at "2026-09-20T11:00:00Z"
    And its conclusion is "cancelled"

  @test:scripts/tests/ui/pages-health.test.ts::slugOfDeployCommit_—_which_preview_a_publish-branch_commit_is_about::the_payload_commit_names_its_slug
  Scenario: The payload commit names its slug
    Given the commit message "staging(claude-eroyaz): from abc123"
    When its slug is read
    Then the slug is "claude-eroyaz"

  @test:scripts/tests/ui/pages-health.test.ts::slugOfDeployCommit_—_which_preview_a_publish-branch_commit_is_about::the_render-log_commit_names_its_slug
  Scenario: The render-log commit names its slug
    Given the commit message "render-log: rendered STAGING/claude-eroyaz"
    When its slug is read
    Then the slug is "claude-eroyaz"

  @test:scripts/tests/ui/pages-health.test.ts::slugOfDeployCommit_—_which_preview_a_publish-branch_commit_is_about::a_commit_about_nothing_staged_is_undefined,_not_a_guess
  Scenario: A commit about nothing staged has no slug
    Given the commit messages "deploy: main site" and an empty message
    When their slugs are read
    Then each slug is undefined

  @test:scripts/tests/ui/pages-health.test.ts::slugOfDeployCommit_—_which_preview_a_publish-branch_commit_is_about::the_slug_is_read_from_a_line_start,_so_a_quoted_message_does_not_match
  Scenario: The slug is read only from a line start
    Given the commit message "Merge PR: reverts staging(other): from x"
    When its slug is read
    Then the slug is undefined

  @test:scripts/tests/ui/pages-health.test.ts::slugOfDeployCommit_—_which_preview_a_publish-branch_commit_is_about::the_coalesced_commit_resolves_to_its_one_slug
  Scenario: The coalesced commit resolves to its one slug
    Given a message with subject "staging(eroyaz): from abc" and a render-log trailer for STAGING/eroyaz
    When its slug is read
    Then the slug is "eroyaz"

  @test:scripts/tests/ui/pages-health.test.ts::slugOfDeployCommit_—_which_preview_a_publish-branch_commit_is_about::a_cleanup_commit_names_the_slug_it_REMOVED,_not_the_word_`cleanup`
  Scenario: A cleanup commit names the slug it removed
    Given the message "staging(cleanup): remove STAGING/eroyaz (PR #123 closed)"
    When its slug is read
    Then the slug is "eroyaz"
    And for "staging(cleanup): remove STAGING/other (dispatched)" the slug is "other"

  @test:scripts/tests/ui/pages-health.test.ts::slugOfDeployCommit_—_which_preview_a_publish-branch_commit_is_about::two_removals_for_two_PRs_are_two_slugs,_not_one
  Scenario: Two removals for two PRs are two slugs
    Given cleanup removal messages for STAGING/aaa and STAGING/bbb
    When their slugs are read
    Then the two slugs differ

  @test:scripts/tests/ui/pages-health.test.ts::slugOfDeployCommit_—_which_preview_a_publish-branch_commit_is_about::a_branch_genuinely_named_`cleanup`_still_resolves
  Scenario: A branch genuinely named cleanup still resolves
    Given the message "staging(cleanup): from abc123"
    When its slug is read
    Then the slug is "cleanup"

  @test:scripts/tests/ui/pages-health.test.ts::slugOfDeployCommit_—_which_preview_a_publish-branch_commit_is_about::the_retained-preview_commit_names_its_slug
  Scenario: The retained-preview commit names its slug
    Given the message "render-log: retained STAGING/eroyaz"
    When its slug is read
    Then the slug is "eroyaz"

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::two_commits_for_one_slug_seconds_apart_are_one_deploy_writing_twice
  Scenario: Two commits for one slug seconds apart are one deploy writing twice
    Given newest-first commits: a render-log for eroyaz at 12:00:10 and a staging payload for eroyaz at 12:00:00
    When self-supersedes are found
    Then exactly one is found
    And it has slug "eroyaz", by "bbb", superseded "aaa" and 10 seconds apart

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::different_slugs_are_TWO_SESSIONS_and_are_not_counted
  Scenario: Commits for different slugs are not counted as self-supersedes
    Given newest-first staging commits for slug other and then slug eroyaz 10 seconds apart
    When self-supersedes are found
    Then none are found

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::the_same_slug_redeployed_much_later_is_a_new_deploy,_not_a_self-supersede
  Scenario: The same slug redeployed an hour later is not a self-supersede
    Given newest-first staging commits for eroyaz at 13:00 and 12:00
    When self-supersedes are found
    Then none are found

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::the_window_is_a_parameter,_and_its_boundary_is_inclusive
  Scenario: The supersede window is a parameter with an inclusive boundary
    Given newest-first staging commits for eroyaz 120 seconds apart
    When self-supersedes are found with a 120-second window
    Then one is found
    And with a 119-second window none are found

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::commits_handed_over_OLDEST-first_are_refused_rather_than_reported
  Scenario: Commits handed over oldest-first are not reported
    Given an eroyaz payload at 12:00:00 followed by its render-log at 12:00:10, oldest first
    When self-supersedes are found
    Then none are found

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::an_unparseable_date_is_not_a_zero-second_gap
  Scenario: An unparseable date is not a zero-second gap
    Given a newest eroyaz commit dated "not a date" and an older eroyaz commit
    When self-supersedes are found
    Then none are found

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::a_run_of_three_finds_both_adjacent_pairs
  Scenario: A run of three commits finds both adjacent pairs
    Given three newest-first eroyaz commits ccc, bbb and aaa ten seconds apart
    When self-supersedes are found
    Then they are by "ccc" and "bbb"

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::a_commit_that_is_not_a_deploy_breaks_the_chain_rather_than_bridging_it
  Scenario: A non-deploy commit between two deploys breaks the chain
    Given newest-first: an eroyaz staging commit, a merge commit, and an eroyaz staging commit
    When self-supersedes are found
    Then none are found

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::two_commits_that_are_not_deploys_are_never_paired_with_each_other
  Scenario: Two non-deploy commits are never paired
    Given newest-first commits "Merge branch 'main'" and "deploy: main site"
    When self-supersedes are found
    Then none are found

  @test:scripts/tests/ui/pages-health.test.ts::selfSupersedes_—_this_repo's_own_contention,_not_a_sibling's::an_empty_or_single-commit_history_finds_nothing
  Scenario: An empty or single-commit history finds nothing
    Given an empty history and a history of one staging commit
    When self-supersedes are found in each
    Then none are found

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::an_unreachable_API_is_never_rendered_as_green
  Scenario: An unreachable API is never rendered as green
    Given the Pages API was unreachable with "GitHub API returned 403"
    When the Pages section is rendered
    Then the output contains "treat as unknown, not as green"
    And it contains "403"
    And it contains no check mark

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::zero_deployments_is_unjudged,_not_clean
  Scenario: Zero deployments is unjudged, not clean
    Given a report with zero deployments
    When the Pages section is rendered
    Then the output contains "Unjudged, not green"
    And it does not show a check mark for 0 succeeded

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::it_states_the_cancelled_count_and_grades_no_share
  Scenario: The cancelled count is stated and no share is graded
    Given a report of 100 deployments, 49 succeeded and 51 cancelled
    When the Pages section is rendered
    Then the output contains "**51** cancelled"
    And it contains no percentage
    And it contains none of "unhealthy", "RED" or "too many"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::but_a_floor_IS_graded:_deployments_happened_and_none_succeeded
  Scenario: Deployments with none succeeding are graded as a floor
    Given a report of 8 deployments, all cancelled
    When the Pages section is rendered
    Then the output contains "Not one of 8 deployments succeeded"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::...and_that_floor_does_not_fire_when_something_got_through
  Scenario: The floor does not fire when one deployment succeeded
    Given a report of 8 deployments, 1 succeeded and 7 cancelled
    When the Pages section is rendered
    Then the output does not contain "Not one of"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::unreadable_commits_leave_the_counts_standing_and_say_what_is_missing
  Scenario: Unreadable commits leave the counts standing and say what is missing
    Given a report of 6 cancelled deployments whose commits were unreachable with a 409
    When the Pages section is rendered
    Then the output contains "**6** cancelled"
    And it contains "uncategorised — not absent"
    And it does not contain "self-inflicted"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::self-inflicted_cancellations_are_named_by_slug,_not_merged_into_a_count
  Scenario: Self-inflicted cancellations are named by slug
    Given a report with self-supersedes: two for slug "aaa" and one for slug "bbb"
    When the Pages section is rendered
    Then the output contains "**3** cancellation(s) were self-inflicted"
    And it lists "aaa" with 2 and "bbb" with 1
    And it points the rest at "yzsj"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::a_SETTLED_bean_does_not_read_as_open_—_the_`xfyk`_defect_itself
  Scenario: A completed cited bean does not read as open
    Given a report with one self-inflicted cancellation for slug "aaa" and cited bean yzsj read as "completed"
    When the Pages section is rendered
    Then the output contains "`yzsj`, now `completed`"
    And it does not contain "is not done"
    And it contains "NEW ground"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::`scrapped`_counts_as_settled_too_—_abandoned_is_not_open
  Scenario: A scrapped cited bean counts as settled
    Given a report with one self-inflicted cancellation for slug "aaa" and cited bean yzsj read as "scrapped"
    When the Pages section is rendered
    Then the output contains "now `scrapped`"
    And it contains "NEW ground"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::an_OPEN_bean_still_reads_as_work_outstanding
  Scenario: An open cited bean still reads as work outstanding
    Given a report with one self-inflicted cancellation for slug "aaa" and cited bean yzsj read as "in-progress"
    When the Pages section is rendered
    Then the output contains "is `in-progress`" and "a different fix"
    And it does not contain "NEW ground"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::an_unreadable_work_plan_is_UNKNOWN_—_not_open,_not_done
  Scenario: An unreadable work plan is reported as unknown
    Given a report with one self-inflicted cancellation for slug "aaa" and cited bean yzsj unreadable because "no bean store in this instance"
    When the Pages section is rendered
    Then the output contains "could not read the work plan" and the reason
    And it contains "not assumed either way"
    And it contains neither "is not done" nor "NEW ground"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::NOBODY_LOOKED_renders_the_same_as_unreadable,_not_as_a_status
  Scenario: Cited beans never looked up render as unreadable
    Given a report with one self-inflicted cancellation for slug "aaa" and no cited-bean statuses at all
    When the Pages section is rendered
    Then the output contains "could not read the work plan"
    And it does not contain "is not done"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::a_citation_resolving_to_NOTHING_says_so_—_beans_are_never_deleted
  Scenario: A citation resolving to no bean says so
    Given a report with one self-inflicted cancellation for slug "aaa" and cited bean yzsj absent
    When the Pages section is rendered
    Then the output contains "no such bean"
    And it contains "renamed or mistyped"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::the_clause_wraps,_because_the_watchdog_commits_this_as_markdown
  Scenario: The cited-bean clause wraps at 90 characters
    Given a report with one self-inflicted cancellation for slug "aaa" and cited bean yzsj read as "completed"
    When the Pages section is rendered
    Then no output line is longer than 90 characters

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::no_self-supersede_says_so_rather_than_going_quiet
  Scenario: No self-supersede is stated rather than left silent
    Given a report of 6 cancelled deployments and no self-supersedes
    When the Pages section is rendered
    Then the output contains "No deployment superseded its own slug"
    And it mentions "bm6d"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::every_state_in_the_breakdown_is_printed,_including_the_empty_ones
  Scenario: Every state in the breakdown is printed, including zeros
    Given a report with one deployment in each of success, cancelled, failure and unsettled
    When the Pages section is rendered
    Then it contains "**1** succeeded", "**1** cancelled", "**1** failed" and "**1** not settled"
    When a report with two successes and nothing else is rendered
    Then it contains "**0** cancelled", "**0** failed" and "**0** not settled"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::the_section_says_the_number_is_not_cached
  Scenario: The section says the number is not cached
    Given a default report
    When the Pages section is rendered
    Then the output says "not repository state"
    And it says "cached nowhere"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::the_publish_branch_is_reported,_never_assumed
  Scenario: The publish branch is reported, never assumed
    Given a report whose publish branch is "main"
    When the Pages section is rendered
    Then the output names "main"
    And it does not mention "gh-pages"

  @test:scripts/tests/ui/pages-health.test.ts::renderPages_—_what_it_refuses_to_say::the_window_is_stated,_because_a_page_of_runs_is_not_a_period
  Scenario: The window of runs is stated
    Given a report with a window of 100 runs
    When the Pages section is rendered
    Then the output has a "Window:" line naming 100 recent runs

  @test:scripts/tests/ui/pages-health.test.ts::coalescing_or_starvation_—_bean_`thsz`::newestSettled_skips_a_run_still_in_flight
  Scenario: newestSettled skips a run still in flight
    Given Pages runs newest-first: one in progress, one cancelled at 16:29:05, one successful at 16:10:26
    When Pages health is computed
    Then latest has status "in_progress"
    And newest settled is "cancelled"
    And last success is "2026-09-25T16:10:26Z"

  @test:scripts/tests/ui/pages-health.test.ts::coalescing_or_starvation_—_bean_`thsz`::an_unsettled_run_is_never_the_last_success,_even_if_it_claims_one
  Scenario: An unsettled run is never the last success
    Given an in-progress run claiming success at 17:00 and a completed success at 16:10:26
    When Pages health is computed
    Then last success is "2026-09-25T16:10:26Z"
    And success is 1 and unsettled is 1

  @test:scripts/tests/ui/pages-health.test.ts::coalescing_or_starvation_—_bean_`thsz`::a_newest-settled_SUCCESS_says_the_share_was_coalescing
  Scenario: A newest-settled success reads as coalescing
    Given a report of 8 cancelled and 2 succeeded whose newest settled run succeeded
    When the Pages section is rendered
    Then the output contains "newest deployment to settle SUCCEEDED"
    And it contains "coalescing, not failure"
    And it does not contain "starvation rather than"

  @test:scripts/tests/ui/pages-health.test.ts::coalescing_or_starvation_—_bean_`thsz`::a_newest-settled_CANCELLATION_names_starvation_and_how_far_behind
  Scenario: A newest-settled cancellation names starvation and the last success
    Given a report whose newest settled run was cancelled and whose last success was 2026-09-25T16:10:26Z
    When the Pages section is rendered
    Then the output contains "did NOT succeed"
    And it contains "starvation"
    And it contains "2026-09-25T16:10:26Z"

  @test:scripts/tests/ui/pages-health.test.ts::coalescing_or_starvation_—_bean_`thsz`::...and_when_nothing_ever_succeeded_it_says_so_rather_than_naming_a_time
  Scenario: With no success ever, no last-success time is named
    Given a report of 10 cancelled whose newest settled run was cancelled and with no last success
    When the Pages section is rendered
    Then the output contains "no deployment in this window succeeded at all"
    And it does not say "site is as of undefined"

  @test:scripts/tests/ui/pages-health.test.ts::coalescing_or_starvation_—_bean_`thsz`::nothing_settled_yet_is_its_own_answer,_not_a_verdict_either_way
  Scenario: Nothing settled yet is its own answer
    Given a report of 3 deployments, all unsettled
    When the Pages section is rendered
    Then the output contains "has settled yet"
    And it contains "not a verdict"
    And it does not contain "SUCCEEDED"

  @test:scripts/tests/ui/pages-health.test.ts::coalescing_or_starvation_—_bean_`thsz`::it_still_grades_no_share_and_invents_no_staleness_cutoff
  Scenario: The coalescing section grades no share and invents no staleness cutoff
    Given a report of 100 deployments, 21 succeeded and 78 cancelled, whose newest settled run was cancelled
    When the Pages section is rendered
    Then the output contains no percentage
    And it names no "more than N minutes or hours" or "stale for N" cutoff
