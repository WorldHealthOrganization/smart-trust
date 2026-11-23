# The failure recap of scripts/gates.ts quotes back the salient lines of each failed gate's
# output, so a gate red for a new reason does not look like one red for the old reason.
# Each Scenario names the test that executes it.
Feature: The lines a failed gate gets quoted back

  @test:scripts/tests/sdlc/gates-failure-summary.test.ts::the_lines_a_failed_gate_gets_quoted_back::TWO_failing_tests_are_both_named_—_the_whole_point
  Scenario: Two failing tests are both quoted
    Given bun test output with two "(fail)" lines among pass and summary lines
    When the salient failures are picked
    Then exactly the two "(fail)" lines are quoted, in order

  @test:scripts/tests/sdlc/gates-failure-summary.test.ts::the_lines_a_failed_gate_gets_quoted_back::a_`*:check`_script's_own_✗_lines_are_quoted,_not_just_bun_test's
  Scenario: A check script's own ✗ lines are quoted
    Given output with one ✓ line and two ✗ lines, one indented
    When the salient failures are picked
    Then the two ✗ lines are quoted with their indentation trimmed

  @test:scripts/tests/sdlc/gates-failure-summary.test.ts::the_lines_a_failed_gate_gets_quoted_back::a_thrown_script_is_quoted_too
  Scenario: A thrown script's error line is quoted
    Given the output "error: Cannot find module 'x'"
    When the salient failures are picked
    Then that error line is quoted

  @test:scripts/tests/sdlc/gates-failure-summary.test.ts::the_lines_a_failed_gate_gets_quoted_back::a_PASSING_line_is_never_quoted
  Scenario: Passing lines are never quoted
    Given output "✓ 56 gate(s) pass" and " 3766 pass"
    When the salient failures are picked
    Then nothing is quoted

  @test:scripts/tests/sdlc/gates-failure-summary.test.ts::the_lines_a_failed_gate_gets_quoted_back::ANSI_colour_is_stripped,_so_a_coloured_runner_still_matches
  Scenario: ANSI colour is stripped before matching
    Given a "(fail)" line wrapped in ANSI colour codes
    When the salient failures are picked
    Then "(fail) something broke" is quoted without the codes

  @test:scripts/tests/sdlc/gates-failure-summary.test.ts::the_lines_a_failed_gate_gets_quoted_back::the_same_shape_repeated_is_quoted_ONCE
  Scenario: A repeated line is quoted once
    Given output "✗ same" twice and "✗ other"
    When the salient failures are picked
    Then "✗ same" and "✗ other" are quoted once each

  @test:scripts/tests/sdlc/gates-failure-summary.test.ts::the_lines_a_failed_gate_gets_quoted_back::a_long_run_is_CAPPED,_and_says_so_rather_than_truncating_silently
  Scenario: A long run is capped with a notice
    Given 40 distinct "(fail)" lines
    When the salient failures are picked
    Then 7 lines come back, six failures and a notice
    And the last line says "scroll up"

  @test:scripts/tests/sdlc/gates-failure-summary.test.ts::the_lines_a_failed_gate_gets_quoted_back::a_very_long_single_line_is_elided_rather_than_wrapping_the_summary
  Scenario: A very long line is elided
    Given a "(fail)" line of over 400 characters
    When the salient failures are picked
    Then the quoted line is at most 160 characters and ends with "…"

  @test:scripts/tests/sdlc/gates-failure-summary.test.ts::the_lines_a_failed_gate_gets_quoted_back::output_matching_NOTHING_returns_empty_—_which_the_caller_says_out_loud
  Scenario: Output matching no failure shape quotes nothing
    # Gap: what the caller says when nothing is quoted is not checked
    Given two lines of unrecognised prose
    When the salient failures are picked
    Then nothing is quoted
