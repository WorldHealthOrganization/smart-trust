# src/workflow/process-model.ts reads a BPMN process into nodes and branches: isDecision picks out the
# diverging exclusive gateways, and indistinctBranches reports a decision's unnamed or repeated branch labels.
# Each Scenario names the test that executes it.
Feature: Gateway decisions and their branch labels

  @test:scripts/tests/sdlc/gateway-documentation.test.ts::isDecision::a_diverging_exclusive_gateway_is_a_decision;_a_merge_and_a_parallel_fork_are_not
  Scenario: Only a diverging exclusive gateway counts as a decision
    Given a process with exclusive gateway "G" branching three ways, merge gateway "M", parallel fork "P" and task "A"
    When each node is asked whether it is a decision
    Then "G" is a decision
    And "M", "P" and "A" are not

  @test:scripts/tests/sdlc/gateway-documentation.test.ts::isDecision::the_decision's_documentation_is_read
  Scenario: A decision's documentation element is read into the model
    Given a process whose gateway "G" carries the documentation "Asked of the reviewer."
    When the process model is loaded
    Then node "G" has the documentation "Asked of the reviewer."

  @test:scripts/tests/sdlc/gateway-documentation.test.ts::indistinctBranches::distinct_labels:_nothing_to_report
  Scenario: A decision with distinct branch labels has no findings
    Given gateway "G" whose branches are labelled "yes", "no" and "maybe"
    When its indistinct branches are listed
    Then the list is empty
    And its branches are "yes" to "A", "no" to "B" and "maybe" to "C", in that order

  @test:scripts/tests/sdlc/gateway-documentation.test.ts::indistinctBranches::an_unnamed_branch_is_reported
  Scenario: An unnamed branch of a decision is reported
    Given gateway "G" whose branches are labelled "yes", nothing and "maybe"
    When its indistinct branches are listed
    Then the only finding is flow "fb" as "unnamed"

  @test:scripts/tests/sdlc/gateway-documentation.test.ts::indistinctBranches::a_repeated_label_is_reported_on_BOTH_branches,_ignoring_case_and_spacing
  Scenario: A label repeated up to case and spacing is reported on both branches
    Given gateway "G" whose branches are labelled "Yes", "no" and " yes "
    When its indistinct branches are listed
    Then the findings are flow "fa" and flow "fc", each as "duplicate"

  @test:scripts/tests/sdlc/gateway-documentation.test.ts::indistinctBranches::a_parallel_fork's_unnamed_branches_are_not_a_finding_—_nothing_is_chosen_there
  Scenario: A parallel fork's unnamed branches are not reported
    Given parallel gateway "P" whose two outgoing flows have no labels
    When its indistinct branches are listed
    Then the list is empty
