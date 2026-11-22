# src/workflow/gate.ts (checkGate) must refuse, not crash on, a legacy
# folio-workflow-instance/v1 record that carries history but no tokens.
# Each Scenario names the test that executes it.
Feature: The workflow gate on a legacy instance with no tokens

  @test:test/workflow/gate-legacy-instance.test.ts::checkGate_on_a_legacy_instance_with_no_tokens::refuses_with_a_reason_instead_of_throwing
  Scenario: A legacy instance with no tokens is refused with a reason instead of throwing
    Given a strict editing process with task "Task_Commit"
    And a legacy instance "editing--fig-5" with a history entry and no tokens
    When the gate is checked for "Task_Commit"
    Then it is not allowed
    And the reason says the task "is not enabled"
