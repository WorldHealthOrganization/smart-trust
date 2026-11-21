Feature: bootstrap's files, published as they sit

  Background:
    Given a temporary bootstrap holding README.md, schemas/x.json, bootstrap.json and a .git directory

  @test:scripts/publish-files.test.ts::bootstrap's_files,_published_as_they_sit::publishesFilesVerbatim
  Scenario: every file lands at its own relative path, byte for byte; nothing is rendered
    When its files are published to an empty site directory
    Then the files written are exactly README.md, bootstrap.json and schemas/x.json
    And schemas/x.json holds the same bytes
    And no .html file is written

  @test:scripts/publish-files.test.ts::bootstrap's_files,_published_as_they_sit::neverOverwritesAndReports
  Scenario: never overwrites: a file already at the address wins, and is REPORTED
    Given a site directory that already holds its own bootstrap.json
    When the files are published to it
    Then bootstrap.json is reported skipped
    And the site's own bootstrap.json is unchanged
