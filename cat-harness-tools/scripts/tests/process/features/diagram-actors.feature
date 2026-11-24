# The actors line under a BPMN drawing (owner, 2026-11-23): "when displaying bpmn diagrams,
# the linked actors/roles should be listed underneath as a compact inline list in the figure description".
Feature: Every BPMN figure lists the actors and roles its lanes are bound to

  @test:scripts/tests/process/diagram-actors.test.ts::the_actors_a_drawing's_lanes_and_pools_are_bound_to::every_lane_in_document_order,_nested_ones_included,_then_each_pool_with_no_lanes
  Scenario: The actors a drawing's lanes and pools are bound to: every lane in document order, nested ones included, then each pool with no lanes
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then every lane in document order, nested ones included, then each pool with no lanes

  @test:scripts/tests/process/diagram-actors.test.ts::the_actors_a_drawing's_lanes_and_pools_are_bound_to::a_lane_is_bound_the_way_laneRoleRef_reads_it:_partitionElementRef_first,_the_legacy_ref_only_without_one
  Scenario: The actors a drawing's lanes and pools are bound to: a lane is bound the way laneRoleRef reads it: partitionElementRef first, the legacy ref only without one
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then a lane is bound the way laneRoleRef reads it: partitionElementRef first, the legacy ref only without one

  @test:scripts/tests/process/diagram-actors.test.ts::the_actors_a_drawing's_lanes_and_pools_are_bound_to::an_unprefixed_BPMN_file_reads_the_same
  Scenario: The actors a drawing's lanes and pools are bound to: an unprefixed BPMN file reads the same
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then an unprefixed BPMN file reads the same

  @test:scripts/tests/process/diagram-actors.test.ts::the_actors_line::one_compact_line:_linked_where_a_page_exists,_by_name_where_none_does,_never_a_table
  Scenario: The actors line: one compact line: linked where a page exists, by name where none does, never a table
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then one compact line: linked where a page exists, by name where none does, never a table

  @test:scripts/tests/process/diagram-actors.test.ts::the_actors_line::a_bound_lane_with_no_name_falls_back_to_its_page's_title,_then_to_the_ref
  Scenario: The actors line: a bound lane with no name falls back to its page's title, then to the ref
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then a bound lane with no name falls back to its page's title, then to the ref

  @test:scripts/tests/process/diagram-actors.test.ts::the_actors_line::with_no_resolver_every_name_is_listed_unlinked
  Scenario: The actors line: with no resolver every name is listed unlinked
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then with no resolver every name is listed unlinked

  @test:scripts/tests/process/diagram-actors.test.ts::the_actors_line::escapes_what_it_writes,_and_carries_a_caller's_link_attribute
  Scenario: The actors line: escapes what it writes, and carries a caller's link attribute
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then escapes what it writes, and carries a caller's link attribute

  @test:scripts/tests/process/diagram-actors.test.ts::the_actors_line::a_drawing_with_no_lanes_or_pools_has_no_line
  Scenario: The actors line: a drawing with no lanes or pools has no line
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then a drawing with no lanes or pools has no line

  @test:scripts/tests/process/diagram-actors.test.ts::every_BPMN_figure_renderer_carries_the_line::the_journeys_viewer,_in_the_figure's_caption
  Scenario: Every BPMN figure renderer carries the line: the journeys viewer, in the figure's caption
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then the journeys viewer, in the figure's caption

  @test:scripts/tests/process/diagram-actors.test.ts::every_BPMN_figure_renderer_carries_the_line::the_docs_pages,_right_under_the_drawing
  Scenario: Every BPMN figure renderer carries the line: the docs pages, right under the drawing
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then the docs pages, right under the drawing

  @test:scripts/tests/process/diagram-actors.test.ts::every_BPMN_figure_renderer_carries_the_line::the_processes_viewer,_under_the_drawing,_its_lanes_linked_to_their_roles'_pages
  Scenario: Every BPMN figure renderer carries the line: the processes viewer, under the drawing, its lanes linked to their roles' pages
    Given a BPMN drawing whose lanes and pools are bound, unbound, nested or repeated
    When its actors are listed
    Then the processes viewer, under the drawing, its lanes linked to their roles' pages
