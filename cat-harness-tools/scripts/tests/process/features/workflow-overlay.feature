# The workflow tools resolve a dependency's diagrams, through the real tool
# registration: a root lists and starts its dependencies' processes, keeps
# its instances itself, and its own diagram shadows a dependency's.
Feature: The workflow tools resolve a dependency's diagrams

  @test:scripts/tests/process/workflow-overlay.test.ts::the_repository_root_—_what_the_MCP_server_starts_at_by_default::reaches_the_dependencies'_diagrams,_sample-import_among_them
  Scenario: The repository root reaches its dependencies' diagrams
    Given the repository root above cat-harness
    When its process roots and process files are resolved
    Then the roots include cat-harness
    And the files include a sample-import.bpmn

  @test:scripts/tests/process/workflow-overlay.test.ts::the_repository_root_—_what_the_MCP_server_starts_at_by_default::workflow_list_no_longer_reports_none
  Scenario: workflow_list at the repository root lists processes
    Given the workflow tools registered at the repository root
    When workflow_list is called
    Then the processes part of its output does not say "_(none)_"
    And it names Process_SampleImport

  @test:scripts/tests/process/workflow-overlay.test.ts::a_root_that_declares_no_diagram_of_its_own::workflow_start_resolves_a_dependency's_process,_and_writes_the_instance_under_the_ROOT
  Scenario: workflow_start resolves a dependency's process and writes the instance under the root
    Given a temporary root with no diagram, depending on cat-harness
    When workflow_start is called for process "sample-import" with subject "overlay"
    Then the output names Task_Scope
    And the instance file beans/workflows/sampleimport--overlay.json exists under the root and not under cat-harness

  @test:scripts/tests/process/workflow-overlay.test.ts::a_root_that_declares_no_diagram_of_its_own::workflow_complete_advances_an_instance_whose_diagram_lives_OUTSIDE_the_root
  Scenario: workflow_complete on an instance whose diagram is outside the root reaches authorization
    # Gap: the title says the instance advances; the body checks only that the call is refused by strict authorization (the diagram loaded) rather than with ENOENT, no advance is observed
    Given a temporary root depending on cat-harness, with a started "sample-import" instance "sampleimport--outside"
    When workflow_complete is called on its Task_Scope
    Then it rejects with "REFUSED (strict)"
    And not with ENOENT

  @test:scripts/tests/process/workflow-overlay.test.ts::a_root_that_declares_no_diagram_of_its_own::the_role_graph_is_found_in_the_dependency,_so_a_step_says_what_it_acts_AS
  Scenario: A started step says what role it acts as
    Given a temporary root with no diagram, depending on cat-harness
    When workflow_start is called for "sample-import"
    Then the output contains "acting as"

  @test:scripts/tests/process/workflow-overlay.test.ts::a_name_collision::the_root's_own_diagram_shadows_the_dependency's
  Scenario: The root's own diagram shadows the dependency's of the same name
    Given a temporary root depending on cat-harness and holding its own processes/sample-import.bpmn
    When its process files are resolved
    Then the only sample-import.bpmn is the root's own
    And it declares Process_SampleImport
