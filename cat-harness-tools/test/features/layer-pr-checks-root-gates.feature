# The index's own gates run over the composed root with a layer PR swapped in: run-root-gates.py records
# each gate's errors and compare-gates.py fails the PR on an error main does not have.
# Each Scenario names the test that executes it.
Feature: The index's root gates are judged error by error

  @test:test/layer-pr-checks-root-gates.test.ts::run-root-gates.py_diagnostics::ESLint's_errors,_relative_to_the_root,_with_no_line_numbers;_warnings_are_not_errors
  Scenario: ESLint errors are keyed relative to the root without line numbers, and warnings are dropped
    Given ESLint output under the root "/r/fa" with two errors and one warning
    When run-root-gates.py reads its diagnostics
    Then the unused-argument error is keyed by its root-relative file, rule and message
    And the parsing error is keyed by its file, "parse" and its message
    And the warning is not listed

  @test:test/layer-pr-checks-root-gates.test.ts::run-root-gates.py_diagnostics::tsc's_errors,_with_and_without_a_file
  Scenario: tsc errors are keyed with their file or with a dash when they have none
    Given tsc output with one error in a file and one with no file
    When run-root-gates.py reads its diagnostics under "/r/fa"
    Then the first is keyed "cat-harness-tools/pipeline/validate.ts: TS2307: Cannot find module 'x'."
    And the second is keyed "-: TS5083: Cannot read file 'tsconfig.base.json'."

  @test:test/layer-pr-checks-root-gates.test.ts::run-root-gates.py_diagnostics::no_gate_list_is_could-not-determine,_never_an_empty_pass
  Scenario: An empty gate list is could-not-determine rather than a pass
    Given a gates file with no gates
    When run-root-gates.py runs over it
    Then it exits 2

  @test:test/layer-pr-checks-root-gates.test.ts::run-root-gates.py_diagnostics::root-gates.json_names_only_scripts_this_layer_declares
  Scenario: root-gates.json names only scripts this layer declares
    Given the gates in root-gates.json and this layer's package.json scripts and checkoutScripts
    Then there is at least one gate
    And every gate's script is declared by this layer

  @test:test/layer-pr-checks-root-gates.test.ts::compare-gates.py_with_diagnostics::#385:_green_on_main,_an_unused_argument_on_the_PR,_is_a_new_failure
  Scenario: A new error on a gate green on main is a new failure
    Given root:lint exited 0 with no errors on main
    And it exited 1 with an unused-argument error on the PR
    When compare-gates.py compares them
    Then it exits 1
    And it prints "'m' is defined but never used."

  @test:test/layer-pr-checks-root-gates.test.ts::compare-gates.py_with_diagnostics::red_on_main,_and_the_PR_adds_an_error:_new
  Scenario: An error the PR adds to a gate red on main is new
    Given root:lint failed on main with "a.ts: r: old"
    And it failed on the PR with "a.ts: r: old" and "b.ts: r: added"
    When compare-gates.py compares them
    Then it exits 1
    And it prints "b.ts: r: added" but not "a.ts: r: old"

  @test:test/layer-pr-checks-root-gates.test.ts::compare-gates.py_with_diagnostics::the_same_error_twice_where_main_has_it_once_is_new
  Scenario: The same error twice where main has it once is new
    Given main has "a.ts: r: x" once and the PR has it twice
    When compare-gates.py compares them
    Then it exits 1

  @test:test/layer-pr-checks-root-gates.test.ts::compare-gates.py_with_diagnostics::red_on_main_with_the_same_errors,_wherever_they_moved_to:_not_the_PR's
  Scenario: A gate red on main with the same errors is not the PR's failure
    # Gap: the error is identical on both sides; an error that moved is not exercised
    Given root:lint failed on main and on the PR with "a.ts: r: old"
    When compare-gates.py compares them
    Then it exits 0
    And it prints "failing on main too"

  @test:test/layer-pr-checks-root-gates.test.ts::compare-gates.py_with_diagnostics::not_applicable_on_the_PR_is_never_a_new_failure,_and_says_what_main_answered_(#1701)
  Scenario: A gate not applicable on the PR is never a new failure
    Given a gate without diagnostics that exited 78 on the PR
    When compare-gates.py compares it against main exiting 0, 1 or 2
    Then it exits 0
    And it prints "not applicable here; not counted (main exited <code>)"
    And when main did not run it, it exits 0 and prints "main did not run it, so not counted"

  @test:test/layer-pr-checks-root-gates.test.ts::compare-gates.py_with_diagnostics::a_gate_without_diagnostics_is_judged_by_its_exit,_as_before
  Scenario: A gate without diagnostics is judged by its exit
    Given a gate without diagnostics
    When it exited 1 on main and 1 on the PR, compare-gates.py exits 0
    And when it exited 0 on main and 1 on the PR, compare-gates.py exits 1
