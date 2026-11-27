# The CSVW tabular rung (bean urat). Each Scenario names the test that executes it.
Feature: CSVW tabular rung

  @test:scripts/tests/tabular-csvw-rung.test.ts::routing::delimited_text,_xlsx_and_ODS_all_go_to_the_CSVW_rung;_ODS_says_it_will_SKIP
  Scenario: Delimited text, xlsx and ODS route to the CSVW rung
    Given a CSV file
    When its ingest plan is made with no mimetype, the xlsx mimetype and the ODS mimetype
    Then each first step runs "tabular-csvw.ts", and ODS's does not run "tabular-records.py"
    And the ODS plan says "no CSVW reader for ODS"

  @test:scripts/tests/tabular-csvw-rung.test.ts::routing::the_step's_'not_a_table_I_take'_is_an_answer;_its_other_failures_are_not
  Scenario: Only exit 2 from the CSVW step means "not a table I take"
    Then the CSVW step exiting 2 is "not taken"
    And the CSVW step exiting 1 is not
    And another step exiting 2 is not

  @test:scripts/tests/tabular-csvw-rung.test.ts::the_runner::the_record_carries_the_entry's_source_and_an_un-authored_narrative
  Scenario: The CSVW record carries the source and an unauthored narrative
    Given a file "Cases 2024.csv" and a slot that returns one table
    Then its slug is "cases-2024"
    And its record carries the file's sha256 and a narrative with null text in state "not-authored"

  @test:scripts/tests/tabular-csvw-rung.test.ts::the_runner::null_from_the_reader_is_null,_not_an_empty_record
  Scenario: A reader's null is no record
    Given a slot that returns null
    Then the record of a prose file is null

  @test:scripts/tests/tabular-csvw-rung.test.ts::the_runner::with_nothing_filling_the_slot_it_refuses,_never_falling_back_to_v1
  Scenario: An unfilled slot refuses
    Given an empty plugin registry
    Then making a CSVW record throws UnregisteredPipelinePluginError

  @test:scripts/tests/tabular-csvw-rung.test.ts::check-l1-complete_accepts_the_CSVW_record::with_its_source,_it_is_MET,_and_the_entry_is_tabular
  Scenario: A CSVW record with its source meets tabular-records
    Given an entry holding a CSVW record with a source block
    Then the "tabular-records" requirement is met, saying "1 table(s) as CSVW"
    And the entry's kind is "tabular"

  @test:scripts/tests/tabular-csvw-rung.test.ts::check-l1-complete_accepts_the_CSVW_record::without_a_source_block_it_is_UNMET,_since_the_entry_then_has_no_technical_metadata
  Scenario: A CSVW record without a source is unmet
    Given an entry holding a CSVW record with no source block
    Then the "tabular-records" requirement is unmet

  @test:scripts/tests/tabular-csvw-rung.test.ts::check-l1-complete_accepts_the_CSVW_record::a_record_that_is_not_CSVW_is_UNMET
  Scenario: A record with no tables is unmet
    Given an entry holding a record with the CSVW $schema but no tables
    Then the "tabular-records" requirement is unmet
