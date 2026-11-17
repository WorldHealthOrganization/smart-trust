# The workflow interpreter on the harness's shipped diagrams, its refusal of
# BPMN it cannot walk, and the store writing an instance's diagram path
# repo-relatively.
#
# Not tagged (test-name-not-static): the per-diagram "${f} parses, and every
# flow connects two known nodes" and the per-file "${f} defines global
# tasks, each naming a skill" tests are titled by a loop variable.
Feature: The workflow interpreter reads the shipped diagrams, and instances record them repo-relatively

  @test:scripts/tests/process/workflow-interpreter.test.ts::every_shipped_diagram_is_interpretable::there_are_diagrams_to_interpret
  Scenario: There are shipped process diagrams
    Given the harness's workflow files
    When the process diagrams among them are listed
    Then there is at least one

  @test:scripts/tests/process/workflow-interpreter.test.ts::unsupported_BPMN_is_refused,_not_skipped::an_element_the_interpreter_cannot_walk_throws_and_names_itself
  Scenario: An intermediate timer event is refused and named
    Given a process with an intermediate catch event carrying a timer
    When it is loaded
    Then loading rejects with UnsupportedBpmn naming IntermediateCatchEvent

  @test:scripts/tests/process/workflow-interpreter.test.ts::a_committed_instance_records_its_diagram_REPO-RELATIVELY_—_bean_`chq5`::an_absolute_path_inside_the_repo_is_written_relative
  Scenario: An absolute diagram path inside the repository is saved relative
    Given an instance whose source is an absolute path inside the repository
    When it is saved and loaded back
    Then its source is "cat-harness/workflows/x.bpmn"

  @test:scripts/tests/process/workflow-interpreter.test.ts::a_committed_instance_records_its_diagram_REPO-RELATIVELY_—_bean_`chq5`::CHILDREN_are_normalised_too_—_the_defect_was_one_field_deeper
  Scenario: Child and grandchild diagram paths are saved relative too
    Given an instance with a child and a grandchild, each with an absolute source inside the repository
    When it is saved and loaded back
    Then the sources are "a/parent.bpmn", "a/one.bpmn" and "a/deep.bpmn"

  @test:scripts/tests/process/workflow-interpreter.test.ts::a_committed_instance_records_its_diagram_REPO-RELATIVELY_—_bean_`chq5`::an_already-relative_path_is_left_exactly_as_it_is
  Scenario: A relative diagram path is kept as it is
    Given an instance whose source is "cat-harness/workflows/x.bpmn"
    When it is saved and loaded back
    Then its source is unchanged

  @test:scripts/tests/process/workflow-interpreter.test.ts::a_committed_instance_records_its_diagram_REPO-RELATIVELY_—_bean_`chq5`::a_path_OUTSIDE_the_repository_is_left_alone,_not_turned_into_../..
  Scenario: A diagram path outside the repository is kept absolute
    Given an instance whose source is /etc/elsewhere/x.bpmn
    When it is saved and loaded back
    Then its source is that absolute path, with no ".."

  @test:scripts/tests/process/workflow-interpreter.test.ts::a_committed_instance_records_its_diagram_REPO-RELATIVELY_—_bean_`chq5`::normalising_on_WRITE_repairs_a_file_that_was_already_wrong
  Scenario: Re-saving a loaded instance keeps its path relative
    # Gap: no file already on disk with an absolute path is repaired; the body re-saves an instance the first save had already normalised
    Given an instance saved with an absolute source inside the repository
    When it is loaded and saved again, and loaded back
    Then its source is "a/parent.bpmn"

  @test:scripts/tests/process/workflow-interpreter.test.ts::every_shipped_diagram_is_interpretable::%s_parses,_and_every_flow_connects_two_known_nodes
  Scenario: Each shipped workflow diagram parses, and every flow connects two known nodes
    Given each process diagram found through the harness's workflow files, one row per diagram
    When it is loaded as a process model
    Then its id starts with "Process_" and it has at least one start node
    And every flow's source and target are nodes of the model
    And every activity sits in a lane

  @test:scripts/tests/process/workflow-interpreter.test.ts::a_layer's_shared_global-tasks_file_is_read,_not_interpreted::%s_defines_global_tasks,_each_naming_a_skill
  Scenario: Each shared global-tasks file defines global tasks, each naming a skill
    Given each .bpmn workflow file of the harness that is a global-tasks file, one row per file
    When its global tasks are loaded
    Then there is at least one, and each names at least one skill
    And loading it as a process model is refused as unsupported BPMN
