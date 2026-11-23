# src/workflow/workflow-triggers.ts classifies why a workflow produced no run (whyNoRun): dispatch-only,
# path-filtered, auto-triggered (a defect) or undetermined, from the workflow's `on:` block.
# Each Scenario names the test that executes it.
Feature: Why a workflow produced no run

  @test:scripts/tests/sdlc/ci-health-no-run.test.ts::whyNoRun::no_automatic_trigger_is_`dispatch-only`_—_no_run_is_the_design
  Scenario: A workflow with no automatic trigger is dispatch-only
    Given a workflow whose only triggers are workflow_dispatch, and one with workflow_dispatch and workflow_call
    When why it has no run is asked
    Then both are "dispatch-only"

  @test:scripts/tests/sdlc/ci-health-no-run.test.ts::whyNoRun::an_unrestricted_automatic_trigger_with_no_run_is_`auto-triggered`
  Scenario: An unrestricted automatic trigger with no run is auto-triggered
    Given a workflow triggered on push to main and on workflow_dispatch
    When why it has no run is asked
    Then the answer is "auto-triggered"

  @test:scripts/tests/sdlc/ci-health-no-run.test.ts::whyNoRun::every_automatic_trigger_`paths:`-restricted_is_`path-filtered`,_not_a_defect
  Scenario: A workflow whose every automatic trigger has paths is path-filtered
    Given a workflow whose pull_request and push triggers both list paths, one of them its own workflow file, plus workflow_dispatch
    When why it has no run is asked
    Then the answer is "path-filtered"

  @test:scripts/tests/sdlc/ci-health-no-run.test.ts::whyNoRun::one_restricted_and_one_unrestricted_trigger_is_still_a_defect
  Scenario: One path-restricted and one unrestricted trigger is still auto-triggered
    Given a workflow with a pull_request trigger restricted by paths and a push trigger on main
    When why it has no run is asked
    Then the answer is "auto-triggered"

  @test:scripts/tests/sdlc/ci-health-no-run.test.ts::whyNoRun::`paths-ignore`_does_not_explain_a_silence
  Scenario: paths-ignore does not count as a restriction
    Given a workflow whose push trigger has only paths-ignore "docs/**"
    When why it has no run is asked
    Then the answer is "auto-triggered"

  @test:scripts/tests/sdlc/ci-health-no-run.test.ts::whyNoRun::the_inline_forms_parse
  Scenario: The inline forms of on are parsed
    Given workflows written "on: push", "on: [push, pull_request]" and "on: [workflow_dispatch]"
    When their triggers are read
    Then they are ["push"] and ["push", "pull_request"]
    And the inline workflow_dispatch workflow is "dispatch-only"

  @test:scripts/tests/sdlc/ci-health-no-run.test.ts::whyNoRun::no_readable_`on:`_is_`undetermined`,_and_so_is_an_unreadable_file
  Scenario: A workflow with no readable on, or no file text, is undetermined
    Given a workflow with no on block, and an unreadable file given as undefined
    When why each has no run is asked
    Then both are "undetermined"

  @test:scripts/tests/sdlc/ci-health-no-run.test.ts::whyNoRun::unrestrictedTriggers_names_which_trigger_is_unexplained
  Scenario: The unrestricted triggers are named
    Given a workflow with a paths-restricted pull_request and a push on main
    When its unrestricted triggers are listed
    Then the list is ["push"]
