Feature: reading an Excel workbook into CSVW tabular metadata

  @test:scripts/tabular-xlsx.test.ts::ZIP_and_references::storedAndDeflated
  Scenario: reads stored and deflated entries alike
    When stored and deflated ZIP entries are read
    Then both give their content

  @test:scripts/tabular-xlsx.test.ts::ZIP_and_references::a1RefsRoundTrip
  Scenario: A1 references round-trip, past Z
    When A1 references are parsed and made
    Then B7, AB10 and a column past Z round-trip

  @test:scripts/tabular-xlsx.test.ts::ZIP_and_references::serialsToIso
  Scenario: serials become ISO dates, and a time part makes a datetime
    When serial 46082 and 46082.5 are converted
    Then the first is a date and the second a datetime

  @test:scripts/tabular-xlsx.test.ts::ZIP_and_references::dateFormatTokens
  Scenario: a format code is a date format only for a date token outside quotes and brackets
    When format codes are checked
    Then date tokens are dates, and tokens in quotes or brackets are not

  @test:scripts/tabular-xlsx.test.ts::findBlocks::findBlocksSplits
  Scenario: splits on empty rows, then on empty columns within a band
    When the cells are split into blocks
    Then they split on empty rows, then on empty columns

  @test:scripts/tabular-xlsx.test.ts::extractXlsx::commentsSheetTypes
  Scenario: a comments sheet: shared and inline strings, booleans, and dates read as dates, not integers
    When a comments sheet is extracted
    Then the record validates with integer, string, date and boolean columns
    And its anchor, extent and URL are where the table is

  @test:scripts/tabular-xlsx.test.ts::extractXlsx::dakSheetFourTables
  Scenario: a DAK-shaped sheet: four tables, each anchored where it really starts
    When a DAK-shaped sheet is extracted
    Then four tables are each anchored where they start, the title cell read as data
    And the decision table's columns carry their datatypes

  @test:scripts/tabular-xlsx.test.ts::extractXlsx::numericReferencesDecode
  Scenario: numeric character references decode: Excel's &#10; in a title is a line break (urat)
    When titles with numeric character references are extracted
    Then they decode to a line break and an accented letter

  @test:scripts/tabular-xlsx.test.ts::extractXlsx::emptySheetNoTable
  Scenario: an empty sheet produces no table, and the next sheet is still read
    When an empty sheet and a comments sheet are extracted
    Then only the comments sheet gives a table

  @test:scripts/tabular-xlsx.test.ts::extractXlsx::storedSameAsDeflated
  Scenario: stored (uncompressed) workbooks read the same as deflated ones
    When a stored and a deflated workbook are extracted
    Then the results are equal

  @test:scripts/tabular-xlsx.test.ts::extractXlsx::routedByContent
  Scenario: routing is by content: no ZIP signature, or a ZIP without a workbook part, is refused
    When a CSV and a ZIP without a workbook part are extracted
    Then both are refused

  @test:scripts/tabular-xlsx.test.ts::extractXlsx::malformedSheetRefused
  Scenario: a malformed sheet part is refused, not half-read into a thinner table
    When a sheet with malformed XML is extracted
    Then it is refused as not well-formed

  @test:scripts/tabular-xlsx.test.ts::extractXlsx::neverStubNoOwnKeys
  Scenario: is never a stub, and the derived CSVW carries no key of ours
    When the DAK sheet is extracted and turned into CSVW
    Then no table is a stub and the CSVW carries no fac: key

  @test:scripts/tabular-xlsx.test.ts::DAK_decision_tables_(scn4)::decisionTableRead
  Scenario: reads the preamble, the section, the grouped inputs, the titled outputs and the don't-care
    When a DAK decision table is extracted
    Then its anchor, preamble, header row, extent and don't-care marks are read
    And its grouped inputs and titled outputs carry their datatypes, with only don't-cares undetermined

  @test:scripts/tabular-xlsx.test.ts::DAK_decision_tables_(scn4)::repeatedOutputLabelsTitleRow
  Scenario: a title row may repeat the output labels; it is still the title row
    When the title row repeats the output labels
    Then it is still the header row

  @test:scripts/tabular-xlsx.test.ts::DAK_decision_tables_(scn4)::noTitleRowInputsUntitled
  Scenario: no title row (a contraindication table): the inputs stay untitled, never guessed
    When a contraindication table has no title row
    Then the inputs stay untitled

  @test:scripts/tabular-xlsx.test.ts::DAK_decision_tables_(scn4)::strayCellOwnBlock
  Scenario: a stray cell does not swallow the table: JE!A1's `7` becomes its own block
    When a stray cell sits beside the decision table
    Then it is its own block and the table keeps its preamble

  @test:scripts/tabular-xlsx.test.ts::DAK_decision_tables_(scn4)::mergedRangesOntoTable
  Scenario: merged ranges are read onto the table they fall inside, and no other
    When merged ranges fall inside two tables
    Then each table carries only its own

  @test:scripts/tabular-xlsx.test.ts::DAK_decision_tables_(scn4)::partialStartGeneric
  Scenario: a block that only starts like one falls back to the generic reading
    When a block that only starts like a decision table is read
    Then it falls back to the generic reading with no preamble

  @test:scripts/tabular-xlsx.test.ts::DAK_decision_tables_(scn4)::csvwCarriesNone
  Scenario: the CSVW export carries none of it
    When the decision table's CSVW is made
    Then it carries no fac:, preamble, wildcard or Section
