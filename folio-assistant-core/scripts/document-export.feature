Feature: the export page of a document

  @test:scripts/document-export.test.ts::latestNamesStable
  Scenario: latest names are stable: no commit, no date
    When the latest file names of dth-hrh are made
    Then they carry no commit or date

  @test:scripts/document-export.test.ts::humanSizes
  Scenario: sizes read as a person says them
    When sizes are written for a person
    Then 900 is "900 B", 812000 is "793 KB" and 3565158 is "3.4 MB"

  @test:scripts/document-export.test.ts::exportPageListsFiles
  Scenario: the Export page lists every file with its details and both links
    When the export index is rendered
    Then each file is listed with both links, its filters and parameters
    And the size, pages, bookmarks, date, commit and manifest link are shown
    And markup in a value is escaped
    And it has the export main element and the details heading

  @test:scripts/document-export.test.ts::wordTemplateShips
  Scenario: the Word template ships with the script, so the pandoc version cannot pick the fonts
    When the reference .docx is read
    Then it is a zip carrying the Word theme
