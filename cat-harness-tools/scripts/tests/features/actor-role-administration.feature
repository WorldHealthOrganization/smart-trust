# The structural claims of the actor-role-administration.bpmn diagram, loaded
# through src/workflow/process-model.ts with its administrator role from the role graph.
# Each Scenario names the test that executes it.
Feature: Actor and role administration process

  @test:scripts/tests/actor-role-administration.test.ts::what_it_adds_over_code-change-review::it_NAMES_that_process_rather_than_restating_its_steps
  Scenario: The code review step names Process_CodeChangeReview rather than calling it
    Given the actor-role-administration diagram is loaded
    When its step "CallActivity_CodeChangeReview" is read
    Then it calls no element
    And its documentation names "Process_CodeChangeReview"

  @test:scripts/tests/actor-role-administration.test.ts::what_it_adds_over_code-change-review::the_audit_runs_after_the_call,_not_before
  Scenario: The KG audit runs after the code review step
    Given the actor-role-administration diagram is loaded
    When the flow into "Task_RunKgAudit" is found
    Then it comes from "CallActivity_CodeChangeReview"

  @test:scripts/tests/actor-role-administration.test.ts::what_it_adds_over_code-change-review::retiring_an_actor_names_deletion-requires-confirmation
  Scenario: Retiring an actor names deletion-requires-confirmation
    Given the actor-role-administration diagram is loaded
    Then the skills of "Task_RetireActor" include "deletion-requires-confirmation"

  @test:scripts/tests/actor-role-administration.test.ts::the_administrator_lane::every_administrative_activity_is_a_userTask_—_none_can_be_automated
  Scenario: No administrative activity can be fulfilled by a system actor
    # Gap: the BPMN type is not asserted to be userTask; only that its derived fulfilment kinds exclude "system"
    Given the actor-role-administration diagram is loaded
    Then "Task_AddActor", "Task_AssignRoles", "Task_GrantOrRevoke" and "Task_RetireActor" each exist
    And the fulfilment kinds derived from each one's BPMN type do not include "system"

  @test:scripts/tests/actor-role-administration.test.ts::the_administrator_lane::the_role_it_binds_admits_only_people
  Scenario: The administrator role admits only people
    Given the harness's role graph
    When the "administrator" role is found
    Then its actor kinds are exactly "person"

  @test:scripts/tests/actor-role-administration.test.ts::the_administrator_lane::the_role_carries_every_skill_its_lane's_activities_name
  Scenario: The administrator role carries the skills its activities name
    # Gap: only "role-model" and "deletion-requires-confirmation" are checked, not every skill of the lane
    Given the diagram and the "administrator" role
    Then "Task_GrantOrRevoke" names skill "role-model"
    And the role carries "role-model"
    And the role carries "deletion-requires-confirmation"

  @test:scripts/tests/actor-role-administration.test.ts::the_process_declares_its_own_policy::strict_and_logged,_both_stated_rather_than_defaulted
  Scenario: The process is strict and logged
    # Gap: the values are checked, not that the diagram states them rather than defaulting
    Given the actor-role-administration diagram is loaded
    Then its enforcement is "strict"
    And its log capture is "on"
