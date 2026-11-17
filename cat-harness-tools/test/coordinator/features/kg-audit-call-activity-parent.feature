# Specifies kg-audit's "call-activity-resolves" criterion, run as
# `kg-audit.ts --instance ./folio-assistant-core --check --json` from the
# checkout root: targets hosted by another instance, local targets, dangling
# targets, and a diagram that cannot load.
Feature: A call activity resolves across the checkout's instances, and only an unloadable diagram is unknown

  @test:test/coordinator/kg-audit-call-activity-parent.test.ts::kg-audit:_call-activity-resolves_across_repository_instances_(bean_`t5j5`)::a_call_activity_whose_target_resolves_from_the_parent_root_is_a_PASS_with_hosting_instance_evidence
  Scenario: Calls hosted by cat-harness pass, naming the hosting instance
    Given kg:audit run over folio-assistant-core in the checkout
    When the report for Process_L1DocumentIngestion is read
    Then its "call-activity-resolves" result is "pass"
    And it has exactly 4 findings
    And they say Process_Ingestion, Process_IngestTheme, Process_BeanOpen and Process_BeanClose are each hosted by instance "cat-harness"

  @test:test/coordinator/kg-audit-call-activity-parent.test.ts::kg-audit:_call-activity-resolves_across_repository_instances_(bean_`t5j5`)::a_call_activity_whose_targets_are_all_local_resolves_as_a_PASS_with_empty_findings
  Scenario: Calls whose targets are all local pass with no findings
    Given kg:audit run over folio-assistant-core in the checkout
    When the report for Process_PublicComment is read
    Then its "call-activity-resolves" result is "pass"
    And it has no findings

  @test:test/coordinator/kg-audit-call-activity-parent.test.ts::kg-audit:_call-activity-resolves_across_repository_instances_(bean_`t5j5`)::a_call_activity_whose_target_resolves_nowhere_is_a_FAIL_naming_the_missing_process
  Scenario: A call to a process no instance hosts fails, naming it
    Given a diagram in folio-assistant-core/processes whose call activity calls "Process_TypoNonExistent999"
    When kg:audit is run over folio-assistant-core
    Then the report for Process_TestT5j5Dangling has "call-activity-resolves" "fail"
    And a finding says it calls "Process_TypoNonExistent999", the id of no process any instance in the repository can load
    And the planted diagram is removed afterwards

  @test:test/coordinator/kg-audit-call-activity-parent.test.ts::kg-audit:_call-activity-resolves_across_repository_instances_(bean_`t5j5`)::a_diagram_that_cannot_load_leaves_criteria_as_UNKNOWN
  Scenario: A diagram that cannot load leaves the criterion unknown
    Given a file "test-t5j5-malformed.bpmn" in folio-assistant-core/processes holding invalid XML
    When kg:audit is run over folio-assistant-core
    Then the report for "test-t5j5-malformed" has "call-activity-resolves" "unknown"
    And the planted file is removed afterwards
