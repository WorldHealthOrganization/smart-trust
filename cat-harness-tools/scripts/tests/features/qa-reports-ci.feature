# The CI half of bean 16ei: the publish job, the prune workflow, and the two
# rules that keep them honest, read against the real workflow files. Each
# Scenario names the test that executes it.
Feature: CI publishes and prunes the qa-reports branch only through qa-store

  @test:scripts/tests/qa-reports-ci.test.ts::qa-reports-unretried::flags_a_raw_push:_%s
  Scenario: A raw push to a qa-reports branch is flagged
    Given a workflow step running each of seven raw git pushes to qa-reports, cat-qa-reports or cat/cat-harness/qa-reports, forced, with -c options, or in a retry loop
    When the qa-reports-unretried rule reads it
    Then there is exactly one finding, of kind "qa-reports-unretried"

  @test:scripts/tests/qa-reports-ci.test.ts::qa-reports-unretried::does_not_flag:_%s
  Scenario: Sanctioned writers, comments, fetches and other branches are not flagged
    Given a workflow step running qa:publish, qa:prune, a commented push, a push to qa-reports-spike or cat-qa-reports-spike, or a fetch of qa-reports
    When the qa-reports-unretried rule reads it
    Then there is no finding

  @test:scripts/tests/qa-reports-ci.test.ts::qa-reports-unretried::the_repository's_own_workflows_carry_none
  Scenario: The repository's own workflows carry no raw qa-reports push
    When the repository's workflows are checked
    Then there is no "qa-reports-unretried" finding

  @test:scripts/tests/qa-reports-ci.test.ts::the_publish_job::is_a_separate_job_after_the_gates,_run_whatever_they_concluded,_on_push_and_pull_request
  Scenario: The publish job is a separate job after the gates
    Given the "qa-publish" job of code-quality-gates.yml
    Then it needs "gates-kg", "gates-docs" and "qa-working-copy"
    And its condition holds always(), 'push' and 'pull_request'
    And it alone has contents write while the workflow has contents read
    And a step runs "bun run cat qa:publish --github"

  @test:scripts/tests/qa-reports-ci.test.ts::the_publish_job::is_not_a_gate:_`bun_run_cat_gates`_does_not_extract_it,_in_either_set
  Scenario: The publish job is not a gate
    Then the qa-publish job publishes, as does a job with write-all, while a read-only job or one with no permissions does not
    And the loaded gates, with or without --all, include none running qa:publish but include the gates-kg job
    And the raw gate reader over the gates workflow still sees the qa:publish line

  @test:scripts/tests/qa-reports-ci.test.ts::the_prune_workflow::has_a_trigger_that_fires_—_a_schedule_—_and_a_dispatch_that_defaults_to_a_dry_run
  Scenario: The prune workflow is scheduled and dispatches as a dry run by default
    Given qa-reports-prune.yml
    Then it has at least one schedule
    And its dispatch input "apply" defaults to false
    And its qa:prune step sets APPLY from a scheduled event and passes "--pr-states"

  @test:scripts/tests/qa-reports-ci.test.ts::the_prune_workflow::its_step_is_classified_for_`gates_--all`,_not_left_unclassified
  Scenario: The prune step is classified for gates --all
    Then no unclassified step runs qa:prune
