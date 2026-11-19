Feature: the SMART approach figure drawn from its data

  @test:scripts/smart-approach-svg.test.ts::smart-approach-svg::labelsFromData
  Scenario: every label comes from the data
    When the figure is drawn
    Then every label is in the SVG with the operational cell's id

  @test:scripts/smart-approach-svg.test.ts::smart-approach-svg::unknownBandRefused
  Scenario: a row naming an unknown band is refused
    When a row names an unknown band
    Then loading throws naming it

  @test:scripts/smart-approach-svg.test.ts::smart-approach-svg::textWraps
  Scenario: text wraps to the card width
    When a long text is wrapped
    Then no line is longer than 19 characters
