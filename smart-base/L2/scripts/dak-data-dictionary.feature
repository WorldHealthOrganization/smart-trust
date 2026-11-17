Feature: dak-data-dictionary reads a DAK's data-dictionary workbook into an annex
  An xlsx workbook is unzipped and read, its headers normalised, and its data
  sheets turned into a data-dictionary web annex.

  @test:smart-base/L2/scripts/dak-data-dictionary.test.ts::dak-data-dictionary::readsWorkbookSheetsAndCells
  Scenario: unzip and readWorkbook read a workbook's sheets and cells
    Given a workbook with a "READ ME" sheet and an "IMMZ.C Client registration" sheet
    Then unzipping it yields "xl/workbook.xml"
    And reading it yields the two sheets by name, in order
    And the second row of the data sheet is "IMMZ.C4", "IMMZ.C.DE.1", "Unique identifier", "ID", "N/A"

  @test:smart-base/L2/scripts/dak-data-dictionary.test.ts::dak-data-dictionary::headerKeyAbsorbsTemplateDrift
  Scenario: headerKey absorbs the template's drift: case, `*`, plural, a trailing parenthetical
    Then "Input options *" and "Input option" have the same header key
    And "Multiple choice type (if applicable)" across a line break has the key "multiple choice type"

  @test:smart-base/L2/scripts/dak-data-dictionary.test.ts::dak-data-dictionary::annexHoldsDataSheetsAndIdRows
  Scenario: the annex holds the data sheets only, rows with an id only, entities decoded
    When the annex is built from the workbook with annexOf "10665/380303", label "Web Annex A" and section "dak#core-data-elements"
    Then it carries that annexOf, label and section, no iris, and the annex schema
    And its only sheet is "IMMZ.C Client registration"
    And its rows are the ones with ids "IMMZ.C.DE.1" and "IMMZ.C.DE.2"
    And the label "Name &amp; surname" is decoded to "Name & surname"
    And its source sha256 is 64 hex characters
