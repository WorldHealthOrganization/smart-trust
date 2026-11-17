# workflow:instances (advisory): compares running workflow instances with
# merges, reports instances whose work item is closed or missing, and sweeps
# them. The instance directory comes from the bean graph and git is injected.
Feature: workflow:instances counts, reports and sweeps workflow instances

  @test:scripts/tests/process/workflow-instances.test.ts::workflowInstances::more_merges_than_instances_is_a_FINDING,_and_the_report_says_advisory
  Scenario: More merges than instances is an advisory finding
    Given two instances, one started since the window, and git reporting 40 merges
    When the instances are counted
    Then the state is "finding" with 2 instances, 1 started since, 40 merges and no gates reading
    And the report says "FINDING (advisory)" and "upper bound"

  @test:scripts/tests/process/workflow-instances.test.ts::workflowInstances::an_instance_with_no_startedAt_is_dated_by_its_first_history_entry
  Scenario: An instance with no startedAt is dated by its first history entry
    Given one instance with only a history entry dated in the window, and 1 merge
    When the instances are counted
    Then the state is "ok" with 1 started since and 1 merge

  @test:scripts/tests/process/workflow-instances.test.ts::workflowInstances::an_instance_that_cannot_be_dated_or_parsed_makes_the_count_UNKNOWN,_not_smaller
  Scenario: An unparsable or undatable instance makes the count unknown
    Given an instance file that is not JSON and one with no date
    When the instances are counted
    Then the state is "unknown"
    And the report names x.json

  @test:scripts/tests/process/workflow-instances.test.ts::workflowInstances::a_shallow_clone_is_UNKNOWN:_its_merge_count_is_not_the_repository's
  Scenario: A shallow clone gives an unknown count
    Given no instances and git reporting a shallow repository
    When the instances are counted
    Then the state is "unknown"

  @test:scripts/tests/process/workflow-instances.test.ts::workflowInstances::a_declared_but_absent_directory_is_UNKNOWN,_never_zero_instances
  Scenario: A declared but absent instance directory gives an unknown count
    Given a checkout whose declared instance directory has been removed
    When the instances are counted
    Then the state is "unknown"

  @test:scripts/tests/process/workflow-instances.test.ts::workflowInstances::a_CI_workflow_naming_the_graph_is_counted_as_reading_it
  Scenario: A CI workflow running workflow:instances is counted as reading it
    Given a CI workflow w.yml running "bun run cat workflow:instances" and another that does not
    When the instances are counted
    Then the state is "ok" and only w.yml is reading

  @test:scripts/tests/process/workflow-instances.test.ts::workflowInstances::reports_running_instances_on_closed_or_missing_work_items_and_in-progress_process_work_items_without_a_running_instance_(#988)
  Scenario: Running instances on closed or missing work items, and untracked process work items, are reported
    Given running instances on a completed work item, on a missing work item and on an in-progress one
    And an in-progress work item tagged with a process that has no running instance
    When the instances are counted
    Then the state is "finding"
    And the stale instances are the closed one (bean-closed, completed) and the missing one (bean-missing)
    And the untracked process work item is folio-assistant-untracked for Process_CodeChangeReview
    And the report gives counts 2 and 1 and names the untracked work item

  @test:scripts/tests/process/workflow-instances.test.ts::workflowInstances::sweepWorkflowInstances_closes_running_instances_(and_children)_whose_work_item_is_completed,_scrapped,_or_missing_(#988)
  Scenario: Sweeping closes instances whose work item is completed or missing
    # Gap: no scrapped work item is in the fixture, and the child instance's own closure is not asserted, only that its parent file was closed and the re-count is clean
    Given a running instance with a running child on a completed work item, an instance on a missing work item, and a running instance on an in-progress work item
    When the instances are swept
    Then the result is "ok" for beans/workflows, closing closed.json and missing.json
    And counting again finds no stale instances and no untracked process work items
