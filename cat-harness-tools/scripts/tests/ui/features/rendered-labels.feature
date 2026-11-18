# Covers scripts/check-rendered-labels.ts: finds double-escaped character references in rendered workflow SVG labels
# and ratchets them against a per-file baseline count. Each Scenario names the test that executes it.
Feature: Rendered diagram label ratchet

  @test:scripts/tests/ui/rendered-labels.test.ts::what_counts_as_an_offending_label::the_decimal_form_a_double-escaped_`name`_produces
  Scenario: A double-escaped decimal character reference is an offending label
    Given an SVG whose one tspan text is "Dependency advisories&amp;#10;(WARN-ONLY)"
    When its offending labels are read
    Then exactly one is found

  @test:scripts/tests/ui/rendered-labels.test.ts::what_counts_as_an_offending_label::the_hex_form_too,_because_the_defect_is_not_one_spelling
  Scenario: A double-escaped hex or decimal dash is an offending label
    Given SVGs with the labels "Four jobs&amp;#x2014;two warn" and "Four jobs&amp;#8212;two warn"
    When the offending labels of each are read
    Then each yields exactly one

  @test:scripts/tests/ui/rendered-labels.test.ts::what_counts_as_an_offending_label::a_label_that_merely_CONTAINS_an_ampersand_is_not_a_finding
  Scenario: A label that only contains an ampersand is not a finding
    Given an SVG whose label is "tests &amp;amp; lint"
    When its offending labels are read
    Then none are found

  @test:scripts/tests/ui/rendered-labels.test.ts::what_counts_as_an_offending_label::a_correctly_broken_label_is_not_a_finding
  Scenario: A label correctly broken into two tspans is not a finding
    Given an SVG with the two labels "Skill-registration chain" and "(UNMASKED)"
    When its offending labels are read
    Then none are found

  @test:scripts/tests/ui/rendered-labels.test.ts::what_counts_as_an_offending_label::tspans_are_read_across_newlines
  Scenario: Tspans are read when their attributes span a newline
    Given a tspan whose opening tag wraps onto a second line with text "a"
    When the tspans are read
    Then the result is exactly ["a"]

  @test:scripts/tests/ui/rendered-labels.test.ts::the_ratchet::NOT_A_GIT_WORK_TREE_is_undetermined_—_git_could_not_answer
  Scenario: A directory that is not a git work tree is undetermined
    Given a bare temporary directory with no git repository
    When the rendered labels are checked
    Then the result is undetermined
    And zero files were scanned

  @test:scripts/tests/ui/rendered-labels.test.ts::the_ratchet::a_git_repo_with_NO_workflow_SVG_is_undetermined,_never_clean
  Scenario: A git repository with no workflow SVG is undetermined, not clean
    Given a git repository with an empty "img/workflows" directory
    When the rendered labels are checked
    Then the result is undetermined
    And zero files were scanned
    And no findings are recorded

  @test:scripts/tests/ui/rendered-labels.test.ts::the_ratchet::a_file_NOT_in_the_baseline_fails
  Scenario: A file with offending labels that is not in the baseline fails
    Given an untracked "img/workflows/a.svg" with one offending label
    And a baseline with no counts
    When the rendered labels are checked
    Then the result is determined
    And one file is unexpected

  @test:scripts/tests/ui/rendered-labels.test.ts::the_ratchet::a_file_AT_its_baseline_count_passes_—_the_outstanding_sweep_does_not_fail_the_gate
  Scenario: A file at its baseline count passes
    Given "img/workflows/a.svg" with two offending labels
    And a baseline count of 2 for that file
    When the rendered labels are checked
    Then no file is unexpected
    And no file is reported fixed

  @test:scripts/tests/ui/rendered-labels.test.ts::the_ratchet::a_baselined_file_GAINING_a_label_fails_—_the_case_a_presence-only_baseline_misses
  Scenario: A baselined file that gains an offending label fails
    Given "img/workflows/a.svg" with three offending labels
    And a baseline count of 2 for that file
    When the rendered labels are checked
    Then the unexpected files are exactly "img/workflows/a.svg"

  @test:scripts/tests/ui/rendered-labels.test.ts::the_ratchet::progress_is_FIXED_and_never_a_failure
  Scenario: A file below its baseline count is reported fixed, not failed
    Given "img/workflows/a.svg" with one offending and one plain label
    And a baseline count of 2 for that file
    When the rendered labels are checked
    Then no file is unexpected
    And the fixed files are exactly "img/workflows/a.svg"

  @test:scripts/tests/ui/rendered-labels.test.ts::the_ratchet::an_SVG_outside_a_`workflows/`_directory_is_not_in_the_subject
  Scenario: An SVG outside a workflows directory is not checked
    Given a git repository whose only SVG is "img/icons/i.svg" with an offending label
    When the rendered labels are checked
    Then the result is undetermined
    And no findings are recorded
