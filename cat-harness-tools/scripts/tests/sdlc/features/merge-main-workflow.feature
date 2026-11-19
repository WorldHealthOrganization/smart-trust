# scripts/merge-main-comment.ts composes the merge-main bot's PR comment, signs it,
# classifies each member's verdict and aggregates a run into one notification or none.
# Each Scenario names the test that executes it.
Feature: The merge-main bot's comment and notifications

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_push_refusal_is_read_from_stderr,_not_guessed::(b)_the_workflows_refusal_names_the_credentials_design,_and_labels_nothing
  Scenario: The workflows refusal names the credentials design and not a moved branch
    Given a run that merged main but the push was blocked for "workflows"
    When the comment is composed
    Then the comment names "#1829"
    And it does not say "branch moved"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_push_refusal_is_read_from_stderr,_not_guessed::(c)_'the_branch_moved'_is_said_only_when_the_push_step_said_so
  Scenario: The branch is said to have moved only when the push step said so
    Given a merged run whose push was rejected, and a merged run with no rejection
    When each comment is composed
    Then the rejected run's comment says "the branch moved during the run"
    And the other run's comment does not say "the branch moved"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_cancelled_or_unfinished_run_is_not_an_error_(#1854)::empty_status:_the_comment_is_left_alone,_and_no_error_text_is_composed
  Scenario: An empty status leaves the comment alone with no error text
    Given a run whose status is empty
    When the comment is composed
    Then the plan is to leave the comment
    And no "**Error**" text appears anywhere in the plan

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_cancelled_or_unfinished_run_is_not_an_error_(#1854)::cancelled:_superseded,_the_comment_is_left_alone_—_even_when_a_status_was_written
  Scenario: A cancelled run is superseded and leaves the comment alone
    Given a cancelled run, with an empty status and with status "1"
    When the comment is composed for each
    Then the plan is to leave the comment
    And the reason mentions "superseded"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_cancelled_or_unfinished_run_is_not_an_error_(#1854)::a_real_non-zero_status_with_no_refusal_or_unrepaired_check_is_still_the_Error_text
  Scenario: A real non-zero status with nothing else to report is the Error text
    Given a run with status "2" and no refusal or unrepaired check
    When the comment is composed
    Then the plan is to write a comment
    And it says "**Error** (exit 2)" with merge-base failing for a reason that is neither a refusal nor an unrepaired check
    And the comment starts with the bot's marker line

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_cancelled_or_unfinished_run_is_not_an_error_(#1854)::the_other_outcomes_keep_their_texts
  Scenario: The refused, up-to-date, pushed and unproved outcomes keep their texts
    Given a merge-base log with three take-base resolutions and one refused path
    Then the parsed resolutions count "glossary" 2 and "qa-results" 1
    And the comment for that log says "**Refused — nothing pushed.**" and lists the refused path
    And status "0" says "**Already up to date with `main`.**"
    And a merged, pushed run says "**Merged `main` and pushed `012345678`.**"
    And a log with a check that STILL fails says "Failing on main right now: TypeScript."
    And main's CI was asked exactly once

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_cancelled_or_unfinished_run_is_not_an_error_(#1854)::main's_CI_is_asked_only_when_the_outcome_reports_it
  Scenario: Main's CI is not asked when the outcome does not report it
    Given an up-to-date run and a run with an empty status
    When each comment is composed
    Then main's failing checks were never asked for

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_comment_carries_the_signature_of_what_it_reports::every_written_comment_ends_with_its_signature,_and_it_round-trips
  Scenario: Every written comment ends with its signature, which round-trips
    Given a run with status "2"
    When the comment is composed
    Then the signature read back from the body equals the plan's signature
    And the body ends with a merge-main-signature comment of 16 hex digits
    And the body still starts with the bot's marker line

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_comment_carries_the_signature_of_what_it_reports::a_comment_with_no_signature_records_none,_rather_than_throwing
  Scenario: A comment with no signature reads as none
    Given a bot comment with no signature line
    When its signature is read
    Then it is the empty string

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_comment_carries_the_signature_of_what_it_reports::the_same_failure_twice_gives_the_same_signature_—_the_run_link_does_not_count
  Scenario: The same failure twice gives the same signature whatever the run link
    Given two runs with status "2" and different run URLs
    Then their comment signatures are equal

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_comment_carries_the_signature_of_what_it_reports::a_push_by_the_AUTHOR_makes_it_new_again
  Scenario: A new head pushed by the author changes the signature
    Given two runs with status "2" on different head shas
    Then their comment signatures differ

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_comment_carries_the_signature_of_what_it_reports::a_CHANGED_CAUSE_is_new_even_when_the_comment's_head_sentence_is_identical
  Scenario: A changed cause changes the signature even when the head sentence is the same
    Given two logs whose merge-base ABORTED lines give different causes
    When each comment is composed
    Then the comments' second lines are identical
    And their signatures differ

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_comment_carries_the_signature_of_what_it_reports::main's_own_red_does_not_change_the_signature_—_it_flaps,_and_it_is_main's
  Scenario: Main's own failing checks do not change the signature
    Given the same unrepaired-check log while main fails "TypeScript", and then also "Repository gates"
    When each comment is composed
    Then each comment names what is failing on main
    And the two signatures are equal

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_comment_carries_the_signature_of_what_it_reports::the_salient_lines_are_normalised,_sorted_and_bounded
  Scenario: Salient lines are normalised, sorted and bounded
    Given a log with a take-base line, an ABORTED line, a STILL-fails line and a timing line
    When its salient lines are read
    Then they are the ABORTED line and "✗ check:x STILL fails", in that order
    And a line with a sha and a duration reads with "<sha>" and "<dur>" in their place

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_repeat_is_quiet;_new,_changed,_systemic_and_undetermined_are_loud::a_failure_the_comment_already_reports_on_this_head_is_quiet
  Scenario: A failure already reported on this head is a quiet repeat
    Given a failed member whose signature equals the previous one
    When its verdict is classified
    Then the verdict is "repeat"
    And it does not notify

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_repeat_is_quiet;_new,_changed,_systemic_and_undetermined_are_loud::a_first_failure,_and_a_failure_whose_cause_changed,_both_notify
  Scenario: A first failure and a failure whose cause changed both notify
    Given a failed member with no previous signature, and one whose signature differs from the previous
    When each verdict is classified
    Then both are "new" and notify
    And the changed one's reason mentions "changed"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_repeat_is_quiet;_new,_changed,_systemic_and_undetermined_are_loud::a_failure_with_no_signature_is_undetermined,_never_a_repeat
  Scenario: A failure with no signature is undetermined
    Given a failed member with no signature and no previous one
    When its verdict is classified
    Then the verdict is "undetermined" and it notifies

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_repeat_is_quiet;_new,_changed,_systemic_and_undetermined_are_loud::the_expected_races_are_quiet,_each_named
  Scenario: The expected races are quiet
    Given a cancelled job, a failed head check, and a merged run whose push was rejected
    When each verdict is classified
    Then each is "race" and does not notify

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_repeat_is_quiet;_new,_changed,_systemic_and_undetermined_are_loud::the_outcomes_that_are_not_failures_at_all_stay_quiet
  Scenario: Outcomes that are not failures stay quiet
    When verdicts are classified for status "0", a refusal, a merged push and a workflows block
    Then they are "up-to-date", "refused", "merged" and "blocked" respectively
    And none of them notifies

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_repeat_is_quiet;_new,_changed,_systemic_and_undetermined_are_loud::a_merge_step_that_never_completed_is_the_bot's_own_failure:_loud
  Scenario: A merge step that never completed is loud
    Given a member whose merge step was skipped, and one with an empty status
    When each verdict is classified
    Then both are "undetermined" and notify

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_repeat_is_quiet;_new,_changed,_systemic_and_undetermined_are_loud::a_REFUSAL_outranks_the_signature:_it_is_not_a_bot_failure_in_the_first_place
  Scenario: A refusal does not notify even without a previous signature
    Given a member that was refused and has no previous signature
    When its verdict is classified
    Then it does not notify

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_run_notifies_once,_or_not_at_all::fourteen_successes_and_one_repeated_failure:_nobody_is_emailed
  Scenario: Successes plus one repeated failure email nobody
    Given three selected PRs: one merged, one up to date and one repeat
    When the verdicts are aggregated
    Then the run is not loud
    And the summary names "#3", "repeat" and "1 member(s) failed"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_run_notifies_once,_or_not_at_all::one_new_failure_makes_the_run_red
  Scenario: One new failure makes the run loud
    Given two selected PRs, one merged and one with a new failure
    When the verdicts are aggregated
    Then the run is loud
    And its lines name "#2"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_run_notifies_once,_or_not_at_all::a_member_that_reported_nothing_is_loud,_and_says_which
  Scenario: A member that reported nothing is loud and named
    Given two selected PRs and a verdict only for the first
    When the verdicts are aggregated
    Then the run is loud
    And the summary says "#2 reported no verdict at all"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_run_notifies_once,_or_not_at_all::every_selected_PR_failing_is_systemic,_and_it_is_reported
  Scenario: Every selected PR failing is systemic and reported
    Given two selected PRs, one a repeat and one a new failure
    When the verdicts are aggregated
    Then the run is loud
    And the summary says "Every selected PR failed"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_run_notifies_once,_or_not_at_all::...but_a_systemic_state_of_pure_REPEATS_is_not_emailed_again
  Scenario: A systemic state of only repeats is not emailed again
    Given two selected PRs that are both repeats
    When the verdicts are aggregated
    Then the run is not loud
    And the summary says "every one of those failures is a repeat" and "does not email it again"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_run_notifies_once,_or_not_at_all::a_systemic_state_is_still_loud_when_a_member_could_not_classify_itself
  Scenario: A systemic state with an undetermined member is still loud
    Given two selected PRs, one a repeat and one undetermined
    When the verdicts are aggregated
    Then the run is loud

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_run_notifies_once,_or_not_at_all::ONE_PR_failing_a_repeat_is_not_systemic
  Scenario: One PR failing as a repeat is not systemic
    Given one selected PR that is a repeat
    When the verdicts are aggregated
    Then the run is not loud

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_run_notifies_once,_or_not_at_all::select's_own_failure_is_loud_by_itself,_and_is_not_emailed_twice
  Scenario: Select's own failure is not made loud a second time
    Given no selected PRs and a failed select step
    When the verdicts are aggregated
    Then the aggregate is not loud
    And its lines say the failure is "loud by itself"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::the_run_notifies_once,_or_not_at_all::nothing_selected_is_a_clean,_quiet_run
  Scenario: Nothing selected is a clean, quiet run
    Given no selected PRs and a successful select step
    When the verdicts are aggregated
    Then the run is not loud
    And the summary says "no opted-in PR was behind main"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_could-not-determine_regen_is_not_reported_to_the_author_as_an_Error_(task_#62)::parseLog_recovers_the_verdict_from_the_tag_and_reports_no_finding_when_there_is_none
  Scenario: The regen verdict is recovered from the log's tag
    Given an ABORTED log tagged "regen-verdict: not-settled"
    When the log is parsed
    Then the regen verdict is "not-settled"
    And no unrepaired check and no refusal are reported

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_could-not-determine_regen_is_not_reported_to_the_author_as_an_Error_(task_#62)::a_log_with_no_tag_records_no_verdict,_rather_than_guessing_one
  Scenario: A log with no tag records no regen verdict
    When an empty log and an untagged ABORTED log are parsed
    Then each regen verdict is empty

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_could-not-determine_regen_is_not_reported_to_the_author_as_an_Error_(task_#62)::not-settled_says_COULD_NOT_DETERMINE,_and_says_regen_found_no_unrepaired_check
  Scenario: Not-settled says could not determine and that no unrepaired check was found
    Given an ABORTED log tagged "not-settled"
    When the comment is composed
    Then it says "**Could not determine" and not "**Error**"
    And it says regen found "no** unrepaired check"
    And it says "not a pass either"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_could-not-determine_regen_is_not_reported_to_the_author_as_an_Error_(task_#62)::a_crashed_regen_is_the_bot's_tool_failing,_and_says_so
  Scenario: A crashed regen is reported as the bot's tool failing
    Given an ABORTED log tagged "crashed" with status "137"
    When the comment is composed
    Then it says "**Could not determine" and names "137"
    And it says the failure "says nothing about this PR"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_could-not-determine_regen_is_not_reported_to_the_author_as_an_Error_(task_#62)::not-staleness_with_no_unrepaired_line_names_the_three_OTHER_kinds
  Scenario: Not-staleness with no unrepaired line names the other kinds
    Given an ABORTED log tagged "not-staleness" with no STILL-fails line
    When the comment is composed
    Then it says "**Not proved"
    And it says "none of them is an unrepaired check"
    And it mentions "Chromium"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_could-not-determine_regen_is_not_reported_to_the_author_as_an_Error_(task_#62)::a_real_unrepaired_check_still_gets_the_unrepaired_text,_tag_or_no_tag
  Scenario: A real unrepaired check keeps the unrepaired text
    # Gap: only the tagged log is exercised; a log with no tag is not
    Given a log with "check:x STILL fails" followed by an ABORTED line tagged "not-staleness"
    When the comment is composed
    Then it says "**Not proved — nothing pushed.** Every conflict matched a pattern"
    And it lists "Unrepaired:" naming "check:x"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_could-not-determine_regen_is_not_reported_to_the_author_as_an_Error_(task_#62)::a_refusal_still_outranks_the_verdict
  Scenario: A refusal outranks the regen verdict
    Given a log with a refused authored path followed by an ABORTED line tagged "not-staleness"
    When the comment is composed
    Then it says "**Refused"

  @test:scripts/tests/sdlc/merge-main-workflow.test.ts::a_could-not-determine_regen_is_not_reported_to_the_author_as_an_Error_(task_#62)::the_three_verdicts_no_longer_share_one_signature
  Scenario: The three regen verdicts give three different signatures
    Given ABORTED logs tagged "not-settled", "crashed" and "not-staleness"
    When each comment's signature is taken
    Then the three signatures are distinct
