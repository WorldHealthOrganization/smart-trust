# Specifies archimate/scripts/archimate-crossings.ts: tanglesOf, which lists
# the lines of a view that cross each other or pass through a box they do
# not connect, and viewOf, which finds a view of a model.
Feature: The tangles of a view are its crossings and its lines through boxes

  @test:archimate/scripts/crossings.test.ts::tanglesOf::counts_two_lines_that_cross,_and_not_two_that_only_share_a_box
  Scenario: Two crossing lines are a crossing; two lines sharing a box are not
    Given four boxes at the corners of a square, with lines a→d and b→c across it, and a→b and a→c along its sides
    When the tangles of the view are listed
    Then the only crossing is between "ad" and "bc"

  @test:archimate/scripts/crossings.test.ts::tanglesOf::counts_a_line_through_a_box_it_does_not_connect,_but_not_through_a_box_that_holds_its_end
  Scenario: A line through an unconnected box counts; a line into a nested box does not count its container
    Given boxes "a", "m" and "z" in a row, with a line from "a" to "z"
    When the tangles of the view are listed
    Then they are exactly one "through-box" tangle on "m"
    And given a line from "a" to box "in" nested inside box "outer"
    Then that view has no tangles

  @test:archimate/scripts/crossings.test.ts::tanglesOf::does_not_count_groups_a_line_crosses
  Scenario: A line across a group is not a tangle
    Given a line from "a" to "z" that passes across a group "g"
    When the tangles of the view are listed
    Then there are none

  @test:archimate/scripts/crossings.test.ts::viewOf::finds_a_view_by_id,_by_page_slug,_or_by_name
  Scenario: A view is found by id, by page slug or by name
    Given a model with one view "id-v1" named "1. Central Health Workforce Registry"
    When it is looked up by "id-v1", by "1-central-health-workforce-registry" and by its name
    Then each lookup returns that view
    And a lookup by "nope" returns nothing
