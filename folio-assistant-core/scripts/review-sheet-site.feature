Feature: the review sheet's published script and page

  @test:scripts/review-sheet-site.test.ts::review-sheet-site::publishesScriptAndConfig
  Scenario: publishes the script, its manifest, the Config rows, a graph and a page
    When the review sheet site is built
    Then one config is published and the page carries the script's sha256
    And the Config rows, and a graph with the checksum, permissions and sheet, are written

  @test:scripts/review-sheet-site.test.ts::review-sheet-site::noConfigNothing
  Scenario: a folio without a sheet config publishes nothing
    When a folio without a sheet config is built
    Then nothing is published
