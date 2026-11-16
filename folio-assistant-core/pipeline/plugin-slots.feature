Feature: the pipeline plugin slots core fills (tabular-csvw, library-entry-arms)

  @test:pipeline/plugin-slots.test.ts::tabular-csvw::readsDelimitedTextWithoutMagic
  Scenario: reads text with no magic bytes as delimited text
    Given the text "name,age" with two rows, no mimetype, at p.csv
    When the tabular-csvw extractor runs
    Then the result carries the tabular CSVW schema id
    And the result mentions p.csv

  @test:pipeline/plugin-slots.test.ts::tabular-csvw::nullForNonTabularText
  Scenario: is null for text that does not split into a table
    When the extractor runs on a single line of prose
    Then it returns null

  @test:pipeline/plugin-slots.test.ts::tabular-csvw::nullForFakeWorkbook
  Scenario: is null for a declared workbook that is not one, rather than throwing
    When the extractor runs on "not a zip" declared as an xlsx workbook
    Then it returns null rather than throwing

  @test:pipeline/plugin-slots.test.ts::tabular-csvw::nullForUnreadableMimetype
  Scenario: is null for a mimetype it has no reader for (an OpenDocument spreadsheet)
    When the extractor runs on an OpenDocument spreadsheet mimetype
    Then it returns null

  @test:pipeline/plugin-slots.test.ts::tabular-csvw::pluginNodeNamesTable
  Scenario: the pipeline-plugins node names this table
    When the pipeline-plugins/tabular-csvw.json node is read
    Then its slot is "tabular-csvw"
    And its implementation names pipeline/plugin-slots.ts and an export of that module

  @test:pipeline/plugin-slots.test.ts::library-entry-arms::foundWritesNodesAndScheme
  Scenario: a promoted entry's reference list and abbreviations are read by core's two Tools
    Given an instance declaring library, references and glossary directories
    And a promoted entry whose sections hold an Abbreviations table and a References section of two entries
    When the library-entry-arms slot's arms run over the entry
    Then references is found 2, by references-extract, with two reference nodes written
    And glossary is found 2, by glossary-from-source, as candidate terms of a new scheme named after the entry and titled from its manifest

  @test:pipeline/plugin-slots.test.ts::library-entry-arms::noneOnlyWhenRan
  Scenario: none is recorded when a reader ran over the sections and found nothing
    Given a promoted entry whose only section is prose
    When the arms run
    Then references and glossary are each none with a count of 0

  @test:pipeline/plugin-slots.test.ts::library-entry-arms::notExtractedWithoutSections
  Scenario: an entry with no sections is not-extracted, never none
    Given a promoted entry with no sections directory
    When the arms run
    Then references and glossary are each not-extracted, saying there is no sections/ to read

  @test:pipeline/plugin-slots.test.ts::library-entry-arms::notExtractedWithoutDirectory
  Scenario: an instance with nowhere to write is not-extracted, saying which directory is missing
    Given an instance declaring only a library directory
    When the arms run over an entry with a References and an Abbreviations section
    Then references is not-extracted, naming the references directory
    And glossary is not-extracted, naming the glossary directory

  @test:pipeline/plugin-slots.test.ts::library-entry-arms::mergesIntoSchemeCitingEntry
  Scenario: candidates go to the scheme that already cites the entry, and an authored term is kept
    Given a glossary scheme with another name whose authored term cites the entry's sections
    When the glossary arm runs
    Then no scheme named after the entry is written
    And the authored term is unchanged and the new candidate is added to that scheme

  @test:pipeline/plugin-slots.test.ts::library-entry-arms::ingestRecordsEachStep
  Scenario: the ingest's runner records each arm's step in the entry's extraction.json
    When cat-harness-tools' runEntryArms runs core's library-entry-arms over the entry
    Then extraction.json is a folio-library-extraction/v1 record with references and glossary each found 2

  @test:pipeline/plugin-slots.test.ts::library-entry-arms::pluginNodeNamesTable
  Scenario: the library-entry-arms pipeline-plugins node names this table
    When the pipeline-plugins/library-entry-arms.json node is read
    Then its slot is "library-entry-arms"
    And its implementation names pipeline/plugin-slots.ts and an export of that module
