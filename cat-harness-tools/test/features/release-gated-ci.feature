# Release-gated CI: the workflows pr-tests.yml and layer-pr-checks.yml run the fast tier on a PR without
# the `release` label, the full tier on a `release` PR, and batch pushes to main per integration window.
# Each Scenario names the test that executes it.
Feature: Release-gated CI workflows

  @test:test/release-gated-ci.test.ts::pr-tests.yml_(this_repository's_own_checks)::adding_the_`release`_label_starts_a_run:_`labeled`_is_a_pull_request_type
  Scenario: Labelling a pull request starts a pr-tests run
    Given the workflow ".github/workflows/pr-tests.yml"
    When its pull_request trigger types are read
    Then they include "labeled"

  @test:test/release-gated-ci.test.ts::pr-tests.yml_(this_repository's_own_checks)::a_`labeled`_run_for_another_label_skips_every_job_and_never_joins_the_PR's_concurrency_group
  Scenario: A pr-tests run for a label other than release skips every job and takes its own concurrency group
    Given the workflow ".github/workflows/pr-tests.yml"
    When its concurrency group and jobs are read
    Then the concurrency group contains the no-op expression "noop-label-{0}" keyed by the run id for a non-release label
    And the "pin" and "tests" jobs are each gated on the action not being "labeled" or the label being "release"
    And every other job needs "pin"

  @test:test/release-gated-ci.test.ts::pr-tests.yml_(this_repository's_own_checks)::the_head_side_of_the_full_tier_runs_on_a_PR_only_with_the_release_label
  Scenario: The head-side full-tier jobs run on a pull request only with the release label
    Given the workflow ".github/workflows/pr-tests.yml"
    When the conditions of "tests-head" and "standalone-head" are read
    Then each requires the event to be "pull_request"
    And each requires the pull request labels to contain "release"

  @test:test/release-gated-ci.test.ts::pr-tests.yml_(this_repository's_own_checks)::the_base_side_runs_on_a_PR_only_for_a_release,_and_on_a_push_only_when_the_hour_is_not_batched
  Scenario: The base-side jobs run on a release pull request or an unbatched push
    Given the workflow ".github/workflows/pr-tests.yml"
    When the conditions of "tests-base" and "standalone-base" are read
    Then each allows a non-pull-request event only when the pin job's "batched" output is not "true"
    And each allows a pull request only when its labels contain "release"

  @test:test/release-gated-ci.test.ts::pr-tests.yml_(this_repository's_own_checks)::pin_stamps_the_hour_on_a_push_and_says_when_a_push_is_batched
  Scenario: The pin job stamps the integration hour and reports a batched push
    Given the "pin" job of ".github/workflows/pr-tests.yml"
    Then its "batched" output is true when the "integ-lookup" step had a cache hit
    And it has steps with ids "integ-bucket" and "integ-lookup"
    And the "integ-lookup" step is lookup-only
    And the "Save the stamp" step saves under the same key the lookup uses

  @test:test/release-gated-ci.test.ts::pr-tests.yml_(this_repository's_own_checks)::the_verdict_job_passes_a_non-release_PR_on_the_fast_tier_and_says_so
  Scenario: The verdict job has a fast-tier step for a non-release pull request
    Given the "tests" job of ".github/workflows/pr-tests.yml"
    When its step named "Fast tier (a non-release PR)" is read
    Then the step runs only when the pull request labels do not contain "release"
    # Gap: the step's pass result and message are not checked.

  @test:test/release-gated-ci.test.ts::layer-pr-checks.yml_(every_layer)::a_`labeled`_run_for_another_label_judges_nothing_and_never_joins_the_PR's_concurrency_group
  Scenario: A layer-pr-checks run for a label other than release judges nothing and takes its own concurrency group
    Given the workflow ".github/workflows/layer-pr-checks.yml"
    Then the concurrency group contains the no-op expression for a non-release label
    And "prepare-head", "prepare-base" and "compare" are each gated on the action not being "labeled" or the label being "release"
    And the "run" job needs exactly "prepare-head" and "prepare-base"

  @test:test/release-gated-ci.test.ts::layer-pr-checks.yml_(every_layer)::prepare-base_does_not_run_on_the_fast_tier
  Scenario: prepare-base runs only on the full tier
    Given the workflow ".github/workflows/layer-pr-checks.yml"
    Then the "prepare-base" job condition requires prepare-head's "full" output to be "true"
    And "prepare-base" needs "prepare-head"

  @test:test/release-gated-ci.test.ts::layer-pr-checks.yml_(every_layer)::the_verdict_job_is_named_for_the_tier_it_judged
  Scenario: The compare job's name states which tier it judged
    Given the workflow ".github/workflows/layer-pr-checks.yml"
    Then the "compare" job name contains "Fast tier only (advisory; the full checks gate a release)"
    And it contains "No new failures (tests and gates)"
    And the "compare" job is skipped when prepare-head's "full" output is "false"
    And prepare-head's last step is "Fast tier only (advisory; the full checks gate a release)", run when its tier step says "full=false"

  @test:test/release-gated-ci.test.ts::layer-pr-checks.yml_(every_layer)::a_push_to_main_is_batched_per_integration_window,_and_the_stamp_is_saved_under_the_key_it_is_looked_up_by
  Scenario: Pushes to main are batched per integration window under a matching stamp key
    Given the workflow ".github/workflows/layer-pr-checks.yml"
    Then the workflow_call input "integration-minutes" defaults to 60
    And in "prepare-base" the "Save the stamp" step uses the same key as the "integ-lookup" step
    And the "skip-prep" step's BATCHED variable is true when "integ-lookup" had a cache hit

  @test:test/release-gated-ci.test.ts::layer-pr-checks.yml_(every_layer)::the_preview_tier_runs_the_head_side_only,_its_tests_cut_to_the_change's_cone,_and_never_computes_main's_side
  Scenario: The preview tier runs the change's cone on the head side and reports it for the preview
    Given a PR labelled "preview" and not "release"
    When layer-pr-checks runs
    Then only head shards run, bun test is given the cone's tests, and main's side is not computed
    And compare judges the cone with preview-qa.ts instead of the release verdict, and uploads "preview-qa-<head sha>"
