# A diagram is identified by its layer and its path within it (src/workflow/process-model.ts and
# scripts/audit-reachability.ts), over two fixture layers that each hold processes/global-tasks.bpmn.
# Each Scenario names the test that executes it.
Feature: Diagram identity by layer and path

  @test:scripts/tests/diagram-identity.test.ts::two_instances,_each_with_processes/global-tasks.bpmn::a_bare-id_call_resolves_to_the_global_task_of_the_caller's_OWN_instance
  Scenario: A bare-id call resolves to the global task of the caller's own layer
    Given layers "low" and "up", where "up" needs "low", each with a global task "GT_Shared" and a process calling it by bare id
    When each layer's process model is loaded
    Then up's call resolves to up's global-tasks.bpmn, is named "Shared step of up" and carries skill "up-skill"
    And low's call resolves to low's global-tasks.bpmn and is named "Shared step of low"

  @test:scripts/tests/diagram-identity.test.ts::two_instances,_each_with_processes/global-tasks.bpmn::audit:reachability_reports_both_files_as_shared,_and_no_name_clash
  Scenario: audit:reachability reports both same-named global-task files as shared, with no clash
    Given the two fixture layers
    When process reachability is computed from "up"
    Then nothing is ambiguous
    And the shared files are "processes/global-tasks.bpmn" and "../low/processes/global-tasks.bpmn"
    And once a second startable "low-work.bpmn" is added to "up", the only clash is "stem:low-work"

  @test:scripts/tests/diagram-identity.test.ts::two_instances,_each_with_processes/global-tasks.bpmn::a_decision_reference_is_credited_to_the_table_at_its_path,_not_to_every_table_of_that_name
  Scenario: A decision reference is credited only to the table at its path
    Given the two fixture layers, each with "processes/decisions/route.dmn", and only up's process routing on it
    When decision reachability is computed from "up"
    Then up's "processes/decisions/route.dmn" is referenced by "up-work.bpmn#G_P_up"
    And low's route.dmn is referenced by nothing
