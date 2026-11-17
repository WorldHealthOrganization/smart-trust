# Specifies archimate/scripts/archimate-detangle.ts: detangle, which swaps,
# slides or re-routes to clear a view's crossings and lines through boxes,
# writeBack, which writes the result into the model's XML, and withModelXml,
# which writes it back into Archi's zipped archive.
Feature: Detangling a view clears its crossings and writes back only what moved

  Background:
    Given a model with one view: boxes a and b on the top row, c and d on the bottom row, all the same size, and lines a→d and b→c that cross

  @test:archimate/scripts/detangle.test.ts::detangle::swaps_two_same-size_boxes_in_a_row_to_undo_a_crossing,_and_writes_only_their_bounds
  Scenario: Swapping two same-size boxes undoes the crossing, and only their bounds are written
    Given the view scores one crossing
    When it is detangled
    Then it has no crossings and no lines through boxes, and the first change is a swap
    And the written-back XML parses to a view with no crossings
    And it has the same number of lines, and every changed line is a "<bounds" line

  @test:archimate/scripts/detangle.test.ts::detangle::with_--routes-only,_re-routes_a_line_instead,_as_Archi_bendpoints
  Scenario: With routes only, a line is re-routed as Archi bendpoints
    Given a note in the middle that line a→d runs through, and only that line kept
    And the view scores one line through a box
    When it is detangled with the routes-only option
    Then no line runs through a box and line "id-c1" is re-routed
    And the written-back XML has a "<bendpoint", and line "id-c1" reads back with bendpoints

  @test:archimate/scripts/detangle.test.ts::detangle::slides_a_box_into_free_space_inside_its_parent_to_clear_a_line,_never_out_of_it
  Scenario: A box slides into free space to clear a line, and never out of its parent
    Given boxes a and b with a line between them, and a box m of a different size on the line
    And the view scores one line through a box
    When it is detangled in one pass
    Then no line runs through a box
    And the only change is a slide of box a, and no line is re-routed
    And box a, slid, overlaps no other box
    Given boxes a, m and b in a row inside a group with room below them, m of a different size and on the line from a to b
    When that view is detangled in one pass
    Then the only change is a slide of box a, no line runs through a box, a overlaps no other box, and every box of the group stays inside it
    Given the same boxes in a group with no room inside it
    When that view is detangled in one pass
    Then no box slides, every box keeps its place, and every box of the group stays inside it

  @test:archimate/scripts/detangle.test.ts::detangle::leaves_a_clean_view_as_it_is
  Scenario: A clean view is left as it is
    Given the view with only boxes a and d and the line a→d
    When it is detangled
    Then there are no changes, and writing back returns the XML unchanged

  @test:archimate/scripts/detangle.test.ts::detangle::writes_Archi's_zipped_archive_back_as_a_zip_that_reads
  Scenario: A zipped Archi archive is written back as a zip that reads
    Given the model's XML deflated into a one-entry zip archive "model.xml"
    When new XML is written into the archive
    Then the model XML read from the result is the new XML
    And writing new XML into the plain XML bytes gives the new XML
