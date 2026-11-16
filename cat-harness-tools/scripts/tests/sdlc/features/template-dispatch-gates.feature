# The workflow templates under templates/**/workflows/ that do not trigger on push must not gate a
# job or step on a push event, a condition that can never be true there.
# Each Scenario names the test that executes it.
Feature: Dispatch-only workflow templates never gate on push

  @test:scripts/tests/sdlc/template-dispatch-gates.test.ts::dispatch-only_workflow_templates_never_gate_on_push::there_are_templates_to_check_(the_rule_is_not_vacuous)
  Scenario: There are workflow templates to check
    Given the "templates" directory
    When its "**/workflows/*.yml" files are collected
    Then there is at least one

  @test:scripts/tests/sdlc/template-dispatch-gates.test.ts::dispatch-only_workflow_templates_never_gate_on_push::%s_has_no_job_or_step_that_waits_for_a_push
  Scenario: A workflow template with no push trigger has no if-condition on a push event
    Given each workflow template whose "on:" block declares no push trigger
    When its lines are scanned for an "if:" testing github.event_name == 'push'
    Then there are none
    # Gap: the check is textual, line by line; a push condition spelled differently or split across lines is not seen.
