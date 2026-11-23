Feature: a figure redrawn as drawn, from its transcribed PDF drawing

  @test:scripts/as-drawn-svg.test.ts::as-drawn-svg::drawsDataAsPrinted
  Scenario: every path and text run is drawn where the data puts it
    When the figure is drawn
    Then the canvas, fills, dashes, caps, printed widths and rotations are as in the data

  @test:scripts/as-drawn-svg.test.ts::as-drawn-svg::clipsAndLinks
  Scenario: clipped paint stays clipped, and glossary labels link
    When the figure is drawn
    Then a clipped shape is drawn inside its clip path
    And a label that names a glossary concept links to it

  @test:scripts/as-drawn-svg.test.ts::as-drawn-svg::schemaRefusesBadData
  Scenario: the schema refuses data that cannot be drawn faithfully
    When a shape is neither filled nor stroked, names a missing clip, or a colour is not #RRGGBB
    Then the data does not parse

  @test:scripts/as-drawn-svg.test.ts::as-drawn-svg::checkFindsStaleSvg
  Scenario: --check fails until the SVG matches its data
    Given a data file with no SVG yet
    When it is checked, then written, then checked again
    Then the first check fails and the second passes
