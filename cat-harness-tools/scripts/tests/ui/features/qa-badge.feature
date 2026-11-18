# readQaSummary in scripts/gen-docs-pages.ts summarises a block's QA sidecar into one of four
# states, and a block nothing was checked on is `unswept`, never `pass`.
# Each Scenario names the test that executes it.
Feature: QA badge summary states

  @test:scripts/tests/ui/qa-badge.test.ts::readQaSummary_—_four_states,_and_`unswept`_is_never_`pass`::a_missing_sidecar_is_undefined,_so_the_caller_says_'not_swept'
  Scenario: A missing sidecar gives no summary
    Given a directory with no sidecar for the block
    When its QA summary is read
    Then the summary is undefined

  @test:scripts/tests/ui/qa-badge.test.ts::readQaSummary_—_four_states,_and_`unswept`_is_never_`pass`::a_sidecar_that_will_not_parse_is_undefined,_not_a_crash
  Scenario: A sidecar that will not parse gives no summary rather than a crash
    Given a sidecar holding "{ not json"
    When its QA summary is read
    Then the summary is undefined

  @test:scripts/tests/ui/qa-badge.test.ts::readQaSummary_—_four_states,_and_`unswept`_is_never_`pass`::one_fail_outranks_any_number_of_passes
  Scenario: One fail outranks any number of passes
    Given a sidecar with two passing criteria and one failing criterion
    When its QA summary is read
    Then the state is "fail"
    And it counts 1 fail and 2 passes

  @test:scripts/tests/ui/qa-badge.test.ts::readQaSummary_—_four_states,_and_`unswept`_is_never_`pass`::warn_outranks_pass,_and_loses_to_fail
  Scenario: Warn outranks pass and loses to fail
    Given a sidecar with one warn and one pass
    Then its state is "warn"
    And a sidecar with one warn and one fail has state "fail"

  @test:scripts/tests/ui/qa-badge.test.ts::readQaSummary_—_four_states,_and_`unswept`_is_never_`pass`::ALL_n/a_is_`unswept`,_not_`pass`_—_the_whole_point
  Scenario: A sidecar where every criterion is n/a is unswept, not pass
    Given a sidecar with two criteria both "n/a"
    When its QA summary is read
    Then the state is "unswept"
    And it counts 2 n/a and 0 passes

  @test:scripts/tests/ui/qa-badge.test.ts::readQaSummary_—_four_states,_and_`unswept`_is_never_`pass`::only_the_FIRST_entry_per_criterion_counts
  Scenario: Only the first entry per criterion counts
    Given a sidecar whose one criterion has a "pass" entry followed by a "fail" entry
    When its QA summary is read
    Then the state is "pass"
    And it counts 0 fails

  @test:scripts/tests/ui/qa-badge.test.ts::readQaSummary_—_four_states,_and_`unswept`_is_never_`pass`::an_empty_criteria_map_is_`unswept`
  Scenario: An empty criteria map is unswept
    Given a sidecar with an empty criteria map
    When its QA summary is read
    Then the state is "unswept"
