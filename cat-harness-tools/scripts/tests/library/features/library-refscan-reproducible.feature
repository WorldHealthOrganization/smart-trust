# library:viz's projection must not carry a measurement of the machine that
# built it (bean 65oe). Skipped where the projection is not built.
Feature: The library projection's refScan is reproducible

  @test:scripts/tests/library/library-refscan-reproducible.test.ts::the_library_projection's_refScan::still_EXISTS_—_its_presence_is_how_a_reader_knows_the_scan_ran
  Scenario: refScan is present
    Given the built library projection
    Then it carries a refScan

  @test:scripts/tests/library/library-refscan-reproducible.test.ts::the_library_projection's_refScan::does_not_carry_`filesRead`
  Scenario: refScan carries no filesRead
    Given the built library projection
    Then its refScan has no filesRead property

  @test:scripts/tests/library/library-refscan-reproducible.test.ts::the_library_projection's_refScan::carries_`unreadable`,_which_is_what_makes_a_zero_provisional
  Scenario: refScan carries an unreadable list
    Given the built library projection
    Then its refScan has an unreadable property that is an array

  @test:scripts/tests/library/library-refscan-reproducible.test.ts::the_library_projection's_refScan::carries_NOTHING_ELSE_—_a_new_count_would_reintroduce_the_defect
  Scenario: refScan carries nothing but unreadable
    Given the built library projection
    Then the keys of its refScan are exactly ["unreadable"]

  @test:scripts/tests/library/library-refscan-reproducible.test.ts::the_library_projection's_refScan::`unreadable`_names_FILES,_never_a_tally
  Scenario: Every unreadable entry is a string
    # Gap: the title says each item names a FILE; the body checks only that each is a string, not that it is a path or names a file.
    Given the built library projection
    Then every item of refScan.unreadable is a string

  @test:scripts/tests/library/library-refscan-reproducible.test.ts::the_schema_refuses_the_field_rather_than_merely_omitting_it::refScan_is_a_STRICT_object,_so_`filesRead`_is_rejected,_not_ignored
  Scenario: The library index schema rejects a refScan carrying filesRead
    Given the built library projection and the LibraryIndexSchema export
    When the projection is parsed, and a copy whose refScan adds filesRead
    Then the projection parses
    And the copy with filesRead is rejected
