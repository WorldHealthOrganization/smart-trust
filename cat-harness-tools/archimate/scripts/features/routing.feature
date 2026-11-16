# Specifies how routeConnections (archimate/scripts/render-view.ts) routes a
# view's lines straight and square-on to their boxes (cat-harness-tools#1886).
# Each Scenario names the test that executes it.
Feature: An ArchiMate view's lines are routed straight and square-on to their boxes

  @test:archimate/scripts/routing.test.ts::routeConnections_straightens_lines::draws_a_line_between_boxes_side_by_side_horizontally,_not_centre_to_centre
  Scenario: A line between boxes side by side is horizontal, edge to edge
    Given a 120 by 80 box at 0,0 and a 120 by 55 box at 300,40
    When a line between them is routed
    Then both ends have the same y
    And it runs from x 120 to x 300

  @test:archimate/scripts/routing.test.ts::routeConnections_straightens_lines::draws_a_line_between_boxes_one_above_the_other_vertically
  Scenario: A line between boxes one above the other is vertical
    Given a box at 0,0 and a box at 30,200
    When a line between them is routed
    Then both ends have the same x
    And it runs from y 55 to y 200

  @test:archimate/scripts/routing.test.ts::routeConnections_straightens_lines::keeps_two_lines_into_the_same_box_apart
  Scenario: Two lines into the same box are kept apart
    Given a box "t" and two boxes below it, each with a line into "t"
    When the lines are routed
    Then their starting points are at least 16 px apart on x

  @test:archimate/scripts/routing.test.ts::routeConnections_straightens_lines::snaps_bendpoints_a_few_px_off_true_and_meets_the_boxes_square-on
  Scenario: Bendpoints a few px off true are snapped, and the line meets its boxes square-on
    Given two boxes and a line with two Archi bendpoints a few px off axis
    When the line is routed
    Then every segment is horizontal or vertical
    And it starts at x 624 and ends at x 744

  @test:archimate/scripts/routing.test.ts::routeConnections_straightens_lines::drops_a_bendpoint_that_lies_inside_an_end_box
  Scenario: A bendpoint inside an end box is dropped
    Given a line between two stacked boxes with a bendpoint inside the target box
    When the line is routed
    Then it has two points, with the same x

  @test:archimate/scripts/routing.test.ts::routeConnections_straightens_lines::runs_a_line_between_boxes_apart_on_both_axes_corner_to_corner
  Scenario: A line between boxes apart on both axes runs corner to corner
    Given a box at 0,0 and a box at 400,300
    When a line between them is routed
    Then it starts within 10 px of the first box's corner at 120,55
    And it ends within 10 px of the second box's corner at 400,300
