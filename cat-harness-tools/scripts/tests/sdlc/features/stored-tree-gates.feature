# The lsi skills check (scripts/lsi.ts) and kg:detangle:check judge a fresh in-memory computation
# rather than comparing with the stored copy, report a ref with no stored entry as UNKNOWN, and refuse bad flags with exit 2.
# Each Scenario names the test that executes it.
Feature: Gates over stored result trees judge instead of comparing

  @test:scripts/tests/sdlc/stored-tree-gates.test.ts::lsi_check_over_a_stored_index_directory::rebuilds_the_index_in_memory_and_passes;_the_stored_copy_is_not_what_it_judges
  Scenario: The LSI check rebuilds the skills index in memory and passes
    Given the cat-harness "skills" prose graph
    When the LSI check runs over it in stored mode
    Then it exits 0
    And its first line starts with "pass" and says "recomputed in this run"
    And every further line is an "advisory:" or "current:" note

  @test:scripts/tests/sdlc/stored-tree-gates.test.ts::lsi_check_over_a_stored_index_directory::--against_a_ref_with_no_entry_is_UNKNOWN,_reported_and_not_gated
  Scenario: The LSI check against a ref with no stored entry reports UNKNOWN and passes
    Given the QA store pointed at an empty bare file:// remote
    When the LSI check runs over the skills graph in stored mode against "main"
    Then it exits 0
    And its output says "UNKNOWN"

  @test:scripts/tests/sdlc/stored-tree-gates.test.ts::lsi_check_over_a_stored_index_directory::an_unknown_flag_and_a_malformed_--against_are_usage_errors_(2)
  Scenario: The LSI check refuses an unknown flag or a malformed --against with exit 2
    When the LSI check CLI is run with the unknown flag "--chek"
    Then it exits 2 and says "unknown flag"
    And when it is run with "--against refs/heads/main" it exits 2

  @test:scripts/tests/sdlc/stored-tree-gates.test.ts::kg:detangle:check_over_a_stored_detangle_tree::computes,_never_fails_on_a_stale_stored_copy,_reports_a_missing_baseline_as_UNKNOWN,_and_writes_nothing
  Scenario: The detangle check passes over a stale copy, reports a missing baseline as UNKNOWN and writes nothing
    # Skipped: when there is no git checkout at the composed root above the harness
    Given the QA store pointed at an empty bare file:// remote
    When kg-detangle is run with "--check --against main" over the composed checkout
    Then it exits 0
    And its output contains neither "STALE " nor "and commit the result"
    And its output says "UNKNOWN"
    And the checkout's git status is unchanged

  @test:scripts/tests/sdlc/stored-tree-gates.test.ts::kg:detangle:check_over_a_stored_detangle_tree::a_malformed_--against_is_a_usage_error_(2),_never_a_missing_baseline
  Scenario: The detangle check refuses a malformed --against with exit 2
    When kg-detangle is run with "--check --against refs/heads/main"
    Then it exits 2
