# scripts/check-workflow-coverage.ts surveys .github/workflows against the BPMN diagrams they declare
# (scripts/workflow-bpmn.ts reads the declarations): a mention is not coverage, an unreadable
# workflow is unknown, and a job's declared node must still match the diagram. Each Scenario names the test that executes it.
Feature: Workflow-to-diagram coverage and drift

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::a_workflow_DECLARES_its_diagram_(bean_61ca)::the_`#_bpmn:`_header_is_read
  Scenario: A "# bpmn:" header declares the workflow's diagram
    Given a workflow whose first line is "# bpmn: cat-harness/processes/x.bpmn"
    When its declarations are read
    Then its diagrams are exactly "cat-harness/processes/x.bpmn"

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::a_workflow_DECLARES_its_diagram_(bean_61ca)::a_MENTION_in_a_comment_is_not_a_declaration
  Scenario: A diagram mentioned in a comment is not a declaration
    Given a workflow whose comments mention a .bpmn path in prose and an indented "bpmn:" line
    When its declarations are read
    Then it declares no diagrams

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::a_workflow_DECLARES_its_diagram_(bean_61ca)::several_headers_are_all_read
  Scenario: Several "# bpmn:" headers are all read
    Given a workflow with headers "# bpmn: a.bpmn" and "# bpmn: b.bpmn"
    When its declarations are read
    Then its diagrams are "a.bpmn" and "b.bpmn" in that order

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::a_job_DECLARES_its_node::a_node_is_attributed_to_the_job_that_CONTAINS_it,_at_any_depth_inside_it
  Scenario: A node is attributed to the job that contains it, at any depth
    Given a workflow whose "stage" job holds "# bpmn-node: Start_PR" and whose "cleanup" job holds "# bpmn-node: Start_Closed" nested under its steps
    When its declarations are read
    Then the nodes are "Start_PR" for "stage" and "Start_Closed" for "cleanup", and nothing else

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::a_job_DECLARES_its_node::a_comment_ABOVE_a_job_key_belongs_to_no_job_—_proximity_is_not_containment
  Scenario: A node comment above a job key belongs to no job
    Given the same workflow with "# bpmn-node: Above_Is_Prose" just above the "stage" key
    When its declarations are read
    Then no node "Above_Is_Prose" is read

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::a_job_DECLARES_its_node::a_`#_bpmn-node:`_outside_`jobs:`_is_not_read
  Scenario: A "# bpmn-node:" outside "jobs:" is not read
    Given a workflow with "# bpmn-node: Nope" under "env:"
    When its declarations are read
    Then it declares no nodes

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::a_job_DECLARES_its_node::bpmnIds_reads_every_element_id,_and_nothing_that_is_not_one
  Scenario: bpmnIds reads every element id and nothing that is not one
    Given BPMN XML with a process "P", a start event "S" whose name contains id="x", and documentation text containing id="Y"
    When its element ids are read
    Then the ids are exactly "P" and "S"

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::autoTriggered_—_does_it_fire_without_somebody_asking?::case_%#
  Scenario: Push, schedule and pull_request_target fire automatically; dispatch and call do not
    Given a workflow whose "on:" is one of the listed trigger sets
    When autoTriggered is asked of it
    Then push, schedule and pull_request_target each answer true
    And workflow_dispatch, workflow_call, and the two together each answer false

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::autoTriggered_—_does_it_fire_without_somebody_asking?::a_mixed_workflow_is_AUTO_—_one_automatic_trigger_is_enough
  Scenario: A workflow with one automatic trigger among manual ones is automatic
    Given a workflow triggered by workflow_dispatch and push
    When autoTriggered is asked of it
    Then it answers true

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::autoTriggered_—_does_it_fire_without_somebody_asking?::unparseable_YAML_gives_a_REASON,_never_`false`
  Scenario: Unparseable YAML gives a reason, never false
    Given a workflow whose YAML has broken indentation
    When autoTriggered is asked of it
    Then the answer is an object, not a boolean

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::autoTriggered_—_does_it_fire_without_somebody_asking?::a_workflow_with_no_`on:`_is_a_reason,_not_a_quiet_false
  Scenario: A workflow with no "on:" gives a reason, not a quiet false
    Given a workflow with jobs but no "on:"
    When autoTriggered is asked of it
    Then the answer is a reason containing "no `on:`"

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::the_survey's_three_states::COVERED_—_a_declaration_names_it
  Scenario: A workflow that declares an existing diagram is covered
    Given a scratch repository whose push workflow "a.yml" declares "processes/a.bpmn", which exists
    When the workflows are surveyed
    Then there is one row, it is covered, and it is automatic

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::the_survey's_three_states::UNCOVERED_is_a_DETERMINED_absence_—_the_file_read_fine,_nothing_declares_it
  Scenario: A readable workflow that declares nothing is uncovered, with no reason
    Given a scratch repository with a push workflow that declares no diagram
    When the workflows are surveyed
    Then the row is uncovered and carries no reason

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::the_survey's_three_states::UNKNOWN_—_unreadable_is_never_rendered_as_covered,_even_WITH_a_declaration
  Scenario: An unreadable workflow is unknown even when it declares a diagram
    Given a workflow that declares "processes/a.bpmn" but whose YAML does not parse
    When the workflows are surveyed
    Then the row is unknown and carries a reason

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::the_survey's_three_states::a_mention-only_diagram_leaves_the_workflow_UNCOVERED
  Scenario: A diagram that only mentions the workflow leaves it uncovered
    Given a workflow that declares no diagram, and a diagram whose documentation mentions ".github/workflows/a.yml"
    When the workflows are surveyed
    Then the row is uncovered

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::the_survey's_three_states::DANGLING_—_a_workflow_naming_a_diagram_that_is_not_there_is_reported
  Scenario: A declaration of a missing diagram is reported as dangling and is not coverage
    Given a workflow "a.yml" that declares "processes/gone.bpmn", which does not exist
    When the workflows are surveyed
    Then the dangling list holds that diagram with workflow ".github/workflows/a.yml"
    And the row is uncovered

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::the_survey's_three_states::no_workflows_directory_is_an_empty_survey,_not_a_crash
  Scenario: A repository with no workflows directory gives an empty survey
    Given an empty scratch directory
    When the workflows are surveyed
    Then there are no rows and no dangling declarations

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::this_repository,_right_now::every_workflow_is_readable_—_a_count_over_unreadable_files_is_not_a_count
  Scenario: Every workflow in this repository is readable
    Given this repository's workflows
    When they are surveyed
    Then no row is unknown

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::this_repository,_right_now::no_declaration_dangles
  Scenario: No declaration in this repository dangles
    Given this repository's workflows
    When they are surveyed
    Then the dangling list is empty

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::this_repository,_right_now::the_diagrams_are_FOUND_—_a_workflow's_path_resolves_from_the_repository_root
  Scenario: This repository's declared diagrams are found from the repository root
    Given this repository's workflows
    When they are surveyed
    Then at least one row is covered

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::this_repository,_right_now::there_are_workflows_to_survey_—_a_green_run_over_zero_files_is_not_coverage
  Scenario: This repository has workflows to survey
    Given this repository's workflows
    When they are surveyed
    Then there is at least one row

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::reading_the_workflow's_real_jobs::the_job_names_come_back_in_order
  Scenario: A workflow's job names are read in order
    Given a workflow with jobs "stage" then "cleanup"
    When its jobs are read
    Then they are "stage" and "cleanup" in that order

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::reading_the_workflow's_real_jobs::UNPARSEABLE_yaml_is_a_REASON,_not_an_empty_list
  Scenario: Unparseable YAML gives a reason, not an empty job list
    Given a workflow whose "jobs:" holds an unbalanced list
    When its jobs are read
    Then the answer is an object with a reason

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::reading_the_workflow's_real_jobs::no_`jobs:`_key_at_all_is_a_reason_too
  Scenario: A workflow with no "jobs:" key gives a reason
    Given a workflow with only "on: push"
    When its jobs are read
    Then the reason is "declares no `jobs:`"

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::reading_the_workflow's_real_jobs::`jobs:`_that_is_a_LIST_is_a_reason_—_it_is_not_a_mapping_of_names
  Scenario: A "jobs:" that is a list gives a reason
    Given a workflow whose "jobs:" is a list of "a" and "b"
    When its jobs are read
    Then the reason is "`jobs:` is not a mapping"

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::comparing_them,_in_BOTH_directions::matching_sets_drift_in_neither_direction
  Scenario: Matching jobs and nodes drift in neither direction
    Given diagram ids "S1" and "S2", and jobs "a" and "b" declaring "S1" and "S2" in a different order
    When they are compared
    Then the result is declared, with nothing missing, extra or duplicated

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::comparing_them,_in_BOTH_directions::a_job_with_NO_node_is_missing_—_the_workflow_gained_one
  Scenario: A job with no node is missing
    Given jobs "a" and "b", and only "a" declaring a node
    When they are compared
    Then "b" is missing

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::comparing_them,_in_BOTH_directions::a_node_the_diagram_does_NOT_have_is_extra_—_the_diagram_lost_one
  Scenario: A declared node the diagram lacks is extra
    Given job "a" declaring node "Gone", which is not a diagram id
    When they are compared
    Then "Gone" is extra

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::comparing_them,_in_BOTH_directions::one_job_naming_TWO_nodes_is_reported_rather_than_silently_deduped
  Scenario: One job naming two nodes is reported as duplicated
    Given job "a" declaring "S1" and "S2", and job "b" declaring "S1"
    When they are compared
    Then "a" is duplicated

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::comparing_them,_in_BOTH_directions::NOTHING_declared_is_`declared:_false`,_not_fully_drifted
  Scenario: Nothing declared is undeclared, not fully drifted
    Given jobs "a" and "b" and no node declarations
    When they are compared
    Then the result is not declared, with "a" and "b" missing

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::over_the_whole_survey::a_covered_workflow_whose_jobs_all_name_a_node_reports_no_drift
  Scenario: A covered workflow whose jobs all name a diagram node reports no drift
    Given a covered workflow whose "stage" and "cleanup" jobs name "S1" and "S2", both in the diagram
    When the workflows are surveyed
    Then the row's jobs are declared with nothing missing or extra

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::over_the_whole_survey::a_job_added_to_the_workflow_shows_up_as_missing
  Scenario: A job added to the workflow shows up as missing
    Given a covered workflow where only "stage" names a node
    When the workflows are surveyed
    Then "cleanup" is missing

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::over_the_whole_survey::a_node_removed_from_the_diagram_shows_up_as_extra
  Scenario: A node removed from the diagram shows up as extra
    Given a covered workflow whose "cleanup" job names "S9", which the diagram lacks
    When the workflows are surveyed
    Then "S9" is extra

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::over_the_whole_survey::an_UNCOVERED_workflow_has_no_drift_result_—_there_is_nothing_to_compare
  Scenario: An uncovered workflow has no drift result
    Given the same two-job workflow without its "# bpmn:" header
    When the workflows are surveyed
    Then the row has no jobs result

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::over_the_whole_survey::a_covered_workflow_whose_`jobs:`_cannot_be_read_goes_UNKNOWN,_not_drift-free
  Scenario: A covered workflow whose "jobs:" cannot be read is unknown, not drift-free
    Given a workflow that declares "processes/a.bpmn" and whose "jobs:" is a list
    When the workflows are surveyed
    Then the row is unknown and has no jobs result

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::this_repository,_right_now::no_documented_workflow_has_drifted
  Scenario: No documented workflow in this repository has drifted
    Given this repository's workflows
    When they are surveyed
    Then no row with declared jobs has any missing, extra or duplicated entry

  @test:scripts/tests/sdlc/workflow-coverage.test.ts::drift_—_the_diagram_still_matches_the_workflow_it_documents::this_repository,_right_now::every_documented_workflow_DECLARES_its_jobs_—_coverage_without_it_is_unchecked
  Scenario: Every documented workflow in this repository declares its jobs' nodes
    Given this repository's workflows
    When they are surveyed
    Then no row with a jobs result is undeclared
