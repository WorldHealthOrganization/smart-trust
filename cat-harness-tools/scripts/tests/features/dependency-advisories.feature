# scripts/check-dependency-advisories.ts turns bun audit's JSON into a clean, advisories or
# undetermined verdict and renders it so an undetermined run never reads as clean.
# Each Scenario names the test that executes it.
Feature: Dependency advisories keep clean, found and undetermined apart

  @test:scripts/tests/dependency-advisories.test.ts::the_three_states_are_kept_apart::`{}`_is_bun's_clean_shape,_and_IS_an_answer
  Scenario: An empty JSON object is a clean verdict
    Given bun audit output "{}" over 372 scanned packages
    When the verdict is read
    Then it is "clean"
    And it records 372 scanned

  @test:scripts/tests/dependency-advisories.test.ts::the_three_states_are_kept_apart::empty_OUTPUT_is_not_an_answer_—_it_is_undetermined
  Scenario: Empty audit output is undetermined
    Given empty bun audit output
    When the verdict is read
    Then it is "undetermined"

  @test:scripts/tests/dependency-advisories.test.ts::the_three_states_are_kept_apart::unparseable_output_is_undetermined,_never_clean
  Scenario: Unparseable audit output is undetermined
    Given the audit output "<html>502 Bad Gateway</html>"
    When the verdict is read
    Then it is "undetermined"

  @test:scripts/tests/dependency-advisories.test.ts::the_three_states_are_kept_apart::a_JSON_array_or_null_is_undetermined_—_shape_is_not_enough
  Scenario: A JSON array or null is undetermined
    Given the audit output "[]", and separately "null"
    When each verdict is read
    Then each is "undetermined"

  @test:scripts/tests/dependency-advisories.test.ts::the_three_states_are_kept_apart::packages_reported_but_no_readable_advisory_is_undetermined
  Scenario: A package with no readable advisory is undetermined
    Given the audit output naming "left-pad" with an empty advisory list
    When the verdict is read
    Then it is "undetermined"

  @test:scripts/tests/dependency-advisories.test.ts::the_three_states_are_kept_apart::every_undetermined_verdict_carries_a_non-empty_reason
  Scenario: Every undetermined verdict carries a reason
    Given the audit outputs "", "not json", "[]", "null" and one package with an empty list
    When each verdict is read
    Then each is "undetermined"
    And each carries a non-empty reason

  @test:scripts/tests/dependency-advisories.test.ts::undetermined_is_never_RENDERED_as_clean_—_the_property_the_exit_code_cannot_carry::no_undetermined_render_contains_a_tick
  Scenario: No undetermined render contains a tick
    Given the outage outputs "", "<html>502</html>" and "null"
    When each verdict is rendered
    Then no render contains "✓"

  @test:scripts/tests/dependency-advisories.test.ts::undetermined_is_never_RENDERED_as_clean_—_the_property_the_exit_code_cannot_carry::...and_each_says_so_in_words_a_reader_cannot_mistake
  Scenario: An undetermined render says it is not a clean run
    Given the outage outputs "", "<html>502</html>" and "null"
    When each verdict is rendered
    Then each render contains "UNDETERMINED"
    And each render contains "This is not a clean run"

  @test:scripts/tests/dependency-advisories.test.ts::undetermined_is_never_RENDERED_as_clean_—_the_property_the_exit_code_cannot_carry::...and_raises_a_::warning::_so_it_is_visible_without_opening_the_log
  Scenario: An undetermined render raises a warning annotation
    Given the outage outputs "", "<html>502</html>" and "null"
    When each verdict is rendered
    Then each render contains "::warning::"

  @test:scripts/tests/dependency-advisories.test.ts::undetermined_is_never_RENDERED_as_clean_—_the_property_the_exit_code_cannot_carry::the_clean_render,_by_contrast,_ticks_and_states_WHAT_was_scanned
  Scenario: The clean render ticks and states how many packages were scanned
    Given the audit output "{}" over 372 scanned packages
    When the verdict is rendered
    Then the render contains "✓" and "372"
    And it does not contain "UNDETERMINED"

  @test:scripts/tests/dependency-advisories.test.ts::advisories_are_reported_in_full::each_advisory_reaches_the_summary_as_a_::warning::
  Scenario: Each advisory is rendered as a warning annotation
    Given a high-severity advisory on "tar-fs" and a low-severity one on "left-pad"
    When the verdict is rendered
    Then it contains "::warning::high — tar-fs: Path traversal"
    And it contains "::warning::low — left-pad: Regex denial of service"

  @test:scripts/tests/dependency-advisories.test.ts::advisories_are_reported_in_full::worst-first,_so_the_severe_one_is_not_buried
  Scenario: Advisories are listed worst first
    Given a high-severity advisory on "tar-fs" and a low-severity one on "left-pad"
    When the verdict is read
    Then it is "advisories"
    And the first advisory is for "tar-fs"

  @test:scripts/tests/dependency-advisories.test.ts::advisories_are_reported_in_full::a_missing_severity_is_reported_as_unknown_rather_than_dropped
  Scenario: An advisory with no severity is kept as "unknown"
    Given an advisory on "p" with a title and no severity
    When the verdict is read
    Then its severity is "unknown"

  @test:scripts/tests/dependency-advisories.test.ts::advisories_are_reported_in_full::an_unknown_severity_sorts_LAST,_not_first_—_it_is_not_a_silent_critical
  Scenario: An unrecognised severity sorts after a critical one
    Given an advisory on "b" with severity "weird" and one on "a" with severity "critical"
    When the advisories are sorted
    Then the order is "a", then "b"

  @test:scripts/tests/dependency-advisories.test.ts::advisories_are_reported_in_full::the_advisory_render_says_out_loud_that_it_is_not_blocking
  Scenario: The advisory render states that it is not blocking
    Given a high-severity and a low-severity advisory
    When the verdict is rendered
    Then it contains "not blocking"
