# .github/workflows/layer-merge-guard.yml posts the merge-guard commit status on
# every PR head of a layer (owner, 2026-11-13, card "A. merge-guard required status").
# Each Scenario names the test that executes it.
Feature: The merge-guard status on every layer PR

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_which_PRs_a_run_judges::a_pull_request_target_or_pull_request_event_judges_its_PR
  Scenario: A pull_request_target or pull_request event judges its own PR
    Given a pull_request_target event for PR 12 and a pull_request event for PR 3
    When the "Which PRs" step runs
    Then it judges 12, and 3

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

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_what_it_runs::it_posts_the_`merge-guard`_status_with_--full-tier,_from_the_caller's_default_branch,_and_never_merges
  Scenario: The workflow posts the merge-guard status with --full-tier from the caller's default branch and never merges
    Given layer-merge-guard.yml
    When its steps are read
    Then the guard runs with "--root site --status" and "--full-tier"
    And the caller is checked out at its default branch into "site"
    And no step merges or asks for auto-merge
    And the job may write statuses and only read contents

  @test:scripts/tests/sdlc/layer-merge-guard.test.ts::layer-merge-guard:_what_it_runs::this_layer's_caller_is_`merge-guard.yml`_on_pull_request_target,_comments_and_the_PR_checks'_runs
  Scenario: This layer's caller runs on pull_request_target, comments and the PR checks' runs
    Given .github/workflows/merge-guard.yml
    When it is read
    Then it calls layer-merge-guard.yml on pull_request_target, issue_comment, workflow_run and workflow_dispatch
    And its workflow_run follows the PR checks workflow by name

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
