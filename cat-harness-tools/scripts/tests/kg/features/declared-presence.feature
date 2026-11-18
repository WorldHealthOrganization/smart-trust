# scripts/lib/declared-presence.ts splits declared paths into present and absent, and reports a
# declared-but-absent one once, distinct from empty, without failing the scanner (bean 95ir).
# Each Scenario names the test that executes it.
Feature: A declared path is on disk or said to be absent

  @test:scripts/tests/kg/declared-presence.test.ts::declared,_and_on_disk_or_not::splits_without_dropping
  Scenario: Declared paths split into present and absent without dropping any
    Given the declared paths "/a", "/b" and "/c", of which only "/b" is not on disk
    When they are split
    Then the present paths are "/a" and "/c"
    And the absent paths are "/b"

  @test:scripts/tests/kg/declared-presence.test.ts::declared,_and_on_disk_or_not::an_absent_one_is_SAID_—_in_words_that_are_not_'empty'_—_and_said_once
  Scenario: An absent declared path is reported once, in words that are not empty
    Given the absent declared path "/lib-x", described as "a library"
    When its absence is noted twice
    Then exactly one line is reported
    And it says "not on disk"
    And it says "NOT read as empty"
