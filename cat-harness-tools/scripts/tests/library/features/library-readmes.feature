# library-readmes: one README per library item, from its manifest (bean qgjh).
# Each Scenario names the test that executes it.
Feature: Library item READMEs

  @test:scripts/tests/library/library-readmes.test.ts::an_item's_facts_come_from_its_manifest::reads_the_arXiv_record_as_the_id_arXiv_itself_cites
  Scenario: The arXiv record is read as the id arXiv cites
    Given an item manifest whose arXiv record is id 2504.21474, version 1
    When the item's facts are read
    Then its arXiv fact is "2504.21474v1"

  @test:scripts/tests/library/library-readmes.test.ts::an_item's_facts_come_from_its_manifest::says_'not_recorded'_as_an_empty_value,_never_the_word_null
  Scenario: A field recorded as null is an empty value
    Given an item manifest whose doi is null
    When the item's facts are read
    Then its doi fact is the empty string

  @test:scripts/tests/library/library-readmes.test.ts::an_item's_facts_come_from_its_manifest::has_no_facts_without_a_manifest
  Scenario: A directory with no manifest has no facts
    Given a path that holds no manifest
    When the item's facts are read
    Then there are none

  @test:scripts/tests/library/library-readmes.test.ts::the_markers_are_the_platform's,_the_file_is_not::leaves_a_README_without_markers_alone
  Scenario: A README without generator markers is left alone
    Given a README written by a person, with no generator markers
    When generated content is spliced into it
    Then the splice gives nothing to write

  @test:scripts/tests/library/library-readmes.test.ts::the_committed_READMEs_are_current::and_match_what_the_generator_produces_now
  Scenario: The committed READMEs match the generator
    Given the README plan the generator produces now
    Then the plan holds at least one write
    And every planned file on disk equals its planned body
