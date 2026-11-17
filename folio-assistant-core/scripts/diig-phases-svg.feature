Feature: the DIIG phases figure drawn from its data

  @test:scripts/diig-phases-svg.test.ts::diig-phases-svg::labelsFromData
  Scenario: every label comes from the data
    When the figure is drawn
    Then every label is in the SVG
    And the guide tile has its id and the dashed outline

  @test:scripts/diig-phases-svg.test.ts::diig-phases-svg::tileLinksLibraryEntry
  Scenario: a tile links to its library entry
    When a tile's link is made with a library base
    Then it links the resource's library entry, in the SVG too

  @test:scripts/diig-phases-svg.test.ts::diig-phases-svg::unknownResourceOrPhaseFails
  Scenario: a tile naming an unknown resource or phase fails loudly
    When a tile naming an unknown resource, and one naming an unknown phase, are drawn
    Then each throws naming what is unknown

  @test:scripts/diig-phases-svg.test.ts::diig-phases-svg::adaptationAddsTiles
  Scenario: an adaptation adds tiles and moves 'this document' without copying the figure
    Given an adaptation adding a resource and a tile and moving this document
    When the adapted figure is loaded and drawn
    Then it has three columns and the added resource
    And the SVG shows the new label and "(this document)" once
