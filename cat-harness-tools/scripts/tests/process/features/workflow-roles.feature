# The interpreter reports what an agent acts AS — the lane's declared role
# and that role's skills — and still works without a role graph.
Feature: enabled() joins a lane to its declared role

  @test:scripts/tests/process/workflow-roles.test.ts::enabled()_joins_a_lane_to_its_declared_role::reports_the_role,_not_only_the_lane's_spelling
  Scenario: Every enabled step in a lane reports a role
    Given crdm-requirements.bpmn and the harness's role graph
    When an instance is started and its enabled steps are listed with the graph
    Then there is at least one enabled step
    And every enabled step with a lane has a role

  @test:scripts/tests/process/workflow-roles.test.ts::enabled()_joins_a_lane_to_its_declared_role::an_activity's_roleSkills_is_the_role's_closure,_not_the_activity's_own_refs
  Scenario: An enabled activity's roleSkills is its role's resolved skill closure
    Given crdm-requirements.bpmn and the harness's role graph
    When an instance is started and its enabled steps are listed with the graph
    Then each activity with a role has roleSkills equal to that role's resolved skills

  @test:scripts/tests/process/workflow-roles.test.ts::enabled()_joins_a_lane_to_its_declared_role::without_a_role_graph_the_interpreter_still_works_—_unmigrated_is_not_broken
  Scenario: Without a role graph, enabled steps carry no role
    Given crdm-requirements.bpmn and no role graph
    When an instance is started and its enabled steps are listed
    Then there is at least one enabled step
    And none has a role, and no activity has roleSkills

  @test:scripts/tests/process/workflow-roles.test.ts::enabled()_joins_a_lane_to_its_declared_role::describe()_and_enabled()_cannot_disagree_about_who_performs_a_step
  Scenario: describe() names every role enabled() reports
    # Gap: the body checks only that each role id appears somewhere in describe()'s text, not that it is attributed to the same step
    Given crdm-requirements.bpmn and the harness's role graph, with a started instance
    When the instance is described and its enabled steps are listed
    Then the description contains the role of every enabled step that has one

  @test:scripts/tests/process/workflow-roles.test.ts::every_activity_in_every_diagram_is_performed_by_a_declared_role::no_enabled_step_in_any_process_would_report_an_unbound_lane
  Scenario: Every lane of every process diagram binds a declared role
    # Gap: the body checks lanes, not activities; an activity in no lane is not checked
    Given every process diagram among the harness's workflow files, and the checkout's role graph
    When each lane's roleRef is looked up among the roles
    Then no lane is unbound
