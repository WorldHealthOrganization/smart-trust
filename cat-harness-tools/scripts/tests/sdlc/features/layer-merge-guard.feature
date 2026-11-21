# .github/workflows/layer-merge-guard.yml posts the merge-guard commit status on
# every PR head of a layer (owner, 2026-11-13, card "A. merge-guard required status").
# Since 2026-11-17 (owner, card) no caller runs on pull_request_target: the
# pull-request events arrive as the completion of the permissionless
# "Merge guard trigger" signal, on workflow_run, from the default branch.
# Each Scenario names the test that executes it.
Feature: The merge-guard status on every layer PR

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_which_PRs_a_run_judges::a_pull_request_event_is_refused:_the_caller's_file_would_be_the_PR's_own
  Scenario: A pull_request event is refused
    Given a pull_request event for PR 3
    When the "Which PRs" step runs
    Then it fails with an error naming the merge guard trigger, and judges nothing

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_which_PRs_a_run_judges::a_caller_not_yet_re-pinned_(pull_request_target)_is_still_judged,_with_a_warning
  Scenario: A caller not yet re-pinned is still judged
    Given a pull_request_target event for PR 12
    When the "Which PRs" step runs
    Then it judges 12 and warns that the caller still runs on pull_request_target

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_which_PRs_a_run_judges::a_comment_on_a_PR_judges_that_PR;_a_comment_on_an_issue_judges_none
  Scenario: A comment on a PR judges that PR, and one on an issue judges none
    Given an issue_comment event on PR 8 and one on issue 9
    When the "Which PRs" step runs
    Then it judges 8, and nothing for the issue

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_which_PRs_a_run_judges::a_finished_workflow_run_judges_the_PRs_it_names,_or_else_the_open_PRs_on_its_head_sha
  Scenario: A finished workflow run judges the PRs it names, or the open PRs on its head sha
    Given a workflow_run naming PRs 5 and 2
    When the "Which PRs" step runs
    Then it judges "2 5" without asking GitHub
    Given a workflow_run naming no PR, whose head sha is the head of open PR 7
    When the "Which PRs" step runs
    Then it asks GitHub for the PRs of that commit and judges 7

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_which_PRs_a_run_judges::a_fork_PR's_signal_names_no_PR_and_no_open_PR_on_its_sha:_its_run_name_`#<n>`_is_judged,_digits_only
  Scenario: A fork PR's signal is judged by the number in its run name
    Given a "Merge guard trigger" workflow_run naming no PR, run name "Merge guard trigger #41", whose head sha no open PR has
    When the "Which PRs" step runs
    Then it judges 41
    And a run name with anything after the digits, another workflow's name, or no digits judges nothing
    And a run that names its PR is judged by that, not by its run name

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_which_PRs_a_run_judges::workflow_dispatch_judges_the_`pr`_input,_or_every_open_PR
  Scenario: workflow_dispatch judges the pr input, or every open PR
    Given a workflow_dispatch with pr 44, and one with no pr while PRs 1, 4 and 4 are listed open
    When the "Which PRs" step runs
    Then it judges 44, and "1 4"

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_which_PRs_a_run_judges::anything_that_is_not_a_PR_number_is_dropped
  Scenario: Anything that is not a PR number is dropped
    Given a workflow_dispatch with pr "12; rm -rf /"
    When the "Which PRs" step runs
    Then it judges nothing

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_what_it_runs::the_guard's_tools_install_from_the_layer's_committed_lockfile,_never_the_newest_npm
  Scenario: The guard's tools install from the layer's committed lockfile
    Given layer-merge-guard.yml
    When its "Compose the guard" step is read
    Then it copies cat-harness-tools' bun.lock into tools/ before "bun install"

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_what_it_runs::it_posts_the_`merge-guard`_status_with_--full-tier,_from_the_caller's_default_branch,_and_never_merges
  Scenario: The workflow posts the merge-guard status with --full-tier from the caller's default branch and never merges
    Given layer-merge-guard.yml
    When its steps are read
    Then the guard runs with "--root site --status" and "--full-tier"
    And the caller is checked out at its default branch into "site"
    And no step merges or asks for auto-merge
    And the job may write statuses and only read contents

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_what_it_runs::this_layer's_caller_is_`merge-guard.yml`,_from_the_default_branch_only:_comments,_the_PR_checks'_runs_and_the_signal's
  Scenario: This layer's caller runs from the default branch only
    Given .github/workflows/merge-guard.yml
    When it is read
    Then it calls layer-merge-guard.yml on issue_comment, workflow_run and workflow_dispatch, and not on pull_request_target
    And its workflow_run follows the PR checks workflow and "Merge guard trigger" by name

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_what_it_runs::the_privileged_side_never_takes_code_from_the_PR_head_and_holds_no_secret
  Scenario: The privileged side runs nothing from the PR head
    Given layer-merge-guard.yml
    When its steps are read
    Then it checks out only the caller's default branch, names no head ref, branch or repository, and reads no secret

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_the_signal_(`Merge_guard_trigger`)::this_layer's_copy_is_the_one_workflow-pins_writes,_at_the_file_merge-guard_ignores
  Scenario: This layer's signal is the canonical one
    Given .github/workflows/merge-guard-trigger.yml
    Then it is exactly the text workflow-pins writes, at the file merge-guard.ts never reads as evidence

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_the_signal_(`Merge_guard_trigger`)::it_runs_on_pull_request_only,_on_every_type_the_old_caller_listed,_and_its_run_name_carries_the_PR_number
  Scenario: The signal fires on every pull-request event the guard re-judges on
    Given the signal
    Then it runs on pull_request only, on opened, synchronize, reopened, ready_for_review, converted_to_draft, labeled, unlabeled and edited
    And its run name is "Merge guard trigger #<PR number>"

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_the_signal_(`Merge_guard_trigger`)::it_holds_no_token,_uses_no_action,_checks_nothing_out_and_reads_no_secret
  Scenario: The signal holds nothing worth stealing
    Given the signal
    Then its workflow and job permissions are empty, no step uses an action or interpolates an expression, and it reads no secret

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_the_post_step_under_bash_-e::a_refusal_(exit_1)_or_an_unknown_(exit_2)_is_a_verdict:_every_PR_is_judged,_printed,_and_the_step_passes
  Scenario: Under bash -e a refusal or an unknown verdict does not end the post step
    Given the "Post the merge-guard status" step run as Actions runs it, with bash -e, for PRs 7 and 8
    And a guard that exits 1, and then one that exits 2
    When the step runs
    Then it passes, prints each PR's exit code, and writes the guard's output to the step summary

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_the_post_step_under_bash_-e::a_status_that_could_not_be_posted_fails_the_step,_naming_the_PRs
  Scenario: A status that could not be posted fails the post step
    Given a guard that says "could not post the merge-guard status" for PRs 7 and 8
    When the step runs under bash -e
    Then it fails, naming "#7 #8"

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_the_signal_(`Merge_guard_trigger`)::it_names_no_layer,_since_the_layers_below_this_one_hold_it_too_(check:reference-direction)
  Scenario: The signal names no layer
    Given the canonical signal text
    Then it names no layer, so a layer below this one may hold it
