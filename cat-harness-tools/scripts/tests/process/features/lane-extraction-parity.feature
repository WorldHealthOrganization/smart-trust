# check-lane-documentation carries a copy of the BPMN extractor's label filter;
# the test re-states that copy and compares it, and its lane regex, with the
# real extractor and with bpmn-moddle over the repository's own diagrams.
Feature: The lane check's copy of the extractor agrees with the extractor

  @test:scripts/tests/process/lane-extraction-parity.test.ts::the_lane_check's_extractor_copy_has_not_drifted::there_are_diagrams_to_compare
  Scenario: There are diagrams to compare
    Given the .bpmn files of the repository, outside hidden directories and node_modules
    When they are listed
    Then there is at least one

  @test:scripts/tests/process/lane-extraction-parity.test.ts::the_lane_check's_extractor_copy_has_not_drifted::every_string_the_real_extractor_produces,_the_copy_also_produces
  Scenario: Every msgid the real extractor emits, the copy emits too
    # Gap: the copy compared is the test's own re-statement of check-lane-documentation's filter, kept verbatim by convention; drift in check-lane-documentation.ts itself is not detected
    Given every diagram of the repository
    When each is extracted by extractBpmn and by the re-stated copy
    Then no extractor msgid is missing from the copy

  @test:scripts/tests/process/lane-extraction-parity.test.ts::the_lane_check's_extractor_copy_has_not_drifted::the_copy_claims_nothing_the_real_extractor_would_not_emit
  Scenario: The copy emits nothing the real extractor does not
    # Gap: the copy compared is the test's own re-statement of check-lane-documentation's filter, kept verbatim by convention; drift in check-lane-documentation.ts itself is not detected
    Given every diagram of the repository
    When each is extracted by extractBpmn and by the re-stated copy
    Then the copy has no msgid the extractor lacks

  @test:scripts/tests/process/lane-extraction-parity.test.ts::the_lane_check's_extractor_copy_has_not_drifted::the_regex_reader_sees_every_lane_bpmn-moddle_does
  Scenario: A prefix-optional lane regex counts the lanes bpmn-moddle parses
    # Gap: the regex counted is the test's own, not check-lane-documentation's; and a diagram bpmn-moddle cannot parse is skipped
    Given every diagram of the repository that bpmn-moddle parses
    When its lanes in every process are counted by the parser and its <lane> / <bpmn:lane> tags by regex
    Then the two counts agree for every diagram

  @test:scripts/tests/process/lane-extraction-parity.test.ts::the_lane_check's_extractor_copy_has_not_drifted::at_least_one_diagram_uses_the_UNPREFIXED_form
  Scenario: At least one diagram writes an unprefixed <lane>
    Given every diagram of the repository
    When they are searched for an unprefixed <lane> tag
    Then at least one has one

  @test:scripts/tests/process/lane-extraction-parity.test.ts::the_lane_check's_extractor_copy_has_not_drifted::the_corpus_it_is_actually_run_against_comes_back_clean
  Scenario: The lane documentation check is clean on the repository
    Given the repository root
    When checkLanes is run on it
    Then it reports no unextracted, undocumented, unnamed or orphan lanes
    And it counted more than zero lanes
