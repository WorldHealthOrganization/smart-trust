# scripts/check-source-licence.ts in --check mode compares the committed source-licence sidecar
# with a fresh one and writes nothing: a check that repairs is the defect. Each Scenario names the
# test that executes it.
Feature: Checking the source-licence sidecar without writing it

  @test:scripts/tests/check-source-licence.test.ts::--check_decides_each_freshness_state_where_it_is_decided::a_CURRENT_sidecar_passes_and_its_bytes_are_untouched
  Scenario: A current sidecar passes and is left byte-for-byte
    Given an instance whose committed sidecar matches the licence report
    When the check runs
    Then the state is "current" and the exit is 0
    And the sidecar's bytes are unchanged

  @test:scripts/tests/check-source-licence.test.ts::--check_decides_each_freshness_state_where_it_is_decided::a_hand-staled_sidecar_FAILS_and_is_NOT_repaired
  Scenario: A stale sidecar fails and is not repaired
    Given an instance whose committed sidecar was built from a different report
    When the check runs
    Then the state is "stale" and the exit is 1
    And the sidecar's bytes are unchanged

  @test:scripts/tests/check-source-licence.test.ts::--check_decides_each_freshness_state_where_it_is_decided::an_ABSENT_sidecar_fails_rather_than_passing_vacuously,_and_is_not_created
  Scenario: An absent sidecar fails and is not created
    Given an instance with no committed sidecar
    When the check runs
    Then the state is "absent" and the exit is 1
    And no sidecar file exists afterwards

  @test:scripts/tests/check-source-licence.test.ts::--check_decides_each_freshness_state_where_it_is_decided::an_UNREADABLE_sidecar_exits_2_—_the_question_could_not_be_asked
  Scenario: An unreadable sidecar exits 2 and is left alone
    Given an instance whose committed sidecar is "{ not json"
    When the check runs
    Then the state is "unreadable" and the exit is 2
    And the sidecar still reads "{ not json"

  @test:scripts/tests/check-source-licence.test.ts::--check_decides_each_freshness_state_where_it_is_decided::a_MALFORMED_record_still_fails_on_content_when_the_sidecar_is_current
  Scenario: A malformed record fails on content even when the sidecar is current
    Given a licence report with a malformed entry "stated with no basis"
    And a committed sidecar matching that report
    When the check runs
    Then the state is "current" and the exit is 1

  @test:scripts/tests/check-source-licence.test.ts::--check_decides_each_freshness_state_where_it_is_decided::the_exit_table_is_the_one_the_docblock_states
  Scenario: The exit table maps each freshness state to its code
    # Gap: the docblock text itself is not read; only the exported table is compared.
    When the check's exit table is read
    Then current is 0, stale 1, absent 1, unreadable 2 and unknown 2

  @test:scripts/tests/check-source-licence.test.ts::the_real_gate,_run_as_CI_runs_it::`--check`_on_this_repository_writes_nothing
  Scenario: Running the real check on this repository writes nothing
    Given this repository's committed source-licence sidecar, or its absence
    When "check-source-licence.ts --check" is run as a process
    Then the sidecar's bytes, or its absence, are unchanged
    And the exit code is 0, 1 or 2
