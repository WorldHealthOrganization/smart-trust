# Provenance (source and narrative) on a folio-tabular-csvw/v1 record in
# schemas/library/tabular-csvw: required on the record, kept out of extractor output and the CSVW document.
# Each Scenario names the test that executes it.
Feature: Provenance on a tabular CSVW record

  @test:schemas/tabular-csvw-provenance.test.ts::provenance_on_a_CSVW_record::is_required:_a_record_without_it_is_refused_(urat_step_5)
  Scenario: A CSVW record without source is refused
    Given a CSVW record with one table and no source
    When it is parsed
    Then it fails
    And a record with a source naming only a file, and no narrative, also fails

  @test:schemas/tabular-csvw-provenance.test.ts::provenance_on_a_CSVW_record::carries_the_same_source_and_narrative_blocks_v1_does
  Scenario: A CSVW record carries the same source and narrative blocks v1 does
    Given a CSVW record with a source for "p.csv" with sha256 and sniffed mimetype, and a "not-authored" narrative
    When it is parsed
    Then its source file is "p.csv"
    And its narrative state is "not-authored"

  @test:schemas/tabular-csvw-provenance.test.ts::provenance_on_a_CSVW_record::rejects_a_narrative_that_breaks_its_own_state_machine
  Scenario: A narrative that breaks its own state machine is refused
    Given a CSVW record whose narrative has no text and state "confirmed"
    When it is parsed
    Then it fails

  @test:schemas/tabular-csvw-provenance.test.ts::provenance_on_a_CSVW_record::never_reaches_the_CSVW_document_a_standard_reader_is_handed
  Scenario: Provenance never reaches the derived CSVW document
    Given a parsed CSVW record with a source and a narrative
    When it is converted to a CSVW document
    Then every top-level key is a CSVW key
    And the document does not mention "sha256"

  @test:schemas/tabular-csvw-provenance.test.ts::provenance_on_a_CSVW_record::is_not_part_of_what_an_extractor_returns
  Scenario: Provenance is not part of what an extractor returns
    Given a CSVW record with a source and a narrative
    When it is parsed as extractor tables output
    Then the result has no "source" and no "narrative"
    And the record without them parses as extractor tables output
