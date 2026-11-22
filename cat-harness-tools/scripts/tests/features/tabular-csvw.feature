# CSVW as the tabular model, annotated, and QA that catches an absent tool
# (bean eief). Each Scenario names the test that executes it.
Feature: CSVW tabular model

  @test:scripts/tests/tabular-csvw.test.ts::CSVW_is_annotated,_never_replaced::a_CSVW_reader_is_handed_a_real_CSVW_document_—_context_and_all
  Scenario: The CSVW view carries the CSVW context
    Given a tabular record with one table of one column
    When it is turned into CSVW
    Then its @context is "http://www.w3.org/ns/csvw"
    And it holds one table with one column

  @test:scripts/tests/tabular-csvw.test.ts::CSVW_is_annotated,_never_replaced::…and_it_carries_NO_key_of_ours,_at_ANY_level
  Scenario: The CSVW view carries no key of ours at any level
    Given a tabular record with a normal table and a stub table
    When it is turned into CSVW and every key at every level is collected
    Then some keys are seen, every one is a CSVW key
    And neither "datatypeSource" nor "$schema" is among them

  @test:scripts/tests/tabular-csvw.test.ts::CSVW_is_annotated,_never_replaced::the_record_is_plain_JSON_—_its_filename_does_not_claim_JSON-LD
  Scenario: The record's filename is plain JSON
    Then the tabular record's filename is "tabular.csvw.json", not ".jsonld"

  @test:scripts/tests/tabular-csvw.test.ts::CSVW_is_annotated,_never_replaced::`csvw:`_is_in_the_published_@context,_beside_the_other_eight
  Scenario: csvw is in the published context
    Then the content context maps "csvw" to "http://www.w3.org/ns/csvw#"
    And it still has doco, deo, cito, oa, prov, skos, dcterms and fhir

  @test:scripts/tests/tabular-csvw.test.ts::CSVW_is_annotated,_never_replaced::only_THREE_`fac:`_terms_extend_it_—_the_ones_CSVW_cannot_express
  Scenario: Only three fac terms extend a table
    When a table is parsed
    Then its fac keys are exactly "fac:anchor", "fac:extent" and "fac:headerRow"

  @test:scripts/tests/tabular-csvw.test.ts::"as_best_as_can"_is_three_states,_never_two::an_undetermined_datatype_must_be_CSVW_`any`,_never_a_guess
  Scenario: An undetermined datatype must be any
    Then a column with an undetermined datatype source and datatype "string" is refused
    And with datatype "any" it is accepted

  @test:scripts/tests/tabular-csvw.test.ts::"as_best_as_can"_is_three_states,_never_two::a_HALF-KNOWN_extent_is_refused_—_it_reads_as_a_measurement
  Scenario: A half-known extent is refused
    Then a measured extent with rows 8 and null columns is refused
    And an undetermined extent with both null is accepted

  @test:scripts/tests/tabular-csvw.test.ts::"as_best_as_can"_is_three_states,_never_two::a_CSV's_`sheet:_null`_is_DETERMINED,_not_missing
  Scenario: A CSV's null sheet is accepted
    Then a table anchored with sheet null and cell null at row 1 column 1 is accepted

  @test:scripts/tests/tabular-csvw.test.ts::a_stub_cannot_be_mistaken_for_a_result::a_HALF-STUB_is_refused_by_the_schema
  Scenario: A half-stub is refused
    Then a table with a stub and real columns is refused
    And a stub table with no columns is accepted

  @test:scripts/tests/tabular-csvw.test.ts::a_stub_cannot_be_mistaken_for_a_result::a_stub_needs_a_DATE_—_undated_cannot_be_told_from_abandoned
  Scenario: A stub needs a date
    Then a stub whose since is "soon" is refused

  @test:scripts/tests/tabular-csvw.test.ts::a_stub_cannot_be_mistaken_for_a_result::`stubsIn`_finds_them
  Scenario: The stubs in a record are found
    Given a record with a stub table for "tabular-xlsx" and a normal table
    Then the stubs found name only "tabular-xlsx"

  @test:scripts/tests/tabular-csvw.test.ts::the_QA_catches_ABSENCE_—_and_can_actually_fail::an_outstanding_stub_is_REPORTED,_and_does_not_block
  Scenario: An outstanding stub is reported
    Given an entry whose record holds a stub and whose tool is still a stub
    Then the one finding has severity "stub" and names "tabular-xlsx" and "since 2026-09-20"

  @test:scripts/tests/tabular-csvw.test.ts::the_QA_catches_ABSENCE_—_and_can_actually_fail::an_EXPIRED_stub_blocks_—_the_tool_exists_and_`fac:stub`_is_still_there
  Scenario: An expired stub blocks
    Given an entry whose record holds a stub but whose tool is no longer a stub
    Then the one finding has severity "expired" and says "must go"

  @test:scripts/tests/tabular-csvw.test.ts::the_QA_catches_ABSENCE_—_and_can_actually_fail::a_record_that_will_not_validate_is_UNREADABLE,_never_skipped
  Scenario: An invalid record is unreadable
    Given an entry whose record has no tables
    Then the one finding has severity "unreadable"

  @test:scripts/tests/tabular-csvw.test.ts::the_QA_catches_ABSENCE_—_and_can_actually_fail::an_entry_with_no_tabular_record_yields_nothing_—_not_a_finding
  Scenario: No tabular record, no finding
    Given an entry with no tabular record
    Then there are no findings

  @test:scripts/tests/tabular-csvw.test.ts::the_QA_catches_ABSENCE_—_and_can_actually_fail::the_stubbed_set_is_READ_from_the_tool_declarations,_not_restated
  Scenario: The stubbed set is a proper subset of the declared tools
    # Gap: the title says the set is read from the declarations; the body checks only that at least one tool is outside it.
    When the stubbed tools are derived from the declared tools
    Then at least one declared tool is not stubbed

  @test:scripts/tests/tabular-csvw.test.ts::the_QA_catches_ABSENCE_—_and_can_actually_fail::a_working_tool_with_nothing_to_install_is_NOT_a_stub_(cat-tools-1wre)
  Scenario: An install-free runnable tool is not a stub
    Given a tool with nothing to install and only manual invocation, and one with nothing to install and a shell invocation
    Then only the manual one is stubbed

  @test:scripts/tests/tabular-csvw.test.ts::the_QA_catches_ABSENCE_—_and_can_actually_fail::a_declared_stub_names_the_skill_it_would_satisfy
  Scenario: Every stubbed tool satisfies a skill
    # Gap: when no declared tool is stubbed the loop runs zero times and the test passes with no assertion.
    Then every declared tool that is stubbed names at least one skill it satisfies
