# The readable-at-100% and detangle criteria of src/workflow/diagram-fit.ts,
# each on a small diagram built to show one thing: size, labels, lane order,
# crossings, slanted flows, flows through boxes, overlaps, task size, pools.
Feature: A BPMN diagram's layout is checked for fit and tangles, and the fixable ones are fixed

  @test:scripts/tests/process/diagram-fit.test.ts::geometry::a_cross_is_a_crossing;_touching_ends_and_collinear_runs_are_not
  Scenario: Only a true cross counts as a crossing
    Given two segments that cross, two that touch at an end, and two collinear overlapping runs
    When each pair is tested for crossing
    Then only the first pair crosses

  @test:scripts/tests/process/diagram-fit.test.ts::geometry::a_segment_through_a_box_hits_it;_one_passing_beside_does_not
  Scenario: A segment through a box hits it; one beside it does not
    Given a box at (10,10) of 20 × 20
    When a horizontal segment at y 20 and one at y 40 are tested against it
    Then the first hits and the second does not

  @test:scripts/tests/process/diagram-fit.test.ts::size_budget::wider_than_the_budget_is_reported_with_the_text_size_it_shows_at
  Scenario: A diagram wider than the budget is reported
    Given a one-lane diagram 200px wider than FIT_WIDTH
    When its fit is checked
    Then there is one diagram-too-wide finding saying "px in a 1200px band"

  @test:scripts/tests/process/diagram-fit.test.ts::size_budget::within_budget_is_clean
  Scenario: A diagram within budget is clean
    Given a one-lane diagram 800px wide
    When its fit is checked
    Then there are no diagram-too-wide or diagram-too-tall findings

  @test:scripts/tests/process/diagram-fit.test.ts::labels::a_gateway_question_on_its_own_'No'_answer_is_an_overlap,_a_label_on_a_flow_and_on_its_own_shape
  Scenario: A gateway's question drawn over its "No" flow is reported three ways
    Given a gateway G whose drawn question label lies across its "no" flow and that flow's "No" label
    When its fit is checked against the drawn labels
    Then label-overlap is exactly "G+no"
    And label-on-edge is exactly "G/no"
    And label-on-shape includes "G/G"

  @test:scripts/tests/process/diagram-fit.test.ts::labels::without_a_drawing,_the_file's_own_label_bounds_are_checked
  Scenario: Without a drawing the file's label bounds are checked
    Given a gateway whose label bounds in the file overlap the task T
    When its fit is checked with no drawing
    Then label-on-shape is exactly "G/T"

  @test:scripts/tests/process/diagram-fit.test.ts::labels::a_label_in_a_lane's_name_strip_is_reported
  Scenario: A label in a lane's name strip is reported
    Given a shape whose label bounds lie in lane L1's name strip
    When its fit is checked
    Then label-on-shape is exactly "S/L1"

  @test:scripts/tests/process/diagram-fit.test.ts::lane_order::the_cheapest_order_is_found,_and_is_reported
  Scenario: The cheapest lane order is found and reported
    Given A in lane One, B in lane Three and C in lane Two, with flows A→B and B→C
    When the best lane order is computed
    Then the current cost is 3 and the best is 2
    And the fit check reports one lane-order finding

  @test:scripts/tests/process/diagram-fit.test.ts::lane_order::applying_it_moves_lanes_and_their_shapes,_keeps_heights,_and_re-routes_cross-lane_flows
  Scenario: Applying the best lane order reorders lanes and re-routes flows
    # Gap: shapes are checked to keep their heights, not that each moved with its lane; only flow "ab" is checked to start and end on its shapes
    Given the same three-lane diagram
    When its best lane order is applied
    Then the lanes are in that order, each with its old height
    And A, B and C keep their heights
    And the new order costs 2 with no crossings
    And flow "ab" starts at A's centre and ends on an edge of B

  @test:scripts/tests/process/diagram-fit.test.ts::lane_order::an_order_already_at_its_best_is_left_exactly_as_it_is
  Scenario: A lane order already at its best is left unchanged
    Given a diagram whose lane order is already the cheapest
    When its best order is applied
    Then the XML is unchanged

  @test:scripts/tests/process/diagram-fit.test.ts::crossings::two_flows_of_one_node_that_cross_on_the_way_are_a_tangle
  Scenario: Two flows of one node that cross are a tangle
    Given a flow St→Rv up the middle and a flow It→St across it
    When the crossings are computed
    Then they are exactly ["up", "back"]

  @test:scripts/tests/process/diagram-fit.test.ts::slanted_flows::are_reported
  Scenario: Slanted flows are reported
    Given flows f2 and f3, each one straight slant between lanes
    When the fit is checked
    Then edge-diagonal is exactly f2 and f3

  @test:scripts/tests/process/diagram-fit.test.ts::slanted_flows::are_re-routed_at_right_angles_through_the_gap,_from_side_to_side
  Scenario: Slanted flows are re-routed at right angles through the gap
    Given the same slanted flows
    When the flows are straightened
    Then f2 and f3 are fixed and no edge-diagonal finding remains
    And f2 runs (590,130) → (615,130) → (615,270) → (640,270)

  @test:scripts/tests/process/diagram-fit.test.ts::slanted_flows::a_route_through_another_shape_is_left_for_the_author
  Scenario: A slanted flow whose right-angle route would cross a shape is left alone
    Given a slanted flow A→B with a tall shape X in the gap
    When the flows are straightened
    Then nothing is fixed

  @test:scripts/tests/process/diagram-fit.test.ts::labels_on_arrows_and_lane_lines_(owner,_2026-10-31:_"need_to_check_for_text_on_arrows")::a_label_over_the_flow_leaving_its_own_event,_and_across_a_lane_line,_is_reported
  Scenario: A label over its event's outgoing flow and across a lane line is reported
    Given a start event A whose label hangs over its flow F and across the line into the next lane
    When the fit is checked
    Then label-on-edge includes "A/F"
    And label-on-lane-line includes "A/L1"

  @test:scripts/tests/process/diagram-fit.test.ts::labels_on_arrows_and_lane_lines_(owner,_2026-10-31:_"need_to_check_for_text_on_arrows")::--write_moves_it_to_a_clear_place_inside_its_lane,_and_the_check_is_then_clean
  Scenario: Placing labels moves a bad one inside its lane and the check is clean
    Given the same diagram and A's drawn label
    When the labels are placed
    Then A is moved, and its label lies within lane One (y 0 to 100)
    And there are no label-on-edge, label-on-lane-line or label-on-shape findings

  @test:scripts/tests/process/diagram-fit.test.ts::labels_on_arrows_and_lane_lines_(owner,_2026-10-31:_"need_to_check_for_text_on_arrows")::a_label_already_clear_is_left_where_it_is
  Scenario: A clear label is not moved
    Given a start event whose label sits clear beside it
    When the labels are placed
    Then nothing is moved

  @test:scripts/tests/process/diagram-fit.test.ts::flows_through_boxes::a_flow_drawn_through_a_step_it_does_not_touch_is_reported
  Scenario: A flow through a step it does not connect is reported
    Given a flow A→C drawn straight through B
    When the flows through shapes are computed and the fit is checked
    Then the pair is ["F", "B"] and edge-through-shape is "F/B"

  @test:scripts/tests/process/diagram-fit.test.ts::flows_through_boxes::a_flow_drawn_through_its_OWN_source_and_target_is_reported_(cat-harness#991)
  Scenario: A flow through its own source and target is reported; side to side it is clean
    Given a flow Commit→Gates starting inside Commit and running up through Gates
    When the flows through their own ends are computed and the fit is checked
    Then they are F/Commit and F/Gates
    When the flow instead runs from Commit's top edge to Gates' bottom edge
    Then no flow runs through its own ends and none is detached

  @test:scripts/tests/process/diagram-fit.test.ts::flows_through_boxes::a_flow_that_stops_short_of_its_target_is_detached
  Scenario: A flow that stops short of its target is detached
    Given a flow A→B whose last point is short of B
    When the detached edges are computed
    Then they are exactly ["F", "B"]

  @test:scripts/tests/process/diagram-fit.test.ts::flows_through_boxes::a_lane_swap_keeps_a_loop-back_flow's_bends_rather_than_drawing_it_through_the_lane's_steps
  Scenario: Swapping lanes keeps a loop-back flow's bends
    Given D in lane One looping back to A in lane Two over B and C
    When the lane order L2, L1, L3 is applied
    Then the lanes are in that order and no flow runs through a shape
    And F runs (350,150) → (30,150) → (30,50) → (50,50)

  @test:scripts/tests/process/diagram-fit.test.ts::reading_the_DI::a_shape_whose_BPMNLabel_comes_before_its_own_Bounds_is_still_read,_label_and_all
  Scenario: A shape whose label precedes its bounds is read correctly
    Given a gateway shape whose BPMNLabel bounds come before its own Bounds
    When the DI is read
    Then G has bounds (30,10,50,50) and label (10,70,90,20)

  @test:scripts/tests/process/diagram-fit.test.ts::steps_on_top_of_each_other::two_steps_drawn_over_each_other_are_reported;_apart_they_are_not
  Scenario: Overlapping steps are reported; separate ones are not
    Given steps A and B drawn over each other
    When the fit is checked
    Then shape-overlap is exactly "A+B"
    Given A and B drawn apart
    Then there is no shape-overlap finding

  @test:scripts/tests/process/diagram-fit.test.ts::tasks_are_one_square_size_(TASK_SIZE)::a_wide_task_and_a_short_one_are_both_drawn_at_TASK_SIZE,_about_their_centres
  Scenario: Off-size tasks are resized to TASK_SIZE about their centres
    # Gap: only A's horizontal centre is checked to be kept; its vertical centre and B's centre are not
    Given a wide task A and a short task B
    When the off-size tasks are listed and the task size is fixed
    Then A and B are off-size, and both are fixed
    And no task is off-size afterwards, A is TASK_SIZE, and A's centre x is still 130

  @test:scripts/tests/process/diagram-fit.test.ts::tasks_are_one_square_size_(TASK_SIZE)::an_expanded_sub-process_keeps_its_size
  Scenario: An expanded sub-process keeps its size
    Given an expanded sub-process 400 × 200
    When the off-size tasks are listed and the task size is fixed
    Then it is neither off-size nor fixed

  @test:scripts/tests/process/diagram-fit.test.ts::tasks_are_one_square_size_(TASK_SIZE)::only:_resizes_just_the_tasks_named
  Scenario: Fixing only named tasks resizes just those
    Given off-size tasks A and B
    When the task size is fixed for B only
    Then only B is fixed and A is still off-size

  @test:scripts/tests/process/diagram-fit.test.ts::tasks_are_one_square_size_(TASK_SIZE)::a_diagram_already_at_TASK_SIZE_is_left_byte_for_byte
  Scenario: A diagram already at TASK_SIZE is unchanged
    Given a task drawn at TASK_SIZE
    When the task size is fixed
    Then the XML is unchanged

  @test:scripts/tests/process/diagram-fit.test.ts::pools::a_step_outside_every_pool_is_reported;_a_data_store_is_not_(cat-harness#991)
  Scenario: Steps outside the pool are reported; a data store is not
    Given a pool holding step In, steps Above and Past outside it, and a data store below it
    When the shapes outside pools are computed and the fit is checked
    Then they are exactly Above and Past

  @test:scripts/tests/process/diagram-fit.test.ts::pools::a_label_across_the_pool's_right_edge_is_on_a_lane_line
  Scenario: A label across the pool's right edge is on a lane line
    Given a pooled event whose label crosses the pool's right edge
    When the fit is checked
    Then label-on-lane-line includes "E/Pool"

  @test:scripts/tests/process/diagram-fit.test.ts::a_flow_in_and_a_flow_out_never_share_a_point_(owner,_2026-11-08)::an_outgoing_flow_that_leaves_where_another_arrives_is_reported
  Scenario: An outgoing flow that leaves where another flow arrives is reported
    Given tasks A, B and C left to right, with F1 from A to B, F2 from B to C, and a loop-back F3 from C entering B at the point F2 leaves it
    When the diagram is checked for shared ports
    Then the one shared port is F3 with F2 on B
    And the "edge-shared-port" finding is "F3+F2/B"

  @test:scripts/tests/process/diagram-fit.test.ts::a_flow_in_and_a_flow_out_never_share_a_point_(owner,_2026-11-08)::the_same_loop_entering_another_side_is_clean,_and_two_arrivals_on_one_point_are_a_join
  Scenario: A loop entering another side is clean, and two arrivals on one point are a join
    Given the same tasks, with the loop-back F3 entering B from below, and F4 from A arriving at C on the same point as F2
    When the diagram is checked for shared ports
    Then no shared port is reported
