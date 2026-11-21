# The readability criteria of src/workflow/diagram-quality.ts, over one-process fixture diagrams
# with and without layout, so each branch executes. Each Scenario names the test that executes it.
Feature: Process diagram quality criteria

  @test:scripts/tests/diagram-quality.test.ts::structure::a_task_with_two_ways_out_and_no_gateway_is_an_implicit_split
  Scenario: A task with two ways out and no gateway is an implicit split
    Given a process whose task "A" flows to two named end events with no gateway
    When its diagram quality is read
    Then "activity-implicit-split" reports "A"
    And "process-single-start" reports nothing

  @test:scripts/tests/diagram-quality.test.ts::structure::a_loop-back_INTO_a_task_is_not_reported;_a_gateway_that_joins_and_splits_is
  Scenario: A loop-back into a task is not reported, but a gateway that joins and splits is
    Given a process with a second start event, and a gateway "G" named "Approved" that joins two flows, splits into two and loops back to task "A"
    When its diagram quality is read
    Then "activity-implicit-split" reports nothing
    And "gateway-mixed" reports "G"
    And "decision-label-question" reports "G"
    And "process-single-start" reports "Process_T"

  @test:scripts/tests/diagram-quality.test.ts::structure::labels:_a_nominalised_first_word_is_reported,_a_verb_ending_like_a_noun_is_not
  Scenario: A nominalised first word is reported and a verb ending like a noun is not
    Given tasks named "Signature verification", "Document the decision" and "Reviewing"
    When its diagram quality is read
    Then "activity-label-verb-first" reports only "C", the task "Reviewing"

  @test:scripts/tests/diagram-quality.test.ts::structure::size:_past_20_nodes_is_reported,_past_50_is_the_7PMG_threshold
  Scenario: A process past 20 nodes is reported for size
    # Gap: the past-50 "process-decompose" branch is not exercised; only its absence at 22 tasks is checked
    Given a process of a start event, 22 tasks in a row and an end event
    When its diagram quality is read
    Then "process-size" reports one finding
    And "process-decompose" reports nothing

  @test:scripts/tests/diagram-quality.test.ts::drawing_—_the_geometry_shared_with_archimate-crossings::a_clean_row_reads_0_on_all_three
  Scenario: A clean row reads zero on all three drawing criteria
    Given a start event, two tasks and an end event laid out in a row with straight horizontal edges
    When its diagram quality is read
    Then "edge-rectilinear", "edge-crossing" and "edge-through-node" report nothing

  @test:scripts/tests/diagram-quality.test.ts::drawing_—_the_geometry_shared_with_archimate-crossings::a_diagonal,_a_crossing,_and_a_line_over_a_task_are_each_reported
  Scenario: A diagonal edge, a crossing and a line over a task are each reported
    Given the same row where F1 runs through task B and F2 is diagonal and crosses F1
    When its diagram quality is read
    Then "edge-rectilinear" reports "F2"
    And "edge-crossing" reports "F1×F2"
    And "edge-through-node" reports "F1"
