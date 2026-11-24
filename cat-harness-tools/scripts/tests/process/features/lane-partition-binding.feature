# A lane names its Role through standard BPMN partitionElementRef; the legacy
# <bootstrap.processes:role ref> is still read, as a fallback with a warning.
Feature: A lane binds its Role through partitionElementRef, with the legacy ref as a fallback

  @test:scripts/tests/process/lane-partition-binding.test.ts::loadProcessModel_reads_both_spellings::partitionElementRef_→_a_declared_<bpmn:resource>,_with_the_<bpmn:import>_head
  Scenario: A partitionElementRef to a declared resource binds the lane's role
    Given a one-task diagram with a <bpmn:import> head, a <bpmn:resource id="build-pipeline">, and a lane with partitionElementRef="build-pipeline"
    When it is loaded
    Then the lane's role is "build-pipeline", bound by partitionElementRef, with no resource-undeclared flag and no warning
    And the task "T" carries role "build-pipeline" and skills ["run-build"]

  @test:scripts/tests/process/lane-partition-binding.test.ts::loadProcessModel_reads_both_spellings::the_legacy_ref_alone_still_binds,_marked_legacy
  Scenario: The legacy role ref alone still binds, with a deprecation warning
    Given the diagram whose lane carries only <bootstrap.processes:role ref="build-pipeline">
    When it is loaded
    Then the lane's role is "build-pipeline", bound by legacy-role-ref
    And its binding warning says "deprecated"

  @test:scripts/tests/process/lane-partition-binding.test.ts::loadProcessModel_reads_both_spellings::both,_disagreeing:_partitionElementRef_wins,_with_a_warning
  Scenario: When the two spellings disagree, partitionElementRef wins with a warning
    Given the diagram whose lane has partitionElementRef="build-pipeline" and a legacy ref to "reviewer"
    When it is loaded
    Then the lane's role is "build-pipeline", bound by partitionElementRef
    And its binding warning names "reviewer"

  @test:scripts/tests/process/lane-partition-binding.test.ts::loadProcessModel_reads_both_spellings::variable="true"_is_a_declaration,_not_a_binding
  Scenario: A role marked variable declares a varying performer and binds no role
    Given the diagram whose lane carries <bootstrap.processes:role variable="true">
    When it is loaded
    Then the lane's performer varies
    And it has no role and no binding

  @test:scripts/tests/process/lane-partition-binding.test.ts::loadProcessModel_reads_both_spellings::a_partitionElementRef_with_no_declared_resource_loads,_and_says_so
  Scenario: A partitionElementRef with no declared resource loads and is flagged
    Given the diagram whose lane has partitionElementRef="build-pipeline" and no <bpmn:resource>
    When it is loaded
    Then the lane's role is "build-pipeline"
    And its role resource is marked undeclared

  @test:scripts/tests/process/lane-partition-binding.test.ts::loadProcessModel_reads_both_spellings::the_first_draft's_<bpmn:extension_definition>_does_not_refuse_the_load
  Scenario: A <bpmn:extension definition> in the head does not refuse the load
    Given the diagram with a <bpmn:extension definition="bootstrap.processes:skill"> and a resource in its head, and a partitionElementRef lane
    When it is loaded
    Then the lane's role is "build-pipeline"

  @test:scripts/tests/process/lane-partition-binding.test.ts::loadProcessModel_reads_both_spellings::any_OTHER_parse_warning_still_refuses_the_load
  Scenario: Any other parse warning is not tolerated
    # Gap: the title says the load is refused; the body checks only that partitionTolerated keeps the warning, it loads no diagram
    Given a parse warning "unparsable content <x> detected" on a bpmn:Task
    When the tolerated warnings are filtered
    Then the warning is kept
