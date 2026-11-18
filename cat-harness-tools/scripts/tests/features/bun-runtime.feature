# scripts/check-bun-runtime.ts compares the pinned .bun-version with the running Bun and counts script sidecars
# stamped with another engine, then renders the session-start section. Each Scenario names the test that executes it.
Feature: The Bun-runtime guard

  @test:scripts/tests/bun-runtime.test.ts::the_three_states::equal_versions_are_a_match,_and_nothing_is_stamped_elsewhere
  Scenario: Equal pinned and running versions are a match
    Given 86 sidecars stamped "bun-1.3.14"
    When the pin "1.3.14" is judged against the running "1.3.14"
    Then the verdict is "match"
    And 0 sidecars are stamped elsewhere out of 86

  @test:scripts/tests/bun-runtime.test.ts::the_three_states::differing_versions_are_a_mismatch,_and_it_COUNTS_what_was_stamped_elsewhere
  Scenario: Differing versions are a mismatch that counts sidecars stamped elsewhere
    Given 72 sidecars stamped "bun-1.3.14" and 14 stamped "bun-1.3.11"
    When the pin "1.3.14" is judged against the running "1.3.11"
    Then the verdict is "mismatch" with pinned "1.3.14" and running "1.3.11"
    And 72 sidecars are stamped elsewhere out of 86

  @test:scripts/tests/bun-runtime.test.ts::the_three_states::an_unreadable_pin_is_`cannot-tell`,_NOT_a_match
  Scenario: An unreadable pin cannot be told, not matched
    Given no readable pin and a running "1.3.11"
    When they are judged
    Then the verdict is "cannot-tell"
    And the reason mentions ".bun-version"

  @test:scripts/tests/bun-runtime.test.ts::the_three_states::no_reported_Bun_version_is_`cannot-tell`,_NOT_a_match
  Scenario: No reported Bun version cannot be told, not matched
    Given a pin "1.3.14" and no reported running version
    When they are judged
    Then the verdict is "cannot-tell"
    And the reason contains "did not report"

  @test:scripts/tests/bun-runtime.test.ts::the_`bun-`_prefix::the_count_is_against_the_PREFIXED_stamp,_so_a_match_reads_0_and_not_everything
  Scenario: Sidecars are compared against the prefixed engine stamp
    Given 40 sidecars stamped "bun-1.3.14" and a matching pin and runtime of "1.3.14"
    When they are judged
    Then 0 sidecars are stamped elsewhere
    And a single sidecar carrying the bare "1.3.14" counts as 1 stamped elsewhere

  @test:scripts/tests/bun-runtime.test.ts::the_`bun-`_prefix::a_sidecar_with_no_engine_version_at_all_counts_as_stamped_elsewhere
  Scenario: A sidecar with no engine version counts as stamped elsewhere
    Given one sidecar with no engine version and a matching pin and runtime
    When they are judged
    Then 1 sidecar is stamped elsewhere

  @test:scripts/tests/bun-runtime.test.ts::an_empty_scan_does_not_read_clean::zero_sidecars_is_reported_rather_than_rendered_as_nothing_to_do
  Scenario: An empty scan reports zero sidecars rather than reading clean
    Given no sidecars, a pin "1.3.14" and a running "1.3.11"
    When they are judged
    Then the verdict is "mismatch"
    And 0 sidecars are reported, with 0 stamped elsewhere

  @test:scripts/tests/bun-runtime.test.ts::the_session-start_section::a_mismatch_says_you_are_not_running_what_CI_runs
  Scenario: A mismatch section says you are not running what CI runs
    Given a mismatch of pin "1.3.14" against running "1.3.11" with 72 sidecars stamped elsewhere
    When the session-start section is rendered
    Then it names both "1.3.11" and "1.3.14"
    And it contains "different code from the gates"

  @test:scripts/tests/bun-runtime.test.ts::the_session-start_section::it_states_that_the_count_is_NOT_churn_—_the_retraction,_asserted
  Scenario: The mismatch section states the count is not churn
    Given a mismatch of pin "1.3.14" against running "1.3.11" with 72 sidecars stamped elsewhere
    When the session-start section is rendered
    Then it contains "72", "not churn and will not dirty your tree" and "#1452"
    And it does not contain "git checkout --" or "Discard them"

  @test:scripts/tests/bun-runtime.test.ts::the_session-start_section::it_names_the_residue_that_IS_still_live_—_a_downgraded_stamp
  Scenario: The mismatch section names the downgraded-stamp residue
    Given a mismatch of pin "1.3.14" against running "1.3.11" with 72 sidecars stamped elsewhere
    When the session-start section is rendered
    Then it contains "bun-1.3.11" and "sfjo"

  @test:scripts/tests/bun-runtime.test.ts::the_session-start_section::`cannot-tell`_says_unknown_rather_than_matched
  Scenario: A cannot-tell section says unknown rather than matched
    Given no readable pin, a running "1.3.11" and no sidecars
    When the session-start section is rendered
    Then it contains "unknown, not as matched"
    And it does not contain "matches"

  @test:scripts/tests/bun-runtime.test.ts::the_session-start_section::a_match_is_one_line_and_raises_no_alarm
  Scenario: A match section is one reassuring line with no alarm
    Given a match at "1.3.14" with 86 sidecars
    When the session-start section is rendered
    Then it contains "runs what CI runs"
    And it does not contain "sfjo"

  @test:scripts/tests/bun-runtime.test.ts::a_mismatch_with_a_UNIFORM_corpus::zero_stamped_elsewhere_does_not_produce_"older_than_the_0_above"
  Scenario: A mismatch with every sidecar on the running engine does not cite a zero count
    Given 86 sidecars all stamped "bun-1.3.11", a pin "1.3.14" and a running "1.3.11"
    When the session-start section is rendered
    Then it contains neither "older than the 0" nor "**0**"
    And it contains "All 86 committed script sidecars already record"
    And it still contains "different code from the gates"

  @test:scripts/tests/bun-runtime.test.ts::a_mismatch_with_a_UNIFORM_corpus::a_non-zero_count_still_names_the_axis_to_watch
  Scenario: A mismatch with sidecars stamped elsewhere names the count and the axis to watch
    Given 72 sidecars stamped "bun-1.3.14" and 14 stamped "bun-1.3.11", a pin "1.3.14" and a running "1.3.11"
    When the session-start section is rendered
    Then it contains "**72**" and "moves backwards"
