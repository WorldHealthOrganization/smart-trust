# A source RECORDED, not held (bean scfh, issue #1614): the schema, the
# manifest gen-library-jsonld writes, and the L1 gate.
Feature: A referenced source holds no text

  @test:scripts/tests/library/referenced-source.test.ts::the_record_validates,_the_manifest_holds_nothing,_and_the_entry_passes_with_no_text
  Scenario: A referenced record validates and its entry passes with no text
    Given a hand-written referenced.json in state "referenced"
    And the manifest gen-library-jsonld generates for that entry
    Then the record parses against the referenced-source schema
    And the manifest contains nothing and its provenance is "ingested"
    And an entry holding referenced.json is of kind "referenced"
    And the L1 check of the entry has no unmet requirement

  @test:scripts/tests/library/referenced-source.test.ts::an_identity_missing_a_field_is_refused,_never_guessed
  Scenario: An identity missing a field is refused
    Given an identity file holding only a title
    When referenced-source.py is run with it on a PDF
    Then it exits with code 1
    And its stderr says "never guess"

  @test:scripts/tests/library/referenced-source.test.ts::a_referenced_entry_that_holds_section_text_is_REFUSED
  Scenario: A referenced entry holding section text is refused
    Given a staged referenced entry
    And a sections/s1.md file of copied text added to it
    When the entry is L1-checked
    Then the referenced-record requirement is unmet
    And its detail names "sections/"
