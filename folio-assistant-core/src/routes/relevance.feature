Feature: reference facts for relevance

  @test:src/routes/relevance.test.ts::factsFromFilesAndRefs
  Scenario: facts come from per-entry files and from ref({…}) left in the module
    Given a per-entry reference file and ref({…}) calls left in the schema module
    When the facts are read
    Then each reference's title, authors, year and URL are read, null where absent
