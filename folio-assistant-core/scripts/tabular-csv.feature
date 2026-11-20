Feature: reading a CSV into CSVW tabular metadata

  @test:scripts/tabular-csv.test.ts::parseDelimited_(RFC_4180)::rfc4180Quoting
  Scenario: handles quoted delimiters, doubled quotes, CRLF, and a newline inside a field
    When a CSV with quoted delimiters, doubled quotes, CRLF and a newline in a field is parsed
    Then each field is read correctly

  @test:scripts/tabular-csv.test.ts::parseDelimited_(RFC_4180)::bomAndTrailingNewline
  Scenario: drops a UTF-8 BOM, and a trailing newline is not an extra record
    When a CSV with a BOM and a trailing newline is parsed
    Then the BOM is dropped and there is no extra record

  @test:scripts/tabular-csv.test.ts::routing_is_a_content_question::sniffsAgreedDelimiter
  Scenario: finds the delimiter the rows agree on
    When the delimiter is sniffed
    Then semicolon, tab and comma files are recognised

  @test:scripts/tabular-csv.test.ts::routing_is_a_content_question::oneFieldRowsNotTable
  Scenario: refuses a file whose rows split into one field: not shown to be a table
    When rows that split into one field are sniffed
    Then it is refused as not a table

  @test:scripts/tabular-csv.test.ts::routing_is_a_content_question::ambiguousDelimitersRefused
  Scenario: refuses when two delimiters agree on DIFFERENT widths, rather than picking one
    When two delimiters agree on different widths
    Then it is refused as ambiguous

  @test:scripts/tabular-csv.test.ts::classifyColumn:_never_guess_a_datatype::naNotInteger
  Scenario: 1, 2, 3, N/A is NOT an integer column
    When "1, 2, 3, N/A" is classified
    Then it is undetermined, not integer

  @test:scripts/tabular-csv.test.ts::classifyColumn:_never_guess_a_datatype::decimalsWiden
  Scenario: integers with decimals widen to decimal, measured
    When integers with decimals are classified
    Then the column is decimal, measured

  @test:scripts/tabular-csv.test.ts::classifyColumn:_never_guess_a_datatype::textIsReading
  Scenario: text is a reading, not a fallback
    When words are classified
    Then the column is string, measured

  @test:scripts/tabular-csv.test.ts::classifyColumn:_never_guess_a_datatype::emptyIsAbsence
  Scenario: an empty value is absence, not evidence; an all-empty column is undetermined
    When a date column with empty values and an all-empty column are classified
    Then the first is date, measured
    And the second is undetermined

  @test:scripts/tabular-csv.test.ts::classifyColumn:_never_guess_a_datatype::zeroPaddedAreCodes
  Scenario: zero-padded digit strings are codes: string, never integer (urat)
    When zero-padded digits, mixed with a decimal, and plain numbers are classified
    Then zero-padded digits are string, mixed with a decimal undetermined, and plain numbers decimal

  @test:scripts/tabular-csv.test.ts::classifyColumn:_never_guess_a_datatype::datesAndIntegersNoWiden
  Scenario: dates mixed with integers do not widen
    When dates mixed with an integer are classified
    Then the column is undetermined

  @test:scripts/tabular-csv.test.ts::header_and_names::numericFirstRowIsData
  Scenario: a first row of numbers over a numeric column is data, not a header
    When a numeric first row over numeric data and a titled first row are checked
    Then the first is data and the second a header

  @test:scripts/tabular-csv.test.ts::header_and_names::emptyOrRepeatedTitleIsData
  Scenario: an empty or repeated title cell means row 1 is data
    When a first row with an empty or repeated title is checked
    Then it is data

  @test:scripts/tabular-csv.test.ts::header_and_names::columnNamesTokens
  Scenario: names are tokens, unique, and CSVW's _col.N when there is no title
    When column names are made
    Then they are tokens, unique, and _col.N where there is no title

  @test:scripts/tabular-csv.test.ts::extractCsv::publicCommentExport
  Scenario: reads a public-comment export into a valid record
    When a public-comment export is extracted
    Then the record validates with each column's datatype measured
    And its header row is 1 and its extent 3 by 5, measured

  @test:scripts/tabular-csv.test.ts::extractCsv::csvAnchorDeterminedNull
  Scenario: a CSV's sheet and cell are a DETERMINED null, and its table starts at row 1, column 1
    When the anchor is read
    Then sheet and cell are null and the table starts at row 1, column 1

  @test:scripts/tabular-csv.test.ts::extractCsv::neverStub
  Scenario: is never a stub: no fac:stub, and columns are present
    When the table is read
    Then it is not a stub and has columns

  @test:scripts/tabular-csv.test.ts::extractCsv::headerlessNumeric
  Scenario: a headerless numeric table gets headerRow null and _col.N names
    When a headerless numeric table is extracted
    Then the header row is null and the columns are _col.1 and _col.2, with extent 2 by 2

  @test:scripts/tabular-csv.test.ts::extractCsv::raggedExtentUndetermined
  Scenario: ragged rows past the probe make the extent undetermined: BOTH null, never half-known
    When rows past the probe are ragged
    Then rows and columns are both null, undetermined

  @test:scripts/tabular-csv.test.ts::extractCsv::csvwNoOwnKeys
  Scenario: the derived CSVW carries no key of ours
    When the derived CSVW is made
    Then it carries no fac: key and no datatypeSource
