# The workflow tools' typed results agree with the engine (issue #1259).
# Each Scenario names the test that executes it.
Feature: Workflow tool results

  @test:scripts/tests/workflow-tool-results.test.ts::the_workflow_tools'_results::are_published_as_shared_tool_types
  Scenario: The results are shared tool types
    Then WorkflowListing, WorkflowStarted, WorkflowPosition, WorkflowGateAnswer and WorkflowCompletion are tool types

  @test:scripts/tests/workflow-tool-results.test.ts::the_workflow_tools'_results::a_listing,_with_a_process_that_cannot_be_read,_parses
  Scenario: A listing with an unreadable process parses
    Given a listing of a readable process, an unreadable one with an error, and a running instance
    Then it parses back unchanged
    And an instance with status "paused" is refused

  @test:scripts/tests/workflow-tool-results.test.ts::the_workflow_tools'_results::a_fresh_instance_of_a_real_process_gives_a_position_that_parses
  Scenario: A fresh instance's position parses
    # Gap: returns early with no assertion when the harness has no process file.
    Given the first harness process that is not a global-tasks file
    When an instance is started and its position taken
    Then the position parses back unchanged, names the instance, and is "running"

  @test:scripts/tests/workflow-tool-results.test.ts::the_workflow_tools'_results::a_gate_answer_with_an_unknown_assignment_is_refused
  Scenario: A gate answer with an unknown assignment value is refused
    Given a refused gate answer with assignment "unknown-actor"
    Then it parses back unchanged
    And with assignment "maybe" it is refused
