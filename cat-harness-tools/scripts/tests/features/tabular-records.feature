# CSV and spreadsheets (bean p67i) and the v1 writer's retirement (bean urat).
# Each Scenario names the test that executes it.
Feature: Tabular records

  @test:scripts/tests/tabular-records.test.ts::the_v1_writer_is_retired::run_as_a_command_it_refuses,_writes_nothing,_and_names_the_CSVW_rung
  Scenario: The v1 writer refuses to run
    When "tabular-records.py" is run on a CSV with an output directory
    Then it exits 1, its stderr names "tabular-csvw.ts", and the output directory does not exist

  @test:scripts/tests/tabular-records.test.ts::the_narrative_slot_of_a_committed_record::the_schema_refuses_a_record_that_says_two_things_at_once
  Scenario: A narrative that contradicts itself is refused
    Given a committed v1 record, which the schema accepts
    Then a narrative with text in state "not-authored" is refused
    And a narrative with no text in state "draft" is refused
    And a confirmed narrative drafted and confirmed by the same agent is refused
    And a confirmed narrative drafted by an agent and confirmed by a human is accepted

  @test:scripts/tests/tabular-records.test.ts::routing:_a_spreadsheet_is_not_an_archive::an_.xlsx_takes_the_TABULAR_rung,_though_its_magic_bytes_say_zip
  Scenario: An xlsx takes the tabular rung
    Given a two-sheet xlsx built with package-root-absolute worksheet targets
    Then it sniffs as the xlsx mimetype and its plan takes the "tabular" rung

  @test:scripts/tests/tabular-records.test.ts::routing:_a_spreadsheet_is_not_an_archive::a_plain_zip_still_takes_the_archive_rung
  Scenario: A plain zip takes the archive rung
    Given a zip of one text file
    Then its plan takes the "archive" rung

  @test:scripts/tests/tabular-records.test.ts::routing:_a_spreadsheet_is_not_an_archive::a_CSV_takes_the_tabular_rung_on_CONTENT,_not_on_its_name
  Scenario: A CSV is routed by content
    Given a three-column CSV named "mystery.dat"
    Then it sniffs as no mimetype, and its plan takes the "tabular" rung

  @test:scripts/tests/tabular-records.test.ts::routing:_a_spreadsheet_is_not_an_archive::prose_named_.csv_is_NOT_routed_as_tabular
  Scenario: Prose named .csv is not tabular
    Given two lines of prose named "notdata.csv"
    Then no delimiter is found and its plan does not take the "tabular" rung

  @test:scripts/tests/tabular-records.test.ts::routing:_a_spreadsheet_is_not_an_archive::a_single-column_file_is_not_a_table
  Scenario: A single-column file is not a table
    Then a file of three single words has no delimiter

  @test:scripts/tests/tabular-records.test.ts::routing:_a_spreadsheet_is_not_an_archive::a_RAGGED_file_is_refused_rather_than_split_anyway
  Scenario: A ragged file has no delimiter
    Then a comma file with rows of 3, 2 and 4 fields has no delimiter

  @test:scripts/tests/tabular-records.test.ts::routing:_a_spreadsheet_is_not_an_archive::isTabularMimetype_refuses_everything_else
  Scenario: Only tabular mimetypes are tabular
    Then zip, pdf, null, empty and undefined are not tabular mimetypes
    And the xlsx mimetype is

  @test:scripts/tests/tabular-records.test.ts::the_gate_fires_on_a_workbook_with_no_record::a_workbook_entry_with_no_tabular_record_is_UNMET
  Scenario: A workbook entry with no record is unmet
    Given an xlsx entry with no tabular record
    Then "tabular-records" is unmet, saying "no tabular record"

  @test:scripts/tests/tabular-records.test.ts::the_gate_fires_on_a_workbook_with_no_record::a_valid_record_is_MET_and_names_the_narrative_state
  Scenario: A valid record is met
    Given an xlsx entry holding the committed v1 record
    Then "tabular-records" is met, saying "narrative not-authored"

  @test:scripts/tests/tabular-records.test.ts::the_gate_fires_on_a_workbook_with_no_record::a_record_that_is_not_the_declared_schema_is_UNMET
  Scenario: A record of another schema is unmet
    Given an xlsx entry whose record has $schema "other/v1"
    Then "tabular-records" is unmet, naming the declared schema id

  @test:scripts/tests/tabular-records.test.ts::the_gate_fires_on_a_workbook_with_no_record::a_CSV_entry_is_checked_on_its_merits_despite_an_unrecognised_mimetype
  Scenario: An unrecognised-mimetype entry with a record is checked on its merits
    Given an entry with no sniffed mimetype
    Then with the committed record it is met
    And with a record of another schema it is unmet

  @test:scripts/tests/tabular-records.test.ts::the_gate_fires_on_a_workbook_with_no_record::a_PDF_entry_is_MET_and_SAYS_SO_—_a_determined_zero
  Scenario: A PDF entry says it is not tabular
    Given a PDF entry
    Then the "tabular-records" detail is "not tabular (application/pdf)"

  @test:scripts/tests/tabular-records.test.ts::the_gate_fires_on_a_workbook_with_no_record::a_PDF_with_tables_transcribed_from_its_pages_is_MET,_and_still_NOT_a_dataset
  Scenario: A PDF with transcribed tables is still not a dataset
    Given a PDF entry with a CSVW record of transcribed tables
    Then "tabular-records" is met with detail "not tabular (application/pdf); 0 table(s) transcribed from its pages as CSVW"

  @test:scripts/tests/tabular-records.test.ts::the_real_corpus::every_entry_says_whether_it_is_tabular;_the_one_dataset_is_CODATA_2022
  Scenario: The real corpus has one dataset, CODATA 2022
    When every library entry under the harness is checked
    Then there is at least one entry and every one meets "tabular-records"
    And the only entry not saying "not tabular" is "codata-2022"

  @test:scripts/tests/tabular-records.test.ts::a_committed_tabular_record_is_JSON-LD_a_processor_keeps_whole::every_key_a_committed_record_carries_is_a_declared_term_—_nested_data_rides_in_`@json`
  Scenario: Every key of a committed record is declared
    Given the committed record written as a library's tabular.jsonld
    When the content keys are checked
    Then one document is read and no key is undeclared

  @test:scripts/tests/tabular-records.test.ts::a_committed_tabular_record_is_JSON-LD_a_processor_keeps_whole::the_Python_constant_IS_the_TypeScript_one_—_one_URL,_not_two
  Scenario: The Python content-context URL is the TypeScript one
    Then CONTENT_CONTEXT_URL in "_content_context.py" equals the TypeScript constant

  @test:scripts/tests/tabular-records.test.ts::a_committed_tabular_record_is_JSON-LD_a_processor_keeps_whole::a_record_written_before_the_arm_emitted_`@context`_still_validates
  Scenario: A record without @context still validates
    Then the committed record without @context is accepted
    And with a foreign @context it is refused
